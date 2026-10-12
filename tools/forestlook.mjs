/* The forest, for the eye: the camp's wide view, the forest edge from the sand, the coast from out at sea, a tree up
   close, the grass and the flowers at the edge. node tools/forestlook.mjs [hour 15] [prefix forest] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 15), prefix = process.argv[3] || 'forest';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0.7; st.flow = 1; c.WX.__t = { cirrus: 0.15, alto: 0, cumulus: 0.5, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const shot = async (name, cam, n = 8) => {
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
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
