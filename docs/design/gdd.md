# Hilltop RTS — Core Game Design Document

**Version 1.0 — Lead Game Designer**
Grounded in `/docs/research/` (rts-mechanics.md, authenticity.md, threejs-tech.md, balance-theory.md).
All numbers are the tuning baseline (±30% expected after playtests; keep ratios stable).
Game text is Hebrew/RTL; this doc is English. Hebrew names given for every player-facing entity.

**Timebase:** 1 in-game day = 75 s real time (chapters 1–3) / 90 s (chapters 4–7, free-play).
7-day week; day 7 is Shabbat. Sim runs at 30 Hz fixed step; speeds 0 (pause) / 1× / 2× / 3×.

---

## 1. Core Loop

### 1.1 Minute-to-minute (the 60-second loop)

1. **Scan** — glance at HUD strip: resources, idle-settler counter, threat forecast ("🌙 tonight: quiet | in 2 days: wolves? | Shabbat in 3 days"), Spirit meter.
2. **Assign** — open job panel or drag-select settlers; right-click smart orders (gather / build / chase-off / haul). Shift-queues waypoints for donkey routes.
3. **Build** — place a ghost (green/red validity + radius rings for campfire/generator/watchtower/water tower), settlers path to it and hammer.
4. **React** — an event fires from the director (jackal probe, boar sighting, hitchhiker volunteer at the gate, generator sputter). Telegraphed threats give 60–90 s: ring the bell, post dogs, pen the flock.
5. **Exhale** — threat routed or task done; event log writes a line with personality ("התן ברח. איציק גאה בעצמו."), small Spirit tick, back to step 1.

Never more than **two simultaneous pressures**; at least one is always solvable by a decision, not APM. Active pause with command queuing is always available.

### 1.2 Day cycle (75–90 s)

| Phase | dayT | What happens |
|---|---|---|
| Dawn | 0.20–0.30 | Prayer silhouettes face south, milking, flock goes out with shepherd + dog. Grace light. |
| Day | 0.30–0.70 | Full work: build, gather, water runs, junction trips. Player's initiative window — clear a wolf den, claim a zone. |
| Golden hour | 0.70–0.80 | Flock returns, second milking, dinner near fire. Kumzitz decision window. |
| Night | 0.80–0.20 | Generator on (or not), jackals howl the moment it cuts out. Guard shifts run. Predator/thief events spawn only at night. Visibility drops; sun shadow pass off (perf). |

Day = push out; night = hold the perimeter (SC2 "Outbreak" rhythm). The nightly decision is the **guard roster**: who sleeps (works fast tomorrow) vs who watches (early warning).

### 1.3 Week cycle — the Shabbat metronome

- Days 1–5: normal. Day 6 (Friday) is the **crunch beat**: HUD counts to candle-lighting; all preparable prep (jerrycans filled, flock penned early, repairs done, guard roster set, cholent pot on coals). Buildings finished Thursday earn a full day; Friday-started projects race the sundown.
- Day 7 (**Shabbat**, 45–70 s real time, skippable): build/gather/repair/supply commands greyed out; generator silent; white shirts; singing ambience; **Spirit +30 lump**; all hostile/bureaucratic timers freeze; **defense never halts** (guards, dogs, towers fully active — pikuach nefesh).
- Motzaei Shabbat: havdalah beat, then the optional **kumzitz** (+10 Spirit) and the week's "burst" — full Spirit, big plans execute. Autosave fires every Friday at candle-lighting.

### 1.4 Chapter loop (campaign)

Each chapter = one 30–60 min run on a hill: arrive/expand → orders from an off-map authority (family, the rav, regional youth coordinator) → teach one new mechanic → test wave → twist → explicit **triumph screen** (what you built, who joined, Spirit earned) → narrated Hebrew interlude over a slow camera pan. Chapters end in victory, never drift (Against the Storm rule).

---

