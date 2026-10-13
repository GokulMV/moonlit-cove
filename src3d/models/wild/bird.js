/* wild/bird.js — what the island's birds share (wild/hornbill, wild/eagle, wild/kite, wild/kingfisher, wild/egret,
   wild/megapode, wild/swiftlet): a body sculpted from its proportions, the head and bill, legs and feet with their
   scales, and the wings and tail as feathers — every flight feather a blade of its own on a bone of its own, so the
   wing folds as a bird's does (the hand back along the forearm, the feathers stacked over one another) and opens,
   fans and fingers in flight. Built in flight's own pose: the body level, wings spread, legs hanging, facing +x with
   the feet on y = 0; the clips fold it up to perch.
   Bird.build(o, sp) → the model. sp (metres):
     body { c: [x, y], r: [rx, ry, rz] }, neck { pts: [[x, y], …] from the body to the head, r: [r0, r1] }
     head { c, r, shapes(HB) more shapes of the head }, bill { shapes(HB) the bill's shapes, gape: [x, y] where the bill
     opens from }, eye { at: [x, y, z], r, ax (the way it looks), iris, pupil, col }
     wing { sh: [x, y, z] the right shoulder, arm, fore, hand (bone lengths), prim: { n, len, w, emarg }, sec: { n, len,
     w }, tert, cov (the coverts' length as a part of the feathers they cover) }
     tail { at: [x, y], n, len, w, fan (radians), shape: s → length factor across it (0 middle … 1 outer) }
     leg { hip: [x, y, z], knee, ankle, foot: [x, y] (the toes' base), toe: lengths [front, …], hallux, r, feathered }
     paint { body(x, y, z, nx, ny, nz, tags) → { col, mat, fur, comb }, feather(kind, i, s, c, top) → col, leg, bill }
     perch { pitch, crouch }, flap { hz, amp }, more(clips, kit) */
