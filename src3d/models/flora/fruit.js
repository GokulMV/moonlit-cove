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
      n: [40, 60, 120], blush_: 0.3, k: [0, 0.6, 0.4, 0.9], r: [0.55, 0.5, 0.9], g: [0.1, 0.06, 140, 0.0], base: 0.25 },
    /* a durian: olive green spines, browning yellow as it ripens; splitting on the ground */
    durian: { u0: '#3d5a1c', u1: '#6a7a2a', ripe: '#8a7a2e', blush: '#97803a', spot: '#2c2410', rot: '#3a2c16', mould: '#9a9a88', tip0: '#2e3a14', tip1: '#4a3a1a',
      n: [8, 16, 40], blush_: 0.2, k: [0, 0.5, 0.6, 0.7], r: [0.62, 0.6, 0.9], g: [0.12, 0.04, 50, 0.0], base: 0.45 },
    /* a cempedak: warty, green to orange-brown */
    cempedak: { u0: '#4c6a22', u1: '#7d8a32', ripe: '#b07a2a', blush: '#a0602a', spot: '#2a1a0c', rot: '#3a2410', mould: '#a4a494', tip0: '#7d8a32', tip1: '#b07a2a',
      n: [6, 14, 40], blush_: 0.3, k: [0, 1, 0.7, 0], r: [0.6, 0.55, 0.9], g: [0.08, 0.05, 60, 0.01], w: [140, 0.002] },
    /* a papaya: smooth, faintly ribbed, green to yellow-orange from the tip up; sunk, dark-ringed rot */
    papaya: { u0: '#2f5c20', u1: '#5a8a2e', ripe: '#e8962a', blush: '#f0a030', spot: '#3a2410', rot: '#4a2c14', mould: '#a9aea0', tip0: '#5a8a2e', tip1: '#e8962a',
      n: [5, 12, 30], blush_: 0.4, k: [0, 1, 0.55, 0], r: [0.4, 0.33, 0.85], g: [0.06, 0.08, 60, 0.008] },
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
    if (uFrW.y > 0.0) frWv = frW(q*uFrW.x);
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
    if (uFrW.y > 0.0) c *= mix(0.62, 1.0, smoothstep(0.0, 0.22, frWv.y - frWv.x))*(0.92 + 0.16*frHf(floor(q*uFrW.x*1.0) + 3.0));
    c *= 1.0 - uFrW.z*(1.0 - smoothstep(0.0, 0.35, vFr.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, c, sk); }`;
  const FROUGH = `
  roughnessFactor = mix(roughnessFactor, mix(mix(uFrR.x, uFrR.y, smoothstep(0.42, 0.62, vAge)), uFrR.z, smoothstep(0.78, 0.95, vAge)), vFr.w);`;
  const FBUMP = `
  { float hh = frNf(vObj*uFrG.z + vSeed*13.0)*smoothstep(0.74, 1.0, vAge)*uFrG.y*0.6*vFr.w;
    if (uFrW.y > 0.0) hh += uFrW.y*smoothstep(0.0, 0.3, frWv.y - frWv.x)*(1.0 - 0.5*frWv.x)*vFr.w;
    vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hh), dhy = dFdy(hh);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
    vec3 grd = sign(det)*(dhx*r1 + dhy*r2); normal = normalize(abs(det)*normal - grd); }`;
  const FNOISE = `
