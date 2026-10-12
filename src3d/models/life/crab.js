/* a ghost crab, for holding up and turning over: a squarish pale shell, domed and finely granular, with the grooves
   of its regions; tall stalked eyes; one claw bigger than the other; four pairs of long jointed walking legs.
   At the origin in metres, its front toward +x, its right side toward +z. userData.anim(t) keeps it alive in the
   hand: the legs reach and paddle, the eyes tilt, the big claw opens and closes */
Models.add('life/crab', (o = {}) => {
  const T = THREE, M = Models, g = new T.Group(), r = M.rng(o.seed || 7);
  const W = 0.022, Lh = 0.0175, H = 0.0088, CY = 0.0055;   /* the shell's half-width (z), half-length (x), half-height, centre */
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
  const SAND = lin('#cdb58a'), DUSK = lin('#9f845a'), PALE = lin('#e9dcc0'), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  /* ── the shell ── */
  /* (the grooves between its regions: an H across the middle of the back, and the cervical groove curving round it) */
  const grooves = (x, z) => {
    const ax = x / Lh, az = Math.abs(z) / W;
    const h1 = Math.exp(-(((az - 0.34) / 0.05) ** 2)) * Math.exp(-((ax / 0.5) ** 4));           /* the H's uprights */
    const h2 = Math.exp(-(((ax + 0.05) / 0.05) ** 2)) * Math.exp(-((az / 0.36) ** 6));           /* its crossbar */
    const cv = Math.exp(-(((ax - 0.42 + 0.5 * az * az) / 0.05) ** 2)) * (az < 0.8 ? 1 : 0);     /* the cervical groove */
    return Math.min(1, h1 + h2 * 0.8 + cv * 0.7);
  };
  const shell = M.loft([
    [-Lh, 0, 0, CY, 3], [-Lh + 0.0016, W * 0.6, H * 0.5, CY, 3.2], [-Lh * 0.55, W * 0.88, H * 0.88, CY, 3.6], [0, W * 0.97, H, CY, 3.9],
    [Lh * 0.55, W, H * 0.95, CY, 3.9], [Lh * 0.88, W * 0.98, H * 0.74, CY - 0.0003, 3.6], [Lh * 0.99, W * 0.9, H * 0.42, CY - 0.0006, 3], [Lh + 0.0006, 0, 0, CY - 0.0006, 3]
  ], 56, 72, (x, y, z, u, a) => {
    const top = y > CY, gr = top ? grooves(x, z) : 0, mott = M.fbm(x * 260, y * 260, z * 260, 3), gran = M.vn(x * 1400, y * 1400, z * 1400);
    let c = mix(SAND, DUSK, Math.max(0, (mott - 0.45) * 1.4) + 0.5 * gr);
    if (!top) c = mix(c, PALE, 0.6);
    /* the mouthparts, a dark square plate under the front between the claws */
    if (!top && x > Lh * 0.45 && Math.abs(z) < W * 0.32) c = mix(c, lin('#8a7354'), 0.55);
    return c.map(v => v * (0.94 + 0.12 * gran));
  }, { shape: (x, y, z) => {
    /* domed above, flatter beneath; the grooves pressed in, and a fine granulation all over */
    let yy = y > CY ? CY + (y - CY) * 1.05 : CY + (y - CY) * 0.55;
    if (y > CY) yy -= 0.00045 * grooves(x, z);
    const gr = M.vn(x * 1300, y * 1300, z * 1300) - 0.5;
    return [x, yy + gr * 0.00012, z * (1 + gr * 0.004)];
  } });
  const shellM = M.lit('#ffffff', { vertexColors: true, roughness: 0.62 });
  g.add(new T.Mesh(shell, shellM));

  /* ── legs and claws: chains of joints, each segment along its joint's +x ── */
  const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.58 });
  function seg(len, r0, r1, flat = 0.55, tip = false) {
    const geo = new T.CylinderGeometry(r1, r0, len, 12, 6, false); geo.rotateZ(-Math.PI / 2); geo.translate(len / 2, 0, 0); geo.scale(1, 1, flat);
    /* (tapered to a point, for the last segment of a leg) */
    if (tip) { const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const t = P.getX(i) / len, k = Math.pow(Math.max(0, 1 - t), 0.8); P.setY(i, P.getY(i) * (0.25 + 0.75 * k)); P.setZ(i, P.getZ(i) * (0.25 + 0.75 * k)); } geo.computeVertexNormals(); }
    return M.paint(geo, (x, y) => { const t = x / len, band = Math.exp(-(((t - 0.02) / 0.12) ** 2)) + Math.exp(-(((t - 0.98) / 0.12) ** 2)), up = y > 0 ? 1 : 0;
      return mix(mix(SAND, DUSK, 0.35 * band + 0.15 * up), tip ? lin('#7a6040') : SAND, tip ? Math.pow(t, 3) : 0); });
  }
  function chain(parent, at, parts) {
    let p = parent; const J = [];
    parts.forEach(([geo, len, ry, rz, rx = 0, kr = 0.002], i) => {
      const j = new T.Object3D(); j.rotation.order = 'YXZ'; j.rotation.set(rx, ry, rz);
      if (i === 0) j.position.set(...at); else j.position.x = parts[i - 1][1];
      j.add(new T.Mesh(geo, legM));
      /* (a knuckle at each joint) */
      if (i) { const kn = new T.Mesh(M.paint(new T.SphereGeometry(kr, 10, 8), () => DUSK), legM); kn.scale.set(1, 1, 0.65); j.add(kn); }
      p.add(j); J.push(j); p = j;
    });
    return J;
  }
  const legs = [];
  const LEG = [[0.0095, 0.78, 1.0], [0.0025, 0.32, 1.12], [-0.0045, -0.12, 1.1], [-0.0115, -0.62, 0.95]];   /* where along the side, which way out, how long */
  for (const sd of [1, -1]) LEG.forEach(([x, phi, k], i) => {
    const yaw = sd > 0 ? phi - Math.PI / 2 : Math.PI / 2 - phi;
    const J = chain(g, [x, CY - 0.0015, sd * W * 0.93], [
      [seg(0.019 * k, 0.0038, 0.0033, 0.45), 0.019 * k, yaw, 0.42, sd * 0.25],
      [seg(0.0065 * k, 0.0031, 0.0028, 0.55), 0.0065 * k, 0, -0.6, 0, 0.0031],
      [seg(0.0125 * k, 0.0028, 0.0021, 0.55), 0.0125 * k, 0, -0.5, 0, 0.0028],
      [seg(0.0105 * k, 0.002, 0.0005, 0.6, true), 0.0105 * k, 0, -0.45, 0, 0.0021]]);
    legs.push({ J, sd, i, base: J.map(j => j.rotation.z), yaw });
  });
  /* the claws: held folded in front of the mouth, the right one the bigger */
  const clawM = M.lit('#ffffff', { vertexColors: true, roughness: 0.42 });
  const claws = [];
  for (const sd of [1, -1]) {
    const big = sd > 0, k = big ? 1.15 : 0.72;
    const J = chain(g, [Lh * 0.82, CY - 0.002, sd * W * 0.62], [
      [seg(0.013 * k + 0.003, 0.0032 * k + 0.0008, 0.003 * k + 0.0007, 0.75), 0.013 * k + 0.003, -sd * 0.55, -0.25, 0],
      [seg(0.006 * k + 0.002, 0.003 * k + 0.0007, 0.0034 * k + 0.0006, 0.8), 0.006 * k + 0.002, sd * 1.25, 0.1, 0, 0.0034 * k + 0.0007]]);
    /* the palm, swollen, with the fixed finger running on from it and the movable one hinged above */
    const L = 0.017 * k, Hh = 0.0078 * k, Th = 0.0048 * k, hand = new T.Object3D(); hand.position.x = 0.006 * k + 0.002; hand.rotation.y = sd * 0.35; J[1].add(hand);
    const palm = M.loft([[0, 0.002 * k, 0.003 * k, 0, 2], [L * 0.15, Th, Hh * 0.9, 0, 2.3], [L * 0.6, Th * 1.05, Hh, 0, 2.5], [L * 0.92, Th * 0.8, Hh * 0.8, -0.001 * k, 2.4], [L, 0, 0, -0.0015 * k, 2]], 28, 28,
      (x, y) => { const t = x / L; return mix(mix(PALE, SAND, 0.5 + 0.3 * (y > 0 ? 1 : 0)), lin('#c9a7b5'), big ? 0.25 * Math.max(0, -y / Hh) : 0).map(v => v * (0.95 + 0.1 * M.vn(x * 900, y * 900, 3))); });
    hand.add(new T.Mesh(palm, clawM));
    const finger = (len, rr, up) => { const geo = new T.ConeGeometry(rr, len, 10, 6); geo.rotateZ(-Math.PI / 2); geo.translate(len / 2, 0, 0);
      const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const t = P.getX(i) / len; P.setY(i, P.getY(i) + (up ? -1 : 1) * 0.35 * len * t * t); } geo.scale(1, 1, 0.7); geo.computeVertexNormals();
      return M.paint(geo, x => mix(PALE, lin('#fbf6ee'), x / len)); };
    const fixed = new T.Mesh(finger(0.011 * k, 0.0022 * k, true), clawM); fixed.position.set(L * 0.9, -Hh * 0.45, 0); fixed.rotation.z = -0.12; hand.add(fixed);
    const dact = new T.Object3D(); dact.position.set(L * 0.86, Hh * 0.35, 0); hand.add(dact);
    const df = new T.Mesh(finger(0.0125 * k, 0.0021 * k, true), clawM); dact.add(df);
    claws.push({ J, dact, big });
  }
  /* the eyes: tall stalks from the front corners, each topped by a long dark eye with a pale band below it */
  const eyeM = M.litP('#1b1d20', { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 });
  const stalkM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5 });
  const eyes = [];
  for (const sd of [1, -1]) {
    const e = new T.Object3D(); e.position.set(Lh * 0.96, CY + H * 0.45, sd * W * 0.52); e.rotation.order = 'YXZ'; e.rotation.set(sd * 0.32, 0, -0.28); g.add(e);
    const st = M.paint(new T.CylinderGeometry(0.0019, 0.0023, 0.012, 12, 4), (x, y) => mix(SAND, PALE, (y + 0.006) / 0.012)); st.translate(0, 0.006, 0); e.add(new T.Mesh(st, stalkM));
    /* the eye wraps round the stalk's end, long and dark, a pale cap above it */
    const ball = new T.SphereGeometry(1, 24, 18); ball.scale(0.0033, 0.0068, 0.0033); const em = new T.Mesh(ball, eyeM); em.position.y = 0.0118; e.add(em);
    const cap = new T.SphereGeometry(0.0022, 12, 8); const cm = new T.Mesh(M.paint(cap, () => PALE), stalkM); cm.position.y = 0.0182; cm.scale.set(1, 0.8, 1); e.add(cm);
    const band = new T.Mesh(M.paint(new T.TorusGeometry(0.0026, 0.0007, 8, 18), () => DUSK), stalkM); band.rotation.x = Math.PI / 2; band.position.y = 0.0062; e.add(band);
    eyes.push({ e, sd, z0: e.rotation.z, x0: e.rotation.x });
  }
  g.userData.anim = t => {
    for (const L of legs) {
      const ph = t * 2.1 + L.i * 1.3 + (L.sd > 0 ? 0 : 2.2), w = Math.sin(ph);
      L.J[0].rotation.y = L.yaw + 0.12 * Math.sin(t * 1.3 + L.i * 0.9) * L.sd;
      L.J[0].rotation.z = L.base[0] + 0.12 * w; L.J[1].rotation.z = L.base[1] - 0.1 * w; L.J[2].rotation.z = L.base[2] + 0.12 * Math.sin(ph + 0.6); L.J[3].rotation.z = L.base[3] + 0.15 * Math.sin(ph + 1.1);
    }
    for (const c of claws) c.dact.rotation.z = (c.big ? 0.05 : 0.02) + (c.big ? 0.32 : 0.18) * Math.max(0, Math.sin(t * 1.1 + (c.big ? 0 : 2))) ** 2;
    for (const e of eyes) { e.e.rotation.z = e.z0 + 0.12 * Math.sin(t * 0.7 + e.sd); e.e.rotation.x = e.x0 + 0.08 * Math.sin(t * 0.9 + e.sd * 2); }
  };
  g.userData.anim(0);
  return g;
});
