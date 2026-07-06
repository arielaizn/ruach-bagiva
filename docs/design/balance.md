# Hilltop RTS — Master Balance Sheet

**Version 1.0 — Systems Balance Designer**
Source of truth for every gameplay number. Consistent with `docs/design/gdd.md` (costs, rosters,
Spirit economy) and `docs/research/balance-theory.md` (ratios, TTKs, wave theory). Where the GDD
and this sheet disagree on a number, **this sheet wins**; where a system's *shape* is in question,
the GDD wins. Expect ±30% tuning after playtests — tune values, keep ratios.

The whole sheet is mirrored as a paste-ready `BALANCE` JS object in §10.

---

## 0. Timebase (decision)

The GDD's draft "75/90 s full day" is superseded. Reasons: (a) a 75 s day makes the day/night
tactical rhythm (push out by day, hold at night) too short to act in; (b) GDD chapters are
30–60 min runs, which needs ~2 in-game weeks per chapter, not one.

| Constant | Value | Notes |
|---|---|---|
| Daytime length | **100 s** (dawn 10 s + work 75 s + golden hour 15 s) | dayT 0.20–0.80 |
| Night length | **50 s** | Predator/thief spawn window; shadow pass off |
| Full day | **150 s** (2.5 min) | Uniform across all chapters and free-play |
| Shabbat (day 7) | **60 s** real time, skippable after 15 s | +5 s candle-lighting handoff cutscene |
| Week | 6 × 150 + 60 ≈ **16 min** | One week ≈ one act; chapters run 7–12 days |
| Sim tick | 30 Hz fixed step | Speeds 0 / 1× / 2× / 3× |

All "per min" rates below are **per real-time minute at 1× speed**. Rule of thumb: 1 day = 2.5 min,
so a per-day cost of 1 unit = 0.4/min.

