# Three.js Tech Research — Hilltop RTS

Target: vanilla Three.js **r160**, ES modules via import-map, no build step. Runs on a mid laptop (integrated GPU, e.g. Intel Iris Xe / Apple M1) at a locked 60 FPS render with a 30 Hz fixed simulation step. All numbers below are budgets for that hardware class.

---

## 1. Global performance budgets (mid laptop)

| Metric | Budget | Notes |
|---|---|---|
| Draw calls per frame | **≤ 150** (soft), 250 hard | `renderer.info.render.calls` — watch it in a debug HUD |
| Triangles per frame | ≤ 300k | Low-poly style makes this trivial; terrain is the biggest chunk |
| Shadow-casting lights | **1** (the sun `DirectionalLight`) | Never more. Point/spot shadows are off-limits |
| Shadow map size | 2048×2048 (1024 fallback) | One map, tight frustum (see §4) |
| Instanced meshes | ~10 InstancedMesh objects, 200–2000 instances each | Trees, rocks, grass tufts, olive trees, fences |
| Skinned meshes | 0 | Units are rigid-part hierarchies, animated in JS (cheap) |
| Textures | ~0 external; 1–2 tiny procedural `DataTexture`/`CanvasTexture` | Vertex colors do the work |
| JS sim tick | ≤ 4 ms per 30 Hz tick for ~30 units + economy | A* runs async-ish (budgeted per frame, §7) |
| GC pressure | Zero per-frame allocations in hot paths | Preallocate `Vector3`/`Raycaster`/arrays; reuse |
| localStorage save | ≤ 200 KB JSON | Plenty for outpost state |

Renderer setup:

```js
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // 1.5 cap saves ~40% fill on hiDPI
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

`setPixelRatio(min(dpr, 1.5))` is the single biggest fill-rate lever on integrated GPUs. Offer a "quality" toggle that drops it to 1 and shadow map to 1024.

---

## 2. Low-poly procedural modelling patterns

### 2.1 The core recipe: primitive composition + vertex colors + flat shading

Every model = a handful of `BoxGeometry` / `CylinderGeometry` / `ConeGeometry` / `IcosahedronGeometry(r, 0)` parts, vertex-colored, merged into ONE `BufferGeometry`, rendered with ONE shared material:

```js
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// Use this ONE material for nearly everything → materials never break batching logic
// Lambert, not Standard: per-vertex-ish lighting is cheaper and suits low-poly

