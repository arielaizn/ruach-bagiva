// Deep gameplay test on chapter 2: flock, building completion, wolf combat,
// bell, kumzitz, shabbat, win screen.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])),
    spirit: Math.round(G.spirit),
    units: G.units.map(u => `${u.kind}:${u.job ?? u.state ?? ''}${u.fallen ? ':INJ' : ''}`).join(','),
    flock: G.flock.length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}:c${Math.round(h.courage)}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}${o.done ? ':DONE' : ''}`).join(','),
    waves: G.runner?.wavesSurvived, bell: !!G.flags.bell,
    calls: G.renderer.info.render.calls,
  };
});
const ff = async (sec) => {
  await page.evaluate(() => window.__G.actions.setSpeed(3));
  await page.waitForTimeout(sec * 1000);
  await page.evaluate(() => window.__G.actions.setSpeed(1));
};

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);

// unlock ch2 via save then reload
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(300);
await page.locator('.ch-card').nth(1).click();
await page.waitForTimeout(300);
await page.click('text=התחל');
await page.waitForTimeout(2000);
console.log('=== CH2 START ===');
console.log(JSON.stringify(await state()));

// build pen + kennel programmatically
const placed = await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  const results = [];
  for (const type of ['sheep_pen', 'kennel']) {
    G.actions.startPlacement(type);
    let ok = false;
    outer:
    for (let r = 6; r < 26; r += 2) {
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
  return results.join(',');
});
console.log('PLACED:', placed);

// fast-forward ~90 game-sec: flock delivery (hour 9) + building
await ff(30);
console.log('=== AFTER BUILD PHASE ===');
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p2_built.png' });

// force wolf wave now
await page.evaluate(() => {
  const G = window.__G;
  G.director.scheduleWave({ budget: 6, palette: ['wolf'], dirs: ['E'], telegraphS: 4 });
});
await page.waitForTimeout(2500); // warning fires
await page.evaluate(() => window.__G.actions.toggleBell());
await ff(12);
console.log('=== DURING/AFTER WAVE 1 ===');
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p2_wave.png' });
await ff(25);
console.log('=== WAVE SETTLED ===');
console.log(JSON.stringify(await state()));

// kumzitz
await page.evaluate(() => {
  const G = window.__G;
  G.time.hour = 18.2;
  G.res.wood = Math.max(G.res.wood, 30);
  G.flags.bell = false;
  console.log('kumzitz ok=', G.actions.kumzitz());
});
await ff(8);
console.log('=== AFTER KUMZITZ ===');
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p2_kumzitz.png' });

// jump to shabbat
await page.evaluate(() => { const G = window.__G; G.time.day = 6; G.time.hour = 23.9; });
await ff(4);
console.log('=== SHABBAT ===');
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p2_shabbat.png' });

// force win
await page.evaluate(() => {
  const G = window.__G;
  G.hostiles.forEach(h => h.removeHostile());
  G.runner.objState.forEach(o => { o.done = true; });
});
await page.waitForTimeout(1500);
const winShown = await page.locator('text=ניצחון!').count();
console.log('WIN SCREEN SHOWN:', winShown);
await page.screenshot({ path: SHOTDIR + '/p2_win.png' });

console.log('=== ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
