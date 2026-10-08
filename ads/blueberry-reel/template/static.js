/*
 * 静止画クリエイティブテンプレート。
 * 構成JSONの design と format（story / feed / square）から1枚を組み立てる。
 * コンテンツは一旦自然サイズで組み、利用可能領域に収まるよう自動縮小する
 * （縮小率が下限を下回る場合はエラーにして、コピー側の見直しを促す）。
 */
(() => {
  'use strict';
  const L = window.ReelLib;
  const { el, markup, escapeHtml, assetUrl } = L;

  // safe: 文字を置ける縦方向の範囲（ストーリー/リールは上14%・下35%がUI領域）
  const FORMATS = {
    story:  { W: 1080, H: 1920, top: 285, bottom: 1920 - 672, side: 64, hills: 1400, minScale: 0.8 },
    feed:   { W: 1080, H: 1350, top: 60,  bottom: 1350 - 150, side: 60, hills: 1210, minScale: 0.8 },
    square: { W: 1080, H: 1080, top: 50,  bottom: 1080 - 120, side: 60, hills: 960,  minScale: 0.7 },
  };
  const BONUS = { medal: '10月\n限定', head: '説明会参加で[特典プレゼント]', gift: 'お米 または BISSスキンケア', sub: 'お好きな特典を一つお選びいただけます。' };
  const DISC = '※農園オーナー制度への参加には費用がかかります。\n収益を保証するものではありません。詳細は説明会でご確認ください。';

  const t = (tag, cls, parent, html, fmt) => {
    const e = el(tag, cls, parent);
    e.innerHTML = html;
    e.dataset.text = '1';
    return e;
  };
  const headline = (p, lines, size) => {
    const h = el('div', `hd ${size || ''}`, p);
    lines.forEach((l) => { const ln = el('span', 'ln', h); ln.innerHTML = markup(l); ln.dataset.text = '1'; });
    return h;
  };
  const photo = (p, name, tag, h) => {
    const d = el('div', 'ph photo', p, { backgroundImage: `url(${assetUrl(name)})`, border: '10px solid #fff' });
    if (h) d.style.height = `${h}px`;
    if (tag) t('div', 'tag', d, escapeHtml(tag));
    return d;
  };
  const cta = (p, label) => {
    const b = el('div', 'cta-btn', p);
    b.dataset.text = 'box';
    b.innerHTML = `<span>${escapeHtml(label)}</span><span class="arrow"><svg width="30" height="30" viewBox="0 0 10 10"><path d="M3 1 L7 5 L3 9" stroke="#b34a05" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    return b;
  };
  const bonus = (p) => {
    const b = L.buildBonus(p, BONUS, 1.1);
    b.style.width = '100%';
    b.querySelectorAll('.head,.gift,.sub,.medal').forEach((n) => (n.dataset.text = '1'));
    return b;
  };
  const chips = (p, items) => {
    const r = el('div', 'row', p);
    items.forEach((it) => {
      const c = el('div', 'chip', r);
      c.innerHTML = L.svgIcon(`ic-${it.icon}`, 76);
      t('div', '', c, markup(it.text));
    });
  };

  const DESIGNS = {
    // A：未経験からオーナーに
    hero(p, c, f) {
      t('div', 'pill kicker', p, 'ブルーベリー農園オーナー募集');
      headline(p, ['農業未経験から', '[[ブルーベリー]]', '農園オーナーに。']);
      if (f !== 'square') photo(p, 'photo-farm-new.jpg', '千葉の農園', f === 'story' ? 220 : 340);
      chips(p, [{ icon: 'sprout', text: '栽培・管理は\nプロにおまかせ' }, { icon: 'people', text: '農業未経験でも\nはじめられる' }, { icon: 'land', text: '地域の農地と\n雇用に貢献' }]);
      cta(p, '説明会を予約する');
      t('div', 'disclaimer', p, markup(DISC));
    },
    // B：耕作放棄地の再生
    revive(p, c, f) {
      t('div', 'pill kicker', p, '耕作放棄地、ご存じですか？');
      headline(p, ['その畑、もう一度', '[[実らせる]]。']);
      photo(p, 'photo-farm-new.jpg', '耕作放棄地 → ブルーベリー農園', f === 'square' ? 300 : 380);
      t('div', 'sub', p, '千葉の耕作放棄地を農園として再生。<br>地域の雇用にもつながる取り組みです。');
      cta(p, '説明会を予約する');
      t('div', 'disclaimer', p, markup(DISC));
    },
    // C：実績
    stats(p, c, f) {
      t('div', 'pill kicker', p, 'ブルーベリー農園オーナー募集');
      headline(p, ['農園オーナーって', '[[実際どうなの？]]']);
      const r = el('div', 'row', p);
      [['農園数', 195, '農園'], ['オーナー社数', 135, '社'], ['事業の歩み', 6, '期目']].forEach(([lb, v, u]) => {
        const tile = el('div', 'tile', r);
        t('div', 'lb', tile, lb);
        t('div', 'v', tile, `${v}<span>${u}</span>`);
      });
      if (f === 'feed') photo(p, 'photo-farm-work.jpg', null, 240);
      t('div', 'sub', p, '栽培・管理から販路まで、NeweZが一貫サポート');
      cta(p, '説明会を予約する');
      t('div', 'disclaimer', p, markup(`※2026年10月時点の自社資料に基づく\n${DISC}`));
    },
    // D：特典
    gift(p, c, f) {
      t('div', 'pill kicker', p, '10月限定');
      headline(p, ['説明会参加で', '[[特典プレゼント]]']);
      const r = el('div', 'row', p);
      const g1 = el('div', 'gift', r); g1.innerHTML = `<svg width="190" height="209" viewBox="0 0 200 220"><use href="#gift-rice"/></svg>`; t('div', '', g1, 'お米');
      t('div', 'or', r, 'or');
      const g2 = el('div', 'gift', r); g2.innerHTML = `<svg width="190" height="209" viewBox="0 0 200 220"><use href="#gift-skincare"/></svg>`; t('div', '', g2, 'BISSスキンケア');
      t('div', 'sub', p, 'お好きな特典を<span class="pain-red">1つ</span>お選びいただけます');
      cta(p, '説明会を予約する');
      t('div', 'disclaimer', p, markup(`※特典内容・数量・期間は予告なく変更となる場合があります。\n${DISC}`));
    },
    // E：「何かしたい」共感 → ブルーベリー農園という関わり方
    pain(p, c, f) {
      t('div', 'pill kicker', p, '地方のために何かしたい人へ');
      headline(p, ['何かしたい。', '{{でも、何から}}', '{{始めればいい？}}'], 'm');
      t('div', 'sub', p, '人・仕事・土地・住まい。<br>地域の資源を活かす<span class="pain-red">関わり方</span>があります。');
      if (f === 'feed') photo(p, 'photo-farm-new.jpg', 'ブルーベリー農園オーナー', f === 'story' ? 200 : 300);
      bonus(p);
      cta(p, '説明会を予約する');
      t('div', 'disclaimer', p, markup(DISC));
    },
  };

  let ctx = null;
  window.initStatic = async (config, format, opts = {}) => {
    const F = FORMATS[format];
    if (!F) throw new Error(`未知のフォーマット: ${format}`);
    const build = DESIGNS[config.design];
    if (!build) throw new Error(`未知のデザイン: ${config.design}`);
    document.documentElement.style.cssText = document.body.style.cssText = `width:${F.W}px;height:${F.H}px`;
    const stage = document.getElementById('stage');
    stage.style.width = `${F.W}px`; stage.style.height = `${F.H}px`;
    L.injectDefs();
    const deco = document.getElementById('deco');
    deco.setAttribute('width', F.W); deco.setAttribute('height', F.H);
    L.buildParticles(deco, F.W, F.H, 12)(3.1);
    L.buildHills(deco, F.W, F.H, F.hills)(0, 9, 0);
    const content = document.getElementById('content');
    build(content, config, format);
    if (opts.guides && format === 'story') {
      document.getElementById('guides').className = 'layer on';
      document.getElementById('guides').innerHTML = '<div class="g" style="top:0;height:269px"></div><div class="g" style="bottom:0;height:672px"></div>';
    }
    await L.loadImages([...new Set([...document.querySelectorAll('[style*="url("]')].map((n) => n.style.backgroundImage.slice(5, -2)))]);
    await L.loadFonts(document.body.innerText);
    // 自動フィット：利用可能領域の中央に、必要なら縮小して配置
    const avail = F.bottom - F.top;
    const natural = content.getBoundingClientRect().height;
    const scale = Math.min(1, avail / natural);
    content.style.transform = `scale(${scale})`;
    content.style.top = `${F.top + Math.max(0, (avail - natural * scale) / 2)}px`;
    ctx = { F, scale, natural, avail };
    return { scale, natural, avail };
  };

  window.checkStatic = () => {
    const { F, scale } = ctx;
    const problems = [];
    if (scale < F.minScale) problems.push(`コンテンツの縮小率が ${scale.toFixed(2)}（下限 ${F.minScale}）: 文字が小さくなりすぎるためコピーを短くしてください`);
    problems.push(...L.checkTextIn(document.getElementById('content'),
      { top: F.top, bottom: F.bottom, left: F.side, right: F.W - F.side }, '静止画'));
    return problems;
  };
})();
