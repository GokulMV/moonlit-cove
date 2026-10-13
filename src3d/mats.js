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
  Object.assign(U, coastU);
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
  c = mix(c, uFog.rgb*1.0, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))));
  return mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
}`;
  const PREFIX = GLSL.COMMON + GLSL.ART + FOG;
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
  function patch(m, key) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (key === 'land' || key === 'reef' ? '\nattribute float aRock; varying float vRock;' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + (key === 'land' || key === 'reef' ? '\n  vRock = aRock;' : ''))
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
  float sea = smoothstep(4.0, -0.5, vWPos.z - shoreZc(vWPos.x));
  float wetl = smoothstep(0.55 + 1.0*sea, 0.05, vWPos.y)*mix(0.3, 1.0, sea), weed = smoothstep(0.32, 0.0, abs(vWPos.y - 0.12))*smoothstep(0.35, 0.65, vnz(vWPos*5.0))*sea;
  diffuseColor.rgb *= mix(1.0, 0.42, wetl); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.09, 0.04), weed*0.7);`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, 0.5, smoothstep(0.55 + 1.0*smoothstep(4.0, -0.5, vWPos.z - shoreZc(vWPos.x)), 0.05, vWPos.y)*smoothstep(4.0, -0.5, vWPos.z - shoreZc(vWPos.x)));`)
        /* its relief, a few centimetres deep: the surface's own slope, worked out from the height of the stone round the point */
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { float rkD2 = distance(vWPos, cameraPosition), nk = smoothstep(9.0, 3.0, rkD2), ck = smoothstep(16.0, 4.0, rkD2); const float e = 0.006;
    float h0 = rkH(vWPos, nk, ck);
    vec3 g = vec3(rkH(vWPos + vec3(e, 0.0, 0.0), nk, ck) - h0, rkH(vWPos + vec3(0.0, e, 0.0), nk, ck) - h0, rkH(vWPos + vec3(0.0, 0.0, e), nk, ck) - h0)/e;
    vec3 gv = mat3(viewMatrix)*(g*smoothstep(70.0, 12.0, rkD2));
    normal = normalize(normal - (gv - dot(gv, normal)*normal)); }`);
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
  ${key === 'land' ? '{ vec3 gv = mat3(viewMatrix)*(cnGrad*(1.0 - vRock)); normal = normalize(normal - (gv - dot(gv, normal)*normal)); }' : ''}`);
      /* hills and headlands: rock on the steep and seaward parts, leaf litter and scrub elsewhere */
      if (key === 'land' || key === 'reef') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  float wetK = 0.0;
  { float n1 = vnz(vWPos*0.9), n2 = vnz(vWPos*3.7 + 2.0), n3 = vnz(vWPos*13.0);
    vec3 rockC = diffuseColor.rgb*(0.72 + 0.42*n2 + 0.16*n3 - 0.14*smoothstep(0.6, 0.85, vnz(vWPos*vec3(1.2, 4.0, 1.2))));
    float lich = smoothstep(0.64, 0.8, vnz(vWPos*1.7 + 9.0))*smoothstep(2.0, 4.0, vWPos.y);
    rockC = mix(rockC, vec3(0.5, 0.48, 0.38)*0.6, lich*0.35);
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
    ${key === 'land' ? 'cnAt(vWPos, 1.7, 3.0, 0.55, 0.9, 0.45);' : 'cnTint = vec3(0.66);'}
    vec3 vegC = diffuseColor.rgb*(0.68 + 0.5*n1*n2 + 0.28*n3)*cnTint*1.45;
    diffuseColor.rgb = mix(vegC, rockC, vRock);
    float sea = smoothstep(5.0, -0.5, vWPos.z - shoreZc(vWPos.x));
    wetK = smoothstep(${key === 'reef' ? '0.75, 0.0' : '1.8, 0.1'}, vWPos.y)*sea*vRock;
    diffuseColor.rgb *= mix(1.0, 0.45, wetK);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.09, 0.04), smoothstep(0.35, 0.0, abs(vWPos.y - 0.15))*smoothstep(0.4, 0.7, vnz(vWPos*4.0))*sea*vRock*0.7);
  }`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, ${key === 'reef' ? '0.62' : '0.35'}, wetK);`);
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
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uKeyDirT, uKeyColT, uAmbF;\nuniform float uTime;\nuniform mat4 uVanInv;\n' + (key === 'land' || key === 'reef' ? 'varying float vRock;\n' : '') + PREFIX + (key === 'rockw' || key === 'land' || key === 'reef' ? ROCK : '') + (key === 'canopy' || key === 'land' || key === 'reef' ? CANOPY : ''))
        .replace('#include <opaque_fragment>', `
  vec3 nW = normalize((vec4(normal, 0.0)*viewMatrix).xyz);
  outgoingLight += diffuseColor.rgb*artLight(vWPos, nW)*${key === 'log' ? '0.35' : '1.0'};
  ${key === 'frond' || key === 'leaf' ? 'outgoingLight += diffuseColor.rgb*uKeyColT*(max(-dot(nW, uKeyDirT), 0.0)*0.55 + 0.08);' : ''}
  ${key === 'canopy' ? 'outgoingLight += diffuseColor.rgb*uKeyColT*(max(-dot(nW, uKeyDirT), 0.0)*0.3 + 0.06);' : ''}
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
  float ndl = dot(n, uKeyDirT);
  vec3 L = uAmbF*(0.55 + 0.45*max(n.y, 0.0)) + uKeyColT*(max(ndl, 0.0) + 0.06);
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0 || (uHead.w > 0.001 && length(vWPos.xz - uHead.xz) < 34.0) || torchNear(vWPos)) L += artLight(vWPos, n);
  /* light through the leaflets from behind, yellower, strongest looking toward the sun; the waxy shine of their tops */
  float thru = max(-ndl, 0.0)*(0.3 + 0.7*pow(max(dot(-V, uKeyDirT), 0.0), 2.0));
  vec3 c = a*L + a*vec3(0.95, 1.08, 0.45)*uKeyColT*thru*0.85;
  c += uKeyColT*0.16*pow(max(dot(n, normalize(uKeyDirT + V)), 0.0), 36.0)*step(0.0, ndl);
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
  return { U, coastU, coastFill, lit, litP, tex, dataTex, cutoutDepth, foliage, V3, V4 };
})();
