/* The door: the loader while the cove builds (it must keep moving), then the card over the live cove. */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import { root, shots } from './lib.mjs';
const w = +(process.argv[2] || 1280), h = +(process.argv[3] || 800);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
page.on('pageerror', e => console.log('pageerror', e.message));
await page.addInitScript(() => { window.__coveMaxRS = 0.4; window.__coveShadow = 512; window.__coveDtCap = 0.5; });
await page.goto('file://' + path.join(root, 'dist/page-local.html'));
const t0 = Date.now();
for (const ms of [300, 1500]) { await page.waitForTimeout(ms); const a = await page.evaluate(() => document.getAnimations().slice(0, 3).map(x => Math.round(x.currentTime))); console.log('anim times', a); await page.screenshot({ path: path.join(shots, `door_loader_${ms}.png`) }); }
await page.waitForFunction(() => !document.getElementById('enterQuiet').disabled, null, { timeout: 300000 });
console.log('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(shots, 'door_card.png') });
await browser.close();
