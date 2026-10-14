/* ─────────────────────────────────────────────────────────────
   life.js — small lives on the shore: starfish and shells along
   the strand line, fish that leap clear of the water now and then
   with a splash, schools of small fish in the clear shallows with
   their shadows on the sand by day, and sea turtles (and now and then
   a ray) swimming over the sand under them, coming up to breathe. And sky lanterns, released
   from the camp, rising out over the sea.
   ───────────────────────────────────────────────────────────── */
const Life = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const rng = s => Textures.rng(s);

  /* a grid of (u, v) → position, as an indexed mesh with vertex colours */
  function sheet(N, M, fn, flip) {
    const pos = [], col = [], idx = [];
    for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) { const [p, c] = fn(i / N, j / M); pos.push(...p); col.push(...c); }
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* starfish: five arms from a small disc, each tapering to a blunt, slightly upturned tip, domed along its middle and
     studded down it with blunt spines, a little twisted as it lies (radius 1; its colour is the instance's, this its
     light and shade only: paler down the ridge and at the tips, the spines paler still) */
  function starGeo(seed) {
    const M = Models, r = rng(seed), tw = (r() - 0.5) * 0.2;
    /* (arms broad where they leave the disc, the disc itself a fair size) */
    const arm = th => { const a = (((th + tw * Math.sin(th * 3)) * 5 / TAU) % 1 + 1) % 1, d = Math.min(a, 1 - a) * 2; return Math.pow(Math.max(0, 1 - d), 1.15); };
    const rad = th => 0.3 + 0.7 * arm(th) * (0.96 + 0.06 * Math.sin(th * 2 + seed));
    const top = (q, th) => 0.17 * Math.pow(Math.max(0, 1 - q * q), 0.55) * (0.45 + 0.55 * rad(th)) + 0.012;
    const up = M.sheet(10, 70, (q, c) => { const th = c * TAU, rho = q * rad(th); return [Math.cos(th) * rho, top(q, th) * Math.pow(1 - q, 0.12) + 0.05 * Math.pow(q, 3) * arm(th), Math.sin(th) * rho]; },
      (q, c) => { const th = c * TAU, mid = Math.exp(-(((1 - arm(th)) / 0.25) ** 2)), k = (0.74 + 0.2 * mid - 0.12 * (1 - q)) * (1 + 0.45 * Math.pow(q, 4)) * (0.88 + 0.24 * M.vn(th * 9, q * 30, seed)); return [k, k, k]; });
    /* (facing up: as made it may face down) */
    { const N = up.attributes.normal; if (N.getY(Math.floor(N.count / 2)) < 0) { const I = up.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } for (let i = 0; i < N.array.length; i++) N.array[i] = -N.array[i]; } }
    const parts = [{ geo: up }], knob = new T.SphereGeometry(1, 6, 4);
    for (let k = 0; k < 5; k++) {
      let th0 = k / 5 * TAU; for (let it = 0; it < 4; it++) th0 = k / 5 * TAU - tw * Math.sin(th0 * 3);     /* (the arm's middle, where its twist has put it) */
      for (let i = 0; i < 6; i++) {
        const q = 0.16 + (i + 0.5) / 6 * 0.72, rho = q * rad(th0), h = top(q, th0) * Math.pow(1 - q, 0.12) + 0.05 * Math.pow(q, 3), sc = 0.036 * (1.15 - 0.75 * q);
        parts.push({ geo: knob, m: Models.M4(Math.cos(th0) * rho, h + sc * 0.2, Math.sin(th0) * rho, 0, 0, 0, sc, sc * 0.75, sc), c: [1.2, 1.2, 1.2] });
      }
    }
    return M.mergeC(parts);
  }
  /* a scallop: a ribbed fan from the hinge, banded (length 1) */
  function scallopGeo(seed) {
    const r = rng(seed), ribs = 14 + Math.floor(r() * 6);
    return sheet(22, 4, (u, v) => {
      const th = (u - 0.5) * 2.3, rib = Math.cos(th * ribs), R = v * (1 + 0.04 * rib);
      const h = 0.2 * (1 - Math.pow(v, 2.2)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(th) / 1.2, 2))) + 0.025 * rib * v;
      const band = 0.8 + 0.2 * Math.sin(v * 22 + seed) + 0.1 * rib;
      return [[Math.sin(th) * R, h, -Math.cos(th) * R + 0.5], [band, band * 0.97, band * 0.94]];
    }, true);
  }
  /* a cowrie: a glossy dome with a spotted back (length 1) */
  function cowrieGeo(seed) {
    const r = rng(seed), sp = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => [r() * TAU, r() * 0.9]);
    return sheet(16, 6, (u, v) => {
      const a = u * TAU, b = v * Math.PI * 0.5, x = Math.cos(a) * Math.sin(b + 0.05), z = Math.sin(a) * Math.sin(b + 0.05) * 0.62, y = Math.cos(b) * 0.42;
      let k = 1; for (const [sa, sb] of sp) { const d = Math.hypot(Math.atan2(Math.sin(a - sa), Math.cos(a - sa)) * 0.5, b - sb); k -= 0.45 * Math.exp(-d * d / 0.012); }
      return [[x * 0.5, y * 0.5, z * 0.5], [k, k * 0.92, k * 0.82]];
    }, true);
  }
  /* a small spired shell lying on its side, with a spiral line (length 1) */
  function conchGeo(seed) {
    return sheet(12, 9, (u, v) => {
      const a = u * TAU, L = v, R = 0.32 * Math.pow(1 - v, 0.9) * (1 + 0.18 * Math.max(0, Math.sin(a + v * 26))) + 0.004;
      const sp = 0.75 + 0.25 * Math.sin(a * 1 + v * 26 + seed);
      return [[(L - 0.45), R * Math.sin(a) + 0.26 * (1 - v * 0.7), R * Math.cos(a)], [sp, sp * 0.9, sp * 0.78]];
    });
  }

  /* a sergeant major for the schools: models/life/reef.js's own, built lite (its body, fins and eyes as one geometry,
     painted vertex by vertex); aT 0 at its nose to 1 at the tip of its tail (how much it bends as it swims). 13 cm long,
     its nose toward +x */
  function schoolFishGeo() {
    const g = Models.make('life/reeffish', { lite: true }).userData.parts, P = g.attributes.position, aT = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) aT[i] = Math.max(0, Math.min(1, (0.06 - P.getX(i)) / 0.135));
    g.setAttribute('aT', new T.BufferAttribute(aT, 1));
    return g;
  }
  /* fish: a slim, laterally flattened body, dark blue-green along the back shading to silver flanks and a white belly,
     a dark eye either side, a dorsal fin and a smaller one beneath, pectoral fins, a deeply forked tail (length 1,
     nose toward +x) */
  function fishGeo() {
    const body = sheet(16, 12, (u, v) => {
      const a = u * TAU, x = v - 0.5, w = Math.sin(Math.PI * Math.min(1, v * 1.06)) * (v < 0.86 ? 1 : 0.55), ry = 0.115 * w, rz = 0.045 * w;
      const up = Math.sin(a), back = Math.max(0, up), belly = Math.max(0, -up);
      let c = [0.7 + 0.08 * Math.cos(a * 3), 0.74, 0.78].map((k, i) => k * (1 - back * 0.85) + [0.07, 0.14, 0.17][i] * back * 0.85);
      c = c.map(k => k + belly * belly * 0.18);
      /* the eye, and behind it the gill cover's edge, a dark curve down the cheek */
      const ex = x - 0.36, ey = Math.sin(a) * ry - 0.012; if (Math.abs(Math.cos(a)) > 0.6 && ex * ex + ey * ey < 0.0006) c = [0.03, 0.03, 0.03];
      const gx = x - 0.27 + 0.35 * (Math.sin(a) * ry) ** 2 * 40; if (Math.abs(Math.cos(a)) > 0.35 && Math.abs(gx) < 0.007) c = c.map(k => k * 0.45);
      return [[x, Math.sin(a) * ry, Math.cos(a) * rz], c];
    });
    const F = [0.35, 0.42, 0.46], tris = list => { const P = [], C = []; for (const [a, b, c, col = F] of list) { P.push(...a, ...b, ...c); C.push(...col, ...col, ...col); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; };
    const tail = tris([[[-0.46, 0, 0], [-0.68, 0.15, 0], [-0.6, 0, 0]], [[-0.46, 0, 0], [-0.6, 0, 0], [-0.68, -0.15, 0]]]);
    const fins = tris([[[0.06, 0.1, 0], [-0.08, 0.17, 0], [-0.12, 0.085, 0], [0.12, 0.2, 0.24]], [[-0.12, -0.075, 0], [-0.2, -0.12, 0], [-0.24, -0.06, 0]],
      ...[-1, 1].map(sd => [[0.24, -0.04, sd * 0.04], [0.14, -0.07, sd * 0.1], [0.16, -0.03, sd * 0.05]])]);
    return { body, tail, fins };
  }

  /* (what is seen through the water is drawn at the surface's own depth along the line of sight, so the water never
     covers it, a few centimetres nearer than that, as the sea's mesh only follows the waves between its own points;
     a little of its depth kept, so that its own parts still stand in their order) */
  const ONTOP = `
vec3 onTop(vec3 w, float hs){
  vec3 ray = w - cameraPosition; float k = ray.y < -1e-4 ? clamp((hs + 0.012 - cameraPosition.y)/ray.y, 0.0, 1.0) : 1.0;
  vec3 p = cameraPosition + ray*k, v = p - cameraPosition; float d = length(v), dep = clamp(hs - w.y, 0.0, 1.5);
  return p + v/max(d, 1e-3)*(dep*0.025 - min(d*0.5, 0.06 + 0.0015*d));
}
/* how deep the water is here, roughly (as shallows.js reckons it), and where the sun throws the shadow of a thing at
   height y onto the sand under it */
float bedAt(vec2 p){ ${Layout.isle ? 'return clamp(-shoreFloor(p, shoreS(p)), 0.15, 4.5);' : 'return clamp(0.12*shoreS(p) + 0.15, 0.0, 4.5);'} }
vec2 throwTo(vec2 p, float y, float bed, vec3 L){ vec2 o = -L.xz/max(L.y, 0.12)*max(0.0, y + bed); float n = length(o); return p + (n > 1.4 ? o*(1.4/n) : o); }`;
  /* the shadows of the shoal's fish on the sand under the shallows: each where the sun throws it from its fish, the
     fish's own size, softer the further its fish swims above the sand; strong in full sun, gone under cloud */
  const SHOAL_VS = `
${GLSL.WAVEH}
${ONTOP}
uniform vec4 uSchool[5]; uniform float uTime; uniform vec3 uKeyDirT;
attribute vec4 aFish;   /* school, along, across, phase */
varying vec2 vUv; varying float vA, vSoft;
void main(){
  vUv = uv;
  vec4 S = uSchool[int(aFish.x)];
  float hd = S.z, c = cos(hd), s = sin(hd);
  vec2 off = vec2(aFish.y, aFish.z) + vec2(sin(uTime*0.9 + aFish.w*6.0)*0.35, sin(uTime*0.6 + aFish.w*4.0)*0.3);
  vec2 p = S.xy + vec2(c*off.x - s*off.y, s*off.x + c*off.y);
  { float hf = waveH(p); p -= shoreN(p)*0.9*hf; }   /* (carried by the swell, as its fish is) */
  float yaw = hd + 0.25*sin(uTime*2.3 + aFish.w*9.0), fy = -0.26 - 0.36*fract(aFish.w*3.3), bed = bedAt(p);
  vec3 L = normalize(uKeyDirT);
  vec2 at = throwTo(p, fy, bed, L);
  float lift = max(0.0, fy + bed);
  vSoft = clamp(0.25 + lift*0.9, 0.25, 0.8);
  /* (a fish's shadow is its outline from where the sun stands: long and thin with the sun high, deeper as it sinks) */
  vec2 q = (uv - 0.5)*vec2(0.15, 0.03 + 0.05*(1.0 - L.y))*(0.8 + 0.4*fract(aFish.w*7.7))*(1.0 + vSoft*0.6);
  vec2 w = vec2(cos(yaw)*q.x - sin(yaw)*q.y, sin(yaw)*q.x + cos(yaw)*q.y);
  vec3 wp = vec3(at.x + w.x, -bed + 0.02, at.y + w.y);
  float dist = shoreS(p);
  vA = S.w*smoothstep(5.6, 7.0, dist)*smoothstep(14.0, 11.5, dist)*smoothstep(0.12, 0.35, L.y);
  gl_Position = projectionMatrix*viewMatrix*vec4(onTop(wp, waveH(wp.xz)), 1.0);
}`;
  const SHOAL_FS = `
uniform float uDay; uniform vec3 uKeyColT, uAmbF; varying vec2 vUv; varying float vA, vSoft;
void main(){
  vec2 q = vUv*2.0 - 1.0;
  float m = 1.0 - smoothstep(1.0 - vSoft, 1.0, length(q));
  float lk = dot(uKeyColT, vec3(0.3, 0.59, 0.11)), la = dot(uAmbF, vec3(0.3, 0.59, 0.11)), sun = clamp(lk/(lk + 2.0*la + 1e-4)*1.5, 0.0, 1.0);
  float a = m*vA*uDay*sun*(0.34 - 0.18*vSoft);
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.012, 0.035, 0.04, a);
}`;

  /* the fish themselves, swimming under the surface of the shallows: each drawn where it is seen through the water,
     but put at the surface's own depth (pushed along the line of sight up to it), so whatever stands above the water in
     front of it still hides it; tinted and faded by the water above it, gone at a glancing angle where the surface
     only mirrors the sky. Each one bends as it swims, more toward its tail. The same schools and the same places in them
     as the shadows below (SHOAL_VS) */
  const FISH3_VS = `
${GLSL.WAVEH}
uniform vec4 uSchool[5]; uniform float uTime;
attribute vec4 aFish;   /* school, along, across, phase */
attribute float aT, aVis;
attribute vec3 color;
varying vec3 vC, vN, vW; varying float vDepth, vA;
void main(){
  vec4 S = uSchool[int(aFish.x)];
  float hd = S.z, c = cos(hd), s = sin(hd);
  vec2 off = vec2(aFish.y, aFish.z) + vec2(sin(uTime*0.9 + aFish.w*6.0)*0.35, sin(uTime*0.6 + aFish.w*4.0)*0.3);
  vec2 pc = S.xy + vec2(c*off.x - s*off.y, s*off.x + c*off.y);
  float yaw = hd + 0.25*sin(uTime*2.3 + aFish.w*9.0), sc = (0.8 + 0.4*fract(aFish.w*7.7))*aVis;
  vec3 p = position*sc, n = normal;
  float ph = uTime*(8.0 + 3.0*fract(aFish.w*3.1)) + aFish.w*30.0, bend = 0.25*aT*aT;
  p.z += sin(ph - aT*2.6)*bend*0.07*sc;
  float cy = cos(yaw), sy = sin(yaw);
  vec3 w = vec3(pc.x + cy*p.x - sy*p.z, -0.26 - 0.36*fract(aFish.w*3.3) + p.y, pc.y + sy*p.x + cy*p.z);
  /* the swell passing over carries each fish with it: up and down with the surface, shoreward under a crest and back
     again under the trough (the water itself goes round like that as a wave goes by) */
  { float hf = waveH(pc); vec2 lf = -shoreN(pc); w.y += 0.72*hf; w.xz += lf*0.9*hf; }
  vN = vec3(cy*n.x - sy*n.z, n.y, sy*n.x + cy*n.z); vC = color; vW = w;
  float hs = waveH(w.xz);
  vDepth = max(0.0, hs - w.y);
  float dist = shoreS(pc);
  vA = S.w*smoothstep(5.6, 7.0, dist)*smoothstep(14.0, 11.5, dist)*step(0.01, sc);
  /* (and a few centimetres nearer still: the sea's mesh only follows the waves between its own points) */
  vec3 ray = w - cameraPosition; float k = ray.y < -1e-4 ? clamp((hs + 0.015 - cameraPosition.y)/ray.y, 0.0, 1.0) : 1.0;
  vec3 pt = cameraPosition + ray*k, vv = pt - cameraPosition; float dd = length(vv);
  gl_Position = projectionMatrix*viewMatrix*vec4(pt - vv/max(dd, 1e-3)*min(dd*0.5, 0.06 + 0.0015*dd), 1.0);
}`;
  const FISH3_FS = `
uniform vec3 uKeyDirT, uKeyColT, uAmbF; uniform float uDay;
varying vec3 vC, vN, vW; varying float vDepth, vA;
void main(){
  if (vA < 0.01) discard;
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), V = normalize(cameraPosition - vW);
  float tr = exp(-vDepth*1.6);
  vec3 L = uAmbF*0.9 + uKeyColT*max(dot(n, uKeyDirT), 0.0)*tr*1.2;
  vec3 h = normalize(uKeyDirT + V); float sp = pow(max(dot(n, h), 0.0), 40.0)*0.6*tr;
  vec3 col = vC*L + uKeyColT*sp;
  /* (through the water: tinted toward its own green, more so the deeper it swims) */
  col = mix(vec3(0.03, 0.12, 0.13)*(uAmbF + uKeyColT*0.3), col*1.15, exp(-vDepth*0.75));
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  gl_FragColor = vec4(col, vA*uDay*(0.25 + 0.75*exp(-vDepth*0.7))*(1.0 - 0.85*fres));
}`;

  /* sea turtles' (and the ray's) shadows on the sand under the shallows, each where the sun throws it from the animal
     above (a shell, a head, the long front flippers rowing and the short back ones; for a ray its diamond and tail),
     soft at the edges, and only in sunshine */
  const TURTLE_VS = `
${GLSL.WAVEH}
${ONTOP}
uniform vec3 uKeyDirT;
attribute vec4 iT;   /* x, z, heading, how much it shows */
attribute vec4 iU;   /* flipper stroke phase, length, which (0 a turtle, 1 a ray), how high it swims (y) */
varying vec2 vUv; varying float vA; varying float vPh; varying float vKind;
void main(){
  vUv = uv; vPh = iU.x; vKind = iU.z;
  vec3 L = normalize(uKeyDirT);
  float bed = bedAt(iT.xy);
  vec2 at = throwTo(iT.xy, iU.w, bed, L);
  vA = iT.w*smoothstep(0.12, 0.35, L.y);
  float c = cos(iT.z), s = sin(iT.z);
  vec2 q = (uv - 0.5)*iU.y*1.5*(1.0 + 0.08*max(0.0, iU.w + bed)), w = vec2(c*q.x - s*q.y, s*q.x + c*q.y);
  vec3 wp = vec3(at.x + w.x, -bed + 0.02, at.y + w.y);
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*viewMatrix*vec4(onTop(wp, waveH(wp.xz)), 1.0);
}`;
  const TURTLE_FS = `
uniform float uDay; uniform vec3 uKeyColT, uAmbF; varying vec2 vUv; varying float vA; varying float vPh; varying float vKind;
float ell(vec2 p, vec2 c, vec2 r, float a){ p -= c; float cs = cos(a), sn = sin(a); p = vec2(cs*p.x + sn*p.y, -sn*p.x + cs*p.y); return length(p/r); }
void main(){
  vec2 p = (vUv - 0.5)*1.5;
  float lk = dot(uKeyColT, vec3(0.3, 0.59, 0.11)), la = dot(uAmbF, vec3(0.3, 0.59, 0.11)), sun = clamp(lk/(lk + 2.0*la + 1e-4)*1.5, 0.0, 1.0);
  float m;
  if (vKind > 0.5){
    /* a ray: a broad diamond of a body, its wing tips rippling, a long thin tail */
    float w = 0.5 + 0.035*sin(vPh*1.3 - abs(p.y)*9.0), dia = abs(p.x - 0.05)/0.36 + abs(p.y)/w;
    m = 1.0 - smoothstep(0.6, 1.0, dia + 0.25*smoothstep(0.1, 0.36, p.x)*(1.0 - smoothstep(0.0, 0.1, abs(p.y))));
    m = max(m, 0.6*(1.0 - smoothstep(0.004, 0.02, abs(p.y + 0.02*sin(vPh + p.x*6.0))))*step(-0.72, p.x)*step(p.x, -0.25));
  } else {
    m = 1.0 - smoothstep(0.6, 1.0, ell(p, vec2(-0.02, 0.0), vec2(0.4, 0.31), 0.0));
    m = max(m, 1.0 - smoothstep(0.5, 1.0, ell(p, vec2(0.46, 0.0), vec2(0.12, 0.085), 0.0)));
    for (int k = 0; k < 2; k++){
      float sd = k == 0 ? -1.0 : 1.0, a = sd*(1.85 + 0.55*sin(vPh)), b = sd*(2.55 + 0.2*sin(vPh + 1.6));
      vec2 sh = vec2(0.17, sd*0.25), hip = vec2(-0.32, sd*0.15);
      m = max(m, 1.0 - smoothstep(0.45, 1.0, ell(p, sh + 0.17*vec2(cos(a), sin(a)), vec2(0.2, 0.055), a)));
      m = max(m, 1.0 - smoothstep(0.45, 1.0, ell(p, hip + 0.07*vec2(cos(b), sin(b)), vec2(0.09, 0.05), b)));
    }
  }
  float al = m*vA*uDay*sun*0.26;
  if (al < 0.01) discard;
  gl_FragColor = vec4(0.012, 0.035, 0.04, al);
}`;

  /* the turtles and the ray themselves, seen through the water as the fish are: every part of the model drawn where it
     is seen, at the surface's own depth, tinted toward the water's green the deeper it is and faded at a glancing angle;
     what breaks the surface (a turtle up to breathe) shows as it is */
  const UW_VS = `
${GLSL.WAVEH}
${ONTOP}
attribute vec3 color;
uniform vec3 uCol; uniform float uVC;
varying vec3 vC, vN, vW; varying float vDepth; varying vec2 vUv;
void main(){
  vec4 w = modelMatrix*vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix)*normal); vC = uCol*mix(vec3(1.0), color, uVC); vW = w.xyz; vUv = uv;
  float hs = waveH(w.xz); vDepth = max(0.0, hs - w.y);
  gl_Position = projectionMatrix*viewMatrix*vec4(onTop(w.xyz, hs), 1.0);
}`;
  const UW_FS = `
uniform vec3 uKeyDirT, uKeyColT, uAmbF; uniform float uDay, uFade, uHasMap; uniform sampler2D uMap;
varying vec3 vC, vN, vW; varying float vDepth; varying vec2 vUv;
void main(){
  vec3 n = normalize(vN)*(gl_FrontFacing ? 1.0 : -1.0), V = normalize(cameraPosition - vW);
  float tr = exp(-vDepth*1.4);
  vec3 L = uAmbF*0.95 + uKeyColT*max(dot(n, uKeyDirT), 0.0)*tr*1.15;
  vec3 h = normalize(uKeyDirT + V); float sp = pow(max(dot(n, h), 0.0), 30.0)*0.3*tr;
  /* (a painted model's picture, where it has one) */
  vec3 base = uHasMap > 0.5 ? vC*texture2D(uMap, vUv).rgb : vC;
  vec3 col = base*L + uKeyColT*sp;
  col = mix(vec3(0.03, 0.12, 0.13)*(uAmbF + uKeyColT*0.3), col*1.1, exp(-vDepth*0.75));
  float under = smoothstep(0.0, 0.04, vDepth), fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  float a = uFade*mix(1.0, (0.35 + 0.65*exp(-vDepth*0.7))*(1.0 - 0.85*fres), under)*(0.45 + 0.55*uDay);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

  /* sky lanterns: paper lanterns lit from below, released from the camp, rising and drifting out over the sea on the land breeze */
  const LANT_VS = `
attribute float aPh; attribute float aK;
varying float vY; varying float vPh; varying float vK; varying vec3 vN; varying vec3 vW;
void main(){
  vY = position.y/0.42 + 0.5; vPh = aPh; vK = aK;
  vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix*instanceMatrix)*normal);
  gl_Position = projectionMatrix*viewMatrix*w;
}`;
  const LANT_FS = `
