// RTS camera rig: isometric-style default view with a smooth blend to a low,
// close cinematic view. Pan (WASD/edge/drag), rotate (Q/E or middle-drag),
// zoom (wheel). Pitch eases down automatically as you zoom in.
import * as THREE from 'three';
import { clamp, lerp, damp, angleLerp } from '../core/util.js';
import { MAP_SIZE } from './terrain.js';

const ISO = { dist: 62, pitch: THREE.MathUtils.degToRad(54), fov: 38 };
const CLOSE = { dist: 16, pitch: THREE.MathUtils.degToRad(24), fov: 50 };
const MIN_DIST = 9, MAX_DIST = 110;

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(ISO.fov, aspect, 0.5, 900);
    this.target = new THREE.Vector3(0, 0, 0);   // point on ground we look at
    this.yaw = Math.PI * 0.25;
    this.dist = ISO.dist;
    this.mode = 'iso';                           // 'iso' | 'close'
    // smoothed values
    this._target = this.target.clone();
    this._yaw = this.yaw;
    this._dist = this.dist;
    this._shake = 0;
    this.terrain = null;
    this._tmp = new THREE.Vector3();
    this.updateTransform(0.016);
  }

  setTerrain(terrain) { this.terrain = terrain; }

  toggleMode() {
    this.mode = this.mode === 'iso' ? 'close' : 'iso';
    this.dist = this.mode === 'iso' ? ISO.dist : CLOSE.dist;
    return this.mode;
  }
  setMode(mode) {
    if (mode !== this.mode) this.toggleMode();
  }

  // 0 at iso distances -> 1 fully close; drives pitch + fov blend
  get closeness() {
    return clamp(1 - (this._dist - MIN_DIST) / (ISO.dist * 0.75 - MIN_DIST), 0, 1);
  }

  pan(dx, dz, dt) {
    // move target in camera-yaw space; speed scales with zoom
    const spd = (12 + this._dist * 0.9) * dt;
    const sin = Math.sin(this._yaw), cos = Math.cos(this._yaw);
    this.target.x += (dx * cos - dz * sin) * spd;
    this.target.z += (dx * sin + dz * cos) * spd;
    const lim = MAP_SIZE / 2 - 4;
    this.target.x = clamp(this.target.x, -lim, lim);
    this.target.z = clamp(this.target.z, -lim, lim);
  }

  rotate(d) { this.yaw += d; }
  zoom(delta) {
    this.dist = clamp(this.dist * (delta > 0 ? 1.12 : 0.89), MIN_DIST, MAX_DIST);
    // auto mode bookkeeping: crossing thresholds flips the label/UI
    if (this.dist < 24 && this.mode === 'iso') this.mode = 'close';
    if (this.dist > 34 && this.mode === 'close') this.mode = 'iso';
  }

  jumpTo(x, z) { this.target.set(x, 0, z); }
  flyTo(x, z) { this.target.set(x, 0, z); } // smoothing handles the glide

  shake(amount = 0.6) { this._shake = Math.max(this._shake, amount); }

  updateTransform(dt) {
    const k = damp(6, dt);
    this._target.lerp(this.target, k);
    this._yaw = angleLerp(this._yaw, this.yaw, damp(8, dt));
    this._dist = lerp(this._dist, this.dist, damp(7, dt));
    this._shake = Math.max(0, this._shake - dt * 2.2);

    const c = this.closeness;
    const pitch = lerp(ISO.pitch, CLOSE.pitch, c);
    const fov = lerp(ISO.fov, CLOSE.fov, c);
    if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    const groundY = this.terrain ? this.terrain.heightAt(this._target.x, this._target.z) : 0;
    const ty = groundY + lerp(0.5, 1.6, c);

    const horiz = Math.cos(pitch) * this._dist;
    const vert = Math.sin(pitch) * this._dist;
    const cx = this._target.x - Math.sin(this._yaw) * horiz;
    const cz = this._target.z - Math.cos(this._yaw) * horiz;
    let cy = ty + vert;
    // keep camera above terrain when close
    if (this.terrain) cy = Math.max(cy, this.terrain.heightAt(cx, cz) + 2.2);
    if (this._shake > 0) {
      const s = this._shake * this._shake;
      cy += (Math.random() - 0.5) * s;
      this.camera.position.set(cx + (Math.random() - 0.5) * s, cy, cz + (Math.random() - 0.5) * s);
    } else {
      this.camera.position.set(cx, cy, cz);
    }
    this._tmp.set(this._target.x, ty, this._target.z);
    this.camera.lookAt(this._tmp);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
