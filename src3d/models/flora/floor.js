/* ─────────────────────────────────────────────────────────────
   models/flora/floor.js — the forest's floor and what hangs in it:
   a seedling waiting in the shade, its newest leaves limp and red;
   a fallen log, sunk in the litter, mossy on top, its broken end
   splintered, bracket fungi in tiers along its sides; a liana,
   rope-thick, climbing its host and swinging in loops from limb to
   limb, or a monkey-ladder (Bauhinia) folded flat in a zig-zag;
   an orchid's clump of pseudobulbs and leathery straps on a limb,
   its roots gripping the bark, a spray of flowers arching out.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (r, a) => a[0] + (a[1] - a[0]) * r(), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const P = () => FloraPlant;

  /* ── a seedling or a sapling (o.H, 0.2-3 m): a thin stem, a little crooked, alternate leaves along its upper part,
     big for its size as a shade plant's are; the newest at its tip limp and flushed red-brown ── */
  Models.add('flora/seedling', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 59 + 1), g = new T.Group(), { arch, assemble, part } = P(), H = o.H || lerp(R, [0.25, 1.6]), tile = FloraKit.bark('canopy').tile, bark = [], blades = [[], [], []];
    const tex = FloraBlade.tex('dicot', { hue: 102 }, 2), young = FloraBlade.tex('dicot', { flush: 0.85 }, 1);
    const stem = arch(V(0, -0.02, 0), R() * TAU, Math.PI / 2 - 0.15 * R(), H, 0.25 * R(), 6, 0.01, R), c = new T.CatmullRomCurve3(stem);
    bark.push(part(FloraKit.tube(c, t => (0.004 + 0.006 * H) * (1 - 0.6 * t), { segs: 8, radial: 5, tile, col: t => [mix(0.7, 0.6, t), mix(0.62, 0.72, t), mix(0.5, 0.45, t)] }), (x, y, z) => [0.3, 0.04 * clamp(y / H), clamp(y / H), H]));
    /* (a sapling's few side shoots) */
    const shoots = [c]; if (H > 1.2) for (let k = 0; k < 2 + Math.floor(R() * 3 + H); k++) { const t = 0.45 + 0.4 * R(), p = c.getPointAt(t), sp = arch(p, R() * TAU, 0.5 + 0.4 * R(), H * 0.3 * (1 - t * 0.5), 0.4, 4, 0, R), sc = new T.CatmullRomCurve3(sp); bark.push(part(FloraKit.tube(sc, tt => 0.004 * (1 - 0.5 * tt), { segs: 4, radial: 4, tile, col: () => [0.62, 0.68, 0.48] }), [R(), 0.06, 0.8, H])); shoots.push(sc); }
    shoots.forEach((sc, si) => {
      const nL = si ? 4 + Math.floor(R() * 4) : 4 + Math.floor(R() * 6) + Math.floor(H * 4);
      for (let k = 0; k < nL; k++) {
        const t = (si ? 0.3 : 0.35) + (si ? 0.7 : 0.65) * (k + 1) / nL, p = sc.getPointAt(Math.min(1, t)), tip = k >= nL - (R() < 0.6 ? 2 : 1), az = k * 2.39996 + R() * 0.4;
        const L = (0.08 + 0.12 * Math.min(1, H) + 0.05 * Math.max(0, H - 1)) * (0.7 + 0.5 * R()) * (tip ? 0.75 : 1), lp = arch(p, az, tip ? -0.6 - 0.4 * R() : 0.15 + 0.25 * R(), L, tip ? 0.2 : 0.8, 5, 0, R), tw = (R() - 0.5) * 0.5;
        blades[tip ? 2 : k % 2].push(FloraBlade.ribbon(lp, { w: () => L * 0.42, fold: () => 0.2, curl: () => -0.06, twist: tt => tw * tt, segs: 5, cols: 5, ao: tt => 0.55 + 0.35 * tt, wind: [R(), 0.04 + 0.03 * H, clamp(p.y / H), H], ph: R() }));
      }
    });
    const live = FloraBlade.material('seedling', tex, [0.2, 22, 1.15]), fl = FloraBlade.material('seedling-flush', young, [0.15, 18, 1.2]);
    return assemble(g, bark, 'canopy', blades, { leaves: [...live.leaves, fl.leaves[0]], depth: [...live.depth, fl.depth[0]] }, { H });
  });

  /* ── a fallen log (o.len 3-12 m, o.r 0.15-0.55 m): along x, sunk a third into the litter; bark on, mossed over its top
     and its upper flanks, darker and damp below; one end broken off in splinters, the other the stump of its root flare
     or a clean old break; bracket fungi in tiers on its sides ── */
  Models.add('flora/log', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 67 + 5), g = new T.Group(), len = o.len || lerp(R, [3, 10]), r0 = o.r || lerp(R, [0.15, 0.5]), tile = FloraKit.bark('meranti').tile, parts = [];
    const bend = (R() - 0.5) * 0.08 * len, ph0 = R() * 6, pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(V((t - 0.5) * len, r0 * (0.62 - 0.08 * t) + 0.02 * Math.sin(t * 5 + ph0), bend * Math.sin(Math.PI * t))); }
    const c = new T.CatmullRomCurve3(pts), rad = t => r0 * (1 - 0.3 * t) * (1 + 0.04 * Math.sin(t * 23));
    /* (the moss: over the top and down the flanks where it is damp, patchy; the underside dark with soil) */
    const mossK = o.moss ?? 0.5 + 0.4 * R();
    parts.push(FloraKit.tube(c, rad, { segs: Math.round(len * 5), radial: 18, tile, col: (t, a, p) => {
      const up = Math.sin(a), n = Models.fbm(p[0] * 1.3, p[1] * 2, p[2] * 1.3, 4), moss = clamp(sm(-0.2, 0.6, up + 0.4 * (n - 0.5)) * mossK * sm(0.35, 0.65, n + 0.2)), soil = sm(-0.3, -0.8, up);
      const k = 0.62 + 0.3 * n; return [mix(mix(k, 0.32, moss), 0.25, soil), mix(mix(k * 0.95, 0.5, moss), 0.2, soil), mix(mix(k * 0.9, 0.18, moss), 0.15, soil)];
    } }));
    /* (the broken end: splinters of pale wood standing out of the break, rotten brown inside) */
    const endP = c.getPointAt(1), endT = c.getTangentAt(1), rE = rad(1), Pp = [], Cc = [], Ii = []; let e1 = V().crossVectors(endT, V(0, 1, 0)).normalize(); const e2 = V().crossVectors(endT, e1);
    const ctr = Pp.length / 3; Pp.push(endP.x - endT.x * 0.02, endP.y, endP.z - endT.z * 0.02); Cc.push(0.22, 0.14, 0.08);
    const nS = 26; for (let k = 0; k <= nS; k++) { const a = k / nS * TAU, out = 0.05 + (k % 2 ? 0.3 : 0.05) * R() * r0 * 4; const q = endP.clone().addScaledVector(e1, Math.cos(a) * rE).addScaledVector(e2, Math.sin(a) * rE).addScaledVector(endT, out); Pp.push(q.x, q.y, q.z); Cc.push(0.55 + 0.15 * R(), 0.44 + 0.1 * R(), 0.3); }
    for (let k = 0; k < nS; k++) Ii.push(ctr, ctr + 1 + k, ctr + 2 + k);
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); bg.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); bg.setIndex(Ii); bg.computeVertexNormals();
    /* (the other end: an old break, flat and grey-brown, its growth rings showing) */
    const sP = c.getPointAt(0), sT = c.getTangentAt(0).negate(), rS = rad(0), cap = new T.CircleGeometry(rS * 0.98, 24); { const Pq = cap.attributes.position; for (let i = 1; i < Pq.count; i++) { const k2 = 1 - 0.05 * R(); Pq.setX(i, Pq.getX(i) * k2); Pq.setY(i, Pq.getY(i) * k2); } } cap.lookAt(sT); cap.translate(sP.x, sP.y, sP.z);
    { const cc = new Float32Array(cap.attributes.position.count * 3), Pc = cap.attributes.position; for (let i = 0; i < Pc.count; i++) { const d = Math.hypot(Pc.getX(i) - sP.x, Pc.getY(i) - sP.y, Pc.getZ(i) - sP.z) / rS, rg = 0.85 + 0.15 * Math.sin(d * 40); cc.set([0.36 * rg, 0.28 * rg, 0.2 * rg], i * 3); } cap.setAttribute('color', new T.BufferAttribute(cc, 3)); }
    const barkMesh = new T.Mesh(FloraKit.mergeParts(parts), FloraKit.barkMat('meranti', { tint: [0.72, 0.66, 0.6] })); barkMesh.castShadow = barkMesh.receiveShadow = true; g.add(barkMesh);
    const wood = Models.lit('#ffffff', { vertexColors: true, roughness: 0.95, side: T.DoubleSide });
    for (const gg of [bg, cap]) { const m = new T.Mesh(gg, wood); m.castShadow = m.receiveShadow = true; g.add(m); }
    /* (bracket fungi: half-discs, tier on tier, cream and tan in zones toward their rims) */
    const fung = [], nC = Math.floor(R() * 4 * (o.fungi ?? 1));
    for (let cI = 0; cI < nC; cI++) { const t = 0.15 + 0.7 * R(), side = R() < 0.5 ? -1 : 1, a = side * (0.2 + 0.4 * R()), p0 = c.getPointAt(t), tg = c.getTangentAt(t), nE1 = V().crossVectors(tg, V(0, 1, 0)).normalize(), rT = rad(t);
      for (let k = 0; k < 3 + Math.floor(R() * 5); k++) { const rr = 0.03 + 0.06 * R(), off = (R() - 0.5) * 0.3, hh = (R() - 0.3) * rT * 0.6, base = p0.clone().addScaledVector(tg, off).addScaledVector(nE1, side * rT * 0.98).add(V(0, hh, 0));
        const sh = new T.SphereGeometry(rr, 16, 6, 0, Math.PI, 0, Math.PI / 2); sh.scale(1, 0.22, 1); { const Pq = sh.attributes.position, sd2 = R() * 9; for (let i = 0; i < Pq.count; i++) { const x = Pq.getX(i), z = Pq.getZ(i), an = Math.atan2(z, x), k2 = 1 + 0.12 * Math.sin(an * 7 + sd2) + 0.06 * Math.sin(an * 13 + sd2 * 2); Pq.setX(i, x * k2); Pq.setZ(i, z * k2); } } sh.rotateY(side > 0 ? -Math.PI / 2 + Math.atan2(tg.z, tg.x) * 0 : Math.PI / 2); const lk = V(nE1.x * side, 0, nE1.z * side); sh.lookAt(lk); sh.rotateX(0); sh.translate(base.x, base.y, base.z);
        const cc = new Float32Array(sh.attributes.position.count * 3), Ps = sh.attributes.position; for (let i = 0; i < Ps.count; i++) { const d = Math.hypot(Ps.getX(i) - base.x, Ps.getZ(i) - base.z) / rr, z = 0.5 + 0.5 * Math.sin(d * 18); cc.set([mix(0.55, 0.78, z), mix(0.4, 0.68, z), mix(0.25, 0.5, z)], i * 3); } sh.setAttribute('color', new T.BufferAttribute(cc, 3)); fung.push(sh); } }
    if (fung.length) { const fg = FloraKit.mergeParts(fung.map(f => { f.setAttribute('uv', new T.BufferAttribute(new Float32Array(f.attributes.position.count * 2), 2)); return f; })), m = new T.Mesh(fg, Models.lit('#ffffff', { vertexColors: true, roughness: 0.7 })); m.castShadow = true; g.add(m); }
    g.userData.info = { len, r: r0 }; return g;
  });

  /* ── a liana from the forest floor up into a crown: o.base [x, z] beside its host o.host { x, z, r }, o.top [x, y, z]
     a limb up in the crown. It climbs the host's trunk in a slow spiral, then leaves it and swings across to the limb
     in a loop that sags under its weight; rope-thick, twisted (the liana bark); o.flat: a monkey-ladder, a flat band
     folded in a zig-zag ── */
  Models.add('flora/liana', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 73 + 9), g = new T.Group(), host = o.host || { x: 0, z: 0, r: 0.6 }, top = V(...(o.top || [6, 22, 2])), r0 = o.r || lerp(R, [0.03, 0.1]), flat = !!o.flat;
    const pts = [], a0 = Math.atan2((o.base ? o.base[1] : 1) - host.z, (o.base ? o.base[0] : 1) - host.x), climb = top.y * (0.35 + 0.35 * R()), turns = 0.3 + 0.5 * R();
    pts.push(V(host.x + Math.cos(a0) * (host.r + 0.6), -0.05, host.z + Math.sin(a0) * (host.r + 0.6)));
    for (let i = 1; i <= 10; i++) { const t = i / 10, a = a0 + turns * TAU * t, rr = host.r * (1 - 0.25 * t) + r0 + 0.02; pts.push(V(host.x + Math.cos(a) * rr, climb * t, host.z + Math.sin(a) * rr)); }
    /* (the loop across to the limb: a hanging curve, sagging below the straight line) */
    const leave = pts[pts.length - 1], sag = 2 + 4 * R();
    for (let i = 1; i <= 10; i++) { const t = i / 10, p = leave.clone().lerp(top, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
    const c = new T.CatmullRomCurve3(pts), L = c.getLength(), tile = FloraKit.bark('liana').tile;
    let geo;
    if (flat) {
      /* (a monkey-ladder: a band four times as wide as it is thick, its edge waving from side to side every half metre) */
      const n = Math.round(L * 6), fr = c.computeFrenetFrames(n, false), Pp = [], Uu = [], Cc = [], Ii = [];
      for (let i = 0; i <= n; i++) { const t = i / n, p = c.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], wv = Math.sin(t * L * TAU / 0.5) * r0 * 2.2;
        for (let j = 0; j < 8; j++) { const a = j / 8 * TAU, q = p.clone().addScaledVector(N, Math.cos(a) * r0 * 2.2 + wv).addScaledVector(B, Math.sin(a) * r0 * 0.5); Pp.push(q.x, q.y, q.z); Uu.push(j / 8 * 2, t * L / tile[1]); Cc.push(1, 1, 1); } }
      for (let i = 0; i < n; i++) for (let j = 0; j < 8; j++) { const a = i * 8 + j, b = i * 8 + (j + 1) % 8; Ii.push(a, b, a + 8, b, b + 8, a + 8); }
      geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(Uu, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); geo.setIndex(Ii); geo.computeVertexNormals();
    } else geo = FloraKit.tube(c, t => r0 * (1.1 - 0.4 * t) * (1 + 0.08 * Math.sin(t * L * 3)), { segs: Math.round(L * 3), radial: 8, tile });
    const W = new Float32Array(geo.attributes.position.count * 4), Pa = geo.attributes.position; for (let i = 0; i < Pa.count; i++) W.set([0.4, 0.05 * clamp((Pa.getY(i) - climb) / (top.y - climb + 1)), clamp(Pa.getY(i) / top.y), top.y], i * 4);
    geo.setAttribute('aWind', new T.BufferAttribute(W, 4));
    const m = new T.Mesh(geo, FloraLeaf.windBark(FloraKit.barkMat('liana'))); m.castShadow = m.receiveShadow = true; g.add(m);
    g.userData.info = { L }; return g;
  });

  /* ── an orchid on a limb (Dendrobium, Coelogyne): a clump of pseudobulbs, each with two or three thick strap leaves,
     its pale roots gripping the bark round it; a spray of flowers arching out on a long stem (white with a yellow lip,
     or purple) ── */
  Models.add('flora/orchid', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 79 + 3), g = new T.Group(), { arch, assemble, part } = P(), tile = FloraKit.bark('canopy').tile, bark = [], blades = [[], []];
    const tex = FloraBlade.tex('strap', { hue: 100, sat: 0.4, light: 0.28, brown: 0.2 }, 2), nB = 4 + Math.floor(R() * 7);
    for (let i = 0; i < nB; i++) {
      const a = R() * TAU, rr = 0.03 + 0.06 * R(), base = V(Math.cos(a) * rr, 0, Math.sin(a) * rr), hb = 0.04 + 0.06 * R();
      /* (a pseudobulb: a swollen, ridged green stem) */
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([base, base.clone().add(V(0.004, hb * 0.5, 0)), base.clone().add(V(0.006, hb, 0.002))]), t => 0.009 * Math.sin(Math.PI * Math.min(1, 0.2 + t * 0.9)) + 0.003, { segs: 5, radial: 7, tile, col: () => [0.62, 0.72, 0.4] }), [R(), 0.01, 0.9, 1]));
      for (let k = 0; k < 2 + Math.floor(R() * 2); k++) { const L = 0.1 + 0.12 * R(), lp = arch(base.clone().add(V(0, hb, 0)), a + (R() - 0.5) * 1.5, 0.6 + 0.6 * R(), L, 0.9, 5, 0, R); blades[k % 2].push(FloraBlade.ribbon(lp, { w: () => L * 0.16, fold: () => 0.35, segs: 5, cols: 3, ao: t => 0.5 + 0.5 * t, wind: [R(), 0.02, 0.9, 1], ph: R() })); }
    }
    /* (roots: pale, gripping, running out over the bark) */
    for (let i = 0; i < 8 + Math.floor(R() * 8); i++) { const a = R() * TAU, L = 0.08 + 0.15 * R(), p0 = V(Math.cos(a) * 0.04, 0.005, Math.sin(a) * 0.04), pts = [p0, p0.clone().add(V(Math.cos(a) * L * 0.5, -0.004, Math.sin(a) * L * 0.5)), p0.clone().add(V(Math.cos(a + 0.3) * L, -0.008, Math.sin(a + 0.3) * L))]; bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts), () => 0.0022, { segs: 4, radial: 4, tile, col: () => [1.3, 1.3, 1.25] }), [0, 0, 0, 1])); }
    assemble(g, bark, 'canopy', blades, FloraBlade.material('orchid-leaf', tex, [0.32, 26, 0.8]), { H: 0.3 });
    /* (the flower spray: on an arching stem, each flower five pointed petals, cupped, and a broader lip, frilled) */
    if (o.flowers ?? R() < 0.7) {
      const col = R() < 0.5 ? ['#f4f0e6', '#e8c040'] : ['#c070b8', '#7a2a6a'], sp = arch(V(0.02, 0.05, 0), R() * TAU, 0.9, 0.3 + 0.2 * R(), 1.4, 8, 0, R), c = new T.CatmullRomCurve3(sp);
      g.add(new T.Mesh(FloraKit.tube(c, () => 0.0018, { segs: 10, radial: 4, tile, col: () => [0.5, 0.55, 0.35] }), Models.lit('#ffffff', { vertexColors: true })));
      const petal = (L, W, cup, frill) => { const P2 = [], I2 = []; for (let i = 0; i <= 5; i++) { const u = i / 5, w = W * Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.88)) * (1 + (frill ? 0.12 * Math.sin(u * 30) : 0)); for (const sd of [-1, 0, 1]) P2.push(u * L, sd * w, (Math.abs(sd) * 0.5 + u * u) * cup * L); }
        for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { const a2 = i * 3 + j; I2.push(a2, a2 + 3, a2 + 1, a2 + 1, a2 + 3, a2 + 4); } const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(P2, 3)); gg.setIndex(I2); gg.computeVertexNormals(); return gg; };
      const pm = Models.lit(col[0], { roughness: 0.5, side: T.DoubleSide }), lm = Models.lit(col[1], { roughness: 0.45, side: T.DoubleSide }), pg = petal(0.022, 0.006, 0.25, false), lg = petal(0.018, 0.009, 0.5, true);
      for (let k = 0, n = 5 + Math.floor(R() * 8); k < n; k++) { const t = 0.35 + 0.65 * k / n, p = c.getPointAt(Math.min(1, t)), fl = new T.Group();
        for (let q = 0; q < 5; q++) { const m = new T.Mesh(pg, pm); m.rotation.z = q / 5 * TAU + 0.3; m.rotation.y = -0.2; fl.add(m); }
        const lp = new T.Mesh(lg, lm); lp.rotation.z = -Math.PI / 2; lp.position.z = 0.003; fl.add(lp);
        fl.position.copy(p); fl.lookAt(p.clone().add(V(R() - 0.5, -0.3, R() - 0.5))); g.add(fl); }
    }
    return g;
  });
})();
