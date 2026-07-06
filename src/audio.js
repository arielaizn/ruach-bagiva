// audio.js — 100% procedural WebAudio engine for Hilltop RTS ("רוח בגבעה").
// No samples, no network. One AudioContext, one shared noise buffer,
// fire-and-forget SFX node graphs, persistent gain-gated ambience/music layers.
// Contract (ARCHITECTURE.md): every method is a safe no-op before init()
// or when WebAudio is unavailable.

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let ctx = null;        // AudioContext (created in init)
let N = null;          // node bag: buses + compressor
let nbuf = null;       // shared 2 s white-noise buffer
let voices = 0;        // live one-shot voice count (cap 12)
let lastHover = 0;     // hover throttle

const VOL = { master: 0.9, sfx: 0.8, music: 0.35, amb: 0.7, ui: 0.6 };

// Ambience / music runtime state
const AMB = { built: false, state: null, layers: {}, timers: [] };
const MUS = { built: false, on: false, timers: [], pad: null, night: false };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const rand = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rand(a, b + 1));
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }

function osc(type, f, t0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0 ?? ctx.currentTime);
  return o;
}

function filt(type, f, q) {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f;
  if (q) b.Q.value = q;
  return b;
}

function pan(v) {
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; }
  return gain(1); // fallback
}

function chain(...n) {
  for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
  return n[n.length - 1];
}

// Linear attack to `peak`, exponential decay over `d` seconds.
function env(g, t0, a, peak, d, floor = 0.0001) {
  g.gain.setValueAtTime(floor, t0);
  g.gain.linearRampToValueAtTime(Math.max(peak, floor), t0 + a);
  g.gain.exponentialRampToValueAtTime(floor, t0 + a + d);
  return g;
}

// Looping tap of the shared noise buffer, auto-stopped after `dur`.
function noise(t0, dur) {
  const s = ctx.createBufferSource();
  s.buffer = nbuf; s.loop = true;
  s.playbackRate.value = rand(0.9, 1.1);
  s.start(t0); s.stop(t0 + dur + 0.15);
  return s;
}

// Persistent (never-stopped) noise source for ambience layers.
function noiseLoop() {
  const s = ctx.createBufferSource();
  s.buffer = nbuf; s.loop = true;
  s.playbackRate.value = rand(0.9, 1.1);
  s.start();
  return s;
}

// LFO patched into an AudioParam for `dur` seconds.
function lfo(t0, dur, rate, depth, param, type = 'sine') {
  const o = osc(type, rate, t0), g = gain(depth);
  o.connect(g); g.connect(param);
  o.start(t0); o.stop(t0 + dur + 0.1);
}

function noiseBuffer() {
  const len = Math.floor(ctx.sampleRate * 2);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function clearTimers(list) {
  for (const t of list) { clearTimeout(t); clearInterval(t); }
  list.length = 0;
}

// setTargetAtTime shortcut
function glide(param, v, tau, t) {
  param.setTargetAtTime(v, t ?? ctx.currentTime, tau);
}

// ---------------------------------------------------------------------------
// Shared voice builders (used by several recipes + music)
// ---------------------------------------------------------------------------

// Filtered-saw "oud/guitar" pluck (90% of Karplus-Strong, 0% of the plumbing).
function pluck(t0, f, g, out, warm) {
  const o1 = osc('sawtooth', f * 0.94, t0);
  o1.frequency.linearRampToValueAtTime(f, t0 + 0.06);
  const o2 = warm ? osc('triangle', f, t0) : osc('sawtooth', f * 1.004, t0);
  const bp = filt('bandpass', f, warm ? 4 : 6);
  const vg = gain(0);
  const d = (warm ? 0.9 : 0.5) * (1 + Math.random() * 0.4);
  env(vg, t0, 0.003, g, d);
  o1.connect(bp); o2.connect(bp); chain(bp, vg, out);
  o1.start(t0); o1.stop(t0 + d + 0.2);
  o2.start(t0); o2.stop(t0 + d + 0.2);
  // pick transient
  const hp = filt('highpass', 3000), ng = gain(0);
  env(ng, t0, 0.001, g * 0.3, 0.012);
  chain(noise(t0, 0.03), hp, ng, out);
  return d;
}

// Struck-glass chime (Shabbat / Havdalah / yoreh).
function glassNote(t0, f, g, out, dur = 1.8) {
  const o1 = osc('sine', f, t0), g1 = gain(0);
  const o2 = osc('sine', f * 2.76, t0), g2 = gain(0);
  env(g1, t0, 0.002, g, dur);
  env(g2, t0, 0.002, g * 0.3, dur * 0.6);
  chain(o1, g1, out); chain(o2, g2, out);
  o1.start(t0); o1.stop(t0 + dur + 0.2);
  o2.start(t0); o2.stop(t0 + dur * 0.6 + 0.2);
}

// Struck-metal partial stack (bell / coins).
function metal(t0, f, g, out, d, ratios = [1, 1.33, 1.67], gains = [1, 0.5, 0.3]) {
  for (let i = 0; i < ratios.length; i++) {
    const o = osc('sine', f * ratios[i], t0), vg = gain(0);
    env(vg, t0, 0.001, g * gains[i], d);
    chain(o, vg, out);
    o.start(t0); o.stop(t0 + d + 0.2);
  }
}

// One brassy shofar tone: saw -> tanh shaper -> sweeping lowpass.
let shaperCurve = null;
function shofarTone(t0, f, dur, g, out, cutTop = 1800) {
  if (!shaperCurve) {
    shaperCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) shaperCurve[i] = Math.tanh(2 * (i / 511.5 - 1));
  }
  const o = osc('sawtooth', f, t0);
  lfo(t0, dur, 5, 4, o.frequency);                 // pitch waver
  const ws = ctx.createWaveShaper(); ws.curve = shaperCurve;
  const lp = filt('lowpass', 600, 1);
  lp.frequency.setValueAtTime(600, t0);
  lp.frequency.linearRampToValueAtTime(cutTop, t0 + dur);
  const vg = gain(0);
  vg.gain.setValueAtTime(0.0001, t0);
  vg.gain.linearRampToValueAtTime(g, t0 + 0.06);
  vg.gain.setValueAtTime(g, t0 + dur - 0.05);
  vg.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  // quiet octave-up edge
  const o2 = osc('sawtooth', f * 2, t0), g2 = gain(0);
  env(g2, t0, 0.06, g * 0.15, dur);
  chain(o, ws, lp, vg, out); chain(o2, g2, out);
  o.start(t0); o.stop(t0 + dur + 0.1);
  o2.start(t0); o2.stop(t0 + dur + 0.1);
}

