// QA playtest: chapter 7 end-to-end, simulating a reasonable player.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

const state = () => page.evaluate(() => {
  const G = window.__G;
  return {
    day: G.time.day, hour: +G.time.hour.toFixed(1), shabbat: G.time.isShabbat,
    res: Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v)])),
    caps: G.caps ? Object.fromEntries(Object.entries(G.caps).map(([k, v]) => [k, Math.round(v)])) : undefined,
    spirit: Math.round(G.spirit),
    pop: { cur: G.pop.cur, max: G.pop.max },
    units: G.units.map(u => `${u.kind}:${u.job ?? u.state ?? ''}${u.fallen ? ':INJ' : ''}${u.alive === false ? ':DEAD' : ''}`).join(','),
    unitPos: G.units.filter(u => u.kind === 'settler').map(u => `${Math.round(u.pos.x)},${Math.round(u.pos.z)}`).join(';'),
    flock: G.flock.length,
    hostiles: G.hostiles.map(h => `${h.type}:${h.state}`).join(','),
    buildings: G.buildings.map(b => `${b.typeId}:${b.state}`).join(','),
    objectives: (G.objectives ?? []).map(o => `${o.id}:${o.done ? 'DONE' : (o.progress != null ? Math.round(o.progress * 100) + '%' : '?')}`).join(','),
    waves: G.runner?.wavesSurvived, bell: !!G.flags.bell, warn: !!window.__qaWarn,
    won: G.runner?.won, lost: G.runner?.lost,
  };
});

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1','ch2','ch3','ch4','ch5','ch6'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(6).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

// Install listeners + initial job assignment
await page.evaluate(() => {
  const G = window.__G;
  window.__qaWarn = false;
  G.events.on('raid-warning', () => { window.__qaWarn = true; });
  G.events.on('raid-end', () => { window.__qaWarn = false; });
  // jobs: keep pre-assigned shepherd + 2 guards. Others: 3 wood, 2 water, 2 farm
  const free = G.units.filter(u => u.kind === 'settler' && (u.job === 'idle' || !u.job));
  const plan = ['wood', 'wood', 'wood', 'water', 'water', 'farm', 'farm'];
  free.forEach((u, i) => { if (plan[i]) u.setJob(plan[i]); });
  G.actions.setSpeed(3);
});
console.log('=== CH7 START ===');
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/ch7_start.png' });

// placement helper injected once
await page.evaluate(() => {
  window.__qaPlace = (type) => {
    const G = window.__G;
    const base = G.basePos ?? { x: 0, z: 0 };
    G.actions.startPlacement(type);
    for (let r = 5; r < 30; r += 1.5) {
      for (let a = 0; a < 20; a++) {
        const x = base.x + Math.cos(a / 20 * Math.PI * 2) * r;
        const z = base.z + Math.sin(a / 20 * Math.PI * 2) * r;
        G.actions.movePlacement(x, z);
        if (G.placement?.valid) { G.actions.confirmPlacement(false); return true; }
      }
    }
    G.actions.cancelPlacement();
    return false;
  };
});

// Build the synagogue right away (objective 1)
const synOk = await page.evaluate(() => window.__qaPlace('synagogue'));
console.log('SYNAGOGUE PLACED:', synOk);

const t0 = Date.now();
const HARD_STOP_MS = 13.5 * 60 * 1000;
let lastPrint = 0;
let stuckRef = null, stuckSince = 0;
let done = 'timeout';

