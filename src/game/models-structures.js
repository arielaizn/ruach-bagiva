// Procedural low-poly structures: buildings, vehicles, props (docs/design/art.md).
// Origin = ground center of footprint, +Z = door/front side. Static geometry is
// merged into 1-2 meshes; animated parts (flag, beacon, wheels, gates) stay
// separate child meshes registered in group.userData.anim.
// Night-glow: amber-painted meshes are listed in group.userData.glow, and
// group.userData.glowPoints holds positions where the game may attach lights.
import * as THREE from 'three';
import { paint, part, merged, animPart, box, cyl, cone, ico, sph, torus } from './model-helpers.js';

// ---- palette (from docs/design/art.md) ----
const C = {
  palletWood: 0xb08d5a, palletDark: 0x9a8468, woodPost: 0x7a5c3a, logWood: 0x6e5a42, vineTrunk: 0x4a3e32,
  tin: 0x9aa0a4, steel: 0x5a5348, pipe: 0x6e6a62, lid: 0x3a3a3e, cable: 0x2a2620,
  canvas: 0xded3ba, rope: 0xcfc6b0,
  offWhite: 0xe8e2d4, roofBleach: 0xcfc9ba, whitewash: 0xe8e4d8, white: 0xf2ede0,
  concrete: 0x8d8578, doorTan: 0xb0a894, glass: 0x2e3a44,
  glow: 0xffbf6e, glowWarm: 0xffd98a,
  tankBlack: 0x2b2b2e, barrelBlue: 0x2e5f8a, water: 0x5d8fa6,
  hay: 0xc9b458, seedling: 0x6d854e, wilted: 0x8a7a42, grape: 0x4a3e5c,
  dirtFresh: 0x8a6d48, dirtPale: 0xc4b291,
  rust: 0x8a4a32, rustDark: 0x74402c, rustStreak: 0x8a5a3e, stone: 0x8c8474,
  shadeNet: 0x4a6b45, hose: 0x2e4a3a,
  rugRed: 0x8a3e4a, sofaOlive: 0x6e7258, sofaBrown: 0x7a5c48, cushionBlue: 0x3e5c7a, carSeat: 0x5c6168,
  genRed: 0xb5482e, genGrime: 0x7c3220, jerry: 0xd9a441,
  flagWhite: 0xf4f2ec, flagBlue: 0x4a63a0,
  jeepWhite: 0xe8e6de, pickupWhite: 0xd8d4c8, busWhite: 0xeceae2, beaconOrange: 0xff9a3a,
  dozerYellow: 0xc9a227, dozerGrime: 0x8a7218, bladeSteel: 0xb0921f, bladeEdge: 0xb3aa97, track: 0x3a3a3e,
  alertOrange: 0xe07b2a, sandbag: 0x9a8a6e, sealRed: 0xd9534f,
};

const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// ---- local helpers ----

// Thin box strut between two world points (ropes, braces, cables, legs).
const _up = new THREE.Vector3(0, 1, 0);
function wire(a, b, hex = C.cable, t = 0.018, jitter = 0) {
  const av = new THREE.Vector3(a[0], a[1], a[2]);
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const g = paint(box(t, d.length(), t), hex, jitter);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.clone().normalize());
  const mid = av.add(new THREE.Vector3(b[0], b[1], b[2])).multiplyScalar(0.5);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  return g;
}

// Flat triangle plates facing +Z (from a squashed 3-seg cone).
const triUp = (r, th) => cone(r, th, 3).rotateY(Math.PI).rotateX(Math.PI / 2);
const triDown = (r, th) => cone(r, th, 3).rotateX(Math.PI / 2);

// Star of David facing +Z at p: two overlapping flattened triangles.
function starParts(r, th, hex, p) {
  return [
    part(triUp(r, th), hex, { p, jitter: 0 }),
    part(triDown(r, th), hex, { p, jitter: 0 }),
  ];
}

// Points along a drooping line between a and b (fairy lights, slack cables).
function sagLine(a, b, drop, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * drop,
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
  return pts;
}

function glowM(parts) { return merged(parts, { castShadow: false }); }

function addWheels(g, positions, r, w) {
  return positions.map(([x, y, z]) => {
    const m = animPart([
      paint(cyl(r, r, w, 6).rotateZ(Math.PI / 2), 0x2a2620, 0.05),
      paint(cyl(r * 0.5, r * 0.5, w + 0.04, 6).rotateZ(Math.PI / 2), 0x8c8474, 0.05),
    ]);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  });
}

// Reusable prop part-lists (also used inside compound builders).
function jerrycanParts(p = [0, 0, 0], hex = C.jerry) {
  const [x, y, z] = p;
  const P = [
    part(box(0.26, 0.38, 0.17), hex, { p: [x, y + 0.19, z], jitter: 0.12 }),
    part(cyl(0.028, 0.035, 0.07, 5), hex, { p: [x + 0.09, y + 0.41, z], jitter: 0 }),
  ];
  for (const dz of [-0.055, 0, 0.055])   // triple-grip handle bridge
    P.push(part(box(0.14, 0.03, 0.028), hex, { p: [x - 0.03, y + 0.4, z + dz], jitter: 0 }));
  return P;
}

function troughParts(p = [0, 0, 0]) {
  const [x, y, z] = p;
  return [
    part(cyl(0.3, 0.3, 1.15, 8).rotateZ(Math.PI / 2), C.barrelBlue, { p: [x, y + 0.28, z], jitter: 0.08 }),
    part(box(1.0, 0.03, 0.4), C.water, { p: [x, y + 0.46, z], jitter: 0 }),
  ];
}

function haybaleParts(p = [0, 0, 0], ry = 0) {
  const [x, y, z] = p;
  return [
    part(box(0.9, 0.45, 0.45), C.hay, { p: [x, y + 0.23, z], r: [0, ry, 0], jitter: 0.2 }),
    part(box(0.035, 0.47, 0.47), C.palletDark, { p: [x - 0.2, y + 0.23, z], r: [0, ry, 0], jitter: 0 }),
    part(box(0.035, 0.47, 0.47), C.palletDark, { p: [x + 0.22, y + 0.23, z], r: [0, ry, 0], jitter: 0 }),
  ];
}

function chairParts(P, x, z, ry, hex) {
  P.push(part(box(0.42, 0.06, 0.42), hex, { p: [x, 0.46, z], r: [0, ry, 0], jitter: 0.08 }));
  P.push(part(box(0.38, 0.42, 0.3), hex, { p: [x, 0.23, z], r: [0, ry, 0], jitter: 0.08 }));
  P.push(part(box(0.42, 0.5, 0.06), hex,
    { p: [x - Math.sin(ry) * 0.21, 0.72, z - Math.cos(ry) * 0.21], r: [0, ry, 0], jitter: 0.08 }));
}

// =====================================================================
// BUILDINGS
// =====================================================================

