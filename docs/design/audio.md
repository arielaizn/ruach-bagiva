# Hilltop RTS — Audio Design Spec (100% Procedural WebAudio)

Status: DESIGN — v1. Owner: audio. Depends on: `docs/research/threejs-tech.md` §13 (building blocks), `authenticity.md` (soundscape anchors), `balance-theory.md` (telegraph timing).

Zero samples. Every sound is synthesized at runtime from oscillators, filtered noise, and envelopes. One shared `AudioContext`, one reusable 2 s noise buffer. All SFX are fire-and-forget node graphs; ambience and music are persistent layered loops with parameter automation.

Notation used below:
- `A/D/S/R` in seconds; envelopes are linear attack + exponential decay/release unless stated.
- `dB` values are relative to the sound's bus (converted to linear gain in code: `10^(dB/20)`).
- `noise` = the shared looping white-noise `AudioBufferSourceNode`; pink-ish noise is white noise → lowpass 1-pole where noted.
- `LFO(rate, depth → target)` = an `OscillatorNode` + `GainNode` patched into an AudioParam.

---

## 1. Architecture & Module API

### 1.1 Node graph

```
[every SFX voice] ──► sfxGain ─────┐
[ambience layers] ──► ambGain ─────┼──► duckGain ──► master ──► compressor ──► ctx.destination
[music layers]    ──► musicGain ───┘        ▲
[alert sounds: shofar, raid stingers] ──────┴──────► master (bypass duck)
[UI sounds] ──► uiGain ────────────────────────────► master (bypass duck)
```

- `compressor`: `DynamicsCompressorNode` defaults except `threshold=-18`, `ratio=4`, `knee=12`, `release=0.25`. Safety limiter — keeps a shofar over a raid over a bleat from clipping.
- `duckGain`: single automation point for the ducking rule (§10). Alerts and UI bypass it so the thing you're being warned about is never ducked by itself.
- Positional model: **stereo pan by screen-x + gain by distance to camera target**. Each world-positioned SFX gets a `StereoPannerNode` (`pan = clamp(ndcX, -0.8, 0.8)`) and distance gain `g = clamp(1 - dist/60, 0.1, 1)^1.5`. No `PannerNode` HRTF (CPU, unnecessary at RTS distance).

### 1.2 Public API (`src/audio/audio.js`, ES module)

```js
export const Audio = {
  init(),                      // create ctx SUSPENDED; wire graph; build noise buffer; prime music scheduler
  resume(),                    // call from first pointerdown/keydown (autoplay policy). Idempotent.
  play(name, opts = {}),       // one-shot SFX. opts: { x, z            // world pos → pan+distance gain
                               //                       pitch: 1.0,     // multiplier on all freqs
                               //                       gain: 1.0,      // multiplier on recipe gain
                               //                       seed,           // deterministic variation (sheep id)
                               //                       priority: 1 }   // 0=cosmetic 1=normal 2=alert
  setLayer(name, on, fadeSec = 3),  // ambience/music layers: 'wind','birds','crickets','generator',
                                    // 'padDay','padNight','danger','kumzitz','shabbat','rain','fireCrackle',
                                    // 'bulldozerIdle'
  setState(state),             // convenience macro: 'day'|'night'|'raid'|'kumzitz'|'shabbat'|'menu'
                               // — flips the right layer set with correct fades (§9.4)
  setDayT(t),                  // 0..1 day phase; drives bird/cricket density + pad brightness continuously
  duck(on),                    // §10 — engaged automatically by alert-priority play(); exposed for cutscenes
  setVolume(bus, v),           // bus: 'master'|'sfx'|'music'|'ambience'|'ui'; persisted to localStorage
  stopAll(fadeSec = 0.5),      // scene transitions / defeat
};
```

Voice cap: **12 concurrent SFX voices**. On overflow, kill the oldest voice of the lowest priority < the new sound's priority; if none, drop the new sound (unless priority 2, which always plays). Footsteps and bleats are priority 0.

All `play(name)` names below are the canonical ids. Every recipe is a small builder function `(t0, opts) => void` in a `RECIPES` table — adding a sound is adding one entry.

---

## 2. Ambience — Day (`wind` + `birds`)

The hilltop is windy. Wind is the floor of the whole mix and never fully stops.

