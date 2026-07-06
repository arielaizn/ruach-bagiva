import { chromium } from 'playwright-core';
const SHOTDIR = '/private/tmp/claude-501/-Users-a1234/4da2bcb5-53e1-4c27-be92-8ef49b1058a2/scratchpad';
const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
await page.waitForTimeout(2200);
const groups = {
  life1: ['settler','settler_f','shepherd','guard','supporter','volunteer','inspector'],
  life2: ['dog','donkey','sheep','goat','chicken','jackal','wolf','boar'],
  life3: ['thief','raider','leader'],
  bld1: ['tent','caravan','sheep_pen','veg_patch','campfire'],
  bld2: ['fence','pergola','synagogue','kennel','zula'],
  bld3: ['vineyard','container','water_tower','watchtower','generator'],
  veh: ['flagpole','jeep','bulldozer','bus','pickup','construction','guardpost','orderNotice','haybale','jerrycan','trough'],
};
for (const [name, types] of Object.entries(groups)) {
  await page.evaluate(({ types, name }) => {
    const G = window.__G;
    G.menus.close();
    document.getElementById('menus').classList.add('hidden');
    G.running = true; G.level = null;
    if (window.__gal) { for (const m of window.__gal) G.scene.remove(m); }
    window.__gal = [];
    const { createModel } = window.__models;
    const spacing = name.startsWith('life') ? 3.2 : 10;
    let x = -(types.length - 1) * spacing / 2;
    for (const t of types) {
      const type = t === 'settler_f' ? 'settler' : t;
      const opts = t === 'settler_f' ? { female: true, seed: 5 } : { seed: 3 };
      const m = createModel(type, opts);
      m.position.set(x, G.terrain.heightAt(x, -14), -14);
      m.rotation.y = 0;
      G.scene.add(m);
      window.__gal.push(m);
      x += spacing;
    }
    G.time.hour = 10.5;
    G.rig.target.set(0, 0, -14); G.rig._target.set(0, 0, -14);
    const d = name.startsWith('life') ? types.length * 1.6 + 4 : types.length * 4.2 + 8;
    G.rig.dist = d; G.rig._dist = d;
    G.rig.yaw = Math.PI; G.rig._yaw = Math.PI;
  }, { types, name });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTDIR}/gal_${name}.png` });
  console.log('shot', name);
}
await browser.close();
