# Hilltop RTS — Campaign & Level Design (7 Chapters + Free-Play)

Owner: campaign/level design. Grounded in `docs/research/rts-mechanics.md`,
`balance-theory.md`, `authenticity.md`. All numbers use the balance doc's starter
framework (unit stats §8.3, wave point costs §3.2, building bands §8.2). Deviations
from the balance doc's draft chapter table are intentional and noted in §1.3.

---

## 1. Campaign Overview

### 1.1 Shape

7 chapters, each 8–15 minutes, each teaching exactly ONE new system (teach → test →
twist), each ending in an explicit triumph screen (camera pan over the outpost,
Hebrew narrated interlude, stats: built / joined / spirit earned). One continuous
outpost — the same hill grows across all 7 chapters (chapter N loads a canonical
"expected state" snapshot merged with the player's carried-over save, so skipped
optional content never blocks progress). Free-play unlocks after chapter 2.

In-game day length: **75 s (ch1–3), 90 s (ch4–7)**. Day phases: dawn (0.00–0.15),
day (0.15–0.55), dusk (0.55–0.70), night (0.70–1.00). Every 7th day is Shabbat:
build/gather/repair/supply halt, defense never halts, +30 spirit lump, hostile
timers freeze, 45–70 s real-time with skip button. Autosave: chapter start, after
each survived wave, every Friday candle-lighting.

### 1.2 Threat introduction ladder

| Threat (pts) | First seen (teach) | Tested | Notes |
|---|---|---|---|
| Jackal (1) | Ch1 day 3 (loseproof) | Ch2 | flees at 50% HP |
| Wolf (2) | Ch2 night 4 | Ch2 Friday night | sheep TTK 7 s — rescue window |
| Livestock thief (3) | Ch3 night 5 | Ch3 finale | grabs sheep, drops at 50% HP |
| Wild boar (3) | Ch5 day 2 | Ch5 mid | drought drives them to irrigated crops |
| Masked raider (5) | Ch5 night 8 (scripted probe) | Ch6 | flees when wave loses 60% strength |
| Raider leader (10) | Ch6 finale | Ch7 finale | others rout when he falls |

### 1.3 Difficulty curve (sawtooth-rising)

Chapter wave-budget peaks: **2 → 6 → 10 → 8 → 15 → 22 → 26**. Ch4 is the deliberate
combat valley (demolition-order stress chapter — tension from the timer, not DPS).
Ch7's finale is ~1.2× ch6's peak, landing when player defense is maxed (~35 pts),
holding the 75–85% budget-to-defense rule. Deviation from the balance doc draft:
thieves moved from ch4→ch3 and boars from ch3→ch5 to serve the campaign arc
(water chapter gets human antagonists early; drought chapter gets hungry boars —
thematically causal). Peak sequence stays sawtooth and under the 2× intra-chapter
growth cap everywhere; ch6 finale is the max *simultaneous* raid, ch7's is wider
but arrives against a mature kit.

All waves: telegraphed 60–90 s (dogs orient + bark, dust, minimap arrow, Hebrew
banner), rubber-banded `× clamp(0.75 + 0.25·(power/expected), 0.75, 1.35)` sampled
at telegraph time. Grace: no spawns first 2 min of chapter, 60 s post-wave, 30 s
new-building immunity. Difficulty setting multiplies budgets 0.7/1.0/1.3 only.

### 1.4 Terrain generator params (shared schema)

Every chapter's map is generated, not modeled. Params consumed by
`terrainGen(params)` (see threejs-tech doc §5 — 256 m plane, 128×128 segments,
analytic height function):

```js
terrain: {
  seed: 0,            // mulberry32 seed; deterministic map
  plateauRadius: 30,  // meters of flat-ish buildable hilltop (slope < 8°)
  roughness: 0.3,     // 0–1: amplitude of ridge/wadi noise outside plateau
  treeDensity: 0.2,   // 0–1: olive/oak/terebinth instancing density
  springAngle: 90,    // degrees from north, clockwise; spring sits 60–90 m out,
                      //   always BELOW plateau height (water is downhill — always)
  springDist: 70,     // meters from hill center
  roadAngle: 200,     // dirt access road + junction spawn edge
  terraces: 2,        // count of restorable ancient terrace shelves on slopes
  cistern: false      // discoverable bor-mayim ruin toggle
}
```

Wave spawn points are the map edge at authored `dirs` angles; the road edge doubles
as the inspector-jeep and visitor entrance. Higher `roughness` carves wadis =
concealed approach lanes = harder chapters without touching budgets.

---

## 2. Chapter Designs

Format per chapter: fantasy → terrain → starting kit → objectives → timeline →
new mechanic → duration → fail states → ramp notes. Timeline notation:
`D3/night` = day 3, night phase. Wave notation `{budget, palette, dirs,
telegraph}`. All player-facing text is Hebrew; strings here are the actual barks.

