/* ─────────────────────────────────────────────────────────────
   glsl.js — shader sources: sky dome, sand+sea ground, shared
   artificial lighting, post (bloom + filmic finish).
   ───────────────────────────────────────────────────────────── */
const GLSL = (() => {
  /* the clicked swells and the splash rings (clicks, fish, spray) are read from a small data texture, one row each, as
     many as there are: these are only how far a shader looks along a row (more than anyone clicks in a minute) */
  const MAXUW = 128, MAXRIP = 128;
  const f = n => (Math.round(n * 1e5) / 1e5).toFixed(5);
  const SH = Layout.SH, VG = Layout.VG, WIN = Layout.WIN, NH = Layout.NGL;
  /* the shoreline in GLSL: the same curve as Layout's, drawn from uniforms the engine keeps up to date as the camera
     moves (Layout.coastGL): the headlands nearest the camera, and the waves' phases at a reference x near it, so
     everything is measured from there and the GPU's single floats stay exact however far along the coast it is.
     The coast itself goes into a shader once, whichever pieces include it; names gives each piece its own entry
     points (sx, the piece's old suffix, is no longer needed). */
  const g9 = n => n.toPrecision(9);
  const COAST = `
#ifndef COAST_FN
#define COAST_FN
uniform vec4 uHeadL[${NH}];   /* headlands in order along the coast: point (from uCoast.x), half-width, how far it juts out, 1/half-width */
uniform vec4 uCoast;         /* reference x, its distance along from the camp's bay, the shore's and the forest edge's base z */
uniform vec4 uCoastP, uCoastQ;   /* the waves' phases at the reference */
/* (a headland's shape reaches six half-widths; past the first one beyond reach, the rest are too: they are 110 m apart or more) */
float coastHead(float xl){ float h = 0.0;
  for (int i = 0; i < ${NH}; i++){ vec4 H = uHeadL[i]; float u = (xl - H.x)*H.w; if (u < -6.0) break; if (u < 6.0) h += H.z*exp(-u*u); }
  return h; }
float coastHeadD(float xl){ float r = 0.0;
  for (int i = 0; i < ${NH}; i++){ vec4 H = uHeadL[i]; float u = (xl - H.x)*H.w; if (u < -6.0) break; if (u < 6.0) r -= 2.0*H.z*u*H.w*exp(-u*u); }
  return r; }
/* the slow waves, which leave the camp's bay alone */
float coastWin(float xl){ return smoothstep(${g9(WIN.r0)}, ${g9(WIN.r1)}, abs(xl + uCoast.y)); }
float coastWinD(float xl){ float a = xl + uCoast.y, t = clamp((abs(a) - ${g9(WIN.r0)})/${g9(WIN.r1 - WIN.r0)}, 0.0, 1.0); return sign(a)*6.0*t*(1.0 - t)/${g9(WIN.r1 - WIN.r0)}; }
float coastSlow(float xl){ return ${g9(SH.a3)}*sin(xl*${g9(SH.f3)} + uCoastQ.y) + ${g9(SH.a4)}*sin(xl*${g9(SH.f4)} + uCoastQ.z) + ${g9(SH.a5)}*sin(xl*${g9(SH.f5)} + uCoastQ.w); }
float coastSlowD(float xl){ return ${g9(SH.a3 * SH.f3)}*cos(xl*${g9(SH.f3)} + uCoastQ.y) + ${g9(SH.a4 * SH.f4)}*cos(xl*${g9(SH.f4)} + uCoastQ.z) + ${g9(SH.a5 * SH.f5)}*cos(xl*${g9(SH.f5)} + uCoastQ.w); }
float coastZ(float x){ float xl = x - uCoast.x;
  return uCoast.z + ${g9(SH.a1)}*sin(xl*${g9(SH.f1)} + uCoastP.x) + ${g9(SH.a2)}*sin(xl*${g9(SH.f2)} + uCoastP.y) + ${g9(SH.tl)}*sin(xl*${g9(SH.kt)} + uCoastP.z) + coastWin(xl)*coastSlow(xl) - coastHead(xl); }
float coastDZ(float x){ float xl = x - uCoast.x;
  return ${g9(SH.a1 * SH.f1)}*cos(xl*${g9(SH.f1)} + uCoastP.x) + ${g9(SH.a2 * SH.f2)}*cos(xl*${g9(SH.f2)} + uCoastP.y) + ${g9(SH.tilt)}*cos(xl*${g9(SH.kt)} + uCoastP.z)
       + coastWinD(xl)*coastSlow(xl) + coastWin(xl)*coastSlowD(xl) - coastHeadD(xl); }
float coastVeg(float x){ float xl = x - uCoast.x;
  return uCoast.w + ${g9(VG.a1)}*sin(xl*${g9(VG.f1)} + uCoastP.w) + ${g9(VG.a2)}*sin(xl*${g9(VG.f2)} + uCoastQ.x) + ${g9(VG.tl)}*sin(xl*${g9(SH.kt)} + uCoastP.z) + ${g9(VG.x)}*coastWin(xl)*coastSlow(xl) - 0.55*coastHead(xl); }
#endif
`;
  function shoreGL(sx, names) {
    let o = COAST;
    o += `float ${names.z}(float x){ return coastZ(x); }\n`;
    if (names.dz) o += `float ${names.dz}(float x){ return coastDZ(x); }\n`;
    if (names.veg) o += `float ${names.veg}(float x){ return coastVeg(x); }\n`;
    return o;
  }

  const COMMON = `
float hash11(float n){ return fract(sin(n*127.1+0.31)*43758.5453); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
const vec3 C_BULB = vec3(1.0, 0.60, 0.27);
const vec3 C_LANT = vec3(1.0, 0.52, 0.20);
const vec3 C_VAN  = vec3(1.0, 0.66, 0.36);
const vec3 C_FIRE = vec3(1.0, 0.42, 0.11);
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }
float vnz(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
/* the shoreline, for anything that needs to know how near the water it is */
${shoreGL('c', { head: 'headc', z: 'shoreZc' })}
`;

  /* sky radiance in a direction (no stars, no discs) */
  const SKY_FN = `
uniform vec3 uZen, uHor, uGlow, uSunDirV, uMoonDirV, uMoonDisc, uSunDisc;
vec3 skyColor(vec3 d){
  float e = d.y, eu = max(e, 0.0);
  vec3 c = mix(uHor, uZen, pow(smoothstep(0.0, 0.5, eu), 0.6));
  vec2 hs = normalize(uSunDirV.xz + vec2(1e-5)), hd = normalize(d.xz + vec2(1e-5));
  float az = max(dot(hd, hs), 0.0);
  c += uGlow*(pow(az, 5.0)*exp(-eu*11.0) + 0.2*exp(-eu*5.0));
  float cm = max(dot(d, uMoonDirV), 0.0);
  c += uMoonDisc*(pow(cm, 1500.0)*0.3 + pow(cm, 160.0)*0.05 + pow(cm, 14.0)*0.012);
  float cs = max(dot(d, uSunDirV), 0.0);
  c += uSunDisc*(pow(cs, 1200.0)*0.05 + pow(cs, 90.0)*0.005 + pow(cs, 8.0)*0.0012);
  return c;
}`;

  const SKY_VS = `
varying vec3 vDir;
void main(){
  vec4 wp = modelMatrix*vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix*viewMatrix*wp;
  gl_Position.z = gl_Position.w*0.99999;
}`;

  /* a sharper look-up of a smaller buffer than bilinear: Catmull-Rom in nine bilinear taps (MJP's, MIT) */
  const CATMULL = `
vec4 catmullRom(sampler2D tex, vec2 uv){
  vec2 sz = vec2(textureSize(tex, 0)), sp = uv*sz, t1 = floor(sp - 0.5) + 0.5, f = sp - t1;
  vec2 w0 = f*(-0.5 + f*(1.0 - 0.5*f)), w1 = 1.0 + f*f*(-2.5 + 1.5*f), w2 = f*(0.5 + f*(2.0 - 1.5*f)), w3 = f*f*(-0.5 + 0.5*f);
  vec2 w12 = w1 + w2, t12 = (t1 + w2/w12)/sz, t0 = (t1 - 1.0)/sz, t3 = (t1 + 2.0)/sz;
  return (texture(tex, vec2(t0.x, t0.y))*w0.x + texture(tex, vec2(t12.x, t0.y))*w12.x + texture(tex, vec2(t3.x, t0.y))*w3.x)*w0.y
       + (texture(tex, vec2(t0.x, t12.y))*w0.x + texture(tex, vec2(t12.x, t12.y))*w12.x + texture(tex, vec2(t3.x, t12.y))*w3.x)*w12.y
       + (texture(tex, vec2(t0.x, t3.y))*w0.x + texture(tex, vec2(t12.x, t3.y))*w12.x + texture(tex, vec2(t3.x, t3.y))*w3.x)*w3.y;
}`;

  /* the cumulus layer, shared by the sky (for its reflection) and the cloud pass (for the view) */
  const CLOUD_FN = `
/* ── a real layer of cloud, 1.5 to 4 km up (taller in a storm), marched along each ray. The way it is built follows
   Schneider's "Real-time Volumetric Cloudscapes of Horizon Zero Dawn" (2015) as takram's three-clouds (MIT) writes it:
   a weather map says where cells of cumulus may grow and how tall; each is rounded toward its top over a flat base;
   billowy Perlin-Worley noise carves its body and finer Worley noise eats its edges (heaped cauliflower above, wisps
   below). Light reaches into it through its own thickness, scattered many times over (Wrenninge's octaves), and the
   sky lights it from above; far off, it sinks into the haze over the curve of the earth ── */
uniform highp sampler3D uShape, uDetail;   /* Perlin-Worley billows 128³ and Worley detail 32³ (cloudnoise.js) */
uniform sampler2D uWeather;                /* r cells of cumulus, g how tall each may grow, b broad patches */
uniform vec3 uLdM;                         /* the light's true direction, for how it reaches into the cloud */
uniform float uPxA;                        /* the angle one pixel of the march covers (for choosing noise detail) */
/* how far the clouds have drifted on the wind (x, z) and their billows risen (y), as the engine keeps count: once for
   each texture, each wrapped to that texture's own repeat, so the numbers stay small and exact however long it runs */
uniform vec2 uDriftW; uniform vec3 uDriftS, uDriftT;
const float RE = 6.371e6, WT = 36000.0, SHR = 1.0/3300.0, DTR = 1.0/340.0, DS = 0.1;
/* how far along a ray rising at dy from height h0 it meets the shell at height H */
float shellT(float h0, float dy, float H){ float b = (RE + h0)*dy, c = (H - h0)*(2.0*RE + H + h0), s = sqrt(b*b + c); return b >= 0.0 ? c/(b + s) : s - b; }
float hgP(float c, float g){ float g2 = g*g; return (1.0 - g2)/pow(max(1.0 + g2 - 2.0*g*c, 1e-4), 1.5); }
float remapC(float x, float a, float b){ return clamp((x - a)/(b - a), 0.0, 1.0); }
/* how much of the sky can cloud over: a few fair-weather heaps at the low end, a full deck in rain */
float cloudCover(){ return clamp(max(max(0.08 + 0.24*uCumulus, 1.05*uStratus), 0.9*uStorm), 0.0, 1.0); }
vec4 cloudWeather(vec2 P, float lod){ return textureLod(uWeather, (P - uDriftW)*(1.0/WT), lod); }
/* where the weather lets cloud grow at hf of the way up the layer, and how much (before the noise carves it); h is the
   height within that cloud's own column */
float cloudRoom(vec4 w, float hf, float cv, out float h){
  /* each cloud's own top: low heaps where little grows, towers where more does; a deck in rain; a storm's towers reach the top */
  float topK = mix(0.3, 1.0, w.g*w.g*(0.25 + 0.75*cv));
  topK = mix(topK, 0.62, uStratus*(1.0 - uStorm));
  topK = mix(topK, 1.0, uStorm*smoothstep(0.3, 0.7, w.g));
  h = hf/topK;
  if (h >= 1.0) return 0.0;
  /* widest low down, rounded toward the top; a storm's tallest towers spread into an anvil */
  float x = clamp(pow(h, 0.35)*2.0 - 1.0, -1.0, 1.0), hs = 1.0 - x*x;
  hs = max(hs, uStorm*smoothstep(0.5, 0.9, w.g)*smoothstep(0.78, 0.9, h)*(1.0 - smoothstep(0.95, 1.0, h))*1.2);
  float f = 1.0 - cv*mix(0.75, 1.2, w.b)*hs;
  return remapC(mix(w.r, 1.0, 0.6), f, f + 0.6)*(1.0 - 0.3*max(uStratus, uStorm)*(1.0 - w.r));   /* (a deck still has thinner and thicker parts) */
}
/* how dense the cloud is at P (in the world), hf of the way up the layer, under the weather w */
float cloudDen(vec3 P, float hf, vec4 w, float cv, float lodS, float lodD){
  float h, d = cloudRoom(w, hf, cv, h);
  if (d <= 0.0) return 0.0;
  /* the body: billows carve it (drifting with the cells they make up, and slowly rising through them) */
  d = remapC(d, 1.0 - textureLod(uShape, (P - uDriftS)*SHR, lodS).r, 1.0);
  if (d <= 0.0) return 0.0;
  /* its edges: heaped above, wispy below (the detail fades out with distance, where it could only shimmer) */
  if (lodD < 4.0){
    float de = textureLod(uDetail, (P - uDriftT)*DTR, lodD).r;
    float m = mix(pow(de, 6.0), 1.0 - de, remapC(h, 0.2, 0.4));
    d = mix(remapC(d*2.0, m*0.5, 1.0), d, smoothstep(2.0, 4.0, lodD));
  }
  return clamp(d*(0.75*h + 0.25), 0.0, 1.0);
}
/* ── above the heaps, a thin layer of altocumulus, 5.2 to 5.65 km up: rounded cloudlets lying in broad patches, marched
   in a few steps and lit the same way as the heaps. It moves with them, on a wind a third stronger up there, so it
   drifts the same way across the sky, a little slower for being higher. Its drift is kept along the wind, in the wind's
   own frame, each part wrapped to its own texture's repeat (uAltoD: the cloudlets, the patches and the warp, the
   cloudlets' rise, their frayed edges) ── */
uniform vec4 uAltoD;
const float AB = 5200.0, AT = 5650.0;
/* fp: how many metres one pixel spans out there */
float altoDen(vec3 P, float hf, float fp){
  vec2 wn = normalize(uWind + vec2(1e-5)), wf = vec2(dot(P.xz, wn), dot(P.xz, vec2(-wn.y, wn.x)));
  /* where the sheet lies: broad patches, more of the sky the more there is of it */
  float m = textureLod(uWeather, vec2(wf.x - uAltoD.y, wf.y)*(1.0/WT) + vec2(0.37, 0.71), 2.0 + 0.5*log2(max(fp/70.0, 1.0))).b;
  float cov = smoothstep(0.15, 0.85, m + 0.6*uAlto - 0.4)*min(1.0, uAlto*1.3);
  if (cov <= 0.002) return 0.0;
  /* flat-bottomed, rounded on top */
  float prof = smoothstep(0.0, 0.2, hf)*(1.0 - smoothstep(0.5, 1.0, hf));
  /* the cloudlets: the heaps' billowy noise at 70% of its size, drawn out a little across the wind, on a sheet slowly
     warped so the rows wander and its repeat never lines up. (They were cut from a small Worley noise that repeated
     every kilometre, which showed as a net.) */
  vec2 warp = (textureLod(uWeather, vec2(wf.x - uAltoD.y, wf.y)*(3.0/WT) + vec2(0.11, 0.53), 1.0).gb - 0.5)*1000.0;
  vec3 q = vec3((wf.x - uAltoD.x + warp.x)*(SHR*1.4), (P.y - uAltoD.z)*(SHR*1.4), (wf.y + warp.y)*(SHR*1.05));
  float lodB = log2(max(fp/18.4, 1.0));    /* (a texel of these billows is 18.4 m) */
  /* the noise runs from about 0.65 to 0.91 (5% to 95%): spread over 0 to 1, a threshold at 1 - f leaves about f of the
     sheet cloud; half of it at most, less toward the top and the bottom, so the cloudlets are rounded with blue between */
  float nn = clamp((textureLod(uShape, q, lodB).r - 0.65)/0.26, 0.0, 1.0), f = 0.5*cov*prof;
  float dn = remapC(nn, 1.0 - f - 0.05, 1.0 - f + 0.16);
  /* frayed edges, near enough to see: finer Worley noise eats at them */
  if (lodB < 2.5){ float de = textureLod(uDetail, vec3(wf.x - uAltoD.w, P.y, wf.y)*(1.0/240.0), lodB + 1.3).r; dn = mix(remapC(dn, 0.45*de, 1.0), dn, smoothstep(1.0, 2.5, lodB)); }
  /* far off, where the noise is blurred toward its average, the cloudlets melt into the share of the sky they cover (a
     threshold on blurred noise would draw a solid sheet, and a line round each patch) */
  return mix(dn, 0.5*f, smoothstep(3.0, 5.0, lodB));
}
vec4 altoLayer(vec3 d, float jit, float ph[6], vec3 Lc, vec3 ambTop, vec3 Lm, out float dep){
  dep = 1e5;
  float h0 = clamp(uCO.y, 0.0, 400.0), dy = max(d.y, 0.0);
  float t0 = shellT(h0, dy, AB), t1 = shellT(h0, dy, AT);
  if (t0 > 70000.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float L = min(t1 - t0, 4000.0), ds = L/10.0, fp = t0*uPxA, far = smoothstep(70000.0, 45000.0, t0);   /* (fading out before it stops) */
  vec3 S = vec3(0.0); float T = 1.0, t = t0 + ds*jit, wd = 0.0, ws = 0.0;
  for (int i = 0; i < 10; i++){
    float hf = (t - t0)/(t1 - t0);
    vec3 P = vec3(uCO.x + d.x*t, AB + hf*(AT - AB), uCO.z + d.z*t);
    float den = altoDen(P, hf, fp)*far;
    if (den > 0.003){
      /* toward the light: two looks through the sheet */
      vec3 l1 = P + Lm*70.0, l2 = P + Lm*220.0;
      float tau = (altoDen(l1, (l1.y - AB)/(AT - AB), fp*2.0)*70.0 + altoDen(l2, (l2.y - AB)/(AT - AB), fp*2.0)*150.0)*DS*0.5;
      float ms = 0.0; { float a = 1.0, b = 1.0; for (int k = 0; k < 6; k++){ ms += a*exp(-tau*b)*ph[k]; a *= 0.5; b *= 0.5; } }
      float sig = den*DS*0.5, powder = 1.0 - 0.6*exp(-sig*120.0);
      vec3 Sc = Lc*ms*powder + ambTop*(0.75 + 0.25*hf)*(1.0 - 0.3*den);
      float Td = exp(-sig*ds), o = T*(1.0 - Td);
      S += Sc*o; wd += t*o; ws += o; T *= Td;
    }
    t += ds;
  }
  if (ws > 0.0) dep = wd/ws;
  return vec4(S, T);
}
/* the light the clouds send along d (rgb), and how much of what lies behind them still shows (a) */
vec4 cloudLayer(vec3 d, vec3 Ld, vec3 haze, float jit){
  bool cu = uCumulus + uStratus + uStorm > 0.001, al = uAlto > 0.002;
  if (d.y < -0.01 || !(cu || al)) return vec4(0.0, 0.0, 0.0, 1.0);
  float cb = mix(1500.0, 900.0, uStratus) - 300.0*uStorm, ct = mix(3900.0, 2500.0, uStratus) + 4600.0*uStorm;
  float h0 = clamp(uCO.y, 0.0, 400.0), dy = max(d.y, 0.0);
  float t0 = shellT(h0, dy, cb), tTop = shellT(h0, dy, ct);
  /* scattered many times over: each order of scattering reaches deeper and spreads more evenly (its phase computed once a ray) */
  float cosT = dot(d, Ld), ph[6]; { float a = 1.0; for (int i = 0; i < 6; i++){ ph[i] = mix(hgP(cosT, 0.75*a), hgP(cosT, -0.22*a), 0.38); a *= 0.5; } }
  /* a storm is dark and a little green-grey; rain a softer, even grey that the sun barely gets through */
  vec3 tint = mix(vec3(1.0), vec3(0.8, 0.88, 0.92), uStorm);
  vec3 ambTop = (uZen*1.2 + uHor*0.45)*mix(1.0, 0.4, uStorm)*tint, ambBot = (uHor*0.42 + uZen*0.16)*mix(1.0, 0.3, uStorm)*tint;
  vec3 Lc = uCloudLit*3.4*mix(1.0, 0.25, uStorm)*mix(1.0, 0.7, uStratus*(1.0 - uStorm));
  vec3 Lm = normalize(uLdM + vec3(0.0, 1e-3, 0.0));
  vec3 S = vec3(0.0); float T = 1.0, wd = 0.0, ws = 0.0;
  /* (as far as the layer goes, to the horizon: it fades into the haze on its own. Cut off nearer, at 60 km, it ended in
     a line above a band of empty haze) */
  if (cu && t0 < 170000.0){
    float L0 = tTop - t0, L = min(L0, 10000.0);        /* a long grazing path: only its near part shows, the rest is haze */
    int N = int(clamp(L/45.0, 32.0, 128.0)*uCQ*clamp(60000.0/t0, 0.25, 1.0));
    float ds = L/float(N), cv = cloudCover(), t1 = t0 + L, t = t0 + ds*jit;
    vec2 bolt = uCO.xz + vec2(sin(uBolt.x), -cos(uBolt.x))*9000.0;
    for (int i = 0; i < 150; i++){
      if (t > t1 || T < 0.015) break;
      float hf = (t - t0)/L0;
      vec3 P = vec3(uCO.x + d.x*t, cb + hf*(ct - cb), uCO.z + d.z*t);
      float fp = t*uPxA, lodW = log2(max(fp/70.0, 1.0));
      vec4 w = cloudWeather(P.xz, lodW);
      /* (where the weather lets nothing grow, stride on: the steps are spent inside the clouds) */
      float hr; if (cloudRoom(w, hf, cv, hr) <= 0.0){ t += ds*2.0; continue; }
      float lodS = log2(max(fp/26.0, 1.0)), lodD = log2(max(fp/10.6, 1.0));
      float den = cloudDen(P, hf, w, cv, lodS, lodD);
      if (den > 0.002){
        /* toward the light: four looks, each further than the last, at how much cloud is in the way (started a little
           nearer or further each step and each frame, so the looks blend into a smooth shadow rather than bands) */
        float tau = 0.0, sl = 60.0*(0.7 + 0.6*fract(jit + float(i)*0.6180339)); vec3 lq = P;
        for (int k = 0; k < 4; k++){
          lq += Lm*sl; float hq = (lq.y - cb)/(ct - cb); if (hq > 1.0 || hq < 0.0) break;
          tau += cloudDen(lq, hq, cloudWeather(lq.xz, lodW + 1.0), cv, lodS + 1.0, 9.0)*sl; sl *= 2.2;
        }
        tau *= DS;
        float ms = 0.0; { float a = 1.0, b = 1.0; for (int k = 0; k < 6; k++){ ms += a*exp(-tau*b)*ph[k]; a *= 0.5; b *= 0.5; } }
        float sig = den*DS, powder = 1.0 - 0.6*exp(-sig*120.0);
        vec3 Sc = Lc*ms*powder + mix(ambBot, ambTop, clamp(hf*1.6, 0.0, 1.0))*(1.0 - 0.3*den);   /* (the sky's light reaches less far into the thick of it) */
        Sc += vec3(0.62, 0.66, 0.8)*uFlash*2.5*exp(-length(P.xz - bolt)/5000.0);
        float Td = exp(-sig*ds), o = T*(1.0 - Td);
        S += Sc*o; wd += t*o; ws += o; T *= Td;
      }
      t += ds;
    }
    /* far off, a cloud is mostly haze (judged at the depth where it is seen) */
    float aer = exp(-(ws > 0.0 ? wd/ws : t0)/24000.0);
    S = mix(haze*(1.0 - T), S, aer);
  }
  /* the altocumulus, behind the heaps (what still shows through them) */
  if (al && T > 0.02){
    float dA; vec4 A = altoLayer(d, jit, ph, Lc, ambTop, Lm, dA);
    float aerA = exp(-dA/26000.0);
    S += T*mix(haze*(1.0 - A.a), A.rgb, aerA); T *= A.a;
  }
  return vec4(S, T);
}
`;

  const SKY_FS = `
${COMMON}
${SKY_FN}
uniform float uStars, uTime, uPhaseC, uPhaseSign, uCloud, uMoonR, uSunR, uEnv; uniform vec3 uCloudLit;
uniform float uCirrus, uAlto, uCumulus, uStratus, uStorm, uFlash; uniform vec4 uBolt; uniform vec2 uWind;
uniform sampler2D uNoise;
uniform float uCloudT;      /* the clouds' own clock: they drift on the wind and their shapes keep changing */
uniform vec3 uCO;           /* where the clouds are seen from: the camera, in the world */
uniform float uCQ;          /* how carefully they are marched: fewer steps for the sky's reflection */
uniform sampler2D uCB; uniform float uCBOn; uniform vec2 uCBInv;   /* the clouds, marched at half size and kept smooth over frames */
uniform vec2 uHiDrift;      /* how far the wind has carried the clouds (m): the high cloud drifts the same way */
uniform float uPix;         /* the angle one pixel covers (the discs' edges are smoothed by it: no derivatives, which
                               are undefined inside the branches they sit in and drew a dashed ring round the sun and moon) */
varying vec3 vDir;
${CLOUD_FN}
${CATMULL}
void main(){
  vec3 d = normalize(vDir);
  vec3 c = skyColor(d), sky0 = c;
  /* (all of it worked out for every pixel, below the horizon too, so the textures' own filtering, which looks at the
     pixels next door, always finds them doing the same: a branch at the horizon left it guessing along that line) */
  {
    /* stars */
    if (uStars > 0.001){
      vec2 sc = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0)))*57.2958*1.7;
      vec2 cell = floor(sc), fr = fract(sc);
      float h = hash12(cell);
      if (h > 0.855){
        vec2 sp = vec2(hash12(cell + 3.7), hash12(cell + 9.1))*0.76 + 0.12;
        float dd = length(fr - sp);
        float b = pow((h - 0.855)/0.145, 2.2);
        float tw = 0.7 + 0.3*sin(uTime*(1.3 + 3.0*hash12(cell + 2.2)) + h*40.0);
        vec3 sc2 = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash12(cell + 5.5));
        c += sc2*smoothstep(0.085, 0.0, dd)*(0.02 + b*0.16)*tw*uStars*smoothstep(0.0, 0.035, d.y);
      }
    }
    /* clouds: high cirrus wisps painted on the sky, and in front of them real layers of cloud marched through and lit
       by the sun or the moon: a thin sheet of altocumulus, and below it the cumulus (a grey deck in rain, towers in a
       storm) */
    float cm = max(dot(d, uMoonDirV), 0.0);
    vec2 hs = normalize(uSunDirV.xz + vec2(1e-5)), hd = normalize(d.xz + vec2(1e-5));
    float az = max(dot(hd, hs), 0.0);
    float cy = max(d.y, 0.0), cover = 0.0;
    vec3 amb = mix(uZen, uHor, 0.45);
    vec3 halo = uMoonDisc*(pow(cm, 40.0)*0.55 + pow(cm, 8.0)*0.12) + uGlow*(0.7*pow(az, 3.0) + 0.12);
    vec2 wnd = normalize(uWind + vec2(1e-4)), wnp = vec2(-wnd.y, wnd.x);
    /* the light: the moon by night, the sun by day */
    vec3 Ld = dot(uSunDisc, uSunDisc) > dot(uMoonDisc, uMoonDisc)*40.0 ? uSunDirV : uMoonDirV;
    float a = atan(d.x, -d.z), e = asin(clamp(d.y, -1.0, 1.0));
    /* The cirrus is painted on a flat sheet above the clouds, seen in perspective (p is where on the sheet a direction
       meets it, 0.1 to a sheet 9 km up). The engine carries all the clouds along on the wind, and the cirrus goes the
       same way as the heaps below it, on a wind nearly twice as strong but four times as high, so it seems to move about
       half as fast. The patches it lies in move a little slower again, so it comes and goes as it crosses rather than
       sliding by as one sheet. (It used to slide the other way from the heaps, and many times faster.) */
    if (uCirrus > 0.001){
      /* high cirrus: soft, thin veils drawn out along the wind, faint and smooth */
      vec2 p0 = d.xz/(cy + 0.1)*0.1, p = p0 - uHiDrift*2.0e-5;
      vec2 q = vec2(dot(p, wnd), dot(p, wnp));
      float fib = texture2D(uNoise, vec2(q.x*0.32, q.y*1.5)).g*0.75 + texture2D(uNoise, vec2(q.x*0.6, q.y*2.4) + 0.21).r*0.25;
      float mask = smoothstep(0.42, 0.72, texture2D(uNoise, (p0 - uHiDrift*1.6e-5)*0.22 + 0.5).r);
      float den = smoothstep(0.5, 0.78, fib)*mask*smoothstep(0.0, 0.06, cy)*uCirrus*0.55;
      vec3 col = amb*1.7 + uCloudLit*1.6 + halo*1.1 + uGlow*0.9*pow(az, 1.5);
      c = mix(c, col, den); cover += den*0.3;
    }
    /* the altocumulus and the cumulus (or, in rain, a deck of stratus), in front of the cirrus */
    { vec4 cl = uCBOn > 0.5 && uEnv < 0.5 ? texelFetch(uCB, ivec2(gl_FragCoord.xy), 0) : cloudLayer(d, Ld, sky0, 0.5 + 0.7*(hash12(gl_FragCoord.xy) - 0.5));
      cl = vec4(max(cl.rgb, vec3(0.0)), clamp(cl.a, 0.0, 1.0));
      c = c*cl.a + cl.rgb; cover = max(cover, 1.0 - cl.a); }
    {
      /* a lightning bolt: jagged, from the cloud base to the sea */
      if (uBolt.w > 0.001){
        float base = 0.035 + 0.02*uStorm, t = clamp(e/base, 0.0, 1.0);
        float off = 0.0, amp = 0.014;
        for (int k = 0; k < 4; k++) { float fk = float(k); off += amp*(texture2D(uNoise, vec2(t*(1.7 + fk*2.3) + uBolt.z*13.1, 0.71 + fk*0.11)).r - 0.5); amp *= 0.55; }
        float dx = abs(a - uBolt.x - off), w = 0.0008 + 0.0005*(1.0 - t);
        float bolt = (smoothstep(w*3.0, 0.0, dx) + 0.3*smoothstep(w*16.0, 0.0, dx))*step(e, base)*step(-0.002, e);
        c += vec3(0.85, 0.9, 1.0)*bolt*uBolt.w*3.5;
      }
    }
    cover = clamp(cover, 0.0, 1.0);
    /* moon disc with real phase */
    vec3 mz = uMoonDirV, mx = normalize(cross(mz, vec3(0.0, 1.0, 0.0))), my = cross(mx, mz);
    if (dot(d, mz) > 0.995 && dot(uMoonDisc, uMoonDisc) > 1e-10){
      vec2 q = vec2(dot(d, mx), dot(d, my))/uMoonR;
      float r = length(q);
      float aa = 1.4*uPix/uMoonR;
      float cov = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
      if (cov > 0.0){
        vec3 nn = vec3(q, sqrt(max(1.0 - r*r, 0.0)));
        vec3 sd = vec3(uPhaseSign*sqrt(max(1.0 - uPhaseC*uPhaseC, 0.0)), 0.0, uPhaseC);
        float lit = smoothstep(-0.05, 0.09, dot(nn, sd));
        float m1 = textureLod(uNoise, q*0.21 + vec2(0.31, 0.62), 0.0).r, m2 = textureLod(uNoise, q*0.55 + vec2(0.13, 0.27), 0.0).a;
        float alb = 0.98 - 0.3*smoothstep(0.42, 0.68, m1) - 0.1*smoothstep(0.45, 0.8, m2);
        vec3 moonC = uMoonDisc*(alb*(0.78 + 0.22*nn.z)*lit + 0.03*(1.0 - lit));
        cov *= (1.0 - cover)*(1.0 - max(uStratus, uStorm));
        c = c*(1.0 - cov*0.35*lit*uStars) + moonC*cov;
      }
    }
    /* sun disc */
    float cs = dot(d, uSunDirV);
    if (cs > 0.99 && dot(uSunDisc, uSunDisc) > 1e-8){
      float r = acos(min(cs, 1.0))/uSunR;
      float aa = 1.4*uPix/uSunR;
      float limb = 0.55 + 0.45*sqrt(max(0.0, 1.0 - r*r));      /* darker toward its edge, as the real one is */
      c += uSunDisc*(1.0 - smoothstep(1.0 - aa, 1.0 + aa, r))*0.9*limb*(1.0 - cover)*(1.0 - max(uStratus, uStorm));   /* (never through rain or a storm) */
    }
  }
  if (d.y <= -0.004) c = uEnv > 0.5 ? mix(uHor*0.5, uHor*0.08 + uZen*0.15, smoothstep(0.0, 0.3, -d.y)) : uHor;
  gl_FragColor = vec4(c, 1.0);
}`;

  /* artificial lights shared by the ground and every lit prop; the fire and the string-light
     canopy each have a small depth map so things cast real shadows across the sand */
  const ART = `
uniform sampler2D uPool; uniform vec4 uPoolRect;
uniform vec4 uLightK, uLights, uFire; uniform vec3 uFirePos;
uniform vec4 uLant[3]; uniform vec3 uVanPos, uVanDir;
uniform vec4 uHead; uniform vec3 uHeadDir;
uniform highp sampler2DShadow uFireSh, uCanSh; uniform mat4 uFireShM, uCanShM; uniform float uShOn;
const vec2 PD[8] = vec2[8](vec2(-0.7071, 0.7071), vec2(0.0, -0.875), vec2(0.5303, 0.5303), vec2(-0.625, 0.0),
                           vec2(0.3536, -0.3536), vec2(0.0, 0.375), vec2(-0.1768, -0.1768), vec2(0.125, 0.0));
/* 8 hardware-PCF taps in a spiral; fades out toward the map edge */
float shLook(highp sampler2DShadow m, mat4 M, vec3 wp, float bias, float rad){
  if (uShOn < 0.5) return 1.0;
  vec4 sc = M*vec4(wp, 1.0);
  if (sc.w <= 0.0) return 1.0;
  sc.xyz /= sc.w;
  vec2 e2 = min(sc.xy, 1.0 - sc.xy);
  float edge = smoothstep(0.0, 0.08, min(e2.x, e2.y));
  if (edge <= 0.0 || sc.z >= 1.0) return 1.0;
  float z = sc.z - bias, acc = 0.0;
  for (int i = 0; i < 8; i++) acc += texture(m, vec3(sc.xy + PD[i]*rad, z));
  return mix(1.0, acc*0.125, edge);
}
vec3 artLight(vec3 wp, vec3 n){
  vec3 L = vec3(0.0);
  vec2 uv = (wp.xz - uPoolRect.xy)/uPoolRect.zw;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0 && uLights.x > 0.001){
    vec3 lm = texture2D(uPool, uv).rgb; lm *= lm;
    float up = clamp(n.y*0.55 + 0.45, 0.0, 1.0);
    float cs = lm.r > 0.004 ? shLook(uCanSh, uCanShM, wp + n*0.03, 0.0004, 9.0/1024.0) : 1.0;
    L += lm.r*uLightK.x*C_BULB*smoothstep(0.0, 1.0, uLights.x)*up*mix(0.42, 1.0, cs);
  }
  for (int i = 0; i < 3; i++){
    vec3 d = uLant[i].xyz - wp; float r2 = dot(d, d);
    L += C_LANT*uLant[i].w*uLights.y*uLightK.y*max(dot(n, d*inversesqrt(r2 + 1e-4))*0.7 + 0.3, 0.0)*0.12/(r2 + 0.12);
  }
  {
    vec3 d = uVanPos - wp; float r2 = dot(d, d); vec3 l = d*inversesqrt(r2 + 1e-4);
    float cone = smoothstep(0.05, 0.75, dot(-l, uVanDir));
    L += C_VAN*uLights.z*uLightK.z*cone*max(dot(n, l)*0.7 + 0.3, 0.0)*1.1/(r2 + 1.1);
  }
  if (uHead.w > 0.001){ /* the van's headlights, one broad warm beam */
    vec3 d = uHead.xyz - wp; float r2 = dot(d, d); vec3 l = d*inversesqrt(r2 + 1e-4);
    float cone = smoothstep(0.80, 0.95, dot(-l, uHeadDir));
    L += vec3(1.0, 0.9, 0.74)*uHead.w*cone*max(dot(n, l)*0.8 + 0.2, 0.0)*5.0/(r2 + 1.5);
  }
  if (uFire.x > 0.001){
    vec3 d = uFirePos + vec3(0.0, 0.6, 0.0) - wp; float r2 = dot(d, d);
    if (r2 < 200.0){
      vec3 l = d*inversesqrt(r2 + 1e-4);
      float fr = length(wp.xz - uFirePos.xz);
      float fs = r2 < 64.0 ? shLook(uFireSh, uFireShM, wp + n*0.04, 0.0006, (0.7 + 1.6*clamp((fr - 0.45)/2.5, 0.0, 1.0))/256.0) : 1.0;
      L += C_FIRE*uFire.x*(0.8 + 0.3*uFire.y)*uLightK.w*max(dot(n, l)*0.85 + 0.15, 0.0)*2.2/(r2 + 2.2)*mix(0.42, 1.0, fs);
    }
  }
  return L;
}`;

  /* shared wave height field: tide swells (6) and the swells raised by clicks (any number of them) */
  const WAVEH = `
uniform float uWaveT; uniform vec4 uWv[6];
/* the clicked swells, row 0 of uSurgeT (when each comes ashore, how big, where along the beach, how far out it was sent
   from), uNUw of them; row 1 holds the splash rings */
uniform highp sampler2D uSurgeT; uniform int uNUw;
vec4 uwAt(int k){ return texelFetch(uSurgeT, ivec2(k, 0), 0); }
#define WC 1.55
#define CU 4.2
${shoreGL('v', { head: 'headv', headD: 'headDv', z: 'shoreZv', dz: 'shoreDZv' })}float swell(float s, float tau, float amp, float spd, float sb){
  float x = s + tau*spd;
  float shoal = 1.0 + 0.8*smoothstep(sb + 14.0, sb, s);
  float broken = smoothstep(sb + 0.5, sb - 2.5 - 0.2*sb, s);
  float lf = 0.9 + 0.035*max(s, 0.0), lb = 2.3 + 0.07*max(s, 0.0);
  float prof = x < 0.0 ? exp(-x*x/(lf*lf)) : exp(-x*x/(lb*lb));
  /* clicked swells: the biggest stacks grow less than linearly, so they stay waves rather than walls */
  float k = spd > 2.0 ? 0.27/(1.0 + 0.08*max(amp - 1.5, 0.0)) : 0.16;
  return amp*k*shoal*mix(1.0, 0.36, broken)*prof*smoothstep(-0.3, 1.4, s);
}
float userAmp(vec4 U, float a, float t){
  float sc = max(U.w - (t - (U.x - U.w/CU))*CU, 0.0);
  float hw = 9.0 + 0.8*(U.w - sc);
  float dx = (a - U.z)/min(hw, 46.0);
  /* a crest that rises and falls along its length: peaks and shoulders, not a level wall */
  float along = 0.82 + 0.36*(0.5 + 0.25*sin(a*0.31 + U.z) + 0.25*sin(a*0.13 + 1.7*U.z));
  return U.y*along*exp(-dx*dx)*smoothstep(U.x - U.w/CU, U.x - U.w/CU + 1.8, t);
}
/* where a clicked swell breaks: further out the bigger it is, varying gently along the beach so it peels */
float userSb(float amp, float nA, vec4 U){ return min((3.0 + 4.6*amp)*(0.88 + 0.24*nA), max(4.0, 0.5*U.w*(0.9 + 0.2*nA))); }
float waveH(vec2 p){
  float g = shoreDZv(p.x), s = (shoreZv(p.x) - p.y)/sqrt(1.0 + g*g), a = p.x, t = uWaveT;
  if (s < -0.5) return 0.0;
  float nA = 0.5 + 0.24*sin(a*0.19 + 1.3) + 0.18*sin(a*0.071 + 0.4) + 0.12*sin(a*0.53 + 2.0);   /* where along the beach the swell breaks sooner or later */
  float h = 0.0;
  for (int j = 0; j < 6; j++){
    vec4 W = uWv[j]; if (W.y <= 0.0) continue;
    float tau = t - (W.x + 0.9*sin(a*0.11 + W.z) + a*0.03*W.w);
    h += swell(s, tau, W.y, WC, 3.0 + 7.0*nA*W.y);
  }
  for (int k = 0; k < ${MAXUW}; k++){
    if (k >= uNUw) break;
    vec4 U = uwAt(k); if (U.y <= 0.0) continue;
    float amp = userAmp(U, a, t); if (amp < 0.01) continue;
    h += swell(s, t - U.x, amp, CU, userSb(amp, nA, U));
  }
  return h;
}`;
  const GROUND_VS = `
${WAVEH}
uniform vec4 uNearRect;
varying vec3 vW; varying vec3 vNg; varying float vH;
void main(){
  vec4 wp = modelMatrix*vec4(position, 1.0);
  vNg = vec3(0.0, 1.0, 0.0); vH = 0.0;
  #ifdef NEAR
    float fade = smoothstep(uNearRect.x, uNearRect.x + 18.0, wp.x)*smoothstep(uNearRect.z, uNearRect.z - 18.0, wp.x)*smoothstep(uNearRect.y, uNearRect.y + 16.0, wp.z);
    if (fade > 0.0){
      float e = 0.22, h = waveH(wp.xz), hx = waveH(wp.xz + vec2(e, 0.0)), hz = waveH(wp.xz + vec2(0.0, e));
      vNg = normalize(vec3(-(hx - h)/e*fade, 1.0, -(hz - h)/e*fade));
      wp.y += h*fade; vH = h*fade;
    }
  #endif
  vW = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;

  /* the clouds' shadow on the ground: how much of the key light's direct light gets through to p. Worked out from the
     same weather map the clouds are grown from, where the light from p crosses the heaps (some 2.1 km up) and the sheet
     of altocumulus (5.4 km), a little blurred: soft shadows that drift with the clouds that cast them. (engine.js
     works out the same at the camp, for the light on everything there.) */
  const CLOUDSHADOW = `
uniform sampler2D uWeather; uniform vec2 uDriftW, uWind; uniform vec4 uAltoD; uniform vec3 uLdM;
uniform float uCumulus, uStratus, uStorm, uAlto;
float cloudShadow(vec2 p){
  vec3 L = normalize(uLdM + vec3(0.0, 1e-3, 0.0));
  float k = smoothstep(0.03, 0.12, L.y);   /* (a sun this low lights the clouds' sides: no clean shadow under them) */
  if (k <= 0.0) return 1.0;
  float sh = 1.0;
  if (uCumulus + uStratus + uStorm > 0.001){
    float cv = clamp(max(max(0.08 + 0.24*uCumulus, 1.05*uStratus), 0.9*uStorm), 0.0, 1.0);
    vec4 w = textureLod(uWeather, (p + L.xz/L.y*2100.0 - uDriftW)*(1.0/36000.0), 2.5);
    float f = 1.0 - cv*mix(0.75, 1.2, w.b), room = clamp((mix(w.r, 1.0, 0.6) - f)/0.6, 0.0, 1.0);
    sh = 1.0 - 0.82*smoothstep(0.03, 0.4, room);
  }
  if (uAlto > 0.002){
    vec2 q = p + L.xz/L.y*5400.0, wn = normalize(uWind + vec2(1e-5)), wf = vec2(dot(q, wn), dot(q, vec2(-wn.y, wn.x)));
    float m = textureLod(uWeather, vec2(wf.x - uAltoD.y, wf.y)*(1.0/36000.0) + vec2(0.37, 0.71), 3.0).b;
    sh *= 1.0 - 0.3*smoothstep(0.15, 0.85, m + 0.6*uAlto - 0.4)*min(1.0, uAlto*1.3);
  }
  return mix(1.0, sh, k);
}`;
  const GROUND_FS = `
#include <packing>
${COMMON}
${SKY_FN}
${ART}
uniform float uTime, uDay, uShadowK, uShadowOn;
uniform sampler2D uNoise, uWater, uSand, uDecal, uRelief, uShadowMap;
uniform mat4 uVanInv;
/* the dark under the van where the sky can't reach, and under each wheel: in the van's own frame, so it goes where it goes */
float vanAO(vec3 wp){
  vec3 lp = (uVanInv*vec4(wp, 1.0)).xyz;
  if (abs(lp.x) > 3.0 || abs(lp.z) > 1.6 || abs(lp.y) > 0.8) return 0.0;
  float a = 0.9*(1.0 - smoothstep(0.55, 1.0, length(lp.xz/vec2(2.55, 1.15))));
  vec2 q = vec2(abs(lp.x) - 1.42, abs(lp.z) - 0.8);
  return max(a, 1.0 - smoothstep(0.09, 0.3, length(q)));
}
uniform vec4 uDecalRect; uniform vec2 uShadowSize; uniform mat4 uShadowMatrix;
uniform vec3 uAmb, uKeyDir, uKeyCol, uMoonGlit, uSunGlit;
${CLOUDSHADOW}
uniform sampler2D uSunVis;  /* how much of the sun (left) and the moon (right) shows past the clouds, from the camera */
${WAVEH}
uniform int uNRip;          /* click splashes (row 1 of uSurgeT: x, z, start time, strength), uNRip of them */
uniform float uUwMax;       /* the biggest clicked swell about (how far up the sand to look for its swash) */
uniform vec4 uNearRect;
uniform float uMist, uWet, uRough;
uniform vec3 uShC;          /* where the key light's shadow map is centred (x, z) and how far it reaches */
uniform int uDbgG;
/* rain on water: rings from drops landing on a jittered grid */
vec2 rainRings(vec2 p, float t){
  vec2 g = p*3.2, gi = floor(g), acc = vec2(0.0);
  for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++){
    vec2 c = gi + vec2(float(i), float(j)), o = vec2(hash12(c), hash12(c + 7.1))*0.8 + 0.1;
    float ph = fract(t*0.9 + hash12(c + 3.3)), r = ph*0.42;
    vec2 dv = g - (c + o); float dd = length(dv);
    float ring = exp(-pow((dd - r)*14.0, 2.0))*(1.0 - ph);
    acc += dv/max(dd, 1e-3)*ring;
  }
  return acc;
}
varying vec3 vW; varying vec3 vNg; varying float vH;

#define TS 7.0
#define U0 0.38
#define CAMP vec2(${f(Layout.camp.x)}, ${f(Layout.camp.z)})

vec2 gDx, gDy;
vec4 tN(vec2 p, float T){ return texture2DGradEXT(uNoise, p/T, gDx/T, gDy/T); }
vec4 tW(vec2 p, float T){ return texture2DGradEXT(uWater, p/T, gDx/T, gDy/T); }
vec4 tS(vec2 p, float T){ return texture2DGradEXT(uSand, p/T, gDx/T, gDy/T); }

${shoreGL('f', { head: 'headf', headD: 'headDf', z: 'shoreZ', dz: 'shoreDZ', veg: 'vegZ' })}
/* cheap sky for reflections: gradient, horizon glow, broad moon/sun halo */
/* how much of the sun shows past the clouds (set at the top of main): its glow round it, mirrored in the sea, goes with it */
float gSunK = 1.0;
vec3 skyRefl(vec3 d){
  float eu = max(d.y, 0.0);
  vec3 c = mix(uHor, uZen, pow(smoothstep(0.0, 0.5, eu), 0.6));
  vec2 hs = normalize(uSunDirV.xz + vec2(1e-5)), hd = normalize(d.xz + vec2(1e-5));
  c += uGlow*(pow(max(dot(hd, hs), 0.0), 5.0)*exp(-eu*11.0)*(0.25 + 0.75*gSunK) + 0.2*exp(-eu*5.0));
  c += uMoonDisc*pow(max(dot(d, uMoonDirV), 0.0), 14.0)*0.014;
  return c;
}

/* gloss: a film of water still on the sand; mark: the pale line a wave leaves where it stopped; sf: how much of the
   foam is the swash's froth (bubbles left lying) rather than the open water's */
struct Wv { float foam; float lip; float cover; float depth; float wet; float slope; float gloss; float mark; float sf; };
/* how far up the sand the swash runs, along the beach: long sweeps, and the scallops of beach cusps every ten or
   fifteen metres (the same numbers are in engine.js, which decides what the bigger waves reach) */
float runK(float nB, float a){ return 0.72 + 0.4*nB + 0.16*sin(a*0.43 + 0.8) + 0.1*sin(a*0.79 + 2.3); }
/* hashed on integers, so engine.js can work out exactly the same tongues */
uint hashU(uint n){ n = (n ^ 61u) ^ (n >> 16u); n *= 9u; n ^= n >> 4u; n *= 0x27d4eb2du; return n ^ (n >> 15u); }
/* a wave's run-up ends in tongues: in every cell of width cw along the beach a rounded lobe with a place, width and reach
   of its own, and a cusp where two lobes meet; sd gives every wave its own set */
float lobes(float a, float cw, uint sd){
  float c = floor(a/cw), m = 0.0;
  for (int i = -1; i <= 1; i++){
    float ci = c + float(i);
    uint h = hashU(uint(ci + 1048576.0)*0x9E3779B1u ^ sd);
    vec3 r = vec3(uvec3(h, h >> 10u, h >> 20u) & 1023u)/1023.0;
    float d = (a - (ci + 0.2 + 0.6*r.x)*cw)/(cw*(0.55 + 0.45*r.y));
    m = max(m, (0.3 + 0.7*r.z)*sqrt(max(1.0 - d*d, 0.0)));
  }
  return m;
}
/* how far this wave runs up the sand here: the beach's sweeps and cusps, then the wave's own big lobes (a few metres
   across) and small tongues (about one); how much later than the plain front it gets there; and the tongue, for the
   froth on its tip. engine.js has the same, for what the water knocks over and the tyre tracks it smooths */
vec3 reach(float a, float nB, float amp, uint sd){
  uint hb = hashU(sd), hs = hashU(sd ^ 0x5bd1e995u);
  float Lb = lobes(a, 3.4 + 3.0*float(hb & 255u)/255.0, hb), Ls = lobes(a, 0.9 + 0.7*float(hs & 255u)/255.0, hs);
  return vec3((0.85 + 0.75*amp)*runK(nB, a)*(0.5 + 0.4*Lb + 0.42*Ls), 0.6*(Lb - 0.5), Ls);
}
void wave1(inout Wv w, float s, float a, float t, vec2 p, float tau, float amp, float spd, float sb, float k3, float nB, uint sd, float rv){
  float tsw = TS*(0.85 + 0.15*max(amp, 1.0));
  if (s > sb - 1.0){
    float x = s + tau*spd, lam = 1.4 + 0.035*s;
    float g = amp*exp(-x*x/(lam*lam))*(x < 0.0 ? 1.0 : 0.8);
    w.slope += -2.0*x/(lam*lam)*g*0.42;
    /* a crest breaks harder in some stretches than others: peaks and quieter shoulders along it */
    float patchy = smoothstep(0.18, 0.72, tN(vec2(p.x*0.16, p.y*0.05) + vec2(k3*2.3, 0.0), 6.0).r);
    w.foam = max(w.foam, smoothstep(sb + 4.0, sb - 0.2, s)*exp(-x*x/0.09)*amp*0.85*(0.2 + 0.8*patchy));
    /* a big swell feathers white along its crest as it steepens toward the break */
    float crest = exp(-(x + 0.2)*(x + 0.2)/(0.05 + 0.02*amp));
    w.foam = max(w.foam, crest*smoothstep(0.9, 3.0, amp)*(spd > 2.0 ? 0.3 + 0.6*smoothstep(sb + 12.0, sb + 0.3, s) : smoothstep(sb + 9.0, sb + 0.3, s))*0.85);
  }
  if (s > -0.05 && s < sb + 0.15){
    float dlt = tau + s/spd;
    if (dlt > 0.0){
      float onset = smoothstep(sb + 0.15, sb - 0.7, s);
      float pch = smoothstep(0.3, 0.78, tN(vec2(p.x*0.45, p.y*1.6) + vec2(k3, 0.0), 7.0).r);
      float sect = 0.35 + 0.65*smoothstep(0.2, 0.7, tN(vec2(p.x*0.11 + k3*1.9, 0.37), 5.0).g);   /* whitewater thicker where it broke hardest */
      w.foam = max(w.foam, (exp(-dlt/0.9)*0.9 + exp(-dlt/2.2)*0.16*(0.25 + pch))*onset*min(amp, 2.5)*sect);
      w.lip = max(w.lip, exp(-dlt*dlt/0.02)*onset*min(amp, 2.0)*sect);
    }
  }
  /* (above the furthest any of this wave's tongues could reach there's nothing to work out) */
  if (s < 0.2 && tau > 0.0 && tau < tsw + 15.0 && -s < (0.85 + 0.75*amp)*runK(nB, a)*1.32 + 0.2){
    vec3 RD = reach(a, nB, amp, sd);
    float R = RD.x;
    if (-s < R + 0.18){
      /* a fine lace on the edge, and patches that drain, dull and pop at their own pace: new for every wave */
      vec4 nw = tN(p*vec2(0.8, 0.6) + vec2(k3*5.3, k3*1.7), 5.0);
      float r = -s - (nw.a - 0.5)*0.14*min(R, 2.5), tl = tau - RD.y, u = tl/tsw;
      float q = clamp(r/R, 0.0, 1.0), u1 = U0*(1.0 - sqrt(1.0 - q));
      if (r < R && u > u1){
        float fr = u < U0 ? R*(1.0 - (1.0-u/U0)*(1.0-u/U0)) : R, behind = fr - r, tpk = tl - U0*tsw;
        float fade = smoothstep(tsw + 15.0, tsw + 8.0, tau);
        /* the backwash doesn't peel back along a line: the thin top sinks in first, then the sheet goes patch by patch,
           and the rills that drain it last, so its edge comes apart as it thins */
        float ud = max(U0 + (1.0 - U0)*pow(1.0 - q, 0.625) + 0.34*(nw.r - 0.5) + 0.1*(nw.g - 0.5) + 0.12*(nw.a - 0.5) + 0.3*smoothstep(0.55, 0.85, rv) - 0.05, u1 + 0.04);
        float wedge = smoothstep(0.0, 0.05, behind);
        if (u < ud){
          float th = clamp(min(behind/(0.32 + R*0.45), (ud - u)*tsw/2.2), 0.0, 1.0);
          w.cover = max(w.cover, smoothstep(0.0, 0.03, behind)*smoothstep(0.0, 0.03, ud - u));
          w.depth = max(w.depth, th*(1.0 - 0.6*smoothstep(U0, 1.0, u)));
          w.wet = max(w.wet, wedge); w.gloss = max(w.gloss, wedge);
        } else {
          /* left behind, the sand shines for a moment and then dulls, and stays dark a good while longer; both go patch
             by patch (the patches matter more than the height, or the drying would walk down the beach in a line),
             and soonest high up the beach, where the water sinks in faster */
          float dt = (u - ud)*tsw, hi = smoothstep(0.3, 2.6, r);
          w.gloss = max(w.gloss, exp(-dt/(mix(2.6, 0.8, hi)*(0.35 + 1.3*nw.g)))*wedge*fade);
          w.wet = max(w.wet, exp(-dt/(mix(14.0, 6.0, hi)*(0.15 + 1.1*nw.r + 0.6*nw.a)))*wedge*fade);
        }
        /* foam: thick on the running edge, thickest at the tongues' tips; where the wave stops its froth is stranded
           along the reach, and that and the sheet's own foam thin into lace and bubbles and pop away in spots. A later
           wave sweeps away what an earlier one left (the waves come oldest first) */
        float band = exp(-behind/(0.12 + 0.14*RD.z)), film = exp(-u*4.0)*0.1*(0.3 + 1.2*nw.r);
        float fs = (u < U0 ? max(band, film) : (band*0.9 + film)*exp(-tpk/mix(0.8, 5.0, nw.a*0.6 + nw.g*0.4)))*smoothstep(0.0, 0.02, behind);
        float swept = 1.0 - smoothstep(0.06, 0.2, behind);
        w.sf = max(w.sf*swept, fs);
        /* the high-water line: where a wave stopped, a faint pale seam follows its edge, tongue for tongue, until a later
           wave runs over it; the bigger the wave, the plainer the line */
        w.mark *= swept;
        w.mark = max(w.mark, exp(-behind*behind/0.0036)*smoothstep(0.0, 1.5, tpk)*exp(-tpk/22.0)*smoothstep(0.55, 1.2, amp)*(0.35 + 0.65*smoothstep(0.3, 0.7, nw.r))*fade);
      }
    }
  }
}
Wv waves(float s, float a, float t, vec2 p){
  Wv w = Wv(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  float nA = 0.5 + 0.24*sin(a*0.19 + 1.3) + 0.18*sin(a*0.071 + 0.4) + 0.12*sin(a*0.53 + 2.0);   /* where along the beach the swell breaks sooner or later */
  float nB = 0.5 + 0.3*sin(a*0.23 + 2.1) + 0.2*sin(a*0.097 + 1.7);
  /* rills down the beach face, narrow and running straight down the slope, where the backwash drains last */
  float rv = 0.0;
  if (s < 0.2) rv = texture2DGradEXT(uNoise, vec2(a, s*0.16)/3.4, vec2(gDx.x, -gDx.y*0.16)/3.4, vec2(gDy.x, -gDy.y*0.16)/3.4).g;
  /* every wave carries a seed of its own for its tongues: a tide swell's from its phase, a clicked one's from when it lands
     (not from its slot, which shifts as swells come and go) */
  for (int j = 0; j < 6; j++){
    vec4 W = uWv[j]; if (W.y <= 0.0) continue;
    float tau = t - (W.x + 0.9*sin(a*0.11 + W.z) + a*0.03*W.w);
    wave1(w, s, a, t, p, tau, W.y, WC, 3.0 + 7.0*nA*W.y, W.z*3.7, nB, uint(W.z*4096.0), rv);
  }
  for (int k = 0; k < ${MAXUW}; k++){
    if (k >= uNUw) break;
    vec4 U = uwAt(k); if (U.y <= 0.0) continue;
    float amp = userAmp(U, a, t); if (amp < 0.02) continue;
    wave1(w, s, a, t, p, t - U.x, amp, CU, userSb(amp, nA, U), fract(U.x*0.1173)*23.0, nB, uint(U.x*64.0), rv);
  }
  /* the foot of the beach is always wet, and where the water table meets the surface it is glassy */
  { float wb = tN(vec2(p.x*0.7, p.y*0.4), 8.0).r, lo = smoothstep(-0.35 - 0.9*wb, -0.12, s); w.wet = max(w.wet, lo); w.gloss = max(w.gloss, lo*lo*0.8); }
  w.foam = max(w.foam, w.sf);
  return w;
}

float shadowAt(vec3 wp){
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMatrix*vec4(wp, 1.0); sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  vec2 tx = 1.2/uShadowSize; float z = sc.z - 0.0015;
  return 0.25*(step(z, unpackRGBAToDepth(texture2D(uShadowMap, sc.xy + vec2(-tx.x, -tx.y))))
             + step(z, unpackRGBAToDepth(texture2D(uShadowMap, sc.xy + vec2( tx.x, -tx.y))))
             + step(z, unpackRGBAToDepth(texture2D(uShadowMap, sc.xy + vec2(-tx.x,  tx.y))))
             + step(z, unpackRGBAToDepth(texture2D(uShadowMap, sc.xy + vec2( tx.x,  tx.y)))));
}

/* microfacet specular for a small bright source on a rough sea: sharp where the slopes are
   resolved (glints), widening with the sub-pixel slope variance (the far glade) */
vec3 seaSpec(vec3 N, vec3 V, vec3 L, vec3 col, float sig2){
  vec3 H = normalize(L + V);
  float NH = max(dot(N, H), 1e-3), NH2 = NH*NH;
  float a2 = 2.0*sig2 + 0.0011;
  float D = exp(-(1.0 - NH2)/(NH2*a2))/(3.14159*a2*NH2*NH2);
  float F = 0.02 + 0.98*pow(1.0 - max(dot(H, V), 0.0), 5.0);
  return col*D*F*0.25/max(dot(N, V), 0.08);
}

void main(){
  #ifdef FAR
    if (vW.x > uNearRect.x + 0.3 && vW.x < uNearRect.z - 0.3 && vW.z > uNearRect.y + 0.3 && vW.z < uNearRect.w - 0.3) discard;
  #endif
  vec3 wp = vW; vec2 p = wp.xz;
  gDx = dFdx(p); gDy = dFdy(p);
  vec3 V = normalize(cameraPosition - wp);
  float dist = length(cameraPosition - wp);
  float t = uWaveT;
  float g = shoreDZ(p.x);
  float s = (shoreZ(p.x) - p.y)/sqrt(1.0 + g*g);
  vec2 sn = normalize(vec2(g, -1.0));
  vec3 Lk = normalize(uKeyDir);
  /* the clouds' shadow here, and how much of the sun and the moon the camera sees past the clouds: their glitter on the
     sea goes as they do (it shone on under a cloud that hid the sun) */
  float cs = cloudShadow(p);
  vec3 keyC = uKeyCol*cs;
  /* (the glitter is so bright that even a tenth of it still shines: a thin cloud lets some through, a thick one none) */
  float visS = smoothstep(0.04, 0.9, texture2D(uSunVis, vec2(0.25, 0.5)).r), visM = smoothstep(0.04, 0.9, texture2D(uSunVis, vec2(0.75, 0.5)).r);
  gSunK = visS;
  vec3 sunG = uSunGlit*visS*(0.35 + 0.65*cs), moonG = uMoonGlit*visM*(0.35 + 0.65*cs);
  /* artificial light only where there is any: round the camp, round the van, and in its headlights' reach */
  bool camp = (uDbgG & 32) == 0 && (length(p - CAMP) < 24.0 || length(p - uVanPos.xz) < 14.0 || (uHead.w > 0.001 && length(p - uHead.xz) < 36.0));
  vec3 art = vec3(0.0);
  float shK = length(p - uShC.xy) < uShC.z ? mix(1.0, shadowAt(wp), uShadowK) : 1.0;
  bool glit = dot(moonG + sunG, vec3(1.0)) > 1e-6;

  Wv w = Wv(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  /* the swash runs a few metres up the sand, further under a storm's swells and much further under a big clicked one:
     look for it as far as the biggest wave about could reach, or it would stop short along a line */
  float sUp = 4.0;
  for (int j = 0; j < 6; j++) sUp = max(sUp, 1.85*(0.85 + 0.75*uWv[j].y) + 0.3);
  sUp = max(sUp, 1.85*(0.85 + 0.9*uUwMax) + 0.3);
  if ((uDbgG & 1) == 0 && s > -sUp && s < 70.0) w = waves(s, p.x, t, p);

  /* ocean surface: four octaves of directional chop; what the pixel can't resolve becomes roughness */
  vec3 Nw = vec3(0.0, 1.0, 0.0);
  /* the pixel's footprint on the water: long along the view (fpL), narrow across it (fp). The textures are filtered
     anisotropically, so an octave keeps its detail until it is too fine even across the view */
  float fpL = max(length(gDx), length(gDy)), fp = min(min(length(gDx), length(gDy))*1.6, fpL), sig2 = 0.0016;
  if (s > -2.6){
    vec2 q = vec2(-p.y, p.x);
    float calm = mix(0.4, 1.0, smoothstep(-0.2, 3.5, s));
    vec4 Tt = vec4(31.0, 9.3, 2.9, 0.9), Aa = vec4(0.22, 0.2, 0.14, 0.06), Ss = vec4(1.7, 0.95, 0.55, 0.3);
    vec2 g0 = tW(q + vec2(t*Ss.x, 0.0), Tt.x).rg*2.0 - 1.0;
    vec2 g1 = tW(mat2(0.94, 0.34, -0.34, 0.94)*q + vec2(t*Ss.y, 11.3), Tt.y).rg*2.0 - 1.0;
    vec2 g2 = tW(mat2(0.92, -0.39, 0.39, 0.92)*q + vec2(t*Ss.z, 5.1), Tt.z).rg*2.0 - 1.0;
    vec2 g3 = fp < 0.12 ? tW(mat2(0.7, 0.71, -0.71, 0.7)*q + vec2(t*Ss.w, 2.7), Tt.w).rg*2.0 - 1.0 : vec2(0.0);
    /* an octave a pixel can't resolve leaves the normal (it becomes roughness below): otherwise its
       leftovers beat against the pixel rows near the horizon and shimmer as the sea moves */
    vec4 rv = 1.0 - smoothstep(vec4(0.15), vec4(0.6), vec4(fp*24.0)/Tt);
    /* the long swell under the chop: three long trains rolling in toward the beach, as plain waves (slopes in x, z),
       still resolved far out, so the open sea keeps its long lines all the way to the horizon */
    vec2 gS = vec2(0.0);
    { vec2 d1 = vec2(0.10, 0.995), d2 = vec2(-0.22, 0.975), d3 = vec2(0.31, 0.951);
      float k1 = 0.0654, k2 = 0.0885, k3 = 0.0511;
      float a1 = k1*dot(d1, p) - t*0.80, a2 = k2*dot(d2, p) - t*0.93 + 1.7, a3 = k3*dot(d3, p) - t*0.71 + 4.1;
      gS = (d1*cos(a1)*0.022 + d2*cos(a2)*0.016 + d3*cos(a3)*0.014)*smoothstep(6.0, 40.0, s); }
    vec2 gq = (g0*Aa.x*rv.x + g1*Aa.y*rv.y + g2*Aa.z*rv.z + g3*Aa.w*rv.w)*calm;
    /* a splash of foam where the water was clicked */
    float ripF = 0.0;
    for (int i = 0; i < ${MAXRIP}; i++){
      if (i >= uNRip) break;
      vec4 R4 = texelFetch(uSurgeT, ivec2(i, 1), 0); float age = t - R4.z;
      if (R4.w <= 0.0 || age < 0.0 || age > 4.0) continue;
      vec2 dv = p - R4.xy; float g = R4.w*exp(-dot(dv, dv)/(0.8 + age*4.5))*exp(-age/1.1);
      if (g < 0.004) continue;
      ripF = max(ripF, g*(0.6 + 0.4*smoothstep(0.35, 0.65, tN(p*0.9 + R4.xy, 3.0).r)));
    }
    w.foam = max(w.foam, ripF);
    sig2 += dot((1.0 - rv), Aa*Aa*0.07)*calm*calm;
    #ifdef NEAR
      vec2 gr = vec2(gq.y, -gq.x) + gS*calm + sn*w.slope*0.12;
      Nw = normalize(vNg + vec3(-gr.x, 0.0, -gr.y));
    #else
      vec2 gr = vec2(gq.y, -gq.x) + gS*calm + sn*w.slope*0.4;
      Nw = normalize(vec3(-gr.x, 1.0, -gr.y));
    #endif
  }

  vec3 col;
  /* ── beach & forest floor ── */
  vec3 sandC = vec3(0.0);
  if (s < 0.3){
    vec4 nb = tN(p, 18.6), nm = tN(p, 3.4);
    vec4 su = tS(p, 9.5), sb = tS(p + 3.7, 2.3), sr = tS(mat2(0.96, 0.28, -0.28, 0.96)*p, 2.6);
    float grain = tS(p, 0.55).a;
    vec4 dec = vec4(0.0), rel = vec4(0.5, 0.0, 0.0, 0.0);
    vec2 rg = vec2(0.0);
    vec2 duv = (p - uDecalRect.xy)/uDecalRect.zw;
    if (duv.x > 0.0 && duv.y > 0.0 && duv.x < 1.0 && duv.y < 1.0){
      dec = texture2D(uDecal, duv); rel = texture2D(uRelief, duv);
      vec2 e = vec2(0.02/uDecalRect.z, 0.02/uDecalRect.w);
      rg += vec2(texture2D(uRelief, duv + vec2(e.x, 0.0)).r - rel.r, texture2D(uRelief, duv + vec2(0.0, e.y)).r - rel.r)*4.5;
    }
    float veg = smoothstep(-0.4, 1.4, p.y - vegZ(p.x) + (nm.r - 0.5)*1.6);
    float trample = rel.g;
    float dryness = smoothstep(-0.2, -3.5, s);
    float ripMask = smoothstep(0.42, 0.7, nb.a)*(1.0 - trample)*(1.0 - veg)*dryness;
    rg += (su.rg*2.0 - 1.0)*0.2 + (sb.rg*2.0 - 1.0)*(0.05 + 0.2*trample) + vec2(0.96, 0.28)*(sr.b*2.0 - 1.0)*0.16*ripMask;
    vec3 N = normalize(vec3(-rg.x, 1.0, -rg.y));
    vec3 alb = vec3(0.60, 0.50, 0.35)*(0.84 + 0.24*nb.r + 0.1*(nm.g - 0.5))*(0.93 + 0.1*grain)*(1.0 - 0.08*trample);
    alb *= mix(0.92, 1.04, dryness);
    alb = mix(alb, vec3(0.10, 0.11, 0.06)*(0.7 + 0.6*nb.g), veg);
    /* the high-water line: a faint pale seam of fine sand and burst bubbles, drier than the sand below it */
    float mark = w.mark*(1.0 - veg)*(1.0 - w.cover)*(1.0 - 0.7*uWet);
    float wet = max(max(w.wet, w.cover), uWet*0.85*(1.0 - 0.6*veg))*(1.0 - veg*0.4)*(1.0 - 0.5*mark);
    /* fresh from the water the sand is glassy, a film that sinks in within seconds; damp sand is only dark */
    float gloss = max(max(w.gloss, w.cover), uWet*0.55)*(1.0 - veg)*(1.0 - mark);
    vec3 a = alb*mix(1.0, 0.46, wet);
    a = mix(a, alb*1.2, mark*0.45);
    a = mix(a, dec.rgb/max(dec.a, 1e-3), dec.a);
    float ao = (1.0 - rel.b*0.85)*(1.0 - 0.85*vanAO(wp));
    if (camp) art = artLight(wp, N);
    vec3 lit = a*(uAmb*(0.7 + 0.3*N.y)*ao + keyC*max(dot(N, Lk), 0.0)*shK + art*mix(1.0, ao, 0.6));
    /* quartz glints in dry sand */
    float qz = smoothstep(0.986, 1.0, grain)*(1.0 - wet)*smoothstep(0.08, 0.02, fpL);
    lit += keyC*qz*pow(max(dot(N, normalize(Lk + V)), 0.0), 8.0)*1.6;
    if (wet > 0.01){
      /* a film of water left on the sand is a still, smooth mirror for the sky and the moon (only the sheet still running
         over it ripples); damp sand keeps a little sheen, with the grain's sparkle */
      vec3 Ns = normalize(mix(mix(N, Nw, 0.3*(1.0 - gloss)), vec3(0.0, 1.0, 0.0), 0.6*gloss));
      float F = 0.02 + 0.98*pow(1.0 - max(dot(Ns, V), 0.0), 5.0);
      vec3 R = reflect(-V, Ns); R.y = abs(R.y);
      vec3 sheen = skyRefl(R)*F + art*0.06;
      if (glit) sheen += (seaSpec(Ns, V, uMoonDirV, moonG, 0.006) + seaSpec(Ns, V, uSunDirV, sunG, 0.006))*(0.25 + 0.75*gloss);
      lit += sheen*mix(wet*0.45, max(wet, gloss), gloss)*0.85;
    }
    sandC = lit;
  }
  if (camp && s >= 0.3) art = artLight(wp, vec3(0.0, 1.0, 0.0));

  /* ── sea ── */
  vec3 seaC = vec3(0.0);
  if (uWet > 0.01 && s > -1.0 && dist < 60.0){ vec2 rr = rainRings(p, uTime*1.4)*0.35*uWet*smoothstep(60.0, 20.0, dist); Nw = normalize(Nw + vec3(rr.x, 0.0, rr.y)); }
  if (s > -2.0){
    float dz = smoothstep(-0.1, 16.0, s);
    /* clear tropical water: pale turquoise over the shallows, blue-green a little further out, deep blue at sea */
    vec3 body = mix(mix(vec3(0.05, 0.30, 0.30), vec3(0.012, 0.13, 0.15), smoothstep(0.0, 8.0, s)), vec3(0.006, 0.042, 0.078), smoothstep(6.0, 34.0, s));
    /* slopes too small to see still tilt the water toward the eye: far out it reflects less, and sky from higher up,
       so the open sea stays a shade darker than the sky over it and the horizon remains a line */
    float tilt = sqrt(sig2)*1.3;
    float NV = max(dot(Nw, V), min(tilt, 0.35));
    float F = 0.02 + 0.98*pow(1.0 - NV, 5.0);
    vec3 R = reflect(-V, Nw); R.y = abs(R.y) + 0.002 + tilt*0.6; R = normalize(R);
    vec3 lit = body*(uAmb*1.0 + keyC*(0.25 + 0.55*max(dot(Nw, Lk), 0.0)) + art*0.5);
    /* in the shallows the sandy bottom shows through, bent a little by the ripples, tinted by the water over it and
       laced with caustics by day; it fades out as the water deepens */
    float clar = exp(-max(s, 0.0)*0.3)*(1.0 - 0.5*uRough);
    if (clar > 0.01){
      vec2 bp = p + (Nw.xz/max(Nw.y, 0.3))*0.25*clamp(s, 0.0, 4.0);
      vec3 sandB = vec3(0.56, 0.48, 0.34)*(0.84 + 0.28*tN(bp, 18.6).r);
      float caus = 0.0;
      if (uDay > 0.01){ float c1 = tW(bp + vec2(t*0.08, t*0.03), 1.4).a, c2 = tW(bp - vec2(t*0.06, -t*0.044) + 0.38, 1.06).a; caus = pow(c1*c2, 1.4)*uDay; }
      vec3 bottom = sandB*(uAmb*0.9 + keyC*(0.6*max(Lk.y, 0.0) + 0.7*caus) + art*0.6)*mix(vec3(1.0), vec3(0.55, 0.86, 0.84), smoothstep(0.0, 2.5, s));
      lit = mix(lit, bottom, clar);
    }
    lit = lit*(1.0 - F) + skyRefl(R)*F;
    if (glit) lit += seaSpec(Nw, V, uMoonDirV, moonG, sig2) + seaSpec(Nw, V, uSunDirV, sunG, sig2);
    #ifdef NEAR
      float face = clamp(dot(vNg.xz, -sn)*4.0, 0.0, 1.0), crestL = smoothstep(0.15, 0.9, vH);
      lit = lit*(1.0 - 0.5*face) + body*(uAmb*2.5 + keyC*0.6)*crestL*0.6;
    #endif
    seaC = lit;
  }
  float seaMix = smoothstep(-0.02, 0.24, s);
  col = mix(sandC, seaC, seaMix);

  /* swash sheet: a film draining away looks much like the glassy sand under it, so it fades as it thins */
  if (w.cover > 0.001){
    float cov = w.cover*(1.0 - seaMix)*(0.4 + 0.6*smoothstep(0.0, 0.4, w.depth));
    float F = 0.02 + 0.98*pow(1.0 - max(dot(Nw, V), 0.0), 5.0);
    vec3 R = reflect(-V, Nw); R.y = abs(R.y);
    vec3 sheet = col*mix(0.82, 0.62, w.depth) + skyRefl(R)*F*0.9;
    if (glit) sheet += (seaSpec(Nw, V, uMoonDirV, moonG, sig2) + seaSpec(Nw, V, uSunDirV, sunG, sig2))*0.8;
    col = mix(col, sheet, cov);
  }

  /* foam: dense whitewater with holes that open up into marbled lace */
  if ((uDbgG & 16) == 0 && (w.foam > 0.02 || w.lip > 0.02)){
    /* the swash's froth is bubbles, and stays where it was left; the open water's foam is a marbled web that rides on */
    float swf = clamp(w.sf/max(w.foam, 0.02), 0.0, 1.0);
    vec2 fuv = p - sn*WC*0.3*min(w.foam, 1.0)*(1.0 - swf);
    vec4 fa = tW(fuv + vec2(t*0.014, t*0.005), 3.6), fb = tW(fuv - vec2(t*0.022, -t*0.01) + 0.74, 2.3);
    vec4 fn = tW(vec2(fuv.x*0.7, fuv.y*1.2) + vec2(t*0.01, 0.0), 4.8);
    float holes = min(fa.a, fb.a + 0.12), net = max(fn.b, fb.b*0.7);
    float dens = clamp(w.foam, 0.0, 1.0);
    float lace = mix(net, holes, max(smoothstep(0.25, 0.75, dens), swf));
    float thr = 0.97 - dens*1.02;
    float fw = max(0.07, fwidth(lace)*1.6);
    float foamV = mix(smoothstep(thr - fw, thr + fw, lace), clamp(dens*0.85, 0.0, 1.0), smoothstep(0.12, 0.45, fw))*smoothstep(0.08, 0.24, dens);
    foamV = max(foamV, w.lip*0.95*smoothstep(0.1, 0.45, holes));
    vec3 foamLit = vec3(0.9, 0.92, 0.94)*(uAmb*1.2 + keyC*max(Lk.y, 0.15) + art*0.6);
    col = mix(col, foamLit, foamV*0.94);
  }

  /* air between here and the horizon: far water fades toward the sky just over it, but never all the way */
  col = mix(col, uHor*0.95, (1.0 - exp(-max(dist - 60.0, 0.0)/(2600.0/max(uMist, 0.3))))*0.88);
  col = mix(col, uHor*0.9, (1.0 - exp(-dist/400.0))*0.07*uMist);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

  /* post: bloom + finish */
  const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const DOWN_FS = `
uniform sampler2D uSrc, uFire; uniform vec2 uTexel; uniform float uThresh, uPre, uExp, uFireOn; varying vec2 vUv;
vec3 pre(vec3 c){
  float b = max(c.r, max(c.g, c.b)), knee = uThresh*0.6;
  float soft = clamp(b - uThresh + knee, 0.0, 2.0*knee); soft = soft*soft/(4.0*knee + 1e-4);
  return c*max(soft, b - uThresh)/max(b, 1e-4);
}
void main(){
  vec2 h = uTexel;
  vec3 c = texture2D(uSrc, vUv).rgb*4.0 + texture2D(uSrc, vUv - h).rgb + texture2D(uSrc, vUv + h).rgb
         + texture2D(uSrc, vUv + vec2(h.x, -h.y)).rgb + texture2D(uSrc, vUv - vec2(h.x, -h.y)).rgb;
  c /= 8.0;
  if (uPre > 0.5){ if (uFireOn > 0.5) c += texture2D(uFire, vUv).rgb; c = pre(min(c*uExp, vec3(14.0))); }
  gl_FragColor = vec4(c, 1.0);
}`;
  const UP_FS = `
uniform sampler2D uSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec2 h = uTexel;
  vec3 c = texture2D(uSrc, vUv + vec2(-h.x*2.0, 0.0)).rgb + texture2D(uSrc, vUv + vec2(h.x*2.0, 0.0)).rgb
         + texture2D(uSrc, vUv + vec2(0.0, h.y*2.0)).rgb + texture2D(uSrc, vUv + vec2(0.0, -h.y*2.0)).rgb
         + (texture2D(uSrc, vUv + vec2(-h.x, h.y)).rgb + texture2D(uSrc, vUv + vec2(h.x, h.y)).rgb
         +  texture2D(uSrc, vUv + vec2(h.x, -h.y)).rgb + texture2D(uSrc, vUv + vec2(-h.x, -h.y)).rgb)*2.0;
  gl_FragColor = vec4(c/12.0, 1.0);
}`;
  /* depth of field, gathered at half resolution: each tap counts if its own blur circle reaches
     this pixel, and background taps may not spread over a sharper foreground */
  const DOF_FS = `
uniform sampler2D uScene, uDepth; uniform vec2 uTexel; uniform float uK, uZf, uNear, uFar, uMax;
varying vec2 vUv;
float linZ(float d){ return uNear*uFar/(uFar - d*(uFar - uNear)); }
float coc(float z){ float c = uK*abs(1.0 - uZf/z); if (z > uZf) c *= mix(1.0, 0.35, smoothstep(120.0, 700.0, z)); else c *= 0.3; return min(c, uMax); }
void main(){
  float zc = linZ(texture2D(uDepth, vUv).r), cc = coc(zc);
  vec3 acc = texture2D(uScene, vUv).rgb; float ws = 1.0, fg = 0.0;
  for (int i = 0; i < 30; i++){
    float k = float(i), ring, ang;
    if (i < 6){ ring = 0.3; ang = k/6.0; } else if (i < 16){ ring = 0.62; ang = (k - 6.0)/10.0 + 0.05; } else { ring = 1.0; ang = (k - 16.0)/14.0 + 0.11; }
    ang = (ang + fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)))*43758.5453)*0.07)*6.28318;   /* (turned a little per pixel: no rings) */
    float dist = ring*uMax;
    vec2 uv = vUv + vec2(cos(ang), sin(ang))*dist*uTexel;
    float zi = linZ(texture2D(uDepth, uv).r), ci = coc(zi);
    float ce = zi > zc ? min(ci, cc) : ci;
    float w = clamp(ce - dist + 1.0, 0.0, 1.0);
    acc += min(texture2D(uScene, uv).rgb, vec3(2.0))*w; ws += w;          /* (the sun can't stamp the pattern) */
    if (zi < zc) fg = max(fg, w*smoothstep(0.8, 3.0, ci));
  }
  gl_FragColor = vec4(acc/ws, max(smoothstep(0.7, 2.6, cc), fg));
}`;

  /* screen-space ambient occlusion from the depth buffer, half resolution */
  const SSAO_FS = `
uniform sampler2D uDepth; uniform vec2 uTexel; uniform mat4 uProj, uInvProj; uniform float uRad;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec3 vpos(vec2 uv){ float d = texture2D(uDepth, uv).r; vec4 p = uInvProj*vec4(uv*2.0 - 1.0, d*2.0 - 1.0, 1.0); return p.xyz/p.w; }
void main(){
  float d0 = texture2D(uDepth, vUv).r;
  if (d0 > 0.99995){ gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv);
  /* far off, the depth buffer is too coarse to say anything about occlusion: there it would only
     paint bands that crawl as the view moves, so ambient occlusion fades out past ~70 m */
  float farK = smoothstep(95.0, 50.0, -P.z);
  if (farK <= 0.0){ gl_FragColor = vec4(1.0); return; }
  vec2 ex = vec2(uTexel.x*2.0, 0.0), ey = vec2(0.0, uTexel.y*2.0);
  vec3 a1 = vpos(vUv + ex) - P, a2 = P - vpos(vUv - ex), b1 = vpos(vUv + ey) - P, b2 = P - vpos(vUv - ey);
  vec3 dx = abs(a1.z) < abs(a2.z) ? a1 : a2, dy = abs(b1.z) < abs(b2.z) ? b1 : b2;
  vec3 N = normalize(cross(dx, dy)); if (dot(N, P) > 0.0) N = -N;
  float an = h12(floor(gl_FragCoord.xy))*6.2831;
  vec3 T1 = normalize(cross(N, vec3(cos(an), sin(an), 0.37))), B1 = cross(N, T1);
  float rad = uRad*clamp(-P.z/6.0, 0.35, 3.0), occ = 0.0;
  for (int i = 0; i < 12; i++){
    float k = (float(i) + 0.5)/12.0, ang = float(i)*2.39996 + an;
    vec3 h = normalize(T1*cos(ang) + B1*sin(ang) + N*(0.35 + 0.65*fract(k*7.31 + 0.13)));
    vec3 S = P + h*rad*mix(0.12, 1.0, k*k);
    vec4 c = uProj*vec4(S, 1.0); vec2 su = c.xy/c.w*0.5 + 0.5;
    if (su.x < 0.0 || su.y < 0.0 || su.x > 1.0 || su.y > 1.0) continue;
    float sz = vpos(su).z;
    occ += step(S.z + 0.02*rad, sz)*smoothstep(0.0, 1.0, rad/max(abs(P.z - sz), 1e-3));
  }
  gl_FragColor = vec4(vec3(clamp(1.0 - occ/12.0*farK, 0.0, 1.0)), 1.0);
}`;
  const AOBLUR_FS = `
uniform sampler2D uAO, uDepth; uniform vec2 uTexel; uniform float uNear, uFar;
varying vec2 vUv;
float lz(float d){ return uNear*uFar/(uFar - d*(uFar - uNear)); }
void main(){
  float z0 = lz(texture2D(uDepth, vUv).r), s = 0.0, w = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
    vec2 uv = vUv + vec2(float(i), float(j))*uTexel;
    float z = lz(texture2D(uDepth, uv).r), k = exp(-abs(z - z0)/(0.04*z0 + 0.02));
    s += texture2D(uAO, uv).r*k; w += k;
  }
  gl_FragColor = vec4(vec3(s/max(w, 1e-4)), 1.0);
}`;
  /* volumetric campfire: ray-marched through a turbulent temperature field inside a cylinder,
     stopping at whatever the depth buffer says is in front (logs, kettle, stones) */
  const FIRE_FS = `
uniform sampler2D uDepth; uniform highp sampler3D uN3;
uniform mat4 uInvProj, uCamW; uniform vec3 uCamP, uFC; uniform float uT, uI, uFlick, uDbgF;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec3 fireCol(float x){
  vec3 c = mix(vec3(0.42, 0.035, 0.0), vec3(1.0, 0.27, 0.025), smoothstep(0.05, 0.42, x));
  c = mix(c, vec3(1.0, 0.62, 0.22), smoothstep(0.42, 0.78, x));
  return mix(c, vec3(1.0, 0.86, 0.6), smoothstep(0.8, 1.0, x));
}
void main(){
  const float RC = 0.36, H = 0.86;
  vec4 vp = uInvProj*vec4(vUv*2.0 - 1.0, 1.0, 1.0); vec3 vd = normalize(vp.xyz/vp.w);
  vec3 rd = normalize((uCamW*vec4(vd, 0.0)).xyz), o = uCamP - uFC;
  float dep = texture2D(uDepth, vUv).r; vec4 sp = uInvProj*vec4(vUv*2.0 - 1.0, dep*2.0 - 1.0, 1.0); float sceneT = length(sp.xyz/sp.w);
  float a = dot(rd.xz, rd.xz), b = dot(o.xz, rd.xz), c = dot(o.xz, o.xz) - RC*RC, disc = b*b - a*c;
  if (disc <= 0.0){ gl_FragColor = vec4(0.0); return; }
  float sq = sqrt(disc), t0 = (-b - sq)/a, t1 = (-b + sq)/a;
  float ty0 = (0.0 - o.y)/rd.y, ty1 = (H - o.y)/rd.y; if (ty0 > ty1){ float tt = ty0; ty0 = ty1; ty1 = tt; }
  t0 = max(max(t0, ty0), 0.0); t1 = min(min(t1, ty1), sceneT);
  if (t1 <= t0){ gl_FragColor = vec4(0.0); return; }
  if (uDbgF > 0.5 && uDbgF < 1.5){ gl_FragColor = vec4(0.03*(t1 - t0), 0.0, 0.0, 1.0); return; }
  float dt = (t1 - t0)/26.0, jit = h12(gl_FragCoord.xy + fract(uT*3.7)*vec2(31.7, 17.3));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 26; i++){
    vec3 p = o + rd*(t0 + (float(i) + jit)*dt);
    float y = p.y/H;
    if (y < 0.0 || y > 1.0) continue;
    float sway = 0.04*sin(uT*1.7 + p.y*5.0) + 0.03*sin(uT*2.9 + p.y*9.0);
    vec2 xz = p.xz - vec2(sway, sway*0.6)*y;
    float r = length(xz);
    vec3 q = vec3(xz.x*2.8, p.y*1.25 - uT*1.05, xz.y*2.8);
    float n = texture(uN3, q*0.5).r*0.55 + texture(uN3, q*1.13 + vec3(0.31, 0.0, 0.57)).r*0.3 + texture(uN3, q*2.4 + vec3(0.7, 0.2, 0.1)).r*0.15;
    float nc = smoothstep(0.3, 0.7, n);
    float rad = mix(0.24, 0.1, pow(y, 0.8))*(0.85 + 0.3*nc);
    float shape = clamp(1.0 - r/rad, 0.0, 1.0);
    float temp = shape*1.3 - y*0.65 + (nc - 0.5)*(0.6 + 1.0*y) + 0.08*(1.0 - y)*uFlick;
    temp = clamp(temp, 0.0, 1.0);
    float em = temp*temp*0.75;
    acc += fireCol(temp)*em*dt;
    if (uDbgF > 1.5) acc += vec3(0.0, 0.02*n, 0.02*y)*dt;
  }
  gl_FragColor = vec4(acc*uI, 1.0);
}`;
  const FINAL_FS = `
uniform sampler2D uScene, uBloom, uDof, uAO, uFire; uniform vec2 uRes; uniform float uExp, uBloomK, uFade, uTime, uNight, uDofOn, uGrain, uVeil, uAOk, uFireOn;
uniform vec4 uHaze; uniform sampler2D uNoiseT; uniform float uRain, uRainT, uRainSlant;
uniform vec4 uSunScr;       /* where the sun is on screen (x, y), and how much glare it may make */
uniform sampler2D uCloudB; uniform float uCloudBOn;   /* the clouds (their alpha: how much of the sky shows through) */
uniform sampler2D uSunVis;  /* how much of the sun's disc shows past the clouds (left), and the moon's (right) */
varying vec2 vUv;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float rainStreaks(vec2 uv){
  float acc = 0.0, asp = uRes.x/uRes.y;
  for (int l = 0; l < 3; l++){
    float fl = float(l), sc = 55.0 + 60.0*fl, sp = 1.7 + 0.8*fl, len = 0.075 - 0.018*fl;
    vec2 p = vec2((uv.x + uv.y*uRainSlant)*asp*sc, uv.y + uRainT*sp);
    float col = floor(p.x), fx = fract(p.x);
    float h = hash12(vec2(col, fl*17.0)), ph = hash12(vec2(col, fl*17.0 + 5.3));
    float y = fract(p.y/len*0.25 + ph*7.0);
    float x0 = 0.25 + 0.5*hash12(vec2(col, floor(p.y/len*0.25 + ph*7.0) + fl*3.1));
    float on = step(1.0 - 0.55*uRain, hash12(vec2(col, floor(p.y/len*0.25 + ph*7.0) + 11.0 + fl)));
    acc += on*smoothstep(0.09, 0.0, abs(fx - x0))*smoothstep(0.0, 0.25, y)*smoothstep(0.62, 0.3, y)*(0.45 + 0.3*fl);
  }
  return acc;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 uv = vUv;
  if (uHaze.w > 0.001){
    vec2 dq = (uv - uHaze.xy)*vec2(uRes.x/uRes.y, 1.0);
    float m = exp(-dq.x*dq.x/(uHaze.z*uHaze.z*0.35))*smoothstep(-uHaze.z*0.3, uHaze.z*0.5, dq.y)*exp(-max(dq.y, 0.0)/(uHaze.z*2.2));
    vec2 nn = texture2D(uNoiseT, vec2(uv.x*7.0, uv.y*3.5 - uTime*0.55)).rg - 0.5;
    uv += nn*uHaze.w*m*vec2(0.006, 0.004);
  }
  vec3 sc = texture2D(uScene, uv).rgb;
  float ao = texture2D(uAO, uv).r;
  float lumS = dot(sc*uExp, vec3(0.2126, 0.7152, 0.0722));
  sc *= mix(1.0, ao, uAOk*(1.0 - smoothstep(0.6, 2.5, lumS)));
  if (uDofOn > 0.5){ vec4 df = texture2D(uDof, uv); sc = mix(sc, df.rgb, df.a); }
  if (uFireOn > 0.5) sc += texture2D(uFire, uv).rgb;
  vec3 hdr = sc*uExp + texture2D(uBloom, vUv).rgb*uBloomK;
  /* the sun's glare: a tight burn, a soft corona and six faint rays, only as far as the sun itself shows (cloud, a palm or
     the van in front of it take it away) */
  if (uSunScr.z > 0.001){
    vec2 px = 2.0/uRes, sp = uSunScr.xy; float sl = 0.0;
    for (int k = 0; k < 5; k++){ vec2 o = k == 0 ? vec2(0.0) : vec2(k == 1 ? 1.0 : k == 2 ? -1.0 : 0.0, k == 3 ? 1.0 : k == 4 ? -1.0 : 0.0)*px*3.0; sl += dot(texture2D(uScene, sp + o).rgb, vec3(0.2126, 0.7152, 0.0722)); }
    float vis = smoothstep(1.2, 6.0, sl/5.0*uExp)*uSunScr.z*smoothstep(0.1, 0.85, texture2D(uSunVis, vec2(0.25, 0.5)).r);
    vec2 q = (vUv - sp)*vec2(uRes.x/uRes.y, 1.0); float r = length(q), an = atan(q.y, q.x);
    float rays = pow(abs(cos(an*3.0 + 0.35)), 160.0) + 0.45*pow(abs(cos(an*3.0 + 0.35 + 0.5236)), 360.0);
    hdr += vec3(1.0, 0.9, 0.76)*vis*(exp(-r/0.018)*0.8 + exp(-r/0.07)*0.1 + rays*exp(-r/0.11)*0.24);
  }
  if (uRain > 0.001){ float r = rainStreaks(vUv), bl = dot(hdr, vec3(0.2126, 0.7152, 0.0722)); hdr += vec3(0.75, 0.8, 0.9)*r*uRain*(0.035 + 0.35*bl); hdr *= 1.0 - 0.12*uRain; }
  vec3 m = aces(hdr);
  float l = dot(m, vec3(0.2126, 0.7152, 0.0722));
  float sat = max(m.r, max(m.g, m.b)) - min(m.r, min(m.g, m.b));
  vec3 scot = vec3(l)*vec3(0.72, 0.88, 1.26);
  float dark = (1.0 - smoothstep(0.03, 0.4, l))*(1.0 - smoothstep(0.12, 0.45, sat));
  m = mix(m, scot, 0.55*dark*uNight);
  m = mix(m, m*vec3(1.04, 1.0, 0.95), smoothstep(0.3, 0.8, l)*0.45*uNight);
  vec2 q = (vUv - 0.5)*vec2(uRes.x/uRes.y, 1.0);
  m *= mix(0.66, 1.0, smoothstep(1.2, 0.3, length(q)));
  vec3 c = pow(m, vec3(1.0/2.2));
  c = mix(c, vec3(0.05, 0.055, 0.07), uVeil);
  float gs = max(1.0, uRes.y/1080.0*1.25);
  vec2 gp = floor(gl_FragCoord.xy/gs);
  float gn = hash12(gp + fract(uTime*7.31)*vec2(91.7, 37.3)) + hash12(gp*1.37 + fract(uTime*3.17)*vec2(17.1, 71.9)) - 1.0;
  float gl = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += gn*uGrain*(0.55 + 1.6*gl*(1.0 - gl));
  c *= uFade;
  c += (hash12(gl_FragCoord.xy + fract(uTime*7.13)*91.7) - 0.5)/255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

  /* a firefly: dark most of the time, then a short flash (a quick rise, a slower fade) at an unsteady rhythm of its own,
     every few seconds, now and then missing one. Most flash once, some twice in quick succession, a few glow softly.
     It wanders slowly about its home, and climbs a few centimetres as it flashes (the J of its flight); it drops back in
     the dark, where no one sees */
  const FLY = `
float flyHash(float n){ return fract(sin(n*91.345 + 0.17)*43758.5453); }
float flyEnv(float u, float rise, float fall){ return u < 0.0 ? 0.0 : smoothstep(0.0, rise, u)*exp(-max(0.0, u - rise)/fall); }
/* how bright (0..1) firefly h is at time t, and how far through its flash (for the climb) */
float flyFlash(float t, float h, out float lift){
  float kind = fract(h*7.31), P = kind < 0.72 ? 2.6 + 2.0*fract(h*13.7) : kind < 0.92 ? 3.8 + 2.2*fract(h*13.7) : 6.0 + 3.0*fract(h*13.7);
  float tt = t + h*61.0, n = floor(tt/P), u = tt - n*P;
  float skip = step(0.85, flyHash(n*1.71 + h*13.1));                      /* a missed flash now and then */
  u -= flyHash(n*3.13 + h*7.7)*0.45*P;                                    /* and never quite on the beat */
  float f = kind < 0.72 ? flyEnv(u, 0.07, 0.24)
          : kind < 0.92 ? flyEnv(u, 0.05, 0.12) + flyEnv(u - 0.42, 0.05, 0.12)
          : flyEnv(u, 0.35, 0.6)*0.75;
  lift = clamp(u/0.7, 0.0, 1.0);
  return f*(1.0 - skip);
}
vec3 flyPath(vec3 home, float t, float h, float lift){
  return home + vec3(sin(t*0.13 + h*12.0)*1.1 + sin(t*0.31 + h*5.0)*0.35,
                     sin(t*0.17 + h*7.0)*0.32 + sin(t*0.43 + h*3.0)*0.08 + 0.07*lift*lift,
                     cos(t*0.11 + h*9.0)*1.1 + cos(t*0.29 + h*2.0)*0.35);
}`;
  /* the clouds are marched a quarter of the screen's pixels at a time: each frame one pixel of every two-by-two block
     (which one turns round over four frames), at the full resolution; the resolve below fills in the rest from the
     frames before, so they come out as sharp as the screen at the cost of a half-size march */
  const CLOUD_FS = `
${COMMON}
${SKY_FN}
uniform float uTime, uStars, uCloud, uEnv; uniform vec3 uCloudLit;
uniform float uCirrus, uAlto, uCumulus, uStratus, uStorm, uFlash; uniform vec4 uBolt; uniform vec2 uWind;
uniform sampler2D uNoise; uniform float uCloudT;
uniform vec3 uCO; uniform float uCQ;
uniform mat4 uInvProj; uniform mat3 uCamRot; uniform float uFrame; uniform vec2 uOff, uFull;
varying vec2 vUv;
${CLOUD_FN}
void main(){
  vec2 fp = (floor(gl_FragCoord.xy)*2.0 + uOff + 0.5)/uFull;
  vec4 v = uInvProj*vec4(fp*2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(uCamRot*(v.xyz/v.w));
  vec3 Ld = dot(uSunDisc, uSunDisc) > dot(uMoonDisc, uMoonDisc)*40.0 ? uSunDirV : uMoonDirV;
  /* a fresh jitter each frame: averaged over frames, the steps' grain smooths away */
  gl_FragColor = d.y < -0.012 ? vec4(0.0, 0.0, 0.0, 1.0) : cloudLayer(d, Ld, skyColor(d), fract(hash12(gl_FragCoord.xy + uOff*17.0) + uFrame*0.6180339));
}`;
  /* how much of the sun (the left pixel) and the moon (the right) shows past the clouds, as the camera sees them: five
     rays across each disc, marched through the clouds as the view's are (for the sun's glitter on the sea and its glare,
     which shone on under a cloud that hid it) */
  const CLOUDVIS_FS = `
${COMMON}
${SKY_FN}
uniform float uTime, uStars, uCloud, uEnv; uniform vec3 uCloudLit;
uniform float uCirrus, uAlto, uCumulus, uStratus, uStorm, uFlash; uniform vec4 uBolt; uniform vec2 uWind;
uniform sampler2D uNoise; uniform float uCloudT;
uniform vec3 uCO; uniform float uCQ;
varying vec2 vUv;
${CLOUD_FN}
void main(){
  vec3 d = gl_FragCoord.x < 1.0 ? uSunDirV : uMoonDirV, ax = normalize(cross(d, vec3(0.0, 1.0, 0.0))), ay = cross(ax, d);
  float T = 0.0;
  for (int k = 0; k < 5; k++){
    vec2 o = k == 0 ? vec2(0.0) : vec2(cos(float(k)*1.5708 + 0.4), sin(float(k)*1.5708 + 0.4))*0.011;
    vec3 dk = normalize(d + ax*o.x + ay*o.y);
    T += cloudLayer(dk, d, skyColor(dk), 0.5).a;
  }
  gl_FragColor = vec4(d.y < -0.03 ? 0.0 : T/5.0, 0.0, 0.0, 1.0);
}`;
  /* the clouds kept over frames, at the full resolution: each pixel is last frame's, read from where that cloud stood on
     last frame's screen (the camera turns and moves, and the clouds drift on the wind: both are followed, so a cloud
     moving fast across a time-lapse leaves no trail); never straying outside what this frame's marched neighbourhood
     allows (variance clipping, as in three-clouds), and where it had to be pulled in far, this frame's own march is
     trusted instead; the pixels marched this frame blend their new look in */
  const CLOUD_RES_FS = `
uniform sampler2D uCur, uHist; uniform mat4 uPrevVP, uInvProj; uniform mat3 uCamRot; uniform float uHasPrev, uAlpha; uniform vec2 uOff, uFull;
uniform vec3 uCamD;     /* how far the camera moved since the last frame */
uniform vec2 uDriftD;   /* how far the clouds drifted on the wind since the last frame (x, z) */
uniform vec2 uShell;    /* the height the camera sees from, and the height the clouds are mostly seen at */
uniform float uAltoOn;  /* is there altocumulus above them (higher, and on a stronger wind: it moves otherwise) */
varying vec2 vUv;
${CATMULL}
float shellT(float h0, float dy, float H){ const float RE = 6.371e6; float b = (RE + h0)*dy, c = (H - h0)*(2.0*RE + H + h0), s = sqrt(b*b + c); return b >= 0.0 ? c/(b + s) : s - b; }
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy), blk = ip/2, hs = textureSize(uCur, 0), cs = hs - 1;
  bool fresh = ip.x - blk.x*2 == int(uOff.x) && ip.y - blk.y*2 == int(uOff.y);
  vec4 now = texelFetch(uCur, clamp(blk, ivec2(0), cs), 0);
  /* (this frame's march, spread smoothly over the pixels it skipped: what a pixel with no past shows) */
  vec4 smooth4 = texture2D(uCur, (vec2(ip) + 1.0 - uOff)/(2.0*vec2(hs)));
  if (uHasPrev < 0.5){ gl_FragColor = fresh ? now : smooth4; return; }
  vec4 v = uInvProj*vec4((vec2(ip) + 0.5)/uFull*2.0 - 1.0, 1.0, 1.0); vec3 d = normalize(uCamRot*(v.xyz/v.w));
  /* where the cloud seen along d stood a frame ago, as seen from where the camera stood */
  float tm = min(shellT(uShell.x, max(d.y, 0.0), uShell.y), 40000.0);
  vec3 dp = normalize(d*tm + uCamD - vec3(uDriftD.x, 0.0, uDriftD.y));
  vec4 pc = uPrevVP*vec4(dp, 0.0);
  vec2 pu = pc.w > 1e-4 ? pc.xy/pc.w*0.5 + 0.5 : vec2(-1.0);
  if (pu.x < 0.0 || pu.y < 0.0 || pu.x > 1.0 || pu.y > 1.0){ gl_FragColor = fresh ? now : smooth4; return; }
  vec4 h0 = max(catmullRom(uHist, pu), vec4(0.0));
  vec4 m1 = vec4(0.0), m2 = vec4(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec4 s = texelFetch(uCur, clamp(blk + ivec2(i, j), ivec2(0), cs), 0); m1 += s; m2 += s*s; }
  m1 /= 9.0; vec4 sd = sqrt(max(m2/9.0 - m1*m1, vec4(0.0)));
  /* (or, had it been altocumulus there, where that stood: whichever of the two agrees better with this frame) */
  if (uAltoOn > 0.5){
    float ta = min(shellT(uShell.x, max(d.y, 0.0), 5420.0), 60000.0);
    vec4 pa = uPrevVP*vec4(normalize(d*ta + uCamD - 1.3*vec3(uDriftD.x, 0.0, uDriftD.y)), 0.0);
    vec2 ua = pa.w > 1e-4 ? pa.xy/pa.w*0.5 + 0.5 : vec2(-1.0);
    if (ua.x >= 0.0 && ua.y >= 0.0 && ua.x <= 1.0 && ua.y <= 1.0){ vec4 ha = max(catmullRom(uHist, ua), vec4(0.0)); if (length(ha - m1) < length(h0 - m1)) h0 = ha; }
  }
  vec4 hist = clamp(h0, m1 - 1.6*sd - 0.002, m1 + 1.6*sd + 0.002);
  /* (history that had to be pulled in far no longer belongs here: this frame's own march, spread smoothly, instead of
     a clamp to a box that is the same over each two-by-two block) */
  hist = mix(hist, smooth4, clamp(length(h0 - hist)*8.0, 0.0, 1.0));
  /* (a fresh look is steadied a little by its neighbours' before it is blended in: the march's grain settles sooner) */
  gl_FragColor = fresh ? mix(hist, mix(now, m1, 0.3), uAlpha) : hist;
}`;
  return { MAXUW, MAXRIP, FLY, COMMON, SKY_FN, SKY_VS, SKY_FS, CLOUD_FS, CLOUDVIS_FS, CLOUD_RES_FS, CLOUDSHADOW, ART, WAVEH, GROUND_VS, GROUND_FS, QUAD_VS, DOWN_FS, UP_FS, FINAL_FS, DOF_FS, SSAO_FS, AOBLUR_FS, FIRE_FS };
})();