uniform vec4 uFrW; vec2 frWv = vec2(1.0);
float frHf(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
vec2 frW(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec3 g = vec3(float(x), float(y), float(z)), o = vec3(frHf(i + g), frHf(i + g + 17.3), frHf(i + g + 31.7));
    float d = length(g + o - f); if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(d1, d2); }
float frNf(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(frHf(i), frHf(i + vec3(1,0,0)), f.x), mix(frHf(i + vec3(0,1,0)), frHf(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(frHf(i + vec3(0,0,1)), frHf(i + vec3(1,0,1)), f.x), mix(frHf(i + vec3(0,1,1)), frHf(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

  const uni = (K, piv = [0, 0, 0]) => ({ uFrP: { value: V(...piv) }, uCU0: { value: V(...lin(K.u0)) }, uCU1: { value: V(...lin(K.u1)) }, uCR: { value: V(...lin(K.ripe)) }, uCB: { value: V(...lin(K.blush)) }, uCS: { value: V(...lin(K.spot)) },
    uCRot: { value: V(...lin(K.rot)) }, uCM: { value: V(...lin(K.mould)) }, uCT0: { value: V(...lin(K.tip0)) }, uCT1: { value: V(...lin(K.tip1)) },
    uFrW: { value: new T.Vector4(...(K.w || [0, 0]), K.base ?? 0, 0) }, uFrN: { value: new T.Vector4(K.n[0], K.n[1], K.n[2], K.blush_) }, uFrK: { value: new T.Vector4(...K.k) }, uFrG: { value: new T.Vector4(...K.g) }, uFrR: { value: V(...K.r) } });
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
    const H = o.hang || 0, ped = H ? stalk([V(-0.003, L * 0.01, 0), V(-0.004, L * 0.12, 0.002), V(0.004, H * 0.5, 0.01), V(0.012, H * 0.85, 0.004), V(0.01, H, 0)], 0.0042, 0.0018, t => [mix(0.1, 0.12, t), mix(0.13, 0.1, t), mix(0.05, 0.06, t)], 6)
      : stalk([V(-0.003, L * 0.01, 0), V(-0.004, L * 0.12, 0.001), V(-0.004, L * 0.24, 0.002)], 0.0042, 0.0026, t => [0.1, 0.13, 0.05]);
    const g = join([body, ped]); if (H) g.translate(-0.01, -H, 0); g.userData.pivot = [-0.01, -H, 0]; return g;
  }

  /* ── a rambutan (Nephelium lappaceum): an oval 4-6 cm, its skin set all over with soft fleshy hairs a centimetre long,
     each rising from a small swelling and curving over at its tip; on a short stalk, in a cluster ── */
  function rambutan(o = {}) {
    const L = o.L ?? 0.05, Rb = L * 0.4, lod = o.lod || 0, R = Models.rng(31);
    const rad = t => Rb * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))) * (1 + 0.06 * (t - 0.5));
    const body = lathe(lod ? 14 : 28, lod ? 10 : 20, (t, a) => { const r = rad(t); return [Math.cos(a) * r, -L * t, Math.sin(a) * r * 0.94]; }, (t, a) => [clamp(0.5 + 0.5 * Math.cos(a)), 0, 0, 1]);
    const parts = [body], nH = lod ? 70 : 170, P = [], F = [], C = [], I = [];
    for (let k = 0; k < nH; k++) {
      const yy = 1 - 2 * (k + 0.5) / nH, t = clamp(0.5 - 0.5 * yy * 0.96), a = k * 2.39996, r = rad(t), base = V(Math.cos(a) * r, -L * t, Math.sin(a) * r * 0.94);
      const n = V(Math.cos(a) * Math.sqrt(1 - yy * yy), yy, Math.sin(a) * Math.sqrt(1 - yy * yy)).normalize(), tg = V().crossVectors(n, V(0.3, 1, 0.2)).normalize(), hl = (0.0065 + 0.004 * R()) * (L / 0.05);
      const pts = [0, 0.4, 0.75, 1].map(u => base.clone().addScaledVector(n, hl * (u - 0.3 * u * u * u)).addScaledVector(tg, hl * 0.8 * u * u * u));
      const w0 = 0.0021 * (L / 0.05), segs = lod ? 2 : 3, rad2 = lod ? 2 : 3;
      if (lod) { /* (a flat ribbon, turned to the light's side) */
        const sd = V().crossVectors(n, tg).normalize(), o0 = P.length / 3;
        for (let i = 0; i <= segs; i++) { const u = i / segs, p = pts[Math.min(3, Math.round(u * 3))], w = w0 * (1 - 0.8 * u); for (const sg of [-1, 1]) { const q = p.clone().addScaledVector(sd, sg * w); P.push(q.x, q.y, q.z); F.push(0, 0.05 + 0.95 * u, 0, 1); C.push(1, 1, 1); } }
        for (let i = 0; i < segs; i++) { const a0 = o0 + i * 2; I.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
      } else {
        const c = new T.CatmullRomCurve3(pts), fr = c.computeFrenetFrames(segs, false), o0 = P.length / 3;
        for (let i = 0; i <= segs; i++) { const u = i / segs, p = c.getPointAt(u), w = w0 * (1 - 0.85 * u); for (let j = 0; j < rad2; j++) { const an = j / rad2 * TAU, q = p.clone().addScaledVector(fr.normals[i], Math.cos(an) * w).addScaledVector(fr.binormals[i], Math.sin(an) * w); P.push(q.x, q.y, q.z); F.push(0, 0.05 + 0.95 * u, 0, 1); C.push(1, 1, 1); } }
        for (let i = 0; i < segs; i++) for (let j = 0; j < rad2; j++) { const a0 = o0 + i * rad2 + j, b0 = o0 + i * rad2 + (j + 1) % rad2; I.push(a0, b0, a0 + rad2, b0, b0 + rad2, a0 + rad2); }
      }
    }
    const hg = new T.BufferGeometry(); hg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); hg.setAttribute('aFr', new T.Float32BufferAttribute(F, 4)); hg.setAttribute('color', new T.Float32BufferAttribute(C, 3)); hg.setIndex(I); hg.computeVertexNormals(); parts.push(hg);
    const H = o.hang || 0;
    parts.push(stalk(H ? [V(0, 0, 0), V(0.002, H * 0.5, 0.001), V(0, H, 0)] : [V(0, 0, 0), V(0.001, 0.008, 0), V(0, 0.016, 0)], 0.0018, 0.0012, () => [0.1, 0.11, 0.05], 5));
    const g = join(parts); if (H) g.translate(0, -H, 0); g.userData.pivot = [0, -H, 0]; return g;
  }
  /* ── a durian (Durio zibethinus): 18-30 cm, ovoid, faintly five-lobed along its seams, armed all over with hard
     pyramidal thorns a centimetre high, smaller toward its ends; on a stout woody stalk from a big branch ── */
  function durian(o = {}) {
    const L = o.L ?? 0.24, Rb = L * 0.36, lod = o.lod || 0, R = Models.rng(57);
    const rad = (t, a) => Rb * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))) * (1 + 0.05 * Math.cos(5 * a)) * (1 + 0.05 * (0.5 - t));
    const body = lathe(lod ? 20 : 40, lod ? 16 : 30, (t, a) => { const r = rad(t, a); return [Math.cos(a) * r, -L * t, Math.sin(a) * r]; }, (t, a) => [clamp(0.5 + 0.5 * Math.cos(a)), 0, 0, 1]);
    /* (the thorns: four-sided pyramids, flat-faced, crowded) */
    const nS = lod ? 150 : 320, P = [], F = [], C = [], I = [];
    for (let k = 0; k < nS; k++) {
      const yy = 1 - 2 * (k + 0.5) / nS, t = clamp(0.5 - 0.5 * yy * 0.97), a = k * 2.39996, r = rad(t, a), base = V(Math.cos(a) * r, -L * t, Math.sin(a) * r);
      const n = V(Math.cos(a) * Math.sqrt(1 - yy * yy) * 1.0, yy * 0.8, Math.sin(a) * Math.sqrt(1 - yy * yy)).normalize(), end = Math.sin(Math.PI * t);
      const h = (0.014 + 0.006 * R()) * (0.45 + 0.55 * end) * (L / 0.24), w = Math.sqrt(4 * Math.PI * Rb * Rb / nS) * 0.6 * (0.7 + 0.3 * end);
      let e1 = V().crossVectors(n, V(0, 1, 0)); if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0); e1.normalize().applyAxisAngle(n, R() * 1.5); const e2 = V().crossVectors(n, e1);
      const tip = base.clone().addScaledVector(n, h), cs = [0, 1, 2, 3, 4].map(q => base.clone().addScaledVector(e1, Math.cos(q * TAU / 5) * w * 1.25).addScaledVector(e2, Math.sin(q * TAU / 5) * w * 1.25).addScaledVector(n, -0.002));
      for (let q = 0; q < 5; q++) { const o0 = P.length / 3; for (const [pp, u] of [[cs[q], 0], [cs[(q + 1) % 5], 0], [tip, 1]]) { P.push(pp.x, pp.y, pp.z); F.push(0, 0.05 + 0.95 * u, 0, 1); C.push(1, 1, 1); } I.push(o0, o0 + 2, o0 + 1); }
    }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); sg.setAttribute('aFr', new T.Float32BufferAttribute(F, 4)); sg.setAttribute('color', new T.Float32BufferAttribute(C, 3)); sg.setIndex(I); sg.computeVertexNormals();
    const H = o.hang || 0, stk = H ? [V(0, -0.004, 0), V(0.004, 0.02, 0), V(0.01, H * 0.6, 0.004), V(0.008, H, 0)] : [V(0, -0.004, 0), V(0.003, 0.03, 0), V(0.006, 0.07, 0.002)];
    const g = join([body, sg, stalk(stk, 0.011, 0.009, t => [0.09, 0.07, 0.045], 8)]); if (H) g.translate(-0.008, -H, 0); g.userData.pivot = [-0.008, -H, 0]; return g;
  }
  /* ── a cempedak (Artocarpus integer): 20-35 cm long, a fat cylinder rounded at its ends, a little curved, its rind a
     mosaic of small low polygonal eyes (in the shader); on a short stalk straight from the trunk or a big limb ── */
  function cempedak(o = {}) {
    const L = o.L ?? 0.28, Rb = L * 0.22, lod = o.lod || 0;
    const body = lathe(lod ? 20 : 40, lod ? 18 : 36, (t, a) => {
      const r = Rb * Math.pow(Math.max(0, Math.sin(Math.PI * clamp(t * 0.98 + 0.01))), 0.42) * (1 + 0.08 * Math.sin(Math.PI * t * 1.3)) * (1 + 0.03 * Math.cos(3 * a + t * 4));
      return [Math.cos(a) * r + L * 0.05 * Math.sin(Math.PI * t), -L * t, Math.sin(a) * r * 0.95];
    }, (t, a) => [clamp(0.5 + 0.5 * Math.cos(a)), 0, 0, 1]);
    const H = o.hang || 0, g = join([body, stalk(H ? [V(0, -0.005, 0), V(0.005, H * 0.5, 0.002), V(0.01, H, 0)] : [V(0, -0.005, 0), V(0.002, 0.02, 0), V(0.004, 0.04, 0)], 0.008, 0.007, () => [0.1, 0.085, 0.05], 7)]);
    if (H) g.translate(-0.01, -H, 0); g.userData.pivot = [-0.01, -H, 0]; return g;
  }

  /* ── a papaya (Carica papaya): 15-30 cm, pear-shaped, broad at its lower end, five faint ribs down it; on a short thick
     stalk pressed against the trunk ── */
  function papaya(o = {}) {
    const L = o.L ?? 0.22, Rb = L * 0.34, lod = o.lod || 0;
    const body = lathe(lod ? 18 : 40, lod ? 14 : 34, (t, a) => {
      const u = Math.pow(t, 1.2), r = Rb * Math.pow(Math.max(0, 1 - Math.pow(2 * u - 1, 2)), 0.47) * (0.78 + 0.32 * t) * (1 + 0.035 * Math.cos(5 * a));
      return [Math.cos(a) * r, -L * t, Math.sin(a) * r];
    }, (t, a) => [clamp(0.5 + 0.5 * Math.cos(a)) * 0.6 + 0.5 * t, 0, 0, 1]);
    const H = o.hang || 0, g = join([body, stalk(H ? [V(0, -0.006, 0), V(0, H * 0.5, 0), V(-0.01, H, 0)] : [V(0, -0.006, 0), V(0, 0.012, 0), V(0, 0.024, 0)], 0.007, 0.006, () => [0.16, 0.2, 0.08], 7)]);
    if (H) g.translate(0.01, -H, 0); g.userData.pivot = [0.01, -H, 0]; return g;
  }
  /* ── a banana's finger (Musa): 12-20 cm, curving up, five-angled in section, narrowing at its foot into the pedicel
     and at its tip into a blunt end with the dark dry flower on it; it grows out along +x and up ── */
  function banana(o = {}) {
    const L = o.L ?? 0.16, Rb = 0.017, lod = o.lod || 0, nU = lod ? 10 : 20, nV = lod ? 10 : 24;
    const spine = t => [L * t * 0.95, L * 0.32 * t * t, 0], tang = t => { const x = 0.95, y = 0.64 * t, l = Math.hypot(x, y); return [x / l, y / l]; };
    const body = lathe(nU, nV, (t, a) => {
      const [sx, sy] = spine(t), [tx, ty] = tang(t), r = Rb * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.01))), 0.5) * (t < 0.15 ? 0.45 + 0.55 * t / 0.15 : 1) * (1 + 0.07 * Math.cos(5 * a)) * (t > 0.9 ? 0.7 + 0.3 * (1 - t) / 0.1 : 1);
      /* (the section in the plane square to the spine: n = (-ty, tx, 0), z) */
      return [sx + (-ty) * Math.cos(a) * r, sy + tx * Math.cos(a) * r, Math.sin(a) * r];
    }, (t, a) => [0.5 + 0.5 * Math.cos(a), 0, 0, t > 0.965 ? 0 : 1], (t) => t > 0.965 ? [0.05, 0.04, 0.03] : [1, 1, 1]);
    return join([body, stalk([V(-0.012, -0.004, 0), V(-0.005, -0.001, 0), V(0.004, 0, 0)], 0.006, 0.005, () => [0.2, 0.24, 0.1], 6)]);
  }
  /* ── a coconut (Cocos nucifera): 20-30 cm, ovoid and three-sided, its ridges plainer toward its pointed end; at its
     top the cap of six brown scales where it joins its stalk ── */
  function coconut(o = {}) {
    const L = o.L ?? 0.27, Rb = L * 0.37, lod = o.lod || 0;
    const body = lathe(lod ? 16 : 36, lod ? 12 : 28, (t, a) => {
      const r = Rb * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 0.97 + 0.03))), 0.55) * (1 - 0.22 * sm(0.55, 1, t)) * (1 + (0.03 + 0.06 * t) * Math.cos(3 * a));
      return [Math.cos(a) * r, -L * t, Math.sin(a) * r];
    }, (t, a) => [clamp(0.5 + 0.5 * Math.cos(a)), 0, 0, 1]);
    const parts = [body], P = [], F = [], C = [], I = [];
    for (let k = 0; k < 6; k++) {   /* (the cap: sepals and petals, leathery, brown, overlapping) */
      const an = k / 6 * TAU + (k % 2) * 0.3, d = V(Math.cos(an), 0, Math.sin(an)), sd = V(-Math.sin(an), 0, Math.cos(an)), o0 = P.length / 3, Ls = 0.045 + 0.01 * (k % 2);
      for (const [u, w] of [[0, -0.012], [0, 0.012], [0.6, -0.02], [0.6, 0.02], [1, 0]]) { const q = d.clone().multiplyScalar(0.006 + Ls * u).addScaledVector(sd, w).add(V(0, 0.006 - Ls * 0.45 * u * u - (k % 2) * 0.002, 0)); P.push(q.x, q.y, q.z); F.push(0, 0, 0, 0); C.push(0.2, 0.13, 0.07); }
      I.push(o0, o0 + 2, o0 + 1, o0 + 1, o0 + 2, o0 + 3, o0 + 2, o0 + 4, o0 + 3);
    }
    const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.Float32BufferAttribute(P, 3)); cg.setAttribute('aFr', new T.Float32BufferAttribute(F, 4)); cg.setAttribute('color', new T.Float32BufferAttribute(C, 3)); cg.setIndex(I); cg.computeVertexNormals(); parts.push(cg);
    const H = o.hang || 0; parts.push(stalk(H ? [V(0, 0, 0), V(0.01, H * 0.5, 0), V(0.03, H, 0)] : [V(0, 0, 0), V(0, 0.02, 0), V(0.004, 0.04, 0)], 0.012, 0.01, () => [0.14, 0.11, 0.06], 7));
    const g = join(parts); if (H) g.translate(-0.03, -H, 0); g.userData.pivot = [-0.03, -H, 0]; return g;
  }

  /* ── fruit geometry by kind, cached ── */
  const geos = new Map(), BUILD = { mango, rambutan, durian, cempedak, papaya, banana, coconut };
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
    mango: { bud: '#9a8a48', open: '#f2e6bc', base: '#d98c70', wilt: '#7a5a38', disc: '#e9a226', stalk: '#a8704e', dry: '#6a4a30', T: [0.12, 0.12, 0.2, 0.24],
      pan: { L: 0.24, petal: 0.0045, cup: 0.3, k: 5, lat: 22, cym: 6, per: 5 } },
    /* a rambutan's: a looser panicle of tiny petalless flowers, yellow-green and hairy, on green stalks */
    rambutan: { bud: '#7f8c40', open: '#d4d58e', base: '#aab35a', wilt: '#6a5a38', disc: '#cfc070', stalk: '#6f7f3e', dry: '#5a4a30', T: [0.12, 0.12, 0.22, 0.24],
      pan: { L: 0.18, petal: 0.0026, cup: 0.6, k: 5, lat: 18, cym: 5, per: 5 } },
    /* a durian's: big creamy flowers hanging in bunches under the branches: a cup, five spoon-shaped petals curling
       back, a brush of long stamens; open at dusk, fallen by morning */
    durian: { bud: '#8a7a4a', open: '#f1e9cf', base: '#d8cfa6', wilt: '#8a6a40', disc: '#efe2b2', stalk: '#6a5a3a', dry: '#4a3a26', T: [0.1, 0.12, 0.25, 0.3] },
    /* a cempedak's: on short shoots from the trunk — a green female head and a pair of male spikes going yellow with
       pollen, then black */
    /* a papaya's: a single female flower in a leaf's axil, five thick cream petals twisted round the green ovary */
    papaya: { bud: '#b8c27a', open: '#f4efd6', base: '#e6dca8', wilt: '#9a8452', disc: '#8aa64a', stalk: '#7a8a46', dry: '#5a4a30', T: [0.1, 0.1, 0.05, 0.6] },
    /* a banana's heart: a teardrop of purple bracts, lifting one by one from its foot, each over a row of cream flowers */
    banana: { bud: '#5a1a2c', open: '#6e2236', base: '#4a1424', wilt: '#3a2418', disc: '#efdf9a', stalk: '#6a7a3a', dry: '#4a3a24', T: [0.05, 0.05, 0.6, 0.35] },
    /* a coconut's: a woody spathe split open on a spray of drooping branchlets, cream male flowers all along them, a few
       round female ones at their feet */
    coconut: { bud: '#c8b46a', open: '#f2e2a0', base: '#e2d088', wilt: '#8a6a3a', disc: '#9aa850', stalk: '#c2a868', dry: '#6a5434', T: [0.08, 0.1, 0.3, 0.35] },
    cempedak: { bud: '#6a7a3a', open: '#b9c47a', base: '#93a650', wilt: '#2e2a1c', disc: '#d8c24e', stalk: '#5a5a34', dry: '#3a3420', T: [0.1, 0.1, 0.1, 0.45] } };
  const FL_V = `
attribute float aAge; attribute float aSeed; attribute vec3 aFl; attribute vec3 aFa; attribute vec4 aFk;
uniform vec4 uFlT;
varying float vAge; varying vec4 vFk; varying float vFa;`;
  const FL_VB = `
  { float ag = aAge, em = smoothstep(0.0, uFlT.x, ag), end = 1.0 - smoothstep(0.96, 1.0, ag);
    float st = uFlT.y + aFk.z*uFlT.z + aFk.y*0.04, fa = clamp((ag - st)/uFlT.w, 0.0, 1.0);
    vec3 p = position;
    if (aFk.x > 2.5){   /* (a spike or a head that only grows, then shrivels and drops) */
      float op = smoothstep(0.0, 0.3, fa), gone = smoothstep(0.88, 1.0, fa);
      p = aFl + (p - aFl)*mix(0.35, 1.0, op)*(1.0 - 0.25*smoothstep(0.6, 0.9, fa))*(1.0 - gone);
    } else if (aFk.x > 0.5){
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
      if (vFk.x > 1.5 && vFk.x < 2.5) pet = mix(uFlB, uFlC, op);
      if (vFk.x > 3.2) pet = mix(uFlB, uFlC, op);
      if (vFk.x > 2.5) wl = smoothstep(0.6, 0.85, vFa);
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
  /* ── a panicle (a mango's, a rambutan's): an upright pyramid of branching stalks, branchlets ending in little cymes,
     hundreds of small flowers ── */
  function panicle(kind, o = {}) {
    const Pk = FLK[kind].pan, R = Models.rng(o.seed || 5), L = o.L ?? Pk.L, B = fbuf(), lod = o.lod || 0, col = lin(FLK[kind].stalk);
    const ax = new T.CatmullRomCurve3([V(0, 0, 0), V(0.006, L * 0.35, 0.004), V(0.012, L * 0.7, -0.004), V(0.008, L, 0.002)]);
    fstalk(B, ax, 0.0032 * L / 0.24, 0.0011, col, lod ? 4 : 5, 8);
    const nl = lod ? Math.round(Pk.lat * 0.55) : Pk.lat, cym = lod ? Math.max(2, Math.round(Pk.cym * 0.5)) : Pk.cym, per = lod ? 3 : Pk.per;
    for (let k = 0; k < nl; k++) {
      const t = 0.06 + 0.9 * k / nl, b0 = ax.getPointAt(t), az = k * 2.39996 + R() * 0.3, el = 1.05 - 0.4 * t, len = L * (0.42 * Math.pow(1 - t, 0.85) + 0.05);
      const dir = V(Math.cos(az) * Math.sin(el), Math.cos(el), Math.sin(az) * Math.sin(el));
      const lat = new T.CatmullRomCurve3([b0, b0.clone().addScaledVector(dir, len * 0.5).add(V(0, len * 0.08, 0)), b0.clone().addScaledVector(dir, len).add(V(0, len * 0.14, 0))]);
      fstalk(B, lat, 0.0012, 0.0006, col, lod ? 3 : 4, 3);
      for (let j = 0; j <= cym; j++) {
        const u = j === cym ? 1 : 0.25 + 0.7 * (j + R() * 0.5) / cym, q0 = lat.getPointAt(Math.min(1, u)), bd = dir.clone().add(V((R() - 0.5) * 1.2, 0.8 + 0.4 * R(), (R() - 0.5) * 1.2)).normalize(), bl = j === cym ? 0.004 : 0.008 + 0.012 * R();
        const q1 = q0.clone().addScaledVector(bd, bl); if (j < cym && !lod) fstalk(B, new T.CatmullRomCurve3([q0, q0.clone().lerp(q1, 0.5).add(V(0, 0.002, 0)), q1]), 0.0006, 0.0004, col, 3, 2);
        for (let f = 0; f < per; f++) {
          const c = q1.clone().add(V((R() - 0.5) * 0.009, (R() - 0.2) * 0.006, (R() - 0.5) * 0.009));
          fflower(B, c, bd.clone().add(V((R() - 0.5) * 0.9, 0.3, (R() - 0.5) * 0.9)), Pk.k, Pk.petal * (0.85 + 0.3 * R()), Pk.petal * 0.4, Pk.cup, t, R(), R);
        }
      }
    }
    for (let f = 0; f < 6; f++) fflower(B, ax.getPointAt(0.93 + 0.07 * f / 6).add(V((R() - 0.5) * 0.01, 0, (R() - 0.5) * 0.01)), V(R() - 0.5, 1, R() - 0.5), Pk.k, Pk.petal, Pk.petal * 0.4, Pk.cup, 1, R(), R);
    return B.done();
  }
  /* ── a durian's bunch: three to eight big flowers hanging on long pedicels from a knob on the branch; each a cup, five
     petals curling back from it, a long brush of stamens hanging below ── */
  function durianBunch(o = {}) {
    const R = Models.rng(o.seed || 9), B = fbuf(), n = o.n ?? 3 + Math.floor(R() * 6), col = lin(FLK.durian.stalk), cup = lin('#7a7040');
    for (let i = 0; i < n; i++) {
      const az = i / n * TAU + R() * 0.6, pl = 0.05 + 0.04 * R(), along = i / n;
      const end = V(Math.cos(az) * 0.035, -pl, Math.sin(az) * 0.035), ped = new T.CatmullRomCurve3([V(0, 0, 0), V(Math.cos(az) * 0.02, -pl * 0.45, Math.sin(az) * 0.02), end]);
      fstalk(B, ped, 0.0022, 0.0018, col, 4, 4);
      const ax = V(Math.cos(az) * 0.35, -1, Math.sin(az) * 0.35).normalize();
      let e1 = V().crossVectors(ax, V(0, 1, 0)).normalize(); const e2 = V().crossVectors(ax, e1), c = end.clone().addScaledVector(ax, 0.012), rnd = R();
      /* (the cup: a short green-brown tube) */
      const ring = (d, r) => { const a2 = []; for (let k = 0; k < 7; k++) { const an = k / 7 * TAU, q = end.clone().addScaledVector(ax, d).addScaledVector(e1, Math.cos(an) * r).addScaledVector(e2, Math.sin(an) * r); a2.push(B.v(q, cup, q, ax, [0, rnd, along, 0])); } return a2; };
      const r0 = ring(0, 0.004), r1 = ring(0.014, 0.008); for (let k = 0; k < 7; k++) { B.tri(r0[k], r0[(k + 1) % 7], r1[k]); B.tri(r0[(k + 1) % 7], r1[(k + 1) % 7], r1[k]); }
      /* (five petals, spoon-shaped, 3.5-5 cm, curling back over the cup) */
      for (let k = 0; k < 5; k++) {
        const an = k / 5 * TAU + R() * 0.2, d = V().addScaledVector(e1, Math.cos(an)).addScaledVector(e2, Math.sin(an)), sd = V().crossVectors(ax, d), Lp = 0.038 + 0.012 * R();
        const pt = (u, w) => c.clone().addScaledVector(ax, Lp * (0.6 * u - 0.75 * u * u)).addScaledVector(d, Lp * (0.25 + 0.55 * u)).addScaledVector(sd, w);
        let prev = null; for (let q = 0; q <= 4; q++) { const u = q / 4, w = Lp * 0.2 * Math.sin(Math.PI * Math.min(1, 0.2 + u * 0.85)), a = B.v(pt(u, -w), [1, 1, 1], c, ax, [1, rnd, along, u]), b = B.v(pt(u, w), [1, 1, 1], c, ax, [1, rnd, along, u]); if (prev) { B.tri(prev[0], a, prev[1]); B.tri(prev[1], a, b); } prev = [a, b]; }
      }
      /* (the stamens: a brush of long filaments, cream, hanging out below the petals) */
      for (let k = 0; k < 26; k++) {
        const an = R() * TAU, sp = 0.15 + 0.35 * R(), dd = ax.clone().addScaledVector(e1, Math.cos(an) * sp).addScaledVector(e2, Math.sin(an) * sp).normalize(), Ls = 0.035 + 0.02 * R(), side = V().crossVectors(dd, e1).normalize().multiplyScalar(0.0007);
        const p0 = c.clone().addScaledVector(dd, 0.004), p1 = c.clone().addScaledVector(dd, Ls);
        const a = B.v(p0.clone().sub(side), [1, 1, 1], c, ax, [2, rnd, along, 0.5]), b = B.v(p0.clone().add(side), [1, 1, 1], c, ax, [2, rnd, along, 0.5]), t1 = B.v(p1.clone().sub(side.clone().multiplyScalar(1.6)), [1, 1, 1], c, ax, [2, rnd, along, 1]), t2 = B.v(p1.clone().add(side.clone().multiplyScalar(1.6)), [1, 1, 1], c, ax, [2, rnd, along, 1]);
        B.tri(a, t1, b); B.tri(b, t1, t2);
      }
    }
    return B.done();
  }
  /* ── a cempedak's: from a short woody shoot on the trunk, a female head (an oval, its surface packed with tiny
     styles) and two or three male spikes, cylinders that go yellow with pollen and then black ── */
  function cempShoot(o = {}) {
    const R = Models.rng(o.seed || 13), B = fbuf(), col = lin(FLK.cempedak.stalk);
    const spike = (base, dir, L, r, role, along) => {
      dir = dir.clone().normalize(); let e1 = V().crossVectors(dir, V(0, 1, 0)); if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0); e1.normalize(); const e2 = V().crossVectors(dir, e1), rnd = R(), rows = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8, rr = r * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.94)), 0.5), row = []; for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, q = base.clone().addScaledVector(dir, L * t).addScaledVector(e1, Math.cos(an) * rr).addScaledVector(e2, Math.sin(an) * rr); row.push(B.v(q, [1, 1, 1], base.clone().addScaledVector(dir, L * 0.5), dir, [role, rnd, along, t])); } rows.push(row); }
      for (let i = 0; i < 8; i++) for (let k = 0; k < 8; k++) { const a = rows[i][k], b = rows[i][(k + 1) % 8], c = rows[i + 1][k], d = rows[i + 1][(k + 1) % 8]; B.tri(a, c, b); B.tri(b, c, d); }
    };
    const out = V(1, -0.25, 0).normalize();
    fstalk(B, new T.CatmullRomCurve3([V(0, 0, 0), V(0.015, -0.004, 0), V(0.03, -0.012, 0)]), 0.006, 0.005, col, 5, 3);
    const tip = V(0.03, -0.012, 0);
    spike(tip, out.clone().add(V(0, -0.6, 0.2)), 0.035, 0.009, 3, 0.1);   /* (the female head) */
    for (let k = 0; k < 2 + Math.floor(R() * 2); k++) spike(tip, out.clone().add(V(0, -0.9 - 0.3 * R(), (R() - 0.5) * 1.2)), 0.045 + 0.02 * R(), 0.0055, 3.5, 0.4 + 0.3 * k);
    return B.done();
  }
  /* ── a papaya's flower: five thick petals, oblong, twisted, round a pear-shaped green ovary with its fringed stigma;
     it points out and down from the trunk ── */
  function papayaFlower(o = {}) {
    const R = Models.rng(o.seed || 17), B = fbuf(), ax = V(0.6, -0.8, 0).normalize(), c = V(0.02, -0.01, 0);
    fstalk(B, new T.CatmullRomCurve3([V(0, 0, 0), V(0.012, -0.004, 0), c]), 0.004, 0.0035, lin(FLK.papaya.stalk), 5, 3);
    let e1 = V().crossVectors(ax, V(0, 0, 1)).normalize(); const e2 = V().crossVectors(ax, e1), rnd = R();
    /* (the ovary: a small green pear, its stigma fringed) */
    const rows = []; for (let i = 0; i <= 6; i++) { const t = i / 6, rr = 0.009 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)), 0.6), row = []; for (let k = 0; k < 8; k++) { const an = k / 8 * TAU, q = c.clone().addScaledVector(ax, 0.026 * t).addScaledVector(e1, Math.cos(an) * rr).addScaledVector(e2, Math.sin(an) * rr); row.push(B.v(q, [1, 1, 1], c, ax, [3, rnd, 0, t])); } rows.push(row); }
    for (let i = 0; i < 6; i++) for (let k = 0; k < 8; k++) { const a0 = rows[i][k], b0 = rows[i][(k + 1) % 8], c0 = rows[i + 1][k], d0 = rows[i + 1][(k + 1) % 8]; B.tri(a0, c0, b0); B.tri(b0, c0, d0); }
    for (let k = 0; k < 5; k++) {   /* (the petals: thick, twisted, spreading from the ovary's foot) */
      const an = k / 5 * TAU, d = V().addScaledVector(e1, Math.cos(an)).addScaledVector(e2, Math.sin(an)), sd = V().crossVectors(ax, d), Lp = 0.042 + 0.008 * R(); let prev = null;
      for (let q = 0; q <= 5; q++) { const u = q / 5, tw = u * 0.9, w = Lp * 0.18 * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.9)), sdt = sd.clone().applyAxisAngle(d, tw), base = c.clone().addScaledVector(ax, Lp * (0.3 + 0.5 * u - 0.2 * u * u)).addScaledVector(d, Lp * (0.1 + 0.45 * u));
        const a0 = B.v(base.clone().addScaledVector(sdt, -w), [1, 1, 1], c, ax, [1, rnd, 0, u]), b0 = B.v(base.clone().addScaledVector(sdt, w), [1, 1, 1], c, ax, [1, rnd, 0, u]); if (prev) { B.tri(prev[0], a0, prev[1]); B.tri(prev[1], a0, b0); } prev = [a0, b0]; }
    }
    return B.done();
  }
  /* ── a banana's heart, hanging at the end of the rachis: twelve to sixteen bracts wrapped in a teardrop, purple-red;
     the lowest lifting and curling back first, each from over a row of cream flowers ── */
  function bananaHeart(o = {}) {
    const R = Models.rng(o.seed || 19), B = fbuf(), ax = V(0, -1, 0), nB = 14, L = 0.24, Rm = 0.065;
    for (let k = 0; k < nB; k++) {
      const along = k / nB, an = k * 2.39996, t0 = along * 0.62, h0 = -L * t0, rr = Rm * Math.pow(Math.sin(Math.PI * Math.min(1, 0.25 + along * 0.7)), 0.7), Lb = L * (1 - t0) * 0.98;
      const d = V(Math.cos(an), 0, Math.sin(an)), sd = V(-Math.sin(an), 0, Math.cos(an)), c = V(0, h0, 0), rnd = R();
      /* (a bract: a shell wrapped round the bud, broad at its foot, closing to the bud's tip; open, it lifts out and up) */
      let prev = null;
      for (let q = 0; q <= 6; q++) { const u = q / 6, w = rr * 1.1 * Math.sin(Math.PI * Math.min(1, 0.2 + u * 0.85)), y = h0 - Lb * u, rad = rr * Math.sin(Math.PI * Math.min(1, 0.35 + u * 0.65)) * (1 - 0.8 * u * u);
        const row = []; for (let j = -2; j <= 2; j++) { const aa = an + j / 2 * 0.95, q2 = V(Math.cos(aa) * rad, y, Math.sin(aa) * rad); row.push(B.v(q2, [1, 1, 1], c, d.clone().add(V(0, 0.6, 0)), [1, rnd, along, 1 - u * 0.5])); }
        if (prev) for (let j = 0; j < 4; j++) { B.tri(prev[j], row[j], prev[j + 1]); B.tri(prev[j + 1], row[j], row[j + 1]); } prev = row; }
      /* (beneath it, a row of cream tubular flowers) */
      for (let f = 0; f < 6; f++) { const aa = an + (f / 5 - 0.5) * 0.9, base = V(Math.cos(aa) * rr * 0.4, h0 - 0.01, Math.sin(aa) * rr * 0.4), tip = base.clone().add(V(Math.cos(aa) * 0.02, -0.04, Math.sin(aa) * 0.02)), s2 = V(-Math.sin(aa), 0, Math.cos(aa)).multiplyScalar(0.003);
        const a0 = B.v(base.clone().sub(s2), [1, 1, 1], base, ax, [2, rnd, along, 0]), b0 = B.v(base.clone().add(s2), [1, 1, 1], base, ax, [2, rnd, along, 0]), c0 = B.v(tip.clone().sub(s2), [1, 1, 1], base, ax, [2, rnd, along, 1]), d0 = B.v(tip.clone().add(s2), [1, 1, 1], base, ax, [2, rnd, along, 1]); B.tri(a0, c0, b0); B.tri(b0, c0, d0); }
    }
    return B.done();
  }
  /* ── a coconut's inflorescence: the boat-shaped spathe split along its length, and out of it the spadix, a spray of
     thirty-odd branchlets drooping, crowded with small cream male flowers, a round female flower or two at the foot of
     each ── */
  function coconutSpadix(o = {}) {
    const R = Models.rng(o.seed || 23), B = fbuf(), col = lin(FLK.coconut.stalk), sp = lin('#6a5230');
    const axis = new T.CatmullRomCurve3([V(0, 0, 0), V(0.18, -0.1, 0), V(0.38, -0.3, 0), V(0.5, -0.55, 0)]);
    fstalk(B, axis, 0.022, 0.012, col, 6, 6);
    /* (the spathe: a long woody husk, open, curling back to one side) */
    { const rows = []; for (let i = 0; i <= 8; i++) { const t = i / 8, p = axis.getPointAt(Math.min(1, t * 0.95)), w = 0.07 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)), row = []; for (let k = 0; k <= 4; k++) { const an = Math.PI * (0.55 + 0.9 * k / 4), q = p.clone().add(V(Math.cos(an) * w * 0.4, Math.sin(an) * w * 0.4 + 0.03, Math.sin(an * 1.3) * w)); row.push(B.v(q, sp, q, V(0, 1, 0), [0, 0, 0, 0])); } rows.push(row); }
      for (let i = 0; i < 8; i++) for (let k = 0; k < 4; k++) { B.tri(rows[i][k], rows[i + 1][k], rows[i][k + 1]); B.tri(rows[i][k + 1], rows[i + 1][k], rows[i + 1][k + 1]); } }
    for (let k = 0; k < 30; k++) {
      const t = 0.35 + 0.62 * k / 30, b0 = axis.getPointAt(t), an = k * 2.39996, Lr = 0.3 + 0.18 * R(), along = k / 30;
      const dir = V(0.6, -0.4, 0).add(V(Math.cos(an) * 0.6, Math.sin(an) * 0.2, Math.sin(an) * 0.8)).normalize();
      const br = new T.CatmullRomCurve3([b0, b0.clone().addScaledVector(dir, Lr * 0.5).add(V(0, -Lr * 0.08, 0)), b0.clone().addScaledVector(dir, Lr).add(V(0, -Lr * 0.3, 0))]);
      fstalk(B, br, 0.004, 0.002, col, 4, 4);
      fflower(B, br.getPointAt(0.06), dir.clone().add(V(0, 0.6, 0)), 6, 0.012, 0.008, 0.5, along, R(), R);   /* (a female flower: round, with its perianth) */
      for (let f = 0; f < 10; f++) { const c = br.getPointAt(0.2 + 0.78 * f / 10); fflower(B, c, dir.clone().add(V((R() - 0.5), 0.5, (R() - 0.5))), 3, 0.006, 0.0035, 0.4, along, R(), R); }
    }
    return B.done();
  }
  const blooms = new Map(), BLOOM = { mango: o => panicle('mango', o), rambutan: o => panicle('rambutan', o), durian: durianBunch, cempedak: cempShoot, papaya: papayaFlower, banana: bananaHeart, coconut: coconutSpadix };
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
  const SITE = {
    mango: { src: 'tips', hang: 0.26, perSite: [1, 2], spread: 0.06, n: 120, dy: [-0.75, 0.55], out: 1.08, fall: 0.82 },
    rambutan: { src: 'tips', hang: 0.07, perSite: [6, 13], spread: 0.09, n: 70, dy: [-0.6, 0.6], out: 1.05, fall: 0.86 },
    durian: { src: 'limbs', hang: 0.12, perSite: [1, 2], spread: 0.1, n: 40, fall: 0.62 },
    cempedak: { src: 'trunk', hang: 0.035, perSite: [1, 1], spread: 0.0, n: 34, fall: 0.8 } };
  function onTree(kind, grown, o = {}) {
    const S = SITE[kind], R = Models.rng((o.seed || 1) * 19 + 7), g = new T.Group(), UPv = V(0, 1, 0);
    const blooms = [], fruit = [], fallen = [], sites = [];
    const cc = grown.info.crown.c, Rc = grown.info.crown.R, n = o.n ?? S.n;
    /* (the places: each a point to hang from, the way out from the tree there, and whether its flowers stand up or hang) */
    const spots = [];
    if (S.src === 'tips') for (const c of grown.clumps.filter(c => c.d.y > S.dy[0] && c.d.y < S.dy[1]).sort(() => R() - 0.5).slice(0, n)) spots.push({ p: c.c.clone().addScaledVector(c.d, c.r * S.out), d: c.d.clone(), up: true });
    else if (S.src === 'limbs') { for (let i = 0; i < n; i++) { const L = grown.limbs[Math.floor(R() * grown.limbs.length)]; if (!L) break; const t = 0.3 + 0.65 * R(), p = L.curve.getPointAt(t), tg = L.curve.getTangentAt(t); let sd = V().crossVectors(tg, UPv); if (sd.lengthSq() < 1e-4) sd.set(1, 0, 0); sd.normalize(); spots.push({ p: p.addScaledVector(sd, (R() - 0.5) * L.r(t)).add(V(0, -L.r(t) * 0.9, 0)), d: V(sd.x, 0, sd.z), up: false }); } }
    else { const T0 = grown.trunk, H0 = T0.boleH; for (let i = 0; i < n; i++) { const onLimb = R() < 0.3 && grown.limbs.length; if (onLimb) { const L = grown.limbs[Math.floor(R() * grown.limbs.length)], t = 0.1 + 0.4 * R(), p = L.curve.getPointAt(t), a = R() * TAU; spots.push({ p: p.add(V(Math.cos(a) * L.r(t), -L.r(t) * 0.3, Math.sin(a) * L.r(t))), d: V(Math.cos(a), 0, Math.sin(a)), up: false }); continue; }
      const y = 1.0 + R() * (H0 - 1.2), a = R() * TAU, [sx, sz] = T0.spine(y), r = T0.rAt(y, a); spots.push({ p: V(sx + Math.cos(a) * (r + 0.01), y, sz + Math.sin(a) * (r + 0.01)), d: V(Math.cos(a), 0, Math.sin(a)), up: false }); } }
    spots.forEach((sp, i) => {
      const tip = sp.p, u = o.phase ? o.phase(i) : R(), ry = Math.atan2(-sp.d.z, sp.d.x) + (R() - 0.5) * 0.6;
      const site = { tip, d: sp.d, u, bloom: -1, fruit: [] }; sites.push(site);
      if (u < 0.4) { site.bloom = blooms.length; const ax = sp.d.clone().multiplyScalar(0.5).add(UPv).normalize(); blooms.push({ p: tip.toArray(), ry, tilt: sp.up ? Math.acos(clamp(ax.y, -1, 1)) * 0.6 : 0, age: u / 0.4, seed: R() * 9 }); }
      if (u >= 0.2) {
        const age = (u - 0.2) / 0.8, nf = S.perSite[0] + Math.floor(R() * (S.perSite[1] - S.perSite[0] + 1));
        for (let k = 0; k < nf; k++) {
          const a2 = clamp(age * (0.95 + 0.1 * R()));
          if (a2 > S.fall) { const rr = Math.sqrt(R()) * Rc * 0.9, aa = R() * TAU; fallen.push({ p: [cc.x + Math.cos(aa) * rr, 0.0, cc.z + Math.sin(aa) * rr], ry: R() * TAU, tilt: Math.PI / 2 * (0.85 + 0.15 * R()), age: Math.min(1, a2 + 0.08), seed: R() * 9, ground: true }); }
          else { site.fruit.push(fruit.length); const off = S.spread * Math.sqrt(R()), oa = R() * TAU; fruit.push({ p: tip.clone().add(V(Math.cos(oa) * off, -0.015 - 0.4 * off * R(), Math.sin(oa) * off)).toArray(), ry: ry + k * 2.1, tilt: (R() - 0.5) * 0.16, age: a2, seed: R() * 9 }); }
        }
      }
    });
    const parts = {};
    if (blooms.length) { parts.blooms = bloomInstances(kind, blooms, { geo: { lod: o.bloomLod ?? 1 } }); g.add(parts.blooms); }
    if (fruit.length) { parts.fruit = instances(kind, fruit, { geo: { hang: S.hang, lod: o.fruitLod ?? 1 } }); g.add(parts.fruit); }
    if (fallen.length) {
      /* (lying on the ground: a fruit on its side rests on its widest girth) */
      const gg = geo(kind, { lod: o.fruitLod ?? 1 }); gg.computeBoundingBox(); const bb = gg.boundingBox, rest = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5;
      for (const f of fallen) { f.p[1] = rest * 0.92; f.p[0] += (bb.max.y + bb.min.y) * 0.5 * Math.sin(f.ry) * 0; }
      parts.fallen = instances(kind, fallen, { geo: { lod: o.fruitLod ?? 1 } }); g.add(parts.fallen);
    }
    g.userData.fruit = { kind, sites, parts }; return g;
  }
  for (const k of ['mango', 'rambutan', 'durian', 'cempedak']) Models.add('fruit/' + k + '-tree', (o = {}) => {
    const t = FloraGrow.model(k, o.seed || 2, o), f = onTree(k, t.userData.grown, o);
    t.add(f); t.userData.fruit = f.userData.fruit; return t;
  });
  return { KINDS, FLK, material, depth, flowers, geo, bloom, instances, bloomInstances, onTree, lathe, stalk, join };
})();
