/* ─────────────────────────────────────────────────────────────
   models/flora/grow.js — growing a rainforest tree.
   FloraGrow.tree(species, seed, { lod }) grows one: its trunk up
   from below the ground, plank buttresses round its foot running
   on into roots, a clear bole, and then its crown as a crown of the
   species is built. A dipterocarp's crown is a cauliflower: a few
   great limbs leave the top of the bole and climb out, each to a
   sub-crown of its own, a rounded floret of leaf clumps with dark
   gaps between it and the next; branches inside each floret carry
   the clumps; each clump is a cloud of leaf sprays (leaves.js).
   Everything is drawn from its seed, so a tree comes out the same
   every time. Returns the bark (one geometry, wind-weighted), the
   leaves (three geometries, one for each of the species' cards)
   and what the world needs to know of it (height, crown, girth).
   ───────────────────────────────────────────────────────────── */
const FloraGrow = (() => {
  const T = THREE, TAU = Math.PI * 2, K = () => FloraKit;
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const lerp = (r, a) => a[0] + (a[1] - a[0]) * r();
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  /* ── the species. H: its height (m); bole: the share of it clear of branches; dbh: its girth (diameter above the
     buttresses) for its height; butts: how many buttresses, how high, how far out, how thick; crown: how wide (R, as a
     share of the height) and how deep, its florets (how many, how big), the clumps in each (how many, how big), how
     many great limbs; leaf and bark: which ── */
  const SPECIES = {
    /* a meranti (Shorea), an emergent: 45-62 m, the bole clear for more than half of it, big plank buttresses up to 4 m
       high; a broad, shallowly domed crown of five to nine florets */
    emergent: { H: [46, 60], bole: [0.5, 0.58], dbh: H => 0.034 * H, taper: 0.72, butts: { n: [5, 8], h: [2.6, 4.2], reach: [2.0, 4.4], t0: [0.28, 0.42] },
      crown: { R: [0.28, 0.33], D: [0.22, 0.27], dome: 0.62, fR: [4.0, 5.4], clumps: [6, 8], cR: [1.3, 1.8], limbs: [4, 6], spread: 1.0 },
      leaf: 'diptL', bark: 'meranti', moss: 0.55, cards: 1.0 },
    /* tualang (Koompassia excelsa): the tallest, 60-80 m, a smooth pale columnar bole, thin flaring buttresses; a wide
       open umbrella of many small sub-crowns on long pale limbs, feathery */
    tualang: { H: [62, 76], bole: [0.48, 0.54], dbh: H => 0.028 * H, taper: 0.7, butts: { n: [5, 7], h: [3.0, 5.0], reach: [2.4, 4.8], t0: [0.16, 0.26] },
      crown: { R: [0.27, 0.32], D: [0.18, 0.22], dome: 0.45, fR: [3.4, 4.6], clumps: [5, 7], cR: [1.1, 1.5], limbs: [5, 7], spread: 1.0 },
      leaf: 'koompL', bark: 'tualang', moss: 0.3, cards: 1.0 },
    /* a canopy tree, 24-36 m: a shorter bole, small buttresses, a deeper, rounder crown */
    canopy: { H: [24, 34], bole: [0.45, 0.55], dbh: H => 0.024 * H, taper: 0.6, butts: { n: [3, 5], h: [0.8, 1.6], reach: [0.6, 1.4], t0: [0.14, 0.22] },
      crown: { R: [0.2, 0.26], D: [0.3, 0.38], dome: 0.8, fR: [2.6, 3.6], clumps: [6, 8], cR: [1.0, 1.4], limbs: [3, 4], spread: 1.0 },
      leaf: 'laurelL', bark: 'canopy', moss: 0.6, cards: 1.0 },
    /* ── the fruit trees: short boles, low limbs, deep round crowns ── */
    /* a mango, 11-18 m: a stout short trunk, rough and dark; a dense, deep dome of dark leaves to near the ground */
    mango: { H: [11, 17], bole: [0.18, 0.26], dbh: H => 0.045 * H, taper: 0.62, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.44, 0.52], D: [0.58, 0.68], dome: 0.95, fR: [1.9, 2.5], clumps: [6, 8], cR: [0.75, 1.0], limbs: [3, 5], spread: 1.0 },
      leaf: 'mangoL', bark: 'meranti', barkTint: [0.5, 0.47, 0.45], moss: 0.35, cards: 1.75 },
    /* a rambutan, 10-16 m: smooth grey-brown bark, a spreading dome */
    rambutan: { H: [10, 15], bole: [0.22, 0.3], dbh: H => 0.035 * H, taper: 0.62, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.42, 0.5], D: [0.52, 0.62], dome: 0.9, fR: [1.8, 2.4], clumps: [6, 8], cR: [0.7, 0.95], limbs: [3, 5], spread: 1.0 },
      leaf: 'rambL', bark: 'canopy', moss: 0.4, cards: 1.3 },
    /* a durian, 25-40 m: a tall straight trunk, small buttresses, an open, irregular crown on long limbs */
    durian: { H: [25, 36], bole: [0.42, 0.52], dbh: H => 0.026 * H, taper: 0.62, butts: { n: [2, 4], h: [0.6, 1.3], reach: [0.5, 1.2], t0: [0.12, 0.2] },
      crown: { R: [0.24, 0.3], D: [0.38, 0.48], dome: 0.85, fR: [2.4, 3.2], clumps: [6, 8], cR: [0.9, 1.25], limbs: [4, 6], spread: 1.0 },
      leaf: 'durianL', bark: 'meranti', barkTint: [0.66, 0.55, 0.48], moss: 0.5, cards: 1.25 },
    /* a cempedak, 12-20 m: grey bark, a dense crown; its fruit straight off the trunk and the big limbs */
    cempedak: { H: [12, 18], bole: [0.28, 0.38], dbh: H => 0.035 * H, taper: 0.62, butts: { n: [0, 0], h: [0.5, 0.9], reach: [0.4, 0.8], t0: [0.1, 0.16] },
      crown: { R: [0.36, 0.42], D: [0.48, 0.58], dome: 0.9, fR: [2.0, 2.6], clumps: [6, 8], cR: [0.8, 1.05], limbs: [3, 5], spread: 1.0 },
      leaf: 'cempL', bark: 'fig', barkTint: [0.62, 0.57, 0.52], moss: 0.4, cards: 1.25 } };

  /* a direction at angle `el` off the axis t, turned `az` round it */
  function aside(t, az, el) {
    const ref = Math.abs(t.y) < 0.95 ? V(0, 1, 0) : V(1, 0, 0), u = V().crossVectors(t, ref).normalize(), w = V().crossVectors(t, u);
    return t.clone().multiplyScalar(Math.cos(el)).addScaledVector(u, Math.sin(el) * Math.cos(az)).addScaledVector(w, Math.sin(el) * Math.sin(az)).normalize();
  }
  /* a branch from a to b, bowing out (bow: how far, as a share of its length, along `out`) and wandering a little */
  function limbCurve(a, b, bow, out, R, wobK = 0.04) {
    const d = b.clone().sub(a), L = d.length(), pts = [a.clone()];
    for (let i = 1; i < 5; i++) { const t = i / 5, p = a.clone().addScaledVector(d, t).addScaledVector(out, bow * L * Math.sin(Math.PI * t)); p.x += (R() - 0.5) * wobK * L; p.y += (R() - 0.5) * wobK * L * 0.6; p.z += (R() - 0.5) * wobK * L; pts.push(p); }
    pts.push(b.clone()); return new T.CatmullRomCurve3(pts);
  }

  function tree(kind, seed, o = {}) {
    const S = SPECIES[kind], R = Models.rng(seed * 7 + 13), lod = o.lod || 0, Kt = K(), tile = Kt.bark(S.bark).tile;
    const H = lerp(R, S.H), boleH = H * lerp(R, S.bole), r0 = S.dbh(H) / 2, rTop = r0 * S.taper;
    /* (the bark's own parts, each with its wind weights: [phase, sway (m), share of the height] per point) */
    const parts = [], winds = [];
    const addPart = (g, w) => { parts.push(g); const n = g.attributes.position.count, P = g.attributes.position.array, A = new Float32Array(n * 4); for (let i = 0; i < n; i++) { const q = w(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); A[i * 4] = q[0]; A[i * 4 + 1] = q[1]; A[i * 4 + 2] = clamp(P[i * 3 + 1] / H); A[i * 4 + 3] = H; } winds.push(A); };

    /* ── the trunk and its buttresses ── */
    const butts = [], nb = Math.round(lerp(R, S.butts.n));
    for (let i = 0; i < nb; i++) butts.push({ ang: i / nb * TAU + (R() - 0.5) * (TAU / nb) * 0.5, h: lerp(R, S.butts.h), reach: lerp(R, S.butts.reach), t0: lerp(R, S.butts.t0) });
    const lean = [(R() - 0.5) * H * 0.012, (R() - 0.5) * H * 0.012];
    const tr = Kt.trunk({ H: boleH + rTop * 1.2, r0, rTop, lean, butts, seed: seed * 3 + 1, tile, moss: S.moss, flare: 0.16, segV: lod ? 28 : 52, segA: lod ? 40 : 96 });
    addPart(tr.geo, () => [0, 0]);
    for (const b of butts) {
      const B = Kt.buttress(tr, Object.assign({ seed: Math.floor(R() * 1e6), tile, moss: S.moss, segL: lod ? 22 : 40 }, b)); addPart(B.geo, () => [0, 0]);
      if (!lod) for (const g of Kt.roots(B.tip[0] - B.dir[0] * 0.6, B.tip[1] - B.dir[1] * 0.6, B.dir, Math.max(0.1, B.t * 0.62), 1.6 + R() * 2.6, { seed: Math.floor(R() * 1e6), tile })) addPart(g, () => [0, 0]);
    }
    const [tx, tz] = tr.spine(boleH), top = V(tx, boleH, tz);

    /* ── the crown's florets: over a dome above the top of the bole, spread round it, the outer ones lower, so the crown
       is a broad shallow dome of sub-crowns ── */
    const Rc = H * lerp(R, S.crown.R), Dc = H * lerp(R, S.crown.D), florets = [], rfM = (S.crown.fR[0] + S.crown.fR[1]) / 2;
    /* (a cap of a sphere whose rim is the crown's edge and whose top is its top: the florets' middles spread evenly over
       it, as many as it takes to cover it, each floret's own size) */
    const cb = Math.max(2, Rc - rfM * 0.6), ch = Math.max(2, Dc * S.crown.dome), Rd = (cb * cb + ch * ch) / (2 * ch), cy0 = boleH + Dc - rfM * 0.4 - Rd;
    const capA = 2 * Math.PI * Rd * ch, nF = Math.max(3, Math.round(capA / (Math.PI * rfM * rfM * 0.62))), cosMax = 1 - ch / Rd;
    for (let i = 0; i < nF; i++) {
      const rf = lerp(R, S.crown.fR), az = i * 2.39996 + R() * 0.35, ct = 1 - (1 - cosMax) * (i + 0.5 + (R() - 0.5) * 0.6) / nF, st = Math.sqrt(Math.max(0, 1 - ct * ct));
      const c = V(tx + Math.cos(az) * st * Rd * S.crown.spread, cy0 + ct * Rd + (R() - 0.5) * rf * 0.25, tz + Math.sin(az) * st * Rd * S.crown.spread);
      florets.push({ c, r: rf, ph: R() });
    }
    const crownC = V(tx, boleH + Dc * 0.6, tz);
    /* ── the great limbs: each leaves the top of the bole steeply and leans out toward its florets, to a fork; from there a
       branch climbs to each floret, and inside it forks again, three or four ways, each of those carrying a few clumps on
       short twigs: a hierarchy, never a fan of spokes from one point ── */
    const nL = Math.min(nF, Math.round(lerp(R, S.crown.limbs))), limbAz = [];
    for (let i = 0; i < nL; i++) limbAz.push(i / nL * TAU + R() * 0.7);
    const limbOf = f => { const a = Math.atan2(f.c.z - tz, f.c.x - tx); let best = 0, bd = 9; limbAz.forEach((l, i) => { const d = Math.abs(Kt.angD(a, l)); if (d < bd) { bd = d; best = i; } }); return best; };
    const groups = limbAz.map(() => []); florets.forEach(f => groups[limbOf(f)].push(f));
    const rLimb = rTop * 0.95 / Math.sqrt(Math.max(1, nL)) * 1.15, segs = lod ? 6 : 16, radial = r => Math.max(5, Math.min(lod ? 8 : 16, Math.round(r * 70)));
    const barkCol = lvl => (t, a, p) => { const k = 0.92 - 0.1 * lvl + 0.08 * t; return [k, k, k]; };
    const UP = V(0, 1, 0), clumps = [], limbs = [], nCl = () => Math.round(lerp(R, S.crown.clumps));
    groups.forEach((G, li) => {
      if (!G.length) return;
      const gc = V(); for (const f of G) gc.add(f.c); gc.multiplyScalar(1 / G.length);
      const out = V(gc.x - tx, 0, gc.z - tz); const dOut = out.length(); if (dOut < 1e-3) out.set(Math.cos(limbAz[li]), 0, Math.sin(limbAz[li])); out.normalize();
      /* (the limb: steep where it leaves the bole, leaning out as it climbs; it forks some way out and up) */
      const node = top.clone().addScaledVector(out, Math.max(1.5, dOut * 0.42)).addScaledVector(UP, Dc * (0.3 + 0.12 * R()));
      const start = top.clone().addScaledVector(out, rTop * 0.25); start.y -= rTop * 1.6;
      const ph = R(), Lm = start.distanceTo(node);
      const c1 = new T.CatmullRomCurve3([start, start.clone().addScaledVector(UP, Lm * 0.32).addScaledVector(out, Lm * 0.06), start.clone().lerp(node, 0.62).addScaledVector(UP, Lm * 0.08).add(V((R() - 0.5) * 0.4, 0, (R() - 0.5) * 0.4)), node]);
      addPart(Kt.tube(c1, t => rLimb * (1 - 0.28 * t), { segs, radial: radial(rLimb), tile, col: barkCol(0) }), (x, y, z) => [ph, 0.035 * clamp((y - boleH) / Math.max(0.5, node.y - boleH))]);
      limbs.push({ curve: c1, r: t => rLimb * (1 - 0.28 * t), ph });
      const r2b = rLimb * 0.72 / Math.sqrt(G.length) * 1.1;
      for (const f of G) {
        /* (the branch to the floret: rising from the fork, bowing up, ending low in the floret) */
        const fb = f.c.clone().addScaledVector(UP, -f.r * 0.5).lerp(node, 0.12), fph = (ph + 0.1 * R()) % 1;
        const c2 = limbCurve(node, fb, 0.14 + 0.08 * R(), UP, R, 0.05);
        addPart(Kt.tube(c2, t => r2b * (1 - 0.35 * t), { segs: lod ? 5 : 10, radial: radial(r2b), tile, col: barkCol(1) }), () => [fph, 0.07]);
        /* (inside it: three or four branches up and out to sub-centres; the floret's clumps on twigs from the nearest) */
        const nS = 3 + Math.floor(R() * 2), subs = [], r3 = Math.max(0.03, r2b * 0.65 / Math.sqrt(nS) * 1.1);
        const ou = V(f.c.x - tx, 0, f.c.z - tz); if (ou.lengthSq() < 1e-4) ou.set(1, 0, 0); ou.normalize();
        for (let k = 0; k < nS; k++) {
          const d = aside(V(0, 1, 0).addScaledVector(ou, 0.55).normalize(), k / nS * TAU + R() * 0.8, 0.55 + 0.35 * R()), sc = f.c.clone().addScaledVector(d, f.r * 0.45);
          addPart(Kt.tube(limbCurve(fb, sc, 0.12, UP, R, 0.06), t => r3 * (1 - 0.45 * t), { segs: lod ? 3 : 6, radial: radial(r3), tile, col: barkCol(2) }), () => [fph, 0.12]);
          subs.push({ c: sc, d });
        }
        const nC = nCl();
        for (let j = 0; j < nC; j++) {
          /* (each clump on the floret's upper, outer side) */
          const sb = subs[j % nS];
          let d = sb.d.clone().add(V((R() - 0.5) * 1.1, (R() - 0.3) * 0.8, (R() - 0.5) * 1.1)).addScaledVector(ou, 0.3).normalize();
          const cr = lerp(R, S.crown.cR), cc = f.c.clone().addScaledVector(d, Math.max(cr * 0.5, f.r - cr * 0.55)), cph = (fph + 0.12 * R()) % 1;
          const r4 = Math.max(0.016, r3 * 0.5), tip = cc.clone().lerp(sb.c, 0.2);
          if (lod < 1 || j % 2 === 0) addPart(Kt.tube(limbCurve(sb.c, tip, 0.18, d, R, 0.08), t => r4 * (1 - 0.6 * t), { segs: lod ? 3 : 4, radial: lod ? 4 : 6, tile, col: barkCol(3) }), () => [cph, 0.18]);
          clumps.push({ c: cc, r: cr, f, ph: cph, d });
        }
      }
    });
    /* the leader: the trunk runs on a little into the crown's middle, so the bole's top is never an open end */
    { const c0 = new T.CatmullRomCurve3([top.clone().setY(boleH - rTop), top.clone().setY(boleH + rTop * 1.5), top.clone().setY(boleH + rTop * 3)]);
      addPart(Kt.tube(c0, t => rTop * (0.97 - 0.5 * t), { segs: 4, radial: radial(rTop), tile, col: barkCol(0) }), () => [0, 0]); }

    /* ── the leaves: sprays over each floret's outer shell (its upper two thirds), facing out from it, a few deeper in,
       the shell's surface lumpy with the clumps the twigs carry ── */
    const cardS = FloraLeaf.KINDS[S.leaf].card, cards = [];
    for (const f of florets) {
      const myClumps = clumps.filter(c => c.f === f), area = 4 * Math.PI * f.r * f.r * 0.7;
      const n = Math.max(12, Math.round(area / (cardS * cardS) * 1.6 * S.cards * (lod ? 0.42 : 1)));
      for (let k = 0; k < n; k++) {
        let d = V(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); if (d.lengthSq() < 0.01) d.set(0, 1, 0); d.normalize();
        if (d.y < -0.35 && R() < 0.45) d.y = -d.y;
        /* (the shell bulges where a clump is: nearest clump's pull) */
        let bulge = 0; for (const cl of myClumps) { const q = cl.c.clone().sub(f.c).normalize().dot(d); if (q > bulge) bulge = q; }
        const deep = R() < 0.12, rr = f.r * (deep ? 0.35 + 0.35 * R() : 0.72 + 0.22 * bulge * bulge + (R() - 0.5) * 0.18);
        const s = cardS * (0.8 + 0.45 * R()) * (lod ? 1.45 : 1), base = f.c.clone().addScaledVector(d, rr - s * 0.45);
        /* (the card points out from the floret's middle, a little upward, turned on itself at random) */
        const ax = d.clone().add(V(0, 0.3, 0)).normalize(); let side = V().crossVectors(ax, V(0, 1, 0)); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
        side.applyAxisAngle(ax, (R() - 0.5) * 2.4);
        const p = base.clone().addScaledVector(ax, s * 0.5), q = V((p.x - crownC.x) / Rc, (p.y - crownC.y) / (Dc * 0.8 + 3), (p.z - crownC.z) / Rc);
        const aoCrown = clamp((q.length() - 0.25) / 0.8), aoF = clamp((rr / f.r - 0.3) / 0.75) * (0.6 + 0.4 * clamp(d.y * 0.5 + 0.5)), under = sm(-0.9, 0.35, q.y);
        const ao = clamp(0.3 + 0.7 * (0.22 + 0.78 * (0.45 * aoCrown + 0.55 * aoF)) * (0.55 + 0.45 * under));
        const nCrown = q.clone().normalize(), n2 = nCrown.multiplyScalar(0.4).addScaledVector(d, 0.6).normalize();
        cards.push({ p: [base.x, base.y, base.z], ax: [ax.x, ax.y, ax.z], side: [side.x, side.y, side.z], s, ao, n: [n2.x, n2.y, n2.z], ph: R(), wind: [(f.ph + 0.15 * R()) % 1, 0.2 + 0.12 * R(), clamp(base.y / H), H], droop: 0.06 + 0.1 * R(), set: Math.floor(R() * 3) });
      }
    }
    const sets = [[], [], []]; for (const c of cards) sets[c.set].push(c);
    const leafGeo = sets.map(L => FloraLeaf.cardsGeo(L, lod > 0));
    /* the bark, all in one, with its wind weights */
    const bark = Kt.mergeParts(parts), W = new Float32Array(bark.attributes.position.count * 4); let off = 0; for (const A of winds) { W.set(A, off); off += A.length; }
    { const P = bark.attributes.position.array, C = bark.attributes.color.array;
      for (let i = 0; i < P.length; i += 3) { const y = P[i + 1]; if (y < boleH - rTop * 2) continue;
        const q = Math.hypot((P[i] - crownC.x) / Rc, (y - crownC.y) / (Dc * 0.7 + 2), (P[i + 2] - crownC.z) / Rc), k = 0.42 + 0.5 * clamp((q - 0.2) / 0.9);
        const m = sm(boleH - rTop * 2, boleH + 1.5, y); C[i] *= 1 - m * (1 - k); C[i + 1] *= 1 - m * (1 - k); C[i + 2] *= 1 - m * (1 - k); } }
    bark.setAttribute('aWind', new T.BufferAttribute(W, 4));
    return { bark, leaves: leafGeo, info: { H, boleH, r0, crown: { c: crownC, R: Rc, D: Dc }, cards: cards.length, butts: butts.length }, S,
      clumps: clumps.map(c => ({ c: c.c, r: c.r, d: c.d, ph: c.ph })), limbs, trunk: { spine: tr.spine, rAt: tr.rAt, boleH } };
  }

  /* a tree as a model: its bark (wind-moved), its three sets of leaves, their shadows cut out */
  function model(kind, seed, o = {}) {
    const t = tree(kind, seed, o), S = t.S, g = new T.Group();
    const bm = FloraLeaf.windBark(FloraKit.barkMat(S.bark, S.barkTint ? { tint: S.barkTint } : {})), lm = FloraLeaf.material(S.leaf);
    const b = new T.Mesh(t.bark, bm); b.castShadow = b.receiveShadow = true; g.add(b);
    t.leaves.forEach((geo, i) => { if (!geo.attributes.position.count) return; const m = new T.Mesh(geo, lm.leaves[i]); m.customDepthMaterial = lm.depth[i]; m.castShadow = true; m.receiveShadow = false; g.add(m); });
    g.userData.info = t.info; g.userData.grown = t;
    return g;
  }
  return { SPECIES, tree, model };
})();

Models.add('flora/emergent', (o = {}) => FloraGrow.model('emergent', o.seed || 1, o));
Models.add('flora/tualang', (o = {}) => FloraGrow.model('tualang', o.seed || 1, o));
Models.add('flora/canopy', (o = {}) => FloraGrow.model('canopy', o.seed || 1, o));
Models.add('flora/mango-tree', (o = {}) => FloraGrow.model('mango', o.seed || 1, o));
