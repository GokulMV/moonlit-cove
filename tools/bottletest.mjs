/* The message in a bottle: opened from the dock, it is picked up, uncorked (the cork flies off onto the sand), tipped
   and shaken until the letter slides out, and the letter is read; closed, the letter goes back in and the cork hops back
   into the neck. Then again, put back half-way through. The bottle's clock is held still at each step for a picture.
   node tools/bottletest.mjs [hour 15] [steps 0.1,0.8,1.6,2.4,3.2,3.7,4.6,5.5] */
import { open, shot, wait, until } from './lib.mjs';
const hour = +(process.argv[2] || 15), steps = (process.argv[3] || '0.1,0.8,1.6,2.4,3.2,3.7,4.6,5.5').split(',').map(Number);
const T0 = Date.now(), lap = m => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4) + 's ' + m);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.7, hour, dtCap: 1.0 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const info = () => page.evaluate(() => {
  const c = Engine.dbg.camp(), m = c.bottleModel, ud = m.userData, w = o => { o.updateMatrixWorld(true); const v = o.getWorldPosition(new THREE.Vector3()); return v.toArray().map(x => +x.toFixed(3)); };
  return { phase: Engine.bottle.phase, held: m.parent !== c.bottle, visible: m.visible, corkFree: ud.cork.parent !== m, cork: w(ud.cork), rollX: +ud.roll.position.x.toFixed(3), rollVis: ud.roll.visible, bottle: w(m), cam: window.__cove.st.camFinal.pos.map(x => +x.toFixed(2)), paper: Engine.paper.mode, dist: Engine.bottle.dist() && +Engine.bottle.dist().toFixed(2) };
});
await page.evaluate(() => { window.__coveBottleT = 0; window.__cove.openChapter('contact'); });
await until(page, () => !window.__cove.rd.pending, null, 120000);
lap('the camera has come to the bottle; it is picked up: ' + JSON.stringify(await info()));
const seen = {};
for (const s of steps) {
  await page.evaluate(s => { window.__coveBottleT = s; }, s);
  await frames(2);
  const i = await info(); seen[s] = i;
  await shot(page, `bottle_${hour}_${String(s).replace('.', '_')}`); lap(`t=${s}: ${JSON.stringify(i)}`);
}
ok(seen[steps[0]].held, 'picked up off the sand at once');
ok(seen[1.6] ? seen[1.6].dist < 1.0 : true, 'brought up in front of the eyes (' + (seen[1.6] && seen[1.6].dist) + ' m away)');
ok(seen[2.4] ? !seen[2.4].corkFree : true, 'the cork is still in while it is twisted');
ok(seen[3.2] ? seen[3.2].corkFree : true, 'the cork is out once it pops');
ok(seen[5.5] ? seen[5.5].rollX > 0.12 && seen[5.5].rollVis : true, 'the letter is well out of the neck (' + (seen[5.5] && seen[5.5].rollX) + ')');
/* the letter is taken and read */
await page.evaluate(() => { window.__coveBottleT = 5.8; }); await frames(1);
let i = await info(); lap('taken: ' + JSON.stringify(i));
ok(i.paper === 'opening' || i.paper === 'open', 'the letter goes to be read (' + i.paper + ')');
ok(!i.rollVis, 'and is no longer in the bottle');
await page.evaluate(() => { window.__coveBottleT = 6.3; }); await frames(1); await shot(page, `bottle_${hour}_6_3`);
await page.evaluate(() => { window.__coveBottleT = 7.6; }); await frames(2);
i = await info(); lap('put down: ' + JSON.stringify(i));
ok(i.phase === 'down' && !i.held && i.visible, 'the bottle is back on the sand while the letter is read');
await until(page, () => Engine.paper.mode === 'open', null, 60000); await frames(1);
await shot(page, `bottle_${hour}_read`); lap('reading');
/* closed: the letter goes home, the cork hops back */
await page.evaluate(() => { window.__coveBottleT = null; window.__cove.openChapter(null); });
await until(page, () => Engine.bottle.phase === 'rest' && Engine.paper.mode === 'hidden', null, 120000); await frames(3);
i = await info(); lap('closed: ' + JSON.stringify(i));
ok(i.rollVis && !i.held, 'the letter is back in the bottle on the sand');
await until(page, () => { const c = Engine.dbg.camp(); return c.cork.parent === c.bottleModel; }, null, 60000);
ok(true, 'the cork is back in the neck');
/* again, put back half-way through the shaking */
await page.evaluate(() => { window.__coveBottleT = 0; window.__cove.openChapter('contact'); });
await until(page, () => !window.__cove.rd.pending, null, 120000);
await page.evaluate(() => { window.__coveBottleT = 4.4; }); await frames(2);
i = await info(); ok(i.held && i.corkFree, 'opened again, being shaken');
await page.evaluate(() => { window.__coveBottleT = null; window.__cove.openChapter(null); });
await until(page, () => Engine.bottle.phase === 'rest', null, 60000);
await until(page, () => { const c = Engine.dbg.camp(); return c.cork.parent === c.bottleModel; }, null, 60000); await frames(2);
i = await info(); lap('put back: ' + JSON.stringify(i));
ok(!i.held && i.rollVis && Math.abs(i.rollX - (-0.046)) < 0.002, 'put back half-way: the bottle, the letter and the cork are all home');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
