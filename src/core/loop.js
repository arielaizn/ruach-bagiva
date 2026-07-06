// Main loop: clamped-dt simulation with speed multiplier + render.
import { G, tickTime } from './state.js';

export class Loop {
  constructor(renderer, scene, rig) {
    this.renderer = renderer;
    this.scene = scene;
    this.rig = rig;
    this.systems = [];      // fns (dt) called only while a level runs & not paused
    this.always = [];       // fns (dt, rawDt) called every frame (camera, fx, ui)
    this._last = performance.now();
    this._raf = null;
    this.fps = 60;
  }

  addSystem(fn) { this.systems.push(fn); }
  addAlways(fn) { this.always.push(fn); }

  start() {
    if (this._raf) return;
    this._last = performance.now();
    const frame = (now) => {
      this._raf = requestAnimationFrame(frame);
      let raw = (now - this._last) / 1000;
      this._last = now;
      raw = Math.min(raw, 0.05);
      this.fps = this.fps * 0.95 + (1 / Math.max(raw, 0.001)) * 0.05;

      const speed = G.time.paused ? 0 : G.time.speed;
      // sub-step so fast-forward stays stable
      if (G.running && speed > 0) {
        const step = raw;
        for (let i = 0; i < speed; i++) {
          tickTime(step);
          for (const fn of this.systems) fn(step);
        }
      }
      for (const fn of this.always) fn(raw * (speed || 1), raw);
      this.rig.updateTransform(raw);
      this.renderer.render(this.scene, this.rig.camera);
    };
    this._raf = requestAnimationFrame(frame);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
}
