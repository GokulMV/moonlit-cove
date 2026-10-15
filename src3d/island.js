/* ─────────────────────────────────────────────────────────────
   island.js — the island: its shape, its shores, its ground.
   An island off the north-west coast of Borneo, of the kind that
   lie off Kota Kinabalu: about 2.4 km from its north end to its
   south and 1.4 km across, a forested ridge down its length rising
   to a summit of 260 m in the north and a second peak of 180 m in
   the south, a saddle between them where a track crosses from one
   side to the other. Its shores are rocky for the most part, a
   fringing reef off them; three beaches: the camp's bay on the east
   coast (its shore the camp's own, as it always was), a long beach
   on the west coast where the sun goes down, and a small cove in
   the south-east with the jetty and the ranger's hut. In the
   south-west a tidal creek winds a few hundred metres inland, its
   banks mangrove. Streams come down the main valleys.
   World axes as Layout's: y up, +x south, +z west; the camp at the
   origin, the sea in front of it to the east (-z).
   Built once (Island.build): the coastline (a closed line, a point
   every metre, each with how far along the coast it is (u), what
   kind of shore it is, how wide the beach behind it, how far the
   reef runs out from it, how open it is to the swell), and over a
   grid of the island and the sea round it (2.5 m cells) the signed
   distance to the shore (s, metres, + out to sea), the nearest
   shore point's u, and the ground's height (the sea floor below the
   water). Plain numbers, no three.js: the map tool runs it as is.
   ───────────────────────────────────────────────────────────── */
