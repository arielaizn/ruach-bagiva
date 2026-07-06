# Hilltop RTS — UI/UX Design (Hebrew RTL)

Complete UI specification. All in-game text is Hebrew, `dir="rtl"`. All UI is DOM/CSS layered
over the WebGL canvas (per tech doc §"DOM-based Hebrew RTL text" — zero text in WebGL).
Design language: **warm earthy stencil** — dusty khaki/olive panels, parchment text surfaces,
sky-blue accents for water/UI focus, hand-cut edges. Feels like plywood signs, chalk, and
shade-net, not like glass or chrome.

Global structural rules (apply everywhere, stated once):

- Root: `<div id="ui" dir="rtl" lang="he">` absolutely positioned over the canvas; children use
  `pointer-events: none` by default, interactive elements opt back in (`pointer-events: auto`)
  so camera drag on the canvas is never blocked by layout containers.
- **CSS logical properties only** (`inset-inline-start`, `margin-inline-end`, `padding-inline`,
  `border-start-start-radius`…). Never `left/right` except for the minimap viewport math.
  This makes every component RTL-correct by construction and LTR-testable with one attribute.
- Numbers stay Latin digits, embedded in RTL text via `<bdi>` (e.g. `<bdi>12/20</bdi>`), with
  `font-variant-numeric: tabular-nums` on every value that ticks (resources, timers) so digits
  don't jitter widths.
- Hit targets ≥ 40×40 px; body text ≥ 14px; severity always encoded as icon+shape+color, never
  color alone.
- Every UI mutation that the player must notice (resource spent, spirit drop) animates ≤ 250ms;
  `prefers-reduced-motion` and the settings toggle kill all non-essential animation.

---

## 1. Design Tokens (exact CSS)

```css
:root {
  /* ---- palette: dusty Samaria noon ---- */
  --sand:        #E8DCC3;  /* light surface / parchment cards */
  --parchment:   #F4ECD8;  /* tooltip & toast body */
  --khaki:       #B7A97C;  /* borders, inactive icons */
  --olive:       #6B7A46;  /* primary action, positive */
  --olive-deep:  #46512F;  /* pressed states, headers */
  --earth:       #8A6A4B;  /* wood/structures accent */
  --stone-grey:  #9B9484;  /* stone accent, disabled text */
  --clay:        #B0532F;  /* danger / critical / demolition */
  --amber:       #D9A441;  /* spirit, shekels, warnings, Shabbat gold */
  --sky:         #A7C7D8;  /* water accent, selection tint */
  --sky-deep:    #4E7A96;  /* links, focus ring */
  --ink:         #2B2A23;  /* text on light */
  --bone:        #F7F3E8;  /* text on dark */
  --night:       #232A26;  /* dark panel base */
  --panel:       rgba(35, 42, 38, 0.82);      /* HUD panel fill */
  --panel-soft:  rgba(35, 42, 38, 0.60);      /* secondary strips */
  --panel-light: rgba(244, 236, 216, 0.94);   /* light cards (menus) */

  /* ---- radii: slightly rough, never bubbly ---- */
  --r-xs: 3px;  --r-sm: 6px;  --r-md: 10px;  --r-pill: 999px;

  /* ---- depth ---- */
  --blur-hud: blur(7px) saturate(0.9);        /* backdrop-filter on HUD panels */
  --shadow-1: 0 1px 3px rgba(20, 18, 10, .45);
  --shadow-2: 0 4px 14px rgba(20, 18, 10, .40);
  --shadow-glow-amber: 0 0 12px rgba(217, 164, 65, .55);
  --edge-light: inset 0 1px 0 rgba(247, 243, 232, .10); /* top hairline on dark panels */

  /* ---- type ---- */
  --font-ui: 'Heebo', 'Rubik', 'Arial Hebrew', 'Segoe UI', sans-serif;
  --font-display: 'Secular One', 'Heebo', sans-serif;
  --fs-xs: 12px; --fs-sm: 14px; --fs-md: 16px; --fs-lg: 20px;
  --fs-xl: 28px; --fs-title: 48px;

  /* ---- spacing (4px scale) & z ---- */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-6: 24px; --sp-8: 32px;
  --z-hud: 10; --z-toast: 20; --z-tutorial: 30; --z-menu: 40; --z-modal: 50;
}
```

