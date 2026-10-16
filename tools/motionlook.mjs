/* Animals in motion, frame by frame: each kind followed by the camera, beside it, while it walks, runs, takes off and lands,
   as strips of frames (1/30 s apart, every `every`th kept), to look at their gaits: knees, feet set down or sliding, turns,
   jitter. Writes shots/<prefix>/<subject>_<n>.png and a contact sheet per subject (<subject>.png).
   node tools/motionlook.mjs [prefix motion] (SUBJ=pig,macaque,egret,gull to take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const prefix = process.argv[2] || 'motion', only = process.env.SUBJ ? process.env.SUBJ.split(',') : null;
const out = path.join(root, 'shots', prefix); fs.mkdirSync(out, { recursive: true });
/* (the forest's own trees left out: a test of how the animals move, and they make each frame many times slower here) */
const { browser, page, logs } = await open({ w: 560, h: 360, rs: 1, dtCap: 1, hour: 10, init: () => { window.__coveForest = false; window.__coveShadow = 512; } });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 60; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 900000, polling: 2000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; });
const step = (n, dt = 1 / 30) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__cove.filmStep(dt); }, [n, dt]);
/* (the camera put beside the subject before each frame: fn returns { pos, look, fov }) */
async function film(name, find, cam, n = 12, every = 2, prep) {
  if (only && !only.includes(name)) return;
  const ok = await page.evaluate(find); if (!ok) { console.log('  no', name); return; }
  if (prep) await page.evaluate(prep);
  const files = [];
  for (let f = 0; f < n; f++) {
    let b64 = null;
    for (let k = 0; k < every; k++) { const c = await page.evaluate(cam); b64 = await page.evaluate(([c, last]) => { window.__coveCamFix = Object.assign({ fov: 40, focus: 4 }, c); window.__cove.filmStep(1 / 30); return last ? document.getElementById('scene').toDataURL('image/png') : null; }, [c, k === every - 1]); }
    const file = path.join(out, `${name}_${String(f).padStart(2, '0')}.png`); fs.writeFileSync(file, Buffer.from(b64.split(',')[1], 'base64')); files.push(file);
    if (f === 0) console.log('  ', name, await page.evaluate(() => JSON.stringify(window.__subjInfo ? window.__subjInfo() : null)));
  }
  try { execFileSync('python3', ['-c', `import sys\nfrom PIL import Image\nfs=sys.argv[2:]\nims=[Image.open(f) for f in fs]\nw,h=ims[0].size\ncols=4\nrows=(len(ims)+cols-1)//cols\nS=Image.new('RGB',(w*cols//2,h*rows//2))\nfor i,im in enumerate(ims): S.paste(im.resize((w//2,h//2)),((i%cols)*w//2,(i//cols)*h//2))\nS.save(sys.argv[1])`, path.join(out, name + '.png'), ...files]); } catch (e) { console.log('  sheet failed', e.message.slice(0, 200)); }
}
/* bring the island's animals out round a place, and pick one of a kind */
const bring = (x, z) => page.evaluate(([x, z]) => { window.__coveCamFix = { pos: [x, 6, z - 8], look: [x, 0, z], fov: 50, focus: 8 }; }, [x, z]);
const sp = await page.evaluate(() => { const F = Engine.isFauna; if (!F) return null; const S = F.spots, pick = k => (S[k] || []).slice().sort((a, b) => Math.abs(Layout.wrapD(a.x - Layout.camp.x)) - Math.abs(Layout.wrapD(b.x - Layout.camp.x)))[0]; return { pig: pick('pig'), egret: pick('egret'), monitor: pick('monitor') }; });
console.log('spots', JSON.stringify(sp));
const side = (k, d = 3.2, up = 0.7, ahead = 0) => `(() => { const a = Engine.isFauna.out.find(a => a.k === '${k}' && a.__subj); if (!a) return { pos: [0, 5, -5], look: [0, 0, 0] }; const p = a.g.position, h = a.h, fx = Math.cos(h), fz = -Math.sin(h); let sx = -fz, sz = fx; if (sz > 0) { sx = -sx; sz = -sz; } return { pos: [p.x + sx * ${d} + fx * ${ahead}, p.y + ${up} + 0.5, p.z + sz * ${d} + fz * ${ahead}], look: [p.x + fx * 0.3, p.y + ${up * 0.4}, p.z + fz * 0.3], fov: 40, focus: ${d} }; })()`;
/* (one of a kind picked, and put out on the open sand above the water's edge, facing along the beach, so it can be seen) */
const pickOne = (k, state, up = 5) => `(() => { const a = Engine.isFauna.out.find(a => a.k === '${k}'); if (!a) return false; for (const b of Engine.isFauna.out) b.__subj = false; a.__subj = true;
  const X = a.x, Z = Layout.shoreMeanZ(X) + ${up}; a.x = X; a.z = Z; a.home = [X + 30, Z]; a.h = a.hT = 0; a.w = 0; ${state}
  window.__subjInfo = () => ({ k: a.k, state: a.state, v: +(a.v || 0).toFixed(2), clip: a.clip, rate: a.rate, y: +a.y.toFixed(2) }); return true; })()`;
if (sp && sp.pig) {
  await bring(sp.pig.x, sp.pig.z); await step(24);
  /* (walking: none of them minds the camera beside it) */
  await page.evaluate(() => { for (const k of ['pig', 'macaque']) IsleFauna.KINDS[k].near = 0.3; });
  await film('pigwalk', pickOne('pig', `a.state = 'walk'; a.until = 1e9; a.hT = a.h;`), side('pig', 3.4, 0.6), 12, 2, null);
  await film('macaquewalk', pickOne('macaque', `a.state = 'walk'; a.until = 1e9; a.hT = a.h;`), side('macaque', 2.6, 0.5), 12, 2, null);
  await page.evaluate(() => { IsleFauna.KINDS.pig.near = 9; IsleFauna.KINDS.macaque.near = 7; });
  await film('pigflee', pickOne('pig', `a.state = 'flee'; a.until = 1e9;`), side('pig', 4.5, 0.8, 1.5), 12, 2);
  await film('macaquerun', pickOne('macaque', `a.state = 'flee'; a.until = 1e9;`), side('macaque', 4, 0.7, 1.5), 12, 2);
}
if (sp && sp.egret) {
  await bring(sp.egret.x, sp.egret.z); await step(24);
  await film('egretflee', pickOne('egret', `a.state = 'flee'; a.until = 1e9; a.fly = { t0: window.__cove.st.t, ph: 'crouch' };`, 1.5), side('egret', 6, 1.2), 16, 3);
}
console.log('page errors:', logs.filter(l => /pageerror|\[error\]/.test(l)).slice(0, 5).join(' | ') || 'none');
await browser.close();
