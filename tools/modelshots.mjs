/* One model on its own: made with Models.make, stood on clean sand a little way along the beach, and shot from a few
   sides at an hour of your choosing (lit by the scene's own sun or moon, and the fire if it is near).
   node tools/modelshots.mjs <name> [hour 16] [size 1]   e.g. node tools/modelshots.mjs camp/guitar 16 1.1
   Shots go to shots/model_<name>_<n>.png. With no name it lists the models. */
import { open, shot } from './lib.mjs';
const name = process.argv[2], hour = +(process.argv[3] || 16), size = +(process.argv[4] || 1);
const { browser, page, logs } = await open({ w: 1100, h: 760, rs: 0.8, hour });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
if (!name) { console.log((await page.evaluate(() => Models.list())).join('\n')); await browser.close(); process.exit(0); }
const info = await page.evaluate(([name]) => {
  const o = Models.make(name), x = Layout.camp.x - 14, z = Layout.shoreZ(Layout.camp.x - 14) + 6.5;
  o.position.set(x, 0, z); Engine.scene.add(o); o.updateMatrixWorld(true);
  /* stood on the sand */
  { const b0 = new THREE.Box3().setFromObject(o); o.position.y -= b0.min.y; o.updateMatrixWorld(true); }
  const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  window.__model = { o, c: c.toArray(), s: s.toArray() };
  return { centre: c.toArray().map(v => +v.toFixed(3)), size: s.toArray().map(v => +v.toFixed(3)) };
}, [name]);
console.log(name, info);
/* the camera fixed on it from each side (the page's test hook) */
const views = [[0.35, 0.18], [1.9, 0.25], [-1.2, 0.5], [0.0, 1.25]];
for (let i = 0; i < views.length; i++) {
  const [az, el] = views[i];
  await page.evaluate(([az, el, size]) => {
    const M = window.__model, d = Math.max(...M.s) * 1.25 * size + 0.15;
    const pos = [M.c[0] + Math.sin(az) * Math.cos(el) * d, M.c[1] + Math.sin(el) * d, M.c[2] + Math.cos(az) * Math.cos(el) * d];
    window.__coveCamFix = { pos, look: M.c.slice(), fov: 40, focus: d };
  }, [az, el, size]);
  await frames(3);
  await shot(page, `model_${name.replace(/\//g, '_')}_${i}`);
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