### 2.1 `wind` (persistent loop, ambience bus)
- **Body:** noise loop → `lowpass`, cutoff wandering **220–500 Hz**: every 2 s pick a new target, `setTargetAtTime(target, t, 1.2)`. Gain wanders **0.05–0.18** the same way (independent walk) — this is the gusting.
- **Whistle:** second tap of the same noise → `bandpass 800 Hz, Q 1.5` → gain 0.015, with its own slow walk 0.005–0.03. Only audible during gust peaks; correlate: whistle target = (body gain − 0.05) × 0.25.
- **Weather scaling:** storm event multiplies both walks ×2.2 and raises the wander ceiling to 700 Hz. Shabbat leaves wind untouched — the world doesn't stop, the people do.

### 2.2 `birds` (day layer, gated by `dayT`)
- One chirp = sine osc, `f0 = 2400 + rand·800 Hz`, then `exponentialRamp` to `f0·(0.6+rand·0.8)` over **0.08 s**. Env: A=0.005, D=0.10, peak 0.12 on ambience bus. Pan random ±0.6.
- Chirps fire in **clusters of 2–5**, gaps 60–120 ms. Clusters at random **3–12 s** intervals.
- Density curve: interval scales with `dayT` — dawn (05:00–08:00 game time) uses 2–6 s (dawn chorus), midday 6–12 s, none at night. Add a rarer "dove" coo at dawn: triangle 480 Hz → 400 Hz over 0.25 s, AM 12 Hz depth 0.3, ×2 with 0.3 s gap, every 20–40 s. Kill layer instantly when shofar plays (birds scatter — sell it with 6 rapid chirps panned outward, then 20 s silence).

---

## 3. Ambience — Night (`crickets` + scheduled `jackalHowl`)

### 3.1 `crickets` (night layer)
- Two voices: square osc **4.1 kHz** and **4.3 kHz** → each `bandpass` at own freq, Q 8 → gate gain chopped by `LFO(25 Hz, square)` (full on/off). Voice 2's LFO at 23 Hz so they phase against each other.
- Layer gain **0.03**; fade in over 8 s as `dayT` crosses dusk, out at dawn. Every 15–40 s one voice "rests" for 2–5 s (gate its output) — constant crickets read as a synth, gaps read as life.
- Temperature detail: on cold/winter nights run LFOs at 18/16 Hz (real crickets slow when cold). One line, big authenticity return.

### 3.2 `jackalHowl` (one-shot, auto-scheduled at night)
The signature sound. **Hard rule: the first howl chorus of each night triggers 1.5–4 s after the generator loop cuts out** (generator off at night curfew or Shabbat) — silence, then the hills answer.
- **Lead voice:** sawtooth → `lowpass 900 Hz` → gain. Pitch contour: start **380 Hz**, `linearRamp` to **620 Hz over 0.5 s**, hold with wobble `LFO(6 Hz, depth 25 Hz → osc.frequency)`, then fall to **300 Hz over 0.8 s**. Env: A=0.08, sustain through contour, R=0.3. Total ~1.6 s. Gain 0.25.
- **Yip prefix:** 2–3 short saw yelps (450→700 Hz over 0.07 s, D=0.06) 0.1 s apart before the howl — jackals yip-then-howl, wolves don't; this is what makes it a jackal.
- **Pack answer:** re-trigger the same call at +0.4 s and +0.9 s, each −8 dB, lowpass dropped to 600/450 Hz (distance), panned opposite sides.
- **Chorus:** 2–4 full calls with random 0.5–2 s offsets and pitch ±10%. Then silence 40–120 s before the scheduler may fire again. Never during raids (danger layer owns the night then).

---

## 4. Creatures

