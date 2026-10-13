/* ─────────────────────────────────────────────────────────────
   models/struct/jetty.js — the timber jetty out from the beach.
   It runs along +x from the shore (x = 0) to its head, y = 0 the
   sea's mean level (o.bed(x): the seabed's height along it). Bents
   every three metres: two round hardwood piles driven into the bed,
   barnacles crusted on them between the tides and weed below, a
   headstock across their tops, an X of bracing where the water is
   deep enough; five stringers along over the headstocks, staggered;
   the deck of boards across them, weathered silver, a few gaps, the
   odd new board still dark; kerbs along its edges; a railing each
   side, posts and two rails. At its end a T-head, wider, with a
   shelter (a green iron roof on four posts, benches either side),
   bollards at its corners, old tyres hung as fenders, a timber
   ladder down to the water, a life ring on its post, a solar lamp.
   o: { len (to the head, m), width, deck (its height), head }
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, S = () => StructKit, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;

  /* a pile from its foot in the bed to its top: weed where it is always wet, barnacles between the tides, bare weathered
     wood above them; each its own material, joined where the bands meet */
  function pileBands(B, x, z, r, y0, y1, R, o = {}) {
    const lo = o.weed ?? -0.5, hi = o.barn ?? 0.55 + 0.1 * (R() - 0.5), seed = Math.floor(R() * 999), u0 = R() * 3, lean = (R() - 0.5) * 0.012, m = S().M(x, 0, z, R() * TAU, lean, (R() - 0.5) * 0.012);
    const part = (kind, a, b) => { if (b - a <= 0.01) return; B.add(kind, S().pile(r * (kind === 'pile' ? 1 : 1.012), a, b, { seed, u0, kind: kind === 'pile' ? 'pile' : kind }), m); };
    part('slime', y0, Math.min(y1, lo)); part('barnacle', Math.max(y0, lo), Math.min(y1, hi)); part('pile', Math.max(y0, hi), y1);
  }
  /* a tyre hung as a fender: a fat torus of black rubber, a little worn, on its rope */
  function tyre(g, x, y, z, ry, R) {
    const m = new T.Mesh(new T.TorusGeometry(0.29, 0.1, 10, 22), Mats.lit({ color: new T.Color(0.035, 0.035, 0.035), roughness: 0.92 }));
    m.scale.set(1, 1, 1.25); m.position.set(x, y, z); m.rotation.set(0, ry, (R() - 0.5) * 0.15); m.castShadow = m.receiveShadow = true; g.add(m);
    const rope = Models.tube(new T.CatmullRomCurve3([V(x, y + 0.36, z), V(x, y + 0.6, z), V(x + 0.02, y + 0.95, z)]), 6, 5, () => 0.009);
    const rm = new T.Mesh(rope, Mats.lit({ color: new T.Color(0.32, 0.28, 0.2), roughness: 0.95 })); rm.castShadow = true; g.add(rm);
  }
  /* a life ring on its post, orange with four white bands, a grab line looped round it */
  function lifeRing(g, x, y, z, ry) {
    const ring = new T.Group(); ring.position.set(x, y, z); ring.rotation.y = ry; g.add(ring);
    const orange = Mats.lit({ color: new T.Color(0.75, 0.16, 0.02), roughness: 0.55 }), white = Mats.lit({ color: new T.Color(0.75, 0.74, 0.7), roughness: 0.6 });
    for (let k = 0; k < 8; k++) { const t = new T.Mesh(new T.TorusGeometry(0.3, 0.055, 10, 8, TAU / 8), k % 2 ? white : orange); t.rotation.z = k * TAU / 8; t.castShadow = true; ring.add(t); }
    const line = new T.Mesh(new T.TorusGeometry(0.36, 0.006, 4, 48), Mats.lit({ color: new T.Color(0.6, 0.55, 0.45), roughness: 0.9 })); ring.add(line);
  }

  Models.add('struct/jetty', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 101 + 7), B = K.Builder();
    const L = o.len ?? 36, W = o.width ?? 2.4, deck = o.deck ?? 2.0, span = 3, nB = Math.max(2, Math.round(L / span)), sp = L / nB;
    const head = o.head ?? true, Lh = 4.8, Wh = 6.4, bed = o.bed || (x => mix(0.25, -2.4, clamp(x / (L + Lh))));
    const pT = 0.045, jH = 0.15, hH = 0.2, yJ = deck - pT, yH = yJ - jH, yP = yH - hH;   /* (deck top, joists' top, headstocks' top, piles' top) */
    const tone = () => { const k = 0.82 + 0.3 * R(); return [k, k * (0.98 + 0.04 * R()), k * (0.95 + 0.06 * R())]; };
    /* ── the bents: piles, headstocks, bracing ── */
    const bents = []; for (let i = 0; i <= nB; i++) bents.push(i * sp);
    for (const x of bents) {
      const zs = [-W / 2 + 0.12, W / 2 - 0.12];
      for (const z of zs) pileBands(B, x + (R() - 0.5) * 0.04, z, 0.13 + 0.015 * R(), bed(x) - 1.2, yP + 0.02, R);
      K.boardAB(B, 'timber', V(x, yP + hH / 2, -W / 2 - 0.15), V(x, yP + hH / 2, W / 2 + 0.15), hH, 0.16, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      /* (an X of bracing on the bent's face, bolted to the piles, where it is deep enough) */
      const yb = Math.max(bed(x) + 0.25, -0.2), yt = yP - 0.25;
      if (yt - yb > 0.9) { for (const [z0, z1] of [[zs[0], zs[1]], [zs[1], zs[0]]]) K.boardAB(B, 'timber', V(x + 0.17, yt, z0), V(x + 0.17, yb, z1), 0.05, 0.18, { tone: tone(), u0: R() * 4, v0: R() * 4, up: V(1, 0, 0) }); }
    }
    /* (and along the jetty, every third span, a diagonal brace between bents, each side) */
    for (let i = 0; i + 1 <= nB; i += 3) for (const z of [-W / 2 - 0.01, W / 2 + 0.01]) {
      const x0 = bents[i], x1 = bents[i + 1], yb = Math.max(Math.min(bed(x0), bed(x1)) + 0.4, -0.1);
      if (yP - 0.3 - yb > 0.8) K.boardAB(B, 'timber', V(x0, yP - 0.3, z), V(x1, yb, z), 0.18, 0.05, { tone: tone(), u0: R() * 4, v0: R() * 4 });
    }
    /* ── the stringers: five lines, in lengths of two spans, their joints staggered ── */
    const nJ = 5, joistZ = []; for (let k = 0; k < nJ; k++) joistZ.push(-W / 2 + 0.15 + (W - 0.3) * k / (nJ - 1));
    const xEnd = head ? L + Lh : L;
    joistZ.forEach((z, k) => { for (let x = -(k % 2) * sp; x < L; x += 2 * sp) { const a = Math.max(0, x), b = Math.min(L + (head ? 0.3 : 0), x + 2 * sp); if (b - a > 0.3) K.boardAB(B, 'timber', V(a, yH + jH / 2, z), V(b, yH + jH / 2, z), jH, 0.075, { tone: tone(), u0: R() * 4, v0: R() * 4 }); } });
    /* ── the deck: boards across, a centimetre and a half apart, each its own tone, the odd one new ── */
    const plankW = 0.19, gap = 0.014;
    for (let x = 0.02; x + plankW < L; x += plankW + gap) {
      const kind = R() < 0.04 ? 'timberNew' : 'timber', L2 = W + 0.06 + (R() - 0.5) * 0.03, zc = (R() - 0.5) * 0.02, ang = (R() - 0.5) * 0.006;
      K.boardAB(B, kind, V(x + plankW / 2 - Math.sin(ang) * L2 / 2, yJ + pT / 2, zc - L2 / 2), V(x + plankW / 2 + Math.sin(ang) * L2 / 2, yJ + pT / 2 + (R() - 0.5) * 0.004, zc + L2 / 2), pT, plankW, { tone: tone(), u0: R() * 4, v0: R() * 4, roll: 0 });
    }
    /* (kerbs along both edges, on the boards) */
    for (const z of [-W / 2 + 0.05, W / 2 - 0.05]) for (let x = 0; x < L - 0.1; x += 6) K.boardAB(B, 'timber', V(x, deck + 0.05, z), V(Math.min(L, x + 6), deck + 0.05, z), 0.1, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
    /* ── the railing: a post at every bent and halfway between, outside the stringers; a mid rail and a handrail ── */
    const rail = (x0, x1, z, side) => {
      for (let x = x0; x <= x1 + 1e-6; x += sp / 2) K.boardAB(B, 'timber', V(x, yH - 0.25, z + side * 0.06), V(x, deck + 1.02, z + side * 0.06), 0.1, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      for (let x = x0; x < x1 - 0.05; x += 6) { const b = Math.min(x1, x + 6);
        K.boardAB(B, 'timber', V(x, deck + 1.05, z + side * 0.06), V(b, deck + 1.05, z + side * 0.06), 0.05, 0.15, { tone: tone(), u0: R() * 4, v0: R() * 4 });
        K.boardAB(B, 'timber', V(x, deck + 0.52, z + side * 0.12), V(b, deck + 0.52, z + side * 0.12), 0.1, 0.04, { tone: tone(), u0: R() * 4, v0: R() * 4 }); }
    };
    rail(0, L, -W / 2, -1); rail(0, L, W / 2, 1);

    /* ── the head ── */
    if (head) {
      const x0 = L, x1 = L + Lh, zh = Wh / 2, hx = [x0, x0 + Lh / 2, x1], hz = [-zh + 0.12, 0, zh - 0.12];
      for (const x of hx) { for (const z of hz) pileBands(B, x + (R() - 0.5) * 0.04, z + (R() - 0.5) * 0.04, 0.14 + 0.015 * R(), bed(x) - 1.2, yP + 0.02, R);
        K.boardAB(B, 'timber', V(x, yP + hH / 2, -zh - 0.15), V(x, yP + hH / 2, zh + 0.15), hH, 0.16, { tone: tone(), u0: R() * 4, v0: R() * 4 });
        const yb = Math.max(bed(x) + 0.25, -0.2), yt = yP - 0.25; if (yt - yb > 0.9) for (const [za, zb] of [[hz[0], hz[1]], [hz[1], hz[0]], [hz[1], hz[2]], [hz[2], hz[1]]]) K.boardAB(B, 'timber', V(x + 0.17, yt, za), V(x + 0.17, yb, zb), 0.05, 0.18, { tone: tone(), u0: R() * 4, v0: R() * 4, up: V(1, 0, 0) }); }
      for (let k = 0; k < 9; k++) { const z = -zh + 0.15 + (Wh - 0.3) * k / 8; K.boardAB(B, 'timber', V(x0 - 0.3, yH + jH / 2, z), V(x1 + 0.1, yH + jH / 2, z), jH, 0.075, { tone: tone(), u0: R() * 4, v0: R() * 4 }); }
      for (let x = x0 + 0.02; x + plankW < x1 + 0.08; x += plankW + gap) { const kind = R() < 0.05 ? 'timberNew' : 'timber', L2 = Wh + 0.06 + (R() - 0.5) * 0.03;
        K.boardAB(B, kind, V(x + plankW / 2, yJ + pT / 2, -L2 / 2), V(x + plankW / 2, yJ + pT / 2 + (R() - 0.5) * 0.004, L2 / 2), pT, plankW, { tone: tone(), u0: R() * 4, v0: R() * 4 }); }
      /* (its railing round the three sea sides, a gap on the north side for the ladder) */
      const railZ = (z, xa, xb, side) => { for (let x = xa; x <= xb + 1e-6; x += (xb - xa) / Math.max(1, Math.round((xb - xa) / 1.5))) K.boardAB(B, 'timber', V(x, yH - 0.25, z + side * 0.06), V(x, deck + 1.02, z + side * 0.06), 0.1, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
        K.boardAB(B, 'timber', V(xa, deck + 1.05, z + side * 0.06), V(xb, deck + 1.05, z + side * 0.06), 0.05, 0.15, { tone: tone(), u0: R() * 4, v0: R() * 4 }); K.boardAB(B, 'timber', V(xa, deck + 0.52, z + side * 0.12), V(xb, deck + 0.52, z + side * 0.12), 0.1, 0.04, { tone: tone(), u0: R() * 4, v0: R() * 4 }); };
      railZ(-zh, x0, x1, -1); railZ(zh, x0 + 2.0, x1, 1);
      for (let z = -zh; z <= zh + 1e-6; z += Wh / 4) K.boardAB(B, 'timber', V(x1 + 0.06, yH - 0.25, z), V(x1 + 0.06, deck + 1.02, z), 0.1, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      K.boardAB(B, 'timber', V(x1 + 0.06, deck + 1.05, -zh), V(x1 + 0.06, deck + 1.05, zh), 0.05, 0.15, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      K.boardAB(B, 'timber', V(x1 + 0.12, deck + 0.52, -zh), V(x1 + 0.12, deck + 0.52, zh), 0.1, 0.04, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      /* (the shelter: four posts, a beam round their tops, a gable roof of green iron, benches between the posts) */
      const sx0 = x0 + 1.0, sx1 = x1 - 0.8, sz = 1.55, eave = deck + 2.25, pitch = 0.42, ov = 0.35;
      for (const x of [sx0, sx1]) for (const z of [-sz, sz]) K.boardAB(B, 'timber', V(x, deck, z), V(x, eave, z), 0.12, 0.12, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      for (const z of [-sz, sz]) K.boardAB(B, 'timber', V(sx0 - 0.1, eave + 0.08, z), V(sx1 + 0.1, eave + 0.08, z), 0.16, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      for (const x of [sx0, sx1]) K.boardAB(B, 'timber', V(x, eave + 0.08, -sz - 0.1), V(x, eave + 0.08, sz + 0.1), 0.16, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      /* (the roof's underside line: rafters sitting on the eave beams, running up to the ridge and out past the beams) */
      const tp = Math.tan(pitch), yr = z => eave + 0.22 + (sz - Math.abs(z)) * tp, ridgeY = yr(0);
      /* (rafters, a ridge board, then the sheets on them, their corrugations down the slope) */
      for (let x = sx0; x <= sx1 + 1e-6; x += (sx1 - sx0) / 3) for (const side of [-1, 1]) K.boardAB(B, 'timber', V(x, yr(sz + ov), side * (sz + ov)), V(x, ridgeY, 0), 0.12, 0.05, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      K.boardAB(B, 'timber', V(sx0 - 0.4, ridgeY + 0.02, 0), V(sx1 + 0.4, ridgeY + 0.02, 0), 0.16, 0.04, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      const sheetL = (sz + ov) / Math.cos(pitch) + 0.08, roofW = sx1 - sx0 + 0.8, nS = Math.ceil(roofW / 0.72);
      for (const side of [-1, 1]) for (let k = 0; k < nS; k++) {
        const cx = sx0 - 0.4 + (k + 0.5) * roofW / nS, zc = side * (sz + ov) / 2, sh = K.corrugated(roofW / nS + 0.05, sheetL, { kind: 'zincGreen', u0: R() * 3, v0: R() * 3 });
        const m = new T.Matrix4().makeRotationX(side * pitch); m.premultiply(new T.Matrix4().makeTranslation(cx, yr(zc) + 0.075 + 0.003 * k, zc));
        B.add('zincGreen', sh, m, { metal: 0.35 });
      }
      /* (the ridge cap: a bent strip along the top) */
      for (const side of [-1, 1]) { const cap = K.corrugated(roofW, 0.24, { kind: 'zincGreen', pitch: 0.2, depth: 0.004 }), m = new T.Matrix4().makeRotationX(side * pitch * 0.9); m.premultiply(new T.Matrix4().makeTranslation(sx0 - 0.4 + roofW / 2, ridgeY + 0.1, side * 0.1)); B.add('zincGreen', cap, m, { metal: 0.35 }); }
      /* (benches along the two long sides, between the posts: a seat board on brackets) */
      for (const side of [-1, 1]) { const z = side * (sz - 0.2);
        K.boardAB(B, 'timber', V(sx0 + 0.1, deck + 0.45, z), V(sx1 - 0.1, deck + 0.45, z), 0.045, 0.32, { tone: tone(), u0: R() * 4, v0: R() * 4 });
        for (const x of [sx0 + 0.4, (sx0 + sx1) / 2, sx1 - 0.4]) K.boardAB(B, 'timber', V(x, deck, z), V(x, deck + 0.425, z), 0.08, 0.08, { tone: tone(), u0: R() * 4, v0: R() * 4 }); }
      /* (bollards at the corners: thick posts, a cap on each, a rope worn round one) */
      for (const [x, z] of [[x1 - 0.25, -zh + 0.25], [x1 - 0.25, zh - 0.25], [x0 + 0.3, -zh + 0.25]]) {
        B.add('pile', K.pile(0.12, yH, deck + 0.42, { seed: Math.floor(R() * 99) }), K.M(x, 0, z));
        B.add('pile', K.pile(0.155, deck + 0.42, deck + 0.48, { seed: 3 }), K.M(x, 0, z));
      }
      /* (fenders on the seaward face) */
      for (const z of [-1.8, -0.6, 0.6, 1.8]) tyre(g, x1 + 0.32, deck - 0.75 + (R() - 0.5) * 0.1, z, Math.PI / 2, R);
      /* (a timber ladder down the north side, where the railing leaves a gap) */
      { const lz = zh + 0.18, lx = x0 + 1.0, yb = Math.max(bed(lx) + 0.1, -1.6);
        for (const dx of [-0.24, 0.24]) K.boardAB(B, 'timber', V(lx + dx, deck + 0.9, lz), V(lx + dx, yb, lz + 0.12), 0.1, 0.07, { tone: tone(), u0: R() * 4, v0: R() * 4 });
        for (let y = yb + 0.25; y < deck - 0.05; y += 0.3) { const f = (deck + 0.9 - y) / (deck + 0.9 - yb); K.boardAB(B, y < 0.5 ? 'timberNew' : 'timber', V(lx - 0.27, y, lz + 0.12 * f), V(lx + 0.27, y, lz + 0.12 * f), 0.04, 0.09, { tone: tone(), u0: R() * 4, v0: R() * 4 }); } }
      /* (the life ring on its post, by the ladder) */
      K.boardAB(B, 'timber', V(x0 + 2.1, deck, zh - 0.15), V(x0 + 2.1, deck + 1.6, zh - 0.15), 0.1, 0.1, { tone: tone(), u0: R() * 4, v0: R() * 4 });
      lifeRing(g, x0 + 2.1, deck + 1.15, zh - 0.21, 0);
      /* (a solar lamp on a post at the far corner) */
      { const lx = x1 - 0.25, lz = -zh + 0.7, pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 3.2, 10), Mats.lit({ color: new T.Color(0.32, 0.33, 0.33), roughness: 0.5, metalness: 0.6 }));
        pole.position.set(lx, deck + 1.6, lz); pole.castShadow = true; g.add(pole);
        const lamp = new T.Mesh(new T.CylinderGeometry(0.11, 0.08, 0.16, 12), Mats.lit({ color: new T.Color(0.12, 0.12, 0.12), roughness: 0.4, metalness: 0.4 })); lamp.position.set(lx, deck + 3.25, lz); g.add(lamp);
        const glass = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.1, 12), Mats.lit({ color: new T.Color(0.85, 0.85, 0.8), roughness: 0.15, emissive: new T.Color(1, 0.85, 0.6), emissiveIntensity: 0 })); glass.position.set(lx, deck + 3.13, lz); g.add(glass); g.userData.lamp = glass;
        const panel = new T.Mesh(new T.BoxGeometry(0.42, 0.025, 0.3), [Mats.lit({ color: new T.Color(0.3, 0.3, 0.3), metalness: 0.5, roughness: 0.4 }), Mats.lit({ color: new T.Color(0.3, 0.3, 0.3) }), Mats.lit({ color: new T.Color(0.02, 0.03, 0.06), roughness: 0.15, metalness: 0.3 }), Mats.lit({ color: new T.Color(0.3, 0.3, 0.3) }), Mats.lit({ color: new T.Color(0.3, 0.3, 0.3) }), Mats.lit({ color: new T.Color(0.3, 0.3, 0.3) })]);
        panel.position.set(lx, deck + 3.4, lz); panel.rotation.z = 0.25; panel.castShadow = true; g.add(panel); }
    }
    /* (at the shore end a step down onto the sand) */
    K.boardAB(B, 'timber', V(-0.35, deck - 0.4, -W / 2), V(-0.35, deck - 0.4, W / 2), 0.05, 0.3, { tone: tone(), u0: R() * 4, v0: R() * 4 });
    B.build(g);
    g.userData.info = { len: xEnd, width: W, deck, headW: head ? Wh : W };
    return g;
  });
})();
