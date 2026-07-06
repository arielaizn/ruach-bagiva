// QA playthrough: campaign ch3 ("water chapter") end-to-end as a reasonable player.
// Objectives: build water_tower, water>=120, survive 3 waves, flock>=6 at end.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const T0 = Date.now();
const mins = () => ((Date.now() - T0) / 60000).toFixed(1);
const HARD_STOP_MS = 14 * 60 * 1000;

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
    spirit: Math.round(G.spirit),
    units: G.units.map(u => `${u.name ?? u.kind}:${u.job ?? u.state ?? ''}${u.fallen ? ':INJ' : ''}@${Math.round(u.pos.x)},${Math.round(u.pos.z)}`).join(' | '),
    flock: G.flock.filter(s => s.alive).length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`).join(','),
    pending: G.director.pendingWaves.length,
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}${b.state === 'building' ? ':' + Math.round(b.progress) : ''}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}:${o.done ? 'DONE' : (o.progress * 100 | 0) + '%'}`).join(','),
    waves: G.runner?.wavesSurvived, bell: !!G.flags.bell,
  };
});

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1', 'ch2'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(2).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);
console.log(`[${mins()}m] === CH3 START ===`);
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/qa3_start.png' });

// ---- initial player setup: jobs + water tower placement
const setup = await page.evaluate(() => {
  const G = window.__G;
  const out = [];
  // jobs: keep shepherd (נריה) + guard (עמיחי); others: build / water / farm
  const free = G.units.filter(u => u.kind === 'settler' && u.job !== 'shepherd' && u.job !== 'guard');
  const jobs = ['build', 'water', 'farm'];
  free.forEach((u, i) => { u.setJob(jobs[i % jobs.length]); out.push(`${u.name}->${jobs[i % jobs.length]}`); });
  // place water tower near base
  const base = G.basePos ?? { x: 0, z: 0 };
  G.actions.startPlacement('water_tower');
  let ok = false;
  outer:
  for (let r = 5; r < 26; r += 1.5) {
    for (let a = 0; a < 20; a++) {
      const x = base.x + Math.cos(a / 20 * Math.PI * 2) * r;
      const z = base.z + Math.sin(a / 20 * Math.PI * 2) * r;
      G.actions.movePlacement(x, z);
      if (G.placement?.valid) { G.actions.confirmPlacement(false); ok = true; break outer; }
    }
  }
  if (!ok) G.actions.cancelPlacement?.();
  out.push('tower_placed=' + ok);
  G.actions.setSpeed(3);
  return out.join(' ');
});
console.log('SETUP:', setup);

// ---- main play loop
let done = false, result = 'timeout', towerDone = false, kumzDays = new Set();
let lastPositions = null, stuckReports = 0;
const seen = { nanRes: false, negRes: false };

