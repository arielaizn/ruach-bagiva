// Headless QA harness: node tools/qa.mjs <url> [waitMs] [screenshotPath] [--eval "js"]
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://localhost:8123/index.html';
const waitMs = +(process.argv[3] || 4000);
const shot = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : null;
const evalIdx = process.argv.indexOf('--eval');
const evalJs = evalIdx > -1 ? process.argv[evalIdx + 1] : null;

const exec = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const browser = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
page.on('requestfailed', (r) => logs.push(`[REQFAIL] ${r.url()} ${r.failure()?.errorText}`));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(waitMs);
  if (evalJs) {
    try {
      const result = await page.evaluate(evalJs);
      console.log('EVAL RESULT:', JSON.stringify(result, null, 1)?.slice(0, 4000));
    } catch (e) { console.log('EVAL ERROR:', e.message); }
  }
  if (shot) { await page.screenshot({ path: shot }); console.log('SCREENSHOT:', shot); }
} catch (e) {
  console.log('NAV ERROR:', e.message);
}
console.log('--- CONSOLE (' + logs.length + ') ---');
for (const l of logs.slice(0, 60)) console.log(l);
await browser.close();
