/* wild/birdwing — Rajah Brooke's birdwing (Trogonoptera brookiana), the island's great butterfly: a male, 16 cm across,
   its long pointed forewings black velvet set with a row of emerald teeth, the hindwings black with a green band and
   pale marginal spots, beneath dusky with blue-green sheen and white flecks; the head black, the collar crimson. It
   sails high over the forest on slow beats and long glides, and comes down in numbers to sip at wet mud by streams.
   Built standing, the wings spread (facing +x, feet on y = 0). o.clip: rest (also idle: wings closed up over the
   back), bask (wings opened flat), puddle (on the mud, wings closed and now and then fanned, the tongue down, the
   abdomen pumping), fly, glide, flutter (hovering at a flower), walk, groom. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/birdwing', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave } = R;
    const C = { black: lin('#0b0c0b'), velvet: lin('#141615'), green: lin('#2fc46a'), greenD: lin('#178a48'), under: lin('#1c1a18'), sheen: lin('#2a7a78'), white: lin('#d8d8cc'), red: lin('#a51818'), vein: lin('#050505'), eye: lin('#1a1612') };
    /* (the forewing's emerald teeth: one between each pair of veins in the fan, tapering toward the margin) */
    const fwCol = (u, v, top, th, rr) => {
      const k = u * 9, cell = Math.floor(k), f = k - cell, vein = sst(0.06, 0.0, Math.min(f, 1 - f)) * sst(0.08, 0.2, v);
      let col = top ? C.velvet : C.under;
      if (top && cell >= 1 && cell <= 7) { const v0 = 0.22 + 0.04 * Math.abs(cell - 4), v1 = 0.74 - 0.03 * Math.abs(cell - 3.5), q = (v - v0) / (v1 - v0);
        if (q > 0 && q < 1) { const half = 0.42 * (1 - q * 0.92); if (Math.abs(f - 0.5) < half) col = mix(C.green, C.greenD, 0.35 * q + 0.25 * sst(0.3, 0.5, Math.abs(f - 0.5) / half)); } }
      if (!top) { if (cell >= 2 && cell <= 6 && v > 0.3 && v < 0.6) col = mix(C.under, C.sheen, 0.45 * sst(0.3, 0.4, v) * (1 - sst(0.5, 0.6, v))); }
      col = mix(col, C.vein, 0.85 * vein); return col.map(c => c * (0.92 + 0.12 * M.vn(u * 60, v * 60, top ? 1 : 2)));
    };
    const hwCol = (u, v, top) => {
      const k = u * 8, cell = Math.floor(k), f = k - cell, vein = sst(0.05, 0.0, Math.min(f, 1 - f)) * sst(0.1, 0.25, v);
      let col = top ? C.velvet : C.under;
      /* (a green band across the fore part; pale spots along the margin) */
      if (top && u < 0.55 && v > 0.32 && v < 0.78) col = mix(col, C.green, sst(0.32, 0.38, v) * (1 - sst(0.72, 0.78, v)) * (1 - sst(0.42, 0.55, u)));
      const spot = sst(0.86, 0.9, v) * (1 - sst(0.95, 0.98, v)) * sst(0.25, 0.4, Math.abs(f - 0.5) < 0.3 ? 1 : 0) * (u > 0.2 ? 1 : 0);
      col = mix(col, C.white, (top ? 0.18 : 0.85) * spot);
      col = mix(col, C.vein, 0.85 * vein); return col.map(c => c * (0.92 + 0.12 * M.vn(u * 50, v * 50, top ? 3 : 4)));
    };
    return Insect.build(o, {
      name: 'birdwing', cell: 0.00028, tau: 0.0006, fold: 'up',
      thorax: { c: [0, 0.012], r: [0.0058, 0.0045, 0.0042] },
      head: { c: [0.0078, 0.0126], r: [0.0026, 0.0028, 0.0034], eyes: { c: [0.0083, 0.0133, 0.0023], r: 0.0019, col: C.eye } },
      abdomen: { pts: [[-0.004, 0.0115], [-0.012, 0.011], [-0.02, 0.0102], [-0.027, 0.0093]], r: s => [0.0034 * (1 - 0.5 * s), 0.0036 * (1 - 0.45 * s)], end: 0.004 },
      antennae: { root: [0.0097, 0.0148, 0.001], tip: [0.03, 0.028, 0.0092], r: 0.00025, club: 0.00055, arch: 0.002 },
      tongue: { root: [0.0096, 0.0108], len: 0.0145, r: 0.00022, col: lin('#2a2420') },
      legs: [
        { root: [0.0035, 0.0085, 0.002], knee: [0.006, 0.0118, 0.007], ankle: [0.0092, 0.004, 0.009], foot: [0.0112, 0.0, 0.011], r: [0.00042, 0.00032, 0.00022] },
        { root: [0.0, 0.008, 0.0025], knee: [0.0005, 0.0128, 0.009], ankle: [-0.002, 0.0042, 0.012], foot: [-0.0022, 0.0, 0.015], r: [0.00045, 0.00034, 0.00022] },
        { root: [-0.003, 0.0082, 0.0022], knee: [-0.0072, 0.0124, 0.008], ankle: [-0.012, 0.0042, 0.011], foot: [-0.0142, 0.0, 0.0142], r: [0.00045, 0.00034, 0.00022] }],
      wings: [
        { name: 'fw', root: [0.003, 0.0146, 0.0028], col: fwCol, nt: 64, nr: 26, mat: [0.7, 0.05, PAT.none, 0.3], flySweep: -0.05,
          outline: [[-0.11, 0.004], [-0.085, 0.05], [-0.03, 0.079], [0.12, 0.076], [0.34, 0.064], [0.56, 0.052], [0.82, 0.04], [1.08, 0.03], [1.3, 0.017], [1.42, 0.005]] },
        { name: 'hw', root: [-0.0012, 0.0139, 0.0028], col: hwCol, nt: 56, nr: 22, mat: [0.7, 0.05, PAT.none, 0.3], amp: 0.92,
          outline: [[0.3, 0.005], [0.42, 0.038], [0.62, 0.05], [0.88, 0.054], [1.12, 0.053], [1.36, 0.048], [1.6, 0.04], [1.82, 0.026], [1.98, 0.008]] }],
      flap: { hz: 4.6, amp: 0.78, twist: 0.35, lag: 0.15, dihedral: 0.12, pitch: 0.12 },
      walkHz: 2.2, stride: 0.005,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        /* (black, the collar behind the head crimson, the abdomen's sides dusky) */
        if (g('thorax') > 0.4 && x > 0.0028 && ny > -0.3) return { col: C.red, mat: [0.75, 0.05, PAT.fur, 0], fur: 0 };
        return { col: mix(C.black, lin('#2a2420'), 0.25 * sst(0.0, -0.7, ny)), mat: [0.75, 0.05, g('leg') + g('foot') + g('antenna') + g('club') > 0.4 ? PAT.chitin : PAT.fur, 0], fur: 0 };
      },
      more: (clips, K) => {
        const { R, V, wingSet, folded, footTo, feel, coil, tucked, WG, TAU } = K, { sst, wave } = R;
        clips.bask = (P, t) => { WG.forEach((w, i) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: 0.06 + 0.04 * wave(t, s + i, 0.4), sweep: i ? 0.02 : -0.04 }); }); feel(P, t, 0.5); coil(P); };
        /* puddling: wings closed up, now and then opened a little and closed; the tongue uncoiled down into the mud;
           the abdomen pumping out the water it has drunk */
        clips.puddle = (P, t) => {
          folded(P); const op = R.every(t, 4.5, 0.9, 2); if (op > 0) { const k = Math.sin(Math.PI * op); WG.forEach((w) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: Math.PI / 2 - 0.05 - 0.9 * k }); }); }
          coil(P, 0.12); P.set('tg0', 0, 0, 0.25); P.set('tg2', 0, 0, 0.1 + 0.08 * Math.sin(t * 3));
          P.set('thorax', 0, 0, -0.22); P.set('head', 0, 0, -0.2); for (let i = 0; i < 4; i++) P.set('ab' + i, 0, 0, 0.04 * Math.sin(t * 5 - i) + (i === 3 ? 0.12 * Math.max(0, Math.sin(t * 1.3)) : 0));
          feel(P, t, 0.8);
        };
        /* fluttering at a flower: hovering on quick shallow beats, the body tipped up, the tongue reaching */
        clips.flutter = (P, t) => { const ph = TAU * 7 * t; P.set('thorax', 0, 0, 0.55); P.off.set(0, 0.002 * Math.sin(ph), 0);
          WG.forEach((w, i) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: 0.55 * Math.cos(ph - i * 0.2) + 0.35, sweep: -0.1 + 0.15 * Math.sin(ph), pitch: 0.45 * Math.sin(ph) }); });
          tucked(P); coil(P, 0.3 + 0.2 * Math.sin(t * 2)); feel(P, t, 0.5); };
        /* the flight: a few slow strong beats, then a long glide */
        clips.fly = ((fly0, glide0) => (P, t) => { const per = 1.9, c = t % per; if (c < 1.1) fly0(P, t); else glide0(P, t); })(clips.fly, clips.glide);
      }
    });
  });
})();
