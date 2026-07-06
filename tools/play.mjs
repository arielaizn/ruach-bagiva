// Scripted playtest: boots chapter 1, exercises core loops, reports state.
// node tools/play.mjs [chapterIndex] [fastSeconds]
import { chromium } from 'playwright-core';

const CH = +(process.argv[2] ?? 0);
const FAST = +(process.argv[3] ?? 25);
const SHOTDIR = process.env.SHOTDIR || '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';

const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log' || /error|warn|fail|\[/i.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    running: G.running, day: G.time.day, hour: +G.time.hour.toFixed(1),
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])),
    spirit: Math.round(G.spirit),
    units: G.units.map(u => `${u.kind}:${u.job ?? ''}${u.fallen ? ':INJ' : ''}`),
    flock: G.flock.length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`),
    objectives: (G.objectives ?? []).map(o => `${o.id}:${o.done ? 'DONE' : Math.round((o.progress ?? 0) * 100) + '%'}`),
    fps: Math.round(G.renderer.info.render.frame > 0 ? 0 : 0),
    calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles,
  };
});

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(2500);

// into campaign -> chapter -> start
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(CH).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2500);
console.log('=== AFTER START ===');
console.log(JSON.stringify(await state(), null, 1));
await page.screenshot({ path: SHOTDIR + '/play_start.png' });

// place a tent programmatically near base
const placed = await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  G.actions.startPlacement('tent');
  for (let r = 3; r < 20; r += 1) {
    for (let a = 0; a < 12; a++) {
      const x = base.x + Math.cos(a / 12 * Math.PI * 2) * r;
      const z = base.z + Math.sin(a / 12 * Math.PI * 2) * r;
      G.actions.movePlacement(x, z);
      if (G.placement?.valid) { G.actions.confirmPlacement(false); return { ok: true, x, z }; }
    }
  }
  G.actions.cancelPlacement();
  return { ok: false };
});
console.log('TENT PLACED:', JSON.stringify(placed));

// send one settler to chop wood, one to water
await page.evaluate(() => {
  const G = window.__G;
  const settlers = G.units.filter(u => u.kind === 'settler');
  if (settlers[0]) { settlers[0].setJob('wood'); }
  if (settlers[1]) { settlers[1].setJob('water'); }
  const donkey = G.units.find(u => u.kind === 'donkey');
  if (donkey) donkey.job = 'water';
});

// fast-forward
await page.evaluate(() => window.__G.actions.setSpeed(3));
await page.waitForTimeout(FAST * 1000);
await page.evaluate(() => window.__G.actions.setSpeed(1));
console.log('=== AFTER FAST-FORWARD ===');
console.log(JSON.stringify(await state(), null, 1));
await page.screenshot({ path: SHOTDIR + '/play_after.png' });

// zoom close for model inspection
await page.evaluate(() => {
  const G = window.__G;
  const u = G.units.find(u => u.kind === 'settler') ?? G.units[0];
  if (u) { G.rig.flyTo(u.pos.x, u.pos.z); G.rig.dist = 14; }
});
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOTDIR + '/play_close.png' });

console.log('=== CONSOLE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
