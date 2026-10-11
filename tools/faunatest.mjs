/* Wildlife check: node tools/faunatest.mjs [night|dusk|day]. Night: fireflies along the treeline away from the camp,
   a ghost crab, the van 150 m down the coast. Dusk: a midge swarm, bats overhead. Day: sandpipers at the swash, gulls
   standing (then lifting off before the van), a dolphin pod, the Animals and Insects sliders at 0 and 1. Shots go to
   shots/fauna_*.png, with the live counts printed beside each. */
import { open, shot, until } from './lib.mjs';
const which = process.argv[2] || 'night', hour = { night: 23, dusk: 17, day: 13 }[which];
const { browser, page } = await open({ w: 960, h: 600, rs: 0.6, hour });
/* a frame counter, and a camera the test can hold where it wants */
await page.evaluate(() => {
  window.__fc = 0; window.__cam = null; window.__cove.st.rs = 0.55;
  const r = Engine.render; Engine.render = o => { window.__fc++; return r(window.__cam ? Object.assign({}, o, { cam: window.__cam }) : o); };
});
const frames = async n => { const f = await page.evaluate(() => window.__fc); await until(page, t => window.__fc >= t, f + n, 300000); };
const counts = () => page.evaluate(() => JSON.stringify(Engine.fauna.counts));
const view = async (name, c, n = 2) => { await page.evaluate(c => { window.__cam = c; }, c); await frames(n); await shot(page, 'fauna_' + name); console.log(name.padEnd(16), await counts()); };
const coast = x => page.evaluate(x => [Layout.shoreZ(x), Layout.vegZ(x)], x);
const F = (expr) => page.evaluate(expr);

if (which === 'night') {
  const [s40] = await coast(40), [, v90] = await coast(90);
  await view('night_treeline', { pos: [40, 1.8, s40 + 4], look: [90, 1.0, v90 - 1], fov: 55, focus: 25 }, 6);
  const c = await F(() => { const C = Engine.fauna.debug.crabs.C.find(c => c.st === 'still' || c.st === 'run'); return C ? [C.x, C.z] : null; });
  if (c) await view('night_crab', { pos: [c[0] - 3.5, 3.4, c[1] + 3.5], look: [c[0], 0.03, c[1]], fov: 14, focus: 5 }, 1);
  await page.evaluate(() => { window.__cam = null; const c = window.__cove; c.startDrive(); Object.assign(c.car, { x: 150, z: Layout.shoreZ(150) + 3.2, h: 0, v: 0 }); });
  await frames(8); await shot(page, 'fauna_night_van150'); console.log('night_van150'.padEnd(16), await counts());
}
if (which === 'dusk') {
  const s = await F(() => { const S = Engine.fauna.debug.gnats.S; for (let j = 0; j < 14; j++) if (S[j * 160]) return [S[j * 160], S[j * 160 + 1], S[j * 160 + 2]]; return null; });
  if (s) await view('dusk_midges', { pos: [s[0] + 1.2, s[1] - 0.4, s[2] + 3.8], look: [s[0], s[1] + 0.1, s[2]], fov: 36, focus: 3.8 }, 3);
  const h = await F(() => { const A = Engine.fauna.debug.bats.A.iH; return [A[0], A[1], A[2]]; });
  await view('dusk_bats', { pos: [h[0], Math.max(0.5, h[1] - 3.2), h[2]], look: [h[0] + 0.02, h[1] + 5, h[2] + 0.01], fov: 110, focus: 4 });
}
if (which === 'day') {
  await view('day_wide', null, 3);
  /* the sliders, from one view along the beach and out over the surf: 1, then 0, then back to where they were */
  const V = { pos: [1.5, 3.4, -2.5], look: [32, 2.2, -10], fov: 62, focus: 18 };
  for (const k of [1, 0, 0.5]) { await page.evaluate(k => Object.assign(window.__cove.st.dens, { animals: k, insects: k }), k); await view('day_density' + k, V, 3); }
  const p = await F(() => { const P = Engine.fauna.debug.pipers, i = P.F.findIndex(f => f.mode === 'feed'); if (i < 0) return null; const b = P.B[i * 7]; return [b.x, Layout.shoreZ(b.x)]; });
  if (p) await view('day_sandpipers', { pos: [p[0] - 1.5, 3.4, p[1] + 6.5], look: [p[0], 0.05, p[1] + 0.5], fov: 24, focus: 6 });
  const b = await F(() => { const A = Engine.fauna.debug.butter.A.iH; let best = null; for (let i = 0; i < 15; i++) if (A[i * 4] && (!best || Math.abs(A[i * 4] - 25) < Math.abs(best[0] - 25))) best = [A[i * 4], A[i * 4 + 1], A[i * 4 + 2]]; return best; });
  if (b) await view('day_butterflies', { pos: [b[0] - 3, 1.5, b[2] - 4.5], look: [b[0], b[1], b[2]], fov: 50, focus: 5 });
  const f = await F(() => { const A = Engine.fauna.debug.dragon.A.iH; return [A[0], A[1], A[2]]; });
  await view('day_dragonfly', { pos: [f[0] + 2.2, 1.5, f[2] - 2.2], look: [f[0], f[1] + 1.0, f[2]], fov: 55, focus: 3 });
  await page.evaluate(() => Engine.fauna.pod(0));
  await frames(6);
  const d = await F(() => { const p = Engine.fauna.debug.dolphins.pod; return [p.x, Layout.shoreZ(p.x) - p.off]; });
  await view('day_dolphins', { pos: [d[0] + 2, 4, d[1] + 22], look: [d[0] - 3, 0.2, d[1]], fov: 30, focus: 22 }, 2);
  /* last, as the van may knock the camp about on its way: a group of standing gulls, and the van driving at them */
  const g = await F(() => { const G = Engine.fauna.debug.gulls.L.find(g => g.mode === 'stand'); return G ? [G.x, G.z] : null; });
  if (g) {
    await view('day_gulls', { pos: [g[0] + 3, 3.4, g[1] + 7], look: [g[0], 0.3, g[1]], fov: 26, focus: 7 });
    await page.evaluate(g => { const c = window.__cove; c.startDrive(); Object.assign(c.car, { x: g[0] - 30, z: Layout.shoreZ(g[0] - 30) + 3.5, h: 0, v: 8 }); c.keys.add('w'); }, g);
    await view('day_gulls_lift', { pos: [g[0] + 8, 4.5, g[1] + 12], look: [g[0] - 3, 1.5, g[1]], fov: 55, focus: 12 }, 4);
    console.log('gull modes', await F(() => Engine.fauna.debug.gulls.L.map(g => g.mode).join(' ')));
  }
}
await browser.close();
