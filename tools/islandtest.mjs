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
  if (!coast) ok(info.isle && info.ms, `the island is built (${info.ms && info.ms.build} ms) and handed to the shaders (${info.ms && info.ms.gpu} ms)`);
  const view = async (name, pos, look, fov = 50, n = 6, build = 60) => {
    await page.evaluate(([pos, look, fov]) => { window.__coveCamFix = { pos, look, fov, focus: Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]) }; }, [pos, look, fov]);
    /* (the tiles round the eye built at once, every level of them, and the trees on them, before the shot) */
    if (!coast) await page.evaluate(([x, y, z]) => Engine.world.prime(x, z, y, true), pos);
    for (let i = 0; i < Math.min(build, 4) && !coast; i++) await frames(1);
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
