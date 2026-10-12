/* ─────────────────────────────────────────────────────────────
   nature.js — coconut palms (swaying crowns), broadleaf trees and
   bushes built from leaf cards.
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
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
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
    const barkM = Mats.lit({ map: Mats.tex(Paint.bark(5), { repeat: true }), roughness: 0.95 });
    const nutM = Mats.lit({ color: new T.Color('#5a4128'), roughness: 0.6 }), nutG = Mats.lit({ color: new T.Color('#5d6b2a'), roughness: 0.5 });
    const GOLD = 2.39996;
    refs.crowns = [];
    for (const [x, z, h, lx, lz, cr, seed] of Layout.palms) {
      const r = Textures.rng(seed * 97 + 3), caster = z < 5.5;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(0, 0, 0), new T.Vector3(lx * 0.1 + (r() - 0.5) * 0.35, h * 0.34, lz * 0.1 + (r() - 0.5) * 0.35),
        new T.Vector3(lx * 0.48, h * 0.7, lz * 0.48), new T.Vector3(lx, h, lz)]);
      const trunk = new T.Mesh(taperTube(curve, 30, 12, t => (0.27 - 0.1 * t) * (1 + 0.55 * Math.exp(-t * 14)), 0.5), barkM);
      trunk.castShadow = caster; trunk.receiveShadow = true;
      const pg = new T.Group(); pg.position.set(x, 0, z); pg.add(trunk); root.add(pg);
      const crown = new T.Group(); crown.position.set(lx, h, lz); pg.add(crown);
      { const boot = new T.Mesh(new T.CylinderGeometry(0.16, 0.24, 0.55, 10), barkM); boot.position.y = -0.2; boot.castShadow = caster; crown.add(boot); }
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
      const bark = new T.Mesh(g.bark, m.bark); bark.castShadow = bark.receiveShadow = true; grp.add(bark);
      ['c0', 'c1', 'c2'].forEach((k, i) => { if (!g[k].attributes.position.count) return; const lm = new T.Mesh(g[k], m.leaves[i]); lm.castShadow = true; lm.customDepthMaterial = m.depth[i]; grp.add(lm); });
      root.add(grp);
    }
  }

  /* leaf-card canopies: trees get a trunk, branches and tiered leaf clusters; bushes are dense mounds */
  function cards(root, list, refs, opts) {
    const texs = [0, 1, 2].map(k => Mats.tex(Paint.leafCard(opts.seed + k * 7, k === 2 ? opts.palette : null)));
    const mats = texs.map(t => Mats.foliage(t, 0.5));
    const deps = texs.map(t => Mats.cutoutDepth(t, 0.5));
    const barkM = Mats.lit({ color: new T.Color('#4a3a2d'), roughness: 0.95 });
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc3 = new T.Vector3(), p = new T.Vector3();
    const per = [[], [], []];
    for (const [x, z, R, Hc, seed] of list) {
      const r = Textures.rng(seed * 31 + 7);
      const clusters = [];
      if (opts.trunk) {
        const top = new T.Vector3(x + (r() - 0.5) * 0.5, Hc * 0.62, z + (r() - 0.5) * 0.5);
        const c = new T.CatmullRomCurve3([new T.Vector3(x, 0, z), new T.Vector3(x + (r() - 0.5) * 0.4, Hc * 0.3, z + (r() - 0.5) * 0.4), top]);
        const tr = new T.Mesh(taperTube(c, 14, 8, t => 0.22 - 0.1 * t, 1), barkM); root.add(tr);
        const nb = 5 + Math.floor(r() * 3);
        for (let i = 0; i < nb; i++) {
          const a = i / nb * TAU + r() * 0.6, rr = R * (0.45 + r() * 0.45), up = Hc * (0.62 + r() * 0.4);
          const end = new T.Vector3(x + Math.cos(a) * rr, up, z + Math.sin(a) * rr * 0.85);
          const bc = new T.CatmullRomCurve3([top.clone(), top.clone().lerp(end, 0.5).add(new T.Vector3(0, 0.3, 0)), end]);
          const br = new T.Mesh(taperTube(bc, 8, 5, t => 0.1 - 0.06 * t, 1), barkM); root.add(br);
          clusters.push([end, R * (0.42 + r() * 0.2), 0.36]);
        }
        clusters.push([new T.Vector3(x, Hc * 1.02, z), R * 0.55, 0.4]);
      } else {
        clusters.push([new T.Vector3(x, Hc * 0.55, z), R, Hc * 0.75 / R]);
      }
      for (const [cpos, cr, flat] of clusters) {
        const n = Math.round(opts.density * cr * cr);
        for (let i = 0; i < n; i++) {
          let ux, uy, uz; do { ux = r() * 2 - 1; uy = r() * 2 - 1; uz = r() * 2 - 1; } while (ux * ux + uy * uy + uz * uz > 1);
          p.set(cpos.x + ux * cr, Math.max(0.12, cpos.y + uy * cr * flat), cpos.z + uz * cr);
          e.set(-Math.PI / 2 + (r() - 0.5) * 1.3 + uy * 0.4, r() * TAU, (r() - 0.5) * 0.9); q.setFromEuler(e);
          const s = (0.7 + r() * 0.55) * opts.card; sc3.set(s, s, s);
          m4.compose(p, q, sc3); per[Math.floor(r() * 3)].push(m4.clone());
        }
      }
    }
    per.forEach((arr, k) => {
      const inst = new T.InstancedMesh(new T.PlaneGeometry(1, 1), mats[k], arr.length);
      arr.forEach((m, i) => inst.setMatrixAt(i, m));
      root.add(inst);
    });
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
  return { build, sway, taperTube, frondGeo };
})();
