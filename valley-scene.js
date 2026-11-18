import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const host = document.getElementById("valley");
const ui = document.getElementById("ui");
const soundBtn = document.getElementById("sound");
const go = document.getElementById("go");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(max-width: 820px)").matches;

// ── terrain ──────────────────────────────────────────────
const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const terrain = (x, z) => {
  const base = (noise2(x * 0.02, z * 0.02) - 0.5) * 16 + (noise2(x * 0.07 + 5, z * 0.07 - 3) - 0.5) * 5;
  const wall = Math.pow(Math.min(Math.abs(x) / 110, 1), 2) * 18;
  const bowl = -Math.exp(-(x * x) / (2 * 72 * 72)) * 5;
  return base + wall + bowl;
};

// ── renderer / scene ─────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 700);

// ── sprites (procedural, no assets) ──────────────────────
function flowerTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const glow = g.createRadialGradient(64, 64, 1, 64, 64, 62);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(.28, "rgba(255,255,255,.42)");
  glow.addColorStop(.6, "rgba(255,255,255,.1)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.save(); g.rotate((i / 6) * Math.PI * 2);
    const p = g.createRadialGradient(0, -16, 1, 0, -16, 24);
    p.addColorStop(0, "rgba(255,255,255,.55)");
    p.addColorStop(.55, "rgba(255,255,255,.22)");
    p.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = p;
    g.beginPath(); g.ellipse(0, -17, 9, 19, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 10);
  core.addColorStop(0, "rgba(255,250,232,.9)");
  core.addColorStop(1, "rgba(255,250,232,0)");
  g.fillStyle = core;
  g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}
