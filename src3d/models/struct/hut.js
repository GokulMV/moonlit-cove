/* ─────────────────────────────────────────────────────────────
   models/struct/hut.js — the rangers' hut above the beach, as the
   park huts in Borneo are built: up on timber stilts on concrete
   pads, out of the wet and the termites; walls of lapped
   weatherboards painted cream, chalky now, peeling where the rain
   hits; glass louvre windows in green-painted frames; a panelled
   door; a gable roof of green iron with deep eaves, and over the
   front verandah a lean-to of the same; a railing round the
   verandah and steps up to it with a handrail; a sign over the
   steps; a bench; a blue water tank on its stand at the side, its
   downpipe from the gutter; a small solar panel on the roof.
   Its front toward +z, its floor 1.2 m up, centred on x = 0.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, S = () => StructKit, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* the sign: green board, cream letters cut in it, a cream border */
  function signTex(text) {
    const c = Models.canvas(1024, 192), a = c.getContext('2d');
    a.fillStyle = '#21402c'; a.fillRect(0, 0, 1024, 192);
    for (let i = 0; i < 1400; i++) { a.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,240' : '0,0,0'},${0.03 + Math.random() * 0.05})`; a.fillRect(Math.random() * 1024, Math.random() * 192, 1 + Math.random() * 3, 1 + Math.random() * 20); }
    a.strokeStyle = '#d9cfae'; a.lineWidth = 7; a.strokeRect(14, 14, 996, 164);
    a.fillStyle = '#e6dcbc'; a.font = "700 92px 'Instrument Sans', 'Helvetica Neue', Arial, sans-serif"; a.textAlign = 'center'; a.textBaseline = 'middle';
    a.fillText(text, 512, 100);
    return Mats.tex(c);
  }

  Models.add('struct/rangerhut', (o = {}) => {
    const g = new T.Group(), K = S(), R = Models.rng((o.seed || 1) * 113 + 3), B = K.Builder();
    const X = 3.0, Z = 2.25, fy = 1.2, wh = 2.6, wy = fy + wh, vz = 1.8, roofKind = o.roof || 'zincGreen';
    const tone = () => { const k = 0.85 + 0.25 * R(); return [k, k, k * (0.97 + 0.05 * R())]; };
    const bd = (kind, a, b, th, w, extra = {}) => K.boardAB(B, kind, a, b, th, w, Object.assign({ tone: tone(), u0: R() * 4, v0: R() * 4 }, extra));
    /* ── footings and stilts ── */
    const posts = [];
    for (const x of [-X, -X / 3, X / 3, X]) for (const z of [-Z, 0, Z, Z + vz]) posts.push([x, z]);
    for (const [x, z] of posts) {
      B.add('concrete', K.board(0.42, 0.28, 0.42, { kind: 'concrete', u0: R(), v0: R(), round: 0.02 }), K.M(x, 0.1, z));
      bd('timber', V(x, 0.24, z), V(x, fy - 0.2, z), 0.15, 0.15);
    }
    /* ── the floor: bearers along x on the stilts, joists across, the verandah's boards (the room's are inside) ── */
    for (const z of [-Z, 0, Z, Z + vz]) bd('timber', V(-X - 0.15, fy - 0.12, z), V(X + 0.15, fy - 0.12, z), 0.17, 0.12);
    for (let x = -X; x <= X + 1e-6; x += 0.5) bd('timber', V(x, fy - 0.03 - 0.06, -Z - 0.05), V(x, fy - 0.03 - 0.06, Z + vz + 0.05), 0.12, 0.05);
    for (let z = Z + 0.02; z < Z + vz + 0.05; z += 0.155) bd(R() < 0.05 ? 'timberNew' : 'timber', V(-X - 0.1, fy, z + 0.07), V(X + 0.1, fy, z + 0.07), 0.03, 0.14);
    /* (a skirt board round the floor's edge) */
    for (const [a, b] of [[V(-X - 0.1, fy - 0.12, -Z - 0.08), V(X + 0.1, fy - 0.12, -Z - 0.08)], [V(-X - 0.08, fy - 0.12, -Z - 0.1), V(-X - 0.08, fy - 0.12, Z + vz + 0.1)], [V(X + 0.08, fy - 0.12, -Z - 0.1), V(X + 0.08, fy - 0.12, Z + vz + 0.1)], [V(-X - 0.1, fy - 0.12, Z + vz + 0.08), V(X + 0.1, fy - 0.12, Z + vz + 0.08)]])
      bd('timber', a, b, 0.22, 0.03, { up: V(0, 0, 1).cross(new T.Vector3().subVectors(b, a).normalize()).lengthSq() > 0.5 ? V(0, 0, 1) : V(1, 0, 0) });

    /* ── the walls: lapped weatherboards, each tilted out at its foot, broken round the openings ── */
    const openings = {
      front: [{ a: -0.45, b: 0.45, y0: fy, y1: fy + 2.05, door: true }, { a: -2.3, b: -1.1, y0: fy + 1.0, y1: fy + 2.05 }, { a: 1.1, b: 2.3, y0: fy + 1.0, y1: fy + 2.05 }],
      back: [{ a: -1.8, b: -0.6, y0: fy + 1.0, y1: fy + 2.05 }, { a: 0.8, b: 2.0, y0: fy + 1.0, y1: fy + 2.05 }],
      left: [{ a: -1.1, b: 0.1, y0: fy + 1.0, y1: fy + 2.05 }], right: [{ a: -0.4, b: 0.8, y0: fy + 1.0, y1: fy + 2.05 }] };
    /* a wall from (x0, z0) to (x1, z1), outward normal n; s along it from its start */
    const wall = (p0, p1, n, ops) => {
      const d = new T.Vector3().subVectors(p1, p0), Lw = d.length(); d.normalize();
      const at = (s, y, out = 0) => p0.clone().addScaledVector(d, s).add(V(0, y, 0)).addScaledVector(n, out);
      const rowH = 0.17, bw = 0.19;
      for (let y = fy + 0.02; y < wy - 0.05; y += rowH) {
        /* (the spans of this row clear of the openings; s measured from the wall's middle) */
        let spans = [[-Lw / 2, Lw / 2]];
        for (const q of ops) if (y + bw > q.y0 && y < q.y1) spans = spans.flatMap(([a, b]) => (q.b <= a || q.a >= b ? [[a, b]] : [[a, q.a - 0.05], [q.b + 0.05, b]].filter(([u, v]) => v - u > 0.05)));
        for (const [a, b] of spans) bd('paintCream', at(a + Lw / 2, y + bw / 2, 0.03), at(b + Lw / 2, y + bw / 2, 0.03), 0.022, bw, { up: n.clone().add(V(0, 0.1, 0)) });
      }
      /* (the corner boards, and the trim round each opening) */
      for (const s0 of [0.02, Lw - 0.02]) bd('paintCream', at(s0, fy, 0.05), at(s0, wy, 0.05), 0.03, 0.12, { up: n });
      for (const q of ops) {
        const tr = (a, b) => bd('timber', a, b, 0.03, 0.1, { up: n, kind: 'timber' });
        tr(at(q.a + Lw / 2 - 0.05, q.y0, 0.06), at(q.a + Lw / 2 - 0.05, q.y1 + 0.1, 0.06)); tr(at(q.b + Lw / 2 + 0.05, q.y0, 0.06), at(q.b + Lw / 2 + 0.05, q.y1 + 0.1, 0.06)); tr(at(q.a + Lw / 2 - 0.1, q.y1 + 0.05, 0.06), at(q.b + Lw / 2 + 0.1, q.y1 + 0.05, 0.06));
        if (!q.door) { tr(at(q.a + Lw / 2 - 0.1, q.y0 - 0.05, 0.07), at(q.b + Lw / 2 + 0.1, q.y0 - 0.05, 0.07));
          /* (a glass louvre window: a green frame, eight tilted blades of glass, the dark room behind) */
          const w = q.b - q.a, h = q.y1 - q.y0, c = at((q.a + q.b) / 2 + Lw / 2, (q.y0 + q.y1) / 2, 0.0), frame = Mats.lit({ color: new T.Color(0.07, 0.16, 0.1), roughness: 0.6 });
          const win = new T.Group(); win.position.copy(c); win.lookAt(c.clone().add(n)); g.add(win);
          for (const [fx, fyy, fw, fh] of [[-w / 2 + 0.03, 0, 0.06, h], [w / 2 - 0.03, 0, 0.06, h], [0, h / 2 - 0.03, w, 0.06], [0, -h / 2 + 0.03, w, 0.06], [0, 0, 0.04, h]]) { const m = new T.Mesh(new T.BoxGeometry(fw, fh, 0.06), frame); m.position.set(fx, fyy, 0.0); m.castShadow = true; win.add(m); }
          const glass = Mats.lit({ color: new T.Color(0.05, 0.07, 0.07), roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.55 });
          for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) { const m = new T.Mesh(new T.PlaneGeometry(w / 2 - 0.07, h / 8 + 0.025), glass); m.position.set(sx * w / 4, -h / 2 + (k + 0.5) * h / 8, 0.0); m.rotation.x = -0.35; win.add(m); }
          const dark = new T.Mesh(new T.PlaneGeometry(w, h), Mats.lit({ color: new T.Color(0.012, 0.012, 0.011), roughness: 1 })); dark.position.z = -0.12; win.add(dark);
        }
      }
    };
    wall(V(-X, 0, Z), V(X, 0, Z), V(0, 0, 1), openings.front);
    wall(V(X, 0, -Z), V(-X, 0, -Z), V(0, 0, -1), openings.back.map(q => ({ ...q })));
    wall(V(-X, 0, -Z), V(-X, 0, Z), V(-1, 0, 0), openings.left);
    wall(V(X, 0, Z), V(X, 0, -Z), V(1, 0, 0), openings.right);
    /* (the room inside: dark, so the windows and the door open on shadow) */
    { const inner = new T.Mesh(new T.BoxGeometry(2 * X - 0.1, wh - 0.05, 2 * Z - 0.1), Mats.lit({ color: new T.Color(0.03, 0.028, 0.025), roughness: 1, side: T.BackSide })); inner.position.set(0, fy + wh / 2, 0); g.add(inner); }
    /* (the door: dark stained, four panels, half open) */
    { const dg = new T.Group(); dg.position.set(-0.43, fy, Z + 0.02); dg.rotation.y = 0.6; g.add(dg);
      const dm = Mats.lit({ map: FloraKit.bark('timberNew').map, normalMap: FloraKit.bark('timberNew').normalMap, color: new T.Color(0.9, 0.85, 0.8), roughness: 0.6 });
      const leaf = new T.Mesh(new T.BoxGeometry(0.86, 2.02, 0.04), dm); leaf.position.set(0.43, 1.01, 0); leaf.castShadow = true; dg.add(leaf);
      for (const [px, py] of [[0.22, 0.55], [0.64, 0.55], [0.22, 1.5], [0.64, 1.5]]) { const p = new T.Mesh(new T.BoxGeometry(0.3, 0.7, 0.012), dm); p.position.set(px, py, 0.026); dg.add(p); }
      const knob = new T.Mesh(new T.SphereGeometry(0.025, 10, 8), Mats.lit({ color: new T.Color(0.55, 0.45, 0.25), metalness: 0.9, roughness: 0.35 })); knob.position.set(0.78, 1.0, 0.05); dg.add(knob); }

    /* ── the roof: a gable over the room, ridge along x; rafters, purlins, the sheets, a ridge cap; fascias ── */
    const pitch = 0.42, tp = Math.tan(pitch), ov = 0.6, gov = 0.5, ridgeY = wy + 0.05 + Z * tp, yr = z => ridgeY - Math.abs(z) * tp;
    for (let x = -X; x <= X + 1e-6; x += X / 3) for (const side of [-1, 1]) bd('timber', V(x, yr(Z + ov) - 0.05, side * (Z + ov)), V(x, ridgeY - 0.05, 0), 0.15, 0.05);
    bd('timber', V(-X - gov, ridgeY - 0.04, 0), V(X + gov, ridgeY - 0.04, 0), 0.18, 0.04);
    for (const side of [-1, 1]) for (let k = 1; k <= 3; k++) { const z = side * (Z + ov) * k / 3.4; bd('timber', V(-X - gov, yr(z) + 0.04, z), V(X + gov, yr(z) + 0.04, z), 0.06, 0.09); }
    const sheetL = (Z + ov) / Math.cos(pitch) + 0.06, roofW = 2 * (X + gov), nS = Math.ceil(roofW / 0.72);
    for (const side of [-1, 1]) for (let k = 0; k < nS; k++) {
      const cx = -X - gov + (k + 0.5) * roofW / nS, zc = side * (Z + ov) / 2, m = new T.Matrix4().makeRotationX(side * pitch);
      m.premultiply(new T.Matrix4().makeTranslation(cx, yr(zc) + 0.1 + 0.003 * (k % 2), zc)); B.add(roofKind, K.corrugated(roofW / nS + 0.05, sheetL, { kind: roofKind, u0: R() * 3, v0: R() * 3 }), m, { metal: 0.35 });
    }
    for (const side of [-1, 1]) { const m = new T.Matrix4().makeRotationX(side * pitch * 0.9); m.premultiply(new T.Matrix4().makeTranslation(0, ridgeY + 0.13, side * 0.11)); B.add(roofKind, K.corrugated(roofW, 0.26, { kind: roofKind, pitch: 0.2, depth: 0.004 }), m, { metal: 0.35 }); }
    /* (fascia boards along the eaves and up the gables' barge) */
    for (const side of [-1, 1]) bd('paintCream', V(-X - gov, yr(Z + ov) - 0.02, side * (Z + ov + 0.02)), V(X + gov, yr(Z + ov) - 0.02, side * (Z + ov + 0.02)), 0.025, 0.2, { up: V(0, 0, side) });
    for (const sx of [-1, 1]) for (const side of [-1, 1]) bd('paintCream', V(sx * (X + gov + 0.01), yr(Z + ov) + 0.02, side * (Z + ov)), V(sx * (X + gov + 0.01), ridgeY + 0.05, 0), 0.025, 0.2, { up: V(sx, 0, 0) });
    /* (the gable ends above the walls: boards up to the roof's underside, a louvred vent in each) */
    for (const sx of [-1, 1]) {
      for (let y = wy; y < ridgeY - 0.05; y += 0.17) { const hz = Math.max(0, (ridgeY - y - 0.1) / tp) - 0.02; if (hz > 0.1) bd('paintCream', V(sx * (X + 0.03), y + 0.095, -hz), V(sx * (X + 0.03), y + 0.095, hz), 0.022, 0.19, { up: V(sx, 0.1, 0) }); }
      const vent = new T.Group(); vent.position.set(sx * (X + 0.06), wy + 0.55, 0); vent.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(vent);
      for (let k = 0; k < 5; k++) { const m = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.012), Mats.lit({ color: new T.Color(0.07, 0.16, 0.1), roughness: 0.7 })); m.position.set(0, -0.12 + k * 0.06, 0.01); m.rotation.x = -0.6; vent.add(m); }
    }
    /* ── the verandah's lean-to: from under the main eave down to a beam on its front posts ── */
    const vy0 = wy - 0.35, vy1 = fy + 2.08, vz1 = Z + vz + 0.35, vp = Math.atan2(vy0 - vy1, vz1 - Z);
    for (const x of [-X, -X / 3, X / 3, X]) bd('timber', V(x, fy, Z + vz - 0.05), V(x, vy1 - 0.12, Z + vz - 0.05), 0.12, 0.12);
    bd('timber', V(-X - 0.2, vy1 - 0.06, Z + vz - 0.05), V(X + 0.2, vy1 - 0.06, Z + vz - 0.05), 0.15, 0.1);
    for (let x = -X; x <= X + 1e-6; x += X / 3) bd('timber', V(x, vy0, Z + 0.06), V(x, vy1 + 0.02 - 0.02, vz1), 0.12, 0.05);
    { const lv = (vz1 - Z) / Math.cos(vp) + 0.1, nV = Math.ceil((2 * X + 0.6) / 0.72);
      for (let k = 0; k < nV; k++) { const cx = -X - 0.3 + (k + 0.5) * (2 * X + 0.6) / nV, m = new T.Matrix4().makeRotationX(vp); m.premultiply(new T.Matrix4().makeTranslation(cx, (vy0 + vy1) / 2 + 0.1, (Z + vz1) / 2)); B.add(roofKind, K.corrugated((2 * X + 0.6) / nV + 0.05, lv, { kind: roofKind, u0: R() * 3, v0: R() * 3 }), m, { metal: 0.35 }); } }
    bd('paintCream', V(-X - 0.3, vy1 + 0.0, vz1 + 0.02), V(X + 0.3, vy1 + 0.0, vz1 + 0.02), 0.025, 0.18, { up: V(0, 0, 1) });
    /* (a gutter along the main front eave... no: along the verandah's, a half-round channel, its downpipe to the tank) */
    { const gm = Mats.lit({ color: new T.Color(0.3, 0.31, 0.31), metalness: 0.6, roughness: 0.45 }), gut = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2 * X + 0.6, 12, 1, true, 0, Math.PI), gm);
      gut.rotation.z = Math.PI / 2; gut.position.set(0, vy1 - 0.02, vz1 + 0.08); gut.material.side = T.DoubleSide; g.add(gut);
      const pipe = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, vy1 - 1.6, 10), gm); pipe.position.set(X + 0.28, (vy1 + 1.6) / 2, vz1 + 0.08); g.add(pipe); }
    /* ── the railing round the verandah, and the steps up to it in the middle ── */
    const sw = 1.2, rl = (a, b) => { bd('timber', a.clone().setY(fy + 0.95), b.clone().setY(fy + 0.95), 0.05, 0.14); bd('timber', a.clone().setY(fy + 0.5), b.clone().setY(fy + 0.5), 0.09, 0.04, { up: V(0, 1, 0) });
      const L2 = a.distanceTo(b), n = Math.max(1, Math.round(L2 / 0.12)); for (let k = 1; k < n; k++) { const p = a.clone().lerp(b, k / n); bd('timber', p.clone().setY(fy + 0.05), p.clone().setY(fy + 0.92), 0.04, 0.04); } };
    rl(V(-X, 0, Z + vz - 0.05), V(-sw / 2, 0, Z + vz - 0.05)); rl(V(sw / 2, 0, Z + vz - 0.05), V(X, 0, Z + vz - 0.05));
    rl(V(-X, 0, Z + 0.05), V(-X, 0, Z + vz - 0.05)); rl(V(X, 0, Z + 0.05), V(X, 0, Z + vz - 0.05));
    { const nSt = 6, rise = fy / nSt, run = 0.28, z0 = Z + vz;
      for (const sx of [-1, 1]) bd('timber', V(sx * (sw / 2 - 0.03), fy, z0), V(sx * (sw / 2 - 0.03), 0, z0 + run * nSt), 0.25, 0.05, { up: V(0, 1, 0) });
      for (let k = 1; k < nSt; k++) { const y = fy - k * rise, z = z0 + (k - 0.5) * run; bd(R() < 0.15 ? 'timberNew' : 'timber', V(-sw / 2, y - 0.02, z), V(sw / 2, y - 0.02, z), 0.04, run + 0.02); }
      for (const sx of [-1, 1]) { bd('timber', V(sx * (sw / 2 + 0.02), fy + 0.95, z0), V(sx * (sw / 2 + 0.02), 0.95, z0 + run * nSt), 0.05, 0.1); bd('timber', V(sx * (sw / 2 + 0.02), 0, z0 + run * nSt), V(sx * (sw / 2 + 0.02), 1.0, z0 + run * nSt), 0.1, 0.1); }
      B.add('concrete', K.board(sw + 0.3, 0.12, 0.5, { kind: 'concrete', round: 0.02 }), K.M(0, 0.03, z0 + run * nSt + 0.1)); }
    /* ── the sign over the steps, a bench, the tank on its stand, a solar panel ── */
    { const sg = new T.Mesh(new T.BoxGeometry(2.2, 0.42, 0.04), [Mats.lit({ color: new T.Color(0.13, 0.25, 0.17) }), Mats.lit({ color: new T.Color(0.13, 0.25, 0.17) }), Mats.lit({ color: new T.Color(0.13, 0.25, 0.17) }), Mats.lit({ color: new T.Color(0.13, 0.25, 0.17) }), Mats.lit({ map: signTex(o.sign || 'RANGER STATION'), roughness: 0.7 }), Mats.lit({ color: new T.Color(0.13, 0.25, 0.17) })]);
      sg.position.set(0, vy1 + 0.2, vz1 + 0.06); sg.castShadow = true; g.add(sg);
      for (const sx of [-0.8, 0.8]) bd('timber', V(sx, vy1 - 0.08, vz1 + 0.03), V(sx, vy1 + 0.3, vz1 + 0.03), 0.06, 0.04); }
    bd('timber', V(-2.4, fy + 0.45, Z + 0.32), V(-1.0, fy + 0.45, Z + 0.32), 0.05, 0.36);
    for (const x of [-2.25, -1.15]) bd('timber', V(x, fy, Z + 0.32), V(x, fy + 0.43, Z + 0.32), 0.07, 0.3);
    { const tx = X + 1.0, tz = Z + 0.4;
      for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) bd('timber', V(tx + dx, 0, tz + dz), V(tx + dx, 1.5, tz + dz), 0.1, 0.1);
      for (const dz of [-0.45, 0.45]) bd('timber', V(tx - 0.55, 1.55, tz + dz), V(tx + 0.55, 1.55, tz + dz), 0.1, 0.1);
      for (let k = 0; k < 6; k++) bd('timber', V(tx - 0.55 + k * 0.22, 1.63, tz - 0.55), V(tx - 0.55 + k * 0.22, 1.63, tz + 0.55), 0.04, 0.15);
      /* (a black polyethylene tank would be too dark: this one the blue of the island's) */
      const tm = Mats.lit({ color: new T.Color(0.03, 0.085, 0.22), roughness: 0.5 }), tank = new T.Mesh(new T.CylinderGeometry(0.55, 0.57, 1.3, 32, 8), tm); tank.position.set(tx, 1.65 + 0.65, tz); tank.castShadow = tank.receiveShadow = true; g.add(tank);
      for (let k = 0; k < 4; k++) { const rib = new T.Mesh(new T.TorusGeometry(0.565, 0.018, 6, 32), tm); rib.rotation.x = Math.PI / 2; rib.position.set(tx, 1.75 + k * 0.32, tz); g.add(rib); }
      const lid = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 20), tm); lid.position.set(tx, 2.33, tz); g.add(lid);
      const tap = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.18, 8), Mats.lit({ color: new T.Color(0.5, 0.5, 0.48), metalness: 0.8, roughness: 0.3 })); tap.rotation.z = Math.PI / 2; tap.position.set(tx - 0.62, 1.78, tz); g.add(tap); }
    { const pg = new T.Group(); pg.position.set(-1.6, yr(-1.2) + 0.2, -1.2); pg.rotation.x = -pitch; g.add(pg);
      const frame = new T.Mesh(new T.BoxGeometry(1.0, 0.035, 1.6), Mats.lit({ color: new T.Color(0.5, 0.52, 0.53), metalness: 0.7, roughness: 0.35 })); frame.castShadow = true; pg.add(frame);
      const cells = Mats.lit({ map: (() => { const c = Models.canvas(128, 256), a = c.getContext('2d'); a.fillStyle = '#0b1830'; a.fillRect(0, 0, 128, 256); a.strokeStyle = '#2a3c5c'; a.lineWidth = 2; for (let i = 0; i <= 6; i++) { a.beginPath(); a.moveTo(i * 128 / 6, 0); a.lineTo(i * 128 / 6, 256); a.stroke(); } for (let j = 0; j <= 10; j++) { a.beginPath(); a.moveTo(0, j * 25.6); a.lineTo(128, j * 25.6); a.stroke(); } return Mats.tex(c); })(), roughness: 0.12, metalness: 0.3 });
      const face = new T.Mesh(new T.PlaneGeometry(0.94, 1.54), cells); face.rotation.x = -Math.PI / 2; face.position.y = 0.019; pg.add(face); }
    B.build(g);
    g.userData.info = { floor: fy, front: Z + vz + 6 * 0.28 + 0.3, width: 2 * X };
    return g;
  });
})();
