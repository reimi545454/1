// フレーム番号だけから画面を決める（乱数・実時間は使わない）。
import { SCENES, ASSETS, RAMP, FADE, TOTAL_FRAMES, allText } from './timeline.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
const fadeIn = (f, at, len = FADE) => clamp((f - at) / len, 0, 1);

const stage = document.getElementById('stage');
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = (src, cls) => {
  const i = new Image();
  i.src = src;
  i.className = cls || '';
  i.decoding = 'sync';
  return i;
};
const mainHtml = (lines) =>
  lines
    .map((l) => `<span class="line">${esc(l).replace(/→/g, '<span class="arrow">→</span>')}</span>`)
    .join('');

const refs = {}; // scene.id -> 更新用の参照
const els = {}; // scene.id -> .scene

function mkScene(s) {
  const root = el('div', 'scene');
  root.dataset.scene = s.id;
  els[s.id] = root;
  stage.appendChild(root);
  return root;
}

function buildImageScene(s, src) {
  const root = mkScene(s);
  const layer = el('div', 'layer');
  layer.appendChild(img(src, 'full'));
  root.appendChild(layer);
  const r = { layer, notes: [], nums: [], bands: [] };
  (s.notes || []).forEach((n) => {
    const p = el('div', 'pill' + (n.strong ? ' strong' : ''), esc(n.text));
    p.style.left = n.x + 'px';
    p.style.top = n.y + 'px';
    p.dataset.safe = '1';
    layer.appendChild(p);
    r.notes.push({ el: p, at: n.at });
  });
  (s.numbers || []).forEach((n) => {
    const p = el('div', 'num', String(n.n));
    p.style.left = n.x + 'px';
    p.style.top = n.y + 'px';
    p.dataset.safe = '1';
    layer.appendChild(p);
    r.nums.push({ el: p, at: n.at });
  });
  refs[s.id] = r;
  return { root, r };
}

// 文言を差し替える帯（シーン2・7）：帯は出したまま、中の文字だけ切り替える
function addSwapBand(root, groups) {
  const b = el('div', 'band swap', groups.map((g) => `<div class="main">${mainHtml(g)}</div>`).join(''));
  b.dataset.safe = '1';
  root.appendChild(b);
  return { band: b, texts: [...b.querySelectorAll('.main')] };
}

function addBand(root, r, s, cls, mainLines, sub) {
  const b = el('div', 'band ' + (cls || ''), `<div class="main">${mainHtml(mainLines)}</div>` + (sub ? `<div class="sub">${esc(sub)}</div>` : ''));
  b.dataset.safe = '1';
  root.appendChild(b);
  return b;
}

// --- シーン構築 ---
{
  const s = SCENES[0];
  const { root, r } = buildImageScene(s, ASSETS.roles);
  r.bands.push({ el: addBand(root, r, s, '', s.main), from: 0 });
}
{
  const s = SCENES[1];
  const { root, r } = buildImageScene(s, ASSETS.testing);
  const sw = addSwapBand(root, s.questions.map((q) => [q.text]));
  r.swap = { ...sw, wins: s.questions.map((q) => ({ from: q.from - s.start, to: q.to - s.start })) };
}
{
  const s = SCENES[2];
  const root = mkScene(s);
  root.appendChild(el('div', 'plain-bg'));
  const title = el('div', 's3-title', esc(s.title));
  const sub = el('div', 's3-sub', esc(s.sub));
  const box = el('div', 's3-img');
  box.appendChild(img(ASSETS.roles));
  [title, sub, box].forEach((e) => { e.dataset.safe = '1'; root.appendChild(e); });
  refs[s.id] = { title, sub, box };
}
{
  const s = SCENES[3];
  const { root, r } = buildImageScene(s, ASSETS.roles);
  r.bands.push({ el: addBand(root, r, s, '', s.main, s.sub), from: 0 });
}
{
  const s = SCENES[4];
  const { root, r } = buildImageScene(s, ASSETS.testing);
  r.bands.push({ el: addBand(root, r, s, '', s.main, s.sub), from: 0 });
}
{
  const s = SCENES[5];
  const { root, r } = buildImageScene(s, ASSETS.practice);
  r.bands.push({ el: addBand(root, r, s, '', s.main, s.sub), from: 0 });
}
{
  const s = SCENES[6];
  const root = mkScene(s);
  root.appendChild(el('div', 'plain-bg'));
  const box = el('div', 's7-banner');
  box.appendChild(img(ASSETS.banner));
  box.dataset.safe = '1';
  root.appendChild(box);
  const r = { box, bands: [] };
  const sw = addSwapBand(root, s.texts.map((t) => t.lines));
  r.swap = { ...sw, wins: s.texts.map((t) => ({ from: t.from - s.start, to: t.to - s.start })) };
  refs[s.id] = r;
}