Chapter lengths (in-game days → sim minutes): ch1 = 7 d (16'), ch2 = 9 d (21'), ch3 = 10 d (23'),
ch4 = 10 d (23'), ch5 = 12 d (28'), ch6 = 12 d (28'), ch7 = 11 d (25'). Wall-clock with pauses and
planning typically ×1.3–1.6.

---

## 1. Resources

### 1.1 Chapter starting stock

| Ch | Wood | Stone | Food | Water | Shekels | Spirit | Pop | Sheep | Dogs | Pre-built |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 10 | 25 | 20 | 30 | 60 | 3 | 4 | 0 | core caravan, campfire |
| 2 | 60 | 20 | 30 | 25 | 40 | 55 | 4 | 6 | 0 | + tent, veg patch |
| 3 | 70 | 30 | 35 | 30 | 50 | 55 | 5 | 8 | 1 | + sheep pen, shack |
| 4 | 80 | 40 | 40 | 35 | 80 | 60 | 6 | 10 | 2 | + kennel, pergola, ~14 fence segs |
| 5 | 90 | 50 | 45 | 40 | 100 | 60 | 7 | 12 | 2 | + synagogue, zula, 20 fence segs |
| 6 | 100 | 60 | 50 | 50 | 130 | 65 | 9 | 16 | 3 | + watchtower, water tower, container |
| 7 | 120 | 80 | 60 | 60 | 150 | 70 | 10 | 20 | 3 | + generator, 2nd watchtower, dairy |

Free-play start = chapter-2 column + the drafted starting-kit pick (generator / 2nd dog + kennel /
donkey + jerrycan set).

### 1.2 Storage caps

| Resource | Base cap | Extensions |
|---|---|---|
| Wood | 100 | +150 per container |
| Stone | 80 | +120 per container |
| Food | 60 | +100 per container |
| Water | 40 (jerrycans) | +200 water tower, +150 cistern |
| Shekels | ∞ | — |
| Spirit | 100 (meter 0–100) | — |

Gathering into a full cap wastes the yield and fires a one-time "storage full" bark per resource per day.

### 1.3 Gather rates (per assigned worker per minute, mature)

| Job / source | Yield/min | Notes |
|---|---|---|
| Woodcutter | 6 wood | Tree instances deplete; regrow off-screen seasonally |
| Stone gatherer | 4 stone | Rock piles; terrace restoration pays a 40-stone lump |
| Water carrier (jerrycans) | 4 water | Spring free flow adds 6/min passively **only if ≥1 carrier assigned**; total spring throughput hard-capped at 12/min settlement-wide |
| Donkey water route | 8 water | Replaces one carrier leg; needs shift-queued route |
| Vegetable patch | 5 food | 6.5 with drip lines (15₪); requires 2 water/min while worked |
| Flock + shepherd | 7 food at 4 sheep, **+1.5 per extra sheep** | 8 sheep = 13/min; cap = pen capacity |
| Olive grove (tier 2) | 10 food-equiv | 90 s to first yield; autumn masik lump +200 |
| Junction run | 25₪ / 2.5 min trip (=10₪/min) | Ties up 1 runner (+donkey doubles cargo orders) |
| Cheese run (dairy built) | 40₪ / 2.5 min trip (=16₪/min) | Consumes flock milk (auto at flock ≥6) |
| Chickens | 1 food/min passive | Flat trickle, kid-chore flavored |

### 1.4 Consumption (per minute)

| Consumer | Food | Water | Notes |
|---|---|---|---|
| Settler | 0.4 | 0.4 | = 1 unit/day each |
| Volunteer (temp) | 0.8 | 0.4 | "They eat everything" |
| Guard dog | 0.2 | 0.1 | = 0.5 food/day |
| Sheep/goat | grazes (free) | 0.1 | = 0.25 water/day |
| Veg patch (while worked) | — | 2.0 | The real water sink |
| Generator | 10₪/night | — | Silent (free) on Shabbat |

Zero food or water never kills: −3 Spirit/min each while at 0, work speed −20% each, loud
telegraph (dry-spring animation, grumbling). Design target: at 5 pop + 8 sheep, subsistence needs
**1 shepherd + 1 water carrier** (2/5 of pop), dropping to ~1/3 of pop by chapter 5.

---

## 2. Buildings

Costs/functions per GDD §3; this table adds **HP, production, worker slots, housing** as data.
Repairs cost 30% of build cost; voluntary dismantle refunds 70%. Placement grace: a structure
cannot be targeted by hostiles within 30 s of completion.

| id | Hebrew | Wood | Stone | ₪ | Other | Build s | HP | Production /min | Worker slots | Pop | Unlock |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `tent` | אוהל | 15 | 0 | 0 | — | 10 | 40 | — | 0 | +1 | ch1 |
| `shack` | צריף | 25 | 5 | 0 | — | 20 | 80 | — | 0 | +1 | ch1 |
| `caravan` | קרוואן | 40 | 20 | 60 | arrives next dawn | 30 | 300 | — | 0 | +2 | ch1 |
| `sheep_pen` | דיר | 30 | 10 | 0 | — | 30 | 120 | (enables flock econ) | 0 | 8 sheep (16 w/ net +20 wood) | ch1 |
| `veg_patch` | ערוגות ירק | 10 | 0 | 0 | 5 water | 12 | 50 | 5 food (6.5 w/ drip) | 1 | — | ch1 |
| `campfire` | מדורה | 10 | 5 | 0 | — | 10 | 40 | +0.5 Spirit r8 (evenings) | 0 | — | ch1 |
| `fence` | גדר (segment) | 5 | 0 | 0 | — | 6 | 60 (100 w/ stone base +3 stone) | — | 0 | — | ch2 |
| `pergola` | פרגולה | 20 | 0 | 0 | — | 15 | 60 | +1 Spirit per meal event | 0 | — | ch2 |
| `synagogue` | פינת בית כנסת | 30 | 15 | 0 | — | 30 | 120 | Shabbat lump 30→40 (45 w/ ark); dawn buff +10% work until noon | 0 | — | ch2 |
| `kennel` | מלונה | 25 | 0 | 0 | 30 food | 25 | 80 | dog auto-intercept r15 | 0 | 2 dogs | ch3 |
| `zula` | זולה | 20 | 0 | 0 | — | 15 | 60 | half-day full recovery; 5 Spirit = instant | 0 | — | ch3 |
| `container` | מכולה | 80 | 40 | 100 | — | 60 | 250 | +150 wood/+120 stone/+100 food caps | 0 | +1 (window +10 wood) | ch4 |
| `cistern` | בור מים | 0 | 40 | 0 | fixed map spots | 45 | 150 | +150 water cap; +40 water per rain | 0 | — | ch4 |
| `water_tower` | מגדל מים | 60 | 40 | 60 | — | 60 | 200 | +200 water cap; fetch trips ×0.5 in r20 | 0 | — | ch4 |
| `watchtower` | מגדל שמירה | 50 | 60 | 0 | — | 60 | 150 | 12 DPS r27 m; telegraph +90 s in arc | 1 garrison (+50% DPS) | — | ch5 |
| `generator` | גנרטור | 20 | 0 | 100 | fuel 10₪/night | 40 | 100 | night light r12: −30% hostile courage; noise −1 Spirit/min to housing r8 | 0 | — | ch5 |
| `dairy` | מחלבה | 60 | 30 | 80 | flock ≥6 | 50 | 150 | milk→cheese; junction runs 25₪→40₪ | 1 | — | ch6 |

Payback sanity (per balance-theory bands): veg patch = 15 units ÷ 5/min ≈ **~1 min** (band A ✓);
sheep pen + 2 sheep ≈ 90 units ÷ 4.5/min marginal ≈ **~2.5 min** (band B ✓); water tower ≈ 160
units, pays back **3–5 min** in freed carrier-minutes (band C ✓); dairy 170 units ÷ 6₪/min
marginal ≈ **~4.5 min** (band C ✓). Housing surcharge ×1.15 per duplicate **only** applied to
`tent`/`shack`/`caravan`, and only enabled if playtests show housing spam (`housingSurcharge` flag).

---

## 3. Friendly units

Speeds in m/s on the 256 m map (GDD's ratio bands × 3.0; settlement radius ≈ 40 m, so a
cross-base sprint ≈ 8–13 s). Damage model: `damage` per hit, `cooldown` s between hits
(DPS = damage/cooldown). Vision = telegraph/aggro radius in m. Defenders are **injured, never
killed**, in routine waves (recover by next morning; ×2 at campfire; instant at zula for 5 Spirit).

| Unit | Hebrew | HP | Damage | Cooldown s | DPS | Range m | Speed m/s | Vision m | Cost / recruit rule |
|---|---|---|---|---|---|---|---|---|---|
| Settler | מתיישב/ת | 40 | 2 | 1.0 | 2 | melee | 3.0 | 20 | Needs free housing + Spirit ≥ 50 (hitchhiker joins); auto-join at Spirit ≥ 80 |
| Slinger shepherd | רועה עם קלע | 50 | 12 | 1.5 | 8 | 18 | 3.0 | 24 | Settler + 20₪ gear; ×2 dmg vs boar; courage −15/hit |
| Guard | שומר | 50 | 6 | 1.0 | 6 | melee (torch) | 3.0 | 30 + flashlight cone 25×60° | Settler on nightly roster; +60 s telegraph on his patrol arc |
| Guard dog | כלב שמירה | 35 | 5 | 0.5 | 10 | melee | 5.4 | 25 (35 at night, smell) | 30 food + free kennel slot; ×2 vs wolf/jackal, ×0.5 vs humans; bark courage −4/s AoE r6 |
| Donkey | חמור | 60 | — | — | — | — | 2.7 loaded / 3.9 | 15 | 40₪ or event; hauls 4× human load; refuses mud (winter) |
| Sheep / goat | כבשה / עז | 40 | — | — | — | — | 2.4 | 10 (boids follow lead goat) | Lambing (winter), 25₪ purchase, events; each named |
| Volunteer guard | מתנדב שמירה | 50 | 6 | 1.0 | 6 | melee | 3.0 | 30 | 15₪ tower phone call → 2 arrive for 3 nights; eat double |

Counter multipliers are the whole matrix — no per-matchup stat tables:
`dog → animal ×2, dog → human ×0.5, slinger → boar ×2, everything else ×1`.

TTK sanity: slinger vs jackal (20 HP) ≈ 3 s ✓ (3–5 s target); dog vs wolf (35 HP, ×2) ≈ 1.8 s ✓;
slinger vs raider (60 HP) ≈ 7.5 s, with courage drain routs him at ~4 hits ≈ 6 s ✓ (tough-threat
8–12 s band via HP, faster via courage — courage is the intended win path).

---

## 4. Hostiles

All hostiles carry **Courage 100** (drains: dog bark 4/s r6, sling hit 15, floodlit zone 10/s,
each defender in sight 2/s, bell-mustered crowd 5/s, generator light zone 30% pre-drain, leader
routed −40 instantly). Courage 0 **or** HP flee-threshold → turns and sprints off-map = the win
state. No on-screen deaths, ever.

| Threat | Hebrew | HP | Damage | Cooldown s | DPS | Speed m/s | Flee at HP % | Pts | Behavior notes |
|---|---|---|---|---|---|---|---|---|---|
| Jackal | תן | 20 | 3 | 1.0 | 3 | 4.8 | 50% (or any dog contact) | 1 | Night packs 2–4; targets stray sheep |
| Wolf | זאב | 35 | 6 | 1.0 | 6 | 5.1 | 40% | 2 | Sheep TTK ≈ 7 s (rescue window); pack encircles; light drains courage −20/s |
| Wild boar | חזיר בר | 70 | 10 | 2.0 | 5 | 4.2 | 30% | 3 | Beelines crops; ignores units unless blocked; ×2 from slings |
| Livestock thief | גנב מקנה | 45 | 4 | 1.0 | 4 | 3.6 (2.4 carrying) | 50% (drops sheep) | 3 | Grabs named sheep → off-map truck; stolen sheep = trackable follow-up |
| Masked raider | פורע רעול פנים | 60 | 8 | 1.0 | 8 | 3.3 | 25%, and whole wave flees at −60% wave strength | 5 | Dismantles structures 15–25 s each, loud |
| Raider leader | מנהיג הפורעים | 110 | 10 | 1.0 | 10 | 3.3 | 20% | 10 | Ch6+; his rout = −40 courage to all; prioritizes towers |

Structure damage: raider vs fence segment (60 HP) ≈ 8 s ✓; vs stone-based fence ≈ 13 s;
vs watchtower ≈ 19 s — all inside the 15–25 s audible-interrupt band except plain fences,
which are meant to be the fast, cheap first line.

---

## 5. Waves

### 5.1 The formula

```
waveBudget(chapter, day, playerStrength) =
    scripted[chapter][day].budget          // authored, table below
  × difficultyMult                          // 0.7 / 1.0 / 1.3 (menu; never touches economy)
  × clamp(0.75 + 0.25 × playerStrength / scripted[chapter][day].expectedPower, 0.75, 1.35)
```

- `playerStrength` = defense points, **sampled at telegraph time** (75 s before spawn), never respawned after.
- Defense points: slinger 3, guard on roster 2, volunteer guard 2, dog 3, watchtower 6
  (+2 garrisoned, +2 floodlight), generator night-light 2, fence ring +0.2/segment (cap +4).
- Rubber-band scales **count of already-met types only**; new types are scripted beats.
- Free-play: nuisance wave every 4th night `W = 3 + n` (n = nuisance index); big raid every 3
  weeks `W(n) = round(8 × 1.18^n)`, hard cap 60.

### 5.2 Scripted campaign schedule (budgets before multipliers)

All waves spawn at **night start** of the listed day and are telegraphed 75 s earlier
(60 s floor with empty guard roster, +90 s inside watchtower arcs). Grace: no spawns in the first
2 min of a chapter, 60 s after any wave, and during Shabbat in ch1–3.

| Ch | Days | Waves: day → budget (palette / directions) | expectedPower | Peak |
|---|---|---|---|---|
| 1 | 7 | d5 → **2** (2 jackals / 1 dir, lose-proofed) | 3 | 2 |
| 2 | 9 | d3 → 3 (jackals / 1) · d6 **Friday night** → **6** (wolves / 1) | 4 / 6 | 6 |
| 3 | 10 | d2 → 5 (jackals+wolf / 1) · d6 → 8 (wolves+boar / 2) · d9 → **10** (boars→crops + wolves→flock / 2) | 7 / 10 / 11 | 10 |
| 4 | 10 | d3 → 6 (thieves / 1) · d8 → **9** (thieves / 2); demolition timer runs d4–d7 (frozen on Shabbat d7 → expires d8 dawn) | 11 / 13 | 9 |
| 5 | 12 | d2 → 8 (wolves+boars / 2) · d6 → 12 (first raiders / 1, heavy telegraph) · d10 → **15** (raiders+wolves / 2) | 14 / 16 / 19 | 15 |
| 6 | 12 | d2 → 10 (mixed animals / 2) · d6 → 14 (raiders / 2) · d10 → **20** (raiders+leader / 3, during supply-run twist) | 20 / 23 / 26 | 20 |
| 7 | 11 | d2 → 12 (mixed / 2) · d4 → 16 (raiders / 2) · d6 → 20 (raiders+thieves / 3) · d7 Shabbat lull · **motzaei Shabbat d7 night → 30** (all types / 3, with a 20 s mid-wave lull) | 28 / 30 / 32 / 35 | 30 |

Growth checks: peaks 2→6→10→9→15→20→30 (sawtooth-rising, ch4 combat valley); no intra-chapter
wave exceeds ×2 the previous; finale = 1.5× prior peak; budgets sit at 75–91% of expectedPower.

### 5.3 Composition rules (budget → spawn list)

1. **Palette purity:** never mix animals and humans in one wave except where scripted (ch5 d10, ch7).
2. **Leader first:** if palette includes leader and budget ≥ 20, buy exactly 1.
3. **Greedy spend:** repeatedly buy the most expensive affordable palette unit; when remaining
   budget < cheapest palette cost, fill with jackals (animal waves) or drop the remainder (human waves).
4. **Count clamp 3–12 units per wave** (map-wide hostile cap 16): if the spend yields >12, merge
   cheapest pairs into the next tier up until ≤12.
5. **Directions:** as scripted; free-play: 1 if budget <10, 2 if <20, else 3. Multi-direction
   splits the spawn list round-robin by point value.
6. Post-wave: +5 Spirit (+3 more for zero losses), 60 s grace, event-log summary line.

---

## 6. Spirit (רוח)

One settlement-wide meter 0–100. Baseline drift **−1/min**.

### 6.1 Sources

| Source | Amount |
|---|---|
| Shabbat (lump at candle-lighting) | +30 (synagogue +40, ark upgrade +45) |
| Kumzitz (10 wood, once/night) | +10 (Motzaei Shabbat +15) |
| Wave survived / zero-loss bonus | +5 / +3 |
| Building completed | +2 |
| New settler joins | +5 |
| Yoreh first rain, holidays | +10 |
| Sheep recovered / lamb born | +8 / +3 |
| Demolition order defeated by muster | +10 |
| Campfire radius (evenings, r8) | +0.5/min |
| Zula fairy lights (night, r5) | +1/min |
| "The hill rallies" (post-bad-loss catch-up) | +15 (with neighbor donation: 20 wood + 15 food) |

### 6.2 Sinks

| Sink | Amount |
|---|---|
| Baseline drift | −1/min |
| Hunger / thirst (at 0 stock) | −3/min each |
| Sheep lost / structure destroyed | −5 / −8 |
| Demolition order: arrival / self-dismantle / ignored | −10 / −10 / −20 |
| Generator noise (housing in r8, nights) | −1/min |
| Injured settler (each, until recovered) | −2 lump |
| Muster supporters (the big strategic spend) | −25 |
| Zula instant-heal | −5 |

### 6.3 Thresholds

| Spirit | Label (HE) | Effects |
|---|---|---|
| 80–100 | רוח גבוהה | **+15% work speed**; hitchhikers auto-join; muster capacity 2 buses |
| 50–79 | רגיל | Normal; volunteers join if housed; muster capacity 1 bus |
| 25–49 | רוח נמוכה | **−10% work speed**; no new joiners |
| 0–24 | שפל | **−25% work speed, workers drift idle to the zula**; a random settler "goes home" every 2 days (returns at Spirit ≥ 50); panic buttons and muster locked |

Muster requires Spirit ≥ 25 (hard gate — the demolition order's real teeth).

---

## 7. Demolition order (צו הריסה)

| Parameter | Value |
|---|---|
| Countdown | **3 in-game days** (450 s sim); repeat visit: 2 days (300 s). Frozen during Shabbat |
| Target | One named non-core structure, weighted toward newest band-C/D building |
| Arrival penalty | −10 Spirit; bulldozer idles at map edge (visual only) |
| **A. Dismantle in time** | Builder works 30 s; refund **85%** of materials; −10 Spirit; order closed for good |
| **B. Muster supporters** | Costs **25 Spirit** + settler on water-tower ladder for a **120 s** interruptible phone channel; requires Spirit ≥ 25 |
| Supporters needed | **12** seated at the structure (repeat order: **18**) |
| Arrival rate | Bus arrives 90 s after successful call carrying **15** (2 buses = 30 if Spirit ≥ 80); backup tremp trickle 1 supporter / 30 s while the freeze attempt is live |
| While supporters sit | Order frozen; food consumption +20%/day; +2 Spirit/min at the site; crew never acts |
| Muster success | +10 Spirit; structure saved; inspector returns next chapter with the 2-day timer |
| **C. Ignore** | At T=0 the crew dismantles over 60 s; **0% refund**; −20 Spirit |

Timer math check: muster path needs 120 s call + 90 s bus = 210 s < the 300 s worst-case (repeat)
timer even if started on the final day — but only if the tower is built and Spirit is banked,
which is the intended pressure.

---

## 8. Chapter 3 economy sanity check (minute-by-minute)

Setup (from §1.1): pop 5, 8 sheep, 1 dog, wood 70, stone 30, food 35, water 30, 50₪, Spirit 55.
Chapter 3 = 10 days ≈ 23 sim minutes. Consumption: food 2.0/min (5 pop), water 2.8/min
(5 pop = 2.0 + 8 sheep = 0.8) + 2.0 while the patch is worked. Standing jobs: **shepherd**
(13 food/min), **water carrier** (4/min + spring 6/min passive = 10/min), **woodcutter** (6/min),
**builder**, **flex** (patch/stone/guard). Chapter goals: kennel + 2nd dog, ~20 fence segments,
survive waves d2/d6/d9.

| Min | Day/phase | Actions & events | Wood | Food | Water | ₪ | Notes |
|---|---|---|---|---|---|---|---|
| 0–1 | d1 day | Assign jobs; queue kennel (25w) | 70→51 | 35 | 30 | 50 | Kennel building (25 s) |
| 2 | d1 night | Kennel done (+2 Spirit); grace period | 57 | 46 | 37 | 50 | Wood +6/min; food +11 net/min |
| 3 | d2 day | Buy 2nd dog (−30 food); start fence line (10 segs = 50w) | 63→33* | 27 | 44 | 50 | *fence spend staged 5w/seg |
| 4–5 | d2 night | **Wave 1: budget 5** (3 jackals + 1 wolf, 1 dir). Bell, 2 dogs + slinger rout it in ~15 s. +5 Spirit | 25 | 38 | 51 | 50 | Power = slinger 3 + 2 dogs 6 + fence 1 = 10 vs expected 7 → ×1.11 → budget 5.5→5 (rounding) — fine |
| 6–8 | d3–d4 | Fences continue (10 more segs, 50w); flex worker starts veg patch (10w, 5 water) | 25→+18−60→dips to ~8 | 60 cap | 55 | 50 | Wood is the binding constraint, as intended |
| 9–10 | d4–d5 | Patch online (+5 food/min — food capped, so flex swaps to stone 4/min); woodcutter refills | 20 | 60 | 48 | 50 | Water dips: patch drinks 2/min → carrier still covers (10 in vs 6.8 out) |
| 11 | d5 golden | Kumzitz (−10 wood, +10 Spirit → 72) | 16 | 60 | 51 | 50 | |
| 12–13 | d6 day | Friday crunch: repairs, pen flock early, roster 1 guard | 24 | 60 | 57 | 50 | Guard tonight = telegraph secured |
| 13.5 | d6 night | **Wave 2: budget 8, 2 directions** (2 wolves + 1 boar east, 2 wolves west). Boar reaches patch for ~5 s (−8 food of standing yield), all routed. +5 Spirit | 24 | 52 | 57 | 50 | Power ≈ 12 vs expected 10 → ×1.05; split defense works: dogs east, slinger west |
| 14–15 | d7 **Shabbat** | Work greyed out; consumption continues (−5 food, −7 water over the day); **+30 Spirit → 100 (capped)** | 24 | 47 | 50 | 50 | Buffer built on d5–6 absorbs it ✓ |
| 16–17 | d8 | Motzaei-Shabbat burst (+15% work at Spirit 80+): finish fence ring, stone bases on gate segs (−6 stone) | 30 | 58 | 57 | 50 | Stone 30→24+8 gathered |
| 18–19 | d9 day | Optional junction run (flex: −2.5 min, +25₪); drip lines bought (−15₪) | 42 | 60 | 55 | 60 | Income options, not required to survive |
| 20 | d9 night | **Wave 3 (peak): budget 10, 2 dirs** — 2 boars → crops, 2 wolves + 2 jackals → flock. Attention-split test. One boar feeds 4 s (−10 food), one sheep injured (−0 lost). +5 Spirit | 42 | 48 | 55 | 60 | Power ≈ 13 (2 dogs 6, slinger 3, guard 2, fences 2) vs expected 11 → ×1.05 → 10.5→10 |
| 21–23 | d10 | Cleanup, repairs (−9 wood = 30% of damaged segs), triumph screen | 45 | 55 | 58 | 60 | Chapter closes with all stocks ≥ start |

**Closure verdict:** food never hits 0 (min ≈ 27 at the dog purchase); water never below ~37;
wood is the intended bottleneck (dips to ~8 mid-fence-build, forcing sequencing); Spirit rides
55 → 100. Defense spend = kennel 25w+30f + dog 30f + 20 fences 100w + gear ≈ **185 of ~640
cumulative income units ≈ 29%** — inside the 20–35% target band. A player who skips fences
(spend ~12%) faces wave 3 at rubber-band floor ×0.75 = budget 7 and loses 1–2 sheep + patch
damage, not the run. ✓

---

## 9. Difficulty & global knobs

| Knob | Values |
|---|---|
| Wave budget multiplier | רגוע 0.7 / רגיל 1.0 / בלגן 1.3 (never touches economy) |
| Event-director preset | calm / classic / chaos (weights only) |
| Rubber-band clamp | 0.75–1.35, always on, defensive power only, sampled at telegraph |
| Telegraph time | 75 s base; 60 s floor (empty roster); +90 s in watchtower arc; +60 s on guard patrol arc |
| Grace periods | chapter start 120 s; post-wave 60 s; new building 30 s; Shabbat spawn-free in ch1–3 |
| Autosaves | chapter start, after each survived wave, every Friday candle-lighting; "retry from last Shabbat" |
| Panic buttons (cooldown 3 in-game days each) | "שחרר את הכלבים!" — all dogs sprint to point, bark drain ×3 for 10 s · "כולם החוצה!" — every settler slings 30 s, +2/s courage aura settlement-wide |

---

## 10. `BALANCE` object (paste into `src/balance.js`)

```js
// Master balance data — Hilltop RTS. Generated from docs/design/balance.md v1.0.
// Units: seconds, meters, m/s, per-real-minute rates at 1x speed. Tune values, keep ratios.
export const BALANCE = {
  time: {
    dayLenS: 150, daytimeS: 100, nightS: 50, dawnS: 10, goldenHourS: 15,
    shabbatS: 60, shabbatSkippableAfterS: 15, weekDays: 7, shabbatDay: 7,
    simHz: 30, speeds: [0, 1, 2, 3],
    chapterDays: { 1: 7, 2: 9, 3: 10, 4: 10, 5: 12, 6: 12, 7: 11 },
  },

  resources: {
    caps: {
      wood: 100, stone: 80, food: 60, water: 40, shekels: Infinity, spirit: 100,
      perContainer: { wood: 150, stone: 120, food: 100 },
      waterTower: 200, cistern: 150,
    },
    chapterStart: { // [wood, stone, food, water, shekels, spirit, pop, sheep, dogs]
      1: { wood: 40,  stone: 10, food: 25, water: 20, shekels: 30,  spirit: 60, pop: 3,  sheep: 4,  dogs: 0 },
      2: { wood: 60,  stone: 20, food: 30, water: 25, shekels: 40,  spirit: 55, pop: 4,  sheep: 6,  dogs: 0 },
      3: { wood: 70,  stone: 30, food: 35, water: 30, shekels: 50,  spirit: 55, pop: 5,  sheep: 8,  dogs: 1 },
      4: { wood: 80,  stone: 40, food: 40, water: 35, shekels: 80,  spirit: 60, pop: 6,  sheep: 10, dogs: 2 },
      5: { wood: 90,  stone: 50, food: 45, water: 40, shekels: 100, spirit: 60, pop: 7,  sheep: 12, dogs: 2 },
      6: { wood: 100, stone: 60, food: 50, water: 50, shekels: 130, spirit: 65, pop: 9,  sheep: 16, dogs: 3 },
      7: { wood: 120, stone: 80, food: 60, water: 60, shekels: 150, spirit: 70, pop: 10, sheep: 20, dogs: 3 },
    },
    ratesPerMin: {
      woodcutter: 6, stoneGatherer: 4,
      waterCarrier: 4, donkeyWaterRoute: 8, springPassive: 6, springTotalCap: 12,
      vegPatch: 5, vegPatchDrip: 6.5,
      flockBase: 7, flockBaseSheep: 4, flockPerExtraSheep: 1.5,
      oliveGrove: 10, chickens: 1,
      junctionTripShekels: 25, junctionTripS: 150,
      cheeseTripShekels: 40, oliveOilSeasonalLump: 80, masikFoodLump: 200,
    },
    consumptionPerMin: {
      settlerFood: 0.4, settlerWater: 0.4, volunteerFoodMult: 2,
      dogFood: 0.2, dogWater: 0.1, sheepWater: 0.1, vegPatchWater: 2.0,
      generatorFuelShekelsPerNight: 10,
    },
    starvation: { spiritPerMin: -3, workSpeedMult: 0.8, neverKills: true },
  },

  buildings: { // cost{}, buildS, hp, workerSlots, pop, unlockCh, extras
    tent:        { cost: { wood: 15 }, buildS: 10, hp: 40,  pop: 1, unlockCh: 1 },
    shack:       { cost: { wood: 25, stone: 5 }, buildS: 20, hp: 80, pop: 1, unlockCh: 1 },
    caravan:     { cost: { wood: 40, stone: 20, shekels: 60 }, buildS: 30, hp: 300, pop: 2, unlockCh: 1, core: true, porchUpgrade: { wood: 10, spiritAuraR: 6, spiritPerMin: 5 / 60 } },
    sheep_pen:   { cost: { wood: 30, stone: 10 }, buildS: 30, hp: 120, sheepCap: 8, unlockCh: 1, shadeNet: { wood: 20, sheepCap: 16, milkYieldMult: 1.2 } },
    veg_patch:   { cost: { wood: 10, water: 5 }, buildS: 12, hp: 50, workerSlots: 1, foodPerMin: 5, unlockCh: 1, dripLines: { shekels: 15, foodPerMin: 6.5 } },
    campfire:    { cost: { wood: 10, stone: 5 }, buildS: 10, hp: 40, spiritAuraR: 8, spiritPerMin: 0.5, recoveryMult: 2, unlockCh: 1 },
    fence:       { cost: { wood: 5 }, buildS: 6, hp: 60, unlockCh: 2, stoneBase: { stone: 3, hp: 100 } },
    pergola:     { cost: { wood: 20 }, buildS: 15, hp: 60, mealSpirit: 1, unlockCh: 2 },
    synagogue:   { cost: { wood: 30, stone: 15 }, buildS: 30, hp: 120, shabbatLump: 40, dawnWorkBuff: 0.10, unlockCh: 2, arkUpgrade: { wood: 40, shabbatLump: 45 } },
    kennel:      { cost: { wood: 25, food: 30 }, buildS: 25, hp: 80, dogSlots: 2, interceptR: 15, unlockCh: 3, secondAllowedCh: 5 },
    zula:        { cost: { wood: 20 }, buildS: 15, hp: 60, recoverHalfDay: true, instantHealSpirit: 5, unlockCh: 3, fairyLights: { shekels: 10, spiritPerMin: 1, r: 5 } },
    container:   { cost: { wood: 80, stone: 40, shekels: 100 }, buildS: 60, hp: 250, capBonus: { wood: 150, stone: 120, food: 100 }, unlockCh: 4, windowCut: { wood: 10, pop: 1 } },
    cistern:     { cost: { stone: 40 }, buildS: 45, hp: 150, waterCap: 150, rainCollect: 40, fixedSpots: true, unlockCh: 4 },
    water_tower: { cost: { wood: 60, stone: 40, shekels: 60 }, buildS: 60, hp: 200, waterCap: 200, fetchTripMult: 0.5, fetchR: 20, unlockCh: 4 },
    watchtower:  { cost: { wood: 50, stone: 60 }, buildS: 60, hp: 150, damage: 18, cooldownS: 1.5, rangeM: 27, telegraphBonusS: 90, garrisonSlots: 1, garrisonDpsMult: 1.5, unlockCh: 5, floodlight: { shekels: 30, needsGenerator: true, courageDrainR: 10 } },
    generator:   { cost: { wood: 20, shekels: 100 }, buildS: 40, hp: 100, lightR: 12, courageMultInLight: 0.7, noiseR: 8, noiseSpiritPerMin: -1, fuelPerNight: 10, unlockCh: 5, solar: { shekels: 80, noFuel: true, noNoise: true, noLight: true } },
    dairy:       { cost: { wood: 60, stone: 30, shekels: 80 }, buildS: 50, hp: 150, workerSlots: 1, needsFlock: 6, cheeseTripShekels: 40, unlockCh: 6 },
  },
  buildingRules: {
    repairCostFrac: 0.30, dismantleRefundFrac: 0.70, newBuildingGraceS: 30,
    maxSlopeGrade: 0.4, housingSurcharge: { enabled: false, factorPerCopy: 1.15 },
  },

  units: { // hp, damage, cooldownS, rangeM (0=melee), speed m/s, visionM, multipliers, cost
    settler:   { hp: 40, damage: 2,  cooldownS: 1.0, rangeM: 0,  speed: 3.0, visionM: 20, recruit: { housing: true, minSpirit: 50, autoJoinSpirit: 80 } },
    slinger:   { hp: 50, damage: 12, cooldownS: 1.5, rangeM: 18, speed: 3.0, visionM: 24, courageDrainPerHit: 15, vs: { boar: 2 }, cost: { shekels: 20 } },
    guard:     { hp: 50, damage: 6,  cooldownS: 1.0, rangeM: 0,  speed: 3.0, visionM: 30, flashlightConeM: 25, flashlightConeDeg: 60, telegraphBonusS: 60, unrosteredSleepWorkBuff: 0.10 },
    dog:       { hp: 35, damage: 5,  cooldownS: 0.5, rangeM: 0,  speed: 5.4, visionM: 25, nightVisionM: 35, barkDrainPerS: 4, barkR: 6, vs: { animal: 2, human: 0.5 }, cost: { food: 30, kennelSlot: 1 } },
    donkey:    { hp: 60, speedLoaded: 2.7, speed: 3.9, visionM: 15, haulMult: 4, refusesMudSeason: 'winter', cost: { shekels: 40 } },
    sheep:     { hp: 40, speed: 2.4, visionM: 10, cost: { shekels: 25 }, spiritOnLoss: -5, spiritOnRecover: 8 },
    volunteerGuard: { hp: 50, damage: 6, cooldownS: 1.0, speed: 3.0, visionM: 30, callCost: { shekels: 15 }, count: 2, staysNights: 3, foodMult: 2 },
  },
  defenderRules: { injuredNotKilled: true, recoverBy: 'nextMorning', campfireRecoveryMult: 2, zulaInstantHealSpirit: 5 },

  hostiles: { // hp, damage, cooldownS, speed, fleeHpFrac, pts
    jackal:  { hp: 20,  damage: 3,  cooldownS: 1.0, speed: 4.8, fleeHpFrac: 0.50, fleeOnDogContact: true, pts: 1, packSize: [2, 4] },
    wolf:    { hp: 35,  damage: 6,  cooldownS: 1.0, speed: 5.1, fleeHpFrac: 0.40, pts: 2, sheepTtkS: 7, lightCourageDrainPerS: 20 },
    boar:    { hp: 70,  damage: 10, cooldownS: 2.0, speed: 4.2, fleeHpFrac: 0.30, pts: 3, target: 'crops' },
    thief:   { hp: 45,  damage: 4,  cooldownS: 1.0, speed: 3.6, speedCarrying: 2.4, fleeHpFrac: 0.50, dropsSheepOnFlee: true, pts: 3 },
    raider:  { hp: 60,  damage: 8,  cooldownS: 1.0, speed: 3.3, fleeHpFrac: 0.25, waveFleeAtStrengthLossFrac: 0.60, pts: 5, structureDismantleS: [15, 25] },
    leader:  { hp: 110, damage: 10, cooldownS: 1.0, speed: 3.3, fleeHpFrac: 0.20, pts: 10, routAuraCourage: -40, minChapter: 6 },
  },
  courage: {
    max: 100,
    drains: { dogBarkPerS: 4, slingHit: 15, floodlitPerS: 10, defenderInSightPerS: 2, bellCrowdPerS: 5 },
    generatorLightPreDrainFrac: 0.30, leaderRoutLump: -40,
  },

  waves: {
    pts: { jackal: 1, wolf: 2, boar: 3, thief: 3, raider: 5, leader: 10 },
    telegraphS: 75, telegraphFloorEmptyRosterS: 60,
    rubberBand: { base: 0.75, slope: 0.25, min: 0.75, max: 1.35, sampleAt: 'telegraph', scalesKnownTypesOnly: true },
    defensePoints: { slinger: 3, guard: 2, volunteerGuard: 2, dog: 3, watchtower: 6, garrisonBonus: 2, floodlightBonus: 2, generatorLight: 2, perFenceSegment: 0.2, fenceCap: 4 },
    grace: { chapterStartS: 120, postWaveS: 60, shabbatSpawnFreeThroughCh: 3 },
    unitCount: { min: 3, maxPerWave: 12, mapHostileCap: 16 },
    directionsFreePlay: [{ maxBudget: 9, dirs: 1 }, { maxBudget: 19, dirs: 2 }, { maxBudget: Infinity, dirs: 3 }],
    rewards: { waveSurvivedSpirit: 5, zeroLossSpirit: 3 },
    scripted: { // chapter -> [{day, budget, palette, dirs, expectedPower, note}]
      1: [{ day: 5, budget: 2,  palette: ['jackal'], dirs: 1, expectedPower: 3, loseProof: true }],
      2: [{ day: 3, budget: 3,  palette: ['jackal'], dirs: 1, expectedPower: 4 },
          { day: 6, budget: 6,  palette: ['wolf'], dirs: 1, expectedPower: 6, note: 'friday-night' }],
      3: [{ day: 2, budget: 5,  palette: ['jackal', 'wolf'], dirs: 1, expectedPower: 7 },
          { day: 6, budget: 8,  palette: ['wolf', 'boar'], dirs: 2, expectedPower: 10 },
          { day: 9, budget: 10, palette: ['boar', 'wolf', 'jackal'], dirs: 2, expectedPower: 11, note: 'crops+flock split' }],
      4: [{ day: 3, budget: 6,  palette: ['thief'], dirs: 1, expectedPower: 11 },
          { day: 8, budget: 9,  palette: ['thief'], dirs: 2, expectedPower: 13, note: 'demolition timer d4-d7' }],
      5: [{ day: 2, budget: 8,  palette: ['wolf', 'boar'], dirs: 2, expectedPower: 14 },
          { day: 6, budget: 12, palette: ['raider'], dirs: 1, expectedPower: 16, note: 'first raiders, heavy telegraph' },
          { day: 10, budget: 15, palette: ['raider', 'wolf'], dirs: 2, expectedPower: 19 }],
      6: [{ day: 2, budget: 10, palette: ['wolf', 'boar', 'jackal'], dirs: 2, expectedPower: 20 },
          { day: 6, budget: 14, palette: ['raider'], dirs: 2, expectedPower: 23 },
          { day: 10, budget: 20, palette: ['raider', 'leader'], dirs: 3, expectedPower: 26, note: 'supply-run twist' }],
      7: [{ day: 2, budget: 12, palette: ['wolf', 'boar', 'thief'], dirs: 2, expectedPower: 28 },
          { day: 4, budget: 16, palette: ['raider'], dirs: 2, expectedPower: 30 },
          { day: 6, budget: 20, palette: ['raider', 'thief'], dirs: 3, expectedPower: 32 },
          { day: 7, budget: 30, palette: ['jackal', 'wolf', 'boar', 'thief', 'raider', 'leader'], dirs: 3, expectedPower: 35, note: 'motzaei-shabbat finale, 20s mid-wave lull' }],
    },
    freePlay: { nuisanceEveryNights: 4, nuisance: (n) => 3 + n, bigRaidEveryWeeks: 3, bigRaid: (n) => Math.min(60, Math.round(8 * Math.pow(1.18, n))) },
    // waveBudget(ch, day, playerPower):
    //   s = scripted[ch].find(w => w.day === day)
    //   s.budget * difficultyMult * clamp(0.75 + 0.25 * playerPower / s.expectedPower, 0.75, 1.35)
  },

  spirit: {
    max: 100, driftPerMin: -1,
    sources: {
      shabbat: 30, shabbatSynagogue: 40, shabbatArk: 45,
      kumzitz: 10, kumzitzMotzash: 15, kumzitzWoodCost: 10,
      waveSurvived: 5, zeroLoss: 3, buildingComplete: 2, newSettler: 5,
      yorehOrHoliday: 10, sheepRecovered: 8, lambBorn: 3, musterVictory: 10,
      hillRallies: 15, campfireAuraPerMin: 0.5, zulaLightsPerMin: 1,
    },
    sinks: {
      hungerPerMin: -3, thirstPerMin: -3, sheepLost: -5, structureDestroyed: -8,
      demolitionArrival: -10, selfDismantle: -10, demolitionIgnored: -20,
      generatorNoisePerMin: -1, injuredSettler: -2, muster: -25, zulaHeal: -5,
    },
    thresholds: [
      { min: 80, workSpeedMult: 1.15, autoJoin: true,  joiners: true,  musterBuses: 2 },
      { min: 50, workSpeedMult: 1.00, autoJoin: false, joiners: true,  musterBuses: 1 },
      { min: 25, workSpeedMult: 0.90, autoJoin: false, joiners: false, musterBuses: 1 },
      { min: 0,  workSpeedMult: 0.75, autoJoin: false, joiners: false, musterBuses: 0, settlerLeavesEveryDays: 2, panicButtonsLocked: true },
    ],
    musterMinSpirit: 25,
  },

  demolition: {
    countdownDays: 3, repeatCountdownDays: 2, frozenOnShabbat: true,
    arrivalSpirit: -10,
    dismantle: { workS: 30, refundFrac: 0.85, spirit: -10 },
    muster: { spiritCost: 25, minSpirit: 25, phoneChannelS: 120, needsWaterTower: true,
              supportersNeeded: 12, repeatSupportersNeeded: 18,
              busArrivesAfterS: 90, busCapacity: 15, highSpiritBuses: 2,
              trempTricklePerS: 1 / 30, foodConsumptionMult: 1.2, siteSpiritPerMin: 2,
              victorySpirit: 10 },
    ignored: { crewDismantleS: 60, refundFrac: 0, spirit: -20 },
  },

  shabbat: {
    halted: ['build', 'gather', 'repair', 'supplyRun', 'research'],
    active: ['defense', 'dogs', 'towers', 'guards', 'bell', 'panicButtons'],
    timersFrozen: true, generatorSilent: true,
    fridayCrunchFromDayT: 0.5, // golden light + music shift from Friday noon
  },

  difficulty: {
    waveMult: { calm: 0.7, normal: 1.0, chaos: 1.3 }, // רגוע / רגיל / בלגן
    directorPresets: ['calm', 'classic', 'chaos'],
    neverScalesEconomy: true,
  },

  panicButtons: {
    releaseTheDogs: { cooldownDays: 3, durationS: 10, barkDrainMult: 3 },
    everyoneOut:    { cooldownDays: 3, durationS: 30, courageAuraPerS: 2 },
  },

  autosave: { onChapterStart: true, onWaveSurvived: true, onCandleLighting: true, retryFromLastShabbat: true },

  catchUp: { hillRalliesSpirit: 15, neighborDonation: { wood: 20, food: 15 } },
};
```

---

## 11. Post-playtest tuning checklist (run after every playtest)

1. Median chapter time > target ×1.6 → cut one wave, don't shrink budgets.
2. Defense-spend median < 20% → raise budgets 15%; > 40% → soften wave 1 of each chapter.
3. Tent/patch monoculture → enable `housingSurcharge`, tighten tier-2 efficiency edge.
4. Everyone insta-skips Shabbat → move one scripted scene + more Spirit payoff into it.
5. Any silent loss reported → add a sound/notification (audio doc §), never a nerf.
6. Wolf-vs-sheep rescues failing > 50% → raise `sheepTtkS` to 9 before touching dog speed.
7. Muster path never chosen in ch4 → drop `spiritCost` to 20 or `supportersNeeded` to 10.
