# RTS & Settlement-Game Mechanics Research

**Purpose:** What makes the best RTS / city-builder / colony-sim games great, and which of those mechanics transfer to Hilltop RTS — a browser-based, single-player, ~10-30-unit, defensive-only hilltop-outpost game built in vanilla Three.js.

**Method:** Game-by-game analysis (core loop, economy, tension pacing, defense-wave design, player praise), then RTS control conventions and which subset fits our scale, then a concrete "Top 20 mechanics to steal" list adapted to the hilltop-outpost setting.

---

## Part 1 — Game-by-Game Analysis

### 1.1 Age of Empires 2 (1999, Ensemble)

**Core loop:** Villagers gather 4 resources → resources buy buildings/units/techs → advance through Ages (Dark → Feudal → Castle → Imperial) → each age unlocks a visibly richer toolkit. The Age-up is the master pacing device: a big, expensive, deliberate commitment that gates everything else.

**Economy:** Worker-on-node gathering with drop-off buildings. The genius detail is *walk distance*: a lumber camp placed 2 tiles closer is a real economic edge. Economy is a spatial problem, not just a numbers problem. Farms are renewable but need re-seeding (attention tax); herdables/hunt are early windfalls that reward map exploration.

**Tension pacing:** Ages create natural "acts." Players self-pace: rushing (attack early, weak eco) vs booming (fat eco, vulnerable window). Every strategy has a timing window and a punish.

**Defense design:** Walls, towers, castles, and garrisonable Town Centers. Villagers can garrison and towers shoot more arrows when garrisoned — civilians participate in defense. This is highly relevant to us: in AoE2 defense is something the *whole settlement* does, not only soldiers.

**What players praise:** Readability (every unit silhouette instantly recognizable at isometric distance), the satisfying age-up "ding," the campaign's historical storytelling with scripted scenarios and voiced narration between missions, and 25 years of "just one more game" loop clarity.

**Transfers to us:** Age-up → outpost tiers (tent → shack → caravan cluster → recognized farm). Villager-garrison defense. Drop-off/walk-distance economy. Campaign-with-narration structure.

### 1.2 StarCraft 2 (2010, Blizzard)

**Core loop (campaign — the relevant part for us):** Each mission introduces ONE new unit or mechanic and is designed around it. Between missions: a hub (the Hyperion) where you talk to characters, buy upgrades with mission-earned currency, and choose the next mission from a small branching set.

**Economy:** Two resources (minerals fast, gas slow/gated) with worker saturation caps. Not directly relevant at our scale, but the principle is: *one abundant resource, one scarce strategic resource*.

**Tension pacing:** SC2's campaign missions are famous for **mission gimmicks that force movement**: the wall of fire advancing across the map ("The Devil's Playground" lava rising), the day/night cycle where infected attack only at night ("Outbreak"), escort/timed/hold-out variants. Almost no mission is "build base, kill enemy base." This is the single most transferable SC2 lesson: **each chapter needs one twist that changes how you play.**

**Defense-wave design:** "Outbreak" mission: by day you push out and clear, by night you turtle behind your defenses as waves come. Players consistently rank these day/night hold-out missions among the best in the genre.

**What players praise:** Mission variety, the between-mission hub with characters and optional lore, unit responsiveness (units react within ~1 frame — "game feel"), pixel-perfect control clarity.

**Transfers to us:** One-new-mechanic-per-chapter campaign structure; the day/night "push out then hold" rhythm (maps to our jackals-at-night); the campfire kumzitz as our "Hyperion cantina" between-chapter hub; snappy unit response even in a browser.

### 1.3 They Are Billions (2019, Numantian)

**Core loop:** Build economy in a quiet-ish start → survive escalating zombie waves at announced times/directions → final 360° mega-wave. Any breach can snowball (infected houses spawn more infected), so a single leak can end a 6-hour run.

**Economy:** Housing generates gold + workers; energy and food gate expansion; expansion means clearing map area of wandering infected first — **economic growth requires military action**, tying the two loops together.

**Tension pacing:** Waves are pre-announced ("A horde approaches from the EAST in 3 days"), giving a prepare-panic-relief cycle. Community analysis (Black Falcon Games) notes waves start with generous gaps that shrink until wave ~6, then a long calm before the final storm.

