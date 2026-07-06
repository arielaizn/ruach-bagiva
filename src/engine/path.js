// A* pathfinding on the terrain grid with line-of-sight smoothing.
import { GRID_N } from './terrain.js';

class MinHeap {
  constructor() { this.a = []; }
  push(node) {
    const a = this.a; a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

// Returns array of {cx, cz} from start(exclusive-ish) to goal, or null.
export function findPath(terrain, sx, sz, gx, gz, maxIter = 6000) {
  if (!terrain.inBounds(gx, gz)) return null;
  if (!terrain.walkable(gx, gz)) {
    const near = terrain.findWalkableNear(...Object.values(terrain.cellToWorld(gx, gz)));
    gx = near.cx; gz = near.cz;
    if (!terrain.walkable(gx, gz)) return null;
  }
  if (sx === gx && sz === gz) return [{ cx: gx, cz: gz }];

  const open = new MinHeap();
  const gScore = new Map();
  const came = new Map();
  const key = (x, z) => z * GRID_N + x;
  const h = (x, z) => Math.hypot(x - gx, z - gz);
  gScore.set(key(sx, sz), 0);
  open.push({ x: sx, z: sz, f: h(sx, sz) });
  const closed = new Set();
  let iter = 0;

  while (open.size && iter++ < maxIter) {
    const cur = open.pop();
    const ck = key(cur.x, cur.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === gx && cur.z === gz) {
      // reconstruct
      const path = [];
      let k = ck;
      while (k !== undefined) {
        path.push({ cx: k % GRID_N, cz: Math.floor(k / GRID_N) });
        k = came.get(k);
      }
      path.reverse();
      return smoothPath(terrain, path);
    }
    const cg = gScore.get(ck);
    for (const [dx, dz, cost] of DIRS) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (!terrain.walkable(nx, nz)) continue;
      // no diagonal corner-cutting
      if (dx !== 0 && dz !== 0 && (!terrain.walkable(cur.x + dx, cur.z) || !terrain.walkable(cur.x, cur.z + dz))) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      // slight uphill penalty for natural-looking routes
      const dh = Math.max(0, terrain.cellH[nk] - terrain.cellH[ck]);
      const ng = cg + cost + dh * 0.6;
      if (gScore.get(nk) === undefined || ng < gScore.get(nk)) {
        gScore.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, z: nz, f: ng + h(nx, nz) });
      }
    }
  }
  return null;
}

function los(terrain, a, b) {
  // supercover line walk between cell centers
  let x0 = a.cx, z0 = a.cz;
  const x1 = b.cx, z1 = b.cz;
  const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let hPrev = terrain.cellH[z0 * GRID_N + x0];
  for (;;) {
    if (!terrain.walkable(x0, z0)) return false;
    const hCur = terrain.cellH[z0 * GRID_N + x0];
    if (Math.abs(hCur - hPrev) > 1.75) return false;
    hPrev = hCur;
    if (x0 === x1 && z0 === z1) return true;
    const e2 = 2 * err;
    const stepX = e2 > -dz, stepZ = e2 < dx;
    // diagonal step: forbid corner cutting (both orthogonal cells must be open)
    if (stepX && stepZ && (!terrain.walkable(x0 + sx, z0) || !terrain.walkable(x0, z0 + sz))) return false;
    if (stepX) { err -= dz; x0 += sx; }
    if (stepZ) { err += dx; z0 += sz; }
  }
}

function smoothPath(terrain, path) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  let anchor = 0;
  for (let i = 2; i < path.length; i++) {
    if (!los(terrain, path[anchor], path[i])) {
      out.push(path[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(path[path.length - 1]);
  return out;
}
