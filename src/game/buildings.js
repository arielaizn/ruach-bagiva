// Buildings: placement ghost, construction sites, finished structures,
// storage caps, housing, watchtower combat, generator light, campfire aura.
import * as THREE from 'three';
import { G, addRes, spend, canAfford } from '../core/state.js';
import { BALANCE } from './balance.js';
import { createModel } from './models.js';
import { disposeModel } from './model-helpers.js';
import { FX } from '../engine/fx.js';
import { AudioSys } from '../audio.js';
import { nextId, dist2d, clamp } from '../core/util.js';
import { CELL, MAP_SIZE } from '../engine/terrain.js';

const GHOST_OK = new THREE.MeshLambertMaterial({ color: 0x59c26a, transparent: true, opacity: 0.55 });
const GHOST_BAD = new THREE.MeshLambertMaterial({ color: 0xd9534f, transparent: true, opacity: 0.55 });

export class Building {
  constructor(typeId, cx, cz) {
    const def = BALANCE.buildings[typeId];
    this.id = nextId();
    this.kind = 'building';
    this.typeId = typeId;
    this.def = def;
    this.cx = cx; this.cz = cz;
    this.w = def.w; this.h = def.h;
    const wx = (cx + def.w / 2) * CELL - MAP_SIZE / 2;
    const wz = (cz + def.h / 2) * CELL - MAP_SIZE / 2;
    this.pos = new THREE.Vector3(wx, G.terrain.heightAt(wx, wz), wz);
    this.hp = def.hp; this.maxHp = def.hp;
    this.alive = true;
    this.selectable = false;
    this.pickY = 1.5;
    this.state = 'site';          // site -> done
    this.progress = 0;            // work-seconds
    this.graceT = 0;
    this.cooldown = 0;            // watchtower
    this.workers = new Set();     // farm slots
    this.lightObj = null;
    this.fxHandles = [];
    this.orderNotice = null;      // demolition
    // only the first caravan is the settlement's core
    this.isCore = !!def.core && !G.buildings.some(b => b.isCore && b.alive);
    if (typeId === 'sheep_pen') this._occupyPenPerimeter(true);
    else G.terrain.setOccupied(cx, cz, def.w, def.h, true);
    this._evictOccupants();
    this._spawnSiteMesh();
    G.buildings.push(this);
    G.events.emit('build-placed', this);
  }

  // anyone standing where the structure now stands gets gently pushed out
  _evictOccupants() {
    for (const u of [...G.units, ...G.flock]) {
      if (!u.alive || !u.pos) continue;
      const c = G.terrain.worldToCell(u.pos.x, u.pos.z);
      const inside = c.cx >= this.cx && c.cx < this.cx + this.w && c.cz >= this.cz && c.cz < this.cz + this.h;
      if (inside && !G.terrain.walkable(c.cx, c.cz)) {
        const n = G.terrain.findWalkableNear(u.pos.x, u.pos.z, 14);
        const w = G.terrain.cellToWorld(n.cx, n.cz);
        u.pos.x = w.x; u.pos.z = w.z;
        u.path = null; u.arrived = true;
      }
    }
  }

