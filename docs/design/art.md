# Hilltop RTS — Art Bible (Procedural Low-Poly)

Authoritative visual spec. 1 world unit = 1 meter. Every model is a composition of Three.js
primitives (Box/Cylinder/Cone/Icosahedron/Torus/Plane), vertex-painted, `toNonIndexed()`,
merged with `mergeGeometries`, rendered with the ONE shared `MeshLambertMaterial({vertexColors:true, flatShading:true})`
(see `docs/research/threejs-tech.md` §2). No model exceeds ~120 triangles equivalent.
All hexes below are final — copy them into `src/palette.js` verbatim.

Recipe notation: `Primitive(args) @ (x,y,z) rot(rx,ry,rz) #hex` — positions are the part's
center relative to the model origin (origin = ground contact point). `jitter` = per-vertex
lightness jitter `offsetHSL(0, 0, (rand-0.5)*0.08)` — apply to ALL organic/weathered surfaces,
skip it only on flags, glass, and UI-ish parts.

---

## 1. PALETTE — the single source of truth

### 1.1 Terrain

| Token | Hex | Use |
|---|---|---|
| `grassValley` | `#7d8a55` | lowest, greenest band (wadi floors) |
| `grassScrub` | `#8f9a62` | mid-slope scrub band |
| `grassDry` | `#b0a284` | hilltop dry golden grass (dominant band) |
| `grassParched` | `#c4b291` | summer-only tint lerp target for `grassDry` |
| `rockLimestone` | `#9d9484` | slope > 0.55, outcrops, boulders |
| `rockLimestoneLit` | `#b3aa97` | sun-bleached top faces of boulders |
| `rockShadowFace` | `#7e766a` | underside faces of rocks (paint per-face after `toNonIndexed`) |
| `dirtPath` | `#b99a6b` | baked path vertex-darkening, courtyard ground |
| `dirtFresh` | `#8a6d48` | dug earth, boar damage, new plots |
| `terraceWall` | `#a89f8d` | dry-stone terrace walls |
| `terraceWallDark` | `#8c8474` | shaded stones in terrace walls (alternate stones) |
| `springWater` | `#5d8fa6` | spring pool surface (with `#7fb3c4` highlight verts) |
| `mudWinter` | `#6e5a42` | winter mud patches near troughs/gate |

Terrain splat rule (vertex colors on the one 256m plane, 128×128 seg): slope > 0.55 →
`rockLimestone`; height > 14 → `grassDry`; height > 6 → `grassScrub`; else `grassValley`;
then ±5% lightness noise patchiness. Terraces: quantize height in 1.5 m steps on the south
slope and paint the step risers `terraceWall`.

### 1.2 Sky / atmosphere keyframes (drives sky-gradient shader + fog + hemi light)

| dayT | Phase | skyTop | skyBottom (=fog) | hemi sky | hemi ground |
|---|---|---|---|---|---|
| 0.00 | Midnight | `#0e1526` | `#0c1220` | `#1a2340` | `#141210` |
| 0.23 | Dawn | `#6a7fae` | `#c9a98b` | `#8b8fa8` | `#5a4c3a` |
| 0.35 | Morning | `#a8c4e0` | `#cfd8e6` | `#bcd0e6` | `#8a7f66` |
| 0.60 | Noon | `#b6d0ea` | `#d8e0ec` | `#cddcee` | `#96896e` |
| 0.75 | Golden hour | `#8e7fa8` | `#d8b090` | `#b09cae` | `#7a6448` |
| 0.85 | Dusk | `#1c2742` | `#141c30` | `#2c3654` | `#1c1814` |

### 1.3 Lighting

| Light | Color | Intensity | Notes |
|---|---|---|---|
| Sun (noon) | `#fff7e8` | 2.9 | the ONE shadow caster, 2048 map |
| Sun (morning) | `#fff2dd` | 2.6 | |
| Sun (dawn) | `#ff9a5c` | 1.2 | long shadows, azimuth east |
| Sun (golden) | `#ffb066` | 1.4 | the game's beauty shot; shadows longest |
| Moon (same DirectionalLight recolored) | `#8fa3c8` | 0.18 | `castShadow=false` at night |
| Campfire PointLight | `#ff8c3a` | 2.2, dist 8, decay 2 | flicker ±15% by sine noise, no shadow |
| Generator work lamp | `#ffd98a` | 1.6, dist 10 | off on Shabbat |
| Guard flashlight (SpotLight) | `#e8f0ff` | 3.0, angle 0.22, dist 14 | no shadow; max 1 active |
| Shabbat candle-window glow | emissive verts `#ffbf6e` | — | swap window vert color, no light object |

