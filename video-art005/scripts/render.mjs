// 使い方:
//   npm run preview                         … サムネイルとプレビュー静止画のみ出力（動画は作らない）
//   npm run render                          … 全1200フレームを描画して MP4 を書き出す
//   node scripts/render.mjs --frames 0,60,300 --out .work/frames   … 任意フレームを確認用に出力
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, openPage, shot } from './lib.mjs';
import { FPS, TOTAL_FRAMES, PREVIEWS } from '../src/timeline.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const OUT = path.join(ROOT, 'output');
const MP4 = path.join(OUT, 'ART-005_Claude_Frontier_Academy_X_1920x1080_40s.mp4');
fs.mkdirSync(OUT, { recursive: true });

const { page, close } = await openPage();
try {
  if (val('--frames')) {
    const dir = path.resolve(val('--out') || path.join(ROOT, '.work/frames'));
    fs.mkdirSync(dir, { recursive: true });
    for (const f of val('--frames').split(',').map(Number)) {
      fs.writeFileSync(path.join(dir, `f${String(f).padStart(4, '0')}.png`), await shot(page, f));
    }
    console.log('frames ->', dir);
  } else if (flag('--preview')) {
    for (const [name, f] of Object.entries(PREVIEWS)) {
      fs.writeFileSync(path.join(OUT, name), await shot(page, f));
      console.log('wrote', name, '(frame', f + ')');
    }
  } else {
    const tmp = MP4 + '.part.mp4';
    const ff = spawn('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'warning',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level:v', '4.1',
      '-b:v', '7M', '-maxrate', '8M', '-bufsize', '14M', '-g', '60', '-bf', '2',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-r', String(FPS), '-an', '-movflags', '+faststart', tmp,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => {
      ff.on('error', rej);
      ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
    });
    ff.stdin.on('error', () => {});
    for (let f = 0; f < TOTAL_FRAMES; f++) {
      const png = await shot(page, f);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 100 === 0) console.log(`frame ${f}/${TOTAL_FRAMES}`);
    }
    ff.stdin.end();
    await done;
    fs.renameSync(tmp, MP4);
    console.log('wrote', MP4);
  }
} finally {
  await close();
}
