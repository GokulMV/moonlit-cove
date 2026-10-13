/* a dragonfly, the four colours the beach has (o.kind: 0 blue, 1 green, 2 red, 3 amber): two huge compound eyes meeting
   on top of its head, a stout striped thorax, a long slender abdomen ringed in black at every segment; four clear
   wings, each netted with fine veins and a dark spot near its tip; six spiny legs held forward under it.
   At the origin in metres, its head toward +x; about 5 cm long, its wings 7 cm across. userData.anim(t): the wings
   quiver, the head turns */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const COL = ['#4a76c4', '#3f9a4a', '#c8301a', '#d08a30'].map(h => { const c = new T.Color(h); return [c.r, c.g, c.b]; });
  const EYE = ['#1d4a78', '#2f6a30', '#6a2016', '#5a4420'];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  let wingTex = null;
  function paintWing() {
    /* clear, faintly smoky, netted with veins: the thick leading edge (costa) and the long veins behind it running out to
       the tip; between them the cross-veins, ladder-like near the front, a net of little polygonal cells toward the back
       and the edge; the nodus partway along; the pterostigma, a dark cell near the tip */
    const W = 1024, H = 256, cv = M.canvas(W, H), x = cv.getContext('2d'), r = M.rng(77);
    x.fillStyle = 'rgba(190,200,208,0.2)'; x.fillRect(0, 0, W, H);
    const lines = [8, 22, 40, 64, 92, 124, 160, 198];
    const vy = (k, u) => { const y0 = lines[k] * 0.55 + 4, y1 = lines[k] * 0.9 + 6; return y0 + (y1 - y0) * u + Math.sin(u * 3 + k) * 2; };
    x.strokeStyle = 'rgba(28,30,34,0.95)'; x.lineWidth = 9; x.beginPath(); x.moveTo(0, 5); x.lineTo(W, 8); x.stroke();
    x.lineWidth = 4; x.strokeStyle = 'rgba(32,34,40,0.8)';
    for (let k = 1; k < lines.length; k++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40; i ? x.lineTo(u * W, vy(k, u)) : x.moveTo(0, vy(k, 0)); } x.stroke(); }
    /* the cross-veins between each pair of long veins, closer toward the tip; and the cells, broken up, behind */
    x.lineWidth = 2.2; x.strokeStyle = 'rgba(38,40,46,0.62)';
    for (let k = 0; k < lines.length - 1; k++) {
      const n = 34 + k * 7;
      for (let i = 0; i < n; i++) { const u = (i + r() * 0.6) / n; if (u > 0.995) continue; const ya = k ? vy(k, u) : 6, yb = vy(k + 1, u); const w = (r() - 0.5) * 8; x.beginPath(); x.moveTo(u * W, ya); x.lineTo(u * W + w, yb); x.stroke(); }
    }
    for (let i = 0; i < 420; i++) { const u = r(), v = 150 + r() * (H - 150); x.beginPath(); x.moveTo(u * W, v); x.lineTo(u * W + 4 + r() * 7, v + (r() - 0.5) * 9); x.stroke(); }
    /* the nodus, a notch in the leading edge partway out; the pterostigma near the tip */
    x.fillStyle = 'rgba(28,30,34,0.9)'; x.fillRect(W * 0.46, 2, 5, 18);
    x.fillStyle = 'rgba(24,18,14,0.94)'; x.beginPath(); x.moveTo(W * 0.84, 4); x.lineTo(W * 0.915, 6); x.lineTo(W * 0.905, 19); x.lineTo(W * 0.835, 17); x.closePath(); x.fill();
    const t = Mats.tex(cv); t.flipY = false; t.needsUpdate = true; t.userData.keep = true; return t;
  }
  M.add('life/dragonfly', (o = {}) => {
    const kind = Math.max(0, Math.min(3, o.kind | 0)), g = new T.Group(), col = COL[kind], black = [0.02, 0.02, 0.025];
    wingTex = wingTex || paintWing();
    const bodyM = M.litP('#ffffff', { vertexColors: true, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.35 });
    /* the abdomen: long and slender, a black ring at each of its ten segments, the tip a little clubbed */
    const abd = M.loft([[-0.046, 0, 0, 0, 2], [-0.044, 0.0011, 0.0012, 0, 2], [-0.03, 0.0009, 0.001, 0, 2], [-0.012, 0.001, 0.0011, 0, 2], [-0.006, 0.0014, 0.0016, 0, 2], [-0.002, 0.0021, 0.0022, 0, 2], [0, 0, 0, 0, 2]], 60, 12,
      (x, y, z, u) => { const seg = (u * 10) % 1; return seg < 0.16 ? black : mix(col, col.map(v => v * 0.55), y > 0 ? 0 : 0.5); });
    const thx = M.loft([[-0.003, 0, 0, 0.0004, 2], [-0.002, 0.0028, 0.0032, 0.0006, 2], [0.004, 0.0034, 0.0042, 0.001, 2], [0.0085, 0.0028, 0.0034, 0.001, 2], [0.0095, 0, 0, 0.001, 2]], 20, 18,
      (x, y, z) => { const stripe = Math.abs(Math.sin((x * 900 + z * 300))) > 0.8 ? 1 : 0; return stripe ? black : mix(col, [0.9, 0.85, 0.5], kind === 3 ? 0.2 : 0); });
    g.add(new T.Mesh(M.mergeC([{ geo: abd }, { geo: thx }]), bodyM));
    /* the head and its eyes: two great domes that meet along the top of the head, finely faceted, darker above and paler
       below; in front, below them, the face, its own colour */
    const head = new T.Object3D(); head.position.set(0.0102, 0.0012, 0); g.add(head);
    const eyeC = new T.Color(EYE[kind]), eyeA = [eyeC.r, eyeC.g, eyeC.b];
    const eyeG = new T.SphereGeometry(0.0034, 40, 30); eyeG.scale(0.92, 1, 0.86);
    M.paint(eyeG, (x, y, z) => { const fac = 0.86 + 0.14 * Math.abs(Math.sin(x * 21000) * Math.sin(y * 21000 + 1.3) * Math.sin(z * 21000 + 2.1)), up = y / 0.0034; const k = up > 0.35 ? 0.35 + 0.3 * (1 - up) : 0.75 + 0.35 * (0.35 - up); return eyeA.map(v => Math.min(1, v * k * fac)); });
    const eyeM = M.litP('#ffffff', { vertexColors: true, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.3 });
    for (const sd of [-1, 1]) { const e = new T.Mesh(eyeG, eyeM); e.position.set(0.0006, 0.0014, sd * 0.002); e.rotation.x = sd * 0.25; head.add(e); }
    const FACE = [[0.62, 0.72, 0.42], [0.42, 0.62, 0.22], [0.72, 0.22, 0.08], [0.78, 0.6, 0.25]][kind];
    const face = new T.Mesh(M.paint(new T.SphereGeometry(0.0021, 20, 14), (x, y) => y < -0.0012 ? FACE.map(v => v * 0.7) : FACE), M.lit('#ffffff', { vertexColors: true, roughness: 0.45 }));
    face.position.set(0.0017, -0.0016, 0); face.scale.set(0.45, 0.72, 1.0); head.add(face);
    /* the wings: four, long and narrow, held out flat */
    /* (the painting runs along the wing, root to tip, its leading edge along the top: the sheet's uv turned to match) */
    const wingG = (len, w0, w1) => { const geo = M.sheet(24, 8, (s, c) => { const w = (w0 + (w1 - w0) * s) * Math.sin(Math.PI * Math.min(1, 0.08 + s * 0.95)) ** 0.4; return [-(c - 0.15) * w, 0, 0.0018 + s * len]; });
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) { const a = uv.getX(i), b = uv.getY(i); uv.setXY(i, b, a); } return geo; };
    const wm = new T.MeshPhysicalMaterial({ map: wingTex, transparent: true, side: T.DoubleSide, roughness: 0.18, metalness: 0, iridescence: 0.7, iridescenceIOR: 1.5, iridescenceThicknessRange: [250, 600], depthWrite: false });
    const wings = [];
    for (const sd of [-1, 1]) for (const [x0, len, w0, w1, a] of [[0.0055, 0.035, 0.0068, 0.0052, 0.05], [0.0012, 0.033, 0.0098, 0.0062, -0.08]]) {
      const h = new T.Object3D(); h.position.set(x0, 0.0034, sd * 0.0014); h.rotation.y = a * sd; g.add(h);
      const m = new T.Mesh(wingG(len, w0, w1), wm); if (sd < 0) m.scale.z = -1; h.add(m); wings.push({ h, sd, ph: x0 * 500 });
    }
    /* the legs: six, spiny, held forward and folded under the thorax */
    const legM = M.lit('#141414', { roughness: 0.6 });
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x0 = 0.007 - i * 0.002, pts = [new T.Vector3(x0, -0.0024, sd * 0.0012), new T.Vector3(x0 + 0.002, -0.0055, sd * 0.004), new T.Vector3(x0 + 0.0055 - i * 0.002, -0.0072, sd * 0.0048)];
      g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3(pts), 10, 4, t => 0.0003 * (1 - 0.5 * t)), legM));
    }
    g.userData.anim = (t, flying) => {
      for (const w of wings) w.h.rotation.x = -w.sd * (flying ? 0.4 * Math.sin(t * 160 + w.ph) : 0.04 * Math.sin(t * 9 + w.ph) + 0.02);
      head.rotation.y = 0.25 * Math.sin(t * 0.8); head.rotation.z = 0.1 * Math.sin(t * 1.3);
    };
    g.userData.anim(0);
    return g;
  });
})();

