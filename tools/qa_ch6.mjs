// QA playthrough of chapter 6 ("הלילה הגדול") — simulated reasonable player.
import { chromium } from 'playwright-core';

const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack || '').split('\n')[1] ?? ''}`));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  localStorage.setItem('ruach-bagiva-save-v1', JSON.stringify({ unlockedChapter: 7, completed: ['ch1','ch2','ch3','ch4','ch5'], settings: { master: 0, music: 0, sfx: 0, edgePan: true, quality: 'high' } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
await page.click('text=הקמפיין');
await page.waitForTimeout(400);
await page.locator('.ch-card').nth(5).click();
await page.waitForTimeout(400);
await page.click('text=התחל');
await page.waitForTimeout(2000);

// verify chapter + assign starting jobs
const init = await page.evaluate(() => {
  const G = window.__G;
  const settlers = G.units.filter(u => u.kind === 'settler');
  // kit gives: shepherd x1, guard x2. Assign the 6 unassigned: 2 wood, 1 water, 1 farm, 2 build.
  const want = ['wood', 'wood', 'water', 'farm', 'build', 'build'];
  const free = settlers.filter(s => !s.job);
  free.forEach((s, i) => { if (want[i]) s.setJob(want[i]); });
  G.actions.setSpeed(3);
  return { level: G.level?.id, settlers: settlers.map(s => `${s.name}:${s.job ?? '-'}`).join(','), res: { ...G.res }, flock: G.flock.length };
});
console.log('INIT', JSON.stringify(init));
if (init.level !== 'ch6') { console.log('HARNESS: wrong chapter loaded:', init.level); await browser.close(); process.exit(1); }

// The per-tick "player brain" + state dump, run in-page every poll.
const tick = () => page.evaluate(() => {
  const G = window.__G;
  const out = { notes: [] };
  try {
    if (G.time.speed !== 3 && G.running) G.actions.setSpeed(3);

    const telegraph = (G.director?.pendingWaves?.length ?? 0) > 0;
    const hostilesLive = G.hostiles.some(h => h.alive);

    // bell management: ring during telegraph/attack, release when clear
    if ((telegraph || hostilesLive) && !G.flags.bell) { G.actions.toggleBell(); out.notes.push('BELL ON'); }
    if (!telegraph && !hostilesLive && G.flags.bell) { G.actions.toggleBell(); out.notes.push('BELL OFF'); }

    // evening kumzitz (not during alarm/shabbat)
    if (!G.flags.bell && G.time.hour >= 18 && G.time.hour < 19.5 && !G.time.isShabbat && !G.flags.kumzitzTonight && G.res.wood >= 20) {
      if (G.actions.kumzitz()) out.notes.push('KUMZITZ');
    }

    // construction plan: 2 watchtowers then generator, when affordable & calm
    const countOf = (t) => G.buildings.filter(b => b.typeId === t).length;
    const tryPlace = (type) => {
      if (G.placement) return false;
      G.actions.startPlacement(type);
      if (!G.placement) return false;
      const base = G.basePos ?? { x: 0, z: 0 };
      for (let r = 7; r < 30; r += 2) {
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
    if (!G.flags.bell) {
      if (countOf('watchtower') < 2 && G.res.wood >= 50 && G.res.stone >= 50) {
        out.notes.push('PLACE watchtower:' + tryPlace('watchtower'));
      } else if (countOf('watchtower') >= 2 && countOf('generator') < 1 && G.res.wood >= 20 && G.res.shekels >= 90) {
        out.notes.push('PLACE generator:' + tryPlace('generator'));
      }
    }

    // after all builds done, move builders to guard duty for the big night
    const allBuilt = G.buildings.filter(b => b.typeId === 'watchtower' && b.state === 'done').length >= 2
      && G.buildings.some(b => b.typeId === 'generator' && b.state === 'done');
    if (allBuilt && !G.flags._qaRedeployed) {
      G.flags._qaRedeployed = true;
      const builders = G.units.filter(u => u.kind === 'settler' && u.job === 'build');
      builders.forEach((s, i) => s.setJob(i === 0 ? 'wood' : 'guard'));
      out.notes.push('REDEPLOY builders->guard');
    }
  } catch (e) { out.notes.push('TICKERR ' + e.message); }

  out.day = G.time.day; out.hour = +G.time.hour.toFixed(1); out.shabbat = G.time.isShabbat;
  out.speed = G.time.speed; out.running = G.running;
  out.res = Object.fromEntries(Object.entries(G.res).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  out.badRes = Object.entries(G.res).filter(([, v]) => !Number.isFinite(v) || v < -0.01).map(([k, v]) => `${k}=${v}`);
  out.spirit = Math.round(G.spirit);
  out.units = G.units.map(u => `${u.name ?? u.kind}:${u.kind === 'settler' ? (u.job ?? '-') : u.kind}${u.fallen ? ':INJ' : ''}${u.alive ? '' : ':DEAD'}@${u.pos.x.toFixed(1)},${u.pos.z.toFixed(1)}`);
  out.flock = G.flock.filter(s => s.alive).length;
  out.hostiles = G.hostiles.map(h => `${h.type}:${h.state}:c${Math.round(h.courage)}`).join(',');
  out.buildings = G.buildings.map(b => `${b.typeId}:${b.state}${b.state === 'building' ? ':' + Math.round((b.progress / (b.def?.buildS ?? 1)) * 100) + '%' : ''}`).join(',');
  out.objectives = (G.objectives ?? []).map(o => `${o.id}:${o.done ? 'DONE' : Math.round(o.progress * 100) + '%'}`).join(',');
  out.waves = G.runner?.wavesSurvived; out.bell = !!G.flags.bell;
  out.pending = (G.director?.pendingWaves ?? []).length;
  return out;
});

const t0 = Date.now();
const HARD_STOP = 14 * 60 * 1000;
let last = null, result = 'timeout';
const posHistory = new Map(); // name -> {pos, since}
let shot = 0;

while (Date.now() - t0 < HARD_STOP) {
  await page.waitForTimeout(5000);
  const win = await page.locator('text=ניצחון!').count();
  const lose = await page.locator('text=הגבעה נפלה').count();
  if (win) { result = 'WIN'; break; }
  if (lose) { result = 'LOSE'; break; }
  let s;
  try { s = await tick(); } catch (e) { console.log('HARNESS tick error:', e.message); continue; }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const brief = { m: mins, day: s.day, h: s.hour, shab: s.shabbat, res: s.res, spirit: s.spirit, flock: s.flock, waves: s.waves, bell: s.bell, pend: s.pending, obj: s.objectives, host: s.hostiles, bld: s.buildings, notes: s.notes, badRes: s.badRes };
  console.log(JSON.stringify(brief));
  if (s.notes.length && shot < 8 && (s.notes.some(n => n.startsWith('BELL ON')) || s.notes.some(n => n.startsWith('PLACE')))) {
    await page.screenshot({ path: `${SHOTDIR}/qa6_ev${shot++}_d${s.day}.png` }).catch(() => {});
  }
  // stuck detection (working hours only, game running, no bell)
  if (s.running && !s.bell && !s.shabbat && s.hour > 7 && s.hour < 18) {
    for (const u of s.units) {
      const [id, rest] = [u.split('@')[0], u.split('@')[1]];
      const prev = posHistory.get(id);
      if (prev && prev.pos === rest) {
        prev.count++;
        if (prev.count === 13) console.log('STUCK?', id, 'at', rest, 'for ~60s+ (day', s.day, 'h', s.hour, ')');
      } else posHistory.set(id, { pos: rest, count: 0 });
    }
  }
  last = s;
}

console.log('RESULT:', result, 'after', ((Date.now() - t0) / 60000).toFixed(1), 'min');
await page.screenshot({ path: SHOTDIR + '/qa6_final.png' }).catch(() => {});
if (last) console.log('LAST STATE:', JSON.stringify(last));
console.log('=== CONSOLE/PAGE ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
