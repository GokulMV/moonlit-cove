/* ─────────────────────────────────────────────────────────────
   forest.js — the island's trees, every one of them where it
   grows (Layout.isle). Along the beaches a front of coconut palms
   leaning out over the sand, sea hibiscus sprawling and pandans
   standing on their stilt roots, and behind them the beach forest
   of sea almonds and Barringtonia, here and there a stand of
   casuarinas; inland, up the slopes and over the ridge, the
   dipterocarp forest, crown against crown, its emergents standing
   out of it, a tualang or a strangler fig among them, smaller and
   lower toward the summit; on the rocks, pandans and figs; round
   the creek the mangroves, Rhizophora on its stilts at the water,
   Avicennia and Sonneratia out on the mud, nipa palms up its
   banks. Each tree is drawn from its own cell of a grid over the
   island, so the forest comes out the same whatever is built
   first. Near the eye they stand as themselves (a few shapes of
   each kind, each drawn many times); further off as their cards
   (impostor.js), the same trees photographed.
   ───────────────────────────────────────────────────────────── */
const IsleForest = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (x, a, b, c, d) => sm(a, b, x) * (1 - sm(c, d, x));
  /* (smooth noise over the island, for where the stands of a kind are) */
  const vn2 = (x, z, k) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, fu = u * u * (3 - 2 * u), fv = v * v * (3 - 2 * v), a = hash3(i, j, k), b = hash3(i + 1, j, k), c = hash3(i, j + 1, k), d = hash3(i + 1, j + 1, k); return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv; };
  const hash3 = (a, b, c) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 0x3c6ef372, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  /* ── the kinds: the model each is grown from and its shapes (seeds), how big each grows (its scale), and how far off it
     is still drawn as itself rather than its card ── */
  const KINDS = {
    canopy: { model: 'flora/canopy', seeds: [3, 7, 19], opts: { lod: 1 }, s: [0.85, 1.28] },
    emergent: { model: 'flora/emergent', seeds: [2, 5], opts: { lod: 1 }, s: [0.8, 1.05] },
    tualang: { model: 'flora/tualang', seeds: [3], opts: { lod: 1 }, s: [0.85, 1.0] },
    fig: { model: 'flora/fig', seeds: [4], opts: { lod: 1 }, s: [0.8, 1.0] },
    terminalia: { model: 'flora/terminalia', seeds: [2], opts: { lod: 1 }, s: [0.85, 1.25] },
    barringtonia: { model: 'flora/barringtonia', seeds: [3], opts: { lod: 0 }, s: [0.85, 1.3] },
    casuarina: { model: 'flora/casuarina', seeds: [2], opts: { lod: 1 }, s: [0.9, 1.4] },
    coconut: { model: 'fruit/coconut-palm', seeds: [2, 4], opts: { fruit: false }, s: [0.8, 1.15] },
    /* (the mangroves' hanging propagules and fruits fewer than the studio's: each a few hundred triangles, and these trees
       stand near the eye by the dozen) */
    rhizophora: { model: 'flora/rhizophora', seeds: [2], opts: { lod: 1, propagules: 24, seedlings: 0 }, s: [0.8, 1.15] },
    avicennia: { model: 'flora/avicennia', seeds: [2], opts: { lod: 1 }, s: [0.8, 1.1] },
    sonneratia: { model: 'flora/sonneratia', seeds: [2], opts: { lod: 1, fruits: 12 }, s: [0.85, 1.1] },
    bruguiera: { model: 'flora/bruguiera', seeds: [2], opts: { lod: 1, propagules: 16 }, s: [0.8, 1.1] },
    /* (the small ones, photographed smaller) */
    hibiscus: { model: 'flora/hibiscus', seeds: [2], opts: { lod: 0 }, s: [0.8, 1.25], small: true },
    understory: { model: 'flora/understory', seeds: [2, 9], opts: { lod: 0 }, s: [0.8, 1.3], small: true },
    fanpalm: { model: 'flora/fanpalm', seeds: [2], opts: {}, s: [0.85, 1.35], small: true },
    treefern: { model: 'flora/treefern', seeds: [3], opts: {}, s: [0.85, 1.2], small: true },
    pandanus: { model: 'flora/pandanus', seeds: [2], opts: {}, s: [0.8, 1.25], small: true },
    nipa: { model: 'flora/nipa', seeds: [2], opts: {}, s: [0.8, 1.2], small: true },
    /* (the forest's floor, round the eye only, never photographed: ferns, an elephant ear, saplings waiting in the shade,
       a ginger's canes, a fallen log) */
    groundfern: { model: 'flora/groundfern', seeds: [2, 5], opts: {}, s: [0.8, 1.35], ground: true },
    aroid: { model: 'flora/aroid', seeds: [3], opts: {}, s: [0.8, 1.3], ground: true },
    seedling: { model: 'flora/seedling', seeds: [2, 7], opts: { H: 1.3 }, s: [0.5, 1.7], ground: true },
    ginger: { model: 'flora/ginger', seeds: [2], opts: {}, s: [0.7, 1.1], ground: true, cap: 14 },
    log: { model: 'flora/log', seeds: [3, 8], opts: {}, s: [0.8, 1.2], ground: true, cap: 10 }
  };
  /* (the kinds that grow in the forest's crowd, whose trunks are hidden from above under the crowns; not the palms and the
     trees standing in the open) */
  for (const k of ['canopy', 'emergent', 'tualang', 'fig', 'terminalia', 'barringtonia', 'understory', 'bruguiera', 'avicennia', 'sonneratia']) KINDS[k].hide = true;
  /* (how many of a shape can stand near the eye at once; the heaviest fewer) */
  KINDS.rhizophora.cap = 30; KINDS.sonneratia.cap = 40; KINDS.avicennia.cap = 40; KINDS.bruguiera.cap = 40;
  /* ── the grids the trees are drawn from: each its cell size (and so how close two of it can stand) and how its kinds
     are chosen where it grows. A cell holds one candidate tree at a jittered place; it grows if the place says so (the
     odds there), and gives way to a neighbour of its grid that drew higher and stands too close ── */
  const GRIDS = [
    { id: 1, g: 6, kinds: ['coconut'] },
    { id: 2, g: 7.5, kinds: ['terminalia', 'barringtonia', 'hibiscus', 'pandanus'] },
    { id: 3, g: 6.5, kinds: ['casuarina'] },
    { id: 4, g: 10, kinds: ['canopy'] },
    { id: 5, g: 34, kinds: ['emergent', 'tualang', 'fig'] },
    /* under the canopy, the trees waiting to take their places in it: the same kinds, half grown, crowns ten and fifteen
       metres up, filling the forest's middle storey (seen from a slope, the space between the floor and the canopy) */
    { id: 10, g: 8, kinds: ['canopy'], s: [0.48, 0.72] },
    /* the mangroves: Rhizophora on its stilts along the water, Avicennia and Sonneratia out on the mud, Bruguiera behind
       on its knees, nipa palms up the creek's banks */
    { id: 6, g: 6.5, kinds: ['rhizophora', 'avicennia', 'sonneratia', 'nipa', 'bruguiera'] },
    /* the forest's lower storey: small trees, fan palms, tree ferns, thickest at its edges, where the light gets in */
    { id: 7, g: 6.5, kinds: ['understory', 'fanpalm', 'treefern'] },
    /* the green wall along a beach's top: sea hibiscus sprawling, pandans, a fan palm or a sapling */
    { id: 8, g: 4.2, kinds: ['hibiscus', 'pandanus', 'fanpalm', 'understory'] },
    /* the forest's floor (worked out round the eye as it goes, never all at once) */
    { id: 9, g: 2.3, kinds: ['groundfern', 'aroid', 'seedling', 'ginger', 'log'], ground: true }
  ];

  function build(root, I, o) {
    const R = o.R, land = o.land, SQ = {}, group = new T.Group(); group.name = 'forest'; group.matrixAutoUpdate = false; root.add(group);
    /* ── the shapes: each kind's models grown, their parts to be drawn many times, and their pictures for the cards ── */
    const protos = [], byKind = {};
    for (const k in KINDS) {
      byKind[k] = [];
      for (const seed of KINDS[k].seeds) {
        const t0 = performance.now(), obj = Models.make(KINDS[k].model, Object.assign({ seed }, KINDS[k].opts)); obj.updateMatrixWorld(true);
        const parts = []; obj.traverse(m => { if (m.isMesh && !m.isInstancedMesh && m.geometry && m.geometry.attributes.position.count) parts.push({ geo: m.geometry, mat: m.material, depth: m.customDepthMaterial || null, M: m.matrixWorld.clone(), cast: m.castShadow,
          leaf: !!(m.material && m.material.isShaderMaterial && m.material.uniforms && m.material.uniforms.nmap) }); });
        const p = { kind: k, seed, obj, parts, i: protos.length, ms: performance.now() - t0 };
        protos.push(p); byKind[k].push(p);
      }
    }
    /* (two atlases: the trees, and the small plants in pictures of half the size; each shape's card says which, and where) */
    const t0 = performance.now(), sets = [protos.filter(p => !KINDS[p.kind].small && !KINDS[p.kind].ground), protos.filter(p => KINDS[p.kind].small)];
    const atlases = sets.map((L, k) => L.length ? Impostor.bake(R, L.map(p => ({ obj: p.obj })), { cell: k ? 88 : 176, pad: k ? 4 : 6 }) : null), bakeMs = performance.now() - t0;
    sets.forEach((L, k) => L.forEach((p, j) => { p.atlas = k; p.ai = j; if (KINDS[p.kind].hide && atlases[k]) atlases[k].info[j].hide = 1; }));
    let NEAR = o.near ?? 64; const FADE = 10, mats = atlases.map(a => a && Impostor.material(a, { near: NEAR, fade: FADE }));
    /* (how far off the trees stand as themselves, and their cards begin) */
    const setNear = r => { NEAR = r; for (const m of mats) if (m) m.uniforms.uNear.value.x = r; lastX = 1e9; };

    /* ── where each grows: the place's shore, how far in from the water's edge, how high ── */
    const camp = Layout.camp, keepOut = [[camp.x, camp.z, 26]].concat(Layout.palms.map(p => [p[0], p[1], 4]), Layout.trees.map(t => [t[0], t[1], t[2] + 2.5]), (Layout.fruit || []).map(f => [f.x, f.z, 5]), o.keep || []);
    /* (the places kept clear, in a grid of 16 m buckets: there may be thousands of them along the trails) */
    const KG = 16, kgrid = new Map();
    for (const c of keepOut) { const [cx, cz, r] = c; for (let gz = Math.floor((cz - r) / KG); gz <= Math.floor((cz + r) / KG); gz++) for (let gx = Math.floor((cx - r) / KG); gx <= Math.floor((cx + r) / KG); gx++) { const k = gx * 65536 + gz; let L = kgrid.get(k); if (!L) kgrid.set(k, (L = [])); L.push(c); } }
    const kept = (x, z) => { const L = kgrid.get(Math.floor(x / KG) * 65536 + Math.floor(z / KG)); if (L) for (const [cx, cz, r] of L) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; return Math.abs(x - camp.x) < 22 && z < camp.z + 20; };
    function odds(G, x, z, out) {
      const s = I.sdf(x, z); if (s > 9) return 0;
      const q = I.shore(I.uAt(x, z), SQ), d = -s, W = q.W, h = I.height(x, z);
      const rockK = (q.rock + q.cliff) * (1 - sm(W + 4, W + 18, d)), forest = Math.max(sm(W + 16, W + 46, d) * q.sand, sm(W + 6, W + 20, d) * (q.rock + q.cliff), sm(16, 44, d) * q.mangrove) * (1 - rockK);
      const notMang = 1 - sm(0.25, 0.55, q.mangrove);
      if (G.id === 1) return q.sand * notMang * (0.85 * bump(d, W - 5, W - 1.5, W + 7, W + 16) + 0.12 * bump(d, W, W + 6, W + 38, W + 60));
      if (G.id === 2) {
        const front = q.sand * bump(d, W - 2, W + 1, W + 12, W + 22), back = q.sand * bump(d, W + 3, W + 10, W + 42, W + 64), rocks = (q.rock + q.cliff) * bump(d, W - 0.5, W + 2, W + 12, W + 22);
        out.w = [back * 0.55, back * 0.4 + front * 0.25, front * 0.6 + rocks * 0.25, front * 0.25 + rocks * 0.6];
        return notMang * Math.min(1, front + back + rocks) * 0.75;
      }
      if (G.id === 3) { const patch = sm(0.6, 0.74, vn2(x / 170, z / 170, 7)); return q.sand * notMang * patch * bump(d, W - 3, W + 1, W + 30, W + 46) * 0.8; }
      if (G.id === 4) return forest * (h > 225 ? 0.85 : 1) * 0.93;
      if (G.id === 5) { const deep = sm(W + 55, W + 120, d) * forest * (h > 200 ? 0.4 : 1); out.w = [0.62, 0.22, 0.16]; return deep * 0.42; }
      if (G.id === 10) return sm(W + 22, W + 50, d) * forest * (h > 225 ? 0.7 : 1) * 0.8;
      if (G.id === 7) { const edge = 1 - sm(W + 30, W + 80, d); out.w = [0.62, 0.24, 0.14 + 0.2 * (1 - edge)]; return Math.max(forest, sm(W + 4, W + 14, d) * q.sand * edge) * (0.42 + 0.52 * edge) * (h > 230 ? 0.6 : 1); }
      if (G.id === 8) { const wall = q.sand * notMang * bump(d, W - 2.5, W + 0.5, W + 12, W + 20) + (q.rock + q.cliff) * bump(d, W + 1, W + 4, W + 14, W + 24) * 0.7; out.w = [0.5, 0.2, 0.12, 0.18]; return Math.min(1, wall) * 0.85; }
      if (G.id === 9) { out.w = [0.46, 0.17, 0.27, 0.06, 0.04]; return Math.max(forest, q.sand * bump(d, W + 1, W + 6, W + 40, W + 60)) * 0.62; }
      if (G.id === 6) {
        const m = q.mangrove; if (m < 0.2) return 0;
        out.w = [bump(d, -8, -4, 9, 20), bump(d, -14, -8, 2, 8) * 0.8, bump(d, -12, -6, 1, 6) * 0.6, (q.creek >= 0 ? 1 : 0.2) * bump(d, -1, 3, 14, 26) * 0.7, bump(d, 5, 11, 26, 40) * 0.85];
        return sm(0.2, 0.6, m) * Math.min(1, out.w[0] + out.w[1] + out.w[2] + out.w[3] + out.w[4]) * 0.92;
      }
      return 0;
    }
    /* a grid's candidate in cell (gx, gz), if it has one: [x, z, its draw, odds] */
    const W4 = { w: null };
    function cand(G, gx, gz, out) {
      const x = (gx + 0.1 + 0.8 * hash3(gx, gz, G.id * 16 + 1)) * G.g, z = (gz + 0.1 + 0.8 * hash3(gx, gz, G.id * 16 + 2)) * G.g;
      const p = odds(G, x, z, W4); if (p <= 0 || hash3(gx, gz, G.id * 16 + 3) >= p) return null;
      out[0] = x; out[1] = z; out[2] = hash3(gx, gz, G.id * 16 + 4); return out;
    }
    /* ── a tile's trees: every grid's over the tile, those that grow, each its kind and shape, turned and sized ── */
    const C0 = [0, 0, 0], C1 = [0, 0, 0];
    function* plan(tx, tz, TS, late) {
      const out = [];
      for (const G of GRIDS) {
        if (G.ground) continue;
        for (let gz = Math.floor(tz / G.g); gz * G.g < tz + TS; gz++) {
          for (let gx = Math.floor(tx / G.g); gx * G.g < tx + TS; gx++) {
            const c = cand(G, gx, gz, C0); if (!c) continue;
            const x = c[0], z = c[1], pr = c[2]; if (x < tx || x >= tx + TS || z < tz || z >= tz + TS || kept(x, z)) continue;
            const w = W4.w && W4.w.slice();
            let gives = false;
            for (let j = -1; j <= 1 && !gives; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const n = cand(G, gx + i, gz + j, C1); if (n && n[2] > pr && (n[0] - x) ** 2 + (n[1] - z) ** 2 < G.g * G.g * 0.72) { gives = true; break; } }
            if (gives) continue;
            /* (which of its kinds: by the place's weights, or the one) */
            let kind = G.kinds[0];
            if (G.kinds.length > 1 && w) { let tot = w.reduce((a, b) => a + b, 0), r = hash3(gx, gz, G.id * 16 + 5) * tot; for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) { kind = G.kinds[k]; break; } } }
            const K = KINDS[kind], P = byKind[kind], p = P[Math.floor(hash3(gx, gz, G.id * 16 + 6) * P.length) % P.length];
            const h = I.height(x, z), S = G.s || K.s, s = (S[0] + (S[1] - S[0]) * hash3(gx, gz, G.id * 16 + 7)) * (G.id === 4 || G.id === 5 || G.id === 10 ? 1 - 0.3 * sm(150, 250, h) : 1);
            out.push({ x, y: land(x, z) - 0.15, z, s, yaw: hash3(gx, gz, G.id * 16 + 8) * TAU, p: p.i, tint: hash3(gx, gz, G.id * 16 + 9), die: hash3(gx, gz, G.id * 16 + 10), kind });
          }
          if (late()) yield;
        }
      }
      return out;
    }
    /* a tile's cards: those of each atlas together */
    function cards(list) {
      const out = [];
      atlases.forEach((a, k) => { if (!a) return; const L = list.filter(t => protos[t.p].atlas === k).map(t => Object.assign({}, t, { p: protos[t.p].ai })); if (!L.length) return;
        const m = Impostor.cards(L, mats[k]); m.matrixAutoUpdate = false; group.add(m); out.push(m); });
      return out;
    }

    /* ── near the eye: the trees themselves. Every few frames, the trees within reach, nearest first, as many of each
       shape as it has room for, drawn as many copies of that shape's parts ── */
    const capOf = p => KINDS[p.kind].cap || (KINDS[p.kind].ground ? 360 : 140), near = protos.map(p => p.parts.map(pt => {
      const im = new T.InstancedMesh(pt.geo, pt.mat, capOf(p)); im.count = 0; im.frustumCulled = false; im.castShadow = pt.cast; im.receiveShadow = true; if (pt.depth) im.customDepthMaterial = pt.depth;
      /* (the leaves each tree's own green, as its card has it) */
      if (pt.leaf) im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(capOf(p) * 3).fill(1), 3);
      im.matrixAutoUpdate = false; group.add(im); return { im, M: pt.M, leaf: pt.leaf };
    }));
    const GROUND = 30, GF = GRIDS.find(G => G.ground), floorMemo = new Map();
    function floorNear(cx, cz) {
      const out = [], G = GF;
      for (let gz = Math.floor((cz - GROUND) / G.g); gz * G.g < cz + GROUND; gz++) for (let gx = Math.floor((cx - GROUND) / G.g); gx * G.g < cx + GROUND; gx++) {
        const key = gx * 100003 + gz; let tr = floorMemo.get(key);
        if (tr === undefined) {
          tr = null; const c = cand(G, gx, gz, C0);
          if (c && !kept(c[0], c[1])) { const w = W4.w.slice(); let r = hash3(gx, gz, 151) * w.reduce((a, b) => a + b, 0), kind = G.kinds[0]; for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) { kind = G.kinds[k]; break; } }
            const K = KINDS[kind], P = byKind[kind], p = P[Math.floor(hash3(gx, gz, 152) * P.length) % P.length];
            tr = { x: c[0], y: land(c[0], c[1]) - 0.04, z: c[1], s: K.s[0] + (K.s[1] - K.s[0]) * hash3(gx, gz, 153), yaw: hash3(gx, gz, 154) * TAU, p: p.i }; }
          if (floorMemo.size > 6000) floorMemo.clear();
          floorMemo.set(key, tr);
        }
        if (tr && (tr.x - cx) ** 2 + (tr.z - cz) ** 2 < GROUND * GROUND) out.push(tr);
      }
      return out;
    }
    /* a tree's own green (as impostor.js's cards work it out) */
    const TA = [0.88, 0.9, 0.86], TB = [1.1, 1.06, 1.0], TQ = [0, 0, 0];
    function tintOf(t, die) {
      const f = die * 7.31 - Math.floor(die * 7.31), Y2 = [1.06, 1.02, 0.84], B2 = [0.9, 1.0, 1.1];
      for (let k = 0; k < 3; k++) TQ[k] = (TA[k] + (TB[k] - TA[k]) * t) * (Y2[k] + (B2[k] - Y2[k]) * f);
      if (die < 0.012) TQ.splice(0, 3, 1.25, 0.82, 0.5); else if (die < 0.02) TQ.splice(0, 3, 1.3, 0.75, 0.72); else if (die < 0.026) TQ.splice(0, 3, 1.6, 0.5, 0.25); else if (die < 0.031) TQ.splice(0, 3, 1.45, 1.25, 0.35);
      return TQ;
    }
    let lastX = 1e9, lastZ = 1e9, frame = 0; const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
    function nearUpdate(cx, cy, cz, tiles) {
      frame++;
      if (frame % 4 && Math.hypot(cx - lastX, cz - lastZ) < 4) return;
      lastX = cx; lastZ = cz;
      const pick = protos.map(() => []), R2 = (NEAR + FADE) ** 2;
      for (const t of tiles) {
        if (!t.trees || Math.max(0, t.x - cx, cx - t.x - t.TS) ** 2 + Math.max(0, t.z - cz, cz - t.z - t.TS) ** 2 > R2) continue;
        for (const tr of t.trees) { const d2 = (tr.x - cx) ** 2 + (tr.y - cy) ** 2 * 0.3 + (tr.z - cz) ** 2; if (d2 < R2) pick[tr.p].push([d2, tr]); }
      }
      /* (the floor round the eye, out to GROUND, drawn from its grid as the eye comes near; and none of it high up) */
      if (cy - land(cx, cz) < 40) for (const tr of floorNear(cx, cz)) { const d2 = (tr.x - cx) ** 2 + (tr.z - cz) ** 2; pick[tr.p].push([d2, tr]); }
      pick.forEach((L, i) => {
        L.sort((a, b) => a[0] - b[0]); const n = Math.min(capOf(protos[i]), L.length);
        for (const part of near[i]) {
          for (let k = 0; k < n; k++) { const tr = L[k][1]; q.setFromAxisAngle(Y, tr.yaw); sc.setScalar(tr.s); pos.set(tr.x, tr.y, tr.z); m4.compose(pos, q, sc).multiply(part.M); part.im.setMatrixAt(k, m4);
            if (part.leaf) part.im.instanceColor.array.set(tintOf(tr.tint ?? 0.5, tr.die ?? 0.5), k * 3); }
          part.im.count = n; part.im.instanceMatrix.needsUpdate = true; if (part.leaf) part.im.instanceColor.needsUpdate = true;
        }
      });
    }
    const stats = () => ({ protos: protos.length, atlases: atlases.map(a => a && [a.W, a.H]), bakeMs: Math.round(bakeMs), growMs: Math.round(protos.reduce((a, p) => a + p.ms, 0)), near: near.reduce((n, P) => n + (P[0] ? P[0].im.count : 0), 0) });
    /* how closed the forest's canopy is over a point (for the shade on the ground under it) */
    const cover = (x, z) => (kept(x, z) ? 0 : odds(GRIDS[3], x, z, W4));
    return { plan, cards, nearUpdate, mats, atlases, protos, stats, setNear, cover, get NEAR() { return NEAR; } };
  }
  return { build, KINDS, GRIDS };
})();
