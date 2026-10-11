/* ─────────────────────────────────────────────────────────────
   layout.js — the cove, in metres.
   y up · camera looks toward −z (east, the sea) · +x is south (screen right).
   Sea is z < shoreZ(x); dry beach up to vegZ(x); coastal forest beyond.
   ───────────────────────────────────────────────────────────── */
const Layout = (() => {
  /* the coast repeats every P metres, so the beach runs on forever: every wave of the shoreline has a whole
     number of periods in P. Four rocky headlands per stretch, each different, with a strip of sand left at
     the foot of each so the van can drive round the point. Everything is evaluated on the wrapped x. */
  const P = 1024, TAU = Math.PI * 2, wrap = u => u - P * Math.floor(u / P + 0.5);
  const SH = { base: -8.6, a1: 1.5, f1: 9 * TAU / P, p1: 0.7, a2: 0.55, f2: 29 * TAU / P, p2: 2.0, tilt: -0.03, P,
               h: [[-125, 16, 17], [132, 17, 19], [395, 13, 13], [-385, 22, 24]] };   /* [x, half-width, how far it juts out] */
  const TL = SH.tilt * P / TAU;                            /* the old gentle tilt of the bay, as one long wave */
  const head = x => SH.h.reduce((a, [hx, w, d]) => a + d * Math.exp(-((wrap(x - hx) / w) ** 2)), 0);
  const headD = x => SH.h.reduce((a, [hx, w, d]) => { const u = wrap(x - hx); return a - d * 2 * u / (w * w) * Math.exp(-((u / w) ** 2)); }, 0);
  const shoreZ = x => { const q = wrap(x); return SH.base + SH.a1 * Math.sin(q * SH.f1 + SH.p1) + SH.a2 * Math.sin(q * SH.f2 + SH.p2) + TL * Math.sin(q * TAU / P) - head(q); };
  const shoreDZ = x => { const q = wrap(x); return SH.a1 * SH.f1 * Math.cos(q * SH.f1 + SH.p1) + SH.a2 * SH.f2 * Math.cos(q * SH.f2 + SH.p2) + SH.tilt * Math.cos(q * TAU / P) - headD(q); };
  const VG = { base: 1.7, a1: 0.9, f1: 15 * TAU / P, p1: 1.3, a2: 0.45, f2: 37 * TAU / P, tl: 0.6 * TL };   /* the forest edge follows the long wave part way */
  const vegZ = x => { const q = wrap(x); return VG.base + VG.a1 * Math.sin(q * VG.f1 + VG.p1) + VG.a2 * Math.sin(q * VG.f2) + VG.tl * Math.sin(q * TAU / P) - 0.55 * head(q); };

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

  return { shoreZ, shoreDZ, vegZ, SH, VG, head, wrap, P, camp, rug, table, poles, strands, POLE_H, fire, grate, chairs, driftwood,
           van, lanterns, bottle, palms, trees, bushes, wind, cameras, hotspots };
})();
