/* a dragonfly, the four colours the beach has (o.kind: 0 blue, 1 green, 2 red, 3 amber): two huge compound eyes meeting
   on top of its head, a stout striped thorax, a long slender abdomen ringed in black at every segment; four clear
   wings, each netted with fine veins and a dark spot near its tip; six spiny legs held forward under it.
   At the origin in metres, its head toward +x; about 5 cm long, its wings 7 cm across. userData.anim(t): the wings
   quiver, the head turns */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const COL = ['#1f52e8', '#2a9a3c', '#d42a10', '#d9862a'].map(h => { const c = new T.Color(h); return [c.r, c.g, c.b]; });
  const EYE = ['#2a6aa8', '#3d8a3a', '#7a2a1a', '#6a5020'];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  let wingTex = null;
  function paintWing() {
    /* clear, faintly smoky, netted with veins: a long leading vein, cross-veins, the network toward the edge; the
       pterostigma, a dark cell near the tip */
    const W = 512, H = 128, cv = M.canvas(W, H), x = cv.getContext('2d'), r = M.rng(77);
    x.fillStyle = 'rgba(210,222,230,0.16)'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(30,34,40,0.85)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 6); x.lineTo(W, 10); x.stroke();
    x.lineWidth = 1.6; for (const y of [26, 48, 70]) { x.beginPath(); x.moveTo(0, y * 0.5 + 8); x.quadraticCurveTo(W * 0.5, y, W, y * 0.9 + 10); x.stroke(); }
    x.lineWidth = 0.9; x.strokeStyle = 'rgba(40,44,50,0.55)';
    for (let i = 0; i < 70; i++) { const u = i / 70 * W + r() * 4; x.beginPath(); x.moveTo(u, 6); x.lineTo(u + (r() - 0.5) * 6, H * (0.55 + 0.4 * r())); x.stroke(); }
    for (let i = 0; i < 260; i++) { const u = r() * W, v = 40 + r() * (H - 40); x.beginPath(); x.moveTo(u, v); x.lineTo(u + 6 + r() * 8, v + (r() - 0.5) * 10); x.stroke(); }
    x.fillStyle = 'rgba(25,20,16,0.92)'; x.fillRect(W * 0.83, 3, W * 0.07, 12);
    const t = Mats.tex(cv); t.flipY = false; t.needsUpdate = true; t.userData.keep = true; return t;
  }
  M.add('life/dragonfly', (o = {}) => {
    const kind = Math.max(0, Math.min(3, o.kind | 0)), g = new T.Group(), col = COL[kind], black = [0.02, 0.02, 0.025];
    wingTex = wingTex || paintWing();
    const bodyM = M.litP('#ffffff', { vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    /* the abdomen: long and slender, a black ring at each of its ten segments, the tip a little clubbed */
    const abd = M.loft([[-0.046, 0, 0, 0, 2], [-0.044, 0.0011, 0.0012, 0, 2], [-0.03, 0.0009, 0.001, 0, 2], [-0.012, 0.001, 0.0011, 0, 2], [-0.006, 0.0014, 0.0016, 0, 2], [-0.002, 0.0021, 0.0022, 0, 2], [0, 0, 0, 0, 2]], 60, 12,
      (x, y, z, u) => { const seg = (u * 10) % 1; return seg < 0.16 ? black : mix(col, col.map(v => v * 0.55), y > 0 ? 0 : 0.5); });
    const thx = M.loft([[-0.003, 0, 0, 0.0004, 2], [-0.002, 0.0028, 0.0032, 0.0006, 2], [0.004, 0.0034, 0.0042, 0.001, 2], [0.0085, 0.0028, 0.0034, 0.001, 2], [0.0095, 0, 0, 0.001, 2]], 20, 18,
      (x, y, z) => { const stripe = Math.abs(Math.sin((x * 900 + z * 300))) > 0.8 ? 1 : 0; return stripe ? black : mix(col, [0.9, 0.85, 0.5], kind === 3 ? 0.2 : 0); });
    g.add(new T.Mesh(M.mergeC([{ geo: abd }, { geo: thx }]), bodyM));
    /* the head and its eyes: two great domes, faceted (painted), meeting on top */
    const head = new T.Object3D(); head.position.set(0.0102, 0.0012, 0); g.add(head);
    const eyeG = new T.SphereGeometry(0.0032, 28, 20);
    M.paint(eyeG, (x, y, z) => { const fac = 0.85 + 0.15 * Math.sin(x * 9000) * Math.sin(y * 9000) * Math.sin(z * 9000); const c = new T.Color(EYE[kind]); return [c.r * fac, c.g * fac, c.b * fac]; });
    const eyeM = M.litP('#ffffff', { vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    for (const sd of [-1, 1]) { const e = new T.Mesh(eyeG, eyeM); e.position.set(0.0008, 0.0012, sd * 0.0024); head.add(e); }
    const face = new T.Mesh(M.paint(new T.SphereGeometry(0.0022, 14, 10), () => [0.6, 0.62, 0.35]), M.lit('#ffffff', { vertexColors: true, roughness: 0.5 })); face.position.set(0.0022, -0.0008, 0); face.scale.set(0.8, 1, 1.2); head.add(face);
    /* the wings: four, long and narrow, held out flat */
    const wingG = (len, w0, w1) => M.sheet(10, 6, (s, c) => { const w = (w0 + (w1 - w0) * s) * Math.sin(Math.PI * Math.min(1, 0.08 + s * 0.95)) ** 0.4; return [-(c - 0.15) * w, 0, 0.0018 + s * len]; });
    const wm = new T.MeshStandardMaterial({ map: wingTex, transparent: true, side: T.DoubleSide, roughness: 0.15, metalness: 0.2, depthWrite: false });
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
  const T = THREE, M = Models, g = new T.Group();
  const black = [0.03, 0.028, 0.025], yellow = [0.8, 0.6, 0.08], pink = [0.85, 0.35, 0.22], pale = [0.85, 0.82, 0.55];
  /* the wing cases: two long shells over its back, black with yellow edges */
  /* (flat, lens-shaped in section, the pair meeting down the middle of its back in a thin seam, domed a little side
     to side; the yellow only along the outer edge) */
  const elytron = sd => M.loft([[-0.0088, 0, 0, 0.0017, 2.4], [-0.0074, 0.0017, 0.0006, 0.0018, 2.4], [-0.002, 0.0025, 0.00085, 0.002, 2.4], [0.0035, 0.0024, 0.0008, 0.002, 2.4], [0.0052, 0, 0, 0.0019, 2.4]], 18, 16,
    (x, y, z, u, a) => sd * Math.sin(a) > 0.84 ? yellow : black, { shape: (x, y, z) => { const Z = z + sd * 0.0019; return [x, y - 55 * Z * Z, Z]; } });
  const body = M.loft([[-0.0095, 0, 0, 0.0006], [-0.008, 0.0014, 0.0008, 0.0007], [-0.002, 0.0018, 0.001, 0.0009], [0.004, 0.0016, 0.0009, 0.001], [0.006, 0, 0, 0.001]], 16, 12, (x, y) => x < -0.0045 && y < 0.0008 ? pale : black);
  const shield = M.loft([[0.0045, 0, 0, 0.0021, 2.2], [0.005, 0.0026, 0.0006, 0.0022, 2.2], [0.0068, 0.0028, 0.0007, 0.002, 2.2], [0.0083, 0, 0, 0.0016, 2.2]], 12, 16,
    (x, y, z) => Math.hypot(x - 0.0064, z) < 0.0008 ? black : pink);
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