while (Date.now() - t0 < HARD_STOP_MS) {
  await page.waitForTimeout(4000);

  // win/lose detection
  const winC = await page.locator('text=ניצחון!').count();
  const loseC = await page.locator('text=הגבעה נפלה').count();
  if (winC > 0) { done = 'win'; break; }
  if (loseC > 0) { done = 'lose'; break; }

  // player automation tick
  const tick = await page.evaluate(() => {
    const G = window.__G;
    const acts = [];
    const hostiles = G.hostiles.filter(h => h.alive !== false).length;
    const danger = window.__qaWarn || hostiles > 0;
    // bell management
    if (danger && !G.flags.bell) { G.actions.toggleBell(); acts.push('bell-on'); }
    if (!danger && G.flags.bell) { G.actions.toggleBell(); acts.push('bell-off'); }
    // kumzitz in the evening when safe
    const h = G.time.hour;
    if (!danger && !G.time.isShabbat && h >= 18 && h <= 20.5 && G.res.wood > 20 && G.spirit < 90) {
      if (G.actions.kumzitz()) acts.push('kumzitz');
    }
    // ensure sites get built: keep up to 2 builders while sites exist
    const sites = G.buildings.filter(b => b.state === 'site');
    if (sites.length) {
      const builders = G.units.filter(u => u.kind === 'settler' && u.job === 'build');
      if (builders.length < 2) {
        const cands = G.units.filter(u => u.kind === 'settler' && u.alive !== false && (u.job === 'wood' || u.job === 'farm' || u.job === 'idle' || !u.job) && u.job !== 'build');
        for (const u of cands.slice(0, 2 - builders.length)) { u.setJob('build'); acts.push('builder:' + u.name); }
      }
    }
    // housing: build tents until pop cap (incl. pending tent sites) >= 13
    const pendingTentPop = G.buildings.filter(b => b.state === 'site' && b.typeId === 'tent').length;
    if (!danger && !G.placement && G.pop.max + pendingTentPop < 13 && G.res.wood >= 40) {
      const ok = window.__qaPlace('tent');
      acts.push('tent:' + ok);
    }
    // food push: second veg patch once economy is going
    if (!danger && !G.placement && G.res.wood >= 60 && !window.__qaVeg2) {
      window.__qaVeg2 = window.__qaPlace('veg_patch');
      acts.push('veg2:' + window.__qaVeg2);
    }
    // emergency: if water critically low, move a woodcutter to water
    if (G.res.water < 8) {
      const wc = G.units.find(u => u.kind === 'settler' && u.job === 'wood');
      if (wc) { wc.setJob('water'); acts.push('shift-to-water'); }
    }
    if (G.res.water > 100) {
      const extra = G.units.filter(u => u.kind === 'settler' && u.job === 'water');
      if (extra.length > 1) { extra[0].setJob('wood'); acts.push('shift-to-wood'); }
    }
    // keep unemployed settlers (new hitchhikers) working
    for (const u of G.units) {
      if (u.kind === 'settler' && (u.job === 'idle' || !u.job) && u.state !== 'ordered-move' && u.alive !== false) {
        u.setJob(sites.length ? 'build' : (G.res.food < 100 ? 'farm' : 'wood')); acts.push('hire:' + u.name);
      }
    }
    G.actions.setSpeed(3);
    return acts;
  });
  if (tick.length) console.log('[act]', tick.join(' '));

  // stuck detection on settler positions
  const st = await state();
  if (st.unitPos === stuckRef) {
    if (Date.now() - stuckSince > 60000 && !st.shabbat) console.log('[STUCK?] settler positions unchanged 60s+:', st.unitPos);
  } else { stuckRef = st.unitPos; stuckSince = Date.now(); }

  // NaN/negative check
  for (const [k, v] of Object.entries(st.res)) {
    if (Number.isNaN(v) || v < 0) console.log(`[RES BUG] ${k}=${v}`);
  }

  if (Date.now() - lastPrint > 20000) {
    lastPrint = Date.now();
    console.log(`[t+${Math.round((Date.now() - t0) / 1000)}s]`, JSON.stringify(st));
  }
}

console.log('=== END:', done, 'after', Math.round((Date.now() - t0) / 1000), 's ===');
console.log(JSON.stringify(await state()));
await page.screenshot({ path: SHOTDIR + '/ch7_end.png' });
console.log('=== ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
