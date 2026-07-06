// QA: FREE PLAY ("הגבעה שלי") — ~12 game-days, economy build-up, endless waves,
// day-9 big raid, hitchhikers, no wrong lose-state.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const HARD_STOP_MS = 13.5 * 60 * 1000;
const t0 = Date.now();

const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1', 'ch2'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);

// main menu -> הגבעה שלי -> שחק (normal difficulty, demolition on) -> התחל
await page.click('text=הגבעה שלי');
await page.waitForTimeout(400);
await page.click('text=שחק');
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

// install in-page QA recorder
await page.evaluate(() => {
  const G = window.__G;
  window.__QA = { events: [], err: [] };
  const rec = (ev) => G.events.on(ev, (p) => window.__QA.events.push({
    day: G.time.day, hour: +G.time.hour.toFixed(1), ev,
    p: p?.textKey ?? p?.reasonKey ?? (ev === 'pop-changed' ? `${p?.cur}/${p?.max}` : (p?.budget != null ? 'budget=' + p.budget : '')),
  }));
  ['alert', 'raid-warning', 'raid-end', 'level-lost', 'level-won', 'pop-changed', 'objective-done', 'weather', 'structure-destroyed'].forEach(rec);
  G.actions.setSpeed(3);
});

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    caps: G.caps, pop: `${G.pop.cur}/${G.pop.max}`, spirit: Math.round(G.spirit),
    units: G.units.map(u => `${u.kind}:${u.job ?? u.state ?? ''}${u.fallen ? ':INJ' : ''}`).join(','),
    upos: G.units.filter(u => u.kind === 'settler').map(u => `${u.name}@${u.pos.x.toFixed(1)},${u.pos.z.toFixed(1)}:${u.state}:${u.job ?? '-'}`),
    flock: G.flock.filter(s => s.alive).length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}:${(o.progress * 100 | 0)}%${o.done ? ':DONE' : ''}`).join(','),
    pending: G.director.pendingWaves.map(w => `b${w.budget}@${Math.round(w.atT - G.time.t)}s${w.warned ? ':warned' : ''}`).join(','),
    bell: !!G.flags.bell, waves: G.runner?.wavesSurvived,
    lost: !!G.runner?.lost, won: !!G.runner?.won,
    qa: window.__QA.events.splice(0),
  };
});

// one controller tick: bell, kumzitz, build queue, jobs, purchases
const control = () => page.evaluate(() => {
  const G = window.__G;
  const out = [];
  if (G.time.paused || !G.running) return ['not-running'];
  if (G.time.speed !== 3) { G.actions.setSpeed(3); out.push('respeed'); }

  // --- bell: on when a warned wave is pending or hostiles alive; off otherwise
  const danger = G.hostiles.some(h => h.alive) || G.director.pendingWaves.some(w => w.warned);
  if (danger !== !!G.flags.bell) { G.actions.toggleBell(); out.push('bell->' + danger); }

  // --- kumzitz once a day in the evening, when calm
  window.__QA.kumDay ??= 0;
  if (!danger && !G.time.isShabbat && G.time.hour >= 18.5 && G.time.hour <= 20.5 && G.res.wood >= 25 && window.__QA.kumDay !== G.time.day) {
    if (G.actions.kumzitz()) { window.__QA.kumDay = G.time.day; out.push('kumzitz'); }
  }

  // --- build queue
  window.__QA.queue ??= ['tent', 'sheep_pen', 'veg_patch', 'tent', 'kennel', 'tent', 'water_tower', 'tent', 'tent', 'veg_patch', 'synagogue', 'tent', 'tent'];
  const q = window.__QA.queue;
  if (q.length && !G.placement && !danger && !G.time.isShabbat) {
    const type = q[0];
    // affordability via BALANCE exposed on placement failure is awkward; just try
    G.actions.startPlacement(type);
    if (G.placement) {
      const base = G.basePos ?? { x: 0, z: 0 };
      let ok = false;
      outer:
      for (let r = 5; r < 32; r += 2) {
        for (let a = 0; a < 20; a++) {
          const x = base.x + Math.cos(a / 20 * Math.PI * 2 + r) * r;
          const z = base.z + Math.sin(a / 20 * Math.PI * 2 + r) * r;
          G.actions.movePlacement(x, z);
          if (G.placement?.valid) { G.actions.confirmPlacement(false); ok = true; break outer; }
        }
      }
      if (ok) { q.shift(); out.push('placed:' + type); }
      else { G.actions.cancelPlacement(); out.push('noplace:' + type); }
    } // startPlacement no-op => can't afford yet
  }

  // --- job assignment: desired mix scales with pop
  const settlers = G.units.filter(u => u.kind === 'settler' && u.alive && !u.fallen);
  const want = [['shepherd', 1], ['wood', 2], ['water', 1], ['build', 1], ['farm', 1], ['guard', 1], ['wood', 3], ['water', 2], ['farm', 2], ['guard', 2], ['runner', 1]];
  const count = (j) => settlers.filter(u => u.job === j).length;
  for (const [job, n] of want) {
    if (count(job) >= n) continue;
    const free = settlers.find(u => !u.job || u.job === 'idle');
    if (!free) break;
    free.setJob(job);
    out.push(`job:${free.name}->${job}`);
  }

  // --- purchases: keep >=60 shekels reserve until water_tower done, then sheep/dogs
  const towerDone = G.buildings.some(b => b.typeId === 'water_tower' && b.state === 'done');
  const reserve = towerDone ? 30 : 110;
  if (G.res.shekels >= reserve + 25 && G.actions.buySheep()) out.push('sheep+1');
  if (G.res.shekels >= reserve + 40 && G.actions.adoptDog()) out.push('dog+1');
  return out;
});

console.log('=== FREE PLAY START ===');
console.log(JSON.stringify(await state()));

let lastShotDay = 0;
const posHistory = new Map(); // name -> {pos, sinceMs}
let stuckReports = [];
let finalReason = 'hard-stop';

while (true) {
  if (Date.now() - t0 > HARD_STOP_MS) { finalReason = 'hard-stop 13.5min'; break; }
  const acts = await control().catch(e => ['CTRLERR:' + e.message]);
  await page.waitForTimeout(4000);
  const s = await state().catch(e => null);
  if (!s) { logs.push('[HARNESS] state() failed'); continue; }
  const mm = ((Date.now() - t0) / 60000).toFixed(1);
  if (acts.length) console.log(`[${mm}m] ACT ${acts.join(' | ')}`);
  for (const e of s.qa) console.log(`[${mm}m] EV d${e.day} h${e.hour} ${e.ev} ${e.p}`);
  console.log(`[${mm}m] d${s.day} h${s.hour}${s.shabbat ? ' SHABBAT' : ''} pop=${s.pop} spirit=${s.spirit} flock=${s.flock} res=${JSON.stringify(s.res)} waves=${s.waves} pending=[${s.pending}] hostiles=[${s.hostiles}] bell=${s.bell}`);
  console.log(`[${mm}m] bld=[${s.buildings}] obj=[${s.objectives}]`);

  // NaN / negative res check
  for (const [k, v] of Object.entries(s.res)) {
    if (!Number.isFinite(v)) logs.push(`[GAMEBUG] res.${k} is ${v} at d${s.day}h${s.hour}`);
    if (v < -0.5) logs.push(`[GAMEBUG] res.${k} negative ${v} at d${s.day}h${s.hour}`);
  }
  // stuck detection (same pos & working state for 60s real while having a job)
  for (const up of s.upos) {
    const [name, rest] = up.split('@');
    const prev = posHistory.get(name);
    if (prev && prev.rest === rest && !rest.includes(':idle') && !rest.includes('sleep')) {
      if (Date.now() - prev.since > 60000 && !stuckReports.includes(name + rest)) {
        stuckReports.push(name + rest);
        console.log(`[${mm}m] STUCK? ${up} unchanged for 60s+`);
      }
    } else posHistory.set(name, { rest, since: Date.now() });
  }
  if (s.day >= 3 && s.day > lastShotDay && (s.day % 3 === 0)) {
    lastShotDay = s.day;
    await page.screenshot({ path: `${SHOTDIR}/free_d${s.day}.png` }).catch(() => {});
  }
  if (s.lost) { finalReason = 'LOST'; await page.screenshot({ path: SHOTDIR + '/free_lost.png' }); break; }
  if (s.won) { finalReason = 'WON'; break; }
  if (s.day >= 13) { finalReason = 'reached day 13'; break; }
}

console.log('=== END:', finalReason, '===');
console.log(JSON.stringify(await state().catch(() => ({}))));
await page.screenshot({ path: SHOTDIR + '/free_end.png' }).catch(() => {});
const loseTxt = await page.locator('text=הגבעה נפלה').count().catch(() => 0);
console.log('LOSE SCREEN:', loseTxt);
console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
console.log('REAL MINUTES:', ((Date.now() - t0) / 60000).toFixed(1));
await browser.close();
