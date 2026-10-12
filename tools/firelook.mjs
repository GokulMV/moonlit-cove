/* By the fire, and the van's things: the side table with the radio and the journal and the guitar leaning on it, seen
   from the camp and from each seat by the fire (nothing in the way of the sitter); the journal read on the table
   (nothing in the way of the reader); and the van driven off (its doormat and lantern go with it) and parked again.
   node tools/firelook.mjs [hour 16] [parts table,seats,read,van] */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 16), parts = (process.argv[3] || 'table,seats,read,van').split(',');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.7, hour, dtCap: 1.0 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const cam = (pos, look, fov = 45) => page.evaluate(([pos, look, fov]) => { window.__coveCamFix = { pos, look, fov, focus: Math.hypot(...pos.map((v, i) => v - look[i])) }; }, [pos, look, fov]);
const K = await page.evaluate(() => ({ x: Layout.crate.x, z: Layout.crate.z }));
if (parts.includes('table')) {
  for (const [i, [dx, dy, dz]] of [[1.1, 0.75, 1.5], [-1.4, 0.9, 1.1], [0.2, 1.6, 0.6]].entries()) {
    await cam([K.x + dx, dy, K.z + dz], [K.x, 0.42, K.z]); await frames(3); await shot(page, `fire_table_${i}`);
  }
  await page.evaluate(() => { window.__coveCamFix = null; });
}
if (parts.includes('seats')) {
  for (const id of ['chair0', 'chair1', 'log0', 'log1']) {
    await page.evaluate(id => window.__cove.sit(Engine.seatIndex(id)), id);
    await until(page, () => window.__cove.st.camT >= 1 && performance.now() > window.__cove.seat.sitAt + 900, null, 120000);
    await frames(2); await shot(page, `fire_seat_${id}`); console.log('  sat in', id);
  }
  await page.keyboard.press('Escape'); await frames(3);
}
if (parts.includes('read')) {
  await page.evaluate(() => window.__cove.openChapter('notes'));
  await until(page, () => !window.__cove.rd.pending, null, 120000);
  await page.waitForTimeout(2500); await frames(2);
  await shot(page, 'fire_read'); console.log('  reading the journal');
  await page.evaluate(() => window.__cove.openChapter(null)); await frames(3);
}
if (parts.includes('van')) {
  const props = () => page.evaluate(() => { const c = Engine.dbg.camp(); return { mat: c.vanMat.visible, matAt: [c.vanMat.position.x, c.vanMat.position.z].map(v => +v.toFixed(2)), van: [c.vanGroup.position.x, c.vanGroup.position.z].map(v => +v.toFixed(2)) }; });
  const home = await props();
  /* the van closes up and drives 20 m along the beach */
  await page.evaluate(() => { const V = Layout.van; Engine.setVan({ x: V.x - 20, z: V.z + 1, heading: V.rot, k: 1, head: 0, brake: 0, roll: 0, pitch: 0, lift: 0, spin: 0, steer: 0 }); });
  await cam([home.matAt[0] + 3, 6, home.matAt[1] + 5], [home.matAt[0], 0, home.matAt[1]], 50); await frames(3);
  const away = await props(); await shot(page, 'fire_van_gone');
  ok(!away.mat, 'the doormat is packed away with the van gone: ' + JSON.stringify(away));
  /* it stops there and opens up: its things are laid out by its door */
  await page.evaluate(() => { const V = Layout.van; Engine.setVan({ x: V.x - 20, z: V.z + 1, heading: V.rot, k: 0 }); });
  const there = await props();
  ok(there.mat && Math.hypot(there.matAt[0] - there.van[0], there.matAt[1] - there.van[1]) < 4, 'set out again by the van where it stopped: ' + JSON.stringify(there));
  await cam([there.van[0] + 5, 4, there.van[1] + 6], [there.van[0], 0.5, there.van[1]], 50); await frames(3); await shot(page, 'fire_van_parked');
  /* and home again */
  await page.evaluate(() => { const V = Layout.van; Engine.setVan({ x: V.x, z: V.z, heading: V.rot, k: 0 }); });
  const back = await props(); ok(back.mat && Math.hypot(back.matAt[0] - home.matAt[0], back.matAt[1] - home.matAt[1]) < 0.05, 'and back where it was at home');
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
