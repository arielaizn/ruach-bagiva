// Focused check: does the ch1 day-3 jackal wave spawn and resolve? Does raid-end fire?
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
await page.locator('.ch-card').nth(0).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1500);
// jump to just before the wave; keep food around so jackals have a target
await page.evaluate(() => {
  const G = window.__G;
  G.time.day = 3; G.time.hour = 16.3;
  G.res.food = 40;
  window.__QA = { raids: [], warn: 0 };
  G.events.on('raid-warning', () => window.__QA.warn++);
  G.events.on('raid-start', (w) => window.__QA.raids.push('start:' + w.units.map(u => u.type).join('+')));
  G.events.on('raid-end', () => window.__QA.raids.push('end@d' + G.time.day + 'h' + G.time.hour.toFixed(1)));
  G.actions.setSpeed(3);
});
let sawHostile = false;
for (let i = 0; i < 70; i++) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => {
    const G = window.__G;
    return {
      d: G.time.day, h: +G.time.hour.toFixed(1),
      pw: G.director.pendingWaves.length,
      hostiles: G.hostiles.filter(h => h.alive).map(h => `${h.type}:${h.state}:hp${Math.round(h.hp)}`).join(','),
      food: Math.round(G.res.food), spirit: Math.round(G.spirit),
      waves: G.runner.wavesSurvived, qa: window.__QA,
      units: G.units.filter(u => u.kind === 'settler').map(u => `${u.name}:${u.state}`).join(','),
    };
  });
  if (s.hostiles && !sawHostile) { sawHostile = true; await page.screenshot({ path: SHOTDIR + '/qa1_jackals.png' }); }
  console.log(i, JSON.stringify(s));
  if (s.qa.raids.some(r => r.startsWith('end')) || s.d >= 5) break;
}
await browser.close();
