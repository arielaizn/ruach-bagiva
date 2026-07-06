import { chromium } from 'playwright-core';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.click('text=הקמפיין'); await page.waitForTimeout(300);
await page.locator('.ch-card').nth(0).click(); await page.waitForTimeout(300);
await page.click('text=התחל'); await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const G = window.__G;
  const t = G.terrain.nearestTree(0, 0);
  const p = new (G.units[0].pos.constructor)(t.x, t.y + 1, t.z);
  p.project(G.rig.camera);
  const px = (p.x + 1) / 2 * innerWidth, py = (1 - p.y) / 2 * innerHeight;
  const hit = G.input.groundHit(px, py);
  const ent = G.input.entityAt(px, py);
  const res = G.input.resourceAt(px, py);
  return {
    tree: [t.x.toFixed(1), t.z.toFixed(1)], screen: [Math.round(px), Math.round(py)],
    hit: hit ? [hit.x.toFixed(1), hit.z.toFixed(1)] : null,
    distHitTree: hit ? Math.hypot(t.x - hit.x, t.z - hit.z).toFixed(2) : null,
    ent: ent ? ent.kind : null, res: res ? res.type : null,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
