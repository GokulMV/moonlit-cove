/* ─────────────────────────────────────────────────────────────
   nature.js — the camp's own coconut palms (swaying crowns), and
   its broadleaf trees and bushes, grown (trees.js).
   ───────────────────────────────────────────────────────────── */
const Nature = (() => {
  const T = THREE, TAU = Math.PI * 2;

  /* tube whose radius varies along a curve */
  function taperTube(curve, segs, radial, rFn, vRepeat) {
    const pos = [], nrm = [], uv = [], idx = [];
    const frames = curve.computeFrenetFrames(segs, false), len = curve.getLength();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, P = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i], r = rFn(t);
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * TAU, c = Math.cos(a), s = Math.sin(a);
        const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
        pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r); nrm.push(nx, ny, nz); uv.push(j / radial, t * len / vRepeat);
      }
    }
    /* (wound so each face looks outward, the way its normal points: the other way round and only the inside of the far
       wall shows, a hollow half-pipe where a round trunk should be) */
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }

  /* a coconut palm's trunk along `curve` (its foot at the curve's start, on the ground): carried on 0.7 m down into the
     sand, so it rises out of it; swollen at the foot with a mat of short roots running out and down into the sand;
     narrowing as it goes up, its girth a little uneven. Vertex colours: weathered grey low down, browner up high,
     the roots reddish. (uv: round the trunk, and up it in half metres) */
  /* (where the bark's painting is plainest and lightest, so a root can take its colour from there without its rings) */
  let rootV = null;
  function plainRow() {
    if (rootV !== null) return rootV;
    const img = Trees.palmBark().map.image, d = img.data, w = img.width, h = img.height; let best = 0, bv = 0.5;
    for (let y = 0; y < h; y++) { let s = 0, s2 = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = d[i] + d[i + 1] + d[i + 2]; s += l; s2 += l * l; } const m = s / w, sd = Math.sqrt(Math.max(0, s2 / w - m * m)), sc = m - 1.5 * sd; if (sc > best) { best = sc; bv = (y + 0.5) / h; } }
    return (rootV = bv);
  }
  function palmTrunk(curve, o = {}) {
    const { r0 = 0.2, rTop = 0.135, bole = 0.12, seed = 1, segs = 30, radial = 12, roots = 16, rootSegs = 5, rootRadial = 5 } = o;
    const r = Textures.rng(seed * 13 + 5), tg = curve.getTangentAt(0), foot = curve.getPointAt(0);
    const c2 = new T.CatmullRomCurve3([foot.clone().addScaledVector(tg, -0.7), ...curve.points.map(p => p.clone())]), len = c2.getLength(), L0 = 0.7 / len, up = len * (1 - L0);
    /* the trunk tapering up to the crown and going straight down into the sand, only a little fuller just above it
       (no flare: the foot of a coconut palm is barely wider than its trunk) */
    const swellAt = q => Math.min(bole, 0.12 * r0) * Math.exp(-(((q - 0.06) / 0.3) ** 2));
    const rad = t => {
      const s = (t - L0) * len, q = Math.max(0, s);
      return (rTop + (r0 - rTop) * Math.pow(1 - Math.min(1, q / up), 1.3) + swellAt(q)) * (1 + 0.03 * Math.sin(s * 5.3 + seed) + 0.02 * Math.sin(s * 13.1 + seed * 2));
    };
    const parts = [taperTube(c2, segs, radial, rad, 0.5)];
    const tint = [];
    { const n = parts[0].attributes.position.count, C = new Float32Array(n * 3), P = parts[0].attributes.position;
      for (let i = 0; i < n; i++) {
        const y = P.getY(i) - foot.y, k = Math.min(1, Math.max(0, y / Math.max(1, up))), w = 0.5 + 0.3 * Math.sin(y * 1.7 + seed) + 0.2 * Math.sin(y * 4.1 + seed * 3), g = (1.1 - 0.28 * k) * (0.9 + 0.2 * w);
        /* (darker and warmer down where the sand is kicked up against it) */
        const soil = Math.max(0, Math.min(1, 1 - y / 0.35));
        C.set([g * (1.02 - 0.06 * k) * (1 - 0.18 * soil), g * (1 - 0.24 * soil), g * (0.98 - 0.12 * k) * (1 - 0.32 * soil)], i * 3); }
      tint.push(C); }
    /* the roots: a mat of many thin cords from round the bulb, each running out a little way over the sand and down into
       it, warm brown; a few short broken stubs among them */
    const vR = plainRow(), rootAt = h => rad(L0 + h / len);
    for (let i = 0; i < roots; i++) {
      /* (low at the foot, short, and soon into the sand: a tangle round it, not legs) */
      const az = i / roots * TAU + (r() - 0.5) * 0.5, dx = Math.cos(az), dz = Math.sin(az), stub = r() < 0.45;
      const h0 = 0.005 + 0.04 * r() * r(), fr = rootAt(h0) * 0.96, L = stub ? 0.022 + 0.025 * r() : 0.05 + 0.09 * r() * r(), dip = 0.04 + 0.05 * r();
      const a = new T.Vector3(foot.x + dx * fr, foot.y + h0, foot.z + dz * fr);
      const b = a.clone().add(new T.Vector3(dx * L * 0.4, -h0 * 0.55 + 0.01, dz * L * 0.4)), c = a.clone().add(new T.Vector3(dx * L * 0.75 + dz * (r() - 0.5) * 0.06, -h0 - 0.004, dz * L * 0.75 - dx * (r() - 0.5) * 0.06));
      const e = a.clone().add(new T.Vector3(dx * L, -h0 - dip, dz * L));
      const rr = 0.0055 + 0.0045 * r(), g = taperTube(new T.CatmullRomCurve3(stub ? [a, b, c] : [a, b, c, e]), stub ? Math.min(3, rootSegs) : rootSegs, rootRadial, t => rr * (1 - 0.45 * t), 0.5), n = g.attributes.position.count, C = new Float32Array(n * 3), k0 = 0.6 + 0.25 * r();
      const U = g.attributes.uv; for (let k = 0; k < U.count; k++) U.setY(k, vR);
      /* (dull, sand-dusted brown: the old ones greyer) */
      const old = r(), rc = [0.86 - 0.12 * old, 0.64 - 0.04 * old, 0.5 + 0.02 * old];
      for (let k = 0; k < n; k++) C.set([rc[0] * k0, rc[1] * k0, rc[2] * k0], k * 3);
      parts.push(g); tint.push(C);
    }
    /* merged, with their colours */
    let nv = 0, ni = 0; for (const g of parts) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), CO = new Float32Array(nv * 3), I = new Uint32Array(ni);
    let ov = 0, oi = 0;
    parts.forEach((g, k) => { P.set(g.attributes.position.array, ov * 3); N.set(g.attributes.normal.array, ov * 3); UV.set(g.attributes.uv.array, ov * 2); CO.set(tint[k], ov * 3);
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + ov; ov += g.attributes.position.count; oi += ix.length; g.dispose(); });
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(UV, 2)); out.setAttribute('color', new T.BufferAttribute(CO, 3)); out.setIndex(new T.BufferAttribute(I, 1));
    out.computeBoundingSphere(); return out;
  }

  /* one frond: V-folded ribbon along a drooping spine, base at the origin */
  function frondGeo(len, width, rise, droop, seg = 12) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, x = u * len, y = rise * u * len - droop * len * u * u;
      const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.04)), 0.7) * (1 - 0.35 * u);
      const fold = w * 0.32;
      pos.push(x, y - fold, -w / 2, x, y, 0, x, y - fold, w / 2);
      uv.push(0, u, 0.5, u, 1, u);
    }
    for (let i = 0; i < seg; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function palms(root, refs) {
    const green = Mats.tex(Paint.frond(31)), green2 = Mats.tex(Paint.frond(47)), dry = Mats.tex(Paint.frond(59, 1));
    const fm = [green, green2].map(t => Mats.foliage(t, 0.4));
    const dm = Mats.foliage(dry, 0.4);
    const depth = [green, green2].map(t => Mats.cutoutDepth(t, 0.4)), dryDepth = Mats.cutoutDepth(dry, 0.4);
    const barkM = Trees.palmBarkMat(), bootM = Mats.lit({ color: new T.Color('#4a3a2a'), roughness: 0.95 }, 'rock');
    const nutM = Mats.lit({ color: new T.Color('#5a4128'), roughness: 0.6 }), nutG = Mats.lit({ color: new T.Color('#5d6b2a'), roughness: 0.5 });
    const GOLD = 2.39996;
    refs.crowns = [];
    for (const [x, z, h, lx, lz, cr, seed] of Layout.palms) {
      const r = Textures.rng(seed * 97 + 3), caster = z < 5.5;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(0, 0, 0), new T.Vector3(lx * 0.1 + (r() - 0.5) * 0.35, h * 0.34, lz * 0.1 + (r() - 0.5) * 0.35),
        new T.Vector3(lx * 0.48, h * 0.7, lz * 0.48), new T.Vector3(lx, h, lz)]);
      const trunk = new T.Mesh(palmTrunk(curve, { r0: 0.21 + 0.03 * r(), rTop: 0.14 + 0.02 * r(), bole: 0.11 + 0.05 * r(), seed, segs: 34, radial: 20, roots: 46 }), barkM);
      trunk.castShadow = caster; trunk.receiveShadow = true;
      const pg = new T.Group(); pg.position.set(x, 0, z); pg.add(trunk); root.add(pg);
      const crown = new T.Group(); crown.position.set(lx, h, lz); pg.add(crown);
      { const boot = new T.Mesh(new T.CylinderGeometry(0.17, 0.25, 0.6, 12), bootM); boot.position.y = -0.22; boot.castShadow = caster; crown.add(boot); }
      const nf = 22 + Math.floor(r() * 5), fronds = [];
      for (let i = 0; i < nf; i++) {
        const az = i * GOLD + r() * 0.2;
        const age = i / nf;                                   /* 0 = youngest (top), 1 = oldest */
        const rise = 1.6 - age * 1.7 + (r() - 0.5) * 0.25;
        const droop = 0.18 + age * 0.85 + r() * 0.15;
        const len = cr * (0.72 + 0.32 * Math.sin(Math.PI * Math.min(1, age * 1.2 + 0.15))) * (0.92 + r() * 0.16);
        const geo = frondGeo(len, 1.35 + r() * 0.35, rise, droop, 14);
        const k = Math.floor(r() * 2), f = new T.Mesh(geo, fm[k]);
        f.customDepthMaterial = depth[k]; f.castShadow = caster;
        f.position.y = 0.05 - age * 0.25;
        f.rotation.set((r() - 0.5) * 0.5, az, 0, 'YXZ');
        crown.add(f); fronds.push({ m: f, base: f.rotation.clone(), ph: r() * TAU, sp: 0.8 + r() * 0.8 });
      }
      for (let i = 0; i < 4; i++) {
        const f = new T.Mesh(frondGeo(cr * 0.75, 1.0, -0.5, 1.1), dm); f.customDepthMaterial = dryDepth; f.castShadow = caster;
        f.rotation.set(0, r() * TAU, 0, 'YXZ'); f.position.y = -0.4; crown.add(f);
      }
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU + r(); const n = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), r() < 0.5 ? nutM : nutG);
        n.position.set(Math.cos(a) * (0.18 + r() * 0.08), -0.32 - r() * 0.2, Math.sin(a) * (0.18 + r() * 0.08)); n.castShadow = caster; crown.add(n);
      }
      refs.crowns.push({ g: crown, fronds, ph: r() * TAU, amp: 0.018 + 0.012 * (h / 10) });
    }
  }

  /* the camp's own trees and bushes, grown as the forest's are (trees.js), each its species at the size its place in
     the layout asks for; they cast shadows, their leaves cut out of their cards */
  function grownAt(root, list, pickKind) {
    for (const [x, z, R, Hc, seed] of list) {
      const kind = pickKind(x, z, seed), g = Trees.grow(kind, seed * 31 + 7), m = Trees.materials(kind);
      const top = g.crown.c.y + g.crown.ext.y - 0.6, s = Math.max(0.5, Math.min(1.6, Hc * 1.12 / Math.max(0.5, top)));
      const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = (seed * 2.39996) % TAU; grp.scale.setScalar(s);
      if (!g.bark.empty) { const bark = new T.Mesh(g.bark, m.bark); bark.castShadow = bark.receiveShadow = true; grp.add(bark); }
      ['c0', 'c1', 'c2'].forEach((k, i) => { if (!g[k].attributes.position.count) return; const lm = new T.Mesh(g[k], m.leaves[i]); lm.castShadow = true; lm.customDepthMaterial = m.depth[i]; grp.add(lm); });
      root.add(grp);
    }
  }

  function build(root) {
    const refs = {};
    palms(root, refs);
    /* (a beach hibiscus close round the camp, tropical almonds behind, casuarinas at the ends) */
    grownAt(root, Layout.trees, (x, z, seed) => Math.abs(x) > 17 ? 'casuarina' : z > 14 ? 'almond' : 'hibiscus');
    grownAt(root, Layout.bushes, () => 'grape');
    return refs;
  }

  /* gentle breeze: crowns rock, fronds flutter */
  function sway(refs, t, wind = 1) {
    for (const c of refs.crowns) {
      c.g.rotation.x = Math.sin(t * 0.55 + c.ph) * c.amp * wind;
      c.g.rotation.z = Math.sin(t * 0.43 + c.ph * 1.7) * c.amp * 0.8 * wind;
      for (const f of c.fronds) {
        f.m.rotation.x = f.base.x + Math.sin(t * f.sp * 1.6 + f.ph) * 0.035 * wind;
        f.m.rotation.z = Math.sin(t * f.sp * 1.1 + f.ph * 2.0) * 0.03 * wind;
      }
    }
  }
  return { build, sway, taperTube, frondGeo, palmTrunk };
})();
