// Per-tick economy/spirit systems + the player's order actions.
import * as THREE from 'three';
import { G, addRes, workAllowed } from '../core/state.js';
import { BALANCE } from './balance.js';
import { FX } from '../engine/fx.js';
import { AudioSys } from '../audio.js';
import { dist2d } from '../core/util.js';
import { findBuilding, buildingsOf } from './buildings.js';
import { Sheep, Dog } from './units.js';
import { POOLS } from '../i18n/he.js';
import { penInfo } from './buildings.js';

const CONS = BALANCE.resources.consumptionPerMin;

export function updateEconomy(dt) {
  const settlers = G.units.filter(u => u.kind === 'settler' && u.alive);
  const dogs = G.units.filter(u => u.kind === 'dog' && u.alive);

  // consumption (sharav heat multiplies thirst)
  const heat = G.flags.sharav ? 1.6 : 1;
  addRes('food', -(settlers.length * CONS.settlerFood + dogs.length * CONS.dogFood) / 60 * dt);
  addRes('water', -(settlers.length * CONS.settlerWater + G.flock.length * CONS.sheepWater) * heat / 60 * dt);

  // starvation / thirst spirit drain
  if (G.res.food <= 0 || G.res.water <= 0) {
    addRes('spirit', BALANCE.resources.starvation.spiritPerMin / 60 * dt);
    G.flags.starving = true;
  } else G.flags.starving = false;

  // spirit drift
  addRes('spirit', BALANCE.spirit.driftPerMin / 60 * dt);

  // campfire evening aura
  const evening = G.time.hour >= 18 && G.time.hour <= 23;
  if (evening) {
    for (const fire of buildingsOf('campfire')) {
      let near = 0;
      for (const u of settlers) if (dist2d(u.pos.x, u.pos.z, fire.pos.x, fire.pos.z) < fire.def.spiritAuraR) near++;
      if (near >= 2) { addRes('spirit', BALANCE.spirit.campfireAuraPerMin / 60 * dt); break; }
    }
  }

  // kumzitz window
  if (G.flags.kumzitzUntil && G.time.t >= G.flags.kumzitzUntil) {
    G.flags.kumzitzUntil = 0;
    const bonus = G.flags.motzash ? BALANCE.spirit.kumzitzMotzash : BALANCE.spirit.kumzitz;
    addRes('spirit', bonus);
    G.stats.kumzitzim = (G.stats.kumzitzim || 0) + 1;
    FX.burst('sparkle', findBuilding('campfire')?.pos ?? G.basePos ?? new THREE.Vector3());
    G.events.emit('kumzitz-end', { bonus });
  }

  // auto-release the bell when quiet (but never during a warned telegraph)
  if (G.flags.bell) {
    const active = G.hostiles.some(h => h.alive && h.state !== 'flee')
      || G.director?.pendingWaves.some(w => w.warned);
    if (!active) {
      G.flags.bellQuietT = (G.flags.bellQuietT ?? 0) + dt;
      if (G.flags.bellQuietT > 6) { G.flags.bell = false; G.flags.bellQuietT = 0; G.events.emit('bell', false); }
    } else G.flags.bellQuietT = 0;
  }
}

export function initSystemsEvents() {
  // morning recovery
  G.events.on('day-start', () => {
    for (const u of G.units) if (u.fallen) { u.recover(); }
    // lambing: a fed, penned flock grows
    const penCap = buildingsOf('sheep_pen').reduce((a, p) => a + (p.def.sheepCap ?? 12), 0);
    if (G.flock.length >= 4 && G.res.food > 15 && G.flock.length < penCap + 2 && Math.random() < 0.4) {
      const mom = G.flock[Math.floor(Math.random() * G.flock.length)];
      if (mom?.alive) {
        const lamb = new Sheep(mom.pos.x + 1, mom.pos.z + 1, { lamb: true, bornDay: G.time.day });
        G.stats.sheepBorn++;
        addRes('spirit', 3);
        FX.burst('heart', mom.pos);
        G.events.emit('alert', { type: 'good', textKey: 'ev_lamb_born', vars: { name: lamb.name } });
      }
    }
  });

  // shabbat spirit lump
  G.events.on('shabbat-start', () => {
    const lump = findBuilding('synagogue') ? BALANCE.spirit.shabbatSynagogue : BALANCE.spirit.shabbat;
    addRes('spirit', lump);
    AudioSys.play('shabbat');
    AudioSys.ambience('shabbat');
    G.flags.kumzitzTonight = false;
  });
  G.events.on('shabbat-end', () => {
    AudioSys.play('havdalah');
    G.flags.motzash = true;
    G.events.emit('alert', { type: 'info', textKey: 'ev_motzash' });
  });
  G.events.on('day-start', () => { if (!G.time.isShabbat) G.flags.motzash = false; G.flags.kumzitzTonight = false; });

  G.events.on('night-start', () => { AudioSys.ambience(G.time.isShabbat ? 'shabbat' : 'night'); FX.setNight?.(true); });
  G.events.on('night-end', () => { AudioSys.ambience(G.time.isShabbat ? 'shabbat' : 'day'); FX.setNight?.(false); });
  G.events.on('raid-start', () => AudioSys.ambience('danger'));
  G.events.on('raid-end', () => { AudioSys.ambience(G.time.isNight ? 'night' : 'day'); G.flags.lastRaidEnd = G.time.t; });
}

