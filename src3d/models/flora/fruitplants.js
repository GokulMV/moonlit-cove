/* ─────────────────────────────────────────────────────────────
   models/flora/fruitplants.js — the fruit plants that are not
   crown trees, each with its flowers and fruit at every stage:
   a papaya, its trunk scarred where old leaves fell, its crown of
   palmate leaves on long hollow stalks, its fruit clustered on the
   trunk beneath them, the oldest lowest, a flower or two above;
   a banana clump, a mother stem and her suckers, the great blades
   torn by the wind, the dead ones hanging, the bunch on its arching
   stalk — hands of fingers curving up, the bare rachis and the
   purple heart at its end; a coconut palm, curving up from its
   swollen foot, its crown of drooping feather fronds, the old ones
   hanging brown, bunches of nuts among their bases, a spadix in
   flower, and nuts lying at its foot, one of them sprouting.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (r, a) => a[0] + (a[1] - a[0]) * r(), mix = (a, b, t) => a + (b - a) * t;
  const P = () => FloraPlant;

  /* ── a papaya (Carica papaya): 2-5 m, a single grey-green trunk thick at its foot and set with crescent leaf scars;
     fifteen to twenty-five leaves at its top on hollow stalks half a metre to a metre long, each a palmate blade of
     seven to nine lobes, the youngest standing up in the middle, the oldest yellowing and hanging; the fruit on the
     trunk in the axils below the leaves, pressed round it, the oldest and ripest lowest; a flower or two above them ── */
  Models.add('fruit/papaya-tree', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 37 + 3), g = new T.Group(), { arch, assemble, part } = P(), H = o.H || lerp(R, [2.6, 4.6]), r0 = 0.09 + 0.03 * R(), tile = FloraKit.bark('papaya').tile, Hp = H + 1;
    const tr = FloraKit.trunk({ H, r0, rTop: r0 * 0.55, lean: [(R() - 0.5) * 0.5, (R() - 0.5) * 0.5], seed: o.seed || 1, tile, moss: 0.05, flare: 0.5, flute: 0.02, segV: 22, segA: 18, below: 0.15, wander: 0.015 });
    const bark = [part(tr.geo, [0, 0, 0, Hp])], [tx, tz] = tr.spine(H), top = V(tx, H, tz), blades = [[], [], []];
    const tex = FloraBlade.tex('papaya', { hue: 96 }, 2), old = FloraBlade.tex('papaya', { hue: 70, yellow: 0.55 }, 1), nL = 20 + Math.floor(R() * 11), share = clamp(H / Hp);
    for (let i = 0; i < nL; i++) {
      const age = (i + 0.5) / nL, az = i * 2.39996 + R() * 0.2, L = lerp(R, [0.55, 0.95]) * (0.65 + 0.35 * Math.sin(Math.PI * Math.min(1, 0.2 + age))), el = 1.25 - 1.15 * age + (R() - 0.5) * 0.12, ph = R(), sw = 0.1 + 0.08 * age;
      const p0 = top.clone().add(V(0, -0.3 * age, 0)), pts = arch(p0, az, el, L, 0.35 + 0.8 * age, 7, 0, R), end = pts[pts.length - 1], dir = end.clone().sub(pts[pts.length - 2]).normalize();
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts), t => 0.012 * (1 - 0.4 * t), { segs: 8, radial: 6, tile, col: () => [0.55 + 0.1 * age, 0.65, 0.42] }), (x, y, z) => [ph, sw * 0.35 * clamp(p0.distanceTo(V(x, y, z)) / L), share, Hp]));
      /* (the blade: lobes radiating from the stalk's end, facing up, drooping toward their tips; the oldest yellow) */
      const D = lerp(R, [0.3, 0.42]) * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, 0.25 + age))), nl = 7 + Math.floor(R() * 3), face = V(0, 1, 0).addScaledVector(dir, 0.3).normalize(), set = age > 0.85 ? 2 : i % 2;
      let e2 = dir.clone().addScaledVector(face, -dir.dot(face)); if (e2.lengthSq() < 1e-4) e2.set(Math.cos(az), 0, Math.sin(az)); e2.normalize(); const e1 = V().crossVectors(face, e2).normalize();
      for (let k = 0; k < nl; k++) {
        const a = (k / (nl - 1) - 0.5) * 5.2, sd = V().addScaledVector(e2, Math.cos(a)).addScaledVector(e1, Math.sin(a)).normalize(), Dk = D * (0.65 + 0.35 * Math.cos(a / 2)), sag = 0.25 + 0.3 * age;
        const sp = []; for (let q = 0; q <= 5; q++) { const t = q / 5; sp.push(end.clone().addScaledVector(sd, Dk * t).addScaledVector(V(0, 1, 0), -Dk * sag * t * t)); }
        blades[set].push(FloraBlade.ribbon(sp, { up: face, w: t => Dk * 0.62 * Math.min(1, 0.25 + t * 3), fold: () => 0.12, curl: () => -0.12, segs: 6, cols: 5, ao: t => 0.55 + 0.45 * t, wind: [ph, sw, share, Hp], ph: R() }));
      }
    }
    /* (the fruit and the flowers, in the axils down the trunk: oldest lowest) */
    const zone = Math.min(1.3, H * 0.4), fruit = [], fallen = [], flw = [];
    for (let i = 0, n = o.n ?? 12 + Math.floor(R() * 10); i < n; i++) {
      const y = H - 0.12 - zone * (i + R() * 0.5) / n, a = i * 2.39996 + R() * 0.5, [sx, sz] = tr.spine(y), r = tr.rAt(y, a), u = 0.2 + 0.8 * clamp(H - y) / zone * (0.9 + 0.2 * R());
      const p = V(sx + Math.cos(a) * (r + 0.004), y, sz + Math.sin(a) * (r + 0.004)), ry = -a, age = clamp((u - 0.2) / 0.8);
      if (age > 0.84) { const rr = 0.3 + 1.2 * R(), aa = R() * TAU; fallen.push({ p: [Math.cos(aa) * rr, 0.07, Math.sin(aa) * rr], ry: R() * TAU, tilt: Math.PI / 2, age: Math.min(1, age + 0.06), seed: R() * 9 }); }
      else fruit.push({ p: p.toArray(), ry, roll: 0.18, age, seed: R() * 9 });
    }
    for (let i = 0; i < 2 + Math.floor(R() * 3); i++) { const y = H - 0.05 - 0.15 * R(), a = R() * TAU, [sx, sz] = tr.spine(y), r = tr.rAt(y, a); flw.push({ p: [sx + Math.cos(a) * r, y, sz + Math.sin(a) * r], ry: -a, age: 0.1 + 0.6 * R(), seed: R() * 9 }); }
    assemble(g, bark, 'papaya', blades, { leaves: [...FloraBlade.material('papaya', tex, [0.22, 22, 1.1]).leaves, FloraBlade.material('papaya-old', old, [0.12, 16, 1.0]).leaves[0]], depth: [...FloraBlade.material('papaya', tex).depth, FloraBlade.material('papaya-old', old).depth[0]] }, { H: Hp });
    if (fruit.length) g.add(FloraFruit.instances('papaya', fruit, { geo: { hang: 0.03, lod: o.fruitLod ?? 1 } }));
    if (fallen.length) g.add(FloraFruit.instances('papaya', fallen, { geo: { lod: o.fruitLod ?? 1 } }));
    if (flw.length) g.add(FloraFruit.bloomInstances('papaya', flw));
    return g;
  });

  /* ── a banana clump (Musa): the mother stem 2.5-4 m, a pseudostem of leaf sheaths, eight to twelve leaves from its top,
     the youngest a rolled cigar, each blade 1.5-2.5 m, torn into strips the older it is, two or three dead hanging; one
     to three suckers round her; her bunch (o.stage 0..1, or none) on its stalk arching out and down: five to nine hands
     of fingers curving up, the bare rachis, the heart ── */
  Models.add('fruit/banana-plant', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 43 + 9), g = new T.Group(), { arch, assemble, part } = P(), tile = FloraKit.bark('banana').tile, bark = [], blades = [[], [], [], []];
    const tex = [0.15, 0.45].map(t => FloraBlade.tex('banana', { torn: t }, 1)[0]), dead = FloraBlade.tex('banana', { torn: 0.9, dry: 1, hue: 40, sat: 0.4, light: 0.28 }, 1)[0], old = FloraBlade.tex('banana', { torn: 0.85, dry: 0.4, yellow: 0.25 }, 1)[0];
    const plant = (x, z, H, r0, nL, mother) => {
      const tr = FloraKit.trunk({ H, r0, rTop: r0 * 0.72, lean: [(R() - 0.5) * 0.25 + x * 0.3, (R() - 0.5) * 0.25 + z * 0.3], seed: Math.floor(R() * 1e5), tile, moss: 0, flare: 0.25, flute: 0.03, segV: 14, segA: 16, below: 0.1, wander: 0.01 });
      tr.geo.translate(x, 0, z); const Hp = H + 2.2, share = clamp(H / Hp); bark.push(part(tr.geo, [R(), 0.01, 0, Hp]));
      const [tx, tz] = tr.spine(H), top = V(tx + x, H, tz + z);
      /* (the cigar: the newest leaf, still rolled, standing up out of the top) */
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([top.clone().add(V(0, -0.1, 0)), top.clone().add(V(0.02, 0.35 * (H / 3), 0)), top.clone().add(V(0.05, 0.7 * (H / 3), 0.02))]), t => 0.03 * (1 - 0.85 * t) * (r0 / 0.12), { segs: 6, radial: 7, tile, col: () => [0.75, 1.0, 0.6] }), [R(), 0.05, share, Hp]));
      for (let i = 0; i < nL; i++) {
        const age = (i + 0.5) / nL, az = i * 2.39996 + R() * 0.3, ph = R(), Lp = (0.3 + 0.35 * R()) * (H / 3), el = 1.3 - 1.25 * age + (R() - 0.5) * 0.1, sw = 0.15 + 0.15 * age;
        const pp = arch(top.clone().add(V(0, -0.15 * age, 0)), az, el + 0.15, Lp, 0.2, 4, 0, R), p0 = pp[pp.length - 1];
        bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pp), t => 0.022 * (1 - 0.35 * t) * (r0 / 0.12), { segs: 4, radial: 6, tile, col: () => [0.75, 0.95, 0.6] }), (px, py, pz) => [ph, sw * 0.3 * clamp(top.distanceTo(V(px, py, pz)) / Lp), share, Hp]));
        const L = lerp(R, [1.5, 2.4]) * (H / 3.2) * (mother ? 1 : 0.8), Wb = L * (mother ? 0.27 : 0.2), bl = arch(p0, az, el, L, 0.7 + 1.2 * age, 12, 0, R), set = age > 0.8 ? 2 : (age > 0.45 ? 1 : 0), tw = (R() - 0.5) * 0.4;
        blades[set].push(FloraBlade.ribbon(bl, { w: t => Wb * (t < 0.05 ? 0.5 + 10 * t : 1), fold: () => -0.12, curl: () => -0.18 - 0.15 * age, twist: t => tw * t, segs: 14, cols: 7, ao: t => 0.5 + 0.5 * t, wind: [ph, sw, share, Hp], ph }));
      }
      /* (the dead: hanging down the pseudostem, dry and brown, folded) */
      for (let i = 0, n = 1 + Math.floor(R() * 3); i < n; i++) { const az = R() * TAU, pp = arch(top.clone().add(V(0, -0.25, 0)), az, -0.9 - 0.4 * R(), H * 0.45, -0.2, 6, 0.02, R); blades[3].push(FloraBlade.ribbon(pp, { w: () => 0.22, fold: () => -0.7, curl: () => -0.2, segs: 6, cols: 5, ao: () => 0.5, wind: [R(), 0.05, share, Hp], ph: R() })); }
      return { tr, top, H };
    };
    const M = plant(0, 0, o.H || lerp(R, [2.6, 3.8]), 0.12 + 0.02 * R(), 8 + Math.floor(R() * 4), true);
    for (let i = 0, n = o.suckers ?? 1 + Math.floor(R() * 3); i < n; i++) { const a = R() * TAU, d = 0.35 + 0.3 * R(); plant(Math.cos(a) * d, Math.sin(a) * d, lerp(R, [0.6, 2.2]), 0.05 + 0.03 * R(), 4 + Math.floor(R() * 4), false); }
    /* (the bunch: its stalk up out of the top, over and down; hands along it, then the bare rachis, then the heart) */
    const stage = o.stage ?? (R() < 0.75 ? R() : -1), parts = {};
    if (stage >= 0) {
      const az = R() * TAU, out = V(Math.cos(az), 0, Math.sin(az)), t0 = M.top.clone().add(V(0, 0.05, 0));
      const stalkPts = [t0, t0.clone().add(V(0, 0.25, 0)).addScaledVector(out, 0.15), t0.clone().add(V(0, 0.15, 0)).addScaledVector(out, 0.45), t0.clone().add(V(0, -0.35, 0)).addScaledVector(out, 0.62), t0.clone().add(V(0, -0.95, 0)).addScaledVector(out, 0.66), t0.clone().add(V(0, -1.45, 0)).addScaledVector(out, 0.6)];
      const c = new T.CatmullRomCurve3(stalkPts), Hp = M.H + 2.2;
      bark.push(part(FloraKit.tube(c, t => 0.05 * (1 - 0.5 * t), { segs: 16, radial: 8, tile, col: t => [0.78, 0.9, 0.6] }), [0.3, 0.04, clamp(M.H / Hp), Hp]));
      const nH = 7 + Math.floor(R() * 4), fingers = [];
      for (let h = 0; h < nH; h++) {
        const t = 0.36 + 0.26 * h / nH, p = c.getPointAt(t), tg = c.getTangentAt(t), n = 16 + Math.floor(R() * 6) - h, ha = h * 2.4;
        /* (a hand: two rows of fingers on a cushion, fanning round one side of the rachis, curving out and up) */
        for (let k = 0; k < n; k++) {
          const row = k % 2, an = ha + (Math.floor(k / 2) / Math.ceil(n / 2) - 0.5) * 2.6 + row * 0.12, d = V(Math.cos(an), 0, Math.sin(an)), dir = d.clone().addScaledVector(tg, -0.3).normalize();
          fingers.push({ p: p.clone().addScaledVector(d, 0.05 + 0.02 * row).add(V(0, -0.025 * row, 0)).toArray(), ry: -Math.atan2(dir.z, dir.x), tilt: 0, roll: 0.35 + 0.25 * row, age: clamp(stage * (0.97 + 0.06 * R())), seed: R() * 9, s: (1 - 0.04 * h) });
        }
      }
      /* (the finger grows along +x and curves up: the roll turns it up to point a little above level, as bananas do) */
      if (stage > 0.04) { const fm = FloraFruit.instances('banana', fingers.map(f => Object.assign(f, { roll: f.roll })), { geo: { lod: o.fruitLod ?? 1 } }); g.add(fm); parts.fruit = fm; }
      const hp = c.getPointAt(1); parts.heart = FloraFruit.bloomInstances('banana', [{ p: hp.toArray(), ry: R() * TAU, age: clamp(0.05 + stage * 0.5), seed: R() * 9, s: 1 - 0.35 * stage }]); g.add(parts.heart);
    }
    assemble(g, bark, 'banana', blades, (() => { const mats = [tex[0], tex[1], old, dead].map((t, i) => FloraBlade.material('banana-' + i, [t], i === 3 ? [0.06, 10, 0.4] : [0.24, 24, 1.15], [1.18, 1.22, 1.0])); return { leaves: mats.map(m => m.leaves[0]), depth: mats.map(m => m.depth[0]) }; })(), { H: M.H + 2 });
    g.userData.fruit = { kind: 'banana', stage, parts };
    return g;
  });

  /* ── a coconut palm (Cocos nucifera): 8-18 m, its trunk swollen at its foot, ringed grey, curving up and leaning; a
     crown of twenty-five to thirty-two feather fronds 4-5.5 m long, their leaflets hanging either side of the rachis,
     the youngest standing up, the oldest drooping yellow and then hanging brown against the trunk; among the frond bases
     bunches of nuts and a spadix in flower; nuts lying at its foot, one sprouting ── */
  const CO_LEAF = { hue: 82, leaflets: 92, lw: 0.034, ang: 1.2, angTip: 0.8, rachisHue: 58, stipe: 0.14, bend: 0.06, light: 0.32, sat: 0.42 };
  Models.add('fruit/coconut-palm', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 47 + 13), g = new T.Group(), { arch, assemble, part } = P(), H = o.H || lerp(R, [8, 15]), tile = FloraKit.bark('coconut').tile, Hp = H + 3;
    const la = R() * TAU, lean = (o.lean ?? (0.1 + 0.25 * R())) * H, tr = FloraKit.trunk({ H, r0: 0.17, rTop: 0.12, lean: [Math.cos(la) * lean, Math.sin(la) * lean], seed: o.seed || 1, tile, moss: 0.05, flare: 0.9, flute: 0.02, segV: 36, segA: 18, below: 0.2, wander: 0.01 });
    const bark = [part(tr.geo, (x, y, z) => [0, 0, clamp(y / Hp), Hp])], [tx, tz] = tr.spine(H), top = V(tx, H, tz), share = clamp(H / Hp), blades = [[], [], []];
    const tex = FloraBlade.tex('palm', CO_LEAF, 2), dry = FloraBlade.tex('palm', Object.assign({}, CO_LEAF, { hue: 36, sat: 0.35, light: 0.3, brown: 0.6 }), 1);
    /* (the crown shaft: the frond bases wrapped round the top in their brown fibre) */
    bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([top.clone().add(V(0, -0.5, 0)), top.clone().add(V(0, 0.1, 0)), top.clone().add(V(0, 0.55, 0))]), t => 0.17 * (1 - 0.4 * t), { segs: 5, radial: 12, tile: FloraKit.bark('treefern').tile, col: () => [0.75, 0.62, 0.45] }), [0, 0.02, share, Hp]));
    const nF = 28 + Math.floor(R() * 8);
    for (let i = 0; i < nF; i++) {
      const age = (i + 0.5) / nF, az = i * 2.39996 + R() * 0.2, L = lerp(R, [4, 5.5]) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, 0.15 + age))), el = 1.25 - 1.3 * age + (R() - 0.5) * 0.12, ph = R(), sw = 0.25 + 0.2 * age, tw = (R() - 0.5) * 0.5;
      const pts = arch(top.clone().add(V(0, 0.45 - 0.5 * age, 0)), az, el, L, 1.0 + 1.5 * age, 14, 0.02, R), y0 = pts[0];
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts.slice(0, 4)), t => 0.05 * (1 - 0.5 * t), { segs: 5, radial: 6, tile, col: () => [0.85, 0.82, 0.62] }), (x, y, z) => [ph, sw * 0.35 * clamp(y0.distanceTo(V(x, y, z)) / (L * 0.2)), share, Hp]));
      blades[age > 0.9 ? 2 : i % 2].push(FloraBlade.ribbon(pts.slice(3), { w: () => L * 0.34, fold: () => -0.62, curl: () => -0.3, twist: t => tw * t, segs: 16, cols: 7, ao: t => 0.5 + 0.5 * t, wind: [ph, sw, share, Hp], ph }));
    }
    /* (the dead fronds hanging against the trunk) */
    for (let i = 0, n = Math.floor(R() * 4); i < n; i++) { const az = R() * TAU, pts = arch(top.clone().add(V(0, -0.3, 0)), az, -1.25, 3 + R(), -0.15, 8, 0.03, R); blades[2].push(FloraBlade.ribbon(pts, { w: () => 0.9, fold: () => -1.1, curl: () => -0.2, segs: 8, cols: 5, ao: () => 0.45, wind: [R(), 0.08, share, Hp], ph: R() })); }
    /* (the bunches: each a short stalk out of a frond's axil, branching, a nut on each branch; the youngest highest) */
    const nuts = [], fallen = [], nB = 3 + Math.floor(R() * 3);
    for (let b = 0; b < nB; b++) {
      const az = b / nB * TAU + R() * 0.8, u = (b + R() * 0.6) / nB, d = V(Math.cos(az), 0, Math.sin(az)), base = top.clone().add(V(0, 0.15 - 0.35 * u, 0)).addScaledVector(d, 0.2), stem = base.clone().addScaledVector(d, 0.35).add(V(0, -0.25, 0));
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([base, base.clone().addScaledVector(d, 0.2).add(V(0, -0.05, 0)), stem]), t => 0.025 * (1 - 0.3 * t), { segs: 5, radial: 6, tile, col: () => [0.9, 0.82, 0.55] }), [R(), 0.03, share, Hp]));
      const nn = 4 + Math.floor(R() * 8), age = clamp(0.1 + 0.85 * u);
      for (let k = 0; k < nn; k++) { const a = az + (k / nn - 0.5) * 2.4, off = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.12 + 0.06 * (k % 2)), p = stem.clone().add(off).add(V(0, -0.05 - 0.08 * (k % 3), 0)), ag = clamp(age * (0.95 + 0.1 * R()));
        if (ag > 0.86) { const rr = 0.8 + 2.5 * R(), aa = R() * TAU; fallen.push({ p: [Math.cos(aa) * rr, 0.1, Math.sin(aa) * rr], ry: R() * TAU, tilt: Math.PI / 2 * 0.9, age: ag, seed: R() * 9 }); }
        else nuts.push({ p: p.toArray(), ry: -a, roll: 0.25 + 0.25 * R(), age: ag, seed: R() * 9 }); }
    }
    for (let k = 0; k < (o.fallen ?? 2 + Math.floor(R() * 3)); k++) { const rr = 0.8 + 3 * R(), aa = R() * TAU; fallen.push({ p: [Math.cos(aa) * rr, 0.1, Math.sin(aa) * rr], ry: R() * TAU, tilt: Math.PI / 2 * 0.92, age: 0.88 + 0.1 * R(), seed: R() * 9 }); }
    assemble(g, bark, 'coconut', blades, { leaves: [...FloraBlade.material('coconut', tex, [0.26, 24, 1.2]).leaves, FloraBlade.material('coconut-dry', dry, [0.06, 10, 0.5]).leaves[0]], depth: [...FloraBlade.material('coconut', tex).depth, FloraBlade.material('coconut-dry', dry).depth[0]] }, { H: Hp });
    if (nuts.length) g.add(FloraFruit.instances('coconut', nuts, { geo: { hang: 0.12, lod: o.fruitLod ?? 1 } }));
    if (fallen.length) g.add(FloraFruit.instances('coconut', fallen, { geo: { lod: o.fruitLod ?? 1 } }));
    { const a = R() * TAU, d = V(Math.cos(a), 0, Math.sin(a)); g.add(FloraFruit.bloomInstances('coconut', [{ p: top.clone().add(V(0, 0.2, 0)).addScaledVector(d, 0.15).toArray(), ry: -a, age: 0.2 + 0.25 * R(), seed: 3 }])); }
    return g;
  });
})();
