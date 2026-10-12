/* The sun behind a cloud: its glitter on the sea and its glare go with it; the clouds' shadows drift over the sand and
   the sea (and the light at the camp dims under one); the clouds reach down to the horizon, with no band of empty haze
   above it. node tools/sunvis.mjs [hour 15] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 15), W = 640, H = 360;
const out = path.join(root, 'shots', 'clouds'); fs.mkdirSync(out, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; return c; };
const { browser, page, logs } = await open({ w: W, h: H, rs: 1, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const st = window.__cove.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 0; st.flow = 1; });
const setWx = w => page.evaluate(w => { const c = window.__cove; c.WX.__t = w; c.st.weather = '__t'; Object.assign(c.st.wx, w); c.st.nextBolt = 1e15; c.st.flash = null; }, w);
const step = (n, grab) => page.evaluate(([n, grab]) => {
  const c = window.__cove; for (let i = 0; i < n; i++) c.filmStep(1 / 30);
  return grab ? document.getElementById('scene').toDataURL('image/png').slice(22) : null;
}, [n, grab]);
const save = (b64, name) => fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(b64, 'base64'));
/* the view out over the sea toward the sun, as from the camp's wide view */
const sunCam = () => page.evaluate(() => {
  const S = window.__cove.st.S, d = S.sunDirV, az = Math.atan2(d[0], -d[2]), x = Layout.camp.x, z = Layout.camp.z + 18, y = 14;
  window.__coveCamFix = { pos: [x, y, z], look: [x + Math.sin(az) * 40, y - 6, z - Math.cos(az) * 40], fov: 55, focus: 40 };
});
/* the glitter: the brightness of the sea straight below the sun on screen */
const glitter = () => page.evaluate(() => {
  const cv = document.getElementById('scene'), gl = cv.getContext('webgl2'), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const S = window.__cove.st.S, c = window.__coveCamFix, d = S.sunDirV, p = Engine.project([c.pos[0] + d[0] * 1e4, c.pos[1] + d[1] * 1e4, c.pos[2] + d[2] * 1e4]);
  return { sx: p[0], sy: p[1], w, h };
});
const NONE = { cirrus: 0, alto: 0, cumulus: 0, stratus: 0, storm: 0, rain: 0 }, PUFFY = { cirrus: 0, alto: 0, cumulus: 1, stratus: 0, storm: 0, rain: 0 }, OVER = { cirrus: 0, alto: 0.35, cumulus: 0.5, stratus: 0.88, storm: 0, rain: 0 };
await step(1); await sunCam();
await setWx(NONE); await step(3);
let v = await page.evaluate(() => Engine.dbg.sunVis());
ok(v[0] > 0.95, `a clear sky: all of the sun shows (${v[0].toFixed(2)})`);
await setWx(OVER); await step(3);
v = await page.evaluate(() => Engine.dbg.sunVis());
ok(v[0] < 0.2, `under a grey deck: next to none of it (${v[0].toFixed(2)})`);
/* (a few fair-weather heaps: low over the sea a full sky of them is a wall the sun stays behind) */
const FAIR = { cirrus: 0, alto: 0, cumulus: 0.6, stratus: 0, storm: 0, rain: 0 };
await setWx(FAIR); await step(2);
/* the glitter, measured in a column of sea under the sun, with the sun hidden and shown */
const column = async name => {
  const b64 = await step(8, true); save(b64, name);
  const g = await glitter();
  return page.evaluate(([b64, g]) => new Promise(res => { const im = new Image(); im.onload = () => {
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    const X = Math.round(g.sx * im.width), Y0 = Math.round(g.sy * im.height) + 12; let s = 0, n = 0;
    for (let y = Y0; y < Math.min(im.height, Y0 + 70); y++) for (let i = X - 10; i <= X + 10; i++) { if (i < 0 || i >= im.width) continue; const d = x.getImageData(i, y, 1, 1).data; s += 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; n++; }
    res(n ? s / n : 0); }; im.src = 'data:image/png;base64,' + b64; }), [b64, g]);
};
/* let the heaps drift past until one hides the sun, measure; on until none does, measure */
const until = async (test, max = 80) => { for (let k = 0; k < max; k++) { await page.evaluate(() => { window.__cove.st.t += 25; }); await step(1); const vv = (await page.evaluate(() => Engine.dbg.sunVis()))[0]; if (test(vv)) return vv; } return null; };
const vc = await until(vv => vv < 0.25), gC = vc != null ? await column('sun_covered') : null;
const vs = await until(vv => vv > 0.85), gS = vs != null ? await column('sun_shown') : null;
console.log(`  glitter under the sun: ${gC && gC.toFixed(1)} with it hidden (${vc && vc.toFixed(2)} of it showing), ${gS && gS.toFixed(1)} with it out (${vs && vs.toFixed(2)})`);
ok(vc != null && vs != null, 'drifting heaps now hide the sun and now let it out');
ok(gC != null && gS != null && gC < gS * 0.75, 'the glitter on the sea dims when a cloud hides the sun');
/* the shadows: the camp's light, and the sand and the sea seen from above */
await setWx(PUFFY); await step(2);
const shade = await page.evaluate(() => { const r = []; for (let i = 0; i < 40; i++) r.push(Engine.dbg.cloudShadowAt(Layout.camp.x + (i % 8) * 600 - 2100, Layout.camp.z - Math.floor(i / 8) * 600)); return r; });
const lo = Math.min(...shade), hi = Math.max(...shade);
console.log(`  the clouds' shadow over 5 km of coast: from ${lo.toFixed(2)} to ${hi.toFixed(2)} of the sun's light`);
ok(lo < 0.5 && hi > 0.95, 'under heaps, some of the coast is in shadow and some in sun');
await page.evaluate(() => { const x = Layout.camp.x, z = Layout.camp.z; window.__coveCamFix = { pos: [x + 20, 160, z + 120], look: [x + 20, 0, z - 60], fov: 60, focus: 150 }; });
save(await step(8, true), 'shadows_from_above');
/* the horizon, in the camp's own wide view */
await page.evaluate(() => { window.__coveCamFix = null; });
await setWx({ cirrus: 0.2, alto: 0, cumulus: 1, stratus: 0, storm: 0, rain: 0 });
save(await step(10, true), 'horizon_wide');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
