/* The camper van, for the eye: from the front corner, the door side with its awning, the back corner, close in at the
   open door, the windows, under the awning, from above. node tools/vanlook.mjs [hour 16] [prefix van] (SHOTS=a,b to
   take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 16), prefix = process.argv[3] || 'van';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 250; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0.7; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.2, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
await page.evaluate(() => { const c = window.__cove; for (let i = 0; i < 20; i++) c.filmStep(1 / 30); });
/* views in the van's own frame (x forward, y up, z out of the door side being −z), turned into the world */
const V = {
  front: { pos: [5.2, 1.5, 2.6], look: [0.3, 0.9, 0], fov: 40 },
  door: { pos: [-0.2, 1.45, -6.2], look: [-0.2, 1.0, -0.5], fov: 45 },
  back: { pos: [-5.4, 1.7, 2.9], look: [-0.5, 1.0, 0], fov: 40 },
  inside: { pos: [-0.25, 1.25, -2.1], look: [-0.35, 1.05, 0.0], fov: 50 },
  windows: { pos: [0.4, 1.5, 3.2], look: [0.1, 1.25, 0], fov: 42 },
  awning: { pos: [0.6, 0.9, -3.4], look: [-0.7, 1.75, -1.4], fov: 55 },
  top: { pos: [1.0, 6.5, -3.2], look: [0, 0.8, -0.6], fov: 45 },
  cab: { pos: [3.6, 1.6, -1.6], look: [1.6, 1.2, 0], fov: 40 },
};
const shot = async (name) => {
  if (only && !only.includes(name)) return;
  const b64 = await page.evaluate(([v]) => {
    const g = Engine.dbg.camp().vanGroup; g.updateMatrixWorld(true);
    const P = new THREE.Vector3(...v.pos), L = new THREE.Vector3(...v.look); g.localToWorld(P); g.localToWorld(L);
    window.__coveCamFix = { pos: P.toArray(), look: L.toArray(), fov: v.fov, focus: P.distanceTo(L) };
    const c = window.__cove; for (let i = 0; i < 10; i++) c.filmStep(1 / 30);
    return document.getElementById('scene').toDataURL('image/png').slice(22);
  }, [V[name]]);
  fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name);
};
for (const k of Object.keys(V)) await shot(k);
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).map(e => e.slice(0, 300)).join('\n  ') : 'no page errors');
await browser.close();
