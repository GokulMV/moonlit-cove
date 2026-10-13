/* a spotted eagle ray, flying through the water on its wings: a broad diamond, inky blue-grey above and peppered with
   white spots, white beneath; the head standing out in front of the wings as a rounded snout, a bulging eye either
   side of it with a spiracle behind; the wing tips pointed and swept back; a whip of a tail three times its length.
   At the origin in metres, its head toward +x, its back +y; about 1 m across the wings. userData.anim(t): the wings
   beat in a wave from the body out to their tips, the tail trailing */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  M.add('life/ray', () => {
    const g = new T.Group();
    /* the outline round the body's middle (angle from the snout, in degrees → how far out) */
    const rim = M.spline([[0, 0.31], [14, 0.2], [32, 0.2], [60, 0.33], [88, 0.48], [100, 0.52], [112, 0.4], [135, 0.24], [160, 0.17], [180, 0.15]]);
    const R = th => { const d = Math.abs(((th * 180 / Math.PI + 540) % 360) - 180); return rim(d)[0]; };
    const C0 = [-0.04, 0];                                       /* (the middle of the body, a little behind the wings' widest) */
    /* the spots: scattered evenly (none too near another), smaller toward the edges of the wings; some are rings */
    const r = M.rng(23), spots = [];
    for (let k = 0; k < 4000 && spots.length < 150; k++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.55, x = C0[0] + Math.cos(a) * d, z = Math.sin(a) * d, sr = (0.0085 + r() * 0.0075) * (1.15 - 0.6 * d / 0.55);
      if (spots.every(([sx, sz, s2]) => Math.hypot(x - sx, z - sz) > (sr + s2) * 1.9 + 0.012)) spots.push([x, z, sr, r() < 0.3]); }
    const ink = lin('#1d2733'), inkD = lin('#121a23'), white = lin('#eef0ec');
    const top = (s, c) => { const th = c * TAU, rr = s * R(th), x = C0[0] + Math.cos(th) * rr, z = Math.sin(th) * rr, body = Math.max(0, 1 - Math.hypot((x - 0.02) / 0.24, z / 0.13));
      return [x, 0.075 * Math.pow(body, 0.7) + 0.006 * (1 - s), z]; };
    /* (its back painted on a picture over the sheet's own (around, out) coordinates, each texel at its place on the plan) */
    /* (the spots binned on a grid of 4 cm cells, so each texel looks at only the few near it) */
    const GRID = new Map(), cellOf = (x, z) => Math.floor(x / 0.04) * 1000 + Math.floor(z / 0.04);
    for (const sp of spots) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const k = cellOf(sp[0] + i * 0.04, sp[1] + j * 0.04); if (!GRID.has(k)) GRID.set(k, []); if (!GRID.get(k).includes(sp)) GRID.get(k).push(sp); }
    const spotAt = (x, z) => { for (const [sx, sz, sr, ring] of GRID.get(cellOf(x, z)) || []) { const d = Math.hypot(x - sx, z - sz); if (d < sr) return ring ? (d > sr * 0.55 ? 1 : 0.1) : 1 - Math.max(0, (d - sr * 0.8) / (sr * 0.2)) * 0.3; } return 0; };
    /* (painted once, kept for every ray after) */
    const topTex = Models.__rayTex || (Models.__rayTex = M.texFrom(1024, 512, (u, v) => { const p = top(v, u); return mix(mix(ink, inkD, 0.5 + 0.5 * M.fbm(p[0] * 9, p[2] * 9, 3, 2) - 0.25), white, spotAt(p[0], p[2])); }));
    const topG = M.sheet(24, 110, top, null);
    /* (the belly: the same outline, flatter, white, facing down) */
    const belly = M.sheet(12, 110, (s, c) => { const p = top(s, c); return [p[0], -0.35 * (p[1] - 0.006 * (1 - s)) - 0.002, p[2]]; }, () => white);
    { const I = belly.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = belly.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; }
    const skinM = M.litP('#ffffff', { map: topTex, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    const tm = new T.Mesh(topG, skinM), bm = new T.Mesh(belly, M.lit('#ffffff', { vertexColors: true, roughness: 0.55 }));
    g.add(tm, bm);
    /* the head, standing out in front of the wings: domed, its snout flattened like a duck's bill; spotted above, white
       beneath */
    const head = M.loft([[0.06, 0.07, 0.04, 0.03, 2.2], [0.13, 0.092, 0.05, 0.032, 2.3], [0.19, 0.088, 0.046, 0.03, 2.35], [0.245, 0.068, 0.034, 0.024, 2.4], [0.29, 0.05, 0.02, 0.017, 2.3], [0.325, 0.03, 0.011, 0.012, 2.1], [0.338, 0, 0, 0.011, 2]], 40, 40,
      (x, y, z, u, a) => { const up = Math.cos(a); return up < -0.15 ? white : mix(mix(ink, inkD, 0.4), white, spotAt(x + 0.05 * Math.sin(z * 40), z * 1.3) * sm(0.0, 0.3, up)); });
    g.add(new T.Mesh(head, M.litP('#ffffff', { vertexColors: true, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 })));
    /* a small dorsal fin where the tail begins, and the pelvic fins either side of it */
    g.add(new T.Mesh(M.foil(8, 14, s => ({ le: [-0.14 - 0.03 * s, 0.035 + 0.045 * s, 0], ch: [-0.06 * (1 - s) - 0.006, 0, 0], up: [0, 0, 1], th: 0.2 })), M.lit('#1a222c', { roughness: 0.5 })));
    for (const sd of [-1, 1]) g.add(new T.Mesh(M.foil(8, 14, s => ({ le: [-0.11 - 0.05 * s, 0.006, sd * (0.04 + 0.07 * s)], ch: [-0.07 * (1 - 0.6 * s), 0, 0], up: [0, 1, 0], th: 0.12 })), M.lit('#1d2733', { roughness: 0.5 })));
    /* the eyes, bulging either side of the head, a spiracle behind each */
    const eyeM = M.litP('#0b0b0c', { roughness: 0.08, clearcoat: 1 }), ringM = M.lit('#3a4552', { roughness: 0.5 });
    for (const sd of [-1, 1]) {
      const rg = new T.Mesh(new T.SphereGeometry(0.019, 14, 10), ringM); rg.position.set(0.17, 0.055, sd * 0.085); rg.scale.set(1, 0.8, 1); g.add(rg);
      const e = new T.Mesh(new T.SphereGeometry(0.0125, 14, 10), eyeM); e.position.set(0.178, 0.063, sd * 0.095); g.add(e);
      const sp = new T.Mesh(new T.SphereGeometry(0.008, 10, 6), M.lit('#0a0f14', { roughness: 0.6 })); sp.position.set(0.13, 0.06, sd * 0.08); sp.scale.set(1.6, 0.5, 1); g.add(sp);
    }
    /* the tail: a long thin whip */
    const tailC = new T.CatmullRomCurve3([new T.Vector3(-0.17, 0.01, 0), new T.Vector3(-0.5, 0.0, 0.02), new T.Vector3(-0.9, -0.01, -0.03), new T.Vector3(-1.25, -0.02, 0.0)]);
    const tail = new T.Mesh(M.tube(tailC, 30, 6, t => 0.011 * (1 - 0.85 * t)), M.lit('#1a222c', { roughness: 0.5 })); g.add(tail);
    /* the beat: each point of the wings rises and falls a little after the one nearer the body, more the further out */
    const P0 = [topG, belly].map(gm => Float32Array.from(gm.attributes.position.array));
    g.userData.anim = t => {
      [topG, belly].forEach((gm, k) => {
        const P = gm.attributes.position.array, B = P0[k];
        for (let i = 0; i < P.length; i += 3) { const az = Math.abs(B[i + 2]), w = Math.pow(Math.max(0, az - 0.08) / 0.44, 1.3); P[i + 1] = B[i + 1] + 0.16 * w * Math.sin(t * 2.4 - az * 3.2); }
        gm.attributes.position.needsUpdate = true; gm.computeVertexNormals();
      });
      tail.rotation.y = 0.12 * Math.sin(t * 1.2); tail.rotation.z = 0.05 * Math.sin(t * 2.4 - 1.0);
    };
    g.userData.anim(0);
    return g;
  });
})();
