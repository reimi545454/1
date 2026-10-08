#!/usr/bin/env node
/**
 * リール広告動画レンダラー
 *
 *   node render.mjs variants/a-owner.json              # 本番書き出し（MP4 + カバー画像）
 *   node render.mjs variants/a-owner.json --guides     # セーフゾーンを重ねた確認用動画
 *   node render.mjs variants/a-owner.json --stills     # 各シーンの静止画のみ書き出し
 *
 * 仕組み：template/reel.html を Chromium で開き、window.renderAt(t) で
 * 1フレームずつ描画→スクリーンショット→ffmpeg に PNG パイプで渡して H.264 にエンコードする。
 */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1920;

function parseArgs(argv) {
  const args = { variant: null, guides: false, stills: false, outDir: join(ROOT, 'out') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--guides') args.guides = true;
    else if (a === '--stills') args.stills = true;
    else if (a === '--out') args.outDir = resolve(argv[++i]);
    else if (!a.startsWith('--')) args.variant = resolve(a);
    else throw new Error(`不明なオプション: ${a}`);
  }
  if (!args.variant) throw new Error('使い方: node render.mjs <variants/xxx.json> [--guides] [--stills] [--out DIR]');
  return args;
}

function validateConfig(cfg) {
  const errs = [];
  if (!cfg.id || !/^[a-z0-9-]+$/.test(cfg.id)) errs.push('id は英小文字・数字・ハイフンのみ');
  if (!(cfg.fps > 0)) errs.push('fps が不正');
  if (!(cfg.duration > 0 && cfg.duration <= 90)) errs.push('duration は 0〜90 秒（リール広告の上限）');
  if (!Array.isArray(cfg.scenes) || cfg.scenes.length === 0) errs.push('scenes が空');
  let prevEnd = 0;
  (cfg.scenes || []).forEach((s, i) => {
    if (Math.abs(s.start - prevEnd) > 1e-6) errs.push(`scenes[${i}] の start(${s.start}) が直前の end(${prevEnd}) と不連続`);
    if (!(s.end > s.start)) errs.push(`scenes[${i}] の end が start 以下`);
    prevEnd = s.end;
  });
  if (cfg.scenes?.length && Math.abs(prevEnd - cfg.duration) > 1e-6)
    errs.push(`最後のシーンの end(${prevEnd}) が duration(${cfg.duration}) と一致しない`);
  if (errs.length) throw new Error(`設定ファイルの誤り:\n  - ${errs.join('\n  - ')}`);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`${cmd} が失敗しました (exit ${r.status})`);
}

