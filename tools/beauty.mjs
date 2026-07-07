import { chromium } from 'playwright-core';
const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: [], settings: { master: 0, music: 0, sfx: 0, edgePan: true } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין'); await page.waitForTimeout(300);
await page.locator('.ch-card').nth(5).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(2500);
// golden hour close shot of camp
await page.evaluate(() => {
  const G = window.__G;
  G.time.hour = 17.6;
  const base = G.basePos ?? { x: 0, z: 0 };
  G.rig.jumpTo(base.x, base.z);
  G.rig.dist = 34; G.rig._dist = 34;
  G.rig.yaw = 2.2; G.rig._yaw = 2.2;
  G.actions.setSpeed(1);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOTDIR + '/beauty_golden.png' });
// night raid mood
await page.evaluate(() => {
  const G = window.__G;
  G.time.hour = 21.5;
  G.director.scheduleWave({ budget: 14, palette: ['raider', 'wolf'], dirs: ['S'], telegraphS: 2 });
  G.actions.setSpeed(3);
});
await page.waitForTimeout(9000);
await page.evaluate(() => {
  const G = window.__G;
  G.actions.setSpeed(1);
  G.actions.toggleBell();
  const h = G.hostiles[0];
  if (h) { G.rig.flyTo(h.pos.x, h.pos.z); G.rig.dist = 24; }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOTDIR + '/beauty_night.png' });
await browser.close();
console.log('beauty done');
