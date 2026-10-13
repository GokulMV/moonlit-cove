/* a sanderling, the little sandpiper that runs the edge of the waves: pale grey above, every feather of its back dark
   at its middle and pale at its edge, snow white beneath; a short straight black bill, a dark eye, black legs.
   At the origin (its feet) in metres, facing +x; about 20 cm long. userData.anim(t): it pecks, and looks about.
   o.lite: fewer facets and its back painted plain, for the flocks. o.parts: userData.parts = { geo, hipY } for
   fauna.js to draw many: one geometry with its colours as aCol and as aW what each point belongs to (0 the body,
   [2, side] a leg and its foot, [3, side] a folded wing, [4] the head), lifted so its hips are at 0 */
(() => {
  const T = THREE, M = Models;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  M.add('life/sandpiper', (o = {}) => {
    const lite = !!o.lite, R = (full, few) => lite ? few : full;
    const g = new T.Group(), white = lin('#f2f1ec'), grey = lin('#a7a299'), dark = lin('#4a4540'), black = lin('#141312');
    const fM = M.lit('#ffffff', { vertexColors: true, roughness: 0.8 }), LEG = 0.045, HIP = LEG + 0.02;
    const wingsOf = new Map(), legsOf = new Map();
    /* (its back painted feather by feather: rows of small rounded feathers, each grey with a dark shaft-streak and a pale
       fringe, giving way to snow white down its sides and beneath) */
    const backTex = lite ? null : Models.__piperTex || (Models.__piperTex = M.texFrom(512, 512, (u, v) => {
      const d = Math.abs(v - 0.5), cover = 1 - sm(0.17, 0.24, d);
      if (cover <= 0) return white;
      const fu = u * 17, row = Math.floor(fu), fv = (v - 0.5) * 15 + (row % 2) * 0.5, cu = fu - row, cv = fv - Math.floor(fv);
      /* (each feather overlapping the one behind: its rounded tip toward the tail, a pale fringe round that tip) */
      const r = Math.hypot((cu - 0.62) * 1.25, (cv - 0.5)), shaft = Math.exp(-(((cv - 0.5) / 0.05) ** 2)) * sm(0.15, 0.6, cu) * (1 - sm(0.75, 0.95, cu));
      let c = mix(grey, dark, 0.45 * shaft + 0.12 * M.vn(row * 1.7, Math.floor(fv) * 2.3, 1));
      c = mix(c, lin('#d9d6cf'), 0.7 * sm(0.42, 0.55, r) * (cu < 0.5 ? 1 : 0.3));
      return mix(white, c, cover);
    }));
    /* (plain, for the flocks: grey above, white below, as the feathers come to seen from a little way off) */
    const plain = (x, y, z, u, a) => mix(white, mix(grey, dark, 0.22), 1 - sm(0.17, 0.24, Math.min(a, Math.PI * 2 - a) / (Math.PI * 2)));
    const body = M.loft([[-0.085, 0, 0, 0.004, 2], [-0.07, 0.008, 0.005, 0.004, 2], [-0.03, 0.026, 0.024, 0.0, 2], [0.01, 0.03, 0.03, 0.0, 2], [0.04, 0.025, 0.027, 0.004, 2], [0.06, 0.012, 0.014, 0.012, 2], [0.066, 0, 0, 0.016, 2]], R(48, 12), R(48, 10), lite ? plain : null);
    const b = new T.Mesh(body, lite ? fM : M.lit('#ffffff', { map: backTex, roughness: 0.8 })); b.position.y = LEG + 0.03; b.rotation.z = 0.08; g.add(b);
    const head = new T.Object3D(); head.position.set(0.06, LEG + 0.055, 0); g.add(head);
    const hg = M.loft([[-0.018, 0, 0, 0, 2], [-0.012, 0.012, 0.012, 0, 2], [0.0, 0.016, 0.016, 0.002, 2], [0.012, 0.012, 0.012, 0.001, 2], [0.02, 0, 0, -0.001, 2]], R(20, 6), R(28, 8),
      (x, y, z, u, a) => Math.cos(a) > 0.25 ? mix(grey, white, 0.3) : white);
    head.add(new T.Mesh(hg, fM));
    const bill = new T.Mesh(new T.ConeGeometry(0.0026, 0.026, R(10, 4)), M.lit('#121212', { roughness: 0.4 })); bill.rotation.z = -Math.PI / 2; bill.position.set(0.031, -0.002, 0); head.add(bill);
    const eyeM = M.litP('#0b0a09', { roughness: 0.1, clearcoat: 1 });
    for (const sd of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.0028, R(12, 5), R(10, 3)), eyeM); e.position.set(0.006, 0.004, sd * 0.0125); head.add(e); }
    /* the folded wings: grey, their tips black, crossed over the short tail */
    const wingG = M.sheet(R(20, 8), R(8, 3), (s, c) => { const w = 0.022 * Math.sin(Math.PI * Math.min(1, 0.2 + s * 0.85)); return [0.035 - s * 0.12, LEG + 0.05 - c * w * 1.2 - s * 0.006, 0.024 * Math.cos((c - 0.3) * 1.3) * (1 - 0.5 * s * s) + 0.004]; },
      (s, c) => s > 0.72 ? mix(black, dark, 0.3) : mix(grey, dark, 0.4 * Math.pow(0.5 + 0.5 * Math.sin(s * 40 + c * 6), 4)));
    for (const sd of [-1, 1]) { const w = new T.Mesh(wingG, M.lit('#ffffff', { vertexColors: true, roughness: 0.75, side: T.DoubleSide })); if (sd < 0) w.scale.z = -1; g.add(w); wingsOf.set(w, sd); }
    const legM = M.lit('#121212', { roughness: 0.5 });
    for (const sd of [-1, 1]) {
      const parts = [new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.0, HIP, sd * 0.009), new T.Vector3(0.002, LEG * 0.5, sd * 0.01), new T.Vector3(0.004, 0.002, sd * 0.011)]), R(10, 4), R(6, 3), () => 0.0013), legM)];
      for (const a of [-0.5, 0, 0.5]) parts.push(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.004, 0.002, sd * 0.011), new T.Vector3(0.004 + Math.cos(a) * 0.012, 0.001, sd * 0.011 + Math.sin(a) * 0.01)]), R(4, 1), R(4, 3), () => 0.0008), legM));
      for (const m of parts) { g.add(m); legsOf.set(m, sd); }
    }
    g.userData.anim = t => {
      const peck = Math.max(0, Math.sin(t * 2.4)) ** 6;
      head.rotation.z = -0.9 * peck; head.rotation.y = 0.4 * Math.sin(t * 0.9) * (1 - peck); head.position.y = LEG + 0.055 - 0.012 * peck;
    };
    g.userData.anim(0);
    if (o.parts) {
      head.rotation.set(0, 0, 0); head.position.y = LEG + 0.055;
      const heads = new Set(); head.traverse(m => { if (m.isMesh) heads.add(m); });
      g.userData.parts = { geo: M.tagged(g, m => heads.has(m) ? [4, 0, 0, 0] : wingsOf.has(m) ? [3, wingsOf.get(m), 0, 0] : legsOf.has(m) ? [2, legsOf.get(m), 0, 0] : null, -HIP), hipY: HIP };
    }
    return g;
  });
})();
