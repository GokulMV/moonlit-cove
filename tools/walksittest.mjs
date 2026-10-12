/* Sitting down from a walk: walking on the beach, click the chair: the eyes go on from where the walker stands (never
   back up to the explore view), walk over to the chair at standing height, turn round and sit; standing up walks on.
   node tools/walksittest.mjs [hour 18] */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 18);
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.6, hour });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { window.__coveDtCap = 0.25; const c = window.__cove; c.startWalk(); const w = c.wk; w.x = Layout.fire.x - 4; w.z = Layout.fire.z + 3.2; w.h = w.hT = Math.PI / 2; w.camK = 1; });
await frames(3);
/* sit, and record the eyes' height every frame until seated */
await page.evaluate(() => { window.__trail = []; const c = window.__cove; c.sit(Engine.seatIndex('chair0'));
  const rec = () => { const p = c.st.camFinal.pos; window.__trail.push([+p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2), c.seat.approach ? c.seat.approach.stage : 0]); if (window.__trail.length < 400 && c.seat.on) requestAnimationFrame(rec); }; requestAnimationFrame(rec); });
let shotN = 0;
for (let k = 0; k < 40; k++) {
  await frames(1);
  const s = await page.evaluate(() => { const c = window.__cove; return { t: c.st.camT, stage: c.seat.approach ? c.seat.approach.stage : 0, sat: performance.now() > c.seat.sitAt + 900 }; });
  if (k % 4 === 0 && shotN < 6) await shot(page, `walksit_${shotN++}`);
  if (s.stage === 0 && s.sat) break;
}
const trail = await page.evaluate(() => window.__trail);
const maxY = Math.max(...trail.map(p => p[1])), last = trail[trail.length - 1];
console.log('eyes:', trail.filter((_, i) => i % 3 === 0).map(p => p.slice(0, 2).join(',') + (p[3] ? '·' + p[3] : '')).join('  '));
check(maxY < 2.0, `the eyes stay at standing height or below on the way (highest ${maxY} m), never back up to the explore view`);
check(last[1] < 1.1, `and end seated (${last[1]} m)`);
await shot(page, 'walksit_seated');
await page.evaluate(() => window.__cove.standUp()); await frames(6);
check(await page.evaluate(() => window.__cove.wk.on && !window.__cove.seat.on), 'standing up walks on');
await shot(page, 'walksit_up');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close(); process.exit(fails ? 1 : 0);
