/* the wild flowers at the forest's edge, picked and held up close: a beach daisy, a beach morning glory, a fallen
   frangipani. Each at the origin in metres, its stem's foot (or, for the frangipani, the flower's heart) at the
   origin, +y up */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const flip = geo => { const I = geo.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = geo.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; return geo; };
  /* a stem: a tube up a gentle curve */
  const stemGeo = (pts, r0, r1, col) => M.paint(M.tube(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 24, 8, t => r0 + (r1 - r0) * t), () => col);
  /* a leaf: a blade along +x from its stalk, its outline w(s) (0..1 of the width), folded a little along its midrib and
     arching; darker at its midrib and veins */
  function leafGeo(len, wid, outline, { fold = 0.25, arch = 0.18, col = lin('#3c6a2c'), vein = 0.8, ns = 28, nc = 14 } = {}) {
    return M.sheet(ns, nc, (s, c) => { const w = outline(s) * wid, z = (c - 0.5) * 2 * w, y = Math.abs(c - 0.5) * 2 * w * fold - arch * len * s * s; return [s * len, y + arch * len * s * 0.6, z]; },
      (s, c) => { const d = Math.abs(c - 0.5) * 2, mid = Math.exp(-((d / 0.06) ** 2)), side = Math.pow(0.5 + 0.5 * Math.cos((s * 9 - d * 3) * Math.PI), 18) * (d > 0.08 ? 1 : 0);
        return mix(col, col.map(v => v * 1.35), 0.6 * mid * vein + 0.25 * side * vein).map(v => v * (0.92 + 0.12 * s)); });
  }

  /* ── beach daisy: a dozen yellow rays, each with three teeth at its tip, round a domed disc of tiny florets; green
     bracts beneath; a stem with two toothed leaves ── */
  M.add('life/daisy', (o = {}) => {
    /* (o.lite: few facets, the disc's florets painted on it rather than each made; o.head: the flower alone, facing up) */
    const lite = !!o.lite, R = (full, few) => lite ? few : full;
    const g = new T.Group(), H = 0.11, head = new T.Group(); head.position.y = o.head ? 0 : H; head.rotation.z = o.head ? 0 : 0.12; g.add(head);
    const yel = lin('#f6c51e'), yel2 = lin('#f0a915');
    const parts = [];
    const ray = M.sheet(R(18, 6), R(12, 3), (s, c) => {
      /* an oblong ray, rounded at its tip, nicked twice into three shallow teeth */
      const cc = (c - 0.5) * 2, nick = s > 0.9 ? 0.06 * Math.pow((s - 0.9) / 0.1, 1.5) * Math.pow(Math.abs(Math.sin(cc * Math.PI * 1.5)), 0.5) : 0;
      const w = 0.0058 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.9)), 0.35) * (0.75 + 0.25 * Math.min(1, s * 3));
      return [0.0062 + (s - nick) * 0.024, -0.004 * s * s + 0.0011 * cc * cc, cc * w]; },
      (s, c) => mix(yel2, yel, Math.min(1, s * 1.6)).map(v => v * (0.94 + 0.08 * Math.pow(Math.cos((c - 0.5) * 7 * Math.PI), 2))));
    for (let i = 0; i < 13; i++) parts.push({ geo: ray, m: M.M4(0, 0.0015, 0, 0, i / 13 * TAU + 0.1 * Math.sin(i * 3.1), 0.12 + 0.05 * Math.sin(i * 1.7)) });
    /* the disc: tiny tubular florets on a low dome, in the spirals they grow in */
    const fl = new T.CylinderGeometry(0.00065, 0.0006, 0.0018, 6, 1); fl.translate(0, 0.0009, 0);
    const dot = new T.SphereGeometry(0.00072, 6, 4);
    if (!lite) for (let i = 0; i < 180; i++) {
      const a = i * 2.39996, rr = 0.0068 * Math.sqrt(i / 180), y = 0.0035 * (1 - (rr / 0.0068) ** 2) + 0.0012, open = i / 180;
      const c = mix(lin('#8a4d12'), lin('#e2a21e'), open);
      parts.push({ geo: fl, m: M.M4(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.sin(a) * rr * 40, 0, -Math.cos(a) * rr * 40), c });
      parts.push({ geo: dot, m: M.M4(Math.cos(a) * rr, y + 0.0018, Math.sin(a) * rr), c: c.map(v => v * 1.2) });
    }
    const disc = new T.SphereGeometry(lite ? 0.0076 : 0.0072, R(20, 12), R(8, 4), 0, TAU, 0, Math.PI / 2); disc.scale(1, lite ? 0.75 : 0.55, 1);
    /* (light: the florets as the colour of the dome, opening outward from a dark middle) */
    if (lite) M.paint(disc, (x, y, z) => mix(lin('#7a420f'), lin('#d49a1d'), Math.min(1, Math.hypot(x, z) / 0.0072) ** 1.5));
    parts.push({ geo: disc, m: M.M4(0, 0.0005, 0), c: lite ? undefined : lin('#6b3a10') });
    /* green bracts cupping the head */
    const bract = M.sheet(R(6, 2), R(6, 2), (s, c) => [0.002 + s * 0.008, -0.002 - s * 0.003, (c - 0.5) * 0.004 * (1 - s)], () => lin('#4f7a2c'));
    for (let i = 0; i < 9; i++) parts.push({ geo: bract, m: M.M4(0, -0.0006, 0, 0, i / 9 * TAU + 0.3, -0.35) });
    const rec = new T.SphereGeometry(0.006, R(14, 8), R(8, 3), 0, TAU, Math.PI / 2, Math.PI / 2); rec.scale(1, 0.7, 1);
    parts.push({ geo: rec, m: M.M4(0, 0, 0), c: lin('#557f30') });
    const headM = M.lit('#ffffff', { vertexColors: true, roughness: 0.55, side: T.DoubleSide });
    head.add(new T.Mesh(M.mergeC(parts), headM));
    if (o.head) return g;
    /* the stem and its leaves */
    const green = lin('#4a7a2e');
    const st = lite ? M.paint(M.tube(new T.CatmullRomCurve3([[0, 0, 0], [0.003, 0.035, 0.002], [-0.002, 0.075, -0.002], [0.002, H - 0.002, 0]].map(p => new T.Vector3(...p))), 8, 4, t => 0.0018 - 0.0004 * t), () => green)
      : stemGeo([[0, 0, 0], [0.003, 0.035, 0.002], [-0.002, 0.075, -0.002], [0.002, H - 0.002, 0]], 0.0018, 0.0014, green);
    const lf = (len, s) => leafGeo(len, 0.012, x => Math.sin(Math.PI * Math.min(1, x * 0.95 + 0.04)) * (1 + 0.12 * Math.sin(x * 24)), { col: lin('#3e6d2a'), fold: 0.3, arch: 0.15, ns: R(28, 8), nc: R(14, 4) });
    const stemParts = [{ geo: st }, { geo: lf(0.042), m: M.M4(0.002, 0.03, 0, 0, 0.4, 0.5) }, { geo: lf(0.036), m: M.M4(-0.001, 0.062, 0, 0, Math.PI + 0.9, 0.55) }];
    g.add(new T.Mesh(M.mergeC(stemParts), M.lit('#ffffff', { vertexColors: true, roughness: 0.82, side: T.DoubleSide })));
    g.userData.anim = t => { head.rotation.z = 0.12 + 0.03 * Math.sin(t * 1.3); head.rotation.x = 0.04 * Math.sin(t * 1.7); };
    return g;
  });

  /* ── beach morning glory: a funnel of fused petals, pink-mauve, its five midribs darker and a deep magenta throat; a
     green calyx; a stalk off a length of runner with two of its goat's-foot leaves ── */
  M.add('life/glory', () => {
    const g = new T.Group(), fl = new T.Group(); fl.position.set(0.012, 0.035, 0); fl.rotation.z = -0.55; g.add(fl);
    const pink = lin('#d9539f'), pale = lin('#ec8fc4'), throat = lin('#7a1446');
    /* s from the base of the tube to the rim, c round it */
    const funnel = (s, c, k = 1) => {
      const a = c * TAU, lobe = 1 + 0.07 * Math.cos(a * 5) * Math.pow(s, 3), R = (0.0035 + 0.032 * Math.pow(s, 2.2)) * lobe * k, y = 0.048 * Math.pow(s, 0.8) - 0.006 * Math.pow(s, 4);
      return [Math.cos(a) * R, y, Math.sin(a) * R];
    };
    const tint = (s, c) => { const a = c * TAU, rib = Math.pow(Math.max(0, Math.cos(a * 5)), 6); let col = mix(throat, pink, Math.min(1, s * 1.8)); col = mix(col, pale, Math.max(0, s - 0.6) * 1.5 * (1 - rib)); col = mix(col, throat.map(v => v * 1.5), rib * 0.45 * s); return col; };
    const outer = M.sheet(30, 80, (s, c) => funnel(s, c), (s, c) => tint(s, c).map(v => v * 0.85));
    const inner = flip(M.sheet(30, 80, (s, c) => { const p = funnel(s, c, 0.96); return [p[0], p[1] + 0.0004, p[2]]; }, tint));
    const flM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5 });
    fl.add(new T.Mesh(M.mergeC([{ geo: outer }, { geo: inner }]), flM));
    /* the stamens, pale, deep in the throat */
    const stam = new T.CylinderGeometry(0.0004, 0.0004, 0.016, 5); stam.translate(0, 0.008, 0);
    const anth = new T.SphereGeometry(0.0011, 8, 6); const sp = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; sp.push({ geo: stam, m: M.M4(Math.cos(a) * 0.0012, 0.004, Math.sin(a) * 0.0012), c: lin('#f3e6ef') }, { geo: anth, m: M.M4(Math.cos(a) * 0.0012, 0.0205, Math.sin(a) * 0.0012), c: lin('#fbf4f8') }); }
    /* the calyx: five green sepals round the foot of the tube */
    const sepal = M.sheet(6, 6, (s, c) => [(c - 0.5) * 0.006 * (1 - s * 0.7), s * 0.012, 0.0032 + s * 0.001], () => lin('#4b7b30'));
    for (let i = 0; i < 5; i++) sp.push({ geo: sepal, m: M.M4(0, -0.003, 0, 0, i / 5 * TAU, 0) });
    fl.add(new T.Mesh(M.mergeC(sp), M.lit('#ffffff', { vertexColors: true, roughness: 0.55, side: T.DoubleSide })));
    /* the runner along the sand, the flower's stalk, and the leaves: rounded, notched deep at the tip like a goat's hoof */
    const green = lin('#4c6e2c');
    const runner = stemGeo([[-0.06, 0.002, -0.01], [-0.02, 0.004, 0.0], [0.02, 0.003, 0.006], [0.06, 0.002, 0.012]], 0.0026, 0.0024, lin('#7a5a3a'));
    const stalk = stemGeo([[0, 0.003, 0.002], [0.004, 0.02, 0.0], [0.012, 0.035, 0]], 0.0016, 0.0013, green);
    const hoof = s => { const lob = Math.sin(Math.PI * Math.min(1, s)) ** 0.7; return lob * (s > 0.8 ? 1 - 0.6 * Math.pow((s - 0.8) / 0.2, 1.5) : 1); };
    const leaf = M.sheet(26, 22, (s, c) => {
      const w = hoof(s) * 0.03, z = (c - 0.5) * 2 * w, notch = Math.exp(-(((c - 0.5) / 0.09) ** 2)) * Math.max(0, s - 0.75) / 0.25 * 0.012;
      return [s * 0.05 - notch, Math.abs(c - 0.5) * 2 * w * 0.2 + 0.003 * s, z]; },
      (s, c) => { const d = Math.abs(c - 0.5) * 2, mid = Math.exp(-((d / 0.05) ** 2)), side = Math.pow(0.5 + 0.5 * Math.cos((s * 6 - d * 2.2) * Math.PI), 16) * (d > 0.06 ? 1 : 0);
        return mix(lin('#2f6a2a'), lin('#6aa35a'), 0.55 * mid + 0.2 * side).map(v => v * (0.95 + 0.1 * s)); });
    g.add(new T.Mesh(M.mergeC([{ geo: runner }, { geo: stalk }, { geo: leaf, m: M.M4(-0.03, 0.004, -0.004, 0, 2.3, 0.18) }, { geo: leaf, m: M.M4(0.035, 0.003, 0.01, 0, -0.6, 0.12, 0.85) }]),
      M.litP('#ffffff', { vertexColors: true, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3, side: T.DoubleSide })));
    g.userData.anim = t => { fl.rotation.z = -0.55 + 0.04 * Math.sin(t * 1.2); fl.rotation.y = 0.05 * Math.sin(t * 0.9); };
    return g;
  });

  /* ── beach morning glory as it grows over the sand (for flora.js, many of them): a runner creeping along, rooting as
     it goes, its thick glossy leaves held up off the sand on their stalks, each round and notched at its tip like a
     goat's hoof and folded a little along its midrib, the newest small and still folded near the growing tip; a pink
     trumpet on its stalk looking up, and a bud. o.lite: few facets. o.head: the trumpet alone, opening up (+y), at the
     origin. o.seed. Lying along x, about 40 cm, the sand at y = 0 ── */
  M.add('life/gloryvine', (o = {}) => {
    const lite = !!o.lite, R = (full, few) => lite ? few : full, r = M.rng(o.seed || 3), g = new T.Group();
    const pink = lin('#d9539f'), pale = lin('#ec8fc4'), throat = lin('#7a1446'), green = lin('#4c6e2c'), leafC = lin('#2f6a2a');
    /* the trumpet: fused petals, the five midribs darker, the throat deep magenta; inside and out; the calyx at its foot */
    const trumpet = () => {
      const funnel = (s, c, k = 1) => { const a = c * TAU, lobe = 1 + 0.07 * Math.cos(a * 5) * Math.pow(s, 3), Rr = (0.0035 + 0.032 * Math.pow(s, 2.2)) * lobe * k, y = 0.048 * Math.pow(s, 0.8) - 0.006 * Math.pow(s, 4); return [Math.cos(a) * Rr, y, Math.sin(a) * Rr]; };
      const tint = (s, c) => { const a = c * TAU, rib = Math.pow(Math.max(0, Math.cos(a * 5)), 6); let col = mix(throat, pink, Math.min(1, s * 1.8)); col = mix(col, pale, Math.max(0, s - 0.6) * 1.5 * (1 - rib)); return mix(col, throat.map(v => v * 1.5), rib * 0.45 * s); };
      const outer = M.sheet(R(30, 7), R(80, 20), (s, c) => funnel(s, c), (s, c) => tint(s, c).map(v => v * 0.85));
      const inner = flip(M.sheet(R(30, 7), R(80, 20), (s, c) => { const p = funnel(s, c, 0.96); return [p[0], p[1] + 0.0004, p[2]]; }, tint));
      const sepal = M.sheet(R(6, 2), R(6, 2), (s, c) => [(c - 0.5) * 0.006 * (1 - s * 0.7), s * 0.012, 0.0032 + s * 0.001], () => lin('#4b7b30'));
      const parts = [{ geo: outer }, { geo: inner }];
      for (let i = 0; i < 5; i++) parts.push({ geo: sepal, m: M.M4(0, -0.003, 0, 0, i / 5 * TAU, 0) }, { geo: flip(sepal.clone()), m: M.M4(0, -0.003, 0, 0, i / 5 * TAU, 0) });
      return M.mergeC(parts);
    };
    const flM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5, side: T.DoubleSide });
    if (o.head) { g.add(new T.Mesh(trumpet(), flM)); return g; }
    const tube = (pts, r0, r1, col) => M.paint(M.tube(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), R(24, 6), R(8, 4), t => r0 + (r1 - r0) * t), () => col);
    /* the runner: along the sand, wandering a little, rooting where it touches (a slight dip there) */
    const RUN = []; for (let i = 0; i <= 8; i++) { const t = i / 8; RUN.push([-0.2 + t * 0.4, 0.0025 + 0.002 * Math.sin(t * 9), 0.035 * Math.sin(t * 3.4 + 0.5) + 0.012 * Math.sin(t * 9.1)]); }
    const runC = new T.CatmullRomCurve3(RUN.map(p => new T.Vector3(...p)));
    const parts = [{ geo: tube(RUN, 0.0028, 0.002, lin('#7a5f3c')) }];
    /* a leaf: rounded, notched deep at the tip like a goat's hoof, folded along its midrib; darker veins */
    const hoof = s => { const lob = Math.sin(Math.PI * Math.min(1, s)) ** 0.7; return lob * (s > 0.8 ? 1 - 0.6 * Math.pow((s - 0.8) / 0.2, 1.5) : 1); };
    const leaf = M.sheet(R(26, 7), R(22, 6), (s, c) => {
      const w = hoof(s) * 0.03, z = (c - 0.5) * 2 * w, notch = Math.exp(-(((c - 0.5) / 0.09) ** 2)) * Math.max(0, s - 0.75) / 0.25 * 0.012;
      return [s * 0.05 - notch, Math.abs(c - 0.5) * 2 * w * 0.28 + 0.003 * s, z]; },
      (s, c) => { const d = Math.abs(c - 0.5) * 2, mid = Math.exp(-((d / 0.07) ** 2)); return mix(leafC, lin('#6aa35a'), 0.5 * mid).map(v => v * (0.95 + 0.1 * s)); });
    /* the leaves along the runner, alternate, each on its stalk rising and turned out from it, held up toward the light;
       smaller toward the growing tip (+x) */
    const NL = lite ? 6 : 7;
    for (let i = 0; i < NL; i++) {
      const t = 0.06 + i * (0.86 / (NL - 1)), p = runC.getPointAt(t), tg = runC.getTangentAt(t), sd = i % 2 ? 1 : -1, k = 1.05 - 0.45 * Math.pow(t, 2) + 0.1 * (r() - 0.5);
      const yaw = Math.atan2(-tg.z, tg.x) + sd * (1.0 + 0.4 * r()), plen = (0.03 + 0.02 * r()) * k, lift = 0.55 + 0.3 * r();
      const dx = Math.cos(yaw) * Math.cos(lift), dy = Math.sin(lift), dz = -Math.sin(yaw) * Math.cos(lift);
      const e = [p.x + dx * plen, p.y + dy * plen, p.z + dz * plen];
      parts.push({ geo: tube([[p.x, p.y, p.z], [p.x + dx * plen * 0.5, p.y + dy * plen * 0.62, p.z + dz * plen * 0.5], e], 0.0013, 0.001, green) });
      /* (the blade at the stalk's end, tilted up a little more and turned to the side a touch) */
      parts.push({ geo: leaf, m: M.M4(e[0], e[1], e[2], (r() - 0.5) * 0.3, yaw + (r() - 0.5) * 0.4, 0.25 + 0.25 * r(), k) });
    }
    /* the flower on its stalk from the runner, looking up and out; a bud near it */
    {
      const p = runC.getPointAt(0.45), up = 0.05;
      parts.push({ geo: tube([[p.x, p.y, p.z], [p.x + 0.004, p.y + up * 0.55, p.z + 0.006], [p.x + 0.012, p.y + up, p.z + 0.01]], 0.0016, 0.0013, green) });
      const f = new T.Mesh(trumpet(), flM); f.position.set(p.x + 0.012, p.y + up, p.z + 0.01); f.rotation.set(0.15, 0.3, -0.5); g.add(f);
      const q = runC.getPointAt(0.62), bud = new T.ConeGeometry(0.0045, 0.022, R(10, 5), 1); bud.translate(0, 0.011, 0);
      parts.push({ geo: tube([[q.x, q.y, q.z], [q.x - 0.002, q.y + 0.02, q.z - 0.004]], 0.0012, 0.001, green) });
      parts.push({ geo: M.paint(bud, (x, y) => mix(lin('#4b7b30'), pink, Math.min(1, y / 0.016))), m: M.M4(q.x - 0.002, q.y + 0.02, q.z - 0.004, -0.4, 0, 0.3) });
    }
    g.add(new T.Mesh(M.mergeC(parts), M.litP('#ffffff', { vertexColors: true, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.35, side: T.DoubleSide })));
    return g;
  });

  /* ── frangipani: five thick, waxy petals overlapping in a pinwheel, creamy white with a yolk-yellow heart, a short
     tube behind ── */
  M.add('life/frangi', (o = {}) => {
    const lite = !!o.lite, g = new T.Group(), white = lin('#fbf7ee'), cream = lin('#f6edd8'), yolk = lin('#f4b526');
    const petal = M.sheet(lite ? 8 : 24, lite ? 6 : 18, (s, c) => {
      /* an obovate petal, broad toward its round tip, one side lapping over its neighbour; cupped, its tip curling back */
      const w = 0.019 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + s * 0.84)), 0.8) * (0.4 + 0.6 * s), cc = (c - 0.5) * 2, asym = 1 + 0.3 * cc;
      const x = 0.004 + s * 0.034, z = cc * w * asym, y = 0.006 * cc * cc * s - 0.008 * Math.pow(s, 2.5) + 0.0035 * Math.sin(s * Math.PI);
      return [x, y + 0.002 * cc * s, z]; },
      (s, c) => { const k = Math.max(0, 1 - s / 0.55); return mix(mix(cream, white, Math.min(1, s * 1.5)), yolk, Math.pow(k, 1.4) * (0.95 - 0.35 * Math.abs(c - 0.5))).map(v => v * (0.95 + 0.06 * Math.cos((c - 0.5) * 12))); });
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push({ geo: petal, m: M.M4(0, 0.0035 - i * 0.0004, 0, 0.1, i / 5 * TAU, 0.18) });
    const tube = new T.CylinderGeometry(0.0032, 0.002, 0.012, lite ? 8 : 14, lite ? 1 : 4, true); tube.translate(0, -0.004, 0);
    parts.push({ geo: M.paint(tube, (x, y) => mix(yolk, lin('#a9a25a'), Math.min(1, -y / 0.011))), m: M.M4(0, 0.002, 0, 0, 0, 0) });
    g.add(new T.Mesh(M.mergeC(parts), M.lit('#ffffff', { vertexColors: true, roughness: 0.4, side: T.DoubleSide })));
    return g;
  });
})();
