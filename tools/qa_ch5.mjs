// QA playthrough of chapter 5 (card idx 4): junction x3, watchtower, vineyard, 3 waves.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const t0 = Date.now();
const mins = () => ((Date.now() - t0) / 60000).toFixed(1);

const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1','ch2','ch3','ch4'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(4).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

// sanity: correct chapter?
const chId = await page.evaluate(() => window.__G.runner?.level?.id);
console.log('CHAPTER:', chId);

// ---- initial placement: watchtower toward road (south), vineyard anywhere ----
const placed = await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  const road = G.terrain.roadEntry ?? { x: 0, z: 30 };
  const results = [];
  const place = (type, cx, cz) => {
    G.actions.startPlacement(type);
    for (let r = 0; r < 22; r += 1.5) {
      for (let a = 0; a < 20; a++) {
        const x = cx + Math.cos(a / 20 * Math.PI * 2) * r;
        const z = cz + Math.sin(a / 20 * Math.PI * 2) * r;
        G.actions.movePlacement(x, z);
        if (G.placement?.valid) { G.actions.confirmPlacement(false); return `${type}:ok@${Math.round(x)},${Math.round(z)}`; }
      }
    }
    G.actions.cancelPlacement();
    return `${type}:FAILED`;
  };
  // watchtower ~40% of the way toward road entry
  results.push(place('watchtower', base.x + (road.x - base.x) * 0.35, base.z + (road.z - base.z) * 0.35));
  results.push(place('vineyard', base.x, base.z));
  return { results, base, road };
});
console.log('PLACED:', JSON.stringify(placed));

// ---- management + state function run inside the page each tick ----
const tick = () => page.evaluate(() => {
  const G = window.__G;
  const out = { notes: [] };
  const settlers = G.units.filter(u => u.kind === 'settler' && !u.fallen);
  const sites = G.buildings.filter(b => b.state === 'site');
  const junctionDone = (G.runner.junctionTrips ?? 0) >= 3;
  const activeHostiles = G.hostiles.filter(h => h.state !== 'flee' && h.state !== 'dead');
  const warnSoon = (G.director.pendingWaves ?? []).some(w => (w.atT - G.time.t) < 22);

  // --- bell ---
  const wantBell = activeHostiles.length > 0 || warnSoon;
  if (!!G.flags.bell !== wantBell) { G.actions.toggleBell(); out.notes.push('bell->' + wantBell); }

  // --- jobs (stable, index-based; only set when different) ---
  const setJ = (u, j) => { if (u && u.job !== j) { u.setJob(j); out.notes.push(`${u.name}->${j}`); } };
  const byIdx = settlers; // kit order
  if (byIdx[1]) setJ(byIdx[1], 'shepherd');
  if (byIdx[2]) setJ(byIdx[2], 'guard');
  if (byIdx[3]) setJ(byIdx[3], junctionDone ? 'guard' : 'runner');
  const heavy = sites.length > 0 ? 'build' : 'wood';
  if (byIdx[0]) setJ(byIdx[0], heavy);
  if (byIdx[5]) setJ(byIdx[5], heavy);
  if (byIdx[4]) setJ(byIdx[4], 'water');
  if (byIdx[6]) setJ(byIdx[6], G.res.water < 28 ? 'water' : 'farm');

  // --- kumzitz once/day in the evening ---
  window.__qa = window.__qa || { kumDay: 0, gen: false };
  if (!G.flags.bell && !G.time.isShabbat && G.time.hour >= 19 && G.time.hour < 21
      && window.__qa.kumDay !== G.time.day && G.res.wood >= 15) {
    const ok = G.actions.kumzitz?.();
    if (ok !== false) { window.__qa.kumDay = G.time.day; out.notes.push('kumzitz d' + G.time.day); }
  }

  // --- generator before raider nights (day>=5, shekels allow) ---
  if (!window.__qa.gen && G.time.day >= 5 && G.res.shekels >= 100 && G.res.wood >= 25) {
    const base = G.basePos ?? { x: 0, z: 0 };
    G.actions.startPlacement('generator');
    let ok = false;
    outer: for (let r = 4; r < 18; r += 1.5) for (let a = 0; a < 16; a++) {
      const x = base.x + Math.cos(a / 16 * Math.PI * 2) * r, z = base.z + Math.sin(a / 16 * Math.PI * 2) * r;
      G.actions.movePlacement(x, z);
      if (G.placement?.valid) { G.actions.confirmPlacement(false); ok = true; break outer; }
    }
    if (!ok) G.actions.cancelPlacement();
    window.__qa.gen = ok;
    out.notes.push('generator:' + ok);
  }

  G.actions.setSpeed(3);

  out.state = {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])),
    spirit: Math.round(G.spirit),
    units: settlers.map(u => `${u.name}:${u.job}`).join(','),
    fallen: G.units.filter(u => u.kind === 'settler' && u.fallen).length,
    flock: G.flock.length, dogs: G.units.filter(u => u.kind === 'dog').length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}:c${Math.round(h.courage)}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.runner.objState ?? G.objectives ?? []).map(o => `${o.id}${o.done ? ':DONE' : ''}`).join(','),
    waves: G.runner.wavesSurvived, trips: G.runner.junctionTrips, bell: !!G.flags.bell,
    pending: (G.director.pendingWaves ?? []).map(w => Math.round(w.atT - G.time.t)).join('/'),
    nan: Object.entries(G.res).filter(([, v]) => !Number.isFinite(v) || v < 0).map(([k, v]) => k + '=' + v).join(','),
    unitPos: settlers.map(u => `${Math.round(u.pos.x)},${Math.round(u.pos.z)}`).join(';'),
  };
  return out;
});

