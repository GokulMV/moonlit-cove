/* the small lives of the shallows, for holding up close: a sergeant major (the little reef fish that swims in schools
   round the rocks: silver-white with a yellow back and five black bars, a big eye with a gold rim) and a cleaner shrimp
   (translucent red and white, its long white antennae waving). (The hermit crab has a file of its own: hermit.js.)
   At the origin in metres, heads toward +x. userData.anim(t, flying) */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* an eye: iris round a black pupil under a glossy cornea; looking along +z */
  function eye(r, iris = [0.62, 0.5, 0.22]) {
    const g = new T.Group(), ig = new T.SphereGeometry(r, 24, 18);
    M.paint(ig, (x, y, z) => { const q = Math.hypot(x, y) / r; if (z < 0) return [0.02, 0.02, 0.02]; if (q < 0.45) return [0.005, 0.005, 0.006]; const k = (q - 0.45) / 0.55; return q > 0.93 ? iris.map(v => v * 0.3) : iris.map(v => v * (1 - 0.35 * k) * (0.85 + 0.15 * Math.sin(Math.atan2(y, x) * 24))); });
    g.add(new T.Mesh(ig, M.litP('#ffffff', { vertexColors: true, roughness: 0.25, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.04 })));
    const c = new T.Mesh(new T.SphereGeometry(r * 1.06, 18, 12, 0, TAU, 0, Math.PI * 0.42), new T.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1, depthWrite: false }));
    c.rotation.x = Math.PI / 2; g.add(c); return g;
  }
  /* a fin's look: its membrane, clear toward the edge, and its rays running out from the base (the first few, the
     spines, stouter and darker); tint as [r, g, b] 0..255 */
  const finTexs = new Map();
  function finTex(rays, tint, { base = 0.82, edge = 0.18, spines = 0 } = {}) {
    const key = [rays, tint, base, edge, spines].join(); if (finTexs.has(key)) return finTexs.get(key);
    const S = 256, cv = M.canvas(S, S), x = cv.getContext('2d'), [r, g, b] = tint;
    const gr = x.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, `rgba(${r},${g},${b},${base})`); gr.addColorStop(0.7, `rgba(${r},${g},${b},${(base + edge) / 2})`); gr.addColorStop(1, `rgba(${r},${g},${b},${edge})`);
    x.fillStyle = gr; x.fillRect(0, 0, S, S);
    for (let i = 0; i < rays; i++) {
      const u = (i + 0.5) / rays * S, sp = i < spines;
      const lg = x.createLinearGradient(0, 0, 0, S); lg.addColorStop(0, `rgba(${r * 0.55 | 0},${g * 0.55 | 0},${b * 0.55 | 0},${sp ? 0.95 : 0.7})`); lg.addColorStop(1, `rgba(${r * 0.7 | 0},${g * 0.7 | 0},${b * 0.7 | 0},${sp ? 0.8 : 0.25})`);
      x.strokeStyle = lg; x.lineWidth = sp ? 3.2 : 1.6; x.beginPath(); x.moveTo(u, 0); x.lineTo(u + (sp ? 0 : 1.5), S); x.stroke();
    }
    const t = Mats.tex(cv); t.flipY = false; t.needsUpdate = true; t.userData.keep = true; finTexs.set(key, t); return t;
  }
  /* a fin as a sheet between its base and its edge (s from the base out, c along it), with a little camber */
  const finSheet = (base, edge, ns, nc, camber = 0) => M.sheet(ns, nc, (s, c) => { const a = base(c), b = edge(c); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s + camber * Math.sin(Math.PI * s) * Math.sin(Math.PI * c)]; });

  /* ── the sergeant major: deep-bodied and flat, 13 cm to the fork of its tail; a steep brow over a small mouth; silver,
     its back washed yellow from the nape to the middle of the back, five black bars down its sides (the last across the
     narrow root of the tail), the edge of the gill cover a faint curve; a long dorsal fin, spiny in front and higher and
     soft behind; the anal fin; the forked tail; clear pectoral fins and the white-edged pelvic fins below them; a big eye,
     its iris gold ── */
  const RF = { X0: -0.051, X1: 0.0605, BARS: [0.0285, 0.0128, -0.0032, -0.0188, -0.0335] };
  /* the body through its sections [x, half-width (z), half-height (y), centre height, squareness] */
  RF.SECS = [[-0.051, 0, 0, 0, 2], [-0.0495, 0.0024, 0.0086, 0, 1.9], [-0.046, 0.0031, 0.0076, 0, 1.9], [-0.04, 0.0045, 0.0104, 0, 1.85], [-0.03, 0.0072, 0.0198, 0.0004, 1.85],
    [-0.016, 0.0097, 0.0284, 0.0012, 1.85], [0.002, 0.0112, 0.0328, 0.0018, 1.9], [0.02, 0.0113, 0.0312, 0.0012, 1.95], [0.034, 0.0098, 0.0245, -0.0004, 2.0], [0.045, 0.0076, 0.0158, -0.0022, 2.05],
    [0.053, 0.0052, 0.0088, -0.0034, 2.1], [0.0585, 0.0026, 0.0042, -0.0042, 2.1], [0.0605, 0, 0, -0.0044, 2]];
  RF.prof = M.spline(RF.SECS.map(r => [r[0], r[1], r[2], r[3]]));
  /* its colour at x along it, d round it (0 along the top of the back, 0.25 halfway down a side, 0.5 the belly) */
  RF.skin = (x, d) => {
    let c = mix([0.5, 0.56, 0.6], [0.66, 0.7, 0.72], sm(0.1, 0.3, d));
    c = mix(c, [0.9, 0.9, 0.88], sm(0.32, 0.45, d));
    const yb = (1 - sm(0.1, 0.24, d)) * sm(-0.047, -0.02, x) * (1 - sm(0.038, 0.05, x));
    c = mix(c, [0.78, 0.5, 0.04], yb * 0.97);
    c = mix(c, [0.36, 0.32, 0.1], (1 - sm(0, 0.04, d)) * 0.5 * sm(-0.04, 0, x));
    c = mix(c, [0.42, 0.46, 0.5], (1 - sm(0.1, 0.24, d)) * sm(0.036, 0.05, x));
    for (const b of RF.BARS) {
      const k = Math.min(1, d / 0.36), bx = b + 0.0034 * k, hw = 0.0029 - 0.001 * k + (b < -0.03 ? 0.0004 : 0);
      const on = (1 - sm(hw - 0.00035, hw + 0.00035, Math.abs(x - bx))) * (1 - sm(0.3, 0.39, d)); c = mix(c, [0.012, 0.014, 0.02], on * 0.96);
    }
    const ox = 0.0372 - 0.035 * (d - 0.24) * (d - 0.24), op = (1 - sm(0.0002, 0.0008, Math.abs(x - ox))) * sm(0.1, 0.16, d) * (1 - sm(0.4, 0.46, d));
    c = mix(c, [0.4, 0.43, 0.47], op * 0.55);
    if (x > 0.0548 && Math.abs(d - 0.275) < 0.02) c = mix(c, [0.16, 0.14, 0.13], 0.75 * sm(0.0548, 0.057, x));
    return c;
  };
  let rfTex = null;
  function rfSkin() {
    if (rfTex) return rfTex;
    const W = 1024, H = 512, cv = M.canvas(W, H), x = cv.getContext('2d'), im = x.createImageData(W, H), D = im.data;
    for (let j = 0; j < H; j++) {
      const v = (j + 0.5) / H, d = Math.abs(v - 0.5);
      for (let i = 0; i < W; i++) {
        const u = (i + 0.5) / W, X = RF.X0 + u * (RF.X1 - RF.X0), c = RF.skin(X, d);
        /* the scales: rows of small overlapping arcs, a little brighter at their free edges */
        const su = X / 0.0021, sv = d * 0.07 / 0.0021, q = su + 0.5 * (Math.floor(sv) & 1), fu = q - Math.floor(q) - 0.5, fv = sv - Math.floor(sv);
        const arc = Math.hypot(fu * 1.6, fv * 1.1), k = 0.93 + 0.1 * sm(0.62, 0.8, arc) - 0.04 * sm(0.8, 1.0, arc);
        const o = (j * W + i) * 4; D[o] = Math.min(255, Math.pow(c[0] * k, 1 / 2.2) * 255); D[o + 1] = Math.min(255, Math.pow(c[1] * k, 1 / 2.2) * 255); D[o + 2] = Math.min(255, Math.pow(c[2] * k, 1 / 2.2) * 255); D[o + 3] = 255;
      }
    }
    x.putImageData(im, 0, 0);
    rfTex = Mats.tex(cv); rfTex.flipY = false; rfTex.needsUpdate = true; rfTex.userData.keep = true; return rfTex;
  }
  /* its fins, each [name, base(c), edge(c), rays, spines, tint, ns, nc]: on the body's own outline */
  function rfFins() {
    const top = x => { const [, h, cy] = RF.prof(x); return cy + h; }, bot = x => { const [, h, cy] = RF.prof(x); return cy - h; };
    return {
      /* the dorsal: low and spiny from the nape, then higher and rounded, soft, to over the root of the tail */
      dorsal: [c => { const x = 0.031 - c * 0.066; return [x, top(x) - 0.0012, 0]; },
        c => { const x = 0.031 - c * 0.066, h = c < 0.6 ? 0.0085 + 0.0035 * Math.sin(Math.PI * c / 0.6) * 0.6 : 0.0085 + 0.0095 * Math.sin(Math.PI * Math.min(1, (c - 0.6) / 0.42)) ; return [x - 0.004 - 0.006 * c, top(x) + h * (c > 0.97 ? 0.3 : 1), 0]; }, 22, 13, [214, 196, 120]],
      anal: [c => { const x = -0.003 - c * 0.031; return [x, bot(x) + 0.0012, 0]; },
        c => { const x = -0.003 - c * 0.031, h = 0.006 + 0.008 * Math.sin(Math.PI * Math.min(1, c / 0.85)); return [x - 0.005 - 0.004 * c, bot(x) - h * (c > 0.95 ? 0.35 : 1), 0]; }, 14, 2, [205, 205, 200]],
      tail: [c => [-0.0485, (2 * c - 1) * 0.0082, 0],
        c => { const k = Math.abs(2 * c - 1); return [-0.059 - 0.0145 * Math.pow(k, 0.8), (2 * c - 1) * (0.008 + 0.0158 * k), 0]; }, 18, 0, [216, 206, 150]]
    };
  }

  M.add('life/reeffish', (o = {}) => {
    const g = new T.Group(), lite = !!o.lite;
    const body = M.loft(RF.SECS, lite ? 48 : 110, lite ? 12 : 64, lite ? (x, y, z, u, a) => RF.skin(x, Math.abs(((a / TAU + 0.5) % 1) - 0.5) * 0) : null);
    if (lite) {
      /* (for the schools, painted vertex by vertex: d from where round it the vertex is) */
      const P = body.attributes.position, uv = body.attributes.uv, col = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) col.set(RF.skin(P.getX(i), Math.abs(uv.getY(i) - 0.5)), i * 3);
      body.setAttribute('color', new T.BufferAttribute(col, 3));
    }
    const bodyM = lite ? M.lit('#ffffff', { vertexColors: true, roughness: 0.4 }) : M.litP('#ffffff', { map: rfSkin(), roughness: 0.38, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, iridescence: 0.25, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 420] });
    g.add(new T.Mesh(body, bodyM));
    /* the eyes: big, gold-ringed, set high toward the snout */
    if (!lite) for (const sd of [-1, 1]) { const e = eye(0.0047, [0.78, 0.6, 0.2]); const [w] = RF.prof(0.0438); e.position.set(0.0438, 0.0047, sd * (w - 0.0019)); e.rotation.y = sd > 0 ? 0.12 : Math.PI - 0.12; g.add(e); }
    const F = rfFins(), finM = (rays, sp, tint, o2) => new T.MeshStandardMaterial({ map: finTex(rays, tint, Object.assign({ spines: sp }, o2)), transparent: true, side: T.DoubleSide, roughness: 0.55, depthWrite: false });
    const tail = new T.Object3D(); tail.position.x = -0.047; g.add(tail);
    const parts = [];
    for (const [nm, [base, edge, rays, sp, tint]] of Object.entries(F)) {
      const geo = finSheet(base, edge, lite ? 2 : 6, lite ? 10 : 26);
      if (lite) { parts.push({ geo, c: tint.map(v => Math.pow(v / 255, 2.2) * 0.9) }); continue; }
      const m = new T.Mesh(geo, finM(rays, sp, tint, nm === 'tail' ? { base: 0.86, edge: 0.32 } : {}));
      if (nm === 'tail') { geo.translate(0.047, 0, 0); tail.add(m); } else g.add(m);
    }
    /* the pectorals, clear, behind the gill covers; the pelvic fins beneath, each with a white leading spine */
    const pecs = [];
    if (!lite) for (const sd of [-1, 1]) {
      const p = new T.Object3D(); p.position.set(0.0295, -0.0035, sd * 0.0102); p.rotation.order = 'YXZ'; p.rotation.set(0, sd * 0.35, 0.12); g.add(p);
      p.add(new T.Mesh(finSheet(c => [0, -0.0034 + c * 0.0068, 0], c => [-0.017 + 0.004 * Math.pow(Math.abs(2 * c - 1.3), 2), -0.004 + c * 0.0115, 0], 5, 12, 0.0006 * sd), finM(12, 0, [236, 228, 196], { base: 0.55, edge: 0.12 })));
      pecs.push({ p, sd });
      const v = new T.Object3D(); const [, h, cy] = RF.prof(0.026); v.position.set(0.026, cy - h + 0.003, sd * 0.004); v.rotation.order = 'YXZ'; v.rotation.set(sd * 0.35, sd * 0.15, -0.55); g.add(v);
      v.add(new T.Mesh(finSheet(c => [0, 0, -c * 0.0024 * sd], c => [-0.0135 + 0.003 * c, -0.0016 * c, -c * 0.0026 * sd], 4, 6), finM(6, 1, [242, 240, 232], { base: 0.8, edge: 0.3 })));
    }
    if (lite) {
      /* (one geometry, for drawing many: the body, its fins and its eyes, a dark pupil in a gold ring, with their colours) */
      const [w] = RF.prof(0.0438);
      for (const sd of [-1, 1]) {
        const ring = new T.SphereGeometry(0.0047, 10, 8); ring.scale(1, 1, 0.5); ring.translate(0.0438, 0.0047, sd * (w - 0.0008)); parts.push({ geo: ring, c: [0.62, 0.45, 0.12] });
        const pup = new T.SphereGeometry(0.0028, 8, 6); pup.scale(1, 1, 0.5); pup.translate(0.0441, 0.0047, sd * (w + 0.0006)); parts.push({ geo: pup, c: [0.01, 0.01, 0.012] });
      }
      g.userData.parts = M.mergeC([{ geo: body }, ...parts]);
      return g;
    }
    g.userData.anim = (t, flying) => { tail.rotation.y = (flying ? 0.5 : 0.22) * Math.sin(t * (flying ? 14 : 4)); for (const p of pecs) p.p.rotation.y = p.sd * (0.35 + 0.3 * Math.sin(t * 6 + p.sd)); };
    g.userData.anim(0);
    return g;
  });

  /* ── a cleaner shrimp: a translucent red body with a white stripe along its back, white antennae ── */
  /* ── a cleaner shrimp, 6 cm: the carapace over its front, a toothed rostrum jutting from between the eyes; the six
     segments of its abdomen arched down toward the tail fan, each overlapping the next, their side plates hanging down;
     red down each flank, a white stripe along the middle of its back from the rostrum to the tail, translucent; stalked
     black eyes; five pairs of slender jointed legs, the first two with tiny pincers; the swimmerets fringed beneath; the
     tail fan of five blades, red tipped white; three long white antennae either side ── */
  M.add('life/shrimp', () => {
    const g = new T.Group(), red = lin('#cf3424'), redD = lin('#8a1c12'), white = lin('#f7f3ec'), clear = lin('#f0c8b0'), amber = lin('#e7a14e');
    /* the body, lofted along x from the tail (−0.027) to the tip of the rostrum (0.034), and bent down behind the carapace */
    const XB = 0.004, KAP = 20, NSEG = 6;
    const bend = (x, y, z) => { if (x >= XB) return [x, y, z]; const sArc = XB - x, ph = KAP * sArc, r = 1 / KAP + y; return [XB - r * Math.sin(ph), -1 / KAP + r * Math.cos(ph), z]; };
    const segAt = x => x >= XB ? -1 : Math.min(NSEG - 1, Math.floor((XB - x) / 0.031 * NSEG));
    const body = M.loft([[-0.027, 0, 0, 0, 2], [-0.025, 0.0018, 0.0026, 0.0, 2], [-0.018, 0.0028, 0.0036, 0.0002, 2], [-0.008, 0.0038, 0.0047, 0.0004, 2], [0.0, 0.0047, 0.0055, 0.0006, 2],
      [0.008, 0.0052, 0.0062, 0.0008, 2.1], [0.016, 0.005, 0.006, 0.0008, 2.1], [0.022, 0.0036, 0.0045, 0.0009, 2], [0.026, 0.0016, 0.0024, 0.0016, 2], [0.034, 0, 0, 0.0028, 2]], 120, 36,
      (x, y, z, u, a) => {
        const up = Math.cos(a), sg = segAt(x), f = sg >= 0 ? ((XB - x) / 0.031 * NSEG) % 1 : 0;
        /* (as Lysmata amboinensis is: a broad red band along each side of its back, split down the middle by a thin
           white line; yellow-orange flanks below it, clearer beneath) */
        let c = mix(amber, clear, sm(-0.15, -0.65, up));
        c = mix(c, red, sm(0.12, 0.3, up));
        if (up > 0.9) c = mix(red, white, sm(0.9, 0.95, up));
        if (up < -0.6) c = mix(c, clear, 0.6);
        if (sg >= 0 && f < 0.1) c = mix(c, redD, 0.5);                     /* each segment's edge, a darker line */
        if (x > 0.026) c = mix(red, white, 0.5);                           /* the rostrum */
        return c;
      }, { shape: (x, y, z, u, a) => {
        /* the segments: each a little swollen toward its back edge, which overlaps the next; their side plates hang down */
        const sg = segAt(x), f = sg >= 0 ? ((XB - x) / 0.031 * NSEG) % 1 : 0, k = sg >= 0 ? 1 + 0.06 * f : 1;
        const down = sg >= 0 && Math.cos(a) < -0.2 ? 0.0011 * Math.sin(Math.PI * f) * (1 - sg / 7) : 0;
        /* (the rostrum's teeth, along its top) */
        const teeth = x > 0.024 && Math.cos(a) > 0.5 ? 0.0003 * Math.max(0, Math.sin(x * 2600)) : 0;
        return bend(x, y * k - down + teeth, z * k);
      } });
    g.add(new T.Mesh(body, M.litP('#ffffff', { vertexColors: true, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15, transparent: true, opacity: 0.93 })));
    const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.4 });
    const tubeOf = (pts, r0, r1, col) => new T.Mesh(M.paint(M.tube(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 12, 6, t => r0 + (r1 - r0) * t), (x, y, z) => typeof col === 'function' ? col(x, y, z) : col), legM);
    /* five pairs of walking legs from under the carapace, jointed: out, then down to the ground; banded red and white */
    const band = (x, y) => (Math.floor(-y * 900) % 2 ? red : white);
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) {
      const x0 = 0.017 - i * 0.0035, k = i < 2 ? 0.8 : 1;
      g.add(tubeOf([[x0, -0.003, sd * 0.002], [x0 + 0.0025 * k, -0.0055, sd * 0.0075], [x0 + 0.004 * k - i * 0.001, -0.0118, sd * 0.0095]], 0.0005, 0.00025, band));
      /* (the first two pairs end in tiny pincers) */
      if (i < 2) for (const t of [-1, 1]) g.add(tubeOf([[x0 + 0.004 * k - i * 0.001, -0.0118, sd * 0.0095], [x0 + 0.0058 * k - i * 0.001, -0.0124 + t * 0.0004, sd * 0.0098]], 0.00025, 0.0001, white));
    }
    /* the swimmerets under the abdomen, feathery paddles */
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) { const x = XB - (i + 0.5) * 0.031 / NSEG, p0 = bend(x, -0.0035, sd * 0.0016), p1 = bend(x - 0.0012, -0.0085, sd * 0.0028); g.add(tubeOf([p0, p1], 0.0004, 0.0002, clear)); }
    /* the tail fan at the end of the abdomen, turned as the abdomen ends: the telson in the middle, two blades either side */
    {
      const ph = KAP * (XB + 0.027), end = bend(-0.0262, 0, 0), fan = new T.Object3D(); fan.position.set(...end); fan.rotation.z = ph; g.add(fan);
      const fanM = M.lit('#ffffff', { vertexColors: true, roughness: 0.35, side: T.DoubleSide, transparent: true, opacity: 0.95 });
      const blade = (ang, len, w) => M.sheet(6, 8, (s, c) => { const a = ang + (c - 0.5) * w; return [-Math.cos(a) * s * len, 0.0002 * Math.sin(Math.PI * c), Math.sin(a) * s * len]; }, (s, c) => mix(mix(red, amber, 0.35), white, s > 0.7 && Math.abs(c - 0.5) < 0.32 ? 0.9 : 0.08 * Math.sin(c * 20)));
      fan.add(new T.Mesh(blade(0, 0.0105, 0.32), fanM));
      for (const sd of [-1, 1]) for (const [ang, len] of [[0.42, 0.011], [0.78, 0.0095]]) fan.add(new T.Mesh(blade(sd * ang, len, 0.36), fanM));
    }
    /* the eyes on short stalks, either side of the rostrum's base */
    const eyeM = M.litP('#070707', { roughness: 0.12, clearcoat: 1 }), ants = [];
    for (const sd of [-1, 1]) {
      g.add(tubeOf([[0.023, 0.0035, sd * 0.0012], [0.0262, 0.0045, sd * 0.0032]], 0.0007, 0.0007, red));
      const e = new T.Mesh(new T.SphereGeometry(0.0016, 14, 10), eyeM); e.position.set(0.0268, 0.0047, sd * 0.0037); g.add(e);
      /* three long white antennae a side, waving */
      for (let k = 0; k < 3; k++) { const a = new T.Object3D(); a.position.set(0.026, 0.002, sd * 0.0018); g.add(a); ants.push({ a, sd, k });
        a.add(tubeOf([[0, 0, 0], [0.018, 0.006 + k * 0.004, sd * (0.004 + k * 0.004)], [0.04, 0.01 + k * 0.009, sd * (0.01 + k * 0.009)], [0.056, 0.006 + k * 0.012, sd * (0.016 + k * 0.012)]], 0.00032, 0.0001, white)); }
    }
    g.userData.anim = t => { for (const n of ants) { n.a.rotation.z = 0.18 * Math.sin(t * (1.8 + n.k * 0.6) + n.sd); n.a.rotation.y = n.sd * 0.15 * Math.sin(t * (1.3 + n.k * 0.4)); } };
    g.userData.anim(0);
    return g;
  });
})();
