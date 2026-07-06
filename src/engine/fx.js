// fx.js — particles & visual feedback (bursts, emitters, weather, rings, markers)
// Contract: ARCHITECTURE.md §fx.js. Visual spec: docs/design/art.md §4.
// All pools preallocated; zero per-frame allocation in the hot path.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Canvas-generated sprite textures (made once)
// ---------------------------------------------------------------------------

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeRadialTex() {
  return canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function makeSquareTex() {
  return canvasTex(32, (ctx, s) => {
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
  });
}

function makeStreakTex() {
  return canvasTex(64, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s * 0.44, 0, s * 0.12, s);
  });
}

// ---------------------------------------------------------------------------
// Shared point shader (per-particle size, color, alpha)
// ---------------------------------------------------------------------------

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (320.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vColor, vAlpha) * tex;
    if (gl_FragColor.a < 0.01) discard;
  }
`;

function pointsMaterial(tex, blending) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending,
  });
}

// ---------------------------------------------------------------------------
// Particle pool: fixed-capacity CPU-simulated THREE.Points
// ---------------------------------------------------------------------------

class Pool {
  constructor(max, tex, blending) {
    this.max = max;
    this.cursor = 0;
    this.liveCount = 0;

    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 400);

    // Sim state (not sent to GPU)
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);      // seconds remaining (may include delay)
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);      // size growth per second
    this.grav = new Float32Array(max);      // y accel
    this.a0 = new Float32Array(max);        // base alpha
    this.windK = new Float32Array(max);     // wind influence

    this.points = new THREE.Points(g, pointsMaterial(tex, blending));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  // Spawn one particle. delay: seconds before it appears.
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, opts) {
    const i = this.cursor;
    this.cursor = (i + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.maxLife[i] = life;
    this.life[i] = life + (opts.delay || 0);
    this.size0[i] = size;
    this.size[i] = size;
    this.grow[i] = opts.grow || 0;
    this.grav[i] = opts.grav || 0;
    this.a0[i] = opts.alpha !== undefined ? opts.alpha : 1;
    this.windK[i] = opts.wind || 0;
    this.alpha[i] = 0;
  }

  update(dt, windX, windZ) {
    let live = 0;
    const { pos, vel, life, maxLife, size, size0, grow, grav, alpha, a0, windK, max } = this;
    for (let i = 0; i < max; i++) {
      let L = life[i];
      if (L <= 0) { if (alpha[i] !== 0) alpha[i] = 0; continue; }
      L -= dt;
      life[i] = L;
      const ml = maxLife[i];
      if (L > ml) { alpha[i] = 0; live++; continue; } // waiting on delay
      if (L <= 0) { alpha[i] = 0; continue; }
      const i3 = i * 3;
      vel[i3 + 1] += grav[i] * dt;
      const wk = windK[i];
      pos[i3] += (vel[i3] + windX * wk) * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += (vel[i3 + 2] + windZ * wk) * dt;
      const t = L / ml;                      // 1 → 0
      alpha[i] = a0[i] * (t < 0.75 ? t / 0.75 : (1 - t) * 4); // quick fade-in, linear out
      size[i] = size0[i] + grow[i] * (ml - L);
      live++;
    }
    this.liveCount = live;
    if (live > 0 || this._wasLive) {
      const g = this.points.geometry;
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
    }
    this._wasLive = live > 0;
    this.points.visible = live > 0;
  }
}

// ---------------------------------------------------------------------------
// Color helpers (preallocated)
// ---------------------------------------------------------------------------

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

const COL = {
  dust: 0xc9b28a, buildDust: 0xc4b291, wood: 0x9a6b3f, stone: 0x9d9484,
  sparkle: 0xd9a441, scare: 0xa8a49a, hit: 0xd8d4c8, splash: 0x7fb3c4,
  heart: 0xe88aa8, zzz: 0x8fa3c8, fire: 0xffd98a, fireHot: 0xff8c3a,
  smoke: 0xbbb6ad, firefly: 0xd9e8a0, rain: 0xaebcc8,
  ringFriend: 0x59c26a, ringHostile: 0xd9534f, markMove: 0x59c26a, markAttack: 0xd9534f,
};

function rnd(a, b) { return a + Math.random() * (b - a); }

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

const MAX_ATTACH = 24;
const MAX_RINGS = 40;
const MAX_MARKERS = 10;
const RAIN_MAX = 800;

const S = {
  scene: null,
  ready: false,
  t: 0,
  night: false,
  // pools
  soft: null,    // dust/smoke/splash — normal blending, radial tex
  glow: null,    // sparks/sparkle/fire — additive
  square: null,  // heart / zzz / chips — square tex
  // rain
  rain: null, rainOn: false, rainCount: 400, rainSpeed: 1,
  rainFollow: new THREE.Vector3(),
  // emitters / rings / markers
  attachments: new Set(),
  rings: new Map(),        // entity -> mesh
  ringFree: [],
  markers: [],             // preallocated {mesh, life}
  // textures / shared geo+mats
  texRadial: null, texSquare: null, texStreak: null,
  ringGeo: null, ringMatFriend: null, ringMatHostile: null,
  wind: new THREE.Vector2(0.35, 0.1),
};

function spawnRainDrop(i, fresh) {
  const p = S.rain;
  const i3 = i * 3;
  const f = S.rainFollow;
  p.pos[i3] = f.x + rnd(-14, 14);
  p.pos[i3 + 2] = f.z + rnd(-14, 14);
  p.pos[i3 + 1] = f.y + (fresh ? rnd(2, 18) : rnd(14, 18));
  p.vel[i3] = S.wind.x * 2;
  p.vel[i3 + 1] = -(18 + rnd(0, 6)) * S.rainSpeed;
  p.vel[i3 + 2] = S.wind.y * 2;
}

function initRain(scene) {
  const p = new Pool(RAIN_MAX, S.texStreak, THREE.NormalBlending);
  S.rain = p;
  _c.setHex(COL.rain);
  for (let i = 0; i < RAIN_MAX; i++) {
    const i3 = i * 3;
    p.col[i3] = _c.r; p.col[i3 + 1] = _c.g; p.col[i3 + 2] = _c.b;
    p.size[i] = rnd(0.5, 0.8);
    p.alpha[i] = 0;
  }
  p.points.visible = false;
  scene.add(p.points);
}

function updateRain(dt) {
  const p = S.rain;
  if (!S.rainOn) { if (p.points.visible) p.points.visible = false; return; }
  p.points.visible = true;
  const n = S.rainCount;
  const f = S.rainFollow;
  const floor = f.y - 4;
  for (let i = 0; i < RAIN_MAX; i++) {
    const i3 = i * 3;
    if (i >= n) { if (p.alpha[i] !== 0) p.alpha[i] = 0; continue; }
    p.alpha[i] = 0.55;
    p.pos[i3] += p.vel[i3] * dt;
    p.pos[i3 + 1] += p.vel[i3 + 1] * dt;
    p.pos[i3 + 2] += p.vel[i3 + 2] * dt;
    // recycle when below floor or drifted out of the camera box
    if (p.pos[i3 + 1] < floor ||
        Math.abs(p.pos[i3] - f.x) > 16 || Math.abs(p.pos[i3 + 2] - f.z) > 16) {
      spawnRainDrop(i, false);
    }
  }
  const g = p.points.geometry;
  g.attributes.position.needsUpdate = true;
  g.attributes.aAlpha.needsUpdate = true;
}

// --- burst recipes -------------------------------------------------------

function puff(pool, pos, hex, n, spd, up, life, size, opts) {
  _c.setHex(hex);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = spd * rnd(0.3, 1);
    const jr = _c.r * rnd(0.9, 1.1), jg = _c.g * rnd(0.9, 1.1), jb = _c.b * rnd(0.9, 1.1);
    pool.spawn(
      pos.x + Math.cos(a) * 0.15, pos.y + rnd(0, 0.25), pos.z + Math.sin(a) * 0.15,
      Math.cos(a) * r, up * rnd(0.6, 1.3), Math.sin(a) * r,
      life * rnd(0.7, 1.2), size * rnd(0.8, 1.3),
      jr, jg, jb, opts);
  }
}

const BURSTS = {
  dust(pos, o) {
    puff(S.soft, pos, COL.dust, o.count || 8, 0.7, 0.55, 0.7, 0.55, { grow: 0.9, alpha: 0.6, wind: 0.3 });
  },
  buildDust(pos, o) {
    puff(S.soft, pos, COL.buildDust, o.count || 16, 1.4, 0.8, 1.0, 0.9, { grow: 1.3, alpha: 0.65, wind: 0.3 });
  },
  woodChips(pos, o) {
    _c.setHex(COL.wood);
    const n = o.count || 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      S.square.spawn(pos.x, pos.y + 0.3, pos.z,
        Math.cos(a) * rnd(0.8, 2), rnd(1.5, 3), Math.sin(a) * rnd(0.8, 2),
        rnd(0.4, 0.7), rnd(0.1, 0.2), _c.r, _c.g, _c.b, { grav: -9, alpha: 1 });
    }
    puff(S.soft, pos, COL.dust, 3, 0.4, 0.4, 0.5, 0.4, { grow: 0.6, alpha: 0.4 });
  },
  stoneChips(pos, o) {
    _c.setHex(COL.stone);
    const n = o.count || 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      S.square.spawn(pos.x, pos.y + 0.3, pos.z,
        Math.cos(a) * rnd(0.8, 2.2), rnd(1.2, 2.8), Math.sin(a) * rnd(0.8, 2.2),
        rnd(0.35, 0.6), rnd(0.08, 0.16), _c.r, _c.g, _c.b, { grav: -10, alpha: 1 });
    }
    puff(S.soft, pos, COL.stone, 4, 0.5, 0.4, 0.5, 0.45, { grow: 0.6, alpha: 0.45 });
  },
  sparkle(pos, o) {
    _c.setHex(COL.sparkle);
    const n = o.count || 10;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = rnd(0.1, 0.5);
      S.glow.spawn(pos.x + Math.cos(a) * r, pos.y + rnd(0.2, 1.2), pos.z + Math.sin(a) * r,
        Math.cos(a) * 0.2, rnd(0.5, 1.1), Math.sin(a) * 0.2,
        rnd(0.6, 1.1), rnd(0.18, 0.32), _c.r, _c.g, _c.b,
        { alpha: 1, delay: Math.random() * 0.25 });
    }
  },
  scare(pos, o) {
    // grey puff ring expanding outward
    _c.setHex(COL.scare);
    const n = o.count || 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      S.soft.spawn(pos.x + Math.cos(a) * 0.3, pos.y + 0.4, pos.z + Math.sin(a) * 0.3,
        Math.cos(a) * 2.2, 0.3, Math.sin(a) * 2.2,
        0.55, 0.5, _c.r, _c.g, _c.b, { grow: 1.1, alpha: 0.55 });
    }
  },
  hit(pos, o) {
    puff(S.soft, pos, COL.hit, o.count || 6, 1.0, 0.7, 0.4, 0.35, { grow: 0.8, alpha: 0.7 });
  },
  splash(pos, o) {
    _c.setHex(COL.splash);
    const n = o.count || 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      S.soft.spawn(pos.x, pos.y + 0.1, pos.z,
        Math.cos(a) * rnd(0.5, 1.4), rnd(1.2, 2.4), Math.sin(a) * rnd(0.5, 1.4),
        rnd(0.4, 0.7), rnd(0.15, 0.28), _c.r, _c.g, _c.b, { grav: -7, alpha: 0.85 });
    }
  },
  heart(pos, o) {
    _c.setHex(COL.heart);
    const n = o.count || 4;
    for (let i = 0; i < n; i++) {
      S.square.spawn(pos.x + rnd(-0.2, 0.2), pos.y + rnd(0.6, 0.9), pos.z + rnd(-0.2, 0.2),
        rnd(-0.1, 0.1), rnd(0.5, 0.8), rnd(-0.1, 0.1),
        1.1, rnd(0.14, 0.2), _c.r, _c.g, _c.b, { delay: i * 0.15, alpha: 1 });
    }
  },
  zzz(pos, o) {
    _c.setHex(COL.zzz);
    const n = o.count || 3;
    for (let i = 0; i < n; i++) {
      S.square.spawn(pos.x + 0.15 + i * 0.08, pos.y + 1.6 + i * 0.1, pos.z,
        0.12, 0.35, 0.02,
        1.6, 0.12 + i * 0.045, _c.r, _c.g, _c.b, { delay: i * 0.45, alpha: 0.9 });
    }
  },
};

// --- attach emitters -----------------------------------------------------

function makeGlowSprite(hex, scale) {
  const mat = new THREE.SpriteMaterial({
    map: S.texRadial, color: hex, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(scale, scale, 1);
  sp.renderOrder = 6;
  return sp;
}

function updateAttachment(h, dt) {
  const obj = h.obj;
  if (!obj) return;
  obj.getWorldPosition(_v);
  h.acc += dt;

  if (h.type === 'fire') {
    // flickering glow + rising embers into the additive pool
    if (h.sprite) {
      const f = 0.75 + 0.25 * Math.sin(S.t * 11 + h.phase) * Math.sin(S.t * 6.3 + h.phase * 2);
      h.sprite.material.opacity = 0.4 * f + 0.2;
      const sc = h.glowScale * (0.9 + 0.14 * f);
      h.sprite.scale.set(sc, sc, 1);
    }
    const interval = 1 / h.rate;
    while (h.acc >= interval) {
      h.acc -= interval;
      const hot = Math.random() < 0.4;
      _c.setHex(hot ? COL.fireHot : COL.fire);
      S.glow.spawn(_v.x + rnd(-0.15, 0.15), _v.y + h.y, _v.z + rnd(-0.15, 0.15),
        rnd(-0.15, 0.15), rnd(0.9, 1.8), rnd(-0.15, 0.15),
        rnd(0.35, 0.6), rnd(0.1, 0.2), _c.r, _c.g, _c.b, { alpha: 1, wind: 0.15 });
    }
  } else if (h.type === 'smoke') {
    const interval = 1 / h.rate;
    while (h.acc >= interval) {
      h.acc -= interval;
      _c.setHex(h.color);
      _c.offsetHSL(0, 0, rnd(-0.03, 0.03));
      S.soft.spawn(_v.x + rnd(-0.1, 0.1), _v.y + h.y, _v.z + rnd(-0.1, 0.1),
        rnd(-0.1, 0.1), rnd(0.5, 0.9), rnd(-0.1, 0.1),
        rnd(1.6, 2.6), rnd(0.35, 0.55), _c.r, _c.g, _c.b,
        { grow: 0.55, alpha: 0.35, wind: 1 });
    }
  } else if (h.type === 'fireflies') {
    const p = h.points;
    p.visible = S.night;
    if (!S.night) return;
    const posA = p.geometry.attributes.position.array;
    const alA = p.geometry.attributes.aAlpha.array;
    for (let i = 0; i < h.n; i++) {
      const i3 = i * 3;
      const ph = h.phases[i];
      // slow Lissajous wander in a sphere around the anchor
      posA[i3] = _v.x + Math.sin(S.t * 0.31 * ph + ph * 7) * h.radius;
      posA[i3 + 1] = _v.y + h.y + (Math.sin(S.t * 0.23 * ph + ph * 3) * 0.5 + 0.5) * 1.4;
      posA[i3 + 2] = _v.z + Math.cos(S.t * 0.27 * ph + ph * 11) * h.radius;
      alA[i] = Math.max(0, Math.sin(S.t * 1.7 * ph + ph * 5)) * 0.9;
    }
    p.geometry.attributes.position.needsUpdate = true;
    p.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

// --- rings & markers -----------------------------------------------------

function makeRingMesh() {
  const mesh = new THREE.Mesh(S.ringGeo, S.ringMatFriend);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

function updateRings(dt) {
  for (const [entity, mesh] of S.rings) {
    if (entity.alive === false) { FX.unring(entity); continue; }
    const p = entity.pos;
    const gy = entity.groundY !== undefined ? entity.groundY : p.y;
    mesh.position.set(p.x, gy + 0.05, p.z);
    const base = (entity.selectRadius || 0.5) / 0.5;
    const pulse = 1 + 0.04 * Math.sin(S.t * 2.5 + (entity.id || 0));
    mesh.scale.setScalar(base * pulse);
    mesh.rotation.z += dt * 1.57; // subtle 4 s rotation
  }
}

function updateMarkers(dt) {
  for (let i = 0; i < S.markers.length; i++) {
    const m = S.markers[i];
    if (m.life <= 0) continue;
    m.life -= dt;
    if (m.life <= 0) { m.mesh.visible = false; continue; }
    const t = 1 - m.life / 0.8; // 0 → 1
    m.mesh.scale.setScalar(0.7 + t * 0.6);
    m.mesh.material.opacity = 0.9 * (1 - t);
  }
}

// --- camera follow point for rain ---------------------------------------

function resolveFollow(camera) {
  if (!camera) return;
  // Accept either a CameraRig (has .target Vector3 and .camera) or a THREE camera
  if (camera.target && camera.target.isVector3) {
    S.rainFollow.lerp(camera.target, 0.15);
    if (camera.camera && camera.camera.isCamera) {
      S.rainFollow.y = camera.camera.position.y * 0.3 + camera.target.y * 0.7;
    }
    return;
  }
  const cam = camera.isCamera ? camera : camera.camera;
  if (!cam || !cam.isCamera) return;
  cam.getWorldDirection(_v2);
  const d = Math.min(40, Math.max(8, cam.position.y * 1.1));
  _v.copy(cam.position).addScaledVector(_v2, d);
  _v.y = Math.max(0, _v.y);
  S.rainFollow.lerp(_v, 0.15);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const FX = {
  init(scene) {
    S.scene = scene;
    S.texRadial = makeRadialTex();
    S.texSquare = makeSquareTex();
    S.texStreak = makeStreakTex();

    S.soft = new Pool(192, S.texRadial, THREE.NormalBlending);
    S.glow = new Pool(96, S.texRadial, THREE.AdditiveBlending);
    S.square = new Pool(64, S.texSquare, THREE.NormalBlending);
    scene.add(S.soft.points, S.glow.points, S.square.points);

    initRain(scene);

    S.ringGeo = new THREE.RingGeometry(0.45, 0.55, 24);
    S.ringMatFriend = new THREE.MeshBasicMaterial({
      color: COL.ringFriend, transparent: true, opacity: 0.85, depthWrite: false,
      side: THREE.DoubleSide,
    });
    S.ringMatHostile = S.ringMatFriend.clone();
    S.ringMatHostile.color.setHex(COL.ringHostile);

    // marker pool (own materials — each fades independently)
    for (let i = 0; i < MAX_MARKERS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: COL.markMove, transparent: true, opacity: 0, depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(S.ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 3;
      mesh.visible = false;
      scene.add(mesh);
      S.markers.push({ mesh, life: 0 });
    }
    S._markerCursor = 0;
    S.ready = true;
  },

  update(dt, camera) {
    if (!S.ready) return;
    dt = Math.min(dt, 0.05);
    S.t += dt;
    // wind slowly veers
    S.wind.set(Math.sin(S.t * 0.05) * 0.5 + 0.4, Math.cos(S.t * 0.037) * 0.4);

    resolveFollow(camera);

    S.soft.update(dt, S.wind.x, S.wind.y);
    S.glow.update(dt, S.wind.x, S.wind.y);
    S.square.update(dt, S.wind.x, S.wind.y);
    updateRain(dt);

    for (const h of S.attachments) updateAttachment(h, dt);
    updateRings(dt);
    updateMarkers(dt);
  },

  burst(type, pos, opts = {}) {
    if (!S.ready) return;
    const fn = BURSTS[type];
    if (fn) fn(pos, opts);
  },

  attach(type, obj3d, opts = {}) {
    if (!S.ready || S.attachments.size >= MAX_ATTACH) return null;
    const h = {
      type, obj: obj3d, acc: 0, phase: Math.random() * 10,
      y: opts.y !== undefined ? opts.y : 0.4,
    };
    if (type === 'fire') {
      h.rate = opts.rate || 14;             // kumzitz: pass rate: 28
      h.glowScale = opts.scale || 1.6;
      h.sprite = makeGlowSprite(0xff8c3a, h.glowScale);
      h.sprite.position.y = h.y + 0.25;
      obj3d.add(h.sprite);
    } else if (type === 'smoke') {
      h.rate = opts.rate || 2;
      h.color = opts.color || COL.smoke;
      h.y = opts.y !== undefined ? opts.y : 0.8;
    } else if (type === 'fireflies') {
      h.n = Math.min(10, Math.max(6, opts.count || 8));
      h.radius = opts.radius || 2;
      h.phases = new Float32Array(h.n);
      for (let i = 0; i < h.n; i++) h.phases[i] = rnd(0.6, 1.4);
      const p = new Pool(h.n, S.texRadial, THREE.AdditiveBlending);
      _c.setHex(COL.firefly);
      for (let i = 0; i < h.n; i++) {
        const i3 = i * 3;
        p.col[i3] = _c.r; p.col[i3 + 1] = _c.g; p.col[i3 + 2] = _c.b;
        p.size[i] = 0.15;
        p.alpha[i] = 0;
      }
      p.points.visible = false;
      h.points = p.points;
      S.scene.add(p.points);
    } else {
      return null;
    }
    S.attachments.add(h);
    return h;
  },

  detach(handle) {
    if (!handle || !S.attachments.has(handle)) return;
    S.attachments.delete(handle);
    if (handle.sprite) {
      if (handle.sprite.parent) handle.sprite.parent.remove(handle.sprite);
      handle.sprite.material.dispose();
    }
    if (handle.points) {
      S.scene.remove(handle.points);
      handle.points.geometry.dispose();
      handle.points.material.dispose();
    }
  },

  weather(type) {
    if (!S.ready) return;
    S.rainOn = type === 'rain' || type === 'storm';
    S.rainSpeed = type === 'storm' ? 1.7 : 1;
    S.rainCount = type === 'storm' ? RAIN_MAX : 400;
    if (S.rainOn) {
      for (let i = 0; i < S.rainCount; i++) spawnRainDrop(i, true);
      S.rain.points.geometry.attributes.position.needsUpdate = true;
    }
  },

  ring(entity) {
    if (!S.ready || S.rings.has(entity)) return;
    if (S.rings.size >= MAX_RINGS) return;
    const mesh = S.ringFree.pop() || makeRingMesh();
    mesh.material = entity.hostile ? S.ringMatHostile : S.ringMatFriend;
    mesh.visible = true;
    if (!mesh.parent) S.scene.add(mesh);
    S.rings.set(entity, mesh);
  },

  unring(entity) {
    const mesh = S.rings.get(entity);
    if (!mesh) return;
    S.rings.delete(entity);
    mesh.visible = false;
    S.ringFree.push(mesh);
  },

  marker(pos, kind) {
    if (!S.ready) return;
    const m = S.markers[S._markerCursor];
    S._markerCursor = (S._markerCursor + 1) % MAX_MARKERS;
    m.life = 0.8;
    m.mesh.visible = true;
    m.mesh.material.color.setHex(kind === 'attack' ? COL.markAttack : COL.markMove);
    m.mesh.material.opacity = 0.9;
    m.mesh.position.set(pos.x, pos.y + 0.06, pos.z);
    m.mesh.scale.setScalar(0.7);
  },

  setNight(isNight) {
    S.night = !!isNight;
  },
};
