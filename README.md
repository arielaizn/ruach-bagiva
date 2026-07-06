# רוח בגבעה — Ruach BaGiva (Hilltop RTS)

A real-time strategy / settlement-management game about hilltop youth building,
defending and managing a small pastoral outpost in the Samaria hills.
**Fully in Hebrew (RTL).** Built with vanilla Three.js — no build step, no external assets.

**Play:** open `index.html` via any static server (`python3 -m http.server`) or the deployed GitHub Pages URL.

## The game

- **Genre:** RTS / settlement builder with defensive, non-lethal combat (hostiles have a
  *courage* meter and rout — nothing dies on screen).
- **Campaign:** 7 chapters (עולים לגבעה → בציר ראשון), each teaching one system:
  founding, shepherding, water logistics, the demolition-order drama, drought & trade,
  the big night raid, and permanence. Plus **free play** with endless escalation.
- **Signature systems:** Shabbat weekly rhythm (work halts, spirit soars), kumzitz spirit
  economy, named flock, guard dogs with auto-intercept, sling-wielding shepherds, spring
  water runs with a donkey, hitchhike-junction trade, demolition orders resolved by
  self-dismantling or mustering a supporter bus, day/night raids telegraphed by shofar.
- **Camera:** isometric-style default that blends smoothly into a low cinematic view
  (`C` to toggle, wheel to zoom through it).

## Controls

| Input | Action |
|---|---|
| Left click / drag | Select / box-select |
| Right click | Smart order (move / chop / draw water / build / chase off) |
| WASD / arrows / screen edge | Pan camera |
| Q / E, middle-drag | Rotate |
| Wheel | Zoom (blends to close view) |
| C | Toggle camera mode |
| G | Emergency bell (flock to pen, everyone arms) |
| Space | Pause · +/- game speed |
| Ctrl+1-9 / 1-9 | Control groups |
| F | Focus selection |

## Tech

- Vanilla Three.js r160 (vendored), ES modules, zero dependencies at runtime.
- 100% procedural: terrain (seeded heightmap with agricultural terraces), ~45 low-poly
  vertex-colored models, WebAudio-synthesized SFX/ambience/music (Freygish generative pad),
  particle FX. No asset files, no network calls (Google Fonts only).
- A* pathfinding on a 2 m grid, courage-based rout combat, data-driven levels
  (`src/game/levels.js`), event director (waves, weather, demolition drama, hitchhikers).
- Save: campaign progress + settings in localStorage.

## Development

Docs in `docs/` (research + full design bible: GDD, levels, art, UI, audio, balance,
narrative). Architecture contracts in `ARCHITECTURE.md`. QA harness in `tools/`
(playwright-core scripted playtests: `node tools/play.mjs`).

Built end-to-end by Claude (Fable 5) with a multi-agent workflow: 11 research/design
agents → engine + sim → 5 content-module agents → 15 QA agents (per-chapter scripted
playthroughs, code review, Hebrew proofing, perf profiling).
