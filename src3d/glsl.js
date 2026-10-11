/* ─────────────────────────────────────────────────────────────
   glsl.js — shader sources: sky dome, sand+sea ground, shared
   artificial lighting, post (bloom + filmic finish).
   ───────────────────────────────────────────────────────────── */
const GLSL = (() => {
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
  c += uSunDisc*(pow(cs, 1200.0)*0.06 + pow(cs, 70.0)*0.01 + pow(cs, 8.0)*0.0035);
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

  const SKY_FS = `
${COMMON}
${SKY_FN}
uniform float uStars, uTime, uPhaseC, uPhaseSign, uCloud, uMoonR, uSunR, uEnv; uniform vec3 uCloudLit;
uniform float uCirrus, uAlto, uCumulus, uStratus, uStorm, uFlash; uniform vec4 uBolt; uniform vec2 uWind;
uniform sampler2D uNoise;
uniform float uCloudT;      /* the clouds' own clock: they drift on the wind and their shapes keep changing */
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 c = skyColor(d);
  if (d.y > -0.004){
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
    /* clouds, in kinds: high cirrus wisps, a mid mackerel layer of altocumulus, a flat stratus deck for rain,
       a bank of cumulus heaped on the horizon, and a thunderhead with an anvil for storms. Each is lit by the
       moon or the sun: brighter on the side facing the light, darker underneath, a thin bright lining near it. */
    float cm = max(dot(d, uMoonDirV), 0.0);
    vec2 hs = normalize(uSunDirV.xz + vec2(1e-5)), hd = normalize(d.xz + vec2(1e-5));
    float az = max(dot(hd, hs), 0.0);
    float cy = max(d.y, 0.0), cover = 0.0;
    vec3 amb = mix(uZen, uHor, 0.45);
    vec3 halo = uMoonDisc*(pow(cm, 40.0)*0.55 + pow(cm, 8.0)*0.12) + uGlow*(0.7*pow(az, 3.0) + 0.12);
    vec2 wnd = normalize(uWind + vec2(1e-4)), wnp = vec2(-wnd.y, wnd.x);
    /* the light's direction in (azimuth, elevation): the moon by night, the sun by day */
    vec3 Ld = dot(uSunDisc, uSunDisc) > dot(uMoonDisc, uMoonDisc)*40.0 ? uSunDirV : uMoonDirV;
    float a = atan(d.x, -d.z), e = asin(clamp(d.y, -1.0, 1.0));
    vec2 L2 = normalize(vec2(atan(Ld.x, -Ld.z) - a, asin(clamp(Ld.y, -1.0, 1.0)) - e) + vec2(1e-5));
    if (uCirrus > 0.001){
      float ct = uCloudT;
      vec2 p = d.xz/(cy + 0.09)*0.14 + wnd*ct*0.0035;
      vec2 q = vec2(dot(p, wnd), dot(p, wnp));
      q += 0.12*vec2(texture2D(uNoise, p*0.6 + vec2(ct*0.0021, 0.0)).r - 0.5, texture2D(uNoise, p*0.6 + 0.37 - vec2(0.0, ct*0.0017)).g - 0.5);
      float fib = texture2D(uNoise, vec2(q.x*0.3 + ct*0.0016, q.y*2.6)).g*0.6 + texture2D(uNoise, vec2(q.x*0.8 - ct*0.0011, q.y*6.0) + 0.21).a*0.4;
      float mask = smoothstep(0.36 - 0.18*uCirrus, 0.62, texture2D(uNoise, p*0.3 + 0.5 + vec2(-ct*0.0006, ct*0.0004)).r*0.75 + texture2D(uNoise, p*0.13 + vec2(0.3, ct*0.0005)).g*0.25);
      float den = smoothstep(0.4, 0.66, fib)*mask*smoothstep(0.0, 0.035, cy)*uCirrus;
      vec3 col = amb*1.9 + uCloudLit*1.9 + halo*1.2 + uGlow*1.1*pow(az, 1.5);
      c = mix(c, col, den); cover += den*0.35;
    }
    if (uAlto > 0.001){
      float ct = uCloudT;
      vec2 p = d.xz/(cy + 0.045)*0.06 + wnd*ct*0.0045;
      vec2 g = vec2(dot(p, wnd)*6.0, dot(p, wnp)*10.0); vec2 gi = floor(g), gf = fract(g); float f1 = 9.0; vec2 cc = vec2(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(float(i), float(j)); vec2 r = o + vec2(hash12(gi + o), hash12(gi + o + 17.3))*0.7 + 0.15; float dd = length(r - gf); if (dd < f1) { f1 = dd; cc = r; } }
      float puff = 1.0 - smoothstep(0.2, 0.55, f1 + 0.26*(texture2D(uNoise, p*3.0 + vec2(ct*0.011, -ct*0.008)).a - 0.5));
      float mask = smoothstep(0.6 - 0.3*uAlto, 0.76 - 0.2*uAlto, texture2D(uNoise, p*0.5 + 0.13 + vec2(-ct*0.0022, ct*0.0015)).r);
      float den = puff*mask*smoothstep(0.0, 0.02, cy)*0.92*min(1.0, uAlto*1.4);
      float side = dot(normalize(gf - cc + vec2(1e-4)), L2)*smoothstep(0.05, 0.4, f1);
      float core = smoothstep(0.3, 0.05, f1);
      vec3 col = amb*mix(1.3, 0.8, core) + uCloudLit*(0.75 + 0.55*side)*mix(1.1, 0.6, core) + halo*0.5*(1.0 - core);
      c = mix(c, col, den); cover += den*0.65;
    }
    if (uStratus > 0.001){
      float ct = uCloudT;
      vec2 p = d.xz/(cy + 0.03)*0.05 + wnd*ct*0.005;
      float f = texture2D(uNoise, p).r*0.6 + texture2D(uNoise, p*2.7 + 0.4 + wnp*ct*0.004).a*0.4;
      float den = uStratus*smoothstep(0.0, 0.015, cy + 0.004)*(0.86 + 0.14*f);
      /* the moon and the sun glow through the deck as a soft bright patch */
      vec3 col = (amb*mix(1.35, 0.9, f) + uCloudLit*0.35)*mix(1.0, 0.5, uStorm) + (uMoonDisc*(pow(cm, 10.0)*0.16 + pow(cm, 70.0)*0.28) + uSunDisc*pow(max(dot(d, uSunDirV), 0.0), 12.0)*0.02)*(1.0 - 0.75*uStorm);
      c = mix(c, col, den); cover += den;
    }
    {
      if (uCumulus > 0.001){
        /* a bank of cumulus: an envelope of towers along the horizon, billowed by three octaves of noise;
           shaded by stepping toward the light and seeing whether the cloud thins */
        float T = uCloudT*0.0022;
        float hn = texture2D(uNoise, vec2(a*0.28 + T, 0.13)).r*0.65 + texture2D(uNoise, vec2(a*0.8 + 0.3 + T, 0.37)).g*0.35;
        float H = uCumulus*(0.008 + 0.095*smoothstep(0.4, 0.85, hn));
        #define CUM(A, E) ((H - (E))/max(H, 1e-3) + (texture2D(uNoise, vec2((A)*4.0 + T*2.0, (E)*16.0 - T*1.2)*0.55).r*0.5 + texture2D(uNoise, vec2((A)*4.0 + T*2.6, (E)*16.0 - T*2.2)*1.25 + 0.3).g*0.32 + texture2D(uNoise, vec2((A)*4.0 - T*1.5, (E)*16.0 - T*3.0)*2.9 + 0.7).a*0.18 - 0.5)*1.1)
        float f = CUM(a, e);
        float den = smoothstep(0.0, 0.16, f)*smoothstep(-0.003, 0.005, e)*smoothstep(0.003, 0.015, H);
        if (den > 0.0){
          float fl = CUM(a + L2.x*0.012, e + L2.y*0.012);
          float lit = clamp(0.55 + (f - fl)*2.2, 0.0, 1.2), hf = clamp(e/max(H, 1e-3), 0.0, 1.0), edge = 1.0 - smoothstep(0.0, 0.18, f);
          vec3 col = amb*mix(0.42, 1.0, hf)*(0.8 + 0.3*lit) + uCloudLit*(0.1 + 1.7*lit)*mix(0.4, 1.3, hf) + halo*(0.2 + 1.1*edge) + uGlow*hf*0.5*pow(az, 2.0);
          c = mix(c, col, den); cover += den;
        }
      }
      if (uStorm > 0.001){
        /* a thunderhead out at sea, to the south-east: a broad billowed tower spreading into an anvil */
        float da = a - 0.5, tower = exp(-da*da/0.07), anvil = exp(-da*da/0.45);
        float H = uStorm*(0.02 + 0.075*tower);
        float nb = texture2D(uNoise, vec2(a*4.0, e*12.0)*0.6 + vec2(uCloudT*0.0016, 0.2 - uCloudT*0.001)).r*0.6 + texture2D(uNoise, vec2(a*4.0, e*12.0)*1.4 + 0.5 + vec2(-uCloudT*0.002, -uCloudT*0.003)).a*0.4 - 0.5;
        float body = (H - e)/max(H, 1e-3) + nb*1.0;
        float anv = anvil*uStorm*smoothstep(0.012, 0.0, abs(e - 0.088 - 0.006*nb))*smoothstep(0.0, 0.3, (0.45 - abs(da))*2.0);
        float den = clamp(smoothstep(0.0, 0.18, body)*smoothstep(-0.003, 0.005, e) + anv, 0.0, 1.0);
        float hf = clamp(e/0.1, 0.0, 1.0);
        vec3 col = amb*mix(0.35, 0.8, hf) + uCloudLit*0.35*hf + halo*0.25*hf;
        col += vec3(0.75, 0.8, 1.0)*uFlash*(0.5 + 0.9*texture2D(uNoise, vec2(a*3.0, e*5.0) + uBolt.z).r)*(0.4 + hf);
        c = mix(c, col, den); cover += den;
      }
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
      float aa = fwidth(r)*1.2;
      float cov = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
      if (cov > 0.0){
        vec3 nn = vec3(q, sqrt(max(1.0 - r*r, 0.0)));
        vec3 sd = vec3(uPhaseSign*sqrt(max(1.0 - uPhaseC*uPhaseC, 0.0)), 0.0, uPhaseC);
        float lit = smoothstep(-0.05, 0.09, dot(nn, sd));
        float m1 = texture2D(uNoise, q*0.21 + vec2(0.31, 0.62)).r, m2 = texture2D(uNoise, q*0.55 + vec2(0.13, 0.27)).a;
        float alb = 0.98 - 0.3*smoothstep(0.42, 0.68, m1) - 0.1*smoothstep(0.45, 0.8, m2);
        vec3 moonC = uMoonDisc*(alb*(0.78 + 0.22*nn.z)*lit + 0.03*(1.0 - lit));
        cov *= 1.0 - 0.9*cover;
        c = c*(1.0 - cov*0.35*lit*uStars) + moonC*cov;
      }
    }
    /* sun disc */
    float cs = dot(d, uSunDirV);
    if (cs > 0.99 && dot(uSunDisc, uSunDisc) > 1e-8){
      float r = acos(min(cs, 1.0))/uSunR;
      float aa = fwidth(r)*1.2;
      c += uSunDisc*(1.0 - smoothstep(1.0 - aa, 1.0 + aa, r))*0.9*(1.0 - 0.9*cover);
    }
  } else {
    c = uEnv > 0.5 ? mix(uHor*0.5, uHor*0.08 + uZen*0.15, smoothstep(0.0, 0.3, -d.y)) : uHor;
  }
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

  /* shared wave height field: tide swells (6) and swells raised by clicks (3) */
  const WAVEH = `
uniform float uWaveT; uniform vec4 uWv[6]; uniform vec4 uUw[3];
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
  float hw = 4.0 + 0.9*(U.w - sc);
  float dx = (a - U.z)/min(hw, 46.0);
  /* a crest that rises and falls along its length: peaks and shoulders, not a level wall */
  float along = 0.82 + 0.36*(0.5 + 0.25*sin(a*0.31 + U.z) + 0.25*sin(a*0.13 + 1.7*U.z));
  return U.y*along*exp(-dx*dx)*smoothstep(U.x - U.w/CU, U.x - U.w/CU + 1.2, t);
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
  for (int k = 0; k < 3; k++){
    vec4 U = uUw[k]; if (U.y <= 0.0) continue;
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
    float fade = smoothstep(uNearRect.x, uNearRect.x + 7.0, wp.x)*smoothstep(uNearRect.z, uNearRect.z - 7.0, wp.x)*smoothstep(uNearRect.y, uNearRect.y + 9.0, wp.z);
    if (fade > 0.0){
      float e = 0.22, h = waveH(wp.xz), hx = waveH(wp.xz + vec2(e, 0.0)), hz = waveH(wp.xz + vec2(0.0, e));
      vNg = normalize(vec3(-(hx - h)/e*fade, 1.0, -(hz - h)/e*fade));
      wp.y += h*fade; vH = h*fade;
    }
  #endif
  vW = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;

  const GROUND_FS = `
#include <packing>
${COMMON}
${SKY_FN}
${ART}
uniform float uTime, uDay, uShadowK, uShadowOn;
uniform sampler2D uNoise, uWater, uSand, uDecal, uRelief, uShadowMap, uTrack; uniform vec4 uTrackRect;
uniform vec4 uDecalRect; uniform vec2 uShadowSize; uniform mat4 uShadowMatrix;
uniform vec3 uAmb, uKeyDir, uKeyCol, uMoonGlit, uSunGlit;
${WAVEH}
uniform vec4 uRip[6];       /* click splashes: x, z, start time, strength */
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
vec3 skyRefl(vec3 d){
  float eu = max(d.y, 0.0);
  vec3 c = mix(uHor, uZen, pow(smoothstep(0.0, 0.5, eu), 0.6));
  vec2 hs = normalize(uSunDirV.xz + vec2(1e-5)), hd = normalize(d.xz + vec2(1e-5));
  c += uGlow*(pow(max(dot(hd, hs), 0.0), 5.0)*exp(-eu*11.0) + 0.2*exp(-eu*5.0));
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
      w.foam = max(w.foam, (exp(-dlt/1.0)*0.95 + (exp(-dlt/2.4)*0.3 + exp(-dlt/6.0)*0.14)*(0.25 + pch))*onset*min(amp, 2.5)*sect);
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
        float band = exp(-behind/(0.14 + 0.16*RD.z)), film = exp(-u*2.6)*0.34*(0.3 + 1.2*nw.r);
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
  for (int k = 0; k < 3; k++){
    vec4 U = uUw[k]; if (U.y <= 0.0) continue;
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
  /* artificial light only where there is any: round the camp, round the van, and in its headlights' reach */
  bool camp = (uDbgG & 32) == 0 && (length(p - CAMP) < 24.0 || length(p - uVanPos.xz) < 14.0 || (uHead.w > 0.001 && length(p - uHead.xz) < 36.0));
  vec3 art = vec3(0.0);
  float shK = length(p - uShC.xy) < uShC.z ? mix(1.0, shadowAt(wp), uShadowK) : 1.0;
  bool glit = dot(uMoonGlit + uSunGlit, vec3(1.0)) > 1e-6;

  Wv w = Wv(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  /* the swash runs a few metres up the sand, further under a storm's swells and much further under a big clicked one:
     look for it as far as the biggest wave about could reach, or it would stop short along a line */
  float sUp = 4.0;
  for (int j = 0; j < 6; j++) sUp = max(sUp, 1.85*(0.85 + 0.75*uWv[j].y) + 0.3);
  for (int k = 0; k < 3; k++) sUp = max(sUp, 1.85*(0.85 + 0.9*uUw[k].y) + 0.3);
  if ((uDbgG & 1) == 0 && s > -sUp && s < 70.0) w = waves(s, p.x, t, p);

  /* ocean surface: four octaves of directional chop; what the pixel can't resolve becomes roughness */
  vec3 Nw = vec3(0.0, 1.0, 0.0);
  /* the pixel's footprint on the water: long along the view (fpL), narrow across it (fp). The textures are filtered
     anisotropically, so an octave keeps its detail until it is too fine even across the view */
  float fpL = max(length(gDx), length(gDy)), fp = min(min(length(gDx), length(gDy))*1.6, fpL), sig2 = 0.0016;
  if (s > -2.6){
    vec2 q = vec2(-p.y, p.x);
    float calm = mix(0.4, 1.0, smoothstep(-0.2, 3.5, s));
    vec4 Tt = vec4(31.0, 9.3, 2.9, 0.9), Aa = vec4(0.30, 0.30, 0.267, 0.217), Ss = vec4(1.7, 0.95, 0.55, 0.3);
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
    for (int i = 0; i < 6; i++){
      vec4 R4 = uRip[i]; float age = t - R4.z;
      if (R4.w <= 0.0 || age < 0.0 || age > 4.0) continue;
      vec2 dv = p - R4.xy; float rr2 = dot(dv, dv);
      ripF = max(ripF, R4.w*exp(-rr2/(0.8 + age*4.5))*exp(-age/1.1)*(0.6 + 0.4*smoothstep(0.35, 0.65, tN(p*0.9 + R4.xy, 3.0).r)));
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
    { vec2 tu = (p - uTrackRect.xy)/uTrackRect.zw;
      if (tu.x > 0.0 && tu.y > 0.0 && tu.x < 1.0 && tu.y < 1.0){
        vec2 te = 1.0/vec2(2048.0, 860.0);
        float t0 = texture2D(uTrack, tu).r, tx = texture2D(uTrack, tu + vec2(te.x, 0.0)).r, tz = texture2D(uTrack, tu + vec2(0.0, te.y)).r;
        rel.b = max(rel.b, t0*0.35); rg += vec2(tx - t0, tz - t0)*2.2; rel.g = max(rel.g, t0*0.6);
      } }
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
    float ao = 1.0 - rel.b*0.85;
    if (camp) art = artLight(wp, N);
    vec3 lit = a*(uAmb*(0.7 + 0.3*N.y)*ao + uKeyCol*max(dot(N, Lk), 0.0)*shK + art*mix(1.0, ao, 0.6));
    /* quartz glints in dry sand */
    float qz = smoothstep(0.986, 1.0, grain)*(1.0 - wet)*smoothstep(0.08, 0.02, fpL);
    lit += uKeyCol*qz*pow(max(dot(N, normalize(Lk + V)), 0.0), 8.0)*1.6;
    if (wet > 0.01){
      /* a film of water left on the sand is a still, smooth mirror for the sky and the moon (only the sheet still running
         over it ripples); damp sand keeps a little sheen, with the grain's sparkle */
      vec3 Ns = normalize(mix(mix(N, Nw, 0.3*(1.0 - gloss)), vec3(0.0, 1.0, 0.0), 0.6*gloss));
      float F = 0.02 + 0.98*pow(1.0 - max(dot(Ns, V), 0.0), 5.0);
      vec3 R = reflect(-V, Ns); R.y = abs(R.y);
      vec3 sheen = skyRefl(R)*F + art*0.06;
      if (glit) sheen += (seaSpec(Ns, V, uMoonDirV, uMoonGlit, 0.006) + seaSpec(Ns, V, uSunDirV, uSunGlit, 0.006))*(0.25 + 0.75*gloss);
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
    vec3 body = mix(vec3(0.07, 0.20, 0.205), vec3(0.010, 0.045, 0.085), pow(dz, 0.6));
    /* slopes too small to see still tilt the water toward the eye: far out it reflects less, and sky from higher up,
       so the open sea stays a shade darker than the sky over it and the horizon remains a line */
    float tilt = sqrt(sig2)*1.3;
    float NV = max(dot(Nw, V), min(tilt, 0.35));
    float F = 0.02 + 0.98*pow(1.0 - NV, 5.0);
    vec3 R = reflect(-V, Nw); R.y = abs(R.y) + 0.002 + tilt*0.6; R = normalize(R);
    vec3 lit = body*(uAmb*1.0 + uKeyCol*(0.2 + 0.7*max(dot(Nw, Lk), 0.0)) + art*0.5);
    lit = lit*(1.0 - F) + skyRefl(R)*F;
    if (glit) lit += seaSpec(Nw, V, uMoonDirV, uMoonGlit, sig2) + seaSpec(Nw, V, uSunDirV, uSunGlit, sig2);
    if (uDay > 0.01 && s < 16.0){
      float c1 = tW(p + vec2(t*0.08, t*0.03), 1.4).a, c2 = tW(p - vec2(t*0.06, -t*0.044) + 0.38, 1.06).a;
      lit += vec3(0.9, 1.0, 0.95)*pow(c1*c2, 2.0)*uDay*(1.0 - dz)*uKeyCol*0.45;
    }
    #ifdef NEAR
      float face = clamp(dot(vNg.xz, -sn)*4.0, 0.0, 1.0), crestL = smoothstep(0.15, 0.9, vH);
      lit = lit*(1.0 - 0.5*face) + body*(uAmb*2.5 + uKeyCol*0.6)*crestL*0.6;
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
    if (glit) sheet += (seaSpec(Nw, V, uMoonDirV, uMoonGlit, sig2) + seaSpec(Nw, V, uSunDirV, uSunGlit, sig2))*0.8;
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
    float foamV = mix(smoothstep(thr - fw, thr + fw, lace), clamp(dens*0.85, 0.0, 1.0), smoothstep(0.12, 0.45, fw))*smoothstep(0.03, 0.14, dens);
    foamV = max(foamV, w.lip*0.95*smoothstep(0.1, 0.45, holes));
    vec3 foamLit = vec3(0.9, 0.92, 0.94)*(uAmb*1.2 + uKeyCol*max(Lk.y, 0.15) + art*0.6);
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
  if (uPre > 0.5){ if (uFireOn > 0.5) c += texture2D(uFire, vUv).rgb; c = pre(min(c*uExp, vec3(50.0))); }
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
float coc(float z){ float c = uK*abs(1.0 - uZf/z); if (z > uZf) c *= mix(1.0, 0.35, smoothstep(120.0, 700.0, z)); return min(c, uMax); }
void main(){
  float zc = linZ(texture2D(uDepth, vUv).r), cc = coc(zc);
  vec3 acc = texture2D(uScene, vUv).rgb; float ws = 1.0, fg = 0.0;
  for (int i = 0; i < 30; i++){
    float k = float(i), ring, ang;
    if (i < 6){ ring = 0.3; ang = k/6.0; } else if (i < 16){ ring = 0.62; ang = (k - 6.0)/10.0 + 0.05; } else { ring = 1.0; ang = (k - 16.0)/14.0 + 0.11; }
    ang *= 6.28318;
    float dist = ring*uMax;
    vec2 uv = vUv + vec2(cos(ang), sin(ang))*dist*uTexel;
    float zi = linZ(texture2D(uDepth, uv).r), ci = coc(zi);
    float ce = zi > zc ? min(ci, cc) : ci;
    float w = clamp(ce - dist + 1.0, 0.0, 1.0);
    acc += texture2D(uScene, uv).rgb*w; ws += w;
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

  return { COMMON, SKY_FN, SKY_VS, SKY_FS, ART, WAVEH, GROUND_VS, GROUND_FS, QUAD_VS, DOWN_FS, UP_FS, FINAL_FS, DOF_FS, SSAO_FS, AOBLUR_FS, FIRE_FS };
})();