const Island = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  /* an integer hash of (where, which), as a fraction; value noise from it, in one and two dimensions */
  const hash = (i, k) => { let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((k | 0) + 0x3c6ef372, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  const hash2 = (i, j, k) => hash(Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663), k);
  const fade = f => f * f * f * (f * (f * 6 - 15) + 10);
  const vn1 = (x, k) => { const i = Math.floor(x), f = fade(x - i), a = hash(i, k); return a + (hash(i + 1, k) - a) * f; };
  function vn2(x, z, k) {
    const i = Math.floor(x), j = Math.floor(z), fx = fade(x - i), fz = fade(z - j);
    const a = hash2(i, j, k), b = hash2(i + 1, j, k), c = hash2(i, j + 1, k), d = hash2(i + 1, j + 1, k);
    return mix(mix(a, b, fx), mix(c, d, fx), fz);
  }
  const fbm2 = (x, z, k, o = 4) => { let a = 0, s = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { a += s * vn2(x * f, z * f, k + i * 17); n += s; s *= 0.5; f *= 2.07; } return a / n; };
  /* gradient noise (-1..1): smooth every way, none of value noise's square cells; and in octaves, each turned from the
     last so their grids never line up. (Each lattice point's gradient one of 256 directions round the circle, from a
     table: the island is built from millions of these) */
  const GR = new Float64Array(512);
  for (let q = 0; q < 256; q++) { GR[q * 2] = Math.cos(q / 256 * TAU); GR[q * 2 + 1] = Math.sin(q / 256 * TAU); }
  function pn2(x, z, k) {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fade(fx), v = fade(fz);
    const a = ((hash2(i, j, k) * 256) | 0) * 2, b = ((hash2(i + 1, j, k) * 256) | 0) * 2, c = ((hash2(i, j + 1, k) * 256) | 0) * 2, d = ((hash2(i + 1, j + 1, k) * 256) | 0) * 2;
    const da = GR[a] * fx + GR[a + 1] * fz, db = GR[b] * (fx - 1) + GR[b + 1] * fz, dc = GR[c] * fx + GR[c + 1] * (fz - 1), dd = GR[d] * (fx - 1) + GR[d + 1] * (fz - 1);
    return (da + (db - da) * u + (dc + (dd - dc) * u - da - (db - da) * u) * v) * 1.42;
  }
  function pfbm(x, z, k, o = 4) {
    let a = 0, amp = 0.5, n = 0, X = x, Z = z;
    for (let i = 0; i < o; i++) { a += amp * pn2(X, Z, k + i * 31); n += amp; amp *= 0.5; const X2 = (X * 0.8 - Z * 0.6) * 2.03, Z2 = (X * 0.6 + Z * 0.8) * 2.03; X = X2 + 5.3; Z = Z2 - 2.9; }
    return a / n;
  }
  const sn1 = (x, k) => vn1(x, k) * 2 - 1;

  /* ── the shape. The coast's line through its main points, going round the island south from the camp: each point the
     kind of shore that runs on from it — sand (a beach), rock (boulders and ledges, low cliffs, the reef off them),
     cliff (sheer, straight into deep water), mangrove (mud and roots). The camp's bay, between its two rocky points, is
     the camp's own shore (Layout's), blended into the island's line a few hundred metres either side ── */
  const KIND = { sand: 0, rock: 1, cliff: 2, mangrove: 3 };
  const CTRL = [
    [0, -8.6, 'sand'], [175, -6.5, 'sand'],
    /* the east coast south of the camp: a rocky bay, a point, then the jetty's cove behind the next point */
    [292, 30, 'rock'], [404, -14, 'rock'], [470, 34, 'rock'], [552, 118, 'sand'], [640, 168, 'sand'], [724, 150, 'rock'], [770, 92, 'rock'], [834, 118, 'rock'],
    /* the south end: cliffs under the second peak, a point off it */
    [900, 222, 'rock'], [972, 352, 'cliff'], [1050, 480, 'cliff'], [1076, 640, 'cliff'], [1022, 790, 'rock'],
    /* the south-west: mangroves round the creek's mouth (the creek is laid in between the next two, below) */
    [968, 918, 'mangrove'], ['creek'], [870, 1080, 'mangrove'], [780, 1172, 'rock'],
    /* the west coast: a rocky point, the long west beach round its bay, a point, cliffs */
    [652, 1282, 'rock'], [530, 1300, 'rock'], [400, 1350, 'rock'], [262, 1316, 'sand'], [96, 1262, 'sand'], [-110, 1246, 'sand'], [-300, 1268, 'sand'], [-414, 1318, 'rock'],
    [-470, 1380, 'rock'], [-600, 1352, 'rock'], [-700, 1302, 'rock'], [-800, 1262, 'cliff'], [-918, 1180, 'cliff'], [-1060, 1066, 'cliff'],
    /* the north end: a point to the north-west, a bay, the north tip, rocky round to the east */
    [-1184, 956, 'rock'], [-1248, 860, 'rock'], [-1270, 760, 'rock'], [-1372, 640, 'rock'], [-1366, 470, 'rock'], [-1280, 330, 'rock'], [-1196, 238, 'rock'],
    /* the east coast north of the camp: a rocky bay, a point, a smaller bay, to the camp's */
    [-1060, 160, 'rock'], [-940, 70, 'rock'], [-828, 98, 'rock'], [-700, 30, 'rock'], [-616, -30, 'rock'], [-500, 30, 'rock'], [-346, -2, 'rock'], [-175, -8, 'sand']
  ];
  /* the creek: its middle line from the mouth inland, and its half-width there (m) */
  const CREEK = [[926, 1002, 44], [872, 962, 26], [800, 920, 17], [720, 892, 12], [640, 874, 9], [566, 874, 6], [520, 884, 2.5]];
  /* the camp's bay: the shore and the forest's edge there as they always were (Layout's own, for the camp's surroundings to
     keep their places), and its two rocky points */
  const SH = { base: -8.6, a1: 1.5, f1: 0.0552233084, p1: 0.7, a2: 0.55, f2: 0.177941771, p2: 2.0, tl: -4.88923985, kt: 0.00613592315 };
  const VG = { base: 1.7, a1: 0.9, f1: 0.0920388473, p1: 1.3, a2: 0.45, f2: 0.227029157, tl: -2.93354391 };
  const zOld = x => SH.base + SH.a1 * Math.sin(x * SH.f1 + SH.p1) + SH.a2 * Math.sin(x * SH.f2 + SH.p2) + SH.tl * Math.sin(x * SH.kt);
  const vOld = x => VG.base + VG.a1 * Math.sin(x * VG.f1 + VG.p1) + VG.a2 * Math.sin(x * VG.f2) + VG.tl * Math.sin(x * SH.kt);
  const POINTS = [{ hx: -125, w: 16, d: 17 }, { hx: 132, w: 17, d: 19 }];
  const headFix = x => { let a = 0; for (const h of POINTS) { const u = (x - h.hx) / h.w; if (u > -6 && u < 6) a += h.d * Math.exp(-u * u); } return a; };
  const BAY = { r0: 175, r1: 460 };

  /* ── the line itself: a smooth closed curve through the points (centripetal Catmull-Rom), every metre along it; then
     its detail, in by how rough its kind of shore is (a beach's curve is smooth, rock is ragged at every scale); the
     camp's bay put in; and then resampled a metre apart ── */
  function cmr(p0, p1, p2, p3, t) {
    const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, 0.5);
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), u = mix(t1, t2, t);
    const L = (a, b, ta, tb) => [((tb - u) * a[0] + (u - ta) * b[0]) / (tb - ta), ((tb - u) * a[1] + (u - ta) * b[1]) / (tb - ta)];
    const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
    return L(B1, B2, t1, t2);
  }
  function rawLine() {
    /* (the creek put in: up its southern bank to its head and back down its northern) */
    const pts = [];
    for (const c of CTRL) {
      if (c[0] !== 'creek') { pts.push({ x: c[0], z: c[1], k: KIND[c[2]] }); continue; }
      const C = CREEK, side = [], n = C.length;
      for (let i = 0; i < n; i++) { const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1; side.push([tz / l, -tx / l]); }
      for (let i = 0; i < n - 1; i++) pts.push({ x: C[i][0] - side[i][0] * C[i][2], z: C[i][1] - side[i][1] * C[i][2], k: KIND.mangrove, creek: i / (n - 1) });
      const e = C[n - 1], tl = C[n - 2], dx = e[0] - tl[0], dz = e[1] - tl[1], l = Math.hypot(dx, dz);
      pts.push({ x: e[0] + dx / l * e[2] * 0.6, z: e[1] + dz / l * e[2] * 0.6, k: KIND.mangrove, creek: 1 });
      for (let i = n - 2; i >= 0; i--) pts.push({ x: C[i][0] + side[i][0] * C[i][2], z: C[i][1] + side[i][1] * C[i][2], k: KIND.mangrove, creek: i / (n - 1) });
    }
    /* the curve, densely */
    const out = [], N = pts.length;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N], a = [p0.x, p0.z], b = [p1.x, p1.z], c = [p2.x, p2.z], d = [p3.x, p3.z];
      const len = Math.hypot(c[0] - b[0], c[1] - b[1]), n = Math.max(2, Math.ceil(len / 0.5));
      for (let j = 0; j < n; j++) { const t = j / n, q = cmr(a, b, c, d, t); out.push({ x: q[0], z: q[1], k0: p1.k, k1: p2.k, t, creek: p1.creek !== undefined && p2.creek !== undefined ? mix(p1.creek, p2.creek, t) : -1 }); }
    }
    return out;
  }
  /* resample a closed line every step metres of its length */
  function resample(L, step) {
    const seg = [], N = L.length; let total = 0;
    for (let i = 0; i < N; i++) { const a = L[i], b = L[(i + 1) % N], l = Math.hypot(b.x - a.x, b.z - a.z); seg.push(l); total += l; }
    const n = Math.round(total / step), ds = total / n, out = []; let i = 0, acc = 0;
    for (let k = 0; k < n; k++) {
      const s = k * ds; while (acc + seg[i] < s && i < N - 1) { acc += seg[i]; i++; }
      const a = L[i], b = L[(i + 1) % N], f = seg[i] > 0 ? (s - acc) / seg[i] : 0;
      out.push(Object.assign({}, f < 0.5 ? a : b, { x: mix(a.x, b.x, f), z: mix(a.z, b.z, f) }));
    }
    return { pts: out, total: n * ds, ds };
  }

  /* the build: the ridge's field; the coastline with all it carries; then the grid */
  let I = null;
  function build(o = {}) {
    if (I) return I;
    const t0 = Date.now();
    crestBuild();
    /* ── the line, its kinds, its detail ── */
    let L = resample(rawLine(), 1.0).pts;
    /* each point's kind as weights: the point's own, eased into the next kind over the last stretch before it */
    const NK = 4;
    for (const p of L) { const w = new Float32Array(NK), e = sm(0.55, 1, p.t); w[p.k0] += 1 - e; w[p.k1] += e; p.w = w; }
    /* (smoothed along the line: a kind changes over some tens of metres, never at a point) */
    const smooth = (get, set, r) => { const n = L.length, v = L.map(get), acc = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0, ws = 0; for (let j = -r; j <= r; j += 2) { const wt = 1 - Math.abs(j) / (r + 1); s += v[(i + j + n) % n] * wt; ws += wt; } acc[i] = s / ws; } L.forEach((p, i) => set(p, acc[i])); };
    for (let k = 0; k < NK; k++) smooth(p => p.w[k], (p, v) => { p.w[k] = v; }, 24);
    /* the outward normal (to the sea) of the smooth line, before its detail */
    const nrm = (L, i) => { const n = L.length, a = L[(i - 2 + n) % n], b = L[(i + 2) % n], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; };
    const N0 = L.map((p, i) => nrm(L, i));
    L.forEach((p, i) => {
      const w = p.w, xn = p.x * 0.011 + p.z * 0.007;
      /* how ragged: a beach smooth, rock ragged at three scales, a cliff in buttresses, mangrove in low lobes */
      const rough = w[0] * 0.6 + w[1] * 5.0 + w[2] * 3.6 + w[3] * 2.4, fine = w[1] * 1.3 + w[2] * 1.0 + w[3] * 0.5;
      const at = i * 1.0;
      let off = rough * (0.62 * sn1(at / 46, 11) + 0.38 * sn1(at / 17, 13)) + fine * sn1(at / 5.3, 17) + 0.4 * fine * sn1(at / 1.9, 19);
      off += (w[1] + w[2]) * 16 * sn1(at / 230, 9);
      /* (where the shore is rock, the land's own shape comes down to it: a spur runs out into a point, a gully's mouth is
         a cove) */
      off += 26 * (w[1] + 0.7 * w[2]) * spurAt(p.x, p.z) * (p.creek >= 0 ? 0 : 1);
      if (p.creek >= 0) off *= 0.35;
      p.x += N0[i][0] * off; p.z += N0[i][1] * off;
      void xn;
    });
    /* the camp's bay: within BAY.r0 of the camp the shore is the camp's own (and its two rocky points); blended into the
       island's line by BAY.r1 */
    for (const p of L) {
      if (p.z > 200 || Math.abs(p.x) > BAY.r1) continue;
      const W = sm(BAY.r0, BAY.r1, Math.abs(p.x)), zc = zOld(p.x) - headFix(p.x);
      p.z = mix(zc, p.z, W); p.bay = 1 - W;
      /* (the points are rock) */
      const hk = clamp(headFix(p.x) / 9) * (1 - W);
      if (hk > 0) { const w = p.w; for (let k = 0; k < NK; k++) w[k] *= 1 - hk; w[KIND.rock] += hk; }
    }
    /* ── resampled a metre apart; where along the coast each point is (u, in metres): counted from the camp (u 0), so that
       along the camp's bay u is (nearly) the camp's own x, south positive; the count starts (and comes round again) on the
       cliffs of the north-west, where there is no beach for the seam to show on ── */
    const R = resample(L, 1.0); L = R.pts; const P = R.total, n = L.length, ds = R.ds;
    const nearest = (x, z, f) => { let i0 = 0, bd = 1e18; L.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd && (!f || f(p))) { bd = d; i0 = i; } }); return i0; };
    const iCamp = nearest(0, zOld(0), p => p.z < 100), iSeam = nearest(-985, 1090);
    L = L.slice(iSeam).concat(L.slice(0, iSeam));
    const u0 = ((iCamp - iSeam + n) % n) * ds;
    L.forEach((p, i) => { p.u = i * ds - u0; });
    /* tangent and outward normal, smoothed over a few metres */
    L.forEach((p, i) => { const a = L[(i - 3 + n) % n], b = L[(i + 3) % n], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1; p.tx = tx / l; p.tz = tz / l; p.nx = p.tz; p.nz = -p.tx; });
    /* what each stretch of shore is like: how wide its beach (to the forest's edge), how far its reef runs out, how open it
       is to the swell (the creek and the mangroves sheltered, the bays open) */
    L.forEach(p => {
      const w = p.w, a = p.u;
      const sandW = 24 + 12 * sn1(a / 140, 31) + 4 * sn1(a / 37, 33);
      p.W = w[0] * sandW + w[1] * (2.2 + 1.6 * vn1(a / 23, 35)) + w[2] * 0.4 + w[3] * (4 + 3 * vn1(a / 31, 37));
      if (p.bay) { const W0 = vOld(p.x) - 0.55 * headFix(p.x) - (zOld(p.x) - headFix(p.x)); p.W = mix(p.W, W0, p.bay); }
      p.reef = w[1] * (55 + 45 * vn1(a / 160, 41)) + w[2] * 18 + w[3] * 4 + w[0] * (8 + 6 * vn1(a / 90, 43));
      p.ex = p.creek >= 0 ? 0.08 * (1 - p.creek) : 0.15 + 0.85 * (1 - w[3]) * (1 - 0.35 * w[2]);
    });
    /* how open each place is to the swell, worked out from where the sea is: a bay's mouth facing the open sea gets the
       swell, the south-west's shore is behind the island's own lee (the swell comes from the east and the north-east, off
       the South China Sea; this is the island's sheltered side) */
    L.forEach(p => { const fromNE = Math.max(0, -p.nz * 0.75 - p.nx * 0.55); p.ex *= 0.35 + 0.65 * Math.min(1, 0.3 + fromNE * 1.2); });
    /* (all of it as plain arrays, a number per metre of coast: what the GPU is given, and what a worker can hand back) */
    const F = () => new Float32Array(n), line = { n, P, ds, u0, X: F(), Z: F(), TX: F(), TZ: F(), W: F(), REEF: F(), EX: F(), CREEK: F(), K: new Float32Array(n * 4) };
    L.forEach((p, i) => { line.X[i] = p.x; line.Z[i] = p.z; line.TX[i] = p.tx; line.TZ[i] = p.tz; line.W[i] = p.W; line.REEF[i] = p.reef; line.EX[i] = p.ex; line.CREEK[i] = p.creek >= 0 ? p.creek : -1; line.K.set(p.w, i * 4); });
    I = { line, grid: null, crest: CF, ms: 0 };
    const LX = line.X, LZ = line.Z;

    /* ── the grid: signed distance to the shore and the nearest shore point's u, worked out exactly within a few metres
       of the line and carried out from there over the whole grid (each cell keeping the nearest shore point any of its
       neighbours knows of) ── */
    const cell = o.cell || 2.5, X0 = -1560, Z0 = -360, X1 = 1260, Z1 = 1620, nx = Math.ceil((X1 - X0) / cell), nz = Math.ceil((Z1 - Z0) / cell);
    const NC = nx * nz, S = new Float32Array(NC), Uu = new Float32Array(NC), near = new Int32Array(NC).fill(-1), inside = new Uint8Array(NC);
    /* (inside the island: an even-odd fill, row by row, at the cells' middles; each row looking only at the pieces of the
       line that cross it) */
    const rows = Array.from({ length: nz }, () => []);
    for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, j0 = Math.max(0, Math.ceil((Math.min(LZ[k], LZ[k2]) - Z0) / cell - 0.5)), j1 = Math.min(nz - 1, Math.floor((Math.max(LZ[k], LZ[k2]) - Z0) / cell - 0.5)); for (let j = j0; j <= j1; j++) rows[j].push(k); }
    for (let j = 0; j < nz; j++) {
      const zc = Z0 + (j + 0.5) * cell, xs = [];
      for (const k of rows[j]) { const k2 = (k + 1) % n, az = LZ[k], bz = LZ[k2]; if ((az <= zc) !== (bz <= zc)) xs.push(LX[k] + (zc - az) / (bz - az) * (LX[k2] - LX[k])); }
      xs.sort((a, b) => a - b);
      for (let m = 0; m + 1 < xs.length; m += 2) { const i0 = Math.max(0, Math.ceil((xs[m] - X0) / cell - 0.5)), i1 = Math.min(nx - 1, Math.floor((xs[m + 1] - X0) / cell - 0.5)); for (let i = i0; i <= i1; i++) inside[j * nx + i] = 1; }
    }
    /* (exactly, within a few metres of each piece of the line: which piece is nearest, and where on it) */
    const D2 = new Float32Array(NC).fill(1e12), NT = new Float32Array(NC), band = 3;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, ax = LX[k], az = LZ[k], ex = LX[k2] - ax, ez = LZ[k2] - az, ll = ex * ex + ez * ez || 1e-9;
      const i0 = Math.max(0, Math.floor((Math.min(ax, LX[k2]) - X0) / cell) - band), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, LX[k2]) - X0) / cell) + band);
      const j0 = Math.max(0, Math.floor((Math.min(az, LZ[k2]) - Z0) / cell) - band), j1 = Math.min(nz - 1, Math.floor((Math.max(az, LZ[k2]) - Z0) / cell) + band);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = X0 + (i + 0.5) * cell, pz = Z0 + (j + 0.5) * cell; let t = ((px - ax) * ex + (pz - az) * ez) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + ex * t - px, qz = az + ez * t - pz, d2 = qx * qx + qz * qz, c = j * nx + i;
        if (d2 < D2[c]) { D2[c] = d2; near[c] = k; NT[c] = t; }
      }
    }
    /* (and out over the rest: two sweeps, each cell taking a neighbour's nearest piece where that is nearer to it) */
    const tryN = (c, c2, px, pz) => {
      const k = near[c2]; if (k < 0 || k === near[c]) return;
      const k2 = (k + 1) % n, ax = LX[k], az = LZ[k], ex = LX[k2] - ax, ez = LZ[k2] - az, ll = ex * ex + ez * ez || 1e-9; let t = ((px - ax) * ex + (pz - az) * ez) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + ex * t - px, qz = az + ez * t - pz, d2 = qx * qx + qz * qz;
      if (d2 < D2[c]) { D2[c] = d2; near[c] = k; NT[c] = t; }
    };
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = j * nx + i, px = X0 + (i + 0.5) * cell, pz = Z0 + (j + 0.5) * cell;
        if (i > 0) tryN(c, c - 1, px, pz); if (j > 0) { tryN(c, c - nx, px, pz); if (i > 0) tryN(c, c - nx - 1, px, pz); if (i < nx - 1) tryN(c, c - nx + 1, px, pz); } }
      for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const c = j * nx + i, px = X0 + (i + 0.5) * cell, pz = Z0 + (j + 0.5) * cell;
        if (i < nx - 1) tryN(c, c + 1, px, pz); if (j < nz - 1) { tryN(c, c + nx, px, pz); if (i < nx - 1) tryN(c, c + nx + 1, px, pz); if (i > 0) tryN(c, c + nx - 1, px, pz); } }
    }
    /* each cell's distance, its nearest shore point's u, and the way to the sea from there (the shore's own normal at that
       point: smooth along the shore, where the distance's gradient would be ragged at every corner) */
    const NXa = new Float32Array(NC), NZa = new Float32Array(NC);
    for (let c = 0; c < NC; c++) {
      const d = Math.sqrt(D2[c]); S[c] = inside[c] ? -d : d; const k = near[c]; if (k < 0) continue;
      const k2 = (k + 1) % n, t = NT[c]; Uu[c] = (k + t) * ds - u0;
      const tx = line.TX[k] + (line.TX[k2] - line.TX[k]) * t, tz = line.TZ[k] + (line.TZ[k2] - line.TZ[k]) * t, l = Math.hypot(tx, tz) || 1; NXa[c] = tz / l; NZa[c] = -tx / l;
    }
    /* the reef's reach and the swell, as fields over the grid, smoothed (taken from the nearest shore point alone they
       would fan out in rays off every point) */
    const RB = new Float32Array(NC), EB = new Float32Array(NC), tmp = new Float32Array(NC);
    for (let c = 0; c < NC; c++) { const k = near[c]; if (k < 0) continue; RB[c] = line.REEF[k]; EB[c] = line.EX[k]; }
    const blur = (A, r) => {
      for (let j = 0; j < nz; j++) { let acc = 0, cnt = 0; const row = j * nx; for (let i = -r; i < nx; i++) { if (i + r < nx) { acc += A[row + i + r]; cnt++; } if (i - r - 1 >= 0) { acc -= A[row + i - r - 1]; cnt--; } if (i >= 0) tmp[row + i] = acc / cnt; } }
      for (let i = 0; i < nx; i++) { let acc = 0, cnt = 0; for (let j = -r; j < nz; j++) { if (j + r < nz) { acc += tmp[(j + r) * nx + i]; cnt++; } if (j - r - 1 >= 0) { acc -= tmp[(j - r - 1) * nx + i]; cnt--; } if (j >= 0) A[j * nx + i] = acc / cnt; } }
    };
    for (let pass = 0; pass < 2; pass++) { blur(RB, 10); blur(EB, 10); }
    /* ── where along the coast, for the waves: the line smoothed out over some tens of metres, and each cell's nearest point
       on that. Off a ragged shore the nearest point of the line itself jumps from one rock to the next as one goes out to
       sea, and the waves timed along the coast by it would break in pieces; the smooth line's nearest point moves
       smoothly (worked out on cells of twice the size, and joined across them) ── */
    const SG = 30, SW = 75, wts = []; for (let j = -SW; j <= SW; j++) wts.push(Math.exp(-0.5 * (j / SG) ** 2));
    const wsum = wts.reduce((a, b) => a + b, 0), SX = new Float32Array(n), SZ = new Float32Array(n);
    for (let i = 0; i < n; i++) { let ax = 0, az = 0; for (let j = -SW; j <= SW; j++) { const k = (i + j + n) % n, w = wts[j + SW]; ax += LX[k] * w; az += LZ[k] * w; } SX[i] = ax / wsum; SZ[i] = az / wsum; }
    const c2 = cell * 2, nx2 = Math.ceil(nx / 2) + 1, nz2 = Math.ceil(nz / 2) + 1, N2 = nx2 * nz2, near2 = new Int32Array(N2).fill(-1), T2 = new Float32Array(N2), E2 = new Float32Array(N2).fill(1e12);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, ax = SX[k], az = SZ[k], ex = SX[k2] - ax, ez = SZ[k2] - az, ll = ex * ex + ez * ez || 1e-9;
      const i0 = Math.max(0, Math.floor((Math.min(ax, SX[k2]) - X0) / c2) - 2), i1 = Math.min(nx2 - 1, Math.floor((Math.max(ax, SX[k2]) - X0) / c2) + 2);
      const j0 = Math.max(0, Math.floor((Math.min(az, SZ[k2]) - Z0) / c2) - 2), j1 = Math.min(nz2 - 1, Math.floor((Math.max(az, SZ[k2]) - Z0) / c2) + 2);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = X0 + (i + 0.5) * c2, pz = Z0 + (j + 0.5) * c2; let t = ((px - ax) * ex + (pz - az) * ez) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + ex * t - px, qz = az + ez * t - pz, d2 = qx * qx + qz * qz, c = j * nx2 + i; if (d2 < E2[c]) { E2[c] = d2; near2[c] = k; T2[c] = t; }
      }
    }
    const try2 = (c, cc, px, pz) => {
      const k = near2[cc]; if (k < 0 || k === near2[c]) return;
      const k2 = (k + 1) % n, ax = SX[k], az = SZ[k], ex = SX[k2] - ax, ez = SZ[k2] - az, ll = ex * ex + ez * ez || 1e-9; let t = ((px - ax) * ex + (pz - az) * ez) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + ex * t - px, qz = az + ez * t - pz, d2 = qx * qx + qz * qz; if (d2 < E2[c]) { E2[c] = d2; near2[c] = k; T2[c] = t; }
    };
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < nz2; j++) for (let i = 0; i < nx2; i++) { const c = j * nx2 + i, px = X0 + (i + 0.5) * c2, pz = Z0 + (j + 0.5) * c2;
        if (i > 0) try2(c, c - 1, px, pz); if (j > 0) { try2(c, c - nx2, px, pz); if (i > 0) try2(c, c - nx2 - 1, px, pz); if (i < nx2 - 1) try2(c, c - nx2 + 1, px, pz); } }
      for (let j = nz2 - 1; j >= 0; j--) for (let i = nx2 - 1; i >= 0; i--) { const c = j * nx2 + i, px = X0 + (i + 0.5) * c2, pz = Z0 + (j + 0.5) * c2;
        if (i < nx2 - 1) try2(c, c + 1, px, pz); if (j < nz2 - 1) { try2(c, c + nx2, px, pz); if (i < nx2 - 1) try2(c, c + nx2 + 1, px, pz); if (i > 0) try2(c, c + nx2 - 1, px, pz); } }
    }
    const UA2 = new Float32Array(N2); for (let c = 0; c < N2; c++) UA2[c] = near2[c] < 0 ? 0 : (near2[c] + T2[c]) * ds - u0;
    /* (onto the grid's own cells, joined across the coarse ones where they agree) */
    const UA = new Float32Array(NC);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const fx = Math.max(0, Math.min(nx2 - 1.001, (i + 0.5) / 2 - 0.5)), fz = Math.max(0, Math.min(nz2 - 1.001, (j + 0.5) / 2 - 0.5)), a = Math.floor(fx), b = Math.floor(fz), tx = fx - a, tz = fz - b, c = b * nx2 + a;
      const r0 = UA2[c], w = v => { let d = v - r0; d -= P * Math.round(d / P); return d; }, d1 = w(UA2[c + 1]), d2 = w(UA2[c + nx2]), d3 = w(UA2[c + nx2 + 1]);
      UA[j * nx + i] = Math.max(Math.abs(d1), Math.abs(d2), Math.abs(d3)) > 8 * c2 ? UA2[c + (tx < 0.5 ? 0 : 1) + (tz < 0.5 ? 0 : nx2)] : r0 + mix(mix(0, d1, tx), mix(d2, d3, tx), tz);
    }
    /* ── when the swell gets here. A swell comes in from the open sea square to the shore, and reaches each point as soon
       as its distance from the water's edge says, off a straight beach or round a headland alike. Into a cove, though, or
       up a creek, it has further to come — in through the mouth, not across the land between — and reaches the cove's
       back later than its sides: its crests lie straight across a cove, as they do in one, not in rings round its beach.
       So: how far the swell travels in from a line far out (SF from the shore), through the water only (on cells twice
       the size, in sweeps from each corner that carry the nearest way in), kept as how much further that is than the
       plain distance from the shore says (m), carried a little way up the land behind for the swash, and eased off where
       it would be very long (the swells kept about are the ones arriving round now: glsl.js WAVEH, engine.js) ── */
    const SF = 150, h3 = cell * 2, nx3 = Math.ceil(nx / 2), nz3 = Math.ceil(nz / 2), N3 = nx3 * nz3, TT = new Float32Array(N3), SS = new Float32Array(N3), FIX = new Uint8Array(N3);
    for (let j = 0; j < nz3; j++) for (let i = 0; i < nx3; i++) {
      const c = j * nx3 + i, i0 = 2 * i, i1 = Math.min(nx - 1, i0 + 1), j0 = 2 * j, j1 = Math.min(nz - 1, j0 + 1);
      const s = (S[j0 * nx + i0] + S[j0 * nx + i1] + S[j1 * nx + i0] + S[j1 * nx + i1]) / 4; SS[c] = s;
      if (s < 0) TT[c] = Infinity;
      else if (s >= SF || i === 0 || j === 0 || i === nx3 - 1 || j === nz3 - 1) { TT[c] = SF - s; FIX[c] = 1; }
      else TT[c] = Infinity;
    }
    const upd = c => {
      if (FIX[c] || SS[c] < 0) return 0;
      const i = c % nx3, a = Math.min(i > 0 ? TT[c - 1] : Infinity, i < nx3 - 1 ? TT[c + 1] : Infinity), b = Math.min(c >= nx3 ? TT[c - nx3] : Infinity, c < N3 - nx3 ? TT[c + nx3] : Infinity);
      if (a === Infinity && b === Infinity) return 0;
      const t = Math.abs(a - b) >= h3 ? Math.min(a, b) + h3 : (a + b + Math.sqrt(2 * h3 * h3 - (a - b) * (a - b))) / 2;
      if (t < TT[c] - 1e-3) { TT[c] = t; return 1; } return 0;
    };
    for (let it = 0; it < 8; it++) {
      let ch = 0;
      for (let j = 0; j < nz3; j++) for (let i = 0; i < nx3; i++) ch += upd(j * nx3 + i);
      for (let j = 0; j < nz3; j++) for (let i = nx3 - 1; i >= 0; i--) ch += upd(j * nx3 + i);
      for (let j = nz3 - 1; j >= 0; j--) for (let i = 0; i < nx3; i++) ch += upd(j * nx3 + i);
      for (let j = nz3 - 1; j >= 0; j--) for (let i = nx3 - 1; i >= 0; i--) ch += upd(j * nx3 + i);
      if (!ch) break;
    }
    /* (the lag in the water; up the land behind, its nearest water's, a cell further at a time) */
    const LG3 = new Float32Array(N3).fill(NaN);
    for (let c = 0; c < N3; c++) if (SS[c] >= 0 && TT[c] < Infinity) LG3[c] = Math.max(0, SS[c] + TT[c] - SF);
    for (let pass = 0; pass < 8; pass++) {
      const nxt = LG3.slice();
      for (let c = 0; c < N3; c++) {
        if (LG3[c] === LG3[c]) continue;
        const i = c % nx3; let acc = 0, k = 0;
        for (const d of [i > 0 ? -1 : 0, i < nx3 - 1 ? 1 : 0, c >= nx3 ? -nx3 : 0, c < N3 - nx3 ? nx3 : 0]) if (d) { const v = LG3[c + d]; if (v === v) { acc += v; k++; } }
        if (k) nxt[c] = acc / k;
      }
      LG3.set(nxt);
    }
    /* (onto the grid's own cells, between the coarse ones; eased toward a longest of LGM) */
    const LGM = 40, LG = new Float32Array(NC);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const fx = Math.max(0, Math.min(nx3 - 1.001, i / 2 - 0.25)), fz = Math.max(0, Math.min(nz3 - 1.001, j / 2 - 0.25)), a = Math.floor(fx), b = Math.floor(fz), tx = fx - a, tz = fz - b, c = b * nx3 + a;
      const v = q => { const w = LG3[q]; return w === w ? w : 0; };
      const l = mix(mix(v(c), v(c + 1), tx), mix(v(c + nx3), v(c + nx3 + 1), tx), tz);
      LG[j * nx + i] = LGM * Math.tanh(l / LGM);
    }
    const grid = { X0, Z0, cell, nx, nz, S, U: Uu, UA, NX: NXa, NZ: NZa, H: null, RB, EB, LG };
    I.grid = grid;
    /* the ground over the grid */
    const H = new Float32Array(NC);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = j * nx + i; RBc = RB[c]; H[c] = heightAt(X0 + (i + 0.5) * cell, Z0 + (j + 0.5) * cell, S[c], Uu[c]); }
    RBc = -1;
    grid.H = H;
    I.ms = Date.now() - t0;
    return I;
  }
  /* the island as built somewhere else (a worker, or a file): its arrays taken as they are */
  function adopt(D) { I = D; if (D.crest) Object.assign(CF, D.crest); return I; }
  /* everything in it that is an array, for handing over without copying */
  function transfers(D = I) { const out = []; for (const part of [D.line, D.grid, D.crest]) for (const k in part) if (ArrayBuffer.isView(part[k])) out.push(part[k].buffer); return out; }

  /* ── the shore at u: the line's point there and all it carries, between its metre points ── */
  function shore(u, out = {}) {
    const L = I.line, n = L.n, f = (((u + L.u0) / L.ds) % n + n) % n, k = Math.floor(f) % n, t = f - Math.floor(f), b = (k + 1) % n, K = L.K;
    out.u = u; out.x = mix(L.X[k], L.X[b], t); out.z = mix(L.Z[k], L.Z[b], t); out.tx = mix(L.TX[k], L.TX[b], t); out.tz = mix(L.TZ[k], L.TZ[b], t);
    const l = Math.hypot(out.tx, out.tz) || 1; out.tx /= l; out.tz /= l; out.nx = out.tz; out.nz = -out.tx;
    out.W = mix(L.W[k], L.W[b], t); out.reef = mix(L.REEF[k], L.REEF[b], t); out.ex = mix(L.EX[k], L.EX[b], t);
    out.sand = mix(K[k * 4], K[b * 4], t); out.rock = mix(K[k * 4 + 1], K[b * 4 + 1], t); out.cliff = mix(K[k * 4 + 2], K[b * 4 + 2], t); out.mangrove = mix(K[k * 4 + 3], K[b * 4 + 3], t); out.creek = L.CREEK[k];
    return out;
  }
  /* the grid at (x, z), between its cells: the signed distance to the shore, the nearest shore point's u, the way to the
     sea from there. (u is joined across the cells as one number only where they agree: where two stretches of shore are
     equally near, it jumps, and there the nearest cell's is taken) */
  function cellAt(x, z) { const G = I.grid; return [(x - G.X0) / G.cell - 0.5, (z - G.Z0) / G.cell - 0.5]; }
  function bil(A, x, z) {
    const G = I.grid, [fx, fz] = cellAt(x, z), i = Math.max(0, Math.min(G.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(G.nz - 2, Math.floor(fz))), tx = clamp(fx - i), tz = clamp(fz - j), c = j * G.nx + i;
    return mix(mix(A[c], A[c + 1], tx), mix(A[c + G.nx], A[c + G.nx + 1], tx), tz);
  }
  const sdf = (x, z) => {
    const G = I.grid, [fx, fz] = cellAt(x, z);
    /* (off the grid: far out at sea, as far as it is from the grid's edge, and more) */
    if (fx < 0 || fz < 0 || fx > G.nx - 1 || fz > G.nz - 1) { const cx = clamp(x, G.X0 + G.cell, G.X0 + (G.nx - 1) * G.cell), cz = clamp(z, G.Z0 + G.cell, G.Z0 + (G.nz - 1) * G.cell); return bil(G.S, cx, cz) + Math.hypot(x - cx, z - cz); }
    return bil(G.S, x, z);
  };
  function uOf(A, x, z) {
    const G = I.grid, P = I.line.P, [fx, fz] = cellAt(x, z), i = Math.max(0, Math.min(G.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(G.nz - 2, Math.floor(fz))), tx = clamp(fx - i), tz = clamp(fz - j), c = j * G.nx + i;
    const u0 = A[c], w = v => { let d = v - u0; d -= P * Math.round(d / P); return d; }, b = w(A[c + 1]), cc = w(A[c + G.nx]), d = w(A[c + G.nx + 1]);
    if (Math.max(Math.abs(b), Math.abs(cc), Math.abs(d)) > 6 * G.cell) { const q = (tx < 0.5 ? 0 : 1) + (tz < 0.5 ? 0 : G.nx); return A[c + q]; }
    return u0 + mix(mix(0, b, tx), mix(cc, d, tx), tz);
  }
  /* the nearest shore point's u; and where along the coast a point is for the waves (aAt: smooth out at sea, as the
     shaders have it) */
  const uAt = (x, z) => uOf(I.grid.U, x, z), aAt = (x, z) => uOf(I.grid.UA, x, z);
  /* how much further than its distance from the water's edge the swell has to come to (x, z), in metres (into a cove,
     up a creek; none off the grid) */
  const lagAt = (x, z) => { const G = I.grid; if (!G.LG) return 0; const [fx, fz] = cellAt(x, z); return fx < 0 || fz < 0 || fx > G.nx - 1 || fz > G.nz - 1 ? 0 : bil(G.LG, x, z); };
  /* which way the sea lies from (x, z): [nx, nz], a unit vector */
  const NRM = [0, 0];
  function normalAt(x, z) { const a = bil(I.grid.NX, x, z), b = bil(I.grid.NZ, x, z), l = Math.hypot(a, b) || 1; NRM[0] = a / l; NRM[1] = b / l; return NRM; }

  /* ── the ground. Inland, the ridge: its crest down the island's length, a summit in the north, a saddle, a second peak in
     the south; its flanks falling to the coast, ribbed with spurs and cut by the valleys the streams come down. At the
     shore it comes down to the beach, or straight to the water where the shore is cliff; out to sea, the floor: the reef
     flat off the rocky shores, shallow and level, its edge falling away to the deep; off a beach, sand shelving gently ── */
  const CREST = [[-1170, 560, 95], [-960, 598, 196], [-740, 636, 262], [-540, 660, 212], [-330, 680, 146], [-130, 700, 112], [70, 718, 128], [270, 730, 160], [450, 722, 182], [630, 700, 152], [810, 640, 98], [940, 600, 58]];
  /* the crest as a smooth line (every 10 m, its height along it), and over a 10 m grid each point's signed distance from
     it (+ west of it), how far along it, and its height there: so its shape is smooth round its bends (from the bare
     polyline, how far along jumps on the inside of every bend) */
  const CF = { X0: -1600, Z0: -400, cell: 10, nx: 0, nz: 0, SD: null, AL: null, HC: null, L: 0, line: null };
  function crestBuild() {
    if (CF.SD) return;
    const P = CREST, n = P.length, D = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)], len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.ceil(len / 10);
      for (let j = 0; j < m; j++) { const t = j / m, q = cmr([p0[0], p0[1]], [p1[0], p1[1]], [p2[0], p2[1]], [p3[0], p3[1]], t), h = cmr([p0[2], 0], [p1[2], 0], [p2[2], 0], [p3[2], 0], t)[0]; D.push([q[0], q[1], h]); }
    }
    D.push(P[n - 1].slice());
    /* (the ends carried on a little, so beyond them the distance is from a line, not a point) */
    for (const [i, j] of [[0, 1], [D.length - 1, D.length - 2]]) { const a = D[i], b = D[j], dx = a[0] - b[0], dz = a[1] - b[1], l = Math.hypot(dx, dz); const e = [a[0] + dx / l * 250, a[1] + dz / l * 250, a[2] * 0.35]; if (i === 0) D.unshift(e); else D.push(e); }
    CF.line = D; const lens = lensOf(D); CF.L = lens.total;
    const nx = Math.ceil(2900 / CF.cell), nz = Math.ceil(2100 / CF.cell); CF.nx = nx; CF.nz = nz;
    CF.SD = new Float32Array(nx * nz); CF.AL = new Float32Array(nx * nz); CF.HC = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = CF.X0 + (i + 0.5) * CF.cell, z = CF.Z0 + (j + 0.5) * CF.cell; let best = 1e18, bt = 0, bh = 0, sg = 1, acc = 0, at = 0;
      for (let k = 0; k < D.length - 1; k++) {
        const a = D[k], b = D[k + 1], ex = b[0] - a[0], ez = b[1] - a[1], ll = ex * ex + ez * ez || 1e-9, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / ll), qx = a[0] + ex * t, qz = a[1] + ez * t, d = (x - qx) ** 2 + (z - qz) ** 2;
        if (d < best) { best = d; at = acc + lens[k] * t; bh = mix(a[2], b[2], t); sg = ex * (z - a[1]) - ez * (x - a[0]) > 0 ? 1 : -1; bt = t; }
        acc += lens[k];
      }
      const c = j * nx + i; CF.SD[c] = sg * Math.sqrt(best); CF.AL[c] = at; CF.HC[c] = bh; void bt;
    }
  }
  /* the ridge's field at (x, z), between its cells: [signed distance from the crest, how far along it, its height there] */
  const CRF = [0, 0, 0];
  function crestAt(x, z) {
    const fx = clamp((x - CF.X0) / CF.cell - 0.5, 0, CF.nx - 1.001), fz = clamp((z - CF.Z0) / CF.cell - 0.5, 0, CF.nz - 1.001), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, c = j * CF.nx + i;
    const b = A => mix(mix(A[c], A[c + 1], tx), mix(A[c + CF.nx], A[c + CF.nx + 1], tx), tz);
    CRF[0] = b(CF.SD); CRF[1] = b(CF.AL); CRF[2] = b(CF.HC); return CRF;
  }
  /* the spurs down the ridge's flanks: +1 along a spur's back, -1 down a gully, wandering, branching lower down */
  function spurAt(x, z) {
    const cr = crestAt(x, z), sd = cr[0], dc = Math.abs(sd), along = cr[1], side = sd >= 0 ? 1 : -1, q = dc / 700;
    const warp = 0.6 * pfbm(along / 280, dc / 210 + side * 9.1, 21, 2) + 0.25 * pfbm(x / 120, z / 120, 23, 2);
    const a = Math.cos(TAU * (along / (165 + 70 * q) + warp + 0.31 * side)), b = Math.cos(TAU * (along / (82 + 30 * q) + 1.7 * warp + 0.13 * side));
    const amp = 0.65 + 0.55 * pfbm(along / 330 + side * 3.3, dc / 330, 25, 2);
    return clamp((a * 0.75 + b * 0.35 * sm(120, 420, dc)) * amp, -1, 1);
  }
  /* streams: from the sea up their valleys, the depth they cut (m) at their upper end, the width of the valley */
  /* (the creek's reach, as a box round its line, out as far as its valley goes) */
  const CREEKB = (() => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of CREEK) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } const m = 300; return [a - m, b + m, c - m, d + m]; })();
  const STREAMS = [
    { pts: [[-262, -6], [-318, 140], [-352, 300], [-342, 470], [-300, 610]], cut: 34, w: 95 },
    { pts: [[-58, 1384], [-74, 1200], [-62, 1010], [-92, 850]], cut: 30, w: 90 },
    { pts: [[512, 884], [420, 868], [330, 832], [262, 790]], cut: 22, w: 85 },
    { pts: [[636, 112], [578, 280], [520, 440], [470, 580]], cut: 28, w: 80 }
  ];
  /* (each stream's reach: the box round its line, out as far as its valley can matter) */
  const boxOf = S => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of S.pts) { a = Math.min(a, p[0]); b = Math.max(b, p[0]); c = Math.min(c, p[1]); d = Math.max(d, p[1]); } const m = 1.45 * S.w; return (S.box = [a - m, b + m, c - m, d + m]); };
  const streamD = new Float64Array(STREAMS.length * 2);
  /* distance to a polyline, where along it (0..1), and its interpolated third value (each line's lengths worked out once) */
  const lensOf = P => { if (P.lens) return P.lens; const lens = []; let total = 0; for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); lens.push(l); total += l; } lens.total = total; return (P.lens = lens); };
  const OL = [0, 0, 0];
  function onLine(P, x, z) {
    let best = 1e18, bt = 0, bv = 0, acc = 0; const lens = lensOf(P), total = lens.total;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], ll = ex * ex + ez * ez, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / ll), qx = a[0] + ex * t, qz = a[1] + ez * t, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; bt = (acc + lens[i] * t) / total; bv = a[2] !== undefined ? mix(a[2], b[2], t) : 0; }
      acc += lens[i];
    }
    OL[0] = Math.sqrt(best); OL[1] = bt; OL[2] = bv; return OL;
  }
  function heightAt(x, z, s, u) {
    if (s === undefined) { s = sdf(x, z); u = uAt(x, z); }
    const sh = shore(u, SHT), d = -s;
    if (d < 0) return seaFloor(x, z, s, sh);
    /* the ridge: its crest's height there, the flanks falling away from it convex at first and steepening (as a ridge of
       hard rock wears), toward the ends more narrowly; spurs running down the flanks square to the crest, the gullies
       between them, a little wandering, further apart lower down; and over all of it a finer roughness */
    const cr = crestAt(x, z), dc = Math.abs(cr[0]), along = cr[1], hc = cr[2], tc = clamp(along / CF.L);
    const wid = 560 + 160 * Math.sin(tc * Math.PI), q = dc / wid;
    let H = hc * Math.max(0, 1 - Math.pow(q, 1.65)) * (1 - 0.2 * q);
    /* (the spurs and their gullies, left out where a stream has its own valley; a stream's line only looked at near it) */
    let nearS = 0; const SD = streamD;
    for (let q = 0; q < STREAMS.length; q++) { const S = STREAMS[q], B = S.box || boxOf(S); if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) { SD[q * 2] = 1e9; continue; }
      const st = onLine(S.pts, x, z); SD[q * 2] = st[0]; SD[q * 2 + 1] = st[1]; nearS = Math.max(nearS, 1 - sm(0.5, 1.4, st[0] / S.w)); }
    const sk = sm(20, 150, dc) * (1 - nearS);
    H *= 1 + 0.24 * sk * spurAt(x, z);
    H += 9 * pfbm(x / 70, z / 70, 41, 3) * sm(8, 50, H) + 3 * pfbm(x / 22, z / 22, 47, 2) * sm(4, 30, H);
    /* the valleys: each stream's, deeper inland, its floor near the stream itself flat */
    for (let q = 0; q < STREAMS.length; q++) {
      const S = STREAMS[q], ds = SD[q * 2], ts = SD[q * 2 + 1], w = S.w * (0.55 + 0.45 * ts); if (ds > w) continue;
      const qq = ds / w, depth = S.cut * (0.25 + 0.75 * ts), v = 1 - qq * qq;
      H -= Math.min(H * 0.8, depth * v * v * (1 - 0.5 * sm(0.7, 1, ts)));
    }
    /* the creek's own valley: low ground either side of it, the mangroves' mud and then the forest's floor, rising gently
       to the hills a couple of hundred metres off (a tidal creek winds through the low ground it has filled; it cuts no
       gorge) */
    if (x > CREEKB[0] && x < CREEKB[1] && z > CREEKB[2] && z < CREEKB[3]) {
      const st = onLine(CREEK, x, z), hw = st[2], f = 0.04 + 0.96 * sm(hw + 6, hw + 230, st[0]) ** 1.3;
      H *= f;
    }
    /* down to the coast. A beach is level sand from the water up to the forest and some metres into it (the sand is the
       ground the sea is drawn with, at the sea's own level: the land stays just under it there, as the coast's hills
       always did); the mud of the mangroves level too; behind, the land rises as steeply as the kind of shore says, and
       a cliff stands straight up out of the water */
    const W = sh.W, flat = W + 9 * sh.sand + 12 * sh.mangrove + 1.5 * sh.rock, slopeL = sh.sand * 60 + sh.rock * 44 + sh.cliff * (7 + 10 * vn1(u / 31, 87)) + sh.mangrove * 110;
    let k = sm(flat, flat + slopeL, d);
    /* (a cliff: the lower part of the land's rise, sheer, in ledges, each step of rock a little back from the one below;
       above it the slope goes on up, less steeply, under the forest) */
    if (sh.cliff > 0.01) {
      const cf = 0.38 + 0.2 * vn1(u / 53, 93), n = 2 + 2 * vn1(u / 47, 89), q = sm(flat, flat + slopeL, d), st = q * n + 0.6 * vn1(u / 11, 91), f = st - Math.floor(st);
      const kc = cf * mix(q, clamp((Math.floor(st) + sm(0.2, 0.85, f)) / n), 0.65) + (1 - cf) * sm(flat + slopeL * 0.6, flat + slopeL + 55, d);
      k = mix(k, kc, sh.cliff);
    }
    return H * k + LEVEL * (1 - k);
  }
  /* the level of the sand: the ground the sea is drawn with is at 0; the land's surface keeps this far under it */
  const LEVEL = -0.06;
  /* which side of the crest (x, z) is on: +1 the west, -1 the east */
  function crestSide(x, z) {
    let best = 1e18, sgn = 1;
    for (let i = 0; i < CREST.length - 1; i++) {
      const a = CREST[i], b = CREST[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], ll = ex * ex + ez * ez, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / ll), qx = a[0] + ex * t, qz = a[1] + ez * t, d = (x - qx) ** 2 + (z - qz) ** 2;
      if (d < best) { best = d; sgn = ex * (z - a[1]) - ez * (x - a[0]) > 0 ? 1 : -1; }
    }
    return sgn;
  }
  const SHT = {};
  let RBc = -1;
  function seaFloor(x, z, s, sh) {
    /* (sand off a beach: shelving from the waterline to a few metres down a hundred metres out; the reef flat off the rocks,
       level and shallow, out to its edge, then the drop to the deep) */
    const sandF = -(0.06 * s + 0.0011 * s * s), R = RBc >= 0 ? RBc : I.grid.RB ? bil(I.grid.RB, x, z) : sh.reef, flat = -(0.5 + 0.9 * vn2(x / 30, z / 30, 91)) * sm(0, 6, s), edge = sm(R, R + 26, s);
    const reefF = mix(flat, -(4 + 0.12 * (s - R)), edge), deep = -Math.min(42, 6 + 0.09 * s + 0.00006 * s * s);
    const k = sh.rock + sh.cliff * 0.6;
    let h = mix(sandF, reefF, clamp(k));
    h = Math.max(Math.min(h, -0.05), deep);
    /* (out past the reef the shore no longer counts: the sea floor goes down to the deep the same off any of it) */
    return mix(h, deep, sm(R + 50, R + 170, s));
  }
  /* the ground's height at (x, z) (between the grid's cells), and over the sea the floor's */
  const height = (x, z) => I.grid.H ? bil(I.grid.H, x, z) : heightAt(x, z);

  /* ── for the GPU: the grid as a texture of half floats (the distance to the shore, the way to the sea, the ground's or
     the sea floor's height), u as a texture of its own (full floats: it runs to thousands of metres and must be exact to
     a centimetre or two), and the coastline's own numbers, a texel a metre in rows of LW: how wide the beach, how much of
     it sand, rock, cliff or mangrove (one plane), how much mangrove, how far the reef runs out, how open to the swell, how
     far up the creek (the other) ── */
  const LW = 2048;
  const _hf = new Float32Array(1), _hi = new Uint32Array(_hf.buffer);
  function half(v) {
    _hf[0] = v; const x = _hi[0], sgn = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
    if (e <= 0) return e < -10 ? sgn : sgn | ((m | 0x800000) >>> (1 - e + 13));
    if (e >= 31) return sgn | 0x7bff;
    return sgn | (e << 10) | ((m + 0x1000) >>> 13 > 0x3ff ? 0x3ff : (m + 0x1000) >>> 13);
  }
  function gpu() {
    const G = I.grid, L = I.line, NC = G.nx * G.nz, field = new Uint16Array(NC * 4);
    for (let c = 0; c < NC; c++) { field[c * 4] = half(G.S[c]); field[c * 4 + 1] = half(G.NX[c]); field[c * 4 + 2] = half(G.NZ[c]); field[c * 4 + 3] = half(G.H[c]); }
    const rows = Math.ceil(L.n / LW), line = new Uint16Array(LW * rows * 2 * 4);
    for (let i = 0; i < L.n; i++) {
      const a = i * 4, b = (rows * LW + i) * 4, K = L.K;
      line[a] = half(L.W[i]); line[a + 1] = half(K[i * 4]); line[a + 2] = half(K[i * 4 + 1]); line[a + 3] = half(K[i * 4 + 2]);
      line[b] = half(K[i * 4 + 3]); line[b + 1] = half(L.REEF[i]); line[b + 2] = half(L.EX[i]); line[b + 3] = half(L.CREEK[i]);
    }
    /* (and over the grid, what the nearest shore is like, a byte each: how far the tide moves the water up it, its beach's
       width, how much of it is sand, how open it is to the swell; how much rock, cliff, mangrove, how far its reef runs) */
    const k1 = new Uint8Array(NC * 4), k2 = new Uint8Array(NC * 4), b8 = v => Math.max(0, Math.min(255, Math.round(v * 255))), K = L.K, q = {};
    for (let c = 0; c < NC; c++) {
      const f = (((G.U[c] + L.u0) / L.ds) % L.n + L.n) % L.n, i = Math.floor(f) % L.n, j = (i + 1) % L.n, t = f - Math.floor(f);
      q.sand = mix(K[i * 4], K[j * 4], t); q.rock = mix(K[i * 4 + 1], K[j * 4 + 1], t); q.cliff = mix(K[i * 4 + 2], K[j * 4 + 2], t); q.mangrove = mix(K[i * 4 + 3], K[j * 4 + 3], t);
      k1[c * 4] = b8(tideK(q) / 1.5); k1[c * 4 + 1] = b8(mix(L.W[i], L.W[j], t) / 50); k1[c * 4 + 2] = b8(q.sand); k1[c * 4 + 3] = b8(G.EB[c]);
      k2[c * 4] = b8(q.rock); k2[c * 4 + 1] = b8(q.cliff); k2[c * 4 + 2] = b8(q.mangrove); k2[c * 4 + 3] = b8(G.RB[c] / 128);
    }
    /* (u, and how much later than its distance from the shore says the swell gets there: full floats, side by side) */
    const u = new Float32Array(NC * 2); for (let c = 0; c < NC; c++) { u[c * 2] = G.UA[c]; u[c * 2 + 1] = G.LG ? G.LG[c] : 0; }
    return { field, u, line, k1, k2, nx: G.nx, nz: G.nz, X0: G.X0, Z0: G.Z0, cell: G.cell, LW, rows, n: L.n, P: L.P, u0: L.u0, ds: L.ds };
  }
  /* how far up a shore the tide moves the water's edge, as a share of how far it moves it up a beach: on rock a quarter as
     far, up a cliff hardly at all, over the mangroves' mud further than on the sand */
  const tideK = q => q.sand + 0.25 * q.rock + 0.04 * q.cliff + 1.3 * q.mangrove;
  return { build, adopt, transfers, gpu, tideK, shore, sdf, uAt, aAt, lagAt, normalAt, height, heightAt, onLine, CREST, STREAMS, KIND, LEVEL, get data() { return I; }, zOld, vOld, headFix };
})();
if (typeof module !== 'undefined') module.exports = Island;