function leafTexture() {
  const c = document.createElement("canvas"); c.width = 96; c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(48, 8, 48, 120);
  grd.addColorStop(0, "rgba(255,255,255,.0)");
  grd.addColorStop(.35, "rgba(255,255,255,.9)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(48, 6); g.bezierCurveTo(92, 44, 84, 104, 48, 122);
  g.bezierCurveTo(12, 104, 4, 44, 48, 6); g.fill();
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(48, 14); g.lineTo(48, 114); g.stroke();
  return new THREE.CanvasTexture(c);
}
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(.4, "rgba(255,255,255,.35)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function bloomTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const halo = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  halo.addColorStop(0, "rgba(255,255,255,.5)");
  halo.addColorStop(.5, "rgba(255,255,255,.12)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = halo; g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.save(); g.rotate((i / 6) * Math.PI * 2);
    const p = g.createRadialGradient(0, -24, 1, 0, -24, 30);
    p.addColorStop(0, "rgba(255,255,255,.75)");
    p.addColorStop(.55, "rgba(255,255,255,.38)");
    p.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = p;
    g.beginPath(); g.ellipse(0, -26, 13, 28, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 12);
  core.addColorStop(0, "rgba(255,252,240,1)");
  core.addColorStop(1, "rgba(255,252,240,0)");
  g.fillStyle = core;
  g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}
const texFlower = flowerTexture(), texLeaf = leafTexture(), texGlow = glowTexture(), texBloom = bloomTexture();

// ── flowers & leaves ─────────────────────────────────────
const PALETTE = [
  [0.96, 0.89, 0.72], [0.95, 0.7, 0.78], [0.68, 0.58, 0.92],
  [0.56, 0.88, 0.72], [0.95, 0.8, 0.52], [0.74, 0.85, 1]
];
const LEAF_PALETTE = [[0.24, 0.44, 0.32], [0.32, 0.55, 0.36], [0.2, 0.36, 0.28], [0.4, 0.62, 0.45]];
const N_FLOWER = mobile ? 11000 : 44000;
const N_LEAF = mobile ? 4500 : 12000;

function scatter(count, palette, height, sizeScale, cluster) {
  const pos = new Float32Array(count * 3), size = new Float32Array(count);
  const phase = new Float32Array(count), tint = new Float32Array(count * 3);
  let i = 0;
  while (i < count) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.pow(Math.random(), 0.55) * 138;
    const x = Math.cos(a) * r, z = -80 + Math.sin(a) * r * 1.1;
    if (cluster && Math.random() > 0.28 + noise2(x * 0.05, z * 0.05) * 1.1) continue;
    const y = terrain(x, z) + 0.4 + Math.random() * height;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    size[i] = sizeScale * (0.35 + Math.pow(Math.random(), 1.8) * 2.2);
    phase[i] = Math.random() * 100;
    const c = palette[(Math.random() * palette.length) | 0];
    tint[i * 3] = c[0]; tint[i * 3 + 1] = c[1]; tint[i * 3 + 2] = c[2];
    i++;
  }
  return { pos, size, phase, tint };
}
function pointsMaterial(tex, isLeaf) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
      uDisperse: { value: 0 },
      uIsLeaf: { value: isLeaf ? 1 : 0 }
    },
    vertexShader: `
      attribute float aSize; attribute float aPhase; attribute vec3 aTint;
      uniform float uTime, uPixelRatio, uDisperse, uIsLeaf; uniform vec2 uMouse;
      varying vec3 vTint; varying float vAlpha; varying float vGlow;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*0.34 + aPhase + p.z*0.12) * (0.25 + 0.3*sin(aPhase));
        p.z += cos(uTime*0.26 + aPhase*1.7) * 0.15;
        vec3 dir = normalize(vec3(fract(aPhase*0.37)-0.5, 0.25+fract(aPhase*0.71)*0.8, cos(aPhase*3.1)));
        p += dir * uDisperse * (5.0 + 16.0*fract(aPhase*0.13));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = max(-mv.z, 0.5);
        float near = smoothstep(200.0, 6.0, dist);
        float far = smoothstep(30.0, 180.0, dist);
        float grow = mix(0.5, 1.35, uIsLeaf > 0.5 ? far : near);
        vec4 clip = projectionMatrix * mv;
        vec2 ndc = clip.xy / clip.w;
        vec2 d = ndc - uMouse; d.x *= 0.75;
        float prox = 1.0 - smoothstep(0.0, 0.4, length(d));
        ndc += normalize(ndc - uMouse + vec2(0.0001)) * prox * 0.085 * (1.0 - uDisperse*0.6);
        clip.xy = ndc * clip.w;
        gl_Position = clip;
        gl_PointSize = clamp(aSize * grow * uPixelRatio * (210.0 / dist), 1.0, 56.0);
        float fog = exp(-dist * 0.011);
        vAlpha = mix(0.3, 0.95, fog) * (uIsLeaf > 0.5 ? 0.6 : 1.0);
        vAlpha *= 0.55 + 0.9 * fract(aPhase * 0.29);
        vGlow = prox;
        vTint = aTint;
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec3 vTint; varying float vAlpha; varying float vGlow;
      void main(){
        vec4 t = texture2D(uTex, gl_PointCoord);
        if (t.a < 0.015) discard;
        vec3 col = vTint * (0.74 + vGlow * 1.0);
        gl_FragColor = vec4(col * t.rgb, t.a * vAlpha * (0.46 + vGlow * 0.55));
      }`,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending
  });
}
function buildPoints(data, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(data.size, 1));
  g.setAttribute("aPhase", new THREE.BufferAttribute(data.phase, 1));
  g.setAttribute("aTint", new THREE.BufferAttribute(data.tint, 3));
  return new THREE.Points(g, mat);
}
const flowerMat = pointsMaterial(texFlower, false);
const leafMat = pointsMaterial(texLeaf, true);
const flowers = buildPoints(scatter(N_FLOWER, PALETTE, 1.6, 1, true), flowerMat);
const leaves = buildPoints(scatter(N_LEAF, LEAF_PALETTE, 2.2, 1.7), leafMat);
scene.add(flowers, leaves);

