/* ─────────────────────────────────────────────────────────────
   models/flora/mangrove.js — the mangroves of the creek.
   flora/rhizophora — a bakau (Rhizophora apiculata) on its stilt
     roots (grow.js grows the tree, the roots and the roots let down
     from its limbs); from its twigs, under the leaves, its
     propagules hang: a brown fruit like a small upside-down pear,
     its four sepals turned back, and out of it the seedling's long
     green stem, club-shaped and a little bent, darkening to purple
     as it ripens, a red collar at its top. Round its foot in the
     mud, fallen ones stand where they speared in, a first pair or
     two of leaves at their tops.
   flora/avicennia — an api-api, and round it in the mud its
     breathing roots by the thousand: pencil-thin, a hand high,
     standing up in lines over the cable roots that run out under
     the mud from its foot; muddy at their feet, grey above, paler
     at their rounded tips, some green with algae. Its fruit hang
     in small bunches: flattened, velvety, grey-green, pointed.
   flora/propagule — one propagule, and a seedling, close to.
   Everything from its seed; the propagules and the fruit sway with
   the leaves round them.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (r, a) => a[0] + (a[1] - a[0]) * r();
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  /* ── a smooth body of revolution along a path: rings of `radial` points round each of the path's points, its radius
     r(t) and colour col(t, a) along it. The path's points and its frames come from the curve; the ends close to a point
     where r falls to nothing ── */
  function body(curve, n, radial, r, col, vTile = 0.04) {
    const fr = curve.computeFrenetFrames(n, false), P = [], C = [], U = [], I = [], L = curve.getLength();
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], rr = r(t);
      for (let j = 0; j <= radial; j++) { const a = j / radial * TAU, ca = Math.cos(a), sa = Math.sin(a), c = col(t, a);
        P.push(p.x + (N.x * ca + B.x * sa) * rr, p.y + (N.y * ca + B.y * sa) * rr, p.z + (N.z * ca + B.z * sa) * rr); C.push(c[0], c[1], c[2]); U.push(j / radial, t * L / vTile); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    /* (outward: the faces turned away from the path) */
    const Pp = g.attributes.position.array, Nn = g.attributes.normal.array; let s = 0;
    for (let i = 0; i <= n; i += 2) { const p = curve.getPointAt(i / n); for (let j = 0; j < radial; j += 3) { const k = (i * (radial + 1) + j) * 3; s += (Pp[k] - p.x) * Nn[k] + (Pp[k + 1] - p.y) * Nn[k + 1] + (Pp[k + 2] - p.z) * Nn[k + 2]; } }
    if (s < 0) { for (let i = 0; i < Nn.length; i++) Nn[i] = -Nn[i]; const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const q = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = q; } }
    return g;
  }
  /* a leaf as a solid little blade: a lens outline along +x from the origin, folded up along its midrib, arched; its upper
     side its colour, its rim a shade lighter. Facing +y */
  function blade(L, W, top, fold = 0.25, arch = 0.12) {
    const n = 12, P = [], C = [], U = [], I = [];
    for (let i = 0; i <= n; i++) {
      /* (an ellipse with a short point: broadest a little below the middle) */
      const t = i / n, w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75) * W * 0.5 * (t > 0.86 ? Math.pow((1 - t) / 0.14, 0.8) : 1), x = t * L, y = arch * L * Math.sin(Math.PI * t) * 0.5;
      P.push(x, y + fold * w, -w, x, y, 0, x, y + fold * w, w); U.push(0, t, 0.5, t, 1, t);
      const k = 0.9 + 0.14 * t; C.push(...top.map(q => q * k * 1.06), ...top.map(q => q * k * 0.86), ...top.map(q => q * k * 1.06));
    }
    for (let i = 0; i < n; i++) { const a = i * 3; I.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
  }
  /* merge geometries that have position, normal and color (and optionally aWind), each placed by its own matrix */
  function merge(list) {
    let nv = 0, ni = 0; for (const [g] of list) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), C = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), W = new Float32Array(nv * 4), I = new Uint32Array(ni); let o = 0, oi = 0;
    const v = V(), nm = new T.Matrix3();
    for (const [g, m, w] of list) {
      const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color; nm.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); P[(o + i) * 3] = v.x; P[(o + i) * 3 + 1] = v.y; P[(o + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); Nn[(o + i) * 3] = v.x; Nn[(o + i) * 3 + 1] = v.y; Nn[(o + i) * 3 + 2] = v.z;
        C[(o + i) * 3] = c.getX(i); C[(o + i) * 3 + 1] = c.getY(i); C[(o + i) * 3 + 2] = c.getZ(i);
        if (g.attributes.uv) { UV[(o + i) * 2] = g.attributes.uv.getX(i); UV[(o + i) * 2 + 1] = g.attributes.uv.getY(i); }
        if (w) { const q = typeof w === 'function' ? w(P[(o + i) * 3], P[(o + i) * 3 + 1], P[(o + i) * 3 + 2]) : w; W.set(q, (o + i) * 4); }
      }
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + o; o += p.count; oi += ix.length; g.dispose();
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2)); g.setAttribute('aWind', new T.BufferAttribute(W, 4));
    g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
  }
  /* ── a skin for the small round parts (a propagule's stem, its fruit, a breathing root): a mottle, and lenticels — the
     little pale corky slits a mangrove breathes through, longer along the stem than across, standing a hair proud ── */
  let skinT = null;
  function skin() {
    if (skinT) return skinT;
    const N = 256, R = Models.rng(41), Hh = new Float32Array(N * N), M = new Float32Array(N * N).fill(1);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; M[i] = 0.84 + 0.22 * Models.vn(x / N * 6, y / N * 6, 1.3) + 0.08 * Models.vn(x / N * 40, y / N * 40, 2.9); }
    for (let k = 0; k < 150; k++) {
      const cx = R() * N, cy = R() * N, rx = 1.2 + 1.6 * R(), ry = rx * (1.8 + 1.6 * R()), e = Math.ceil(ry) + 2;
      for (let yy = -e; yy <= e; yy++) for (let xx = -e; xx <= e; xx++) {
        const d = Math.hypot((xx + 0.5) / rx, (yy + 0.5) / ry); if (d > 1.4) continue;
        const i = ((Math.floor(cy) + yy + N) % N) * N + (Math.floor(cx) + xx + N) % N, q = Math.max(0, 1 - d);
        Hh[i] = Math.max(Hh[i], Math.sqrt(q)); M[i] = mix(M[i], 1.45, sm(0.05, 0.5, q)); if (d > 1 && d < 1.4) M[i] *= 0.9;
      }
    }
    const col = new Uint8Array(N * N * 4), nor = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, v = Math.round(clamp(M[i] / 1.5) * 255); col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = v; col[i * 4 + 3] = 255;
      const dx = Hh[y * N + (x + 1) % N] - Hh[y * N + (x + N - 1) % N], dy = Hh[((y + 1) % N) * N + x] - Hh[((y + N - 1) % N) * N + x], l = Math.hypot(dx * 1.6, dy * 1.6, 1);
      nor[i * 4] = Math.round((-dx * 1.6 / l * 0.5 + 0.5) * 255); nor[i * 4 + 1] = Math.round((-dy * 1.6 / l * 0.5 + 0.5) * 255); nor[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nor[i * 4 + 3] = 255;
    }
    const mk = (d, srgb) => { const t = new T.DataTexture(d, N, N, T.RGBAFormat, T.UnsignedByteType); t.wrapS = t.wrapT = T.RepeatWrapping; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 4; if (srgb) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; t.userData.keep = true; return t; };
    return (skinT = { map: mk(col, false), normalMap: mk(nor, false) });
  }
  const mats = {};
  /* (the skin's map is a multiplier about 1/1.5, so its colours are lifted back by the material's colour) */
  const mat = (key, o) => { if (mats[key]) return mats[key]; const { skin: sk, ...rest } = o;
    return (mats[key] = new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.55, metalness: 0 }, sk ? { map: skin().map, normalMap: skin().normalMap, normalScale: new T.Vector2(0.8, 0.8), color: new T.Color(1.5, 1.5, 1.5) } : {}, rest))); };

  /* ── one Rhizophora propagule, hanging from the origin down -y: a short stalk, the fruit (an upside-down pear, brown,
     rough), its four sepals turned back and up round its top, and out of its foot the seedling's stem, a club a hand or
     two long, a little bent, tapering to a point; a collar at its top, red when ripe. ripe 0..1: how far grown and
     coloured (young: short and green; ripe: full length, purple-brown) ── */
  function propagule(R, ripe, o = {}) {
    const parts = [], len = mix(0.1, 0.34, sm(0, 0.7, ripe)) * (0.88 + 0.24 * R()), rad = mix(0.0045, 0.0068, sm(0, 0.6, ripe)), bend = (R() - 0.5) * 0.09 * len / 0.3, bz = (R() - 0.5) * 0.04;
    const brown = [0.15, 0.1, 0.055], sep = [0.3, 0.24, 0.11];
    /* the stalk */
    parts.push([body(new T.LineCurve3(V(0, 0.005, 0), V(0, -0.03, 0)), 2, 6, () => 0.0028, () => [0.12, 0.09, 0.06]), new T.Matrix4()]);
    /* the fruit: broad at its top, narrowing down */
    const fy0 = -0.028, fh = 0.024;
    parts.push([body(new T.LineCurve3(V(0, fy0, 0), V(0, fy0 - fh, 0)), 7, 9, t => 0.0085 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)), 0.5) * (1 - 0.35 * t), (t, a) => { const k = 0.85 + 0.25 * Models.vn(a * 3, t * 5, 2.2); return brown.map(q => q * k); }), new T.Matrix4()]);
    /* four sepals, turned back up round the fruit's top */
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4, g = blade(0.013, 0.008, sep, 0.1, -0.4), m = new T.Matrix4().makeRotationY(-a).multiply(new T.Matrix4().makeRotationZ(0.9)); m.setPosition(Math.cos(a) * 0.006, fy0 - 0.004, Math.sin(a) * 0.006); parts.push([g, m]); }
    /* the collar and the stem: green, darkening to purple-brown as it ripens; paler and smoother near its top */
    /* (young: a fresh green; ripening: olive, then brown with a purple cast, the purple strongest near its top) */
    const sy = fy0 - fh + 0.004, g0 = [0.1, 0.17, 0.035], g1 = [0.075, 0.055, 0.042], gp = [0.085, 0.04, 0.05], col = mix3(g0, g1, sm(0.4, 1, ripe));
    /* (the collar: the seed-leaves' tube, out of the fruit's foot; reddening as it ripens, darkest where it leaves the fruit) */
    const collar = mix3([0.12, 0.16, 0.045], [0.1, 0.035, 0.03], sm(0.55, 0.95, ripe));
    parts.push([body(new T.LineCurve3(V(0, sy + 0.002, 0), V(0, sy - 0.016, 0)), 5, 9, t => rad * (1.04 - 0.06 * t), t => mix3(collar.map(q => q * 0.8), mix3(collar, col, 0.35), t)), new T.Matrix4()]);
    const c = new T.QuadraticBezierCurve3(V(0, sy - 0.01, 0), V(bend * 0.6, sy - 0.01 - len * 0.5, bz), V(bend, sy - 0.01 - len, bz * 1.4));
    parts.push([body(c, 16, 10, t => rad * (0.82 + 0.3 * Math.sin(Math.PI * Math.pow(t, 0.75))) * (t > 0.86 ? Math.pow((1 - t) / 0.14, 0.7) : 1) + 0.0003,
      (t, a) => { const k = (0.88 + 0.24 * Models.vn(a * 2, t * 18, o.seed || 1.7)) * (1.08 - 0.18 * t), c2 = mix3(col, gp, sm(0.6, 1, ripe) * 0.6 * (1 - sm(0, 0.5, t))); return c2.map(q => q * k); }), new T.Matrix4()]);
    return { parts, len: len + 0.06 };
  }
  /* a seedling: a fallen propagule speared into the mud, its lower third under it; from its top a short green shoot with a
     pair or two of leaves */
  function seedling(R, o = {}) {
    /* (it fell point first, as it hung: the stem and its collar, without the fruit, which stays on the tree; its point
       down in the mud; the shoot from its top) */
    const p = propagule(R, 1, o), parts = [], ls = p.len - 0.06, sink = ls * (0.3 + 0.12 * R()), dy = 0.058 + ls - sink;
    for (const [g, m] of p.parts.slice(-2)) parts.push([g, new T.Matrix4().multiplyMatrices(new T.Matrix4().makeTranslation(0, dy, 0), m)]);
    for (const [g] of p.parts.slice(0, -2)) g.dispose();
    /* (its first leaves: a dark glossy green, paler beneath; its shoot green) */
    const top = ls + 0.012 - sink, sh = 0.03 + 0.06 * R(), green = [0.035, 0.075, 0.018];
    parts.push([body(new T.LineCurve3(V(0, top - 0.01, 0), V(0, top + sh, 0)), 3, 6, t => 0.0032 * (1 - 0.4 * t), () => [0.06, 0.09, 0.025]), new T.Matrix4()]);
    for (let k = 0, np = 1 + Math.floor(R() * 2); k < np; k++) for (const sd of [0, Math.PI]) {
      const L = (0.05 + 0.04 * R()) * (k ? 0.7 : 1), az = sd + k * Math.PI / 2 + (R() - 0.5) * 0.3, gk = 0.9 + 0.2 * R(), g = blade(L, L * 0.45, green.map(q => q * gk), 0.22, 0.1);
      const m = new T.Matrix4().makeRotationY(-az).multiply(new T.Matrix4().makeRotationZ(0.55 - 0.25 * k)); m.setPosition(0, top + sh * (1 - 0.35 * k), 0); parts.push([g, m]);
    }
    return parts;
  }

  /* ── the propagules on a grown Rhizophora: hanging from the lower, outer side of its leaf clumps, one to four together,
     some still short and green, most long; how many and how ripe from the tree's own season ── */
  function propagules(g, t, o, R) {
    const H = t.info.H, list = [], ripe0 = o.ripe ?? 0.55 + 0.4 * R(), max = o.propagules ?? 110; let np = 0;
    for (const c of t.clumps) {
      if (np >= max) break;
      if (R() > (o.fertile ?? 0.42)) continue;
      const n = 1 + Math.floor(R() * 4), out = V(c.d.x, 0, c.d.z); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
      const base = c.c.clone().addScaledVector(out, c.r * (0.25 + 0.4 * R())).add(V(0, -c.r * (0.45 + 0.2 * R()), 0));
      for (let k = 0; k < n; k++) {
        const ripe = clamp(ripe0 + (R() - 0.5) * 0.7), p = propagule(R, ripe, { seed: R() * 9 }), at = base.clone().add(V((R() - 0.5) * 0.12, (R() - 0.5) * 0.05, (R() - 0.5) * 0.12));
        const m = new T.Matrix4().makeRotationY(R() * TAU).premultiply(new T.Matrix4().makeRotationX((R() - 0.5) * 0.12)); m.setPosition(at);
        const w = [c.ph, 0.2, clamp(at.y / H), H];
        for (const [pg, pm] of p.parts) list.push([pg, new T.Matrix4().multiplyMatrices(m, pm), w]);
        np++;
      }
    }
    if (!list.length) return;
    const m = new T.Mesh(merge(list), FloraLeaf.windBark(mat('propagule', { roughness: 0.5, side: T.DoubleSide, skin: true }))); m.castShadow = true; m.receiveShadow = true; m.userData.part = 'propagules'; m.userData.count = np; g.add(m);
  }
  /* fallen propagules standing in the mud round the tree, among its roots and beyond them */
  function seedlings(g, t, o, R) {
    const n = o.seedlings ?? 9, list = [], reach = t.info.crown.R + 1.5;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = 0.6 + Math.sqrt(R()) * reach, m = new T.Matrix4().makeRotationY(R() * TAU).premultiply(new T.Matrix4().makeRotationZ((R() - 0.5) * 0.25));
      m.setPosition(Math.cos(a) * d, 0, Math.sin(a) * d);
      for (const [pg, pm] of seedling(R)) list.push([pg, new T.Matrix4().multiplyMatrices(m, pm), [0, 0, 0, 1]]);
    }
    const mm = new T.Mesh(merge(list), mat('seedling', { roughness: 0.42, side: T.DoubleSide, skin: true })); mm.castShadow = true; mm.receiveShadow = true; mm.userData.part = 'seedlings'; g.add(mm);
  }

  /* ── an Avicennia's breathing roots: from its foot the cable roots run out under the mud every way, wandering, forking,
     five or eight metres; up from them, every few centimetres, a pneumatophore: a pencil a hand high (higher near the
     tree), rounded at its tip, leaning a little this way or that. One instanced mesh ── */
  function pneumaGeo() {
    /* (grey-brown and corky, the mud's stain on its foot, its rounded tip paler) */
    const curve = new T.QuadraticBezierCurve3(V(0, -0.03, 0), V(0.003, 0.07, 0), V(0.008, 0.15, 0.002));
    return body(curve, 7, 6, t => 0.0066 * (1 - 0.22 * t) * (t > 0.88 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.12)) : 1),
      t => { const y = t * 0.18 - 0.03, mud = 1 - sm(0.0, 0.05, y), tip = sm(0.68, 1, t), alg = sm(0.25, 0.05, t) * 0.5; let c = [0.095, 0.085, 0.07]; c = mix3(c, [0.075, 0.085, 0.05], alg); c = mix3(c, [0.17, 0.16, 0.14], tip); return mix3(c, [0.045, 0.036, 0.027], mud); }, 0.05);
  }
  /* (a Sonneratia's are cones instead: woody, as thick as a wrist at the foot, knee-high, blunt; fewer and farther apart) */
  function coneGeo() {
    const curve = new T.QuadraticBezierCurve3(V(0, -0.05, 0), V(0.006, 0.18, 0), V(0.014, 0.4, 0.004));
    return body(curve, 10, 9, t => 0.032 * Math.pow(1 - t, 1.25) * (1 + 0.35 * (1 - sm(0, 0.18, t))) + 0.004 * (1 - sm(0.92, 1, t)) + 0.0015,
      (t, a) => { const y = t * 0.45 - 0.05, mud = 1 - sm(0.0, 0.1, y), tip = sm(0.65, 1, t), rib = 0.92 + 0.12 * Math.cos(a * 7 + t * 3); let c = [0.1, 0.088, 0.072].map(q => q * rib); c = mix3(c, [0.17, 0.16, 0.14], tip); return mix3(c, [0.045, 0.036, 0.027], mud); }, 0.06);
  }
  const PNEUMA = {
    pencil: { geo: pneumaGeo, nC: [24, 32], step: 0.035, p: 0.85, scatter: 0.3, L: [4.5, 8], fork: 0.02, cap: 6000, size: (R, d) => { const s = 0.8 + 0.45 * R(); return [s, s * (0.65 + 0.6 * R()) * (1.15 - 0.4 * clamp(d / 7))]; }, tilt: 0.22 },
    cone: { geo: coneGeo, nC: [10, 15], step: 0.12, p: 0.55, scatter: 0.35, L: [4, 9], fork: 0.03, cap: 1400, size: (R, d) => { const s = 0.7 + 0.6 * R(); return [s, s * (0.75 + 0.55 * R()) * (1.25 - 0.55 * clamp(d / 8))]; }, tilt: 0.12 } };
  function pneumatophores(g, t, o, R, kind = 'pencil') {
    const P = PNEUMA[kind], spots = [], nC = Math.round(lerp(R, P.nC)), dens = o.pneuma ?? 1, cap = o.pneumaMax ?? P.cap;
    const walk = (x, z, a, L, depth) => {
      let px = x, pz = z;
      for (let s = 0; s < L; s += P.step) {
        a += (R() - 0.5) * 0.1 * Math.sqrt(P.step / 0.035); px += Math.cos(a) * P.step; pz += Math.sin(a) * P.step;
        const d = Math.hypot(px, pz), q = (1 - s / L) * 0.7 + 0.3;
        if (d > t.info.r0 + 0.2 && R() < P.p * dens * q) spots.push([px + (R() - 0.5) * P.scatter, pz + (R() - 0.5) * P.scatter, d]);
        if (depth < 2 && R() < P.fork * P.step / 0.035) walk(px, pz, a + (R() < 0.5 ? -1 : 1) * (0.45 + 0.5 * R()), (L - s) * (0.45 + 0.4 * R()), depth + 1);
      }
    };
    for (let k = 0; k < nC; k++) { const a = k / nC * TAU + (R() - 0.5) * 0.35; walk(Math.cos(a) * 0.25, Math.sin(a) * 0.25, a, lerp(R, P.L), 0); }
    while (spots.length > cap) spots.splice(Math.floor(R() * spots.length), 1);
    const geo = P.geo(), im = new T.InstancedMesh(geo, mat('pneuma-' + kind, { roughness: 0.82, skin: true }), spots.length), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = V(), c = new T.Color();
    spots.forEach(([x, z, d], i) => {
      const [s, sh] = P.size(R, d);
      e.set((R() - 0.5) * P.tilt, R() * TAU, (R() - 0.5) * P.tilt); q.setFromEuler(e); sc.set(s, sh, s);
      m.compose(V(x, 0, z), q, sc); im.setMatrixAt(i, m);
      /* (some greener with algae, some darker, the odd one bleached) */
      const u = R(), k = 0.82 + 0.3 * R(); c.setRGB(k, k, k); if (u < 0.22) c.setRGB(k * 0.82, k * 1.0, k * 0.72); else if (u < 0.3) c.setRGB(k * 1.15, k * 1.12, k * 1.05); im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true; im.userData.part = 'pneumatophores'; im.userData.count = spots.length; g.add(im);
    /* (the cable roots themselves break the surface here and there near the trunk) */
    const Kt = FloraKit, tile = Kt.bark('avicennia').tile, parts = [];
    for (let k = 0; k < 5; k++) { const a = R() * TAU; parts.push(...Kt.roots(Math.cos(a) * t.info.r0 * 0.8, Math.sin(a) * t.info.r0 * 0.8, [Math.cos(a), Math.sin(a)], 0.035 + 0.02 * R(), 0.8 + 1.4 * R(), { seed: Math.floor(R() * 1e6), tile, radial: 7 })); }
    if (parts.length) { const rm = new T.Mesh(Kt.mergeParts(parts), Kt.barkMat('avicennia', { tint: [0.62, 0.58, 0.52] })); rm.castShadow = rm.receiveShadow = true; g.add(rm); }
  }

  /* ── a Bruguiera's knee roots: its cable roots run out under the mud and every so often loop up out of it and back
     down, a knee a hand or two high, bent sharply over, swollen and corky at the bend; a line of them along each root ── */
  function knees(g, t, o, R) {
    const list = [], nC = 8 + Math.floor(R() * 6), r0 = t.info.r0;
    for (let k = 0; k < nC; k++) {
      let a = k / nC * TAU + (R() - 0.5) * 0.5, x = Math.cos(a) * (r0 + 0.3), z = Math.sin(a) * (r0 + 0.3);
      const L = 2 + 3.5 * R();
      for (let s = 0; s < L;) {
        const gap = (0.18 + 0.4 * R()) * (0.6 + 0.6 * s / L); s += gap; a += (R() - 0.5) * 0.35; x += Math.cos(a) * gap; z += Math.sin(a) * gap;
        if (R() < 0.15) continue;
        const span = 0.1 + 0.16 * R(), h = (0.1 + 0.24 * R()) * (1.2 - 0.55 * s / L), rr = 0.015 + 0.012 * R(), dx = Math.cos(a), dz = Math.sin(a), sk = R() * 9;
        /* (up out of the mud nearly upright, over a sharp bend with a corky knob on it, down again at a slant a little
           farther on: a knee, not a hoop) */
        const p0 = V(x, -0.06, z), p3 = V(x + dx * span, -0.06, z + dz * span), top = V(x + dx * span * 0.32, h, z + dz * span * 0.32);
        const c = new T.CatmullRomCurve3([p0, V(x + dx * span * 0.08, h * 0.55, z + dz * span * 0.08), top, V(x + dx * span * 0.62, h * 0.62, z + dz * span * 0.62), p3], false, 'centripetal');
        list.push([body(c, 16, 8, tt => rr * (0.9 + 0.9 * Math.exp(-(((tt - 0.47) / 0.12) ** 2))) * (0.88 + 0.24 * Models.vn(tt * 7, sk, 1.9)), (tt, aa) => { const y = c.getPoint(tt).y, mud = 1 - sm(-0.02, 0.07, y), k2 = 0.82 + 0.3 * Models.vn(aa * 2, tt * 6, x + z); return mix3([0.078 * k2, 0.068 * k2, 0.056 * k2], [0.04, 0.032, 0.024], mud); }, 0.05), new T.Matrix4(), [0, 0, 0, 1]]);
      }
    }
    if (!list.length) return;
    const m = new T.Mesh(merge(list), mat('knees', { roughness: 0.85, skin: true })); m.castShadow = m.receiveShadow = true; m.userData.part = 'knees'; g.add(m);
  }

  /* ── things that hang under the leaf clumps, swaying with them: a Sonneratia's fruit (a flattened green berry sitting in
     a star of six to eight leathery sepals spread flat, the style's stub on top) and a Bruguiera's propagules (a cigar-
     shaped green stem out of a red calyx of ten to fourteen narrow lobes) ── */
  function sonnFruit(R) {
    const fk = 0.85 + 0.3 * R(), parts = [], gr = [0.09, 0.14, 0.04].map(q => q * fk), sep = [0.12, 0.16, 0.05];
    parts.push([body(new T.LineCurve3(V(0, 0.005, 0), V(0, -0.025, 0)), 2, 6, () => 0.0035, () => [0.12, 0.13, 0.06]), new T.Matrix4()]);
    const n = 6 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) { const a = k / n * TAU, gb = blade(0.022, 0.011, sep, 0.05, -0.25), m = new T.Matrix4().makeRotationY(-a).multiply(new T.Matrix4().makeRotationZ(-0.25)); m.setPosition(Math.cos(a) * 0.008, -0.028, Math.sin(a) * 0.008); parts.push([gb, m]); }
    const f = body(new T.LineCurve3(V(0, -0.026, 0), V(0, -0.058, 0)), 8, 12, tt => 0.024 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + tt * 0.92)), 0.55), () => gr); parts.push([f, new T.Matrix4()]);
    parts.push([body(new T.LineCurve3(V(0, -0.058, 0), V(0, -0.072, 0)), 2, 6, tt => 0.0025 * (1 - 0.5 * tt), () => [0.2, 0.18, 0.1]), new T.Matrix4()]);
    return parts;
  }
  function brugPropagule(R, ripe) {
    const parts = [], red = mix3([0.3, 0.12, 0.05], [0.45, 0.05, 0.04], ripe), len = mix(0.08, 0.2, ripe) * (0.9 + 0.2 * R()), rad = 0.0075;
    parts.push([body(new T.LineCurve3(V(0, 0.005, 0), V(0, -0.025, 0)), 2, 6, () => 0.003, () => [0.25, 0.08, 0.05]), new T.Matrix4()]);
    /* (the calyx: a cup, and its lobes standing out and up round the stem's top) */
    parts.push([body(new T.LineCurve3(V(0, -0.022, 0), V(0, -0.04, 0)), 4, 12, tt => 0.007 + 0.006 * tt, () => red), new T.Matrix4()]);
    const n = 10 + Math.floor(R() * 5);
    for (let k = 0; k < n; k++) { const a = k / n * TAU, gb = blade(0.022, 0.0045, red, 0.05, 0.1), m = new T.Matrix4().makeRotationY(-a).multiply(new T.Matrix4().makeRotationZ(1.15)); m.setPosition(Math.cos(a) * 0.012, -0.04, Math.sin(a) * 0.012); parts.push([gb, m]); }
    const col = mix3([0.12, 0.18, 0.05], [0.08, 0.1, 0.04], ripe), c = new T.QuadraticBezierCurve3(V(0, -0.036, 0), V(0.004, -0.036 - len * 0.5, 0), V(0.008, -0.036 - len, 0.003));
    parts.push([body(c, 12, 9, tt => rad * (0.85 + 0.25 * Math.sin(Math.PI * Math.pow(tt, 0.8))) * (tt > 0.9 ? Math.pow((1 - tt) / 0.1, 0.6) : 1) + 0.0004, (tt, aa) => col.map(q => q * (0.9 + 0.2 * Models.vn(aa * 2, tt * 12, 3.7)))), new T.Matrix4()]);
    return parts;
  }
  function hangers(g, t, o, R, make, max, fertile, key) {
    const H = t.info.H, list = []; let n = 0;
    for (const c of t.clumps) {
      if (n >= max) break;
      if (R() > fertile) continue;
      const k0 = 1 + Math.floor(R() * 3), out = V(c.d.x, 0, c.d.z); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
      const base = c.c.clone().addScaledVector(out, c.r * (0.25 + 0.4 * R())).add(V(0, -c.r * (0.45 + 0.2 * R()), 0));
      for (let k = 0; k < k0 && n < max; k++, n++) {
        const at = base.clone().add(V((R() - 0.5) * 0.12, (R() - 0.5) * 0.05, (R() - 0.5) * 0.12)), m = new T.Matrix4().makeRotationY(R() * TAU).premultiply(new T.Matrix4().makeRotationX((R() - 0.5) * 0.15)); m.setPosition(at);
        const w = [c.ph, 0.2, clamp(at.y / H), H];
        for (const [pg, pm] of make(R)) list.push([pg, new T.Matrix4().multiplyMatrices(m, pm), w]);
      }
    }
    if (!list.length) return;
    const mm = new T.Mesh(merge(list), FloraLeaf.windBark(mat(key, { roughness: 0.5, side: T.DoubleSide, skin: true }))); mm.castShadow = true; mm.receiveShadow = true; mm.userData.part = key; mm.userData.count = n; g.add(mm);
  }
  /* an Avicennia's fruit: in bunches of three to six under the twigs, each a flattened tear, velvety grey-green, pointed */
  function avFruits(g, t, o, R) {
    const H = t.info.H, list = [], max = o.fruits ?? 60;
    for (const c of t.clumps) {
      if (R() > (o.fertile ?? 0.3)) continue;
      const n = 3 + Math.floor(R() * 4), out = V(c.d.x, 0, c.d.z).normalize(), base = c.c.clone().addScaledVector(out, c.r * 0.5).add(V(0, -c.r * 0.5, 0));
      for (let k = 0; k < n && list.length / 2 < max; k++) {
        const at = base.clone().add(V((R() - 0.5) * 0.1, -0.02 * k, (R() - 0.5) * 0.1)), m = new T.Matrix4().makeRotationY(R() * TAU).premultiply(new T.Matrix4().makeRotationZ((R() - 0.5) * 0.5)); m.setPosition(at);
        const w = [c.ph, 0.2, clamp(at.y / H), H], fk = 0.85 + 0.25 * R(), gc = [0.34, 0.38, 0.27].map(q => q * fk);
        list.push([body(new T.LineCurve3(V(0, 0.004, 0), V(0, -0.012, 0)), 2, 5, () => 0.0018, () => [0.3, 0.3, 0.2]), m.clone(), w]);
        const f = body(new T.LineCurve3(V(0, -0.01, 0), V(0, -0.038, 0)), 8, 10, tt => 0.011 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + tt * 0.92)), 0.65) * (1 - 0.55 * tt * tt), () => gc);
        f.scale(1, 1, 0.62); list.push([f, m.clone(), w]);
      }
    }
    if (!list.length) return;
    const fm = new T.Mesh(merge(list), FloraLeaf.windBark(mat('avfruit', { roughness: 0.85 }))); fm.castShadow = true; fm.userData.part = 'fruit'; g.add(fm);
  }

  Models.add('flora/rhizophora', (o = {}) => {
    const g = FloraGrow.model('rhizophora', o.seed || 1, o), t = g.userData.grown, R = Models.rng((o.seed || 1) * 131 + 7);
    if (o.propagules !== 0) propagules(g, t, o, R);
    if (o.seedlings !== 0) seedlings(g, t, o, R);
    return g;
  });
  Models.add('flora/avicennia', (o = {}) => {
    const g = FloraGrow.model('avicennia', o.seed || 1, o), t = g.userData.grown, R = Models.rng((o.seed || 1) * 137 + 11);
    if (o.pneuma !== 0) pneumatophores(g, t, o, R);
    if (o.fruits !== 0) avFruits(g, t, o, R);
    return g;
  });
  Models.add('flora/sonneratia', (o = {}) => {
    const g = FloraGrow.model('sonneratia', o.seed || 1, o), t = g.userData.grown, R = Models.rng((o.seed || 1) * 139 + 13);
    if (o.pneuma !== 0) pneumatophores(g, t, o, R, 'cone');
    if (o.fruits !== 0) hangers(g, t, o, R, sonnFruit, o.fruits ?? 40, 0.3, 'sonnfruit');
    return g;
  });
  Models.add('flora/bruguiera', (o = {}) => {
    const g = FloraGrow.model('bruguiera', o.seed || 1, o), t = g.userData.grown, R = Models.rng((o.seed || 1) * 149 + 17), ripe = o.ripe ?? 0.5 + 0.5 * R();
    if (o.knees !== 0) knees(g, t, o, R);
    if (o.propagules !== 0) hangers(g, t, o, R, r => brugPropagule(r, clamp(ripe + (r() - 0.5) * 0.6)), o.propagules ?? 60, 0.35, 'brugprop');
    return g;
  });
  /* one propagule (o.ripe), and a seedling beside it, at their real size */
  Models.add('flora/propagule', (o = {}) => {
    const R = Models.rng((o.seed || 1) * 17 + 3), g = new T.Group(), p = propagule(R, o.ripe ?? 0.9);
    const m = new T.Matrix4().makeTranslation(0, p.len + 0.02, 0), list = p.parts.map(([pg, pm]) => [pg, new T.Matrix4().multiplyMatrices(m, pm), [0, 0, 0, 1]]);
    const a = new T.Mesh(merge(list), mat('propagule1', { roughness: 0.5, side: T.DoubleSide, skin: true })); a.castShadow = true; g.add(a);
    const s = seedling(R).map(([pg, pm]) => [pg, new T.Matrix4().multiplyMatrices(new T.Matrix4().makeTranslation(0.12, 0, 0), pm), [0, 0, 0, 1]]);
    const b = new T.Mesh(merge(s), mat('seedling', { roughness: 0.42, side: T.DoubleSide, skin: true })); b.castShadow = true; g.add(b);
    return g;
  });
})();