| id | Recipe |
|---|---|
| `sheepBleat` | Sawtooth **500→430 Hz over 0.4 s** → `bandpass 900 Hz, Q 3` (formant) → gain with **AM tremolo 28 Hz, depth 0.5** ("eh-eh-eh"). Env A=0.03, D=0.45. **Per-sheep identity: seed pitch ±20% and tremolo 24–32 Hz from sheep id** — ברטה always sounds like ברטה. Idle flock: random sheep bleats every 6–20 s when camera within 40 m of pen. Gain 0.18, priority 0. |
| `goatBleat` | Same graph, **higher & brattier**: saw 620→520 Hz over 0.3 s, bandpass 1.3 kHz Q 4, tremolo **34 Hz depth 0.65**, D=0.3. Add a 0.02 s noise burst (bandpass 2 kHz) at onset — the throaty catch. Lead goat's bell: see `goatBell` below. |
| `goatBell` | Struck metal: 3 sine partials **1900 / 2530 / 3170 Hz** (inharmonic ratios 1 : 1.33 : 1.67), gains 1 : 0.5 : 0.3, common env A=0.001, D=0.7 (exp). Slight detune LFO(9 Hz, 6 Hz) on partial 1. Triggered by lead-goat step cycle while flock moves, gain 0.08. The audible bell IS the "where's my flock" UI. |
| `dogBark` | Noise burst → `bandpass 1.1 kHz, Q 2` + saw **300→200 Hz**; **2 bursts 0.12 s apart**, each D=0.08, A=0.003. Gain 0.3. Alarm variant `dogBarkAlarm` (threat telegraph): 4 bursts, 0.1 s apart, pitch +15%, priority 2 — this is the 60–90 s wave warning the balance doc requires, so it bypasses ducking. |
| `wolfGrowl` | Sawtooth **85 Hz** + second saw 87 Hz (beating) → `lowpass 350 Hz` → gain with **AM 19 Hz depth 0.35** (throat flutter). Slow pitch rise 85→110 Hz over 1.2 s, env A=0.3, S=1.0, R=0.4, total ~1.8 s. Add breath: noise → lowpass 500 Hz, gain 0.04, same env. Gain 0.28. Loops with 1–3 s gaps while a wolf is stalking within 25 m of pen — the dread loop. |
| `boarSnort` | Noise burst → `lowpass 300 Hz`, env A=0.005, D=0.12, ×2–3 bursts 0.15 s apart + sine 70 Hz thump under first burst. Gain 0.25. Fires while boars root crops (with `digScrape`: noise → bandpass 600 Hz Q 1, D=0.2, every 0.5 s). |
| `donkeyBray` | The comedy sound; must land. Alternating in-out: saw **440→330 Hz** (the "hee", 0.35 s, bandpass 1.2 kHz Q 2) then noise → lowpass 700 Hz with AM 30 Hz (the "haw", 0.3 s), repeated ×3, each cycle dropping start pitch −12%. Total ~2 s, gain 0.3, rare (load/unload donkey, random 90–300 s idle). |

---

## 5. Work & Economy SFX

All work sounds are **short, dry, rhythmic** — they loop at the worker's animation rate (one `play()` per animation contact frame, driven by the sim, not by audio timers).

