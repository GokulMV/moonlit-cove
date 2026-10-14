/* Walking round the island (?island): the walk kept to where a walker can go — along a beach on Auto, along the coastal
   trail on Auto, out on the jetty by hand — every few seconds where the walker is, and that it is somewhere walkable;
   a shot at the end of each. node tools/islandwalk.mjs [prefix iw] [seconds a leg 40] */
import { open, shot, until } from './lib.mjs';
const prefix = process.argv[2] || 'iw', secs = +(process.argv[3] || 40);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 960, h: 540, rs: 0.6, hour: 10, dtCap: 0.25, query: '?island' });
/* (the frames drawn or not: the walk's own logic runs either way, much faster with nothing drawn) */
const fast = on => page.evaluate(on => { if (on) { window.__draw = Engine.render; const S = window.__cove.st.S; Engine.render = () => S; } else if (window.__draw) Engine.render = window.__draw; }, on);
const W = () => page.evaluate(() => { const w = window.__cove.wk, q = Engine.world.walk(w.x, w.z); return { x: +w.x.toFixed(1), z: +w.z.toFixed(1), h: +w.h.toFixed(2), v: +w.v.toFixed(2), ok: q.ok, kind: q.kind, y: +q.y.toFixed(2), eye: +w.cam.pos[1].toFixed(2) }; });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.addStyleTag({ content: '#walkHud, #ctrl, #walkBar, #hint, #hud { display: none !important; }' });
  await page.evaluate(() => document.getElementById('bWalk').click());
  await until(page, () => window.__cove.wk.camK >= 1, null, 150000);
  const legs = [
    { name: 'beach', put: () => { const w = window.__cove.wk; w.x = 40; w.z = Layout.shoreZ(40) + 5; w.h = w.hT = -Math.PI / 2; }, auto: true },
    { name: 'coastal', put: () => { const t = Engine.world.trails.trails.find(t => t.id === 'coastal'), w = window.__cove.wk; w.x = t.X[5]; w.z = t.Z[5]; const dx = t.X[15] - t.X[5], dz = t.Z[15] - t.Z[5]; w.h = w.hT = Math.atan2(-dx, -dz); }, auto: true },
    { name: 'jetty', put: () => { const j = Engine.world.park.plan.jetty, w = window.__cove.wk; w.x = j.x + j.nx * 1; w.z = j.z + j.nz * 1; w.h = w.hT = Math.atan2(-j.nx, -j.nz); }, auto: false }
  ];
  for (const L of legs) {
    await page.evaluate(`(${L.put.toString()})()`);
    await page.evaluate(a => { const c = window.__cove; if (c.wk.auto !== a) document.getElementById('bWalkAuto').click(); c.wk.ox = c.wk.x; c.wk.oz = c.wk.z; }, L.auto);
    if (!L.auto) await page.keyboard.down('w');
    await fast(true);
    const P = [await W()];
    for (let s = 0; s < secs; s += 4) { await page.waitForTimeout(4000); P.push(await W()); }
    if (!L.auto) await page.keyboard.up('w');
    await fast(false);
    const moved = Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].z - P[0].z), bad = P.filter(p => !p.ok);
    console.log('  ' + L.name + ':', P.map(p => `(${p.x},${p.z} ${p.kind} y${p.y} eye${p.eye})`).join(' '));
    ok(moved > 8, `${L.name}: the walker went somewhere (${moved.toFixed(1)} m)`);
    ok(!bad.length, `${L.name}: always on walkable ground` + (bad.length ? ` (not at ${bad.map(p => p.x + ',' + p.z).join(' ')})` : ''));
    if (L.name === 'jetty') ok(P.some(p => p.kind === 'deck' && p.eye > p.y + 1.4), 'on the jetty the eye is over its deck');
    await page.evaluate(([x, z]) => Engine.world.prime(x, z, 2, false), [P[P.length - 1].x, P[P.length - 1].z]);
    await frames(6); await shot(page, prefix + '_' + L.name);
  }
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 900) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