---

### Chapter 1 — "עולים לגבעה" (`ch1_aliyah`)

**Fantasy:** Two teens and a donkey climb an empty hill with a tent, a jerrycan,
and a dream — by candle-lighting on Friday there's a home here.

**Terrain:** Gentle, welcoming, readable. `{seed: 10101, plateauRadius: 34,
roughness: 0.18, treeDensity: 0.12, springAngle: 95, springDist: 55, roadAngle:
215, terraces: 1, cistern: false}`. Spring close and visible from the plateau;
one lone ancient olive on the summit (the "founding tree", camera anchor).

**Starting kit:** Units: Elyashiv (חרוץ/diligent), Neriya (מוזיקלי/musical),
donkey Chamudi. Buildings: none. Resources: 40 wood, 10 food, 8 water, 0 stone,
20 shekels, 50 spirit.

**Objectives:**
- P1 Pitch the tent on the plateau (build ghost tutorial).
- P2 Fill 3 jerrycans at the spring (smart right-click + walk-distance lesson).
- P3 Plant the vegetable patch; reach 20 food.
- P4 Build the campfire ring and hold the first kumzitz (D5/night).
- P5 Light Shabbat candles (auto-completes at D6 dusk if P1–P4 done).
- Bonus B1: name the hill (free-text, stored in save, used in all later dialogue).
- Bonus B2: restore the first terrace shelf (+1 farm plot slot, teaches terraces).

**Timeline:**
- D1/dawn — narrated intro over camera descent; tutorial pointer chain (select,
  move, build). Event log: "עלינו. ברוך השם."
- D2/day — jerrycan tutorial; donkey carry unlocked ("חמודי סוחב, אתם לא").
- D3/dusk — scripted loseproof wave `{2, [jackal], E, 90s}` targeting the food
  crate; Elyashiv auto-equips sling first time; teach "chase off" order. Jackals
  flee at first hit. Bark: "תן! יאללה תסתלק!"
- D4/day — weather: light sharav shimmer (cosmetic); tutorial: work-speed tooltip
  shows spirit modifier.
- D5/night — first kumzitz (scripted, +10 spirit, guitar audio, teaches spirit).
- D6/day — Friday crunch tutorial: checklist UI (water stocked? food ≥ 10?).
- D6/dusk — candle-lighting cutscene = chapter triumph. Shabbat itself plays as
  the chapter-end interlude (no threats, singing ambience).

**New mechanic:** the core loop — select/order, build ghost with radius rings,
resource gathering, day/week clock, spirit meter.

**Duration:** ~8 min (6 days × 75 s + interludes). **Fail states:** none real —
food/water can hit 0 (spirit drain + slowdown only); jackal wave cannot kill.
**Ramp notes:** zero failure pressure; every mechanic introduced by doing, max
one tutorial pointer on screen at a time.

---

### Chapter 2 — "שומרי העדר" (`ch2_flock`)

**Fantasy:** The flock arrives — eight sheep with names — and the wolves of the
wadi learn there are dogs on this hill now.

**Terrain:** Same hill, one week later (continuity: ch1 buildings persist).
`{seed: 10101, plateauRadius: 34, roughness: 0.18, treeDensity: 0.12,
springAngle: 95, springDist: 55, roadAngle: 215, terraces: 1, cistern: false}`
+ overlay: grazing meadow zone NE (60 m out), wolf den marker far E in the wadi.

**Starting kit (adds):** Units: +Amichai (רועה/shepherd trait), +dog Lavi.
Buildings: tent, patch, campfire (from ch1). +8 named sheep (Berta, Shulamit,
Pashosh, Gveret Cohen, Malka, Ketem, Shchora, Perach). Resources: carry-over
+30 wood, +15 food.

**Objectives:**
- P1 Build the sheep pen (band B) with shade net before D2/night.
- P2 Take the flock to graze and return all 8 by dusk, twice (shepherding loop).
- P3 Build the dog kennel; adopt second dog (Sufa).
- P4 Survive the Friday-night wolf wave with ≥ 6 sheep alive.
- Bonus B1: zero sheep even *injured* all chapter ("רועה צדיק" star).
- Bonus B2: build the zula before Shabbat (+kumzitz spirit yield +50%).

**Timeline:**
- D1/day — flock delivery cutscene at the road; shepherding tutorial (flock
  boids follow shepherd; lead-ewe bell audio).
- D2/dusk — wave `{3, [jackal], NE, 75s}` hits *returning* flock — teaches
  escorting; dog intercept tutorial.
- D3/day — alarm-bell (town bell) tutorial: drill event, one button — sheep to
  pen, dogs out, workers grab slings. Bark: "כולם! לדיר!"