| id | Recipe |
|---|---|
| `footstep` | Noise burst → `lowpass 600 Hz`, A=0.001, D=0.045, gain 0.05, pitch ±15% random per step. Only for currently-selected units within 25 m, priority 0, max 3 voices. On rocky terrain add a 0.02 s `highpass 2 kHz` tick at gain 0.02. Cheap, skippable on low-end (config flag). |
| `chopWood` | Two parts, 0.13 s total: (1) impact "thock": sine **90→45 Hz over 0.09 s**, A=0.002, D=0.12; (2) bite: noise → `bandpass 2 kHz, Q 1`, D=0.03, gain 0.5 of impact. Every 4th hit add `woodCrack` (noise → bandpass 900 Hz Q 4, D=0.15, 3 grains at 0/30/70 ms) — the split. Tree falls: crack ×3 louder + slow noise swoosh (lowpass sweep 2 kHz→300 Hz over 0.7 s) + ground thud (sine 60→35 Hz, D=0.3). |
| `mineStone` | Metallic tick + thud: noise → `highpass 1 kHz`, D=0.025, gain 0.4 (the "tink") layered over sine 80→50 Hz D=0.1. Every 3rd hit, ring: sine 3.1 kHz, D=0.2, gain 0.06 (pick rebound). Rockfall on node depletion: 5 grains of lowpassed noise (400 Hz) D=0.1, 40–90 ms apart, descending gain. |
| `buildHammer` | Hammer-on-plank: sine **120→60 Hz over 0.07 s** + noise → `bandpass 1.4 kHz Q 1.5` D=0.04, A=0.001. Pattern: play in pairs ("tak-tak") 0.18 s apart per animation cycle. Pitch ±10% per hit. Gain 0.22. Pallet-wood authenticity: occasional (1 in 6) squeaky-nail follow-up — saw 1.8→2.6 kHz over 0.08 s, gain 0.05. |
| `buildComplete` | Small triumph, not a fanfare: 3 ascending sine plucks **D4-A4-D5 (293/440/587 Hz)**, each A=0.002 D=0.35 with `bandpass Q 6` at note (same pluck voice as music §9), 90 ms apart, + one soft thud (sine 70 Hz D=0.2) as the structure "settles" + 0.15 s noise dust puff (lowpass 800 Hz). Gain 0.3, bypasses distance attenuation ×0.5 (it's feedback, half-UI). |
| `waterFill` | Jerrycan at spring, loops ~2.5 s per can: noise → `bandpass` sweeping **400→1400 Hz over the fill** (rising pitch = rising water level — real physics, players feel completion), Q 2, gain 0.12 with slow AM 3 Hz depth 0.3 (glug). Onset splash: noise → highpass 1.5 kHz, D=0.08. Final "full" cue: bandpass snaps to 1.6 kHz + short sine blip 700 Hz D=0.1. |
| `coinTrade` | Shekels: 2–3 metallic partial-stacks like `goatBell` but higher and shorter — partials **3.0/4.1/5.3 kHz**, D=0.12, gains 1:0.4:0.2 — at 0/40/90 ms with pitch ±8%. Gain 0.18 on UI bus (trade is a UI act). Big sale (junction run payout): 6 coins over 0.4 s + soft pluck A3. |
| `dismantle` | Reverse of building: 4 `woodCrack` grains descending in pitch over 1.2 s + nail squeaks ×2 + final soft thud pile. Used for the demolition-order self-dismantle resolution — deliberately NOT violent-sounding; it's sad, not destructive. Gain 0.25. |

---

## 6. Threat & Defense SFX

| id | Recipe |
|---|---|
| `shofarBlast` | **The raid alarm — tekiah.** Sawtooth **~230 Hz** → gentle `WaveShaper` (tanh curve, k=2) → `lowpass sweeping 600→1800 Hz` over the note (brassy bloom) → gain A=0.06, S at 0.8. Pitch waver `LFO(5 Hz, depth 4 Hz)`. Duration 1.8 s, then upward flip to **~345 Hz** for 0.25 s (the break) and hard stop (R=0.05). Layer: quiet saw one octave up, gain 0.15, same contour (edge). **Priority 2, bypasses duck, engages duck on everything else (§10). Gain 0.5 — loudest sound in the game.** For the ch7 finale use tekiah gedolah: same recipe, sustain 4.5 s with cutoff climbing to 2.2 kHz. |
| `raiderShout` | Non-verbal, faceless, human-ish menace: saw **180→140 Hz over 0.3 s** → `bandpass 700 Hz Q 1.2` (shouty formant) → env A=0.02 D=0.35, + noise → bandpass 2.5 kHz D=0.1 at onset (breath edge). ×1–2 per raider on spawn and when charging. Deliberately pitched low and filtered so it reads "angry man far away," never words, never a language. Gain 0.22. |
| `raiderPry` | Structure-damage progress sound (15–25 s per structure per balance doc — must be audible): metal groan every ~1.2 s — saw 90→70 Hz, D=0.6, `bandpass 400 Hz Q 3`, + wood crack grain. Players locate raids by ear. Gain 0.2. |
| `scareFlee` | The rout — the WIN sound, so it must feel great: (1) whoosh: noise → `bandpass sweeping 300 Hz→2.5 kHz over 0.25 s`, Q 1, env A=0.01 D=0.3, gain 0.3; (2) retreating yelp: the creature's own voice (yip/snort/shout) at pitch ×1.3, gain falling with a fake doppler `linearRamp` pan toward flee direction over 0.5 s; (3) soft dust: lowpass 500 Hz noise D=0.2. One `scareFlee` per routed enemy, capped 4 simultaneous (then one combined bigger whoosh). |
| `slingWhirl` | Shepherd sling: noise → `bandpass 700 Hz Q 5` with the bandpass freq wobbled by `LFO(8 Hz→freq, depth 250 Hz)` rising to LFO 14 Hz over 0.7 s (spin-up), gain 0.12 → release "crack": noise → highpass 2 kHz, D=0.03, gain 0.35 + sine 180→90 Hz D=0.05. Herding taps use whirl only, defense adds the crack. |
| `stoneHit` | Sling stone lands: sine 100→60 Hz D=0.08 + noise → bandpass 1.2 kHz D=0.03. On target: creature yelp at pitch ×1.2. Gain 0.2. |
| `bulldozerIdle` | Demolition-order inspector's vehicle (layer, not one-shot): saw **38 Hz** + square **76 Hz** detuned +3 Hz → `lowpass 220 Hz` → AM **9 Hz depth 0.3** (diesel lope, slower/heavier than the generator's 13 Hz). Random ±10 Hz cutoff jitter every 0.7 s (mechanical unevenness). Add track/hydraulic hiss: noise → bandpass 1.1 kHz Q 0.7, gain 0.03, gated 0.5 s on / 1.5 s off. Layer gain 0.22 scaled by camera distance. Its arrival fade-in over 4 s IS the event telegraph — dread by subwoofer. |
| `alertPing` | Minimap event ping: sine 880 Hz D=0.15 + sine 1320 Hz D=0.1 at +0.05 s, gain 0.15, UI bus. Direction-panned toward the threat's screen side even though it's UI — subtle spatial hint. |

