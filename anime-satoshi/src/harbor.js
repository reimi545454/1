// 朝の港: 岸壁・防波堤・灯台・街・島
import * as THREE from 'three';
import { M, mesh, canvasTex } from './util.js';

function house(w, h, d, wall, roof) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), M(wall, { roughness: 0.8 }), { pos: [0, h / 2, 0] }));
  const rs = new THREE.Shape(); rs.moveTo(-w / 2 - 0.3, 0); rs.lineTo(w / 2 + 0.3, 0); rs.lineTo(0, w * 0.38); rs.closePath();
  const rg = new THREE.ExtrudeGeometry(rs, { depth: d + 0.5, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.5) / 2);
  g.add(mesh(rg, M(roof, { roughness: 0.7 }), { pos: [0, h, 0] }));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), M(0xfff0b0, { emissive: 0x6a5320, emissiveIntensity: 0.5 }), { pos: [-w * 0.22, h * 0.55, d / 2 + 0.01] }));
  g.add(mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), M(0xfff0b0, { emissive: 0x6a5320, emissiveIntensity: 0.5 }), { pos: [w * 0.22, h * 0.55, d / 2 + 0.01] }));
  g.add(mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), M(0x7a4b2c), { pos: [0, 0.6, d / 2 + 0.02] }));
  return g;
}