// Hammer/knock: pitched thump + noise bite.
function knock(t0, f0, f1, g, out, bite = 1400) {
  const o = osc('sine', f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + 0.07);
  const vg = gain(0);
  env(vg, t0, 0.002, g, 0.12);
  chain(o, vg, out);
  o.start(t0); o.stop(t0 + 0.3);
  const bg = gain(0);
  env(bg, t0, 0.001, g * 0.5, 0.04);
  chain(noise(t0, 0.06), filt('bandpass', bite, 1.5), bg, out);
}

// One jackal call: yip-yip prefix then rising-falling wail.
function jackalCall(t0, p, g, out, lpf = 900, panV = 0) {
  const P = pan(panV); P.connect(out);
  let t = t0;
  const yips = rint(2, 3);
  for (let i = 0; i < yips; i++) {
    const y = osc('sawtooth', 450 * p, t);
    y.frequency.linearRampToValueAtTime(700 * p, t + 0.07);
    const yg = gain(0); env(yg, t, 0.005, g * 0.7, 0.06);
    chain(y, filt('lowpass', lpf, 1), yg, P);
    y.start(t); y.stop(t + 0.2);
    t += 0.1;
  }
  t += 0.05;
  const o = osc('sawtooth', 380 * p, t);
  o.frequency.linearRampToValueAtTime(620 * p, t + 0.5);
  o.frequency.setValueAtTime(620 * p, t + 0.8);
  o.frequency.linearRampToValueAtTime(300 * p, t + 1.6);
  lfo(t + 0.4, 0.6, 6, 25 * p, o.frequency);       // hold wobble
  const vg = gain(0);
  vg.gain.setValueAtTime(0.0001, t);
  vg.gain.linearRampToValueAtTime(g, t + 0.08);
  vg.gain.setValueAtTime(g, t + 1.3);
  vg.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
  chain(o, filt('lowpass', lpf, 1), vg, P);
  o.start(t); o.stop(t + 1.8);
  return (t + 1.7) - t0;
}

// Woodcrack grain (dismantle / chop split).
function woodCrack(t0, g, out, f = 900) {
  const cg = gain(0); env(cg, t0, 0.002, g, 0.15);
  chain(noise(t0, 0.2), filt('bandpass', f, 4), cg, out);
}

// ---------------------------------------------------------------------------
// One-shot recipes. fn(t0, p, out, opts) -> duration (s).
// p = pitch multiplier. `ui: true` routes to UI bus (bypasses duck),
// `alert: true` routes around duck AND ducks everything else.
// ---------------------------------------------------------------------------

