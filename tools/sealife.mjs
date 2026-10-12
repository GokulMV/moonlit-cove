/* The sea's larger lives, for the eye: a whale blowing, its back rolling through, its flukes as it dives, a breach and
   its crash; a sea turtle's shadow in the shallows and one up at the surface for a breath.
   node tools/sealife.mjs [hour 10] [prefix sea] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'sea';
const out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.8, dtCap: 1, hour });
await page.evaluate(() => { window.__coveFilm = true; window.__coveBuildMs = 300; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
await page.evaluate(() => { const c = window.__cove, st = c.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; st.motion = 1; st.flow = 1; c.WX.__t = { cirrus: 0.1, alto: 0, cumulus: 0.25, stratus: 0, storm: 0, rain: 0 }; st.weather = '__t'; Object.assign(st.wx, c.WX.__t); st.nextBolt = 1e15; });
const step = n => page.evaluate(n => { for (let i = 0; i < n; i++) window.__cove.filmStep(1 / 30); }, n);
/* (the frame is read in the same call that draws it: the canvas keeps no drawing buffer between calls) */
const snap = async name => { const b64 = await page.evaluate(() => { window.__cove.filmStep(1 / 30); return document.getElementById('scene').toDataURL('image/png').slice(22); }); fs.writeFileSync(path.join(out, `${prefix}_${name}.png`), Buffer.from(b64, 'base64')); console.log('  saved', name); };
/* the whale: called up off x = 30, then put into each part of its round in turn, the camera on the beach looking at it */
const W = async (st, u, fov = 16) => {
  const info = await page.evaluate(([st, u, fov]) => {
    const F = Engine.fauna, w = F.debug.whales.w, now = Mats.U.uTime.value;
    if (!w.on) { F.whale(30); Object.assign(w, { off: 150, size: 13, dir: 1, v: 0.0001 }); }
    const dur = { breath: 7.5, dive: 7, breach: 5.5 }[st];
    Object.assign(w, { st, t0: now - u * dur, dur, blown: u > 0.1 && st !== 'breach', hit: false, top: false });
    const z = Layout.shoreZ(w.x) - w.off;
    window.__coveCamFix = { pos: [w.x - 25, 3.2, Layout.shoreZ(w.x - 25) + 3], look: [w.x, 2, z], fov, focus: w.off };
    return { x: w.x, z };
  }, [st, u, fov]);
  return info;
};
await W('breath', 0.02, 50); await step(4); await snap('whale_wide0');
await W('breath', 0.05); await step(40); await snap('whale_blow');
await W('breath', 0.55); await step(3); await snap('whale_back');
await W('dive', 0.5); await step(3); await snap('whale_flukes');
await W('breach', 0.42); await step(3); await snap('whale_breach');
await W('breach', 0.79); await step(20); await snap('whale_crash');
/* a turtle: its shadow, then up for a breath */
const P = await page.evaluate(() => { const Tu = Engine.life.turtleAt(8); Tu.next = 1e15; Tu.up = -1e9; const sz = Layout.shoreZ(8); window.__coveCamFix = { pos: [6, 4.5, sz + 3], look: [8, 0, sz - 6], fov: 45, focus: 9 }; return { sz }; });
await step(6); await snap('turtle');
await page.evaluate(() => { const Tu = Engine.life.turtles[0]; Tu.next = Mats.U.uTime.value; });
await step(45); await snap('turtle_up');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
