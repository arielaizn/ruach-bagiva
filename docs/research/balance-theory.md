# Balance Theory for Hilltop RTS

Practical frameworks for balancing a settlement RTS with defensive waves, tuned for our
constraints: 7 campaign chapters of 8–15 minutes each, defensive-only combat, a 7-day
Shabbat cycle, six resources (wood, stone, food, water, shekels, spirit), and full
client-side play with localStorage saves. All numbers are a *starter framework* — expect
±30% tuning after playtests, but keep the *ratios* stable.

---

## 1. Economy: Cost Curves and Payback Times

### 1.1 The payback-time rule

The single most useful economy metric is **payback time**: `cost ÷ marginal income per
minute`. Genre norms (Age of Empires villagers, They Are Billions tents/quarries,
classic city builders):

| Building tier | Payback time | Feel |
|---|---|---|
| Tier-1 income (first sheep pen, vegetable patch) | 45–90 s | "Obviously worth it" |
| Tier-2 income (olive grove, larger flock, market run) | 2–3 min | "Investment" |
| Tier-3 income (water tower, generator-powered workshop) | 3–5 min | "Commitment" |
| Defense (fence, watchtower, dog kennel) | never pays back directly | Pays back in *not losing things* |

With 8–15 minute chapters, **nothing should have a payback longer than ~1/3 of the
chapter length** (≈4–5 min max), or the rational player never builds it. Tier-3 economy
belongs to chapters 4+ where chapters are longer.

### 1.2 Cost-curve shape between tiers

Use **geometric cost growth with geometric output growth, but let efficiency improve
slightly**: each tier costs ~2.5–3× the previous and yields ~3–3.5× the income. Higher
tiers being *slightly more efficient per shekel* is what motivates teching up; the
catch is the lump-sum barrier and the build time. If higher tiers are less efficient,
players spam tier-1 (the "tent spam" degenerate strategy in They Are Billions survival,
where tents remain optimal too long).

**Duplicate-building soft cap:** to prevent monoculture spam, either
(a) raise the cost of the Nth copy of the same building: `cost_N = base × 1.15^(N-1)`
(Frostpunk 2 and many builders do a variant of this), or
(b) gate on a scarce input — our natural gates are **water** (spring flow is finite)
and **workers** (population capped by housing/caravans). Prefer (b): it's diegetic
(a hilltop really is water- and people-limited) and easier to read than hidden price
inflation. Reserve (a) only for housing itself if caravan-spam becomes degenerate.

### 1.3 Worker opportunity cost

Every building that needs a worker competes with shepherding, water-hauling, and guard
duty. Make worker income roughly uniform across mature assignments (±20%): if one job
yields double, the others are traps. Differentiate jobs by *resource type* and *risk*
(shepherding yields food but exposes sheep to wolves), not by raw rate.

### 1.4 Defense spending ratio

Rule of thumb from tower-defense economics: the player should be pushed to spend
**20–35% of cumulative income on defense**. Below 20%, waves are decoration; above
40%, the game stops being a settlement builder and becomes a TD. Tune wave strength
(Section 3) so that a player who spent ~25–30% on defense wins with light damage, ~15%
wins with visible losses, and ~5% loses sheep/structures but not the outpost (see
anti-frustration, Section 7).

---

## 2. Combat Readability: HP/DPS Ratios

### 2.1 Time-to-kill (TTK) as the master knob

Players don't read HP and DPS; they read **how long a fight takes and who's winning**.
Target TTKs for a readable, low-unit-count defensive game:

- **One defender vs one basic threat (shepherd with sling vs jackal):** 3–5 s.
  Short enough to feel effective, long enough to see the exchange.
- **One defender vs a tough threat (boar, masked raider):** 8–12 s — signals "get help."
- **Threat vs civilian/livestock:** a wolf should need **6–10 s to kill a sheep** —
  a real, watchable window to respond, never instant.
- **Threat vs structure (raider dismantling a fence/stealing from storage):** 15–25 s,
  with visible/audible progress (banging, dog barking) so the player can interrupt.

Keep the roster tiny and stat spreads coarse. With ≤6 defender types and ≤6 threat
types, use **coarse bands** (HP in steps of ×2, DPS in steps of ×1.5) so differences
are felt, not measured. Fine-grained ±10% stats are invisible noise at this scale.

### 2.2 The counter triangle, defensive edition