const RECIPES = {

  click: { ui: true, fn(t0, p, out) {
    for (const [f, d] of [[1200, 0.03], [1800, 0.02]]) {
      const o = osc('sine', f * p, t0), g = gain(0);
      env(g, t0, 0.002, 0.13, d);
      chain(o, g, out); o.start(t0); o.stop(t0 + 0.1);
    }
    return 0.08;
  } },

  hover: { ui: true, fn(t0, p, out) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - lastHover < 60) return 0.01;
    lastHover = now;
    const o = osc('sine', 1600 * p, t0), g = gain(0);
    env(g, t0, 0.002, 0.06, 0.015);
    chain(o, g, out); o.start(t0); o.stop(t0 + 0.05);
    return 0.04;
  } },

  build_place: { fn(t0, p, out) {   // wood thunk
    knock(t0, 120 * p, 55 * p, 0.35, out);
    const tg = gain(0); env(tg, t0 + 0.01, 0.005, 0.2, 0.18);
    chain(noise(t0 + 0.01, 0.2), filt('lowpass', 500, 0.7), tg, out);
    return 0.35;
  } },

  build_done: { fn(t0, p, out) {    // bright double knock + tiny chime
    knock(t0, 180 * p, 90 * p, 0.28, out);
    knock(t0 + 0.15, 200 * p, 100 * p, 0.24, out);
    const notes = [293.7, 440, 587.3];               // D4 A4 D5
    notes.forEach((f, i) => pluck(t0 + 0.3 + i * 0.09, f * p, 0.2, out));
    const dg = gain(0); env(dg, t0, 0.01, 0.1, 0.15); // dust settle
    chain(noise(t0, 0.2), filt('lowpass', 800, 0.7), dg, out);
    return 1.2;
  } },

  chop: { fn(t0, p, out) {          // axe on wood: thock + bite
    const o = osc('sine', 90 * p, t0);
    o.frequency.exponentialRampToValueAtTime(45 * p, t0 + 0.09);
    const g = gain(0); env(g, t0, 0.002, 0.45, 0.12);
    chain(o, g, out); o.start(t0); o.stop(t0 + 0.25);
    const bg = gain(0); env(bg, t0, 0.001, 0.22, 0.03);
    chain(noise(t0, 0.05), filt('bandpass', 2000, 1), bg, out);
    if (Math.random() < 0.25) woodCrack(t0 + 0.03, 0.2, out); // the split
    return 0.25;
  } },

  mine: { fn(t0, p, out) {          // stone tick: tink + thud
    const tg = gain(0); env(tg, t0, 0.001, 0.32, 0.025);
    chain(noise(t0, 0.04), filt('highpass', 1000 * p, 1), tg, out);
    const o = osc('sine', 80 * p, t0);
    o.frequency.exponentialRampToValueAtTime(50 * p, t0 + 0.1);
    const g = gain(0); env(g, t0, 0.002, 0.3, 0.1);
    chain(o, g, out); o.start(t0); o.stop(t0 + 0.2);
    if (Math.random() < 0.33) {                       // pick rebound ring
      const r = osc('sine', 3100 * p, t0 + 0.02), rg = gain(0);
      env(rg, t0 + 0.02, 0.001, 0.05, 0.2);
      chain(r, rg, out); r.start(t0 + 0.02); r.stop(t0 + 0.3);
    }
    return 0.25;
  } },

  water_fill: { fn(t0, p, out) {    // glug: rising bandpass sweep + AM
    const dur = 1.3;
    const bp = filt('bandpass', 400 * p, 2);
    bp.frequency.setValueAtTime(400 * p, t0);
    bp.frequency.linearRampToValueAtTime(1400 * p, t0 + dur);
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.15);
    g.gain.setValueAtTime(0.35, t0 + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    lfo(t0, dur, 3, 0.12, g.gain);                    // glug AM
    chain(noise(t0, dur), bp, g, out);
    const sg = gain(0); env(sg, t0, 0.005, 0.15, 0.08); // onset splash
    chain(noise(t0, 0.1), filt('highpass', 1500, 1), sg, out);
    const b = osc('sine', 700 * p, t0 + dur), bg = gain(0); // "full" blip
    env(bg, t0 + dur, 0.005, 0.12, 0.1);
    chain(b, bg, out); b.start(t0 + dur); b.stop(t0 + dur + 0.2);
    return dur + 0.2;
  } },

  coin: { ui: true, fn(t0, p, out) { // junction pay: metallic clinks
    const hits = rint(2, 3);
    for (let i = 0; i < hits; i++) {
      metal(t0 + i * 0.045, 3000 * p * rand(0.92, 1.08), 0.16, out, 0.12,
            [1, 1.37, 1.77], [1, 0.4, 0.2]);
    }
    return 0.35;
  } },

  sheep: { fn(t0, p, out, opts) {   // bleat, per-sheep identity via opts.pitch
    const o = osc('sawtooth', 500 * p, t0);
    o.frequency.linearRampToValueAtTime(430 * p, t0 + 0.4);
    const vg = gain(0); env(vg, t0, 0.03, 0.4, 0.45);
    const tr = gain(0.7);                             // "eh-eh-eh" tremolo
    lfo(t0, 0.55, rand(24, 32), 0.32, tr.gain);
    chain(o, filt('bandpass', 900 * p, 3), vg, tr, out);
    o.start(t0); o.stop(t0 + 0.6);
    return 0.55;
  } },

  goat: { fn(t0, p, out) {          // higher, brattier bleat + throaty catch
    const cg = gain(0); env(cg, t0, 0.001, 0.18, 0.02);
    chain(noise(t0, 0.03), filt('bandpass', 2000, 2), cg, out);
    const o = osc('sawtooth', 620 * p, t0);
    o.frequency.linearRampToValueAtTime(520 * p, t0 + 0.3);
    const vg = gain(0); env(vg, t0, 0.02, 0.38, 0.3);
    const tr = gain(0.6);
    lfo(t0, 0.4, 34, 0.4, tr.gain);
    chain(o, filt('bandpass', 1300 * p, 4), vg, tr, out);
    o.start(t0); o.stop(t0 + 0.45);
    return 0.45;
  } },

  dog_bark: { fn(t0, p, out) {      // 1-3 sharp barks
    const n = rint(1, 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.14;
      const ng = gain(0); env(ng, t, 0.003, 0.35, 0.08);
      chain(noise(t, 0.1), filt('bandpass', 1100 * p, 2), ng, out);
      const o = osc('sawtooth', 300 * p, t);
      o.frequency.linearRampToValueAtTime(200 * p, t + 0.08);
      const og = gain(0); env(og, t, 0.003, 0.25, 0.08);
      chain(o, filt('lowpass', 1200, 1), og, out);
      o.start(t); o.stop(t + 0.15);
    }
    return n * 0.14 + 0.1;
  } },

  dog_growl: { fn(t0, p, out) {
    const dur = 0.9;
    const o1 = osc('sawtooth', 120 * p, t0), o2 = osc('sawtooth', 123 * p, t0);
    o1.frequency.linearRampToValueAtTime(145 * p, t0 + dur);
    const vg = gain(0);
    vg.gain.setValueAtTime(0.0001, t0);
    vg.gain.linearRampToValueAtTime(0.3, t0 + 0.2);
    vg.gain.setValueAtTime(0.3, t0 + dur - 0.25);
    vg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lfo(t0, dur, 21, 0.12, vg.gain);                  // throat flutter
    const lp = filt('lowpass', 400, 1);
    o1.connect(lp); o2.connect(lp); chain(lp, vg, out);
    o1.start(t0); o1.stop(t0 + dur + 0.1);
    o2.start(t0); o2.stop(t0 + dur + 0.1);
    return dur;
  } },

  donkey: { fn(t0, p, out) {        // comic two-tone hee-haw x3, falling
    let t = t0;
    for (let i = 0; i < 3; i++) {
      const k = p * Math.pow(0.88, i);
      const hee = osc('sawtooth', 440 * k, t);        // "hee"
      hee.frequency.linearRampToValueAtTime(330 * k, t + 0.35);
      const hg = gain(0); env(hg, t, 0.02, 0.32, 0.35);
      chain(hee, filt('bandpass', 1200, 2), hg, out);
      hee.start(t); hee.stop(t + 0.45);
      t += 0.38;
      const wg = gain(0); env(wg, t, 0.02, 0.28, 0.3); // "haw"
      lfo(t, 0.32, 30, 0.14, wg.gain);
      chain(noise(t, 0.35), filt('lowpass', 700, 1), wg, out);
      t += 0.33;
    }
    return t - t0;
  } },

  wolf_growl: { fn(t0, p, out) {
    const dur = 1.8;
    const o1 = osc('sawtooth', 85 * p, t0), o2 = osc('sawtooth', 87 * p, t0);
    o1.frequency.linearRampToValueAtTime(110 * p, t0 + 1.2);
    o2.frequency.linearRampToValueAtTime(112 * p, t0 + 1.2);
    const vg = gain(0);
    vg.gain.setValueAtTime(0.0001, t0);
    vg.gain.linearRampToValueAtTime(0.32, t0 + 0.3);
    vg.gain.setValueAtTime(0.32, t0 + 1.3);
    vg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lfo(t0, dur, 19, 0.11, vg.gain);
    const lp = filt('lowpass', 350, 1);
    o1.connect(lp); o2.connect(lp); chain(lp, vg, out);
    o1.start(t0); o1.stop(t0 + dur + 0.1);
    o2.start(t0); o2.stop(t0 + dur + 0.1);
    const bg = gain(0); env(bg, t0, 0.3, 0.05, 1.4);  // breath
    chain(noise(t0, dur), filt('lowpass', 500, 0.7), bg, out);
    return dur;
  } },

  jackal_howl: { fn(t0, p, out) {   // rising-falling wail + pack answers
    const d = jackalCall(t0, p, 0.3, out, 900, rand(-0.3, 0.3));
    jackalCall(t0 + 0.4, p * rand(0.95, 1.05), 0.12, out, 600, -0.5);
    jackalCall(t0 + 0.9, p * rand(0.9, 1.1), 0.08, out, 450, 0.5);
    return d + 1.2;
  } },

  boar_grunt: { fn(t0, p, out) {
    const n = rint(2, 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.15;
      const g = gain(0); env(g, t, 0.005, 0.3, 0.12);
      chain(noise(t, 0.15), filt('lowpass', 300 * p, 1), g, out);
    }
    const o = osc('sine', 70 * p, t0), og = gain(0);  // thump under first
    env(og, t0, 0.005, 0.25, 0.1);
    chain(o, og, out); o.start(t0); o.stop(t0 + 0.2);
    return n * 0.15 + 0.1;
  } },

  shofar: { alert: true, duck: 3.2, fn(t0, p, out) { // tekiah — signature alert
    shofarTone(t0, 230 * p, 1.8, 0.5, out, 1800);
    shofarTone(t0 + 1.82, 345 * p, 0.3, 0.5, out, 2000); // the upward break
    return 2.2;
  } },

  bell: { fn(t0, p, out) {          // hand-bell: 2 strikes, inharmonic partials
    metal(t0, 1900 * p, 0.14, out, 0.7);
    metal(t0 + 0.35, 1900 * p * 1.02, 0.1, out, 0.6);
    return 1.1;
  } },

  scare: { fn(t0, p, out) {         // whoosh + retreating yelp (the WIN sound)
    const bp = filt('bandpass', 300, 1);
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(2500, t0 + 0.25);
    const wg = gain(0); env(wg, t0, 0.01, 0.32, 0.3);
    chain(noise(t0, 0.35), bp, wg, out);
    const y = osc('sawtooth', 600 * p * 1.3, t0 + 0.15); // yelp, fake doppler
    y.frequency.linearRampToValueAtTime(420 * p, t0 + 0.5);
    const yg = gain(0); env(yg, t0 + 0.15, 0.01, 0.22, 0.35);
    const pn = pan(0); pn.pan && pn.pan.linearRampToValueAtTime(rand(-0.7, 0.7), t0 + 0.6);
    chain(y, filt('bandpass', 900, 2), yg, pn, out);
    y.start(t0 + 0.15); y.stop(t0 + 0.6);
    const dg = gain(0); env(dg, t0 + 0.1, 0.02, 0.1, 0.2); // dust
    chain(noise(t0 + 0.1, 0.25), filt('lowpass', 500, 0.7), dg, out);
    return 0.7;
  } },

  hit: { fn(t0, p, out) {           // soft thump
    const o = osc('sine', 100 * p, t0);
    o.frequency.exponentialRampToValueAtTime(60 * p, t0 + 0.08);
    const g = gain(0); env(g, t0, 0.002, 0.3, 0.08);
    chain(o, g, out); o.start(t0); o.stop(t0 + 0.2);
    const ng = gain(0); env(ng, t0, 0.001, 0.12, 0.03);
    chain(noise(t0, 0.05), filt('bandpass', 1200, 1), ng, out);
    return 0.15;
  } },

  sling: { fn(t0, p, out) {         // spin-up whirl + whip-crack
    const dur = 0.55;
    const bp = filt('bandpass', 700, 5);
    lfo(t0, dur, 9, 250, bp.frequency);               // wobble speeds the read
    const wg = gain(0);
    wg.gain.setValueAtTime(0.0001, t0);
    wg.gain.linearRampToValueAtTime(0.14, t0 + dur);
    chain(noise(t0, dur), bp, wg, out);
    const tc = t0 + dur;                              // crack
    const cg = gain(0); env(cg, tc, 0.001, 0.4, 0.03);
    chain(noise(tc, 0.05), filt('highpass', 2000, 1), cg, out);
    const o = osc('sine', 180 * p, tc);
    o.frequency.exponentialRampToValueAtTime(90 * p, tc + 0.05);
    const og = gain(0); env(og, tc, 0.001, 0.25, 0.05);
    chain(o, og, out); o.start(tc); o.stop(tc + 0.15);
    return dur + 0.15;
  } },

  fire_ignite: { fn(t0, p, out) {   // whoosh + first pops
    const bp = filt('bandpass', 300, 1);
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(1500, t0 + 0.4);
    const g = gain(0); env(g, t0, 0.03, 0.3, 0.45);
    chain(noise(t0, 0.5), bp, g, out);
    for (let i = 0; i < 3; i++) {
      const t = t0 + 0.3 + i * rand(0.1, 0.25);
      const pg = gain(0); env(pg, t, 0.001, 0.15, 0.015);
      chain(noise(t, 0.03), filt('bandpass', 2800, 4), pg, out);
    }
    return 1;
  } },

  thunder: { fn(t0, p, out) {
    const cg = gain(0); env(cg, t0, 0.001, 0.5, 0.15); // crack
    chain(noise(t0, 0.2), filt('highpass', 1000, 1), cg, out);
    const bg = gain(0);                                // rolling body
    bg.gain.setValueAtTime(0.0001, t0);
    bg.gain.linearRampToValueAtTime(0.55, t0 + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.7);
    glide(bg.gain, 0.35, 0.25, t0 + 0.8);              // secondary swells
    glide(bg.gain, 0.2, 0.3, t0 + 1.6);
    bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);
    chain(noise(t0, 3), filt('lowpass', 120, 0.7), bg, out);
    const o = osc('sine', 45 * p, t0), og = gain(0);   // sub
    env(og, t0, 0.02, 0.3, 1.5);
    chain(o, og, out); o.start(t0); o.stop(t0 + 2);
    return 3;
  } },

  rain_start: { fn(t0, p, out) {    // 2 s swell of rain hiss + droplets
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 1.2);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 2.2);
    chain(noise(t0, 2.3), filt('highpass', 400, 0.7), filt('lowpass', 6000, 0.7), g, out);
    for (let i = 0; i < 8; i++) {
      const t = t0 + 0.3 + i * rand(0.12, 0.22);
      const o = osc('sine', rand(1500, 3000), t), bg = gain(0);
      env(bg, t, 0.002, 0.05, 0.02);
      const pn = pan(rand(-0.6, 0.6));
      chain(o, bg, pn, out); o.start(t); o.stop(t + 0.05);
    }
    return 2.3;
  } },

  kumzitz_start: { fn(t0, p, out) { // warm guitar strum by the fire
    const notes = [82.4, 123.5, 164.8, 207.7, 246.9]; // E2 B2 E3 G#3 B3
    notes.forEach((f, i) => pluck(t0 + i * 0.028, f * 2 * p, 0.22, out, true));
    return 1.4;
  } },

  shabbat: { fn(t0, p, out) {       // candle-lighting glass melody D5 A4 F#4 A4 D5
    const seq = [[587.3, 0], [440, 0.55], [370, 1.1], [440, 1.65], [587.3, 2.4]];
    const g = [0.2, 0.15, 0.15, 0.15, 0.25];
    seq.forEach(([f, dt], i) => glassNote(t0 + dt, f * p, g[i], out, 1.8));
    return 4.2;
  } },

  havdalah: { fn(t0, p, out) {      // rising 3 notes: D4 F#4 A4
    [[293.7, 0], [370, 0.5], [440, 1.0]].forEach(([f, dt], i) =>
      glassNote(t0 + dt, f * p, 0.16 + i * 0.03, out, 1.5));
    return 2.6;
  } },

  victory: { fn(t0, p, out) {       // warm fanfare: shofar pair + pluck cascade + pad
    shofarTone(t0, 146.8 * p, 0.8, 0.32, out, 1600);          // D3
    shofarTone(t0 + 0.9, 220 * p, 1.2, 0.36, out, 2000);      // A3
    const pent = [293.7, 349.2, 392, 440, 523.3, 587.3];      // D minor pent up
    pent.forEach((f, i) => pluck(t0 + 2.1 + i * 0.11, f * p, 0.16, out));
    pent.forEach((f, i) => pluck(t0 + 2.8 + i * 0.11, f * 2 * p, 0.12, out, true));
    // pad swell with major 6th (hopeful)
    const padT = t0 + 0.5, padD = 4;
    for (const f of [146.8, 220, 293.7, 493.9]) {             // D3 A3 D4 B4
      const o = osc('triangle', f * p, padT), g = gain(0);
      g.gain.setValueAtTime(0.0001, padT);
      g.gain.linearRampToValueAtTime(0.09, padT + 1.5);
      g.gain.exponentialRampToValueAtTime(0.0001, padT + padD);
      chain(o, filt('lowpass', 1200, 0.7), g, out);
      o.start(padT); o.stop(padT + padD + 0.2);
    }
    for (let i = 0; i < 4; i++) {                             // hand claps
      const t = t0 + 2.1 + i * 0.5;
      const cg = gain(0); env(cg, t, 0.001, 0.22, 0.05);
      chain(noise(t, 0.08), filt('bandpass', 1100, 1), cg, out);
    }
    return 5.5;
  } },

  defeat: { fn(t0, p, out) {        // low somber — never a "game over" sting
    const lp = filt('lowpass', 700, 0.7);
    lp.frequency.linearRampToValueAtTime(250, t0 + 2);
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.5);
    for (const f of [82.4, 164.8]) {                          // E2/E3 pad falls a tone
      const o = osc('sawtooth', f * p, t0);
      o.detune.setValueAtTime(0, t0);
      o.detune.linearRampToValueAtTime(-200, t0 + 3);
      o.connect(lp);
      o.start(t0); o.stop(t0 + 5);
    }
    chain(lp, g, out);
    pluck(t0 + 1.2, 261.6 * p, 0.18, out, true);              // C4 -> B3: the b6->5 sigh
    pluck(t0 + 2.4, 246.9 * p, 0.16, out, true);
    jackalCall(t0 + 2.8, 0.95, 0.06, out, 450, rand(-0.5, 0.5)); // distant lone howl
    return 5.5;
  } },

  demolition: { duck: 3, fn(t0, p, out) { // dread sting — low cluster swell
    const dur = 3;
    const lp = filt('lowpass', 300, 1);
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.3, t0 + 1.2);
    g.gain.setValueAtTime(0.3, t0 + 1.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    for (const f of [82.4, 87.3, 92.5]) {                     // E2 F2 F#2 cluster
      const o = osc('sawtooth', f * p, t0);
      o.connect(lp);
      o.start(t0); o.stop(t0 + dur + 0.2);
    }
    chain(lp, g, out);
    const s = osc('sine', 41 * p, t0), sg = gain(0);          // sub dread
    env(sg, t0, 1, 0.25, 2);
    chain(s, sg, out); s.start(t0); s.stop(t0 + dur + 0.2);
    return dur;
  } },

  bus_arrive: { fn(t0, p, out) {    // horn honk x2 + cheering crowd noise
    for (const dt of [0, 0.45]) {
      const t = t0 + dt, hg = gain(0);
      hg.gain.setValueAtTime(0.0001, t);
      hg.gain.linearRampToValueAtTime(0.25, t + 0.03);
      hg.gain.setValueAtTime(0.25, t + 0.22);
      hg.gain.linearRampToValueAtTime(0.0001, t + 0.3);
      const lp = filt('lowpass', 1200, 1);
      for (const f of [330, 415]) {                           // two-tone honk
        const o = osc('square', f * p, t);
        o.connect(lp); o.start(t); o.stop(t + 0.35);
      }
      chain(lp, hg, out);
    }
    const ct = t0 + 0.6, cd = 1.8;                            // crowd cheer
    const cg = gain(0);
    cg.gain.setValueAtTime(0.0001, ct);
    cg.gain.linearRampToValueAtTime(0.18, ct + 0.4);
    cg.gain.exponentialRampToValueAtTime(0.0001, ct + cd);
    lfo(ct, cd, 6.5, 0.06, cg.gain);                          // chatter flutter
    chain(noise(ct, cd), filt('bandpass', 1000, 0.8), cg, out);
    for (let i = 0; i < 4; i++) {                             // whoop blips
      const t = ct + 0.2 + i * rand(0.2, 0.35);
      const o = osc('sawtooth', rand(500, 700), t);
      o.frequency.linearRampToValueAtTime(rand(800, 1100), t + 0.15);
      const g = gain(0); env(g, t, 0.02, 0.06, 0.15);
      chain(o, filt('bandpass', 900, 2), g, out);
      o.start(t); o.stop(t + 0.3);
    }
    return 2.6;
  } },

  yoreh: { fn(t0, p, out) {         // first rain + happy chime
    RECIPES.rain_start.fn(t0, p, out);
    [[440, 0.5], [587.3, 1.0], [880, 1.5]].forEach(([f, dt]) =>
      glassNote(t0 + dt, f * p, 0.15, out, 1.4));
    return 3;
  } },
};

