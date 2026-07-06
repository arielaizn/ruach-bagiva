// Probe: is the settler water-job goal (spring + 2.5,2.5) reachable on ch1 terrain?
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
const out = await page.evaluate(() => {
  const G = window.__G;
  const T = G.terrain;
  const sp = T.spring;
  const goals = [
    ['settler spring+2.5,+2.5', sp.x + 2.5, sp.z + 2.5],
    ['donkey spring+3,-2', sp.x + 3, sp.z - 2],
    ['campfire/base', (G.basePos ?? { x: 0, z: 0 }).x, (G.basePos ?? { x: 0, z: 0 }).z],
  ];
  const res = { spring: sp, checks: [] };
  const u = G.units.find(x => x.kind === 'settler');
  for (const [label, x, z] of goals) {
    const c = T.worldToCell(x, z);
    const walk = T.walkable(c.cx, c.cz);
    const ok = u.walkTo(x, z);
    res.checks.push({ label, x: +x.toFixed(1), z: +z.toFixed(1), cellWalkable: walk, walkToOk: ok, arrived: u.arrived, pathLen: u.path?.length ?? null });
  }
  // also simulate the stuck spot from run 1: settler at -1.7,2.7 → spring
  u.pos.x = -1.7; u.pos.z = 2.7;
  const ok2 = u.walkTo(sp.x + 2.5, sp.z + 2.5);
  res.fromStuckSpot = { walkToOk: ok2, arrived: u.arrived, pathLen: u.path?.length ?? null };
  return res;
});
console.log(JSON.stringify(out, null, 1));

// --- probe 2: veg_patch worker-slot leak on job reassignment
const leak = await page.evaluate(async () => {
  const G = window.__G;
  const base = G.basePos ?? { x: 0, z: 0 };
  G.actions.startPlacement('veg_patch');
  let ok = false;
  outer:
  for (let r = 4; r < 20; r += 2) for (let a = 0; a < 16; a++) {
    const x = base.x + Math.cos(a / 16 * Math.PI * 2) * r, z = base.z + Math.sin(a / 16 * Math.PI * 2) * r;
    G.actions.movePlacement(x, z);
    if (G.placement?.valid) { G.actions.confirmPlacement(false); ok = true; break outer; }
  }
  if (!ok) return { err: 'no placement' };
  const patch = G.buildings.find(b => b.typeId === 'veg_patch');
  patch.state = 'done'; // complete instantly for the probe
  const u = G.units.find(x => x.kind === 'settler');
  u.setJob('farm');
  await new Promise(r => setTimeout(r, 1500));
  const afterFarm = { job: u.job, workers: patch.workers.size, hasTarget: !!u.workTarget };
  u.setJob('wood');
  const afterWood = { job: u.job, workers: patch.workers.size };
  u.setJob('farm');
  await new Promise(r => setTimeout(r, 1500));
  const afterRefarm = { job: u.job, workers: patch.workers.size, workerIds: [...patch.workers], myId: u.id };
  return { afterFarm, afterWood, afterRefarm };
});
console.log('LEAK PROBE:', JSON.stringify(leak, null, 1));

// --- probe 3: force a jackal wave and see if it ever threatens anything
const wave = await page.evaluate(async () => {
  const G = window.__G;
  G.director.scheduleWave({ budget: 2, palette: ['jackal'], dirs: ['E'], telegraphS: 1 });
  const seen = [];
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (G.hostiles.length) seen.push(G.hostiles.map(h => `${h.type}:${h.state}@${h.pos.x.toFixed(0)},${h.pos.z.toFixed(0)}`).join(','));
  }
  return { samples: seen.slice(0, 12), total: seen.length };
});
console.log('WAVE PROBE:', JSON.stringify(wave, null, 1));
await browser.close();
