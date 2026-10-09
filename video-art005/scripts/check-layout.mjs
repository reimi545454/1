// 安全余白（左右120・上90・下150）、字幕の行数、はみ出し、フォント読み込み、要素どうしの重なりを全シーンで検査する。
import { openPage } from './lib.mjs';
import { SCENES } from '../src/timeline.mjs';

const SAFE = { l: 120, r: 1920 - 120, t: 90, b: 1080 - 150 };
const { page, close } = await openPage();
const problems = [];
const report = [];
try {
  // 各シーンで「全要素が出そろう」フレーム（ズーム最大＝最も外側に出るフレーム）を検査
  const frames = [];
  for (const s of SCENES) {
    if (s.questions) s.questions.forEach((q) => frames.push([s.id, q.from + 12])); // フェードイン完了後
    else if (s.texts) s.texts.forEach((t) => frames.push([s.id, t.from + 12]));
    else frames.push([s.id, s.end - 5]); // 末尾フェードアウト直前（ズーム最大付近）
  }
  for (const [sid, f] of frames) {
    await page.evaluate((x) => window.renderFrame(x), f);
    const rows = await page.evaluate((id) => {
      const root = document.querySelector(`[data-scene="${id}"]`);
      return [...root.querySelectorAll('[data-safe]')]
        .filter((e) => Number(getComputedStyle(e).opacity) > 0.99 && Number(getComputedStyle(e.closest('.scene')).opacity) > 0.99)
        .map((e) => {
          const r = e.getBoundingClientRect();
          const lh = parseFloat(getComputedStyle(e.querySelector('.main') || e).lineHeight);
          const mains = [...e.querySelectorAll('.main')];
          return {
            cls: e.className, text: e.textContent.slice(0, 24),
            l: r.left, r: r.right, t: r.top, b: r.bottom,
            mainLines: mains.length ? Math.max(...mains.map((m) => Math.round(m.getBoundingClientRect().height / lh))) : null,
            overflow: e.scrollWidth > e.clientWidth + 1,
          };
        });
    }, sid);
    if (!rows.length) problems.push(`scene ${sid} frame ${f}: 検査対象の要素が見つからない`);
    rows.forEach((x) => {
      const out = x.l < SAFE.l - 0.5 || x.r > SAFE.r + 0.5 || x.t < SAFE.t - 0.5 || x.b > SAFE.b + 0.5;
      const tag = `scene ${sid} f${f} [${x.cls.trim()}] "${x.text}"`;
      report.push(`${out ? 'NG' : 'ok'} ${tag} x:${x.l.toFixed(0)}-${x.r.toFixed(0)} y:${x.t.toFixed(0)}-${x.b.toFixed(0)}${x.mainLines ? ` lines:${x.mainLines}` : ''}`);
      if (out) problems.push(`${tag}: 安全余白の外 (${x.l.toFixed(0)},${x.t.toFixed(0)})-(${x.r.toFixed(0)},${x.b.toFixed(0)})`);
      if (x.mainLines && x.mainLines > 2) problems.push(`${tag}: 主字幕が${x.mainLines}行`);
      if (x.overflow) problems.push(`${tag}: テキストがはみ出し`);
    });
    // 字幕帯・注釈・番号の重なり
    const boxes = rows.filter((x) => /band|pill|num/.test(x.cls));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) problems.push(`scene ${sid} f${f}: "${a.text}" と "${b.text}" が重なっている`);
    }
  }
} finally {
  await close();
}
console.log(report.join('\n'));
if (problems.length) {
  console.error('\n問題あり:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('\nレイアウト検査: 問題なし');
