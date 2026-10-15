/* The van against the island's boulders: put it a few metres from a big one, facing it, and drive at it; it should stop
   at the stone's side, not go in. Then the same for a walker. Prints how far into the nearest stone each got (negative is
   inside its outline), the stones' build time and how many are drawn at each level, and a shot of each.
   node tools/vanrock.mjs [prefix vr] */
import { open } from './lib.mjs';
import path from 'path';
const prefix = process.argv[2] || 'vr';
const { browser, page, logs } = await open({ w: 960, h: 540, rs: 0.8, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#hint { display: none !important; }' });
  console.log('stones:', JSON.stringify(await page.evaluate(() => Engine.world.stones.stats())));
  /* (a big stone on open sand near the camp's beach, with room in front of it to drive at it from the beach's side) */
  const target = await page.evaluate(() => {
    const S = Engine.world.stones, W = Engine.world, c = Layout.camp, out = [];
    for (const st of S.all) {
      if (st.s < 1.4 || st.s > 2.6 || st.brook) continue;
      const d = Math.hypot(st.x - c.x, st.z - c.z); if (d > 900) continue;
      /* (the open sand 9 m from it, toward the water's edge along the shore normal) */
      const q = Layout.Shore.at(st.x, st.z, {}); if (q.s > -1 || q.s < -8) continue;
      for (const sg of [1, -1]) {
        const tx = -q.nz * sg, tz = q.nx * sg, x = st.x + tx * 9, z = st.z + tz * 9, w = W.walk(x, z);
        if (!w.ok || w.kind !== 'sand') continue;
        if (W.obstaclesNear(x, z).some(o => o[0] !== st.x && Math.hypot(x - o[0], z - o[1]) < o[2] + 3)) continue;
        out.push({ st: { x: st.x, z: st.z, s: st.s, id: st.id }, x, z, d });
      }
    }
    out.sort((a, b) => a.d - b.d);
    return out[0] || null;
  });
  ok(!!target, 'a big stone to drive at: ' + JSON.stringify(target));
  if (target) {
    /* the van: put down facing the stone, driven at it for five seconds */
    await page.evaluate(t => { const C = window.__cove, car = C.car; if (!car.on) C.startDrive(); const h = Math.atan2(-(t.st.z - t.z), t.st.x - t.x); Object.assign(car, { x: t.x, z: t.z, h, v: 0, k: 1, camK: 1, camP: null }); }, target);
    await page.keyboard.down('w'); const until = Date.now() + 5000; while (Date.now() < until) await frames(2); await page.keyboard.up('w');
    await frames(6);
    const r = await page.evaluate(t => {
      const C = window.__cove, car = C.car, S = Engine.world.stones, out = [];
      for (const l of [-1.45, 0, 1.45]) {
        const cx = car.x + Math.cos(car.h) * l, cz = car.z - Math.sin(car.h) * l;
        for (const st of S.near(cx, cz, 4)) { if (st.s < 0.45) continue; const d = Math.hypot(cx - st.x, cz - st.z), rr = S.reach(st, cx - st.x, cz - st.z); out.push(+(d - rr - 0.95).toFixed(2)); }
      }
      const cam = Engine.camera.position, top = S.top(cam.x, cam.z);
      return { gap: out.length ? Math.min(...out) : null, moved: +Math.hypot(car.x - t.x, car.z - t.z).toFixed(2), cam: [cam.x, cam.y, cam.z].map(v => +v.toFixed(2)), camOverStone: top.y > -1e8 ? +top.y.toFixed(2) : null };
    }, target);
    console.log('  van:', JSON.stringify(r));
    ok(r.gap === null || r.gap > -0.25, 'the van stops at the stone, not in it (its sides ' + r.gap + ' m off the stone)');
    ok(r.camOverStone === null || r.cam[1] > r.camOverStone + 0.3, 'the camera is not inside a stone');
    await page.screenshot({ path: path.join('shots', `${prefix}_van.png`), timeout: 240000 });
    /* (the van parked out of the walker's way: back past where it started) */
    await page.evaluate(t => { const car = window.__cove.car; Object.assign(car, { x: t.x + (t.x - t.st.x) * 1.6, z: t.z + (t.z - t.st.z) * 1.6, v: 0 }); window.__cove.stopDrive(); }, target);
    await frames(4);
    /* a walker: from the same place, at the stone */
    await page.evaluate(() => { const C = window.__cove; if (!C.wk.on) document.getElementById('bWalk').click(); });
    await page.waitForFunction(() => window.__cove.wk.camK >= 1, null, { timeout: 120000 });
    await page.evaluate(t => { const k = window.__cove.wk; if (k.auto) document.getElementById('bWalkAuto').click(); k.x = t.x; k.z = t.z; const dx = t.st.x - t.x, dz = t.st.z - t.z; k.h = k.hT = Math.atan2(-dx, -dz); }, target);
    await page.keyboard.down('w'); const u2 = Date.now() + 6000; while (Date.now() < u2) await frames(2); await page.keyboard.up('w');
    await frames(6);
    const w = await page.evaluate(t => { const k = window.__cove.wk, S = Engine.world.stones, st = S.all.find(s => s.id === t.st.id), d = Math.hypot(k.x - st.x, k.z - st.z), rr = S.reach(st, k.x - st.x, k.z - st.z), c = Engine.camera.position, top = S.top(c.x, c.z); return { gap: +(d - rr).toFixed(2), moved: +Math.hypot(k.x - t.x, k.z - t.z).toFixed(2), cam: [c.x, c.y, c.z].map(v => +v.toFixed(2)), camOverStone: top.y > -1e8 ? +top.y.toFixed(2) : null }; }, target);
    console.log('  walker:', JSON.stringify(w));
    ok(w.gap > -0.05 || (w.camOverStone !== null && w.cam[1] > w.camOverStone + 1), 'the walker stops at the stone or climbs onto it (' + w.gap + ' m off it)');
    await page.screenshot({ path: path.join('shots', `${prefix}_walk.png`), timeout: 240000 });
  }
  console.log('stones now:', JSON.stringify(await page.evaluate(() => Engine.world.stones.stats())));
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
