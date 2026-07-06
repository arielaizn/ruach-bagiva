import { chromium } from 'playwright-core';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message, (e.stack||'').split('\n').slice(0,3).join(' | ')));
page.on('console', (m) => { if (m.type() !== 'log') console.log('['+m.type()+']', m.text().slice(0,300)); });
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
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
await page.waitForTimeout(1500);
const probe1 = await page.evaluate(() => {
  const G = window.__G;
  window.__tickCount = 0;
  const origHour = G.time.hour;
  return { running: G.running, paused: G.time.paused, speed: G.time.speed, hour: origHour, modal: G.ui.modalOpen, level: G.level?.id };
});
console.log('PROBE1', JSON.stringify(probe1));
await page.waitForTimeout(3000);
const probe2 = await page.evaluate(() => {
  const G = window.__G;
  return { hour: G.time.hour, t: G.time.t, running: G.running, paused: G.time.paused, speed: G.time.speed };
});
console.log('PROBE2', JSON.stringify(probe2));
await browser.close();
