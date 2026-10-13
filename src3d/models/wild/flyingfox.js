/* wild/flyingfox — a large flying fox (Pteropus vampyrus), the island's great fruit bat: a body of 30 cm and a kilo
   on wings of almost a metre and a half; a fox's face — the long muzzle, big dark eyes, pointed ears — the mantle over
   its neck and shoulders golden-rufous, the rest of its fur near black; the wings bare black skin stretched between
   the long fingers, over the arm and down the flank to the ankle, glowing red-brown with the sun behind them. Built as
   it flies (wings spread, at the origin, facing +x). It roosts hanging by its feet, wrapped in its wings.
   o.clip: hang (also idle: upside down from the origin, wrapped, the head turning, the ears flicking), fan (a wing
   loosened and fanned to cool), stretch (one wing opened right out, then folded again), groom (licking the wing's
   skin), eat (hanging by one foot, the other and a thumb holding a fruit to the mouth), squabble (wings half open,
   mouth open, lunging), fly, glide, takeoff (dropping from the roost and opening), land (swinging up to hang). */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  M.add('wild/flyingfox', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const C = { mantle: lin('#7c4a22'), mantleL: lin('#93602e'), back: lin('#211a14'), belly: lin('#2b221a'), head: lin('#33261a'), muzzle: lin('#1a1511'), skin: lin('#1b1613'), memb: lin('#231b17'), nail: lin('#121010'), iris: lin('#2a1a0e'), nose: lin('#141110'), mouth: lin('#5a3a34') };
    /* ── the skeleton, spread: the arm out, the fingers fanned from the wrist (the third the wingtip), the legs back ── */
    const D = { // the fingers: their ways from the wrist (for the right wing) and lengths
      d2: [[0.28, 0, 0.96], [0.2, 0, 0.98], [0.12, 0, 0.99]], d2L: [0.115, 0.045, 0.025],
      d3: [[0.1, 0, 0.995], [-0.1, 0, 0.995], [-0.32, 0, 0.947]], d3L: [0.135, 0.105, 0.085],
      d4: [[-0.5, 0, 0.866], [-0.62, 0, 0.785], [-0.72, 0, 0.69]], d4L: [0.125, 0.075, 0.05],
      d5: [[-0.8, 0, 0.6], [-0.88, 0, 0.47], [-0.93, 0, 0.37]], d5L: [0.12, 0.065, 0.045] };
    const J = s => {
      const S0 = V(0.055, 0.012, s * 0.028), E = V(0.03, 0.01, s * 0.165), Wr = V(0.085, 0.012, s * 0.358), out = { S0, E, Wr };
      for (const k of ['d2', 'd3', 'd4', 'd5']) { const p = [Wr.clone()]; D[k].forEach((d, i) => p.push(p[i].clone().add(V(d[0], d[1], s * d[2]).multiplyScalar(D[k + 'L'][i])))); out[k] = p; }
      out.th = Wr.clone().add(V(0.034, 0.006, s * 0.012));
      out.H = V(-0.085, -0.004, s * 0.022); out.K = V(-0.15, -0.004, s * 0.07); out.A = V(-0.215, -0.004, s * 0.1); out.F = V(-0.248, -0.004, s * 0.104);
      return out;
    };
    const EYE = [0.141, 0.0225, 0.0139], ER = 0.0064;
    const defs = [
      ['hips', null, [-0.07, 0, 0]], ['spine', 'hips', [-0.02, 0.004, 0]], ['chest', 'spine', [0.035, 0.008, 0]], ['neck', 'chest', [0.08, 0.012, 0]],
      ['head', 'neck', [0.105, 0.014, 0], { tail: [0.19, 0.007, 0] }], ['jaw', 'head', [0.122, 0.001, 0], { tail: [0.183, 0.0, 0] }],
      ...R.sides((s, X) => [['lid' + X, 'head', [EYE[0], EYE[1], s * EYE[2]], { tail: [EYE[0] + 0.01, EYE[1], s * EYE[2]] }], ['ear' + X, 'head', [0.108, 0.033, s * 0.016], { tail: [0.099, 0.062, s * 0.024] }]]),
      ...R.sides((s, X) => { const j = J(s), out = [['hum' + X, 'chest', j.S0.toArray(), { tail: j.E.toArray() }], ['rad' + X, 'hum' + X, j.E.toArray(), { tail: j.Wr.toArray() }], ['th' + X, 'rad' + X, j.Wr.toArray(), { tail: j.th.toArray() }]];
        for (const k of ['d2', 'd3', 'd4', 'd5']) ['a', 'b', 'c'].forEach((q, i) => out.push([k + q + X, i ? k + ['a', 'b'][i - 1] + X : 'rad' + X, j[k][i].toArray(), { tail: j[k][i + 1].toArray() }]));
        out.push(['fem' + X, 'hips', j.H.toArray(), { tail: j.K.toArray() }], ['tib' + X, 'fem' + X, j.K.toArray(), { tail: j.A.toArray() }], ['ft' + X, 'tib' + X, j.A.toArray(), { tail: j.F.toArray() }]);
        return out; })
    ];
    const S = R.skeleton(defs);

    /* ── the body: torso, the fox's head, the arms, fingers and legs, furred where they should be ── */
    const cap = (A, B, r0, r1, bone, tag, k = 0.004) => ({ cap: [A.toArray ? A.toArray() : A, B.toArray ? B.toArray() : B], r: [r0, r1], bone, tag, k });
    const limbs = [];
    for (const s of [-1, 1]) {
      const X = side(s), j = J(s);
      limbs.push(cap(j.S0, j.E, 0.013, 0.0075, 'hum' + X, 'arm', 0.008), cap(j.E, j.Wr, 0.0072, 0.0052, 'rad' + X, 'fore', 0.004), { ell: j.Wr.toArray(), r: [0.0075, 0.0055, 0.0068], bone: 'rad' + X, tag: 'wrist', k: 0.003 });
      limbs.push(cap(j.Wr, j.th, 0.0042, 0.0026, 'th' + X, 'finger', 0.002), cap(j.th, j.th.clone().add(V(0.008, -0.004, s * 0.002)), 0.0022, 0.0005, 'th' + X, 'claw', 0.001));
      for (const k of ['d2', 'd3', 'd4', 'd5']) for (let i = 0; i < 3; i++) limbs.push(cap(j[k][i], j[k][i + 1], 0.0034 - 0.0007 * i, 0.0027 - 0.0007 * i - (i === 2 ? 0.001 : 0), k + 'abc'[i] + X, 'finger', 0.0018));
      limbs.push(cap(j.H, j.K, 0.0105, 0.0068, 'fem' + X, 'leg', 0.006), cap(j.K, j.A, 0.0064, 0.0046, 'tib' + X, 'shin', 0.003), cap(j.A, j.F, 0.0058, 0.0042, 'ft' + X, 'foot', 0.003));
      /* (five hooked claws on each foot) */
      for (let t = 0; t < 5; t++) { const a = (t - 2) * 0.16, B0 = j.F.clone().add(V(0, 0, s * (t - 2) * 0.0026)), B1 = B0.clone().add(V(-0.011 * Math.cos(a), -0.004, s * 0.011 * Math.sin(a)));
        limbs.push(cap(B0, B1, 0.0016, 0.0011, 'ft' + X, 'toe', 0.0012), cap(B1, B1.clone().add(V(-0.004, -0.006, 0)), 0.001, 0.0002, 'ft' + X, 'claw', 0.0008)); }
    }
    const bodyShapes = [
      { ell: [0.03, 0.006, 0], r: [0.056, 0.034, 0.042], bone: 'chest', tag: 'chest', k: 0 },
      { ell: [-0.035, 0.0, 0], r: [0.05, 0.03, 0.034], bone: 'spine', tag: 'belly', k: 0.02 },
      { ell: [-0.075, -0.002, 0], r: [0.03, 0.024, 0.028], bone: 'hips', tag: 'hips', k: 0.018 },
      ...[-1, 1].map(s => ({ ell: [0.045, 0.006, s * 0.03], r: [0.03, 0.022, 0.02], bone: 'chest', tag: 'pecs', k: 0.014 })),
      cap([0.058, 0.01, 0], [0.1, 0.014, 0], 0.027, 0.021, 'neck', 'neck', 0.014),
      ...limbs
    ];
    const furPaint = (x, y, z, nx, ny, nz, tg) => {
      const g = k => tg[k] || 0;
      if (g('claw') > 0.4) return { col: C.nail, mat: [0.35, 0.4, PAT.horn, 0], fur: 0 };
      if (g('finger') + g('toe') > 0.5) return { col: C.skin, mat: [0.66, 0.06, PAT.skin, 0.3], fur: 0 };
      /* (the mantle over the neck and shoulders, golden; the back near black; the belly a little browner) */
      const limb = g('arm') + g('fore') + g('wrist') + g('leg') + g('shin') + g('foot'), mant = sst(-0.005, 0.03, x) * sst(0.115, 0.075, x) * sst(-0.4, 0.2, ny) * (1 - Math.min(1, limb));
      let col = mix(C.belly, C.back, sst(-0.3, 0.3, ny)); col = mix(col, mix(C.mantle, C.mantleL, sst(0.2, 0.9, ny)), mant);
      let fur = 0.011 + 0.005 * mant;
      if (g('arm') > 0.4) fur = 0.008 * sst(0.11, 0.05, Math.abs(z));
      if (g('fore') + g('wrist') > 0.4) { fur = 0.003 * sst(0.25, 0.18, Math.abs(z)); col = mix(C.skin, col, fur / 0.003); }
      if (g('leg') > 0.4) fur = 0.006; if (g('shin') + g('foot') > 0.4) { fur = 0.002 * sst(-0.2, -0.16, x); col = mix(C.skin, col, fur / 0.002); }
      return { col: col.map(v => v * (0.94 + 0.1 * M.vn(x * 160, y * 160, z * 160))), mat: fur > 0.001 ? [0.8, 0.0, PAT.fur, 0] : [0.66, 0.06, PAT.skin, 0.2], fur, comb: [-1, 0, 0] };
    };
    const body = R.sculpt(bodyShapes, { name: 'body', S, cell: 0.0018, tau: 0.004, paint: furPaint });
    const head = R.sculpt([
      { ell: [0.118, 0.021, 0], r: [0.026, 0.0215, 0.021], bone: 'head', tag: 'cranium', k: 0 },
      cap([0.128, 0.013, 0], [0.176, 0.007, 0], 0.0128, 0.0078, 'head', 'muzzle', 0.008),
      { ell: [0.18, 0.0078, 0], r: [0.0062, 0.0062, 0.0074], bone: 'head', tag: 'nose', k: 0.007 },
      ...[-1, 1].map(s => ({ ell: [0.136, 0.009, s * 0.0118], r: [0.016, 0.0095, 0.0088], bone: 'head', tag: 'cheek', k: 0.007 })),
      cap([0.122, -0.002, 0], [0.176, -0.0015, 0], 0.0098, 0.0055, 'jaw', 'jaw', 0.006),
      ...[-1, 1].map(s => ({ ell: [EYE[0] + 0.0015, EYE[1], s * (EYE[2] + 0.0035)], r: [ER * 1.12, ER * 0.9, ER * 1.0], sub: true, tag: 'socket', k: 0.0025 })),
      ...[-1, 1].map(s => ({ ell: [0.1885, 0.0085, s * 0.0038], r: [0.0022, 0.0016, 0.0014], sub: true, tag: 'nostril', k: 0.001 })),
      /* (the ears: tall, pointed, thin, cupped forward) */
      ...[-1, 1].flatMap(s => [cap([0.108, 0.033, s * 0.0165], [0.099, 0.062, s * 0.0245], 0.0082, 0.0012, 'ear' + side(s), 'ear', 0.004),
        { cap: [[0.1112, 0.035, s * 0.0168], [0.1015, 0.06, s * 0.0242]], r: [0.0062, 0.0007], sub: true, tag: 'ear', k: 0.0015 }]),
      /* (the mouth's line) */
      { box: [0.152, 0.0028, 0], h: [0.026, 0.0006, 0.012], rot: [0, 0, -0.06], sub: true, tag: 'mouth', k: 0.0012 }
    ], { name: 'head', S, cell: 0.0007, tau: 0.002,
      bind: (x, y, z, ws, tw) => (tw.ear || 0) > 0.4 ? [[S.ix[z < 0 ? 'earL' : 'earR'], 1]] : y < 0.0028 && x > 0.12 ? [[S.ix.jaw, 1]] : [[S.ix.head, 1]],
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('ear') > 0.4) return { col: C.skin, mat: [0.5, 0.15, PAT.skin, 0.5], fur: 0 };
        if (g('nose') + g('nostril') > 0.4 || x > 0.179) return { col: C.nose, mat: [0.6, 0.08, PAT.skin, 0], fur: 0 };
        if (g('mouth') > 0.4) return { col: C.mouth, mat: [0.4, 0.3, PAT.skin, 0], fur: 0 };
        const dE = Math.hypot(x - EYE[0], y - EYE[1], Math.abs(z) - EYE[2]), muz = sst(0.142, 0.17, x);
        const fur = dE < ER * 1.08 ? 0 : 0.0068 * (1 - 0.7 * muz) * sst(ER * 1.08, ER * 1.6, dE);
        return { col: mix(C.head, C.muzzle, muz).map(v => v * (0.94 + 0.1 * M.vn(x * 300, y * 300, z * 300))), mat: fur > 0 ? [0.8, 0.0, PAT.fur, 0] : [0.5, 0.2, PAT.skin, 0], fur, comb: [-1, 0.2, 0] };
      } });

    /* ── the wings' skin: panels between the fingers, and from the fifth finger and the arm down the flank to the
       ankle, and in front of the arm; each point following the bones of the two edges it lies between, its free edge
       scalloped in between the tips; drawn both ways ── */
    const chainAt = (pts, bones) => {
      const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
      return u => {
        const d = u * L[L.length - 1]; let i = 0; while (i < pts.length - 2 && d > L[i + 1]) i++;
        const f = clamp((d - L[i]) / (L[i + 1] - L[i] || 1), 0, 1), p = pts[i].clone().lerp(pts[i + 1], f), w = new Map();
        /* (shared with the next bone near a joint) */
        const add = (b, x) => { if (b) w.set(S.ix[b], (w.get(S.ix[b]) || 0) + x); };
        const near1 = i < bones.length - 1 ? sst(0.75, 1, f) * 0.5 : 0, near0 = i > 0 ? sst(0.25, 0, f) * 0.5 : 0;
        add(bones[i], 1 - near1 - near0); if (near1) add(bones[i + 1], near1); if (near0) add(bones[i - 1], near0);
        return { p, w };
      };
    };
    const membranes = [];
    const panel = (cA, cB, nu, nv, sag, bulge = 0) => {
      const pos = [], W = [], idx = [], nvx = nv + 1, A1 = cA(1).p, B1 = cB(1).p, mid1 = A1.clone().lerp(B1, 0.5), back = cA(0.55).p.clone().lerp(cB(0.55).p, 0.5).sub(mid1).normalize(), span = A1.distanceTo(B1);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, a = cA(u), b = cB(u);
        for (let j = 0; j <= nv; j++) {
          const v = j / nv, p = a.p.clone().lerp(b.p, v).addScaledVector(back, sag * span * Math.sin(Math.PI * v) * Math.pow(u, 3)).add(V(0, -bulge * Math.sin(Math.PI * v) * Math.sin(Math.PI * u) * span, 0));
          const w = new Map(); for (const [k, x] of a.w) w.set(k, (w.get(k) || 0) + x * (1 - v)); for (const [k, x] of b.w) w.set(k, (w.get(k) || 0) + x * v);
          pos.push(p.x, p.y, p.z); W.push([...w].sort((q, r) => r[1] - q[1]).slice(0, 4));
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const q = i * nvx + j; idx.push(q, q + nvx, q + 1, q + 1, q + nvx, q + nvx + 1); }
      /* (the other face: the same points a hair apart, wound the other way) */
      const N = M.normalsOf(pos, idx), n0 = pos.length / 3, pos2 = pos.slice(), N2 = [];
      for (let k = 0; k < n0; k++) { for (let c = 0; c < 3; c++) { pos[k * 3 + c] += N[k * 3 + c] * 0.0003; pos2[k * 3 + c] -= N[k * 3 + c] * 0.0003; N2.push(-N[k * 3 + c]); } }
      const idx2 = []; for (let t = 0; t < idx.length; t += 3) idx2.push(idx[t] + n0, idx[t + 2] + n0, idx[t + 1] + n0);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([...pos, ...pos2], 3)); g.setAttribute('normal', new T.Float32BufferAttribute([...N, ...N2], 3)); g.setIndex([...idx, ...idx2]);
      membranes.push({ geo: g, bind: (x, y, z, i) => W[i % n0], col: (x, y, z) => C.memb.map(c => c * (0.9 + 0.15 * M.vn(x * 40, y * 40, z * 40))), mat: [0.72, 0.03, PAT.membrane, 0.6], fur: 0 });
    };
    for (const s of [-1, 1]) {
      const X = side(s), j = J(s), arm = V(0.05, 0.004, s * 0.036);
      const dch = k => chainAt(j[k], [k + 'a' + X, k + 'b' + X, k + 'c' + X]);
      panel(dch('d2'), dch('d3'), 14, 3, 0.1);
      panel(dch('d3'), dch('d4'), 18, 8, 0.26, 0.04);
      panel(dch('d4'), dch('d5'), 16, 7, 0.24, 0.04);
      /* (the flank's: from the armpit down the side and the leg to the ankle, out along the arm and the fifth finger) */
      panel(chainAt([arm, V(-0.03, 0.0, s * 0.032), V(-0.075, -0.003, s * 0.026), j.K, j.A], ['chest', 'hips', 'fem' + X, 'tib' + X]),
        chainAt([arm, j.E, j.Wr, ...j.d5.slice(1)], ['hum' + X, 'rad' + X, 'd5a' + X, 'd5b' + X, 'd5c' + X]), 30, 14, 0.18, 0.03);
      /* (before the arm, from the neck's side to the thumb) */
      panel(chainAt([j.S0, j.E, j.Wr], ['hum' + X, 'rad' + X]), chainAt([V(0.078, 0.014, s * 0.03), V(0.076, 0.012, s * 0.15), j.Wr.clone().add(V(0.012, 0.0, 0))], ['hum' + X, 'rad' + X]), 16, 3, 0);
    }
    const eyes = [-1, 1].map(s => R.eye(S, [EYE[0], EYE[1], s * EYE[2]], ER, [0.55, 0.1, s * 0.83], { col: C.iris, iris: 0.88, pupil: 0.46, white: 0.03, rough: 0.08, coat: 0.55 }));
    const lids = [-1, 1].map(s => R.lid(S, [EYE[0], EYE[1], s * EYE[2]], ER * 1.08, [0.55, 0.1, s * 0.83], 'lid' + side(s), C.head, 0.42));
    const B = R.body(S, [body, head, ...membranes, ...eyes, ...lids], { fur: { shells: 16, dens: 5.5, root: 0.55, tip: [1.08, 1.06, 1.02], grav: 0.25, band: [1.15, 1.08, 0.95, 0.7] } });
    const g = B.g; g.name = 'flyingfox';

    /* ── the folded wing: the humerus back along the flank, the forearm forward round the front of the body to the
       chin, the fingers folded back along it — as it hangs wrapped ── */
    const fold = {};
    {
      const Pf = new R.Pose(S), up = V(0, 1, 0);
      for (const s of [-1, 1]) {
        const X = side(s), j = J(s), Z = (x, y, z) => V(x, y, s * z).normalize();
        const set = (b, dir, nrm) => { Pf.aim(b, R.frameTo(S.tail[b].clone().sub(S.head[b]).normalize(), up, dir, nrm)); fold[b] = Pf.get(b); };
        set('hum' + X, Z(-0.86, -0.3, 0.41), Z(0, 0.2, 1));
        set('rad' + X, Z(0.95, -0.07, -0.31), Z(-0.1, -0.6, 1));
        set('th' + X, Z(0.6, 0.2, -0.75), Z(0, 1, 0.3));
        /* (each finger folded in a zigzag: the metacarpal back along the forearm, the first joint back toward the
           wrist, the last back again, so the tips lie within the bundle) */
        ['d2', 'd3', 'd4', 'd5'].forEach((k, n) => {
          set(k + 'a' + X, Z(-0.95, -0.2 - 0.05 * n, 0.22), Z(0, -0.7, 1));
          set(k + 'b' + X, Z(0.93, -0.28 - 0.04 * n, -0.18 + 0.03 * n), Z(0, -0.7, 1));
          set(k + 'c' + X, Z(-0.9, -0.32, 0.25), Z(0, -0.7, 1));
        });
      }
    }
    const QI = new T.Quaternion();
    /* a wing: how far folded (0 spread … 1 wrapped), raised at the shoulder, swept, the hand flexed (its fingers drawn
       in, for the upstroke), twisted at the wrist */
    const wing = (P, s, { f = 1, lift = 0, sweep = 0, flex = 0, twist = 0 } = {}) => {
      const X = side(s);
      P.put('hum' + X, QI.clone().slerp(fold['hum' + X], f)); P.pre('hum' + X, -s * lift, s * sweep, 0);
      P.put('rad' + X, QI.clone().slerp(fold['rad' + X], Math.min(1, f + 0.35 * flex)));
      P.put('th' + X, QI.clone().slerp(fold['th' + X], f));
      for (const k of ['d2', 'd3', 'd4', 'd5']) for (const q of 'abc') P.put(k + q + X, QI.clone().slerp(fold[k + q + X], Math.min(1, f + flex * (q === 'a' ? 0.55 : 0.3))));
      if (twist) P.turn('rad' + X, twist, 0, 0);
    };
    const face = (P, t, gape = 0) => { const b = R.blink(t, 3.3); P.set('lidL', 0, 0, -1.1 * b); P.set('lidR', 0, 0, -1.1 * b); P.set('jaw', 0, 0, -gape);
      P.set('earL', 0.15 * wave(t, 11, 2), 0, 0.2 * wave(t, 12, 1.4)); P.set('earR', -0.15 * wave(t, 13, 2), 0, 0.2 * wave(t, 14, 1.4)); };
    /* hanging: the body turned head down under the feet (the feet at the origin), the legs straight up, the toes
       hooked, the head bent up to look out */
    const hang = (P, t, { one = 0 } = {}) => {
      P.set('hips', 0.04 * wave(t, 1, 0.4), 0.15 * wave(t, 2, 0.25), -Math.PI / 2 + 0.03 * wave(t, 3, 0.6));
      for (const s of [-1, 1]) { const X = side(s), j = J(s), free = one && s === one;
        P.aim('fem' + X, R.frameTo(j.K.clone().sub(j.H).normalize(), V(0, 1, 0), V(0, 1, 0).applyQuaternion(qE(0, 0, 0)).add(V(0.02, 0, s * 0.06)).normalize(), V(-1, 0, 0)));
        P.aim('tib' + X, R.frameTo(j.A.clone().sub(j.K).normalize(), V(0, 1, 0), V(free ? 0.5 : 0.0, 1, s * (free ? 0.3 : 0.03)).normalize(), V(-1, 0, 0)));
        P.aim('ft' + X, R.frameTo(j.F.clone().sub(j.A).normalize(), V(0, 1, 0), V(free ? 0.6 : -0.6, free ? 0.2 : 0.8, 0).normalize(), V(0, 0, -s))); }
      P.set('spine', 0, 0, 0.04 * Math.sin(t * 1.7)); P.set('chest', 0, 0, 0.03 * Math.sin(t * 1.7 + 0.5));
      P.set('neck', 0, 0.3 * wave(t, 4, 0.45), 0.55 + 0.1 * wave(t, 5, 0.3)); P.set('head', 0.1 * wave(t, 6, 0.5), 0.25 * wave(t, 7, 0.5), 0.45);
      for (const s of [-1, 1]) wing(P, s, { f: 1 });
      /* (set so the feet's grip is at the origin) */
      P.off.set(0, 0, 0); const pf = P.at('ftR', J(1).F.toArray()).add(P.at('ftL', J(-1).F.toArray())).multiplyScalar(0.5); P.off.copy(pf.negate());
    };
    const flapHz = 2.3;
    const clips = {
      hang: (P, t) => { hang(P, t); face(P, t); },
      fan: (P, t) => { hang(P, t); const sd = Math.floor(t / 6) % 2 ? 1 : -1, c = Math.sin(t * 5.5); wing(P, sd, { f: 0.62 + 0.12 * c, lift: 0.1 * c, flex: 0.1 }); face(P, t); },
      stretch: (P, t) => { hang(P, t); const c = (t % 5) / 5, op = sst(0.05, 0.3, c) * (1 - sst(0.6, 0.9, c)), sd = Math.floor(t / 5) % 2 ? 1 : -1; wing(P, sd, { f: 1 - 0.92 * op, lift: -0.4 * op, sweep: 0.3 * op }); P.set('head', 0, 0.4 * sd * op, 0.6); face(P, t, 0.3 * op * sst(0.25, 0.35, c) * (1 - sst(0.45, 0.55, c))); },
      groom: (P, t) => { hang(P, t); const sd = Math.floor(t / 4) % 2 ? 1 : -1; wing(P, sd, { f: 0.7, lift: -0.2 }); P.set('neck', 0, 0.7 * sd, 0.9); P.set('head', 0, 0.5 * sd, 0.7 + 0.15 * Math.sin(t * 9)); face(P, t, 0.12 + 0.08 * Math.sin(t * 9)); },
      eat: (P, t) => { hang(P, t, { one: 1 }); wing(P, 1, { f: 0.8, lift: -0.25 }); P.set('neck', 0, 0, 0.9); P.set('head', 0, 0, 0.7); face(P, t, 0.08 + 0.1 * Math.max(0, Math.sin(t * 7))); },
      squabble: (P, t) => { hang(P, t); const c = Math.sin(t * 3), lunge = Math.max(0, c); for (const s of [-1, 1]) wing(P, s, { f: 0.55 - 0.2 * lunge, lift: -0.3, flex: 0.2 }); P.set('neck', 0, 0.2 * Math.sin(t * 1.3), 0.6 - 0.4 * lunge); P.set('head', 0, 0, 0.3); face(P, t, 0.35 + 0.15 * lunge); },
      fly: (P, t) => {
        /* deep, slow strokes: down with the wing spread, up with the hand drawn in and the wrist leading */
        const ph = t * flapHz, c = Math.cos(TAU * ph), sn = Math.sin(TAU * ph), upst = Math.max(0, -sn);
        P.off.set(0, 0.015 * sn, 0); P.set('hips', 0, 0, 0.05 + 0.04 * sn);
        for (const s of [-1, 1]) wing(P, s, { f: 0.12 * upst, lift: 0.75 * c + 0.05, flex: 0.45 * upst, sweep: 0.12 * sn, twist: -0.25 * sn });
        for (const s of [-1, 1]) { const X = side(s); P.set('fem' + X, 0, 0, 0.1 * c); P.set('ft' + X, 0, 0, 0.6); }
        P.set('neck', 0, 0.15 * wave(t, 4, 0.4), -0.05); P.set('head', 0, 0, -0.05); face(P, t);
      },
      glide: (P, t) => {
        P.set('hips', 0.05 * wave(t, 2, 0.5), 0, 0.03);
        for (const s of [-1, 1]) wing(P, s, { f: 0.04, lift: 0.08 + 0.03 * wave(t, 4 + s, 0.7), flex: 0.05 });
        for (const s of [-1, 1]) P.set('ft' + side(s), 0, 0, 0.6);
        P.set('neck', 0, 0.2 * wave(t, 4, 0.4), 0); face(P, t);
      },
      takeoff: (P, t) => {
        const c = (t % 1.8) / 1.8, go = sst(0.05, 0.4, c);
        if (c > 0.45) { clips.fly(P, t); P.set('hips', 0, 0, 0.3 * (1 - sst(0.45, 0.8, c))); return; }
        hang(P, t); P.set('hips', 0, 0, -Math.PI / 2 + 1.4 * go); P.off.y -= 0.1 * go;
        for (const s of [-1, 1]) wing(P, s, { f: 1 - go, lift: 0.4 * go });
        face(P, t);
      },
      land: (P, t) => {
        const c = (t % 1.6) / 1.6, sw = sst(0.3, 0.8, c);
        if (c > 0.85) { hang(P, t); face(P, t); return; }
        P.set('hips', 0, 0, 0.4 - (Math.PI / 2 + 0.4) * sw); P.off.set(0, -0.05 * sw, 0);
        for (const s of [-1, 1]) wing(P, s, { f: 0.1 + 0.7 * sw, lift: 0.6 * (1 - sw) * Math.cos(t * 9), flex: 0.3 });
        for (const s of [-1, 1]) { const X = side(s); P.set('fem' + X, 0, 0, -0.9 * sw); P.set('ft' + X, 0, 0, 0.9); }
        face(P, t);
      }
    };
    clips.idle = clips.hang; clips.perch = clips.hang;
    return R.creature(g, S, clips, o);
  });
})();
