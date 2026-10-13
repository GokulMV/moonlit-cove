/* ─────────────────────────────────────────────────────────────
   shallows.js — more of the shore's small lives: kelp round the
   rocks that stand out in the water, its fronds rising from the
   bottom and their tops lying out along the surface, swaying in the
   swell; and hermit crabs in borrowed shells along the tide line,
   wandering, stopping, pulling into their shells when you come near.
   The kelp is laid round each chunk's rocks in the water as the
   chunk comes near (world.js decorate 'tiny'); the crabs follow the
   camera. Hermit crabs can be picked up (inspect.js).
   ───────────────────────────────────────────────────────────── */
const Shallows = (() => {
  const T = THREE, TAU = Math.PI * 2;
  /* a frond: a ribbon from the holdfast on the bottom up toward the light; whatever of it is longer than the water is
     deep lies out along the surface downstream, riding the waves. Seen through the water as the school fish are (drawn
     at the surface's own depth along the line of sight, tinted by the water over it, gone at a glancing angle) */
  /* (what is seen through the water is drawn at the surface's own depth along the line of sight, so the water never
     covers it; and a few centimetres nearer than that, as the sea's mesh only follows the waves between its own
     points, a centimetre or two off them in places) */
  const ONTOP = `
vec3 onTop(vec3 w, float hs){
  vec3 ray = w - cameraPosition; float k = ray.y < -1e-4 ? clamp((hs + 0.012 - cameraPosition.y)/ray.y, 0.0, 1.0) : 1.0;
  vec3 p = cameraPosition + ray*k, v = p - cameraPosition; float d = length(v);
  return p - v/max(d, 1e-3)*min(d*0.5, 0.06 + 0.0015*d);
}`;
  const KELP_VS = `
${GLSL.WAVEH}
${ONTOP}
uniform float uTime;
attribute vec4 iK;   /* holdfast x, z, depth of the water there, phase */
attribute vec4 iL;   /* length, which way it streams, size, shade */
attribute float aH, aS;   /* along the stipe (0 the holdfast, 1 the tip), and across (−1..1) */
attribute vec3 aB;   /* a blade's: along it (0 its bladder, 1 its tip), the side of the stipe it grows from (0: the stipe itself), its number */
varying float vDepth, vH, vA, vShade, vT, vBulb, vX; varying vec3 vW, vN;
float hsh(float n){ return fract(sin(n*12.9898 + 4.1)*43758.5453); }
void main(){
  float L = iL.x, d = iK.z, s = aH*L, ph = iK.w;
  float up = min(s, d - 0.04), lie = max(0.0, s - (d - 0.04));
  float sway = 0.45*sin(uTime*0.8 + ph) + 0.2*sin(uTime*1.9 + ph*2.3), k = up/max(d, 0.1);
  vec2 dir = vec2(cos(iL.y), sin(iL.y)), side = vec2(-dir.y, dir.x);
  vec3 D = vec3(dir.x, 0.0, dir.y), S = vec3(side.x, 0.0, side.y), Y = vec3(0.0, 1.0, 0.0);
  /* the stipe: up from the holdfast, leaning with the water, then out along the surface */
  vec3 w = vec3(iK.x, -d + up, iK.y) + D*(lie + up*0.3 + sway*k*k*0.9) + S*sway*k*0.3;
  bool lying = lie > 0.0;
  vec3 n = lying ? Y : normalize(S + 0.3*Y);
  vT = 0.5; vBulb = 0.0; vX = 0.0;
  if (aB.y == 0.0) w += S*aS*(0.003 + 0.02*iL.z);
  else {
    /* a blade: a gas bladder on a short stalk, then a long ruffled leaf trailing with the water; out on the surface
       they lie flat, fanned out both sides of the stipe, and make the mat */
    float b = aB.z, t = aB.x, h1 = hsh(b + ph*3.1), h2 = hsh(b*1.7 + ph);
    float fl = 0.35*sin(uTime*(1.3 + 0.6*h2) + b*1.9 + ph);
    float ang = aB.y*(0.22 + 0.4*h1) + fl*(lying ? 0.3 : 1.0);
    vec3 bd = lying ? D*cos(ang) + S*sin(ang) : normalize((D*cos(ang) + S*sin(ang))*0.75 + 0.6*Y);
    vec3 ac = normalize(cross(bd, Y)), bn = cross(ac, bd);
    float bl = (0.3 + 0.26*h2)*(0.55 + 0.45*smoothstep(0.0, 0.35, aH))*(0.8 + 1.4*iL.z);
    /* (narrow, longest near the middle, its margin rippled) */
    float wd = 0.016*exp(-pow((t - 0.04)/0.04, 2.0)) + (0.02 + 0.012*h1)*pow(sin(3.14159*clamp((t - 0.08)/0.92, 0.0, 1.0)), 0.6)*(1.0 - 0.35*t)*(1.0 + 0.2*sin(t*31.0 + b*3.0));
    w += bd*t*bl + ac*aS*wd + bn*(0.012*sin(t*12.0 + b*2.0) + 0.006*sin(t*31.0 + b))*aS;
    n = lying ? Y : bn;
    vT = t; vBulb = exp(-pow((t - 0.04)/0.05, 2.0)); vX = aS;
  }
  /* the swell going over sways the whole plant: shoreward under a crest, back under the trough, its top most */
  { float hk = waveH(iK.xy), gk = shoreDZv(iK.x); vec2 lk = vec2(-gk, 1.0)/sqrt(1.0 + gk*gk); w.xz += lk*1.1*hk*(lying ? 1.0 : k*k); }
  float hs = waveH(w.xz);
  /* (nothing stands up out of the water: what reaches the top lies along it) */
  if (lying || w.y > hs - 0.012) { w.y = hs - 0.012 - 0.004*aS*aS; n = Y; }
  vDepth = max(0.0, hs - w.y); vW = w; vH = aH; vShade = iL.w; vN = n;
  vA = smoothstep(0.0, 0.03, L);
  gl_Position = projectionMatrix*viewMatrix*vec4(onTop(w, hs), 1.0);
}`;
  const KELP_FS = `
uniform vec3 uKeyDirT, uKeyColT, uAmbF; uniform float uDay;
varying float vDepth, vH, vA, vShade, vT, vBulb, vX; varying vec3 vW, vN;
void main(){
  /* (a blade's normal, turned between up and its own, can pass through nothing on the way: never normalise a zero) */
  vec3 n = vN*inversesqrt(max(dot(vN, vN), 1e-6)), V = normalize(cameraPosition - vW);
  float tr = exp(-vDepth*1.3);
  /* olive-brown, darker toward the holdfast, the bladders golden; lit through as well as on */
  vec3 alb = mix(vec3(0.045, 0.035, 0.011), vec3(0.105, 0.08, 0.026), 0.3 + 0.7*vH)*(0.8 + 0.4*vShade);
  alb = mix(alb, vec3(0.19, 0.145, 0.045), vBulb*0.6)*(0.85 + 0.3*abs(vX));   /* (thinner, and lighter, toward the margins) */
  vec3 L = uAmbF*0.8 + uKeyColT*(abs(dot(n, uKeyDirT))*0.6 + 0.25)*tr;
  vec3 col = alb*L;
  col = mix(vec3(0.025, 0.1, 0.1)*(uAmbF + uKeyColT*0.3), col, exp(-vDepth*0.9));
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  /* (what reaches the top is drawn there by the canopy: these are only the fronds below it) */
  float a = vA*(0.35 + 0.65*exp(-vDepth*0.7))*(1.0 - 0.8*fres)*(0.35 + 0.65*uDay)*smoothstep(0.03, 0.12, vDepth);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

  /* the canopy: where the fronds reach the top they lie out along it in a mat, blade over blade, streaming with the
     water past the rock. Drawn on the surface itself, a patch round each rock with kelp that rides the waves: strands of
     blades one beside another, each blade a long narrow leaf with its gas bladder at the base, thinning out toward the
     edge of the bed */
  const CANOPY_VS = `
${GLSL.WAVEH}
${ONTOP}
attribute vec4 iC;   /* the rock: x, z, its radius, the way the water streams past it */
attribute vec2 iS;   /* how far the mat reaches, a seed */
varying vec2 vQ; varying float vR, vRock, vSeed, vDeep; varying vec3 vW;
void main(){
  float R = iS.x, ca = cos(iC.w), sa = sin(iC.w);
  /* (longer along the stream than across it, and reaching further downstream of the rock than up) */
  vec2 lq = vec2(position.x*R*1.25 + 0.35*R, position.z*R);
  vec3 w = vec3(iC.x + lq.x*ca - lq.y*sa, 0.0, iC.y + lq.x*sa + lq.y*ca);
  { float hk = waveH(iC.xy), gk = shoreDZv(iC.x); w.xz += vec2(-gk, 1.0)/sqrt(1.0 + gk*gk)*1.1*hk; }   /* (swaying with the fronds under it) */
  w.y = waveH(w.xz);
  float g = shoreDZv(w.x);
  vDeep = 0.12*(shoreZv(w.x) - w.z)/sqrt(1.0 + g*g) + 0.15;
  vQ = lq; vR = R; vRock = iC.z; vSeed = iS.y; vW = w;
  gl_Position = projectionMatrix*viewMatrix*vec4(onTop(w, w.y), 1.0);
}`;
  const CANOPY_FS = `
uniform float uTime, uDay; uniform vec3 uKeyDirT, uKeyColT, uAmbF;
varying vec2 vQ; varying float vR, vRock, vSeed, vDeep; varying vec3 vW;
/* (an integer hash of a cell and a salt: exact, the same in every pixel, where sin() of a big number need not be) */
float hh(vec2 c, float k){
  uvec3 v = uvec3(uint(int(floor(c.x)) + 65536), uint(int(floor(c.y)) + 65536), uint(int(k) + int(vSeed*97.0)));
  v = v*1664525u + 1013904223u; v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y; v ^= v >> 16u; v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  return float(v.x & 0xffffffu)/16777215.0;
}
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(hh(i, 0.0), hh(i + vec2(1.0, 0.0), 0.0), f.x), mix(hh(i + vec2(0.0, 1.0), 0.0), hh(i + vec2(1.0, 1.0), 0.0), f.x), f.y); }
void main(){
  /* (how big a pixel is here, taken first: after a discard, what a fragment's neighbours compute is anyone's guess) */
  vec2 fw = fwidth(vQ); float aa = max(fw.x, fw.y);
  vec2 e = (vQ - vec2(0.35*vR, 0.0))/vec2(1.25*vR, vR);
  float r = length(e), an = atan(e.y, e.x);
  float edge = 0.8 + 0.12*sin(an*3.0 + vSeed) + 0.08*sin(an*7.0 + vSeed*2.3);
  float dens = smoothstep(edge, edge - 0.45, r)*smoothstep(0.55, 0.85, vDeep)*smoothstep(vRock*0.8, vRock*1.15, length(vQ));
  if (dens < 0.02) discard;
  /* (the whole bed breathes a little with the swell) */
  vec2 p = vQ + vec2(0.05*sin(uTime*0.45 + vQ.y*1.7), 0.02*sin(uTime*0.6 + vQ.x*1.3));
  /* under the top blades, the bed: more of them, too crowded and too deep to tell apart */
  float under = dens*(0.3 + 0.32*vn(p*vec2(1.1, 2.4)) + 0.2*vn(p*vec2(3.7, 8.5)));
  vec3 alb = mix(vec3(0.05, 0.037, 0.012), vec3(0.1, 0.074, 0.024), vn(p*2.7 + 4.0));
  /* the blades on top, in two layers, one to a cell of a grid the water has bent about: long narrow leaves, each lying
     the way the water near it runs, curving, a gas bladder at the base of each; far off, only what they come to on
     average */
  vec2 pw = p + vec2(0.3*(vn(p*0.7 + 2.0) - 0.5), 0.5*(vn(p*vec2(0.5, 0.9) + 7.0) - 0.5));
  vec2 cs = vec2(0.42, 0.3);
  float lod = smoothstep(0.01, 0.028, aa), tz = 0.0, tm = 0.0; vec3 tc = alb;
  if (lod < 1.0) for (int L = 0; L < 2; L++) {
    vec2 q = pw + float(L)*vec2(0.21, 0.15), cid = floor(q/cs);
    float sl = float(L)*1000.0;
    for (int i = -1; i <= 0; i++) for (int j = -1; j <= 1; j++) {
      vec2 c = cid + vec2(float(i), float(j));
      if (hh(c, 51.0 + sl) > 0.3 + 0.75*dens) continue;
      vec2 o = (c + vec2(0.1 + 0.4*hh(c, 1.0 + sl), 0.15 + 0.7*hh(c, 173.0 + sl)))*cs;
      float ang = (hh(c, 97.0 + sl) - 0.5)*0.3 + 0.5*(vn(c*0.35 + 11.0) - 0.5), len = 0.32 + 0.3*hh(c, 33.0 + sl), wm = 0.025 + 0.02*hh(c, 19.0 + sl), bend = (hh(c, 77.0 + sl) - 0.5)*0.16;
      vec2 d = q - o, ax = vec2(cos(ang), sin(ang));
      float t = dot(d, ax)/len;
      if (t < -0.06 || t > 1.02) continue;
      float cc = dot(d, vec2(-ax.y, ax.x)) - bend*t*t*len;
      float hw = wm*pow(max(sin(3.14159*clamp(t, 0.0, 1.0)), 1e-4), 0.6)*(1.0 + 0.15*sin(t*27.0 + hh(c, 1.0 + sl)*6.0)), bl = 0.009*exp(-pow((t - 0.04)/0.035, 2.0));
      float w = max(hw, bl), m = 1.0 - smoothstep(w - aa - 1e-4, w + aa + 1e-4, abs(cc)), z = hh(c, 22.0 + sl);
      if (m > 0.02 && z > tz){
        tz = z; tm = m;
        tc = mix(vec3(0.07, 0.05, 0.016), vec3(0.16, 0.12, 0.036), hh(c, 44.0 + sl))*(0.75 + 0.45*(1.0 - abs(cc)/max(w, 1e-3)));
        tc = mix(tc, vec3(0.23, 0.17, 0.05), smoothstep(hw, hw + 0.002, bl)*0.8);
      }
    }
  }
  float cov = mix(max(under, tm*0.95), min(0.95, under + 0.4*dens), lod);
  alb = mix(alb, tc, tm*(1.0 - lod));
  if (cov < 0.02) discard;
  vec3 V = normalize(cameraPosition - vW), n = normalize(vec3(0.06*sin(p.x*21.0 + p.y*13.0), 1.0, 0.06*sin(p.y*17.0 - p.x*9.0)));
  /* (wet: the sun glints off it as off the water round it) */
  float gl = pow(max(dot(reflect(-uKeyDirT, n), V), 0.0), 40.0)*0.35;
  vec3 col = alb*(uAmbF*0.85 + uKeyColT*(max(uKeyDirT.y, 0.0)*0.7 + 0.2)) + uKeyColT*gl*0.25*tm;
  gl_FragColor = vec4(col, cov*(0.4 + 0.6*uDay));
}`;

  /* cleaner shrimp round the rocks in the water, a few to each: hovering, flicking a little way and back; seen through
     the water as the kelp is */
  const SHRIMP_VS = `
