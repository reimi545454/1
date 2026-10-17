(() => {
  'use strict';

  const CATEGORY_LABELS = { anime: 'アニメ', manga: '漫画', movie: '映画', drama: 'ドラマ', game: 'ゲーム' };
  const JAPAN_BOUNDS = L.latLngBounds([20.0, 122.0], [46.0, 154.5]);
  const STORAGE_KEY = 'seichi-map:visited:v1';

  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, v);
      else node[k] = v;
    }
    node.append(...children);
    return node;
  };

  // --- 訪問済み記録(localStorage が使えない環境でも動作させる) ---
  const visited = (() => {
    let set = new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(raw)) set = new Set(raw.filter((v) => typeof v === 'string'));
    } catch (_) { /* 破損・無効時は空から開始 */ }
    const save = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); } catch (_) { /* 保存不可は無視 */ }
    };
    return {
      has: (id) => set.has(id),
      toggle: (id) => { set.has(id) ? set.delete(id) : set.add(id); save(); return set.has(id); },
    };
  })();

  // --- 地図 ---
  const map = L.map('map', {
    minZoom: 4, maxZoom: 18,
    maxBounds: JAPAN_BOUNDS, maxBoundsViscosity: 0.8,
    zoomControl: true,
  }).setView([36.2, 138.0], 5);

  const gsiAttr = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>';
  const baseLayers = {
    '地理院 標準': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', { attribution: gsiAttr, maxZoom: 18 }),
    '地理院 淡色': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', { attribution: gsiAttr, maxZoom: 18 }),
    '地理院 写真': L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', { attribution: gsiAttr, maxZoom: 18 }),
    'OpenStreetMap': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }),
  };
  baseLayers['地理院 標準'].addTo(map);
  L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);

  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
  map.addLayer(cluster);

  // --- 状態 ---
  let spots = [];
  const markers = new Map();
  let origin = null; // 現在地 {lat,lng}
  let selectedId = null;

  const haversineKm = (a, b) => {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };

  const pinIcon = (s) => L.divIcon({
    className: '',
    html: `<div class="pin${visited.has(s.id) ? ' is-visited' : ''}" data-cat="${s.category}"></div>`,
    iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24],
  });

  const popupContent = (s) => {
    const visitBtn = el('button', { type: 'button', text: visited.has(s.id) ? '訪問済みを解除' : '訪問済みにする' });
    visitBtn.addEventListener('click', () => { visited.toggle(s.id); refresh(); openSpot(s.id, false); });
    const shareBtn = el('button', { type: 'button', text: 'リンクをコピー' });
    shareBtn.addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}#${s.id}`;
      try { await navigator.clipboard.writeText(url); shareBtn.textContent = 'コピーしました'; }
      catch (_) { prompt('このリンクをコピーしてください', url); }
    });
    return el('div', { class: 'popup' },
      el('h2', { text: s.name }),
      el('p', {}, el('span', { class: 'badge', 'data-cat': s.category, text: CATEGORY_LABELS[s.category] }), ` ${s.work}`),
      el('p', { text: `${s.prefecture} / ${s.desc}` }),
      el('div', { class: 'popup__actions' },
        el('a', { href: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`, target: '_blank', rel: 'noopener', text: '経路・地図アプリ' }),
        visitBtn, shareBtn));
  };

  const openSpot = (id, pan = true) => {
    const s = spots.find((x) => x.id === id);
    const m = markers.get(id);
    if (!s || !m) return;
    selectedId = id;
    history.replaceState(null, '', `#${id}`);
    const show = () => { m.setPopupContent(popupContent(s)); m.openPopup(); };
    if (pan) map.setView([s.lat, s.lng], Math.max(map.getZoom(), 14), { animate: true });
    cluster.zoomToShowLayer(m, show);
    renderList();
  };

  // --- フィルタ・描画 ---
  const filtered = () => {
    const q = $('q').value.trim().toLowerCase();
    const cat = $('category').value, pref = $('prefecture').value, vis = $('visited').value;
    let out = spots.filter((s) =>
      (!cat || s.category === cat) &&
      (!pref || s.prefecture === pref) &&
      (!vis || (vis === 'yes') === visited.has(s.id)) &&
      (!q || `${s.name} ${s.work} ${s.prefecture} ${s.desc}`.toLowerCase().includes(q)));
    if (origin) {
      out = out.map((s) => ({ ...s, _km: haversineKm(origin, s) })).sort((a, b) => a._km - b._km);
    }
    return out;
  };

  const renderList = () => {
    const items = filtered();
    $('summary').textContent = `${items.length} / ${spots.length} 件${origin ? '(現在地から近い順)' : ''}`;
    const list = $('list');
    list.replaceChildren();
    if (!items.length) { list.append(el('li', { class: 'empty', text: '条件に合うスポットがありません。' })); return; }
    for (const s of items) {
      const meta = el('div', { class: 'item__meta' },
        el('span', { class: 'badge', 'data-cat': s.category, text: CATEGORY_LABELS[s.category] }),
        el('span', { text: s.prefecture }));
      if (s._km != null) meta.append(el('span', { text: `約${s._km < 10 ? s._km.toFixed(1) : Math.round(s._km)}km` }));
      const btn = el('button', { type: 'button', class: `item${visited.has(s.id) ? ' is-visited' : ''}`, 'aria-current': String(s.id === selectedId) },
        el('div', { class: 'item__work', text: s.work }),
        el('div', { class: 'item__name', text: s.name }), meta);
      btn.addEventListener('click', () => { openSpot(s.id); if (matchMedia('(max-width:760px)').matches) setCollapsed(true); });
      list.append(el('li', {}, btn));
    }
  };

  const renderMarkers = () => {
    cluster.clearLayers();
    const ids = new Set(filtered().map((s) => s.id));
    for (const s of spots) {
      if (!ids.has(s.id)) continue;
      const m = markers.get(s.id);
      m.setIcon(pinIcon(s));
      cluster.addLayer(m);
    }
  };

  const refresh = () => { renderMarkers(); renderList(); };

  // --- 現在地 ---
  $('locate').addEventListener('click', () => {
    if (origin) { origin = null; $('locate').textContent = '現在地周辺'; refresh(); return; }
    if (!navigator.geolocation) { alert('このブラウザは位置情報に対応していません。'); return; }
    $('locate').disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      $('locate').disabled = false;
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!JAPAN_BOUNDS.contains([here.lat, here.lng])) { alert('現在地が日本国外のため、近い順表示は利用できません。'); return; }
      origin = here; $('locate').textContent = '現在地を解除';
      map.setView([here.lat, here.lng], 10); refresh();
    }, () => { $('locate').disabled = false; alert('現在地を取得できませんでした。位置情報の許可を確認してください。'); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  });

  // --- モバイルのパネル開閉 ---
  const setCollapsed = (v) => {
    $('panel').classList.toggle('is-collapsed', v);
    $('panelToggle').setAttribute('aria-expanded', String(!v));
    setTimeout(() => map.invalidateSize(), 50);
  };
  $('panelToggle').addEventListener('click', () => setCollapsed(!$('panel').classList.contains('is-collapsed')));

  // --- 初期化 ---
  const fillSelect = (sel, values, label = (v) => v) => {
    for (const v of values) sel.append(el('option', { value: v, text: label(v) }));
  };

  const init = async () => {
    let data;
    try {
      const res = await fetch('data/spots.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch (e) {
      $('summary').textContent = 'データの読み込みに失敗しました。時間をおいて再読み込みしてください。';
      return;
    }
    // 防御的チェック: 不正・国外の座標は表示しない
    spots = (data.spots || []).filter((s) =>
      s && typeof s.id === 'string' && Number.isFinite(s.lat) && Number.isFinite(s.lng) && JAPAN_BOUNDS.contains([s.lat, s.lng]));

    fillSelect($('category'), Object.keys(CATEGORY_LABELS).filter((c) => spots.some((s) => s.category === c)), (c) => CATEGORY_LABELS[c]);
    fillSelect($('prefecture'), [...new Set(spots.map((s) => s.prefecture))]);

    for (const s of spots) {
      const m = L.marker([s.lat, s.lng], { icon: pinIcon(s), title: `${s.work} - ${s.name}`, keyboard: true });
      m.bindPopup('', { maxWidth: 280 });
      m.on('click', () => { m.setPopupContent(popupContent(s)); selectedId = s.id; history.replaceState(null, '', `#${s.id}`); renderList(); });
      markers.set(s.id, m);
    }
    for (const id of ['q', 'category', 'prefecture', 'visited']) $(id).addEventListener('input', refresh);
    refresh();

    const hashId = decodeURIComponent(location.hash.slice(1));
    if (hashId) openSpot(hashId);
    if (matchMedia('(max-width:760px)').matches && !hashId) setCollapsed(true);
  };

  window.addEventListener('hashchange', () => { const id = decodeURIComponent(location.hash.slice(1)); if (id && id !== selectedId) openSpot(id); });
  init();
})();