while (!done && Date.now() - T0 < HARD_STOP_MS) {
  await page.waitForTimeout(5000);

  // win/lose check
  const winN = await page.locator('text=ניצחון!').count();
  const loseN = await page.locator('text=הגבעה נפלה').count();
  if (winN) { result = 'win'; done = true; break; }
  if (loseN) { result = 'lose'; done = true; break; }

  // player brain tick
  const tick = await page.evaluate(() => {
    const G = window.__G;
    const acts = [];
    const hostilesLive = G.hostiles.some(h => h.alive);
    const warned = G.director.pendingWaves.some(w => w.warned);
    // bell: ring when warned or under attack; release when quiet
    if ((hostilesLive || warned) && !G.flags.bell) { G.actions.toggleBell(); acts.push('BELL_ON'); }
    if (!hostilesLive && !warned && G.flags.bell) { G.actions.toggleBell(); acts.push('BELL_OFF'); }
    // tower finished -> donkey hauls water too
    const tower = G.buildings.find(b => b.typeId === 'water_tower');
    if (tower?.state === 'done' && !G.flags.__qaTowerHandled) {
      G.flags.__qaTowerHandled = true;
      const dk = G.units.find(u => u.kind === 'donkey');
      if (dk) { dk.job = 'water'; acts.push('donkey->water'); }
    }
    // any jobless settler (e.g. finished building) -> water
    if (!G.flags.bell) {
      for (const u of G.units) {
        if (u.kind === 'settler' && !u.fallen && (!u.job || u.job === 'idle')) {
          u.setJob('water'); acts.push(`${u.name}: idle->water`);
        }
      }
    }
    // kumzitz in the evening (not during bell/attack)
    if (!G.flags.bell && G.time.hour >= 18.1 && G.time.hour < 21 && !G.time.isShabbat) {
      if (G.actions.kumzitz()) acts.push('KUMZITZ day' + G.time.day);
    }
    // keep food from starving: if food < 10 move a water carrier to farm temporarily
    if (G.res.food < 8) {
      const w = G.units.find(u => u.kind === 'settler' && u.job === 'water');
      if (w) { w.setJob('farm'); acts.push(`${w.name}: water->farm (food low)`); }
    } else if (G.res.food > 40) {
      const farmers = G.units.filter(u => u.kind === 'settler' && u.job === 'farm');
      if (farmers.length > 1) { farmers[1].setJob('water'); acts.push(`${farmers[1].name}: farm->water (food ok)`); }
    }
    // wood for kumzitz: if wood < 12 and water objective done, swap someone to wood
    const waterObj = (G.objectives ?? []).find(o => o.id === 'water');
    if (G.res.wood < 12 && waterObj?.done) {
      const w = G.units.find(u => u.kind === 'settler' && u.job === 'water');
      if (w) { w.setJob('wood'); acts.push(`${w.name}: water->wood`); }
    }
    if (G.time.speed !== 3 && G.running) G.actions.setSpeed(3);
    return {
      acts,
      pos: G.units.filter(u => u.kind === 'settler').map(u => `${Math.round(u.pos.x)},${Math.round(u.pos.z)}:${u.job ?? u.state}`),
      resBad: Object.entries(G.res).filter(([k, v]) => !isFinite(v) || v < -0.01).map(([k, v]) => `${k}=${v}`),
    };
  });

  if (tick.resBad.length) { seen.nanRes = true; console.log(`[${mins()}m] !!! BAD RES:`, tick.resBad.join(',')); }
  if (tick.acts.length) console.log(`[${mins()}m] ACTS:`, tick.acts.join('; '));

  // stuck detection (same pos across ~60s real => 3 game-min at x3... report once)
  const posKey = tick.pos.join('|');
  if (lastPositions && posKey === lastPositions.key && Date.now() - lastPositions.t > 60000 && stuckReports < 3) {
    stuckReports++;
    console.log(`[${mins()}m] !!! UNITS UNCHANGED 60s+:`, posKey);
    await page.screenshot({ path: SHOTDIR + `/qa3_stuck${stuckReports}.png` });
  }
  if (!lastPositions || posKey !== lastPositions.key) lastPositions = { key: posKey, t: Date.now() };

  const st = await state();
  console.log(`[${mins()}m]`, JSON.stringify(st));
  if (st.hostiles && !seen['shotWave' + st.waves]) {
    seen['shotWave' + st.waves] = true;
    await page.screenshot({ path: SHOTDIR + `/qa3_wave_after${st.waves}.png` });
  }
  if (!towerDone && st.buildings.includes('water_tower:done')) { towerDone = true; console.log(`[${mins()}m] TOWER DONE`); }
}

console.log(`[${mins()}m] === RESULT: ${result} ===`);
try { console.log(JSON.stringify(await state())); } catch (e) { console.log('final state failed:', e.message); }
await page.screenshot({ path: SHOTDIR + '/qa3_end.png' });
// end-screen text if any
const endText = await page.evaluate(() => {
  const el = document.querySelector('.end-screen, #end-screen, .overlay.show');
  return el ? el.innerText.slice(0, 400) : '';
});
if (endText) console.log('END SCREEN:', endText.replace(/\n/g, ' / '));

console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
