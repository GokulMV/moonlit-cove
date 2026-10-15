/* ─────────────────────────────────────────────────────────────
   models/struct/kit.js — what the island's structures are built of.
   The materials, drawn as the bark is (FloraKit.bark: a height field
   made into a colour map and a normal map, tiling):
     timber    sawn hardwood weathered silver-grey in the sun and the
               salt: the grain stands proud where the soft wood
               between its lines has worn away, long checks open along
               it, a knot now and then, grime in the hollows
     timberNew belian (ironwood) new or kept from the sun: dark
               red-brown, close grain, a dull sheen
     pile      a round pile, weathered, deeply checked along its length
     barnacle  the crust of barnacles on whatever the tide covers and
               uncovers: little grey-white volcanoes packed together
     slime     below them, what stays wet: dark green-brown weed
     zinc      galvanized iron sheet: dull silver, its spangle, chalky
               white rust in patches, red rust streaking down from its
               nails and its lower edge
     zincGreen the same, painted green and faded, rust breaking through
     paintCream weatherboard painted cream, chalky, peeling at the
               edges to the grey wood beneath
     concrete  cast concrete: pores, a stain where water runs
   And the pieces: a board (its grain along its length, uvs in
   metres), a square post, a round pile, a corrugated sheet; parts
   gathered per material and merged into one mesh each.
   ───────────────────────────────────────────────────────────── */
