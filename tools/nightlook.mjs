/* The real night sky, for the eye: the stars and the Milky Way from the camp (east over the sea, and up overhead), the
   moon close (its real phase and where its bright limb faces), and the planets that are up.
   node tools/nightlook.mjs [hour 22] [prefix night] (SHOTS=a,b to take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 22), prefix = process.argv[3] || 'night';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 300; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.0, alto: 0, cumulus: 0.08, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; st.lightsMode = 'off'; st.L.string = st.L.lantern = st.L.van = st.L.fairy = 0; st.lightsQuick = 1; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.__cove.filmStep(1 / 30); }, n);
const snap = async name => { if (only && !only.includes(name)) return; const b64 = await page.evaluate(() => { window.__cove.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
await step(4);
const info = await page.evaluate(() => { const S = window.__cove.st.S, m = S.moonDirV; return { phase: Astro.phaseName(S.illum.phase), frac: +S.illum.fraction.toFixed(2), mAlt: +S.mAlt.toFixed(1), sAlt: +S.sAlt.toFixed(1), moonDir: m.map(v => +v.toFixed(3)), sunM: S.sunM.map(v => +v.toFixed(3)), stars: +S.stars.toFixed(2), tide: S.tide && { dz: +S.tide.dz.toFixed(2), rising: S.tide.rising } }; });
console.log('  sky', JSON.stringify(info));
await page.evaluate(() => { window.__coveCamFix = { pos: [0.5, 2.0, 3.0], look: [0.5, 14, -40], fov: 72, focus: 200 }; });
await step(3); await snap('east');
await page.evaluate(() => { window.__coveCamFix = { pos: [0.5, 2.0, 3.0], look: [0.6, 60, -6], fov: 85, focus: 200 }; });
await step(3); await snap('up');
await page.evaluate(() => { window.__coveCamFix = { pos: [0.5, 2.0, 3.0], look: [-40, 14, 3.0], fov: 72, focus: 200 }; });
await step(3); await snap('north');
if (info.mAlt > 0) { await page.evaluate(m => { window.__coveCamFix = { pos: [0.5, 2.0, 3.0], look: [0.5 + m[0] * 100, 2 + m[1] * 100, 3 + m[2] * 100], fov: 9, focus: 200 }; }, info.moonDir); await step(3); await snap('moon'); }
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
