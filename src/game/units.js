// Friendly units: Entity base, movement + procedural walk animation,
// settlers with job brains, the named flock, guard dogs, the donkey.
import * as THREE from 'three';
import { G, addRes, workAllowed, spiritMul } from '../core/state.js';
import { BALANCE } from './balance.js';
import { createModel } from './models.js';
import { findPath } from '../engine/path.js';
import { FX } from '../engine/fx.js';
import { AudioSys } from '../audio.js';
import { nextId, dist2d, clamp, lerp, angleLerp, damp, mulberry32 } from '../core/util.js';
import { CELL, MAP_SIZE } from '../engine/terrain.js';
import { nearestSite, nearestBuilding, penInfo, findBuilding } from './buildings.js';
import { t, pick } from '../i18n/he.js';

const RATES = BALANCE.resources.ratesPerMin;

// ============================================================ Entity
export class Entity {
  constructor(kind, x, z) {
    this.id = nextId();
    this.kind = kind;
    this.pos = new THREE.Vector3(x, 0, z);
    this.hp = 10; this.maxHp = 10;
    this.alive = true;
    this.selectable = false;
    this.hostile = false;
    this.speed = 3;
    this.selectRadius = 0.9;
    this.pickY = 0.9;
    this.path = null; this.pathI = 0;
    this.goal = null;
    this.arrived = true;
    this.walkPhase = Math.random() * 10;
    this.moving = false;
    this.faceY = Math.random() * Math.PI * 2;
    this._stuckT = 0;
    this._lastD = 1e9;
    this.attackCd = 0;
  }

  spawn(modelType, opts) {
    this.mesh = createModel(modelType, opts);
    this.mesh.userData.entity = this;
    this.mesh.traverse(o => { o.userData.entity = this; });
    this.snap();
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.faceY;
    G.scene.add(this.mesh);
    return this;
  }

  snap() { this.pos.y = G.terrain.heightAt(this.pos.x, this.pos.z); }

  walkTo(x, z) {
    const lim = MAP_SIZE / 2 - 2;
    x = clamp(x, -lim, lim); z = clamp(z, -lim, lim);
    this.goal = { x, z };
    const s = G.terrain.worldToCell(this.pos.x, this.pos.z);
    const g = G.terrain.worldToCell(x, z);
    const cells = findPath(G.terrain, s.cx, s.cz, g.cx, g.cz);
    if (!cells) { this.path = null; this.arrived = true; return false; }
    this.path = cells.map(c => G.terrain.cellToWorld(c.cx, c.cz));
    if (this.path.length) this.path[this.path.length - 1] = { x, z };
    this.pathI = 0;
    this.arrived = false;
    this._stuckT = 0; this._lastD = 1e9;
    return true;
  }

  stepMove(dt, speedMult = 1) {
    this.moving = false;
    if (this.arrived || !this.path) return;
    const wp = this.path[this.pathI];
    if (!wp) { this.arrived = true; return; }
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * speedMult * dt;
    if (d < Math.max(0.25, step)) {
      this.pathI++;
      if (this.pathI >= this.path.length) { this.arrived = true; this.path = null; return; }
      return;
    }
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.moving = true;
    this.faceTarget = Math.atan2(dx, dz);
    // stuck detection -> repath
    this._stuckT += dt;
    if (this._stuckT > 1.6) {
      if (this._lastD - d < 0.4 && this.goal) this.walkTo(this.goal.x, this.goal.z);
      this._stuckT = 0; this._lastD = d;
    }
  }

  separate(dt, others) {
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (0.9 - d) * dt * 2.2;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
  }

