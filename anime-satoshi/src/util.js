// 共通ユーティリティ(補間・イージング・マテリアル生成)
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const sm = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const easeOut = (u) => 1 - (1 - u) * (1 - u);
export const easeIO = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

// キーフレーム補間(Hermite / カーディナル): keys = [[t,[...値]], ...]
export function kf(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1].slice();
  if (t >= keys[n - 1][0]) return keys[n - 1][1].slice();
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1];
  const h = t1 - t0, s = (t - t0) / h;
  const m0 = i > 0 ? p0.map((v, k) => (p1[k] - keys[i - 1][1][k]) / (t1 - keys[i - 1][0])) : p0.map((v, k) => (p1[k] - v) / h);
  const m1 = i + 2 < n ? p1.map((v, k) => (keys[i + 2][1][k] - p0[k]) / (keys[i + 2][0] - t0)) : p1.map((v, k) => (v - p0[k]) / h);
  const s2 = s * s, s3 = s2 * s;
  return p0.map((v, k) => (2 * s3 - 3 * s2 + 1) * v + (s3 - 2 * s2 + s) * h * m0[k] + (-2 * s3 + 3 * s2) * p1[k] + (s3 - s2) * h * m1[k]);
}

// 決定論的な擬似乱数(同じiなら常に同じ値 → 再レンダリングで結果が変わらない)
export const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o });

export function mesh(geo, mat, { pos, rot, scl, shadow = true, recv = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scl) (typeof scl === 'number') ? m.scale.setScalar(scl) : m.scale.set(...scl);
  m.castShadow = shadow; m.receiveShadow = recv;
  return m;
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  return t;
}
