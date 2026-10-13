/* wild/fiddler — a fiddler crab of the island's mangrove mud (a Tubuca): the shell 2.5 cm across, turquoise blue
   mottled darker, the legs rust; the male's one great claw longer than his body, orange-red at its base and white at
   the fingers, the other claw tiny; the eyes on long stalks that stand up or fold down into their grooves. He waves
   the great claw to females and at rivals, feeds with the small one — mud to the mouth, quick — and runs sideways to
   his burrow. Built standing (feet on y = 0), facing +x; it runs along ±z. o.female: two small claws.
   o.clip: stand (also idle), wave (the great claw raised and swept, the body rising with it), feed (the small claw
   at work), walk (sideways, ±z by o.dir), alarm (eyes down, body flattened), duck (into the burrow: crouched, the
   claw drawn across the face). */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  M.add('wild/fiddler', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const fem = !!o.female, MJ = (o.left ? -1 : 1);
    const C = { shell: lin('#3a8796'), shellD: lin('#1e4a56'), shellL: lin('#7ac0c6'), leg: lin('#8a3c26'), legD: lin('#4a2216'), claw: lin('#c4401e'), clawW: lin('#efe6d6'), eye: lin('#0e0d0c'), stalk: lin('#9a6a50'), under: lin('#c8bfa8') };
    /* ── the skeleton ── */
    const LX = [0.0065, 0.0015, -0.0035, -0.0085];
    const leg = (k, s) => { const x = LX[k], sp = 1 + 0.12 * (k === 1 || k === 2 ? 1 : 0); return { a: [x, 0.009, s * 0.0108], b: [x - 0.002 - 0.0015 * k, 0.0145, s * (0.022 * sp)], c: [x - 0.004 - 0.003 * k, 0.0078, s * (0.0305 * sp)], d: [x - 0.0055 - 0.0035 * k, 0.0003, s * (0.0345 * sp)] }; };
    /* (the great claw held across the front: the arm out and forward, the palm turned in before the face, the fingers
       reaching across to the far side) */
    const chel = (s, big) => big ? { m0: [0.0105, 0.0098, s * 0.0098], m1: [0.0172, 0.011, s * 0.0198], c1: [0.0238, 0.0118, s * 0.0205], p1: [0.0345, 0.0118, s * 0.0072], d0: [0.0332, 0.0168, s * 0.0068], d1: [0.0368, 0.0142, s * -0.0178], f1: [0.0382, 0.0098, s * -0.0168] }
      : { m0: [0.0108, 0.0088, s * 0.0085], m1: [0.0152, 0.0078, s * 0.0118], c1: [0.0182, 0.0068, s * 0.0122], p1: [0.0228, 0.0046, s * 0.0102], d0: [0.0212, 0.0058, s * 0.0102], d1: [0.0262, 0.0036, s * 0.0092], f1: [0.0262, 0.003, s * 0.0094] };
    const defs = [['cara', null, [0, 0.0122, 0]], ['mx', 'cara', [0.0112, 0.0072, 0], { tail: [0.0122, 0.0045, 0] }],
      ...R.sides((s, X) => [['es' + X, 'cara', [0.0108, 0.0162, s * 0.0042], { tail: [0.0118, 0.0282, s * 0.0088] }]]),
      ...R.sides((s, X) => { const big = !fem && s === MJ, c = chel(s, big); return [['cm' + X, 'cara', c.m0, { tail: c.m1 }], ['cc' + X, 'cm' + X, c.m1, { tail: c.c1 }], ['cp' + X, 'cc' + X, c.c1, { tail: c.p1 }], ['cd' + X, 'cp' + X, c.d0, { tail: c.d1 }]]; }),
      ...R.sides((s, X) => [0, 1, 2, 3].flatMap(k => { const L = leg(k, s); return [['l' + k + 'a' + X, 'cara', L.a, { tail: L.b }], ['l' + k + 'b' + X, 'l' + k + 'a' + X, L.b, { tail: L.c }], ['l' + k + 'c' + X, 'l' + k + 'b' + X, L.c, { tail: L.d }]]; }))];
    const S = R.skeleton(defs);
    /* ── the shell, legs and claws ── */
    const cap = (A, B, r0, r1, bone, tag, k = 0.0008) => ({ cap: [A, B], r: [r0, r1], bone, tag, k });
    const shapes = [
      /* (the shell: broad and squarish in front, narrowing behind, its front edge with the eyes' grooves) */
      { ell: [-0.001, 0.0122, 0], r: [0.0098, 0.0058, 0.0122], bone: 'cara', tag: 'shell', k: 0 },
      { box: [0.0035, 0.0124, 0], h: [0.0068, 0.0046, 0.0126], rr: 0.0036, bone: 'cara', tag: 'shell', k: 0.002 },
      { ell: [0.0048, 0.0084, 0], r: [0.0072, 0.0038, 0.0092], bone: 'cara', tag: 'under', k: 0.002 },
      ...[-1, 1].map(s => ({ cap: [[0.0112, 0.0165, s * 0.0028], [0.0112, 0.0158, s * 0.0118]], r: [0.0014, 0.0014], sub: true, tag: 'groove', k: 0.0006 })),
      ...[-1, 1].map(s => cap([0.0108, 0.0162, s * 0.0042], [0.0118, 0.0272, s * 0.0085], 0.0009, 0.0007, 'es' + side(s), 'stalk', 0.0005))
    ];
    for (const s of [-1, 1]) {
      const X = side(s), big = !fem && s === MJ, c = chel(s, big), f = big ? 1 : 0.42;
      shapes.push(cap(c.m0, c.m1, 0.0021 * f + 0.0004, 0.0024 * f + 0.0004, 'cm' + X, big ? 'claw' : 'small'), cap(c.m1, c.c1, 0.0026 * f + 0.0004, 0.003 * f + 0.0004, 'cc' + X, big ? 'claw' : 'small'));
      /* (the palm, deep and flattened, and the fixed finger running on from it; the movable finger above) */
      const P0 = V(...c.c1), P1 = V(...c.p1), mid = P0.clone().lerp(P1, 0.5), dir = P1.clone().sub(P0).normalize();
      /* (the palm: deep, flattened, as long as the arm) */
      shapes.push({ ell: mid.toArray(), r: [P0.distanceTo(P1) * 0.62, 0.0068 * f + 0.0007, 0.0034 * f + 0.0005], rot: [0, -Math.atan2(dir.z, dir.x), Math.asin(dir.y)], bone: 'cp' + X, tag: big ? 'palm' : 'small', k: 0.0016 * f + 0.0003 });
      /* (the fixed finger from the palm's lower corner, the movable one hinged above it; their gape toothed) */
      shapes.push(cap(V(...c.p1).add(V(0, -0.0018 * f, 0)).toArray(), c.f1, 0.0026 * f + 0.0003, 0.0007 * f + 0.0002, 'cp' + X, big ? 'finger' : 'small'));
      shapes.push(cap(c.d0, c.d1, 0.0024 * f + 0.0003, 0.0007 * f + 0.0002, 'cd' + X, big ? 'finger' : 'small'));
      if (big) for (let i = 0; i < 7; i++) { const q = V(...c.d0).lerp(V(...c.d1), 0.12 + 0.11 * i); shapes.push({ ell: q.add(V(0.0003, -0.0019, 0)).toArray(), r: [0.0008, 0.0008, 0.0008], bone: 'cd' + X, tag: 'tooth', k: 0.0004 });
        const q2 = V(...c.p1).lerp(V(...c.f1), 0.15 + 0.1 * i); shapes.push({ ell: q2.add(V(0, 0.0019, 0)).toArray(), r: [0.0007, 0.0007, 0.0007], bone: 'cp' + X, tag: 'tooth', k: 0.0004 }); }
      for (let k = 0; k < 4; k++) { const L = leg(k, s), n = 'l' + k;
        shapes.push(cap(L.a, L.b, 0.0016, 0.0019, n + 'a' + X, 'leg'), { ell: V(...L.a).lerp(V(...L.b), 0.55).toArray(), r: [0.0026, 0.0019, 0.0055], rot: [s * 0.9, 0, 0], bone: n + 'a' + X, tag: 'leg', k: 0.0012 },
          cap(L.b, L.c, 0.0015, 0.0011, n + 'b' + X, 'leg'), cap(L.c, L.d, 0.001, 0.0002, n + 'c' + X, 'tip')); }
    }
    const shell = R.sculpt(shapes, { name: 'crab', S, cell: 0.00022, tau: 0.0005,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('palm') + g('finger') + g('tooth') + g('claw') > 0.4) { const w = sst(0.03, 0.05, x) + 0.6 * g('finger') + g('tooth'); return { col: mix(C.claw, C.clawW, Math.min(1, w)).map(v => v * (0.94 + 0.1 * M.vn(x * 2000, y * 2000, z * 2000))), mat: [0.3, 0.55, PAT.chitin, 0] }; }
        if (g('stalk') > 0.4) return { col: C.stalk, mat: [0.4, 0.4, PAT.chitin, 0] };
        if (g('leg') + g('tip') + g('small') > 0.4) return { col: mix(C.leg, C.legD, 0.4 * sst(0.4, 0.7, M.vn(x * 1500, y * 1500, z * 1500)) + 0.3 * g('tip')), mat: [0.42, 0.4, PAT.chitin, 0] };
        if (g('under') > 0.5 || ny < -0.5) return { col: C.under, mat: [0.5, 0.3, PAT.chitin, 0] };
        /* (the shell: turquoise, marbled darker and paler) */
        const m = M.vn(x * 700, y * 700, z * 700), m2 = M.vn(x * 2200 + 4, y * 2200, z * 2200);
        return { col: mix(mix(C.shell, C.shellD, sst(0.55, 0.75, m)), C.shellL, 0.35 * sst(0.7, 0.85, m2)), mat: [0.3, 0.6, PAT.chitin, 0] };
      } });
    const eyes = [-1, 1].map(s => R.eye(S, [0.0119, 0.0285, s * 0.0089], 0.0013, [0.3, 0.6, s * 0.7], { col: C.eye, iris: 0.2, pupil: 0.1, white: 0.02, rough: 0.2, coat: 0.6, bone: 'es' + side(s) }));
    const B = R.body(S, [shell, ...eyes], {});
    const g = B.g; g.name = 'fiddler';

    /* ── moving ── */
    const legTo = (P, k, s, tip) => {
      const X = side(s), L = leg(k, s), n = 'l' + k, joint = V(tip.x + (L.c[0] - L.d[0]), tip.y + (L.c[1] - L.d[1]), tip.z + (L.c[2] - L.d[2]));
      R.reach(P, n + 'a' + X, n + 'b' + X, n + 'c' + X, L.c, joint, qE(), P.world(n + 'a' + X).add(V(0, 0.02, s * 0.004)));
    };
    const stance = (P, t, { h = 0, sway = 0, legs = {} } = {}) => {
      P.off.set(0, h, sway);
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const L = leg(k, s), o2 = legs[k + '' + s] || [0, 0, 0]; legTo(P, k, s, V(L.d[0] + o2[0], L.d[1] + o2[1], L.d[2] + o2[2])); }
    };
    const stalks = (P, t, down = 0) => { for (const s of [-1, 1]) P.set('es' + side(s), s * (0.08 * wave(t, s + 2, 0.6) - 1.35 * down), 0, -0.1 * down); };
    const MX = side(MJ), MN = side(-MJ);
    const clips = {
      stand: (P, t) => { stance(P, t, { h: 0.0004 * Math.sin(t * 1.3) }); stalks(P, t); P.set('mx', 0, 0, 0.2 * Math.max(0, Math.sin(t * 9))); },
      /* the wave: the great claw lifted and opened out and up, held, then swept down again; the body rising on tiptoe */
      wave: (P, t) => {
        const c = (t % 1.25) / 1.25, up = Math.sin(Math.PI * sst(0.0, 0.55, c)) * (1 - sst(0.75, 1, c)) + sst(0.0, 0.3, c) * (1 - sst(0.3, 0.9, c)) * 0.2;
        stance(P, t, { h: 0.003 * up });
        /* (unfolded outward and lifted high, the fingers turned up, then swept down and folded back across) */
        if (!fem) { P.set('cm' + MX, MJ * -1.0 * up, MJ * 0.5 * up, 1.0 * up); P.set('cc' + MX, 0, MJ * 0.4 * up, 0.25 * up); P.set('cp' + MX, MJ * -0.3 * up, MJ * 1.1 * up, 0.5 * up); P.set('cd' + MX, 0, -MJ * 0.25 * up, 0); }
        stalks(P, t); P.set('cm' + MN, 0, 0, 0.2 * up);
      },
      /* feeding: the small claw down to the mud and up to the mouth, quick, again and again */
      feed: (P, t) => {
        stance(P, t, { h: -0.0015 }); stalks(P, t, 0.05);
        const c = (t * 2.2) % 1, dn = Math.sin(Math.PI * c);
        for (const s of fem ? [-1, 1] : [-MJ]) { const X = side(s), ph = fem && s > 0 ? (c + 0.5) % 1 : c, d2 = Math.sin(Math.PI * ph);
          P.set('cm' + X, 0, s * 0.3 * d2, -0.7 * d2 + 0.25); P.set('cc' + X, 0, 0, -0.5 * d2); P.set('cd' + X, 0, 0, 0.4 * (ph < 0.3 ? 1 : 0)); }
        P.set('mx', 0, 0, 0.3 * Math.max(0, Math.sin(t * 14)));
      },
      /* sideways: the legs on the leading side reaching and pulling, those behind pushing, in two alternating sets */
      walk: (P, t) => {
        const dir = o.dir || 1, hz = 3.2, legs = {};
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
          const ph = ((t * hz + ((k + (s > 0 ? 1 : 0)) % 2) * 0.5) % 1 + 1) % 1, st = ph < 0.55, v = st ? ph / 0.55 : (ph - 0.55) / 0.45;
          const dz = (st ? 0.5 - v : -0.5 + v) * 0.009 * dir, lift = st ? 0 : 0.005 * Math.sin(Math.PI * v);
          legs[k + '' + s] = [0, lift, dz];
        }
        stance(P, t, { h: 0.0008, sway: 0.0012 * Math.sin(TAU * hz * t) * dir, legs }); stalks(P, t, 0.0);
        P.set('cara', 0.05 * Math.sin(TAU * hz * t), 0, 0);
      },
      /* alarm: the eyes folded down into their grooves, the body pressed low */
      alarm: (P, t) => { stance(P, t, { h: -0.0035 }); stalks(P, t, sst(0.0, 0.25, t % 3) * (1 - sst(2.2, 2.6, t % 3))); },
      /* ducking into the burrow: crouched low, the great claw drawn across the front */
      duck: (P, t) => { stance(P, t, { h: -0.005 }); stalks(P, t, 1); if (!fem) { P.set('cm' + MX, 0, -MJ * 0.5, -0.2); P.set('cc' + MX, 0, -MJ * 0.4, 0); } }
    };
    clips.idle = clips.stand;
    return R.creature(g, S, clips, o);
  });
})();
