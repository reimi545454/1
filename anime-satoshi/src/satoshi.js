// 主人公サトシ: パラメトリック3Dモデル(全シーンで同一モデル・同一配色を使用)
import * as THREE from 'three';
import { M, mesh, canvasTex, clamp } from './util.js';

export const COL = { skin: 0xffcfa6, yellow: 0xffd51c, orange: 0xff7418, blue: 0x2a69d6, capBlue: 0x2f6fd8, white: 0xffffff, hair: 0x3a2417, boot: 0x2358c4 };

export function basePose() {
  return { hipsY: 0, lean: 0, twist: 0, headRx: 0, headRy: 0, headRz: 0, aN: [0, -0.1], eN: [0, 0], aP: [0, 0.1], eP: [0, 0], lN: [0, 0], lP: [0, 0] };
}
export function baseExpr() {
  return { smile: 0.7, open: 0, wide: 1, browUp: 0, tilt: 0, eyeOpen: 1, eyeWide: 0, joy: 0, gx: 0, gy: 0, blush: 0.45 };
}

function fishTex() {
  return canvasTex(256, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(112, 80, 84, 48, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(186, 80); c.lineTo(246, 28); c.quadraticCurveTo(222, 80, 246, 132); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(80, 36); c.quadraticCurveTo(110, 4, 140, 34); c.closePath(); c.fill();
    c.fillStyle = '#2f6fd8'; c.beginPath(); c.arc(52, 70, 9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2f6fd8'; c.lineWidth = 6; c.beginPath(); c.moveTo(150, 55); c.quadraticCurveTo(160, 80, 150, 105); c.stroke();
  });
}

export function makeSatoshi() {
  const root = new THREE.Group();
  const S = { root };
  const skin = M(COL.skin, { roughness: 0.75 }), yellow = M(COL.yellow, { roughness: 0.55 }), orange = M(COL.orange, { roughness: 0.5 });
  const blue = M(COL.boot, { roughness: 0.4 }), hairM = M(COL.hair, { roughness: 0.85 });

  // ---- 腰・脚 ----
  const hips = new THREE.Group(); hips.position.y = 0.42; root.add(hips); S.hips = hips;
  const mkLeg = (x) => {
    const hip = new THREE.Group(); hip.position.set(x, 0, 0);
    hip.add(mesh(new THREE.CapsuleGeometry(0.09, 0.14, 6, 12), yellow, { pos: [0, -0.1, 0] }));
    const knee = new THREE.Group(); knee.position.y = -0.21; hip.add(knee);
    knee.add(mesh(new THREE.CapsuleGeometry(0.085, 0.06, 6, 12), yellow, { pos: [0, -0.04, 0] }));
    knee.add(mesh(new THREE.CylinderGeometry(0.1, 0.108, 0.2, 16), blue, { pos: [0, -0.1, 0] }));
    knee.add(mesh(new THREE.SphereGeometry(0.108, 14, 10), blue, { pos: [0, -0.185, 0.045], scl: [1, 0.62, 1.35] }));
    knee.add(mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 16), M(0xffffff), { pos: [0, -0.02, 0], rot: [Math.PI / 2, 0, 0] }));
    hips.add(hip); return { hip, knee };
  };
  S.legN = mkLeg(-0.105); S.legP = mkLeg(0.105);

  // ---- 胴体(つなぎ+ライフジャケット) ----
  const torso = new THREE.Group(); torso.position.y = 0.09; hips.add(torso); S.torso = torso;
  torso.add(mesh(new THREE.CapsuleGeometry(0.185, 0.22, 8, 16), yellow, { pos: [0, 0.2, 0] }));
  const vest = mesh(new THREE.CapsuleGeometry(0.205, 0.12, 8, 16), orange, { pos: [0, 0.25, 0.005], scl: [1, 1, 0.92] }); torso.add(vest);
  torso.add(mesh(new THREE.BoxGeometry(0.035, 0.34, 0.02), yellow, { pos: [0, 0.25, 0.19] }));          // ファスナー
  torso.add(mesh(new THREE.TorusGeometry(0.207, 0.018, 6, 24), M(0x2b2b33), { pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0], scl: [1, 0.92, 1] })); // ベルト
  [-0.09, 0.09].forEach((x) => torso.add(mesh(new THREE.BoxGeometry(0.05, 0.1, 0.015), M(0xe9edf2, { metalness: 0.3, roughness: 0.3 }), { pos: [x, 0.31, 0.19] })));
  torso.add(mesh(new THREE.TorusGeometry(0.13, 0.055, 8, 20), orange, { pos: [0, 0.46, 0], rot: [Math.PI / 2, 0, 0] })); // 襟

  // ---- 腕 ----
  const mkArm = (x) => {
    const sh = new THREE.Group(); sh.position.set(x, 0.43, 0);
    sh.add(mesh(new THREE.SphereGeometry(0.075, 12, 10), orange));
    sh.add(mesh(new THREE.CapsuleGeometry(0.062, 0.12, 6, 12), yellow, { pos: [0, -0.1, 0] }));
    const el = new THREE.Group(); el.position.y = -0.2; sh.add(el);
    el.add(mesh(new THREE.CapsuleGeometry(0.057, 0.08, 6, 12), yellow, { pos: [0, -0.075, 0] }));
    el.add(mesh(new THREE.TorusGeometry(0.058, 0.012, 6, 14), M(0xffffff), { pos: [0, -0.15, 0], rot: [Math.PI / 2, 0, 0] }));
    el.add(mesh(new THREE.SphereGeometry(0.078, 14, 12), skin, { pos: [0, -0.2, 0] }));
    torso.add(sh); return { sh, el };
  };
  S.armN = mkArm(-0.255); S.armP = mkArm(0.255);

  // ---- 頭 ----
  const head = new THREE.Group(); head.position.y = 0.47; torso.add(head); S.head = head;
  const hg = new THREE.Group(); hg.position.y = 0.27; head.add(hg);
  hg.add(mesh(new THREE.SphereGeometry(0.31, 40, 28), skin, { scl: [1, 0.97, 0.98] }));
  [-1, 1].forEach((s) => hg.add(mesh(new THREE.SphereGeometry(0.052, 12, 10), skin, { pos: [s * 0.3, -0.03, 0], scl: [0.6, 1, 1] })));
  // 髪
  hg.add(mesh(new THREE.SphereGeometry(0.305, 24, 18), hairM, { pos: [0, 0.03, -0.07] }));
  const tufts = new THREE.Group(); hg.add(tufts); S.tufts = tufts;
  [[-0.12, -0.08, -0.27, 0.1], [0.12, -0.08, -0.27, 0.1], [0, -0.12, -0.29, 0.11], [-0.24, 0.0, -0.1, 0.09], [0.24, 0.0, -0.1, 0.09]].forEach(([x, y, z, r]) =>
    tufts.add(mesh(new THREE.SphereGeometry(r, 10, 8), hairM, { pos: [x, y, z], scl: [1, 1.2, 1] })));
  // 前髪(キャップの下からのぞく)
  [[-0.2, 0.185, 0.2, 0.075], [-0.1, 0.2, 0.25, 0.07], [0.02, 0.205, 0.255, 0.07], [0.13, 0.2, 0.245, 0.07], [0.22, 0.18, 0.19, 0.075]].forEach(([x, y, z, r]) =>
    hg.add(mesh(new THREE.SphereGeometry(r, 10, 8), hairM, { pos: [x, y, z], scl: [1.2, 1, 0.8] })));
  [-1, 1].forEach((s) => hg.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), hairM, { pos: [s * 0.275, 0.1, 0.07], scl: [0.7, 1.4, 1] })));

  // 目(白目・黒目・ハイライト)
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff }), hl = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const iris = M(0x3b2314, { roughness: 0.3 }), pupil = new THREE.MeshBasicMaterial({ color: 0x120a06 });
  S.eye = {}; S.brow = {}; S.joyEye = {};
  [['N', -1], ['P', 1]].forEach(([k, s]) => {
    const g = new THREE.Group(); g.position.set(s * 0.118, -0.025, 0.262); hg.add(g);
    g.rotation.y = s * 0.28;
    g.add(mesh(new THREE.SphereGeometry(0.09, 20, 16), M(0xffffff, { roughness: 0.4 }), { scl: [0.9, 1.2, 0.38], shadow: false }));
    const ir = new THREE.Group(); ir.position.z = 0.012; g.add(ir);
    ir.add(mesh(new THREE.SphereGeometry(0.078, 20, 16), iris, { scl: [0.86, 1.12, 0.42], pos: [0, 0, 0.0], shadow: false }));
    ir.add(mesh(new THREE.SphereGeometry(0.04, 14, 12), pupil, { scl: [0.9, 1.15, 0.4], pos: [0, 0, 0.02], shadow: false }));
    ir.add(mesh(new THREE.SphereGeometry(0.027, 10, 8), hl, { pos: [0.025, 0.04, 0.04], scl: [1, 1, 0.4], shadow: false }));
    ir.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), hl, { pos: [-0.028, -0.035, 0.04], scl: [1, 1, 0.4], shadow: false }));
    S.eye[k] = { g, ir };
    const arc = mesh(new THREE.TorusGeometry(0.058, 0.014, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2a160b }), { pos: [s * 0.118, -0.03, 0.285], shadow: false });
    arc.rotation.y = s * 0.28; hg.add(arc); S.joyEye[k] = arc; arc.visible = false;
    const b = mesh(new THREE.CapsuleGeometry(0.014, 0.075, 4, 8), hairM, { pos: [s * 0.118, 0.105, 0.272], shadow: false });
    hg.add(b); S.brow[k] = b; b.userData.side = s;
  });
  // 鼻・頬
  hg.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), M(0xf0a888), { pos: [0, -0.07, 0.3], shadow: false }));
  S.blush = [];
  [-1, 1].forEach((s) => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), new THREE.MeshBasicMaterial({ color: 0xff7f86, transparent: true, opacity: 0.5, depthWrite: false }));
    b.position.set(s * 0.2, -0.085, 0.215); b.rotation.y = s * 0.9; hg.add(b); S.blush.push(b);
  });
  // 口
  const mouth = new THREE.Group(); mouth.position.set(0, -0.135, 0.272); hg.add(mouth); S.mouth = mouth;
  const cav = mesh(new THREE.SphereGeometry(1, 16, 12), M(0x7a1a28, { roughness: 0.5 }), { shadow: false }); mouth.add(cav);
  const tongue = mesh(new THREE.SphereGeometry(1, 12, 8), M(0xff7a8a), { shadow: false }); mouth.add(tongue);
  const teeth = mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), { shadow: false }); mouth.add(teeth);
  const smileArc = mesh(new THREE.TorusGeometry(0.05, 0.0105, 6, 20, Math.PI), new THREE.MeshBasicMaterial({ color: 0x8a2c33 }), { pos: [0, 0.02, 0.012], rot: [0, 0, Math.PI], shadow: false });
  mouth.add(smileArc);
  S.mouthParts = { cav, tongue, teeth, smileArc };

  // キャップ(青+白パネル+魚マーク)
  const cap = new THREE.Group(); cap.position.y = 0.17; cap.rotation.x = -0.22; hg.add(cap); S.cap = cap;
  const capM = M(COL.capBlue, { roughness: 0.55 }), capDark = M(0x2257b8, { roughness: 0.5 });
  cap.add(mesh(new THREE.SphereGeometry(0.338, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), capM));
  cap.add(mesh(new THREE.SphereGeometry(0.342, 28, 16, Math.PI / 2 - 0.75, 1.5, 0, Math.PI * 0.43), M(0xffffff, { roughness: 0.55 })));
  cap.add(mesh(new THREE.TorusGeometry(0.338, 0.014, 6, 36), capDark, { rot: [Math.PI / 2, 0, 0] }));
  cap.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), capDark, { pos: [0, 0.338, 0] }));
  const visorShape = new THREE.Shape(); visorShape.absarc(0, 0, 0.27, Math.PI, Math.PI * 2, false);
  const vg = new THREE.ExtrudeGeometry(visorShape, { depth: 0.028, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 20 }); vg.rotateX(-Math.PI / 2);
  cap.add(mesh(vg, capDark, { pos: [0, -0.01, 0.285], rot: [0.16, 0, 0], scl: [1.02, 1, 1.18] }));
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.106), new THREE.MeshBasicMaterial({ map: fishTex(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  logo.position.set(0, 0.2, 0.282); logo.rotation.x = -0.6; cap.add(logo);

  root.traverse((o) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
  return S;
}

export function applyPose(S, P) {
  S.hips.position.y = 0.42 + P.hipsY;
  S.torso.rotation.set(P.lean, P.twist, 0);
  S.head.rotation.set(P.headRx, P.headRy, P.headRz);
  S.armN.sh.rotation.set(P.aN[0], 0, P.aN[1]); S.armN.el.rotation.set(P.eN[0], 0, P.eN[1]);
  S.armP.sh.rotation.set(P.aP[0], 0, P.aP[1]); S.armP.el.rotation.set(P.eP[0], 0, P.eP[1]);
  S.legN.hip.rotation.x = P.lN[0]; S.legN.knee.rotation.x = P.lN[1];
  S.legP.hip.rotation.x = P.lP[0]; S.legP.knee.rotation.x = P.lP[1];
}

export function applyExpr(S, E) {
  const open = clamp(E.open), joy = E.joy > 0.5;
  ['N', 'P'].forEach((k) => {
    const e = S.eye[k], sc = Math.max(0.06, E.eyeOpen) * (1 + 0.18 * E.eyeWide);
    e.g.visible = !joy; S.joyEye[k].visible = joy;
    e.g.scale.set(1 + 0.08 * E.eyeWide, sc, 1);
    e.ir.position.x = E.gx * 0.022; e.ir.position.y = E.gy * 0.022;
    const b = S.brow[k], s = b.userData.side;
    b.position.y = 0.105 + 0.032 * E.browUp + (joy ? 0.012 : 0);
    b.rotation.z = Math.PI / 2 + (s < 0 ? E.tilt : -E.tilt); // 内側が上がると困り顔
  });
  S.blush.forEach((b) => { b.material.opacity = 0.18 + 0.5 * E.blush; });
  const { cav, tongue, teeth, smileArc } = S.mouthParts;
  const showOpen = open > 0.06;
  cav.visible = showOpen; tongue.visible = showOpen; teeth.visible = showOpen && open > 0.4;
  smileArc.visible = !showOpen;
  smileArc.scale.set(0.8 + 0.5 * E.wide * (0.5 + E.smile), Math.max(0.1, Math.abs(E.smile)) * (E.smile < 0 ? -1 : 1), 1);
  smileArc.position.y = 0.02 - 0.008 * E.smile;
  const w = 0.03 + 0.042 * E.wide * (0.45 + 0.55 * E.smile) , h = 0.006 + 0.058 * open;
  cav.scale.set(w, h, 0.03); cav.position.y = -h * 0.2 + 0.012 * E.smile;
  tongue.scale.set(w * 0.65, h * 0.42, 0.02); tongue.position.set(0, cav.position.y - h * 0.5, 0.012);
  teeth.scale.set(w * 1.5, 0.012, 0.01); teeth.position.set(0, cav.position.y + h * 0.78, 0.028);
}
