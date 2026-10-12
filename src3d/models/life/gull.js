/* a gull standing, for holding up close: white head and breast, a pale grey mantle and folded wings whose black
   primaries cross over the white tail, each with a white spot and a white tip; a yellow bill with the red spot on its
   lower mandible; a pale yellow eye ringed red; pink legs and webbed feet.
   At the origin (its feet) in metres, facing +x; about 50 cm from bill to tail. userData.anim(t): the head turns and
   tilts, the eye blinks, the wings shift */
(() => {
  const T = THREE, M = Models;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  M.add('life/gull', () => {
    const g = new T.Group(), white = lin('#f4f4f1'), grey = lin('#a9b2ba'), greyD = lin('#8b949c'), black = lin('#141414'), pink = lin('#e6a39a');
    const featherM = M.lit('#ffffff', { vertexColors: true, roughness: 0.78 });
    const LEG = 0.11;     /* (how high the body stands) */
    /* the body: an egg along x, deeper at the breast, tapering to the tail */
    const body = M.loft([[-0.2, 0, 0, 0.012, 2], [-0.17, 0.018, 0.01, 0.012, 2], [-0.1, 0.05, 0.045, 0.008, 2], [-0.02, 0.065, 0.068, 0.0, 2], [0.05, 0.06, 0.07, 0.002, 2], [0.1, 0.042, 0.055, 0.012, 2], [0.13, 0.025, 0.035, 0.03, 2], [0.14, 0, 0, 0.04, 2]], 48, 48,
      (x, y, z, u, a) => { const back = Math.cos(a), k = Math.max(0, (back - 0.35) / 0.5) * (x < 0.09 ? 1 : 0) * (x > -0.16 ? 1 : 0); return mix(white, grey, Math.min(1, k)).map(v => v * (0.96 + 0.06 * M.vn(x * 200, y * 200, z * 200))); });
    const bodyG = new T.Mesh(body, featherM); bodyG.position.y = LEG + 0.07; bodyG.rotation.z = 0.12; g.add(bodyG);
    /* the neck and head: a short curve up from the breast, the head round with a flat crown */
    const neck = new T.Object3D(); neck.position.set(0.1, LEG + 0.1, 0); g.add(neck);
    const neckG = M.loft([[-0.03, 0.036, 0.04, 0, 2], [0.02, 0.03, 0.034, 0.012, 2], [0.05, 0.028, 0.03, 0.028, 2]], 14, 32, () => white);
    neck.add(new T.Mesh(neckG, featherM));
    const head = new T.Object3D(); head.position.set(0.05, 0.04, 0); neck.add(head);
    const headG = M.loft([[-0.04, 0, 0, 0.0, 2], [-0.03, 0.022, 0.024, 0.0, 2], [0.0, 0.034, 0.034, 0.004, 2.1], [0.03, 0.03, 0.03, 0.004, 2.1], [0.05, 0.02, 0.022, 0.0, 2], [0.06, 0.012, 0.012, -0.004, 2], [0.064, 0, 0, -0.005, 2]], 30, 40,
      (x, y, z) => mix(white, lin('#e8e8e4'), y < -0.01 ? 0.5 : 0));
    head.add(new T.Mesh(headG, featherM));
    /* the bill: yellow, deep, its tip hooked; the red spot on the lower mandible */
    const bill = M.loft([[0.055, 0.008, 0.011, -0.003, 2.2], [0.075, 0.006, 0.009, -0.004, 2.2], [0.095, 0.0045, 0.008, -0.005, 2.2], [0.108, 0.003, 0.006, -0.007, 2], [0.114, 0, 0, -0.01, 2]], 24, 20,
      (x, y, z) => { const spot = x > 0.088 && x < 0.104 && y < -0.007 ? 1 : 0; return spot ? lin('#d8301e') : mix(lin('#e9c33a'), lin('#f4d860'), Math.max(0, (y + 0.005) * 80)); },
      { shape: (x, y, z) => { const hook = x > 0.1 ? -Math.pow((x - 0.1) / 0.014, 2) * 0.004 : 0; return [x, y + (y > -0.005 ? hook : 0), z]; } });
    head.add(new T.Mesh(bill, M.litP('#ffffff', { vertexColors: true, roughness: 0.32, clearcoat: 0.5 })));
    /* the gape line between the mandibles */
    head.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.052, -0.006, 0.0105), new T.Vector3(0.08, -0.0055, 0.0085), new T.Vector3(0.108, -0.007, 0.0045)]), 12, 4, () => 0.0007), M.lit('#6b4a20')));
    head.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.052, -0.006, -0.0105), new T.Vector3(0.08, -0.0055, -0.0085), new T.Vector3(0.108, -0.007, -0.0045)]), 12, 4, () => 0.0007), M.lit('#6b4a20')));
    /* the eyes: pale yellow round a black pupil, a red ring of bare skin */
    const irisG = new T.SphereGeometry(0.0062, 20, 14);
    M.paint(irisG, (x, y, z) => { const r = Math.hypot(x, y) / 0.0062; return z < 0 ? [0.02, 0.02, 0.02] : r < 0.38 ? [0.01, 0.01, 0.01] : [0.85, 0.78, 0.42]; });
    const eyeM = M.litP('#ffffff', { vertexColors: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }), ringM = M.lit('#d9532c', { roughness: 0.5 }), lids = [];
    for (const sd of [-1, 1]) {
      const e = new T.Group(); e.position.set(0.024, 0.012, sd * 0.026); e.rotation.y = sd > 0 ? 0.25 : Math.PI - 0.25; head.add(e);
      e.add(new T.Mesh(irisG, eyeM));
      const ring = new T.Mesh(new T.TorusGeometry(0.0065, 0.0012, 8, 24), ringM); ring.position.z = 0.0018; e.add(ring);
      const lid = new T.Mesh(new T.SphereGeometry(0.0069, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), featherM); M.paint(lid.geometry, () => white); lid.rotation.x = Math.PI / 2; lid.scale.set(1, 1, 0.01); e.add(lid); lids.push(lid);
    }
    /* the folded wings along its sides, the black primaries crossing over the tail */
    const wingG = M.sheet(36, 12, (s, c) => {
      const x = 0.07 - s * 0.36, w = 0.06 * Math.sin(Math.PI * Math.min(1, 0.25 + s * 0.8)) * (s > 0.7 ? 1 - (s - 0.7) * 1.8 : 1);
      const y = LEG + 0.11 - c * w * 1.4 - s * 0.02, z = 0.055 * Math.cos((c - 0.3) * 1.2) * (1 - 0.55 * s * s) + 0.004;
      return [x, y, z]; },
      (s, c) => {
        if (s < 0.62) return mix(grey, greyD, c * 0.4).map(v => v * (0.95 + 0.08 * Math.pow(Math.sin(s * 60 + c * 4), 8)));
        /* the primaries: black, a white spot near each tip, the very tips white; a white crescent along the tertials */
        const fe = Math.pow(0.5 + 0.5 * Math.sin(c * 22), 4), tip = s > 0.96, mirror = s > 0.86 && s < 0.92 && c > 0.3 && c < 0.7;
        return tip || mirror ? white : mix(black, lin('#3a3a3a'), 0.4 * fe);
      });
    const wings = [];
    for (const sd of [-1, 1]) { const w = new T.Mesh(wingG, M.lit('#ffffff', { vertexColors: true, roughness: 0.7, side: T.DoubleSide })); if (sd < 0) w.scale.z = -1; g.add(w); wings.push(w); }
    /* the white tail beneath the wingtips */
    const tail = M.sheet(8, 10, (s, c) => [-0.17 - s * 0.07, LEG + 0.085 - s * 0.012, (c - 0.5) * (0.05 + 0.03 * s)], () => white);
    g.add(new T.Mesh(tail, M.lit('#ffffff', { vertexColors: true, roughness: 0.8, side: T.DoubleSide })));
    /* the legs and their webbed feet */
    const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.55 });
    for (const sd of [-1, 1]) {
      const leg = M.paint(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.0, LEG + 0.05, sd * 0.02), new T.Vector3(0.004, LEG * 0.5, sd * 0.024), new T.Vector3(0.006, 0.004, sd * 0.026)]), 16, 8, t => 0.0045 - 0.0012 * t), () => pink);
      g.add(new T.Mesh(leg, legM));
      /* three toes forward, joined by the web */
      const toes = [-0.45, 0, 0.45].map(a => [0.006 + Math.cos(a) * 0.05, sd * 0.026 + Math.sin(a) * 0.03 * sd]);
      for (const [tx, tz] of toes) g.add(new T.Mesh(M.paint(M.tube(new T.CatmullRomCurve3([new T.Vector3(0.006, 0.003, sd * 0.026), new T.Vector3((0.006 + tx) / 2, 0.003, (sd * 0.026 + tz) / 2), new T.Vector3(tx, 0.002, tz)]), 8, 6, t => 0.0026 - 0.0012 * t), () => pink), legM));
      const web = M.sheet(4, 8, (s, c) => { const a = -0.45 + c * 0.9, r = 0.008 + s * 0.04 * (1 - 0.25 * Math.abs(c - 0.5)); return [0.006 + Math.cos(a) * r, 0.0025, sd * 0.026 + Math.sin(a) * r * 0.6 * sd]; }, () => mix(pink, lin('#c97a72'), 0.4));
      g.add(new T.Mesh(web, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: T.DoubleSide })));
    }
    g.userData.anim = t => {
      neck.rotation.y = 0.35 * Math.sin(t * 0.7) + 0.15 * Math.sin(t * 2.1); head.rotation.z = 0.12 * Math.sin(t * 0.9 + 1); head.rotation.x = 0.1 * Math.sin(t * 1.3);
      const blink = Math.max(0, Math.sin(t * 1.1)) ** 40; for (const l of lids) l.scale.z = 0.01 + blink;
      wings.forEach((w, i) => { w.rotation.x = (i ? -1 : 1) * 0.02 * Math.sin(t * 1.7); });
    };
    g.userData.anim(0);
    return g;
  });
})();
