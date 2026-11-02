// セリフ定義と口パク(かなの母音から開口量を決定)
export const LINES = [
  { t0: 4.6, t1: 7.1, text: 'おはよう！今日もいい天気！', kana: 'おはよう！ きょうも いいてんき！' },
  { t0: 8.4, t1: 12.0, text: 'サト丸で出発だ！いっぱい魚を釣るぞー！', kana: 'さとまるで しゅっぱつだ！ いっぱい さかなを つるぞー！' },
  { t0: 20.9, t1: 25.0, text: 'よーし！みんな、海に出たよ！今日はどんな魚に会えるかな？', kana: 'よーし！ みんな うみに でたよ！ きょうは どんな さかなに あえるかな？' },
];
const ROWS = { a: 'あかがさざただなはばぱまやらわゃぁ', i: 'いきぎしじちぢにひびぴみり', u: 'うくぐすずつづぬふぶぷむゆるゅぅ', e: 'えけげせぜてでねへべぺめれ', o: 'おこごそぞとどのほぼぽもよろをょぉ' };
const VOW = {}; for (const [v, s] of Object.entries(ROWS)) for (const c of s) VOW[c] = v;
const SHAPE = { a: [0.95, 1.0], i: [0.32, 1.25], u: [0.38, 0.6], e: [0.6, 1.05], o: [0.72, 0.72], n: [0.03, 0.9], p: [0.0, 1.0] };

function parse(kana) {
  const m = [];
  for (const ch of kana) {
    if (ch === 'ゃ' || ch === 'ゅ' || ch === 'ょ') { if (m.length) m[m.length - 1].v = VOW[ch]; continue; }
    if (ch === 'ー') { m.push({ v: m.length ? m[m.length - 1].v : 'a', w: 1.2 }); continue; }
    if (ch === 'ん' || ch === 'っ') { m.push({ v: 'n', w: 0.8 }); continue; }
    if (VOW[ch]) { m.push({ v: VOW[ch], w: 1 }); continue; }
    m.push({ v: 'p', w: 0.7 }); // 句読点・空白
  }
  return m;
}
LINES.forEach((l) => { l.m = parse(l.kana); l.total = l.m.reduce((a, b) => a + b.w, 0); });

export function mouthAt(t) {
  for (const l of LINES) {
    if (t < l.t0 || t > l.t1) continue;
    let u = ((t - l.t0) / (l.t1 - l.t0)) * l.total, acc = 0;
    for (const mo of l.m) {
      if (u < acc + mo.w) {
        const f = (u - acc) / mo.w, [o, w] = SHAPE[mo.v], env = mo.v === 'p' || mo.v === 'n' ? 1 : 0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, f * 1.05));
        return { open: o * env, wide: w, talking: true };
      }
      acc += mo.w;
    }
  }
  return { open: 0, wide: 1, talking: false };
}
export function lineAt(t) { return LINES.find((l) => t >= l.t0 - 0.15 && t <= l.t1 + 0.6) || null; }