## 2. Resources

Six resources. HUD order (RTL): רוח | ₪ | מים | אוכל | אבן | עץ.

| Resource | Hebrew | Produced by | Consumed by | Storage cap |
|---|---|---|---|---|
| **Wood** | עץ | Woodcutter job on tree instances (6/min); dismantle refunds | Buildings, fences, repairs (30% of cost), Lag BaOmer bonfire | 100 base; +150 per container |
| **Stone** | אבן | Stone gatherer on rock piles (4/min); terrace restoration yields lump | Watchtower, cistern, terraces, foundations | 80 base; +120 per container |
| **Food** | אוכל | Veg patch 5/min·worker; flock 7/min (4 sheep+shepherd, +1.5/extra sheep); olive grove 10/min; chickens trickle 1/min | 1 per person per day; dogs 0.5/day; volunteers eat double | 60 base; +100 per container; spoils only via boar raids, never by timer |
| **Water** | מים | Spring 6/min free flow (map cap 12/min); jerrycan carrier +4/min (+8 with donkey); cistern collects 40/rain event | 1 per person per day; flock 0.25 per sheep per day; veg patch 2/min while worked | 40 base (jerrycans); +200 water tower; +150 cistern |
| **Shekels** | ₪ | Junction supply run 25₪/trip (~2.5 min); cheese stand 40₪/trip (with dairy); olive oil sale (seasonal lump 80₪) | Sling gear (20₪), dog (30₪ share), caravan tow (60₪), generator fuel (10₪/night), water tanker emergency (50₪) | Uncapped |
| **Spirit** | רוח | Section 8 | Section 8 | 0–100 meter |

Rules: food/water at 0 never kills — it drains Spirit (−3/min each) and slows work; the game surfaces it loudly (dry-spring animation, grumbling barks). Population is capped by housing. Spring flow is the diegetic anti-spam gate on economy scaling (never hidden price inflation, except housing ×1.15 per copy if playtests show caravan spam).

---

## 3. Buildings (17)

Footprints in 1 m grid cells. Cost bands per balance doc (A 15–30 / B 40–80 / C 100–180 / D 220–350 total units). "Unlock" = campaign chapter; free-play unlocks all from the start of its tech tree (Section 10).

