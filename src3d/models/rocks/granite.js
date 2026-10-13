/* ─────────────────────────────────────────────────────────────
   models/rocks/granite.js — the island's granite.
   rock/granite  one boulder: a corestone, the block the joints cut
                 the rock into, rounded off as it weathered in the
                 ground; its joints still cut into it in places as
                 grooves; sheets of its skin spalled off, leaving a
                 step at their edge where the fresher rock shows; on
                 its sides the odd pit; rain has streaked it dark
                 down its steep faces, lichen grows grey and here and
                 there orange on its top. If the tide reaches it
                 (o.tide, the high water's height): a black band of
                 lichen just above the line, below it the barnacles'
                 pale crust, and lower the wet dark rock and its weed.
                 o: size (m, its half-width), shape ('round', 'flat',
                 'tall', 'split'), seed, tide
   rock/tor      a pile of corestones, the big ones at the foot, one
                 or two perched on top, as the hills' tops are
   rock/cliff    a sea cliff of them: big blocks stacked two and three
                 deep into a face, packed close, the sea's bands along
                 its foot. o: width, height, tide
   The stone itself (its crystals: grey quartz, pinkish feldspar,
   black flecks of mica; its grain's relief) is drawn by the shader,
   in the world, so it never stretches.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t, sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const vn = (x, y, z) => Models.vn(x, y, z);
  const fbm = (x, y, z, o = 3) => { let s = 0, a = 1, n = 0; for (let k = 0; k < o; k++) { s += a * vn(x, y, z); n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; } return s / n; };

  /* ── the stone's shader: its crystals, its grain's relief; wet where the vertex colours say so (their wet share rides
     in a separate attribute) ── */
  let MAT = null;
  function material() {
    if (MAT) return MAT;
    const m = Mats.lit({ vertexColors: true, roughness: 0.9 }, 'granite'), prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWet;\nvarying float vWet;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWet = aWet;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWet;')
        .replace('#include <color_fragment>', `#include <color_fragment>
  { float d = distance(vWPos, cameraPosition), k = smoothstep(7.0, 1.2, d), k2 = smoothstep(30.0, 4.0, d);
    /* (the crystals, a few millimetres across: black mica, pinkish feldspar, grey glassy quartz between) */
    float n1 = vnz(vWPos*190.0), n2 = vnz(vWPos*120.0 + 7.3), n3 = vnz(vWPos*60.0 + 2.1);
    float mica = smoothstep(0.74, 0.8, n1), fel = smoothstep(0.5, 0.62, n2);
    vec3 c = diffuseColor.rgb*mix(vec3(0.86, 0.87, 0.9), vec3(1.14, 1.04, 0.95), fel);
    c *= mix(1.0, 0.28, mica);
    c *= 0.92 + 0.16*n3;
    diffuseColor.rgb = mix(diffuseColor.rgb*(0.96 + 0.08*n3), c, k);
    /* (a mottle at the scale of hands, seen from further) */
    diffuseColor.rgb *= mix(1.0, (0.86 + 0.28*vnz(vWPos*6.0 + 3.0))*(0.9 + 0.2*vnz(vWPos*17.0 + 5.0)), k2);
    diffuseColor.rgb *= mix(1.0, 0.55, vWet); }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor *= mix(1.0, 0.72, vWet);')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float d = distance(vWPos, cameraPosition), k = smoothstep(6.0, 1.0, d), kk = smoothstep(25.0, 3.0, d); const float e = 0.0025;
    #define GRH(p) (0.0012*k*vnz(p*120.0 + 7.3) + 0.0007*k*vnz(p*260.0) + 0.007*kk*vnz(p*8.0 + 1.0) + 0.005*kk*vnz(p*21.0 + 4.0) + 0.003*kk*vnz(p*45.0 + 2.0))
    float h0 = GRH(vWPos);
    vec3 g = vec3(GRH(vWPos + vec3(e, 0.0, 0.0)) - h0, GRH(vWPos + vec3(0.0, e, 0.0)) - h0, GRH(vWPos + vec3(0.0, 0.0, e)) - h0)/e;
    #undef GRH
    vec3 gv = mat3(viewMatrix)*g; normal = normalize(normal - (gv - dot(gv, normal)*normal)); }`);
    };
    m.customProgramCacheKey = () => 'art-granite';
    return (MAT = m);
  }

  /* ── one boulder's surface: a direction's radius, and what it is there (joint groove, sheet step, pit) ── */
  function shaper(R, o) {
    const shape = o.shape || 'round', S = o.size || 1;
    const sc = shape === 'flat' ? [1.15 + 0.2 * R(), 0.42 + 0.12 * R(), 0.95 + 0.2 * R()] : shape === 'tall' ? [0.82 + 0.1 * R(), 1.3 + 0.2 * R(), 0.75 + 0.12 * R()] : [0.95 + 0.3 * R(), 0.68 + 0.22 * R(), 0.85 + 0.25 * R()];
    const ex = 2.0 + 0.7 * R(), seed = R() * 50, rot = R() * TAU;
    /* (two to four faces where it was jointed against its neighbours: flattish, their edges rounded) */
    const faces = []; for (let k = 0, n = 2 + Math.floor(R() * 3); k < n; k++) { const a = R() * TAU, t = (R() - 0.6) * 1.4, l = 1; faces.push({ n: [Math.cos(a) * Math.cos(t), Math.sin(t), Math.sin(a) * Math.cos(t)], d: 0.72 + 0.16 * R(), soft: 0.12 + 0.1 * R() }); }
    /* (one or two joints still cut into it: planes through it, a groove where each meets the surface) */
    const joints = []; for (let k = 0, n = R() < 0.6 ? 1 : R() < 0.5 ? 2 : 0; k < n; k++) { const a = R() * TAU, t = (R() - 0.5) * 0.6; joints.push({ n: [Math.cos(a) * Math.cos(t), Math.sin(t), Math.sin(a) * Math.cos(t)], d: (R() - 0.5) * 0.9 * S, w: (0.025 + 0.03 * R()) * S, dep: (0.04 + 0.05 * R()) * S }); }
    /* (sheets of its skin spalled off: a cap of it gone, a step round the cap's ragged edge) */
    const sheets = []; for (let k = 0, n = 1 + Math.floor(R() * 2.5); k < n; k++) { const a = R() * TAU, up = 0.15 + 0.7 * R(), l = Math.hypot(Math.cos(a), up, Math.sin(a)); sheets.push({ c: [Math.cos(a) / l, up / l, Math.sin(a) / l], r: 0.35 + 0.35 * R(), t: (0.015 + 0.03 * R()) * S }); }
    const pits = R() < 0.25;
    return { S, sc, ex, seed, rot, faces, joints, sheets, pits, split: shape === 'split' ? { n: (() => { const a = R() * TAU; return [Math.cos(a), 0, Math.sin(a)]; })(), gap: (0.05 + 0.1 * R()) * S } : null };
  }
  /* the radius toward unit direction (x, y, z), and the masks (groove, fresh rock at a sheet's edge, pit) */
  function surface(K, x, y, z, out) {
    const { S, sc, ex, seed, rot } = K;
    /* (a rounded block: a superquadric turned its own way, lumpy at every scale) */
    const cr = Math.cos(rot), sr = Math.sin(rot), xr = x * cr - z * sr, zr = x * sr + z * cr;
    const q = Math.pow(Math.pow(Math.abs(xr / sc[0]), ex) + Math.pow(Math.abs(y / sc[1]), ex) + Math.pow(Math.abs(zr / sc[2]), ex), -1 / ex);
    let r = q * S * (1 + 0.13 * (fbm(x * 1.1 + seed, y * 1.1, z * 1.1, 3) - 0.5) + 0.045 * (fbm(x * 3.2 + seed, y * 3.2, z * 3.2, 3) - 0.5) + 0.012 * (vn(x * 11 + seed, y * 11, z * 11) - 0.5));
    /* (its jointed faces: the surface held back to each plane, softly) */
    for (const F of K.faces) { const dn = (x * F.n[0] + y * F.n[1] + z * F.n[2]) * r, lim = F.d * S; if (dn > lim - F.soft * S) { const over = dn - (lim - F.soft * S), k2 = F.soft * S, pulled = k2 * (1 - Math.exp(-over / k2)); r *= (lim - F.soft * S + pulled) / dn; } }
    let groove = 0, fresh = 0, pit = 0;
    const px = x * r, py = y * r, pz = z * r;
    for (const J of K.joints) { const dd = Math.abs(J.n[0] * px + J.n[1] * py + J.n[2] * pz - J.d); const g = 1 - sm(0, J.w, dd); if (g > 0) { r -= J.dep * g * g * (0.6 + 0.4 * vn(px * 3 + seed, py * 3, pz * 3)); groove = Math.max(groove, g); } }
    for (const Sh of K.sheets) { const c = x * Sh.c[0] + y * Sh.c[1] + z * Sh.c[2], edge = Math.cos(Sh.r * Math.PI / 2) + 0.06 * (vn(px * 5 + seed, py * 5, pz * 5) - 0.5) + 0.03 * (vn(px * 13, py * 13 + seed, pz * 13) - 0.5);
      const inside = sm(edge - 0.008, edge + 0.008, c); r -= Sh.t * inside; fresh = Math.max(fresh, inside * (1 - sm(edge + 0.008, edge + 0.08, c))); }
    if (K.pits && Math.abs(y) < 0.55) { const n = vn(px * 3.4 + seed, py * 3.4, pz * 3.4) * 0.7 + vn(px * 9 + seed, py * 9, pz * 9) * 0.3, p = sm(0.7, 0.8, n) * sm(0.55, 0.2, Math.abs(y)); r -= 0.035 * S * p; pit = p; }
    out[0] = r; out[1] = groove; out[2] = fresh; out[3] = pit; return out;
  }

  /* ── a boulder: the sphere pushed out to its surface, coloured as it weathered; sunk a little into what it lies on ── */
  function boulder(o = {}, R) {
    R = R || Models.rng((o.seed || 1) * 167 + 29);
    /* (three's icosahedron splits each face into (detail + 1)² triangles: some thousands for a small one, twenty-odd
       thousand for a big one) */
    const K = shaper(R, o), S = K.S, detail = o.detail ?? (S < 0.5 ? 12 : S < 1.6 ? 24 : 34), sph = new T.IcosahedronGeometry(1, detail), pos = sph.attributes.position;
    /* (merged to shared vertices, so the normals are smooth) */
    const map = new Map(), V = [], idx = [];
    for (let i = 0; i < pos.count; i++) { const k = Math.round(pos.getX(i) * 1e5) + ',' + Math.round(pos.getY(i) * 1e5) + ',' + Math.round(pos.getZ(i) * 1e5); let id = map.get(k); if (id === undefined) { id = V.length / 3; map.set(k, id); V.push(pos.getX(i), pos.getY(i), pos.getZ(i)); } idx.push(id); }
    sph.dispose();
    const n = V.length / 3, P = new Float32Array(n * 3), M = new Float32Array(n * 4), out = [0, 0, 0, 0], sink = (o.sink ?? 0.18) * S * K.sc[1];
    let ymin = 1e9;
    for (let i = 0; i < n; i++) {
      let x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2]; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      surface(K, x, y, z, out); let px = x * out[0], py = y * out[0], pz = z * out[0];
      if (K.split) { const s = Math.sign(px * K.split.n[0] + pz * K.split.n[2]) || 1; px += K.split.n[0] * s * K.split.gap * 0.5; pz += K.split.n[2] * s * K.split.gap * 0.5; }
      P[i * 3] = px; P[i * 3 + 1] = py; P[i * 3 + 2] = pz; M.set(out, i * 4); ymin = Math.min(ymin, py);
    }
    /* (its foot: flattened where it sits, the lowest part a little under) */
    const base = ymin + sink;
    for (let i = 0; i < n; i++) { let y = P[i * 3 + 1] - base; if (y < 0) y *= 0.25; P[i * 3 + 1] = y; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    colour(geo, M, R, o, S, o.off || [0, 0, 0]);
    return geo;
  }
  /* ── the boulder's colours: its own grey, lighter and lichened on top, streaked dark down its steep faces, fresher where a
     sheet came off, dark in its grooves and its pits and at its foot; and the tide's bands if it reaches ── */
  function colour(geo, M, R, o, S, off = [0, 0, 0]) {
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, n = P.length / 3, C = new Float32Array(n * 3), W = new Float32Array(n);
    const bk = 0.88 + 0.24 * R(), base = o.colour || mix3([0.13, 0.128, 0.122], [0.155, 0.143, 0.128], R()).map(q => q * bk), tide = o.tide, seed = R() * 40;   /* (one tone for the whole stone: never a channel each) */
    for (let i = 0; i < n; i++) {
      const x = P[i * 3] + off[0], y = P[i * 3 + 1] + off[1], z = P[i * 3 + 2] + off[2], ny = N[i * 3 + 1], g = M[i * 4 + 1], fr = M[i * 4 + 2], pt = M[i * 4 + 3];
      let c = base.map(q => q * (0.88 + 0.24 * fbm(x * 0.9 + seed, y * 0.9, z * 0.9, 3)));
      /* (weathered paler on top) */
      c = mix3(c, c.map(q => q * 1.12), sm(0.2, 0.9, ny) * 0.6);
      /* (rain streaks: dark, long, down the steep faces) */
      const st = sm(0.55, 0.75, vn(x * 7 + seed, y * 0.6, z * 7)) * sm(0.85, 0.2, Math.abs(ny)) * (0.5 + 0.5 * sm(-0.2, 0.3, ny));
      c = c.map(q => q * (1 - 0.42 * st));
      /* (lichen: grey-white crusts on the upward faces, now and then an orange one, a few black) */
      const lk = sm(0.6, 0.68, fbm(x * 4.5 + seed, y * 4.5, z * 4.5, 3)) * sm(0.1, 0.6, ny), lo = sm(0.82, 0.85, vn(x * 6.1, y * 6.1 + seed, z * 6.1)) * sm(0.3, 0.8, ny), lb = sm(0.78, 0.82, vn(x * 7.7 + 2, y * 7.7, z * 7.7 + seed)) * sm(-0.1, 0.4, ny);
      c = mix3(c, [0.22, 0.22, 0.2], lk * 0.5); c = mix3(c, [0.24, 0.13, 0.035], lo * 0.55); c = mix3(c, [0.04, 0.04, 0.036], lb * 0.5);
      /* (where a sheet spalled off: fresher, pinker rock along the step) */
      c = mix3(c, [0.19, 0.16, 0.14], fr * 0.5);
      /* (dark down in the grooves and the pits, green with algae in the shadier ones; and at the foot) */
      c = c.map(q => q * (1 - 0.5 * g * (0.6 + 0.4 * vn(x * 4, y * 4, z * 4)) - 0.22 * pt)); c = mix3(c, [0.05, 0.07, 0.03], g * sm(0.3, -0.2, ny) * 0.5);
      c = c.map(q => q * (0.6 + 0.4 * sm(0, 0.35 * S, P[i * 3 + 1])));
      let wet = 0;
      if (tide != null) {
        const tl = tide + 0.1 * (vn(x * 0.8 + seed, 0, z * 0.8) - 0.5) + 0.12 * Math.max(0, -ny);   /* (higher where the swell climbs a face) */
        /* (the black lichen's band above the line; the barnacles' crust below it; wet dark rock and weed lower) */
        const blk = sm(tl + 0.45, tl + 0.05, y) * sm(tl - 0.05, tl + 0.05, y), bar = sm(tl - 0.02, tl - 0.12, y) * sm(tl - 0.9, tl - 0.6, y), low = sm(tl - 0.5, tl - 0.9, y);
        c = mix3(c, [0.03, 0.03, 0.028], blk * 0.85);
        const bm = 0.85 + 0.3 * vn(x * 40, y * 40, z * 40);
        c = mix3(c, [0.17 * bm, 0.165 * bm, 0.148 * bm], bar * (0.7 + 0.2 * vn(x * 14 + seed, y * 14, z * 14)));
        c = mix3(c, [0.06, 0.075, 0.04], low * 0.65);
        wet = clamp(sm(tl + 0.1, tl - 0.15, y));
      }
      C[i * 3] = c[0]; C[i * 3 + 1] = c[1]; C[i * 3 + 2] = c[2]; W[i] = wet;
    }
    geo.setAttribute('color', new T.BufferAttribute(C, 3)); geo.setAttribute('aWet', new T.BufferAttribute(W, 1));
  }

  Models.add('rock/granite', (o = {}) => {
    const g = new T.Group(), m = new T.Mesh(boulder(o), material()); m.castShadow = m.receiveShadow = true; g.add(m);
    return g;
  });
  /* a tor: three to seven corestones, the big ones at the foot leaning together, one or two perched on them */
  Models.add('rock/tor', (o = {}) => {
    const g = new T.Group(), R = Models.rng((o.seed || 1) * 173 + 31), S = o.size || 2.2, n = 3 + Math.floor(R() * 5), placed = [];
    for (let k = 0; k < n; k++) {
      const top = k >= n - (n > 4 ? 2 : 1), sz = top ? S * (0.45 + 0.3 * R()) : S * (0.65 + 0.45 * R()), a = R() * TAU, d = top ? R() * S * 0.4 : S * (0.4 + 0.8 * R());
      const geo = boulder({ size: sz, shape: top ? (R() < 0.8 ? 'round' : 'tall') : R() < 0.3 ? 'flat' : R() < 0.15 ? 'split' : 'round', seed: (o.seed || 1) * 31 + k, tide: o.tide, sink: top ? 0.05 : 0.2 }, R);
      const mm = new T.Mesh(geo, material()); mm.castShadow = mm.receiveShadow = true;
      let y = 0; if (top) { geo.computeBoundingBox(); y = Math.max(...placed.map(p => p.h)) * (0.62 + 0.14 * R()); }
      mm.position.set(Math.cos(a) * d, y, Math.sin(a) * d); mm.rotation.set((R() - 0.5) * 0.2, R() * TAU, (R() - 0.5) * 0.2); g.add(mm);
      geo.computeBoundingBox(); placed.push({ h: y + geo.boundingBox.max.y });
    }
    return g;
  });
  /* a cliff: big blocks stacked into a face along x, its foot at y 0, its face toward +z; the tide's bands across them */
  Models.add('rock/cliff', (o = {}) => {
    const g = new T.Group(), R = Models.rng((o.seed || 1) * 179 + 37), W = o.width ?? 12, H = o.height ?? 7, tide = o.tide ?? 1.2;
    const tiers = Math.max(2, Math.round(H / 2.6));
    for (let t = 0; t < tiers; t++) {
      const y0 = t * H / tiers * 0.85, back = t * 1.1, n = Math.ceil(W / (2.0 - 0.2 * t)) + 1;
      for (let k = 0; k < n; k++) {
        const sz = (2.4 - 0.25 * t) * (0.75 + 0.45 * R()), x = -W / 2 + (k + 0.35 * R()) * W / (n - 1), z = -back - sz * 0.45 + (R() - 0.5) * 0.7;
        /* (its colours worked out where it will stand, so the tide's line runs level across the face) */
        const yy = y0 + (R() - 0.3) * 0.4, geo = boulder({ size: sz, shape: R() < 0.45 ? 'flat' : 'round', seed: (o.seed || 1) * 47 + t * 13 + k, sink: 0.35, detail: 26, tide, off: [x, yy, z] }, R);
        const mm = new T.Mesh(geo, material());
        mm.position.set(x, yy, z); mm.castShadow = mm.receiveShadow = true; g.add(mm);
      }
    }
    return g;
  });
  window.StoneKit = { boulder, material };
})();
