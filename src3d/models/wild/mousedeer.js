/* wild/mousedeer — a lesser mouse-deer (Tragulus kanchil), the smallest hoofed animal there is, picking its way
   through the island's forest floor: an adult male, about 45 cm long and 20 cm at the shoulder, some 2 kg, at the
   origin facing +x. The back arched, the rump higher than the shoulders; legs as thin as pencils on tiny hooves; a
   small pointed head with large dark eyes, a black wet nose, small round ears, and (his) little tusks below the lips.
   Rich red-brown above, darker down the back, white beneath, and on its throat the white stripes between brown; a short
   tail, white under, flicked up in alarm. o.female: no tusks. o.clip: stand, walk, trot, bound, browse (also graze),
   alert, drink, lie, scratch, shake, stamp (the alarm, drummed with a hind hoof). */
(() => {
  const T = THREE, M = Models;
  M.add('wild/mousedeer', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R, side = s => s < 0 ? 'L' : 'R', fem = !!o.female;
    const EYE = [0.2045, 0.2615], EZ = 0.0126;
    const S = R.skeleton([
      ['hips', null, [-0.16, 0.215, 0]], ['spine1', 'hips', [-0.09, 0.225, 0]], ['spine2', 'spine1', [-0.02, 0.215, 0]], ['chest', 'spine2', [0.055, 0.2, 0]],
      ['neck1', 'chest', [0.105, 0.2, 0]], ['neck2', 'neck1', [0.15, 0.226, 0]], ['head', 'neck2', [0.179, 0.252, 0], { tail: [0.268, 0.219, 0] }],
      ['jaw', 'head', [0.199, 0.238, 0], { tail: [0.258, 0.212, 0] }],
      ...R.sides((s, X) => [['lid' + X, 'head', [EYE[0], EYE[1], s * EZ], { tail: [EYE[0] + 0.005, EYE[1], s * EZ] }], ['ear' + X, 'head', [0.184, 0.271, s * 0.014], { tail: [0.177, 0.29, s * 0.022] }]]),
      ['t0', 'hips', [-0.2, 0.208, 0]], ['t1', 't0', [-0.222, 0.192, 0]], ['t2', 't1', [-0.236, 0.172, 0], { tail: [-0.245, 0.15, 0] }],
      ...R.sides((s, X) => [
        ['scap' + X, 'chest', [0.062, 0.19, s * 0.019], { tail: [0.073, 0.14, s * 0.029] }], ['hum' + X, 'scap' + X, [0.073, 0.14, s * 0.029]], ['rad' + X, 'hum' + X, [0.059, 0.1, s * 0.028]],
        ['mc' + X, 'rad' + X, [0.062, 0.045, s * 0.026]], ['hf' + X, 'mc' + X, [0.0635, 0.0125, s * 0.025], { tail: [0.0725, 0.0012, s * 0.025] }],
        ['fem' + X, 'hips', [-0.152, 0.19, s * 0.024]], ['tib' + X, 'fem' + X, [-0.118, 0.122, s * 0.027]],
        ['mt' + X, 'tib' + X, [-0.158, 0.07, s * 0.025]], ['hh' + X, 'mt' + X, [-0.1545, 0.0135, s * 0.025], { tail: [-0.1465, 0.0012, s * 0.025] }]])
    ]);
    const C = {
      back: lin('#563720'), spine: lin('#3d2716'), flank: lin('#684629'), belly: lin('#c4bcac'), throatW: lin('#c9c2b2'), throatB: lin('#4c331f'),
      leg: lin('#4c3220'), legIn: lin('#9b9180'), head: lin('#5a3a22'), muzzle: lin('#3f2b1c'), nose: lin('#141110'), hoof: lin('#262220'),
      iris: lin('#1d130c'), lid: lin('#3a2a20'), ear: lin('#4a3324'), earIn: lin('#6e5546')
    };
    const FUR = [0.82, 0, PAT.fur, 0];

    /* ── the body: arched back and rump, slim chest, thin neck, the pencil legs ── */
    const leg = s => {
      const X = side(s);
      return [
        { cap: [[0.073, 0.14, s * 0.029], [0.059, 0.1, s * 0.028]], r: [0.0105, 0.0075], bone: 'hum' + X, tag: 'leg', k: 0.008 },
        { cap: [[0.059, 0.1, s * 0.028], [0.062, 0.047, s * 0.026]], r: [0.0068, 0.0042], bone: 'rad' + X, tag: 'leg', k: 0.005 },
        { ell: [0.0605, 0.085, s * 0.027], r: [0.0078, 0.016, 0.0068], bone: 'rad' + X, tag: 'leg', k: 0.004 },
        { cap: [[0.062, 0.045, s * 0.026], [0.0635, 0.014, s * 0.025]], r: [0.0036, 0.0032], bone: 'mc' + X, tag: 'leg', k: 0.002 },
        { ell: [0.062, 0.045, s * 0.026], r: [0.0045, 0.005, 0.0042], bone: 'mc' + X, tag: 'leg', k: 0.002 },
        { ell: [-0.14, 0.15, s * 0.026], r: [0.03, 0.04, 0.019], rot: [0, 0, -0.35], bone: 'fem' + X, tag: 'leg', k: 0.012 },
        { cap: [[-0.152, 0.19, s * 0.024], [-0.118, 0.122, s * 0.027]], r: [0.014, 0.009], bone: 'fem' + X, tag: 'leg', k: 0.008 },
        { cap: [[-0.118, 0.122, s * 0.027], [-0.158, 0.07, s * 0.025]], r: [0.0075, 0.0045], bone: 'tib' + X, tag: 'leg', k: 0.004 },
        { ell: [-0.132, 0.1, s * 0.026], r: [0.0085, 0.017, 0.0072], rot: [0, 0, 0.6], bone: 'tib' + X, tag: 'leg', k: 0.004 },
        { cap: [[-0.158, 0.071, s * 0.025], [-0.163, 0.078, s * 0.025]], r: [0.0045, 0.0035], bone: 'mt' + X, tag: 'leg', k: 0.002 },
        { cap: [[-0.158, 0.07, s * 0.025], [-0.1545, 0.015, s * 0.025]], r: [0.0036, 0.0032], bone: 'mt' + X, tag: 'leg', k: 0.002 }];
    };
    const bodyShapes = [
      { ell: [-0.148, 0.188, 0], r: [0.058, 0.046, 0.043], bone: 'hips', tag: 'torso', k: 0 },
      { ell: [-0.088, 0.192, 0], r: [0.064, 0.042, 0.041], bone: 'spine1', tag: 'torso', k: 0.02 },
      { ell: [-0.022, 0.172, 0], r: [0.066, 0.044, 0.042], bone: 'spine2', tag: 'torso', k: 0.02 },
      { ell: [0.043, 0.166, 0], r: [0.048, 0.042, 0.034], bone: 'chest', tag: 'torso', k: 0.02 },
      ...[-1, 1].map(s => ({ ell: [0.066, 0.164, s * 0.02], r: [0.028, 0.038, 0.018], rot: [0, 0, 0.3], bone: 'scap' + side(s), tag: 'torso', k: 0.012 })),
      { cap: [[0.08, 0.182, 0], [0.135, 0.212, 0]], r: [0.025, 0.018], bone: 'neck1', tag: 'neck', k: 0.015 },
      { cap: [[0.135, 0.212, 0], [0.18, 0.243, 0]], r: [0.018, 0.0148], bone: 'neck2', tag: 'neck', k: 0.01 },
      ...leg(-1), ...leg(1)
    ];
    const body = R.sculpt(bodyShapes, { name: 'body', S, cell: 0.0016, tau: 0.004,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const up = sst(-0.45, 0.6, ny), lg = tg.leg || 0, nk = tg.neck || 0, az = Math.abs(z), out = Math.max(sst(-0.2, 0.6, nz * Math.sign(z || 1)), 0.85 * sst(0.1, 0.7, nx));
        let col = mix(mix(C.belly, C.flank, sst(-0.65, -0.25, ny)), C.back, up);
        col = mix(col, C.spine, sst(0.75, 0.95, ny) * (1 - sst(0.006, 0.016, az)));
        /* (the throat: white stripes between brown, running down from the chin) */
        if (nk > 0.3) { const dn = sst(0.3, -0.5, ny), band = Math.abs(Math.sin((az / 0.014) * Math.PI)); col = mix(col, mix(C.throatW, C.throatB, band > 0.55 && az > 0.003 ? 1 : 0), dn * nk); }
        col = mix(col, mix(C.legIn, C.leg, Math.max(out, up)), lg);
        const L = 0.0045 + 0.002 * up - 0.002 * lg * sst(0.1, 0.04, y);
        return { col: col.map(v => v * (0.92 + 0.16 * M.fbm(x * 90, y * 90, z * 90, 2))), mat: FUR, fur: L, comb: lg > 0.5 ? [-0.1, -1.4, 0] : nk > 0.5 ? [-1.4, -0.4, 0] : [-1.6, -0.35, 0] };
      } });

    /* ── the head ── */
    const MOUTH = 0.2275, headShapes = [
      { ell: [0.187, 0.257, 0], r: [0.025, 0.0182, 0.0168], bone: 'head', tag: 'crown', k: 0 },
      { ell: [0.214, 0.249, 0], r: [0.029, 0.0135, 0.0118], rot: [0, 0, -0.36], bone: 'head', tag: 'face', k: 0.01 },
      { cap: [[0.218, 0.243, 0], [0.262, 0.2235, 0]], r: [0.0108, 0.0062], bone: 'head', tag: 'muzzle', k: 0.008 },
      { ell: [0.2648, 0.2238, 0], r: [0.0026, 0.0038, 0.0048], rot: [0, 0, -0.3], bone: 'head', tag: 'nose', k: 0.0016, after: true },
      { ell: [0.229, 0.2305, 0], r: [0.029, 0.0068, 0.0098], rot: [0, 0, -0.36], bone: 'jaw', tag: 'jaw', k: 0.005 },
      { ell: [0.252, 0.2165, 0], r: [0.008, 0.0042, 0.0058], rot: [0, 0, -0.36], bone: 'jaw', tag: 'chin', k: 0.004 },
      { ell: [0.183, 0.236, 0], r: [0.018, 0.013, 0.014], bone: 'head', tag: 'throat', k: 0.008 },
      ...[-1, 1].flatMap(s => [
        { ell: [0.183, 0.281, s * 0.016], r: [0.0075, 0.0105, 0.0017], rot: [s * 0.3, s * -0.35, 0.15], bone: 'ear' + side(s), tag: 'ear', k: 0.002 },
        { ell: [0.1835, 0.2815, s * 0.0172], r: [0.0058, 0.0084, 0.0012], rot: [s * 0.3, s * -0.35, 0.15], sub: true, bone: 'ear' + side(s), tag: 'ear', k: 0.0005 },
        { ell: [EYE[0] + 0.0004, EYE[1], s * (EZ + 0.0026)], r: [0.0074, 0.0059, 0.0062], rot: [0, s * 0.4, 0], sub: true, tag: 'socket', k: 0.0012 },
        { ell: [0.2665, 0.2238, s * 0.0028], r: [0.0014, 0.0011, 0.0009], rot: [0, s * 0.5, 0], sub: true, tag: 'nostril', k: 0.0005 }]),
      { box: [0.245, MOUTH, 0], h: [0.016, 0.0004, 0.008], rr: 0.0003, rot: [0, 0, -0.36], sub: true, tag: 'mouth', k: 0.0006 }
    ];
    const head = R.sculpt(headShapes, { name: 'head', S, cell: 0.0006, tau: 0.0018,
      bind: (x, y, z, ws, tw) => {
        const s = (x - 0.199) * 0.936 + (y - 0.238) * -0.352, h = -(x - 0.199) * -0.352 + (y - 0.238) * 0.936, fw = sst(0.022, 0.034, s);
        if (fw <= 0 || (tw.ear || 0) > 0.5) return ws;
        const jaw = S.ix.jaw, hb = S.ix.head, j = h < -0.0055 + 0.0 * s ? 1 : 0, out = ws.filter(([b]) => b !== jaw && b !== hb).map(([b, w]) => [b, w * (1 - fw)]);
        const wj = ws.filter(([b]) => b === jaw).reduce((a, q) => a + q[1], 0), wh = ws.filter(([b]) => b === hb).reduce((a, q) => a + q[1], 0);
        return [...out, [jaw, wj * (1 - fw) + fw * j * (wj + wh)], [hb, wh * (1 - fw) + fw * (1 - j) * (wj + wh)]];
      },
      paint: (x, y, z, nx, ny, nz, tg) => {
        const ns = Math.min(1, (tg.nose || 0) + (tg.nostril || 0)), ear = tg.ear || 0, mo = tg.mouth || 0, sk = tg.socket || 0, up = sst(-0.4, 0.6, ny);
        let col = mix(mix(C.belly, C.head, sst(-0.6, 0.0, ny)), C.muzzle, sst(0.235, 0.255, x) * up);
        if ((tg.throat || 0) > 0.4 && ny < 0) col = mix(col, C.throatW, 0.8);
        if ((tg.chin || 0) > 0.4) col = mix(col, C.throatW, 0.6 * sst(0.0, -0.6, ny));
        col = mix(col, C.nose, ns);
        if (ear > 0.5) col = mix(C.ear, C.earIn, sst(-0.2, 0.5, -nz * Math.sign(z)));
        if (sk > 0.4) col = mix(col, C.lid, 0.6);
        if (mo > 0.3) col = mix(col, lin('#2a1a14'), 0.8);
        const L = (1 - ns) * (1 - mo) * (1 - sk) * (0.0028 + 0.0012 * up - 0.0016 * sst(0.24, 0.26, x)) * (1 - 0.5 * ear);
        return { col, mat: ns > 0.5 ? [0.3, 0.35, PAT.skin, 0] : ear > 0.5 ? [0.72, 0.02, PAT.skin, 0.4] : FUR, fur: L, comb: [-1.5, 0.2, 0] };
      } });

    /* ── hooves, eyes and lids, tusks, the tail ── */
    const hooves = R.sculpt(R.sides((s, X) => [[[0.0635, 0.0125, s * 0.025], 'hf' + X], [[-0.1545, 0.0135, s * 0.025], 'hh' + X]]).flatMap(([f, bone]) => [-1, 1].flatMap(d => [
      { cap: [[f[0] + 0.001, f[1] - 0.004, f[2] + d * 0.0026], [f[0] + 0.0085, f[1] - 0.0118, f[2] + d * 0.0022]], r: [0.0032, 0.0011], bone, tag: 'hoof', k: 0.001 },
      { ell: [f[0] + 0.004, f[1] - 0.0102, f[2] + d * 0.0024], r: [0.0048, 0.0018, 0.0024], bone, tag: 'hoof', k: 0.001 }]).concat([{ cap: [[f[0], f[1] + 0.003, f[2]], [f[0] + 0.002, f[1] - 0.004, f[2]]], r: [0.0036, 0.0034], bone, tag: 'pastern', k: 0.0015 }])),
      { name: 'hooves', S, cell: 0.0005, tau: 0.0008, paint: (x, y, z, nx, ny, nz, tg) => (tg.hoof || 0) > 0.5 ? { col: C.hoof, mat: [0.5, 0.15, PAT.horn, 0], fur: 0 } : { col: C.leg, mat: FUR, fur: 0.002, comb: [0, -1, 0] } });
    const ax = s => [0.35, 0.08, s * 0.93];
    const eyes = [-1, 1].map(s => R.eye(S, [EYE[0], EYE[1], s * EZ], 0.0064, ax(s), { col: C.iris, iris: 0.8, pupil: 0.42, white: 0.05, wide: 1.15, rough: 0.05, coat: 0.9 }));
    const lids = [-1, 1].map(s => R.lid(S, [EYE[0], EYE[1], s * EZ], 0.0068, ax(s), 'lid' + side(s), C.lid, 0.4));
    const extra = fem ? [] : [R.sculpt([-1, 1].map(s => ({ cap: [[0.2335, 0.2345, s * 0.0062], [0.2365, 0.2215, s * 0.0068]], r: [0.0012, 0.0004], bone: 'head', tag: 'tusk', k: 0.0004 })),
      { S, cell: 0.00025, tau: 0.0004, paint: () => ({ col: lin('#d8d0bd'), mat: [0.3, 0.5, PAT.horn, 0], fur: 0 }) })];
    const TC = new T.CatmullRomCurve3([[-0.19, 0.212, 0], [-0.2, 0.208, 0], [-0.222, 0.192, 0], [-0.236, 0.172, 0], [-0.245, 0.152, 0]].map(p => new T.Vector3(...p)), false, 'centripetal');
    const tailG = R.tube(TC, (s, a) => (0.0068 - 0.003 * s) * (1 + 0.25 * Math.cos(a)), { n: 24, m: 12, cap1: 0.004 }), UV = tailG.attributes.uv;
    const tail = { geo: tailG, bind: R.chain(S, ['t0', 't1', 't2'], { h: 0.5 }), col: (x, y, z, i) => mix(C.belly, C.back, sst(-0.3, 0.3, Math.cos(UV.getY(i) * Math.PI * 2))), mat: FUR, fur: 0.008, comb: (x, y, z, i) => TC.getTangentAt(UV.getX(i)).multiplyScalar(1.5).toArray() };

    const B = R.body(S, [body, head, hooves, ...eyes, ...lids, ...extra, tail], { fur: { shells: 12, dens: 9, root: 0.55, tip: [1.15, 1.1, 1.05], grav: 0.15, band: [1.15, 1.05, 0.9, 0.35] } });
    const g = B.g; g.name = 'mousedeer';

    const clips = Hoofed.clips(S, {
      tail: ['t0', 't1', 't2'], size: 0.3, speed: { walk: 0.3, trot: 0.8, gallop: 3, bound: 2.6 }, stride: 0.42, tailCarry: -1.15,
      head: { fwd: [0.936, -0.352, 0], graze: [0.24, 0.02, 0] }, scratchReach: 0.35,
      lie: { drop: 0.115,
        fore: s => [[0.073, 0.03, s * 0.03], [0.05, 0.012, s * 0.03], [0.09, 0.006, s * 0.028], [0.06, 0.005, s * 0.026], [0.052, 0.001, s * 0.026]],
        hind: s => [[-0.152, 0.08, s * 0.026], [-0.1, 0.018, s * 0.045], [-0.165, 0.008, s * 0.045], [-0.125, 0.006, s * 0.042], [-0.112, 0.001, s * 0.042]] },
      more: (cl, K) => { cl.browse = cl.graze; }
    });
    return R.creature(g, S, clips, o);
  });
})();
