/* a spotted eagle ray, flying through the water on its wings: a broad diamond twice as wide as it is long, its wings'
   leading edges swept back almost straight to sharp, backswept tips, their trailing edges hollowed; inky blue-black
   above and peppered with white spots and rings, the spots biggest down its back, white beneath with the five gill
   slits either side; the head standing out in front of the wings, domed, its eyes and the spiracles behind them on its
   sides, the snout flattened and rounded like a duck's bill; small rounded pelvic fins behind the disc; a little
   dorsal fin where the tail begins, two barbed spines behind it, and the tail a whip twice the wings' span.
   At the origin in metres, its head toward +x, its back +y; about 1 m across the wings. userData.anim(t): the wings
   beat in a wave from the body out to their tips, the tail trailing */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const B = 0.52;                                               /* (half the span) */
  /* the wing's edges along the span, t 0 at the middle to 1 at the tip (x forward) */
  const xLE = t => 0.12 - 0.36 * Math.pow(t, 1.15) + 0.03 * Math.sin(Math.PI * t), xTE = t => -0.27 + 0.03 * t + 0.07 * Math.sin(Math.PI * t);
  /* where (s, c) of the wings lies on the plan: s 0..1 from one tip to the other, c 0..1 back from the leading edge */
  const plan = (s, c) => { const sp = 2 * s - 1, t = Math.abs(sp), a = xLE(t), b = xTE(t); return [a + (b - a) * c, sp * B, t, a - b]; };
  /* a symmetric aerofoil's half-thickness (closed at the trailing edge), as a part of the chord */
  const naca = c => 0.6 * (0.2969 * Math.sqrt(Math.max(0, c)) - 0.126 * c - 0.3516 * c * c + 0.2843 * c * c * c - 0.1015 * c * c * c * c);
  /* the back: a dome over the body, the wings thick at the root and thin toward the tips */
  const dome = (x, z) => 0.058 * Math.pow(Math.max(0, 1 - ((x + 0.04) / 0.26) ** 2 - (z / 0.17) ** 2), 1.4);
  const lift = (s, c) => { const [x, z, t, ch] = plan(s, c); return [x, z, dome(x, z) * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, c))), 0.3), ch * (0.085 - 0.04 * t) * naca(c)]; };
  /* the spots: scattered evenly (none too near another), biggest down the back, smaller out toward the tips; some are
     rings */
  let SPOTS = null;
  const spotsOf = () => {
    if (SPOTS) return SPOTS;
    const r = M.rng(23), spots = [];
    for (let k = 0; k < 9000 && spots.length < 230; k++) {
      const s = r(), c = r(), [x, z, t] = plan(s, c);
      const sr = (0.0075 + r() * 0.007) * (1.3 - 0.75 * t), hx = x - 0.24, hz = z;
      if (c < 0.04 || c > 0.95 || t > 0.97) continue;
      if (spots.every(([sx, sz, s2]) => Math.hypot(x - sx, z - sz) > (sr + s2) * 1.7 + 0.01)) spots.push([x, z, sr, r() < 0.28]);
    }
    /* (and a few small ones on the head) */
    for (let k = 0; k < 400 && spots.length < 250; k++) { const x = 0.12 + r() * 0.2, z = (r() - 0.5) * 0.14, sr = 0.004 + r() * 0.003; if (spots.every(([sx, sz, s2]) => Math.hypot(x - sx, z - sz) > (sr + s2) * 1.8 + 0.006)) spots.push([x, z, sr, false]); }
    const GRID = new Map(), cellOf = (x, z) => Math.floor(x / 0.04) * 1000 + Math.floor(z / 0.04);
    for (const sp of spots) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const k = cellOf(sp[0] + i * 0.04, sp[1] + j * 0.04); if (!GRID.has(k)) GRID.set(k, []); if (!GRID.get(k).includes(sp)) GRID.get(k).push(sp); }
    SPOTS = (x, z) => { for (const [sx, sz, sr, ring] of GRID.get(cellOf(x, z)) || []) { const d = Math.hypot(x - sx, z - sz); if (d < sr) return ring ? sm(sr * 0.45, sr * 0.62, d) * (1 - sm(sr * 0.85, sr, d)) : 1 - sm(sr * 0.75, sr, d); } return 0; };
    return SPOTS;
  };
  const ink = lin('#141c26'), inkD = lin('#0b1118'), inkB = lin('#22303f'), white = lin('#eef0ec'), belly = lin('#e9ebe6');
  const back = (x, z) => { const n = M.fbm(x * 9, z * 9, 3, 2); return mix(mix(ink, inkD, 0.6 * n), inkB, 0.25 * sm(0.6, 0.85, n)); };
  let topTex = null;

  M.add('life/ray', () => {
    const g = new T.Group(), spotAt = spotsOf();
    /* ── the wings and the body between them: a sheet over the top, another under it, meeting along the edges ── */
    const NS = 150, NC = 34;
    /* (each sheet laid out over (span, chord), its points then set from the lift of each) */
    const topG = M.sheet(NS, NC, () => [0, 0, 0], null);
    const setUp = (gm, down) => {
      const P = gm.attributes.position.array, uv = gm.attributes.uv.array;
      for (let i = 0; i < P.length / 3; i++) { const c = uv[i * 2], s = uv[i * 2 + 1], [x, z, d, w] = lift(s, c); P[i * 3] = x; P[i * 3 + 2] = z; P[i * 3 + 1] = down ? -0.32 * d - 0.62 * w : d + w; }
      gm.computeVertexNormals();
    };
    setUp(topG, false);
    const botG = M.sheet(NS, NC, () => [0, 0, 0], null); setUp(botG, true);
    { const I = botG.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } botG.computeVertexNormals(); }
    /* (its back painted on a picture over the sheet's own (chord, span) coordinates, each texel at its place on the plan;
       the belly white, the gill slits dark either side of where the head meets the disc) */
    topTex = topTex || M.texFrom(512, 1024, (u, v) => { const [x, z] = plan(v, u); return mix(back(x, z), white, spotAt(x, z)); });
    M.paint(botG, (x, y, z) => {
      let c = belly.map(v => v * (0.97 + 0.04 * M.vn(x * 30, z * 30, 1)));
      const az = Math.abs(z);
      for (let k = 0; k < 5; k++) { const gx = 0.095 - k * 0.022, gz = 0.06 + k * 0.006; if (Math.abs(x - gx) < 0.004 && az > gz - 0.014 && az < gz + 0.014) c = mix(c, lin('#b9b2ac'), 0.8); }
      /* (the wings' rims a little darker) */
      return c;
    });
    const skinM = M.litP('#ffffff', { map: topTex, roughness: 0.4, clearcoat: 0.32, clearcoatRoughness: 0.32 });
    g.add(new T.Mesh(topG, skinM), new T.Mesh(botG, M.litP('#ffffff', { vertexColors: true, roughness: 0.5, clearcoat: 0.2 })));
    /* ── the head, out in front of the wings: domed, its eyes on its sides, the snout a flat rounded bill; spotted
       above, white beneath ── */
    const head = M.loft([[0.04, 0.075, 0.048, 0.022, 2.2], [0.11, 0.084, 0.054, 0.028, 2.3], [0.17, 0.079, 0.05, 0.028, 2.4], [0.22, 0.062, 0.037, 0.022, 2.5],
      [0.262, 0.05, 0.023, 0.015, 2.6], [0.3, 0.043, 0.014, 0.01, 2.6], [0.326, 0.03, 0.01, 0.008, 2.4], [0.338, 0, 0, 0.008, 2]], 50, 48,
      (x, y, z, u, a) => { const up = Math.cos(a); return up < -0.05 ? belly : mix(back(x, z), white, spotAt(x, z) * sm(0.05, 0.3, up)); });
    g.add(new T.Mesh(head, M.litP('#ffffff', { vertexColors: true, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.32 })));
    /* the eyes, bulging from the sides of the head, a spiracle behind and above each; the mouth a pale slit beneath */
    const eyeM = M.litP('#08090a', { roughness: 0.06, clearcoat: 1 }), ringM = M.lit('#2b3846', { roughness: 0.5 });
    for (const sd of [-1, 1]) {
      const rg = new T.Mesh(new T.SphereGeometry(0.017, 16, 10), ringM); rg.position.set(0.172, 0.035, sd * 0.077); rg.scale.set(1.1, 0.85, 0.8); g.add(rg);
      const e = new T.Mesh(new T.SphereGeometry(0.0115, 16, 10), eyeM); e.position.set(0.176, 0.037, sd * 0.087); g.add(e);
      const sp = new T.Mesh(new T.SphereGeometry(0.008, 10, 6), M.lit('#070b10', { roughness: 0.6 })); sp.position.set(0.128, 0.056, sd * 0.07); sp.scale.set(1.7, 0.45, 1); g.add(sp);
    }
    { const mo = new T.Mesh(M.tube(new T.CatmullRomCurve3([-0.03, -0.015, 0, 0.015, 0.03].map(z => new T.Vector3(0.27 - 140 * z * z * 0.2, -0.012, z))), 10, 5, () => 0.003), M.lit('#b8aea6', { roughness: 0.6 })); g.add(mo); }
    /* the pelvic fins, small and rounded behind the disc; a little dorsal fin where the tail begins and two spines behind it */
    const finM = M.litP('#ffffff', { vertexColors: true, roughness: 0.45, clearcoat: 0.2 });
    for (const sd of [-1, 1]) g.add(new T.Mesh(M.foil(10, 14, s => ({ le: [-0.2 - 0.04 * s, -0.004, sd * (0.03 + 0.055 * s)], ch: [-0.075 * Math.sqrt(1 - 0.85 * s * s), 0, 0], up: [0, 1, 0], th: 0.14 }), (x, y, z, s, c, top) => top ? ink : belly), finM));
    g.add(new T.Mesh(M.foil(10, 14, s => ({ le: [-0.275 - 0.03 * s, 0.002 + 0.046 * s, 0], ch: [-0.052 * (1 - s) - 0.006, 0, 0], up: [0, 0, 1], th: 0.2 }), () => ink), finM));
    for (const k of [0, 1]) { const sp = new T.Mesh(new T.ConeGeometry(0.0035, 0.05, 6), M.lit('#3a3f44', { roughness: 0.45 })); sp.rotation.z = Math.PI / 2 + 0.12; sp.position.set(-0.36 - k * 0.028, 0.008 - k * 0.002, (k - 0.5) * 0.004); g.add(sp); }
    /* the tail: a long thin whip, dark above and paler beneath */
    const tailC = new T.CatmullRomCurve3([new T.Vector3(-0.22, 0.008, 0), new T.Vector3(-0.6, 0.0, 0.03), new T.Vector3(-1.1, -0.015, -0.04), new T.Vector3(-1.65, -0.03, 0.02), new T.Vector3(-2.2, -0.04, 0.0)]);
    const tailG = M.tube(tailC, 60, 6, t => 0.012 * Math.pow(1 - t, 1.3) + 0.0008); M.paint(tailG, (x, y) => mix(ink, lin('#5a6470'), sm(0.0, -0.01, y - (0.008 + 0.0242 * (x + 0.22)))));
    const tail = new T.Mesh(tailG, M.lit('#ffffff', { vertexColors: true, roughness: 0.5 })); g.add(tail);
    /* the beat: each point of the wings rises and falls a little after the one nearer the body, more the further out */
    const P0 = [topG, botG].map(gm => Float32Array.from(gm.attributes.position.array));
    g.userData.anim = t => {
      [topG, botG].forEach((gm, k) => {
        const P = gm.attributes.position.array, Q = P0[k];
        for (let i = 0; i < P.length; i += 3) { const az = Math.abs(Q[i + 2]), w = Math.pow(Math.max(0, az - 0.08) / 0.44, 1.3); P[i + 1] = Q[i + 1] + 0.16 * w * Math.sin(t * 2.4 - az * 3.2); }
        gm.attributes.position.needsUpdate = true; gm.computeVertexNormals();
      });
      tail.rotation.y = 0.1 * Math.sin(t * 1.2); tail.rotation.z = 0.04 * Math.sin(t * 2.4 - 1.0);
    };
    g.userData.anim(0);
    return g;
  });
})();
