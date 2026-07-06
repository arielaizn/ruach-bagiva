// QA free-play run: ~12 game-days on "הגבעה שלי" (normal difficulty).
// Verifies endless scheduler, hitchhikers, no wrong lose-state.
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
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1', 'ch2'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הגבעה שלי');
await page.waitForTimeout(400);
await page.click('text=שחק');
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

// instrument events
await page.evaluate(() => {
  const G = window.__G;
  window.__QA = { events: [] };
  const tag = (name) => (p) => window.__QA.events.push({ name, day: G.time.day, hour: +G.time.hour.toFixed(1), info: p?.textKey ?? p?.reasonKey ?? p?.budget ?? (p?.cur !== undefined ? `${p.cur}/${p.max}` : '') });
  for (const ev of ['alert', 'raid-warning', 'raid-end', 'level-lost', 'level-won', 'pop-changed', 'objective-done', 'demolition-served', 'demolition-resolved', 'weather']) {
    G.events.on(ev, tag(ev));
  }
});

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    spirit: Math.round(G.spirit), pop: `${G.pop.cur}/${G.pop.max}`,
    units: G.units.map(u => `${u.kind === 'settler' ? (u.job ?? 'idle') : u.kind}${u.fallen ? ':INJ' : ''}`).join(','),
    positions: G.units.map(u => `${Math.round(u.pos.x)},${Math.round(u.pos.z)}`).join('|'),
    flock: G.flock.filter(s => s.alive).length,
    hostiles: G.hostiles.filter(h => h.alive).map(h => `${h.type}:${h.state}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}:${Math.round((o.progress ?? 0) * 100)}%${o.done ? ':DONE' : ''}`).join(','),
    pendingWaves: G.director.pendingWaves.map(w => `b${w.budget}@t${Math.round(w.atT - G.time.t)}s`).join(','),
    waves: G.runner?.wavesSurvived, bell: !!G.flags.bell,
    lost: !!G.runner?.lost, won: !!G.runner?.won,
    fp: { lastDay: G.director._fpLastDay, bigN: G.director._fpBigN },
    hitchT: Math.round(G.director.hitchhikerT),
  };
});

// ---- initial economy setup
const setup = await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  const out = [];
  const place = (type) => {
    G.actions.startPlacement(type);
    for (let r = 5; r < 30; r += 1.5) {
      for (let a = 0; a < 20; a++) {
        const x = base.x + Math.cos(a / 20 * Math.PI * 2) * r;
        const z = base.z + Math.sin(a / 20 * Math.PI * 2) * r;
        G.actions.movePlacement(x, z);
        if (G.placement?.valid) { G.actions.confirmPlacement(false); return true; }
      }
    }
    G.actions.cancelPlacement();
    return false;
  };
  for (const type of ['veg_patch', 'sheep_pen']) out.push(`${type}:${place(type)}`);
  // jobs: keep the shepherd; others -> wood, water, build
  const settlers = G.units.filter(u => u.kind === 'settler');
  const free = settlers.filter(s => s.job !== 'shepherd');
  const jobs = ['wood', 'water', 'build'];
  free.forEach((s, i) => s.setJob(jobs[i % jobs.length]));
  G.actions.setSpeed(3);
  return out.join(',') + ' | jobs:' + settlers.map(s => s.job).join(',');
});
console.log('SETUP:', setup);
console.log('T0:', JSON.stringify(await state()));

let lastDayLogged = 0;
const stuckMap = new Map();
const stuckReports = [];
let doneReason = 'hard-stop';
const kumzitzDays = new Set();
let towerBuilt = false, kennelBuilt = false, tent3 = false, pergBuilt = false;

