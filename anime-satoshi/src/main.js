// 「サトシと大海原の大冒険！」第1話 試作(0〜30秒)
// window.renderFrame(t) が時刻tの1フレームを決定論的に描画する。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, lerp, sm, easeOut, easeIO, kf } from './util.js';
import { createSea, createSky, createClouds, waveH } from './sea.js';
import { makeSatoshi, basePose, baseExpr, applyPose, applyExpr } from './satoshi.js';
import { createSatoMaru, createMiniBoat } from './boat.js';
import { createHarbor } from './harbor.js';
import { createSpray, createGulls } from './fx.js';
import { mouthAt, lineAt } from './lipsync.js';

const W = 1920, H = 1080, PI = Math.PI;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').prepend(renderer.domElement);

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 2000);

// ---- ライト ----
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0xb59a7a, 1.1); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0d6, 2.8); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xa8c8ff, 0.6); scene.add(fill);

// ---- 世界 ----
const sky = createSky(), sea = createSea(), clouds = createClouds(), harbor = createHarbor();
scene.add(sky, sea, clouds, harbor);
const boat = createSatoMaru(); scene.add(boat);
const mini1 = createMiniBoat(0x2a69d6, 0xf2c94c); mini1.position.set(9.8, 0, -2.0); scene.add(mini1);
const sat = makeSatoshi(); sat.root.scale.setScalar(0.8); scene.add(sat.root);
const gulls = createGulls(6); scene.add(gulls);

// ---- 船の運動(解析的) ----
const BOAT0 = { x: 3.5, z: -2.1 }, T_GO = 18.2, ACC = 0.8, VMAX = 3.3;
const boatDisp = (t) => { if (t <= T_GO) return 0; const ta = VMAX / ACC, d = t - T_GO; return d < ta ? 0.5 * ACC * d * d : 0.5 * ACC * ta * ta + VMAX * (d - ta); };
const boatSpeed = (t) => (t <= T_GO ? 0 : Math.min(VMAX, ACC * (t - T_GO)));
const boatXAt = (t) => BOAT0.x - boatDisp(t);
const spray = createSpray(boatXAt, boatSpeed, T_GO + 0.8); scene.add(spray);
const T_LAND = 16.7;

function updateBoat(t) {
  const x = boatXAt(t), z = BOAT0.z, sp = boatSpeed(t);
  const hb = waveH(x - 2.5, z, t), hs = waveH(x + 2.5, z, t), hp = waveH(x, z + 1, t), hn = waveH(x, z - 1, t);
  const imp = t > T_LAND ? Math.exp(-(t - T_LAND) * 2.2) : 0, ring = Math.sin((t - T_LAND) * 8);
  boat.position.set(x, (hb + hs + hp + hn) / 4 + 0.05 - 0.05 * imp * ring - 0.01 * sp, z);
  boat.rotation.z = Math.atan2(hs - hb, 5) - 0.025 * sp;
  boat.rotation.x = Math.atan2(hn - hp, 2.2) + 0.05 * imp * ring + 0.012 * Math.sin(t * 12) * (sp > 0.3 ? 1 : 0);
  boat.updateMatrixWorld(true);
  boat.userData.foam.position.y = 0.0 + 0.02 * Math.sin(t * 3);
}
function updateMini(t) {
  [mini1].forEach((m, i) => { const p = m.position; m.position.y = waveH(p.x, p.z, t) + 0.1; m.rotation.z = 0.04 * Math.sin(t * 1.3 + i); m.rotation.x = 0.03 * Math.sin(t * 1.1 + i * 2); });
}

