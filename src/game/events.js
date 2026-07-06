// Event director: telegraphed raids, the demolition-order drama (jeep,
// notice, supporter bus, bulldozer), weather, hitchhiker volunteers.
import * as THREE from 'three';
import { G, addRes } from '../core/state.js';
import { BALANCE } from './balance.js';
import { Wave } from './hostiles.js';
import { Entity, Settler } from './units.js';
import { createModel } from './models.js';
import { FX } from '../engine/fx.js';
import { AudioSys } from '../audio.js';
import { dist2d, lerp, clamp } from '../core/util.js';
import { findBuilding, nearestBuilding } from './buildings.js';

export const DIR_ANGLES = {
  E: 0, NE: -Math.PI / 4, N: -Math.PI / 2, NW: -Math.PI * 3 / 4,
  W: Math.PI, SW: Math.PI * 3 / 4, S: Math.PI / 2, SE: Math.PI / 4,
};

// ---------------------------------------------------------- prop vehicles
class PropVehicle {
  // drives from the road entry along the dirt path toward the plateau and back
  constructor(modelType, stopAtT = 0.75) {
    this.mesh = createModel(modelType);
    this.pts = G.terrain.pathPts;
    this.t = 0;
    this.stopAtT = stopAtT;
    this.state = 'in';       // in | parked | out | gone
    this.speed = 0.045;
    G.scene.add(this.mesh);
    this._place(0);
    AudioSys.play('bus_arrive', { vol: 0.3 });
  }
  _place(t) {
    const n = this.pts.length - 1;
    const f = clamp(t, 0, 1) * n;
    const i = Math.min(Math.floor(f), n - 1);
    const u = f - i;
    const x = lerp(this.pts[i].x, this.pts[i + 1].x, u);
    const z = lerp(this.pts[i].z, this.pts[i + 1].z, u);
    this.mesh.position.set(x, G.terrain.heightAt(x, z) + 0.05, z);
    const dx = this.pts[i + 1].x - this.pts[i].x, dz = this.pts[i + 1].z - this.pts[i].z;
    this.mesh.rotation.y = Math.atan2(dx, dz) + (this.state === 'out' ? Math.PI : 0);
    const wheels = this.mesh.userData.anim?.wheels;
    if (wheels && this.state !== 'parked') for (const w of wheels) w.rotation.x += 0.2;
    const beacon = this.mesh.userData.anim?.beacon;
    if (beacon) beacon.visible = Math.floor(G.time.t * 4) % 2 === 0;
  }
  update(dt) {
    if (this.state === 'in') {
      this.t += this.speed * dt * 60 * 0.016;
      if (this.t >= this.stopAtT) { this.state = 'parked'; this.parkedAt = G.time.t; }
      this._place(this.t);
    } else if (this.state === 'out') {
      this.t -= this.speed * dt * 60 * 0.016;
      this._place(this.t);
      if (this.t <= 0) { this.state = 'gone'; G.scene.remove(this.mesh); }
    } else if (this.state === 'parked') {
      this._place(this.t);
    }
  }
  leave() { if (this.state !== 'gone') this.state = 'out'; }
  get pos() { return this.mesh.position; }
}

// ---------------------------------------------------------- supporters
class Supporter extends Entity {
  constructor(x, z, target) {
    super('supporter', x, z);
    this.hp = this.maxHp = 50;
    this.speed = 3;
    this.target = target;
    this.state = 'walk';
    this.spawn('supporter', { seed: this.id * 5 });
    this.walkTo(target.pos.x + (Math.random() - 0.5) * 6, target.pos.z + (Math.random() - 0.5) * 6);
    G.units.push(this);
  }
  update(dt) {
    if (this.state === 'walk') {
      this.stepMove(dt, 1);
      if (this.arrived) this.state = 'sit';
    } else if (this.state === 'leave') {
      this.stepMove(dt, 1);
      if (this.arrived) this.removeSelf();
    } else {
      // sit and sing by the structure
      this._wanderT = (this._wanderT ?? 0) - dt;
      if (this._wanderT <= 0 && this.arrived) {
        this._wanderT = 6 + Math.random() * 8;
        if (Math.random() < 0.3 && this.target?.alive)
          this.walkTo(this.target.pos.x + (Math.random() - 0.5) * 7, this.target.pos.z + (Math.random() - 0.5) * 7);
      }
      this.stepMove(dt, 0.4);
    }
  }
  goHome() {
    this.state = 'leave';
    const r = G.terrain.roadEntry;
    this.walkTo(r.x, r.z);
  }
}

