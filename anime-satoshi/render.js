// フレーム書き出し: node render.js <開始フレーム> <終了フレーム(含まない)> <出力ディレクトリ> [並列数=2] [fps=30] [scale=1]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [, , a, b, outDir = 'frames', nw = '2', fpsS = '30', scaleS = '1'] = process.argv;
const FPS = +fpsS, N = +nw, root = __dirname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise((ok) => server.listen(0, ok)); const port = server.address().port;
  fs.mkdirSync(outDir, { recursive: true });
  const t0 = Date.now(); let done = 0; const total = +b - +a;
  const worker = async (k) => {
    const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const pg = await br.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    pg.on('pageerror', (e) => { console.error('PAGEERROR', e.message); process.exit(1); });
    pg.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
    await pg.goto(`http://localhost:${port}/`); await pg.waitForFunction('window.__ready===true', null, { timeout: 120000 });
    for (let f = +a + k; f < +b; f += N) {
      const file = path.join(outDir, String(f).padStart(5, '0') + '.png');
      if (fs.existsSync(file)) { done++; continue; }  // 再開可能
      await pg.evaluate((t) => window.renderFrame(t), f / FPS);
      await pg.screenshot({ path: file, type: 'png' });
      if (++done % 10 === 0) console.log(`${done}/${total} ${((Date.now() - t0) / 1000 / done).toFixed(2)}s/frame`);
    }
    await br.close();
  };
  await Promise.all(Array.from({ length: N }, (_, k) => worker(k)));
  server.close(); console.log('完了', total, 'フレーム', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
