/* a ghost crab, for holding up and turning over: a squarish pale shell, domed and finely granular, with the grooves
   of its regions; tall stalked eyes; one claw bigger than the other; four pairs of long jointed walking legs.
   At the origin in metres, its front toward +x, its right side toward +z. userData.anim(t) keeps it alive in the
   hand: the legs reach and paddle, the eyes tilt, the big claw opens and closes */
Models.add('life/crab', (o = {}) => {
  const lite = !!o.lite;      /* (fewer facets, the shell painted vertex by vertex: the crabs out on the sand, many at once) */
  const T = THREE, M = Models, g = new T.Group(), r = M.rng(o.seed || 7);
  const W = 0.022, Lh = 0.0175, H = 0.0088, CY = 0.0055;   /* the shell's half-width (z), half-length (x), half-height, centre */
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
  const SAND = lin('#d6c497'), DUSK = lin('#9c8460'), PALE = lin('#efe5cf'), SPECK = lin('#6a5638'), LILAC = lin('#d8c3d2'), mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ── the shell ── */
  /* (the grooves between its regions: an H across the middle of the back, and the cervical groove curving round it) */
  const grooves = (x, z) => {
    const ax = x / Lh, az = Math.abs(z) / W;
    const h1 = Math.exp(-(((az - 0.34) / 0.05) ** 2)) * Math.exp(-((ax / 0.5) ** 4));           /* the H's uprights */
    const h2 = Math.exp(-(((ax + 0.05) / 0.05) ** 2)) * Math.exp(-((az / 0.36) ** 6));           /* its crossbar */
    const cv = Math.exp(-(((ax - 0.42 + 0.5 * az * az) / 0.05) ** 2)) * (az < 0.8 ? 1 : 0);     /* the cervical groove */
    return Math.min(1, h1 + h2 * 0.8 + cv * 0.7);
  };
  const SECS = [[-Lh, 0, 0, CY, 3], [-Lh + 0.0016, W * 0.6, H * 0.5, CY, 3.2], [-Lh * 0.55, W * 0.88, H * 0.88, CY, 3.6], [0, W * 0.97, H, CY, 3.9],
    [Lh * 0.55, W, H * 0.95, CY, 3.9], [Lh * 0.88, W * 0.98, H * 0.74, CY - 0.0003, 3.6], [Lh * 0.99, W * 0.9, H * 0.42, CY - 0.0006, 3], [Lh + 0.0006, 0, 0, CY - 0.0006, 3]];
  const prof = M.spline(SECS.map(r => [r[0], r[1], r[2], r[3], r[4]]));
  /* its colour, painted on a picture of the whole shell, each texel worked back to where on the shell it lies: sand
     mottled paler and darker, freckled with fine dark specks, the grooves darker, the front edge pale; beneath, paler,
     the mouthparts a darker square between the claws */
  const shellCol = (x, z, top) => {
    const mott = M.fbm(x * 260, z * 260, 3, 3), gr = top ? grooves(x, z) : 0;
    let c = mix(SAND, DUSK, Math.max(0, (mott - 0.42) * 1.5) + 0.55 * gr);
    if (top) { const sp = M.vn(x * 5200, z * 5200, 4.2); if (sp > 0.74) c = mix(c, SPECK, 0.7 * sm(0.74, 0.86, sp)); c = mix(c, PALE, 0.35 * sm(Lh * 0.82, Lh * 0.98, x)); }
    else { c = mix(c, PALE, 0.65); if (x > Lh * 0.45 && Math.abs(z) < W * 0.32) c = mix(c, lin('#8a7354'), 0.5); }
    return c.map(v => v * (0.95 + 0.1 * M.vn(x * 1400, z * 1400, 7.7)));
  };
  /* (painted once, kept for every crab after) */
  const shellTex = lite ? null : Models.__crabTex || (Models.__crabTex = M.texFrom(512, 512, (u, v) => {
    const x = SECS[0][0] + u * (SECS[SECS.length - 1][0] - SECS[0][0]), a = Math.PI + v * Math.PI * 2, [w, , , sq] = prof(x), sa = Math.sin(a), z = Math.max(0, w) * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / sq);
    return shellCol(x, z, Math.cos(a) > 0);
  }));
  const shell = M.loft(SECS, lite ? 18 : 56, lite ? 22 : 72, lite ? (x, y, z) => shellCol(x, z, y > CY) : null, { shape: (x, y, z) => {
    /* domed above, flatter beneath; the grooves pressed in, and a fine granulation all over */
    let yy = y > CY ? CY + (y - CY) * 1.05 : CY + (y - CY) * 0.55;
    if (y > CY) yy -= 0.00045 * grooves(x, z);
    const gr = M.vn(x * 1300, y * 1300, z * 1300) - 0.5;
    return [x, yy + gr * 0.00012, z * (1 + gr * 0.004)];
  } });
  const shellM = lite ? M.lit('#ffffff', { vertexColors: true, roughness: 0.6 }) : M.litP('#ffffff', { map: shellTex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  g.add(new T.Mesh(shell, shellM));

  /* ── legs and claws: chains of joints, each segment along its joint's +x ── */
  const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.58 });
  function seg(len, r0, r1, flat = 0.55, tip = false) {
    const geo = new T.CylinderGeometry(r1, r0, len, lite ? 5 : 12, lite ? 2 : 6, false); geo.rotateZ(-Math.PI / 2); geo.translate(len / 2, 0, 0); geo.scale(1, 1, flat);
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
      if (i) { const kn = new T.Mesh(M.paint(new T.SphereGeometry(kr, lite ? 5 : 10, lite ? 4 : 8), () => DUSK), legM); kn.scale.set(1, 1, 0.65); j.add(kn); }
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
  const clawM = M.litP('#ffffff', { vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const claws = [];
  for (const sd of [1, -1]) {
    const big = sd > 0, k = big ? 1.15 : 0.72;
    const J = chain(g, [Lh * 0.82, CY - 0.002, sd * W * 0.62], [
      [seg(0.013 * k + 0.003, 0.0032 * k + 0.0008, 0.003 * k + 0.0007, 0.75), 0.013 * k + 0.003, -sd * 0.55, -0.25, 0],
      [seg(0.006 * k + 0.002, 0.003 * k + 0.0007, 0.0034 * k + 0.0006, 0.8), 0.006 * k + 0.002, sd * 1.25, 0.1, 0, 0.0034 * k + 0.0007]]);
    /* the hand: the palm swollen and granular, white flushed lilac (the big one more so); the fixed finger running on
       from its lower edge, the movable one hinged above, both stout and toothed along the edges that meet, their tips
       brown */
    const L = 0.016 * k, Hh = 0.0082 * k, Th = 0.0046 * k, hand = new T.Object3D(); hand.position.x = (0.006 * k + 0.002) * 0.92; hand.rotation.y = sd * 0.35; J[1].add(hand);
    const gran = (x, y, z) => M.vn(x * 2400 + sd * 9, y * 2400, z * 2400);
    const palm = M.loft([[0, 0.0022 * k, 0.003 * k, 0, 2], [L * 0.15, Th * 0.92, Hh * 0.86, 0, 2.3], [L * 0.6, Th, Hh, 0, 2.5], [L * 0.9, Th * 0.82, Hh * 0.8, -0.001 * k, 2.4], [L, Th * 0.45, Hh * 0.45, -0.0018 * k, 2.1]], lite ? 8 : 32, lite ? 8 : 32,
      (x, y, z) => { const gg = gran(x, y, z); let c = mix(PALE, LILAC, (big ? 0.55 : 0.3) * sm(-Hh * 0.6, Hh * 0.4, -y)); c = mix(c, SAND, 0.25 * sm(0, Hh, y)); if (gg > 0.72) c = mix(c, lin('#fbf7ef'), 0.6); return c.map(v => v * (0.95 + 0.08 * M.vn(x * 900, y * 900, 3))); },
      { shape: (x, y, z) => { const gg = gran(x, y, z), b = gg > 0.72 ? 0.00022 * sm(0.72, 0.85, gg) : 0, l = Math.hypot(y, z) || 1; return [x, y + y / l * b, z + z / l * b]; } });
    hand.add(new T.Mesh(palm, clawM));
    const finger = (len, rr, dn) => M.loft([[0, rr * 0.8, rr, 0, 2.2], [len * 0.45, rr * 0.72, rr * 0.88, 0, 2.2], [len * 0.85, rr * 0.38, rr * 0.42, 0, 2], [len, rr * 0.08, rr * 0.08, 0, 2]], lite ? 4 : 14, lite ? 5 : 14,
      (x) => mix(PALE, lin('#5a4630'), sm(0.6, 0.95, x / len)),
      { shape: (x, y, z) => { const t = x / len, teeth = y * dn > 0 ? 0 : 0.0003 * Math.max(0, Math.sin(t * 20)) * (1 - t); return [x, y + dn * 0.3 * len * t * t + dn * teeth, z]; } });
    const fixed = new T.Mesh(finger(0.0085 * k, 0.0023 * k, 1), clawM); fixed.position.set(L * 0.9, -Hh * 0.42, 0); fixed.rotation.z = -0.1; hand.add(fixed);
    const dact = new T.Object3D(); dact.position.set(L * 0.85, Hh * 0.32, 0); hand.add(dact);
    dact.add(new T.Mesh(finger(0.0095 * k, 0.0021 * k, -1), clawM));
    claws.push({ J, dact, big });
  }
  /* the eyes: tall stalks from the front corners, each topped by a long dark eye with a pale band below it */
  const eyeM = M.litP('#ffffff', { vertexColors: true, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const stalkM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5 });
  const eyes = [];
  for (const sd of [1, -1]) {
    const e = new T.Object3D(); e.position.set(Lh * 0.96, CY + H * 0.45, sd * W * 0.52); e.rotation.order = 'YXZ'; e.rotation.set(sd * 0.32, 0, -0.28); g.add(e);
    const st = M.paint(new T.CylinderGeometry(0.0019, 0.0023, 0.012, lite ? 6 : 12, lite ? 1 : 4), (x, y) => mix(SAND, PALE, (y + 0.006) / 0.012)); st.translate(0, 0.006, 0); e.add(new T.Mesh(st, stalkM));
    /* the eye: the cornea swells round the stalk's end, long and dark (club-shaped, bigger on its outer side), and above
       it a short pale horn, the style */
    const ball = M.paint(new T.SphereGeometry(1, lite ? 8 : 28, lite ? 6 : 20), (x, y, z) => { const f = 0.8 + 0.2 * Math.abs(Math.sin(x * 9e3) * Math.sin(y * 9e3 + 1) * Math.sin(z * 9e3 + 2)); return [0.06 * f, 0.055 * f, 0.05 * f]; });
    ball.scale(0.0036, 0.0074, 0.0034); const em = new T.Mesh(ball, eyeM); em.position.set(0, 0.0112, sd * 0.0005); e.add(em);
    const sty = M.paint(new T.ConeGeometry(0.0014, 0.0048, 10, 3), (x, y) => mix(PALE, SAND, 0.4 + (y + 0.0024) * 120)); sty.translate(0, 0.0024, 0);
    const cm = new T.Mesh(sty, stalkM); cm.position.y = 0.0176; e.add(cm);
    const band = new T.Mesh(M.paint(new T.TorusGeometry(0.0026, 0.0007, 8, 18), () => DUSK), stalkM); band.rotation.x = Math.PI / 2; band.position.y = 0.0058; e.add(band);
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
  /* for drawing many (fauna.js): one geometry, its colours as aCol and, as aW, what each point belongs to (0 the shell,
     [1, side, leg, how far out along it] a leg, [2, side] a claw, [3, side] an eye), the feet set on the sand; and where
     the legs join the body there */
  if (o.parts) {
    const W_ = W;
    g.updateMatrixWorld(true);
    const parts = [], tag = new Map();
    legs.forEach(L => L.J[0].traverse(m => { if (m.isMesh) tag.set(m, { leg: L }); }));
    claws.forEach(c => c.J[0].traverse(m => { if (m.isMesh) tag.set(m, { w: [2, c.big ? 1 : -1, 0, 0] }); }));
    eyes.forEach(e => e.e.traverse(m => { if (m.isMesh) tag.set(m, { w: [3, e.sd, 0, 0] }); }));
    const v = new T.Vector3(); let minY = 1e9;
    g.traverse(m => { if (!m.isMesh) return; const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); minY = Math.min(minY, v.y); } });
    const hipY = CY - 0.0015 - minY, LEGLEN = 0.05;
    g.traverse(m => {
      if (!m.isMesh) return;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); geo.translate(0, -minY, 0);
      const P = geo.attributes.position, W = new Float32Array(P.count * 4), t = tag.get(m);
      for (let i = 0; i < P.count; i++) {
        if (t && t.leg) { const L = t.leg, hx = LEG[L.i][0], d = Math.hypot(P.getX(i) - hx, P.getY(i) - hipY, P.getZ(i) - L.sd * W_ * 0.93); W.set([1, L.sd, L.i, Math.min(1, d / LEGLEN)], i * 4); }
        else if (t) W.set(t.w, i * 4);
      }
      geo.setAttribute('aW', new T.BufferAttribute(W, 4));
      const c = geo.attributes.color ? [1, 1, 1] : m.material.color.toArray();
      parts.push({ geo, c, W });
    });
    /* (merged: colours as mergeC makes them, the tags carried alongside) */
    const merged = M.mergeC(parts.map(p => ({ geo: p.geo, c: p.c }))), Wall = new Float32Array(merged.attributes.position.count * 4);
    let o4 = 0; for (const p of parts) { Wall.set(p.W, o4); o4 += p.W.length; }
    merged.setAttribute('aW', new T.BufferAttribute(Wall, 4)); merged.setAttribute('aCol', merged.attributes.color); merged.deleteAttribute('color');
    g.userData.parts = { geo: merged, hip: { hx: LEG[0][0], hs: LEG[0][0] - LEG[1][0], hy: hipY, hz: W_ * 0.93 } };
  }
  return g;
});
