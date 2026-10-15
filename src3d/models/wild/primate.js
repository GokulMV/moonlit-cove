/* wild/primate.js — what the island's monkeys share (wild/macaque, wild/proboscis): a skeleton laid out as a long-tailed
   macaque stands on all fours (the others are built to the same plan and their group scaled), a body sculpted to its
   proportions, hands and feet with their nails, a tail, eyes with their lids, teeth, and every motion — stand, walk,
   run, sit (idle), eat, groom, scratch, climb, leap, threat, yawn, lie. A species gives its head, its colours and fur
   and how it paints them, and anything it does of its own.
   Primate.build(o, sp) → the model; sp (all in the macaque's frame, metres, facing +x):
     C            colours: hand, handF (the fur on the backs of hands and feet), nail, lid, iris, palate, tongue, lip
     body         { belly (how big, 1 the macaque's), chest, limb (the limbs' thickness), paint(x, y, z, nx, ny, nz, tags) }
     head         { shapes, paint, mouth (its height), corner (x where the lips part from), cell }
     eye          { at: [x, y], z, r, irisR, pupilR, white }
     teeth        the shapes of the teeth (bones head and jaw)
     tail         { pts: [[x, y], …] ten of them, r(s) its radius, fur(s), col(x, y, z, a, s) }
     fur          the shells: { shells, dens, root, tip, grav, band }
     web          how far the toes are webbed (0..1)
     bones        more bones: [name, parent, [x, y, z], { tail }]
     face(P, t)   more to do with the face each frame (a nose that swings)
     clips(clips, kit)  more clips, or different ones */
