/* A look round, as a visitor sees it: a list of stops, each a shot at full size — from a walker's eyes, from the van
   as it drives, from the explore camera zoomed in or out, at the animals, at whatever a stop names — with what is
   there (the ground under it, the animals near, the time) written beside it.
   node tools/tour.mjs <stops.json> [prefix tour] [island|coast] [width 1280] [height 720] [rs 1]
   A stop: { name, hour?, eye: [x, z, heading°, pitch°, fov?] } (a walker's eyes, 1.6 m over the ground; heading 0 is
   north, 90 east), or { cam: { pos, look, fov } }, or { js: "…returns {pos, look, fov}…" } (worked out in the page),
   or { drive: { x, z, heading°, secs, keys: "w"|"wa"|… } } (the van put there and driven, the camera behind it), or
   { walk: { x, z, heading°, secs, auto? } } (walking, on the page's own walk), or { orbit: { x, z, yaw°, zoom } } (the
   explore camera), with frames? (how many to draw first, 10), hud? (the page's own overlays left on) */
import { open } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const [file, prefix = 'tour', where = 'island', W = '1280', H = '720', RS = '1'] = process.argv.slice(2);
const stops = JSON.parse(fs.readFileSync(file, 'utf8')), isle = where === 'island';
const { browser, page, logs } = await open({ w: +W, h: +H, rs: +RS, hour: stops[0].hour ?? 10, dtCap: 0.25, query: isle ? '?island' : '', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const D = Math.PI / 180, t0 = Date.now();
const dir = (h, p) => [-Math.cos(h * D) * Math.cos(p * D), Math.sin(p * D), -Math.sin(h * D) * Math.cos(p * D)];   /* (heading 0 north (−x), 90 east (−z)) */
try {
  /* (how long the island took to build, when there is one) */
  if (isle) console.log('island built in', await page.evaluate(() => { const I = Layout.island(); return I && I.data ? I.data.ms : null; }), 'ms');
  for (const s of stops) {
    const ts = Date.now();
    await page.addStyleTag({ content: s.hud ? '#hint { display: none !important; }' : '#walkHud, #walkBar, #hint, #hud .brand, #hud .dock, #hud .ctrl, #hud .sky, #hud .fsbtn, #spots, #hud .minimap { display: none !important; }' });
    if (s.hour !== undefined) await page.evaluate(h => { const st = window.__cove.st; st.hour = h; st.timeMode = 'custom'; st.offset = 0; }, s.hour);
    let cam = null;
    if (s.eye) {
      const [x, z, h, p, fov] = s.eye;
      cam = await page.evaluate(([x, z]) => { const W = Engine.world, q = W.walk ? W.walk(x, z) : null, y = q && q.ok ? q.y : Math.max(W.land(x, z), 0); return y + 1.6; }, [x, z]).then(y => { const d = dir(h, p); return { pos: [x, y, z], look: [x + d[0] * 20, y + d[1] * 20, z + d[2] * 20], fov: fov || 62 }; });
    } else if (s.cam) cam = s.cam;
    else if (s.js) cam = await page.evaluate(s.js);
    if (cam) {
      await page.evaluate(c => { window.__coveCamFix = { pos: c.pos, look: c.look, fov: c.fov || 60, focus: Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]) }; }, cam);
      if (isle) await page.evaluate(([x, y, z]) => Engine.world.prime(x, z, y, true), cam.pos);
    } else await page.evaluate(() => { window.__coveCamFix = null; });
    if (s.orbit) await page.evaluate(o => { const c = window.__cove; if (c.orbAt) c.orbAt(o.x, o.z, (o.yaw || 0) * Math.PI / 180, o.zoom ?? 0); }, s.orbit);
    if (s.drive) {
      const d = s.drive.js ? Object.assign({}, s.drive, await page.evaluate(s.drive.js)) : s.drive;
      await page.evaluate(d => { const C = window.__cove, car = C.car; if (!car.on) C.startDrive(); Object.assign(car, { x: d.x, z: d.z, h: Math.PI - d.heading * Math.PI / 180, v: 0, k: 1, camK: 1, camP: null }); }, d);   /* (its nose (cos h, -sin h): heading 0 north, 90 east, as for the eyes) */
      for (const k of (d.keys || 'w')) await page.keyboard.down(k);
      const until = Date.now() + (d.secs || 4) * 1000; while (Date.now() < until) await frames(2);
      for (const k of (d.keys || 'w')) await page.keyboard.up(k);
    }
    if (s.walk) {
      /* (where to start may be worked out in the page: { js: "…returns {x, z, heading}…" }) */
      const w = s.walk.js ? Object.assign({}, s.walk, await page.evaluate(s.walk.js)) : s.walk;
      await page.evaluate(() => { const C = window.__cove; if (!C.wk.on) document.getElementById('bWalk').click(); });
      await page.waitForFunction(() => window.__cove.wk.camK >= 1, null, { timeout: 120000 });
      await page.evaluate(w => { const c = window.__cove, k = c.wk; if (!!k.auto !== !!w.auto) document.getElementById('bWalkAuto').click(); k.x = w.x; k.z = w.z; k.h = k.hT = Math.atan2(Math.cos(w.heading * Math.PI / 180), Math.sin(w.heading * Math.PI / 180)); }, w);   /* (facing (-sin h, -cos h): heading 0 north, 90 east) */
      if (!w.auto) await page.keyboard.down('w');
      const until = Date.now() + (w.secs || 4) * 1000; while (Date.now() < until) await frames(2);
      if (!w.auto) await page.keyboard.up('w');
    }
    await frames(s.frames || 10);
    /* what is here: the ground, the time, the animals within 60 m of the camera */
    const info = await page.evaluate(() => {
      const c = Engine.camera.position, W = Engine.world, q = W.walk ? W.walk(c.x, c.z) : null, S = window.__cove.st.S;
      const near = []; const F = Engine.isFauna; if (F && F.out) for (const a of F.out) { const d = Math.hypot(a.x - c.x, a.z - c.z); if (d < 60) near.push(`${a.k || '?'}@${d.toFixed(0)}m`); }
      return { cam: [c.x, c.y, c.z].map(v => +v.toFixed(1)), ground: q ? `${q.kind} y${q.y.toFixed(2)}` : `land ${W.land(c.x, c.z).toFixed(2)}`, sAlt: +S.sAlt.toFixed(1), near: near.slice(0, 8) };
    });
    const f = path.join('shots', `${prefix}_${s.name}.png`);
    await page.screenshot({ path: f, timeout: 240000 });
    console.log(`${s.name}: ${JSON.stringify(info)} (${((Date.now() - ts) / 1000).toFixed(0)} s)`);
    if (s.drive || s.walk) await page.evaluate(() => { const C = window.__cove; if (C.car.on && C.stopDrive) C.stopDrive(); });
  }
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); console.log(errs.length ? 'page errors: ' + errs.slice(0, 4).join(' | ').slice(0, 900) : 'no page errors');
  console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  await browser.close();
}
