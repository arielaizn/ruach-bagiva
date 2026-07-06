// Canvas minimap: baked terrain, live entity dots, camera frustum, raid pings.
import { G } from '../core/state.js';
import { MAP_SIZE } from '../engine/terrain.js';
import { clamp } from '../core/util.js';

const SIZE = 188;

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = SIZE; canvas.height = SIZE;
    this.ctx = canvas.getContext('2d');
    this.baked = null;
    this.pings = []; // {angle, until}
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const mz = (e.clientY - rect.top) / rect.height;
      G.rig.flyTo((mx - 0.5) * MAP_SIZE, (mz - 0.5) * MAP_SIZE);
    });
    G.events.on('raid-warning', (w) => {
      for (const a of w.angles) this.pings.push({ angle: a, until: G.time.t + w.inS });
    });
    G.events.on('level-loaded', () => this.bake());
  }

  bake() {
    const t = G.terrain;
    if (!t?.heightMap) return;
    const off = document.createElement('canvas');
    off.width = SIZE; off.height = SIZE;
    const ctx = off.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    for (let py = 0; py < SIZE; py++) {
      for (let px = 0; px < SIZE; px++) {
        const wx = (px / SIZE - 0.5) * MAP_SIZE;
        const wz = (py / SIZE - 0.5) * MAP_SIZE;
        const h = t.heightAt(wx, wz);
        const slope = t.slopeAt(wx, wz);
        // simple shaded palette
        let r = 150 + h * 5, g = 140 + h * 4, b = 90 + h * 2;
        if (slope > 0.35) { r = 130 + h * 3; g = 124 + h * 3; b = 108; }
        const pd = t._distToPath(wx, wz);
        if (pd < 2.5) { r = 165; g = 135; b = 92; }
        const sd = Math.hypot(wx - t.spring.x, wz - t.spring.z);
        if (sd < 3.4) { r = 80; g = 140; b = 175; }
        const i = (py * SIZE + px) * 4;
        img.data[i] = clamp(r, 0, 255); img.data[i + 1] = clamp(g, 0, 255); img.data[i + 2] = clamp(b, 0, 255); img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.baked = off;
  }

  w2m(x, z) { return { x: (x / MAP_SIZE + 0.5) * SIZE, y: (z / MAP_SIZE + 0.5) * SIZE }; }

  update() {
    const ctx = this.ctx;
    if (!this.baked) { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, SIZE, SIZE); return; }
    ctx.drawImage(this.baked, 0, 0);
    // night tint
    if (G.time.isNight) { ctx.fillStyle = 'rgba(10,15,40,0.35)'; ctx.fillRect(0, 0, SIZE, SIZE); }

    // buildings
    for (const b of G.buildings) {
      const p = this.w2m(b.pos.x, b.pos.z);
      ctx.fillStyle = b.state === 'site' ? '#c9c9c9' : '#f0e6c8';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    // flock
    ctx.fillStyle = '#ffffff';
    for (const s of G.flock) {
      if (!s.alive) continue;
      const p = this.w2m(s.pos.x, s.pos.z);
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    // units
    for (const u of G.units) {
      if (!u.alive) continue;
      const p = this.w2m(u.pos.x, u.pos.z);
      ctx.fillStyle = u.kind === 'dog' ? '#e0b060' : '#7fd069';
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // hostiles
    ctx.fillStyle = '#ff5040';
    for (const h of G.hostiles) {
      if (!h.alive) continue;
      const p = this.w2m(h.pos.x, h.pos.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // raid pings at edges
    this.pings = this.pings.filter(p => p.until > G.time.t);
    const blink = Math.floor(G.time.t * 3) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ff3020';
      for (const p of this.pings) {
        const x = SIZE / 2 + Math.cos(p.angle) * (SIZE / 2 - 7);
        const y = SIZE / 2 + Math.sin(p.angle) * (SIZE / 2 - 7);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // camera target
    const c = this.w2m(G.rig.target.x, G.rig.target.z);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(c.x - 9, c.y - 7, 18, 14);
  }
}
