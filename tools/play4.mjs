// Real-input test: mouse selection, drag select, right-click orders, keys, build UI.
import { chromium } from 'playwright-core';
const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const logs = [];
page.on('console', (m) => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text().slice(0,200)}`); });
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message} :: ${(e.stack||'').split('\n')[1] ?? ''}`));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('text=הקמפיין'); await page.waitForTimeout(300);
await page.locator('.ch-card').nth(0).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1800);

const sp = (sel) => page.evaluate((sel) => {
  const G = window.__G;
  const THREE_V = G.units[0].pos.constructor;
  let e;
  if (sel === 'settler') e = G.units.find(u => u.kind === 'settler');
  if (sel === 'tree') { const t = G.terrain.nearestTree(0, 0); e = { pos: new THREE_V(t.x, t.y + 1, t.z) }; }
  if (sel === 'spring') { const s = G.terrain.spring; e = { pos: new THREE_V(s.x, G.terrain.heightAt(s.x, s.z), s.z) }; }
  const p = e.pos.clone(); p.y += 0.9;
  p.project(G.rig.camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}, sel);

// 1. click-select a settler
let p = await sp('settler');
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
console.log('CLICK SELECT:', await page.evaluate(() => window.__G.selection.map(e => e.kind + ':' + (e.name ?? '')).join(',')), '| panel:', await page.locator('#sel-panel.show').count());

// 2. right-click a tree -> wood job
p = await sp('tree');
await page.mouse.click(p.x, p.y, { button: 'right' });
await page.waitForTimeout(300);
console.log('RCLICK TREE -> job:', await page.evaluate(() => window.__G.selection[0]?.job));

// 3. right-click spring -> water job
p = await sp('spring');
await page.mouse.click(p.x, p.y, { button: 'right' });
await page.waitForTimeout(300);
console.log('RCLICK SPRING -> job:', await page.evaluate(() => window.__G.selection[0]?.job));

// 4. drag-select around center
await page.mouse.move(500, 300);
await page.mouse.down();
await page.mouse.move(1000, 650, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
console.log('DRAG SELECT count:', await page.evaluate(() => window.__G.selection.length));

// 5. right-click ground move order
await page.mouse.click(760, 300, { button: 'right' });
await page.waitForTimeout(300);
console.log('GROUND ORDER states:', await page.evaluate(() => window.__G.selection.map(u => u.state).join(',')));

// 6. keyboard: camera toggle + rotate + speed
await page.keyboard.press('KeyC');
await page.waitForTimeout(700);
console.log('CAMERA MODE:', await page.evaluate(() => window.__G.rig.mode));
await page.keyboard.press('KeyC');
await page.keyboard.press('KeyQ');
await page.waitForTimeout(400);

// 7. build menu: click tent, move, click to place
await page.click('.bld-btn');
await page.waitForTimeout(200);
console.log('PLACEMENT ACTIVE:', await page.evaluate(() => !!window.__G.placement));
await page.mouse.move(720, 480);
await page.waitForTimeout(300);
const valid = await page.evaluate(() => window.__G.placement?.valid);
console.log('GHOST VALID:', valid);
await page.mouse.click(720, 480);
await page.waitForTimeout(300);
console.log('SITE PLACED:', await page.evaluate(() => window.__G.buildings.map(b => b.typeId + ':' + b.state).join(',')));
await page.screenshot({ path: SHOTDIR + '/p4_input.png' });

// 8. ESC opens pause
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('PAUSE SHOWN:', await page.locator('text=המשחק מושהה').count());
await page.keyboard.press('Escape');

console.log('=== ISSUES (' + logs.length + ') ===');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
