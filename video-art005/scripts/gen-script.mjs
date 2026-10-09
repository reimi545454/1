// src/timeline.mjs から script.txt（秒数・表示字幕・任意ナレーション）を生成する。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { SCENES, FPS, TOTAL_FRAMES } from '../src/timeline.mjs';

const t = (f) => (f / FPS).toFixed(1).replace(/\.0$/, '');
const L = [];
L.push('ART-005 Claude Frontier Academy X用動画 台本', `尺: ${TOTAL_FRAMES / FPS}秒 / ${FPS}fps / ${TOTAL_FRAMES}フレーム / 1920x1080`, '標準版はナレーション・BGMなし（字幕と図の動きのみ）。ナレーションは音声を付ける別版用の任意台本。', '', '※ このファイルは scripts/gen-script.mjs が src/timeline.mjs から生成します。字幕の修正は timeline.mjs で行い、`npm run script` で再生成してください。', '');
for (const s of SCENES) {
  L.push(`■ Scene ${s.id}｜${t(s.start)}〜${t(s.end + 1)}秒（フレーム ${s.start}〜${s.end}）`);
  if (s.questions) s.questions.forEach((q) => L.push(`  字幕 ${t(q.from)}〜${t(q.to + 1)}秒: ${q.text}`));
  if (s.texts) s.texts.forEach((x) => L.push(`  字幕 ${t(x.from)}〜${t(x.to + 1)}秒: ${x.lines.join(' / ')}`));
  if (s.title) L.push(`  見出し: ${s.title}`);
  if (s.main) L.push(`  主字幕: ${s.main.join(' / ')}`);
  if (s.sub) L.push(`  補助字幕: ${s.sub}`);
  (s.notes || []).forEach((n) => L.push(`  注釈 ${t(n.at)}秒〜: ${n.text}`));
  (s.numbers || []).forEach((n) => L.push(`  番号 ${t(n.at)}秒〜: ${n.n}`));
  L.push(`  任意ナレーション: ${s.narration}`, '');
}
L.push('注意: 実践手順は記事独自の提案で、Frontier Academyの公式カリキュラムの再現ではありません。COACH AIはFrontier Academyと提携・認定関係にはありません。');
fs.writeFileSync(path.join(ROOT, 'script.txt'), L.join('\n') + '\n');
console.log('wrote script.txt');
