// Menus: main, chapter select, settings, pause, intro, win/lose.
import { G } from '../core/state.js';
import { LEVELS, FREEPLAY } from '../game/levels.js';
import { t } from '../i18n/he.js';
import { Save } from '../save.js';
import { AudioSys } from '../audio.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

export class Menus {
  constructor(root, { onStartLevel, onQuitToMenu }) {
    this.root = root;
    this.onStartLevel = onStartLevel;
    this.onQuitToMenu = onQuitToMenu;
    this.current = null;
    G.events.on('open-pause', () => { if (G.running) this.showPause(); });
    G.events.on('close-modal', () => this.close());
    G.events.on('level-won', ({ level }) => this.showEnd(true, level));
    G.events.on('level-lost', ({ reasonKey }) => this.showEnd(false, G.level, reasonKey));
  }

  _screen(cls = 'screen dimmed') {
    this.close();
    const s = el('div', cls);
    this.root.appendChild(s);
    this.current = s;
    G.ui.modalOpen = true;
    return s;
  }

  close() {
    if (this.current) { this.current.remove(); this.current = null; }
    G.ui.modalOpen = false;
  }

  showMain() {
    const s = this._screen('screen');
    s.append(
      el('div', 'menu-title', t('game_title')),
      el('div', 'menu-sub', t('game_subtitle')),
    );
    const btns = el('div', 'menu-btns');
    const camp = el('button', 'menu-btn primary', t('btn_campaign'));
    camp.onclick = () => { AudioSys.init(); AudioSys.play('click'); this.showChapters(); };
    const free = el('button', 'menu-btn', t('btn_freeplay'));
    free.onclick = () => { AudioSys.init(); AudioSys.play('click'); this.showFreeSetup(); };
    const set = el('button', 'menu-btn', t('btn_settings'));
    set.onclick = () => { AudioSys.play('click'); this.showSettings(() => this.showMain()); };
    btns.append(camp, free, set);
    s.appendChild(btns);
    const tag = el('div', 'menu-sub', t('game_tagline'));
    tag.style.marginTop = '8px';
    s.appendChild(tag);
  }

  showChapters() {
    const s = this._screen('screen dimmed');
    s.appendChild(el('div', 'menu-title', t('btn_campaign')));
    const grid = el('div', '');
    grid.id = 'chapters-grid';
    const unlocked = Save.data.unlockedChapter;
    LEVELS.forEach((lv, i) => {
      const locked = i + 1 > unlocked;
      const done = Save.data.completed.includes(lv.id);
      const card = el('button', 'ch-card' + (locked ? ' locked' : '') + (done ? ' done' : ''));
      card.innerHTML = `<span class="num">${i + 1}</span><span class="nm">${t(lv.nameKey)}</span><span class="st">${locked ? t('locked') : done ? '✓ הושלם' : t('chapter', { n: i + 1 })}</span>`;
      if (!locked) card.onclick = () => { AudioSys.play('click'); this.showIntro(lv); };
      grid.appendChild(card);
    });
    // free play card
    const freeUnlocked = unlocked >= 3 || Save.data.completed.length >= 2;
    const fc = el('button', 'ch-card free' + (freeUnlocked ? '' : ' locked'));
    fc.innerHTML = `<span class="num">∞</span><span class="nm">${t('free_name')}</span><span class="st">${freeUnlocked ? 'עולם פתוח' : 'נפתח אחרי פרק 2'}</span>`;
    if (freeUnlocked) fc.onclick = () => { AudioSys.play('click'); this.showFreeSetup(); };
    grid.appendChild(fc);
    s.appendChild(grid);
    const back = el('button', 'menu-btn', t('btn_back'));
    back.onclick = () => this.showMain();
    s.appendChild(back);
  }

  showFreeSetup() {
    const s = this._screen('screen dimmed');
    s.appendChild(el('div', 'menu-title', t('free_name')));
    const card = el('div', 'set-card');
    // difficulty
    let difficulty = 1, demolition = true;
    const diffRow = el('div', 'set-row', `<span>${t('difficulty')}</span>`);
    const seg = el('div', 'seg');
    [['diff_calm', 0.7], ['diff_normal', 1], ['diff_chaos', 1.3]].forEach(([k, v]) => {
      const b = el('button', v === 1 ? 'active' : '', t(k));
      b.onclick = () => { difficulty = v; [...seg.children].forEach(c => c.classList.remove('active')); b.classList.add('active'); };
      seg.appendChild(b);
    });
    diffRow.appendChild(seg);
    const demoRow = el('div', 'set-row', `<span>${t('free_demolition')}</span>`);
    const seg2 = el('div', 'seg');
    [[t('on'), true], [t('off'), false]].forEach(([lbl, v]) => {
      const b = el('button', v ? 'active' : '', lbl);
      b.onclick = () => { demolition = v; [...seg2.children].forEach(c => c.classList.remove('active')); b.classList.add('active'); };
      seg2.appendChild(b);
    });
    demoRow.appendChild(seg2);
    card.append(diffRow, demoRow);
    s.appendChild(card);
    const play = el('button', 'menu-btn primary', t('btn_play'));
    play.onclick = () => this.showIntro(FREEPLAY, { difficulty, demolition });
    const back = el('button', 'menu-btn', t('btn_back'));
    back.onclick = () => this.showMain();
    s.append(play, back);
  }

