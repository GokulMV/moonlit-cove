/* Driving the van round the island (?island): from the camp along the bay one way, then turned round and back the other;
   every few seconds where the van is, that it is on the beach (between the water and the forest) and that it is going
   somewhere; a shot at the end of each. node tools/islanddrive.mjs [prefix idr] [seconds a leg 30] */
import { open, shot, until } from './lib.mjs';
const prefix = process.argv[2] || 'idr', secs = +(process.argv[3] || 30);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 960, h: 540, rs: 0.6, hour: 10, dtCap: 0.25, query: '?island' });
/* (the frames drawn or not: the drive's own logic runs either way, much faster with nothing drawn) */
const fast = on => page.evaluate(on => { if (on) { window.__draw = Engine.render; const S = window.__cove.st.S; Engine.render = () => S; } else if (window.__draw) Engine.render = window.__draw; }, on);
const C = () => page.evaluate(() => { const c = window.__cove.car, sz = Layout.shoreZ(c.x), vz = Layout.vegZ(c.x), q = Engine.world.walk(c.x, c.z);
  return { x: +c.x.toFixed(1), z: +c.z.toFixed(1), v: +c.v.toFixed(2), sz: +sz.toFixed(1), vz: +vz.toFixed(1), kind: q.kind, m: +Engine.world.massif(c.x, c.z).toFixed(2) }; });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.addStyleTag({ content: '#walkHud, #ctrl, #walkBar, #hint, #hud, #driveHud, #pad { display: none !important; }' });
  await until(page, () => window.__cove && window.__cove.st && window.__cove.st.entered, null, 150000);
  await page.evaluate(() => window.__cove.startDrive());
  ok(await page.evaluate(() => window.__cove.car.on), 'the van is being driven');
  for (const [name, dir] of [['north', -1], ['south', 1]]) {
    /* (on open sand a few metres up from the water, pointing along the beach one way or the other) */
    await page.evaluate(d => { const c = window.__cove.car, x = 8 * d, along = Math.atan2(-Layout.shoreDZ(x), 1); c.x = x; c.z = Layout.shoreZ(x) + Math.min(4, (Layout.vegZ(x) - Layout.shoreZ(x)) * 0.35); c.h = d > 0 ? along : along + Math.PI; c.v = 0; c.wheels = null; }, dir);
    await page.keyboard.down('w'); await fast(true);
    const P = [await C()];
    for (let s = 0; s < secs; s += 3) { await page.waitForTimeout(3000); P.push(await C()); }
    await page.keyboard.up('w'); await fast(false);
    const moved = Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].z - P[0].z), off = P.filter(p => p.z < p.sz - 3.2 || p.z > p.vz + 2.2);
    console.log('  ' + name + ':', P.map(p => `(${p.x},${p.z} v${p.v} ${p.kind} m${p.m})`).join(' '));
    ok(moved > 20, `${name}: the van went somewhere (${moved.toFixed(1)} m)`);
    ok(!off.length, `${name}: always on the beach` + (off.length ? ` (not at ${off.map(p => p.x + ',' + p.z).join(' ')})` : ''));
    await frames(6); await shot(page, prefix + '_' + name);
  }
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 900) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
