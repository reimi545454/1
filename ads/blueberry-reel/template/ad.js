/*
 * 既存広告（青空＋濃緑の帯見出し＋赤の強調＋特典帯＋オレンジCTA）のトーンに合わせた静止画テンプレート。
 * 「農園／農業／ブルーベリー」は使用禁止語のため、文言はすべて構成JSON側で管理し、
 * 書き出し時に禁止語を検出したらエラーで止める。
 */
(() => {
  'use strict';
  const L = window.ReelLib;
  const { el, markup, escapeHtml } = L;
  const FORMATS = {
    story:  { W: 1080, H: 1920, top: 285, bottom: 1920 - 672, side: 64, minScale: 0.8, maxUp: 1.3 },
    feed:   { W: 1080, H: 1350, top: 60,  bottom: 1350 - 150, side: 60, minScale: 0.8, maxUp: 1.15 },
    square: { W: 1080, H: 1080, top: 50,  bottom: 1080 - 120, side: 60, minScale: 0.7, maxUp: 1.0 },
  };
  const BANNED = ['農園', '農業', 'ブルーベリー'];
  const BONUS = { medal: '10月\n限定', head: 'Zoom個別説明で[特典プレゼント]', gift: 'お米 または BISSスキンケア', sub: 'お好きな特典を一つお選びいただけます。' };

  const ICONS = {
    home: '<path d="M8 21 L24 8 L40 21 V38 H29 V27 H19 V38 H8z" fill="#fff"/>',
    sprout: '<path d="M24 40 V22" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M24 25 C14 25 9 19 8 10 C18 10 24 16 24 25z" fill="#fff"/><path d="M24 21 C32 21 38 16 40 8 C31 8 24 13 24 21z" fill="#fff"/>',
    people: '<circle cx="24" cy="15" r="6" fill="#fff"/><circle cx="12" cy="20" r="5" fill="#fff"/><circle cx="36" cy="20" r="5" fill="#fff"/><path d="M13 40 C13 30 18 25 24 25 C30 25 35 30 35 40z" fill="#fff"/><path d="M3 38 C3 31 6 27 11 27 C9 30 8 34 8 38z M45 38 C45 31 42 27 37 27 C39 30 40 34 40 38z" fill="#fff"/>',
  };
  const T = (tag, cls, parent, html) => { const e = el(tag, cls, parent); e.innerHTML = html; e.dataset.text = '1'; return e; };

  function build(p, c, f) {
    if (c.band) T('div', 'band', p, escapeHtml(c.band));
    if (c.chips) {
      const row = el('div', 'chips', p);
      c.chips.forEach((t, i) => {
        const chip = el('div', 'chip', row);
        chip.innerHTML = `<span class="ci ${i === 1 ? 'g' : ''}"><svg width="44" height="44" viewBox="0 0 48 48">${ICONS[['home', 'sprout', 'people'][i]]}</svg></span>`;
        T('span', '', chip, escapeHtml(t));
      });
    }
    if (c.stats) {
      const row = el('div', 'stats', p);
      c.stats.forEach((s) => {
        const t = el('div', 'stile', row);
        T('div', 'lb', t, escapeHtml(s.label));
        T('div', 'v', t, `${escapeHtml(s.value)}<span>${escapeHtml(s.unit)}</span>`);
      });
    }
    if (c.big) {
      const b = el('div', `big glow ${c.bigSize || ''}`, p);
      c.big.forEach((l) => { const ln = el('span', 'ln', b); ln.innerHTML = markup(l).replace(/class="hl"/g, 'class="red"'); ln.dataset.text = '1'; });
    }
    if (c.gifts) {
      const row = el('div', 'gifts', p);
      const mk = (id, label) => { const g = el('div', 'gcard', row); g.innerHTML = `<svg width="170" height="187" viewBox="0 0 200 220"><use href="#${id}"/></svg>`; T('div', 'glabel', g, label); };
      const gl = Array.isArray(c.gifts) ? c.gifts : ['お米', 'BISSスキンケア'];
      mk('gift-rice', gl[0]); T('div', 'gor', row, 'or'); mk('gift-skincare', gl[1]);
    }
    if (c.sub) T('div', `sub ${c.subDark ? 'dark' : ''}`, p, markup(c.sub));
    if (c.bonus) {
      const b = L.buildBonus(p, BONUS, 0.95);
      b.querySelectorAll('.head,.gift,.sub,.medal').forEach((n) => (n.dataset.text = '1'));
    }
    if (c.noCta) return;
    const btn = el('div', 'cta-btn', p);
    btn.dataset.text = 'box';
    btn.innerHTML = `<span>${escapeHtml(c.cta || 'Zoom個別説明を予約する')}</span><span class="arrow"><svg width="26" height="26" viewBox="0 0 10 10"><path d="M3 1 L7 5 L3 9" stroke="#b34a05" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    if (c.foot) T('div', 'foot', p, markup(c.foot));
  }

  // 自然サイズで測り、利用可能な高さに収まる（上限まで拡大する）zoom を反復して決める
  function fitContent(content, F, avail, fit) {
    content.style.zoom = '1';
    content.style.width = '1080px';
    fit();
    let scale = Math.min(F.maxUp, avail / content.getBoundingClientRect().height);
    let h = 0;
    for (let i = 0; i < 8; i++) {
      content.style.zoom = String(scale);
      content.style.width = `${1080 / scale}px`;
      fit();
      h = content.getBoundingClientRect().height;
      if (h <= avail + 0.5) break;
      scale *= (avail / h) * 0.995;
    }
    return { scale, h };
  }
  window.AdKit = { build, layout, FORMATS, T };

  // 見出しの文字幅調整・拡大縮小・縦位置合わせをまとめて行う（静止画・動画シーンで共用）
  function layout(content, F, anchor) {
    // 1行固定の見出しは、文字幅が収まるまでフォントを縮める（セーフゾーン内に収めるため）
    const maxW = 1080 - 2 * (F.side + 14);
    // 特典帯は中身が帯の幅に収まるまで文字を縮める
    const fitBonus = () => content.querySelectorAll('.bonus').forEach((b) => {
      for (let k = 0; k < 30 && b.scrollWidth > b.clientWidth + 1; k++) {
        b.querySelectorAll('.head, .gift, .sub').forEach((n) => { n.style.fontSize = `${parseFloat(getComputedStyle(n).fontSize) - 1}px`; });
      }
    });
    // ボタンは「文字＋矢印」が枠に余白付きで収まるまで文字を縮める
    const fitCta = () => content.querySelectorAll('.cta-btn').forEach((b) => {
      const label = b.firstElementChild;
      for (let k = 0; k < 40; k++) {
        const used = [...b.children].reduce((a, c) => a + c.getBoundingClientRect().width, 0) + 24 * (b.children.length - 1);
        if (used <= b.getBoundingClientRect().width - 90) break;
        label.style.fontSize = `${parseFloat(getComputedStyle(label).fontSize) - 1}px`;
      }
    });
    const fit = () => { fitBonus(); fitCta(); content.querySelectorAll('.band, .big .ln, .chips').forEach((n) => {
      if (n.classList.contains('chips')) {
        // チップ行は中身の幅（余白を除く）で判定し、収まらなければ行ごと縮める
        const inner = [...n.children].reduce((a, c) => a + c.getBoundingClientRect().width, 0) + (n.children.length - 1) * 22 * (n.getBoundingClientRect().width / n.offsetWidth || 1);
        if (inner > maxW) n.style.zoom = String((parseFloat(n.style.zoom) || 1) * (maxW / inner) * 0.99);
        return;
      }
      let fs = parseFloat(getComputedStyle(n).fontSize);
      const w = () => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().width; };
      while (w() > maxW && fs > 30) { fs -= 2; n.style.fontSize = `${fs}px`; }
    }); };
    const avail = F.bottom - F.top - 8;
    const { scale, h } = fitContent(content, F, avail, fit);
    // 全幅の帯の文字がセーフゾーン上端より上に出ないよう、文字の外接矩形で位置を補正（zoom下の top は拡縮されるため scale で割る）
    content.style.top = `${(F.top + (anchor === 'top' ? 20 : Math.max(0, (avail - h) / 2))) / scale}px`;
    const first = content.querySelector('[data-text]');
    const rr = document.createRange(); rr.selectNodeContents(first);
    const over = F.top - rr.getBoundingClientRect().top;
    if (over > 0) content.style.top = `${parseFloat(content.style.top) + over / scale}px`;
    return { scale };
  }

  let ctx = null;
  window.initAd = async (cfg, format, opts = {}) => {
    const F = FORMATS[format];
    if (!F) throw new Error(`未知のフォーマット: ${format}`);
    const all = JSON.stringify(cfg);
    const hit = BANNED.filter((w) => all.includes(w));
    if (hit.length) throw new Error(`使用禁止語を含んでいます: ${hit.join('、')}`);
    document.documentElement.style.cssText = document.body.style.cssText = `width:${F.W}px;height:${F.H}px`;
    const stage = document.getElementById('stage');
    stage.style.width = `${F.W}px`; stage.style.height = `${F.H}px`;
    document.getElementById('sky').style.height = `${F.H - 200}px`;
    document.getElementById('forest').style.height = `${format === 'story' ? 420 : 300}px`;
    L.injectDefs();
    const content = document.getElementById('content');
    build(content, cfg, format);
    if (opts.guides && format === 'story') {
      const g = document.getElementById('guides');
      g.className = 'layer on';
      g.innerHTML = '<div class="g" style="top:0;height:269px"></div><div class="g" style="bottom:0;height:672px"></div>';
    }
    await L.loadFonts(document.body.innerText);
    await Promise.all(['900 60px "Noto Serif JP"', '900 60px "Noto Sans JP"'].map((s) => document.fonts.load(s, document.body.innerText)));
    await document.fonts.ready;
    const { scale } = layout(content, F);
    ctx = { F, scale };
    return { scale };
  };
  window.checkAd = () => {
    const { F, scale } = ctx;
    const problems = [];
    if (scale < F.minScale) problems.push(`縮小率 ${scale.toFixed(2)}（下限 ${F.minScale}）: コピーを短くしてください`);
    problems.push(...L.checkTextIn(document.getElementById('content'), { top: F.top, bottom: F.bottom, left: F.side, right: F.W - F.side }, '静止画'));
    return problems;
  };
})();
