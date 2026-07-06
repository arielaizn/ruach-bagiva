// Procedural low-poly models for all LIVING things: people, animals, hostiles.
// Spec: docs/design/art.md §3.A (people), §3.B (animals), §3.D (hostiles).
//
// Conventions (game code depends on these):
//  - Origin at ground center between feet; model faces +Z; 1 unit = 1 m.
//  - group.userData.anim = { legs:[Mesh..], arms:[Mesh..](humans), head, tail }
//    Every entry is a SEPARATE child mesh whose geometry is translated so the
//    joint pivot (hip / shoulder / neck / tail base) sits at the mesh's local
//    origin; mesh.position places the joint. Game rotates them around X.
//  - Everything else is merged into ONE static child mesh (merged()).
//  - Deterministic given opts.seed (local mulberry32, never Math.random).
import * as THREE from 'three';
import { paint, merged, animPart, box, cyl, cone, ico } from './model-helpers.js';
import { mulberry32 } from '../core/util.js';

// ---------------------------------------------------------------- palette --
const SKIN = 0xd9a678, PANTS = 0x5a5348, SANDAL = 0x7a5c3a, TZITZIT = 0xf4f1e6;
const SHIRTS = [0xf0ede2, 0xf0ede2, 0xc8ccd4, 0xa8b49a, 0xd9c9a8];
const KIPPOT = [0xe8e4d8, 0x3d6b8f, 0x7a3e4a, 0x4a6b45, 0xd9a441];
const HAIRS = [0x3e3228, 0x2a231c, 0x5a4630, 0x1e1a16];

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const srng = (opts, salt) => mulberry32((((opts && opts.seed) ?? 0) >>> 0) + salt);

// Deterministic version of model-helpers.part(): same transform+paint, but the
// per-vertex lightness jitter is driven by our seeded rng (part() uses Math.random).
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function pt(rng, geo, hex, { p = [0, 0, 0], r = [0, 0, 0], s = null, jitter = 0.08 } = {}) {
  const g = paint(geo, hex, jitter, rng);
  _e.set(r[0], r[1], r[2]);
  _m4.compose(new THREE.Vector3(p[0], p[1], p[2]), _q.setFromEuler(_e),
    new THREE.Vector3(...(s || [1, 1, 1])));
  g.applyMatrix4(_m4);
  return g;
}

