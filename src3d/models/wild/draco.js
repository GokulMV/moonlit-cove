/* wild/draco — a flying lizard (Draco), the little dragon of the island's tree trunks: 20 cm long, most of it the
   thin tail, bark-mottled grey-brown and green so that on a trunk it all but vanishes — until it opens its wings, a
   skin stretched over five long ribs, orange barred with black, and sails from tree to tree; or flicks out the
   yellow fan under its chin and bobs its head at a rival. Built standing (feet on y = 0, facing +x), the wings open.
   o.clip: cling (also idle: on a trunk, head up, its belly to the bark — the bark at +x — the wings furled),
   bob (head-bobbing push-ups), display (the throat's fan flicked out and in, with bobs), glide (wings spread, the
   forefeet holding their leading edges, the tail straight out behind), leap (off the trunk into the glide),
   land (swinging up to the trunk, wings braking), stand, walk, run. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/draco', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const C = { bark: lin('#5e5c4a'), barkD: lin('#36342a'), green: lin('#55613f'), belly: lin('#8a8670'), wing: lin('#b0581e'), wingD: lin('#2a1a12'), wingE: lin('#d8a040'), dew: lin('#d4b636'), claw: lin('#2a2620'), iris: lin('#7a5a2a') };
    const NR = 5, RB = { n: NR, from: [0.058, 0.016], y: 0.027, z: 0.0085, len: 0.042, lens: f => 0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, f * 1.15)), sweep: 0.12, rise: 0.0, bone: 1 };
    const membrane = (S) => {
      const out = [];
      const panel = (A0, A1, bA, B0, B1, bB, nu, nv, bulge) => {
        const pos = [], W = [], idx = [], nvx = nv + 1;
        for (let i = 0; i <= nu; i++) { const u = i / nu;
          for (let j = 0; j <= nv; j++) { const v = j / nv, a = A0.clone().lerp(A1, u), b = B0.clone().lerp(B1, u), p = a.lerp(b, v);
            /* (the free edge rounded outward between the tips) */
            if (u > 0.98 || i === nu) { const out2 = A1.clone().lerp(B1, 0.5).sub(A0.clone().lerp(B0, 0.5)).normalize(); p.addScaledVector(out2, bulge * Math.sin(Math.PI * v)); }
            else { const out2 = A1.clone().lerp(B1, 0.5).sub(A0.clone().lerp(B0, 0.5)).normalize(); p.addScaledVector(out2, bulge * Math.sin(Math.PI * v) * Math.pow(u, 4)); }
            pos.push(p.x, p.y, p.z); W.push([[S.ix[bA], 1 - v], [S.ix[bB], v]].filter(q => q[1] > 1e-4)); } }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const q = i * nvx + j; idx.push(q, q + nvx, q + 1, q + 1, q + nvx, q + nvx + 1); }
        const N = M.normalsOf(pos, idx), n0 = pos.length / 3, pos2 = pos.slice(), N2 = [];
        for (let k = 0; k < n0; k++) for (let c = 0; c < 3; c++) { pos[k * 3 + c] += N[k * 3 + c] * 0.00012; pos2[k * 3 + c] -= N[k * 3 + c] * 0.00012; N2.push(-N[k * 3 + c]); }
        const idx2 = []; for (let t = 0; t < idx.length; t += 3) idx2.push(idx[t] + n0, idx[t + 2] + n0, idx[t + 1] + n0);
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([...pos, ...pos2], 3)); g.setAttribute('normal', new T.Float32BufferAttribute([...N, ...N2], 3)); g.setIndex([...idx, ...idx2]);
        out.push({ geo: g, bind: (x, y, z, i) => W[i % n0], col: (x, y, z) => wingCol(x, z), mat: [0.55, 0.08, PAT.membrane, 0.65], fur: 0 });
      };
      for (const s of [-1, 1]) {
        const X = side(s), rb = i => ['rib' + i + X, S.head['rib' + i + X], S.tail['rib' + i + X]];
        for (let i = 0; i < NR - 1; i++) { const [a, A0, A1] = rb(i), [b, B0, B1] = rb(i + 1); panel(A0, A1, a, B0, B1, b, 10, 4, 0.0035); }
        /* (before the first rib to the shoulder, and behind the last to the hip) */
        /* (as triangles from a point of the flank, so that they furl with the ribs) */
        { const [a, A0, A1] = rb(0), F0 = V(0.066, 0.026, s * 0.008); panel(F0, F0, 'sp3', A0, A1, a, 8, 3, 0.002); }
        { const [a, A0, A1] = rb(NR - 1), H0 = V(0.004, 0.026, s * 0.008); panel(A0, A1, a, H0, H0, 'hips', 8, 3, 0.002); }
      }
      return out;
    };
    /* (the wings: orange, crossed by black bars that follow the ribs outward, pale at their rims) */
    const wingCol = (x, z) => { const r = Math.abs(z), bar = sst(0.55, 0.7, Math.sin(Math.atan2(r - 0.008, x - 0.037) * 9) * 0.5 + 0.5), rim = sst(0.034, 0.046, r);
      return mix(mix(C.wing, C.wingD, 0.8 * bar * sst(0.015, 0.022, r)), C.wingE, 0.5 * rim).map(v => v * (0.92 + 0.12 * M.vn(x * 300, 0, z * 300))); };
    return Lizard.build(o, {
      name: 'draco', cell: 0.0005, tau: 0.0012,
      spine: [[0, 0.025], [0.025, 0.026], [0.05, 0.026], [0.072, 0.025]],
      girth: i => [[0.0085, 0.0068, 0], [0.0105, 0.0074, 0.0005], [0.0108, 0.0074, 0.0005], [0.009, 0.007, 0]][i],
      neck: { pts: [[0.081, 0.027], [0.089, 0.029]], r: [0.0074, 0.0064] },
      head: { at: 0.002, tip: [0.1135, 0.0285, 0], mouth: [0.097, 0.0272], jaw: x => 0.0272 - 0.05 * (x - 0.097), cell: 0.00028,
        eye: { at: [0.0998, 0.0322, 0.0057], r: 0.0021, ax: [0.25, 0.15, 0.96], col: C.iris, iris: 0.8, pupil: 0.34, white: 0.08, lid: C.bark },
        shapes: () => [
          { ell: [0.0965, 0.031, 0], r: [0.0092, 0.0064, 0.0074], bone: 'head', tag: 'cranium', k: 0 },
          { ell: [0.1065, 0.0292, 0], r: [0.0075, 0.0042, 0.0049], bone: 'head', tag: 'snout', k: 0.003 },
          ...[-1, 1].map(s => ({ ell: [0.1005, 0.0348, s * 0.0045], r: [0.0042, 0.0012, 0.0022], bone: 'head', tag: 'brow', k: 0.0012 })),
          /* (the little spine over each eye, the nape's crest) */
          { ell: [0.0905, 0.0362, 0], r: [0.004, 0.0016, 0.0009], bone: 'head', tag: 'crest', k: 0.001 },
          { ell: [0.1, 0.0252, 0], r: [0.0095, 0.0032, 0.0062], bone: 'jaw', tag: 'jaw', k: 0.0025 },
          { box: [0.104, 0.0272, 0], h: [0.01, 0.00018, 0.007], rot: [0, 0, -0.05], sub: true, tag: 'mouth', k: 0.0003 },
          ...[-1, 1].map(s => ({ ell: [0.1112, 0.0302, s * 0.0022], r: [0.0007, 0.0005, 0.0005], sub: true, tag: 'nostril', k: 0.0003 }))] },
      tail: { n: 12, len: 0.115, droop: 0.75, rest: 0.0012, r: s => [0.0036 * Math.pow(1 - s, 0.9) + 0.0005, 0.0038 * Math.pow(1 - s, 0.85) + 0.0005] },
      legs: {
        fore: { sh: [0.068, 0.024, 0.0075], el: [0.067, 0.02, 0.021], wr: [0.071, 0.0032, 0.023], hand: [0.077, 0.0015, 0.0262], fingers: [0.0045, 0.006, 0.0068, 0.0062, 0.0038], spread: 0.75, turn: 0.2 },
        hind: { sh: [0.002, 0.024, 0.0075], el: [0.008, 0.02, 0.025], wr: [0.002, 0.003, 0.029], hand: [0.0095, 0.0015, 0.035], fingers: [0.0045, 0.0065, 0.0085, 0.0105, 0.006], spread: 0.85, turn: 0.35 },
        r: { fore: [0.0027, 0.0021, 0.0015], hind: [0.0034, 0.0025, 0.0017] }, claw: 0.0017 },
      ribs: RB,
      dewlap: { at: [0.104, 0.0236], len: 0.016, depth: 0.015, col: C.dew },
      gait: { hz: 2.2, stride: 0.016, lift: 0.004, wave: 0.12, duty: 0.6 },
      scale: (x, y, z, tg) => x > 0.088 ? 0.0006 : 0.0007,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('claw') > 0.4) return { col: C.claw, mat: [0.35, 0.45, PAT.horn, 0] };
        /* (bark-mottled: grey-brown and lichen green in blotches, dark bars across the back and tail; pale beneath) */
        const bl = M.vn(x * 220, y * 220, z * 220), bar = sst(0.55, 0.75, Math.sin(2 * Math.PI * x / 0.018) * 0.5 + 0.5) * sst(0.0, 0.5, ny);
        let col = mix(mix(C.bark, C.green, sst(0.45, 0.7, M.vn(x * 90 + 3, y * 90, z * 90))), C.barkD, 0.65 * sst(0.55, 0.75, bl) + 0.4 * bar);
        col = mix(col, C.belly, sst(-0.2, -0.6, ny));
        return { col, mat: [0.66, 0.08, PAT.scale, 0] };
      },
      parts: (S) => membrane(S),
      more: (clips, K) => {
        const { R, V, qE, S, bend, tailWave, look, footTo, stance, walkAt, face, LEG, SPN, NKN, TLN, H0, TAU } = K, { sst, wave } = R;
        /* the wings: spread (0) … furled back along the flanks (1) */
        /* (each rib tipped down about the body's length, then swung back along the flank) */
        const wings = (P, f, flap = 0) => { for (const s of [-1, 1]) for (let i = 0; i < NR; i++) P.put('rib' + i + side(s), qE(0, -s * (Math.PI / 2 + 0.06 - 0.025 * i) * f, 0).multiply(qE(s * (0.62 * f + flap), 0, 0))); };
        /* on the trunk: the body turned head up, its belly to the bark (+x), the feet gripping it */
        const trunk = (P, t, { push = 0, h = 0 } = {}) => {
          P.reset(); P.set('hips', 0, 0, Math.PI / 2); P.off.set(-0.003 - 0.003 * push + h, 0.1, 0);
          SPN.forEach((b, i) => i && P.set(b, 0, 0.03 * wave(t, i, 0.3), 0));
          for (const s of [-1, 1]) for (const k of ['fore', 'hind']) { const L = LEG(k, s), tg = P.at('hips', [L.kn[0], L.kn[1], L.kn[2]]); tg.x = 0.0058; footTo(P, k, s, tg, 0); }
          TLN.forEach((b, i) => P.set(b, 0, 0.04 * Math.sin(t * 0.5 + i * 0.4), i < 3 ? -0.04 : 0.0));
          wings(P, 1); face(P, t);
        };
        clips.cling = (P, t) => { trunk(P, t); look(P, V(-0.25, 1, 0.35 * wave(t, 4, 0.4)), 1); };
        clips.idle = clips.cling; clips.perch = clips.cling;
        /* the push-ups: the forelegs straightened and bent, quick, the head jerking up with them */
        clips.bob = (P, t) => { const c = (t % 1.8) / 1.8, b = Math.max(0, Math.sin(Math.PI * 2 * sst(0, 0.5, c) * 2)) * (1 - sst(0.5, 0.6, c));
          trunk(P, t, { push: b }); look(P, V(-0.6 * b - 0.2, 1, 0.1), 1); };
        /* the display: the throat's fan flicked out and in, two or three times, between bobs */
        clips.display = (P, t) => { clips.bob(P, t); const c = (t % 2.6) / 2.6, fan = sst(0.1, 0.16, c) * (1 - sst(0.3, 0.36, c)) + sst(0.45, 0.5, c) * (1 - sst(0.62, 0.7, c));
          P.scale('dew', 0.02 + 0.98 * fan); P.set('dew', 0, 0, 0.25 * fan); };
        /* the glide: wings spread, the forefeet holding their leading edges, the hind legs out back, the tail straight */
        clips.glide = (P, t) => {
          P.set('hips', 0.06 * wave(t, 2, 0.8), 0, -0.05); P.off.set(0, 0.002, 0);
          wings(P, 0, 0.04 * wave(t, 3, 1.4));
          for (const s of [-1, 1]) { const X = side(s); footTo(P, 'fore', s, V(0.058, H0 + 0.0, s * 0.026), 0.3); footTo(P, 'hind', s, V(-0.016, H0 - 0.003, s * 0.02), 0.6); }
          TLN.forEach((b, i) => P.set(b, 0, 0.02 * Math.sin(t * 2 + i * 0.3), i === 0 ? 0.17 : -0.012));
          look(P, V(1, -0.15, 0.1 * wave(t, 5, 0.7)), 1); face(P, t);
        };
        /* the leap: pushed off the trunk backward, turning over to level, the wings opening */
        clips.leap = (P, t) => {
          const c = (t % 1.5) / 1.5, go = sst(0.1, 0.5, c);
          if (c > 0.55) { clips.glide(P, t); return; }
          trunk(P, t, { push: go * 0.5, h: -0.03 * go }); P.set('hips', 0, Math.PI * go, Math.PI / 2 * (1 - go)); wings(P, 1 - go);
          look(P, V(-0.3, 1, 0), 1);
        };
        /* the landing: pitched up to stall, wings braking, then the feet onto the bark */
        clips.land = (P, t) => {
          const c = (t % 1.4) / 1.4, up = sst(0.1, 0.6, c);
          if (c > 0.7) { clips.cling(P, t); return; }
          clips.glide(P, t); P.set('hips', 0, 0, (Math.PI / 2 - 0.2) * up); wings(P, 0.15 * up, -0.1 * up);
          for (const s of [-1, 1]) { footTo(P, 'fore', s, P.at('hips', [0.085, 0.004, s * 0.03]), 0); }
        };
        clips.stand = ((st0) => (P, t) => { st0(P, t); wings(P, 1); })(clips.stand);
        clips.walk = ((w0) => (P, t) => { w0(P, t); wings(P, 1); })(clips.walk);
        clips.run = ((r0) => (P, t) => { r0(P, t); wings(P, 1); })(clips.run);
      }
    });
  });
})();
