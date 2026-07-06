// QA run 2 for ch1: smarter job policy (donkey on water, wood rotation),
// probes the water-carrier internals to diagnose the stall seen in run 1,
// and polls finely around the day-3 jackal wave.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const HARD_STOP_MS = 13 * 60 * 1000;
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
    bell: !!G.flags.bell, kumzitzim: G.runner?.kumzitzim,
  };
});

const probeWater = () => page.evaluate(() => {
  const G = window.__G;
  const u = G.units.find(x => x.kind === 'settler' && x.job === 'water') || G.units.find(x => x.kind === 'donkey' && x.job === 'water');
  if (!u) return null;
  const spring = G.terrain.spring;
  return {
    who: u.name, kind: u.kind, pos: { x: +u.pos.x.toFixed(2), z: +u.pos.z.toFixed(2) },
    arrived: u.arrived, hasPath: !!u.path, pathI: u.pathI, carrying: u.carrying,
    goal: u.goal ? { x: +u.goal.x?.toFixed?.(2), z: +u.goal.z?.toFixed?.(2) } : null,
    spring: { x: +spring.x.toFixed(1), z: +spring.z.toFixed(1) },
    dToSpring: +Math.hypot(u.pos.x - spring.x, u.pos.z - spring.z).toFixed(1),
    springWalkable: G.terrain.isWalkable ? [G.terrain.isWalkable(spring.x + 2.5, spring.z + 2.5)] : 'n/a',
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
  // put donkey on water hauling from the start (ch3 tutorial hints this is intended)
  const donkey = G.units.find(u => u.kind === 'donkey');
  if (donkey) donkey.job = 'water';
  return results.join(',');
});
console.log('PLACED:', placed);
await page.evaluate(() => window.__G.actions.setSpeed(3));

let lastDump = 0, lastProbe = 0;
let done = false, outcome = 'timeout';
let shotWave = false;

while (!done && Date.now() - t0 < HARD_STOP_MS) {
  await page.waitForTimeout(4000);
  const winC = await page.locator('text=ניצחון!').count();
  const loseC = await page.locator('text=הגבעה נפלה').count();
  if (winC > 0) { outcome = 'win'; break; }
  if (loseC > 0) { outcome = 'lose'; break; }

  const info = await page.evaluate(() => {
    const G = window.__G;
    const settlers = G.units.filter(u => u.kind === 'settler' && !u.fallen);
    const underConstruction = G.buildings.some(b => b.state !== 'done');
    const vegDone = G.buildings.some(b => b.typeId === 'veg_patch' && b.state === 'done');
    const hostiles = G.hostiles.length;
    if (hostiles > 0 && !G.flags.bell) G.actions.toggleBell();
    if (hostiles === 0 && G.flags.bell) G.actions.toggleBell();

    // donkey handles water; settlers: wood until 30, then farm/water top-ups
    const want = [];
    if (underConstruction) want.push('build');
    if (G.res.wood < 30) want.push('wood');
    if (G.res.water < 34) want.push('water');
    if (vegDone && G.res.food < 50) want.push('farm');
    while (want.length < settlers.length) want.push('wood');
    settlers.forEach((u, i) => {
      const w = want[i] ?? 'wood';
      if (u.job !== w && !G.flags.bell) u.setJob(w);
    });
    const donkey = G.units.find(u => u.kind === 'donkey');
    if (donkey && donkey.job !== 'water') donkey.job = 'water';

    let kum = false;
    if (G.actions.canKumzitz && G.actions.canKumzitz()) kum = G.actions.kumzitz();
    if (G.time.speed !== 3) G.actions.setSpeed(3);
    return { kum };
  });
  if (info.kum) console.log('[action] kumzitz started');

  const s = await state();
  if (Date.now() - lastDump > 20000) {
    lastDump = Date.now();
    console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ` + JSON.stringify(s));
  }
  if (Date.now() - lastProbe > 30000) {
    lastProbe = Date.now();
    const p = await probeWater();
    if (p) console.log('[waterprobe] ' + JSON.stringify(p));
  }
  if (s.hostiles) {
    console.log(`[wave] day ${s.day} h${s.hour} hostiles: ${s.hostiles} bell=${s.bell}`);
    if (!shotWave) { shotWave = true; await page.screenshot({ path: SHOTDIR + '/qa1b_wave.png' }); }
  }
}

console.log('=== FINAL ===');
console.log('OUTCOME:', outcome, '| realMinutes:', ((Date.now() - t0) / 60000).toFixed(1));
try { console.log(JSON.stringify(await state())); } catch (e) { console.log('state failed:', e.message); }
await page.screenshot({ path: SHOTDIR + '/qa1b_end.png' });
console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