// ============================================================= BASE HUMAN ==
// ~1.7 m tall, heroic-chibi head. 6 child meshes: static body, head, 2 arms,
// 2 legs. Kippah/balaclava/headscarf merge into the head mesh; tzitzit, skirt
// and gear merge into the static body mesh.
function human(rng, o = {}) {
  const {
    shirt = 0xf0ede2, pants = PANTS, skin = SKIN, hair = 0x3e3228,
    kippah = null, kippahSmall = false, headscarf = null, balaclava = null,
    tzitzit = false, peyot = false, skirt = null, shoes = SANDAL, gloves = null,
    torsoW = 1, lean = 0, scale = 1,
    statics = [], headParts = [], leftHand = [], rightHand = [],
  } = o;
  const g = new THREE.Group();
  const shirtEntries = [];

  // ---- static body: torso + tzitzit + skirt + gear
  const torso = pt(rng, box(0.42 * torsoW, 0.55, 0.24 * torsoW), shirt,
    { p: [0, 1.08, lean * 0.07], r: [lean, 0, 0] });
  const torsoCount = torso.attributes.position.count;
  const st = [torso];
  if (tzitzit) { // THE friendly silhouette signature — 4 white strings at the hips
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      st.push(pt(rng, box(0.022, 0.17, 0.022), TZITZIT,
        { p: [sx * 0.19 * torsoW, 0.755, sz * 0.10], jitter: 0.02 }));
  }
  if (skirt) st.push(pt(rng, cyl(0.20, 0.28, 0.68, 8), skirt, { p: [0, 0.70, 0] }));
  st.push(...statics);
  const body = merged(st);
  shirtEntries.push({ mesh: body, start: 0, count: torsoCount });
  g.add(body);

  // ---- head (pivot at neck, world y 1.38)
  const hp = [pt(rng, box(0.26, 0.26, 0.24), balaclava || skin,
    { p: [0, 0.14, 0], jitter: balaclava ? 0.03 : 0.05 })];
  if (!balaclava) {
    hp.push(pt(rng, box(0.27, 0.07, 0.25), hair, { p: [0, 0.265, -0.005] })); // hair cap
    hp.push(pt(rng, box(0.26, 0.17, 0.06), hair, { p: [0, 0.16, -0.125] })); // hair back
  }
  if (peyot) for (const sx of [-1, 1])
    hp.push(pt(rng, box(0.035, 0.12, 0.035), hair, { p: [sx * 0.14, 0.06, 0.03] }));
  if (kippah) hp.push(pt(rng, kippahSmall ? cyl(0.08, 0.10, 0.035, 8) : cyl(0.11, 0.13, 0.045, 8),
    kippah, { p: [0, 0.315, -0.02], r: [0, 0, 0.07], jitter: 0.04 })); // slightly askew
  if (headscarf) {
    hp.push(pt(rng, box(0.29, 0.13, 0.27), headscarf, { p: [0, 0.245, -0.01] }));
    hp.push(pt(rng, box(0.29, 0.22, 0.08), headscarf, { p: [0, 0.11, -0.115] }));
  }
  hp.push(...headParts);
  const head = animPart(hp);
  head.position.set(0, 1.38, lean * 0.05);
  g.add(head);

  // ---- arms (pivot at shoulder, world y 1.32)
  const arms = [];
  for (const side of [-1, 1]) {
    const sleeve = pt(rng, box(0.11, 0.46, 0.11), shirt, { p: [0, -0.23, 0] });
    const sleeveCount = sleeve.attributes.position.count;
    const ap = [sleeve,
      pt(rng, box(0.09, 0.09, 0.09), gloves || skin, { p: [0, -0.49, 0], jitter: 0.04 })];
    ap.push(...(side < 0 ? leftHand : rightHand));
    const arm = animPart(ap);
    arm.position.set(side * (0.21 * torsoW + 0.065), 1.32, lean * 0.04);
    shirtEntries.push({ mesh: arm, start: 0, count: sleeveCount });
    g.add(arm); arms.push(arm);
  }

  // ---- legs (pivot at hip, world y 0.82; feet land exactly on the ground)
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = animPart([
      pt(rng, box(0.14, 0.80, 0.14), pants, { p: [0, -0.41, 0] }),
      pt(rng, box(0.15, 0.06, 0.20), shoes, { p: [0, -0.79, 0.025], jitter: 0.05 }),
    ]);
    leg.position.set(side * 0.11, 0.82, 0);
    g.add(leg); legs.push(leg);
  }

  g.userData.anim = { legs, arms, head };
  g.userData.shirt = shirtEntries; // vertex ranges for randomizeShirt()
  if (scale !== 1) g.scale.setScalar(scale);
  return g;
}

// ============================================================= QUADRUPEDS ==
// Shared rig: 1 static body mesh + 4 legs + head + tail (7 child meshes).
// legTop = leg length, so feet always land at y=0.
function quad(rng, o) {
  const { bodyHex, body = null, bodyY = 0, jitter = 0.1, statics = [],
    legHex, legW = 0.08, legTop, legX, legZ,
    headParts, headPivot, headRot = 0,
    tailParts, tailPivot, tailRot = 0 } = o;
  const g = new THREE.Group();
  const st = body
    ? [pt(rng, box(body[0], body[1], body[2]), bodyHex, { p: [0, bodyY, 0], jitter }), ...statics]
    : [...statics];
  g.add(merged(st));
  const legs = [];
  for (const [x, z] of [[legX, legZ[0]], [-legX, legZ[0]], [legX, legZ[1]], [-legX, legZ[1]]]) {
    const leg = animPart([pt(rng, box(legW, legTop, legW), legHex, { p: [0, -legTop / 2, 0] })]);
    leg.position.set(x, legTop, z);
    g.add(leg); legs.push(leg);
  }
  const head = animPart(headParts);
  head.position.set(...headPivot);
  head.rotation.x = headRot;
  g.add(head);
  const tail = animPart(tailParts);
  tail.position.set(...tailPivot);
  tail.rotation.x = tailRot;
  g.add(tail);
  g.userData.anim = { legs, head, tail };
  return g;
}

// ================================================================ PEOPLE ===

