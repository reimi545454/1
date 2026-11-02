// 水しぶき・航跡・カモメ(すべて時刻tからの解析的計算 → 任意フレームを独立に再現できる)
import * as THREE from 'three';
import { M, mesh, rnd, clamp } from './util.js';
import { waveH } from './sea.js';

export function createSpray(boatXAt, speedAt, t0) {
  const N = 220, geo = new THREE.SphereGeometry(1, 6, 5), mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(geo, mat, N); inst.frustumCulled = false;
  const wakeGeo = new THREE.CircleGeometry(1, 14); wakeGeo.rotateX(-Math.PI / 2);
  const W = 160, wake = new THREE.InstancedMesh(wakeGeo, mat, W); wake.frustumCulled = false;
  const d = new THREE.Object3D(), DT = 0.035;
  const g = new THREE.Group(); g.add(inst, wake);
  g.userData.update = (t) => {
    for (let i = 0; i < N; i++) {
      const Ts = t0 + i * DT * 1.0, age = t - Ts, sp = speedAt(Ts), life = 0.9;
      if (age < 0 || age > life || sp < 0.8) { d.scale.setScalar(0); d.position.set(0, -50, 0); }
      else {
        const side = rnd(i, 1) < 0.5 ? -1 : 1, bx = boatXAt(Ts) - 3.0, vz = side * (0.8 + rnd(i, 2) * 1.8), vy = 2.2 + rnd(i, 3) * 2.2 + sp * 0.3, vx = -0.4 - rnd(i, 4) * 0.8;
        d.position.set(bx + vx * age - sp * age * 0.0, 0.25 + vy * age - 4.9 * age * age, -2.1 + side * 0.4 + vz * age);
        d.scale.setScalar((0.05 + rnd(i, 5) * 0.09) * clamp(1 - age / life) * clamp(sp / 2));
      }
      d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    for (let j = 0; j < W; j++) {
      const Ts = t0 + j * 0.09, age = t - Ts, life = 3.2, sp = speedAt(Ts);
      if (age < 0 || age > life || sp < 0.4) { d.scale.setScalar(0); d.position.set(0, -50, 0); }
      else {
        const x = boatXAt(Ts) + 3.1, z = -2.1 + (rnd(j, 7) - 0.5) * 1.6 * (0.5 + age * 0.35), grow = 0.35 + age * 0.5;
        d.position.set(x, waveH(x, z, t) + 0.045, z); d.scale.set(grow * (0.7 + rnd(j, 8) * 0.6), 1, grow * (0.7 + rnd(j, 9) * 0.6) * 0.8);
        d.scale.multiplyScalar(clamp(1 - age / life) * clamp(sp / 1.5));
      }
      d.rotation.set(0, rnd(j, 6) * 6, 0); d.updateMatrix(); wake.setMatrixAt(j, d.matrix);
    }
    wake.instanceMatrix.needsUpdate = true;
  };
  return g;
}

function gullMesh() {
  const g = new THREE.Group(), w = M(0xffffff, { roughness: 0.6 }), grey = M(0xcfd6de, { roughness: 0.6 });
  g.add(mesh(new THREE.SphereGeometry(0.13, 12, 8), w, { scl: [1, 0.62, 1.9], shadow: false }));
  g.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), w, { pos: [0, 0.04, 0.26], shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(0.022, 0.09, 6), M(0xffa21a), { pos: [0, 0.03, 0.34], rot: [Math.PI / 2, 0, 0], shadow: false }));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.01, 0.12), grey, { pos: [0, 0, -0.3], shadow: false }));
  const wing = (s) => { const p = new THREE.Group(); p.add(mesh(new THREE.BoxGeometry(0.62, 0.012, 0.2), grey, { pos: [s * 0.31, 0, 0], shadow: false })); p.add(mesh(new THREE.BoxGeometry(0.2, 0.014, 0.17), M(0x39424e), { pos: [s * 0.62, 0, 0], shadow: false })); return p; };
  const wl = wing(-1), wr = wing(1); g.add(wl, wr); g.userData = { wl, wr };
  return g;
}
export function createGulls(n = 6) {
  const g = new THREE.Group(), list = [];
  for (let i = 0; i < n; i++) { const m = gullMesh(); m.scale.setScalar(1.5); g.add(m); list.push(m); }
  g.userData.update = (t, harbor, boatPos, follow) => list.forEach((m, i) => {
    const a = t * (0.45 + 0.05 * i) + i * 1.9, r = 5 + i * 1.7, f = clamp(follow);
    const cx = harbor.x + (boatPos.x - 2 + i * 0.8 - harbor.x) * f, cz = harbor.z + (boatPos.z + 1 - harbor.z) * f, cy = (7 + (i % 3) * 1.6) * (1 - f) + (4.2 + (i % 3) * 0.7) * f;
    const rr = r * (1 - f * 0.7);
    const p = new THREE.Vector3(cx + Math.cos(a) * rr, cy + Math.sin(t * 0.9 + i) * 0.5, cz + Math.sin(a) * rr * 0.6);
    const a2 = a + 0.01, q = new THREE.Vector3(cx + Math.cos(a2) * rr, 0, cz + Math.sin(a2) * rr * 0.6);
    m.position.copy(p); m.rotation.y = Math.atan2(q.x - p.x, q.z - p.z); m.rotation.z = -0.25;
    const fl = Math.sin(t * 7 + i * 2) * 0.55; m.userData.wl.rotation.z = -fl; m.userData.wr.rotation.z = fl;
  });
  return g;
}