  // pen: fence ring blocks, interior stays walkable, gate gap on the front (+Z)
  _occupyPenPerimeter(val) {
    const { cx, cz, w, h } = this;
    for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) {
      const perimeter = dx === 0 || dz === 0 || dx === w - 1 || dz === h - 1;
      if (!perimeter) continue;
      const isGate = dz === h - 1 && (dx === Math.floor(w / 2) || dx === Math.floor(w / 2) - 1);
      if (isGate) continue;
      G.terrain.setOccupied(cx + dx, cz + dz, 1, 1, val);
    }
  }

  _spawnSiteMesh() {
    this.mesh = createModel('construction', { w: this.w * CELL, h: this.h * CELL });
    this._placeMesh();
  }

  _placeMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.faceRot ?? 0;
    this.mesh.userData.entity = this;
    this.mesh.traverse(o => { o.userData.entity = this; });
    G.scene.add(this.mesh);
  }

  addWork(sec) {
    if (this.state !== 'site') return;
    this.progress += sec;
    if (this.progress >= this.def.buildS) this.finish();
  }

  finish(silent = false) {
    this.state = 'done';
    G.scene.remove(this.mesh);
    disposeModel(this.mesh);
    this.mesh = createModel(this.typeId);
    // face roughly toward camp center for charm
    this.faceRot = Math.atan2((G.basePos?.x ?? 0) - this.pos.x, (G.basePos?.z ?? 0) - this.pos.z);
    if (this.typeId === 'fence') this.faceRot = this._fenceRot();
    this._placeMesh();
    this.graceT = BALANCE.buildingRules.newBuildingGraceS;
    recomputeCaps();
    if (!G.basePos) G.basePos = this.pos.clone();
    if (this.typeId === 'campfire') {
      this.fxHandles.push(FX.attach('fire', this.mesh));
      this._addLight(0xff8c3a, 1.6, 9, 1.1);
    }
    if (this.typeId === 'generator') this._addLight(0xffd98a, 0, BALANCE.buildings.generator.lightR, 2.6);
    if (this.typeId === 'zula') this._addLight(0xffc79a, 0, 6, 2.2);
    if (!silent) {
      G.stats.buildingsBuilt++;
      addRes('spirit', BALANCE.spirit.buildingComplete);
      AudioSys.play('build_done');
      FX.burst('buildDust', this.pos);
    }
    // the first structure on the hill gets the flag
    if (!G.flagpole) {
      const c = G.terrain.findWalkableNear(this.pos.x + 3, this.pos.z - 3, 8);
      const w = G.terrain.cellToWorld(c.cx, c.cz);
      const pole = createModel('flagpole');
      pole.position.set(w.x, G.terrain.heightAt(w.x, w.z), w.z);
      G.scene.add(pole);
      G.flagpole = pole;
    }
    G.events.emit('build-done', this);
  }

  _fenceRot() {
    // orient fence along neighboring fences
    for (const b of G.buildings) {
      if (b !== this && b.typeId === 'fence' && Math.abs(b.cz - this.cz) <= 0 && Math.abs(b.cx - this.cx) === 1) return Math.PI / 2;
    }
    return 0;
  }

  _addLight(color, intensity, dist, y) {
    this.lightObj = new THREE.PointLight(color, intensity, dist, 1.8);
    this.lightObj.position.set(0, y, 0);
    this.mesh.add(this.lightObj);
  }

  update(dt) {
    if (!this.alive) return;
    if (this.graceT > 0) this.graceT -= dt;
    if (this.state !== 'done') return;

    // campfire flicker + evening aura
    if (this.typeId === 'campfire' && this.lightObj) {
      this.lightObj.intensity = 1.4 + Math.sin(G.time.t * 9 + this.id) * 0.35;
    }
    // generator light at night
    if (this.typeId === 'generator' && this.lightObj) {
      const on = G.time.isNight && !G.time.isShabbat;
      this.lightObj.intensity = on ? 2.6 : 0;
    }
    if (this.typeId === 'zula' && this.lightObj) this.lightObj.intensity = G.time.isNight ? 1.1 : 0;

    // watchtower: ranged courage-draining shots
    if (this.typeId === 'watchtower') {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        const def = this.def;
        let best = null, bd = def.rangeM;
        for (const h of G.hostiles) {
          if (!h.alive || h.state === 'flee') continue;
          const d = dist2d(this.pos.x, this.pos.z, h.pos.x, h.pos.z);
          if (d < bd) { bd = d; best = h; }
        }
        if (best) {
          this.cooldown = def.cooldownS;
          best.damage(def.damage, this);
          best.drainCourage(def.courageDrainPerHit);
          AudioSys.play('sling', { vol: 0.5 });
          FX.burst('hit', best.pos);
        }
      }
    }
  }

  damage(n, source) {
    if (!this.alive || this.state !== 'done') { this.progress = Math.max(0, this.progress - n * 0.4); return; }
    this.hp -= n;
    if (this.hp <= 0) this.destroy(false);
    else if (this.hp < this.maxHp * 0.5 && !this._smoked) {
      this._smoked = true;
      this.fxHandles.push(FX.attach('smoke', this.mesh));
    }
  }

  destroy(silent) {
    if (!this.alive) return;
    this.alive = false;
    for (const hnd of this.fxHandles) FX.detach(hnd);
    if (this.typeId === 'sheep_pen') this._occupyPenPerimeter(false);
    else G.terrain.setOccupied(this.cx, this.cz, this.w, this.h, false);
    G.scene.remove(this.mesh);
    G.buildings = G.buildings.filter(b => b !== this);
    recomputeCaps();
    if (!silent) {
      FX.burst('buildDust', this.pos, { big: true });
      addRes('spirit', BALANCE.spirit.structureDestroyed);
      AudioSys.play('demolition', { vol: 0.6 });
      G.events.emit('structure-destroyed', this);
      if (this.isCore) G.events.emit('core-destroyed', this);
    }
    G.events.emit('buildings-changed', {});
  }

  dismantle(refundFrac = BALANCE.buildingRules.dismantleRefundFrac) {
    for (const k in this.def.cost) addRes(k, Math.floor(this.def.cost[k] * refundFrac));
    this.destroy(true);
    FX.burst('dust', this.pos, { big: true });
    G.events.emit('buildings-changed', {});
  }
}

export function recomputeCaps() {
  const base = BALANCE.resources.baseCaps;
  const caps = { ...base };
  let popMax = 2; // the founders manage without a roof
  for (const b of G.buildings) {
    if (b.state !== 'done') continue;
    if (b.def.pop) popMax += b.def.pop;
    if (b.def.capBonus) for (const k in b.def.capBonus) caps[k] += b.def.capBonus[k];
    if (b.def.waterCap) caps.water += b.def.waterCap;
  }
  G.caps = caps;
  G.pop.max = popMax;
  // losing storage clamps stock immediately (visible, attributable)
  for (const k of ['wood', 'stone', 'food', 'water']) {
    if (G.res[k] > caps[k]) G.res[k] = caps[k];
  }
  G.events.emit('pop-changed', G.pop);
  G.events.emit('res-changed', {});
}