function settler(opts = {}) {
  const rng = srng(opts, 7);
  if (opts.female) {
    return human(rng, {
      shirt: 0xe2d8c8, hair: pick(rng, HAIRS),
      headscarf: pick(rng, [0xb0785a, 0x7a6884, 0x8a3e4a, 0x4a6b45]),
      skirt: pick(rng, [0x7a6884, 0x5c6152, 0x6e5a42]),
      tzitzit: false,
    });
  }
  return human(rng, {
    shirt: pick(rng, SHIRTS), hair: pick(rng, HAIRS),
    kippah: pick(rng, KIPPOT), tzitzit: true, peyot: true,
  });
}

function shepherd(opts = {}) {
  const rng = srng(opts, 13);
  return human(rng, {
    shirt: 0x8fa3ad, hair: pick(rng, HAIRS),
    kippah: pick(rng, KIPPOT), tzitzit: true, peyot: true,
    statics: [
      pt(rng, box(0.46, 0.36, 0.28), 0xd8d2c2, { p: [0, 1.12, 0], jitter: 0.16 }), // wool vest
      pt(rng, box(0.20, 0.26, 0.10), 0x6e5a42, { p: [0.26, 0.94, 0.02] }),         // shoulder bag
      pt(rng, box(0.05, 0.62, 0.03), 0x6e5a42, { p: [0.06, 1.16, 0.15], r: [0, 0, 0.38] }), // strap
      pt(rng, box(0.03, 0.14, 0.015), 0x6e5a42, { p: [-0.23, 0.85, 0.06] }),       // sling at belt
    ],
    rightHand: [ // staff, ground to shoulder — leans on it when idle
      pt(rng, cyl(0.018, 0.022, 1.25, 5), 0x7a5c3a, { p: [0.02, -0.63, 0.14] }),
    ],
  });
}

function guard(opts = {}) {
  const rng = srng(opts, 29);
  return human(rng, {
    shirt: 0x5c6152, pants: 0x4a463e, hair: 0x2e2c28, // dubon parka + dark watch cap
    kippah: pick(rng, KIPPOT), tzitzit: true, torsoW: 1.15,
    rightHand: [ // flashlight, pointing forward
      pt(rng, cyl(0.03, 0.035, 0.16, 6), 0x3a3a3e, { p: [0, -0.50, 0.10], r: [Math.PI / 2, 0, 0], jitter: 0.03 }),
      pt(rng, cyl(0.03, 0.03, 0.015, 6), 0xe8f0ff, { p: [0, -0.50, 0.185], r: [Math.PI / 2, 0, 0], jitter: 0 }),
    ],
  });
}

function supporter(opts = {}) { // yeshiva boy
  const rng = srng(opts, 41);
  return human(rng, {
    shirt: 0xf0ede2, pants: 0x26242a, hair: pick(rng, [0x1e1a16, 0x2a231c]),
    kippah: 0x1e1c20, kippahSmall: true, tzitzit: true, peyot: true, shoes: 0x2a2826,
  });
}

function volunteer(opts = {}) { // guard duty in an orange hi-vis vest
  const rng = srng(opts, 53);
  return human(rng, {
    shirt: 0x5c6152, pants: 0x4a463e, hair: 0x2e2c28,
    kippah: pick(rng, KIPPOT), tzitzit: true, torsoW: 1.1,
    statics: [
      pt(rng, box(0.50, 0.40, 0.30), 0xe0862e, { p: [0, 1.10, 0], jitter: 0.05 }),  // orange vest
      pt(rng, box(0.06, 0.36, 0.015), 0xdedcd2, { p: [-0.10, 1.10, 0.155], jitter: 0 }), // reflect
      pt(rng, box(0.06, 0.36, 0.015), 0xdedcd2, { p: [0.10, 1.10, 0.155], jitter: 0 }),  // stripes
    ],
    rightHand: [
      pt(rng, cyl(0.03, 0.035, 0.16, 6), 0x3a3a3e, { p: [0, -0.50, 0.10], r: [Math.PI / 2, 0, 0], jitter: 0.03 }),
    ],
  });
}

