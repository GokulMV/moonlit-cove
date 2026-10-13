/* What the fruit round the camp costs to draw: triangles and draw calls in a frame with it and without it, from the
   camp's view and from close to the trees. node tools/orchardcost.mjs */
import { open } from './lib.mjs';
const { browser, page, logs } = await open({ w: 800, h: 500, rs: 0.5, hour: 10 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await frames(3);
  const measure = async (label, cam) => {
    const out = {};
    for (const on of [true, false]) {
      await page.evaluate(([cam, on]) => { window.__coveCamFix = cam; for (const s of Engine.orchard.sets) s.g.visible = on; const R = Engine.renderer; R.info.autoReset = false; }, [cam, on]);
      await frames(2);
      const r = await page.evaluate(() => new Promise(res => { const R = Engine.renderer; R.info.reset(); requestAnimationFrame(() => requestAnimationFrame(() => { res({ tris: R.info.render.triangles, calls: R.info.render.calls }); R.info.reset(); })); }));
      out[on ? 'with' : 'without'] = r;
    }
    console.log(`  ${label}: with ${out.with.tris} triangles in ${out.with.calls} calls, without ${out.without.tris} in ${out.without.calls} (the orchard: +${out.with.tris - out.without.tris}, +${out.with.calls - out.without.calls} calls; per two frames)`);
  };
  await measure('the camp view', null);
  await measure('by the mango', { pos: [-8, 1.7, 1], look: [-14.6, 2.5, 7.2], fov: 55, focus: 6 });
  await measure('by the rambutan', { pos: [7, 1.7, 1.5], look: [12.6, 2.5, 7.4], fov: 55, focus: 6 });
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
  await browser.close();
}
