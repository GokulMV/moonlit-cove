/* ─────────────────────────────────────────────────────────────
   isle.js — the island's land, when the page is asked for the
   island (Layout.isle): its ground from the shore up to the
   summit, built in tiles a few hundred metres across, finer near
   the eye and coarser far off, a few milliseconds of it a frame.
   Answers what the coast's world.js answers (the height of the
   land, what is rock), so the walk, the camera and everything
   that stands on the ground find it the same way.
   ───────────────────────────────────────────────────────────── */
const IsleWorld = (() => {
  const T = THREE;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const TS = 256;                                     /* a tile's side, m */
  /* the levels: a tile's cell size, and out to how far (from the eye to the tile's nearest edge) it is drawn so */
  const LODS = [{ cell: 2, d: 360 }, { cell: 6, d: 1100 }, { cell: 16, d: Infinity }];
  /* the land's surface as drawn: the island's ground, sunk a little where it is low, so that off the beach it rises out of
     the sand along a clean line (the sand is the ground the sea is drawn with, at 0), never lies flush with it */
  const SINK = 0.22;
  function build(root, U, o = {}) {
    const I = Layout.island(), G = I.data.grid, LEVEL = I.LEVEL;
    /* (the trails (trails.js): where they run the ground is worked to their treads, so it is the drawn ground everything
       here stands on) */
    const trails = typeof IsleTrails !== 'undefined' && o.trails !== false ? IsleTrails.plan(I) : null;
    /* (and the streams (streams.js): their channels cut into it) */
    const streams = typeof IsleStreams !== 'undefined' && o.streams !== false ? IsleStreams.plan(I, { ground: (x, z) => (trails ? trails.ground(x, z, I.height(x, z)) : I.height(x, z)) }) : null;
    const drawnH = (x, z) => { let h = I.height(x, z); if (trails) h = trails.ground(x, z, h); if (streams) h = streams.ground(x, z, h); return h - SINK * (1 - sm(1, 5, h)); };
    /* what is bare rock: the shore's rocks and cliffs and the few metres of land the spray keeps bare behind them, and
       whatever is too steep to hold soil (a rainforest holds on to slopes of forty degrees and more: only a cliff is bare) */
    const SQ = {};
    function rockAt(x, z, ny) {
      const s = I.sdf(x, z), q = I.shore(I.uAt(x, z), SQ), rs = (q.rock + q.cliff * 1.2) * (1 - sm(q.W + 3, q.W + 16, -s));
      return Math.min(1, Math.max(rs, sm(0.48, 0.34, ny)));
    }
    const landMat = Mats.lit({ vertexColors: true, roughness: 0.95 }, 'land');
    const group = new T.Group(); group.name = 'island'; group.matrixAutoUpdate = false; root.add(group);
    /* the tiles: over the island's land and its rocks, wherever any of the ground stands out of the sea */
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) { if (G.H[j * G.nx + i] < 0.05) continue; const x = G.X0 + (i + 0.5) * G.cell, z = G.Z0 + (j + 0.5) * G.cell; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    x0 = Math.floor((x0 - 8) / TS) * TS; z0 = Math.floor((z0 - 8) / TS) * TS;
    const tiles = [];
    for (let tz = z0; tz < z1 + 8; tz += TS) for (let tx = x0; tx < x1 + 8; tx += TS) {
      /* (a tile all under the sea is left out) */
      let any = false; for (let z = tz; z <= tz + TS && !any; z += 4) for (let x = tx; x <= tx + TS; x += 4) if (I.height(x, z) > 0.05) { any = true; break; }
      if (any) tiles.push({ x: tx, z: tz, TS, lod: -1, want: -1, m: [null, null, null], job: null, trees: null, tjob: null, cards: null });
    }
    const stat = { built: 0, worst: 0, ms: 0 };
    let due = Infinity; const late = () => performance.now() > due;
    /* one tile at one level: a grid of the ground, its normals from the height field, its colours (the forest floor and
       its scrub, bare rock), and a skirt hanging from its edges so the tiles of different levels meet without a crack */
    function* tileGeo(t, L) {
      const c = LODS[L].cell, n = Math.round(TS / c) + 1, NV = n * n + 4 * n, P = new Float32Array(NV * 3), N = new Float32Array(NV * 3), C = new Float32Array(NV * 3), RK = new Float32Array(NV), CV = new Float32Array(NV), MD = new Float32Array(NV), PV = new Float32Array(NV);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = t.x + i * c, z = t.z + j * c, k = j * n + i, h = drawnH(x, z), e = Math.max(1, c * 0.5);
          const gx = (drawnH(x + e, z) - drawnH(x - e, z)) / (2 * e), gz = (drawnH(x, z + e) - drawnH(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz);
          P[k * 3] = x; P[k * 3 + 1] = Math.max(h, -2.5); P[k * 3 + 2] = z; N[k * 3] = -gx / l; N[k * 3 + 1] = 1 / l; N[k * 3 + 2] = -gz / l;
          /* (the ground's own colour: in the open, at the forest's edge and in a clearing, grass and herbs over sandy soil, the
             olive of the coast's; under the closed canopy, as it is seen between the crowns from afar, the dark of the
             forest's lower storeys in their shade) */
          const ny = 1 / l, rk = rockAt(x, z, ny), nn = 0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.07) * Math.sin(x * 0.043 - z * 0.061), cv = forest ? forest.cover(x, z) : 1, a = 0.7 + 0.6 * nn, b = 0.75 + 0.5 * (1 - nn);
          /* (and in the mangroves, their mud: SQ is the shore rockAt just looked up) */
          const md = SQ.mangrove * (1 - sm(SQ.W + 16, SQ.W + 42, -I.sdf(x, z)));
          let gr = (0.095 + (0.024 * 0.75 - 0.095) * cv) * a, gg = (0.108 + (0.042 * 0.75 - 0.108) * cv) * a, gb = (0.052 + (0.017 * 0.75 - 0.052) * cv) * a;
          gr += (0.05 * a - gr) * md; gg += (0.045 * a - gg) * md; gb += (0.034 * a - gb) * md;
          /* (and a trail's tread, trodden earth) */
          const pv = trails ? trails.tread(x, z) : 0; gr += (0.075 * a - gr) * pv * 0.8; gg += (0.05 * a - gg) * pv * 0.8; gb += (0.03 * a - gb) * pv * 0.8;
          C[k * 3] = gr + (0.108 * b - gr) * rk; C[k * 3 + 1] = gg + (0.1 * b - gg) * rk; C[k * 3 + 2] = gb + (0.09 * b - gb) * rk; RK[k] = rk; CV[k] = cv; MD[k] = md; PV[k] = pv;
        }
        if (late()) yield;
      }
      /* the skirt: each edge vertex again, a little lower */
      let v = n * n; const edge = [];
      for (let i = 0; i < n; i++) edge.push(i, (n - 1) * n + i, i * n, i * n + n - 1);
      const skirt = new Int32Array(n * n).fill(-1);
      for (const k of edge) { if (skirt[k] >= 0) continue; skirt[k] = v; P.set([P[k * 3], P[k * 3 + 1] - (1 + c * 0.6), P[k * 3 + 2]], v * 3); N.set(N.subarray(k * 3, k * 3 + 3), v * 3); C.set(C.subarray(k * 3, k * 3 + 3), v * 3); RK[v] = RK[k]; CV[v] = CV[k]; MD[v] = MD[k]; PV[v] = PV[k]; v++; }
      const idx = [], up = k => P[k * 3 + 1] > 0.0;
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
        if (!(up(a) || up(b) || up(cc) || up(d))) continue;    /* (all of it under the sand or the sea) */
        idx.push(a, cc, b, b, cc, d);
      }
      const side = (a, b) => { if (!(up(a) || up(b))) return; const sa = skirt[a], sb = skirt[b]; idx.push(a, sa, b, b, sa, sb); };
      for (let i = 0; i < n - 1; i++) { side(i + 1, i); side((n - 1) * n + i, (n - 1) * n + i + 1); side(i * n, (i + 1) * n); side((i + 1) * n + n - 1, i * n + n - 1); }
      if (!idx.length) return null;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(P.subarray(0, v * 3), 3)); g.setAttribute('normal', new T.BufferAttribute(N.subarray(0, v * 3), 3));
      g.setAttribute('color', new T.BufferAttribute(C.subarray(0, v * 3), 3)); g.setAttribute('aRock', new T.BufferAttribute(RK.subarray(0, v), 1));
      g.setAttribute('aCov', new T.BufferAttribute(CV.subarray(0, v), 1)); g.setAttribute('aMud', new T.BufferAttribute(MD.subarray(0, v), 1)); g.setAttribute('aPath', new T.BufferAttribute(PV.subarray(0, v), 1));
      g.setIndex(new T.BufferAttribute(v > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
      g.computeBoundingSphere();
      return g;
    }
    const distTo = (t, cx, cz) => Math.hypot(Math.max(0, t.x - cx, cx - t.x - TS), Math.max(0, t.z - cz, cz - t.z - TS));
    const lodFor = d => LODS.findIndex(L => d < L.d);
    function step(t, L, slice) {
      if (!t.job || t.job.L !== L) t.job = { L, gen: tileGeo(t, L) };
      const t0 = performance.now(); due = t0 + slice;
      const r = t.job.gen.next(); due = Infinity; const dt = performance.now() - t0; stat.worst = Math.max(stat.worst, dt);
      if (!r.done) return false;
      t.job = null; stat.built++;
      if (r.value) { const m = new T.Mesh(r.value, landMat); m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); t.m[L] = m; } else t.m[L] = 'none';
      return true;
    }
    /* which level each tile shows: the one it should have, or the nearest it has while that one is being built */
    function show(t) {
      const has = L => t.m[L] && t.m[L] !== 'none';
      let L = t.want; if (!has(L)) { const alt = [L + 1, L - 1, L + 2, L - 2].find(k => k >= 0 && k < LODS.length && has(k)); L = alt === undefined ? -1 : alt; }
      t.m.forEach((m, k) => { if (m && m !== 'none') m.visible = k === L; });
    }
    /* ── the forest over it (forest.js): every tile's trees planned and carded, nearest tiles first; near the eye the
       trees themselves ── */
    /* ── what the park has built (park.js): the jetty, the hut, the boat; the forest keeps clear of them ── */
    const park = typeof IslePark !== 'undefined' && o.park !== false ? IslePark.build(group, I, { land: (x, z) => Math.max(drawnH(x, z), LEVEL), avoid: streams ? streams.streams.map(s => [s.X[s.n - 1], s.Z[s.n - 1]]) : [] }) : null;
    const forest = o.R && typeof IsleForest !== 'undefined' && o.forest !== false ? IsleForest.build(group, I, { R: o.R, land: (x, z) => land(x, z), keep: (park ? park.plan.clear : []).concat(trails ? trails.clear : [], streams ? streams.clear : []) }) : null;
    const streamsG = streams ? IsleStreams.build(group, I, streams, { sky: { uHor: U.uHor, uZen: U.uZen }, noise: U.uNoise, shade: forest ? (x, z) => 1 - 0.8 * forest.cover(x, z) : null }) : null;
    /* (with the island's map on boards where the trails start: at the camp's back and by the jetty's foot) */
    const maps = [[12, 30, Math.PI]];
    if (park) { const j = park.plan.jetty, t = park.plan.tangent, mx = j.x - j.nx * 4 - t[0] * 4, mz = j.z - j.nz * 4 - t[1] * 4; maps.push([mx, mz, Math.atan2(j.nx, j.nz)]); }
    const trailsG = trails ? IsleTrails.build(group, I, trails, { land: (x, z) => Math.max(drawnH(x, z), LEVEL), maps, streams }) : null;
    /* ── the rocky shores' boulders (stones.js) ── */
    const stones = typeof IsleStones !== 'undefined' && typeof StoneKit !== 'undefined' && o.stones !== false ? IsleStones.build(group, I, { land: (x, z) => Math.max(drawnH(x, z), LEVEL), TS }) : null;
    function treeStep(t, slice) {
      if (!t.tjob) t.tjob = forest.plan(t.x, t.z, TS, late);
      const t0 = performance.now(); due = t0 + slice; const r = t.tjob.next(); due = Infinity; stat.worst = Math.max(stat.worst, performance.now() - t0);
      if (!r.done) return false;
      t.trees = r.value; t.tjob = null; t.cards = forest.cards(t.trees); stat.trees = (stat.trees || 0) + t.trees.length; return true;
    }
    let camX = 0, camZ = 0, camY = 2;
    function update(cx, budget = 4, cz, cy) {
      camX = cx; camZ = cz ?? camZ; camY = cy ?? camY;
      for (const t of tiles) {
        t.want = lodFor(distTo(t, camX, camZ));
        /* (a fine level not wanted any more, far behind, is thrown away) */
        if (t.m[0] && t.m[0] !== 'none' && t.want > 1) { group.remove(t.m[0]); t.m[0].geometry.dispose(); t.m[0] = null; }
        show(t);
      }
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        let best = null, bd = 1e18, kind = 0;
        for (const t of tiles) { const d = distTo(t, camX, camZ); if (!t.m[t.want] && d < bd) { bd = d; best = t; kind = 0; } if (forest && !t.trees && d - 40 < bd) { bd = d - 40; best = t; kind = 1; } }
        if (!best) break;
        const slice = Math.max(0.5, budget - (performance.now() - t0));
        if (kind === 1) treeStep(best, slice); else if (step(best, best.want, slice)) show(best);
      }
      if (forest) forest.nearUpdate(camX, camY, camZ, tiles);
      if (stones) stones.update(camX, camY, camZ, tiles);
      if (park) park.update(performance.now() / 1000);
      bayUpdate(camX, camZ);
    }
    /* the tiles round the camp, at once, so the first frame is whole */
    /* (or round any point, all at once: for a view jumped to, so its first frame is whole too; and every level of the
       tiles in view, not only the near ones, when asked) */
    function prime(cx = Layout.camp.x, cz = Layout.camp.z, cy = 2, all = false) {
      const t0 = performance.now(); update(cx, 0, cz, cy);
      for (const t of tiles) { const L = t.want; while ((L === 0 || all) && L >= 0 && !t.m[L]) step(t, L, 1e9); show(t); if (forest && (L === 0 || all)) while (!t.trees) treeStep(t, 1e9); }
      if (forest) forest.nearUpdate(cx, cy, cz, tiles);
      if (stones) for (let k = 0; k < 12; k++) stones.update(cx, cy, cz, tiles);
      bayUpdate(cx, cz);
      stat.prime = performance.now() - t0;
    }
    /* ── the camp's bay, along x as it always was: its chunks, for what is laid along the coast in each as it comes near
       (flora.js's grass and flowers at the forest's edge, life.js's shells along the tide line, shallows.js's kelp and
       shrimp round the stones standing in the water); built when first near, shown within LOD.tiny ── */
    const CW = 128, X0 = -64, BAYC = [-1, 0, 1], bay = new Map(), tinyHooks = [], LODt = 45;
    const hashC = c => { let h = Math.imul((c | 0) + 7919, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
    function bayChunk(c) {
      let ch = bay.get(c); if (ch) return ch;
      const x0 = X0 + c * CW;
      ch = { c, X0: x0, x0, x1: x0 + CW, camp: Layout.camp.x >= x0 && Layout.camp.x < x0 + CW, seed: 1 + Math.floor(hashC(c) * 1e9), tiny: new T.Group(), wet: [], built: false, own: [] };
      ch.rng = k => Textures.rng(ch.seed + 101 * (k || 0)); ch.keep = g => { ch.own.push(g); return g; }; ch.obstacle = () => {}; ch.near = ch.far = ch.tiny;
      ch.tiny.matrixAutoUpdate = false; ch.tiny.visible = false; group.add(ch.tiny); bay.set(c, ch);
      /* (the stones of its stretch that stand in the water) */
      if (stones) for (const st of stones.all) if (st.wet && st.x >= x0 && st.x < x0 + CW && st.z < 60) ch.wet.push({ x: st.x, z: st.z, top: st.y + st.s * st.sy * 0.8, rad: st.s * 0.9, id: c * 100000 + st.id });
      return ch;
    }
    const bayD = (ch, cx, cz) => Math.hypot(Math.max(0, ch.x0 - cx, cx - ch.x1), Math.max(0, Math.abs(cz - 8) - 34));
    function bayUpdate(cx, cz) {
      for (const c of BAYC) {
        const ch = bayChunk(c), d = bayD(ch, cx, cz);
        if (!ch.built && d < LODt + 40) { ch.built = true; for (const fn of tinyHooks) fn(ch); }
        ch.tiny.visible = ch.built && d < LODt;
      }
    }
    const decorate = (fn, lod = 'near') => { if (lod !== 'tiny') return; tinyHooks.push(fn); for (const ch of bay.values()) if (ch.built) fn(ch); };
    /* what the van must drive round (and a walker step round): the stones big enough to be in the way, [x, z, radius, kind] */
    const obsOut = [], obstaclesNear = (x, z) => { obsOut.length = 0; if (stones) for (const st of stones.near(x, z, 14)) if (st.s > 0.45) obsOut.push([st.x, st.z, st.s * 0.95, 'rock']); return obsOut; };
    const wetOut = [], wetNear = (x, z, r) => { wetOut.length = 0; if (stones) for (const st of stones.near(x, z, r)) if (st.wet) wetOut.push({ x: st.x, z: st.z, top: st.y + st.s * st.sy * 0.8, rad: st.s * 0.9, id: st.id }); return wetOut; };
    /* the land's height at a world point, as drawn (on the sand and over the sea, the sand's level) */
    const land = (x, z) => Math.max(drawnH(x, z), LEVEL);
    const massif = (x, z) => { const h = land(x, z); return h > 0.1 ? h * rockAt(x, z, 1) : -9; };
    /* ── where a walker can go, and how high the ground is there: the beaches (and a little way into the water), the
       trails, the camp's clearing and the hut's, the jetty's deck, the boardwalk over the mud. Not the forest itself
       (a rainforest is a wall off its paths), nor the rocks, nor the sea past wading depth ── */
    const WQ = {}, WO = { ok: false, y: 0, kind: '', wade: 0 };
    function walk(x, z, out = WO) {
      out.ok = false; out.kind = ''; out.wade = 0; out.y = land(x, z);
      /* (the jetty: along its line from its foot out to its head, its deck's height there) */
      if (park) {
        const j = park.plan.jetty, ax = x - j.x, az = z - j.z, al = ax * j.nx + az * j.nz, ac = -ax * j.nz + az * j.nx, info = park.jetty.userData.info, Lh = info.len;
        if (al > -0.6 && al < Lh + 0.2 && Math.abs(ac) < (al > Lh - 4.8 ? info.headW / 2 - 0.25 : info.width / 2 - 0.2)) { out.ok = true; out.kind = 'deck'; out.y = Math.max(info.deckAt(Math.max(0, al)), out.y); return out; }
      }
      /* (a trail's tread, or the boardwalk) */
      if (trails) { const q = trails.nearest(x, z); if (q && q.d < q.t.w / 2 + 0.55) { out.ok = true; out.kind = q.t.id === 'creek' ? 'deck' : 'trail'; if (q.t.id === 'creek') out.y = Math.max(out.y, 1.0); return out; } }
      /* (the camp's clearing, the hut's) */
      if (Math.hypot(x - Layout.camp.x, z - Layout.camp.z) < 24 && z < Layout.camp.z + 18) { out.ok = true; out.kind = 'camp'; }
      if (park && Math.hypot(x - park.plan.hut.x, z - park.plan.hut.z) < 12) { out.ok = true; out.kind = 'grass'; }
      if (out.ok) return out;
      /* (a beach: from a little way out in the water up to the forest's edge) */
      const s = I.sdf(x, z); if (s > 1.4) return out;
      const q = I.shore(I.uAt(x, z), WQ);
      if (q.sand > 0.5 && -s < q.W + 1.5) { out.ok = true; out.kind = 'sand'; out.wade = Math.max(0, Math.min(1, (s + 0.2) / 1.2)); out.y = s > 0 ? 0 : out.y; }
      return out;
    }
    const none = [];
    return { update, prime, reset: prime, LOD: { tiny: 45, near: 155, fine: 300, mid: 430, rocks: 1050, view: 3400, keep: 3800 }, CW, X0,
      land, hill: land, massif, walk, reefTop: () => -9, reefLines: () => none, obstaclesNear, wetNear,
      /* (what is laid along the coast in chunks is laid along the camp's bay; nothing claims ground before the stones) */
      place: () => {}, decorate,
      get counts() { return { tiles: tiles.length, built: stat.built, worst: +stat.worst.toFixed(2), prime: +(stat.prime || 0).toFixed(1), shown: tiles.reduce((n, t) => n + t.m.filter(m => m && m !== 'none' && m.visible).length, 0),
        treeTiles: tiles.filter(t => t.trees).length, trees: stat.trees || 0, forest: forest ? forest.stats() : null, stones: stones ? stones.stats() : null }; },
      forest, stones, park, trails, trailsG, streams, streamsG,
      get chunks() { return [...bay.values()].filter(ch => ch.built); }, chunkAt: x => bay.get(Math.floor((x - X0) / CW)) || null, resetWorst: () => { stat.worst = 0; }, tiles };
  }
  return { build, LODS, TS };
})();