function inspector(opts = {}) { // civil-administration official
  const rng = srng(opts, 67);
  return human(rng, {
    shirt: 0xa8c4d8, pants: 0x4a4a52, hair: 0x3a342c, shoes: 0x3a3a3e,
    headParts: [
      pt(rng, box(0.25, 0.08, 0.23), 0x3e5c7a, { p: [0, 0.29, -0.005], jitter: 0.03 }), // cap dome
      pt(rng, box(0.22, 0.02, 0.12), 0x3e5c7a, { p: [0, 0.255, 0.165], jitter: 0.03 }), // brim
    ],
    leftHand: [
      pt(rng, box(0.16, 0.24, 0.015), 0xe8e4d8, { p: [0, -0.46, 0.10], r: [0.3, 0, 0], jitter: 0.02 }), // clipboard
      pt(rng, box(0.07, 0.025, 0.03), 0x5a5348, { p: [0, -0.35, 0.135], r: [0.3, 0, 0], jitter: 0 }),   // clip
    ],
  });
}

// =============================================================== HOSTILES ==
// Faceless by design (art.md §6.4): hood + balaclava block, NO facial
// features, no kippah/peyot/tzitzit — absence of the friendly silhouette IS
// the enemy read. Skulk lean 12° forward.
function hoodedFigure(rng, o = {}) {
  const jacket = o.jacket ?? 0x3a3a3e;
  return human(rng, {
    shirt: jacket, pants: 0x4a463e, balaclava: 0x2a2620,
    gloves: 0x2e2a28, shoes: 0x2e2a26, lean: 0.21, scale: o.scale ?? 1,
    headParts: [ // hood: open front, wraps top/back — face block stays visible
      pt(rng, box(0.30, 0.10, 0.26), jacket, { p: [0, 0.28, -0.03] }),
      pt(rng, box(0.30, 0.28, 0.08), jacket, { p: [0, 0.13, -0.14] }),
      ...(o.headParts || []),
    ],
    statics: o.statics || [], leftHand: o.leftHand || [], rightHand: o.rightHand || [],
  });
}

function thief(opts = {}) {
  const rng = srng(opts, 83);
  return hoodedFigure(rng, {
    jacket: 0x3a3a3e,
    leftHand: [ // empty sack, swings with the arm
      pt(rng, ico(0.13, 0), 0x4a463e, { p: [0, -0.56, 0.02], s: [1, 1.25, 0.85], jitter: 0.12 }),
      pt(rng, cyl(0.03, 0.045, 0.08, 5), 0x3e3a36, { p: [0, -0.44, 0.02] }), // gathered neck
    ],
  });
}

function raider(opts = {}) {
  const rng = srng(opts, 97);
  return hoodedFigure(rng, {
    jacket: 0x26262a,
    rightHand: [ // crowbar, angled forward
      pt(rng, cyl(0.018, 0.018, 0.62, 5), 0x44403c, { p: [0, -0.55, 0.05], r: [1.2, 0, 0], jitter: 0.03 }),
      pt(rng, box(0.05, 0.03, 0.04), 0x44403c, { p: [0, -0.44, 0.33], r: [1.2, 0, 0], jitter: 0.03 }), // bent tip
    ],
  });
}

function leader(opts = {}) {
  const rng = srng(opts, 113);
  return hoodedFigure(rng, {
    jacket: 0x26262a, scale: 1.15, // ~1.95 m
    headParts: [
      pt(rng, box(0.285, 0.055, 0.265), 0xa83232, { p: [0, 0.20, -0.005], jitter: 0.03 }), // red bandana
      pt(rng, box(0.04, 0.10, 0.03), 0xa83232, { p: [0, 0.15, -0.145], r: [0.3, 0, 0], jitter: 0.03 }), // knot tail
    ],
    rightHand: [
      pt(rng, cyl(0.018, 0.018, 0.62, 5), 0x44403c, { p: [0, -0.55, 0.05], r: [1.2, 0, 0], jitter: 0.03 }),
      pt(rng, box(0.05, 0.03, 0.04), 0x44403c, { p: [0, -0.44, 0.33], r: [1.2, 0, 0], jitter: 0.03 }),
    ],
  });
}

// ================================================================ ANIMALS ==