uniform float uTime; uniform vec4 uFog;
varying float vY; varying float vPh; varying float vK; varying vec3 vN; varying vec3 vW;
void main(){
  float fl = 0.82 + 0.1*sin(uTime*13.0 + vPh*20.0) + 0.08*sin(uTime*29.0 + vPh*7.0);
  float rib = 0.85 + 0.15*smoothstep(0.0, 0.08, abs(fract(atan(vN.z, vN.x)*1.9) - 0.5));
  /* a warm paper glow, brightest low down by the flame; kept gentle, so a sky full of them never glares */
  vec3 c = vec3(1.0, 0.5, 0.18)*(0.5 + 1.9*pow(1.0 - vY, 2.0))*fl*rib;
  float d = distance(vW, cameraPosition);
  c *= 1.0/(1.0 + d*0.006);
  gl_FragColor = vec4(c*vK, 1.0);
}`;
  function lanterns(root) {
    const MAX = 32, geo = new T.CylinderGeometry(0.16, 0.2, 0.42, 14, 1, false);
    const aPh = new Float32Array(MAX), aK = new Float32Array(MAX);
    geo.setAttribute('aPh', new T.InstancedBufferAttribute(aPh, 1)); geo.setAttribute('aK', new T.InstancedBufferAttribute(aK, 1).setUsage(T.DynamicDrawUsage));
    const mat = new T.ShaderMaterial({ uniforms: { uTime: Mats.U.uTime, uFog: Mats.U.uFog }, vertexShader: LANT_VS, fragmentShader: LANT_FS, side: T.DoubleSide });
    const im = new T.InstancedMesh(geo, mat, MAX); im.count = 0; im.frustumCulled = false; root.add(im);
    const list = [], r = rng(31337), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), pos = new T.Vector3(), one = new T.Vector3(1, 1, 1);
    const W = Layout.wind;
    function release(x, z, t) {
      if (list.length >= MAX) list.shift();
      list.push({ x, z, t0: t, rise: 0.24 + r() * 0.12, drift: 0.85 + r() * 0.45, ph: r() * TAU, side: (r() - 0.5) * 0.5 });
    }
    function update(t) {
      for (let i = list.length - 1; i >= 0; i--) if (t - list[i].t0 > 230) list.splice(i, 1);
      list.forEach((L, i) => {
        const a = Math.max(0, t - L.t0), up = a < 4 ? a * a / 8 : a - 2;     /* hovers a moment while it fills with warm air */
        const sw = Math.sin(a * 0.7 + L.ph) * 0.35 * Math.min(1, a / 6);
        pos.set(L.x + (W[0] + L.side * W[1]) * L.drift * up + sw * W[1], 1.15 + L.rise * up, L.z + (W[1] - L.side * W[0]) * L.drift * up - sw * W[0]);
        e.set(Math.sin(a * 0.9 + L.ph) * 0.06, a * 0.1 + L.ph, Math.cos(a * 0.7 + L.ph) * 0.06); q.setFromEuler(e);
        m4.compose(pos, q, one); im.setMatrixAt(i, m4);
        aPh[i] = L.ph; aK[i] = Math.min(1, a / 1.5) * (1 - Math.max(0, Math.min(1, (a - 170) / 55)));
      });
      im.count = list.length; im.instanceMatrix.needsUpdate = true; geo.attributes.aPh.needsUpdate = true; geo.attributes.aK.needsUpdate = true;
    }
    return { release, update, get count() { return list.length; } };
  }

  function build(root, U, world) {
    const r = rng(6060);
    const sky = lanterns(root);
    /* ── on the sand: along the whole coast, chunk by chunk, drawn only close to the camera ── */
    const starTone = [[1.0, 0.42, 0.14], [0.86, 0.2, 0.12], [0.55, 0.26, 0.5], [0.8, 0.6, 0.38], [0.95, 0.55, 0.2]];
    const shellTone = [[0.95, 0.9, 0.84], [0.96, 0.78, 0.7], [0.88, 0.72, 0.52], [0.98, 0.94, 0.88], [0.8, 0.62, 0.5]];
    const protos = [
      { g: starGeo(3), n: 0, tone: starTone, s: [0.11, 0.2], kind: 'star' }, { g: starGeo(11), n: 0, tone: starTone, s: [0.1, 0.17], kind: 'star' },
      { g: scallopGeo(5), n: 0, tone: shellTone, s: [0.06, 0.11] }, { g: cowrieGeo(7), n: 0, tone: shellTone, s: [0.05, 0.08] },
      { g: conchGeo(9), n: 0, tone: shellTone, s: [0.07, 0.12] }, { g: scallopGeo(13), n: 0, tone: shellTone, s: [0.045, 0.08] }];
    const clearOf = (x, z) => Math.hypot(x - Layout.camp.x, z - Layout.camp.z) > 4.4 && Math.hypot(x - Layout.fire.x, z - Layout.fire.z) > 1.6 && Math.hypot(x - Layout.van.x, z - Layout.van.z) > 3.2 && Math.hypot(x - Layout.bottle.x, z - Layout.bottle.z) > 0.8;
    const mat = Mats.lit({ vertexColors: true, roughness: 0.5 });
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    let count = 0, shellK = 1; const shellMeshes = [], shellLive = new Map();
    /* how many shells and starfish lie out (they were scattered in random order, so the first k of each set are an even share) */
    function setShells(k) { k = Math.max(0, Math.min(1, k)); if (k === shellK) return; shellK = k; for (const im of shellMeshes) im.count = Math.round(im.userData.full * k); }
    /* laid along each chunk of the coast as it is built (and let go with it) */
    if (world) world.decorate(d => {
      const di = d.c, rs = rng(6061 + di * 101), camp = d.camp, items = [], want = Math.round(420 * world.CW / 226 * (camp ? 1 : 0.7));
      for (let i = 0, n = 0; i < want * 5 && n < want; i++) {
        const x = d.x0 + rs() * world.CW, sz = Layout.shoreMeanZ(x);
        /* most lie along the line the high water leaves, a few scattered up the beach */
        const z = sz + (rs() < 0.7 ? 1.7 + (rs() - 0.5) * 1.6 : 1 + rs() * 5.5);
        if (z > Layout.vegZ(x) - 0.4 || (camp && !clearOf(x, z)) || world.massif(x, z) > 0.0) continue;
        const k = rs() < 0.2 ? Math.floor(rs() * 2) : 2 + Math.floor(rs() * 4), Pp = protos[k];
        items.push({ x, z, k, s: Pp.s[0] + rs() * (Pp.s[1] - Pp.s[0]), ry: rs() * TAU, tilt: (rs() - 0.5) * 0.25, c: Pp.tone[Math.floor(rs() * Pp.tone.length)] }); n++;
      }
      count += items.length;
      protos.forEach((Pp, k) => {
        const L = items.filter(it => it.k === k); if (!L.length) return;
        const im = new T.InstancedMesh(Pp.g, mat, L.length);
        L.forEach((it, i) => { it.im = im; it.ii = i; e.set(it.tilt, it.ry, it.tilt * 0.6); q.setFromEuler(e); sc.setScalar(it.s); pos.set(it.x, 0.004, it.z); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); col.setRGB(...it.c); im.setColorAt(i, col); });
        im.receiveShadow = true; im.computeBoundingSphere(); im.userData.full = L.length; im.count = Math.round(L.length * shellK); shellMeshes.push(im); d.tiny.add(im);
        im.addEventListener('dispose', () => { const i = shellMeshes.indexOf(im); if (i >= 0) shellMeshes.splice(i, 1); count -= L.length; shellLive.delete(di); });
      });
      shellLive.set(di, items);
    }, 'tiny');

    /* ── shells and starfish, for picking up (inspect.js): which model each is, and how big as built (the instances here
       are scaled by it.s from a model a metre across) ── */
    const SH_KIND = ['star', 'star', 'scallop', 'cowrie', 'whelk', 'scallop'], SH_REAL = { star: 0.07, scallop: 0.07, cowrie: 0.055, whelk: 0.064 };
    const placeShell = (it, s) => { e.set(it.tilt, it.ry, it.tilt * 0.6); q.setFromEuler(e); sc.setScalar(s); pos.set(it.x, 0.004, it.z); m4.compose(pos, q, sc); it.im.setMatrixAt(it.ii, m4); it.im.instanceMatrix.needsUpdate = true; };
    function shellPickables(list, cam) {
      for (const [, items] of shellLive) for (const it of items) {
        if (it.gone || !it.im || it.ii >= it.im.count) continue;
        const dx = it.x - cam.x, dz = it.z - cam.z; if (dx * dx + dz * dz > 1200) continue;
        const kind = SH_KIND[it.k];
        list.push({ kind, x: it.x, y: 0.02, z: it.z, r: it.s * 0.75, yaw: it.ry, size: it.s / SH_REAL[kind], opts: { tone: kind === 'star' ? it.c : null, seed: 1 + Math.floor(it.ry * 1000) },
          take() { it.gone = true; placeShell(it, 0); },
          /* (put back, it lies where it lay; thrown in the sea, it is the sea's) */
          give(how) { if (how === 'back') { it.gone = false; placeShell(it, it.s); } } });
      }
    }

    /* ── leaping fish ── */
    const fg = fishGeo(), fishM = Mats.lit({ vertexColors: true, metalness: 0.5, roughness: 0.25 });
    const finM = Mats.lit({ vertexColors: true, metalness: 0.3, roughness: 0.4, side: T.DoubleSide });
    fg.tail.translate(0.46, 0, 0);     /* (hinged where it meets the body) */
    const jumps = [0, 1, 2].map(() => { const g = new T.Group(); g.add(new T.Mesh(fg.body, fishM), new T.Mesh(fg.fins, finM)); const tl = new T.Mesh(fg.tail, finM); tl.position.x = -0.46; g.add(tl); g.visible = false; root.add(g); return { g, tail: tl, on: false }; });
    let nextJump = 0;

    /* ── shoals in the shallows ── */
    const NF = 22, quad = new T.PlaneGeometry(1, 1), sg = new T.InstancedBufferGeometry();
    sg.index = quad.index; sg.setAttribute('position', quad.attributes.position); sg.setAttribute('uv', quad.attributes.uv);
    /* up to five schools; the density setting decides how many are out (three by default) */
    const NS = 5, af = new Float32Array(NS * NF * 4);
    for (let s = 0; s < NS; s++) for (let i = 0; i < NF; i++) { const k = (s * NF + i) * 4, a = r() * TAU, d = Math.sqrt(r()); af.set([s, Math.cos(a) * d * 1.9, Math.sin(a) * d * 1.1, r()], k); }
    sg.setAttribute('aFish', new T.InstancedBufferAttribute(af, 4)); sg.instanceCount = 3 * NF;
    const schools = [0, 1, 2, 3, 4].map(i => ({ x: (i - 2) * 16, s: 4 + (i % 3) * 1.5, h: 0, v: 0.7, turn: 0, k: 0 }));
    const uSchool = { value: schools.map(() => new T.Vector4()) };
    const shoalM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uSchool, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF }, Mats.coastU), vertexShader: SHOAL_VS, fragmentShader: SHOAL_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const shoal = new T.Mesh(sg, shoalM); shoal.frustumCulled = false; shoal.renderOrder = 4; root.add(shoal);
    /* the fish themselves, over their shadows */
    const fg3 = schoolFishGeo(), fs = new T.InstancedBufferGeometry(); fs.index = fg3.index;
    for (const k of ['position', 'normal', 'color', 'aT']) fs.setAttribute(k, fg3.attributes[k]);
    fs.setAttribute('aFish', sg.attributes.aFish);
    const aVis = new T.InstancedBufferAttribute(new Float32Array(NS * NF).fill(1), 1); aVis.setUsage(T.DynamicDrawUsage); fs.setAttribute('aVis', aVis);
    fs.instanceCount = sg.instanceCount;
    const fish3M = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uSchool, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF }, Mats.coastU),
      vertexShader: FISH3_VS, fragmentShader: FISH3_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const fish3 = new T.Mesh(fs, fish3M); fish3.frustumCulled = false; fish3.renderOrder = 5; root.add(fish3);
    /* where school fish i is now (FISH3_VS's own sums), for picking one up */
    function schoolPickables(list, cam) {
      const t = Mats.U.uTime.value, day = U.uDay ? U.uDay.value : 1; if (day < 0.25) return;
      for (let i = 0; i < fs.instanceCount; i++) {
        if (aVis.array[i] < 0.5) continue;
        const k = i * 4, S = schools[af[k] | 0]; if (!S || S.z === undefined || S.k < 0.3) continue;
        const ox = af[k + 1] + Math.sin(t * 0.9 + af[k + 3] * 6) * 0.35, oz = af[k + 2] + Math.sin(t * 0.6 + af[k + 3] * 4) * 0.3, c = Math.cos(S.h), sn = Math.sin(S.h);
        const x = S.x + c * ox - sn * oz, z = S.z + sn * ox + c * oz, d = Math.hypot(x - cam.x, z - cam.z); if (d > 28) continue;
        const g = Layout.shoreDZ(x), dist = (Layout.shoreZ(x) - z) / Math.sqrt(1 + g * g); if (dist < 6 || dist > 13) continue;
        const sc = 0.8 + 0.4 * (af[k + 3] * 7.7 % 1), y = -0.26 - 0.36 * (af[k + 3] * 3.3 % 1);
        list.push({ kind: 'reeffish', x, y, z, r: 0.12, yaw: -(S.h + 0.25 * Math.sin(t * 2.3 + af[k + 3] * 9)), size: sc * 0.13 / 0.11, reach: 28,
          take() { aVis.array[i] = 0; aVis.needsUpdate = true; }, give() { aVis.array[i] = 1; aVis.needsUpdate = true; } });
      }
    }

    /* ── sea turtles: two or three about the shallows near the camera, their shadows gliding slowly over the sand under
       the water, turning now and then; every minute or so one comes up to breathe, its head and the top of its shell
       breaking the surface for a few seconds, with a ring on the water ── */
    const NT = 3, tg = new T.InstancedBufferGeometry();
    tg.index = quad.index; tg.setAttribute('position', quad.attributes.position); tg.setAttribute('uv', quad.attributes.uv);
    const iT = new T.InstancedBufferAttribute(new Float32Array(NT * 4), 4), iU = new T.InstancedBufferAttribute(new Float32Array(NT * 4), 4);
    iT.setUsage(T.DynamicDrawUsage); iU.setUsage(T.DynamicDrawUsage); tg.setAttribute('iT', iT); tg.setAttribute('iU', iU); tg.instanceCount = NT;
    const lightU = { uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF };
    const turtleM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uDay: U.uDay }, lightU, Mats.coastU), vertexShader: TURTLE_VS, fragmentShader: TURTLE_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const turtleSh = new T.Mesh(tg, turtleM); turtleSh.frustumCulled = false; turtleSh.renderOrder = 4; root.add(turtleSh);
    /* every part of a model given the look through the water (UW_VS, UW_FS); uFade how much of it shows; (a stand-in for
       the parts with no picture of their own) */
    const WHITE1 = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); WHITE1.needsUpdate = true;
    const uwBase = Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uDay: U.uDay }, lightU, Mats.coastU);
    function underwater(o, uFade) {
      o.traverse(m => {
        if (!m.isMesh) return;
        const src = m.material, col = src.color ? src.color.clone() : new T.Color(1, 1, 1);
        m.material = new T.ShaderMaterial({ uniforms: Object.assign({ uCol: { value: col }, uVC: { value: src.vertexColors && m.geometry.attributes.color ? 1 : 0 }, uFade, uMap: { value: src.map || WHITE1 }, uHasMap: { value: src.map ? 1 : 0 } }, uwBase),
          vertexShader: UW_VS, fragmentShader: UW_FS, transparent: true, depthWrite: true, side: src.side ?? T.FrontSide });
        m.renderOrder = 5; m.frustumCulled = false; m.castShadow = m.receiveShadow = false;
      });
      return o;
    }
    /* how deep the water is, roughly, this far out from the line of the waves (as shallows.js reckons it) */
    const depthAt = (x, z) => { const g = Layout.shoreDZ(x), s = (Layout.shoreZ(x) - z) / Math.sqrt(1 + g * g); return Math.max(0, Math.min(4.5, 0.12 * s + 0.15)); };
    /* the turtles, whole (the same green turtle as the one picked up), and the last of them, as often as not, a spotted
       eagle ray instead: it glides a little faster, nearer the sand, and never comes up */
    const turtles = Array.from({ length: NT }, (_, i) => {
      const Tu = { x: NaN, z: 0, h: 0, v: 0.35, turn: 0, ph: r() * TAU, len: 0.75 + r() * 0.45, k: 0, up: -1e9, next: 15 + r() * 50, rang: false, ray: false, uFade: { value: 0 } };
      if (i === NT - 1 && r() < 0.6) { Tu.ray = true; Tu.v = 0.55; Tu.len = 1.1 + r() * 0.5; }
      Tu.g = underwater(Models.make(Tu.ray ? 'life/ray' : 'life/turtle'), Tu.uFade); Tu.g.visible = false; root.add(Tu.g);
      return Tu;
    });

    /* rock under the water here (a reef, or the foot of a headland), which the schools keep off */
    const rockAt = (x, z) => !!world && ((world.reefTop ? world.reefTop(x, z) > -1.3 : false) || world.massif(x, z) > 0.4);
    /* advance: t in seconds of scene time, cx the camera's x; returns splashes to show and hear */
    function update(t, dt, cx, opt = {}) {
      const out = [];
      sky.update(opt.realT ?? t);
      /* a fish jumps every so often, somewhere in front of the camera; more of them at dawn and dusk */
      if (t > nextJump && !opt.calm && (opt.fish ?? 0.5) > 0.02) {
        const j = jumps.find(f => !f.on);
        if (j) {
          const x = cx + (r() - 0.5) * 46, s = 6 + r() * 30, g = Layout.shoreDZ(x), n = Math.hypot(g, 1);
          const z = Layout.shoreZ(x) - s, dir = (r() < 0.5 ? 1 : -1), ax = 1 / n, az = g / n, sk = 0.3 * (r() - 0.5);
          Object.assign(j, { on: true, t0: t, dur: 0.75 + r() * 0.5, H: 0.45 + r() * 0.85, L: 1.4 + r() * 1.4, x0: x, z0: z, dx: (ax - sk * az) * dir, dz: (az + sk * ax) * dir, sc: 0.32 + r() * 0.22, out: false });
          j.g.scale.setScalar(j.sc); j.g.visible = true;
          out.push({ x, z, k: j.sc });
          const twilight = opt.twilight || 0;
          nextJump = t + (2.5 + r() * 9) / (1 + 1.5 * twilight) / Math.max(0.05, 2 * (opt.fish ?? 0.5));
          if (r() < 0.25) nextJump = t + 0.35 + r() * 0.3;     /* sometimes a second one right after */
        }
      }
      for (const j of jumps) {
        if (!j.on) continue;
        const u = (t - j.t0) / j.dur;
        if (u >= 1) { j.on = false; j.g.visible = false; out.push({ x: j.x0 + j.dx * j.L, z: j.z0 + j.dz * j.L, k: j.sc * 0.8 }); continue; }
        const y = 4 * j.H * u * (1 - u) - 0.12, slope = 4 * j.H * (1 - 2 * u) / j.L;
        j.g.position.set(j.x0 + j.dx * j.L * u, y, j.z0 + j.dz * j.L * u);
        j.g.rotation.set(0, Math.atan2(-j.dz, j.dx), Math.atan(slope) + 0.4 * Math.sin(u * 9) * (1 - u), 'YZX');
        j.tail.rotation.y = Math.sin(t * 30) * 0.5;
      }
      /* the shoals drift along the coast near the camera out past the surf, in water a metre or so deep (never in the
         wash at the sand's edge), turning now and then, and turning back from rock: a reef or a headland's foot */
      const nOut = Math.round(NS * Math.min(1, (opt.fish ?? 0.5) * 1.2)); sg.instanceCount = nOut * NF; fs.instanceCount = nOut * NF;
      schools.forEach((S, i) => {
        if (S.z === undefined || Math.abs(S.x - cx) > 60) {
          for (let k = 0; k < 8; k++) { S.x = cx + (r() - 0.5) * 50; S.z = Layout.shoreZ(S.x) - (7 + r() * 3.5); if (!rockAt(S.x, S.z)) break; }
          S.h = r() < 0.5 ? 0 : Math.PI; S.k = 0; S.block = false;
        }
        const g = Layout.shoreDZ(S.x), along = Math.atan2(g, 1), sd = Layout.shoreZ(S.x) - S.z;
        const sense = Math.cos(S.h - along) >= 0 ? 0 : Math.PI, toLine = Math.max(-0.6, Math.min(0.6, (sd - 8.5) * 0.2));
        const want = along + sense + (sense ? -toLine : toLine);
        S.turn += (r() - 0.5) * dt * 1.5; S.turn *= Math.pow(0.5, dt);
        S.h += (Math.atan2(Math.sin(want - S.h), Math.cos(want - S.h)) * 0.4 + S.turn) * dt;
        if (r() < dt * 0.02) S.h += Math.PI;
        { const ahead = rockAt(S.x + Math.cos(S.h) * 3, S.z + Math.sin(S.h) * 3); if (ahead && !S.block) S.h += Math.PI; S.block = ahead; }
        S.x += Math.cos(S.h) * S.v * dt; S.z += Math.sin(S.h) * S.v * dt;
        S.k = Math.min(1, S.k + dt * 0.3);
        if (i >= nOut) S.k = 0;       /* a school called back in fades in */
        uSchool.value[i].set(S.x, S.z, S.h, S.k * (opt.day ?? 1));
      });
      /* the turtles: in among the shallows a few metres out, keeping to their depth, turning slowly; up to breathe now
         and then (by day: their shadows need the sun) */
      const nTu = Math.round(NT * Math.min(1, (opt.fish ?? 0.5) * 1.6));
      turtles.forEach((Tu, i) => {
        const q = i * 4;
        /* (one picked up, or in the air: neither it nor its shadow here) */
        if (Tu.held) { Tu.g.visible = false; iT.array[q + 3] = 0; return; }
        if (i >= nTu) { Tu.k = Math.max(0, Tu.k - dt * 0.5); if (Tu.k <= 0) { Tu.x = NaN; Tu.g.visible = false; } }
        if (Tu.x !== Tu.x || Math.abs(Tu.x - cx) > 70) { if (i >= nTu) { iT.array[q + 3] = 0; return; } Tu.x = cx + (r() - 0.5) * 70; Tu.z = Layout.shoreZ(Tu.x) - (4 + r() * 9); Tu.h = r() * TAU; Tu.k = 0; }
        const g = Layout.shoreDZ(Tu.x), along = Math.atan2(g, 1), sd = Layout.shoreZ(Tu.x) - Tu.z, keep = Math.max(-0.8, Math.min(0.8, (sd - 8) * 0.12));
        Tu.turn += (r() - 0.5) * dt * 0.8; Tu.turn *= Math.pow(0.6, dt);
        const sense = Math.cos(Tu.h - along) >= 0 ? 0 : Math.PI, want = along + sense + (sense ? -keep : keep);
        Tu.h += (Math.atan2(Math.sin(want - Tu.h), Math.cos(want - Tu.h)) * 0.08 + Tu.turn) * dt;
        Tu.x += Math.cos(Tu.h) * Tu.v * dt; Tu.z += Math.sin(Tu.h) * Tu.v * dt; Tu.ph += dt * 1.7;
        if (i < nTu) Tu.k = Math.min(1, Tu.k + dt * 0.3);
        /* up for a breath: 1 s rising, 4 s at the surface, 1 s going back down */
        if (t > Tu.next && i < nTu && (opt.day ?? 1) > 0.2 && !Tu.ray) { Tu.up = t; Tu.next = t + 45 + r() * 90; Tu.rang = false; }
        const e = t - Tu.up, at = e >= 0 && e < 6 ? Math.min(1, e, 6 - e) : 0;
        if (at > 0 && !Tu.rang) { Tu.rang = true; out.push({ x: Tu.x + Math.cos(Tu.h) * 0.4 * Tu.len, z: Tu.z + Math.sin(Tu.h) * 0.4 * Tu.len, k: 0.12 }); }
        /* the animal itself, through the water: mid-water over the sand (a ray low, just above it), rising for a breath
           until the top of its shell and its head clear the surface; rowing (or beating its wings) as it goes */
        const bed = depthAt(Tu.x, Tu.z), swim = Tu.ray ? -Math.max(0.25, bed - 0.2) : -Math.min(0.75, Math.max(0.34, bed * 0.55)), y = swim + (-0.07 * Tu.len - swim) * at;
        Tu.g.visible = Tu.k > 0.01; Tu.uFade.value = Tu.k;
        if (Tu.g.visible) {
          /* (and the swell passing over lifts it and carries it a little way in and back, the more the nearer the top) */
          const hw = Engine.waveAt ? Engine.waveAt(Tu.x, Tu.z) : 0, kw = 0.45 + 0.55 * at, gw = Layout.shoreDZ(Tu.x), nw = Math.hypot(gw, 1);
          Tu.g.position.set(Tu.x - gw / nw * 0.8 * hw * kw, y + hw * kw, Tu.z + 0.8 * hw * kw / nw); Tu.g.rotation.set(0, -Tu.h, (Tu.ray ? 0.05 : 0.07) * Math.sin(Tu.ph * 0.5) + (Tu.ray ? 0 : 0.12 * Math.sin(Math.PI * at)), 'YXZ');
          Tu.g.scale.setScalar(Tu.ray ? Tu.len / 1.3 : Tu.len);
          Tu.g.userData.anim && Tu.g.userData.anim(Tu.ray ? Tu.ph * 1.1 : Tu.ph * 0.75);
        }
        iT.array[q] = Tu.x; iT.array[q + 1] = Tu.z; iT.array[q + 2] = Tu.h; iT.array[q + 3] = Tu.k * (1 - 0.7 * at) * (opt.day ?? 1);
        iU.array[q] = Tu.ph; iU.array[q + 1] = Tu.len; iU.array[q + 2] = Tu.ray ? 1 : 0; iU.array[q + 3] = y;
      });
      iT.needsUpdate = iU.needsUpdate = true;
      return out;
    }
    /* turtles (and the ray) in the shallows and fish in mid-leap, for picking up (inspect.js); thrown back, a turtle swims
       on from where it went in */
    function swimPickables(list, cam) {
      for (const Tu of turtles) {
        if (!Tu.g.visible || Tu.held) continue;
        const sc = Tu.ray ? Tu.len / 1.3 : Tu.len;
        list.push({ kind: Tu.ray ? 'ray' : 'turtle', x: Tu.g.position.x, y: Tu.g.position.y + (Tu.ray ? 0.03 : 0.1) * sc, z: Tu.g.position.z, r: (Tu.ray ? 0.45 : 0.42) * sc, yaw: -Tu.h, size: sc, reach: 45,   /* (the same model as swims here, at the size it swims) */
          take() { Tu.held = true; Tu.g.visible = false; },
          give(how, p) { Tu.held = false; if (how !== 'back' && p) { Tu.x = p.x; Tu.z = Math.min(p.z, Layout.shoreZ(p.x) - 3); } Tu.up = -1e9; } });
      }
      for (const j of jumps) {
        if (!j.on) continue;
        list.push({ kind: 'fish', x: j.g.position.x, y: j.g.position.y, z: j.g.position.z, r: 0.35 * j.sc, yaw: Math.atan2(-j.dz, j.dx), size: j.sc / 0.375, reach: 40,
          take() { j.on = false; j.g.visible = false; }, give() {} });
      }
    }
    const turtleAt = (x, i = 0) => { const Tu = turtles[i]; Tu.x = x; Tu.z = Layout.shoreZ(x) - 6; Tu.h = 0; Tu.k = 1; return Tu; };
    return { update, get count() { return count; }, schools, jumps, turtles, turtleAt, setShells, pickables: (list, cam) => { shellPickables(list, cam); swimPickables(list, cam); schoolPickables(list, cam); }, lantern: (x, z, t) => sky.release(x, z, t), get lanterns() { return sky.count; } };
  }
  return { build };
})();