| # | Hebrew | id | Cost | Build | Footprint | Unlock | Function | Upgrade |
|---|---|---|---|---|---|---|---|---|
| 1 | אוהל | `tent` | 15 wood | 10 s | 2×2 | 1 | +1 pop. Flattens in winter storms. | → shack (pay diff) |
| 2 | צריף | `shack` | 25 wood, 5 stone | 20 s | 2×3 | 1 | +1 pop, storm-proof, rebuilt in a day if lost. | — |
| 3 | קרוואן | `caravan` | 40 wood, 20 stone, 60₪ (towed up at night — arrives next dawn) | 30 s siting | 3×5 | 1 | +2 pop. First caravan = **core structure** (loss ladder end, Section 9). | Porch: +10 wood → +5 Spirit aura r6 |
| 4 | דיר | `sheep_pen` | 30 wood, 10 stone | 30 s | 5×5 | 1 | Holds 8 sheep/goats; penned flock is theft/wolf-resistant (attackers must breach fence first). | Shade net: +20 wood → cap 16, +milk yield 20% |
| 5 | ערוגות ירק | `veg_patch` | 10 wood, 5 water | 12 s | 3×3 | 1 | 5 food/min with 1 worker. Boar magnet. | Drip lines: 15₪ → 6.5/min, wolf-chewable |
| 6 | מדורה | `campfire` | 10 wood, 5 stone | 10 s | 2×2 | 1 | Morale radius r8 (settlers path to it evenings, +0.5 Spirit/min inside); kumzitz venue; injured recover 2× faster nearby. | — |
| 7 | גדר | `fence` | 5 wood/segment | 6 s | 1×1/seg | 2 | 60 HP wall segment; gates free. Raider dismantles one in ~8 s (audible). | Stone base: +3 stone → 100 HP |
| 8 | פרגולה | `pergola` | 20 wood | 15 s | 3×4 | 2 | Outdoor dining: meals eaten here give +1 Spirit; volunteers require it to stay overnight. | — |
| 9 | פינת בית כנסת | `synagogue` | 30 wood, 15 stone | 30 s | 3×4 | 2 | Shabbat Spirit lump +30 → +40; dawn prayer buff: +10% work speed until noon. | Proper ark: 40 wood → +45, holiday events |
| 10 | מלונה | `kennel` | 25 wood, 30 food | 25 s | 2×2 | 3 | Houses 2 dogs; dogs auto-intercept from here (Section 6). | Second kennel allowed ch5 |
| 11 | זולה | `zula` | 20 wood (sofas arrive by tremp) | 15 s | 3×3 | 3 | Chill corner: injured settlers recover here fully in half a day; spend 5 Spirit → instant recovery. Idle settlers drift here (visible, clickable). | Fairy lights: 10₪ → +1 Spirit/min at night r5 |
| 12 | מכולה | `container` | 80 wood, 40 stone, 100₪ | 60 s | 3×6 | 4 | +150 wood / +120 stone / +100 food storage. Chalk graffiti inside: "אין ייאוש בעולם כלל!" | Window cut: 10 wood → +1 pop |
| 13 | בור מים | `cistern` | 40 stone (restore ancient cistern — fixed map spots) | 45 s | 3×3 | 4 | +150 water storage; auto-collects 40 water per rain event (autumn/winter). | — |
| 14 | מגדל מים | `water_tower` | 60 wood, 40 stone, 60₪ | 60 s | 3×3 | 4 | +200 water storage on the high point; gravity hoses: halves all fetch-trip time inside r20; ladder = phone-reception spot (flavor + muster calls, Section 7.2). | — |
| 15 | מגדל שמירה | `watchtower` | 50 wood, 60 stone | 60 s | 2×2 | 5 | 150 HP, 12 DPS ranged r9; extends threat telegraph +90 s within its sight arc; garrison 1 slinger → +50% DPS. | Floodlight mount (needs generator): 30₪ → night courage-drain aura r10 |
| 16 | גנרטור | `generator` | 100₪, 20 wood (shed) | 40 s | 2×3 | 5 | Night light radius r12 (−30% hostile courage inside); powers floodlights + dairy. **Noise**: −1 Spirit/min to housing within r8; fuel 10₪/night; silent on Shabbat (jackals audibly start). | Solar panels: 80₪ → no fuel, no noise, no night light (trade-off) |
| 17 | מחלבה | `dairy` | 60 wood, 30 stone, 80₪ | 50 s | 3×4 | 6 | Converts milk (auto from flock ≥6) → cheese; junction cheese runs yield 40₪ instead of 25₪; seasonal cheese festival event. | — |

Placement rules: slope check (≤ 0.4), zone build slots (Section 1.4 map = 9–15 named zones, 4–8 slots each), radius rings shown during ghost placement. Dismantling any building refunds 70% of materials.

---

## 4. Units

Coarse stat bands (HP ×2 steps, DPS ×1.5 steps). Counter triangle as damage multipliers: **dogs ×2 vs animals, ×0.5 vs humans; slingers ×2 vs boars; towers area-deny but static.** Defenders are injured, never killed, in routine waves; livestock and structures are the true stakes.

### 4.1 Friendly units