function dog(opts = {}) { // sandy shepherd-mix, standing ears, tail curled up
  const rng = srng(opts, 131);
  const coat = 0xd8cbb0;
  return quad(rng, {
    bodyHex: coat, body: [0.26, 0.28, 0.58], bodyY: 0.42, jitter: 0.12,
    statics: [
      pt(rng, box(0.24, 0.16, 0.16), coat, { p: [0, 0.33, 0.22], jitter: 0.12 }), // deep chest
      pt(rng, box(0.15, 0.12, 0.18), 0xb09a78, // seed-varied back patch
        { p: [(rng() - 0.5) * 0.14, 0.53, (rng() - 0.5) * 0.3], jitter: 0.1 }),
    ],
    legHex: coat, legW: 0.08, legTop: 0.28, legX: 0.15, legZ: [0.20, -0.20],
    headParts: [
      pt(rng, box(0.20, 0.18, 0.22), coat, { p: [0, 0.04, 0.08], jitter: 0.1 }),
      pt(rng, box(0.10, 0.09, 0.13), 0x8a7a5e, { p: [0, 0.0, 0.24] }),            // muzzle
      pt(rng, box(0.05, 0.11, 0.03), coat, { p: [-0.07, 0.17, 0.03], r: [0, 0, 0.12] }), // ears UP
      pt(rng, box(0.05, 0.11, 0.03), coat, { p: [0.07, 0.17, 0.03], r: [0, 0, -0.12] }),
      pt(rng, box(0.04, 0.03, 0.03), 0x3a342c, { p: [0, 0.0, 0.315], jitter: 0 }), // nose
    ],
    headPivot: [0, 0.50, 0.27],
    tailParts: [pt(rng, box(0.05, 0.05, 0.30), coat, { p: [0, 0, -0.14], jitter: 0.1 })],
    tailPivot: [0, 0.50, -0.28], tailRot: 1.3, // curled up over the back
  });
}

function donkey(opts = {}) { // grey, comically tall ears, dark mane, saddle bags
  const rng = srng(opts, 149);
  const coat = 0x8a8378, dark = 0x4a443c;
  return quad(rng, {
    bodyHex: coat, body: [0.40, 0.50, 0.85], bodyY: 0.75,
    statics: [
      pt(rng, box(0.16, 0.36, 0.20), coat, { p: [0, 1.02, 0.36], r: [0.5, 0, 0] }),   // neck
      pt(rng, box(0.05, 0.34, 0.09), dark, { p: [0, 1.08, 0.30], r: [0.5, 0, 0] }),   // mane strip
      pt(rng, box(0.46, 0.05, 0.50), 0x8a3e4a, { p: [0, 1.02, -0.05], jitter: 0.05 }),// flank pad
      pt(rng, box(0.14, 0.30, 0.34), 0x6e5a42, { p: [-0.28, 0.80, -0.05] }),          // saddle bags
      pt(rng, box(0.14, 0.30, 0.34), 0x6e5a42, { p: [0.28, 0.80, -0.05] }),
      pt(rng, box(0.34, 0.16, 0.10), 0xa89f8d, { p: [0, 0.52, 0], jitter: 0.06 }),    // pale belly
    ],
    legHex: coat, legW: 0.09, legTop: 0.50, legX: 0.16, legZ: [0.30, -0.30],
    headParts: [
      pt(rng, box(0.18, 0.22, 0.40), coat, { p: [0, -0.02, 0.14], r: [0.35, 0, 0] }), // long head, angled down
      pt(rng, box(0.15, 0.15, 0.10), 0xa89f8d, { p: [0, -0.12, 0.33] }),              // pale muzzle
      pt(rng, box(0.06, 0.24, 0.04), coat, { p: [-0.07, 0.20, 0.0], r: [-0.15, 0, -0.15] }), // TALL ears
      pt(rng, box(0.06, 0.24, 0.04), coat, { p: [0.07, 0.20, 0.0], r: [-0.15, 0, 0.15] }),
    ],
    headPivot: [0, 1.18, 0.44],
    tailParts: [
      pt(rng, box(0.04, 0.30, 0.04), coat, { p: [0, -0.15, 0] }),
      pt(rng, box(0.07, 0.13, 0.07), dark, { p: [0, -0.35, 0] }), // dark tassel
    ],
    tailPivot: [0, 0.92, -0.44], tailRot: -0.15,
  });
}

