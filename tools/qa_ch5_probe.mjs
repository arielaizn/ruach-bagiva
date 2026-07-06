// Probe: does a builder standing inside a building footprint get trapped when it completes?
import { chromium } from 'playwright-core';
const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
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

const r = await page.evaluate(async () => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  // place a vineyard
  G.actions.startPlacement('vineyard');
  let spot = null;
  outer: for (let r = 5; r < 20; r += 1.5) for (let a = 0; a < 16; a++) {
    const x = base.x + Math.cos(a / 16 * Math.PI * 2) * r, z = base.z + Math.sin(a / 16 * Math.PI * 2) * r;
    G.actions.movePlacement(x, z);
    if (G.placement?.valid) { spot = { x, z }; G.actions.confirmPlacement(false); break outer; }
  }
  if (!spot) return { err: 'no spot' };
  const site = G.buildings.find(b => b.state === 'site');
  // teleport a settler into the middle of the footprint and make him build
  const s = G.units.find(u => u.kind === 'settler');
  s.pos.x = site.pos.x; s.pos.z = site.pos.z;
  s.setJob('build'); s.workTarget = site;
  // instantly finish the building
  site.addWork(9999);
  await new Promise(res => setTimeout(res, 300));
  const done = site.state;
  // walkability of his cell
  const c = G.terrain.worldToCell ? G.terrain.worldToCell(s.pos.x, s.pos.z) : null;
  const walkable = c ? G.terrain.walkable(c.cx ?? c.x, c.cz ?? c.z) : 'n/a';
  // order him far away and watch
  s.setJob('idle'); s.state = 'ordered-move';
  s.walkTo(base.x + 15, base.z + 15);
  const p0 = { x: s.pos.x, z: s.pos.z };
  G.actions.setSpeed(3);
  await new Promise(res => setTimeout(res, 6000));
  const p1 = { x: s.pos.x, z: s.pos.z };
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  return { done, walkable, p0, p1, moved: +moved.toFixed(2), name: s.name, sitePos: { x: site.pos.x, z: site.pos.z } };
});
console.log('PROBE:', JSON.stringify(r));
await page.screenshot({ path: SHOTDIR + '/qa5_probe.png' });
await browser.close();