async function openPage(cfg, guides) {
  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files', '--font-render-hinting=none', '--disable-lcd-text'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => pageErrors.push(`読み込み失敗: ${r.url()}`));
  await page.goto(pathToFileURL(join(ROOT, 'template', 'reel.html')).href, { waitUntil: 'load' });
  await page.evaluate(([c, g]) => window.initReel(c, { guides: g }), [cfg, guides]);
  if (pageErrors.length) throw new Error(`テンプレートでエラー:\n  ${pageErrors.join('\n  ')}`);
  // 日本語フォントが実際に読み込まれたか確認（フォールバック描画の事故防止）
  const fontsOk = await page.evaluate(() =>
    ['900 100px "Zen Maru Gothic"', '700 40px "Noto Sans JP"'].every((f) => document.fonts.check(f, 'ブルーベリー説明会')),
  );
  if (!fontsOk) throw new Error('日本語フォントの読み込みに失敗しました（npm install を確認）');
  return { browser, page };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = JSON.parse(readFileSync(args.variant, 'utf8'));
  validateConfig(cfg);
  mkdirSync(args.outDir, { recursive: true });
  const suffix = args.guides ? '_guides' : '';
  const base = join(args.outDir, `${cfg.id}${suffix}`);

  const { browser, page } = await openPage(cfg, args.guides);
  try {
    const problems = await page.evaluate(() => window.checkLayout());
    if (problems.length) throw new Error(`レイアウト検証NG（セーフゾーン/はみ出し）:\n  - ${problems.join('\n  - ')}`);
    console.log('✔ レイアウト検証OK（全シーンの文字がセーフゾーン内）');

    if (args.stills) {
      for (const [i, s] of cfg.scenes.entries()) {
        await page.evaluate((tt) => window.renderAt(tt), s.end - 0.35);
        const p = `${base}_scene${i + 1}-${s.type}.png`;
        await page.screenshot({ path: p, type: 'png' });
        console.log(`✔ ${p}`);
      }
      return;
    }

    // BGM・効果音（シーン構成から自動生成）
    const wav = `${base}.wav`;
    run('python3', ['-I', join(ROOT, 'audio.py'), args.variant, wav]);

    const frames = Math.round(cfg.duration * cfg.fps);
    const mp4 = `${base}.mp4`;
    const ff = spawn('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(cfg.fps), '-c:v', 'png', '-i', '-',
      '-i', wav,
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level:v', '4.1',
      '-pix_fmt', 'yuv420p', '-r', String(cfg.fps), '-g', String(cfg.fps * 2),
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-t', String(cfg.duration),
      '-movflags', '+faststart',
      mp4,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res, rej) => {
      ff.on('error', rej);
      ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg 失敗 (exit ${code})`))));
    });

    const t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      const t = f / cfg.fps;
      await page.evaluate((tt) => window.renderAt(tt), t);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % cfg.fps === 0) process.stdout.write(`\r  レンダリング ${f}/${frames} フレーム`);
    }
    ff.stdin.end();
    await ffDone;
    process.stdout.write(`\r  レンダリング ${frames}/${frames} フレーム（${((Date.now() - t0) / 1000).toFixed(1)}秒）\n`);
    rmSync(wav, { force: true });

    if (!args.guides) {
      // カバー画像（リールのサムネイル用）：フックが出揃った時点
      const cover = `${base}_cover.jpg`;
      await page.evaluate((tt) => window.renderAt(tt), Math.min(cfg.scenes[0].end - 0.35, 2.6));
      await page.screenshot({ path: cover, type: 'jpeg', quality: 92 });
      console.log(`✔ ${cover}`);
    }

    // 書き出し結果の検証
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
      'stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,size,bit_rate',
      '-of', 'json', mp4], { encoding: 'utf8' });
    const info = JSON.parse(probe.stdout);
    const v = info.streams.find((s) => s.width);
    const a = info.streams.find((s) => s.sample_rate);
    const dur = parseFloat(info.format.duration);
    const checks = [
      [v?.codec_name === 'h264', `映像コーデック h264 (${v?.codec_name})`],
      [v?.width === W && v?.height === H, `解像度 ${W}x${H} (${v?.width}x${v?.height})`],
      [v?.pix_fmt === 'yuv420p', `ピクセル形式 yuv420p (${v?.pix_fmt})`],
      [a?.codec_name === 'aac', `音声コーデック aac (${a?.codec_name})`],
      [Math.abs(dur - cfg.duration) < 0.1, `尺 ${cfg.duration}s (${dur.toFixed(2)}s)`],
      [Number(info.format.size) < 4 * 1024 ** 3, 'ファイルサイズ 4GB 未満'],
    ];
    const ng = checks.filter(([ok]) => !ok);
    checks.forEach(([ok, msg]) => console.log(`${ok ? '✔' : '✘'} ${msg}`));
    if (ng.length) throw new Error('書き出し結果が Meta の入稿仕様を満たしていません');
    writeFileSync(`${base}.json`, JSON.stringify({ variant: cfg.id, ...info }, null, 2));
    console.log(`✔ ${mp4}（${(info.format.size / 1024 / 1024).toFixed(1)}MB）`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(`\n✘ ${e.message}`);
  process.exit(1);
});
