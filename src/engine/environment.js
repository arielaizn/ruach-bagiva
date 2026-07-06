// Sky, sun/moon lighting, stars and fog — all driven by the game-time hour.
import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';
import { MAP_SIZE } from './terrain.js';

// keyframes over 24h: [hour, sky, fog, sunColor, sunIntensity, hemiIntensity, ambient]
const KEYS = [
  { h: 0.0, sky: 0x0b1026, fog: 0x0b1026, sun: 0x223355, sunI: 0.0, hemi: 0.3, moon: 0.55 },
  { h: 4.5, sky: 0x0e1430, fog: 0x0e1430, sun: 0x334466, sunI: 0.0, hemi: 0.3, moon: 0.5 },
  { h: 5.8, sky: 0x8a5a63, fog: 0x9c7268, sun: 0xff9a5c, sunI: 0.5, hemi: 0.35, moon: 0.1 },
  { h: 7.5, sky: 0xa8c8e0, fog: 0xc3d4dd, sun: 0xffe6b8, sunI: 1.15, hemi: 0.55, moon: 0.0 },
  { h: 12.0, sky: 0x9ec8ea, fog: 0xc9d9e2, sun: 0xfff2d6, sunI: 1.35, hemi: 0.6, moon: 0.0 },
  { h: 16.5, sky: 0x9fc0dd, fog: 0xc6d2d8, sun: 0xffe0a8, sunI: 1.1, hemi: 0.55, moon: 0.0 },
  { h: 18.2, sky: 0xc97f56, fog: 0xc08a63, sun: 0xff7f3f, sunI: 0.6, hemi: 0.4, moon: 0.05 },
  { h: 19.5, sky: 0x2a2445, fog: 0x2a2445, sun: 0x664466, sunI: 0.08, hemi: 0.3, moon: 0.4 },
  { h: 21.0, sky: 0x0d1229, fog: 0x0d1229, sun: 0x223355, sunI: 0.0, hemi: 0.3, moon: 0.55 },
  { h: 24.0, sky: 0x0b1026, fog: 0x0b1026, sun: 0x223355, sunI: 0.0, hemi: 0.3, moon: 0.55 },
];

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.dim = 0; // weather dimming 0..1

    this.hemi = new THREE.HemisphereLight(0xcfe4f0, 0x8a7a58, 0.55);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.near = 10; sc.far = 320;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    this.moon = new THREE.DirectionalLight(0x7788cc, 0.0);
    scene.add(this.moon, this.moon.target);

    scene.fog = new THREE.Fog(0xc9d9e2, 120, 420);
    scene.background = new THREE.Color(0x9ec8ea);

    // stars
    const starCount = 700;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.08;
      v.normalize().multiplyScalar(420);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xdde8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.stars.renderOrder = -1;
    scene.add(this.stars);

    this._skyA = new THREE.Color(); this._skyB = new THREE.Color();
    this._fogA = new THREE.Color(); this._fogB = new THREE.Color();
    this._sunA = new THREE.Color(); this._sunB = new THREE.Color();
  }

  setDim(d) { this.dim = clamp(d, 0, 0.8); }

  update(hour, focusX = 0, focusZ = 0) {
    // find bracketing keyframes
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (hour >= KEYS[i].h && hour <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const t = (hour - a.h) / Math.max(0.001, b.h - a.h);

    this._skyA.setHex(a.sky); this._skyB.setHex(b.sky);
    this._fogA.setHex(a.fog); this._fogB.setHex(b.fog);
    this._sunA.setHex(a.sun); this._sunB.setHex(b.sun);
    const sky = this._skyA.lerp(this._skyB, t).offsetHSL(0, 0, -this.dim * 0.25);
    const fog = this._fogA.lerp(this._fogB, t).offsetHSL(0, 0, -this.dim * 0.25);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(fog);

    this.sun.color.copy(this._sunA.lerp(this._sunB, t));
    this.sun.intensity = lerp(a.sunI, b.sunI, t) * (1 - this.dim * 0.7);
    this.hemi.intensity = lerp(a.hemi, b.hemi, t) * (1 - this.dim * 0.4);
    const moonI = lerp(a.moon, b.moon, t);
    this.moon.intensity = moonI * 0.55;

    // sun arc: rises 5:30, sets 18:45
    const dayT = clamp((hour - 5.5) / (18.75 - 5.5), 0, 1);
    const sunAng = dayT * Math.PI;
    const sunEl = Math.sin(sunAng), sunAz = Math.cos(sunAng);
    this.sun.position.set(focusX + sunAz * 140, 25 + sunEl * 160, focusZ + 70 - sunEl * 40);
    this.sun.target.position.set(focusX, 0, focusZ);
    this.sun.castShadow = this.sun.intensity > 0.12;

    // moon arc: opposite phase
    const nightT = hour >= 19 ? (hour - 19) / 11 : (hour + 5) / 11;
    const moonAng = clamp(nightT, 0, 1) * Math.PI;
    this.moon.position.set(focusX + Math.cos(moonAng) * 120, 30 + Math.sin(moonAng) * 130, focusZ - 60);
    this.moon.target.position.set(focusX, 0, focusZ);

    // stars fade
    const night = hour < 5 ? 1 : hour < 6.5 ? (6.5 - hour) / 1.5 : hour > 20 ? 1 : hour > 18.8 ? (hour - 18.8) / 1.2 : 0;
    this.stars.material.opacity = night * 0.9 * (1 - this.dim);

    // fog closes in at night for coziness/tension
    this.scene.fog.near = lerp(120, 70, night) - this.dim * 30;
    this.scene.fog.far = lerp(430, 300, night) - this.dim * 80;
  }
}
