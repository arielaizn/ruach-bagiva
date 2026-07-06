// G — the single game-state hub. Game modules attach their systems and extra
// actions onto G at boot; UI and audio subscribe via G.events.
import { EventBus, clamp } from './util.js';

export const G = {
  // wired at boot
  scene: null, rig: null, renderer: null, terrain: null, input: null,
  env: null, fx: null, hud: null, minimap: null,

  level: null,           // current level definition
  levelIndex: -1,        // -1 = free play
  running: false,

  res: { wood: 0, stone: 0, food: 0, water: 0, shekels: 0 },
  caps: { wood: 200, stone: 200, food: 150, water: 100, shekels: 99999 },
  spirit: 55,            // 0..100 morale/faith meter
  pop: { cur: 0, max: 0 },

  units: [], buildings: [], hostiles: [], flock: [],
  selection: [],
  basePos: null,         // main camp position (first building / campfire)

  time: { t: 0, hour: 8, day: 1, speed: 1, paused: false, isNight: false, isShabbat: false, dayLength: 170 },

  flags: {},             // level-scripting scratch
  stats: { raidsRepelled: 0, hostilesDriven: 0, unitsLost: 0, buildingsBuilt: 0, sheepBorn: 0, shekelsEarned: 0 },

  events: new EventBus(),
  ui: { modalOpen: false },
  placement: null,       // {typeId, cx, cz, valid, ghost}

  actions: {},           // populated below + by game modules
  hooks: {},             // module-registered callbacks
};

// ---------- resources ----------
export function addRes(kind, amount) {
  if (kind === 'spirit') { setSpirit(G.spirit + amount); return amount; }
  const before = G.res[kind];
  G.res[kind] = clamp(before + amount, 0, G.caps[kind] ?? 99999);
  const gained = G.res[kind] - before;
  if (amount > 0 && kind === 'shekels') G.stats.shekelsEarned += gained;
  G.events.emit('res-changed', { kind });
  return gained;
}

export function canAfford(cost) {
  for (const k in cost) {
    if (k === 'spirit') { if (G.spirit < cost[k]) return false; }
    else if ((G.res[k] ?? 0) < cost[k]) return false;
  }
  return true;
}

export function spend(cost) {
  if (!canAfford(cost)) return false;
  for (const k in cost) {
    if (k === 'spirit') setSpirit(G.spirit - cost[k]);
    else G.res[k] -= cost[k];
  }
  G.events.emit('res-changed', {});
  return true;
}

export function setSpirit(v) {
  const before = G.spirit;
  G.spirit = clamp(v, 0, 100);
  if (Math.floor(before) !== Math.floor(G.spirit)) G.events.emit('res-changed', { kind: 'spirit' });
}

// work-speed multiplier from spirit
export function spiritMul() {
  if (G.spirit >= 75) return 1.18;
  if (G.spirit <= 25) return 0.75;
  return 1;
}

// ---------- time ----------
export function tickTime(dt) {
  const t = G.time;
  t.t += dt;
  const hoursPerSec = 24 / t.dayLength;
  const prevHour = t.hour;
  t.hour += dt * hoursPerSec;
  if (t.hour >= 24) {
    t.hour -= 24;
    t.day += 1;
    t.isShabbat = t.day % 7 === 0;
    G.events.emit('day-start', { day: t.day });
    if (t.isShabbat) G.events.emit('shabbat-start', {});
    else if ((t.day - 1) % 7 === 0 && t.day > 1) G.events.emit('shabbat-end', {});
  }
  const nightNow = t.hour >= 19 || t.hour < 5;
  if (nightNow && !t.isNight) { t.isNight = true; G.events.emit('night-start', {}); }
  if (!nightNow && t.isNight) { t.isNight = false; G.events.emit('night-end', {}); }
  // fire hour-crossing events for schedulers
  if (Math.floor(prevHour) !== Math.floor(t.hour)) G.events.emit('hour', { hour: Math.floor(t.hour) });
}

// during Shabbat civilians rest (no gathering/building); guards still guard
export function workAllowed() { return !G.time.isShabbat; }

// ---------- base actions ----------
G.actions.select = (list) => {
  const prev = new Set(G.selection);
  G.selection = list.filter(e => e.alive);
  for (const e of prev) if (!G.selection.includes(e)) e.setSelected?.(false);
  for (const e of G.selection) e.setSelected?.(true);
  G.events.emit('selection-changed', G.selection);
};

G.actions.setSpeed = (s) => {
  G.time.speed = s;
  G.time.paused = s === 0;
  G.events.emit('speed-changed', s);
};

G.actions.togglePause = () => {
  G.time.paused = !G.time.paused;
  G.events.emit('speed-changed', G.time.paused ? 0 : G.time.speed);
};

G.actions.toggleCameraMode = () => {
  const mode = G.rig.toggleMode();
  G.events.emit('camera-mode', mode);
};

G.actions.escape = () => {
  if (G.placement) { G.actions.cancelPlacement?.(); return; }
  if (G.ui.modalOpen) { G.events.emit('close-modal', {}); return; }
  if (G.selection.length) { G.actions.select([]); return; }
  G.events.emit('open-pause', {});
};

export function resetState() {
  G.res = { wood: 0, stone: 0, food: 0, water: 0, shekels: 0 };
  G.caps = { wood: 200, stone: 200, food: 150, water: 100, shekels: 99999 };
  G.spirit = 55;
  G.pop = { cur: 0, max: 0 };
  G.units = []; G.buildings = []; G.hostiles = []; G.flock = [];
  G.selection = [];
  G.time = { t: 0, hour: 8, day: 1, speed: 1, paused: false, isNight: false, isShabbat: false, dayLength: G.time.dayLength };
  G.flags = {};
  G.stats = { raidsRepelled: 0, hostilesDriven: 0, unitsLost: 0, buildingsBuilt: 0, sheepBorn: 0, shekelsEarned: 0 };
  G.placement = null;
  G.basePos = null;
  G.running = false;
}
