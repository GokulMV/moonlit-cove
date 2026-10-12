/* The coast for the eye, far and wide: from out at sea at several places along it (is it all different? does the
   mountain run on?), and along it from the sand. Each place is given time to build before it is shot.
   node tools/coastlook.mjs [hour 15] [prefix coast] [places: x,x,…] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 15), prefix = process.argv[3] || 'coast', xs = (process.argv[4] || '0,700,-1300,2600').split(',').map(Number);
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 400; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0.7; st.flow = 1; c.WX.__t = { cirrus: 0.15, alto: 0, cumulus: 0.4, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const shot = async (name, cam, n) => {
  const b64 = await page.evaluate(([cam, n]) => { window.__coveCamFix = cam; const c = window.__cove; for (let i = 0; i < n; i++) c.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }, [cam, n]);
  fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name);
};
for (const x of xs) {
  const P = await page.evaluate(x => ({ sz: Layout.shoreZ(x), vz: Layout.vegZ(x) }), x);
  /* (a few frames to build what is round the new place, then the shot) */
  await shot('sea' + x, { pos: [x, 16, P.sz - 330], look: [x, 40, P.vz + 300], fov: 58, focus: 400 }, 14);
}
const P = await page.evaluate(() => ({ sz: Layout.shoreZ(60), vz: Layout.vegZ(60), vz3: Layout.vegZ(300) }));
await shot('along', { pos: [60, 2.2, P.sz + 2], look: [300, 14, P.vz3 + 60], fov: 60, focus: 200 }, 14);
await shot('inland', { pos: [30, 1.8, P.sz + 1], look: [60, 60, P.vz + 500], fov: 66, focus: 300 }, 6);
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
