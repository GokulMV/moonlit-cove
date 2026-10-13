/* wild/bee — a giant honey bee (Apis dorsata), the bee of the great combs hung under the island's tallest branches:
   1.8 cm long, the thorax black and furred, the abdomen banded orange-amber and black with pale hair bands, the wings
   smoky glass, the hind legs broad with their pollen baskets. Built standing (facing +x, feet on y = 0), wings spread.
   o.clip: rest (also idle), walk, fly, hover (tipped up, wings a blur, legs hanging), fan (standing, wings buzzing to
   cool the comb), shimmer (the abdomen flipped up and dropped, as the curtain on the comb does in a wave), groom. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/bee', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave } = R;
    const C = { black: lin('#141210'), amber: lin('#8f5420'), amberL: lin('#a8702e'), hair: lin('#9a8c6a'), eye: lin('#181512'), leg: lin('#1e1a16') };
    const glassCol = (nv, cross) => (u, v) => { const k = u * nv, f = k - Math.floor(k), vein = sst(0.08, 0.0, Math.min(f, 1 - f)) * sst(0.08, 0.2, v), cr = cross.reduce((a, c) => Math.max(a, sst(0.03, 0.0, Math.abs(v - c))), 0);
      const a = clamp(0.22 + 0.7 * Math.max(vein, cr), 0, 0.92), c = mix([0.42, 0.38, 0.32], [0.08, 0.06, 0.05], Math.max(vein, cr)); return [c[0], c[1], c[2], a]; };
    return Insect.build(o, {
      name: 'bee', cell: 0.00013, tau: 0.00025, fold: 'flat',
      thorax: { c: [0.0006, 0.0062], r: [0.0032, 0.0027, 0.0026] },
      head: { c: [0.0058, 0.0062], r: [0.0017, 0.0021, 0.0023], k: 0.0008, eyes: { c: [0.006, 0.0067, 0.0017], r: 0.00138, col: C.eye, sy: 1.55, sz: 0.5, facet: 0.00004 } },
      abdomen: { pts: [[-0.0028, 0.006], [-0.0058, 0.0057], [-0.0086, 0.0053], [-0.0112, 0.0049]], r: s => [0.0028 * (1 - 0.42 * s), 0.0025 * (1 - 0.42 * s)], end: 0.0024, k: 0.18, overlap: 0.62 },
      antennae: { root: [0.0072, 0.0074, 0.0006], tip: [0.0098, 0.0072, 0.0024], r: 0.00011, arch: 0.0018 },
      legs: [
        { root: [0.0028, 0.0037, 0.0012], knee: [0.004, 0.0055, 0.0038], ankle: [0.0052, 0.0016, 0.0046], foot: [0.0062, 0.0, 0.0052], r: [0.00026, 0.0002, 0.00012] },
        { root: [0.0006, 0.0035, 0.0014], knee: [0.0009, 0.0056, 0.0046], ankle: [-0.0004, 0.0016, 0.006], foot: [-0.0008, 0.0, 0.0068], r: [0.00026, 0.0002, 0.00012] },
        { root: [-0.0012, 0.0036, 0.0013], knee: [-0.0034, 0.006, 0.0044], ankle: [-0.0062, 0.0018, 0.0058], foot: [-0.0074, 0.0, 0.0066], r: [0.0003, 0.00042, 0.00014] }],
      wings: [
        { name: 'fw', root: [0.0012, 0.0088, 0.0017], glass: true, col: glassCol(6, [0.45, 0.62]), nt: 30, nr: 14,
          outline: [[-0.08, 0.0006], [-0.05, 0.006], [0.05, 0.0102], [0.2, 0.0108], [0.42, 0.0098], [0.65, 0.0078], [0.9, 0.0052], [1.1, 0.0025], [1.2, 0.0006]] },
        { name: 'hw', root: [-0.0006, 0.0086, 0.0016], glass: true, col: glassCol(4, [0.5]), nt: 22, nr: 10, amp: 0.95,
          outline: [[0.25, 0.0005], [0.38, 0.0052], [0.6, 0.0068], [0.86, 0.0064], [1.1, 0.0048], [1.3, 0.002]] }],
      flap: { hz: 210, amp: 1.0, twist: 0.6, lag: 0.05, dihedral: 0.2, pitch: 0.12, bob: 0.0002 },
      walkHz: 5, stride: 0.002,
      fur: { shells: 10, dens: 60, root: 0.55, tip: [1.25, 1.2, 1.1], grav: 0.15 },
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('leg') + g('foot') + g('antenna') > 0.4) return { col: C.leg, mat: [0.45, 0.35, PAT.chitin, 0], fur: g('leg') > 0.4 && x < -0.002 ? 0.00025 : 0 };
        if (g('thorax') > 0.4) return { col: C.black, mat: [0.8, 0.0, PAT.fur, 0], fur: 0.00075, comb: [-0.3, 1, 0] };
        if (g('head') > 0.4) return { col: C.black, mat: [0.7, 0.05, PAT.fur, 0], fur: 0.00035, comb: [1, -0.5, 0] };
        /* (the abdomen: the first rings amber, the rest black, each ring's hind edge pale-haired) */
        const seg = (-x - 0.0028) / 0.0026, i = Math.floor(seg), f = seg - i, amber = i <= 1 ? 1 : i === 2 ? 0.45 : 0;
        const col = mix(mix(C.black, C.amber, amber), C.amberL, 0.25 * amber * sst(-0.4, 0.4, ny));
        return { col: f > 0.78 ? mix(col, C.hair, 0.6) : col, mat: [0.55, 0.15, PAT.chitin, 0.15], fur: f > 0.75 ? 0.00024 : 0.0001, comb: [-1, 0, 0] };
      },
      more: (clips, K) => {
        const { R, V, wingSet, folded, footTo, feel, tucked, WG, LG, FL, TAU } = K, { sst, wave } = R;
        clips.hover = (P, t) => { clips.fly(P, t); P.set('thorax', 0, 0.2 * wave(t, 3, 1.5), 0.45); P.off.set(0.0008 * wave(t, 1, 2), 0.0006 * wave(t, 2, 2.5), 0.0008 * wave(t, 4, 1.7));
          LG.forEach((L, i) => { for (const s of [-1, 1]) P.set('l' + i + 'a' + (s < 0 ? 'L' : 'R'), 0, 0, -0.2 - 0.15 * i); }); };
        clips.fan = (P, t) => { const ph = TAU * 190 * t; WG.forEach((w) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: 0.55 * Math.cos(ph) + 0.25, sweep: 0.3, pitch: 0.5 * Math.sin(ph) }); }); P.set('thorax', 0, 0, -0.08); feel(P, t, 0.4); P.set('ab0', 0, 0, 0.12); };
        /* the shimmer: the abdomen flicked up at the sky and dropped again */
        clips.shimmer = (P, t) => { folded(P); const c = (t % 1.6) / 1.6, up = Math.sin(Math.PI * sst(0.0, 0.35, c)) * (1 - sst(0.5, 0.7, c)) + sst(0.0, 0.15, c) * (1 - sst(0.15, 0.6, c));
          P.set('ab0', 0, 0, 0.9 * up); P.set('ab1', 0, 0, 0.25 * up); WG.forEach((w) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: 0.08 + 0.5 * up, sweep: 1.35 - 0.5 * up }); }); feel(P, t, 0.4); };
      }
    });
  });
})();