${GLSL.WAVEH}
${ONTOP}
uniform float uTime;
attribute vec4 iP;   /* where (x, depth below the surface, z), heading */
attribute float iV;  /* shown (0 while one is held) */
attribute vec3 color;
varying vec3 vC, vN, vW; varying float vDepth;
void main(){
  float ph = iP.w*7.0, t = uTime;
  /* (a hover with a flick now and then) */
  float flick = pow(max(0.0, sin(t*0.7 + ph)), 18.0);
  vec2 dir = vec2(cos(iP.w), sin(iP.w));
  vec3 base = vec3(iP.x, 0.0, iP.z) + vec3(dir.x, 0.0, dir.y)*(0.06*sin(t*0.5 + ph) - 0.25*flick) + vec3(0.0, 0.02*sin(t*1.3 + ph), 0.0);
  { float hk = waveH(base.xz), gk = shoreDZv(base.x); base.xz += vec2(-gk, 1.0)/sqrt(1.0 + gk*gk)*0.7*hk; }   /* (the swell carries it to and fro) */
  vec3 p = position*1.6*iV, n = normal;
  float c = cos(iP.w), s = sin(iP.w);
  vec3 w = base + vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
  float hs = waveH(w.xz); w.y += hs - iP.y;
  vN = vec3(c*n.x - s*n.z, n.y, s*n.x + c*n.z); vC = color; vW = w; vDepth = max(0.0, hs - w.y);
  gl_Position = projectionMatrix*viewMatrix*vec4(onTop(w, hs), 1.0);
}`;
  const SHRIMP_FS = `
