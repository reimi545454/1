// 漁船「サト丸」(船首は -x 方向) と周辺の小型船
import * as THREE from 'three';
import { M, mesh, canvasTex } from './util.js';

function hullShape(L, B, k = 1) {
  const s = new THREE.Shape(), r = 0.35 * k;
  s.moveTo(-L * k, 0);
  s.bezierCurveTo((-L + 0.5) * k, 0.55 * B * k, (-L + 1.5) * k, B * k, (-L + 2.4) * k, B * k);
  s.lineTo((L - 0.35) * k, B * k); s.quadraticCurveTo(L * k, B * k, L * k, (B - 0.35) * k);
  s.lineTo(L * k, (-B + 0.35) * k); s.quadraticCurveTo(L * k, -B * k, (L - 0.35) * k, -B * k);
  s.lineTo((-L + 2.4) * k, -B * k); s.bezierCurveTo((-L + 1.5) * k, -B * k, (-L + 0.5) * k, -0.55 * B * k, -L * k, 0);
  return s;
}
function slab(L, B, k, y, h, mat, hole = 0) {
  const s = hullShape(L, B, k);
  if (hole) { const pts = hullShape(L, B, hole).getPoints(24); s.holes.push(new THREE.Path(pts)); }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 18 }); g.rotateX(-Math.PI / 2);
  return mesh(g, mat, { pos: [0, y, 0] });
}

export function createSatoMaru() {
  const boat = new THREE.Group(); const L = 3.2, B = 1.1;
  const white = M(0xf6f8fb, { roughness: 0.4 }), blue = M(0x2a69d6, { roughness: 0.45 }), red = M(0xc8372d, { roughness: 0.55 });
  boat.add(slab(L, B, 0.98, -0.55, 0.75, red));
  boat.add(slab(L, B, 1.006, 0.2, 0.18, blue));
  boat.add(slab(L, B, 1.0, 0.38, 0.52, white));
  boat.add(slab(L, B, 1.0, 0.9, 0.4, white, 0.93));                       // 舷(ふなべり)
  boat.add(mesh(new THREE.ExtrudeGeometry(hullShape(L, B, 0.93), { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2), M(0xb89a72, { roughness: 0.8 }), { pos: [0, 0.9, 0] })); // 甲板
  boat.add(slab(L, B, 1.0, 1.3, 0.05, M(0x2a69d6), 0.93));                // 舷のブルーライン

  // 船名「サト丸」
  const nameTex = canvasTex(512, 170, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#16202e'; c.font = 'bold 140px IPAGothic, "Noto Sans CJK JP", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('サト丸', w / 2, h / 2 + 6); });
  const nameMat = new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  [1, -1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), nameMat); p.position.set(-0.2, 0.86, s * 1.106); if (s < 0) p.rotation.y = Math.PI; boat.add(p); });

  // 操舵室
  const wh = new THREE.Group(); wh.position.set(-0.55, 0.9, 0); boat.add(wh);
  const glass = M(0x58b6e8, { roughness: 0.15, metalness: 0.2, emissive: 0x153a5a, emissiveIntensity: 0.4 });
  wh.add(mesh(new THREE.BoxGeometry(1.6, 1.25, 1.5), white, { pos: [0, 0.625, 0] }));
  wh.add(mesh(new THREE.BoxGeometry(1.62, 0.14, 1.52), blue, { pos: [0, 0.07, 0] }));
  wh.add(mesh(new THREE.BoxGeometry(1.95, 0.09, 1.85), white, { pos: [0, 1.29, 0] }));
  wh.add(mesh(new THREE.BoxGeometry(1.97, 0.045, 1.87), blue, { pos: [0, 1.255, 0] }));
  [-0.38, 0.38].forEach((z) => wh.add(mesh(new THREE.BoxGeometry(0.03, 0.46, 0.55), glass, { pos: [-0.81, 0.82, z] })));
  [-1, 1].forEach((s) => [-0.45, 0.2].forEach((x) => wh.add(mesh(new THREE.BoxGeometry(0.58, 0.46, 0.03), glass, { pos: [x, 0.82, s * 0.76] }))));
  wh.add(mesh(new THREE.BoxGeometry(0.03, 0.8, 0.5), M(0xd9dee6), { pos: [0.81, 0.45, 0] }));          // 後部ドア
  wh.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.2, 8), M(0xd0d5dc), { pos: [0.1, 1.95, 0] }));    // マスト
  wh.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.09), M(0xe9edf2), { pos: [0.1, 2.3, 0] }));            // レーダー
  wh.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4040 }), { pos: [0.1, 2.58, 0] }));
  wh.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.7, 12), M(0x4a5560), { pos: [0.55, 1.65, 0.45] })); // 煙突
  wh.add(mesh(new THREE.TorusGeometry(0.22, 0.065, 10, 24), M(0xff7a1a), { pos: [0.83, 0.75, -0.35], rot: [0, Math.PI / 2, 0] })); // 浮き輪
  // 後部デッキの小物
  boat.add(mesh(new THREE.BoxGeometry(0.5, 0.28, 0.4), M(0xe8eef5), { pos: [2.6, 1.05, 0.55] }));
  boat.add(mesh(new THREE.BoxGeometry(0.5, 0.28, 0.4), M(0x8fd0ee), { pos: [2.6, 1.05, -0.55] }));
  boat.add(mesh(new THREE.BoxGeometry(0.5, 0.28, 0.4), M(0xe8eef5), { pos: [2.6, 1.33, 0.55] }));
  boat.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 18), M(0xd9d2b8), { pos: [1.9, 0.95, -0.7], rot: [Math.PI / 2, 0, 0] }));
  boat.add(mesh(new THREE.BoxGeometry(0.9, 0.34, 0.7), M(0x5d6a76, { metalness: 0.3 }), { pos: [1.35, 1.08, 0.0] })); // エンジンハッチ(第5話で使用)
  [-0.85, 0.85].forEach((z) => { boat.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), M(0x4a5560), { pos: [1.9, 1.5, z] })); });
  // 竿
  [[-0.3, 0], [0.3, 0]].forEach(([z]) => {
    const rod = mesh(new THREE.CylinderGeometry(0.01, 0.02, 1.8, 6), M(0x2b2b33), { pos: [3.15, 1.75, z], rot: [0, 0, -0.5] }); boat.add(rod);
  });
  // 喫水線の泡リング
  const foam = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = hullShape(L, B, 1.07); s.holes.push(new THREE.Path(hullShape(L, B, 0.97).getPoints(24))); return s; })(), { depth: 0.03, bevelEnabled: false, curveSegments: 18 }).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  foam.position.y = 0.0; boat.add(foam); boat.userData.foam = foam;
  boat.userData.deckY = 0.91;
  return boat;
}

export function createMiniBoat(hull, cabin) {
  const g = new THREE.Group(); const L = 2.2, B = 0.8;
  g.add(slab(L, B, 1, -0.4, 0.6, M(hull, { roughness: 0.5 })));
  g.add(slab(L, B, 1, 0.2, 0.35, M(0xf4f6f8), 0.9));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), M(cabin), { pos: [-0.2, 0.95, 0] }));
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.06, 1.1), M(0xf4f6f8), { pos: [-0.2, 1.38, 0] }));
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.3, 0.7), M(0x58b6e8), { pos: [-0.66, 1.0, 0] }));
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), M(0xcccccc), { pos: [-0.1, 1.9, 0] }));
  return g;
}