/* a firefly, held in a cupped hand: a soft-bodied beetle, its wing cases black edged with yellow, the shield over its head
   pink-orange with a black spot, and under the tip of its abdomen the pale lantern that glows yellow-green; feathery
   antennae, six legs. At the origin in metres, its head toward +x; about 1.5 cm long. userData.anim(t): it flashes */
Models.add('life/firefly', () => {
  const T = THREE, M = Models, g = new T.Group(), mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const black = [0.03, 0.028, 0.025], yellow = [0.8, 0.6, 0.08], pink = [0.85, 0.35, 0.22], pale = [0.85, 0.82, 0.55];
  /* the wing cases: two long shells over its back, black with yellow edges */
  /* (flat, lens-shaped in section, the pair meeting down the middle of its back in a thin seam, domed a little side
     to side; the yellow only along the outer edge) */
  const elytron = sd => M.loft([[-0.0088, 0, 0, 0.0017, 2.1], [-0.0078, 0.0013, 0.0005, 0.0018, 2.15], [-0.006, 0.0021, 0.00075, 0.0019, 2.2], [-0.002, 0.0025, 0.0009, 0.002, 2.2], [0.0025, 0.0025, 0.00088, 0.002, 2.2], [0.0045, 0.002, 0.0007, 0.002, 2.15], [0.0053, 0, 0, 0.0019, 2.1]], 40, 32,
    (x, y, z, u, a) => { const e = sd * Math.sin(a); return e > 0.8 ? yellow : mix3(black, [0.09, 0.075, 0.05], 0.4 * M.vn(x * 8000, y * 8000, z * 8000)); }, { shape: (x, y, z) => { const Z = z + sd * 0.0019; return [x, y - 55 * Z * Z, Z]; } });
  const body = M.loft([[-0.0095, 0, 0, 0.0006], [-0.008, 0.0014, 0.0008, 0.0007], [-0.002, 0.0018, 0.001, 0.0009], [0.004, 0.0016, 0.0009, 0.001], [0.006, 0, 0, 0.001]], 16, 12, (x, y) => x < -0.0045 && y < 0.0008 ? pale : black);
  /* (the shield over its head: a rounded hood, pink with a black spot in the middle and a pale yellow rim) */
  const shield = M.loft([[0.0044, 0, 0, 0.0021, 2.1], [0.0049, 0.0025, 0.0006, 0.0022, 2.1], [0.0062, 0.0029, 0.0008, 0.0021, 2.1], [0.0076, 0.0024, 0.00065, 0.0019, 2.1], [0.0085, 0, 0, 0.0016, 2]], 28, 32,
    (x, y, z) => { const d = Math.hypot((x - 0.0063) / 1.2, z); return d < 0.0007 ? black : d > 0.0023 ? mix3(pink, yellow, 0.6) : pink; }, { shape: (x, y, z) => [x, y - 40 * z * z, z] });
  const shell = new T.Mesh(M.mergeC([{ geo: elytron(1) }, { geo: elytron(-1) }, { geo: shield }, { geo: body }]), M.litP('#ffffff', { vertexColors: true, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.4 }));
  g.add(shell);
  /* the lantern: the last segments beneath, glowing */
  const lampM = new T.MeshBasicMaterial({ color: new T.Color(0.5, 0.65, 0.12) });
  const lamp = new T.Mesh(new T.SphereGeometry(1, 14, 10), lampM); lamp.scale.set(0.0024, 0.0011, 0.0016); lamp.position.set(-0.0075, 0.0001, 0); g.add(lamp);
  const glow = new T.PointLight(0xc8ff60, 0, 0.05, 2); glow.position.set(-0.0075, -0.002, 0); g.add(glow);
  /* head, eyes, antennae, legs */
  const eyeM = M.litP('#121212', { roughness: 0.1, clearcoat: 1 });
  for (const sd of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(0.0007, 10, 8), eyeM); e.position.set(0.0078, 0.0009, sd * 0.0008); g.add(e);
    g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.0082, 0.0012, sd * 0.0005), new T.Vector3(0.011, 0.003, sd * 0.0018), new T.Vector3(0.014, 0.0038, sd * 0.0035)]), 10, 4, () => 0.00012), M.lit('#1a1a1a')));
    for (let i = 0; i < 3; i++) { const x0 = 0.004 - i * 0.003; g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(x0, 0.0004, sd * 0.001), new T.Vector3(x0 + 0.0008, -0.0014, sd * 0.0034), new T.Vector3(x0 + 0.0014 - i * 0.001, -0.003, sd * 0.0042)]), 6, 3, () => 0.00015), M.lit('#151515'))); }
  }
  g.userData.anim = t => {
    /* a flash every couple of seconds: up quick, down slow */
    const u = (t % 2.4) / 2.4, f = u < 0.06 ? u / 0.06 : Math.exp(-(u - 0.06) / 0.12);
    lampM.color.setRGB(0.5 + 3.5 * f, 0.65 + 4.2 * f, 0.12 + 0.9 * f); glow.intensity = 0.004 * f;
  };
  g.userData.anim(0);
  return g;
});