function sceneOpacity(i, frame) {
  const s = SCENES[i];
  const next = SCENES[i + 1];
  if (frame < s.start) return 0;
  if (frame > s.end) return next && frame < next.start + RAMP ? 1 : 0; // 次シーンの立ち上がり中だけ下に残す
  return i === 0 ? 1 : clamp((frame - s.start) / RAMP, 0, 1);
}

// 帯は最初の文言と同時にフェードイン。文言は「直前の文言が4フレームで消える → 次が5フレームで現れる」で切り替える。
function swapText(sw, f, dur, op) {
  sw.band.style.opacity = op(fadeIn(f, sw.wins[0].from));
  sw.texts.forEach((t, i) => {
    const w = sw.wins[i];
    const last = i === sw.wins.length - 1;
    let o = fadeIn(f, w.from, last || i === 0 ? FADE : 5);
    if (!last) o *= 1 - clamp((f - (w.to - 3)) / 4, 0, 1);
    t.style.opacity = String(o);
  });
}

function renderFrame(frame) {
  SCENES.forEach((s, i) => {
    const root = els[s.id];
    const o = sceneOpacity(i, frame);
    root.style.opacity = String(o);
    root.style.visibility = o > 0 ? 'visible' : 'hidden';
    if (o === 0) return;
    const dur = s.end - s.start + 1;
    const f = clamp(frame - s.start, 0, dur - 1);
    const t = f / (dur - 1);
    const r = refs[s.id];
    // 文字類は各シーン末尾の5フレームで先に消し、クロスフェード中に前後の文字が重ならないようにする（最終シーンは残す）
    const out = s.id === 7 ? 1 : clamp((s.end + 1 - frame) / 5, 0, 1);
    const op = (v) => String(v * out);

    if (s.id === 3) {
      r.title.style.opacity = op(fadeIn(f, 6));
      r.sub.style.opacity = op(fadeIn(f, 18));
      r.box.style.opacity = String(fadeIn(f, 12));
      r.box.style.transform = `scale(${(0.985 + 0.015 * ease(t)).toFixed(5)})`;
      return;
    }
    if (s.id === 7) {
      // 最初の3秒だけ緩やかに寄り、最後の3秒は静止
      r.box.style.transform = `scale(${(1 + 0.01 * ease(f / 90)).toFixed(5)})`;
      swapText(r.swap, f, dur, op);
      return;
    }

    // 画像シーン：緩やかなズーム 1.00 → 1.025
    r.layer.style.transform = `scale(${(1 + 0.025 * ease(t)).toFixed(5)})`;
    if (r.swap) swapText(r.swap, f, dur, op);
    r.bands.forEach((b) => {
      b.el.style.opacity = op(fadeIn(f, b.from));
    });
    r.notes.forEach((n) => (n.el.style.opacity = op(fadeIn(frame, n.at))));
    r.nums.forEach((n) => {
      const a = fadeIn(frame, n.at);
      n.el.style.opacity = op(a);
      n.el.style.transform = `translate(-50%, -50%) scale(${(0.92 + 0.08 * ease(a)).toFixed(4)})`;
    });
  });
}

async function init() {
  await Promise.all([...document.images].map((i) => i.decode()));
  const text = allText();
  await Promise.all([
    document.fonts.load('700 56px "Noto Sans JP"', text),
    document.fonts.load('500 38px "Noto Sans JP"', text),
  ]);
  await document.fonts.ready;
  window.__fontsOk = document.fonts.check('700 56px "Noto Sans JP"', text) && document.fonts.check('500 38px "Noto Sans JP"', text);
  window.renderFrame = renderFrame;
  window.TOTAL_FRAMES = TOTAL_FRAMES;
  window.ready = true;
}
init();
