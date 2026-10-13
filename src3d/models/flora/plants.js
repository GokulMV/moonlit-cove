/* ─────────────────────────────────────────────────────────────
   models/flora/plants.js — the forest's smaller plants, each as
   the species grows: a tree fern's slender trunk under its crown
   of arching lacy fronds, the young ones still uncurling; a ground
   fern's rosette (a lacy one, or a sword fern's narrow fronds); a
   bird's nest fern's funnel of glossy straps round its humus; a
   fan palm's clump of stems, each crowned with pleated fans on
   long stalks; a young rattan's spiny feather leaves; an elephant
   ear's arrowheads hanging from their stalks; a ginger's thicket
   of leafy canes; a pandan's stilt roots, forks and screw-wound
   rosettes of spiny straps, its fruit a ball of keys; a nipa
   palm's fronds rising from the mud round its head of nuts.
   Each stands on the origin; o.seed varies it.
   ───────────────────────────────────────────────────────────── */
const FloraPlant = (() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (r, a) => a[0] + (a[1] - a[0]) * r(), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  /* a blade's arching spine: from p0 out along the heading az, rising at el, drooping more and more under its own weight */
  function arch(p0, az, el, L, droop, n = 8, wob = 0, R = Math.random) {
    const pts = []; let p = p0.clone(), a = el;
    for (let i = 0; i <= n; i++) { pts.push(p.clone()); const t = i / n; a -= droop * (0.4 + 1.2 * t) / n; const d = V(Math.cos(az) * Math.cos(a), Math.sin(a), Math.sin(az) * Math.cos(a)); p.addScaledVector(d, L / n); if (wob) { p.x += (R() - 0.5) * wob; p.z += (R() - 0.5) * wob; } }
    return pts;
  }
  /* a plant's meshes: its woody parts (FloraKit geometry; each part's wind either fixed or a function of the point) in
     one bark mesh, and its blades, one mesh per texture */
  function assemble(g, barkParts, barkKind, blades, mats, info) {
    if (barkParts.length) {
      const geo = FloraKit.mergeParts(barkParts.map(b => b.g)), n = geo.attributes.position.count, W = new Float32Array(n * 4); let o = 0;
      for (const b of barkParts) { const m = b.n, P = b.g.attributes.position; for (let i = 0; i < m; i++) W.set(typeof b.w === 'function' ? b.w(P.getX(i), P.getY(i), P.getZ(i)) : b.w, (o + i) * 4); o += m; }
      geo.setAttribute('aWind', new T.BufferAttribute(W, 4));
      const m = new T.Mesh(geo, FloraLeaf.windBark(FloraKit.barkMat(barkKind))); m.castShadow = m.receiveShadow = true; g.add(m);
    }
    blades.forEach((list, k) => { if (!list.length) return; const m = new T.Mesh(FloraBlade.merge(list), mats.leaves[k % mats.leaves.length]); m.customDepthMaterial = mats.depth[k % mats.depth.length]; m.castShadow = true; g.add(m); });
    g.userData.info = info; return g;
  }
  const part = (g, w) => ({ g, n: g.attributes.position.count, w });
  /* a soft, uneven lump — humus, a clod: a sphere pushed about by noise, never a ball. col(v, n): its colour */
  function lump(rx, ry, rz, seed, col, o = {}) {
    const g = new T.SphereGeometry(1, o.seg ?? 28, o.ring ?? 18), p = g.attributes.position, C = new Float32Array(p.count * 3), v = V();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n = Models.fbm(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed, 4), f = 1 + (o.amp ?? 0.35) * (n - 0.5) * 2 + (o.fine ?? 0.07) * (Models.vn(v.x * 11 + seed, v.y * 11, v.z * 11) - 0.5);
      p.setXYZ(i, v.x * rx * f, v.y * ry * f, v.z * rz * f); C.set(col(v, n), i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); g.computeVertexNormals(); return g;
  }
  /* a fruit of many packed parts — a pandan's keys, a nipa's nuts: an ellipsoid divided into N cells round a Fibonacci
     lattice, each cell domed and creased where it meets the next. col(k, dome, v): the colour of cell k at a point */
  function syncarp(rx, ry, N, seed, col, bulge = 0.2) {
    const g = new T.SphereGeometry(1, 56, 40), p = g.attributes.position, C = new Float32Array(p.count * 3), v = V(), cells = [];
    for (let i = 0; i < N; i++) { const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * 2.39996 + seed; cells.push(V(Math.cos(th) * r, y, Math.sin(th) * r)); }
    const cr = Math.sqrt(4 / N);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize(); let d1 = 9, d2 = 9, k1 = 0;
      for (let k = 0; k < N; k++) { const d = v.distanceTo(cells[k]); if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d; }
      const dome = sm(0, 0.45, (d2 - d1) / cr), f = 1 + bulge * (dome * (1 - 0.4 * (d1 / cr) ** 2)) - bulge * 0.35;
      p.setXYZ(i, v.x * rx * f, v.y * ry * f, v.z * rx * f); C.set(col(k1, dome, v, d1 / cr), i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); g.computeVertexNormals(); return g;
  }
  /* a crozier: a young frond still coiled, hairy with pale scales, rising from the crown on its stalk */
  function crozier(top, az, s, tile, R) {
    const pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16, a = 1.5 - t * 4.2, rr = 0.32 * s * (1 - t * 0.78), up = 0.55 * s * Math.min(1, t * 2.2); pts.push(top.clone().add(V(Math.cos(az) * (0.1 * s + rr * Math.cos(a)), up + rr * Math.sin(a) * 0.7, Math.sin(az) * (0.1 * s + rr * Math.cos(a))))); }
    return FloraKit.tube(new T.CatmullRomCurve3(pts), t => 0.026 * s * (1 - 0.45 * t), { segs: 22, radial: 6, tile, col: () => [0.78, 0.66, 0.5] });
  }

  /* ── a tree fern (Cyathea): 3-7 m; a slender trunk, dark, thickened at its foot by a mat of roots, scarred higher up;
     twelve to twenty fronds 2-3 m long arching out from its top in an umbrella, the youngest standing up and the oldest
     drooping, each a bare spiny stipe and then the lacy blade; one or two croziers uncurling at the top; on some, a
     skirt of dead fronds hanging ── */
  const TF_LEAF = { hue: 96, pinnae: 34, cut: 0.82, lobe: 0.42, stipe: 0.02, widest: 0.42, ang: 1.22, angTip: 0.8, fill: 0.92, fal: 0.12, rw: 6, base: 0.55 };
  Models.add('flora/treefern', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 31 + 7), g = new T.Group(), H = o.H || lerp(R, [3, 7]), r0 = 0.08 + 0.03 * R(), tile = FloraKit.bark('treefern').tile, Ht = H + 1.4;
    const tr = FloraKit.trunk({ H, r0, rTop: r0 * 0.9, lean: [(R() - 0.5) * 0.5, (R() - 0.5) * 0.5], seed: o.seed || 1, tile, moss: 0.55, flare: 1.1, flute: 0.06, segV: 26, segA: 18, below: 0.3, wander: 0.015 });
    const bark = [part(tr.geo, [0, 0, 0, Ht])], [tx, tz] = tr.spine(H), top = V(tx, H + 0.04, tz), share = clamp(H / Ht);
    const tex = FloraBlade.tex('fern', TF_LEAF, 2), dead = FloraBlade.tex('fern', Object.assign({}, TF_LEAF, { dead: true, hue: 34, sat: 0.38, light: 0.25 }), 1);
    const blades = [[], [], []], nF = 12 + Math.floor(R() * 9);
    for (let i = 0; i < nF; i++) {
      const age = (i + 0.5 * R()) / nF, az = i * 2.39996 + R() * 0.3, L = lerp(R, [2.2, 3.3]) * (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, 0.25 + age))), el = 1.3 - 0.95 * age + (R() - 0.5) * 0.12;
      const pts = arch(top.clone(), az, el, L, 0.8 + 1.7 * age, 14, 0.012, R), ph = R(), sw = 0.12 + 0.1 * age, tw = (R() - 0.5) * 0.3, s0 = pts[3];
      /* (its stipe: bare, dark and spiny for the first fifth; it sways from nothing at the trunk to the blade's own sway) */
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts.slice(0, 4)), t => 0.021 * (1 - 0.3 * t), { segs: 6, radial: 6, tile, col: () => [0.62, 0.52, 0.42] }),
        (x, y, z) => [ph, sw * 0.35 * clamp(Math.hypot(x - top.x, y - top.y, z - top.z) / top.distanceTo(s0)), share, Ht]));
      /* (the blade: its pinnae drooping from the rachis, more toward their tips — an umbrella's cloth) */
      const Wf = L * (0.36 + 0.06 * R());
      blades[i % 2].push(FloraBlade.ribbon(pts.slice(3), { w: t => Wf * (t < 0.05 ? 0.5 + 10 * t : 1), fold: () => -0.12 - 0.1 * age, curl: () => -0.22, twist: t => tw * t, segs: 16, cols: 7, ao: t => 0.55 + 0.45 * t, wind: [ph, sw, share, Ht], ph }));
    }
    for (let i = 0; i < 1 + Math.floor(R() * 2); i++) bark.push(part(crozier(top, R() * TAU, 1, tile, R), [R(), 0.03, share, Ht]));
    /* (the skirt: last year's fronds, brown, hanging against the trunk) */
    if (o.skirt ?? R() < 0.35) for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) {
      const az = R() * TAU, pts = arch(top.clone().add(V(0, -0.2, 0)), az, -1.15 - 0.3 * R(), 1.3 + R() * 0.8, -0.25, 7, 0.02, R);
      blades[2].push(FloraBlade.ribbon(pts, { w: () => 0.55, fold: () => -0.55, curl: () => -0.3, segs: 8, cols: 5, ao: () => 0.45, wind: [R(), 0.04, share, Ht], ph: R() }));
    }
    const live = FloraBlade.material('treefern', tex, [0.12, 16, 1.1], [1.2, 1.2, 1.0]), dm = FloraBlade.material('treefern-dead', dead, [0.05, 10, 0.5], [1.1, 1.05, 0.95]);
    return assemble(g, bark, 'treefern', blades, { leaves: [...live.leaves, dm.leaves[0]], depth: [...live.depth, dm.depth[0]] }, { H: Ht, r: r0 });
  });

  /* ── a ground fern: a rosette of fronds from a short rhizome, the young ones upright and the old arching out and down.
     o.kind 'lacy' (a Diplazium's or Tectaria's: broad, the pinnae lobed, half a metre to a metre and a half) or
     'sword' (a Nephrolepis's: narrow, a ladder of close small pinnae, many fronds) ── */
  const GF = {
    lacy: { tex: { hue: 100, pinnae: 18, cut: 0.55, lobe: 0.6, widest: 0.35, ang: 1.25, fill: 0.92, stipe: 0.2, light: 0.3, scales: true, base: 0.7 }, n: [6, 12], s: [0.8, 1.5], w: 0.5 },
    sword: { tex: { hue: 92, pinnae: 38, cut: 0.12, lobe: 1.4, widest: 0.5, ang: 1.45, angTip: 1.1, fill: 0.85, stipe: 0.1, W: 256, light: 0.32 }, n: [12, 24], s: [0.6, 1.2], w: 0.14 } };
  Models.add('flora/groundfern', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 17 + 3), g = new T.Group(), kind = o.kind || (R() < 0.55 ? 'lacy' : 'sword'), K = GF[kind], tex = FloraBlade.tex('fern', K.tex, 2);
    const n = Math.round(lerp(R, K.n)), s = o.size || lerp(R, K.s), blades = [[], []], bark = [], tile = FloraKit.bark('treefern').tile;
    for (let i = 0; i < n; i++) {
      const age = (i + 0.5) / n, az = i * 2.39996 + R() * 0.4, el = 1.45 - 0.8 * age + (R() - 0.5) * 0.15, L = s * (0.65 + 0.35 * Math.sin(Math.PI * Math.min(1, 0.3 + age))) * (0.85 + 0.3 * R());
      const pts = arch(V(Math.cos(az) * 0.03, 0.01, Math.sin(az) * 0.03), az, el, L, 0.9 + 1.0 * age + 0.4 * R(), 10, 0.008, R), ph = R(), tw = (R() - 0.5) * 0.5, wd = K.w * L;
      blades[i % 2].push(FloraBlade.ribbon(pts, { w: t => wd * (t < 0.05 ? 0.5 + 10 * t : 1), fold: () => -0.1, curl: () => -0.12, twist: t => tw * t, segs: 12, cols: 5, ao: t => 0.45 + 0.55 * t, wind: [ph, 0.06 + 0.04 * age, 0.6, s], ph }));
    }
    for (let i = 0; i < Math.floor(R() * 3); i++) bark.push(part(crozier(V(0, 0, 0), R() * TAU, 0.35 * s, tile, R), [R(), 0.02, 0.5, s]));
    return assemble(g, bark, 'treefern', blades, FloraBlade.material('groundfern-' + kind, tex, [0.1, 16, 1.1]), { H: s * 0.7 });
  });

  /* ── a bird's nest fern (Asplenium nidus): twelve to thirty undivided fronds half a metre to well over a metre long
     and a hand broad, bright apple green, in a funnel round a nest of humus and the stubs of old fronds; on the ground
     or (o.epi) in a tree's fork ── */
  Models.add('flora/birdsnest', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 23 + 5), g = new T.Group(), tex = FloraBlade.tex('strap', { hue: 88 }, 2), n = 12 + Math.floor(R() * 17), s = o.size || lerp(R, [0.55, 1.3]), epi = !!o.epi;
    const blades = [[], [], []];
    for (let i = 0; i < n; i++) {
      const age = R(), az = i * 2.39996 + R() * 0.3, el = (epi ? 1.1 : 1.32) - 0.65 * age, L = s * (0.6 + 0.4 * (1 - Math.abs(age - 0.55))) * (0.85 + 0.3 * R());
      const pts = arch(V(Math.cos(az) * 0.05, 0.04, Math.sin(az) * 0.05), az, el, L, 0.35 + 1.25 * age, 10, 0, R), ph = R(), wd = Math.min(0.24, L * (0.15 + 0.04 * R())), tw = (R() - 0.5) * 0.6;
      blades[i % 2].push(FloraBlade.ribbon(pts, { w: () => wd, fold: t => 0.28 * (1 - 0.5 * t), curl: () => 0.06, twist: t => tw * t * t, segs: 12, cols: 5, ao: t => 0.35 + 0.65 * t, wind: [ph, 0.05, 0.7, s], ph }));
    }
    /* (the nest: a mound of dark humus, and round it the broken brown bases of old fronds) */
    const nest = new T.Mesh(lump(0.13 + 0.06 * s, 0.05 + 0.02 * s, 0.13 + 0.06 * s, R() * 10, (v, k) => { const q = 0.5 + 0.8 * k; return [0.075 * q, 0.05 * q, 0.032 * q]; }, { amp: 0.45, fine: 0.16 }), Models.lit('#ffffff', { vertexColors: true, roughness: 0.97 }));
    nest.position.y = 0.025; nest.castShadow = nest.receiveShadow = true; g.add(nest);
    const stub = FloraBlade.tex('strap', { hue: 32, sat: 0.38, light: 0.2, brown: 0 }, 1);
    for (let i = 0, k = 8 + Math.floor(R() * 7); i < k; i++) { const az = R() * TAU, pts = arch(V(Math.cos(az) * 0.08, 0.04, Math.sin(az) * 0.08), az, 0.3 + 0.7 * R(), 0.12 + 0.14 * R(), 0.4, 4, 0, R); blades[2].push(FloraBlade.ribbon(pts, { w: () => 0.07, fold: () => 0.5, segs: 4, cols: 3, ao: () => 0.35, wind: [R(), 0.01, 0.5, s], ph: R() })); }
    const live = FloraBlade.material('birdsnest', tex, [0.36, 28, 0.9], [1.15, 1.2, 0.9]), dm = FloraBlade.material('birdsnest-stub', stub, [0.08, 12, 0.4]);
    return assemble(g, [], null, blades, { leaves: [...live.leaves, dm.leaves[0]], depth: [...live.depth, dm.depth[0]] }, { H: s * 0.8 });
  });

  /* ── a fan palm (Licuala spinosa): a clump of slender stems a few metres high, clothed in old fibrous sheaths, each
     crowned with five to nine leaves on stalks a metre or more long; each leaf a pleated fan a metre across, split to
     its middle into wedge segments, the middle ones longest, held facing out and up ── */
  Models.add('flora/fanpalm', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 41 + 9), g = new T.Group(), tex = FloraBlade.tex('fan', { hue: 98, ribs: 4 }, 2), tile = FloraKit.bark('treefern').tile, bark = [], blades = [[], []];
    const nS = o.stems || 1 + Math.floor(R() * 6), up = V(0, 1, 0); let Hmax = 0;
    for (let s = 0; s < nS; s++) {
      const az0 = R() * TAU, rr = s ? 0.12 + 0.35 * Math.sqrt(R()) : 0, Ht = s ? lerp(R, [0.2, 2.6]) : lerp(R, [1.4, 3.2]), r0 = 0.035 + 0.015 * R(), ox = Math.cos(az0) * rr, oz = Math.sin(az0) * rr;
      const tr = FloraKit.trunk({ H: Ht, r0, rTop: r0 * 0.9, lean: [ox * 0.6, oz * 0.6], seed: (o.seed || 1) * 7 + s, tile, moss: 0.3, flare: 0.25, segV: 12, segA: 10, below: 0.15, wander: 0.03 });
      tr.geo.translate(ox, 0, oz); const Hp = Ht + 1.6; Hmax = Math.max(Hmax, Hp);
      bark.push(part(tr.geo, [R(), 0, 0, Hp]));
      const [tx, tz] = tr.spine(Ht), top = V(tx + ox, Ht, tz + oz), nL = 5 + Math.floor(R() * 5);
      for (let i = 0; i < nL; i++) {
        const age = (i + 0.5) / nL, az = i * 2.39996 + R() * 0.4, el = 1.3 - 0.75 * age + (R() - 0.5) * 0.15, L = lerp(R, [0.9, 1.6]) * (0.8 + 0.2 * Math.sin(Math.PI * age)), ph = R();
        const pts = arch(top.clone(), az, el, L, 0.3 + 0.3 * age, 6, 0, R), end = pts[pts.length - 1], dir = end.clone().sub(pts[pts.length - 2]).normalize(), sw = 0.1 + 0.06 * age;
        bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts), t => 0.011 * (1 - 0.35 * t), { segs: 8, radial: 5, tile, col: () => [0.62, 0.72, 0.45] }), (x, y, z) => [ph, sw * 0.35 * clamp(Math.hypot(x - top.x, y - top.y, z - top.z) / L), clamp(Ht / Hp), Hp]));
        /* (the fan, its face out and up; e2 the way out from the stalk across the fan, the gap at its foot opposite) */
        const D = lerp(R, [0.42, 0.6]), nSeg = 8 + Math.floor(R() * 7), face = dir.clone().multiplyScalar(0.95 + 0.5 * R()).add(up).normalize();
        let e2 = dir.clone().addScaledVector(face, -dir.dot(face)); if (e2.lengthSq() < 1e-4) e2.set(Math.cos(az), 0, Math.sin(az)); e2.normalize(); const e1 = V().crossVectors(face, e2).normalize();
        const span = 5.6, ws = []; let tot = 0; for (let k = 0; k < nSeg; k++) { const w = 0.7 + 0.6 * R(); ws.push(w); tot += w; }
        let acc = -span / 2;
        for (let k = 0; k < nSeg; k++) {
          const da = ws[k] / tot * span, a = acc + da / 2; acc += da;
          const sd = V().addScaledVector(e2, Math.cos(a)).addScaledVector(e1, Math.sin(a)).normalize(), Dk = D * (0.72 + 0.28 * Math.cos(a / 2)) * (0.92 + 0.12 * R());
          const sag = 0.08 + 0.14 * R(), sp = []; for (let q = 0; q <= 6; q++) { const t = q / 6; sp.push(end.clone().addScaledVector(sd, Dk * t).addScaledVector(face, D * 0.14 * t * t).addScaledVector(up, -D * sag * t * t * t)); }
          blades[k % 2].push(FloraBlade.ribbon(sp, { up: face, w: t => 2 * Math.sin(da / 2) * Dk * t * 0.9 + 0.005, fold: () => (k % 2 ? 0.24 : -0.24), segs: 7, cols: 3, ao: t => 0.55 + 0.45 * t, wind: [ph, sw, clamp(Ht / Hp), Hp], ph: R() }));
        }
      }
    }
    return assemble(g, bark, 'treefern', blades, FloraBlade.material('fanpalm', tex, [0.3, 26, 0.9], [1.15, 1.2, 0.95]), { H: Hmax });
  });

  /* ── a rattan (Calamus), young: from a short spiny stem a rosette of feather leaves one to three metres long, their
     leaflets in fanned groups drooping either side of a spiny rachis ── */
  const RAT_LEAF = { hue: 100, leaflets: 26, lw: 0.08, ang: 0.95, angTip: 0.55, bend: 0.12, groups: [1, 3], spines: true, light: 0.27, stipe: 0.1 };
  Models.add('flora/rattan', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 53 + 11), g = new T.Group(), tex = FloraBlade.tex('palm', RAT_LEAF, 2), tile = FloraKit.bark('treefern').tile, blades = [[], []], bark = [], s = o.size || lerp(R, [1.2, 2.6]);
    const Hs = lerp(R, [0.15, 0.8]), st = arch(V(0, -0.05, 0), R() * TAU, 1.35 + 0.15 * R(), Hs + 0.05, 0.05, 4, 0, R), top = st[st.length - 1], Hp = Hs + s * 0.8;
    bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(st), t => 0.03 * (1 - 0.25 * t), { segs: 6, radial: 7, tile, col: () => [0.5, 0.55, 0.38] }), [0, 0, 0, Hp]));
    const nL = 4 + Math.floor(R() * 6);
    for (let i = 0; i < nL; i++) {
      const age = (i + 0.5) / nL, az = i * 2.39996 + R() * 0.4, el = 1.35 - 0.7 * age, L = s * (0.7 + 0.4 * R()), ph = R(), tw = (R() - 0.5) * 0.4;
      const pts = arch(top.clone().add(V(0, -0.1 * age * Hs, 0)), az, el, L, 1.0 + 0.8 * age, 12, 0.01, R);
      blades[i % 2].push(FloraBlade.ribbon(pts, { w: t => L * 0.42 * (t < 0.08 ? 0.4 + 7.5 * t : 1), fold: () => -0.32, curl: () => -0.25, twist: t => tw * t, segs: 14, cols: 7, ao: t => 0.5 + 0.5 * t, wind: [ph, 0.12, 0.7, Hp], ph }));
    }
    return assemble(g, bark, 'treefern', blades, FloraBlade.material('rattan', tex, [0.22, 22, 1.0]), { H: Hp });
  });

  /* ── an elephant ear (Alocasia): from a short stout stem ringed with leaf scars, four to eight stalks a metre long,
     sheathing at their feet, rising and leaning out; from the top of each an arrowhead blade half a metre to a metre
     long hangs out and down, its lobes behind; now and then a new leaf still rolled ── */
  Models.add('flora/aroid', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 61 + 13), g = new T.Group(), tex = FloraBlade.tex('aroid', { hue: 104 }, 2), s = o.size || lerp(R, [0.8, 1.4]), tile = FloraKit.bark('fig').tile, bark = [], blades = [[], []];
    const Hs = lerp(R, [0.08, 0.5]) * s, rs = 0.045 * s, Hp = s * 1.6;
    const stem = FloraKit.trunk({ H: Hs, r0: rs, rTop: rs * 0.9, lean: [(R() - 0.5) * 0.1, (R() - 0.5) * 0.1], seed: (o.seed || 1) * 3 + 1, tile, moss: 0.1, flare: 0.3, segV: 8, segA: 12, below: 0.1, wander: 0.01 });
    bark.push(part(stem.geo, [0, 0, 0, Hp]));
    const [sx, sz] = stem.spine(Hs), top = V(sx, Hs, sz), nL = 4 + Math.floor(R() * 5);
    for (let i = 0; i < nL; i++) {
      const age = (i + 0.5) / nL, az = i * 2.39996 + R() * 0.4, el = 1.32 - 0.45 * age + (R() - 0.5) * 0.12, L = s * (0.7 + 0.45 * R()) * (1 - 0.25 * age * age), ph = R();
      const pts = arch(top.clone(), az, el, L, 0.25 + 0.3 * age, 7, 0, R), end = pts[pts.length - 1], bs = 0.1 * (0.35 + 0.65 * 0.28);
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts), t => (0.028 - 0.014 * t) * s * (t < 0.15 ? 1.4 - 2.6 * t : 1), { segs: 10, radial: 7, tile, col: () => [0.6, 0.72, 0.5] }), (x, y, z) => [ph, bs * clamp((y - Hs) / Math.max(0.05, end.y - Hs)), 0.8, Hp]));
      /* (the blade: its midrib heading out and down from the stalk's top, the tip lowest, the lobes back toward the stem;
         a little arched along the midrib, its halves falling away from it) */
      const bl = s * (0.55 + 0.35 * R()) * (1 - 0.2 * age), beta = 0.55 + 0.5 * R() + 0.3 * age, d = V(Math.cos(az) * Math.cos(beta), -Math.sin(beta), Math.sin(az) * Math.cos(beta)), roll = (R() - 0.5) * 0.4;
      const bpts = []; for (let k = 0; k <= 8; k++) { const t = k / 8, u = (t - 0.28) * bl; bpts.push(end.clone().addScaledVector(d, u).add(V(0, -0.12 * bl * Math.max(0, t - 0.28) ** 2, 0))); }
      blades[i % 2].push(FloraBlade.ribbon(bpts, { up: V(0, 1, 0), w: () => bl * 0.95, fold: () => -0.1, curl: () => -0.12, twist: () => roll, segs: 10, cols: 9, ao: () => 0.75, wind: [ph, 0.1, 0.8, Hp], ph }));
    }
    if (R() < 0.5) { const az = R() * TAU, pts = arch(top.clone(), az, 1.45, s * 0.75, 0.1, 5, 0, R), tip = pts[pts.length - 1];
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts), t => 0.02 * s * (1 - 0.3 * t), { segs: 8, radial: 6, tile, col: () => [0.6, 0.72, 0.5] }), [R(), 0.02, 0.8, Hp]));
      const cig = arch(tip, az, 1.35, s * 0.32, 0.25, 5, 0, R); bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(cig), t => 0.03 * s * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9)), { segs: 8, radial: 8, tile, col: () => [0.7, 0.85, 0.5] }), [R(), 0.03, 0.8, Hp])); }
    return assemble(g, bark, 'fig', blades, FloraBlade.material('aroid', tex, [0.38, 30, 0.7], [1.2, 1.25, 1.0]), { H: Hp });
  });

  /* ── a wild ginger (Etlingera, Alpinia): a thicket of ten to thirty leafy canes, 1.5 to 4 m, reddish at the foot,
     leaning out from the clump; up the upper three quarters of each its long leaves in two ranks, held out and arching
     over at their tips ── */
  Models.add('flora/ginger', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 71 + 17), g = new T.Group(), tex = FloraBlade.tex('lance', { hue: 100 }, 2), blades = [[], []], bark = [], tile = FloraKit.bark('fig').tile;
    const nC = o.canes || 16 + Math.floor(R() * 20), cr = lerp(R, [0.35, 0.8]), Hp = 4.2;
    for (let i = 0; i < nC; i++) {
      const az = R() * TAU, rr = Math.sqrt(R()) * cr, base = V(Math.cos(az) * rr, 0, Math.sin(az) * rr), Hc = lerp(R, [1.4, 3.3]) * (1 - 0.3 * rr / cr), lean = 0.08 + 0.3 * (rr / cr) + 0.1 * R(), ph = R();
      const pts = arch(base, az, Math.PI / 2 - lean, Hc, 0.25 + 0.35 * R(), 8, 0, R), c = new T.CatmullRomCurve3(pts);   /* (the cane: its sheaths, the leaves clasping it) */
      bark.push(part(FloraKit.tube(c, t => 0.019 * (1 - 0.45 * t), { segs: 10, radial: 6, tile, col: t => { const k = sm(0.03, 0.16, t); return [mix(0.6, 0.56, k), mix(0.42, 0.7, k), mix(0.34, 0.44, k)]; } }), (x, y, z) => [ph, 0.12 * 0.6 * clamp(y / Hc), clamp(y / Hp), Hp]));
      const nL = 12 + Math.floor(R() * 9), plane = az + Math.PI / 2 + (R() - 0.5) * 0.6, tipP = c.getPointAt(1), tipD = c.getTangentAt(1);
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([tipP.clone().addScaledVector(tipD, -0.06), tipP.clone().addScaledVector(tipD, 0.06), tipP.clone().addScaledVector(tipD, 0.16).add(V(0.015, -0.01, 0))]), t => 0.014 * Math.sin(Math.PI * Math.min(1, 0.35 + t * 0.7)), { segs: 5, radial: 5, tile, col: () => [0.62, 0.82, 0.48] }), [ph, 0.12 * 0.6, clamp(tipP.y / Hp), Hp]));
      for (let k = 0; k < nL; k++) {
        const t = 0.3 + 0.7 * (k + 1) / nL, p = c.getPointAt(Math.min(1, t)), la = plane + (k % 2 ? 0 : Math.PI) + (R() - 0.5) * 0.3, L = lerp(R, [0.5, 0.9]) * (1 - 0.3 * t * t), wd = L * (0.22 + 0.04 * R()), tw = (R() - 0.5) * 0.4;
        const lp = arch(p, la, 0.2 + 0.3 * R() + 0.5 * sm(0.75, 1, t), L, 0.8 + 0.5 * R(), 7, 0, R);
        blades[k % 2].push(FloraBlade.ribbon(lp, { w: () => wd, fold: () => 0.16, curl: () => -0.08, twist: tt => tw * tt, segs: 8, cols: 5, ao: tt => 0.45 + 0.4 * t + 0.15 * tt, wind: [ph, 0.12 + 0.08 * t, clamp(p.y / Hp), Hp], ph: R() }));
      }
    }
    return assemble(g, bark, 'fig', blades, FloraBlade.material('ginger', tex, [0.22, 24, 1.1]), { H: Hp });
  });

  /* ── a pandan (Pandanus tectorius): a grey trunk ringed with leaf scars, propped on stilt roots slanting steeply into
     the sand, forking into a candelabra; at each tip a rosette of forty to seventy long spiny straps wound round it in
     three spiral ranks, the youngest upright, the older drooping, the dead hanging brown beneath; now and then a fruit,
     a ball of wedge-shaped keys, green or ripening orange ── */
  Models.add('flora/pandanus', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 83 + 19), g = new T.Group(), tex = FloraBlade.tex('pandan', { hue: 92 }, 2), dry = FloraBlade.tex('pandan', { hue: 36, sat: 0.35, light: 0.3 }, 1);
    const tile = FloraKit.bark('pandanus').tile, blades = [[], [], []], bark = [], H = o.H || lerp(R, [3.5, 7]), r0 = 0.1 + 0.04 * R(), Hp = H + 1.2;
    const h1 = H * lerp(R, [0.4, 0.6]), tr = FloraKit.trunk({ H: h1, r0, rTop: r0 * 0.88, lean: [(R() - 0.5) * 0.5, (R() - 0.5) * 0.5], seed: o.seed || 1, tile, moss: 0.05, flare: 0.05, flute: 0.02, segV: 18, segA: 16, below: 0.15, wander: 0.01 });
    bark.push(part(tr.geo, [0, 0, 0, Hp]));
    for (let i = 0, nr = 5 + Math.floor(R() * 9); i < nr; i++) {
      const a = i / nr * TAU + R() * 0.6, h0 = 0.3 + R() * Math.min(1.6, h1 * 0.6), [sx, sz] = tr.spine(h0), out = 0.25 + h0 * (0.35 + 0.25 * R()), aerial = R() < 0.15, yE = aerial ? h0 * (0.3 + 0.4 * R()) : -0.12, rr = 0.028 + 0.02 * R();
      const pts = [V(sx + Math.cos(a) * r0 * 0.5, h0, sz + Math.sin(a) * r0 * 0.5), V(sx + Math.cos(a) * (r0 + out * 0.45), mix(h0, yE, 0.42), sz + Math.sin(a) * (r0 + out * 0.45)), V(sx + Math.cos(a) * (r0 + out), yE, sz + Math.sin(a) * (r0 + out))];
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(pts), t => rr * (1.15 - 0.3 * t) * (aerial && t > 0.88 ? 1 + (t - 0.88) * 3 : 1), { segs: 8, radial: 8, tile, col: t => [0.95 - 0.1 * t, 0.9 - 0.12 * t, 0.82 - 0.14 * t] }), [0, 0, 0, Hp]));
    }
    const tips = [];
    const branch = (p0, az, el, L, r, depth) => {
      const pts = arch(p0, az, el, L, -0.25, 6, 0.02, R), c = new T.CatmullRomCurve3(pts), end = pts[pts.length - 1], ph = R();
      bark.push(part(FloraKit.tube(c, t => r * (1 - 0.25 * t), { segs: 8, radial: 10, tile }), (x, y, z) => [ph, 0.03 * depth * clamp(p0.distanceTo(V(x, y, z)) / L), clamp(y / Hp), Hp]));
      if (depth < 3 && L > 0.6 && R() < 0.55) for (const k of [-1, 1]) branch(end, az + k * (0.7 + 0.4 * R()), 0.5 + 0.4 * R(), L * 0.65, r * 0.78, depth + 1);
      else tips.push({ p: end, ph, sw: 0.03 * depth });
    };
    const [tx, tz] = tr.spine(h1), top = V(tx, h1, tz), nb = 1 + Math.floor(R() * 3);
    for (let b = 0; b < nb; b++) branch(top, b / nb * TAU + R(), nb === 1 ? 1.3 : 0.6 + 0.4 * R(), (H - h1) * (0.6 + 0.3 * R()), r0 * 0.8, 1);
    for (const tp of tips) {
      const nl = 40 + Math.floor(R() * 31), share = clamp(tp.p.y / Hp);
      for (let k = 0; k < nl; k++) {
        const age = k / nl, a = k * (TAU / 3 + 0.075) + R() * 0.08, ll = lerp(R, [0.9, 1.6]) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.2 + age * 0.9))), e = 1.4 - 1.7 * age + (R() - 0.5) * 0.15, tw = (R() - 0.5) * 0.5;
        const p0 = tp.p.clone().add(V(0, -0.22 * age, 0)), lp = arch(p0, a, e, ll, 0.8 + 1.4 * age, 9, 0, R);
        blades[k % 2].push(FloraBlade.ribbon(lp, { w: () => 0.07, fold: () => 0.42, twist: t => tw * t, segs: 10, cols: 3, ao: t => 0.45 + 0.55 * (1 - 0.6 * age) * (0.5 + 0.5 * t), wind: [tp.ph, tp.sw + 0.15, share, Hp], ph: R() }));
      }
      for (let k = 0, nd = 2 + Math.floor(R() * 6); k < nd; k++) { const lp = arch(tp.p.clone().add(V(0, -0.3, 0)), R() * TAU, -1.0 - 0.4 * R(), 0.7 + 0.6 * R(), -0.3, 6, 0.02, R); blades[2].push(FloraBlade.ribbon(lp, { w: () => 0.06, fold: () => 0.7, segs: 6, cols: 3, ao: () => 0.5, wind: [tp.ph, tp.sw + 0.08, share, Hp], ph: R() })); }
    }
    if (o.fruit ?? R() < 0.6) {
      const tp = tips[Math.floor(R() * tips.length)], ripe = o.ripe ?? R(), N = 48 + Math.floor(R() * 24), sd = R() * 9;
      const geo = syncarp(0.1, 0.13, N, sd, (k, dome, v, d) => {
        const vk = 0.85 + 0.3 * Models.vn(k * 1.3, sd, 2.1), outer = [mix(0.2, 0.75, ripe), mix(0.3, 0.3, ripe), mix(0.1, 0.06, ripe)], inner = [mix(0.32, 0.62, ripe), mix(0.4, 0.55, ripe), mix(0.16, 0.18, ripe)];
        const c = [0, 1, 2].map(j => mix(inner[j], outer[j], dome) * vk), tipD = sm(0.2, 0.08, d); return c.map(q => mix(q, 0.08, tipD * 0.8));
      }, 0.22);
      const f = new T.Mesh(geo, Models.lit('#ffffff', { vertexColors: true, roughness: 0.6 })), fp = tp.p.clone().add(V(0.05, -0.42, 0.03)); f.position.copy(fp); f.rotation.set(0.15, R() * TAU, 0.1); f.castShadow = true; g.add(f);
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([tp.p.clone().add(V(0, -0.15, 0)), tp.p.clone().add(V(0.04, -0.27, 0.02)), fp.clone().add(V(0, 0.11, 0))]), () => 0.012, { segs: 4, radial: 5, tile }), [0, 0, 0, Hp]));
    }
    const live = FloraBlade.material('pandanus', tex, [0.18, 18, 0.7], [1.2, 1.22, 1.1]), dm = FloraBlade.material('pandanus-dry', dry, [0.06, 10, 0.5]);
    return assemble(g, bark, 'pandanus', blades, { leaves: [...live.leaves, dm.leaves[0]], depth: [...live.depth, dm.depth[0]] }, { H: Hp });
  });

  /* ── a nipa palm (Nypa fruticans): no trunk above the mud, its stem creeping beneath it; five to ten feather fronds
     four to eight metres long rising steeply from it on stout glossy stalks and arching over, their stiff leaflets in a
     V; among their bases, on a short stalk, a head of brown nuts packed into a ball ── */
  const NIPA_LEAF = { hue: 92, leaflets: 50, lw: 0.042, ang: 1.0, angTip: 0.7, rachisHue: 70, stipe: 0.02, bend: 0.05, light: 0.3 };
  Models.add('flora/nipa', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 97 + 23), g = new T.Group(), tex = FloraBlade.tex('palm', NIPA_LEAF, 2), blades = [[], []], bark = [], tile = FloraKit.bark('pandanus').tile, nF = 5 + Math.floor(R() * 6);
    for (let i = 0; i < nF; i++) {
      const age = (i + 0.5) / nF, az = i * 2.39996 + R() * 0.3, el = 1.42 - 0.45 * age + (R() - 0.5) * 0.08, L = lerp(R, [4, 8]) * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, 0.3 + age))), ph = R(), tw = (R() - 0.5) * 0.6;
      const pts = arch(V(Math.cos(az) * 0.15, -0.15, Math.sin(az) * 0.15), az, el, L, 0.55 + 0.6 * age, 14, 0.02, R), sp = pts.slice(0, 4), y3 = sp[3].y;
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3(sp), t => 0.075 * (1 - 0.45 * t), { segs: 6, radial: 9, tile, col: () => [0.62, 0.66, 0.44] }), (x, y, z) => [ph, 0.25 * 0.35 * clamp((y + 0.15) / (y3 + 0.15)), 0.8, L]));
      blades[i % 2].push(FloraBlade.ribbon(pts.slice(3), { w: () => 1.9, fold: () => 0.32, curl: () => -0.1, twist: t => tw * t, segs: 18, cols: 7, ao: t => 0.45 + 0.55 * t, wind: [ph, 0.25, 0.8, L], ph }));
    }
    if (o.fruit ?? R() < 0.7) {
      const sd = R() * 9, geo = syncarp(0.17, 0.16, 34, sd, (k, dome) => { const v = 0.75 + 0.35 * Models.vn(k * 1.7, sd, 3.1), q = (0.45 + 0.55 * dome) * v; return [0.25 * q, 0.16 * q, 0.075 * q]; }, 0.32);
      const f = new T.Mesh(geo, Models.lit('#ffffff', { vertexColors: true, roughness: 0.5 })), fp = V(0.35, 0.62, 0.12); f.position.copy(fp); f.rotation.set(0.3, R() * TAU, 0.2); f.castShadow = true; g.add(f);
      bark.push(part(FloraKit.tube(new T.CatmullRomCurve3([V(0.2, -0.1, 0.06), V(0.3, 0.25, 0.1), fp.clone().add(V(0, -0.14, 0))]), t => 0.03 * (1 - 0.3 * t), { segs: 6, radial: 7, tile, col: () => [0.55, 0.5, 0.36] }), [0, 0, 0, 3]));
    }
    return assemble(g, bark, 'pandanus', blades, FloraBlade.material('nipa', tex, [0.28, 24, 0.9]), { H: 6 });
  });
  return { arch, assemble, part, lump, syncarp, crozier };
})();
