// QA playtest: chapter 4 (ch4) — demolition order drama, spirit >= 30 at end, survive 2 waves.
// Plays like a reasonable player: jobs, bell on raids, kumzitz evenings, MUSTER path for demolition.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

const state = () => page.evaluate(() => {
  const G = window.__G;
  const d = G.director?.demolition;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    spirit: Math.round(G.spirit * 10) / 10,
    units: G.units.map(u => `${u.name ?? u.kind}:${u.kind}:${u.job ?? u.state ?? ''}${u.fallen ? ':INJ' : ''}${u.alive === false ? ':DEAD' : ''}`).join(','),
    pos: G.units.filter(u => u.kind === 'settler').map(u => `${Math.round(u.pos.x * 10)},${Math.round(u.pos.z * 10)}`).join('|'),
    flock: G.flock.filter(s => s.alive).length,
    hostiles: G.hostiles.filter(h => h.alive).map(h => `${h.type}:${h.state}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}:${o.done ? 'DONE' : (Math.round((o.progress ?? 0) * 100) / 100)}`).join(' | '),
    waves: G.runner?.wavesSurvived, pending: G.director?.pendingWaves.length,
    warned: G.director?.pendingWaves.some(w => w.warned) ?? false,
    bell: !!G.flags.bell,
    demo: d ? `${d.state}:${d.outcome ?? ''}:daysLeft=${d.daysLeft}` : null,
    demoOutcomeFlag: G.flags.demolitionOutcome ?? null,
    running: G.running,
  };
});

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1', 'ch2', 'ch3'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(3).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

console.log('=== CH4 START ===');
console.log(JSON.stringify(await state()));

// player setup: assign idle settlers to economy jobs, donkey to water
const setup = await page.evaluate(() => {
  const G = window.__G;
  const free = G.units.filter(u => u.kind === 'settler' && !u.job);
  const jobs = ['wood', 'water', 'farm', 'wood'];
  const out = [];
  free.forEach((u, i) => { u.setJob(jobs[i % jobs.length]); out.push(`${u.name}->${jobs[i % jobs.length]}`); });
  const donkey = G.units.find(u => u.kind === 'donkey');
  if (donkey) { donkey.job = 'water'; out.push('donkey->water'); }
  G.actions.setSpeed(3);
  return out.join(',');
});
console.log('SETUP:', setup);

const t0 = Date.now();
const HARD_STOP_MS = 14 * 60 * 1000;
let mustered = false, musterFails = 0, usedApiMuster = false;
let lastKumzitzDay = 0;
const stuckMap = new Map(); // name -> {pos, ticks}
const issues = [];
let tick = 0, endText = null, lastDump = '';