// ---------------------------------------------------------- director
export class EventDirector {
  constructor() {
    this.pendingWaves = [];   // {atT, budget, palette, dirs[], warned}
    this.props = [];
    this.demolition = null;
    this.weather = null;
    this.hitchhikerT = BALANCE.recruit.hitchhikerEveryDays * BALANCE.time.dayLength * (0.6 + Math.random() * 0.5);
    this.freePlay = null;     // set by level runner for endless mode
    this._fpNuisanceD = 0;
    this._fpBigD = 0;
    this._fpBigN = 0;
    G.director = this;
  }

  // schedule a wave `telegraphS` before it lands
  scheduleWave({ delayS = 0, budget, palette, dirs = ['E'], telegraphS = BALANCE.waves.telegraphS }) {
    const angles = dirs.map(d => typeof d === 'number' ? d : (DIR_ANGLES[d] ?? Math.random() * Math.PI * 2));
    this.pendingWaves.push({
      atT: G.time.t + delayS + telegraphS,
      warnAtT: G.time.t + delayS,
      budget, palette, angles, warned: false,
    });
  }

  startDemolition(targetTypeId = 'sheep_pen') {
    if (this.demolition && this.demolition.state !== 'resolved') return;
    let b = findBuilding(targetTypeId) || nearestBuilding(0, 0, x => x.state === 'done' && !x.def.core && x.typeId !== 'fence' && x.typeId !== 'campfire');
    if (!b) return;
    const jeep = new PropVehicle('jeep', 0.8);
    this.props.push(jeep);
    this.demolition = {
      state: 'arriving', building: b, jeep,
      daysLeft: BALANCE.demolition.countdownDays,
      supporters: [],
    };
  }

  resolveDemolitionDismantle() {
    const d = this.demolition;
    if (!d || d.state !== 'active') return false;
    d.building.orderMesh && d.building.mesh.remove(d.building.orderMesh);
    d.building.dismantle(BALANCE.demolition.dismantleRefundFrac);
    addRes('spirit', BALANCE.spirit.selfDismantle);
    this._endDemolition('dismantled');
    return true;
  }

  musterSupporters() {
    const d = this.demolition;
    if (!d || d.state !== 'active') return false;
    if (G.spirit < BALANCE.demolition.muster.minSpirit) return false;
    addRes('spirit', -BALANCE.demolition.muster.spiritCost);
    d.state = 'mustering';
    d.busAtT = G.time.t + BALANCE.demolition.muster.busArrivesAfterS;
    G.events.emit('demolition-update', d);
    AudioSys.play('coin', { vol: 0.4 });
    return true;
  }

  _endDemolition(outcome) {
    const d = this.demolition;
    d.state = 'resolved';
    d.outcome = outcome;
    d.jeep?.leave();
    d.bus?.leave();
    d.dozer?.leave();
    // the notice comes off the wall in every outcome
    if (d.building?.orderMesh) { d.building.mesh?.remove(d.building.orderMesh); d.building.orderMesh = null; }
    // on victory the supporters stay a few days (onDayStart sends them home)
    if (outcome !== 'frozen') for (const s of d.supporters) s.goHome();
    if (outcome === 'frozen') addRes('spirit', BALANCE.demolition.muster.victorySpirit);
    G.flags.demolitionOutcome = outcome;
    G.events.emit('demolition-resolved', { outcome });
  }

