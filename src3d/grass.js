/* ─────────────────────────────────────────────────────────────
   grass.js — the island's grass (Layout.isle), blade by blade:
   along the top of the beach where the sand gives way to the
   forest, out a little onto the sand in tussocks, and over the
   clearings. Each blade is its own curve: a tapering strap rising
   from the ground and leaning out as it goes, rounded across its
   width, dark at its foot and paler toward its tip, some of them
   gone to straw. The wind runs over the grass in gusts you can
   watch cross it, each blade fluttering in its own time; a walker
   pushes it aside; snow lies on it and, deep enough, buries it.
   The way it is drawn is the one Ghost of Tsushima's grass made
   well known and SimonDev's Quick_Grass shows in three.js (MIT):
   one patch of blades, instanced over the ground round the eye on
   a fixed grid, every blade's place, size, lean and colour worked
   out on the GPU from where it stands, so a patch costs nothing
   to lay and is always the same; fewer, wider blades further off.
   ───────────────────────────────────────────────────────────── */
const IsleGrass = (() => {
  const T = THREE;
  /* (a patch 4 m square, 128 tufts of 16 blades in it) */
  const PATCH = 4, TUFT = 16, NT = 128, BLADES = TUFT * NT, REACH = 38;
  /* the levels: out to how far each is drawn (from the eye to the patch's middle), how many of each tuft's blades it keeps
     (every tuft is kept, thinner further off), how much wider each is, and how many segments up its length */
  const LODS = [{ d: 10, per: 16, wide: 1, seg: 5 }, { d: 20, per: 7, wide: 1.6, seg: 3 }, { d: REACH, per: 3, wide: 2.6, seg: 2 }];
  LODS.forEach(L => { L.keep = L.per / TUFT; });

  /* one patch's blades at one level: for each blade, its vertices up its length either side of its middle and the tip
     (aB: which blade, as a share of all of them — the same blade at every level; how far up it, 0..1; which side, -1, 0 at
     the tip, 1). A level further off has only the first few blades of each tuft */
  function patchGeo(seg, perT) {
    const per = seg * 2 + 1, nb = NT * perT, n = nb * per, B = new Float32Array(n * 3), idx = [];
    for (let j = 0; j < nb; j++) {
      const b = Math.floor(j / perT) * TUFT + (j % perT), o = j * per, f = (b + 0.5) / BLADES;
      for (let k = 0; k < seg; k++) { const t = k / seg; B.set([f, t, -1], (o + k * 2) * 3); B.set([f, t, 1], (o + k * 2 + 1) * 3); }
      B.set([f, 1, 0], (o + per - 1) * 3);
      for (let k = 0; k < seg - 1; k++) { const a = o + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const a = o + (seg - 1) * 2; idx.push(a, a + 1, o + per - 1);
    }
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('aB', new T.BufferAttribute(B, 3));
    void BLADES;
    /* (three needs a position to know how many vertices there are; the shader makes its own) */
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setIndex(new T.BufferAttribute(n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    g.boundingSphere = new T.Sphere(new T.Vector3(), 1e9);
    return g;
  }

  const VS = `
${GLSL.COMMON}
attribute vec3 aB; attribute vec3 aPatch; attribute vec4 aH;
uniform float uTime, uPatch; uniform vec4 uGW, uPush, uSnowG; uniform vec4 uClr[8]; uniform vec3 uLod;
uniform vec4 uNo[4];   /* where no grass grows (x, z, how far round): the camp, the van's place */
varying vec3 vC; varying vec3 vN; varying vec3 vWPos; varying float vT; varying float vAO; varying float vSnow;
float gH(vec2 p){ vec3 q = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
float gN(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0 - 2.0*f);
  return mix(mix(gH(i), gH(i + vec2(1.0, 0.0)), u.x), mix(gH(i + vec2(0.0, 1.0)), gH(i + vec2(1.0, 1.0)), u.x), u.y); }
/* how thick the grass grows at p, 0..1: along the beach's top (from a few metres out on the sand, where it is tussocks,
   to a dozen metres in under the trees, where the shade thins it out), and in the clearings; in clumps */
float gLawn = 0.0, gTus = 0.0;   /* (how much of a lawn the last place density() looked at is; whether it is a tussock on the sand) */
${Layout.isle ? `float density(vec2 p){
  vec4 f = isF(p); vec2 uv = isUV(p); vec4 k1 = isK(uv);
  float d = -f.x, W = k1.y*50.0, sand = k1.z;
  float band = smoothstep(W - 1.2, W + 1.4, d)*(1.0 - smoothstep(W + 6.0, W + 15.0, d));
  float clump = smoothstep(0.32, 0.62, gN(p*0.33 + 3.1))*0.65 + 0.35*smoothstep(0.25, 0.75, gN(p*1.4 + 9.7));
  float tus = sand*smoothstep(W - 9.0, W - 4.0, d)*(1.0 - smoothstep(W - 2.5, W - 0.2, d))*smoothstep(0.7, 0.84, gN(p*0.55 + 1.3))*0.8;
  float bandG = band*(0.35 + 0.65*clump), g = max(bandG, tus);
  gTus = step(bandG, tus)*step(0.01, tus);
  gLawn = 0.0;
  for (int i = 0; i < 8; i++){ vec4 c = uClr[i]; if (c.z > 0.0){ float l = c.w*(1.0 - smoothstep(c.z*0.6, c.z, length(p - c.xy))); gLawn = max(gLawn, l); g = max(g, l*(0.7 + 0.3*clump)); } }
  gTus *= 1.0 - step(0.3, gLawn);
  return f.x > -0.5 && band < 0.01 ? 0.0 : g;
}` : `/* (along the beach: from the coast's own line (glsl.js COAST), how far up the sand from the water's edge p is, and how wide
   the beach is there; the grass from the top of the beach in under the trees, tussocks out on the upper sand, never in
   the camp) */
float density(vec2 p){
  vec4 c = coastAt4(p.x); float kq = inversesqrt(1.0 + c.y*c.y), s = (c.x - p.y)*kq, d = -s, W = (c.z - c.x)*kq;
  float band = vergeBand(d, W, c.w*kq);
  vec2 pu = p + vec2(uLoopX, 0.0);   /* (its clumps where they are along the beach as it goes on: glsl.js uLoopX) */
  float clump = smoothstep(0.32, 0.62, gN(pu*0.33 + 3.1))*0.65 + 0.35*smoothstep(0.25, 0.75, gN(pu*1.4 + 9.7));
  float tus = smoothstep(max(W*0.55, W - 9.0), max(W*0.55, W - 9.0) + 2.5, d)*(1.0 - smoothstep(W - 2.5, W - 0.2, d))*smoothstep(0.7, 0.84, gN(pu*0.55 + 1.3))*0.8;
  /* (a sward: thinner in its hollows, never bare; a little thinner in under the trees, in their shade) */
  float bandG = band*(0.6 + 0.4*clump)*(1.0 - 0.25*smoothstep(W + 14.0, W + 40.0, d)), g = max(bandG, tus);
  gTus = step(bandG, tus)*step(0.01, tus);
  gLawn = 0.0;
  for (int i = 0; i < 8; i++){ vec4 l4 = uClr[i]; if (l4.z > 0.0){ float l = l4.w*(1.0 - smoothstep(l4.z*0.6, l4.z, length(p - l4.xy))); gLawn = max(gLawn, l); g = max(g, l*(0.7 + 0.3*clump)); } }
  gTus *= 1.0 - step(0.3, gLawn);
  for (int i = 0; i < 4; i++){ vec4 n = uNo[i]; if (n.z > 0.0) g *= smoothstep(n.z*0.75, n.z, length(p - n.xy)); }
  return s > -0.5 && band < 0.01 ? 0.0 : g;
}`}
void main(){
  float bi = aB.x, t = aB.y, side = aB.z, lod = aPatch.z;
  /* (the blades grow in tufts, sixteen to a tuft: the tuft's place in its patch from where the patch is and which tuft it
     is; each blade's a little way out from the tuft's middle, leaning away from it, so a tuft is a fountain of blades.
     Whether a tuft grows at all is the ground's say, where its middle is) */
  float tuft = floor(bi*${NT}.0), tb = fract(bi*${NT}.0);
  /* (every blade's own numbers drawn from where it is along the beach as it goes on (LX: glsl.js uLoopX), so the grass
     is the same blade for blade when the world's frame is carried round the loop) */
  vec2 LX = vec2(uLoopX, 0.0);
  vec2 cell = floor((aPatch.xy + LX)/uPatch + 0.5), r0 = vec2(gH(cell*7.13 + tuft*1013.7), gH(cell.yx*3.71 + tuft*577.3 + 11.0));
  vec2 tc = aPatch.xy + r0*uPatch, tu = tc + LX;
  /* (where it grows thick the tufts spread and run into one another, a sward, its blades every way; where it is thin,
     on the sand, each is a tight tussock, a fountain of blades) */
  float dens = density(tc), lawn = gLawn, tus = gTus, ts = gH(tu*2.7 + 4.4), ta = tb*6.2832*2.618 + gH(tu*1.3)*6.2832, tr0 = (0.03 + 0.11*sqrt(fract(tb*7.37 + ts)))*(0.6 + 0.7*ts);
  float spread = smoothstep(0.45, 0.9, dens)*(1.0 - tus), tr = tr0*mix(1.0, 2.7, spread);
  vec2 xz = tc + vec2(cos(ta), sin(ta))*tr, xu = xz + LX;
  float h1 = gH(tu*3.17 + 0.5), h2 = gH(xu*5.31 + 1.7), h3 = gH(xu*2.13 + 7.1), h4 = gH(xu*7.77 + 3.3), h5 = gH(xu*1.91 + 9.9);
  /* (snow deep enough lies over the shorter blades; a lawn is kept short) */
  float hgt = mix(0.22, 0.66, h2)*(0.55 + 0.45*ts)*(0.6 + 0.4*dens)*mix(1.0, 0.5, lawn)*mix(1.0, 1.3, tus), snowD = uSnowG.y;
  if (h1 > dens || hgt < snowD*1.15 + 0.03){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float wide = lod < 0.5 ? 1.0 : lod < 1.5 ? ${LODS[1].wide.toFixed(2)} : ${LODS[2].wide.toFixed(2)}, wid = mix(0.007, 0.014, h3)*wide;
  /* (out from the tuft's middle, more the further out it stands; turned a little on itself) */
  float yaw = ta + (h4 - 0.5)*mix(1.1, 3.2, spread), lean = mix(0.08, 0.28, h5) + 1.6*tr0*(1.0 - 0.55*spread);
  vec2 dir = vec2(cos(yaw), sin(yaw)), sd = vec2(-dir.y, dir.x);
  /* the ground under it, as the land is drawn there (isle.js: sunk a little where it is low; on the sand, the sand's own
     level) */
  ${Layout.isle ? 'float H = isF(xz).w, gy = max(H - 0.22*(1.0 - smoothstep(1.0, 5.0, H)), 0.0);' : 'vec2 lq = clamp((xz - aPatch.xy)/uPatch, 0.0, 1.0); float gy = mix(mix(aH.x, aH.y, lq.x), mix(aH.z, aH.w, lq.x), lq.y);'}
  /* its curve: up from the ground, out along its lean, its tip drooping (a quadratic Bézier); the wind on it — gusts you
     can see crossing the grass, and each blade's own flutter — and a walker pushing it aside, and the snow's weight */
  vec2 wd = uGW.xy; float ws = uGW.z;
  float gust = (0.25 + 1.0*gN(xu*0.09 - wd*uTime*1.1))*(0.55 + 0.45*gN(xu*0.031 - wd*uTime*0.35 + 5.0));
  float flut = sin(uTime*(2.2 + 1.8*h3) + h1*6.2832 + dot(xu, wd)*0.9)*0.18;
  vec2 bend = dir*lean + wd*(gust*(0.55 + 0.6*uGW.w) + flut*0.35)*ws*0.6;
  vec2 pd = xz - uPush.xz; float pl = length(pd), push = (1.0 - smoothstep(0.3, 1.25, pl))*uPush.w;
  bend += pd/max(pl, 1e-3)*push*0.9;
  bend *= 1.0 + 1.2*uSnowG.x*0.4;
  float bl = length(bend); if (bl > 0.95){ bend *= 0.95/bl; bl = 0.95; }
  vec3 p0 = vec3(xz.x, gy, xz.y), tip = p0 + vec3(bend.x, sqrt(max(0.05, 1.0 - bl*bl)), bend.y)*hgt, mid = p0 + vec3(bend.x*0.3, 0.72, bend.y*0.3)*hgt;
  float u = 1.0 - t; vec3 p = u*u*p0 + 2.0*u*t*mid + t*t*tip, tg = normalize(2.0*u*(mid - p0) + 2.0*t*(tip - mid) + vec3(0.0, 1e-4, 0.0));
  /* its width: tapering to the point, broadest a little above its foot */
  float w = wid*(1.0 - pow(t, 1.6))*(0.8 + 0.2*smoothstep(0.0, 0.15, t));
  vec3 sd3 = vec3(sd.x, 0.0, sd.y);
  p += sd3*side*w;
  /* (rounded across its width: the normal turned out toward each edge) */
  vec3 nf = normalize(cross(tg, sd3)); vN = normalize(nf + sd3*side*0.55 + vec3(0.0, 0.45, 0.0));
  /* (far off, a blade's own lie no longer shows: its light turns toward the ground's) */
  float far = smoothstep(8.0, REACHF, distance(p, cameraPosition)); vN = normalize(mix(vN, vec3(0.0, 1.0, 0.0), far*0.6));
  /* its colour, foot to tip: dark down among the stems, the green of the blade, paler at its tip; some blades gone to
     straw, some yellower, some bluer */
  float dry = step(0.86, gH(xu*9.3 + 2.0)), hue = gH(xu*4.4 + 6.0);
  vec3 cFoot = vec3(0.06, 0.08, 0.025), cMid = mix(vec3(0.16, 0.26, 0.055), vec3(0.22, 0.28, 0.07), hue), cTip = mix(vec3(0.34, 0.42, 0.11), vec3(0.45, 0.45, 0.16), hue);
  cMid = mix(cMid, vec3(0.27, 0.24, 0.11), dry); cTip = mix(cTip, vec3(0.46, 0.39, 0.2), dry);
  vC = mix(mix(cFoot, cMid, smoothstep(0.0, 0.45, t)), cTip, smoothstep(0.45, 1.0, t))*(0.82 + 0.36*gH(xu*13.1));
  /* (in the thick of it the light is down among the stems) */
  vAO = mix(0.45 + 0.55*smoothstep(0.0, 0.6, t), 1.0, 0.35*(1.0 - dens));
  vSnow = uSnowG.x*smoothstep(0.3, 1.0, t)*smoothstep(0.1, 0.6, tg.y + 0.5);
  vT = t; vWPos = p;
  gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
}`;
  const FS = `
#include <packing>
${GLSL.COMMON}
${GLSL.ART}
uniform vec3 uAmbF, uKeyDirT, uKeyColT;
uniform sampler2D uLeafShM; uniform mat4 uLeafShX; uniform vec4 uLeafShA; uniform vec2 uLeafShS;
uniform vec4 uFog, uForF, uSnowG;
varying vec3 vC; varying vec3 vN; varying vec3 vWPos; varying float vT; varying float vAO; varying float vSnow;
vec3 fogIt(vec3 c, vec3 wp){
  float d = distance(wp, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  c = mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
  if (uForF.w > 0.001) c = mix(c, uForF.rgb, (1.0 - exp(-max(d - 4.0, 0.0)/34.0))*0.6*uForF.w);
  return c;
}
${GLSL.LEAF_PCF}
float shadowHere(vec3 wp){
  if (uLeafShA.w < 0.5 || length(wp.xz - uLeafShA.xy) > uLeafShA.z) return 1.0;
  vec4 sc = uLeafShX*vec4(wp, 1.0); sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  float z = sc.z - 0.002;
  return lsPCF(sc.xy, z);
}
void main(){
  vec3 V = normalize(cameraPosition - vWPos), n = normalize(vN); if (dot(n, V) < 0.0) n = -n;
  float ndl = dot(n, uKeyDirT), sh = shadowHere(vWPos)*isleShAt(vWPos);
  vec3 alb = mix(vC, vec3(0.86, 0.89, 0.93), vSnow);
  /* (a blade is thin: lit from either side, the light from behind coming through it yellower; a sheen along it) */
  /* (and in snow, the light off the snow all round it, from below as much as above) */
  vec3 L = uAmbF*isleSky3(vWPos)*((0.6 + 0.4*max(n.y, 0.0))*vAO + 0.55*uSnowG.x) + uKeyColT*sh*(0.25 + max(ndl, 0.0)*0.75 + max(-ndl, 0.0)*0.6*vec3(0.9, 1.05, 0.45)*(1.0 - vSnow))*(0.45 + 0.55*vAO);
  vec3 c = alb*L + uKeyColT*sh*0.22*pow(max(dot(n, normalize(uKeyDirT + V)), 0.0), 20.0)*vAO*(1.0 - 0.6*vSnow);
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0 || torchNear(vWPos)) c += alb*artLight(vWPos, n)*vAO;
  gl_FragColor = vec4(fogIt(c, vWPos), 1.0);
}`;

  function build(root, o = {}) {
    const group = new T.Group(); group.name = 'grass'; group.matrixAutoUpdate = false; root.add(group);
    const U = Object.assign({}, Mats.U, { uPatch: { value: PATCH }, uGW: { value: new T.Vector4(Layout.wind[0], Layout.wind[1], 1, 0) }, uPush: { value: new T.Vector4(0, 0, 0, 0) },
      uSnowG: { value: new T.Vector4(0, 0, 0, 0) }, uClr: { value: Array.from({ length: 8 }, () => new T.Vector4()) }, uLod: { value: new T.Vector3(LODS[1].keep, LODS[2].keep, 0) },
      uNo: { value: Array.from({ length: 4 }, (_, i) => { const c = (o.no || [])[i]; return c ? new T.Vector4(c[0], c[1], c[2], 0) : new T.Vector4(); }) } });
    const mat = new T.ShaderMaterial({ uniforms: U, vertexShader: VS.replace('REACHF', REACH.toFixed(1)), fragmentShader: FS, side: T.DoubleSide });
    /* (the clearings that are lawns: where a hut stands, the camp's back) */
    const setClear = list => { U.uClr.value.forEach((v, i) => { const c = list[i]; if (c) v.set(c[0], c[1], c[2], c[3] ?? 1); else v.set(0, 0, 0, 0); }); clr = list.slice(); has.clear(); lastX = 1e9; };
    let clr = [];
    /* one instanced mesh for each level: the patches it draws, as many as fit round the eye */
    const CAP = [40, 84, 210];
    const levels = LODS.map((L, i) => {
      const g = patchGeo(L.seg, L.per), A = new Float32Array(CAP[i] * 3), at = new T.InstancedBufferAttribute(A, 3); at.setUsage(T.DynamicDrawUsage);
      /* (along the beach, the ground's height at each patch's four corners: the blades stand on it, between them) */
      const AH = new Float32Array(CAP[i] * 4), ah = new T.InstancedBufferAttribute(AH, 4); ah.setUsage(T.DynamicDrawUsage);
      g.setAttribute('aPatch', at); g.setAttribute('aH', ah); g.instanceCount = 0;
      const m = new T.Mesh(g, mat); m.frustumCulled = false; m.matrixAutoUpdate = false; m.renderOrder = 2; group.add(m);
      return { g, A, at, AH, ah, m, cap: CAP[i] };
    });
    /* which patches have any grass, worked out once each on the CPU from the island's or the beach's own numbers (the
       same as the shader's, roughly: a patch it might give blades to). 0: none; 1: only near the eye (its two nearer
       levels: deep in under the trees, o.farIn metres past the forest's edge, where the undergrowth hides the grass
       from further off); 2: at every level */
    const I = Layout.isle ? Layout.island() : null, SQ = {}, has = new Map(), keyOf = (px, pz) => Math.round(px / PATCH) * 65536 + Math.round(pz / PATCH);
    const FAR_IN = o.farIn ?? Infinity;
    const upSand = (x, z) => {
      if (I) { const s = I.sdf(x, z), q = I.shore(I.uAt(x, z), SQ); return [-s, q.W]; }
      const g = Layout.shoreDZ(x), k = 1 / Math.sqrt(1 + g * g), sz = Layout.shoreMeanZ(x); return [(z - sz) * k, (Layout.vegZ(x) - sz) * k, Math.max(10, o.reach ? o.reach(x) : 17) * k];
    };
    function patchHas(px, pz) {
      const key = keyOf(px, pz); let v = has.get(key);
      if (v !== undefined) return v;
      v = 0;
      for (let j = 0; j <= 2 && v < 2; j++) for (let i = 0; i <= 2 && v < 2; i++) {
        const x = px + i * PATCH / 2, z = pz + j * PATCH / 2, [d, W, R] = upSand(x, z);
        if (d > (I ? W - 11 : W * 0.5) && d < W + (I ? 18 : R + 6)) v = Math.max(v, I || d < W + FAR_IN + PATCH ? 2 : 1);
        for (const c of clr) if (Math.hypot(x - c[0], z - c[1]) < c[2] + PATCH) v = 2;
      }
      if (has.size > 20000) has.clear();
      has.set(key, v); return v;
    }
    /* (the ground's height at a patch corner, along the beach: kept, as the corners are shared) */
    const hts = new Map();
    const hAt = (x, z) => { const k = keyOf(x, z); let h = hts.get(k); if (h === undefined) { h = o.ground ? o.ground(x, z) : 0; if (hts.size > 40000) hts.clear(); hts.set(k, h); } return h; };
    let lastX = 1e9, lastZ = 1e9, lastQ = 1, ver = Layout.coastVer;
    function update(cam, o2 = {}) {
      /* (the coast moved under the camp: what was worked out of it is for another place now) */
      if (Layout.coastVer !== ver) { ver = Layout.coastVer; has.clear(); hts.clear(); lastX = 1e9; }
      const cx = cam.x, cz = cam.z, high = cam.y - Math.max(0, o2.ground ?? 0);
      group.visible = high < 60;
      if (!group.visible) return;
      U.uGW.value.set(Layout.wind[0], Layout.wind[1], o2.wind ?? 1, o2.gust ?? 0);
      if (o2.push) U.uPush.value.set(o2.push[0], 0, o2.push[1], 1); else U.uPush.value.w = 0;
      U.uSnowG.value.set(o2.snow || 0, o2.snowD || 0, 0, 0);
      /* (on a machine that is struggling, the levels drawn nearer: q from the frame-rate ladder, 0.55..1) */
      const qk = Math.max(0.5, Math.min(1, o2.q ?? 1)), D = LODS.map(L => L.d * qk), RQ = REACH * qk;
      if (Math.hypot(cx - lastX, cz - lastZ) < 1.5 && qk === lastQ) return;
      lastX = cx; lastZ = cz; lastQ = qk;
      const n = levels.map(() => 0), g0x = Math.floor((cx - RQ) / PATCH), g1x = Math.floor((cx + RQ) / PATCH), g0z = Math.floor((cz - RQ) / PATCH), g1z = Math.floor((cz + RQ) / PATCH);
      for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
        const px = gx * PATCH, pz = gz * PATCH, d = Math.hypot(px + PATCH / 2 - cx, pz + PATCH / 2 - cz);
        if (d > RQ + PATCH * 0.7) continue;
        const L = D.findIndex(q => d < q), li = L < 0 ? 2 : L, lv = levels[li];
        if (n[li] >= lv.cap) continue;
        const hv = patchHas(px, pz); if (!hv || (li === 2 && hv < 2)) continue;
        lv.A.set([px, pz, li], n[li] * 3);
        if (!I) lv.AH.set([hAt(px, pz), hAt(px + PATCH, pz), hAt(px, pz + PATCH), hAt(px + PATCH, pz + PATCH)], n[li] * 4);
        n[li]++;
      }
      levels.forEach((lv, i) => { lv.g.instanceCount = n[i]; lv.at.needsUpdate = true; lv.ah.needsUpdate = true; });
    }
    const stats = () => ({ patches: levels.map(l => l.g.instanceCount), blades: levels.reduce((a, l, i) => a + l.g.instanceCount * BLADES * LODS[i].keep, 0) | 0 });
    return { update, setClear, stats, group, mat };
  }
  return { build, PATCH, BLADES, LODS };
})();
