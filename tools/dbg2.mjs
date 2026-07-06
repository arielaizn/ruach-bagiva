import { chromium } from 'playwright-core';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: [], settings: { master: 0, music: 0, sfx: 0, edgePan: true } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('text=הקמפיין'); await page.waitForTimeout(300);
await page.locator('.ch-card').nth(3).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1500);
await page.evaluate(() => window.__G.director.scheduleWave({ budget: 6, palette: ['thief'], dirs: ['S'], telegraphS: 2 }));
await page.evaluate(() => window.__G.actions.setSpeed(3));
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(5000);
  const d = await page.evaluate(() => window.__G.hostiles.map(h => ({
    t: h.type, st: h.state, bored: +h._boredT?.toFixed(1), pos: [Math.round(h.pos.x), Math.round(h.pos.z)],
    target: h.target ? (h.target.name ?? h.target.typeId ?? h.target.kind) : null,
    arrived: h.arrived, pathLen: h.path?.length ?? 0, courage: Math.round(h.courage), hp: h.hp,
  })));
  console.log(i, JSON.stringify(d));
}
await browser.close();
