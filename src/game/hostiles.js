// Hostiles: courage-based rout system — nothing dies, everything flees.
// jackal/wolf hunt the flock, boars raid crops, thieves steal named sheep,
// raiders dismantle structures, the leader emboldens his wave.
import * as THREE from 'three';
import { G, addRes } from '../core/state.js';
import { BALANCE } from './balance.js';
import { Entity, nearestHostile } from './units.js';
import { FX } from '../engine/fx.js';
import { AudioSys } from '../audio.js';
import { dist2d, clamp } from '../core/util.js';
import { nearestBuilding, findBuilding, buildingsOf } from './buildings.js';
import { MAP_SIZE } from '../engine/terrain.js';

const HB = BALANCE.hostiles;
const CB = BALANCE.courage;

export class Hostile extends Entity {
  constructor(type, x, z, wave = null) {
    super('hostile', x, z);
    this.type = type;
    this.hostile = true;
    this.selectable = false;
    const st = HB[type];
    this.st = st;
    this.hp = this.maxHp = st.hp;
    this.speed = st.speed;
    this.courage = CB.max;
    this.wave = wave;
    this.state = 'approach';       // approach | act | flee
    this.target = null;            // entity or building
    this.spawnPoint = { x, z };
    this.stolen = null;            // sheep being carried (thief)
    this.pickY = ['boar', 'jackal', 'wolf'].includes(type) ? 0.5 : 0.9;
    this.selectRadius = 0.8;
    this._retargetT = 0;
    this._sfxT = Math.random() * 6;
    this._boredT = 0;         // gives up after a while with no success
    this.spawn(type, { seed: this.id * 7 });
    G.hostiles.push(this);
  }

  drainCourage(n) {
    if (this.state === 'flee') return;
    this.courage -= n;
    if (this.courage <= 0) this.flee();
  }

  damage(n, source) {
    if (!this.alive) return;
    this.hp -= n;
    this.drainCourage(n * 0.3);
    if (this.hp <= this.maxHp * this.st.fleeHpFrac) this.flee();
  }

  flee() {
    if (this.state === 'flee') return;
    this.state = 'flee';
    if (this.stolen) { this.dropSheep(); }
    this.wave?.onFled(this);
    FX.burst('scare', this.pos);
    AudioSys.play('scare', { vol: 0.5, pitch: ['thief', 'raider', 'leader'].includes(this.type) ? 0.8 : 1.1 });
    if (this.type === 'leader') {
      // the pack loses heart when the leader routs
      for (const h of G.hostiles) if (h !== this && h.wave === this.wave) h.drainCourage(this.st.routAura);
      G.rig.shake(0.5);
    }
    this.walkTo(this.spawnPoint.x, this.spawnPoint.z);
    G.stats.hostilesDriven++;
  }

  dropSheep() {
    if (!this.stolen) return;
    this.stolen.stolenBy = null;
    this.stolen.state = 'return';
    G.events.emit('sheep-recovered', this.stolen);
    this.stolen = null;
  }

  // ambient courage drains, computed per tick
  _passiveDrains(dt) {
    let drain = 0;
    // defenders in sight
    let defenders = 0;
    for (const u of G.units) {
      if (!u.alive || u.fallen) continue;
      if ((u.kind === 'settler' && (u.job === 'guard' || u.job === 'shepherd' || G.flags.bell)) || u.kind === 'dog') {
        if (dist2d(u.pos.x, u.pos.z, this.pos.x, this.pos.z) < 12) defenders++;
      }
    }
    drain += Math.min(defenders, CB.defenderSightCap) * CB.defenderInSightPerS;
    // barking dogs
    for (const u of G.units) {
      if (u.kind === 'dog' && u.alive && u.barking && dist2d(u.pos.x, u.pos.z, this.pos.x, this.pos.z) < BALANCE.units.dog.barkR)
        drain += CB.dogBarkPerS;
    }
    // generator light at night
    if (G.time.isNight && !G.time.isShabbat) {
      for (const g of buildingsOf('generator')) {
        if (dist2d(g.pos.x, g.pos.z, this.pos.x, this.pos.z) < g.def.lightR) drain += CB.generatorLightPerS;
      }
    }
    // bell crowd
    if (G.flags.bell) {
      for (const u of G.units) {
        if (u.kind === 'settler' && u.alive && !u.fallen && dist2d(u.pos.x, u.pos.z, this.pos.x, this.pos.z) < 15) {
          drain += CB.bellCrowdPerS; break;
        }
      }
    }
    if (drain > 0) this.drainCourage(drain * dt);
  }