- D4/night — TEACH wolves: scripted pair sighted at range, howl, retreat
  (no combat). Log: "זאבים בוואדי. לביא לא ישן."
- D5/day — weather: cold snap; sheep graze slower (feed from hay instead —
  hay-stock mini-lesson).
- D6/day — Friday crunch: checklist adds "flock penned by dusk".
- D6/night — **twist**: wave `{6, [wolf×3], E, 90s}` on Friday night. Defense
  works normally (guards/dogs fine on Shabbat) but building/repair greyed out —
  the fence gap you didn't fix Friday afternoon IS the lesson.
- D7 — Shabbat; motzaei-Shabbat kumzitz + triumph screen.

**New mechanic:** flock & shepherding, guard dogs, alarm bell, the full Shabbat
cycle (first time the halt matters).

**Duration:** ~10 min. **Fail states:** flock reduced below 4 sheep (retry from
last autosave offered); core tent destroyed (near-impossible — wolves ignore
structures). **Ramp notes:** first real loss potential, but wolf TTK-vs-sheep
7 s + 90 s telegraph + alarm bell = an attentive player takes zero losses;
rubber-band floor keeps a bad player at 4–5 sheep, still passing.

---

### Chapter 3 — "מים חיים" (`ch3_water`)

**Fantasy:** The spring is life — pipe it, tank it, guard it — because someone
out there has noticed the flock is worth money.

**Terrain:** New adjacent hill knoll expands the buildable map; spring now
farther and lower. `{seed: 10103, plateauRadius: 30, roughness: 0.32,
treeDensity: 0.22, springAngle: 130, springDist: 85, roadAngle: 215,
terraces: 2, cistern: true}`. The cistern ruin sits NW — discovering and
cleaning it is the bonus. A wadi runs S→E: concealed approach lane.

**Starting kit (adds):** +Tehila (settler, חרוצה), +Yedidya (settler, ישנוני/
sleepy — comic guard-roster liability). Buildings carry over. +1 caravan
delivered D1 (housing +2, becomes the CORE structure from now on).
Resources: +60 wood, +20 stone, +40 shekels.

**Objectives:**
- P1 Build the water tower (band C) and fill it to 100 water.
- P2 Establish the donkey water route (waypoint-queue tutorial: spring →
  tower, repeating).
- P3 Set a night-guard roster (2 of 5 settlers per night, UI panel).
- P4 Drive off the thief raid with 0 sheep stolen OR recover any stolen sheep
  via the follow-up track event.
- Bonus B1: clean the ancient cistern (+150 water storage, "בור מים" log beat).
- Bonus B2: keep the water tower ≥ 50% full all chapter.

**Timeline:**
- D1/day — caravan towed up the road (cutscene); water-chain tutorial.
- D2/day — spring flow cap made visible (12/min shared — queueing at the
  spring animates). Weather: dry week notice ("אין גשם באופק").
