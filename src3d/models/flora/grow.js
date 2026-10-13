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
    /* a strangler fig (Ficus): 30-42 m; no trunk of its own but a cage of its roots, braided down round the tree it
       grew on and fused where they cross, flaring into flanges at the foot; aerial roots hanging from its limbs; a huge
       dense crown of thick glossy leaves, figs on its twigs */
    fig: { H: [30, 40], bole: [0.42, 0.5], dbh: H => 0.05 * H, taper: 0.72, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.32, 0.38], D: [0.3, 0.38], dome: 0.75, fR: [3.2, 4.4], clumps: [6, 8], cR: [1.1, 1.5], limbs: [5, 7], spread: 1.0 },
      leaf: 'figL', bark: 'tualang', barkTint: [0.66, 0.65, 0.62], moss: 0.5, cards: 1.25, lattice: { roots: [11, 16], twist: [0.7, 1.3], aerial: [8, 16], host: 0.6 } },
    /* an understory tree, 6-14 m: slender, its crown narrow and thin, its leaves big */
    understory: { H: [6, 13], bole: [0.4, 0.55], dbh: H => 0.02 * H, taper: 0.62, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.24, 0.3], D: [0.38, 0.48], dome: 0.85, fR: [1.3, 1.8], clumps: [4, 6], cR: [0.55, 0.8], limbs: [3, 4], spread: 1.0 },
      leaf: 'under', bark: 'canopy', moss: 0.7, cards: 0.75 },
    /* ── the beach trees ── */
    /* a casuarina (Casuarina equisetifolia), 12-25 m: a straight trunk, rough grey-brown; a narrow, irregular, open crown
       of wispy hanging branchlets, grey-green, like a pine's */
    casuarina: { H: [12, 22], bole: [0.3, 0.42], dbh: H => 0.024 * H, taper: 0.6, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.17, 0.23], D: [0.6, 0.7], dome: 0.98, fR: [1.0, 1.4], clumps: [3, 5], cR: [0.55, 0.8], limbs: [7, 9], spread: 1.0, shape: 'ellipsoid', gaps: 0.15 },
      leaf: 'casuarL', bark: 'meranti', barkTint: [0.55, 0.5, 0.46], moss: 0.1, cards: 1.3 },
    /* a sea almond (Terminalia catappa), 10-18 m: its branches in tiers, level, a pagoda of flat layers of big leaves */
    terminalia: { H: [10, 17], bole: [0.3, 0.4], dbh: H => 0.035 * H, taper: 0.62, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.42, 0.5], D: [0.5, 0.6], dome: 0.6, fR: [1.6, 2.2], clumps: [5, 7], cR: [0.7, 1.0], limbs: [4, 5], spread: 1.0, tiers: [3, 5] },
      leaf: 'terminL', bark: 'canopy', barkTint: [0.62, 0.58, 0.54], moss: 0.3, cards: 1.0 },
    /* a sea poison tree (Barringtonia asiatica), 8-15 m: a short trunk, a dense dark dome of huge leaves */
    barringtonia: { H: [8, 14], bole: [0.25, 0.35], dbh: H => 0.04 * H, taper: 0.62, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.42, 0.5], D: [0.55, 0.65], dome: 0.9, fR: [1.8, 2.4], clumps: [5, 7], cR: [0.8, 1.1], limbs: [3, 5], spread: 1.0 },
      leaf: 'barringL', bark: 'canopy', moss: 0.3, cards: 1.1 },
    /* a sea hibiscus (Hibiscus tiliaceus), 4-8 m: low, sprawling, wider than tall, its limbs leaning out over the sand */
    hibiscus: { H: [4, 7], bole: [0.12, 0.2], dbh: H => 0.04 * H, taper: 0.6, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.6, 0.75], D: [0.55, 0.7], dome: 0.75, fR: [1.2, 1.7], clumps: [4, 6], cR: [0.55, 0.8], limbs: [4, 6], spread: 1.0 },
      leaf: 'hibiscL', bark: 'canopy', barkTint: [0.6, 0.56, 0.5], moss: 0.2, cards: 1.0 },
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
      leaf: 'cempL', bark: 'fig', barkTint: [0.62, 0.57, 0.52], moss: 0.4, cards: 1.25 },
    /* ── the mangroves ── */
    /* a Rhizophora (bakau minyak, R. apiculata), 11-18 m on the creek's edge: a straight dark trunk standing on a cage of
       arching stilt roots that leave it as high as three metres up and come down to the mud a metre or two out, forking
       as they go; more roots let down from the lower limbs, a skirt of them under the leaves; a dense dark crown */
    rhizophora: { H: [11, 18], bole: [0.38, 0.5], dbh: H => 0.022 * H, taper: 0.62, flare: 0, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.3, 0.38], D: [0.42, 0.52], dome: 0.88, fR: [1.5, 2.1], clumps: [5, 7], cR: [0.65, 0.9], limbs: [4, 6], spread: 1.0 },
      leaf: 'rhizoL', bark: 'rhizophora', moss: 0.04, cards: 1.45,
      stilts: { n: [22, 32], hi: [2.0, 3.4], reach: [0.9, 2.6], r: [0.03, 0.058], depth: 3, tide: 1.1, drop: [2, 6] } },
    /* an Avicennia (api-api), 6-11 m: a short, often crooked trunk of smooth pale bark parting low into a few spreading
       limbs; a broad irregular crown, silvery where its leaves turn; its breathing roots (mangrove.js) stand round it in
       the mud by the thousand */
    avicennia: { H: [6, 11], bole: [0.14, 0.24], dbh: H => 0.042 * H, taper: 0.6, flare: 0.3, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.45, 0.56], D: [0.5, 0.62], dome: 0.8, fR: [1.2, 1.7], clumps: [5, 7], cR: [0.55, 0.8], limbs: [4, 6], spread: 1.0 },
      leaf: 'avicL', bark: 'avicennia', barkTint: [0.86, 0.86, 0.8], moss: 0.04, cards: 1.35 },
    /* a Sonneratia (perepat, S. alba), 7-14 m, on the seaward edge: a stout trunk of creamy-grey bark finely fissured, a
       wide spreading crown of thick, round, pale leaves; its breathing roots woody cones (mangrove.js) */
    sonneratia: { H: [7, 13], bole: [0.25, 0.35], dbh: H => 0.04 * H, taper: 0.6, flare: 0.35, butts: { n: [0, 0], h: [1, 1], reach: [1, 1], t0: [0.2, 0.2] },
      crown: { R: [0.45, 0.56], D: [0.45, 0.55], dome: 0.78, fR: [1.3, 1.9], clumps: [5, 7], cR: [0.6, 0.85], limbs: [4, 6], spread: 1.0 },
      leaf: 'sonnL', bark: 'avicennia', barkTint: [0.8, 0.74, 0.64], moss: 0.04, cards: 1.3 },
    /* a Bruguiera (tumu, B. gymnorhiza), 10-20 m, a little back from the water: a straight dark trunk on small buttresses,
       its roots knees out of the mud (mangrove.js); a narrow crown of glossy leaves crowded at the twig ends */
    bruguiera: { H: [10, 18], bole: [0.4, 0.52], dbh: H => 0.026 * H, taper: 0.62, flare: 0.3, butts: { n: [3, 5], h: [0.35, 0.8], reach: [0.35, 0.8], t0: [0.07, 0.12], roots: 0.3 },
      crown: { R: [0.24, 0.3], D: [0.4, 0.5], dome: 0.85, fR: [1.4, 1.9], clumps: [5, 7], cR: [0.6, 0.85], limbs: [3, 5], spread: 1.0 },
      leaf: 'brugL', bark: 'rhizophora', barkTint: [0.72, 0.7, 0.68], moss: 0.05, cards: 1.35 } };

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

  /* ── a strangler fig's cage of roots, as one surface: round the host's trunk, n roots braid down from the crown's
     foot, half spiralling one way and half the other, raised as bands over the host's bark and fused smoothly where
     they cross; between them the host shows, dark and sunk; at the foot the bands swell into flanges that run out
     over the ground as roots. The shell's radius at each point is the host's plus the bands' (a smooth maximum of
     every root's), so there are no joints, no pipes ── */
  function lattice(Lt, tr, boleH, r0, rTop, R, addPart, tile, lod) {
    const Kt = K(), n = Math.round(lerp(R, Lt.roots)), tw = lerp(R, Lt.twist), top = boleH + rTop * 0.8;
    const roots = []; for (let k = 0; k < n; k++) roots.push({ a0: k / n * TAU + R() * 0.35, dir: k % 2 ? 1 : -1, ph: R() * TAU, w: 0.32 + 0.22 * R(), h: 0.55 + 0.45 * R(), sw: 0.6 + 0.6 * R() });
    const thetaOf = (rt, y) => { const t = 1 - y / top; return rt.a0 + rt.dir * tw * t * Math.PI + 0.1 * Math.sin(y * 0.55 + rt.ph); };
    const host = y => tr.base(Math.max(0, y)) * 0.82;
    /* (how much root stands over the host at height y, round at angle a: each band a rounded ridge, the ridges blended
       with a smooth maximum so crossings fuse; wider and deeper toward the foot, where they flare) */
    const band = (y, a) => {
      let acc = 0; const foot = Math.exp(-Math.max(0, y) / 1.6), hr = host(y);
      for (const rt of roots) {
        const da = Math.atan2(Math.sin(a - thetaOf(rt, y)), Math.cos(a - thetaOf(rt, y))), d = Math.abs(da) * hr, w = r0 * rt.w * (0.55 + 0.45 * (1 - y / top)) * (1 + 0.8 * foot) * 0.5;
        if (d < w) { const q = 1 - (d / w) ** 2; acc += Math.exp(8 * q * q) - 1; }
      }
      return acc > 0 ? Math.log(1 + acc) / 8 : 0;
    };
    const segV = lod ? 34 : 72, segA = lod ? 48 : 128, nU = Math.max(1, Math.round(TAU * r0 / tile[0]));
    const rowY = i => -0.3 + (top + 0.3) * Math.pow(i / (segV - 1), 1.3);
    let vAcc = 0, prev = rowY(0); const vOf = []; for (let i = 0; i < segV; i++) { const y = rowY(i); vAcc += Math.abs(y - prev); prev = y; vOf.push(vAcc / tile[1]); }
    const g = Kt.gridGeo(segV, segA, true, (i, j) => {
      const y = rowY(i), a = j / segA * TAU, b = Math.sqrt(Math.min(1, band(y, a))), foot = Math.exp(-Math.max(0, y) / 1.2), hr = host(y);
      /* (the band's height over the host: a third of a root's width, and much more at the foot where it flares out) */
      const rise = b * r0 * (0.2 + 0.45 * foot * foot) + b * foot * foot * r0 * 0.9, r = hr + rise - (1 - b) * r0 * 0.04;
      const [sx, sz] = tr.spine(Math.max(0, y)), x = sx + Math.cos(a) * r, z = sz + Math.sin(a) * r;
      /* (the host between the bands: darker, greener, sunk; the bands pale, their flanks a little shaded) */
      const ao = (0.5 + 0.5 * b) * (0.65 + 0.35 * Math.min(1, y / 2 + 0.5)), moss = (1 - b) * 0.6;
      return [x, y, z, j / segA * nU, vOf[i], ao * (1 - 0.35 * moss), ao * (1 - 0.15 * moss), ao * (1 - 0.4 * moss)];
    });
    Kt.faceOut(g, (x, y, z, nx, ny, nz) => { const [sx, sz] = tr.spine(Math.max(0, y)); return (x - sx) * nx + (z - sz) * nz; });
    addPart(g, () => [0, 0]);
    /* (each root, at the foot, runs on over the ground) */
    if (!lod) for (const rt of roots) { const a = thetaOf(rt, 0), [sx, sz] = tr.spine(0), rr = host(0) + r0 * 0.9, x = sx + Math.cos(a) * rr, z = sz + Math.sin(a) * rr;
      for (const gg of Kt.roots(x - Math.cos(a) * 0.25, z - Math.sin(a) * 0.25, [Math.cos(a), Math.sin(a)], r0 * rt.w * 0.32, 1.8 + 2.6 * R(), { seed: Math.floor(R() * 1e6), tile })) addPart(gg, () => [0, 0]); }
  }

  /* the colour down a mangrove's root: grey-brown and pale above the tide's reach; below it, where the tide wets it twice
     a day, darker and duller; mud-brown where it goes into the mud */
  const stiltCol = tide => (t, a, p) => {
    const y = p[1], tl = tide + 0.12 * (Models.vn(p[0] * 1.3, p[2] * 1.3, 2.2) - 0.5), wet = 1 - sm(tl - 0.12, tl + 0.04, y), mud = 1 - sm(-0.05, 0.4, y), k = 0.88 + 0.18 * Models.vn(p[0] * 7.1 + p[2] * 3.3, y * 9, 4.4);
    /* (above the tide's line pale grey-brown; below it a duller, darker brown, the barnacles' band paler just under the
       line; the foot mud-dark) */
    let c = [1.0 * k, 0.96 * k, 0.9 * k]; c = K().mix3(c, [0.5, 0.43, 0.35], wet * 0.85);
    c = K().mix3(c, [0.82, 0.8, 0.74], wet * (1 - sm(tl - 0.35, tl - 0.15, y)) * sm(tl - 0.6, tl - 0.4, y) * 0.5 * Models.vn(p[0] * 9, y * 14 + p[2] * 9, 6.1));
    c = K().mix3(c, [0.26, 0.21, 0.16], mud * 0.9); return c;
  };
  /* ── a Rhizophora's stilt roots: all round the trunk's lower few metres, each root leaves it heading out and down (the
     lower it leaves, the steeper), arches over and comes down to the mud nearly upright, farther out the higher it left;
     partway down most send out another that arches on beyond, and that one another; at the mud a few short anchors splay
     from each foot. Smooth, swelling a little where they leave the trunk and where they go in ── */
  function stilts(St, tr, r0, R, addPart, tile, lod) {
    const Kt = K(), n = Math.round(lerp(R, St.n) * (lod ? 0.6 : 1)), hi = lerp(R, St.hi), col = stiltCol(St.tide ?? 1), segs = lod ? 8 : 18, radial = lod ? 5 : 8, [bx, bz] = tr.spine(0);
    const one = (p0, dir0, end, r, depth) => {
      const D = Math.hypot(end.x - p0.x, end.z - p0.z), h = p0.y - end.y;
      /* (out along its first heading for well over half its reach, then down, so it arches) */
      const c1 = p0.clone().addScaledVector(dir0, Math.max(0.25, D * 0.62)), c2 = end.clone().add(V(0, Math.max(0.3, h * 0.72), 0));
      c1.x += (R() - 0.5) * D * 0.12; c1.z += (R() - 0.5) * D * 0.12;
      /* (not a clean arc: the root grew in spurts, a slight kink where each began, a wander between) */
      const arc = new T.CubicBezierCurve3(p0, c1, c2, end), pts = [];
      for (let i = 0; i <= 8; i++) { const q = arc.getPoint(i / 8); if (i > 0 && i < 8) { const w = D * 0.014; q.x += w * (R() - 0.5) * 2; q.z += w * (R() - 0.5) * 2; q.y += D * 0.01 * (R() - 0.5); } pts.push(q); }
      const curve = new T.CatmullRomCurve3(pts);
      addPart(Kt.tube(curve, t => r * (1 - 0.3 * t) * (1 + 0.15 * sm(0.88, 1, t)) * (1 + (depth ? 0.12 : 0.35) * (1 - sm(0, 0.12, t))), { segs, radial, tile, col }), () => [0, 0]);
      if (depth < (St.depth ?? 2)) for (let k = 0, nk = R() < 0.7 ? 1 : R() < 0.6 ? 2 : 0; k < nk; k++) {
        const tb = 0.3 + 0.4 * R(), pb = curve.getPointAt(tb); if (pb.y < 0.35) continue;
        const az = Math.atan2(pb.z - bz, pb.x - bx) + (R() - 0.5) * 0.9, out = 0.35 + R() * (0.5 + pb.y * 0.4), dip = 0.2 + 0.35 * R();
        one(pb, V(Math.cos(az) * Math.cos(dip), -Math.sin(dip), Math.sin(az) * Math.cos(dip)), V(pb.x + Math.cos(az) * out, -0.18, pb.z + Math.sin(az) * out), r * (0.6 + 0.15 * R()), depth + 1);
      }
      if (!lod) { const pa = curve.getPointAt(0.94); for (let k = 0, na = 1 + Math.floor(R() * 3); k < na; k++) { const az = R() * TAU, L = 0.1 + 0.14 * R(), ea = pa.clone().add(V(Math.cos(az) * L, -0.22, Math.sin(az) * L));
        addPart(Kt.tube(new T.QuadraticBezierCurve3(pa, pa.clone().add(V(Math.cos(az) * L * 0.6, -0.02, Math.sin(az) * L * 0.6)), ea), t => r * 0.5 * (1 - 0.5 * t), { segs: 4, radial: 5, tile, col }), () => [0, 0]); } }
    };
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + (R() - 0.5) * (TAU / n) * 0.9, u = Math.pow(R(), 0.85), h0 = 0.35 + u * (hi - 0.35), [sx, sz] = tr.spine(h0), rT = tr.rAt(h0, a) * 0.85;
      const reach = r0 + lerp(R, St.reach) * (0.45 + 0.55 * u), a2 = a + (R() - 0.5) * 0.35, dip = 0.05 + 0.45 * (1 - u) + (R() - 0.5) * 0.2;
      one(V(sx + Math.cos(a) * rT, h0, sz + Math.sin(a) * rT), V(Math.cos(a) * Math.cos(dip), -Math.sin(dip), Math.sin(a) * Math.cos(dip)), V(bx + Math.cos(a2) * reach, -0.18, bz + Math.sin(a2) * reach), lerp(R, St.r) * (0.75 + 0.45 * u), 0);
    }
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
    const tr = Kt.trunk({ H: boleH + rTop * 1.2, r0, rTop, lean, butts, seed: seed * 3 + 1, tile, moss: S.moss, flare: S.flare ?? (S.lattice ? 0.5 : 0.16), segV: lod ? 28 : 52, segA: lod ? 40 : 96 });
    if (S.lattice) lattice(S.lattice, tr, boleH, r0, rTop, R, addPart, tile, lod);
    else addPart(tr.geo, () => [0, 0]);
    if (S.stilts) stilts(S.stilts, tr, r0, R, addPart, tile, lod);
    for (const b of butts) {
      const B = Kt.buttress(tr, Object.assign({ seed: Math.floor(R() * 1e6), tile, moss: S.moss, segL: lod ? 22 : 40 }, b)); addPart(B.geo, () => [0, 0]);
      if (!lod) for (const g of Kt.roots(B.tip[0] - B.dir[0] * 0.6, B.tip[1] - B.dir[1] * 0.6, B.dir, Math.max(0.1, B.t * 0.62), (1.6 + R() * 2.6) * (S.butts.roots ?? 1), { seed: Math.floor(R() * 1e6), tile })) addPart(g, () => [0, 0]);
    }
    const [tx, tz] = tr.spine(boleH), top = V(tx, boleH, tz);

    /* ── the crown's florets: over a dome above the top of the bole, spread round it, the outer ones lower, so the crown
       is a broad shallow dome of sub-crowns ── */
    const Rc = H * lerp(R, S.crown.R), Dc = H * lerp(R, S.crown.D), florets = [], rfM = (S.crown.fR[0] + S.crown.fR[1]) / 2;
    /* (a cap of a sphere whose rim is the crown's edge and whose top is its top: the florets' middles spread evenly over
       it, as many as it takes to cover it, each floret's own size) */
    const cb = Math.max(2, Rc - rfM * 0.6), ch = Math.max(2, Dc * S.crown.dome), Rd = (cb * cb + ch * ch) / (2 * ch), cy0 = boleH + Dc - rfM * 0.4 - Rd;
    const capA = 2 * Math.PI * Rd * ch, nF = Math.max(3, Math.round(capA / (Math.PI * rfM * rfM * 0.62))), cosMax = 1 - ch / Rd;
    if (S.crown.tiers) {
      /* (a pagoda: three to five level layers, each a ring of flattened florets round the trunk, smaller toward the top) */
      const nT = Math.round(lerp(R, S.crown.tiers)), gap = Dc / (nT + 0.4);
      for (let k = 0; k < nT; k++) { const y = boleH + gap * (k + 0.5), Rk = Rc * (1 - 0.6 * k / nT), n = Math.max(3, Math.round(TAU * Rk / (rfM * 1.3)));
        for (let i = 0; i < n; i++) { const az = i / n * TAU + k * 0.7 + R() * 0.3, rr = Rk * (0.55 + 0.4 * R()); florets.push({ c: V(tx + Math.cos(az) * rr, y + (R() - 0.5) * 0.4, tz + Math.sin(az) * rr), r: lerp(R, S.crown.fR) * 0.85, ph: R(), flat: 0.45 }); }
        florets.push({ c: V(tx, y + 0.2, tz), r: rfM * 0.7, ph: R(), flat: 0.45 }); }
    } else if (S.crown.shape === 'ellipsoid') {
      /* (a tall narrow crown: the florets over an upright ellipsoid, its foot left open where the trunk comes in; gaps) */
      const cy = boleH + Dc * 0.5, ry = Dc * 0.5 - rfM * 0.5, rx = Math.max(1, Rc - rfM * 0.5), area = 4 * Math.PI * Math.pow((Math.pow(rx * rx, 1.6) * 2 + Math.pow(rx * ry, 1.6)) / 3, 1 / 1.6), n = Math.max(6, Math.round(area / (Math.PI * rfM * rfM * 0.42)));
      for (let i = 0; i < n; i++) { const y = 1 - 2 * (i + 0.5) / n; if (y < -0.75) continue; const r = Math.sqrt(1 - y * y), az = i * 2.39996 + R() * 0.4, rf = lerp(R, S.crown.fR);
        if (R() < (S.crown.gaps || 0)) continue;
        florets.push({ c: V(tx + Math.cos(az) * r * rx * (0.85 + 0.25 * R()), cy + y * ry, tz + Math.sin(az) * r * rx * (0.85 + 0.25 * R())), r: rf, ph: R() }); }
    } else for (let i = 0; i < nF; i++) {
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
    /* (a strangler's aerial roots: from the limbs, straight down on the air, some reaching the ground and thickening) */
    if (S.lattice) for (let i = 0, n = Math.round(lerp(R, S.lattice.aerial)); i < n && limbs.length; i++) {
      const L = limbs[Math.floor(R() * limbs.length)], t = 0.35 + 0.6 * R(), p = L.curve.getPointAt(t).add(V(0, -L.r(t) * 0.8, 0)), reach = R() < 0.6, y1 = reach ? -0.1 : p.y * (0.3 + 0.5 * R()), rr = reach ? 0.02 + 0.03 * R() : 0.008 + 0.01 * R();
      const pts = [p, p.clone().add(V((R() - 0.5) * 0.3, (y1 - p.y) * 0.35, (R() - 0.5) * 0.3)), p.clone().add(V((R() - 0.5) * 0.5, (y1 - p.y) * 0.7, (R() - 0.5) * 0.5)), V(p.x + (R() - 0.5) * 0.6, y1, p.z + (R() - 0.5) * 0.6)];
      addPart(Kt.tube(new T.CatmullRomCurve3(pts), t2 => rr * (reach ? 0.7 + 0.6 * t2 * t2 : 1 - 0.6 * t2), { segs: lod ? 6 : 12, radial: lod ? 4 : 6, tile, col: () => [0.9, 0.88, 0.82] }), (x, y, z) => [L.ph, 0.03 * clamp((p.y - y) / p.y)]);
    }
    /* (a Rhizophora's roots let down from its lower limbs: hanging nearly straight, most reaching the mud and curving out at
       the foot like a stilt; a few still short, swinging) */
    if (S.stilts && S.stilts.drop) for (let i = 0, n = Math.round(lerp(R, S.stilts.drop) * (lod ? 0.5 : 1)), col = stiltCol(S.stilts.tide ?? 1); i < n && limbs.length; i++) {
      const L = limbs[Math.floor(R() * limbs.length)], t = 0.2 + 0.6 * R(), p = L.curve.getPointAt(t).add(V(0, -L.r(t) * 0.7, 0)); if (p.y < 2.2) continue;
      const reach = R() < 0.75, out = V(p.x - tx, 0, p.z - tz); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
      const D = 0.3 + 1.1 * R(), end = reach ? V(p.x + out.x * D, -0.18, p.z + out.z * D) : p.clone().add(V(out.x * 0.15, -p.y * (0.25 + 0.4 * R()), out.z * 0.15)), drop = p.y - end.y;
      /* (never a plumb line: it wanders a little as it comes down, and where it reached the mud it has curved out and
         forked like a stilt) */
      const side = V(-out.z, 0, out.x), pts = [p];
      for (let k = 1; k < 6; k++) { const f = k / 6, q = p.clone().lerp(end, f); q.addScaledVector(side, (R() - 0.5) * 0.25 * Math.sin(Math.PI * f)).addScaledVector(out, (reach ? -D * 0.55 * (1 - f) * f * 2.2 : 0) + (R() - 0.5) * 0.12); if (reach) q.y = p.y - drop * (1 - Math.pow(1 - f, 1.25)); pts.push(q); }
      pts.push(end);
      const rr = reach ? 0.014 + 0.012 * R() : 0.007 + 0.006 * R(), cv = new T.CatmullRomCurve3(pts);
      addPart(Kt.tube(cv, t2 => rr * (reach ? 0.75 + 0.6 * t2 * t2 : 1 - 0.55 * t2), { segs: lod ? 8 : 18, radial: lod ? 4 : 6, tile, col }),
        (x, y, z) => [L.ph, reach ? 0.03 * clamp(y / p.y) : 0.05]);
      if (reach && !lod) { const pf = cv.getPointAt(0.82), az = Math.atan2(out.z, out.x) + (R() < 0.5 ? -1 : 1) * (0.5 + 0.5 * R()), e2 = V(pf.x + Math.cos(az) * (0.3 + 0.4 * R()), -0.18, pf.z + Math.sin(az) * (0.3 + 0.4 * R()));
        addPart(Kt.tube(new T.CubicBezierCurve3(pf, pf.clone().add(V(Math.cos(az) * 0.25, -0.05, Math.sin(az) * 0.25)), e2.clone().add(V(0, pf.y * 0.6, 0)), e2), t2 => rr * 0.9 * (1 - 0.2 * t2), { segs: 10, radial: 6, tile, col }), () => [0, 0]); }
    }
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
        if (f.flat) d.y *= f.flat;
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
Models.add('flora/fig', (o = {}) => FloraGrow.model('fig', o.seed || 1, o));
Models.add('flora/understory', (o = {}) => FloraGrow.model('understory', o.seed || 1, o));
for (const k of ['casuarina', 'terminalia', 'barringtonia', 'hibiscus']) Models.add('flora/' + k, (o = {}) => FloraGrow.model(k, o.seed || 1, o));
