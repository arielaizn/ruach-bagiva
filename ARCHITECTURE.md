# Hilltop RTS — Architecture & Module Contracts

A 3D browser RTS built with vanilla Three.js r160 (ES modules, no build step).
All code/docs English. All game-facing text Hebrew, referenced ONLY via `src/i18n/he.js` keys.

## Runtime layout

```
index.html            entry, importmap ("three" -> ./vendor/three.module.js), loading screen, DOM overlay roots
css/style.css         all UI styling (RTL)
src/main.js           boot: create renderer/scene, wire modules, menu -> level start
src/core/util.js      seeded RNG, value-noise FBM, math helpers, clamp/lerp, events bus
src/core/state.js     G: the single game-state object + actions API + pub/sub
src/core/loop.js      fixed-ish game loop, speed control, pause
src/engine/camera.js  CameraRig (iso<->close blend, pan/rotate/zoom, screenToGround)
src/engine/input.js   pointer + keyboard, drag-select, order dispatch
src/engine/terrain.js Terrain generator (heightmap, terraces, colors, decorations, grid)
src/engine/path.js    A* on grid + LOS smoothing
src/engine/environment.js  sky, sun/moon, stars, fog, day/night lerp
src/engine/fx.js      particles: dust, smoke, fire, rain, fireflies, selection rings
src/game/models.js    procedural low-poly model factory
src/game/balance.js   ALL numeric tuning as one exported BALANCE object
src/game/buildings.js Building classes, placement ghost, construction
src/game/units.js     Unit classes + brains (workers, guards, animals, hostiles)
src/game/combat.js    targeting, damage, flee logic
src/game/economy.js   jobs, gathering, production ticks, housing/pop
src/game/events.js    scripted + dynamic events (raids, weather, Shabbat, demolition)
src/game/levels.js    LEVELS data + objectives engine + free-play scaling
src/ui/hud.js         in-game HUD (RTL DOM)
src/ui/menus.js       main menu / chapter select / pause / win / lose / settings
src/ui/minimap.js     canvas minimap
src/i18n/he.js        export const T = { KEY: 'Hebrew', ... }  — every game string
src/audio.js          procedural WebAudio engine
src/save.js           localStorage progress + settings
```

## Core conventions

- World: y-up, ground on x/z. 1 unit = 1 m. Level maps are `S = 160` m square, centered at origin.
- Grid: cell = 2 m -> 80x80 cells. `cell(cx,cz)` maps to world `x = (cx+0.5)*2 - 80`.
- Sim: `update(dt)` with dt in seconds (clamped <= 0.05) * speed (0 | 1 | 2 | 3).
- Game day = `BALANCE.time.dayLength` seconds. `G.time.hour` in [0,24), day starts 06:00.
  Night = hour >= 19 or < 5. Day index `G.time.day` (1-based). Shabbat when `day % 7 === 0`.
- Every entity: `{ id, kind, pos:THREE.Vector3, mesh:THREE.Group, hp, alive, update(dt) }`.
- Money = shekels. Resources object: `{ wood, stone, food, water, shekels, spirit }`.
  spirit is 0..100 meter, not a stockpile.

## G (state) — the hub

```js
G = {
  scene, camera /*rig*/, renderer, terrain, level /*current level def*/,
  res: {wood, stone, food, water, shekels, spirit},
  caps: {...storage caps...}, pop: {cur, max},
  units: [], buildings: [], hostiles: [], flock: [],
  selection: [], time: {t, hour, day, isNight, isShabbat, speed},
  flags: {}, objectives: [...runtime objective states...],
  events: EventBus,  // on(name, fn), emit(name, payload)
  actions: { build(typeId, cx, cz), recruit(typeId), orderMove(units, pos),
             orderWork(units, target), setRally(b, pos), sell(res, n), buy(res, n),
             dismantle(b), musterSupporters(), toggleCameraMode(), ... }
}
```

Bus events UI/audio listen to: `res-changed, pop-changed, selection-changed, alert
(payload {type, textKey, pos?}), raid-warning, raid-start, raid-end, shabbat-start,
shabbat-end, demolition-served, demolition-resolved, objective-progress, objective-done,
level-won, level-lost, day-start, night-start, build-placed, build-done, unit-died,
kumzitz-start, weather(type)`.

## Module contracts (for parallel implementation)

### models.js
`export function createModel(type, opts = {})` -> `THREE.Group`, origin at ground
center, +Z facing. Flat-shaded `MeshLambertMaterial` with `vertexColors` OR plain
`color` per part; castShadow on parts. `group.userData.anim` may expose named parts:
`{legs:[..4], head, arms:[..2], tail, rotor, door, flag}` for procedural animation
by unit/building code. Types (exact ids) are listed in docs/design/art.md.
Must be pure (no state), deterministic given `opts.seed`.

### audio.js
```js
export const AudioSys = {
  init(),                 // lazy AudioContext on first user gesture
  play(name, opts={vol,pitch,delay}),   // one-shots per docs/design/audio.md
  ambience(state),        // 'day' | 'night' | 'shabbat' | 'danger'
  music(on), setVolume(master, sfx, music), duckFor(seconds)
}
```
No samples. Everything synthesized. Must not throw before init.

### fx.js
```js
export const FX = {
  init(scene), update(dt, camera),
  burst(type, pos, opts),      // 'dust'|'buildDust'|'woodChips'|'sparkle'|'scare'|'hit'
  attach(type, obj3d),         // 'fire'|'smoke'|'fireflies' persistent emitter, returns handle
  detach(handle),
  weather(type),               // null|'rain'|'storm'
  ring(entity)/unring(entity)  // selection rings
}
```

### i18n/he.js
`export const T = {...}` flat map, keys per docs/design/narrative.md. Also
`export function t(key, vars)` with `{x}` interpolation. Missing key -> returns key.

### levels.js
`export const LEVELS = [...]` pure data per docs/design/levels.md format;
`export const FREEPLAY = {...}`. No logic beyond formula helpers
`waveBudget(ch, day, strength)`.

### balance.js
`export const BALANCE = {...}` — single source of numeric truth, per docs/design/balance.md.

## Boot flow

main.js: renderer + scene -> menus.show('main') -> on chapter pick:
terrain.generate(level.terrain) -> place starting kit -> loop.start -> hud.show.
Win/lose -> menus.show('win'|'lose') -> save progress.

## Non-negotiables

- No external network requests except Google Fonts CSS in index.html.
- Never hardcode Hebrew text outside i18n/he.js.
- 60 fps target on mid laptop: instanced vegetation, one shadow-casting light,
  <= ~150 draw calls in play.
- No gore. Hostile humans are faceless, flee at low HP, despawn at map edge.
