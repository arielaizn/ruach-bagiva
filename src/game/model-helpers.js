// Shared helpers for procedural low-poly models.
// Pattern: compose primitives -> paint vertex colors -> merge the STATIC parts
// into ONE mesh (1 draw call); keep ANIMATED parts (legs, heads, doors, flags)
// as separate child meshes registered in group.userData.anim.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

const _c = new THREE.Color();

// Paint a whole geometry one color (with optional per-vertex lightness jitter).
export function paint(geo, hex, jitter = 0, rng = Math.random) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    _c.setHex(hex);
    if (jitter) _c.offsetHSL(0, 0, (rng() - 0.5) * jitter);
    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = _c.r; colors[(i + v) * 3 + 1] = _c.g; colors[(i + v) * 3 + 2] = _c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

// part(geoFactory args...) convenience: make, transform, paint.
export function part(geo, hex, { p = [0, 0, 0], r = [0, 0, 0], s = null, jitter = 0.08 } = {}) {
  const g = paint(geo, hex, jitter);
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(r[0], r[1], r[2]);
  const q = new THREE.Quaternion().setFromEuler(e);
  m.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(...(s || [1, 1, 1])));
  g.applyMatrix4(m);
  return g;
}

// Merge geometries into one shadow-casting mesh.
export function merged(parts, { castShadow = true, receiveShadow = false } = {}) {
  const geo = mergeGeometries(parts, false);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, MAT);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

// A separate animated child mesh from parts.
export function animPart(parts, opts = {}) {
  return merged(parts, opts);
}

// free GPU buffers when a model leaves the scene (shared MAT stays alive)
export function disposeModel(group) {
  group?.traverse?.((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
export const ico = (r, det = 0) => new THREE.IcosahedronGeometry(r, det);
export const sph = (r, w = 6, h = 5) => new THREE.SphereGeometry(r, w, h);
export const torus = (r, t, rs = 5, ts = 10) => new THREE.TorusGeometry(r, t, rs, ts);
export const plane = (w, h) => new THREE.PlaneGeometry(w, h);