**Defense-wave design lessons — both positive and negative:**
- **Positive:** announced direction + countdown = player agency and drama; wandering ambient threat between waves keeps expansion tense; noise mechanics (some buildings attract infected) make placement a risk decision.
- **Negative (widely criticized):** the final wave is an order of magnitude harder than everything before it, and you only learn your fortress was inadequate after hours of play. **Lesson: never let the player invest hours and then fail on information they couldn't have had.** Late-game difficulty must be *foreshadowed and testable*.

**What players praise:** The dread and relief cycle, the "one leak kills you" tension (also the #1 complaint), the pause-and-plan mode (you can pause and issue orders — crucial accessibility valve for a stressful game).

**Transfers to us:** Pre-announced raid warnings ("shepherd spotted movement near the eastern wadi"), active pause, escalating-but-fair wave curve, ambient wildlife threat between events. We should NOT copy the snowballing insta-loss; our failures should cost resources/spirit, not the run.

### 1.4 Banished (2014, Shining Rock — one developer)

**Core loop:** Assign a small population to professions → produce food/fuel/tools surplus → survive winter → population grows only as fast as housing → aging/education loop. It is a **surplus-management game**: fail to bank a surplus and a single bad winter cascades into a death spiral.

**Economy:** Everything is a feedback loop through **travel time** — workers walk to work, to warehouses, home to eat and warm up. Distance is the hidden currency. Tools wear out, firewood burns, food spoils logic — steady-state maintenance costs, not just build costs.

**Tension pacing:** Brutal early game (every death matters when you have 12 people), then — the famous flaw — tension evaporates once the labor pool is big. No end-game goal; players quit when stable. **Lesson: a pure sandbox economy flatlines; you need injected events or an end condition** (this is exactly the gap Frostpunk and Against the Storm later filled).

**Defense design:** None (only nomads/disease/fire/tornado disasters). Its disasters are appreciated as story generators but criticized as un-counterable RNG.

**What players praise:** Every villager is a named individual whose death you feel; the honest harshness; emergent stories from few, deeply-linked mechanics ("with relatively few, well-designed mechanics, the game weaves a powerful tale" — GameSpot).

**Transfers to us:** Named individuals with visible daily routines (our settlers AND our sheep), travel-time economy (spring → jerrycan → water tower runs; donkey routes), winter/Shabbat as consumption-vs-production rhythm, small-population "every person matters" feel. We must avoid its flatline by using chapter goals + event director.

### 1.5 RimWorld (2018, Ludeon)

**Core loop:** Colonists with traits, moods, and relationships do prioritized jobs → the **AI Storyteller** injects events (raids, weather, gifts, animal events) paced against your colony's wealth and recent history → disasters create stories → rebuild.

**Economy:** Job-priority matrix rather than direct orders — you manage *policy*, not clicks. Colony **wealth drives threat scale**: getting richer makes raids bigger, an elegant rubber-band that keeps tension proportional.

**Tension pacing — the crown jewel:** Three storyteller personalities: Cassandra (classic rising dramatic arc: push → breathing room → push harder), Phoebe (long calm periods, rare heavy hits), Randy (pure chaos). The storyteller watches colony mood/strength and injects hardship or relief accordingly. RimWorld markets itself as a "story generator," and players value catastrophes as much as triumphs.

**Defense design:** Base layout IS the defense: killboxes, choke corridors, sandbags, turrets, trained animals. Raids arrive from map edges with warning; some flee when losses mount — **enemies that rout instead of fighting to the death** is exactly our raider requirement.

**What players praise:** Emergent narrative ("my cat saved the colony"), mood/mental-break system making people feel human, depth of small-population simulation (typically 5-20 colonists — our exact scale).

**Transfers to us:** A lightweight storyteller/event-director (weight events by spirit level, wealth, days since last trouble), colonist moods fed by kumzitz/Shabbat/losses, trained animals in defense (guard dogs!), raiders who flee at a morale threshold, wealth-scaled raid sizes.

### 1.6 Northgard (2017, Shiro)

**Core loop:** Colonize the map **tile by tile** — each region must be scouted, cleared, and claimed, and holds limited building slots → assign villagers to jobs → survive winter → win by one of several victory paths (conquest, fame, wisdom, trade).

**Economy:** Villagers are generalists reassigned between jobs by re-tasking, food/wood consumption spikes in winter, happiness caps population growth. Very low APM by design: "it's not about actions per minute, it's about long-term planning" (StrategyFront). **This is the best existing template for our scale.**

**Tension pacing:** The **year cycle** (seasons + harsh winters, occasionally announced "harder winter coming") creates a breathing rhythm identical to what our Shabbat + seasons should do. Random events (rats, earthquakes, wolf attacks) punctuate calm.

**Defense design:** Wolves/draugr occupy neutral tiles (clearing = mini defensive fight on YOUR initiative); periodic raid events hit your border tiles; towers + a handful of warriors suffice. Combat is small: 5-15 units total.

**What players praise:** Accessibility without shallowness, the tile system making expansion a *decision* rather than a sprawl, multiple victory paths, seasonal atmosphere.

**Transfers to us:** Tile/zone-based hill expansion (claim the spring, the olive grove, the ridge — each a named area with build slots), seasons + announced hard events, generalist workers with quick re-tasking, small deliberate combat, "fame"-like non-violent victory tracks (recognition/legitimacy for the outpost).

### 1.7 Frostpunk (2018, 11 bit)

**Core loop:** Manage heat (generator radius) + food + workforce shifts → sign laws in the Book of Laws, each granting efficiency at a moral price → survive scripted escalating cold events → scenario climax (The Storm).

**Economy:** One central building (the generator) defines a **radial spatial economy** — everything wants to be near warmth, coal feeds the generator, a brutal central trade-off. Workforce is time-based: extend shifts, use child labor? Efficiency vs. humanity.

**Tension pacing:** Dual meters — **Hope** and **Discontent** — both game-enders, moved by events, laws, and citizen deaths. Citizens verbally react to your laws; consequences return later as story events. The scenario is authored: a known incoming mega-storm gives the whole run a countdown structure. The ending judges your choices ("you survived, but at what cost?").

**Defense design:** None military; the enemy is cold and despair. But its *wave design* is the weather timeline — announced temperature drops function exactly like They Are Billions' hordes.

**What players praise:** Moral weight of mechanical decisions, the two-meter society model, the generator's audiovisual presence (the city's beating heart), scenario endings that editorialize.

