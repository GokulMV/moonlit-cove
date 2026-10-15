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
    /* the ground at a point as it is drawn: its height, its normal from the height field across e either way, its colour,
       and what the land's material makes of it there (bare rock, under the canopy, mangrove mud, a trail's tread) */
    const V = { h: 0, n: [0, 1, 0], c: [0, 0, 0], rk: 0, cv: 0, md: 0, pv: 0 };
    function vert(x, z, e, o) {
      const h = drawnH(x, z), gx = (drawnH(x + e, z) - drawnH(x - e, z)) / (2 * e), gz = (drawnH(x, z + e) - drawnH(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz);
      o.h = h; o.n[0] = -gx / l; o.n[1] = 1 / l; o.n[2] = -gz / l;
      /* (the ground's own colour: in the open, at the forest's edge and in a clearing, grass and herbs over sandy soil, the
         olive of the coast's; under the closed canopy, as it is seen between the crowns from afar, the dark of the
         forest's lower storeys in their shade) */
      const ny = 1 / l, rk = rockAt(x, z, ny), nn = 0.5 + 0.5 * Math.sin(x * 0.11 + z * 0.07) * Math.sin(x * 0.043 - z * 0.061), cv = forest ? forest.cover(x, z) : 1, a = 0.7 + 0.6 * nn, b = 0.75 + 0.5 * (1 - nn);
      /* (and in the mangroves, their mud: SQ is the shore rockAt just looked up) */
      const md = SQ.mangrove * (1 - sm(SQ.W + 16, SQ.W + 42, -I.sdf(x, z)));
      let gr = (0.095 + (0.024 * 0.75 - 0.095) * cv) * a, gg = (0.108 + (0.042 * 0.75 - 0.108) * cv) * a, gb = (0.052 + (0.017 * 0.75 - 0.052) * cv) * a;
      { const mk = sm(0.02, 0.2, md); gr += (0.05 * a - gr) * mk; gg += (0.045 * a - gg) * mk; gb += (0.034 * a - gb) * mk; }
      /* (and a trail's tread, trodden earth) */
      const pv = trails ? trails.tread(x, z) : 0; gr += (0.075 * a - gr) * pv * 0.8; gg += (0.05 * a - gg) * pv * 0.8; gb += (0.03 * a - gb) * pv * 0.8;
      o.c[0] = gr + (0.108 * b - gr) * rk; o.c[1] = gg + (0.1 * b - gg) * rk; o.c[2] = gb + (0.09 * b - gb) * rk; o.rk = rk; o.cv = cv; o.md = md; o.pv = pv;
      return o;
    }
    /* one tile at one level: a grid of the ground, its normals from the height field, its colours (the forest floor and
       its scrub, bare rock), and a skirt hanging from its edges so the tiles of different levels meet without a crack */
    function* tileGeo(t, L) {
      const c = LODS[L].cell, n = Math.round(TS / c) + 1, NV = n * n + 4 * n, P = new Float32Array(NV * 3), N = new Float32Array(NV * 3), C = new Float32Array(NV * 3), RK = new Float32Array(NV), CV = new Float32Array(NV), MD = new Float32Array(NV), PV = new Float32Array(NV);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = t.x + i * c, z = t.z + j * c, k = j * n + i;
          vert(x, z, Math.max(1, c * 0.5), V);
          /* (under a stream's banks, which are drawn finer over it, let down out of their way) */
          P[k * 3] = x; P[k * 3 + 1] = Math.max(V.h - (streams ? streams.sink(x, z) : 0), -2.5); P[k * 3 + 2] = z; N.set(V.n, k * 3); C.set(V.c, k * 3); RK[k] = V.rk; CV[k] = V.cv; MD[k] = V.md; PV[k] = V.pv;
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
    /* ── the streams' banks: the ground along each stream drawn finer than the tiles can draw it (a channel a metre or two
       across in a grid of two-metre cells would be lost), from its bed up its banks and out to where they ease into the
       valley floor; stones in its bed and along its edges, the banks dark and wet down to the water. The tiles under
       them are let down out of their way (streams.sink) ── */
    if (streams) {
      const bankMat = Mats.lit({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, 'land');
      const hs = (a, b) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
      /* (a field of cobbles: value noise on a half-metre grid, its high spots the stones' tops) */
      const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
        return (hs(i, j) * (1 - ux) + hs(i + 1, j) * ux) * (1 - uz) + (hs(i, j + 1) * (1 - ux) + hs(i + 1, j + 1) * ux) * uz; };
      const A = 15, PIECE = 120, B = streams.BANK, VV = { h: 0, n: [0, 1, 0], c: [0, 0, 0], rk: 0, cv: 0, md: 0, pv: 0 };
      for (const s of streams.streams) {
        let i0 = 0; while (i0 < s.n - 1) {
          while (i0 < s.n - 1 && s.BCH[i0] >= 0.9) i0++;
          let i1 = i0; while (i1 < s.n - 1 && i1 - i0 < PIECE && s.BCH[i1] < 0.9) i1++;
          if (i1 - i0 < 2) { i0 = i1 + 1; continue; }
          const m = i1 - i0 + 1, NVb = m * A, P = new Float32Array(NVb * 3), N = new Float32Array(NVb * 3), C = new Float32Array(NVb * 3), RK = new Float32Array(NVb), CV = new Float32Array(NVb), MD = new Float32Array(NVb), PV = new Float32Array(NVb), idx = [];
          for (let k = 0; k < m; k++) {
            const i = i0 + k, a = Math.max(0, i - 1), b = Math.min(s.n - 1, i + 1), tx = s.X[b] - s.X[a], tz = s.Z[b] - s.Z[a], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
            const w = s.W[i] / 2, R = w + 0.35 + B;
            for (let j = 0; j < A; j++) {
              const ac = -1 + 2 * j / (A - 1), d = Math.abs(ac) * R, x = s.X[i] + nx * ac * R, z = s.Z[i] + nz * ac * R, v = k * A + j, rim = j === 0 || j === A - 1;
              vert(x, z, rim ? 1 : 0.3, VV);
              /* (stones: in its bed and up the foot of its banks, round tops standing out of the ground; fewer up the banks) */
              const cz = sm(w + 1.4, w + 0.4, d), cb = Math.max(0, vn(x * 1.9, z * 1.9) - 0.52) * 0.32 + Math.max(0, vn(x * 4.1 + 7, z * 4.1) - 0.6) * 0.12;
              const y = rim ? VV.h : VV.h + cb * cz;
              /* (wet and dark down to the water: the last half metre above it, and what the splash reaches) */
              const above = y - s.Y[i], wet = (1 - sm(0.05, 0.55, above)) * (1 - sm(w + 1.2, w + 2.2, d));
              P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; N.set(VV.n, v * 3); C.set(VV.c, v * 3);
              RK[v] = VV.rk; CV[v] = VV.cv; MD[v] = rim ? VV.md : Math.max(VV.md, 0.85 * wet); PV[v] = VV.pv;
            }
            if (k < m - 1) for (let j = 0; j < A - 1; j++) { const p = k * A + j; idx.push(p, p + 1, p + A, p + 1, p + A + 1, p + A); }
          }
          const g = new T.BufferGeometry();
          g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3));
          g.setAttribute('aRock', new T.BufferAttribute(RK, 1)); g.setAttribute('aCov', new T.BufferAttribute(CV, 1)); g.setAttribute('aMud', new T.BufferAttribute(MD, 1)); g.setAttribute('aPath', new T.BufferAttribute(PV, 1));
          g.setIndex(idx);
          /* (the normals off the stones themselves, but at the strip's edges the tiles' own, so the two meet unseen) */
          { const RN = new Float32Array(m * 6); for (let k = 0; k < m; k++) { RN.set(N.subarray(k * A * 3, k * A * 3 + 3), k * 6); RN.set(N.subarray((k * A + A - 1) * 3, (k * A + A) * 3), k * 6 + 3); }
            g.computeVertexNormals(); const Nn = g.attributes.normal.array; for (let k = 0; k < m; k++) { Nn.set(RN.subarray(k * 6, k * 6 + 3), k * A * 3); Nn.set(RN.subarray(k * 6 + 3, k * 6 + 6), (k * A + A - 1) * 3); } }
          g.computeBoundingSphere();
          const mesh = new T.Mesh(g, bankMat); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh);
          i0 = i1;
        }
      }
    }
    /* (with the island's map on boards where the trails start: at the camp's back and by the jetty's foot) */
    const maps = [[12, 30, Math.PI]];
    if (park) { const j = park.plan.jetty, t = park.plan.tangent, mx = j.x - j.nx * 4 - t[0] * 4, mz = j.z - j.nz * 4 - t[1] * 4; maps.push([mx, mz, Math.atan2(j.nx, j.nz)]); }
    const trailsG = trails ? IsleTrails.build(group, I, trails, { land: (x, z) => Math.max(drawnH(x, z), LEVEL), maps, streams }) : null;
    /* ── the rocky shores' boulders (stones.js) ── */
    const stones = typeof IsleStones !== 'undefined' && typeof StoneKit !== 'undefined' && o.stones !== false ? IsleStones.build(group, I, { land: (x, z) => Math.max(drawnH(x, z), LEVEL), TS, streams,
      /* (none where the park's things stand: the jetty's footing and the hut's ground, and all along the jetty out to its head) */
      avoid: park ? park.plan.clear.concat((() => { const j = park.plan.jetty, out = []; for (let d = -4; d <= j.len + 8; d += 3) out.push([j.x + j.nx * d, j.z + j.nz * d, 4.5]); return out; })()) : [] }) : null;
    /* ── foam round the stones standing in the water, and the spray a wave throws up off them: the coast's own (world.js),
       timed to the same waves, for the stones near the eye ── */
    const surf = (() => {
      if (!stones || typeof World === 'undefined' || !World.SURF) return null;
      const S = World.SURF, surfU = Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uFog: Mats.U.uFog, uNoise: U.uNoise }, Mats.coastU);
      const foamM = new T.ShaderMaterial({ uniforms: surfU, vertexShader: S.FOAM_VS, fragmentShader: S.FOAM_FS, transparent: true, depthWrite: false });
      const sprayM = new T.ShaderMaterial({ uniforms: surfU, vertexShader: S.SPRAY_VS, fragmentShader: S.SPRAY_FS, transparent: true, depthWrite: false });
      const ring = new T.PlaneGeometry(1, 1); ring.rotateX(-Math.PI / 2);
      const CAPF = 320, CAPS = 40, NP = 48, RF = 260, RS = 140;
      const foam = new T.InstancedMesh(ring, foamM, CAPF); foam.count = 0; foam.frustumCulled = false; foam.renderOrder = 5; foam.matrixAutoUpdate = false; group.add(foam);
      const quad = new T.PlaneGeometry(1, 1), sg = new T.InstancedBufferGeometry();
      sg.setIndex(quad.index); sg.setAttribute('position', quad.attributes.position); sg.setAttribute('uv', quad.attributes.uv);
      const aR = new Float32Array(CAPS * NP * 4), aS = new Float32Array(CAPS * NP * 4), rr = Textures.rng(4243);
      for (let i = 0; i < aS.length; i++) aS[i] = rr();
      const aRA = new T.InstancedBufferAttribute(aR, 4); aRA.setUsage(T.DynamicDrawUsage);
      sg.setAttribute('aRock', aRA); sg.setAttribute('aSeed', new T.InstancedBufferAttribute(aS, 4)); sg.instanceCount = 0;
      const spray = new T.Mesh(sg, sprayM); spray.frustumCulled = false; spray.renderOrder = 6; spray.matrixAutoUpdate = false; group.add(spray);
      const m4 = new T.Matrix4(), q0 = new T.Quaternion(), ps = new T.Vector3(), sc = new T.Vector3(), L = [];
      let lx = 1e9, lz = 1e9;
      function update(cx, cz) {
        if (Math.hypot(cx - lx, cz - lz) < 6) return; lx = cx; lz = cz;
        L.length = 0; for (const st of stones.near(cx, cz, RF)) if (st.wet) L.push([(st.x - cx) ** 2 + (st.z - cz) ** 2, st]);
        L.sort((a, b) => a[0] - b[0]);
        const nf = Math.min(CAPF, L.length); for (let i = 0; i < nf; i++) { const st = L[i][1], Rr = st.s * 0.9 * 2.0 + 0.8; m4.compose(ps.set(st.x, 0.07, st.z), q0, sc.set(Rr, 1, Rr)); foam.setMatrixAt(i, m4); }
        foam.count = nf; foam.instanceMatrix.needsUpdate = true;
        let ns = 0; for (let i = 0; i < L.length && ns < CAPS; i++) { if (L[i][0] > RS * RS) break; const st = L[i][1]; for (let j = 0; j < NP; j++) aR.set([st.x, st.z, st.y + st.s * st.sy * 0.8, st.s * 0.9], (ns * NP + j) * 4); ns++; }
        sg.instanceCount = ns * NP; aRA.needsUpdate = true;
      }
      return { update, foam, spray };
    })();
    /* ── what the island's hill and its forest shade from the key light, the sun by day and the moon by night: over the
       grid, at half its resolution, how much of the light reaches each point of the ground, or of the forest's canopy
       where there is forest, looking from it toward the light over the ground and the canopy (the forest a roof as high
       as its trees, with walls at its edges; the mangroves' lower; open over the camp's clearing and the hut's). Drawn
       on the GPU, again whenever the light has moved; GLSL.ISLE_SH reads it, for every shader that the light lights ── */
    const shade = (() => {
      if (!o.R || !Mats.coastU.uIsSh) return null;
      const R = o.R, cu = Mats.coastU, W2 = Math.ceil(G.nx / 2), H2 = Math.ceil(G.nz / 2);
      const rt = new T.WebGLRenderTarget(W2, H2, { depthBuffer: false, stencilBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter, generateMipmaps: false, type: T.UnsignedByteType });
      rt.texture.name = 'isle-shade';
      const clr = [[Layout.camp.x, Layout.camp.z, 25]].concat(park ? [[park.plan.hut.x, park.plan.hut.z, 13]] : []);
      const mat = new T.ShaderMaterial({
        uniforms: { uIsF: cu.uIsF, uIsKC: cu.uIsKC, uIsG: cu.uIsG, uIsD: cu.uIsD, uL: { value: new T.Vector3(0, 1, 0) },
          uClr: { value: [0, 1, 2, 3].map(i => new T.Vector4(...(clr[i] || [0, 0, 0]), 0)) }, uEd: { value: new T.Vector2(3 / W2, 3 / H2) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `
uniform highp sampler2D uIsF; uniform sampler2D uIsKC; uniform vec4 uIsG, uIsD;
uniform vec3 uL;          /* toward the light */
uniform vec4 uClr[4];     /* the clearings: x, z, radius */
uniform vec2 uEd;         /* three texels, as a share of the grid across and down */
varying vec2 vUv;
/* the top of whatever stands at p: the ground (or the sea's surface), and the forest's canopy over it */
float topAt(vec2 p){
  vec2 uv = (p - uIsG.xy)*uIsG.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  float hv = 0.5/uIsD.y, vk = clamp(uv.y, hv, 1.0 - hv)*0.5;
  vec4 f = texture2D(uIsF, uv), k1 = texture2D(uIsKC, vec2(uv.x, vk)), k2 = texture2D(uIsKC, vec2(uv.x, 0.5 + vk));
  float d = -f.x, W = k1.y*50.0, sand = k1.z, rock = k2.x, cliff = k2.y, mang = k2.z;
  /* (where forest.js grows it: back from a beach's top, behind the bare rock of a rocky shore, on the mangroves' mud) */
  float rk = (rock + cliff)*(1.0 - smoothstep(W + 4.0, W + 18.0, d));
  float forest = max(max(smoothstep(W + 16.0, W + 46.0, d)*sand, smoothstep(W + 6.0, W + 20.0, d)*(rock + cliff)), smoothstep(16.0, 44.0, d)*mang)*(1.0 - rk);
  /* (along a beach's top, the palms and the thicket under them: lower, and not a wall) */
  float fringe = sand*smoothstep(W - 4.0, W + 1.0, d)*(1.0 - smoothstep(0.3, 0.6, mang));
  float open = 1.0;
  for (int i = 0; i < 4; i++){ vec4 c = uClr[i]; if (c.z > 0.0) open *= smoothstep(c.z*0.8, c.z + 5.0, length(p - c.xy)); }
  float mg = smoothstep(0.25, 0.6, mang), roof = smoothstep(0.02, 0.22, forest);
  /* (and the mangroves themselves, from out in the water to well up the mud, lower than the forest) */
  float mgr = mg*smoothstep(-12.0, -6.0, d)*(1.0 - smoothstep(18.0, 36.0, d))*13.0;
  return max(f.w, 0.0) + max(roof*mix(26.0, 14.0, mg) + (1.0 - roof)*fringe*8.0, mgr)*open;
}
void main(){
  vec2 p = uIsG.xy + vUv/uIsG.zw;
  vec2 Lh = uL.xz; float lh = length(Lh), top = topAt(p);
  if (lh < 1e-4 || uL.y > 0.999){ gl_FragColor = vec4(1.0, 1.0, clamp(top/400.0, 0.0, 1.0), 0.0); return; }
  Lh /= lh; float tg = uL.y/lh;
  /* (and how high a ray from here would have to start to get past everything: for what lies off the grid, beyond here;
     only at the grid's edges is that wanted: elsewhere, once there is no light left, no need to look further) */
  float h0 = top + 0.8, vis = 1.0, tMin = 1000.0, t = 3.0, req = 0.0;
  bool edge = vUv.x < uEd.x || vUv.y < uEd.y || vUv.x > 1.0 - uEd.x || vUv.y > 1.0 - uEd.y;
  for (int i = 0; i < 60; i++){
    float hr = h0 + t*tg; vec2 q = p + Lh*t, uq = (q - uIsG.xy)*uIsG.zw;
    if (hr > 300.0 || uq.x < 0.0 || uq.y < 0.0 || uq.x > 1.0 || uq.y > 1.0) break;   /* (over everything the island has, or off its grid) */
    float tq = topAt(q), pen = (tq - hr)/(1.4 + t*0.0093);   /* (into what is in the way, over the width of the sun's disc there) */
    float v = clamp(0.5 - pen, 0.0, 1.0);
    if (v < vis){ vis = v; tMin = t; }
    req = max(req, tq - t*tg);
    if (vis <= 0.0 && !edge) break;
    t = t*1.12 + 1.0;
  }
  gl_FragColor = vec4(vis, clamp(tMin/1000.0, 0.0, 1.0), clamp(top/400.0, 0.0, 1.0), clamp(req/400.0, 0.0, 1.0));
}`, depthTest: false, depthWrite: false, toneMapped: false });
      const sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new T.Mesh(new T.PlaneGeometry(2, 2), mat); q.frustumCulled = false; sc.add(q);
      cu.uIsSh.value = rt.texture; cu.uIsShG.value.copy(cu.uIsG.value);
      const last = new T.Vector3(0, -9, 0), L = new T.Vector3(); let lastT = -1e9, ms = 0, n = 0;
      /* (again when the light has moved a twentieth of a degree; no more than four times a second as the time-lapse runs,
         unless it has jumped) */
      function update(dir, force) {
        L.set(dir[0], dir[1], dir[2]).normalize(); const ang = Math.acos(Math.max(-1, Math.min(1, L.dot(last)))), now = performance.now();
        if (!force && (ang < 0.0009 || (ang < 0.035 && now - lastT < 250))) return false;
        const t0 = now, prt = R.getRenderTarget(), pac = R.autoClear;
        mat.uniforms.uL.value.copy(L); R.autoClear = false; R.setRenderTarget(rt); R.render(sc, cam); R.setRenderTarget(prt); R.autoClear = pac;
        last.copy(L); lastT = now; cu.uIsShOn.value = 1; cu.uIsShL.value.copy(L); ms = performance.now() - t0; n++; memo.clear();
        return true;
      }
      /* how much of the light reaches (x, z), for what the engine wants to know of it (how much shade the camera is in):
         the same look toward the light, here on the CPU from the island's own grid (reading the GPU's picture back would
         hold up the frame) */
      const SQ2 = {}, memo = new Map(), ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      function topAt(x, z) {
        const sd = I.sdf(x, z), d = -sd, q = I.shore(I.uAt(x, z), SQ2), W = q.W;
        const rk = (q.rock + q.cliff) * (1 - ss(W + 4, W + 18, d));
        const forest = Math.max(ss(W + 16, W + 46, d) * q.sand, ss(W + 6, W + 20, d) * (q.rock + q.cliff), ss(16, 44, d) * q.mangrove) * (1 - rk);
        const fringe = q.sand * ss(W - 4, W + 1, d) * (1 - ss(0.3, 0.6, q.mangrove));
        let open = 1; for (const c of clr) open *= ss(c[2] * 0.8, c[2] + 5, Math.hypot(x - c[0], z - c[1]));
        const mg = ss(0.25, 0.6, q.mangrove), roof = ss(0.02, 0.22, forest), mgr = mg * ss(-12, -6, d) * (1 - ss(18, 36, d)) * 13;
        return Math.max(I.height(x, z), 0) + Math.max(roof * (26 + (14 - 26) * mg) + (1 - roof) * fringe * 8, mgr) * open;
      }
      function at(x, z) {
        if (!n) return 1;
        const key = Math.round(x / 2) * 100003 + Math.round(z / 2); let v = memo.get(key); if (v !== undefined) return v;
        const lh = Math.hypot(L.x, L.z); v = 1;
        if (lh > 1e-4 && L.y < 0.999) {
          const ux = L.x / lh, uz = L.z / lh, tg = L.y / lh, h0 = topAt(x, z) + 0.8; let t = 3;
          for (let i = 0; i < 60; i++) {
            const hr = h0 + t * tg, qx = x + ux * t, qz = z + uz * t; if (hr > 300 || qx < G.X0 || qz < G.Z0 || qx > G.X0 + G.nx * G.cell || qz > G.Z0 + G.nz * G.cell) break;
            v = Math.min(v, Math.max(0, Math.min(1, 0.5 - (topAt(qx, qz) - hr) / (1.4 + t * 0.0093)))); if (v <= 0) break;
            t = t * 1.12 + 1;
          }
        }
        if (memo.size > 64) memo.clear(); memo.set(key, v); return v;
      }
      /* (and the top of whatever stands at a world point, the ground or the forest's canopy over it: for the explore
         camera, to keep its view clear of the trees) */
      return { update, at, top: (x, z) => topAt(x, z), rt, get ms() { return ms; }, get n() { return n; } };
    })();
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
      if (surf) surf.update(camX, camZ);
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
      if (surf) surf.update(cx, cz);
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
    /* (each with its highest point, for a walker to step up onto one no higher than a long step) */
    /* (the radius each is given is how far its side stands out toward the point asked about, and its size rides along:
       [x, z, radius, kind, peak, size]) */
    const obsOut = [], obstaclesNear = (x, z) => { obsOut.length = 0; if (stones) for (const st of stones.near(x, z, 14)) if (st.s > 0.45) obsOut.push([st.x, st.z, stones.reach(st, x - st.x, z - st.z), 'rock', stones.peakOf(st), st.s]); return obsOut; };
    const wetOut = [], wetNear = (x, z, r) => { wetOut.length = 0; if (stones) for (const st of stones.near(x, z, r)) if (st.wet) wetOut.push({ x: st.x, z: st.z, top: st.y + st.s * st.sy * 0.8, rad: st.s * 0.9, id: st.id }); return wetOut; };
    /* the land's height at a world point, as drawn (on the sand and over the sea, the sand's level) */
    const land = (x, z) => Math.max(drawnH(x, z), LEVEL);
    const massif = (x, z) => { const h = land(x, z); return h > 0.1 ? h * rockAt(x, z, 1) : -9; };
    /* ── where a walker can go, and how high the ground is there: the beaches (and a little way into the water), the
       trails, the camp's clearing and the hut's, the jetty's deck, the boardwalk over the mud. Not the forest itself
       (a rainforest is a wall off its paths), nor the rocks, nor the sea past wading depth ── */
    const WQ = {}, WO = { ok: false, y: 0, kind: '', wade: 0 }, STEP = 0.75;
    /* (and the stones: a walker steps up onto one whose top is no higher than a long step from where they stand (foot),
       stands and walks on it, steps across onto the next, and down off it; one higher stands in their way. Asked without
       foot, any stone's top is where they would stand) */
    function walk(x, z, out = WO, foot) {
      out.deck = false; ground0(x, z, out);
      /* (a deck — the jetty, a footbridge — is over whatever stones lie under it) */
      if (stones && !out.deck && out.kind !== 'deck') { const S = stones.top(x, z); if (S.y > out.y + 0.05) {
        if (foot !== undefined && S.y > foot + STEP) { out.ok = false; out.kind = 'stone'; }
        else { out.ok = true; out.kind = 'rock'; out.y = S.y; out.wade = 0; } } }
      return out;
    }
    function ground0(x, z, out) {
      out.ok = false; out.kind = ''; out.wade = 0; out.y = land(x, z);
      /* (the jetty: along its line from its foot out to its head, its deck's height there) */
      if (park) {
        const j = park.plan.jetty, ax = x - j.x, az = z - j.z, al = ax * j.nx + az * j.nz, ac = -ax * j.nz + az * j.nx, info = park.jetty.userData.info, Lh = info.len;
        if (al > -0.6 && al < Lh + 0.2 && Math.abs(ac) < (al > Lh - 4.8 ? info.headW / 2 - 0.25 : info.width / 2 - 0.2)) { out.ok = true; out.kind = 'deck'; out.y = Math.max(info.deckAt(Math.max(0, al)), out.y); out.deck = true; return out; }
      }
      /* (a trail's tread, or the boardwalk) */
      if (trails) { const q = trails.nearest(x, z); if (q && q.d < q.t.w / 2 + 0.55) { out.ok = true; out.kind = q.t.id === 'creek' ? 'deck' : 'trail'; if (q.t.id === 'creek') out.y = Math.max(out.y, 1.0);
        /* (over a stream, the footbridge's deck) */
        if (trailsG && trailsG.bridges.length) { const y = trailsG.deckAt(x, z); if (y > -1e8) { out.y = Math.max(out.y, y); out.kind = 'deck'; } else if (y < -1.5e9) { out.ok = false; out.kind = 'rail'; } }
        return out; } }
      /* (the camp's clearing, the hut's) */
      if (Math.hypot(x - Layout.camp.x, z - Layout.camp.z) < 24 && z < Layout.camp.z + 18) { out.ok = true; out.kind = 'camp'; }
      if (park && Math.hypot(x - park.plan.hut.x, z - park.plan.hut.z) < 12) { out.ok = true; out.kind = 'grass'; }
      if (out.ok) return out;
      /* (a beach: from out in the water as far as a wade goes, up to the forest's edge. Out in the water the feet are on
         the bottom, the water up to the knees and then the waist, as deep as a metre; past that no one walks) */
      const s = I.sdf(x, z); if (s > 45) return out;
      const fl = s > 0 ? I.height(x, z) : 0; if (s > 0 && fl < -1.0) return out;
      const q = I.shore(I.uAt(x, z), WQ), wd = s > 0 ? Math.max(0, Math.min(1, -fl / 0.9)) : 0;
      if (q.sand > 0.5 && -s < q.W + 1.5) { out.ok = true; out.kind = 'sand'; out.wade = Math.max(wd, Math.max(0, Math.min(1, (s + 0.2) / 1.8)) * 0.6); out.y = s > 0 ? Math.max(fl, -1.0) : out.y; }
      /* (a rocky shore, below its cliffs: the rock itself, where it lies no steeper than a scramble, out to the water and up to
         the forest's edge; the boulders on it are stepped up onto, or round) */
      else if (q.cliff < 0.5 && q.sand + q.rock > 0.5 && -s < q.W + 1.0) {
        const e = 0.6, gx = land(x + e, z) - land(x - e, z), gz = land(x, z + e) - land(x, z - e);
        if (Math.hypot(gx, gz) / (2 * e) < 0.7) { out.ok = true; out.kind = 'rockshore'; out.wade = Math.max(wd, Math.max(0, Math.min(1, (s + 0.2) / 1.8)) * 0.6); if (s > 0) out.y = Math.max(fl, -1.0); }
      }
      return out;
    }
    const none = [];
    return { update, prime, reset: prime, LOD: { tiny: 45, near: 155, fine: 300, mid: 430, rocks: 1050, view: 3400, keep: 3800 }, CW, X0,
      land, hill: land, massif, walk, reefTop: () => -9, reefLines: () => none, obstaclesNear, wetNear,
      /* (what is laid along the coast in chunks is laid along the camp's bay; nothing claims ground before the stones) */
      place: () => {}, decorate,
      get counts() { return { tiles: tiles.length, built: stat.built, worst: +stat.worst.toFixed(2), prime: +(stat.prime || 0).toFixed(1), shown: tiles.reduce((n, t) => n + t.m.filter(m => m && m !== 'none' && m.visible).length, 0),
        treeTiles: tiles.filter(t => t.trees).length, trees: stat.trees || 0, forest: forest ? forest.stats() : null, stones: stones ? stones.stats() : null }; },
      forest, stones, park, trails, trailsG, streams, streamsG, shade,
      get chunks() { return [...bay.values()].filter(ch => ch.built); }, chunkAt: x => bay.get(Math.floor((x - X0) / CW)) || null, resetWorst: () => { stat.worst = 0; }, tiles };
  }
  return { build, LODS, TS };
})();