- D3/dusk — wave `{5, [jackal×3, wolf], NE, 75s}` — routine by now; tests
  roster (Yedidya asleep on guard = late telegraph if he's assigned — comedy).
- D4/night — TEACH thieves: scripted single thief sighted at the pen fence,
  dogs bark, he flees at floodlight. Log: "מישהו הסתובב ליד הדיר. לא תן."
- D5/night — wave `{8, [thief×2, jackal×2], S-wadi, 90s}` — thieves grab
  sheep and RUN (drop at 50% HP); teaches intercept-the-runner. If a sheep is
  taken: D6 "track the thieves" objective spawns (follow trail markers to map
  edge, recover her — never permanently lost in this chapter).
- D6/day — Friday: fill the tower before Shabbat (consumption continues!).
- D7 — Shabbat. Watering animals permitted (authenticity: animal care allowed);
  tower drains visibly — the buffer you built IS the payoff.
- D8/night — **twist finale**: wave `{10, [thief×2, wolf×2], 2 dirs (S-wadi +
  NE), 90s}` — attention split, alarm bell + dog split decision. Triumph after.

**New mechanic:** water logistics chain (spring → jerrycan/donkey → tower →
consumers), night-guard roster, waypoint queues.

**Duration:** ~11 min (8 days). **Fail states:** core caravan destroyed;
water at 0 for 2 consecutive days (spirit collapse cascade — warned twice).
**Ramp notes:** first 2-direction wave, first economy that runs at a deficit
if unmanaged. Rubber-band expectedPower = 11 pts (shepherd + 2 dogs + fences).

---

### Chapter 4 — "הצו" (`ch4_order`)

**Fantasy:** A white 4x4 with a yellow beacon crawls up the road. Papers taped
to the caravan. Ten days. The whole hill holds its breath — and picks up phones.

**Terrain:** Same map as ch3 (continuity chapter — the drama is at home).
`{seed: 10103, plateauRadius: 30, roughness: 0.32, treeDensity: 0.22,
springAngle: 130, springDist: 85, roadAngle: 215, terraces: 2, cistern: true}`.
Day length steps up to 90 s from here on.

**Starting kit (adds):** +Nachman (settler, מוזיקלי — spirit engine), pop 6.
Resources: +40 wood, +30 stone, +50 shekels. Spirit forced to 60 at start
(the story needs headroom both ways).

**Objectives:**
- P1 Resolve the demolition order on the sheep pen before its timer ends
  (either path counts — this is a choice, not a test).
- P2 Keep spirit ≥ 30 through the chapter.
- P3 Drive off the thief raid that lands during the order window.
- Bonus B1: resolve via muster with ≥ 40 supporters (big freeze, best ending
  variant text in ch7).
- Bonus B2: hold a mid-week kumzitz during the crisis (+morale story beat).

**Timeline:**
- D1/day — quiet open; build/repair freely. Rumor beat at dusk: "ראו ג'יפ
  לבן בצומת." (forecast strip shows: ? in 1 day).
- D2/day — **inspector arrives** (cutscene, minimap ping, dread sting). Order
  taped to the sheep pen: timer 6 days (freezes on Shabbat). Choice UI opens:
  (A) self-dismantle any time before deadline → 80% materials refund, −10
  spirit, pen gone until rebuilt post-chapter; (B) MUSTER: spend spirit in
  20-point pledges — each pledge = a phone-chain action at the reception spot
  (water-tower ladder!), each brings 12–18 supporters by bus over 2 days.
  ≥ 30 supporters at deadline = order frozen. Supporters eat food (+2 food/day
  each 10) — a real cost.
- D3/night — wave `{6, [thief×2], S, 90s}` — thieves probe *while* everyone
  argues politics. Tests: don't forget you're a farm.
- D4/day — dilemma escalation event: neighbor farm offers 60 shekels to help
  dismantle ("לא שווה את הבלגן, אחי") vs. rav's visit (+15 spirit if hosting,
  strengthens muster path). Pure flavor-choice, both give something.
- D5/day — weather: first-rain teaser (clouds, no rain — "עוד לא יורה").
- D6/day — Friday. Timer pauses at candle-lighting; forced breath. Scripted
  Shabbat scene: supporters (if any) singing with you (+5 spirit).
- D7 — Shabbat.
- D8/day — **deadline + twist**: inspector returns at noon EXACTLY as wave
  `{8, [thief×2, jackal×2], 2 dirs, 75s}` telegraphs — mustered supporters
  visibly stand at the pen (they don't fight — they just *stand*, and the
  order is read frozen) while your guards handle the animals. If dismantled:
  wave targets the exposed flock instead (pen gone) — harder but survivable.
- D8/dusk — resolution cutscene either way; triumph screen states the cost
  honestly ("הדיר נשאר. עלה לנו ברוח." / "פירקנו. נבנה שוב.").

**New mechanic:** spirit as conflict currency — the demolition-order dilemma
event (timed choice, muster mini-campaign, consequences persist to ch7).

**Duration:** ~12 min. **Fail states:** timer expires with neither path chosen
→ pen auto-demolished with 0 refund and −25 spirit; if spirit hits 0 →
chapter fail ("הגבעה נשברה") with retry-from-Shabbat. Core caravan destroyed.
**Ramp notes:** deliberate combat valley (peak budget 8). Stress comes from
running the muster economy against food/spirit while routine raids continue.
Never two combat pressures at once; the D8 twist is decision+execution, per
the two-pressures cap.

---

### Chapter 5 — "שרב" (`ch5_sharav`)

**Fantasy:** The spring is dropping, the boars smell the last green field on
the mountain, and the only shekels are at the junction — sell cheese, buy
water, hold the line through the heat.

**Terrain:** Drier palette, bigger map ring unlocked toward the road.
`{seed: 10105, plateauRadius: 30, roughness: 0.38, treeDensity: 0.10,
springAngle: 130, springDist: 85, roadAngle: 215, terraces: 3, cistern: true}`.
Junction node at the road edge becomes interactive (stand + cheese crates).
Spring flow halves mid-chapter (visible trickle animation).

**Starting kit (adds):** +Hodaya (settler), pop 7. +vineyard plot (young
vines, drip lines — boar magnet). Slinger gear purchasable (20 shekels).
Resources: +30 shekels, hay stock 40.

**Objectives:**
- P1 Run 3 junction supply runs (donkey + worker, 2.5 min round trip,
  25 shekels each; cheese upgrade makes it 40).
- P2 Buy and install the watchtower (band C, +90 s wave-warning radius).
- P3 Keep every settler and animal watered through the sharav (water never
  at 0 during days 4–7).
