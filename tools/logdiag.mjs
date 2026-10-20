/* Why the driftwood log by the fire looks black from its root end: the view along it from the camp, then the same
   with one thing at a time taken off its material (its normal map, its shadow, its texture), each a shot.
   node tools/logdiag.mjs */
import { open } from './lib.mjs';
import path from 'path';
const { browser, page, logs } = await open({ w: 800, h: 450, rs: 1, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#homeBar, #hint, #hud .brand, #hud .dock, #hud .ctrl, #hud .sky, #hud .fsbtn, #spots { display: none !important; }' });
  await page.evaluate(() => { window.__coveCamFix = { pos: [3.4, 1.0, -6.4], look: [6.4, 0.2, -6.0], fov: 40, focus: 3.2 }; });
  await frames(10);
  /* (the log's meshes: the driftwood group is the one with a 2.6 m trunk lying along x by the fire) */
  const found = await page.evaluate(() => {
    const L = []; Engine.scene.traverse(o => { if (o.isMesh && o.material && o.material.normalMap && o.material.map && o.geometry.attributes.position.count > 9000 && o.geometry.attributes.position.count < 12000) { const p = new THREE.Vector3(); o.getWorldPosition(p); if (Math.hypot(p.x - 7, p.z + 6.05) < 2) L.push(o); } });
    window.__log = L; return L.map(o => ({ v: o.geometry.attributes.position.count, mat: o.material.type, key: o.material.customProgramCacheKey && o.material.customProgramCacheKey(), cast: o.castShadow, recv: o.receiveShadow }));
  });
  console.log('log meshes:', JSON.stringify(found));
  const px = async name => {
    await frames(6); const f = path.join('shots', `logdiag_${name}.png`); await page.screenshot({ path: f, timeout: 240000 });
    /* (the colour at the root end, in the middle of the view, and a little up the log) */
    const c = await page.evaluate(() => { const R = Engine.renderer, gl = R.getContext(); return null; });
    console.log('  shot', name);
  };
  await px('as_is');
  await page.evaluate(() => { for (const o of window.__log) { o.userData.nm = o.material.normalMap; o.material.normalMap = null; o.material.needsUpdate = true; } });
  await px('no_normalmap');
  await page.evaluate(() => { for (const o of window.__log) { o.material.normalMap = o.userData.nm; o.material.needsUpdate = true; o.receiveShadow = false; } });
  await px('no_shadow');
  await page.evaluate(() => { for (const o of window.__log) { o.receiveShadow = true; o.userData.mp = o.material.map; o.material.map = null; o.material.needsUpdate = true; } });
  await px('no_map');
  await page.evaluate(() => { for (const o of window.__log) { o.material.map = o.userData.mp; o.material.vertexColors = false; o.material.needsUpdate = true; } });
  await px('no_vcol');
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ').slice(0, 600) : 'no page errors');
  await browser.close();
}