### 1.4 UI accents (DOM/CSS, RTL Hebrew)

| Token | Hex | Use |
|---|---|---|
| `uiPanel` | `#2a2620` at 88% opacity | panel background (dark olive-brown, warm) |
| `uiPanelEdge` | `#4a4336` | 1px borders |
| `uiText` | `#efe8d8` | body text (warm off-white) |
| `uiSpirit` | `#d9a441` | Spirit (רוח) meter, warm gold — the hero color |
| `uiWater` | `#4d8bb5` | water resource |
| `uiFood` | `#7fa055` | food resource |
| `uiWood` | `#9a6b3f` | wood resource |
| `uiStone` | `#8d8578` | stone resource |
| `uiShekel` | `#b8a24c` | shekels (muted brass, distinct from Spirit gold by icon) |
| `uiSelect` | `#59c26a` | friendly selection, valid build ghost |
| `uiEnemy` | `#d9534f` | hostile markers, invalid ghost, demolition-order timer |
| `uiAlert` | `#e8a33d` | warning pings, telegraph countdowns |
| `uiShabbat` | `#c9b8e8` | soft lavender wash overlay during Shabbat |

---

## 2. TERRAIN LOOK — the Samaria hill

One rounded limestone ridge, outpost plateau at the top (flattened disc r≈22 m via `plateau()`
falloff). Composition around it:

- **Terraced south slope**: height quantized in 1.5 m steps for 6–8 steps; each riser gets a
  low dry-stone wall strip (instanced wall segments, §3.36). 2–3 terraces are "restorable" —
  start half-collapsed (wall segments tumbled, `dirtFresh` fill), restored state is straight
  wall + tilled plot.
- **Olive trees**: ~60 instanced, clustered on terraces and along the wadi; 4 "ancient" variants
  (thicker, twisted trunk, ×1.6 scale) as landmarks near the ruin.
- **Boulders**: ~120 instanced icosahedron rocks in 3 sizes, biased to slope > 0.4; one
  boulder-pile cluster (hyrax colony ambience point) NE of the plateau.
- **Sabra cactus hedges**: 2 hedge lines (~14 instances each) flanking the dirt path, plus
  scattered singles.
- **Dirt path**: baked vertex-darkening (`dirtPath`) along a spline from the plateau gate,
  switchbacking down the east slope to the map-edge road (road = 6 m wide `#8f8375` band with
  faded center dashes `#b5ab99`). Junction with hitchhiking post at the road.
- **The spring (מעיין)**: NW foot of the hill. Rock alcove (5 boulders), a 3×2 m pool —
  flat disc `CircleGeometry(1.6, 12)` painted `springWater` with 3 highlight verts `#7fb3c4`,
  animated by gentle y-scale wobble; fig tree beside it; jerrycans always staged here.
- **The ruin (חירבה)**: SE saddle — 3 wall stubs, one ancient olive-press stone
  (Cylinder(1.1, 1.1, 0.5, 10) `rockLimestone` with a Torus groove `rockShadowFace`).
- **Grass tufts**: 2000–3000 instanced 3-blade fans, colors sampled from the terrain band they
  sit on ×1.1 lightness; no shadows either way.
- **Wadi**: dry stream bed of pale pebbles (`#b3aa97` noise strip) along the valley floor.

Season tinting: single uniform `seasonT` lerps grass instance colors and terrain vertex colors
winter (`grassValley` everywhere, +mud patches) → summer (`grassParched` dominant). Almond tree
by the synagogue flips to blossom colors in late winter (§3.35 charm).

---

## 3. MODEL SPEC SHEET

Shared conventions: humans 1.7 m tall (heroic-chibi: head slightly oversized at 0.26 m cube —
reads at iso distance); all quadrupeds share the 6-box rig (body, head, 4 leg boxes with top
pivots). Legs animate by pivot rotation in JS, no skinning. Every unit's static parts are
merged to 1 geometry; animated parts (legs, head, tail, arms) stay separate meshes in a Group
(≤ 4 draw calls per unit).

### 3.A People (shared BASE HUMAN rig, ~90 tris)

BASE HUMAN (build once, recolor per variant):
- Torso `Box(0.42,0.55,0.24) @ (0,1.08,0)` — shirt color
- Head `Box(0.26,0.26,0.24) @ (0,1.52,0)` skin `#d9a678`; hair cap: Box top-face verts painted hair color
- Kippah `Cylinder(0.11,0.13,0.045,8) @ (0,1.665,-0.02)` — big knitted kippah, covers half the crown
- Arms 2× `Box(0.11,0.48,0.11)` pivot at shoulder `(±0.27,1.32,0)` — shirt color, hand tip verts skin
- Legs 2× `Box(0.14,0.52,0.14)` pivot at hip `(±0.11,0.82,0)` — pants `#5a5348`
- Sandals: bottom 0.05 of leg boxes painted `#7a5c3a`
- **Tzitzit**: 4 thin `Box(0.02,0.16,0.02)` white `#f4f1e6` hanging at waist corners `(±0.19,0.78,±0.10)` — parented to torso, swing ±20° with walk phase. THE silhouette signature.
- Peyot: 2× `Box(0.035,0.12,0.035)` hair color at `(±0.14,1.44,0.02)`