- P4 Survive the raider probe with no storage looted.
- Bonus B1: build the cheese stand (milk → shekels, junction run value +15).
- Bonus B2: vineyard survives with ≥ 80% vines intact (boars!).

**Timeline:**
- D1/day — junction unlock tutorial; first supply run escorted (scripted safe).
- D2/dusk — TEACH boars: two boars hit the vegetable patch at dusk, visible
  uprooted-rows aftermath if ignored. Dogs scare them easily (×2 vs animals).
- D3/day — **sharav begins** (screen haze, work speed −15% at midday, water
  consumption ×1.5). Forecast strip: "שרב — עוד 4 ימים".
- D4/day — spring flow halves. Water-tanker offer at junction: 80 shekels for
  +120 water (the shekel loop closes: cheese → shekels → water).
- D4/night — wave `{10, [boar×2, wolf×2], NE+S, 90s}` — boars beeline crops,
  wolves probe pen: the attention-split test at full scale.
- D5/day — brush-fire micro-event: dry grass ignites near the hay (beat it
  out with 3 workers in 45 s or lose 20 hay — telegraphed by smoke).
- D6/day — Friday during sharav: fill EVERYTHING; checklist expands.
- D7 — Shabbat; sharav breaks at havdala (relief beat, +5 spirit, cool wind
  audio).
- D8/night — TEACH raiders: scripted probe `{10 nominal, spawns raider×2}` —
  they crowbar the storage container (15–25 s audible progress), flee when
  wave loses 60% strength. Watchtower spotlight + dogs + slingers routs them.
  Log: "רעולי פנים. פחדנים. הכלבים גירשו אותם."