function paint(geo, hex) {                    // fill color attribute
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function part(geo, hex, x=0, y=0, z=0, rx=0, ry=0, rz=0, s=1) {
  paint(geo, hex);
  geo.scale(s, s, s); geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

// Example: olive tree → one geometry, one draw call (or one instance)
function makeOliveTree() {
  const parts = [
    part(new THREE.CylinderGeometry(0.12, 0.22, 1.1, 5), 0x6b4f2e, 0, 0.55, 0),
    part(new THREE.IcosahedronGeometry(0.75, 0), 0x7a8f57, 0.1, 1.5, 0),
    part(new THREE.IcosahedronGeometry(0.5, 0), 0x6d854e, -0.45, 1.25, 0.2),
  ];
  const geo = BufferGeometryUtils.mergeGeometries(parts, false);
  geo.computeVertexNormals();
  return geo;
}
```

Key details:
- `mergeGeometries` requires identical attribute sets on all parts — always paint color before merging, and delete `uv` if you don't use it (`geo.deleteAttribute('uv')`) so sets match.
- For a true faceted look with vertex colors you need **non-indexed** geometry per flat face. `geo = geo.toNonIndexed()` before `computeVertexNormals()` gives each triangle its own vertices — this also lets you tint individual faces (e.g. darker underside of rocks, sun-bleached caravan roof).
- Slight per-vertex color jitter (±5% lightness via `Color.offsetHSL(0, 0, (Math.random()-0.5)*0.08)`) kills the "plastic" look for free.
- Rocks: `IcosahedronGeometry(r, 0or1)` with randomly displaced vertices (`pos.setXYZ(i, x*rand(0.7,1.3), ...)`) then `toNonIndexed()`.
- Caravan/container: single `BoxGeometry` with corrugation faked by 3–4 thin box ribs; window/door as darker-painted inset boxes. 40–120 tris each.
- Humans/sheep/dogs: 6–9 boxes in a small `Group` hierarchy (torso, head, 4 legs). Animate by rotating leg pivots in JS — no skeletons. A sheep is ~60 tris.

### 2.2 Palette discipline

Define one `PALETTE = { rock: 0x9d9484, soil: 0xb99a6b, oliveLeaf: 0x7a8f57, pine: 0x4f6b3a, tarp: 0x3e5c7a, ... }` module. Hilltop Samaria look: pale limestone, dusty olive greens, terracotta, weathered blue tarps, rusted container red-brown.

---

## 3. Instancing and merging strategy

Rule of thumb:
- **Static, many copies of the same thing** (trees, rocks, grass tufts, fence posts) → `InstancedMesh`.
- **Static, unique-ish, near each other** (a built structure's sub-parts, terrain decorations placed once) → merge into one `BufferGeometry` at build time.
- **Dynamic** (units, animals) → individual `Mesh`/`Group` per unit; at ≤ 40 units this is ~200 draw calls worst case if unmerged parts — so **merge each unit's static body into 1 geometry** and keep only animated parts (legs, head) separate → ~3 draw calls/unit → ≤ 120 total, fine. Or go further: rigid-part units with parts merged and legs animated by a tiny vertex trick isn't worth it at n=30; keep it simple.

### 3.1 InstancedMesh recipe (vegetation/rocks)

```js
const treeGeo = makeOliveTree();
const trees = new THREE.InstancedMesh(treeGeo, MAT, 800);
trees.castShadow = true; trees.receiveShadow = true;
const m = new THREE.Matrix4(), p = new THREE.Vector3(),
      q = new THREE.Quaternion(), s = new THREE.Vector3();
let count = 0;
for (const spot of treeSpots) {
  p.set(spot.x, terrainHeightAt(spot.x, spot.z), spot.z);
  q.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
  const k = 0.8 + Math.random() * 0.5; s.set(k, k * (0.9 + Math.random()*0.3), k);
  trees.setMatrixAt(count++, m.compose(p, q, s));
}
trees.count = count;                       // draw only what's placed
trees.instanceMatrix.needsUpdate = true;
trees.instanceMatrix.setUsage(THREE.StaticDrawUsage); // never changes after placement
scene.add(trees);
```

- Per-instance color variation: `trees.setColorAt(i, color)` + `trees.instanceColor.needsUpdate = true` — works with `vertexColors` (they multiply). Use it for autumn tint, dead trees, etc.
- Hiding an instance (chopped tree): swap its matrix with the last live one and decrement `trees.count` (O(1) removal), or scale it to 0.
- Frustum culling for `InstancedMesh` is all-or-nothing over the whole mesh. With a map ~256×256 m and one camera this is fine — but set `trees.frustumCulled = true` and give the geometry a correct `boundingSphere` covering the placed area, or just set `frustumCulled = false` and eat the vertex cost (cheap at low poly). For bigger maps, split into 4 quadrant InstancedMeshes.
- Grass tufts: cross-plane pairs or 3-blade fans, `MeshLambertMaterial` double-sided, 1000–3000 instances, **castShadow = false** (huge shadow-pass saving), receiveShadow = false (they're tiny).

### 3.2 Merging built structures

When the player places a structure, build it from parts, `mergeGeometries`, one Mesh. When it's destroyed/dismantled, dispose geometry (`geo.dispose()`). Never leak: keep a registry of created geometries.

---

## 4. Shadows: one sun, tight frustum, follow the camera

```js
const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
const S = 60;                              // half-extent of shadowed area in meters
sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
sun.shadow.camera.top = S;  sun.shadow.camera.bottom = -S;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.5;               // fixes acne on flat-shaded low-poly best
scene.add(sun, sun.target);
```

Budget rules:
- **Only one shadow map in the game, ever.** Night "lights" (campfire, generator lamp) are shadowless `PointLight`s (max 2–3 active) or, cheaper, emissive-colored vertex glow + a fake blob.
- Shadow camera **follows the ortho/RTS camera target**: every frame set `sun.position.copy(camTarget).add(sunDir·dist)` and `sun.target.position.copy(camTarget)`. Snap the shadow camera position to texel-size increments to stop shadow shimmer while panning:

```js
const texel = (2 * S) / 2048;
sun.target.position.set(Math.round(camTarget.x/texel)*texel, 0, Math.round(camTarget.z/texel)*texel);
```

- `normalBias` (not just `bias`) is the fix for flat-shaded acne; start at 0.3–0.8.
- Grass/small props: no cast; terrain: receive only; trees/rocks/buildings/units: cast+receive.
- Quality toggle: 1024 map + `PCFShadowMap` for low-end.

---

## 5. Heightmap terrain with vertex-color splatting

One `PlaneGeometry(w, h, segX, segZ)` rotated flat; 256×256 m at **128×128 segments** = 32k tris — fine as ONE draw call. Displace Y from procedural noise (value noise / simplex — inline a small simplex implementation, ~60 lines, no dependency).

```js
const geo = new THREE.PlaneGeometry(256, 256, 128, 128);
geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position;
const col = new Float32Array(pos.count * 3);
const c = new THREE.Color();
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), z = pos.getZ(i);
  const h = hillHeight(x, z);              // fbm noise, biased so outpost hilltop is flat-ish
  pos.setY(i, h);
  // "Splatting" = choose color from height + slope + noise
  const slope = terrainSlopeAt(x, z);      // finite differences on hillHeight
  if (slope > 0.55)      c.setHex(0x9d9484);        // exposed limestone
  else if (h > 14)       c.setHex(0xb0a284);        // dry hilltop grass
  else if (h > 6)        c.setHex(0x8f9a62);        // scrub green
  else                   c.setHex(0x7d8a55);        // valley green
  c.offsetHSL(0, 0, (noise2(x*0.3, z*0.3)) * 0.05); // patchiness
  c.toArray(col, i * 3);
}
geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
geo.computeVertexNormals();
const terrain = new THREE.Mesh(geo, MAT); terrain.receiveShadow = true;
```

- Keep an analytic/lookup `terrainHeightAt(x, z)` function (same noise, or bilinear sample of a stored Float32 height grid) — used by placement, units, camera, projectiles. **Never raycast the terrain for height queries** in gameplay code; raycast only for mouse picking.
- Hand-author the outpost hill: `h = fbm(x,z)*amp * falloff + plateau(x,z)` where `plateau` flattens a disc at the build site. Terraces: quantize height near the hill (`h = Math.round(h/1.5)*1.5`) for that Samaria agricultural-terrace look.
- Paths appear where units walk: optional — darken vertex colors along frequently used route polylines at build time (dirt path baked in), don't do dynamic repainting.

---

## 6. Picking: raycast is enough at this scale (with hygiene)

At ≤ 40 units + ≤ 60 buildings, `THREE.Raycaster` is comfortably sub-millisecond **if you don't raycast the whole scene graph**:

- Maintain a flat `pickables` array (unit hit-proxies + building meshes + terrain). Call `raycaster.intersectObjects(pickables, false)` — `recursive:false`, curated list.
- Give each unit an **invisible hit-proxy**: one `BoxGeometry` sized to the unit, `material.visible = false` won't work for raycast skipping — instead use a Mesh with `visible=true` on a `Layers` channel the camera doesn't render, or simply an invisible-material mesh and raycast against geometry anyway: simplest robust pattern is a visible=false mesh + manual ray-vs-Box3 test:

```js
// cheap unit picking: ray vs Box3 per unit (no geometry raycast at all)
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function pickUnit(e) {
  ndc.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
  ray.setFromCamera(ndc, camera);
  let best = null, bestT = Infinity; const hit = new THREE.Vector3();
  for (const u of units) {
    u.box.setFromCenterAndSize(u.pos, u.size);        // reuse a Box3 per unit
    if (ray.ray.intersectBox(u.box, hit)) {
      const t = hit.distanceToSquared(ray.ray.origin);
      if (t < bestT) { bestT = t; best = u; }
    }
  }
  return best;
}
```

- Terrain ground-point: `ray.ray.intersectPlane(groundPlane, out)` against y=0 plane then snap `out.y = terrainHeightAt(out.x, out.z)` — good enough on gentle hills and 100× cheaper than mesh raycast. For steep hills, iterate 2–3 times (re-plane at sampled height).
- Raycasting `InstancedMesh` works in r160 and returns `instanceId` — use it for tree-chopping clicks; it tests every instance, so keep it to click events only (never per-frame hover on 2000 instances; for hover, throttle to ~10 Hz).
- **GPU picking verdict: skip it.** GPU color-ID picking (render IDs to a 1×1 render target + `readRenderTargetPixels`) only pays off at thousands of pickable dynamic objects, costs an extra render pass, and `readPixels` stalls the pipeline. Not justified at RTS-of-30-units scale.

---

## 7. Pathfinding: A* on a grid + steering for ~30 units

- Grid: 1 m cells over the map → 256×256 = 65k cells; store walkability + move cost in a `Uint8Array`. Rebuild locally when buildings are placed/removed (mark footprint cells blocked, plus a 0.5-cell inflation for unit radius).
- A* with 8-way movement, octile heuristic, binary heap. A 256² A* solve is typically < 2 ms; with ≤ 30 units and staggered requests this never spikes:

```js
// Budgeted path service: at most N solves per sim tick
const queue = [];
function requestPath(unit, from, to) { queue.push({unit, from, to}); }
function pathServiceTick() {
  let budget = 3;                          // solves per tick — 90/sec at 30 Hz
  while (queue.length && budget--) {
    const job = queue.shift();
    job.unit.setPath(astar(grid, snap(job.from), snap(job.to)));
  }
}
```

A* mini-recipe (heap omitted for brevity — use a 30-line binary heap, not array sort):

```js
const DIRS = [[1,0,10],[-1,0,10],[0,1,10],[0,-1,10],[1,1,14],[1,-1,14],[-1,1,14],[-1,-1,14]];
function astar(g, s, e) {
  const W = g.w, open = new MinHeap(), came = new Int32Array(W*g.h).fill(-1),
        cost = new Float32Array(W*g.h).fill(Infinity);
  const id = (x,y) => y*W + x, h = (x,y) => { const dx=Math.abs(x-e.x), dy=Math.abs(y-e.y);
        return 10*(dx+dy) - 6*Math.min(dx,dy); };
  cost[id(s.x,s.y)] = 0; open.push(id(s.x,s.y), h(s.x,s.y));
  while (open.size) {
    const cur = open.pop(), cx = cur % W, cy = (cur / W) | 0;
    if (cx === e.x && cy === e.y) return reconstruct(came, cur, W);
    for (const [dx,dy,w] of DIRS) {
      const nx = cx+dx, ny = cy+dy;
      if (nx<0||ny<0||nx>=W||ny>=g.h||g.blocked[id(nx,ny)]) continue;
      if (dx&&dy && (g.blocked[id(cx,ny)]||g.blocked[id(nx,cy)])) continue; // no corner cutting
      const nc = cost[cur] + w * g.cost[id(nx,ny)];
      if (nc < cost[id(nx,ny)]) { cost[id(nx,ny)]=nc; came[id(nx,ny)]=cur;
        open.push(id(nx,ny), nc + h(nx,ny)); }
    }
  }
  return null;
}
```

- **String-pull / smooth** the raw path (skip waypoints while line-of-walkable holds via grid line test) so units don't zigzag.
- **Steering on top:** units follow waypoints with seek + arrival, plus local **separation** from other units (inverse-distance push within 1.2 m) and slide-along-obstacle. Do NOT re-path for unit-vs-unit collisions; separation handles it. Re-path only if pushed > 2 cells off path or the grid changed under the path.
- Group moves: one A* for the group centroid target, assign formation offsets (small grid around target point) so 8 shepherds don't fight for one cell.
- Flocks (sheep): pure boids (separation/cohesion/alignment) + attraction to shepherd, no A* — sheep clipping a rock corner occasionally is charming, not a bug. Wolves: A* to flock centroid, flee vector when beaten.

---

## 8. Drag-selection rectangle

Screen-space test — project each unit's position to NDC→pixels, test against rect. At 30 units this is nothing:

```js
// on pointerdown store (x0,y0); on move draw a CSS <div> rect; on up:
const v = new THREE.Vector3();
function unitsInRect(x0, y0, x1, y1) {
  const [minX,maxX] = [Math.min(x0,x1), Math.max(x0,x1)],
        [minY,maxY] = [Math.min(y0,y1), Math.max(y0,y1)], out = [];
  for (const u of units) {
    v.copy(u.pos).project(camera);                 // to NDC
    if (v.z < -1 || v.z > 1) continue;             // behind camera
    const sx = (v.x + 1) / 2 * innerWidth, sy = (-v.y + 1) / 2 * innerHeight;
    if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) out.push(u);
  }
  return out;
}
```

- The rectangle itself: absolutely-positioned `div` with `border: 1px solid; background: rgba(...,0.15)`, `pointer-events: none`. Don't draw it in WebGL.
- Click vs drag threshold: treat as click if drag < 5 px. Shift adds to selection. Only select player units; drag never selects buildings (click does).
- RTL note: rect math is pure pixels — unaffected by the Hebrew RTL UI.

---

## 9. Camera: perspective-isometric default + cinematic blend

**Use a perspective camera for both modes.** True `OrthographicCamera` gives the cleanest RTS read but makes the mode toggle a projection-matrix switch that's ugly to blend. A perspective camera with **low FOV (20–25°) at long distance** is visually ~ortho ("telephoto isometric") and blends to the cinematic view by lerping plain numbers:

| | Iso mode | Cinematic mode |
|---|---|---|
| FOV | 22° | 45° |
| Pitch | 52° down | 18° down |
| Distance | 90 m | 18 m |

```js
// Camera rig: yaw/pitch/dist around a ground target — everything is lerpable
const rig = { target: new THREE.Vector3(), yaw: Math.PI/4, pitch: 0.9, dist: 90, fov: 22 };
const goal = { ...iso };                    // switch by copying iso/cine presets into goal
function updateCamera(dt) {
  const k = 1 - Math.pow(0.001, dt);        // frame-rate-independent smoothing
  rig.pitch += (goal.pitch - rig.pitch) * k;
  rig.dist  += (goal.dist  - rig.dist ) * k;
  rig.fov   += (goal.fov   - rig.fov  ) * k;
  rig.target.lerp(goal.target, k);
  camera.fov = rig.fov; camera.updateProjectionMatrix();
  camera.position.set(
    rig.target.x + rig.dist * Math.cos(rig.pitch) * Math.sin(rig.yaw),
    rig.target.y + rig.dist * Math.sin(rig.pitch),
    rig.target.z + rig.dist * Math.cos(rig.pitch) * Math.cos(rig.yaw));
  camera.lookAt(rig.target);
}
```

- FOV lerp must go with distance lerp in opposite directions (dolly-zoom-ish) or the blend feels like a lurch — the preset pairs above are tuned so apparent subject size changes smoothly.
- Pan: move `rig.target` along camera-relative XZ, clamp to map bounds, snap `target.y = terrainHeightAt(...)`. Zoom: scale `dist` (clamp 12–140). Rotate: `yaw` free, `pitch` clamp [0.25, 1.35].
- Edge-scroll + WASD (and Hebrew keyboard: also arrow keys — letter positions differ) + middle-drag rotate.
- Don't use OrbitControls; a bespoke ~80-line rig is easier to constrain and to drive from cinematic events (e.g. auto-focus on a raid).

---

## 10. Day/night cycle: lerp everything from one `t`

Single source of truth `dayT ∈ [0,1)`. Define keyframes and lerp; every lighting-ish value hangs off it:

```js
const KEYS = [ // t, sunColor, sunIntensity, hemiSky, hemiGround, hemiInt, fogColor, skyTop, skyBottom
  { t: 0.00, sun: 0x1a2340, si: 0.05, sky: 0x0e1526, fog: 0x0c1220 },  // midnight
  { t: 0.23, sun: 0xff9a5c, si: 1.20, sky: 0x6a7fae, fog: 0xc9a98b },  // dawn
  { t: 0.35, sun: 0xfff2dd, si: 2.60, sky: 0xa8c4e0, fog: 0xcfd8e6 },  // morning
  { t: 0.60, sun: 0xfff7e8, si: 2.90, sky: 0xb6d0ea, fog: 0xd8e0ec },  // noon-ish
  { t: 0.75, sun: 0xffb066, si: 1.40, sky: 0x8e7fa8, fog: 0xd8b090 },  // golden hour
  { t: 0.85, sun: 0x33406b, si: 0.15, sky: 0x1c2742, fog: 0x141c30 },  // dusk→night
];
```

- Interpolate colors with `Color.lerpColors(a, b, k)` into preallocated Colors; apply to `sun.color/intensity`, a `HemisphereLight` (sky/ground colors — this is your cheap ambient/GI), `scene.fog.color`, and the sky gradient.
- Sun direction: rotate azimuth+elevation from `dayT`; below ~5° elevation, fade `sun.intensity` to near 0 and **disable `sun.castShadow` at night** (saves the whole shadow pass ~8 hours/day of game time). A dim bluish "moon" is just the same directional light re-colored — never a second shadow light.
- Sky: a big inverted sphere (or `BackSide` sphere) with a tiny custom `ShaderMaterial` doing a 2-stop vertical gradient (uniforms `topColor`, `bottomColor`, lerped from KEYS), `fog: false`, `depthWrite: false`. ~15 lines of GLSL; stars at night = one `Points` object faded in by `dayT`.
- Fog: `scene.fog = new THREE.Fog(color, 60, 240)`. Match `fog.color` ≈ `skyBottom` so terrain melts into the horizon. Pull `near` in at dawn for a valley-mist moment.
- Shabbat visual: warm candle-window glow (emissive vertex colors swapped on house geometry) + slightly rosier golden hour. Cheap, evocative.

---

## 11. Particles with `Points`

One `Points` pool per effect type (campfire smoke, dust puffs, fireflies, rain is out of scope). Pool of N particles, attributes updated in place, `DynamicDrawUsage`:

```js
const N = 256;
const pgeo = new THREE.BufferGeometry();
pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3), 3).setUsage(THREE.DynamicDrawUsage));
pgeo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
const pmat = new THREE.PointsMaterial({ size: 0.6, color: 0xbbb6ad, transparent: true,
  opacity: 0.5, depthWrite: false, sizeAttenuation: true });