export const findBuilding = (typeId, done = true) =>
  G.buildings.find(b => b.typeId === typeId && (!done || b.state === 'done'));
export const buildingsOf = (typeId, done = true) =>
  G.buildings.filter(b => b.typeId === typeId && (!done || b.state === 'done'));
export const nearestBuilding = (x, z, filter) => {
  let best = null, bd = 1e9;
  for (const b of G.buildings) {
    if (!b.alive || (filter && !filter(b))) continue;
    const d = dist2d(x, z, b.pos.x, b.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
};
export const nearestSite = (x, z) => nearestBuilding(x, z, b => b.state === 'site');

// The pen: sheep home area
export function penInfo() {
  const pen = findBuilding('sheep_pen');
  if (pen) return { x: pen.pos.x, z: pen.pos.z, r: pen.w * CELL * 0.42, pen };
  const base = G.basePos ?? { x: 0, z: 0 };
  return { x: base.x, z: base.z, r: 6, pen: null };
}

// ---------------- placement ----------------
export function initPlacementActions() {
  G.actions.startPlacement = (typeId) => {
    cancelGhost();
    const def = BALANCE.buildings[typeId];
    if (!def) return;
    const ghost = createModel(typeId);
    ghost.traverse(o => { if (o.isMesh) { o.material = GHOST_OK; o.castShadow = false; } });
    G.scene.add(ghost);
    ghost.visible = false;
    G.placement = { typeId, def, ghost, cx: -1, cz: -1, valid: false };
    G.events.emit('placement-changed', G.placement);
  };

  G.actions.movePlacement = (x, z) => {
    const p = G.placement;
    if (!p) return;
    const cx = Math.round((x + MAP_SIZE / 2) / CELL - p.def.w / 2);
    const cz = Math.round((z + MAP_SIZE / 2) / CELL - p.def.h / 2);
    p.cx = cx; p.cz = cz;
    p.valid = G.terrain.buildable(cx, cz, p.def.w, p.def.h) && canAfford(p.def.cost);
    const wx = (cx + p.def.w / 2) * CELL - MAP_SIZE / 2;
    const wz = (cz + p.def.h / 2) * CELL - MAP_SIZE / 2;
    p.ghost.visible = true;
    p.ghost.position.set(wx, G.terrain.heightAt(wx, wz), wz);
    const mat = p.valid ? GHOST_OK : GHOST_BAD;
    p.ghost.traverse(o => { if (o.isMesh) o.material = mat; });
  };

  G.actions.confirmPlacement = (keep) => {
    const p = G.placement;
    if (!p || !p.valid) { if (p && !p.valid) AudioSys.play('click', { pitch: 0.6 }); return; }
    if (!spend(p.def.cost)) return;
    const b = new Building(p.typeId, p.cx, p.cz);
    AudioSys.play('build_place');
    FX.burst('dust', b.pos);
    // send nearest idle/builder settlers; if everyone is employed, pull a worker
    let builders = G.units
      .filter(u => u.kind === 'settler' && u.alive && !u.fallen && (u.job === 'build' || u.job === 'idle'))
      .sort((a, c) => a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos))
      .slice(0, 2);
    if (!builders.length) {
      builders = G.units
        .filter(u => u.kind === 'settler' && u.alive && !u.fallen && !['guard', 'shepherd'].includes(u.job))
        .sort((a, c) => a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos))
        .slice(0, 1);
    }
    for (const u of builders) { if (u.job !== 'build') u._returnJob = u.job; u.setJob('build'); u.workTarget = b; }
    if (keep && (p.def.fence || canAfford(p.def.cost))) {
      G.actions.movePlacement(b.pos.x, b.pos.z);
    } else {
      cancelGhost();
      G.events.emit('placement-changed', null);
    }
  };

  G.actions.cancelPlacement = () => {
    cancelGhost();
    G.events.emit('placement-changed', null);
  };

  G.actions.dismantle = (b) => {
    if (b?.kind === 'building' && b.alive) {
      // dismantling the demolition-order target counts as resolving the order
      const d = G.director?.demolition;
      if (d && d.building === b && (d.state === 'active' || d.state === 'arriving')) {
        if (d.state === 'arriving') d.state = 'active'; // allow early resolution
        G.director.resolveDemolitionDismantle();
      } else {
        b.dismantle();
      }
      G.actions.select(G.selection.filter(e => e !== b));
    }
  };
}

function cancelGhost() {
  if (G.placement?.ghost) { G.scene.remove(G.placement.ghost); disposeModel(G.placement.ghost); }
  G.placement = null;
}

export function updateBuildings(dt) {
  for (const b of [...G.buildings]) b.update(dt);
  const flag = G.flagpole?.userData.anim?.flag;
  if (flag) {
    flag.rotation.y = Math.sin(G.time.t * 1.9) * 0.16 + Math.sin(G.time.t * 3.1) * 0.05;
  }
}
