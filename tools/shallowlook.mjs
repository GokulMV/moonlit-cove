/* The shallows, for the eye: a school of sergeant majors under the surface near the camp, kelp round a rock out in the
   water, hermit crabs at the tide line. node tools/shallowlook.mjs [hour 11] [prefix shallow] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 11), prefix = process.argv[3] || 'shallow';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 250; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0.7; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.2, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
/* (HIDE=kelp or HIDE=canopy: leave one of them out, to tell which is which) */
if (process.env.HIDE) await page.evaluate(h => { const d = Engine.shallows.debug, m = h === 'kelp' ? d.kelpM : d.canopyM; if (m) m.visible = false; }, process.env.HIDE);
const shot = async (name, cam, n = 10) => {
  if (!cam || (only && !only.includes(name))) return;
  const b64 = await page.evaluate(([cam, n]) => { window.__coveCamFix = cam; const c = window.__cove; for (let i = 0; i < n; i++) c.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }, [cam, n]);
  fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name);
};
await page.evaluate(() => { const c = window.__cove; for (let i = 0; i < 20; i++) c.filmStep(1 / 30); });
/* where to look: the school nearest the camp, a rock in the water with kelp round it, the nearest hermit crab */
const C = await page.evaluate(() => {
  const cx = Layout.camp.x, L = Engine.life, out = {};
  const s = (L.schools || []).filter(s => s.z !== undefined && s.k > 0.2).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
  if (s) { const sz = Layout.shoreZ(s.x); out.shoal = { pos: [s.x - 1.2, 1.65, sz + 1.2], look: [s.x, -0.35, s.z], fov: 55, focus: 5 }; out.school = [s.x, s.z]; }
  /* (one well out in the water, where it is deep enough for kelp) */
  const wet = Engine.world.wetNear ? Engine.world.wetNear(cx + 60, Layout.shoreZ(cx + 60) - 6, 140).slice() : [];
  const deep = p => Layout.shoreZ(p.x) - p.z;
  const w = wet.filter(p => p.rad > 0.6 && deep(p) > 7).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
  if (w) { const sz = Layout.shoreZ(w.x); out.kelp = { pos: [w.x + 4, 3.2, Math.max(sz + 1.5, w.z + 7)], look: [w.x, -0.2, w.z], fov: 50, focus: 9 }; out.rock = [w.x, w.z, w.rad, deep(w)]; }
  /* (every shrimp laid out so far, not only those in reach of where the camera starts) */
  const all = Engine.shallows && Engine.shallows.debug.shrimp ? Engine.shallows.debug.shrimp() : [];
  const sh = all.sort((a, b) => Math.abs(a[0] - cx) - Math.abs(b[0] - cx))[0];
  if (sh) out.shrimp = { pos: [sh[0] + 0.7, 1.1, sh[2] + 0.9], look: [sh[0], sh[1], sh[2]], fov: 40, focus: 1.8 }, out.shr = sh, out.nShrimp = all.length;
  const h = Engine.inspect.candidates().filter(c => c.kind === 'hermit').sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
  if (h) out.hermit = { pos: [h.x - 0.9, 0.9, h.z + 1.0], look: [h.x, 0.03, h.z], fov: 40, focus: 1.4 }, out.crab = [h.x, h.z];
  if (Engine.shallows.debug.kelp) out.kelpN = [Engine.shallows.debug.kelp(), Engine.shallows.debug.kelpTris];
  return out;
});
console.log('  kelp fronds built, tris each:', C.kelpN);
console.log('  school', C.school, 'rock', C.rock, 'hermit', C.crab, 'shrimp', C.shr, 'of', C.nShrimp);
/* (the crab first: the hermit crabs follow the camera, so once it has been out to the rocks they are somewhere else) */
await shot('hermit', C.hermit); await shot('shoal', C.shoal); await shot('shrimp', C.shrimp); await shot('kelp', C.kelp);
if (C.kelp && (!only || only.includes('kelpnear'))) await shot('kelpnear', { pos: [C.rock[0] + 1.6, 1.5, C.rock[1] + 2.2], look: [C.rock[0] - 0.4, -0.5, C.rock[1] - 0.4], fov: 50, focus: 2.5 });
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).map(e => e.slice(0, 300)).join('\n  ') : 'no page errors');
await browser.close();
