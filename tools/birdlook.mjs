/* The camp's butterflies and the sandpipers, for the eye: a butterfly close by through a few frames of its beat (a strip of
   shots, to see the wings go up and down), then a flock of sandpipers before, during and after it is put up.
   node tools/birdlook.mjs [hour 10] [prefix bird] (SHOTS=a,b to take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'bird';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 960, h: 540, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 300; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.2, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const step = (n, dt = 1 / 30) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__cove.filmStep(dt); }, [n, dt]);
const snap = async (name, dt = 1 / 30) => { if (only && !only.includes(name.replace(/\d+$/, ''))) return; const b64 = await page.evaluate(dt => { window.__cove.filmStep(dt); return document.getElementById('scene').toDataURL('image/png').slice(22); }, dt); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
await step(8);
/* a butterfly: the camera kept beside it, a strip of frames 1/60 s apart */
for (let f = 0; f < 6; f++) {
  await page.evaluate(() => { const b = Engine.fx.butterflies.find(b => b.g.visible) || Engine.fx.butterflies[0], p = b.g.position, y = b.g.rotation.y;
    window.__coveCamFix = { pos: [p.x + Math.sin(y) * 0.55 - Math.cos(y) * 0.2, p.y + 0.12, p.z + Math.cos(y) * 0.55 + Math.sin(y) * 0.2], look: [p.x, p.y, p.z], fov: 30, focus: 0.6 }; });
  await snap('bfly' + f, 1 / 60);
}
/* sandpipers: find a flock, look at it, then walk the threat at it */
const fl = await page.evaluate(() => { const P = Engine.fauna.debug.pipers, f = P.F.findIndex(f => f.mode === 'feed'); if (f < 0) return null; const b = P.B[f * 7]; return { f, x: b.x, z: Layout.shoreZ(b.x) + b.r }; });
console.log('  flock', fl);
if (fl) {
  await page.evaluate(F => { window.__coveCamFix = { pos: [F.x - 5, 1.6, F.z + 6], look: [F.x, 0.2, F.z], fov: 40, focus: 7 }; }, fl);
  await step(4); await snap('feed');
  await page.evaluate(F => { Engine.fauna.debug.pipers.F[F.f].alarm = F.x - 6; }, fl);
  for (const [n, k] of [[0.2, 'up0'], [0.35, 'up1'], [0.6, 'up2'], [1.0, 'fly0'], [1.5, 'fly1']]) { await step(Math.round(n * 30)); await page.evaluate(F => { const P = Engine.fauna.debug.pipers, B = P.B.slice(F.f * 7, F.f * 7 + 5); const x = B.reduce((s, b) => s + b.x, 0) / B.length; const z = B.reduce((s, b) => s + Layout.shoreZ(b.x) + b.r, 0) / B.length; window.__coveCamFix = { pos: [x - 6, 2.2, z + 7], look: [x, 0.6, z], fov: 42, focus: 9 }; }, fl); await snap(k); }
  for (let i = 0; i < 12; i++) { await step(30); const m = await page.evaluate(F => Engine.fauna.debug.pipers.F[F.f].mode, fl); if (m !== 'fly') break; }
  await page.evaluate(F => { const P = Engine.fauna.debug.pipers, f = P.F[F.f]; window.__coveCamFix = { pos: [f.x - 5, 1.6, Layout.shoreZ(f.x) + 6], look: [f.x, 0.2, Layout.shoreZ(f.x) + 0.8], fov: 40, focus: 7 }; }, fl);
  await snap('landed');
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
