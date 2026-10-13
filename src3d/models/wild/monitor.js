/* wild/monitor — an Asian water monitor (Varanus salvator), the great lizard of the island's mangroves and creeks: an
   adult a metre and a half long, more than half of it tail, the tail flattened from side to side and keeled for
   swimming; the long neck and the long head with its nostrils near the snout's tip; the skin of small beady scales,
   near black, crossed by rows of yellow spots that fade with age, the belly pale and barred; the long forked tongue
   pink. It walks with its body swinging side to side, the head held steady, the tongue flicking to taste the air.
   o.clip: stand (also idle), walk, run, bask, alert (raised high, looking about), tongue (tasting), swim (the legs
   laid back, the body and tail rippling), hiss (inflated and high, mouth open, the tail ready), lash (the tail swung). */
(() => {
  const T = THREE, M = Models;
  M.add('wild/monitor', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R;
    const C = { dark: lin('#1e1f19'), olive: lin('#2b2b21'), yellow: lin('#8a7f45'), cream: lin('#a49a74'), bar: lin('#3a3a2c'), tongue: lin('#c39190'), claw: lin('#2a2620'), iris: lin('#5a4a24'), mouth: lin('#9a6a62') };
    const MY = x => 0.1192 - 0.026 * (x - 0.485);
    return Lizard.build(o, {
      name: 'monitor', cell: 0.0024,
      spine: [[0, 0.1], [0.09, 0.104], [0.18, 0.106], [0.26, 0.105], [0.32, 0.102]],
      girth: i => [[0.058, 0.044, 0.003], [0.077, 0.054, 0.009], [0.083, 0.056, 0.012], [0.074, 0.053, 0.009], [0.062, 0.048, 0.004]][i],
      neck: { pts: [[0.37, 0.11], [0.42, 0.122], [0.46, 0.132]], r: [0.043, 0.032] },
      head: { at: 0.01, tip: [0.6, 0.118, 0], mouth: [0.485, 0.119], jaw: x => MY(x) - 0.0004, cell: 0.0011,
        eye: { at: [0.513, 0.1405, 0.0238], r: 0.0064, ax: [0.3, 0.15, 0.94], col: C.iris, iris: 0.8, pupil: 0.32, white: 0.05, lid: C.olive },
        shapes: () => [
          { ell: [0.495, 0.136, 0], r: [0.036, 0.024, 0.031], bone: 'head', tag: 'cranium', k: 0 },
          ...[-1, 1].map(s => ({ ell: [0.484, 0.124, s * 0.021], r: [0.028, 0.02, 0.016], bone: 'head', tag: 'jowl', k: 0.01 })),
          { ell: [0.53, 0.132, 0], r: [0.03, 0.0195, 0.0235], bone: 'head', tag: 'snout', k: 0.012 },
          { ell: [0.562, 0.1265, 0], r: [0.026, 0.0155, 0.0175], bone: 'head', tag: 'snout', k: 0.01 },
          { ell: [0.588, 0.1222, 0], r: [0.0155, 0.0112, 0.0122], bone: 'head', tag: 'snout', k: 0.008 },
          ...[-1, 1].map(s => ({ ell: [0.509, 0.1468, s * 0.0195], r: [0.017, 0.0048, 0.0082], rot: [0, s * -0.25, 0], bone: 'head', tag: 'brow', k: 0.005 })),
          ...[-1, 1].map(s => ({ ell: [0.588, 0.1268, s * 0.0086], r: [0.003, 0.0019, 0.0022], sub: true, tag: 'nostril', k: 0.0012 })),
          /* (the lower jaw, and the loose throat under it) */
          { ell: [0.5, 0.1125, 0], r: [0.042, 0.0118, 0.028], bone: 'jaw', tag: 'jaw', k: 0.008 },
          { ell: [0.553, 0.1135, 0], r: [0.036, 0.0086, 0.0172], bone: 'jaw', tag: 'jaw', k: 0.007 },
          { ell: [0.586, 0.1148, 0], r: [0.0158, 0.0062, 0.0108], bone: 'jaw', tag: 'jaw', k: 0.005 },
          { ell: [0.468, 0.106, 0], r: [0.04, 0.017, 0.029], bone: 'head', tag: 'throat', k: 0.012 },
          /* (the mouth's long line, and the ear's opening behind it) */
          { box: [0.545, MY(0.545), 0], h: [0.062, 0.0006, 0.035], rot: [0, 0, -0.026], sub: true, tag: 'mouth', k: 0.001 },
          ...[-1, 1].map(s => ({ ell: [0.467, 0.128, s * 0.03], r: [0.0048, 0.0058, 0.004], sub: true, tag: 'ear', k: 0.002 }))] },
      tail: { n: 14, len: 0.92, droop: 0.82, rest: 0.007, curl: 0.2,
        r: s => [(0.046 - 0.024 * sst(0.12, 0.5, s)) * Math.pow(1 - s, 0.9) + 0.0028, 0.043 * Math.pow(1 - s, 0.78) + 0.005] },
      keel: s => s < 0.12 ? 0 : 0.003 + 0.007 * sst(0.15, 0.5, s) * (1 - 0.5 * s),
      legs: {
        fore: { sh: [0.3, 0.095, 0.055], el: [0.29, 0.088, 0.13], wr: [0.3, 0.018, 0.135], hand: [0.334, 0.008, 0.15], fingers: [0.028, 0.034, 0.037, 0.034, 0.022], spread: 0.75, turn: 0.25 },
        hind: { sh: [0.0, 0.092, 0.05], el: [0.026, 0.082, 0.14], wr: [-0.004, 0.016, 0.15], hand: [0.034, 0.007, 0.176], fingers: [0.024, 0.035, 0.045, 0.056, 0.034], spread: 0.85, turn: 0.35 },
        r: { fore: [0.022, 0.016, 0.011], hind: [0.03, 0.0195, 0.013] }, claw: 0.014 },
      tongue: { root: [0.505, 0.1135], len: 0.135, w: 0.0052, col: C.tongue },
      gait: { hz: 0.9, stride: 0.13, lift: 0.03, wave: 0.22, duty: 0.65 },
      scale: (x, y, z, tg) => (tg.claw || 0) > 0.5 ? 0.0012 : x > 0.47 ? 0.0024 : y < 0.07 && x > -0.02 && x < 0.34 ? 0.0032 : 0.0025,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('claw') > 0.4) return { col: C.claw, mat: [0.35, 0.45, PAT.horn, 0] };
        if (g('mouth') > 0.4) return { col: C.mouth, mat: [0.4, 0.3, PAT.skin, 0] };
        /* (above: near black, rows of yellow spots across the back and down the tail in bands, yellow speckles on the
           head; below: cream, barred dark across the belly and the throat) */
        const under = sst(-0.15, -0.55, ny), band = 0.5 + 0.5 * Math.cos(2 * Math.PI * (x / 0.075)), spot = sst(0.71, 0.77, M.vn(x * 110, y * 110, z * 110) * 0.75 + band * 0.24);
        let col = mix(C.dark, C.olive, 0.4 * M.vn(x * 25, y * 25, z * 25));
        if (x > 0.47) col = mix(col, C.yellow, 0.75 * sst(0.72, 0.8, M.vn(x * 260, y * 260, z * 260)));
        else col = mix(col, C.yellow, spot * (x < -0.5 ? sst(-0.9, -0.5, x) : 1) * (1 - under));
        const bar = sst(0.4, 0.6, Math.sin(2 * Math.PI * x / 0.03) * 0.5 + 0.5);
        col = mix(col, mix(C.cream, C.bar, 0.35 * bar), under * (x > -0.3 ? 1 : 0.6));
        return { col: col.map(v => v * (0.93 + 0.12 * M.vn(x * 400, y * 400, z * 400))), mat: [0.62, 0.14, PAT.scale, 0] };
      },
      more: (clips, K) => {
        const { R, V, bend, tailWave, look, footTo, stance, flick, face, LEG, SPN, NKN, TLN, H0, TAU } = K, { sst, wave } = R;
        /* swimming: the legs laid back along the body, the body low in the water and rippling, the tail sculling, the
           head held up and steady */
        clips.swim = (P, t) => {
          const hz = 0.8, ph = TAU * hz * t;
          P.off.set(0, -H0 * 0.75, 0);
          SPN.forEach((b, i) => P.set(b, 0, 0.09 * Math.sin(ph - i * 0.55), 0));
          TLN.forEach((b, i) => P.set(b, 0, (0.08 + 0.17 * i / TLN.length) * Math.sin(ph - 2.2 - i * 0.5), i < 2 ? 0.12 : 0));
          /* (the feet laid back beside the body, a little below its middle, carried with it) */
          for (const s of [-1, 1]) { const X = s < 0 ? 'L' : 'R';
            footTo(P, 'fore', s, P.world('fu' + X).add(V(-0.1, -0.025, s * 0.03)), 0.9); footTo(P, 'hind', s, P.world('hu' + X).add(V(-0.13, -0.03, s * 0.025)), 0.9); }
          look(P, V(1, 0.12, -0.25 * Math.sin(ph - 0.4)), 1); face(P, t); flick(P, t, 4);
        };
        /* the hiss: raised high, the body swollen side-on, the neck arched, mouth open, the tail drawn ready */
        clips.hiss = (P, t) => {
          stance(P, t, { h: 1.5, pitch: 0.15, splay: 1.05 }); bend(P, 0.25);
          TLN.forEach((b, i) => P.set(b, 0, (i < 6 ? 0.12 : 0.04) * (1 + 0.3 * Math.sin(t * 2)), i < 2 ? 0.05 : 0));
          look(P, V(1, 0.18, -0.6), 1); face(P, t, 0.18 + 0.04 * Math.sin(t * 6));
        };
        /* the lash: the tail swung hard across, and back */
        clips.lash = (P, t) => {
          clips.stand(P, t); const c = (t % 1.6) / 1.6, sw = Math.sin(Math.PI * 2 * sst(0.0, 0.5, c)) * (1 - sst(0.6, 1, c));
          TLN.forEach((b, i) => P.set(b, 0, 0.32 * sw * (0.3 + i / TLN.length), 0.02));
          bend(P, -0.15 * sw);
        };
      }
    });
  });
})();