// ---- main loop ----
let lastPrint = 0, lastShotWave = -1, ended = 'timeout';
const posHistory = new Map(); // name -> {pos, since}
let lastState = null;
for (let i = 0; ; i++) {
  if (Date.now() - t0 > 14 * 60 * 1000) { ended = 'hard-stop-14min'; break; }
  const win = await page.locator('text=ניצחון!').count();
  const lose = await page.locator('text=הגבעה נפלה').count();
  if (win) { ended = 'WIN'; break; }
  if (lose) { ended = 'LOSE'; break; }
  let r;
  try { r = await tick(); } catch (e) { console.log('[HARNESS] tick failed:', e.message); await page.waitForTimeout(3000); continue; }
  lastState = r.state;
  if (r.notes.length) console.log(`[${mins()}m]`, r.notes.join(' | '));
  if (Date.now() - lastPrint > 20000) {
    lastPrint = Date.now();
    console.log(`[${mins()}m]`, JSON.stringify(r.state));
  }
  // stuck detection (only workers that should move)
  const now = Date.now();
  r.state.unitPos.split(';').forEach((p, idx) => {
    const key = 'u' + idx;
    const rec = posHistory.get(key);
    if (!rec || rec.pos !== p) posHistory.set(key, { pos: p, since: now });
    else if (now - rec.since > 90000 && !rec.flagged) { rec.flagged = true; console.log(`[STUCK?] settler#${idx} at ${p} for 90s+ (job=${r.state.units.split(',')[idx]})`); }
  });
  if (r.state.nan) console.log('[RESOURCE BUG]', r.state.nan);
  if (r.state.waves > lastShotWave && r.state.waves > 0) {
    lastShotWave = r.state.waves;
    await page.screenshot({ path: `${SHOTDIR}/qa5_wave${r.state.waves}.png` });
    console.log(`[${mins()}m] wave ${r.state.waves} survived — screenshot`);
  }
  await page.waitForTimeout(4000);
}

console.log('=== END:', ended, 'at', mins(), 'min ===');
console.log('FINAL STATE:', JSON.stringify(lastState));
await page.screenshot({ path: SHOTDIR + '/qa5_end.png' });
if (ended === 'WIN') {
  const winText = await page.evaluate(() => document.querySelector('.overlay:not(.hidden), #win-screen, .win')?.innerText?.slice(0, 400) ?? document.body.innerText.slice(0, 300));
  console.log('WIN TEXT:', winText.replace(/\n/g, ' | '));
}
console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
