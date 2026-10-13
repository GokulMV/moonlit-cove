/* Putting the letter back, for the eye: the letter is taken out of the bottle and read, then closed; the bottle comes up
   off the sand again, the letter rolls up and goes in at the neck, the cork is fetched off the sand and twisted back in,
   and the bottle goes back down where it lay. The bottle's clock is held still at each step for a picture.
   node tools/bottleclose.mjs [hour 15] */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 15);
const T0 = Date.now(), lap = m => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4) + 's ' + m);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.6, hour, dtCap: 1.0 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const info = () => page.evaluate(() => {
  const c = Engine.dbg.camp(), m = c.bottleModel, ud = m.userData, w = o => { o.updateMatrixWorld(true); const v = o.getWorldPosition(new THREE.Vector3()); return v.toArray().map(x => +x.toFixed(3)); };
  return { phase: Engine.bottle.phase, held: m.parent !== c.bottle, corkIn: ud.cork.parent === m, cork: w(ud.cork), rollX: +ud.roll.position.x.toFixed(3), rollVis: ud.roll.visible, bottle: w(m), paper: Engine.paper.mode, dist: Engine.bottle.dist() && +Engine.bottle.dist().toFixed(2) };
});
await page.evaluate(() => { window.__coveBottleT = 0; window.__cove.openChapter('contact'); });
await until(page, () => !window.__cove.rd.pending, null, 120000);
for (const s of [3.0, 5.8, 7.6]) { await page.evaluate(s => { window.__coveBottleT = s; }, s); await frames(2); }
await until(page, () => Engine.paper.mode === 'open', null, 60000);
/* (the clock let go a moment, so the cork comes down on the sand) */
await page.evaluate(() => { window.__coveBottleT = null; }); await frames(5);
lap('reading: ' + JSON.stringify(await info()));
/* closed */
/* (the bottle's clock held from the start, so each step below is where it says) */
await page.evaluate(() => { window.__coveBottleT = 0; window.__cove.openChapter(null); });
await frames(1);
let i = await info(); lap('closing: ' + JSON.stringify(i));
ok(i.phase === 'putback', 'the letter is being put back by hand (' + i.phase + ')');
await page.evaluate(() => { window.__coveBottleT = 0.6; }); await frames(2); await shot(page, `close_${hour}_lift`); lap('lifting: ' + JSON.stringify(await info()));
await page.evaluate(() => { window.__coveBottleT = 1.2; }); await frames(1);
await until(page, () => Engine.paper.mode === 'hidden', null, 60000); await frames(1);
i = await info(); lap('the letter at the neck: ' + JSON.stringify(i)); ok(i.held && i.dist < 1.0, 'the bottle is up in front of the eyes (' + i.dist + ' m)');
for (const [s, name] of [[1.5, 'in0'], [1.9, 'in1'], [2.2, 'in2'], [2.6, 'cork0'], [3.2, 'cork1'], [4.0, 'twisted'], [4.8, 'lower'], [5.6, 'down']]) {
  await page.evaluate(s => { window.__coveBottleT = s; }, s); await frames(2);
  i = await info(); await shot(page, `close_${hour}_${name}`); lap(`${name} (t=${s}): ${JSON.stringify(i)}`);
}
await page.evaluate(() => { window.__coveBottleT = null; });
await until(page, () => Engine.bottle.phase === 'rest', null, 60000); await frames(2);
i = await info(); lap('done: ' + JSON.stringify(i));
ok(!i.held && i.rollVis && i.corkIn, 'the bottle is back on the sand with the letter in it and its cork in');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