function sheep(opts = {}) { // woolly ico blob, black face + legs; {lamb:true} = x0.6
  const rng = srng(opts, 167);
  const wool = opts.lamb ? 0xf2ede0 : 0xe6e0d2, black = 0x2a2620;
  const g = quad(rng, {
    statics: [ // body is the wool blob itself — no box body
      pt(rng, ico(0.34, 0), wool, { p: [0, 0.52, 0], s: [1.05, 0.85, 1.3], jitter: 0.18 }), // wool lump
      pt(rng, ico(0.22, 0), wool, { p: [0, 0.62, -0.18], s: [1, 0.8, 1], jitter: 0.18 }),   // rump lump
    ],
    legHex: black, legW: 0.07, legTop: 0.34, legX: 0.14, legZ: [0.22, -0.22],
    headParts: [
      pt(rng, box(0.16, 0.16, 0.20), black, { p: [0, 0.02, 0.07], jitter: 0.05 }),
      pt(rng, box(0.16, 0.10, 0.14), wool, { p: [0, 0.13, 0.0], jitter: 0.14 }),  // wool cap
      pt(rng, box(0.09, 0.04, 0.05), 0x3a342c, { p: [-0.10, 0.04, 0.06], r: [0, 0, 0.55] }), // droopy ears
      pt(rng, box(0.09, 0.04, 0.05), 0x3a342c, { p: [0.10, 0.04, 0.06], r: [0, 0, -0.55] }),
    ],
    headPivot: [0, 0.56, 0.40], headRot: 0.1,
    tailParts: [pt(rng, box(0.06, 0.06, 0.11), wool, { p: [0, 0, -0.05], jitter: 0.14 })],
    tailPivot: [0, 0.56, -0.42], tailRot: -0.5,
  });
  if (opts.lamb) g.scale.setScalar(0.6);
  return g;
}

function goat(opts = {}) { // slimmer, brown-black, back-swept horns, beard
  const rng = srng(opts, 181);
  const coat = pick(rng, [0x2e2a26, 0x4a3a2c, 0x5c4632]);
  return quad(rng, {
    bodyHex: coat, body: [0.28, 0.38, 0.60], bodyY: 0.52,
    statics: [pt(rng, box(0.13, 0.26, 0.14), coat, { p: [0, 0.70, 0.28], r: [0.4, 0, 0] })], // neck
    legHex: coat, legW: 0.07, legTop: 0.34, legX: 0.12, legZ: [0.24, -0.24],
    headParts: [
      pt(rng, box(0.15, 0.17, 0.24), coat, { p: [0, 0.06, 0.08], jitter: 0.06 }),
      pt(rng, cone(0.028, 0.16, 5), 0x8c8474, { p: [-0.05, 0.17, 0.02], r: [-1.0, 0, -0.15] }), // horns
      pt(rng, cone(0.028, 0.16, 5), 0x8c8474, { p: [0.05, 0.17, 0.02], r: [-1.0, 0, 0.15] }),
      pt(rng, box(0.05, 0.10, 0.05), 0x1e1a16, { p: [0, -0.06, 0.17] }),           // beard
      pt(rng, box(0.13, 0.04, 0.06), coat, { p: [-0.10, 0.09, 0.05], r: [0, 0, 0.65] }), // LONG floppy ears
      pt(rng, box(0.13, 0.04, 0.06), coat, { p: [0.10, 0.09, 0.05], r: [0, 0, -0.65] }),
    ],
    headPivot: [0, 0.80, 0.36],
    tailParts: [pt(rng, box(0.05, 0.05, 0.13), coat, { p: [0, 0, -0.06] })],
    tailPivot: [0, 0.68, -0.30], tailRot: 1.0, // perky up-tail
  });
}

