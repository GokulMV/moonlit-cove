/* Pitching camp somewhere new: the van is parked far down the coast, Pitch camp here is pressed, the screen dims, the
   coast moves under the camp, and the camp goes up again one thing at a time. node tools/pitchtest.mjs */
import { open, shot, wait, until } from './lib.mjs';
const { browser, page, logs } = await open({ w: 960, h: 600, rs: 0.4 });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
/* a stretch of beach that takes the camp, some way east */
const spot = await page.evaluate(() => {
  const C = window.__cove;
  for (let x = 330; x < 2400; x += 15) { const z = Layout.shoreZ(x) + 4.5, r = C.pitchSpot({ x, z, heading: 0 }); if (r.ok) return { x, z }; }
  return null;
});
console.log('a spot that takes the camp:', spot);
check(!!spot, 'found a beach wide enough to pitch on');
/* drive there (put the van down) and park */
await page.evaluate(([x, z]) => { const C = window.__cove, c = C.car; C.startDrive(); Object.assign(c, { x, z, h: 0, v: 0, k: 1, camK: 1 }); Engine.world.update(x, 1e9); }, [spot.x, spot.z]);
await frames(2);
await page.evaluate(() => window.__cove.stopDrive());
await until(page, () => window.__cove.car.k <= 0 && window.__cove.car.camK <= 0, null, 120000);
await until(page, () => !document.getElementById('bPitch').hidden, null, 60000).catch(() => {});
const shown = await page.evaluate(() => !document.getElementById('bPitch').hidden);
check(shown, 'Pitch camp here is offered by the parked van');
await shot(page, 'pitch_0_parked');
const before = await page.evaluate(() => ({ O: { ...Layout.O }, van: Engine.vanPose() }));
await page.evaluate(() => { window.__covePitchT = 0; const b = document.getElementById('bPitch'); if (!b.hidden) b.click(); else window.__cove.startPitch(); });
await until(page, () => Engine.pitching, null, 60000);
const after = await page.evaluate(() => ({ O: { ...Layout.O }, van: Engine.vanPose(), ver: Layout.coastVer }));
console.log('origin', before.O, '→', after.O, '· van', before.van, '→', after.van);
check(Math.abs((after.O.x + after.van.x) - (before.O.x + before.van.x)) < 0.01, 'the van stays at the same place on the coast');
/* held at moments of the pitch, to see each thing go up */
for (const t of [1.5, 2.4, 3.6, 4.6, 5.6, 6.8]) { await page.evaluate(t => { window.__covePitchT = t; }, t); await frames(2); await shot(page, 'pitch_t' + String(t).replace('.', '_')); }
await page.evaluate(() => { window.__covePitchT = undefined; });
await until(page, () => !Engine.pitching && !window.__cove.pitchS.on, null, 120000);
await frames(3); await shot(page, 'pitch_3_pitched');
const end = await page.evaluate(() => {
  const c = window.__cove, w = Layout.cameras.wide, cur = c.st.cur;
  const homeD = Math.max(...cur.pos.map((v, i) => Math.abs(v - w.pos[i])));
  const S = Layout.shoreZ(Layout.camp.x), V = Layout.vegZ(Layout.camp.x);
  return { homeD, shore: S, veg: V, rock: Engine.world.massif(Layout.camp.x, Layout.camp.z), counts: Engine.world.counts };
});
console.log('after:', JSON.stringify(end));
check(end.homeD < 1e-6, 'the camera is at the camp, in the home view');
check(end.rock <= 0, 'no rock under the camp');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, errs.length ? 'page errors: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close();
process.exit(fails ? 1 : 0);