  update(dt) {
    if (!this.alive) return;
    this._sfx(dt);
    if (this.state === 'flee') {
      this.stepMove(dt, 1.25);
      const edge = Math.max(Math.abs(this.pos.x), Math.abs(this.pos.z));
      if (this.arrived || edge > MAP_SIZE / 2 - 4) this.removeHostile();
      return;
    }
    this._passiveDrains(dt);
    // boredom: a hostile that achieves nothing for ~70s slinks away
    this._boredT += dt;
    if (this._boredT > 70) { this.flee(); return; }
    switch (this.type) {
      case 'jackal': case 'wolf': this._predator(dt); break;
      case 'boar': this._boar(dt); break;
      case 'thief': this._thief(dt); break;
      case 'raider': case 'leader': this._raider(dt); break;
    }
  }

  _sfx(dt) {
    this._sfxT -= dt;
    if (this._sfxT <= 0) {
      this._sfxT = 9 + Math.random() * 14;
      const map = { jackal: 'jackal_howl', wolf: 'wolf_growl', boar: 'boar_grunt', thief: null, raider: null, leader: null };
      const s = map[this.type];
      if (s) AudioSys.play(s, { vol: 0.35 });
    }
  }

  _acquire(pickFn, retargetEvery = 2.5) {
    this._retargetT -= 1 / 60;
    if (!this.target || !this.target.alive || (this._retargetT <= 0)) {
      this._retargetT = retargetEvery;
      this.target = pickFn();
    }
    return this.target;
  }

