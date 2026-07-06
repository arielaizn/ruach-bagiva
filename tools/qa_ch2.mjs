// QA playthrough of ch2 ("רוח בגבעה") — legit player simulation, no state cheats.
// Strategy: build pen+kennel early, adopt 2nd dog, manage jobs adaptively,
// ring bell on raids, kumzitz evenings, survive both scripted waves, keep flock >= 6.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const HARD_STOP_MS = 14 * 60 * 1000;
const t0 = Date.now();

const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    resRaw: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, v])),
    spirit: Math.round(G.spirit),
    units: G.units.map(u => ({ kind: u.kind, name: u.name, job: u.job ?? null, state: u.state ?? null, inj: !!u.fallen, x: +u.pos.x.toFixed(1), z: +u.pos.z.toFixed(1), hp: Math.round(u.hp) })),
    flock: G.flock.filter(s => s.alive).length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}:${Math.round((b.progress / (b.def.buildS || 1)) * 100)}%`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}=${o.done ? 'DONE' : Math.round((o.progress ?? 0) * 100) + '%'}`).join(' '),
    waves: G.runner?.wavesSurvived, pending: G.director?.pendingWaves?.length ?? 0,
    bell: !!G.flags.bell, won: !!G.runner?.won, lost: !!G.runner?.lost,
  };
});

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(1).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);
console.log('=== CH2 START ===');
console.log(JSON.stringify(await state()));

// --- opening build orders: sheep_pen + kennel near base (spiral scan for valid spot)
const placed = await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  const results = [];
  for (const type of ['sheep_pen', 'kennel']) {
    G.actions.startPlacement(type);
    let ok = false;
    outer:
    for (let r = 6; r < 26; r += 2) {
      for (let a = 0; a < 24; a++) {
        const x = base.x + Math.cos(a / 24 * Math.PI * 2) * r;
        const z = base.z + Math.sin(a / 24 * Math.PI * 2) * r;
        G.actions.movePlacement(x, z);
        if (G.placement?.valid) { G.actions.confirmPlacement(false); ok = true; break outer; }
      }
    }
    if (!ok) G.actions.cancelPlacement();
    results.push(`${type}:${ok}`);
  }
  return results.join(',');
});
console.log('PLACED:', placed);

// initial jobs: shibi -> build, amichai -> water, donkey -> water; neria already shepherd
await page.evaluate(() => {
  const G = window.__G;
  const settlers = G.units.filter(u => u.kind === 'settler');
  const shibi = settlers.find(u => u.name === 'שיבי');
  const ami = settlers.find(u => u.name === 'עמיחי');
  if (shibi) shibi.setJob('build');
  if (ami) ami.setJob('water');
  const donkey = G.units.find(u => u.kind === 'donkey');
  if (donkey) donkey.job = 'water';
  G.actions.setSpeed(3);
});

// --- adaptive play loop
let lastPrint = 0;
const posHistory = new Map(); // name -> {x,z,since}
const stuckReported = new Set();
let kumzitzDays = new Set();
let end = null;
let nanReported = false;

