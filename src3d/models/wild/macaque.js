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
    const R = Rig, { lin, mix, sst, clamp, PAT, wave } = R, TAU = Math.PI * 2, fem = !!o.female;
    const S = R.skeleton([
      ['hips', null, [-0.125, 0.3, 0]],
      ['spine1', 'hips', [-0.05, 0.312, 0]], ['spine2', 'spine1', [0.03, 0.318, 0]], ['chest', 'spine2', [0.1, 0.322, 0]],
      ['neck', 'chest', [0.172, 0.34, 0]], ['head', 'neck', [0.215, 0.368, 0], { tail: [0.335, 0.356, 0] }],
      ['jaw', 'head', [0.248, 0.352, 0], { tail: [0.325, 0.335, 0] }],
      ...R.sides((s, X) => [['lid' + X, 'head', [0.2805, 0.383, s * 0.0165], { tail: [0.2905, 0.383, s * 0.0165] }], ['ear' + X, 'head', [0.235, 0.386, s * 0.034], { tail: [0.234, 0.402, s * 0.043] }]]),
      ...R.sides((s, X) => [
        ['clav' + X, 'chest', [0.13, 0.33, s * 0.025], { tail: [0.155, 0.305, s * 0.068] }],
        ['arm' + X, 'clav' + X, [0.155, 0.305, s * 0.068]], ['fore' + X, 'arm' + X, [0.143, 0.176, s * 0.071]],
        ['hand' + X, 'fore' + X, [0.158, 0.036, s * 0.072], { tail: [0.203, 0.012, s * 0.073] }],
        ['fing' + X, 'hand' + X, [0.203, 0.011, s * 0.073], { tail: [0.223, 0.009, s * 0.073] }], ['fing2' + X, 'fing' + X, [0.223, 0.009, s * 0.073], { tail: [0.244, 0.006, s * 0.073] }],
        ['thumb' + X, 'hand' + X, [0.169, 0.016, s * 0.059], { tail: [0.191, 0.007, s * 0.05] }]]),
      ...R.sides((s, X) => [
        ['thigh' + X, 'hips', [-0.125, 0.285, s * 0.055]], ['shin' + X, 'thigh' + X, [-0.045, 0.166, s * 0.06]],
        ['foot' + X, 'shin' + X, [-0.108, 0.043, s * 0.062], { tail: [-0.03, 0.012, s * 0.064] }],
        ['toe' + X, 'foot' + X, [-0.03, 0.012, s * 0.064], { tail: [0.006, 0.007, s * 0.065] }],
        ['hallux' + X, 'foot' + X, [-0.07, 0.016, s * 0.048], { tail: [-0.042, 0.007, s * 0.037] }]]),
    ].concat((() => {
      /* the tail: nine bones along the way it is carried, rising from the rump and drooping */
      const TP = [[-0.17, 0.31], [-0.215, 0.335], [-0.27, 0.35], [-0.33, 0.346], [-0.39, 0.325], [-0.44, 0.29], [-0.48, 0.245], [-0.51, 0.19], [-0.53, 0.13], [-0.545, 0.075]];
      return TP.slice(0, 9).map((p, i) => ['t' + i, i ? 't' + (i - 1) : 'hips', [p[0], p[1], 0], i === 8 ? { tail: [TP[9][0], TP[9][1], 0] } : {}]);
    })()));
    const TAILN = Array.from({ length: 9 }, (_, i) => 't' + i);

    /* ── the colours, as the fur and skin look in daylight ── */
    const C = {
      back: lin('#54483a'), crown: lin('#5f5039'), flank: lin('#5b5348'), belly: lin('#8a8478'), inner: lin('#716a5f'), limb: lin('#534a3e'),
      whisk: lin('#7e786e'), tailT: lin('#4b4135'), tailU: lin('#665e54'), hand: lin('#241d19'), handF: lin('#4a4137'),
      face: lin('#6f574e'), muzzle: lin('#524240'), lid: lin('#958177'), lip: lin('#332824'), pad: lin('#6b5d58'),
      palate: lin('#7a3833'), tongue: lin('#a04c48'), nail: lin('#3c3430'), iris: lin('#57381c')
    };
    const FUR = [0.88, 0, PAT.fur, 0], SKIN = [0.5, 0.2, PAT.skin, 0], NAIL = [0.32, 0.55, PAT.horn, 0];
    const grizzle = (c, x, y, z) => c.map(v => v * (0.9 + 0.2 * M.fbm(x * 40, y * 40, z * 40, 2)));

    /* ── the body: torso, neck, arms to the wrists, legs to the ankles ── */
    const bodyShapes = [
      { ell: [-0.125, 0.298, 0], r: [0.07, 0.068, 0.066], bone: 'hips', tag: 'torso', k: 0 },
      { ell: [-0.16, 0.283, 0], r: [0.046, 0.058, 0.06], bone: 'hips', tag: 'rump', k: 0.03 },
      { ell: [-0.06, 0.305, 0], r: [0.075, 0.062, 0.06], bone: 'spine1', tag: 'torso', k: 0.04 },
      { ell: [0.0, 0.29, 0], r: [0.07, 0.057, 0.063], bone: 'spine1', tag: 'torso', k: 0.04, w: 0.8 },
      { ell: [0.06, 0.306, 0], r: [0.08, 0.07, 0.068], bone: 'spine2', tag: 'torso', k: 0.04 },
      { ell: [0.125, 0.312, 0], r: [0.055, 0.068, 0.066], bone: 'chest', tag: 'torso', k: 0.04 },
      ...[-1, 1].map(s => ({ ell: [0.118, 0.352, s * 0.042], r: [0.048, 0.022, 0.03], rot: [0, 0, -0.1], bone: 'chest', tag: 'torso', k: 0.03 })),
      ...[-1, 1].map(s => ({ ell: [0.152, 0.29, s * 0.034], r: [0.03, 0.04, 0.03], bone: 'chest', tag: 'torso', k: 0.025 })),
      { cap: [[0.15, 0.33, 0], [0.232, 0.366, 0]], r: [0.046, 0.03], bone: 'neck', tag: 'neck', k: 0.03 },
      ...[-1, 1].flatMap(s => [
        { ell: [0.155, 0.302, s * 0.066], r: [0.034, 0.036, 0.028], rot: [0, 0, 0.1], bone: 'arm' + (s < 0 ? 'L' : 'R'), tag: 'arm', k: 0.025 },
        { cap: [[0.155, 0.3, s * 0.068], [0.143, 0.18, s * 0.071]], r: [0.025, 0.019], bone: 'arm' + (s < 0 ? 'L' : 'R'), tag: 'arm', k: 0.02 },
        { ell: [0.149, 0.24, s * 0.07], r: [0.024, 0.045, 0.022], rot: [0, 0, 0.1], bone: 'arm' + (s < 0 ? 'L' : 'R'), tag: 'arm', k: 0.02 },
        { cap: [[0.143, 0.176, s * 0.071], [0.157, 0.042, s * 0.072]], r: [0.019, 0.012], bone: 'fore' + (s < 0 ? 'L' : 'R'), tag: 'arm', k: 0.015 },
        { ell: [0.147, 0.14, s * 0.071], r: [0.021, 0.038, 0.019], rot: [0, 0, 0.12], bone: 'fore' + (s < 0 ? 'L' : 'R'), tag: 'arm', k: 0.015 },
        { cap: [[-0.125, 0.285, s * 0.055], [-0.045, 0.166, s * 0.06]], r: [0.04, 0.023], bone: 'thigh' + (s < 0 ? 'L' : 'R'), tag: 'leg', k: 0.03 },
        { ell: [-0.092, 0.236, s * 0.058], r: [0.06, 0.034, 0.038], rot: [0, 0, -0.98], bone: 'thigh' + (s < 0 ? 'L' : 'R'), tag: 'leg', k: 0.03 },
        { ell: [-0.118, 0.228, s * 0.058], r: [0.026, 0.044, 0.032], rot: [0, 0, -0.5], bone: 'thigh' + (s < 0 ? 'L' : 'R'), tag: 'leg', k: 0.03 },
        { cap: [[-0.045, 0.166, s * 0.06], [-0.108, 0.046, s * 0.062]], r: [0.022, 0.013], bone: 'shin' + (s < 0 ? 'L' : 'R'), tag: 'leg', k: 0.015 },
        { ell: [-0.088, 0.118, s * 0.062], r: [0.024, 0.046, 0.022], rot: [0, 0, -0.48], bone: 'shin' + (s < 0 ? 'L' : 'R'), tag: 'leg', k: 0.015 }])
    ];
    const pads = [-1, 1].map(s => [-0.183, 0.252, s * 0.021]);
    const body = R.sculpt(bodyShapes, { name: 'body', S, cell: 0.003, tau: 0.008,
      paint: (x, y, z, nx, ny, nz, tg) => {
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
      } });

    /* ── the head: skull, brow, cheekbones, muzzle and jaw; the eye sockets, nostrils and mouth cut into it ── */
    const EYE = [0.2805, 0.383], ER = 0.0093;
    const MOUTH = 0.3495, headShapes = [
      { ell: [0.243, 0.385, 0], r: [0.047, 0.0325, 0.0352], bone: 'head', tag: 'crown', k: 0 },
      { ell: [0.222, 0.379, 0], r: [0.027, 0.027, 0.029], bone: 'head', tag: 'crown', k: 0.02 },
      /* (the brow ridge: one bar arched over both eyes, curving back at its ends) */
      ...Array.from({ length: 6 }, (_, i) => { const zA = -0.029 + i * 0.00967, zB = zA + 0.00967, P3 = z => [0.2905 - 11 * z * z, 0.3962 - 4 * z * z, z], r = z => 0.0054 - 3.2 * z * z;
        return { cap: [P3(zA), P3(zB)], r: [r(zA), r(zB)], bone: 'head', tag: 'brow', k: i === 0 || i === 5 ? 0.009 : 0.004 }; }),
      { ell: [0.281, 0.372, 0], r: [0.011, 0.021, 0.019], bone: 'head', tag: 'face', k: 0.012 },
      ...[-1, 1].map(s => ({ ell: [0.272, 0.372, s * 0.027], r: [0.014, 0.009, 0.0092], bone: 'head', tag: 'face', k: 0.01 })),
      ...[-1, 1].map(s => ({ ell: [0.276, 0.357, s * 0.021], r: [0.021, 0.0125, 0.0102], bone: 'head', tag: 'cheek', k: 0.012 })),
      { box: [0.301, 0.3585, 0], h: [0.024, 0.0132, 0.0138], rr: 0.0092, rot: [0, 0, -0.2], bone: 'head', tag: 'muzzle', k: 0.012 },
      { cap: [[0.286, 0.377, 0], [0.318, 0.3668, 0]], r: [0.0068, 0.0058], bone: 'head', tag: 'muzzle', k: 0.007 },
      { ell: [0.3235, 0.3625, 0], r: [0.0036, 0.0052, 0.0072], bone: 'head', tag: 'nose', k: 0.004 },
      { box: [0.3155, 0.3525, 0], h: [0.0082, 0.0028, 0.0122], rr: 0.0024, bone: 'head', tag: 'lip', k: 0.004 },
      { ell: [0.29, 0.341, 0], r: [0.027, 0.0098, 0.0178], rot: [0, 0, -0.08], bone: 'jaw', tag: 'jaw', k: 0.008 },
      ...[-1, 1].map(s => ({ cap: [[0.248, 0.357, s * 0.026], [0.285, 0.338, s * 0.0165]], r: [0.0075, 0.0068], bone: 'jaw', tag: 'jaw', k: 0.008 })),
      { ell: [0.307, 0.34, 0], r: [0.0105, 0.0072, 0.0122], bone: 'jaw', tag: 'chin', k: 0.006 },
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
    const head = R.sculpt(headShapes, { name: 'head', S, cell: 0.001, tau: 0.0035,
      /* (the lips part along the mouth: everything below it, ahead of its corners, goes with the jaw) */
      bind: (x, y, z, ws) => {
        const fw = sst(0.272, 0.292, x); if (fw <= 0) return ws;
        const jaw = S.ix.jaw, hd = S.ix.head, j = y < MOUTH ? 1 : 0, out = ws.filter(([b]) => b !== jaw && b !== hd).map(([b, w]) => [b, w * (1 - fw)]);
        const wj = ws.filter(([b]) => b === jaw).reduce((a, q) => a + q[1], 0), wh = ws.filter(([b]) => b === hd).reduce((a, q) => a + q[1], 0);
        return [...out, [jaw, wj * (1 - fw) + fw * j * (wj + wh)], [hd, wh * (1 - fw) + fw * (1 - j) * (wj + wh)]];
      },
      paint: (x, y, z, nx, ny, nz, tg) => {
        const az = Math.abs(z), mo = tg.mouth || 0, ear = tg.ear || 0;
        /* bare: an oval of face round the eyes and down over the muzzle (its edge soft, arched up over the brows), all
           of the muzzle and lips, the chin nearly, the inside of the ears */
        const ov = Math.pow((y - (y > 0.372 ? 0.373 : 0.37)) / (y > 0.372 ? 0.0295 - 140 * z * z : 0.04), 2) + Math.pow(z / 0.0315, 2);
        const oval = (1 - sst(0.75, 1.05, ov)) * sst(0.0, 0.35, nx + 0.5 * sst(0.29, 0.305, x));
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
        const whisk = sst(0.35, 0.8, Math.abs(nz)) * (1 - sst(0.378, 0.386, y)) * sst(0.338, 0.35, y) * (1 - sst(0.268, 0.28, x)) * sst(0.228, 0.245, x);
        const crest = sst(0.392, 0.418, y) * (1 - sst(0.008, 0.022, az));
        const furC = mix(mix(mix(C.crown, C.back, 0.3 * sst(0.25, 0.22, x)), C.whisk, whisk), C.belly, sst(-0.3, -0.8, ny) * 0.55);
        col = mix(grizzle(furC, x, y, z), col, bare);
        const edge = sst(0.75, 2.2, ov);
        const fore = Math.max(sst(0.262, 0.278, x) * sst(0.386, 0.393, y) * (1 - sst(0.41, 0.418, y)), 1 - sst(0.015, 0.027, Math.hypot(x - EYE[0], y - EYE[1], az - 0.0166)));
        const L = (1 - bare) * (1 - ear) * (0.003 * (1 - 0.4 * fore) + edge * (1 - 0.9 * fore) * (0.006 + 0.005 * sst(0.38, 0.41, y) + 0.007 * crest + 0.014 * whisk + 0.003 * (tg.throat || 0)));
        const de = Math.hypot(y - EYE[1], az - 0.0166), round = [0, -(az - 0.0166) / (de || 1) * Math.sign(z || 1), (y - EYE[1]) / (de || 1)];
        const comb = bare > 0.5 ? (de < 0.016 && x < 0.292 ? round.map(v => v * 0.5) : [0.5, 0, 0]) : whisk > 0.3 ? [-1.0, 0.45, Math.sign(z) * 0.55] : y > 0.37 ? [-1.1, 0.2, 0] : [-0.6, -0.7, 0];
        const mat = mo > 0.35 ? [0.75, 0.0, PAT.skin, 0] : bare > 0.5 ? (ear > 0.5 ? [0.7, 0.02, PAT.skin, 0.3] : [0.68, 0.03, PAT.skin, 0]) : FUR;
        return { col, mat, fur: L, comb };
      } });

    /* ── the hands and feet (the left, and the right its mirror) ── */
    const finger = (bx, by, bz, ang, len, r0, a, b, dip = 0.0045) => {
      const d = [Math.cos(ang), 0, Math.sin(ang)], p = f => [bx + d[0] * len * f, by - dip * f * f, bz + d[2] * len * f], j1 = p(0.45), j2 = p(0.75), tip = p(1);
      return [{ cap: [[bx - d[0] * 0.004, by, bz - d[2] * 0.004], j1], r: [r0 * 1.05, r0 * 0.92], bone: a, tag: 'digit', k: 0.004 },
        { cap: [j1, j2], r: [r0 * 0.92, r0 * 0.84], bone: b, tag: 'digit', k: 0.002 }, { cap: [j2, tip], r: [r0 * 0.84, r0 * 0.66], bone: b, tag: 'digit', k: 0.002 },
        { ell: [tip[0] - d[0] * 0.003, tip[1] + r0 * 0.5, tip[2] - d[2] * 0.003], r: [0.0042, 0.0011, r0 * 0.62], rot: [0, -ang, -0.25], bone: b, tag: 'nail', k: 0.0008, after: true }];
    };
    const handShapes = [
      { cap: [[0.156, 0.046, -0.0715], [0.166, 0.024, -0.072]], r: [0.0125, 0.0122], bone: 'handL', tag: 'wrist', k: 0 },
      { ell: [0.183, 0.0125, -0.0725], r: [0.025, 0.0082, 0.0188], bone: 'handL', tag: 'palm', k: 0.008 },
      { ell: [0.171, 0.0105, -0.061], r: [0.012, 0.0068, 0.0082], bone: 'handL', tag: 'palm', k: 0.004 },
      { ell: [0.171, 0.0098, -0.085], r: [0.013, 0.006, 0.0062], bone: 'handL', tag: 'palm', k: 0.004 },
      ...[[0.204, -0.0605, 0.1, 0.037, 0.0038], [0.206, -0.0685, 0.03, 0.041, 0.004], [0.204, -0.0765, -0.04, 0.038, 0.0038], [0.199, -0.0845, -0.12, 0.03, 0.0034]]
        .flatMap(([x, z, a, l, r]) => finger(x, 0.0098, z, a, l, r, 'fingL', 'fing2L', 0.004)),
      ...finger(0.169, 0.0118, -0.06, 0.62, 0.026, 0.0046, 'thumbL', 'thumbL', 0.005)
    ];
    const footShapes = [
      { cap: [[-0.108, 0.054, -0.062], [-0.106, 0.03, -0.062]], r: [0.013, 0.0145], bone: 'footL', tag: 'wrist', k: 0 },
      { ell: [-0.118, 0.0175, -0.062], r: [0.017, 0.0145, 0.0135], bone: 'footL', tag: 'palm', k: 0.008 },
      { ell: [-0.07, 0.0118, -0.0625], r: [0.044, 0.0094, 0.0172], bone: 'footL', tag: 'palm', k: 0.01 },
      { ell: [-0.032, 0.0098, -0.066], r: [0.012, 0.0078, 0.0185], bone: 'toeL', tag: 'palm', k: 0.008 },
      ...[[-0.03, -0.0575, 0.06, 0.03, 0.0039], [-0.028, -0.0645, 0.0, 0.035, 0.0041], [-0.03, -0.0715, -0.06, 0.034, 0.0039], [-0.035, -0.0785, -0.13, 0.028, 0.0035]]
        .flatMap(([x, z, a, l, r]) => finger(x, 0.0098, z, a, l, r, 'toeL', 'toeL', 0.004)),
      ...finger(-0.075, 0.013, -0.0505, 0.55, 0.034, 0.0052, 'halluxL', 'halluxL', 0.005)
    ];
    const extremity = (sh, name) => R.sculpt(sh, { name, S, cell: 0.0011, tau: 0.003,
      paint: (x, y, z, nx, ny, nz, tg) => {
        if ((tg.nail || 0) > 0.5) return { col: C.nail, mat: NAIL, fur: 0 };
        const back = Math.min(1, sst(0.15, 0.6, ny) * sst(0.0105, 0.016, y) * (1 - 0.75 * (tg.digit || 0)) + (tg.wrist || 0) * 0.9);
        return { col: mix(C.hand, grizzle(C.handF, x, y, z), back), mat: back > 0.5 ? FUR : [0.72, 0.03, PAT.skin, 0], fur: back * 0.005, comb: [0.7, -0.3, 0] };
      } });
    const handL = extremity(handShapes, 'hand'), footL = extremity(footShapes, 'foot');

    /* ── the tail: tapering, its fur short and lying back along it ── */
    const TC = new T.CatmullRomCurve3([...TAILN.map(n => S.head[n].clone()), S.tail.t8.clone()], false, 'centripetal');
    const tailG = R.tube(TC, s => 0.0118 - 0.0075 * Math.pow(s, 0.8), { n: 90, m: 14, cap1: 0.004, cap0: 0.006 });
    const tail = { geo: tailG, bind: R.chain(S, TAILN, { h: 0.5 }),
      col: (x, y, z, i) => { const a = tailG.attributes.uv.getY(i) * TAU; return grizzle(mix(C.tailU, C.tailT, 0.5 + 0.5 * Math.cos(a)), x, y, z); }, mat: FUR,
      fur: (x, y, z, i) => 0.012 - 0.006 * tailG.attributes.uv.getX(i),
      comb: (x, y, z, i) => TC.getTangentAt(tailG.attributes.uv.getX(i)).multiplyScalar(1.5).toArray() };

    /* ── the eyes, their upper lids, and the teeth ── */
    const eyeG = s => { const g = new T.SphereGeometry(ER, 28, 20); g.rotateZ(-Math.PI / 2); g.rotateY(-s * 0.12); g.translate(EYE[0], EYE[1], s * 0.0165);
      /* (uv: how far round from the middle of the cornea, and round it) */
      const P = g.attributes.position, U = g.attributes.uv, ax = new T.Vector3(Math.cos(s * 0.12), 0, Math.sin(s * 0.12));
      for (let i = 0; i < P.count; i++) { const n = new T.Vector3(P.getX(i) - EYE[0], P.getY(i) - EYE[1], P.getZ(i) - s * 0.0165).normalize(); U.setXY(i, Math.acos(clamp(n.dot(ax), -1, 1)) / (Math.PI / 2), (Math.atan2(n.z * ax.x - n.x * ax.z, n.y) / TAU + 1) % 1); }
      return g; };
    const eyes = [-1, 1].map(s => ({ geo: eyeG(s), bind: R.rigid(S, 'head'), col: C.iris, mat: [0.1, 0.55, PAT.eye, 0], eye: [0, 0.44, 0.15, 0.05] }));
    const lidG = (s, up) => { const g = new T.SphereGeometry(ER * 1.055, 24, 10, Math.PI * 0.06, Math.PI * 0.88, 0, Math.PI * (up ? 0.31 : 0.2)); g.rotateY(Math.PI / 2 - s * 0.12); g.rotateZ(up ? -0.3 : Math.PI + 0.25); g.translate(EYE[0], EYE[1], s * 0.0165); return g; };
    const lids = [-1, 1].map(s => ({ geo: lidG(s, true), bind: R.rigid(S, 'lid' + (s < 0 ? 'L' : 'R')), col: C.lid, mat: [0.6, 0.05, PAT.skin, 0] }));
    const teeth = R.sculpt([
      ...[-1, 1].flatMap(s => [
        { cap: [[0.3065, 0.354, s * 0.0094], [0.308, (fem ? 0.3462 : 0.3428), s * 0.0097]], r: [0.0021, 0.0006], bone: 'head', tag: 'tooth', k: 0.0006 },
        { cap: [[0.303, 0.3435, s * 0.0088], [0.3042, (fem ? 0.3495 : 0.3512), s * 0.0091]], r: [0.0018, 0.0005], bone: 'jaw', tag: 'tooth', k: 0.0006 },
        { ell: [0.3165, 0.3529, s * 0.0043], r: [0.0012, 0.0025, 0.0022], bone: 'head', tag: 'tooth', k: 0.0005 },
        { ell: [0.3135, 0.3461, s * 0.004], r: [0.0011, 0.0025, 0.002], bone: 'jaw', tag: 'tooth', k: 0.0005 },
        { box: [0.296, 0.352, s * 0.0132], h: [0.011, 0.0022, 0.0018], rr: 0.0012, rot: [0, s * 0.25, 0], bone: 'head', tag: 'tooth', k: 0.0008 },
        { box: [0.295, 0.3468, s * 0.0125], h: [0.011, 0.0022, 0.0017], rr: 0.0012, rot: [0, s * 0.25, 0], bone: 'jaw', tag: 'tooth', k: 0.0008 }])
    ], { S, cell: 0.0005, tau: 0.001, paint: () => ({ col: lin('#d6cbb0'), mat: [0.25, 0.6, PAT.horn, 0], fur: 0 }) });

    const B = R.body(S, [body, head, handL, R.mirror(handL, S), footL, R.mirror(footL, S), tail, ...eyes, ...lids, teeth],
      { fur: { shells: 20, dens: 4.5, root: 0.45, tip: [1.1, 1.08, 1.04], grav: 0.35, band: [1.25, 1.15, 0.9, 0.55] } });
    const g = B.g; g.name = 'macaque';
    if (fem) g.scale.setScalar(0.82);

    /* ── motions ── */
    const V = (x, y, z) => new T.Vector3(x, y, z), qE = R.qE, H = S.head;
    /* where the face points, as built */
    const FWD = V(1, -0.1, 0).normalize();
    /* the head turned to look along dir (its neck taking part of the turn), its crown kept up */
    const look = (P, dir, k = 1, roll = 0) => {
      const d = dir.clone().normalize(), side = new T.Vector3().crossVectors(d, V(0, 1, 0)); if (side.lengthSq() < 1e-6) side.set(0, 0, 1); side.normalize();
      const W = R.frameTo(FWD, V(0, 0, 1), d, side.applyAxisAngle(d, roll)), Qc = new T.Quaternion(); P.world('chest', V(), Qc);
      const Qh = new T.Quaternion(); P.world('head', V(), Qh);
      P.aim('neck', Qc.clone().slerp(W, 0.45 * k)); P.aim('head', Qh.slerp(W, k).normalize());
    };
    const lookAt = (P, pt, k = 1) => look(P, pt.clone().sub(P.world('head')), k);
    /* the eyes, ears and mouth: a blink now and then, the jaw as asked */
    const face = (P, t, jaw = 0, shut = 0) => {
      const b = Math.max(R.blink(t, 3.3), shut);
      P.set('lidL', 0, 0, -1.05 * b); P.set('lidR', 0, 0, -1.05 * b); P.set('jaw', 0, 0, -jaw);
      const tw = Math.max(0, R.every(t, 5.5, 0.35, 2) > 0 ? Math.sin(Math.PI * R.every(t, 5.5, 0.35, 2)) : 0);
      P.set('earL', 0.1 * tw, 0, 0); P.set('earR', -0.08 * wave(t, 9, 0.4), 0, 0);
    };
    /* the tail: each bone's way (pitch in the side view, yaw across), from the rump to the tip */
    const REST = TAILN.map((n, i) => (i < 8 ? H[TAILN[i + 1]] : S.tail.t8).clone().sub(H[n]).normalize());
    const tailTo = (P, pitch, yaw) => TAILN.forEach((n, i) => { const p = pitch(i / 8), w = yaw(i / 8), d = V(-Math.cos(p) * Math.cos(w), Math.sin(p), Math.cos(p) * Math.sin(w)); P.aim(n, new T.Quaternion().setFromUnitVectors(REST[i], d)); });
    /* a limb's foot or hand set down: [upper, lower, end, contact point (rest), pole away from the joint] */
    const LIMB = {
      L: ['thighL', 'shinL', 'footL', H.toeL.toArray(), [0.4, 0, -0.06]], R: ['thighR', 'shinR', 'footR', H.toeR.toArray(), [0.4, 0, 0.06]],
      l: ['armL', 'foreL', 'handL', H.fingL.toArray(), [-0.4, 0, -0.08]], r: ['armR', 'foreR', 'handR', H.fingR.toArray(), [-0.4, 0, 0.08]]
    };
    const place = (P, key, to, Q, pole) => { const [a, b, c, at, pv] = LIMB[key]; R.reach(P, a, b, c, at, to, Q, pole || P.world(b).add(V(...pv))); };
    const digits = (P, key, curl, Qw) => {
      const s = key === 'L' || key === 'l' ? 'L' : 'R', hind = key === 'L' || key === 'R';
      if (hind) { P.aim('toe' + s, Qw || qE(0, 0, 0)); if (curl) P.turn('toe' + s, 0, 0, -curl); P.set('hallux' + s, 0, s === 'L' ? 0.1 : -0.1, -curl * 0.6); }
      else { P.aim('fing' + s, Qw || qE(0, 0, 0)); if (curl) P.turn('fing' + s, 0, 0, -curl); P.set('fing2' + s, 0, 0, -curl * 1.2); P.set('thumb' + s, 0, 0, -curl * 0.7); }
    };

    /* walking and running: the feet in turn (a walk in diagonal sequence, as monkeys walk; a gallop), the body rising
       and rolling over them, the head held steady, the tail carried in an arch */
    const gait = (P, t, k, run) => {
      const v = k.speed ?? (run ? 2.4 : 0.7), Tc = run ? 0.36 : clamp(0.82 - 0.09 * v, 0.55, 0.85), beta = run ? 0.36 : 0.66, ph = t / Tc, D = v * Tc * beta;
      const ord = run ? { L: 0, R: 0.12, l: 0.52, r: 0.64 } : { L: 0, r: 0.25, R: 0.5, l: 0.75 };
      const c = Math.cos(TAU * ph), s2 = Math.sin(TAU * ph);
      P.off.set(0, run ? -0.012 + 0.014 * Math.sin(TAU * ph + 0.6) : -0.004 - 0.005 * Math.cos(2 * TAU * ph), 0);
      if (run) { P.set('hips', 0, 0.02 * s2, -0.1 * s2); P.set('spine1', 0, 0, 0.06 * Math.sin(TAU * ph + 0.4)); P.set('spine2', 0, 0, 0.06 * Math.sin(TAU * ph + 0.9)); P.set('chest', 0, 0, 0.07 * Math.sin(TAU * ph + 1.4)); }
      else { P.set('hips', 0.035 * s2, 0.055 * Math.sin(TAU * ph - 0.6), 0.015 * Math.cos(2 * TAU * ph)); P.set('spine1', 0, -0.02 * s2, 0); P.set('spine2', -0.01 * s2, -0.025 * s2, 0); P.set('chest', -0.03 * s2, -0.03 * Math.sin(TAU * ph + 0.5), 0); }
      for (const key of ['L', 'R', 'l', 'r']) {
        const hind = key === 'L' || key === 'R', side = key === 'L' || key === 'l' ? -1 : 1, [sx, lift, down] = R.stride(ph - ord[key], beta);
        const at = hind ? H['toe' + (side < 0 ? 'L' : 'R')] : H['fing' + (side < 0 ? 'L' : 'R')], u = (1 - sx) / 2;
        const to = V(at.x + sx * D / 2, at.y + lift * (run ? 0.07 : hind ? 0.04 : 0.05), at.z + side * (run ? 0.004 : 0));
        let pitch;
        if (down) pitch = -sst(hind ? 0.55 : 0.6, 1, u) * (hind ? 0.62 : 0.7);
        else { const sw = (sx + 1) / 2; pitch = hind ? -0.62 + 0.7 * sst(0.05, 0.9, sw) : -0.7 - 0.5 * Math.sin(Math.PI * sw) + 0.72 * sst(0.3, 0.95, sw); }
        place(P, key, to, qE(0, 0, pitch));
        digits(P, key, down ? 0 : 0.35 * lift, qE(0, 0, down ? 0 : -0.3 * lift));
      }
      look(P, V(1, run ? -0.05 : -0.12 + 0.03 * Math.cos(2 * TAU * ph), 0), 0.85);
      face(P, t);
      tailTo(P, s => (run ? 0.1 : 0.55) - s * (run ? 0.25 : 1.35) + (run ? 0.12 * Math.sin(TAU * ph - s * 2) : 0), s => 0.12 * s * Math.sin(TAU * ph - 0.8 - s * 1.6));
    };

    /* sitting on its pads: the body up off the ground, the knees up, the feet flat before it */
    const SIT = { hips: 1.0, spine1: 0.14, spine2: 0.1, chest: 0.04 };
    const sitBody = (P, t, lean = 0) => {
      P.off.set(0.0, -0.236, 0);
      P.set('hips', 0, 0, SIT.hips - lean * 0.3); P.set('spine1', 0, 0.02 * wave(t, 4, 0.3), SIT.spine1 - lean * 0.4); P.set('spine2', 0, 0, SIT.spine2 - lean * 0.3); P.set('chest', 0.02 * wave(t, 6, 0.25), 0, SIT.chest - lean * 0.3);
      const fx = 0.04 + 0.05 * lean;
      place(P, 'L', V(fx, 0.012, -0.075), qE(0, 0.35, 0), P.world('shinL').add(V(0.05, 0.25, -0.16))); digits(P, 'L', 0, qE(0, 0.35, 0));
      place(P, 'R', V(fx, 0.012, 0.075), qE(0, -0.35, 0), P.world('shinR').add(V(0.05, 0.25, 0.16))); digits(P, 'R', 0, qE(0, -0.35, 0));
      tailTo(P, s => s < 0.12 ? -0.55 : -0.03, s => 0.25 * s + 0.08 * wave(t, 12, 0.3) * s);
    };
    const handDown = (P, key, x, z, yaw = 0) => { place(P, key, V(x, 0.011, z), qE(0, yaw, 0), P.world(LIMB[key][1]).add(V(-0.3, -0.05, key === 'l' ? -0.25 : 0.25))); digits(P, key, 0.15, qE(0, yaw, 0)); };
    /* a hand turned so its fingers point along f and its palm faces p (both in the model's frame) */
    const handQ = (f, p) => R.frameTo(V(1, 0, 0), V(0, -1, 0), f.clone().normalize(), p.clone().normalize());
    /* the hands resting over the knees, fingers hanging over them */
    const onKnees = (P, t) => { for (const key of ['l', 'r']) { const s = key === 'l' ? -1 : 1, kn = P.world(s < 0 ? 'shinL' : 'shinR'), Q = handQ(V(0.7, -0.75, -s * 0.15), V(0.2, -0.9, s * 0.25));
        place(P, key, kn.clone().add(V(0.016, 0.006 + 0.002 * wave(t, s + 5, 0.4), -s * 0.004)), Q, P.world(LIMB[key][1]).add(V(-0.3, -0.1, s * 0.3))); digits(P, key, 0.45, Q); } };

    const clips = {
      stand: (P, t) => {
        P.off.set(0, -0.003 + 0.002 * Math.sin(t * 1.3), 0);
        P.set('hips', 0, 0.03 * wave(t, 1, 0.3), 0); P.set('chest', 0, 0.03 * wave(t, 2, 0.3), 0.02 * wave(t, 3, 0.2));
        for (const key of ['L', 'R', 'l', 'r']) { const n = LIMB[key][2], at = key === 'L' || key === 'R' ? H['toe' + n.slice(-1)] : H['fing' + n.slice(-1)]; place(P, key, at.clone(), qE()); digits(P, key, 0.05); }
        look(P, V(1, -0.15 + 0.12 * wave(t, 5, 0.4), 0.55 * wave(t, 7, 0.35)), 1);
        face(P, t); tailTo(P, s => 0.45 - s * 1.5, s => 0.15 * s * wave(t, 8, 0.4));
      },
      walk: (P, t, k) => gait(P, t, k, false),
      run: (P, t, k) => gait(P, t, k, true),
      sit: (P, t) => {
        sitBody(P, t, 0.3);
        handDown(P, 'l', 0.106, -0.034, 0.3); handDown(P, 'r', 0.106, 0.034, -0.3);
        look(P, V(1, -0.1 + 0.15 * wave(t, 5, 0.35), 0.8 * wave(t, 7, 0.3)), 1, 0.1 * wave(t, 11, 0.3));
        face(P, t);
      },
      eat: (P, t) => {
        sitBody(P, t, 0.25);
        handDown(P, 'l', 0.1, -0.036, 0.3);
        /* (the right hand to the mouth and back: a bite, chewed; the head bent a little to meet it) */
        const c = (t % 3.2) / 3.2, up = sst(0.0, 0.18, c) * (1 - sst(0.55, 0.75, c));
        look(P, V(1, -0.25 - 0.15 * up, 0.12 * up), 1);
        const mouth = P.at('head', [0.325, 0.349, 0.004]), kn = P.world('shinR'), rest = kn.clone().add(V(0.02, 0.012, 0.0));
        const Qh = handQ(V(0.7, -0.75, -0.15), V(0.2, -0.9, 0.25)).slerp(handQ(V(0.25, 1, -0.2), V(-0.7, 0.2, -0.6)), up);
        const PALM = [0.183, 0.006, 0.0725], to = rest.clone().lerp(mouth.clone().add(V(0.012, -0.014, 0.01)), up);
        R.reach(P, 'armR', 'foreR', 'handR', up > 0.02 ? PALM : H.fingR.toArray(), to, Qh, P.world('foreR').add(V(-0.05, -0.3, 0.3)));
        digits(P, 'r', 0.5 + 0.6 * up, Qh);
        face(P, t, up > 0.9 ? 0.05 : c > 0.75 || c < 0.18 ? 0.06 + 0.06 * Math.max(0, Math.sin(t * 19)) : 0.02);
      },
      groom: (P, t) => {
        sitBody(P, t, 0.35);
        /* (the left arm held out across its knees; the right hand picks through its fur, the face close over it) */
        place(P, 'l', V(0.11, 0.07, 0.0), qE(0.4, 0.9, 0.4), P.world('foreL').add(V(-0.1, -0.2, -0.3))); digits(P, 'l', 0.5, null);
        const spot = P.at('foreL', [0.152, 0.11 + 0.03 * wave(t, 4, 0.5), -0.088]), pick = Math.max(0, Math.sin(t * 7.5));
        place(P, 'r', spot.clone().add(V(0.004, 0.012 + 0.008 * pick, 0.012)), qE(-0.6, -0.6, -0.5), P.world('foreR').add(V(-0.15, -0.25, 0.3)));
        digits(P, 'r', 0.6 + 0.3 * pick, null);
        lookAt(P, spot, 1); face(P, t, 0.03);
      },
      scratch: (P, t) => {
        sitBody(P, t, 0.2);
        handDown(P, 'r', 0.1, 0.036, -0.3);
        /* (the left hand raking quickly at the fur of its right shoulder, the head turned to watch) */
        const sc = Math.sin(t * 21), spot = P.at('armR', [0.165, 0.27 + 0.012 * sc, 0.095]);
        place(P, 'l', spot, handQ(V(0.1, -1, 0.3), V(-0.2, 0.1, 1)), P.world('foreL').add(V(0.1, -0.25, -0.2)));
        digits(P, 'l', 0.7 + 0.25 * sc, null);
        lookAt(P, spot.clone().add(V(0.15, 0.05, 0.12)), 1); face(P, t, 0, 0.3);
      },
      climb: (P, t) => {
        /* up a trunk in front of it (its face 0.12 m off the bark at x = 0.32): the body upright, limbs reaching up in turn */
        const Tc = 1.1, ph = t / Tc, bark = 0.19, Qb = handQ(V(0, 1, 0), V(1, 0, 0));
        P.off.set(0.18, 0.12 + 0.02 * Math.sin(TAU * ph * 2), 0); P.set('hips', 0, 0, Math.PI / 2 - 0.2); P.set('spine1', 0, 0, 0.05); P.set('chest', 0, 0.04 * Math.sin(TAU * ph), 0.05);
        for (const [key, side, o2] of [['l', -1, 0], ['R', 1, 0.08], ['r', 1, 0.5], ['L', -1, 0.58]]) {
          const [sx, lift] = R.stride(ph - o2, 0.62), hind = key === 'L' || key === 'R', y0 = hind ? 0.33 : 0.78;
          const to = V(bark - lift * 0.035, y0 + sx * 0.08, side * (hind ? 0.08 : 0.065));
          place(P, key, to, Qb, P.world(LIMB[key][1]).add(V(hind ? 0.05 : -0.2, hind ? 0.2 : -0.15, side * 0.3)));
          digits(P, key, 0.55 + 0.4 * lift, Qb);
        }
        look(P, V(0.5, 1, 0.15 * wave(t, 3, 0.5)), 0.8); face(P, t);
        tailTo(P, s => -1.35 - 0.1 * s, s => 0.2 * s * Math.sin(TAU * ph - s * 2));
      },
      leap: (P, t, k) => {
        /* gathering itself, springing off its hind legs, stretched out in the air, landing on its hands */
        const c = (t % 1.6) / 1.6, crouch = sst(0.0, 0.3, c) * (1 - sst(0.36, 0.44, c)), air = sst(0.4, 0.5, c) * (1 - sst(0.82, 0.92, c)), land = sst(0.85, 0.92, c) * (1 - sst(0.95, 1.0, c));
        const fly = clamp((c - 0.42) / 0.45, 0, 1), dist = k.inPlace ? 0 : 1.1 * fly, hgt = 0.32 * Math.sin(Math.PI * fly) * air;
        P.off.set(dist - 0.03 * crouch, -0.07 * crouch + hgt + 0.03 * air, 0);
        P.set('hips', 0, 0, 0.1 * crouch + 0.25 * air * (1 - fly) - 0.2 * air * fly); P.set('spine1', 0, 0, -0.08 * air); P.set('chest', 0, 0, -0.12 * crouch + 0.1 * air);
        const gx = -dist, reachK = air;
        for (const key of ['L', 'R']) { const side = key === 'L' ? -1 : 1, at = H['toe' + key];
          const to = air > 0.5 ? P.at('hips', [-0.36, 0.2, side * 0.07]) : V(at.x + gx * 0 - 0.02 * crouch, at.y, at.z);
          place(P, key, to, qE(0, 0, air > 0.5 ? -1.3 : -0.4 * sst(0.3, 0.42, c))); digits(P, key, air * 0.3); }
        for (const key of ['l', 'r']) { const side = key === 'l' ? -1 : 1, at = H['fing' + key.toUpperCase()];
          const to = air > 0.5 ? P.at('chest', [0.34, 0.22 - 0.1 * fly, side * 0.08]) : V(at.x + 0.03 * crouch + 0.06 * land, at.y, at.z);
          place(P, key, to, qE(0, 0, air > 0.5 ? 0.25 - 0.6 * fly : 0)); digits(P, key, air * 0.25); }
        look(P, V(1, -0.2 - 0.3 * fly * air, 0), 1); face(P, t);
        tailTo(P, s => 0.3 * air + 0.35 - s * (1.2 - air), s => 0.05 * s * Math.sin(t * 3));
      },
      threat: (P, t) => {
        /* the open-mouthed stare: crouched forward, the head thrust out and bobbing, the mouth open, the lids drawn up */
        const bob = Math.max(0, Math.sin(t * 5.5));
        P.off.set(0.01, -0.02 - 0.012 * bob, 0); P.set('hips', 0, 0, -0.06); P.set('chest', 0, 0, -0.1 - 0.05 * bob);
        for (const key of ['L', 'R', 'l', 'r']) { const n = LIMB[key][2], at = key === 'L' || key === 'R' ? H['toe' + n.slice(-1)] : H['fing' + n.slice(-1)]; place(P, key, at.clone().add(V(key === 'l' || key === 'r' ? 0.03 : 0, 0, 0)), qE()); digits(P, key, 0.05); }
        look(P, V(1, -0.05 + 0.1 * bob, 0), 1);
        face(P, t, 0.4 + 0.12 * bob); P.set('lidL', 0, 0, 0.25); P.set('lidR', 0, 0, 0.25); P.set('earL', -0.3, 0, 0); P.set('earR', 0.3, 0, 0);
        tailTo(P, s => 0.9 - s * 1.2, s => 0.05 * s * Math.sin(t * 2));
      },
      yawn: (P, t) => {
        sitBody(P, t, 0.3);
        handDown(P, 'l', 0.106, -0.034, 0.3); handDown(P, 'r', 0.106, 0.034, -0.3);
        const c = (t % 4) / 4, open = sst(0.1, 0.35, c) * (1 - sst(0.6, 0.8, c));
        look(P, V(1, 0.15 + 0.55 * open, 0.1), 1);
        face(P, t, 0.08 + 0.72 * open, open * 0.85);
      },
      lie: (P, t) => {
        /* stretched out along a branch (its top 6 cm below the belly's rest height … here, the ground), limbs hanging */
        P.off.set(0, -0.215, 0); P.set('hips', 0, 0, -0.02); P.set('chest', 0, 0, 0.03);
        for (const [key, side, x] of [['L', -1, -0.05], ['R', 1, -0.12], ['l', -1, 0.2], ['r', 1, 0.15]]) {
          const hind = key === 'L' || key === 'R';
          place(P, key, V(x, 0.035, side * 0.13), qE(side * 0.6, 0, hind ? -0.4 : -0.6), P.world(LIMB[key][1]).add(V(hind ? 0.3 : -0.3, 0.1, side * 0.2)));
          digits(P, key, 0.4);
        }
        look(P, V(1, -0.25, 0.4), 1, 0.5); face(P, t, 0, 0.55 + 0.45 * (wave(t, 3, 0.15) > 0.3 ? 1 : 0));
        tailTo(P, s => -0.05 - 0.9 * s, s => 0.2 * s);
      }
    };
    clips.idle = clips.sit;
    return R.creature(g, S, clips, o);
  });
})();