**Transfers to us:** **Spirit (רוח) should be our Hope meter** — moved by kumzitz, Shabbat, losses, demolition orders, victories. Our noisy **generator** is a literal Frostpunk echo: it powers lights/water pump but its noise lowers spirit and attracts attention — turn it off on Shabbat. The demolition-order events should work like Frostpunk laws/events: hard choices (dismantle for refund vs. muster supporters), with consequences that return later. Citizens should comment on decisions.

### 1.8 Kingdom Rush (2011, Ironhide)

**Core loop:** Pre-wave planning → place/upgrade 4 tower archetypes on fixed pads along a path → call waves early for bonus → hero + rain-of-fire ability for emergencies → 3-star rating drives replay.

**Economy:** Kill gold only — perfectly closed loop, zero bookkeeping. Meta: stars buy permanent upgrades between levels.

**Tension pacing:** Per-wave micro-tension with the **"call next wave early" button** — the player chooses to raise difficulty for reward, a brilliant self-pacing device. Enemy variety forces tower-mix changes; mini-bosses telegraph.

**Defense design:** Fixed build pads (not free placement) remove analysis paralysis; melee barracks units **block** the path (positioning matters, soldiers hold a rally point you can move within a radius); leaks cost lives from a pool of ~20, so single leaks sting but don't end the run.

**What players praise:** Charm/humor (units have voice barks, background gags, references), crystal-clear readability, "easy to learn, 3-starring is hard" difficulty banding.

**Transfers to us:** Leak tolerance (a boar reaching the vegetable patch eats some food — bad, not fatal), movable rally/guard points for shepherds and dogs, an "emergency ability" (release the dogs! / everyone grab slings!), humor and barks in Hebrew, per-chapter star ratings for replay.

### 1.9 Against the Storm (2023, Eremite)

**Core loop (roguelite city builder):** Short 1-3-hour settlements: draft blueprints (you get a random subset of buildings each run) → satisfy the Queen's orders (quest-like goals) → manage 3 species with different needs → survive the storm season cycle → **the run ENDS in victory and you leave** with meta-progress. World map + meta-upgrades persist.

**Economy:** Deep production chains but with **substitution recipes** (3 ways to make most goods) so every draft is solvable; "resolve" per species is a morale meter that, when high, generates bonus; hostility rises the longer you stay (Blightrot) — staying is a cost, another anti-flatline device.

