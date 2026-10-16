/* ─────────────────────────────────────────────────────────────
   forest.js — the island's trees, every one of them where it
   grows (Layout.isle). Along the beach a front of coconut palms
   leaning out over the sand, sea hibiscus sprawling and pandans
   standing on their stilt roots, and behind them the beach forest
   of sea almonds and Barringtonia, here and there a stand of
   casuarinas; inland, over the whole of the island, the lowland
   forest, crown against crown, its emergents standing out of it,
   a tualang or a strangler fig among them; under the canopy the
   storeys of a rainforest, every one of them full: the young
   trees waiting for a gap, poles by the hundred, palms, rattans
   and tree ferns, and on the floor ferns, elephant ears, gingers,
   seedlings, bird's nest ferns and fallen logs. Each tree is
   drawn from its own cell of a grid over the island, so the
   forest comes out the same whatever is built first. Near the eye
   they stand as themselves (a few shapes of each kind, each drawn
   many times); further off as their cards (impostor.js), the same
   trees photographed.
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
    canopy: { model: 'flora/canopy', seeds: [3, 7, 19], opts: { lod: 1 }, s: [0.85, 1.28], cap: 200 },
    emergent: { model: 'flora/emergent', seeds: [2, 5], opts: { lod: 1 }, s: [0.8, 1.05] },
    tualang: { model: 'flora/tualang', seeds: [3], opts: { lod: 1 }, s: [0.85, 1.0] },
    fig: { model: 'flora/fig', seeds: [4], opts: { lod: 1 }, s: [0.8, 1.0] },
    terminalia: { model: 'flora/terminalia', seeds: [2, 6], opts: { lod: 1 }, s: [0.85, 1.25] },
    barringtonia: { model: 'flora/barringtonia', seeds: [3], opts: { lod: 0 }, s: [0.85, 1.3] },
    casuarina: { model: 'flora/casuarina', seeds: [2], opts: { lod: 1 }, s: [0.9, 1.4] },
    coconut: { model: 'fruit/coconut-palm', seeds: [2, 4], opts: { fruit: false }, s: [0.8, 1.15] },
    /* (the small ones, photographed smaller) */
    hibiscus: { model: 'flora/hibiscus', seeds: [2], opts: { lod: 0 }, s: [0.8, 1.25], small: true },
    understory: { model: 'flora/understory', seeds: [2, 9, 13], opts: { lod: 0 }, s: [0.8, 1.3], small: true, cap: 300 },
    fanpalm: { model: 'flora/fanpalm', seeds: [2, 5], opts: {}, s: [0.85, 1.35], small: true },
    treefern: { model: 'flora/treefern', seeds: [3], opts: {}, s: [0.85, 1.2], small: true },
    pandanus: { model: 'flora/pandanus', seeds: [2], opts: {}, s: [0.8, 1.25], small: true },
    rattan: { model: 'flora/rattan', seeds: [2, 6], opts: {}, s: [0.8, 1.3], small: true },
    /* (the forest's floor, round the eye only, never photographed: ferns, an elephant ear, saplings waiting in the shade,
       a ginger's canes, a bird's nest fern, a fallen log) */
    groundfern: { model: 'flora/groundfern', seeds: [2, 5], opts: {}, s: [0.8, 1.35], ground: true },
    aroid: { model: 'flora/aroid', seeds: [3], opts: {}, s: [0.8, 1.3], ground: true },
    seedling: { model: 'flora/seedling', seeds: [2, 7], opts: { H: 1.3 }, s: [0.5, 1.7], ground: true },
    ginger: { model: 'flora/ginger', seeds: [2], opts: {}, s: [0.7, 1.1], ground: true, cap: 30 },
    birdsnest: { model: 'flora/birdsnest', seeds: [3, 8], opts: {}, s: [0.8, 1.2], ground: true, cap: 60 },
    log: { model: 'flora/log', seeds: [3, 8], opts: {}, s: [0.8, 1.2], ground: true, cap: 14 }
  };
  /* (the kinds that grow in the forest's crowd, whose trunks are hidden from above under the crowns; not the palms and the
     trees standing in the open) */
  for (const k of ['canopy', 'emergent', 'tualang', 'fig', 'terminalia', 'barringtonia', 'understory']) KINDS[k].hide = true;
  /* ── the grids the trees are drawn from: each its cell size (and so how close two of it can stand) and how its kinds
     are chosen where it grows. A cell holds one candidate tree at a jittered place; it grows if the place says so (the
     odds there), and gives way to a neighbour of its grid that drew higher and stands too close ── */
  const GRIDS = [
    { id: 1, g: 6, kinds: ['coconut'] },
    { id: 2, g: 7, kinds: ['terminalia', 'barringtonia', 'hibiscus', 'pandanus'] },
    { id: 3, g: 6.5, kinds: ['casuarina'] },
    { id: 4, g: 9, kinds: ['canopy'] },
    { id: 5, g: 30, kinds: ['emergent', 'tualang', 'fig'] },
    /* under the canopy, the trees waiting to take their places in it: the same kinds, half grown, crowns ten and fifteen
       metres up, filling the forest's middle storey (seen from a slope, the space between the floor and the canopy) */
    { id: 10, g: 7, kinds: ['canopy'], s: [0.48, 0.72] },
    /* the forest's lower storey: small trees, fan palms, tree ferns, rattans, thickest at its edges, where the light gets
       in */
    { id: 7, g: 4.4, kinds: ['understory', 'fanpalm', 'treefern', 'rattan'] },
    /* the poles: young trees by the hundred, a few metres high, thin as an arm, a crown of a few big leaves, waiting */
    { id: 11, g: 3.3, kinds: ['understory'], s: [0.34, 0.6] },
    /* the green wall along a beach's top: sea hibiscus sprawling, pandans, a fan palm or a sapling */
    { id: 8, g: 4.2, kinds: ['hibiscus', 'pandanus', 'fanpalm', 'understory'] },
    /* the forest's floor (worked out round the eye as it goes, never all at once) */
    { id: 9, g: 1.6, kinds: ['groundfern', 'aroid', 'seedling', 'ginger', 'log', 'birdsnest'], ground: true }
  ];

  /* o: { R (the renderer, to photograph the cards with), land(x, z), keep (places kept clear), near, nearSmall,
     period (the grids drawn a whole number of cells round a loop that long, so the forest comes round again with it:
     the beach's loop), kept(x, z) (whether a place is kept clear, in place of the camp's and keep's), shift (the forest
     proper that much nearer the beach's top, m), sandEdge (nothing on the sand short of that far in from its top, m) } */
  function build(root, I, o) {
    const R = o.R, land = o.land, SQ = {}, group = new T.Group(); group.name = 'forest'; group.matrixAutoUpdate = false; root.add(group);
    /* (round a loop each grid a whole number of cells, its cells' numbers taken round it: the same trees each time round) */
    const GR = o.period ? GRIDS.map(G => { const n = Math.round(o.period / G.g); return Object.assign({}, G, { g: o.period / n, n }); }) : GRIDS;
    const hxOf = (G, gx) => G.n ? ((gx % G.n) + G.n) % G.n : gx, SH = o.shift || 0;
    /* ── the shapes: each kind's models grown, their parts to be drawn many times, and their pictures for the cards ── */
    const protos = [], byKind = {};
    for (const k in KINDS) {
      byKind[k] = [];
      for (const seed of KINDS[k].seeds) {
        const t0 = performance.now(), obj = Models.make(KINDS[k].model, Object.assign({ seed }, KINDS[k].opts)); obj.updateMatrixWorld(true);
        const parts = []; obj.traverse(m => { if (m.isMesh && !m.isInstancedMesh && m.geometry && m.geometry.attributes.position.count) parts.push({ geo: m.geometry, mat: m.material, depth: m.customDepthMaterial || null, M: m.matrixWorld.clone(), cast: m.castShadow,
          leaf: !!(m.material && m.material.isShaderMaterial && m.material.uniforms && m.material.uniforms.nmap) }); });
        const p = { kind: k, seed, obj, parts, i: protos.length, ms: performance.now() - t0, H: new T.Box3().setFromObject(obj).max.y };
        protos.push(p); byKind[k].push(p);
      }
    }
    /* (two atlases: the trees, and the small plants in pictures of half the size; each shape's card says which, and where) */
    const t0 = performance.now(), sets = [protos.filter(p => !KINDS[p.kind].small && !KINDS[p.kind].ground), protos.filter(p => KINDS[p.kind].small)];
    const atlases = sets.map((L, k) => L.length ? Impostor.bake(R, L.map(p => ({ obj: p.obj })), { cell: k ? 88 : 176, pad: k ? 4 : 6 }) : null), bakeMs = performance.now() - t0;
    sets.forEach((L, k) => L.forEach((p, j) => { p.atlas = k; p.ai = j; if (KINDS[p.kind].hide && atlases[k]) atlases[k].info[j].hide = 1; }));
    /* (how far off the trees stand as themselves, and their cards begin; the small plants' cards nearer) */
    let NEAR = o.near ?? 64, NEARS = Math.min(NEAR, o.nearSmall ?? 36); const FADE = 10, mats = atlases.map((a, k) => a && Impostor.material(a, { near: k ? NEARS : NEAR, fade: FADE }));
    const setNear = r => { NEAR = r; NEARS = Math.min(r, o.nearSmall ?? 36); mats.forEach((m, k) => { if (m) m.uniforms.uNear.value.x = k ? NEARS : NEAR; }); lastX = 1e9; };

    /* ── where each grows: the place's shore, how far in from the water's edge, how high ── */
    const camp = Layout.camp, keepOut = [[camp.x, camp.z, 26]].concat(Layout.palms.map(p => [p[0], p[1], 4]), Layout.trees.map(t => [t[0], t[1], t[2] + 2.5]), (Layout.fruit || []).map(f => [f.x, f.z, 5]), o.keep || []);
    /* (the places kept clear, in a grid of 16 m buckets: there may be thousands of them along the trails) */
    const KG = 16, kgrid = new Map();
    for (const c of keepOut) { const [cx, cz, r] = c; for (let gz = Math.floor((cz - r) / KG); gz <= Math.floor((cz + r) / KG); gz++) for (let gx = Math.floor((cx - r) / KG); gx <= Math.floor((cx + r) / KG); gx++) { const k = gx * 65536 + gz; let L = kgrid.get(k); if (!L) kgrid.set(k, (L = [])); L.push(c); } }
    const kept = o.kept || ((x, z) => { const L = kgrid.get(Math.floor(x / KG) * 65536 + Math.floor(z / KG)); if (L) for (const [cx, cz, r] of L) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; return Math.abs(x - camp.x) < 22 && z < camp.z + 20; });
    function odds(G, x, z, out) {
      const s = I.sdf(x, z); if (s > 9) return 0;
      const q = I.shore(I.uAt(x, z), SQ), d = -s, W = q.W, dF = d + SH;
      /* (o.sandEdge: nothing grows out on the beach's sand, short of that far in from its top; only the palms lean out over
         it from just above) */
      if (o.sandEdge !== undefined && d < W + o.sandEdge - (G.id === 1 ? 1.4 : 0)) return 0;
      /* (the forest proper: from a little way behind the beach's top, closed within twenty metres of it; nearer, shifted) */
      const rockK = (q.rock + q.cliff) * (1 - sm(W + 4, W + 18, d)), forest = Math.max(sm(W + 6, W + 22, dF) * q.sand, sm(W + 6, W + 20, d) * (q.rock + q.cliff), sm(16, 44, d) * q.mangrove) * (1 - rockK);
      const notMang = 1 - sm(0.25, 0.55, q.mangrove);
      if (G.id === 1) return q.sand * notMang * (0.85 * bump(d, W - 5, W - 1.5, W + 7, W + 16) + 0.12 * bump(d, W, W + 6, W + 38, W + 60));
      if (G.id === 2) {
        const front = q.sand * bump(d, W - 2, W + 1, W + 12, W + 22), back = q.sand * bump(d, W + 3, W + 10, W + 42, W + 64), rocks = (q.rock + q.cliff) * bump(d, W - 0.5, W + 2, W + 12, W + 22);
        out.w = [back * 0.55, back * 0.4 + front * 0.25, front * 0.6 + rocks * 0.25, front * 0.25 + rocks * 0.6];
        return notMang * Math.min(1, front + back + rocks) * 0.75;
      }
      if (G.id === 3) { const patch = sm(0.6, 0.74, vn2(x / 170, z / 170, 7)); return q.sand * notMang * patch * bump(d, W - 3, W + 1, W + 30, W + 46) * 0.8; }
      if (G.id === 4) return forest * 0.95;
      if (G.id === 5) { const deep = sm(W + 40, W + 90, dF) * forest; out.w = [0.62, 0.22, 0.16]; return deep * 0.5; }
      if (G.id === 10) return sm(W + 12, W + 30, dF) * forest * 0.85;
      if (G.id === 7) { const edge = 1 - sm(W + 30, W + 80, dF); out.w = [0.5, 0.2, 0.12 + 0.12 * (1 - edge), 0.18]; return Math.max(forest, sm(W + 4, W + 14, dF) * q.sand * edge) * (0.72 + 0.26 * edge); }
      if (G.id === 11) return sm(W + 10, W + 26, dF) * forest * 0.62;
      if (G.id === 8) { const wall = q.sand * notMang * bump(d, W - 2.5, W + 0.5, W + 12, W + 20) + (q.rock + q.cliff) * bump(d, W + 1, W + 4, W + 14, W + 24) * 0.7; out.w = [0.5, 0.2, 0.12, 0.18]; return Math.min(1, wall) * 0.85; }
      if (G.id === 9) { out.w = [0.4, 0.15, 0.3, 0.06, 0.03, 0.06]; return Math.max(forest, q.sand * bump(dF, W + 1, W + 6, W + 40, W + 60)) * 0.86; }
      return 0;
    }
    /* a grid's candidate in cell (gx, gz), if it has one: [x, z, its draw, odds] */
    const W4 = { w: null };
    function cand(G, gx, gz, out) {
      const hx = hxOf(G, gx), x = (gx + 0.1 + 0.8 * hash3(hx, gz, G.id * 16 + 1)) * G.g, z = (gz + 0.1 + 0.8 * hash3(hx, gz, G.id * 16 + 2)) * G.g;
      const p = odds(G, x, z, W4); if (p <= 0 || hash3(hx, gz, G.id * 16 + 3) >= p) return null;
      out[0] = x; out[1] = z; out[2] = hash3(hx, gz, G.id * 16 + 4); return out;
    }
    /* ── a tile's trees: every grid's over the tile, those that grow, each its kind and shape, turned and sized ── */
    const C0 = [0, 0, 0], C1 = [0, 0, 0];
    /* (the tree of grid G's cell (gx, gz), if one grows there: inside the box given, if one is) */
    function treeAt(G, gx, gz, box) {
      const c = cand(G, gx, gz, C0); if (!c) return null;
      const x = c[0], z = c[1], pr = c[2]; if ((box && (x < box[0] || x >= box[0] + box[2] || z < box[1] || z >= box[1] + box[2])) || kept(x, z, G)) return null;
      const hx = hxOf(G, gx);
      const w = W4.w && W4.w.slice();
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const n = cand(G, gx + i, gz + j, C1); if (n && n[2] > pr && (n[0] - x) ** 2 + (n[1] - z) ** 2 < G.g * G.g * 0.72) return null; }
      /* (which of its kinds: by the place's weights, or the one) */
      let kind = G.kinds[0];
      if (G.kinds.length > 1 && w) { let tot = w.reduce((a, b) => a + b, 0), r = hash3(hx, gz, G.id * 16 + 5) * tot; for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) { kind = G.kinds[k]; break; } } }
      const K = KINDS[kind], P = byKind[kind], p = P[Math.floor(hash3(hx, gz, G.id * 16 + 6) * P.length) % P.length];
      const S = G.s || K.s, s = S[0] + (S[1] - S[0]) * hash3(hx, gz, G.id * 16 + 7);
      return { x, y: land(x, z) - 0.15, z, s, yaw: hash3(hx, gz, G.id * 16 + 8) * TAU, p: p.i, tint: hash3(hx, gz, G.id * 16 + 9), die: hash3(hx, gz, G.id * 16 + 10), kind };
    }
    /* (only: the ids of the grids to draw from, when not all of them) */
    function* plan(tx, tz, TS, late, only) {
      const out = [], box = [tx, tz, TS];
      for (const G of GR) {
        if (G.ground || (only && !only.includes(G.id))) continue;
        for (let gz = Math.floor(tz / G.g); gz * G.g < tz + TS; gz++) {
          for (let gx = Math.floor(tx / G.g); gx * G.g < tx + TS; gx++) { const t = treeAt(G, gx, gz, box); if (t) out.push(t); }
          if (late()) yield;
        }
      }
      return out;
    }
    /* the trees of the given kinds standing within r of (x, z), as plan has them (nearest first), and how tall each is */
    function standing(x, z, r, kinds) {
      const out = [];
      for (const G of GR) {
        if (G.ground || !G.kinds.some(k => kinds.includes(k))) continue;
        for (let gz = Math.floor((z - r) / G.g); gz * G.g < z + r; gz++) for (let gx = Math.floor((x - r) / G.g); gx * G.g < x + r; gx++) {
          const t = treeAt(G, gx, gz, null); if (!t || !kinds.includes(t.kind)) continue;
          const d = Math.hypot(t.x - x, t.z - z); if (d < r) out.push(Object.assign(t, { d, H: protos[t.p].H * t.s }));
        }
      }
      return out.sort((a, b) => a.d - b.d);
    }
    /* a tile's cards: those of each atlas together (added to the forest's group; or, loose, to be drawn wherever and as
       often as whoever asked for them wants: [the trees' cards, the small plants'], either null if there are none) */
    function cardSets(list) {
      return atlases.map((a, k) => { if (!a) return null; const L = list.filter(t => protos[t.p].atlas === k).map(t => Object.assign({}, t, { p: protos[t.p].ai })); if (!L.length) return null;
        const m = Impostor.cards(L, mats[k]); m.matrixAutoUpdate = false; return m; });
    }
    function cards(list) { const out = cardSets(list).filter(Boolean); for (const m of out) group.add(m); return out; }

    /* ── near the eye: the trees themselves. Every few frames, the trees within reach, nearest first, as many of each
       shape as it has room for, drawn as many copies of that shape's parts ── */
    const capOf = p => KINDS[p.kind].cap || (KINDS[p.kind].ground ? 420 : KINDS[p.kind].small ? 240 : 150), near = protos.map(p => p.parts.map(pt => {
      const im = new T.InstancedMesh(pt.geo, pt.mat, capOf(p)); im.count = 0; im.frustumCulled = false; im.castShadow = pt.cast; im.receiveShadow = true; if (pt.depth) im.customDepthMaterial = pt.depth;
      /* (the leaves each tree's own green, as its card has it) */
      if (pt.leaf) im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(capOf(p) * 3).fill(1), 3);
      im.matrixAutoUpdate = false; group.add(im); return { im, M: pt.M, leaf: pt.leaf };
    }));
    const GROUND = 36, GF = GR.find(G => G.ground), floorMemo = new Map();
    function floorNear(cx, cz) {
      const out = [], G = GF;
      for (let gz = Math.floor((cz - GROUND) / G.g); gz * G.g < cz + GROUND; gz++) for (let gx = Math.floor((cx - GROUND) / G.g); gx * G.g < cx + GROUND; gx++) {
        const key = gx * 100003 + gz; let tr = floorMemo.get(key);
        if (tr === undefined) {
          tr = null; const c = cand(G, gx, gz, C0), hx = hxOf(G, gx);
          if (c && !kept(c[0], c[1], G)) { const w = W4.w.slice(); let r = hash3(hx, gz, 151) * w.reduce((a, b) => a + b, 0), kind = G.kinds[0]; for (let k = 0; k < w.length; k++) { r -= w[k]; if (r <= 0) { kind = G.kinds[k]; break; } }
            const K = KINDS[kind], P = byKind[kind], p = P[Math.floor(hash3(hx, gz, 152) * P.length) % P.length];
            tr = { x: c[0], y: land(c[0], c[1]) - 0.04, z: c[1], s: K.s[0] + (K.s[1] - K.s[0]) * hash3(hx, gz, 153), yaw: hash3(hx, gz, 154) * TAU, p: p.i }; }
          if (floorMemo.size > 9000) floorMemo.clear();
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
      const pick = protos.map(() => []), R2 = (NEAR + FADE) ** 2, RS2 = (NEARS + FADE) ** 2;
      for (const t of tiles) {
        if (!t.trees || Math.max(0, t.x - cx, cx - t.x - t.TS) ** 2 + Math.max(0, t.z - cz, cz - t.z - t.TS) ** 2 > R2) continue;
        for (const tr of t.trees) { const d2 = (tr.x - cx) ** 2 + (tr.y - cy) ** 2 * 0.3 + (tr.z - cz) ** 2; if (d2 < (protos[tr.p].atlas ? RS2 : R2)) pick[tr.p].push([d2, tr]); }
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
    /* ── what a walker (or the van) can't go through: the trees' trunks, their buttresses and stilt roots. Each kind's
       trunk at a scale of one, and for the big trees what the shape itself has low down (the buttresses' spread); the
       ferns, the gingers, the saplings and poles, the rattans, the sea hibiscus and the fan palms are walked through ── */
    /* (the young trees, the poles and the tree ferns are brushed past, as the ferns are: only a tree's trunk stops a walker) */
    const TRUNK = { canopy: 0.32, emergent: 0.6, tualang: 0.9, fig: 0.7, terminalia: 0.38, barringtonia: 0.32, casuarina: 0.2, coconut: 0.16, pandanus: 0.2 };
    const TRUNK_KINDS = Object.keys(TRUNK), BIG = ['canopy', 'emergent', 'tualang', 'fig', 'terminalia'];
    for (const p of protos) {
      if (!(p.kind in TRUNK)) continue;
      let r = TRUNK[p.kind];
      if (BIG.includes(p.kind)) {
        /* (the shape's own reach between a knee and a head's height off the ground, round its middle there) */
        const v = new T.Vector3(); let sx = 0, sz = 0, n = 0; const pts = [];
        for (const pt of p.parts) { const P = pt.geo.attributes.position; for (let i = 0; i < P.count; i += 3) { v.fromBufferAttribute(P, i).applyMatrix4(pt.M); if (v.y > 0.35 && v.y < 1.5) { pts.push(v.x, v.z); sx += v.x; sz += v.z; n++; } } }
        if (n > 20) { sx /= n; sz /= n; let m = 0; for (let k = 0; k < pts.length; k += 2) m = Math.max(m, Math.hypot(pts[k] - sx, pts[k + 1] - sz)); r = Math.max(r * 0.6, Math.min(r * 2.5, m * 0.8)); p.trunkC = [sx, sz]; }
      }
      p.trunkR = r;
    }
    const trunkMemo = new Map(), TC = 6;
    /* (the trunks standing within r of (x, z): [x, z, radius], worked out a few metres' cell at a time and kept) */
    function trunks(x, z, r = 4) {
      const gx = Math.floor(x / TC), gz = Math.floor(z / TC), key = gx * 65536 + gz;
      let L = trunkMemo.get(key);
      if (!L) {
        L = [];
        for (const t of standing((gx + 0.5) * TC, (gz + 0.5) * TC, TC * 0.75 + 6, TRUNK_KINDS)) { const P = protos[t.p], c = P.trunkC, cs = Math.cos(t.yaw), sn = Math.sin(t.yaw);
          /* (its trunk's middle where the shape has it, turned and sized as the tree is) */
          const ox = c ? (c[0] * cs + c[1] * sn) * t.s : 0, oz = c ? (-c[0] * sn + c[1] * cs) * t.s : 0;
          L.push([t.x + ox, t.z + oz, P.trunkR * t.s]); }
        if (trunkMemo.size > 600) trunkMemo.clear();
        trunkMemo.set(key, L);
      }
      return L;
    }
    const stats = () => ({ protos: protos.length, atlases: atlases.map(a => a && [a.W, a.H]), bakeMs: Math.round(bakeMs), growMs: Math.round(protos.reduce((a, p) => a + p.ms, 0)), near: near.reduce((n, P) => n + (P[0] ? P[0].im.count : 0), 0) });
    /* how closed the forest's canopy is over a point (for the shade on the ground under it) */
    /* (only a clearing opens the canopy over the ground: a path or a stream through the forest is still under it) */
    const clearings = keepOut.filter(c => c[2] > 4.6), inClearing = (x, z) => { for (const [cx, cz, r] of clearings) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; return Math.abs(x - camp.x) < 22 && z < camp.z + 20; };
    const cover = (x, z) => ((o.kept ? o.kept(x, z) : inClearing(x, z)) ? 0 : odds(GR[3], x, z, W4));
    return { plan, cards, cardSets, nearUpdate, mats, atlases, protos, stats, setNear, cover, standing, trunks, group, get NEAR() { return NEAR; }, get NEARS() { return NEARS; } };
  }
  return { build, KINDS, GRIDS };
})();
