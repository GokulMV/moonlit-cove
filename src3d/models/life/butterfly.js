/* a butterfly, the four the forest edge has: o.kind 0 a plain tiger (orange, black-veined, a black border with white
   dots), 1 a lemon emigrant (pale yellow, an orange spot), 2 a cabbage white (dark forewing tips), 3 a common blue
   (blue, a dark border, a white fringe). A head with big compound eyes, clubbed antennae and its tongue coiled under
   it; a furred thorax; a ringed abdomen; six jointed legs; four painted wings, each its own shape. At the origin in
   metres, its head toward +x, wings over +y. userData.anim(t): the wings open and close, the antennae twitch */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  /* the wings' outlines, in the plane of the wing: x along the body (+x forward), z out from it (right wing; mirrored for
     the left). A Catmull-Rom loop through these points */
  const FORE = [[0.0026, 0.0012], [0.0058, 0.009], [0.0078, 0.019], [0.0072, 0.0285], [0.0042, 0.0325], [-0.0006, 0.0318], [-0.0058, 0.0262], [-0.0098, 0.0196], [-0.0108, 0.0128], [-0.0062, 0.0042], [-0.0016, 0.0012]];
  const HIND = [[0.0006, 0.0012], [-0.0002, 0.0092], [-0.0034, 0.0196], [-0.0092, 0.0236], [-0.0152, 0.0214], [-0.0196, 0.0156], [-0.0206, 0.0086], [-0.0168, 0.0032], [-0.0082, 0.0004]];
  function loop(pts, n) {
    const c = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), true, 'centripetal');
    return c.getSpacedPoints(n).slice(0, n).map(p => [p.x, p.z]);
  }
  const bounds = pts => { let x0 = 1, x1 = -1, z0 = 1, z1 = -1; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, x1, z0, z1]; };
  /* a wing: its outline triangulated into a fan of rings from the root, so it can bend smoothly; uv over its bounds */
  function wingGeo(outline, root) {
    const O = loop(outline, 72), B = bounds(O), pos = [], uv = [], idx = [], R = 8;
    for (let r = 0; r <= R; r++) for (let i = 0; i < O.length; i++) {
      const f = r / R, x = root[0] + (O[i][0] - root[0]) * f, z = root[1] + (O[i][1] - root[1]) * f;
      /* a little curl down toward the edges, and a ripple along them */
      const y = -0.0012 * f * f + 0.0003 * Math.sin(i * 0.7) * f;
      pos.push(x, y, z); uv.push((x - B[0]) / (B[1] - B[0]), (z - B[2]) / (B[3] - B[2]));
    }
    const N = O.length;
    for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) { const a = r * N + i, b = r * N + (i + 1) % N, c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return { g, B, O };
  }
  /* the wings painted: in the wing's own plane, through its outline (so veins run from the root to the edge) */
  const PAL = [
    { base: '#ee7a1c', vein: '#1a120c', edge: '#120d0a', dot: '#ffffff', under: '#e9a65a' },
    { base: '#f3e27a', vein: '#c8a63a', edge: '#e6c845', dot: '#f08a1e', under: '#eee7a8' },
    { base: '#f6f4ec', vein: '#c9c6b8', edge: '#3a3a38', dot: '#2c2c2a', under: '#ecefd6' },
    { base: '#5f8ff0', vein: '#2b4aa0', edge: '#1d2338', dot: '#ffffff', under: '#c9c3bd' }];
  const cache = new Map();
  function paintWing(kind, fore, under) {
    const key = kind + (fore ? 'f' : 'h') + (under ? 'u' : ''); if (cache.has(key)) return cache.get(key);
    const P = PAL[kind], S = 512, cv = M.canvas(S, S), x = cv.getContext('2d'), O = loop(fore ? FORE : HIND, 120), B = bounds(O);
    const px = ([wx, wz]) => [(wx - B[0]) / (B[1] - B[0]) * S, (wz - B[2]) / (B[3] - B[2]) * S];
    const root = px(fore ? [0.0004, 0.0012] : [-0.0022, 0.0012]);
    x.fillStyle = under ? P.under : P.base; x.fillRect(0, 0, S, S);
    /* a soft darker flush at the root, where the scales are furred */
    const gr = x.createRadialGradient(root[0], root[1], 0, root[0], root[1], S * 0.5); gr.addColorStop(0, 'rgba(40,25,10,0.45)'); gr.addColorStop(1, 'rgba(40,25,10,0)'); x.fillStyle = gr; x.fillRect(0, 0, S, S);
    const outline = () => { x.beginPath(); O.forEach((p, i) => { const q = px(p); i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]); }); x.closePath(); };
    /* the markings of each kind */
    if (kind === 0) {
      if (fore && !under) { /* the tip black, crossed by a band of white spots */
        x.save(); outline(); x.clip(); const ap = px([0.004, 0.031]); x.fillStyle = P.edge; x.beginPath(); x.ellipse(ap[0], ap[1], S * 0.42, S * 0.36, 0.6, 0, TAU); x.fill();
        x.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { const q = px([0.0035 - i * 0.0022, 0.026 - i * 0.0012]); x.beginPath(); x.ellipse(q[0], q[1], 9, 6, 0.4, 0, TAU); x.fill(); } x.restore();
      }
      if (!fore) { x.fillStyle = 'rgba(20,14,10,0.9)'; for (const p of [[-0.0062, 0.0084], [-0.0092, 0.0114], [-0.0042, 0.0118]]) { const q = px(p); x.beginPath(); x.arc(q[0], q[1], 11, 0, TAU); x.fill(); } }
    } else if (kind === 1) {
      const q = px(fore ? [-0.002, 0.016] : [-0.008, 0.012]); x.fillStyle = P.dot; x.beginPath(); x.ellipse(q[0], q[1], fore ? 22 : 30, fore ? 16 : 22, 0.3, 0, TAU); x.fill();
    } else if (kind === 2) {
      if (fore) { x.save(); outline(); x.clip(); const ap = px([0.005, 0.032]); x.fillStyle = P.edge; x.beginPath(); x.ellipse(ap[0], ap[1], S * 0.3, S * 0.22, 0.5, 0, TAU); x.fill(); x.restore();
        x.fillStyle = P.dot; for (const p of [[-0.0018, 0.019], [-0.005, 0.014]]) { const q = px(p); x.beginPath(); x.arc(q[0], q[1], 14, 0, TAU); x.fill(); } }
    } else if (kind === 3 && under) {
      /* the blue's underside: grey-fawn with rows of black-centred eyespots and an orange band near the edge */
      for (let i = 0; i < 14; i++) { const q = px([B[0] + (B[1] - B[0]) * (0.25 + 0.5 * ((i * 0.61) % 1)), B[2] + (B[3] - B[2]) * (0.3 + 0.55 * ((i * 0.37) % 1))]); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(q[0], q[1], 9, 0, TAU); x.fill(); x.fillStyle = '#151515'; x.beginPath(); x.arc(q[0], q[1], 5, 0, TAU); x.fill(); }
    }
    /* the veins: from the root out to the edge, and the cell's cross-vein */
    x.strokeStyle = P.vein; x.lineCap = 'round';
    const nv = fore ? 9 : 8;
    for (let i = 0; i < nv; i++) {
      const e = px(O[Math.floor((fore ? 6 : 10) + i * (fore ? 11 : 12)) % O.length]);
      x.lineWidth = kind === 0 ? (under ? 6 : 8) : 2.5; x.beginPath(); x.moveTo(root[0], root[1]);
      x.quadraticCurveTo((root[0] + e[0]) / 2 + 20, (root[1] + e[1]) / 2 - 10, e[0], e[1]); x.stroke();
    }
    /* the border: dark, with white dots in two rows (the tiger), or a dark band and a white fringe (the blue) */
    x.save(); outline(); x.lineWidth = kind === 0 ? 46 : kind === 3 && !under ? 30 : kind === 2 && !fore ? 0 : 10; x.strokeStyle = kind === 1 ? P.edge : kind === 2 ? 'rgba(60,60,58,0.5)' : P.edge; if (x.lineWidth) x.stroke();
    if (kind === 0) { x.clip(); x.fillStyle = '#ffffff'; for (let i = 0; i < O.length; i += 6) { const q = px(O[i]), c = px([(B[0] + B[1]) / 2, (B[2] + B[3]) / 2]), d = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1; for (const f of [14, 30]) { x.beginPath(); x.arc(q[0] - (q[0] - c[0]) / d * f, q[1] - (q[1] - c[1]) / d * f, f < 20 ? 4.5 : 3.5, 0, TAU); x.fill(); } } }
    if (kind === 3 && !under) { x.lineWidth = 10; x.strokeStyle = '#f4f4f0'; x.stroke(); }
    x.restore();
    /* a fine scale texture over all */
    const id = x.getImageData(0, 0, S, S), d = id.data, r = M.rng(kind * 7 + (fore ? 1 : 2));
    for (let i = 0; i < d.length; i += 4) { const k = 0.92 + 0.16 * r(); d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    x.putImageData(id, 0, 0);
    /* (painted with z down the canvas, as the wing's uv runs) */
    const tex = Mats.tex(cv); tex.flipY = false; tex.needsUpdate = true; tex.userData.keep = true; cache.set(key, tex); return tex;
  }

  M.add('life/butterfly', (o = {}) => {
    const kind = Math.max(0, Math.min(3, o.kind | 0)), g = new T.Group(), P = PAL[kind];
    const dark = lin(kind === 2 ? '#3b3a36' : kind === 3 ? '#2a2f3d' : '#2a1d14'), fur = lin(kind === 2 ? '#c9c4b0' : kind === 3 ? '#5b6a8a' : '#3a2a1c');
    /* the body: thorax furred, the abdomen ringed, the head with its eyes */
    const bodyM = M.lit('#ffffff', { vertexColors: true, roughness: 0.8 });
    const abd = M.loft([[-0.0215, 0, 0, 0.0006, 2], [-0.02, 0.0009, 0.0009, 0.0007, 2], [-0.014, 0.0016, 0.0017, 0.0009, 2], [-0.006, 0.0019, 0.0021, 0.001, 2], [-0.0025, 0.0016, 0.0018, 0.001, 2], [-0.001, 0, 0, 0.001, 2]], 30, 16,
      (x, y, z, u) => { const ring = 0.5 + 0.5 * Math.cos(u * TAU * 4.5); return mix(dark, fur, 0.35 * ring + (y < 0.0008 ? 0.3 : 0)); });
    const thx = new T.SphereGeometry(1, 18, 14); thx.scale(0.0042, 0.0029, 0.0029); thx.translate(0.0012, 0.0012, 0);
    M.paint(thx, (x, y, z) => mix(dark, fur, 0.5 + 0.5 * M.vn(x * 3000, y * 3000, z * 3000)));
    const head = new T.SphereGeometry(0.0021, 16, 12); head.translate(0.006, 0.0013, 0); M.paint(head, () => dark);
    g.add(new T.Mesh(M.mergeC([{ geo: abd }, { geo: thx }, { geo: head }]), bodyM));
    /* the compound eyes: big, dark, glossy */
    const eyeM = M.litP('#2b2016', { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    for (const sd of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.0015, 16, 12), eyeM); e.position.set(0.0067, 0.0017, sd * 0.0014); g.add(e); }
    /* the tongue, coiled up under the head */
    const coil = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 2.2, r = 0.0011 * (1 - i / 48); coil.push(new T.Vector3(0.0078 + r * Math.cos(a) * 0.5, -0.0002 - r * Math.sin(a), 0)); }
    g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3(coil), 60, 5, () => 0.00018), M.lit('#3a2a1a', { roughness: 0.6 })));
    /* the antennae: thin, each ending in a club */
    const antM = M.lit(kind === 2 ? '#2e2e2a' : '#1e1612', { roughness: 0.6 }), ants = [];
    for (const sd of [-1, 1]) {
      const a = new T.Object3D(); a.position.set(0.0072, 0.0028, sd * 0.0008); g.add(a);
      a.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(0.004, 0.005, sd * 0.002), new T.Vector3(0.0085, 0.0085, sd * 0.0042)]), 20, 5, () => 0.00017), antM));
      const club = new T.Mesh(new T.SphereGeometry(0.0006, 10, 8), antM); club.scale.set(1.8, 1, 1); club.position.set(0.0087, 0.0087, sd * 0.0043); club.rotation.z = 0.8; a.add(club); ants.push({ a, sd });
    }
    /* six legs, folded under */
    const legM = M.lit(kind === 2 ? '#3a3a34' : '#2a1e14', { roughness: 0.7 });
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x0 = 0.0028 - i * 0.0018, pts = [new T.Vector3(x0, -0.0004, sd * 0.001), new T.Vector3(x0 + 0.002 - i * 0.0018, -0.0022, sd * 0.0042), new T.Vector3(x0 + 0.003 - i * 0.004, -0.0058, sd * 0.0055)];
      g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3(pts), 12, 4, t => 0.00028 * (1 - 0.5 * t)), legM));
    }
    /* the wings, hinged at the thorax: forewing and hindwing on each side, painted above and below */
    const wings = [];
    const fw = wingGeo(FORE, [0.0004, 0.0012]), hw = wingGeo(HIND, [-0.0022, 0.0012]);
    for (const sd of [1, -1]) {
      const hinge = new T.Object3D(); hinge.position.set(0, 0.0024, sd * 0.0012); g.add(hinge);
      for (const [W, fore] of [[fw, true], [hw, false]]) {
        const top = new T.Mesh(W.g, M.lit('#ffffff', { map: paintWing(kind, fore, false), roughness: 0.62, side: T.FrontSide }));
        const bot = new T.Mesh(W.g, M.lit('#ffffff', { map: paintWing(kind, fore, true), roughness: 0.7, side: T.BackSide }));
        const w = new T.Group(); w.add(top, bot); if (sd < 0) w.scale.z = -1; hinge.add(w);
        /* (mirrored, the left wing's faces turn inside out: swap which side shows which painting) */
        if (sd < 0) { top.material.side = T.BackSide; bot.material.side = T.FrontSide; }
        if (!fore) w.position.y = -0.0002;
      }
      wings.push({ hinge, sd });
    }
    g.userData.anim = (t, flying) => {
      /* resting with its wings half up, opening and closing slowly, a quick flutter now and then; in flight, beating */
      const slow = 0.5 + 0.5 * Math.sin(t * 1.6), flut = Math.max(0, Math.sin(t * 0.37)) ** 8 * Math.sin(t * 40) * 0.5;
      const a = flying ? 0.75 + 0.75 * Math.sin(t * 34) : Math.min(1.5, 0.25 + 1.05 * slow * slow + flut);
      for (const w of wings) w.hinge.rotation.x = -w.sd * a;
      for (const n of ants) n.a.rotation.z = 0.06 * Math.sin(t * 2.3 + n.sd);
    };
    g.userData.anim(0);
    return g;
  });
})();