// ---------------------------------------------------------------------------
// Ambience layers (persistent, gain-gated)
// ---------------------------------------------------------------------------

function buildAmbience() {
  if (AMB.built) return;
  AMB.built = true;
  const L = AMB.layers;

  // --- wind: the floor of the whole mix, never fully stops while ambient ---
  const windLayer = gain(0); windLayer.connect(N.amb);
  const windLP = filt('lowpass', 350, 0.8);
  const windBody = gain(0.1);
  chain(noiseLoop(), windLP, windBody, windLayer);
  const whistle = gain(0.015);
  chain(noiseLoop(), filt('bandpass', 800, 1.5), whistle, windLayer);
  L.wind = { g: windLayer, lp: windLP, body: windBody, whistle };

  // --- crickets: two phasing gated squares ---
  const crLayer = gain(0); crLayer.connect(N.amb);
  L.cricketRest = [];
  for (const [f, rate] of [[4100, 25], [4300, 23]]) {
    const o = osc('square', f);
    const gate = gain(0.5);
    const l = osc('square', rate), lg = gain(0.5);
    l.connect(lg); lg.connect(gate.gain);
    const rest = gain(1);
    chain(o, filt('bandpass', f, 8), gate, rest, crLayer);
    o.start(); l.start();
    L.cricketRest.push(rest);
  }
  const crMaster = gain(0.04); // pre-scaled voice level
  crLayer.disconnect(); crLayer.connect(crMaster); crMaster.connect(N.amb);
  L.crickets = { g: crLayer };

  // --- shabbat pad: slow warm triangles ---
  const shLayer = gain(0); shLayer.connect(N.amb);
  const shLP = filt('lowpass', 900, 0.7);
  for (const [f, v] of [[164.8, 0.1], [246.9, 0.08], [329.6, 0.06], [415.3, 0.035]]) {
    const o = osc('triangle', f);
    o.detune.value = rand(-5, 5);
    const g = gain(v);
    chain(o, g, shLP);
    o.start();
  }
  shLP.connect(shLayer);
  lfo(ctx.currentTime, 3600, 0.07, 120, shLP.frequency); // slow breathing (long-lived)
  L.shabbatPad = { g: shLayer };

  // --- danger: low pulsing drone, layered over whatever else is on ---
  const dgLayer = gain(0); dgLayer.connect(N.amb);
  const dgLP = filt('lowpass', 200, 1);
  const o1 = osc('sawtooth', 55), o2 = osc('sawtooth', 58);
  o1.connect(dgLP); o2.connect(dgLP);
  const pulse = gain(0.6);
  const pl = osc('sine', 2.3), plg = gain(0.35);
  pl.connect(plg); plg.connect(pulse.gain);
  chain(dgLP, pulse, dgLayer);
  o1.start(); o2.start(); pl.start();
  L.danger = { g: dgLayer };

  // --- ambience automation tick: wind gust walk every 2 s ---
  AMB.timers.push(setInterval(() => {
    if (!ctx || AMB.state === null) return;
    const t = ctx.currentTime;
    const g = rand(0.05, 0.18);
    glide(windLP.frequency, rand(220, 500), 1.2, t);
    glide(windBody.gain, g, 1.2, t);
    glide(whistle.gain, Math.max(0.005, (g - 0.05) * 0.25), 1.2, t);
    // occasional cricket rest (life, not a synth)
    if (AMB.state === 'night' && Math.random() < 0.08) {
      const r = L.cricketRest[rint(0, 1)], tt = ctx.currentTime;
      glide(r.gain, 0.0001, 0.3, tt);
      glide(r.gain, 1, 0.5, tt + rand(2, 5));
    }
  }, 2000));
}

