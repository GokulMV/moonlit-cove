/* ─────────────────────────────────────────────────────────────
   stones.js — the island's rocky shores and the foot of its
   cliffs (Layout.isle): granite boulders, as a granite island's
   shores are, the big rounded corestones piled along the water,
   half in it, the waves' wash round them; smaller ones among them
   and up the bank behind toward the forest; under the cliffs the
   blocks fallen from them, the biggest of all. Each is drawn from
   one of a dozen shapes (models/rocks/granite.js) turned, sized
   and tinted its own way. Near the eye they are the full stones,
   their grooves and spalled sheets; further off the same shapes
   in fewer triangles, then fewer still; beyond, the land's own
   rock colour carries them. Where each lies comes from the shore
   itself, metre by metre, so they are always the same.
   ───────────────────────────────────────────────────────────── */
const IsleStones = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (x, a, b, c, d) => sm(a, b, x) * (1 - sm(c, d, x));
  const hash3 = (a, b, c) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 0x3c6ef372, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  /* the shapes (granite.js's boulder, a metre across its half-width, each its own seed) and the detail each level of them
     is drawn at: up close, at a middle distance, far off */
  const SHAPES = [['round', 3], ['round', 7], ['round', 12], ['round', 19], ['flat', 4], ['flat', 9], ['flat', 15], ['tall', 6], ['tall', 13], ['split', 8], ['round', 23], ['flat', 21]];
  const DET = [12, 5, 2, 24];
  /* how near the stones are drawn whole, and the band over which they give way to their simpler shapes (m); how far off
     the middle level is drawn, and the far one; and how near the big ones are drawn finer still (HERO, m, those bigger
     than HERO_S): their outline smooth however close one comes */
  const NEAR = 70, FADE = 14, MID = 420, FAR = 1000, HERO = 38, HERO_S = 1.15;

  function build(root, I, o) {
    const land = o.land, L = I.data.line, group = new T.Group(); group.name = 'stones'; group.matrixAutoUpdate = false; root.add(group);
    const t0 = performance.now();
    /* ── the shapes, each at its three levels ── */
    const proto = (shape, seed, detail) => { const g = StoneKit.boulder({ size: 1, shape, seed, detail, sink: 0.24 }); g.computeBoundingSphere(); return g; };
    /* (the finest level is made when a big stone first comes near, one shape a frame) */
    const protos = SHAPES.map(([shape, seed]) => DET.map((detail, lev) => lev === 3 ? null : proto(shape, seed, detail)));
    /* the material: granite by the sea (Mats' 'granw': its crystals, its streaks, the sea's bands across it — the black
       lichen of the splash zone, the barnacles, the wet rock and its weed at the water), its near level fading out
       beyond NEAR, the others in within it, dithered pixel by pixel so the two never show at once */
    const fadeU = { value: new T.Vector2(NEAR, NEAR + FADE) };
    const mat = near => {
      const m = Mats.lit({ vertexColors: true, roughness: 0.86 }, 'granw'), prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        prev(sh, r); sh.uniforms.uRkFade = fadeU;
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform vec2 uRkFade;
void main() {
  { float fd = distance(vWPos, cameraPosition), fk = smoothstep(uRkFade.x, uRkFade.y, fd), fh = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233)))*43758.5453);
    if (${near ? 'fk >= fh' : 'fk < fh'}) discard; }`);
      };
      m.customProgramCacheKey = () => 'art-rockw-isle' + (near ? 'N' : 'F');
      return m;
    };
    const matN = mat(true), matF = mat(false);

    /* ── where they lie: along the shore a metre at a time, wherever it is rock or cliff ── */
    const SQ = {};
    /* (the way out to sea at line point i: across the line, whichever side the sea is) */
    const seaward = i => { const tx = L.TX[i], tz = L.TZ[i], l = Math.hypot(tx, tz) || 1; let nx = tz / l, nz = -tx / l; if (I.sdf(L.X[i] + nx * 6, L.Z[i] + nz * 6) < I.sdf(L.X[i] - nx * 6, L.Z[i] - nz * 6)) { nx = -nx; nz = -nz; } return [nx, nz]; };
    /* the classes: how many candidates a metre, the odds of each where the shore is all rock (and all cliff), how far in
       from the water (d, m: negative out in it) they lie, and their sizes (half-widths, m) */
    const CLS = [
      { k: 0, n: 1, rock: 0.2, cliff: 0.42, d: [-5, -2, 4, 7], s: [1.3, 3.0], sc: [2.2, 4.6] },
      { k: 1, n: 2, rock: 0.34, cliff: 0.3, d: [-7, -3, 9, 15], s: [0.55, 1.35], sc: [0.9, 2.0] },
      { k: 2, n: 3, rock: 0.3, cliff: 0.2, d: [-4, -1, 14, 22], s: [0.18, 0.55], sc: [0.3, 0.8] }
    ];
    /* every stone: x, y, z, size, its shape, yaw, tilt, tint; listed by which tile it lies in */
    const byTile = new Map(), TS = o.TS, all = [], AV = o.avoid || [];
    let n = 0;
    for (let i = 0; i < L.n; i++) {
      const kr = L.K[i * 4 + 1], kc = L.K[i * 4 + 2], k = kr + kc; if (k < 0.12) continue;
      const [nx, nz] = seaward(i), tx = -nz, tz = nx, W = L.W[i];
      for (const C of CLS) for (let c = 0; c < C.n; c++) {
        const h = j => hash3(i, C.k * 8 + c, j);
        const odds = (kr * C.rock + kc * C.cliff) / Math.max(k, 1e-3) * sm(0.12, 0.5, k);
        if (h(1) >= odds) continue;
        /* (across the band: the draw, shaped by the band's own fall-off) */
        let d = 0, ok = false;
        for (let tries = 0; tries < 3 && !ok; tries++) { d = C.d[0] + (C.d[3] + (C.k ? W * 0.5 : 0) - C.d[0]) * h(2 + tries); ok = h(5 + tries) < bump(d, C.d[0], C.d[1], C.d[2] + (C.k ? W * 0.5 : 0), C.d[3] + (C.k ? W * 0.5 : 0)); }
        if (!ok) continue;
        const along = (h(9) - 0.5) * 1.6, x = L.X[i] - nx * d + tx * along, z = L.Z[i] - nz * d + tz * along;
        if (AV.some(a => (a[0] - x) ** 2 + (a[1] - z) ** 2 < a[2] * a[2])) continue;
        const cl = kc / Math.max(k, 1e-3), S0 = C.s[0] + (C.sc[0] - C.s[0]) * cl, S1 = C.s[1] + (C.sc[1] - C.s[1]) * cl;
        /* (the sizes skewed small: many little, few big) */
        const s = S0 + (S1 - S0) * Math.pow(h(10), 1.6);
        /* (on the land as it is drawn; out in the water, on the bottom, though never so deep that it is all under) */
        const y = d < 0 ? Math.max(I.height(x, z), -0.55 * s) : land(x, z);
        const st = { x, y: y - 0.06 * s, z, s, p: Math.floor(h(11) * SHAPES.length) % SHAPES.length, yaw: h(12) * TAU, tx: (h(13) - 0.5) * 0.3, tz: (h(14) - 0.5) * 0.3, tint: h(15), sy: 0.85 + 0.3 * h(16), cls: C.k, id: n,
          /* (one that stands in the water, big enough for the waves to slap against) */
          wet: d < 0.6 && s > 0.4 };
        const key = Math.floor(x / TS) + ',' + Math.floor(z / TS);
        if (!byTile.has(key)) byTile.set(key, []);
        byTile.get(key).push(st); all.push(st); n++;
      }
    }
    const planMs = performance.now() - t0;

    /* ── a tile's stones at a level: one instanced mesh a shape (the small ones only at the middle level, never far) ── */
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    const place = st => { e.set(st.tx, st.yaw, st.tz); q.setFromEuler(e); sc.set(st.s, st.s * st.sy, st.s); pos.set(st.x, st.y, st.z); return m4.compose(pos, q, sc); };
    const tintOf = st => { const k = (0.86 + 0.26 * st.tint) * (st.brook ? 0.6 : 1), w = (st.tint * 7.13) % 1; return st.brook ? col.setRGB(k * 0.95, k, k * 0.88) : col.setRGB(k * (0.97 + 0.06 * w), k, k * (1.03 - 0.06 * w)); };
    function meshes(list, lev) {
      const out = [], by = SHAPES.map(() => []);
      for (const st of list) if (lev < 2 || st.cls < 2) by[st.p].push(st);
      by.forEach((L2, p) => {
        if (!L2.length) return;
        const im = new T.InstancedMesh(protos[p][lev], matF, L2.length);
        L2.forEach((st, i) => { im.setMatrixAt(i, place(st)); im.setColorAt(i, tintOf(st)); });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.receiveShadow = true; im.castShadow = lev === 1; im.computeBoundingSphere(); im.matrixAutoUpdate = false;
        group.add(im); out.push(im);
      });
      return out;
    }
    /* the tiles' levels as they are needed: the stones' own tiles, one wherever any lie (not the island's land tiles,
       which leave out those that are all beach and sea: their stones would never be drawn) */
    let own = null;
    const ownTiles = () => own || (own = [...byTile.entries()].map(([k, list]) => { const [a, b] = k.split(',').map(Number); return { x: a * TS, z: b * TS, st: { list, m: [null, null, null], lev: -1 } }; }));
    const tileFor = t => t.st;
    const distTo = (t, cx, cz) => Math.hypot(Math.max(0, t.x - cx, cx - t.x - TS), Math.max(0, t.z - cz, cz - t.z - TS));

    /* ── near the eye: the nearest stones whole, as many of each shape as there is room for ── */
    const CAP = 160, nearIm = protos.map(P => { const im = new T.InstancedMesh(P[0], matN, CAP); im.count = 0; im.frustumCulled = false; im.castShadow = im.receiveShadow = true; im.matrixAutoUpdate = false; group.add(im); return im; });
    const HCAP = 24, heroIm = protos.map(() => null);
    const heroOf = p => { if (heroIm[p]) return heroIm[p]; const P = protos[p]; P[3] = proto(SHAPES[p][0], SHAPES[p][1], DET[3]);
      const im = new T.InstancedMesh(P[3], matN, HCAP); im.count = 0; im.frustumCulled = false; im.castShadow = im.receiveShadow = true; im.matrixAutoUpdate = false; group.add(im); return (heroIm[p] = im); };
    let lastX = 1e9, lastZ = 1e9, frame = 0;
    function update(cx, cy, cz, _landTiles, budget) {
      const tiles = ownTiles();
      /* (each tile: the level it wants, built when first wanted, the others hidden) */
      let built = 0;
      for (const t of tiles) {
        const S = tileFor(t); if (!S.list.length) continue;
        const d = distTo(t, cx, cz), lev = d < MID ? 1 : d < FAR ? 2 : -1;
        if (lev > 0 && !S.m[lev] && built < 1) { S.m[lev] = meshes(S.list, lev); built++; }
        for (let k = 1; k <= 2; k++) if (S.m[k]) for (const m of S.m[k]) m.visible = k === lev || (lev === -1 ? false : !S.m[lev] && k === 3 - lev);
      }
      frame++;
      if (frame % 4 && Math.hypot(cx - lastX, cz - lastZ) < 3) return;
      lastX = cx; lastZ = cz;
      const R2 = (NEAR + FADE + 4) ** 2, pick = SHAPES.map(() => []);
      for (const t of tiles) {
        const S = t.st; if (!S || !S.list.length || distTo(t, cx, cz) > NEAR + FADE + 8) continue;
        for (const st of S.list) { const d2 = (st.x - cx) ** 2 + (st.y - cy) ** 2 * 0.3 + (st.z - cz) ** 2; if (d2 < R2 + st.s * st.s * 4) pick[st.p].push([d2, st]); }
      }
      /* (the nearest big ones at the finest level, the rest at the near one) */
      const H2 = HERO * HERO; let made = 0;
      pick.forEach((P, p) => {
        P.sort((a, b) => a[0] - b[0]); const im = nearIm[p]; let k = 0, h = 0;
        /* (this shape's finest level, if a big one of it is near and it is not made yet: one a frame) */
        let hm = heroIm[p]; if (!hm && !made && P.some(q => q[1].s > HERO_S && q[0] < H2)) { hm = heroOf(p); made++; }
        for (let i = 0; i < P.length && k < CAP; i++) { const st = P[i][1];
          if (hm && st.s > HERO_S && P[i][0] < H2 && h < HCAP) { hm.setMatrixAt(h, place(st)); hm.setColorAt(h, tintOf(st)); h++; }
          else { im.setMatrixAt(k, place(st)); im.setColorAt(k, tintOf(st)); k++; } }
        im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        if (hm) { hm.count = h; hm.instanceMatrix.needsUpdate = true; if (hm.instanceColor) hm.instanceColor.needsUpdate = true; }
      });
      if (made) lastX = 1e9;
    }
    const stats = () => ({ stones: n, planMs: Math.round(planMs), near: nearIm.reduce((a, m) => a + m.count, 0), hero: heroIm.reduce((a, m) => a + (m ? m.count : 0), 0), tiles: byTile.size });
    /* ── each shape's top, for a walker stepping up onto a stone: over a grid across its footprint, the highest its surface
       comes over each cell (its triangles laid flat onto the grid); and its highest point. A stone's top at a world
       point is its shape's, turned, tilted and sized as the stone is ── */
    const TN = 28, tops = protos.map(P => {
      const g = P[0], p = g.attributes.position.array, ix = g.index.array;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, peak = 0;
      for (let i = 0; i < p.length; i += 3) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]); peak = Math.max(peak, p[i + 1]); }
      const H = new Float32Array(TN * TN).fill(-1), dx = (x1 - x0) / TN, dz = (z1 - z0) / TN;
      for (let t = 0; t < ix.length; t += 3) {
        const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
        const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-12) continue;
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / dx - 0.5)), i1 = Math.min(TN - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / dx - 0.5));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / dz - 0.5)), j1 = Math.min(TN - 1, Math.ceil((Math.max(az, bz, cz) - z0) / dz - 0.5));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * dx, pz = z0 + (j + 0.5) * dz;
          const w0 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, w1 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den, w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const y = w0 * p[a + 1] + w1 * p[b + 1] + w2 * p[c + 1], k = j * TN + i; if (y > H[k]) H[k] = y;
        }
      }
      return { H, x0, z0, dx, dz, peak };
    });
    /* (the stone's top over a world point, or -1e9 off it: the point taken into the stone's own frame, its shape's height
       there read off the grid, and that point of its surface taken back out, twice over for the tilt) */
    const _q = new T.Quaternion(), _qi = new T.Quaternion(), _v = new T.Vector3();
    function topOf(st, x, z) {
      const S = tops[st.p];
      e.set(st.tx, st.yaw, st.tz); _q.setFromEuler(e); _qi.copy(_q).invert();
      let wx = x, wz = z, y = -1e9;
      for (let it = 0; it < 2; it++) {
        _v.set(wx - st.x, 0, wz - st.z).applyQuaternion(_qi);
        const lx = _v.x / st.s, lz = _v.z / st.s, gx = (lx - S.x0) / S.dx - 0.5, gz = (lz - S.z0) / S.dz - 0.5, i = Math.floor(gx), j = Math.floor(gz);
        if (i < 0 || j < 0 || i >= TN - 1 || j >= TN - 1) return -1e9;
        const fx = gx - i, fz = gz - j, H = S.H, h00 = H[j * TN + i], h10 = H[j * TN + i + 1], h01 = H[(j + 1) * TN + i], h11 = H[(j + 1) * TN + i + 1];
        if (h00 < 0 || h10 < 0 || h01 < 0 || h11 < 0) return -1e9;
        const h = (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
        _v.set(lx * st.s, h * st.s * st.sy, lz * st.s).applyQuaternion(_q);
        y = st.y + _v.y; wx += x - (st.x + _v.x); wz += z - (st.z + _v.z);
      }
      return y;
    }
    /* the highest stone top over a point (-1e9 where there is none), and the stone */
    const TOP = { y: -1e9, st: null }, _nl = [];
    function top(x, z) {
      TOP.y = -1e9; TOP.st = null;
      for (const st of near(x, z, 0.2, _nl)) { if (st.s < 0.3) continue; const y = topOf(st, x, z); if (y > TOP.y) { TOP.y = y; TOP.st = st; } }
      return TOP;
    }
    /* (a stone's highest point) */
    const peakOf = st => st.y + tops[st.p].peak * st.s * st.sy;
    /* ── each shape's footprint: how far out from its middle its side stands, every 15° round, over the height of the
       van and the walker (its foot's flare, its bulges, its squared corners all in it), a little generous: so the van
       stops at a boulder's side and a walker brushes it, rather than either going in ── */
    const NB = 24, foot = protos.map(P => {
      const p = P[0].attributes.position.array, F = new Float32Array(NB);
      for (let i = 0; i < p.length; i += 3) { if (p[i + 1] < -0.16) continue; const b = ((Math.round(Math.atan2(p[i + 2], p[i]) / TAU * NB) % NB) + NB) % NB, r = Math.hypot(p[i], p[i + 2]); if (r > F[b]) F[b] = r; }
      const G = new Float32Array(NB); for (let b = 0; b < NB; b++) G[b] = 1.02 * Math.max(F[b], 0.5 * (F[b] + Math.max(F[(b + 1) % NB], F[(b + NB - 1) % NB])));
      return G;
    });
    const FPMAX = Math.max(1.3, ...foot.map(G => Math.max(...G)));
    /* (how far a stone's side stands out toward a world direction (dx, dz) from its middle: the direction taken into the
       stone's own frame, its shape's footprint read there between the two nearest bearings, sized as the stone is) */
    function reach(st, dx, dz) {
      e.set(st.tx, st.yaw, st.tz); _q.setFromEuler(e); _qi.copy(_q).invert();
      _v.set(dx, 0, dz).applyQuaternion(_qi);
      const G = foot[st.p], f = ((Math.atan2(_v.z, _v.x) / TAU * NB) % NB + NB) % NB, b0 = Math.floor(f) % NB, t = f - Math.floor(f);
      return st.s * (G[b0] * (1 - t) + G[(b0 + 1) % NB] * t);
    }
    /* ── and the streams' own stones (streams.js): the boulders of each step lined across it, the water pouring between and
       over them; a boulder now and then in a pool, its top just out of the water; cobbles along its edges and up the
       foot of its banks, half sunk in them. Dark with the wet ── */
    if (o.streams) for (const S of o.streams.streams) {
      const hs = k => hash3(S.q + 40, k, 77);
      const add = (x, z, s, top, k, bury, tall = 0) => {
        const p = Math.floor(hs(k) * SHAPES.length) % SHAPES.length, sy = 0.7 + 0.3 * hs(k + 5) + tall, y = top === null ? land(x, z) - bury * s : top - tops[p].peak * s * sy;
        const st = { x, y, z, s, p, yaw: hs(k + 1) * TAU, tx: (hs(k + 2) - 0.5) * 0.3, tz: (hs(k + 3) - 0.5) * 0.3, tint: hs(k + 4), sy, cls: s > 1.3 ? 0 : s > 0.5 ? 1 : 2, id: n, wet: false, brook: true };
        const key = Math.floor(x / TS) + ',' + Math.floor(z / TS); if (!byTile.has(key)) byTile.set(key, []); byTile.get(key).push(st); all.push(st); n++;
      };
      const frame = i => { const a = Math.max(0, i - 1), b = Math.min(S.n - 1, i + 1), tx = S.X[b] - S.X[a], tz = S.Z[b] - S.Z[a], l = Math.hypot(tx, tz) || 1; return [-tz / l, tx / l]; };
      for (const i of S.steps) {
        const [nx, nz] = frame(i), w = S.W[i] / 2, m = Math.max(2, Math.round(2 * w / 0.5));
        for (let k = 0; k <= m; k++) { const kk = i * 31 + k, ac = -1.08 + 2.16 * k / m + (hs(kk) - 0.5) * 0.12;
          add(S.X[i] + nx * ac * w, S.Z[i] + nz * ac * w, 0.28 + 0.28 * hs(kk + 500), S.Y[i] + 0.04 + 0.16 * hs(kk + 900), kk + 1300, 0, 0.35); }
      }
      for (let i = 2; i < S.n - 2; i += 2) {
        if (S.BCH[i] > 0.3) continue;
        const [nx, nz] = frame(i), w = S.W[i] / 2, steep = Math.min(1, S.ST[i] / 0.15), kk = 70000 + i * 7;
        /* (a boulder in the pool) */
        if (S.SP[i] > 2.5 && S.SP[i] < 98 && hs(kk) < 0.07 + 0.08 * steep) { const ac = (hs(kk + 1) - 0.5) * 1.1; add(S.X[i] + nx * ac * w, S.Z[i] + nz * ac * w, 0.35 + 0.35 * hs(kk + 2), S.Y[i] + 0.04 + 0.2 * hs(kk + 3), kk + 4, 0); }
        /* (cobbles at its edges and up its banks' foot) */
        for (const side of [-1, 1]) if (hs(kk + (side > 0 ? 10 : 20)) < 0.32 + 0.4 * steep) {
          const ac = side * (0.78 + 0.5 * hs(kk + (side > 0 ? 11 : 21))), x = S.X[i] + nx * ac * w + (hs(kk + 30) - 0.5), z = S.Z[i] + nz * ac * w + (hs(kk + 31) - 0.5);
          add(x, z, 0.13 + (0.22 + 0.2 * steep) * Math.pow(hs(kk + (side > 0 ? 12 : 22)), 1.5), null, kk + (side > 0 ? 40 : 50), 0.35);
        }
      }
    }
    /* the stones within r of a point (for the walk to climb them, the waves' slap on those in the water) */
    function near(x, z, r, out = []) {
      out.length = 0;
      for (let tz = Math.floor((z - r - 9) / TS); tz <= Math.floor((z + r + 9) / TS); tz++) for (let tx = Math.floor((x - r - 9) / TS); tx <= Math.floor((x + r + 9) / TS); tx++) {
        const L2 = byTile.get(tx + ',' + tz); if (!L2) continue;
        for (const st of L2) if ((st.x - x) ** 2 + (st.z - z) ** 2 < (r + st.s * FPMAX) ** 2) out.push(st);
      }
      return out;
    }
    return { update, stats, near, top, topOf, peakOf, reach, all, protos, mats: [matN, matF] };
  }
  return { build, SHAPES, NEAR };
})();
