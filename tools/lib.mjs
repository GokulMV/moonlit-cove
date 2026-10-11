/* Headless test bench: opens the built page in Chromium (software GL) and gives a few helpers. */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import fs from 'fs';
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const shots = path.join(root, 'shots'); fs.mkdirSync(shots, { recursive: true });

export async function open({ rs = 0.4, dtCap = 0.5, w = 1280, h = 800, url = 'file://' + path.join(root, 'dist/page-local.html'), enter = true, hour = 23, query = '', mobile = false, init } = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.text(); logs.push(`[${m.type()}] ${t}`); if (m.type() === 'error') console.log('  console error:', t.slice(0, 300)); });
  page.on('pageerror', e => { logs.push('[pageerror] ' + e.message); console.log('  pageerror:', e.message.slice(0, 400)); });
  await page.addInitScript(({ hour, rs, dtCap }) => {
    try { localStorage.setItem('cove.timeMode', JSON.stringify('custom')); localStorage.setItem('cove.hour', JSON.stringify(hour)); localStorage.setItem('cove.weather', JSON.stringify('clear')); } catch (e) {}
    window.__coveMaxRS = rs; window.__coveDtCap = dtCap; window.__coveShadow = 512;
  }, { hour, rs, dtCap });
  if (init) await page.addInitScript(init);
  await page.goto(url + query, { timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('enterQuiet').disabled, null, { timeout: 180000 });
  if (enter) {
    await page.evaluate(() => document.getElementById('enterQuiet').click());
    await page.waitForFunction(() => window.__cove && window.__cove.st.entered, null, { timeout: 30000 });
    /* headless software GL starves CSS transitions; the intro's fade never runs there, so take it away */
    await page.addStyleTag({ content: '#hud .intro.gone{display:none!important}' });
    await page.waitForTimeout(1500);
  }
  return { browser, page, logs };
}
export const shot = (page, name) => page.screenshot({ path: path.join(shots, name + '.png'), timeout: 180000 });
export const wait = (page, ms) => page.waitForTimeout(ms);
/* wait for a condition evaluated in the page */
export const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