// Bird chirp cluster scheduler (day).
function scheduleBirds() {
  if (AMB.state !== 'day' && AMB.state !== 'shabbat') { AMB.birdsArmed = false; return; }
  AMB.birdsArmed = true;
  const id = setTimeout(() => {
    if (ctx && (AMB.state === 'day' || AMB.state === 'shabbat')) {
      const t0 = ctx.currentTime + 0.05;
      const n = rint(2, 5);
      let t = t0;
      const lvl = AMB.state === 'shabbat' ? 0.06 : 0.1;
      for (let i = 0; i < n; i++) {
        const f0 = rand(2400, 3200);
        const o = osc('sine', f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * rand(0.6, 1.4), t + 0.08);
        const g = gain(0); env(g, t, 0.005, lvl, 0.1);
        const pn = pan(rand(-0.6, 0.6));
        chain(o, g, pn, N.amb);
        o.start(t); o.stop(t + 0.2);
        t += rand(0.06, 0.12);
      }
    }
    scheduleBirds();
  }, rand(3000, 12000));
  AMB.timers.push(id);
}

// Distant jackal scheduler (night).
function scheduleJackal() {
  if (AMB.state !== 'night') { AMB.jackalArmed = false; return; }
  AMB.jackalArmed = true;
  const id = setTimeout(() => {
    if (ctx && AMB.state === 'night') {
      const g = gain(1); g.connect(N.amb);
      jackalCall(ctx.currentTime + 0.05, rand(0.9, 1.1), 0.07, g, 500, rand(-0.6, 0.6));
      if (Math.random() < 0.5)
        jackalCall(ctx.currentTime + rand(0.6, 1.4), rand(0.85, 1.05), 0.04, g, 400, rand(-0.6, 0.6));
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 6000);
    }
    scheduleJackal();
  }, rand(20000, 40000));
  AMB.timers.push(id);
}