**Tension pacing:** The seasonal cycle (Drizzle → Clearance → Storm) is a metronome: storm season debuffs and tests you every "year." Gamedeveloper.com interview: the design deliberately **ends runs before stability turns into boredom** — "the roguelite design congratulates players, gives rewards, and sends them away." Solves Banished's flatline directly.

**Defense design:** No combat at all — "hostility" is abstract pressure via events and debuffs. Proof that wave-tension works without any military layer.

**What players praise (Metacritic 88, overwhelmingly positive):** The loop respects your time; every run different via blueprint drafting; "the city is your avatar" framing; constant sense of progress on two levels (run + meta).

**Transfers to us:** Chapter = run: each campaign chapter is a fresh-ish start or a new hill with different conditions, ending in a *victory moment* rather than open-ended drift; order/quest system from an off-map authority (the regional council? the rav? family); seasonal metronome; blueprint-ish variety in free-play (random starting kit).

---

## Part 2 — Cross-Game Synthesis: The Five Shared Pillars

1. **A pacing metronome.** Every great game in this list has a clock the player can read: Ages (AoE2), announced hordes (TAB), storytellers (RimWorld), winters (Northgard/Banished), the temperature timeline (Frostpunk), waves (KR), storm seasons (AtS). Ours: **the 7-day week ending in Shabbat**, plus seasons, plus announced threats. Calm must alternate with pressure on a legible rhythm.
2. **Prepare → panic → relief → reward.** Waves/threats are pre-announced with direction and countdown; surviving one grants a visible reward and a breather. Failures should be *survivable setbacks* (KR lives, RimWorld rebuilds), not run-enders (TAB's flaw).
3. **Small numbers, big identity.** Banished/RimWorld prove 10-30 named individuals with moods, jobs, and relationships beat 200 anonymous units. At our unit count this is mandatory: every settler and every sheep has a name and a personality quirk.
4. **Economy as space, not spreadsheets.** Walk distance (AoE2/Banished), generator radius (Frostpunk), tiles (Northgard). Water from the spring, the donkey path, the noisy generator's radius — our economy should be *felt on the terrain*.
5. **Morale as a first-class resource.** Hope/Discontent, Resolve, RimWorld moods, Northgard happiness. Our **Spirit (רוח)** must gate real things (work speed, population growth, event outcomes, mustering supporters against demolition orders) — not be a decorative bar.

---

## Part 3 — RTS Control Conventions and What Fits a Browser Game with 10-30 Units

### 3.1 The full standard convention set (AoE2/SC2 lineage)

| Convention | Standard behavior |
|---|---|
| Left-click select | Single unit/building; click empty ground deselects |
| Drag-box select | Marquee multi-select of units (usually excludes buildings) |
| Shift-click | Add/remove from selection |
| Double-click / Ctrl-click | Select all of same type on screen |
| Right-click smart order | Context command: move / gather / attack / repair / garrison based on target |
| Shift-right-click | Queue waypoints/orders |
| Control groups | Ctrl+1..9 assign, 1..9 recall, double-tap to center camera |
| Attack-move (A-move) | Move but engage enemies en route |
| Stances | Aggressive / defensive / hold / patrol |
| Rally points | Right-click with production building selected; flag shown in world + minimap |
| Build ghost | Translucent placement preview, green/red validity, grid snap, rotate |
| Edge pan + MMB drag + WASD/arrows | Camera scroll |
| Minimap | Overview, click-to-jump, right-click-to-order, event pings |
| Idle-worker button | Cycle unassigned workers (AoE2's "." key — beloved) |
| Hotkeys everywhere | Build menus, unit abilities |
| Active pause | Single-player convention (TAB, RimWorld, AtS all pause-and-order) |
| Game speed control | 1x/2x/3x (RimWorld/AtS standard) |

### 3.2 Recommended subset for Hilltop RTS

**Adopt fully (cheap, expected, high value):**
- Left-click select, drag-box, shift-click add, double-click select-all-of-type ("all shepherds").
- **Right-click smart orders** with context cursor + a small ground marker/flag animation and a Hebrew voice/text bark ("סבבה, זז"). Non-negotiable genre grammar.
- Shift-queue waypoints (cheap to implement, big depth for donkey routes and patrols).
- **Build ghost** with green/red validity, terrain-slope check, grid-lite snapping; show radius rings (generator noise, water tower coverage, campfire morale) while placing — Frostpunk-style radius feedback.
- **Active pause + speed control (0/1/2/3x).** This is the single biggest accessibility feature for a settlement game and standard in every single-player entry above.
- **Idle-settler button** (and idle-settler counter on HUD) — at 10-30 population, an idle person is a real loss; AoE2 players consider this button essential.
- Minimap: render-to-texture or canvas top-down with camera frustum, click-to-jump, and **event pings** (raid direction, wolf sighting, demolition-order jeep arriving). With announced-direction threats, the minimap is the drama screen.
- Camera: MMB/right-drag rotate, wheel zoom, WASD/arrows + edge pan (make edge pan **optional/toggleable** — in a browser window, edge pan misfires when the cursor exits the canvas; many browser RTS ship it off by default).
- Rally-ish points as **guard/post markers**: assign a shepherd or dog to "hold this spot" (Kingdom Rush barracks rally). True production rally points are less needed since we don't mass-produce units.
- Basic hotkeys: B=build menu, H=home/campfire, spacebar=pause, F=follow selected, . =idle settler, 1-4 control groups.

**Adopt in simplified form:**
- Control groups: support Ctrl+1..4 only, and ALSO provide **persistent squad buttons on the HUD** (portraits of the guard team, the shepherd team). At 10-30 units, clickable portrait rows (RimWorld colonist bar) outperform memorized groups for casual players. Double-click portrait = jump camera.
- Stances: exactly two — "work normally" vs "alert/defend" (a settlement-wide alarm bell toggle, like AoE2 town bell: settlers run to shelter, guards to posts). Per-unit stance micromanagement is overkill at our scale.
- Attack-move: replace with "chase off" order — right-click a threat orders engage-until-it-flees, then auto-return to previous job. Fits defensive-only combat and self-cleans micromanagement.

**Skip (wrong for scale/platform):**
- Sub-group tabbing, complex formation controls, patrol routes UI (fold into shift-waypoints), replays, APM-oriented hotkey layers, multi-building selection production queues.

**Browser-specific notes:** Right-click needs `contextmenu` preventDefault on the canvas; pointer-lock not needed; keep every order also reachable via on-screen buttons (tablet friendliness); persist keybinds in the same localStorage save; raycast against simplified collider meshes, not full visual geometry, for 60fps picking.

---

## Part 4 — Top 20 Mechanics We Should Steal, Adapted to a Hilltop Outpost

1. **Shabbat as the pacing metronome** (Northgard winters / AtS storm season, inverted into a *positive* beat). Every 7th day: work halts, generator off, candles + meal + singing; Spirit regenerates strongly; threats are rarer but a Shabbat-eve raid attempt is a scripted campaign dramatic beat (guards still watch). The week countdown UI gives the whole game its rhythm: push projects to finish before Friday sundown.
2. **A lightweight Storyteller/event director** (RimWorld). A ~200-line JS module weighing events (wolf pack, boar raid, inspector jeep, hitchhiking volunteer arrives, guitar breaks) by: days since last trouble, current Spirit, outpost wealth, chapter script. Campaign chapters constrain its deck; free-play exposes Cassandra/Phoebe/Randy-style presets ("רגוע", "רגיל", "בלגן").
3. **Announced threats with direction + countdown** (They Are Billions). "Dogs are barking toward the eastern wadi — something's coming tonight." Minimap ping + in-world cue (dogs orient and growl toward the threat direction). Player gets minutes to post guards, pen the flock, light the perimeter. Prepare-panic-relief every time.
4. **Failure costs resources, never the run** (Kingdom Rush lives; anti-TAB). A leaked boar eats crops; a thief escaping steals a sheep (she can be recovered in a follow-up event); a lost fight injures (not kills) a settler who recovers in the caravan. Campaign chapters fail only on explicit scripted conditions.
5. **Enemies that rout** (RimWorld raiders, our hard constraint). Every hostile has a courage meter: dogs barking, slings hitting, floodlights, and number of defenders drain it; at zero they flee the map. Wolves flee faster from fire/light; masked raiders flee when outnumbered or when the whole settlement musters. No death animations needed — fleeing IS the win state, and it's cheaper to build.
6. **Spirit (רוח) as Hope** (Frostpunk dual meter, simplified to one). Raised by: kumzitz, Shabbat, births, new families arriving, chasing off a raid, finishing a structure. Lowered by: losses, demolition orders, hunger/thirst, generator noise at night, boredom. Gates: work speed (±25%), whether hitchhiking volunteers join, and — crucially — **how many supporters you can muster to freeze a demolition order**. Spirit is our victory currency for the non-violent conflict resolution.
7. **Demolition orders as Frostpunk-style dilemma events.** The jeep arrives (announced, minimap ping, dread music). Timer starts. Choice A: dismantle the structure yourself in time → refund most materials, small Spirit hit. Choice B: spend Spirit to muster supporters (busloads arrive, sit at the structure) → order frozen, structure saved, but Spirit spent and inspector returns in a later chapter with a longer timer. Neighbors comment on your choice; consequences echo later. Non-violent by design, mechanically rich.
8. **Named-tile hill expansion** (Northgard). The map is ~9-15 named zones: המעיין (the spring), חורשת הזיתים, הרכס, הוואדי. Each zone must be scouted, has limited build slots, a resource identity, and sometimes a squatter problem (wolf den, boar wallow) to resolve before claiming. Expansion becomes a chapter-sized decision, keeps pathfinding and fog trivial at browser scale.
9. **Walk-distance economy** (Banished/AoE2). Water: spring → jerrycans on donkey → water tower (buffer) → users. Building the water tower halves fetch trips — a *felt* upgrade you watch happen. Placing the sheep pen near the grazing zone vs. near home is a real trade-off. Travel time is the hidden currency; the donkey is our drop-cart.
10. **Radius buildings with visible rings** (Frostpunk generator). Campfire: morale radius (settlers path to it in the evening). Generator: light radius (deters night predators) but noise radius (Spirit penalty for adjacent housing, attracts attention on some events). Floodlight, water tower coverage. Show rings during build-ghost placement — placement puzzles with zero extra simulation cost.
11. **Every settler and every sheep is named** (Banished/RimWorld). 10-25 settlers with 2-3 trait tags (חרוץ, ישנוני, מוזיקלי, פחדן) that nudge job speed and event outcomes; sheep have names and the shepherd knows them — when one is missing the shepherd tells you *which one* ("שושנה לא חזרה מהמרעה!"). Rescue-the-named-sheep is a recurring quest generator. Names appear in the event log, building lifelong-colony attachment at our exact population scale.
12. **Job-policy assignment, not per-task micromanagement** (Banished/Northgard/RimWorld). Assign people to roles (shepherd, builder, farmer, guard, kids-do-chores) via a simple panel; they self-schedule daily routines (wake, work, eat, kumzitz, sleep). Direct right-click orders temporarily override, then they return to routine. This is what makes 20 units manageable without APM.
13. **Town-bell alarm** (AoE2 garrison). One big button / hotkey: sheep to pen, kids and elders to the caravan, everyone able-bodied grabs slings and dogs are released. Reverse bell returns everyone to routine. This single mechanic makes "the whole settlement defends itself" real, replaces military production, and is deeply on-theme.
14. **Push-out-by-day, hold-by-night rhythm** (SC2 "Outbreak"). Daytime: shepherding, building, clearing the wolf den in the wadi on your initiative. Night: jackals howl (procedural WebAudio dread), predators probe the perimeter, visibility drops. Guard-duty roster (who sleeps, who watches) becomes a nightly decision. Day/night is also our cheapest atmosphere multiplier in Three.js (one directional light + fog color lerp).
15. **One-new-mechanic-per-chapter campaign** (SC2). Ch1: arrive, tent, water, first sheep (teaches orders/build). Ch2: night predators + dogs (teaches defense). Ch3: Shabbat + kumzitz (teaches Spirit). Ch4: donkey logistics + junction supply runs. Ch5: demolition order (teaches the dilemma system). Ch6: masked-raider theft escalation. Ch7: the big storm/mega-event convergence. Each chapter ends with an AoE2-style narrated interlude (Hebrew VO or styled text over a slow camera pan of the outpost).
16. **Chapter = short run that ends in triumph** (Against the Storm). Chapters are 30-60 minutes with explicit orders/goals (from family, the regional youth coordinator, the rav) and a celebratory end screen (what you built, who joined, Spirit earned) — never open-ended drift. Free-play mode gets AtS-style variety: randomized hill layout, starting kit draft (start with a generator OR a second dog OR extra jerrycans), and optional escalating "hostility" the longer you stay.
17. **Call-the-event-early button** (Kingdom Rush). When a threat is announced, an optional "send the dogs to scout / confront it now" action triggers it early at reduced strength for a Spirit bonus. Self-pacing: confident players compress downtime, cautious players use every second to prepare.
18. **Emergency hero abilities on cooldown** (Kingdom Rush hero + rain of fire). Two settlement-level actives: "שחרר את הכלבים" (all dogs sprint to a target point, big courage-drain AoE) and "כולם החוצה!" (every settler grabs a sling for 30s, work halts). Big red buttons for the panic moment; cooldown measured in days.
19. **Wealth-and-progress-scaled threats with a fairness cap** (RimWorld scaling, TAB's flaw inverted). Raid/predator strength scales with flock size + structure count, but is capped at "hard but survivable with current defenses + alarm" and every escalation tier is previewed once in a survivable form before it appears at full strength. The player must never discover an unwinnable requirement after hours invested.
20. **Idle-hands visibility + event log with personality** (AoE2 idle button + RimWorld narrative log). HUD shows idle-settler count (click to cycle); a Hebrew event feed writes the outpost's story with humor: "יוסי סיים את הדיר. הכבשה רחל נכנסה ראשונה, כרגיל." / "התן יילל כל הלילה. איציק לא ישן. איציק עצבני." The log doubles as our emergent-story surface — screenshots of it are the shareable moment.

---

## Part 5 — Priority Notes for Implementation Order

- **Foundation first (enables everything):** pause/speed, selection + smart right-click, build ghost with rings, day/night + week clock, job panel, named settlers. (Mechanics 1, 9, 10, 12, 20 ride on these.)
- **Tension layer second:** alarm bell, announced threats, courage/rout combat, dogs. (3, 5, 13, 14.)
- **Soul layer third:** Spirit, kumzitz, Shabbat scripting, event log voice, named sheep. (1, 6, 11.)
- **Director + campaign last:** event director, chapter scripts, demolition-order dilemmas, scaling. (2, 7, 15, 16, 19.)
- Biggest de-risk items to prototype early: raycast picking performance with 30 animated units + terrain; nav/pathing over zone graph; the rout-based combat feel (it must feel satisfying to *scare something off* — screen shake, dog barks, dust puffs, fleeing animation are the juice budget).

## Sources

- [Black Falcon Games — More Thoughts on They Are Billions](https://blackfalcongames.net/?p=393)
- [Game Developer — How Against the Storm mixed city-building and roguelite play](https://www.gamedeveloper.com/business/how-against-the-storm-managed-to-mix-city-building-and-roguelite-play)
- [Rogueliker — Against the Storm review](https://rogueliker.com/against-the-storm-review/) · [Metacritic — Against the Storm](https://www.metacritic.com/game/against-the-storm/)
- [RimWorld Wiki — AI Storytellers](https://rimworldwiki.com/wiki/AI_Storytellers) · [Medium — Algorithmic Authors: RimWorld's AI Storytellers](https://medium.com/@coyega1328/algorithmic-authors-rimworlds-ai-storytellers-as-agents-of-literary-genre-eff70ea4560c)
- [PC Gamer — Frostpunk developers on hope, misery, and the book of laws](https://www.pcgamer.com/frostpunk-developers-on-hope-misery-and-the-ultimately-terrifying-book-of-laws/) · [Gabriel Chauri — Frostpunk: Player's Decisions in the Book of Laws](https://www.gabrielchauri.com/frostpunk-decisions/)
- [GameSpot — Banished Review](https://www.gamespot.com/reviews/banished-review/1900-6415679/) · [Play the Past — Banished: It Takes a Village to Raise a Surplus](http://www.playthepast.org/?p=5695)
- [StrategyFront Gaming — Northgard Retrospective Analysis](https://strategyfrontgaming.com/northgard-review/)
- [Kingdom Rush strategy guide — Ironhide](https://www.kingdomrush.com/kingdom-rush-strategy-guide) · [Wikipedia — Kingdom Rush](https://en.wikipedia.org/wiki/Kingdom_Rush)
- [Game Design Snacks — Moving Units Effectively (RTS)](https://game-design-snacks.fandom.com/wiki/Moving_Units_Effectively_(RTS)) · [Shortcut Kings — Essential Hotkeys for RTS Games](https://shortcutkings.com/master-the-keyboard-essential-hotkeys-for-rts-games-like-starcraft-age-of-empires-and-beyond/)
