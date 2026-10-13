/* The two chairs by the fire: from above, and from each chair looking across at the other (the head turned that way),
   to see how they stand to each other. node tools/chairlook.mjs [hour 15] [prefix chairs] */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 15), prefix = process.argv[3] || 'chairs';
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.7, hour });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { window.__coveDtCap = 1.0; });
await page.addStyleTag({ content: 'body > *:not(#scene) { visibility: hidden !important; }' });
/* from above */
await page.evaluate(() => { const F = Layout.fire; window.__coveCamFix = { pos: [F.x - 0.6, 7.5, F.z + 4.2], look: [F.x + 0.2, 0, F.z + 1.0], fov: 50, focus: 8 }; });
await frames(3); await shot(page, `${prefix}_above`);
await page.evaluate(() => { window.__coveCamFix = null; });
for (const [id, other] of [['chair0', 1], ['chair1', 0]]) {
  await page.evaluate(id => window.__cove.sit(Engine.seatIndex(id)), id);
  await until(page, () => window.__cove.st.camT >= 1 && performance.now() > window.__cove.seat.sitAt + 900, null, 120000);
  /* the head turned toward the other chair */
  const info = await page.evaluate(other => {
    const c = window.__cove, P = c.seat.pose, ch = Engine.dbg.camp().chairs[other], p = ch.getWorldPosition(new THREE.Vector3());
    const want = Math.atan2(p.x - P.eye[0], -(p.z - P.eye[2])), d = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw));
    /* (the app's own look: a seated head turns only so far; the pose's yaw is where the chair faces) */
    c.seat.yawT = c.seat.yaw = d; return { eye: P.eye.map(v => +v.toFixed(2)), yaw: +P.yaw.toFixed(2), want: +want.toFixed(2), turn: +d.toFixed(2), turns: c.seat.turnT };
  }, other);
  console.log(id, JSON.stringify(info));
  await frames(4); await shot(page, `${prefix}_${id}_looking`);
  await page.evaluate(() => { const c = window.__cove; c.seat.yawT = c.seat.yaw = 0; }); await frames(3); await shot(page, `${prefix}_${id}_ahead`);
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
