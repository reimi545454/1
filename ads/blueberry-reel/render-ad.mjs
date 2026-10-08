#!/usr/bin/env node
/**
 * 静止画クリエイティブ書き出し（既存広告トーン版）
 *   node render-static.mjs                       # creatives/*.json を全フォーマットで出力
 *   node render-static.mjs creatives/e-pain.json   # 1デザインのみ
 *   node render-static.mjs --guides              # ストーリー用セーフゾーン表示付き（確認用）
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SIZES = { story: [1080, 1920], feed: [1080, 1350], square: [1080, 1080] };
const args = process.argv.slice(2);
const guides = args.includes('--guides');
const files = args.filter((a) => !a.startsWith('--')).map((a) => resolve(a));
const targets = files.length ? files : readdirSync(join(ROOT, 'creatives')).filter((f) => f.endsWith('.json')).sort().map((f) => join(ROOT, 'creatives', f));
const outDir = join(ROOT, 'out', 'ad');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--font-render-hinting=none'] });
let failed = 0;
try {
  for (const file of targets) {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    for (const [format, [W, H]] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(pathToFileURL(join(ROOT, 'template', 'ad.html')).href);
      try {
        const fit = await page.evaluate(([c, f, g]) => window.initAd(c, f, { guides: g }), [cfg, format, guides]);
        const problems = [...errs, ...(await page.evaluate(() => window.checkAd()))];
        if (problems.length) throw new Error(problems.join('\n    '));
        const out = join(outDir, `${cfg.id}_${format}_${W}x${H}${guides ? '_guides' : ''}.png`);
        await page.screenshot({ path: out, type: 'png' });
        console.log(`✔ ${cfg.id} / ${format} (縮小率 ${fit.scale.toFixed(2)})`);
      } catch (e) {
        failed++;
        console.error(`✘ ${cfg.id} / ${format}\n    ${e.message}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
