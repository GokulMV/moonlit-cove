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
  const sm2 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* the scutes, as on a real green turtle's shell: five vertebrals down the middle, four costals either side (the
     big plates), and round the rim a narrow band of marginals, twelve a side, the nuchal at the front between them.
     The vertebrals' and costals' middles, on the shell's plan (x along, z across, in shell lengths) */
  const SC = [];
  [[0.33, 0], [0.165, 0], [0.0, 0], [-0.165, 0], [-0.32, 0]].forEach(p => SC.push(p));
  for (const sd of [-1, 1]) [[0.235, 0.225], [0.07, 0.25], [-0.1, 0.245], [-0.255, 0.2]].forEach(([x, z]) => SC.push([x, sd * z]));
  const NM = 25;
  const tone = Array.from({ length: SC.length + NM }, (_, i) => 0.82 + 0.32 * M.vn(i * 3.7, 1.3, 2.1));
  /* which scute a point of the shell is on (k; the marginals are 13 on), how far from its middle (d1), and how far from
     the seam with the next (by d2 - d1); rim: how far into the rim band (0 inside it, 1 at the edge) */
  function scute(x, z, rim) {
    if (rim > 0) {
      const th = Math.atan2(z, x + 0.02), k = Math.round(th / TAU * NM + NM) % NM, f = th / TAU * NM - Math.round(th / TAU * NM);
      const dS = 0.5 - Math.abs(f);
      return [SC.length + k, 0.02 + 0.03 * Math.abs(f), 0.02 + 0.03 * Math.abs(f) + Math.min(dS * 0.07, rim * 0.06), -1];
    }
    let d1 = 9, d2 = 9, k1 = 0, k2 = 0;
    for (let k = 0; k < SC.length; k++) { const d = Math.hypot((x - SC[k][0]) * 1.12, z - SC[k][1]); if (d < d1) { d2 = d1; k2 = k1; d1 = d; k1 = k; } else if (d < d2) { d2 = d; k2 = k; } }
    return [k1, d1, d2, k2];
  }
  /* the head's scales: a Voronoi of cells over its skin */
  const HS = Array.from({ length: 70 }, (_, i) => { const r = M.rng(91 + i); return [r(), r()]; });
  const olive = lin('#463f26'), dark = lin('#1b1710'), amber = lin('#8c7440'), cream = lin('#e4d7ab'), skin = lin('#4c4733'), skinPale = lin('#b8b08e');
  /* the carapace's sections [x, half-width, half-height, centre, squareness], and the shell's colour at a point of its plan */
  const SECS = [[-L * 0.5, 0, 0, 0.0, 2], [-L * 0.47, L * 0.16, L * 0.035, 0.0, 2.2], [-L * 0.36, L * 0.33, L * 0.1, 0.004, 2.4], [-L * 0.15, L * 0.4, L * 0.155, 0.008, 2.5],
    [L * 0.08, L * 0.41, L * 0.17, 0.009, 2.5], [L * 0.28, L * 0.37, L * 0.14, 0.008, 2.4], [L * 0.42, L * 0.25, L * 0.085, 0.006, 2.2], [L * 0.49, L * 0.08, L * 0.03, 0.004, 2], [L * 0.5, 0, 0, 0.004, 2]];
  const prof = M.spline(SECS.map(r => [r[0], r[1], r[2], r[3], r[4]]));
  const rimOf = (u, a) => Math.max(sm2(0.84, 0.97, Math.abs(Math.sin(a))), sm2(0.08, 0.02, u), sm2(0.94, 0.985, u));
  function shellColour(x, z, up, rim) {
    const px = x / L, pz = z / L, [k1, d1, d2] = scute(px, pz, rim), seam = Math.min(1, (d2 - d1) / 0.012);
    if (!up) return mix(cream.map(v => v * 0.6), cream, seam).map(v => v * (0.92 + 0.1 * M.vn(x * 40, z * 40, 1)));
    /* streaks out from each scute's middle, yellow-brown and near-black on olive; the seams dark, edged a little paler */
    const c0 = k1 < SC.length ? SC[k1] : [px * 0.92, pz * 0.92], ang = Math.atan2(pz - c0[1], px - c0[0]);
    /* (streaks: noise drawn out along the rays from the middle, so they run outward, irregular) */
    const streak = sm2(0.42, 0.75, M.vn(ang * 3.2 + k1 * 7.3, d1 * 9 + 0.6 * M.vn(px * 20, pz * 20, k1), k1 * 1.9)) * Math.min(1, d1 / 0.035);
    let c = mix(olive, amber, 0.38 * streak * (0.5 + 0.8 * M.vn(px * 14, pz * 14, k1 + 2)) + 0.22 * M.vn(px * 40, pz * 40, k1)).map(v => v * tone[k1]);
    c = mix(c, dark, 0.35 * Math.pow(1 - streak, 3) * Math.min(1, d1 / 0.03) * M.vn(px * 12, pz * 12, k1 + 3));
    c = c.map(v => v * (0.9 + 0.1 * Math.sin(d1 * 240)));
    const edge = Math.max(0, 1 - Math.abs(seam - 0.35) / 0.25) * 0.25;
    return mix(dark, mix(c, amber, edge), 0.06 + 0.94 * seam);
  }
  let shTex = null, hdTex = null;
  const shellTex = () => shTex || (shTex = M.texFrom(1024, 1024, (u, v) => {
    const x = SECS[0][0] + u * (SECS[SECS.length - 1][0] - SECS[0][0]), a = Math.PI + v * TAU, [w, , , sq] = prof(x), sa = Math.sin(a), z = Math.max(0, w) * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / sq);
    return shellColour(x, z, Math.cos(a) > 0, rimOf(u, a));
  }));
  /* the head's skin: polygon scales, dark with pale seams, paler beneath */
  const headTex = () => hdTex || (hdTex = M.texFrom(512, 512, (u, v) => {
    const a = Math.PI + v * TAU; if (Math.cos(a) < -0.3) return mix(skinPale, cream, 0.4);
    let d1 = 9, d2 = 9, k1 = 0; for (let k = 0; k < HS.length; k++) { const d = Math.hypot(u - HS[k][0], (((v + 0.5) % 1) - HS[k][1]) * 1.6); if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d; }
    const seam = Math.min(1, (d2 - d1) / 0.02);
    return mix(skinPale, mix(skin, dark, 0.3 * M.vn(k1, 2, 3)), seam);
  }));

  M.add('life/turtle', () => {
    const g = new T.Group();
    /* ── the carapace: lofted along x, domed, its rim thin; scutes raised a little at their middles, and painted on a
       picture of the whole shell (each texel worked back to where on the shell's plan it lies) ── */
    const shell = M.loft(SECS, 80, 96, null, { shape: (x, y, z, u, a) => {
        if (Math.cos(a) <= 0) { const cy = 0.004; return [x, cy + (y - cy) * 0.28, z]; }      /* (the plastron, nearly flat) */
        const [k1, d1, d2] = scute(x / L, z / L, rimOf(u, a)), seam = Math.min(1, (d2 - d1) / 0.03), rimK = k1 >= SC.length ? 1 : 0;
        /* (each scute a little raised; the rim serrated at the back) */
        let yy = y + 0.004 * (seam - 0.5) * Math.cos(a);
        const back = x < -L * 0.3 ? 1 : 0, ser = back * rimK * Math.max(0, Math.cos(Math.atan2(z, x) * 18)) * 0.012;
        return [x - ser * 0.4, yy, z * (1 + ser)]; } });
    g.add(new T.Mesh(shell, M.litP('#ffffff', { map: shellTex(), roughness: 0.55, clearcoat: 0.1, clearcoatRoughness: 0.45 })));
    const skinM = M.lit('#ffffff', { vertexColors: true, roughness: 0.62 });
    /* ── the head: blunt, scaled, on a short wrinkled neck ── */
    const neck = new T.Object3D(); neck.position.set(L * 0.44, 0.012, 0); g.add(neck);
    const neckG = M.loft([[-0.06, 0.055, 0.04, 0, 2], [0, 0.048, 0.036, 0.004, 2], [0.06, 0.045, 0.034, 0.01, 2]], 16, 24, (x, y, z) => mix(skin, skinPale, 0.3 + 0.3 * Math.sin(x * 260) + (y < 0 ? 0.3 : 0)));
    neck.add(new T.Mesh(neckG, skinM));
    const head = new T.Object3D(); head.position.set(0.06, 0.012, 0); neck.add(head);
    const headG = M.loft([[-0.02, 0.045, 0.035, 0, 2], [0.02, 0.05, 0.042, 0.006, 2.1], [0.07, 0.045, 0.042, 0.008, 2.2], [0.11, 0.032, 0.033, 0.004, 2.2], [0.135, 0.016, 0.02, -0.004, 2], [0.142, 0, 0, -0.006, 2]], 40, 48, null);
    head.add(new T.Mesh(headG, M.lit('#ffffff', { map: headTex(), roughness: 0.55 })));
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
      /* (its planform: the width along its length, swept back toward the tip; in section an aerofoil, thick at the root) */
      const w = s => wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.88)), 0.6) * (1 - 0.35 * s) + 0.004, mid = s => -sweep * s * s * len;
      const geo = M.foil(64, 44, s => ({ le: [mid(s) + 0.5 * w(s), 0, s * len], ch: [-w(s), 0, 0], up: [0, 1, 0], th: 0.17 - 0.08 * s }), (x, y, z, s, c, top) => {
        /* (rows of scales, each dark with a pale rim, smaller toward the tip; the trailing edge pale; paler beneath) */
        /* (irregular polygons: the nearest of a jittered grid of points, its seam where the next nearest is as near) */
        const fs = s * 12, fc = c * (3.5 + 2.5 * s); let d1 = 9, d2 = 9, cell = 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const i = Math.floor(fs) + di, j = Math.floor(fc) + dj, px = i + 0.5 + 0.7 * (M.vn(i * 7.1, j * 3.3, 1.7) - 0.5), py = j + 0.5 + 0.7 * (M.vn(i * 2.9, j * 5.7, 4.1) - 0.5), d = Math.hypot(fs - px, fc - py); if (d < d1) { d2 = d1; d1 = d; cell = i * 31 + j; } else if (d < d2) d2 = d; }
        const rim = 1 - Math.min(1, (d2 - d1) / 0.07);
        let col = mix(mix(skin.map(v => v * 0.8), dark, 0.2 + 0.4 * M.vn(cell * 0.37, 1.3, 3)), skinPale, 0.3 * rim);
        col = mix(col, skinPale, 0.5 * Math.max(0, (c - 0.86) / 0.14));
        return top ? col : mix(col, cream, 0.6);
      });
      const grp = new T.Group(); grp.add(new T.Mesh(geo, M.lit('#ffffff', { vertexColors: true, roughness: 0.72 })));
      if (claw) { const cl = new T.Mesh(new T.ConeGeometry(0.004, 0.016, 8), M.lit('#d8cfb0', { roughness: 0.4 })); cl.position.set(mid(0.3) + 0.5 * w(0.3) + 0.004, 0, len * 0.3); cl.rotation.z = -1.2; grp.add(cl); }
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
