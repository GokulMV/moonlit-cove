/* wild/insect.js — what the island's insects share (wild/birdwing, wild/cicada, wild/bee, wild/firefly): the head with
   its compound eyes and feelers (and a butterfly's coiled tongue), the thorax, the jointed abdomen, six legs of three
   joints each, and two pairs of wings — opaque and painted, or glass with dark veins — each on its hinge, beating,
   gliding, or folded as the kind folds them (up over the back, flat over the abdomen, or roofed). Built standing, the
   wings spread (facing +x, feet on y = 0).
   Insect.build(o, sp) → the model. sp (metres):
     thorax { c: [x, y], r }, head { c, r, eyes: { c: [x, y, z], r, col }, shapes() }, abdomen { pts: [[x, y], …],
     r: s → [width, height], shapes() }, antennae { root: [x, y, z], tip: [x, y, z], r, club }, tongue { root, len, r },
     legs: [{ root, knee, ankle, foot } (front, middle, hind: the right side's)], wings: [{ name, root: [x, y, z],
     outline: [[θ, r], …] (round the hinge: θ 0 straight out, growing backward), col(u, v, top, θ, ρ) → [r, g, b(, a)],
     glass, sweep, lift }], fold: 'up' | 'flat' | 'tent', paint(x, y, z, nx, ny, nz, tags), flap { hz, amp, twist },
     more(clips, kit) */
