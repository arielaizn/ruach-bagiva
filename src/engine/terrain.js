// Procedural Samaria-hills terrain: ridged hill with agricultural terraces,
// golden dry grass, olive trees, boulders, a spring and a dirt road.
import * as THREE from 'three';
import { mulberry32, fbm2, clamp, lerp, smoothstep, dist2d, nextId } from '../core/util.js';

export const MAP_SIZE = 160;      // meters, square, centered at origin
export const CELL = 2;            // grid cell size in meters
export const GRID_N = MAP_SIZE / CELL; // 80

const SEGS = 128;                 // terrain mesh segments per side

const C = {
  grassDry: new THREE.Color(0xb5a55e),
  grassGreen: new THREE.Color(0x7d8f4a),
  grassGold: new THREE.Color(0xc9b46a),
  rock: new THREE.Color(0x9b9284),
  rockDark: new THREE.Color(0x7e766a),
  dirt: new THREE.Color(0xa08155),
  dirtDark: new THREE.Color(0x8a6d45),
  terrace: new THREE.Color(0x8f8676),
};

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.trees = [];
    this.stones = [];
    this.heightMap = null;
  }

  generate(cfg = {}) {
    this.cfg = cfg = Object.assign({
      seed: 7, hillHeight: 13, plateauRadius: 22, roughness: 1.0,
      treeDensity: 1.0, springAngle: 2.2, roadAngle: -0.6,
    }, cfg);
    this.rng = mulberry32(cfg.seed * 7919 + 13);
    this._clear();

    // Road entry on map edge + winding path control points to the plateau
    const half = MAP_SIZE / 2;
    const ra = cfg.roadAngle;
    this.roadEntry = { x: Math.cos(ra) * (half - 2), z: Math.sin(ra) * (half - 2) };
    this.center = { x: 0, z: 0 };
    this.pathPts = [];
    const P = 6;
    for (let i = 0; i <= P; i++) {
      const t = i / P;
      const wiggle = Math.sin(t * Math.PI * 2.2 + cfg.seed) * 9 * (1 - t) * t * 4;
      const x = lerp(this.roadEntry.x, 0, t) - Math.sin(ra) * wiggle;
      const z = lerp(this.roadEntry.z, 0, t) + Math.cos(ra) * wiggle;
      this.pathPts.push({ x, z });
    }

    this._buildHeightmap();

    // Spring on the slope
    const sa = cfg.springAngle;
    const sr = cfg.plateauRadius + 18;
    this.spring = { x: Math.cos(sa) * sr, z: Math.sin(sa) * sr };
    this._flattenArea(this.spring.x, this.spring.z, 5.5);

    this._buildMesh();
    this._buildGrid();
    this._buildSpringPool();
    this._buildRoadMarker();
    this._scatterDecorations();
    return this;
  }

  _clear() {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    this.trees.length = 0;
    this.stones.length = 0;
  }

  _distToPath(x, z) {
    let best = 1e9;
    for (let i = 0; i < this.pathPts.length - 1; i++) {
      const a = this.pathPts[i], b = this.pathPts[i + 1];
      const abx = b.x - a.x, abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      let t = len2 ? ((x - a.x) * abx + (z - a.z) * abz) / len2 : 0;
      t = clamp(t, 0, 1);
      best = Math.min(best, dist2d(x, z, a.x + abx * t, a.z + abz * t));
    }
    return best;
  }

  _rawHeight(x, z) {
    const cfg = this.cfg;
    const half = MAP_SIZE / 2;
    const d = Math.hypot(x, z);
    // main hill: cosine dome with noisy ridge
    const dome = Math.pow(Math.max(0, Math.cos((d / half) * Math.PI * 0.52)), 1.35) * cfg.hillHeight;
    const n1 = (fbm2(x * 0.012 + 31, z * 0.012 - 17, cfg.seed, 4) - 0.5) * 7 * cfg.roughness;
    const n2 = (fbm2(x * 0.05, z * 0.05, cfg.seed + 5, 3) - 0.5) * 1.6 * cfg.roughness;
    let h = dome + n1 * smoothstep(6, 30, d) + n2;
    // plateau flatten on top
    const flat = smoothstep(cfg.plateauRadius + 8, cfg.plateauRadius - 4, d);
    h = lerp(h, cfg.hillHeight * 0.92, flat * 0.92);
    // path carving: gentler + slightly sunken
    const pd = this._distToPath(x, z);
    const onPath = smoothstep(4.5, 1.2, pd);
    h = lerp(h, h - 0.35, onPath * 0.6);
    return h;
  }

  _buildHeightmap() {
    // sample raw heights, then apply terracing on slopes, into (SEGS+1)^2 map
    const N = SEGS + 1;
    const raw = new Float32Array(N * N);
    const step = MAP_SIZE / SEGS;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -MAP_SIZE / 2 + i * step, z = -MAP_SIZE / 2 + j * step;
        raw[j * N + i] = this._rawHeight(x, z);
      }
    }
    const hm = new Float32Array(N * N);
    const terStep = 1.15;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = j * N + i;
        const h = raw[idx];
        const hx = raw[j * N + Math.min(i + 1, N - 1)] - raw[j * N + Math.max(i - 1, 0)];
        const hz = raw[Math.min(j + 1, N - 1) * N + i] - raw[Math.max(j - 1, 0) * N + i];
        const slope = Math.hypot(hx, hz) / (2 * step);
        const x = -MAP_SIZE / 2 + i * step, z = -MAP_SIZE / 2 + j * step;
        const terrNoise = fbm2(x * 0.02 + 90, z * 0.02, this.cfg.seed + 9, 2);
        const terrAmt = smoothstep(0.12, 0.3, slope) * smoothstep(0.55, 0.25, slope) * smoothstep(0.35, 0.6, terrNoise);
        const terraced = Math.round(h / terStep) * terStep;
        const pd = this._distToPath(x, z);
        const onPath = smoothstep(4.5, 1.5, pd);
        hm[idx] = lerp(h, terraced, terrAmt * 0.85 * (1 - onPath));
      }
    }
    this.heightMap = hm;
    this._N = N;
    this._step = step;
  }

  _flattenArea(x, z, radius) {
    const N = this._N, step = this._step;
    const target = this.heightAt(x, z);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const wx = -MAP_SIZE / 2 + i * step, wz = -MAP_SIZE / 2 + j * step;
        const d = dist2d(wx, wz, x, z);
        if (d < radius + 4) {
          const t = smoothstep(radius + 4, radius * 0.5, d);
          this.heightMap[j * N + i] = lerp(this.heightMap[j * N + i], target, t);
        }
      }
    }
  }

  heightAt(x, z) {
    const N = this._N, step = this._step;
    const fx = clamp((x + MAP_SIZE / 2) / step, 0, N - 1.001);
    const fz = clamp((z + MAP_SIZE / 2) / step, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const hm = this.heightMap;
    const a = hm[j * N + i], b = hm[j * N + i + 1];
    const c = hm[(j + 1) * N + i], d = hm[(j + 1) * N + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  slopeAt(x, z) {
    const e = 1.2;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  }

  _buildMesh() {
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const h = this.heightAt(x, z);
      pos.setY(k, h);
      const slope = this.slopeAt(x, z);
      const moisture = fbm2(x * 0.03 + 200, z * 0.03, this.cfg.seed + 21, 3);
      const patch = fbm2(x * 0.09, z * 0.09 + 40, this.cfg.seed + 33, 2);
      // base grass: dry gold <-> olive green by moisture
      col.copy(C.grassDry).lerp(C.grassGreen, smoothstep(0.42, 0.72, moisture) * 0.85);
      col.lerp(C.grassGold, smoothstep(0.55, 0.8, patch) * 0.5);
      // rocky on slopes
      const rockAmt = smoothstep(0.28, 0.55, slope);
      col.lerp((patch > 0.5 ? C.rock : C.rockDark), rockAmt);
      // terrace lips slightly darker
      if (slope > 0.5) col.lerp(C.terrace, 0.35);
      // dirt path
      const pd = this._distToPath(x, z);
      const onPath = smoothstep(3.6, 1.4, pd);
      col.lerp((patch > 0.5 ? C.dirt : C.dirtDark), onPath * 0.9);
      // spring pool surroundings a bit greener
      const sd = dist2d(x, z, this.spring.x, this.spring.z);
      col.lerp(C.grassGreen, smoothstep(9, 4, sd) * 0.5);
      // subtle per-vertex variation
      const jitter = (fbm2(x * 0.35, z * 0.35, this.cfg.seed + 77, 2) - 0.5) * 0.09;
      col.offsetHSL(0, 0, jitter);
      colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'ground';
    this.group.add(this.mesh);

    // skirt so map edges don't show void
    const skirtGeo = new THREE.PlaneGeometry(MAP_SIZE * 3, MAP_SIZE * 3, 24, 24);
    skirtGeo.rotateX(-Math.PI / 2);
    const sp = skirtGeo.attributes.position;
    const scol = new Float32Array(sp.count * 3);
    for (let k = 0; k < sp.count; k++) {
      const x = sp.getX(k), z = sp.getZ(k);
      const d = Math.max(Math.abs(x), Math.abs(z));
      const inside = d < MAP_SIZE / 2 - 2;
      const edgeH = this.heightAt(clamp(x, -MAP_SIZE / 2 + 1, MAP_SIZE / 2 - 1), clamp(z, -MAP_SIZE / 2 + 1, MAP_SIZE / 2 - 1));
      const fall = smoothstep(MAP_SIZE / 2, MAP_SIZE * 1.1, d);
      sp.setY(k, inside ? edgeH - 0.15 : edgeH - 0.2 - fall * 26 + (fbm2(x * 0.01, z * 0.01, 5, 3) - 0.5) * 10 * fall);
      col.copy(C.grassDry).lerp(C.rockDark, 0.25 + fall * 0.3).offsetHSL(0, -0.05, -0.04 - fall * 0.06);
      scol[k * 3] = col.r; scol[k * 3 + 1] = col.g; scol[k * 3 + 2] = col.b;
    }
    skirtGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    skirtGeo.computeVertexNormals();
    const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    skirt.position.y = -0.05;
    this.group.add(skirt);
  }

  _buildGrid() {
    // walkable if local step between neighboring cells is small enough
    this.cellH = new Float32Array(GRID_N * GRID_N);
    this.blocked = new Uint8Array(GRID_N * GRID_N);   // static: steep/water/decor
    this.occupied = new Uint8Array(GRID_N * GRID_N);  // dynamic: buildings
    for (let cz = 0; cz < GRID_N; cz++) {
      for (let cx = 0; cx < GRID_N; cx++) {
        const { x, z } = this.cellToWorld(cx, cz);
        this.cellH[cz * GRID_N + cx] = this.heightAt(x, z);
      }
    }
    for (let cz = 0; cz < GRID_N; cz++) {
      for (let cx = 0; cx < GRID_N; cx++) {
        const h = this.cellH[cz * GRID_N + cx];
        let maxStep = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= GRID_N || nz >= GRID_N) continue;
          maxStep = Math.max(maxStep, Math.abs(this.cellH[nz * GRID_N + nx] - h));
        }
        if (maxStep > 1.75) this.blocked[cz * GRID_N + cx] = 1;
      }
    }
    // spring pool center is blocked
    const sc = this.worldToCell(this.spring.x, this.spring.z);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = sc.cx + dx, nz = sc.cz + dz;
      if (Math.abs(dx) + Math.abs(dz) <= 1 && nx >= 0 && nz >= 0 && nx < GRID_N && nz < GRID_N)
        this.blocked[nz * GRID_N + nx] = 1;
    }
  }

  worldToCell(x, z) {
    return {
      cx: clamp(Math.floor((x + MAP_SIZE / 2) / CELL), 0, GRID_N - 1),
      cz: clamp(Math.floor((z + MAP_SIZE / 2) / CELL), 0, GRID_N - 1),
    };
  }
  cellToWorld(cx, cz) {
    return { x: (cx + 0.5) * CELL - MAP_SIZE / 2, z: (cz + 0.5) * CELL - MAP_SIZE / 2 };
  }
  inBounds(cx, cz) { return cx >= 0 && cz >= 0 && cx < GRID_N && cz < GRID_N; }
  walkable(cx, cz) {
    if (!this.inBounds(cx, cz)) return false;
    const i = cz * GRID_N + cx;
    return !this.blocked[i] && !this.occupied[i];
  }
  buildable(cx, cz, w = 1, h = 1) {
    for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (!this.walkable(nx, nz)) return false;
      const { x, z } = this.cellToWorld(nx, nz);
      if (this.slopeAt(x, z) > 0.38) return false;
      if (dist2d(x, z, this.spring.x, this.spring.z) < 5) return false;
      if (Math.max(Math.abs(x), Math.abs(z)) > MAP_SIZE / 2 - 6) return false;
    }
    return true;
  }
  setOccupied(cx, cz, w, h, val) {
    for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) {
      if (this.inBounds(cx + dx, cz + dz)) this.occupied[(cz + dz) * GRID_N + (cx + dx)] = val ? 1 : 0;
    }
  }
  findWalkableNear(x, z, maxR = 10) {
    const c = this.worldToCell(x, z);
    if (this.walkable(c.cx, c.cz)) return c;
    for (let r = 1; r <= Math.ceil(maxR / CELL); r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.walkable(c.cx + dx, c.cz + dz)) return { cx: c.cx + dx, cz: c.cz + dz };
      }
    }
    return c;
  }

  _buildSpringPool() {
    const h = this.heightAt(this.spring.x, this.spring.z);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 20),
      new THREE.MeshLambertMaterial({ color: 0x4d8fb5, transparent: true, opacity: 0.92 })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(this.spring.x, h + 0.12, this.spring.z);
    this.group.add(pool);
    this.springPool = pool;
    // stone rim
    const rimGeo = new THREE.TorusGeometry(3.4, 0.35, 5, 14);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshLambertMaterial({ color: 0x8d8578 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.copy(pool.position);
    rim.position.y += 0.05;
    this.group.add(rim);
  }

  _buildRoadMarker() {
    // widen path color near entry is already done; add a small dirt apron at entry
    const h = this.heightAt(this.roadEntry.x, this.roadEntry.z);
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(5, 12),
      new THREE.MeshLambertMaterial({ color: 0x9a7d52 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(this.roadEntry.x, h + 0.06, this.roadEntry.z);
    this.group.add(apron);
  }

  _scatterDecorations() {
    const rng = this.rng;
    const cfg = this.cfg;
    // ---------- olive trees (instanced trunk + canopy) ----------
    const treeCount = Math.floor(170 * cfg.treeDensity);
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 1.7, 5);
    trunkGeo.translate(0, 0.85, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(1.5, 0);
    canopyGeo.scale(1, 0.78, 1);
    canopyGeo.translate(0, 2.5, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e5a3e });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x708455 });
    const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopyIM = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    trunkIM.castShadow = canopyIM.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const ccol = new THREE.Color();
    let placed = 0, guard = 0;
    while (placed < treeCount && guard++ < treeCount * 30) {
      const x = (rng() - 0.5) * (MAP_SIZE - 14), z = (rng() - 0.5) * (MAP_SIZE - 14);
      const d = Math.hypot(x, z);
      if (d < cfg.plateauRadius + 4) continue;                     // keep plateau open
      if (this._distToPath(x, z) < 4) continue;
      if (dist2d(x, z, this.spring.x, this.spring.z) < 7) continue;
      const slope = this.slopeAt(x, z);
      if (slope > 0.5) continue;
      const moist = fbm2(x * 0.03 + 200, z * 0.03, cfg.seed + 21, 3);
      if (rng() > 0.25 + moist * 0.75) continue;
      const c = this.worldToCell(x, z);
      if (!this.walkable(c.cx, c.cz)) continue;
      const y = this.heightAt(x, z);
      const sc = 0.75 + rng() * 0.75;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      p.set(x, y, z); s.set(sc, sc * (0.85 + rng() * 0.3), sc);
      m4.compose(p, q, s);
      trunkIM.setMatrixAt(placed, m4);
      canopyIM.setMatrixAt(placed, m4);
      ccol.setHex(0x708455).offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.1);
      canopyIM.setColorAt(placed, ccol);
      this.blocked[c.cz * GRID_N + c.cx] = 1;
      this.trees.push({ id: nextId(), x, z, y, wood: 35 + Math.floor(rng() * 20), alive: true, inst: placed, cx: c.cx, cz: c.cz });
      placed++;
    }
    trunkIM.count = canopyIM.count = placed;
    trunkIM.instanceMatrix.needsUpdate = canopyIM.instanceMatrix.needsUpdate = true;
    if (canopyIM.instanceColor) canopyIM.instanceColor.needsUpdate = true;
    this.group.add(trunkIM, canopyIM);
    this.treeTrunkIM = trunkIM; this.treeCanopyIM = canopyIM;

    // ---------- stone deposits (mineable boulder clusters) ----------
    const stoneCount = 16;
    const boulderGeo = new THREE.IcosahedronGeometry(1.4, 0);
    boulderGeo.scale(1, 0.72, 1);
    const boulderMat = new THREE.MeshLambertMaterial({ color: 0x97907f });
    const stoneIM = new THREE.InstancedMesh(boulderGeo, boulderMat, stoneCount * 3);
    stoneIM.castShadow = true;
    let si = 0;
    for (let k = 0; k < stoneCount && si < stoneCount * 3; k++) {
      let x, z, tries = 0;
      do {
        const ang = rng() * Math.PI * 2;
        const r = cfg.plateauRadius + 6 + rng() * (MAP_SIZE / 2 - cfg.plateauRadius - 18);
        x = Math.cos(ang) * r; z = Math.sin(ang) * r;
      } while ((this._distToPath(x, z) < 4 || this.slopeAt(x, z) > 0.55) && tries++ < 30);
      const c = this.worldToCell(x, z);
      if (!this.walkable(c.cx, c.cz)) continue;
      const cluster = [];
      for (let b = 0; b < 3; b++) {
        const bx = x + (rng() - 0.5) * 2.4, bz = z + (rng() - 0.5) * 2.4;
        const by = this.heightAt(bx, bz);
        const sc = 0.7 + rng() * 0.8;
        q.setFromAxisAngle(new THREE.Vector3(rng(), 1, rng()).normalize(), rng() * Math.PI);
        p.set(bx, by + 0.2, bz); s.set(sc, sc, sc);
        m4.compose(p, q, s);
        stoneIM.setMatrixAt(si, m4);
        ccol.setHex(0x97907f).offsetHSL(0, 0, (rng() - 0.5) * 0.12);
        stoneIM.setColorAt(si, ccol);
        cluster.push(si); si++;
      }
      this.blocked[c.cz * GRID_N + c.cx] = 1;
      this.stones.push({ id: nextId(), x, z, y: this.heightAt(x, z), stone: 110 + Math.floor(rng() * 50), alive: true, insts: cluster, cx: c.cx, cz: c.cz });
    }
    stoneIM.count = si;
    stoneIM.instanceMatrix.needsUpdate = true;
    if (stoneIM.instanceColor) stoneIM.instanceColor.needsUpdate = true;
    this.group.add(stoneIM);
    this.stoneIM = stoneIM;

    // ---------- dry bushes + sabra cacti (pure decor) ----------
    const bushCount = 160;
    const bushGeo = new THREE.IcosahedronGeometry(0.5, 0);
    bushGeo.scale(1, 0.6, 1); bushGeo.translate(0, 0.25, 0);
    const bushIM = new THREE.InstancedMesh(bushGeo, new THREE.MeshLambertMaterial({ color: 0x8f854f }), bushCount);
    for (let k = 0; k < bushCount; k++) {
      const x = (rng() - 0.5) * (MAP_SIZE - 10), z = (rng() - 0.5) * (MAP_SIZE - 10);
      const sc = 0.5 + rng() * 1.1;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      p.set(x, this.heightAt(x, z), z); s.set(sc, sc * (0.7 + rng() * 0.5), sc);
      m4.compose(p, q, s);
      bushIM.setMatrixAt(k, m4);
      ccol.setHex(rng() > 0.6 ? 0x7d8348 : 0x9c9058).offsetHSL(0, 0, (rng() - 0.5) * 0.1);
      bushIM.setColorAt(k, ccol);
    }
    bushIM.instanceMatrix.needsUpdate = true;
    this.group.add(bushIM);

    const cactusCount = 22;
    const padGeo = new THREE.BoxGeometry(0.7, 1.0, 0.18);
    padGeo.translate(0, 0.5, 0);
    const cactusIM = new THREE.InstancedMesh(padGeo, new THREE.MeshLambertMaterial({ color: 0x4c7a3d }), cactusCount * 3);
    let ci = 0;
    for (let k = 0; k < cactusCount; k++) {
      const x = (rng() - 0.5) * (MAP_SIZE - 16), z = (rng() - 0.5) * (MAP_SIZE - 16);
      if (Math.hypot(x, z) < cfg.plateauRadius) { continue; }
      const y = this.heightAt(x, z);
      const baseRot = rng() * Math.PI * 2;
      for (let b = 0; b < 3 && ci < cactusCount * 3; b++) {
        q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.4, baseRot + b * 1.1, (rng() - 0.5) * 0.5));
        const sc = 0.7 + rng() * 0.5;
        p.set(x + (rng() - 0.5) * 0.7, y, z + (rng() - 0.5) * 0.7); s.set(sc, sc, sc);
        m4.compose(p, q, s);
        cactusIM.setMatrixAt(ci, m4);
        ci++;
      }
    }
    cactusIM.count = ci;
    cactusIM.instanceMatrix.needsUpdate = true;
    this.group.add(cactusIM);
  }

  depleteTree(tree) {
    tree.alive = false;
    this.blocked[tree.cz * GRID_N + tree.cx] = 0;
    const m4 = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    m4.setPosition(tree.x, -10, tree.z);
    this.treeTrunkIM.setMatrixAt(tree.inst, m4);
    this.treeCanopyIM.setMatrixAt(tree.inst, m4);
    this.treeTrunkIM.instanceMatrix.needsUpdate = true;
    this.treeCanopyIM.instanceMatrix.needsUpdate = true;
  }

  depleteStone(stone) {
    stone.alive = false;
    this.blocked[stone.cz * GRID_N + stone.cx] = 0;
    const m4 = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    m4.setPosition(stone.x, -10, stone.z);
    for (const i of stone.insts) this.stoneIM.setMatrixAt(i, m4);
    this.stoneIM.instanceMatrix.needsUpdate = true;
  }

  nearestTree(x, z) {
    let best = null, bd = 1e9;
    for (const t of this.trees) {
      if (!t.alive) continue;
      const d = dist2d(x, z, t.x, t.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  nearestStone(x, z) {
    let best = null, bd = 1e9;
    for (const t of this.stones) {
      if (!t.alive) continue;
      const d = dist2d(x, z, t.x, t.z);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
}