const StructKit = (() => {
  const T = THREE, FK = FloraKit, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t, mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const patch = (u, v, K, f, share, s) => sm(1 - share - 0.04, 1 - share + 0.04, K.fbm(u * f + s, v * f + s * 0.7, f, f, 5) + 0.1 * (K.vn(u * f * 8 + s, v * f * 8, f * 8, f * 8) - 0.5));
  /* (the grain's lines across a board, wandering a little along it and swirling round its knots) */
  function grain(u, v, K, n, kn) {
    let ph = u * n + (K.fbm(u * 2, v * 3, 2, 3, 3) - 0.5) * 2.2 + (K.vn(u * 5, v * 14, 5, 14) - 0.5) * 0.5, knot = 0;
    if (kn) { K.cell(u * kn[0], v * kn[1], kn[0], kn[1], K.c); const d = K.c[0], id = K.c[2]; if (id < kn[2]) { const q = Math.exp(-(d * d) / 0.02); ph += 3.2 * q * Math.sign(K.c[3] || 1); knot = Math.exp(-(d * d) / 0.0035); } }
    const fr = ph - Math.floor(ph), line = Math.exp(-(((fr - 0.5) / 0.13) ** 2));
    return [line, knot, ph];
  }
  Object.assign(FK.BARK, {
    timber: { w: 256, h: 1024, tile: [0.25, 1.6], seed: 201, depth: 0.003,
      hgt(u, v, K, o) {
        const [line, knot] = grain(u, v, K, 30, [3, 2, 0.12]);
        /* (checks: long hairline splits along the grain, opening a little in the middle, closing at their ends) */
        const cr = Math.abs(K.fbm(u * 18 + 2 * K.vn(u * 3, v * 10, 3, 10), v * 1.5, 18, 2, 2) - 0.5), ck = sm(0.009, 0.0, cr) * sm(0.55, 0.72, K.vn(u * 6, v * 4, 6, 4));
        o[0] = clamp(0.62 + 0.16 * line - 0.06 * knot + 0.06 * (K.vn(u * 90, v * 300, 90, 300) - 0.5) + 0.05 * (K.fbm(u * 6, v * 2, 6, 2, 3) - 0.5) - 0.45 * ck); o[1] = knot; o[2] = patch(u, v, K, 3, 0.25, 3.1); o[3] = ck;
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 1.5, 3, 2, 3);
        /* (silver-grey on the surface, the old brown still in the grain's hollows; dark in the checks and the knots) */
        let col = mix3([0.1, 0.085, 0.066], mix3([0.16, 0.15, 0.13], [0.22, 0.21, 0.19], b), sm(0.45, 0.8, P.h));
        col = mix3(col, [0.1, 0.085, 0.065], P.m1 * 0.55); col = mix3(col, [0.1, 0.098, 0.08], P.m2 * 0.45); col = mix3(col, [0.05, 0.043, 0.035], P.m3 * 0.75);
        const ao = Math.max(0.5, 1 - 4 * Math.max(0, P.cav)), ed = 1 + 0.6 * Math.max(0, P.cvx);
        return [col.map(q => q * ao * ed), 0.86];
      } },
    timberNew: { w: 256, h: 1024, tile: [0.25, 1.6], seed: 211, depth: 0.0012,
      hgt(u, v, K, o) {
        const [line, knot] = grain(u, v, K, 34, [3, 2, 0.12]);
        o[0] = clamp(0.7 + 0.08 * line - 0.05 * knot + 0.02 * (K.vn(u * 120, v * 400, 120, 400) - 0.5)); o[1] = knot; o[2] = line; o[3] = patch(u, v, K, 3, 0.2, 5.3);
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 1.2, 3, 2, 3);
        let col = mix3([0.062, 0.036, 0.024], [0.088, 0.05, 0.032], b); col = mix3(col, [0.045, 0.026, 0.018], P.m2 * 0.5); col = mix3(col, [0.035, 0.02, 0.014], P.m1 * 0.7);
        col = mix3(col, [0.17, 0.155, 0.135], P.m3 * 0.35);
        return [col.map(q => q * Math.max(0.55, 1 - 4 * Math.max(0, P.cav))), 0.6];
      } },
    /* the beach huts' timber (beachhut.js): sawn hardwood oiled once and left to the weather, still brown, greying where
       the sun and the rain get at it, the grain's lines darker, dark flecks of its fibres; and the darker red-brown of the
       doors, the treads, the table tops; and the round posts it stands on, checked along their length */
    hutWood: { w: 256, h: 1024, tile: [0.25, 1.6], seed: 401, depth: 0.0024,
      hgt(u, v, K, o) {
        const [line, knot] = grain(u, v, K, 26, [3, 2, 0.1]);
        const cr = Math.abs(K.fbm(u * 16 + 2 * K.vn(u * 3, v * 10, 3, 10), v * 1.5, 16, 2, 2) - 0.5), ck = sm(0.007, 0.0, cr) * sm(0.6, 0.75, K.vn(u * 6, v * 4, 6, 4));
        o[0] = clamp(0.64 + 0.1 * line - 0.05 * knot + 0.04 * (K.vn(u * 90, v * 300, 90, 300) - 0.5) + 0.04 * (K.fbm(u * 6, v * 2, 6, 2, 3) - 0.5) - 0.35 * ck); o[1] = knot; o[2] = patch(u, v, K, 3, 0.35, 4.7); o[3] = ck;
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 1.5, 3, 2, 3), fl = sm(0.8, 0.88, K.vn(u * 140, v * 26, 140, 26));
        let col = mix3([0.085, 0.055, 0.034], mix3([0.15, 0.1, 0.06], [0.21, 0.15, 0.092], b), sm(0.45, 0.8, P.h));
        col = mix3(col, [0.06, 0.035, 0.02], P.m1 * 0.5); col = mix3(col, [0.2, 0.18, 0.155], P.m2 * 0.38); col = mix3(col, [0.04, 0.025, 0.015], P.m3 * 0.75); col = mix3(col, [0.055, 0.032, 0.018], fl * 0.45);
        const ao = Math.max(0.5, 1 - 4 * Math.max(0, P.cav)), ed = 1 + 0.5 * Math.max(0, P.cvx);
        return [col.map(q => q * ao * ed), 0.8];
      } },
    hutWoodDark: { w: 256, h: 1024, tile: [0.25, 1.6], seed: 409, depth: 0.0014,
      hgt(u, v, K, o) {
        const [line, knot] = grain(u, v, K, 32, [3, 2, 0.1]);
        o[0] = clamp(0.7 + 0.08 * line - 0.05 * knot + 0.02 * (K.vn(u * 120, v * 400, 120, 400) - 0.5)); o[1] = knot; o[2] = line; o[3] = patch(u, v, K, 3, 0.25, 6.1);
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 1.2, 3, 2, 3);
        let col = mix3([0.085, 0.046, 0.028], [0.125, 0.07, 0.04], b); col = mix3(col, [0.06, 0.033, 0.02], P.m2 * 0.5); col = mix3(col, [0.045, 0.025, 0.016], P.m1 * 0.7);
        col = mix3(col, [0.17, 0.15, 0.13], P.m3 * 0.3);
        return [col.map(q => q * Math.max(0.55, 1 - 4 * Math.max(0, P.cav))), 0.62];
      } },
    hutPost: { w: 512, h: 1024, tile: [0.8, 1.6], seed: 419, depth: 0.005,
      hgt(u, v, K, o) {
        const [line] = grain((u + v * 0.04) % 1, v, K, 30, null);
        const cr = Math.abs(K.fbm(u * 14 + 2 * K.vn(u * 3, v * 8, 3, 8), v * 1.2, 14, 2, 2) - 0.5), ck = sm(0.012, 0.0, cr) * sm(0.5, 0.68, K.vn(u * 5, v * 3, 5, 3));
        o[0] = clamp(0.6 + 0.16 * line + 0.07 * (K.fbm(u * 8, v * 4, 8, 4, 3) - 0.5) - 0.55 * ck); o[1] = ck; o[2] = patch(u, v, K, 3, 0.4, 2.9); o[3] = patch(u, v, K, 5, 0.12, 7.3);
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 2, 3, 2, 3);
        let col = mix3([0.075, 0.053, 0.035], mix3([0.135, 0.1, 0.066], [0.19, 0.145, 0.096], b), sm(0.4, 0.78, P.h));
        col = mix3(col, [0.035, 0.024, 0.016], P.m1 * 0.8); col = mix3(col, [0.2, 0.185, 0.16], P.m2 * 0.42); col = mix3(col, [0.07, 0.065, 0.045], P.m3 * 0.4);
        return [col.map(q => q * Math.max(0.48, 1 - 4 * Math.max(0, P.cav)) * (1 + 0.45 * Math.max(0, P.cvx))), 0.84];
      } },
    pile: { w: 512, h: 1024, tile: [0.8, 1.6], seed: 223, depth: 0.006,
      hgt(u, v, K, o) {
        const [line] = grain((u + v * 0.04) % 1, v, K, 30, null);
        const cr = Math.abs(K.fbm(u * 14 + 2 * K.vn(u * 3, v * 8, 3, 8), v * 1.2, 14, 2, 2) - 0.5), ck = sm(0.016, 0.0, cr) * sm(0.45, 0.65, K.vn(u * 5, v * 3, 5, 3));
        o[0] = clamp(0.6 + 0.18 * line + 0.08 * (K.fbm(u * 8, v * 4, 8, 4, 3) - 0.5) - 0.6 * ck); o[1] = ck; o[2] = patch(u, v, K, 3, 0.3, 2.3); o[3] = patch(u, v, K, 5, 0.15, 6.1);
      },
      col(u, v, P, K) {
        const b = K.fbm(u * 3, v * 2, 3, 2, 3);
        let col = mix3([0.09, 0.077, 0.062], mix3([0.14, 0.13, 0.115], [0.2, 0.19, 0.17], b), sm(0.4, 0.78, P.h));
        col = mix3(col, [0.04, 0.035, 0.03], P.m1 * 0.8); col = mix3(col, [0.1, 0.1, 0.08], P.m2 * 0.4); col = mix3(col, [0.3, 0.3, 0.28], P.m3 * 0.3);
        return [col.map(q => q * Math.max(0.48, 1 - 4 * Math.max(0, P.cav)) * (1 + 0.5 * Math.max(0, P.cvx))), 0.88];
      } },
    barnacle: { w: 512, h: 512, tile: [0.4, 0.4], seed: 229, depth: 0.008,
      hgt(u, v, K, o) {
        /* (packed cones, each a plated rim round a dark slit, crowded and of every size; a few gaps of bare wood) */
        K.cell(u * 22, v * 22, 22, 22, K.c, 0.95); const d = K.c[0], id = K.c[2], s = 0.42 + 0.2 * id;
        const cone = sm(s, s * 0.3, d) * (1 - 0.7 * sm(s * 0.26, s * 0.1, d)), rib = 0.9 + 0.1 * Math.cos(Math.atan2(K.c[4], K.c[3]) * 6);
        K.cell(u * 50, v * 50, 50, 50, K.c2, 0.9); const d2 = K.c2[0], small = sm(0.35, 0.12, d2) * (1 - sm(0.12, 0.05, d2)) * 0.45;
        const bare = patch(u, v, K, 4, 0.12, 8.8);
        o[0] = clamp(0.3 + (0.6 * cone * rib + small) * (1 - bare)); o[1] = sm(s * 0.25, s * 0.12, d) * (1 - bare); o[2] = bare; o[3] = id;
      },
      col(u, v, P, K) {
        let col = mix3([0.15, 0.14, 0.12], [0.25, 0.24, 0.21], sm(0.35, 0.8, P.h)); col = mix3(col, [0.1, 0.09, 0.075], P.m1 * 0.6);
        col = mix3(col, [0.1, 0.095, 0.08], P.m2 * 0.8); col = mix3(col, [0.26, 0.23, 0.19], (P.m3 > 0.85 ? 1 : 0) * 0.35);
        return [col.map(q => q * Math.max(0.45, 1 - 4 * Math.max(0, P.cav))), 0.9];
      } },
    slime: { w: 256, h: 256, tile: [0.4, 0.4], seed: 233, depth: 0.004,
      hgt(u, v, K, o) {
        const n = K.fbm(u * 6, v * 6, 6, 6, 5), tufts = K.vn(u * 60, v * 60, 60, 60);
        o[0] = clamp(0.5 + 0.3 * (n - 0.5) + 0.25 * sm(0.55, 0.8, tufts)); o[1] = n; o[2] = sm(0.6, 0.75, K.fbm(u * 3 + 3, v * 3, 3, 3, 3)); o[3] = 0;
      },
      col(u, v, P, K) {
        let col = mix3([0.025, 0.035, 0.018], [0.06, 0.075, 0.03], P.m1); col = mix3(col, [0.08, 0.05, 0.03], P.m2 * 0.5);
        return [col.map(q => q * Math.max(0.5, 1 - 3 * Math.max(0, P.cav))), 0.35];
      } },
    zinc: { w: 512, h: 512, tile: [0.8, 0.8], seed: 241, depth: 0.0008,
      hgt(u, v, K, o) {
        K.cell(u * 14, v * 14, 14, 14, K.c, 0.9); const sp = K.c[2];
        const rust = sm(0.62, 0.7, K.fbm(u * 3, v * 0.6, 3, 1, 4) + 0.3 * (1 - v)) * sm(0.4, 0.9, K.vn(u * 30, v * 2, 30, 2));
        o[0] = clamp(0.6 + 0.04 * (sp - 0.5) + 0.1 * rust * K.vn(u * 80, v * 80, 80, 80)); o[1] = sp; o[2] = patch(u, v, K, 4, 0.22, 1.7); o[3] = rust;
      },
      col(u, v, P, K) {
        let col = mix3([0.3, 0.31, 0.31], [0.38, 0.39, 0.385], P.m1); col = mix3(col, [0.48, 0.48, 0.46], P.m2 * 0.5);
        col = mix3(col, [0.22, 0.09, 0.035], P.m3 * 0.85);
        return [col, mix(0.45, 0.8, Math.max(P.m2, P.m3))];
      } },
    zincGreen: { w: 512, h: 512, tile: [0.8, 0.8], seed: 251, depth: 0.0008,
      hgt(u, v, K, o) {
        const fade = K.fbm(u * 2, v * 2, 2, 2, 4), rust = sm(0.74, 0.8, K.fbm(u * 3, v * 0.6, 3, 1, 4) + 0.25 * (1 - v)) * sm(0.55, 0.9, K.vn(u * 30, v * 2, 30, 2));
        const chip = sm(0.88, 0.9, K.fbm(u * 12, v * 12, 12, 12, 3));
        o[0] = clamp(0.62 - 0.08 * chip + 0.06 * rust * K.vn(u * 80, v * 80, 80, 80)); o[1] = fade; o[2] = chip; o[3] = rust;
      },
      col(u, v, P, K) {
        let col = mix3([0.06, 0.13, 0.08], [0.1, 0.18, 0.115], P.m1); col = mix3(col, [0.28, 0.29, 0.29], P.m2 * 0.8); col = mix3(col, [0.17, 0.075, 0.032], P.m3 * 0.7);
        return [col, mix(0.55, 0.8, P.m3)];
      } },
    paintCream: { w: 256, h: 512, tile: [0.4, 0.8], seed: 263, depth: 0.0015,
      hgt(u, v, K, o) {
        const [line] = grain(u, v, K, 18, null), peel = sm(0.8, 0.83, K.fbm(u * 5, v * 3, 5, 3, 5) + 0.12 * sm(0.12, 0.0, Math.min(u, 1 - u)));
        o[0] = clamp(0.7 + 0.04 * line - 0.12 * peel + 0.03 * (K.vn(u * 100, v * 100, 100, 100) - 0.5)); o[1] = peel; o[2] = patch(u, v, K, 3, 0.25, 4.2); o[3] = line;
      },
      col(u, v, P, K) {
        let col = mix3([0.58, 0.55, 0.46], [0.66, 0.63, 0.54], K.fbm(u * 3, v * 3, 3, 3, 3)); col = mix3(col, [0.5, 0.47, 0.4], P.m2 * 0.3); col = col.map(q => q * (0.97 + 0.04 * P.m3));
        col = mix3(col, mix3([0.2, 0.19, 0.17], [0.13, 0.12, 0.1], P.m3), P.m1);
        return [col.map(q => q * Math.max(0.55, 1 - 4 * Math.max(0, P.cav))), mix(0.75, 0.88, P.m1)];
      } },
    /* packed earth on a trail: brown, gritty, small stones and bits of leaf trodden in */
    soilStep: { w: 512, h: 512, tile: [1.0, 1.0], seed: 281, depth: 0.004,
      hgt(u, v, K, o) {
        K.cell(u * 40, v * 40, 40, 40, K.c, 0.9); const st = sm(0.32, 0.18, K.c[0]) * (K.c[2] < 0.25 ? 1 : 0), lf = sm(0.82, 0.86, K.vn(u * 30, v * 30, 30, 30));
        o[0] = clamp(0.5 + 0.15 * (K.fbm(u * 8, v * 8, 8, 8, 4) - 0.5) + 0.35 * st + 0.08 * lf); o[1] = st; o[2] = lf; o[3] = K.c[2];
      },
      col(u, v, P, K) {
        let col = mix3([0.085, 0.058, 0.036], [0.13, 0.092, 0.06], K.fbm(u * 5, v * 5, 5, 5, 3)); col = mix3(col, [0.2, 0.18, 0.15].map(q => q * (0.8 + 0.4 * P.m3)), P.m1); col = mix3(col, [0.16, 0.09, 0.035], P.m2 * 0.8);
        return [col.map(q => q * Math.max(0.5, 1 - 4 * Math.max(0, P.cav))), 0.92];
      } },
    concrete: { w: 512, h: 512, tile: [1.0, 1.0], seed: 271, depth: 0.002,
      hgt(u, v, K, o) {
        const pores = sm(0.82, 0.9, K.vn(u * 160, v * 160, 160, 160)), agg = K.fbm(u * 30, v * 30, 30, 30, 3);
        o[0] = clamp(0.7 + 0.1 * (agg - 0.5) - 0.4 * pores); o[1] = pores; o[2] = sm(0.55, 0.75, K.fbm(u * 3, v * 1.5, 3, 2, 4)); o[3] = patch(u, v, K, 4, 0.2, 9.2);
      },
      col(u, v, P, K) {
        let col = mix3([0.3, 0.29, 0.27], [0.4, 0.39, 0.36], K.fbm(u * 6, v * 6, 6, 6, 3)); col = mix3(col, [0.17, 0.165, 0.15], P.m2 * 0.5);
        col = mix3(col, [0.2, 0.22, 0.16], P.m3 * 0.35); col = mix3(col, [0.1, 0.1, 0.09], P.m1);
        return [col, 0.92];
      } } });

  /* ── materials: the kind's textures over the parts' own vertex colours (each board its own tone) ── */
  const mats = new Map();
  function mat(kind, o = {}) {
    const key = kind + JSON.stringify(o); if (mats.has(key)) return mats.get(key);
    const m = FK.barkMat(kind, Object.assign({ tint: 1, ns: 1.2 }, o));
    if (o.metal != null) m.metalness = o.metal;
    mats.set(key, m); return m;
  }
  const tile = kind => FK.bark(kind).tile;

  /* ── a board: L long (along x), Th thick (y), W wide (z), centred; its long edges rounded off a few millimetres (so it
     never looks cut from card: the light runs along its arrises); its uvs in tiles of its material, the grain along its
     length; its ends end grain, darker. tone: its own colour multiplier; u0, v0: where on the texture it was cut from ── */
  function board(L, Th, W, o = {}) {
    const tl = o.tile || tile(o.kind || 'timber'), u0 = o.u0 ?? 0, v0 = o.v0 ?? 0, tone = o.tone || [1, 1, 1], e = o.round ?? Math.min(0.005, Th * 0.2, W * 0.2), cs = 3;
    /* (the section: a rounded rectangle, its points and their outward normals, going round; the perimeter's length to each) */
    const prof = [], hy = Th / 2, hz = W / 2;
    for (const [cy, cz, a0] of [[hy - e, hz - e, 0], [-hy + e, hz - e, Math.PI / 2], [-hy + e, -hz + e, Math.PI], [hy - e, -hz + e, Math.PI * 1.5]])
      for (let k = 0; k <= cs; k++) { const a = a0 + k / cs * Math.PI / 2, ny = Math.cos(a), nz = Math.sin(a); prof.push([cy + ny * e, cz + nz * e, ny, nz]); }
    const per = [0]; for (let k = 1; k <= prof.length; k++) { const p = prof[k - 1], q = prof[k % prof.length]; per.push(per[k - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    const P = [], N = [], U = [], C = [], I = [], n = prof.length;
    for (const x of [-L / 2, L / 2]) for (let k = 0; k <= n; k++) { const p = prof[k % n]; P.push(x, p[0], p[1]); N.push(0, p[2], p[3]); U.push(u0 + per[k] / tl[0], v0 + (x + L / 2) / tl[1]); C.push(...tone); }
    for (let k = 0; k < n; k++) { const a = k, b = k + 1, c = n + 1 + k, d = c + 1; I.push(a, b, c, b, d, c); }
    /* (the ends: a fan of end grain) */
    const dk = tone.map(q => q * 0.62);
    for (const sx of [-1, 1]) { const b0 = P.length / 3; P.push(sx * L / 2, 0, 0); N.push(sx, 0, 0); U.push(u0 + 0.5, v0); C.push(...dk);
      for (let k = 0; k < n; k++) { const p = prof[k]; P.push(sx * L / 2, p[0], p[1]); N.push(sx, 0, 0); U.push(u0 + 0.5 + p[1] / tl[0], v0 + p[0] / tl[1]); C.push(...dk); }
      for (let k = 0; k < n; k++) { const a = b0 + 1 + k, b = b0 + 1 + (k + 1) % n; sx > 0 ? I.push(b0, a, b) : I.push(b0, b, a); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setIndex(I);
    /* (the side faces wound outward: check one) */
    const t = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3(); a.fromBufferAttribute(g.attributes.position, I[1]).sub(t.fromBufferAttribute(g.attributes.position, I[0])); b.fromBufferAttribute(g.attributes.position, I[2]).sub(t);
    const fn = new T.Vector3().crossVectors(a, b), n0 = new T.Vector3().fromBufferAttribute(g.attributes.normal, I[0]);
    if (fn.dot(n0) < 0) { for (let k = 0; k < n * 6; k += 3) { const q = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = q; } g.setIndex(I); }
    return g;
  }
  /* a round pile from y0 up to y1, radius r (a little irregular), its bark-like uvs round it and up it */
  function pile(r, y0, y1, o = {}) {
    const tl = o.tile || tile(o.kind || 'pile'), radial = o.radial || 14, rows = Math.max(2, Math.ceil((y1 - y0) / (o.dy || 0.25)) + 1), seed = o.seed || 1, nU = Math.max(1, Math.round(TAU * r / tl[0]));
    const g = FK.gridGeo(rows, radial, true, (i, j) => {
      const y = y0 + (y1 - y0) * i / (rows - 1), a = j / radial * TAU, rr = r * (1 + 0.04 * Models.vn(a * 2 + seed, y * 1.3, seed) - 0.02) * (o.taper ? 1 - o.taper * (y - y0) / (y1 - y0) : 1);
      const c = o.col ? o.col(y, a) : [1, 1, 1];
      return [Math.cos(a) * rr, y, Math.sin(a) * rr, j / radial * nU + (o.u0 || 0), y / tl[1] + (o.v0 || 0), c[0], c[1], c[2]];
    });
    return FK.faceOut(g, (x, y, z, nx, ny, nz) => x * nx + z * nz);
  }
  /* a sheet of corrugated iron: W wide (x), L long (z, down the roof's slope), its corrugations running along z; pitch and
     depth of the corrugation; uvs in tiles of its material */
  function corrugated(W, L, o = {}) {
    const pitch = o.pitch || 0.076, depth = o.depth || 0.018, tl = o.tile || tile(o.kind || 'zinc'), nx = Math.max(2, Math.round(W / pitch * 6)), nz = 2;
    const g = FK.gridGeo(nz, nx + 1, false, (i, j) => {
      const x = -W / 2 + W * j / nx, z = -L / 2 + L * i / (nz - 1), y = depth * 0.5 * Math.cos(x / pitch * TAU);
      return [x, y, z, (x + W / 2) / tl[0] + (o.u0 || 0), (z + L / 2) / tl[1] + (o.v0 || 0), 1, 1, 1];
    });
    return FK.faceOut(g, (x, y, z, nx, ny) => ny);
  }

  /* ── gathering: parts placed by a matrix, kept per material, merged at the end into one mesh each ── */
  function Builder() {
    const by = new Map();
    return {
      add(kind, geo, m, o = {}) { const key = kind + JSON.stringify(o); if (!by.has(key)) by.set(key, { kind, o, parts: [] }); if (m) geo.applyMatrix4(m); by.get(key).parts.push(geo); return geo; },
      build(g, cast = true) {
        for (const { kind, o, parts } of by.values()) {
          const mm = new T.Mesh(FK.mergeParts(parts.map(p => (p.index ? p : withIndex(p)))), mat(kind, o)); mm.castShadow = cast; mm.receiveShadow = true; mm.userData.kind = kind; g.add(mm);
        }
        return g;
      } };
  }
  function withIndex(g) { const n = g.attributes.position.count, I = new Uint32Array(n); for (let i = 0; i < n; i++) I[i] = i; g.setIndex(new T.BufferAttribute(I, 1)); return g; }
  /* a placing matrix: at (x, y, z), turned ry about y (then rz about z, rx about x) */
  const M = (x = 0, y = 0, z = 0, ry = 0, rz = 0, rx = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YZX')), new T.Vector3(1, 1, 1));
  /* a board from point a to point b (its length between them), Th thick and W wide, turned `roll` about its own length */
  /* (its length from a to b; its thickness Th along o.up — the way its broad face looks, made square to its length; up
     unless it stands upright, when x — and its width W across both) */
  function boardAB(B, kind, a, b, Th, W, o = {}) {
    const X = new T.Vector3().subVectors(b, a), L = X.length(), mid = a.clone().add(b).multiplyScalar(0.5); X.normalize();
    const up = o.up ? o.up.clone() : Math.abs(X.y) > 0.95 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0), Y = up.addScaledVector(X, -up.dot(X)).normalize(), Z = new T.Vector3().crossVectors(X, Y);
    const m = new T.Matrix4().makeBasis(X, Y, Z); if (o.roll) m.multiply(new T.Matrix4().makeRotationX(o.roll)); m.setPosition(mid);
    return B.add(kind, board(L + (o.extra || 0), Th, W, o), m, o.mat);
  }
  return { mat, tile, board, pile, corrugated, Builder, M, boardAB, clamp, sm, mix, mix3 };
})();
