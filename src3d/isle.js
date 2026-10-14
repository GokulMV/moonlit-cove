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
  function build(root, U) {
    const I = Layout.island(), G = I.data.grid, LEVEL = I.LEVEL;
    const drawnH = (x, z) => { const h = I.height(x, z); return h - SINK * (1 - sm(1, 5, h)); };
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
      if (any) tiles.push({ x: tx, z: tz, lod: -1, want: -1, m: [null, null, null], job: null });
    }
    const stat = { built: 0, worst: 0, ms: 0 };
    let due = Infinity; const late = () => performance.now() > due;
    /* one tile at one level: a grid of the ground, its normals from the height field, its colours (the forest floor and
       its scrub, bare rock), and a skirt hanging from its edges so the tiles of different levels meet without a crack */
    function* tileGeo(t, L) {
      const c = LODS[L].cell, n = Math.round(TS / c) + 1, NV = n * n + 4 * n, P = new Float32Array(NV * 3), N = new Float32Array(NV * 3), C = new Float32Array(NV * 3), RK = new Float32Array(NV);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = t.x + i * c, z = t.z + j * c, k = j * n + i, h = drawnH(x, z), e = Math.max(1, c * 0.5);
          const gx = (drawnH(x + e, z) - drawnH(x - e, z)) / (2 * e), gz = (drawnH(x, z + e) - drawnH(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz);
          P[k * 3] = x; P[k * 3 + 1] = Math.max(h, -2.5); P[k * 3 + 2] = z; N[k * 3] = -gx / l; N[k * 3 + 1] = 1 / l; N[k * 3 + 2] = -gz / l;
          const ny = 1 / l, rk = rockAt(x, z, ny), nn = 0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.07) * Math.sin(x * 0.043 - z * 0.061), a = 0.7 + 0.6 * nn, b = 0.75 + 0.5 * (1 - nn);
          C[k * 3] = 0.024 * a + (0.14 * b - 0.024 * a) * rk; C[k * 3 + 1] = 0.042 * a + (0.128 * b - 0.042 * a) * rk; C[k * 3 + 2] = 0.017 * a + (0.112 * b - 0.017 * a) * rk; RK[k] = rk;
        }
        if (late()) yield;
      }
      /* the skirt: each edge vertex again, a little lower */
      let v = n * n; const edge = [];
      for (let i = 0; i < n; i++) edge.push(i, (n - 1) * n + i, i * n, i * n + n - 1);
      const skirt = new Int32Array(n * n).fill(-1);
      for (const k of edge) { if (skirt[k] >= 0) continue; skirt[k] = v; P.set([P[k * 3], P[k * 3 + 1] - (1 + c * 0.6), P[k * 3 + 2]], v * 3); N.set(N.subarray(k * 3, k * 3 + 3), v * 3); C.set(C.subarray(k * 3, k * 3 + 3), v * 3); RK[v] = RK[k]; v++; }
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
    let camX = 0, camZ = 0;
    function update(cx, budget = 4, cz) {
      camX = cx; camZ = cz ?? camZ;
      for (const t of tiles) {
        t.want = lodFor(distTo(t, camX, camZ));
        /* (a fine level not wanted any more, far behind, is thrown away) */
        if (t.m[0] && t.m[0] !== 'none' && t.want > 1) { group.remove(t.m[0]); t.m[0].geometry.dispose(); t.m[0] = null; }
        show(t);
      }
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        let best = null, bd = 1e18;
        for (const t of tiles) { if (t.m[t.want]) continue; const d = distTo(t, camX, camZ); if (d < bd) { bd = d; best = t; } }
        if (!best) break;
        if (step(best, best.want, Math.max(0.5, budget - (performance.now() - t0)))) show(best);
      }
    }
    /* the tiles round the camp, at once, so the first frame is whole */
    function prime() { const t0 = performance.now(); update(Layout.camp.x, 0, Layout.camp.z); for (const t of tiles) { const L = t.want; while (L === 0 && !t.m[L]) step(t, L, 1e9); show(t); } stat.prime = performance.now() - t0; }
    /* the land's height at a world point, as drawn (on the sand and over the sea, the sand's level) */
    const land = (x, z) => Math.max(drawnH(x, z), LEVEL);
    const massif = (x, z) => { const h = land(x, z); return h > 0.1 ? h * rockAt(x, z, 1) : -9; };
    const none = [];
    return { update, prime, reset: prime, LOD: { tiny: 45, near: 155, fine: 300, mid: 430, rocks: 1050, view: 3400, keep: 3800 }, CW: 128, X0: -64,
      land, hill: land, massif, reefTop: () => -9, reefLines: () => none, obstaclesNear: () => none, wetNear: () => none,
      /* (nothing yet lives along the island's shore in chunks: what asks to be told of them is kept for when they do) */
      place: () => {}, decorate: () => {},
      get counts() { return { tiles: tiles.length, built: stat.built, worst: +stat.worst.toFixed(2), prime: +(stat.prime || 0).toFixed(1), shown: tiles.reduce((n, t) => n + t.m.filter(m => m && m !== 'none' && m.visible).length, 0) }; },
      get chunks() { return none; }, chunkAt: () => null, resetWorst: () => { stat.worst = 0; }, tiles };
  }
  return { build, LODS, TS };
})();