// ── foreground bokeh (out-of-focus glow near the camera path) ──
const N_BOKEH = mobile ? 90 : 220;
const bokehData = scatter(N_BOKEH, PALETTE, 3.2, 1, true);
const bokehMat = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: texGlow }, uTime: { value: 0 }, uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
  vertexShader: `
    attribute float aSize; attribute float aPhase; attribute vec3 aTint;
    uniform float uTime, uPixelRatio; varying vec3 vTint; varying float vA;
    void main(){
      vec3 p = position;
      p.x += sin(uTime*0.22 + aPhase) * 0.8; p.y += cos(uTime*0.15 + aPhase*1.3) * 0.5;
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      float dist = max(-mv.z, 1.0);
      gl_PointSize = clamp(aSize * uPixelRatio * (900.0 / dist), 6.0, 110.0);
      gl_Position = projectionMatrix * mv;
      vA = smoothstep(6.0, 26.0, dist) * 0.5;
      vTint = aTint;
    }`,
  fragmentShader: `
    uniform sampler2D uTex; varying vec3 vTint; varying float vA;
    void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vTint*t.rgb, t.a*vA*0.09); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const bokehGeo = new THREE.BufferGeometry();
bokehGeo.setAttribute("position", new THREE.BufferAttribute(bokehData.pos, 3));
bokehGeo.setAttribute("aSize", new THREE.BufferAttribute(bokehData.size, 1));
bokehGeo.setAttribute("aPhase", new THREE.BufferAttribute(bokehData.phase, 1));
bokehGeo.setAttribute("aTint", new THREE.BufferAttribute(bokehData.tint, 3));
scene.add(new THREE.Points(bokehGeo, bokehMat));

// ── near blooms: readable petals hugging the camera route ──
const route = [
  [0, 70], [-30, 30], [-20, -40], [20, -90], [42, -150], [0, -210],
  [-44, -170], [-60, -90], [-55, -10], [-34, 58]
];
const N_BLOOMS = mobile ? 320 : 900;
const bloomData = (() => {
  const pos = new Float32Array(N_BLOOMS * 3), phase = new Float32Array(N_BLOOMS), tint = new Float32Array(N_BLOOMS * 3);
  for (let i = 0; i < N_BLOOMS; i++) {
    const i0 = (Math.random() * route.length) | 0, i1 = (i0 + 1) % route.length;
    const k = Math.random();
    const bx = route[i0][0] + (route[i1][0] - route[i0][0]) * k;
    const bz = route[i0][1] + (route[i1][1] - route[i0][1]) * k;
    const ang = Math.random() * Math.PI * 2;
    const rr = 2.5 + Math.pow(Math.random(), 0.8) * 11;
    const x = bx + Math.cos(ang) * rr, z = bz + Math.sin(ang) * rr;
    pos[i * 3] = x; pos[i * 3 + 1] = terrain(x, z) + 0.4 + Math.random() * 2.2; pos[i * 3 + 2] = z;
    phase[i] = Math.random();
    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    tint[i * 3] = c[0]; tint[i * 3 + 1] = c[1]; tint[i * 3 + 2] = c[2];
  }
  return { pos, phase, tint };
})();
const bloomMat = new THREE.ShaderMaterial({
  uniforms: { uTex: { value: texBloom }, uTime: { value: 0 }, uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
  vertexShader: `
    attribute float aPhase; attribute vec3 aTint;
    uniform float uTime, uPixelRatio; varying vec3 vTint; varying float vA; varying float vRot;
    void main(){
      vec3 p = position;
      p.x += sin(uTime * 0.3 + aPhase * 9.0) * 0.35;
      p.y += sin(uTime * 0.22 + aPhase * 17.0) * 0.12;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float dist = max(-mv.z, 1.0);
      gl_PointSize = clamp((0.5 + fract(aPhase * 5.3) * 1.5) * uPixelRatio * (820.0 / dist), 4.0, 140.0);
      gl_Position = projectionMatrix * mv;
      vA = smoothstep(3.0, 10.0, dist) * (1.0 - smoothstep(50.0, 110.0, dist));
      vA *= 0.28 + 0.55 * abs(sin(uTime * 0.19 + aPhase * 40.0));
      vRot = aPhase * 6.283;
      vTint = aTint;
    }`,
  fragmentShader: `
    uniform sampler2D uTex; varying vec3 vTint; varying float vA; varying float vRot;
    void main(){
      vec2 p = gl_PointCoord - 0.5;
      float c = cos(vRot), s = sin(vRot);
      vec2 q = mat2(c, -s, s, c) * p + 0.5;
      vec4 t = texture2D(uTex, q);
      gl_FragColor = vec4(vTint * t.rgb * 1.02, t.a * vA * 0.7);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const bloomGeo = new THREE.BufferGeometry();
bloomGeo.setAttribute("position", new THREE.BufferAttribute(bloomData.pos, 3));
bloomGeo.setAttribute("aPhase", new THREE.BufferAttribute(bloomData.phase, 1));
bloomGeo.setAttribute("aTint", new THREE.BufferAttribute(bloomData.tint, 3));
scene.add(new THREE.Points(bloomGeo, bloomMat));

// ── dust ─────────────────────────────────────────────────
const N_DUST = mobile ? 500 : 1400;
const dustPos = new Float32Array(N_DUST * 3), dustSeed = new Float32Array(N_DUST);
for (let i = 0; i < N_DUST; i++) {
  const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 160;
  const x = Math.cos(a) * r, z = -90 + Math.sin(a) * r;
  dustPos[i * 3] = x; dustPos[i * 3 + 1] = terrain(x, z) + 2 + Math.random() * 26; dustPos[i * 3 + 2] = z;
  dustSeed[i] = Math.random() * 100;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(dustSeed, 1));
const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uTex: { value: texGlow }, uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
  vertexShader: `
    attribute float aSeed; uniform float uTime, uPixelRatio; varying float vA;
    void main(){
      vec3 p = position;
      p.y += sin(uTime*0.17 + aSeed) * 1.6;
      p.x += cos(uTime*0.1 + aSeed*1.3) * 1.2;
      vec4 mv = modelViewMatrix * vec4(p,1.0);
      gl_PointSize = clamp(uPixelRatio * (14.0 / max(-mv.z,1.0)), 1.0, 20.0);
      gl_Position = projectionMatrix * mv;
      vA = 0.25 + 0.35*abs(sin(uTime*0.28 + aSeed));
    }`,
  fragmentShader: `
    uniform sampler2D uTex; varying float vA;
    void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(0.85,0.9,1.0)*t.rgb, t.a*vA*0.22); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
}));
scene.add(dust);

// ── light rays ───────────────────────────────────────────
const rays = [];
for (let i = 0; i < 3; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texGlow, color: new THREE.Color(0.75, 0.82, 0.7),
    transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  const x = [-35, 5, 40][i], z = [-40, -130, -200][i];
  s.position.set(x, terrain(x, z) + 34, z);
  s.scale.set(34 + i * 8, 110 + i * 20, 1);
  scene.add(s); rays.push(s);
}

// ── ground haze ──────────────────────────────────────────
for (let i = 0; i < 22; i++) {
  const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 130;
  const x = Math.cos(a) * r, z = -80 + Math.sin(a) * r * 1.1;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texGlow, color: new THREE.Color().setHSL(0.12 + Math.random() * 0.22, 0.4, 0.55),
    transparent: true, opacity: 0.035 + Math.random() * 0.04, depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  s.position.set(x, terrain(x, z) + 2.6, z);
  const sc = 18 + Math.random() * 40;
  s.scale.set(sc * 1.7, sc * 0.5, 1);
  scene.add(s);
}

// ── camera path ──────────────────────────────────────────
const curve = new THREE.CatmullRomCurve3(
  route.map(([x, z]) => new THREE.Vector3(x, terrain(x, z) + 8.5, z)), true, "catmullrom", 0.5
);
let t = 0.02, targetT = t, speedFx = 0;
const mouse = new THREE.Vector2(0, 0);

// ── post ─────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.65, 0.2);
composer.addPass(bloom);
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uSpeed; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float split = 0.0008 + uSpeed * 0.0018;
      float r = texture2D(tDiffuse, vUv + d * split).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - d * split).b;
      vec3 c = vec3(r,g,b);
      float vig = smoothstep(0.92, 0.25, length(d) * (1.0 + uSpeed * 0.5));
      c *= mix(0.5, 1.0, vig);
      c += (hash(vUv * 1300.0 + uTime) - 0.5) * 0.03;
      gl_FragColor = vec4(c, 1.0);
    }`
});
composer.addPass(finalPass);