const Insect = (() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  function build(o, sp) {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const TH = sp.thorax, HD = sp.head, AB = sp.abdomen, AN = sp.antennae, LG = sp.legs, WG = sp.wings;
    /* ── the skeleton ── */
    const defs = [['thorax', null, [TH.c[0], TH.c[1], 0]], ['head', 'thorax', [HD.c[0] - HD.r[0] * 0.6, HD.c[1], 0], { tail: [HD.c[0] + HD.r[0], HD.c[1], 0] }]];
    defs.push(...R.sides((s, X) => { const r = AN.root, t = AN.tip, m = [(r[0] + t[0]) / 2, (r[1] + t[1]) / 2 + (AN.arch || 0), (r[2] + t[2]) / 2];
      return [['an' + X, 'head', [r[0], r[1], s * r[2]], { tail: [m[0], m[1], s * m[2]] }], ['ac' + X, 'an' + X, [m[0], m[1], s * m[2]], { tail: [t[0], t[1], s * t[2]] }]]; }));
    if (sp.tongue) { const tg = sp.tongue; for (let i = 0; i < 4; i++) defs.push(['tg' + i, i ? 'tg' + (i - 1) : 'head', [tg.root[0], tg.root[1] - tg.len * i / 4, 0], { tail: [tg.root[0], tg.root[1] - tg.len * (i + 1) / 4, 0] }]); }
    AB.pts.forEach((p, i) => defs.push(['ab' + i, i ? 'ab' + (i - 1) : 'thorax', [p[0], p[1], 0], { tail: i < AB.pts.length - 1 ? [AB.pts[i + 1][0], AB.pts[i + 1][1], 0] : [p[0] - (AB.end || 0.004), p[1], 0] }]));
    for (const w of WG) defs.push(...R.sides((s, X) => [[w.name + X, 'thorax', [w.root[0], w.root[1], s * w.root[2]], { tail: [w.root[0], w.root[1], s * (w.root[2] + 0.01)] }]]));
    LG.forEach((L, i) => defs.push(...R.sides((s, X) => { const z = v => [v[0], v[1], s * v[2]]; return [['l' + i + 'a' + X, 'thorax', z(L.root), { tail: z(L.knee) }], ['l' + i + 'b' + X, 'l' + i + 'a' + X, z(L.knee), { tail: z(L.ankle) }], ['l' + i + 'c' + X, 'l' + i + 'b' + X, z(L.ankle), { tail: z(L.foot) }]]; })));
    const S = R.skeleton(defs);

    /* ── the body ── */
    const shapes = [{ ell: [TH.c[0], TH.c[1], 0], r: TH.r, bone: 'thorax', tag: 'thorax', k: 0 }, { ell: [HD.c[0], HD.c[1], 0], r: HD.r, bone: 'head', tag: 'head', k: HD.k ?? HD.r[1] * 0.5 }, ...(HD.shapes ? HD.shapes() : []), ...(TH.shapes ? TH.shapes() : [])];
    AB.pts.forEach((p, i) => { const q = AB.pts[i + 1] || [p[0] - (AB.end || 0.004), p[1]], f = (i + 0.5) / AB.pts.length, [w, h] = AB.r(f), L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      shapes.push({ ell: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0], r: [L * (AB.overlap ?? 0.75), h, w], rot: [0, 0, Math.atan2(q[1] - p[1], q[0] - p[0])], bone: 'ab' + i, tag: 'abd' + i, k: (AB.k ?? 0.35) * Math.min(w, h) }); });
    if (AB.shapes) shapes.push(...AB.shapes());
    for (const s of [-1, 1]) {
      const X = side(s);
      LG.forEach((L, i) => { const z = v => [v[0], v[1], s * v[2]], r = L.r || [0.0008, 0.0006, 0.0004];
        shapes.push({ cap: [z(L.root), z(L.knee)], r: [r[0], r[0] * 0.8], bone: 'l' + i + 'a' + X, tag: 'leg', k: r[0] * 0.5 }, { cap: [z(L.knee), z(L.ankle)], r: [r[1], r[1] * 0.85], bone: 'l' + i + 'b' + X, tag: 'leg', k: r[1] * 0.4 }, { cap: [z(L.ankle), z(L.foot)], r: [r[2], r[2] * 0.6], bone: 'l' + i + 'c' + X, tag: 'foot', k: r[2] * 0.3 }); });
      const a = [AN.root[0], AN.root[1], s * AN.root[2]], t = [AN.tip[0], AN.tip[1], s * AN.tip[2]], m = [(a[0] + t[0]) / 2, (a[1] + t[1]) / 2 + (AN.arch || 0), (a[2] + t[2]) / 2];
      shapes.push({ cap: [a, m], r: [AN.r, AN.r * 0.9], bone: 'an' + X, tag: 'antenna', k: AN.r * 0.5 }, { cap: [m, t], r: [AN.r * 0.9, AN.r * 0.8], bone: 'ac' + X, tag: 'antenna', k: AN.r * 0.4 });
      if (AN.club) shapes.push({ ell: t, r: [AN.club * 1.8, AN.club, AN.club], bone: 'ac' + X, tag: 'club', k: AN.r });
    }
    const body = R.sculpt(shapes, { name: 'insect', S, cell: sp.cell || 0.0004, tau: sp.tau || 0.0008, paint: (x, y, z, nx, ny, nz, tg) => { const r = sp.paint(x, y, z, nx, ny, nz, tg); return { col: r.col, mat: r.mat, fur: r.fur || 0, comb: r.comb || [-1, 0, 0] }; } });
    if (sp.bodyRaw) body.raw = sp.bodyRaw;
    const parts = [body];
    /* (the compound eyes: glossy domes of tiny facets) */
    const E = HD.eyes;
    for (const s of [-1, 1]) { const g = new T.SphereGeometry(E.r, 30, 22); g.scale(1, E.sy || 1, E.sz || 0.9); g.translate(E.c[0], E.c[1], s * E.c[2]);
      parts.push({ geo: g, bind: R.rigid(S, 'head'), col: E.col, mat: E.mat || [0.32, 0.35, PAT.scale, 0], raw: [0, E.facet || E.r * 0.06, 0.4, 0] }); }
    if (sp.tongue) { const tg = sp.tongue; parts.push({ geo: R.tube(Array.from({ length: 9 }, (_, i) => [tg.root[0], tg.root[1] - tg.len * i / 8, 0]), s => tg.r * (1 - 0.4 * s), { n: 32, m: 6, cap1: tg.r * 0.5 }), bind: R.chain(S, ['tg0', 'tg1', 'tg2', 'tg3']), col: tg.col, mat: [0.5, 0.2, PAT.chitin, 0], fur: 0 }); }
    /* ── the wings: a fan of points round each hinge out to its outline, both faces painted ── */
    const glassParts = [];
    for (const w of WG) for (const s of [-1, 1]) {
      const X = side(s), oc = new T.CatmullRomCurve3(w.outline.map(([a, r]) => V(a, r, 0)), false, 'centripetal'), nt = w.nt || 40, nr = w.nr || 18;
      const at = (u, v) => { const q = oc.getPoint(u), th = q.x, rr = q.y * v; return [w.root[0] - rr * Math.sin(th), w.root[1], s * (w.root[2] + rr * Math.cos(th)), th, rr]; };
      for (const top of [true, false]) {
        const pos = [], col = [], idx = [];
        for (let i = 0; i <= nt; i++) for (let j = 0; j <= nr; j++) { const u = i / nt, v = j / nr, [x, y, z, th, rr] = at(u, v); pos.push(x, y + (top ? 1 : -1) * (w.th || 0.00003), z); col.push(w.col(u, v, top, th, rr)); }
        for (let i = 0; i < nt; i++) for (let j = 0; j < nr; j++) { const q = i * (nr + 1) + j, a = q, b = q + nr + 1, c = q + 1, d = q + nr + 2; (top === (s > 0)) ? idx.push(a, b, c, c, b, d) : idx.push(a, c, b, c, d, b); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        /* (each face's normals turned its own way) */
        const N = g.attributes.normal; for (let k = 0; k < N.count; k++) if ((N.getY(k) > 0) !== top) N.setXYZ(k, -N.getX(k), -N.getY(k), -N.getZ(k));
        const part = { geo: g, bind: R.rigid(S, w.name + X), col: w.glass ? (x, y, z, i) => col[i] : (x, y, z, i) => col[i].slice(0, 3), mat: w.mat || [0.62, 0.08, PAT.none, 0.25], fur: 0 };
        (w.glass ? glassParts : parts).push(part);
      }
    }
    const B = R.body(S, parts, sp.fur ? { fur: sp.fur } : {});
    if (glassParts.length) R.glass(S, glassParts, B);
    const g = B.g; g.name = sp.name;

    /* ── moving ── */
    const QI = new T.Quaternion();
    /* a wing: raised (+) or lowered at its hinge, swept back (+), turned about its length (pitch) */
    const wingSet = (P, nm, s, { lift = 0, sweep = 0, pitch = 0 } = {}) => P.put(nm + side(s), qE(0, -s * sweep, 0).multiply(qE(-s * lift, 0, 0)).multiply(new T.Quaternion().setFromAxisAngle(V(0, 0, 1), pitch)));
    const FOLD = { up: { lift: Math.PI / 2 - 0.05, sweep: 0 }, flat: { lift: 0.08, sweep: 1.35 }, tent: { lift: -0.05, sweep: 1.3 } }[sp.fold || 'up'];
    const folded = (P, k = 1) => WG.forEach((w, i) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: (w.restLift ?? FOLD.lift) * k, sweep: ((w.restSweep ?? FOLD.sweep) + (i ? 0.05 : 0)) * k, pitch: (w.restPitch || 0) * k }); });
    const legsStand = (P, h = 1) => LG.forEach((L, i) => { for (const s of [-1, 1]) { const X = side(s); P.set('l' + i + 'a' + X, 0, 0, 0); } });
    /* a leg's foot set at `to` (its tip, in the model's frame), the knee up */
    const footTo = (P, i, s, to) => {
      const X = side(s), L = LG[i], ank = V(to.x - (L.foot[0] - L.ankle[0]), to.y - (L.foot[1] - L.ankle[1]), to.z - s * (L.foot[2] - L.ankle[2]));
      R.reach(P, 'l' + i + 'a' + X, 'l' + i + 'b' + X, 'l' + i + 'c' + X, [L.ankle[0], L.ankle[1], s * L.ankle[2]], ank, qE(), P.world('l' + i + 'a' + X).add(V(0, 0.02, s * 0.005)));
    };
    const feel = (P, t, k = 1) => { for (const s of [-1, 1]) { const X = side(s); P.set('an' + X, 0.15 * wave(t, s + 3, 1.6) * k, 0.2 * wave(t, s + 5, 1.3) * k, 0.12 * wave(t, s + 7, 1.1) * k); P.set('ac' + X, 0, 0.1 * wave(t, s + 9, 2) * k, 0.1 * wave(t, s + 11, 1.7) * k); } };
    const coil = (P, k = 1) => { if (!sp.tongue) return; for (let i = 0; i < 4; i++) P.set('tg' + i, 0, 0, k * (i ? 1.55 : 0.9)); };
    const tucked = (P) => LG.forEach((L, i) => { for (const s of [-1, 1]) { const X = side(s); P.set('l' + i + 'a' + X, -s * 0.2, 0, (i - 1) * 0.5); P.set('l' + i + 'b' + X, 0, 0, -0.9); } });
    const FL = sp.flap || { hz: 8, amp: 1, twist: 0.4 };
    const clips = {
      rest: (P, t) => { folded(P); feel(P, t, 0.6); coil(P); P.set('ab0', 0, 0, 0.02 * Math.sin(t * 2.1)); },
      /* the walk: in two tripods — the front and hind legs of one side with the middle of the other */
      walk: (P, t) => {
        folded(P); feel(P, t); coil(P); const hz = sp.walkHz || 3, st = sp.stride || 0.006;
        LG.forEach((L, i) => { for (const s of [-1, 1]) { const set = (i % 2 === 0) === (s > 0) ? 0 : 0.5, u = ((t * hz + set) % 1 + 1) % 1, stn = u < 0.55, v = stn ? u / 0.55 : (u - 0.55) / 0.45;
          footTo(P, i, s, V(L.foot[0] + (stn ? st * (0.5 - v) : st * (-0.5 + v)), L.foot[1] + (stn ? 0 : st * 0.5 * Math.sin(Math.PI * v)), s * L.foot[2])); } });
        P.set('thorax', 0, 0.04 * Math.sin(TAU * hz * t), 0);
      },
      /* flight: the wings beating (down fast, up turned), the legs drawn up, the body tipped a little */
      fly: (P, t) => {
        const ph = TAU * FL.hz * t, c = Math.cos(ph), sn = Math.sin(ph);
        P.set('thorax', 0, 0, (FL.pitch ?? 0.1) + 0.03 * sn); P.off.set(0, (FL.bob ?? 0.002) * sn, 0);
        WG.forEach((w, i) => { const lag = i * (FL.lag ?? 0.25), a = w.amp ?? 1; for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: FL.amp * Math.cos(ph - lag) * a + (w.flyLift ?? FL.dihedral ?? 0.1), sweep: (w.flySweep ?? 0) + 0.12 * a * Math.sin(ph - lag), pitch: (FL.twist ?? 0.4) * a * Math.sin(ph - lag) + (w.flyPitch || 0) }); });
        tucked(P); feel(P, t, 0.3); coil(P);
      },
      glide: (P, t) => { P.set('thorax', 0, 0, 0.05); WG.forEach((w) => { for (const s of [-1, 1]) wingSet(P, w.name, s, { lift: (w.flyLift ?? FL.dihedral ?? 0.1) + 0.05 * wave(t, 2 + s, 1), sweep: w.flySweep ?? 0, pitch: w.flyPitch || 0 }); }); tucked(P); feel(P, t, 0.3); coil(P); },
      /* grooming: the front legs drawn over the head and feelers, rubbed together */
      groom: (P, t) => { folded(P); coil(P); for (const s of [-1, 1]) { const X = side(s); P.set('l0a' + X, -s * 0.3, -s * 0.4, 0.9 + 0.2 * Math.sin(t * 9 + s)); P.set('l0b' + X, 0, 0, -1.4 + 0.3 * Math.sin(t * 9 + s)); P.set('an' + X, 0, 0, -0.3 - 0.2 * Math.sin(t * 9)); } P.set('head', 0, 0, -0.15); }
    };
    clips.idle = clips.rest;
    if (sp.more) sp.more(clips, { R, V, qE, S, wingSet, folded, footTo, feel, coil, tucked, FL, WG, LG, TAU });
    clips.idle = clips.idle || clips.rest;
    return R.creature(g, S, clips, o);
  }
  return { build };
})();
