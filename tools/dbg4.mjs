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
await page.locator('.ch-card').nth(3).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1500);
// trigger demolition NOW and wait for active
await page.evaluate(() => { window.__G.director.startDemolition('sheep_pen'); window.__G.actions.setSpeed(3); });
await page.waitForTimeout(9000);
const st1 = await page.evaluate(() => window.__G.director.demolition?.state);
console.log('STATE:', st1, '| banner:', await page.locator('#demolition-banner.show').count());
// click muster
const ok = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#demolition-banner button')];
  const mus = btns.find(b => b.textContent.includes('תומכים'));
  if (mus && !mus.disabled) { mus.click(); return 'clicked'; }
  return 'unavailable spirit=' + window.__G.spirit;
});
console.log('MUSTER:', ok);
await page.waitForTimeout(25000);
const st2 = await page.evaluate(() => {
  const G = window.__G;
  const d = G.director.demolition;
  return { state: d?.state, outcome: d?.outcome, supporters: G.units.filter(u => u.kind === 'supporter').length, spirit: Math.round(G.spirit), penAlive: !!G.buildings.find(b => b.typeId === 'sheep_pen') };
});
console.log('RESULT:', JSON.stringify(st2));
await page.evaluate(() => { const G = window.__G; const d = G.director.demolition; if (d?.building) G.rig.flyTo(d.building.pos.x, d.building.pos.z); G.rig.dist = 26; G.actions.setSpeed(1); });
await page.waitForTimeout(1200);
await page.screenshot({ path: SHOTDIR + '/p5_muster.png' });
await browser.close();