  showIntro(level, opts) {
    const s = this._screen('screen');
    s.id = 'intro-overlay';
    const card = el('div', 'intro-card');
    card.innerHTML = `<h2>${t(level.nameKey)}</h2><p>${t(level.introKey)}</p>`;
    s.appendChild(card);
    const go = el('button', 'menu-btn primary', t('btn_start'));
    go.onclick = () => { this.close(); this.onStartLevel(level, opts); };
    s.appendChild(go);
  }

  showPause() {
    const wasPaused = G.time.paused;
    G.actions.setSpeed(0);
    const s = this._screen('screen dimmed');
    s.appendChild(el('div', 'menu-title', t('paused')));
    const btns = el('div', 'menu-btns');
    const res = el('button', 'menu-btn primary', t('btn_resume'));
    res.onclick = () => { this.close(); G.actions.setSpeed(1); };
    const restart = el('button', 'menu-btn', t('btn_restart'));
    restart.onclick = () => { this.close(); this.onStartLevel(G.level, this._lastOpts); };
    const set = el('button', 'menu-btn', t('btn_settings'));
    set.onclick = () => this.showSettings(() => this.showPause());
    const quit = el('button', 'menu-btn', t('btn_quit'));
    quit.onclick = () => { this.close(); this.onQuitToMenu(); };
    btns.append(res, restart, set, quit);
    s.appendChild(btns);
  }

  showSettings(backFn) {
    const s = this._screen('screen dimmed');
    s.appendChild(el('div', 'menu-title', t('btn_settings')));
    const card = el('div', 'set-card');
    const st = Save.data.settings;
    const mkSlider = (label, key) => {
      const row = el('div', 'set-row', `<span>${label}</span>`);
      const inp = el('input');
      inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = st[key];
      inp.oninput = () => {
        Save.setSetting(key, +inp.value);
        AudioSys.setVolume(Save.data.settings.master, Save.data.settings.sfx, Save.data.settings.music);
      };
      row.appendChild(inp);
      return row;
    };
    card.append(
      mkSlider(t('settings_volume'), 'master'),
      mkSlider(t('settings_sfx'), 'sfx'),
      mkSlider(t('settings_music'), 'music'),
    );
    const edgeRow = el('div', 'set-row', `<span>${t('settings_edgepan')}</span>`);
    const seg = el('div', 'seg');
    [[t('on'), true], [t('off'), false]].forEach(([lbl, v]) => {
      const b = el('button', st.edgePan === v ? 'active' : '', lbl);
      b.onclick = () => {
        Save.setSetting('edgePan', v);
        if (G.input) G.input.edgePanEnabled = v;
        [...seg.children].forEach(c => c.classList.remove('active'));
        b.classList.add('active');
      };
      seg.appendChild(b);
    });
    edgeRow.appendChild(seg);
    card.appendChild(edgeRow);
    s.appendChild(card);
    const back = el('button', 'menu-btn', t('btn_back'));
    back.onclick = () => backFn ? backFn() : this.showMain();
    s.appendChild(back);
  }

  showEnd(won, level, reasonKey) {
    const s = this._screen('screen dimmed');
    s.appendChild(el('div', 'menu-title', won ? t('victory_title') : t('defeat_title')));
    const idx = LEVELS.indexOf(level);
    if (won && level.id !== 'free') Save.completeChapter(level.id, idx);
    const text = el('div', 'end-text', won ? t(level.winKey ?? '') : t(reasonKey ?? ''));
    s.appendChild(text);
    const stats = el('div', 'end-stats');
    const rows = [
      ['stats_days', G.time.day],
      ['stats_raids', G.stats.raidsRepelled],
      ['stats_driven', G.stats.hostilesDriven],
      ['stats_built', G.stats.buildingsBuilt],
      ['stats_shekels', Math.floor(G.stats.shekelsEarned)],
      ['stats_kumzitz', G.stats.kumzitzim ?? 0],
    ];
    for (const [k, v] of rows) stats.appendChild(el('div', 'row', `<span>${t(k)}</span><b>${v}</b>`));
    s.appendChild(stats);
    const btns = el('div', 'menu-btns');
    if (won && level.id !== 'free' && idx < LEVELS.length - 1) {
      const next = el('button', 'menu-btn primary', t('btn_next_chapter'));
      next.onclick = () => this.showIntro(LEVELS[idx + 1]);
      btns.appendChild(next);
    }
    if (!won) {
      const retry = el('button', 'menu-btn primary', t('btn_restart'));
      retry.onclick = () => { this.close(); this.onStartLevel(level, this._lastOpts); };
      btns.appendChild(retry);
    }
    const quit = el('button', 'menu-btn', t('btn_quit'));
    quit.onclick = () => { this.close(); this.onQuitToMenu(); };
    btns.appendChild(quit);
    s.appendChild(btns);
  }
}
