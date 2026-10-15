/* wild/macaque — a long-tailed macaque (Macaca fascicularis), the monkey that raids the island's camps: an adult male,
   about 50 cm from muzzle to rump with a tail as long again, standing on all fours, at the origin facing +x.
   Olive-brown agouti fur, grizzled, paler grey beneath and inside the limbs; pale whiskers swept back off the cheeks
   and a short crest on the crown; the face bare, brownish-pink, darker on the muzzle, the upper lids pale; amber-brown
   eyes under a heavy brow; small rounded ears; dark hands and feet; the grey pads it sits on.
   o.female: smaller (about 0.82), no long canines. o.clip: what it is doing — stand, walk, run, sit (also idle), eat,
   groom, scratch, climb, leap, threat, yawn, lie; o.speed for walk and run. userData.rig moves it (wild/rig.js). */
(() => {
  const T = THREE, M = Models;
  M.add('wild/macaque', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R, TAU = Math.PI * 2, fem = !!o.female;
    /* ── the colours, as the fur and skin look in daylight ── */
    const C = {
      back: lin('#54483a'), crown: lin('#5f5039'), flank: lin('#5b5348'), belly: lin('#8a8478'), inner: lin('#716a5f'), limb: lin('#534a3e'),
      whisk: lin('#7e786e'), tailT: lin('#4b4135'), tailU: lin('#665e54'), hand: lin('#241d19'), handF: lin('#4a4137'),
      face: lin('#5e4b45'), muzzle: lin('#493b38'), lid: lin('#7f6d64'), lip: lin('#332824'), pad: lin('#6b5d58'),
      palate: lin('#7a3833'), tongue: lin('#a04c48'), nail: lin('#3c3430'), iris: lin('#57381c')
    };
    const pads = [-1, 1].map(s => [-0.183, 0.252, s * 0.021]);
    const EYE = [0.2805, 0.383], ER = 0.0093;
    const MOUTH = 0.3495, headShapes = [
      { ell: [0.243, 0.385, 0], r: [0.047, 0.0325, 0.0352], bone: 'head', tag: 'crown', k: 0 },
      { ell: [0.222, 0.379, 0], r: [0.027, 0.027, 0.029], bone: 'head', tag: 'crown', k: 0.02 },
      /* (the brow ridge: one bar arched over both eyes, curving back at its ends) */
      ...Array.from({ length: 6 }, (_, i) => { const zA = -0.029 + i * 0.00967, zB = zA + 0.00967, P3 = z => [0.2905 - 11 * z * z, 0.3962 - 4 * z * z, z], r = z => 0.0061 - 3.4 * z * z;
        return { cap: [P3(zA), P3(zB)], r: [r(zA), r(zB)], bone: 'head', tag: 'brow', k: i === 0 || i === 5 ? 0.009 : 0.004 }; }),
      { ell: [0.281, 0.372, 0], r: [0.011, 0.021, 0.019], bone: 'head', tag: 'face', k: 0.012 },
      ...[-1, 1].map(s => ({ ell: [0.272, 0.372, s * 0.027], r: [0.014, 0.009, 0.0092], bone: 'head', tag: 'face', k: 0.01 })),
      ...[-1, 1].map(s => ({ ell: [0.276, 0.357, s * 0.021], r: [0.021, 0.0125, 0.0102], bone: 'head', tag: 'cheek', k: 0.012 })),
      { box: [0.3, 0.3585, 0], h: [0.0225, 0.0118, 0.0126], rr: 0.0074, rot: [0, 0, -0.22], bone: 'head', tag: 'muzzle', k: 0.011 },
      { cap: [[0.286, 0.3755, 0], [0.317, 0.3652, 0]], r: [0.0046, 0.0043], bone: 'head', tag: 'muzzle', k: 0.006 },
      { ell: [0.2875, 0.3605, 0], r: [0.0155, 0.0135, 0.0185], bone: 'head', tag: 'muzzle', k: 0.01 },
      { ell: [0.3215, 0.3622, 0], r: [0.0026, 0.0046, 0.0064], bone: 'head', tag: 'nose', k: 0.0035 },
      { box: [0.3155, 0.3525, 0], h: [0.0082, 0.0028, 0.0122], rr: 0.0024, bone: 'head', tag: 'lip', k: 0.004 },
      { ell: [0.289, 0.3415, 0], r: [0.025, 0.0089, 0.0162], rot: [0, 0, -0.08], bone: 'jaw', tag: 'jaw', k: 0.008 },
      ...[-1, 1].map(s => ({ cap: [[0.248, 0.357, s * 0.026], [0.285, 0.338, s * 0.0165]], r: [0.0075, 0.0068], bone: 'jaw', tag: 'jaw', k: 0.008 })),
      { ell: [0.305, 0.3405, 0], r: [0.0094, 0.0064, 0.011], bone: 'jaw', tag: 'chin', k: 0.006 },
      { ell: [0.312, 0.3474, 0], r: [0.0082, 0.0028, 0.0118], bone: 'jaw', tag: 'lip', k: 0.003 },
      { ell: [0.255, 0.347, 0], r: [0.03, 0.016, 0.022], bone: 'head', tag: 'throat', k: 0.02 },
      /* the ears: thin rounded cups standing off the sides of the skull */
      ...[-1, 1].flatMap(s => [
        { ell: [0.2345, 0.389, s * 0.0375], r: [0.0098, 0.0122, 0.0026], rot: [s * 0.12, s * -0.42, 0], bone: 'ear' + (s < 0 ? 'L' : 'R'), tag: 'ear', k: 0.004 },
        { ell: [0.2352, 0.3895, s * 0.0396], r: [0.0074, 0.0094, 0.0019], rot: [s * 0.12, s * -0.42, 0], sub: true, bone: 'ear' + (s < 0 ? 'L' : 'R'), tag: 'ear', k: 0.0008 }]),
      ...[-1, 1].map(s => ({ ell: [0.2808, 0.3832, s * 0.0166], r: [0.0112, 0.0062, 0.0088], rot: [s * -0.12, 0, 0], sub: true, tag: 'socket', k: 0.0016 })),
      ...[-1, 1].map(s => ({ ell: [0.3285, 0.3628, s * 0.0036], r: [0.0017, 0.0011, 0.001], rot: [0, s * 0.5, -0.5], sub: true, tag: 'nostril', k: 0.0008 })),
      { box: [0.307, MOUTH, 0], h: [0.02, 0.0006, 0.0165], rr: 0.0005, sub: true, tag: 'mouth', k: 0.0012 }
    ];
    return Primate.build(o, {
      name: 'macaque', scale: fem ? 0.82 : 1, C,
      /* (the teeth an old ivory, in the mouth's shade: a closed mouth's parting shows only a dark line) */
      toothCol: '#8f846f',
      body: {
        paint: (x, y, z, nx, ny, nz, tg, { grizzle, FUR, SKIN }) => {
        const torso = (tg.torso || 0) + (tg.rump || 0), limb = (tg.arm || 0) + (tg.leg || 0), neck = tg.neck || 0;
        /* (the back, the flanks, the belly; the limbs darker outside than in) */
        const up = sst(-0.65, 0.55, ny), out = Math.max(sst(-0.1, 0.6, nz * Math.sign(z || 1)), sst(0.2, 0.8, nx) * 0.8);
        let col = mix(mix(C.belly, C.flank, sst(-0.75, -0.1, ny)), C.back, up) .map((v, i) => v * torso + mix(C.inner, C.limb, Math.max(out, up * 0.6))[i] * limb + mix(C.belly, C.back, up)[i] * neck);
        let L = torso * (0.01 + 0.016 * up) + limb * (0.008 + 0.008 * Math.max(out, up)) * (tg.leg ? sst(0.04, 0.2, y) * 0.6 + 0.6 : sst(0.03, 0.22, y) * 0.5 + 0.55) + neck * 0.02;
        /* (the pads it sits on: bare, grey-pink) */
        let mat = FUR;
        for (const p of pads) { const d = Math.hypot(x - p[0], y - p[1], z - p[2]); if (d < 0.02) { const k = sst(0.02, 0.013, d); col = mix(col, C.pad, k); L *= 1 - k; if (k > 0.5) mat = SKIN; } }
        const comb = limb > 0.5 ? [-0.2, -0.85, 0] : neck > 0.5 ? [-0.95, -0.25, 0] : [-0.95, -0.4, 0];
        return { col: grizzle(col, x, y, z), mat, fur: L, comb };
        } },
      head: { shapes: headShapes, mouth: MOUTH, corner: 0.272,
        paint: (x, y, z, nx, ny, nz, tg, { grizzle, FUR }) => {
        const az = Math.abs(z), mo = tg.mouth || 0, ear = tg.ear || 0;
        /* bare: an oval of face round the eyes and down over the muzzle (its edge soft, arched up over the brows), all
           of the muzzle and lips, the chin nearly, the inside of the ears */
        const dE = Math.hypot(x - EYE[0], y - EYE[1], az - 0.0166), eyes = 1 - sst(0.013, 0.0185, dE);
        const mid = sst(0.266, 0.276, x) * (1 - sst(0.0195 + 0.012 * sst(0.288, 0.305, x), 0.0245 + 0.01 * sst(0.288, 0.305, x), az)) * (1 - sst(0.4, 0.409, y + 16 * z * z)) * sst(0.0, 0.3, nx + 0.5 * sst(0.29, 0.305, x));
        const oval = Math.max(eyes, mid), ov = 1 + 2 * (1 - oval);
        const bare = Math.max(oval, sst(0.293, 0.303, x) * (1 - 0.6 * sst(0.343, 0.336, y) * sst(-0.3, -0.7, ny)), ear * sst(-0.2, 0.4, nz * Math.sign(z)) * 0.9, mo);
        let col = mix(C.face, C.muzzle, Math.min(1, sst(0.287, 0.302, x) * (0.55 + 0.45 * sst(0.372, 0.362, y))));
        col = mix(col, lin('#7f655b'), sst(0.6, 0.2, ov) * sst(0.376, 0.384, y) * (1 - sst(0.29, 0.296, x)));
        /* (the pale upper lids, round the top of each socket; dark nostrils; the lips' dark edges) */
        const sk = tg.socket || 0; if (sk > 0.25 && y > 0.381) col = mix(col, C.lid, sst(0.25, 0.65, sk));
        if ((tg.nostril || 0) > 0.3) col = mix(col, lin('#1f1612'), sst(0.3, 0.7, tg.nostril));
        if ((tg.lip || 0) > 0.3 && Math.abs(y - MOUTH) < 0.003) col = mix(col, C.lip, 0.8);
        if (ear > 0.5) col = mix(lin('#433632'), lin('#54453f'), sst(-0.2, 0.5, nz * Math.sign(z)));
        /* (inside the mouth: the palate above, the tongue below) */
        if (mo > 0.35) col = mix(col, x > 0.318 ? C.lip : y > MOUTH ? C.palate : C.tongue, sst(0.35, 0.7, mo));
        /* the fur: a crest down the crown, whiskers swept back and up off the cheeks, short at the edge of the face */
        const whisk = sst(0.35, 0.8, Math.abs(nz)) * (1 - sst(0.378, 0.386, y)) * sst(0.338, 0.35, y) * (1 - sst(0.284, 0.296, x)) * sst(0.228, 0.245, x);
        const crest = sst(0.392, 0.418, y) * (1 - sst(0.008, 0.022, az));
        const furC = mix(mix(mix(C.crown, C.back, 0.3 * sst(0.25, 0.22, x)), C.whisk, whisk), C.belly, sst(-0.3, -0.8, ny) * 0.55);
        col = mix(grizzle(furC, x, y, z), col, bare);
        const edge = sst(0.75, 2.2, ov);
        const fore = Math.max(sst(0.262, 0.278, x) * sst(0.386, 0.393, y) * (1 - sst(0.41, 0.418, y)), 1 - sst(0.015, 0.027, Math.hypot(x - EYE[0], y - EYE[1], az - 0.0166)));
        const L = (1 - bare) * (1 - ear) * (0.003 * (1 - 0.4 * fore) + edge * (1 - 0.9 * fore) * (0.0055 + 0.003 * sst(0.38, 0.41, y) + 0.004 * crest + 0.014 * whisk + 0.003 * (tg.throat || 0)));
        const de = Math.hypot(y - EYE[1], az - 0.0166), round = [0, -(az - 0.0166) / (de || 1) * Math.sign(z || 1), (y - EYE[1]) / (de || 1)];
        const comb = bare > 0.5 ? (de < 0.016 && x < 0.292 ? round.map(v => v * 0.5) : [0.5, 0, 0]) : whisk > 0.3 ? [-1.0, 0.45, Math.sign(z) * 0.55] : y > 0.37 ? [-1.1, 0.2, 0] : [-0.6, -0.7, 0];
        const mat = mo > 0.35 ? [0.75, 0.0, PAT.skin, 0] : bare > 0.5 ? (ear > 0.5 ? [0.7, 0.02, PAT.skin, 0.3] : [0.68, 0.03, PAT.skin, 0]) : FUR;
        return { col, mat, fur: L, comb };
        } },
      eye: { at: EYE, z: 0.0165, r: ER, irisR: 0.44, pupilR: 0.15, white: 0.05 },
      teeth: fem => [
      ...[-1, 1].flatMap(s => [
        { cap: [[0.3015, 0.3545, s * 0.0079], [0.3028, (fem ? 0.3486 : 0.3472), s * 0.0081]], r: [0.0019, 0.0006], bone: 'head', tag: 'tooth', k: 0.0006 },
        { cap: [[0.2985, 0.3435, s * 0.0074], [0.2995, (fem ? 0.3478 : 0.3484), s * 0.0077]], r: [0.0017, 0.0005], bone: 'jaw', tag: 'tooth', k: 0.0006 },
        { ell: [0.3115, 0.3532, s * 0.0043], r: [0.0012, 0.0022, 0.0022], bone: 'head', tag: 'tooth', k: 0.0005 },
        { ell: [0.3085, 0.3458, s * 0.004], r: [0.0011, 0.0022, 0.002], bone: 'jaw', tag: 'tooth', k: 0.0005 },
        { box: [0.294, 0.3532, s * 0.0118], h: [0.0105, 0.0019, 0.0016], rr: 0.0011, rot: [0, s * 0.25, 0], bone: 'head', tag: 'tooth', k: 0.0008 },
        { box: [0.293, 0.3456, s * 0.0112], h: [0.0105, 0.0019, 0.0015], rr: 0.0011, rot: [0, s * 0.25, 0], bone: 'jaw', tag: 'tooth', k: 0.0008 }])
      ],
      tail: { pts: [[-0.17, 0.31], [-0.215, 0.335], [-0.27, 0.35], [-0.33, 0.346], [-0.39, 0.325], [-0.44, 0.29], [-0.48, 0.245], [-0.51, 0.19], [-0.53, 0.13], [-0.545, 0.075]],
        r: s => 0.0118 - 0.0075 * Math.pow(s, 0.8), fur: s => 0.012 - 0.006 * s, col: (x, y, z, a) => mix(C.tailU, C.tailT, 0.5 + 0.5 * Math.cos(a)) },
      fur: { shells: 20, dens: 4.5, root: 0.45, tip: [1.1, 1.08, 1.04], grav: 0.35, band: [1.25, 1.15, 0.9, 0.55] }
    });
  });
})();
