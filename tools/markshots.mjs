/* Footprints and tyre tracks: a walk down the beach and a van's curve pressed into the sand, seen up close by day and
   from the walker's eye; the walk itself leaves prints through the page's own code; and the sea takes the ones it runs over.
   node tools/markshots.mjs [hour 9] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 9);
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.6, hour });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

/* a trail of steps and a van's curve, west of the camp, laid the way the page lays them */
const base = await page.evaluate(() => {
  const M = Engine.marks, t = window.__cove.st.t, x0 = Layout.camp.x - 26, wetOf = (x, z) => { const g = Layout.shoreDZ(x), up = (z - Layout.shoreZ(x)) / Math.sqrt(1 + g * g); return Math.max(0, Math.min(1, 1 - (up - 0.4) / 2.6)); };
  /* walking east (heading -π/2 faces +x), a step every 0.7 m, weaving a little */
  let foot = 1;
  for (let i = 0; i < 26; i++) {
    const x = x0 + i * 0.7, zc = Layout.shoreZ(x) + 3.2 + 0.4 * Math.sin(i * 0.25), h = -Math.PI / 2 - 0.08 * Math.cos(i * 0.25);
    foot = -foot; const s = foot * 0.095, px = x + Math.cos(h) * s, pz = zc - Math.sin(h) * s;
    M.foot(px, pz, h - foot * 0.09, foot < 0, wetOf(px, pz), t - (26 - i) * 0.6);
  }
  /* a van turning up the beach: four wheels on a 2.7 m wheelbase, 1.6 m track */
  const W = [[1.35, -0.8], [1.35, 0.8], [-1.35, -0.8], [-1.35, 0.8]];
  let prev = null;
  for (let a = 0; a <= 1.4; a += 0.02) {
    const cx = x0 + 4 + Math.sin(a) * 9, cz = Layout.shoreZ(x0 + 4) + 7.5 - Math.cos(a) * 9 + 9 * 0.35, h = -a;
    const c = Math.cos(h), s = Math.sin(h), wh = W.map(([lx, lz]) => [cx + lx * c + lz * s, cz - lx * s + lz * c]);
    if (prev) wh.forEach((w, i) => M.tyre(i, prev[i][0], prev[i][1], w[0], w[1], 0.19, 1, wetOf(w[0], w[1]), t));
    prev = wh;
  }
  return { x0, z0: Layout.shoreZ(x0) + 3.2, n: M.count() };
});
console.log('laid', base.n);
check(base.n.feet === 26 && base.n.tyre > 200, 'steps and ruts are pressed in');

/* close, from above and to the sea side */
await page.evaluate(([x, z]) => { const c = window.__cove; c.orbAt(x, z, 0.35, Math.log(0.12)); const o = c.orb; o.T[1] = o.v[1] = 0.66; }, [base.x0 + 7, base.z0 + 1]);
await frames(3); await shot(page, `marks_close_${hour}`);
/* from the walker's eye, looking back along the trail */
await page.evaluate(([x, z]) => { const c = window.__cove; if (!c.wk.on) c.startWalk(); const w = c.wk; w.x = x + 21; w.z = z + 0.6; w.h = w.hT = Math.PI / 2 + 0.06; w.pitchT = w.hp.v = -0.32; w.camK = 1; }, [base.x0, base.z0]);
await frames(4); await shot(page, `marks_eye_${hour}`);

/* the page's own walking leaves prints: hold W for a while */
const before = await page.evaluate(() => ({ prints: window.__cove.wk.prints, n: Engine.marks.count().feet }));
await page.evaluate(() => { window.__coveDtCap = 0.2; window.__cove.keys.add('w'); });
await frames(14);
await page.evaluate(() => { window.__cove.keys.delete('w'); window.__coveDtCap = undefined; });
const after = await page.evaluate(() => ({ prints: window.__cove.wk.prints, n: Engine.marks.count().feet }));
console.log('walking:', before, '→', after);
check(after.prints > before.prints && after.n > before.n, 'walking presses footprints in');
await page.evaluate(() => window.__cove.stopWalk());

/* the sea takes what it runs over: prints laid right at the water's edge are gone within a couple of waves */
const wash = await page.evaluate(async () => {
  const M = Engine.marks, c = window.__cove, t = c.st.t, x0 = Layout.camp.x + 40;
  M.clear();
  for (let i = 0; i < 20; i++) { const x = x0 + i * 0.7, g = Layout.shoreDZ(x), z = Layout.shoreZ(x) + 0.3 * Math.sqrt(1 + g * g); M.foot(x, z, -Math.PI / 2, i % 2 === 0, 1, t); }
  const n0 = M.count().feet;
  /* let the wave clock run on twenty seconds, a quarter second at a time */
  for (let k = 1; k <= 80; k++) M.update(t + k * 0.25, t + k * 0.25, null, Engine.swashFront);
  return { n0, n1: M.count().feet };
});
console.log('at the water\'s edge:', wash);
check(wash.n0 === 20 && wash.n1 < 8, 'the waves smooth away the prints they run over');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, errs.length ? 'page errors: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close(); process.exit(fails ? 1 : 0);