Even defensive-only combat needs rock-paper-scissors so composition matters:

- **Dogs**: fast, cheap, great vs animals (wolves/jackals), weak vs armed raiders.
- **Slinger shepherds**: ranged, good vs boars and raiders at distance, fragile up close.
- **Watchtower + fence**: area denial and warning, but static — flanking raiders and
  wave-direction variance keep them from trivializing everything.

Encode counters as **damage multipliers (×0.5 / ×1 / ×2)**, not separate stat tables —
easier to tune and to explain in one tooltip line ("dogs bite animals hard").

### 2.3 Healing and attrition

Defenders shouldn't die from routine waves — they get **injured** and recover (fully
by next morning; instantly-ish at the campfire/zula with spirit spend). Permanent
death only in campaign-critical failures. Livestock, by contrast, *can* be lost —
sheep with names are the emotional stakes, which is why wolf TTK vs sheep must be
long enough to allow a rescue.

---

## 3. Wave-Strength Scaling Formulas

### 3.1 The three families

Let `W(n)` = threat budget of wave `n` (budget = sum of point-costs of spawned enemies).

1. **Linear:** `W(n) = a + b·n`. Predictable, gentle, quickly outpaced by exponential
   player economies. Good *within a chapter* (3–5 waves).
2. **Exponential:** `W(n) = a·r^n`, `r ≈ 1.25–1.5`. Matches compounding economies;
   this is why They Are Billions swarms feel fair mid-game — but if the player
   stumbles, exponential waves create unrecoverable death spirals.
3. **Stepped/scripted:** hand-authored budgets per wave. Best for campaigns —
   full authorial control of teach→test→twist. **Use this as our primary system**,
   with formulas only as authoring guidance.

They Are Billions' documented pattern is instructive: roughly 5 → 12 → 18 → 24 → 30
(near-linear intra-run) and then a final wave of ~140 — a **>4× spike** over the
previous wave. Community consensus is that the spike is *too* large relative to the
mid-game (players cruise through wave 5 then get erased), so: **final waves should be
2–2.5× the previous wave, never 4×+**, unless the game telegraphs the exact size far
in advance and gives a long build-up window (TAB survival does telegraph; our chapters
are too short for that trick until chapter 7).

### 3.2 Budget-based spawning

Author waves as budgets, then spend the budget on a composition list:

```
jackal = 1 pt, wolf = 2, boar = 3, thief = 3, raider = 5, raider-leader = 10
wave = { budget: 14, palette: [wolf, boar], directions: 2, telegraph: 60s }
```

This lets difficulty settings and rubber-banding scale one number, while composition
stays hand-authored per chapter (composition is where the "teach" lives).

### 3.3 Rubber-banding to player strength

Static waves punish slow players and bore fast ones. Use **soft rubber-banding**:

```
W_actual = W_scripted × clamp(0.75 + 0.25 × (playerPower / expectedPower), 0.75, 1.35)
```

where `playerPower` = weighted sum of defenders, dogs, towers, fences and
`expectedPower` is authored per wave. Key properties:

- **Clamped**: never below 75% (waves stay meaningful) or above 135% (strong play is
  still rewarded — this is the classic rubber-banding sin to avoid; if playing well
  only makes enemies stronger, players feel cheated).
- **Scale threats the player has already met.** Never spawn a new enemy type via
  rubber-banding; new types are scripted beats only.
- **Sample power at telegraph time, not spawn time**, so last-second building doesn't
  spike the wave the player is about to face.
- Rubber-band on *defensive* power, not economy — punishing a big economy with bigger
  raids feels arbitrary; "more raiders come where defenses look strong-but-tempting"
  can instead be flavored as raiders targeting a prosperous outpost, but keep the
  multiplier gentle (the 1.35 cap).

### 3.4 Direction and composition variance

Scaling raw count is the weakest difficulty axis. Better axes, in escalation order:
(1) count → (2) tougher units mixed in → (3) **multiple directions** → (4) timing
pressure (night, during Shabbat eve prep, during another event). Directions are the
big one for a base-defense game: a 2-direction wave of budget 12 is far harder than a
1-direction wave of 16, because it tests layout, not just mass.

---

## 4. Campaign Difficulty Curve: Teach → Test → Twist

The standard authored-campaign pattern (visible in StarCraft II, Frostpunk scenarios,
and most mission design writing):

- **Teach**: introduce exactly one new system with training wheels (scripted, small,
  heavily telegraphed first encounter; failure nearly impossible).
