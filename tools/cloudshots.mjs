/* The clouds, judged on their own: the camera stands on the beach and looks up at the sky, toward the sun, away from
   it and straight up, in each weather asked for, after enough frames for the clouds' blend over frames to settle.
   node tools/cloudshots.mjs [hour 16] [weathers clear,puffy] [views sun,away,up] [frames 6] [render scale 0.8] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 16), weathers = (process.argv[3] || 'clear,puffy').split(','), views = (process.argv[4] || 'sun,away,up').split(',');
const frames = +(process.argv[5] || 6), rs = +(process.argv[6] || 0.8);
const T0 = Date.now(), lap = m => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4) + 's ' + m);
const { browser, page, logs } = await open({ w: 1280, h: 720, rs, hour });
lap('open; cloud noise baked in ' + await page.evaluate(() => Engine.dbg.cloudNoiseMs ? Engine.dbg.cloudNoiseMs() : '?') + ' ms');
const step = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
for (const wx of weathers) {
  await page.evaluate(w => { const c = window.__cove; c.st.weather = w; if (c.WX[w]) Object.assign(c.st.wx, c.WX[w]); }, wx);
  for (const v of views) {
    await page.evaluate(v => {
      const S = window.__cove.st.S, sd = S.sunDirV, az = Math.atan2(sd[0], -sd[2]) + (v === 'away' ? Math.PI : v === 'side' ? Math.PI / 2 : 0);
      const pitch = v === 'up' ? 1.25 : 0.32, x = Layout.camp.x, z = Layout.camp.z + 2, y = 1.7;
      window.__coveCamFix = { pos: [x, y, z], look: [x + Math.sin(az) * Math.cos(pitch) * 10, y + Math.sin(pitch) * 10, z - Math.cos(az) * Math.cos(pitch) * 10], fov: 60, focus: 30 };
    }, v);
    await step(frames);
    await shot(page, `cloud_${hour}_${wx}_${v}`); lap(`${wx} ${v}`);
  }
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
