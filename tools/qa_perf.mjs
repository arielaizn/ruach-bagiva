// Performance profile of chapter 6 under a heavy raid (budget 26) with ~20 flock.
// Measures FPS (rAF deltas), renderer.info calls/triangles, JS heap, longtasks,
// at default iso camera and at close camera (dist 14). Does not edit game code.
import { chromium } from 'playwright-core';

const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({
    unlockedChapter: 7, completed: ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'],
    settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' },
  }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(5).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2500);

// Verify chapter, grow flock to ~20, spawn heavy wave, speed 3.
const setup = await page.evaluate(() => {
  const G = window.__G;
  G.res.shekels = 999;
  let bought = 0;
  for (let i = 0; i < 40 && G.flock.length < 20; i++) {
    if (G.actions.buySheep?.()) bought++; else { G.res.shekels = 999; if (!G.actions.buySheep?.()) break; bought++; }
  }
  G.director.scheduleWave({ budget: 26, palette: ['wolf', 'jackal', 'raider', 'thief'], dirs: ['E', 'W'], telegraphS: 2 });
  G.actions.setSpeed(3);
  return { level: G.level?.id, flock: G.flock.length, bought, units: G.units.length };
});
console.log('SETUP', JSON.stringify(setup));
if (setup.level !== 'ch6') { console.log('WRONG CHAPTER', setup.level); await browser.close(); process.exit(1); }

// let the telegraph fire and hostiles spawn
await page.waitForTimeout(4000);
const midState = await page.evaluate(() => {
  const G = window.__G;
  return { hostiles: G.hostiles.filter(h => h.alive).length, flock: G.flock.length, speed: G.time.speed };
});
console.log('RAID STATE', JSON.stringify(midState));

// In-page sampler: rAF deltas + longtasks + heap + renderer.info over N ms.
const sample = (ms) => page.evaluate((durMs) => new Promise((resolve) => {
  const G = window.__G;
  const deltas = [];
  let longTasks = 0, longTaskMs = 0;
  let po = null;
  try {
    po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { longTasks++; longTaskMs += e.duration; }
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch { /* longtask unsupported */ }
  let last = performance.now();
  const t0 = last;
  window.__hpeak = 0;
  const tick = (now) => {
    deltas.push(now - last);
    last = now;
    const hl = G.hostiles.filter(h => h.alive).length;
    if (hl > window.__hpeak) window.__hpeak = hl;
    if (now - t0 < durMs) { requestAnimationFrame(tick); return; }
    po?.disconnect();
    deltas.shift(); // first delta spans the setup gap
    const fpsInst = deltas.map(d => 1000 / Math.max(d, 0.001));
    const avg = 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length);
    // min FPS over 1s buckets (robust) + worst single frame
    const buckets = [];
    let acc = 0, n = 0;
    for (const d of deltas) { acc += d; n++; if (acc >= 1000) { buckets.push(n / (acc / 1000)); acc = 0; n = 0; } }
    const minBucket = buckets.length ? Math.min(...buckets) : avg;
    const worstFrameMs = Math.max(...deltas);
    const info = G.renderer.info.render;
    const mem = performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null;
    resolve({
      frames: deltas.length,
      fpsAvg: +avg.toFixed(1),
      fpsMin1s: +minBucket.toFixed(1),
      fpsInstMin: +Math.min(...fpsInst).toFixed(1),
      worstFrameMs: +worstFrameMs.toFixed(1),
      drawCalls: info.calls, triangles: info.triangles,
      heapMB: mem, longTasks, longTaskMs: +longTaskMs.toFixed(0),
      hostilesLive: G.hostiles.filter(h => h.alive).length,
      hostilesPeak: window.__hpeak ?? 0,
      flock: G.flock.length, speed: G.time.speed,
      camDist: +G.rig._dist.toFixed(1), camMode: G.rig.mode,
    });
  };
  requestAnimationFrame(tick);
}), ms);

console.log('--- ISO camera, 15s during raid ---');
const iso = await sample(15000);
console.log(JSON.stringify(iso, null, 1));

// close camera: dist 14 over the action (center on base)
await page.evaluate(() => {
  const G = window.__G;
  const b = G.basePos ?? { x: 0, z: 0 };
  G.rig.flyTo(b.x, b.z);
  G.rig.mode = 'close';
  G.rig.dist = 14;
});
await page.evaluate(() => {
  window.__G.director.scheduleWave({ budget: 26, palette: ['wolf', 'jackal', 'raider', 'thief'], dirs: ['E', 'W'], telegraphS: 2 });
});
await page.waitForTimeout(4000); // let lerped _dist settle + wave spawn
console.log('--- CLOSE camera (dist 14), 10s ---');
const close = await sample(10000);
console.log(JSON.stringify(close, null, 1));

// heap growth probe: sample again after 10 more seconds at speed 3
await page.waitForTimeout(10000);
const heap2 = await page.evaluate(() => performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null);
console.log('HEAP after +10s:', heap2, 'MB');

console.log('RESULT', JSON.stringify({ iso, close, heap2 }));
console.log('=== CONSOLE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