  _chaseAndBite(dt, target) {
    const d = dist2d(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
    if (d > 1.6) {
      if (this.arrived || (this._chaseT ?? 0) <= 0) { this._chaseT = 0.7; this.walkTo(target.pos.x, target.pos.z); }
      this._chaseT -= dt;
      this.stepMove(dt, 1);
      return false;
    }
    this.faceTarget = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    this.attackCd -= dt;
    if (this.attackCd <= 0) {
      this.attackCd = this.st.cooldownS;
      target.damage(this.st.damage, this);
      FX.burst('hit', target.pos);
      this._boredT = 0;
      return true;
    }
    return false;
  }

  _nearestSheep() {
    let best = null, bd = 1e9;
    for (const s of G.flock) {
      if (!s.alive || s.stolenBy) continue;
      const d = dist2d(s.pos.x, s.pos.z, this.pos.x, this.pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  _nearestDefender(range = 20) {
    let best = null, bd = range;
    for (const u of G.units) {
      if (!u.alive || u.fallen || u.kind === 'donkey') continue;
      const d = dist2d(u.pos.x, u.pos.z, this.pos.x, this.pos.z);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  _predator(dt) {
    const target = this._acquire(() => this._nearestSheep() || this._nearestDefender(30));
    if (!target) { this.flee(); return; }
    this._chaseAndBite(dt, target);
  }

  _boar(dt) {
    const target = this._acquire(() =>
      nearestBuilding(this.pos.x, this.pos.z, b => b.state === 'done' && (b.def.crops || b.def.foodPerMin))
      || this._nearestSheep());
    if (!target) { this.flee(); return; }
    if (target.kind === 'building') {
      const d = dist2d(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
      if (d > 2.2) {
        if (this.arrived) this.walkTo(target.pos.x, target.pos.z);
        this.stepMove(dt, 1);
        return;
      }
      // uproot the crops
      this._eatT = (this._eatT ?? 0) + dt;
      this.working = true;
      target.damage(this.st.damage * dt * 0.5, this);
      if (this._eatT > 14) this.flee(); // ate his fill
    } else {
      this._chaseAndBite(dt, target);
    }
  }

  _thief(dt) {
    if (this.stolen) {
      // run to the edge with the sheep
      this.speed = this.st.speedCarrying;
      if (this.arrived) this.walkTo(this.spawnPoint.x, this.spawnPoint.z);
      this.stepMove(dt, 1);
      const edge = Math.max(Math.abs(this.pos.x), Math.abs(this.pos.z));
      if (edge > MAP_SIZE / 2 - 5) {
        // escaped with a named sheep
        const s = this.stolen;
        this.stolen = null;
        s.stolenBy = null;
        s.onZeroHp();
        this.removeHostile();
      }
      return;
    }
    this.speed = this.st.speed;
    const target = this._acquire(() => this._nearestSheep());
    if (!target) { this.flee(); return; }
    const d = dist2d(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
    if (d > 1.4) {
      if (this.arrived || (this._chaseT ?? 0) <= 0) { this._chaseT = 0.7; this.walkTo(target.pos.x, target.pos.z); }
      this._chaseT -= dt;
      this.stepMove(dt, 1);
    } else {
      // grab her
      this.stolen = target;
      target.stolenBy = this;
      G.events.emit('sheep-stolen', target);
      this.walkTo(this.spawnPoint.x, this.spawnPoint.z);
    }
  }

  _raider(dt) {
    const target = this._acquire(() =>
      nearestBuilding(this.pos.x, this.pos.z, b => b.state === 'done' && b.typeId !== 'fence' && !b.def.core)
      || nearestBuilding(this.pos.x, this.pos.z, b => b.state === 'done' && b.typeId !== 'fence')
      || this._nearestDefender(40));
    if (!target) { this.flee(); return; }
    if (target.kind === 'building') {
      const d = dist2d(this.pos.x, this.pos.z, target.pos.x, target.pos.z);
      const reach = Math.max(target.w, target.h) + 1.6;
      if (d > reach) {
        if (this.arrived || (this._chaseT ?? 0) <= 0) { this._chaseT = 1; this.walkTo(target.pos.x + (Math.random() - 0.5) * 3, target.pos.z + (Math.random() - 0.5) * 3); }
        this._chaseT -= dt;
        this.stepMove(dt, 1);
        return;
      }
      // bang on it (audible dismantling)
      this.working = true;
      this.faceTarget = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
      target.damage(this.st.dismantleDps ? this.st.dismantleDps * dt : this.st.damage * dt, this);
      this._bangT = (this._bangT ?? 0) - dt;
      if (this._bangT <= 0) { this._bangT = 1.1; AudioSys.play('hit', { vol: 0.5, pitch: 0.7 }); FX.burst('woodChips', target.pos); }
      // fight back if a defender is on him
      const def = this._nearestDefender(2.2);
      if (def) this._chaseAndBite(dt, def);
    } else {
      this._chaseAndBite(dt, target);
    }
  }

  removeHostile() {
    this.alive = false;
    FX.unring(this);
    if (this.mesh) G.scene.remove(this.mesh);
    G.hostiles = G.hostiles.filter(h => h !== this);
    G.selection = G.selection.filter(e => e !== this);
    this.wave?.onGone(this);
  }
}

// ============================================================ Wave
export class Wave {
  constructor(budget, palette, dirs, opts = {}) {
    this.id = Math.floor(Math.random() * 1e9);
    this.budget = budget;
    this.palette = palette;
    this.dirs = dirs;                 // array of angles (radians)
    this.units = [];
    this.totalPts = 0;
    this.fledPts = 0;
    this.done = false;
    this.lossless = true;
    this.opts = opts;
  }

  spawn() {
    const maxN = BALANCE.waves.unitCount.maxPerWave;
    let remaining = this.budget;
    const comp = [];
    // greedy spend: prefer expensive first for drama, fill with cheap
    const sorted = [...this.palette].sort((a, b) => HB[b].pts - HB[a].pts);
    let guard = 0;
    while (remaining > 0 && comp.length < maxN && guard++ < 60) {
      let picked = null;
      for (const t of sorted) {
        if (HB[t].pts <= remaining && (t !== 'leader' || !comp.includes('leader'))) {
          // mix: 50% chance to take the most expensive, else random from affordable
          const affordable = this.palette.filter(p => HB[p].pts <= remaining && (p !== 'leader' || !comp.includes('leader')));
          picked = Math.random() < 0.5 ? t : affordable[Math.floor(Math.random() * affordable.length)];
          break;
        }
      }
      if (!picked) break;
      comp.push(picked);
      remaining -= HB[picked].pts;
    }
    if (!comp.length) comp.push(this.palette[0]);
    // spawn spread across dirs at map edge
    const half = MAP_SIZE / 2 - 3;
    comp.forEach((type, i) => {
      const ang = this.dirs[i % this.dirs.length] + (Math.random() - 0.5) * 0.35;
      let x = Math.cos(ang) * half, z = Math.sin(ang) * half;
      x = clamp(x + (Math.random() - 0.5) * 8, -half, half);
      z = clamp(z + (Math.random() - 0.5) * 8, -half, half);
      const h = new Hostile(type, x, z, this);
      this.units.push(h);
      this.totalPts += HB[type].pts;
    });
    G.events.emit('raid-start', this);
    AudioSys.duckFor(4);
    return this;
  }

  onFled(h) {
    this.fledPts += HB[h.type].pts;
    // raiders lose heart when the wave loses 60% strength
    if (this.fledPts / Math.max(this.totalPts, 1) >= 0.6) {
      for (const u of this.units) {
        if (u.alive && u.state !== 'flee' && ['raider', 'leader', 'thief'].includes(u.type)) u.flee();
      }
    }
  }

  onGone() {
    if (this.done) return;
    if (this.units.every(u => !u.alive)) {
      this.done = true;
      G.stats.raidsRepelled++;
      addRes('spirit', BALANCE.waves.rewards.waveSurvivedSpirit + (this.lossless ? BALANCE.waves.rewards.zeroLossSpirit : 0));
      G.events.emit('raid-end', this);
    }
  }
}

export function updateHostiles(dt) {
  for (const h of [...G.hostiles]) if (h.alive) { h.update(dt); }
  for (const h of G.hostiles) if (h.alive) { h.separate(dt, G.hostiles); h.animate(dt); }
}