// ---- サトシの演技 ----
const QX = -1.0, QZ = 2.3, JUMP0 = [4.0, 0.95, 0.35], DECK_L = new THREE.Vector3(0.9, 0.91, 0), T_JUMP = 15.85;
const TAU2 = PI * 2;
function walk(P, ph, amp) {
  const s = Math.sin(ph), c = Math.cos(ph);
  P.lN = [-s * 0.75 * amp, Math.max(0, c) * 0.95 * amp]; P.lP = [s * 0.75 * amp, Math.max(0, -c) * 0.95 * amp];
  P.aN = [s * 0.65 * amp, -0.12]; P.aP = [-s * 0.65 * amp, 0.12]; P.eN = [-0.35 * amp, 0]; P.eP = [-0.35 * amp, 0];
  P.hipsY += Math.abs(s) * 0.035 * amp; P.lean += 0.05 * amp; P.torsoTwist = -s * 0.12 * amp;
}
function crouch(P, a) { P.lN = [-a, 2 * a]; P.lP = [-a, 2 * a]; P.hipsY -= 0.4 * (1 - Math.cos(a)); }

function satState(t) {
  const P = basePose(), E = baseExpr();
  let pos = [QX, 0.95, QZ], ry = 0, onBoat = false;
  const breathe = Math.sin(t * 2.4) * 0.012; P.hipsY += breathe * 0.5; P.lean += breathe;
  const blinkPh = (t * 1.0 + 0.7) % 3.4; if (blinkPh < 0.15) E.eyeOpen = 1 - Math.sin((blinkPh / 0.15) * PI);
  const mo = mouthAt(t); E.open = mo.open; E.wide = mo.wide; if (mo.talking) E.smile = 0.55;
  const wave = sm(4.3, 4.8, t) * (1 - sm(7.2, 7.9, t));
  const look = sm(7.3, 7.9, t) * (1 - sm(12.0, 12.6, t));
  const point = sm(8.5, 8.9, t) * (1 - sm(9.9, 10.3, t));
  const pump = sm(10.6, 10.9, t) * (1 - sm(12.0, 12.4, t));

  if (t < 4.0) {                                    // 入場(歩き)
    const u = clamp((t - 0.5) / 3.5), x = -7.6 + (QX + 7.6) * (u * (2 - u));
    pos = [x, 0.95, QZ]; ry = PI / 2; walk(P, x * 7.0, clamp(0.25 + 1.1 * (1 - u))); E.smile = 0.85; E.gx = 0.5; P.headRy = 0.0;
  } else if (t < 12.2) {                            // 手を振る・セリフ
    const turn = easeIO(sm(4.0, 4.7, t)); ry = lerp(PI / 2, 0, turn) + 0.55 * look + (-0.12 * Math.sin(turn * PI));
    if (t > 4.0 && t < 4.75) { const h = Math.sin(clamp((t - 4.3) / 0.45) * PI); pos[1] += 0.12 * h; }
    E.smile = 0.85; E.blush = 0.6; E.browUp = 0.5 * wave;
    P.aN = [0, lerp(-0.1, -2.55, wave)]; P.eN = [0, wave * 0.55 * Math.sin(t * 9.5)]; P.headRz = -0.1 * wave + 0.05 * Math.sin(t * 2);
    P.hipsY += 0.025 * Math.abs(Math.sin(t * 4.2)) * wave;
    P.headRy = 0.35 * look + 0.0; E.gx = 0.8 * look; E.eyeWide = 0.6 * look; E.browUp += 0.7 * look; E.smile = 0.9;
    P.aP = [0, lerp(0.1, 1.55, point)]; P.eP = [0, 0];
    P.aP = [lerp(P.aP[0], -0.2, pump), lerp(P.aP[1], 2.7, pump)]; P.eP = [0, pump * (0.7 + 0.6 * Math.sin(t * 13))];
    P.hipsY += 0.03 * pump * Math.abs(Math.sin(t * 6.5)); E.joy = pump > 0.6 ? 1 : 0;
    P.lean += -0.04 * pump;
  } else if (t < 15.2) {                            // 船へ歩く
    const u = easeIO(clamp((t - 12.35) / 2.85)), x = lerp(QX, JUMP0[0], u), z = lerp(QZ, JUMP0[2], u);
    pos = [x, 0.95, z]; ry = lerp(0.55, 1.95, sm(12.0, 12.7, t)); const sp = Math.sin(u * PI);
    if (t > 12.35) walk(P, (u * 5.2) * TAU2, 0.3 + 0.9 * sp); E.smile = 0.9; P.headRy = 0.3 * (1 - sm(12.2, 13, t));
  } else if (t < T_JUMP + 0.9) {                    // しゃがんでジャンプ
    ry = lerp(1.95, 2.98, sm(15.2, 15.7, t)); const dst = boat.localToWorld(DECK_L.clone());
    if (t < T_JUMP) { const a = 0.9 * Math.sin(clamp((t - 15.2) / 0.65) * PI * 0.5); crouch(P, a); pos = [...JUMP0]; P.aN = [0.6 * a, -0.15]; P.aP = [0.6 * a, 0.15]; P.lean = 0.12 * a; E.eyeWide = 0.4; }
    else {
      const u = (t - T_JUMP) / 0.9; pos = [lerp(JUMP0[0], dst.x, u), lerp(JUMP0[1], dst.y, u) + 1.15 * 4 * u * (1 - u), lerp(JUMP0[2], dst.z, u)];
      const tuck = Math.sin(u * PI); P.lN = [-0.9 * tuck, 1.4 * tuck]; P.lP = [-0.5 * tuck, 0.9 * tuck]; P.aN = [0, -2.2 * tuck - 0.2]; P.aP = [0, 2.2 * tuck + 0.2]; E.joy = tuck > 0.5 ? 1 : 0; E.open = 0.8; E.wide = 0.9;
    }
  } else if (t < 20.0) {                            // 船上: 着地 → 手を振る
    onBoat = true; const k = t - T_LAND; pos = [DECK_L.x, DECK_L.y, DECK_L.z]; ry = lerp(2.98, 0, easeIO(sm(T_LAND + 0.1, T_LAND + 0.9, t))) - 0.0;
    const land = Math.exp(-Math.max(0, k) * 5);
    crouch(P, 0.55 * land); const w2 = sm(17.5, 18.0, t);
    P.aN = [0, lerp(-0.1, -2.55, w2)]; P.eN = [0, w2 * 0.55 * Math.sin(t * 9.5)]; P.headRz = -0.1 * w2; E.smile = 0.95; E.blush = 0.7; E.open = Math.max(E.open, w2 * 0.55 * (0.5 + 0.5 * Math.sin(t * 5)));
    P.hipsY += 0.02 * Math.abs(Math.sin(t * 4)) * w2;
  } else {                                          // シーン2(船上・出港)
    onBoat = true; const k = t - 20.0; pos = [0.9, DECK_L.y, 0.0];
    const turn = sm(25.0, 25.9, t); ry = PI + (PI / 4) * turn;
    const cheer = 1 - sm(20.5, 20.9, t), talk = sm(20.8, 21.2, t) * (1 - sm(25, 25.4, t)), visor = sm(25.8, 26.4, t) * (1 - sm(28.0, 28.5, t)), yay = sm(28.5, 28.9, t);
    E.smile = 0.9; E.blush = 0.7;
    P.hipsY += 0.03 * Math.abs(Math.sin(t * 4.6)) * (cheer + yay) + 0.012 * Math.sin(t * 7) * talk;
    // 両手を上げて「やった！」→ セリフ中は広げるジェスチャー
    const open = 0.55 + 0.45 * Math.sin(t * 2.6);
    P.aN = [0, lerp(lerp(-0.1, -(0.9 + 0.5 * open), talk), -2.7, cheer)]; P.aP = [0, lerp(lerp(0.1, 0.9 + 0.5 * open, talk), 2.7, cheer)];
    P.eN = [-0.3 * talk, -0.4 * cheer * Math.sin(t * 11)]; P.eP = [-0.3 * talk, 0.4 * cheer * Math.sin(t * 11)];
    E.joy = cheer > 0.5 ? 1 : 0; E.browUp = 0.4 * talk;
    // 水平線を見渡す
    P.aP = [lerp(P.aP[0], -2.0, visor), lerp(P.aP[1], 0.35, visor)]; P.eP = [lerp(P.eP[0], -0.95, visor), 0];
    P.headRy = (0.6 * Math.sin((t - 26) * 1.5)) * visor; E.gx = 0.5 * visor; E.eyeWide = 0.5 * visor; E.browUp += 0.5 * visor;
    const y2 = yay; P.aN = [lerp(P.aN[0], 0, y2), lerp(P.aN[1], -2.65, y2)]; P.aP = [lerp(P.aP[0], 0, y2), lerp(P.aP[1], 2.65, y2)];
    P.eP = [P.eP[0], lerp(P.eP[1], 0.9 * (0.5 + 0.5 * Math.sin(t * 12)), y2)]; P.eN = [P.eN[0], lerp(P.eN[1], -0.9 * (0.5 + 0.5 * Math.sin(t * 12 + 1)), y2)];
    E.joy = Math.max(E.joy, y2 > 0.5 ? 1 : 0); E.open = Math.max(E.open, y2 * 0.7);
    P.lean += 0.05 * Math.sin(t * 1.3);
  }
  // 風・慣性による二次的な揺れ(キャップ・髪)
  const sway = Math.sin(t * 3.1) * 0.05 + 0.03 * Math.sin(t * 7.3);
  return { P, E, pos, ry, onBoat, sway };
}