- D9/day — **twist finale**: wave `{15, [raider×2, wolf×2, jackal], 2 dirs,
  90s}` lands while the D9 supply run is out (donkey + worker gone — the
  chapter's own economy is the twist). Triumph after.

**New mechanic:** trade loop (junction runs, cheese stand, shekel purchases)
+ drought pressure; slinger gear + watchtower complete the defense triangle.

**Duration:** ~13.5 min (9 days). **Fail states:** water at 0 for 2 days;
core caravan; flock below 4. **Ramp notes:** expectedPower 19 (shepherd,
slinger, 2 dogs, tower). First chapter where the player must *choose* what
not to afford. Raider teach is loseproof-ish: probe budget can't breach the
container in under 20 s with any dog response.

---

### Chapter 6 — "הלילה הגדול" (`ch6_night`)

**Fantasy:** Rumors all week — trucks, masks, a "list of farms." Then the
generator dies at midnight and every dog on the hill stands up at once.

**Terrain:** Same home map, hostile ring: two extra wadi approach lanes carved.
`{seed: 10105, plateauRadius: 30, roughness: 0.46, treeDensity: 0.10,
springAngle: 130, springDist: 85, roadAngle: 215, terraces: 3, cistern: true}`.
Floodlight build unlocked (light radius deters night threats, needs generator).

**Starting kit (adds):** +Shilo, +Emuna (pop 9), +dog #3 (Bamba). Second
watchtower affordable by design (+150 mixed resources granted D1 as a
"neighboring farms chipped in" story beat — diegetic pre-finale boost).
Emergency abilities unlocked D1: **"שחרר את הכלבים"** (all dogs sprint to
point, big courage-drain AoE, cooldown 2 days) and **"כולם החוצה!"**
(every settler armed 30 s, work halts, cooldown 3 days).

**Objectives:**
- P1 Prepare the perimeter: 2 watchtowers + floodlit pen + fence ring closed
  before D5 (a checkable "readiness" meter, TAB-style).
- P2 Call HaShomer volunteers at least once (new action: 15 shekels, 2
  volunteer guards arrive for 2 nights).
- P3 Survive the Big Night with the flock ≥ 80% intact.
- P4 Rout the raider leader (he falls → all flee).
- Bonus B1: perfect Big Night — zero structures damaged.
- Bonus B2: trigger "confront early" on any wave (call-threat-early button:
  dogs scout it, wave arrives at 0.8× budget, +8 spirit).

**Timeline:**
- D1/day — war-council cutscene at the zula; readiness meter UI on.
- D2/night — wave `{10, [thief×2, wolf×2], S, 90s}` — warm-up, tests roster.
- D3/day — rumor beat: junction gossip fixes the Big Night date — "מוצ״ש.
  תהיו מוכנים." Forecast strip shows it 4 days out (TAB telegraphed-finale).
- D4/night — wave `{14, [raider×2, boar, jackal], 2 dirs, 90s}` — rehearsal;
  post-wave log rates your response time (feeds readiness meter).
- D5/day — generator maintenance event: spend 10 shekels/1 worker-day now, or
  risk it (flag `gen_serviced`).
- D6/day — Friday. Full crunch: hay in, water full, volunteers arrive if
  called, dogs fed double. Candle-lighting autosave is the finale checkpoint.
- D7 — Shabbat. Quiet. Scripted beat: guards watching the dark, humming a
  niggun. (The calm IS the dread.)
- D7/motzaei-Shabbat — **THE BIG NIGHT**: wave `{22, [raider×4, leader,
  thief×2, wolf×2... spent from palette], 3 dirs (S-wadi, E-wadi, N), 120s
  telegraph}`. Mid-wave 20 s lull after the first two lanes rout (regroup,
  repair nothing — Shabbat just ended, repairs ARE allowed now — rotate
  defenders). If `gen_serviced == false`: generator dies at wave start,
  floodlights out until a worker kicks it (20 s interaction) — the twist
  punishes skipping D5. Leader falls → mass rout → havdala candle lit *late*,
  on purpose, over the field they just held.
- D8/day — cleanup, triumph screen with per-defender stats ("לביא: 6 בריחות").

**New mechanic:** emergency cooldown abilities + volunteer night guards +
readiness meter (prep-phase gameplay made explicit).

**Duration:** ~12 min (8 days, dense). **Fail states:** core caravan destroyed;
flock below 50%; leader loots the storage container fully (60 s uninterrupted
— effectively impossible with the bell). **Ramp notes:** peak 22 = 2× D4's 14
within the cap. expectedPower 26. Everything here was taught before; only the
scale and 3-direction pressure are new. This is the campaign's combat climax —
ch7 peaks *wider but softer*.

---

### Chapter 7 — "בציר ראשון" (`ch7_harvest`)

**Fantasy:** They came with masks and orders and the hill is still here. Now
build what stays: a synagogue, a first grape harvest, and enough homes that
nobody can call this temporary.

**Terrain:** Full map open, golden early-autumn palette, squill blooming
(the season signal from authenticity research). `{seed: 10107, plateauRadius:
36, roughness: 0.34, treeDensity: 0.26, springAngle: 130, springDist: 85,
roadAngle: 215, terraces: 4, cistern: true}`. Vineyard mature (batzir-ready).
Chapter spans ~1.5 weeks — the only chapter with two Shabbatot.

**Starting kit (adds):** pop 10 (all named cast present). Resources: healthy
carry-over + 100 wood, 60 stone, 80 shekels. All builds unlocked.

**Objectives:**
- P1 Build the synagogue (band D capstone: 300 mixed, 120 s build — the
  biggest single build in the game).
- P2 Complete the grape harvest (batzir): 3 harvest work-days before the
  D9 rain event spoils remaining grapes (soft timer — spoilage, not fail).
- P3 Reach population 12 (build 2nd caravan cluster; spirit ≥ 60 attracts
  the two hitchhiking newcomers — spirit gates recruitment, as designed).
- P4 Survive the last raid (post-2nd-Shabbat) — see D11.
- Bonus B1: hold the harvest festival kumzitz with all objectives done
  (+20 spirit, unique music state).
- Bonus B2: first Torah scroll brought up the road in procession (escort
  event, D10 — pure ceremony, +10 spirit, unlocked if synagogue done early).
- Bonus B3 (echo): if ch4 was resolved by muster, the inspector's final visit
  ends with a permit ("אישור. תשמרו על עצמכם."); if dismantled, he notes the
  rebuilt pen and leaves without a word. Text-only payoff, both dignified.

**Timeline:**
- D1/day — narrated open: "שנה עברה." Objectives board shown diegetically
  (plywood sign at the zula).
- D2/day — batzir opens (grapes ripe); harvest assigns like a job, 3 worker-
  days of picking with baskets — visible progress on the vines.
- D3/night — wave `{12, [wolf×3, boar×2], 2 dirs, 90s}` — routine defense
  while economy sprints (mastery test: don't pull harvesters if you can help it).
- D4/day — visitors event: parents' visit (+10 spirit, mother-inspects-kitchen
  comedy log line) OR volunteer workday (player picks — labor vs. spirit).
- D5/day — Friday #1. D6 — Shabbat.
- D7/day — synagogue main construction window; boar wave `{10, [boar×3],
  S, 75s}` targets the drying grape racks (harvest protection twist).
- D9/day — weather: yoreh forecast ("ענני יורה מהים") — harvest soft-deadline
  beat; if harvest done: it's pure celebration when it lands.
- D10/day — Friday #2: candle-lighting in front of the (ideally finished)
  synagogue — the game's signature shot.
- D11 — Shabbat. Rumor at dusk: "הם רוצים סיבוב אחרון."
- D11/motzaei-Shabbat — **final wave** `{26, [raider×3, leader, thief×2,
  wolf×3, boar, jackal×2], 3 dirs, 120s}` — every threat type, one last time,
  against the player's full kit (expectedPower ~35 → budget at 75% = fair
  victory lap with teeth). Mid-wave lull included.