1. **Settler youth (builder/worker)** — shirt white `#f0ede2` (dusty: jitter ×2), kippah white-with-pattern: base `#e8e4d8` + 3 rim verts `#3d6b8f`. Charm: carries a plank `Box(0.06,0.04,0.9)` `palletWood #b08d5a` on shoulder when hauling; kippah slightly askew (rot z 0.08).
2. **Shepherd** — shirt faded blue `#8fa3ad`, wool vest `Box(0.46,0.34,0.28)` `#d8d2c2` over torso. Stick: `Cylinder(0.018,0.018,1.25,5) #7a5c3a` in hand, leans on it when idle. Sling `Box(0.03,0.14,0.01) #6e5a42` at belt. Charm: idle animation twirls the sling lazily every ~12 s.
3. **Guard (night)** — IDF-surplus dubon parka `#5c6152` (bulkier torso ×1.15), dark watch cap replaces visible hair (kippah still on top). Flashlight: `Cylinder(0.03,0.035,0.16,6) #3a3a3e` in hand + the SpotLight + a translucent cone `Cone(0.5,3,8)` `#e8f0ff` opacity 0.10 (separate transparent material — the one allowed exception). Charm: hums — tiny music-note DOM sprite pops above head periodically on shift.
4. **Girl volunteer** — long skirt: legs replaced by `Cylinder(0.19,0.26,0.62,8) #7a6884`; blouse `#e2d8c8`; hair long dark `#3e3228` (back box), no kippah; headscarf variant `#b0785a` for the married-woman NPC. Charm: carries a produce crate `Box(0.34,0.2,0.24) #b08d5a` with 4 tomato-red `#c14b3a` icosa verts inside.
5. **Supporter (muster event crowd)** — cheap variant: BASE HUMAN, shirt randomized from [`#f0ede2`, `#c8ccd4`, `#a8b49a`, `#d9c9a8`], no tools. Spawned 8–20 at once for demolition-order freezes; share one merged geometry per shirt color, positions via InstancedMesh if > 12. Charm: a couple hold a hand-painted sign `Box(0.45,0.3,0.02) #e8e4d8`.

### 3.B Animals