| Unit | Hebrew | HP | DPS | Speed | Cost | Role & behaviors |
|---|---|---|---|---|---|---|
| Settler | מתיישב/ת | 40 | 2 | 1.0 | housing | Generalist worker; 2–3 trait tags (חרוץ/ישנוני/מוזיקלי/פחדן, ±15% job speed nudges); flees threats unless bell rung; named from the authentic name bank (Elyashiv, Neriya, Tehila, Emuna…). |
| Slinger shepherd | רועה עם קלע | 50 | 8 (range 6) | 1.0 | settler + 20₪ gear | Herds flock (boids follow); sling whirl-crack redirects sheep; in combat: ranged, ×2 vs boar. Knows sheep by name ("שושנה לא חזרה!"). |
| Guard | שומר | 50 | 6 melee + torch | 1.0 | settler on guard job | Night patrol between guard posts; flashlight beam sweeps; hums a niggun; +60 s telegraph on his arc; ×1 vs all. |
| Guard dog | כלב שמירה | 35 | 10 | 1.8 | 30 food + kennel slot | Auto-intercepts inside kennel radius r15; bark = 4/s courage drain AoE r6; ×2 vs wolf/jackal, ×0.5 vs raider (needs human backup). Named: Simba, Lavi, Sufa, Bamba. |
| Donkey | חמור | 60 | — | 0.9 loaded / 1.3 free | 40₪ (event or purchase) | Hauls 4× human load on shift-queued routes (jerrycans, feed, wood); brays in protest when loaded; refuses mud in winter (comedy + real constraint). Named: Chamudi, Bil'am. |
| Sheep / goat | כבשה / עז | 40 | — | 0.8 | lambing, 25₪ purchase, events | Food engine (Section 2); boids around shepherd/lead goat (bell audio anchor); each individually named (ברטה, גברת כהן); orphan bottle-fed lamb = follower pet (+1 Spirit/day). Wolf TTK vs sheep ≈ 7 s — the rescue window. |

### 4.2 Hostiles (all rout — courage meter, no deaths on screen)

Every hostile has **Courage 100**. Drains: dog bark 4/s (r6), sling hit 15/hit, floodlit zone 10/s, each defender in sight 2/s, bell-mustered crowd 5/s. At 0 → flees off-map (the win state, with dust puffs + yelp/shout juice). HP exists so fights have exchange, but reaching 0 HP also just triggers flight (limping).

| Threat | Hebrew | HP | DPS | Pts | Speed | Behavior |
|---|---|---|---|---|---|---|
| Jackal | תן | 20 | 3 | 1 | 1.6 | Night packs of 2–4; probes pen for stray sheep; flees at 50% HP or any dog contact; howl chorus = ambient dread + telegraph. |
| Wolf | זאב | 35 | 6 | 2 | 1.7 | Targets flock (7 s per sheep); pack AI encircles; lone-wolf variant chews drip lines (visible leak fountain next morning). Flees fire/floodlight fast (courage −20/s in light). |
| Wild boar | חזיר בר | 70 | 5 | 3 | 1.4 | Beelines crops/vineyard at night; ignores units unless blocked; visibly uproots rows (aftermath state on patch); ×2 from slings. |
| Livestock thief | גנב מקנה | 45 | 4 | 3 | 1.2 (0.8 carrying) | Faceless, masked. Sneaks to pen, grabs a named sheep, runs to an off-map truck; drops sheep at 50% HP or Courage 0; stolen sheep = recoverable follow-up objective ("track the hoofprints"). |
| Masked raider | פורע רעול פנים | 60 | 8 | 5 | 1.1 | Faceless criminal, no identifying markers. Dismantles structures/steals storage (15–25 s per structure, loud banging); wave flees when it loses 60% strength. |
| Raider leader | מנהיג הפורעים | 110 | 10 | 10 | 1.1 | Ch6+. Others' courage tanks (−40) the moment he routs; priority target logic for towers. |

### 4.3 Event units (non-combat)

