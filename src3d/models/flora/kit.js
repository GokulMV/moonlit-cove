/* ─────────────────────────────────────────────────────────────
   models/flora/kit.js — what the forest's plants are made from.
   FloraKit.bark(kind): bark that tiles round a trunk and up it, as a
     colour map and a normal map drawn from one height field: the
     plates and fissures of a meranti, the smooth pale skin of a
     tualang, the shaggy flakes of a kapur, a fig's grey wrinkles, a
     mangrove's tessellated bark, a tree fern's matted fibres …
   (the trunks, buttresses, limbs and leaves that use it follow below)
   ───────────────────────────────────────────────────────────── */
const FloraKit = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t, mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  /* ── noise that tiles: value noise and cells on a lattice that wraps after px × py of its cells (each at most 512) ── */
  function noiseKit(seed) {
    const N = 512, r = Models.rng(seed), L = new Float32Array(N * N), J = new Float32Array(N * N * 2), I = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) { L[i] = r(); J[i * 2] = r(); J[i * 2 + 1] = r(); I[i] = r(); }
    const wrap = (i, p) => ((i % p) + p) % p;
    function vn(x, y, px, py) {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const x0 = wrap(ix, px), x1 = wrap(ix + 1, px), y0 = wrap(iy, py) * N, y1 = wrap(iy + 1, py) * N;
      const a = L[y0 + x0], b = L[y0 + x1], c = L[y1 + x0], d = L[y1 + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    /* (each octave twice the cells over the same tile, so the sum still tiles; past the lattice's size it stops) */
    function fbm(x, y, px, py, oct = 4, g = 0.5) { let s = 0, a = 1, n = 0; for (let o = 0; o < oct && px <= N && py <= N; o++) { s += a * vn(x, y, px, py); n += a; a *= g; x *= 2; y *= 2; px *= 2; py *= 2; } return s / n; }
    /* cells: one jittered point in each lattice cell; the distance to the nearest (f1) and the next (f2), which cell (id
       0..1), and the offset to the nearest (dx, dy), written into out */
    function cell(x, y, px, py, out, jit = 0.85) {
      const ix = Math.floor(x), iy = Math.floor(y); let f1 = 9, f2 = 9, id = 0, dx = 0, dy = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = ix + i, cy = iy + j, k = wrap(cy, py) * N + wrap(cx, px);
        const qx = cx + 0.5 + (J[k * 2] - 0.5) * jit - x, qy = cy + 0.5 + (J[k * 2 + 1] - 0.5) * jit - y, d = Math.sqrt(qx * qx + qy * qy);
        if (d < f1) { f2 = f1; f1 = d; id = I[k]; dx = qx; dy = qy; } else if (d < f2) f2 = d;
      }
      out[0] = f1; out[1] = f2; out[2] = id; out[3] = dx; out[4] = dy; return out;
    }
    /* cells, measuring how far the point is from its cell's edge in metres: sx, sy are the metres one lattice step covers
       across and up (the cells are drawn in lattice steps, so a tall narrow lattice gives tall narrow cells, but each
       edge's distance is measured on the bark itself, so a cell's end is as sharp as its sides). out: [edge distance (m),
       f1, cell id, dx, dy] */
    function cellE(x, y, px, py, sx, sy, out, jit = 0.85) {
      const ix = Math.floor(x), iy = Math.floor(y); let f1 = 9, f2 = 9, id = 0, ax = 0, ay = 0, bx = 0, by = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const cx = ix + i, cy = iy + j, k = wrap(cy, py) * N + wrap(cx, px);
        const qx = cx + 0.5 + (J[k * 2] - 0.5) * jit - x, qy = cy + 0.5 + (J[k * 2 + 1] - 0.5) * jit - y, d = qx * qx + qy * qy;
        if (d < f1) { f2 = f1; bx = ax; by = ay; f1 = d; id = I[k]; ax = qx; ay = qy; } else if (d < f2) { f2 = d; bx = qx; by = qy; }
      }
      /* (the edge between the two nearest, on the bark: its line through their midpoint, square to the line joining them) */
      let nx = bx - ax, ny = by - ay; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const dxp = -ny * sx, dyp = nx * sy, dl = Math.hypot(dxp, dyp) || 1, mx = (ax + bx) * 0.5 * sx, my = (ay + by) * 0.5 * sy;
      out[0] = Math.abs(mx * (-dyp / dl) + my * (dxp / dl)); out[1] = Math.sqrt(f1); out[2] = id; out[3] = ax; out[4] = ay; return out;
    }
    /* ridged: 1 along the lines where the noise crosses its middle value, falling away either side */
    const rid = (x, y, px, py) => 1 - Math.abs(2 * vn(x, y, px, py) - 1);
    return { vn, fbm, cell, cellE, rid, N };
  }
  /* a periodic box blur of a W × H field, radius rx, ry texels (prefix sums along rows, then columns) */
  function blur(F, W, H, rx, ry) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H), row = new Float64Array(W * 3 + 1), col = new Float64Array(H * 3 + 1);
    for (let j = 0; j < H; j++) {
      row[0] = 0; for (let i = 0; i < W * 3; i++) row[i + 1] = row[i] + F[j * W + (i % W)];
      for (let i = 0; i < W; i++) tmp[j * W + i] = (row[W + i + rx + 1] - row[W + i - rx]) / (2 * rx + 1);
    }
    for (let i = 0; i < W; i++) {
      col[0] = 0; for (let j = 0; j < H * 3; j++) col[j + 1] = col[j] + tmp[(j % H) * W + i];
      for (let j = 0; j < H; j++) out[j * W + i] = (col[H + j + ry + 1] - col[H + j - ry]) / (2 * ry + 1);
    }
    return out;
  }

  /* ── bark. Each kind draws its bark in two steps. hgt(u, v, K, o) sets, at (u, v) on its tile (u round the trunk, v up
     it, both 0..1), the bark's height (0 the deepest fissure, 1 the top of the bark) and up to three masks of its own
     (o[0..3]). Then col(u, v, P, K) colours it, knowing the height, how far down in a hollow it is (P.cav: the height
     round about less the height here, so a fissure's bottom is dark: a normal map casts no shadow of its own), how much
     it stands out (P.cvx: an edge, worn lighter) and the masks; it returns [r, g, b] (linear) and a roughness.
     tile: the metres the tile covers, across and up; depth: how deep its relief is, in metres ── */
  /* ── fissures as a phase: across the tile the phase runs from 0 to n (n ridges), wandering slowly left and right as it
     goes up, so its whole numbers are n long fissures running up the trunk, never closing on themselves. Each fissure
     opens and narrows along its length (fading out where two ridges merge), and here and there a shorter one splits a
     ridge down its middle. Sets in F: g (how deep in a fissure, 0..1), t (where across its ridge, 0..1), id (which ridge,
     0..1), w (how wide the fissure is there) ── */
  function fissures(u, v, K, n, wob, wf, w0, F, seed = 0) {
    const ph = u * n + (K.fbm(u * 2 + seed, v * wf, 2, wf, 3) - 0.5) * wob * 2 + (K.fbm(u * 5 + seed * 1.7, v * wf * 3, 5, wf * 3, 2) - 0.5) * wob * 0.6;
    const fi = Math.floor(ph), t = ph - fi, ri = ((fi % n) + n) % n;
    /* (each fissure's width along it, from its own noise: the fissure at the left edge of ridge ri is fissure ri) */
    const wl = w0 * (0.25 + 1.5 * K.vn(ri * 13.37 + seed, v * wf * 2, 512, wf * 2)), wr = w0 * (0.25 + 1.5 * K.vn(((ri + 1) % n) * 13.37 + seed, v * wf * 2, 512, wf * 2));
    const gl = 1 - sm(0, wl, t), gr = 1 - sm(0, wr, 1 - t);
    /* (a split down the ridge's middle, in places) */
    const sp = sm(0.62, 0.78, K.vn(ri * 7.91 + 3.3 + seed, v * wf * 1.5, 512, Math.max(1, Math.round(wf * 1.5)))), gs = sp * (1 - sm(0, w0 * 0.7, Math.abs(t - 0.5)));
    F.g = Math.max(gl, gr, gs * 0.7); F.t = t; F.id = ri / n + 0.5 / n; F.w = Math.max(wl, wr); return F;
  }

  /* ── bark. Each kind draws its bark in two steps. hgt(u, v, K, o) sets, at (u, v) on its tile (u round the trunk, v up
     it, both 0..1), the bark's height (0 the deepest fissure, 1 the top of the bark) and up to three masks of its own
     (o[1..3]). Then col(u, v, P, K) colours it, knowing the height, how far down in a hollow it is (P.cav: the height
     round about less the height here, so a fissure's bottom is dark: a normal map casts no shadow of its own), how much
     it stands out (P.cvx: an edge, worn lighter) and the masks; it returns [r, g, b] (linear) and a roughness.
     tile: the metres the tile covers, across and up; depth: how deep its relief is, in metres ── */
  const F_ = { g: 0, t: 0, id: 0, w: 0 };
  /* soft-edged patches covering about `share` of the bark, their edges ragged at a finer scale */
  const patches = (u, v, K, f, share, seed) => sm(1 - share - 0.04, 1 - share + 0.04, K.fbm(u * f + seed, v * f + seed * 0.7, f, f, 6) + 0.12 * (K.vn(u * f * 8 + seed, v * f * 8, f * 8, f * 8) - 0.5));
  const BARK = {
    /* meranti (Shorea): deeply and closely fissured, grey to pinkish brown. V-shaped fissures a centimetre or two deep run
       up the trunk between ridges three to five centimetres across, wandering, widening and narrowing, a ridge split in two
       here and there; the ridges checked across every few centimetres into blocks, crumbling in small flakes that leave a
       pinkish-brown scar. The fissures' walls are warm brown, their bottoms dark; the ridge tops weathered grey, with
       soft-edged crusts of pale lichen and, now and then, the rusty stain of algae */
    meranti: { w: 512, h: 1024, tile: [0.6, 1.2], seed: 11, depth: 0.03,
      hgt(u, v, K, o) {
        /* (the network: long narrow plates, cells ten times as tall as they are wide, their edges ragged) */
        const c = K.c, wx = (K.fbm(u * 3, v * 2, 3, 2, 3) - 0.5) * 0.5 + (K.vn(u * 40, v * 40, 40, 40) - 0.5) * 0.12, wy = (K.fbm(u * 3 + 0.5, v * 2 + 0.3, 3, 2, 3) - 0.5) * 0.3;
        K.cellE(u * 10 + wx, v * 2 + wy, 10, 2, 0.06, 0.6, c, 0.95); const e1 = c[0], id = c[2];
        K.cellE(u * 23 + wx * 2, v * 5 + wy * 2, 23, 5, 0.026, 0.24, K.c2, 0.95); const e2 = K.c2[0];
        /* (V-shaped fissures a centimetre or so either side of the plates' edges, their width wandering) */
        const g1 = 1 - sm(0.0, 0.011 + 0.008 * K.vn(u * 7, v * 5, 7, 5), e1), g2 = (1 - sm(0.0, 0.0045, e2)) * sm(0.35, 0.6, K.vn(u * 9 + 3, v * 7, 9, 7));
        /* (each plate checked across in places, rough on top, and flaking) */
        const ck = v * 13 + id * 9.1 + 0.45 * (K.vn(u * 30, v * 13, 30, 13) - 0.5), cf = ck - Math.floor(ck);
        const chk = (1 - sm(0.0, 0.05, Math.min(cf, 1 - cf))) * sm(0.55, 0.7, K.vn(id * 97 + Math.floor(ck) * 0.37, 0.5, 512, 512));
        const fn = K.fbm(u * 16 + 2.2, v * 14, 16, 14, 4), fl = sm(0.645, 0.67, fn) * (1 - g1);
        const rough = 0.09 * (K.fbm(u * 48, v * 40, 48, 40, 3) - 0.5) + 0.04 * (K.vn(u * 220, v * 300, 220, 300) - 0.5);
        o[0] = clamp(0.88 - 0.72 * Math.pow(g1, 0.75) - 0.22 * g2 * (1 - g1) + (id - 0.5) * 0.16 * (1 - g1) - 0.1 * chk * (1 - g1) - 0.1 * fl + rough);
        o[1] = fl; o[2] = patches(u, v, K, 3, 0.22, 1.7); o[3] = id;
      },
      col(u, v, P, K) {
        const h = P.h, top = sm(0.5, 0.8, h), id = P.m3;
        /* (the fissures' walls warm brown and their bottoms dark but never black; each plate's own grey-brown or pinker
           brown, mottled) */
        const plate = mix3(mix3([0.13, 0.112, 0.096], [0.165, 0.128, 0.105], id), [0.19, 0.172, 0.152], K.fbm(u * 5, v * 4, 5, 4, 3) * 0.7);
        let col = mix3(mix3([0.07, 0.044, 0.031], [0.13, 0.08, 0.056], sm(0.12, 0.5, h)), plate, top);
        col = mix3(col, mix3([0.17, 0.1, 0.075], [0.2, 0.125, 0.095], K.vn(u * 60, v * 60, 60, 60)), P.m1 * 0.8);
        col = mix3(col, mix3([0.23, 0.24, 0.21], [0.29, 0.3, 0.265], K.vn(u * 40, v * 40, 40, 40)), P.m2 * (0.15 + 0.45 * top));
        col = mix3(col, [0.16, 0.07, 0.025], sm(0.72, 0.8, K.fbm(u * 2 + 5.1, v * 2 + 2.2, 2, 2, 5)) * 0.3 * (0.3 + 0.7 * top));
        const mo = 0.9 + 0.2 * K.fbm(u * 3 + 9.1, v * 2, 3, 2, 3), ao = Math.max(0.58, 1 - 3 * Math.max(0, P.cav)), ed = 1 + 0.8 * Math.max(0, P.cvx);
        return [col.map(q => q * mo * ao * ed), 0.92 - 0.06 * top];
      } },
    /* tualang (Koompassia excelsa): fairly smooth and faintly glossy, purplish grey with a faint green tint; broad soft
       mottling; ringed with fine, shallow hoops, broken and faint */
    tualang: { w: 512, h: 1024, tile: [0.9, 1.8], seed: 23, depth: 0.0025,
      hgt(u, v, K, o) {
        const b = K.fbm(u * 3, v * 2, 3, 2, 5), ring = v * 26 + (K.fbm(u * 2, v * 2 + 0.7, 2, 2, 3) - 0.5) * 2.4, fr = ring - Math.floor(ring);
        const hoop = (1 - sm(0, 0.16, Math.abs(fr - 0.5))) * sm(0.6, 0.8, K.vn(u * 4, v * 26, 4, 26));
        o[0] = clamp(0.6 + 0.25 * (b - 0.5) + 0.05 * (K.fbm(u * 24, v * 24, 24, 24, 2) - 0.5) - 0.025 * hoop);
        o[1] = hoop; o[2] = patches(u, v, K, 2, 0.35, 4.1); o[3] = patches(u, v, K, 5, 0.15, 7.7);
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 2, 3, 2, 5);
        const big = K.fbm(u * 2 + 1.1, v * 1 + 0.3, 2, 1, 4);
        let col = mix3([0.12, 0.112, 0.125], [0.205, 0.195, 0.205], clamp(b * 0.9 + big * 0.6 - 0.35));
        col = mix3(col, [0.15, 0.17, 0.125], P.m2 * 0.45);
        col = mix3(col, [0.23, 0.215, 0.205], P.m3 * 0.35);
        col = mix3(col, [0.11, 0.104, 0.11], P.m1 * 0.08);
        const ao = Math.max(0.42, 1 - 4 * Math.max(0, P.cav));
        return [col.map(q => q * ao), 0.55 + 0.1 * (1 - b)];
      } },
    /* kapur (Dryobalanops): shaggy: strips of dark brown bark six to ten centimetres across run up the trunk in lengths of a
       few tens of centimetres, each lifting free toward its lower end and along an edge, fibrous; where a strip has come
       away, the redder bark beneath */
    kapur: { w: 512, h: 1024, tile: [0.7, 1.4], seed: 37, depth: 0.03,
      hgt(u, v, K, o) {
        const c = K.c, wx = (K.fbm(u * 3, v * 2, 3, 2, 3) - 0.5) * 0.45 + (K.vn(u * 50, v * 30, 50, 30) - 0.5) * 0.1;
        K.cellE(u * 9 + wx, v * 2, 9, 2, 0.078, 0.7, c, 0.95); const e = c[0], id = c[2], dy = c[4];
        const g = 1 - sm(0.0, 0.008, e), gone = id < 0.13 ? 1 : 0;
        /* (a strip stands proud toward its lower end, curling away from the trunk, and is fibrous all over) */
        const peel = sm(-0.35, 0.45, dy) * 0.3 * (1 - g), dome = sm(0.0, 0.025, e) * 0.12;
        const fib = K.rid(u * 150 + wx * 10 + (K.vn(u * 20, v * 6, 20, 6) - 0.5) * 3, v * 10, 150, 10), fib2 = K.vn(u * 60 + wx * 4, v * 6, 60, 6);
        o[0] = clamp(0.7 - 0.6 * Math.pow(g, 0.7) - (gone ? 0.28 : 0) * (1 - g) + (gone ? 0 : peel) + dome + 0.14 * (fib - 0.6) * (1 - g) + 0.08 * (fib2 - 0.5) + (id - 0.5) * 0.08);
        o[1] = gone * (1 - g); o[2] = patches(u, v, K, 3, 0.12, 2.2); o[3] = id;
      },
      col(u, v, P, K) {
        const h = P.h;
        let col = mix3([0.032, 0.021, 0.015], mix3([0.07, 0.046, 0.034], [0.13, 0.095, 0.074], clamp(P.m3 * 0.8 + 0.4 * K.vn(u * 40, v * 20, 40, 20) - 0.15)), sm(0.15, 0.65, h));
        col = mix3(col, mix3([0.15, 0.075, 0.046], [0.2, 0.1, 0.062], K.vn(u * 50, v * 50, 50, 50)), P.m1 * 0.9);
        col = mix3(col, [0.19, 0.18, 0.16], P.m2 * 0.35 * sm(0.5, 0.8, h));
        const mo = 0.9 + 0.2 * K.fbm(u * 3, v * 2, 3, 2, 3), ao = Math.max(0.42, 1 - 5 * Math.max(0, P.cav)), ed = 1 + 1.2 * Math.max(0, P.cvx);
        return [col.map(q => q * mo * ao * ed), 0.9];
      } },
    /* a canopy tree's: thin and fairly smooth, grey-brown, shallowly and finely fissured; mottled with crusts of lichen,
       off-white, grey-green and a darker grey, each patch's edge soft and ragged; here and there the orange of algae */
    canopy: { w: 512, h: 1024, tile: [0.6, 1.2], seed: 41, depth: 0.004,
      hgt(u, v, K, o) {
        o[0] = clamp(0.8 + 0.16 * (K.fbm(u * 6, v * 6, 6, 6, 5) - 0.5) + 0.03 * (K.vn(u * 200, v * 300, 200, 300) - 0.5));
        o[1] = patches(u, v, K, 5, 0.22, 7.1); o[2] = patches(u, v, K, 4, 0.2, 1.3); o[3] = patches(u, v, K, 7, 0.12, 9.7);
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 4, v * 4, 4, 4, 4);
        let col = mix3([0.095, 0.083, 0.07], [0.15, 0.135, 0.115], b);
        col = mix3(col, [0.25, 0.25, 0.225], P.m1 * 0.5); col = mix3(col, [0.15, 0.17, 0.125], P.m2 * 0.5); col = mix3(col, [0.06, 0.058, 0.054], P.m3 * 0.45);
        col = mix3(col, [0.2, 0.085, 0.03], patches(u, v, K, 3, 0.05, 3.9) * 0.35);
        const ao = Math.max(0.42, 1 - 5 * Math.max(0, P.cav));
        return [col.map(q => q * ao), 0.85];
      } },
    /* a fig's: smooth and grey, faintly wrinkled across, a few lenticels, a little lichen */
    fig: { w: 512, h: 1024, tile: [0.7, 1.4], seed: 53, depth: 0.0025,
      hgt(u, v, K, o) {
        const b = K.fbm(u * 4, v * 3, 4, 3, 5), ring = v * 22 + (K.fbm(u * 3, v * 3, 3, 3, 3) - 0.5) * 3, fr = ring - Math.floor(ring);
        const wr = (1 - sm(0, 0.22, Math.abs(fr - 0.5))) * sm(0.4, 0.7, K.vn(u * 5, v * 22, 5, 22)), le = sm(0.93, 0.98, K.vn(u * 40, v * 120, 40, 120));
        o[0] = clamp(0.6 + 0.22 * (b - 0.5) - 0.1 * wr - 0.25 * le); o[1] = le; o[2] = patches(u, v, K, 3, 0.2, 3.3); o[3] = wr;
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 4, v * 3, 4, 3, 5);
        let col = mix3([0.105, 0.103, 0.095], [0.16, 0.156, 0.145], b);
        col = mix3(col, [0.22, 0.24, 0.185], P.m2 * 0.35); col = mix3(col, [0.09, 0.088, 0.08], P.m1 * 0.5);
        const ao = Math.max(0.42, 1 - 4 * Math.max(0, P.cav));
        return [col.map(q => q * ao), 0.72];
      } },
    /* Rhizophora: dark grey-brown, finely fissured up and checked across into small blocks, some lichen */
    rhizophora: { w: 512, h: 1024, tile: [0.4, 0.8], seed: 61, depth: 0.006,
      hgt(u, v, K, o) {
        const F = fissures(u, v, K, 16, 0.5, 3, 0.18, F_);
        const blk = v * 30 + F.id * 23.7 + 0.5 * (K.vn(u * 16, v * 12, 16, 12) - 0.5), bf = blk - Math.floor(blk);
        const chk = (1 - sm(0, 0.08, Math.min(bf, 1 - bf))) * sm(0.35, 0.55, K.vn(F.id * 17 + 0.5, v * 30, 512, 30)) * (1 - F.g);
        o[0] = clamp(0.9 - 0.75 * F.g - 0.35 * chk + 0.06 * (K.fbm(u * 20, v * 20, 20, 20, 2) - 0.5)); o[1] = patches(u, v, K, 4, 0.12, 2.0); o[2] = 0; o[3] = 0;
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 5, v * 5, 5, 5, 3);
        let col = mix3([0.025, 0.022, 0.019], mix3([0.075, 0.068, 0.06], [0.115, 0.105, 0.092], b), sm(0.2, 0.75, P.h));
        col = mix3(col, [0.24, 0.24, 0.22], P.m1 * 0.4 * sm(0.5, 0.8, P.h));
        const ao = Math.max(0.42, 1 - 5 * Math.max(0, P.cav)), ed = 1 + 1.2 * Math.max(0, P.cvx);
        return [col.map(q => q * ao * ed), 0.88];
      } },
    /* Avicennia: smooth, grey-green to pale, its outer skin flaking away in thin irregular patches */
    avicennia: { w: 512, h: 512, tile: [0.6, 0.6], seed: 67, depth: 0.0018,
      hgt(u, v, K, o) {
        const n = K.fbm(u * 5 + (K.fbm(u * 3, v * 3, 3, 3, 2) - 0.5) * 1.5, v * 5, 5, 5, 6), pa = sm(0.54, 0.555, n);
        o[0] = clamp(0.55 + 0.2 * pa + 0.06 * (K.fbm(u * 12, v * 12, 12, 12, 3) - 0.5)); o[1] = pa; o[2] = sm(0.54, 0.555, n) * (1 - sm(0.555, 0.575, n)); o[3] = 0;
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 4, v * 4, 4, 4, 4);
        let col = mix3([0.17, 0.165, 0.135], [0.145, 0.15, 0.13], P.m1);
        col = mix3(col, mix3(col, [0.21, 0.21, 0.18], 0.6), b * 0.6);
        col = mix3(col, [0.1, 0.095, 0.08], P.m2 * 0.5);
        return [col, 0.72];
      } },
    /* a tree fern's trunk: a dense mat of fine wiry dark roots wrapped round it every way at once; showing through it, the
       stubs of old frond bases in rows winding up the trunk */
    treefern: { w: 512, h: 1024, tile: [0.35, 0.7], seed: 71, depth: 0.012,
      hgt(u, v, K, o) {
        let m = 0;
        for (let k = 0; k < 5; k++) { const sl = [1, -1, 2, -2, 0][k], n = [40, 46, 30, 34, 54][k], ph = u * n + v * sl * n * 0.5 + (K.fbm(u * 3 + k, v * 4, 3, 4, 2) - 0.5) * 3;
          const fr = ph - Math.floor(ph), line = (1 - sm(0, 0.25, Math.abs(fr - 0.5))) * sm(0.3, 0.6, K.vn(Math.floor(ph) * 3.7 + k, v * 6, 512, 6)); m = Math.max(m, line * (1 - 0.12 * k)); }
        /* (the frond bases: diamonds on a lattice winding up the trunk, each a raised pad with a dark crescent scar) */
        const a = u * 6 + v * 3, b = v * 9 - u * 0 , ia = Math.floor(a), ib = Math.floor(b + (ia % 2) * 0.5), fa = a - ia, fb = b + (ia % 2) * 0.5 - ib;
        const dia = Math.abs(fa - 0.5) + Math.abs(fb - 0.5) * 0.8, pad = sm(0.48, 0.36, dia) * sm(0.25, 0.55, K.vn(ia * 1.7, ib * 2.3, 512, 512));
        const scar = pad * sm(0.1, 0.02, Math.abs(fb - 0.38 - 0.25 * (fa - 0.5) * (fa - 0.5) * 4)) * sm(0.36, 0.2, Math.abs(fa - 0.5));
        o[0] = clamp(0.25 + 0.35 * m * (1 - 0.6 * pad) + 0.45 * pad - 0.2 * scar + 0.05 * (K.vn(u * 300, v * 400, 300, 400) - 0.5)); o[1] = pad; o[2] = scar; o[3] = m;
      },
      col(u, v, P, K) {
        let col = mix3([0.016, 0.012, 0.009], [0.055, 0.038, 0.026], P.m3);
        col = mix3(col, mix3([0.09, 0.066, 0.045], [0.13, 0.1, 0.07], K.vn(u * 30, v * 40, 30, 40)), P.m1 * 0.8); col = mix3(col, [0.02, 0.015, 0.01], P.m2 * 0.9);
        const ao = Math.max(0.42, 1 - 4 * Math.max(0, P.cav)), ed = 1 + 2 * Math.max(0, P.cvx);
        return [col.map(q => q * ao * ed), 0.95];
      } },
    /* Pandanus: grey-brown, ringed every three or four centimetres by old leaf scars (a raised lip over a groove), a few
       short prickles, fine fibres up it */
    pandanus: { w: 512, h: 1024, tile: [0.4, 0.8], seed: 79, depth: 0.005,
      hgt(u, v, K, o) {
        const ring = v * 22 + 0.3 * (K.fbm(u * 4, v * 6, 4, 6, 2) - 0.5), fr = ring - Math.floor(ring), lip = Math.exp(-(((fr - 0.45) / 0.07) ** 2)), gro = Math.exp(-(((fr - 0.56) / 0.05) ** 2));
        const c = K.c; K.cell(u * 12, v * 22, 12, 22, c); const wart = sm(0.18, 0.04, c[0]) * (c[2] > 0.7 ? 1 : 0) * sm(0.3, 0.45, fr) * sm(0.8, 0.6, fr);
        o[0] = clamp(0.55 + 0.25 * lip - 0.3 * gro + 0.3 * wart + 0.05 * (K.vn(u * 120, v * 20, 120, 20) - 0.5)); o[1] = lip; o[2] = wart; o[3] = gro;
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 5, v * 3, 5, 3, 3);
        let col = mix3([0.13, 0.115, 0.092], [0.2, 0.18, 0.15], b); col = mix3(col, [0.22, 0.2, 0.165], P.m1 * 0.4); col = mix3(col, [0.06, 0.05, 0.04], P.m3 * 0.5);
        const ao = Math.max(0.42, 1 - 4 * Math.max(0, P.cav)), ed = 1 + 1.2 * Math.max(0, P.cvx);
        return [col.map(q => q * ao * ed), 0.86];
      } },
    /* a papaya's trunk: smooth, grey-green, set all over with big crescent leaf scars in a spiral, each with a raised
       rim, its floor sunk and darker, the dots of its vessels in it */
    papaya: { w: 512, h: 512, tile: [0.48, 0.48], seed: 89, depth: 0.006,
      hgt(u, v, K, o) {
        const rows = 12, row = v * rows, ri = Math.floor(row), fy = row - ri, per = 4, off = (ri * 0.25 + 0.13 * Math.sin(ri * 2.1)) % 1;
        const cu = (u * per - off + 8) % 1, dx = (cu - 0.5) * (K.tile0 / per), dy = (fy - 0.45) * (K.tile1 / rows);
        const e = Math.hypot(dx / 0.017, (dy + 0.004 * Math.cos(dx / 0.017 * 1.5)) / 0.0085), rim = Math.exp(-(((e - 1) / 0.18) ** 2)), floor = sm(1.05, 0.8, e);
        o[0] = clamp(0.6 + 0.12 * rim - 0.18 * floor + 0.04 * (K.fbm(u * 8, v * 8, 8, 8, 4) - 0.5) + 0.015 * (K.vn(u * 160, v * 160, 160, 160) - 0.5)); o[1] = floor; o[2] = rim; o[3] = patches(u, v, K, 4, 0.15, 2.7);
      },
      col(u, v, P, K) {
        let col = mix3([0.2, 0.23, 0.17], [0.27, 0.3, 0.23], K.fbm(u * 5, v * 5, 5, 5, 3)); col = mix3(col, [0.12, 0.11, 0.085], P.m1 * 0.75); col = mix3(col, [0.32, 0.33, 0.27], P.m2 * 0.35); col = mix3(col, [0.15, 0.17, 0.12], P.m3 * 0.4);
        const ao = Math.max(0.5, 1 - 4 * Math.max(0, P.cav));
        return [col.map(q => q * ao), 0.7];
      } },
    /* a banana's pseudostem: its leaf sheaths wrapped one in another, fine fibres up them, the edge of each a long line;
       green, blotched brown-purple, the outermost drying to brown paper and splitting */
    banana: { w: 256, h: 1024, tile: [0.5, 1.0], seed: 97, depth: 0.004,
      hgt(u, v, K, o) {
        const sh = u * 5 + 0.15 * K.fbm(u * 2, v * 3, 2, 3, 3), si = Math.floor(sh), fr = sh - si, edge = sm(0.035, 0.0, fr) + 0.6 * sm(0.94, 1.0, fr);
        const fib = K.vn(u * 180, v * 6, 180, 6), dry = sm(0.62, 0.7, K.fbm(u * 3 + si * 0.37, v * 2, 3, 2, 4)) * (si % 2 ? 1 : 0.4);
        o[0] = clamp(0.7 + 0.1 * (fr - 0.5) - 0.12 * edge + 0.05 * (fib - 0.5) + 0.06 * dry * (K.vn(u * 60, v * 12, 60, 12) - 0.5)); o[1] = dry; o[2] = patches(u, v, K, 6, 0.2, 5.3); o[3] = edge;
      },
      col(u, v, P, K) {
        let col = mix3([0.17, 0.26, 0.08], [0.27, 0.34, 0.12], K.fbm(u * 6, v * 2, 6, 2, 3)); col = mix3(col, [0.11, 0.07, 0.05], P.m2 * 0.7); col = mix3(col, [0.3, 0.24, 0.15], P.m1 * 0.9); col = mix3(col, [0.08, 0.1, 0.04], P.m3 * 0.4);
        return [col.map(q => q * Math.max(0.55, 1 - 4 * Math.max(0, P.cav))), 0.6];
      } },
    /* a coconut palm's trunk: grey, ringed close by old leaf scars, split by fine vertical cracks, pale with lichen in
       patches and dark where the rain runs */
    coconut: { w: 512, h: 512, tile: [0.6, 0.6], seed: 101, depth: 0.006,
      hgt(u, v, K, o) {
        const ring = v * 26 + 0.25 * (K.fbm(u * 4, v * 6, 4, 6, 3) - 0.5), fr = ring - Math.floor(ring), lip = Math.exp(-(((fr - 0.5) / 0.08) ** 2)), gro = Math.exp(-(((fr - 0.62) / 0.06) ** 2));
        const cr = Math.abs(K.fbm(u * 40 + 3 * K.vn(u * 4, v * 30, 4, 30), v * 3, 40, 3, 3) - 0.5), crack = sm(0.035, 0.0, cr);
        o[0] = clamp(0.62 + 0.14 * lip - 0.2 * gro - 0.2 * crack + 0.04 * (K.vn(u * 120, v * 120, 120, 120) - 0.5)); o[1] = patches(u, v, K, 4, 0.2, 6.6); o[2] = patches(u, v, K, 3, 0.25, 1.9); o[3] = crack;
      },
      col(u, v, P, K) {
        let col = mix3([0.19, 0.18, 0.165], [0.28, 0.27, 0.25], K.fbm(u * 5, v * 3, 5, 3, 3)); col = mix3(col, [0.36, 0.37, 0.32], P.m1 * 0.4); col = mix3(col, [0.11, 0.1, 0.09], P.m2 * 0.35); col = mix3(col, [0.07, 0.065, 0.06], P.m3 * 0.6);
        return [col.map(q => q * Math.max(0.5, 1 - 4 * Math.max(0, P.cav))), 0.85];
      } },
    /* a liana's stem: ropy, its fibres twisting round it in strands of uneven width */
    liana: { w: 256, h: 1024, tile: [0.25, 1.0], seed: 83, depth: 0.007,
      hgt(u, v, K, o) {
        const F = fissures((u + v + 1) % 1, v, K, 6, 0.4, 3, 0.2, F_);
        o[0] = clamp(0.9 - 0.7 * F.g + 0.1 * Math.sin(Math.PI * F.t) + 0.06 * (K.vn(u * 80 + v * 50, v * 30, 80, 30) - 0.5)); o[1] = F.id; o[2] = patches(u, v, K, 2, 0.15, 4.4); o[3] = 0;
      },
      col(u, v, P, K) {
        let col = mix3([0.03, 0.022, 0.016], mix3([0.09, 0.07, 0.052], [0.14, 0.115, 0.088], P.m1), sm(0.2, 0.7, P.h)); col = mix3(col, [0.17, 0.19, 0.13], P.m2 * 0.5);
        const ao = Math.max(0.42, 1 - 4 * Math.max(0, P.cav));
        return [col.map(q => q * ao), 0.9];
      } } };

  const barkCache = new Map();
  /* the bark of a kind as textures: { map (sRGB), normalMap, tile [m across, m up], rough (its mean roughness) } */
  function bark(kind) {
    if (barkCache.has(kind)) return barkCache.get(kind);
    const B = BARK[kind]; if (!B) throw new Error('FloraKit: no bark called ' + kind);
    const W = B.w, H = B.h, K = Object.assign(noiseKit(B.seed), { c: new Float32Array(5), c2: new Float32Array(5), tile0: B.tile[0], tile1: B.tile[1] });
    const Hf = new Float32Array(W * H), M = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)], o = [0, 0, 0, 0];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      o[1] = o[2] = o[3] = 0; B.hgt((i + 0.5) / W, (j + 0.5) / H, K, o); const k = j * W + i; Hf[k] = o[0]; M[0][k] = o[1]; M[1][k] = o[2]; M[2][k] = o[3];
    }
    /* (how far down in a hollow, and how far out on an edge: the height against its surroundings, about 2 cm and 3 mm round) */
    const tx = B.tile[0] / W, ty = B.tile[1] / H, bigR = 0.018, smR = 0.003;
    const HB = blur(Hf, W, H, Math.max(1, Math.round(bigR / tx)), Math.max(1, Math.round(bigR / ty))), HS = blur(Hf, W, H, Math.max(1, Math.round(smR / tx)), Math.max(1, Math.round(smR / ty)));
    const col = new Uint8Array(W * H * 4), nor = new Uint8Array(W * H * 4), P = { h: 0, cav: 0, cvx: 0, m1: 0, m2: 0, m3: 0 }; let rs = 0;
    const enc = q => Math.round(255 * Math.pow(clamp(q), 1 / 2.2));
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; P.h = Hf[k]; P.cav = HB[k] - Hf[k]; P.cvx = Hf[k] - HS[k]; P.m1 = M[0][k]; P.m2 = M[1][k]; P.m3 = M[2][k];
      const [c, ro] = B.col((i + 0.5) / W, (j + 0.5) / H, P, K);
      col[k * 4] = enc(c[0]); col[k * 4 + 1] = enc(c[1]); col[k * 4 + 2] = enc(c[2]); col[k * 4 + 3] = Math.round(255 * clamp(ro)); rs += ro;
    }
    /* the normal map: the height's slope across and up the tile, in metres of relief (depth) per metre of bark */
    const sx = B.depth / (2 * tx), sy = B.depth / (2 * ty);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, hx = Hf[j * W + (i + 1) % W] - Hf[j * W + (i + W - 1) % W], hy = Hf[((j + 1) % H) * W + i] - Hf[((j + H - 1) % H) * W + i];
      const nx = -hx * sx, ny = -hy * sy, l = Math.hypot(nx, ny, 1);
      nor[k * 4] = Math.round((nx / l * 0.5 + 0.5) * 255); nor[k * 4 + 1] = Math.round((ny / l * 0.5 + 0.5) * 255); nor[k * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nor[k * 4 + 3] = 255;
    }
    const mk = (d, srgb) => { const t = new T.DataTexture(d, W, H, T.RGBAFormat, T.UnsignedByteType); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; t.userData.keep = true; return t; };
    const out = { map: mk(col, true), normalMap: mk(nor, false), tile: B.tile, rough: rs / (W * H), kind };
    barkCache.set(kind, out); return out;
  }
  /* a bark material: the textures, the plant's own vertex colours over them (moss, soil, shade), the scene's lights */
  const barkMats = new Map();
  function barkMat(kind, o = {}) {
    const key = kind + JSON.stringify(o); if (barkMats.has(key)) return barkMats.get(key);
    const b = bark(kind), m = Mats.lit({ map: b.map, normalMap: b.normalMap, normalScale: new T.Vector2(o.ns ?? 1.5, o.ns ?? 1.5), vertexColors: true, color: Array.isArray(o.tint) ? new T.Color(...o.tint) : new T.Color(o.tint ?? 0.82, o.tint ?? 0.82, o.tint ?? 0.82), roughness: o.rough ?? Math.min(0.95, b.rough + 0.04) });
    barkMats.set(key, m); return m;
  }

  /* ── geometry. Every part of a plant is a grid of points, rows by columns (the columns wrapping round for a trunk or a
     branch): fn(i, j) gives each point [x, y, z, u, v, r, g, b] (its place, its bark's uv in tiles, its colour). The
     normals come from the grid itself, across its rows and down its columns (round the wrap too), so a trunk has no seam
     and a part's own edges stay smooth ── */
  function gridGeo(rows, cols, wrap, fn) {
    const nc = wrap ? cols + 1 : cols, N = rows * nc, P = new Float32Array(N * 3), U = new Float32Array(N * 2), C = new Float32Array(N * 3), Nn = new Float32Array(N * 3);
    for (let i = 0; i < rows; i++) for (let j = 0; j < nc; j++) {
      const q = fn(i, wrap && j === cols ? cols : j), k = i * nc + j;
      P[k * 3] = q[0]; P[k * 3 + 1] = q[1]; P[k * 3 + 2] = q[2]; U[k * 2] = q[3]; U[k * 2 + 1] = q[4]; C[k * 3] = q[5]; C[k * 3 + 1] = q[6]; C[k * 3 + 2] = q[7];
    }
    const at = (i, j) => { if (wrap) j = ((j % cols) + cols) % cols; else j = Math.max(0, Math.min(nc - 1, j)); i = Math.max(0, Math.min(rows - 1, i)); return (i * nc + j) * 3; };
    for (let i = 0; i < rows; i++) for (let j = 0; j < nc; j++) {
      const a = at(i, j - 1), b = at(i, j + 1), c = at(i - 1, j), d = at(i + 1, j), k = (i * nc + j) * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z) || 1;
      Nn[k] = x / l; Nn[k + 1] = y / l; Nn[k + 2] = z / l;
    }
    const I = new Uint32Array((rows - 1) * (nc - 1) * 6); let n = 0;
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; I[n++] = a; I[n++] = b; I[n++] = c; I[n++] = b; I[n++] = d; I[n++] = c; }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('color', new T.BufferAttribute(C, 3));
    g.setIndex(new T.BufferAttribute(I, 1));
    return g;
  }
  /* turn a part's faces outward if its normals point in: probe(p, n) → how much n points the way out from p (summed) */
  function faceOut(g, probe) {
    const P = g.attributes.position.array, Nn = g.attributes.normal.array; let s = 0;
    for (let i = 0; i < P.length; i += 3 * 7) s += probe(P[i], P[i + 1], P[i + 2], Nn[i], Nn[i + 1], Nn[i + 2]);
    if (s < 0) { for (let i = 0; i < Nn.length; i++) Nn[i] = -Nn[i]; const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } }
    return g;
  }
  /* merge parts (each with position, normal, uv, color) into one geometry */
  function mergeParts(parts) {
    let nv = 0, ni = 0; for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), C = new Float32Array(nv * 3), I = new Uint32Array(ni); let o = 0, oi = 0;
    for (const g of parts) {
      P.set(g.attributes.position.array, o * 3); Nn.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); C.set(g.attributes.color.array, o * 3);
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + o; o += g.attributes.position.count; oi += ix.length; g.dispose();
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2)); g.setAttribute('color', new T.BufferAttribute(C, 3));
    g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
  }
  const angD = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  /* ── a trunk: up from below the ground along a gently bending line, tapering; flaring a little at its foot and, where it
     has buttresses, swelling out toward each of them in a fillet that carries its surface smoothly into the plank; shallow
     flutes up its lower part. o: { H (m), r0 (radius above the buttresses), rTop, lean [x, z] (where its top is), flare,
     flute, butts [{ ang, h, t0 }], seed, segV, segA, below, tile [m, m], moss (0..1), wet (the mossier side, an angle) }.
     Returns the geometry and rAt(y, ang) (its radius there, for the buttresses and the limbs) and the spine's point at y ── */
  function trunk(o) {
    const H = o.H, r0 = o.r0, rTop = o.rTop ?? r0 * 0.55, R = Models.rng(o.seed || 1), butts = o.butts || [], below = o.below ?? 0.6, tile = o.tile || [0.6, 1.2];
    const lx = o.lean ? o.lean[0] : 0, lz = o.lean ? o.lean[1] : 0, wob = [R() * TAU, R() * TAU, R() * TAU, R() * TAU];
    /* (the spine: its offset at height y, a slow lean and a gentle wander) */
    const wv = o.wander ?? 0.003, spine = y => { const t = Math.max(0, y) / H; return [lx * t * t + wv * H * Math.sin(t * 3.1 + wob[0]) * t + wv * 0.5 * H * Math.sin(t * 7.3 + wob[1]) * t, lz * t * t + wv * H * Math.sin(t * 2.7 + wob[2]) * t + wv * 0.5 * H * Math.sin(t * 6.1 + wob[3]) * t]; };
    const base = y => { const t = clamp(y / H); return (rTop + (r0 - rTop) * Math.pow(1 - t, 1.1)) * (1 + (o.flare ?? 0.25) * Math.exp(-Math.max(0, y) / 1.2)) * (1 + 0.02 * Math.sin(y * 1.3 + wob[0])); };
    const fl = o.flute ?? 0.03, nfl = 5 + Math.floor(R() * 4), flph = R() * TAU;
    const rAt = (y, a) => {
      let r = base(y);
      r *= 1 + fl * Math.sin(a * nfl + flph + 0.3 * Math.sin(y * 0.4)) * Math.exp(-Math.max(0, y) / (0.25 * H));
      for (const b of butts) {
        if (y > b.h * 1.08) continue;
        const k = 1 - sm(0, b.h * 0.95, Math.max(0, y)), A = 0.12 * r0 * k * k, w = b.t0 * 0.32;
        const d = angD(a, b.ang) * r; r += A * Math.exp(-(d / w) * (d / w));
      }
      return r;
    };
    const segV = o.segV || 46, segA = o.segA || 96, nU = Math.max(1, Math.round(TAU * r0 / tile[0]));
    /* (rows closer together low down, where the fillets come and go) */
    const rowY = i => -below + (H + below) * Math.pow(i / (segV - 1), 1.55);
    const moss = o.moss ?? 0.5, wet = o.wet ?? R() * TAU;
    let vAcc = 0, prevY = rowY(0);
    const vOf = []; for (let i = 0; i < segV; i++) { const y = rowY(i); vAcc += Math.abs(y - prevY); prevY = y; vOf.push(vAcc / tile[1]); }
    const g = gridGeo(segV, segA, true, (i, j) => {
      const y = rowY(i), a = j / segA * TAU, r = rAt(y, a), [sx, sz] = spine(y), x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
      /* (shade low down and in the crotches between the fillets; moss toward the wetter side, near the ground; soil at its foot) */
      const crotch = clamp((r - base(y)) / (0.5 * r0)), ao = (0.55 + 0.45 * sm(-0.2, 2.5, y)) * (1 - 0.35 * crotch * (1 - sm(0, 3, y)));
      const mk = moss * (1 - sm(0.2, 3.5 + 2 * moss, y)) * (0.45 + 0.55 * (0.5 + 0.5 * Math.cos(angD(a, wet)))) * (0.6 + 0.4 * Models.vn(a * 3, y * 1.5, 1.7));
      const soil = 1 - sm(-0.05, 0.35, y);
      let c = [ao, ao, ao]; c = mix3(c, [0.62 * ao, 0.82 * ao, 0.42 * ao], mk * 0.8); c = mix3(c, [0.55 * ao, 0.45 * ao, 0.35 * ao], soil * 0.6);
      return [x, y, z, j / segA * nU, vOf[i], c[0], c[1], c[2]];
    });
    faceOut(g, (x, y, z, nx, ny, nz) => { const [sx, sz] = spine(y); return (x - sx) * nx + (z - sz) * nz; });
    return { geo: g, rAt, spine, base, H, r0, nU };
  }

  /* ── a plank buttress: a slab of wood leaving the trunk at height h, its upper edge sweeping down in a concave curve to
     the ground `reach` metres out; thick (t0) where it leaves the trunk, webbed into it at its foot, thinning outward and
     upward. Its two faces close over its upper edge like a lens's (the slab's thickness going to nothing there, steeply),
     so the edge is rounded however steeply it falls. It snakes a little sideways as it goes; its bark's fissures follow
     its sweep. tr: the trunk (from trunk()) ── */
  function buttress(tr, o) {
    const R = Models.rng(o.seed || 7), a0 = o.ang, h = o.h, reach = o.reach, t0 = o.t0, tile = o.tile || [0.6, 1.2];
    const dx = Math.cos(a0), dz = Math.sin(a0), px = -dz, pz = dx, bend = o.bend ?? (R() - 0.5) * 0.5, wav = o.wav ?? 0.6 + R() * 0.6, ph = R() * TAU;
    /* (measured from where its top leaves the trunk, high up where the trunk is narrower, out to its tip on the ground:
       inside the trunk the plank keeps its full height, hidden) */
    const dTop = tr.base(h) * 0.86, dEnd = tr.base(0) + reach, start = -0.6, NS = o.segL || 40, NL = 13;
    const yTop = xi => xi < 0 ? h : xi > 1 ? -0.1 : h * Math.pow(1 - Math.pow(xi, 0.6), 1.7) * (1 + 0.05 * Math.sin(xi * 9 + ph) * xi) + 0.015;
    const path = xi => { const d = xi < 0 ? dTop * (1 + xi * 0.9) : dTop + xi * (dEnd - dTop), lat = (bend * xi * xi + wav * 0.07 * Math.sin(xi * Math.PI * 1.7 + ph) * xi) * Math.max(0, xi) * reach, [sx, sz] = tr.spine(0);
      return [sx + dx * d + px * lat, sz + dz * d + pz * lat]; };
    /* (its thickness at its foot: thick where it leaves the trunk and webbed into it, still a good thickness at its tip,
       where it runs on into a root) */
    const tFoot = xi => t0 * (1 - 0.5 * clamp(xi)) * (1 + 1.3 * (1 - sm(-0.05, 0.25, xi)));
    const reach2 = dEnd - dTop;
    const xis = []; for (let i = 0; i < NS; i++) { const u = i / (NS - 1); xis.push(start + (1.08 - start) * (u < 0.4 ? 0.4 * Math.pow(u / 0.4, 1.8) : u)); }
    /* (columns: up the left face from below the ground to the edge, and down the right face; the edge is the middle one) */
    const cols = NL * 2 - 1, y0 = -0.35;
    const g = gridGeo(NS, cols, false, (i, j) => {
      const xi = xis[i], [cx, cz] = path(xi), [nx2, nz2] = path(Math.min(1.08, xi + 0.01)), tx = nx2 - cx, tz = nz2 - cz, tl = Math.hypot(tx, tz) || 1, sxn = -tz / tl, szn = tx / tl;
      const side = j < NL ? -1 : 1, lam = j < NL ? j / (NL - 1) : (cols - 1 - j) / (NL - 1);
      /* (spaced closer toward the edge, where it rounds over) */
      const q = 1 - Math.pow(1 - lam, 1.6), top = yTop(xi), y = y0 + (top - y0) * q;
      const th = tFoot(xi) * Math.sqrt(Math.max(0, 1 - Math.pow(q, 4))) * (0.55 + 0.45 * (1 - q)) * 0.5 * side;
      const x = cx + sxn * th, z = cz + szn * th, along = xi * reach2;
      /* (the bark's grain turned to the plank's sweep: near upright where it leaves the trunk, lying lower toward its tip) */
      const an = mix(1.3, 0.5, sm(0, 1, xi)), Fx = Math.cos(an), Fy = -Math.sin(an);
      const u = (along * (-Fy) + y * Fx) / tile[0] + (side > 0 ? 0.37 : 0), v = (along * Fx + y * -Fy) / tile[1] + (side > 0 ? 0.21 : 0);
      const ao = (0.5 + 0.5 * sm(0, 0.5, xi)) * (0.62 + 0.38 * sm(-0.2, 1.2, y)) * (0.82 + 0.18 * q), soil = 1 - sm(-0.05, 0.3, y);
      let c = [ao, ao, ao]; c = mix3(c, [0.55 * ao, 0.45 * ao, 0.35 * ao], soil * 0.6);
      const mk = (o.moss ?? 0.4) * (1 - sm(0.3, 2.5, y)) * Models.vn(along * 0.8, y * 1.3, 3.3 + a0); c = mix3(c, [0.62 * ao, 0.82 * ao, 0.42 * ao], mk * 0.7);
      return [x, y, z, u, v, c[0], c[1], c[2]];
    });
    /* (outward: the faces point away from the plank's middle line) */
    const P = g.attributes.position.array, Nn = g.attributes.normal.array; let sg = 0;
    for (let i = 2; i < NS; i += 3) for (const j of [2, cols - 3]) { const k = (i * cols + j) * 3, [cx, cz] = path(xis[i]); sg += (P[k] - cx) * Nn[k] + (P[k + 2] - cz) * Nn[k + 2]; }
    if (sg < 0) { for (let i = 0; i < Nn.length; i++) Nn[i] = -Nn[i]; const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } }
    const tip = path(1.0), pre = path(0.9), tl = Math.hypot(tip[0] - pre[0], tip[1] - pre[1]) || 1;
    return { geo: g, tip: [tip[0], tip[1]], dir: [(tip[0] - pre[0]) / tl, (tip[1] - pre[1]) / tl], t: tFoot(1) };
  }

  /* ── a tapering tube along a curve, its bark tiling round it and up it: for limbs, branches and roots. r(t), t 0..1
     along it; col(t, a, p) → [r, g, b], or none ── */
  function tube(curve, r, o = {}) {
    const segs = o.segs || 12, radial = o.radial || 10, tile = o.tile || [0.6, 1.2], L = curve.getLength(), fr = curve.computeFrenetFrames(segs, false);
    const nU = Math.max(1, Math.round(TAU * r(0) / tile[0])), pts = [], vs = [];
    for (let i = 0; i <= segs; i++) { pts.push(curve.getPointAt(i / segs)); vs.push(i / segs * L / tile[1]); }
    const g = gridGeo(segs + 1, radial, true, (i, j) => {
      const t = i / segs, p = pts[i], N = fr.normals[i], B = fr.binormals[i], a = j / radial * TAU, rr = r(t), ca = Math.cos(a) * (o.sq ? o.sq[0] : 1), sa = Math.sin(a) * (o.sq ? o.sq[1] : 1);
      const x = p.x + (N.x * ca + B.x * sa) * rr, y = p.y + (N.y * ca + B.y * sa) * rr, z = p.z + (N.z * ca + B.z * sa) * rr;
      const c = o.col ? o.col(t, a, [x, y, z]) : [1, 1, 1];
      return [x, y, z, j / radial * nU, vs[i] + (o.v0 || 0), c[0], c[1], c[2]];
    });
    faceOut(g, (x, y, z, nx, ny, nz) => { const p = curve.getPointAt(0.5); return 0; });
    /* (outward: each ring's points away from its centre) */
    const P = g.attributes.position.array, Nn = g.attributes.normal.array, nc = radial + 1; let sg = 0;
    for (let i = 0; i <= segs; i += Math.max(1, segs >> 2)) for (let j = 0; j < radial; j += 3) { const k = (i * nc + j) * 3, p = pts[i]; sg += (P[k] - p.x) * Nn[k] + (P[k + 1] - p.y) * Nn[k + 1] + (P[k + 2] - p.z) * Nn[k + 2]; }
    if (sg < 0) { for (let i = 0; i < Nn.length; i++) Nn[i] = -Nn[i]; const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } }
    return g;
  }

  /* ── surface roots: from a buttress's tip (or the trunk's foot) a root runs on over the ground, snaking, half sunk in
     the soil, tapering, forking once or twice; returns its parts ── */
  function roots(x0, z0, dir, r0, len, o = {}) {
    const R = Models.rng(o.seed || 3), parts = [], tile = o.tile || [0.6, 1.2];
    const one = (x, z, ang, r, L, depth) => {
      const pts = [], n = Math.max(4, Math.round(L / 0.45)); let a = ang, px = x, pz = z;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new T.Vector3(px, -r * (0.25 + 0.75 * t * t) + 0.04 * r * Math.sin(t * 9 + x), pz)); a += (R() - 0.5) * 0.45; px += Math.cos(a) * L / n; pz += Math.sin(a) * L / n; }
      const c = new T.CatmullRomCurve3(pts);
      parts.push(tube(c, t => r * (1 - 0.5 * t) * (1 + 0.08 * Math.sin(t * 13 + x * 3)), { segs: n * 2, radial: o.radial || 10, tile, sq: [1.7, 1], col: (t, aa, p) => { const k = clamp(0.55 + 0.45 * Math.max(0, p[1] / Math.max(0.02, r))); return [0.92 * k, 0.86 * k, 0.78 * k]; } }));
      if (depth < 2 && L > 1.2) for (let f = 0, nf = R() < 0.65 ? 1 : 0; f < nf; f++) { const t = 0.3 + R() * 0.4, p = c.getPointAt(t); one(p.x, p.z, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.5), r * (1 - 0.82 * t) * 0.75, L * (0.4 + R() * 0.3), depth + 1); }
    };
    one(x0, z0, Math.atan2(dir[1], dir[0]), r0, len, 0);
    return parts;
  }

  return { noiseKit, BARK, bark, barkMat, clamp, sm, mix, mix3, gridGeo, faceOut, mergeParts, trunk, buttress, tube, roots, angD };
})();

