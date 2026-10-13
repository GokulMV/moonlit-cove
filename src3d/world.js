/* ─────────────────────────────────────────────────────────────
   world.js — the coast beyond the camp, without end and never the
   same twice. It is built in chunks along the beach as the camera
   comes near: rocky headlands (Layout.Coast) with a strip of sand at
   their foot to drive round the point, sea stacks and surf rocks off
   them, forest on the hills behind. Each chunk grows from its own
   seeds, so it comes out the same whenever, and in whatever order, it
   is built. The work is cut into small steps, a few milliseconds of
   them a frame; near chunks get every detail, far ones lighter
   versions, and chunks left far behind are thrown away. By the camp
   the forest keeps its clearing.
   Also answers what the van has to drive round, which rocks stand in
   the sea, and the height of the land, for collisions and sound.
   ───────────────────────────────────────────────────────────── */
const World = (() => {
  const T = THREE, TAU = Math.PI * 2, Co = Layout.Coast;
  const CW = 128, X0 = -64;                                   /* chunk c covers [X0 + c·CW, X0 + (c+1)·CW) along the coast; chunk 0 holds the camp */
  const LOD = { tiny: 45, near: 155, fine: 300, mid: 430, rocks: 1050, view: 3400, keep: 3800 };   /* (beyond the rocks' reach a chunk is only its land, its canopy and the crowns over it: the coast and its mountains run on into the haze) */
  const rng = s => Textures.rng(s);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* the building is done in small steps: each piece of work checks late() as it goes and hands the frame back (yields)
     once its step has had its time, whatever the machine */
  let due = Infinity;
  const late = () => performance.now() > due;

  /* ── value noise ── */
  /* (lattice points are wrapped into ±4096 before they are hashed: sin slows right down for the huge arguments the far
     coast would give it. Nothing near the camp moves; far out, the noise comes round again every 8 km or more) */
  const lw = v => v > 4096 || v < -4096 ? v - 8192 * Math.round(v / 8192) : v;
  const h3 = (x, y, z) => { const s = Math.sin(lw(x) * 127.1 + lw(y) * 311.7 + lw(z) * 74.7) * 43758.5453; return s - Math.floor(s); };
  const L = (a, b, t) => a + (b - a) * t;
  function vn(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    return L(L(L(h3(ix, iy, iz), h3(ix + 1, iy, iz), u), L(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), u), v),
             L(L(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), u), L(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), u), v), w);
  }
  const fbm = (x, y, z, o = 4) => { let a = 0, s = 0.5, f = 1; for (let i = 0; i < o; i++) { a += s * vn(x * f, y * f, z * f); s *= 0.5; f *= 2.03; } return a; };
  /* noise along the coast. The old repeating stretch wrapped x round a circle so its noise closed on itself; this is
     the same noise laid along that circle's tangent at the camp, so the camp's surroundings keep their shapes */
  const RW = 1024 / TAU;
  const fbmX = (x, z, f, seed, o = 4) => fbm(f * RW + seed * 1.37, x * f - seed * 0.71, z * f, o);
  const vnX = (x, z, f, seed) => vn(f * RW + seed * 1.37, x * f - seed * 0.71, z * f);
  /* 2-D cells of a given size: distance to the nearest jittered point (in cell units); that cell's id is left in cellId */
  let cellId = 0;
  function cell2(x, z, size, seed) {
    const gx = Math.floor(x / size), gz = Math.floor(z / size); let best = 1e9, id = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cx = gx + i, cz = gz + j;
      const px = (cx + 0.15 + 0.7 * h3(cx, cz, seed)) * size, pz = (cz + 0.15 + 0.7 * h3(cz + 17.3, cx - 5.1, seed + 3.7)) * size;
      const d = (px - x) ** 2 + (pz - z) ** 2; if (d < best) { best = d; id = h3(cx * 1.7, cz * 2.3, seed + 9.1); }
    }
    cellId = id; return Math.sqrt(best) / size;
  }
  /* an integer hash of three numbers, as a fraction: the forest's grid draws */
  const hash3 = (a, b, c) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 0x3c6ef372, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };

  /* ── the land (all in coast coordinates: World turns them into the world's where it hands things out) ── */
  /* hills behind the beach, so the forest climbs away from the sand: rising inland, cut by the streams into spurs
     with V-shaped gullies between them, running down toward the sea (and wandering as they go), deeper the higher
     the hill */
  const hill = (x, z) => {
    const e = z - Co.vegZ(x) - 9; if (e <= 0) return -0.06;
    const k = e < 100 ? (e / 100) ** 2 * (3 - 2 * e / 100) : 1;
    const gy = Math.abs(2 * vnX(x + 26 * Math.sin(z * 0.013) + 9 * Math.sin(z * 0.041), 0, 1 / 46, 33) - 1);
    return k * (16 + 22 * fbmX(x, z, 0.012, 3.1, 3)) * (0.74 + 0.34 * Math.pow(gy, 0.75)) + 1.2 * fbmX(x, z, 0.06, 1.7, 2) * Math.min(1, e / 20);
  };
  /* a headland: a promontory of stepped rock rising off the back of the beach where the coast bulges out; the sea runs
     round a strip of sand at its foot. Each its own: height, the step of its terraces, the sand left at its foot */
  const ztOf = h => h.zt === undefined ? (h.zt = Co.shoreZ(h.hx) + h.gap) : h.zt;     /* where its rock begins */
  const MR = 3.4 * Co.WMAX;
  let foot = 0;   /* how much of the last massif() point was a headland's body (left aside, to save an array a call) */
  function massif(x, z) {
    let best = -9, fp = 0;
    const HL = Co.near(x - MR, x + MR);
    for (let i = 0; i < HL.length; i++) {
      const h = HL[i], hx = h.hx, w = h.w, u = x - hx; if (Math.abs(u) > w * 3.4) continue;
      const s = z - ztOf(h); if (s < -9) continue;
      const bend = 2.6 * Math.sin(s * 0.06 + hx * 0.1), hw = w * (0.36 + 0.7 * sm(0, 32, s)), a = (u - bend) / hw, e = Math.exp(-a * a * 1.3);
      const body = e * sm(-3.5, 4.0, s) * sm(0.02, 0.12, e), st = h.st;
      let H;
      if (body > 0) {
        H = (5.5 + 7.5 * sm(2, 44, s)) * h.ht * (h.minor ? 0.62 : 1) * body * (0.7 + 0.6 * fbm(x * 0.05 + hx, 2.0, z * 0.05, 3));
        const k = (H + 0.9 * (fbm(x * 0.13, 7.0, z * 0.13, 2) - 0.5)) / st, f = k - Math.floor(k);
        H = H * 0.35 + 0.65 * (Math.floor(k) + sm(0.25, 0.75, f)) * st;
        H += (fbm(x * 0.33, 5.0, z * 0.33, 2) - 0.5) * 1.4 * sm(0.3, 2.5, H);
      } else {   /* off the rock only the rounding of the terrace step is left (the noise the body scales to nothing is skipped) */
        const k = 0.9 * (fbm(x * 0.13, 7.0, z * 0.13, 2) - 0.5) / st, f = k - Math.floor(k);
        H = 0.65 * (Math.floor(k) + sm(0.25, 0.75, f)) * st;
      }
      if (H > best) { best = H; fp = body; }
    }
    foot = fp; return best;
  }
  /* the mountains behind: a forested range a few hundred metres inland that runs the length of the coast. Its crest
     wanders nearer and further, rises to peaks and dips to saddles (slow noise along the coast, the same anywhere you
     ask), its flanks ribbed with spurs and gullies running down toward the sea */
  function range(x, z) {
    const e = z - Co.vegZ(x); if (e < 150) return -9;
    const cz = 560 + 260 * (fbmX(x, 0, 1 / 900, 61, 2) - 0.5), u = (e - cz) / (170 + 110 * fbmX(x, 0, 1 / 600, 64, 2));
    if (u < -2.8) return -9;
    /* peaks and saddles along the crest, at two sizes */
    const r1 = 1 - Math.abs(2 * vnX(x, 0, 1 / 520, 81) - 1), r2 = 1 - Math.abs(2 * vnX(x, 0, 1 / 190, 83) - 1);
    const crest = 45 + 175 * Math.pow(fbmX(x, 0, 1 / 1400, 71, 3), 1.4) * (0.5 + 0.7 * r1 * r1) + 45 * r2 * r2;
    const prof = u < 0 ? Math.exp(-u * u * 0.85) : Math.exp(-u * u * 0.3);
    const rib = 1 - Math.abs(2 * vnX(x, z, 1 / 55, 87) - 1);           /* spurs and the gullies between them */
    return crest * prof * (0.84 + 0.22 * rib + 0.14 * (fbmX(x, z, 1 / 160, 91, 3) - 0.5)) - 3;
  }
  /* ── reefs (Layout.Coast.reefs): a ledge of rock from the sand out into the sea. Its line is sampled every metre or so:
     where it runs, how high its top stands above the sea (rising out of the sand at the beach end, lower toward the far
     end, where the waves break over it), how wide its top is. Across, the top is fairly flat (a walk along it), then
     its shoulders round off and its flanks fall steeply into the water ── */
  const reefLines = new Map();
  function reefLine(R) {
    let L = reefLines.get(R.id); if (L) return L;
    const g = Co.shoreDZ(R.x), n = Math.hypot(g, 1), dx = g / n, dz = -1 / n, ca = Math.cos(R.ang), sa = Math.sin(R.ang);
    const ox = dx * ca - dz * sa, oz = dx * sa + dz * ca, px = -oz, pz = ox, z0 = Co.shoreZ(R.x) + 1.4, N = Math.ceil(R.len / 0.9);
    L = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, b = R.bend * Math.sin(Math.PI * t), q = R.id * 0.731;
      /* (in slabs: the top steps up and down from one block of rock to the next, and dips low here and there, where the
         waves wash right over it) */
      const slab = vn(Math.floor(t * R.len / 2.3) * 1.37 + q, 5.5, 1.1), dip = Math.pow(vn(t * R.len / 9 + q, 2.7, 6.1), 3);
      /* (piled up out of blocks it stands higher than a ledge would: a metre and more at the beach end) */
      const h0 = R.h0 + 0.5, h = (h0 * (1 - 0.4 * t) + 0.16 * (slab - 0.5) + 0.1 * (vn(t * 7 + q, 1.3, 2.1) - 0.5) - 0.3 * dip * h0) * sm(0, 0.15, t) - 0.12 * sm(0.82, 1, t);
      const w = R.w * (0.5 + 0.5 * sm(0, 0.14, t)) * (0.7 + 0.6 * vn(t * 6 + q, 4.2, 0.7)) * (0.9 + 0.2 * slab) * (1 - 0.15 * t);
      L.push({ x: R.x + ox * R.len * t + px * b, z: z0 + oz * R.len * t + pz * b, h, w, t });
    }
    let x0 = 1e9, x1 = -1e9, zA = 1e9, zB = -1e9; for (const p of L) { x0 = Math.min(x0, p.x - 3 * p.w); x1 = Math.max(x1, p.x + 3 * p.w); zA = Math.min(zA, p.z - 3 * p.w); zB = Math.max(zB, p.z + 3 * p.w); }
    Object.assign(L, { R, ox, oz, px, pz, box: [x0, x1, zA, zB] });
    if (reefLines.size > 64) reefLines.delete(reefLines.keys().next().value);
    reefLines.set(R.id, L); return L;
  }
  /* the rock's height across it, v the distance from its middle line in half-widths */
  const reefProf = (h, v) => { const a = Math.abs(v); return a <= 0.7 ? h : a <= 1 ? h - 0.32 * ((a - 0.7) / 0.3) ** 2 : h - 0.32 - (a - 1) * (h + 1.5) / 0.9; };

  /* ── the reefs are groynes: built of blocks of quarried rock tipped one on another along the line, the biggest along
     its crest, their tops at about its height and each at its own tilt, more down its flanks leaning outward into the
     sea, and a toe of smaller ones at their feet, mostly under water; a heap round its far end. Under them, filling
     between, the ledge itself, lower and in shadow (CORE below the crest) ── */
  const CORE = 0.6;
  /* a block: a box a little out of square with its corners and edges broken off, as blasted granite is, every face flat.
     Made as the space inside a set of planes (n·p ≤ d): the box's six and a dozen or so cuts; the faces are where those
     planes bound it */
  function blockProto(seed) {
    const r = rng(seed), H = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(n => {
      const a = [n[0] + (r() - 0.5) * 0.14, n[1] + (r() - 0.5) * 0.14, n[2] + (r() - 0.5) * 0.14], l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l, 0.93 + r() * 0.14]; });
    for (let i = 0, nc = 9 + Math.floor(r() * 7); i < nc; i++) {
      let x = r() < 0.5 ? -1 : 1, y = r() < 0.5 ? -1 : 1, z = r() < 0.5 ? -1 : 1;
      if (r() < 0.55) { const k = Math.floor(r() * 3); if (k === 0) x = 0; else if (k === 1) y = 0; else z = 0; }     /* (an edge, or else a corner) */
      x += (r() - 0.5) * 0.8; y += (r() - 0.5) * 0.8; z += (r() - 0.5) * 0.8; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      H.push([x, y, z, (Math.abs(x) + Math.abs(y) + Math.abs(z)) * (0.6 + 0.32 * r())]);
    }
    /* its corners: where three planes meet inside all the others */
    const V = [], inside = p => H.every(h => h[0] * p[0] + h[1] * p[1] + h[2] * p[2] <= h[3] + 1e-7);
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) for (let k = j + 1; k < H.length; k++) {
      const a = H[i], b = H[j], c = H[k], det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
      if (Math.abs(det) < 1e-9) continue;
      const p = [(a[3] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[3] * c[2] - b[2] * c[3]) + a[2] * (b[3] * c[1] - b[1] * c[3])) / det,
        (a[0] * (b[3] * c[2] - b[2] * c[3]) - a[3] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[3] - b[3] * c[0])) / det,
        (a[0] * (b[1] * c[3] - b[3] * c[1]) - a[1] * (b[0] * c[3] - b[3] * c[0]) + a[3] * (b[0] * c[1] - b[1] * c[0])) / det];
      if (inside(p) && !V.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-6)) V.push(p);
    }
    /* each plane's face: the corners on it, in order round their middle; flat, each a shade of its own */
    const P = [], N = [], C = [], used = [];
    for (const h of H) {
      const F = V.filter(p => Math.abs(h[0] * p[0] + h[1] * p[1] + h[2] * p[2] - h[3]) < 1e-6); if (F.length < 3) continue;
      used.push(h);
      const c = F.reduce((s, p) => [s[0] + p[0] / F.length, s[1] + p[1] / F.length, s[2] + p[2] / F.length], [0, 0, 0]);
      const ax = Math.abs(h[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = [h[1] * ax[2] - h[2] * ax[1], h[2] * ax[0] - h[0] * ax[2], h[0] * ax[1] - h[1] * ax[0]], lu = Math.hypot(...u);
      u[0] /= lu; u[1] /= lu; u[2] /= lu; const w = [h[1] * u[2] - h[2] * u[1], h[2] * u[0] - h[0] * u[2], h[0] * u[1] - h[1] * u[0]];
      F.sort((p, q) => Math.atan2((p[0] - c[0]) * w[0] + (p[1] - c[1]) * w[1] + (p[2] - c[2]) * w[2], (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1] + (p[2] - c[2]) * u[2])
        - Math.atan2((q[0] - c[0]) * w[0] + (q[1] - c[1]) * w[1] + (q[2] - c[2]) * w[2], (q[0] - c[0]) * u[0] + (q[1] - c[1]) * u[1] + (q[2] - c[2]) * u[2]));
      const tone = 0.86 + 0.26 * r();
      for (let i = 1; i < F.length - 1; i++) for (const p of [F[0], F[i], F[i + 1]]) { P.push(...p); N.push(h[0], h[1], h[2]); C.push(tone, tone, tone); }
    }
    /* (wound to face outward: each triangle's turn agrees with its plane's normal) */
    for (let i = 0; i < P.length; i += 9) {
      const ux = P[i + 3] - P[i], uy = P[i + 4] - P[i + 1], uz = P[i + 5] - P[i + 2], vx = P[i + 6] - P[i], vy = P[i + 7] - P[i + 1], vz = P[i + 8] - P[i + 2];
      if ((uy * vz - uz * vy) * N[i] + (uz * vx - ux * vz) * N[i + 1] + (ux * vy - uy * vx) * N[i + 2] < 0) for (let k = 0; k < 3; k++) { const t = P[i + 3 + k]; P[i + 3 + k] = P[i + 6 + k]; P[i + 6 + k] = t; }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    return { geo, planes: used, shape: [1, 1, 1], block: true };
  }
  let BPs = null; const blockProtos = () => BPs || (BPs = Array.from({ length: 8 }, (_, i) => blockProto(911 + i * 37)));
  /* the stones' own colours: granite grey, a browner grey, a dark one and now and then a pale, sandy one */
  const BLOCKC = [[0.155, 0.148, 0.14], [0.17, 0.15, 0.128], [0.118, 0.114, 0.11], [0.2, 0.178, 0.148], [0.142, 0.135, 0.126]];
  /* the blocks of a reef: where each lies (coast coordinates), turned and sized, its planes in the world (for how high
     its top is under a point), and a grid of 2 m cells saying which blocks reach over each */
  const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _ax = new T.Vector3();
  function reefBlocks(L) {
    if (L.blocks) return L;
    const R = L.R, rr = rng(R.seed + 77), BP = blockProtos(), out = [];
    const seg = []; let total = 0; for (let i = 0; i < L.length - 1; i++) { const l = Math.hypot(L[i + 1].x - L[i].x, L[i + 1].z - L[i].z) || 1e-6; seg.push(l); total += l; }
    const at = s0 => { let s = Math.max(0, Math.min(total, s0)), i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
      const A = L[i], B = L[i + 1], u = Math.min(1, s / seg[i]), tx = (B.x - A.x) / seg[i], tz = (B.z - A.z) / seg[i];
      return { x: A.x + (B.x - A.x) * u, z: A.z + (B.z - A.z) * u, h: A.h + (B.h - A.h) * u, w: A.w + (B.w - A.w) * u, t: A.t + (B.t - A.t) * u, tx, tz }; };
    /* one block: centre (x, z), its top's height there, half-sizes, how far it leans out (about the line, toward the
       side sd) and a little every way */
    const put = (x, z, top, hx, hy, hz, lean, sd, tx, tz, wet) => {
      const proto = BP[Math.floor(rr() * BP.length)];
      _e.set((rr() - 0.5) * 0.34, rr() * TAU, (rr() - 0.5) * 0.34, 'YXZ'); const q = new T.Quaternion().setFromEuler(_e);
      if (lean) q.premultiply(_q.setFromAxisAngle(_ax.set(tx, 0, tz), sd * lean));     /* (turned about the line: its top faces out to the side sd) */
      const sv = new T.Vector3(hx, hy, hz), Wp = [];
      for (const h of proto.planes) { _v.set(h[0] / hx, h[1] / hy, h[2] / hz).applyQuaternion(q); Wp.push([_v.x, _v.y, _v.z, h[3] + _v.x * x + _v.z * z]); }
      const b = { x, y: 0, z, q, sv, proto, W: Wp, rad: Math.hypot(hx, hz), top, wet, col: BLOCKC[Math.floor(rr() * BLOCKC.length)].map(c => c * (0.9 + 0.2 * rr())) };
      /* (set down so its top is where it should be: as placed, at y 0, the top over its middle is t; move it by top − t) */
      const t0 = blockTop(b, x, z); if (t0 === null) return; b.y = top - t0; for (const w of Wp) w[3] += w[1] * b.y;
      out.push(b);
    };
    for (let s = 0.4; s < total + 0.3; s += 0.95 + 0.55 * rr()) {
      const P = at(s), px = -P.tz, pz = P.tx, beach = Co.shoreZ(P.x) + 0.2;
      const lay = (v, top, k, lean, sd, wet) => {
        const x = P.x + px * v * P.w + P.tx * (rr() - 0.5) * 0.7, z = P.z + pz * v * P.w + P.tz * (rr() - 0.5) * 0.7;
        if (top < -1.3 || (z > beach && top < -0.25)) return;     /* (lost in the sea floor, or buried in the sand) */
        put(x, z, top, k * (0.62 + 0.3 * rr()), k * (0.48 + 0.28 * rr()), k * (0.56 + 0.26 * rr()), lean, sd, P.tx, P.tz, wet);
      };
      /* the crest: two or three across, big, their tops about level */
      const nA = P.w > 1.45 ? 3 : 2;
      for (let j = 0; j < nA; j++) lay((nA === 3 ? (j - 1) * 0.62 : (j - 0.5) * 0.9) + (rr() - 0.5) * 0.18, P.h + (rr() - 0.55) * 0.34, 1, (rr() - 0.5) * 0.36, 1, false);
      /* (and a smaller one wedged in between here and there, lower, at a slant) */
      if (rr() < 0.55) lay((rr() - 0.5) * 1.6, P.h - 0.1 - 0.25 * rr(), 0.62, (rr() - 0.5) * 0.9, 1, false);
      /* the flanks: leaning out, lower; and the toe at their feet */
      for (const sd of [-1, 1]) {
        lay(sd * (1.18 + 0.2 * rr()), P.h - 0.38 - 0.28 * rr(), 0.95, 0.32 + 0.4 * rr(), sd, false);
        if (rr() < 0.85) lay(sd * (1.8 + 0.25 * rr()), P.h - 1.0 - 0.35 * rr(), 0.82, 0.45 + 0.35 * rr(), sd, true);
      }
    }
    /* the heap round its far end, where the sea breaks over it */
    const E = at(total);
    for (let k = 0; k < 9; k++) { const a = rr() * TAU, d = 0.6 + rr() * 2.4, x = E.x + E.tx * (0.8 + d * 0.8) + Math.cos(a) * d * 0.6, z = E.z + E.tz * (0.8 + d * 0.8) + Math.sin(a) * d * 0.6;
      put(x, z, E.h - 0.3 - 0.25 * d - 0.3 * rr(), 0.9 * (0.6 + 0.3 * rr()), 0.9 * (0.44 + 0.2 * rr()), 0.9 * (0.56 + 0.26 * rr()), 0.25 + 0.4 * rr(), 1, Math.sin(a), -Math.cos(a), true); }
    /* (the grid: every block in each cell its reach touches) */
    const grid = new Map();
    out.forEach((b, i) => { for (let cx = Math.floor((b.x - b.rad) / 2); cx <= Math.floor((b.x + b.rad) / 2); cx++) for (let cz = Math.floor((b.z - b.rad) / 2); cz <= Math.floor((b.z + b.rad) / 2); cz++) { const k = cx * 73856093 ^ cz * 19349663; let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); } });
    L.blocks = out; L.grid = grid; return L;
  }
  /* how high a block's top is over (x, z) (null if it isn't over it): the lowest of its upward faces' planes there, if
     that is above the highest of its downward ones */
  function blockTop(b, x, z) {
    let hi = 1e9, lo = -1e9;
    for (const w of b.W) {
      const r = w[3] - w[0] * x - w[2] * z;
      if (w[1] > 1e-6) hi = Math.min(hi, r / w[1]); else if (w[1] < -1e-6) lo = Math.max(lo, r / w[1]); else if (r < 0) return null;
    }
    return hi >= lo ? hi : null;
  }
  /* the highest block top under a foot at (x, z): sampled over its sole, so a crack between two blocks is stepped over */
  const SOLE = [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]];
  function blocksH(L, x, z) {
    let best = -9;
    for (const [dx, dz] of SOLE) {
      const c = L.grid.get(Math.floor((x + dx) / 2) * 73856093 ^ Math.floor((z + dz) / 2) * 19349663); if (!c) continue;
      for (const i of c) { const t = blockTop(L.blocks[i], x + dx, z + dz); if (t !== null && t > best) best = t; }
    }
    return best;
  }
  /* the reef under a point (coast coordinates): how high its rock stands there (−9 off it), the blocks or the ledge
     between them; and whether it is the walkable top (in reefOn) */
  let reefOn = false;
  function reefH(x, z) {
    reefOn = false; let best = -9;
    const RL = Co.reefsNear(x);
    for (let r = 0; r < RL.length; r++) {
      const L = reefLine(RL[r]), B = L.box; if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) continue;
      for (let i = 0; i < L.length - 1; i++) {
        const A = L[i], C = L[i + 1], ex = C.x - A.x, ez = C.z - A.z, ll = ex * ex + ez * ez, u = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / ll));
        const qx = A.x + ex * u, qz = A.z + ez * u, d2 = (x - qx) ** 2 + (z - qz) ** 2, w = A.w + (C.w - A.w) * u; if (d2 > 4 * w * w) continue;
        const v = Math.sqrt(d2) / w, hh = reefProf(A.h + (C.h - A.h) * u, v) - CORE + 0.05 * (vn(x * 1.7, 0.4, z * 1.7) - 0.5);
        if (hh > best) best = hh;
        if (v < 0.92 && (i > 0 || u > 0.3)) reefOn = true;
      }
      best = Math.max(best, blocksH(reefBlocks(L), x, z));
    }
    return best;
  }
  const land = (x, z) => Math.max(hill(x, z), massif(x, z), range(x, z), reefH(x, z));
  const slope = (x, z, e = 0.8) => Math.hypot(land(x + e, z) - land(x - e, z), land(x, z + e) - land(x, z - e)) / (2 * e);
  /* near a headland, the sand at its foot up to here is kept clear for the van */
  function nearHead(x, k = 2.6) {
    const HL = Co.near(x, x); for (let i = 0; i < HL.length; i++) { const h = HL[i]; if (Math.abs(x - h.hx) < h.w * k) return true; }
    return false;
  }
  const corrTop = x => Co.shoreZ(x) + 6.6;

  /* ── rocks: a noisy sphere cut by random planes into flat fractured faces, with creased normals; weathered into
     layers (strata, ledges a few centimetres deep), split by cracks, rough-grained, darker down in its cracks ── */
  const PAL = [[0.150, 0.138, 0.122], [0.092, 0.088, 0.084], [0.168, 0.116, 0.082], [0.128, 0.122, 0.112], [0.112, 0.104, 0.094]];
  function rockProto(seed, shape, detail, opt = {}) {
    const r = rng(seed), o = seed * 0.713;
    const src = new T.IcosahedronGeometry(1, detail), pa = src.attributes.position, map = new Map(), v = [], idx = [];
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      let id = map.get(k); if (id === undefined) { id = v.length / 3; map.set(k, id); v.push(x, y, z); } idx.push(id);
    }
    src.dispose();
    const planes = [], nCut = 7 + Math.floor(r() * 7);
    for (let i = 0; i < nCut; i++) {
      let x, y, z, l; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = Math.hypot(x, y, z); } while (l > 1 || l < 0.25);
      x /= l; y /= l; z /= l; if (y < -0.2) y = -y * 0.6; l = Math.hypot(x, y, z);
      planes.push([x / l, y / l, z / l, 0.5 + r() * 0.38]);
    }
    if (opt.top) { const a = r() * TAU, t = 0.12; planes.push([Math.cos(a) * t, Math.sqrt(1 - t * t), Math.sin(a) * t, opt.top]); }
    /* and chips knocked off its corners and edges: small faces where the block stood out furthest */
    for (let i = 0, nc = 6 + Math.floor(r() * 5); i < nc; i++) {
      let x, y, z, l; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = Math.hypot(x, y, z); } while (l > 1 || l < 0.25);
      planes.push([x / l, Math.abs(y / l), z / l, 0.8 + r() * 0.16]);
    }
    const nv = v.length / 3, aux = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      let x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
      const big = fbm(x * 1.1 + o, y * 1.1, z * 1.1 - o, 3), k = 0.86 + 0.32 * big; x *= k; y *= k; z *= k;
      for (const [px, py, pz, d] of planes) { const t = x * px + y * py + z * pz - d; if (t > 0) { x -= px * t * 0.96; y -= py * t * 0.96; z -= pz * t * 0.96; } }
      const det = fbm(x * 3.3 + 2.1, y * 3.3 - o, z * 3.3, 3), rid = 1 - Math.abs(2 * vn(x * 2.4 + o, y * 2.4, z * 2.4 + 5) - 1);
      /* cracks (sharp grooves along a ridged noise), the bedding's ledges, and a rough grain over everything */
      const cr = 1 - Math.abs(2 * vn(x * 4.6 - o, y * 4.6 + 3, z * 4.6) - 1), crack = Math.pow(cr, 12) + 0.5 * Math.pow(1 - Math.abs(2 * vn(x * 9 + o, y * 9, z * 9 - 2) - 1), 16);
      const sy = y * (opt.strata || 7) + 0.9 * fbm(x * 1.7 + o, y * 0.6, z * 1.7, 2), ledge = (sy - Math.floor(sy)), strat = 0.025 * (ledge < 0.18 ? ledge / 0.18 : 1) - 0.0125;
      const grain = fbm(x * 11 + o, y * 11, z * 11 - o, 2) - 0.5;
      const kk = 1 + (det - 0.5) * 0.13 - 0.07 * Math.pow(rid, 6) - 0.055 * crack + strat + 0.03 * grain;
      x *= kk * shape[0]; y *= kk * shape[1]; z *= kk * shape[2];
      const fl = -0.22 * shape[1]; if (y < fl) y = fl + (y - fl) * 0.2;      /* bedded in the sand */
      v[i * 3] = x; v[i * 3 + 1] = y; v[i * 3 + 2] = z; aux[i * 3] = big; aux[i * 3 + 1] = det; aux[i * 3 + 2] = Math.max(rid, Math.min(1, crack * 1.4));
    }
    const F = idx.length / 3, fn = new Float32Array(F * 3), fa = new Float32Array(F * 3), adj = Array.from({ length: nv }, () => []);
    for (let f = 0; f < F; f++) {
      const a = idx[f * 3], b = idx[f * 3 + 1], c = idx[f * 3 + 2], ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2];
      const ux = v[b * 3] - ax, uy = v[b * 3 + 1] - ay, uz = v[b * 3 + 2] - az, wx = v[c * 3] - ax, wy = v[c * 3 + 1] - ay, wz = v[c * 3 + 2] - az;
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
      fa[f * 3] = nx; fa[f * 3 + 1] = ny; fa[f * 3 + 2] = nz; fn[f * 3] = nx / l; fn[f * 3 + 1] = ny / l; fn[f * 3 + 2] = nz / l;
      adj[a].push(f); adj[b].push(f); adj[c].push(f);
    }
    const cosC = Math.cos(36 * Math.PI / 180), P = new Float32Array(F * 9), N = new Float32Array(F * 9), C = new Float32Array(F * 9);
    const pal = PAL[Math.floor(r() * PAL.length)], tone = 1.15 + r() * 0.3;
    for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
      const vi = idx[f * 3 + k], o3 = (f * 3 + k) * 3; let sx = 0, sy = 0, sz = 0;
      for (const g of adj[vi]) if (fn[g * 3] * fn[f * 3] + fn[g * 3 + 1] * fn[f * 3 + 1] + fn[g * 3 + 2] * fn[f * 3 + 2] > cosC) { sx += fa[g * 3]; sy += fa[g * 3 + 1]; sz += fa[g * 3 + 2]; }
      const l = Math.hypot(sx, sy, sz) || 1;
      P[o3] = v[vi * 3]; P[o3 + 1] = v[vi * 3 + 1]; P[o3 + 2] = v[vi * 3 + 2]; N[o3] = sx / l; N[o3 + 1] = sy / l; N[o3 + 2] = sz / l;
      const big = aux[vi * 3], det = aux[vi * 3 + 1], rid = aux[vi * 3 + 2], up = Math.max(0, N[o3 + 1]);
      const g = tone * (0.78 + 0.42 * big) * (1 - 0.5 * Math.pow(rid, 5)) * (1 - 0.3 * Math.max(0, 0.45 - det)) * (1 + 0.32 * up * up) * (1 + 0.06 * Math.sin(P[o3 + 1] * 9 / shape[1] + big * 5));
      C[o3] = pal[0] * g; C[o3 + 1] = pal[1] * g; C[o3 + 2] = pal[2] * g;
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.setAttribute('color', new T.BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    return { geo, shape };
  }
  const SMALL = [[1, 0.8, 1], [1.2, 0.62, 1.05], [0.9, 1.15, 0.85], [1.35, 0.52, 0.95], [1.05, 0.86, 1.15], [1.15, 0.66, 0.9]];
  const BIG = [[1.1, 0.95, 1], [1.3, 0.78, 1.1], [0.95, 1.4, 0.9], [1.4, 0.82, 1.2]];
  const protoOf = (R, p) => p.block ? p.block.proto : p.kind === 'stack' ? R.stack : p.kind === 'big' ? R.big[p.p % R.big.length] : R.small[p.p % R.small.length];

  /* where a headland's rocks go: big blocks on its face and boulders round its foot, none on the strip of sand the van
     drives round on; boulders in the surf off the point, and its sea stacks. Seeded by the headland, so they are the
     same whichever chunk asks first; the camp's own two points draw the numbers they always did, in the same order */
  const headPlans = new Map(), scrubPlans = new Map();
  function* headPlan(h) {
    const got = headPlans.get(h.i); if (got) return got;
    let r;
    if (h.i === -1 || h.i === 0) { r = rng(9091); if (h.i === 0) yield* headRocks(Co.cell(-1), r, null); }
    else r = rng(h.seed);
    const out = [];
    yield* headRocks(h, r, out);
    headPlans.set(h.i, out); return out;
  }
  function* scrubPlan(h) { const got = scrubPlans.get(h.i); if (got) return got; const out = yield* headScrub(h); scrubPlans.set(h.i, out); return out; }
  function* headRocks(h, r, out) {
    const add = (x, y, z, s, kind, extra) => { const p = Object.assign({ x, y, z, s, kind, p: Math.floor(r() * 64), ry: r() * TAU, tx: (r() - 0.5) * 0.3, tz: (r() - 0.5) * 0.3, sy: 1 }, extra); if (out) out.push(p); };
    const hx = h.hx, w = h.w, zt = ztOf(h), sz0 = Co.shoreZ(hx), kN = Math.min(1, w / 16);   /* (a small rocky point has fewer of everything) */
    for (let i = 0, n = 0; i < 2500 && n < Math.round(36 * kN); i++) {
      if (late()) yield;
      const x = hx + (r() - 0.5) * w * 4.2, z = zt - 6 + r() * 48, m = massif(x, z), fp = foot;
      if (m < 0.25 || m > 5 * h.ht || fp > 0.75 || r() > Math.exp(-Math.max(0, z - zt) / 15)) continue;
      const s = 1.5 + r() * 3.2; if (z - s * 1.15 < corrTop(x)) continue;
      add(x, Math.max(0, m) - 0.42 * s, z, s, 'big'); n++;
    }
    /* boulders where the rock meets the sand */
    for (let i = 0, n = 0; i < 4000 && n < Math.round(60 * kN); i++) {
      if (late()) yield;
      const x = hx + (r() - 0.5) * w * 4.6, z = zt - 6 + r() * 30, m = massif(x, z), fp = foot;
      if (m > 0.9 || fp < 0.004) continue;
      const near = Math.exp(-(((x - hx) / (w * 1.2)) ** 2)); if (r() > 0.2 + 0.8 * near) continue;
      const s = (r() < 0.25 ? 1.1 + r() * 1.3 : 0.32 + r() * 0.8) * (0.7 + 0.5 * near);
      if (z - s * 1.15 < corrTop(x) && s > 0.3) continue;
      add(x, -0.12 * s + Math.max(0, m) * 0.6, z, s, s > 1.35 ? 'big' : 'small'); n++;
    }
    /* boulders in the surf off the point, beyond the sand the van can reach */
    for (let i = 0, n = 0; i < 3000 && n < Math.round(34 * kN); i++) {
      if (late()) yield;
      const x = hx + (r() - 0.5) * w * 2.8, sz = Co.shoreZ(x), z = sz - 3.6 - Math.pow(r(), 1.4) * 15;
      const near = Math.exp(-(((x - hx) / w) ** 2)); if (r() > 0.25 + 0.75 * near) continue;
      const s = (r() < 0.3 ? 1.1 + r() * 1.2 : 0.4 + r() * 0.8) * (0.75 + 0.4 * near);
      if (z + s * 1.15 > sz - 3.2) continue;
      add(x, -0.3 * s, z, s, s > 1.35 ? 'big' : 'small'); n++;
    }
    /* the sea stacks: columns of rock standing off the point, each with a fallen block beside it */
    for (let k = 0; k < h.stacks; k++) {
      const sx = hx + (k ? (r() < 0.5 ? -1 : 1) * w * (0.6 + r() * 0.3) : (r() - 0.5) * w * 0.6), szs = sz0 - 10 - r() * 3 - k * 5, S = k ? 2.4 + r() * 0.6 : 3.3;
      add(sx, -0.9, szs, S, 'stack', { sy: k ? 1.7 : 2.0 }); add(sx + 3.0 * (S / 3.3), -0.5, szs + 1.4, 1.9 * S / 3.3, 'big'); add(sx - 2.2, -0.4, szs - 1.4, 1.2, 'small');
    }
  }
  /* scrub and a few palms on the headland's flatter tops */
  const crowded = (L, x, z, gap) => { for (let i = 0; i < L.length; i++) if ((L[i].x - x) ** 2 + (L[i].z - z) ** 2 < gap * gap) return true; return false; };
  function* headScrub(h) {
    const r = rng(h.seed + 77), zt = ztOf(h), out = { palm: [], tall: [], tree: [], bush: [], fern: [] };
    for (const [kind, n, gap] of [['bush', 70, 2.2], ['palm', 14, 3.5], ['tree', 16, 4.5], ['fern', 60, 1.0]]) {
      const L = out[kind];
      for (let i = 0, tries = 0; i < n && tries < n * 60; tries++) {
        if (late()) yield;
        const x = h.hx + (r() - 0.5) * h.w * 3.6, z = zt + 2 + r() * 40, m = massif(x, z);
        if (m < 2.0 || m < hill(x, z) || slope(x, z) > 0.45 || crowded(L, x, z, gap)) continue;
        L.push({ x, z, y: land(x, z), ry: r() * TAU, s: 0.8 + r() * 0.45, v: Math.floor(r() * 12) }); i++;
      }
    }
    return out;
  }
  /* surf rocks along the beach: clusters the waves break round. The camp's bay keeps the ones it always had, where they
     always were (the old repeating stretch's draws, replayed; only how each one is turned is drawn anew) */
  const BAY = [[-34, -2.6, 6], [24.5, -2.3, 4], [-52, -3.2, 5], [46, -2.2, 4], [-74, -2.4, 5], [74, -2.0, 6], [-98, -2.8, 4], [100, -2.4, 5]];
  let bayRocks = null;
  function bay() {
    if (bayRocks) return bayRocks;
    const r2 = rng(9092), r = rng(9094), old = [[-125, 16], [132, 17], [395, 13], [-385, 22]], wrapD = d => d - 1024 * Math.round(d / 1024);
    for (let x = 118; x < 1024 - 118;) { if (!old.some(([hx, w]) => Math.abs(wrapD(x - hx)) < w * 2.6)) { r2(); r2(); } x += 18 + r2() * 30; }
    bayRocks = [];
    for (const [cx, dz, n] of BAY) for (let i = 0; i < n; i++) {
      const x = cx + (r2() - 0.5) * (i ? 6 : 1), z = Co.shoreZ(x) + dz + (i ? (r2() - 0.5) * 2.6 : 0);
      const s = i ? 0.4 + r2() * 0.8 : 1.25 + r2() * 0.5, p = (i ? [0, 2, 4] : [0, 2, 3])[Math.floor(r2() * 3)];
      bayRocks.push({ x, y: i ? -0.16 * s : -0.2, z, s, kind: i ? 'small' : 'big', p, ry: r() * TAU, tx: (r() - 0.5) * 0.3, tz: (r() - 0.5) * 0.3, sy: 1 });
    }
    return bayRocks;
  }

  /* foam round rocks in the surf, and spray thrown up when a wave hits them; both timed to the real waves */
  const SURF_T = `
${GLSL.WAVEH}
/* seconds since the last crest reached this point, and how big it was */
vec2 lastHit(float x, float z){
  float g = shoreDZv(x), s0 = (shoreZv(x) - z)/sqrt(1.0 + g*g), s = max(s0, 0.0), t = uWaveT, tr = 99.0, A = 0.0;
  for (int j = 0; j < 6; j++){ vec4 W = uWv[j]; if (W.y <= 0.0) continue;
    float d = t - (W.x + 0.9*sin(x*0.11 + W.z) + x*0.03*W.w - s/WC); if (d > -0.05 && d < tr){ tr = d; A = W.y; } }
  for (int k = 0; k < ${GLSL.MAXUW}; k++){ if (k >= uNUw) break; vec4 U = uwAt(k); if (U.y <= 0.0) continue;
    float T0 = U.x - s/CU, d = t - T0, a = userAmp(U, x, T0);
    if (d > -0.05 && d < 4.0 && a > 0.04){ tr = d; A = max(A, 1.0 + 2.4*a); } }
  /* (a rock the tide has left high and dry takes no waves) */
  return vec2(tr, A*smoothstep(-0.3, 0.6, s0));
}
/* how much of a rock stands in the water just now (the tide comes and goes round it) */
float inSea(float x, float z){ float g = shoreDZv(x); return smoothstep(-0.3, 0.8, (shoreZv(x) - z)/sqrt(1.0 + g*g)); }`;
  const FOAM_VS = `
${SURF_T}
varying vec2 vUv; varying vec3 vW; varying vec2 vHit; varying float vSea;
void main(){ vUv = uv; vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.0), c = modelMatrix*instanceMatrix[3]; vSea = inSea(c.x, c.z);
  /* (riding on the water as it rises and falls, not at a height of its own, or every crest that passes cuts it off in a
     straight line) */
  w.y = waveH(w.xz) + 0.01; vW = w.xyz; vHit = lastHit(c.x, c.z);
  /* (and drawn a few centimetres nearer along the line of sight: the sea's mesh only follows the waves between its own points) */
  vec3 v = w.xyz - cameraPosition; float d = length(v);
  gl_Position = projectionMatrix*viewMatrix*vec4(w.xyz - v/max(d, 1e-3)*min(d*0.5, 0.06 + 0.0015*d), 1.0); }`;   /* (each ring is centred on its rock) */
  const FOAM_FS = `
uniform float uTime; uniform vec3 uAmbF, uKeyColT; uniform sampler2D uNoise; uniform vec4 uFog;
varying vec2 vUv; varying vec3 vW; varying vec2 vHit; varying float vSea;
void main(){
  if (vSea < 0.01) discard;
  vec2 q = vUv*2.0 - 1.0; float d = length(q);
  float surge = exp(-max(vHit.x, 0.0)*0.55)*min(vHit.y, 2.0);
  float ring = smoothstep(1.0, 0.7 - 0.25*surge, d)*smoothstep(0.30, 0.55, d);
  float n = texture2D(uNoise, vW.xz*0.33 + vec2(uTime*0.012, -uTime*0.008)).r*0.6 + texture2D(uNoise, vW.xz*1.1 - vec2(uTime*0.02, 0.0)).a*0.4;
  float a = ring*smoothstep(0.5 - 0.3*surge, 0.68, n)*(0.22 + 0.8*min(surge, 1.0))*vSea;
  if (a < 0.01) discard;
  float fd = distance(vW, cameraPosition);
  vec3 c = mix((uAmbF*1.6 + uKeyColT*0.55)*(0.85 + 0.3*n), uFog.rgb, 1.0 - exp(-max(fd - 40.0, 0.0)/(700.0/max(uFog.w, 0.3))));
  gl_FragColor = vec4(c, a*0.85);
}`;
  const SPRAY_VS = `
${SURF_T}
attribute vec4 aRock; attribute vec4 aSeed;
varying vec2 vUv; varying float vA; varying vec3 vWP; varying float vMist;
void main(){
  vUv = uv;
  float x = aRock.x, z = aRock.y, top = aRock.z, rad = aRock.w;
  vec2 hit = lastHit(x, z);
  float g = shoreDZv(x), s = max((shoreZv(x) - z)/sqrt(1.0 + g*g), 0.0);
  float nA = 0.5 + 0.24*sin(x*0.19 + 1.3) + 0.18*sin(x*0.071 + 0.4) + 0.12*sin(x*0.53 + 2.0), sb = 3.0 + 7.0*nA*hit.y;
  float k = hit.y*(0.45 + 0.55*smoothstep(sb + 7.0, sb - 1.0, s));
  float life = 0.8 + 0.9*aSeed.z, tt = hit.x - aSeed.w*0.3;
  float on = step(0.0, tt)*step(tt, life), sk = sqrt(max(k, 0.0));
  vec3 dir = normalize(vec3(-g, 0.0, 1.0)), side = vec3(dir.z, 0.0, -dir.x);
  float lat = aSeed.y*2.0 - 1.0;
  vec3 p0 = vec3(x, top*(0.3 + 0.55*aSeed.x), z) - dir*rad*0.7 + side*lat*rad*0.75;
  vec3 vel = vec3(0.0, (1.6 + 3.8*aSeed.x)*sk, 0.0) + dir*(0.5 + 1.8*aSeed.z)*sk + side*lat*1.5*sk;
  vec3 c = p0 + vel*tt + vec3(0.0, -4.9*tt*tt, 0.0);
  float mist = step(0.83, fract(aSeed.w*7.13)); vMist = mist;
  c.y += mist*0.9*tt*tt;                                   /* mist is carried, droplets fall */
  float u = clamp(tt/(life*(1.0 + 0.8*mist)), 0.0, 1.0);
  float size = mix(0.035 + 0.06*aSeed.x + 0.03*u, (0.3 + 1.1*u)*rad*0.75, mist)*(0.7 + 0.3*min(k, 2.5));
  vA = on*mix(1.0 - u*u, 0.5*(1.0 - u)*(1.0 - u), mist)*min(k, 1.0)*smoothstep(-0.4, 0.15, c.y);
  /* droplets are drawn as short streaks along their motion, as a camera would see them */
  vec3 vNow = mat3(viewMatrix)*(vel + vec3(0.0, (mist*1.8 - 9.8)*tt, 0.0));
  float L = length(vNow.xy); vec2 ax = L > 1e-4 ? vNow.xy/L : vec2(0.0, 1.0), ay = vec2(-ax.y, ax.x);
  float streak = 1.0 + (1.0 - mist)*L*0.045/size;
  vec2 q = uv - 0.5;
  vec4 mv = viewMatrix*vec4(c, 1.0); mv.xy += ax*q.y*size*streak + ay*q.x*size; vWP = c;
  gl_Position = vA < 0.003 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
}`;
  const SPRAY_FS = `
uniform vec3 uAmbF, uKeyColT; uniform sampler2D uNoise; uniform vec4 uFog;
varying vec2 vUv; varying float vA; varying vec3 vWP; varying float vMist;
void main(){
  vec2 q = vUv*2.0 - 1.0; float d = dot(q, q); if (d > 1.0) discard;
  float n = texture2D(uNoise, vUv*0.45 + vWP.xz*0.05).r;
  float a = vA*mix(smoothstep(1.0, 0.15, d), (1.0 - d)*(1.0 - d)*(0.35 + 0.9*n), vMist);
  if (a < 0.004) discard;
  float fd = distance(vWP, cameraPosition);
  vec3 c = mix(uAmbF*1.8 + uKeyColT*0.65, uFog.rgb, 1.0 - exp(-max(fd - 40.0, 0.0)/(700.0/max(uFog.w, 0.3))));
  gl_FragColor = vec4(c, a*0.8);
}`;

  /* ── grids along the coast: x positions with every chunk boundary on them, finer near the headlands ── */
  function axis(spans) { const out = []; for (const [a, b, s] of spans) for (let v = a; v < b - 1e-6; v += s) out.push(v); out.push(spans[spans.length - 1][1]); return out; }
  function xAxis(c, stepNear, stepFar, nearK) {
    const a = X0 + c * CW, b = a + CW, out = [];
    for (let x = a; x < b - 1e-6;) { out.push(x); x = Math.min(b, x + (nearK && nearHead(x, nearK) ? stepNear : stepFar)); }
    out.push(b); return out;
  }
  /* chunk c's columns, plus one more on each side from the neighbouring chunks, so normals at the edges come out as
     the neighbour computes them and the chunks join without a crease */
  function cols(c, sn, sf, k) { const xs = xAxis(c, sn, sf, k), a = xAxis(c - 1, sn, sf, k), b = xAxis(c + 1, sn, sf, k); return [a[a.length - 2], ...xs, b[1]]; }
  /* an indexed grid of nx × nz points (x fastest): normals across neighbouring points, drawn without the outer columns
     (they belong to the neighbours) and without the cells keep() rejects */
  function* grid(Pa, nx, nz, keep) {
    const N = new Float32Array(Pa.length);
    for (let j = 0; j < nz; j++) {
      const j0 = Math.max(0, j - 1) * nx, j1 = Math.min(nz - 1, j + 1) * nx;
      for (let i = 0; i < nx; i++) {
        const a = (j * nx + Math.max(0, i - 1)) * 3, b = (j * nx + Math.min(nx - 1, i + 1)) * 3, c = (j0 + i) * 3, d = (j1 + i) * 3;
        const ux = Pa[b] - Pa[a], uy = Pa[b + 1] - Pa[a + 1], uz = Pa[b + 2] - Pa[a + 2], vx = Pa[d] - Pa[c], vy = Pa[d + 1] - Pa[c + 1], vz = Pa[d + 2] - Pa[c + 2];
        const x = vy * uz - vz * uy, y = vz * ux - vx * uz, z = vx * uy - vy * ux, l = Math.hypot(x, y, z) || 1, k = (j * nx + i) * 3;
        N[k] = x / l; N[k + 1] = y / l; N[k + 2] = z / l;
      }
      if (late()) yield;
    }
    const idx = new (nx * nz > 65535 ? Uint32Array : Uint16Array)((nz - 1) * Math.max(0, nx - 3) * 6); let n = 0;
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 1; i < nx - 2; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; if (!keep || keep(a, b, c, d)) { idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d; } }
      if (late()) yield;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(Pa, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setIndex(new T.BufferAttribute(idx.subarray(0, n), 1));
    return g;
  }

  /* ── ground beyond the sand: hills and headlands, fine where the rock is ── */
  const TZ = axis([[-36, 30, 1], [30, 70, 2.5], [70, 340, 6], [340, 1100, 16]]), TZc = axis([[-36, 30, 2], [30, 70, 5], [70, 340, 12], [340, 1100, 32]]);   /* (and far away) */
  function* terrain(c, coarse, o, mat) {
    const TZ_ = coarse ? TZc : TZ, xs = coarse ? cols(c, 3, 8, 3.4) : cols(c, 1, 4, 3.4), nx = xs.length, nz = TZ_.length, NV = nx * nz;
    const Pa = new Float32Array(NV * 3), MS = new Float32Array(NV), HL = new Float32Array(NV);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = xs[i], z = TZ_[j], hl = Math.max(hill(x, z), range(x, z)), m = massif(x, z);
        /* sunk a little, so it rises out of the sand along a clean line instead of lying flush with it */
        /* (far off, what is under water is pushed well down, so it can't flicker through the sea at the depth buffer's coarse range) */
        Pa[k * 3] = x - o.x; Pa[k * 3 + 1] = Math.max(coarse ? -2.5 : -0.6, Math.max(hl, m) - 0.22); Pa[k * 3 + 2] = z - o.z; MS[k] = m; HL[k] = hl;
        if (late()) yield;
      }
    }
    const g = yield* grid(Pa, nx, nz, (a, b, cc, d) => !(Pa[a * 3 + 1] < 0 && Pa[b * 3 + 1] < 0 && Pa[cc * 3 + 1] < 0 && Pa[d * 3 + 1] < 0));
    const N = g.attributes.normal.array, C = new Float32Array(NV * 3), RK = new Float32Array(NV);
    for (let k = 0; k < NV; k++) {
      const x = Pa[k * 3] + o.x, z = Pa[k * 3 + 2] + o.z, ny = N[k * 3 + 1], m = MS[k];
      const onM = m > 0.08 && m >= HL[k] - 0.3 ? 1 : 0;
      let rock = Math.min(1, onM * (0.5 + 3.0 * (1 - ny)) + sm(0.74, 0.5, ny));
      if (onM && m > 2.4 && ny > 0.9) rock *= 0.3;
      const n = fbmX(x, z, 0.08, 0.5, 3), n2 = fbmX(x, z, 0.25, 3.0, 2), a = 0.7 + 0.6 * n, b = 0.7 + 0.6 * n2;
      C[k * 3] = L(0.024 * a, 0.14 * b, rock); C[k * 3 + 1] = L(0.042 * a, 0.128 * b, rock); C[k * 3 + 2] = L(0.017 * (0.75 + 0.5 * n), 0.112 * b, rock);
      RK[k] = rock;
      if (late()) yield;
    }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('aRock', new T.BufferAttribute(RK, 1));
    g.computeBoundingSphere();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; return m;
  }

  /* the canopy: a blanket of tree crowns over the hills behind the front rows of real trees.
     By the camp it stands back to leave the clearing; elsewhere it comes down to the forest edge */
  const DEEP = 1000;   /* how far inland the forest goes (over the mountains) */
  const DS = axis([[0, 50, 2], [50, 130, 4], [130, 420, 10], [420, DEEP, 16]]), DSc = axis([[0, 50, 4], [50, 130, 8], [130, 420, 20], [420, DEEP, 32]]);
  /* how far behind the forest edge the canopy begins (further by the camp) */
  const D0 = (x, campX) => 13 + 7 * vnX(x, 0, 0.045, 1.5) + 0.9 * Co.head(x) + 8 * (1 - sm(22, 36, Math.abs(x - campX)));
  function* canopy(c, coarse, o, mat) {
    const DS_ = coarse ? DSc : DS, xs = coarse ? cols(c, 4, 4, 0) : cols(c, 2, 2, 0), nx = xs.length, nd = DS_.length, Pa = new Float32Array(nx * nd * 3), C = new Float32Array(nx * nd * 3);
    const campX = Layout.camp.x + o.x;
    for (let i = 0; i < nx; i++) {
      const x = xs[i], z0 = Co.vegZ(x) + D0(x, campX);
      for (let j = 0; j < nd; j++) {
        const d = DS_[j], z = z0 + d, k = (j * nx + i) * 3, bse = land(x, z);
        const ramp = sm(0, 10, d) * sm(DEEP, DEEP - 40, d), far = sm(70, 200, d);
        /* (its crowns are drawn by its shader, mats.js CANOPY, each a dome of its own green with shade between: the blanket
           itself only rises and falls with the stands of forest, its greens changing from one stand to the next) */
        const hc = (6 + 5 * fbmX(x, z, 0.017, 3.3, 3)) * ramp, st = fbmX(x, z, 0.011, 6.1, 3), st2 = fbmX(x, z, 0.04, 8.3, 2);
        /* (it lies a little below the crowns' middles, so most of each crown stands out of it, and is the shade under them) */
        Pa[k] = x - o.x; Pa[k + 1] = bse + 0.15 + hc * 0.74 + 1.2 * (st2 - 0.5) * ramp; Pa[k + 2] = z - o.z;
        const lum = 0.74 * (0.8 + 0.4 * st2) * (0.6 + 0.4 * ramp) * (1 - 0.15 * far), hue = st;
        C[k] = (0.028 + 0.022 * hue) * lum; C[k + 1] = (0.062 + 0.018 * st2) * lum; C[k + 2] = (0.022 + 0.012 * (1 - hue)) * lum;
        if (late()) yield;
      }
    }
    const g = yield* grid(Pa, nx, nd); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.computeBoundingSphere();
    return new T.Mesh(g, mat);
  }

  /* the canopy's trees: a crown (Trees.crownMaterial: a picture that turns to face the eye) for every tree whose crown
     makes the canopy, on a jittered grid of their own over the hills behind the front rows, each its own size, shape and
     green, now and then one in flower or in new bronze leaf. They stand in the canopy, a third of each above it, so the
     hills' skyline is crowns. Far off, every other one, a little bigger. The grid is drawn from hashes of its cells, so
     the crowns are the same whichever chunk builds first */
  const CROWN_G = [[5.6, 3, 420, 500], [12, 420, DEEP, 520]];     /* [cell, from and to how deep, hash salt]: near the shore, and over the mountains */
  const GREENS = [[0.036, 0.074, 0.025], [0.045, 0.086, 0.028], [0.058, 0.094, 0.032], [0.032, 0.066, 0.036], [0.054, 0.074, 0.03], [0.042, 0.08, 0.031], [0.03, 0.058, 0.026]];
  function* crowns(c, coarse, o, mat, quad) {
    const X0c = X0 + c * CW, campX = Layout.camp.x + o.x, out = [];
    for (const [g, dA, dB, H] of CROWN_G) for (let gx = Math.floor(X0c / g) - 1, gx1 = Math.floor((X0c + CW) / g); gx <= gx1; gx++) for (let gd = Math.floor(dA / g); gd * g < dB; gd++) {
      if (late()) yield;
      if (coarse && hash3(gx, gd, H + 1) > 0.5) continue;
      const x = (gx + 0.12 + 0.76 * hash3(gx, gd, H + 2)) * g; if (x < X0c || x >= X0c + CW) continue;
      const d = (gd + 0.12 + 0.76 * hash3(gx, gd, H + 3)) * g; if (d < dA || d >= dB) continue;
      const ramp = sm(0, 10, d) * sm(DEEP, DEEP - 40, d); if (ramp < 0.3) continue;
      const z = Co.vegZ(x) + D0(x, campX) + d, m = massif(x, z), hl = Math.max(hill(x, z), range(x, z));
      if (m > hl + 0.5 && slope(x, z) > 0.75) continue;      /* (bare rock) */
      const pic = Math.floor(hash3(gx, gd, H + 5) * 8), w = g * (0.85 + 0.6 * hash3(gx, gd, H + 4) + (hash3(gx, gd, H + 11) < 0.06 ? 0.7 : 0)) * (coarse ? 1.3 : 1), h = w * (pic >= 4 && pic < 6 ? 1.15 : pic === 6 ? 0.7 : 0.9);
      const y = Math.max(hl, m) + 0.15 + (6 + 5 * fbmX(x, z, 0.017, 3.3, 3)) * ramp + 0.35 + h * 0.06;
      const k = hash3(gx, gd, H + 6);
      let col = GREENS[Math.floor(hash3(gx, gd, H + 9) * GREENS.length)];
      if (k < 0.004) col = [0.2, 0.06, 0.026];             /* a flame of the forest in flower */
      else if (k < 0.0065) col = [0.16, 0.13, 0.032];       /* a golden shower */
      else if (k < 0.022) col = [0.07, 0.06, 0.03];         /* in new, bronze leaf */
      else if (k < 0.045) col = [0.06, 0.08, 0.058];        /* a silvery one */
      const lk = 0.85 + 0.35 * hash3(gx, gd, H + 10);
      out.push(x - o.x, y, z - o.z, w, h, pic, hash3(gx, gd, H + 7), 0.04 + 0.06 * hash3(gx, gd, H + 8), col[0] * lk, col[1] * lk, col[2] * lk);
    }
    const n = out.length / 11; if (!n) return null;
    const geo = new T.InstancedBufferGeometry(), aP = new Float32Array(n * 4), aQ = new Float32Array(n * 4), aC = new Float32Array(n * 3);
    geo.setIndex(quad.index.clone()); geo.setAttribute('position', quad.attributes.position.clone()); geo.setAttribute('uv', quad.attributes.uv.clone());
    const ctr = new T.Vector3(); let rad = 0;
    for (let i = 0; i < n; i++) { const b = i * 11; aP.set([out[b], out[b + 1], out[b + 2], out[b + 3]], i * 4); aQ.set([out[b + 4], out[b + 5], out[b + 6], out[b + 7]], i * 4); aC.set([out[b + 8], out[b + 9], out[b + 10]], i * 3); ctr.x += out[b]; ctr.y += out[b + 1]; ctr.z += out[b + 2]; }
    ctr.multiplyScalar(1 / n);
    for (let i = 0; i < n; i++) { const b = i * 11; rad = Math.max(rad, Math.hypot(out[b] - ctr.x, out[b + 1] - ctr.y, out[b + 2] - ctr.z) + out[b + 3]); }
    geo.setAttribute('aP', new T.InstancedBufferAttribute(aP, 4)); geo.setAttribute('aQ', new T.InstancedBufferAttribute(aQ, 4)); geo.setAttribute('aC', new T.InstancedBufferAttribute(aC, 3));
    geo.instanceCount = n; geo.boundingSphere = new T.Sphere(ctr, rad);
    return new T.Mesh(geo, mat);
  }

  /* ── the front rows of the forest: merged prototypes of palms, broadleaf trees, bushes and ferns ── */
  function merge(parts) {
    let nv = 0, ni = 0, col = false; for (const { g } of parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; if (g.attributes.color) col = true; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new Uint32Array(ni), CO = col ? new Float32Array(nv * 3).fill(1) : null;
    let ov = 0, oi = 0; const v = new T.Vector3(), nm = new T.Matrix3();
    for (const { g, m } of parts) {
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ca = g.attributes.color; nm.getNormalMatrix(m);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(ov + i) * 3] = v.x; P[(ov + i) * 3 + 1] = v.y; P[(ov + i) * 3 + 2] = v.z;
        if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(ov + i) * 3] = v.x; N[(ov + i) * 3 + 1] = v.y; N[(ov + i) * 3 + 2] = v.z; }
        if (ua) { UV[(ov + i) * 2] = ua.getX(i); UV[(ov + i) * 2 + 1] = ua.getY(i); }
        if (CO && ca) { CO[(ov + i) * 3] = ca.getX(i); CO[(ov + i) * 3 + 1] = ca.getY(i); CO[(ov + i) * 3 + 2] = ca.getZ(i); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < pa.count; i++) I[oi + i] = ov + i;
      ov += pa.count; oi += g.index ? g.index.count : pa.count;
    }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(UV, 2)); out.setIndex(new T.BufferAttribute(I, 1));
    if (CO) out.setAttribute('color', new T.BufferAttribute(CO, 3));
    out.computeBoundingSphere(); return out;
  }
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new T.Vector3(s, s, s));

  /* a coconut palm: each shape its own height, lean (now and then a long curve out over the sand), crown, how its
     fronds hang, how many dead ones hang below them */
  /* (the fibrous boot under a palm's crown, where the old frond bases wrap the trunk; drawn with the bark) */
  const bootGeo = (() => { const g = new T.CylinderGeometry(0.17, 0.25, 0.6, 10, 1, true), n = g.attributes.position.count; g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(0.62), 3)); return g; })();
  function palmProto(seed, tall, lite) {
    const r = rng(seed), h = tall ? 10.5 + r() * 4.5 : 5.8 + r() * 5.2, bend = r() < 0.3 ? 1.9 : 0.6 + 0.6 * r(), lx = (r() - 0.5) * (tall ? 3.2 : 2.4) * bend, lz = (r() - 0.5) * (tall ? 3.2 : 2.4) * bend, cr = (tall ? 2.5 : 2.7) + r() * 1.0;
    const droopK = 0.7 + 0.65 * r(), nDry = Math.floor(r() * r() * 5.5);
    const curve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(lx * 0.1, h * 0.34, lz * 0.1), new T.Vector3(lx * 0.48, h * 0.7, lz * 0.48), new T.Vector3(lx, h, lz)]);
    const bark = [{ g: Nature.palmTrunk(curve, { r0: 0.2 + 0.03 * r(), rTop: 0.135 + 0.02 * r(), bole: 0.1 + 0.05 * r(), seed, segs: lite ? 8 : 20, radial: lite ? 6 : 12, roots: lite ? 0 : 14, rootSegs: 3, rootRadial: 4 }), m: M() }];
    if (!lite) bark.push({ g: bootGeo, m: M(lx, h - 0.22, lz) });
    const fA = [], fB = [], dry = [];
    const nf = 13 + Math.floor(r() * 10);
    /* far away: every other frond, a little wider, in fewer segments, all on one texture (same draws, so it matches up close) */
    for (let i = 0; i < nf; i++) {
      const az = i * 2.39996 + r() * 0.2, age = i / nf, rise = 1.1 - age * 1.3, droop = (0.38 + age * 0.7 + r() * 0.15) * droopK;   /* (arching out and over, as the camp's do) */
      const len = cr * (0.72 + 0.32 * Math.sin(Math.PI * Math.min(1, age * 1.2 + 0.15)));
      const side = r() < 0.5 ? fA : fB, wd = 1.35 + r() * 0.35, m = M(lx, h + 0.05 - age * 0.25, lz, (r() - 0.5) * 0.5, az, 0);
      if (!lite) side.push({ g: Nature.frondGeo(len, wd, rise, droop, 7), m });
      else if (i % 2 === 0) fA.push({ g: Nature.frondGeo(len, wd * 1.3, rise, droop, 4), m });
    }
    if (!lite) for (let i = 0; i < nDry; i++) dry.push({ g: Nature.frondGeo(cr * (0.5 + 0.35 * r()), 0.9 + 0.2 * r(), -0.3 - 0.5 * r(), 0.9 + 0.6 * r(), 6), m: M(lx, h - 0.3 - 0.35 * r(), lz, (r() - 0.5) * 0.3, r() * TAU, 0) });
    return lite ? { bark: merge(bark), fA: merge(fA) } : { bark: merge(bark), fA: merge(fA), fB: merge(fB), dry: merge(dry) };
  }
  /* ── the broadleaf trees, the bushes and the scrub are grown (trees.js): tropical almonds, casuarinas and beach
     hibiscus, sea grape, low leafy scrub; far off, the same trees with fewer, bigger leaf cards and no twigs. Each
     shape carries its own materials ── */
  function grown(kind, seed, lite) {
    const g = Trees.grow(kind, seed, lite), m = Trees.materials(kind);
    g.mats = { bark: m.bark, c0: m.leaves[0], c1: m.leaves[1], c2: m.leaves[2] }; return g;
  }

  /* ── the forest's front rows, scattered on a jittered grid a cell at a time from hashes of the cell, so a chunk's
     trees never depend on what was built before it. Each kind keeps its spacing: of two neighbours of a kind that
     stand too close, the one with the lower draw gives way. Denser at the forest edge, thinning into the hills ── */
  /* [kind, how many the old bay held per 470 m, from and to how deep into the forest, spacing, grid cell as a share of it] */
  const SPEC = [['palm', 300, 0.3, 24, 3.0, 0.8], ['tall', 60, 8, 40, 7, 0.8], ['tree', 520, 3, 42, 4.2, 0.7], ['bush', 640, 0.1, 26, 2.0, 0.8], ['fern', 900, 0.0, 16, 0.9, 0.8]];
  const KINDS = SPEC.map(s => s[0]);
  /* how likely a grid cell is to hold a candidate, at a fraction t of the way into the band: the old scatter's density
     (heavier at the front), allowing for the share that gives way to a neighbour */
  const presence = (sp, t) => {
    const [, n, d0, d1, gap, gk] = sp, g = gap * gk, want = n / (470 * (d1 - d0)) * 0.769 * Math.pow(Math.max(t, 0.02), -0.231) * g * g;
    let q = want; for (let i = 0; i < 4; i++) q = Math.min(0.64, want * Math.exp(q * Math.PI / 2));
    return q;
  };
  /* each kind's grid: its cell size, how many rows deep, and the odds of a candidate in each row */
  const GRID = SPEC.map(sp => { const g = sp[4] * sp[5], nd = Math.ceil((sp[3] - sp[2]) / g); return { g, nd, d0: sp[2], q: Array.from({ length: nd }, (_, gd) => presence(sp, (gd + 0.5) / nd)) }; });
  /* the coast's stretches, each a few hundred metres long and never the same twice (slow noise along the coast):
     palm groves and stretches with hardly a palm, belts of casuarina, open sand with the forest standing back, scrub.
     How much more (or less) of kind ki grows at x; the camp's own bay is left as it always was */
  const zoneAt = x => { const k = sm(160, 330, Math.abs(x - Layout.camp.x - Layout.O.x));
    return { k, palm: 0.2 + 1.6 * sm(0.3, 0.7, vnX(x, 0, 1 / 230, 21)), cas: sm(0.5, 0.74, vnX(x, 0, 1 / 380, 37)), open: sm(0.6, 0.78, vnX(x, 0, 1 / 170, 53)), al: vnX(x, 0, 1 / 290, 44) }; };
  function zoneK(ki, x) {
    const Z = zoneAt(x); if (Z.k <= 0) return 1;
    const f = [Z.palm * (1 - 0.8 * Z.open), (0.35 + 0.7 * Z.palm) * (1 - 0.6 * Z.open), (0.7 + 0.7 * Z.cas) * (1 - 0.55 * Z.open), (1.6 - 0.55 * Z.palm) * (1 - 0.6 * Z.open), 1 - 0.45 * Z.open][ki];
    return 1 + (f - 1) * Z.k;
  }
  /* which of the trees' shapes (world.js TREES: almond, casuarina, hibiscus, casuarina, almond, hibiscus) grows at x,
     for a draw u: in a casuarina belt mostly casuarinas, elsewhere almonds and hibiscus as the stretch has them */
  const TREE_V = { almond: [0, 4], casuarina: [1, 3], hibiscus: [2, 5] };
  function treeShape(x, u, u2) {
    const Z = zoneAt(x), pc = 1 / 3 + (0.08 + 0.8 * Z.cas - 1 / 3) * Z.k, pa = (1 - pc) * (0.5 + (Z.al - 0.5) * 1.6 * Z.k);
    const sp = u < pc ? 'casuarina' : u < pc + pa ? 'almond' : 'hibiscus';
    return TREE_V[sp][u2 < 0.5 ? 0 : 1];
  }
  /* the candidate of kind ki in grid cell (gx, gd), if it has one: [x, depth, its draw] */
  const cand = [0, 0, 0];
  function candidate(ki, gx, gd) {
    const G = GRID[ki];
    if (gd < 0 || gd >= G.nd || hash3(gx, gd, ki * 8) >= Math.min(0.9, G.q[gd] * zoneK(ki, (gx + 0.5) * G.g))) return null;
    cand[0] = (gx + hash3(gx, gd, ki * 8 + 1)) * G.g; cand[1] = G.d0 + (gd + hash3(gx, gd, ki * 8 + 2)) * G.g; cand[2] = hash3(gx, gd, ki * 8 + 3);
    return cand;
  }
  function* forestPlan(X0c, ok, out) {
    for (let ki = 0; ki < SPEC.length; ki++) {
      const kind = SPEC[ki][0], { g, nd } = GRID[ki], L = out[kind];
      let tested = 0;
      for (let gx = Math.floor(X0c / g) - 1, gx1 = Math.floor((X0c + CW) / g); gx <= gx1; gx++) for (let gd = 0; gd < nd; gd++) {
        const c0 = candidate(ki, gx, gd); if (!c0) continue;
        const x = c0[0], dep = c0[1], pr = c0[2];
        if (x < X0c || x >= X0c + CW) continue;
        let gives = false;
        for (let i = -1; i <= 1 && !gives; i++) for (let j = -1; j <= 1; j++) {
          if (!i && !j) continue; const o = candidate(ki, gx + i, gd + j);
          if (o && o[2] > pr && (o[0] - x) ** 2 + (o[1] - dep) ** 2 < g * g) { gives = true; break; }
        }
        if (gives) continue;
        if (late()) yield;
        const z = Co.vegZ(x) + dep;
        if (!ok(x, z)) continue;
        const k = ki * 8 + 4;
        const v = kind === 'tree' ? treeShape(x, hash3(gx, gd, k + 3), hash3(gx, gd, k + 2)) : Math.floor(hash3(gx, gd, k + 2) * 12);
        L.push({ x, z, y: land(x, z), ry: hash3(gx, gd, k) * TAU, s: 0.8 + 0.45 * hash3(gx, gd, k + 1), v, tint: hash3(gx, gd, k + 5) });
      }
      yield;
    }
  }

  /* a reef's core as a mesh: the ledge under its blocks, filling between them (low, dark, mostly in their shadow): rows
     along its line, out to sea; across each, from one flank over the top to the other */
  function reefGeo(L, o) {
    const NC = 17, nr = L.length, P = new Float32Array(nr * NC * 3), Cc = new Float32Array(nr * NC * 3), RK = new Float32Array(nr * NC).fill(1), idx = [];
    for (let i = 0; i < nr; i++) {
      const p = L[i];
      for (let j = 0; j < NC; j++) {
        const v = (j / (NC - 1) * 2 - 1) * 1.7, x = p.x + L.px * v * p.w, z = p.z + L.pz * v * p.w;
        let y = reefProf(p.h, v) - CORE + 0.09 * (vn(x * 1.7, 0.4, z * 1.7) - 0.5) + 0.04 * (vn(x * 5.1, 1.9, z * 5.1) - 0.5);
        if (i === 0) y = Math.min(y, -0.35);                  /* (its end buried in the sand) */
        const k = (i * NC + j) * 3; P[k] = x - o.x; P[k + 1] = Math.max(y, -1.7); P[k + 2] = z - o.z;
        const tone = 0.55 * (0.82 + 0.4 * fbm(x * 0.6, 3.3, z * 0.6, 2));
        Cc[k] = 0.15 * tone; Cc[k + 1] = 0.136 * tone; Cc[k + 2] = 0.118 * tone;
      }
    }
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < NC - 1; j++) { const a = i * NC + j, b = a + 1, c = a + NC, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3)); g.setAttribute('aRock', new T.BufferAttribute(RK, 1));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }

  /* ── the coast, chunk by chunk ── */
  function build(root, U, noiseTex) {
    /* rocks: a few shapes, shared by every chunk, and the same in fewer facets for further off */
    const R = { small: SMALL.map((sh, i) => rockProto(31 + i * 17, sh, 6)), big: BIG.map((sh, i) => rockProto(301 + i * 23, sh, 8)), stack: rockProto(777, [1.2, 1.0, 1.1], 10, { top: 0.6, strata: 11 }) };
    const far = new Map([...R.small.map((p, i) => [p, rockProto(31 + i * 17, SMALL[i], 2)]), ...R.big.map((p, i) => [p, rockProto(301 + i * 23, BIG[i], 3)]), [R.stack, rockProto(777, [1.2, 1.0, 1.1], 3, { top: 0.6, strata: 11 })]]);
    const rockMat = Mats.lit({ vertexColors: true, roughness: 0.86 }, 'rockw'), landMat = Mats.lit({ vertexColors: true, roughness: 0.95 }, 'land'), canMat = Mats.lit({ vertexColors: true, roughness: 0.92 }, 'canopy');
    const reefMat = Mats.lit({ vertexColors: true, roughness: 0.93 }, 'reef');
    /* foam round rocks in the water and the spray they throw up */
    const surfU = Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uFog: Mats.U.uFog, uNoise: { value: noiseTex } }, Mats.coastU);
    const foamM = new T.ShaderMaterial({ uniforms: surfU, vertexShader: FOAM_VS, fragmentShader: FOAM_FS, transparent: true, depthWrite: false });
    const sprayM = new T.ShaderMaterial({ uniforms: surfU, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false });
    const ring = new T.PlaneGeometry(1, 1); ring.rotateX(-Math.PI / 2);
    const quad = new T.PlaneGeometry(1, 1), NP = 48;
    const crownMat = Trees.crownMaterial(U);
    /* the forest: shapes near and far, and their materials */
    const frondT = [Mats.tex(Paint.frond(31)), Mats.tex(Paint.frond(47)), Mats.tex(Paint.frond(59, 1))].map(t => Mats.foliage(t, 0.4, [1, 1, 1], true));
    const barkP = Trees.palmBarkMat();
    /* the crowns' greens: a lighter top, two in the ring round it; the bushes' and the low scrub's their own */
    const TREES = [['almond', 51], ['casuarina', 67], ['hibiscus', 89], ['casuarina', 131], ['almond', 157], ['hibiscus', 173]];
    const PALMS = [11, 23, 37, 71, 97, 113], TALL = [43, 61, 83];
    const Pr = { palm: PALMS.map(s => palmProto(s)), tall: TALL.map(s => palmProto(s, true)), tree: TREES.map(([k, s]) => grown(k, s)),
      bush: [13, 29, 41].map(s => grown('grape', s)), fern: [5, 7, 19].map(s => grown('scrub', s)) };
    const lite = { tree: TREES.map(([k, s]) => grown(k, s, true)), palm: PALMS.map(s => palmProto(s, false, true)), tall: TALL.map(s => palmProto(s, true, true)) };
    const leafParts = [['bark', null], ['c0', null], ['c1', null], ['c2', null]];
    const parts = { palm: [['bark', barkP], ['fA', frondT[0]], ['fB', frondT[1]], ['dry', frondT[2]]], tree: leafParts, bush: leafParts, fern: leafParts };
    parts.tall = parts.palm;
    const farParts = { palm: [['bark', barkP], ['fA', frondT[0]]], tall: [['bark', barkP], ['fA', frondT[0]]], tree: leafParts };

    const worldG = new T.Group(); worldG.name = 'world'; worldG.matrixAutoUpdate = false; root.add(worldG);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3(), tint = new T.Color();
    /* where the world sits on the coast (Layout.O), as it was when these chunks were built */
    const o = { x: Layout.O.x, z: Layout.O.z }; let ver = Layout.coastVer;
    const chunks = new Map(), live = [], hooks = { place: [], tiny: [], near: [], far: [] };
    const stat = { worst: 0, worstAt: '', steps: 0, long: 0, built: 0, dropped: 0 };
    const campC = () => Math.floor((Layout.camp.x + o.x - X0) / CW);

    /* the forest's clearing round the camp, in the world's coordinates */
    const clear = (x, z) => (Math.abs(x) < 17 && z < 30) || (Math.abs(x - Layout.camp.x) < 10 && z < Layout.vegZ(x) + 6);
    const claimed = (ch, x, z) => { for (const [cx, cz, r] of ch.claims) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; return false; };

    /* a chunk: its groups for each level of detail, what it holds, what the van must drive round, the rocks in the water */
    function chunk(c) {
      const x0 = X0 + c * CW - o.x, ch = { c, X0: X0 + c * CW, x0, x1: x0 + CW, camp: Layout.camp.x >= x0 && Layout.camp.x < x0 + CW, seed: 1 + Math.floor(Co.hash(c, 31) * 1e9),
        root: new T.Group(), g: {}, has: {}, jobs: {}, own: { base: [], baseFar: [], all: [] }, claims: [], rocks: [], trees: null, obs: Array.from({ length: CW / 8 }, () => []), wet: [], d: 0 };
      ch.rng = k => rng(ch.seed + 101 * (k || 0));
      /* something the van must drive round, [x, z, radius, kind] in world coordinates (kept in 8 m buckets along the chunk) */
      ch.obstacle = (x, z, r, kind) => { ch.obs[Math.max(0, Math.min(CW / 8 - 1, Math.floor((x - ch.x0) / 8)))].push([x, z, r, kind]); };
      ch.keep = g => { ch.own.all.push(g); return g; };   /* a geometry of its own, to go when the chunk does */
      for (const k of ['base', 'baseFar', 'rk', 'rkFar', 'fx', 'near', 'far', 'tiny']) { const g = new T.Group(); g.matrixAutoUpdate = false; ch.g[k] = g; ch.root.add(g); }
      ch.tiny = ch.g.tiny; ch.near = ch.g.near; ch.far = ch.g.far;   /* where decorations go */
      ch.root.matrixAutoUpdate = false; worldG.add(ch.root);
      chunks.set(c, ch); live.push(ch); return ch;
    }

    /* the chunk's rocks: where they lie, what the van must drive round, which stand in the sea; then drawn, near and
       far, with foam and spray round those in the water */
    function* rocksPart(ch) {
      const X0c = ch.X0, X1c = X0c + CW, r = ch.rng(1), rocks = ch.rocks;
      for (const fn of hooks.place) { const f = fn(ch); if (f) for (const p of f) ch.claims.push([p[0] + o.x, p[1] + o.z, p[2]]); }   /* (kept in coast coordinates, as the rest of the plan) */
      const add = (x, y, z, s, kind, extra, rr = r) => rocks.push(Object.assign({ x, y, z, s, kind, p: Math.floor(rr() * 64), ry: rr() * TAU, tx: (rr() - 0.5) * 0.3, tz: (rr() - 0.5) * 0.3, sy: 1 }, extra));
      /* the headlands' rocks that fall in this chunk */
      for (const h of Co.heads(X0c - 2.4 * Co.WMAX, X1c + 2.4 * Co.WMAX)) {
        const hp = yield* headPlan(h);
        for (const p of hp) if (p.x >= X0c && p.x < X1c) rocks.push(Object.assign({}, p));
      }
      /* clusters standing in the surf along the beach (the camp's bay has its own) */
      for (const p of bay()) if (p.x >= X0c && p.x < X1c) rocks.push(Object.assign({}, p));
      const r2 = ch.rng(2), cl = [];
      for (let x = X0c + r2() * 30; x < X1c; x += 18 + r2() * 30) if (Math.abs(x) >= 118 && !nearHead(x, 2.6)) cl.push([x, -2.0 - r2() * 1.4, 3 + Math.floor(r2() * 4)]);
      for (const [cx, dz, n] of cl) {
        for (let i = 0; i < n; i++) {
          const x = cx + (r2() - 0.5) * (i ? 6 : 1), z = Co.shoreZ(x) + dz + (i ? (r2() - 0.5) * 2.6 : 0);
          if (i === 0) add(x, -0.2, z, 1.25 + r2() * 0.5, 'big', { p: [0, 2, 3][Math.floor(r2() * 3)] });
          else { const s = 0.4 + r2() * 0.8; add(x, -0.16 * s, z, s, 'small', { p: [0, 2, 4][Math.floor(r2() * 3)] }); }
        }
      }
      /* strays on the sand, mostly up by the forest edge, kept clear of the camp and the van */
      const r3 = ch.rng(3);
      for (let i = 0; i < 28; i++) {
        const x = X0c + r3() * CW, xw = x - o.x; if (Math.abs(xw - Layout.camp.x) < 13 || Math.abs(xw - Layout.van.x) < 5) continue;
        const sz = Co.shoreZ(x), vz = Co.vegZ(x), z = vz - 0.4 - Math.pow(r3(), 1.8) * (vz - sz - 1.2);
        if (massif(x, z) > 0) continue;
        const s = 0.22 + r3() * 0.55; add(x, -0.07 * s, z, s, 'small', { p: [0, 2, 4][Math.floor(r3() * 3)] }, r3);
      }
      /* reefs leaving the beach in this chunk: boulders along their flanks, half in the water, and a heap of them off the
         far end where the waves break */
      ch.reefs = [];
      for (const R of Co.reefs(X0c, X1c)) {
        if (R.x < X0c || R.x >= X1c) continue;
        const L = reefBlocks(reefLine(R));
        /* its blocks, drawn as the rocks are, each its own shape turned and sized as it lies, and its own colour */
        for (const b of L.blocks) rocks.push({ x: b.x, y: b.y, z: b.z, block: b, proto: b.proto, reef: 1, kind: 'block' });
        /* (the van can't drive over its end on the sand) */
        for (let i = 0; i < L.length; i++) { const P = L[i]; if (P.z < Co.shoreZ(P.x) - 2) break; ch.obstacle(P.x - o.x, P.z - o.z, P.w * 1.3, 'reef'); }
        ch.reefs.push(L);
      }
      if (ch.claims.length) for (let i = rocks.length - 1; i >= 0; i--) if (!rocks[i].block && claimed(ch, rocks[i].x, rocks[i].z)) rocks.splice(i, 1);   /* (a groyne's blocks stay: they are what is walked on) */
      for (const p of rocks) {
        p.proto = protoOf(R, p);
        const xw = p.x - o.x, zw = p.z - o.z, sh = p.proto.shape;
        if (p.block) { if (p.block.wet && p.z < Co.shoreZ(p.x) + 0.5) ch.wet.push({ x: xw, z: zw, top: Math.max(0.3, p.block.top), rad: p.block.rad * 0.85, id: ch.c * 1000 + ch.wet.length }); continue; }
        if ((p.s > 0.5 || p.kind !== 'small') && !p.reef) ch.obstacle(xw, zw, p.s * 0.82 * (sh[0] + sh[2]) / 2, 'rock');
        if (p.z < Co.shoreZ(p.x) + 0.5 && p.s > 0.4) ch.wet.push({ x: xw, z: zw, top: Math.max(0.3, p.y + p.s * sh[1] * p.sy * 0.9), rad: p.s * 0.9 * (sh[0] + sh[2]) / 2, id: ch.c * 1000 + ch.wet.length });
      }
      yield;
      const g = ch.g, by = new Map();
      for (const p of ch.rocks) { if (!by.has(p.proto)) by.set(p.proto, []); by.get(p.proto).push(p); }
      for (const [proto, list] of by) {
        const inst = new T.InstancedMesh(proto.geo, rockMat, list.length);
        list.forEach((p, i) => {
          if (p.block) { q.copy(p.block.q); sc.copy(p.block.sv); inst.setColorAt(i, tint.setRGB(...p.block.col)); } else { e.set(p.tx, p.ry, p.tz); q.setFromEuler(e); sc.set(p.s, p.s * p.sy, p.s); }
          pos.set(p.x - o.x, p.y, p.z - o.z); m4.compose(pos, q, sc); inst.setMatrixAt(i, m4);
        });
        inst.castShadow = inst.receiveShadow = true; inst.computeBoundingSphere(); g.rk.add(inst);
        const fi = new T.InstancedMesh((far.get(proto) || proto).geo, rockMat, 0); fi.instanceMatrix = inst.instanceMatrix; fi.instanceColor = inst.instanceColor; fi.count = list.length; fi.computeBoundingSphere(); g.rkFar.add(fi);
        if (late()) yield;
      }
      /* the reefs' own rock: a ledge along each line, drawn as the headlands' bare rock is (and wet, and weedy at the water) */
      for (const L of ch.reefs) {
        const geo = ch.keep(reefGeo(L, o)), m = new T.Mesh(geo, reefMat); m.castShadow = m.receiveShadow = true; g.rk.add(m);
        const mf = new T.Mesh(geo, reefMat); mf.receiveShadow = true; g.rkFar.add(mf);
        if (late()) yield;
      }
      const W = ch.wet;
      if (W.length) {
        /* foam rings round each rock in the water */
        const foam = new T.InstancedMesh(ring, foamM, W.length);
        W.forEach((p, i) => { const Rr = p.rad * 2.0 + 0.8; m4.compose(pos.set(p.x, 0.07, p.z), q.identity(), sc.set(Rr, 1, Rr)); foam.setMatrixAt(i, m4); });
        foam.renderOrder = 5; foam.computeBoundingSphere(); g.fx.add(foam);
        /* spray: a few dozen soft blobs per rock, thrown up along ballistic arcs when a crest arrives */
        const n = W.length * NP, sg = ch.keep(new T.InstancedBufferGeometry()), rr = ch.rng(5);
        sg.setIndex(quad.index.clone()); sg.setAttribute('position', quad.attributes.position.clone()); sg.setAttribute('uv', quad.attributes.uv.clone());   /* (its own copies: the chunk's geometry goes with it) */
        const aR = new Float32Array(n * 4), aS = new Float32Array(n * 4);
        W.forEach((p, i) => { for (let j = 0; j < NP; j++) { const k = (i * NP + j) * 4; aR[k] = p.x; aR[k + 1] = p.z; aR[k + 2] = p.top; aR[k + 3] = p.rad; aS[k] = rr(); aS[k + 1] = rr(); aS[k + 2] = rr(); aS[k + 3] = rr(); } });
        sg.setAttribute('aRock', new T.InstancedBufferAttribute(aR, 4)); sg.setAttribute('aSeed', new T.InstancedBufferAttribute(aS, 4)); sg.instanceCount = n;
        const spray = new T.Mesh(sg, sprayM); spray.frustumCulled = false; spray.renderOrder = 6; g.fx.add(spray);
      }
    }
    /* the chunk's trees: its rows of forest on the grid and the scrub on the headlands' tops, the trunks the van must
       drive round; then drawn, near (everything) and far (palms and lighter trees), instanced per shape */
    function* treesPart(ch) {
      const X0c = ch.X0, X1c = X0c + CW, T_ = { palm: [], tall: [], tree: [], bush: [], fern: [] }, g = ch.g;
      yield* forestPlan(X0c, (x, z) => !clear(x - o.x, z - o.z) && !claimed(ch, x, z) && massif(x, z) <= 0.25 && slope(x, z) <= 0.55, T_);
      for (const h of Co.heads(X0c - 2 * Co.WMAX, X1c + 2 * Co.WMAX)) {
        const s = yield* scrubPlan(h);
        for (const k of KINDS) for (const p of s[k]) if (p.x >= X0c && p.x < X1c && !claimed(ch, p.x, p.z)) T_[k].push(p);
      }
      ch.trees = T_;
      for (const p of T_.palm) if (p.z < Co.vegZ(p.x) + 3) ch.obstacle(p.x - o.x, p.z - o.z, 0.35, 'tree');
      for (const p of T_.tree) if (p.z < Co.vegZ(p.x) + 6) ch.obstacle(p.x - o.x, p.z - o.z, 0.45, 'tree');
      yield;
      const inst = (geo, mat, attr, n, col) => { const im = new T.InstancedMesh(geo, mat, 0); im.instanceMatrix = attr; if (col) im.instanceColor = col; im.count = n; im.computeBoundingSphere(); return im; };
      for (const kind of KINDS) {
        const all = ch.trees[kind];
        for (let v = 0; v < Pr[kind].length; v++) {
          const L = all.filter(p => p.v % Pr[kind].length === v); if (!L.length) continue;
          const attr = new T.InstancedBufferAttribute(new Float32Array(L.length * 16), 16);
          /* (each tree a shade of its own: lighter or darker, yellower or bluer) */
          const col = new T.InstancedBufferAttribute(new Float32Array(L.length * 3), 3);
          L.forEach((p, i) => { e.set(0, p.ry, 0); q.setFromEuler(e); sc.setScalar(p.s); pos.set(p.x - o.x, Math.max(-0.05, p.y), p.z - o.z); m4.compose(pos, q, sc); m4.toArray(attr.array, i * 16);
            const u = p.tint ?? ((p.x * 0.618 + p.z * 0.37) % 1 + 1) % 1, l = 0.82 + 0.36 * u, hy = Math.sin(u * 37.1) * 0.06; col.array.set([l * (1 + hy), l, l * (1 - hy * 1.4)], i * 3); });
          for (const [part, mat] of parts[kind]) { const P = Pr[kind][v]; if (P[part] && !P[part].empty) g.near.add(inst(P[part], mat || P.mats[part], attr, L.length, part === 'bark' ? null : col)); }
          if (farParts[kind]) for (const [part, mat] of farParts[kind]) { const P = (lite[kind] || Pr[kind])[v]; if (P[part] && !P[part].empty) g.far.add(inst(P[part], mat || P.mats[part], attr, L.length, part === 'bark' ? null : col)); }
          if (late()) yield;
        }
      }
      for (const fn of hooks.near) { fn(ch); yield; }
    }
    /* the ground and the canopy over it, fine or coarse */
    function* base(ch, coarse) {
      const k = coarse ? 'baseFar' : 'base', t = yield* terrain(ch.c, coarse, o, landMat), cn = yield* canopy(ch.c, coarse, o, canMat), cr = yield* crowns(ch.c, coarse, o, crownMat, quad);
      ch.own[k].push(t.geometry, cn.geometry); ch.g[k].add(t, cn);
      if (cr) { ch.own[k].push(cr.geometry); ch.g[k].add(cr); }
    }
    function* tiny(ch) { for (const fn of hooks.tiny) { fn(ch); yield; } }
    const MAKE = { rocks: rocksPart, trees: treesPart, base: ch => base(ch, false), baseFar: ch => base(ch, true), tiny };

    /* throwing things away: the chunk's own geometry, and the instance buffers of what it drew with shared shapes */
    const free = grp => { grp.traverse(m => { if (m.isInstancedMesh) m.dispose(); }); for (const c of grp.children.slice()) grp.remove(c); };
    function drop(ch, k) {
      if (k === 'base' || k === 'baseFar') { for (const g of ch.own[k]) g.dispose(); ch.own[k].length = 0; for (const c of ch.g[k].children.slice()) ch.g[k].remove(c); }
      else free(ch.g[k]);
      ch.has[k] = false; delete ch.jobs[k]; stat.dropped++;
    }
    function recycle(ch) {
      for (const k of ['base', 'baseFar']) for (const g of ch.own[k]) g.dispose();
      for (const g of ch.own.all) g.dispose();
      for (const k in ch.g) free(ch.g[k]);
      worldG.remove(ch.root); chunks.delete(ch.c); live.splice(live.indexOf(ch), 1);
      /* the headlands' plans are kept while any chunk near them is */
      for (const P of [headPlans, scrubPlans]) for (const i of P.keys()) { const h = Co.cell(i); if (!live.some(l => Math.abs(l.X0 + CW / 2 - h.hx) < CW * 1.5)) P.delete(i); }
    }

    /* which part a chunk needs next, at distance d from the camera (each a little ahead of where it starts to show) */
    function wants(ch, d) {
      const h = ch.has;
      if (d < LOD.rocks + 60 && !h.rocks) return 'rocks';
      if (d < LOD.fine + 120 && !h.base) return 'base';
      if (d < LOD.mid + 60 && !h.trees) return 'trees';
      if (d < LOD.tiny + 40 && !h.tiny) return 'tiny';
      if (d > LOD.fine - 40 && d < LOD.view && !h.baseFar) return 'baseFar';
      return null;
    }
    /* how much of each chunk to draw: each level shows in its band, or stands in for one not built yet */
    function show(ch, d) {
      const g = ch.g, h = ch.has, fine = !!h.base && (d < LOD.fine || !h.baseFar);
      g.base.visible = fine; g.baseFar.visible = !fine && !!h.baseFar;
      g.rk.visible = g.fx.visible = g.near.visible = d < LOD.near;
      g.rkFar.visible = d >= LOD.near && d < LOD.rocks; g.far.visible = d >= LOD.near && d < LOD.mid;
      g.tiny.visible = d < LOD.tiny; ch.root.visible = d < LOD.view;
    }
    function step(ch, k, slice = 1.5) {
      const gen = ch.jobs[k] || (ch.jobs[k] = MAKE[k](ch));
      const t0 = performance.now(); due = t0 + slice;
      const r = gen.next(), dt = performance.now() - t0; due = Infinity;
      stat.steps++; if (dt > 4) stat.long++; if (dt > stat.worst) { stat.worst = dt; stat.worstAt = k + ' of chunk ' + ch.c; }
      if (r.done) { ch.has[k] = true; delete ch.jobs[k]; stat.built++; if (k === 'base' || k === 'baseFar') show(ch, ch.d); }
    }
    /* build everything one chunk needs right now, at once */
    function finish(ch, d) { for (let k = wants(ch, d); k; k = wants(ch, d)) step(ch, k, 1e9); show(ch, d); }

    /* every frame: lay out the chunks around the camera, draw each at its level of detail, and spend about `budget`
       milliseconds building what is missing, nearest first (more when the chunk under the camera is not there yet) */
    function update(camX, budget = 4) {
      if (Layout.coastVer !== ver) reset();
      const cx = camX + o.x, c0 = Math.floor((cx - X0) / CW), span = Math.ceil(LOD.view / CW) + 1;
      for (let c = c0 - span; c <= c0 + span; c++) {
        const d = Math.max(0, Math.abs(X0 + c * CW + CW / 2 - cx) - CW / 2);
        if (d < LOD.view && !chunks.has(c)) chunk(c);
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const ch = live[i], d = Math.max(0, Math.abs(ch.X0 + CW / 2 - cx) - CW / 2); ch.d = d;
        if (d > LOD.keep) { recycle(ch); continue; }
        if (d > LOD.fine + 300) { if (ch.has.base && ch.has.baseFar) drop(ch, 'base'); if (ch.has.tiny) drop(ch, 'tiny'); }
        show(ch, d);
      }
      const here = chunks.get(c0);
      if (!here || wants(here, here.d)) budget = Math.max(budget, 24);
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        let best = null, bd = 1e9, bk = null;
        for (let i = 0; i < live.length; i++) { const ch = live[i]; if (ch.d >= bd) continue; const k = wants(ch, ch.d); if (k) { best = ch; bd = ch.d; bk = k; } }
        if (!best) break;
        step(best, bk, Math.max(0.5, Math.min(1.5, budget - (performance.now() - t0))));
      }
    }
    /* the chunk round the camp, built at once so the first frame is whole (the worst step counts from here on) */
    function prime() { const t0 = performance.now(), c = campC(), ch = chunks.get(c) || chunk(c); ch.d = 0; finish(ch, 0); stat.prime = performance.now() - t0; stat.worst = 0; }
    /* start again from nothing (the coast moved under the camp: Layout.setOrigin) */
    function reset() { while (live.length) recycle(live[live.length - 1]); o.x = Layout.O.x; o.z = Layout.O.z; ver = Layout.coastVer; prime(); }

    /* what the van must drive round near a world point: rocks, trunks, and whatever hooks added (the obstacles
       themselves, [x, z, radius, kind]; the list is reused by the next call) */
    const nearOut = [], wetOut = [];
    function obstaclesNear(x, z) {
      nearOut.length = 0;
      const cx = x + o.x, c = Math.floor((cx - X0) / CW), b = Math.floor((cx - X0 - c * CW) / 8), nb = CW / 8;
      for (let k = b - 1; k <= b + 1; k++) {
        const ch = chunks.get(k < 0 ? c - 1 : k >= nb ? c + 1 : c); if (!ch) continue;
        for (const ob of ch.obs[(k + nb) % nb]) nearOut.push(ob);
      }
      return nearOut;
    }
    /* rocks standing in the sea within r of a world point: { x, z, top, rad, id } (the list is reused by the next call) */
    function wetNear(x, z, r) {
      wetOut.length = 0;
      const cx = x + o.x;
      for (let c = Math.floor((cx - r - X0) / CW), n = Math.floor((cx + r - X0) / CW); c <= n; c++) {
        const ch = chunks.get(c); if (!ch) continue;
        for (const p of ch.wet) if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) wetOut.push(p);
      }
      return wetOut;
    }
    /* hooks, for anything else that lives along the coast:
       place(fn) — fn(chunk) returns [[x, z, radius], …] of ground (world coordinates) to keep clear of rocks and trees,
         before they are scattered, and may add obstacles with chunk.obstacle(x, z, radius, kind);
       decorate(fn, lod) — fn(chunk) adds what it draws as that level is built: 'tiny' into chunk.tiny (shown within 45 m),
         'near' (with the trees, within about 490 m) into chunk.near (shown within 155 m) and chunk.far (155–430 m).
       A chunk gives x0, x1 (where it lies, world x), camp (it holds the camp), rng(k) for numbers of its own, and
       keep(geometry) for geometry to throw away with it (instanced meshes' buffers are freed anyway) */
    const place = fn => { hooks.place.push(fn); if (live.length) reset(); };   /* (chunks already built are built again with it) */
    const decorate = (fn, lod = 'near') => {
      hooks[lod].push(fn);
      for (const ch of live) if (lod === 'tiny' ? ch.has.tiny : ch.has.trees) fn(ch);
    };
    const counts = () => {
      const n = { chunks: live.length, rocks: 0, wet: 0, palm: 0, tall: 0, tree: 0, bush: 0, fern: 0, worst: +stat.worst.toFixed(2), worstAt: stat.worstAt, prime: +(stat.prime || 0).toFixed(1),
        steps: stat.steps, long: stat.long, built: stat.built, dropped: stat.dropped, plans: headPlans.size };
      for (const ch of live) { n.rocks += ch.rocks.length; n.wet += ch.wet.length; if (ch.trees) for (const k of KINDS) n[k] += ch.trees[k].length; }
      return n;
    };
    const W = (f, x, z) => f(x + o.x, z + o.z);
    return { update, prime, reset, obstaclesNear, wetNear, place, decorate, LOD, CW, X0,
      land: (x, z) => W(land, x, z), hill: (x, z) => W(hill, x, z), massif: (x, z) => W(massif, x, z),
      /* the top of a reef under a world point, where it can be walked on (−9 off it) */
      reefTop: (x, z) => { const h = reefH(x + o.x, z + o.z); return reefOn ? h : -9; },
      /* the reefs near a world x, each as its line: [x, z, top height, half-width] every metre or so, out from the beach */
      reefLines: x => Co.reefsNear(x + o.x).map(R => reefLine(R).map(p => [p.x - o.x, p.z - o.z, p.h, p.w])),
      get counts() { return counts(); }, get chunks() { return live.slice(); }, chunkAt: x => chunks.get(Math.floor((x + o.x - X0) / CW)) || null,
      resetWorst: () => { stat.worst = 0; } };
  }
  return { build, LOD, CW, X0 };
})();
