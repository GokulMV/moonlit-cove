/* ─────────────────────────────────────────────────────────────
   models/struct/trail.js — what is built along the island's trails.
   struct/platform   the viewing tower on the summit: four posts
                     braced in X, a deck at o.h, a railing round it,
                     a shade roof of green iron; stairs up in two
                     flights with a landing between
   struct/boardwalk  the walk through the mangroves: along o.path
                     ([x, z] points), a pair of small round piles
                     every 2.4 m driven into the mud, a crossbeam,
                     two stringers, boards across, a railing each
                     side; the piles dark and wet at their feet
   struct/steps      log steps up a trail's slope: half-logs laid
                     across, each held by two stakes, earth packed
                     behind (o.ground draws it), a rail on posts
   struct/signpost   a post with arrow boards, carved and painted
   struct/mapboard   a map of the island under a little roof
   struct/bench      a bench of thick boards on posts
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, S = () => StructKit, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const mk = (R, B) => { const tone = () => { const k = 0.84 + 0.28 * R(); return [k, k, k * (0.97 + 0.05 * R())]; }; return (kind, a, b, th, w, extra = {}) => S().boardAB(B, kind, a, b, th, w, Object.assign({ tone: tone(), u0: R() * 4, v0: R() * 4 }, extra)); };
  /* a green-iron gable roof over [x0, x1] × [z0, z1], its ridge along x, its eaves at y0 */
  function shadeRoof(B, R, bd, x0, x1, z0, z1, y0, pitch = 0.38, ov = 0.3) {
    const K = S(), zc = (z0 + z1) / 2, hz = (z1 - z0) / 2 + ov, tp = Math.tan(pitch), ridge = y0 + hz * tp, yr = z => ridge - Math.abs(z - zc) * tp;
    for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 2) for (const sd of [-1, 1]) bd('timber', V(x, yr(zc + sd * hz) - 0.04, zc + sd * hz), V(x, ridge - 0.04, zc), 0.12, 0.05);
    bd('timber', V(x0 - ov, ridge - 0.02, zc), V(x1 + ov, ridge - 0.02, zc), 0.14, 0.04);
    const L = hz / Math.cos(pitch) + 0.06, W = x1 - x0 + 2 * ov, n = Math.ceil(W / 0.72);
    for (const sd of [-1, 1]) for (let k = 0; k < n; k++) { const cx = x0 - ov + (k + 0.5) * W / n, z = zc + sd * hz / 2, m = new T.Matrix4().makeRotationX(sd * pitch); m.premultiply(new T.Matrix4().makeTranslation(cx, yr(z) + 0.06 + 0.003 * (k % 2), z)); B.add('zincGreen', K.corrugated(W / n + 0.05, L, { kind: 'zincGreen', u0: R() * 3, v0: R() * 3 }), m, { metal: 0.35 }); }
    for (const sd of [-1, 1]) { const m = new T.Matrix4().makeRotationX(sd * pitch * 0.9); m.premultiply(new T.Matrix4().makeTranslation((x0 + x1) / 2, ridge + 0.09, zc + sd * 0.1)); B.add('zincGreen', K.corrugated(W, 0.24, { kind: 'zincGreen', pitch: 0.2, depth: 0.004 }), m, { metal: 0.35 }); }
    return ridge;
  }
  /* a railing between two points at deck height y: posts at its ends (and every `every` m), a handrail, a mid rail */
  function railing(bd, a, b, y, every = 1.5) {
    const L = a.distanceTo(b), n = Math.max(1, Math.round(L / every));
    for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); bd('timber', V(p.x, y - 0.2, p.z), V(p.x, y + 1.02, p.z), 0.09, 0.09); }
    bd('timber', V(a.x, y + 1.05, a.z), V(b.x, y + 1.05, b.z), 0.05, 0.13); bd('timber', V(a.x, y + 0.55, a.z), V(b.x, y + 0.55, b.z), 0.09, 0.04);
  }

  Models.add('struct/platform', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 127 + 5), B = K.Builder(), bd = mk(R, B);
    const h = o.h ?? 4.2, A = 2.0, pT = 0.04;
    /* (posts on concrete pads; X bracing on all four faces, two tiers; the deck's bearers and joists; the boards) */
    const corners = [[-A, -A], [A, -A], [A, A], [-A, A]];
    for (const [x, z] of corners) { B.add('concrete', K.board(0.5, 0.3, 0.5, { kind: 'concrete', round: 0.02 }), K.M(x, 0.1, z)); bd('timber', V(x, 0.25, z), V(x, h + 2.2, z), 0.2, 0.2); }
    for (let k = 0; k < 4; k++) { const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4], n = V(x1 - x0, 0, z1 - z0).normalize(), out = V(n.z, 0, -n.x);
      for (const [ya, yb] of [[0.5, h / 2], [h / 2, h - 0.25]]) { bd('timber', V(x0, ya, z0).addScaledVector(out, 0.13), V(x1, yb, z1).addScaledVector(out, 0.13), 0.05, 0.16, { up: out }); bd('timber', V(x0, yb, z0).addScaledVector(out, 0.13), V(x1, ya, z1).addScaledVector(out, 0.13), 0.05, 0.16, { up: out }); }
      bd('timber', V(x0, h - 0.12, z0).addScaledVector(out, 0.15), V(x1, h - 0.12, z1).addScaledVector(out, 0.15), 0.2, 0.08, { up: V(0, 1, 0) }); }
    for (let x = -A + 0.1; x <= A - 0.1 + 1e-6; x += (2 * A - 0.2) / 6) bd('timber', V(x, h - pT - 0.07, -A - 0.1), V(x, h - pT - 0.07, A + 0.1), 0.14, 0.05);
    for (let z = -A - 0.12; z < A + 0.12; z += 0.155) bd(R() < 0.05 ? 'timberNew' : 'timber', V(-A - 0.14, h - pT / 2, z + 0.07), V(A + 0.14, h - pT / 2, z + 0.07), pT, 0.14);
    /* (the railing round the deck, open where the stairs arrive) */
    const sw = 0.95;
    railing(bd, V(-A - 0.1, 0, -A - 0.1), V(A + 0.1, 0, -A - 0.1), h); railing(bd, V(A + 0.1, 0, -A - 0.1), V(A + 0.1, 0, A + 0.1), h); railing(bd, V(-A - 0.1, 0, A + 0.1), V(A + 0.1, 0, A + 0.1), h);
    railing(bd, V(-A - 0.1, 0, -A - 0.1), V(-A - 0.1, 0, A + 0.1 - sw - 0.1), h);
    /* (stairs on the -x side: a flight up along +z... from the ground at z = -A to a landing at half height, then back) */
    const flight = (x, z0, z1, y0, y1) => { const n = Math.round((y1 - y0) / 0.18), run = (z1 - z0) / n, rise = (y1 - y0) / n;
      for (const dx of [-sw / 2, sw / 2]) bd('timber', V(x + dx, y1, z1), V(x + dx, y0, z0), 0.24, 0.05, { up: V(0, 1, 0) });
      for (let k = 1; k < n; k++) bd(R() < 0.1 ? 'timberNew' : 'timber', V(x - sw / 2, y0 + k * rise, z0 + (k - 0.5) * run), V(x + sw / 2, y0 + k * rise, z0 + (k - 0.5) * run), 0.04, Math.abs(run) + 0.03);
      bd('timber', V(x - sw / 2 - 0.03, y1 + 0.92, z1), V(x - sw / 2 - 0.03, y0 + 0.92, z0), 0.05, 0.1);
      for (const t of [0, 1]) { const zz = t ? z1 : z0, yy = t ? y1 : y0; bd('timber', V(x - sw / 2 - 0.03, yy, zz), V(x - sw / 2 - 0.03, yy + 0.92, zz), 0.07, 0.07); } };
    /* (the upper flight along the tower's -x face, from the landing up to the deck's opening; the lower one outside it,
       from the ground back to the landing) */
    const sx = -A - 0.1 - sw / 2 - 0.05, ym = h / 2;
    flight(sx, -A - 0.1, A - 0.4, ym, h); flight(sx - sw - 0.05, A + 1.0, -A - 0.1, 0, ym);
    /* (the landing between the flights, on its own posts) */
    for (const x of [sx - sw * 1.5 - 0.05, sx + sw / 2]) for (const z of [-A - 1.0, -A - 0.1]) bd('timber', V(x, 0, z), V(x, ym, z), 0.14, 0.14);
    for (let z = -A - 1.02; z < -A - 0.12; z += 0.155) bd('timber', V(sx - sw * 1.5 - 0.1, ym - 0.02, z + 0.07), V(sx + sw / 2 + 0.05, ym - 0.02, z + 0.07), 0.04, 0.14);
    railing(bd, V(sx - sw * 1.5 - 0.12, 0, -A - 1.05), V(sx + sw / 2 + 0.05, 0, -A - 1.05), ym);
    /* (the roof on the posts) */
    shadeRoof(B, R, bd, -A, A, -A, A, h + 2.25);
    for (const x of [-A, A]) bd('timber', V(x, h + 2.1, -A - 0.15), V(x, h + 2.1, A + 0.15), 0.18, 0.1);
    B.build(g); g.userData.info = { deck: h };
    return g;
  });

  Models.add('struct/boardwalk', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 131 + 9), B = K.Builder(), bd = mk(R, B);
    const path = (o.path || [[0, 0], [8, 1.5], [16, 0.5], [24, -2], [30, -1]]).map(([x, z]) => V(x, 0, z)), curve = new T.CatmullRomCurve3(path), L = curve.getLength();
    const h = o.h ?? 1.0, W = o.width ?? 1.2, step = 2.4, nb = Math.max(1, Math.round(L / step)), pT = 0.035;
    const frames = []; for (let k = 0; k <= nb; k++) { const t = k / nb, p = curve.getPointAt(t), d = curve.getTangentAt(t); d.y = 0; d.normalize(); frames.push({ p, d, n: V(-d.z, 0, d.x) }); }
    for (const { p, n } of frames) {
      for (const s of [-1, 1]) { const q = p.clone().addScaledVector(n, s * (W / 2 - 0.06)), m = K.M(q.x, 0, q.z, R() * TAU, (R() - 0.5) * 0.02, (R() - 0.5) * 0.02), seed = Math.floor(R() * 999);
        B.add('slime', K.pile(0.075, -0.9, 0.18, { seed, radial: 10 }), m); B.add('pile', K.pile(0.075, 0.18, h - 0.2, { seed, radial: 10 }), m); }
      bd('timber', p.clone().addScaledVector(n, -W / 2 - 0.12).setY(h - 0.27), p.clone().addScaledVector(n, W / 2 + 0.12).setY(h - 0.27), 0.14, 0.1);
    }
    for (let k = 0; k < nb; k++) { const A = frames[k], Bq = frames[k + 1];
      for (const s of [-0.38, 0.38]) bd('timber', A.p.clone().addScaledVector(A.n, s * W).setY(h - 0.13), Bq.p.clone().addScaledVector(Bq.n, s * W).setY(h - 0.13), 0.14, 0.06);
      /* (the boards across, each square to the path where it lies) */
      for (let s = 0.02; s < step - 0.08; s += 0.152) { const t = (k + s / step) / nb, p = curve.getPointAt(t), d = curve.getTangentAt(t); d.y = 0; d.normalize(); const n = V(-d.z, 0, d.x);
        bd(R() < 0.05 ? 'timberNew' : 'timber', p.clone().addScaledVector(n, -W / 2 - 0.03).setY(h - pT / 2), p.clone().addScaledVector(n, W / 2 + 0.03).setY(h - pT / 2 + (R() - 0.5) * 0.003), pT, 0.14); }
      /* (a railing each side, a post at each bent) */
      for (const s of [-1, 1]) { const a = A.p.clone().addScaledVector(A.n, s * (W / 2 + 0.07)), b = Bq.p.clone().addScaledVector(Bq.n, s * (W / 2 + 0.07));
        bd('timber', V(a.x, h - 0.25, a.z), V(a.x, h + 0.92, a.z), 0.08, 0.08); bd('timber', V(a.x, h + 0.95, a.z), V(b.x, h + 0.95, b.z), 0.05, 0.12); bd('timber', V(a.x, h + 0.48, a.z), V(b.x, h + 0.48, b.z), 0.08, 0.035); }
    }
    for (const s of [-1, 1]) { const a = frames[nb].p.clone().addScaledVector(frames[nb].n, s * (W / 2 + 0.07)); bd('timber', V(a.x, h - 0.25, a.z), V(a.x, h + 0.92, a.z), 0.08, 0.08); }
    B.build(g); g.userData.info = { len: L, deck: h };
    return g;
  });

  Models.add('struct/steps', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 137 + 11), B = K.Builder(), bd = mk(R, B);
    const n = o.n ?? 10, rise = o.rise ?? 0.17, run = o.run ?? 0.4, W = o.width ?? 1.1;
    for (let k = 0; k < n; k++) {
      const y = k * rise, x = k * run, r = 0.085 + 0.015 * R();
      /* (the log: a half-round, its flat face back against the earth; bark gone, weathered) */
      const log = K.pile(r, -W / 2 - 0.05 * R(), W / 2 + 0.05 * R(), { seed: Math.floor(R() * 99), radial: 12, dy: 0.3 });
      /* (its flat face uphill, against the earth it holds; the stakes in front of it, downhill) */
      const P = log.attributes.position.array; for (let i = 0; i < P.length; i += 3) P[i] = Math.min(P[i], r * 0.15);
      log.computeVertexNormals(); FloraKit.faceOut(log, (px, py, pz, nx, ny, nz) => px * nx + pz * nz);
      const m = new T.Matrix4().makeRotationX(Math.PI / 2); m.premultiply(K.M(x, y + r * 0.95, 0, 0, (R() - 0.5) * 0.04)); B.add('pile', log, m);
      for (const zz of [-W / 2 + 0.15, W / 2 - 0.15]) B.add('pile', K.pile(0.035, y - 0.3, y + rise + 0.05, { seed: k * 7 + 3, radial: 8 }), K.M(x - r - 0.03, 0, zz));
      /* (the tread: the packed earth behind the log, a little sloped, as walked) */
      if (o.ground) B.add('soilStep', K.board(run + 0.02, 0.06, W + 0.1, { kind: 'soilStep', round: 0.02 }), new T.Matrix4().makeRotationZ(Math.atan2(rise * 0.25, run)).premultiply(K.M(x + run / 2, y + rise - 0.02, 0)));
    }
    /* (a rail up one side on posts) */
    const top = V(n * run + 0.3, n * rise, -W / 2 - 0.25), bot = V(0.2, 0, -W / 2 - 0.25);
    for (let k = 0; k <= Math.ceil(n * run / 1.6); k++) { const p = bot.clone().lerp(top, k / Math.ceil(n * run / 1.6)); bd('timber', V(p.x, p.y - 0.3, p.z), V(p.x, p.y + 0.95, p.z), 0.08, 0.08); }
    bd('timber', bot.clone().add(V(0, 0.95, 0)), top.clone().add(V(0, 0.95, 0)), 0.05, 0.11);
    B.build(g);
    /* (for a look in the studio: the hillside under the steps, leaf litter on it) */
    if (o.ground === 'ramp') { const lit = FloraLitter.tex({ N: 512, tile: 2 }), L = n * run + 3, hw = W / 2 + 2.5, ang = Math.atan2(n * rise, n * run);
      const geo = new T.PlaneGeometry(L / Math.cos(ang), 2 * hw, 8, 4); geo.rotateX(-Math.PI / 2); geo.rotateZ(ang);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 2, uv.getY(i) * hw);
      const m = new T.Mesh(geo, new T.MeshStandardMaterial({ map: lit.map, normalMap: lit.normalMap, color: new T.Color(0.78, 0.78, 0.78), roughness: 0.9 })); m.position.set(n * run / 2 - 0.2, n * rise / 2 - 0.12, 0); m.receiveShadow = true; g.add(m); }
    return g;
  });

  /* the paint for a signpost's arrows and the map: letters cut and painted cream on stained timber */
  function signText(lines, w = 512, h = 96, bg = '#3a2716') {
    const c = Models.canvas(w, h), a = c.getContext('2d'); a.fillStyle = bg; a.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { a.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; a.fillRect(0, Math.random() * h, w, 1); }
    a.fillStyle = '#e4d9b8'; a.font = `700 ${Math.round(h * 0.48)}px 'Instrument Sans', 'Helvetica Neue', Arial, sans-serif`; a.textBaseline = 'middle';
    a.textAlign = 'left'; a.fillText(lines[0], h * 0.35, h * 0.54); if (lines[1]) { a.textAlign = 'right'; a.fillText(lines[1], w - h * 0.75, h * 0.54); }
    return Mats.tex(c);
  }
  Models.add('struct/signpost', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 139 + 13), B = K.Builder(), bd = mk(R, B);
    bd('timber', V(0, -0.4, 0), V(0, 2.2, 0), 0.12, 0.12);
    const cap = new T.Mesh(new T.ConeGeometry(0.1, 0.1, 4), Mats.lit({ color: new T.Color(0.08, 0.06, 0.04), roughness: 0.8 })); cap.position.y = 2.25; cap.rotation.y = Math.PI / 4; g.add(cap);
    const signs = o.signs || [['Summit', '2.1 km', 0.4], ['Beach', '0.6 km', 2.6], ['Jetty', '1.4 km', -1.9]];
    signs.forEach(([a, b, ang], k) => {
      const arm = new T.Group(); arm.position.y = 1.85 - k * 0.24; arm.rotation.y = ang; g.add(arm);
      /* (an arrow: a board pointed at its far end, the letters on both faces) */
      const sh = new T.Shape(); sh.moveTo(0.06, -0.07); sh.lineTo(0.62, -0.07); sh.lineTo(0.72, 0); sh.lineTo(0.62, 0.07); sh.lineTo(0.06, 0.07); sh.lineTo(0.06, -0.07);
      const geo = new T.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 }); geo.translate(0, 0, -0.015);
      /* (the letters read the right way round from either side: the back face's uvs mirrored) */
      const uv = geo.attributes.uv, pz = geo.attributes.position; for (let i = 0; i < uv.count; i++) { const u = (pz.getX(i) - 0.06) / 0.66; uv.setXY(i, pz.getZ(i) < 0 ? 1 - u : u, (pz.getY(i) + 0.07) / 0.14); }
      const tex = signText([a, b]), face = Mats.lit({ map: tex, roughness: 0.8 }), edge = Mats.lit({ color: new T.Color(0.07, 0.045, 0.028), roughness: 0.85 });
      const m = new T.Mesh(geo, [face, edge]); m.castShadow = true; arm.add(m);
    });
    B.build(g);
    return g;
  });

  /* the island's map, painted: its outline, the forest, the trails, the jetty, a red dot for where you stand */
  function mapTex() {
    const c = Models.canvas(1024, 768), a = c.getContext('2d');
    a.fillStyle = '#e9e1c8'; a.fillRect(0, 0, 1024, 768); a.fillStyle = '#9fc4c8'; a.fillRect(30, 90, 964, 648);
    a.beginPath(); const pts = []; for (let i = 0; i < 64; i++) { const t = i / 64 * TAU, r = 1 + 0.12 * Math.sin(3 * t + 1) + 0.07 * Math.sin(7 * t) + 0.05 * Math.sin(11 * t + 2); pts.push([512 + Math.cos(t) * 360 * r, 414 + Math.sin(t) * 220 * r]); }
    pts.forEach(([x, y], i) => (i ? a.lineTo(x, y) : a.moveTo(x, y))); a.closePath(); a.fillStyle = '#e8d9a8'; a.fill();
    a.save(); a.clip(); a.beginPath(); pts.forEach(([x, y], i) => { const xx = 512 + (x - 512) * 0.86, yy = 414 + (y - 414) * 0.82; i ? a.lineTo(xx, yy) : a.moveTo(xx, yy); }); a.closePath(); a.fillStyle = '#5e8a4e'; a.fill();
    for (let r = 160; r > 20; r -= 35) { a.beginPath(); a.ellipse(560, 400, r * 1.4, r, 0.2, 0, TAU); a.strokeStyle = 'rgba(60,80,40,0.5)'; a.lineWidth = 2; a.stroke(); } a.restore();
    a.setLineDash([10, 8]); a.strokeStyle = '#a3261c'; a.lineWidth = 5; a.beginPath(); a.moveTo(250, 520); a.bezierCurveTo(360, 470, 430, 430, 560, 400); a.bezierCurveTo(650, 380, 720, 320, 800, 300); a.stroke();
    a.beginPath(); a.moveTo(560, 400); a.bezierCurveTo(600, 480, 640, 560, 700, 610); a.stroke(); a.setLineDash([]);
    a.fillStyle = '#5a3d22'; a.fillRect(190, 528, 70, 10);
    a.fillStyle = '#c42a1a'; a.beginPath(); a.arc(330, 488, 12, 0, TAU); a.fill(); a.fillStyle = '#2a2a24';
    a.font = "700 54px 'Instrument Sans', Arial, sans-serif"; a.textAlign = 'center'; a.fillText('Trails of the island', 512, 62);
    a.font = "500 26px 'Instrument Sans', Arial, sans-serif"; a.fillText('Summit', 560, 380); a.fillText('Jetty', 225, 570); a.fillText('Mangroves', 760, 640); a.fillText('Beach', 830, 280);
    a.textAlign = 'left'; a.fillText('● You are here', 360, 500);
    return Mats.tex(c);
  }
  Models.add('struct/mapboard', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 149 + 17), B = K.Builder(), bd = mk(R, B);
    for (const x of [-0.75, 0.75]) bd('timber', V(x, -0.5, 0), V(x, 2.15, 0), 0.12, 0.12);
    const board = new T.Group(); board.position.set(0, 1.35, 0.08); board.rotation.x = -0.12; g.add(board);
    const face = new T.Mesh(new T.PlaneGeometry(1.3, 0.97), Mats.lit({ map: mapTex(), roughness: 0.6 })); face.position.z = 0.025; board.add(face);
    const back = new T.Mesh(new T.BoxGeometry(1.4, 1.07, 0.04), Mats.lit({ color: new T.Color(0.09, 0.06, 0.035), roughness: 0.8 })); back.castShadow = true; board.add(back);
    for (const [x, y, w, hh] of [[0, 0.52, 1.44, 0.05], [0, -0.52, 1.44, 0.05], [-0.7, 0, 0.05, 1.09], [0.7, 0, 0.05, 1.09]]) { const f = new T.Mesh(new T.BoxGeometry(w, hh, 0.06), Mats.lit({ color: new T.Color(0.07, 0.045, 0.028), roughness: 0.8 })); f.position.set(x, y, 0.02); board.add(f); }
    shadeRoof(B, R, bd, -0.85, 0.85, -0.35, 0.35, 2.15, 0.5, 0.18);
    B.build(g);
    return g;
  });

  Models.add('struct/bench', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 151 + 19), B = K.Builder(), bd = mk(R, B), L = o.len ?? 1.6;
    for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) { bd('timber', V(x, -0.2, 0), V(x, 0.42, 0), 0.12, 0.3, { up: V(1, 0, 0) }); }
    bd('timber', V(-L / 2, 0.46, 0), V(L / 2, 0.46, 0), 0.07, 0.38);
    if (o.back !== false) { for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) bd('timber', V(x, 0.42, -0.17), V(x, 0.95, -0.24), 0.08, 0.08); bd('timber', V(-L / 2, 0.85, -0.235), V(L / 2, 0.85, -0.235), 0.18, 0.04, { up: V(0, 0.15, 1) }); }
    B.build(g);
    return g;
  });
})();