// Cricket pulse density needs no scheduler; layer gains do the crossfade.
function applyAmbience(state) {
  const L = AMB.layers, t = ctx.currentTime;
  const F = 2.0; // crossfade tau
  const set = (layer, v) => glide(layer.g.gain, v, F, t);
  const prev = AMB.state;
  AMB.state = state;
  MUS.night = (state === 'night');

  if (state === 'danger') {
    // layered over current base: only raise the drone
    set(L.danger, 1);
    return;
  }
  set(L.danger, 0.0001);

  switch (state) {
    case 'day':
      set(L.wind, 1); set(L.crickets, 0.0001); set(L.shabbatPad, 0.0001);
      break;
    case 'night':
      set(L.wind, 0.55); set(L.crickets, 1); set(L.shabbatPad, 0.0001);
      break;
    case 'shabbat':
      set(L.wind, 0.5); set(L.crickets, 0.0001); set(L.shabbatPad, 1);
      break;
    default: // null -> all off
      set(L.wind, 0.0001); set(L.crickets, 0.0001); set(L.shabbatPad, 0.0001);
  }
  // (re)start schedulers on state transitions (guard against double-arming)
  if (state !== prev) {
    if ((state === 'day' || state === 'shabbat') && !AMB.birdsArmed) scheduleBirds();
    if (state === 'night' && !AMB.jackalArmed) scheduleJackal();
  }
}

