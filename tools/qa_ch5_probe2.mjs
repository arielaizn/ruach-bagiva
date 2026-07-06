// Probe 2: reproduce שיבי freeze — build vineyard near base, then switch to wood; watch internals.
import { chromium } from 'playwright-core';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: [], settings: { master: 0, music: 0, sfx: 0, edgePan: true } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('text=הקמפיין'); await page.waitForTimeout(300);
await page.locator('.ch-card').nth(4).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1500);

await page.evaluate(() => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  G.actions.startPlacement('vineyard');
  outer: for (let r = 0; r < 20; r += 1.5) for (let a = 0; a < 16; a++) {
    const x = base.x + Math.cos(a / 16 * Math.PI * 2) * r, z = base.z + Math.sin(a / 16 * Math.PI * 2) * r;
    G.actions.movePlacement(x, z);
    if (G.placement?.valid) { G.actions.confirmPlacement(false); break outer; }
  }
  const s = G.units.find(u => u.kind === 'settler');
  s.setJob('build');
  G.actions.setSpeed(3);
  window.__probe = s;
});
const snap = () => page.evaluate(() => {
  const G = window.__G, s = window.__probe;
  const wt = s.workTarget;
  return {
    t: Math.round(G.time.t), day: G.time.day, hour: +G.time.hour.toFixed(1),
    job: s.job, state: s.state, arrived: s.arrived,
    pos: [+s.pos.x.toFixed(1), +s.pos.z.toFixed(1)],
    goal: s.goal ? [+s.goal.x.toFixed(1), +s.goal.z.toFixed(1)] : null,
    pathLen: s.path?.length ?? null,
    wt: wt ? { x: +(wt.x ?? wt.pos?.x)?.toFixed?.(1), z: +(wt.z ?? wt.pos?.z)?.toFixed?.(1), wood: wt.wood && +wt.wood.toFixed(1), typeId: wt.typeId, alive: wt.alive } : null,
    cellWalkable: (() => { const c = G.terrain.worldToCell(s.pos.x, s.pos.z); return G.terrain.walkable(c.cx, c.cz); })(),
    vineyard: G.buildings.find(b => b.typeId === 'vineyard')?.state,
    wood: Math.round(G.res.wood),
  };
});
for (let i = 0; i < 24; i++) {
  console.log(JSON.stringify(await snap()));
  const done = await page.evaluate(() => window.__probe.job !== 'build' || window.__G.buildings.find(b => b.typeId === 'vineyard')?.state === 'done');
  if (done && i > 2) break;
  await page.waitForTimeout(2500);
}
console.log('--- switch to wood ---');
await page.evaluate(() => window.__probe.setJob('wood'));
for (let i = 0; i < 30; i++) {
  console.log(JSON.stringify(await snap()));
  await page.waitForTimeout(2500);
}
await browser.close();