function updateSat(t) {
  const st = satState(t);
  applyPose(sat, st.P); applyExpr(sat, st.E);
  sat.torso.rotation.y = st.P.torsoTwist || 0;
  sat.tufts.rotation.x = st.sway; sat.cap.rotation.x = -0.22 + st.sway * 0.4;
  const target = st.onBoat ? boat : scene;
  if (sat.root.parent !== target) target.add(sat.root);
  sat.root.position.set(...st.pos);
  if (st.onBoat) sat.root.position.y = st.pos[1] - 0.0;
  sat.root.rotation.set(0, st.ry, 0);
  sat.root.updateMatrixWorld(true);
  return st;
}

// ---- カメラ ----
const CAM1 = [
  [0, [-3.5, 2.7, 10.5, 0.5, 2.2, -6]],
  [3.5, [-3.0, 2.3, 8.2, -2.4, 1.7, 2.3]],
  [4.6, [-1.7, 2.0, 6.0, -1.0, 1.75, 2.3]],
  [7.0, [-1.0, 1.95, 4.9, -1.0, 1.8, 2.3]],
  [8.4, [-0.4, 1.95, 5.0, -0.2, 1.75, 2.3]],
  [12.0, [0.4, 2.0, 5.5, 0.6, 1.7, 2.3]],
  [15.2, [2.8, 2.3, 6.2, 3.6, 1.9, 0.8]],
  [17.5, [4.2, 2.7, 6.6, 4.4, 1.9, -1.5]],
  [20.0, [5.5, 3.2, 8.5, 3.5, 1.7, -2.0]],
];
const CAM2 = [ // ボート基準の相対オフセット [cx,cy,cz, lx,ly,lz]
  [20.0, [4.8, 2.3, -7.5, 0.7, 1.8, 0]],
  [23.0, [2.6, 2.1, -5.0, 0.8, 1.8, 0]],
  [26.0, [1.6, 2.0, -4.8, 0.2, 1.8, 0]],
  [30.0, [3.0, 2.0, -4.0, -0.3, 1.7, 0]],
];
function updateCamera(t) {
  let c;
  if (t < 20.0) c = kf(CAM1, t);
  else { const o = kf(CAM2, t), bp = boat.position; c = [bp.x + o[0], o[1], bp.z + o[2], bp.x + o[3], o[4], bp.z + o[5]]; }
  const shake = t >= 20 ? 0.015 : 0.004;
  camera.position.set(c[0] + shake * Math.sin(t * 2.3), c[1] + shake * Math.sin(t * 3.1), c[2]); camera.lookAt(c[3], c[4], c[5]);
  camera.fov = t < 20 ? lerp(36, 33, sm(4.5, 7, t)) : 34; camera.updateProjectionMatrix();
}