**Stencil texture** (the "rough" feel, zero asset files): one shared data-URI SVG
`feTurbulence` noise applied twice — (a) 4%-opacity overlay on every panel
(`.panel::after { background-image: var(--noise); mix-blend-mode: overlay; }`), and
(b) as a `border-image` on light cards using a 6px torn-edge SVG so menu cards read as
hand-cut cardboard. Dark HUD panels skip the torn edge (keep them calm), light menu cards get it.

```css
.panel {           /* dark HUD panel */
  background: var(--panel); backdrop-filter: var(--blur-hud);
  border: 1px solid rgba(183,169,124,.35); border-radius: var(--r-md);
  box-shadow: var(--shadow-1), var(--edge-light); color: var(--bone);
}
.card {            /* light menu card */
  background: var(--panel-light); color: var(--ink);
  border-radius: var(--r-sm); box-shadow: var(--shadow-2);
  border-image: var(--torn-edge) 6 / 6px round;
}
.btn-primary { background: var(--olive); color: var(--bone); border-radius: var(--r-sm);
  border: 1px solid var(--olive-deep); box-shadow: var(--shadow-1);
  font: 500 var(--fs-md) var(--font-ui); padding: 10px 20px; }
.btn-primary:hover { filter: brightness(1.08); }
.btn-primary:active { transform: translateY(1px); background: var(--olive-deep); }
:focus-visible { outline: 2px solid var(--sky-deep); outline-offset: 2px; }
```

---

## 2. Fonts

Decision: **Heebo** (UI body, weights 400/500/700) + **Secular One** (display/titles, single
weight). Rubik is the declared fallback for Heebo. Amatic SC was considered for titles and
rejected — too thin for legibility over a 3D scene and reads "wedding invitation", not plywood
sign. Secular One is chunky, slightly geometric, and stencils beautifully when given a
`letter-spacing: 0.01em` and the torn-edge underline treatment.

- **Self-host** two WOFF2 files in `/fonts/` (Heebo variable, Secular One), subset to
  Hebrew + Basic Latin + digits (~55 KB total). The game must run offline from localStorage
  saves; no runtime Google Fonts dependency. `font-display: swap`, preloaded via
  `<link rel="preload" as="font">`.
- Titles: Secular One, `--fs-title`, color `--sand`, `text-shadow: 0 2px 0 var(--olive-deep)`.
- Numbers everywhere: Heebo 500 + `tabular-nums`.
- Never letter-space Hebrew body text (breaks connected reading rhythm); display font only.

---

## 3. HUD Layout

Screen map (RTL: reading starts at the **right**):

```
┌─────────────────────────────────────────────────────────────────┐
│ [spirit gauge]      [clock+speed capsule]      [resource strip] │ top
│ (top-left end)          (top-center)           (top-right start)│
│                                              [objectives panel] │
│                                              [toast stack ↓]    │
│                                                                 │
│                    ( 3D world, full bleed )                     │
│                                                                 │
│ [event log]                                                     │
│ [selection panel]   [build menu (bottom-center)]  [minimap]     │ bottom
│ (bottom-left)                                 [camera toggle ↑] │
└─────────────────────────────────────────────────────────────────┘
```

Rationale: in RTL scanning order the eye enters top-right → resources first (state), then
clock (time pressure), then spirit (mood) — the three questions of every settlement game in
priority order. Minimap sits bottom-right at the RTL "start" of the action row, mirroring
AoE2's placement, and directly under the objectives/toast column so threat pings and threat
toasts are vertically adjacent. Selection detail — the most contextual, least urgent panel —
takes bottom-left.

### 3.1 Top resource strip (top-right)

Order **right→left** (read order): population, wood, stone, food, water, shekels.
Population leads because housing caps everything.

