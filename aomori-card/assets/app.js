/* あおもりカードメーカー: 画面制御とカード描画 */
(function () {
  'use strict';

  const L = window.AomoriLib;
  const $ = function (id) { return document.getElementById(id); };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ================================================================
   * 定数: カードの座標系は 1024 x 1536 (ローカルプレナー枠を基準)
   * ================================================================ */
  const W = 1024;
  const H = 1536;
  const PHOTO = { x: 22, y: 104, w: 864, h: 1188 };
  const PHOTO_PATH = [[22, 222], [312, 104], [886, 104], [886, 1292], [22, 1292]];
  const PREVIEW_SCALE = 0.75;
  const EXPORT_SCALE = 1.5;
  const MAX_SOURCE_SIDE = 2400;
  const MAX_FILE_BYTES = 30 * 1024 * 1024;
  const ZOOM_MAX = 4;

  const FONT_HEAVY = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
  const FONT_NAME = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const FONT_JP = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Meiryo", sans-serif';

  // フレーム定義(今後ここに追加していく)
  const FRAMES = {
    'local-preneur': {
      id: 'local-preneur',
      headline: 'LOCAL PRENEUR',
      slogan: '地域の課題を未来の価値へ　未来を拓く青森',
      badge: ['AOMORI', 'SUPPORT'],
    },
  };

  // りんご(プレースホルダ描画用。index.html の symbol と同じ形)
  const APPLE = {
    body: new Path2D('M60 34C48 24 24 26 20 52C16 78 34 104 50 104C56 104 58 101 60 101C62 101 64 104 70 104C86 104 104 78 100 52C96 26 72 24 60 34Z'),
    stem: new Path2D('M60 34C60 27 62 19 68 12'),
    leaf: new Path2D('M64 24C69 9 88 8 95 14C89 27 75 30 64 24Z'),
  };

  // 青森県の簡易シルエット(0-100 の座標)
  const AOMORI = [
    [20, 10], [27, 6], [32, 16], [31, 28], [36, 38], [46, 42], [56, 40], [60, 34],
    [56, 22], [58, 10], [68, 4], [78, 8], [86, 6], [88, 16], [80, 22], [74, 32],
    [80, 46], [90, 58], [86, 72], [72, 86], [54, 92], [34, 86], [22, 72], [14, 58],
    [12, 42], [14, 28], [16, 18],
  ];

  /* ================================================================
   * 状態
   * ================================================================ */
  const state = {
    frame: FRAMES['local-preneur'],
    source: null, // HTMLCanvasElement (取り込み済みの写真)
    view: { zoom: 1, ox: 0, oy: 0 },
    names: { first: '', last: '' },
    busy: false,
    resultUrl: null,
    resultBlob: null,
    lastFocus: null,
  };

  /* ================================================================
   * カード描画
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
  function fitText(ctx, text, x, y, targetW) {
    const m = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(targetW / m, 1);
    if (ctx.lineWidth > 0 && ctx.strokeStyle) ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** 字間つきの文字列。長すぎる場合は横に縮める */
  function spacedText(ctx, text, x, y, spacing, maxW) {
    const chars = Array.from(text);
    const widths = chars.map(function (c) { return ctx.measureText(c).width; });
    const total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * Math.max(0, chars.length - 1);
    const k = total > maxW ? maxW / total : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, 1);
    let cx = 0;
    chars.forEach(function (c, i) {
      ctx.fillText(c, cx, 0);
      cx += widths[i] + spacing;
    });
    ctx.restore();
  }

  function aomoriPath(ctx, ox, oy, sx, sy) {
    const p = AOMORI.map(function (q) { return [ox + q[0] * sx, oy + q[1] * sy]; });
    const n = p.length;
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 8, p1[1] + (p2[1] - p0[1]) / 8,
        p2[0] - (p3[0] - p1[0]) / 8, p2[1] - (p3[1] - p1[1]) / 8,
        p2[0], p2[1]);
    }
    ctx.closePath();
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
    ctx.save();
    ctx.translate(454 - 170, 520 - 170);
    ctx.scale(340 / 120, 340 / 120);
    ctx.fillStyle = '#e8384f';
    ctx.fill(APPLE.body);
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = '#7a4a2b';
    ctx.stroke(APPLE.stem);
    ctx.fillStyle = '#4caf6a';
    ctx.fill(APPLE.leaf);
    ctx.fillStyle = '#3b1d1d';
    ctx.beginPath(); ctx.arc(46, 64, 4.2, 0, Math.PI * 2); ctx.arc(74, 64, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3b1d1d'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(53, 74); ctx.quadraticCurveTo(60, 82, 67, 74); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#1e5f9f';
    ctx.textAlign = 'center';
    ctx.font = '800 56px ' + FONT_JP;
    ctx.fillText('ここに写真が入るよ', 454, 850);
    ctx.font = '700 38px ' + FONT_JP;
    ctx.fillStyle = '#4a82b8';
    ctx.fillText('タップして写真をえらぶ', 454, 920);
    ctx.textAlign = 'left';
  }

  function drawFoil(ctx, rank, seed) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 40);
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
    // きらきら
    const rnd = mulberry32(seed);
    const n = rank.id === 'SP' ? 26 : rank.id === 'UR' ? 18 : 10;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const x = 40 + rnd() * (W - 80);
      const y = 40 + rnd() * (H - 80);
      const r = 8 + rnd() * 16;
      ctx.globalAlpha = 0.5 + rnd() * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * カード全体を描画する。
   * o: { rank, frame, source, view, names:{first,last}, seed }
   */
  function drawCard(ctx, o, scale) {
    const rank = o.rank;
    const c = rank.colors;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 0, 0, W, H, 40);
    ctx.clip();

    // 地 + フレーム色
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c.light); bg.addColorStop(0.5, c.base); bg.addColorStop(1, c.dark);
    ctx.fillStyle = bg;
    ctx.fillRect(10, 10, W - 20, H - 20);

    // 写真エリア(左上が斜めにカットされた形)
    ctx.save();
    polyPath(ctx, PHOTO_PATH);
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

    // 右の縦書きスローガン帯
    ctx.fillStyle = '#fff';
    ctx.fillRect(892, 104, 108, 1090);
    const slogan = Array.from(o.frame.slogan);
    const step = Math.min(52, 985 / slogan.length);
    ctx.fillStyle = '#111';
    ctx.font = '900 ' + Math.round(step * 0.98) + 'px ' + FONT_JP;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    slogan.forEach(function (ch, i) {
      if (ch === '　') return;
      ctx.fillText(ch, 946, 175 + i * step);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 上部の白いライン
    line(ctx, 336, 98, 560, 16, 8, '#fff');
    line(ctx, 352, 99, 1000, 99, 5, '#fff');
    line(ctx, 400, 86, 548, 30, 3, 'rgba(255,255,255,.7)');

    // 下部の帯
    line(ctx, 22, 1326, 684, 1326, 4, '#fff');
    line(ctx, 22, 1430, 720, 1430, 4, '#fff');
    line(ctx, 438, 1506, 578, 1436, 6, '#fff');

    // ランク文字 (左上)
    ctx.font = '900 150px ' + FONT_HEAVY;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = c.dark;
    ctx.fillStyle = rank.accent;
    const rankW = Math.min(ctx.measureText(rank.id).width, 250);
    fitText(ctx, rank.id, 46, 146, rankW);

    // 見出し
    ctx.font = 'italic 900 94px ' + FONT_HEAVY;
    ctx.lineWidth = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.fillStyle = '#fff';
    fitText(ctx, o.frame.headline, 44, 1412, 636);

    // 星
    function stars(cx0, cy, gap, filled) {
      for (let i = 0; i < 5; i++) {
        starPath(ctx, cx0 + i * gap, cy, 31);
        if (i < filled) {
          ctx.fillStyle = '#ffd814';
          ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = c.dark; ctx.lineJoin = 'round';
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,.22)';
          ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)';
          ctx.stroke();
        }
      }
    }
    stars(595, 57, 85, rank.stars);
    stars(70, 1476, 78, rank.stars);

    // 名前 (写真の左下)
    const n1 = o.names.first;
    const n2 = o.names.last;
    if (n1 || n2) {
      ctx.save();
      ctx.font = 'italic 500 76px ' + FONT_NAME;
      ctx.fillStyle = '#ffd814';
      ctx.shadowColor = 'rgba(0,0,0,.65)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      if (n1 && n2) {
        spacedText(ctx, n1, 38, 1190, 14, 640);
        spacedText(ctx, n2, 165, 1268, 14, 600);
      } else {
        spacedText(ctx, n1 || n2, 40, 1262, 14, 640);
      }
      ctx.restore();
    }

    // 右下のバッジ
    const bx = 850, by = 1328;
    ctx.beginPath(); ctx.arc(bx, by, 152, 0, Math.PI * 2);
    ctx.fillStyle = c.dark; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, 147, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    const rg = ctx.createRadialGradient(bx - 30, by - 40, 10, bx, by, 142);
    rg.addColorStop(0, c.light); rg.addColorStop(1, c.base);
    ctx.beginPath(); ctx.arc(bx, by, 141, 0, Math.PI * 2);
    ctx.fillStyle = rg; ctx.fill();
    aomoriPath(ctx, 752, 1196, 1.95, 1.9);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '500 34px ' + FONT_NAME;
    ctx.fillText(o.frame.badge[0], bx, 1405);
    ctx.fillText(o.frame.badge[1], bx, 1443);
    ctx.textAlign = 'left';

    // ホイル(SR 以上)
    if (rank.foil > 0) drawFoil(ctx, rank, o.seed || 1);

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

  function currentCardOptions(rank, seed) {
    return {
      rank: rank, frame: state.frame, source: state.source, view: state.view,
      names: currentNames(), seed: seed,
    };
  }

  function renderPreview() {
    rafId = 0;
    drawCard(pctx, currentCardOptions(L.MYSTERY_RANK, 1), PREVIEW_SCALE);
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
   * 名前
   * ================================================================ */
  let nameInfo = { first: { text: '', invalid: false }, last: { text: '', invalid: false } };

  function currentNames() {
    return { first: nameInfo.first.text, last: nameInfo.last.text };
  }

  function onNameInput() {
    nameInfo = {
      first: L.toRomajiName($('name1').value),
      last: L.toRomajiName($('name2').value),
    };
    const msg = $('nameMsg');
    const bad = nameInfo.first.invalid || nameInfo.last.invalid;
    msg.classList.toggle('error', bad);
    if (bad) {
      msg.textContent = '漢字や記号は自動で変換できません。ひらがな か ローマ字で入力してね(例: しんいち / SHINICHI)';
    } else if (nameInfo.first.text || nameInfo.last.text) {
      msg.textContent = '';
      const b = document.createElement('span');
      b.textContent = 'カードに入る名前: ';
      const t = document.createElement('b');
      t.textContent = [nameInfo.first.text, nameInfo.last.text].filter(Boolean).join(' ');
      msg.append(b, t);
    } else {
      msg.textContent = 'ひらがな・カタカナは自動でローマ字になります';
    }
    updateGenerateButton();
    requestRender();
  }

  function namesInvalid() {
    return nameInfo.first.invalid || nameInfo.last.invalid;
  }

  function updateGenerateButton() {
    $('btnGenerate').disabled = !state.source || state.busy || namesInvalid();
  }

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
        // 写真が無いときのタップ = 写真えらび
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
      // HTTP などで getUserMedia が使えない場合は、OS標準カメラ起動にフォールバック
      $('captureInput').click();
      return;
    }
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

  // ドラッグ&ドロップ(PC)
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

  function renderFinal(rank, seed) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * EXPORT_SCALE);
    cv.height = Math.round(H * EXPORT_SCALE);
    drawCard(cv.getContext('2d'), currentCardOptions(rank, seed), EXPORT_SCALE);
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob')); }, 'image/png');
    });
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
    // 入場アニメを再生し直す
    tilt.style.animation = 'none';
    void tilt.offsetWidth;
    tilt.style.animation = '';
    $('btnShare').hidden = !canShareFiles();
    setModal(false, $('gacha'));
    setModal(true, $('result'), $('btnSave'));
  }

  async function generate() {
    if (state.busy) return;
    if (!state.source) { toast('先に写真を入れてね'); return; }
    if (namesInvalid()) { toast('名前は ひらがな か ローマ字 で入力してね'); return; }
    state.busy = true;
    updateGenerateButton();
    try {
      const rank = L.pickRank(secureRandom);
      const seed = Math.floor(secureRandom() * 1e9) + 1;
      const rendering = renderFinal(rank, seed);
      await playGacha(rank);
      showResult(await rendering, rank);
    } catch (e) {
      setModal(false, $('gacha'));
      toast('カードの生成に失敗しました。もう一度ためしてね');
    } finally {
      state.busy = false;
      updateGenerateButton();
    }
  }

  function closeResult() {
    setModal(false, $('result'));
  }

  function fileName() {
    const n = [nameInfo.first.text, nameInfo.last.text].filter(Boolean).join('_').replace(/[^A-Z0-9_\-']/g, '');
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
  $('btnSave').addEventListener('click', function () {
    if (!state.resultUrl) return;
    const a = document.createElement('a');
    a.href = state.resultUrl;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('保存しました(うまくいかないときは画像を長押ししてね)');
  });
  $('btnShare').addEventListener('click', async function () {
    if (!state.resultBlob) return;
    try {
      const file = new File([state.resultBlob], fileName(), { type: 'image/png' });
      await navigator.share({ files: [file], title: 'あおもりカード', text: '#あおもりカードメーカー' });
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('シェアできませんでした。保存してから投稿してね');
    }
  });

  // カードのチルト & ホイル反射
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
  function initRates() {
    const total = L.RANKS.reduce(function (s, r) { return s + r.weight; }, 0);
    $('rates').textContent = '排出率: ' + L.RANKS.slice().reverse().map(function (r) {
      return r.id + ' ' + Math.round((r.weight / total) * 100) + '%';
    }).join(' / ');
  }

  function initSplash() {
    const splash = $('splash');
    const apple = splash.querySelector('.splash-apple');
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      splash.classList.add('done');
      setTimeout(function () { splash.remove(); }, 600);
    }
    function expand() {
      if (finished || splash.classList.contains('expand')) return;
      splash.classList.add('expand');
      setTimeout(finish, reduceMotion ? 0 : 750);
    }
    $('splashSkip').addEventListener('click', finish);
    splash.addEventListener('click', finish);
    if (reduceMotion) { setTimeout(finish, 300); return; }
    apple.addEventListener('animationend', function (e) {
      if (e.animationName === 'spin') expand();
    });
    // 保険: アニメーションが発火しない環境でも必ず閉じる
    setTimeout(expand, 3200);
  }

  $('name1').addEventListener('input', onNameInput);
  $('name2').addEventListener('input', onNameInput);

  initRates();
  updateHint();
  renderPreview();
  initSplash();

  // テスト・デバッグ用に最小限を公開
  window.__aomoriCard = { state: state, drawCard: drawCard };
})();