  animate(dt) {
    if (!this.mesh) return;
    this.snap();
    this.mesh.position.copy(this.pos);
    if (this.faceTarget !== undefined) {
      this.faceY = angleLerp(this.faceY, this.faceTarget, damp(10, dt));
      this.mesh.rotation.y = this.faceY;
    }
    const anim = this.mesh.userData.anim;
    if (!anim) return;
    if (this.fallen) {
      this.mesh.rotation.x = lerp(this.mesh.rotation.x, -1.35, damp(4, dt));
      return;
    }
    this.mesh.rotation.x = 0;
    if (this.moving) {
      this.walkPhase += dt * this.speed * 3.2;
      const sw = Math.sin(this.walkPhase);
      if (anim.legs) anim.legs.forEach((l, i) => { l.rotation.x = sw * 0.55 * (i % 2 === 0 ? 1 : -1) * (anim.legs.length > 2 && i >= 2 ? -1 : 1); });
      if (anim.arms) anim.arms.forEach((a, i) => { a.rotation.x = sw * 0.4 * (i % 2 === 0 ? -1 : 1); });
      if (anim.head) anim.head.rotation.x = Math.abs(sw) * 0.04;
      if (anim.tail) anim.tail.rotation.x = Math.sin(this.walkPhase * 1.5) * 0.2;
    } else {
      this.walkPhase += dt * 1.2;
      const b = Math.sin(this.walkPhase);
      if (anim.legs) anim.legs.forEach(l => { l.rotation.x = lerp(l.rotation.x, 0, damp(8, dt)); });
      if (anim.arms) anim.arms.forEach(a => { a.rotation.x = lerp(a.rotation.x, 0, damp(8, dt)); });
      if (anim.head) anim.head.rotation.x = b * 0.05;
      if (anim.tail) anim.tail.rotation.x = b * 0.3;
      if (this.working) {
        // hammer/chop gesture
        if (anim.arms?.[0]) anim.arms[0].rotation.x = -0.6 + Math.sin(this.walkPhase * 6) * 0.6;
        if (anim.head) anim.head.rotation.x = 0.12;
      }
    }
  }

  inRange(target, range) {
    return dist2d(this.pos.x, this.pos.z, target.pos.x, target.pos.z) <= range + (target.selectRadius ?? 0.5);
  }

  tryAttack(target, dt, stats) {
    this.attackCd -= dt;
    const range = stats.rangeM ?? 1.6;
    if (!this.inRange(target, range)) {
      if (this.arrived || !this.goal || dist2d(this.goal.x, this.goal.z, target.pos.x, target.pos.z) > 2.5)
        this.walkTo(target.pos.x, target.pos.z);
      this.stepMove(dt, this._speedMult());
      return false;
    }
    this.faceTarget = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    this.working = true;
    if (this.attackCd <= 0) {
      this.attackCd = stats.cooldownS;
      let dmg = stats.damage;
      if (stats.vsBoar && target.type === 'boar') dmg *= stats.vsBoar;
      if (stats.vsAnimal && ['wolf', 'jackal', 'boar'].includes(target.type)) dmg *= stats.vsAnimal;
      if (stats.vsHuman && ['thief', 'raider', 'leader'].includes(target.type)) dmg *= stats.vsHuman;
      target.damage(dmg, this);
      if (target.drainCourage) target.drainCourage(stats.courageDrainPerHit ?? 5);
      if (range > 4) { AudioSys.play('sling', { vol: 0.5 }); FX.burst('hit', target.pos); }
      else FX.burst('hit', target.pos);
      return true;
    }
    return false;
  }

  _speedMult() { return 1; }

  setSelected(v) { if (v) FX.ring(this); else FX.unring(this); }

  damage(n) {
    if (!this.alive) return;
    this.hp -= n;
    if (this.hp <= 0) this.onZeroHp();
  }

  onZeroHp() { this.removeSelf(); }

  removeSelf() {
    this.alive = false;
    FX.unring(this);
    if (this.mesh) G.scene.remove(this.mesh);
    G.units = G.units.filter(u => u !== this);
    G.flock = G.flock.filter(u => u !== this);
    G.selection = G.selection.filter(u => u !== this);
    G.events.emit('selection-changed', G.selection);
  }
}

