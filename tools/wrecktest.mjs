/* After a wave knocks the camp over: the dots go with their objects or go away, a knocked-over chair can't be sat in
   (it says so and offers to put the camp back up), the radio and the drawing board say so too; a chapter opened from
   the dock sets its object back up; putting the camp back up brings everything back.
   node tools/wrecktest.mjs [hour 15] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 15);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.6, hour, dtCap: 0.5 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const spots = () => page.evaluate(() => [...document.querySelectorAll('#spots .spot')].map(s => ({ l: s.querySelector('.lbl').textContent, v: s.style.visibility, t: s.style.transform })));
await frames(3);
const before = await spots();
console.log('  dots before:', before.filter(s => s.v === 'visible').map(s => s.l).join(', '));
/* a wave reaches the camp: the chairs go over, the bottle goes out to sea, the side table and the basket are knocked */
await page.evaluate(() => {
  const S = Engine.surgeState(), c = Engine.dbg.camp(), wt = window.__cove.st.t, hit = o => { const d = S.dyn.find(q => q.o === o); if (d) d.hit = { t: wt, seed: 0.4, depth: 1.2, tPeak: wt + 1, tEnd: wt + 2 }; };
  [c.chairs[0], c.chairs[1], c.bottle, c.crate, c.basket, c.table].forEach(hit);
});
await frames(8);
const after = await spots();
const vis = l => after.some(s => s.l === l && s.v === 'visible');
console.log('  dots after:', after.filter(s => s.v === 'visible').map(s => s.l).join(', ') || '(none)');
ok(!vis('Sit'), 'no Sit dots on knocked-over chairs');
ok(!vis('Contact') && !vis('Blueprints') && !vis('Build notes'), 'no dots for the bottle, the basket or the journal while they lie knocked over');
ok(await page.evaluate(() => Engine.knocked('chair0') && Engine.knocked('contact') && !Engine.knocked('board')), 'the engine knows what is down (and that the wish board is still up)');
await shot(page, 'wreck_after');
/* sitting in a knocked-over chair: refused, with the offer to put the camp back up */
/* (read straight away: the note goes after a few seconds of real time, and software rendering takes longer than that
   over a frame or two) */
const t1 = await page.evaluate(() => { window.__cove.sit(Engine.seatIndex('chair0')); return { seated: window.__cove.seat.on, toast: document.getElementById('toast').hidden ? '' : document.getElementById('toastText').textContent, btn: !document.getElementById('toastBtn').hidden }; });
await frames(2);
t1.seated = t1.seated || await page.evaluate(() => window.__cove.seat.on);
ok(!t1.seated && /wet sand/.test(t1.toast) && t1.btn, 'a knocked-over chair can\'t be sat in: ' + JSON.stringify(t1));
/* the driftwood log is still up: that seat works */
await page.evaluate(() => window.__cove.sit(Engine.seatIndex('log0')));
await frames(2);
ok(await page.evaluate(() => window.__cove.seat.on), 'the driftwood log, still where it was, can be sat on');
await page.keyboard.press('Escape'); await frames(3);
/* the letter, from the dock: the bottle is set back up, then picked up as ever */
await page.evaluate(() => { window.__coveBottleT = 0.5; window.__cove.openChapter('contact'); });
await frames(2);
ok(await page.evaluate(() => !Engine.knocked('contact')), 'opening the letter from the dock sets the bottle back up');
await page.evaluate(() => { window.__coveBottleT = null; window.__cove.openChapter(null); }); await frames(4);
/* putting the camp back up */
await page.evaluate(() => document.getElementById('toastBtn').click()); await frames(4);
ok(await page.evaluate(() => !Engine.knocked('chair0') && !Engine.knocked('notes')), 'putting the camp back up brings everything back');
const back = await spots(); console.log('  dots back:', back.filter(s => s.v === 'visible').map(s => s.l).join(', '));
ok(back.some(s => s.l === 'Sit' && s.v === 'visible'), 'and the Sit dots are back');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
