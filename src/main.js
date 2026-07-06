// רוח בגבעה — boot & main wiring.
import * as THREE from 'three';
import { G } from './core/state.js';
import { Loop } from './core/loop.js';
import { CameraRig } from './engine/camera.js';
import { Terrain } from './engine/terrain.js';
import { Environment } from './engine/environment.js';
import { Input } from './engine/input.js';
import { FX } from './engine/fx.js';
import { AudioSys } from './audio.js';
import { initPlacementActions, updateBuildings } from './game/buildings.js';
import { updateUnits } from './game/units.js';
import { updateHostiles } from './game/hostiles.js';
import { updateEconomy, initSystemsEvents, initGameActions } from './game/systems.js';
import { LevelRunner } from './game/levels.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Minimap } from './ui/minimap.js';
import { Save } from './save.js';
import { t } from './i18n/he.js';

const setLoad = (pct, tip) => {
  const f = document.getElementById('loadfill');
  if (f) f.style.width = pct + '%';
  if (tip) document.getElementById('loadtip').textContent = tip;
};

setLoad(20);

// ---------- renderer / scene ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const rig = new CameraRig(window.innerWidth / window.innerHeight);
const env = new Environment(scene);
const terrain = new Terrain(scene);

G.scene = scene; G.rig = rig; G.renderer = renderer; G.terrain = terrain; G.env = env;

setLoad(40);

// ambient backdrop for the menu
terrain.generate({ seed: 10101, plateauRadius: 26, roughness: 0.75, treeDensity: 0.9, springAngle: 2.0, roadAngle: -0.7, hillHeight: 12 });
rig.setTerrain(terrain);
rig.jumpTo(0, 6);
rig.dist = 70;
G.time.hour = 8.2;

FX.init(scene);
initPlacementActions();
initGameActions();
initSystemsEvents();
Save.load();

setLoad(60);

const input = new Input(renderer.domElement, rig, G);
input.edgePanEnabled = Save.data.settings.edgePan;
G.input = input;

const hud = new Hud(document.getElementById('hud'));
G.hud = hud;
const minimap = new Minimap(hud.minimapCanvas);
const runner = new LevelRunner();
G.runner = runner;

const menus = new Menus(document.getElementById('menus'), {
  onStartLevel: (level, opts) => {
    menus._lastOpts = opts;
    AudioSys.init();
    AudioSys.setVolume(Save.data.settings.master, Save.data.settings.sfx, Save.data.settings.music);
    AudioSys.music(true);
    runner.load(level, opts);
    hud.show();
    G.ui.modalOpen = false;
    G.actions.setSpeed(1);
  },
  onQuitToMenu: () => {
    G.running = false;
    G.level = null;
    hud.hide();
    menus.showMain();
  },
});
G.menus = menus;

setLoad(85);

// ---------- loop ----------
const loop = new Loop(renderer, scene, rig);

loop.addSystem((dt) => {
  updateUnits(dt);
  updateHostiles(dt);
  updateBuildings(dt);
  updateEconomy(dt);
  G.director?.update(dt);
  runner.update(dt);
});

loop.addAlways((dt, raw) => {
  input.update(raw);
  // menu idle orbit
  if (!G.running && !G.level) rig.yaw += raw * 0.04;
  env.update(G.time.hour, rig.target.x, rig.target.z);
  // FX clamps dt internally at 0.05 — sub-step so fast-forward stays in sync
  let fxDt = raw * (G.time.paused ? 1 : G.time.speed || 1);
  while (fxDt > 0) { FX.update(Math.min(fxDt, 0.05), rig.camera); fxDt -= 0.05; }
  if (G.level) { hud.update(); minimap.update(); }
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.resize(window.innerWidth / window.innerHeight);
});

// audio unlock on first gesture
window.addEventListener('pointerdown', () => AudioSys.init(), { once: true });

loop.start();
menus.showMain();
setLoad(100);
setTimeout(() => document.getElementById('loading').classList.add('done'), 300);

console.log('[boot] רוח בגבעה ready');
window.__G = G;
import('./game/models.js').then(m => { window.__models = m; });