uniform vec3 uKeyDirT, uKeyColT, uAmbF; uniform float uDay;
varying vec3 vC, vN, vW; varying float vDepth;
void main(){
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), V = normalize(cameraPosition - vW);
  float tr = exp(-vDepth*1.4);
  vec3 col = vC*(uAmbF*0.9 + uKeyColT*max(dot(n, uKeyDirT), 0.0)*tr*1.1);
  col = mix(vec3(0.03, 0.12, 0.13)*(uAmbF + uKeyColT*0.3), col*1.1, exp(-vDepth*0.8));
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  float a = (0.3 + 0.7*exp(-vDepth*0.8))*(1.0 - 0.85*fres)*uDay;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a);
}`;
  function shrimpGeo() {
    const M = Models, red = [0.62, 0.08, 0.05], white = [0.85, 0.82, 0.78];
    const body = M.loft([[-0.03, 0, 0, 0.002, 2], [-0.02, 0.0028, 0.004, 0.003, 2], [0.0, 0.005, 0.0065, 0.005, 2], [0.018, 0.0045, 0.0055, 0.0055, 2], [0.03, 0, 0, 0.0065, 2]], 12, 8,
      (x, y, z, u, a) => Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0 ? white : red);
    const parts = [{ geo: body }];
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) parts.push({ geo: M.tube(new T.CatmullRomCurve3([new T.Vector3(0.028, 0.007, sd * 0.002), new T.Vector3(0.05, 0.012 + k * 0.006, sd * (0.008 + k * 0.006)), new T.Vector3(0.075, 0.01 + k * 0.012, sd * (0.016 + k * 0.012))]), 6, 3, () => 0.0004), c: white });
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) parts.push({ geo: M.tube(new T.CatmullRomCurve3([new T.Vector3(0.012 - i * 0.005, 0.0, sd * 0.003), new T.Vector3(0.014 - i * 0.005, -0.006, sd * 0.008)]), 2, 3, () => 0.0006), c: i % 2 ? red : white });
    return M.mergeC(parts);
  }

  function build(root, U, world) {
    const r = Textures.rng(4242);
    /* ── kelp ── */
    /* (one frond: the stipe a strip up its length, then its blades, each a strip of its own placed in the shader) */
    const NA = 16, NB = 10, TB = [0, 0.04, 0.11, 0.25, 0.42, 0.6, 0.8, 1], rib = new T.BufferGeometry(), aH = [], aS = [], aB = [], idx = [];
    const strip = (n, at) => { const v0 = aH.length; for (let i = 0; i <= n; i++) for (const sd of [-1, 1]) { at(i); aS.push(sd); } for (let i = 0; i < n; i++) { const a = v0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
    strip(NA, i => { aH.push(i / NA); aB.push(0, 0, 0); });
    /* (more of them toward the tip, where the frond lies out on the surface: the canopy is where most of a kelp's blades are) */
    for (let b = 0; b < NB; b++) strip(TB.length - 1, i => { aH.push(Math.min(0.985, 1 - Math.pow(1 - (b + 0.6) / NB, 1.5))); aB.push(TB[i], b % 2 ? 1 : -1, b + 1); });
    rib.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(aH.length * 3), 3)); rib.setAttribute('aH', new T.Float32BufferAttribute(aH, 1)); rib.setAttribute('aS', new T.Float32BufferAttribute(aS, 1));
    rib.setAttribute('aB', new T.Float32BufferAttribute(aB, 3)); rib.setIndex(idx);
    const kelpM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF }, Mats.coastU),
      vertexShader: KELP_VS, fragmentShader: KELP_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const canopyM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF }, Mats.coastU),
      vertexShader: CANOPY_VS, fragmentShader: CANOPY_FS, transparent: true, depthWrite: false });
    const canG = new T.PlaneGeometry(2, 2, 14, 14); canG.rotateX(-Math.PI / 2);
    const shrimpG = shrimpGeo(), shrimpLive = new Map(), kelpLive = new Map();
    const shrimpM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF }, Mats.coastU),
      vertexShader: SHRIMP_VS, fragmentShader: SHRIMP_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    /* how deep the water is, roughly, this far out from the line of the waves */
    /* (a sphere round points on the water, for culling: all that is drawn of them stays within pad of the points) */
    const around = (P, pad) => { let x = 0, z = 0; for (const p of P) { x += p[0]; z += p[1]; } x /= P.length; z /= P.length; let r = 0; for (const p of P) r = Math.max(r, Math.hypot(p[0] - x, p[1] - z)); return new T.Sphere(new T.Vector3(x, -1, z), r + pad); };
    const depthAt = (x, z) => { const g = Layout.shoreDZ(x), s = (Layout.shoreZ(x) - z) / Math.sqrt(1 + g * g); return Math.max(0, Math.min(4.5, 0.12 * s + 0.15)); };
    if (world) world.decorate(ch => {
      const rs = ch.rng(77), K = [], Lb = [], CP = [];
      for (const p of ch.wet) {
        if (p.rad < 0.55) continue;
        /* (the water runs along the shore past the rock, one way or the other, and its fronds all stream that way) */
        const flow0 = Math.atan2(Layout.shoreDZ(p.x), 1) + (rs() < 0.5 ? 0 : Math.PI), n = 4 + Math.floor(rs() * 7);
        let got = 0;
        for (let i = 0; i < n; i++) {
          const a = rs() * TAU, d0 = p.rad * (1.05 + rs() * 1.6), x = p.x + Math.cos(a) * d0, z = p.z + Math.sin(a) * d0, dep = depthAt(x, z);
          if (dep < 0.7) continue;
          const L = dep * (0.9 + rs() * 0.9) + 0.4 * rs(), flow = flow0 + (rs() - 0.5) * 0.7;
          K.push(x, z, dep, rs() * TAU); Lb.push(L, flow, 0.08 + 0.1 * rs(), rs()); got++;
        }
        /* and where they reach the top, the mat they make there */
        if (got >= 2 && depthAt(p.x, p.z) >= 0.75) CP.push(p.x, p.z, p.rad, flow0, p.rad * 1.4 + 1.3 + rs() * 1.6, rs() * 100);
      }
      if (CP.length) {
        const g3 = new T.InstancedBufferGeometry(); g3.index = canG.index; g3.setAttribute('position', canG.attributes.position);
        const C4 = [], C2 = [], P = []; for (let i = 0; i < CP.length; i += 6) { C4.push(CP[i], CP[i + 1], CP[i + 2], CP[i + 3]); C2.push(CP[i + 4], CP[i + 5]); P.push([CP[i], CP[i + 1]]); }
        g3.setAttribute('iC', new T.InstancedBufferAttribute(new Float32Array(C4), 4)); g3.setAttribute('iS', new T.InstancedBufferAttribute(new Float32Array(C2), 2)); g3.instanceCount = C2.length / 2;
        g3.boundingSphere = around(P, 9);
        const m3 = new T.Mesh(ch.keep ? ch.keep(g3) : g3, canopyM); m3.renderOrder = 5; ch.tiny.add(m3);
      }
      /* the shrimp: a few round each rock that stands in water deep enough to hide them */
      const SP = [];
      for (const p of ch.wet) {
        if (p.rad < 0.4) continue;
        const n = 2 + Math.floor(rs() * 4);
        for (let i = 0; i < n; i++) { const a = rs() * TAU, d0 = p.rad * (1.0 + rs() * 0.5), x = p.x + Math.cos(a) * d0, z = p.z + Math.sin(a) * d0, dep = depthAt(x, z); if (dep < 0.35) continue; SP.push({ x, z, y: Math.min(dep - 0.05, 0.18 + rs() * 0.5), h: rs() * TAU }); }
      }
      if (SP.length) {
        const g2 = new T.InstancedBufferGeometry(); g2.index = shrimpG.index; for (const k of ['position', 'normal', 'color']) g2.setAttribute(k, shrimpG.attributes[k]);
        g2.setAttribute('iP', new T.InstancedBufferAttribute(new Float32Array(SP.flatMap(q => [q.x, q.y, q.z, q.h])), 4));
        const iV = new T.InstancedBufferAttribute(new Float32Array(SP.length).fill(1), 1); iV.setUsage(T.DynamicDrawUsage); g2.setAttribute('iV', iV); g2.instanceCount = SP.length;
        g2.boundingSphere = around(SP.map(q => [q.x, q.z]), 1);
        const m2 = new T.Mesh(ch.keep ? ch.keep(g2) : g2, shrimpM); m2.renderOrder = 5; ch.tiny.add(m2);
        /* (the chunk's geometry is disposed of with it; a rebuilt level takes the same key) */
        const reg = { list: SP, iV }; shrimpLive.set(ch.c, reg); g2.addEventListener('dispose', () => { if (shrimpLive.get(ch.c) === reg) shrimpLive.delete(ch.c); });
      }
      if (!K.length) return;
      const g = new T.InstancedBufferGeometry(); g.index = rib.index; for (const k of ['position', 'aH', 'aS', 'aB']) g.setAttribute(k, rib.attributes[k]);
      kelpLive.set(ch.c, K.length / 4); g.addEventListener('dispose', () => kelpLive.delete(ch.c));
      g.setAttribute('iK', new T.InstancedBufferAttribute(new Float32Array(K), 4)); g.setAttribute('iL', new T.InstancedBufferAttribute(new Float32Array(Lb), 4)); g.instanceCount = K.length / 4;
      { const P = []; for (let i = 0; i < K.length; i += 4) P.push([K[i], K[i + 1]]); g.boundingSphere = around(P, 5); }
      const m = new T.Mesh(ch.keep ? ch.keep(g) : g, kelpM); m.renderOrder = 4; ch.tiny.add(m);
    }, 'tiny');

    /* ── hermit crabs along the tide line: a borrowed shell on its back, red legs and claws out in front; it wanders a
       little, stops, wanders on; comes near, and it pulls into its shell and is only a shell ── */
    /* (the shell and the crab as models/life/hermit.js builds them, each one geometry; ap: the middle of the shell's
       mouth, where the crab draws in) */
    const HP = Models.make('life/hermit', { lite: true, parts: true }).userData.parts, AP = HP.ap;
    const NH = 10, shellI = new T.InstancedMesh(HP.shell, Mats.lit({ vertexColors: true, roughness: 0.38 }), NH), bodyI = new T.InstancedMesh(HP.body, Mats.lit({ vertexColors: true, roughness: 0.5 }), NH);
    shellI.count = bodyI.count = 0; shellI.frustumCulled = bodyI.frustumCulled = false; root.add(shellI, bodyI);
    const crabs = Array.from({ length: NH }, () => ({ x: NaN, z: 0, h: 0, st: 'walk', tm: 0, out: 1, size: 1.8 + r() * 0.8, held: false }));
    const m4 = new T.Matrix4(), mB = new T.Matrix4(), mS = new T.Matrix4(), mT = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), p3 = new T.Vector3();
    function place(c, cx) { for (let k = 0; k < 12; k++) { const x = cx + (r() - 0.5) * 50, sz = Layout.shoreZ(x), z = sz + 0.9 + r() * 2.4; if (world && world.massif(x, z) > 0.05) continue; if (Math.hypot(x - Layout.camp.x, z - Layout.camp.z) < 4) continue; Object.assign(c, { x, z, h: r() * TAU, st: 'walk', tm: 2 + r() * 4, out: 1 }); return; } }
    let lastT = null;
    function update(t, cam) {
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
      let n = 0;
      for (const c of crabs) {
        if (c.held) continue;
        if (c.x !== c.x || Math.abs(c.x - cam.x) > 40) place(c, cam.x);
        if (c.x !== c.x) continue;
        /* (a walker near: in it goes) */
        const near = cam.y < Math.max(0, world ? world.land(cam.x, cam.z) : 0) + 3 && Math.hypot(c.x - cam.x, c.z - cam.z) < 2.2;
        if (near) { c.st = 'hide'; c.tm = 2 + r() * 3; }
        if (c.st === 'walk') { c.x += Math.cos(c.h) * 0.06 * dt; c.z += Math.sin(c.h) * 0.06 * dt; c.h += (r() - 0.5) * dt * 2; const sz = Layout.shoreZ(c.x); if (c.z < sz + 0.6 || c.z > sz + 3.6) c.h += Math.PI * dt * 2; if ((c.tm -= dt) <= 0) { c.st = 'stop'; c.tm = 1 + r() * 4; } c.out = Math.min(1, c.out + dt * 3); }
        else if (c.st === 'stop') { if ((c.tm -= dt) <= 0) { c.st = 'walk'; c.tm = 2 + r() * 5; } c.out = Math.min(1, c.out + dt * 3); }
        else if (c.st === 'hide') { c.out = Math.max(0, c.out - dt * 5); if (!near && (c.tm -= dt) <= 0) c.st = 'stop'; }
        e.set(0, -c.h, 0); q.setFromEuler(e); sc.setScalar(c.size); p3.set(c.x, 0.0, c.z); m4.compose(p3, q, sc); shellI.setMatrixAt(n, m4);
        /* (the crab drawn in toward the middle of the shell's mouth, smaller and further in the more it hides; never to
           nothing, as a zero scale leaves its normals undefined) */
        const o = Math.max(0.06, c.out), k = 0.14 + 0.86 * o;
        mB.makeTranslation(AP.x, AP.y, AP.z).multiply(mS.makeScale(k, k, k)).multiply(mT.makeTranslation(-AP.x - 0.005 * (1 - o), -AP.y, -AP.z));
        sc.setScalar(c.size); m4.compose(p3, q, sc).multiply(mB); bodyI.setMatrixAt(n, m4);
        c.slot = n; n++;
      }
      shellI.count = bodyI.count = n; shellI.instanceMatrix.needsUpdate = bodyI.instanceMatrix.needsUpdate = true;
    }
    /* for picking up (inspect.js); thrown in the sea, it comes back up the beach somewhere further along */
    function pickables(list, cam) {
      const t = Mats.U.uTime.value, day = U.uDay ? U.uDay.value : 1;
      if (day > 0.25) for (const [, R] of shrimpLive) R.list.forEach((q, i) => {
        if (R.iV.array[i] < 0.5) return;
        const dx = q.x - cam.x, dz = q.z - cam.z; if (dx * dx + dz * dz > 600) return;
        const ph = q.h * 7, flick = Math.pow(Math.max(0, Math.sin(t * 0.7 + ph)), 18), off = 0.06 * Math.sin(t * 0.5 + ph) - 0.25 * flick;
        list.push({ kind: 'shrimp', x: q.x + Math.cos(q.h) * off, y: -q.y, z: q.z + Math.sin(q.h) * off, r: 0.07, yaw: -q.h, size: 1.6, reach: 24,
          take() { R.iV.array[i] = 0; R.iV.needsUpdate = true; }, give() { R.iV.array[i] = 1; R.iV.needsUpdate = true; } });
      });
      for (const c of crabs) {
        if (c.held || c.x !== c.x) continue;
        list.push({ kind: 'hermit', x: c.x, y: 0.02, z: c.z, r: 0.06 * c.size, yaw: -c.h, size: c.size, reach: 26,
          take() { c.held = true; }, give(how) { c.held = false; if (how !== 'back') { c.x = NaN; } } });
      }
    }
    function shift(dx, dz) { for (const c of crabs) { c.x += dx; c.z += dz; } }
    const allShrimp = () => { const o = []; for (const [, R] of shrimpLive) for (const q of R.list) o.push([q.x, -q.y, q.z]); return o; };
    return { update, pickables, shift, get count() { return crabs.filter(c => c.x === c.x).length; }, debug: { shellI, bodyI, crabs, kelpM, canopyM, shrimp: allShrimp, kelp: () => [...kelpLive.values()].reduce((a, b) => a + b, 0), kelpTris: idx.length / 3 } };
  }
  return { build };
})();
