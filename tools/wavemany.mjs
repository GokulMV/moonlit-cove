/* Many swells at once, with no limit: twenty clicked in twenty places along the beach in quick succession are all on
   their way in (none dropped to make room) and the shaders draw every one; twenty more on top of those, the same; the
   fine surf mesh sits round as many of them as it holds. node tools/wavemany.mjs [hour 15] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 15);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.6, hour, dtCap: 0.25 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
/* a camera up the beach, looking out to sea over a long stretch of it */
await page.evaluate(() => {
  const x = Layout.camp.x, sz = Layout.shoreZ(x);
  window.__coveCamFix = { pos: [x, 22, sz + 30], look: [x, 0, sz - 40], fov: 75, focus: 40 };
});
await frames(2);
const burst = (from, n, out) => page.evaluate(([from, n, out]) => {
  const r = [];
  for (let i = 0; i < n; i++) {
    const x = Layout.camp.x + from + i * 15, z = Layout.shoreZ(x) - out, p = Engine.project([x, 0, z]);
    const info = Engine.clickSea(p[0], p[1], window.__cove.st.t); r.push(info ? +info.x.toFixed(1) : null);
  }
  return r;
}, [from, n, out]);
const r1 = await burst(-142.5, 20, 30);
console.log('  twenty clicks along the beach at x =', JSON.stringify(r1));
ok(r1.every(v => v != null), 'all twenty clicks land on the sea');
let s = await page.evaluate(() => Engine.surgeInfo());
ok(s.pending.length === 20, `all twenty swells are on their way in (${s.pending.length})`);
await frames(1);
let g = await page.evaluate(() => { const u = Engine.dbg.ground().uniforms; return { n: u.uNUw.value, max: +u.uUwMax.value.toFixed(2), near: Array.from(u.uNearRect.value.toArray()).map(v => +v.toFixed(1)) }; });
ok(g.n === 20, 'and the shaders are given all twenty: ' + JSON.stringify(g));
const inMesh = await page.evaluate(() => { const r = Engine.dbg.ground().uniforms.uNearRect.value; return Engine.surgeState().waves.filter(w => w.xc > r.x + 40 && w.xc < r.z - 40).length; });
console.log(`  the fine surf mesh sits round ${inMesh} of them (the rest roll in on the open sea's own surface)`);
ok(inMesh >= 5, 'the fine mesh sits round as many as it holds');
await shot(page, 'wave_many_0');
/* twenty more, further out, five seconds on (soon enough after a click, near enough, and the two stack into one taller
   swell instead: that is the swell building, not a limit), while the first twenty are still coming in */
await page.evaluate(() => { window.__cove.st.t += 5; });
const r2 = await burst(-135, 20, 45);
ok(r2.every(v => v != null), 'twenty more clicks land too');
s = await page.evaluate(() => Engine.surgeInfo());
ok(s.pending.length === 40, `forty swells on their way in at once (${s.pending.length})`);
await frames(1);
g = await page.evaluate(() => { const u = Engine.dbg.ground().uniforms; return { n: u.uNUw.value }; });
ok(g.n === 40, 'and the shaders are given all forty: ' + JSON.stringify(g));
for (let i = 1; i < 5; i++) { await frames(4); await shot(page, `wave_many_${i}`); }
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
