/* The rocks, for the eye: the camp's headland seen from the sand at its foot, its boulders up close, its sea stacks
   from the water, by day. node tools/rocklook.mjs [hour 11] [prefix rock] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 11), prefix = process.argv[3] || 'rock';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 250; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0.7; st.flow = 1; c.WX.__t = { cirrus: 0.15, alto: 0, cumulus: 0.3, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const shot = async (name, cam, n = 10) => {
  if (only && !only.includes(name)) return;
  const b64 = await page.evaluate(([cam, n]) => { window.__coveCamFix = cam; const c = window.__cove; for (let i = 0; i < n; i++) c.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }, [cam, n]);
  fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name);
};
/* the headland nearest the camp on its far side, and the lie of the sand round it */
const H = await page.evaluate(() => { const cx = Layout.camp.x, h = Layout.heads(cx, cx + 400)[0]; return { hx: h.hx, w: h.w, sz: Layout.shoreZ(h.hx), szW: Layout.shoreZ(h.hx - h.w * 1.6), vz: Layout.vegZ(h.hx) }; });
console.log('  headland at', H.hx.toFixed(1), 'w', H.w.toFixed(1), 'shore', H.sz.toFixed(1));
await page.evaluate(() => { const c = window.__cove; for (let i = 0; i < 8; i++) c.filmStep(1 / 30); });
await shot('foot', { pos: [H.hx - H.w * 1.6, 1.6, H.szW + 3], look: [H.hx - H.w * 0.3, 2.5, H.szW + 9], fov: 55, focus: 12 });
await shot('close', { pos: [H.hx - H.w * 1.1, 1.2, H.szW + 4.5], look: [H.hx - H.w * 0.75, 0.8, H.szW + 7.5], fov: 45, focus: 4 });
await shot('face', { pos: [H.hx - H.w * 0.4, 2.2, H.sz - 3], look: [H.hx, 5, H.sz + 12], fov: 55, focus: 14 });
await shot('stacks', { pos: [H.hx + H.w * 0.4, 3.0, H.sz - 34], look: [H.hx, 2.5, H.sz - 10], fov: 55, focus: 24 });
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