while (Date.now() - t0 < HARD_STOP_MS) {
  await page.waitForTimeout(4000);
  tick++;

  // end detection
  const win = await page.locator('text=ניצחון!').count();
  const lose = await page.locator('text=הגבעה נפלה').count();
  if (win) { endText = 'WIN'; break; }
  if (lose) { endText = 'LOSE'; break; }

  const s = await state();

  // player decisions
  const acted = await page.evaluate(({ mustered }) => {
    const G = window.__G;
    const out = [];
    G.actions.setSpeed(3);

    // bell management
    const danger = G.hostiles.some(h => h.alive) || G.director.pendingWaves.some(w => w.warned);
    if (danger && !G.flags.bell) { G.actions.toggleBell(); out.push('BELL_ON'); }
    if (!danger && G.flags.bell) { G.actions.toggleBell(); out.push('BELL_OFF'); }

    // demolition muster via banner button
    const d = G.director.demolition;
    let musterResult = null;
    if (!mustered && d && d.state === 'active') {
      const btns = [...document.querySelectorAll('#demolition-banner button')];
      const mus = btns.find(b => b.textContent.includes('תומכים'));
      if (mus && !mus.disabled) { mus.click(); musterResult = 'clicked:' + d.state; }
      else musterResult = `nobtn(banner=${!!document.querySelector('#demolition-banner')},btns=${btns.map(b => b.textContent + (b.disabled ? ':dis' : '')).join('/')},spirit=${Math.round(G.spirit)})`;
    }

    // kumzitz in the evening (not on bell, not shabbat)
    let kum = null;
    const evening = G.time.hour >= 17.8 && G.time.hour < 23.5;
    if (evening && !G.time.isShabbat && !G.flags.bell && !G.flags.kumzitzTonight && G.res.wood >= 15 && G.spirit < 80) {
      kum = G.actions.kumzitz() ? 'KUMZITZ_OK' : 'KUMZITZ_FAIL';
    }
    return { out: out.join(','), musterResult, kum, demoState: d?.state ?? null };
  }, { mustered });

  if (acted.musterResult) {
    if (acted.musterResult.startsWith('clicked')) { mustered = true; console.log(`[t${tick}] MUSTER ${acted.musterResult}`); await page.screenshot({ path: SHOTDIR + '/ch4_muster_click.png' }); }
    else {
      musterFails++;
      console.log(`[t${tick}] MUSTER attempt failed: ${acted.musterResult}`);
      if (musterFails >= 4 && !usedApiMuster) {
        usedApiMuster = true;
        const ok = await page.evaluate(() => window.__G.director.musterSupporters());
        console.log(`[t${tick}] API muster fallback ->`, ok);
        if (ok) mustered = true;
        issues.push(`Muster banner button not clickable after ${musterFails} attempts; API fallback ok=${ok}`);
      }
    }
  }
  if (acted.kum === 'KUMZITZ_OK') { lastKumzitzDay = s.day; console.log(`[t${tick}] kumzitz on day ${s.day}`); }
  if (acted.out) console.log(`[t${tick}] actions: ${acted.out}`);

  // sanity: NaN / negative resources
  for (const [k, v] of Object.entries(s.res)) {
    if (!Number.isFinite(v)) issues.push(`Resource ${k} is NaN at day${s.day} h${s.hour}`);
    if (v < -0.5) issues.push(`Resource ${k} negative (${v}) at day${s.day} h${s.hour}`);
  }
  if (!Number.isFinite(s.spirit)) issues.push(`Spirit NaN at day${s.day}`);

  // stuck detection during work hours
  if (s.hour >= 8 && s.hour <= 16 && !s.bell && !s.shabbat) {
    const names = s.units.split(',').filter(u => u.includes(':settler:'));
    const poss = s.pos.split('|');
    poss.forEach((p, i) => {
      const key = 'u' + i;
      const prev = stuckMap.get(key);
      if (prev && prev.pos === p) { prev.ticks++; if (prev.ticks === 16) issues.push(`Unit ${names[i] ?? key} at same pos ${p} for ~64s real (day${s.day} h${s.hour})`); }
      else stuckMap.set(key, { pos: p, ticks: 1 });
    });
  }

  const dump = JSON.stringify(s);
  if (tick % 6 === 0 || dump !== lastDump && tick % 2 === 0) { console.log(`[t${tick} ${Math.round((Date.now() - t0) / 1000)}s]`, dump); lastDump = dump; }

  if (s.demo && s.demo.startsWith('mustering') && tick % 3 === 0) await page.screenshot({ path: SHOTDIR + '/ch4_mustering.png' });
  if (s.demo && s.demo.startsWith('resolved') && !state._shotDemo) { state._shotDemo = true; await page.screenshot({ path: SHOTDIR + '/ch4_demo_resolved.png' }); }
  if (s.hostiles && tick % 2 === 0) console.log(`[t${tick}] hostiles: ${s.hostiles} waves=${s.waves}`);
}

const realMin = Math.round((Date.now() - t0) / 6000) / 10;
console.log('=== END ===', endText ?? 'TIMEOUT', 'realMin=', realMin);
console.log('FINAL STATE:', JSON.stringify(await state().catch?.(() => null) ?? await state()));
await page.screenshot({ path: SHOTDIR + '/ch4_end.png' });
if (endText === 'WIN') {
  const winBody = await page.evaluate(() => document.querySelector('.overlay.show, #win-screen, .end-screen')?.innerText?.slice(0, 400) ?? document.body.innerText.slice(0, 300));
  console.log('WIN SCREEN TEXT:', winBody.replace(/\n/g, ' | '));
}
console.log('=== ISSUES (' + issues.length + ') ===');
for (const i of issues) console.log('ISSUE:', i);
console.log('=== CONSOLE/PAGE ERRORS (' + logs.length + ') ===');
for (const l of [...new Set(logs)].slice(0, 30)) console.log(l);
await browser.close();
