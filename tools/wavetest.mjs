/* Clicked swells: one clicked far along the beach rises where it was clicked (the surf's fine mesh comes to it) and rolls
   in there; one clicked far out starts far out. Pictures of each as it comes in, from the beach.
   node tools/wavetest.mjs [hour 15] [along 70] [out 34] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 15), along = +(process.argv[3] || 70), out = +(process.argv[4] || 34);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.7, hour, dtCap: 0.5 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
/* a camera on the beach at x, looking out at the water a little to one side */
const beachCam = (x, side = -1) => page.evaluate(([x, side]) => {
  const sz = Layout.shoreZ(x), lx = x + side * 6;
  window.__coveCamFix = { pos: [x - side * 14, 2.6, sz + 7], look: [lx, 0.2, Layout.shoreZ(lx) - 16], fov: 50, focus: 22 };
}, [x, side]);
/* a click on the sea at world (x, out metres from the shore), the way the page makes one */
const clickAt = (x, s) => page.evaluate(([x, s]) => {
  const z = Layout.shoreZ(x) - s, p = Engine.project([x, 0, z]);
  return { p: p.map(v => +v.toFixed(3)), info: Engine.clickSea(p[0], p[1], window.__cove.st.t) };
}, [x, s]);
const near = () => page.evaluate(() => Array.from(Engine.dbg.ground().uniforms.uNearRect.value.toArray()).map(v => +v.toFixed(1)));
const X = await page.evaluate(a => Layout.camp.x + a, along);
await beachCam(X); await frames(2);
const c1 = await clickAt(X, out); console.log('  clicked far along the beach at x =', X.toFixed(1), JSON.stringify(c1));
ok(!!c1.info, 'the click lands on the sea');
await frames(2);
let r = await near(); console.log('  the surf mesh covers', JSON.stringify(r));
ok(r[0] < X - 20 && r[2] > X + 20, 'the fine surf is meshed round where the swell was clicked');
for (let i = 0; i < 8; i++) { await frames(2); await shot(page, `wave_far_${i}`); }
const s = await page.evaluate(() => Engine.surgeInfo()); console.log('  swells:', JSON.stringify(s));
/* one clicked far out to sea starts far out */
const X2 = await page.evaluate(() => Layout.camp.x);
await page.evaluate(() => { window.__coveCamFix = null; }); await frames(2);
const c2 = await page.evaluate(() => { const x = Layout.camp.x - 10, z = Layout.shoreZ(x) - 70, p = Engine.project([x, 0, z]); return { p, info: Engine.clickSea(p[0], p[1], window.__cove.st.t), s: 70 }; });
console.log('  clicked 70 m out:', JSON.stringify(c2.info));
ok(c2.info && c2.info.eta > 15, 'a swell clicked 70 m out starts out there (' + (c2.info && c2.info.eta.toFixed(1)) + ' s to come in)');
await beachCam(X2 - 10, 1); for (let i = 0; i < 3; i++) { await frames(3); await shot(page, `wave_out_${i}`); }
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
