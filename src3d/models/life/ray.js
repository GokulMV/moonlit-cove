/* a spotted eagle ray, flying through the water on its wings: a broad diamond, inky blue-grey above and peppered with
   white spots, white beneath; the head standing out in front of the wings as a rounded snout, a bulging eye either
   side of it with a spiracle behind; the wing tips pointed and swept back; a whip of a tail three times its length.
   At the origin in metres, its head toward +x, its back +y; about 1 m across the wings. userData.anim(t): the wings
   beat in a wave from the body out to their tips, the tail trailing */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  M.add('life/ray', () => {
    const g = new T.Group();
    /* the outline round the body's middle (angle from the snout, in degrees → how far out) */
    const rim = M.spline([[0, 0.31], [14, 0.2], [32, 0.2], [60, 0.33], [88, 0.48], [100, 0.52], [112, 0.4], [135, 0.24], [160, 0.17], [180, 0.15]]);
    const R = th => { const d = Math.abs(((th * 180 / Math.PI + 540) % 360) - 180); return rim(d)[0]; };
    const C0 = [-0.04, 0];                                       /* (the middle of the body, a little behind the wings' widest) */
    const r = M.rng(23), spots = Array.from({ length: 120 }, () => { const a = r() * TAU, d = Math.sqrt(r()); return [C0[0] + Math.cos(a) * d * 0.5, Math.sin(a) * d * 0.5, 0.011 + r() * 0.012]; });
    const ink = lin('#1d2733'), inkD = lin('#121a23'), white = lin('#eef0ec');
    const top = (s, c) => { const th = c * TAU, rr = s * R(th), x = C0[0] + Math.cos(th) * rr, z = Math.sin(th) * rr, body = Math.max(0, 1 - Math.hypot((x - 0.02) / 0.24, z / 0.13));
      return [x, 0.075 * Math.pow(body, 0.7) + 0.006 * (1 - s), z]; };
    const topCol = (s, c, p) => { for (const [sx, sz, sr] of spots) if (Math.hypot(p[0] - sx, p[2] - sz) < sr) return white; return mix(ink, inkD, 0.5 + 0.5 * Math.sin(p[0] * 31 + p[2] * 17)); };
    const topG = M.sheet(24, 110, top, topCol);
    /* (the belly: the same outline, flatter, white, facing down) */
    const belly = M.sheet(12, 110, (s, c) => { const p = top(s, c); return [p[0], -0.35 * (p[1] - 0.006 * (1 - s)) - 0.002, p[2]]; }, () => white);
    { const I = belly.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = belly.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; }
    const skinM = M.lit('#ffffff', { vertexColors: true, roughness: 0.45 });
    const tm = new T.Mesh(topG, skinM), bm = new T.Mesh(belly, M.lit('#ffffff', { vertexColors: true, roughness: 0.55 }));
    g.add(tm, bm);
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
