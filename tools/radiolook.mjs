/* The radio on the side table and the two chairs by the fire: which way the radio's face turns, seen from the fire
   view, from just above the table, and from each chair with the head turned toward it; and from the striped chair
   looking straight ahead (the fire to one side, the sea and the moon ahead). node tools/radiolook.mjs [hour 22] [prefix radio] */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 22), prefix = process.argv[3] || 'radio';
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.7, hour });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { window.__coveDtCap = 1.0; });
await page.addStyleTag({ content: 'body > *:not(#scene) { visibility: hidden !important; }' });
const R = await page.evaluate(() => { const g = Engine.dbg.camp().radio.group; g.updateMatrixWorld(true);
  const p = g.getWorldPosition(new THREE.Vector3()), f = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld);
  return { p: [p.x, p.y, p.z], face: [+f.x.toFixed(3), +f.z.toFixed(3)] }; });
console.log('radio at', R.p.map(v => +v.toFixed(2)), 'its face toward', R.face);
/* the fire view, as the page frames it */
await page.evaluate(() => { const c = Layout.cameras.fire; window.__coveCamFix = { pos: c.pos, look: c.look, fov: c.fov, focus: c.focus }; });
await frames(3); await shot(page, `${prefix}_firecam`);
/* just above the table, a little out in front of the radio's face */
await page.evaluate(R => { const [x, y, z] = R.p, [fx, fz] = R.face;
  window.__coveCamFix = { pos: [x + fx * 0.9, y + 1.1, z + fz * 0.9], look: [x, y + 0.1, z], fov: 45, focus: 1.4 }; }, R);
await frames(3); await shot(page, `${prefix}_front`);
/* high above, the table and both chairs */
await page.evaluate(R => { const [x, y, z] = R.p; window.__coveCamFix = { pos: [x + 0.2, y + 4.2, z + 0.4], look: [x + 0.25, 0, z - 0.6], fov: 50, focus: 4 }; }, R);
await frames(3); await shot(page, `${prefix}_above`);
await page.evaluate(() => { window.__coveCamFix = null; });
for (const id of ['chair1', 'chair0']) {
  await page.evaluate(id => window.__cove.sit(Engine.seatIndex(id)), id);
  await until(page, () => window.__cove.st.camT >= 1 && performance.now() > window.__cove.seat.sitAt + 900, null, 120000);
  const info = await page.evaluate(R => {
    const c = window.__cove, P = c.seat.pose, want = Math.atan2(R.p[0] - P.eye[0], -(R.p[2] - P.eye[2])), d = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw));
    c.seat.yawT = c.seat.yaw = d; return { eye: P.eye.map(v => +v.toFixed(2)), yaw: +P.yaw.toFixed(2), turnToRadio: +d.toFixed(2) };
  }, R);
  console.log(id, JSON.stringify(info));
  await frames(4); await shot(page, `${prefix}_${id}_radio`);
  await page.evaluate(() => { const c = window.__cove; c.seat.yawT = c.seat.yaw = 0; }); await frames(3); await shot(page, `${prefix}_${id}_ahead`);
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
