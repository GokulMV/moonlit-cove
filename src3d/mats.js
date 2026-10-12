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
    uVanInv: { value: new THREE.Matrix4() }, uHead: { value: V4() }, uHeadDir: { value: V3(1, 0, 0) }, uFireSh: { value: null }, uCanSh: { value: null }, uFireShM: { value: new THREE.Matrix4() }, uCanShM: { value: new THREE.Matrix4() }, uShOn: { value: 0 },
    uFog: { value: V4(0, 0, 0, 1) },
    uTorch: { value: V4() }, uTorchDir: { value: V3(0, 0, -1) }, uTorchSh: { value: null }, uTorchShM: { value: new THREE.Matrix4() }, uTorchShS: { value: new THREE.Vector2(1024, 1024) },
    /* the key light's shadow map, for shaders of our own that take shadows (the grown trees' leaves): the map, its matrix,
       where it is centred (x, z) and how far it reaches, whether it is ready; its size */
    uLeafShM: { value: null }, uLeafShX: { value: new THREE.Matrix4() }, uLeafShA: { value: V4() }, uLeafShS: { value: new THREE.Vector2(2048, 2048) }
  };
  /* the shoreline the shaders draw (glsl.js), kept up to date by the engine as the camera moves along the coast;
     shaders built without U take these on their own */
  const coastU = { uHeadL: { value: Array.from({ length: Layout.NGL }, () => V4(0, 1, 0, 0)) }, uCoast: { value: V4() }, uCoastP: { value: V4() }, uCoastQ: { value: V4() } };
  Object.assign(U, coastU);
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
  function patch(m, key) {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (key === 'land' ? '\nattribute float aRock; varying float vRock;' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + (key === 'land' ? '\n  vRock = aRock;' : ''))
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
      if (key === 'land') sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `${bump.replace('BUMPK', '0.08*vRock')}
  /* where it is bare rock, the boulders' relief, and the joints between its blocks */
  if (vRock > 0.02){ float rkD2 = distance(vWPos, cameraPosition);
    if (rkD2 < 90.0){ float nk = smoothstep(9.0, 3.0, rkD2), ck = smoothstep(16.0, 4.0, rkD2), cl = smoothstep(110.0, 12.0, rkD2); const float e = 0.008;
      #define RKL(p) (rkH(p, nk, ck) - 0.045*cl*rkCrack(p*0.35 + 7.0))
      float h0 = RKL(vWPos);
      vec3 g = vec3(RKL(vWPos + vec3(e, 0.0, 0.0)) - h0, RKL(vWPos + vec3(0.0, e, 0.0)) - h0, RKL(vWPos + vec3(0.0, 0.0, e)) - h0)/e;
      #undef RKL
      vec3 gv = mat3(viewMatrix)*(g*vRock*smoothstep(90.0, 20.0, rkD2));
      normal = normalize(normal - (gv - dot(gv, normal)*normal)); } }`);
      /* hills and headlands: rock on the steep and seaward parts, leaf litter and scrub elsewhere */
      if (key === 'land') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
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
    vec3 vegC = diffuseColor.rgb*(0.68 + 0.5*n1*n2 + 0.28*n3);
    diffuseColor.rgb = mix(vegC, rockC, vRock);
    float sea = smoothstep(5.0, -0.5, vWPos.z - shoreZc(vWPos.x));
    wetK = smoothstep(1.8, 0.1, vWPos.y)*sea*vRock;
    diffuseColor.rgb *= mix(1.0, 0.45, wetK);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.09, 0.04), smoothstep(0.35, 0.0, abs(vWPos.y - 0.15))*smoothstep(0.4, 0.7, vnz(vWPos*4.0))*sea*vRock*0.7);
  }`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, 0.35, wetK);`);
      /* the forest canopy seen from afar: clumps of leaves, light through the edges */
      if (key === 'canopy') sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { float a = vnz(vWPos*vec3(1.1, 1.6, 1.1)), b = vnz(vWPos*3.3 + 5.0), c = vnz(vWPos*9.0);
    diffuseColor.rgb *= 0.5 + 0.55*a + 0.35*b*c + 0.15*c; }`);
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
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec3 uKeyDirT, uKeyColT, uAmbF;\nuniform float uTime;\nuniform mat4 uVanInv;\n' + (key === 'land' ? 'varying float vRock;\n' : '') + PREFIX + (key === 'rockw' || key === 'land' ? ROCK : ''))
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
uniform float uTime;
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
    wp.xz += vec2(0.55, -0.83)*(sin(uTime*0.62 + ph) + 0.4*sin(uTime*1.37 + ph*1.7))*0.0016*hy*hy;
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
  return { U, coastU, lit, litP, tex, dataTex, cutoutDepth, foliage, V3, V4 };
})();
