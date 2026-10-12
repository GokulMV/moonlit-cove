/* How the cove looks: a set of fixed views at one hour, for judging the sky, the water, the sand and the forest.
   node tools/lookshots.mjs [hour 9] [weather clear] [views home,shallows,sky,walk,forest,water] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 9), weather = process.argv[3] || 'clear', only = (process.argv[4] || 'home,shallows,sky,walk,forest,water').split(',');
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.6, hour });
/* the weather, set at once (not eased in over minutes) */
await page.evaluate(w => { const c = window.__cove; c.st.weather = w; if (c.WX[w]) Object.assign(c.st.wx, c.WX[w]); }, weather);
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const orb = v => page.evaluate(v => { const o = window.__cove.orb; for (let i = 0; i < 5; i++) { if (v[i] === null) continue; o.T[i] = o.v[i] = v[i]; o.dv[i] = o.g[i] = 0; } o.fly = null; }, v);
const H = await page.evaluate(() => Array.from(window.__cove.orb.T));
const tag = `${hour}_${weather}`;
for (const v of only) {
  if (v === 'home') { await orb(H); await frames(3); }
  if (v === 'shallows') { await orb([0.25, 0.3, Math.log(0.4), H[3] - 14, 0.05]); await frames(3); }
  if (v === 'water') { await orb([0.1, 0.62, Math.log(0.3), H[3] + 8, 0.0]); await frames(3); }
  if (v === 'forest') { await orb([Math.PI - 0.2, 0.3, Math.log(0.9), H[3] + 30, 0.4]); await frames(3); }
  if (v === 'walk' || v === 'sky') {
    await page.evaluate(([sky]) => { const c = window.__cove; if (!c.wk.on) c.startWalk(); const w = c.wk; w.x = Layout.camp.x - 18; w.z = Layout.shoreZ(w.x) + 2.6; w.h = w.hT = sky ? 0.4 : Math.PI / 2 + 0.2; w.pitchT = w.hp.v = sky ? 0.75 : -0.12; w.camK = 1; }, [v === 'sky']);
    await frames(4);
  }
  await shot(page, `look_${v}_${tag}`);
  if (v === 'walk' || v === 'sky') await page.evaluate(() => window.__cove.stopWalk());
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
