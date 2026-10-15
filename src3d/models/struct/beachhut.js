/* ─────────────────────────────────────────────────────────────
   models/struct/beachhut.js — the island's beach huts, as the huts
   on Borneo's islands are built: up on timber stilts on stone pads,
   out of the sand and the damp; a floor of planks; walls of split
   bamboo woven in a twill, in frames of timber; a tall roof of nipa
   thatch, its courses laid one over the next down a steep pitch,
   their ends ragged at the eaves, a bundle of thatch bound along the
   ridge; a verandah under the roof's long front slope, a railing of
   bamboo round it and steps down to the sand.
   Things to use: the door swings open on its hinges, the shutters
   lift on theirs and are propped open, the lamps light, the hammock
   on the verandah can be lain in. Inside, a bed under a mosquito
   net, a mat, a low table; in the work hut (o.kind 'work') a desk,
   and the boards on its walls (o.boards: a canvas each).
   Its front toward +z, centred on x = 0; everything a walker needs
   to know of it in userData.info (its floor, its rooms, its walls,
   its door and its steps), and the things to use in userData.use.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t, mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  /* ── materials, drawn as the bark is (FloraKit.bark) ── */
  Object.assign(FloraKit.BARK, {
    /* nipa thatch (attap), from above: four courses to a tile, each course a row of the palm's leaflets folded over a
       stick and hung down the slope side by side, a finger or two wide, their tips ragged at its lower edge, the course
       below showing in shade under them; dry, tan to grey-brown, some silvered by the sun, darker toward the top of each
       course where the next one over it keeps the sun off. (v runs up the slope; t up a course from its edge) */
    thatch: { w: 512, h: 512, tile: [0.9, 0.6], seed: 307, depth: 0.014,
      hgt(u, v, K, o) {
        const nc = 4, cv = v * nc, c = Math.floor(cv), t = cv - c, ns = 56;
        const su = u * ns + c * 7.0 + (K.fbm(u * 3, v * 2 + c * 0.25, 3, 2, 2) - 0.5) * 0.9, si = Math.floor(su), sf = su - si, sid = ((si % ns) + ns) % ns;
        const r1 = K.vn(sid * 5.3 + c * 61.7, 0.5, 512, 512), r2 = K.vn(sid * 3.7 + 11.3, c * 13.1 + 0.5, 512, 512);
        const endJ = 0.02 + 0.16 * r1 * r1, prof = Math.pow(Math.sin(Math.PI * sf), 0.55), rib = (1 - sm(0.0, 0.07, Math.abs(sf - 0.5))) * (r2 > 0.45 ? 1 : 0);
        const fine = 0.04 * (K.vn(u * 400, v * 60, 400, 60) - 0.5);
        if (t < endJ) { o[0] = clamp(0.16 + 0.6 * t + fine); o[1] = r2; o[2] = 1; o[3] = patchesT(u, v, K); return; }
        o[0] = clamp(0.48 + 0.26 * prof + 0.12 * (1 - t) + 0.05 * rib + fine - 0.18 * (1 - sm(0.0, 0.1, Math.min(sf, 1 - sf))));
        o[1] = r2; o[2] = (1 - sm(0.0, 0.1, Math.min(sf, 1 - sf))) * 0.6; o[3] = patchesT(u, v, K);
      },
      col(u, v, P, K) {
        const nc = 4, cv = v * nc, t = cv - Math.floor(cv), id = P.m1;
        let col = mix3(mix3([0.25, 0.19, 0.115], [0.3, 0.245, 0.16], sm(0.2, 0.7, id)), [0.27, 0.255, 0.225], sm(0.65, 0.95, id));
        col = mix3(col, [0.17, 0.125, 0.075], sm(0.0, 0.25, id) * 0.6);
        /* (toward the top of a course, under the next: darker; its tips, out in the sun, paler and greyer) */
        col = col.map(q => q * (1 - 0.42 * sm(0.45, 1.0, t)));
        col = mix3(col, [0.3, 0.29, 0.27], P.m3 * 0.4 * (1 - t));
        col = mix3(col, [0.055, 0.04, 0.026], P.m2);
        const ao = Math.max(0.45, 1 - 4 * Math.max(0, P.cav)), ed = 1 + 0.5 * Math.max(0, P.cvx);
        return [col.map(q => q * ao * ed), 0.94];
      } },
    /* the thatch from beneath: the sticks the attap is folded over, a row of them across every course, and between them
       the leaflets' pale undersides, smoke-darkened */
    thatchUnder: { w: 256, h: 256, tile: [0.9, 0.6], seed: 311, depth: 0.01,
      hgt(u, v, K, o) {
        const cv = v * 4, t = cv - Math.floor(cv), stick = 1 - sm(0.0, 0.07, Math.abs(t - 0.5)), su = u * 56 + (K.fbm(u * 3, v * 2, 3, 2, 2) - 0.5) * 0.8, sf = su - Math.floor(su);
        o[0] = clamp(0.4 + 0.45 * stick + 0.12 * Math.sin(Math.PI * sf) * (1 - stick)); o[1] = stick; o[2] = K.vn(Math.floor(su) * 3.1, Math.floor(cv) * 7.7, 512, 512); o[3] = 0;
      },
      col(u, v, P, K) {
        let col = mix3([0.13, 0.1, 0.065], [0.19, 0.15, 0.1], P.m2); col = mix3(col, [0.1, 0.07, 0.04], P.m1);
        return [col.map(q => q * Math.max(0.5, 1 - 3 * Math.max(0, P.cav))), 0.95];
      } },
    /* split bamboo woven two over two under (sawali), the strips two fingers wide, the twill's diagonals showing in the
       light as the strips swell where they cross over and dip where they go under; each strip its own tone of straw and
       tan, some greyed, the odd one smoked brown — no pattern picked out in dark strips, as on the plain walls of a
       hut on the shore; dust and grime in the weave's gaps */
    weave: { w: 512, h: 512, tile: [0.48, 0.48], seed: 317, depth: 0.0055,
      hgt(u, v, K, o) {
        const n = 20, x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), fi = x - i, fj = y - j;
        const warpTop = ((i + j) % 4 + 4) % 4 < 2, a = warpTop ? fi : fj, along = warpTop ? fj : fi, k = warpTop ? i : j;
        /* (over two, under two: the strip on top rises over its crossing and falls at its ends, where it dives under) */
        const ph = warpTop ? ((i + j) % 4 + 4) % 4 + along : ((i + j + 2) % 4 + 4) % 4 + along, lift = 0.5 + 0.5 * Math.sin((ph / 2) * Math.PI);
        const prof = Math.pow(Math.sin(Math.PI * clamp(a * 1.08 - 0.04)), 0.5), edge = 1 - sm(0.0, 0.08, Math.min(a, 1 - a));
        o[0] = clamp(0.35 + 0.35 * prof * (0.55 + 0.45 * lift) + 0.03 * (K.vn(u * 300, v * 300, 300, 300) - 0.5) - 0.25 * edge);
        const id = K.vn(k * 7.7 + (warpTop ? 0 : 100), 0.5, 512, 512), id2 = K.vn(k * 3.1 + (warpTop ? 40 : 160), 7.5, 512, 512);
        o[1] = sm(0.8, 0.86, id2); o[2] = id; o[3] = edge;
      },
      col(u, v, P, K) {
        let col = mix3([0.31, 0.225, 0.105], [0.41, 0.31, 0.155], P.m2);
        col = mix3(col, [0.3, 0.27, 0.215], sm(0.66, 0.95, P.m2) * 0.4);
        col = mix3(col, [0.17, 0.11, 0.06], P.m1 * 0.6);
        /* (fine fibres along each strip, and the grime in the weave's gaps) */
        col = col.map(q => q * (0.9 + 0.2 * K.vn(u * 260, v * 40, 260, 40)));
        col = mix3(col, [0.05, 0.035, 0.02], P.m3 * 0.8);
        const ao = Math.max(0.5, 1 - 4 * Math.max(0, P.cav));
        return [col.map(q => q * ao), mix(0.6, 0.8, P.m1)];
      } },
    /* a bamboo pole's skin: straw-gold, glossy, finely streaked along it; a node every tile, its ring standing out a little
       and darker, a sheath scar under it; a few dark spots of mould */
    bamboo: { w: 128, h: 512, tile: [0.16, 0.42], seed: 331, depth: 0.0025,
      hgt(u, v, K, o) {
        const dn = Math.min(v, 1 - v), node = Math.exp(-(dn * dn) / 0.0006), scar = sm(0.035, 0.0, Math.abs(v - 0.04)) * 0.5;
        o[0] = clamp(0.6 + 0.3 * node - 0.15 * scar + 0.03 * (K.vn(u * 60, v * 4, 60, 4) - 0.5)); o[1] = node; o[2] = sm(0.78, 0.84, K.vn(u * 30, v * 12, 30, 12)); o[3] = K.fbm(u * 2, v * 2, 2, 2, 3);
      },
      col(u, v, P, K) {
        let col = mix3([0.33, 0.25, 0.1], [0.42, 0.33, 0.15], P.m3); col = col.map(q => q * (0.9 + 0.2 * K.vn(u * 80, v * 3, 80, 3)));
        col = mix3(col, [0.2, 0.14, 0.07], P.m1 * 0.7); col = mix3(col, [0.08, 0.07, 0.05], P.m2 * 0.6);
        return [col, mix(0.38, 0.6, P.m1)];
      } }
  });
  /* (the weathered patches on the thatch: silvered by the sun) */
  function patchesT(u, v, K) { return sm(0.58, 0.68, K.fbm(u * 3 + 2.1, v * 3 + 0.7, 3, 3, 4)); }

  /* ── pieces ── */
  /* a geometry from rows × cols of points (fn(i, j) → [x, y, z, u, v, r, g, b]), its normals from the grid, facing the way
     probe says (FloraKit) */
  const grid = (rows, cols, fn, probe) => { const g = FloraKit.gridGeo(rows, cols, false, fn); return probe ? FloraKit.faceOut(g, probe) : g; };
  /* a thatch roof's slope: from the ridge (yR at zR) down to the eave (yE at zE), x0 to x1 along the ridge; its top in
     courses (cs apart, each course's lower edge standing proud of the one below), its edge at the eave ragged with
     leaf tips hanging, its sides the same, its underside the sticks and leaves from beneath */
  function slope(B, x0, x1, yR, zR, yE, zE, o = {}) {
    const R = o.R || Math.random, dy = yE - yR, dz = zE - zR, Ls = Math.hypot(dy, dz), d = V(0, dy / Ls, dz / Ls);
    let n = V(1, 0, 0).cross(d).normalize(); if (n.y < 0) n.negate();
    const th = o.th ?? 0.2, lip = o.lip ?? 0.04, cs = o.cs ?? 0.15, tile = FloraKit.bark('thatch').tile, W = x1 - x0;
    const NC = Math.max(8, Math.round(W / 0.09)), NR = Math.max(12, Math.round(Ls / 0.028));
    /* (each course's edge wandering a little along the roof, and the whole slope a little wavy, as thatch lies) */
    const wav = x => 0.012 * Math.sin(x * 2.3 + o.seed) + 0.008 * Math.sin(x * 7.1 + 2 * o.seed);
    const off = (x, s) => {
      const q = (Ls - s) / cs + 0.12 * Math.sin(x * 9.3 + Math.floor((Ls - s) / cs) * 2.7) + 0.06 * Math.sin(x * 23 + 1.1), t = q - Math.floor(q);
      return th - lip + lip * (1 - t) * Math.sqrt(sm(0.0, 0.14, t)) + wav(x) + 0.01 * Math.sin(s * 3 + x * 1.7);
    };
    const at = (x, s, f) => V(x, yR, zR).addScaledVector(d, s).addScaledVector(n, f);
    /* the top */
    const top = grid(NR + 1, NC + 1, (i, j) => { const s = Ls * i / NR, x = x0 + W * j / NC, p = at(x, s, off(x, s)), k = 0.9 + 0.12 * Math.sin(x * 1.3 + s * 0.8 + o.seed);
      return [p.x, p.y, p.z, (x - x0) / tile[0], (Ls - s) / tile[1], k, k, k * 0.98]; }, (x, y, z, nx, ny) => ny);
    B.add('thatch', top);
    /* the underside, the leaves seen from below */
    const tu = FloraKit.bark('thatchUnder').tile;
    B.add('thatchUnder', grid(2, 2, (i, j) => { const s = Ls * i, x = x0 + W * j, p = at(x, s, 0); return [p.x, p.y, p.z, (x - x0) / tu[0], (Ls - s) / tu[1], 0.75, 0.75, 0.75]; }, (x, y, z, nx, ny) => -ny));
    /* the edges: the eave's, and each side's (the gable's verge), from the underside up to the top, the leaves' butts */
    const NE = 6;
    B.add('thatch', grid(NE + 1, NC + 1, (i, j) => { const x = x0 + W * j / NC, f = off(x, Ls) * i / NE, p = at(x, Ls + 0.004 * Math.sin(x * 31), f); return [p.x, p.y, p.z, (x - x0) / tile[0], 0.01 + 0.035 * i / NE, 0.55, 0.52, 0.48]; }, (x, y, z, nx, ny, nz) => nx * 0 + (nz * d.z + ny * d.y)));
    for (const [xs, sg] of [[x0, -1], [x1, 1]]) B.add('thatch', grid(NR + 1, NE + 1, (i, j) => { const s = Ls * i / NR, f = off(xs, s) * j / NE, p = at(xs, s, f); return [p.x, p.y, p.z, 0.3 + 0.04 * j / NE, (Ls - s) / tile[1], 0.6, 0.57, 0.52]; }, (x, y, z, nx) => nx * sg));
    /* the leaf tips hanging from the eave and the verges: thin pointed blades, both faces, ragged lengths */
    const tips = [], tipAt = (p, out, down, w, L) => {
      const s = V().crossVectors(out, V(0, 1, 0)).normalize(), a = p.clone().addScaledVector(s, -w / 2), b = p.clone().addScaledVector(s, w / 2), c = p.clone().addScaledVector(down, L).addScaledVector(out, L * 0.25);
      for (const [q0, q1] of [[a, b], [b, a]]) { const g = new T.BufferGeometry(), N = V().subVectors(q1, q0).cross(V().subVectors(c, q0)).normalize();
        g.setAttribute('position', new T.Float32BufferAttribute([q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, c.x, c.y, c.z], 3)); g.setAttribute('normal', new T.Float32BufferAttribute([N.x, N.y, N.z, N.x, N.y, N.z, N.x, N.y, N.z], 3));
        g.setAttribute('uv', new T.Float32BufferAttribute([0.1, 0.02, 0.12, 0.02, 0.11, 0.0], 2)); const k = 0.75 + 0.3 * R(); g.setAttribute('color', new T.Float32BufferAttribute([k, k, k, k, k, k, k * 1.1, k * 1.05, k], 3)); g.setIndex([0, 1, 2]); tips.push(g); }
    };
    const down = V(0, -1, 0).addScaledVector(d, 0.6).normalize();
    for (let x = x0 + 0.01; x < x1; x += 0.016 + 0.01 * R()) { const f = off(x, Ls) * (0.15 + 0.7 * R()); tipAt(at(x, Ls, f), V(0, 0, Math.sign(dz)), down, 0.012 + 0.012 * R(), 0.05 + 0.13 * R() * R()); }
    for (const [xs, sg] of [[x0, -1], [x1, 1]]) for (let s = 0.05; s < Ls; s += 0.03 + 0.03 * R()) { const f = off(xs, s) * (0.2 + 0.6 * R()); tipAt(at(xs, s, f), V(sg, 0, 0), V(sg * 0.3, -1, 0).normalize(), 0.012 + 0.01 * R(), 0.03 + 0.07 * R() * R()); }
    B.add('thatch', FloraKit.mergeParts(tips));
    return { d, n, Ls, at, off };
  }
  /* a board between two points, its face looking along up (StructKit.boardAB), toned a little each */
  function boardsOf(B, R) {
    const tone = k => { const q = (k ?? 0.85) + 0.25 * R(); return [q, q, q * (0.97 + 0.05 * R())]; };
    return (kind, a, b, th, w, o = {}) => StructKit.boardAB(B, kind, a, b, th, w, Object.assign({ tone: tone(o.k), u0: R() * 4, v0: R() * 4 }, o));
  }
  /* a pole (bamboo or a round post) from a to b, radius r */
  function pole(B, kind, a, b, r, R, o = {}) {
    const L = a.distanceTo(b), g = StructKit.pile(r, 0, L, { kind, seed: Math.floor(R() * 999), radial: o.radial || 10, dy: o.dy || 0.3, u0: R() * 3, v0: R() * 3, col: o.col });
    const q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), V().subVectors(b, a).normalize()), m = new T.Matrix4().compose(a, q, V(1, 1, 1));
    return B.add(kind, g, m);
  }

  /* ── the hut ── */
  Models.add('struct/beachhut', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 131 + 7), K = StructKit, work = o.kind === 'work', g = new T.Group(), B = K.Builder(), bd = boardsOf(B, R);
    /* (its size: the room x ±X, z ±Z; the verandah in front of it out to Z + VZ; the floor fy up) */
    const X = work ? 3.0 : 2.3, Z = work ? 2.2 : 1.8, VZ = work ? 2.2 : 2.0, fy = o.floor ?? 1.05, wh = 2.35, wy = fy + wh;
    const use = { doors: [], shutters: [], lamps: [], hammock: null, boards: [], seats: [] };
    /* ── stone pads and the posts: round timber, the room's running up to its wall plate, the verandah's to its beam ── */
    const xs = work ? [-X, -X / 3, X / 3, X] : [-X, 0, X], zs = [-Z, 0, Z], vxs = work ? [-X, -1.0, 1.0, X] : [-X, -0.75, 0.75, X];
    const posts = [];
    /* (a post in the middle of a front or back wall would stand in its door or its window: those stop under the floor, as
       the room's middle ones do) */
    for (const x of xs) for (const z of zs) posts.push([x, z, Math.abs(x) === X || (work && z !== 0) ? wy + 0.05 : fy - 0.17]);
    for (const x of vxs) posts.push([x, Z + VZ - 0.06, fy + 2.2]);
    for (const [x, z, top] of posts) {
      B.add('concrete', K.board(0.38, 0.3, 0.38, { kind: 'concrete', u0: R(), v0: R(), round: 0.03 }), K.M(x, 0.0, z, R() * 0.3));
      pole(B, 'hutPost', V(x, 0.12, z), V(x, top, z), 0.085 + 0.012 * R(), R, { radial: 12 });
    }
    /* (bracing between the stilts, under the floor) */
    for (const x of [xs[0], xs[xs.length - 1]]) bd('hutWood', V(x, 0.25, -Z), V(x, fy - 0.25, 0), 0.04, 0.1, { up: V(1, 0, 0) });
    for (const z of [-Z]) bd('hutWood', V(-X, 0.25, z), V(0, fy - 0.25, z), 0.04, 0.1, { up: V(0, 0, 1) });
    /* ── the floor: bearers along x on the posts, joists across them, the planks over all of it, room and verandah ── */
    for (const z of [-Z, 0, Z, Z + VZ - 0.06]) bd('hutWood', V(-X - 0.12, fy - 0.17, z), V(X + 0.12, fy - 0.17, z), 0.16, 0.12);
    for (let x = -X; x <= X + 1e-6; x += 0.46) bd('hutWood', V(x, fy - 0.06, -Z - 0.06), V(x, fy - 0.06, Z + VZ), 0.1, 0.05);
    for (let z = -Z - 0.04; z < Z + VZ - 0.02; z += 0.152) bd(R() < 0.18 ? 'hutWoodDark' : 'hutWood', V(-X - 0.08, fy - 0.0125, z + 0.07), V(X + 0.08, fy - 0.0125, z + 0.07), 0.025, 0.142, { k: 0.8 });
    /* (the floor's edge, a fascia round it) */
    bd('hutWood', V(-X - 0.1, fy - 0.09, Z + VZ + 0.02), V(X + 0.1, fy - 0.09, Z + VZ + 0.02), 0.16, 0.03, { up: V(0, 0, 1) });
    for (const sx of [-1, 1]) bd('hutWood', V(sx * (X + 0.1), fy - 0.09, -Z - 0.08), V(sx * (X + 0.1), fy - 0.09, Z + VZ + 0.02), 0.16, 0.03, { up: V(1, 0, 0) });

    /* ── the walls: a frame of timber (a sill, the posts, a rail at the windows' sills, the wall plate), and in each bay a
       woven panel; the openings framed, the door's and the windows' ── */
    const winY0 = fy + 0.95, winY1 = fy + 1.8, doorW = work ? 1.0 : 0.86, doorH = 2.0;
    /* each wall from its left end to its right end seen from outside, its outward normal, and its openings (s from its middle) */
    const walls = [
      { p0: V(-X, 0, Z), p1: V(X, 0, Z), n: V(0, 0, 1), ops: [{ a: -doorW / 2, b: doorW / 2, door: true }].concat(work ? [{ a: -2.3, b: -1.2 }, { a: 1.2, b: 2.3 }] : [{ a: -1.75, b: -0.95 }, { a: 0.95, b: 1.75 }]) },
      { p0: V(X, 0, -Z), p1: V(-X, 0, -Z), n: V(0, 0, -1), ops: work ? [] : [{ a: -0.45, b: 0.45 }] },
      { p0: V(-X, 0, -Z), p1: V(-X, 0, Z), n: V(-1, 0, 0), ops: [{ a: -0.5, b: 0.5 }] },
      { p0: V(X, 0, Z), p1: V(X, 0, -Z), n: V(1, 0, 0), ops: [{ a: -0.5, b: 0.5 }] }
    ];
    const weaveT = FloraKit.bark('weave').tile;
    for (const w of walls) {
      const dir = V().subVectors(w.p1, w.p0), Lw = dir.length(); dir.normalize();
      const at = (s, y, out = 0) => w.p0.clone().addScaledVector(dir, s + Lw / 2).add(V(0, y, 0)).addScaledVector(w.n, out);
      /* (the frame: sill, wall plate, the rail at the windows' sills and over them) */
      const doorO = w.ops.find(q => q.door);
      if (doorO) { bd('hutWood', at(-Lw / 2, fy + 0.05, 0), at(doorO.a - 0.04, fy + 0.05, 0), 0.1, 0.09, { up: w.n }); bd('hutWood', at(doorO.b + 0.04, fy + 0.05, 0), at(Lw / 2, fy + 0.05, 0), 0.1, 0.09, { up: w.n }); }
      else bd('hutWood', at(-Lw / 2, fy + 0.05, 0), at(Lw / 2, fy + 0.05, 0), 0.1, 0.09, { up: w.n });
      bd('hutWood', at(-Lw / 2 - 0.08, wy - 0.06, 0), at(Lw / 2 + 0.08, wy - 0.06, 0), 0.12, 0.12, { up: w.n });
      /* (the woven panels: in the spans between the openings, from the sill to the plate, set a little inside the frame) */
      const rows = [[fy + 0.1, winY0], [winY0, winY1], [winY1, wy - 0.12]];
      for (const [y0, y1] of rows) {
        let spans = [[-Lw / 2 + 0.04, Lw / 2 - 0.04]];
        for (const q of w.ops) { const qy0 = q.door ? fy : winY0, qy1 = q.door ? fy + doorH : winY1; if (y1 > qy0 + 0.01 && y0 < qy1 - 0.01) spans = spans.flatMap(([a, b]) => (q.b <= a || q.a >= b ? [[a, b]] : [[a, q.a - 0.03], [q.b + 0.03, b]].filter(([u, v]) => v - u > 0.04))); }
        /* (over the door, the panel from its head up) */
        for (const [a, b] of spans) {
          let ya = y0, yb = y1; if (doorO && a < doorO.b && b > doorO.a) ya = Math.max(ya, fy + doorH + 0.08);
          if (yb - ya < 0.03) continue;
          const c = at((a + b) / 2, (ya + yb) / 2, -0.005), wd = b - a, ht = yb - ya, m = new T.Matrix4().makeBasis(dir, V(0, 1, 0), w.n).setPosition(c);
          const gq = K.board(wd, 0.022, ht, { kind: 'weave', u0: ya / weaveT[0], v0: (a + Lw / 2) / weaveT[1], tone: [1, 1, 1], round: 0.004 });
          /* (a board's length is along x, its thickness y, its width z: turned so its width is the wall's height and its
             thickness the wall's) */
          gq.applyMatrix4(new T.Matrix4().makeRotationX(Math.PI / 2)); B.add('weave', gq, m);
        }
      }
      /* (the openings: posts either side, a head over, a sill under the windows) */
      for (const q of w.ops) {
        const y0 = q.door ? fy : winY0, y1 = q.door ? fy + doorH : winY1;
        for (const s of [q.a - 0.05, q.b + 0.05]) bd('hutWood', at(s, y0, 0.0), at(s, y1 + 0.12, 0.0), 0.1, 0.09, { up: w.n });
        bd('hutWood', at(q.a - 0.12, y1 + 0.05, 0.005), at(q.b + 0.12, y1 + 0.05, 0.005), 0.1, 0.12, { up: w.n });
        if (!q.door) bd('hutWood', at(q.a - 0.14, y0 - 0.04, 0.03), at(q.b + 0.14, y0 - 0.04, 0.03), 0.05, 0.16, { up: V(0, 1, 0) });
        if (!q.door) {
          /* a shutter: a frame of battens with a woven panel in it, hung from the head on its top edge; propped open */
          const sw = q.b - q.a + 0.06, sh = y1 - y0 + 0.06, piv = new T.Group(); piv.position.copy(at((q.a + q.b) / 2, y1 + 0.03, 0.07)); piv.lookAt(piv.position.clone().add(w.n)); g.add(piv);
          const SB = K.Builder(), sbd = boardsOf(SB, R);
          /* (in the pivot's frame: x across, y up, z out from the wall; the shutter hangs down from its top edge) */
          for (const x of [-sw / 2 + 0.025, sw / 2 - 0.025]) sbd('hutWood', V(-x, 0, 0.0), V(-x, -sh, 0.0), 0.03, 0.05, { up: V(0, 0, 1) });
          for (const y of [-0.025, -sh / 2, -sh + 0.025]) sbd('hutWood', V(-sw / 2, y, 0.0), V(sw / 2, y, 0.0), 0.03, 0.05, { up: V(0, 0, 1) });
          { const gq = K.board(sw - 0.06, 0.012, sh - 0.06, { kind: 'weave', u0: R() * 3, v0: R() * 3, tone: [0.92, 0.92, 0.9], round: 0.003 }); gq.applyMatrix4(new T.Matrix4().makeRotationX(Math.PI / 2)); gq.translate(0, -sh / 2, -0.012); SB.add('weave', gq); }
          const sh0 = new T.Group(); SB.build(sh0); piv.add(sh0);
          /* (and its prop: a stick from the sill out to the shutter's lower edge, shown when it is open) */
          const prop = new T.Mesh(new T.CylinderGeometry(0.012, 0.014, 1, 6), K.mat('bamboo')); prop.castShadow = true; g.add(prop);
          use.shutters.push({ pivot: piv, prop, sill: at((q.a + q.b) / 2, y0 + 0.02, 0.1), h: sh, open: R() < 0.6 ? 1 : 0, max: 1.15 });
        }
      }
    }
    /* ── the door: planks on two ledges and a brace, a wooden latch; on its hinges at its left ── */
    { const piv = new T.Group(); piv.position.set(-doorW / 2 + 0.01, fy + 0.005, Z + 0.035); g.add(piv);
      const DB = K.Builder(), dbd = boardsOf(DB, R), n = work ? 7 : 6, pw = doorW / n;
      for (let k = 0; k < n; k++) dbd('hutWoodDark', V(pw * (k + 0.5), 0.01, 0), V(pw * (k + 0.5), doorH - 0.02, 0), 0.028, pw - 0.004, { up: V(0, 0, 1), k: 0.9 });
      for (const y of [0.25, doorH - 0.3]) dbd('hutWood', V(0.04, y, -0.03), V(doorW - 0.04, y, -0.03), 0.03, 0.12, { up: V(0, 0, 1) });
      dbd('hutWood', V(0.08, 0.32, -0.032), V(doorW - 0.08, doorH - 0.37, -0.032), 0.028, 0.11, { up: V(0, 0, 1) });
      const leaf = new T.Group(); DB.build(leaf); piv.add(leaf);
      const latch = new T.Mesh(new T.BoxGeometry(0.03, 0.16, 0.04), K.mat('hutWoodDark')); latch.position.set(doorW - 0.1, 1.0, 0.035); latch.castShadow = true; piv.add(latch);
      use.doors.push({ pivot: piv, w: doorW, open: 0, max: -1.75, hinge: [-doorW / 2, Z] });
    }
    /* ── the roof: the long front slope over the verandah and the back slope, the ridge between; rafters of bamboo under
       them, the ridge's bound bundle of thatch ── */
    /* (the ridge where the back slope comes down onto the back wall's plate and the front one onto the verandah's beam) */
    const pitch = Math.tan(0.62), eF = Z + VZ + 0.55, eB = -Z - 0.6, yBeam = fy + 2.28, zR = (VZ - 0.06 - 0.04 / pitch) / 2, yR = yBeam + (Z + VZ - 0.06 - zR) * pitch + 0.08, gov = 0.55;
    const yAt = z => yR - Math.abs(z - zR) * pitch;
    slope(B, -X - gov, X + gov, yR, zR, yAt(eF), eF, { R, seed: R() * 9, th: 0.2 });
    slope(B, -X - gov, X + gov, yR, zR, yAt(eB), eB, { R, seed: R() * 9, th: 0.2 });
    /* (the ridge: a bundle of thatch bound along it, the binding every half metre) */
    { const r = 0.17, L = 2 * (X + gov) + 0.1, c = new T.LineCurve3(V(-L / 2, yR + 0.13, zR), V(L / 2, yR + 0.13, zR));
      const tb = FloraKit.tube(c, () => r, { segs: Math.round(L / 0.15), radial: 14, tile: FloraKit.bark('thatch').tile, sq: [1, 0.62] });
      B.add('thatch', tb);
      for (let x = -L / 2 + 0.2; x < L / 2 - 0.1; x += 0.48) {
        const ring = new T.CatmullRomCurve3(Array.from({ length: 20 }, (_, q) => { const a = q / 20 * TAU; return V(x, yR + 0.13 + Math.sin(a) * r * 0.66, zR + Math.cos(a) * r * 1.02); }), true);
        B.add('bamboo', FloraKit.tube(ring, () => 0.012, { segs: 20, radial: 5, tile: FloraKit.bark('bamboo').tile })); } }
    /* (the rafters, bamboo, from the ridge beam down to the eaves; the ridge beam and the verandah's beam) */
    for (let x = -X - gov + 0.15; x <= X + gov - 0.1; x += 0.62) for (const ze of [eF, eB]) { const dzr = ze - zR, k = (Math.abs(dzr) - 0.05) / Math.abs(dzr); pole(B, 'bamboo', V(x, yR - 0.05, zR), V(x, yR - 0.05 + (yAt(ze) - yR) * k, zR + dzr * k), 0.035, R, { radial: 8, dy: 0.42 }); }
    pole(B, 'hutPost', V(-X - gov + 0.1, yR - 0.12, zR), V(X + gov - 0.1, yR - 0.12, zR), 0.08, R, { radial: 10 });
    bd('hutWood', V(-X - 0.15, yBeam - 0.06, Z + VZ - 0.06), V(X + 0.15, yBeam - 0.06, Z + VZ - 0.06), 0.16, 0.12);
    /* (the gables: woven triangles from the wall plates up under the roof, at each end) */
    for (const sx of [-1, 1]) {
      const pts = [], zb = -Z, zf = Z, ytop = z => yAt(z) - 0.12;
      const geo = grid(2, 13, (i, j) => { const z = mix(zb, zf, j / 12), y = i ? Math.max(wy, ytop(z)) : wy - 0.02; return [sx * (X + 0.01), y, z, z / weaveT[0], y / weaveT[1], 0.85, 0.85, 0.83]; }, (x, y, z, nx) => nx * sx);
      B.add('weave', geo); void pts;
      bd('hutWood', V(sx * (X + 0.05), wy, zR), V(sx * (X + 0.05), yR - 0.12, zR), 0.08, 0.08, { up: V(sx, 0, 0) });
    }
    /* (over the front wall, between its plate and the roof, woven too: a rail at the roof's foot) */
    { const ya = wy - 0.08, yb = yAt(Z) - 0.12; if (yb > ya + 0.1) {
        const gq = K.board(2 * X - 0.06, 0.022, yb - ya, { kind: 'weave', u0: R() * 3, v0: R() * 3, tone: [0.95, 0.95, 0.93], round: 0.004 }); gq.applyMatrix4(new T.Matrix4().makeRotationX(Math.PI / 2));
        B.add('weave', gq, new T.Matrix4().makeTranslation(0, (ya + yb) / 2, Z - 0.005)); bd('hutWood', V(-X - 0.05, yb + 0.04, Z), V(X + 0.05, yb + 0.04, Z), 0.08, 0.1, { up: V(0, 0, 1) }); } }
    /* ── the verandah's railing: posts, a rail, bamboo balusters; open at the steps ── */
    const stepW = 1.15, rail = (a, b) => { bd('hutWood', a.clone().setY(fy + 0.9), b.clone().setY(fy + 0.9), 0.05, 0.14, { k: 0.8 });
      const L2 = a.distanceTo(b), n = Math.max(1, Math.round(L2 / 0.13)); for (let k = 1; k < n; k++) { const p = a.clone().lerp(b, k / n); pole(B, 'bamboo', p.clone().setY(fy + 0.03), p.clone().setY(fy + 0.87), 0.02, R, { radial: 7, dy: 0.42 }); } };
    rail(V(-X, 0, Z + VZ - 0.06), V(-stepW / 2, 0, Z + VZ - 0.06)); rail(V(stepW / 2, 0, Z + VZ - 0.06), V(X, 0, Z + VZ - 0.06));
    rail(V(-X, 0, Z + 0.06), V(-X, 0, Z + VZ - 0.06)); rail(V(X, 0, Z + 0.06), V(X, 0, Z + VZ - 0.06));
    /* ── the steps, down to the sand in front, their handrails of bamboo ── */
    const nSt = 5, rise = fy / nSt, run = 0.27, z0 = Z + VZ;
    for (const sx of [-1, 1]) bd('hutWood', V(sx * (stepW / 2 - 0.03), fy - 0.05, z0 - 0.02), V(sx * (stepW / 2 - 0.03), -0.02, z0 + run * nSt), 0.26, 0.05, { up: V(0, 1, 0) });
    for (let k = 1; k < nSt; k++) { const y = fy - k * rise, z = z0 + (k - 0.5) * run; bd(R() < 0.2 ? 'hutWoodDark' : 'hutWood', V(-stepW / 2, y - 0.02, z), V(stepW / 2, y - 0.02, z), 0.04, run + 0.03); }
    for (const sx of [-1, 1]) { pole(B, 'bamboo', V(sx * (stepW / 2 + 0.03), 1.0, z0 + run * nSt), V(sx * (stepW / 2 + 0.03), fy + 0.92, z0 - 0.05), 0.024, R, { radial: 8 }); pole(B, 'hutPost', V(sx * (stepW / 2 + 0.03), -0.1, z0 + run * nSt), V(sx * (stepW / 2 + 0.03), 1.05, z0 + run * nSt), 0.05, R); }
    B.add('concrete', K.board(stepW + 0.25, 0.1, 0.45, { kind: 'concrete', round: 0.03 }), K.M(0, 0.0, z0 + run * nSt + 0.12));
    /* ── inside ── */
    const cloth = (hex, k = 1) => Mats.lit({ color: new T.Color(hex).multiplyScalar(k), roughness: 0.92 });
    if (!work) {
      /* a bed against the back wall: a low frame of timber, a kapok mattress, a pillow, a folded sarong, a mosquito net over
         it from a ring under the ridge */
      bd('hutWood', V(-X + 0.15, fy + 0.3, -Z + 0.8), V(-X + 2.1, fy + 0.3, -Z + 0.8), 0.06, 1.4);
      for (const [x, z] of [[-X + 0.2, -Z + 0.18], [-X + 2.05, -Z + 0.18], [-X + 0.2, -Z + 1.42], [-X + 2.05, -Z + 1.42]]) bd('hutWood', V(x, fy, z), V(x, fy + 0.27, z), 0.08, 0.08);
      const mat = new T.Mesh(new T.BoxGeometry(1.9, 0.13, 1.3, 6, 2, 4), cloth('#d9d2c2')); mat.position.set(-X + 1.12, fy + 0.4, -Z + 0.8); mat.castShadow = mat.receiveShadow = true; g.add(mat);
      const pil = new T.Mesh(new T.SphereGeometry(0.22, 12, 8), cloth('#e8e1d2')); pil.scale.set(1.2, 0.35, 0.65); pil.position.set(-X + 0.42, fy + 0.52, -Z + 0.8); pil.castShadow = true; g.add(pil);
      const sar = new T.Mesh(new T.BoxGeometry(0.55, 0.06, 1.2), cloth(R() < 0.5 ? '#8a3a2a' : '#2d4f6e')); sar.position.set(-X + 1.75, fy + 0.5, -Z + 0.8); sar.castShadow = true; g.add(sar);
      const net = new T.Mesh(new T.CylinderGeometry(0.18, 1.05, wh + 0.55, 18, 1, true), new T.MeshStandardMaterial({ color: '#f2f0ea', transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false, roughness: 1 }));
      net.scale.set(1.0, 1, 0.7); net.position.set(-X + 1.12, fy + 0.35 + (wh + 0.55) / 2, -Z + 0.8); g.add(net);
      /* a mat on the floor, a low table on it with a teapot and cups; a shelf with jars */
      const tikar = new T.Mesh(new T.BoxGeometry(1.6, 0.008, 1.1), Mats.lit({ map: FloraKit.bark('weave').map, normalMap: FloraKit.bark('weave').normalMap, color: new T.Color(0.95, 0.88, 0.75), roughness: 0.8 }));
      tikar.position.set(0.9, fy + 0.006, 0.35); tikar.receiveShadow = true; g.add(tikar);
      bd('hutWoodDark', V(0.55, fy + 0.32, 0.35), V(1.25, fy + 0.32, 0.35), 0.04, 0.55);
      for (const [x, z] of [[0.6, 0.12], [1.2, 0.12], [0.6, 0.58], [1.2, 0.58]]) bd('hutWoodDark', V(x, fy, z), V(x, fy + 0.3, z), 0.05, 0.05);
      const clay = Mats.lit({ color: new T.Color(0.32, 0.16, 0.08), roughness: 0.6 });
      const pot = new T.Mesh(new T.SphereGeometry(0.07, 14, 10), clay); pot.scale.y = 0.8; pot.position.set(0.82, fy + 0.4, 0.3); pot.castShadow = true; g.add(pot);
      for (const [x, z] of [[1.0, 0.45], [1.08, 0.3]]) { const cup = new T.Mesh(new T.CylinderGeometry(0.03, 0.025, 0.05, 12), clay); cup.position.set(x, fy + 0.37, z); g.add(cup); }
      bd('hutWood', V(X - 0.25, fy + 1.35, -Z + 0.4), V(X - 0.25, fy + 1.35, -Z + 1.4), 0.03, 0.3, { up: V(0, 1, 0) });
      for (let k = 0; k < 3; k++) { const j = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.17, 12), Mats.lit({ color: new T.Color(...[[0.4, 0.3, 0.2], [0.15, 0.25, 0.3], [0.5, 0.45, 0.35]][k]), roughness: 0.4 })); j.position.set(X - 0.25, fy + 1.45, -Z + 0.6 + k * 0.32); g.add(j); }
      use.seats.push({ kind: 'bed', at: [-X + 1.12, fy + 0.45, -Z + 0.8], face: [0, 0, 1] });
    } else {
      /* the work hut: a desk under the back window's place, a chair at it; the boards on the walls */
      bd('hutWoodDark', V(-1.0, fy + 0.74, -Z + 0.45), V(1.0, fy + 0.74, -Z + 0.45), 0.045, 0.7);
      for (const [x, z] of [[-0.93, -Z + 0.15], [0.93, -Z + 0.15], [-0.93, -Z + 0.75], [0.93, -Z + 0.75]]) bd('hutWoodDark', V(x, fy, z), V(x, fy + 0.72, z), 0.06, 0.06);
      /* (on it, an open notebook and a mug, a jar of pencils) */
      const paper = new T.Mesh(new T.BoxGeometry(0.42, 0.012, 0.3), Mats.lit({ color: new T.Color(0.85, 0.82, 0.74), roughness: 0.9 })); paper.position.set(-0.2, fy + 0.77, -Z + 0.5); paper.rotation.y = 0.12; g.add(paper);
      const mug = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.1, 14), Mats.lit({ color: new T.Color(0.12, 0.2, 0.3), roughness: 0.4 })); mug.position.set(0.35, fy + 0.81, -Z + 0.42); g.add(mug);
      { const CB = K.Builder(), cbd = boardsOf(CB, R), cx = 0.1, cz = -Z + 1.15;
        cbd('hutWood', V(cx - 0.22, fy + 0.45, cz), V(cx + 0.22, fy + 0.45, cz), 0.04, 0.44);
        for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) cbd('hutWood', V(cx + x, fy, cz + z), V(cx + x, fy + 0.44, cz + z), 0.04, 0.04);
        for (const x of [-0.19, 0.19]) cbd('hutWood', V(cx + x, fy + 0.44, cz + 0.2), V(cx + x, fy + 0.95, cz + 0.24), 0.04, 0.04);
        cbd('hutWood', V(cx - 0.21, fy + 0.85, cz + 0.23), V(cx + 0.21, fy + 0.85, cz + 0.23), 0.025, 0.14, { up: V(0, 0, 1) });
        CB.build(g); use.seats.push({ kind: 'chair', at: [cx, fy + 0.5, cz], face: [0, 0, -1] }); }
      /* (the boards: on the back wall either side of the desk, and on the side walls, each a frame round its picture) */
      const spots = [{ id: o.boards && o.boards[0] && o.boards[0].id, p: V(-1.85, fy + 1.45, -Z + 0.04), n: V(0, 0, 1) }, { id: o.boards && o.boards[1] && o.boards[1].id, p: V(1.85, fy + 1.45, -Z + 0.04), n: V(0, 0, 1) },
        { id: o.boards && o.boards[2] && o.boards[2].id, p: V(-X + 0.04, fy + 1.45, -0.9), n: V(1, 0, 0) }, { id: o.boards && o.boards[3] && o.boards[3].id, p: V(X - 0.04, fy + 1.45, -0.9), n: V(-1, 0, 0) }];
      (o.boards || []).forEach((bdd, k) => {
        const sp = spots[k]; if (!sp) return;
        const w = 1.05, h = 0.78, grp = new T.Group(); grp.position.copy(sp.p); grp.lookAt(sp.p.clone().add(sp.n)); g.add(grp);
        const tex = Mats.tex(bdd.canvas, { aniso: 8 }); bdd.tex = tex;
        const face = new T.Mesh(new T.PlaneGeometry(w, h), Mats.lit({ map: tex, roughness: 0.85 })); face.position.z = 0.025; face.receiveShadow = true; grp.add(face);
        const FB = K.Builder(), fbd = boardsOf(FB, R);
        for (const [a, b] of [[V(-w / 2 - 0.04, h / 2 + 0.02, 0), V(w / 2 + 0.04, h / 2 + 0.02, 0)], [V(-w / 2 - 0.04, -h / 2 - 0.02, 0), V(w / 2 + 0.04, -h / 2 - 0.02, 0)], [V(-w / 2 - 0.02, -h / 2 - 0.04, 0), V(-w / 2 - 0.02, h / 2 + 0.04, 0)], [V(w / 2 + 0.02, -h / 2 - 0.04, 0), V(w / 2 + 0.02, h / 2 + 0.04, 0)]])
          fbd('hutWoodDark', a, b, 0.05, 0.05, { up: V(0, 0, 1) });
        FB.build(grp); use.boards.push({ id: bdd.id, mesh: face, group: grp, w, h });
      });
    }
    /* ── the lamps: a hurricane lantern hung inside from the ridge beam, one on the verandah from its beam by the door ── */
    const lamp = (p, hang) => {
      const lg = new T.Group(); lg.position.copy(p); g.add(lg);
      const metal = Mats.lit({ color: new T.Color(0.12, 0.13, 0.12), metalness: 0.6, roughness: 0.45 }), brass = Mats.lit({ color: new T.Color(0.45, 0.33, 0.14), metalness: 0.85, roughness: 0.35 });
      const tank = new T.Mesh(new T.CylinderGeometry(0.075, 0.085, 0.07, 18), metal); tank.position.y = -0.3; lg.add(tank);
      const glow = new T.MeshBasicMaterial({ color: new T.Color(1.0, 0.62, 0.28), transparent: true, opacity: 0.0, depthWrite: false });
      const globe = new T.Mesh(new T.SphereGeometry(0.075, 18, 12), Mats.lit({ color: new T.Color(0.9, 0.92, 0.9), transparent: true, opacity: 0.25, roughness: 0.05 })); globe.scale.y = 1.35; globe.position.y = -0.17; lg.add(globe);
      const flame = new T.Mesh(new T.SphereGeometry(0.02, 10, 8), glow); flame.scale.y = 2.0; flame.position.y = -0.19; lg.add(flame);
      const halo = new T.Mesh(new T.SphereGeometry(0.07, 14, 10), glow.clone()); halo.scale.y = 1.3; halo.position.y = -0.17; lg.add(halo);
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU, w = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.22, 4), metal); w.position.set(Math.cos(a) * 0.088, -0.17, Math.sin(a) * 0.088); lg.add(w); }
      const cap = new T.Mesh(new T.ConeGeometry(0.075, 0.06, 18), metal); cap.position.y = -0.05; lg.add(cap);
      const handle = new T.Mesh(new T.TorusGeometry(0.07, 0.004, 4, 16, Math.PI), brass); handle.position.y = -0.02; lg.add(handle);
      const cord = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, hang, 4), metal); cord.position.y = hang / 2 + 0.05; lg.add(cord);
      lg.traverse(m => { if (m.isMesh && m !== globe && m.material !== glow) m.castShadow = true; });
      use.lamps.push({ group: lg, flame, halo, glow: [flame.material, halo.material], at: [p.x, p.y - 0.18, p.z], on: 0 });
    };
    lamp(V(0.3, Math.min(yR - 0.95, wy - 0.1), zR), yR - 0.2 - Math.min(yR - 0.95, wy - 0.1) - 0.05);
    lamp(V(doorW / 2 + 0.35, yBeam - 0.5, Z + VZ - 0.12), 0.35);
    /* ── the hammock on the verandah: from the far front post across to the wall beside the door, cloth in stripes ── */
    if (!work) {
      const A = V(X - 0.05, fy + 1.55, Z + VZ - 0.1), Bp = V(doorW / 2 + 0.25, fy + 1.6, Z + 0.06), L = A.distanceTo(Bp), sag = 0.95;
      const ax = V().subVectors(Bp, A).normalize(), side = V().crossVectors(ax, V(0, 1, 0)).normalize();
      const stripes = (() => { const c = Models.canvas(256, 64), a = c.getContext('2d'), cols = ['#b8452f', '#e2c27a', '#2f5e74', '#e9e1cf', '#7a2f2a'];
        for (let i = 0; i < 32; i++) { a.fillStyle = cols[(i * 7 + (i >> 2)) % cols.length]; a.fillRect(i * 8, 0, 8, 64); }
        for (let i = 0; i < 2600; i++) { a.fillStyle = `rgba(0,0,0,${0.04 * Math.random()})`; a.fillRect(Math.random() * 256, Math.random() * 64, 1, 2); }
        return Mats.tex(c); })();
      const ropeL = 0.42, a2 = A.clone().addScaledVector(ax, ropeL).add(V(0, -0.22, 0)), b2 = Bp.clone().addScaledVector(ax, -ropeL).add(V(0, -0.22, 0)), Lc = a2.distanceTo(b2);
      const geo = grid(13, 9, (i, j) => { const t = i / 12, c = (j / 8 - 0.5), p = a2.clone().lerp(b2, t), sg = Math.sin(Math.PI * t), wid = 0.45 + 0.45 * sg;
        p.y -= sag * 4 * t * (1 - t) * 0.62 + c * c * 0.35 * sg; p.addScaledVector(side, c * wid * 2 * 0.5); return [p.x, p.y, p.z, j / 8, t * Lc / 1.2, 1, 1, 1]; }, (x, y, z, nx, ny) => ny);
      const ham = new T.Mesh(geo, Mats.lit({ map: stripes, side: T.DoubleSide, roughness: 0.9 })); ham.castShadow = ham.receiveShadow = true; g.add(ham);
      const rope = Mats.lit({ color: new T.Color(0.42, 0.36, 0.26), roughness: 0.9 });
      for (const [p, q] of [[A, a2], [Bp, b2]]) for (const sgn of [-1, 0, 1]) { const e = q.clone().addScaledVector(side, sgn * 0.42), r = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, p.distanceTo(e), 4), rope); r.position.copy(p).lerp(e, 0.5); r.quaternion.setFromUnitVectors(V(0, 1, 0), V().subVectors(e, p).normalize()); g.add(r); }
      use.hammock = { mesh: ham, mid: a2.clone().lerp(b2, 0.5).add(V(0, -sag * 0.62 + 0.25, 0)), ax: [ax.x, ax.z] };
      /* (and a bench on the verandah, under the window on the other side of the door) */
      bd('hutWood', V(-X + 0.25, fy + 0.45, Z + 0.35), V(-doorW / 2 - 0.25, fy + 0.45, Z + 0.35), 0.05, 0.36);
      for (const x of [-X + 0.35, -doorW / 2 - 0.35]) bd('hutWood', V(x, fy, Z + 0.35), V(x, fy + 0.43, Z + 0.35), 0.06, 0.3);
      use.seats.push({ kind: 'bench', at: [(-X - doorW / 2) / 2, fy + 0.5, Z + 0.35], face: [0, 0, 1] });
    } else {
      bd('hutWood', V(-X + 0.3, fy + 0.45, Z + 0.35), V(-doorW / 2 - 0.3, fy + 0.45, Z + 0.35), 0.05, 0.36);
      for (const x of [-X + 0.4, -doorW / 2 - 0.4]) bd('hutWood', V(x, fy, Z + 0.35), V(x, fy + 0.43, Z + 0.35), 0.06, 0.3);
      use.seats.push({ kind: 'bench', at: [(-X - doorW / 2) / 2, fy + 0.5, Z + 0.35], face: [0, 0, 1] });
    }
    B.build(g);
    /* what a walker needs: the floor's height; the room and the verandah (x0, x1, z0, z1); the walls as segments with
       their openings; the door's span; the steps' (x0, x1, from z0 at the floor out to z1 at the sand); the posts */
    g.userData.info = { floor: fy, room: [-X, X, -Z, Z], verandah: [-X, X, Z, Z + VZ], steps: [-stepW / 2, stepW / 2, Z + VZ, Z + VZ + run * nSt], door: [-doorW / 2, doorW / 2], X, Z, VZ, ridge: yR, eaves: [eB, eF],
      posts: posts.map(p => [p[0], p[1]]), walls: walls.map(w => ({ a: [w.p0.x, w.p0.z], b: [w.p1.x, w.p1.z], door: w.ops.some(q => q.door) ? [-doorW / 2, doorW / 2] : null })) };
    g.userData.use = use;
    return g;
  });
})();