const Bird = (() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  function build(o, sp) {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const bd = sp.body, nk = sp.neck, hd = sp.head, wg = sp.wing, tl = sp.tail, lg = sp.leg;
    const FEATH = [0.72, 0.03, PAT.feather, 0];
    /* ── the wing's joints, spread: the humerus out and a little back, the forearm out and a little forward, the
       hand swept back ── */
    const W = s => {
      const S0 = V(wg.sh[0], wg.sh[1], s * wg.sh[2]), E = S0.clone().add(V(-0.16 * wg.arm, 0.02 * wg.arm, s * 0.987 * wg.arm)), Wr = E.clone().add(V(0.08 * wg.fore, 0, s * 0.997 * wg.fore)), Tp = Wr.clone().add(V(-0.25 * wg.hand, 0, s * 0.968 * wg.hand));
      return { S0, E, Wr, Tp };
    };
    const P = wg.prim, Sd = wg.sec, NT = wg.tert || 3, NR = tl.n;
    const defs = [
      ['body', null, [bd.c[0], bd.c[1], 0]],
      ['tail', 'body', [tl.at[0], tl.at[1], 0], { tail: [tl.at[0] - tl.len, tl.at[1], 0] }],
      ...Array.from({ length: NR }, (_, i) => { const f = NR > 1 ? i / (NR - 1) * 2 - 1 : 0, a = f * (tl.fan || 0.25), L = tl.len * (tl.shape ? tl.shape(Math.abs(f)) : 1);
        return ['rx' + i, 'tail', [tl.at[0] - 0.01, tl.at[1], f * tl.w * 0.35], { tail: [tl.at[0] - 0.01 - Math.cos(a) * L, tl.at[1], f * tl.w * 0.35 + Math.sin(a) * L] }]; }),
      ['n1', 'body', [nk.pts[0][0], nk.pts[0][1], 0]], ...nk.pts.slice(1, -1).map((p, i) => ['n' + (i + 2), 'n' + (i + 1), [p[0], p[1], 0]]),
      ['head', 'n' + (nk.pts.length - 1), [nk.pts[nk.pts.length - 1][0], nk.pts[nk.pts.length - 1][1], 0], { tail: sp.bill.tip }],
      ['jaw', 'head', [sp.bill.gape[0], sp.bill.gape[1], 0], { tail: sp.bill.tip }],
      ...R.sides((s, X) => [['lid' + X, 'head', [sp.eye.at[0], sp.eye.at[1], s * sp.eye.at[2]], { tail: [sp.eye.at[0] + 0.01, sp.eye.at[1], s * sp.eye.at[2]] }]]),
      ...R.sides((s, X) => { const J = W(s), out = [['sh' + X, 'body', J.S0.toArray()], ['el' + X, 'sh' + X, J.E.toArray()], ['wr' + X, 'el' + X, J.Wr.toArray(), { tail: J.Tp.toArray() }]];
        out.push(['al' + X, 'wr' + X, J.Wr.clone().add(V(0.01, 0.004, s * 0.01)).toArray(), { tail: J.Wr.clone().add(V(0.02, 0.004, s * 0.06)).toArray() }]);
        return out; }),
      ...R.sides((s, X) => [['th' + X, 'body', [lg.hip[0], lg.hip[1], s * lg.hip[2]]], ['tb' + X, 'th' + X, [lg.knee[0], lg.knee[1], s * lg.hip[2]]],
        ['tm' + X, 'tb' + X, [lg.ankle[0], lg.ankle[1], s * lg.hip[2]]], ['to' + X, 'tm' + X, [lg.foot[0], lg.foot[1], s * lg.hip[2]], { tail: [lg.foot[0] + lg.toe[1], 0.002, s * lg.hip[2]] }],
        ['ha' + X, 'tm' + X, [lg.foot[0] - 0.002, lg.foot[1], s * lg.hip[2]], { tail: [lg.foot[0] - lg.hallux, 0.002, s * lg.hip[2]] }]])
    ];
    /* the feathers' bones and where they lie (spread): primaries along the hand, fanned from back to out; secondaries
       along the forearm pointing back; tertials by the elbow; coverts over the bases of each */
    const FD = [], fdir = (psi, s) => V(-Math.sin(psi), 0, s * Math.cos(psi));
    for (const s of [-1, 1]) {
      const X = side(s), J = W(s);
      for (let i = 0; i < P.n; i++) { const f = i / (P.n - 1), root = J.Wr.clone().lerp(J.Tp, 0.06 + 0.86 * f).add(V(-0.008, 0, 0)), psi = 1.25 * (1 - f) + 0.12 * f, L = P.len * (P.lens ? P.lens(f) : 0.66 + 0.34 * Math.sin(Math.PI * 0.5 * Math.min(1, f * 1.15)));
        FD.push({ name: 'p' + X + i, par: 'wr' + X, root, dir: fdir(psi, s), L, w: P.w * (1 - 0.25 * f), kind: 'prim', i, s, f, emarg: P.emarg && f > 0.55 ? P.emarg : 0 }); }
      for (let i = 0; i < Sd.n; i++) { const f = i / (Sd.n - 1), root = J.Wr.clone().lerp(J.E, 0.04 + 0.92 * f).add(V(-0.006, 0, 0)), psi = 1.32 + 0.22 * f;
        FD.push({ name: 's' + X + i, par: 'el' + X, root, dir: fdir(psi, s), L: Sd.len * (1 - 0.06 * f), w: Sd.w, kind: 'sec', i, s, f }); }
      for (let i = 0; i < NT; i++) { const f = i / Math.max(1, NT - 1), root = J.E.clone().lerp(J.S0, 0.15 + 0.5 * f).add(V(-0.012, 0.004, 0)), psi = 1.62 + 0.18 * f;
        FD.push({ name: 'te' + X + i, par: 'sh' + X, root, dir: fdir(psi, s), L: Sd.len * (0.85 - 0.25 * f), w: Sd.w * 0.85, kind: 'tert', i, s, f }); }
      const cv = wg.cov ?? 0.42;
      /* (the greater coverts over the secondaries' bases, a row of median coverts before them, the primary coverts) */
      for (let i = 0; i < Sd.n; i++) { const d = FD.find(q => q.name === 's' + X + i); FD.push({ name: 'c' + X + i, par: 'el' + X, root: d.root.clone().add(V(0.002, 0.006, 0)), dir: d.dir.clone(), L: d.L * cv, w: d.w * 0.62, kind: 'cov', i, s, f: d.f }); }
      for (let i = 0; i < Sd.n; i += 2) { const d = FD.find(q => q.name === 's' + X + i); FD.push({ name: 'm' + X + i, par: 'el' + X, root: d.root.clone().add(V(0.004, 0.009, 0)), dir: d.dir.clone(), L: d.L * cv * 0.5, w: d.w * 0.42, kind: 'mcov', i, s, f: d.f }); }
      for (let i = 0; i < P.n; i += 2) { const d = FD.find(q => q.name === 'p' + X + i); FD.push({ name: 'q' + X + i, par: 'wr' + X, root: d.root.clone().add(V(0.002, 0.006, 0)), dir: d.dir.clone(), L: d.L * cv * 0.8, w: d.w * 0.6, kind: 'pcov', i, s, f: d.f }); }
    }
    for (const d of FD) defs.push([d.name, d.par, d.root.toArray(), { tail: d.root.clone().addScaledVector(d.dir, d.L).toArray() }]);
    const S = R.skeleton(defs);

    /* ── the body, neck and the wings' leading edges ── */
    const [cx, cy] = bd.c, [rx, ry, rz] = bd.r, np = nk.pts;
    const armShapes = s => { const X = side(s), J = W(s), seg = (A, B, bone, r0, r1, chord, th) => {
      const mid = A.clone().lerp(B, 0.5), len = A.distanceTo(B) / 2, dirv = B.clone().sub(A).normalize(), back = V(-1, 0, 0).addScaledVector(dirv, dirv.x).normalize();
      return [{ cap: [A.toArray(), B.toArray()], r: [r0, r1], bone, tag: 'arm', k: 0.012 },
        { ell: mid.clone().addScaledVector(back, chord * 0.55).toArray(), r: [chord * 0.9, th, len * 1.05], rot: [0, -Math.atan2(dirv.x, dirv.z) * (s > 0 ? 1 : 1), 0], bone, tag: 'panel', k: 0.012 }]; };
      return [...seg(J.S0, J.E, 'sh' + X, wg.lead[0], wg.lead[1], wg.panel[0], wg.panelT), ...seg(J.E, J.Wr, 'el' + X, wg.lead[1], wg.lead[2], wg.panel[1], wg.panelT * 0.85), ...seg(J.Wr, J.Tp, 'wr' + X, wg.lead[2], wg.lead[2] * 0.6, wg.panel[2], wg.panelT * 0.7)];
    };
    const bodyShapes = [
      { ell: [cx, cy, 0], r: [rx, ry, rz], bone: 'body', tag: 'body', k: 0 },
      { ell: [cx + 0.38 * rx, cy - 0.18 * ry, 0], r: [0.62 * rx, 0.82 * ry, 0.88 * rz], bone: 'body', tag: 'breast', k: 0.4 * ry },
      { ell: [cx - 0.55 * rx, cy - 0.05 * ry, 0], r: [0.6 * rx, 0.7 * ry, 0.72 * rz], bone: 'body', tag: 'rump', k: 0.4 * ry },
      { ell: [tl.at[0] + 0.02, tl.at[1], 0], r: [0.3 * rx, 0.32 * ry, 0.35 * rz], bone: 'tail', tag: 'rump', k: 0.3 * ry },
      ...np.slice(0, -1).map((p, i) => { const q = np[i + 1], f0 = i / (np.length - 1), f1 = (i + 1) / (np.length - 1);
        return { cap: [[p[0], p[1], 0], [q[0], q[1], 0]], r: [nk.r[0] + (nk.r[1] - nk.r[0]) * f0, nk.r[0] + (nk.r[1] - nk.r[0]) * f1], bone: 'n' + (i + 1), tag: 'neck', k: 0.5 * nk.r[1] }; }),
      ...armShapes(-1), ...armShapes(1),
      /* (the thighs, feathered, and the feathered or bare shanks) */
      ...[-1, 1].flatMap(s => [
        { ell: [lg.hip[0] + 0.01, lg.hip[1] - 0.01, s * (lg.hip[2] + 0.004)], r: [lg.r * 2.4, lg.r * 3.2, lg.r * 1.9], rot: [0, 0, 0.2], bone: 'th' + side(s), tag: 'thigh', k: lg.r * 1.5 },
        { cap: [[lg.knee[0], lg.knee[1], s * lg.hip[2]], [lg.ankle[0], lg.ankle[1], s * lg.hip[2]]], r: [lg.r * (lg.feathered ? 2.0 : 1.3), lg.r * (lg.feathered ? 1.5 : 0.9)], bone: 'tb' + side(s), tag: lg.feathered ? 'thigh' : 'shank', k: lg.r }])
    ];
    const body = R.sculpt(bodyShapes, { name: 'body', S, cell: sp.cell || 0.003, tau: sp.tau || 0.006,
      paint: (x, y, z, nx, ny, nz, tg) => sp.paint.body(x, y, z, nx, ny, nz, tg, FEATH) });
    /* (the contour feathers' spacing, for the way they are drawn over the body: smaller on the head) */
    const FSZ = sp.feather || ry * 0.1;
    body.raw = () => [FSZ, 0, 0, 0];

    /* ── the head and bill ── */
    const HB = { S, V };
    const head = R.sculpt([{ ell: [hd.c[0], hd.c[1], 0], r: hd.r, bone: 'head', tag: 'head', k: 0 }, ...(hd.shapes ? hd.shapes(HB) : []),
      ...[-1, 1].map(s => ({ ell: [sp.eye.at[0] + 0.15 * sp.eye.r * sp.eye.ax[0], sp.eye.at[1], s * (sp.eye.at[2] + 0.3 * sp.eye.r)], r: [sp.eye.r * 1.05, sp.eye.r * 0.8, sp.eye.r * 0.95], rot: [0, s * Math.atan2(sp.eye.ax[0], sp.eye.ax[2]) * 0.3, 0], sub: true, tag: 'socket', k: sp.eye.r * 0.2 }))],
      { name: 'head', S, cell: hd.cell || 0.0012, tau: 0.003, paint: (x, y, z, nx, ny, nz, tg) => sp.paint.head(x, y, z, nx, ny, nz, tg, FEATH) });
    head.raw = () => [FSZ * 0.55, 0, 0, 0];
    const billBind = (x, y, z, ws, tw) => [[S.ix[(tw.lower || 0) > 0.5 ? 'jaw' : 'head'], 1]];
    const bill = sp.beak ? null : R.sculpt(sp.bill.shapes(HB), { name: 'bill', S, cell: sp.bill.cell || 0.0009, tau: 0.002, bind: billBind,
      paint: (x, y, z, nx, ny, nz, tg) => sp.paint.bill(x, y, z, nx, ny, nz, tg) });
    /* ── or the bill lofted, smooth horn: each mandible between two lines (the upper's ridge and its cutting edge; the
       lower's cutting edge and the line under its chin), its sections round or keeled over the top (round: 2 an
       ellipse … 1 a keel), the cutting edges sharp, closed inside (the palate; the floor of the mouth). beak { upper:
       { top, bot: [[x, y], …] from the base to the tip, w: s → half-width, round, palate, shape(p, s, u, outer) },
       lower: { top, bot, w, round, floor, shape }, more: [{ top, bot, w, …, tag }] }, painted by paint.beak(x, y, z, s, u,
       outer, lower, tag) → { col, mat } ── */
    const loftBill = (L, lower) => {
      const cv = q => new T.CatmullRomCurve3(q.map(p => V(p[0], p[1], 0)), false, 'centripetal'), cT = cv(L.top), cB = cv(L.bot);
      const ns = L.ns || 60, nr = L.nr || 40, m = L.round ?? 2, pos = [], idx = [], cols = [], mats = [];
      for (let i = 0; i <= ns; i++) {
        const s = i / ns, A = cT.getPointAt(s), B = cB.getPointAt(s), w = Math.max(1e-5, L.w(s));
        for (let j = 0; j < nr; j++) {
          const a = j / nr * TAU, outer = j <= nr / 2, u = Math.cos(a), cu = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), m)), 1 / m);
          const f = outer ? (lower ? cu : 1 - cu) : (lower ? (L.floor ?? 0.3) * (1 - u * u) : 1 - (L.palate ?? 0.35) * (1 - u * u));
          const p = A.clone().lerp(B, f); p.z = w * u * (outer ? 1 : 0.9);
          if (L.shape) L.shape(p, s, u, outer);
          pos.push(p.x, p.y, p.z); const r = sp.paint.beak(p.x, p.y, p.z, s, u, outer, lower, L.tag || (lower ? 'lower' : 'upper')); cols.push(r.col); mats.push(r.mat);
        }
      }
      const ring = i => i * nr;
      for (let i = 0; i < ns; i++) for (let j = 0; j < nr; j++) { const a = ring(i) + j, b = ring(i) + (j + 1) % nr, c = ring(i + 1) + j, d = ring(i + 1) + (j + 1) % nr; idx.push(a, c, b, b, c, d); }
      for (const [i, fl] of [[0, true], [ns, false]]) {
        const c = pos.length / 3; let x = 0, y = 0, z = 0; for (let j = 0; j < nr; j++) { x += pos[(ring(i) + j) * 3]; y += pos[(ring(i) + j) * 3 + 1]; z += pos[(ring(i) + j) * 3 + 2]; }
        pos.push(x / nr, y / nr, z / nr); cols.push(cols[ring(i)]); mats.push(mats[ring(i)]);
        for (let j = 0; j < nr; j++) { const a = ring(i) + j, b = ring(i) + (j + 1) % nr; fl ? idx.push(c, b, a) : idx.push(c, a, b); }
      }
      let N = M.normalsOf(pos, idx);
      /* (faces outward: the top of the upper's middle faces up, the underside of the lower's down) */
      { const k = ring(ns >> 1) + (nr >> 2); if (N[k * 3 + 1] * (lower ? -1 : 1) < 0) { for (let t = 0; t < idx.length; t += 3) { const q = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = q; } N = M.normalsOf(pos, idx); } }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setIndex(idx); g.computeBoundingSphere();
      return { geo: g, bind: R.rigid(S, L.bone || (lower ? 'jaw' : 'head')), col: (x, y, z, i) => cols[i], mat: (x, y, z, i) => mats[i], fur: 0 };
    };
    /* (and any more pieces lofted the same way over the upper one: a hornbill's casque) */
    const beak = sp.beak ? [loftBill(sp.beak.upper, false), loftBill(sp.beak.lower, true), ...(sp.beak.more || []).map(L => loftBill(L, false))] : [];

    /* ── the legs and feet: scaled, the toes long, the hind toe opposite ── */
    const toeShapes = [];
    for (const s of [-1, 1]) {
      const X = side(s), hz = s * lg.hip[2], F = lg.foot, toes = lg.toe, spread = lg.spread || 0.5;
      toeShapes.push({ cap: [[lg.ankle[0], lg.ankle[1], hz], [F[0], F[1], hz]], r: [lg.r * 0.95, lg.r * 0.85], bone: 'tm' + X, tag: 'tarsus', k: lg.r * 0.6 });
      toeShapes.push({ ell: [lg.ankle[0], lg.ankle[1], hz], r: [lg.r * 1.3, lg.r * 1.35, lg.r * 1.2], bone: 'tm' + X, tag: 'tarsus', k: lg.r * 0.6 });
      toes.forEach((L, i) => { const a = (i - (toes.length - 1) / 2) * spread, d = [Math.cos(a), 0, s * Math.sin(a)], tip = [F[0] + d[0] * L, 0.0025, hz + d[2] * L], mid = [F[0] + d[0] * L * 0.5, 0.0035, hz + d[2] * L * 0.5];
        toeShapes.push({ cap: [[F[0], F[1], hz], mid], r: [lg.r * 0.7, lg.r * 0.5], bone: 'to' + X, tag: 'toe', k: lg.r * 0.4 }, { cap: [mid, tip], r: [lg.r * 0.5, lg.r * 0.32], bone: 'to' + X, tag: 'toe', k: lg.r * 0.2 },
          { cap: [tip, [tip[0] + d[0] * lg.claw, 0.001, tip[2] + d[2] * lg.claw]], r: [lg.r * 0.3, lg.r * 0.06], bone: 'to' + X, tag: 'claw', k: lg.r * 0.1 }); });
      const ht = [F[0] - lg.hallux, 0.0025, hz];
      toeShapes.push({ cap: [[F[0], F[1], hz], ht], r: [lg.r * 0.65, lg.r * 0.4], bone: 'ha' + X, tag: 'toe', k: lg.r * 0.3 }, { cap: [ht, [ht[0] - lg.claw, 0.001, hz]], r: [lg.r * 0.36, lg.r * 0.06], bone: 'ha' + X, tag: 'claw', k: lg.r * 0.1 });
    }
    const feet = R.sculpt(toeShapes, { name: 'feet', S, cell: lg.cell || 0.0008, tau: 0.0015,
      paint: (x, y, z, nx, ny, nz, tg) => (tg.claw || 0) > 0.5 ? { col: sp.paint.claw || lin('#1c1916'), mat: [0.35, 0.4, PAT.horn, 0], fur: 0 } : { col: sp.paint.leg, mat: [0.6, 0.15, PAT.scale, 0], fur: 0, comb: [0, 0, 0], scale: true } });
    /* (the leg's scales: their size, and how domed, for the scale pattern) */
    feet.raw = () => [0, lg.scale || lg.r * 0.55, 0.5, 0];

    /* (the body's surface, without its wings: how far from it, the way out of it, a point brought onto it m out) */
    const trunk = R.field(bodyShapes.filter(q => ['body', 'breast', 'rump', 'neck'].includes(q.tag))), F = p => trunk(p.x, p.y, p.z), e = ry * 0.03;
    const grad = p => V(F(V(p.x + e, p.y, p.z)) - F(V(p.x - e, p.y, p.z)), F(V(p.x, p.y + e, p.z)) - F(V(p.x, p.y - e, p.z)), F(V(p.x, p.y, p.z + e)) - F(V(p.x, p.y, p.z - e))).normalize();
    const onto = (p, m) => { for (let i = 0; i < 6; i++) p.addScaledVector(grad(p), m - F(p)); return p; };
    const STACK = P.n + Sd.n + 2 + NT, gapM = ((wg.fold && wg.fold.gap) ?? 0.007) * Sd.w, m0F = wg.lead[2] * 0.3;

    /* ── the flight feathers, each a thin cambered blade on its own bone ── */
    const blades = [];
    const shapeW = (s, emarg) => { const w = sst(0.0, 0.16, s) * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, (s - 0.5) / 0.5), 2.4)), 0.55); return w; };
    for (const d of FD) {
      /* (across: in the wing's plane, square to the feather, toward its outer vane — the wing's leading edge or tip) */
      const up = V(0, 1, 0), across = V(d.s * d.dir.z, 0, -d.s * d.dir.x).normalize(), root = d.root.clone(), L = d.L;
      const kind = d.kind, inner = kind === 'prim' ? 0.72 : kind === 'mcov' ? 0.55 : 0.62, th = kind === 'cov' || kind === 'pcov' || kind === 'mcov' ? 0.024 : 0.016;
      const g = M.foil(14, 8, s => {
        let w = d.w * shapeW(s), wo = w * (1 - inner), wi = w * inner;
        if (d.emarg && s > 0.55) { const e = sst(0.55, 0.62, s); wi *= 1 - d.emarg * e; wo *= 1 - 0.4 * d.emarg * e; }
        const p = root.clone().addScaledVector(d.dir, L * s).addScaledVector(up, -0.06 * L * s * s * (kind === 'prim' ? 1 : 0.5));
        return { le: p.clone().addScaledVector(across, wo + 0.0004).toArray(), ch: across.clone().multiplyScalar(-(wo + wi + 0.0008)).toArray(), up: up.toArray(), th, camber: kind === 'prim' || kind === 'sec' ? 0.035 : 0.06 };
      }, (x, y, z, s, c, top) => sp.paint.feather(kind === 'mcov' ? 'cov' : kind, d.i, s, c, top, d.f));
      blades.push({ geo: g, bind: R.rigid(S, d.name), mat: [0.6, 0.06, PAT.vane, 0.18], raw: [1 - inner, L, d.w, (d.i * 7 + (d.s > 0 ? 3 : 0)) % 10 / 10] });
    }
    /* the scapulars: long feathers from the shoulders lying back over the back's sides and the wing's base, covering
       where the folded wing meets the back (on the body, so they stay as they lie) */
    const NSC = wg.scap ?? 8;
    for (const s of [-1, 1]) for (let i = 0; i < NSC; i++) {
      const f = i / Math.max(1, NSC - 1), L = Sd.len * (0.62 - 0.2 * f), w = Sd.w * 0.4, mS = m0F + gapM * (STACK + 1 + f * 3);
      const root = onto(V(wg.sh[0] + 0.02 - 0.09 * f, cy + ry, s * rz * (0.18 + 0.6 * f)), m0F + gapM * STACK * 0.5), dir = V(-1, -0.04 - 0.1 * f, s * (0.04 + 0.3 * f)).normalize();
      for (let k = 0; k < 4; k++) dir.copy(onto(root.clone().addScaledVector(dir, L * 0.5), mS).sub(root).normalize());
      const nrm = grad(root.clone().addScaledVector(dir, L * 0.5)).add(V(0, 0.3, 0)); nrm.addScaledVector(dir, -nrm.dot(dir)).normalize();
      const across = new T.Vector3().crossVectors(dir, nrm).multiplyScalar(s).normalize();
      const g = M.foil(12, 8, t => { const ww = w * shapeW(t), p = root.clone().addScaledVector(dir, L * t).addScaledVector(nrm, -0.1 * L * t * t);
        return { le: p.clone().addScaledVector(across, ww * 0.35 + 0.0004).toArray(), ch: across.clone().multiplyScalar(-(ww + 0.0008)).toArray(), up: nrm.toArray(), th: 0.02, camber: 0.07 }; },
        (x, y, z, t, c, top) => sp.paint.feather('cov', i, t, c, top, 0.5));
      blades.push({ geo: g, bind: R.rigid(S, 'body'), mat: [0.64, 0.04, PAT.vane, 0.12], raw: [0.35, L, w, (i * 3 + (s > 0 ? 5 : 0)) % 10 / 10] });
    }
    /* the tail's feathers */
    for (let i = 0; i < NR; i++) {
      const n = 'rx' + i, A = S.head[n], Bt = S.tail[n], dir = Bt.clone().sub(A), L = dir.length(); dir.normalize();
      const across = V(-dir.z, 0, dir.x).normalize(), f = NR > 1 ? i / (NR - 1) * 2 - 1 : 0;
      const g = M.foil(14, 8, s => { const w = tl.w / NR * 1.9 * shapeW(s * 0.92 + 0.08), p = A.clone().addScaledVector(dir, L * s).add(V(0, 0.001 * Math.abs(f) * (i % 2), 0));
        return { le: p.clone().addScaledVector(across, w * 0.45).toArray(), ch: across.clone().multiplyScalar(-w).toArray(), up: [0, 1, 0], th: 0.016, camber: 0.02 }; },
        (x, y, z, s, c, top) => sp.paint.feather('tail', i, s, c, top, Math.abs(f)));
      blades.push({ geo: g, bind: R.rigid(S, n), mat: [0.6, 0.06, PAT.vane, 0.15], raw: [0.45, L, tl.w / NR * 1.9, i * 0.37 % 1] });
    }

    /* ── the eyes ── */
    const E = sp.eye, eyes = [-1, 1].map(s => R.eye(S, [E.at[0], E.at[1], s * E.at[2]], E.r, [E.ax[0], E.ax[1], s * E.ax[2]], { col: E.col, iris: E.iris ?? 0.62, pupil: E.pupil ?? 0.3, white: E.white ?? 0.1, rough: 0.05, coat: 0.9 }));
    const lids = [-1, 1].map(s => R.lid(S, [E.at[0], E.at[1], s * E.at[2]], E.r * 1.07, [E.ax[0], E.ax[1], s * E.ax[2]], 'lid' + side(s), E.lid || lin('#2a2420'), 0.5));

    const B = R.body(S, [body, head, ...(bill ? [bill] : []), ...beak, feet, ...blades, ...eyes, ...lids, ...(sp.parts ? sp.parts(S, HB) : [])], { fur: sp.fur });
    const g = B.g; g.name = sp.name;

    /* ── how the wing folds. The arm's three bones laid against the body's side — the humerus back along the upper
       flank, the forearm forward to the wrist at the breast, the hand back along it — each joint found on the body's
       surface, a little out from it. Then the feathers closed over the flank like a fan: the tertials on top over the
       back, the secondaries under them each a little lower and further in, the primaries innermost, run back along
       the body and over the tail; each laid on the body at its own depth in the stack, its face turned outward ── */
    const fold = {};
    {
      /* (the way from A, L long, that ends on the surface m out from the body, nearest the way d0) */
      const hug = (A, L, d0, m) => { const d = d0.clone().normalize(); for (let i = 0; i < 12; i++) d.copy(onto(A.clone().addScaledVector(d, L), m).sub(A).normalize()); return d; };
      const Pf = new R.Pose(S), up = V(0, 1, 0), FS = wg.fold || {};
      for (const s of [-1, 1]) {
        const X = side(s), J = W(s), Z = v => V(v[0], v[1], s * v[2]);
        const restH = J.E.clone().sub(J.S0).normalize(), restF = J.Wr.clone().sub(J.E).normalize(), restM = J.Tp.clone().sub(J.Wr).normalize();
        const hd = hug(J.S0, wg.arm, Z(FS.arm || [-0.95, -0.05, 0.3]), wg.lead[1] * 0.45), E = J.S0.clone().addScaledVector(hd, wg.arm);
        const fd = hug(E, wg.fore, Z(FS.fore || [0.97, 0.1, 0]), wg.lead[2] * 0.6), Wr = E.clone().addScaledVector(fd, wg.fore);
        const md = hug(Wr, wg.hand, Z(FS.hand || [-1, -0.12, 0]), wg.lead[2] * 0.9);
        Pf.aim('sh' + X, R.frameTo(restH, up, hd, grad(J.S0.clone().lerp(E, 0.6))));
        Pf.aim('el' + X, R.frameTo(restF, up, fd, grad(E.clone().lerp(Wr, 0.5))));
        Pf.aim('wr' + X, R.frameTo(restM, up, md, grad(Wr.clone().addScaledVector(md, wg.hand * 0.5))));
        for (const b of ['sh', 'el', 'wr']) fold[b + X] = Pf.get(b + X);
        /* (each feather's place in the closed fan, from the innermost — the outer primary, lowest — to the outermost,
           the innermost tertial on top; the primaries run back to over the tail) */
        const rank = d => d.kind === 'prim' ? P.n - 1 - d.i : d.kind === 'pcov' ? P.n - 0.5 : d.kind === 'sec' ? P.n + 1 + d.i : d.kind === 'cov' ? P.n + 5 + d.i : d.kind === 'mcov' ? P.n + 9 + d.i : P.n + Sd.n + 2 + d.i;
        const dm = gapM, m0 = m0F, [a0, a1] = FS.droop || [0.4, 0.1];
        const TT = V(tl.at[0] - tl.len * (FS.reach ?? 0.7), tl.at[1] + ry * 0.25, 0);
        for (const d of FD.filter(q => q.s === s)) {
          const root = Pf.at(d.par, d.root), k = d.kind, a = k === 'tert' ? (FS.tert ?? 0.04) : a0 + (a1 - a0) * d.f + (k === 'cov' ? 0.2 : k === 'mcov' ? 0.32 : 0);
          const dir = k === 'prim' || k === 'pcov' ? V(TT.x, TT.y + ry * 0.15 * (1 - d.f), s * rz * (0.18 + 0.2 * (1 - d.f))).sub(root).normalize() : V(-Math.cos(a), -Math.sin(a), 0);
          const m = m0 + dm * rank(d);
          for (let i = 0; i < 4; i++) dir.copy(onto(root.clone().addScaledVector(dir, d.L * 0.5), m).sub(root).normalize());
          /* (each feather's face turned up a little from the body's, so its inner vane, toward the wing's leading edge,
             tucks in under the feathers above it) */
          const tilt = { prim: 0.2, pcov: 0.4, sec: 0.35, cov: 0.55, mcov: 0.6, tert: 0.8 }[k] ?? 0.4;
          Pf.aim(d.name, R.frameTo(d.dir, up, dir, grad(root.clone().addScaledVector(dir, d.L * 0.5)).add(V(0, tilt, 0))));
          fold[d.name] = Pf.get(d.name);
        }
      }
    }
    const QI = new T.Quaternion();
    /* a wing's pose: how far folded (0 spread … 1 folded), raised (radians, up positive), swept forward, its hand
       folded back by more, its feathers fanned (primaries spread and parted at their tips) and twisted */
    const wing = (Pz, s, { f = 1, lift = 0, sweep = 0, hand = 0, fan = 0, twist = 0, pitch = 0 } = {}) => {
      const X = side(s);
      Pz.put('sh' + X, QI.clone().slerp(fold['sh' + X], f)); Pz.pre('sh' + X, -s * lift, s * sweep, pitch);
      Pz.put('el' + X, QI.clone().slerp(fold['el' + X], Math.min(1, f + 0.4 * hand)));
      Pz.put('wr' + X, QI.clone().slerp(fold['wr' + X], Math.min(1, f + hand))); if (twist) Pz.turn('wr' + X, 0, 0, twist);
      for (const d of FD) if (d.s === s) {
        Pz.put(d.name, QI.clone().slerp(fold[d.name], Math.min(1, f + (d.par === 'wr' + X ? hand : 0.4 * hand))));
        if (fan && d.kind === 'prim') Pz.turn(d.name, 0, -s * fan * (d.f - 0.5) * 0.3, -fan * 0.25 * d.f);
      }
    };
    /* the tail: raised (positive) or lowered, fanned (0 closed … 1 spread wide) */
    const REST_FAN = tl.fan || 0.25;
    const tailPose = (Pz, pitch = 0, fan = 0.3, yaw = 0) => {
      Pz.set('tail', 0, yaw, pitch);
      for (let i = 0; i < NR; i++) { const f = NR > 1 ? i / (NR - 1) * 2 - 1 : 0; Pz.set('rx' + i, 0, f * REST_FAN * (1.6 * fan - 1), 0); }
    };
    /* legs: the foot set at `to` (the toes' base), toes curled round a perch (curl) or flat; the ankle bent backward */
    const legTo = (Pz, s, to, curl = 0, Qf) => {
      const X = side(s), Q = Qf || qE();
      R.reach(Pz, 'tb' + X, 'tm' + X, 'to' + X, S.head['to' + X].toArray(), to, Q, Pz.world('tm' + X).add(V(-0.4, 0.05, s * 0.02)));
      Pz.aim('to' + X, Q); if (curl) Pz.turn('to' + X, 0, 0, -curl); Pz.set('ha' + X, 0, 0, curl * 0.9);
    };
    /* in flight the legs drawn up into the belly's feathers, the feet folded back */
    const LT = V(...lg.knee).distanceTo(V(...lg.ankle)), LM = V(...lg.ankle).distanceTo(V(lg.foot[0], lg.foot[1], 0)), LO = lg.toe[Math.floor(lg.toe.length / 2)];
    const legsUp = (Pz, k = 1) => {
      const Qb = new T.Quaternion(); Pz.world('body', V(), Qb); const D = (x, y) => V(x, y, 0).normalize().applyQuaternion(Qb);
      for (const s of [-1, 1]) {
        const X = side(s); Pz.set('th' + X, 0, 0, -0.3 * k);
        const kn = Pz.world('tb' + X), back = sp.tuck === 'back';
        const an = kn.clone().addScaledVector(D(back ? -0.88 : 0.35, back ? -0.42 : -0.94), LT), ft = an.clone().addScaledVector(D(back ? -1 : -0.96, back ? 0.12 : 0.28), LM), tt = ft.clone().addScaledVector(D(back ? -0.8 : -0.5, back ? 0.6 : 0.86), LO);
        const rest = [kn, S.head['tm' + X].clone(), S.head['to' + X].clone(), S.tail['to' + X].clone()].map(v => v.clone());
        R.chainTo(Pz, ['tb' + X, 'tm' + X, 'to' + X], [kn, an, ft, tt].map((v, i) => i ? rest[i].clone().lerp(v, k).toArray() : v.toArray()));
        Pz.set('ha' + X, 0, 0, 1.2 * k);
      }
    };
    const FWD = V(...(sp.head.fwd || [1, 0, 0])).normalize(), NECK = ['n1', ...np.slice(1, -1).map((p, i) => 'n' + (i + 2))];
    /* the head turned to look along dir, the neck sharing the turn; or the bill brought to a point */
    /* (the neck's own lift: its base raised and its top bent back down, in an S, the head kept as it looks) */
    const LIFT = nk.lift || 0;
    const look = (Pz, dir, k = 1, lift = LIFT) => {
      const d = dir.clone().normalize(), sd = new T.Vector3().crossVectors(d, V(0, 1, 0)); if (sd.lengthSq() < 1e-6) sd.set(0, 0, 1); sd.normalize();
      const Wq = R.frameTo(FWD, V(0, 0, 1), d, sd), Qb = new T.Quaternion(); Pz.world('body', V(), Qb);
      NECK.forEach((n, i) => { const Qp = new T.Quaternion(), fr = (i + 1) / (NECK.length + 1); Pz.world(Pz.S.par[n], V(), Qp); Qp.slerp(Wq, fr * k); if (lift) Qp.multiply(qE(0, 0, lift * (i === 0 ? 1 : -1.1 * fr))); Pz.aim(n, Qp); });
      const Qh = new T.Quaternion(); Pz.world('head', V(), Qh); Pz.aim('head', Qh.slerp(Wq, k).normalize());
    };
    const lookAt = (Pz, pt, k = 1) => look(Pz, pt.clone().sub(Pz.world('head')), k);
    const face = (Pz, t, gape = 0, shut = 0) => { const b = Math.max(R.blink(t, 6.2), shut); Pz.set('lidL', 0, 0, -1.0 * b); Pz.set('lidR', 0, 0, -1.0 * b); Pz.set('jaw', 0, 0, -gape); };
    /* the neck held as it is at rest (s-curved or straight), the head level */
    const perchBody = (Pz, t, pitch, crouch = 0) => {
      const ph = sp.perch || {}, Pp = pitch ?? ph.pitch ?? 0.6, hipW = Pz.S.head['tb' + 'L'];
      Pz.set('body', 0.02 * wave(t, 2, 0.3), 0, Pp);
      /* (set down so the feet stand on y = 0, under the body) */
      const footX = ph.footX ?? (lg.foot[0] + 0.01), drop = ph.drop ?? 0;
      Pz.off.set(ph.dx ?? 0, (ph.dy ?? 0) - crouch * (ph.crouch || 0.03), 0);
      for (const s of [-1, 1]) legTo(Pz, s, V(footX, lg.foot[1] - drop, s * lg.hip[2] * (ph.stance ?? 1)), ph.curl ?? 0.5);
      for (const s of [-1, 1]) wing(Pz, s, { f: 1, lift: ph.wingLift ?? 0.05 });
      tailPose(Pz, ph.tail ?? 0.1, 0.15);
    };

    const flapHz = sp.flap ? sp.flap.hz : 3, amp = sp.flap ? sp.flap.amp : 0.9;
    const clips = {
      perch: (Pz, t) => {
        perchBody(Pz, t);
        look(Pz, FWD.clone().add(V(0, ((sp.perch && sp.perch.gaze) || 0) + 0.15 * wave(t, 5, 0.4), 0.9 * wave(t, 7, 0.35))), 1);
        face(Pz, t);
        const sh = R.every(t, 7, 0.6, 4); if (sh > 0) { const k = Math.sin(Math.PI * sh); for (const s of [-1, 1]) wing(Pz, s, { f: 1 - 0.12 * k, lift: 0.1 * k }); }
      },
      fly: (Pz, t, k) => {
        /* flapping: down with the wing spread, up with the hand folded in; the body level, legs tucked back */
        const ph = t * flapHz, c = Math.cos(TAU * ph), sn = Math.sin(TAU * ph), up = 0.5 + 0.5 * c, dn = 1 - up;
        Pz.off.set(0, 0.0 + 0.012 * sn * (sp.size || 1), 0); Pz.set('body', 0, 0, 0.04 + 0.03 * sn);
        for (const s of [-1, 1]) wing(Pz, s, { f: 0.08 + 0.3 * Math.max(0, -sn) * up, lift: amp * (c * 0.55 + 0.1), hand: 0.25 * Math.max(0, -sn), sweep: 0.1 * sn, fan: 0.4 * dn, twist: 0.25 * sn });
        tailPose(Pz, -0.02, 0.35); legsUp(Pz); look(Pz, FWD.clone().add(V(0, -0.05, 0)), 0.7); face(Pz, t);
      },
      glide: (Pz, t) => {
        Pz.set('body', 0.04 * wave(t, 3, 0.4), 0, 0.02);
        for (const s of [-1, 1]) wing(Pz, s, { f: 0.04, lift: (sp.dihedral ?? 0.08) + 0.03 * wave(t, 4 + s, 0.6), fan: 0.5, hand: 0.03 });
        tailPose(Pz, 0, 0.45); legsUp(Pz); look(Pz, FWD.clone().add(V(0, -0.1, 0.2 * wave(t, 8, 0.3))), 0.8); face(Pz, t);
      },
      soar: (Pz, t) => {
        Pz.set('body', 0.25 + 0.05 * wave(t, 3, 0.3), 0, 0.03);
        for (const s of [-1, 1]) wing(Pz, s, { f: 0.0, lift: (sp.dihedral ?? 0.08) + 0.08, fan: 1, twist: -0.05 });
        tailPose(Pz, 0.02, 1, -0.08); legsUp(Pz); look(Pz, V(0.9, -0.3, -0.35), 0.9); face(Pz, t);
      },
      takeoff: (Pz, t) => {
        /* a crouch, the spring, then deep strong strokes, the legs trailing */
        const c = (t % 1.6) / 1.6, cr = sst(0, 0.25, c) * (1 - sst(0.28, 0.36, c)), go = sst(0.3, 0.4, c);
        perchBody(Pz, t, (sp.perch && sp.perch.pitch || 0.5) * (1 - go) + 0.35 * go, cr);
        Pz.off.y += 0.25 * go * (sp.size || 1) * sst(0.3, 1, c);
        const ph = t * flapHz * 1.2, cc = Math.cos(TAU * ph), sn = Math.sin(TAU * ph);
        for (const s of [-1, 1]) wing(Pz, s, { f: (1 - go) * (1 - 0.7 * cr) + go * (0.1 + 0.35 * Math.max(0, -sn)), lift: go * amp * 1.2 * (cc * 0.6 + 0.2) + 0.6 * cr, hand: go * 0.3 * Math.max(0, -sn), fan: go, sweep: 0.15 * go * sn });
        if (go > 0.6) legsUp(Pz, sst(0.6, 1, c)); tailPose(Pz, -0.2 * go, 0.4 + 0.5 * go); look(Pz, FWD.clone().add(V(0, 0.1, 0)), 0.8); face(Pz, t);
      },
      land: (Pz, t) => {
        /* coming in: wings up and spread wide to brake, tail fanned and down, feet reaching forward */
        const ph = t * flapHz * 0.8, sn = Math.sin(TAU * ph);
        Pz.set('body', 0, 0, 0.55); Pz.off.set(0, 0.08 * (sp.size || 1), 0);
        for (const s of [-1, 1]) wing(Pz, s, { f: 0.05, lift: 0.75 + 0.25 * sn, sweep: 0.3, fan: 1, twist: 0.35 });
        for (const s of [-1, 1]) legTo(Pz, s, V(lg.foot[0] + 0.12 * (sp.size || 1), lg.foot[1] - 0.02, s * lg.hip[2]), 0.1, qE(0, 0, 0.6));
        tailPose(Pz, -0.45, 1); look(Pz, FWD.clone().add(V(0, -0.35, 0)), 0.9); face(Pz, t);
      },
      preen: (Pz, t) => {
        perchBody(Pz, t);
        const sd = Math.sin(t * 0.4) > 0 ? 1 : -1, wpt = Pz.at('el' + side(sd), W(sd).E.clone().lerp(W(sd).Wr, 0.4).add(V(-0.04, 0.02, 0)).toArray());
        R.ccd(Pz, [...NECK, 'head'], S.tail.head.toArray(), wpt.clone().add(V(0.0, 0.01 * Math.sin(t * 9), 0)), { iters: 10, k: 0.5 });
        wing(Pz, sd, { f: 0.9, lift: 0.15 }); face(Pz, t, 0.04 * Math.max(0, Math.sin(t * 9)), 0.5);
      },
      call: (Pz, t) => {
        perchBody(Pz, t);
        const c = (t % 2.2) / 2.2, on = sst(0.0, 0.08, c) * (1 - sst(0.35, 0.45, c));
        look(Pz, FWD.clone().add(V(0, 0.4 + 0.3 * on, 0)), 1); face(Pz, t, (sp.gape || 0.35) * on);
      }
    };
    if (sp.more) sp.more(clips, { R, V, qE, S, wing, tailPose, legTo, legsUp, look, lookAt, face, perchBody, FWD, NECK, W, flapHz, amp, TAU });
    clips.idle = clips.idle || clips.perch;
    return R.creature(g, S, clips, o);
  }
  return { build };
})();
