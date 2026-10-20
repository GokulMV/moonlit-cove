/* The explore camera round the island, as on a map: the point set down anywhere (on the sand along the shore, over the
   forest, on the hill, out at sea, up a mangrove creek), held over whatever is there, the camera clear of the trees;
   moved by a drag the way the ground goes under the hand; zoomed right out and tipped up (the island as a map); and
   home again, exactly the home view.
   node tools/isleorbit.mjs [prefix io] */
import { open } from './lib.mjs';
import path from 'path';
const prefix = process.argv[2] || 'io';
const { browser, page, logs } = await open({ w: 1100, h: 640, rs: 0.6, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = name => page.screenshot({ path: path.join('shots', `${prefix}_${name}.png`), timeout: 240000 });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
try {
  await page.addStyleTag({ content: '#homeBar, #hint, #hud .brand, #spots { display: none !important; }' });
  /* (the way in over: the camera come to the home view) */
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 }); await frames(8);
  /* (how the view stands: the point, the camera over the top of what is under it, the top under the point) */
  const look = () => page.evaluate(() => {
    const o = window.__cove.orb, c = Engine.camera.position, W = Engine.world, top = W.shade.top;
    let clear = 1e9; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2, r = i ? 2.5 : 0; clear = Math.min(clear, c.y - top(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r)); }
    return { px: +o.px.toFixed(1), pz: +o.pz.toFixed(1), py: +o.py.toFixed(1), top: +top(o.px, o.pz).toFixed(1), cam: [c.x, c.y, c.z].map(v => +v.toFixed(1)), clear: +clear.toFixed(1), el: +o.el.toFixed(2) };
  });
  const H0 = await page.evaluate(() => { const c = Engine.camera.position, V = Layout.cameras.wide; return Math.hypot(c.x - V.pos[0], c.y - V.pos[1], c.z - V.pos[2]); });
  ok(H0 < 0.05, `at home the view is the home view (${H0.toFixed(3)} m off)`);
  /* the places: along the shore either way, the forest behind it, the hill, the sea, the creek */
  const P = await page.evaluate(() => {
    const S = Layout.Shore, a0 = S.at(Layout.camp.x, Layout.camp.z).a, G = Layout.island().data.grid, out = {};
    const pt = (a, s) => { const q = S.pt(a, s, {}); return [q.x, q.z]; };
    out.beach300 = pt(a0 + 300, -4); out.beach900 = pt(a0 - 900, -4); out.forest = pt(a0 + 300, -120); out.sea = pt(a0 + 600, 140);
    let hi = -1, hc = 0; for (let c = 0; c < G.H.length; c += 7) if (G.H[c] > hi) { hi = G.H[c]; hc = c; }
    out.hill = [G.X0 + ((hc % G.nx) + 0.5) * G.cell, G.Z0 + (Math.floor(hc / G.nx) + 0.5) * G.cell];
    /* (a creek's mouth: the shore where it says there is one) */
    const L = Layout.island().data.line; for (let i = 0; i < L.n; i += 4) if (L.CREEK[i] >= 0) { out.creek = [L.X[i], L.Z[i]]; break; }
    return out;
  });
  for (const [name, [x, z]] of Object.entries(P)) {
    await page.evaluate(([x, z]) => { const o = window.__cove.orb; o.fly = null; o.T[3] = o.v[3] = x; o.T[4] = o.v[4] = z; o.dv.fill(0); o.g.fill(0); }, [x, z]);
    await page.evaluate(([x, z]) => Engine.world.prime(x, z, 30, true), [x, z]);
    await frames(14);
    const L = await look();
    console.log(`   ${name}:`, JSON.stringify(L));
    ok(Math.hypot(L.px - x, L.pz - z) < 0.5, `${name}: the point is where it was set down`);
    ok(L.clear > 1.5, `${name}: the camera is clear of the trees and the ground (${L.clear} m)`);
    await shot(name);
  }
  /* a drag with the right button moves the point over the ground, whichever way */
  await page.evaluate(([x, z]) => { const o = window.__cove.orb; o.T[3] = o.v[3] = x; o.T[4] = o.v[4] = z; o.dv.fill(0); o.g.fill(0); }, P.beach300);
  await frames(4);
  const before = await look();
  await page.mouse.move(550, 400); await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 10; i++) { await page.mouse.move(550 - i * 12, 400 + i * 8); await frames(1); }
  await page.mouse.up({ button: 'right' }); await frames(20);
  const after = await look();
  const moved = Math.hypot(after.px - before.px, after.pz - before.pz);
  ok(moved > 5, `a right-drag moves the point (${moved.toFixed(1)} m)`);
  /* right out, and tipped up: the island as a map */
  await page.evaluate(() => { const o = window.__cove.orb; o.T[2] = o.v[2] = Math.log(7); o.T[1] = o.v[1] = 1.32; o.dv.fill(0); });
  await frames(14); await shot('far'); console.log('   far:', JSON.stringify(await look()));
  /* and home */
  await page.evaluate(() => window.__cove.orbHome()); await frames(90);
  const H = await page.evaluate(() => { const c = Engine.camera.position, V = Layout.cameras.wide; return Math.hypot(c.x - V.pos[0], c.y - V.pos[1], c.z - V.pos[2]); });
  ok(H < 0.5, `home again: the camera at the home view (${H.toFixed(2)} m off)`);
  await shot('home');
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