// ---------------------------------------------------------------------------
// Generative music — Freygish/Hijaz on E: E F G# A B C D
// ---------------------------------------------------------------------------

const SCALE = [64, 65, 68, 69, 71, 72, 74]; // MIDI: E4 F4 G#4 A4 B4 C5 D5

function buildMusic() {
  if (MUS.built) return;
  MUS.built = true;

  MUS.layer = gain(0); MUS.layer.connect(N.mus);

  // Drone: sine+triangle at E2/E3 — the tonal floor.
  const drone = gain(0.09); drone.connect(MUS.layer);
  for (const [type, f, v] of [['sine', 82.4, 1], ['triangle', 164.8, 0.5]]) {
    const o = osc(type, f), g = gain(v);
    chain(o, g, drone); o.start();
  }
  MUS.drone = drone;

  // Pad: 3 detuned oscs retuned to a new chord tone set every ~8 s.
  const padLP = filt('lowpass', 700, 0.7);
  const padG = gain(0.07);
  chain(padLP, padG, MUS.layer);
  lfo(ctx.currentTime, 36000, 0.07, 130, padLP.frequency); // slow filter breath
  MUS.pad = { oscs: [], lp: padLP, g: padG };
  const types = ['sawtooth', 'triangle', 'triangle'];
  for (let i = 0; i < 3; i++) {
    const o = osc(types[i], 164.8);
    o.detune.value = [-4, 0, 4][i];
    const g = gain(i === 0 ? 0.35 : 0.6); // saw quieter
    chain(o, g, padLP); o.start();
    MUS.pad.oscs.push(o);
  }
}

