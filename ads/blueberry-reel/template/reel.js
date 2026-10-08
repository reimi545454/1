/*
 * リール動画テンプレート（1080x1920 / 決定論的レンダリング）
 *
 * すべてのアニメーションは時刻 t（秒）の純関数。render.mjs が
 * window.renderAt(t) を呼ぶたびに、同じ t なら必ず同じ絵になる。
 *
 * 文字の配置は Instagram リールの UI セーフゾーン
 * （上 269px・下 672px・左右 64px は文字禁止）内に収める。
 */
(() => {
  'use strict';
  const L = window.ReelLib;
  const { clamp, lerp, prog, ease, el, svgEl, markup, escapeHtml, sc } = L;
  const W = 1080, H = 1920;
  const SAFE = { top: 269, bottom: H - 672, left: 64, right: W - 64 };

  // 行ごとにマスクリビールする見出し
  function buildHeadline(parent, lines, sizeClass, top) {
    const box = el('div', `headline ${sizeClass}`, parent, { top: `${top}px` });
    const items = lines.map((line) => {
      const ln = el('span', 'ln', box);
      const inner = el('span', 'in', ln);
      inner.innerHTML = markup(line);
      inner.dataset.text = '1';
      return { inner, hls: [...inner.querySelectorAll('.hl')] };
    });
    return { box, items };
  }
  function animateHeadline(h, lt, start = 0.1, stagger = 0.13) {
    h.items.forEach((it, i) => {
      const p = ease.outCubic(prog(lt, start + i * stagger, 0.5));
      it.inner.style.transform = `translateY(${lerp(110, 0, p)}%)`;
      const hp = ease.inOutCubic(prog(lt, start + i * stagger + 0.45, 0.4));
      it.hls.forEach((hl) => (hl.style.backgroundSize = `${hp * 100}% 100%`));
    });
  }
  const textEl = (tag, cls, parent, html, style) => {
    const e = el(tag, cls, parent, style);
    e.innerHTML = html;
    e.dataset.text = '1';
    return e;
  };
  const fadeUp = (e, p, dist = 20) => {
    e.style.opacity = p;
    e.style.transform = `translateY(${(1 - p) * dist}px)`;
  };

  // ---------- シーン定義 ----------
  const SCENES = {
    // フック：キッカー＋特大見出し＋ベリーの房
    hook: {
      build(root, s) {
        const k = textEl('div', 'pill kicker abs center-x', root, escapeHtml(s.kicker || ''), { top: '350px' });
        const h = buildHeadline(root, s.lines, s.size || 'h-xl', 470);
        const svg = svgEl('svg', { width: W, height: H, class: 'layer' }, root);
        const cluster = [[430, 1110, 170], [600, 1090, 190], [520, 1220, 150], [700, 1215, 120], [360, 1225, 110]].map(([x, y, sz], i) => {
          const g = svgEl('g', {}, svg);
          svgEl('use', { href: '#berry', x: -sz / 2, y: -sz / 2, width: sz, height: sz }, g);
          return { g, x, y, i };
        });
        const leaves = [170, 140].map((sz) => {
          const g = svgEl('g', {}, svg);
          svgEl('use', { href: '#leaf', x: -sz / 2, y: -sz / 2, width: sz, height: sz }, g);
          return g;
        });
        return { k, h, cluster, leaves };
      },
      render(o, lt) {
        o.k.style.transform = `translateX(-50%) scale(${sc(ease.outBack(prog(lt, 0, 0.45)))})`;
        animateHeadline(o.h, lt, 0.15);
        o.cluster.forEach((b) => {
          const p = ease.outBack(prog(lt, 0.55 + b.i * 0.09, 0.5));
          const bob = Math.sin((lt + b.i) * 2.2) * 6;
          b.g.setAttribute('transform', `translate(${b.x},${b.y + bob + (1 - p) * 60}) scale(${sc(p)})`);
        });
        const lp = sc(ease.outBack(prog(lt, 0.5, 0.5)));
        o.leaves[0].setAttribute('transform', `translate(300,1040) rotate(${-30 + Math.sin(lt * 2) * 4}) scale(${lp})`);
        o.leaves[1].setAttribute('transform', `translate(790,1060) rotate(${200 + Math.sin(lt * 2 + 1) * 4}) scale(${lp})`);
      },
      hills: () => [0, 9, 0],
    },

    // 耕作放棄地 → ブルーベリー農園（背景の丘が茶色→緑、株が育つ）
    field: {
      build(root, s) {
        const before = textEl('div', 'tag abs', root, escapeHtml(s.beforeTag), { background: '#8a7350', top: '360px', left: '50%' });
        const after = textEl('div', 'tag abs', root, escapeHtml(s.afterTag), { background: 'var(--green)', top: '360px', left: '50%' });
        const h = buildHeadline(root, s.lines, s.size || 'h-l', 480);
        const cap = textEl('div', 'note abs', root, markup(s.caption || ''), { top: `${s.captionTop || 1130}px` });
        let photo = null;
        if (s.photo) {
          photo = el('div', 'photo abs', root, {
            left: '160px', width: '760px', height: '330px', top: '770px',
            backgroundImage: `url(${L.assetUrl(s.photo)})`, border: '10px solid #fff',
          });
        }
        return { before, after, h, cap, photo };
      },
      render(o, lt) {
        const swap = ease.inOutCubic(prog(lt, 1.1, 0.4));
        o.before.style.opacity = 1 - swap;
        o.before.style.transform = `translateX(-50%) translateY(${-swap * 30}px)`;
        o.after.style.opacity = swap;
        o.after.style.transform = `translateX(-50%) translateY(${(1 - swap) * 30}px) scale(${lerp(0.9, 1, ease.outBack(swap))})`;
        animateHeadline(o.h, lt, 0.2);
        fadeUp(o.cap, ease.outCubic(prog(lt, 1.6, 0.5)));
        if (o.photo) {
          const p = ease.outBack(prog(lt, 1.5, 0.55));
          o.photo.style.opacity = clamp(p * 1.5);
          o.photo.style.transform = `scale(${sc(lerp(0.85, 1, p))}) rotate(${lerp(-4, -1.5, p)}deg)`;
        }
      },
      // 前シーンの農園がしぼんで放棄地（茶色）に → 0.9s から緑化 → 1.4s から株が育つ
      hills: (lt) => [
        ease.inOutCubic(prog(lt, 0, 0.35)) * (1 - ease.inOutCubic(prog(lt, 0.9, 0.8))),
        lt < 1.0 ? 9 : lt - 1.4,
        lt < 1.0 ? ease.inOutCubic(prog(lt, 0, 0.35)) : 0,
      ],
    },

    // ポイント3つ（アイコン or 写真付きカード）
    points: {
      build(root, s) {
        const h = buildHeadline(root, [s.title], s.size || 'h-m', 350);
        const cards = s.items.map((it, i) => {
          const c = el('div', 'card pcard abs', root, { top: `${520 + i * 250}px` });
          textEl('div', 'num', c, escapeHtml(it.label || `POINT ${i + 1}`));
          const ic = el('div', 'ic', c);
          if (it.photo) ic.style.backgroundImage = `url(${L.assetUrl(it.photo)})`;
          else ic.innerHTML = L.svgIcon(`ic-${it.icon}`, 92);
          const tx = textEl('div', 'tx', c, markup(it.text));
          tx.dataset.lines = '2';
          return c;
        });
        return { h, cards, gap: s.stagger || 0.75 };
      },
      render(o, lt) {
        animateHeadline(o.h, lt, 0.05);
        o.cards.forEach((c, i) => {
          const p = ease.outBack(prog(lt, 0.45 + i * o.gap, 0.55));
          c.style.opacity = clamp(p * 1.5);
          c.style.transform = `translateX(${(1 - p) * 700}px)`;
        });
      },
      hills: () => [0, 9, 0],
    },

    // 実績数値（カウントアップ）
    stats: {
      build(root, s) {
        const h = buildHeadline(root, [s.title], s.size || 'h-m', 350);
        const rows = s.items.map((it, i) => {
          const c = el('div', 'card stat abs', root, { top: `${500 + i * 240}px` });
          textEl('div', 'lb', c, markup(it.label));
          const val = el('div', 'val', c);
          const b = el('b', '', val);
          b.textContent = String(it.value);
          b.dataset.text = '1';
          const u = el('span', '', val);
          u.textContent = it.unit;
          return { c, b, value: Number(it.value) };
        });
        const foot = textEl('div', 'disclaimer disc abs', root, markup(s.footnote || ''), { top: '1205px' });
        return { h, rows, foot };
      },
      render(o, lt) {
        animateHeadline(o.h, lt, 0.05);
        o.rows.forEach((r, i) => {
          const st = 0.35 + i * 0.45;
          const p = ease.outBack(prog(lt, st, 0.5));
          r.c.style.opacity = clamp(p * 1.5);
          r.c.style.transform = `translateY(${(1 - p) * 80}px)`;
          const cp = ease.outCubic(prog(lt, st + 0.1, 1.1));
          r.b.textContent = String(Math.round(r.value * cp));
        });
        o.foot.style.opacity = ease.outCubic(prog(lt, 1.6, 0.4));
      },
      hills: () => [0, 9, 0],
    },

    // 説明会参加特典（2択）
    gift: {
      build(root, s) {
        const h = buildHeadline(root, s.lines, s.size || 'h-l', 350);
        const cards = s.items.map((it, i) => {
          const c = el('div', 'card gcard abs', root, { left: `${i === 0 ? 75 : 565}px`, top: '690px' });
          el('div', '', c).innerHTML = `<svg width="250" height="275" viewBox="0 0 200 220"><use href="#${escapeHtml(it.icon)}"/></svg>`;
          textEl('div', 'gl', c, escapeHtml(it.label));
          return c;
        });
        const or = textEl('div', 'or abs', root, escapeHtml(s.or || 'or'), { left: '475px', top: '845px' });
        const note = textEl('div', 'note abs', root, markup(s.note || ''), { top: '1140px' });
        const foot = textEl('div', 'disclaimer disc abs', root, markup(s.footnote || ''), { top: '1200px' });
        return { h, cards, or, note, foot };
      },
      render(o, lt) {
        animateHeadline(o.h, lt, 0.05);
        o.cards.forEach((c, i) => {
          const p = ease.outBack(prog(lt, 0.45 + i * 0.25, 0.55));
          c.style.opacity = clamp(p * 1.5);
          c.style.transform = `scale(${sc(lerp(0.6, 1, p))}) rotate(${(i ? 1 : -1) * (1 - p) * 8 + Math.sin(lt * 2.4 + i) * 1.2}deg)`;
        });
        o.or.style.transform = `scale(${sc(ease.outBack(prog(lt, 1.0, 0.45)))})`;
        fadeUp(o.note, ease.outCubic(prog(lt, 1.3, 0.45)));
        o.foot.style.opacity = ease.outCubic(prog(lt, 1.5, 0.4));
      },
      hills: () => [0, 9, 0],
    },

    // 予約 CTA（任意で特典リボン）
    cta: {
      build(root, s) {
        const top = s.bonus ? { h: 350, bonus: 500, btn: 800, note: 1022, disc: 1105 } : { h: 370, btn: 770, note: 1010, disc: 1130 };
        const h = buildHeadline(root, s.lines, s.size || 'h-l', top.h);
        let bonus = null;
        if (s.bonus) {
          bonus = L.buildBonus(root, s.bonus, 1.2);
          Object.assign(bonus.style, { position: 'absolute', left: '80px', right: '80px', top: `${top.bonus}px` });
          bonus.querySelectorAll('.head,.gift,.sub,.medal').forEach((n) => (n.dataset.text = '1'));
        }
        const btn = el('div', 'cta-btn btn abs', root, { top: `${top.btn}px` });
        btn.dataset.text = 'box';
        btn.innerHTML = `<span>${escapeHtml(s.button)}</span><span class="arrow"><svg width="34" height="34" viewBox="0 0 10 10"><path d="M3 1 L7 5 L3 9" stroke="#b34a05" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
        const cy = top.btn + 88;
        const ripple = el('div', 'abs', root, {
          left: '880px', top: `${cy}px`, width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px',
          borderRadius: '50%', border: '6px solid #fff', opacity: 0,
        });
        const hand = svgEl('svg', { width: 150, height: 180, viewBox: '0 0 100 120' }, root);
        hand.style.position = 'absolute';
        svgEl('use', { href: '#hand' }, hand);
        const note = textEl('div', 'note abs', root, markup(s.note || ''), { top: `${top.note}px` });
        const disc = textEl('div', 'disclaimer disc abs', root, markup(s.disclaimer || ''), { top: `${top.disc}px` });
        return { h, bonus, btn, ripple, hand, note, disc, cy, taps: s.taps || [1.5, 2.8] };
      },
      render(o, lt) {
        animateHeadline(o.h, lt, 0.1);
        if (o.bonus) {
          const p = ease.outBack(prog(lt, 0.4, 0.5));
          o.bonus.style.opacity = clamp(p * 1.5);
          o.bonus.style.transform = `scale(${sc(lerp(0.8, 1, p))})`;
        }
        const bp = ease.outBack(prog(lt, 0.6, 0.5));
        let press = 0, rip = -1;
        o.taps.forEach((tp) => {
          const d = lt - tp;
          if (d >= 0 && d < 0.25) press = Math.max(press, Math.sin((d / 0.25) * Math.PI));
          if (d >= 0.05 && d < 0.7) rip = (d - 0.05) / 0.65;
        });
        const pulse = 1 + Math.sin(lt * 5) * 0.015 * prog(lt, 1.0, 0.3);
        o.btn.style.transform = `scale(${sc(bp * pulse * (1 - press * 0.05))})`;
        o.btn.style.opacity = clamp(bp * 2);
        o.ripple.style.opacity = rip >= 0 ? (1 - rip) * 0.9 : 0;
        o.ripple.style.transform = `scale(${rip >= 0 ? 1 + rip * 7 : 1})`;
        const hp = ease.outCubic(prog(lt, 1.0, 0.45));
        o.hand.style.left = `${lerp(1040, 860, hp)}px`;
        o.hand.style.top = `${lerp(o.cy + 300, o.cy - 8, hp) + press * 14}px`;
        o.hand.style.opacity = clamp(hp * 2);
        const np = ease.outCubic(prog(lt, 0.9, 0.5));
        o.note.style.opacity = np;
        o.note.style.transform = `translateY(${(1 - np) * 20 + Math.sin(lt * 4) * 5 * np}px)`;
        o.disc.style.opacity = ease.outCubic(prog(lt, 0.6, 0.5));
      },
      hills: () => [0, 9, 0],
    },
  };

  // ---------- エントリポイント ----------
  let state = null;
  const FADE_IN = 0.3, FADE_OUT = 0.28;

  window.initReel = async (config, opts = {}) => {
    L.injectDefs();
    const renderParticles = L.buildParticles(document.getElementById('particles'), W, H);
    const renderHills = L.buildHills(document.getElementById('hills'), W, H, 1400);
    if (opts.guides) document.getElementById('guides').classList.add('on');
    const scenesRoot = document.getElementById('scenes');
    const brand = textEl('div', 'brand abs', scenesRoot, escapeHtml(config.brand || ''));
    const scenes = config.scenes.map((s, idx) => {
      const def = SCENES[s.type];
      if (!def) throw new Error(`未知のシーン種別: ${s.type}`);
      const root = el('div', 'scene', scenesRoot);
      return { s, def, root, o: def.build(root, s), last: idx === config.scenes.length - 1 };
    });
    state = { config, scenes, brand, renderParticles, renderHills };
    const photos = config.scenes.flatMap((s) => [s.photo, ...(s.items || []).map((i) => i.photo)]).filter(Boolean);
    await L.loadImages(photos.map(L.assetUrl));
    await L.loadFonts(scenesRoot.innerText);
    return true;
  };

  window.renderAt = (t) => {
    const { scenes, brand, renderParticles, renderHills } = state;
    renderParticles(t);
    brand.style.opacity = ease.outCubic(prog(t, 0.2, 0.5));
    let hill = null;
    for (const sn of scenes) {
      const { start, end } = sn.s;
      if (!(t >= start - 1e-6 && (t < end || sn.last))) {
        sn.root.style.opacity = 0;
        sn.root.style.visibility = 'hidden';
        continue;
      }
      const lt = t - start;
      const pin = ease.outCubic(prog(lt, 0, FADE_IN));
      const pout = sn.last ? 0 : ease.inOutCubic(prog(t, end - FADE_OUT, FADE_OUT));
      sn.root.style.visibility = 'visible';
      sn.root.style.opacity = start === 0 ? 1 - pout : pin * (1 - pout);
      sn.root.style.transform = `translateY(${(start === 0 ? 0 : (1 - pin) * 40) - pout * 40}px)`;
      sn.def.render(sn.o, lt);
      hill = sn.def.hills(lt);
    }
    if (hill) renderHills(...hill);
  };

  // 各シーンが落ち着いた時点（終了0.35秒前）で文字配置を検証
  window.checkLayout = () => {
    const problems = [];
    state.scenes.forEach((sn, i) => {
      window.renderAt(sn.s.end - 0.35);
      problems.push(...L.checkTextIn(sn.root, SAFE, `シーン${i + 1}(${sn.s.type})`));
    });
    problems.push(...L.checkTextIn({ querySelectorAll: () => [state.brand] }, SAFE, 'ブランド表記'));
    return problems;
  };
  window.sceneTimes = () => state.scenes.map((sn) => ({ type: sn.s.type, t: sn.s.end - 0.35 }));
})();
