// 書き出した MP4 を ffprobe / ffmpeg で検査し、render-report.txt を書く。基準を外れたら終了コード1。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const OUT = path.join(ROOT, 'output');
const mp4 = path.join(OUT, 'ART-005_Claude_Frontier_Academy_X_1920x1080_40s.mp4');
const sh = (c, a) => execFileSync(c, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const probe = JSON.parse(sh('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', mp4]));
const v = probe.streams.find((s) => s.codec_type === 'video');
const hasAudio = probe.streams.some((s) => s.codec_type === 'audio');
const size = fs.statSync(mp4).size;
const dur = Number(probe.format.duration);
const kbps = (size * 8) / dur / 1e6;
// faststart: moov が mdat より前にあること
const head = fs.readFileSync(mp4).subarray(0, 65536);
const moov = head.indexOf('moov');
const mdat = head.indexOf('mdat');
const fast = moov > 0 && (mdat < 0 || moov < mdat);

const checks = [
  ['コンテナ MP4', probe.format.format_name.includes('mp4')],
  ['コーデック H.264', v.codec_name === 'h264'],
  ['ピクセル形式 yuv420p', v.pix_fmt === 'yuv420p'],
  ['解像度 1920x1080', v.width === 1920 && v.height === 1080],
  ['fps 30', v.r_frame_rate === '30/1'],
  ['フレーム数 1200', Number(v.nb_read_frames) === 1200],
  ['尺 40.0秒（±0.05）', Math.abs(dur - 40) < 0.05],
  ['平均ビットレート 6〜8Mbps', kbps >= 6 && kbps <= 8.2],
  ['容量 50MB以下', size <= 50 * 1024 * 1024],
  ['faststart（moovが先頭側）', fast],
  ['音声トラックなし（標準版）', !hasAudio],
];
const rpt = [
  'ART-005 render-report',
  `output/${path.basename(mp4)}`,
  `thumbnail: output/ART-005_Claude_Frontier_Academy_X_thumbnail.png`,
  `previews: output/preview_01.png, output/preview_04.png, output/preview_07.png`,
  '',
  `幅x高さ: ${v.width}x${v.height}`,
  `尺: ${dur.toFixed(3)} 秒`,
  `fps: ${v.r_frame_rate}`,
  `フレーム数: ${v.nb_read_frames}`,
  `コーデック: ${v.codec_name} (${v.profile}) / ${v.pix_fmt}`,
  `色空間: ${v.color_space || '-'} / ${v.color_range || '-'}`,
  `平均ビットレート: ${kbps.toFixed(2)} Mbps`,
  `容量: ${(size / 1024 / 1024).toFixed(2)} MB`,
  '',
  '自動検査:',
  ...checks.map(([n, ok]) => `  [${ok ? 'OK' : 'NG'}] ${n}`),
];
fs.writeFileSync(path.join(ROOT, 'render-report.txt'), rpt.join('\n') + '\n');
console.log(rpt.join('\n'));
if (checks.some(([, ok]) => !ok)) process.exit(1);
