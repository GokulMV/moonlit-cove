/* The sand castles, for the eye: the camp's own close by day (from the camp side and low from the sea side), at night by
   the lanterns, and one of those along the beach (worn, or washed by the tide).
   node tools/castlelook.mjs [hour 10] [prefix castle] (SHOTS=a,b to take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'castle';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 300; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.2, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.__cove.filmStep(1 / 30); }, n);
const snap = async name => { if (only && !only.includes(name)) return; const b64 = await page.evaluate(() => { window.__cove.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
const cam = (pos, look, fov = 40) => page.evaluate(([pos, look, fov]) => { window.__coveCamFix = { pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) }; }, [pos, look, fov]);
const C = await page.evaluate(() => ({ x: Layout.castle.x, z: Layout.castle.z, r: Layout.castle.radius }));
console.log('  camp castle', C);
await step(6);
await cam([C.x + 0.9, 1.05, C.z + 1.7], [C.x, 0.12, C.z], 38); await step(3); await snap('camp');
await cam([C.x - 1.3, 0.38, C.z - 1.25], [C.x, 0.16, C.z], 36); await step(2); await snap('low');
await cam([C.x + 0.15, 0.55, C.z + 0.62], [C.x, 0.2, C.z], 30); await step(2); await snap('close');
/* one along the beach */
const B = await page.evaluate(() => { const L = Engine.shacks.castleSites(); return L.sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0] || null; });
console.log('  beach castle', B);
if (B) {
  await page.evaluate(B => { window.__coveCamFix = { pos: [B.x + 2.5, 1.6, B.z + 2.6], look: [B.x, 0.15, B.z], fov: 36, focus: 3.8 }; }, B);
  for (let i = 0; i < 40; i++) { await step(4); const ok = await page.evaluate(() => Engine.world.counts.built); if (i > 6 && ok) break; }
  await step(4); await snap('beach');
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
