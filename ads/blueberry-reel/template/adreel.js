/*
 * 既存広告トーンのリール動画テンプレート（1080x1920 / 決定論的レンダリング）。
 * 静止画と同じ AdKit（ad.js）でシーンごとに組版し、時刻 t の純関数としてアニメーションさせる。
 * 禁止語（農園／農業／ブルーベリー）を含む構成は読み込み時にエラーにする。
 */
(() => {
  'use strict';
  const L = window.ReelLib, K = window.AdKit;
  const { clamp, lerp, prog, ease, el, sc } = L;
  const F = K.FORMATS.story;
  const SAFE = { top: 269, bottom: 1920 - 672, left: 64, right: 1080 - 64 };
  const BANNED = ['農園', '農業', 'ブルーベリー'];
  const FADE_IN = 0.3, FADE_OUT = 0.28;
  let state = null;

  window.initReel = async (cfg, opts = {}) => {
    const hit = BANNED.filter((w) => JSON.stringify(cfg).includes(w));
    if (hit.length) throw new Error(`使用禁止語を含んでいます: ${hit.join('、')}`);
    L.injectDefs();
    document.getElementById('sky').style.height = '1720px';
    document.getElementById('forest').style.height = '860px';
    if (opts.guides) document.getElementById('guides').classList.add('on');
    const root = document.getElementById('scenes');
    const scenes = cfg.scenes.map((s, i) => {
      const c = el('div', 'acontent scene', root);
      K.build(c, { ...s.parts, noCta: !s.parts.cta }, 'story');
      return { s, c, last: i === cfg.scenes.length - 1 };
    });
    await L.loadFonts(document.body.innerText);
    await Promise.all(['900 60px "Noto Serif JP"', '900 60px "Noto Sans JP"'].map((f) => document.fonts.load(f, document.body.innerText)));
    await document.fonts.ready;
    for (const sn of scenes) {
      sn.c.style.opacity = 1; sn.c.style.visibility = 'visible';
      K.layout(sn.c, F, 'top');
      sn.kids = [...sn.c.children];
      const btn = sn.c.querySelector('.cta-btn');
      if (btn) {
        const r = btn.getBoundingClientRect();
        sn.btn = btn; sn.cy = r.top + r.height / 2; sn.bx = r.left + r.width;
        sn.ripple = el('div', '', root, { position: 'absolute', width: '40px', height: '40px', marginLeft: '-20px', marginTop: '-20px', borderRadius: '50%', border: '6px solid #fff', opacity: 0, left: `${r.left + r.width - 110}px`, top: `${sn.cy}px` });
        const hand = L.svgEl('svg', { width: 150, height: 180, viewBox: '0 0 100 120' }, root);
        hand.style.position = 'absolute'; L.svgEl('use', { href: '#hand' }, hand); sn.hand = hand;
      }
    }
    state = { cfg, scenes };
    return true;
  };

  window.renderAt = (t) => {
    const { cfg, scenes } = state;
    document.getElementById('sky').style.transform = `scale(${1 + 0.05 * (t / cfg.duration)})`;
    for (const sn of scenes) {
      const { start, end } = sn.s;
      const vis = t >= start - 1e-6 && (t < end || sn.last);
      for (const e of [sn.c, sn.ripple, sn.hand]) if (e) e.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) { sn.c.style.opacity = 0; continue; }
      const lt = t - start;
      const pout = sn.last ? 0 : ease.inOutCubic(prog(t, end - FADE_OUT, FADE_OUT));
      const pin = start === 0 ? 1 : ease.outCubic(prog(lt, 0, FADE_IN));
      sn.c.style.opacity = pin * (1 - pout);
      sn.kids.forEach((k, i) => {
        const p = ease.outBack(prog(lt, 0.08 + 0.3 * i, 0.5));
        const fp = clamp(p * 1.4);
        const isBtn = k === sn.btn;
        let press = 0;
        if (isBtn) (sn.s.taps || [1.5, 2.8]).forEach((tp) => { const d = lt - tp; if (d >= 0 && d < 0.25) press = Math.max(press, Math.sin((d / 0.25) * Math.PI)); });
        k.style.opacity = fp;
        k.style.transform = isBtn
          ? `scale(${sc(lerp(0.7, 1, p) * (1 - press * 0.05) * (1 + Math.sin(lt * 5) * 0.012 * prog(lt, 1.2, 0.3)))})`
          : `translateY(${(1 - p) * 40}px)`;
      });
      if (sn.btn) {
        const taps = sn.s.taps || [1.5, 2.8];
        let rip = -1, press = 0;
        taps.forEach((tp) => { const d = lt - tp; if (d >= 0.05 && d < 0.7) rip = (d - 0.05) / 0.65; if (d >= 0 && d < 0.25) press = Math.max(press, Math.sin((d / 0.25) * Math.PI)); });
        sn.ripple.style.opacity = rip >= 0 ? (1 - rip) * 0.9 : 0;
        sn.ripple.style.transform = `scale(${rip >= 0 ? 1 + rip * 7 : 1})`;
        const hp = ease.outCubic(prog(lt, 1.0, 0.45));
        sn.hand.style.left = `${lerp(1060, sn.bx - 140, hp)}px`;
        sn.hand.style.top = `${lerp(sn.cy + 300, sn.cy - 8, hp) + press * 14}px`;
        sn.hand.style.opacity = clamp(hp * 2) * (1 - pout);
      }
    }
  };

  window.checkLayout = () => {
    const problems = [];
    state.scenes.forEach((sn, i) => {
      window.renderAt(sn.s.end - 0.35);
      problems.push(...L.checkTextIn(sn.c, SAFE, `シーン${i + 1}`));
    });
    return problems;
  };
})();