6. **Sheep (~60 tris)** — Wool body `Box(0.72,0.46,0.44) @ (0,0.52,0)` `#e6e0d2`, per-vertex jitter ×2 for wool lumpiness; head `Box(0.2,0.2,0.26) @ (0,0.62,0.42)` — white head default, 30% brown-head `#8a6a4e` (Awassi look); ears 2× `Box(0.1,0.05,0.06)` droopy rot x −0.5; legs 4× `Box(0.07,0.32,0.07)` `#cfc8b8`; tail stub. Lamb = ×0.55 scale, pure white `#f2ede0`. Charm: named ewes get a colored yarn collar vert ring; the bottle-fed orphan lamb follows its bonded human with a tiny excited hop cycle.
7. **Goat (~65 tris)** — narrower body `Box(0.62,0.42,0.36)` black `#2e2a26` or brown `#5c4632`; longer neck box; head with 2 back-swept horn `Cone(0.03,0.18,5) #8c8474`; ears LONG floppy `Box(0.14,0.04,0.06)` rot x −0.9. **Lead goat**: brass bell `Cylinder(0.05,0.06,0.07,6) #b8a24c` under chin — bell audio follows her. Charm: goats idle-climb onto rocks/hay bales (allowed nav exception).
8. **Guard dog (~70 tris)** — pale kangal-mutt `#d8cbb0`: body `Box(0.58,0.34,0.26) @ (0,0.46,0)`, chest deeper front; head `Box(0.2,0.18,0.24)` with darker muzzle `#8a7a5e`; ears 2× small `Box(0.06,0.09,0.03)`; tail `Box(0.05,0.05,0.3)` rot x 0.7 — curls UP `rot x 1.4` when alert. Legs 4× `Box(0.08,0.34,0.08)`. Charm: tail wag speed = proximity to bonded shepherd; sleeps curled (body rot z, tail wrap) in the zula by day.
9. **Donkey (~75 tris)** — grey `#8a8378`, belly `#a89f8d`: body `Box(0.85,0.5,0.4) @ (0,0.75,0)`; head LONG `Box(0.18,0.22,0.42)` angled down; ears comically tall 2× `Box(0.06,0.24,0.04)`; dark mane strip verts `#4a443c`; legs 4× `Box(0.09,0.55,0.09)`; dark tail tassel. Charm: when loaded, 2 jerrycan models strapped to flank pads `#6e5a42`; ears rotate back in protest + bray when a load is added.
10. **Wolf (~70 tris)** — dog rig, leaner: body `Box(0.62,0.32,0.24)`, grizzled grey `#6e6a62` with `#4a463e` back-strip verts; straight low tail; eyes: 2 verts `#c9a441` (catch the light at dusk). Slink pose: body pitched down 8°. Charm: routs with tail literally between legs (tail rot x −1.2).
11. **Jackal (~65 tris)** — wolf ×0.72 scale, sandier `#9a8a6e`, bigger ears, tail bushier (`Box(0.06,0.06,0.26)` + tip vert `#3e3830`). Moves in skittish 2-step darts. Charm: sits and howls — head box rot x −0.9, synced with the WebAudio howl.
12. **Wild boar (~80 tris)** — bulky wedge: body `Box(0.78,0.5,0.42) @ (0,0.45,0)` dark bristle `#4a3e32`, spine ridge verts `#2e2822`; head `Box(0.3,0.3,0.3)` merging into snout `Box(0.1,0.1,0.14) #6e5a48`; 2 tusk `Cone(0.02,0.09,4) #e8e0cc`; thin legs 4× `Box(0.08,0.3,0.08)`; piglet variant ×0.4 with `#8a6a4e` stripe verts. Charm: rooting animation — head down, dirt-puff FX at snout, leaves a `dirtFresh` decal patch.
13. **Chicken (~40 tris)** — body `Icosahedron(0.14,0)` squashed y×0.85, white `#ece6d6` or rust `#a05a32`; head `Box(0.08,0.09,0.08)` on neck box; comb 2 verts `#c14b3a`; beak `Cone(0.02,0.05,4) #d9a441`; tail fan `Box(0.02,0.12,0.1)` rot x 0.6; legs 2× `Box(0.02,0.12,0.02) #d9a441`. Move: pure head-bob teleport-peck, no leg anim needed. Charm: scatter-flap (y-hop + wing boxes flash out) when anything runs through the yard.

### 3.C Buildings & structures

