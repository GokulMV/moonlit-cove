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
  const PATCH = 4, BLADES = 768, REACH = 38;
  /* the levels: out to how far each is drawn (from the eye to the patch's middle), how many of a patch's blades it keeps,
     how much wider each is, and how many segments up its length */
  const LODS = [{ d: 11, keep: 1, wide: 1, seg: 5 }, { d: 22, keep: 0.5, wide: 1.45, seg: 3 }, { d: REACH, keep: 0.24, wide: 2.1, seg: 2 }];

  /* one patch's blades at one level: for each blade, its vertices up its length either side of its middle and the tip
     (aB: which blade, as a share of all of them; how far up it, 0..1; which side, -1, 0 at the tip, 1) */
  function patchGeo(seg) {
    const per = seg * 2 + 1, n = BLADES * per, B = new Float32Array(n * 3), idx = [];
    for (let b = 0; b < BLADES; b++) {
      const o = b * per, f = (b + 0.5) / BLADES;
      for (let k = 0; k < seg; k++) { const t = k / seg; B.set([f, t, -1], (o + k * 2) * 3); B.set([f, t, 1], (o + k * 2 + 1) * 3); }
      B.set([f, 1, 0], (o + per - 1) * 3);
      for (let k = 0; k < seg - 1; k++) { const a = o + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const a = o + (seg - 1) * 2; idx.push(a, a + 1, o + per - 1);
    }
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('aB', new T.BufferAttribute(B, 3));
    /* (three needs a position to know how many vertices there are; the shader makes its own) */
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    g.setIndex(new T.BufferAttribute(n > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    g.boundingSphere = new T.Sphere(new T.Vector3(), 1e9);
    return g;
  }

  const VS = `
${GLSL.COMMON}
attribute vec3 aB; attribute vec3 aPatch;
uniform float uTime, uPatch; uniform vec4 uGW, uPush, uSnowG; uniform vec4 uClr[8]; uniform vec3 uLod;
varying vec3 vC; varying vec3 vN; varying vec3 vWPos; varying float vT; varying float vAO; varying float vSnow;
float gH(vec2 p){ vec3 q = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
float gN(vec2 p){ vec2 i = floor(p), f = fract(p), u = f*f*(3.0 - 2.0*f);
  return mix(mix(gH(i), gH(i + vec2(1.0, 0.0)), u.x), mix(gH(i + vec2(0.0, 1.0)), gH(i + vec2(1.0, 1.0)), u.x), u.y); }
/* how thick the grass grows at p, 0..1: along the beach's top (from a few metres out on the sand, where it is tussocks,
   to a dozen metres in under the trees, where the shade thins it out), and in the clearings; in clumps */
float density(vec2 p){
  vec4 f = isF(p); vec2 uv = isUV(p); vec4 k1 = isK(uv);
  float d = -f.x, W = k1.y*50.0, sand = k1.z;
  float band = smoothstep(W - 1.2, W + 1.4, d)*(1.0 - smoothstep(W + 6.0, W + 15.0, d));
  float clump = smoothstep(0.32, 0.62, gN(p*0.33 + 3.1))*0.65 + 0.35*smoothstep(0.25, 0.75, gN(p*1.4 + 9.7));
  float tus = sand*smoothstep(W - 9.0, W - 4.0, d)*(1.0 - smoothstep(W - 2.5, W - 0.2, d))*smoothstep(0.7, 0.84, gN(p*0.55 + 1.3))*0.8;
  float g = max(band*(0.35 + 0.65*clump), tus);
  for (int i = 0; i < 8; i++){ vec4 c = uClr[i]; if (c.z > 0.0) g = max(g, c.w*(1.0 - smoothstep(c.z*0.6, c.z, length(p - c.xy)))*(0.55 + 0.45*clump)); }
  return f.x > -0.5 && band < 0.01 ? 0.0 : g;
}
void main(){
  float bi = aB.x, t = aB.y, side = aB.z, lod = aPatch.z;
  /* (the blades grow in tufts, sixteen to a tuft: the tuft's place in its patch from where the patch is and which tuft it
     is; each blade's a little way out from the tuft's middle, leaning away from it, so a tuft is a fountain of blades.
     Whether a tuft grows at all is the ground's say, where its middle is) */
  float tuft = floor(bi*${BLADES / 16}.0), tb = fract(bi*${BLADES / 16}.0);
  vec2 cell = floor(aPatch.xy/uPatch + 0.5), r0 = vec2(gH(cell*7.13 + tuft*1013.7), gH(cell.yx*3.71 + tuft*577.3 + 11.0));
  vec2 tc = aPatch.xy + r0*uPatch;
  float dens = density(tc), ts = gH(tc*2.7 + 4.4), ta = tb*6.2832*2.618 + gH(tc*1.3)*6.2832, tr = (0.03 + 0.11*sqrt(fract(tb*7.37 + ts)))*(0.6 + 0.7*ts);
  vec2 xz = tc + vec2(cos(ta), sin(ta))*tr;
  float h1 = gH(tc*3.17 + 0.5), h2 = gH(xz*5.31 + 1.7), h3 = gH(xz*2.13 + 7.1), h4 = gH(xz*7.77 + 3.3), h5 = gH(xz*1.91 + 9.9);
  float keep = lod < 0.5 ? 1.0 : lod < 1.5 ? uLod.x : uLod.y;
  /* (snow deep enough lies over the shorter blades) */
  float hgt = mix(0.22, 0.66, h2)*(0.55 + 0.45*ts)*(0.6 + 0.4*dens), snowD = uSnowG.y;
  if (fract(bi*7.31) > keep || h1 > dens || hgt < snowD*1.15 + 0.03){ gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  float wide = lod < 0.5 ? 1.0 : lod < 1.5 ? 1.45 : 2.1, wid = mix(0.006, 0.012, h3)*wide;
  /* (out from the tuft's middle, more the further out it stands; turned a little on itself) */
  float yaw = ta + (h4 - 0.5)*1.1, lean = mix(0.08, 0.28, h5) + 1.6*tr;
  vec2 dir = vec2(cos(yaw), sin(yaw)), sd = vec2(-dir.y, dir.x);
  /* the ground under it, as the land is drawn there (isle.js: sunk a little where it is low; on the sand, the sand's own
     level) */
  float H = isF(xz).w, gy = max(H - 0.22*(1.0 - smoothstep(1.0, 5.0, H)), 0.0);
  /* its curve: up from the ground, out along its lean, its tip drooping (a quadratic Bézier); the wind on it — gusts you
     can see crossing the grass, and each blade's own flutter — and a walker pushing it aside, and the snow's weight */
  vec2 wd = uGW.xy; float ws = uGW.z;
  float gust = (0.25 + 1.0*gN(xz*0.09 - wd*uTime*1.1))*(0.55 + 0.45*gN(xz*0.031 - wd*uTime*0.35 + 5.0));
  float flut = sin(uTime*(2.2 + 1.8*h3) + h1*6.2832 + dot(xz, wd)*0.9)*0.18;
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
  float dry = step(0.86, gH(xz*9.3 + 2.0)), hue = gH(xz*4.4 + 6.0);
  vec3 cFoot = vec3(0.06, 0.08, 0.025), cMid = mix(vec3(0.16, 0.26, 0.055), vec3(0.22, 0.28, 0.07), hue), cTip = mix(vec3(0.34, 0.42, 0.11), vec3(0.45, 0.45, 0.16), hue);
  cMid = mix(cMid, vec3(0.27, 0.24, 0.11), dry); cTip = mix(cTip, vec3(0.46, 0.39, 0.2), dry);
  vC = mix(mix(cFoot, cMid, smoothstep(0.0, 0.45, t)), cTip, smoothstep(0.45, 1.0, t))*(0.82 + 0.36*gH(xz*13.1));
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
uniform vec4 uFog, uForF;
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
  vec3 L = uAmbF*isleSky3(vWPos)*(0.6 + 0.4*max(n.y, 0.0))*vAO + uKeyColT*sh*(0.25 + max(ndl, 0.0)*0.75 + max(-ndl, 0.0)*0.6*vec3(0.9, 1.05, 0.45)*(1.0 - vSnow))*(0.45 + 0.55*vAO);
  vec3 c = alb*L + uKeyColT*sh*0.22*pow(max(dot(n, normalize(uKeyDirT + V)), 0.0), 20.0)*vAO*(1.0 - 0.6*vSnow);
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0 || torchNear(vWPos)) c += alb*artLight(vWPos, n)*vAO;
  gl_FragColor = vec4(fogIt(c, vWPos), 1.0);
}`;

  function build(root, o = {}) {
    const group = new T.Group(); group.name = 'grass'; group.matrixAutoUpdate = false; root.add(group);
    const U = Object.assign({}, Mats.U, { uPatch: { value: PATCH }, uGW: { value: new T.Vector4(Layout.wind[0], Layout.wind[1], 1, 0) }, uPush: { value: new T.Vector4(0, 0, 0, 0) },
      uSnowG: { value: new T.Vector4(0, 0, 0, 0) }, uClr: { value: Array.from({ length: 8 }, () => new T.Vector4()) }, uLod: { value: new T.Vector3(LODS[1].keep, LODS[2].keep, 0) } });
    const mat = new T.ShaderMaterial({ uniforms: U, vertexShader: VS.replace('REACHF', REACH.toFixed(1)), fragmentShader: FS, side: T.DoubleSide });
    /* (the clearings that are lawns: where a hut stands, the camp's back) */
    const setClear = list => { U.uClr.value.forEach((v, i) => { const c = list[i]; if (c) v.set(c[0], c[1], c[2], c[3] ?? 1); else v.set(0, 0, 0, 0); }); clr = list.slice(); lastX = 1e9; };
    let clr = [];
    /* one instanced mesh for each level: the patches it draws, as many as fit round the eye */
    const CAP = [40, 70, 120];
    const levels = LODS.map((L, i) => {
      const g = patchGeo(L.seg), A = new Float32Array(CAP[i] * 3), at = new T.InstancedBufferAttribute(A, 3); at.setUsage(T.DynamicDrawUsage);
      g.setAttribute('aPatch', at); g.instanceCount = 0;
      const m = new T.Mesh(g, mat); m.frustumCulled = false; m.matrixAutoUpdate = false; m.renderOrder = 2; group.add(m);
      return { g, A, at, m, cap: CAP[i] };
    });
    /* which patches have any grass, worked out once each on the CPU from the island's own numbers (the same as the
       shader's, roughly: a patch it might give blades to) */
    const I = Layout.island(), SQ = {}, has = new Map();
    function patchHas(px, pz) {
      const key = Math.round(px / PATCH) * 65536 + Math.round(pz / PATCH); let v = has.get(key);
      if (v !== undefined) return v;
      v = false;
      for (let j = 0; j <= 2 && !v; j++) for (let i = 0; i <= 2 && !v; i++) {
        const x = px + i * PATCH / 2, z = pz + j * PATCH / 2, s = I.sdf(x, z), q = I.shore(I.uAt(x, z), SQ), d = -s;
        if (d > q.W - 11 && d < q.W + 16) v = true;
        for (const c of clr) if (Math.hypot(x - c[0], z - c[1]) < c[2] + PATCH) v = true;
      }
      if (has.size > 20000) has.clear();
      has.set(key, v); return v;
    }
    let lastX = 1e9, lastZ = 1e9;
    function update(cam, o2 = {}) {
      const cx = cam.x, cz = cam.z, high = cam.y - Math.max(0, o2.ground ?? 0);
      group.visible = high < 60;
      if (!group.visible) return;
      U.uGW.value.set(Layout.wind[0], Layout.wind[1], o2.wind ?? 1, o2.gust ?? 0);
      if (o2.push) U.uPush.value.set(o2.push[0], 0, o2.push[1], 1); else U.uPush.value.w = 0;
      U.uSnowG.value.set(o2.snow || 0, o2.snowD || 0, 0, 0);
      if (Math.hypot(cx - lastX, cz - lastZ) < 1.5) return;
      lastX = cx; lastZ = cz;
      const n = levels.map(() => 0), g0x = Math.floor((cx - REACH) / PATCH), g1x = Math.floor((cx + REACH) / PATCH), g0z = Math.floor((cz - REACH) / PATCH), g1z = Math.floor((cz + REACH) / PATCH);
      for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
        const px = gx * PATCH, pz = gz * PATCH, d = Math.hypot(px + PATCH / 2 - cx, pz + PATCH / 2 - cz);
        if (d > REACH + PATCH * 0.7) continue;
        const L = LODS.findIndex(q => d < q.d), li = L < 0 ? 2 : L, lv = levels[li];
        if (n[li] >= lv.cap || !patchHas(px, pz)) continue;
        lv.A.set([px, pz, li], n[li] * 3); n[li]++;
      }
      levels.forEach((lv, i) => { lv.g.instanceCount = n[i]; lv.at.needsUpdate = true; });
    }
    const stats = () => ({ patches: levels.map(l => l.g.instanceCount), blades: levels.reduce((a, l, i) => a + l.g.instanceCount * BLADES * LODS[i].keep, 0) | 0 });
    return { update, setClear, stats, group, mat };
  }
  return { build, PATCH, BLADES };
})();