| Unit | Hebrew | Behavior |
|---|---|---|
| Inspector + bulldozer crew | המפקח והדחפור | White 4×4 with yellow beacon; tapes the order, leaves; bulldozer idles at map edge for the timer's duration (visible dread, never fights, never bulldozes while supporters sit). Everyone sighs "ההוא מהמנהל". |
| Supporter bus | אוטובוס תומכים | Arrives when supporters mustered: yeshiva boys pour out, sit at the threatened structure, sing. Freezes the order. They eat everything (food −20%/day while present, +2 Spirit/min). |
| Volunteers / hitchhikers | מתנדבים | Arrive at the gate via junction; join if Spirit ≥ 50 and housing free; volunteer workday variant: +4 temp workers for 2 days, double food burn. |

---

## 5. Jobs & Automation

**Policy over clicks (RimWorld/Northgard model):** a single job panel assigns each settler a role — **builder, shepherd, farmer, water carrier, woodcutter/stone gatherer, guard, milker/dairy, runner (junction)**. Settlers self-schedule the daily routine (wake → pray → work → eat at pergola → campfire evening → sleep/guard shift). Kids (if family farm variant) do chores: feed chickens, carry small jerrycans.

- **Direct orders override temporarily**: right-click smart order (gather/build/haul/chase-off) preempts the routine; on completion the settler returns to role. "Chase off" = engage until target flees, then auto-return (replaces attack-move).
- **Hauling**: any produced resource is dropped at source; nearest idle settler (or donkey, if a shift-queued route covers the leg) hauls to nearest valid storage. Water tower r20 halves trip times — a *felt* upgrade. No hauling job role; hauling is the idle-filler behavior.
- **Idle visibility**: HUD idle counter, click to cycle; idle settlers physically drift to the zula (find them in-world too).
- **Squad UI**: persistent HUD portrait rows (guards row, shepherds row) + Ctrl+1–4 groups; double-click portrait jumps camera.
- **Guard roster**: nightly 2-slot shift board (first watch / second watch); unrostered guards sleep and work +10% faster next day.

---

## 6. Defense (defensive-only, rout-based)

**Anatomy of a night raid:**

1. **Warning (T−90 s to T−60 s):** dogs orient and growl toward the threat direction; minimap ping + Hebrew banner with direction arrow ("הכלבים נובחים לכיוון הוואדי המזרחי"); watchtower arcs extend this to −180 s. Optional **"confront it now"** button: dogs scout ahead → event triggers early at 80% budget, +5 Spirit.
2. **Preparation:** town bell (hotkey G, big HUD button): sheep auto-path to pen, kids/elders to caravan, able-bodied grab slings (work halts), dogs released from kennels. Reverse bell restores routine.
3. **Approach:** hostiles enter from the announced edge(s); wander-y approach, testing the fence line; floodlights and torch-bearing guards visibly bend their paths (courage pre-drain).
4. **Clash:** fence breach attempts (audible banging, HP bar), dog intercepts, sling volleys, tower fire. Player micro = pulling injured defenders, rotating dogs, targeting the leader.
5. **Flee:** courage hits 0 → each hostile turns and sprints off-map (yelps, dust, screen shake on the final rout). Event log summarizes; +Spirit per wave survived; 60 s grace period follows.

**Systems:** dog auto-intercept (nearest hostile inside kennel r15, no order needed); watchtowers deny an area but are flankable (multi-direction waves test layout); guard patrol posts are movable flag markers (Kingdom Rush rally). Two **panic buttons** on multi-day cooldowns: **"שחרר את הכלבים!"** (all dogs sprint to target point, 3× bark drain, 10 s) and **"כולם החוצה!"** (every settler slings for 30 s, +2/s courage drain aura settlement-wide).

**Non-lethal resolution, hard rules:** no gore, no corpses, no attacking anyone's home; defenders get injured (recover by morning, faster at campfire/zula); only livestock and structures are truly lossable, on a graduated ladder (perfect → sheep injured → sheep stolen-but-trackable → structure damaged → structure destroyed → core caravan threatened). Wave budgets, telegraphs, rubber-banding (×0.75–1.35 sampled at telegraph time), and grace periods exactly per balance doc §3/§7.

