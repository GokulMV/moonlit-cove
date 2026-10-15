/* The island's boulders, looked at: the biggest few near the camp, where each is, and whether the stones near the eye
   are drawn (stones.js's counts), from a walker's eyes a few metres off and from a little higher.
   node tools/stonecheck.mjs [prefix st] */
import { open } from './lib.mjs';
import path from 'path';
const prefix = process.argv[2] || 'st';
const { browser, page, logs } = await open({ w: 960, h: 540, rs: 0.8, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#walkHud, #walkBar, #hint, #hud .brand, #hud .dock, #hud .ctrl, #hud .sky, #hud .fsbtn, #spots, #hud .minimap { display: none !important; }' });
  const L = await page.evaluate(() => { const S = Engine.world.stones, C = Layout.camp; return S.all.filter(s => !s.brook && s.s > 1.4).map(s => ({ x: +s.x.toFixed(1), y: +s.y.toFixed(2), z: +s.z.toFixed(1), s: +s.s.toFixed(2), p: s.p, d: +Math.hypot(s.x - C.x, s.z - C.z).toFixed(0), sea: +Layout.Shore.at(s.x, s.z, {}).s.toFixed(1) })).sort((a, b) => a.d - b.d).slice(0, 5); });
  console.log('nearest big stones:', JSON.stringify(L));
  for (const [i, st] of L.slice(0, 2).entries()) {
    /* (from the land side, a few stone-widths off, at a walker's height and a little above) */
    const q = await page.evaluate(([x, z]) => { const q = Layout.Shore.at(x, z, {}); return [q.nx, q.nz]; }, [st.x, st.z]);
    for (const [tag, back, up] of [['eye', 3.2, 1.6], ['high', 5, 5]]) {
      const d = st.s * back + 2, cx = st.x - q[0] * d, cz = st.z - q[1] * d;
      const y = await page.evaluate(([x, z]) => Math.max(Engine.world.land(x, z), 0), [cx, cz]);
      await page.evaluate(c => { window.__coveCamFix = c; Engine.world.prime(c.pos[0], c.pos[2], c.pos[1], true); }, { pos: [cx, y + up, cz], look: [st.x, st.y + st.s * 0.5, st.z], fov: 55, focus: d });
      await frames(12);
      const info = await page.evaluate(() => Engine.world.stones.stats());
      console.log(`stone ${i} ${tag}: ${JSON.stringify(info)}`);
      await page.screenshot({ path: path.join('shots', `${prefix}_${i}_${tag}.png`), timeout: 240000 });
    }
  }
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ').slice(0, 600) : 'no page errors');
  await browser.close();
}
