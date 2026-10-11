/* Screenshots of the people of the coast: the nearest shack, row of huts and fishing spot each way, at night and by
   day, from the explore camera set down in front of them.   node tools/shackshots.mjs [hour] */
import { open, shot, wait, until } from './lib.mjs';
const hour = +(process.argv[2] || 23);
const { browser, page, logs } = await open({ w: 960, h: 600, rs: 0.5, hour });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
/* build the coast for 700 m each way so there are sites to find */
const sites = await page.evaluate(() => { for (const x of [-700, -350, 0, 350, 700]) Engine.world.update(x, 1e9); return Engine.shacks.sites(); });
console.log('sites:', sites.map(s => `${s.kind}@${s.x.toFixed(0)}`).join(', '), '· built', await page.evaluate(() => Engine.shacks.count));
const pick = [];
for (const kind of ['shack', 'huts', 'fishing']) { const L = sites.filter(s => s.kind === kind).sort((a, b) => Math.abs(a.x) - Math.abs(b.x)); if (L[0]) pick.push(L[0]); }
for (const s of pick) {
  await page.evaluate(([x]) => {
    const o = window.__cove.orb; Engine.world.update(x, 1e9);
    const T = [Math.PI - 0.25, 0.42, Math.log(0.6), x, 0.55]; for (let i = 0; i < 5; i++) { o.T[i] = o.v[i] = T[i]; o.dv[i] = o.g[i] = 0; } o.fly = null;
  }, [s.x]);
  await frames(4);
  await shot(page, `shack_${s.kind}_${hour}`);
  /* and closer, from the sand in front */
  await page.evaluate(([x]) => { const o = window.__cove.orb, T = [Math.PI + 0.4, 0.2, Math.log(0.34), x, 0.5]; for (let i = 0; i < 5; i++) { o.T[i] = o.v[i] = T[i]; o.dv[i] = o.g[i] = 0; } }, [s.x]);
  await frames(4);
  await shot(page, `shack_${s.kind}_${hour}_close`);
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 8).join('\n  ') : 'no page errors', '·', JSON.stringify(await page.evaluate(() => Engine.world.counts)));
await browser.close();
