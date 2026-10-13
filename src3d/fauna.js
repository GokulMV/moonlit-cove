/* ─────────────────────────────────────────────────────────────
   fauna.js — the wildlife of the whole coast, wherever the camera
   is: fireflies along the forest edge after dark, midges dancing at
   dusk, dragonflies and butterflies by day; gulls wheeling over the
   surf, cruising the coast and standing on the sand, sandpipers
   chasing the swash, ghost crabs on the night sand, bats over the
   treeline, now and then a pod of dolphins offshore, and a whale
   further out, blowing, lifting its flukes, breaching. The camp's
   own fireflies, moths and butterflies stay with fx.js. Insects
   follow the Insects setting, everything else the Animals setting.
   ───────────────────────────────────────────────────────────── */
const Fauna = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cl = (x, a, b) => x < a ? a : x > b ? b : x;
  const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));        /* the shortest turn from heading a to heading b */
  const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rnd = Textures.rng(8086);       /* the creatures' own dice: when a crab moves, where a pod comes from */
  const W0 = () => [0, 0, 0, 0];
  /* the first frames draw every kind once, even with none out, so no shader is compiled later in the middle of things */
  let warm = 3;

  /* ── shaders ── */
  /* lit like the foliage: the sky's ambient and key light, the camp's lamps and fire close by, and the same haze far off */
  const LIGHT = `
${GLSL.COMMON}
${GLSL.ART}
uniform vec3 uAmbF, uKeyDirT, uKeyColT; uniform vec4 uFog;
vec3 fogIt(vec3 c, vec3 wp){
  float d = distance(wp, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))));
  return mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
}
vec3 shade(vec3 alb, vec3 n, vec3 wp, float thin, float gloss){
  float ndl = dot(n, uKeyDirT);
  vec3 L = uAmbF*(0.55 + 0.45*max(n.y, 0.0)) + uKeyColT*(max(ndl, 0.0) + thin*max(-ndl, 0.0) + 0.05);
  if (length(wp.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(wp.xz - uVanPos.xz) < 12.0 || (uHead.w > 0.001 && length(wp.xz - uHead.xz) < 34.0) || torchNear(wp)) L += artLight(wp, n);
  vec3 c = alb*L;
  if (gloss > 0.0) c += uKeyColT*pow(max(dot(reflect(normalize(wp - cameraPosition), n), uKeyDirT), 0.0), 40.0)*gloss;
  return fogIt(c, wp);
}`;
  /* every creature mesh has a local frame (x forward, y up, z across), set into the world by heading, then pitch, then bank */
  const ORIENT = `
attribute vec3 aCol; attribute vec4 aW;
varying vec3 vN, vW, vC; varying vec4 vP;
mat3 rY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rZ(float a){ float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
void place(vec3 p, vec3 n, vec3 at, float yaw, float pitch, float roll, float sc){
  mat3 R = rY(yaw)*rZ(pitch)*rX(roll);
  vec3 w = at + R*(p*sc);
  vW = w; vN = R*n; vC = aCol; vP = aW;
  gl_Position = sc < 1e-4 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*viewMatrix*vec4(w, 1.0);
}`;
  /* a wing: the arm rises and falls about the shoulder, the hand follows a beat behind and sweeps back at the wrist
     on the upstroke. s is how far out from the shoulder, c how far behind the leading edge (swept back: LE0 + LE1·s²) */
  const WING = `
#ifndef WINGY
  #define WINGY 0.0
#endif
vec3 wing(float side, float s, float c, float a1, float a2, float sweep){
  float x = LE0 + LE1*s*s - c, xw = LE0 + LE1*WR*WR;
  if (s > WR){ float cs = cos(sweep), sn = sin(sweep), dx = x - xw, ds = s - WR; x = xw + dx*cs - ds*sn; s = WR + dx*sn + ds*cs; }
  vec2 q = vec2(cos(a1), sin(a1))*min(s, WR) + vec2(cos(a2), sin(a2))*max(s - WR, 0.0);
  return vec3(x, WINGY + q.y, side*(ROOT + q.x));
}`;
  /* gulls and sandpipers: posed here, frame by frame. Each is its own model (models/life/gull.js, sandpiper.js) as it
     stands, its hips at the origin, with its wings folded; and a pair of open wings, for flight. As it opens its wings
     the folded ones draw into its shoulders and the open ones spread out of them; its head comes down and forward on
     its neck in flight, and its legs draw up */
  const BIRD_VS = `
${ORIENT}
${WING}
attribute vec4 iP, iQ, iC, iR;   /* where (x, y, z, heading) · pitch, bank, wingbeat phase, wingbeat depth · folded, legs out, size · stride phase, stride */
void main(){
  vec3 p = position, n = normal;
  float fold = smoothstep(0.0, 1.0, iC.x);
  if (aW.x > 0.5 && aW.x < 1.5){
    float side = aW.y, s = aW.z, c = aW.w, A = iQ.w, ph = iQ.z;
    float a1 = DIH + ARM*A*sin(ph), a2 = a1 + HAND*A*sin(ph - 0.7) - DROOP*(1.0 - min(A*4.0, 1.0));
    vec3 f = wing(side, s, c, a1, a2, SWEEP + SWEEPK*A*max(cos(ph), 0.0)), sh = vec3(LE0, WINGY, side*ROOT);
    p = sh + (f - sh)*(1.0 - fold);
    float a = s > WR ? a2 : a1;
    n = vec3(0.0, cos(a), -side*sin(a));
  }
  if (aW.x > 2.5 && aW.x < 3.5){ vec3 sh = vec3(LE0, WINGY, aW.y*ROOT); p = sh + (p - sh)*fold; }
  if (aW.x > 3.5) p += vec3(HEADX, HEADY, 0.0)*(1.0 - fold);
  if (aW.x > 1.5 && aW.x < 2.5){
    /* legs: drawn up in flight, striding (left and right out of step) when it runs */
    vec2 q = vec2(p.x - LEGX, (p.y - LEGY)*iC.y);
    float sw = sin(iR.x + aW.y*1.5708)*iR.y*0.8, cs = cos(sw), sn = sin(sw);
    p.xy = vec2(LEGX + q.x*cs - q.y*sn, LEGY + q.x*sn + q.y*cs);
  }
  place(p, n, iP.xyz, iP.w, iQ.x, iQ.y, iC.z);
}`;
  const BIRD_FS = `
${LIGHT}
varying vec3 vN, vW, vC; varying vec4 vP;
void main(){
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), alb = vC;
  if (vP.x > 0.5 && vP.x < 1.5){
    float s = vP.z/SPAN, c = vP.w;
    alb = gl_FrontFacing ? WTOP : WUND;
    #ifdef GULL
      /* black wingtips, a white spot near the end of each */
      alb = mix(alb, gl_FrontFacing ? vec3(0.03) : vec3(0.1), smoothstep(0.72, 0.75, s));
      alb = mix(alb, vec3(0.9), smoothstep(0.88, 0.9, s)*(1.0 - smoothstep(0.95, 0.97, s))*smoothstep(0.012, 0.018, c)*(1.0 - smoothstep(0.04, 0.046, c)));
    #else
      /* dark flight feathers with a white bar along them */
      alb = mix(alb, vec3(0.12, 0.11, 0.1), smoothstep(0.034, 0.042, c)*(gl_FrontFacing ? 1.0 : 0.3));
      alb = mix(alb, vec3(0.9), smoothstep(0.018, 0.024, c)*(1.0 - smoothstep(0.03, 0.036, c))*step(s, 0.8)*(gl_FrontFacing ? 1.0 : 0.0));
    #endif
  }
  gl_FragColor = vec4(shade(alb, n, vW, 0.3, 0.0), 1.0);
}`;
  /* crabs, bats, dolphins: their own colours, lit */
  const GEN_FS = `
${LIGHT}
varying vec3 vN, vW, vC; varying vec4 vP;
void main(){ vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(shade(vC, n, vW, 0.1, GLOSS), 1.0); }`;
  /* the ghost crabs on the sand: models/life/crab.js's own crab, built light, as one geometry (CRAB: where its legs join
     its body, for the stride) */
  let crabParts = null; const crabP = () => crabParts || (crabParts = Models.make('life/crab', { lite: true, parts: true }).userData.parts);
  const CRAB = new Proxy({}, { get: (t, k) => +crabP().hip[k].toFixed(5) });
  const CRAB_VS = `
${ORIENT}
attribute vec4 iP, iQ;   /* where (x, y, z, facing) · stride phase, stride, sunk into its burrow, size */
void main(){
  vec3 p = position, n = normal;
  if (aW.x > 0.5 && aW.x < 1.5){
    /* each leg swings about its hip and lifts as it swings, the two sides out of step */
    /* (running sideways: each leg lifted and reaching out, then set down and drawn in under it, swinging a little fore
       and aft as well) */
    float k = aW.z, ph = iQ.x + k*1.5708 + (aW.y > 0.0 ? 3.1416 : 0.0), sw = sin(ph)*0.22*iQ.y, cs = cos(sw), sn = sin(sw);
    vec3 hip = vec3(${CRAB.hx} - k*${CRAB.hs}, ${CRAB.hy}, aW.y*${CRAB.hz}), q = p - hip;
    q.xz *= 1.0 + 0.14*cos(ph)*iQ.y*aW.w;
    p = hip + vec3(q.x*cs + q.z*sn, q.y + max(cos(ph), 0.0)*0.016*iQ.y*aW.w, -q.x*sn + q.z*cs);
  }
  /* the eyes fold down as it ducks into the burrow */
  if (aW.x > 2.5) p.y -= iQ.z*0.012;
  place(p, n, iP.xyz - vec3(0.0, iQ.z*0.075, 0.0), iP.w, 0.0, 0.0, iQ.w);
}`;
  const DOLPHIN_VS = `
${ORIENT}
attribute vec4 iP, iQ;   /* where (x, y, z, heading) · pitch, bank, tail-beat phase, size */
varying vec3 vL;          /* where the point lies on the animal itself (its own frame, as built) */
void main(){
  /* the tail stock and flukes beat up and down, more toward the tail */
  vec3 p = position; float u = aW.z; vL = position;
  p.y += sin(iQ.z - u*2.4)*u*u*FLEX;
  place(p, normal, iP.xyz, iP.w, iQ.x, iQ.y, iQ.w);
}`;
  /* a dolphin's and a whale's markings, worked out on the animal itself: the eye, the line of the mouth, and for the
     dolphin its pale cape and belly; for the humpback the grooves of its throat, the knobs on its head, its white
     flippers mottled grey, the black and white patterns under its flukes (each whale its own) */
  const SEA_FS = `
${LIGHT}
varying vec3 vN, vW, vC, vL; varying vec4 vP;
uniform float uSeed;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
void main(){
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), alb = vC, L = vL;
  float side = abs(L.z);
  #ifdef WHALE
    if (vP.x < 0.5){
      /* throat grooves: pale pleats under the chin and back along the belly */
      float under = smoothstep(-0.03, -0.075, L.y)*smoothstep(-0.12, 0.02, L.x)*smoothstep(0.49, 0.4, L.x);
      float pleat = smoothstep(0.3, 0.5, abs(fract(L.z*70.0 + 0.3*sin(L.x*9.0)) - 0.5));
      alb = mix(alb, alb*0.45, under*(1.0 - pleat)*0.9);
      /* the mouth: a line from the snout curving back down to below the eye */
      float mx = clamp((0.5 - L.x)/0.22, 0.0, 1.0), my = -0.012 - 0.042*mx*mx;
      alb *= 1.0 - 0.75*smoothstep(0.006, 0.0015, abs(L.y - my))*step(0.27, L.x)*step(0.025, side);
      /* the eye, just above the mouth's corner */
      float e = length(vec2(L.x - 0.272, (L.y + 0.032)*1.5));
      alb = mix(alb, vec3(0.006), smoothstep(0.0085, 0.0055, e)*step(0.05, side));
      alb = mix(alb, vec3(0.25), smoothstep(0.0115, 0.0095, e)*(1.0 - smoothstep(0.0085, 0.0055, e))*step(0.05, side));
      /* knobs on the head */
      vec2 kq = vec2(L.x*55.0, L.z*55.0), kc = floor(kq) + 0.5; float kn = smoothstep(0.32, 0.18, length(kq - kc - 0.2*(vec2(hsh(kc), hsh(kc + 7.1)) - 0.5)));
      alb *= 1.0 - 0.45*kn*smoothstep(0.3, 0.42, L.x)*smoothstep(-0.01, 0.03, L.y)*step(0.5, hsh(kc + uSeed));
    } else if (vP.x < 1.5){
      /* the long flippers: white, mottled grey above */
      alb = mix(vec3(0.62, 0.63, 0.64), vec3(0.2, 0.21, 0.23), gl_FrontFacing ? 0.0 : 0.55*step(0.55, hsh(floor(L.xz*80.0))));
    } else {
      /* the flukes: dark above; below, white with black blotches and a dark trailing edge */
      if (!gl_FrontFacing){
        vec2 q = floor(vec2(L.x*40.0, side*40.0) + uSeed*3.1); float b = hsh(q)*0.6 + hsh(floor(q*0.5) + 9.0)*0.4;
        alb = mix(vec3(0.66, 0.67, 0.68), vec3(0.04), step(0.62, b));
        alb = mix(alb, vec3(0.04), smoothstep(-0.555, -0.58, L.x - side*0.1));
      }
    }
  #else
    /* a bottlenose: dark cape along the back, grey flanks, a pale belly; the eye, the mouth along the beak */
    float cape = smoothstep(0.04, 0.12, L.y - 0.06*sin(L.x*2.5 + 0.7));
    alb = mix(vec3(0.38, 0.4, 0.43), vec3(0.15, 0.17, 0.2), cape);
    alb = mix(alb, vec3(0.72, 0.73, 0.74), smoothstep(-0.06, -0.16, L.y)*smoothstep(-0.8, -0.3, L.x));
    if (vP.x > 0.5) alb = vec3(0.16, 0.18, 0.21);
    float mouth = smoothstep(0.012, 0.004, abs(L.y + 0.02 + 0.03*smoothstep(1.05, 0.88, L.x)))*smoothstep(0.86, 0.9, L.x)*step(0.02, side);
    alb *= 1.0 - 0.6*mouth;
    float e = length(vec2(L.x - 0.83, (L.y - 0.005)*1.4));
    alb = mix(alb, vec3(0.01), smoothstep(0.022, 0.015, e)*step(0.05, side));
  #endif
  gl_FragColor = vec4(shade(alb, n, vW, 0.1, GLOSS), 1.0);
}`;
  /* a whale's blow and the spray of its breaching: soft puffs of mist, each its own world size, rising and spreading
     (a blow: a bushy column off the blowhole, drifting downwind) or thrown up and out and falling back (a splash),
     lit white, brighter against the sun */
  const MIST_VS = `
attribute vec4 aS;   /* which puff, and three dice */
uniform float uTime, uScale; uniform vec4 uMist[6], uMistK[6]; uniform vec3 uAmbF, uKeyColT, uKeyDirT; uniform vec4 uFog;
varying float vA; varying vec3 vC;
void main(){
  int e = int(aS.x + 0.5); vec4 M = uMist[e], K = uMistK[e];
  float tt = uTime - M.w, S = K.y, a = aS.w*6.2832, life, sz;
  vec3 p, wind = vec3(K.z, 0.0, K.w);
  if (K.x < 0.5){
    life = 2.6 + 1.8*aS.y;
    float hk = 0.3 + 0.7*aS.z, h = S*(1.0 - exp(-tt*2.2))*hk, r = (S*0.04 + h*0.22)*sqrt(aS.y)*(0.6 + 0.5*tt);
    p = M.xyz + vec3(cos(a)*r, h, sin(a)*r) + wind*tt*(0.3 + 0.6*hk);
    sz = (S*0.06 + h*0.12)*(0.7 + 0.6*aS.y)*(1.0 + 0.25*tt);
  } else {
    /* (most of it a dense white curtain round where it hit, the rest thrown wide; the mist hangs after) */
    life = 1.8 + 1.6*aS.y;
    float wide = step(0.62, aS.z), o = S*(0.05 + 0.12*aS.z + 0.3*wide*aS.z), up = S*(0.45 + 0.9*aS.y*aS.y);
    p = M.xyz + vec3(cos(a)*(o*tt + S*0.12*aS.y), up*tt - 4.9*tt*tt*0.5, sin(a)*(o*tt + S*0.12*aS.y)) + wind*tt*0.5;
    p.y = max(p.y, 0.15 + 0.3*aS.z);
    sz = S*(0.08 + 0.09*tt)*(0.6 + 0.7*aS.z)*(1.0 - 0.4*wide);
  }
  float f = tt/life;
  vA = tt > 0.0 && tt < life ? smoothstep(0.0, 0.06, f)*(1.0 - f)*(1.0 - f) : 0.0;
  vec4 mv = modelViewMatrix*vec4(p, 1.0);
  float px = sz*uScale/max(-mv.z, 0.1);
  vA *= min(1.0, px*0.6);
  float fw = pow(max(dot(normalize(p - cameraPosition), uKeyDirT), 0.0), 4.0), d = length(mv.xyz);
  vC = mix(uAmbF*1.5 + uKeyColT*(0.55 + 1.1*fw), uFog.rgb, (1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))))*0.85);
  gl_PointSize = clamp(px, 1.0, 256.0);
  gl_Position = vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
}`;
  const MIST_FS = `varying float vA; varying vec3 vC;
void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard; float k = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC, vA*k*k*0.42); }`;
  /* bats, dragonflies and butterflies fly paths worked out here from the time, about a home the CPU only moves when it is left far behind */
  const BAT_VS = `
${ORIENT}
${WING}
attribute vec4 iH, iK;   /* home (x, y, z, seed) · which one */
uniform float uTime, uN;
/* quick, jinking flight: slow loops with fast swerves on top, every bat its own (the paces and the sizes of its loops
   drawn from its seed, so no two fly the same figure) */
vec3 path(float t, float s){
  vec3 f = 0.72 + 0.56*fract(vec3(s*13.7, s*7.9, s*3.3)), a = 0.75 + 0.5*fract(vec3(s*5.1, s*11.3, s*2.9));
  return vec3(5.5*a.x*sin(t*0.37*f.x + s*6.1) + 2.6*a.y*sin(t*1.13*f.y + s*2.3) + 0.9*a.z*sin(t*3.7*f.z + s*9.4),
              0.8*a.z*sin(t*0.71*f.y + s*4.7) + 0.35*sin(t*2.9*f.x + s*1.9),
              3.5*a.y*sin(t*0.43*f.z + s*3.3) + 1.8*a.x*sin(t*1.31*f.x + s*7.7) + 0.8*a.z*sin(t*4.1*f.y + s*5.2));
}
void main(){
  float s = iH.w, t = uTime + s*50.0;
  vec3 p0 = path(t - 0.05, s), p1 = path(t, s), p2 = path(t + 0.05, s), v = (p2 - p0)*10.0, ac = (p2 - 2.0*p1 + p0)*400.0;
  float yaw = atan(-v.z, v.x), pitch = atan(v.y, length(v.xz) + 1e-3);
  float roll = atan(dot(ac, vec3(sin(yaw), 0.0, cos(yaw)))/9.8);      /* banked into the turn */
  vec3 p = position, n = normal;
  if (aW.x > 0.5){
    float side = aW.y, ph = uTime*6.2832*(8.5 + 3.0*fract(s*7.3)) + s*40.0, a1 = DIH + ARM*sin(ph), a2 = a1 + HAND*sin(ph - 0.8);
    p = wing(side, aW.z, aW.w, a1, a2, SWEEP + SWEEPK*max(cos(ph), 0.0));
    float a = aW.z > WR ? a2 : a1; n = vec3(0.0, cos(a), -side*sin(a));
  }
  place(p, n, iH.xyz + p1, yaw, pitch, roll, clamp(uN - iK.x, 0.0, 1.0)*(0.9 + 0.25*fract(s*3.7))*(1.0 - iK.w));
}`;
  const DFLY_VS = `
${ORIENT}
attribute vec4 iH, iK;   /* home (x, y, z, seed) · which one, colour */
uniform float uTime, uN;
varying vec3 vK;
/* (an integer hash of (k, j), the same here as in fauna.js's dPick, so where each one hovers can be known there) */
float hk(float k, float j){ uint x = uint(int(k) + 100003)*747796405u + uint(int(j))*2891336453u; x ^= x >> 16u; x *= 0x45d9f3bu; x ^= x >> 16u; return float(x & 0xffffffu)/16777216.0; }
/* the spots it hovers at, a few metres round its home */
vec3 spot(float k, float i){ return vec3(hk(k, i*3.0) - 0.5, hk(k, i*3.0 + 1.0), hk(k, i*3.0 + 2.0) - 0.5)*vec3(5.0, 1.3, 3.2) + vec3(0.0, 0.45, 0.0); }
void main(){
  float s = iH.w, P = 1.6 + 1.6*hk(7.0, iK.x), Tt = uTime/P + s*17.0, k = floor(Tt), f = Tt - k;
  vec3 A = spot(k, iK.x), B = spot(k + 1.0, iK.x), Z = spot(k - 1.0, iK.x);
  /* it hovers most of the time, then darts to the next spot, turning to face it just before */
  float m = smoothstep(0.76, 0.93, f);
  vec3 at = iH.xyz + mix(A, B, m) + vec3(sin(uTime*5.1 + s*9.0), sin(uTime*7.3 + s*3.0), cos(uTime*4.3 + s*5.0))*0.02;
  float y0 = atan(-(A.z - Z.z), A.x - Z.x), y1 = atan(-(B.z - A.z), B.x - A.x);
  float yaw = y0 + atan(sin(y1 - y0), cos(y1 - y0))*smoothstep(0.62, 0.76, f);
  vec3 p = position, n = normal;
  if (aW.x > 0.5){
    /* four wings in a blur of small fast beats, fore and hind out of step */
    float side = aW.y, a = 0.08 + 0.38*sin(uTime*170.0 + s*9.0 + aW.w*1.9), span = aW.z;
    p = vec3(p.x, span*sin(a), side*(0.004 + span*cos(a))); n = vec3(0.0, cos(a), -side*sin(a));
  }
  int ci = int(iK.y + 0.5);
  vK = ci == 0 ? vec3(0.1, 0.32, 0.95) : ci == 1 ? vec3(0.14, 0.6, 0.22) : ci == 2 ? vec3(0.85, 0.12, 0.05) : vec3(0.85, 0.52, 0.1);
  place(p, n, at, yaw, 0.04, 0.0, clamp(uN - iK.x, 0.0, 1.0)*1.15*(1.0 - iK.w));
}`;
  const DFLY_FS = `
${LIGHT}
varying vec3 vN, vW, vC; varying vec4 vP; varying vec3 vK;
void main(){
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0);
  #ifdef WINGS
    /* clear wings: only a faint tint, and the glint of the sky off them */
    float g = pow(abs(dot(normalize(vW - cameraPosition), n)), 0.4);
    gl_FragColor = vec4(shade(vec3(0.82, 0.88, 0.96), n, vW, 0.8, 1.2), 0.12 + 0.2*(1.0 - g));
  #else
    gl_FragColor = vec4(shade(vK*vC, n, vW, 0.1, 0.7), 1.0);
  #endif
}`;
  const BFLY_VS = `
${ORIENT}
attribute vec4 iH, iK;   /* home (x, y, z, seed) · which one, kind, size */
uniform float uTime, uN;
varying float vKind;
vec3 path(float t, float s){ return vec3(2.4*sin(t*0.31 + s*5.0) + 0.6*sin(t*1.7 + s*2.0), 0.3*sin(t*0.9 + s*3.0) + 0.15*sin(t*2.3 + s), 1.1*sin(t*0.23 + s*4.0) + 0.4*sin(t*1.3 + s*6.0)); }
void main(){
  float s = iH.w, t = uTime*(0.8 + 0.4*fract(s*3.1)) + s*40.0, ph = uTime*6.2832*(7.0 + 3.0*fract(s*5.7)) + s*20.0;
  vec3 v = path(t + 0.05, s) - path(t - 0.05, s);
  /* it lifts a little with every downstroke */
  vec3 at = iH.xyz + path(t, s) + vec3(0.0, 0.035*sin(ph - 1.0), 0.0);
  vec3 p = position, n = normal;
  if (aW.x > 0.5){
    float side = aW.y, a = mix(-0.25, 1.4, 0.5 + 0.5*sin(ph)), span = abs(p.z) - 0.003;
    p = vec3(p.x, span*sin(a), side*(0.003 + span*cos(a))); n = vec3(0.0, cos(a), -side*sin(a));
  }
  vKind = iK.y;
  place(p, n, at, atan(-v.z, v.x), 0.2, 0.0, clamp(uN - iK.x, 0.0, 1.0)*iK.z);
}`;
  const BFLY_FS = `
${LIGHT}
varying vec3 vN, vW, vC; varying vec4 vP; varying float vKind;
void main(){
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), alb = vC;
  if (vP.x > 0.5){
    /* forewing and hindwing, two rounded lobes: q is out along the wing (0..1) and front (1) to back (-1) */
    vec2 q = vP.zw;
    float e1 = length(vec2((q.x - 0.47)/0.53, (q.y - 0.3)/0.7)), e2 = length(vec2((q.x - 0.32)/0.36, (q.y + 0.45)/0.55)), e = min(e1, e2);
    if (e > 1.0) discard;
    float edge = smoothstep(0.74, 0.8, e), k = vKind;
    if (k < 0.5){        /* orange, black-veined, a black border with white dots */
      float vein = 1.0 - smoothstep(0.02, 0.07, abs(fract(atan(q.y, q.x + 0.15)*1.6) - 0.5));
      alb = mix(vec3(0.95, 0.42, 0.06), vec3(0.03), max(edge, vein*0.85));
      alb = mix(alb, vec3(0.95), edge*step(0.86, e)*step(0.55, fract(e1*7.0 + q.x*9.0)));
    } else if (k < 1.5) { /* pale yellow with an orange spot */
      alb = mix(vec3(0.96, 0.87, 0.3), vec3(0.95, 0.5, 0.1), 1.0 - smoothstep(0.04, 0.08, length(q - vec2(0.5, 0.25))));
    } else if (k < 2.5) { /* white with dark forewing tips */
      alb = mix(vec3(0.94, 0.94, 0.9), vec3(0.16), step(e1, 1.0)*smoothstep(0.62, 0.7, q.x)*smoothstep(0.2, 0.35, q.y));
    } else {              /* blue, a dark border, a white fringe */
      alb = mix(mix(vec3(0.22, 0.42, 0.95), vec3(0.05, 0.06, 0.1), edge), vec3(0.92), smoothstep(0.93, 0.97, e));
    }
    if (!gl_FrontFacing) alb = mix(alb, vec3(0.62, 0.6, 0.52), 0.45);      /* duller underneath */
  }
  gl_FragColor = vec4(shade(alb, n, vW, 0.55, 0.0), 1.0);
}`;
  /* fireflies: they flash in their own rhythms (a slow glow, a double flash, a quick train), and some keep time with a
     wave that runs along the treeline; each flash climbs a little, as theirs do */
  const FLY_VS = `
${GLSL.FLY}
attribute vec4 aSeed; uniform float uTime, uScale, uI, uCx, uHalf; varying float vA, vH;
void main(){
  float h = aSeed.w; vH = fract(h*5.71); vA = 0.0;
  if (h < 0.0){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }      /* no firefly in this place */
  float lift, f = flyFlash(uTime, h, lift);
  if (f < 0.01){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 p = flyPath(aSeed.xyz, uTime, h, lift);
  vec4 mv = modelViewMatrix*vec4(p, 1.0);
  float px = 0.15*uScale/max(-mv.z, 0.1);
  /* smaller than its sprite far off: dimmer rather than bigger, so the far treeline glitters instead of blazing */
  vA = f*uI*pow(min(1.0, px/2.0), 1.5)*smoothstep(uHalf, uHalf - 40.0, abs(p.x - uCx));
  gl_PointSize = clamp(px, 2.0, 18.0);
  gl_Position = vA < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
}`;
  const FLY_FS = `
varying float vA, vH;
void main(){
  float r = length(gl_PointCoord - 0.5), a = smoothstep(0.5, 0.0, r);
  vec3 c = mix(vec3(0.66, 1.0, 0.26), vec3(1.0, 0.82, 0.3), vH*vH*vH);   /* yellow-green, a few amber */
  gl_FragColor = vec4(c*(a*a*0.7 + smoothstep(0.2, 0.0, r)*2.6)*vA, 1.0);
}`;
  /* midges: dark specks looping and bobbing in a loose column, that light up when you look through them toward the low sun */
  const GNAT_VS = `
attribute vec4 aSw; attribute float aR;   /* the swarm's middle and seed; this midge's own seed */
uniform float uTime, uScale, uI; uniform vec3 uAmbF, uKeyColT, uKeyDirT; uniform vec2 uWind;
varying float vA; varying vec3 vC;
void main(){
  float t = uTime, h = aR, s = aSw.w;
  vec3 c = aSw.xyz + vec3(sin(t*0.31 + s*7.0)*0.5, sin(t*0.23 + s*3.0)*0.25, cos(t*0.27 + s*5.0)*0.5) + vec3(uWind.x, 0.0, uWind.y)*0.3*sin(t*0.4 + s);
  vec3 p = c + vec3(sin(t*(2.1 + h*1.7) + h*40.0)*0.32 + sin(t*7.3 + h*13.0)*0.06,
                    sin(t*(1.6 + h*1.3) + h*23.0)*0.5*(0.6 + 0.4*fract(h*3.7)) + sin(t*9.1 + h*7.0)*0.05,
                    cos(t*(2.3 + h*1.1) + h*31.0)*0.32 + cos(t*6.7 + h*17.0)*0.06);
  vec4 mv = modelViewMatrix*vec4(p, 1.0);
  float d = max(-mv.z, 0.1), px = 0.03*uScale/d;
  float back = pow(max(dot(normalize(p - cameraPosition), uKeyDirT), 0.0), 6.0);
  vC = uAmbF*0.3 + uKeyColT*(0.03 + 1.4*back);
  vA = uI*min(1.0, px)*smoothstep(45.0, 25.0, d)*(0.55 + 0.45*back);
  gl_PointSize = max(px, 1.0);
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
}`;
  const GNAT_FS = `varying float vA; varying vec3 vC;
void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vC, vA*smoothstep(0.5, 0.2, r)); }`;
  /* spray where a dolphin breaks the surface: drops thrown up along ballistic arcs */
  const SPRAY_VS = `
attribute vec4 aS;   /* which splash, and three dice */
uniform float uTime, uScale; uniform vec4 uSpl[8]; uniform vec3 uAmbF, uKeyColT;
varying float vA; varying vec3 vC;
void main(){
  vec4 S = uSpl[int(aS.x + 0.5)];
  float tt = uTime - S.z, life = 0.7 + 0.5*aS.y, a = aS.z*6.2832, sp = (0.4 + 1.1*aS.w)*S.w;
  vec3 p = vec3(S.x, 0.05, S.y) + vec3(cos(a)*sp, (2.0 + 2.6*aS.y)*S.w, sin(a)*sp)*tt - vec3(0.0, 4.9*tt*tt, 0.0);
  vA = tt > 0.0 && tt < life && p.y > -0.05 ? 1.0 - tt/life : 0.0;
  vec4 mv = modelViewMatrix*vec4(p, 1.0);
  float px = 0.07*uScale/max(-mv.z, 0.1);
  vA *= min(1.0, px); vC = uAmbF*1.8 + uKeyColT*0.65;
  gl_PointSize = max(px, 1.0);
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
}`;
  const SPRAY_FS = `varying float vA; varying vec3 vC;
void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vC, vA*smoothstep(0.5, 0.1, r)*0.85); }`;
  /* crab burrows: a dark hole with the sand it threw out round it */
  const HOLE_VS = `
attribute vec4 iP;   /* x, z, size, how much it shows */
varying vec2 vUv; varying float vK;
void main(){ vUv = uv*2.0 - 1.0; vK = iP.w; gl_Position = iP.w < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*viewMatrix*vec4(iP.x + position.x*iP.z, 0.006, iP.y - position.y*iP.z, 1.0); }`;
  const HOLE_FS = `
uniform vec3 uAmbF, uKeyColT, uKeyDirT; varying vec2 vUv; varying float vK;
void main(){
  float r = length(vUv); if (r > 1.0) discard;
  float hole = 1.0 - smoothstep(0.26, 0.36, r), rim = smoothstep(0.3, 0.45, r)*(1.0 - smoothstep(0.55, 1.0, r));
  vec3 sand = vec3(0.6, 0.53, 0.43)*(uAmbF + uKeyColT*max(uKeyDirT.y, 0.0))*1.15;
  gl_FragColor = vec4(sand*(1.0 - hole), (hole*0.75 + rim*0.3)*vK);
}`;

  /* ── meshes, built from parts: positions, colours, and per-vertex weights (aW) that say what moves how ── */
  function Build() {
    const P = [], C = [], W = [], I = [];
    const vtx = (p, c, w) => { P.push(p[0], p[1], p[2]); C.push(c[0], c[1], c[2]); W.push(w[0], w[1], w[2], w[3]); return P.length / 3 - 1; };
    /* a triangle, turned so its face looks along `up` */
    const tri = (a, b, c, up) => {
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const d = (uy * vz - uz * vy) * up[0] + (uz * vx - ux * vz) * up[1] + (ux * vy - uy * vx) * up[2];
      if (d < 0) I.push(a, c, b); else I.push(a, b, c);
    };
    const colOf = (c, p, a) => typeof c === 'function' ? c(p, a) : c;
    return {
      /* a flat panel: a fan through the points */
      panel(pts, c, w, up) { const ids = pts.map(p => vtx(p, colOf(c, p), w(p))); for (let i = 1; i < ids.length - 1; i++) tri(ids[0], ids[i], ids[i + 1], up); },
      /* a ribbon between two rows of points (a wing's leading and trailing edges) */
      strip(A, B, c, w, up) {
        const a = A.map((p, i) => vtx(p, colOf(c, p), w(p, i, 0))), b = B.map((p, i) => vtx(p, colOf(c, p), w(p, i, 1)));
        for (let i = 0; i < A.length - 1; i++) { tri(a[i], b[i], a[i + 1], up); tri(a[i + 1], b[i], b[i + 1], up); }
      },
      /* a body of revolution along x: rings of [x, half-height, half-width, height of the axis] */
      lathe(rings, seg, c, w) {
        const base = P.length / 3;
        for (const [x, ry, rz, yc] of rings) for (let j = 0; j < seg; j++) { const a = j / seg * TAU, p = [x, yc + ry * Math.cos(a), rz * Math.sin(a)]; vtx(p, colOf(c, p, a), w(p)); }
        for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) { const a = base + i * seg + j, b = base + i * seg + (j + 1) % seg; I.push(a, b, a + seg, b, b + seg, a + seg); }
      },
      geo() {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aCol', new T.Float32BufferAttribute(C, 3)); g.setAttribute('aW', new T.Float32BufferAttribute(W, 4));
        g.setIndex(I); g.computeVertexNormals(); return g;
      }
    };
  }
  /* both wings, as strips from shoulder to tip: S the stations out along the span, ch the chord at each */
  function wings(b, S, ch, root, le0, le1, col) {
    for (const sd of [-1, 1]) {
      const LE = S.map(s => [le0 + le1 * s * s, 0, sd * (root + s)]), TE = S.map((s, i) => [le0 + le1 * s * s - ch[i], 0, sd * (root + s)]);
      b.strip(LE, TE, col, (p, i, e) => [1, sd, S[i], e ? ch[i] : 0], [0, 1, 0]);
    }
  }
  /* the birds of the flocks: the model itself, built light (feet down at hipY below its origin), with a pair of open
     wings added, strips from shoulder to tip that BIRD_VS beats (the folded ones are the model's own) */
  function birdGeo(name, S, ch, root, le0, le1) {
    const P = Models.make(name, { lite: true, parts: true }).userData.parts, b = Build();
    wings(b, S, ch, root, le0, le1, [1, 1, 1]);
    const geo = mergeGeo([P.geo, b.geo()]); geo.userData.hipY = P.hipY; return geo;
  }
  /* (indexed geometries with the same attributes, as one) */
  function mergeGeo(list) {
    const keys = ['position', 'normal', 'aCol', 'aW'], out = {}, idx = [];
    for (const k of keys) out[k] = [];
    let base = 0;
    for (const g of list) {
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const k of keys) { const a = g.attributes[k].array, o = out[k]; for (let i = 0; i < a.length; i++) o.push(a[i]); }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
      base += g.attributes.position.count;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(out.position, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(out.normal, 3));
    g.setAttribute('aCol', new T.Float32BufferAttribute(out.aCol, 3)); g.setAttribute('aW', new T.Float32BufferAttribute(out.aW, 4));
    g.setIndex(idx); return g;
  }
  /* (the open wing's grey is the model's mantle; HEADX, HEADY where the head goes in flight, from where it is standing) */
  const GULL_D = { GULL: 1, ROOT: 0.04, LE0: 0.06, LE1: -0.25, WR: 0.3, SPAN: 0.66, DIH: 0.12, ARM: 0.8, HAND: 0.5, DROOP: 0.25, SWEEP: 0.15, SWEEPK: 0.55,
    WINGY: 0.035, HEADX: 0.03, HEADY: -0.065, LEGX: 0.0, LEGY: 0.0, WTOP: 'vec3(0.40, 0.45, 0.49)', WUND: 'vec3(0.85, 0.86, 0.86)' };
  const gullGeo = () => birdGeo('life/gull', [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.58, 0.66], [0.17, 0.165, 0.158, 0.15, 0.13, 0.105, 0.075, 0.025], 0.04, 0.06, -0.25);
  const PIPER_D = { PIPER: 1, ROOT: 0.018, LE0: 0.03, LE1: -0.7, WR: 0.07, SPAN: 0.17, DIH: 0.1, ARM: 1.0, HAND: 0.45, DROOP: 0.1, SWEEP: 0.1, SWEEPK: 0.7,
    WINGY: 0.016, HEADX: 0.008, HEADY: -0.014, LEGX: 0.0, LEGY: 0.0, WTOP: 'vec3(0.38, 0.36, 0.32)', WUND: 'vec3(0.88, 0.88, 0.86)' };
  const piperGeo = () => birdGeo('life/sandpiper', [0, 0.04, 0.07, 0.1, 0.135, 0.17], [0.065, 0.062, 0.056, 0.046, 0.032, 0.012], 0.018, 0.03, -0.7);
  const BAT_D = { ROOT: 0.01, LE0: 0.012, LE1: -0.9, WR: 0.055, DIH: 0.12, ARM: 0.95, HAND: 0.7, SWEEP: 0.1, SWEEPK: 0.9, GLOSS: 0 };
  function batGeo() {
    const b = Build(), fur = [0.13, 0.095, 0.075];
    b.lathe([[-0.04, 0.003, 0.004, 0], [-0.026, 0.011, 0.012, 0], [0, 0.015, 0.015, 0], [0.02, 0.012, 0.011, 0.002], [0.033, 0.01, 0.009, 0.004], [0.043, 0.003, 0.003, 0.004]], 6, fur, W0);
    for (const sd of [-1, 1]) b.panel([[0.03, 0.012, sd * 0.004], [0.038, 0.012, sd * 0.006], [0.033, 0.03, sd * 0.008]], fur, W0, [1, 0, 0]);
    wings(b, [0, 0.025, 0.055, 0.08, 0.11, 0.14], [0.06, 0.066, 0.05, 0.056, 0.036, 0.008], 0.01, 0.012, -0.9, [0.09, 0.07, 0.06]);
    return b.geo();
  }
  function dflyGeo() {
    const b = Build();
    b.lathe([[-0.062, 0.0015, 0.0015, 0.002], [-0.04, 0.0025, 0.0025, 0.0015], [-0.01, 0.003, 0.003, 0.001], [-0.006, 0.005, 0.005, 0.001], [0.008, 0.006, 0.0055, 0.001], [0.012, 0.004, 0.004, 0.001], [0.014, 0.0055, 0.006, 0.0015], [0.021, 0.004, 0.005, 0.0015]], 6,
      p => p[0] > 0.012 ? [0.3, 0.3, 0.3] : [1, 1, 1], W0);
    return b.geo();
  }
  function dflyWingGeo() {
    const b = Build();
    for (const sd of [-1, 1]) for (const [x0, ch, sp, k] of [[0.008, 0.009, 0.046, 0], [-0.004, 0.011, 0.043, 1]]) {
      const S = [0, 0.33, 0.66, 1].map(u => u * sp), C = [0.6, 1, 0.95, 0.5].map(u => u * ch);
      b.strip(S.map(s => [x0 - s * 0.08, 0, sd * (0.004 + s)]), S.map((s, i) => [x0 - s * 0.08 - C[i], 0, sd * (0.004 + s)]), [1, 1, 1], (p, i) => [1, sd, S[i], k], [0, 1, 0]);
    }
    return b.geo();
  }
  function bflyGeo() {
    const b = Build();
    b.lathe([[-0.022, 0.002, 0.002, 0], [-0.005, 0.0035, 0.0035, 0], [0.012, 0.003, 0.003, 0], [0.018, 0.002, 0.002, 0]], 5, [0.07, 0.06, 0.05], W0);
    for (const sd of [-1, 1]) b.panel([[-0.03, 0, sd * 0.003], [0.028, 0, sd * 0.003], [0.028, 0, sd * 0.05], [-0.03, 0, sd * 0.05]], [1, 1, 1], p => [1, sd, (Math.abs(p[2]) - 0.003) / 0.047, p[0] > 0 ? 1 : -1], [0, 1, 0]);
    return b.geo();
  }
  function crabGeo() { return crabP().geo; }
  function dolphinGeo() {
    const b = Build(), dark = [0.16, 0.18, 0.21], pale = [0.6, 0.62, 0.64], U = p => [0, 0, cl((1.12 - p[0]) / 2.35, 0, 1), 0], UF = p => [1, 0, cl((1.12 - p[0]) / 2.35, 0, 1), 0];
    b.lathe([[1.13, 0.012, 0.012, -0.02], [1.04, 0.045, 0.04, -0.03], [0.96, 0.07, 0.065, -0.02], [0.88, 0.13, 0.12, 0.02], [0.72, 0.2, 0.19, 0.02], [0.45, 0.26, 0.24, 0.01], [0.1, 0.26, 0.24, 0], [-0.3, 0.19, 0.17, 0], [-0.62, 0.11, 0.09, 0], [-0.86, 0.055, 0.045, 0], [-1.0, 0.035, 0.03, 0]], 10,
      (p, a) => mix3(dark, pale, sm(-0.2, -0.7, Math.cos(a))), U);
    b.panel([[0.18, 0.22, 0], [-0.1, 0.42, 0], [-0.36, 0.5, 0], [-0.22, 0.2, 0]], dark, UF, [0, 0, 1]);
    for (const sd of [-1, 1]) {
      b.panel([[0.62, -0.1, sd * 0.18], [0.44, -0.12, sd * 0.18], [0.36, -0.24, sd * 0.42]], dark, UF, [0, -1, 0]);
      b.panel([[-0.95, 0, sd * 0.01], [-1.13, 0, sd * 0.34], [-1.23, 0, sd * 0.31], [-1.12, 0, sd * 0.02]], dark, UF, [0, 1, 0]);
    }
    return b.geo();
  }

  /* a humpback: a long, deep body with a blunt, knobbly head, long pale flippers, a small hump of a dorsal fin, broad
     notched flukes; dark above, pale below (length 1, nose toward +x; aW.z how far back along it, for the tail's flex) */
  function whaleGeo() {
    const b = Build(), dark = [0.05, 0.055, 0.062], belly = [0.36, 0.37, 0.39], U = p => [0, 0, cl((0.5 - p[0]) / 1.1, 0, 1), 0], UF = p => [1, 0, cl((0.5 - p[0]) / 1.1, 0, 1), 0], UT = p => [2, 0, cl((0.5 - p[0]) / 1.1, 0, 1), 0];
    b.lathe([[0.5, 0.01, 0.012, -0.006], [0.49, 0.036, 0.042, -0.012], [0.46, 0.066, 0.075, -0.014], [0.4, 0.092, 0.1, -0.012], [0.3, 0.11, 0.118, -0.008], [0.16, 0.118, 0.122, -0.004],
      [0.02, 0.113, 0.115, 0], [-0.12, 0.097, 0.095, 0.004], [-0.24, 0.072, 0.067, 0.006], [-0.34, 0.049, 0.042, 0.006], [-0.42, 0.031, 0.024, 0.004], [-0.48, 0.02, 0.014, 0.002], [-0.52, 0.013, 0.009, 0]], 14,
      (p, a) => mix3(dark, belly, sm(-0.2, -0.8, Math.cos(a)) * sm(-0.4, 0.15, p[0])), U);
    b.panel([[-0.1, 0.092, 0], [-0.15, 0.124, 0], [-0.19, 0.13, 0], [-0.2, 0.085, 0]], dark, U, [0, 0, 1]);
    for (const sd of [-1, 1]) {
      b.panel([[0.22, -0.065, sd * 0.1], [0.14, -0.07, sd * 0.11], [-0.05, -0.11, sd * 0.39], [-0.01, -0.105, sd * 0.4]], [0.62, 0.63, 0.64], UF, [0, -1, 0]);
      b.panel([[-0.5, 0, sd * 0.004], [-0.53, 0, sd * 0.1], [-0.565, 0, sd * 0.2], [-0.6, 0, sd * 0.19], [-0.575, 0, sd * 0.08], [-0.565, 0, sd * 0.012]], dark, UT, [0, 1, 0]);
    }
    return b.geo();
  }

  /* numbers for #defines are always written as floats */
  const defs = d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'number' ? (Number.isInteger(v) ? v.toFixed(1) : String(v)) : v]));
  const mat = (vs, fs, d = {}, uni = {}, opt = {}) => new T.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, Mats.U, uni), vertexShader: vs, fragmentShader: fs, defines: defs(d), side: T.DoubleSide }, opt));

  function build(root, world) {
    const G = new T.Group(); G.name = 'fauna'; root.add(G);
    const land = (x, z) => world ? world.land(x, z) : 0;
    const sandAt = (x, z) => land(x, z) <= 0.02;            /* bare beach, not rock or rising ground */
    /* where the van is and how fast it goes, and the camera if it is down at walking height: what the shy ones run from */
    const th = { vx: 0, vz: 0, vs: 0, cx: 0, cz: 0, low: false, seen: false };
    const threat = (x, z, rv, rc) => Math.hypot(x - th.vx, z - th.vz) < rv + th.vs * 1.1 ? 1 : th.low && Math.hypot(x - th.cx, z - th.cz) < rc ? 2 : 0;
    /* new arrivals are placed ahead of the camera when it travels along the coast, either side when it doesn't */
    let camV = 0, camDir = 0, lastCx = null;
    const side = () => camDir || (rnd() < 0.5 ? -1 : 1);

    /* an instanced mesh whose per-instance data is written here: n slots, attributes [name, size] */
    function herd(geo, n, m, attrs) {
      const g = new T.InstancedBufferGeometry(); g.index = geo.index;
      for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
      const A = {}, list = [];
      for (const [k, size] of attrs) { const a = new T.InstancedBufferAttribute(new Float32Array(n * size), size); a.setUsage(T.DynamicDrawUsage); g.setAttribute(k, a); A[k] = a.array; list.push(a); }
      g.instanceCount = 0;
      const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; G.add(mesh);
      return { mesh, g, A, draw(k, changed = true) { g.instanceCount = k; mesh.visible = k > 0 || warm > 0; if (changed && k > 0) for (const a of list) a.needsUpdate = true; } };
    }
    /* a point cloud of n points with the given attributes */
    function cloud(n, attrs, m) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const A = {}; for (const [k, size] of attrs) { A[k] = new T.Float32BufferAttribute(new Float32Array(n * size), size); g.setAttribute(k, A[k]); }
      const p = new T.Points(g, m); p.frustumCulled = false; G.add(p); return { p, g, A };
    }

    /* ── fireflies along the forest edge, wherever the camera is. The coast round the camera is cut into cells of CF metres;
       a cell left behind is moved ahead and its fireflies laid out afresh where it now lies (the same way each time a stretch
       comes round). They are interleaved across the cells, so the density setting draws an even share of every cell ── */
    const flies = (() => {
      const NC = 32, CF = 10, SPAN = NC * CF, PER = 120, N = NC * PER, cellX = new Float64Array(NC).fill(NaN);
      const u = { uTime: Mats.U.uTime, uScale: { value: 1000 }, uI: { value: 0 }, uCx: { value: 0 }, uHalf: { value: SPAN / 2 } };
      const C = cloud(N, [['aSeed', 4]], new T.ShaderMaterial({ uniforms: u, vertexShader: FLY_VS, fragmentShader: FLY_FS, blending: T.AdditiveBlending, transparent: true, depthWrite: false })), S = C.A.aSeed.array;
      function lay(j, X) {
        cellX[j] = X;
        const ci = Math.round(X / CF);
        for (let s = 0; s < PER; s++) {
          const k = (s * NC + j) * 4, r = n => hash2(ci * 1.37 + s * 0.071 + n * 17.13, s * 3.17 + n * 1.9 + ci * 0.013);
          const x = X + r(1) * CF, depth = -3.5 + 12 * r(2) * r(2);   /* over the grass in front of the trees and at their edge, fewer in among them */
          const z = Layout.vegZ(x) + depth, y = Math.max(0, land(x, z)) + 0.3 + 1.9 * Math.pow(r(3), 1.6) * (depth > 1 ? 1.3 : 0.7);
          /* in patches: some stretches of the treeline full of them, others with hardly any. The camp keeps its own
             fireflies round its bushes (fx.js): these thin out toward it */
          const patch = 0.15 + 0.85 * sm(0.35, 0.8, 0.5 + 0.35 * Math.sin(x * 0.041 + 1.3) + 0.25 * Math.sin(x * 0.0173 + 4.1));
          const keep = sm(14, 24, Math.abs(x - Layout.camp.x)) * patch > r(4);
          S[k] = x; S[k + 1] = y; S[k + 2] = z; S[k + 3] = keep ? r(5) : -1;
        }
      }
      return {
        n: 0,
        update(cx, I, k, scale) {
          u.uCx.value = cx; u.uScale.value = scale; u.uI.value = I;
          this.n = I > 0.003 ? Math.round(N * k) : 0;
          C.p.visible = this.n > 0 || warm > 0; C.g.setDrawRange(0, this.n);
          if (!this.n) return;
          let moved = false;
          for (let j = 0; j < NC; j++) {
            const X = cellX[j];
            if (X !== X) { lay(j, Math.floor(cx / CF) * CF - SPAN / 2 + j * CF); moved = true; continue; }
            const m = Math.round((cx - X - CF / 2) / SPAN);
            if (m) { lay(j, X + m * SPAN); moved = true; }
          }
          if (moved) C.A.aSeed.needsUpdate = true;
        },
        shift(dx, dz) { for (let i = 0; i < N; i++) { S[i * 4] += dx; S[i * 4 + 2] += dz; } for (let j = 0; j < NC; j++) cellX[j] += dx; C.A.aSeed.needsUpdate = true; },
        /* for picking up (inspect.js): those near the camera (FLY_VS's path, the same sums here); let go, it flies off */
        pickables(list, cam) {
          if (!this.n) return; const t = Mats.U.uTime.value;
          for (let i = 0; i < this.n; i++) {
            const k = i * 4, h = S[k + 3]; if (h < 0) continue;
            const dx = S[k] - cam.x, dz = S[k + 2] - cam.z; if (dx * dx + dz * dz > 400) continue;
            const x = S[k] + Math.sin(t * 0.13 + h * 12) * 1.1 + Math.sin(t * 0.31 + h * 5) * 0.35, y = S[k + 1] + Math.sin(t * 0.17 + h * 7) * 0.32 + Math.sin(t * 0.43 + h * 3) * 0.08 + 0.03, z = S[k + 2] + Math.cos(t * 0.11 + h * 9) * 1.1 + Math.cos(t * 0.29 + h * 2) * 0.35;
            list.push({ kind: 'firefly', x, y, z, r: 0.05, yaw: 0, size: 1.3, reach: 20,
              take() { S[k + 3] = -1; C.A.aSeed.needsUpdate = true; }, give() { S[k + 3] = h; C.A.aSeed.needsUpdate = true; } });
          }
        }
      };
    })();

    /* ── midges: small swarms dancing over the edge of the trees at dusk ── */
    const gnats = (() => {
      const NS = 14, PS = 40, N = NS * PS, cx = new Float64Array(NS).fill(NaN);
      const u = { uTime: Mats.U.uTime, uScale: { value: 1000 }, uI: { value: 0 }, uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uKeyDirT: Mats.U.uKeyDirT, uWind: { value: new T.Vector2(Layout.wind[0], Layout.wind[1]) } };
      const C = cloud(N, [['aSw', 4], ['aR', 1]], new T.ShaderMaterial({ uniforms: u, vertexShader: GNAT_VS, fragmentShader: GNAT_FS, transparent: true, depthWrite: false })), S = C.A.aSw.array;
      for (let i = 0; i < N; i++) C.A.aR.array[i] = rnd();
      function put(j, x) {
        const z = Layout.vegZ(x) - 1.5 + rnd() * 4, y = Math.max(0, land(x, z)) + 1.1 + rnd() * 1.5, s = rnd() * 100;
        cx[j] = x; for (let i = j * PS; i < (j + 1) * PS; i++) { S[i * 4] = x; S[i * 4 + 1] = y; S[i * 4 + 2] = z; S[i * 4 + 3] = s; }
        C.A.aSw.needsUpdate = true;
      }
      return {
        n: 0,
        update(camX, I, k, scale) {
          u.uI.value = I; u.uScale.value = scale;
          const n = I > 0.003 ? Math.round(NS * k) : 0; this.n = n * PS;
          C.p.visible = n > 0 || warm > 0; C.g.setDrawRange(0, n * PS);
          for (let j = 0; j < n; j++) if (cx[j] !== cx[j]) put(j, camX + (rnd() - 0.5) * 90); else if (Math.abs(cx[j] - camX) > 55) put(j, camX + side() * (35 + rnd() * 18));
        },
        shift(dx, dz) { for (let i = 0; i < N; i++) { S[i * 4] += dx; S[i * 4 + 2] += dz; } for (let j = 0; j < NS; j++) cx[j] += dx; C.A.aSw.needsUpdate = true; },
        S
      };
    })();

    /* ── fliers whose flight the shader works out: bats, dragonflies, butterflies. uN is how many show (continuous, so the one at
       the edge grows or shrinks instead of popping); home(i, camX, fresh) places one, and returns false to leave it where it is ── */
    function fliers(geo, m, MAX, R, home, kinds) {
      const H = herd(geo, MAX, m, [['iH', 4], ['iK', 4]]), hx = new Float64Array(MAX).fill(NaN), A = H.A;
      for (let i = 0; i < MAX; i++) { A.iK[i * 4] = i; A.iH[i * 4 + 3] = rnd(); if (kinds) kinds(A.iK, i); }
      return {
        H, A, n: 0, more: [H],
        update(camX, n) {
          m.uniforms.uN.value = n; this.n = Math.round(n);
          const k = Math.min(MAX, Math.ceil(n)); let ch = false;
          for (let i = 0; i < k; i++) {
            const fresh = hx[i] !== hx[i];
            if (!fresh && Math.abs(hx[i] - camX) < R) continue;
            const p = home(i, camX, fresh); if (!p) continue;
            hx[i] = p[0]; A.iH[i * 4] = p[0]; A.iH[i * 4 + 1] = p[1]; A.iH[i * 4 + 2] = p[2]; ch = true;
          }
          for (const h of this.more) h.draw(k, ch);
        },
        shift(dx, dz) { for (let i = 0; i < MAX; i++) { A.iH[i * 4] += dx; A.iH[i * 4 + 2] += dz; hx[i] += dx; } for (const h of this.more) h.draw(h.g.instanceCount, true); }
      };
    }
    /* bats hunt over the beach and the treeline */
    const bats = fliers(batGeo(), mat(BAT_VS, GEN_FS, BAT_D, { uN: { value: 0 } }), 24, 60, (i, cx, fresh) => {
      const x = fresh ? cx + (rnd() - 0.5) * 100 : cx + side() * (45 + rnd() * 12), z = Layout.shoreZ(x) + 3 + rnd() * (Layout.vegZ(x) + 4 - Layout.shoreZ(x) - 3);
      return [x, Math.max(0, land(x, z)) + 3 + rnd() * 3.5, z];
    });
    /* dragonflies hawk over the open sand in front of the trees: half keep to the camp, half to wherever the camera is */
    const dragon = fliers(dflyGeo(), mat(DFLY_VS, DFLY_FS, {}, { uN: { value: 0 } }), 16, 45, (i, cx, fresh) => {
      if (i % 2 === 0 && !fresh) return false;
      const x = i % 2 === 0 ? Layout.camp.x + (rnd() - 0.5) * 26 : fresh ? cx + (rnd() - 0.5) * 80 : cx + side() * (32 + rnd() * 10), z = Layout.vegZ(x) - 1.5 - rnd() * 4;
      return [x, Math.max(0, land(x, z)), z];
    }, (K, i) => { K[i * 4 + 1] = Math.floor(rnd() * 4); });
    { const m = mat(DFLY_VS, DFLY_FS, { WINGS: 1 }, { uN: dragon.H.mesh.material.uniforms.uN }, { transparent: true, depthWrite: false });
      const g = new T.InstancedBufferGeometry(), wg = dflyWingGeo(); g.index = wg.index;
      for (const k of Object.keys(wg.attributes)) g.setAttribute(k, wg.attributes[k]);
      for (const k of ['iH', 'iK']) g.setAttribute(k, dragon.H.g.attributes[k]);
      g.instanceCount = 0; const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; G.add(mesh);
      dragon.more.push({ g, mesh, draw(k) { g.instanceCount = k; mesh.visible = k > 0 || warm > 0; } }); }
    /* butterflies along the forest edge, over the grass and flowers in front of the trees; by the camp they are fx.js's */
    const butter = fliers(bflyGeo(), mat(BFLY_VS, BFLY_FS, {}, { uN: { value: 0 } }), 30, 55, (i, cx, fresh) => {
      for (let k = 0; k < 8; k++) {
        const x = fresh ? cx + (rnd() - 0.5) * 90 : cx + side() * (42 + rnd() * 10);
        if (Math.abs(x - Layout.camp.x) < 20) continue;
        const z = Layout.vegZ(x) - 3 + rnd() * 2.5; return [x, Math.max(0, land(x, z)) + 0.6 + rnd() * 1.1, z];
      }
      return false;
    }, (K, i) => { K[i * 4 + 1] = Math.floor(rnd() * 4); K[i * 4 + 2] = 1.3 + rnd() * 0.5; });

    /* (where butterfly i is at time t: BFLY_VS's own path, the same sums here) */
    const fr = x => x - Math.floor(x);
    const bPath = (t, s) => [2.4 * Math.sin(t * 0.31 + s * 5.0) + 0.6 * Math.sin(t * 1.7 + s * 2.0), 0.3 * Math.sin(t * 0.9 + s * 3.0) + 0.15 * Math.sin(t * 2.3 + s), 1.1 * Math.sin(t * 0.23 + s * 4.0) + 0.4 * Math.sin(t * 1.3 + s * 6.0)];
    /* (where dragonfly i hovers at time t: DFLY_VS's own hash and spots) */
    const hk = (k, j) => { let x = (Math.imul((k | 0) + 100003, 747796405) + Math.imul(j | 0, 2891336453 | 0)) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b) >>> 0; x ^= x >>> 16; return (x & 0xffffff) / 16777216; };
    const dSpot = (k, i) => [(hk(k, i * 3) - 0.5) * 5, hk(k, i * 3 + 1) * 1.3 + 0.45, (hk(k, i * 3 + 2) - 0.5) * 3.2];
    function dflyPickables(list) {
      const A = dragon.A, t = Mats.U.uTime.value, n = dragon.H.mesh.material.uniforms.uN.value, sm2 = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
      for (let i = 0; i < dragon.H.g.instanceCount; i++) {
        const q = i * 4, idx = A.iK[q]; if (idx >= n - 0.2 || A.iK[q + 3] > 0.5) continue;
        const s = A.iH[q + 3], P = 1.6 + 1.6 * hk(7, idx), Tt = t / P + s * 17, k = Math.floor(Tt), f = Tt - k, m = sm2(0.76, 0.93, f);
        const a = dSpot(k, idx), b = dSpot(k + 1, idx), z = dSpot(k - 1, idx);
        const y0 = Math.atan2(-(a[2] - z[2]), a[0] - z[0]), y1 = Math.atan2(-(b[2] - a[2]), b[0] - a[0]), yaw = y0 + Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)) * sm2(0.62, 0.76, f);
        list.push({ kind: 'dragonfly', x: A.iH[q] + a[0] + (b[0] - a[0]) * m, y: A.iH[q + 1] + a[1] + (b[1] - a[1]) * m, z: A.iH[q + 2] + a[2] + (b[2] - a[2]) * m, r: 0.09, yaw, size: 1.15 * 1.4, opts: { kind: A.iK[q + 1] | 0 },
          take() { A.iK[q + 3] = 1; dragon.H.g.attributes.iK.needsUpdate = true; },
          give() { A.iK[q + 3] = 0; dragon.H.g.attributes.iK.needsUpdate = true; } });
      }
    }
    /* (where bat i is: BAT_VS's own jinking path) */
    const batPath = (t, s) => { const fx = 0.72 + 0.56 * fr(s * 13.7), fy = 0.72 + 0.56 * fr(s * 7.9), fz = 0.72 + 0.56 * fr(s * 3.3), ax = 0.75 + 0.5 * fr(s * 5.1), ay = 0.75 + 0.5 * fr(s * 11.3), az = 0.75 + 0.5 * fr(s * 2.9);
      return [5.5 * ax * Math.sin(t * 0.37 * fx + s * 6.1) + 2.6 * ay * Math.sin(t * 1.13 * fy + s * 2.3) + 0.9 * az * Math.sin(t * 3.7 * fz + s * 9.4), 0.8 * az * Math.sin(t * 0.71 * fy + s * 4.7) + 0.35 * Math.sin(t * 2.9 * fx + s * 1.9),
        3.5 * ay * Math.sin(t * 0.43 * fz + s * 3.3) + 1.8 * ax * Math.sin(t * 1.31 * fx + s * 7.7) + 0.8 * az * Math.sin(t * 4.1 * fy + s * 5.2)]; };
    function batPickables(list) {
      const A = bats.A, n = bats.H.mesh.material.uniforms.uN.value;
      for (let i = 0; i < bats.H.g.instanceCount; i++) {
        const q = i * 4; if (A.iK[q] >= n - 0.2 || A.iK[q + 3] > 0.5) continue;
        const s = A.iH[q + 3], t = Mats.U.uTime.value + s * 50, p = batPath(t, s), a = batPath(t - 0.05, s), b = batPath(t + 0.05, s);
        list.push({ kind: 'bat', x: A.iH[q] + p[0], y: A.iH[q + 1] + p[1], z: A.iH[q + 2] + p[2], r: 0.3, yaw: Math.atan2(-(b[2] - a[2]), b[0] - a[0]), size: 1,
          take() { A.iK[q + 3] = 1; bats.H.g.attributes.iK.needsUpdate = true; }, give() { A.iK[q + 3] = 0; bats.H.g.attributes.iK.needsUpdate = true; } });
      }
    }
    function bflyPickables(list) {
      const A = butter.A, t = Mats.U.uTime.value, n = butter.H.mesh.material.uniforms.uN.value;
      for (let i = 0; i < butter.H.g.instanceCount; i++) {
        const q = i * 4; if (A.iK[q] >= n - 0.2 || A.iK[q + 2] <= 0) continue;
        const s = A.iH[q + 3], tt = t * (0.8 + 0.4 * fr(s * 3.1)) + s * 40, ph = t * TAU * (7 + 3 * fr(s * 5.7)) + s * 20;
        const p = bPath(tt, s), a = bPath(tt - 0.05, s), b = bPath(tt + 0.05, s), size = A.iK[q + 2];
        list.push({ kind: 'butterfly', x: A.iH[q] + p[0], y: A.iH[q + 1] + p[1] + 0.035 * Math.sin(ph - 1), z: A.iH[q + 2] + p[2], r: 0.07 * size, yaw: Math.atan2(-(b[2] - a[2]), b[0] - a[0]), size: size * 1.5, opts: { kind: A.iK[q + 1] | 0 },
          take() { A.iK[q + 2] = 0; butter.H.g.attributes.iK.needsUpdate = true; },
          give() { A.iK[q + 2] = size; butter.H.g.attributes.iK.needsUpdate = true; } });
      }
    }

    /* ── gulls: wheeling over the surf, cruising along the coast, standing on the sand in small groups facing into the breeze;
       a group lifts off when the van or a walker comes near, flies off, and lands somewhere further along ── */
    const gulls = (() => {
      const MAX = 22, GG = gullGeo(), LEGH = GG.userData.hipY, H = herd(GG, MAX, mat(BIRD_VS, BIRD_FS, GULL_D), [['iP', 4], ['iQ', 4], ['iC', 4], ['iR', 4]]), A = H.A;
      const ROLE = 'WSCSWSWCSSWCSWSCWSSWCS', grp = [0, 1, 2].map(() => ({ x: 0, z: 0, fresh: false }));
      const windYaw = Math.atan2(Layout.wind[1], -Layout.wind[0]);      /* facing into the breeze */
      let ns = 0;
      const L = [...ROLE].map((role, i) => ({ i, role, grp: role === 'S' ? Math.floor(ns++ / 4) : -1, mode: 'off', x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, v: 7, ph: rnd() * TAU, amp: 0,
        fold: 0, legs: 0, cyc: 0, flap: false, seed: rnd(), cx: 0, cz: 0, R: 10, th: 0, dir: 1, alt: 8, off: 10, t0: 0, yawT: 0, lx: 0, lz: 0 }));
      function wheel(g, cx, near) {
        const x = near ? cx + (rnd() - 0.5) * 140 : cx + side() * (75 + rnd() * 40);
        Object.assign(g, { mode: 'wheel', cx: x, cz: Layout.shoreZ(x) - 6 - rnd() * 18, R: 7 + rnd() * 12, th: rnd() * TAU, dir: rnd() < 0.5 ? 1 : -1, v: 6 + rnd() * 2.5, alt: 7 + rnd() * 9, fold: 0, legs: 0, amp: 0.06, flap: false, cyc: rnd() * 5 });
      }
      function cruise(g, cx, near) {
        const d = rnd() < 0.5 ? 1 : -1, x = near ? cx + (rnd() - 0.5) * 200 : cx - d * (105 + rnd() * 30), off = 4 + rnd() * 26;
        Object.assign(g, { mode: 'cruise', dir: d, x, off, alt: 3 + rnd() * 7, v: 8 + rnd() * 2.5, z: Layout.shoreZ(x) - off, yaw: d > 0 ? 0 : Math.PI, roll: 0, pitch: 0, fold: 0, legs: 0, amp: 0.3, flap: true, cyc: rnd() * 2 });
        g.lx = g.x - d; g.lz = g.z; g.y = g.alt;
      }
      function stand(g, cx, near) {
        const q = grp[g.grp];
        if (!q.fresh) {
          for (let k = 0; k < 16 && !q.fresh; k++) {
            /* (the first group, when it can, on the stretch of sand in view of where the camera starts) */
            const x = !near ? cx + side() * (55 + rnd() * 45) : g.grp === 0 && k < 10 ? cx + (rnd() < 0.5 ? -1 : 1) * (11 + rnd() * 5) : cx + (rnd() - 0.5) * 110;
            const z = Layout.shoreZ(x) + 2.6 + rnd() * 2.4;
            if (sandAt(x, z) && Layout.vegZ(x) - z > 1.2 && Math.hypot(x - th.vx, z - th.vz) > 10 && Math.hypot(x - Layout.camp.x, z - Layout.camp.z) > 7 && Math.hypot(x - Layout.fire.x, z - Layout.fire.z) > 5) { q.x = x; q.z = z; q.fresh = true; }
          }
          if (!q.fresh) return false;
        }
        Object.assign(g, { mode: 'stand', x: q.x + (rnd() - 0.5) * 3.2, z: q.z + (rnd() - 0.5) * 1.6, y: 0, yaw: windYaw + (rnd() - 0.5) * 1.4, pitch: 0.06, roll: 0, fold: 1, legs: 1, amp: 0, v: 0, cyc: 1 + rnd() * 6 });
        g.yawT = g.yaw; return true;
      }
      /* lift off, away from (fx, fz) and into the breeze */
      function lift(g, t, delay, fx, fz) {
        let ax = g.x - fx, az = g.z - fz; const l = Math.hypot(ax, az) || 1; ax = ax / l - Layout.wind[0] * 0.6; az = az / l - Layout.wind[1] * 0.6;
        Object.assign(g, { mode: 'lift', t0: t + delay, yawT: Math.atan2(-az, ax), v: 0 });
        if (g.grp >= 0) grp[g.grp].fresh = false;
      }
      /* a few beats, then a glide, and again */
      function beat(g, dt, fS, gS, aF, aG, hz) {
        if ((g.cyc -= dt) <= 0) { g.flap = !g.flap; g.cyc = (g.flap ? fS : gS) * (0.6 + 0.8 * rnd()); }
        g.amp += ((g.flap ? aF : aG) - g.amp) * Math.min(1, dt * 4); g.ph += TAU * hz * dt;
      }
      /* turn toward a heading at a limited rate, banking with the turn, and fly on */
      function fly(g, dt, yawT, rate) {
        const d = cl(turn(g.yaw, yawT), -rate * dt, rate * dt); g.yaw += d;
        g.roll += (cl(-(dt > 0 ? d / dt : 0) * g.v / 9.8, -0.7, 0.7) - g.roll) * Math.min(1, dt * 3);
        g.x += Math.cos(g.yaw) * g.v * dt; g.z -= Math.sin(g.yaw) * g.v * dt;
      }
      function step(g, t, dt, cam) {
        if (g.mode === 'wheel') {
          g.th += g.dir * g.v / g.R * dt; g.cx += Layout.wind[0] * 0.4 * dt;
          const c = Math.cos(g.th), s = Math.sin(g.th), ph = t * 0.21 + g.seed * 9;
          g.x = g.cx + g.R * c; g.z = g.cz + g.R * s; g.y = g.alt + 1.6 * Math.sin(ph);
          g.yaw = Math.atan2(-c * g.dir, -s * g.dir);
          /* banked into the circle (its middle is on the side its way round says) */
          g.roll = g.dir * Math.min(0.6, Math.atan(g.v * g.v / (g.R * 9.8)));
          g.pitch = Math.atan2(1.6 * 0.21 * Math.cos(ph), g.v);
          beat(g, dt, 1.3, 6, 0.55, 0.05, 2.8);
          if (Math.abs(g.cx - cam.x) > 145) wheel(g, cam.x, false);
        } else if (g.mode === 'cruise') {
          g.x += g.dir * g.v * dt; g.z = Layout.shoreZ(g.x) - g.off - 4 * Math.sin(t * 0.13 + g.seed * 7); g.y = g.alt + Math.sin(t * 0.3 + g.seed * 5);
          const dx = g.x - g.lx, dz = g.z - g.lz; g.lx = g.x; g.lz = g.z;
          if (dt > 0) { const d = turn(g.yaw, Math.atan2(-dz, dx)); g.yaw += d; g.roll += (cl(-d / dt * g.v / 9.8, -0.6, 0.6) - g.roll) * Math.min(1, dt * 2); }
          beat(g, dt, 2.4, 3.5, 0.5, 0.05, 2.9);
          if ((g.x - cam.x) * g.dir > 140) cruise(g, cam.x, false);
        } else if (g.mode === 'stand') {
          if ((g.cyc -= dt) <= 0) { g.cyc = 2 + rnd() * 7; g.yawT = windYaw + (rnd() - 0.5) * 1.4; }
          g.yaw += cl(turn(g.yaw, g.yawT), -1.6 * dt, 1.6 * dt);
          const w = threat(g.x, g.z, 6, 7);
          if (w) for (const h of L) if (h.grp === g.grp && h.mode === 'stand') lift(h, t, h === g ? 0 : rnd() * 0.7, w === 1 ? th.vx : th.cx, w === 1 ? th.vz : th.cz);
          if (g.mode === 'stand' && Math.abs(g.x - cam.x) > 140) { g.mode = 'off'; grp[g.grp].fresh = false; }
        } else if (g.mode === 'lift') {
          const e = t - g.t0;
          if (e > 0) {
            g.legs = Math.max(0, 1 - e / 0.45); g.fold = Math.max(0, 1 - e / 0.22);
            g.v = Math.min(7.5, g.v + 6 * dt); g.y += 2.6 * Math.max(0.15, 1 - e / 3) * dt;
            g.amp += (0.95 - g.amp) * Math.min(1, dt * 8); g.ph += TAU * 3.6 * dt; g.pitch = 0.35 * Math.max(0, 1 - e / 2.2);
            fly(g, dt, g.yawT, 2.2);
            if (e > 3.2) { g.mode = 'leave'; g.alt = g.y + 5 + rnd() * 8; g.flap = true; g.cyc = 1; }
          }
        } else if (g.mode === 'leave') {
          /* away from the camera and out over the sea, climbing; gone once far off */
          beat(g, dt, 2, 2.5, 0.6, 0.06, 3);
          const ax = g.x - cam.x, az = g.z - cam.z, l = Math.hypot(ax, az) || 1;
          g.v += (8.5 - g.v) * Math.min(1, dt); fly(g, dt, Math.atan2(-(az / l - 0.7), ax / l), 0.8);
          g.y += (g.alt - g.y) * Math.min(1, dt * 0.4); g.pitch *= 0.95;
          if (l > 115) g.mode = 'off';
        }
      }
      return {
        n: 0,
        update(t, dt, cam, n, near, cut) {
          let top = 0, live = 0;
          for (const g of L) {
            const want = g.i < n;
            if (cut && !want) g.mode = 'off';
            if (g.mode === 'held') { const k = g.i * 4; A.iC[k + 2] = 0; top = Math.max(top, g.i + 1); continue; }
            if (g.mode === 'off' && want) { if (g.role === 'W') wheel(g, cam.x, near); else if (g.role === 'C') cruise(g, cam.x, near); else stand(g, cam.x, near); }
            else if (!want && (g.mode === 'wheel' || g.mode === 'cruise')) { g.mode = 'leave'; g.alt = g.y + 6; }
            else if (!want && g.mode === 'stand') lift(g, t, rnd() * 1.5, cam.x, cam.z);
            if (g.mode !== 'off') step(g, t, dt, cam);
            const k = g.i * 4, on = g.mode !== 'off'; if (on) { top = g.i + 1; live++; }
            A.iP[k] = g.x; A.iP[k + 1] = g.y + LEGH * g.legs; A.iP[k + 2] = g.z; A.iP[k + 3] = g.yaw;
            A.iQ[k] = g.pitch; A.iQ[k + 1] = g.roll; A.iQ[k + 2] = g.ph; A.iQ[k + 3] = g.amp;
            A.iC[k] = g.fold; A.iC[k + 1] = g.legs; A.iC[k + 2] = on ? 1 : 0;
          }
          this.n = live; H.draw(top);
        },
        shift(dx, dz) { for (const g of L) { g.x += dx; g.z += dz; g.cx += dx; g.cz += dz; g.lx += dx; g.lz += dz; } for (const q of grp) { q.x += dx; q.z += dz; } },
        /* for picking up (inspect.js): a standing one, or one going over low; let go, it flies off from where it was
           tossed, away over the sea */
        pickables(list) {
          for (const g of L) {
            if (g.mode === 'off' || g.mode === 'held') continue;
            list.push({ kind: 'gull', x: g.x, y: g.y + LEGH * g.legs + 0.16, z: g.z, r: 0.3, yaw: g.yaw, size: 1, reach: g.mode === 'stand' ? 40 : 60,
              take() { g.prev = g.mode; g.mode = 'held'; if (g.grp >= 0 && g.prev === 'stand') grp[g.grp].fresh = false; },
              give(how, p) {
                if (how === 'back') { g.mode = g.prev === 'stand' ? 'stand' : g.prev; if (g.mode === 'stand') { g.y = 0; g.legs = 1; g.fold = 1; } return; }
                Object.assign(g, { x: p.x, y: p.y, z: p.z, mode: 'leave', alt: p.y + 6 + rnd() * 6, v: 7, flap: true, cyc: 1, fold: 0, legs: 0, amp: 0.8, pitch: 0.2 });
                const cx = th.cx, cz = th.cz; g.yaw = Math.atan2(-((g.z - cz) - 0.7), g.x - cx);
              } });
          }
        },
        L
      };
    })();

    /* ── sandpipers: little flocks at the water's edge, running down the wet sand as a wave draws back and up ahead of the
       next, each at its own pace and a beat behind or ahead of the rest, pecking while they stand. When something comes
       near they go up one after another, beating hard and climbing, swing out over the water in a loose, ever-shifting
       flock that banks as one, glide in bursts, and come back in to land further along, flaring their wings and running
       a few steps as they touch down ── */
    const pipers = (() => {
      const SIZE = [7, 5, 6], NF = 3, PER = 7, PG = piperGeo(), LEGH = PG.userData.hipY, H = herd(PG, NF * PER, mat(BIRD_VS, BIRD_FS, PIPER_D), [['iP', 4], ['iQ', 4], ['iC', 4], ['iR', 4]]), A = H.A;
      const F = SIZE.map(n => ({ n, mode: 'off', x: 0, dir: 1, tx: 0, x0: 0, ax: 0, av: 0, t0: 0, out: 3, alt: 1.2, r0: 0.6, rL: 0.6, far: false }));
      const B = Array.from({ length: NF * PER }, () => ({ x: 0, r: 0.4, y: 0, yaw: 0, run: 0, runA: 0, m: 0.3, ox: 0, ph: rnd() * TAU, amp: 0, fold: 1, legs: 1, pitch: 0, roll: 0, pk: 0, seed: rnd(),
        lag: 0.1 + 0.5 * rnd(), vmax: 1.2 + 0.9 * rnd(), walk: 0.35 + 0.35 * rnd(), hold: 0, hz: 12 + 3 * rnd(), k: 4 + 2.5 * rnd(),
        dl: 0, fa: 0, fr: 0, fy: 0, ga: 0, gr: 0, vx: 0, vr: 0, vy: 0, up: false, wx: 0, wz: 0 }));
      function spawn(fi, cx, near) {
        for (let k = 0; k < 12; k++) {
          const x = near ? cx + (rnd() - 0.5) * 90 : cx + side() * (50 + rnd() * 40), sz = Layout.shoreZ(x);
          if (!sandAt(x, sz + 1.2) || Layout.vegZ(x) - sz < 3) continue;
          Object.assign(F[fi], { mode: 'feed', x, dir: rnd() < 0.5 ? 1 : -1 });
          for (let i = fi * PER; i < (fi + 1) * PER; i++) { const b = B[i]; b.ox = (rnd() - 0.5) * 5; b.x = x + b.ox; b.m = 0.15 + rnd() * 0.5; b.r = b.m; b.y = 0; b.yaw = rnd() * TAU; b.fold = 1; b.legs = 1; b.amp = 0; b.up = false; }
          return true;
        }
        return false;
      }
      /* up and away from fromX: the flock's line out over the water and back in to land, and each bird's own place in it */
      function away(f, fi, fromX, far, t, swash, wt) {
        const dir = Math.sign(f.x - fromX) || 1, S = far ? 140 : 30 + rnd() * 35;
        Object.assign(f, { mode: 'fly', dir, x0: f.x, ax: f.x, av: 0, tx: f.x + dir * S, t0: t, out: 2.5 + rnd() * 5, alt: 1.0 + rnd() * 0.9, far });
        let rs = 0, n = 0; for (let k = 0; k < f.n; k++) { rs += B[fi * PER + k].r; n++; } f.r0 = n ? rs / n : 0.6;
        f.rL = Math.max(0.3, swash(f.tx, wt) + 0.5);
        for (let k = 0; k < PER; k++) {
          const b = B[fi * PER + k];
          /* (the nearest go first; the rest follow within a third of a second or so) */
          b.dl = 0.05 + 0.32 * rnd() + 0.03 * Math.abs(b.x - fromX) / 10;
          b.fa = (rnd() - 0.5) * 2.6; b.fr = (rnd() - 0.5) * 1.7; b.fy = (rnd() - 0.5) * 0.45;
          b.ga = b.x - f.x0; b.gr = b.r - f.r0; b.vx = b.vr = b.vy = 0; b.up = false; b.hold = 0;
        }
      }
      return {
        n: 0,
        update(t, dt, wt, cam, nf, near, swash, cut) {
          let top = 0, live = 0;
          for (let fi = 0; fi < NF; fi++) {
            const f = F[fi], want = fi < nf;
            if (cut && !want) f.mode = 'off';
            if (f.mode === 'off' && want) spawn(fi, cam.x, near);
            else if (!want && f.mode === 'feed') away(f, fi, cam.x, true, t, swash, wt);
            let p = 0, ya = 0, ra = 0, landed = 0;
            if (f.mode === 'feed') {
              f.x += f.dir * 0.1 * dt; if (rnd() < dt * 0.03) f.dir = -f.dir;
              const w = threat(f.x, Layout.shoreZ(f.x) + 1, 9, 6); if (w) away(f, fi, w === 1 ? th.vx : th.cx, false, t, swash, wt);
              else if (f.alarm !== undefined) away(f, fi, f.alarm, false, t, swash, wt);
              f.alarm = undefined;
              if (f.mode === 'feed' && Math.abs(f.x - cam.x) > 110) f.mode = 'off';
            }
            if (f.mode === 'fly') {
              /* the flock's middle: quick to get going, slowing to land at the end */
              const rem = (f.tx - f.ax) * f.dir, tau = t - f.t0;
              const vT = Math.min(9.5 * Math.min(1, tau / 0.7 + 0.15), Math.sqrt(2 * 3.2 * Math.max(0, rem)));
              f.av += (vT - f.av) * Math.min(1, dt * 5); f.ax += f.dir * Math.min(f.av * dt, Math.max(0, rem));
              p = cl((f.ax - f.x0) / (f.tx - f.x0), 0, 1);
              ya = f.alt * Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.08)), 0.55);
              ra = f.r0 + (f.rL - f.r0) * p - f.out * Math.pow(Math.sin(Math.PI * p), 0.8);
              f.x = f.ax;
              if (Math.abs(f.x - cam.x) > 130) f.mode = 'off';
            }
            for (let k = 0; k < PER; k++) {
              const i = fi * PER + k, b = B[i], q = i * 4, on = f.mode !== 'off' && k < f.n && !b.held;
              if (on) {
                const g = Layout.shoreDZ(b.x), sq = Math.sqrt(1 + g * g);
                if (f.mode === 'feed') {
                  /* keep a little way up from the water's edge, wherever the swash has got to: each one reacts a moment
                     sooner or later than the next, runs at its own speed, and now and then stands its ground a while */
                  const want = swash(b.x, wt - b.lag) + b.m, need = want - b.r;
                  if (b.hold > 0) b.hold -= dt; else if (rnd() < dt * 0.35) b.hold = 0.3 + rnd() * 0.8;
                  const run = b.hold > 0 && need < 0.12 ? 0 : need;
                  const dx = cl(f.x + b.ox - b.x, -b.walk * dt, b.walk * dt), dr = cl(run, -b.vmax * dt, b.vmax * dt), v = Math.hypot(dx, dr) / Math.max(dt, 1e-4);
                  b.x += dx; b.r += dr;
                  b.runA += (Math.min(1, v / 1.2) - b.runA) * Math.min(1, dt * 10); b.run = (b.run + Math.min(v / 0.05, 7 * Math.PI * 2) * dt) % (Math.PI * 2);
                  if (v > 0.25) b.yaw += cl(turn(b.yaw, Math.atan2(-(dr * sq + g * dx), dx)), -12 * dt, 12 * dt);
                  b.pk += v < 0.15 ? dt : 0; b.pitch = v < 0.15 ? -0.55 * Math.pow(Math.max(0, Math.sin(b.pk * (4.2 + 1.6 * b.seed) + b.seed * 9)), 3) : 0;
                  b.y = Math.max(0, b.y - dt * 2); b.fold = Math.min(1, b.fold + dt * 4); b.legs = Math.min(1, b.legs + dt * 4); b.amp = Math.max(0, b.amp - dt * 4); b.roll *= 0.9;
                } else {
                  const tau = t - f.t0 - b.dl;
                  if (tau < 0) {
                    /* alarmed, not yet gone: stands up straight, stops feeding */
                    b.pitch += (0.12 - b.pitch) * Math.min(1, dt * 10); b.runA *= 0.9;
                  } else {
                    if (!b.up) { b.up = true; b.vy = 1.8 + 0.6 * rnd(); }      /* (a little spring off the sand) */
                    /* where it wants to be: its own place in the flock, wandering, from where it stood at the start */
                    const mixK = Math.min(1, tau / 1.1), wob = t * (0.9 + 0.4 * b.seed) + b.seed * 20;
                    const ta = f.ax + f.dir * (b.ga + (b.fa * (1 + 0.25 * Math.sin(wob)) - b.ga) * mixK);
                    const tr = ra + b.gr + (b.fr * (1 + 0.3 * Math.sin(wob * 1.3 + 1)) - b.gr) * mixK;
                    const ty = Math.max(0, ya + b.fy * (ya / f.alt) * (1 + 0.4 * Math.sin(wob * 0.8)));
                    const kk = b.k, k2 = kk * kk;
                    b.vx += (k2 * (ta - b.x) - 2 * kk * b.vx) * dt; b.vr += (k2 * (tr - b.r) - 2 * kk * b.vr) * dt; b.vy += (k2 * (ty - b.y) - 2 * kk * b.vy) * dt - (b.y > 0.02 ? 0 : 0);
                    b.x += b.vx * dt; b.r += b.vr * dt; b.y = Math.max(0, b.y + b.vy * dt);
                    const sp = Math.hypot(b.vx, b.vr * sq), low = b.y < 0.25 && p > 0.7;
                    /* the wings: hard beats going up, bursts of gliding as it comes down, a flare to land */
                    const glide = p > 0.4 && p < 0.86 && Math.sin(t * (1.7 + 0.6 * b.seed) + b.seed * 11) > 0.35;
                    const ampT = low ? (b.y > 0.03 ? 0.7 : 0) : glide ? 0.1 : 1;
                    b.amp += (ampT - b.amp) * Math.min(1, dt * 7); b.ph += TAU * b.hz * dt * (0.35 + 0.65 * Math.min(1, b.amp * 1.4));
                    b.fold += ((b.y < 0.02 && p > 0.9 ? 1 : 0) - b.fold) * Math.min(1, dt * (b.fold > 0.5 ? 4 : 9));
                    b.legs += ((b.y < 0.3 && p > 0.6 ? 1 : 0) - b.legs) * Math.min(1, dt * 6);
                    /* heading along its way through the air, banked into the turns, nose up climbing and in the flare */
                    if (sp > 0.4) { const yT = Math.atan2(-(b.vr * sq + g * b.vx), b.vx), d = turn(b.yaw, yT), mv = cl(d, -9 * dt, 9 * dt); b.yaw += mv;
                      b.roll += (cl(-(dt > 0 ? mv / dt : 0) * sp / 9.8, -0.85, 0.85) - b.roll) * Math.min(1, dt * 5); }
                    b.pitch += (cl(Math.atan2(b.vy, Math.max(sp, 1)) * 0.8 + (low ? 0.45 : 0), -0.4, 0.7) - b.pitch) * Math.min(1, dt * 6);
                    b.runA = b.y < 0.02 && p > 0.9 ? Math.min(1, sp / 1.2) : 0; b.run = (b.run + Math.min(sp / 0.05, 7 * Math.PI * 2) * dt) % (Math.PI * 2);
                    if (p >= 1 && b.y < 0.01 && sp < 0.3) landed++;
                  }
                }
                const wz = Layout.shoreZ(b.x) + b.r * sq;
                A.iP[q] = b.x; A.iP[q + 1] = b.y + LEGH * b.legs; A.iP[q + 2] = wz; A.iP[q + 3] = b.yaw;
                A.iQ[q] = b.pitch; A.iQ[q + 1] = b.roll; A.iQ[q + 2] = b.ph; A.iQ[q + 3] = b.amp;
                A.iC[q] = b.fold; A.iC[q + 1] = b.legs; A.iR[q] = b.run; A.iR[q + 1] = b.runA;
                top = i + 1; live++;
              }
              A.iC[q + 2] = on ? 1 : 0;
            }
            /* all down: feeding again where they came in, each keeping the place it landed in */
            if (f.mode === 'fly' && landed >= f.n) {
              if (f.far || !want) f.mode = 'off';
              else { f.mode = 'feed'; f.x = f.tx; for (let k = 0; k < PER; k++) { const b = B[fi * PER + k]; b.ox = cl(b.x - f.x, -3, 3); b.m = cl(b.r - swash(b.x, wt), 0.15, 0.7); b.up = false; } }
            }
          }
          this.n = live; H.draw(top);
        },
        shift(dx) { for (const f of F) { f.x += dx; f.tx += dx; f.x0 += dx; f.ax += dx; } for (const b of B) b.x += dx; },
        /* for picking up (inspect.js): one of a flock out feeding; tossed back, it and the rest of them are off along the
           beach */
        pickables(list) {
          F.forEach((f, fi) => {
            if (f.mode === 'off') return;
            for (let k = 0; k < f.n; k++) {
              const b = B[fi * PER + k]; if (b.held) continue;
              const g = Layout.shoreDZ(b.x), x = b.x, z = Layout.shoreZ(b.x) + b.r * Math.sqrt(1 + g * g);
              list.push({ kind: 'sandpiper', x, y: b.y + 0.06, z, r: 0.12, yaw: b.yaw, size: 1, reach: 35,
                take() { b.held = true; }, give(how) { b.held = false; if (how !== 'back' && f.mode === 'feed') f.alarm = th.cx; } });
            }
          });
        },
        F, B
      };
    })();

    /* ── ghost crabs: out on the sand at night. Each has a burrow; it scuttles sideways, freezes, scuttles again, keeps out of
       the swash, and darts home and down when the van or a walker comes near (or the night ends) ── */
    const crabs = (() => {
      const MAX = 48, H = herd(crabGeo(), MAX, mat(CRAB_VS, GEN_FS, { GLOSS: 0 }), [['iP', 4], ['iQ', 4]]), A = H.A;
      const Ho = herd(new T.PlaneGeometry(1, 1), MAX, new T.ShaderMaterial({ uniforms: { uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uKeyDirT: Mats.U.uKeyDirT }, vertexShader: HOLE_VS, fragmentShader: HOLE_FS, transparent: true, depthWrite: false, side: T.DoubleSide }), [['iP', 4]]);
      const C = Array.from({ length: MAX }, () => ({ st: 'off', bx: 0, bz: 0, x: 0, z: 0, face: 0, mx: 0, mz: 0, sp: 0, tm: 0, sink: 1, gait: 0, gaitA: 0, size: 0.9 + rnd() * 0.5 }));
      function dig(c, cx, near) {
        for (let k = 0; k < 14; k++) {
          const x = near ? cx + (rnd() - 0.5) * 60 : cx + side() * (32 + rnd() * 10), sz = Layout.shoreZ(x), vz = Layout.vegZ(x);
          if (vz - sz < 3) continue;
          const z = sz + 1.4 + rnd() * (vz - sz - 2.2);
          if (!sandAt(x, z) || Math.hypot(x - Layout.camp.x, z - Layout.camp.z) < 4.6 || Math.hypot(x - Layout.fire.x, z - Layout.fire.z) < 1.8 || Math.hypot(x - th.vx, z - th.vz) < 3.4) continue;
          Object.assign(c, { bx: x, bz: z, x, z, st: 'hidden', sink: 1, tm: rnd() * 4, face: rnd() * TAU });
          return true;
        }
        return false;
      }
      /* ghost crabs run sideways: the body is turned square to the way it goes (whichever way round is nearer) */
      const square = c => { const m = Math.atan2(-c.mz, c.mx), a = m + Math.PI / 2, b = m - Math.PI / 2; c.face = Math.abs(turn(c.face, a)) < Math.abs(turn(c.face, b)) ? a : b; };
      const home = (c, sp) => { c.st = 'home'; c.sp = sp; };
      function wander(c) {
        if (rnd() < 0.08) { home(c, 1.6); return; }
        /* forage toward the water, never far from home */
        const hx = c.bx - c.x, hz = c.bz - c.z, hd = Math.hypot(hx, hz), a = rnd() * TAU;
        let dx = Math.cos(a), dz = Math.sin(a) - 0.35;
        if (hd > 4) { dx += hx / hd * 1.5; dz += hz / hd * 1.5; }
        const l = Math.hypot(dx, dz) || 1; c.mx = dx / l; c.mz = dz / l; c.sp = 0.35 + rnd() * 0.6; c.tm = 0.5 + rnd() * 1.4; c.st = 'run'; square(c);
      }
      return {
        n: 0,
        update(t, dt, wt, cam, n, out, swash, cut) {
          let top = 0, live = 0;
          for (let i = 0; i < MAX; i++) {
            const c = C[i], want = i < n;
            /* (one picked up and held, or in the air: not drawn here, its burrow kept for it) */
            if (c.st === 'held') { const q = i * 4; A.iQ[q + 3] = 0; Ho.A.iP[q + 3] = 1; top = i + 1; continue; }
            if (cut && !want) c.st = 'off';
            if (c.st === 'off' && want) dig(c, cam.x, true);
            /* left far behind: down its burrow, and a new burrow dug ahead */
            if (c.st !== 'off' && Math.abs(c.bx - cam.x) > 42) { c.st = 'off'; if (want) dig(c, cam.x, false); }
            if (c.st !== 'off') {
              if ((c.st === 'still' || c.st === 'run') && (!want || rnd() < dt * 0.3 * (1 - out))) home(c, 0.9);
              if ((c.st === 'still' || c.st === 'run' || c.st === 'up') && threat(c.x, c.z, 7, 4.5)) home(c, 1.4);
              if (c.st === 'hidden') { c.sink = 1; if ((c.tm -= dt) <= 0) { if (want && rnd() < out && !threat(c.bx, c.bz, 9, 6)) c.st = 'up'; else c.tm = 2 + rnd() * 6; } }
              else if (c.st === 'up') { c.sink -= dt / 0.4; if (c.sink <= 0) { c.sink = 0; c.st = 'still'; c.tm = 0.4 + rnd() * 2; } }
              else if (c.st === 'still') { if ((c.tm -= dt) <= 0) wander(c); }
              else if (c.st === 'run') {
                const nx = c.x + c.mx * c.sp * dt, nz = c.z + c.mz * c.sp * dt;
                if (!sandAt(nx, nz) || nz > Layout.vegZ(nx) - 0.3) { c.st = 'still'; c.tm = 0.3; } else { c.x = nx; c.z = nz; }
                if ((c.tm -= dt) <= 0) { c.st = 'still'; c.tm = 0.5 + rnd() * 2.5; }
              } else if (c.st === 'home') {
                const hx = c.bx - c.x, hz = c.bz - c.z, d = Math.hypot(hx, hz);
                if (d < 0.08) { c.x = c.bx; c.z = c.bz; c.st = 'duck'; }
                else { c.mx = hx / d; c.mz = hz / d; square(c); const s = Math.min(d, c.sp * dt); c.x += c.mx * s; c.z += c.mz * s; }
              } else if (c.st === 'duck') { c.sink += dt / 0.25; if (c.sink >= 1) { c.sink = 1; c.st = 'hidden'; c.tm = 4 + rnd() * 8; } }
              /* the swash coming up the sand: run up ahead of it */
              if ((c.st === 'still' || c.st === 'run') && c.z - Layout.shoreZ(c.x) < swash(c.x, wt) + 0.3) { c.mx = 0; c.mz = 1; c.sp = 1.2; c.st = 'run'; c.tm = 0.7; square(c); }
              const moving = c.st === 'run' || c.st === 'home';
              /* (its legs step about once each 14 cm it goes, and never faster than six times a second: quicker than that a
                 frame can't follow them, and they only shiver) */
              c.gaitA += ((moving ? 1 : 0) - c.gaitA) * Math.min(1, dt * 10); c.gait = (c.gait + (moving ? Math.min(c.sp * 45, 6 * Math.PI * 2) : 0) * dt) % (Math.PI * 2);
              c.fs = c.fs === undefined ? c.face : c.fs + turn(c.fs, c.face) * Math.min(1, dt * 14);
            }
            const q = i * 4, on = c.st !== 'off' && c.sink < 1;
            A.iP[q] = c.x; A.iP[q + 1] = 0.0025 * c.gaitA * Math.abs(Math.sin(c.gait * 2)) * c.size; A.iP[q + 2] = c.z; A.iP[q + 3] = c.fs === undefined ? c.face : c.fs;
            A.iQ[q] = c.gait; A.iQ[q + 1] = c.gaitA; A.iQ[q + 2] = c.sink; A.iQ[q + 3] = on ? c.size : 0;
            Ho.A.iP[q] = c.bx; Ho.A.iP[q + 1] = c.bz; Ho.A.iP[q + 2] = 0.15 * c.size; Ho.A.iP[q + 3] = c.st !== 'off' && want ? 1 : 0;
            if (c.st !== 'off') top = i + 1;
            if (on) live++;
          }
          this.n = live; H.draw(live ? top : 0); Ho.draw(top);
        },
        shift(dx, dz) { for (const c of C) { c.bx += dx; c.bz += dz; c.x += dx; c.z += dz; } },
        /* the ones out on the sand, for picking up (inspect.js): hidden while held; thrown in the sea, one comes out of
           the shallows where it landed and runs for home */
        pickables(list) {
          for (const c of C) {
            if (c.st === 'off' || c.st === 'held' || c.st === 'hidden' || c.sink > 0.5) continue;
            list.push({ kind: 'crab', x: c.x, y: 0.03, z: c.z, r: 0.06 * c.size, yaw: c.face, size: c.size * 1.2,
              take() { c.prev = c.st; c.st = 'held'; },
              give(how, p) {
                if (how === 'back') { c.st = 'still'; c.tm = 0.6 + rnd() * 1.5; c.sink = 0; return; }
                c.x = p.x; c.z = Layout.shoreZ(p.x) + 0.4; c.sink = 0; c.mx = 0; c.mz = 1; square(c); home(c, 2.8);
              } });
          }
        },
        C
      };
    })();

    /* ── spray where dolphins break the surface ── */
    const spray = (() => {
      const NE = 8, PE = 22, u = { uTime: Mats.U.uTime, uScale: { value: 1000 }, uSpl: { value: Array.from({ length: NE }, () => new T.Vector4(0, 0, -1e4, 0)) }, uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT };
      const C = cloud(NE * PE, [['aS', 4]], new T.ShaderMaterial({ uniforms: u, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false })), a = C.A.aS.array;
      for (let e = 0; e < NE; e++) for (let i = 0; i < PE; i++) { const k = (e * PE + i) * 4; a[k] = e; a[k + 1] = rnd(); a[k + 2] = rnd(); a[k + 3] = rnd(); }
      let next = 0, last = -1e4;
      return {
        add(x, z, t, s) { u.uSpl.value[next].set(x, z, t, s); next = (next + 1) % NE; last = t; },
        update(t, scale) { u.uScale.value = scale; C.p.visible = (t - last < 3 && t >= last) || warm > 0; },
        shift(dx, dz) { for (const v of u.uSpl.value) { v.x += dx; v.y += dz; } }
      };
    })();

    /* ── dolphins: now and then by day or dusk, a small pod passes along the coast offshore, each one rolling up through the
       surface in an arc every few seconds (and sometimes leaping clear), with a splash as it breaks the water and goes back in ── */
    const dolphins = (() => {
      const MAX = 5, H = herd(dolphinGeo(), MAX, mat(DOLPHIN_VS, SEA_FS, { GLOSS: 0.5, FLEX: 0.13 }, { uSeed: { value: 0 } }), [['iP', 4], ['iQ', 4]]), A = H.A;
      const D = Array.from({ length: MAX }, () => ({ lat: 0, lag: 0, per: 4, ph: 0, size: 1, beat: 0, up: -1, down: -1 }));
      const pod = { on: false, n: 0, x: 0, x0: 0, dir: 1, off: 30, v: 4, t0: 0, next: 50 + rnd() * 70 };
      function start(t, cx, x) {
        const dir = rnd() < 0.5 ? 1 : -1;
        Object.assign(pod, { on: true, n: 3 + Math.floor(rnd() * 3), dir, x: x !== undefined ? x : cx - dir * (85 + rnd() * 35), off: 22 + rnd() * 38, v: 3.6 + rnd() * 1.6, t0: t });
        pod.x0 = pod.x;
        D.forEach((d, i) => Object.assign(d, { lat: (rnd() - 0.5) * 7, lag: i * 2.2 + rnd() * 2, per: 3.2 + rnd() * 2.2, ph: rnd() * 4, size: 0.85 + rnd() * 0.3, up: -1, down: -1 }));
      }
      return {
        pod, start, H,
        /* for holding up close (inspect.js): one of the pod while it is up out of the water; let go, back it goes */
        pickables(list) {
          if (!pod.on) return;
          for (let i = 0; i < pod.n; i++) { const d = D[i], q = i * 4; if (d.held || A.iQ[q + 3] <= 0) continue;
            list.push({ kind: 'dolphin', x: A.iP[q], y: A.iP[q + 1], z: A.iP[q + 2], r: 1.1 * d.size, yaw: A.iP[q + 3], size: d.size, reach: 160,
              take() { d.held = true; }, give() { d.held = false; } }); }
        },
        get n() { return pod.on ? pod.n : 0; },
        update(t, dt, cam, k, dens, calm, splash) {
          if (!pod.on && !calm && k > 0.3 && dens > 0.02 && t > pod.next) start(t, cam.x);
          if (dens <= 0.02) pod.on = false;
          let top = 0;
          if (pod.on) {
            pod.x += pod.dir * pod.v * dt;
            for (let i = 0; i < MAX; i++) {
              const d = D[i], q = i * 4; A.iQ[q + 3] = 0;
              if (i >= pod.n || d.held) { if (d.held) top = Math.max(top, i + 1); continue; }
              const x = pod.x - pod.dir * d.lag, g = Layout.shoreDZ(x), z = Layout.shoreZ(x) - pod.off + d.lat + 2 * Math.sin(t * 0.07 + i);
              const tt = t - pod.t0 + d.ph, cyc = Math.floor(tt / d.per), leap = hash2(cyc, i * 7.7 + 3.1) < 0.14;
              const dur = leap ? 1.5 : 1.15 + 0.2 * hash2(cyc, i), hh = (leap ? 1.7 : 0.55 + 0.25 * hash2(i, cyc)) + 0.45, u = (tt - cyc * d.per) / dur;
              d.beat += dt * TAU * 1.5;
              if (u >= 1) continue;
              A.iP[q] = x; A.iP[q + 1] = -0.45 + hh * Math.sin(Math.PI * u); A.iP[q + 2] = z; A.iP[q + 3] = Math.atan2(-g * pod.dir, pod.dir);
              A.iQ[q] = Math.atan2(hh * Math.PI * Math.cos(Math.PI * u) / dur, pod.v) * 0.8; A.iQ[q + 1] = 0; A.iQ[q + 2] = d.beat; A.iQ[q + 3] = d.size;
              top = i + 1;
              /* spray as it breaks the surface; spray and a ring on the water as it goes back in (only then: the rings are
                 shared with the visitor's own clicks on the sea, and there are only a few) */
              if (u > 0.06 && d.up !== cyc) { d.up = cyc; splash(x, z, 0, 0.6); }
              if (u > 0.9 && d.down !== cyc) { d.down = cyc; splash(x + pod.dir * 0.8, z, leap ? 0.9 : 0.4, leap ? 1.4 : 0.8); }
            }
            if ((pod.x - pod.x0) * pod.dir > 260 || Math.abs(pod.x - cam.x) > 200) { pod.on = false; pod.next = t + (90 + rnd() * 150) / (0.4 + 1.6 * dens); }
          }
          H.draw(top);
        },
        shift(dx) { pod.x += dx; pod.x0 += dx; }
      };
    })();

    /* ── mist: whales' blows and the spray of a breach, puffs a few metres across that read from far off ── */
    const mist = (() => {
      const NE = 6, PE = 56, u = { uTime: Mats.U.uTime, uScale: { value: 1000 }, uMist: { value: Array.from({ length: NE }, () => new T.Vector4(0, -50, 0, -1e4)) }, uMistK: { value: Array.from({ length: NE }, () => new T.Vector4()) },
        uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uKeyDirT: Mats.U.uKeyDirT, uFog: Mats.U.uFog };
      const C = cloud(NE * PE, [['aS', 4]], new T.ShaderMaterial({ uniforms: u, vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false })), a = C.A.aS.array;
      for (let e = 0; e < NE; e++) for (let i = 0; i < PE; i++) { const k = (e * PE + i) * 4; a[k] = e; a[k + 1] = rnd(); a[k + 2] = rnd(); a[k + 3] = rnd(); }
      let next = 0, last = -1e4;
      return {
        /* kind 0 a blow, 1 a splash; s its size in metres */
        add(x, y, z, t, kind, s) { u.uMist.value[next].set(x, y, z, t); u.uMistK.value[next].set(kind, s, Layout.wind[0] * 1.6, Layout.wind[1] * 1.6); next = (next + 1) % NE; last = t; },
        update(t, scale) { u.uScale.value = scale; C.p.visible = (t - last < 6 && t >= last) || warm > 0; },
        shift(dx, dz) { for (const v of u.uMist.value) { v.x += dx; v.z += dz; } }
      };
    })();

    /* ── a whale: now and then by day, one passes along the coast a few hundred metres out. It comes up to breathe a few
       times, a bushy blow first and then its long back rolling through the surface with the hump of its fin, then
       arches, lifts its flukes clear of the water and slides down deep for a while; now and then it bursts right out
       of the sea instead, turns in the air and crashes back on its side ── */
    const whales = (() => {
      const H = herd(whaleGeo(), 1, mat(DOLPHIN_VS, SEA_FS, { GLOSS: 0.65, FLEX: 0.045, WHALE: 1 }, { uSeed: { value: rnd() * 50 } }), [['iP', 4], ['iQ', 4]]), A = H.A;
      const w = { on: false, x: 0, off: 200, dir: 1, v: 1.6, size: 13, st: 'under', t0: 0, dur: 0, left: 0, first: true, beat: 0, next: 35 + rnd() * 60, blown: false, hit: false, top: false, pitch: 0, roll: 0, y: -6 };
      const B = { breath: 7.5, dive: 7, breach: 5.5 };
      function start(t, cx, x) {
        const dir = rnd() < 0.5 ? 1 : -1;
        Object.assign(w, { on: true, dir, x: x !== undefined ? x : cx - dir * (60 + rnd() * 140), off: 95 + rnd() * 200, v: 1.3 + rnd() * 1.1, size: 11.5 + rnd() * 3.5, st: 'under', t0: t, dur: 1 + rnd() * 3, left: 3 + Math.floor(rnd() * 3), first: true, y: -6 });
      }
      function go(st, t, dur) { w.st = st; w.t0 = t; w.dur = dur; w.blown = w.hit = w.top = false; }
      return {
        w, start,
        get n() { return w.on && w.y > -5 ? 1 : 0; },
        /* for holding up close (inspect.js), while it is up at the surface; let go, it goes back where it was */
        pickables(list) {
          if (!w.on || w.held || A.iQ[3] <= 0) return;
          list.push({ kind: 'whale', x: A.iP[0], y: A.iP[1] + 0.12 * w.size, z: A.iP[2], r: 0.4 * w.size, yaw: A.iP[3], size: w.size / 13, reach: 450,
            take() { w.held = true; }, give() { w.held = false; } });
        },
        update(t, dt, cam, k, dens, calm) {
          if (w.held) { H.draw(0); return; }
          if (!w.on && !calm && k > 0.3 && dens > 0.02 && t > w.next) start(t, cam.x);
          if (dens <= 0.02) w.on = false;
          if (!w.on) { H.draw(0); return; }
          w.x += w.dir * w.v * dt; w.beat += dt * TAU * 0.22;
          const g = Layout.shoreDZ(w.x), z = Layout.shoreZ(w.x) - w.off, S = w.size, u = Math.min(1, (t - w.t0) / w.dur);
          let y = -6, pitch = 0, roll = 0;
          if (w.st === 'under') {
            /* (its first time up on a visit, now and then, it breaches) */
            if (u >= 1) { if (w.left > 0) { if (w.first && rnd() < 0.3) go('breach', t, B.breach); else go('breath', t, B.breath); w.first = false; } else go('dive', t, B.dive); }
          } else if (w.st === 'breath') {
            /* the head first (and the blow), then the back and the fin rolling over, and down */
            const e = Math.sin(Math.PI * Math.min(1, u * 1.15));
            y = -0.118 * S * 1.9 + 0.118 * S * 1.75 * Math.pow(Math.max(0, e), 0.6); pitch = 0.07 - 0.2 * u;
            if (!w.blown && u > 0.1) { w.blown = true; mist.add(w.x + w.dir * 0.3 * S, 0.5, z, t, 0, 3.6 + S * 0.12); }
            if (u >= 1) { w.left--; go('under', t, 9 + rnd() * 7); }
          } else if (w.st === 'dive') {
            /* it arches, the flukes come up out of the water, and it slides under, tail last */
            y = -0.118 * S * 0.55 - S * 0.75 * sm(0.42, 1, u); pitch = -1.12 * sm(0.04, 0.5, u);
            if (!w.top && u > 0.5) { w.top = true; mist.add(w.x - w.dir * 0.3 * S, 3, z, t, 1, 2.5); }
            if (!w.hit && u > 0.86) { w.hit = true; mist.add(w.x - w.dir * 0.15 * S, 0.2, z, t, 1, 3); }
            if (u >= 1) { w.st = 'deep'; w.t0 = t; w.dur = 60 + rnd() * 80; }
          } else if (w.st === 'breach') {
            /* up out of the sea at a steep slant, a turn in the air, and back down on its side in a burst of spray */
            y = -0.45 * S + 0.56 * S * Math.sin(Math.PI * Math.min(1, u * 1.08)) - 0.25 * S * sm(0.7, 1, u); pitch = 1.15 - 1.3 * sm(0.25, 0.8, u); roll = -1.4 * sm(0.3, 0.75, u) * w.dir;
            if (!w.blown && u > 0.12) { w.blown = true; mist.add(w.x + w.dir * 0.15 * S, 0.3, z, t, 1, 4.5); }
            if (!w.hit && u > 0.72) { w.hit = true; mist.add(w.x + w.dir * 0.05 * S, 0.3, z, t, 1, 10); }
            if (u >= 1) { w.left--; go('under', t, 8 + rnd() * 5); }
          } else if (w.st === 'deep') {
            /* back up again further along if it is still about, or gone */
            if (u >= 1) { if (Math.abs(w.x - cam.x) < 260 && rnd() < 0.6) { w.left = 2 + Math.floor(rnd() * 3); w.first = true; go('under', t, 1); } else { w.on = false; w.next = t + (120 + rnd() * 200) / (0.4 + 1.6 * dens); } }
          }
          if (Math.abs(w.x - cam.x) > 700) { w.on = false; w.next = t + (60 + rnd() * 120) / (0.4 + 1.6 * dens); }
          w.y = y; w.pitch = pitch; w.roll = roll;
          const away = w.st === 'dive' ? w.dir * 1.15 * sm(0.0, 0.45, u) : 0;    /* (diving, it turns out to sea, so its flukes show their face) */
          A.iP[0] = w.x; A.iP[1] = y; A.iP[2] = z; A.iP[3] = Math.atan2(-g * w.dir, w.dir) + away;
          A.iQ[0] = pitch; A.iQ[1] = roll; A.iQ[2] = w.beat; A.iQ[3] = y > -0.118 * S * 1.5 - 0.2 || w.st === 'dive' || w.st === 'breach' ? S : 0;
          H.draw(A.iQ[3] > 0 ? 1 : 0);
        },
        shift(dx) { w.x += dx; }
      };
    })();

    /* ── every frame ── */
    const out = [];         /* splashes this frame, for the water's ripples */
    let near = true, cut = false, lastDI = -1, lastDA = -1, nowT = 0, nowCam = null;
    const noSwash = () => 0;
    const splash = (x, z, k, s) => { if (k > 0 && Math.hypot(x - nowCam.x, z - nowCam.z) < 160) out.push({ x, z, k }); spray.add(x, z, nowT, s); };
    function update(o) {
      const t = o.t, dt = o.dt || 0, cam = o.cam, d = o.dens || {}, dI = d.insects ?? 0.5, dA = d.animals ?? 0.5, sAlt = o.sAlt, rain = o.rain || 0, wt = o.waveT ?? t;
      const swash = o.swash || noSwash, still = 1 - sm(1.4, 2.4, o.wind ?? 1), scale = o.pxScale || 1000;
      nowT = t; nowCam = cam;
      /* the camera's way along the coast, the van, and whether the camera is down at walking height */
      if (lastCx !== null && dt > 0) camV += ((cam.x - lastCx) / dt - camV) * Math.min(1, dt * 2);
      lastCx = cam.x; camDir = Math.abs(camV) > 1.5 ? Math.sign(camV) : 0;
      if (o.van) { if (th.seen && dt > 0) th.vs += (Math.hypot(o.van.x - th.vx, o.van.z - th.vz) / dt - th.vs) * Math.min(1, dt * 4); th.vx = o.van.x; th.vz = o.van.z; th.seen = true; }
      th.cx = cam.x; th.cz = cam.z; th.low = cam.y - Math.max(0, land(cam.x, cam.z)) < 3.2;
      /* a change of density takes effect where it can be seen: new ones come in nearby, fewer go at once
         (when it is the time of day that changes how many, they arrive out of sight and fly off instead) */
      if (dI !== lastDI || dA !== lastDA) { if (lastDI >= 0) { near = true; cut = dA < lastDA; } lastDI = dI; lastDA = dA; }
      out.length = 0;

      /* insects: fireflies after dark (fewer in rain and wind), midges at dusk (most of an evening), dragonflies and butterflies by day */
      flies.update(cam.x, (1 - sm(-8, 1, sAlt)) * (1 - 0.5 * rain), dI * (1 - 0.75 * rain) * (0.4 + 0.6 * still), scale);
      gnats.update(cam.x, sm(-10, -3, sAlt) * (1 - sm(3, 10, sAlt)) * (o.evening === false ? 0.35 : 1) * (1 - rain) * still, dI, scale);
      const dayK = sm(1, 8, sAlt) * (1 - rain) * still;
      dragon.update(cam.x, 16 * dI * dayK); butter.update(cam.x, 30 * dI * dayK);
      /* animals: bats from sundown to dawn, gulls and sandpipers from dawn to dusk, crabs out at night, dolphins by day or dusk */
      bats.update(cam.x, 24 * dA * (1 - sm(-3, 4, sAlt)) * (1 - 0.7 * rain));
      gulls.update(t, dt, cam, Math.round(22 * dA * sm(-3, 5, sAlt)), near, cut);
      pipers.update(t, dt, wt, cam, Math.round(3 * dA * sm(-4, 3, sAlt) * (1 - 0.6 * rain)), near, swash, cut);
      crabs.update(t, dt, wt, cam, Math.round(48 * dA), (o.night ?? (1 - sm(-6, 8, sAlt))) * (1 - 0.6 * rain), swash, cut);
      dolphins.update(t, dt, cam, sm(-6, 4, sAlt), dA, o.calm, splash);
      whales.update(t, dt, cam, sm(-4, 6, sAlt), dA, o.calm);
      spray.update(t, scale); mist.update(t, scale);
      near = cut = false; if (warm > 0) warm--;
      return out;
    }
    /* the whole scene moved (the camp put somewhere else): carry every creature with it */
    function shift(dx, dz) {
      for (const s of [flies, gnats, bats, dragon, butter, gulls, crabs, spray, mist]) s.shift(dx, dz);
      pipers.shift(dx); dolphins.shift(dx); whales.shift(dx);
      if (lastCx !== null) lastCx += dx; th.vx += dx; th.vz += dz;
    }
    return {
      update, shift, group: G,
      /* a pod of dolphins now, off x (or coming along toward the camera) */
      pod(x) { dolphins.start(Mats.U.uTime.value, lastCx ?? 0, x); },
      /* a whale now, off x (or coming along toward the camera) */
      whale(x) { whales.start(Mats.U.uTime.value, lastCx ?? 0, x); },
      get counts() { return { fireflies: flies.n, gnats: gnats.n, dragonflies: dragon.n, butterflies: butter.n, bats: bats.n, gulls: gulls.n, sandpipers: pipers.n, crabs: crabs.n, dolphins: dolphins.n, whales: whales.n }; },
      debug: { gulls, pipers, crabs, dolphins, whales, mist, flies, gnats, bats, dragon, butter },
      /* what can be picked up and held (inspect.js) */
      pickables(list, cam) { crabs.pickables(list); gulls.pickables(list); pipers.pickables(list); bflyPickables(list); dflyPickables(list); batPickables(list); dolphins.pickables(list); whales.pickables(list); if (cam) flies.pickables(list, cam); },
      /* a splash thrown up off the water at (x, z), s metres across (inspect.js: something thrown in) */
      splash(x, z, s) { spray.add(x, z, nowT, s); }
    };
  }
  return { build };
})();
