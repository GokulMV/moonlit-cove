/* Sitting: every seat in turn (the two chairs, the driftwood log, the cushions at the table), seen from the seated eye
   once you have settled; what you sit on is out of sight; the radio is offered by the fire and not at the table; a chair
   turns with Q and keeps its turn; Esc stands you up. node tools/seattest.mjs [hour 21] */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 21);
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.7, hour });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { window.__coveDtCap = 1.0; });
const n = await page.evaluate(() => Engine.seatCount());
check(n >= 6, `${n} seats`);
for (let i = 0; i < n; i++) {
  await page.evaluate(i => window.__cove.sit(i), i);
  await until(page, () => window.__cove.st.camT >= 1 && performance.now() > window.__cove.seat.sitAt + 900, null, 120000);
  await frames(2);
  const s = await page.evaluate(() => { const c = window.__cove, P = c.seat.pose; return { id: P.id, name: P.name, near: P.near, eyeY: +c.st.cur.pos[1].toFixed(2), radio: !document.getElementById('radio').hidden, label: document.getElementById('seatName').textContent }; });
  console.log(`  seat ${i}:`, JSON.stringify(s));
  check(s.eyeY > 0.85 && s.eyeY < 1.1, `${s.id}: the eyes are at a seated height (${s.eyeY} m)`);
  check(s.radio === (s.near === 'fire'), `${s.id}: the radio is offered ${s.near === 'fire' ? 'by the fire' : 'not at the table'}`);
  await shot(page, `seat_${s.id}_${hour}`);
}
/* turning the first chair */
await page.evaluate(() => window.__cove.sit(Engine.seatIndex('chair0')));
await until(page, () => window.__cove.st.camT >= 1, null, 120000);
const before = await page.evaluate(() => window.__cove.seat.turn[0]);
await page.keyboard.press('q'); await page.keyboard.press('q');
await frames(6);
const after = await page.evaluate(() => window.__cove.seat.turn[0]);
console.log('  chair turn', before, '→', after);
check(Math.abs(after - before) > 0.4, 'Q turns the chair you sit in');
await shot(page, `seat_turned_${hour}`);
await page.keyboard.press('e'); await page.keyboard.press('e'); await frames(6);
await page.keyboard.press('Escape'); await frames(2);
check(await page.evaluate(() => !window.__cove.seat.on), 'Esc stands you up');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close(); process.exit(fails ? 1 : 0);
