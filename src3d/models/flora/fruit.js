/* ─────────────────────────────────────────────────────────────
   models/flora/fruit.js — fruit and its flowers, through every
   stage of their lives.
   A fruit's age (0..1) is the whole of it: just set, a tiny green
   thing with the dry flower still on it; swelling; ripening in
   patches from the sun side; ripe; overripe, the spots coming and
   spreading, the skin going slack; rotten, dark, sunk, wrinkled,
   furred with mould. FloraFruit.material(kind) draws all of that
   from an age per instance (aAge) — so one InstancedMesh holds a
   whole tree's fruit at every stage at once — and its shadow
   matches (FloraFruit.depth(kind)).
   A flower's age (0..1) is the same for flowers: a bud, opening,
   open, withering brown and falling (FloraFruit.flowers(kind)).
   Geometry: FloraFruit.geo(kind) — the fruit hanging from its
   stalk at the origin, hanging down -y — and FloraFruit.bloom(kind)
   — a flower or a panicle of them, rising from the origin.
   ───────────────────────────────────────────────────────────── */
const FloraFruit = (() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lin = hex => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };   /* (sRGB hex → linear, as three keeps colours) */

  /* ── each kind's skin through its life, its sizes, how it shrivels. Colours as sRGB hex: unripe dark → light, ripe,
     blush (on the sun side), the overripe spots, rotten, mould; tip: the colour of hairs' or spines' tips unripe → ripe.
     n: noise frequencies (per metre) for its blotches, its ripening patches, its spots; blush: how much; k: lenticels,
     spots, mould, how strongly a hair's or spine's tip takes its own colour; r: roughness unripe, ripe, rotten; g: the
     size it starts at, how deep it shrivels, the wrinkles' frequency, how far it sags ── */
  const KINDS = {
    /* a mango: smooth, waxy, speckled with pale lenticels; dark green, then yellowing from the shoulder, gold with a red
       flush where the sun reached it; black spots of anthracnose; sunk and brown-black, white with mould */
    mango: { u0: '#2d5a1e', u1: '#5f8a2c', ripe: '#e6ac30', blush: '#c64a2a', spot: '#1c120a', rot: '#38220f', mould: '#9fa696', tip0: '#5f8a2c', tip1: '#e0a52e',
      n: [9, 22, 70], blush_: 0.75, k: [0.8, 1, 0.8, 0], r: [0.42, 0.32, 0.85], g: [0.07, 0.07, 90, 0.004] },
    /* a rambutan: its soft hairs green, then yellow, then red with yellow-green tips; darkening to maroon, the hairs
       blackening and drying */
    rambutan: { u0: '#3f6a1c', u1: '#86a433', ripe: '#b8231d', blush: '#d0362a', spot: '#3c140e', rot: '#2a120c', mould: '#8a8478', tip0: '#a9c45a', tip1: '#c5c04a',
      n: [40, 60, 120], blush_: 0.3, k: [0, 0.6, 0.4, 0.9], r: [0.55, 0.5, 0.9], g: [0.1, 0.06, 140, 0.0] },
    /* a durian: olive green spines, browning yellow as it ripens; splitting on the ground */
    durian: { u0: '#3d5a1c', u1: '#6a7a2a', ripe: '#8a7a2e', blush: '#97803a', spot: '#2c2410', rot: '#3a2c16', mould: '#9a9a88', tip0: '#2e3a14', tip1: '#4a3a1a',
      n: [8, 16, 40], blush_: 0.2, k: [0, 0.5, 0.6, 0.7], r: [0.62, 0.6, 0.9], g: [0.12, 0.04, 50, 0.0] },
    /* a cempedak: warty, green to orange-brown */
    cempedak: { u0: '#4c6a22', u1: '#7d8a32', ripe: '#b07a2a', blush: '#a0602a', spot: '#2a1a0c', rot: '#3a2410', mould: '#a4a494', tip0: '#7d8a32', tip1: '#b07a2a',
      n: [6, 14, 40], blush_: 0.3, k: [0, 1, 0.7, 0], r: [0.6, 0.55, 0.9], g: [0.08, 0.05, 60, 0.01] },
    /* a papaya: smooth, faintly ribbed, green to yellow-orange from the tip up; sunk, dark-ringed rot */
    papaya: { u0: '#2f5c20', u1: '#5a8a2e', ripe: '#e8962a', blush: '#f0a030', spot: '#3a2410', rot: '#4a2c14', mould: '#c0c0b0', tip0: '#5a8a2e', tip1: '#e8962a',
      n: [5, 12, 30], blush_: 0.4, k: [0, 1, 1, 0], r: [0.4, 0.33, 0.85], g: [0.06, 0.08, 60, 0.008] },
    /* a banana finger: green, yellow, freckled with sugar spots, brown, black */
    banana: { u0: '#3a6a22', u1: '#6a9a34', ripe: '#e8c83a', blush: '#e0c03a', spot: '#2a1a0a', rot: '#1c140c', mould: '#a8a898', tip0: '#2a2a1a', tip1: '#2a2a1a',
      n: [20, 30, 160], blush_: 0.0, k: [0, 1.4, 0.6, 0], r: [0.45, 0.4, 0.8], g: [0.15, 0.06, 80, 0.0] },
    /* a coconut: green (or orange-gold), drying brown, cracking grey */
    coconut: { u0: '#4a6a20', u1: '#7a9a30', ripe: '#7a5a2a', blush: '#8a6a30', spot: '#3a2a16', rot: '#4a3c2c', mould: '#8a8478', tip0: '#7a9a30', tip1: '#7a5a2a',
      n: [5, 10, 30], blush_: 0.2, k: [0, 0.3, 0.2, 0], r: [0.45, 0.7, 0.9], g: [0.1, 0.02, 30, 0.0] } };

  /* ── the shader: vertex — the fruit grows from a small one to its full size, and shrivels and wrinkles as it rots (a
     rambutan's hairs shrink back); fragment — its skin's colour for its age, its blotches, its blush, spots, rot,
     mould, lenticels, and the wrinkles' relief ── */
  const VDECL = `
attribute float aAge; attribute float aSeed; attribute vec4 aFr;
uniform vec4 uFrG; uniform vec3 uFrP;
varying float vAge; varying float vSeed; varying vec4 vFr; varying vec3 vObj;
float frH(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float frN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(frH(i), frH(i + vec3(1,0,0)), f.x), mix(frH(i + vec3(0,1,0)), frH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(frH(i + vec3(0,0,1)), frH(i + vec3(1,0,1)), f.x), mix(frH(i + vec3(0,1,1)), frH(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
  const VBODY = `
  { float ag = aAge, sk = aFr.w;
    float gr = mix(uFrG.x, 1.0, 1.0 - pow(1.0 - smoothstep(0.0, 0.45, ag), 2.2));
    float rt = smoothstep(0.72, 1.0, ag), wr = frN(position*uFrG.z + aSeed*13.0);
    vec3 nn = normalize(objectNormal);
    vec3 p = position - uFrP;   /* (about the fruit's own top, where it hangs from its stalk) */
    /* (a hair or a spine draws back toward the skin as it dries) */
    p = mix(p, p*(1.0 - 0.35*aFr.y*rt), step(0.001, aFr.y));
    p -= nn*rt*uFrG.y*(0.45 + 0.9*wr)*length(position - uFrP)*sk;
    p.y -= uFrG.w*smoothstep(0.65, 0.9, ag)*sk*(1.0 - nn.y)*0.5;
    transformed = uFrP + mix(p, p*gr, sk);
    vAge = ag; vSeed = aSeed; vFr = aFr; vObj = position; }`;
  const FDECL = `