---

## 7. Weather & Fire

| id | Recipe |
|---|---|
| `rain` (layer) | Noise → `highpass 400 Hz` → `lowpass 6 kHz`, gain 0.10 with slow walk 0.06–0.16 (intensity). Droplet detail: every 80–200 ms a tiny blip — sine 1.5–3 kHz (random), D=0.02, gain 0.04, random pan. On tin/caravan roofs when camera is near structures: add noise → `bandpass 3 kHz Q 2` layer, gain 0.05, with denser blips at 40–100 ms — rain on the caravan tin roof is a core cozy signature. Winter-storm variant raises everything ×1.6 and adds wind ×2. |
| `thunder` | (1) Crack: noise → `highpass 1 kHz`, A=0.001 D=0.15, gain 0.5; (2) body: noise → `lowpass 120 Hz`, A=0.02 D=2.5 (exp), gain 0.6 with 2–3 secondary swells (`setTargetAtTime` bumps at +0.8/+1.6 s); (3) sine 45 Hz under the body, D=1.5, gain 0.3. Distant variant: skip crack, lowpass 80 Hz, delay 1–4 s after a lightning flash (sync with renderer). Priority 2 but does NOT duck (weather isn't an alert). |
| `fireCrackle` (layer) | Campfire loop: noise → `lowpass 1.8 kHz` → gain 0.06 with fast random walk (retarget every 0.15 s, 0.03–0.09) = the fire bed. Pops: every 0.3–1.5 s, noise → `bandpass 2.8 kHz Q 4`, D=0.015, gain 0.15, ±0.3 pan. Whoosh on lighting: bandpass sweep 300 Hz→1.5 kHz over 0.4 s. Tied to campfire entity; basis of the kumzitz scene (§9.4). |

---

## 8. UI, Rituals & Jingles

| id | Recipe |
|---|---|
| `uiClick` | Sine **1200 Hz D=0.03** + sine **1800 Hz D=0.02**, −18 dB, UI bus, bone dry. |
| `uiHover` | Single sine 1600 Hz, D=0.015, −24 dB. Throttle: max 1 per 60 ms. |
| `uiDeny` | Two-tone down: sine 400 Hz D=0.08 then 300 Hz D=0.12, −14 dB (can't afford / invalid placement). |
| `uiSelect` | Unit selected: soft pluck (music pluck voice §9.3) at D5, D=0.15, −16 dB; group select adds A4 40 ms later. |
| `shabbatEntry` | Candle-lighting moment (Friday sundown). Soft chime melody, **not** a synth arpeggio — struck-glass voice: sine + partial ×2.76 (gain 0.3), A=0.002 D=1.8 (long exp), like a soft mallet on glasses. Melody: **D5 A4 F♯4 A4 D5** (major-leaning, warm — the week's one unambiguously major moment), 0.55 s apart, gains 0.2/0.15/0.15/0.15/0.25, slight ritardando (last gap 0.75 s). Under it the music pad lifts (§9.4 shabbat state). Total ~3.5 s. Everything else (generator, work sounds) has already faded — this melody lands in engineered silence. |
| `havdalahCue` | Motzaei Shabbat (leads into kumzitz): same glass voice, inverted rising 3 notes D4 F♯4 A4, then the generator layer thumps back on and jackals get scheduled. |
| `victoryFanfare` | Chapter triumph. Instrumentation from our own palette: shofar voice + pluck voice + pad, ~6 s. Bar 1: shofar recipe at **D3, 0.8 s** then **A3, 1.2 s** (tekiah pair, cutoff opening to 2 kHz). Bar 2: pluck cascade up D minor pentatonic D4-F4-G4-A4-C5-D5 at 110 ms spacing, ×2 with the 2nd an octave up. Under all: pad swells to full with added major 6th (B natural over D — hopeful, not sad), and 4 hand-clap bursts (noise → bandpass 1.1 kHz Q 1, D=0.05, gain 0.3) on beats 0.5 s apart. Ends on bare drone + wind: the hill remains. |
| `defeatSomber` | Never a "game over" sting (failure costs resources, not the run). Low pad collapses: lowpass cutoff slides 700→250 Hz over 2 s, pitch drops a whole tone via `detune` ramp; two slow plucks **B♭3, A3** (the Hijaz ♭6→5 sigh) 1.2 s apart, D=1.5; distant lone jackal howl at −14 dB after 2.5 s. Total ~5 s, resolves back to the drone — life goes on, אין ייאוש בעולם כלל. |
| `guitarKumzitz` (layer) | Campfire guitar loop. Voice: pluck (§9.3) but warmer — saw + triangle mix (0.5/0.5), bandpass Q 4, D=0.9. Pattern: 8-bar loop at **72 BPM**, fingerpicked: bass note on beat 1 & 3 (D3/A2/C3/D3 per bar pair), pentatonic melody notes on offbeats from a fixed 16-note phrase table (D minor pent, biased stepwise) with 15% chance per note to substitute a neighbor — familiar but never identical. Every 4th loop, one strum: 5 plucks 25 ms apart D3-A3-D4-F4-A4. Under it: campfire layer + soft humming — triangle osc following the melody an octave down at gain 0.04 with lowpass 500 Hz (the boys singing along, wordless). Gain 0.3. **+Spirit event, so it must be the warmest thing in the mix.** |

---

## 9. Generative Music System

### 9.1 Scale & palette
- Home scale: **D minor pentatonic** (D F G A C). Event/danger color: **D Hijaz hint** — swap in E♭ and F♯ (D E♭ F♯ G A B♭ C) over the same D drone. Modal over drone, no chord changes, ever.
- Everything is built from 4 voices: **drone**, **pad**, **pluck**, **perc**. Total steady-state node count < 25.

### 9.2 Persistent voices
- **Drone:** sine + triangle at **D2 (73.4 Hz) / D3**, −20 dB, always on in-game. Night: crossfade to **A1/A2** (darker). This is the game's tonal floor.
- **Pad:** 3 detuned triangle oscs (root, fifth, octave, ±4 cents) → `lowpass 700 Hz` with `LFO(0.07 Hz, depth 150 Hz → cutoff)` → gain A=3 s. Every 12–20 s retrigger on a different chord tone (D, F, G, A, C pool; day biases F/A bright, night G/C hollow). `setDayT` maps cutoff base: day 700 Hz → night 450 Hz.

### 9.3 Pluck voice (the "oud")
Filtered-saw Karplus-fake: sawtooth → `bandpass(note, Q 6)` → env A=0.003, D=0.5·(1+rand); + second saw detuned a few cents; + pick transient: noise → `highpass 3 kHz`, D=0.01, gain 0.3. **Slide into ~30% of notes:** start at note×0.94, `linearRamp` to note over 0.06 s — the slide sells it. Ornament: 20% chance of a 60 ms upper-neighbor grace note.

### 9.4 Phrase generator & state layers
Every **8–20 s** (interval shrinks with tension) emit a phrase: 3–7 notes, random walk on the current scale (steps −2..+2, downward bias), gaps drawn from [0.3, 0.45, 0.6, 0.9] s. **Silence between phrases is mandatory** — pastoral, not noodly.

State mixing (each state = target gains per layer, crossfaded with `setTargetAtTime`, τ = fade/3):

| State | drone | pad | pluck | perc | extra | fade |
|---|---|---|---|---|---|---|
| `day` (calm) | 1 | 1 | sparse (14–20 s) | 0 | birds layer on | 5 s |
| `night` | 1 (A1) | 0.7, darker | very sparse (20–30 s) | 0 | crickets on | 8 s |
| `raid` | 1 | **0** | Hijaz scale, fast (4–7 s phrases) | **on** | shofar already fired | 2 s |
| `kumzitz` | 0.5 | 0.6 warm | **off** (guitar layer replaces it) | claps in guitar loop | fireCrackle on | 4 s |
| `shabbat` | 1 | 1.2, cutoff 1.1 kHz, **add major 6th osc (B4)** | off | 0 | generator off, work SFX muted | 6 s |
| `menu` | 1 | 0.8 | sparse | 0 | wind only | — |

- **Perc (raid only):** kick-ish sine drops (120→50 Hz, D=0.15) on a **140 BPM** pulse, pattern [1,0,0,1,0,1,0,0], gain 0.25, plus a shaker (noise → highpass 5 kHz, D=0.03) on offbeats at gain 0.06. Stops the instant the last enemy routs; `victoryFanfare`-lite (2 plucks + pad swell) if it was a full wave.
- Scheduler: the "two clocks" pattern — `setInterval(25 ms)` schedules all note events **100 ms ahead** on `ctx.currentTime`. Never schedule from rAF. Pause = `ctx.suspend()`.

---

## 10. Mixing Levels & Master Ducking

Default bus gains (linear, user-adjustable, persisted):

| Bus | Gain | Notes |
|---|---|---|
| master | 0.9 | |
| ambience | 0.7 | wind is the floor |
| music | 0.5 | must sit UNDER gameplay audio; if in doubt, quieter |
| sfx | 0.85 | |
| ui | 0.6 | dry, tiny |

**Master ducking rule (alerts):** when any priority-2 sound fires (`shofarBlast`, `dogBarkAlarm`, demolition-notice sting), `duckGain` → **0.35 over 0.12 s** (`setTargetAtTime` τ=0.04), hold while the alert sounds, recover to 1.0 over **1.5 s** (τ=0.5). Alerts and UI route around `duckGain`, so warnings are never self-muffled. During a full raid state, music+ambience run at ×0.6 continuously (baked into raid state gains) so combat SFX own the foreground. Max two simultaneous "pressure" soundscapes ever (mirrors balance doc's two-pressure rule): if `bulldozerIdle` and a raid coincide, bulldozer drops to gain 0.08.

Loudness discipline: every recipe's gain above was set assuming this bus table; when adding sounds, A/B against `sheepBleat` (the reference mid-level sound) rather than absolute values.

---

## 11. Performance & Implementation Notes

- One `AudioContext`; `Audio.init()` at boot (suspended), `Audio.resume()` on first gesture. `document.hidden` → `ctx.suspend()`.
- One shared 2 s noise buffer built once in `init()`; all noise sources are `AudioBufferSourceNode`s with `loop=true` reading it at random `playbackRate` 0.9–1.1 (decorrelates copies for free).
- Fire-and-forget: create nodes per event, call `src.stop(end)`, let them GC. Persistent layers (wind, crickets, generator, drone, pad, rain, fire, bulldozer) are built once and gain-gated, never rebuilt.
- Budget: ≤ 12 SFX voices + ~25 persistent nodes ≈ well under 1% CPU on a mid laptop. No `ScriptProcessorNode`, no `AudioWorklet` in v1 (the filtered-saw pluck is 90% of Karplus-Strong at 0% of the plumbing).
- Determinism: `opts.seed` feeds mulberry32 so a named sheep's voice survives save/load.
- Debug: `?debug` adds an audio HUD (active voices, state, layer gains) and a soundboard page (`tools/soundboard.html`) that calls `Audio.play()` for every id — the tuning workflow is: open soundboard, tweak recipe constants, reload.
- File layout: `src/audio/audio.js` (graph, API, mixer, ducking), `src/audio/recipes.js` (all §2–§8 one-shots), `src/audio/music.js` (§9 scheduler + layers), `src/audio/ambience.js` (§2–§3, §7 layers).

Build order (matches gameplay prototyping risk list): 1) init/resume + wind + uiClick, 2) shofar + dogBarkAlarm + duck (the alert spine), 3) bleats/bark/chop/hammer (the daily loop), 4) jackal + generator + night (the atmosphere sell), 5) music system, 6) kumzitz/shabbat/fanfares, 7) everything else.
