/* ─────────────────────────────────────────────────────────────
   mats.js — shared uniforms + MeshStandardMaterial patched with
   the scene's artificial lights (string lights, lanterns, van, fire).
   ───────────────────────────────────────────────────────────── */
const Mats = (() => {
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), V4 = (x = 0, y = 0, z = 0, w = 0) => new THREE.Vector4(x, y, z, w);
  const U = {
    uPool: { value: null }, uPoolRect: { value: V4() },
    uLightK: { value: V4(0.08, 0.13, 0.11, 0.16) }, uLights: { value: V4(1, 1, 1, 1) },
    uFire: { value: V4(1, 0.5, 1, 1) }, uFirePos: { value: V3() },
    uLant: { value: [V4(), V4(), V4()] }, uVanPos: { value: V3() }, uVanDir: { value: V3(1, 0, 0) },
    uTime: { value: 0 }, uKeyDirT: { value: V3(0, 1, 0) }, uKeyColT: { value: V3() },
    /* the wind on the leaves and the grass: x how far they sway (1 a breeze; more, and gusting, as the weather turns), y how
       far they lean over and stay leaning on it (0 in a breeze); and how full the streams are after rain (0 low, 1 in
       spate) */
    uWindK: { value: new THREE.Vector2(1, 0) }, uFlood: { value: 0 },
    uVanInv: { value: new THREE.Matrix4() }, uHead: { value: V4() }, uHeadDir: { value: V3(1, 0, 0) }, uFireSh: { value: null }, uCanSh: { value: null }, uFireShM: { value: new THREE.Matrix4() }, uCanShM: { value: new THREE.Matrix4() }, uShOn: { value: 0 },
    uFog: { value: V4(0, 0, 0, 1) },
    uTorch: { value: V4() }, uTorchDir: { value: V3(0, 0, -1) }, uTorchSh: { value: null }, uTorchShM: { value: new THREE.Matrix4() }, uTorchShS: { value: new THREE.Vector2(1024, 1024) },
    /* the key light's shadow map, for shaders of our own that take shadows (the grown trees' leaves): the map, its matrix,
       where it is centred (x, z) and how far it reaches, whether it is ready; its size */
    uLeafShM: { value: null }, uLeafShX: { value: new THREE.Matrix4() }, uLeafShA: { value: V4() }, uLeafShS: { value: new THREE.Vector2(2048, 2048) }
  };
  /* the shoreline the shaders draw (glsl.js COAST): a strip of numbers along the coast round the camera, the shore's z,
     its slope and the forest edge's z (Layout's own), every half metre for two kilometres either way (row 0) and every
     four metres for sixteen (row 1). Each row is a ring: sample i sits at x = i·step, in column i mod N, so as the camera
     moves only the samples coming into reach are worked out, a few thousand a frame at most. Shaders built without U take
     these uniforms on their own; uTideZ is how far up the beach the tide has the water (Layout.tide) */
  const CT = { N: 4096, step: [0.5, 4] }, ctData = new Float32Array(CT.N * 2 * 4);
  const ctTex = new THREE.DataTexture(ctData, CT.N, 2, THREE.RGBAFormat, THREE.FloatType);
  ctTex.magFilter = ctTex.minFilter = THREE.NearestFilter; ctTex.generateMipmaps = false; ctTex.needsUpdate = true;
  const coastU = { uCoastT: { value: ctTex }, uCoastW: { value: V4(-1, 1, -8, 8) }, uTideZ: { value: 0 } };
  /* the island's shore, when there is one (glsl.js ISLE_GL; isleUp fills them in) */
  if (Layout.isle) Object.assign(coastU, { uIsF: { value: null }, uIsU: { value: null }, uIsL: { value: null }, uIsKC: { value: null }, uIsG: { value: V4() }, uIsD: { value: V4() }, uIsN: { value: V4() } });
  /* what the land and the forest shade from the key light, round the island (isle.js) or along the coast (world.js), as
     GLSL.ISLE_SH reads it: none until there is a map of it */
  Object.assign(coastU, { uIsSh: { value: null }, uIsShG: { value: V4() }, uIsShOn: { value: 0 }, uIsShL: { value: new THREE.Vector3(0, 1, 0) } });
  /* the uniforms a shader of its own needs to read that shade */
  const shadeU = () => ({ uIsSh: coastU.uIsSh, uIsShG: coastU.uIsShG, uIsShOn: coastU.uIsShOn, uIsShL: coastU.uIsShL });
  Object.assign(U, coastU);
  /* the island's shore as the shaders read it: island.js's grid and coastline, as textures */
  function isleUp(D) {
    const T = THREE, tx = (data, w, h, fmt, type, lin) => { const t = new T.DataTexture(data, w, h, fmt, type); t.minFilter = t.magFilter = lin ? T.LinearFilter : T.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.needsUpdate = true; return t; };
    coastU.uIsF.value = tx(D.field, D.nx, D.nz, T.RGBAFormat, T.HalfFloatType, true);
    coastU.uIsU.value = tx(D.u, D.nx, D.nz, T.RGFormat, T.FloatType, false);
    coastU.uIsL.value = tx(D.line, D.LW, D.rows * 2, T.RGBAFormat, T.HalfFloatType, false);
    /* (the shore's two planes one over the other, in one texture: glsl.js isK, isC) */
    const kc = new Uint8Array(D.nx * D.nz * 8); kc.set(D.k1, 0); kc.set(D.k2, D.nx * D.nz * 4);
    coastU.uIsKC.value = tx(kc, D.nx, D.nz * 2, T.RGBAFormat, T.UnsignedByteType, true);
    coastU.uIsG.value.set(D.X0, D.Z0, 1 / (D.cell * D.nx), 1 / (D.cell * D.nz));
    coastU.uIsD.value.set(D.nx, D.nz, D.cell, 1 / D.cell);
    coastU.uIsN.value.set(D.P, D.u0, D.n, 1 / D.ds);
  }
  const ctFill = [[0, 0], [0, 0]]; let ctVer = -1;
  function coastFill(camX, budget = 3000) {
    if (ctVer !== Layout.coastVer) { ctVer = Layout.coastVer; ctFill[0] = [0, 0]; ctFill[1] = [0, 0]; budget = Infinity; }
    let did = 0;
    const put = (row, i) => { const x = i * CT.step[row], k = ((((i % CT.N) + CT.N) % CT.N) + row * CT.N) * 4; ctData[k] = Layout.shoreMeanZ(x); ctData[k + 1] = Layout.shoreDZ(x); ctData[k + 2] = Layout.vegZ(x); ctData[k + 3] = 0; did++; };
    for (let row = 0; row < 2; row++) {
      const st = CT.step[row], c = Math.round(camX / st), half = CT.N / 2 - 4, w0 = c - half, w1 = c + half;
      let [f0, f1] = ctFill[row];
      if (f1 <= w0 || f0 >= w1 || f1 <= f0) f0 = f1 = c;      /* (nothing of the old reach is left: start again from the camera) */
      f0 = Math.max(f0, w0); f1 = Math.min(f1, w1);
      /* outward from what is there, toward the camera's side first */
      while ((f0 > w0 || f1 < w1) && did < budget) { if (f1 < w1 && (f1 - c <= c - f0 || f0 <= w0)) put(row, f1++); else if (f0 > w0) put(row, --f0); }
      ctFill[row] = [f0, f1];
    }
    const [a, b] = ctFill[0], [c2, d2] = ctFill[1];
    U.uCoastW.value.set(a * CT.step[0] + 0.5, (b - 2) * CT.step[0], c2 * CT.step[1] + 4, (d2 - 2) * CT.step[1]);
    if (did) ctTex.needsUpdate = true;
    return did;
  }
  /* aerial perspective, the same as the ground's: far things fade toward the horizon's colour */
  const FOG = `
uniform vec4 uFog;
vec3 fogIt(vec3 c, vec3 wp){
  float d = distance(wp, cameraPosition);
  c = mix(c, uFog.rgb*1.0, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  return mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
}`;
  const PREFIX = GLSL.COMMON + GLSL.ART + FOG;
  /* granite's crystals as they are up close: a mosaic of them a few millimetres across, interlocking, each one mineral —
     the black mica, the glassy grey quartz, the white feldspar and now and then the pink — read off the plane the surface
     faces most (cell, how far inside it from its edge) */
  const GRAN_XTL = `
/* (a hash that holds up however far from the origin: the cell wrapped first, a sine-free hash of it) */
vec2 gxH(vec2 p){ p = mod(p, 1024.0); vec3 q = fract(vec3(p.xyx)*vec3(0.1031, 0.103, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz)*q.zy); }
vec2 gXtl(vec3 w, vec3 n){
  vec3 a = abs(n); vec2 p = a.x > a.y && a.x > a.z ? w.yz : a.y > a.z ? w.xz : w.xy;
  vec2 g = floor(p), f = p - g; float d1 = 8.0, d2 = 8.0, h1 = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 o = vec2(float(i), float(j)), h = gxH(g + o), r = o + 0.1 + 0.8*h - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; h1 = h.x; } else if (d < d2) d2 = d;
  }
  return vec2(h1, sqrt(d2) - sqrt(d1));
}
`;
  /* a rough surface: three sizes of bumps, the finest a sandpaper grain (faded with distance, so it doesn't sparkle) */
  const bump = `
  #include <normal_fragment_maps>
  { vec3 bp = vWPos*1.9, bq = vWPos*7.3, br = vWPos*23.0; const float e = 0.07;
    float b0 = vnz(bp), c0 = vnz(bq), d0 = vnz(br), far = smoothstep(18.0, 6.0, distance(vWPos, cameraPosition));
    vec3 g = vec3(vnz(bp + vec3(e, 0.0, 0.0)) - b0, vnz(bp + vec3(0.0, e, 0.0)) - b0, vnz(bp + vec3(0.0, 0.0, e)) - b0)/e
           + 0.55*vec3(vnz(bq + vec3(e, 0.0, 0.0)) - c0, vnz(bq + vec3(0.0, e, 0.0)) - c0, vnz(bq + vec3(0.0, 0.0, e)) - c0)/e
           + 0.35*far*vec3(vnz(br + vec3(e, 0.0, 0.0)) - d0, vnz(br + vec3(0.0, e, 0.0)) - d0, vnz(br + vec3(0.0, 0.0, e)) - d0)/e;
    vec3 gv = mat3(viewMatrix)*g;
    normal = normalize(normal - BUMPK*(gv - dot(gv, normal)*normal)); }`;

  /* the stone's relief, in metres: broad swells, a ridged roughness, a fine grain up close, and its cracks (sharp
     grooves along where a noise crosses its middle) */
  const ROCK = `
/* (jagged, where a finer noise pushes the line about; and only here and there, coming and going along their length) */
float rkCrack(vec3 p){
  float w = 0.036*smoothstep(0.4, 0.7, vnz(p*0.8 + 3.0)); if (w < 0.002) return 0.0;
  return 1.0 - smoothstep(0.0, w, abs(vnz(p*vec3(1.5, 1.0, 1.5) + 21.0 + 0.35*(vnz(p*9.0) - 0.5)) - 0.5));
}
float rkH(vec3 p, float nk, float ck){
  float a = vnz(p*2.1), b = 1.0 - abs(2.0*vnz(p*5.7 + 3.0) - 1.0), c = vnz(p*15.0 + 7.0), d = vnz(p*41.0 + 1.0);
  return 0.026*a + 0.02*b*b + 0.014*c + 0.006*nk*d - 0.022*ck*rkCrack(p);
}`;
  /* the forest's floor up close (round the island): the fallen leaves themselves, layer on layer, each a leaf of its own
     shape, size, turn and colour (most of them brown, from tan to nearly black as they rot, some grey, a few orange or
     yellow, now and then a green one just down), its midrib, its edges curled and dark; the bare dark soil showing where
     none lies; a twig across them here and there. Worked out where each point lies (world x, z) in cells a leaf's size:
     only the leaves of the four cells nearest can reach a point */
  const LITTER = `
vec2 ltH2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p)*43758.5453); }
/* one layer of leaves in cells S across: the leaf over p, as (its colour's draw, its shade's, how far in from its
   edge, 1) or nothing (w = 0); rib: on its midrib */
vec4 ltLayer(vec2 p, float S, vec2 sd, out float rib){
  vec2 q = p/S + sd, g = floor(q), f = q - g, o = step(0.5, f) - 1.0; vec4 best = vec4(0.0); float bz = -1.0; rib = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++){
    vec2 c = g + o + vec2(float(i), float(j)), h = ltH2(c), h2 = ltH2(c + 17.31);
    float a = h2.x*6.2832, L = 0.4 + 0.32*h.y, Wd = L*(0.2 + 0.24*h2.y);
    vec2 d = q - (c + 0.25 + 0.5*h), u = vec2(cos(a), sin(a)); float x = dot(d, u), y = dot(d, vec2(-u.y, u.x)), t = x/L;
    if (abs(t) >= 1.0) continue;
    /* (widest a little behind its middle, drawn to a point at its tip, rounded to its stalk; some of them lobed, or
       broken, or eaten through) */
    float w = Wd*pow(1.0 - t*t, 0.62)*(1.0 - 0.3*t)*(1.0 - 0.18*step(0.8, h2.y)*abs(sin(t*9.0 + h.x*20.0)));
    float e = 1.0 - abs(y)/max(w, 1e-4); if (e <= 0.0) continue;
    float z = fract(h.x*7.13 + h2.y*3.7);
    if (z > bz){ bz = z; best = vec4(h.x, fract(h2.x*5.3 + h.y), e, 1.0); rib = (1.0 - smoothstep(0.0, 0.07, abs(y)/max(w, 1e-4)))*step(-0.85, t); }
  }
  return best;
}
vec3 ltCol(float r, float r2){
  vec3 c = r < 0.3 ? vec3(0.3, 0.2, 0.11) : r < 0.55 ? vec3(0.19, 0.115, 0.065) : r < 0.72 ? vec3(0.11, 0.07, 0.042) : r < 0.83 ? vec3(0.34, 0.17, 0.06) : r < 0.93 ? vec3(0.25, 0.23, 0.19) : r < 0.975 ? vec3(0.4, 0.31, 0.1) : vec3(0.17, 0.22, 0.07);
  return c*(0.78 + 0.44*r2);
}
/* the leaves over p: their colour, from the topmost layer that has one there (and the soil if none does) */
vec3 litterAt(vec2 p){
  float rb; vec4 A = ltLayer(p, 0.19, vec2(0.0), rb); vec3 c;
  if (A.w > 0.0) c = ltCol(A.x, A.y)*(0.62 + 0.38*smoothstep(0.0, 0.3, A.z))*(1.0 + 0.2*rb);
  else { vec4 B = ltLayer(p, 0.15, vec2(3.7, 1.9), rb);
    if (B.w > 0.0) c = ltCol(B.x, B.y)*(0.55 + 0.33*smoothstep(0.0, 0.3, B.z))*(1.0 + 0.15*rb);
    else { vec4 C = ltLayer(p, 0.27, vec2(8.1, 5.3), rb);
      c = C.w > 0.0 ? ltCol(C.x, C.y)*(0.45 + 0.27*smoothstep(0.0, 0.3, C.z)) : vec3(0.05, 0.038, 0.027); } }
  /* (a twig across them now and then: thin, dark, straight) */
  { vec2 q = p/0.9, g = floor(q), h = ltH2(g + 41.7), h2 = ltH2(g + 7.9); float a = h.x*6.2832; vec2 u = vec2(cos(a), sin(a)), d = q - g - 0.5;
    float x = dot(d, u), y = abs(dot(d, vec2(-u.y, u.x))), L = 0.15 + 0.3*h.y, wd = 0.008 + 0.012*h2.x;
    if (h2.y > 0.55 && abs(x) < L && y < wd) c = vec3(0.075, 0.052, 0.035)*(0.8 + 0.5*smoothstep(wd, 0.0, y)); }
  return c;
}`;
  /* the canopy's crowns, worked out where each point of it lies (world x, z): a Voronoi of crowns about 6 m across,
     big ones of 11 m standing up out of them here and there. cnAt sets the colour the point takes (its crown's own
     green and how deep in shade) and the slope of its dome (for the normal); far off, where a crown is only a few
     pixels across, the shading fades to its average so it never shimmers */
  const CANOPY = `
vec3 cnTint = vec3(1.0), cnGrad = vec3(0.0);
vec2 cnH2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p)*43758.5453); }
/* one size of crowns: the dome's height at p (0..1), how far into shade (past every crown's rim, or in the crease
   where one crown tucks under the next), and which crown. Each crown is a round dome of its own size; where two
   overlap the higher shows, so they meet along curves, never in straight lines. gr: the dome's slope, per metre */
vec4 cnLayer(vec2 p, float S, out vec2 gr){
  vec2 q = p/S, g = floor(q), f = q - g; float best = -1.0, second = -1.0, id = 0.0, R = 1.0; vec2 r1 = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 c = vec2(float(i), float(j)), h = cnH2(g + c), r = c + 0.1 + 0.8*h - f;
    float Ri = 0.5 + 0.38*fract(h.x*7.31 + h.y*3.1), hh = 1.0 - dot(r, r)/(Ri*Ri);
    if (hh > best){ second = best; best = hh; r1 = r; id = h.x + h.y*0.37; R = Ri; } else if (hh > second) second = hh;
  }
  gr = best > 0.0 ? r1*2.0/(R*R*S) : vec2(0.0);
  float gapK = smoothstep(0.1, -0.05, best), crease = smoothstep(0.16, 0.0, best - second)*step(0.0, second);
  return vec4(max(best, 0.0), max(gapK, 0.55*crease), fract(id*13.7), fract(id*3.1));
}
void cnAt(vec3 w, float S1, float S2, float H1, float H2, float gap){
  float fw = length(fwidth(w.xz)) + 1e-4;
  /* (too far off for a crown to show: its average, and nothing more to work out) */
  if (fw > 0.3*S1){ cnTint = vec3(0.64); cnGrad = vec3(0.0); return; }
  float kc = 1.0 - smoothstep(0.09, 0.3, fw/(S1*0.3));
  vec2 g1, g2, g3 = vec2(0.0); vec4 A = cnLayer(w.xz, S1, g1), B = cnLayer(w.xz + vec2(31.7, 17.3), S2, g2), Cl = vec4(0.0);
  if (kc > 0.0) Cl = cnLayer(w.xz + vec2(5.3, 71.9), S1*0.3, g3);
  /* (the big crowns stand over the small where theirs is higher, and only here and there) */
  float big = step(0.6, B.w)*step(A.x*H1, B.x*H2 + 0.3);
  vec4 C = big > 0.5 ? B : A; vec2 gr = big > 0.5 ? g2*H2 : g1*H1;
  /* each crown's green: from yellow-green through to a cool blue-green, lighter or darker; and over it its clumps of
     leaves, each a small dome of its own */
  vec3 tint = mix(vec3(1.12, 1.06, 0.72), vec3(0.84, 1.0, 1.18), C.z)*(0.72 + 0.56*C.w);
  tint *= (0.56 + 0.44*sqrt(C.x))*mix(1.0, 0.74 + 0.38*sqrt(Cl.x) - 0.28*Cl.y, kc*(1.0 - C.y))*(0.85 + 0.25*vnz(w*(5.3/S1)))*mix(1.0, gap, C.y);
  /* (fading to the average where a crown is only a few pixels across) */
  float k = 1.0 - smoothstep(0.09, 0.3, fw/S1);
  cnTint = mix(vec3(0.64), tint, k);
  cnGrad = (vec3(gr.x, 0.0, gr.y)*(1.0 - C.y) + vec3(g3.x, 0.0, g3.y)*H1*0.32*kc)*k;
}`;
  /* (three's own light loop, the directional light's colour taken down by the land's and the forest's shade where it falls) */
  const LFB_SH = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= isleShAt( vWPos );');
  function patch(m, key) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        /* (a vertex with no normal at all — where a model's surface folds to a point — would be lit as nothing, a black
           speck with black triangles round it: it is given one) */
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  if (dot(objectNormal, objectNormal) < 1e-12) objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (key === 'land' || key === 'reef' ? '\nattribute float aRock; varying float vRock;' : '') + (key === 'land' && Layout.isle ? '\nattribute float aCov, aMud, aPath; varying float vCov, vMud, vPath;' : '') + (key === 'gran' || key === 'granw' ? '\nattribute vec3 aDir; attribute vec4 aKr, aKs; varying vec3 vKDir; varying vec4 vKr, vKs; varying float vKsz;' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + (key === 'land' || key === 'reef' ? '\n  vRock = aRock;' : '') + (key === 'land' && Layout.isle ? '\n  vCov = aCov; vMud = aMud; vPath = aPath;' : '') + (key === 'gran' || key === 'granw' ? `
  vKDir = aDir; vKr = aKr; vKs = aKs;
  #ifdef USE_INSTANCING
    vKsz = aKs.y*length((modelMatrix*instanceMatrix)[0].xyz);
  #else
    vKsz = aKs.y*length(modelMatrix[0].xyz);
  #endif` : ''))
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vec4 wpp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wpp = instanceMatrix*wpp;
  #endif
  vWPos = (modelMatrix*wpp).xyz;`);
      if (key === 'rock') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb *= 0.72 + 0.42*vnz(vWPos*31.0) + 0.16*vnz(vWPos*97.0) - 0.1*smoothstep(0.6, 0.9, vnz(vWPos*13.0 + 4.0));`);
      /* sea rocks: blotched and iron-stained, speckled with their crystals up close, split by fine dark cracks, crusted
         with lichen high up out of the spray; dark and glossy where the waves keep them wet, a band of weed at the
         waterline */
      if (key === 'rockw') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float rkD = distance(vWPos, cameraPosition), rkN = smoothstep(12.0, 3.0, rkD), rkM = smoothstep(4.0, 1.2, rkD);
  diffuseColor.rgb *= 0.74 + 0.34*vnz(vWPos*6.0) + 0.16*vnz(vWPos*29.0) - 0.08*smoothstep(0.62, 0.9, vnz(vWPos*2.3 + 4.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.3, 0.96, 0.72), 0.55*smoothstep(0.6, 0.82, vnz(vWPos*1.7 + 13.0)));
  { float gr = vnz(vWPos*63.0 + 5.0), gs = vnz(vWPos*150.0);
    diffuseColor.rgb *= 1.0 + rkN*(0.28*smoothstep(0.7, 0.8, gr) - 0.32*smoothstep(0.3, 0.2, gr)) + rkM*(0.24*smoothstep(0.72, 0.8, gs) - 0.3*smoothstep(0.28, 0.2, gs)); }
  diffuseColor.rgb *= 1.0 - 0.5*rkCrack(vWPos)*smoothstep(22.0, 5.0, rkD);
  /* streaks where the rain runs down the faces */
  diffuseColor.rgb *= 1.0 - 0.14*smoothstep(0.55, 0.8, vnz(vec3(vWPos.x*9.0, vWPos.y*0.8, vWPos.z*9.0)));
  vec3 nWl = normalize((vec4(vNormal, 0.0)*viewMatrix).xyz);
  { float lg = smoothstep(0.65, 0.69, vnz(vWPos*3.9 + 2.0)*0.6 + vnz(vWPos*12.0)*0.4)*smoothstep(0.8, 1.8, vWPos.y)*smoothstep(0.1, 0.6, nWl.y);
    float lo = smoothstep(0.69, 0.73, vnz(vWPos*2.7 + 9.0)*0.6 + vnz(vWPos*9.0 + 4.0)*0.4)*smoothstep(1.3, 2.6, vWPos.y)*smoothstep(0.35, 0.8, nWl.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.31, 0.28)*(0.85 + 0.3*vnz(vWPos*40.0)), lg*0.4);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.37, 0.19, 0.05)*(0.8 + 0.4*vnz(vWPos*33.0)), lo*0.5); }
  float sea = smoothstep(4.0, -0.5, -shoreS(vWPos.xz));
  float wetl = smoothstep(0.55 + 1.0*sea, 0.05, vWPos.y)*mix(0.3, 1.0, sea), weed = smoothstep(0.32, 0.0, abs(vWPos.y - 0.12))*smoothstep(0.35, 0.65, vnz(vWPos*5.0))*sea;
  diffuseColor.rgb *= mix(1.0, 0.42, wetl); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.09, 0.04), weed*0.7);`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, 0.5, smoothstep(0.55 + 1.0*smoothstep(4.0, -0.5, -shoreS(vWPos.xz)), 0.05, vWPos.y)*smoothstep(4.0, -0.5, -shoreS(vWPos.xz)));`)
        /* its relief, a few centimetres deep: the surface's own slope, worked out from the height of the stone round the point */
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float rkD2 = distance(vWPos, cameraPosition), nk = smoothstep(9.0, 3.0, rkD2), ck = smoothstep(16.0, 4.0, rkD2); const float e = 0.006;
    float h0 = rkH(vWPos, nk, ck);
    vec3 g = vec3(rkH(vWPos + vec3(e, 0.0, 0.0), nk, ck) - h0, rkH(vWPos + vec3(0.0, e, 0.0), nk, ck) - h0, rkH(vWPos + vec3(0.0, 0.0, e), nk, ck) - h0)/e;
    vec3 gv = mat3(viewMatrix)*(g*smoothstep(70.0, 12.0, rkD2));
    normal = normalize(normal - (gv - dot(gv, normal)*normal)); }`);
      /* granite (models/rocks/granite.js; the island's boulders, stones.js): its crystals up close — black mica, pinkish
         feldspar, grey glassy quartz between — a gentle mottle further off, the dark streaks the rain runs down its steep
         faces; its grain's relief and a little of the stone's own swell, and its fine cracks. Its flutes, its spalled
         sheets and its pits are its shape's own, and darken its vertex colours. By the sea ('granw'), the sea's bands
         across it, level from stone to stone: high up the black lichen of the splash zone, below it the barnacles' pale
         crust, at the water the wet dark rock and its weed; glossy where the waves keep it wet */
      if (key === 'gran' || key === 'granw') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float gWet = 0.0, gFl = 0.0, gFlH = 0.0;
  /* the flutes: side by side round the stone a few tenths of a metre apart whatever its size (so a big one has many, a
     small one none), each a rounded groove with a sharp ridge between it and the next, wandering a little as it runs down
     from under the shoulder, deepest a little below it, gone toward the foot; fading out where they would be finer than
     the pixels. Their height (gFlH, m) bends the light (below), the water running down them darkens them */
  { vec3 dr = normalize(vKDir); float th = atan(dr.z, dr.x), off = atan(sin(th - vKr.y), cos(th - vKr.y));
    float nF = max(6.0, floor(6.2832*vKsz*1.12/mix(0.3, 0.46, fract(vKs.x*0.37)) + 0.5));
    /* (never even: their spacing wanders round the stone, some wide and some narrow, some deep and some hardly there,
       two now and then running into one) */
    float ph = th*nF*0.5 + vKr.x + vKs.w*sin(dr.y*3.1 + vKs.x) + 0.35*(vnz(dr*1.6 + vKs.x) - 0.5)*6.2832 + 2.4*(vnz(vec3(cos(th)*4.1 + vKs.x, sin(th)*4.1, dr.y*1.3)) - 0.5);
    float prof = pow(abs(sin(ph)), 1.4), each = smoothstep(0.25, 0.75, vnz(vec3(cos(th)*5.3 + vKs.x, sin(th)*5.3, dr.y*0.8 + 1.7)))*(0.55 + 0.45*vnz(vec3(cos(th)*2.6 + vKs.x, sin(th)*2.6, 0.7)));
    float env = smoothstep(vKr.z, vKr.z*0.55, abs(off))*smoothstep(vKr.w + 0.02, vKr.w - 0.3, dr.y)*smoothstep(-0.45, 0.15, dr.y)*step(0.01, vKr.z);
    float fph = nF*0.5*length(fwidth(dr))/max(length(dr.xz), 0.15);
    gFl = prof*each*env*smoothstep(0.65, 1.5, vKsz)*(1.0 - smoothstep(0.35, 0.9, fph));
    gFlH = -vKs.z*clamp(vKsz, 0.0, 2.2)*0.55*gFl;
    diffuseColor.rgb *= 1.0 - 0.2*gFl*(0.6 + 0.4*vnz(vWPos*vec3(3.0, 0.7, 3.0))); }
  { float gD = distance(vWPos, cameraPosition), gK = smoothstep(6.5, 1.2, gD), gK2 = smoothstep(60.0, 6.0, gD);
    vec3 gN = normalize((vec4(vNormal, 0.0)*viewMatrix).xyz);
    float n1 = vnz(vWPos*190.0), n2 = vnz(vWPos*120.0 + 7.3), n3 = vnz(vWPos*60.0 + 2.1), n4 = vnz(vWPos*150.0 + 3.7);
    /* (its crystals a little way off: the black mica in flecks, the feldspar pinkish, the quartz glassy grey-white —
       softly, as they blur together) */
    float mica = smoothstep(0.75, 0.81, n1), fel = smoothstep(0.5, 0.62, n2), qz = smoothstep(0.8, 0.86, n4);
    vec3 c = diffuseColor.rgb*mix(vec3(0.92, 0.92, 0.94), vec3(1.08, 1.03, 0.97), fel);
    c *= mix(1.0, 0.55, mica)*(1.0 + 0.22*qz); c *= 0.95 + 0.1*n3;
    float gK3 = smoothstep(2.6, 0.7, gD);
    diffuseColor.rgb = mix(diffuseColor.rgb*(0.97 + 0.06*n3), c, gK*(1.0 - gK3));
    /* (and right up close the crystals themselves, each its own) */
    if (gK3 > 0.0){
      /* (the feldspar and the quartz the bigger crystals, the mica small among them; weathered, so softly told apart) */
      vec2 xa = gXtl(vWPos*130.0, gN), xb = gXtl(vWPos*310.0 + 3.1, gN); float m = xa.x;
      vec3 mc = m < 0.38 ? vec3(0.87, 0.89, 0.92) : m < 0.86 ? vec3(1.07, 1.05, 1.0) : vec3(1.12, 0.98, 0.9);
      mc *= (0.95 + 0.1*fract(m*13.7))*(0.9 + 0.1*smoothstep(0.0, 0.1, xa.y));
      mc = mix(mc, vec3(0.34, 0.33, 0.33), step(xb.x, 0.12)*smoothstep(0.0, 0.07, xb.y)*0.85);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*mc, gK3);
    }
    diffuseColor.rgb *= mix(1.0, (0.93 + 0.14*vnz(vWPos*1.1 + 3.0))*(0.96 + 0.08*vnz(vWPos*3.7 + 8.0)), gK2);
    float st = smoothstep(0.6, 0.82, vnz(vec3(vWPos.x*5.0, vWPos.y*0.42, vWPos.z*5.0) + 11.0))*smoothstep(0.92, 0.4, abs(gN.y));
    diffuseColor.rgb *= 1.0 - 0.26*st;${key === 'granw' ? `
    /* (only on the stones the sea reaches: out in it, or by its edge; a stone back up the beach is dry granite) */
    float sea = smoothstep(3.0, -0.6, -shoreS(vWPos.xz)), y = vWPos.y + 0.1*(vnz(vWPos*vec3(1.3, 0.2, 1.3)) - 0.5), hw = 0.4 + 0.2*sea;
    float blk = smoothstep(hw - 0.04, hw + 0.08, y)*smoothstep(hw + 0.24 + 0.42*sea, hw + 0.08 + 0.16*sea, y)*sea*(0.4 + 0.6*smoothstep(0.3, 0.62, vnz(vWPos*2.6 + 2.0)));
    float bar = smoothstep(hw + 0.03, hw - 0.08, y)*smoothstep(-0.4, -0.08, y)*sea, low = smoothstep(0.02, -0.3, y)*sea;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.055, 0.052, 0.047)*(0.8 + 0.4*vnz(vWPos*23.0)), blk*0.62);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.35, 0.32)*(0.7 + 0.45*smoothstep(0.5, 0.8, vnz(vWPos*65.0 + 1.0))), bar*0.7);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*0.6*vec3(0.85, 1.0, 0.8), low*0.6);
    /* (wet where the waves wash it, up to a little over their reach) */
    gWet = smoothstep(0.3 + 0.28*sea, 0.0, y)*sea;
    diffuseColor.rgb *= mix(1.0, 0.58, gWet);` : ''} }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, 0.45, gWet);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float d = distance(vWPos, cameraPosition), k = smoothstep(6.0, 1.0, d), kk = smoothstep(35.0, 3.0, d); const float e = 0.004;
    #define GRH(p) (0.0012*k*vnz(p*120.0 + 7.3) + 0.0007*k*vnz(p*260.0) + 0.003*kk*vnz(p*8.0 + 1.0) + 0.0016*kk*vnz(p*21.0 + 4.0))
    float h0 = GRH(vWPos);
    vec3 g = vec3(GRH(vWPos + vec3(e, 0.0, 0.0)) - h0, GRH(vWPos + vec3(0.0, e, 0.0)) - h0, GRH(vWPos + vec3(0.0, 0.0, e)) - h0)/e;
    #undef GRH
    vec3 gv = mat3(viewMatrix)*g; normal = normalize(normal - (gv - dot(gv, normal)*normal)); }
  { vec3 sp = -vViewPosition, sX = dFdx(sp), sY = dFdy(sp), R1 = cross(sY, normal), R2 = cross(normal, sX);
    float det = dot(sX, R1); vec2 dH = vec2(dFdx(gFlH), dFdy(gFlH));
    vec3 nP = abs(det)*normal - sign(det)*(dH.x*R1 + dH.y*R2); if (dot(nP, nP) > 1e-26) normal = normalize(nP); }`);
      if (key === 'land' || key === 'reef') sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `${bump.replace('BUMPK', '0.08*vRock')}
  /* where it is bare rock, the boulders' relief, and the joints between its blocks */
  if (vRock > 0.02){ float rkD2 = distance(vWPos, cameraPosition);
    if (rkD2 < 90.0){ float nk = smoothstep(9.0, 3.0, rkD2), ck = smoothstep(16.0, 4.0, rkD2), cl = smoothstep(110.0, 12.0, rkD2); const float e = 0.008;
      #define RKL(p) (rkH(p, nk, ck) - 0.045*cl*rkCrack(p*0.35 + 7.0))
      float h0 = RKL(vWPos);
      vec3 g = vec3(RKL(vWPos + vec3(e, 0.0, 0.0)) - h0, RKL(vWPos + vec3(0.0, e, 0.0)) - h0, RKL(vWPos + vec3(0.0, 0.0, e)) - h0)/e;
      #undef RKL
      vec3 gv = mat3(viewMatrix)*(g*vRock*smoothstep(90.0, 20.0, rkD2));
      normal = normalize(normal - (gv - dot(gv, normal)*normal)); } }
  ${key === 'land' ? `{ vec3 gv = mat3(viewMatrix)*(cnGrad*(1.0 - vRock)${Layout.isle ? '*(1.0 - flN)' : ''}); normal = normalize(normal - (gv - dot(gv, normal)*normal)); }` : ''}`);
      /* hills and headlands: rock on the steep and seaward parts, leaf litter and scrub elsewhere */
      if (key === 'land' || key === 'reef') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float wetK = 0.0, flN = 0.0, mudPud = 0.0;
  { float n1 = vnz(vWPos*0.9), n2 = vnz(vWPos*3.7 + 2.0), n3 = vnz(vWPos*13.0);
    vec3 rockC = diffuseColor.rgb*(0.72 + 0.42*n2 + 0.16*n3 - 0.14*smoothstep(0.6, 0.85, vnz(vWPos*vec3(1.2, 4.0, 1.2))));
    float lich = smoothstep(0.64, 0.8, vnz(vWPos*1.7 + 9.0))*smoothstep(2.0, 4.0, vWPos.y);
    rockC = mix(rockC, vec3(0.5, 0.48, 0.38)*0.6, lich*0.35);${key === 'land' && Layout.isle ? `
    /* (round the island a bare face of granite in the forest is streaked black down its slope where the rain runs off it,
       a film of algae; green with moss and ferns in its hollows and along its joints) */
    { float inl = smoothstep(3.0, 16.0, -shoreS(vWPos.xz));
      float stk = smoothstep(0.5, 0.78, vnz(vec3(vWPos.x*0.55, vWPos.y*0.045, vWPos.z*0.55))*0.75 + vnz(vec3(vWPos.x*2.1, vWPos.y*0.12, vWPos.z*2.1))*0.25);
      rockC *= 1.0 - 0.5*stk*inl;
      float mos = smoothstep(0.58, 0.74, vnz(vWPos*0.33 + 4.0)*0.7 + vnz(vWPos*1.3)*0.3);
      rockC = mix(rockC, vec3(0.035, 0.05, 0.022)*(0.8 + 0.4*n3), mos*0.75*inl);
      /* (down by the sea, out of the forest's shade and its damp, the granite bare and pale, bleached by the sun and the
         salt, coarse sand lying in its hollows) */
      rockC *= mix(1.65, 1.0, inl);
      float snd = smoothstep(0.5, 0.66, vnz(vWPos*0.5 + 2.0)*0.6 + vnz(vWPos*1.9)*0.4)*(1.0 - inl)*smoothstep(3.5, 1.0, vWPos.y);
      rockC = mix(rockC, vec3(0.4, 0.37, 0.31)*(0.86 + 0.24*vnz(vWPos*41.0))*(0.9 + 0.2*n2), snd*0.85); }` : ''}
    /* the bare rock up close as the boulders are: its crystals' speckle, its cracks (and wider joints between the
       blocks, seen from further off), iron stains and crusts of lichen */
    if (vRock > 0.02){
      float rkD = distance(vWPos, cameraPosition), rkN = smoothstep(12.0, 3.0, rkD), gr = vnz(vWPos*63.0 + 5.0);
      rockC *= 1.0 + rkN*(0.26*smoothstep(0.7, 0.8, gr) - 0.3*smoothstep(0.3, 0.2, gr));
      float ck = rkCrack(vWPos)*smoothstep(22.0, 5.0, rkD) + 0.85*rkCrack(vWPos*0.35 + 7.0)*smoothstep(110.0, 12.0, rkD);
      rockC *= 1.0 - 0.45*min(1.0, ck);
      rockC = mix(rockC, rockC*vec3(1.3, 0.96, 0.72), 0.5*smoothstep(0.6, 0.82, vnz(vWPos*1.7 + 13.0)));
      vec3 nWr = normalize((vec4(vNormal, 0.0)*viewMatrix).xyz);
      float lg = smoothstep(0.67, 0.71, vnz(vWPos*3.9 + 2.0)*0.6 + vnz(vWPos*12.0)*0.4)*smoothstep(1.2, 2.5, vWPos.y)*smoothstep(0.15, 0.6, nWr.y);
      float lo = smoothstep(0.7, 0.74, vnz(vWPos*2.7 + 9.0)*0.6 + vnz(vWPos*9.0 + 4.0)*0.4)*smoothstep(1.8, 3.2, vWPos.y)*smoothstep(0.35, 0.8, nWr.y);
      rockC = mix(rockC, vec3(0.3, 0.29, 0.26)*(0.85 + 0.3*vnz(vWPos*40.0)), lg*0.3);
      rockC = mix(rockC, vec3(0.36, 0.19, 0.05)*(0.8 + 0.4*vnz(vWPos*33.0)), lo*0.45);
    }
    /* (under the trees and on the hills the ground is thick with shrubs and saplings, crown against crown, shade in
       between: from above it is no lawn) */
    ${key === 'land' ? 'cnAt(vWPos, 1.7, 3.0, 0.55, 0.9, 0.45);' : 'cnTint = vec3(0.66);'}${key === 'land' && Layout.isle ? `
    /* (but not on the mangroves' mud: bare, nothing growing on it but the trees. And the crowns are a thing seen from
       above: seen along the ground, at a glance, or from under the trees, or up a hill from below, the shrubs' domes
       would read as a cobbled street, so they fade away as the ground is seen more edge-on, or from no higher than it) */
    { float mudF = smoothstep(0.02, 0.2, vMud); cnTint = mix(cnTint, vec3(0.66), mudF); cnGrad *= 1.0 - mudF;
      vec3 nG = normalize((vec4(vNormal, 0.0)*viewMatrix).xyz), vG = normalize(cameraPosition - vWPos);
      float face = smoothstep(0.12, 0.45, dot(nG, vG))*smoothstep(8.0, 40.0, cameraPosition.y - vWPos.y); cnGrad *= face; cnTint = mix(vec3(0.66), cnTint, 0.3 + 0.7*face); }` : ''}
    vec3 vegC = diffuseColor.rgb*(0.68 + 0.5*n1*n2 + 0.28*n3)*cnTint*1.45;${key === 'land' && Layout.isle ? `
    /* (round the island, near the eye, the ground as it is underfoot: under the trees the forest's floor, its fallen
       leaves brown and grey, a seedling's green here and there, the light through the canopy in flecks; out in the open,
       at the forest's edge and in a clearing, grass and herbs) */
    { float fd = distance(vWPos, cameraPosition); flN = smoothstep(78.0, 26.0, fd)*(1.0 - vRock);
      if (flN > 0.0){
        float l1 = vnz(vWPos*0.45 + 3.0), l2 = vnz(vWPos*2.3), l3 = vnz(vWPos*9.0 + 1.0), l4 = vnz(vWPos*31.0);
        vec3 litter = mix(vec3(0.17, 0.115, 0.064), vec3(0.125, 0.1, 0.078), l2)*(0.62 + 0.42*l3 + 0.22*l4);
        litter = mix(litter, vec3(0.045, 0.07, 0.025)*(0.75 + 0.5*l4), smoothstep(0.58, 0.78, l1*0.6 + l3*0.4)*0.55);
        /* (up close, the leaves themselves; further off, where one is no more than a pixel or two, their average) */
        { vec3 nW = normalize((vec4(vNormal, 0.0)*viewMatrix).xyz);
          float fw = length(fwidth(vWPos.xz)), lk = (1.0 - smoothstep(0.01, 0.045, fw))*smoothstep(0.1, 0.5, vCov)*(1.0 - 0.75*vMud)*smoothstep(0.6, 0.82, nW.y);
          if (lk > 0.0) litter = mix(litter, litterAt(vWPos.xz)*(0.64 + 0.22*l3), lk); }
        float fleck = smoothstep(0.7, 0.78, vnz(vWPos*0.8 + 11.0)*0.65 + l3*0.35);
        float shade = mix(1.0, 0.42 + 0.75*fleck, smoothstep(0.1, 0.55, vCov));
        vec3 grass = mix(vec3(0.07, 0.1, 0.035), vec3(0.1, 0.105, 0.05), l2)*(0.72 + 0.4*l1 + 0.22*l4);
        vegC = mix(vegC, mix(grass, litter, smoothstep(0.1, 0.5, vCov))*shade, flN);
        /* (in the mangroves, their mud: grey-brown, wet, the leaves fallen on it, the light coming through in flecks) */
        vec3 mudC = mix(vec3(0.062, 0.054, 0.04), vec3(0.075, 0.06, 0.038), l2)*(0.72 + 0.36*l3 + 0.16*l4)*mix(1.0, 0.55 + 0.7*fleck, smoothstep(0.1, 0.55, vCov));
        /* (up close, the crabs' burrows in it, each a dark hole and round it the pellets of mud they have dug out, paler as
           they dry; and its hollows holding the last of the tide's water, dark and still, the sky in them) */
        { float mk = smoothstep(0.02, 0.2, vMud), nk = (1.0 - smoothstep(0.012, 0.05, length(fwidth(vWPos.xz))))*mk;
          if (nk > 0.0){
            vec2 q = vWPos.xz/0.32, g = floor(q), f = q - g, h = ltH2(g + 3.1); float dd = length(f - 0.2 - 0.6*h)*0.32, on = step(h.y, 0.26);
            float hole = on*(1.0 - smoothstep(0.009, 0.016, dd)), ring = on*smoothstep(0.016, 0.024, dd)*(1.0 - smoothstep(0.024, 0.06 + 0.02*h.x, dd))*step(0.45, ltH2(floor(vWPos.xz*90.0)).x);
            mudC = mix(mudC, vec3(0.01, 0.008, 0.006), hole*nk); mudC = mix(mudC, mudC*1.45 + vec3(0.01, 0.008, 0.004), ring*0.7*nk);
          }
          mudPud = mk*smoothstep(0.64, 0.7, vnz(vWPos*0.33 + 2.0)*0.7 + vnz(vWPos*1.4)*0.3);
          mudC = mix(mudC, mudC*0.55, mudPud); }
        vegC = mix(vegC, mudC, smoothstep(0.02, 0.2, vMud)*flN);
        /* (a trail's tread: red-brown earth trodden bare, roots across it, the forest's shade on it) */
        vec3 earth = mix(vec3(0.24, 0.125, 0.065), vec3(0.19, 0.115, 0.07), l2)*(0.82 + 0.22*l3 + 0.1*l4)*mix(1.0, 0.62 + 0.55*fleck, smoothstep(0.1, 0.55, vCov));
        /* (its edges ragged into the litter, a root across it now and then) */
        float pe = smoothstep(0.25, 0.75, vPath + 0.35*(l3 - 0.5) + 0.2*(l4 - 0.5)), root = smoothstep(0.86, 0.92, vnz(vec3(vWPos.x*0.8, 0.0, vWPos.z*0.8) + vec3(0.0, l2*0.5, 0.0)));
        vegC = mix(vegC, mix(earth, vec3(0.07, 0.05, 0.035), root*0.65), pe*flN);
      } }` : ''}
    diffuseColor.rgb = mix(vegC, rockC, vRock);
    float sea = smoothstep(5.0, -0.5, -shoreS(vWPos.xz));
    wetK = smoothstep(${key === 'reef' ? '0.75, 0.0' : '1.8, 0.1'}, vWPos.y)*sea*vRock;
    diffuseColor.rgb *= mix(1.0, 0.45, wetK);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.09, 0.04), smoothstep(0.35, 0.0, abs(vWPos.y - 0.15))*smoothstep(0.4, 0.7, vnz(vWPos*4.0))*sea*vRock*0.7);
  }`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, ${key === 'reef' ? '0.62' : '0.35'}, wetK);${key === 'land' && Layout.isle ? '\n  roughnessFactor *= mix(1.0, 0.6, smoothstep(0.02, 0.2, vMud)*flN)*mix(1.0, 0.12, mudPud*flN);' : ''}`);
      /* packed sand (the sand castles): its grain, a few tenths of a millimetre of relief in specks, lighter and darker */
      if (key === 'sandc') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb *= 0.95 + 0.07*vnz(vWPos*61.0) + 0.05*vnz(vWPos*173.0 + 5.0);`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float sdD = distance(vWPos, cameraPosition), nk = smoothstep(3.5, 0.8, sdD), mk = smoothstep(16.0, 2.5, sdD); const float e = 0.0035;
    #define SDH(p) (0.0022*vnz(p*14.0 + 7.0) + 0.0016*vnz(p*41.0) + 0.0007*nk*vnz(p*127.0 + 3.0))
    float h0 = SDH(vWPos);
    vec3 g = vec3(SDH(vWPos + vec3(e, 0.0, 0.0)) - h0, SDH(vWPos + vec3(0.0, e, 0.0)) - h0, SDH(vWPos + vec3(0.0, 0.0, e)) - h0)/e;
    #undef SDH
    vec3 gv = mat3(viewMatrix)*(g*mk);
    normal = normalize(normal - (gv - dot(gv, normal)*normal)); }`);
      /* the forest canopy seen from afar: the crowns of the trees packed edge to edge (CANOPY), each a dome of leaves of
         its own green, lit on its sunny side, clumps of leaves over it, the gaps between them in deep shade; light
         through the edges */
      if (key === 'canopy') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  cnAt(vWPos, 6.2, 11.5, 2.6, 4.2, 0.3); diffuseColor.rgb *= cnTint;`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { vec3 gv = mat3(viewMatrix)*cnGrad; normal = normalize(normal - (gv - dot(gv, normal)*normal)); }`);
      if (key === 'van') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { /* two-tone paint split at the belt line, a thin bright trim, dark wheel wells and underside */
    vec3 lp = (uVanInv*vec4(vWPos, 1.0)).xyz;
    float bl = 1.06 - 0.3*clamp(1.0 - abs(lp.z)/0.6, 0.0, 1.0)*smoothstep(2.0, 2.2, lp.x);
    /* measured on the body itself, so the paint stays put when the van pitches, rolls and bounces */
    float tl = smoothstep(bl - 0.004, bl + 0.004, lp.y);
    diffuseColor.rgb = mix(vec3(0.105, 0.30, 0.27), vec3(0.80, 0.75, 0.62), tl);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75), 1.0 - smoothstep(0.008, 0.016, abs(lp.y - bl)));
    vec3 nw = normalize((vec4(vNormal, 0.0)*viewMatrix).xyz), nl = normalize(mat3(uVanInv)*nw);
    diffuseColor.rgb *= mix(1.0, 0.12, smoothstep(-0.2, -0.6, nl.y)*step(lp.y, 0.95));
    diffuseColor.rgb *= mix(0.82, 1.0, smoothstep(0.25, 0.6, lp.y));
  }`);
      /* (the key light, the sun or the moon, only as much of it as gets past the land and the forest toward it to here) */
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', LFB_SH);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uKeyDirT, uKeyColT, uAmbF;\nuniform float uTime;\nuniform mat4 uVanInv;\n' + (key === 'land' || key === 'reef' ? 'varying float vRock;\n' : '') + (key === 'land' && Layout.isle ? 'varying float vCov, vMud, vPath;\n' : '') + (key === 'gran' || key === 'granw' ? 'varying vec3 vKDir; varying vec4 vKr, vKs; varying float vKsz;\n' + GRAN_XTL : '') + PREFIX + (key === 'rockw' || key === 'land' || key === 'reef' ? ROCK : '') + (key === 'canopy' || key === 'land' || key === 'reef' ? CANOPY : '') + ((key === 'land' || key === 'trail') && Layout.isle ? LITTER : ''))
        .replace('#include <opaque_fragment>', `
  vec3 nW = normalize((vec4(normal, 0.0)*viewMatrix).xyz);
  outgoingLight += diffuseColor.rgb*artLight(vWPos, nW)*${key === 'log' ? '0.35' : '1.0'};
  ${key === 'frond' || key === 'leaf' ? 'outgoingLight += diffuseColor.rgb*uKeyColT*isleShAt(vWPos)*(max(-dot(nW, uKeyDirT), 0.0)*0.55 + 0.08);' : ''}
  ${key === 'canopy' ? 'outgoingLight += diffuseColor.rgb*uKeyColT*isleShAt(vWPos)*(max(-dot(nW, uKeyDirT), 0.0)*0.3 + 0.06);' : ''}
  ${key === 'log' ? `{ /* charred wood: a network of glowing cracks, hottest low in the middle of the fire; ash on top */
    vec3 rel = vWPos - uFirePos; float hd = length(rel.xz);
    float heat = smoothstep(0.36, 0.02, hd)*smoothstep(0.26, 0.0, rel.y);
    float n1 = vnz(vWPos*24.0 + vec3(0.0, -uTime*0.05, 0.0)), n2 = vnz(vWPos*67.0 + 3.1), n3 = vnz(vWPos*47.0 + 7.7);
    float cracks = max(1.0 - smoothstep(0.0, 0.05, abs(n1 - 0.5)), 1.0 - smoothstep(0.0, 0.04, abs(n3 - 0.5)))*(0.4 + 0.6*n2);
    float pulse = 0.72 + 0.28*sin(uTime*1.3 + n1*13.0);
    float ash = smoothstep(0.2, 0.8, nW.y)*smoothstep(0.55, 0.15, hd)*(0.35 + 0.4*n2);
    outgoingLight = mix(outgoingLight*0.6, vec3(0.05, 0.048, 0.045)*(uAmbF*2.0 + uKeyColT*0.6) + outgoingLight*0.4, ash);
    outgoingLight += vec3(1.0, 0.22, 0.035)*heat*(0.04 + 0.8*cracks*cracks)*pulse*uFire.x*0.24; }` : ''}
  ${key === 'pot' ? `outgoingLight += C_FIRE*uFire.x*(0.8 + 0.3*uFire.y)*0.045*pow(1.0 - abs(dot(nW, normalize(cameraPosition - vWPos))), 2.5);` : ''}
  outgoingLight = fogIt(outgoingLight, vWPos);
  /* (never a colour that is not one — a specular gone to infinity on a creature's wet eye, a normal of nothing: such a
     pixel blooms into a white blot round a black hole) */
  if (!(outgoingLight.r >= 0.0 && outgoingLight.g >= 0.0 && outgoingLight.b >= 0.0 && outgoingLight.r < 1e4 && outgoingLight.g < 1e4 && outgoingLight.b < 1e4)) outgoingLight = vec3(0.0);
  #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'art-' + (key || '');
    return m;
  }
  const lit = (p = {}, key) => patch(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, p)), key);
  const litP = (p = {}, key) => patch(new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 }, p)), key);

  function tex(canvas, { repeat = false, aniso = 4, srgb = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    return t;
  }
  function dataTex(data, w, h, { repeat = false, mip = true, srgb = false } = {}) {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.generateMipmaps = mip; t.anisotropy = 1;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }
  /* depth material that respects alpha cut-outs (palm fronds, leaf cards) */
  function cutoutDepth(map, alphaTest = 0.45) {
    return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
  }
  /* lightweight foliage shader: lambert + moon translucency + camp lights, alpha cut-out, no shadow receive */
  const FOL_VS = `
uniform float uTime; uniform vec2 uWindK;
varying vec2 vUv; varying vec3 vN; varying vec3 vWPos; varying vec3 vTint;
void main(){
  vUv = uv;
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #else
    vTint = vec3(1.0);
  #endif
  vec4 p = vec4(position, 1.0); vec3 n = normal;
  #ifdef SWAY
    float hy = max(position.y, 0.0);
  #endif
  #ifdef USE_INSTANCING
    p = instanceMatrix*p; n = mat3(instanceMatrix)*n;
  #endif
  vec4 wp = modelMatrix*p;
  #ifdef SWAY
    /* a slow breeze: crowns lean and come back, each tree a little out of step */
    float ph = wp.x*0.21 + wp.z*0.17 - hy*0.05;
    wp.xz += vec2(0.55, -0.83)*((sin(uTime*0.62 + ph) + 0.4*sin(uTime*1.37 + ph*1.7))*uWindK.x + uWindK.y)*0.0016*hy*hy;
  #endif
  vWPos = wp.xyz;
  vN = normalize(mat3(modelMatrix)*n);
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
  const FOL_FS = `
${GLSL.COMMON}
${GLSL.ART}
${FOG}
uniform sampler2D map; uniform vec3 uAmbF, uKeyDirT, uKeyColT, uTint; uniform float uCut;
varying vec2 vUv; varying vec3 vN; varying vec3 vWPos; varying vec3 vTint;
void main(){
  vec4 tx = texture2D(map, vUv);
  if (tx.a < uCut) discard;
  vec3 a = tx.rgb*uTint*vTint;
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), V = normalize(cameraPosition - vWPos);
  /* (the key light as much of it as gets past the land and the forest toward it) */
  float ndl = dot(n, uKeyDirT); vec3 kc = uKeyColT*isleShAt(vWPos);
  vec3 L = uAmbF*(0.55 + 0.45*max(n.y, 0.0)) + kc*(max(ndl, 0.0) + 0.06);
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0 || (uHead.w > 0.001 && length(vWPos.xz - uHead.xz) < 34.0) || torchNear(vWPos)) L += artLight(vWPos, n);
  /* light through the leaflets from behind, yellower, strongest looking toward the sun; the waxy shine of their tops */
  float thru = max(-ndl, 0.0)*(0.3 + 0.7*pow(max(dot(-V, uKeyDirT), 0.0), 2.0));
  vec3 c = a*L + a*vec3(0.95, 1.08, 0.45)*kc*thru*0.85;
  c += kc*0.16*pow(max(dot(n, normalize(uKeyDirT + V)), 0.0), 36.0)*step(0.0, ndl);
  gl_FragColor = vec4(fogIt(c, vWPos), 1.0);
}`;
  U.uAmbF = { value: V3() };
  function foliage(map, cut = 0.45, tint = [1, 1, 1], sway = false) {
    map.anisotropy = 1;
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U, { map: { value: map }, uCut: { value: cut }, uTint: { value: V3(...tint) } }),
      vertexShader: FOL_VS, fragmentShader: FOL_FS, side: THREE.DoubleSide, defines: sway ? { SWAY: 1 } : {}
    });
    return m;
  }
  return { U, coastU, shadeU, coastFill, isleUp, lit, litP, tex, dataTex, cutoutDepth, foliage, V3, V4 };
})();
