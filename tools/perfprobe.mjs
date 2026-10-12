/* What a frame costs: triangles, draw calls, programs, textures and geometries, in a few views, once the coast round
   each has been built. node tools/perfprobe.mjs */
import { open } from './lib.mjs';
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour: 15 });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 400; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.evaluate(() => { const st = window.__cove.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; });
const views = { wide: null, coast: { pos: [10, 6, -70], look: [10, 8, 40], fov: 55, focus: 60 }, along: { pos: [60, 2.2, -6], look: [300, 14, 60], fov: 60, focus: 200 }, sea: { pos: [0, 16, -340], look: [0, 40, 300], fov: 58, focus: 400 } };
for (const [name, cam] of Object.entries(views)) {
  const r = await page.evaluate(cam => {
    window.__coveCamFix = cam; const c = window.__cove, R = Engine.dbg.renderer();
    for (let i = 0; i < 10; i++) c.filmStep(1 / 30);
    R.info.autoReset = false; R.info.reset(); c.filmStep(1 / 30); const i = R.info; const out = { calls: i.render.calls, tris: i.render.triangles, programs: i.programs.length, geos: i.memory.geometries, texs: i.memory.textures };
    R.info.autoReset = true; out.world = Engine.world.counts; return out;
  }, cam);
  console.log(name.padEnd(6), 'calls', r.calls, 'tris', (r.tris / 1e6).toFixed(2) + 'M', 'programs', r.programs, 'geometries', r.geos, 'textures', r.texs, ' chunks', r.world.chunks);
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