function chicken(opts = {}) { // tiny: white (or rust) blob, red comb; 2 legs + bobbing head
  const rng = srng(opts, 193);
  const body = rng() < 0.7 ? 0xece6d6 : 0xa05a32;
  const g = new THREE.Group();
  g.add(merged([
    pt(rng, ico(0.14, 0), body, { p: [0, 0.20, -0.01], s: [1, 0.85, 1.15], jitter: 0.1 }),
    pt(rng, box(0.02, 0.12, 0.10), body, { p: [0, 0.29, -0.15], r: [0.6, 0, 0], jitter: 0.1 }), // tail fan
  ]));
  const head = animPart([
    pt(rng, box(0.06, 0.09, 0.06), body, { p: [0, 0.03, 0], jitter: 0.06 }),  // neck
    pt(rng, box(0.08, 0.09, 0.08), body, { p: [0, 0.11, 0.01], jitter: 0.06 }),
    pt(rng, box(0.02, 0.05, 0.06), 0xc14b3a, { p: [0, 0.18, 0.0], jitter: 0.03 }), // comb
    pt(rng, cone(0.02, 0.05, 4), 0xd9a441, { p: [0, 0.10, 0.075], r: [Math.PI / 2, 0, 0], jitter: 0.02 }), // beak
  ]);
  head.position.set(0, 0.28, 0.09);
  g.add(head);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = animPart([
      pt(rng, box(0.02, 0.12, 0.02), 0xd9a441, { p: [0, -0.06, 0], jitter: 0.03 }),
      pt(rng, box(0.05, 0.015, 0.06), 0xd9a441, { p: [0, -0.113, 0.015], jitter: 0.03 }), // foot
    ]);
    leg.position.set(sx * 0.045, 0.12, 0);
    g.add(leg); legs.push(leg);
  }
  g.userData.anim = { legs, head, tail: null };
  return g;
}

function jackal(opts = {}) { // lean, sandy grey-tan, big ears, low bushy tail
  const rng = srng(opts, 211);
  const coat = 0x9a8a6e;
  return quad(rng, {
    bodyHex: coat, body: [0.20, 0.26, 0.52], bodyY: 0.46, jitter: 0.11,
    statics: [pt(rng, box(0.18, 0.14, 0.14), coat, { p: [0, 0.38, 0.22], jitter: 0.11 })], // chest
    legHex: coat, legW: 0.06, legTop: 0.33, legX: 0.11, legZ: [0.19, -0.19],
    headParts: [
      pt(rng, box(0.17, 0.15, 0.18), coat, { p: [0, 0.03, 0.07], jitter: 0.08 }),
      pt(rng, box(0.07, 0.07, 0.13), 0x7a6a52, { p: [0, 0.0, 0.20] }),           // narrow muzzle
      pt(rng, box(0.07, 0.12, 0.025), coat, { p: [-0.065, 0.15, 0.02], r: [0, 0, 0.15] }), // BIG ears
      pt(rng, box(0.07, 0.12, 0.025), coat, { p: [0.065, 0.15, 0.02], r: [0, 0, -0.15] }),
    ],
    headPivot: [0, 0.54, 0.25],
    tailParts: [
      pt(rng, box(0.08, 0.08, 0.26), coat, { p: [0, 0, -0.13], jitter: 0.12 }),
      pt(rng, box(0.06, 0.06, 0.07), 0x3e3830, { p: [0, 0, -0.28], jitter: 0.05 }), // dark tip
    ],
    tailPivot: [0, 0.46, -0.25], tailRot: -0.55, // carried LOW
  });
}

function wolf(opts = {}) { // bigger, grizzled grey, bushy tail, amber eyes
  const rng = srng(opts, 227);
  const coat = 0x6e6a62;
  return quad(rng, {
    bodyHex: coat, body: [0.28, 0.36, 0.72], bodyY: 0.62, jitter: 0.1,
    statics: [
      pt(rng, box(0.17, 0.06, 0.58), 0x4a463e, { p: [0, 0.81, -0.02], jitter: 0.08 }), // dark back-strip
      pt(rng, box(0.26, 0.20, 0.18), coat, { p: [0, 0.50, 0.30], jitter: 0.1 }),        // deep chest
    ],
    legHex: coat, legW: 0.08, legTop: 0.44, legX: 0.14, legZ: [0.28, -0.28],
    headParts: [
      pt(rng, box(0.22, 0.20, 0.22), coat, { p: [0, 0.03, 0.07], jitter: 0.08 }),
      pt(rng, box(0.10, 0.10, 0.16), 0x5a564e, { p: [0, -0.01, 0.24] }),          // muzzle
      pt(rng, box(0.06, 0.10, 0.03), coat, { p: [-0.08, 0.16, 0.02], r: [0, 0, 0.12] }), // ears
      pt(rng, box(0.06, 0.10, 0.03), coat, { p: [0.08, 0.16, 0.02], r: [0, 0, -0.12] }),
      pt(rng, box(0.028, 0.022, 0.02), 0xc9a441, { p: [-0.06, 0.06, 0.185], jitter: 0 }), // amber eyes
      pt(rng, box(0.028, 0.022, 0.02), 0xc9a441, { p: [0.06, 0.06, 0.185], jitter: 0 }),  // (catch dusk light)
    ],
    headPivot: [0, 0.72, 0.36], headRot: -0.14, // slink: nose slightly down
    tailParts: [pt(rng, box(0.10, 0.10, 0.40), coat, { p: [0, 0, -0.19], jitter: 0.13 })], // bushy
    tailPivot: [0, 0.66, -0.37], tailRot: -0.3,
  });
}

