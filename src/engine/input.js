// RTS input: click/drag selection, right-click context orders, camera control,
// build-placement mode, control groups, keyboard shortcuts.
import * as THREE from 'three';

const EDGE = 12;          // px edge-pan margin
const DRAG_MIN = 6;       // px before a click becomes a drag

export class Input {
  constructor(canvas, rig, G) {
    this.canvas = canvas;
    this.rig = rig;
    this.G = G;
    this.keys = new Set();
    this.mouse = { x: -1e4, y: -1e4, inside: false };
    this.drag = null;        // {x0,y0,x1,y1, button}
    this.raycaster = new THREE.Raycaster();
    this.groups = new Map(); // control groups 1..9
    this.edgePanEnabled = true;
    this._ndc = new THREE.Vector2();
    this._downPos = null;

    this.selBox = document.getElementById('selbox');

    canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    window.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.G.ui?.modalOpen) return;
      const prevMode = this.rig.mode;
      this.rig.zoom(e.deltaY);
      if (this.rig.mode !== prevMode) this.G.events.emit('camera-mode', this.rig.mode);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    document.addEventListener('mouseenter', () => { this.mouse.inside = true; });

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
  }

  // ---------- pointer ----------
  _onDown(e) {
    if (this.G.ui?.modalOpen) return;
    this.canvas.focus?.();
    this._downPos = { x: e.clientX, y: e.clientY, button: e.button };
    if (e.button === 1) { e.preventDefault(); this._rotating = true; this._lastRX = e.clientX; }
  }

  _onMove(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
    if (this._rotating) {
      this.rig.rotate((e.clientX - this._lastRX) * 0.008);
      this._lastRX = e.clientX;
      return;
    }
    if (this._downPos && this._downPos.button === 0 && !this.G.placement) {
      const dx = e.clientX - this._downPos.x, dy = e.clientY - this._downPos.y;
      if (this.drag || Math.hypot(dx, dy) > DRAG_MIN) {
        this.drag = { x0: this._downPos.x, y0: this._downPos.y, x1: e.clientX, y1: e.clientY };
        this._showSelBox();
      }
    }
    if (this.G.placement) {
      const hit = this.groundHit(e.clientX, e.clientY);
      if (hit) this.G.actions.movePlacement(hit.x, hit.z);
    }
  }

  _onUp(e) {
    if (e.button === 1) { this._rotating = false; return; }
    const down = this._downPos;
    this._downPos = null;

    if (this.drag) {
      const rect = this.drag;
      this.drag = null;
      this._hideSelBox();
      this._selectInRect(rect, e.shiftKey);
      return;
    }
    if (!down) return;
    if (this.G.ui?.modalOpen) return;
    if (e.target !== this.canvas) return;

    if (e.button === 0) {
      if (this.G.placement) { this.G.actions.confirmPlacement(e.shiftKey); return; }
      this._clickSelect(e.clientX, e.clientY, e.shiftKey);
    } else if (e.button === 2) {
      if (this.G.placement) { this.G.actions.cancelPlacement(); return; }
      this._contextOrder(e.clientX, e.clientY, e.shiftKey);
    }
  }

  _showSelBox() {
    const d = this.drag, el = this.selBox;
    if (!el) return;
    el.style.display = 'block';
    el.style.left = Math.min(d.x0, d.x1) + 'px';
    el.style.top = Math.min(d.y0, d.y1) + 'px';
    el.style.width = Math.abs(d.x1 - d.x0) + 'px';
    el.style.height = Math.abs(d.y1 - d.y0) + 'px';
  }
  _hideSelBox() { if (this.selBox) this.selBox.style.display = 'none'; }

  // ---------- picking ----------
  _setNdc(px, py) {
    this._ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  }

  groundHit(px, py) {
    this._setNdc(px, py);
    this.raycaster.setFromCamera(this._ndc, this.rig.camera);
    const hits = this.raycaster.intersectObject(this.G.terrain.mesh, false);
    return hits.length ? { x: hits[0].point.x, z: hits[0].point.z, point: hits[0].point } : null;
  }

  screenPos(v3) {
    const p = v3.clone().project(this.rig.camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, behind: p.z > 1 };
  }

  entityAt(px, py) {
    // nearest entity by projected screen distance (robust for small models)
    let best = null, bd = 26;
    const consider = (ent, radiusPx) => {
      if (!ent.alive) return;
      const sp = this.screenPos(ent.pos.clone().add(new THREE.Vector3(0, ent.pickY ?? 1, 0)));
      if (sp.behind) return;
      const d = Math.hypot(sp.x - px, sp.y - py);
      if (d < (radiusPx ?? bd) && d < bd + (ent.pickPx ?? 0)) { best = ent; bd = d; }
    };
    for (const u of this.G.units) consider(u);
    for (const h of this.G.hostiles) consider(h);
    for (const f of this.G.flock) consider(f);
    // buildings via raycast (bigger targets)
    this._setNdc(px, py);
    this.raycaster.setFromCamera(this._ndc, this.rig.camera);
    const meshes = this.G.buildings.filter(b => b.alive && b.mesh).map(b => b.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.entity) o = o.parent;
      if (o?.userData.entity) {
        // prefer a unit if one was really close to the cursor
        if (!best || bd > 14) return o.userData.entity;
      }
    }
    return best;
  }

  resourceAt(px, py) {
    const hit = this.groundHit(px, py);
    if (!hit) return null;
    const t = this.G.terrain.nearestTree(hit.x, hit.z);
    if (t && Math.hypot(t.x - hit.x, t.z - hit.z) < 4.2) return { type: 'tree', node: t };
    const s = this.G.terrain.nearestStone(hit.x, hit.z);
    if (s && Math.hypot(s.x - hit.x, s.z - hit.z) < 4.5) return { type: 'stone', node: s };
    const sp = this.G.terrain.spring;
    if (Math.hypot(sp.x - hit.x, sp.z - hit.z) < 6.5) return { type: 'spring' };
    return null;
  }

  _clickSelect(px, py, additive) {
    const ent = this.entityAt(px, py);
    if (ent) this.G.actions.select(additive ? [...this.G.selection, ent] : [ent]);
    else if (!additive) this.G.actions.select([]);
  }

  _selectInRect(rect, additive) {
    const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
    const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
    const picked = [];
    for (const u of this.G.units) {
      if (!u.alive || !u.selectable) continue;
      const sp = this.screenPos(u.pos);
      if (!sp.behind && sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) picked.push(u);
    }
    if (picked.length) this.G.actions.select(additive ? [...new Set([...this.G.selection, ...picked])] : picked);
    else if (!additive) this.G.actions.select([]);
  }

  _contextOrder(px, py, queue) {
    const ent = this.entityAt(px, py);
    const res = ent ? null : this.resourceAt(px, py);
    const hit = this.groundHit(px, py);
    this.G.actions.contextOrder({ entity: ent, resource: res, ground: hit, queue });
  }

  // ---------- keyboard ----------
  _onKey(e, down) {
    const code = e.code;
    if (down && e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (!down) return;
    if (this.G.ui?.modalOpen && code !== 'Escape') return;

    switch (code) {
      case 'Escape': this.G.actions.escape(); break;
      case 'Space': e.preventDefault(); this.G.actions.togglePause(); break;
      case 'KeyC': this.G.actions.toggleCameraMode(); break;
      case 'KeyG': this.G.actions.toggleBell?.(); break;
      case 'KeyQ': this.rig.rotate(Math.PI / 4); break;
      case 'KeyE': this.rig.rotate(-Math.PI / 4); break;
      case 'KeyF': { // focus on selection / base
        const sel = this.G.selection[0];
        const t = sel?.pos ?? this.G.basePos;
        if (t) this.rig.flyTo(t.x, t.z);
        break;
      }
      case 'Equal': case 'NumpadAdd': this.G.actions.setSpeed(Math.min(3, this.G.time.speed + 1)); break;
      case 'Minus': case 'NumpadSubtract': this.G.actions.setSpeed(Math.max(1, this.G.time.speed - 1)); break;
      default:
        if (code.startsWith('Digit')) {
          const n = +code.slice(5);
          if (n >= 1 && n <= 9) {
            if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.groups.set(n, [...this.G.selection]); }
            else {
              const g = (this.groups.get(n) || []).filter(u => u.alive);
              if (g.length) {
                this.G.actions.select(g);
                if (this._lastGroupTap === n) this.rig.flyTo(g[0].pos.x, g[0].pos.z);
                this._lastGroupTap = n;
                setTimeout(() => { this._lastGroupTap = null; }, 400);
              }
            }
          }
        }
    }
  }

  update(dt) {
    if (this.G.ui?.modalOpen) return;
    // keyboard pan
    let dx = 0, dz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    // edge pan
    if (this.edgePanEnabled && this.mouse.inside && !this.drag && document.hasFocus()) {
      if (this.mouse.x < EDGE) dx -= 1;
      if (this.mouse.x > window.innerWidth - EDGE) dx += 1;
      if (this.mouse.y < EDGE) dz -= 1;
      if (this.mouse.y > window.innerHeight - EDGE) dz += 1;
    }
    if (dx || dz) this.rig.pan(dx, dz, dt);
  }
}