- D12/day — **the yoreh falls.** Everyone runs out, faces up: "יורה! ברוך
  השם!" (+10 spirit). Final cutscene: rain on the synagogue roof, the named
  flock in the pen, slow pan, credits interlude, free-play unlock banner.

**New mechanic:** none — mastery chapter (per SC2/AtS structure). The only
"new" content is ceremony: harvest, procession, festival.

**Duration:** ~15 min (12 days at 90 s, two Shabbatot). **Fail states:** core
caravan destroyed; spirit 0. Harvest/synagogue/population are completable in
any order; the final wave triggers on the calendar, not on objectives — an
unfinished synagogue survives the wave and completes after (the chapter only
ends when P1–P4 are done; the yoreh waits for you). **Ramp notes:** widest
wave, softest relative pressure; the chapter is a triumphant lap, and the
exhale (D12) is scripted content, never skipped.

---

## 3. Free-Play Mode ("הגבעה שלי")

### 3.1 Setup screen options

```js
freeplaySetup: {
  seed: "random | numeric input",         // terrain + name-bank shuffle
  hillPreset: "rachok|klasi|midbar|ya'ar",// terrain param bundles:
    // klasi  {plateauRadius:32, roughness:0.30, treeDensity:0.20}
    // midbar {plateauRadius:28, roughness:0.42, treeDensity:0.06} dry, spring far
    // ya'ar  {plateauRadius:26, roughness:0.36, treeDensity:0.45} wooded, boar-heavy
    // rachok {plateauRadius:34, roughness:0.24, treeDensity:0.15} gentle, far road
  storyteller: "ragua|ragil|balagan",     // Phoebe / Cassandra / Randy presets
  difficulty: 0.7 | 1.0 | 1.3,            // wave-budget multiplier ONLY
  startKitDraft: "pick 2 of 5",           // generator | 2nd dog | +4 sheep |
                                          // donkey+jerrycans | 40 shekels
  dayLength: 90 | 120,                    // seconds
  demolitionEvents: true | false          // some players want pure pastoral
}
```

### 3.2 Endless scaling

- **Nuisance waves** every 2–3 days (director-jittered): budget `3 + n`
  (n = week index), palette from threats already introduced by milestone
  (thieves after pop 6, raiders after pop 8, leader after week 6).
- **Big raid** every 3 in-game weeks, telegraphed 2 full days ahead:
  `W(n) = 8 × 1.18^n`, hard cap 60, mid-wave lull always included above
  budget 20. Directions: `min(1 + floor(n/2), 3)`.
- **Rubber-band** as campaign (0.75–1.35 on defensive power, sampled at
  telegraph). **Event director** weights the authenticity event deck (drought,
  storm, lambing, volunteers, inspector if enabled, brush fire, lost lamb,
  holidays by calendar) by spirit, wealth, and days-since-trouble; storyteller
  preset scales event frequency ×0.6 / ×1.0 / ×1.5 and allows (balagan only)
  two simultaneous pressures.
- **Milestone track** (non-violent "victory" ladder, Northgard-fame style):
  pop 15 → synagogue → 200 food banked → survive a budget-40 raid → "חווה
  מוכרת" recognition screen; play continues after.

---

## 4. Objective & Level Data Format

Chapters are **pure data** consumed by `LevelRunner` — no per-chapter code.
One JSON module per chapter at `src/levels/ch4_order.js` (ES module exporting
the object; comments allowed, ships un-built).