const Primate = (() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  function build(o, sp) {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave } = R, fem = !!o.female, C = sp.C;
    const FUR = [0.88, 0, PAT.fur, 0], SKIN = [0.5, 0.2, PAT.skin, 0], NAIL = [0.32, 0.55, PAT.horn, 0];
    const grizzle = (c, x, y, z) => c.map(v => v * (0.9 + 0.2 * M.fbm(x * 40, y * 40, z * 40, 2)));
    const EYE = sp.eye.at, EZ = sp.eye.z ?? 0.0165, ER = sp.eye.r ?? 0.0093;
    const TP = sp.tail.pts;
    const S = R.skeleton([
      ['hips', null, [-0.125, 0.3, 0]],
      ['spine1', 'hips', [-0.05, 0.312, 0]], ['spine2', 'spine1', [0.03, 0.318, 0]], ['chest', 'spine2', [0.1, 0.322, 0]],
      ['neck', 'chest', [0.172, 0.34, 0]], ['head', 'neck', [0.215, 0.368, 0], { tail: [0.335, 0.356, 0] }],
      ['jaw', 'head', [0.248, 0.352, 0], { tail: [0.325, 0.335, 0] }],
      ...R.sides((s, X) => [['lid' + X, 'head', [EYE[0], EYE[1], s * EZ], { tail: [EYE[0] + 0.01, EYE[1], s * EZ] }], ['ear' + X, 'head', [0.235, 0.386, s * 0.034], { tail: [0.234, 0.402, s * 0.043] }]]),
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
      /* the tail: nine bones along the way it is carried */
      ...TP.slice(0, 9).map((p, i) => ['t' + i, i ? 't' + (i - 1) : 'hips', [p[0], p[1], 0], i === 8 ? { tail: [TP[9][0], TP[9][1], 0] } : {}]),
      ...(sp.bones || [])
    ]);
    const TAILN = Array.from({ length: 9 }, (_, i) => 't' + i), side = s => s < 0 ? 'L' : 'R';

    /* ── the body: torso, neck, arms to the wrists, legs to the ankles ── */
    const bd = sp.body, bel = bd.belly ?? 1, ch = bd.chest ?? 1, lb = bd.limb ?? 1;
    const bodyShapes = [
      { ell: [-0.125, 0.298, 0], r: [0.07, 0.068, 0.066], bone: 'hips', tag: 'torso', k: 0 },
      { ell: [-0.16, 0.283, 0], r: [0.046, 0.058, 0.06], bone: 'hips', tag: 'rump', k: 0.03 },
      { ell: [-0.06, 0.305 - 0.012 * (bel - 1), 0], r: [0.075, 0.062 * (1 + 0.25 * (bel - 1)), 0.06 * (1 + 0.3 * (bel - 1))], bone: 'spine1', tag: 'torso', k: 0.04 },
      { ell: [0.0, 0.29 - 0.03 * (bel - 1), 0], r: [0.07 * (1 + 0.3 * (bel - 1)), 0.057 * bel, 0.063 * (1 + 0.55 * (bel - 1))], bone: 'spine1', tag: 'belly', k: 0.04, w: 0.8 },
      { ell: [0.06, 0.306, 0], r: [0.08, 0.07 * ch, 0.068 * ch], bone: 'spine2', tag: 'torso', k: 0.04 },
      { ell: [0.125, 0.312, 0], r: [0.055, 0.068 * ch, 0.066 * ch], bone: 'chest', tag: 'torso', k: 0.04 },
      ...[-1, 1].map(s => ({ ell: [0.118, 0.352, s * 0.042], r: [0.048, 0.022, 0.03], rot: [0, 0, -0.1], bone: 'chest', tag: 'torso', k: 0.03 })),
      ...[-1, 1].map(s => ({ ell: [0.152, 0.29, s * 0.034], r: [0.03, 0.04, 0.03], bone: 'chest', tag: 'torso', k: 0.025 })),
      { cap: [[0.15, 0.33, 0], [0.232, 0.366, 0]], r: [0.046, 0.03], bone: 'neck', tag: 'neck', k: 0.03 },
      ...[-1, 1].flatMap(s => [
        { ell: [0.155, 0.302, s * 0.066], r: [0.034 * lb, 0.036 * lb, 0.028 * lb], rot: [0, 0, 0.1], bone: 'arm' + side(s), tag: 'arm', k: 0.025 },
        { cap: [[0.155, 0.3, s * 0.068], [0.143, 0.18, s * 0.071]], r: [0.025 * lb, 0.019 * lb], bone: 'arm' + side(s), tag: 'arm', k: 0.02 },
        { ell: [0.149, 0.24, s * 0.07], r: [0.024 * lb, 0.045, 0.022 * lb], rot: [0, 0, 0.1], bone: 'arm' + side(s), tag: 'arm', k: 0.02 },
        { cap: [[0.143, 0.176, s * 0.071], [0.157, 0.042, s * 0.072]], r: [0.019 * lb, 0.012], bone: 'fore' + side(s), tag: 'arm', k: 0.015 },
        { ell: [0.147, 0.14, s * 0.071], r: [0.021 * lb, 0.038, 0.019 * lb], rot: [0, 0, 0.12], bone: 'fore' + side(s), tag: 'arm', k: 0.015 },
        { cap: [[-0.125, 0.285, s * 0.055], [-0.045, 0.166, s * 0.06]], r: [0.04 * lb, 0.023 * lb], bone: 'thigh' + side(s), tag: 'leg', k: 0.03 },
        { ell: [-0.092, 0.236, s * 0.058], r: [0.06, 0.034 * lb, 0.038 * lb], rot: [0, 0, -0.98], bone: 'thigh' + side(s), tag: 'leg', k: 0.03 },
        { ell: [-0.118, 0.228, s * 0.058], r: [0.026 * lb, 0.044, 0.032 * lb], rot: [0, 0, -0.5], bone: 'thigh' + side(s), tag: 'leg', k: 0.03 },
        { cap: [[-0.045, 0.166, s * 0.06], [-0.108, 0.046, s * 0.062]], r: [0.022 * lb, 0.013], bone: 'shin' + side(s), tag: 'leg', k: 0.015 },
        { ell: [-0.088, 0.118, s * 0.062], r: [0.024 * lb, 0.046, 0.022 * lb], rot: [0, 0, -0.48], bone: 'shin' + side(s), tag: 'leg', k: 0.015 }]),
      ...(bd.extra || [])
    ];
    const body = R.sculpt(bodyShapes, { name: 'body', S, cell: 0.003, tau: 0.008, paint: (x, y, z, nx, ny, nz, tg) => bd.paint(x, y, z, nx, ny, nz, tg, { grizzle, FUR, SKIN }) });

    /* ── the head (the species' own shapes): its lips part along the mouth — everything below it, ahead of its corners,
       goes with the jaw ── */
    const hd = sp.head, MOUTH = hd.mouth, C0 = hd.corner ?? 0.272;
    const head = R.sculpt(hd.shapes, { name: 'head', S, cell: hd.cell || 0.001, tau: 0.0035,
      bind: hd.bind || ((x, y, z, ws, tw) => {
        const fw = sst(C0, C0 + 0.02, x) * (1 - sst(0.3, 0.6, tw.nose || 0)); if (fw <= 0) return ws;
        const jaw = S.ix.jaw, hb = S.ix.head, j = y < MOUTH ? 1 : 0, out = ws.filter(([b]) => b !== jaw && b !== hb).map(([b, w]) => [b, w * (1 - fw)]);
        const wj = ws.filter(([b]) => b === jaw).reduce((a, q) => a + q[1], 0), wh = ws.filter(([b]) => b === hb).reduce((a, q) => a + q[1], 0);
        return [...out, [jaw, wj * (1 - fw) + fw * j * (wj + wh)], [hb, wh * (1 - fw) + fw * (1 - j) * (wj + wh)]];
      }),
      paint: (x, y, z, nx, ny, nz, tg) => hd.paint(x, y, z, nx, ny, nz, tg, { grizzle, FUR, SKIN }) });

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
    const toes = [[-0.03, -0.0575, 0.06, 0.03, 0.0039], [-0.028, -0.0645, 0.0, 0.035, 0.0041], [-0.03, -0.0715, -0.06, 0.034, 0.0039], [-0.035, -0.0785, -0.13, 0.028, 0.0035]];
    const footShapes = [
      { cap: [[-0.108, 0.054, -0.062], [-0.106, 0.03, -0.062]], r: [0.013, 0.0145], bone: 'footL', tag: 'wrist', k: 0 },
      { ell: [-0.118, 0.0175, -0.062], r: [0.017, 0.0145, 0.0135], bone: 'footL', tag: 'palm', k: 0.008 },
      { ell: [-0.07, 0.0118, -0.0625], r: [0.044, 0.0094, 0.0172], bone: 'footL', tag: 'palm', k: 0.01 },
      { ell: [-0.032, 0.0098, -0.066], r: [0.012, 0.0078, 0.0185], bone: 'toeL', tag: 'palm', k: 0.008 },
      ...toes.flatMap(([x, z, a, l, r]) => finger(x, 0.0098, z, a, l, r, 'toeL', 'toeL', 0.004)),
      ...finger(-0.075, 0.013, -0.0505, 0.55, 0.034, 0.0052, 'halluxL', 'halluxL', 0.005),
      /* (the webs between the toes, as far along them as sp.web says) */
      ...(sp.web ? toes.slice(0, 3).map(([x, z, a, l], i) => { const [x2, z2, a2, l2] = toes[i + 1], f = 0.25 + 0.5 * sp.web, P1 = [x + Math.cos(a) * l * f, 0.0092, z + Math.sin(a) * l * f], P2 = [x2 + Math.cos(a2) * l2 * f, 0.0092, z2 + Math.sin(a2) * l2 * f];
        return { cap: [P1, P2], r: [0.0016, 0.0016], bone: 'toeL', tag: 'digit', k: 0.004 }; }) : [])
    ];
    const extremity = (sh, name) => R.sculpt(sh, { name, S, cell: 0.0011, tau: 0.003,
      paint: (x, y, z, nx, ny, nz, tg) => {
        if ((tg.nail || 0) > 0.5) return { col: C.nail, mat: NAIL, fur: 0 };
        const back = Math.min(1, sst(0.15, 0.6, ny) * sst(0.0105, 0.016, y) * (1 - 0.75 * (tg.digit || 0)) + (tg.wrist || 0) * 0.9);
        return { col: mix(C.hand, grizzle(C.handF, x, y, z), back), mat: back > 0.5 ? FUR : [0.72, 0.03, PAT.skin, 0], fur: back * 0.005, comb: [0.7, -0.3, 0] };
      } });
    const handL = extremity(handShapes, 'hand'), footL = extremity(footShapes, 'foot');

    /* ── the tail: tapering, its fur lying back along it ── */
    const TC = new T.CatmullRomCurve3([...TAILN.map(n => S.head[n].clone()), S.tail.t8.clone()], false, 'centripetal'), tl = sp.tail;
    const tailG = R.tube(TC, tl.r, { n: 90, m: 14, cap1: 0.004, cap0: 0.006 }), UV = tailG.attributes.uv;
    const tail = { geo: tailG, bind: R.chain(S, TAILN, { h: 0.5 }),
      col: (x, y, z, i) => grizzle(tl.col(x, y, z, UV.getY(i) * TAU, UV.getX(i)), x, y, z), mat: FUR,
      fur: (x, y, z, i) => tl.fur(UV.getX(i)), comb: (x, y, z, i) => TC.getTangentAt(UV.getX(i)).multiplyScalar(1.5).toArray() };

    /* ── the eyes and their upper lids (their uv: how far round from the middle of the cornea, and round it) ── */
    const eyeG = s => { const g = new T.SphereGeometry(ER, 28, 20); g.rotateZ(-Math.PI / 2); g.rotateY(-s * 0.12); g.translate(EYE[0], EYE[1], s * EZ);
      const P = g.attributes.position, U = g.attributes.uv, ax = new T.Vector3(Math.cos(s * 0.12), 0, Math.sin(s * 0.12));
      for (let i = 0; i < P.count; i++) { const n = new T.Vector3(P.getX(i) - EYE[0], P.getY(i) - EYE[1], P.getZ(i) - s * EZ).normalize(); U.setXY(i, Math.acos(clamp(n.dot(ax), -1, 1)) / (Math.PI / 2), (Math.atan2(n.z * ax.x - n.x * ax.z, n.y) / TAU + 1) % 1); }
      return g; };
    const eyes = [-1, 1].map(s => ({ geo: eyeG(s), bind: R.rigid(S, 'head'), col: C.iris, mat: [0.1, 0.55, PAT.eye, 0], eye: [0, sp.eye.irisR ?? 0.44, sp.eye.pupilR ?? 0.15, sp.eye.white ?? 0.05] }));
    const lidG = s => { const g = new T.SphereGeometry(ER * 1.055, 24, 10, Math.PI * 0.06, Math.PI * 0.88, 0, Math.PI * 0.31); g.rotateY(Math.PI / 2 - s * 0.12); g.rotateZ(-0.3); g.translate(EYE[0], EYE[1], s * EZ); return g; };
    const lids = [-1, 1].map(s => ({ geo: lidG(s), bind: R.rigid(S, 'lid' + side(s)), col: C.lid, mat: [0.6, 0.05, PAT.skin, 0] }));
    const teeth = R.sculpt(sp.teeth(fem), { S, cell: 0.0005, tau: 0.001, paint: () => ({ col: lin(sp.toothCol || '#d6cbb0'), mat: [0.25, 0.6, PAT.horn, 0], fur: 0 }) });

    const B = R.body(S, [body, head, handL, R.mirror(handL, S), footL, R.mirror(footL, S), tail, ...eyes, ...lids, teeth, ...(sp.parts ? sp.parts(S) : [])], { fur: sp.fur });
    const g = B.g; g.name = sp.name;
    g.scale.setScalar(sp.scale ?? 1);

    /* ── motions ── */
    const V = (x, y, z) => new T.Vector3(x, y, z), qE = R.qE, H = S.head;
    /* the head turned to look along dir (its neck taking part of the turn), its crown kept up */
    const FWD = V(1, -0.1, 0).normalize();
    const look = (P, dir, k = 1, roll = 0) => {
      const d = dir.clone().normalize(), sd = new T.Vector3().crossVectors(d, V(0, 1, 0)); if (sd.lengthSq() < 1e-6) sd.set(0, 0, 1); sd.normalize();
      const W = R.frameTo(FWD, V(0, 0, 1), d, sd.applyAxisAngle(d, roll)), Qc = new T.Quaternion(); P.world('chest', V(), Qc);
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
      if (sp.face) sp.face(P, t, jaw);
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
    /* a hand turned so its fingers point along f and its palm faces p (both in the model's frame) */
    const handQ = (f, p) => R.frameTo(V(1, 0, 0), V(0, -1, 0), f.clone().normalize(), p.clone().normalize());
    const standAll = (P, dx = 0) => { for (const key of ['L', 'R', 'l', 'r']) { const n = LIMB[key][2], at = key === 'L' || key === 'R' ? H['toe' + n.slice(-1)] : H['fing' + n.slice(-1)]; place(P, key, at.clone().add(V(key === 'l' || key === 'r' ? dx : 0, 0, 0)), qE()); digits(P, key, 0.05); } };

    /* walking and running: the feet in turn (a walk in diagonal sequence, as monkeys walk; a gallop), the body rising
       and rolling over them, the head held steady, the tail carried in an arch */
    const gait = (P, t, k, run) => {
      const v = (k.speed ?? (run ? 2.4 : 0.7)) / (sp.scale ?? 1), Tc = run ? 0.36 : clamp(0.82 - 0.09 * v, 0.55, 0.85), beta = run ? 0.36 : 0.66, ph = t / Tc, D = v * Tc * beta;
      const ord = run ? { L: 0, R: 0.12, l: 0.52, r: 0.64 } : { L: 0, r: 0.25, R: 0.5, l: 0.75 };
      const s2 = Math.sin(TAU * ph);
      P.off.set(0, run ? -0.012 + 0.014 * Math.sin(TAU * ph + 0.6) : -0.004 - 0.005 * Math.cos(2 * TAU * ph), 0);
      if (run) { P.set('hips', 0, 0.02 * s2, -0.1 * s2); P.set('spine1', 0, 0, 0.06 * Math.sin(TAU * ph + 0.4)); P.set('spine2', 0, 0, 0.06 * Math.sin(TAU * ph + 0.9)); P.set('chest', 0, 0, 0.07 * Math.sin(TAU * ph + 1.4)); }
      else { P.set('hips', 0.035 * s2, 0.055 * Math.sin(TAU * ph - 0.6), 0.015 * Math.cos(2 * TAU * ph)); P.set('spine1', 0, -0.02 * s2, 0); P.set('spine2', -0.01 * s2, -0.025 * s2, 0); P.set('chest', -0.03 * s2, -0.03 * Math.sin(TAU * ph + 0.5), 0); }
      for (const key of ['L', 'R', 'l', 'r']) {
        const hind = key === 'L' || key === 'R', sd = key === 'L' || key === 'l' ? -1 : 1, [sx, lift, down] = R.stride(ph - ord[key], beta);
        const at = hind ? H['toe' + side(sd)] : H['fing' + side(sd)], u = (1 - sx) / 2;
        const to = V(at.x + sx * D / 2, at.y + lift * (run ? 0.07 : hind ? 0.04 : 0.05), at.z + sd * (run ? 0.004 : 0));
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
      P.off.set(0.0, -0.236 + (sp.sitLift || 0), 0);
      P.set('hips', 0, 0, SIT.hips - lean * 0.3); P.set('spine1', 0, 0.02 * wave(t, 4, 0.3), SIT.spine1 - lean * 0.4); P.set('spine2', 0, 0, SIT.spine2 - lean * 0.3); P.set('chest', 0.02 * wave(t, 6, 0.25), 0, SIT.chest - lean * 0.3);
      const fx = 0.04 + 0.05 * lean;
      place(P, 'L', V(fx, 0.012, -0.075), qE(0, 0.35, 0), P.world('shinL').add(V(0.05, 0.25, -0.16))); digits(P, 'L', 0, qE(0, 0.35, 0));
      place(P, 'R', V(fx, 0.012, 0.075), qE(0, -0.35, 0), P.world('shinR').add(V(0.05, 0.25, 0.16))); digits(P, 'R', 0, qE(0, -0.35, 0));
      tailTo(P, s => s < 0.12 ? -0.55 : -0.03, s => 0.25 * s + 0.08 * wave(t, 12, 0.3) * s);
    };
    const handDown = (P, key, x, z, yaw = 0) => { place(P, key, V(x, 0.011, z), qE(0, yaw, 0), P.world(LIMB[key][1]).add(V(-0.3, -0.05, key === 'l' ? -0.25 : 0.25))); digits(P, key, 0.15, qE(0, yaw, 0)); };
    const handsDown = P => { handDown(P, 'l', 0.106, -0.034, 0.3); handDown(P, 'r', 0.106, 0.034, -0.3); };

    const clips = {
      stand: (P, t) => {
        P.off.set(0, -0.003 + 0.002 * Math.sin(t * 1.3), 0);
        P.set('hips', 0, 0.03 * wave(t, 1, 0.3), 0); P.set('chest', 0, 0.03 * wave(t, 2, 0.3), 0.02 * wave(t, 3, 0.2));
        standAll(P);
        look(P, V(1, -0.15 + 0.12 * wave(t, 5, 0.4), 0.55 * wave(t, 7, 0.35)), 1);
        face(P, t); tailTo(P, s => 0.45 - s * 1.5, s => 0.15 * s * wave(t, 8, 0.4));
      },
      walk: (P, t, k) => gait(P, t, k, false),
      run: (P, t, k) => gait(P, t, k, true),
      sit: (P, t) => {
        sitBody(P, t, 0.3); handsDown(P);
        look(P, V(1, -0.1 + 0.15 * wave(t, 5, 0.35), 0.8 * wave(t, 7, 0.3)), 1, 0.1 * wave(t, 11, 0.3));
        face(P, t);
      },
      eat: (P, t) => {
        sitBody(P, t, 0.25);
        handDown(P, 'l', 0.1, -0.036, 0.3);
        /* (the right hand to the mouth and back: a bite, chewed; the head bent a little to meet it) */
        const c = (t % 3.2) / 3.2, up = sst(0.0, 0.18, c) * (1 - sst(0.55, 0.75, c));
        look(P, V(1, -0.25 - 0.15 * up, 0.12 * up), 1);
        const mouth = P.at('head', sp.mouthAt || [0.325, 0.349, 0.004]), kn = P.world('shinR'), rest = kn.clone().add(V(0.02, 0.012, 0.0));
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
        /* up a trunk in front of it (the bark at x = 0.19 in its frame): the body upright, limbs reaching up in turn */
        const Tc = 1.1, ph = t / Tc, bark = 0.19, Qb = handQ(V(0, 1, 0), V(1, 0, 0));
        P.off.set(0.18, 0.12 + 0.02 * Math.sin(TAU * ph * 2), 0); P.set('hips', 0, 0, Math.PI / 2 - 0.2); P.set('spine1', 0, 0, 0.05); P.set('chest', 0, 0.04 * Math.sin(TAU * ph), 0.05);
        for (const [key, sd, o2] of [['l', -1, 0], ['R', 1, 0.08], ['r', 1, 0.5], ['L', -1, 0.58]]) {
          const [sx, lift] = R.stride(ph - o2, 0.62), hind = key === 'L' || key === 'R', y0 = hind ? 0.33 : 0.78;
          const to = V(bark - lift * 0.035, y0 + sx * 0.08, sd * (hind ? 0.08 : 0.065));
          place(P, key, to, Qb, P.world(LIMB[key][1]).add(V(hind ? 0.05 : -0.2, hind ? 0.2 : -0.15, sd * 0.3)));
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
        for (const key of ['L', 'R']) { const sd = key === 'L' ? -1 : 1, at = H['toe' + key];
          const to = air > 0.5 ? P.at('hips', [-0.36, 0.2, sd * 0.07]) : V(at.x - 0.02 * crouch, at.y, at.z);
          place(P, key, to, qE(0, 0, air > 0.5 ? -1.3 : -0.4 * sst(0.3, 0.42, c))); digits(P, key, air * 0.3); }
        for (const key of ['l', 'r']) { const sd = key === 'l' ? -1 : 1, at = H['fing' + key.toUpperCase()];
          const to = air > 0.5 ? P.at('chest', [0.34, 0.22 - 0.1 * fly, sd * 0.08]) : V(at.x + 0.03 * crouch + 0.06 * land, at.y, at.z);
          place(P, key, to, qE(0, 0, air > 0.5 ? 0.25 - 0.6 * fly : 0)); digits(P, key, air * 0.25); }
        look(P, V(1, -0.2 - 0.3 * fly * air, 0), 1); face(P, t);
        tailTo(P, s => 0.3 * air + 0.35 - s * (1.2 - air), s => 0.05 * s * Math.sin(t * 3));
      },
      threat: (P, t) => {
        /* the open-mouthed stare: crouched forward, the head thrust out and bobbing, the mouth open, the lids drawn up */
        const bob = Math.max(0, Math.sin(t * 5.5));
        P.off.set(0.01, -0.02 - 0.012 * bob, 0); P.set('hips', 0, 0, -0.06); P.set('chest', 0, 0, -0.1 - 0.05 * bob);
        standAll(P, 0.03);
        look(P, V(1, -0.05 + 0.1 * bob, 0), 1);
        face(P, t, 0.4 + 0.12 * bob); P.set('lidL', 0, 0, 0.25); P.set('lidR', 0, 0, 0.25); P.set('earL', -0.3, 0, 0); P.set('earR', 0.3, 0, 0);
        tailTo(P, s => 0.9 - s * 1.2, s => 0.05 * s * Math.sin(t * 2));
      },
      yawn: (P, t) => {
        sitBody(P, t, 0.3); handsDown(P);
        const c = (t % 4) / 4, open = sst(0.1, 0.35, c) * (1 - sst(0.6, 0.8, c));
        look(P, V(1, 0.15 + 0.55 * open, 0.1), 1);
        face(P, t, 0.08 + 0.72 * open, open * 0.85);
      },
      lie: (P, t) => {
        /* stretched out along a branch (here, the ground), limbs hanging */
        P.off.set(0, -0.215, 0); P.set('hips', 0, 0, -0.02); P.set('chest', 0, 0, 0.03);
        for (const [key, sd, x] of [['L', -1, -0.05], ['R', 1, -0.12], ['l', -1, 0.2], ['r', 1, 0.15]]) {
          const hind = key === 'L' || key === 'R';
          place(P, key, V(x, 0.035, sd * 0.13), qE(sd * 0.6, 0, hind ? -0.4 : -0.6), P.world(LIMB[key][1]).add(V(hind ? 0.3 : -0.3, 0.1, sd * 0.2)));
          digits(P, key, 0.4);
        }
        look(P, V(1, -0.25, 0.4), 1, 0.5); face(P, t, 0, 0.55 + 0.45 * (wave(t, 3, 0.15) > 0.3 ? 1 : 0));
        tailTo(P, s => -0.05 - 0.9 * s, s => 0.2 * s);
      }
    };
    if (sp.clips) sp.clips(clips, { R, V, qE, H, S, look, lookAt, face, tailTo, place, digits, handQ, standAll, sitBody, handDown, handsDown, gait, LIMB, TAU });
    clips.idle = clips.idle || clips.sit;
    return R.creature(g, S, clips, o);
  }
  return { build };
})();
