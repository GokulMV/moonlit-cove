/* Headless test bench: opens the built page in Chromium (software GL) and gives a few helpers. */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import fs from 'fs';
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const shots = path.join(root, 'shots'); fs.mkdirSync(shots, { recursive: true });

/* several agents share this machine (2 CPUs, 7 GB): at most two test browsers run at once, machine-wide.
   A slot is a lock directory under /tmp; a slot older than 15 minutes is taken to be abandoned. */
const SLOTS = ['/tmp/cove-browser-slot-0', '/tmp/cove-browser-slot-1'];
async function takeSlot() {
  for (;;) {
    for (const d of SLOTS) {
      try { fs.mkdirSync(d); fs.writeFileSync(d + '/pid', String(process.pid)); return d; }
      catch (e) {
        /* a slot whose owner has gone (killed, or the machine restarted) is free at once; one older than 15 minutes too */
        try { const st = fs.statSync(d); let alive = true;
          try { const pid = +fs.readFileSync(d + '/pid', 'utf8'); if (pid) { try { process.kill(pid, 0); } catch (e3) { alive = e3.code === 'EPERM'; } } }
          catch (e4) { alive = Date.now() - st.mtimeMs < 10e3; }   /* (no pid written yet: just taken, unless it has been like that a while) */
          if (!alive || Date.now() - st.mtimeMs > 15 * 60e3) fs.rmSync(d, { recursive: true, force: true }); } catch (e2) { /* gone already */ } }
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
let held = null;
const release = () => { if (held) { try { fs.rmSync(held, { recursive: true, force: true }); } catch (e) { /* already free */ } held = null; } };
process.on('exit', release); for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { release(); process.exit(1); });

export async function open({ rs = 0.4, msaa = 0, dtCap = 0.5, w = 1280, h = 800, url = 'file://' + path.join(root, 'dist/page-local.html'), enter = true, hour = 23, query = '', mobile = false, init, tz } = {}) {
  held = await takeSlot();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  /* (tz: the visitor's time zone, which the page places them by: the sky is theirs) */
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile }, tz ? { timezoneId: tz } : {}));
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.text(); logs.push(`[${m.type()}] ${t}`); if (m.type() === 'error') console.log('  console error:', t.slice(0, 300)); });
  page.on('pageerror', e => { logs.push('[pageerror] ' + e.message); console.log('  pageerror:', e.message.slice(0, 400)); });
  await page.addInitScript(({ hour, rs, dtCap, msaa }) => {
    try { localStorage.setItem('cove.timeMode', JSON.stringify('custom')); localStorage.setItem('cove.hour', JSON.stringify(hour)); localStorage.setItem('cove.weather', JSON.stringify('clear')); } catch (e) {}
    window.__coveMaxRS = rs; window.__coveDtCap = dtCap; window.__coveShadow = 512; window.__coveMSAA = msaa;
  }, { hour, rs, dtCap, msaa });
  if (init) await page.addInitScript(init);
  await page.goto(url + query, { timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('enterQuiet').disabled, null, { timeout: 180000 });
  if (enter) {
    await page.evaluate(() => document.getElementById('enterQuiet').click());
    await page.waitForFunction(() => window.__cove && window.__cove.st.entered, null, { timeout: 150000 }).catch(e => { console.log("  (not entered:", logs.filter(l => /error/i.test(l)).slice(0, 6).join(" | ").slice(0, 1500), ")"); throw e; });
    /* headless software GL starves CSS transitions; the intro's fade never runs there, so take it away */
    await page.addStyleTag({ content: '#hud .intro.gone{display:none!important}' });
    await page.waitForTimeout(1500);
  }
  const close = browser.close.bind(browser); browser.close = async () => { try { await close(); } finally { release(); } };
  return { browser, page, logs };
}
export const shot = (page, name) => page.screenshot({ path: path.join(shots, name + '.png'), timeout: 180000 });
export const wait = (page, ms) => page.waitForTimeout(ms);
/* wait for a condition evaluated in the page */
export const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