---

## 7. Eight Signature Mechanics

### 7.1 Shabbat Rhythm (שבת)
The master metronome. Spec: day 7 of every week; Friday golden light + music shift from noon; candle-lighting = autosave + handoff. During Shabbat: build/gather/repair/supply greyed out, generator silent, white shirts on all settlers, zemirot ambience, Spirit +30 (+40/+45 with synagogue tiers), all hostile & bureaucratic timers frozen, defense fully active. 45–70 s real time; "rest through Shabbat" fast-forward with auto-pause on attack; ~1-in-3 Shabbatot get a small scripted scene (guest, song, quiet flock shot, +3 Spirit) to reward not skipping. Strategic texture: 6-workday payback math, Friday crunch, Motzaei-Shabbat burst.

### 7.2 Demolition-Order Drama (צו הריסה)
Frostpunk-style timed dilemma, fully non-violent. Trigger: scripted (ch4) then director-drawn (weight rises with structure count). Sequence: white 4×4 arrives (ping, dread music), inspector tapes order on one named structure, bulldozer idles at map edge. Timer: 3 in-game days (frozen on Shabbat). Choices: **(A) Dismantle in time** → 85% materials refund, −10 Spirit, order closed. **(B) Muster supporters** → costs 25 Spirit + a settler climbing the water-tower ladder for phone reception (2 min channel, interruptible); success spawns the supporter bus → order frozen, structure saved; inspector returns one chapter later with a 2-day timer. **(C) Do nothing** → structure dismantled by crew at T=0, no refund, −20 Spirit. Neighbors and settlers comment on the choice; consequences echo in later chapters.

### 7.3 Kumzitz Spirit Economy (קומזיץ)
Triggerable evening event at the campfire (button live from golden hour if wood ≥ 10). Costs 10 wood; runs ~20 s: fire-glow radius doubles, guitar audio layer, everyone gathers, marshmallows. +10 Spirit, all injuries −50% recovery time, once per night. Motzaei-Shabbat kumzitz is auto-offered and upgraded: +15 Spirit and one free trait-reroll offer on a random settler ("נחמן פתאום מגלה שהוא מוזיקלי"). If the guitarist (מוזיקלי trait) is on guard shift, the button warns you — roster tension by design.

### 7.4 Flock Naming & Bonding (העדר)
Every sheep/goat has a name, hover-tooltip, and 1 trait (שובבה/שמנה/מקדימה). The lead goat wears an audible bell; flock boids follow her. Losing a named sheep = −5 Spirit and a named log line; recovering her = +8. "Lost lamb" director event: a named ewe strays into a wadi at dusk — search party with flashlights before the jackals find her (soft 2-min timer, never gory: jackals *surround*, you disperse them). Orphan lamb follower pet (+1 Spirit/day, follows your selected unit). Flock size is the wealth number that raid scaling watches — prosperity is risk.

### 7.5 Spring Water Runs (המעיין)
Water is spatial economy. The spring is a fixed map feature (zone: המעיין) flowing 12/min max, shared. Chain: spring → jerrycans (settler 4/min, donkey route 8/min) → base storage → water tower (r20 halves trips) / cistern (rain-fed). Late-summer drought event: spring drops to 6/min, jerrycan runs multiply, tanker delivery costs 50₪. Building the tower/cistern is watched relief: fewer walking trips visibly happen. Thirst never kills; it drains Spirit and slows everything, loudly.

### 7.6 Hitchhike Junction Trade (הצומת)
The junction is an off-map node via the road-edge zone. Send a runner (tremp stance: standing at the road, finger pointing down): round trip ~2.5 min, returns with 25₪ (produce sale) or a shopping order (fuel, gear, drip lines). With the dairy: cheese runs, 40₪ and a handwritten-cardboard stand flavor scene. Risks/texture: rain = "no rides" (trip takes double, ch6 twist fodder); runner is a settler you don't have at home when the dogs start barking. One battered white pickup exists from ch6 — hauls double, gets stuck in winter mud.

