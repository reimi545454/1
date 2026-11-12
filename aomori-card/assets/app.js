/* あおもりカードメーカー: 画面制御とカード描画 (設定は assets/config.js) */
(function () {
  'use strict';

  const L = window.AomoriLib;
  const CFG = window.AomoriConfig;
  const $ = function (id) { return document.getElementById(id); };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ================================================================
   * 定数
   * ================================================================ */
  const W = CFG.card.width;
  const H = CFG.card.height;
  const PREVIEW_SCALE = 0.7;
  // 保存画像の大きさ: フレームPNGがあればその大きさ(650x1075 = 300dpiで縦名刺 55x91mm)。なければ設定の幅から
  function exportFor(frameImg) {
    const w = frameImg && frameImg.naturalWidth ? frameImg.naturalWidth : (CFG.card.exportWidth || L.CARD_BASE_PX.w);
    const h = frameImg && frameImg.naturalHeight ? frameImg.naturalHeight : L.exportSize(w).h;
    return { w: w, h: h };
  }
  const MAX_SOURCE_SIDE = 2800;
  const MAX_FILE_BYTES = 30 * 1024 * 1024;
  const ZOOM_MAX = 4;

  const FF_NAME = '"' + CFG.fonts.name.family + '", "Helvetica Neue", Arial, sans-serif';
  const FF_JP = '"' + CFG.fonts.jp.family + '", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';
  const FF_HEAVY = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';

  const GEO = window.AomoriGeo; // 青森県の輪郭(assets/geo.js)

  /* ================================================================
   * 状態
   * ================================================================ */
  const state = {
    frameId: CFG.defaultFrame,
    frame: CFG.frames[CFG.defaultFrame],
    region: null, // null = 青森県(全体)。{ ja, en, type }
    source: null, // HTMLCanvasElement (取り込み済みの写真)
    view: { zoom: 1, ox: 0, oy: 0 },
    busy: false,
    adobeReady: false, // Adobe Fonts(Apotek)が使えるか
    resultUrl: null,
    resultBlob: null,
    lastFocus: null,
  };
  let PHOTO = state.frame.photo; // フレーム切替で差し替わる

  /* ================================================================
   * フォント・フレームPNGの読み込み
   * ================================================================ */
  let fontsReady = Promise.resolve();
  function loadFonts() {
    if (!window.FontFace) return Promise.resolve();
    const jobs = ['name', 'jp'].map(function (k) {
      const f = CFG.fonts[k];
      const face = new FontFace(f.family, 'url(' + f.url + ')', { weight: f.weight, style: f.style });
      return face.load().then(function (loaded) { document.fonts.add(loaded); }).catch(function () { /* 代替書体で継続 */ });
    });
    jobs.push(loadAdobeFonts());
    return Promise.all(jobs);
  }

  /** Adobe Fonts(Typekit)を読み込む。失敗・時間切れ・無効のときは state.adobeReady=false のまま(同梱書体で描く) */
  function loadAdobeFonts() {
    const a = CFG.adobeFonts;
    if (!a || !a.enabled || !window.FontFace || !document.fonts) return Promise.resolve();
    return new Promise(function (resolve) {
      let done = false;
      const finish = function () { if (!done) { done = true; resolve(); } };
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = a.css;
      link.onload = function () {
        const want = [a.weight + ' 64px "' + a.family + '"', 'italic ' + a.weight + ' 64px "' + a.family + '"'];
        Promise.all(want.map(function (f) { return document.fonts.load(f, 'AOMORI SP'); }))
          .then(function (res) {
            state.adobeReady = res.every(function (faces) { return faces.length > 0 && faces.every(function (x) { return x.status === 'loaded'; }); });
            finish();
          })
          .catch(finish);
      };
      link.onerror = finish;
      setTimeout(finish, a.timeoutMs || 4000);
      document.head.appendChild(link);
    });
  }

  const frameImages = new Map();
  /** ランクに対応するフレームPNG。未指定・読込失敗なら null(=仮フレームで描く) */
  function loadFrameImage(rankId) {
    const key = rankId === '?' ? 'PREVIEW' : rankId;
    const url = state.frame.png && state.frame.png[key];
    if (!url) return Promise.resolve(null);
    if (!frameImages.has(url)) {
      frameImages.set(url, new Promise(function (resolve) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = url;
      }));
    }
    return frameImages.get(url);
  }

  /* ================================================================
   * 描画ヘルパー
   * ================================================================ */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function starPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.48;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function line(ctx, x1, y1, x2, y2, w, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  /** 幅 targetW ぴったりに横方向へ伸縮して描く(見出し用) */
  function fitText(ctx, text, x, y, targetW, stroke) {
    const m = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(targetW / m, 1);
    if (stroke) ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** 金色の名前文字。字間つき、長すぎる場合は横に縮める */
  function goldName(ctx, text, spec, size, spacing) {
    ctx.save();
    ctx.font = state.adobeReady
      ? 'italic ' + CFG.adobeFonts.weight + ' ' + size + 'px "' + CFG.adobeFonts.family + '", ' + FF_NAME
      : 'italic ' + (state.frame.name.weight || 600) + ' ' + size + 'px ' + FF_NAME;
    ctx.textBaseline = 'alphabetic';
    const chars = Array.from(text);
    const widths = chars.map(function (c) { return ctx.measureText(c).width; });
    const total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * Math.max(0, chars.length - 1);
    const k = total > spec.maxW ? spec.maxW / total : 1;
    ctx.translate(spec.x, spec.y);
    ctx.scale(k, 1);
    const g = ctx.createLinearGradient(0, -size * 0.72, 0, 0);
    // 金属らしい金: ハイライト → 明るい金 → 濃い金 → 反射光 の縦グラデーション
    g.addColorStop(0, '#fffbe3');
    g.addColorStop(0.2, '#ffe36b');
    g.addColorStop(0.48, '#f6b800');
    g.addColorStop(0.62, '#b87800');
    g.addColorStop(0.8, '#ffd23f');
    g.addColorStop(1, '#fff1a8');
    // 金色の文字に、黒のシャドウ(右下にずらした濃い影 + 細い黒の縁)
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.035);
    ctx.strokeStyle = '#000';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = size * 0.05;
    ctx.shadowOffsetX = size * 0.045;
    ctx.shadowOffsetY = size * 0.055;
    let cx = 0;
    chars.forEach(function (c, i) {
      ctx.strokeText(c, cx, 0);
      cx += widths[i] + spacing;
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    cx = 0;
    ctx.fillStyle = g;
    chars.forEach(function (c, i) {
      ctx.fillText(c, cx, 0);
      cx += widths[i] + spacing;
    });
    ctx.restore();
  }

  function drawNames(ctx, names, alpha) {
    const spec = state.frame.name;
    // Adobe Fonts(極細のApotek)が使えるときは、専用の大きさと字間
    const ad = state.adobeReady && spec.adobe;
    const size = ad ? spec.adobe.size : spec.size;
    const spacing = ad ? spec.adobe.spacing : spec.spacing;
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    const first = names.first;
    const last = names.last;
    if (first && last) {
      goldName(ctx, first, spec.first, size, spacing);
      goldName(ctx, last, spec.last, size, spacing);
    } else if (first || last) {
      goldName(ctx, first || last, spec.single, size, spacing);
    }
    ctx.restore();
  }

  /** 縦書きコメント(1文字ずつ縦に並べる) */
  function drawSlogan(ctx, text) {
    const s = state.frame.slogan;
    if (!s.drawn || !text) return;
    const chars = Array.from(text);
    const step = Math.min(s.maxSize, s.height / chars.length);
    ctx.save();
    ctx.fillStyle = s.color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = step * 0.14;
    ctx.strokeStyle = s.halo || 'transparent';
    ctx.font = '500 ' + Math.round(step * 0.9) + 'px ' + FF_JP;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chars.forEach(function (ch, i) {
      if (ch === '　' || ch === ' ') return;
      const cy = s.top + step * (i + 0.5);
      const halo = !!s.halo;
      if (/[、。，．]/.test(ch)) {
        // 縦書きでは句読点はマスの右上に寄る
        if (halo) ctx.strokeText(ch, s.x + step * 0.5, cy - step * 0.5);
        ctx.fillText(ch, s.x + step * 0.5, cy - step * 0.5);
      } else if (ch === 'ー' || ch === '～' || ch === '〜') {
        ctx.save();
        ctx.translate(s.x, cy);
        ctx.rotate(Math.PI / 2);
        if (halo) ctx.strokeText(ch, 0, 0);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      } else {
        if (halo) ctx.strokeText(ch, s.x, cy);
        ctx.fillText(ch, s.x, cy);
      }
    });
    ctx.restore();
  }

  /** 青森県の輪郭パス。(ox,oy)=左上、s=拡大率 */
  function aomoriPath(ctx, ox, oy, s) {
    ctx.beginPath();
    GEO.rings.forEach(function (p) {
      ctx.moveTo(ox + p[0][0] * s, oy + p[0][1] * s);
      for (let i = 1; i < p.length; i++) ctx.lineTo(ox + p[i][0] * s, oy + p[i][1] * s);
      ctx.closePath();
    });
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawPlaceholder(ctx) {
    const g = ctx.createLinearGradient(0, PHOTO.y, 0, PHOTO.y + PHOTO.h);
    g.addColorStop(0, '#eaf5ff');
    g.addColorStop(1, '#cfe6fb');
    ctx.fillStyle = g;
    ctx.fillRect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
    const cx = PHOTO.x + PHOTO.w / 2;
    // 写真が入るまでの仮表示: 大きな「？」
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 ' + Math.round(PHOTO.h * 0.46) + 'px ' + FF_HEAVY;
    ctx.lineJoin = 'round';
    ctx.lineWidth = PHOTO.h * 0.03;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#5b9fd8';
    ctx.strokeText('?', cx, PHOTO.y + PHOTO.h * 0.36);
    ctx.fillText('?', cx, PHOTO.y + PHOTO.h * 0.36);
    ctx.restore();
    const ty = PHOTO.y + PHOTO.h * 0.7;
    ctx.fillStyle = '#1e5f9f';
    ctx.textAlign = 'center';
    ctx.font = '700 58px ' + FF_JP;
    ctx.fillText('ここに写真が入るよ', cx, ty);
    ctx.font = '700 40px ' + FF_JP;
    ctx.fillStyle = '#4a82b8';
    ctx.fillText('タップして写真をえらぶ', cx, ty + 76);
    ctx.textAlign = 'left';
  }

  function drawFoil(ctx, rank, seed) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 44);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, W, H);
    ['#ff6b6b', '#ffd93d', '#6bff95', '#4dd2ff', '#b36bff', '#ff6bd6', '#ff6b6b'].forEach(function (c, i, a) {
      g.addColorStop(i / (a.length - 1), c);
    });
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = rank.foil;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const rnd = mulberry32(seed);
    const n = rank.id === 'SP' ? 26 : rank.id === 'UR' ? 18 : 10;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const x = 40 + rnd() * (W - 80);
      const y = 40 + rnd() * (H - 80);
      const r = 8 + rnd() * 17;
      ctx.globalAlpha = 0.5 + rnd() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    }
    ctx.restore();
  }

  // 漁師カード風は全ランク共通の水色(ランクは文字・星・ホイルで表す)
  const FISHER_PAL = { light: '#5dbcf4', base: '#2b92e0', dark: '#125fae' };
  function colorsFor(rank) { return state.frame.style === 'fisher' ? FISHER_PAL : rank.colors; }
  function accentFor(rank) { return state.frame.style === 'fisher' ? '#ffd814' : rank.accent; }

  function drawStars(ctx, rank, x0, cy, gap, r) {
    const c = colorsFor(rank);
    for (let i = 0; i < 5; i++) {
      starPath(ctx, x0 + i * gap, cy, r);
      ctx.lineWidth = 3; ctx.lineJoin = 'round';
      if (i < rank.stars) {
        ctx.fillStyle = '#ffd814'; ctx.strokeStyle = c.dark;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.strokeStyle = 'rgba(255,255,255,.6)';
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawRankLabel(ctx, rank) {
    ctx.font = state.adobeReady
      ? CFG.adobeFonts.weight + ' 176px "' + CFG.adobeFonts.family + '", ' + FF_HEAVY
      : '900 150px ' + FF_HEAVY;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = colorsFor(rank).dark;
    ctx.fillStyle = accentFor(rank);
    fitText(ctx, rank.id, 50, 164, Math.min(ctx.measureText(rank.id).width, 270), true);
  }

  function drawWave(ctx, x1, x2, y, amp, len, w, color) {
    ctx.beginPath();
    for (let x = x1; x <= x2; x += 6) {
      const yy = y + Math.sin(((x - x1) / len) * Math.PI * 2) * amp;
      if (x === x1) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function fillPhotoWindow(ctx, o) {
    const fr = state.frame;
    ctx.save();
    polyPath(ctx, fr.photo.polygon);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.clip();
    if (o.source) {
      const r = L.coverRect(o.source.width, o.source.height, PHOTO.w, PHOTO.h, o.view.zoom, o.view.ox, o.view.oy);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(o.source, PHOTO.x + r.x, PHOTO.y + r.y, r.w, r.h);
    } else {
      drawPlaceholder(ctx);
    }
    ctx.restore();
  }

  function frameBase(ctx, rank) {
    const c = colorsFor(rank);
    roundRect(ctx, 0, 0, W, H, 44);
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c.light); bg.addColorStop(0.5, c.base); bg.addColorStop(1, c.dark);
    ctx.fillStyle = bg;
    ctx.fillRect(12, 12, W - 24, H - 24);
  }

  /** PNGが無いランク用の仮フレーム(photo / slogan の窓位置は設定と共通) */
  function drawFallbackFrame(ctx, o) {
    const fr = state.frame;
    ctx.save();
    frameBase(ctx, o.rank);
    if (fr.style === 'fisher') drawFisherFrame(ctx, o);
    else drawStripFrame(ctx, o);
    ctx.restore();
  }

  /** 漁師カード風: 写真いっぱい + 波の飾り + 下に星の帯 + 名前の後ろに暗い影 */
  function drawFisherFrame(ctx, o) {
    const rank = o.rank;
    fillPhotoWindow(ctx, o);
    // 名前を読みやすくする左下の暗い影(名前があるときだけ)
    if (o.names.first || o.names.last) {
    ctx.save();
    polyPath(ctx, state.frame.photo.polygon);
    ctx.clip();
    ctx.translate(160, PHOTO.y + PHOTO.h);
    ctx.scale(1.6, 1);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 480);
    sh.addColorStop(0, 'rgba(0,0,0,.78)');
    sh.addColorStop(0.55, 'rgba(0,0,0,.4)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-400, -520, 1400, 560);
    ctx.restore();
    }
    // 上部の波飾り
    drawWave(ctx, 380, 1076, 92, 7, 70, 5, 'rgba(255,255,255,.92)');
    drawWave(ctx, 380, 1076, 106, 7, 70, 3, 'rgba(190,235,255,.8)');
    drawRankLabel(ctx, rank);
    drawStars(ctx, rank, 612, 60, 100, 34);
    // 下部の帯: 波 + 星
    drawWave(ctx, 24, 1076, 1722, 6, 80, 4, 'rgba(255,255,255,.9)');
    drawStars(ctx, rank, 64, 1762, 88, 29);
  }

  /** ローカルプレナー風: 右に白い縦帯 + 見出し */
  function drawStripFrame(ctx, o) {
    const fr = state.frame;
    const rank = o.rank;
    polyPath(ctx, fr.photo.polygon);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillRect(958, 112, 118, 1230);
    fillPhotoWindow(ctx, o);

    line(ctx, 356, 106, 600, 18, 9, '#fff');
    line(ctx, 376, 106, 1076, 106, 5, '#fff');
    line(ctx, 430, 92, 590, 32, 3, 'rgba(255,255,255,.7)');
    line(ctx, 24, 1536, 730, 1536, 4, '#fff');
    line(ctx, 24, 1650, 770, 1650, 4, '#fff');
    line(ctx, 470, 1726, 620, 1652, 6, '#fff');

    drawRankLabel(ctx, rank);
    ctx.font = 'italic 900 104px ' + FF_HEAVY;
    ctx.fillStyle = '#fff';
    fitText(ctx, fr.headline, 48, 1622, 690, false);
    drawStars(ctx, rank, 640, 62, 92, 34);
    drawStars(ctx, rank, 76, 1742, 84, 34);
  }

  /** バッジの2行テキスト(地域を選んでいればその市町村) */
  function badgeLines() {
    const r = state.region;
    return r ? [r.en, r.type] : state.frame.badge;
  }

  /** 仮フレームの右下バッジ(名前より前面) */
  function drawFallbackBadge(ctx, o, contentOnly) {
    const c = colorsFor(o.rank);
    const fisher = state.frame.style === 'fisher';
    const bp = state.frame.badgePos;
    const k = bp.r / 166;
    const bx = bp.x, by = bp.y;
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 44);
    ctx.clip();
    if (!contentOnly) {
    if (fisher) {
      // 金と水色のリング(光彩つき)
      ctx.shadowColor = 'rgba(255,230,140,.85)';
      ctx.shadowBlur = 26;
    }
    ctx.beginPath(); ctx.arc(bx, by, bp.r, 0, Math.PI * 2);
    if (fisher) {
      const ring = ctx.createLinearGradient(bx - bp.r, by - bp.r, bx + bp.r, by + bp.r);
      ring.addColorStop(0, '#bff0ff'); ring.addColorStop(0.5, '#ffe58a'); ring.addColorStop(1, '#7fd0ff');
      ctx.fillStyle = ring;
    } else {
      ctx.fillStyle = c.dark;
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.arc(bx, by, bp.r - 5 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    const rg = ctx.createRadialGradient(bx - 30 * k, by - 40 * k, 10, bx, by, bp.r - 11 * k);
    rg.addColorStop(0, c.light); rg.addColorStop(1, c.base);
    ctx.beginPath(); ctx.arc(bx, by, bp.r - 11 * k, 0, Math.PI * 2);
    ctx.fillStyle = rg; ctx.fill();
    }
    // 地図(中央やや上)と、選んだ市町村の位置を示す丸印
    const ms = bp.r * 1.18 / GEO.width;
    const mx = bx - (GEO.width * ms) / 2;
    const my = by - bp.r * 0.86;
    aomoriPath(ctx, mx, my, ms);
    ctx.fillStyle = '#fff';
    ctx.fill();
    if (state.region && state.region.x != null) {
      const dx = mx + state.region.x * ms;
      const dy = my + state.region.y * ms;
      ctx.beginPath(); ctx.arc(dx, dy, 15 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(dx, dy, 10 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7a00'; ctx.fill();
    }
    const [l1, l2] = badgeLines();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'italic 600 ' + Math.round(40 * k) + 'px ' + FF_NAME;
    const maxW = bp.r * 1.5;
    const w1 = ctx.measureText(l1).width;
    ctx.save();
    ctx.translate(bx, by + 102 * k);
    ctx.scale(Math.min(1, maxW / w1), 1);
    ctx.fillText(l1, 0, 0);
    ctx.restore();
    ctx.font = 'italic 500 ' + Math.round(32 * k) + 'px ' + FF_NAME;
    ctx.fillText(l2, bx, by + 142 * k);
    ctx.restore();
  }

  /**
   * カード全体を描画する。
   * o: { rank, source, view, names:{first,last}, slogan, seed, frameImg }
   * frameImg があればフレームPNGを使用(写真→PNG→文字の順)、無ければ仮フレーム。
   */
  function drawCard(ctx, o, scale) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (o.frameImg) {
      ctx.save();
      roundRect(ctx, 0, 0, W, H, 44);
      ctx.clip();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      if (o.source) {
        const r = L.coverRect(o.source.width, o.source.height, PHOTO.w, PHOTO.h, o.view.zoom, o.view.ox, o.view.oy);
        ctx.save();
        ctx.beginPath();
        ctx.rect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
        ctx.clip();
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(o.source, PHOTO.x + r.x, PHOTO.y + r.y, r.w, r.h);
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(PHOTO.x, PHOTO.y, PHOTO.w, PHOTO.h);
        ctx.clip();
        drawPlaceholder(ctx);
        ctx.restore();
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(o.frameImg, 0, 0, W, H);
      ctx.restore();
    } else {
      drawFallbackFrame(ctx, o);
    }

    drawSlogan(ctx, o.slogan);
    drawNames(ctx, o.names, o.nameAlpha);
    // フレームPNGがある場合は、バッジの円(リング・背景)はPNG側に任せ、中身(地図・丸印・市町村名)だけ描く
    if (state.frame.badgeDraw !== false) drawFallbackBadge(ctx, o, !!o.frameImg);
    if (CFG.foilEffect && state.frame.foil !== false && o.rank.foil > 0) drawFoil(ctx, o.rank, o.seed || 1);
    ctx.restore();
  }

  /* ================================================================
   * UI ヘルパー
   * ================================================================ */
  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function setModal(open, el, focusEl) {
    const app = $('app');
    if (open) {
      state.lastFocus = document.activeElement;
      el.hidden = false;
      app.inert = true;
      document.body.classList.add('locked');
      if (focusEl) focusEl.focus();
    } else {
      el.hidden = true;
      if (document.querySelectorAll('.overlay:not([hidden])').length === 0) {
        app.inert = false;
        document.body.classList.remove('locked');
        if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
        scheduleAssist();
      }
    }
  }

  function secureRandom() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }

  /* ================================================================
   * プレビュー描画
   * ================================================================ */
  const preview = $('preview');
  const pctx = preview.getContext('2d');
  preview.width = Math.round(W * PREVIEW_SCALE);
  preview.height = Math.round(H * PREVIEW_SCALE);
  let rafId = 0;
  let previewFrameImg = null;

  function cardOptions(rank, seed, slogan, frameImg) {
    return {
      rank: rank, source: state.source, view: state.view,
      names: currentNames(), slogan: slogan, seed: seed, frameImg: frameImg,
    };
  }

  function renderPreview() {
    rafId = 0;
    const opts = cardOptions(L.MYSTERY_RANK, 1, state.frame.sloganPreview, previewFrameImg);
    if (!opts.names.first && !opts.names.last && CFG.sampleName) {
      // 名前が空のあいだは見本の名前を薄く表示
      opts.names = CFG.sampleName;
      opts.nameAlpha = 0.55;
    }
    drawCard(pctx, opts, PREVIEW_SCALE);
  }

  /** プレビュー用のフレームPNGを(ランク/モードに合わせて)読み直す */
  let previewToken = 0;
  function refreshPreviewFrame() {
    const token = ++previewToken;
    return loadFrameImage('?').then(function (img) {
      if (token !== previewToken) return;
      previewFrameImg = img;
      requestRender();
    });
  }
  function requestRender() {
    if (!rafId) rafId = requestAnimationFrame(renderPreview);
  }

  function updateHint() {
    $('hint').textContent = state.source
      ? 'ドラッグで位置、ピンチやスライダーで大きさを調整してね'
      : '写真を追加すると、ここにカードが出来上がっていくよ';
  }

  /* ================================================================
   * 名前 (苗字 / 名前 を別欄・ローマ字)
   * ================================================================ */
  let nameInfo = { first: { text: '', invalid: false }, last: { text: '', invalid: false } };

  function currentNames() {
    return { first: nameInfo.first.text, last: nameInfo.last.text };
  }

  function onNameInput() {
    nameInfo = {
      last: L.toRomajiName($('nameLast').value),
      first: L.toRomajiName($('nameFirst').value),
    };
    const msg = $('nameMsg');
    const bad = nameInfo.first.invalid || nameInfo.last.invalid;
    msg.classList.toggle('error', bad);
    msg.textContent = '';
    if (bad) {
      msg.textContent = '漢字や記号は使えません。ローマ字で入力してね(例: YOKONO / SHINICHI)';
    } else if (nameInfo.first.text || nameInfo.last.text) {
      const t = document.createElement('b');
      t.textContent = [nameInfo.first.text, nameInfo.last.text].filter(Boolean).join(' ');
      msg.append('カードに入る名前: ', t);
    } else {
      msg.textContent = 'ローマ字で入力(ひらがなでもOK。自動でローマ字になります)';
    }
    updateGenerateButton();
    requestRender();
  }

  function namesInvalid() {
    return nameInfo.first.invalid || nameInfo.last.invalid;
  }

  function updateGenerateButton() {
    const needRegion = !!$('region') && !state.region;
    $('btnGenerate').disabled = !state.source || state.busy || namesInvalid() || needRegion;
    updateAssist();
  }

  /* ================================================================
   * キャラクターの登場: 画面の端からぴょこっと出て、少しして隠れる(出す判断は lib.js の createBuddyGate)
   * ================================================================ */
  const buddy = (function () {
    const cfg = CFG.buddy;
    const none = { say: function () {}, hide: function () {}, touch: function () {} };
    const el = $('buddy');
    if (!cfg || !cfg.enabled || !el) return none;
    const img = $('buddyImg');
    const bubble = $('buddyBubble');
    const gate = L.createBuddyGate({ cooldownMs: cfg.cooldownMs });
    const loaded = {};
    let token = 0;
    let timers = [];
    let idleTimer = 0;

    function preload(url) {
      if (loaded[url] !== undefined) return Promise.resolve(loaded[url]);
      return new Promise(function (resolve) {
        const i = new Image();
        i.onload = function () { loaded[url] = true; resolve(true); };
        i.onerror = function () { loaded[url] = false; resolve(false); };
        i.src = url;
      });
    }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function keyboardOpen() {
      const vv = window.visualViewport;
      return !!vv && vv.height < window.innerHeight - 150;
    }
    function blocked() {
      return !!document.getElementById('splash') || !$('camera').hidden || keyboardOpen();
    }
    function hide() {
      token++;
      timers.forEach(clearTimeout);
      timers = [];
      el.classList.remove('in', 'hop');
      later(function () { el.hidden = true; }, 380);
    }

    async function say(scene, vars) {
      const def = cfg.scenes && cfg.scenes[scene];
      if (!def || blocked()) return;
      if (!gate.allow(scene, def, performance.now())) return;
      const my = ++token;
      timers.forEach(clearTimeout);
      timers = [];
      const poses = [];
      for (const u of def.poses || []) { if (await preload(u)) poses.push(u); }
      if (!poses.length || my !== token || blocked()) return;
      gate.commit(scene, performance.now());
      const line = L.pickLine(secureRandom, (cfg.lines || {})[scene], vars);
      el.classList.remove('in', 'hop', 'left', 'right');
      el.classList.add(def.side === 'left' ? 'left' : 'right');
      img.src = poses[0];
      bubble.hidden = !line;
      bubble.textContent = line;
      el.hidden = false;
      void el.offsetWidth;
      el.classList.add('in', 'hop');
      let t = 900;
      poses.slice(1).forEach(function (u) { later(function () { img.src = u; el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }, t); t += 900; });
      later(function () { hide(); }, Math.max(L.bubbleHoldMs(line), t + 1000));
    }

    // 操作がない時間が続いたら idle の場面。操作があるたびに数え直す
    function touch() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { say('idle'); }, cfg.idleMs || 15000);
    }
    ['pointerdown', 'keydown', 'scroll', 'input'].forEach(function (ev) { window.addEventListener(ev, touch, { passive: true }); });
    document.addEventListener('focusin', function (e) { if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) hide(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { if (keyboardOpen()) hide(); });
    return { say: say, hide: hide, touch: touch };
  })();

  /* ================================================================
   * 操作アシスト: 「つぎはここだよ」を画面下に出し、押すとその場所までスクロールする
   * ================================================================ */
  function assistStep() {
    const noName = !nameInfo.first.text && !nameInfo.last.text;
    if (!state.source) return { id: 'photoBlock', text: 'つぎは 写真をいれてね' };
    if (namesInvalid()) return { id: 'nameBlock', text: '名前をローマ字に直してね' };
    if (noName && !state.region) return { id: 'nameBlock', text: 'つぎは 名前をいれてね' };
    if ($('region') && !state.region) return { id: 'nameBlock', text: 'つぎは 地域をえらんでね' };
    return { id: 'makeBlock', text: 'できたら「カードをつくる」を押してね' };
  }

  function updateAssist() {
    const box = $('assist');
    if (!box) return;
    const blocked = !!document.getElementById('splash') ||
      !!document.querySelector('.overlay:not([hidden])') || state.busy;
    const step = assistStep();
    const el = $(step.id);
    if (blocked || !el) { box.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    // 目的の場所がほぼ見えているときは案内を出さない
    if (r.top < vh * 0.62 && r.bottom > vh * 0.18) { box.hidden = true; return; }
    $('assistArrow').textContent = r.top >= vh * 0.62 ? '👇' : '👆';
    $('assistText').textContent = step.text;
    state.assistTarget = step.id;
    box.hidden = false;
  }

  let assistRaf = 0;
  function scheduleAssist() {
    if (!assistRaf) assistRaf = requestAnimationFrame(function () { assistRaf = 0; updateAssist(); });
  }
  window.addEventListener('scroll', scheduleAssist, { passive: true });
  window.addEventListener('resize', scheduleAssist);
  $('assistBtn').addEventListener('click', function () {
    const el = $(state.assistTarget || assistStep().id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    el.classList.remove('spotlight');
    void el.offsetWidth;
    el.classList.add('spotlight');
    setTimeout(function () { el.classList.remove('spotlight'); }, 2600);
  });

  /* ================================================================
   * 写真の取り込み
   * ================================================================ */
  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) { /* フォールバックへ */ }
    }
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  function setSource(canvas) {
    state.source = canvas;
    state.view = { zoom: 1, ox: 0, oy: 0 };
    $('zoom').value = '1';
    $('zoomRow').hidden = false;
    updateHint();
    updateGenerateButton();
    requestRender();
    buddy.say('photoAdded');
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)) {
      toast('画像ファイルをえらんでね');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast('ファイルが大きすぎます(30MBまで)');
      return;
    }
    try {
      const bmp = await loadBitmap(file);
      const iw = bmp.width || bmp.naturalWidth;
      const ih = bmp.height || bmp.naturalHeight;
      const size = L.fitWithin(iw, ih, MAX_SOURCE_SIDE);
      const cv = document.createElement('canvas');
      cv.width = size.w;
      cv.height = size.h;
      const cx = cv.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(bmp, 0, 0, size.w, size.h);
      if (bmp.close) bmp.close();
      setSource(cv);
      toast('写真を読み込んだよ!');
    } catch (e) {
      toast('この画像は読み込めませんでした。JPEG / PNG でためしてね');
      buddy.say('error');
    }
  }

  /* ---- 位置・ズームの操作 ---- */
  function applyView(zoom, ox, oy) {
    if (!state.source) return;
    const r = L.coverRect(state.source.width, state.source.height, PHOTO.w, PHOTO.h,
      Math.min(zoom, ZOOM_MAX), ox, oy);
    state.view = { zoom: r.zoom, ox: r.ox, oy: r.oy };
    $('zoom').value = String(r.zoom);
    requestRender();
  }

  (function setupPointer() {
    const pts = new Map();
    let startDist = 0, startZoom = 1, last = null;
    let moved = false;

    function logicalPerPx() { return W / preview.getBoundingClientRect().width; }

    preview.addEventListener('pointerdown', function (e) {
      preview.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
      if (pts.size === 2) {
        const a = Array.from(pts.values());
        startDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        startZoom = state.view.zoom;
      }
      preview.classList.add('dragging');
    });
    preview.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!state.source) return;
      const k = logicalPerPx();
      if (pts.size === 1) {
        const dx = (e.clientX - prev.x) * k;
        const dy = (e.clientY - prev.y) * k;
        if (Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y) > 4) moved = true;
        applyView(state.view.zoom, state.view.ox + dx, state.view.oy + dy);
      } else if (pts.size === 2) {
        moved = true;
        const a = Array.from(pts.values());
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
        applyView(startZoom * (d / startDist), state.view.ox, state.view.oy);
      }
    });
    function end(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        preview.classList.remove('dragging');
        if (!state.source && !moved && e.type === 'pointerup') $('fileInput').click();
      }
    }
    preview.addEventListener('pointerup', end);
    preview.addEventListener('pointercancel', end);
    preview.addEventListener('wheel', function (e) {
      if (!state.source) return;
      e.preventDefault();
      applyView(state.view.zoom * Math.exp(-e.deltaY * 0.0015), state.view.ox, state.view.oy);
    }, { passive: false });
    preview.addEventListener('keydown', function (e) {
      if (!state.source) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); }
        return;
      }
      const stepPx = 30;
      const v = state.view;
      const map = {
        ArrowLeft: [v.zoom, v.ox - stepPx, v.oy], ArrowRight: [v.zoom, v.ox + stepPx, v.oy],
        ArrowUp: [v.zoom, v.ox, v.oy - stepPx], ArrowDown: [v.zoom, v.ox, v.oy + stepPx],
        '+': [v.zoom * 1.1, v.ox, v.oy], '=': [v.zoom * 1.1, v.ox, v.oy], '-': [v.zoom / 1.1, v.ox, v.oy],
      };
      if (map[e.key]) { e.preventDefault(); applyView.apply(null, map[e.key]); }
    });
  })();

  $('zoom').addEventListener('input', function (e) {
    applyView(parseFloat(e.target.value), state.view.ox, state.view.oy);
  });
  $('btnResetView').addEventListener('click', function () { applyView(1, 0, 0); });

  /* ================================================================
   * カメラ
   * ================================================================ */
  const cam = { stream: null, facing: 'user' };

  function stopCamera() {
    if (cam.stream) cam.stream.getTracks().forEach(function (t) { t.stop(); });
    cam.stream = null;
    $('camVideo').srcObject = null;
  }

  async function startCamera() {
    stopCamera();
    const video = $('camVideo');
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: cam.facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      video.srcObject = cam.stream;
      video.classList.toggle('mirror', cam.facing === 'user');
      await video.play();
    } catch (e) {
      closeCamera();
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      toast(denied
        ? 'カメラの許可が必要です。ブラウザの設定で許可するか、「写真をえらぶ」を使ってね'
        : 'カメラを起動できませんでした。「写真をえらぶ」を使ってね');
    }
  }

  function openCamera() {
    const ok = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext;
    if (!ok) {
      $('captureInput').click();
      return;
    }
    $('camera').style.setProperty('--cam-ar', PHOTO.w + ' / ' + PHOTO.h);
    setModal(true, $('camera'), $('camShutter'));
    startCamera();
  }

  function closeCamera() {
    stopCamera();
    setModal(false, $('camera'));
  }

  function shoot() {
    const v = $('camVideo');
    if (!v.videoWidth) return;
    const crop = L.centerCrop(v.videoWidth, v.videoHeight, PHOTO.w / PHOTO.h);
    const size = L.fitWithin(crop.sw, crop.sh, MAX_SOURCE_SIDE);
    const cv = document.createElement('canvas');
    cv.width = size.w;
    cv.height = size.h;
    cv.getContext('2d').drawImage(v, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size.w, size.h);
    closeCamera();
    setSource(cv);
    toast('撮影できたよ! 位置を調整してね');
  }

  $('btnCamera').addEventListener('click', openCamera);
  $('camClose').addEventListener('click', closeCamera);
  $('camShutter').addEventListener('click', shoot);
  $('camFlip').addEventListener('click', function () {
    cam.facing = cam.facing === 'user' ? 'environment' : 'user';
    startCamera();
  });

  $('btnPick').addEventListener('click', function () { $('fileInput').click(); });
  ['fileInput', 'captureInput'].forEach(function (id) {
    $(id).addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      handleFile(f);
    });
  });

  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('camera').hidden) closeCamera();
    else if (!$('result').hidden) closeResult();
  });

  /* ================================================================
   * ガチャ & 結果
   * ================================================================ */
  function confetti(rank) {
    const box = $('confetti');
    box.textContent = '';
    if (reduceMotion) return;
    const count = rank.id === 'SP' ? 70 : rank.id === 'UR' ? 50 : rank.id === 'SR' ? 32 : 16;
    const colors = ['#e8384f', '#ffd814', '#3fa65f', '#1e88e5', '#ff9fb0', '#fff'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--x', Math.random() * 100 + '%');
      p.style.setProperty('--s', 8 + Math.random() * 10 + 'px');
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.setProperty('--d', 1.8 + Math.random() * 1.6 + 's');
      p.style.setProperty('--delay', Math.random() * 0.5 + 's');
      p.style.setProperty('--r', Math.random() * 360 + 'deg');
      box.appendChild(p);
    }
  }

  async function playGacha(rank) {
    const g = $('gacha');
    g.classList.remove('reveal');
    $('gachaText').textContent = 'ガチャッ…';
    $('gachaRank').textContent = '';
    $('confetti').textContent = '';
    setModal(true, g);
    buddy.say('waiting');
    await sleep(reduceMotion ? 300 : 1700);
    $('flash').classList.remove('go');
    void $('flash').offsetWidth;
    $('flash').classList.add('go');
    g.classList.add('reveal');
    $('gachaText').textContent = 'けっか は…';
    const label = $('gachaRank');
    label.textContent = '';
    label.append(rank.id);
    const small = document.createElement('small');
    small.textContent = rank.name;
    label.appendChild(small);
    confetti(rank);
    await sleep(reduceMotion ? 400 : 1500);
  }

  async function renderFinal(rank, seed, slogan) {
    await fontsReady;
    const frameImg = await loadFrameImage(rank.id);
    const cv = document.createElement('canvas');
    const size = exportFor(frameImg);
    cv.width = size.w;
    cv.height = size.h;
    drawCard(cv.getContext('2d'), cardOptions(rank, seed, slogan, frameImg), size.w / W);
    const blob = await new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob')); }, 'image/png');
    });
    // 印刷しても 55 x 91 mm になるよう、解像度の情報(pHYs)を書き込む。失敗しても画像はそのまま使う
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return new Blob([L.setPngPhysicalSize(bytes, size.w)], { type: 'image/png' });
    } catch (e) {
      return blob;
    }
  }

  function showResult(blob, rank) {
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.resultBlob = blob;
    state.resultUrl = URL.createObjectURL(blob);
    const img = $('resultImg');
    img.src = state.resultUrl;
    const names = [nameInfo.first.text, nameInfo.last.text].filter(Boolean).join(' ');
    img.alt = rank.name + 'のカード' + (names ? '(' + names + ')' : '');
    const label = $('resultRank');
    label.textContent = '';
    const b = document.createElement('b');
    b.textContent = rank.id;
    label.append(b, rank.name + ' が出たよ!');
    const tilt = $('tilt');
    tilt.classList.toggle('foil', rank.foil > 0);
    tilt.style.animation = 'none';
    void tilt.offsetWidth;
    tilt.style.animation = '';
    setModal(false, $('gacha'));
    setModal(true, $('result'), $('btnSave'));
    buddy.say(rank.stars >= 3 ? 'resultRare' : 'resultNormal');
  }

  async function generate() {
    if (state.busy) return;
    if (!state.source) { toast('先に写真を入れてね'); return; }
    if (namesInvalid()) { toast('名前はローマ字で入力してね'); return; }
    if ($('region') && !state.region) { toast('地域(市町村)をえらんでね'); return; }
    state.busy = true;
    updateGenerateButton();
    try {
      const seed = Math.floor(secureRandom() * 1e9) + 1;
      const rank = (CFG.rankOverride && L.RANKS.find(function (r) { return r.id === CFG.rankOverride; })) || L.pickRank(secureRandom);
      const slogan = L.pickFrom(secureRandom, state.frame.slogans[rank.id]);
      const rendering = renderFinal(rank, seed, slogan);
      await playGacha(rank);
      showResult(await rendering, rank);
    } catch (e) {
      setModal(false, $('gacha'));
      toast('カードの生成に失敗しました。もう一度ためしてね');
      buddy.say('error');
    } finally {
      state.busy = false;
      updateGenerateButton();
    }
  }

  function closeResult() {
    setModal(false, $('result'));
  }

  function fileName() {
    const n = [nameInfo.first.text, nameInfo.last.text].filter(Boolean).join('_').replace(/[^A-Z0-9_\-]/g, '');
    return 'aomori-card' + (n ? '-' + n : '') + '.png';
  }

  function canShareFiles() {
    try {
      if (!navigator.share || !navigator.canShare) return false;
      return navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'a.png', { type: 'image/png' })] });
    } catch (e) { return false; }
  }

  $('btnGenerate').addEventListener('click', generate);
  $('btnAgain').addEventListener('click', function () { closeResult(); generate(); });
  $('btnBack').addEventListener('click', closeResult);
  function saveResult() {
    if (!state.resultUrl) return;
    const a = document.createElement('a');
    a.href = state.resultUrl;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  $('btnSave').addEventListener('click', function () {
    if (!state.resultUrl) return;
    saveResult();
    toast('保存しました(うまくいかないときは画像を長押ししてね)');
    buddy.say('saved');
  });
  // シェア: 画像ごと共有できる端末はそのまま共有。できない端末は、保存してSNSへの投稿を案内する
  $('btnShare').addEventListener('click', async function () {
    if (!state.resultBlob) return;
    const text = '#あおもりカードメーカー';
    try {
      if (canShareFiles()) {
        const file = new File([state.resultBlob], fileName(), { type: 'image/png' });
        await navigator.share({ files: [file], title: 'あおもりカード', text: text });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'あおもりカードメーカー', text: text, url: location.href });
        toast('カード画像は「保存する」から保存して、投稿に添付してね');
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    saveResult();
    toast('画像を保存しました。SNSに投稿してね');
  });

  (function setupTilt() {
    const tilt = $('tilt');
    if (reduceMotion) return;
    tilt.addEventListener('pointermove', function (e) {
      const r = tilt.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      tilt.classList.add('active');
      tilt.style.setProperty('--ry', ((px - 0.5) * 22).toFixed(2) + 'deg');
      tilt.style.setProperty('--rx', ((0.5 - py) * 22).toFixed(2) + 'deg');
      tilt.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      tilt.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    });
    function reset() {
      tilt.classList.remove('active');
      tilt.style.setProperty('--rx', '0deg');
      tilt.style.setProperty('--ry', '0deg');
    }
    tilt.addEventListener('pointerleave', reset);
    tilt.addEventListener('pointercancel', reset);
  })();

  /* ================================================================
   * 初期化 & スプラッシュ
   * ================================================================ */
  function initSplash() {
    const splash = $('splash');
    const apple = splash.querySelector('.splash-apple');
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      splash.classList.add('done');
      setTimeout(function () { splash.remove(); updateAssist(); buddy.say('greet'); buddy.touch(); }, 600);
    }
    function expand() {
      if (finished || splash.classList.contains('expand')) return;
      splash.classList.add('expand');
      setTimeout(finish, reduceMotion ? 0 : 750);
    }
    $('splashSkip').addEventListener('click', finish);
    splash.addEventListener('click', finish);
    if (reduceMotion) { setTimeout(finish, 300); return; }
    splash.addEventListener('animationend', function (e) {
      if (e.animationName === 'spin') expand();
    });
    setTimeout(expand, 3200);
  }

  /* ---- フレーム選択 ---- */
  function setFrame(id) {
    state.frameId = id;
    state.frame = CFG.frames[id];
    PHOTO = state.frame.photo;
    document.querySelectorAll('#frames .chip[data-frame]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.frame === id));
    });
    if (state.source) applyView(state.view.zoom, state.view.ox, state.view.oy);
    refreshPreviewFrame();
    requestRender();
  }

  function initFrames() {
    const box = $('frames');
    Object.keys(CFG.frames).forEach(function (id) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(id === state.frameId));
      b.dataset.frame = id;
      b.textContent = CFG.frames[id].label;
      b.addEventListener('click', function () { setFrame(id); });
      box.appendChild(b);
    });
    const soon = document.createElement('button');
    soon.type = 'button';
    soon.className = 'chip';
    soon.disabled = true;
    soon.setAttribute('role', 'radio');
    soon.setAttribute('aria-checked', 'false');
    soon.textContent = 'ねぶた風 ';
    const sm = document.createElement('small');
    sm.textContent = 'じゅんびちゅう';
    soon.appendChild(sm);
    box.appendChild(soon);
  }

  /* ---- 地域(バッジ) ---- */
  function initRegions() {
    const sel = $('region');
    if (!sel) return;
    CFG.regions.forEach(function (r, i) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = r[0];
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      const r = sel.value === '' ? null : CFG.regions[Number(sel.value)];
      state.region = r ? { ja: r[0], en: r[1], type: r[2], x: r[3], y: r[4] } : null;
      updateGenerateButton();
      requestRender();
    });
  }

  /* ---- 画面の部品の出し分け ---- */
  /** 画面に出す部品の出し分け(config.ui)と番号の振り直し */
  function applyUi() {
    const ui = CFG.ui || {};
    if (!ui.frameChooser) $('frameBlock').remove();
    if (!ui.regionSelect) $('regionField').remove();
    if (!ui.camera) $('btnCamera').remove();
    $('nameTitle').textContent = ui.regionSelect ? 'おなまえと地域' : 'おなまえ';
    let n = 0;
    document.querySelectorAll('.step-block[data-step] .num').forEach(function (el) { el.textContent = String(++n); });
  }

  $('nameLast').addEventListener('input', onNameInput);
  $('nameFirst').addEventListener('input', onNameInput);

  updateHint();
  renderPreview();
  initSplash();

  // 書体・フレームPNGの読み込みが終わったらプレビューを描き直す
  fontsReady = loadFonts().then(function () { requestRender(); });
  // マスコット画像(config.mascotImages)があれば、読み込めたときだけ入れ替える
  (function applyMascotImages() {
    const imgs = CFG.mascotImages || {};
    const key = { splash: 'splash', logo: 'logo', button: 'logo', capsule: 'gacha' };
    document.querySelectorAll('[data-mascot-slot]').forEach(function (el) {
      const url = imgs[key[el.dataset.mascotSlot]] || imgs.main;
      if (!url) return;
      const img = new Image();
      img.className = el.getAttribute('class');
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.onload = function () { el.replaceWith(img); };
      img.src = url;
    });
  })();
  applyUi();
  if ($('frames')) initFrames();
  initRegions();
  refreshPreviewFrame();

  // テスト・デバッグ用に最小限を公開
  window.__aomoriCard = { state: state, drawCard: drawCard, cardOptions: cardOptions, ready: function () { return fontsReady; } };
})();