function musicChord() {
  if (!MUS.on || !ctx) return;
  const t = ctx.currentTime;
  // chord tone sets from the Freygish pool (root/fifth/octave-ish voicings)
  const dayChords = [
    [164.8, 246.9, 329.6],   // E3 B3 E4
    [174.6, 261.6, 349.2],   // F3 C4 F4  (the b2 color)
    [220.0, 329.6, 415.3],   // A3 E4 G#4
    [146.8, 220.0, 293.7],   // D3 A3 D4
  ];
  const nightChords = [
    [82.4, 164.8, 246.9],    // E2 E3 B3 — darker, hollow
    [110.0, 164.8, 220.0],   // A2 E3 A3
    [98.0, 146.8, 196.0],    // G2 D3 G3
  ];
  const pool = MUS.night ? nightChords : dayChords;
  const chord = pool[rint(0, pool.length - 1)];
  MUS.pad.oscs.forEach((o, i) => glide(o.frequency, chord[i % chord.length], 2.5, t));
  glide(MUS.pad.lp.frequency, MUS.night ? 450 : 700, 2.5, t);
  MUS.timers.push(setTimeout(musicChord, rand(7000, 10000)));
}

function musicPhrase() {
  if (!MUS.on || !ctx) return;
  const t0 = ctx.currentTime + 0.1;
  let idx = rint(0, SCALE.length - 1);
  const n = MUS.night ? rint(2, 3) : rint(3, 5);
  let t = t0;
  for (let i = 0; i < n; i++) {
    const f = midi(SCALE[idx] + (MUS.night ? -12 : 0));
    pluck(t, f, 0.1, MUS.layer, MUS.night);
    // grace note ornament, 20%
    if (Math.random() < 0.2) pluck(t + 0.06, f * 1.12, 0.04, MUS.layer);
    t += [0.3, 0.45, 0.6, 0.9][rint(0, 3)];
    idx = Math.max(0, Math.min(SCALE.length - 1,
      idx + rint(-2, 2) - (Math.random() < 0.4 ? 1 : 0))); // downward bias
  }
  const gap = MUS.night ? rand(16000, 26000) : rand(8000, 16000);
  MUS.timers.push(setTimeout(musicPhrase, gap)); // silence between phrases is mandatory
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const AudioSys = {

  init() {
    if (ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }

    // Bus graph: sfx/amb/music -> duck -> master -> compressor -> out.
    // UI + alerts bypass duck so warnings never muffle themselves.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    comp.knee.value = 12; comp.release.value = 0.25;
    comp.connect(ctx.destination);
    const master = gain(VOL.master); master.connect(comp);
    const duck = gain(1); duck.connect(master);
    N = {
      comp, master, duck,
      sfx: gain(VOL.sfx), amb: gain(VOL.amb), mus: gain(VOL.music),
      ui: gain(VOL.ui), alert: gain(1),
    };
    N.sfx.connect(duck); N.amb.connect(duck); N.mus.connect(duck);
    N.ui.connect(master); N.alert.connect(master);
    nbuf = noiseBuffer();

    // Autoplay policy: resume on first user gesture.
    const resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });

    // Suspend when tab hidden (saves CPU, stops schedulers drifting).
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    });
  },

  play(name, opts = {}) {
    if (!ctx || ctx.state === 'closed') return;
    const r = RECIPES[name];
    if (!r) return;
    if (voices >= 12 && !r.alert) return; // voice cap; alerts always play
    const delay = Math.max(0, opts.delay || 0);
    const t0 = ctx.currentTime + delay + 0.005;
    const out = gain(opts.vol == null ? 1 : opts.vol);
    out.connect(r.ui ? N.ui : r.alert ? N.alert : N.sfx);
    voices++;
    let dur = 1;
    try { dur = r.fn(t0, opts.pitch || 1, out, opts) || 1; }
    catch (e) { /* a broken voice must never kill the game */ }
    setTimeout(() => {
      voices = Math.max(0, voices - 1);
      try { out.disconnect(); } catch (e) { /* already gone */ }
    }, (delay + dur) * 1000 + 500);
    if (r.duck) this.duckFor(r.duck);
  },

  ambience(state) {
    if (!ctx) return;
    if (state !== 'day' && state !== 'night' && state !== 'shabbat' &&
        state !== 'danger' && state !== null) return;
    buildAmbience();
    applyAmbience(state);
  },

  music(on) {
    if (!ctx) return;
    buildMusic();
    if (on && !MUS.on) {
      MUS.on = true;
      glide(MUS.layer.gain, 1, 2.5);
      musicChord();
      MUS.timers.push(setTimeout(musicPhrase, rand(2000, 5000)));
    } else if (!on && MUS.on) {
      MUS.on = false;
      glide(MUS.layer.gain, 0.0001, 1.5);
      clearTimers(MUS.timers);
    }
  },

  setVolume(master, sfx, music) {
    if (typeof master === 'number') VOL.master = Math.max(0, Math.min(1, master));
    if (typeof sfx === 'number') VOL.sfx = Math.max(0, Math.min(1, sfx));
    if (typeof music === 'number') VOL.music = Math.max(0, Math.min(1, music));
    if (!ctx || !N) return;
    const t = ctx.currentTime;
    glide(N.master.gain, VOL.master, 0.05, t);
    glide(N.sfx.gain, VOL.sfx, 0.05, t);
    glide(N.mus.gain, VOL.music, 0.05, t);
  },

  duckFor(seconds = 2) {
    if (!ctx || !N) return;
    const g = N.duck.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.35, t, 0.04);                       // fast dip
    g.setTargetAtTime(1, t + Math.max(0.3, seconds), 0.5);  // slow recover
  },
};