  startWeather(type) {
    this.weather = { type, until: G.time.t + BALANCE.time.dayLength * 0.35 };
    if (type === 'rain' || type === 'yoreh') {
      FX.weather('rain');
      G.env.setDim(0.35);
      AudioSys.play('rain_start');
      addRes('water', 15);
      if (type === 'yoreh') { addRes('spirit', 10); AudioSys.play('yoreh'); }
    }
    if (type === 'sharav') { G.env.setDim(0.12); G.flags.sharav = true; }
    G.events.emit('weather', type);
  }

  update(dt) {
    // waves
    for (const w of this.pendingWaves) {
      if (!w.warned && G.time.t >= w.warnAtT) {
        w.warned = true;
        AudioSys.play('shofar');
        AudioSys.duckFor(3);
        G.events.emit('raid-warning', { angles: w.angles, inS: w.atT - G.time.t, budget: w.budget });
      }
    }
    const due = this.pendingWaves.filter(w => G.time.t >= w.atT);
    if (due.length) {
      this.pendingWaves = this.pendingWaves.filter(w => !due.includes(w));
      for (const w of due) new Wave(w.budget, w.palette, w.angles).spawn();
    }

    // props
    for (const p of this.props) p.update(dt);
    this.props = this.props.filter(p => p.state !== 'gone');

    // demolition machine
    const d = this.demolition;
    if (d && d.state !== 'resolved') this._updateDemolition(d, dt);

    // weather
    if (this.weather && G.time.t >= this.weather.until) {
      if (this.weather.type !== 'sharav') FX.weather(null);
      G.env.setDim(0);
      G.flags.sharav = false;
      this.weather = null;
      G.events.emit('weather', null);
    }

    // hitchhikers (free settlers when spirit is high and there's housing)
    this.hitchhikerT -= dt;
    if (this.hitchhikerT <= 0) {
      const blocked = G.time.isShabbat || G.time.isNight || G.spirit < BALANCE.recruit.minSpirit || G.pop.cur >= G.pop.max;
      if (blocked) {
        // conditions not met right now — retry soon instead of losing the roll
        this.hitchhikerT = BALANCE.time.dayLength * 0.25;
      } else {
        const speedUp = G.spirit >= 80 ? 0.6 : 1; // high spirit draws people up the hill
        this.hitchhikerT = BALANCE.recruit.hitchhikerEveryDays * BALANCE.time.dayLength * (0.7 + Math.random() * 0.6) * speedUp;
      }
      if (!blocked) {
        const r = G.terrain.roadEntry;
        const s = new Settler(r.x, r.z, {});
        s.state = 'ordered-move';
        const base = G.basePos ?? { x: 0, z: 0 };
        s.walkTo(base.x, base.z);
        G.pop.cur++;
        addRes('spirit', BALANCE.spirit.newSettler);
        G.events.emit('alert', { type: 'good', textKey: 'ev_hitchhiker', vars: { name: s.name } });
        G.events.emit('pop-changed', G.pop);
      }
    }

    // free-play endless scheduler
    if (this.freePlay) this._updateFreePlay();
  }