// ---- 時間帯別のライティング・空の色 ----
const A = { hor: new THREE.Color(0xffd7a8), zen: new THREE.Color(0x5b9fe6), sun: new THREE.Color(0xffe2a0), key: new THREE.Color(0xffe7c2) };
const B = { hor: new THREE.Color(0xcfe9ff), zen: new THREE.Color(0x3d8fe8), sun: new THREE.Color(0xfff4d0), key: new THREE.Color(0xfff6e4) };
function updateEnv(t) {
  const m = sm(19.8, 20.2, t), hor = A.hor.clone().lerp(B.hor, m), zen = A.zen.clone().lerp(B.zen, m);
  sky.material.uniforms.uHor.value.copy(hor); sky.material.uniforms.uZen.value.copy(zen); sky.material.uniforms.uSunCol.value.copy(A.sun.clone().lerp(B.sun, m));
  sea.material.uniforms.uHor.value.copy(hor);
  scene.fog = new THREE.Fog(hor.getHex(), 120, 650);
  key.color.copy(A.key.clone().lerp(B.key, m)); key.intensity = lerp(2.9, 2.7, m);
  hemi.color.copy(zen.clone().lerp(new THREE.Color(0xffffff), 0.5));
  sky.position.copy(camera.position);
}

// ---- DOM(字幕・タイトル・ワイプ) ----
const $ = (id) => document.getElementById(id);
const sub = $('sub'), subB = sub.querySelector('b'), subI = sub.querySelector('i'), title = $('title'), iris = $('iris'), fade = $('fade');
function updateOverlay(t) {
  const l = lineAt(t);
  if (l) { sub.style.opacity = Math.min(sm(l.t0 - 0.15, l.t0 + 0.05, t), 1 - sm(l.t1 + 0.35, l.t1 + 0.6, t)); subB.textContent = 'サトシ'; subI.textContent = l.text; } else sub.style.opacity = 0;
  title.style.opacity = sm(0.4, 0.9, t) * (1 - sm(3.3, 3.9, t));
  let r = 1400; if (t >= 19.4 && t < 20.0) r = 1400 * (1 - easeIO((t - 19.4) / 0.6)); else if (t >= 20.0 && t < 20.6) r = 1400 * easeIO((t - 20.0) / 0.6);
  if (t >= 19.4 && t < 20.6) { iris.style.display = 'block'; iris.style.setProperty('--r', r + 'px'); } else iris.style.display = 'none';
  fade.style.opacity = Math.max(1 - sm(0, 0.5, t), sm(29.4, 30, t));
}

window.renderFrame = (t) => {
  updateBoat(t); updateMini(t);
  updateSat(t);
  updateCamera(t);
  updateEnv(t);
  sea.userData.update(t, camera); clouds.userData.update(t); spray.userData.update(t);
  gulls.userData.update(t, { x: 2, z: -3 }, boat.position, sm(18.5, 22.5, t));
  // キーライト: シーンごとに被写体の正面側から当てる(逆光回避)
  const focus = t < 20 ? new THREE.Vector3(1.5, 1.2, 1.5) : boat.position.clone().add(new THREE.Vector3(0, 1, 0));
  key.target.position.copy(focus); key.position.copy(focus).add(t < 20 ? new THREE.Vector3(-8, 11, 12) : new THREE.Vector3(-5, 11, -12));
  fill.position.copy(focus).add(t < 20 ? new THREE.Vector3(10, 4, -6) : new THREE.Vector3(8, 4, 8));
  key.target.updateMatrixWorld();
  updateOverlay(t);
  renderer.render(scene, camera);
  return true;
};
window.__ready = true;
