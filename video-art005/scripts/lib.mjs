import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff' };

// プロジェクト直下だけを 127.0.0.1 で配信する（外部通信なし）
export function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  throw new Error('Chromium/Chrome が見つかりません。CHROME_PATH を指定するか、`npx playwright-core install chromium` を実行してください。');
}

export async function openPage() {
  const { server, port } = await serve();
  const browser = await chromium.launch({
    executablePath: findChrome(),
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars', '--disable-lcd-text', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
  if (errors.length) throw new Error('ページ読み込みエラー:\n' + errors.join('\n'));
  const fontsOk = await page.evaluate('window.__fontsOk');
  if (!fontsOk) throw new Error('Noto Sans JP の読み込みに失敗しました（代替フォントでの描画を防ぐため中断）。');
  return { page, browser, server, close: async () => { await browser.close(); server.close(); } };
}

export async function shot(page, frame) {
  await page.evaluate((f) => window.renderFrame(f), frame);
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
}