// ── audio (synthesized airy chimes, no file) ─────────────
let actx = null, master = null, damp = null, muted = true, audioReady = false;

function makeImpulse(seconds, decay) {
  const len = Math.round(actx.sampleRate * seconds);
  const buf = actx.createBuffer(2, len, actx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// one soft chime: low sine fundamental plus a quiet octave, slow attack, long tail
function chime(t) {
  const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
  const f = notes[(Math.random() * notes.length) | 0];
  // older iOS lacks StereoPanner; fall back to a plain gain node
  const pan = actx.createStereoPanner ? actx.createStereoPanner() : actx.createGain();
  if (pan.pan) pan.pan.value = Math.random() * 1.2 - 0.6;
  pan.connect(damp);

  [[1, 0.048, 4.8], [2, 0.007, 2.2]].forEach(([ratio, peak, tail]) => {
    const o = actx.createOscillator(); o.type = "sine"; o.frequency.value = f * ratio;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
    o.connect(g).connect(pan);
    o.start(t); o.stop(t + tail + 0.1);
  });
}

function scheduleChime() {
  setTimeout(() => {
    try { if (actx) chime(actx.currentTime + 0.05); } catch (e) {}
    scheduleChime();
  }, 3400 + Math.random() * 5200);
}

function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  master = actx.createGain(); master.gain.value = 0;
  master.connect(actx.destination);

  damp = actx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 1600; damp.Q.value = 0.35;
  const dry = actx.createGain(); dry.gain.value = 0.55;
  const wet = actx.createGain(); wet.gain.value = 0.7;
  const verb = actx.createConvolver(); verb.buffer = makeImpulse(3.4, 2.4);
  damp.connect(dry).connect(master);
  damp.connect(verb).connect(wet).connect(master);

  // very slow filter drift so the pad breathes instead of sitting still
  const drift = actx.createOscillator(); drift.frequency.value = 0.035;
  const driftGain = actx.createGain(); driftGain.gain.value = 200;
  drift.connect(driftGain).connect(damp.frequency); drift.start();

  // soft air bed: filtered noise that wanders a little
  const nLen = Math.round(actx.sampleRate * 4);
  const nBuf = actx.createBuffer(1, nLen, actx.sampleRate);
  const nd = nBuf.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < nLen; i++) {
    pink = (pink + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    nd[i] = pink * 3.2;
  }
  const nSrc = actx.createBufferSource(); nSrc.buffer = nBuf; nSrc.loop = true;
  const nFilt = actx.createBiquadFilter(); nFilt.type = "lowpass"; nFilt.frequency.value = 480; nFilt.Q.value = 0.5;
  const nGain = actx.createGain(); nGain.gain.value = 0.028;
  const nLfo = actx.createOscillator(); nLfo.frequency.value = 0.021;
  const nLfoGain = actx.createGain(); nLfoGain.gain.value = 140;
  nLfo.connect(nLfoGain).connect(nFilt.frequency); nLfo.start();
  nSrc.connect(nFilt).connect(nGain).connect(damp); nSrc.start();

  // slow, breathing pad on open fifths — D3 A3 D4 F#4
  const pad = actx.createGain(); pad.gain.value = 0.55; pad.connect(damp);
  const padOscs = [];
  [146.83, 220, 293.66, 369.99].forEach((f, i) => {
    const o = actx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.detune.value = Math.random() * 12 - 6;
    const g = actx.createGain(); g.gain.value = 0.07 / (i * 0.75 + 1);
    const lfo = actx.createOscillator(); lfo.frequency.value = 0.045 + i * 0.019;
    const lg = actx.createGain(); lg.gain.value = g.gain.value * 0.5;
    lfo.connect(lg).connect(g.gain); lfo.start();
    o.connect(g).connect(pad); o.start();
    padOscs.push(o);
  });

  // let the two upper voices change colour every half minute or so
  let alt = false;
  (function driftPad() {
    setTimeout(() => {
      if (actx && padOscs.length === 4) {
        alt = !alt;
        const now = actx.currentTime;
        padOscs[2].frequency.setTargetAtTime(alt ? 349.23 : 293.66, now, 5);
        padOscs[3].frequency.setTargetAtTime(alt ? 440 : 369.99, now, 5);
      }
      driftPad();
    }, 26000 + Math.random() * 9000);
  })();

  scheduleChime();
  audioReady = true;
}

const TARGET_VOL = 1;
let started = false;

function unmute() {
  started = true;
  muted = false;
  soundBtn.setAttribute("aria-pressed", "true");
  master.gain.cancelScheduledValues(actx.currentTime);
  master.gain.linearRampToValueAtTime(TARGET_VOL, actx.currentTime + 1.4);
}

function wake() {
  initAudio();
  if (!audioReady || started) return;
  if (actx.state === "suspended") actx.resume();
  unmute();
}

initAudio();
if (actx.state === "running") unmute();
else actx.resume().then(() => { if (actx.state === "running" && !started) unmute(); }).catch(() => {});

// browsers hold audio until a gesture; start on the first one, except on the toggle itself
["pointerdown", "pointerup", "touchend", "touchstart", "click", "keydown", "wheel", "scroll"].forEach((ev) => {
  addEventListener(ev, (e) => {
    if (e.target && e.target.closest && e.target.closest("#sound")) return;
    wake();
  }, { passive: true });
});

soundBtn.addEventListener("click", () => {
  initAudio();
  if (!audioReady) return;
  if (actx.state !== "running") actx.resume();
  // a tap while the context is still held (common on iOS) should start sound, not mute it
  if (!started || actx.state !== "running") {
    unmute();
    return;
  }
  muted = !muted;
  soundBtn.setAttribute("aria-pressed", String(!muted));
  master.gain.cancelScheduledValues(actx.currentTime);
  master.gain.linearRampToValueAtTime(muted ? 0 : TARGET_VOL, actx.currentTime + (muted ? 0.5 : 1.4));
});

// ── input (page scroll stays native; pointer only aims the camera) ──
function aim(cx, cy) {
  mouse.x = (cx / innerWidth) * 2 - 1;
  mouse.y = -(cy / innerHeight) * 2 + 1;
}
addEventListener("pointermove", (e) => aim(e.clientX, e.clientY), { passive: true });
addEventListener("touchstart", (e) => {
  const touch = e.touches[0];
  if (touch) aim(touch.clientX, touch.clientY);
}, { passive: true });
addEventListener("touchmove", (e) => {
  const touch = e.touches[0];
  if (touch) aim(touch.clientX, touch.clientY);
}, { passive: true });

// ── hover transition ─────────────────────────────────────
let hover = 0, hoverTarget = 0;
go.addEventListener("pointerenter", () => { hoverTarget = 1; });
go.addEventListener("pointerleave", () => { hoverTarget = 0; });

// ── resize ───────────────────────────────────────────────
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

// ── loop ─────────────────────────────────────────────────
const clock = new THREE.Clock();
let first = true;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime * 0.5;
  if (host.getBoundingClientRect().bottom < 0) return;

  hover += (hoverTarget - hover) * Math.min(1, dt * 2.2);
  const idle = reduce ? 0 : 0.0015 * (1 - hover * 0.92);
  targetT += idle * dt * 60;
  const prevT = t;
  t += (targetT - t) * Math.min(1, dt * 3.2);
  speedFx += ((Math.abs(t - prevT) / Math.max(dt, 0.001)) * 0.15 - speedFx) * Math.min(1, dt * 4);

  const pos = curve.getPointAt(((t % 1) + 1) % 1);
  const ahead = curve.getPointAt((((t + 0.012) % 1) + 1) % 1);
  camera.position.copy(pos);
  const look = ahead.clone().add(new THREE.Vector3(mouse.x * 4, mouse.y * 2.4 - 1.8 + hover * 0.5, 0));
  camera.lookAt(look);

  flowerMat.uniforms.uTime.value = leafMat.uniforms.uTime.value = time;
  flowerMat.uniforms.uMouse.value.lerp(mouse, Math.min(1, dt * 6));
  leafMat.uniforms.uMouse.value.copy(flowerMat.uniforms.uMouse.value);
  flowerMat.uniforms.uDisperse.value = leafMat.uniforms.uDisperse.value = hover;
  dust.material.uniforms.uTime.value = time;
  bokehMat.uniforms.uTime.value = time;
  bloomMat.uniforms.uTime.value = time;
  finalPass.uniforms.uTime.value = time;
  finalPass.uniforms.uSpeed.value = Math.min(1, speedFx * 4 + hover * 0.15);
  bloom.strength = 0.55 + Math.min(0.3, speedFx * 1.4);
  if (damp && actx) damp.frequency.setTargetAtTime(1600 + hover * 600, actx.currentTime, 0.3);

  composer.render();
  if (first) {
    first = false;
    setTimeout(() => { ui.classList.add("on"); }, reduce ? 100 : 900);
  }
}
frame();
