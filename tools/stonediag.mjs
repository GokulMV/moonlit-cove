/* Where the boulders by the camp's beach are, and what of them is drawn: the stones listed near a point, the near
   instanced meshes' counts and the first instances' places, the shapes' sizes, whether their programs compiled.
   node tools/stonediag.mjs */
import { open } from './lib.mjs';
import path from 'path';
const { browser, page, logs } = await open({ w: 800, h: 450, rs: 0.6, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  await page.evaluate(() => { window.__coveCamFix = { pos: [104, 2.2, -6], look: [112.5, 0.6, -13.3], fov: 55, focus: 10 }; Engine.world.prime(104, -6, 2, true); });
  await frames(14);
  const r = await page.evaluate(() => {
    const S = Engine.world.stones, near = S.near(112.5, -13.3, 12).map(st => ({ x: +st.x.toFixed(1), y: +st.y.toFixed(2), z: +st.z.toFixed(1), s: +st.s.toFixed(2), p: st.p }));
    const g = Engine.scene.getObjectByName('stones'), ims = [];
    if (g) g.children.forEach((m, i) => { if (m.isInstancedMesh && m.count > 0 && m.visible) { const M = new THREE.Matrix4(), P = new THREE.Vector3(); const first = []; for (let k = 0; k < Math.min(3, m.count); k++) { m.getMatrixAt(k, M); P.setFromMatrixPosition(M); first.push([+P.x.toFixed(1), +P.y.toFixed(2), +P.z.toFixed(1)]); } ims.push({ i, count: m.count, mat: m.material.customProgramCacheKey ? m.material.customProgramCacheKey() : m.material.type, first, verts: m.geometry.attributes.position.count }); } });
    const progs = (Engine.renderer.info.programs || []).map(p => p.name || p.cacheKey).filter(n => /rock|gran/i.test(n || ''));
    const bb = S.protos.map(P => { P[0].computeBoundingBox(); const b = P[0].boundingBox; return [+b.min.y.toFixed(2), +b.max.y.toFixed(2)]; });
    return { near, ims: ims.slice(0, 20), nIms: ims.length, progs, bb, group: !!g, visible: g ? g.visible : null };
  });
  console.log(JSON.stringify(r, null, 1).slice(0, 4000));
  await page.screenshot({ path: path.join('shots', 'stonediag.png'), timeout: 240000 });
} finally {
  const errs = logs.filter(l => /\[(error|pageerror|warning)\]/.test(l)); console.log(errs.length ? 'page messages: ' + errs.slice(0, 5).join(' | ').slice(0, 1500) : 'no page errors');
  await browser.close();
}