```html
<div class="panel res-strip" role="status">
  <span class="res" data-res="pop">  <svg class="ico"><use href="#i-tent"/></svg> <bdi>9/12</bdi></span>
  <span class="res" data-res="wood"> <svg class="ico"><use href="#i-wood"/></svg> <bdi>140</bdi></span>
  <span class="res" data-res="stone"><svg class="ico"><use href="#i-stone"/></svg><bdi>62</bdi></span>
  <span class="res" data-res="food"> <svg class="ico"><use href="#i-food"/></svg> <bdi>87</bdi></span>
  <span class="res" data-res="water"><svg class="ico"><use href="#i-water"/></svg><bdi>31</bdi></span>
  <span class="res" data-res="shekel"><svg class="ico"><use href="#i-shekel"/></svg><bdi>250</bdi></span>
</div>
```

- Each `.res` is a pill: icon 20px tinted per-resource (wood `--earth`, stone `--stone-grey`,
  food `--olive`, water `--sky`, shekel `--amber`, pop `--sand`), value in `--bone`.
- Value change: number counts (lerped over 300ms) + a floating `+12`/`−8` chip that drifts up
  and fades (green `--olive` gain / `--clay` loss).
- Hover tooltip: income/expense per day ("מים: ‎+18/יום מהמעיין, ‎−12/יום צריכה") and storage cap.
- When a build is unaffordable, the *short* resources flash `--clay` twice — the strip is the
  error message.
- Water/food below 1 day of consumption: pill gets a slow amber pulse.

### 3.2 Clock + speed capsule (top-center)

One pill-shaped panel, three zones (RTL order right→left): **week pips → sun dial → speed**.

```html
<div class="panel clock-capsule">
  <div class="week-pips" title="שבת בעוד 3 ימים">
    <i class="pip done"></i><i class="pip done"></i><i class="pip now"></i>
    <i class="pip"></i><i class="pip"></i><i class="pip fri"></i><i class="pip shabbat">🕯</i>
  </div>
  <div class="sun-dial"><svg><!-- 40px arc, sun/moon marker travels it --></svg>
    <span class="day-label">יום ג׳ · 14:20</span></div>
  <div class="speed-ctrl" role="group" aria-label="מהירות משחק">
    <button data-spd="0" title="השהיה (רווח)">⏸</button>
    <button data-spd="1" class="on">1×</button>
    <button data-spd="2">2×</button>
    <button data-spd="3">3×</button>
  </div>
</div>
```

- **Week pips**: 7 dots; 7th is a candle glyph. Filled = passed, current pulses. Friday pip
  turns amber from midday Friday; label under capsule swaps to countdown
  "שקיעה בעוד <bdi>4:30</bdi>" (this is the weekly crunch beat — balance doc §6).
- **Sun dial**: 180° arc, sun marker by `dayT`; at night the marker becomes a moon and the
  capsule border cools to `--sky-deep`. This is the day/night telegraph.
- **Shabbat state**: entire capsule turns warm gold (`--amber` border, `--shadow-glow-amber`),
  pips replaced by "🕯 שבת שלום", speed locked to 1× (buttons disabled with tooltip
  "בשבת הזמן זורם לאט"), a small "דלג ←" button appears if the settings allow Shabbat skip.
  Simultaneously the whole HUD applies `filter: sepia(0.15) brightness(0.97)` via a
  `body.shabbat` class and all work-command buttons get `.disabled-shabbat` (greyed, tooltip
  "לא בשבת, אחי"). Defense buttons (alarm, dogs) stay fully live — defense never halts.
- **Paused**: capsule border turns `--sand` dashed; a thin vignette + "⏸ מושהה" watermark
  bottom-center of the 3D view. Active pause allows all orders (research: TAB/RimWorld valve).

### 3.3 Spirit meter (top-left end)

Spirit (רוח) is deliberately **not** in the resource strip — it's a mood, not a stockpile.
Design: a horizontal **ember gauge**, 180×34px panel, flame icon at its inline-start.

- Track = charcoal; fill = gradient `--clay → --amber → #F2CE7B`; above 80% the flame icon gets
  `--shadow-glow-amber` and tiny CSS-particle sparks (2 dots, `@keyframes` float).
- Threshold ticks at 25/50/75 with state words on hover: "שפל רוח / רוח רגילה / רוח גבוהה /
  רוח גדולה". Below 25% the panel itself desaturates and the flame gutters (opacity flicker).