while (Date.now() - t0 < HARD_STOP_MS) {
  await page.waitForTimeout(5000);
  const s = await state();

  // NaN / negative resource check
  for (const [k, v] of Object.entries(s.resRaw)) {
    if ((!Number.isFinite(v) || v < -0.01) && !nanReported) {
      console.log(`!!! RESOURCE BROKEN: ${k}=${v} at day${s.day} h${s.hour}`);
      nanReported = true;
    }
  }

  // stuck detection (workers only, not during shabbat/kumzitz/bell)
  const now = Date.now();
  for (const u of s.units) {
    const key = u.kind + ':' + (u.name ?? '');
    const prev = posHistory.get(key);
    const moved = !prev || Math.hypot(prev.x - u.x, prev.z - u.z) > 0.5;
    if (moved) posHistory.set(key, { x: u.x, z: u.z, since: now });
    else if (now - prev.since > 60000 && u.kind === 'settler' && u.job && !u.inj && !s.shabbat && !s.bell && !stuckReported.has(key)) {
      stuckReported.add(key);
      console.log(`!!! POSSIBLY STUCK: ${key} job=${u.job} state=${u.state} at (${u.x},${u.z}) for 60s+ (day${s.day} h${s.hour})`);
      await page.screenshot({ path: SHOTDIR + `/qa2_stuck_${u.name}.png` });
    }
  }

  // win/lose detection
  if (s.won || (await page.locator('text=ניצחון').count()) > 0) { end = 'WIN'; console.log('WIN at', JSON.stringify({ day: s.day, hour: s.hour })); break; }
  if (s.lost || (await page.locator('text=הגבעה נפלה').count()) > 0) { end = 'LOSE'; console.log('LOSE at', JSON.stringify({ day: s.day, hour: s.hour })); break; }

  // adaptive decisions
  const acted = await page.evaluate(({ kumzitzDone }) => {
    const G = window.__G;
    const out = [];
    const settlers = G.units.filter(u => u.kind === 'settler' && u.alive && !u.fallen);
    const byName = (n) => settlers.find(u => u.name === n);
    const shibi = byName('שיבי'), ami = byName('עמיחי');
    const building = G.buildings.some(b => b.state !== 'done');
    const raidSoon = G.hostiles.length > 0 || (G.director?.pendingWaves?.length ?? 0) > 0;

    // bell: on when hostiles/pending, off when quiet
    if (raidSoon && !G.flags.bell) { G.actions.toggleBell(); out.push('bell-on'); }
    if (!raidSoon && G.flags.bell) { G.actions.toggleBell(); out.push('bell-off'); }

    if (!G.flags.bell) {
      // job management
      if (shibi) {
        if (building && shibi.job !== 'build') { shibi.setJob('build'); out.push('shibi->build'); }
        else if (!building) {
          const want = G.res.wood < 35 ? 'wood' : (G.res.food < 20 ? 'farm' : 'guard');
          if (shibi.job !== want) { shibi.setJob(want); out.push('shibi->' + want); }
        }
      }
      if (ami) {
        const want = G.res.water < 25 ? 'water' : (G.res.food < 25 ? 'farm' : 'water');
        if (ami.job !== want) { ami.setJob(want); out.push('ami->' + want); }
      }
    }

    // adopt 2nd dog once kennel done
    const kennelDone = G.buildings.some(b => b.typeId === 'kennel' && b.state === 'done');
    const dogs = G.units.filter(u => u.kind === 'dog' && u.alive).length;
    if (kennelDone && dogs < 2 && G.res.food >= 15) { if (G.actions.adoptDog()) out.push('adopted-dog'); }

    // kumzitz in the evening (not on already-done days)
    const evening = G.time.hour >= 17.6 && G.time.hour < 23;
    if (evening && !G.time.isShabbat && !G.flags.kumzitzTonight && !kumzitzDone.includes(G.time.day) && G.res.wood >= 20 && !raidSoon) {
      if (G.actions.kumzitz()) out.push('kumzitz-day' + G.time.day);
    }
    return out;
  }, { kumzitzDone: [...kumzitzDays] });
  for (const a of acted) { if (a.startsWith('kumzitz-day')) kumzitzDays.add(+a.replace('kumzitz-day', '')); }
  if (acted.length) console.log(`[t+${Math.round((Date.now() - t0) / 1000)}s]`, 'ACT:', acted.join(','));

  if (now - lastPrint > 20000) {
    lastPrint = now;
    const brief = { ...s };
    brief.units = s.units.map(u => `${u.name ?? u.kind}:${u.job ?? u.state}${u.inj ? ':INJ' : ''}`).join(',');
    delete brief.resRaw;
    console.log(`[t+${Math.round((now - t0) / 1000)}s]`, JSON.stringify(brief));
    if (s.hostiles) await page.screenshot({ path: SHOTDIR + `/qa2_raid_d${s.day}.png` });
  }
}

const fin = await state();
console.log('=== FINAL STATE ===');
console.log(JSON.stringify({ ...fin, resRaw: undefined, units: fin.units.map(u => `${u.name ?? u.kind}:${u.job ?? u.state}`).join(',') }));
console.log('END:', end ?? 'TIMEOUT', 'realMin:', ((Date.now() - t0) / 60000).toFixed(1));
await page.screenshot({ path: SHOTDIR + '/qa2_final.png' });
console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