- **Test**: the system at real strength, combined with everything prior.
- **Twist**: the system under a complication that breaks the learned habit (the wave
  comes *during* the constraint; two systems interact).

Budget per chapter: **one new threat OR one new mechanic, never two**, plus one twist
on an old mechanic. Across 7 chapters (see Section 8 for numbers):

| Ch | New system taught | Test | Twist |
|---|---|---|---|
| 1 | Core build loop, water/food, first jackal | trivial 2-jackal "wave" | none — pure teach |
| 2 | Shabbat cycle + wolves vs named sheep | first real night wave | wolves come Friday night (defense is fine on Shabbat; *building/repair* isn't) |
| 3 | Dogs, fences, boars raid crops | multi-direction animal wave | boars hit crops while wolves hit flock (attention split) |
| 4 | Livestock thieves + demolition-order event (non-violent) | thief wave + bureaucratic timer running simultaneously | choosing between mustering supporters and manning defenses |
| 5 | Masked raiders, watchtowers, spirit economy matured | first raider wave, 2 directions | generator breaks / water shortage during the raid build-up |
| 6 | Full economy + supply runs (hitchhiking junction) | large mixed wave | supply run must depart before Shabbat; raiders exploit the escort's absence |
| 7 | Nothing new — mastery | escalating multi-wave finale | final wave lands Motzaei Shabbat: player spends Shabbat unable to build, planning; wave hits the moment work resumes |

**Difficulty shape across chapters:** sawtooth-rising, not monotone. Each chapter
*starts* easier than the previous chapter's peak (breather + confidence), then exceeds
it. Chapter 4 or 5 should contain a deliberate valley (the demolition-order chapter is
naturally lower-combat — tension comes from the timer, not DPS). Peak intensity order
roughly: 1 < 2 < 3 < 5 < 4* < 6 < 7 (*ch4 peaks on stress, not combat).

---

## 5. Pacing Theory: Tension and Release

### 5.1 The forecast pattern (Frostpunk)

Frostpunk's core pacing device is the **weather forecast**: the player always sees the
next demand approaching (temperature drop, the Storm), builds toward it under visible
pressure, survives it, and gets an explicit relief beat. Lessons for us:

1. **Always show the next threat on a timeline.** Our diegetic version: rumors at the
   junction, dogs getting restless, jackals howling louder each night, a scout report.
   A small UI strip: "🌙 tonight: quiet | in 2 days: wolves? | Shabbat in 3 days".
2. **Storm = everything at once, but scripted and survivable.** Frostpunk's final
   storm works because every prior system feeds into surviving one telegraphed
   mega-event. That's our Chapter 7 finale.
3. **Release is designed, not incidental.** After each survived wave: morning light,
   birdsong, a spirit bonus, a short scripted kumzitz beat. Frostpunk's warm-weather
   icons exist purely to let players exhale. **Shabbat is our built-in release valve**
   (Section 6) — a structural advantage Frostpunk had to fake with weather.

### 5.2 Intensity curve inside a 10-minute chapter

Target an interest curve like: hook (min 0–1: something small happens immediately) →
build (2–6: economy + telegraphed threat approaching) → spike (6–8: the test wave) →
twist spike (8–10: the twist, slightly higher) → resolution (30–60 s of explicit calm
and reward). Never end a chapter on the frame the last enemy dies — the exhale *is*
content.

### 5.3 Event storms

Frostpunk-style compound crises (two problems at once) are our "twist" tool. Rules:
never more than **two simultaneous pressures**; at least one must be solvable by a
decision rather than APM (e.g., demolition order = decision, raid = execution);
compound events only from chapter 3 on.

### 5.4 The They Are Billions lesson, restated

Its brilliance: one enormous, known, scheduled final threat makes *every* economic
decision meaningful. Its flaw: the difficulty cliff between "cruising" and "erased."
Adopt the telegraphed-finale structure (chapter 7, and free-play's recurring "big
raid" every ~3 in-game weeks); reject the 4× cliff — cap wave-to-wave growth at 2.5×
and give the finale a mid-wave lull where the player can rotate defenders and repair.

---

## 6. Shabbat as Strategic Rhythm (Not Annoyance)

Design principle: a forced pause is only fun if (a) it's **plannable**, (b) it
**gives** something, and (c) it creates **interesting decisions before and after** —
otherwise it's downtime tax. Mechanics:

1. **Fixed, visible clock.** Day counter always shows "X days to Shabbat." Friday
   afternoon gets a distinct golden light + music shift; candle-lighting is the
   handoff moment. Predictability converts interruption into rhythm.
2. **Shabbat gives spirit.** Spirit regeneration is *concentrated* in Shabbat
   (+big chunk) and kumzitz. Spirit gates the best stuff (rally speed, morale auras,
   recovery, event options in ch4-style crises). Skipping-Shabbat isn't an option
   mechanically — so make it feel like the *engine*, not the brake: players should
   end the week eager for the recharge.
3. **Friday is the crunch beat.** Everything preparable must be prepared: jerrycans
   filled, flock penned early, cholent... i.e., food stocked, repairs finished,
   guard roster set. Friday naturally becomes the most intense planning phase of the
   week — a weekly mini-deadline, which is exactly a tension/release cycle for free.
4. **What halts vs what runs (crucial tuning):** building, resource gathering, repair,
   and supply runs halt. **Defense never halts** — guarding is pikuach nefesh; dogs,
   guards, and towers work fully. This is non-negotiable for frustration reasons: a
   wave the player literally cannot respond to is unacceptable. The Shabbat-wave twist
   (ch2, ch7) is therefore about *not being able to repair/build/reinforce*, never
   about not being able to fight.
5. **Timers freeze fairly.** Any countdown that would tick into Shabbat (demolition
   order, spoilage) either pauses or its deadline is set post-Shabbat — the player
   should never lose to a timer they were forbidden to act on.
6. **Optional time-skip with a cost-benefit.** Offer "rest through Shabbat" (fast-
   forward with auto-pause on attack) so the pause never bores; but sprinkle small
   scripted Shabbat scenes (a guest, a song, a quiet flock shot) so players who stay
   get flavor and occasional spirit bonuses. Target real-time length: **45–70 s** if
   not skipped — long enough to feel, short enough inside a 10-minute chapter (in
   free-play, day length can be longer).
7. **Strategic depth emerges from the cadence:** payback-time math interacts with the
   6-workday week (a building finished Thursday earns nothing on day 7 — build early
   in the week); wave scheduling around the cycle creates a metagame ("raiders know
   we don't rebuild fences on Shabbat"); Motzaei Shabbat becomes a natural "burst"
   beat — full spirit, everything resumes, big plans execute.

---

## 7. Anti-Frustration Features

For a cozy-gritty single-player game, tune losing to be **local, legible, and
recoverable**:

1. **Telegraph every wave.** 60–90 s warning minimum (dogs bark toward the direction,
   dust cloud, howls, UI banner with direction arrow). First encounter of any new
   threat type gets an extra scripted intro (spotted at distance, named in a bark of
   dialogue) before it can do damage.
2. **Grace periods.** No hostile spawns in: the first 2 minutes of any chapter, the
   60 s after a wave ends, and (in early chapters) during Shabbat itself. New-building
   grace: a structure can't be targeted within 30 s of placement.
3. **Losses are graduated, not binary.** Wave outcomes degrade: perfect → sheep
   injured → sheep stolen (recoverable via a follow-up "track the thieves" objective)
   → structure damaged → structure destroyed. Outpost-level failure only if the core
   caravan falls, and it takes sustained neglect to get there.
4. **Catch-up mechanics.** (a) Losing a wave badly grants a spirit surge ("the hill
   rallies") and a neighbor's donation event (small wood/food drop from a nearby
   outpost — diegetic rubber-banding); (b) rubber-band floor (Section 3.3) already
   shrinks the *next* wave by up to 25%; (c) resource-storage floors — food/water
   can hit 0 and cause spirit drain + work slowdown, but never instant deaths.
5. **Pause-and-plan.** Full pause with command queuing always available (single-player,
   client-side — no reason not to). Game speed 1×/2×/3×.
6. **Autosave** to localStorage at chapter start, after each survived wave, and every
   Friday at candle-lighting (a thematically perfect checkpoint). Offer "retry from
   last Shabbat" on failure.
7. **No hidden failure.** Anything that can wound the player must be audible/visible:
   generator fuel low = sputtering sound; water low = dry-spring animation; boars in
   crops = crunching + dog barking. If the player loses something silently, that's a
   bug, not difficulty.
8. **Difficulty settings** scale the wave budget multiplier (0.7 / 1.0 / 1.3) and
   rubber-band floor only — never the economy, so the sandbox always feels the same.

---

## 8. Concrete Numeric Starter Framework

Assumptions: 8–15 min chapters; in-game day ≈ 75 s (ch1–3) to 90 s (ch4–7), so a
7-day week ≈ 9–10.5 min ≈ one chapter ≈ one Shabbat per chapter (ch7 spans ~1.5 weeks).
All rates are per real-time minute at normal speed.

### 8.1 Resource income rates (per assigned worker/building, mature)

| Source | Yield/min | Notes |
|---|---|---|
| Spring (base, free) | 6 water | Shared cap: spring flow max 12/min total |
| Worker w/ jerrycans | +4 water | Donkey upgrade: +8 |
| Vegetable patch (1 worker) | 5 food | Boar-vulnerable |
| Flock of 4 sheep + shepherd | 7 food | Wolf-vulnerable; +1.5 food/min per extra sheep |
| Olive grove (tier 2) | 10 food equivalent | 90 s to first yield |
| Woodcutter | 6 wood | |
| Stone gatherer | 4 stone | |
| Junction supply run | 25 shekels / trip (~2.5 min round) | Ties up 1 worker + donkey |
| Shabbat | +30 spirit (lump) | Kumzitz: +10 spirit, once per night |
| Baseline spirit drift | −1/min | Hunger/thirst: −3/min extra each |

Consumption: **1 food + 1 water per person per day** (≈0.8/min each at 5 pop). Design
so a 5-pop outpost needs ~2 dedicated food workers and ~1 water worker — roughly half
the population on subsistence early, dropping to a third by chapter 5.

### 8.2 Building cost bands

| Band | Cost (mixed wood/stone/shekels) | Build time | Examples | Payback target |
|---|---|---|---|---|
| A (starter) | 15–30 total units | 10–20 s | tent, vegetable patch, fence segment, zula | 45–90 s |
| B (core) | 40–80 | 25–40 s | caravan (+2 pop), sheep pen, dog kennel, campfire | 2–3 min |
| C (advanced) | 100–180 | 45–75 s | watchtower, water tower, generator, olive grove | 3–5 min |
| D (chapter capstone) | 220–350 | 90–120 s | container storehouse, big pen, second caravan cluster | narrative/defense value |

Fence segment: 5 wood, 6 s, 60 HP. Repairs cost 30% of build cost.
Duplicate housing surcharge (only if playtests show caravan spam): ×1.15 per copy.

### 8.3 Unit stat bands

Defenders (HP / DPS / speed in tiles-s, coarse bands per Section 2.1):

| Unit | HP | DPS | Speed | Cost | Notes |
|---|---|---|---|---|---|
| Settler (unarmed) | 40 | 2 | 1.0 | — | Flees by default |
| Slinger shepherd | 50 | 8 (range 6) | 1.0 | 20 shekels gear | ×2 vs boar |
| Guard dog | 35 | 10 | 1.8 | 30 food + kennel | ×2 vs wolf/jackal, ×0.5 vs raider |
| Watchtower | 150 | 12 (range 9) | — | band C | +90 s wave warning radius |

Threats (HP / DPS / pt-cost for wave budgets):

| Threat | HP | DPS | Pts | Behavior |
|---|---|---|---|---|
| Jackal | 20 | 3 | 1 | Targets stray sheep, flees at 50% HP |
| Wolf | 35 | 6 | 2 | Sheep TTK ≈ 7 s (sheep 40 HP); pack AI |
| Wild boar | 70 | 5 | 3 | Beelines crops; ignores units unless blocked |
| Livestock thief | 45 | 4 | 3 | Grabs sheep and runs; drops it at 50% HP |
| Masked raider | 60 | 8 | 5 | Attacks structures/storage; **flees when wave loses 60% strength** |
| Raider leader | 110 | 10 | 10 | Ch6+; others flee when he falls |

Sanity checks: shepherd kills jackal in ~2.5 s ✓; dog kills wolf in ~1.8 s (with ×2)
✓ but takes 2 wolves badly — packs matter; raider kills fence segment in ~8 s, dog
alone barely beats a raider (with ×0.5, dog DPS 5 vs raider 60 HP = 12 s while taking
8 DPS — dies first) ✓ dogs need backup vs humans.

### 8.4 Wave budgets per chapter (scripted, before rubber-band ×0.75–1.35)

| Ch | Waves (budget @ minute, palette, directions) | Chapter peak |
|---|---|---|
| 1 | 2 pts @ 6' (2 jackals, 1 dir, scripted-loseproof) | 2 |
| 2 | 3 @ 4' (jackals); **6 @ 8'** (wolves, night, 1 dir) — Friday-night twist | 6 |
| 3 | 5 @ 3'; 8 @ 7' (wolves+boar, 2 dir); **10 @ 10'** (boars→crops + wolves→flock) | 10 |
| 4 | 6 @ 4' (thieves); **9 @ 9'** (thieves, 2 dir) — demolition-order timer runs 5'–11' | 9 |
| 5 | 8 @ 3'; 12 @ 7' (first raiders, 1 dir, heavy telegraph); **15 @ 11'** (raiders+wolves, 2 dir) | 15 |
| 6 | 10 @ 3'; 14 @ 7' (2 dir); **20 @ 11'** (raiders+leader, 3 dir, during supply-run twist) | 20 |
| 7 | 12 @ 3'; 16 @ 6'; 20 @ 9'; Shabbat lull; **finale 30 @ ~13'** (all types, 3 dir, mid-wave 20 s lull) | 30 |

Growth checks: chapter-peak sequence 2→6→10→9→15→20→30 is sawtooth-rising with the
ch4 combat valley; no wave exceeds **2× the previous wave in the same chapter** and
the finale is 1.5× the prior peak — well under the They Are Billions 4× cliff. Free-play:
`W(n) = 8 × 1.18^n` per "big raid" every 3 in-game weeks, alternating with small
linear nuisance waves `3 + n`, hard cap at budget 60.

### 8.5 Expected player state at each chapter peak (for authoring `expectedPower`)

| Ch | Pop | Defenders (equiv. pts of defense) | Defense spend of income |
|---|---|---|---|
| 1 | 3 | 1 shepherd (≈3) | ~10% |
| 2 | 4 | 1 shepherd + pen fencing (≈6) | ~20% |
| 3 | 5 | 1 shepherd + 2 dogs + fences (≈11) | ~25% |
| 4 | 6 | +1 slinger (≈13) | ~25% |
| 5 | 7 | + watchtower (≈19) | ~30% |
| 6 | 9 | 2 towers, 3 dogs, 2 slingers (≈26) | ~30% |
| 7 | 10–12 | full kit (≈35) | ~30–35% |

Rule used: authored wave budget ≈ **75–85% of expected defense points** — the prepared
player wins with margin; the rubber-band clamp keeps the underprepared player at a
recoverable 75%.

---

## 9. Tuning Checklist (post-playtest)

1. Measure actual chapter completion times; if >15 min median, cut one wave, don't
   shrink budgets.
2. Log defense-spend %; if median <20%, waves are toothless — raise budgets 15%.
3. Watch for tier-1 spam (tent/patch monoculture) → tighten tier-2 efficiency edge.
4. If players skip every Shabbat instantly, its rewards are too abstract — move more
   spirit payoff and one scripted scene into it.
5. Any silent loss reported by a tester = add a sound/notification, not a nerf.

## Sources

- [They Are Billions — wave/swarm scaling and final-wave community analysis](https://steamcommunity.com/app/644930/discussions/0/1620599015905340861/), [zombie counts](https://steamcommunity.com/app/644930/discussions/0/1680315447976200432/), [Swarms wiki](https://they-are-billions.fandom.com/wiki/Swarms)
- [Procedural generation of levels for a tower defense game (Aalto) — HP-to-gold power curve, starting-gold effects](https://aaltodoc.aalto.fi/bitstreams/41c15cbe-c730-4958-a316-27d1a6da08f2/download)
- [Making a Tower Defense Game Part 3 — wave budget systems](https://yyz-productions.com/2015/12/01/making-a-tower-defense-game-part-3/)
- [Frostpunk — emotional narrative engagement analysis (Game Developer)](https://www.gamedeveloper.com/design/frostpunk-an-analysis-of-emotional-narrative-engagement), [Critical Play Report (indienova) — forecast tension/relief pacing](https://indienova.com/en/indie-game-review/critical-play-report-frostpunk/)
- [GDC: Lessons from This War of Mine and Frostpunk](https://www.gamedeveloper.com/design/video-lessons-learned-in-making-i-this-war-of-mine-i-and-i-frostpunk-i-)
