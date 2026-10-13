/* What swims in the shallows, for the eye: a sea turtle under the water (from above and from the side), the ray, a
   turtle up for a breath, and a school of sergeant majors close, with their shadows on the sand.
   node tools/turtlelook.mjs [hour 10] [prefix turt] (SHOTS=a,b to take only some) */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'turt';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 300; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.2, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const only = process.env.SHOTS ? process.env.SHOTS.split(',') : null;
const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.__cove.filmStep(1 / 30); }, n);
const snap = async name => { if (only && !only.includes(name)) return; const b64 = await page.evaluate(() => { window.__cove.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
/* a turtle placed off x = 8, kept down (no breath), the camera following it */
const follow = async (i, cam) => page.evaluate(([i, cam]) => { const Tu = Engine.life.turtles[i]; const [dx, h, dz, fov] = cam; window.__coveCamFix = { pos: [Tu.x + dx, h, Tu.z + dz], look: [Tu.x, -0.4, Tu.z], fov, focus: Math.hypot(dx, h, dz) }; }, [i, cam]);
const info = await page.evaluate(() => { const L = Engine.life, Tu = L.turtleAt(8, 0); Tu.next = 1e15; Tu.up = -1e9; return { rays: L.turtles.map(t => t.ray), n: L.turtles.length }; });
console.log('  turtles', info);
await step(10); await follow(0, [-1.8, 3.2, 2.6, 40]); await step(3); await snap('above');
await follow(0, [-2.6, 0.7, 1.4, 34]); await step(2); await snap('side');
/* the ray, if there is one today, placed beside it */
if (info.rays[info.n - 1]) { await page.evaluate(n => { const R = Engine.life.turtleAt(14, n - 1); R.next = 1e15; }, info.n); await step(8); await follow(info.n - 1, [-1.6, 3.4, 2.4, 42]); await step(3); await snap('ray'); }
/* up for a breath */
await page.evaluate(() => { const Tu = Engine.life.turtles[0]; Tu.next = Mats.U.uTime.value; });
await step(50); await page.evaluate(() => { const Tu = Engine.life.turtles[0]; window.__coveCamFix = { pos: [Tu.x - 1.8, 1.1, Tu.z + 2.6], look: [Tu.x, 0.0, Tu.z], fov: 32, focus: 3.2 }; }); await step(2); await snap('breath');
/* a school close, from about where someone standing in the shallows would look down at it */
const S = await page.evaluate(() => { const L = Engine.life, s = L.schools.find(s => s.z !== undefined && s.k > 0.3) || L.schools[0]; return [s.x, s.z]; });
await page.evaluate(S => { window.__coveCamFix = { pos: [S[0] - 1.2, 2.6, S[1] + 2.4], look: [S[0], -0.4, S[1]], fov: 42, focus: 3 }; }, S);
await step(4); await snap('school');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
