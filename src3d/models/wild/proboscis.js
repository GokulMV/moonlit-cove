/* wild/proboscis — a proboscis monkey (Nasalis larvatus) of the island's mangroves and riverbanks: an adult male, about
   72 cm from head to rump and as long again in the tail, some 20 kg, on all fours at the origin facing +x.
   The great fleshy nose hanging over his mouth (it swings as he moves, and when he honks); the bare face pinkish-orange;
   a rusty cap; the back orange-brown, a cream ruff about the throat and cheeks, the belly big and pale; grey arms and
   legs; the rump and the long tail whitish; small eyes under a light brow; the toes webbed part of the way.
   o.female: smaller (about 0.8 of him), her nose small and turned up. o.clip as wild/primate.js gives them, and
   wade: upright through the shallows, the arms held up out of the water. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/proboscis', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT, wave } = R, fem = !!o.female;
    const C = {
      cap: lin('#6a3215'), back: lin('#7a421e'), lower: lin('#7e7060'), ruff: lin('#b0a286'), belly: lin('#a08a6a'), limb: lin('#77736a'), limbIn: lin('#8b867c'),
      rump: lin('#aaa498'), tailT: lin('#a39d91'), tailU: lin('#b1ab9f'), hand: lin('#332b27'), handF: lin('#67635b'),
      face: lin('#9a6450'), lid: lin('#8e5f4f'), nose: lin('#9f5f52'), lip: lin('#5d3a32'), palate: lin('#7a3833'), tongue: lin('#a04c48'), nail: lin('#3c3430'), iris: lin('#4a2e16')
    };
    const EYE = [0.2785, 0.3825], EZ = 0.0152, ER = 0.0078, MOUTH = 0.3488;
    /* the nose: his a long soft drop hanging from between the eyes down over the mouth; hers small, pointed, upturned */
    const nose = fem ? [
      { cap: [[0.289, 0.373, 0], [0.303, 0.366, 0]], r: [0.0058, 0.0068], bone: 'nose', tag: 'nose', k: 0.006 },
      { ell: [0.3045, 0.3655, 0], r: [0.0068, 0.0052, 0.0072], rot: [0, 0, 0.45], bone: 'nose', tag: 'nose', k: 0.005 },
      ...[-1, 1].map(s => ({ ell: [0.3095, 0.3638, s * 0.0031], r: [0.0018, 0.0013, 0.0012], rot: [0, s * 0.3, 0.6], sub: true, tag: 'nostril', k: 0.0007 }))
    ] : [
      { cap: [[0.287, 0.376, 0], [0.299, 0.369, 0]], r: [0.0055, 0.0072], bone: 'nose', tag: 'nose', k: 0.007 },
      { cap: [[0.299, 0.369, 0], [0.311, 0.356, 0]], r: [0.0072, 0.0105], bone: 'nose', tag: 'nose', k: 0.004 },
      { ell: [0.3145, 0.3455, 0], r: [0.0108, 0.0142, 0.0128], rot: [0, 0, 0.18], bone: 'nose', tag: 'nose', k: 0.006 },
      { ell: [0.3175, 0.3365, 0], r: [0.0085, 0.0075, 0.0105], bone: 'nose', tag: 'nose', k: 0.005 },
      /* (the nostrils, at its tip, looking down and forward; the groove down its middle) */
      ...[-1, 1].map(s => ({ ell: [0.3215, 0.3325, s * 0.0042], r: [0.0024, 0.0016, 0.0016], rot: [0, s * 0.35, -0.9], sub: true, tag: 'nostril', k: 0.0008 })),
      { cap: [[0.318, 0.36, 0], [0.326, 0.338, 0]], r: [0.0012, 0.0009], sub: true, tag: 'nose', k: 0.002 }
    ];
    const headShapes = [
      { ell: [0.244, 0.388, 0], r: [0.045, 0.036, 0.037], bone: 'head', tag: 'crown', k: 0 },
      { ell: [0.222, 0.381, 0], r: [0.028, 0.028, 0.03], bone: 'head', tag: 'crown', k: 0.02 },
      ...Array.from({ length: 6 }, (_, i) => { const zA = -0.027 + i * 0.009, zB = zA + 0.009, P3 = z => [0.2868 - 12 * z * z, 0.3935 - 4 * z * z, z], r = z => 0.0042 - 2.6 * z * z;
        return { cap: [P3(zA), P3(zB)], r: [r(zA), r(zB)], bone: 'head', tag: 'brow', k: i === 0 || i === 5 ? 0.008 : 0.004 }; }),
      { ell: [0.279, 0.371, 0], r: [0.012, 0.022, 0.022], bone: 'head', tag: 'face', k: 0.012 },
      ...[-1, 1].map(s => ({ ell: [0.27, 0.36, s * 0.024], r: [0.022, 0.016, 0.0145], bone: 'head', tag: 'cheek', k: 0.014 })),
      { ell: [0.292, 0.357, 0], r: [0.018, 0.0135, 0.0158], bone: 'head', tag: 'muzzle', k: 0.012 },
      { ell: [0.302, 0.3512, 0], r: [0.0088, 0.0034, 0.0122], bone: 'head', tag: 'lip', k: 0.004 },
      { ell: [0.281, 0.342, 0], r: [0.022, 0.0098, 0.0168], rot: [0, 0, -0.06], bone: 'jaw', tag: 'jaw', k: 0.008 },
      ...[-1, 1].map(s => ({ cap: [[0.247, 0.357, s * 0.027], [0.278, 0.339, s * 0.0165]], r: [0.0078, 0.007], bone: 'jaw', tag: 'jaw', k: 0.008 })),
      { ell: [0.296, 0.3402, 0], r: [0.0092, 0.0068, 0.0112], bone: 'jaw', tag: 'chin', k: 0.006 },
      { ell: [0.3, 0.3462, 0], r: [0.0078, 0.0028, 0.0112], bone: 'jaw', tag: 'lip', k: 0.003 },
      { ell: [0.254, 0.346, 0], r: [0.032, 0.018, 0.025], bone: 'head', tag: 'throat', k: 0.02 },
      ...[-1, 1].flatMap(s => [
        { ell: [0.2335, 0.388, s * 0.0378], r: [0.0078, 0.0098, 0.0024], rot: [s * 0.12, s * -0.42, 0], bone: 'ear' + (s < 0 ? 'L' : 'R'), tag: 'ear', k: 0.004 },
        { ell: [0.234, 0.3885, s * 0.0396], r: [0.0058, 0.0074, 0.0018], rot: [s * 0.12, s * -0.42, 0], sub: true, bone: 'ear' + (s < 0 ? 'L' : 'R'), tag: 'ear', k: 0.0008 }]),
      ...[-1, 1].map(s => ({ ell: [EYE[0] + 0.0003, EYE[1] + 0.0002, s * (EZ + 0.0001)], r: [0.0098, 0.0063, 0.0078], rot: [s * -0.1, 0, 0], sub: true, tag: 'socket', k: 0.0015 })),
      { box: [0.297, MOUTH, 0], h: [0.014, 0.0006, 0.0145], rr: 0.0005, sub: true, tag: 'mouth', k: 0.0012 },
      ...nose.map(p => p.sub ? p : Object.assign({ after: true }, p))
    ];
    return Primate.build(o, {
      name: 'proboscis', scale: fem ? 1.12 : 1.41, C, web: 0.6, sitLift: -0.004,
      bones: [['nose', 'head', [0.29, 0.375, 0], { tail: [0.318, 0.336, 0] }]],
      body: { belly: 1.75, chest: 1.08, limb: 0.96,
        paint: (x, y, z, nx, ny, nz, tg, { grizzle, FUR }) => {
          const torso = (tg.torso || 0) + (tg.rump || 0) + (tg.belly || 0), limb = (tg.arm || 0) + (tg.leg || 0), neck = tg.neck || 0;
          const up = sst(-0.6, 0.5, ny), out = Math.max(sst(-0.1, 0.6, nz * Math.sign(z || 1)), sst(0.2, 0.8, nx) * 0.8);
          /* (the back orange-brown, greying toward the rump, the rump and its triangle white; the belly pale; a cream
             ruff over the throat and the front of the chest) */
          const lowBack = sst(0.0, -0.13, x), rumpW = sst(-0.12, -0.17, x) * sst(-0.2, 0.3, ny + 0.2);
          let back = mix(mix(C.back, C.lower, lowBack), C.rump, rumpW);
          let tc = mix(mix(C.belly, mix(C.lower, C.back, 0.5), sst(-0.7, -0.1, ny)), back, up);
          tc = mix(tc, C.ruff, sst(0.1, 0.17, x) * sst(0.0, -0.5, ny));
          const lc = mix(C.limbIn, C.limb, Math.max(out, up * 0.6)), nc = mix(C.ruff, C.back, sst(-0.3, 0.6, ny));
          const col = tc.map((v, i) => v * torso + lc[i] * limb + nc[i] * neck);
          const L = torso * (0.008 + 0.012 * up + 0.006 * sst(0.06, 0.14, x) * up) + limb * (0.007 + 0.005 * Math.max(out, up)) + neck * (0.016 + 0.006 * sst(0.2, -0.5, ny));
          const comb = limb > 0.5 ? [-0.2, -0.85, 0] : neck > 0.5 ? [-0.9, -0.3, 0] : [-0.95, -0.4, 0];
          return { col: grizzle(col, x, y, z), mat: FUR, fur: L, comb };
        } },
      head: { shapes: headShapes, mouth: MOUTH, corner: 0.266,
        paint: (x, y, z, nx, ny, nz, tg, { grizzle, FUR }) => {
          const az = Math.abs(z), mo = tg.mouth || 0, ear = tg.ear || 0, ns = Math.min(1, (tg.nose || 0) + (tg.nostril || 0));
          /* bare: the face — round the eyes, the cheeks below them, the short muzzle and lips — and all of the nose */
          const dE = Math.hypot(x - EYE[0], y - EYE[1], az - EZ), eyes = 1 - sst(0.012, 0.017, dE);
          const mid = sst(0.264, 0.275, x) * (1 - sst(0.027, 0.032, az)) * (1 - sst(0.385, 0.392, y + 22 * z * z)) * sst(0.336, 0.342, y) * sst(-0.1, 0.25, nx + 0.5 * sst(0.285, 0.298, x));
          const ov = 1 + 2 * (1 - Math.max(eyes, mid));
          const bare = Math.max(eyes, mid, ns, sst(0.288, 0.298, x) * sst(0.336, 0.342, y), ear * sst(-0.2, 0.4, nz * Math.sign(z)) * 0.9, mo);
          let col = mix(C.face, lin('#a8735e'), eyes * 0.5);
          if (ns > 0.3) col = mix(col, mix(C.nose, lin('#c07a6a'), sst(0.36, 0.34, y)), sst(0.3, 0.7, ns));
          const sk = tg.socket || 0; if (sk > 0.25 && y > 0.381) col = mix(col, C.lid, sst(0.25, 0.65, sk));
          if ((tg.nostril || 0) > 0.3) col = mix(col, lin('#2b1814'), sst(0.3, 0.7, tg.nostril));
          if ((tg.lip || 0) > 0.3 && Math.abs(y - MOUTH) < 0.003) col = mix(col, C.lip, 0.8);
          if (ear > 0.5) col = mix(lin('#5a4038'), lin('#6e5046'), sst(-0.2, 0.5, nz * Math.sign(z)));
          if (mo > 0.35) col = mix(col, x > 0.306 ? C.lip : y > MOUTH ? C.palate : C.tongue, sst(0.35, 0.7, mo));
          /* the fur: the rusty cap; below it, round the face, the cream ruff, long, swept back */
          const ruff = sst(0.385, 0.37, y) * sst(0.2, 0.7, Math.abs(nz) + sst(-0.2, -0.7, ny)) * (1 - sst(0.28, 0.292, x));
          const furC = mix(mix(C.cap, C.back, sst(0.24, 0.215, x)), C.ruff, ruff);
          col = mix(grizzle(furC, x, y, z), col, bare);
          const fore = Math.max(1 - sst(0.014, 0.025, dE), sst(0.262, 0.278, x) * sst(0.384, 0.392, y) * (1 - sst(0.408, 0.418, y))), edge = sst(1.2, 2.6, ov);
          const L = (1 - bare) * (1 - ear) * (0.003 + edge * (1 - 0.9 * fore) * (0.007 + 0.004 * sst(0.39, 0.42, y) + 0.016 * ruff));
          const comb = ruff > 0.3 ? [-1.0, 0.1, Math.sign(z) * 0.65] : y > 0.37 ? [-1.1, 0.25, 0] : [-0.6, -0.7, 0];
          const mat = mo > 0.35 ? [0.75, 0.0, PAT.skin, 0] : bare > 0.5 ? (ear > 0.5 ? [0.7, 0.02, PAT.skin, 0.3] : ns > 0.5 ? [0.62, 0.06, PAT.skin, 0.12] : [0.66, 0.04, PAT.skin, 0]) : FUR;
          return { col, mat, fur: L, comb };
        } },
      eye: { at: EYE, z: EZ, r: ER, irisR: 0.46, pupilR: 0.16, white: 0.06 },
      mouthAt: [0.31, 0.348, 0.004],
      teeth: f => [-1, 1].flatMap(s => [
        { cap: [[0.2955, 0.3532, s * 0.0088], [0.2965, f ? 0.3468 : 0.3445, s * 0.009]], r: [0.0018, 0.0005], bone: 'head', tag: 'tooth', k: 0.0006 },
        { cap: [[0.2925, 0.3438, s * 0.0083], [0.2933, f ? 0.3482 : 0.3502, s * 0.0085]], r: [0.0015, 0.0005], bone: 'jaw', tag: 'tooth', k: 0.0006 },
        { ell: [0.3035, 0.352, s * 0.004], r: [0.0011, 0.0024, 0.002], bone: 'head', tag: 'tooth', k: 0.0005 },
        { ell: [0.301, 0.3455, s * 0.0038], r: [0.001, 0.0023, 0.0019], bone: 'jaw', tag: 'tooth', k: 0.0005 },
        { box: [0.286, 0.3515, s * 0.0128], h: [0.0095, 0.002, 0.0017], rr: 0.0011, rot: [0, s * 0.25, 0], bone: 'head', tag: 'tooth', k: 0.0008 },
        { box: [0.285, 0.3462, s * 0.0122], h: [0.0095, 0.002, 0.0016], rr: 0.0011, rot: [0, s * 0.25, 0], bone: 'jaw', tag: 'tooth', k: 0.0008 }]),
      tail: { pts: [[-0.17, 0.31], [-0.215, 0.33], [-0.27, 0.338], [-0.33, 0.33], [-0.39, 0.306], [-0.44, 0.27], [-0.478, 0.222], [-0.505, 0.165], [-0.522, 0.105], [-0.532, 0.045]],
        r: s => 0.0122 - 0.0062 * Math.pow(s, 0.9), fur: s => 0.009 - 0.003 * s, col: (x, y, z, a) => mix(C.tailU, C.tailT, 0.5 + 0.5 * Math.cos(a)) },
      fur: { shells: 20, dens: 6.3, root: 0.5, tip: [1.08, 1.06, 1.03], grav: 0.3, band: [1.12, 1.08, 0.95, 0.35] },
      /* the nose swings with every move of the head, and when he calls */
      face: (P, t, jaw) => { P.set('nose', 0.06 * wave(t, 21, 1.6), 0.05 * wave(t, 22, 1.3), -0.05 - 0.25 * jaw + 0.04 * wave(t, 23, 2.2)); },
      clips: (clips, K) => {
        const { R, V, qE, H, place, digits, look, face, tailTo, handQ, TAU } = K;
        /* upright through the shallows: short steps, the arms held up, the tail floating out behind */
        clips.wade = (P, t) => {
          const Tc = 1.25, ph = t / Tc, s2 = Math.sin(TAU * ph);
          P.off.set(0.02, -0.022 - 0.01 * Math.abs(Math.cos(TAU * ph)), 0); P.set('hips', 0.05 * s2, 0.06 * s2, 1.18); P.set('spine1', 0, -0.03 * s2, 0.1); P.set('chest', -0.04 * s2, -0.04 * s2, 0.06);
          for (const [key, sd, o2] of [['L', -1, 0], ['R', 1, 0.5]]) {
            const [sx, lift] = R.stride(ph - o2, 0.62), at = H['toe' + key];
            place(P, key, V(-0.02 + sx * 0.09, at.y + 0.035 * lift, sd * 0.07), qE(0, sd * 0.15, -0.35 * lift), P.world('shin' + key).add(V(0.35, 0.05, sd * 0.05)));
            digits(P, key, 0.2 * lift);
          }
          for (const [key, sd] of [['l', -1], ['r', 1]]) {
            const Q = handQ(V(0.5, 0.3, sd * 0.4), V(0.2, -1, 0)), up = 0.5 + 0.02 * Math.sin(TAU * ph + (sd > 0 ? 0 : Math.PI));
            place(P, key, V(0.12, up, sd * 0.15), Q, P.world('fore' + (sd < 0 ? 'L' : 'R')).add(V(-0.25, -0.1, sd * 0.3)));
            digits(P, key, 0.3, Q);
          }
          look(P, V(1, -0.1, 0.25 * Math.sin(t * 0.4)), 1); face(P, t);
          tailTo(P, s => -0.35 + 0.3 * s, s => 0.12 * Math.sin(TAU * ph - s * 2));
        };
      }
    });
  });
})();
