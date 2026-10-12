/* the two big ones offshore, for looking at up close (they are let go again, not thrown): a bottlenose dolphin, grey
   with a darker cape and a pale belly, its short beak and its smile, a small dark eye, the blowhole on top of its head,
   a curved dorsal fin, flippers and flukes; and a humpback whale, black above and mottled white below, the knobs on
   its head, the long grooves down its throat, its great white flippers with their knobbled leading edges, a small
   dorsal fin on its hump, flukes edged with a ragged trailing edge and white beneath.
   Each at the origin in metres, its head toward +x, its back +y. userData.anim(t): the flukes beat, the flippers sway */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* a fin: root along c from a to b, out to an edge; colour fn */
  const fin = (root, edge, col, ns = 10, nc = 14) => M.sheet(ns, nc, (s, c) => { const a = root(c), b = edge(c, s); return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; }, col);

  M.add('life/dolphin', () => {
    const g = new T.Group(), cape = lin('#3c464f'), flank = lin('#7d8a94'), belly = lin('#e9e4e2');
    const body = M.loft([[-1.12, 0, 0, 0, 2], [-1.08, 0.035, 0.07, 0, 2], [-0.85, 0.075, 0.13, 0.01, 2.1], [-0.4, 0.2, 0.25, 0.02, 2], [0.05, 0.26, 0.3, 0.02, 2], [0.45, 0.22, 0.25, 0.04, 2],
      [0.72, 0.16, 0.18, 0.04, 2], [0.86, 0.1, 0.12, 0.0, 2], [0.94, 0.06, 0.055, -0.04, 2], [1.02, 0.045, 0.04, -0.05, 2], [1.08, 0, 0, -0.05, 2]], 90, 56,
      (x, y, z, u, a) => {
        const up = Math.cos(a), capeLine = 0.25 + 0.35 * sm(-0.6, 0.4, x) - 0.25 * sm(0.5, 0.9, x);
        let c = up > capeLine ? cape : mix(flank, belly, sm(-0.05, -0.55, up));
        if (up > capeLine && up < capeLine + 0.12) c = mix(flank, cape, (up - capeLine) / 0.12);
        /* the eye's dark streak, and the line of the mouth */
        const ex = x - 0.74, ey = y + 0.005;
        if (Math.abs(Math.sin(a)) > 0.75 && Math.hypot(ex, ey * 2) < 0.03) c = lin('#16191c');
        if (x > 0.84 && Math.abs(y - (-0.055 + (x - 0.84) * 0.2)) < 0.006 && Math.abs(Math.sin(a)) > 0.4) c = lin('#2a2f33');
        return c.map(v => v * (0.96 + 0.05 * M.vn(x * 20, y * 20, z * 20)));
      }, { shape: (x, y, z, u, a) => { /* the melon over the beak */ const mel = Math.exp(-(((x - 0.82) / 0.07) ** 2)) * Math.max(0, Math.cos(a)) * 0.035; return [x, y + mel, z]; } });
    const skinM = M.litP('#ffffff', { vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    g.add(new T.Mesh(body, skinM));
    /* the blowhole, a dark crescent on top of the head */
    g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([-0.02, 0, 0.02].map(z => new T.Vector3(0.6 - Math.abs(z) * 0.5, 0.265, z))), 8, 5, () => 0.005), M.lit('#15181b')));
    /* the eyes: small, dark, wet */
    for (const sd of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.012, 12, 10), M.litP('#0a0a0a', { roughness: 0.05, clearcoat: 1 })); e.position.set(0.745, -0.004, sd * 0.126); g.add(e); }
    const finM = M.litP('#ffffff', { vertexColors: true, roughness: 0.35, clearcoat: 0.6, side: T.DoubleSide });
    /* the dorsal fin, curved back */
    g.add(new T.Mesh(fin(c => [0.15 - c * 0.42, 0.27 - c * 0.04, 0], (c, s) => [-0.1 - c * 0.2 - s * 0.18 * (1 - c), 0.27 + 0.33 * (1 - c * 0.95) - 0.05 * s * s, 0], () => cape), finM));
    /* the flippers */
    const flips = [];
    for (const sd of [-1, 1]) { const f = new T.Object3D(); f.position.set(0.4, -0.12, sd * 0.22); g.add(f); const m = new T.Mesh(fin(c => [0.06 - c * 0.12, 0, 0], (c, s) => [-0.12 - c * 0.05, -0.08 * s, 0.34], () => flank), finM); if (sd < 0) m.scale.z = -1; f.add(m); flips.push({ f, sd }); }
    /* the flukes, on a tail that bends */
    const tail = new T.Object3D(); tail.position.x = -1.08; g.add(tail);
    tail.add(new T.Mesh(fin(c => [0.02, 0, (c - 0.5) * 0.06], (c, s) => { const k = Math.abs(2 * c - 1); return [-0.12 - 0.15 * k + 0.08 * (1 - k) * (1 - k), 0, (2 * c - 1) * 0.32]; }, () => cape, 8, 24), finM));
    g.userData.anim = t => { tail.rotation.z = 0.18 * Math.sin(t * 2.2); for (const f of flips) f.f.rotation.x = f.sd * 0.15 * Math.sin(t * 1.4); };
    g.userData.anim(0);
    return g;
  });

  M.add('life/whale', () => {
    const g = new T.Group(), black = lin('#1f2226'), white = lin('#e8e8e6');
    const L = 13, mottle = (x, z) => M.fbm(x * 0.8, z * 0.8, 3, 3);
    const body = M.loft([[-6.4, 0, 0, 0, 2], [-6.2, 0.18, 0.4, 0.05, 2], [-5, 0.45, 0.62, 0.1, 2], [-2.5, 1.25, 1.35, 0.1, 2], [0.5, 1.7, 1.75, 0.05, 2], [3, 1.6, 1.55, -0.05, 2.1], [5, 1.15, 1.05, -0.25, 2.2], [6.1, 0.6, 0.55, -0.4, 2.2], [6.55, 0, 0, -0.5, 2]], 120, 72,
      (x, y, z, u, a) => {
        const up = Math.cos(a); let c = black;
        /* the throat grooves: long pale pleats from the chin back to the navel */
        if (up < -0.35 && x > -1.5) { const pl = Math.abs(Math.sin(a * 36)); c = mix(mix(black, white, sm(-0.35, -0.75, up) * (0.6 + 0.4 * mottle(x, z))), black, pl > 0.92 ? 0.7 : 0); }
        else if (up < -0.2) c = mix(black, white, 0.5 * mottle(x, z));
        return c.map(v => v * (0.95 + 0.08 * M.vn(x * 3, y * 3, z * 3)));
      }, { shape: (x, y, z, u, a) => {
        /* the knobs over the head and lower jaw; the dorsal hump */
        let yy = y; const up = Math.cos(a);
        if (x > 4.2) { const k = Math.pow(Math.max(0, Math.sin(x * 9) * Math.sin(a * 11)), 12) * 0.07; yy += k * Math.sign(up); }
        const hump = Math.exp(-(((x + 2.4) / 0.9) ** 2)) * Math.max(0, up) * 0.18; return [x, yy + hump, z]; } });
    const skinM = M.litP('#ffffff', { vertexColors: true, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    g.add(new T.Mesh(body, skinM));
    for (const sd of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), M.litP('#060606', { roughness: 0.05, clearcoat: 1 })); e.position.set(4.6, -0.25, sd * 1.12); g.add(e); }
    const finM = M.litP('#ffffff', { vertexColors: true, roughness: 0.4, clearcoat: 0.3, side: T.DoubleSide });
    /* the small dorsal fin on its hump */
    g.add(new T.Mesh(fin(c => [-2.0 - c * 0.9, 1.72 - c * 0.15, 0], (c, s) => [-2.5 - c * 0.5, 1.72 + 0.45 * (1 - c), 0], () => black, 6, 10), finM));
    /* the flippers: long and white, knobbled along their leading edge */
    const flips = [];
    for (const sd of [-1, 1]) {
      const f = new T.Object3D(); f.position.set(3.0, -0.75, sd * 1.35); g.add(f);
      const geo = fin(c => [0.25 - c * 0.85, 0, 0], (c, s) => { const knob = c < 0.15 ? 0.06 * Math.max(0, Math.sin(s * 40)) : 0; return [-0.5 - c * 0.5 - s * 0.6 + knob, -0.6 * s * s, 4.2 * (1 - c * 0.35)]; },
        (s, c) => mix(white, black, c > 0.7 ? 0.5 * mottle(s * 9, c * 5) : 0.1 * mottle(s * 9, c * 5)), 24, 10);
      const m = new T.Mesh(geo, finM); if (sd < 0) m.scale.z = -1; f.add(m); flips.push({ f, sd });
    }
    /* the flukes: broad, the trailing edge ragged, white beneath */
    const tail = new T.Object3D(); tail.position.x = -6.3; g.add(tail);
    tail.add(new T.Mesh(fin(c => [0.1, 0, (c - 0.5) * 0.5], (c, s) => { const k = Math.abs(2 * c - 1), rag = 0.12 * Math.sin(c * 60) * s; return [-0.9 - 0.9 * k + 0.6 * (1 - k) * (1 - k) + rag, 0, (2 * c - 1) * 2.1]; },
      (s, c) => mix(black, white, s > 0.2 ? 0.55 * mottle(s * 6, c * 8) : 0), 10, 36), finM));
    g.userData.anim = t => { tail.rotation.z = 0.12 * Math.sin(t * 0.9); for (const f of flips) f.f.rotation.x = f.sd * (0.2 + 0.12 * Math.sin(t * 0.6)); };
    g.userData.anim(0);
    return g;
  });
})();
