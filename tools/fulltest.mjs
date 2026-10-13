/* Full screen: pressed, the page goes full screen with nothing over the view and the button hides itself; leaving full
   screen (Esc, or any other way) brings everything back. */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import { root } from './lib.mjs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', e => console.log('pageerror', e.message));
await page.addInitScript(() => { window.__coveMaxRS = 0.3; window.__coveShadow = 256; window.__coveDtCap = 0.5; });
await page.goto('file://' + path.join(root, 'dist/page-local.html'));
await page.waitForFunction(() => !document.getElementById('enterQuiet').disabled, null, { timeout: 300000 });
await page.click('#enterQuiet'); await page.waitForTimeout(2500);
const state = () => page.evaluate(() => ({ fs: !!document.fullscreenElement, imm: document.body.classList.contains('immersive'), idle: document.body.classList.contains('idle'), skyHidden: getComputedStyle(document.getElementById('sky')).pointerEvents === 'none' }));
console.log('before', await state());
await page.click('#bFull'); await page.waitForTimeout(1000); console.log('in', await state());
await page.waitForFunction(() => document.body.classList.contains('idle'), null, { timeout: 15000 }); console.log('idle', await state());
await page.evaluate(() => document.exitFullscreen());
await page.waitForFunction(() => !document.body.classList.contains('immersive'), null, { timeout: 15000 }).catch(() => console.log('  STILL IMMERSIVE'));
console.log('out', await state());
await page.click('#bFull'); await page.waitForTimeout(1000); console.log('in again', await state());
await page.click('#bFull', { force: true }); await page.waitForFunction(() => !document.body.classList.contains('immersive'), null, { timeout: 15000 }).catch(() => console.log('  STILL IMMERSIVE'));
console.log('button out', await state());
await browser.close();
