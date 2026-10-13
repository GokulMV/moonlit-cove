/* wild/cicada — a big forest cicada of the island (a Dundubia), the singer whose shrilling fills the trees at dusk:
   4.5 cm long, its glass wings veined dark and folded like a roof over the body well past its tail; the head broad
   with the eyes wide apart at its corners, three small eyes between; olive green and brown, marked darker, frosted
   white beneath. Built standing (facing +x, feet on y = 0), the wings spread. o.clip: cling (also idle: on a trunk,
   head up, belly to the bark at +x), sing (clinging, the abdomen raised and trembling with the song), rest
   (standing), walk, fly, takeoff (off the trunk). */
(() => {
  const T = THREE, M = Models;
  M.add('wild/cicada', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z);
    const C = { olive: lin('#53532e'), brown: lin('#3c3220'), dark: lin('#1e1a12'), bloom: lin('#b8b6a6'), eye: lin('#5a2e1e'), costa: lin('#4a5a2a') };
    /* (glass wings: clear panes, the veins dark and solid, radiating, crossed near the tip; the front edge green-brown) */
    const glassCol = (nv, cross) => (u, v, top) => {
      const k = u * nv, f = k - Math.floor(k), vein = sst(0.09, 0.0, Math.min(f, 1 - f)) * sst(0.05, 0.15, v);
      const cr = cross.reduce((a, c) => Math.max(a, sst(0.025, 0.0, Math.abs(v - c))), 0), costa = sst(0.07, 0.0, u) + sst(0.1, 0.02, v) * 0.6;
      const a = clamp(0.1 + 0.85 * Math.max(vein, cr, costa), 0, 0.95);
      const c = costa > 0.5 ? C.costa : mix([0.82, 0.86, 0.8], C.dark, Math.max(vein, cr));
      return [c[0], c[1], c[2], a];
    };
    return Insect.build(o, {
      name: 'cicada', cell: 0.0003, tau: 0.0006, fold: 'tent',
      thorax: { c: [0, 0.0092], r: [0.0108, 0.0074, 0.0085], shapes: () => [{ ell: [0.004, 0.0122, 0], r: [0.008, 0.004, 0.007], bone: 'thorax', tag: 'pronotum', k: 0.003 }] },
      head: { c: [0.0126, 0.0088], r: [0.0036, 0.0048, 0.0084], k: 0.002, eyes: { c: [0.0128, 0.0106, 0.0074], r: 0.0022, col: C.eye, facet: 0.00012 },
        shapes: () => [{ ell: [0.0148, 0.0072, 0], r: [0.0028, 0.0042, 0.004], bone: 'head', tag: 'face', k: 0.0015 }] },
      abdomen: { pts: [[-0.0098, 0.0086], [-0.0165, 0.0081], [-0.023, 0.0076], [-0.029, 0.0071]], r: s => [0.0086 * (1 - 0.62 * s), 0.0074 * (1 - 0.55 * s)], end: 0.0042, k: 0.7, overlap: 1.0 },
      antennae: { root: [0.0152, 0.0098, 0.0032], tip: [0.0178, 0.0108, 0.0052], r: 0.00018 },
      legs: [
        { root: [0.0062, 0.004, 0.0034], knee: [0.0102, 0.0072, 0.0088], ankle: [0.0142, 0.0022, 0.011], foot: [0.0162, 0.0, 0.0122], r: [0.0009, 0.0006, 0.00035] },
        { root: [0.0012, 0.0036, 0.004], knee: [0.0022, 0.0072, 0.011], ankle: [-0.0008, 0.0022, 0.014], foot: [-0.0018, 0.0, 0.0158], r: [0.0008, 0.00055, 0.00033] },
        { root: [-0.0038, 0.0038, 0.0037], knee: [-0.0078, 0.0072, 0.0108], ankle: [-0.0128, 0.0022, 0.0138], foot: [-0.0148, 0.0, 0.0158], r: [0.0008, 0.00055, 0.00033] }],
      wings: [
        { name: 'fw', root: [0.0038, 0.0138, 0.0046], glass: true, col: glassCol(10, [0.62, 0.8]), nt: 48, nr: 22, restPitch: 0.62,
          outline: [[-0.06, 0.004], [-0.035, 0.028], [0.03, 0.047], [0.16, 0.051], [0.34, 0.046], [0.55, 0.037], [0.78, 0.024], [0.98, 0.013], [1.1, 0.004]] },
        { name: 'hw', root: [-0.0008, 0.0132, 0.0042], glass: true, col: glassCol(7, [0.7]), nt: 36, nr: 16, restPitch: 0.72, restLift: -0.08, amp: 0.85,
          outline: [[0.38, 0.004], [0.52, 0.024], [0.74, 0.03], [0.98, 0.028], [1.25, 0.02], [1.45, 0.007]] }],
      flap: { hz: 34, amp: 0.85, twist: 0.45, lag: 0.1, dihedral: 0.15, pitch: 0.1 },
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        /* (olive and brown, darker marks along the back, frosted white beneath) */
        const mk = sst(0.55, 0.7, M.vn(x * 900, y * 900, z * 900)) * sst(-0.1, 0.4, ny);
        let col = mix(mix(C.olive, C.brown, sst(0.4, 0.6, M.vn(x * 300 + 2, y * 300, z * 300))), C.dark, 0.7 * mk);
        col = mix(col, C.bloom, 0.65 * sst(-0.2, -0.65, ny) * (x < 0.005 ? 1 : 0.3));
        return { col, mat: [0.48, 0.35, PAT.chitin, 0] };
      },
      more: (clips, K) => {
        const { R, V, qE, S, wingSet, folded, footTo, feel, LG, TAU } = K, { sst, wave } = R;
        /* on the trunk: head up, its belly to the bark (+x), the feet gripping it */
        const trunk = (P, t, lift = 0) => {
          P.set('thorax', 0, 0, Math.PI / 2); P.off.set(-0.0075, 0.02, 0); folded(P);
          LG.forEach((L, i) => { for (const s of [-1, 1]) { const tg = P.at('thorax', [L.foot[0], L.foot[1], s * L.foot[2]]); tg.x = 0.0006; footTo(P, i, s, tg); } });
          feel(P, t, 0.4);
        };
        clips.cling = (P, t) => { trunk(P, t); P.set('ab0', 0, 0, 0.02 * Math.sin(t * 1.4)); };
        clips.idle = clips.cling;
        /* the song: the abdomen lifted from the bark and pumped, trembling fast with the drumming of the tymbals */
        clips.sing = (P, t) => {
          trunk(P, t); const ph = (t % 6) / 6, on = sst(0.05, 0.15, ph) * (1 - sst(0.8, 0.95, ph)), tr = Math.sin(t * 260) * 0.012 * on;
          P.set('ab0', 0, 0, -0.12 * on + tr); P.set('ab1', 0, 0, -0.06 * on * (0.6 + 0.4 * Math.sin(t * 9)) + tr); P.set('ab2', 0, 0, tr);
          K.WG.forEach((w) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: 0.08, sweep: 1.2, pitch: 0.55 }); });
        };
        clips.takeoff = (P, t) => { const c = (t % 1.2) / 1.2; if (c > 0.35) { clips.fly(P, t); P.set('thorax', 0, 0, 0.3 * (1 - sst(0.35, 0.7, c))); return; } trunk(P, t); P.off.x -= 0.03 * sst(0.1, 0.35, c); };
      }
    });
  });
})();