uniform vec3 uCU0, uCU1, uCR, uCB, uCS, uCRot, uCM, uCT0, uCT1; uniform vec4 uFrN, uFrK, uFrG; uniform vec3 uFrR;
varying float vAge; varying float vSeed; varying vec4 vFr; varying vec3 vObj;`;
  const FCOL = `
  { float ag = vAge, sk = vFr.w;
    float ripe = smoothstep(0.42, 0.62, ag), over = smoothstep(0.68, 0.84, ag), rot = smoothstep(0.8, 0.97, ag);
    vec3 q = vObj;
    float n1 = vnz(q*uFrN.x + vSeed*7.0), n2 = vnz(q*uFrN.y + vSeed*3.0 + 2.0), n3 = vnz(q*uFrN.z + vSeed*5.0 + 4.0);
    vec3 unr = mix(uCU0, uCU1, smoothstep(0.05, 0.45, ag))*(0.86 + 0.28*n1);
    float bl = clamp(vFr.x*uFrN.w*(0.55 + 0.9*n1), 0.0, 1.0);
    vec3 rip = mix(uCR*(0.88 + 0.24*n2), uCB*(0.85 + 0.3*n2), bl*smoothstep(0.3, 0.65, ag + 0.15*n1));
    /* (it ripens in patches, from the sun side) */
    float rp = smoothstep(0.0, 1.0, ripe*1.35 - 0.35 + 0.5*(n2 - 0.5) + 0.25*vFr.x);
    vec3 c = mix(unr, rip, rp);
    /* (a hair's or a spine's tip its own colour) */
    vec3 tipC = mix(uCT0, uCT1, rp);
    c = mix(c, tipC, smoothstep(0.35, 1.0, vFr.y)*uFrK.w*(1.0 - rot));
    float n4 = vnz(q*uFrN.z*1.8 + vSeed*9.0 + 1.0), spT = mix(0.95, 0.6, over), sp = max(smoothstep(spT, spT + 0.05, n4), 0.85*smoothstep(spT, spT + 0.12, n3))*over*uFrK.y;
    c = mix(c, mix(uCS, uCRot, 0.5)*(0.75 + 0.5*n2), clamp(sp, 0.0, 1.0)*0.9);
    c = mix(c, c*vec3(0.62, 0.5, 0.38), smoothstep(0.76, 0.9, ag)*0.6);   /* (the whole skin browning as it goes soft) */
    float rr = smoothstep(0.25, 0.75, rot + 0.45*(n2 - 0.5) + 0.25*sp);
    c = mix(c, uCRot*(0.65 + 0.7*n1), rr);
    float mz = vnz(q*uFrN.y*1.6 + 11.0 + vSeed), mf = vnz(q*uFrN.z*5.0 + vSeed*3.0);
    float mo = smoothstep(0.52, 0.78, mz)*smoothstep(0.86, 1.0, ag)*uFrK.z*(0.55 + 0.45*mf);
    c = mix(c, uCM*(0.7 + 0.5*mf), mo*0.85);
    float le = smoothstep(0.86, 0.9, vnz(q*uFrN.z*8.0 + vSeed*2.0))*uFrK.x*(1.0 - rr);
    c = mix(c, c*1.45 + 0.012, le*0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, c, sk); }`;
  const FROUGH = `
  roughnessFactor = mix(roughnessFactor, mix(mix(uFrR.x, uFrR.y, smoothstep(0.42, 0.62, vAge)), uFrR.z, smoothstep(0.78, 0.95, vAge)), vFr.w);`;
  const FBUMP = `
  { float hh = frNf(vObj*uFrG.z + vSeed*13.0)*smoothstep(0.74, 1.0, vAge)*uFrG.y*0.6*vFr.w;
    vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hh), dhy = dFdy(hh);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
    vec3 grd = sign(det)*(dhx*r1 + dhy*r2); normal = normalize(abs(det)*normal - grd); }`;
  const FNOISE = `
