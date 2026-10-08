/*
 * 動画・静止画テンプレート共通ライブラリ
 * （数学/DOMユーティリティ、SVGイラスト定義、背景の丘・ベリー、特典リボン、レイアウト検証）
 */
(() => {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const L = (window.ReelLib = {});

  // ---------- 数学 ----------
  L.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  L.lerp = (a, b, p) => a + (b - a) * p;
  L.prog = (t, start, dur) => L.clamp((t - start) / dur);
  L.ease = {
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outBack: (p) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
  };
  // 決定論的な疑似乱数（インデックスから値を引く）
  L.rand = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  L.mixHex = (a, b, p) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(L.lerp((pa >> s) & 255, (pb >> s) & 255, p));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };
  // scale(0) は一部環境で描画が乱れるため下限を設ける
  L.sc = (v) => Math.max(v, 0.0001).toFixed(4);

  // ---------- DOM ----------
  L.el = (tag, cls, parent, style) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
  };
  L.svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  L.escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // [[強調]] → 蛍光マーカー、{{強調}} → 赤文字、\n → 改行
  L.markup = (s) =>
    L.escapeHtml(s || '')
      .replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>')
      .replace(/\{\{(.+?)\}\}/g, '<span style="color:var(--red)">$1</span>')
      .replace(/\n/g, '<br>');
  L.svgIcon = (id, size) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><use href="#${L.escapeHtml(id)}"/></svg>`;
  L.assetUrl = (name) => `../assets/${encodeURIComponent(name)}`;

  // ---------- SVG イラスト定義 ----------
  const DEFS = `
  <defs>
    <radialGradient id="berryGrad" cx="38%" cy="34%" r="70%">
      <stop offset="0%" stop-color="#8fa1e6"/><stop offset="45%" stop-color="#4b5cb0"/><stop offset="100%" stop-color="#232a66"/>
    </radialGradient>
    <radialGradient id="bloom" cx="35%" cy="30%" r="40%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bottleGrad" x1="0" x2="1">
      <stop offset="0%" stop-color="#e9eef3"/><stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#d5dde6"/>
    </linearGradient>
    <symbol id="berry" viewBox="-50 -50 100 100">
      <circle r="46" fill="url(#berryGrad)"/><circle r="46" fill="url(#bloom)"/>
      <path d="M0,-44 l5,-9 l3,10 l9,-3 l-5,9 l-12,1 l-12,-1 l-5,-9 l9,3 l3,-10z" fill="#1c2152"/>
      <circle cy="-41" r="5" fill="#141842"/>
    </symbol>
    <symbol id="leaf" viewBox="-50 -50 100 100">
      <path d="M-44,10 C-30,-36 26,-44 46,-30 C34,10 -8,36 -44,10z" fill="#5a9a45"/>
      <path d="M-44,10 C-14,-6 18,-22 46,-30" stroke="#3a7330" stroke-width="4" fill="none"/>
    </symbol>
    <symbol id="ic-sprout" viewBox="0 0 100 100">
      <path d="M50 88 V48" stroke="#2f6327" stroke-width="8" stroke-linecap="round"/>
      <path d="M50 54 C30 54 18 40 16 22 C36 22 50 34 50 54z" fill="#5a9a45"/>
      <path d="M50 46 C66 46 80 34 84 16 C64 16 50 28 50 46z" fill="#4c8a3a"/>
      <path d="M22 90 H78" stroke="#a48a62" stroke-width="8" stroke-linecap="round"/>
    </symbol>
    <symbol id="ic-people" viewBox="0 0 100 100">
      <circle cx="34" cy="34" r="13" fill="#3b4a9c"/><circle cx="68" cy="34" r="13" fill="#4c8a3a"/>
      <path d="M12 82 C12 62 22 54 34 54 C46 54 56 62 56 82z" fill="#3b4a9c"/>
      <path d="M46 82 C46 62 56 54 68 54 C80 54 90 62 90 82z" fill="#4c8a3a"/>
    </symbol>
    <symbol id="ic-land" viewBox="0 0 100 100">
      <path d="M6 74 C26 56 46 60 60 68 C72 74 84 70 94 62 V90 H6z" fill="#5a9a45"/>
      <circle cx="30" cy="58" r="9" fill="#3b4a9c"/><circle cx="44" cy="62" r="7" fill="#4b5cb0"/>
      <circle cx="70" cy="22" r="12" fill="#f2b84b"/>
    </symbol>
    <symbol id="ic-truck" viewBox="0 0 100 100">
      <rect x="6" y="30" width="54" height="38" rx="6" fill="#3b4a9c"/>
      <path d="M60 42 H80 L94 56 V68 H60z" fill="#4c8a3a"/>
      <circle cx="26" cy="72" r="10" fill="#1d2a24"/><circle cx="76" cy="72" r="10" fill="#1d2a24"/>
      <circle cx="26" cy="72" r="4" fill="#fff"/><circle cx="76" cy="72" r="4" fill="#fff"/>
    </symbol>
    <symbol id="ic-elder" viewBox="0 0 100 100">
      <circle cx="50" cy="28" r="15" fill="#4c8a3a"/>
      <path d="M22 88 C22 62 34 50 50 50 C66 50 78 62 78 88z" fill="#4c8a3a"/>
      <path d="M30 22 C34 6 66 6 70 22 C60 16 40 16 30 22z" fill="#f2b84b"/>
      <path d="M18 24 H82" stroke="#f2b84b" stroke-width="5" stroke-linecap="round"/>
    </symbol>
    <symbol id="ic-handshake" viewBox="0 0 100 100">
      <path d="M8 46 L28 30 L48 40 L60 32 L92 46 L72 70 L50 78 L28 70z" fill="#3b4a9c"/>
      <path d="M36 52 L50 64 M44 46 L58 58 M52 42 L66 54" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    </symbol>
    <symbol id="ic-award" viewBox="0 0 100 100">
      <path d="M34 58 L24 92 L40 84 L48 96 L54 62z" fill="#e2312b"/>
      <path d="M66 58 L76 92 L60 84 L52 96 L46 62z" fill="#c4241f"/>
      <circle cx="50" cy="38" r="30" fill="#f2b84b"/><circle cx="50" cy="38" r="21" fill="#ffd97a"/>
      <path d="M50 24 l4.5 9 l10 1.5 l-7.2 7 l1.7 10 l-9 -4.7 l-9 4.7 l1.7 -10 l-7.2 -7 l10 -1.5z" fill="#c98a1c"/>
    </symbol>
    <symbol id="hand" viewBox="0 0 100 120">
      <path d="M38 8 c7 0 12 5 12 12 v34 l4 -1 c6 -1 10 2 11 6 l2 1 c6 -1 10 2 11 6 l2 1 c6 -1 11 3 11 9 v20 c0 18 -12 30 -30 30 h-6 c-12 0 -20 -6 -27 -16 l-18 -26 c-4 -6 -2 -12 3 -14 c4 -2 9 -1 12 3 l9 11 v-62 c0 -7 5 -12 12 -12z"
            fill="#fff" stroke="#1d2a24" stroke-width="5" stroke-linejoin="round"/>
    </symbol>
    <!-- 特典：お米（米袋） -->
    <symbol id="gift-rice" viewBox="0 0 200 220">
      <path d="M40 40 C40 24 160 24 160 40 L172 196 C172 210 28 210 28 196z" fill="#f4efe2" stroke="#c9b893" stroke-width="5"/>
      <path d="M52 30 C70 14 130 14 148 30 L140 44 C120 36 80 36 60 44z" fill="#e2312b"/>
      <rect x="62" y="80" width="76" height="92" rx="10" fill="#fff" stroke="#e2312b" stroke-width="5"/>
      <text x="100" y="142" text-anchor="middle" font-size="54" font-weight="900" fill="#e2312b" font-family="Noto Sans JP">米</text>
      <g fill="#c9a24a"><ellipse cx="44" cy="186" rx="5" ry="9" transform="rotate(-30 44 186)"/><ellipse cx="160" cy="184" rx="5" ry="9" transform="rotate(30 160 184)"/></g>
    </symbol>
    <!-- 特典：スキンケア（ボトル2本） -->
    <symbol id="gift-skincare" viewBox="0 0 200 220">
      <rect x="34" y="62" width="62" height="146" rx="16" fill="url(#bottleGrad)" stroke="#c3ccd6" stroke-width="4"/>
      <rect x="50" y="30" width="30" height="36" rx="6" fill="#cfd8e2"/>
      <rect x="56" y="12" width="18" height="22" rx="4" fill="#b8c3cf"/>
      <rect x="108" y="88" width="62" height="120" rx="16" fill="url(#bottleGrad)" stroke="#c3ccd6" stroke-width="4"/>
      <rect x="120" y="62" width="38" height="30" rx="8" fill="#cfd8e2"/>
      <text x="65" y="148" text-anchor="middle" font-size="17" font-weight="700" fill="#8a96a3" font-family="Noto Sans JP" letter-spacing="2">BISS</text>
      <text x="139" y="160" text-anchor="middle" font-size="17" font-weight="700" fill="#8a96a3" font-family="Noto Sans JP" letter-spacing="2">BISS</text>
    </symbol>
  </defs>`;
  L.injectDefs = () => {
    const holder = document.createElement('div');
    holder.innerHTML = `<svg xmlns="${SVGNS}" width="0" height="0" style="position:absolute">${DEFS}</svg>`;
    document.body.prepend(holder.firstChild);
  };

  // ---------- 背景：浮遊するベリー ----------
  L.buildParticles = (svgRoot, W, H, n = 16) => {
    const ps = [];
    for (let i = 0; i < n; i++) {
      const size = 26 + L.rand(i) * 46;
      const g = L.svgEl('g', { opacity: (0.10 + L.rand(i + 50) * 0.12).toFixed(3) }, svgRoot);
      L.svgEl('use', { href: '#berry', x: -size / 2, y: -size / 2, width: size, height: size }, g);
      ps.push({ g, x: L.rand(i + 7) * W, y: L.rand(i + 13) * H, sp: 10 + L.rand(i + 21) * 22, ph: L.rand(i + 33) * Math.PI * 2 });
    }
    return (t) =>
      ps.forEach((p) => {
        const span = H * 0.85;
        const y = ((p.y - t * p.sp) % span + span) % span + H * 0.06;
        const x = p.x + Math.sin(t * 0.7 + p.ph) * 18;
        p.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(Math.sin(t + p.ph) * 12).toFixed(1)})`);
      });
  };

  // ---------- 背景：丘とブルーベリーの株 ----------
  const HILL_GREEN = ['#a9cf7f', '#7fb35a', '#5a9a45'];
  const HILL_SOIL = ['#cdb894', '#b49c74', '#9b815b'];
  // top: 丘の稜線の基準 y（キャンバス下端からの高さはこの値で決まる）
  L.buildHills = (svgRoot, W, H, top) => {
    const y = (v) => top + v; // 稜線オフセット
    const paths = [
      `M0 ${y(70)} C220 ${y(0)} 420 ${y(30)} 600 ${y(60)} C780 ${y(90)} 940 ${y(20)} ${W} ${y(0)} V${H} H0z`,
      `M0 ${y(190)} C180 ${y(140)} 360 ${y(160)} 560 ${y(200)} C760 ${y(240)} 900 ${y(170)} ${W} ${y(150)} V${H} H0z`,
      `M0 ${y(320)} C240 ${y(270)} 460 ${y(290)} 660 ${y(330)} C840 ${y(365)} 960 ${y(320)} ${W} ${y(300)} V${H} H0z`,
    ];
    const layers = paths.map((d, i) => L.svgEl('path', { d, fill: HILL_GREEN[i] }, svgRoot));
    const spots = [
      [90, 185], [250, 160], [420, 175], [610, 210], [800, 200], [980, 160],
      [160, 312], [370, 300], [560, 328], [760, 345], [940, 312],
    ];
    const bushes = spots.map(([x, yy], i) => {
      const g = L.svgEl('g', {}, svgRoot);
      const s = 1 + L.rand(i + 90) * 0.35;
      L.svgEl('ellipse', { cx: 0, cy: 6, rx: 70 * s, ry: 18 * s, fill: 'rgba(30,60,20,0.18)' }, g);
      L.svgEl('circle', { cx: -34 * s, cy: -24 * s, r: 40 * s, fill: '#3f7d31' }, g);
      L.svgEl('circle', { cx: 30 * s, cy: -28 * s, r: 44 * s, fill: '#4c8a3a' }, g);
      L.svgEl('circle', { cx: 0, cy: -56 * s, r: 44 * s, fill: '#5a9a45' }, g);
      for (let k = 0; k < 6; k++) {
        const bx = (L.rand(i * 10 + k) - 0.5) * 90 * s;
        const by = -20 * s - L.rand(i * 10 + k + 5) * 60 * s;
        const r = (9 + L.rand(i * 10 + k + 3) * 5) * s;
        L.svgEl('use', { href: '#berry', x: bx - r, y: by - r, width: r * 2, height: r * 2 }, g);
      }
      return { g, x: x * (W / 1080), y: top + yy, d: L.rand(i + 140) * 0.5 };
    });
    // soil: 0=緑の農園, 1=耕作放棄地 / growT: 株の成長タイムライン / shrink: 縮小率
    return (soil = 0, growT = 9, shrink = 0) => {
      layers.forEach((p, i) => p.setAttribute('fill', L.mixHex(HILL_GREEN[i], HILL_SOIL[i], soil)));
      bushes.forEach((b) => {
        const p = L.ease.outBack(L.clamp((growT - b.d) / 0.55)) * (1 - shrink);
        b.g.setAttribute('transform', `translate(${b.x},${b.y}) scale(${L.sc(p)})`);
      });
    };
  };

  // ---------- 特典リボン ----------
  // bonus: { medal: "10月\n限定", head: "説明会参加で[特典プレゼント]", gift: "お米 または BISSスキンケア", sub: "..." }
  L.buildBonus = (parent, bonus, scale = 1) => {
    const b = L.el('div', 'bonus', parent);
    const medal = L.el('div', 'medal', b, { width: `${150 * scale}px`, fontSize: `${40 * scale}px`, padding: `0 ${8 * scale}px` });
    medal.innerHTML = L.escapeHtml(bonus.medal || '').replace(/\n/g, '<br>');
    const body = L.el('div', 'body', b);
    const head = L.el('div', 'head', body, { fontSize: `${44 * scale}px`, padding: `${12 * scale}px ${26 * scale}px` });
    head.innerHTML = L.escapeHtml(bonus.head || '').replace(/\[(.+?)\]/g, '<em>$1</em>');
    const gift = L.el('div', 'gift', body, { fontSize: `${46 * scale}px`, padding: `${12 * scale}px ${26 * scale}px 0` });
    gift.textContent = bonus.gift || '';
    if (bonus.sub) {
      const sub = L.el('div', 'sub', body, { fontSize: `${24 * scale}px`, padding: `${4 * scale}px ${26 * scale}px ${14 * scale}px` });
      sub.textContent = bonus.sub;
    }
    return b;
  };

  // ---------- レイアウト検証 ----------
  // 文字そのものの外接矩形（ブロック要素の余白ではなく実際の文字範囲）
  const textRect = (n) => {
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    return r.width && r.height ? r : n.getBoundingClientRect();
  };
  const visible = (n) => {
    for (let e = n; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
    }
    return true;
  };
  /**
   * root 内の文字要素がセーフ領域 safe={top,bottom,left,right} 内にあるか、
   * また white-space:nowrap の要素が親からはみ出していないかを調べる。
   */
  L.checkTextIn = (root, safe, label) => {
    const problems = [];
    root.querySelectorAll('[data-text]').forEach((n) => {
      if (!n.textContent.trim() || !visible(n)) return;
      const r = n.dataset.text === 'box' ? n.getBoundingClientRect() : textRect(n);
      const name = `${label} 「${n.textContent.trim().replace(/\s+/g, ' ').slice(0, 18)}」`;
      if (r.top < safe.top - 0.5) problems.push(`${name}: 上端 ${r.top.toFixed(0)}px が上部の禁止領域(${safe.top}px)に侵入`);
      if (r.bottom > safe.bottom + 0.5) problems.push(`${name}: 下端 ${r.bottom.toFixed(0)}px が下部の禁止領域(${safe.bottom}px〜)に侵入`);
      if (r.left < safe.left - 0.5 || r.right > safe.right + 0.5)
        problems.push(`${name}: 横 ${r.left.toFixed(0)}〜${r.right.toFixed(0)}px が左右余白(${safe.left}/${safe.right}px)に侵入`);
      if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow !== 'visible')
        problems.push(`${name}: 文字が枠からはみ出しています`);
      const maxLines = Number(n.dataset.lines || 0);
      if (maxLines) {
        const lh = parseFloat(getComputedStyle(n).lineHeight) || parseFloat(getComputedStyle(n).fontSize) * 1.3;
        const lines = Math.round(textRect(n).height / lh);
        if (lines > maxLines) problems.push(`${name}: ${maxLines}行の想定が${lines}行に折り返しています`);
      }
    });
    return problems;
  };

  L.loadFonts = (text) =>
    Promise.all([
      document.fonts.load('900 100px "Zen Maru Gothic"', text),
      document.fonts.load('700 100px "Zen Maru Gothic"', text),
      document.fonts.load('900 40px "Noto Sans JP"', text),
      document.fonts.load('700 40px "Noto Sans JP"', text),
      document.fonts.load('500 40px "Noto Sans JP"', text),
    ]).then(() => document.fonts.ready);

  // 画像の読み込み完了を待つ（背景画像も含む）
  L.loadImages = (urls) =>
    Promise.all(
      [...new Set(urls)].map(
        (u) =>
          new Promise((res, rej) => {
            const im = new Image();
            im.onload = () => res();
            im.onerror = () => rej(new Error(`画像を読み込めません: ${u}`));
            im.src = u;
          }),
      ),
    );
})();