```js
export default {
  id: "ch4_order",
  nameHe: "הצו",
  taglineHe: "עשרה ימים. כל הגבעה עוצרת נשימה.",
  dayLengthSec: 90,
  startDayOfWeek: 1,                    // 1=Sunday; day 6 dusk = candles
  terrain: { seed: 10103, plateauRadius: 30, roughness: 0.32,
             treeDensity: 0.22, springAngle: 130, springDist: 85,
             roadAngle: 215, terraces: 2, cistern: true },
  carryOver: true,                      // merge player save with expectedState
  expectedState: { pop: 6, buildings: ["tent","patch","campfire","pen",
    "kennel","caravan","waterTower"], resources: { wood: 60, stone: 40,
    food: 35, water: 80, shekels: 70, spirit: 60 } },
  startKit: {
    units: [{ name: "נחמן", traits: ["musical"] }],
    grants: { wood: 40, stone: 30, shekels: 50 },
    setSpirit: 60
  },
  objectives: [
    { id: "resolve_order", primary: true, type: "eventResolved",
      event: "demo_order_pen", textHe: "פתרו את צו ההריסה",
      anyOutcome: ["dismantled", "frozen"] },
    { id: "spirit_floor", primary: true, type: "threshold",
      resource: "spirit", op: ">=", value: 30, scope: "always" },
    { id: "muster_big", primary: false, type: "eventResolved",
      event: "demo_order_pen", outcome: "frozen",
      minSupporters: 40, starHe: "כוח הקהילה" }
  ],
  timeline: [
    { at: { day: 2, phase: "day" }, do: "cutscene", id: "inspector_arrives" },
    { at: { day: 2, phase: "day" }, do: "startEvent", event: {
        type: "demolitionOrder", id: "demo_order_pen", target: "pen",
        timerDays: 6, refundPct: 80, spiritPerPledge: 20,
        supportersPerPledge: [12, 18], supporterFoodPerDay: 0.2,
        freezeThreshold: 30 } },
    { at: { day: 3, phase: "night" }, do: "wave", wave: {
        budget: 6, palette: ["thief"], dirs: ["S"], telegraphSec: 90 } },
    { at: { day: 4, phase: "day" }, do: "choiceEvent", id: "neighbor_or_rav",
      options: [{ grant: { shekels: 60 } }, { grant: { spirit: 15 },
        flag: "rav_hosted" }] },
    { at: { day: 8, phase: "day" }, do: "wave", wave: {
        budget: 8, palette: ["thief", "jackal"], dirs: ["S", "NE"],
        telegraphSec: 75 },
      condition: { flag: "demo_order_pen.resolved" } },
    { at: { day: 8, phase: "dusk" }, do: "cutscene",
      id: "order_resolution", variants: ["frozen", "dismantled"] }
  ],
  director: {                            // ambient deck between scripted beats
    deck: ["jackal_night_howl", "generator_hiccup", "lost_lamb"],
    maxAmbientBudget: 3, minGapDays: 1.5 },
  failStates: [
    { type: "structureDestroyed", target: "caravan_core",
      textHe: "הקרוואן המרכזי נהרס" },
    { type: "threshold", resource: "spirit", op: "==", value: 0,
      textHe: "הרוח נשברה" } ],
  triumph: { statsShown: ["built", "spiritDelta", "sheepSaved"],
    narrationHe: "..." , setFlags: ["ch4_outcome"] }
}
```

**Schema notes (contract for the engine team):**
- `at` supports `{day, phase}` or `{day, hour}`; phases: dawn/day/dusk/night.
  Anything scheduled inside Shabbat is auto-deferred to motzaei-Shabbat unless
  `allowShabbat: true` (defense-relevant events only).
- Objective `type` enum: `build` (building id + count), `accumulate`
  (resource ≥ N), `population`, `surviveWave` (wave id, lossCaps), `protect`
  (entity id / group, minCount), `eventResolved`, `threshold` (with scope
  `always|atEnd`), `reachDay`, `flag`. Primary objectives gate chapter end;
  bonus objectives set star flags read by later chapters' dialogue.
- `wave` objects are budget-based; the spawner spends budget on the palette
  (greedy, seeded) and applies rubber-band + difficulty multipliers at
  telegraph time. `dirs` map to edge angles; "S-wadi" style named lanes are
  terrain-registered spawn lanes.
- `condition` on timeline rows: flag checks only (no expressions) — keeps
  levels declarative and save-safe.
- All Hebrew strings live in the level file (levels are the localization
  unit); engine renders them via the DOM RTL layer.

---

## 5. Cross-Chapter Consistency Rules (for implementers)

1. Chapter peaks 2/6/10/8/15/22/26 assume the balance doc's expectedPower
   table; if unit stats retune, re-derive budgets at 75–85% of expectedPower
   and keep the sawtooth (ch4 valley, ch6 = combat max, ch7 = widest).
2. Every new threat type appears first in a scripted, near-loseproof teach
   beat one chapter (or ≥ 2 days) before it appears inside a real wave.
3. Every finale lands motzaei-Shabbat or dusk — never mid-Shabbat; Shabbat
   is sacred to the pacing (release valve), and defense-only during it.
4. Named cast accumulates: Elyashiv, Neriya (ch1) → Amichai (ch2) → Tehila,
   Yedidya (ch3) → Nachman (ch4) → Hodaya (ch5) → Shilo, Emuna (ch6) → +2
   hitchhikers (ch7). Dogs: Lavi, Sufa, Bamba. Deaths never occur in campaign;
   injuries heal by morning.
5. Autosave points are engine-level, not level data; levels only add the
   pre-finale checkpoint via `checkpoint: true` on a timeline row.
6. Chapter select screen shows earned stars (bonus objectives) and the ch4
   choice icon — the campaign's single persistent branch.