// Pup tent, off-white canvas, guy ropes. Footprint 4x4.
function tent() {
  const g = new THREE.Group();
  const P = [
    part(box(1.85, 0.05, 2.5).rotateZ(0.905), C.canvas, { p: [-0.56, 0.72, 0], jitter: 0.1 }),
    part(box(1.85, 0.05, 2.5).rotateZ(-0.905), C.canvas, { p: [0.56, 0.72, 0], jitter: 0.1 }),
    part(cyl(0.025, 0.025, 3.0, 5).rotateX(Math.PI / 2), C.woodPost, { p: [0, 1.46, 0] }),
    part(triUp(1, 0.05), C.canvas, { p: [0, 0.45, -1.15], s: [1.15, 0.9, 1], jitter: 0.1 }),
    part(triUp(1, 0.05), C.canvas, { p: [0, 0.42, 1.15], s: [1.1, 0.85, 1], jitter: 0.1 }),
    part(triUp(1, 0.05), C.cable, { p: [0, 0.28, 1.19], s: [0.55, 0.55, 1], jitter: 0 }), // dark opening
  ];
  for (const [sx, sz] of CORNERS) {
    P.push(wire([0, 1.42, sz * 1.26], [sx * 1.3, 0.05, sz * 1.8], C.rope, 0.012));
    P.push(part(box(0.06, 0.12, 0.06), C.woodPost, { p: [sx * 1.3, 0.05, sz * 1.8] }));
  }
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// White/tan box on concrete blocks, door + porch, black roof tank. 4x8.
function caravan() {
  const g = new THREE.Group();
  const P = [
    part(box(3.2, 2.2, 6.6), C.offWhite, { p: [0, 1.55, 0], jitter: 0.06 }),
    part(box(3.3, 0.08, 6.7), C.roofBleach, { p: [0, 2.69, 0], jitter: 0.05 }),
  ];
  for (const [sx, sz] of CORNERS)
    P.push(part(box(0.45, 0.5, 0.45), C.concrete, { p: [sx * 1.2, 0.25, sz * 2.6], jitter: 0.1 }));
  for (const z of [-1.8, 0.2]) {   // dark windows on both long sides
    P.push(part(box(0.06, 0.55, 0.75), C.glass, { p: [1.62, 1.9, z], jitter: 0 }));
    P.push(part(box(0.06, 0.55, 0.75), C.glass, { p: [-1.62, 1.9, z], jitter: 0 }));
  }
  P.push(part(box(0.04, 0.5, 0.08), C.rustStreak, { p: [1.63, 1.35, -1.5], jitter: 0 }));
  P.push(part(box(0.04, 0.4, 0.08), C.rustStreak, { p: [-1.63, 1.4, 0.5], jitter: 0 }));
  // door (+Z) + plywood porch + step
  P.push(part(box(0.85, 1.75, 0.07), C.doorTan, { p: [0.7, 1.4, 3.32], jitter: 0.05 }));
  P.push(part(box(1.5, 0.09, 0.7), C.palletWood, { p: [0.7, 0.42, 3.62], jitter: 0.12 }));
  P.push(part(box(0.7, 0.2, 0.25), C.concrete, { p: [0.7, 0.1, 3.85], jitter: 0.1 }));
  // black water tank on roof corner
  P.push(part(cyl(0.45, 0.45, 0.75, 8), C.tankBlack, { p: [-1.0, 3.1, -2.3], jitter: 0.04 }));
  P.push(part(cyl(0.16, 0.16, 0.08, 6), C.lid, { p: [-1.0, 3.5, -2.3], jitter: 0 }));
  g.add(merged(P, { receiveShadow: true }));
  const win = glowM([part(box(0.75, 0.55, 0.07), C.glow, { p: [-0.85, 1.9, 3.32], jitter: 0 })]);
  g.add(win);
  g.userData.glow = [win];
  g.userData.glowPoints = [{ x: -0.85, y: 1.9, z: 3.6 }];
  return g;
}

// Pipe-and-pallet fence ring, shade net corner, gate, trough, hay. 8x8.
function sheep_pen() {
  const g = new THREE.Group();
  const P = [];
  // pallet panels [x, z, len, alongZ]
  const panels = [
    [-1.8, -3.6, 3.45, 0], [1.8, -3.6, 3.45, 0],
    [-3.6, -1.8, 3.45, 1], [-3.6, 1.8, 3.45, 1],
    [3.6, -1.8, 3.45, 1], [3.6, 1.8, 3.45, 1],
    [-2.2, 3.6, 2.7, 0], [2.2, 3.6, 2.7, 0],   // gate gap at center of +Z side
  ];
  panels.forEach(([x, z, len, v], i) => {
    P.push(part(v ? box(0.07, 0.95, len) : box(len, 0.95, 0.07), C.palletWood,
      { p: [x, 0.55, z], r: [0, (i % 2 ? 0.02 : -0.02), 0], jitter: 0.15 }));
  });
  // pipe posts: corners, mid-sides, gate posts
  for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6],
    [0, -3.6], [-3.6, 0], [3.6, 0], [-0.8, 3.6], [0.8, 3.6]])
    P.push(part(cyl(0.045, 0.045, 1.25, 4), C.pipe, { p: [x, 0.62, z], jitter: 0.08 }));
  // green shade-net roof over the NW corner
  for (const [x, z] of [[-3.3, -3.3], [-0.9, -3.3], [-3.3, -0.9], [-0.9, -0.9]])
    P.push(part(cyl(0.04, 0.04, 1.75, 4), C.pipe, { p: [x, 0.87, z], jitter: 0.06 }));
  P.push(part(box(2.9, 0.05, 2.9), C.shadeNet, { p: [-2.1, 1.7, -2.1], r: [0.05, 0, 0.07], jitter: 0.14 }));
  // water trough (blue half-barrel) + hay pile
  P.push(...troughParts([2.0, 0, -2.2]));
  P.push(part(ico(0.7, 0), C.hay, { p: [2.3, 0.3, 2.2], s: [1, 0.55, 1], jitter: 0.2 }));
  P.push(part(ico(0.45, 0), C.hay, { p: [1.6, 0.2, 2.6], s: [1, 0.5, 1], jitter: 0.2 }));
  g.add(merged(P, { receiveShadow: true }));
  // swinging gate (pivot at west gate post), with wired-on tin sign
  const gate = animPart([
    part(box(1.55, 0.14, 0.045), C.palletWood, { p: [0.82, 0.45, 0], jitter: 0.15 }),
    part(box(1.55, 0.14, 0.045), C.palletWood, { p: [0.82, 0.85, 0], jitter: 0.15 }),
    part(box(1.6, 0.09, 0.04).rotateZ(0.26), C.palletDark, { p: [0.82, 0.65, 0.01], jitter: 0.1 }),
    part(box(0.5, 0.35, 0.02), C.tin, { p: [0.82, 0.62, 0.05], jitter: 0.05 }),
  ]);
  gate.position.set(-0.8, 0, 3.6);
  gate.rotation.y = 0.18;
  g.add(gate);
  g.userData.anim = { gate };
  return g;
}

