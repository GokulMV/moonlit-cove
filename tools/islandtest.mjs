/* The island (?island): the page loads with it, the shaders read its shore, its land is built in tiles round the eye.
   Shots from the camp and from the air. node tools/islandtest.mjs [hour 10] [prefix isl] [coast] — with "coast", the same
   shots without the island, to compare the camp's own views with before */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'isl', coast = process.argv[4] === 'coast';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.6, hour, dtCap: 0.25, query: coast ? '' : '?island' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.addStyleTag({ content: '#walkHud, #ctrl, #walkBar, #hint, #hud { display: none !important; }' });
  const info = await page.evaluate(() => ({ isle: Layout.isle, ms: Engine.isleMs, counts: Engine.world && Engine.world.counts }));
  console.log('  ', JSON.stringify(info));
  /* (what the forest's shapes cost to grow, the dearest first) */
  console.log('   grow:', await page.evaluate(() => { const f = Engine.world && Engine.world.forest; return f ? f.protos.slice().sort((a, b) => b.ms - a.ms).map(p => p.kind + '/' + p.seed + ' ' + Math.round(p.ms)).join(', ') : ''; }));
  if (!coast) ok(info.isle && info.ms, `the island is built (${info.ms && info.ms.build} ms) and handed to the shaders (${info.ms && info.ms.gpu} ms)`);
  const view = async (name, pos, look, fov = 50, n = 6, build = 60, hour = null, track = null) => {
    if (hour !== null) await page.evaluate(h => { const st = window.__cove.st; st.hour = h; st.timeMode = 'custom'; }, hour);
    await page.evaluate(([pos, look, fov]) => { window.__coveCamFix = { pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) }; }, [pos, look, fov]);
    /* (the tiles round the eye built at once, every level of them, and the trees on them, before the shot) */
    if (!coast) await page.evaluate(([x, y, z]) => Engine.world.prime(x, z, y, true), pos);
    for (let i = 0; i < Math.min(build, 4) && !coast; i++) await frames(1);
    /* (a view of an animal: once it is out, the camera turned on it where it actually is, from as far as it was set) */
    if (track) { await frames(4); const at = await page.evaluate(k => { const a = Engine.isFauna && Engine.isFauna.out.find(a => a.k === k); return a ? [a.g.position.x, a.g.position.y, a.g.position.z] : null; }, track);
      if (at) { const d = Math.hypot(pos[0] - look[0], pos[2] - look[2]), dx = pos[0] - at[0], dz = pos[2] - at[2], l = Math.hypot(dx, dz) || 1, p2 = [at[0] + dx / l * d, pos[1], at[2] + dz / l * d], l2 = [at[0], at[1] + 0.25, at[2]];
        await page.evaluate(([pos, look, fov]) => { window.__coveCamFix = { pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) }; }, [p2, l2, fov]); }
      else console.log('   (no ' + track + ' out)'); }
    await frames(n); await shot(page, prefix + '_' + name);
    const fo = await page.evaluate(() => Engine.isFauna ? Engine.isFauna.out.map(a => `${a.k}@${a.x.toFixed(0)},${a.z.toFixed(0)}`).join(' ') : ''); if (fo) console.log('   animals out:', fo);
  };
  const V = {
    camp: [[0, 15.2, 21.9], [0, 6.7, -8.6]], beach: [[-30, 2.2, -6], [30, 1.0, -8]],
    east: [[-150, 520, -1300], [-150, 60, 700], 50, 6, 200], south: [[1900, 800, -500], [200, 40, 650], 50, 6, 200],
    top: [[-150, 3200, 700], [-150, 0, 690], 50, 6, 200], west: [[-200, 300, 2600], [-100, 30, 900], 50, 6, 200],
    rocky: [[-700, 22, -170], [-610, 2, -10]], jetty: [[470, 30, -60], [640, 4, 160]], creek: [[1060, 70, 1120], [800, 0, 920]],
    summit: [[-740, 266, 640], [0, 40, -40], 55], westbeach: [[-130, 6, 1330], [150, 2, 1300]], cliffs: [[1240, 60, 300], [1060, 30, 520]],
    reef: [[-560, 45, -140], [-560, 0, 0], 55], reeflow: [[-640, 3, -110], [-560, 0, -20], 55],
    edge: [[-48, 1.8, -8], [-48, 6, 40], 60], campsea: [[10, 7, -95], [0, 22, 80], 55], inland: [[300, 14, 40], [300, 20, 200], 60],
    camptop: [[0, 62, -70], [0, 0, 22], 55], mangrove: [[862, 4, 958], [770, 3, 905], 60]
  };
  /* (the park's own views, from where its jetty and hut were put) */
  const pk = await page.evaluate(() => { const P = Engine.world.park && Engine.world.park.plan; return P ? { j: P.jetty, h: P.hut, e: P.edge, t: P.tangent } : null; });
  if (pk) {
    const { j, h, e, t } = pk, L = j.len + 4.8;
    V.cove = [[e[0] - j.nx * 3 - t[0] * 18, 2.4, e[1] - j.nz * 3 - t[1] * 18], [j.x + j.nx * L * 0.7, 1.2, j.z + j.nz * L * 0.7], 55];
    V.hut = [[h.x + Math.sin(h.yaw) * 13 - Math.cos(h.yaw) * 7, 2.6, h.z + Math.cos(h.yaw) * 13 + Math.sin(h.yaw) * 7], [h.x, 2.4, h.z], 55];
    V.jettyend = [[j.x + j.nx * (L + 14) + t[0] * 8, 3.5, j.z + j.nz * (L + 14) + t[1] * 8], [j.x + j.nx * 4, 3, j.z + j.nz * 4], 55];
  }
  /* (the trails' own: standing on one, looking along it) */
  const tr = await page.evaluate(() => { const P = Engine.world.trails; if (!P) return null; const o = {}; for (const t of P.trails) o[t.id] = { X: Array.from(t.X), Z: Array.from(t.Z), Y: Array.from(t.Y) }; return o; });
  if (tr) {
    const on = (id, i, back = 0, ahead = 16, h = 1.7) => { const t = tr[id]; if (!t) return null; i = Math.max(0, Math.min(t.X.length - 1, i)); const j = Math.min(t.X.length - 1, i + ahead), b = Math.max(0, i - back);
      return [[t.X[b], t.Y[b] + h, t.Z[b]], [t.X[j], t.Y[j] + h * 0.8, t.Z[j]], 60]; };
    V.trail1 = on('saddle', 260); V.trail2 = on('valley', 420); V.trail3 = on('ridge', 700); V.boardwalk = on('creek', 120, 0, 20, 2.6);
    V.coastal = on('coastal', 300); V.tower = (() => { const t = tr.ridge, n = t.X.length - 1; return [[t.X[n - 40], t.Y[n - 40] + 3, t.Z[n - 40]], [t.X[n] - 4, t.Y[n] + 5, t.Z[n] - 2], 55]; })();
    V.trailsky = [[150, 420, -320], [150, 60, 420], 50, 6, 200];
  }
  /* (the streams': at the cove's, looking up it from the beach; and where the valley trail crosses it) */
  const sv = await page.evaluate(() => { const S = Engine.world.streams; if (!S) return null; const s = S.streams.find(s => s.q === 3) || S.streams[0], n = s.n - 1; return { mx: s.X[n], mz: s.Z[n], ux: s.X[n - 40], uz: s.Z[n - 40], uy: s.Y[n - 40], bx: s.X[Math.max(0, n - 120)], bz: s.Z[Math.max(0, n - 120)], by: s.Y[Math.max(0, n - 120)] }; });
  if (sv) { V.stream = [[sv.mx + (sv.mx - sv.ux) * 0.3, 2.2, sv.mz + (sv.mz - sv.uz) * 0.3], [sv.ux, sv.uy, sv.uz], 55]; V.streamup = [[sv.bx + 6, sv.by + 3, sv.bz + 6], [sv.bx, sv.by, sv.bz], 60]; }
  /* (a footbridge: from beside the stream, a few metres down it, looking up at the bridge; and standing on the bank) */
  const bv = await page.evaluate(() => { const G = Engine.world.trailsG, S = Engine.world.streams; if (!G || !G.bridges.length || !S) return null; const B = G.bridges[0], t = B.t, m = (B.a + B.b) >> 1, x = t.X[m], z = t.Z[m], q = S.nearest(x, z); if (!q) return null;
    const s = q.t, j = Math.min(s.n - 1, q.i + 9); return { x, z, y: B.y, dx: s.X[j], dz: s.Z[j], dy: s.Y[j] }; });
  if (bv) { V.bridge = [[bv.dx, bv.dy + 1.6, bv.dz], [bv.x, bv.y, bv.z], 60]; }
  /* (close up: the stream's mouth from the beach beside it; a pool from its bank; the forest's floor at one's feet; the
     stones standing in the sea nearest the camp, from the shore behind them) */
  const cl = await page.evaluate(() => { const W = Engine.world, S = W.streams; if (!S) return null; const s = S.streams.find(s => s.q === 3) || S.streams[0], n = s.n - 1;
    const mb = s.BCH.findIndex(b => b > 0.6), m = mb > 0 ? mb : n - 20, k = Math.max(0, m - 160), k2 = Math.min(n, k + 14), tx = s.X[k2] - s.X[k], tz = s.Z[k2] - s.Z[k], tl = Math.hypot(tx, tz) || 1;
    const o = { mouth: [s.X[m], s.Z[m], s.X[Math.min(n, m + 10)], s.Z[Math.min(n, m + 10)]], pool: [s.X[k] - tz / tl * 4.5, W.land(s.X[k] - tz / tl * 4.5, s.Z[k] + tx / tl * 4.5), s.Z[k] + tx / tl * 4.5, s.X[k2], s.Y[k2], s.Z[k2]] };
    const C = Layout.camp, st = W.stones ? W.stones.all.filter(q => q.wet && q.s > 0.9).sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z))[0] : null;
    if (st) { const q = Layout.Shore.at(st.x, st.z); o.rocks = [st.x - q.nx * 13, st.z - q.nz * 13, st.x, st.y + st.s * 0.5, st.z]; }
    return o; });
  if (cl) {
    const [mx, mz, ex, ez] = cl.mouth, dx = ex - mx, dz = ez - mz, dl = Math.hypot(dx, dz) || 1;
    V.mouth = [[mx - dz / dl * 6 - dx / dl * 3, 1.7, mz + dx / dl * 6 - dz / dl * 3], [mx + dx / dl * 4, 0.1, mz + dz / dl * 4], 60];
    const p = cl.pool; V.pool = [[p[0], p[1] + 1.7, p[2]], [p[3], p[4], p[5]], 60];
    if (cl.rocks) { const r = cl.rocks; V.rocks = [[r[0], 2.0, r[1]], [r[2], r[3], r[4]], 55]; }
  }
  if (tr) { const t = tr.valley, i = 420; V.floor = [[t.X[i], t.Y[i] + 1.7, t.Z[i]], [t.X[i + 5], t.Y[i + 5] - 0.4, t.Z[i + 5]], 60]; }
  /* (the animals of the mangroves: the proboscis monkeys on the mud at their back, the kingfisher on its snag; the flying
     foxes going over the camp at dusk; the fireflies in the creek's trees at night, from the boardwalk) */
  const an = await page.evaluate(() => { const F = Engine.isFauna; if (!F) return null; const C = Layout.camp, near = k => (F.spots[k] || []).slice().sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z))[0] || null;
    const cr = Engine.world.trails && Engine.world.trails.trails.find(t => t.id === 'creek'), i = cr ? Math.floor(0.15 * (cr.n - 1)) : 0, fl = F.flies && F.flies[0];
    return { pb: near('proboscis'), kf: near('kingfisher'), cr: cr ? { x: cr.X[i], z: cr.Z[i], fx: fl ? fl.position.x : cr.X[i] + 8, fy: fl ? fl.position.y : 4.5, fz: fl ? fl.position.z : cr.Z[i] + 3 } : null }; });
  if (an) {
    if (an.pb) { const p = an.pb; V.proboscis = [[p.x + p.nx * 4 - p.tx * 17, 2.2, p.z + p.nz * 4 - p.tz * 17], [p.x, 0.8, p.z], 30, 6, 60, null, 'proboscis']; }
    if (an.kf) { const p = an.kf; V.kingfisher = [[p.x - p.nx * 2 - p.tx * 13, 1.8, p.z - p.nz * 2 - p.tz * 13], [p.x, 1.6, p.z], 25, 10, 60, null, 'kingfisher']; }
    V.bats = [[0, 2.5, 8], [0, 45, -50], 75, 14, 60, 18.2];
    if (an.cr) V.fireflies = [[an.cr.x, 2.9, an.cr.z], [an.cr.fx, an.cr.fy, an.cr.fz], 60, 10, 60, 21];
  }
  /* (the animals' own: by the nearest of their spots to the camp) */
  const fs2 = await page.evaluate(() => { const F = Engine.isFauna; if (!F) return null; const near = k => F.spots[k].slice().sort((a, b) => Math.hypot(a.x - Layout.camp.x, a.z - Layout.camp.z) - Math.hypot(b.x - Layout.camp.x, b.z - Layout.camp.z))[0]; return { pig: near('pig'), egret: near('egret') }; });
  if (fs2) {
    const at = (sp, d, h) => (sp ? [[sp.x + sp.nx * d + sp.tx * 4, h, sp.z + sp.nz * d + sp.tz * 4], [sp.x, 0.6, sp.z], 45] : null);
    V.pigs = at(fs2.pig, 14, 2.2); V.mud = at(fs2.egret, 16, 2.6);
  }
  /* (argv[6]: how far off the forest's trees stand as themselves) */
  if (process.argv[6] !== undefined) await page.evaluate(r => { const f = Engine.world.forest; if (f) f.setNear(r); }, +process.argv[6]);
  const only = (process.argv[5] || 'camp,beach,east,south,top,west').split(',');
  for (const k of only) { const v = V[k]; if (v) await view(k, ...v); }
  const c = await page.evaluate(() => Engine.world.counts); console.log('  ', JSON.stringify(c));
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 900) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