14. **Tent (~30 tris)** — A-frame: 2 leaning `Box(1.8,0.04,2.2)` planes meeting at ridge 1.4 m, army green `#6e7258` or tarp blue `#3e5c7a`; ridge pole `Cylinder(0.03,...)` sticking out both ends `#7a5c3a`; guy-line verts. Tier-0 housing. Charm: door flap corner folded back showing dark interior `#2a2620`; glows faint warm at night.
15. **Caravan (~110 tris)** — body `Box(5.2,2.4,2.3) @ (0,1.55,0)` off-white `#e8e2d4`, roof face `#cfc9ba` (sun-bleached), rust streak verts `#8a5a3e` below window corners; 3 window insets `Box(0.7,0.5,0.05) #2e3a44`; door `Box(0.8,1.7,0.05) #b0a894`; 4 concrete-block feet `Box(0.4,0.5,0.4) #8d8578`; plywood porch `Box(1.6,0.08,1.2) #b08d5a` + 2 step boxes; **dud shemesh** solar heater on roof: `Cylinder(0.28,0.28,1.4,8)` horizontal `#3a3a3e` + tilted panel `Box(1.1,0.05,0.8) #2e3a44`. Charm: crooked flag pole lashed to the corner (see 3.30, mini version); at night one window vert-swaps to warm `#ffbf6e`.
16. **Shipping container (~70 tris)** — `Box(6,2.6,2.4)` rust-red `#8a4a32` (variant teal `#3d6b63`); corrugation = 5 thin rib boxes `Box(0.06,2.5,0.04)` per long side, painted 8% darker; door end: 2 vertical door panels + 2 lock-rod cylinders `#5a5348`; cut window with angle-grinder burn rim verts `#3a3230`. Charm: Hebrew chalk graffiti = white decal plane `Box(1.4,0.5,0.01) #e8e4d8` low-opacity — renders "אין ייאוש בעולם כלל" as DOM label when inspected.
17. **Sheep pen (dir) (~100 tris for 8×6 m)** — perimeter: pallet-section fence `Box(1.5,1.0,0.08)` instanced, `palletWood #b08d5a` with 3 darker slat lines `#9a8468`; pipe corner posts `Cylinder(0.04,0.04,1.3,6) #6e6a62`; **shade net roof**: `Box(6,0.03,4)` over half the pen, `shadeNet #4a6b45`, opacity 0.85, draped 0.2 m sag (translate mid verts down); trough: half-barrel `Cylinder(0.3,0.3,1.2,8, half)` blue `#2e5f8a`; hay pile `Icosahedron(0.7,0)` squashed `#c9b458` under mini-tarp. Charm: gate section swings (pivot anim) with a wired-on tin sign; zip-tie patch verts `#e8e4d8` dotting the net.
18. **Watchtower (~110 tris)** — 4 legs `Cylinder(0.06,0.08,4.2,5) #7a5c3a` splayed 10°; X-brace thin boxes per side; platform `Box(2,0.12,2) @ (0,4.3,0) #b08d5a`; railing 8 thin boxes; tin roof `Cone(1.7,0.7,4) #9aa0a4` rotated 45° (pyramid); ladder: 2 rails + 6 rung boxes. Guard slot on top. Charm: floodlight `Box(0.18,0.14,0.14) #3a3a3e` on rail corner — swaps to emissive `#fff2c8` verts when powered at night; a plastic chair `#e8e2d4` on the platform.
19. **Water tower (~60 tris)** — welded stand: 4 angle-iron legs `Box(0.08,3.2,0.08) #5a5348` + cross braces; tank `Cylinder(1.0,1.0,1.5,10) @ (0,3.95,0)` BLACK `#2b2b2e` with lid disc `#3a3a3e`; gravity hose `Cylinder(0.03,...)` curving down (3 segments) `#2e4a3a`; ladder up one leg. Charm: THE phone-reception spot — idle youth climbs, sits on tank edge, phone-glow vert at night; drip FX under the tap.
20. **Generator (~55 tris)** — skid base `Box(1.3,0.1,0.7) #5a5348`; engine block `Box(0.9,0.65,0.55) #b8b432` (weathered yellow) with `#8a862a` grime verts; exhaust stub `Cylinder(0.04,0.04,0.3,5) #3a3a3e` rot z 0.4; fuel tank `Box(0.5,0.25,0.5) #8a4a32`; cable snaking away (4 thin boxes `#2a2620`). Charm: vibrates (position jitter 0.01) + smoke-puff FX while running; dead silent + still on Shabbat — the visual/audio anchor of the whole cycle.
21. **Synagogue (~115 tris)** — the nicest structure: caravan-proportioned `Box(4.5,2.5,3)` fresh white `#f2ede0`; gabled tin roof 2 planes `#9aa0a4`; 3 arched windows faked as `Box(0.5,0.9,0.05) #3e5c7a` with rounded-top vert tint; door with step; small Star-of-David: 2 overlapping triangle `Cone(0.18,0.02,3)` flat `#3e5c7a` on the gable. Charm: warmest night window glow `#ffd98a`; on Shabbat, 4–6 figures cluster at the door and sway (shokeling = slow rot z ±0.06).
22. **Campfire (~35 tris + FX)** — stone ring 8× `Icosahedron(0.12,0) #8c8474`; 3 log `Cylinder(0.06,0.07,0.7,5) #6e5a42` teepee'd; flame: 3 nested cones `Cone(0.18,0.5,6)` inner `#ffd98a`, mid `#ff8c3a`, outer `#c14b3a`, scale-flickering by sine noise; blackened kumkum kettle `Cylinder(0.1,0.12,0.16,7) #2a2620` on a flat stone. Charm: log benches ring it; at kumzitz, guitar-holding sitter (arm pose) + spark FX column.
23. **Zula (~90 tris)** — rug `Box(3,0.03,2.4) #8a3e4a` (worn red, pattern = 2 stripe vert bands `#c9b458`); 2 dead sofas `Box(1.6,0.65,0.75)` olive `#6e7258` and brown `#7a5c48` with seat-cushion boxes slightly askew, one cushion `#3e5c7a`; cable-spool table `Cylinder(0.45,0.45,0.5,9) #b08d5a`; lean pole + string of fairy lights (8 tiny icosa verts, 3 lit `#ffd98a` at night, 5 dead `#5a5348`); guitar prop `Box(0.28,0.06,0.75) #b08d5a` + neck leaning on sofa. Charm: cat sleeping on sofa back `Box(0.3,0.14,0.14) #3e3228`; spirit-regen aura shown as faint warm ring decal when active.
24. **Vineyard row (~50 tris per 6 m row)** — 3 posts `Box(0.06,1.4,0.06) #7a5c3a`; 2 wire lines (thin stretched boxes `#8c8474`); 4 vine stumps `Cylinder(0.05,0.08,0.4,5) #4a3e32` with foliage `Icosahedron(0.3,0) #6d854e` (summer: + grape verts `#4a3e5c`); drip line `Box(0.02,0.02,6) #2a2620` at base. Rows instanced. Charm: boar damage state = one vine tipped, dirt patch; harvest state swaps grape verts off + crate appears at row end.
25. **Olive tree (~55 tris, instanced)** — trunk `Cylinder(0.12,0.22,1.1,5) #6b4f2e` (ancient variant: 2 twisted cylinders braided, ×1.6, trunk `#5a4426`); canopy 2–3 `Icosahedron(0.5–0.75,0)` blobs `#7a8f57` / `#6d854e` offset asymmetrically. Charm: harvest state drapes a tarp disc `CircleGeometry(1.2,8) #3e5c7a` under it; per-instance `setColorAt` silvers the canopy `#93a06a` when wind gusts (audio-synced).
26. **Storage shed (tzrif) (~85 tris)** — pallet walls: `Box(2.4,2,0.08)` × 3 + front with door gap, `#b08d5a` with slat lines; corrugated tin roof `Box(2.8,0.05,2.6) #9aa0a4` pitched 12°, weighted by 3 rock icosas + an old tire `Torus(0.3,0.1,5,8) #2a2620`; interior stacked sacks `Box(0.5,0.3,0.3) #c9b458`. Charm: roof rattles (0.01 jitter) in wind-gust audio moments.
27. **Workshop (~100 tris)** — open-front: 4 posts + tin roof; workbench `Box(1.8,0.1,0.7) @ h0.9 #9a8468`; tool silhouettes on back wall (5 thin dark boxes); anvil-ish vice block `#5a5348`; oil drum `Cylinder(0.3,0.3,0.9,9) #8a4a32`; sawdust ground decal `#c4b291`. Charm: grinder-spark FX burst + clang audio when a build order is active.
28. **Greenhouse (~70 tris)** — hoop frame: 4 half-`Torus(1.5,0.03,4,8, π)` ribs `#8c8474`; plastic skin: half-cylinder `Cylinder(1.5,1.5,4,10, half)` milky `#d8e0dc` opacity 0.45 (second allowed transparent material, shared with flashlight cone); interior: 2 planter rows `Box(0.4,0.2,3.6) #8a6d48` + green seedling verts. Charm: interior fogs (opacity 0.6) at dawn; silhouettes of plants visible through skin at night when lamp on.
29. **Flagpole (~25 tris)** — pole `Cylinder(0.03,0.05,5,6) #8c8474`, slightly bent at 4 m (two segments, 4° kink); flag `Box(1.2,0.8,0.01)`: white `#f4f4f0`, 2 stripe vert bands + Star verts `#2b4a9b` — **sun-faded**: lerp 20% toward pink-white `#e8d8d4`. Cloth anim: 3-segment z-wave by sine. Charm: rope slaps pole (tik-tik audio) in wind; flag droops fully on still dawn, snaps straight in gusts.
30. **Gate (~45 tris)** — 2 welded-pipe posts `Cylinder(0.06,0.06,1.4,6) #6e6a62`; swing bar `Cylinder(0.05,0.05,3.2,6) #8a4a32` with diagonal brace; chain loop verts `#5a5348`; whitewashed stone row flanking (5 icosas `#e8e4d8`). Charm: hand-painted plywood sign `Box(0.9,0.5,0.03) #e8e4d8` — DOM label renders the hill's name + "ברוכים הבאים"; gate creak audio on open.