/* a row of bark samples, each on a column a metre across (for looking the barks over in the studio) */
Models.add('flora/barks', (o = {}) => {
  const T = THREE, g = new T.Group(), kinds = o.kinds || Object.keys(FloraKit.BARK);
  kinds.forEach((k, i) => {
    const b = FloraKit.bark(k), r = 0.45, h = 2.6, geo = new T.CylinderGeometry(r, r, h, 64, 8, true), uv = geo.attributes.uv, n = uv.count, C = new Float32Array(n * 3).fill(1);
    for (let j = 0; j < n; j++) { uv.setX(j, uv.getX(j) * (TAU_ => Math.max(1, Math.round(2 * Math.PI * r / b.tile[0])))()); uv.setY(j, uv.getY(j) * h / b.tile[1]); }
    geo.setAttribute('color', new T.BufferAttribute(C, 3));
    const m = Models.mesh(geo, FloraKit.barkMat(k)); m.position.set(i * 1.25, h / 2, 0); g.add(m);
  });
  return g;
});

/* the foot of a buttressed trunk (for looking the trunk, buttresses and roots over in the studio) */
Models.add('flora/trunktest', (o = {}) => {
  const T = THREE, K = FloraKit, R = Models.rng(o.seed || 5), kind = o.bark || 'meranti', tile = K.bark(kind).tile;
  const nb = o.nb ?? 6, butts = [];
  for (let i = 0; i < nb; i++) butts.push({ ang: i / nb * Math.PI * 2 + (R() - 0.5) * 0.6, h: (o.bh || 3.2) * (0.6 + 0.6 * R()), t0: 0.22 + 0.12 * R(), reach: (o.reach || 2.6) * (0.6 + 0.7 * R()) });
  const tr = K.trunk({ H: o.H || 12, r0: o.r0 || 0.55, rTop: (o.r0 || 0.55) * 0.8, butts, seed: o.seed || 5, tile, moss: 0.6, flare: 0.18 });
  const parts = [tr.geo];
  for (const b of butts) { const B = K.buttress(tr, Object.assign({ seed: Math.floor(R() * 1e6), tile }, b)); parts.push(B.geo);
    parts.push(...K.roots(B.tip[0] - B.dir[0] * 0.6, B.tip[1] - B.dir[1] * 0.6, B.dir, Math.max(0.1, B.t * 0.62), 1.6 + R() * 2.4, { seed: Math.floor(R() * 1e6), tile })); }
  const g = new T.Group(), m = Models.mesh(K.mergeParts(parts), K.barkMat(kind)); g.add(m);
  return g;
});
