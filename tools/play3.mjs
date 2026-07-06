import { chromium } from 'playwright-core';
const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text().slice(0,200)}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack||'').split('\n')[1] ?? ''}`));
const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1),
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])),
    spirit: Math.round(G.spirit), flock: G.flock.length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`).join(','),
    demolition: G.director?.demolition ? { state: G.director.demolition.state, days: G.director.demolition.daysLeft, outcome: G.director.demolition.outcome } : null,
    props: G.director?.props.map(p => p.mesh.userData.modelType + ':' + p.state).join(','),
    supporters: G.units.filter(u => u.kind === 'supporter').length,
    junctionTrips: G.runner?.junctionTrips,
    banner: document.querySelector('#demolition-banner')?.classList.contains('show'),
  };
});
const ff = async (sec) => { await page.evaluate(() => window.__G.actions.setSpeed(3)); await page.waitForTimeout(sec * 1000); await page.evaluate(() => window.__G.actions.setSpeed(1)); };

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.evaluate(() => localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: [], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } })));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('text=הקמפיין'); await page.waitForTimeout(300);
await page.locator('.ch-card').nth(3).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1800);
console.log('CH4 START', JSON.stringify(await state()));

// jump to demolition trigger (day 2 hour 9)
await page.evaluate(() => { const G = window.__G; G.time.day = 2; G.time.hour = 8.9; });
await ff(6);
console.log('DEMOLITION SERVED?', JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p3_order.png' });

// muster via the banner button
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#demolition-banner button')];
  const mus = btns.find(b => b.textContent.includes('תומכים'));
  if (mus && !mus.disabled) { mus.click(); return true; }
  return false;
});
console.log('MUSTER CLICKED:', clicked);
await ff(20);
console.log('AFTER MUSTER', JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p3_bus.png' });

// junction runner test
await page.evaluate(() => {
  const G = window.__G;
  const s = G.units.find(u => u.kind === 'settler' && u.job !== 'guard' && u.job !== 'shepherd');
  s.setJob('runner');
});
await ff(35);
console.log('AFTER JUNCTION', JSON.stringify(await state()));

// thief wave test
await page.evaluate(() => window.__G.director.scheduleWave({ budget: 6, palette: ['thief'], dirs: ['S'], telegraphS: 3 }));
await ff(18);
console.log('THIEF WAVE', JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/p3_thief.png' });
await ff(25);
console.log('THIEF SETTLED', JSON.stringify(await state()));

console.log('=== ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
