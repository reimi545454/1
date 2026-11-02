// 海面(頂点変位+トゥーン調フラグメント)・空・雲
import * as THREE from 'three';
import { mesh } from './util.js';

// JS側とGLSL側で同一の波関数(船の浮き沈み計算に使う)
export function waveH(x, z, t) {
  return 0.12 * Math.sin(x * 0.5 + t * 1.1) + 0.10 * Math.sin(z * 0.7 + t * 0.9 + 1.3)
    + 0.05 * Math.sin((x + z) * 1.3 + t * 1.8) + 0.03 * Math.sin(x * 2.1 - z * 1.7 + t * 2.5);
}
const WAVE_GLSL = `
float waveH(vec2 p,float t){
  return 0.12*sin(p.x*0.5+t*1.1)+0.10*sin(p.y*0.7+t*0.9+1.3)+0.05*sin((p.x+p.y)*1.3+t*1.8)+0.03*sin(p.x*2.1-p.y*1.7+t*2.5);
}`;

const CELL = 400 / 320;

export function createSea() {
  const geo = new THREE.PlaneGeometry(400, 400, 320, 320); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uSun: { value: new THREE.Vector3(-0.4, 0.12, -0.9).normalize() },
      uDeep: { value: new THREE.Color(0x1062b5) }, uShallow: { value: new THREE.Color(0x35c4d6) },
      uHor: { value: new THREE.Color(0xffd9b0) }, uFoam: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `${WAVE_GLSL}
      uniform float uTime; varying vec3 vW; varying float vH;
      void main(){ vec4 wp=modelMatrix*vec4(position,1.0); float h=waveH(wp.xz,uTime); wp.y+=h; vW=wp.xyz; vH=h;
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `${WAVE_GLSL}
      uniform float uTime; uniform vec3 uCam,uSun,uDeep,uShallow,uHor,uFoam; varying vec3 vW; varying float vH;
      void main(){
        vec2 p=vW.xz; float e=0.1;
        float hx=waveH(p+vec2(e,0.),uTime)-waveH(p-vec2(e,0.),uTime);
        float hz=waveH(p+vec2(0.,e),uTime)-waveH(p-vec2(0.,e),uTime);
        vec3 n=normalize(vec3(-hx/(2.*e),1.,-hz/(2.*e)));
        vec3 V=normalize(uCam-vW); float dist=length(uCam-vW);
        float fres=pow(1.-max(dot(n,V),0.),3.);
        float lit=dot(n,normalize(vec3(-.3,1.,.4)))*.5+.5;
        float band=floor(lit*5.)/5.;
        vec3 col=mix(uDeep,uShallow,clamp(band*.9+vH*1.6-.25,0.,1.));
        col=mix(col,uHor,fres*.42);
        vec3 R=reflect(-V,n); float sp=pow(max(dot(R,uSun),0.),90.);
        col+=vec3(1.,.93,.7)*step(.32,sp)*.9;
        float rip=sin(p.x*2.3+uTime*.8+sin(p.y*1.7+uTime))*sin(p.y*2.9-uTime*.7+sin(p.x*2.1));
        col+=vec3(.07,.09,.1)*step(.9,rip)*(1.-smoothstep(40.,160.,dist));
        float crest=smoothstep(.2,.22,vH+.02*sin(p.x*3.1+uTime*2.2)*sin(p.y*2.7-uTime*1.7));
        col=mix(col,uFoam,crest*.85*(1.-smoothstep(60.,200.,dist)));
        col=mix(col,uHor,smoothstep(70.,380.,dist));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.receiveShadow = false;
  m.userData.update = (t, cam) => {
    mat.uniforms.uTime.value = t; mat.uniforms.uCam.value.copy(cam.position);
    m.position.set(Math.round(cam.position.x / CELL) * CELL, 0, Math.round(cam.position.z / CELL) * CELL);
  };
  return m;
}

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uHor: { value: new THREE.Color(0xffd9b0) }, uZen: { value: new THREE.Color(0x5aa6ea) },
      uSun: { value: new THREE.Vector3(-0.4, 0.12, -0.9).normalize() }, uSunCol: { value: new THREE.Color(0xffe6a0) },
    },
    vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uHor,uZen,uSun,uSunCol; varying vec3 vD;
      void main(){ float h=clamp(vD.y,0.,1.); vec3 col=mix(uHor,uZen,pow(h,.55));
        float d=dot(normalize(vD),uSun);
        col+=uSunCol*pow(max(d,0.),10.)*.5; col=mix(col,uSunCol,smoothstep(.9988,.9993,d));
        if(vD.y<0.) col=uHor; gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment> }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

export function createClouds() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const spots = [[-140, 75, -300, 1.4], [-30, 95, -380, 1.8], [90, 70, -320, 1.2], [170, 100, -260, 1.5], [-230, 110, -150, 1.3], [30, 62, -450, 2.2], [-90, 110, 250, 1.5], [150, 90, 300, 1.4], [-180, 85, 320, 1.2]];
  spots.forEach(([x, y, z, s], k) => {
    const c = new THREE.Group();
    [[0, 0, 0, 14], [14, -2, 2, 11], [-14, -2, 0, 10], [6, 6, -2, 10], [-6, 5, 2, 9], [24, -4, 0, 7], [-23, -4, 2, 7]].forEach(([a, b, d, r]) =>
      c.add(mesh(new THREE.SphereGeometry(r, 12, 8), mat, { pos: [a, b, d], scl: [1, 0.72, 0.9], shadow: false, recv: false })));
    c.position.set(x, y, z); c.scale.setScalar(s * 0.9); c.userData.base = x; c.userData.k = k;
    g.add(c);
  });
  g.userData.update = (t) => g.children.forEach((c) => { c.position.x = c.userData.base + t * (0.6 + 0.15 * c.userData.k); });
  return g;
}
