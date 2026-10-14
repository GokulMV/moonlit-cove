/* ─────────────────────────────────────────────────────────────
   impostor.js — trees far off, drawn from the trees themselves.
   Each kind of tree (each of its shapes) is photographed once, when
   the island is made: from six sides round it and from straight
   above, what it is made of (its leaves' and its bark's colour),
   which way each bit of it faces, and how deep in its crown, into
   one atlas of pictures. Far off, every tree of that shape is one
   card turned to the eye, showing the picture taken from the side
   it is seen from (two pictures blended between), lit as the scene
   is lit just then: so the forest is the forest's own trees at any
   distance, its crowns in sun and in shade, at the cost of a card.
   Near the eye the trees themselves stand instead.
   ───────────────────────────────────────────────────────────── */
const Impostor = (() => {
  const T = THREE, TAU = Math.PI * 2, VIEWS = 6;
  /* ── what is photographed: the colour of the leaves and the bark (no light on it, the square root of it, so dark
     greens keep their steps in a byte), and which way each faces (packed onto an octahedron, two bytes) with how deep it
     sits in its crown (the leaves' own shade; the bark's is in its colour) ── */
  const OCT = `
vec2 octE(vec3 n){ n /= abs(n.x) + abs(n.y) + abs(n.z); vec2 p = n.xz; if (n.y < 0.0) p = (1.0 - abs(p.yx))*vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0); return p*0.5 + 0.5; }
vec3 octD(vec2 e){ vec2 f = e*2.0 - 1.0; vec3 n = vec3(f.x, 1.0 - abs(f.x) - abs(f.y), f.y); float t = max(-n.y, 0.0); n.x += n.x >= 0.0 ? -t : t; n.z += n.z >= 0.0 ? -t : t; return normalize(n); }`;
  const LEAF_VS = `
attribute vec4 aLeaf; attribute vec3 aTan, aBit;
varying vec2 vUv; varying vec3 vN, vT, vB; varying vec4 vL;
void main(){ vUv = uv; mat3 m = mat3(modelMatrix); vN = m*normal; vT = m*aTan; vB = m*aBit; vL = aLeaf; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
  const LEAF_FS = `
${OCT}
uniform sampler2D map, nmap; uniform vec3 uTint; uniform float uCut, uPass; uniform vec3 uView;
varying vec2 vUv; varying vec3 vN, vT, vB; varying vec4 vL;
void main(){
  vec4 tx = texture2D(map, vUv); if (tx.a < uCut) discard;
  if (uPass < 0.5){ gl_FragColor = vec4(sqrt(clamp(tx.rgb*uTint, 0.0, 1.0)), 1.0); return; }
  vec3 Tg = normalize(vT), Bt = normalize(vB), Nc = normalize(cross(Tg, Bt))*vL.w; float face = dot(Nc, uView) >= 0.0 ? 1.0 : -1.0;
  vec3 tn = texture2D(nmap, vUv).xyz*2.0 - 1.0, nl = normalize(Tg*tn.x + Bt*tn.y + Nc*max(tn.z, 0.05))*face;
  /* (far off it is the crown's shape that is lit, more than each leaf: the crown's own normal, the leaf's a little) */
  vec3 n = normalize(normalize(vN)*0.68 + nl*0.32);
  gl_FragColor = vec4(octE(n), vL.x, 1.0);
}`;
  const BARK_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vC;
void main(){ vUv = uv; vN = mat3(modelMatrix)*normal; vC = vec3(1.0);
  #ifdef USE_COLOR
    vC = color;
  #endif
  gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
  const BARK_FS = `
${OCT}
uniform sampler2D map; uniform vec3 uColor; uniform float uPass, uHasMap;
varying vec2 vUv; varying vec3 vN; varying vec3 vC;
void main(){
  vec3 c = vC*uColor; if (uHasMap > 0.5) c *= texture2D(map, vUv).rgb;
  if (uPass < 0.5){ gl_FragColor = vec4(sqrt(clamp(c, 0.0, 1.0)), 1.0); return; }
  gl_FragColor = vec4(octE(normalize(vN)), 1.0, 0.0);
}`;
  /* the photographer's stand-in for each of a model's materials: its leaves' cards (their colour, their normal map, how
     they are cut out), or its bark and anything else (its colour, its map) */
  function bakeMat(m, pass) {
    const isLeaf = m.isShaderMaterial && m.uniforms && m.uniforms.map && m.uniforms.nmap && m.uniforms.uCut;
    if (isLeaf) return new T.ShaderMaterial({ uniforms: { map: { value: m.uniforms.map.value }, nmap: { value: m.uniforms.nmap.value }, uTint: { value: (m.uniforms.uTint && m.uniforms.uTint.value) || new T.Vector3(1, 1, 1) }, uCut: { value: m.uniforms.uCut.value }, uPass: { value: pass }, uView: { value: new T.Vector3(0, 0, 1) } }, vertexShader: LEAF_VS, fragmentShader: LEAF_FS, side: T.DoubleSide });
    const map = m.map || (m.uniforms && m.uniforms.map && m.uniforms.map.value) || null, col = m.color ? new T.Vector3(m.color.r, m.color.g, m.color.b) : new T.Vector3(0.5, 0.5, 0.5);
    return new T.ShaderMaterial({ uniforms: { map: { value: map }, uColor: { value: col }, uPass: { value: pass }, uHasMap: { value: map ? 1 : 0 } }, vertexShader: BARK_VS, fragmentShader: BARK_FS, vertexColors: !!m.vertexColors, side: m.side === T.DoubleSide ? T.DoubleSide : T.FrontSide });
  }

  /* ── the photographs. protos: [{ obj }] (each a model at the origin, standing up y). Each gets VIEWS cells round it and one
     from above, cell × cell pixels each with a margin; returns the two atlases and, for each, the square its pictures
     frame (S across, centred cy up the tree) and where its cells start ── */
  function bake(R, protos, o = {}) {
    /* (the atlas a power of two across and down, its pictures from its corner: every smaller copy halves it exactly) */
    const cell = o.cell || 192, pad = o.pad || 6, per = VIEWS + 1, n = protos.length * per, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), p2 = v => 2 ** Math.ceil(Math.log2(v)), W = p2(cols * cell), H = p2(rows * cell);
    const mk = () => new T.WebGLRenderTarget(W, H, { depthBuffer: true, minFilter: T.LinearFilter, magFilter: T.LinearFilter, generateMipmaps: false });
    const rtC = mk(), rtN = mk(), sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 400), info = [];
    const prevRT = R.getRenderTarget(), prevClear = R.getClearColor(new T.Color()), prevA = R.getClearAlpha(), prevAuto = R.autoClear, prevTM = R.toneMapping;
    R.autoClear = false; R.toneMapping = T.NoToneMapping; R.setClearColor(0x000000, 0);
    for (const rt of [rtC, rtN]) { R.setRenderTarget(rt); R.clear(true, true, true); }
    protos.forEach((p, pi) => {
      const obj = p.obj; obj.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(obj), y0 = Math.max(box.min.y, -0.4), y1 = box.max.y;
      const Rr = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z), S = Math.max(2 * Rr, y1 - y0) * 1.04, cy = (y0 + y1) / 2;
      const meshes = []; obj.traverse(m => { if (m.isMesh || m.isInstancedMesh) meshes.push({ m, mat: m.material, bm: [0, 1].map(k => Array.isArray(m.material) ? m.material.map(mm => bakeMat(mm, k)) : bakeMat(m.material, k)) }); });
      const parent = obj.parent; sc.add(obj);
      for (let v = 0; v < per; v++) {
        const ci = pi * per + v, cx = (ci % cols) * cell, cyp = Math.floor(ci / cols) * cell, D = 200;
        cam.left = -S / 2; cam.right = S / 2; cam.top = S / 2; cam.bottom = -S / 2; cam.near = D - S * 2; cam.far = D + S * 2; cam.updateProjectionMatrix();
        if (v < VIEWS) { const a = v / VIEWS * TAU; cam.position.set(Math.sin(a) * D, cy, Math.cos(a) * D); cam.up.set(0, 1, 0); cam.lookAt(0, cy, 0); }
        else { cam.position.set(0, cy + D, 0); cam.up.set(0, 0, -1); cam.lookAt(0, cy, 0); }
        cam.updateMatrixWorld(); const view = new T.Vector3().subVectors(cam.position, new T.Vector3(0, cy, 0)).normalize();
        for (let k = 0; k < 2; k++) {
          for (const e of meshes) { e.m.material = e.bm[k]; for (const bm of [].concat(e.bm[k])) if (bm.uniforms.uView) bm.uniforms.uView.value.copy(view); }
          const rt = k ? rtN : rtC; rt.viewport.set(cx + pad, cyp + pad, cell - 2 * pad, cell - 2 * pad); rt.scissor.copy(rt.viewport); rt.scissorTest = true;
          R.setRenderTarget(rt); R.clear(false, true, false); R.render(sc, cam);
        }
      }
      for (const e of meshes) { e.m.material = e.mat; for (const bm of e.bm) for (const x of [].concat(bm)) x.dispose(); }
      if (parent) parent.add(obj); else sc.remove(obj);
      info.push({ S, cy, cell0: pi * per });
    });
    for (const rt of [rtC, rtN]) { rt.scissorTest = false; rt.viewport.set(0, 0, W, H); }
    /* the pictures back, and their smaller copies made from them here (see mips) */
    const pc = new Uint8Array(W * H * 4), pn = new Uint8Array(W * H * 4);
    R.readRenderTargetPixels(rtC, 0, 0, W, H, pc); R.readRenderTargetPixels(rtN, 0, 0, W, H, pn);
    R.setRenderTarget(prevRT); R.setClearColor(prevClear, prevA); R.autoClear = prevAuto; R.toneMapping = prevTM;
    const L = mips(pc, pn, W, H, cell, cols, rows), tex = levels => { const t = new T.DataTexture(levels[0].data, W, H, T.RGBAFormat, T.UnsignedByteType);
      t.mipmaps = levels; t.generateMipmaps = false; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.needsUpdate = true; return t; };
    const col = tex(L.col), nrm = tex(L.nrm);
    if (!o.keep) { rtC.dispose(); rtN.dispose(); }
    return { col, nrm, rts: [rtC, rtN], pc, pn, info, cols, rows, cell, pad, W, H, maxLod: L.maxLod };
  }
  /* ── the pictures' smaller copies, for a tree further off, made so that it stays as thick with leaves as it is up close:
     each copy averages four texels of the one before (their colour as much as each is covered), and then, picture by
     picture, has its cover made up again so as much of it is leaf as in the full-size picture (an average of leaves and
     sky between them would otherwise fall short of being leaf, and a far crown come apart into dots). Where nothing is,
     the colour of what is next to it, so its edges never darken ── */
  function mips(pc, pn, W, H, cell, cols, rows) {
    const CUT = 127, outC = [{ data: pc, width: W, height: H }], outN = [{ data: pn, width: W, height: H }];
    /* (it passes of colouring the empty texels from their covered neighbours; four: the fourth channel too. As in
       trees.js, flat loops and typed lists, no arrays made per texel) */
    const add = new Int32Array(W * H);
    const dil = (D, A, w, h, it, four) => { for (let n = 0; n < it; n++) { let na = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (A[i]) continue; let r = 0, g = 0, b = 0, a4 = 0, k = 0, j;
      if (x < w - 1 && A[j = i + 1]) { r += D[j * 4]; g += D[j * 4 + 1]; b += D[j * 4 + 2]; a4 += D[j * 4 + 3]; k++; }
      if (x > 0 && A[j = i - 1]) { r += D[j * 4]; g += D[j * 4 + 1]; b += D[j * 4 + 2]; a4 += D[j * 4 + 3]; k++; }
      if (y < h - 1 && A[j = i + w]) { r += D[j * 4]; g += D[j * 4 + 1]; b += D[j * 4 + 2]; a4 += D[j * 4 + 3]; k++; }
      if (y > 0 && A[j = i - w]) { r += D[j * 4]; g += D[j * 4 + 1]; b += D[j * 4 + 2]; a4 += D[j * 4 + 3]; k++; }
      if (k) { D[i * 4] = r / k; D[i * 4 + 1] = g / k; D[i * 4 + 2] = b / k; if (four) D[i * 4 + 3] = a4 / k; add[na++] = i; } }
      if (!na) break; for (let q = 0; q < na; q++) A[add[q]] = 1; } };
    /* (the raw cover of each texel, apart from the cover kept up: the next copy is made from the raw) */
    let A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = pc[i * 4 + 3];
    const mark0 = new Uint8Array(A); dil(pc, mark0, W, H, 3); dil(pn, new Uint8Array(A), W, H, 3, true);
    /* how much of each picture is leaf (or bark), full size */
    const nc = cols * rows, c0 = new Float32Array(nc);
    for (let y = 0; y < rows * cell; y++) for (let x = 0; x < cols * cell; x++) if (A[y * W + x] > CUT) c0[Math.floor(y / cell) * cols + Math.floor(x / cell)]++;
    for (let i = 0; i < nc; i++) c0[i] /= cell * cell;
    let w = W, h = H, C = pc, N = pn, cs = cell, lvl = 0;
    while ((w > 1 || h > 1) && cs >= 2) {
      const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), C2 = new Uint8Array(nw * nh * 4), N2 = new Uint8Array(nw * nh * 4), A2 = new Uint8Array(nw * nh);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        let a = 0, r = 0, g = 0, b = 0, nx = 0, ny = 0, nz = 0, lf = 0, ru = 0, gu = 0, bu = 0, nxu = 0, nyu = 0, nzu = 0, lfu = 0;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const xx = Math.min(w - 1, x * 2 + i), yy = Math.min(h - 1, y * 2 + j), q = yy * w + xx, al = A[q];
          a += al; r += C[q * 4] * al; g += C[q * 4 + 1] * al; b += C[q * 4 + 2] * al; nx += N[q * 4] * al; ny += N[q * 4 + 1] * al; nz += N[q * 4 + 2] * al; lf += N[q * 4 + 3] * al;
          ru += C[q * 4]; gu += C[q * 4 + 1]; bu += C[q * 4 + 2]; nxu += N[q * 4]; nyu += N[q * 4 + 1]; nzu += N[q * 4 + 2]; lfu += N[q * 4 + 3]; }
        const o = (y * nw + x) * 4;
        if (a > 0) { C2[o] = r / a; C2[o + 1] = g / a; C2[o + 2] = b / a; N2[o] = nx / a; N2[o + 1] = ny / a; N2[o + 2] = nz / a; N2[o + 3] = lf / a; }
        else { C2[o] = ru / 4; C2[o + 1] = gu / 4; C2[o + 2] = bu / 4; N2[o] = nxu / 4; N2[o + 1] = nyu / 4; N2[o + 2] = nzu / 4; N2[o + 3] = lfu / 4; }
        A2[y * nw + x] = (a + 2) >> 2;
      }
      cs >>= 1; lvl++;
      /* (each picture's cover made up again, as much as its full-size picture had) */
      for (let ci = 0; ci < nc; ci++) {
        const x0 = (ci % cols) * cs, y0 = Math.floor(ci / cols) * cs, Hc = new Float64Array(256);
        for (let y = y0; y < y0 + cs; y++) for (let x = x0; x < x0 + cs; x++) Hc[A2[y * nw + x]]++;
        const cov = k => { let n = 0; for (let v = 255; v >= 0 && v * k > CUT; v--) n += Hc[v]; return n / (cs * cs); };
        let k = 1; if (c0[ci] > 0) { let lo = 1, hi = 8; for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2; if (cov(m) < c0[ci]) lo = m; else hi = m; } k = hi; }
        for (let y = y0; y < y0 + cs; y++) for (let x = x0; x < x0 + cs; x++) { const i = y * nw + x; C2[i * 4 + 3] = Math.min(255, Math.round(A2[i] * k)); }
      }
      outC.push({ data: C2, width: nw, height: nh }); outN.push({ data: N2, width: nw, height: nh });
      A = A2; C = C2; N = N2; w = nw; h = nh;
    }
    /* (and below the smallest copy that still keeps its pictures apart, the rest down to a texel, plainly averaged: never used) */
    while (w > 1 || h > 1) { const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), C2 = new Uint8Array(nw * nh * 4), N2 = new Uint8Array(nw * nh * 4);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let k = 0; k < 4; k++) { const s = (yy, xx) => C[(Math.min(h - 1, yy) * w + Math.min(w - 1, xx)) * 4 + k], t = (yy, xx) => N[(Math.min(h - 1, yy) * w + Math.min(w - 1, xx)) * 4 + k];
        C2[(y * nw + x) * 4 + k] = (s(y * 2, x * 2) + s(y * 2, x * 2 + 1) + s(y * 2 + 1, x * 2) + s(y * 2 + 1, x * 2 + 1)) >> 2; N2[(y * nw + x) * 4 + k] = (t(y * 2, x * 2) + t(y * 2, x * 2 + 1) + t(y * 2 + 1, x * 2) + t(y * 2 + 1, x * 2 + 1)) >> 2; }
      outC.push({ data: C2, width: nw, height: nh }); outN.push({ data: N2, width: nw, height: nh }); C = C2; N = N2; w = nw; h = nh; }
    return { col: outC, nrm: outN, maxLod: lvl };
  }

  /* ── far off: a card for every tree, turned to the eye, its picture the side it is seen from ── */
  const VS = `
uniform vec4 uPr[MAXP];   /* each shape's square (S, its middle's height, where its cells start) */
uniform vec3 uNear;       /* within uNear.x of the eye the tree itself stands (its card fades in over uNear.y); uNear.z: the wind */
uniform float uTime; uniform vec4 uWindV;
attribute vec4 aP;        /* the foot of the tree (x, y, z), how big */
attribute vec4 aQ;        /* how it is turned, its shape, its tint, a die */
varying vec2 vUv; varying vec3 vK; varying float vTop, vNearK, vCell0, vYaw, vTint, vDie, vHide; varying vec3 vW;
void main(){
  vec4 P = uPr[int(aQ.y + 0.5)]; float S = P.x*aP.w;
  vec3 c = aP.xyz + vec3(0.0, P.y*aP.w, 0.0), toC = cameraPosition - c; float dist = length(toC); vec3 f = toC/max(dist, 1e-3);
  vec3 r = abs(f.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  /* (its top swaying a little on the wind) */
  vec2 wd = normalize(uWindV.xy + vec2(1e-4)); float sw = (sin(uTime*0.5 + aQ.w*31.0) + 0.4*sin(uTime*1.1 + aQ.w*17.0))*uWindV.z*0.012*S*(position.y + 0.5);
  vec3 wp = c + (r*position.x + u*position.y)*S + vec3(wd.x, 0.0, wd.y)*sw;
  float az = atan(toC.x, toC.z) - aQ.x, k = mod(az/(6.2831853/${VIEWS}.0), ${VIEWS}.0), k0 = floor(k);
  vK = vec3(k0, mod(k0 + 1.0, ${VIEWS}.0), k - k0);
  vTop = smoothstep(0.55, 1.15, asin(clamp(f.y, -1.0, 1.0)));
  /* (a forest tree's trunk, seen from above, is under its own crown and its neighbours': its picture's bark goes as the
     eye rises; an open-grown one's, a palm's on the beach, stays) */
  vHide = P.w*smoothstep(0.2, 0.46, f.y);
  vNearK = smoothstep(uNear.x, uNear.x + uNear.y, dist);
  vUv = position.xy + 0.5; vCell0 = P.z; vYaw = aQ.x; vTint = aQ.z; vDie = aQ.w; vW = wp;
  gl_Position = vNearK <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`;
  const FS = `
${OCT}
${GLSL.ISLE_SH}
uniform sampler2D uCol, uNrm; uniform vec4 uAt;   /* cells across, down; the margin as a share of a cell; a cell's texels */
uniform float uMaxLod;                             /* the smallest copy that still keeps the pictures apart */
uniform vec2 uCellUV;                              /* a cell's size in the atlas's own units */
uniform float uCovCut;                             /* how much of a pixel must be covered to be drawn (a half, unless the samples share it) */
uniform vec3 uAmbF, uKeyDirT, uKeyColT; uniform vec4 uFog; uniform vec3 uTintA, uTintB;
varying vec2 vUv; varying vec3 vK; varying float vTop, vNearK, vCell0, vYaw, vTint, vDie, vHide; varying vec3 vW;
vec2 cellUV(float ci, vec2 uv){ float cy = floor((ci + 0.5)/uAt.x), cx = ci - cy*uAt.x; return (vec2(cx, cy) + uAt.z + uv*(1.0 - 2.0*uAt.z))*uCellUV; }
void main(){
  /* (into the margin no picture reaches) */
  if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) discard;
  /* (fading in as the tree itself goes: a dither, so nothing is drawn half see-through) */
  if (vNearK < 1.0 && fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)))*43758.5453) > vNearK) discard;
  vec2 g = vUv*uAt.w; float lod = clamp(0.5*log2(max(dot(dFdx(g), dFdx(g)), dot(dFdy(g), dFdy(g)))), 0.0, uMaxLod);
  /* (the cells' numbers come through the card as it is drawn a hair off whole: rounded back, or a pixel here and there
     would read the next cell's picture) */
  float c0 = floor(vCell0 + 0.5), ka = floor(vK.x + 0.5), kb = floor(vK.y + 0.5);
  vec2 a = cellUV(c0 + ka, vUv), b = cellUV(c0 + kb, vUv), t = cellUV(c0 + ${VIEWS}.0, vUv);
  vec4 ca = textureLod(uCol, a, lod), cb = textureLod(uCol, b, lod), na = textureLod(uNrm, a, lod), nb = textureLod(uNrm, b, lod);
  vec4 C = mix(ca, cb, vK.z), N = mix(na, nb, vK.z);
  float cy = cos(vYaw), sy = sin(vYaw);
  /* (from above: the picture taken from above, turned as the tree is) */
  if (vTop > 0.0){ vec2 tu = vUv - 0.5; tu = vec2(tu.x*cy + tu.y*sy, -tu.x*sy + tu.y*cy) + 0.5; t = cellUV(c0 + ${VIEWS}.0, clamp(tu, 0.0, 1.0));
    C = mix(C, textureLod(uCol, t, lod), vTop); N = mix(N, textureLod(uNrm, t, lod), vTop); }
  /* (its edge soft over the samples of a pixel: the cover's own edge, sharpened to it) */
  float cov = clamp((C.a - 0.5)/max(fwidth(C.a), 1e-3) + 0.5, 0.0, 1.0);
  if (cov < uCovCut) discard;
  /* (each tree its own green, from yellower to bluer, lighter or darker; one in fifty in new leaf, bronze or pink, and
     now and then one in flower: on its leaves only, not its bark) */
  float leaf = N.a, die = vDie;
  if (vHide > 0.0 && vHide*(1.0 - smoothstep(0.25, 0.6, leaf)) > fract(sin(dot(gl_FragCoord.xy, vec2(39.346, 11.135)))*43758.5453)) discard;
  vec3 tint = mix(uTintA, uTintB, vTint)*mix(vec3(1.06, 1.02, 0.84), vec3(0.9, 1.0, 1.1), fract(die*7.31));
  if (die < 0.012) tint = vec3(1.25, 0.82, 0.5); else if (die < 0.02) tint = vec3(1.3, 0.75, 0.72); else if (die < 0.026) tint = vec3(1.6, 0.5, 0.25); else if (die < 0.031) tint = vec3(1.45, 1.25, 0.35);
  vec3 alb = C.rgb*C.rgb*mix(vec3(1.0), tint, leaf);
  vec3 n = octD(N.rg); float ao = N.b;
  n = vec3(n.x*cy + n.z*sy, n.y, -n.x*sy + n.z*cy);
  vec3 V = normalize(cameraPosition - vW), L = uKeyDirT; float ndl = dot(n, L);
  /* (the sun, or the moon, as much as gets past the island's hill and forest to this crown) */
  vec3 kC = uKeyColT*isleSh(vW.xz);
  vec3 c = alb*uAmbF*(0.42 + 0.58*clamp(n.y*0.5 + 0.5, 0.0, 1.0))*(0.22 + 0.78*ao);
  c += alb*kC*clamp((ndl + 0.2)/1.2, 0.0, 1.0)*mix(0.32, 1.0, ao);
  /* (light through the leaves at the crown's edge, looking toward the sun) */
  c += alb*vec3(1.08, 1.16, 0.42)*kC*clamp(-ndl, 0.0, 1.0)*pow(max(dot(-V, L), 0.0), 3.0)*0.35*ao*ao;
  c += alb*kC*vec3(0.8, 1.0, 0.55)*0.045*(0.4 + 0.6*ao);
  float d = distance(vW, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  c = mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
  gl_FragColor = vec4(c, cov);
  /* (as the leaves do: the renderer's own finish, which is nothing where the frame is drawn to a target, as the engine's is) */
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  /* the cards' material, for an atlas from bake() */
  function material(atlas, o = {}) {
    const MAXP = Math.max(4, atlas.info.length);
    const u = { uCol: { value: atlas.col }, uNrm: { value: atlas.nrm }, uAt: { value: new T.Vector4(atlas.cols, atlas.rows, atlas.pad / atlas.cell, atlas.cell) }, uMaxLod: { value: Math.max(0, Math.min(atlas.maxLod - 1, 4.5)) }, uCovCut: { value: o.a2c ? 0.02 : 0.5 }, uCellUV: { value: new T.Vector2(atlas.cell / atlas.W, atlas.cell / atlas.H) },
      uPr: { value: Array.from({ length: MAXP }, (_, i) => { const p = atlas.info[i]; return p ? new T.Vector4(p.S, p.cy, p.cell0, p.hide || 0) : new T.Vector4(); }) },
      uNear: { value: new T.Vector3(o.near ?? 0, o.fade ?? 8, 0) }, uTime: Mats.U.uTime, uWindV: { value: (typeof FloraLeaf !== 'undefined' && FloraLeaf.U.uWindV.value) || new T.Vector4(0.55, -0.83, 0.5, 0.5) },
      uAmbF: Mats.U.uAmbF, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uFog: Mats.U.uFog,
      uTintA: { value: new T.Vector3(...(o.tintA || [0.88, 0.9, 0.86])) }, uTintB: { value: new T.Vector3(...(o.tintB || [1.1, 1.06, 1.0])) }, ...Mats.shadeU() };
    if (typeof FloraLeaf !== 'undefined') u.uWindV = FloraLeaf.U.uWindV;
    return new T.ShaderMaterial({ uniforms: u, vertexShader: VS.replace('MAXP', String(MAXP)), fragmentShader: FS, side: T.DoubleSide, alphaToCoverage: o.a2c ?? false });
  }
  /* a set of trees as cards: list [{ x, y, z, s (size), yaw, p (shape), tint, die }] */
  const QUAD = (() => { const g = new T.PlaneGeometry(1, 1); return g; })();
  function cards(list, mat) {
    const n = list.length, g = new T.InstancedBufferGeometry(), aP = new Float32Array(n * 4), aQ = new Float32Array(n * 4);
    g.setIndex(QUAD.index); g.setAttribute('position', QUAD.attributes.position); g.setAttribute('uv', QUAD.attributes.uv);
    const ctr = new T.Vector3(); let rad = 0;
    list.forEach((t, i) => { aP.set([t.x, t.y, t.z, t.s], i * 4); aQ.set([t.yaw, t.p, t.tint ?? 0.5, t.die ?? Math.random()], i * 4); ctr.x += t.x / n; ctr.y += t.y / n; ctr.z += t.z / n; });
    for (const t of list) rad = Math.max(rad, Math.hypot(t.x - ctr.x, t.y - ctr.y, t.z - ctr.z) + 80 * t.s);
    g.setAttribute('aP', new T.InstancedBufferAttribute(aP, 4)); g.setAttribute('aQ', new T.InstancedBufferAttribute(aQ, 4)); g.instanceCount = n;
    g.boundingSphere = new T.Sphere(ctr, rad);
    const m = new T.Mesh(g, mat); return m;
  }
  return { bake, material, cards, VIEWS };
})();
