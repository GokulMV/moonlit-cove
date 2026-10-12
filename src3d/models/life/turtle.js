/* a green sea turtle, held up out of the water: a domed shell plated with scutes (five down the middle, four either side,
   a ring of small ones round the rim, serrated at the back), each olive-brown with sunburst streaks and dark seams; a
   pale plastron beneath; a blunt head scaled in polygons edged pale, a dark glossy eye under a heavy lid, a hooked
   horny beak; long front flippers, each with a claw, and short rounded hind ones; a stub of a tail.
   At the origin in metres, its head toward +x, its back +y; the shell about 80 cm long. userData.anim(t): the flippers
   row, the head turns and the eyes blink */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const L = 0.8;
  /* the scutes' centres, on the shell's plan (x along, z across, in shell lengths) */
  const SC = [];
  [[0.36, 0], [0.18, 0], [0, 0], [-0.18, 0], [-0.35, 0]].forEach(p => SC.push(p));
  for (const sd of [-1, 1]) [[0.27, 0.2], [0.09, 0.235], [-0.09, 0.235], [-0.26, 0.2]].forEach(([x, z]) => SC.push([x, sd * z]));
  const NM = 24, rimAt = k => { const a = k / NM * TAU; return [Math.cos(a) * 0.475, Math.sin(a) * 0.4]; };
  for (let k = 0; k < NM; k++) SC.push(rimAt(k));
  const tone = SC.map((_, i) => 0.85 + 0.3 * M.vn(i * 3.7, 1.3, 2.1));
  function nearest(x, z) { let d1 = 9, d2 = 9, k1 = 0, k2 = 0; for (let k = 0; k < SC.length; k++) { const d = Math.hypot(x - SC[k][0], (z - SC[k][1]) * 1.08); if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } } return [k1, d1, d2, k2]; }
  /* the head's scales: a Voronoi of cells over its skin */
  const HS = Array.from({ length: 70 }, (_, i) => { const r = M.rng(91 + i); return [r(), r()]; });

  M.add('life/turtle', () => {
    const g = new T.Group();
    const olive = lin('#4f4626'), dark = lin('#1e1910'), amber = lin('#9a7436'), cream = lin('#e4d7ab'), skin = lin('#4c4733'), skinPale = lin('#b8b08e');
    /* ── the carapace: lofted along x, domed, its rim thin; scutes painted and raised a little at their middles ── */
    const shell = M.loft([[-L * 0.5, 0, 0, 0.0, 2], [-L * 0.47, L * 0.16, L * 0.035, 0.0, 2.2], [-L * 0.36, L * 0.33, L * 0.1, 0.004, 2.4], [-L * 0.15, L * 0.4, L * 0.155, 0.008, 2.5],
      [L * 0.08, L * 0.41, L * 0.17, 0.009, 2.5], [L * 0.28, L * 0.37, L * 0.14, 0.008, 2.4], [L * 0.42, L * 0.25, L * 0.085, 0.006, 2.2], [L * 0.49, L * 0.08, L * 0.03, 0.004, 2], [L * 0.5, 0, 0, 0.004, 2]], 80, 96,
      (x, y, z, u, a) => {
        const up = Math.cos(a) > 0;
        if (!up) { const [k1, d1, d2] = nearest(x / L, z / L), seam = Math.min(1, (d2 - d1) / 0.02); return mix(cream.map(v => v * 0.75), cream, seam).map(v => v * (0.92 + 0.1 * M.vn(x * 40, z * 40, 1))); }
        const px = x / L, pz = z / L, [k1, d1, d2] = nearest(px, pz), seam = Math.min(1, (d2 - d1) / 0.03);
        /* sunburst streaks out from each scute's middle, amber and near-black */
        const c0 = SC[k1], ang = Math.atan2(pz - c0[1], px - c0[0]), streak = Math.pow(0.5 + 0.5 * Math.sin(ang * 7 + k1 * 1.7 + 2 * M.vn(px * 12, pz * 12, k1)), 2.2) * Math.min(1, d1 / 0.05);
        let c = mix(olive, amber, 0.7 * streak + 0.2 * M.vn(px * 30, pz * 30, k1)).map(v => v * tone[k1]);
        c = mix(c, dark, 0.35 * Math.pow(1 - streak, 3) * Math.min(1, d1 / 0.04));
        c = mix(dark, c, 0.15 + 0.85 * seam);
        return c;
      }, { shape: (x, y, z, u, a) => {
        if (Math.cos(a) <= 0) { const cy = 0.004; return [x, cy + (y - cy) * 0.28, z]; }      /* (the plastron, nearly flat) */
        const [k1, d1, d2] = nearest(x / L, z / L), seam = Math.min(1, (d2 - d1) / 0.03), rimK = k1 >= 13 ? 1 : 0;
        /* (each scute a little raised; the rim serrated at the back) */
        let yy = y + 0.004 * (seam - 0.5) * Math.cos(a);
        const back = x < -L * 0.3 ? 1 : 0, ser = back * rimK * Math.max(0, Math.cos(Math.atan2(z, x) * 18)) * 0.012;
        return [x - ser * 0.4, yy, z * (1 + ser)]; } });
    g.add(new T.Mesh(shell, M.lit('#ffffff', { vertexColors: true, roughness: 0.42, metalness: 0.05 })));
    const skinM = M.lit('#ffffff', { vertexColors: true, roughness: 0.62 });
    /* ── the head: blunt, scaled, on a short wrinkled neck ── */
    const neck = new T.Object3D(); neck.position.set(L * 0.44, 0.012, 0); g.add(neck);
    const neckG = M.loft([[-0.06, 0.055, 0.04, 0, 2], [0, 0.048, 0.036, 0.004, 2], [0.06, 0.045, 0.034, 0.01, 2]], 16, 24, (x, y, z) => mix(skin, skinPale, 0.3 + 0.3 * Math.sin(x * 260) + (y < 0 ? 0.3 : 0)));
    neck.add(new T.Mesh(neckG, skinM));
    const head = new T.Object3D(); head.position.set(0.06, 0.012, 0); neck.add(head);
    const headG = M.loft([[-0.02, 0.045, 0.035, 0, 2], [0.02, 0.05, 0.042, 0.006, 2.1], [0.07, 0.045, 0.042, 0.008, 2.2], [0.11, 0.032, 0.033, 0.004, 2.2], [0.135, 0.016, 0.02, -0.004, 2], [0.142, 0, 0, -0.006, 2]], 40, 48,
      (x, y, z, u, a) => {
        if (Math.cos(a) < -0.3) return mix(skinPale, cream, 0.4);
        /* polygon scales: the cell this point falls in, its seam pale */
        const sx = (x + 0.02) / 0.16, sa = (a / TAU);
        let d1 = 9, d2 = 9, k1 = 0; for (let k = 0; k < HS.length; k++) { const d = Math.hypot(sx - HS[k][0], (sa - HS[k][1]) * 1.6); if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d; }
        const seam = Math.min(1, (d2 - d1) / 0.035);
        return mix(skinPale, mix(skin, dark, 0.3 * M.vn(k1, 2, 3)), seam);
      });
    head.add(new T.Mesh(headG, skinM));
    /* the beak: horny, hooked a little, its edges serrated */
    const beak = M.loft([[0.1, 0.034, 0.012, -0.012, 2.2], [0.125, 0.026, 0.01, -0.012, 2.2], [0.145, 0.012, 0.007, -0.014, 2], [0.152, 0, 0, -0.016, 2]], 12, 24, (x, y) => mix(lin('#3a3222'), lin('#8a7a52'), Math.max(0, y + 0.016) * 60));
    head.add(new T.Mesh(beak, M.litP('#ffffff', { vertexColors: true, roughness: 0.3, clearcoat: 0.6 })));
    /* the eyes, dark and wet under a heavy lid */
    const eyeM = M.litP('#140f0a', { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 }), lids = [];
    for (const sd of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.0105, 20, 14), eyeM); e.position.set(0.082, 0.016, sd * 0.034); head.add(e);
      const lid = new T.Mesh(new T.SphereGeometry(0.0128, 18, 10, 0, TAU, 0, Math.PI * 0.42), skinM); M.paint(lid.geometry, () => skin);
      lid.position.copy(e.position); lid.rotation.set(sd * 0.25, 0, 0.35); head.add(lid); lids.push(lid);
    }
    /* ── the flippers: front ones long and curved back, each with a claw on its leading edge; hind ones short ── */
    const flip = (len, wid, sweep, claw) => {
      const geo = M.sheet(40, 18, (s, c) => {
        const w = wid * Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.88)) ** 0.6 * (1 - 0.35 * s), cc = c - 0.5;
        const x = -sweep * s * s * len + cc * w * 0.25, z = s * len, y = cc * w * 0.0;
        return [x + cc * w, (0.5 - Math.abs(cc)) * w * 0.12 * (1 - s), z];
      }, (s, c) => {
        /* (rows of scales, each dark with a pale rim; the trailing edge pale) */
        const fs = s * 16, fc = c * 7 + (Math.floor(fs) % 2) * 0.5, rim = Math.max(Math.abs(fs - Math.floor(fs) - 0.5), Math.abs(fc - Math.floor(fc) - 0.5)) * 2;
        const edge = Math.max(0, (Math.abs(c - 0.5) - 0.4) / 0.1);
        return mix(mix(skin, dark, 0.35 * M.vn(fs, fc, 3)), skinPale, Math.max(0.55 * Math.pow(rim, 6), 0.6 * edge));
      });
      const grp = new T.Group(); grp.add(new T.Mesh(geo, M.lit('#ffffff', { vertexColors: true, roughness: 0.55, side: T.DoubleSide })));
      if (claw) { const cl = new T.Mesh(new T.ConeGeometry(0.004, 0.016, 8), M.lit('#d8cfb0', { roughness: 0.4 })); cl.position.set(wid * 0.45 - sweep * 0.09 * len, 0, len * 0.3); cl.rotation.z = -1.2; grp.add(cl); }
      return grp;
    };
    const fins = [];
    for (const sd of [-1, 1]) {
      const f = new T.Object3D(); f.position.set(L * 0.28, 0.0, sd * L * 0.3); f.rotation.order = 'YXZ'; g.add(f);
      const fm = flip(0.42, 0.13, 0.55, true); if (sd < 0) fm.scale.z = -1; f.add(fm); fins.push({ f, sd, front: true });
      const h = new T.Object3D(); h.position.set(-L * 0.36, 0.0, sd * L * 0.22); h.rotation.order = 'YXZ'; g.add(h);
      const hm = flip(0.16, 0.12, 0.2, false); if (sd < 0) hm.scale.z = -1; h.add(hm); fins.push({ f: h, sd, front: false });
    }
    /* the tail, a short blunt stub */
    const tail = new T.Mesh(new T.ConeGeometry(0.018, 0.07, 12), skinM); M.paint(tail.geometry, () => skin); tail.rotation.z = Math.PI / 2; tail.position.set(-L * 0.52, -0.004, 0); g.add(tail);
    g.userData.anim = t => {
      for (const F of fins) {
        const ph = t * (F.front ? 1.4 : 1.4) + (F.front ? 0 : 1.6);
        F.f.rotation.x = F.sd * (F.front ? 0.35 * Math.sin(ph) : 0.18 * Math.sin(ph)) - F.sd * 0.1;
        F.f.rotation.y = F.sd * (F.front ? 0.25 + 0.25 * Math.sin(ph + 1.2) : -0.3 + 0.15 * Math.sin(ph + 1));
      }
      neck.rotation.y = 0.25 * Math.sin(t * 0.6); neck.rotation.z = 0.1 * Math.sin(t * 0.8);
      const blink = Math.max(0, Math.sin(t * 0.9)) ** 30;
      for (const l of lids) l.scale.y = 1 + blink * 0.6;
    };
    g.userData.anim(0);
    return g;
  });
})();
