/* wild/pig — a Bornean bearded pig (Sus barbatus), as they wander the island's beaches and forest: an adult, about
   1.4 m from snout to rump and 0.72 m at the shoulder, long-legged and lean, standing at the origin facing +x.
   Grey skin through sparse pale bristles, a crest of longer ones down the back, mud on the legs and belly; the long
   head carried low, its snout ending in the flat disc it roots with; the beard — whitish bristles flaring back along
   the snout and cheeks — and the bristled warts on its snout; small eyes, small erect ears; short tusks; a thin tail
   with a tassel in two rows. o.clip: stand, walk, trot, gallop, root (also graze), alert, drink, lie, wallow,
   scratch, shake, sniff. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/pig', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT, wave } = R, TAU = Math.PI * 2, side = s => s < 0 ? 'L' : 'R';
    /* the head's own frame: s along it (from the poll to the disc), h up from its middle line, z across */
    const HA = -0.52, ca = Math.cos(HA), sa = Math.sin(HA), HP = (s, h, z = 0) => [0.54 + ca * s - sa * h, 0.57 + sa * s + ca * h, z];
    const EYE = HP(0.13, 0.036, 0.057), EZ = 0.057;
    const S = R.skeleton([
      ['hips', null, [-0.5, 0.66, 0]], ['spine1', 'hips', [-0.28, 0.69, 0]], ['spine2', 'spine1', [-0.04, 0.705, 0]], ['chest', 'spine2', [0.18, 0.71, 0]],
      ['neck1', 'chest', [0.34, 0.67, 0]], ['neck2', 'neck1', [0.46, 0.61, 0]], ['head', 'neck2', HP(0, 0), { tail: HP(0.4, -0.01) }],
      ['jaw', 'head', HP(0.08, -0.05), { tail: HP(0.36, -0.06) }],
      ...R.sides((s, X) => [['lid' + X, 'head', [EYE[0], EYE[1], s * EZ], { tail: [EYE[0] + 0.01, EYE[1], s * EZ] }], ['ear' + X, 'head', HP(0.0, 0.07, s * 0.05), { tail: HP(-0.03, 0.14, s * 0.075) }]]),
      ['t0', 'hips', [-0.6, 0.64, 0]], ['t1', 't0', [-0.618, 0.575, 0]], ['t2', 't1', [-0.625, 0.505, 0]], ['t3', 't2', [-0.627, 0.435, 0], { tail: [-0.628, 0.37, 0] }],
      ...R.sides((s, X) => [
        ['scap' + X, 'chest', [0.24, 0.66, s * 0.085], { tail: [0.28, 0.47, s * 0.11] }], ['hum' + X, 'scap' + X, [0.28, 0.47, s * 0.11]], ['rad' + X, 'hum' + X, [0.21, 0.35, s * 0.105]],
        ['mc' + X, 'rad' + X, [0.215, 0.165, s * 0.1]], ['hf' + X, 'mc' + X, [0.22, 0.06, s * 0.1], { tail: [0.262, 0.004, s * 0.1] }],
        ['fem' + X, 'hips', [-0.48, 0.6, s * 0.09]], ['tib' + X, 'fem' + X, [-0.39, 0.41, s * 0.1]],
        ['mt' + X, 'tib' + X, [-0.47, 0.215, s * 0.095]], ['hh' + X, 'mt' + X, [-0.455, 0.062, s * 0.095], { tail: [-0.41, 0.004, s * 0.095] }]])
    ]);
    const C = {
      skin: lin('#4c4743'), skinD: lin('#3a3633'), belly: lin('#5a534e'), bristle: lin('#9c9384'), crest: lin('#7f766a'), beard: lin('#d2c7aa'), beardY: lin('#c2ad7e'),
      mud: lin('#3b3127'), disc: lin('#4d3d3a'), hoof: lin('#2a2420'), tusk: lin('#d8cdb0'), iris: lin('#3b2617'), lid: lin('#4d4440'), inner: lin('#6e5450')
    };
    const SKIN = [0.78, 0.02, PAT.skin, 0];
    const mud = (x, y, z) => sst(0.32 + 0.08 * M.fbm(x * 6, y * 3, z * 6, 2), 0.12, y);

    /* ── the body ── */
    const leg = s => {
      const X = side(s);
      return [
        { cap: [[0.28, 0.47, s * 0.11], [0.21, 0.35, s * 0.105]], r: [0.056, 0.04], bone: 'hum' + X, tag: 'leg', k: 0.04 },
        { ell: [0.218, 0.29, s * 0.105], r: [0.04, 0.072, 0.036], rot: [0, 0, 0.03], bone: 'rad' + X, tag: 'leg', k: 0.03 },
        { cap: [[0.21, 0.35, s * 0.105], [0.215, 0.168, s * 0.1]], r: [0.034, 0.021], bone: 'rad' + X, tag: 'leg', k: 0.02 },
        { ell: [0.215, 0.167, s * 0.1], r: [0.023, 0.026, 0.022], bone: 'mc' + X, tag: 'leg', k: 0.012 },
        { cap: [[0.215, 0.165, s * 0.1], [0.22, 0.066, s * 0.1]], r: [0.0185, 0.0165], bone: 'mc' + X, tag: 'leg', k: 0.01 },
        { ell: [0.222, 0.062, s * 0.1], r: [0.02, 0.021, 0.0185], bone: 'hf' + X, tag: 'leg', k: 0.01 },
        { ell: [-0.44, 0.49, s * 0.1], r: [0.11, 0.15, 0.072], rot: [0, 0, -0.3], bone: 'fem' + X, tag: 'leg', k: 0.06 },
        { cap: [[-0.48, 0.6, s * 0.09], [-0.39, 0.41, s * 0.1]], r: [0.07, 0.045], bone: 'fem' + X, tag: 'leg', k: 0.04 },
        { ell: [-0.43, 0.33, s * 0.1], r: [0.045, 0.08, 0.04], rot: [0, 0, 0.35], bone: 'tib' + X, tag: 'leg', k: 0.03 },
        { cap: [[-0.39, 0.41, s * 0.1], [-0.47, 0.215, s * 0.095]], r: [0.035, 0.022], bone: 'tib' + X, tag: 'leg', k: 0.02 },
        { ell: [-0.474, 0.216, s * 0.095], r: [0.025, 0.029, 0.022], bone: 'mt' + X, tag: 'leg', k: 0.012 },
        { cap: [[-0.47, 0.22, s * 0.095], [-0.5, 0.252, s * 0.095]], r: [0.016, 0.012], bone: 'mt' + X, tag: 'leg', k: 0.01 },
        { cap: [[-0.47, 0.215, s * 0.095], [-0.455, 0.068, s * 0.095]], r: [0.0185, 0.0165], bone: 'mt' + X, tag: 'leg', k: 0.01 },
        { ell: [-0.453, 0.064, s * 0.095], r: [0.02, 0.021, 0.0185], bone: 'hh' + X, tag: 'leg', k: 0.01 }];
    };
    const bodyShapes = [
      { ell: [-0.47, 0.58, 0], r: [0.15, 0.13, 0.135], bone: 'hips', tag: 'torso', k: 0 },
      { ell: [-0.45, 0.635, 0], r: [0.12, 0.06, 0.105], bone: 'hips', tag: 'torso', k: 0.06 },
      { ell: [-0.25, 0.612, 0], r: [0.2, 0.105, 0.135], bone: 'spine1', tag: 'torso', k: 0.08 },
      { ell: [-0.02, 0.55, 0], r: [0.22, 0.15, 0.15], bone: 'spine2', tag: 'torso', k: 0.08 },
      { ell: [0.17, 0.56, 0], r: [0.17, 0.165, 0.145], bone: 'chest', tag: 'torso', k: 0.08 },
      { ell: [0.16, 0.66, 0], r: [0.17, 0.062, 0.095], bone: 'chest', tag: 'torso', k: 0.07 },
      ...[-1, 1].map(s => ({ ell: [0.27, 0.56, s * 0.075], r: [0.09, 0.14, 0.07], rot: [0, 0, 0.4], bone: 'scap' + side(s), tag: 'torso', k: 0.06 })),
      { cap: [[0.3, 0.6, 0], [0.5, 0.56, 0]], r: [0.14, 0.105], bone: 'neck1', tag: 'neck', k: 0.07 },
      { ell: [0.42, 0.62, 0], r: [0.12, 0.085, 0.098], bone: 'neck2', tag: 'neck', k: 0.06 },
      { ell: [0.47, 0.49, 0], r: [0.1, 0.07, 0.085], bone: 'neck2', tag: 'neck', k: 0.06 },
      ...leg(-1), ...leg(1)
    ];
    const body = R.sculpt(bodyShapes, { name: 'body', S, cell: 0.0055, tau: 0.014,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const md = mud(x, y, z), up = sst(-0.5, 0.6, ny), crest = sst(0.4, 0.85, ny) * sst(0.5, 0.62, y) * (1 - sst(0.04, 0.07, Math.abs(z)));
        let col = mix(mix(C.belly, C.skin, up), C.skinD, 0.25 + 0.5 * M.fbm(x * 7, y * 7, z * 7, 3));
        col = mix(col, lin('#6d655c'), 0.35 * sst(0.55, 0.75, M.fbm(x * 3 + 5, y * 3, z * 3, 2)));
        col = mix(col, C.mud, md * (0.6 + 0.4 * M.vn(x * 20, y * 20, z * 20)));
        const L = (0.024 + 0.01 * up + 0.05 * crest) * (1 - 0.6 * (tg.leg || 0) * sst(0.45, 0.2, y));
        return { col, mat: md > 0.5 ? [0.82, 0.0, PAT.skin, 0] : SKIN, fur: Math.max(0.006, L), comb: crest > 0.4 ? [-0.7, 0.7, 0] : (tg.leg || 0) > 0.5 ? [-0.15, -1.3, 0] : [-1.4, -0.45, 0] };
      } });

    /* ── the head: poll, face, long snout to its disc, jowls, the warts; the jaw; eyes, nostrils and mouth cut in ── */
    /* (the mouth: a thin cut along the underside of the snout, from below the eye to the front, across its width) */
    const mouthCut = [{ box: HP(0.25, -0.041), h: [0.13, 0.0011, 0.05], rr: 0.0008, rot: [0, 0, HA + 0.04], sub: true, tag: 'mouth', k: 0.002 }];
    const headShapes = [
      { ell: HP(0.05, 0.035), r: [0.105, 0.078, 0.075], rot: [0, 0, HA], bone: 'head', tag: 'poll', k: 0 },
      { ell: HP(0.15, 0.02), r: [0.105, 0.06, 0.064], rot: [0, 0, HA], bone: 'head', tag: 'face', k: 0.04 },
      { cap: [HP(0.17, 0.0), HP(0.372, -0.008)], r: [0.054, 0.034], bone: 'head', tag: 'snout', k: 0.035 },
      { cap: [HP(0.356, -0.008), HP(0.41, -0.008)], r: [0.0315, 0.0315], bone: 'head', tag: 'disc', k: 0.006 },
      { box: HP(0.44, -0.008), h: [0.04, 0.06, 0.06], rot: [0, 0, HA], sub: true, tag: 'disc', k: 0.003 },
      ...[-1, 1].flatMap(s => [
        { ell: HP(0.1, -0.055, s * 0.055), r: [0.085, 0.06, 0.036], rot: [0, 0, HA], bone: 'head', tag: 'jowl', k: 0.04 },
        { ell: HP(0.235, 0.018, s * 0.038), r: [0.026, 0.016, 0.014], rot: [0, 0, HA], bone: 'head', tag: 'wart', k: 0.02 },
        { ell: HP(-0.005, 0.092, s * 0.054), r: [0.026, 0.05, 0.007], rot: [s * 0.45, s * -0.2, HA + 0.65], bone: 'ear' + side(s), tag: 'ear', k: 0.015 },
        { ell: HP(0.0, 0.096, s * 0.0575), r: [0.019, 0.041, 0.0042], rot: [s * 0.45, s * -0.2, HA + 0.65], sub: true, bone: 'ear' + side(s), tag: 'ear', k: 0.002 },
        { ell: [EYE[0] + 0.002, EYE[1], s * (EZ + 0.004)], r: [0.013, 0.0078, 0.011], rot: [0, s * 0.35, HA * 0.4], sub: true, tag: 'socket', k: 0.003 },
        { ell: HP(0.401, -0.012, s * 0.011), r: [0.0065, 0.0058, 0.0048], rot: [0, 0, HA], sub: true, tag: 'nostril', k: 0.0015 }]),
      { ell: HP(0.2, -0.066), r: [0.16, 0.034, 0.046], rot: [0, 0, HA], bone: 'jaw', tag: 'jaw', k: 0.03 },
      { ell: HP(0.33, -0.052), r: [0.042, 0.02, 0.03], rot: [0, 0, HA], bone: 'jaw', tag: 'chin', k: 0.02 },
      ...mouthCut
    ];
    const head = R.sculpt(headShapes, { name: 'head', S, cell: 0.0022, tau: 0.006,
      /* (the lower lip goes with the jaw, below the mouth's line, ahead of its corner) */
      bind: (x, y, z, ws, tw) => {
        const s = (x - 0.54) * ca + (y - 0.57) * sa, h = -(x - 0.54) * sa + (y - 0.57) * ca, ml = -0.041 + 0.04 * (s - 0.25), fw = sst(0.06, 0.13, s);
        if (fw <= 0 || (tw.ear || 0) > 0.5) return ws;
        const jaw = S.ix.jaw, hb = S.ix.head, j = h < ml ? 1 : 0, out = ws.filter(([b]) => b !== jaw && b !== hb).map(([b, w]) => [b, w * (1 - fw)]);
        const wj = ws.filter(([b]) => b === jaw).reduce((a, q) => a + q[1], 0), wh = ws.filter(([b]) => b === hb).reduce((a, q) => a + q[1], 0);
        return [...out, [jaw, wj * (1 - fw) + fw * j * (wj + wh)], [hb, wh * (1 - fw) + fw * (1 - j) * (wj + wh)]];
      },
      paint: (x, y, z, nx, ny, nz, tg) => {
        const s = (x - 0.54) * ca + (y - 0.57) * sa, disc = tg.disc || 0, ear = tg.ear || 0, mo = tg.mouth || 0, sk = tg.socket || 0;
        let col = mix(C.skin, C.skinD, 0.35 * M.fbm(x * 14, y * 14, z * 14, 2));
        col = mix(col, C.disc, Math.max(disc, sst(0.33, 0.38, s) * 0.6));
        if ((tg.nostril || 0) > 0.3) col = mix(col, lin('#1a1312'), sst(0.3, 0.7, tg.nostril));
        if (ear > 0.5) col = mix(C.skinD, lin('#53433f'), sst(-0.2, 0.5, nz * Math.sign(z) * -1));
        if (sk > 0.4) col = mix(col, C.lid, 0.5);
        if (mo > 0.3) col = mix(col, lin('#3a2a28'), sst(0.3, 0.7, mo));
        /* (bristles: sparse all over, fewer on the snout, none on the disc; a ruff of longer ones on the jowls; the warts) */
        const L = (1 - disc) * (1 - sst(0.3, 0.37, s)) * (0.012 + 0.01 * (tg.jowl || 0) + 0.018 * (tg.wart || 0) + 0.012 * sst(0.0, -0.08, s) + 0.01 * ear) * (1 - sk);
        return { col, mat: disc > 0.5 ? [0.55, 0.12, PAT.skin, 0] : ear > 0.5 ? [0.7, 0.02, PAT.skin, 0.3] : SKIN, fur: L, comb: (tg.jowl || tg.wart) ? [-0.8, -0.5, Math.sign(z) * 0.4] : [-0.9, 0.2, 0] };
      } });

    /* ── the hooves: two toes each, pointed, and the dewclaws behind ── */
    const hooves = [];
    for (const [fet, X, s, fore] of R.sides((s, X) => [[[0.22, 0.06, s * 0.1], X, s, true], [[-0.455, 0.062, s * 0.095], X, s, false]])) {
      const bone = (fore ? 'hf' : 'hh') + X, dx = fore ? 0.0 : 0.0;
      hooves.push(...[-1, 1].flatMap(d => [
        { cap: [[fet[0] + 0.008 + dx, fet[1] - 0.022, fet[2] + d * 0.0115], [fet[0] + 0.04, fet[1] - 0.056, fet[2] + d * 0.0095]], r: [0.0135, 0.0045], bone, tag: 'hoof', k: 0.004 },
        { ell: [fet[0] + 0.022, fet[1] - 0.05, fet[2] + d * 0.011], r: [0.02, 0.008, 0.0105], rot: [0, 0, -0.25], bone, tag: 'hoof', k: 0.004 },
        { cap: [[fet[0] - 0.008, fet[1] - 0.012, fet[2] + d * 0.015], [fet[0] - 0.018, fet[1] - 0.034, fet[2] + d * 0.017]], r: [0.0065, 0.003], bone, tag: 'dew', k: 0.003 }]),
        { cap: [[fet[0], fet[1] + 0.004, fet[2]], [fet[0] + 0.012, fet[1] - 0.024, fet[2]]], r: [0.017, 0.016], bone, tag: 'pastern', k: 0.006 });
    }
    const hoof = R.sculpt(hooves, { name: 'hooves', S, cell: 0.0018, tau: 0.003,
      paint: (x, y, z, nx, ny, nz, tg) => (tg.hoof || 0) + (tg.dew || 0) > 0.5 ? { col: C.hoof, mat: [0.55, 0.1, PAT.horn, 0], fur: 0 } : { col: mix(C.skin, C.mud, 0.7), mat: SKIN, fur: 0.008, comb: [0, -1, 0] } });

    /* ── the eyes, the tusks, the beard, the tail's tassel ── */
    const eyes = [-1, 1].map(s => R.eye(S, [EYE[0], EYE[1], s * EZ], 0.0105, [0.42, 0.06, s * 0.9], { col: C.iris, iris: 0.62, pupil: 0.24, white: 0.25, wide: 1.25 }));
    const lids = [-1, 1].map(s => R.lid(S, [EYE[0], EYE[1], s * EZ], 0.0112, [0.42, 0.06, s * 0.9], 'lid' + side(s), C.lid, 0.32));
    const tusks = R.sculpt([-1, 1].flatMap(s => [
      { cap: [HP(0.27, -0.052, s * 0.028), HP(0.285, -0.02, s * 0.034)], r: [0.0062, 0.0042], bone: 'jaw', tag: 'tusk', k: 0.002 },
      { cap: [HP(0.285, -0.02, s * 0.034), HP(0.27, 0.004, s * 0.038)], r: [0.0042, 0.0012], bone: 'jaw', tag: 'tusk', k: 0.002 },
      { cap: [HP(0.255, -0.035, s * 0.032), HP(0.262, -0.01, s * 0.041)], r: [0.005, 0.0012], bone: 'head', tag: 'tusk', k: 0.002 }]), { S, cell: 0.0009, tau: 0.002, paint: () => ({ col: C.tusk, mat: [0.3, 0.5, PAT.horn, 0], fur: 0 }) });
    const rnd = M.rng(31);
    const beardRoots = [];
    for (let i = 0; i < 520; i++) {
      const s = 0.13 + 0.2 * rnd(), sd = rnd() < 0.5 ? -1 : 1, h = -0.03 + 0.04 * rnd(), p = HP(s, h, sd * (0.041 + 0.012 * (1 - (s - 0.13) / 0.2) + 0.006 * rnd()));
      const len = (0.05 + 0.05 * rnd()) * (0.55 + 0.45 * sst(0.33, 0.18, s)), back = [-0.55 - 0.3 * rnd(), -0.25 - 0.3 * rnd(), sd * (0.55 + 0.3 * rnd())], l = Math.hypot(...back);
      beardRoots.push({ p, d: back.map(v => v / l * len), bend: [0, -0.012 - 0.01 * rnd(), 0], r: 0.00055 + 0.0003 * rnd() });
    }
    const beard = R.strands(beardRoots, R.near(S, ['head', 'jaw'], { p: 2 }), (s, i) => mix(C.beard, C.beardY, 0.3 + 0.5 * ((i * 0.618) % 1) * (1 - s)).map(v => v * (0.75 + 0.25 * s)));
    const tassel = [];
    for (let i = 0; i < 70; i++) { const s = i % 2 ? 1 : -1, f = Math.floor(i / 2) / 35, p = [-0.6275, 0.43 - 0.06 * f, s * 0.003], len = 0.06 + 0.03 * rnd(); tassel.push({ p, d: [-0.012 * rnd(), -len * 0.7, s * len * 0.7], bend: [0, -0.02, 0], r: 0.0005 }); }
    const tasselS = R.strands(tassel, () => [[S.ix.t3, 1]], (s) => mix(lin('#3d3631'), C.bristle, s * 0.6));
    const tail = R.tube(new T.CatmullRomCurve3([[-0.585, 0.655, 0], [-0.6, 0.64, 0], [-0.618, 0.575, 0], [-0.625, 0.505, 0], [-0.627, 0.435, 0], [-0.628, 0.375, 0]].map(p => new T.Vector3(...p)), false, 'centripetal'), s => 0.016 - 0.011 * s, { n: 40, m: 10, cap1: 0.003 });
    const tailP = { geo: tail, bind: R.chain(S, ['t0', 't1', 't2', 't3'], { h: 0.5 }), col: C.skin, mat: SKIN, fur: 0.01, comb: [0, -1, 0] };

    const B = R.body(S, [body, head, hoof, ...eyes, ...lids, tusks, beard, tasselS, tailP], { fur: { shells: 12, dens: 0.9, root: 0.85, tip: [1.35, 1.32, 1.25], grav: 0.3, band: [1, 1, 1, 0], sparse: 0.74 } });
    const g = B.g; g.name = 'pig';

    /* ── motions ── */
    const clips = Hoofed.clips(S, {
      tail: ['t0', 't1', 't2', 't3'], speed: { walk: 0.9, trot: 2.2, gallop: 5.5, bound: 4 }, stride: 1.0, tailCarry: -1.45,
      head: { fwd: [ca, sa, 0], graze: [0.6, 0.035, 0] },
      lie: { drop: 0.36, tilt: 0.0,
        fore: s => [[0.28, 0.11, s * 0.11], [0.19, 0.04, s * 0.11], [0.34, 0.025, s * 0.1], [0.24, 0.022, s * 0.1], [0.2, 0.004, s * 0.1]],
        hind: s => [[-0.48, 0.24, s * 0.1], [-0.33, 0.07, s * 0.15], [-0.52, 0.045, s * 0.14], [-0.4, 0.028, s * 0.13], [-0.36, 0.004, s * 0.13]] },
      /* rooting: the disc pushed into the ground and flicked up, again and again */
      root: (P, t) => { const j = Math.max(0, Math.sin(t * 5.2)); P.turn('head', 0, 0, -0.22 * j + 0.08); P.turn('neck2', 0, 0, -0.06 * j); },
      more: (cl, K) => {
        const { V, LEGS, plant, look, face, tailTo, swish, FWD, standLegs } = K;
        cl.root = cl.graze;
        cl.sniff = (P, t) => {
          standLegs(P); P.set('chest', 0, 0, 0.05);
          look(P, V(1, 0.15 + 0.08 * Math.sin(t * 0.9), 0.4 * Math.sin(t * 0.6)), 1); P.turn('head', 0, 0, 0.04 * Math.sin(t * 13));
          face(P, t, 0, 0, 0.6); tailTo(P, s => -1.3, swish(t, 0.6));
        };
        /* wallowing: down on its side in the mud, rocking, the legs paddling now and then */
        cl.wallow = (P, t) => {
          const rock = 0.12 * Math.sin(t * 0.9), kick = Math.max(0, Math.sin(t * 2.2)) * (R.every(t, 5, 2.5, 3) > 0 ? 1 : 0);
          P.off.set(0, -0.52, 0.0); P.set('hips', 1.35 + rock, 0, 0); P.set('chest', 0.05, 0, 0);
          for (const key in LEGS) { const L = LEGS[key], up = L.s > 0 ? 1 : 0, k = Math.sin(t * 4.4 + (L.fore ? 0 : 1.5)) * kick * 0.06;
            plant(P, key, P.at(L.fore ? 'chest' : 'hips', L.toe.clone().add(V(k + (L.fore ? 0.05 : -0.05), 0.08 + 0.05 * up, 0)).toArray()), -0.3, L.fore ? -0.4 : 0.3, P.world(L.mid).add(V(L.fore ? -0.4 : 0.4, 0, 0))); }
          look(P, V(1, 0.1, -0.6), 0.7); face(P, t, 0.02, 0.6); tailTo(P, s => -2.2, s => 0.3 * s * Math.sin(t * 1.3));
        };
      }
    });
    return R.creature(g, S, clips, o);
  });
})();
