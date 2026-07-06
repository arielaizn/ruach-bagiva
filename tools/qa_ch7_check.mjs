import { chromium } from 'playwright-core';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1','ch2','ch3','ch4','ch5','ch6'], settings: { master: 0, music: 0, sfx: 0, edgePan: true } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('text=הקמפיין'); await page.waitForTimeout(400);
// dump card titles
const cards = await page.evaluate(() => [...document.querySelectorAll('.ch-card')].map(c => c.textContent.trim().slice(0, 40)));
console.log('CARDS:', JSON.stringify(cards, null, 0));
await page.locator('.ch-card').nth(6).click(); await page.waitForTimeout(400);
await page.click('text=התחל'); await page.waitForTimeout(800);
const dump = await page.evaluate(() => {
  const G = window.__G;
  return {
    level: G.level?.id,
    buildings: G.buildings.map(b => `${b.typeId}@${Math.round(b.pos?.x ?? b.cx)},${Math.round(b.pos?.z ?? b.cz)}:${b.state}`),
    pop: G.pop, units: G.units.length,
  };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();