### 3.D Hostile props

31. **Masked raider (~90 tris)** — BASE HUMAN, all muted: dark hoodie `#3a3a3e` (hood = head box painted same, NO kippah/peyot/tzitzit — absence of the friendly silhouette IS the enemy read), balaclava face: skin verts replaced `#2a2620` with a single pale eye-strip vert band `#c8c0b0`; pants `#4a463e`. No face, no insignia, nothing ethnic — pure faceless prowler. Charm: skulks bent 12° forward; when routed, sprints upright with arms pumping ×1.5 anim speed toward map edge (comedy of cowardice).
32. **Bulldozer, D9-style (~120 tris)** — arrives only for demolition-order events, parks at the road, never plows a player structure (pressure prop). Hull `Box(2.6,1.4,3.8) @ (0,1.5,0)` industrial yellow `#c9a227`, grime verts `#8a7218`; cab `Box(1.4,1.1,1.4)` with dark glass faces `#2e3a44`; blade `Box(3.2,1.1,0.25)` front, `#b0921f` with scraped-steel bottom edge verts `#b3aa97`; tracks: 2 `Box(0.6,0.9,3.9) #3a3a3e` with 6 wheel-hint circle verts; exhaust stack + beacon `Icosahedron(0.08,0) #e8a33d` (blinks). Charm: idles with low chug audio + faint exhaust puff FX — menace by presence, not action.
33. **Pickup truck (thieves' / farm variant) (~110 tris)** — cab `Box(1.7,1.3,1.5)` + hood `Box(1.7,0.55,0.9)` + bed `Box(1.7,0.55,1.9)` open; wheels 4× `Cylinder(0.36,0.36,0.24,8) #2a2620` hub verts `#8c8474`. **Thief variant**: dirty white `#c8c4b8`, headlights OFF, livestock cage frame on bed (6 thin boxes `#5a5348`). **Farm variant** (friendly fixture): battered white `#d8d4c8`, rust wheel-arch verts, stuck-in-mud winter pose (rear wheels sunk in `mudWinter` decal). Charm: thief truck reverses away comically fast when routed, cage rattling.

### 3.E Misc props

34. **Jerrycan (~20 tris)** — `Box(0.34,0.46,0.18)` yellow `#d9a441` or blue `#2e5f8a`; spout stub `Cylinder(0.04,...)`; handle: 3 thin boxes forming the triple-grip bridge (the recognizable silhouette). Instanced everywhere: spring, doorways, donkey flanks. Charm: carried units tilt 6° toward the heavy side.
35. **Hay bale (~15 tris)** — `Box(0.9,0.45,0.45) #c9b458`, twine: 2 dark stripe vert rings `#9a8468`, straw-jitter ×2. Stackable 3 high. Charm: goats climb it; almond-blossom petals FX collect on top in Shvat (late-winter beauty beat, pairs with almond tree at the synagogue: olive-tree recipe recolored `#e8d0d8` blossoms / `#f2e4e8` highlights).
36. **Rock / boulder (~20–60 tris, instanced)** — `Icosahedron(r,0 or 1)`, verts displaced ×rand(0.7,1.3), `toNonIndexed`; top faces `rockLimestoneLit`, sides `rockLimestone`, bottom faces `rockShadowFace`. 3 sizes: r 0.3 / 0.8 / 1.6. Terrace-wall segment = 5 small rocks merged in a 1.5×0.5 row, instanced along terrace risers. Charm: hyrax pile cluster has 2 hyrax lumps `Box(0.22,0.14,0.14) #8a7a5e` that duck (scale y 0.1) when units approach.
37. **Stump (~25 tris)** — `Cylinder(0.2,0.26,0.3,7) #9a8468`, top face rings: 2 concentric vert circles `#b08d5a`/`#7a5c3a`; 1–2 root flares (small boxes). Left behind by chopped trees; doubles as campfire seating. Charm: an axe `Box` handle + wedge head embedded in one stump near the workshop.

Bonus fixtures (already specced inline above, listed for the asset checklist): spring pool,
olive-press stone, sabra cactus (`3× flat Icosahedron(0.25,0)` paddles stacked on tiny trunk,
`#5c7a4a` with fruit verts `#c14b3a` in summer, ~30 tris), hitchhiking post (pole + tin sign +
waiting-youth idle pose), road, terrace wall segment, almond tree, fig tree (olive recipe,
broader canopy `#5c8046`, trunk `#8a7a5e`).

---

## 4. FX LIST (Points pools + mesh tricks, budgets per threejs-tech §11)

| FX | Technique | Spec |
|---|---|---|
| Dust puff | Points pool (64) | 6–10 pts per puff, `#c4b291`, size 0.5→1.2, rise 0.4 m, life 0.7 s. Triggers: footsteps on `dirtPath`, boar rooting, building placement thump, routed-enemy sprint trail (the "juice" of scaring things off) |
| Smoke | Points pool (128), soft radial CanvasTexture | `#bbb6ad` → fades; campfire column drift with wind vector; generator: smaller `#8a8378` puffs at 2 Hz |
| Fire | NOT particles — 3 nested flicker cones (§3.22) + spark Points (32): `#ffd98a` additive, up-and-die 0.5 s, kumzitz doubles the rate |
| Fireflies | Points (48), `#d9e8a0` additive, size 0.15 | wander in 2 m sphere over the wadi + zula, summer nights only, sine-pulse opacity |
| Rain | Points (400), streak look via size 0.08 elongated texture, `#aebcc8` | falls in camera-local box (12 m) so the pool stays tiny; + circular ripple decals on `springWater`; winter storms only |
| Stars | ONE Points (600) on the sky sphere, sizes 0.5–1.5, white/`#cfd8e6` mix | fade in dayT 0.83→0.9; 3 brightest twinkle by opacity sine |
| Selection ring | InstancedMesh of flat `RingGeometry(0.45,0.55,24)` laid on terrain | friendly `#59c26a`, hostile `#d9534f`, building footprint uses a square ring; subtle 4 s rotation |
| Build-radius rings | Same ring instancing, r = effect radius, `#e8a33d` opacity 0.25 | shown during ghost placement (campfire morale r, generator light/noise r, tower guard r) |
| Health/courage pips | DOM overlay divs projected per unit (threejs-tech §15.5) | 4 pips: green `#7fa055` → amber `#e8a33d` → red `#d9534f`; hostiles show a COURAGE pip bar in `#c9b8e8` that drains as they're scared — the core combat readout |
| Muster glow | Ground ring decal `#d9a441` opacity pulsing 0.15–0.3 around synagogue/zula during spirit events | |
| Sharav haze | No new FX object: push fog.near to 30, tint fog `#d8c8a8`, drop sun to `#ffe2b0` | heat-wave days |

Hard budget: ≤ 5 live Points systems, ≤ 1000 total live points (rain counts 400 — disable
fireflies/dust decoration while raining; they're never simultaneous anyway).

---

## 5. DAY/NIGHT VISUAL TIMELINE (one game day, dayT 0→1)

| dayT | Beat | Visual state |
|---|---|---|
| 0.00 | Deep night | Moon light `#8fa3c8` 0.18, no shadows. Stars full. Campfire + flashlight are the only warmth. Jackal eyes = paired amber verts on ridge silhouettes. Fog `#0c1220` near 40 |
| 0.20 | Pre-dawn | Sky bottom warms first. Gazelle silhouettes on the east ridge (ambience spawn). Guard's last round |
| 0.23 | **Dawn** | Sun `#ff9a5c` 1.2 rises east, shadows snap on — longest of the day. Valley mist: fog.near pulled to 25 for 90 s. Tefillin-prayer silhouettes face south by the synagogue. Birds SFX start |
| 0.30 | Morning | Flock streams out of the pen (white dots on gold slope — the game's postcard). Sun climbs to `#fff2dd` 2.6 |
| 0.35–0.60 | Work day | Noon `#fff7e8` 2.9, shortest shadows, terrain at its most golden-dry. Heat shimmer on sharav days (§4) |
| 0.60–0.75 | Afternoon → **Golden hour** | Sun `#ffb066` 1.4 low west; every model's west faces glow; long shadows rake the terraces. Second grazing round. This is the money light — schedule chapter-triumph screens here |
| 0.75–0.85 | Dusk | Sky through `#8e7fa8`→`#1c2742`. Sun shadow OFF at 0.83. Windows vert-swap to `#ffbf6e`, fairy lights on, generator lamp cone on + chug audio. Stars fade in |
| 0.85–1.00 | Night | Full dark. Generator OFF hour → silence → jackal chorus (the audio anchor). Campfire circle is the visual center of gravity. Guard flashlight sweeps. Threat telegraphs read as dust + eyes at the fog line |
| Day 6 eve | **Erev Shabbat** | Rosier golden hour (+10% red in sun lerp). White shirts swap on all settlers. Candle glow in every window at dusk. UI wash `#c9b8e8` fades in |
| Day 7 | **Shabbat** | No generator lamp/noise/smoke. No work anims — figures stroll, sit, sway at the synagogue. Softer fog, warmer hemi (+5% lightness). Spirit meter visibly refilling |
| Day 7 end | **Motzaei Shabbat** | Havdalah candle point-flame at the synagogue door → kumzitz: double-size fire, spark column, everyone ringed, guitar audio — the week's emotional crescendo |

---

## 6. RULES OF THUMB (enforcement)

1. Nothing is clean: every painted surface gets jitter; every white is off-white; every metal
   has a rust or grime vert band. If a model looks factory-new, it's wrong.
2. Nothing is orthogonal: structures get ±3° random yaw on placement; poles are slightly bent;
   layouts scatter, never grid.
3. Two transparent materials TOTAL in the world (greenhouse skin + light cones); everything
   else opaque via the one shared Lambert.
4. The friendly-silhouette contract: kippah + swinging tzitzit + sandals = ours; hooded,
   featureless, dark = hostile. Readable at 90 m iso distance without health bars.
5. Warmth lives in emissive vert swaps (`#ffbf6e`/`#ffd98a`) and the fire point light — never
   add lights to say "cozy," swap vertex colors instead.
6. Per-face painting after `toNonIndexed()` is the whole shading model: lit top faces, shadow
   undersides, sun-bleached roofs. Budget the time to do it on every rock and roof.
7. Tri budget honesty: nothing above ~120 tris (bulldozer is the ceiling); a sheep is 60;
   if a model wants more, cut a detail and add a vertex-color accent instead.