- Delta events (kumzitz +, demolition order −) fire a chip identical to resource chips, plus
  a one-line reason in the event log ("‎+8 רוח — קומזיץ מוצלח").
- Click = opens a small breakdown popover: what's feeding/draining spirit today. Spirit gates
  muster-supporters and work speed, so the player must be able to audit it.

### 3.4 Build menu (bottom-center)

Two-row panel: category tabs above, item grid below. Hidden until `B` or tab click; slides up
120ms. RTL tab order right→left:

```html
<nav class="panel build-menu" aria-label="תפריט בנייה">
  <div class="tabs" role="tablist">
    <button role="tab" data-cat="mivnim"   class="on">🏠 מבנים</button>
    <button role="tab" data-cat="haklaut">🌿 חקלאות</button>
    <button role="tab" data-cat="bitachon">🛡 ביטחון</button>
    <button role="tab" data-cat="ruach">🔥 רוח</button>
  </div>
  <div class="grid" role="tabpanel"><!-- 8 slots max visible -->
    <button class="b-item" data-b="caravan">
      <svg class="ico-lg"><use href="#b-caravan"/></svg>
      <span class="b-name">קרוואן</span>
      <span class="b-cost"><bdi>40</bdi><svg><use href="#i-wood"/></svg>
                           <bdi>10</bdi><svg><use href="#i-stone"/></svg></span>
      <kbd class="b-key">1</kbd>
    </button>
    <!-- ... -->
  </div>
</nav>
```

- Category contents: **מבנים** caravan, container, pallet shack, pergola, water tower,
  generator, outhouse; **חקלאות** pen, trough, vegetable patch, vineyard, olive terrace,
  chicken coop, hay barn, cistern restore; **ביטחון** floodlight, fence segment, watch post,
  dog post, gate; **רוח** campfire ring, zula, synagogue corner, sukkah (seasonal).
- Item card 72×88px. States: normal / hover (lift 2px + tooltip) / **unaffordable** (icon
  greyed, missing cost numbers in `--clay`, still clickable → flashes resource strip) /
  **locked** (chapter-gated: silhouette + 🔒 + tooltip "נפתח בפרק 4").
- Tooltip (parchment card, opens *above*): name, one-line flavor in hilltop voice
  ("גנרטור — אור בלילה, רעש בלב"), costs, worker need, and **radius legend** (e.g. amber ring
  = light, red ring = noise) matching the rings shown during ghost placement.
- While placing a ghost the menu collapses to a single strip: "‎↻ R לסיבוב · קליק להנחה · ESC ביטול".

### 3.5 Selection panel (bottom-left)

Context panel, appears on selection, 300×150px.

**Single unit:**

```html
<section class="panel sel-panel">
  <canvas class="portrait" width="96" height="96"></canvas> <!-- RT snapshot of the unit -->
  <div class="sel-info">
    <h3 class="sel-name">נריה <small class="traits">חרוץ · מוזיקלי</small></h3>
    <div class="bars">
      <label>מצב <progress max="100" value="80"></progress></label>
      <label>מצב רוח <progress class="mood" max="100" value="65"></progress></label>
    </div>
    <div class="sel-job">רועה · במרעה המזרחי</div>
  </div>
  <div class="sel-actions">
    <button title="גרש איום (ג)"><svg><use href="#a-chase"/></svg></button>
    <button title="עמוד כאן (ע)"><svg><use href="#a-hold"/></svg></button>
    <button title="חזור לשגרה (ר)"><svg><use href="#a-home"/></svg></button>
  </div>
</section>
```

