/* ─────────────────────────────────────────────────────────────
   layout.js — the cove, in metres.
   y up · camera looks toward −z (east, the sea) · +x is south (screen right).
   Sea is z < shoreZ(x); dry beach up to vegZ(x); coastal forest beyond.
   ───────────────────────────────────────────────────────────── */
const Layout = (() => {
  const TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* ── the coast: it runs on for ever and never comes round again ──
     The shoreline is the bay's own long waves (as they always were), slower waves that leave the camp's bay alone,
     and rocky headlands: one chance of a headland in every 280 m cell along the coast, decided by a hash of the
     cell, so any stretch can be worked out on its own, in any order, and always comes out the same. The two cells
     either side of the camp hold the camp's own two points. Every headland leaves a strip of sand at its foot, so
     the van can drive round it. Coast is all in coast coordinates; the world sees it through the origin O below. */
  const S = { base: -8.6, a1: 1.5, f1: 0.0552233084, p1: 0.7, a2: 0.55, f2: 0.177941771, p2: 2.0, tl: -4.88923985, kt: 0.00613592315,
              a3: 0.8, f3: 0.0213, p3: 0.4, a4: 2.2, f4: 0.00387, p4: 2.1, a5: 1.1, f5: 0.0091, p5: 4.4, tilt: -0.03 };
  const VG = { base: 1.7, a1: 0.9, f1: 0.0920388473, p1: 1.3, a2: 0.45, f2: 0.227029157, tl: -2.93354391, x: 0.85 };   /* x: how much of the slow waves the forest edge follows */
  const WIN = { x: 0.6, r0: 175, r1: 460 };   /* the slow waves come in between these distances from the camp's bay */
  const Coast = (() => {
    const CELL = 280, EDGE = 55, ODDS = 0.74, WMAX = 24, REACH = 6;   /* a headland's shape counts out to REACH half-widths */
    const FIX = new Map([[-1, { hx: -125, w: 16, d: 17, ht: 1, st: 1.7, gap: 9.5, stacks: 1 }], [0, { hx: 132, w: 17, d: 19, ht: 1.12, st: 1.9, gap: 10, stacks: 2 }]]);
    /* an integer hash of (cell, which number), as a fraction */
    const hash = (i, k) => { let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((k | 0) + 0x3c6ef372, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
      h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
    const memo = new Map();
    /* the headland of cell i (or null): its point hx, half-width w, how far it juts out d, height ht, the step of its
       rock terraces st, the sand left at its foot gap, its sea stacks; kept clear of the cells either side */
    function cell(i) {
      let h = memo.get(i); if (h !== undefined) return h;
      h = FIX.has(i) ? Object.assign({}, FIX.get(i)) : null;
      if (!h && hash(i, 1) < ODDS) {
        const q = k => hash(i, k), w = 12 + 12 * q(3), d = w * (0.86 + 0.32 * q(4)), ht = 0.7 + 0.68 * q(5);
        h = { hx: i * CELL + EDGE + q(2) * (CELL - 2 * EDGE), w, d, ht, st: 1.3 + 1.25 * (ht - 0.7) + 0.25 * q(6), gap: 7.6 + 0.145 * d + 0.4 * q(7), stacks: q(8) < 0.15 ? 0 : q(8) < 0.7 ? 1 : 2 };
      }
      if (h) { h.i = i; h.seed = 1 + Math.floor(hash(i, 9) * 1e9); }
      memo.set(i, h); return h;
    }
    /* the headlands whose points lie between x0 and x1 */
    function heads(x0, x1) { const out = []; for (let i = Math.floor(x0 / CELL), n = Math.floor(x1 / CELL); i <= n; i++) { const h = cell(i); if (h && h.hx >= x0 && h.hx <= x1) out.push(h); } return out; }
    function head(x) {
      let a = 0;
      for (let i = Math.floor((x - REACH * WMAX) / CELL), n = Math.floor((x + REACH * WMAX) / CELL); i <= n; i++) {
        const h = cell(i); if (!h) continue; const u = (x - h.hx) / h.w; if (u > -REACH && u < REACH) a += h.d * Math.exp(-u * u);
      }
      return a;
    }
    function headD(x) {
      let a = 0;
      for (let i = Math.floor((x - REACH * WMAX) / CELL), n = Math.floor((x + REACH * WMAX) / CELL); i <= n; i++) {
        const h = cell(i); if (!h) continue; const u = (x - h.hx) / h.w; if (u > -REACH && u < REACH) a -= 2 * h.d * u / h.w * Math.exp(-u * u);
      }
      return a;
    }
    const slow = x => S.a3 * Math.sin(x * S.f3 + S.p3) + S.a4 * Math.sin(x * S.f4 + S.p4) + S.a5 * Math.sin(x * S.f5 + S.p5);
    const slowD = x => S.a3 * S.f3 * Math.cos(x * S.f3 + S.p3) + S.a4 * S.f4 * Math.cos(x * S.f4 + S.p4) + S.a5 * S.f5 * Math.cos(x * S.f5 + S.p5);
    const win = x => sm(WIN.r0, WIN.r1, Math.abs(x - WIN.x));
    const winD = x => { const a = x - WIN.x, t = Math.max(0, Math.min(1, (Math.abs(a) - WIN.r0) / (WIN.r1 - WIN.r0))); return Math.sign(a) * 6 * t * (1 - t) / (WIN.r1 - WIN.r0); };
    const shoreZ = x => S.base + S.a1 * Math.sin(x * S.f1 + S.p1) + S.a2 * Math.sin(x * S.f2 + S.p2) + S.tl * Math.sin(x * S.kt) + win(x) * slow(x) - head(x);
    const shoreDZ = x => S.a1 * S.f1 * Math.cos(x * S.f1 + S.p1) + S.a2 * S.f2 * Math.cos(x * S.f2 + S.p2) + S.tilt * Math.cos(x * S.kt) + winD(x) * slow(x) + win(x) * slowD(x) - headD(x);
    const vegZ = x => VG.base + VG.a1 * Math.sin(x * VG.f1 + VG.p1) + VG.a2 * Math.sin(x * VG.f2) + VG.tl * Math.sin(x * S.kt) + VG.x * win(x) * slow(x) - 0.55 * head(x);
    return { CELL, WMAX, REACH, hash, cell, heads, head, headD, shoreZ, shoreDZ, vegZ };
  })();

  /* where the world sits on the coast: world (x, z) is coast (x + O.x, z + O.z). It is (0, 0), the camp in its bay;
     setOrigin moves the camp somewhere else along the coast (the world must then be built again) */
  const O = { x: 0, z: 0 }; let coastVer = 0;
  function setOrigin(ox, oz) { O.x = ox; O.z = oz; coastVer++; }
  const shoreZ = x => Coast.shoreZ(x + O.x) - O.z, shoreDZ = x => Coast.shoreDZ(x + O.x), vegZ = x => Coast.vegZ(x + O.x) - O.z;
  const head = x => Coast.head(x + O.x), headD = x => Coast.headD(x + O.x);
  const heads = (x0, x1) => Coast.heads(x0 + O.x, x1 + O.x).map(h => Object.assign({}, h, { hx: h.hx - O.x }));

  /* the same shoreline for the shaders (glsl.js): the 12 headlands nearest x, and the phases of the coast's waves at
     a reference x near it, so the GPU works with small numbers however far along the coast the camera is.
     Fills the four vec4 uniforms H[12] (point − reference, half-width, how far out, 1/half-width), C, P and Q.
     The headlands go in in order along the coast, so a shader can stop at the first one beyond its reach */
  const NGL = 12, cand = [];
  function coastGL(x, H, C, P, Q) {
    const xr = Math.round(x / 1024) * 1024, X = xr + O.x, ph = a => a - TAU * Math.floor(a / TAU);
    C.set(xr, X - WIN.x, S.base - O.z, VG.base - O.z);
    P.set(ph(X * S.f1 + S.p1), ph(X * S.f2 + S.p2), ph(X * S.kt), ph(X * VG.f1 + VG.p1));
    Q.set(ph(X * VG.f2), ph(X * S.f3 + S.p3), ph(X * S.f4 + S.p4), ph(X * S.f5 + S.p5));
    const cx = x + O.x, c0 = Math.floor(cx / Coast.CELL); cand.length = 0;
    for (let i = c0 - 14; i <= c0 + 14; i++) { const h = Coast.cell(i); if (h) cand.push(h); }
    cand.sort((a, b) => Math.abs(a.hx - cx) - Math.abs(b.hx - cx)); if (cand.length > NGL) cand.length = NGL; cand.sort((a, b) => a.hx - b.hx);
    for (let k = 0; k < NGL; k++) { const h = cand[k]; if (h) H[k].set(h.hx - X, h.w, h.d, 1 / h.w); else H[k].set(1e9, 1, 0, 1); }
  }

  const camp = { x: 0.6, z: -2.7 };
  const rug = { x: 0.6, z: -2.7, w: 3.9, d: 2.8, rot: 0.06 };
  const table = { x: 0.6, z: -2.7, w: 1.45, d: 0.78, h: 0.4, rot: 0.06 };

  /* string-light poles on an ellipse round the rug */
  const poles = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 7 * Math.PI * 2 + 0.25;
    poles.push([camp.x + Math.cos(t) * 3.9, camp.z + Math.sin(t) * 2.35]);
  }
  const strands = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 4], [2, 6]];
  const POLE_H = 2.6;

  const fire = { x: 6.9, z: -4.5 };
  const grate = { x: 6.94, z: -4.55, rot: 0.2 };     /* grill straddling the fire ring */
  const chairs = [{ x: 5.7, z: -3.1, face: [6.9, -4.5] }, { x: 8.4, z: -3.5, face: [6.9, -4.5] }];
  const driftwood = { x: 7.0, z: -6.05, len: 2.6, rot: 0.15 };

  const van = { x: -7.6, z: -3.5, rot: Math.PI + 0.3 };
  const lanterns = [[-1.0, -1.65, 1.0], [2.35, -3.85, 0.9], [-6.1, -0.85, 0.8]];
  const bottle = { x: -3.3, z: -5.2, rot: 0.5 };     /* message in a bottle, on dry sand by the path */

  /* palms: [x, z, height, leanX, leanZ, crown radius, seed] */
  const palms = [
    [-14.8, 0.8, 9.6, -1.3, -0.9, 3.5, 1], [12.6, 1.0, 8.6, 0.9, -1.4, 3.3, 2], [17.4, -2.0, 6.8, 2.8, -3.2, 3.2, 3],
    [-21.5, 3.8, 10.8, -0.5, 0.3, 3.7, 4], [22.5, 4.2, 10.2, 0.7, 0.2, 3.6, 5], [-26.5, 1.2, 8.8, -0.8, -1.0, 3.4, 12],
    [-10.5, 9.2, 7.4, 0.5, -0.9, 3.2, 6], [7.5, 10.8, 7.0, -0.6, -0.7, 3.1, 7], [-6.2, 14.6, 5.4, 0.3, -0.5, 2.9, 8],
    [15.5, 12.0, 7.6, 0.4, -0.6, 3.3, 9], [-18.0, 12.4, 7.9, -0.3, -0.7, 3.3, 10], [25.5, 9.5, 8.3, 0.2, -0.4, 3.4, 11]
  ];
  /* broadleaf trees & bushes: [x, z, canopy radius, canopy height, seed] */
  const trees = [
    [-5.8, 8.2, 2.7, 4.4, 11], [4.0, 8.8, 2.9, 4.8, 12], [-13.2, 6.6, 2.6, 4.0, 13], [11.2, 6.4, 2.5, 3.8, 14],
    [0.8, 15.8, 3.2, 5.6, 15], [-8.4, 16.2, 3.1, 5.8, 16], [9.4, 16.8, 3.2, 5.9, 17], [-19.5, 7.8, 2.8, 4.6, 18], [19.8, 7.6, 2.8, 4.4, 19]
  ];
  const bushes = [
    [-3.2, 3.2, 1.5, 1.2, 21], [2.8, 3.5, 1.6, 1.3, 22], [8.0, 3.0, 1.4, 1.1, 23], [-9.4, 3.5, 1.6, 1.2, 24],
    [-16.2, 2.8, 1.7, 1.4, 25], [16.6, 2.6, 1.5, 1.2, 26], [0.0, 5.4, 1.8, 1.6, 27], [-6.8, 5.6, 1.7, 1.5, 28],
    [6.6, 5.2, 1.7, 1.5, 29], [13.0, 4.4, 1.6, 1.3, 30], [-12.4, 4.2, 1.6, 1.4, 31], [-21.5, 4.6, 1.8, 1.5, 32],
    [21.8, 4.8, 1.8, 1.5, 33], [-0.5, 8.2, 2.0, 1.8, 34], [-14.5, 9.2, 2.0, 1.8, 35], [13.5, 9.6, 2.0, 1.8, 36]
  ];

  const wind = [0.55, -0.83];     /* land breeze drifting smoke out toward the sea */

  const cameras = {
    wide: { pos: [0, 15.2, 21.9], look: [0, 6.7, -8.6], fov: 50, focus: 28 },
    camp: { pos: [1.8, 6.1, 5.4], look: [2.8, 1.0, -3.7], fov: 46, focus: 10.5 },
    fire: { pos: [5.1, 2.25, -0.9], look: [7.15, 0.5, -4.6], fov: 38, focus: 4.6 }
  };

  /* overlay hotspots (world, y up) */
  const hotspots = {
    van: [-7.6, 2.4, -3.5], lights: [0.6, 2.7, -5.0], table: [0.6, 0.7, -2.7], fire: [6.9, 1.0, -4.5], bottle: [-3.6, 0.3, -8.05]
  };

  return { shoreZ, shoreDZ, vegZ, head, headD, heads, Coast, O, setOrigin, get coastVer() { return coastVer; }, coastGL, NGL, SH: S, VG, WIN,
           camp, rug, table, poles, strands, POLE_H, fire, grate, chairs, driftwood, van, lanterns, bottle, palms, trees, bushes, wind, cameras, hotspots };
})();