// ============================================================ actions
export function initGameActions() {
  G.actions.assignJob = (units, job) => {
    for (const u of units) {
      if (u.kind === 'settler') u.setJob(job);
      if (u.kind === 'donkey' && (job === 'water' || job === 'idle')) u.job = job;
    }
    G.events.emit('selection-changed', G.selection);
    AudioSys.play('click');
  };

  G.actions.toggleBell = () => {
    G.flags.bell = !G.flags.bell;
    AudioSys.play('bell');
    G.events.emit('bell', G.flags.bell);
  };

  G.actions.canKumzitz = () => {
    const fire = findBuilding('campfire');
    const evening = G.time.hour >= 17.5 || G.time.hour < 1;
    const cooled = G.time.t - (G.flags.kumzitzAtT ?? -1e9) > BALANCE.time.dayLength * 0.6;
    return !!fire && evening && cooled && !G.flags.kumzitzTonight && G.res.wood >= BALANCE.spirit.kumzitzWoodCost && !G.time.isShabbat;
  };

  G.actions.kumzitz = () => {
    if (!G.actions.canKumzitz()) return false;
    const fire = findBuilding('campfire');
    addRes('wood', -BALANCE.spirit.kumzitzWoodCost);
    G.flags.kumzitzTonight = true;
    G.flags.kumzitzAtT = G.time.t;
    G.flags.kumzitzUntil = G.time.t + 18;
    AudioSys.play('kumzitz_start');
    G.events.emit('kumzitz-start', {});
    // everyone drifts to the fire
    for (const u of G.units) {
      if (u.kind === 'settler' && !u.fallen && u.job !== 'guard') {
        u.state = 'ordered-move';
        const ang = Math.random() * Math.PI * 2;
        u.walkTo(fire.pos.x + Math.cos(ang) * 3.2, fire.pos.z + Math.sin(ang) * 3.2);
      }
    }
    return true;
  };

  G.actions.buySheep = () => {
    const pen = penInfo();
    if (!pen.pen || G.res.shekels < 25) return false;
    const cap = buildingsOf('sheep_pen').reduce((a, p) => a + (p.def.sheepCap ?? 12), 0);
    if (G.flock.length >= cap) return false;
    addRes('shekels', -25);
    new Sheep(pen.x + (Math.random() - 0.5) * 4, pen.z + (Math.random() - 0.5) * 4, { goat: Math.random() < 0.25 });
    AudioSys.play('sheep');
    G.events.emit('flock-changed', {});
    return true;
  };

  G.actions.adoptDog = () => {
    const kennel = findBuilding('kennel');
    const cost = BALANCE.buildings.kennel.cost.food ?? 10;
    if (!kennel || G.res.food < cost) return false;
    const dogs = G.units.filter(u => u.kind === 'dog');
    if (dogs.length >= buildingsOf('kennel').length * kennel.def.dogSlots) return false;
    addRes('food', -cost);
    const taken = new Set(dogs.map(d => d.name));
    const name = (POOLS.names_dogs ?? []).find(n => !taken.has(n));
    new Dog(kennel.pos.x + 2, kennel.pos.z + 2, name ? { name } : {});
    AudioSys.play('dog_bark');
    return true;
  };

  G.actions.contextOrder = ({ entity, resource, ground }) => {
    const sel = G.selection.filter(e => e.alive && e.selectable);
    if (!sel.length) return;
    const settlers = sel.filter(u => u.kind === 'settler');
    const dogs = sel.filter(u => u.kind === 'dog');
    const donkeys = sel.filter(u => u.kind === 'donkey');

    if (entity && entity.hostile) {
      for (const d of dogs) d.orderTarget = entity;
      for (const s of settlers) { s.forceTarget = entity; s.state = 'idle'; }
      FX.marker(entity.pos, 'attack');
      AudioSys.play('click');
      return;
    }
    if (entity && entity.kind === 'building') {
      if (entity.state === 'site') {
        for (const s of settlers) { s.setJob('build'); s.workTarget = entity; }
      } else if (entity.def.foodPerMin) {
        for (const s of settlers) { s.setJob('farm'); s.workTarget = entity; }
      } else {
        for (const s of [...settlers, ...dogs, ...donkeys]) { s.state = 'ordered-move'; s.walkTo(entity.pos.x + 2, entity.pos.z + 2); }
      }
      FX.marker(entity.pos, 'move');
      AudioSys.play('click');
      return;
    }
    if (resource) {
      if (resource.type === 'tree') for (const s of settlers) { s.setJob('wood'); s.workTarget = resource.node; }
      if (resource.type === 'stone') for (const s of settlers) { s.setJob('stone'); s.workTarget = resource.node; }
      if (resource.type === 'spring') {
        for (const s of settlers) s.setJob('water');
        for (const d of donkeys) d.job = 'water';
      }
      if (ground) FX.marker(new THREE.Vector3(ground.x, G.terrain.heightAt(ground.x, ground.z), ground.z), 'move');
      AudioSys.play('click');
      return;
    }
    if (ground) {
      const road = G.terrain.roadEntry;
      if (dist2d(ground.x, ground.z, road.x, road.z) < 7 && settlers.length) {
        for (const s of settlers) s.setJob('runner');
        FX.marker(new THREE.Vector3(road.x, G.terrain.heightAt(road.x, road.z), road.z), 'move');
        AudioSys.play('click');
        return;
      }
      // formation move
      const n = sel.length;
      const cols = Math.ceil(Math.sqrt(n));
      sel.forEach((u, i) => {
        const ox = (i % cols - (cols - 1) / 2) * 1.6;
        const oz = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 1.6;
        u.state = 'ordered-move';
        u.walkTo(ground.x + ox, ground.z + oz);
      });
      FX.marker(new THREE.Vector3(ground.x, G.terrain.heightAt(ground.x, ground.z), ground.z), 'move');
      AudioSys.play('click');
    }
  };
}
