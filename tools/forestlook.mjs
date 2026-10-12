/* The forest, for the eye: the camp's wide view, the forest edge from the sand, the coast from out at sea, a tree up
   close, the grass and the flowers at the edge. node tools/forestlook.mjs [hour 15] [prefix forest] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 15), prefix = process.argv[3] || 'forest';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 250; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0.7; st.flow = 1; c.WX.__t = { cirrus: 0.15, alto: 0, cumulus: 0.5, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const shot = async (name, cam, n = 8) => {
  if (only && !only.includes(name)) return;
  const b64 = await page.evaluate(([cam, n]) => { window.__coveCamFix = cam; const c = window.__cove; for (let i = 0; i < n; i++) c.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }, [cam, n]);
  fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name);
};
const P = await page.evaluate(() => ({ cx: Layout.camp.x, cz: Layout.camp.z, vz: Layout.vegZ(Layout.camp.x + 30), sz: Layout.shoreZ(Layout.camp.x) }));
await page.evaluate(() => { window.__coveCamFix = null; }); await page.evaluate(() => { const c = window.__cove; for (let i = 0; i < 6; i++) c.filmStep(1 / 30); });
await shot('wide', null);
await shot('edge', { pos: [P.cx + 24, 1.7, P.sz + 4], look: [P.cx + 34, 3.5, P.vz + 12], fov: 55, focus: 14 });
await shot('coast', { pos: [P.cx + 10, 6, P.sz - 60], look: [P.cx + 10, 8, P.vz + 30], fov: 55, focus: 60 });
await shot('tree', { pos: [P.cx + 30, 3, P.vz - 7], look: [P.cx + 32, 4.5, P.vz + 6], fov: 50, focus: 10 });
await shot('camp', { pos: [P.cx - 6, 2.2, P.cz + 9], look: [P.cx + 2, 2.4, P.cz - 2], fov: 60, focus: 10 });
await shot('trunk', { pos: [10.2, 1.3, -1.8], look: [12.6, 0.9, 1.0], fov: 50, focus: 3.5 });
await shot('trunks', { pos: [P.cx + 18, 1.6, P.sz + 6], look: [P.cx + 24, 2.5, P.vz + 6], fov: 60, focus: 8 });
/* the foot of the camp's palm by the water, from where a walker stands beside it, and from closer */
await shot('foot', { pos: [15.4, 1.55, -4.2], look: [17.4, 0.3, -2.0], fov: 58, focus: 3 });
await shot('footc', { pos: [16.5, 0.85, -3.1], look: [17.4, 0.2, -2.0], fov: 55, focus: 1.6 });
await shot('hills', { pos: [P.cx + 40, 1.7, P.sz + 0.5], look: [P.cx + 70, 26, P.vz + 160], fov: 62, focus: 120 });
await shot('far', { pos: [P.cx + 60, 14, P.sz - 220], look: [P.cx + 60, 30, P.vz + 150], fov: 50, focus: 300 }, 30);
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