### 7.7 Seasonal Harvest (עונות)
Four seasons, ~3 weeks each in free-play (campaign chapters pin a season each). Winter: lambing (+1–2 named lambs, one difficult 03:00 birth event), mud (donkey/pickup route penalties), storms (tents flatten), green hills. Spring: shearing (+wood-band income as wool→shekels lump 60₪), peak grazing (+20% flock yield), almond blossom visual. Summer: drought (7.5), sharav + brush-fire event (beat out with branches, protect the hay), guard the ripening grapes from boars nightly. Autumn: **masik** (olive harvest — 3-day all-hands event, +200 food-equivalent lump, work-roster puzzle) and the **yoreh** first rain: everyone runs outside, "יורה! ברוך השם!", +10 Spirit, plowing unlocks, cisterns fill. Squill bloom telegraphs autumn events a week ahead.

### 7.8 Night Guard Shifts (שמירות)
Nightly roster board: 2 watches × 1–2 slots. Rostered guards patrol between movable guard-post flags with flashlight cones (real vision: threats inside a cone telegraph instantly; outside, you rely on dogs). Unrostered settlers sleep (+10% work speed next day). Empty roster = telegraphs shrink to 30 s and thief success chance doubles. **Call volunteer guards** action (HaShomer-style): 15₪ phone call from the water tower → 2 volunteer guards arrive for 3 nights (they eat, they help, they leave). Guards on shift hum niggunim — the audio tells you the perimeter is held.

---

## 8. Spirit (רוח) Economy

One meter, 0–100, settlement-wide (personal moods are trait-flavored barks, not simulated). Baseline drift −1/min (life is hard on a hilltop).

**Sources:** Shabbat +30/40/45 · kumzitz +10 (+15 motzash) · wave survived +5 · rout with zero losses +3 · building completed +2 · new settler joins +5 · yoreh/holidays +10 · recovered sheep +8 · demolition order defeated (muster) +10 · lamb born +3.

**Sinks:** baseline −1/min · hunger/thirst −3/min each while at 0 · sheep lost −5 · structure destroyed −8 · demolition order arrival −10, self-dismantle −10, ignored −20 · generator noise −1/min (housing in r8, nights) · injured settler −2 · mustering supporters −25 (the big strategic spend) · zula instant-heal −5.

**Thresholds:**

