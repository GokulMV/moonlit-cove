/* fish, for holding up close. A grey mullet (the one that leaps in the bay): a long, round-backed body, dark olive above
   and silver below with dusky stripes along it, scaled all over; a broad head, a small mouth, a big eye (a gold-silver
   iris round a black pupil, under a clear, glossy cornea), the gill cover's edge behind it; a spiny first dorsal fin of
   four spines and a soft second; pectoral fins high on its sides with a dark spot at their base; pelvic and anal fins;
   a deeply forked tail. Fins are thin, ribbed with their rays, and the light comes through them.
   At the origin in metres, its nose toward +x, its back +y; about 34 cm long. userData.anim(t): the tail sweeps, the
   fins flutter, the gill covers breathe */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
  let skinTex = null, bumpTex = null;
  /* the skin, along it (u: tail 0 → nose 1) and round it (v: belly 0, its left side ¼, its back ½, its right side ¾) */
  function paintSkin() {
    const W = 1024, H = 512, cv = M.canvas(W, H), x = cv.getContext('2d'), bc = M.canvas(W, H), b = bc.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    for (const [v, c] of [[0, '#eef1f2'], [0.12, '#dfe4e7'], [0.26, '#aeb8be'], [0.38, '#6f7d80'], [0.5, '#34423f'], [0.62, '#6f7d80'], [0.74, '#aeb8be'], [0.88, '#dfe4e7'], [1, '#eef1f2']]) g.addColorStop(v, c);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* a brassy sheen along the flanks */
    const s2 = x.createLinearGradient(0, 0, 0, H); s2.addColorStop(0.2, 'rgba(190,170,110,0)'); s2.addColorStop(0.3, 'rgba(190,170,110,0.22)'); s2.addColorStop(0.36, 'rgba(190,170,110,0)'); s2.addColorStop(0.64, 'rgba(190,170,110,0)'); s2.addColorStop(0.7, 'rgba(190,170,110,0.22)'); s2.addColorStop(0.8, 'rgba(190,170,110,0)');
    x.fillStyle = s2; x.fillRect(0, 0, W, H);
    /* the dusky stripes, one along each row of scales on its upper flanks */
    x.strokeStyle = 'rgba(40,52,52,0.5)'; x.lineWidth = 5;
    for (const sd of [-1, 1]) for (let i = 1; i <= 5; i++) { const v = 0.5 + sd * (0.045 + i * 0.038); x.beginPath(); for (let u = 0.08; u <= 0.8; u += 0.01) { const yy = v * H + Math.sin(u * 9) * 2; u > 0.08 ? x.lineTo(u * W, yy) : x.moveTo(u * W, yy); } x.stroke(); }
    /* scales: rows of overlapping crescents, each lighter in its middle (and a bump map of their edges) */
    b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
    const SW = 22, SH = 18;
    for (let row = 0; row * SH < H + SH; row++) for (let col = 0; col * SW < W + SW; col++) {
      const cx = col * SW + (row % 2) * SW / 2, cy = row * SH, u = cx / W;
      if (u > 0.82) continue;
      x.strokeStyle = 'rgba(20,30,34,0.16)'; x.lineWidth = 1.6; x.beginPath(); x.arc(cx, cy, SW * 0.62, -1.15, 1.15); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.beginPath(); x.arc(cx - 3, cy, SW * 0.32, 0, TAU); x.fill();
      const gr = b.createRadialGradient(cx - 4, cy, 2, cx, cy, SW * 0.66); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.8, '#7a7a7a'); gr.addColorStop(1, '#505050');
      b.fillStyle = gr; b.beginPath(); b.arc(cx, cy, SW * 0.66, -1.3, 1.3); b.closePath(); b.fill();
    }
    /* the head, scaleless and darker on top; the gill cover's curved edge, and its golden flush */
    const hu = 0.8 * W;
    const hg = x.createLinearGradient(hu - 10, 0, W, 0); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.3, 'rgba(30,40,40,0.18)'); x.fillStyle = hg; x.fillRect(hu - 10, 0, W - hu + 10, H);
    for (const sd of [-1, 1]) {
      const vc = 0.5 + sd * 0.25;
      /* (the gill cover's back edge: a curve down the cheek, bowed toward the tail; a faint gold flush in front of it) */
      x.fillStyle = 'rgba(200,170,90,0.1)'; x.beginPath(); x.ellipse(0.875 * W, vc * H, 26, 0.17 * H, 0, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(30,36,38,0.7)'; x.lineWidth = 3; x.beginPath(); x.ellipse(0.865 * W, vc * H, 24, 0.19 * H, 0, Math.PI / 2 + 0.15, Math.PI * 1.5 - 0.15); x.stroke();
      b.strokeStyle = '#3a3a3a'; b.lineWidth = 4; b.beginPath(); b.ellipse(0.865 * W, vc * H, 24, 0.19 * H, 0, Math.PI / 2 + 0.15, Math.PI * 1.5 - 0.15); b.stroke();
      /* the dark spot at the root of the pectoral fin */
      x.fillStyle = 'rgba(25,32,40,0.75)'; x.beginPath(); x.ellipse(0.745 * W, (0.5 + sd * 0.12) * H, 10, 8, 0, 0, TAU); x.fill();
    }
    skinTex = Mats.tex(cv); skinTex.userData.keep = true;
    bumpTex = new T.CanvasTexture(bc); bumpTex.userData.keep = true;
  }
  /* a fin's membrane: rays from its root to its edge, the skin between them thin and pale (alpha) */
  const finTex = new Map();
  function paintFin(rays, spiny, tint = [150, 162, 170]) {
    const key = rays + (spiny ? 's' : '') + tint.join(); if (finTex.has(key)) return finTex.get(key);
    const S = 256, cv = M.canvas(S, S), x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, `rgba(${tint.join()},0.75)`); g.addColorStop(0.85, `rgba(${tint.join()},0.45)`); g.addColorStop(1, `rgba(${tint.join()},0.1)`);
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i <= rays; i++) {
      const u = (i + 0.5) / (rays + 1) * S; x.strokeStyle = spiny ? 'rgba(70,78,84,0.95)' : 'rgba(95,104,110,0.85)'; x.lineWidth = spiny ? 5 : 2.4;
      x.beginPath(); x.moveTo(u, 0); x.lineTo(u + (spiny ? 0 : 4), S * (spiny ? 1 : 0.7)); x.stroke();
      /* (soft rays fork toward the edge) */
      if (!spiny) { x.lineWidth = 1.4; x.beginPath(); x.moveTo(u + 4, S * 0.7); x.lineTo(u + 1, S); x.moveTo(u + 4, S * 0.7); x.lineTo(u + 8, S); x.stroke(); }
    }
    const t = Mats.tex(cv); t.flipY = false; t.needsUpdate = true; t.userData.keep = true; finTex.set(key, t); return t;
  }
  /* a fin over (s from its root to its edge, c along its root): root(c) and edge(c) → points; bend(s, c) → its sway */
  const fin = (root, edge, ns = 8, nc = 14, bend) => M.sheet(ns, nc, (s, c) => { const a = root(c), b = edge(c), p = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; if (bend) p[2] += bend(s, c); return p; });

  M.add('life/fish', () => {
    const g = new T.Group();
    if (!skinTex) paintSkin();
    /* the body: from the tail's root (x −0.135) to the nose (+0.175), flattened a little side to side, the head broad and
       flat on top */
    const body = M.loft([[-0.136, 0, 0, 0, 2], [-0.128, 0.0062, 0.0105, 0, 2], [-0.1, 0.0112, 0.0175, 0, 2], [-0.05, 0.0205, 0.0305, 0, 2], [0, 0.0255, 0.0375, 0, 2],
      [0.06, 0.0278, 0.0365, 0.0008, 2.1], [0.11, 0.0272, 0.0312, 0.0018, 2.25], [0.148, 0.0215, 0.0205, 0.0022, 2.3], [0.168, 0.0105, 0.0098, 0.0012, 2.1], [0.175, 0, 0, 0.0005, 2]], 90, 56, null,
      { shape: (x, y, z, u, a) => {
        /* the gill cover standing a hair proud of the flank in front of its edge */
        const gill = 1 + 0.035 * (1 / (1 + Math.exp(-(x - 0.122) / 0.0016))) * (1 - 1 / (1 + Math.exp(-(x - 0.15) / 0.004)));
        return [x, y * (Math.cos(a) > 0 ? 1 : gill), z * gill]; } });
    const skinM = M.litP('#ffffff', { map: skinTex, bumpMap: bumpTex, bumpScale: 1.2, roughness: 0.34, metalness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.28 });
    g.add(new T.Mesh(body, skinM));
    /* the mouth: a small dark line round the snout's tip */
    const lip = []; for (let i = 0; i <= 16; i++) { const a = -1.3 + i / 16 * 2.6; lip.push(new T.Vector3(0.1715 - 0.006 * Math.abs(Math.sin(a)) ** 1.5, -0.002 - 0.0016 * Math.cos(a), Math.sin(a) * 0.0068)); }
    g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3(lip), 32, 5, () => 0.0006), M.lit('#232a2c', { roughness: 0.5 })));
    /* the eyes: an iris of gold and silver round a black pupil, a clear cornea bulging over it */
    const irisG = new T.SphereGeometry(0.0074, 32, 24);
    M.paint(irisG, (x, y, z) => { const r = Math.hypot(x, y) / 0.0074, out = z > 0; if (!out) return [0.02, 0.02, 0.02];
      if (r < 0.42) return [0.006, 0.006, 0.008];
      const k = (r - 0.42) / 0.58, streak = 0.85 + 0.15 * Math.sin(Math.atan2(y, x) * 26);
      const c = [0.62 - 0.25 * k, 0.5 - 0.2 * k, 0.24 - 0.08 * k].map(v => v * streak); return r > 0.93 ? c.map(v => v * 0.35) : c; });
    const irisM = M.litP('#ffffff', { vertexColors: true, roughness: 0.3, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.05 });
    const corneaM = new T.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false });
    for (const sd of [-1, 1]) {
      /* (looking out sideways and a little forward) */
      const e = new T.Group(); e.position.set(0.147, 0.0072, sd * 0.0168); e.rotation.y = sd > 0 ? 0.15 : Math.PI - 0.15;
      const iris = new T.Mesh(irisG, irisM); e.add(iris);
      const cor = new T.Mesh(new T.SphereGeometry(0.0079, 24, 16, 0, TAU, 0, Math.PI * 0.42), corneaM); cor.rotation.x = Math.PI / 2; cor.position.z = 0.0003; e.add(cor);
      /* (the orbit's rim of skin) */
      const rim = new T.Mesh(new T.TorusGeometry(0.0078, 0.0011, 8, 28), M.lit('#5d6766', { roughness: 0.5 })); rim.position.z = 0.0028; e.add(rim);
      g.add(e);
    }
    /* the fins */
    const finM = (rays, spiny, tint) => new T.MeshStandardMaterial({ map: paintFin(rays, spiny, tint), transparent: true, side: T.DoubleSide, roughness: 0.5, depthWrite: false });
    /* first dorsal: four stiff spines */
    const d1 = fin(c => [0.028 - c * 0.034, 0.0372 - c * 0.001, 0], c => [0.02 - c * 0.04, 0.0372 + 0.031 * (1 - c * 0.62) - 0.004 * c * c, 0], 8, 10);
    g.add(new T.Mesh(d1, finM(3, true)));
    /* second dorsal and the anal fin: soft, sickle-edged */
    const d2 = fin(c => [-0.045 - c * 0.028, 0.0275 - c * 0.006, 0], c => [-0.052 - c * 0.034, 0.0275 + 0.024 * (1 - c) ** 1.3 + 0.004, 0], 8, 12);
    g.add(new T.Mesh(d2, finM(9, false)));
    const an = fin(c => [-0.04 - c * 0.03, -0.0275 + c * 0.007, 0], c => [-0.048 - c * 0.035, -0.0275 - 0.021 * (1 - c) ** 1.3 - 0.003, 0], 8, 12);
    g.add(new T.Mesh(an, finM(10, false)));
    /* the tail: deeply forked, from the narrow wrist of the tail */
    const tail = new T.Object3D(); tail.position.x = -0.128; g.add(tail);
    const cf = fin(c => [0, -0.0095 + c * 0.019, 0], c => { const k = Math.abs(2 * c - 1); return [-0.072 + 0.04 * Math.pow(1 - k, 1.6), (2 * c - 1) * 0.05, 0]; }, 10, 22);
    const cfm = new T.Mesh(cf, finM(18, false, [120, 134, 142])); tail.add(cfm);
    /* pectoral fins high on the flanks behind the gills, pelvic fins on the belly */
    const pecs = [], pels = [];
    for (const sd of [-1, 1]) {
      const p = new T.Object3D(); p.position.set(0.106, 0.0055, sd * 0.0262); p.rotation.order = 'YXZ'; p.rotation.y = sd * 0.35; p.rotation.x = sd * 0.25; g.add(p);
      p.add(new T.Mesh(fin(c => [0, -0.006 + c * 0.012, 0], c => [-0.04 + 0.012 * Math.sin(c * Math.PI), -0.004 + c * 0.014, 0], 8, 10), finM(12, false, [160, 168, 172])));
      pecs.push({ p, sd, y0: p.rotation.y });
      const q = new T.Object3D(); q.position.set(0.03, -0.034, sd * 0.009); q.rotation.order = 'YXZ'; q.rotation.y = sd * 0.25; q.rotation.x = -sd * 0.9; g.add(q);
      q.add(new T.Mesh(fin(c => [0, 0, -0.003 + c * 0.006], c => [-0.026, -0.008 + 0.004 * c, -0.002 + c * 0.006], 6, 8), finM(6, false, [190, 196, 198])));
      pels.push(q);
    }
    g.userData.anim = t => {
      tail.rotation.y = 0.22 * Math.sin(t * 3.1);
      for (const p of pecs) p.p.rotation.y = p.y0 + p.sd * 0.18 * Math.sin(t * 4.2 + p.sd);
    };
    g.userData.anim(0);
    return g;
  });
})();