while (Date.now() - t0 < HARD_STOP_MS) {
  await page.waitForTimeout(5000);
  const s = await state();

  // stuck detection (identical position for ~60s real)
  for (const [i, p] of s.positions.split('|').entries()) {
    const rec = stuckMap.get(i);
    if (rec && rec.p === p) { rec.n++; if (rec.n === 12) stuckReports.push(`unit#${i} @${p} day${s.day} units=${s.units}`); }
    else stuckMap.set(i, { p, n: 0 });
  }

  // player brain
  const act = await page.evaluate(({ towerBuilt, kennelBuilt, tent3, pergBuilt, kumzitzDaysArr }) => {
    const G = window.__G;
    const A = G.actions;
    const done = [];
    const base = G.basePos ?? { x: 0, z: 0 };
    const place = (type) => {
      A.startPlacement(type);
      for (let r = 5; r < 30; r += 1.5) {
        for (let a = 0; a < 20; a++) {
          const x = base.x + Math.cos(a / 20 * Math.PI * 2) * r;
          const z = base.z + Math.sin(a / 20 * Math.PI * 2) * r;
          A.movePlacement(x, z);
          if (G.placement?.valid) { A.confirmPlacement(false); return true; }
        }
      }
      A.cancelPlacement(); return false;
    };
    const settlers = G.units.filter(u => u.kind === 'settler' && u.alive);
    // bell: ring when hostiles alive or wave landing within 25s; unring otherwise
    const threat = G.hostiles.some(h => h.alive) || G.director.pendingWaves.some(w => w.atT - G.time.t < 25);
    if (threat && !G.flags.bell) { A.toggleBell(); done.push('bell-on'); }
    if (!threat && G.flags.bell) { A.toggleBell(); done.push('bell-off'); }
    // kumzitz in the evening, once per day, when spirit sags
    if (!threat && G.time.hour > 18 && G.time.hour < 21 && !kumzitzDaysArr.includes(G.time.day) && G.spirit < 75 && (!A.canKumzitz || A.canKumzitz())) {
      if (A.kumzitz()) done.push('kumzitz-day' + G.time.day);
    }
    // builds by priority once resources allow (max one new site at a time)
    const has = (t) => G.buildings.some(b => b.typeId === t);
    const sites = G.buildings.filter(b => b.state === 'site').length;
    if (sites === 0) {
      if (!kennelBuilt && has('sheep_pen') && G.res.wood >= 40 && G.res.food >= 15) { if (place('kennel')) done.push('built-kennel'); }
      else if (!towerBuilt && G.res.wood >= 60 && G.res.stone >= 30 && G.res.shekels >= 50) { if (place('water_tower')) done.push('built-water_tower'); }
      else if (G.pop.max - G.pop.cur < 1 && G.res.wood >= 25 && G.buildings.filter(b => b.typeId === 'tent').length < 8) { if (place('tent')) done.push('built-tent'); }
      else if (!pergBuilt && towerBuilt && kennelBuilt && G.res.wood >= 35) { if (place('pergola')) done.push('built-pergola'); }
    }
    // buy sheep when affordable & pen exists
    if (G.res.shekels >= 40 && G.flock.length < 12) { if (A.buySheep()) done.push('buy-sheep'); }
    // adopt second dog
    if (G.units.filter(u => u.kind === 'dog').length < 2 && G.res.food >= 25) { if (A.adoptDog()) done.push('adopt-dog'); }
    // job rebalance: builders <-> farm/stone depending on open sites
    const constructing = G.buildings.some(b => b.state === 'site');
    for (const st of settlers) {
      if (st.job === 'build' && !constructing) { st.setJob(G.res.stone < 40 ? 'stone' : 'farm'); done.push('rejob-' + st.job); }
      else if ((st.job === 'farm' || st.job === 'stone') && constructing && !settlers.some(x => x.job === 'build')) { st.setJob('build'); done.push('rejob-build'); }
    }
    // newcomers with no job -> water or wood
    for (const st of settlers) {
      if (!st.job) { st.setJob(G.res.water < 20 ? 'water' : 'wood'); done.push('job-newcomer'); }
    }
    if (G.time.speed !== 3 && !G.time.paused) A.setSpeed(3);
    return done;
  }, { towerBuilt, kennelBuilt, tent3, pergBuilt, kumzitzDaysArr: [...kumzitzDays] });
  for (const a of act) {
    if (a === 'built-water_tower') towerBuilt = true;
    if (a === 'built-kennel') kennelBuilt = true;
    if (a === 'built-tent') tent3 = true;
    if (a === 'built-pergola') pergBuilt = true;
    if (a.startsWith('kumzitz-day')) kumzitzDays.add(+a.slice(11));
  }
  if (act.length) console.log(`[act d${s.day} h${s.hour}]`, act.join(','));

  if (s.day !== lastDayLogged) {
    lastDayLogged = s.day;
    console.log(`=== DAY ${s.day} ===`, JSON.stringify(s));
    if ([3, 6, 9, 12].includes(s.day)) await page.screenshot({ path: `${SHOTDIR}/free_day${s.day}.png` });
  }
  if (s.hostiles) console.log(`[raid d${s.day} h${s.hour}] hostiles=${s.hostiles} pending=${s.pendingWaves} waves=${s.waves} flock=${s.flock} bell=${s.bell}`);

  const lostText = await page.locator('text=הגבעה נפלה').count();
  if (s.lost || lostText) { doneReason = 'LOST'; console.log('LOST at', JSON.stringify(s)); await page.screenshot({ path: SHOTDIR + '/free_lost.png' }); break; }
  if (s.day >= 13) { doneReason = 'reached-day13'; break; }
}

const finalS = await state();
const events = await page.evaluate(() => window.__QA.events);
console.log('=== FINAL ===', JSON.stringify(finalS));
console.log('=== EVENTS ===');
for (const e of events) console.log(`d${e.day} h${e.hour} ${e.name} ${e.info}`);
console.log('=== STUCK ===', stuckReports.join(' ; ') || 'none');
console.log('=== DONE:', doneReason, 'realMin:', ((Date.now() - t0) / 60000).toFixed(1));
console.log('=== CONSOLE/PAGEERROR (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await page.screenshot({ path: SHOTDIR + '/free_final.png' });
await browser.close();
