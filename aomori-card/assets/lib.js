/*
 * あおもりカードメーカー: 画面に依存しない純粋ロジック
 * ブラウザ(window.AomoriLib)と Node(テスト)の両方で読み込める。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AomoriLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ランク定義 ---------- */
  // weight は排出率(%)。合計が 100 でなくても比率で扱う。
  const RANKS = [
    { id: 'N', name: 'ノーマル', weight: 40, stars: 1, foil: 0,
      accent: '#ffffff', colors: { light: '#a3b5c6', base: '#7589a1', dark: '#4b5f76' } },
    { id: 'R', name: 'レア', weight: 30, stars: 2, foil: 0,
      accent: '#ffe45c', colors: { light: '#3fcdb3', base: '#14a38c', dark: '#0a6a5d' } },
    { id: 'SR', name: 'スーパーレア', weight: 18, stars: 3, foil: 0.22,
      accent: '#ffe45c', colors: { light: '#ff6f83', base: '#e23b53', dark: '#9f2037' } },
    { id: 'UR', name: 'ウルトラレア', weight: 9, stars: 4, foil: 0.3,
      accent: '#fffbe6', colors: { light: '#ffd466', base: '#f0a21a', dark: '#a86500' } },
    { id: 'SP', name: 'スペシャル', weight: 3, stars: 5, foil: 0.4,
      accent: '#ffd814', colors: { light: '#4aa8ff', base: '#1e88e5', dark: '#0b5fb0' } },
  ];

  // 生成前プレビュー用(ランクは伏せる)
  const MYSTERY_RANK = {
    id: '?', name: 'ひみつ', weight: 0, stars: 0, foil: 0,
    accent: '#ffd814', colors: { light: '#4aa8ff', base: '#1e88e5', dark: '#0b5fb0' },
  };

  /** 重み付き抽選。rand は [0,1) を返す関数(テストで差し替え可能)。 */
  function pickRank(rand, ranks) {
    const list = ranks || RANKS;
    const total = list.reduce((s, r) => s + r.weight, 0);
    let t = Math.min(Math.max(rand(), 0), 0.9999999999) * total;
    for (const r of list) {
      if (t < r.weight) return r;
      t -= r.weight;
    }
    return list[list.length - 1];
  }

  /** 配列から1つランダムに選ぶ(空なら空文字)。 */
  function pickFrom(rand, list) {
    if (!list || !list.length) return '';
    return list[Math.min(list.length - 1, Math.floor(Math.max(rand(), 0) * list.length))];
  }

  /* ---------- 名前(かな → ローマ字) ---------- */
  const BASE = {
    あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
    か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
    さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
    た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
    な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
    は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
    ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
    や: 'ya', ゆ: 'yu', よ: 'yo',
    ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
    わ: 'wa', を: 'o', ん: 'n',
    が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
    ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
    だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
    ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
    ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
    ゔ: 'vu', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
  };
  const SMALL_Y = { ゃ: 'a', ゅ: 'u', ょ: 'o' };

  function isKana(ch) {
    const c = ch.codePointAt(0);
    return (c >= 0x3041 && c <= 0x3096) || (c >= 0x30a1 && c <= 0x30fa) || c === 0x30fc;
  }

  /** ひらがな/カタカナ → ローマ字(パスポート式: 長音は省略、ん は常に n)。 */
  function kanaToRomaji(str) {
    const chars = Array.from(str).map(function (ch) {
      const c = ch.codePointAt(0);
      return c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
    });
    let out = '';
    let geminate = false;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === 'ー') continue;
      if (ch === 'っ') { geminate = true; continue; }
      let syl = BASE[ch];
      if (!syl) continue;
      const next = chars[i + 1];
      if (next && SMALL_Y[next] && syl.length >= 2 && syl.endsWith('i')) {
        const v = SMALL_Y[next];
        const stem = syl.slice(0, -1);
        if (syl === 'ji') syl = 'j' + v;
        else if (stem === 'sh' || stem === 'ch') syl = stem + v;
        else syl = stem + 'y' + v;
        i++;
      }
      if (geminate) {
        if (/^[^aiueon]/.test(syl)) syl = (syl.startsWith('ch') ? 't' : syl[0]) + syl;
        geminate = false;
      }
      out += syl;
    }
    return out.replace(/ou/g, 'o').replace(/oo/g, 'o').replace(/uu/g, 'u');
  }

  /**
   * 入力名 → カードに載せる文字列。
   * かな→ローマ字、英字は大文字化。漢字などは invalid=true(自動変換できないため)。
   */
  function toRomajiName(input) {
    const s = String(input == null ? '' : input).normalize('NFKC');
    let out = '';
    let kana = '';
    let invalid = false;
    const flush = function () {
      if (kana) { out += kanaToRomaji(kana); kana = ''; }
    };
    for (const ch of s) {
      if (isKana(ch)) { kana += ch; continue; }
      flush();
      if (/[A-Za-z'.\-]/.test(ch)) out += ch;
      else if (/\s/.test(ch)) out += ' ';
      else invalid = true;
    }
    flush();
    return { text: out.toUpperCase().replace(/\s+/g, ' ').trim(), invalid: invalid };
  }

  /* ---------- 写真の配置計算 ---------- */
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  /**
   * 画像を枠(aw×ah)いっぱいに敷く(cover)ときの描画矩形。
   * zoom は 1 以上、(ox, oy) は中央からのずらし量(枠座標)。はみ出しは自動で補正する。
   */
  function coverRect(iw, ih, aw, ah, zoom, ox, oy) {
    const z = clamp(zoom || 1, 1, 6);
    const s = Math.max(aw / iw, ah / ih) * z;
    const w = iw * s;
    const h = ih * s;
    const mx = Math.max(0, (w - aw) / 2);
    const my = Math.max(0, (h - ah) / 2);
    const cx = clamp(ox || 0, -mx, mx);
    const cy = clamp(oy || 0, -my, my);
    return { x: (aw - w) / 2 + cx, y: (ah - h) / 2 + cy, w: w, h: h, ox: cx, oy: cy, zoom: z };
  }

  /** 映像(vw×vh)から指定の縦横比(w/h)で中央を切り出す矩形。 */
  function centerCrop(vw, vh, ratio) {
    if (vw / vh > ratio) {
      const sw = vh * ratio;
      return { sx: (vw - sw) / 2, sy: 0, sw: sw, sh: vh };
    }
    const sh = vw / ratio;
    return { sx: 0, sy: (vh - sh) / 2, sw: vw, sh: sh };
  }

  /** 長辺が max を超えないように縮小したサイズ(拡大はしない)。 */
  function fitWithin(w, h, max) {
    const k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  /* ---------- マスコットの出し分け(画面に依存しない判断だけ) ---------- */
  /**
   * 「いま出してよいか」を決める。
   *   - once: その場面は1回の利用につき1回まで
   *   - always: 間隔制限を受けない(結果発表など、毎回出す場面)
   *   - それ以外は、前回の登場から cooldownMs が経つまで出さない
   */
  function createBuddyGate(options) {
    const cooldownMs = options && options.cooldownMs != null ? options.cooldownMs : 8000;
    const seen = {};
    let last = -Infinity;
    return {
      allow: function (scene, meta, now) {
        const m = meta || {};
        if (m.once && seen[scene]) return false;
        if (!m.always && now - last < cooldownMs) return false;
        return true;
      },
      commit: function (scene, now) { seen[scene] = true; last = now; },
    };
  }

  /** セリフを選ぶ。候補が無ければ ''(=吹き出しなし)。{region} を市町村名に置き換える。 */
  function pickLine(rand, lines, vars) {
    const raw = pickFrom(rand, lines);
    if (!raw) return '';
    const v = vars || {};
    return String(raw).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : ''; });
  }

  /** 吹き出しを出しておく時間(ms)。文字が多いほど少し長く。 */
  function bubbleHoldMs(text) {
    const n = Array.from(text || '').length;
    if (!n) return 1600;
    return Math.min(4200, Math.max(2400, 1800 + n * 120));
  }

  return {
    RANKS: RANKS, MYSTERY_RANK: MYSTERY_RANK, pickRank: pickRank, pickFrom: pickFrom, createBuddyGate: createBuddyGate, pickLine: pickLine, bubbleHoldMs: bubbleHoldMs,
    kanaToRomaji: kanaToRomaji, toRomajiName: toRomajiName,
    coverRect: coverRect, centerCrop: centerCrop, fitWithin: fitWithin,
  };
});