  _updateDemolition(d, dt) {
    if (!d.building.alive && d.state !== 'resolved') { this._endDemolition('destroyed'); return; }
    switch (d.state) {
      case 'arriving':
        if (d.jeep.state === 'parked') {
          d.state = 'active';
          d.servedDay = G.time.day;
          addRes('spirit', BALANCE.demolition.arrivalSpirit);
          AudioSys.play('demolition');
          // pin the notice on the building
          d.building.orderMesh = createModel('orderNotice');
          d.building.orderMesh.position.set(0, 0, d.building.h + 0.4);
          d.building.mesh.add(d.building.orderMesh);
          G.events.emit('demolition-served', d);
          G.events.emit('alert', { type: 'bad', textKey: 'ev_demolition_served' });
          d.jeepLeaveT = G.time.t + 12;
        }
        break;
      case 'active':
        if (d.jeepLeaveT && G.time.t >= d.jeepLeaveT) { d.jeep.leave(); d.jeepLeaveT = 0; }
        if (d.daysLeft <= 0) {
          d.state = 'executing';
          d.dozer = new PropVehicle('bulldozer', 0.72);
          this.props.push(d.dozer);
          G.events.emit('alert', { type: 'bad', textKey: 'ev_dozer_coming' });
        }
        break;
      case 'mustering':
        if (G.time.t >= d.busAtT && !d.bus) {
          d.bus = new PropVehicle('bus', 0.7);
          this.props.push(d.bus);
        }
        if (d.bus?.state === 'parked' && !d.supportersSpawned) {
          d.supportersSpawned = true;
          for (let i = 0; i < 8; i++) {
            const s = new Supporter(d.bus.pos.x + (Math.random() - 0.5) * 3, d.bus.pos.z + (Math.random() - 0.5) * 3, d.building);
            d.supporters.push(s);
          }
          AudioSys.play('bus_arrive');
          G.events.emit('alert', { type: 'good', textKey: 'ev_bus_arrived' });
          d.frozenAtT = G.time.t + 10;
        }
        if (d.supportersSpawned && G.time.t >= d.frozenAtT) this._endDemolition('frozen');
        break;
      case 'executing':
        if (d.dozer?.state === 'parked') {
          d.execT = (d.execT ?? 6) - dt;
          G.rig.shake(0.12);
          if (d.execT <= 0) {
            d.building.orderMesh && d.building.mesh.remove(d.building.orderMesh);
            d.building.destroy(false);
            addRes('spirit', BALANCE.demolition.ignored.spirit - BALANCE.spirit.structureDestroyed); // total -20 incl. destroy
            this._endDemolition('demolished');
          }
        }
        break;
    }
  }

  onDayStart() {
    const d = this.demolition;
    if (d && d.state === 'active' && !G.time.isShabbat) {
      d.daysLeft -= 1;
      G.events.emit('demolition-update', d);
    }
    // supporters go home two days after freeze
    if (d && d.state === 'resolved' && d.outcome === 'frozen' && d.supporters.length && G.time.day > (d.servedDay ?? 0) + 3) {
      for (const s of d.supporters) s.goHome();
      d.supporters = [];
    }
  }

  _updateFreePlay() {
    const fp = this.freePlay;
    const day = G.time.day;
    if (day !== this._fpLastDay) {
      this._fpLastDay = day;
      if (G.time.isShabbat) return;
      const week = Math.floor((day - 1) / 7);
      const wavesB = BALANCE.waves.freePlay;
      if (day % wavesB.bigRaidEveryDays === 0 && day > 4) {
        this._fpBigN++;
        const budget = Math.round(wavesB.bigRaid(this._fpBigN) * fp.difficulty);
        const dirs = budget > 19 ? ['S', 'NE', 'W'] : budget > 9 ? ['S', 'NE'] : ['S'];
        this.scheduleWave({ delayS: BALANCE.time.dayLength * 0.62, budget, palette: this._fpPalette(true), dirs, telegraphS: 90 });
        G.events.emit('alert', { type: 'warn', textKey: 'ev_big_raid_rumor' });
      } else if (day % wavesB.nuisanceEveryDays === 0 && day > 2) {
        const budget = Math.round(wavesB.nuisance(week) * fp.difficulty);
        this.scheduleWave({ delayS: BALANCE.time.dayLength * (0.55 + Math.random() * 0.25), budget, palette: this._fpPalette(false), dirs: [Math.random() * Math.PI * 2] });
      }
      // occasional weather
      if (Math.random() < 0.15) this.startWeather(Math.random() < 0.7 ? 'rain' : 'sharav');
      // occasional demolition drama
      if (fp.demolition && day > 10 && Math.random() < 0.08 && (!this.demolition || this.demolition.state === 'resolved')) {
        this.startDemolition();
      }
    }
  }

  _fpPalette(big) {
    const pop = G.units.filter(u => u.kind === 'settler').length;
    const pool = ['jackal', 'wolf'];
    if (G.flock.length >= 6) pool.push('thief');
    if (G.buildings.some(b => b.def.crops || b.def.foodPerMin)) pool.push('boar');
    if (big && pop >= 6) pool.push('raider');
    if (big && pop >= 9) pool.push('leader');
    return pool;
  }
}
