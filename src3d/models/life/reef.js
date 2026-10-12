/* the small lives of the shallows, for holding up close: a sergeant major (the little reef fish that swims in schools
   round the rocks: silver-white with a yellow back and five black bars, a big eye with a gold rim), a hermit crab in a
   borrowed whelk shell (red-orange legs and claws, stalked eyes, long antennae), and a cleaner shrimp (translucent
   red and white, its long white antennae waving).
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
  const finTex = new Map();
  function finPaint(rays, tint) {
    const key = rays + tint; if (finTex.has(key)) return finTex.get(key);
    const S = 128, cv = M.canvas(S, S), x = cv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, tint + 'cc'); g.addColorStop(1, tint + '22'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(40,40,40,0.5)'; x.lineWidth = 1.5; for (let i = 0; i <= rays; i++) { const u = (i + 0.5) / (rays + 1) * S; x.beginPath(); x.moveTo(u, 0); x.lineTo(u + 2, S); x.stroke(); }
    const t = Mats.tex(cv); t.flipY = false; t.needsUpdate = true; t.userData.keep = true; finTex.set(key, t); return t;
  }
  const fin = (root, edge, ns, nc) => M.sheet(ns, nc, (s, c) => { const a = root(c), b = edge(c); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; });

  /* ── the sergeant major: deep-bodied and flat, 12 cm ── */
  M.add('life/reeffish', () => {
    const g = new T.Group(), yellow = lin('#e8c43a'), silver = lin('#dfe5e8'), black = lin('#16181a');
    const body = M.loft([[-0.05, 0, 0, 0, 2], [-0.045, 0.004, 0.009, 0, 2], [-0.03, 0.008, 0.022, 0.001, 2], [-0.005, 0.011, 0.034, 0.002, 2], [0.02, 0.012, 0.033, 0.002, 2.1], [0.042, 0.01, 0.024, 0.0, 2.1], [0.055, 0.005, 0.012, -0.002, 2], [0.06, 0, 0, -0.002, 2]], 50, 40,
      (x, y, z, u, a) => {
        const up = Math.cos(a), bars = [0.03, 0.012, -0.006, -0.024, -0.04], onBar = bars.some(b => Math.abs(x - b + y * 0.15) < 0.0042);
        let c = mix(silver, yellow, sm(0.1, 0.65, up) * sm(-0.045, -0.01, x) * 1.0 + sm(0.4, 0.9, up) * 0.6);
        if (onBar && up > -0.6) c = mix(c, black, 0.9);
        if (x > 0.046 && Math.abs(y + 0.003) < 0.0012 && Math.abs(Math.sin(a)) > 0.4) c = black;   /* (the mouth) */
        return c.map(v => v * (0.94 + 0.08 * Math.sin(x * 900) * Math.sin(y * 900)));
      });
    g.add(new T.Mesh(body, M.litP('#ffffff', { vertexColors: true, roughness: 0.28, metalness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 })));
    for (const sd of [-1, 1]) { const e = eye(0.0042, [0.75, 0.6, 0.2]); e.position.set(0.04, 0.006, sd * 0.0085); e.rotation.y = sd > 0 ? 0.2 : Math.PI - 0.2; g.add(e); }
    const fm = (r, t) => new T.MeshStandardMaterial({ map: finPaint(r, t), transparent: true, side: T.DoubleSide, roughness: 0.5, depthWrite: false });
    /* a long dorsal fin, spiny in front; the anal fin; the forked tail; pectorals */
    g.add(new T.Mesh(fin(c => [0.03 - c * 0.07, 0.033 - c * 0.012 * c, 0], c => [0.026 - c * 0.075, 0.033 + 0.012 + 0.006 * Math.sin(c * 3.1) - 0.012 * c * c, 0], 6, 16), fm(14, '#c9b04a')));
    g.add(new T.Mesh(fin(c => [0.005 - c * 0.045, -0.03 + c * 0.012, 0], c => [-0.002 - c * 0.048, -0.042 + c * 0.012, 0], 6, 12), fm(12, '#b8b8b8')));
    const tail = new T.Object3D(); tail.position.x = -0.048; g.add(tail);
    tail.add(new T.Mesh(fin(c => [0, -0.008 + c * 0.016, 0], c => { const k = Math.abs(2 * c - 1); return [-0.026 + 0.01 * (1 - k), (2 * c - 1) * 0.02, 0]; }, 6, 16), fm(16, '#d9c45a')));
    const pecs = [];
    for (const sd of [-1, 1]) { const p = new T.Object3D(); p.position.set(0.027, -0.002, sd * 0.011); p.rotation.y = sd * 0.4; g.add(p); p.add(new T.Mesh(fin(c => [0, -0.004 + c * 0.008, 0], c => [-0.016, -0.003 + c * 0.009, 0], 5, 6), fm(8, '#e0e0e0'))); pecs.push({ p, sd }); }
    g.userData.anim = (t, flying) => { tail.rotation.y = (flying ? 0.5 : 0.25) * Math.sin(t * (flying ? 14 : 4)); for (const p of pecs) p.p.rotation.y = p.sd * (0.4 + 0.3 * Math.sin(t * 6 + p.sd)); };
    g.userData.anim(0);
    return g;
  });

  /* ── a hermit crab in a whelk shell ── */
  M.add('life/hermit', () => {
    const g = new T.Group(), red = lin('#c8442a'), redD = lin('#7a2414'), pale = lin('#efd6b8');
    /* (the shell on its back, its mouth to the front: centred behind the crab's legs) */
    const shell = Models.make('life/whelk', { tone: lin('#c9a77a') }); shell.rotation.set(0, Math.PI, 0.35); shell.scale.setScalar(0.85); shell.updateMatrixWorld(true);
    { const c = new T.Box3().setFromObject(shell).getCenter(new T.Vector3()); shell.position.set(-0.005 - c.x, 0.017 - c.y, -c.z); }
    g.add(shell);
    const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.45 });
    const seg = (pts, r0, r1, col) => new T.Mesh(M.paint(M.tube(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 10, 7, t => r0 + (r1 - r0) * t), (x, y) => mix(col, pale, y > 0.012 ? 0.15 : 0)), legM);
    /* the walking legs, two pairs out of the shell's mouth either side */
    for (const sd of [-1, 1]) for (const [k, x0] of [[0, 0.012], [1, 0.006]]) g.add(seg([[x0, 0.012, sd * 0.004], [x0 + 0.008, 0.016, sd * 0.012], [x0 + 0.014, 0.008, sd * 0.018], [x0 + 0.016 - k * 0.006, 0.0, sd * 0.02]], 0.0018, 0.0006, red));
    /* the claws: the left one much bigger, held in front of its face */
    for (const [sd, k] of [[-1, 1.5], [1, 0.9]]) {
      g.add(seg([[0.014, 0.014, sd * 0.003], [0.02, 0.016, sd * 0.006], [0.025, 0.012, sd * 0.004]], 0.0022 * k, 0.002 * k, red));
      const palm = new T.Mesh(M.paint(new T.SphereGeometry(1, 14, 10), (x, y) => mix(red, pale, y < -0.2 ? 0.4 : 0)), legM); palm.scale.set(0.006 * k, 0.0035 * k, 0.003 * k); palm.position.set(0.03, 0.011, sd * 0.004); palm.rotation.z = -0.3; g.add(palm);
      const f = new T.Mesh(M.paint(new T.ConeGeometry(0.0016 * k, 0.006 * k, 8), () => redD), legM); f.rotation.z = -Math.PI / 2 - 0.3; f.position.set(0.036 + 0.002 * k, 0.009, sd * 0.004); g.add(f);
    }
    /* eyes on stalks, and the long antennae */
    const eyeM = M.litP('#0a0a0a', { roughness: 0.1, clearcoat: 1 }), ants = [];
    for (const sd of [-1, 1]) {
      g.add(seg([[0.018, 0.017, sd * 0.002], [0.022, 0.024, sd * 0.003]], 0.0009, 0.0008, lin('#d9b48a')));
      const e = new T.Mesh(new T.SphereGeometry(0.0015, 12, 10), eyeM); e.position.set(0.0225, 0.025, sd * 0.003); g.add(e);
      const a = new T.Object3D(); a.position.set(0.02, 0.019, sd * 0.002); g.add(a); ants.push({ a, sd });
      a.add(seg([[0, 0, 0], [0.012, 0.01, sd * 0.006], [0.03, 0.014, sd * 0.016]], 0.0004, 0.00015, red));
    }
    g.userData.anim = t => { for (const n of ants) n.a.rotation.z = 0.15 * Math.sin(t * 2.2 + n.sd * 1.3); };
    return g;
  });

  /* ── a cleaner shrimp: a translucent red body with a white stripe along its back, white antennae ── */
  M.add('life/shrimp', () => {
    const g = new T.Group(), red = lin('#d43a2a'), white = lin('#f6f2ea');
    const body = M.loft([[-0.03, 0, 0, 0.002, 2], [-0.026, 0.002, 0.003, 0.003, 2], [-0.012, 0.0045, 0.006, 0.004, 2], [0.004, 0.0055, 0.0068, 0.005, 2], [0.016, 0.005, 0.0062, 0.0055, 2], [0.024, 0.003, 0.0035, 0.006, 2], [0.03, 0, 0, 0.0065, 2]], 48, 24,
      (x, y, z, u, a) => { const stripe = Math.abs(Math.sin(a)) < 0.28 && Math.cos(a) > 0 ? 1 : 0, seg = (u * 9) % 1; return stripe ? white : mix(red, red.map(v => v * 0.6), seg < 0.12 ? 1 : 0); },
      { shape: (x, y, z) => [x, y + 0.012 * Math.exp(-(((x + 0.006) / 0.018) ** 2)) * 0.4 - 0.0005 * x * x / 0.0009, z] });
    g.add(new T.Mesh(body, M.litP('#ffffff', { vertexColors: true, roughness: 0.25, clearcoat: 1, transmission: 0, transparent: true, opacity: 0.92 })));
    const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.4 });
    const leg = (pts, r, col) => new T.Mesh(M.paint(M.tube(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 8, 5, t => r * (1 - 0.6 * t)), () => col), legM);
    /* five pairs of walking legs, the swimmerets beneath the tail, the tail fan */
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) { const x0 = 0.012 - i * 0.004; g.add(leg([[x0, 0.0, sd * 0.003], [x0 + 0.002, -0.004, sd * 0.007], [x0 + 0.004, -0.009, sd * 0.009]], 0.0006, i % 2 ? red : white)); }
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const x0 = -0.004 - i * 0.005; g.add(leg([[x0, 0.0, sd * 0.002], [x0 - 0.001, -0.004, sd * 0.003]], 0.0005, red)); }
    const fan = M.sheet(4, 8, (s, c) => { const a = (c - 0.5) * 1.6; return [-0.03 - s * 0.012 * Math.cos(a), 0.002, Math.sin(a) * s * 0.01]; }, (s, c) => mix(red, white, s > 0.7 ? 0.8 : 0));
    g.add(new T.Mesh(fan, M.lit('#ffffff', { vertexColors: true, roughness: 0.4, side: T.DoubleSide })));
    /* eyes, and the long white antennae (three pairs) */
    const eyeM = M.litP('#090909', { roughness: 0.1, clearcoat: 1 }), ants = [];
    for (const sd of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.0016, 12, 10), eyeM); e.position.set(0.029, 0.009, sd * 0.003); g.add(e);
      for (let k = 0; k < 3; k++) { const a = new T.Object3D(); a.position.set(0.03, 0.007, sd * 0.002); g.add(a); ants.push({ a, sd, k });
        a.add(leg([[0, 0, 0], [0.02, 0.008 + k * 0.004, sd * (0.006 + k * 0.004)], [0.05, 0.004 + k * 0.01, sd * (0.012 + k * 0.01)]], 0.00028, white)); }
    }
    g.userData.anim = t => { for (const n of ants) n.a.rotation.z = 0.2 * Math.sin(t * (2 + n.k) + n.sd); };
    g.userData.anim(0);
    return g;
  });
})();
