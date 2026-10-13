/* A big swell coming in and breaking, for the eye: one is sent in from far out, and the camera on the sand, a little to
   one side, takes it every half second as it rises, steepens, goes over and runs up the beach as broken water.
   node tools/breaklook.mjs [hour 15] [prefix brk] [how far out it is sent from, m (45)] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 15), prefix = process.argv[3] || 'brk', out0 = +(process.argv[4] || 45);
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 960, h: 540, rs: 0.7, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 300; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.25, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const step = (n, dt = 1 / 30) => page.evaluate(([n, dt]) => { for (let i = 0; i < n; i++) window.__cove.filmStep(dt); }, [n, dt]);
const snap = async name => { const b64 = await page.evaluate(() => { window.__cove.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
const X = 18;
const cam = await page.evaluate(([X]) => { const sz = Layout.shoreZ(X); window.__coveCamFix = { pos: [X - 16, 1.75, sz + 2.5], look: [X + 6, 0.4, sz - 9], fov: 52, focus: 14 }; return { sz, tide: Layout.tide.dz }; }, [X]);
console.log('  shore', cam);
await step(4);
const info = await page.evaluate(([X, o]) => { const z = Layout.shoreZ(X) - o, p = Engine.project([X, 0, z]); let r = null; for (let k = 0; k < 3; k++) r = Engine.clickSea(p[0], p[1], window.__cove.st.t + k * 0.1) || r; return r ? { x: +r.x.toFixed(1), amp: r.amp, eta: +r.eta.toFixed(1) } : null; }, [X, out0]);
console.log('  sent', JSON.stringify(info));
/* (time moved on in big steps: one frame drawn for each) */
await step(3, 1.0);
for (let i = 0; i < 16; i++) { await step(1, 0.42); await snap('t' + String(i).padStart(2, '0')); }
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