export function createHarbor() {
  const g = new THREE.Group();
  const plank = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#b07f4e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#a5744a' : '#b98856'; c.fillRect(0, i * 64, w, 62); c.fillStyle = '#6e4a2c'; c.fillRect(0, i * 64 + 62, w, 3);
      for (let k = 0; k < 14; k++) { c.fillStyle = 'rgba(90,55,30,.25)'; c.fillRect(Math.abs(Math.sin(i * 9 + k * 5.1)) * w, i * 64 + 6 + (k * 11) % 50, 30 + (k * 13) % 50, 2); } }
    c.fillStyle = '#6e4a2c'; c.fillRect(0, 0, 3, h); c.fillRect(128, 0, 3, h);
  }, { repeat: [10, 6] });
  const concrete = M(0xc9ccd2, { roughness: 0.9 });
  // 岸壁 (x:-12..14, z:-0.5..11, 天面 y=0.95)
  const quay = new THREE.Mesh(new THREE.BoxGeometry(26, 2.5, 11.5), [concrete, concrete, M(0xffffff, { map: plank, roughness: 0.85 }), concrete, concrete, concrete]);
  quay.position.set(1, -0.3, 5.25); quay.receiveShadow = true; quay.castShadow = true; g.add(quay);
  // 地面(陸)
  g.add(mesh(new THREE.BoxGeometry(160, 1, 120), M(0x8fbf6a, { roughness: 1 }), { pos: [0, 0.4, 72], shadow: false }));
  // タイヤの防舷材
  for (let x = -10; x <= 12; x += 2.6) g.add(mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 16), M(0x1d1f24), { pos: [x, 0.3, -0.52] }));
  // ビット(係船柱)
  [-3, 1.6, 6.5].forEach((x) => { g.add(mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.32, 12), M(0x3b4450, { metalness: 0.4 }), { pos: [x, 1.11, 0.15] })); g.add(mesh(new THREE.SphereGeometry(0.15, 12, 8), M(0x3b4450, { metalness: 0.4 }), { pos: [x, 1.28, 0.15], scl: [1, 0.6, 1] })); });
  // 荷物・樽・網・ブイ
  [[9.2, 5.5], [10.1, 5.2], [9.6, 6.3]].forEach(([x, z], i) => g.add(mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), M(i % 2 ? 0xc8975a : 0xb88548), { pos: [x, 1.25, z], rot: [0, 0.2 * i, 0] })));
  [[-11, 6.4], [-11.7, 6.9]].forEach(([x, z]) => g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), M(0x2a69d6), { pos: [x, 1.35, z] })));
  g.add(mesh(new THREE.SphereGeometry(0.7, 16, 10), M(0x4c9a6a), { pos: [-10.5, 1.0, 3.2], scl: [1.4, 0.5, 1.0] }));
  [[9.4, 1.2, 0xe63b2e], [9.9, 1.4, 0xffffff], [9.1, 1.6, 0xff9a1f]].forEach(([x, z, c]) => g.add(mesh(new THREE.SphereGeometry(0.28, 14, 10), M(c), { pos: [x, 1.2, z] })));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.35, 0.6), M(0xf2f6fa), { pos: [11.5, 1.12, 5.2] }));
  // 街灯
  [-8.5, 11].forEach((x) => { g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), M(0x39424e), { pos: [x, 2.5, 1.2] })); g.add(mesh(new THREE.SphereGeometry(0.22, 12, 8), M(0xfff2b0, { emissive: 0xffd36a, emissiveIntensity: 0.8 }), { pos: [x, 4.2, 1.2] })); });
  // 防波堤 + 灯台
  g.add(mesh(new THREE.BoxGeometry(3, 2.1, 70), M(0xa9aeb8, { roughness: 0.95 }), { pos: [15.5, 0.05, -23] }));
  const lh = new THREE.Group(); lh.position.set(15.5, 1.1, -54);
  lh.add(mesh(new THREE.CylinderGeometry(1.5, 2.1, 5, 20), M(0xf6f6f6), { pos: [0, 2.5, 0] }));
  lh.add(mesh(new THREE.CylinderGeometry(1.2, 1.5, 3, 20), M(0xd8352b), { pos: [0, 6.5, 0] }));
  lh.add(mesh(new THREE.CylinderGeometry(1.0, 1.2, 2.5, 20), M(0xf6f6f6), { pos: [0, 9.25, 0] }));
  lh.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 16), M(0xffe9a0, { emissive: 0xffc850, emissiveIntensity: 0.9 }), { pos: [0, 11.2, 0] }));
  lh.add(mesh(new THREE.ConeGeometry(1.2, 1.2, 16), M(0xd8352b), { pos: [0, 12.5, 0] }));
  g.add(lh);
  // 街並み(陸側)
  const cols = [[0xf2d08a, 0xc4563b], [0x9cc9e8, 0x34527f], [0xf0a6a0, 0x7a3b2e], [0xf6eed8, 0x3f7f5a], [0xe8c46a, 0x8c3a2a], [0xb9d8a0, 0x4a5a8a]];
  for (let i = 0; i < 12; i++) {
    const [w, r] = cols[i % cols.length]; const h = house(4 + (i % 3), 3 + (i % 4) * 0.5, 4, w, r);
    h.position.set(-16 + i * 3.6 + (i % 2) * 1.2, 0.9, 15 + (i % 3) * 5); h.rotation.y = (i % 2 ? 0.08 : -0.06); g.add(h);
  }
  // 丘・島
  const hill = M(0x6fae62, { roughness: 1 }), hill2 = M(0x4f9a6a, { roughness: 1 });
  [[-70, 14, 110, 22, 0], [10, 20, 130, 28, 1], [80, 16, 110, 20, 0], [-130, 18, 90, 22, 1]].forEach(([x, hh, z, r, k]) => g.add(mesh(new THREE.SphereGeometry(r, 20, 12), k ? hill2 : hill, { pos: [x, hh - r * 0.45, z], scl: [1.8, 0.8, 1], shadow: false })));
  [[70, -118, 28, 0], [-130, -170, 36, 1], [150, -210, 40, 0], [30, -260, 50, 1]].forEach(([x, z, r, k]) => g.add(mesh(new THREE.SphereGeometry(r, 20, 12), k ? hill2 : hill, { pos: [x, -r * 0.35, z], scl: [1.6, 0.55, 1], shadow: false })));
  return g;
}