const smoke = new THREE.Points(pgeo, pmat); smoke.frustumCulled = false;
// per sim tick: advance alive particles (rise + wind drift + grow), respawn dead at emitter,
// park dead ones at y = -9999; set needsUpdate = true on both attributes.
```

- `depthWrite: false` + additive or normal blending avoids sorting artifacts. Soft round dot: a tiny 32×32 radial-gradient `CanvasTexture` as `map` (still zero external assets).
- Per-particle size/fade needs a small `ShaderMaterial` (pass `aLife`, compute `gl_PointSize` and alpha) — worth it for smoke; plain `PointsMaterial` is fine for dust/fireflies.
- Budget: ≤ 1000 live points total across all systems; one draw call per system, ≤ 5 systems.
- Campfire flame itself: 2–3 flat-shaded cone meshes scaling/flickering by sine noise + an orange `PointLight` (no shadow, distance 8) — reads better than particles at low-poly.

---

## 12. Fixed-timestep game loop

Simulate at 30 Hz, render at display rate, interpolate visuals:

```js
const STEP = 1 / 30; let acc = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min((now - last) / 1000, 0.25); last = now;   // clamp: tab-back spiral guard
  while (acc >= STEP) { simTick(STEP); acc -= STEP; }        // deterministic-ish sim
  const alpha = acc / STEP;
  for (const u of units) u.mesh.position.lerpVectors(u.prevPos, u.pos, alpha);
  updateCamera((now - lastRender) / 1000); updateDayNight(); updateParticles();
  renderer.render(scene, camera);
}
```

- Each entity stores `prevPos`/`pos` (copy pos→prevPos at tick start) → buttery movement at any FPS with a cheap 30 Hz sim.
- Everything gameplay (economy, AI, combat, pathfollow) lives in `simTick`; everything cosmetic (leg swing phase, smoke, camera) in render update using real dt.
- `document.hidden` → pause sim (also pauses/suspends AudioContext). Game speed ×1/×2: run `simTick` more times per frame, not a bigger STEP.

---

## 13. WebAudio: 100% procedural SFX + generative music

One `AudioContext`, created on first user gesture (`ctx.resume()` in the first click handler — autoplay policy). Master chain: `master(Gain) → compressor(DynamicsCompressor) → destination`, plus separate `sfxGain`/`musicGain`/`ambienceGain` for the settings sliders. Positional audio: for an RTS camera, plain stereo pan by screen-x + volume by distance-to-camera-target is enough; skip `PannerNode` HRTF (CPU).

### 13.1 Building blocks

```js
function noiseBuffer(ctx, secs = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;                                    // make once, reuse everywhere
}
function env(ctx, g, t0, a, d, peak = 1, sustain = 0) {  // simple AD(S) on a GainNode
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 1e-4), t0 + a + d);
}
```

### 13.2 SFX recipes (all: source → filter → gain(env) → sfxGain)

- **Wind (looping ambience):** noise loop → lowpass, `freq` slowly wandering 220–500 Hz via `setTargetAtTime` every ~2 s, gain wandering 0.05–0.18. Add a second bandpass copy at ~800 Hz, Q 1.5, very quiet, for "whistle" gusts. Hilltops are windy — this is the base layer.
- **Birds (day):** short chirp = sine osc, `freq.setValueAtTime(2400+rand·800)` then `exponentialRampToValueAtTime(freq·(0.6+rand·0.8), +0.08)`, env a=0.005 d=0.1. Fire 2–5 chirps in a cluster with 60–120 ms gaps; clusters at random 3–12 s intervals, only when `dayT` in daylight.
- **Crickets (night):** square osc ~4.2 kHz → bandpass 4.2 kHz Q 8 → gain gated by an LFO: `lfo(osc, 25 Hz, square)` into gate gain. 2 instances slightly detuned (4.1/4.3 kHz), overall gain ~0.03. Fade in/out with `dayT`.
- **Jackal howl (night event):** sawtooth → lowpass 900 Hz → gain. Pitch contour: start 380 Hz, `linearRamp` up to 620 over 0.5 s, wobble (LFO 6 Hz, depth 25 Hz on `osc.frequency`), fall to 300 over 0.8 s. Add 2–3 echoes: same call, delayed 0.4/0.9 s, −8 dB each, lowpassed more (distant pack answering). Trigger a chorus of 2–4 with random offsets. Genuinely evocative and ~20 lines.
- **Sheep bleat:** sawtooth ~500→430 Hz over 0.4 s → bandpass ~900 Hz Q 3 (formant) → gain with **AM tremolo 28 Hz depth 0.5** (the "eh-eh-eh"). Randomize base pitch ±20% per sheep so named sheep sound individual (seed by sheep id).
- **Thud (build/chop/impact):** sine 90 Hz, pitch drop to 45 Hz over 0.09 s, env a=0.002 d=0.12 + a burst of noise → lowpass 400 Hz, d=0.05. Axe-on-wood: add short noise burst bandpassed 2 kHz, d=0.03. Stone: noise → highpass 1kHz "tick" + lower thud.
- **Shofar blast:** sawtooth ~230 Hz (tekiah) → lowpass sweeping 600→1800 Hz over the note (brassy bloom) → slight distortion (`WaveShaperNode`, gentle tanh curve) → gain a=0.06. Pitch wavers: LFO 5 Hz depth 4 Hz. Ends with an upward flip to ~345 Hz (the "shevarim" break) then hard stop. Layer a quiet octave-up saw for edge.
- **Generator (loop near machine):** sawtooth 55 Hz + square 110 Hz slightly detuned → lowpass 300 Hz, AM at 13 Hz depth 0.2 (chug). Volume by camera distance. Cuts off on Shabbat — a lovely diegetic silence.
- **Dog bark:** noise burst → bandpass 1.1 kHz Q 2 + saw 300→200 Hz, 2 bursts 0.12 s apart, env d=0.08.
- **UI click:** sine 1200 Hz d=0.03 + 1800 Hz d=0.02, −18 dB. Keep UI sounds tiny and dry.

Fire-and-forget pattern (nodes are cheap; create per event, they GC after `stop`):

```js
function play(build) {                        // build(t0) wires nodes, returns [node, stopAt]
  const t0 = ctx.currentTime + 0.01;
  const [src, end] = build(t0);
  src.start(t0); src.stop(end);
}
```

Cap concurrent SFX (~12 voices) — count active and drop lowest-priority.

### 13.3 Generative music: pentatonic pad + oud-ish plucks

Scale: **D minor pentatonic with a Hijaz-flavored variant** for events (D–E♭–F♯–G–A–B♭–C over D drone reads instantly "Middle Eastern"). Keep it modal over a drone — no chord changes needed.

- **Pad layer:** 3 detuned triangle oscs (root, fifth, octave; ±4 cents) → lowpass 700 Hz with slow LFO on cutoff → long-attack gain (a=3 s). Retrigger a different chord tone every 12–20 s. This alone is a soundtrack.
- **Drone:** one sine + one triangle at D2/D3, −20 dB, always on (daytime); swap to darker A1 at night.
- **Oud-ish pluck:** the trick is Karplus-Strong-lite without ScriptProcessor: sawtooth → bandpass (freq = note, Q 6) → fast-decay env (a=0.003, d=0.5·(1+rand)), plus a second saw a few cents off, plus a very short noise "pick" transient highpassed 3 kHz d=0.01. Slide into some notes: `frequency.setValueAtTime(note·0.94)` then `linearRamp` to note over 0.06 s (the slide sells "oud"). True Karplus-Strong via `AudioWorklet` is nicer but adds a worklet file — the filtered-saw fake is 90% there.
- **Phrase generator:** every 8–20 s (density by game tension), pick 3–7 notes: random walk on the pentatonic (steps −2..+2, bias downward), rhythm from [0.3, 0.45, 0.6, 0.9] s gaps, occasional ornament (fast neighbor-note grace 60 ms before target). Rest is as important as notes — silence between phrases keeps it pastoral, not noodly.
- **State-driven mixing:** calm = pad+drone+sparse plucks; raid = drop pad, add low percussive thuds (kick-ish sine drops) at 140 BPM + faster Hijaz phrases; kumzitz = brighter plucks, add hand-clap noise bursts on offbeats; Shabbat = pad only, slower, warmer (raise lowpass, add major 6th). Crossfade layer gains over 3–5 s with `setTargetAtTime`.
- Schedule with a lookahead scheduler (the classic "tale of two clocks": `setInterval(25ms)` scheduling events 100 ms ahead on `ctx.currentTime`) — never schedule from rAF.

---

## 14. localStorage save patterns

- One versioned envelope, autosave (every 60 s of sim + on `visibilitychange`/`pagehide`) + 3 manual slots:

```js
const SAVE_KEY = 'hilltop.save.v1';
function save(slot = 'auto') {
  const data = { v: 3, savedAt: Date.now(), chapter, dayT, day, resources,
    units: units.map(u => u.serialize()),        // ids, type, pos, hp, task, sheepName…
    buildings: buildings.map(b => b.serialize()),
    world: { seed, choppedTrees: [...choppedIds] },  // store SEED + diffs, not the world
    flags, questState };
  try { localStorage.setItem(`${SAVE_KEY}.${slot}`, JSON.stringify(data)); }
  catch (e) { /* QuotaExceededError → surface Hebrew toast, offer export */ }
}
```

- **Seed + diff, not world dump:** terrain, tree placement, rock placement all derive from `seed` via seeded PRNG (mulberry32, 5 lines). Save only the seed and what changed (chopped tree instance ids, built structures). Keeps saves ~50 KB.
- Migrations: `const MIGRATIONS = {1: fnTo2, 2: fnTo3}`; on load, run `while (data.v < CURRENT) data = MIGRATIONS[data.v](data)`. Never break old saves mid-campaign.
- Wrap access in try/catch (Safari private mode throws). Offer export/import as a downloadable JSON blob for backup — trivial and users love it.
- Don't serialize Three objects ever; serialize plain gameplay state and rebuild the scene on load.

---

## 15. Misc hard-won rules

1. **Preallocate math objects.** Module-level `const _v = new THREE.Vector3()` scratch registers; `new` in a per-frame loop is the #1 GC-jank source.
2. `renderer.info` HUD (calls, tris, geometries, programs) behind a `?debug` flag from day one.
3. One material to rule them all (§2) + `vertexColors` means changing a building's color = writing the color attribute, no material churn, no shader recompiles mid-game (compile all materials up front; a first-use `ShaderMaterial` compile can hitch 100 ms — render one warmup frame with everything on screen).
4. Dispose discipline: every dynamic geometry gets `.dispose()` on removal; check `renderer.info.memory.geometries` stays flat over a long session.
5. Selection rings/health bars: one `InstancedMesh` of rings (torus or flat ring geometry) + HTML overlay for health bars is fine at 30 units (project positions, position absolutely-placed divs; batch style writes). HTML text beats SDF text for Hebrew names over sheep.
6. Hebrew/RTL: keep ALL text in DOM/CSS (`dir="rtl"`), zero text in WebGL — avoids canvas-text RTL shaping pain entirely.
7. Test on a real integrated-GPU machine early; the shadow pass and pixel ratio are where mid laptops die, not triangle count.