function boar(opts = {}) { // dark barrel wedge, pale snout, small pale tusks
  const rng = srng(opts, 241);
  const bristle = 0x4a3e32;
  return quad(rng, {
    bodyHex: bristle, body: [0.42, 0.50, 0.78], bodyY: 0.50, jitter: 0.1,
    statics: [pt(rng, box(0.13, 0.08, 0.58), 0x2e2822, { p: [0, 0.77, -0.04], jitter: 0.08 })], // spine ridge
    legHex: bristle, legW: 0.08, legTop: 0.26, legX: 0.16, legZ: [0.27, -0.27],
    headParts: [
      pt(rng, box(0.30, 0.30, 0.26), bristle, { p: [0, -0.01, 0.09], jitter: 0.08 }),
      pt(rng, box(0.12, 0.12, 0.16), 0x6e5a48, { p: [0, -0.05, 0.28] }),           // pale snout
      pt(rng, cone(0.02, 0.09, 4), 0xe8e0cc, { p: [-0.075, -0.09, 0.28], r: [0.5, 0, -0.2], jitter: 0.02 }), // tusks
      pt(rng, cone(0.02, 0.09, 4), 0xe8e0cc, { p: [0.075, -0.09, 0.28], r: [0.5, 0, 0.2], jitter: 0.02 }),
      pt(rng, box(0.05, 0.07, 0.025), bristle, { p: [-0.10, 0.15, 0.0] }),          // small ears
      pt(rng, box(0.05, 0.07, 0.025), bristle, { p: [0.10, 0.15, 0.0] }),
    ],
    headPivot: [0, 0.54, 0.38], headRot: -0.1,
    tailParts: [pt(rng, box(0.03, 0.03, 0.15), bristle, { p: [0, 0, -0.07] })],
    tailPivot: [0, 0.62, -0.40], tailRot: -0.8,
  });
}

// ============================================================== FALLBACK ===

function fallback(opts = {}) { // plain grey box person, still fully animatable
  const rng = srng(opts, 251);
  return human(rng, {
    shirt: 0x9a9a9a, pants: 0x6e6e6e, skin: 0xb0b0b0, hair: 0x808080, shoes: 0x5a5a5a,
  });
}

// ================================================================ EXPORTS ==

export const LIFE_BUILDERS = {
  settler, shepherd, guard, supporter, volunteer, inspector,
  dog, donkey, sheep, goat, chicken,
  jackal, wolf, boar,
  thief, raider, leader,
  __fallback: fallback,
};

// Repaint a human's shirt (torso + sleeves) vertex colors in place.
// Works via the vertex ranges recorded at build time in group.userData.shirt;
// no-op for non-humans / groups without that metadata.
export function randomizeShirt(group, hex) {
  const entries = group && group.userData && group.userData.shirt;
  if (!entries) return;
  const c = new THREE.Color(hex);
  for (const { mesh, start, count } of entries) {
    const attr = mesh.geometry && mesh.geometry.getAttribute('color');
    if (!attr) continue;
    for (let i = start; i < start + count; i++) {
      // keep a hint of per-vertex variation so it doesn't look flat
      const j = 0.96 + 0.08 * ((i * 2654435761 >>> 16 & 255) / 255);
      attr.setXYZ(i, Math.min(1, c.r * j), Math.min(1, c.g * j), Math.min(1, c.b * j));
    }
    attr.needsUpdate = true;
  }
}
