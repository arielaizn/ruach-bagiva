// Focused check: donkey 'water' job stall on ch1 terrain (seed 10101).
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
await page.locator('.ch-card').nth(0).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const G = window.__G;
  const d = G.units.find(u => u.kind === 'donkey');
  d.job = 'water';
  G.res.water = 5;
  const sp = G.terrain.spring;
  const t = { x: sp.x + 3, z: sp.z - 2 };
  const c = G.terrain.worldToCell(t.x, t.z);
  G.actions.setSpeed(3);
  return { spring: { x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) }, donkeyTargetCellWalkable: G.terrain.walkable?.(c.cx, c.cz) ?? 'n/a', donkey: { x: +d.pos.x.toFixed(1), z: +d.pos.z.toFixed(1) } };
});
console.log('INFO', JSON.stringify(info));
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const G = window.__G;
    const d = G.units.find(u => u.kind === 'donkey');
    return { h: +G.time.hour.toFixed(1), pos: [+d.pos.x.toFixed(1), +d.pos.z.toFixed(1)], carrying: d.carrying, arrived: d.arrived, hasPath: !!d.path, water: +G.res.water.toFixed(1), goal: d.goal ? [+d.goal.x.toFixed(1), +d.goal.z.toFixed(1)] : null };
  });
  console.log(i, JSON.stringify(s));
}
await browser.close();