| Spirit | Effects |
|---|---|
| 80–100 | +15% work speed; hitchhiker volunteers join automatically; muster capacity 2 buses |
| 50–79 | Normal; volunteers join if housed; muster capacity 1 bus |
| 25–49 | −10% work speed; no new joiners; muster unavailable below 25 (can't freeze demolition orders — the real teeth) |
| 0–24 | −25% work speed; a random settler "goes home for a while" every 2 days (returns when Spirit ≥ 50); panic buttons locked |

Spirit is the non-violent conflict currency: the demolition-order muster and the volunteer-guard call are Spirit-gated, so morale play *is* the political/defensive strategy. Catch-up: losing a wave badly triggers "the hill rallies" (+15 Spirit) and a neighbor-donation event (small wood/food drop).

---

## 9. Win / Lose Conditions & Difficulty

**Campaign (7 chapters):** win = chapter's explicit objectives (build X, survive the scripted waves, resolve the order, complete the masik) → triumph screen. Lose = only the scripted fail states: core caravan destroyed (requires sustained neglect up the graduated loss ladder) or a chapter-critical objective expired (rare, always a visible timer). On failure: "retry from last Shabbat" (Friday autosave) or chapter restart. Chapter star ratings (1–3: complete / no structures lost / bonus objective) drive replay.

**Free-play:** no lose state except core-caravan loss; win-tracks (Northgard "fame" style), pick any: **Hityashvut** (population 20 + all zones claimed), **Kehila** (Spirit ≥ 80 held for 3 consecutive weeks), **Chava** (flock of 40 + dairy running + masik completed). Escalating "hostility": big raid every 3 weeks, `W(n) = 8×1.18^n` capped at 60, nuisance waves `3+n` between. Starting-kit draft (Against the Storm): choose 1 of 3 (generator / second dog + kennel / donkey + jerrycan set).

**Difficulty knobs (menu):** wave budget multiplier ×0.7 / ×1.0 / ×1.3 (רגוע/רגיל/בלגן) — never touches economy; event-director preset (calm/classic/chaos pacing weights); day length 75/90/110 s; optional hardcore toggle: single autosave slot. Rubber-band clamp 0.75–1.35 always on, sampled at telegraph time, defensive power only.

---

## 10. Tech / Upgrade Tree (10 nodes)

Diegetic research = "learning hour" under the pergola: a settler assigned 1 in-game day + listed cost. Small linear-ish tree, three short branches.

```
                 [1 Herding Lore] ── [2 Cheese Craft] ── [3 Market Stand]
                /
[0 Pergola built]── [4 Stonework] ── [5 Terrace Restoration] ── [6 Ancient Cistern]
                \
                 [7 Night Craft] ── [8 Floodlights] ── [9 Solar Panels]
                        │
                 [10 Slinger Drill]
```

| # | Hebrew | Cost | Effect | Avail. |
|---|---|---|---|---|
| 1 | תורת הרעייה | 30 food | Flock cap +8; lead-goat bell (flock recall button) | ch3 |
| 2 | גבינה ולאבנה | 40 food, 20₪ | Unlocks dairy building; milk auto-conversion | ch6 |
| 3 | דוכן בצומת | 30 wood, 20₪ | Junction runs +60% value; cheese festival event enabled | ch6 |
| 4 | עבודת אבן | 20 stone | Stone fence bases; repairs 20% cheaper | ch3 |
| 5 | שיקום מדרגות | 40 stone | Restore ancient terraces → 2 extra veg-patch slots per hill zone, +1 Spirit aura (beauty) | ch4 |
| 6 | בור המים העתיק | 40 stone | Unlocks cistern restoration spots | ch4 |
| 7 | מלאכת לילה | 20 wood | Guard posts +1 per zone; flashlight cones +30% arc | ch3 |
| 8 | פנסי הצפה | 30₪ (needs generator) | Floodlight mounts on towers/poles: night courage-drain zones | ch5 |
| 9 | פאנלים סולאריים | 80₪ | Generator noise & fuel removed (loses night-light aura — real choice) | ch6 |
| 10 | אימון קלע | 20₪ | All slingers +25% courage drain per hit; sling volley button (3 s focus fire) | ch5 |

---

## 11. Cross-Reference Notes for Other Leads

- **Engineering:** everything above fits the tech doc budgets — ≤30 units, zone-graph + 1 m A* grid, one shadow sun, DOM/RTL UI, 30 Hz sim, save = seed + diffs (buildings, flock names, tech flags, chapter state, Spirit).
- **Art:** structure visual grammar per authenticity doc §1 (pallet wood, shade net, black tanks, blue half-barrels, faded flag); character silhouette = big knitted kippa, swinging tzitzit, sandals, stick + sling.
- **Writing:** slang bank + tone rules per authenticity §5/§9 — plans get "בעזרת השם", disasters get "הכל לטובה"; event log is the story surface and must be funny.
- **Audio:** jackal chorus keyed to generator cut-off; bleat pitch seeded per named sheep; music states calm/raid/kumzitz/Shabbat per tech doc §13.3.
- **Balance:** all combat/wave/economy numbers here are lifted from balance doc §8 unchanged; tune ratios, not values, and re-run its §9 checklist after the first playtest.
