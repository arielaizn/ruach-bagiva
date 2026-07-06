// In-game HUD (Hebrew RTL, DOM overlay).
import { G } from '../core/state.js';
import { BALANCE } from '../game/balance.js';
import { t } from '../i18n/he.js';
import { formatClock, clamp } from '../core/util.js';
import { AudioSys } from '../audio.js';

export const ICONS = {
  wood: '🪵', stone: '🪨', food: '🍅', water: '💧', shekels: '₪', spirit: '🔥', pop: '👥',
  tent: '⛺', caravan: '🏠', sheep_pen: '🐑', veg_patch: '🌱', campfire: '🔥',
  fence: '🚧', pergola: '🪑', synagogue: '🕍', kennel: '🐕', zula: '🛋️',
  vineyard: '🍇', container: '📦', water_tower: '🚰', watchtower: '🗼', generator: '⚡',
  settler: '🧑‍🌾', settler_f: '👩‍🌾', guard: '🛡️', shepherd: '🐏', dog: '🐕', donkey: '🫏',
  sheep: '🐑', goat: '🐐', supporter: '🎓',
  jackal: '🦊', wolf: '🐺', boar: '🐗', thief: '🥷', raider: '🥷', leader: '🥷',
};
const JOB_ICONS = { idle: '✋', wood: '🪓', stone: '⛏️', farm: '🌱', water: '💧', build: '🔨', runner: '🚌', guard: '🛡️', shepherd: '🐑' };
const CATS = {
  cat_base: ['tent', 'caravan', 'container', 'pergola'],
  cat_farm: ['veg_patch', 'vineyard', 'sheep_pen', 'water_tower'],
  cat_defense: ['fence', 'kennel', 'watchtower', 'generator'],
  cat_spirit: ['campfire', 'zula', 'synagogue'],
};
const DAY_NAMES = ['day_shabbat', 'day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday'];

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export class Hud {
  constructor(root) {
    this.root = root;
    this.cat = 'cat_base';
    this._raidUntil = 0;
    this._lastSel = null;
    this._build();
    this._subscribe();
  }

  show() { this.root.classList.remove('hidden'); this.refreshBuildMenu(); this.renderObjectives(); }
  hide() { this.root.classList.add('hidden'); }

  _build() {
    const r = this.root;
    r.innerHTML = '';

    // resources
    this.resStrip = el('div', 'panel');
    this.resStrip.id = 'res-strip';
    this.resEls = {};
    for (const k of ['pop', 'wood', 'stone', 'food', 'water', 'shekels']) {
      const item = el('div', 'res-item', `<span class="ico">${ICONS[k]}</span><span class="v">0</span><span class="cap"></span>`);
      item.dataset.res = k;
      this.resEls[k] = item;
      this.resStrip.appendChild(item);
    }
    r.appendChild(this.resStrip);

    // clock
    this.clock = el('div', 'panel');
    this.clock.id = 'clock-capsule';
    this.clock.innerHTML = `<span class="dayname"></span><span class="daynum"></span><span class="clock"></span>`;
    const speeds = el('div', 'speed-btns');
    this.speedBtns = [];
    [['⏸', 0], ['▶', 1], ['⏩', 2], ['⏭', 3]].forEach(([ic, s]) => {
      const b = el('button', '', ic);
      b.title = t(s === 0 ? 'speed_pause' : 'speed_' + s);
      b.onclick = () => G.actions.setSpeed(s);
      this.speedBtns[s] = b;
      speeds.appendChild(b);
    });
    this.clock.appendChild(speeds);
    r.appendChild(this.clock);

    // spirit
    this.spirit = el('div', 'panel');
    this.spirit.id = 'spirit-gauge';
    this.spirit.innerHTML = `<span class="ico">🔥</span><div class="bar"><div class="fill"></div></div><span class="val"></span>`;
    this.spirit.title = t('res_spirit');
    r.appendChild(this.spirit);

    // objectives
    this.objPanel = el('div', 'panel');
    this.objPanel.id = 'objectives';
    r.appendChild(this.objPanel);

    // toasts
    this.toasts = el('div', '');
    this.toasts.id = 'toasts';
    r.appendChild(this.toasts);

    // raid banner
    this.raidBanner = el('div', '', '');
    this.raidBanner.id = 'raid-banner';
    r.appendChild(this.raidBanner);

    // demolition banner
    this.demoBanner = el('div', 'panel');
    this.demoBanner.id = 'demolition-banner';
    r.appendChild(this.demoBanner);

    // build menu
    this.buildMenu = el('div', '');
    this.buildMenu.id = 'build-menu';
    this.buildTabs = el('div', '');
    this.buildTabs.id = 'build-tabs';
    this.buildItems = el('div', 'panel');
    this.buildItems.id = 'build-items';
    this.buildMenu.append(this.buildTabs, this.buildItems);
    r.appendChild(this.buildMenu);

    // action bar (bell + kumzitz + camera)
    const bar = el('div', '');
    bar.id = 'action-bar';
    this.bellBtn = el('button', 'big-action', '🔔');
    this.bellBtn.title = t('tut_bell');
    this.bellBtn.onclick = () => G.actions.toggleBell();
    this.kumBtn = el('button', 'big-action', '🎸');
    this.kumBtn.onclick = () => { if (!G.actions.kumzitz()) this.toast({ type: 'info', text: t('kumzitz_not_now') }); };
    this.camBtn = el('button', 'big-action', '🎥');
    this.camBtn.title = t('btn_camera');
    this.camBtn.onclick = () => G.actions.toggleCameraMode();
    bar.append(this.bellBtn, this.kumBtn, this.camBtn);
    r.appendChild(bar);

    // selection panel
    this.selPanel = el('div', 'panel');
    this.selPanel.id = 'sel-panel';
    r.appendChild(this.selPanel);

    // idle chip
    this.idleChip = el('div', 'panel', '');
    this.idleChip.id = 'idle-chip';
    this.idleChip.onclick = () => this._cycleIdle();
    r.appendChild(this.idleChip);

    // minimap
    const mmWrap = el('div', '');
    mmWrap.id = 'minimap-wrap';
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.id = 'minimap';
    mmWrap.appendChild(this.minimapCanvas);
    r.appendChild(mmWrap);

    // tooltip
    this.tooltip = el('div', '');
    this.tooltip.id = 'tooltip';
    document.body.appendChild(this.tooltip);
  }

  _subscribe() {
    const ev = G.events;
    ev.on('alert', (a) => this.toast({ type: a.type, text: t(a.textKey, a.vars), sticky: a.sticky }));
    ev.on('objective-done', () => { this.renderObjectives(); AudioSys.play('build_done', { vol: 0.5 }); });
    ev.on('objective-progress', () => this.renderObjectives());
    ev.on('level-loaded', () => { this.renderObjectives(); this.refreshBuildMenu(); });
    ev.on('res-changed', () => { this._resDirty = true; });
    ev.on('pop-changed', () => { this._resDirty = true; });
    ev.on('selection-changed', () => this.renderSelection());
    ev.on('speed-changed', () => this._refreshSpeed());
    ev.on('bell', (on) => this.bellBtn.classList.toggle('armed', on));
    ev.on('raid-warning', (w) => this._showRaidWarning(w));
    ev.on('raid-start', () => { this.raidBanner.classList.remove('show'); });
    ev.on('raid-end', () => this.toast({ type: 'good', text: t('raid_end') }));
    ev.on('demolition-served', () => this._renderDemolition());
    ev.on('demolition-update', () => this._renderDemolition());
    ev.on('demolition-resolved', ({ outcome }) => {
      this._renderDemolition();
      const key = outcome === 'frozen' ? 'ev_demolition_frozen' : outcome === 'dismantled' ? 'ev_demolition_dismantled' : 'ev_demolition_executed';
      this.toast({ type: outcome === 'frozen' ? 'good' : 'warn', text: t(key) });
    });
    ev.on('sheep-stolen', (s) => this.toast({ type: 'bad', text: t('ev_sheep_stolen', { name: s.name }) }));
    ev.on('sheep-recovered', (s) => this.toast({ type: 'good', text: t('ev_sheep_recovered', { name: s.name }) }));
    ev.on('sheep-lost', (s) => this.toast({ type: 'warn', text: t('ev_sheep_lost', { name: s.name }) }));
    ev.on('kumzitz-start', () => this.toast({ type: 'good', text: t('ev_kumzitz') }));
    ev.on('shabbat-start', () => this.toast({ type: 'good', text: t('ev_shabbat_start') }));
    ev.on('camera-mode', () => { this.camBtn.textContent = G.rig.mode === 'iso' ? '🎥' : '🗺️'; });
  }

  // ---------------- toasts ----------------
  toast({ type = 'info', text, sticky = false }) {
    const tst = el('div', `toast ${type}`);
    tst.innerHTML = `<span>${text}</span>`;
    const x = el('button', 'x', '✕');
    x.onclick = () => tst.remove();
    tst.appendChild(x);
    this.toasts.prepend(tst);
    while (this.toasts.children.length > 4) this.toasts.lastChild.remove();
    setTimeout(() => tst.remove(), sticky ? 24000 : 9000);
  }

  _showRaidWarning(w) {
    const a = w.angles[0];
    const c = Math.cos(a), s = Math.sin(a);
    const dir = Math.abs(c) > Math.abs(s) ? (c > 0 ? t('dir_east') : t('dir_west')) : (s > 0 ? t('dir_south') : t('dir_north'));
    this._raidUntil = G.time.t + w.inS;
    this._raidDir = dir;
    this.raidBanner.classList.add('show');
  }

  // ---------------- objectives ----------------
  renderObjectives() {
    const objs = G.objectives ?? [];
    const p = this.objPanel;
    p.innerHTML = `<h3>${t('objectives_title')}<button id="obj-collapse">▾</button></h3>`;
    p.querySelector('#obj-collapse').onclick = () => p.classList.toggle('collapsed');
    for (const o of objs) {
      const row = el('div', 'obj' + (o.done ? ' done' : ''));
      // gated end-state objectives (flockEnd/spiritEnd) show a lock, not a %
      const gated = o.type === 'flockEnd' || o.type === 'spiritEnd';
      const showPct = !o.done && !gated && (o.type === 'res' || o.count > 1 || o.type === 'waves' || o.type === 'junction');
      const prog = showPct ? `<span class="prog">${Math.floor(clamp(o.progress, 0, 1) * 100)}%</span>`
        : (!o.done && gated && o.progress >= 1 ? `<span class="prog">✋</span>` : '');
      row.innerHTML = `<span class="check">${o.done ? '✔' : '◻'}</span><span>${t(o.textKey)}</span>${prog}`;
      p.appendChild(row);
    }
  }

  // ---------------- build menu ----------------
  refreshBuildMenu() {
    this.buildTabs.innerHTML = '';
    for (const cat in CATS) {
      const unlockedAny = CATS[cat].some(id => G.flags.unlocked?.has(id));
      if (!unlockedAny) continue;
      const b = el('button', this.cat === cat ? 'active' : '', t(cat));
      b.onclick = () => { this.cat = cat; this.refreshBuildMenu(); AudioSys.play('click'); };
      this.buildTabs.appendChild(b);
    }
    this.buildItems.innerHTML = '';
    this.bldBtns = [];
    for (const id of CATS[this.cat]) {
      if (!G.flags.unlocked?.has(id)) continue;
      const def = BALANCE.buildings[id];
      const cost = Object.entries(def.cost).map(([k, v]) => `${v}${ICONS[k]}`).join(' ');
      const btn = el('button', 'bld-btn', `<span class="ico">${ICONS[id]}</span><span class="nm">${t('bld_' + id)}</span><span class="cost">${cost}</span>`);
      btn.dataset.type = id;
      btn.onclick = () => {
        if (btn.classList.contains('disabled')) { this.toast({ type: 'warn', text: t('need_res') }); return; }
        G.actions.startPlacement(id);
        AudioSys.play('click');
      };
      btn.onmouseenter = (e) => this._showTip(e, `<div class="tt-title">${ICONS[id]} ${t('bld_' + id)}</div>${t('bldd_' + id)}<div class="tt-cost">${cost} · ${Math.round(def.buildS)} שנ׳ בנייה</div>`);
      btn.onmouseleave = () => this._hideTip();
      this.buildItems.appendChild(btn);
      this.bldBtns.push({ btn, def });
    }
  }

  _showTip(e, html) {
    const tt = this.tooltip;
    tt.innerHTML = html;
    tt.style.display = 'block';
    const rect = e.target.closest('button').getBoundingClientRect();
    tt.style.left = Math.max(8, rect.left + rect.width / 2 - 120) + 'px';
    tt.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    tt.style.top = 'auto';
  }
  _hideTip() { this.tooltip.style.display = 'none'; }

  // ---------------- selection ----------------
  renderSelection() {
    const sel = G.selection;
    const p = this.selPanel;
    if (!sel.length) { p.classList.remove('show'); return; }
    p.classList.add('show');
    p.innerHTML = '';
    if (sel.length === 1) {
      const e = sel[0];
      p.appendChild(this._selHead(e));
      if (e.kind === 'settler') {
        const jobs = el('div', 'jobs');
        for (const j of ['idle', 'wood', 'stone', 'farm', 'water', 'build', 'runner', 'guard', 'shepherd']) {
          const b = el('button', 'job-btn' + (e.job === j ? ' active' : ''), `${JOB_ICONS[j]} ${t('job_' + j)}`);
          b.onclick = () => { G.actions.assignJob([e], j); };
          jobs.appendChild(b);
        }
        p.appendChild(jobs);
      }
      if (e.kind === 'donkey') {
        const jobs = el('div', 'jobs');
        for (const j of ['idle', 'water']) {
          const b = el('button', 'job-btn' + (e.job === j ? ' active' : ''), `${JOB_ICONS[j] ?? '💧'} ${t(j === 'water' ? 'job_water_donkey' : 'job_idle')}`);
          b.onclick = () => { e.job = j; this.renderSelection(); AudioSys.play('click'); };
          jobs.appendChild(b);
        }
        p.appendChild(jobs);
      }
      if (e.kind === 'building' && e.state === 'done') {
        const acts = el('div', 'jobs');
        if (e.typeId === 'sheep_pen') {
          const b = el('button', 'job-btn', `🐑 ${t('btn_buy_sheep')}`);
          b.onclick = () => G.actions.buySheep();
          acts.appendChild(b);
        }
        if (e.typeId === 'kennel') {
          const b = el('button', 'job-btn', `🐕 ${t('btn_adopt_dog')}`);
          b.onclick = () => G.actions.adoptDog();
          acts.appendChild(b);
        }
        if (!e.def.core) {
          const b = el('button', 'job-btn', `🧨 ${t('dismantle')}`);
          b.onclick = () => G.actions.dismantle(e);
          acts.appendChild(b);
        }
        p.appendChild(acts);
      }
    } else {
      const head = el('div', 'sel-head', `<div class="portrait">👥</div><div><div class="sel-name">${sel.length} נבחרו</div></div>`);
      p.appendChild(head);
      const chips = el('div', 'multi');
      for (const e of sel.slice(0, 16)) chips.appendChild(el('span', 'chip', this._icon(e)));
      p.appendChild(chips);
      if (sel.some(e => e.kind === 'settler')) {
        const jobs = el('div', 'jobs');
        for (const j of ['idle', 'wood', 'stone', 'farm', 'water', 'build', 'guard']) {
          const b = el('button', 'job-btn', `${JOB_ICONS[j]} ${t('job_' + j)}`);
          b.onclick = () => G.actions.assignJob(sel, j);
          jobs.appendChild(b);
        }
        p.appendChild(jobs);
      }
    }
  }

  _icon(e) {
    if (e.kind === 'building') return ICONS[e.typeId] ?? '🏠';
    if (e.kind === 'settler') return e.job === 'guard' ? ICONS.guard : e.job === 'shepherd' ? ICONS.shepherd : (e.female ? ICONS.settler_f : ICONS.settler);
    if (e.kind === 'hostile') return ICONS[e.type] ?? '❓';
    if (e.kind === 'sheep') return ICONS[e.type] ?? '🐑';
    return ICONS[e.kind] ?? '❓';
  }

  _selHead(e) {
    let name = '', sub = '';
    if (e.kind === 'settler') {
      name = e.name;
      sub = `${t('job_' + e.job)} · ${t('trait_' + e.trait)}` + (e.fallen ? ` · ${t('injured')}` : '');
    } else if (e.kind === 'building') {
      name = t('bld_' + e.typeId);
      sub = e.state === 'site' ? `${t('under_construction')} ${Math.floor(e.progress / e.def.buildS * 100)}%` : t('bldd_' + e.typeId);
    } else if (e.kind === 'sheep') {
      name = e.name; sub = t('unit_' + e.type);
    } else if (e.kind === 'hostile') {
      name = t('hostile_' + e.type); sub = '';
    } else {
      name = e.name ?? t('unit_' + e.kind); sub = t('unit_' + e.kind);
    }
    const hpc = e.hp / e.maxHp;
    const head = el('div', 'sel-head');
    head.innerHTML = `<div class="portrait">${this._icon(e)}</div>
      <div style="flex:1"><div class="sel-name">${name}</div><div class="sel-sub">${sub}</div>
      <div class="hpbar"><div class="hp ${hpc < 0.35 ? 'low' : hpc < 0.7 ? 'mid' : ''}" style="width:${Math.max(2, hpc * 100)}%"></div></div></div>`;
    return head;
  }

  _cycleIdle() {
    const idle = G.units.filter(u => u.kind === 'settler' && u.alive && u.job === 'idle' && !u.fallen);
    if (!idle.length) return;
    this._idleI = ((this._idleI ?? -1) + 1) % idle.length;
    const u = idle[this._idleI];
    G.actions.select([u]);
    G.rig.flyTo(u.pos.x, u.pos.z);
  }

  _refreshSpeed() {
    const s = G.time.paused ? 0 : G.time.speed;
    this.speedBtns.forEach((b, i) => b.classList.toggle('active', i === s));
  }

  _renderDemolition() {
    const d = G.director?.demolition;
    const b = this.demoBanner;
    if (!d || d.state === 'resolved' || d.state === 'arriving') { b.classList.remove('show'); return; }
    b.classList.add('show');
    b.innerHTML = '';
    const title = el('div', 'title', `📋 ${t('demolition_days_left', { n: d.daysLeft })} — ${t('bld_' + d.building.typeId)}`);
    b.appendChild(title);
    if (d.state === 'active') {
      const row = el('div', 'row');
      const dis = el('button', 'danger', t('btn_dismantle_order'));
      dis.onclick = () => G.director.resolveDemolitionDismantle();
      const mus = el('button', '', t('btn_muster'));
      mus.disabled = G.spirit < BALANCE.demolition.muster.minSpirit;
      mus.onclick = () => { G.director.musterSupporters(); this._renderDemolition(); };
      row.append(mus, dis);
      b.appendChild(row);
    } else if (d.state === 'mustering') {
      b.appendChild(el('div', 'row', t('demolition_mustering')));
    } else if (d.state === 'executing') {
      b.appendChild(el('div', 'row', t('ev_dozer_coming')));
    }
  }

  // ---------------- per-frame ----------------
  update() {
    if (!G.running && !G.level) return;
    // resources
    if (this._resDirty !== false) {
      this._resDirty = false;
      for (const k of ['wood', 'stone', 'food', 'water', 'shekels']) {
        const item = this.resEls[k];
        const v = Math.floor(G.res[k]);
        item.querySelector('.v').textContent = v;
        const cap = G.caps[k];
        item.querySelector('.cap').textContent = cap && cap < 9999 ? '/' + cap : '';
        item.classList.toggle('low', v <= (k === 'shekels' ? -1 : 4));
        item.classList.toggle('full', !!cap && cap < 9999 && v >= cap);
      }
      const settlers = G.units.filter(u => u.kind === 'settler' && u.alive).length;
      this.resEls.pop.querySelector('.v').textContent = settlers;
      this.resEls.pop.querySelector('.cap').textContent = '/' + G.pop.max;
      // spirit
      const sp = Math.floor(G.spirit);
      this.spirit.querySelector('.fill').style.width = sp + '%';
      this.spirit.querySelector('.val').textContent = sp;
      this.spirit.classList.toggle('low', sp < 25);
    }
    // clock (every frame, cheap)
    const day = G.time.day;
    const dn = DAY_NAMES[day % 7];
    this.clock.querySelector('.dayname').textContent = t(dn);
    this.clock.querySelector('.daynum').textContent = t('day_n', { n: day });
    this.clock.querySelector('.clock').textContent = formatClock(G.time.hour);
    this.clock.classList.toggle('shabbat', G.time.isShabbat);
    this._refreshSpeed();

    // raid countdown
    if (this.raidBanner.classList.contains('show')) {
      const left = Math.max(0, Math.ceil(this._raidUntil - G.time.t));
      this.raidBanner.textContent = `⚠️ ${t('raid_warning', { dir: this._raidDir, s: left })}`;
      if (left <= 0) this.raidBanner.classList.remove('show');
    }

    // kumzitz availability
    const canKum = G.actions.canKumzitz?.() ?? false;
    this.kumBtn.classList.toggle('ready', canKum);
    this.kumBtn.title = t('btn_kumzitz', { n: BALANCE.spirit.kumzitzWoodCost });

    // idle chip
    const idle = G.units.filter(u => u.kind === 'settler' && u.alive && u.job === 'idle' && !u.fallen).length;
    this.idleChip.classList.toggle('show', idle > 0);
    if (idle > 0) this.idleChip.textContent = t('idle_workers', { n: idle });

    // selection panel live refresh (HP/progress) at ~3Hz
    this._selT = (this._selT ?? 0) + 1;
    if (this._selT % 20 === 0 && G.selection.length === 1) this.renderSelection();
  }
}