float frHf(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float frNf(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(frHf(i), frHf(i + vec3(1,0,0)), f.x), mix(frHf(i + vec3(0,1,0)), frHf(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(frHf(i + vec3(0,0,1)), frHf(i + vec3(1,0,1)), f.x), mix(frHf(i + vec3(0,1,1)), frHf(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

  const uni = (K, piv = [0, 0, 0]) => ({ uFrP: { value: V(...piv) }, uCU0: { value: V(...lin(K.u0)) }, uCU1: { value: V(...lin(K.u1)) }, uCR: { value: V(...lin(K.ripe)) }, uCB: { value: V(...lin(K.blush)) }, uCS: { value: V(...lin(K.spot)) },
    uCRot: { value: V(...lin(K.rot)) }, uCM: { value: V(...lin(K.mould)) }, uCT0: { value: V(...lin(K.tip0)) }, uCT1: { value: V(...lin(K.tip1)) },
    uFrN: { value: new T.Vector4(K.n[0], K.n[1], K.n[2], K.blush_) }, uFrK: { value: new T.Vector4(...K.k) }, uFrG: { value: new T.Vector4(...K.g) }, uFrR: { value: V(...K.r) } });
  const mats = new Map();
  /* a kind's fruit material: the engine's lit material with the fruit's life added */
  function material(kind, piv = [0, 0, 0]) {
    const mk = kind + ':' + piv.join(','); if (mats.has(mk)) return mats.get(mk);
    const K = KINDS[kind], m = Mats.lit({ color: 0xffffff, vertexColors: true, roughness: 0.6 }, 'fruit'), base = m.onBeforeCompile, U = uni(K, piv);
    m.onBeforeCompile = sh => {
      base(sh); Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VDECL).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VBODY);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FDECL + FNOISE).replace('#include <color_fragment>', '#include <color_fragment>\n' + FCOL)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FROUGH).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FBUMP);
    };
    m.customProgramCacheKey = () => 'fruit-' + kind; mats.set(mk, m); return m;
  }
  /* its shadow, from the fruit as big as it is now */
  function depth(kind, piv = [0, 0, 0]) {
    const key = 'd-' + kind + ':' + piv.join(','); if (mats.has(key)) return mats.get(key);
    const K = KINDS[kind], m = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), U = { uFrG: { value: new T.Vector4(...K.g) }, uFrP: { value: V(...piv) } };
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VDECL).replace('#include <begin_vertex>', '#include <begin_vertex>\n  vec3 objectNormal = normal;\n' + VBODY); };
    m.customProgramCacheKey = () => 'fruitd-' + kind; mats.set(key, m); return m;
  }

  /* ── geometry. A surface of revolution about y with its two poles: f(t, a) → [x, y, z] for t 0 (top) … 1 (bottom)
     and a round it; extra(t, a, p) → [blush, hair, _, skin]; col(t, a) → [r, g, b] ── */
  function lathe(nU, nV, f, extra, col) {
    const P = [], F = [], C = [], I = [], push = (t, a) => { const p = f(t, a); P.push(...p); F.push(...extra(t, a, p)); C.push(...(col ? col(t, a) : [1, 1, 1])); };
    push(0, 0); for (let i = 1; i < nV; i++) for (let j = 0; j < nU; j++) push(i / nV, j / nU * TAU); push(1, 0);
    const ring = i => 1 + (i - 1) * nU, last = 1 + (nV - 1) * nU;
    for (let j = 0; j < nU; j++) I.push(0, ring(1) + (j + 1) % nU, ring(1) + j);
    for (let i = 1; i < nV - 1; i++) for (let j = 0; j < nU; j++) { const a = ring(i) + j, b = ring(i) + (j + 1) % nU, c = ring(i + 1) + j, d = ring(i + 1) + (j + 1) % nU; I.push(a, b, c, b, d, c); }
    for (let j = 0; j < nU; j++) I.push(last, ring(nV - 1) + j, ring(nV - 1) + (j + 1) % nU);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aFr', new T.Float32BufferAttribute(F, 4)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setIndex(I); g.computeVertexNormals(); return g;
  }
  /* a stalk: a tapering tube along pts, its own colour, not skin */
  function stalk(pts, r0, r1, col, radial = 6) {
    const c = new T.CatmullRomCurve3(pts), n = Math.max(3, pts.length * 2), P = [], F = [], C = [], I = [], fr = c.computeFrenetFrames(n, false);
    for (let i = 0; i <= n; i++) { const t = i / n, p = c.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = mix(r0, r1, t); for (let j = 0; j < radial; j++) { const a = j / radial * TAU; P.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * r, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * r, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * r); F.push(0, 0, 0, 0); C.push(...col(t)); } }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, cc = a + radial, d = b + radial; I.push(a, b, cc, b, d, cc); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aFr', new T.Float32BufferAttribute(F, 4)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.setIndex(I); g.computeVertexNormals(); return g;
  }
  /* geometries merged (position, normal, color, aFr) */
  function join(gs) {
    let nv = 0, ni = 0; for (const g of gs) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), F = new Float32Array(nv * 4), I = new Uint32Array(ni); let o = 0, oi = 0;
    for (const g of gs) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); F.set(g.attributes.aFr.array, o * 4); const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + o; o += g.attributes.position.count; oi += ix.length; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('aFr', new T.BufferAttribute(F, 4)); g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
  }

  /* ── a mango (Mangifera indica): 9-14 cm, ovoid and a little flattened side to side, broadest above its middle; its
     back nearly straight, its belly fuller, with the small knob of the beak a little above the tip; the shoulder rising
     round the stalk, which joins off-centre toward the back; a short pedicel thickening into it ── */
  function mango(o = {}) {
    const L = o.L ?? 0.115, Rm = L * 0.36, lod = o.lod || 0;
    const body = lathe(lod ? 18 : 48, lod ? 14 : 40, (t, a) => {
      const ca = Math.cos(a), sa = Math.sin(a), u = Math.pow(t, 0.9);
      /* (an ellipse in profile, broadest above its middle, its lower end a little narrower) */
      let r = Rm * Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))) * (1 - 0.14 * t);
      const bel = 0.5 + 0.5 * ca, belly = 1 + 0.1 * bel * bel * Math.sin(Math.PI * t);   /* (+x the belly, -x the back) */
      let x = ca * r * belly + Rm * 0.08 * Math.sin(Math.PI * t), z = sa * r * 0.82, y = -L * t;
      x += L * 0.022 * Math.exp(-(((t - 0.8) / 0.07) ** 2)) * Math.pow(bel, 4);                  /* (the beak) */
      y += L * 0.022 * sm(0.0, 0.05, t) * (1 - sm(0.05, 0.16, t));                                /* (the shoulder round the stalk) */
      return [x, y, z];
    }, (t, a) => [clamp(0.5 + 0.5 * Math.cos(a - 0.4)) * (0.55 + 0.45 * (1 - t)), 0, 0, 1]);
    const H = o.hang || 0, ped = H ? stalk([V(-0.003, L * 0.01, 0), V(-0.004, L * 0.12, 0.002), V(0.004, H * 0.5, 0.01), V(0.012, H * 0.85, 0.004), V(0.01, H, 0)], 0.0042, 0.0018, t => [mix(0.2, 0.24, t), mix(0.26, 0.22, t), mix(0.1, 0.13, t)], 6)
      : stalk([V(-0.003, L * 0.01, 0), V(-0.004, L * 0.12, 0.001), V(-0.004, L * 0.24, 0.002)], 0.0042, 0.0026, t => [0.2, 0.26, 0.1]);
    const g = join([body, ped]); if (H) g.translate(-0.01, -H, 0); g.userData.pivot = [-0.01, -H, 0]; return g;
  }

  /* ── fruit geometry by kind, cached ── */
  const geos = new Map(), BUILD = { mango };
  function geo(kind, o = {}) { const key = kind + JSON.stringify(o); if (!geos.has(key)) geos.set(key, BUILD[kind](o)); return geos.get(key); }

  /* ── fruit placed: an InstancedMesh of a kind's fruit, one per item { p: [x,y,z], ry, tilt, age, seed, s } ── */
  function instances(kind, items, o = {}) {
    const base = geo(kind, o.geo || {}), g = new T.BufferGeometry(), piv = base.userData.pivot || [0, 0, 0];
    for (const k of ['position', 'normal', 'color', 'aFr']) g.setAttribute(k, base.attributes[k]); g.setIndex(base.index);
    const n = items.length, A = new Float32Array(n), S = new Float32Array(n);
    items.forEach((it, i) => { A[i] = it.age; S[i] = it.seed ?? i * 0.37; });
    g.setAttribute('aAge', new T.InstancedBufferAttribute(A, 1)); g.setAttribute('aSeed', new T.InstancedBufferAttribute(S, 1));
    const m = new T.InstancedMesh(g, material(kind, piv), n), M = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    items.forEach((it, i) => { e.set(it.tilt || 0, it.ry || 0, it.roll || 0, 'YXZ'); q.setFromEuler(e); M.compose(V(...it.p), q, V(it.s || 1, it.s || 1, it.s || 1)); m.setMatrixAt(i, M); });
    m.instanceMatrix.needsUpdate = true; m.customDepthMaterial = depth(kind, piv); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.userData.ages = A; return m;
  }

  /* ── a row of fruit through their lives, for the studio: n of them from just set to rotten, spaced along x ── */
  Models.add('fruit/stages', (o = {}) => {
    const kind = o.kind || 'mango', n = o.n || 9, gap = o.gap ?? 0.16, g = new T.Group(), ages = o.ages || Array.from({ length: n }, (_, i) => 0.02 + 0.96 * i / (n - 1));
    const items = ages.map((a, i) => ({ p: [(i - (ages.length - 1) / 2) * gap, o.y ?? 0.3, 0], ry: o.ry ?? -0.6, age: a, seed: 1.3 + i * 0.71 }));
    g.add(instances(kind, items));
    /* (a rail they hang from, so they hang as they do on the tree) */
    const rail = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, gap * ages.length, 6), Models.lit('#4a3a28')); rail.rotation.z = Math.PI / 2; rail.position.y = (o.y ?? 0.3) + 0.03; g.add(rail);
    g.userData.info = { kind, ages }; return g;
  });

  /* ══ flowers ══════════════════════════════════════════════════
     A flower's part knows the middle of its flower (aFl), the way the flower faces (aFa), and aFk: what it is (0 the
     stalks, 1 a petal, 2 the flower's middle), a die for the flower, how far along its panicle it is (0 the foot, 1
     the tip — the lower flowers open first), and how far out along its petal it is. A panicle's (or a flower's) age:
     it grows out (0 → T.x); its flowers open one after another (from T.y, spread over T.z), each open for T.w of its
     life, then withering, browning, falling; the stalks dry; at 1 it is gone. */
  const FLK = {
    /* a mango's: a panicle of hundreds of small flowers, cream with pink-striped bases round an orange disc, on pink
       or yellow-green stalks; brown and bare after */
    mango: { bud: '#9a8a48', open: '#f2e6bc', base: '#d98c70', wilt: '#7a5a38', disc: '#e9a226', stalk: '#a8704e', dry: '#6a4a30', T: [0.12, 0.12, 0.2, 0.24] } };
  const FL_V = `
attribute float aAge; attribute float aSeed; attribute vec3 aFl; attribute vec3 aFa; attribute vec4 aFk;
uniform vec4 uFlT;
varying float vAge; varying vec4 vFk; varying float vFa;`;
  const FL_VB = `
  { float ag = aAge, em = smoothstep(0.0, uFlT.x, ag), end = 1.0 - smoothstep(0.96, 1.0, ag);
    float st = uFlT.y + aFk.z*uFlT.z + aFk.y*0.04, fa = clamp((ag - st)/uFlT.w, 0.0, 1.0);
    vec3 p = position;
    if (aFk.x > 0.5){
      float op = smoothstep(0.0, 0.3, fa), wl = smoothstep(0.55, 0.85, fa), gone = smoothstep(0.82, 1.0, fa);
      vec3 rel = p - aFl, ax = normalize(aFa), inPl = rel - ax*dot(rel, ax);
      /* (a bud: its petals folded up over the middle, a small knot; open, spread; withering, curling, then falling) */
      vec3 shut = ax*length(rel)*0.5 + inPl*0.42;
      rel = mix(shut, rel, op)*(1.0 - 0.3*wl);
      rel -= ax*wl*0.25*length(rel)*aFk.w;
      p = aFl + rel*(1.0 - gone)*mix(0.75, 1.0, op);
    }
    transformed = p*mix(0.35, 1.0, em)*end;
    vAge = ag; vFk = aFk; vFa = fa; }`;
  const FL_F = `
uniform vec3 uFlB, uFlO, uFlS, uFlW, uFlC, uFlD;
varying float vAge; varying vec4 vFk; varying float vFa;`;
  const FL_FC = `
  { vec3 c = diffuseColor.rgb;
    if (vFk.x > 0.5){
      float op = smoothstep(0.0, 0.3, vFa), wl = smoothstep(0.5, 0.85, vFa);
      vec3 pet = mix(uFlB, mix(uFlS, uFlO, smoothstep(0.15, 0.65, vFk.w)), op);
      if (vFk.x > 1.5) pet = mix(uFlB, uFlC, op);
      c = mix(pet, uFlW, wl)*(0.85 + 0.3*vFk.y);
    } else c = mix(c, uFlD, smoothstep(0.5, 0.85, vAge));
    diffuseColor.rgb = c; }`;
  function flowers(kind) {
    const key = 'fl-' + kind; if (mats.has(key)) return mats.get(key);
    const K = FLK[kind], U = { uFlT: { value: new T.Vector4(...K.T) }, uFlB: { value: V(...lin(K.bud)) }, uFlO: { value: V(...lin(K.open)) }, uFlS: { value: V(...lin(K.base)) }, uFlW: { value: V(...lin(K.wilt)) }, uFlC: { value: V(...lin(K.disc)) }, uFlD: { value: V(...lin(K.dry)) } };
    const m = Mats.lit({ color: 0xffffff, vertexColors: true, roughness: 0.7, side: T.DoubleSide }, 'flower'), base = m.onBeforeCompile;
    m.onBeforeCompile = sh => { base(sh); Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + FL_V).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + FL_VB);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FL_F).replace('#include <color_fragment>', '#include <color_fragment>\n' + FL_FC); };
    m.customProgramCacheKey = () => 'flower-' + kind;
    const d = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, side: T.DoubleSide });
    d.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + FL_V).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + FL_VB); };
    d.customProgramCacheKey = () => 'flowerd-' + kind;
    const out = { mat: m, depth: d }; mats.set(key, out); return out;
  }
  /* a flower bud-to-fall geometry builder: parts pushed as triangles with their own attributes */
  function fbuf() {
    const P = [], C = [], FL = [], FA = [], FK = [], I = [];
    const v = (p, c, fl, fa, fk) => { P.push(p.x, p.y, p.z); C.push(...c); FL.push(fl.x, fl.y, fl.z); FA.push(fa.x, fa.y, fa.z); FK.push(...fk); return P.length / 3 - 1; };
    return { v, tri: (a, b, c) => I.push(a, b, c), done() {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
      g.setAttribute('aFl', new T.Float32BufferAttribute(FL, 3)); g.setAttribute('aFa', new T.Float32BufferAttribute(FA, 3)); g.setAttribute('aFk', new T.Float32BufferAttribute(FK, 4)); g.setIndex(I); g.computeVertexNormals(); return g; } };
  }
  /* a stalk into the flower buffer: a tube along a curve, its own colour, 'stalk' */
  function fstalk(B, curve, r0, r1, col, radial = 4, n = 6) {
    const fr = curve.computeFrenetFrames(n, false), base = []; const z = V();
    for (let i = 0; i <= n; i++) { const t = i / n, p = curve.getPointAt(t), N = fr.normals[i], Bn = fr.binormals[i], r = mix(r0, r1, t), row = [];
      for (let j = 0; j < radial; j++) { const a = j / radial * TAU, q = p.clone().addScaledVector(N, Math.cos(a) * r).addScaledVector(Bn, Math.sin(a) * r); row.push(B.v(q, col, q, V(0, 1, 0), [0, 0, t, 0])); } base.push(row); }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) { const a = base[i][j], b = base[i][(j + 1) % radial], c = base[i + 1][j], d = base[i + 1][(j + 1) % radial]; B.tri(a, b, c); B.tri(b, d, c); }
  }
  /* one small flower into the buffer: k petals round the middle c, facing ax, each Lp long and Wp wide, cupped up by cup;
     its disc; where it sits on its panicle (along) */
  function fflower(B, c, ax, k, Lp, Wp, cup, along, rnd, R) {
    ax = ax.clone().normalize(); let e1 = V().crossVectors(ax, Math.abs(ax.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).normalize(); const e2 = V().crossVectors(ax, e1);
    const tw = R() * TAU, ctr = B.v(c.clone().addScaledVector(ax, Lp * 0.12), [1, 1, 1], c, ax, [2, rnd, along, 0]), ring = [];
    for (let i = 0; i < k; i++) { const a = tw + i / k * TAU; ring.push(B.v(c.clone().addScaledVector(e1, Math.cos(a) * Lp * 0.22).addScaledVector(e2, Math.sin(a) * Lp * 0.22).addScaledVector(ax, Lp * 0.06), [1, 1, 1], c, ax, [2, rnd, along, 0])); }
    for (let i = 0; i < k; i++) B.tri(ctr, ring[i], ring[(i + 1) % k]);
    for (let i = 0; i < k; i++) {
      const a = tw + (i + 0.5) / k * TAU, d = V().addScaledVector(e1, Math.cos(a)).addScaledVector(e2, Math.sin(a)), sd = V().crossVectors(ax, d);
      const out = (u, w) => c.clone().addScaledVector(d, Lp * u).addScaledVector(ax, Lp * cup * u * u).addScaledVector(sd, w);
      const b0 = B.v(out(0.15, -Wp * 0.3), [1, 1, 1], c, ax, [1, rnd, along, 0.1]), b1 = B.v(out(0.15, Wp * 0.3), [1, 1, 1], c, ax, [1, rnd, along, 0.1]);
      const m0 = B.v(out(0.6, -Wp * 0.5), [1, 1, 1], c, ax, [1, rnd, along, 0.6]), m1 = B.v(out(0.6, Wp * 0.5), [1, 1, 1], c, ax, [1, rnd, along, 0.6]), tp = B.v(out(1, 0), [1, 1, 1], c, ax, [1, rnd, along, 1]);
      B.tri(b0, m0, b1); B.tri(b1, m0, m1); B.tri(m0, tp, m1);
    }
  }
  /* ── a mango's panicle: an upright pyramid, 15-30 cm, of branching stalks bearing a few hundred small flowers ── */
  function mangoPanicle(o = {}) {
    const R = Models.rng(o.seed || 5), L = o.L ?? 0.24, B = fbuf(), lod = o.lod || 0, col = lin(FLK.mango.stalk);
    const ax = new T.CatmullRomCurve3([V(0, 0, 0), V(0.006, L * 0.35, 0.004), V(0.012, L * 0.7, -0.004), V(0.008, L, 0.002)]);
    fstalk(B, ax, 0.0032, 0.0011, col, lod ? 4 : 5, 8);
    const nl = lod ? 12 : 22, cym = lod ? 3 : 6, per = lod ? 3 : 5;
    for (let k = 0; k < nl; k++) {
      const t = 0.06 + 0.9 * k / nl, b0 = ax.getPointAt(t), az = k * 2.39996 + R() * 0.3, el = 1.05 - 0.4 * t, len = L * (0.42 * Math.pow(1 - t, 0.85) + 0.05);
      const dir = V(Math.cos(az) * Math.sin(el), Math.cos(el), Math.sin(az) * Math.sin(el));
      const lat = new T.CatmullRomCurve3([b0, b0.clone().addScaledVector(dir, len * 0.5).add(V(0, len * 0.08, 0)), b0.clone().addScaledVector(dir, len).add(V(0, len * 0.14, 0))]);
      fstalk(B, lat, 0.0012, 0.0006, col, lod ? 3 : 4, 3);
      /* (along each, short branchlets, each ending in a little cyme of flowers; and a cyme at its own end) */
      for (let j = 0; j <= cym; j++) {
        const u = j === cym ? 1 : 0.25 + 0.7 * (j + R() * 0.5) / cym, q0 = lat.getPointAt(Math.min(1, u)), bd = dir.clone().add(V((R() - 0.5) * 1.2, 0.8 + 0.4 * R(), (R() - 0.5) * 1.2)).normalize(), bl = j === cym ? 0.004 : 0.008 + 0.012 * R();
        const q1 = q0.clone().addScaledVector(bd, bl); if (j < cym && !lod) fstalk(B, new T.CatmullRomCurve3([q0, q0.clone().lerp(q1, 0.5).add(V(0, 0.002, 0)), q1]), 0.0006, 0.0004, col, 3, 2);
        for (let f = 0; f < per; f++) {
          const c = q1.clone().add(V((R() - 0.5) * 0.009, (R() - 0.2) * 0.006, (R() - 0.5) * 0.009));
          fflower(B, c, bd.clone().add(V((R() - 0.5) * 0.9, 0.3, (R() - 0.5) * 0.9)), 5, 0.0045 + 0.001 * R(), 0.0018, 0.3, t, R(), R);
        }
      }
    }
    for (let f = 0; f < 6; f++) fflower(B, ax.getPointAt(0.93 + 0.07 * f / 6).add(V((R() - 0.5) * 0.01, 0, (R() - 0.5) * 0.01)), V(R() - 0.5, 1, R() - 0.5), 5, 0.004, 0.0016, 0.35, 1, R(), R);
    return B.done();
  }
  const blooms = new Map(), BLOOM = { mango: mangoPanicle };
  function bloom(kind, o = {}) { const key = kind + JSON.stringify(o); if (!blooms.has(key)) blooms.set(key, BLOOM[kind](o)); return blooms.get(key); }
  /* flowers placed: an InstancedMesh, one per item { p, ry, tilt, roll, age, seed, s } */
  function bloomInstances(kind, items, o = {}) {
    const base = bloom(kind, o.geo || {}), g = new T.BufferGeometry();
    for (const k of ['position', 'normal', 'color', 'aFl', 'aFa', 'aFk']) g.setAttribute(k, base.attributes[k]); g.setIndex(base.index);
    const n = items.length, A = new Float32Array(n), S = new Float32Array(n); items.forEach((it, i) => { A[i] = it.age; S[i] = it.seed ?? i * 0.37; });
    g.setAttribute('aAge', new T.InstancedBufferAttribute(A, 1)); g.setAttribute('aSeed', new T.InstancedBufferAttribute(S, 1));
    const F = flowers(kind), m = new T.InstancedMesh(g, F.mat, n), M = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    items.forEach((it, i) => { e.set(it.tilt || 0, it.ry || 0, it.roll || 0, 'YXZ'); q.setFromEuler(e); M.compose(V(...it.p), q, V(it.s || 1, it.s || 1, it.s || 1)); m.setMatrixAt(i, M); });
    m.instanceMatrix.needsUpdate = true; m.customDepthMaterial = F.depth; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.userData.ages = A; return m;
  }
  Models.add('fruit/bloom-stages', (o = {}) => {
    const kind = o.kind || 'mango', ages = o.ages || [0.04, 0.14, 0.22, 0.32, 0.45, 0.6, 0.8], gap = o.gap ?? 0.3, g = new T.Group();
    g.add(bloomInstances(kind, ages.map((a, i) => ({ p: [(i - (ages.length - 1) / 2) * gap, 0, 0], ry: i * 0.7, age: a, seed: i * 0.61 })), { geo: o.geo || {} }));
    g.userData.info = { kind, ages }; return g;
  });

  /* ══ a fruit tree: the tree grown (FloraGrow) and on it its flowers and fruit, each place on it (a site) at its own
     point in the round of flowering and fruiting, so the tree carries every stage at once. A site's round (u, 0..1):
     its flowers from 0 to 0.4 (their age u/0.4); its fruit set at 0.2 and grows, ripens and rots to 1 (age (u-0.2)/0.8);
     fruit past 0.82 has fallen, and lies rotting under the tree. o.phase(i) gives a site's u (a snapshot) ══ */
  const SITE = { mango: { bloomL: 0.24, hang: [0.2, 0.32], perSite: [1, 2], n: 120, dy: [-0.75, 0.55], out: 1.08 } };
  function onTree(kind, grown, o = {}) {
    const S = SITE[kind], R = Models.rng((o.seed || 1) * 19 + 7), g = new T.Group(), UPv = V(0, 1, 0);
    const cl = grown.clumps.filter(c => c.d.y > S.dy[0] && c.d.y < S.dy[1]).sort(() => R() - 0.5).slice(0, o.n ?? S.n);
    const blooms = [], fruit = [], fallen = [], sites = [];
    const H = grown.info.H, cc = grown.info.crown.c, Rc = grown.info.crown.R;
    cl.forEach((c, i) => {
      const tip = c.c.clone().addScaledVector(c.d, c.r * S.out), u = o.phase ? o.phase(i) : R(), ry = R() * TAU;
      const site = { tip, d: c.d.clone(), u, bloom: -1, fruit: [] }; sites.push(site);
      if (u < 0.4) { site.bloom = blooms.length; const ax = c.d.clone().multiplyScalar(0.5).add(UPv).normalize(); blooms.push({ p: tip.toArray(), ry, tilt: Math.acos(clamp(ax.y, -1, 1)) * 0.6, age: u / 0.4, seed: R() * 9 }); }
      if (u >= 0.2) {
        const age = (u - 0.2) / 0.8, nf = S.perSite[0] + Math.floor(R() * (S.perSite[1] - S.perSite[0] + 1));
        for (let k = 0; k < nf; k++) {
          const a2 = age * (0.94 + 0.12 * R());
          if (a2 > 0.82) { const rr = Math.sqrt(R()) * Rc * 0.9, aa = R() * TAU; fallen.push({ p: [cc.x + Math.cos(aa) * rr, 0.035, cc.z + Math.sin(aa) * rr], ry: R() * TAU, tilt: Math.PI / 2 * (0.8 + 0.2 * R()), age: Math.min(1, a2), seed: R() * 9 }); }
          else { site.fruit.push(fruit.length); fruit.push({ p: tip.clone().add(V((R() - 0.5) * 0.06, -0.02, (R() - 0.5) * 0.06)).toArray(), ry: ry + k * 2.1, tilt: (R() - 0.5) * 0.12, age: a2, seed: R() * 9 }); }
        }
      }
    });
    const parts = {};
    if (blooms.length) { parts.blooms = bloomInstances(kind, blooms, { geo: { L: S.bloomL, lod: o.bloomLod ?? 1 } }); g.add(parts.blooms); }
    if (fruit.length) { parts.fruit = instances(kind, fruit, { geo: { hang: (S.hang[0] + S.hang[1]) / 2, lod: o.fruitLod ?? 1 } }); g.add(parts.fruit); }
    if (fallen.length) { parts.fallen = instances(kind, fallen, { geo: { lod: o.fruitLod ?? 1 } }); g.add(parts.fallen); }
    g.userData.fruit = { kind, sites, parts }; return g;
  }
  Models.add('fruit/mango-tree', (o = {}) => {
    const t = FloraGrow.model('mango', o.seed || 2, o), f = onTree('mango', t.userData.grown, o);
    t.add(f); t.userData.fruit = f.userData.fruit; return t;
  });
  return { KINDS, FLK, material, depth, flowers, geo, bloom, instances, bloomInstances, onTree, lathe, stalk, join };
})();