- Portrait: at selection time render the unit's head-and-shoulders once into a 96×96
  RenderTarget → copy to the canvas (procedural, no asset). Sheep get sheep portraits —
  hovering a sheep shows "ברטה", never "כבשה 12" (authenticity doc touch #22).
- Health bar is labeled מצב ("condition") — defenders get injured, never die (balance doc), so
  the empty state reads "פצוע — מחלים בקרוואן", not death.
- **Multi-select**: portrait grid (max 12, 32px tiles) + shared action row; clicking a tile
  sub-selects; double-click a tile jumps camera. Ctrl+digit assigns the group; assigned groups
  also appear as **persistent squad chips** stacked above the selection panel (RimWorld-style
  colonist bar substitute): `[1 🐕 שומרי הלילה ×3]` — click selects, double-click jumps.
- **Building selected**: icon replaces portrait; shows workers assigned (+/− steppers),
  radius toggle button ("הצג טווח"), and the dismantle button ("פרק — החזר ‎70%‎ חומרים") which
  is also how demolition-order compliance is performed.

### 3.6 Minimap (bottom-right) + camera toggle

- 200×200px, `--r-md`, canvas top-down render (terrain vertex colors downsampled once +
  live dots: white settlers, `--sand` sheep, `--sky` water, `--clay` threats).
- Camera frustum trapezoid in `--bone` 1px; **click = jump, right-click = move order** for
  current selection; both need `contextmenu` preventDefault.
- **Event pings**: expanding rings — amber (event), red (threat with bearing: the ring sits at
  the map edge in the threat's direction with an arrow chevron), gold candle ping Friday
  sundown. Ping + matching toast always co-fire.
- North indicator rotates with camera yaw (map itself stays fixed; rotating minimaps disorient).
- **Camera-mode toggle** sits directly above the minimap: a 44px two-state button —
  state A icon = flat diamond grid ("מבט על", iso), state B = film-frame ("מבט קרוב",
  cinematic). Hotkey `C`. On toggle: rig lerps (tech doc pairs FOV 22/dist 90 ↔ FOV 45/dist 18)
  and the HUD enters **cinematic-lite**: build menu and event log fade out, resource strip and
  clock shrink 80%, thin letterbox bars (4vh) ease in. Any command input snaps HUD back.

### 3.7 Alerts / toasts (top-right column, under objectives)

Stack of max 4, newest on top, slide-in from inline-start (right), width 300px.

```html
<div class="toast warn" role="alert">
  <svg class="t-ico"><use href="#i-wolf"/></svg>
  <div class="t-body">
    <strong>הכלבים נובחים מזרחה</strong>
    <span>משהו מתקרב מכיוון הוואדי · <bdi>1:20</bdi></span>
  </div>
  <svg class="t-ring"><!-- countdown ring, stroke-dashoffset --></svg>
</div>
```

- Severities: **info** (parchment bg, ink text — arrivals, completions), **warn** (`--amber`
  edge, dark bg — threat telegraphs, always with direction text + countdown ring; per balance
  doc every wave is telegraphed 60–90s), **critical** (`--clay` edge + slow pulse — demolition
  order, breach; never auto-dismisses).
- Click toast = jump camera to source; ⨉ on hover dismisses; info auto-dismisses 6s.
- A **"טפל עכשיו"** button on warn toasts triggers the Kingdom-Rush "confront early" action
  where applicable (spirit bonus shown on the button: "‎+3 רוח").
- Overflow: 5th toast collapses the oldest into a counter chip "‎+2 התראות" that opens the log.

### 3.8 Event log (bottom-left, above selection panel)

Collapsed by default to the last line, 320px wide, expands to 5 lines on hover, full history
in a scroll panel on click. Text has personality (research mechanic #20):
"התן יילל כל הלילה. איציק לא ישן. איציק עצבני." Entries prefixed by a tiny category glyph.
This panel is the shareable-screenshot surface — give it the parchment card style, not the
dark panel, so it photographs well.

### 3.9 Objectives panel (top-right, below resource strip)

Collapsible card. Header = chapter name + chevron; body = checklist.

```html
<aside class="panel objectives" data-collapsed="false">
  <header><h4>פרק ב׳ · לילות של תנים</h4><button class="chev">⌄</button></header>
  <ul>
    <li class="done">✔ בנו דיר לצאן</li>
    <li>אמצו שני כלבי שמירה <bdi>1/2</bdi></li>
    <li>שרדו את הלילה בלי לאבד כבשה</li>
  </ul>
</aside>
```

Completing an item: line sweeps olive + ✔ stamps (rotate −8°, stencil style) + soft UI chime.
Collapsed state shows just "פרק ב׳ · <bdi>2/3</bdi>". Auto-collapses during cinematic mode.

### 3.10 Alarm bell (the one big button)

The town-bell (research #13) lives at the inline-start edge of the build menu — a 56px round
button, bell icon, `--clay` ring: "פעמון — כולם למחסה!" (hotkey `G`). Toggles settlement alert
stance: pressed state shows dogs-released badge; press again = "חזרה לשגרה". The two cooldown
abilities ("שחרר את הכלבים" / "כולם החוצה!") sit beside it as 44px buttons with radial cooldown
sweeps labeled in days ("עוד יומיים").

---

## 4. Menus

### 4.1 Main menu

- Background: live 3D outpost at golden hour, slow 0.5°/s orbit, procedural music pad.
- Title (working Hebrew title) in Secular One `--fs-title`+, on a plywood-sign card with the
  torn-edge border and two painted "nail" dots: **"הגבעה"** with subtitle "משחק ניהול מאחז".
- Buttons (vertical, centered, `.btn-primary` 260px): המשך (only if autosave exists, shows
  "פרק ג׳ · יום 12"), קמפיין, משחק חופשי, טעינה, הגדרות, יוצרים.
- Footer line: version + "נשמר מקומית בדפדפן" reassurance.

### 4.2 Chapter select — map of hills

Full-screen parchment map, hand-drawn style (procedural SVG): a ridge line of **7 hills
running right→left** (Hebrew reading direction = campaign direction), a dotted donkey-trail
path connecting them, wadis and tiny olive trees as filler.

- Each hill = a node: flag on summit, hill name in the authentic pattern
  (ch1 "גבעת המעיין", ch2 "מצפה איתן", …), chapter number, 0–3 stars (stencil stamps), and a
  one-line hook on hover ("צו ההריסה הראשון. נשימה עמוקה.").
- Locked chapters: hill silhouette in morning fog (blur + desaturate), 🔒, no name — mystery.
- Completed: flag colored, campfire smoke wisp animating on the summit.
- Selecting opens a side card (inline-start) with objectives preview, best stats, and
  **התחל / שחזר משבת האחרונה** buttons.
- Free-play entry is an 8th, larger hill at the far end labeled "הגבעה שלך" with the
  storyteller preset picker: רגוע / רגיל / בלגן.

### 4.3 Pause menu (ESC)

Dark overlay `rgba(20,22,18,.72)` + center card: המשך, שמירה, טעינה, הגדרות,
מדריך מקשים (opens the keyboard sheet, §7 table rendered), יציאה לתפריט (confirm if unsaved
> 2 min). Game world visibly frozen behind, slight blur.

### 4.4 Settings

Tabbed card, tabs right→left: **שמע · גרפיקה · מצלמה · משחק · מקלדת**.

- **שמע**: sliders (0–100, thumb = wooden peg) — כללי, מוזיקה, אפקטים, אווירה (wind/jackals);
  mute-when-tab-hidden toggle.
- **גרפיקה**: quality preset radio — חסכוני / רגיל / מלא — mapping to pixelRatio 1/1.25/1.5,
  shadow map 1024/2048/2048, vegetation instance density 60/85/100%; FPS counter toggle.
- **מצלמה**: edge-pan toggle (**off by default** — browser misfire, research §3.2), rotate
  invert, zoom speed slider, camera-shake toggle, "הסתר ממשק במצב קולנועי" toggle.
- **משחק**: autosave interval, Shabbat skip allowed (default on), tutorial reset, difficulty
  (free-play only: wave multiplier 0.7/1.0/1.3 labeled שלווה/רגיל/קשוח — never touches economy),
  reduced-motion.
- **מקלדת**: rebind list (records `e.code`), "שחזר ברירת מחדל", persisted in the save envelope.

### 4.5 Win / lose screens

**Chapter win** — the triumph screen (AtS principle): slow camera pan over the outpost at
sunset, HUD hidden, then a parchment card stamps in:

- Title: "הגבעה עומדת!" + chapter name; 1–3 stars stamp with thuds.
- Stats table (icon + label + `<bdi>` value): ימים 14 · מבנים 9 · כבשים בשמות 12 ·
  גלים שהודפו 5 · שיא רוח 92 · אורחים שהצטרפו 3.
- One narrative line from the event log's best moment ("ברטה חזרה מהוואדי. לבד.").
- Buttons: לפרק הבא (primary), שחק שוב, לתפריט.

**Chapter fail** — soft, no skulls: fog-grey card, title "הגבעה צריכה נשימה", one line of
warm framing ("אין ייאוש בעולם כלל. מנסים שוב."), buttons: **נסה שוב משבת האחרונה** (primary —
the retry anchor from balance doc), התחל פרק מחדש, לתפריט. Show the same stats table (what you
did achieve) to avoid punishment framing.

### 4.6 Save / load

Card list: **שמירה אוטומטית** slot (badge "אוטו", shows trigger: "נר שבת · יום 12") + 3 manual
slots. Each slot card: chapter, hill name, day + week pip strip, resource mini-row, timestamp,
buttons שמור/טען/מחק (delete = 2-step confirm in-place). Footer: ייצוא לקובץ / ייבוא — the
JSON blob export from the tech doc, labeled "גיבוי מחוץ לדפדפן". QuotaExceeded → clay toast:
"אין מקום בדפדפן — ייצאו גיבוי ומחקו שמירה ישנה".

---

## 5. Iconography

Decision: **inline SVG sprite** (one `<svg style="display:none">` with `<symbol>` defs,
hand-authored, 24×24 viewBox, 2px round-cap strokes, filled with `currentColor`), NOT emoji.
Reasons: emoji render inconsistently across platforms/OS versions, can't be tinted to the
earthy palette, and clash with the stencil style. Emoji are allowed in exactly two places:
event-log flavor text and the build-menu **tab labels** (🏠🌿🛡🔥 read instantly and tabs are
large enough to absorb style variance). If tab emoji prove inconsistent in testing, swap to
sprite symbols — the HTML already supports it.

Sprite inventory (drawing spec per symbol):

| id | For | Glyph |
|---|---|---|
| `#i-tent` | population | triangle tent, door slit |
| `#i-wood` | wood | two stacked planks, wavy grain line |
| `#i-stone` | stone | three-stone pile |
| `#i-food` | food | round pita + olive twig |
| `#i-water` | water | jerrycan silhouette (NOT a droplet — theme) |
| `#i-shekel` | shekels | ₪ glyph in a hand-drawn coin circle |
| `#i-spirit` | spirit | three-tongue flame |
| `#i-wolf` / `#i-jackal` / `#i-boar` | threats | head silhouettes, distinct ears/tusks |
| `#i-raider` | raiders | masked head, neutral, no insignia |
| `#i-order` | demolition order | taped document + yellow beacon dot |
| `#a-chase` | chase-off action | dog + motion lines |
| `#a-hold` | hold post | shepherd stick planted |
| `#a-home` | return to routine | campfire with arrow |
| `#b-*` | one per building | building silhouette incl. `#b-caravan`, `#b-gen` (with noise arcs), `#b-tower` (tank on legs), `#b-zula` (sofa) |

Rules: threat icons always pair with the `--clay` shape language (pointed toast edge);
positive events with `--olive`/`--amber`. Icon color comes from the parent's `color` so states
(disabled/hover) are free.

---

## 6. Tutorial Delivery

System: **tutorial director** — a queue of single-concept steps; exactly one step visible at a
time; each step = toast + highlight + completion condition (never a "next" button when a real
action can advance it).

Anatomy per step:

1. **Mask**: full-screen `--z-tutorial` div, `background: rgba(20,22,18,.45)`, with a cutout
   over the target (CSS `clip-path` for DOM targets; for world targets, project the 3D point
   to screen each frame and position an elliptical cutout). Input outside the cutout is
   swallowed except camera controls (never trap the camera).
2. **Arrow**: pulsing chevron SVG pointing at the cutout, auto-flips to whichever side has
   room, always animating along its axis (8px oscillation).
3. **Toast**: parchment card near the arrow, ≤ 2 lines, hilltop voice
   ("זה המעיין. בלי מים אין גבעה. שלח מישהו למלא ג'ריקן."), plus a small step counter
   `<bdi>3/9</bdi>` and "דלג על ההדרכה" link (confirm once).
4. **Completion**: the step's predicate (e.g. `jerrycanFilled >= 1`) → toast stamps a ✔,
   200ms, next step after a 1s breath.

Chapter 1 carries the core 9 steps (select → move → build ghost with rings → resource read →
clock read → pen the flock → alarm bell → save exists). Later chapters inject exactly one
step when their new mechanic first appears (e.g. demolition order ch5: pauses the game,
because that dilemma deserves full attention). Tutorial state persists in the save envelope;
re-triggerable from settings.

---

## 7. Keyboard Map

Critical implementation rule: bind by **`KeyboardEvent.code`** (physical key), never `key` —
on the Hebrew layout `key` returns Hebrew characters ('ש' for A) and WASD would break. Display
keycaps in the UI as the Latin physical letters (they're printed on Israeli keyboards), with
the action name in Hebrew: `[W] הזז מצלמה למעלה`.

| Key (code) | Action | Hebrew label |
|---|---|---|
| `KeyW/A/S/D` + arrows | camera pan | הזזת מצלמה |
| `KeyQ` / `KeyE` | rotate camera ∓45° (smooth) | סיבוב מצלמה |
| wheel / `+`/`-` on numpad | zoom | זום |
| `KeyC` | camera mode toggle | מבט על / מבט קרוב |
| `Space` | pause toggle | השהיה |
| `Minus` / `Equal` | speed down / up (1–3×) | מהירות |
| `Digit1..9` | recall control group | קבוצה |
| `Ctrl+Digit1..9` | assign control group | שמור קבוצה |
| double-tap digit | jump camera to group | קפוץ לקבוצה |
| `KeyB` | build menu | בנייה |
| `KeyG` | alarm bell | פעמון |
| `KeyF` | follow selected | עקוב |
| `KeyH` | jump to campfire (home) | הביתה |
| `Period` | next idle settler | מתיישב פנוי |
| `KeyR` | rotate build ghost | סיבוב מבנה |
| `Escape` | cancel ghost/selection → pause menu | ביטול |
| `Tab` | cycle sub-selection in multi-select | החלף נבחר |

All actions also reachable by on-screen buttons (tablet rule). Rebinds stored as `code`
strings in the save envelope. Show this table in pause menu → מדריך מקשים.

---

## 8. Component/DOM Skeleton (top level)

```html
<body>
  <canvas id="gl"></canvas>
  <svg id="sprite" style="display:none"><symbol id="i-wood">…</symbol>…</svg>
  <div id="ui" dir="rtl" lang="he">
    <div id="hud">
      <div id="spirit-gauge" class="panel"></div>
      <div id="clock" class="panel clock-capsule"></div>
      <div id="resources" class="panel res-strip"></div>
      <aside id="objectives" class="panel objectives"></aside>
      <div id="toasts"></div>
      <div id="log" class="card"></div>
      <div id="squads"></div>
      <section id="selection" class="panel sel-panel"></section>
      <nav id="build" class="panel build-menu"></nav>
      <button id="bell" class="ability"></button><div id="abilities"></div>
      <button id="cam-toggle" class="panel"></button>
      <canvas id="minimap" class="panel"></canvas>
    </div>
    <div id="tutorial" class="hidden"></div>
    <div id="menus" class="hidden"><!-- main / chapters / pause / settings / saves / end --></div>
    <div id="selbox"></div> <!-- drag-select rectangle: 1px dashed --sand, sky 12% fill -->
  </div>
</body>
```

State classes on `<body>` drive global theming: `.shabbat`, `.night` (panels cool slightly),
`.cinematic`, `.paused`, `.alert` (bell active: thin clay top border on the viewport).

---

## 9. Build Order for Implementation

1. Tokens + fonts + sprite + `.panel/.card/.btn` primitives.
2. Resource strip, clock capsule, spirit gauge (pure display — earliest playtest value).
3. Build menu + ghost strip; selection panel; minimap + pings.
4. Toasts + event log + objectives; alarm/abilities.
5. Pause/settings/save menus; win/lose; chapter map; tutorial director last (needs stable HUD
   targets).
