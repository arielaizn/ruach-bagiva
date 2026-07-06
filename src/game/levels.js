// Campaign data (7 chapters) + free play + the LevelRunner that executes
// timelines, tracks objectives and win/lose. Levels are pure data.
import { G, resetState, addRes, setSpirit } from '../core/state.js';
import { BALANCE } from './balance.js';
import { Building, recomputeCaps } from './buildings.js';
import { Settler, Sheep, Dog, Donkey } from './units.js';
import { EventDirector } from './events.js';
import { GRID_N } from '../engine/terrain.js';
import { AudioSys } from '../audio.js';
import { FX } from '../engine/fx.js';

// -------------------------------------------------- data
export const LEVELS = [
  {
    id: 'ch1', nameKey: 'ch1_name', introKey: 'ch1_intro', winKey: 'ch1_win',
    terrain: { seed: 10101, plateauRadius: 26, roughness: 0.75, treeDensity: 0.9, springAngle: 2.0, roadAngle: -0.7, hillHeight: 12 },
    unlocks: ['tent', 'veg_patch', 'campfire'],
    kit: {
      res: { wood: 40, stone: 10, food: 25, water: 20, shekels: 30 }, spirit: 60,
      settlers: [{ name: 'שיבי', trait: 'diligent' }, { name: 'נריה', trait: 'musical' }],
      donkey: true,
    },
    objectives: [
      { id: 'tent', type: 'build', building: 'tent', count: 1, textKey: 'obj_tent' },
      { id: 'water', type: 'res', res: 'water', amount: 30, textKey: 'obj_water30' },
      { id: 'food', type: 'res', res: 'food', amount: 40, textKey: 'obj_food40' },
      { id: 'fire', type: 'build', building: 'campfire', count: 1, textKey: 'obj_campfire' },
      { id: 'kum', type: 'kumzitz', count: 1, textKey: 'obj_kumzitz' },
      { id: 'shabbat', type: 'day', day: 7, textKey: 'obj_shabbat1' },
    ],
    timeline: [
      { day: 1, hour: 8.2, toast: { textKey: 'tut_welcome', type: 'info', sticky: true } },
      { day: 1, hour: 8.6, toast: { textKey: 'tut_select', type: 'info', sticky: true } },
      { day: 1, hour: 10, toast: { textKey: 'tut_build_tent', type: 'info', sticky: true } },
      { day: 1, hour: 14, toast: { textKey: 'tut_camera', type: 'info' } },
      { day: 2, hour: 7, toast: { textKey: 'tut_water', type: 'info', sticky: true } },
      { day: 2, hour: 12, toast: { textKey: 'tut_wood', type: 'info' } },
      { day: 3, hour: 7, toast: { textKey: 'tut_farm', type: 'info' } },
      { day: 3, hour: 16.5, wave: { budget: 2, palette: ['jackal'], dirs: ['E'], telegraphS: 18 } },
      { day: 3, hour: 16.5, toast: { textKey: 'tut_jackals', type: 'warn' } },
      { day: 5, hour: 18, toast: { textKey: 'tut_kumzitz', type: 'info', sticky: true } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday', type: 'info' } },
    ],
  },
  {
    id: 'ch2', nameKey: 'ch2_name', introKey: 'ch2_intro', winKey: 'ch2_win',
    terrain: { seed: 10101, plateauRadius: 26, roughness: 0.75, treeDensity: 0.9, springAngle: 2.0, roadAngle: -0.7, hillHeight: 12 },
    unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula'],
    kit: {
      res: { wood: 60, stone: 20, food: 45, water: 25, shekels: 40 }, spirit: 55,
      settlers: [{ name: 'שיבי', trait: 'diligent' }, { name: 'נריה', trait: 'musical', job: 'shepherd' }, { name: 'עמיחי' }],
      donkey: true, dogs: ['לביא'],
      buildings: [{ type: 'tent', dx: -3, dz: 2 }, { type: 'campfire', dx: 0, dz: 4 }, { type: 'veg_patch', dx: 4, dz: 2 }],
    },
    objectives: [
      { id: 'pen', type: 'build', building: 'sheep_pen', count: 1, textKey: 'obj_pen' },
      { id: 'kennel', type: 'build', building: 'kennel', count: 1, textKey: 'obj_kennel' },
      { id: 'dog2', type: 'dogs', count: 2, textKey: 'obj_dog2' },
      { id: 'waves', type: 'waves', count: 2, textKey: 'obj_waves2' },
      { id: 'flock', type: 'flockEnd', count: 6, textKey: 'obj_flock6' },
    ],
    failFlockMin: 4,
    timeline: [
      { day: 1, hour: 9, flockDelivery: 8, toast: { textKey: 'ev_flock_arrived', type: 'good' } },
      { day: 1, hour: 9.5, toast: { textKey: 'tut_shepherd', type: 'info', sticky: true } },
      { day: 1, hour: 11, toast: { textKey: 'tut_pen', type: 'info', sticky: true } },
      { day: 2, hour: 16.5, wave: { budget: 3, palette: ['jackal'], dirs: ['NE'], telegraphS: 22 } },
      { day: 3, hour: 9, toast: { textKey: 'tut_bell', type: 'info', sticky: true } },
      { day: 4, hour: 20, toast: { textKey: 'ev_wolves_howl', type: 'warn' } },
      { day: 5, hour: 10, toast: { textKey: 'tut_kennel', type: 'info' } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday_flock', type: 'info' } },
      { day: 6, hour: 19.5, wave: { budget: 6, palette: ['wolf'], dirs: ['E'], telegraphS: 28 } },
    ],
  },
  {
    id: 'ch3', nameKey: 'ch3_name', introKey: 'ch3_intro', winKey: 'ch3_win',
    terrain: { seed: 10103, plateauRadius: 24, roughness: 1.05, treeDensity: 1.1, springAngle: 2.6, roadAngle: -0.7, hillHeight: 14 },
    unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula', 'water_tower', 'pergola', 'synagogue', 'caravan'],
    kit: {
      res: { wood: 70, stone: 30, food: 35, water: 30, shekels: 80 }, spirit: 55,
      settlers: [{ name: 'שיבי', trait: 'diligent' }, { name: 'נריה', job: 'shepherd' }, { name: 'עמיחי', job: 'guard' }, { name: 'תהילה', female: true, trait: 'diligent' }, { name: 'ידידיה', trait: 'sleepy' }],
      donkey: true, dogs: ['לביא'], sheep: 8,
      buildings: [{ type: 'caravan', dx: -4, dz: -2 }, { type: 'tent', dx: -6, dz: 3 }, { type: 'campfire', dx: 0, dz: 4 }, { type: 'veg_patch', dx: 4, dz: 2 }, { type: 'sheep_pen', dx: 5, dz: -4 }, { type: 'kennel', dx: 1, dz: -6 }],
    },
    objectives: [
      { id: 'tower', type: 'build', building: 'water_tower', count: 1, textKey: 'obj_watertower' },
      { id: 'water', type: 'res', res: 'water', amount: 120, textKey: 'obj_water120' },
      { id: 'waves', type: 'waves', count: 3, textKey: 'obj_waves3' },
      { id: 'flock', type: 'flockEnd', count: 6, textKey: 'obj_flock6' },
    ],
    failFlockMin: 4, failCore: true,
    timeline: [
      { day: 1, hour: 8.5, toast: { textKey: 'ch3_caravan_toast', type: 'good' } },
      { day: 1, hour: 10, toast: { textKey: 'tut_water_chain', type: 'info', sticky: true } },
      { day: 2, hour: 9, toast: { textKey: 'tut_donkey_water', type: 'info' } },
      { day: 3, hour: 16.5, wave: { budget: 7, palette: ['jackal', 'wolf'], dirs: ['NE'], telegraphS: 22 } },
      { day: 4, hour: 20.5, toast: { textKey: 'ev_thief_scout', type: 'warn' } },
      { day: 5, hour: 20, wave: { budget: 11, palette: ['thief', 'jackal'], dirs: ['S'], telegraphS: 28 } },
      { day: 5, hour: 19.8, toast: { textKey: 'tut_thieves', type: 'warn' } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday_water', type: 'info' } },
      { day: 8, hour: 19.5, wave: { budget: 14, palette: ['thief', 'wolf'], dirs: ['S', 'NE'], telegraphS: 28 } },
    ],
  },
  {
    id: 'ch4', nameKey: 'ch4_name', introKey: 'ch4_intro', winKey: 'ch4_win',
    terrain: { seed: 10103, plateauRadius: 24, roughness: 1.05, treeDensity: 1.1, springAngle: 2.6, roadAngle: -0.7, hillHeight: 14 },
    unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula', 'water_tower', 'pergola', 'synagogue', 'caravan', 'container'],
    kit: {
      res: { wood: 80, stone: 40, food: 40, water: 35, shekels: 80 }, spirit: 60,
      settlers: [{ name: 'שיבי', trait: 'diligent' }, { name: 'נריה', job: 'shepherd' }, { name: 'עמיחי', job: 'guard' }, { name: 'תהילה', female: true }, { name: 'ידידיה', trait: 'sleepy' }, { name: 'נחמן', trait: 'musical' }],
      donkey: true, dogs: ['לביא', 'סופה'], sheep: 10,
      buildings: [{ type: 'caravan', dx: -4, dz: -2 }, { type: 'tent', dx: -6, dz: 3 }, { type: 'tent', dx: -8, dz: 0 }, { type: 'campfire', dx: 0, dz: 4 }, { type: 'veg_patch', dx: 4, dz: 2 }, { type: 'sheep_pen', dx: 5, dz: -4 }, { type: 'kennel', dx: 1, dz: -6 }, { type: 'water_tower', dx: -1, dz: -8 }],
    },
    objectives: [
      { id: 'order', type: 'demolition', textKey: 'obj_demolition' },
      { id: 'spirit', type: 'spiritEnd', amount: 30, textKey: 'obj_spirit30' },
      { id: 'waves', type: 'waves', count: 2, textKey: 'obj_waves2' },
    ],
    failCore: true, failSpiritZero: true,
    timeline: [
      { day: 1, hour: 18, toast: { textKey: 'ev_jeep_rumor', type: 'warn' } },
      { day: 2, hour: 9, demolition: 'sheep_pen' },
      { day: 2, hour: 9.5, toast: { textKey: 'tut_demolition', type: 'info', sticky: true } },
      { day: 3, hour: 20, wave: { budget: 8, palette: ['thief'], dirs: ['S'], telegraphS: 28 } },
      { day: 4, hour: 11, toast: { textKey: 'ev_rav_visit', type: 'good' }, grant: { spirit: 10 } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday', type: 'info' } },
      { day: 8, hour: 12, wave: { budget: 11, palette: ['thief', 'jackal'], dirs: ['S', 'NE'], telegraphS: 28 } },
    ],
  },
  {
    id: 'ch5', nameKey: 'ch5_name', introKey: 'ch5_intro', winKey: 'ch5_win',
    terrain: { seed: 10105, plateauRadius: 25, roughness: 1.15, treeDensity: 0.5, springAngle: 2.6, roadAngle: -0.7, hillHeight: 13 },
    unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula', 'water_tower', 'pergola', 'synagogue', 'caravan', 'container', 'vineyard', 'watchtower', 'generator'],
    kit: {
      res: { wood: 90, stone: 50, food: 45, water: 40, shekels: 100 }, spirit: 60,
      settlers: [{ name: 'שיבי' }, { name: 'נריה', job: 'shepherd' }, { name: 'עמיחי', job: 'guard' }, { name: 'תהילה', female: true }, { name: 'ידידיה', trait: 'sleepy' }, { name: 'נחמן', trait: 'musical' }, { name: 'הודיה', female: true }],
      donkey: true, dogs: ['לביא', 'סופה'], sheep: 12,
      buildings: [{ type: 'caravan', dx: -4, dz: -2 }, { type: 'tent', dx: -6, dz: 3 }, { type: 'tent', dx: -8, dz: 0 }, { type: 'tent', dx: -3, dz: 6 }, { type: 'campfire', dx: 0, dz: 4 }, { type: 'veg_patch', dx: 4, dz: 2 }, { type: 'sheep_pen', dx: 5, dz: -4 }, { type: 'kennel', dx: 1, dz: -6 }, { type: 'water_tower', dx: -1, dz: -8 }, { type: 'zula', dx: -7, dz: 5 }],
    },
    objectives: [
      { id: 'junction', type: 'junction', count: 3, textKey: 'obj_junction3' },
      { id: 'tower', type: 'build', building: 'watchtower', count: 1, textKey: 'obj_watchtower' },
      { id: 'vineyard', type: 'build', building: 'vineyard', count: 1, textKey: 'obj_vineyard' },
      { id: 'waves', type: 'waves', count: 3, textKey: 'obj_waves3' },
    ],
    failFlockMin: 4, failCore: true,
    timeline: [
      { day: 1, hour: 9, toast: { textKey: 'tut_junction', type: 'info', sticky: true } },
      { day: 2, hour: 16.5, wave: { budget: 8, palette: ['boar'], dirs: ['S'], telegraphS: 22 } },
      { day: 2, hour: 16.4, toast: { textKey: 'tut_boars', type: 'warn' } },
      { day: 3, hour: 7, weather: 'sharav', toast: { textKey: 'ev_sharav', type: 'warn' } },
      { day: 4, hour: 19.5, wave: { budget: 14, palette: ['boar', 'wolf'], dirs: ['NE', 'S'], telegraphS: 28 } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday', type: 'info' } },
      { day: 8, hour: 20.5, wave: { budget: 12, palette: ['raider'], dirs: ['S'], telegraphS: 32 } },
      { day: 8, hour: 20.4, toast: { textKey: 'tut_raiders', type: 'warn' } },
      { day: 9, hour: 19.5, wave: { budget: 20, palette: ['raider', 'wolf'], dirs: ['S', 'W'], telegraphS: 32 } },
    ],
  },
  {
    id: 'ch6', nameKey: 'ch6_name', introKey: 'ch6_intro', winKey: 'ch6_win',
    terrain: { seed: 10105, plateauRadius: 25, roughness: 1.3, treeDensity: 0.5, springAngle: 2.6, roadAngle: -0.7, hillHeight: 13 },
    unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula', 'water_tower', 'pergola', 'synagogue', 'caravan', 'container', 'vineyard', 'watchtower', 'generator'],
    kit: {
      res: { wood: 100, stone: 60, food: 50, water: 50, shekels: 130 }, spirit: 65,
      settlers: [{ name: 'שיבי' }, { name: 'נריה', job: 'shepherd' }, { name: 'עמיחי', job: 'guard' }, { name: 'תהילה', female: true }, { name: 'ידידיה', trait: 'sleepy', job: 'guard' }, { name: 'נחמן', trait: 'musical' }, { name: 'הודיה', female: true }, { name: 'שילה' }, { name: 'אמונה', female: true }],
      donkey: true, dogs: ['לביא', 'סופה', 'במבה'], sheep: 16,
      buildings: [{ type: 'caravan', dx: -4, dz: -2 }, { type: 'caravan', dx: -7, dz: 2 }, { type: 'tent', dx: -3, dz: 6 }, { type: 'tent', dx: -10, dz: -1 }, { type: 'tent', dx: -5, dz: 8 }, { type: 'campfire', dx: 0, dz: 4 }, { type: 'veg_patch', dx: 4, dz: 2 }, { type: 'sheep_pen', dx: 5, dz: -4 }, { type: 'kennel', dx: 1, dz: -6 }, { type: 'water_tower', dx: -1, dz: -8 }, { type: 'zula', dx: -7, dz: 5 }, { type: 'container', dx: -8, dz: -5 }],
    },
    objectives: [
      { id: 'towers', type: 'build', building: 'watchtower', count: 2, textKey: 'obj_watchtower2' },
      { id: 'gen', type: 'build', building: 'generator', count: 1, textKey: 'obj_generator' },
      { id: 'bignight', type: 'waves', count: 3, textKey: 'obj_bignight' },
      { id: 'flock', type: 'flockEnd', count: 13, textKey: 'obj_flock13' },
    ],
    failFlockMin: 8, failCore: true,
    timeline: [
      { day: 1, hour: 8.5, toast: { textKey: 'ch6_council', type: 'info', sticky: true } },
      { day: 1, hour: 9, grant: { wood: 60, stone: 50, shekels: 40 }, toast: { textKey: 'ev_neighbors_help', type: 'good' } },
      { day: 2, hour: 20, wave: { budget: 14, palette: ['thief', 'wolf'], dirs: ['S'], telegraphS: 28 } },
      { day: 3, hour: 10, toast: { textKey: 'ev_rumor_bignight', type: 'warn' } },
      { day: 4, hour: 20, wave: { budget: 18, palette: ['raider', 'boar', 'jackal'], dirs: ['S', 'NE'], telegraphS: 32 } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday_bignight', type: 'info' } },
      { day: 7, hour: 12, toast: { textKey: 'ch6_calm', type: 'info' } },
      { day: 7, hour: 20.6, wave: { budget: 30, palette: ['raider', 'leader', 'thief', 'wolf'], dirs: ['S', 'NE', 'W'], telegraphS: 38 } },
      { day: 7, hour: 20.5, toast: { textKey: 'ch6_bignight', type: 'bad' } },
    ],
  },
  {
    id: 'ch7', nameKey: 'ch7_name', introKey: 'ch7_intro', winKey: 'ch7_win',
    terrain: { seed: 10107, plateauRadius: 28, roughness: 1.0, treeDensity: 1.3, springAngle: 2.6, roadAngle: -0.7, hillHeight: 13 },
    unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula', 'water_tower', 'pergola', 'synagogue', 'caravan', 'container', 'vineyard', 'watchtower', 'generator'],
    kit: {
      res: { wood: 120, stone: 80, food: 60, water: 60, shekels: 150 }, spirit: 70,
      settlers: [{ name: 'שיבי' }, { name: 'נריה', job: 'shepherd' }, { name: 'עמיחי', job: 'guard' }, { name: 'תהילה', female: true }, { name: 'ידידיה', job: 'guard' }, { name: 'נחמן', trait: 'musical' }, { name: 'הודיה', female: true }, { name: 'שילה' }, { name: 'אמונה', female: true }, { name: 'איתמר' }],
      donkey: true, dogs: ['לביא', 'סופה', 'במבה'], sheep: 20,
      buildings: [{ type: 'caravan', dx: -4, dz: -2 }, { type: 'caravan', dx: -7, dz: 2 }, { type: 'tent', dx: -3, dz: 6 }, { type: 'tent', dx: -10, dz: -1 }, { type: 'tent', dx: -5, dz: 8 }, { type: 'tent', dx: -12, dz: 3 }, { type: 'campfire', dx: 0, dz: 4 }, { type: 'veg_patch', dx: 4, dz: 2 }, { type: 'sheep_pen', dx: 5, dz: -4 }, { type: 'kennel', dx: 1, dz: -6 }, { type: 'water_tower', dx: -1, dz: -8 }, { type: 'zula', dx: -7, dz: 5 }, { type: 'container', dx: -8, dz: -5 }, { type: 'vineyard', dx: 8, dz: 3 }, { type: 'watchtower', dx: 7, dz: -8 }],
    },
    objectives: [
      { id: 'synagogue', type: 'build', building: 'synagogue', count: 1, textKey: 'obj_synagogue' },
      { id: 'harvest', type: 'res', res: 'food', amount: 150, textKey: 'obj_harvest' },
      { id: 'pop', type: 'pop', count: 12, textKey: 'obj_pop12' },
      { id: 'final', type: 'waves', count: 3, textKey: 'obj_finalwave' },
    ],
    failCore: true,
    timeline: [
      { day: 1, hour: 8.5, toast: { textKey: 'ch7_open', type: 'info', sticky: true } },
      { day: 2, hour: 9, toast: { textKey: 'ch7_batzir', type: 'info' } },
      { day: 3, hour: 20, wave: { budget: 16, palette: ['wolf', 'boar'], dirs: ['S', 'NE'], telegraphS: 32 } },
      { day: 4, hour: 11, toast: { textKey: 'ev_parents_visit', type: 'good' }, grant: { spirit: 10, food: 20 } },
      { day: 6, hour: 8, toast: { textKey: 'tut_friday', type: 'info' } },
      { day: 8, hour: 16, wave: { budget: 14, palette: ['boar'], dirs: ['S'], telegraphS: 22 } },
      { day: 10, hour: 10, toast: { textKey: 'ev_rumor_last', type: 'warn' } },
      { day: 11, hour: 20.6, wave: { budget: 36, palette: ['raider', 'leader', 'thief', 'wolf', 'boar', 'jackal'], dirs: ['S', 'NE', 'W'], telegraphS: 42 } },
      { day: 12, hour: 9, weather: 'yoreh', toast: { textKey: 'ev_yoreh', type: 'good' } },
    ],
  },
];

export const FREEPLAY = {
  id: 'free', nameKey: 'free_name', introKey: 'free_intro',
  unlocks: ['tent', 'veg_patch', 'campfire', 'sheep_pen', 'kennel', 'fence', 'zula', 'water_tower', 'pergola', 'synagogue', 'caravan', 'container', 'vineyard', 'watchtower', 'generator'],
  kit: {
    res: { wood: 70, stone: 30, food: 40, water: 30, shekels: 60 }, spirit: 60,
    settlers: [{ name: 'שיבי' }, { name: 'נריה', job: 'shepherd' }, {}, {}],
    donkey: true, dogs: ['לביא'], sheep: 6,
    buildings: [{ type: 'campfire', dx: 0, dz: 3 }, { type: 'tent', dx: -4, dz: 1 }, { type: 'tent', dx: 3, dz: -3 }],
  },
  objectives: [
    { id: 'pop15', type: 'pop', count: 15, textKey: 'obj_free_pop' },
    { id: 'syn', type: 'build', building: 'synagogue', count: 1, textKey: 'obj_synagogue' },
    { id: 'flock20', type: 'flock', count: 20, textKey: 'obj_free_flock' },
  ],
  timeline: [],
};

// -------------------------------------------------- runner
export class LevelRunner {
  constructor() {
    this.level = null;
    this.fired = new Set();
    this.objState = [];
    this.wavesSurvived = 0;
    this.junctionTrips = 0;
    this.kumzitzim = 0;
    this.won = false; this.lost = false;

    G.events.on('raid-end', () => { this.wavesSurvived++; this._objDirty = true; });
    G.events.on('junction-trip', () => { this.junctionTrips++; this._objDirty = true; });
    G.events.on('kumzitz-end', () => { this.kumzitzim++; this._objDirty = true; });
    G.events.on('core-destroyed', () => { if (this.level?.failCore) this.fail('lose_core'); });
    G.events.on('day-start', () => G.director?.onDayStart());
  }

  load(level, opts = {}) {
    // purge previous world meshes from the scene
    for (const arr of [G.units, G.flock, G.hostiles]) {
      for (const e of arr) { e.alive = false; if (e.mesh) G.scene.remove(e.mesh); FX.unring?.(e); }
    }
    for (const b of G.buildings) {
      b.alive = false;
      for (const hnd of b.fxHandles ?? []) FX.detach(hnd);
      if (b.mesh) G.scene.remove(b.mesh);
    }
    if (G.director) { for (const p of G.director.props) G.scene.remove(p.mesh); }
    if (G.flagpole) { G.scene.remove(G.flagpole); G.flagpole = null; }
    if (G.placement?.ghost) G.scene.remove(G.placement.ghost);
    // weather / lingering ambience reset
    FX.weather(null);
    G.env?.setDim(0);
    G.input?.groups?.clear();
    resetState();
    this.level = level;
    this.opts = opts;
    this.fired.clear();
    this.wavesSurvived = 0; this.junctionTrips = 0; this.kumzitzim = 0;
    this.won = false; this.lost = false;
    this.flockPeak = 0;
    this._spiritZeroT = 0;
    this._freeMilestone = false;
    G.level = level;
    G.levelIndex = LEVELS.indexOf(level);
    G.time.dayLength = BALANCE.time.dayLength;

    // terrain
    const seed = level.id === 'free' ? (opts.seed ?? Math.floor(Math.random() * 99999)) : level.terrain.seed;
    G.terrain.generate({ ...(level.terrain ?? {}), seed });
    G.rig.setTerrain(G.terrain);

    // director
    new EventDirector();
    if (level.id === 'free') G.director.freePlay = { difficulty: opts.difficulty ?? 1, demolition: opts.demolition ?? true };

    // unlocks
    G.flags.unlocked = new Set(level.unlocks);

    // kit
    const kit = level.kit;
    for (const k in kit.res) G.res[k] = kit.res[k];
    setSpirit(kit.spirit ?? 55);
    const c = { x: 0, z: 0 };
    G.basePos = null;

    // pre-placed buildings (instant)
    for (const bdef of kit.buildings ?? []) {
      const def = BALANCE.buildings[bdef.type];
      const cc = G.terrain.worldToCell(c.x, c.z);
      let placed = false;
      for (let tries = 0; tries < 40 && !placed; tries++) {
        const jx = tries === 0 ? 0 : Math.floor((Math.random() - 0.5) * 6);
        const jz = tries === 0 ? 0 : Math.floor((Math.random() - 0.5) * 6);
        const cx = cc.cx + bdef.dx + jx - Math.floor(def.w / 2);
        const cz = cc.cz + bdef.dz + jz - Math.floor(def.h / 2);
        if (G.terrain.buildable(cx, cz, def.w, def.h)) {
          const b = new Building(bdef.type, cx, cz);
          b.progress = def.buildS; b.finish(true);
          placed = true;
        }
      }
    }
    recomputeCaps();

    // units around base
    const base = G.basePos ?? { x: 0, z: 0 };
    const spawnAt = (r) => {
      const ang = Math.random() * Math.PI * 2;
      const w = G.terrain.findWalkableNear(base.x + Math.cos(ang) * r, base.z + Math.sin(ang) * r, 12);
      return G.terrain.cellToWorld(w.cx, w.cz);
    };
    for (const s of kit.settlers ?? []) {
      const p = spawnAt(4 + Math.random() * 4);
      new Settler(p.x, p.z, s);
    }
    for (const name of kit.dogs ?? []) {
      const p = spawnAt(5);
      new Dog(p.x, p.z, { name });
    }
    if (kit.donkey) {
      const p = spawnAt(6);
      new Donkey(p.x, p.z, { name: 'חמודי' });
    }
    for (let i = 0; i < (kit.sheep ?? 0); i++) {
      const p = spawnAt(6 + Math.random() * 3);
      new Sheep(p.x, p.z, { goat: i % 4 === 3 });
    }
    G.pop.cur = (kit.settlers ?? []).length;

    // objectives runtime
    this.objState = (level.objectives ?? []).map(o => ({ ...o, done: false, progress: 0 }));
    G.objectives = this.objState;

    // camera
    G.rig.jumpTo(base.x, base.z - 6);
    G.rig.dist = 55; G.rig.yaw = Math.PI * 0.25;

    G.time.hour = 7.5;
    G.running = true;
    G.events.emit('level-loaded', level);
    G.events.emit('res-changed', {});
    G.events.emit('pop-changed', G.pop);
    AudioSys.ambience('day');
    return this;
  }

  fail(reasonKey) {
    if (this.lost || this.won) return;
    this.lost = true;
    G.running = false;
    AudioSys.play('defeat');
    G.events.emit('level-lost', { reasonKey });
  }

  win() {
    if (this.won || this.lost) return;
    this.won = true;
    G.running = false;
    AudioSys.play('victory');
    G.events.emit('level-won', { level: this.level });
  }

  update(dt) {
    if (!this.level || this.won || this.lost) return;
    const t = G.time;

    // timeline
    (this.level.timeline ?? []).forEach((row, i) => {
      if (this.fired.has(i)) return;
      if (t.day > row.day || (t.day === row.day && t.hour >= row.hour)) {
        this.fired.add(i);
        this._exec(row);
      }
    });

    // objectives
    let allDone = true;
    for (const o of this.objState) {
      if (!o.done) {
        const { done, progress } = this._check(o);
        if (Math.floor((o.progress ?? 0) * 100) !== Math.floor(progress * 100)) this._objDirty = true;
        o.progress = progress;
        if (done) { o.done = true; G.events.emit('objective-done', o); }
      }
      if (!o.done) allDone = false;
    }
    this._objEmitT = (this._objEmitT ?? 0) - dt;
    if (this._objDirty && this._objEmitT <= 0) {
      this._objDirty = false;
      this._objEmitT = 1;
      G.events.emit('objective-progress', this.objState);
    }

    // win: all objectives + no live hostiles + no pending wave
    if (allDone && this.level.id !== 'free') {
      const quiet = !G.hostiles.some(h => h.alive) && !(G.director?.pendingWaves.length);
      if (quiet) this.win();
    }
    if (allDone && this.level.id === 'free' && !this._freeMilestone) {
      this._freeMilestone = true;
      G.events.emit('alert', { type: 'good', textKey: 'ev_free_milestone' });
      addRes('spirit', 15);
    }

    // fail states (flock check arms only once the flock actually existed)
    this.flockPeak = Math.max(this.flockPeak ?? 0, G.flock.length);
    if (this.level.failFlockMin && this.flockPeak >= this.level.failFlockMin && G.flock.length < this.level.failFlockMin) this.fail('lose_flock');
    if (this.level.failSpiritZero) {
      if (G.spirit <= 0.5) {
        this._spiritZeroT = (this._spiritZeroT ?? 0) + dt;
        if (this._spiritZeroT > 25) this.fail('lose_spirit');
      } else this._spiritZeroT = 0;
    }
  }

  _exec(row) {
    if (row.toast) G.events.emit('alert', { type: row.toast.type ?? 'info', textKey: row.toast.textKey, sticky: row.toast.sticky });
    if (row.wave) G.director.scheduleWave({ ...row.wave, telegraphS: row.wave.telegraphS });
    if (row.grant) { for (const k in row.grant) addRes(k, row.grant[k]); }
    if (row.weather) G.director.startWeather(row.weather);
    if (row.demolition) G.director.startDemolition(row.demolition);
    if (row.flockDelivery) {
      const r = G.terrain.roadEntry;
      for (let i = 0; i < row.flockDelivery; i++) {
        const s = new Sheep(r.x + (Math.random() - 0.5) * 5, r.z + (Math.random() - 0.5) * 5, { goat: i % 4 === 3 });
        s.state = 'return';
      }
      G.events.emit('flock-changed', {});
    }
  }

  _check(o) {
    switch (o.type) {
      case 'build': {
        const n = G.buildings.filter(b => b.typeId === o.building && b.state === 'done').length;
        return { done: n >= o.count, progress: n / o.count };
      }
      case 'res': return { done: G.res[o.res] >= o.amount, progress: G.res[o.res] / o.amount };
      case 'pop': return { done: G.units.filter(u => u.kind === 'settler' && u.alive).length >= o.count, progress: G.units.filter(u => u.kind === 'settler' && u.alive).length / o.count };
      case 'dogs': {
        const n = G.units.filter(u => u.kind === 'dog' && u.alive).length;
        return { done: n >= o.count, progress: n / o.count };
      }
      case 'flock': case 'flockEnd': {
        const n = G.flock.filter(s => s.alive).length;
        const others = this.objState.filter(x => x !== o);
        const gate = o.type === 'flock' ? true : others.every(x => x.done);
        return { done: gate && n >= o.count, progress: n / o.count };
      }
      case 'waves': return { done: this.wavesSurvived >= o.count, progress: this.wavesSurvived / o.count };
      case 'junction': return { done: this.junctionTrips >= o.count, progress: this.junctionTrips / o.count };
      case 'kumzitz': return { done: this.kumzitzim >= (o.count ?? 1), progress: this.kumzitzim / (o.count ?? 1) };
      case 'day': return { done: G.time.day >= o.day || (G.time.isShabbat && G.time.day >= o.day - 1), progress: G.time.day / o.day };
      case 'demolition': {
        const out = G.flags.demolitionOutcome;
        if (out === 'demolished' || out === 'destroyed') { this.fail('lose_order'); return { done: false, progress: 1 }; }
        return { done: !!out, progress: out ? 1 : 0 };
      }
      case 'spiritEnd': {
        const others = this.objState.filter(x => x !== o);
        return { done: others.every(x => x.done) && G.spirit >= o.amount, progress: G.spirit / o.amount };
      }
      default: return { done: false, progress: 0 };
    }
  }
}
