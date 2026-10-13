/* The reef by the camp and the tide, for the eye and by numbers: the reef from the beach, from out at sea, and a walk out
   along it (does the walker stay on its top all the way out?); the camp's beach with the tide out.
   node tools/reeflook.mjs [hour 10] [prefix reef] (SHOTS=a,b to take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'reef';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.7, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 400; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.2, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.__cove.filmStep(1 / 30); }, n);
const snap = async name => { if (only && !only.includes(name)) return; const b64 = await page.evaluate(() => { window.__cove.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
const R = await page.evaluate(() => { const R = Layout.Coast.reefs(-60, 20).find(r => r.id === -7); const g = Layout.shoreDZ(R.x); return { x: R.x - Layout.O.x, sz: Layout.shoreZ(R.x), mean: Layout.shoreMeanZ(R.x), tide: Object.assign({}, Layout.tide), len: R.len, ang: R.ang, top: Engine.world.reefTop(R.x + 1, Layout.shoreMeanZ(R.x) - 6) }; });
console.log('  reef', JSON.stringify(R));
/* the walk: start on the sand by its root, head out to sea along it, step by step; record where the walker is and how high */
const walk = await page.evaluate(() => {
  const c = window.__cove, R = Layout.Coast.reefs(-60, 20).find(r => r.id === -7), x0 = R.x - Layout.O.x, z0 = Layout.shoreMeanZ(x0) + 2.5;
  c.startWalk(); Object.assign(c.wk, { x: x0, z: z0, h: 0, hT: 0, auto: false });
  const line = Engine.world.reefLines(x0)[0];
  const rec = []; let at = 0;
  for (let i = 0; i < 40 * 30 / 1.4; i++) {
    /* steer for the reef's middle line, a few metres ahead of the nearest point on it */
    let bd = 1e9; for (let k = at; k < Math.min(line.length, at + 6); k++) { const d = Math.hypot(line[k][0] - c.wk.x, line[k][1] - c.wk.z); if (d < bd) { bd = d; at = k; } }
    const tgt = line[Math.min(line.length - 1, at + 3)]; c.wk.hT = Math.atan2(-(tgt[0] - c.wk.x), -(tgt[1] - c.wk.z)); c.wk.h = c.wk.hT;
    if (at >= line.length - 2) break;
    c.keys.add('w'); c.stepWalk(1 / 30);
    if (i % 30 === 0) rec.push([+c.wk.x.toFixed(2), +c.wk.z.toFixed(2), +(c.wk.cam.pos[1] - 1.65).toFixed(2), c.wk.reef ? 1 : 0, +(Layout.shoreZ(c.wk.x) - c.wk.z).toFixed(1)]);
  }
  c.keys.delete('w');
  return { rec, line: line.filter((p, i) => i % 6 === 0).map(p => p.map(v => +v.toFixed(2))) };
});
console.log('  reef line [x, z, top, half-width]:', JSON.stringify(walk.line));
console.log('  walk [x, z, ground y, on reef, metres out past the water]:\n   ', walk.rec.map(r => JSON.stringify(r)).join(' '));
await snap('walk');
await page.evaluate(() => window.__cove.stopWalk());
await page.evaluate(R => { window.__coveCamFix = { pos: [R.x + 9, 2.2, R.mean + 4], look: [R.x - 4, 0.3, R.mean - 16], fov: 50, focus: 14 }; }, R);
await step(6); await snap('beach');
await page.evaluate(R => { window.__coveCamFix = { pos: [R.x + 24, 9, R.mean - 46], look: [R.x - 2, 0, R.mean - 12], fov: 48, focus: 40 }; }, R);
await step(4); await snap('sea');
/* the camp's beach, the tide as it is, then forced right out */
await page.evaluate(() => { window.__coveCamFix = { pos: [2, 6.5, 6], look: [0, 0.5, -9], fov: 55, focus: 14 }; });
await step(3); await snap('camp');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