// Raised dirt rows + seedlings, pallet border. opts.trampled = boar damage. 4x6.
function veg_patch({ trampled = false } = {}) {
  const g = new THREE.Group();
  const P = [];
  const borders = [
    [0, -2.85, 3.8, 0], [0, 2.85, 3.8, 0], [-1.9, 0, 5.6, 1], [1.9, 0, 5.6, 1],
  ];
  borders.forEach(([x, z, len, v], i) => {
    const askew = trampled && i === 1;   // +Z plank knocked flat
    P.push(part(v ? box(0.07, 0.22, len) : box(len, 0.22, 0.07), C.palletWood,
      { p: [x, askew ? 0.1 : 0.13, askew ? z - 0.1 : z], r: askew ? [1.2, 0, 0] : [0, 0, 0], jitter: 0.15 }));
  });
  for (const x of [-1.15, 0, 1.15]) {
    P.push(part(box(0.85, 0.26, 5.1), C.dirtFresh,
      { p: [x, 0.13, 0], r: [0, trampled ? x * 0.06 - 0.03 : 0, 0], jitter: 0.14 }));
    if (!trampled) {
      P.push(part(box(0.45, 0.14, 4.8), C.seedling, { p: [x, 0.3, 0], jitter: 0.25 }));
    } else {
      P.push(part(box(0.4, 0.1, 1.2), C.wilted, { p: [x, 0.27, -1.2 + x * 0.8], r: [0, 0.4, 0.1], jitter: 0.2 }));
      P.push(part(ico(0.3, 0), C.dirtFresh, { p: [x * 0.7, 0.1, 1.2 - x], s: [1.3, 0.5, 1.3], jitter: 0.15 }));
    }
  }
  if (trampled)
    P.push(part(ico(0.45, 0), C.dirtFresh, { p: [0.5, 0.12, 0.2], s: [1.6, 0.35, 1.6], jitter: 0.12 }));
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// Whitewashed stone ring, crossed logs, log benches + old car seat. 4x4.
// No flame mesh — the game attaches FX fire at glowPoints[0].
function campfire() {
  const g = new THREE.Group();
  const P = [part(cyl(0.42, 0.42, 0.05, 8), C.cable, { p: [0, 0.03, 0], jitter: 0.06 })]; // char disc
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.2;
    P.push(part(ico(0.13, 0), C.whitewash,
      { p: [Math.cos(a) * 0.55, 0.09, Math.sin(a) * 0.55], jitter: 0.15 }));
  }
  for (let i = 0; i < 3; i++)   // crossed logs teepee'd over the pit
    P.push(part(cyl(0.05, 0.065, 0.85, 5).rotateZ(0.85).rotateY(i * 2.09), C.logWood,
      { p: [0, 0.3, 0], jitter: 0.1 }));
  // blackened kumkum kettle on a flat stone
  P.push(part(box(0.3, 0.12, 0.3), C.stone, { p: [0.62, 0.06, 0.5], jitter: 0.12 }));
  P.push(part(cyl(0.09, 0.11, 0.15, 7), C.cable, { p: [0.62, 0.2, 0.5], jitter: 0.05 }));
  // 3 log benches (N, E, W)
  P.push(part(cyl(0.09, 0.09, 1.15, 6).rotateZ(Math.PI / 2), C.logWood, { p: [0, 0.13, -1.35], jitter: 0.1 }));
  P.push(part(cyl(0.09, 0.09, 1.15, 6).rotateX(Math.PI / 2), C.logWood, { p: [-1.35, 0.13, 0.1], jitter: 0.1 }));
  P.push(part(cyl(0.09, 0.09, 1.15, 6).rotateX(Math.PI / 2), C.logWood, { p: [1.35, 0.13, -0.1], jitter: 0.1 }));
  // salvaged car seat (S, facing the fire)
  P.push(part(box(0.55, 0.28, 0.5), C.lid, { p: [0, 0.14, 1.4], jitter: 0.06 }));
  P.push(part(box(0.58, 0.14, 0.52), C.carSeat, { p: [0, 0.34, 1.4], jitter: 0.1 }));
  P.push(part(box(0.58, 0.6, 0.14).rotateX(0.25), C.carSeat, { p: [0, 0.62, 1.68], jitter: 0.1 }));
  g.add(merged(P, { receiveShadow: true }));
  g.userData.glowPoints = [{ x: 0, y: 0.5, z: 0 }];
  return g;
}

// 2 m fence segment along x: 2 rough posts + 2 pallet planks. opts.gate.
function fence({ gate = false } = {}) {
  const g = new THREE.Group();
  const P = [
    part(cyl(0.05, 0.065, 1.05, 5), C.woodPost, { p: [-0.85, 0.5, 0], r: [0.03, 0, 0.05], jitter: 0.12 }),
    part(cyl(0.05, 0.065, 1.05, 5), C.woodPost, { p: [0.85, 0.5, 0], r: [-0.02, 0, -0.04], jitter: 0.12 }),
  ];
  if (!gate) {
    P.push(part(box(1.9, 0.15, 0.05), C.palletWood, { p: [0, 0.48, 0.03], r: [0, 0, 0.025], jitter: 0.15 }));
    P.push(part(box(1.9, 0.15, 0.05), C.palletWood, { p: [0, 0.84, 0.03], r: [0, 0, -0.02], jitter: 0.15 }));
    g.add(merged(P));
  } else {
    g.add(merged(P));
    const gd = animPart([
      part(box(1.55, 0.14, 0.045), C.palletWood, { p: [0.82, 0.48, 0], jitter: 0.15 }),
      part(box(1.55, 0.14, 0.045), C.palletWood, { p: [0.82, 0.84, 0], jitter: 0.15 }),
      part(box(1.6, 0.09, 0.04).rotateZ(0.27), C.palletDark, { p: [0.82, 0.66, 0.02], jitter: 0.1 }),
    ]);
    gd.position.set(-0.85, 0, 0);
    gd.rotation.y = 0.15;
    g.add(gd);
    g.userData.anim = { gate: gd };
  }
  return g;
}

