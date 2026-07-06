// QA run 3 for ch1: sticky jobs (farmer never reassigned, avoids the
// worker-slot leak), donkey on water, others on wood. Goal: prove ch1 winnable.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const HARD_STOP_MS = 11 * 60 * 1000;
const t0 = Date.now();

const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1),
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, +v.toFixed(1)])),
    spirit: Math.round(G.spirit),
    units: G.units.map(u => `${u.name ?? u.kind}(${u.kind}):${u.job ?? u.state ?? ''}@${u.pos.x.toFixed(1)},${u.pos.z.toFixed(1)}`),
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}${o.done ? ':DONE' : ''}`).join(','),
    kumzitzim: G.runner?.kumzitzim,
  };
});

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: [], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(0).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

const placed = await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  const results = [];
  for (const type of ['tent', 'campfire', 'veg_patch']) {
    G.actions.startPlacement(type);
    let ok = false;
    outer:
    for (let r = 4; r < 26; r += 2) {
      for (let a = 0; a < 16; a++) {
        const x = base.x + Math.cos(a / 16 * Math.PI * 2) * r;
        const z = base.z + Math.sin(a / 16 * Math.PI * 2) * r;
        G.actions.movePlacement(x, z);
        if (G.placement?.valid) { G.actions.confirmPlacement(false); ok = true; break outer; }
      }
    }
    if (!ok) G.actions.cancelPlacement();
    results.push(`${type}:${ok}`);
  }
  const donkey = G.units.find(u => u.kind === 'donkey');
  if (donkey) donkey.job = 'water';
  return results.join(',');
});
console.log('PLACED:', placed);
await page.evaluate(() => window.__G.actions.setSpeed(3));

let lastDump = 0;
let outcome = 'timeout';
let farmerAssigned = false;

while (Date.now() - t0 < HARD_STOP_MS) {
  await page.waitForTimeout(4000);
  const winC = await page.locator('text=ניצחון!').count();
  const loseC = await page.locator('text=הגבעה נפלה').count();
  if (winC > 0) { outcome = 'win'; break; }
  if (loseC > 0) { outcome = 'lose'; break; }

  const r = await page.evaluate((farmerAssigned) => {
    const G = window.__G;
    const settlers = G.units.filter(u => u.kind === 'settler' && !u.fallen);
    const vegDone = G.buildings.some(b => b.typeId === 'veg_patch' && b.state === 'done');
    const hostiles = G.hostiles.length;
    if (hostiles > 0 && !G.flags.bell) G.actions.toggleBell();
    if (hostiles === 0 && G.flags.bell) G.actions.toggleBell();

    // sticky assignment: exactly one farmer, forever; everyone else wood
    let out = { farmerSet: farmerAssigned };
    if (vegDone && !farmerAssigned) {
      const f = settlers[0];
      if (f && f.job !== 'farm') f.setJob('farm');
      out.farmerSet = true;
    }
    settlers.forEach((u, i) => {
      if (out.farmerSet && i === 0) return; // farmer, never touch again
      if ((u.job === 'idle' || u.job == null || u.job === 'build') && !G.flags.bell) {
        const done = !G.buildings.some(b => b.state !== 'done');
        if (done) u.setJob('wood');
      }
    });
    const donkey = G.units.find(u => u.kind === 'donkey');
    if (donkey && donkey.job !== 'water') donkey.job = 'water';
    if (G.actions.canKumzitz && G.actions.canKumzitz()) { G.actions.kumzitz(); out.kum = true; }
    if (G.time.speed !== 3) G.actions.setSpeed(3);
    return out;
  }, farmerAssigned);
  if (r.farmerSet) farmerAssigned = true;
  if (r.kum) console.log('[action] kumzitz');

  const s = await state();
  if (Date.now() - lastDump > 20000) {
    lastDump = Date.now();
    console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ` + JSON.stringify(s));
  }
  if (s.hostiles) console.log(`[wave] day ${s.day} h${s.hour} hostiles: ${s.hostiles}`);
}

console.log('=== FINAL ===');
console.log('OUTCOME:', outcome, '| realMinutes:', ((Date.now() - t0) / 60000).toFixed(1));
try { console.log(JSON.stringify(await state())); } catch (e) { console.log('state failed:', e.message); }
await page.screenshot({ path: SHOTDIR + '/qa1c_end.png' });
console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
