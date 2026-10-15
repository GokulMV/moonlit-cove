/* Every mesh in the scene, its geometry looked over for normals that are not normals (NaN, or of no length) and
   positions that are not numbers: such a vertex draws black (Mats turns a colour that is not one into black). Lists
   the meshes that have any, with where they are.
   node tools/nancheck.mjs [island|coast] */
import { open } from './lib.mjs';
const isle = (process.argv[2] || 'island') === 'island';
const { browser, page, logs } = await open({ w: 640, h: 400, rs: 0.4, hour: 10, dtCap: 0.25, query: isle ? '' : '?classic' });
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const out = [], seen = new Set(); let meshes = 0, geos = 0;
    Engine.scene.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes) return; meshes++;
      const g = o.geometry; if (seen.has(g)) return; seen.add(g); geos++;
      const N = g.attributes.normal, P = g.attributes.position; let badN = 0, zeroN = 0, badP = 0, first = -1;
      if (P) for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (!(isFinite(x) && isFinite(y) && isFinite(z))) { badP++; if (first < 0) first = i; } }
      if (N) for (let i = 0; i < N.count; i++) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z); if (!isFinite(l)) { badN++; if (first < 0) first = i; } else if (l < 1e-6) { zeroN++; if (first < 0) first = i; } }
      if (badN || zeroN || badP) {
        const wp = new THREE.Vector3(); o.getWorldPosition(wp);
        let path = o.name || o.type, p = o.parent; for (let k = 0; k < 4 && p; k++, p = p.parent) path = (p.name || p.type) + '/' + path;
        out.push({ path, verts: P ? P.count : 0, badN, zeroN, badP, at: [wp.x, wp.y, wp.z].map(v => +v.toFixed(1)), mat: o.material && (o.material.name || o.material.type), first, firstPos: P && first >= 0 ? [P.getX(first), P.getY(first), P.getZ(first)].map(v => +(+v).toFixed(3)) : null });
      }
    });
    return { meshes, geos, out };
  });
  console.log(`${r.meshes} meshes, ${r.geos} geometries; ${r.out.length} with bad vertices`);
  for (const m of r.out.slice(0, 40)) console.log('  ', JSON.stringify(m));
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ').slice(0, 600) : 'no page errors');
  await browser.close();
}