// 4 posts, pallet-slat roof, plastic table + mismatched chairs. 4x4.
function pergola() {
  const g = new THREE.Group();
  const P = [];
  for (const [sx, sz] of CORNERS)
    P.push(part(cyl(0.06, 0.075, 2.25, 5), C.woodPost,
      { p: [sx * 1.5, 1.12, sz * 1.5], r: [sz * 0.02, 0, sx * 0.03], jitter: 0.12 }));
  P.push(part(box(3.6, 0.12, 0.14), C.palletWood, { p: [0, 2.28, 1.5], jitter: 0.12 }));
  P.push(part(box(3.6, 0.12, 0.14), C.palletWood, { p: [0, 2.28, -1.5], jitter: 0.12 }));
  for (let i = 0; i < 6; i++)
    P.push(part(box(0.12, 0.05, 3.5), C.palletDark,
      { p: [-1.5 + i * 0.6, 2.4, 0], r: [0, 0, (i % 2 ? 0.02 : -0.02)], jitter: 0.15 }));
  // plastic table + mismatched chairs
  P.push(part(cyl(0.55, 0.55, 0.06, 9), C.offWhite, { p: [0, 0.72, 0], jitter: 0.04 }));
  P.push(part(cyl(0.045, 0.09, 0.7, 5), C.offWhite, { p: [0, 0.36, 0], jitter: 0 }));
  chairParts(P, 0.95, 0.25, -1.9, C.offWhite);
  chairParts(P, -0.85, -0.5, 0.7, C.cushionBlue);
  chairParts(P, 0.15, 1.05, 3.3, C.woodPost);
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// Gabled white shack, tin roof, Star-of-David circle, glow windows, ark. 4x6.
function synagogue() {
  const g = new THREE.Group();
  const P = [
    part(box(3.4, 2.2, 5.2), C.white, { p: [0, 1.1, 0], jitter: 0.05 }),
    part(triUp(1, 0.08), C.white, { p: [0, 2.5, 2.56], s: [1.97, 0.6, 1], jitter: 0.05 }),
    part(triUp(1, 0.08), C.white, { p: [0, 2.5, -2.56], s: [1.97, 0.6, 1], jitter: 0.05 }),
    part(box(2.05, 0.07, 5.7).rotateZ(-0.426), C.tin, { p: [-0.92, 2.7, 0], jitter: 0.05 }),
    part(box(2.05, 0.07, 5.7).rotateZ(0.426), C.tin, { p: [0.92, 2.7, 0], jitter: 0.05 }),
    // Star-of-David cutout circle on the front gable
    part(cyl(0.32, 0.32, 0.06, 12).rotateX(Math.PI / 2), C.cushionBlue, { p: [0, 2.62, 2.62], jitter: 0 }),
    ...starParts(0.2, 0.05, C.white, [0, 2.62, 2.66]),
    // door + step (+Z)
    part(box(0.95, 1.65, 0.08), C.woodPost, { p: [0, 0.85, 2.62], jitter: 0.08 }),
    part(box(1.2, 0.18, 0.5), C.concrete, { p: [0, 0.09, 2.75], jitter: 0.08 }),
    // small ark bump at the back
    part(box(1.1, 1.5, 0.38), C.white, { p: [0, 0.75, -2.78], jitter: 0.05 }),
    part(box(1.2, 0.07, 0.48), C.tin, { p: [0, 1.55, -2.78], jitter: 0 }),
  ];
  g.add(merged(P, { receiveShadow: true }));
  const wins = glowM([
    part(box(0.06, 0.85, 0.55), C.glow, { p: [1.72, 1.45, -0.9], jitter: 0 }),
    part(box(0.06, 0.85, 0.55), C.glow, { p: [-1.72, 1.45, 0.4], jitter: 0 }),
  ]);
  g.add(wins);
  g.userData.glow = [wins];
  g.userData.glowPoints = [{ x: 1.9, y: 1.45, z: -0.9 }, { x: -1.9, y: 1.45, z: 0.4 }];
  return g;
}

// 2 pallet doghouses + food bowls. 2x4.
function kennel() {
  const g = new THREE.Group();
  const P = [];
  for (const z of [-0.95, 0.55]) {
    const ry = z > 0 ? 0.12 : -0.08;
    P.push(part(box(0.85, 0.6, 0.95), C.palletWood, { p: [-0.05, 0.3, z], r: [0, ry, 0], jitter: 0.15 }));
    P.push(part(box(0.62, 0.05, 1.05).rotateZ(0.5), C.palletDark, { p: [-0.29, 0.73, z], r: [0, ry, 0], jitter: 0.12 }));
    P.push(part(box(0.62, 0.05, 1.05).rotateZ(-0.5), C.palletDark, { p: [0.19, 0.73, z], r: [0, ry, 0], jitter: 0.12 }));
    P.push(part(box(0.4, 0.42, 0.06), C.cable, { p: [-0.05, 0.28, z + 0.46], r: [0, ry, 0], jitter: 0 }));
  }
  P.push(part(cyl(0.13, 0.15, 0.07, 7), C.steel, { p: [-0.5, 0.035, 1.55], jitter: 0 }));
  P.push(part(cyl(0.1, 0.11, 0.06, 7), C.hay, { p: [-0.5, 0.075, 1.55], jitter: 0.1 }));
  P.push(part(cyl(0.13, 0.15, 0.07, 7), C.steel, { p: [0.45, 0.035, 1.6], jitter: 0 }));
  P.push(part(cyl(0.1, 0.11, 0.05, 7), C.water, { p: [0.45, 0.07, 1.6], jitter: 0 }));
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// Corner of 2 dead sofas + cable-spool table + fairy lights + rug. 4x4.
function zula() {
  const g = new THREE.Group();
  const P = [
    part(box(3.0, 0.03, 2.4), C.rugRed, { p: [0, 0.02, 0.2], jitter: 0.08 }),
    part(box(3.0, 0.035, 0.22), C.hay, { p: [0, 0.02, -0.5], jitter: 0 }),
    part(box(3.0, 0.035, 0.22), C.hay, { p: [0, 0.02, 0.9], jitter: 0 }),
    // sofa A along the back
    part(box(1.7, 0.5, 0.75), C.sofaOlive, { p: [0.1, 0.27, -1.5], jitter: 0.08 }),
    part(box(1.7, 0.5, 0.2), C.sofaOlive, { p: [0.1, 0.75, -1.82], jitter: 0.08 }),
    part(box(0.75, 0.14, 0.6), C.cushionBlue, { p: [-0.25, 0.57, -1.45], r: [0, 0.1, 0], jitter: 0.05 }),
    part(box(0.75, 0.14, 0.6), C.sofaBrown, { p: [0.55, 0.56, -1.5], r: [0, -0.06, 0.03], jitter: 0.05 }),
    // sofa B along the left
    part(box(0.75, 0.5, 1.6), C.sofaBrown, { p: [-1.5, 0.27, 0.3], jitter: 0.08 }),
    part(box(0.2, 0.5, 1.6), C.sofaBrown, { p: [-1.85, 0.75, 0.3], jitter: 0.08 }),
    // cable-spool table
    part(cyl(0.45, 0.45, 0.1, 9), C.palletWood, { p: [0.2, 0.5, 0.2], jitter: 0.12 }),
    part(cyl(0.16, 0.16, 0.35, 7), C.palletDark, { p: [0.2, 0.27, 0.2], jitter: 0.1 }),
    part(cyl(0.42, 0.42, 0.1, 9), C.palletWood, { p: [0.2, 0.05, 0.2], jitter: 0.12 }),
    // guitar leaning on sofa A
    part(box(0.32, 0.1, 0.45).rotateX(-1.1), C.palletWood, { p: [0.95, 0.35, -1.35], jitter: 0.08 }),
    part(box(0.05, 0.55, 0.04).rotateX(-0.35), C.palletDark, { p: [0.95, 0.72, -1.55], jitter: 0 }),
    // fairy-light pole
    part(cyl(0.03, 0.045, 2.0, 5), C.woodPost, { p: [1.6, 1.0, 1.4], r: [0.06, 0, -0.05], jitter: 0.1 }),
  ];
  const pts = sagLine([1.58, 2.0, 1.38], [-0.7, 1.15, -1.75], 0.35, 6);
  for (let i = 0; i < pts.length - 1; i++) P.push(wire(pts[i], pts[i + 1], C.cable, 0.014));
  g.add(merged(P, { receiveShadow: true }));
  // bulbs: 3 lit (glow) + 2 dead
  const lit = [], dead = [];
  pts.slice(1, -1).forEach((p, i) => {
    const geo = part(sph(0.05, 4, 3), i % 2 === 0 ? C.glowWarm : C.steel,
      { p: [p[0], p[1] - 0.07, p[2]], jitter: 0 });
    (i % 2 === 0 ? lit : dead).push(geo);
  });
  const litMesh = glowM(lit);
  g.add(litMesh);
  g.add(merged(dead, { castShadow: false }));
  g.userData.glow = [litMesh];
  g.userData.glowPoints = [
    { x: pts[2][0], y: pts[2][1], z: pts[2][2] },
    { x: pts[4][0], y: pts[4][1], z: pts[4][2] },
  ];
  return g;
}

// 3 trellis rows: posts + wires + vine blobs. opts {grapes, trampled}. 4x8.
function vineyard({ grapes = false, trampled = false } = {}) {
  const g = new THREE.Group();
  const P = [];
  [-1.3, 0, 1.3].forEach((x, ri) => {
    const hurt = trampled && ri === 1;   // boars wreck the middle row
    for (const z of [-3, 0, 3])
      P.push(part(box(0.07, 1.4, 0.07), C.woodPost,
        { p: [x, hurt ? 0.53 : 0.7, z], r: hurt ? [0.9, 0, 0.2] : [0, 0, (z === 0 ? 0.03 : -0.02)], jitter: 0.12 }));
    if (!hurt)
      for (const y of [0.85, 1.2])
        P.push(part(box(0.02, 0.02, 6.4), C.stone, { p: [x, y, 0], jitter: 0 }));
    P.push(part(box(0.025, 0.025, 6.2), C.cable, { p: [x, 0.05, 0], jitter: 0 })); // drip line
    for (const z of [-2.2, 0, 2.2]) {
      if (hurt) {
        P.push(part(ico(0.3, 0), C.wilted, { p: [x + 0.2, 0.18, z + 0.3], s: [1.2, 0.45, 1.2], jitter: 0.15 }));
      } else {
        P.push(part(cyl(0.05, 0.08, 0.5, 5), C.vineTrunk, { p: [x, 0.28, z], jitter: 0.1 }));
        P.push(part(ico(0.3, 0), C.seedling, { p: [x, 1.0, z], s: [1, 0.9, 1.1], jitter: 0.18 }));
        if (grapes) P.push(part(ico(0.1, 0), C.grape, { p: [x + 0.12, 0.68, z + 0.1], jitter: 0.1 }));
      }
    }
    if (hurt)
      P.push(part(ico(0.5, 0), C.dirtFresh, { p: [x, 0.13, 0.8], s: [1.5, 0.3, 1.8], jitter: 0.12 }));
  });
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// Rusty shipping container, corrugation ribs, door end, graffiti patch. 4x8.
function container() {
  const g = new THREE.Group();
  const P = [part(box(2.4, 2.5, 6.6), C.rust, { p: [0, 1.3, 0], jitter: 0.08 })];
  for (let i = 0; i < 5; i++) {
    const z = -2.6 + i * 1.3;
    P.push(part(box(0.05, 2.4, 0.12), C.rustDark, { p: [1.22, 1.3, z], jitter: 0.05 }));
    P.push(part(box(0.05, 2.4, 0.12), C.rustDark, { p: [-1.22, 1.3, z], jitter: 0.05 }));
  }
  // door end (+Z): 2 panels + lock rods
  P.push(part(box(1.08, 2.3, 0.08), C.rustDark, { p: [-0.58, 1.3, 3.32], jitter: 0.06 }));
  P.push(part(box(1.08, 2.3, 0.08), C.rustDark, { p: [0.58, 1.3, 3.32], jitter: 0.06 }));
  P.push(part(cyl(0.025, 0.025, 2.35, 5), C.steel, { p: [-0.35, 1.3, 3.38], jitter: 0 }));
  P.push(part(cyl(0.025, 0.025, 2.35, 5), C.steel, { p: [0.35, 1.3, 3.38], jitter: 0 }));
  // chalk graffiti = lighter patch on one side
  P.push(part(box(0.03, 0.6, 1.6), C.whitewash, { p: [-1.23, 1.5, -0.8], jitter: 0.04 }));
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// Black plastic tank on steel-angle stand, ladder, dangling hose. 4x4.
function water_tower() {
  const g = new THREE.Group();
  const P = [];
  for (const [sx, sz] of CORNERS)
    P.push(wire([sx * 1.3, 0, sz * 1.3], [sx * 0.8, 4.0, sz * 0.8], C.steel, 0.09, 0.06));
  for (const [y, r] of [[1.5, 1.11], [2.9, 0.94]]) {   // ring braces
    P.push(part(box(2 * r, 0.06, 0.06), C.steel, { p: [0, y, r], jitter: 0 }));
    P.push(part(box(2 * r, 0.06, 0.06), C.steel, { p: [0, y, -r], jitter: 0 }));
    P.push(part(box(0.06, 0.06, 2 * r), C.steel, { p: [r, y, 0], jitter: 0 }));
    P.push(part(box(0.06, 0.06, 2 * r), C.steel, { p: [-r, y, 0], jitter: 0 }));
  }
  P.push(wire([-1.05, 1.5, 1.11], [0.94, 2.9, 0.94], C.steel, 0.05)); // one diagonal
  P.push(part(box(2.0, 0.09, 2.0), C.steel, { p: [0, 4.05, 0], jitter: 0.05 }));
  P.push(part(cyl(1.0, 1.0, 1.5, 10), C.tankBlack, { p: [0, 4.85, 0], jitter: 0.05 }));
  P.push(part(cyl(0.3, 0.34, 0.1, 8), C.lid, { p: [0, 5.63, 0], jitter: 0 }));
  // ladder up the +Z side
  P.push(wire([0.25, 0.1, 1.55], [0.25, 4.0, 1.0], C.steel, 0.04));
  P.push(wire([-0.25, 0.1, 1.55], [-0.25, 4.0, 1.0], C.steel, 0.04));
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    P.push(part(box(0.5, 0.045, 0.045), C.steel, { p: [0, 0.1 + t * 3.9, 1.55 - t * 0.55], jitter: 0 }));
  }
  // gravity hose dangling to a coil at the base
  P.push(wire([0.6, 4.15, 0.6], [1.15, 2.0, 1.15], C.hose, 0.035));
  P.push(wire([1.15, 2.0, 1.15], [1.3, 0.3, 1.3], C.hose, 0.035));
  P.push(part(torus(0.16, 0.035, 4, 8).rotateX(Math.PI / 2), C.hose, { p: [1.3, 0.07, 1.3], jitter: 0 }));
  g.add(merged(P, { receiveShadow: true }));
  g.userData.glowPoints = [{ x: 1.3, y: 0.4, z: 1.3 }];   // drip/tap spot
  return g;
}

// Wooden stilt tower, pallet platform, corrugated roof, ladder, flashlight.
// Footprint 2x2, ~6 m tall.
function watchtower() {
  const g = new THREE.Group();
  const P = [];
  for (const [sx, sz] of CORNERS)
    P.push(wire([sx * 0.92, 0, sz * 0.92], [sx * 0.62, 4.45, sz * 0.62], C.woodPost, 0.11, 0.1));
  for (const sx of [1, -1]) {   // X-braces on the flanks
    P.push(wire([sx * 0.9, 0.3, -0.88], [sx * 0.66, 3.6, 0.68], C.woodPost, 0.05, 0.1));
    P.push(wire([sx * 0.9, 0.3, 0.88], [sx * 0.66, 3.6, -0.68], C.woodPost, 0.05, 0.1));
  }
  P.push(part(box(1.85, 0.1, 1.85), C.palletWood, { p: [0, 4.5, 0], jitter: 0.12 }));
  for (const [sx, sz] of CORNERS)
    P.push(part(box(0.06, 0.55, 0.06), C.palletWood, { p: [sx * 0.88, 4.8, sz * 0.88], jitter: 0.1 }));
  P.push(part(box(1.8, 0.06, 0.05), C.palletDark, { p: [0, 5.05, 0.88], jitter: 0.08 }));
  P.push(part(box(1.8, 0.06, 0.05), C.palletDark, { p: [0, 5.05, -0.88], jitter: 0.08 }));
  P.push(part(box(0.05, 0.06, 1.8), C.palletDark, { p: [0.88, 5.05, 0], jitter: 0.08 }));
  P.push(part(box(0.05, 0.06, 1.8), C.palletDark, { p: [-0.88, 5.05, 0], jitter: 0.08 }));
  // corrugated roof on corner sticks
  for (const [sx, sz] of CORNERS)
    P.push(part(box(0.05, 0.75, 0.05), C.woodPost, { p: [sx * 0.8, 5.35, sz * 0.8], jitter: 0.08 }));
  P.push(part(cone(1.35, 0.6, 4).rotateY(Math.PI / 4), C.tin, { p: [0, 5.95, 0], jitter: 0.05 }));
  // ladder (+Z)
  P.push(wire([0.3, 0, 0.96], [0.3, 4.45, 0.66], C.woodPost, 0.05));
  P.push(wire([-0.3, 0, 0.96], [-0.3, 4.45, 0.66], C.woodPost, 0.05));
  for (let i = 1; i <= 8; i++) {
    const t = i / 9;
    P.push(part(box(0.62, 0.05, 0.05), C.palletDark, { p: [0, t * 4.45, 0.96 - t * 0.3], jitter: 0.08 }));
  }
  // mounted flashlight on a rail corner
  P.push(part(box(0.16, 0.12, 0.2), C.lid, { p: [0.8, 5.12, 0.8], jitter: 0 }));
  g.add(merged(P, { receiveShadow: true }));
  const lens = glowM([part(box(0.1, 0.1, 0.05), C.glowWarm, { p: [0.8, 5.12, 0.92], jitter: 0 })]);
  g.add(lens);
  g.userData.glow = [lens];
  g.userData.glowPoints = [{ x: 0.8, y: 5.12, z: 1.0 }];
  return g;
}

// Orange-red gen-set on a skid, exhaust, jerrycan, cable coil, work lamp. 2x4.
function generator() {
  const g = new THREE.Group();
  const P = [
    part(box(1.05, 0.14, 1.7), C.steel, { p: [0, 0.07, -0.35], jitter: 0.08 }),
    part(box(0.85, 0.7, 1.25), C.genRed, { p: [0, 0.5, -0.45], jitter: 0.1 }),
    part(box(0.87, 0.28, 0.5), C.genGrime, { p: [0, 0.35, -0.9], jitter: 0.08 }),
    part(cyl(0.04, 0.045, 0.4, 5).rotateZ(0.5), C.lid, { p: [0.25, 1.0, -0.9], jitter: 0 }),
    part(torus(0.2, 0.045, 4, 9).rotateX(Math.PI / 2), C.cable, { p: [-0.3, 0.05, 0.75], jitter: 0 }),
    wire([0.42, 0.6, 0.2], [-0.25, 0.06, 0.7], C.cable, 0.028),
    // work-lamp pole
    part(cyl(0.025, 0.03, 1.7, 5), C.steel, { p: [-0.25, 0.85, 1.45], r: [0.05, 0, 0.06], jitter: 0 }),
    part(box(0.16, 0.1, 0.14), C.lid, { p: [-0.22, 1.72, 1.42], r: [0.4, 0, 0], jitter: 0 }),
    ...jerrycanParts([0.42, 0, 0.55], C.jerry),
  ];
  g.add(merged(P, { receiveShadow: true }));
  const lamp = glowM([part(box(0.12, 0.04, 0.1), C.glowWarm, { p: [-0.22, 1.66, 1.47], r: [0.4, 0, 0], jitter: 0 })]);
  g.add(lamp);
  g.userData.glow = [lamp];
  g.userData.glowPoints = [{ x: -0.22, y: 1.6, z: 1.5 }];
  return g;
}

// =====================================================================
// PROPS & VEHICLES
// =====================================================================

// 5 m slightly-bent pole + sun-faded Israeli flag (anim.flag).
function flagpole() {
  const g = new THREE.Group();
  g.add(merged([
    part(cyl(0.035, 0.05, 4.0, 6), C.stone, { p: [0, 2.0, 0], jitter: 0.06 }),
    part(cyl(0.028, 0.035, 1.15, 6), C.stone, { p: [0.04, 4.55, 0], r: [0, 0, -0.07], jitter: 0.06 }),
    part(ico(0.05, 0), C.lid, { p: [0.08, 5.12, 0], jitter: 0 }),
  ]));
  const flag = animPart([
    part(box(1.15, 0.78, 0.02), C.flagWhite, { p: [0.6, 0, 0], jitter: 0 }),
    part(box(1.15, 0.1, 0.026), C.flagBlue, { p: [0.6, 0.24, 0], jitter: 0 }),
    part(box(1.15, 0.1, 0.026), C.flagBlue, { p: [0.6, -0.24, 0], jitter: 0 }),
    ...starParts(0.14, 0.032, C.flagBlue, [0.6, 0, 0]),
  ]);
  flag.position.set(0.06, 4.62, 0);
  g.add(flag);
  g.userData.anim = { flag };
  return g;
}

// White 4x4 pickup with yellow roof beacon (anim.beacon, anim.wheels).
function jeep() {
  const g = new THREE.Group();
  g.add(merged([
    part(box(1.5, 0.3, 3.9), C.lid, { p: [0, 0.55, 0], jitter: 0.05 }),
    part(box(1.6, 0.5, 1.15), C.jeepWhite, { p: [0, 0.95, 1.45], jitter: 0.05 }),
    part(box(1.62, 0.78, 1.5), C.jeepWhite, { p: [0, 1.32, 0.3], jitter: 0.05 }),
    part(box(1.45, 0.5, 0.06), C.glass, { p: [0, 1.5, 1.03], r: [-0.3, 0, 0], jitter: 0 }),
    part(box(0.06, 0.42, 1.2), C.glass, { p: [0.82, 1.42, 0.3], jitter: 0 }),
    part(box(0.06, 0.42, 1.2), C.glass, { p: [-0.82, 1.42, 0.3], jitter: 0 }),
    part(box(1.6, 0.55, 1.85), C.jeepWhite, { p: [0, 0.92, -1.35], jitter: 0.05 }),
    part(box(1.35, 0.08, 1.6), C.lid, { p: [0, 1.22, -1.35], jitter: 0 }),
    part(box(1.65, 0.14, 0.18), C.steel, { p: [0, 0.5, 2.1], jitter: 0 }),
    part(box(1.65, 0.14, 0.18), C.steel, { p: [0, 0.5, -2.32], jitter: 0 }),
    part(box(0.22, 0.12, 0.05), C.glowWarm, { p: [0.55, 0.95, 2.04], jitter: 0 }),
    part(box(0.22, 0.12, 0.05), C.glowWarm, { p: [-0.55, 0.95, 2.04], jitter: 0 }),
  ]));
  const wheels = addWheels(g,
    [[0.83, 0.37, 1.4], [-0.83, 0.37, 1.4], [0.83, 0.37, -1.35], [-0.83, 0.37, -1.35]], 0.37, 0.26);
  const beacon = animPart([
    part(cyl(0.08, 0.1, 0.05, 6), C.lid, { p: [0, 0.025, 0], jitter: 0 }),
    part(sph(0.085, 5, 4), C.beaconOrange, { p: [0, 0.1, 0], jitter: 0 }),
  ], { castShadow: false });
  beacon.position.set(0, 1.71, 0.3);
  g.add(beacon);
  g.userData.anim = { wheels, beacon };
  g.userData.glow = [beacon];
  return g;
}

// Yellow tracked dozer, big front blade, exhaust stack, blinking beacon.
function bulldozer() {
  const g = new THREE.Group();
  g.add(merged([
    part(box(0.6, 0.85, 3.5), C.track, { p: [1.02, 0.46, -0.1], jitter: 0.06 }),
    part(box(0.6, 0.85, 3.5), C.track, { p: [-1.02, 0.46, -0.1], jitter: 0.06 }),
    part(box(2.1, 0.85, 3.1), C.dozerYellow, { p: [0, 1.25, -0.2], jitter: 0.08 }),
    part(box(1.5, 0.7, 1.5), C.dozerYellow, { p: [0, 1.95, 0.55], jitter: 0.08 }),
    part(box(1.55, 0.2, 0.5), C.dozerGrime, { p: [0, 1.45, 1.2], jitter: 0.06 }),
    part(box(1.35, 1.05, 1.25), C.dozerYellow, { p: [0, 2.3, -0.85], jitter: 0.08 }),
    part(box(1.15, 0.6, 0.06), C.glass, { p: [0, 2.42, -0.2], jitter: 0 }),
    part(box(0.06, 0.6, 1.0), C.glass, { p: [0.68, 2.42, -0.85], jitter: 0 }),
    part(box(0.06, 0.6, 1.0), C.glass, { p: [-0.68, 2.42, -0.85], jitter: 0 }),
    part(cyl(0.05, 0.065, 0.7, 5), C.lid, { p: [0.5, 2.6, 0.55], jitter: 0 }),
    part(box(2.9, 1.05, 0.24), C.bladeSteel, { p: [0, 0.85, 2.15], r: [-0.12, 0, 0], jitter: 0.08 }),
    part(box(2.9, 0.14, 0.28), C.bladeEdge, { p: [0, 0.32, 2.22], jitter: 0.06 }),
    wire([0.95, 0.7, 1.6], [1.15, 0.85, 0.4], C.dozerGrime, 0.09),
    wire([-0.95, 0.7, 1.6], [-1.15, 0.85, 0.4], C.dozerGrime, 0.09),
  ], { receiveShadow: true }));
  const beacon = animPart([part(ico(0.09, 0), C.alertOrange, { p: [0, 0.05, 0], jitter: 0 })],
    { castShadow: false });
  beacon.position.set(0.4, 2.87, -0.85);
  g.add(beacon);
  g.userData.anim = { beacon };
  g.userData.glow = [beacon];
  return g;
}

// White minibus with a blue stripe (anim.wheels).
function bus() {
  const g = new THREE.Group();
  g.add(merged([
    part(box(2.0, 1.65, 4.7), C.busWhite, { p: [0, 1.25, 0], jitter: 0.04 }),
    part(box(2.04, 0.5, 2.9), C.glass, { p: [0, 1.72, -0.35], jitter: 0 }),
    part(box(1.75, 0.62, 0.06), C.glass, { p: [0, 1.72, 2.34], r: [-0.12, 0, 0], jitter: 0 }),
    part(box(2.05, 0.16, 4.5), C.barrelBlue, { p: [0, 1.02, 0], jitter: 0 }),
    part(box(0.05, 0.55, 1.0), C.glass, { p: [1.02, 1.0, 1.35], jitter: 0 }),
    part(box(1.9, 0.14, 0.16), C.steel, { p: [0, 0.45, 2.4], jitter: 0 }),
    part(box(1.9, 0.14, 0.16), C.steel, { p: [0, 0.45, -2.4], jitter: 0 }),
    part(box(0.2, 0.12, 0.05), C.glowWarm, { p: [0.7, 0.85, 2.36], jitter: 0 }),
    part(box(0.2, 0.12, 0.05), C.glowWarm, { p: [-0.7, 0.85, 2.36], jitter: 0 }),
  ]));
  const wheels = addWheels(g,
    [[0.9, 0.34, 1.5], [-0.9, 0.34, 1.5], [0.9, 0.34, -1.5], [-0.9, 0.34, -1.5]], 0.34, 0.24);
  g.userData.anim = { wheels };
  return g;
}

// Battered white pickup with wooden side rails (anim.wheels).
function pickup() {
  const g = new THREE.Group();
  const P = [
    part(box(1.45, 0.3, 3.7), C.lid, { p: [0, 0.5, 0], jitter: 0.05 }),
    part(box(1.55, 0.45, 1.05), C.pickupWhite, { p: [0, 0.88, 1.4], jitter: 0.12 }),
    part(box(1.58, 0.72, 1.35), C.pickupWhite, { p: [0, 1.25, 0.35], jitter: 0.12 }),
    part(box(1.4, 0.45, 0.06), C.glass, { p: [0, 1.42, 1.0], r: [-0.28, 0, 0], jitter: 0 }),
    part(box(0.06, 0.4, 1.1), C.glass, { p: [0.8, 1.35, 0.35], jitter: 0 }),
    part(box(0.06, 0.4, 1.1), C.glass, { p: [-0.8, 1.35, 0.35], jitter: 0 }),
    part(box(1.55, 0.45, 1.75), C.pickupWhite, { p: [0, 0.85, -1.25], jitter: 0.12 }),
    part(box(1.3, 0.06, 1.5), C.lid, { p: [0, 1.1, -1.25], jitter: 0 }),
    part(box(0.35, 0.2, 0.04), C.rustStreak, { p: [0.6, 0.75, 1.93], jitter: 0.08 }),
    part(box(0.04, 0.25, 0.5), C.rustStreak, { p: [0.79, 0.7, -0.6], jitter: 0.08 }),
    part(box(1.6, 0.13, 0.16), C.steel, { p: [0, 0.45, 1.98], jitter: 0 }),
  ];
  for (const sx of [1, -1]) {   // wooden side rails on the bed
    P.push(part(box(0.05, 0.4, 1.7), C.palletWood, { p: [sx * 0.82, 1.3, -1.25], jitter: 0.18 }));
    for (const z of [-1.9, -1.25, -0.6])
      P.push(part(box(0.06, 0.55, 0.08), C.palletDark, { p: [sx * 0.82, 1.2, z], jitter: 0.12 }));
  }
  g.add(merged(P));
  const wheels = addWheels(g,
    [[0.8, 0.35, 1.35], [-0.8, 0.35, 1.35], [0.8, 0.35, -1.3], [-0.8, 0.35, -1.3]], 0.35, 0.24);
  g.userData.anim = { wheels };
  return g;
}

// Building-site placeholder: corner posts, marking tape, brace, plank + sand
// piles. opts {w, h} in meters.
function construction({ w = 4, h = 4 } = {}) {
  const g = new THREE.Group();
  const hw = Math.max(0.8, w / 2 - 0.35), hh = Math.max(0.8, h / 2 - 0.35);
  const k = Math.min(1.4, Math.max(0.6, Math.min(w, h) / 4));
  const P = [];
  for (const [sx, sz] of CORNERS)
    P.push(part(box(0.1, 1.55, 0.1), C.woodPost,
      { p: [sx * hw, 0.77, sz * hh], r: [sz * 0.03, 0, sx * 0.04], jitter: 0.12 }));
  P.push(wire([-hw, 1.5, -hh], [hw, 1.5, -hh], C.alertOrange, 0.015));
  P.push(wire([hw, 1.5, -hh], [hw, 1.5, hh], C.alertOrange, 0.015));
  P.push(wire([hw, 1.5, hh], [-hw, 1.5, hh], C.alertOrange, 0.015));
  P.push(wire([-hw, 1.5, hh], [-hw, 1.5, -hh], C.alertOrange, 0.015));
  P.push(wire([-hw, 1.45, -hh], [hw * 0.9, 0.15, -hh], C.palletWood, 0.06, 0.1));
  for (let i = 0; i < 3; i++)
    P.push(part(box(1.3 * k, 0.09, 0.55 * k), C.palletWood,
      { p: [hw * 0.4, 0.06 + i * 0.1, hh * 0.35], r: [0, -0.25 + i * 0.22, 0], jitter: 0.15 }));
  P.push(part(ico(0.6 * k, 0), C.dirtPale,
    { p: [-hw * 0.45, 0.26 * k, hh * 0.4], s: [1.4, 0.45, 1.4], jitter: 0.12 }));
  g.add(merged(P, { receiveShadow: true }));
  return g;
}

// Small marker: 2 m pole, torn orange flag, sandbags.
function guardpost() {
  const g = new THREE.Group();
  g.add(merged([
    part(cyl(0.03, 0.045, 2.0, 5), C.pipe, { p: [0, 1.0, 0], r: [0.04, 0, 0.07], jitter: 0.08 }),
    part(box(0.55, 0.3, 0.02), C.alertOrange, { p: [0.33, 1.72, 0], r: [0, 0, -0.06], jitter: 0.1 }),
    part(box(0.22, 0.12, 0.02), C.alertOrange, { p: [0.62, 1.5, 0], r: [0, 0, 0.5], jitter: 0.12 }),
    part(box(0.5, 0.22, 0.32), C.sandbag, { p: [0.1, 0.11, 0.3], r: [0, 0.4, 0], jitter: 0.15 }),
    part(box(0.5, 0.22, 0.32), C.sandbag, { p: [-0.2, 0.11, 0.05], r: [0, -0.3, 0], jitter: 0.15 }),
    part(box(0.45, 0.2, 0.3), C.sandbag, { p: [-0.05, 0.3, 0.18], r: [0, 0.1, 0], jitter: 0.15 }),
  ]));
  return g;
}

// Demolition order: white paper sheet on a stake, red band, text lines.
function orderNotice() {
  const g = new THREE.Group();
  const P = [
    part(box(0.05, 0.75, 0.05), C.woodPost, { p: [0, 0.37, 0], r: [0.03, 0, 0.04], jitter: 0.1 }),
    part(box(0.36, 0.5, 0.015), C.white, { p: [0, 0.62, 0.035], r: [-0.04, 0, 0.03], jitter: 0 }),
    part(box(0.3, 0.05, 0.02), C.sealRed, { p: [0, 0.8, 0.045], r: [-0.04, 0, 0.03], jitter: 0 }),
  ];
  for (let i = 0; i < 4; i++)
    P.push(part(box(0.26, 0.02, 0.02), C.stone, { p: [0, 0.71 - i * 0.07, 0.045], r: [-0.04, 0, 0.03], jitter: 0 }));
  g.add(merged(P, { castShadow: false }));
  return g;
}

function haybale() {
  const g = new THREE.Group();
  g.add(merged(haybaleParts()));
  return g;
}

function jerrycan() {
  const g = new THREE.Group();
  g.add(merged(jerrycanParts()));
  return g;
}

function trough() {
  const g = new THREE.Group();
  g.add(merged(troughParts(), { receiveShadow: true }));
  return g;
}

// Unknown-type fallback: a pallet crate.
function fallbackCrate() {
  const g = new THREE.Group();
  g.add(merged([
    part(box(1.0, 1.0, 1.0), C.palletWood, { p: [0, 0.5, 0], jitter: 0.15 }),
    part(box(1.3, 0.1, 0.05).rotateZ(0.66), C.palletDark, { p: [0, 0.5, 0.51], jitter: 0.1 }),
  ]));
  return g;
}

export const STRUCTURE_BUILDERS = {
  tent, caravan, sheep_pen, veg_patch, campfire, fence, pergola, synagogue,
  kennel, zula, vineyard, container, water_tower, watchtower, generator,
  flagpole, jeep, bulldozer, bus, pickup, construction, guardpost, orderNotice,
  haybale, jerrycan, trough,
  __fallback: fallbackCrate,
};