// find nearest visible hostile
export function nearestHostile(x, z, range, includeFleeing = false) {
  let best = null, bd = range;
  for (const h of G.hostiles) {
    if (!h.alive || (!includeFleeing && h.state === 'flee')) continue;
    const d = dist2d(x, z, h.pos.x, h.pos.z);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

// ============================================================ Settler
export class Settler extends Entity {
  constructor(x, z, opts = {}) {
    super('settler', x, z);
    this.selectable = true;
    this.female = opts.female ?? Math.random() < 0.35;
    this.name = opts.name || pick(this.female ? 'names_female' : 'names_male');
    this.trait = opts.trait || pick('traits');
    this.role = opts.role || 'worker';   // worker | guard | shepherd
    this.job = opts.job || 'idle';       // idle|wood|stone|farm|water|build|runner|guard|shepherd
    const st = BALANCE.units.settler;
    this.hp = this.maxHp = st.hp;
    this.speed = st.speed;
    this.carrying = 0;
    this.workTarget = null;
    this.state = 'idle';
    this.stateT = 0;
    this.homeOffset = { x: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 };
    this._wanderT = Math.random() * 4;
    this.spawn(this.job === 'guard' ? 'guard' : this.job === 'shepherd' ? 'shepherd' : 'settler', { female: this.female, seed: this.id * 17 });
    G.units.push(this);
  }

  get stats() {
    return this.job === 'guard' ? BALANCE.units.guard
      : this.job === 'shepherd' ? BALANCE.units.shepherd
      : BALANCE.units.settler;
  }

  setJob(job) {
    if (this.job === job) return;
    const needsModel = (j) => j === 'guard' ? 'guard' : j === 'shepherd' ? 'shepherd' : 'settler';
    const oldM = needsModel(this.job), newM = needsModel(job);
    this.job = job;
    this.workTarget = null;
    this.state = 'idle';
    if (oldM !== newM) {
      const sel = G.selection.includes(this);
      G.scene.remove(this.mesh);
      this.spawnModelSwap(newM);
      if (sel) FX.ring(this);
    }
    G.events.emit('selection-changed', G.selection);
  }

  spawnModelSwap(modelType) {
    this.mesh = createModel(modelType, { female: this.female, seed: this.id * 17 });
    this.mesh.userData.entity = this;
    this.mesh.traverse(o => { o.userData.entity = this; });
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.faceY;
    G.scene.add(this.mesh);
  }

  _speedMult() { return spiritMul() * (this.trait === 'diligent' ? 1.1 : this.trait === 'sleepy' ? 0.92 : 1); }
  workMult() { return spiritMul() * (G.res.food <= 0 || G.res.water <= 0 ? BALANCE.resources.starvation.workSpeedMult : 1) * (this.trait === 'diligent' ? 1.15 : 1); }

  update(dt) {
    this.working = false;
    if (this.fallen) return; // injured until morning

    // 0. explicit chase-off order ("גרש אותו!") — any settler, returns to job after
    if (this.forceTarget) {
      const ft = this.forceTarget;
      if (!ft.alive || ft.state === 'flee') { this.forceTarget = null; }
      else { this.tryAttack(ft, dt, this.stats); return; }
    }

    // 1. flee from close hostiles (non-guards, no bell)
    const threat = nearestHostile(this.pos.x, this.pos.z, 6);
    if (threat && !G.flags.bell && this.job !== 'guard' && this.job !== 'shepherd') {
      if (this.state !== 'flee') {
        this.state = 'flee';
        const base = G.basePos ?? { x: 0, z: 0 };
        this.walkTo(base.x + this.homeOffset.x, base.z + this.homeOffset.z);
      }
      this.stepMove(dt, 1.25);
      if (!threat.alive || this.arrived) this.state = 'idle';
      return;
    }

    // 2. bell militia / guard combat
    if (G.flags.bell || this.job === 'guard' || this.job === 'shepherd') {
      const range = this.job === 'shepherd' ? 26 : G.flags.bell ? 30 : this.stats.visionM;
      const target = nearestHostile(this.pos.x, this.pos.z, range);
      if (target) { this.tryAttack(target, dt, this.stats); return; }
    }

    // 3. ordered move
    if (this.state === 'ordered-move') {
      this.stepMove(dt, this._speedMult());
      if (this.arrived) this.state = 'idle';
      return;
    }

    // 4. Shabbat rest
    if (G.time.isShabbat && this.job !== 'guard') { this._restBehavior(dt, true); return; }

    // 5. night rest for civilians
    if (G.time.isNight && !['guard', 'shepherd', 'runner'].includes(this.job)) { this._restBehavior(dt, false); return; }

    // 6. job brains
    switch (this.job) {
      case 'wood': this._gather(dt, 'tree'); break;
      case 'stone': this._gather(dt, 'stone'); break;
      case 'farm': this._farm(dt); break;
      case 'water': this._water(dt); break;
      case 'build': this._build(dt); break;
      case 'runner': this._runner(dt); break;
      case 'guard': this._guardPatrol(dt); break;
      case 'shepherd': this._shepherd(dt); break;
      default: this._idle(dt); break;
    }
  }

  _restBehavior(dt, shabbat) {
    const spot = shabbat
      ? (findBuilding('synagogue')?.pos ?? findBuilding('campfire')?.pos ?? G.basePos ?? { x: 0, z: 0 })
      : (findBuilding('campfire')?.pos ?? G.basePos ?? { x: 0, z: 0 });
    const d = dist2d(this.pos.x, this.pos.z, spot.x, spot.z);
    if (d > 7) {
      if (this.arrived) this.walkTo(spot.x + this.homeOffset.x * 0.6, spot.z + this.homeOffset.z * 0.6);
      this.stepMove(dt, this._speedMult());
    } else {
      this._wanderT -= dt;
      if (this._wanderT <= 0) {
        this._wanderT = 4 + Math.random() * 6;
        if (Math.random() < 0.4) this.walkTo(spot.x + (Math.random() - 0.5) * 8, spot.z + (Math.random() - 0.5) * 8);
      }
      this.stepMove(dt, 0.5);
    }
  }

  _idle(dt) {
    // drift toward zula / campfire, small wanders
    this._wanderT -= dt;
    if (this._wanderT <= 0) {
      this._wanderT = 5 + Math.random() * 7;
      const spot = findBuilding('zula')?.pos ?? findBuilding('campfire')?.pos ?? G.basePos ?? { x: 0, z: 0 };
      this.walkTo(spot.x + (Math.random() - 0.5) * 9, spot.z + (Math.random() - 0.5) * 9);
    }
    this.stepMove(dt, 0.55);
    // idle settlers help build nearby sites
    if (workAllowed()) {
      const site = nearestSite(this.pos.x, this.pos.z);
      if (site && dist2d(this.pos.x, this.pos.z, site.pos.x, site.pos.z) < 26) {
        this.job = 'build'; this.workTarget = site;
      }
    }
  }

  _gather(dt, what) {
    if (!workAllowed()) { this._restBehavior(dt, true); return; }
    let node = this.workTarget;
    if (!node || !node.alive || (what === 'tree' ? node.wood <= 0 : node.stone <= 0)) {
      node = what === 'tree' ? G.terrain.nearestTree(this.pos.x, this.pos.z) : G.terrain.nearestStone(this.pos.x, this.pos.z);
      this.workTarget = node;
      if (!node) { this.job = 'idle'; return; }
      this.walkTo(node.x, node.z);
    }
    const d = dist2d(this.pos.x, this.pos.z, node.x, node.z);
    if (d > 2.4) {
      if (this.arrived) this.walkTo(node.x, node.z);
      this.stepMove(dt, this._speedMult());
      return;
    }
    // work the node
    this.working = true;
    this.faceTarget = Math.atan2(node.x - this.pos.x, node.z - this.pos.z);
    const rate = (what === 'tree' ? RATES.woodcutter : RATES.stoneGatherer) / 60 * this.workMult();
    const amount = rate * dt;
    if (what === 'tree') {
      node.wood -= amount;
      const gained = addRes('wood', amount);
      this._workFx(dt, 'woodChips', node, 'chop');
      if (node.wood <= 0) { G.terrain.depleteTree(node); FX.burst('dust', new THREE.Vector3(node.x, node.y, node.z)); this.workTarget = null; }
      if (gained <= 0) this._capIdle(dt);
    } else {
      node.stone -= amount;
      const gained = addRes('stone', amount);
      this._workFx(dt, 'stoneChips', node, 'mine');
      if (node.stone <= 0) { G.terrain.depleteStone(node); this.workTarget = null; }
      if (gained <= 0) this._capIdle(dt);
    }
  }

  _capIdle() { /* storage full -> keep animation but flag for UI */ G.flags.storageFull = G.time.t; }

  _workFx(dt, burst, node, sfx) {
    this._fxT = (this._fxT ?? 0) - dt;
    if (this._fxT <= 0) {
      this._fxT = 0.9 + Math.random() * 0.4;
      FX.burst(burst, new THREE.Vector3(node.x ?? node.pos?.x, (node.y ?? node.pos?.y ?? 0) + 0.8, node.z ?? node.pos?.z));
      AudioSys.play(sfx, { vol: 0.35, pitch: 0.9 + Math.random() * 0.2 });
    }
  }

  _farm(dt) {
    if (!workAllowed()) { this._restBehavior(dt, true); return; }
    let b = this.workTarget;
    if (!b || !b.alive || b.state !== 'done' || !(b.def.foodPerMin)) {
      b = nearestBuilding(this.pos.x, this.pos.z, x => x.state === 'done' && x.def.foodPerMin && x.workers.size < (x.def.workerSlots ?? 1));
      if (!b) { this.job = 'idle'; return; }
      this.workTarget = b;
      b.workers.add(this.id);
      this.walkTo(b.pos.x + 1.5, b.pos.z);
    }
    const d = dist2d(this.pos.x, this.pos.z, b.pos.x, b.pos.z);
    if (d > 3.2) {
      if (this.arrived) this.walkTo(b.pos.x + 1.5, b.pos.z);
      this.stepMove(dt, this._speedMult());
      return;
    }
    this.working = true;
    this.faceTarget = Math.atan2(b.pos.x - this.pos.x, b.pos.z - this.pos.z);
    if (G.res.water > 0) {
      addRes('food', (b.def.foodPerMin / 60) * this.workMult() * dt);
      addRes('water', -(BALANCE.resources.consumptionPerMin.vegPatchWater / 60) * dt);
      this._fxT = (this._fxT ?? 0) - dt;
      if (this._fxT <= 0) { this._fxT = 2.2; FX.burst('sparkle', b.pos, { small: true }); }
    }
  }

  _water(dt) {
    if (!workAllowed()) { this._restBehavior(dt, true); return; }
    const spring = G.terrain.spring;
    if (this.carrying <= 0) {
      const d = dist2d(this.pos.x, this.pos.z, spring.x, spring.z);
      if (d > 4.2) {
        if (this.arrived) this.walkTo(spring.x + 2.5, spring.z + 2.5);
        this.stepMove(dt, this._speedMult());
        return;
      }
      this.working = true;
      this.stateT += dt;
      if (this.stateT > 2.2) {
        this.stateT = 0;
        this.carrying = RATES.waterPerTrip;
        AudioSys.play('water_fill', { vol: 0.5 });
        FX.burst('splash', new THREE.Vector3(spring.x, this.pos.y, spring.z));
      }
      return;
    }
    // deliver
    const store = findBuilding('water_tower')?.pos ?? findBuilding('campfire')?.pos ?? G.basePos ?? { x: 0, z: 0 };
    const d = dist2d(this.pos.x, this.pos.z, store.x, store.z);
    if (d > 3) {
      if (this.arrived) this.walkTo(store.x, store.z);
      this.stepMove(dt, this._speedMult() * 0.92);
      return;
    }
    if (G.res.water >= G.caps.water) { this._wanderT = 2; return; } // wait for room
    addRes('water', this.carrying);
    this.carrying = 0;
  }

  _build(dt) {
    if (!workAllowed()) { this._restBehavior(dt, true); return; }
    let site = this.workTarget;
    if (!site || !site.alive || site.state !== 'site') {
      site = nearestSite(this.pos.x, this.pos.z);
      this.workTarget = site;
      if (!site) { this.job = 'idle'; return; }
    }
    const d = dist2d(this.pos.x, this.pos.z, site.pos.x, site.pos.z);
    const reach = Math.max(site.w, site.h) * CELL * 0.5 + 1.6;
    if (d > reach) {
      if (this.arrived) this.walkTo(site.pos.x + (Math.random() - 0.5) * 3, site.pos.z + (Math.random() - 0.5) * 3);
      this.stepMove(dt, this._speedMult());
      return;
    }
    this.working = true;
    this.faceTarget = Math.atan2(site.pos.x - this.pos.x, site.pos.z - this.pos.z);
    site.addWork(dt * this.workMult());
    this._workFx(dt, 'dust', site, 'chop');
  }

  _runner(dt) {
    if (!workAllowed()) { this._restBehavior(dt, true); return; }
    const road = G.terrain.roadEntry;
    if (this.state !== 'tremp-wait' && this.state !== 'tremp-back') {
      const d = dist2d(this.pos.x, this.pos.z, road.x, road.z);
      if (d > 4) {
        if (this.arrived) this.walkTo(road.x, road.z);
        this.stepMove(dt, this._speedMult());
        return;
      }
      this.state = 'tremp-wait';
      this.stateT = 0;
    }
    if (this.state === 'tremp-wait') {
      this.stateT += dt;
      this.faceTarget = Math.atan2(-this.pos.x, -this.pos.z) + Math.PI; // face the road
      if (this.stateT >= RATES.junctionWaitS) {
        this.state = 'tremp-back';
        addRes('shekels', RATES.junctionTripShekels);
        AudioSys.play('coin');
        FX.burst('sparkle', this.pos);
        G.events.emit('junction-trip', { unit: this });
        const base = G.basePos ?? { x: 0, z: 0 };
        this.walkTo(base.x, base.z);
      }
      return;
    }
    if (this.state === 'tremp-back') {
      this.stepMove(dt, this._speedMult());
      if (this.arrived) this.state = 'idle'; // next tick walks to the road again
      return;
    }
  }

  _guardPatrol(dt) {
    const base = G.basePos ?? { x: 0, z: 0 };
    this._wanderT -= dt;
    if (this.arrived && this._wanderT <= 0) {
      this._wanderT = 2 + Math.random() * 3;
      const ang = Math.random() * Math.PI * 2;
      const r = G.time.isNight ? 13 + Math.random() * 6 : 8 + Math.random() * 5;
      this.walkTo(base.x + Math.cos(ang) * r, base.z + Math.sin(ang) * r);
    }
    this.stepMove(dt, G.time.isNight ? 0.8 : 0.6);
  }

  _shepherd(dt) {
    const pen = penInfo();
    const grazeHours = G.time.hour >= 7 && G.time.hour < 16.5 && !G.time.isShabbat;
    if (grazeHours && !G.flags.bell) {
      // pick / keep a grazing spot
      if (!this.grazeSpot || (this._grazeT ?? 0) <= 0) {
        this._grazeT = 35 + Math.random() * 25;
        const ang = Math.random() * Math.PI * 2;
        const r = 26 + Math.random() * 18;
        const gx = clamp(pen.x + Math.cos(ang) * r, -70, 70);
        const gz = clamp(pen.z + Math.sin(ang) * r, -70, 70);
        this.grazeSpot = { x: gx, z: gz };
        this.walkTo(gx, gz);
      }
      this._grazeT -= dt;
      this.stepMove(dt, 0.85);
      // flock production while grazing with >= 2 sheep near
      let near = 0;
      for (const s of G.flock) if (s.alive && dist2d(s.pos.x, s.pos.z, this.pos.x, this.pos.z) < 14) near++;
      if (near >= 2 && this.arrived) {
        this.working = false;
        const n = G.flock.length;
        const perMin = Math.max(0, RATES.flockBase + Math.max(0, n - RATES.flockBaseSheep) * RATES.flockPerExtraSheep) * (near / Math.max(n, 1));
        addRes('food', (perMin / 60) * dt);
      }
    } else {
      // return to pen area, stay close
      const d = dist2d(this.pos.x, this.pos.z, pen.x, pen.z);
      if (d > pen.r + 4) {
        if (this.arrived) this.walkTo(pen.x + 3, pen.z + 3);
        this.stepMove(dt, 0.95);
      } else {
        this._wanderT -= dt;
        if (this._wanderT <= 0 && this.arrived) {
          this._wanderT = 5 + Math.random() * 5;
          this.walkTo(pen.x + (Math.random() - 0.5) * 8, pen.z + (Math.random() - 0.5) * 8);
        }
        this.stepMove(dt, 0.5);
      }
      this.grazeSpot = null;
    }
  }

  onZeroHp() {
    // injured, never killed: falls, recovers next morning
    this.fallen = true;
    this.hp = 1;
    this.working = false;
    addRes('spirit', -2);
    G.events.emit('settler-injured', this);
    FX.burst('scare', this.pos);
  }

  recover() {
    if (!this.fallen) return;
    this.fallen = false;
    this.hp = this.maxHp;
  }
}

// ============================================================ Sheep
export class Sheep extends Entity {
  constructor(x, z, opts = {}) {
    super('sheep', x, z);
    this.selectable = false;
    this.type = opts.goat ? 'goat' : 'sheep';
    this.name = opts.name || pick('names_sheep');
    const st = BALANCE.units.sheep;
    this.hp = this.maxHp = st.hp;
    this.speed = st.speed;
    this.lamb = !!opts.lamb;
    this.state = 'pen';
    this._wanderT = Math.random() * 3;
    this._baaT = 5 + Math.random() * 25;
    this.pickY = 0.5;
    this.selectRadius = 0.7;
    this.spawn(this.type, { lamb: this.lamb, seed: this.id * 31 });
    G.flock.push(this);
  }

  update(dt) {
    this._baaT -= dt;
    if (this._baaT <= 0) {
      this._baaT = 14 + Math.random() * 30;
      AudioSys.play(this.type === 'goat' ? 'goat' : 'sheep', { vol: 0.25, pitch: this.lamb ? 1.4 : 0.85 + (this.id % 7) * 0.06 });
    }
    if (this.stolenBy) {
      // carried: follow the thief
      if (!this.stolenBy.alive || this.stolenBy.state === 'flee-dropped') { this.stolenBy = null; this.state = 'return'; }
      else { this.pos.x = this.stolenBy.pos.x + 0.4; this.pos.z = this.stolenBy.pos.z + 0.4; this.moving = true; return; }
    }
    const threat = nearestHostile(this.pos.x, this.pos.z, 7);
    const pen = penInfo();
    if (threat && threat.state !== 'flee') {
      // flee toward pen
      const dx = this.pos.x - threat.pos.x, dz = this.pos.z - threat.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const tx = clamp(this.pos.x + (dx / d) * 8 + (pen.x - this.pos.x) * 0.25, -76, 76);
      const tz = clamp(this.pos.z + (dz / d) * 8 + (pen.z - this.pos.z) * 0.25, -76, 76);
      if (this.arrived || (this._fleeT ?? 0) <= 0) { this._fleeT = 0.8; this.walkTo(tx, tz); }
      this._fleeT -= dt;
      this.stepMove(dt, 1.5);
      return;
    }
    // follow shepherd when grazing
    const shepherd = G.units.find(u => u.alive && u.job === 'shepherd' && u.grazeSpot);
    if (shepherd && !G.flags.bell && this.state !== 'return') {
      const d = dist2d(this.pos.x, this.pos.z, shepherd.pos.x, shepherd.pos.z);
      if (d > 6 + (this.id % 4)) {
        if (this.arrived || (this._followT ?? 0) <= 0) {
          this._followT = 1.2;
          this.walkTo(shepherd.pos.x + (Math.random() - 0.5) * 6, shepherd.pos.z + (Math.random() - 0.5) * 6);
        }
        this._followT -= dt;
        this.stepMove(dt, 1);
      } else {
        this._graze(dt);
      }
      return;
    }
    // otherwise head to / stay in pen
    const dPen = dist2d(this.pos.x, this.pos.z, pen.x, pen.z);
    if (dPen > pen.r) {
      if (this.arrived) this.walkTo(pen.x + (Math.random() - 0.5) * pen.r, pen.z + (Math.random() - 0.5) * pen.r);
      this.stepMove(dt, G.flags.bell ? 1.4 : 0.9);
    } else {
      this.state = 'pen';
      this._graze(dt);
    }
  }

  _graze(dt) {
    this._wanderT -= dt;
    if (this._wanderT <= 0 && this.arrived) {
      this._wanderT = 3 + Math.random() * 5;
      if (Math.random() < 0.6) this.walkTo(this.pos.x + (Math.random() - 0.5) * 5, this.pos.z + (Math.random() - 0.5) * 5);
    }
    this.stepMove(dt, 0.45);
    // grazing head-down pose
    const anim = this.mesh?.userData.anim;
    if (anim?.head && !this.moving) anim.head.rotation.x = 0.5;
  }

  onZeroHp() {
    addRes('spirit', BALANCE.units.sheep.spiritOnLoss);
    G.stats.unitsLost++;
    FX.burst('scare', this.pos);
    G.events.emit('sheep-lost', this);
    this.removeSelf();
  }
}

// ============================================================ Dog
export class Dog extends Entity {
  constructor(x, z, opts = {}) {
    super('dog', x, z);
    this.selectable = true;
    this.name = opts.name || pick('names_dogs');
    const st = BALANCE.units.dog;
    this.hp = this.maxHp = st.hp;
    this.speed = st.speed;
    this.pickY = 0.5;
    this.selectRadius = 0.7;
    this._barkT = 0;
    this.orderTarget = null;
    this.spawn('dog', { seed: this.id * 13 });
    G.units.push(this);
  }

  update(dt) {
    const st = BALANCE.units.dog;
    if (this.fallen) return;
    // ordered target first, else auto-intercept near pen/base/self
    let target = this.orderTarget && this.orderTarget.alive && this.orderTarget.state !== 'flee' ? this.orderTarget : null;
    if (!target) {
      this.orderTarget = null;
      const pen = penInfo();
      target = nearestHostile(pen.x, pen.z, 26) || nearestHostile(this.pos.x, this.pos.z, st.visionM)
        || (G.basePos ? nearestHostile(G.basePos.x, G.basePos.z, 24) : null);
    }
    if (target) {
      this.barking = true;
      this._barkT -= dt;
      if (this._barkT <= 0) { this._barkT = 1.6 + Math.random(); AudioSys.play('dog_bark', { vol: 0.5 }); }
      this.tryAttack(target, dt, st);
      return;
    }
    this.barking = false;
    if (this.state === 'ordered-move') {
      this.stepMove(dt, 1);
      if (this.arrived) this.state = 'idle';
      return;
    }
    // station: shepherd by day, pen at night
    const shepherd = G.units.find(u => u.alive && u.job === 'shepherd');
    const spot = (!G.time.isNight && shepherd) ? shepherd.pos : (() => { const p = penInfo(); return { x: p.x + 4, z: p.z + 4, y: 0 }; })();
    const d = dist2d(this.pos.x, this.pos.z, spot.x, spot.z);
    if (d > 6) {
      if (this.arrived || (this._followT ?? 0) <= 0) { this._followT = 1; this.walkTo(spot.x + 2, spot.z); }
      this._followT -= dt;
      this.stepMove(dt, 1);
    } else {
      this._wanderT = (this._wanderT ?? 0) - dt;
      if (this._wanderT <= 0 && this.arrived) {
        this._wanderT = 3 + Math.random() * 4;
        if (Math.random() < 0.5) this.walkTo(this.pos.x + (Math.random() - 0.5) * 5, this.pos.z + (Math.random() - 0.5) * 5);
      }
      this.stepMove(dt, 0.6);
    }
  }

  onZeroHp() {
    this.fallen = true;
    this.hp = 1;
    G.events.emit('dog-injured', this);
  }
  recover() { this.fallen = false; this.hp = this.maxHp; }
}

// ============================================================ Donkey
export class Donkey extends Entity {
  constructor(x, z, opts = {}) {
    super('donkey', x, z);
    this.selectable = true;
    this.name = opts.name || pick('names_donkeys');
    const st = BALANCE.units.donkey;
    this.hp = this.maxHp = st.hp;
    this.speed = st.speed;
    this.pickY = 0.8;
    this.job = 'idle'; // idle | water
    this.carrying = 0;
    this.stateT = 0;
    this._brayT = 20 + Math.random() * 40;
    this.spawn('donkey', {});
    G.units.push(this);
  }

  update(dt) {
    this._brayT -= dt;
    if (this._brayT <= 0) { this._brayT = 45 + Math.random() * 60; AudioSys.play('donkey', { vol: 0.4 }); }
    if (this.state === 'ordered-move') {
      this.stepMove(dt, 1);
      if (this.arrived) this.state = 'idle';
      return;
    }
    if (this.job === 'water' && workAllowed()) {
      const spring = G.terrain.spring;
      if (this.carrying <= 0) {
        const d = dist2d(this.pos.x, this.pos.z, spring.x, spring.z);
        if (d > 4.5) { if (this.arrived) this.walkTo(spring.x + 3, spring.z - 2); this.stepMove(dt, 1); return; }
        this.stateT += dt;
        if (this.stateT > 3.5) { this.stateT = 0; this.carrying = RATES.donkeyWaterPerTrip; AudioSys.play('water_fill', { vol: 0.5 }); }
        return;
      }
      const store = findBuilding('water_tower')?.pos ?? G.basePos ?? { x: 0, z: 0 };
      const d = dist2d(this.pos.x, this.pos.z, store.x, store.z);
      if (d > 3.5) { if (this.arrived) this.walkTo(store.x, store.z); this.stepMove(dt, 0.85); return; }
      if (G.res.water < G.caps.water) { addRes('water', this.carrying); this.carrying = 0; }
      return;
    }
    // idle graze near base
    this._wanderT = (this._wanderT ?? 0) - dt;
    if (this._wanderT <= 0 && this.arrived) {
      this._wanderT = 6 + Math.random() * 8;
      const base = G.basePos ?? { x: 0, z: 0 };
      this.walkTo(base.x + (Math.random() - 0.5) * 16, base.z + (Math.random() - 0.5) * 16);
    }
    this.stepMove(dt, 0.4);
  }

  onZeroHp() { this.fallen = true; this.hp = 1; }
  recover() { this.fallen = false; this.hp = this.maxHp; }
}

// ============================================================ tick all
export function updateUnits(dt) {
  const all = [...G.units, ...G.flock];
  for (const u of all) if (u.alive) u.update(dt);
  for (const u of all) if (u.alive) { u.separate(dt, all); u.animate(dt); }
}
