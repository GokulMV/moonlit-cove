/* ─────────────────────────────────────────────────────────────
   life.js — small lives on the shore: starfish and shells along
   the strand line, fish that leap clear of the water now and then
   with a splash, schools of small fish that show as shadows in the
   clear shallows by day, and sea turtles gliding over the sand under
   them, coming up now and then to breathe. And sky lanterns, released
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
  /* starfish: five tapering arms, domed and knobbly, paler at the tips (radius 1) */
  function starGeo(seed) {
    const r = rng(seed), tw = (r() - 0.5) * 0.25;
    const rad = th => 0.28 + 0.72 * Math.pow(Math.abs(Math.cos(2.5 * (th + tw * Math.sin(th * 3)))), 1.5);
    return sheet(40, 4, (u, v) => {
      const th = u * TAU, R = rad(th) * (0.94 + 0.08 * Math.sin(th * 2 + seed)), q = v, rho = q * R;
      const knob = 0.5 + 0.5 * Math.sin(th * 15) * Math.sin(q * 9);
      const h = 0.15 * Math.pow(1 - q, 0.75) * (0.55 + 0.45 * R) + 0.012 * knob * (1 - q);
      const tip = Math.pow(q, 3) * R, k = (0.85 + 0.2 * knob) * (1 + 0.35 * tip);
      return [[Math.cos(th) * rho, h, Math.sin(th) * rho], [k, k, k]];
    }, true);
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

  /* a sergeant major for the schools: deep-bodied and flat, silver with a yellow back and five black bars; its tail and
     a long dorsal fin; aT 0 at its nose to 1 at the tip of its tail (how much it bends as it swims). 13 cm long, its nose
     toward +x */
  function schoolFishGeo() {
    const M = Models, yellow = [0.86, 0.6, 0.12], silver = [0.74, 0.79, 0.82], black = [0.02, 0.022, 0.025];
    const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const body = M.loft([[-0.05, 0, 0, 0, 2], [-0.04, 0.006, 0.014, 0, 2], [-0.01, 0.011, 0.032, 0.002, 2], [0.02, 0.012, 0.031, 0.002, 2], [0.045, 0.008, 0.018, 0, 2], [0.06, 0, 0, -0.002, 2]], 16, 12,
      (x, y, z, u, a) => { const up = Math.cos(a), bar = [0.03, 0.012, -0.006, -0.024, -0.04].some(b => Math.abs(x - b) < 0.0045); const c = silver.map((v, i) => v + (yellow[i] - v) * sm(0.15, 0.7, up)); return bar && up > -0.5 ? black : c; });
    const fin = (pts, col) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); return M.paint(g, () => col); };
    const tail = fin([[-0.048, 0.004, 0], [-0.075, 0.022, 0], [-0.066, 0, 0], [-0.048, -0.004, 0], [-0.066, 0, 0], [-0.075, -0.022, 0]], yellow.map(v => v * 0.9));
    const dors = fin([[0.03, 0.028, 0], [-0.03, 0.03, 0], [0.0, 0.042, 0], [-0.03, 0.03, 0], [-0.045, 0.02, 0], [-0.035, 0.033, 0]], yellow.map(v => v * 0.8));
    const g = M.mergeC([{ geo: body }, { geo: tail }, { geo: dors }]), P = g.attributes.position, aT = new Float32Array(P.count);
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

  /* shadows of small fish in the shallows, drawn on the water's surface */
  const SHOAL_VS = `
${GLSL.WAVEH}
uniform vec4 uSchool[5]; uniform float uTime;
attribute vec4 aFish;   /* school, along, across, phase */
varying vec2 vUv; varying float vA;
void main(){
  vUv = uv;
  vec4 S = uSchool[int(aFish.x)];
  float hd = S.z, c = cos(hd), s = sin(hd);
  vec2 off = vec2(aFish.y, aFish.z) + vec2(sin(uTime*0.9 + aFish.w*6.0)*0.35, sin(uTime*0.6 + aFish.w*4.0)*0.3);
  vec2 p = S.xy + vec2(c*off.x - s*off.y, s*off.x + c*off.y);
  float yaw = hd + 0.25*sin(uTime*2.3 + aFish.w*9.0);
  vec2 q = (uv - 0.5)*vec2(0.5, 0.15)*(0.8 + 0.4*fract(aFish.w*7.7));
  vec2 w = vec2(cos(yaw)*q.x - sin(yaw)*q.y, sin(yaw)*q.x + cos(yaw)*q.y);
  vec3 wp = vec3(p.x + w.x, 0.0, p.y + w.y);
  wp.y = waveH(wp.xz) + 0.025;
  float g = shoreDZv(p.x), dist = (shoreZv(p.x) - p.y)/sqrt(1.0 + g*g);
  vA = S.w*smoothstep(0.8, 1.8, dist)*smoothstep(8.0, 5.0, dist);
  gl_Position = projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`;
  const SHOAL_FS = `
uniform float uDay; varying vec2 vUv; varying float vA;
void main(){
  vec2 q = vUv*2.0 - 1.0;
  float body = 1.0 - smoothstep(0.75, 1.0, length(vec2(q.x*1.05 + 0.1, q.y*(1.4 + 0.9*max(q.x, 0.0)))));
  float tail = step(q.x, -0.72)*(1.0 - smoothstep(0.1, 0.9, abs(q.y)*1.6 - (-0.72 - q.x)*2.0));
  float a = max(body, tail*0.8)*vA*uDay*0.32;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.004, 0.018, 0.022, a);
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
  vec3 w = vec3(pc.x + cy*p.x - sy*p.z, -0.2 - 0.32*fract(aFish.w*3.3) + p.y, pc.y + sy*p.x + cy*p.z);
  vN = vec3(cy*n.x - sy*n.z, n.y, sy*n.x + cy*n.z); vC = color; vW = w;
  float hs = waveH(w.xz);
  vDepth = max(0.0, hs - w.y);
  float g = shoreDZv(pc.x), dist = (shoreZv(pc.x) - pc.y)/sqrt(1.0 + g*g);
  vA = S.w*smoothstep(0.8, 1.8, dist)*smoothstep(8.0, 5.0, dist)*step(0.01, sc);
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

  /* sea turtles' shadows on the sand under the shallows: a shell, a head, the long front flippers rowing and the short
     back ones, each turtle drawn in its own frame on the water's surface */
  const TURTLE_VS = `
${GLSL.WAVEH}
attribute vec4 iT;   /* x, z, heading, how much it shows */
attribute vec4 iU;   /* flipper stroke phase, length, which (0 a turtle, 1 a ray) */
varying vec2 vUv; varying float vA; varying float vPh; varying float vKind;
void main(){
  vUv = uv; vPh = iU.x; vA = iT.w; vKind = iU.z;
  float c = cos(iT.z), s = sin(iT.z);
  vec2 q = (uv - 0.5)*iU.y*1.5, w = vec2(c*q.x - s*q.y, s*q.x + c*q.y);
  vec3 wp = vec3(iT.x + w.x, 0.0, iT.y + w.y);
  wp.y = waveH(wp.xz) + 0.03;
  gl_Position = vA < 0.01 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*viewMatrix*vec4(wp, 1.0);
}`;
  const TURTLE_FS = `
uniform float uDay; varying vec2 vUv; varying float vA; varying float vPh; varying float vKind;
float ell(vec2 p, vec2 c, vec2 r, float a){ p -= c; float cs = cos(a), sn = sin(a); p = vec2(cs*p.x + sn*p.y, -sn*p.x + cs*p.y); return length(p/r); }
void main(){
  vec2 p = (vUv - 0.5)*1.5;
  if (vKind > 0.5){
    /* a ray: a broad diamond of a body, its wing tips rippling, a long thin tail */
    float w = 0.5 + 0.035*sin(vPh*1.3 - abs(p.y)*9.0), dia = abs(p.x - 0.05)/0.36 + abs(p.y)/w;
    float m = 1.0 - smoothstep(0.85, 1.0, dia + 0.25*smoothstep(0.1, 0.36, p.x)*(1.0 - smoothstep(0.0, 0.1, abs(p.y))));
    m = max(m, (1.0 - smoothstep(0.006, 0.014, abs(p.y + 0.02*sin(vPh + p.x*6.0))))*step(-0.72, p.x)*step(p.x, -0.25));
    float al = m*vA*uDay*0.5;
    if (al < 0.01) discard;
    gl_FragColor = vec4(0.004, 0.016, 0.02, al); return;
  }
  float m = 1.0 - smoothstep(0.82, 1.0, ell(p, vec2(-0.02, 0.0), vec2(0.4, 0.31), 0.0));
  m = max(m, 1.0 - smoothstep(0.75, 1.0, ell(p, vec2(0.46, 0.0), vec2(0.12, 0.085), 0.0)));
  for (int k = 0; k < 2; k++){
    float sd = k == 0 ? -1.0 : 1.0, a = sd*(1.85 + 0.55*sin(vPh)), b = sd*(2.55 + 0.2*sin(vPh + 1.6));
    vec2 sh = vec2(0.17, sd*0.25), hip = vec2(-0.32, sd*0.15);
    m = max(m, 1.0 - smoothstep(0.7, 1.0, ell(p, sh + 0.17*vec2(cos(a), sin(a)), vec2(0.2, 0.055), a)));
    m = max(m, 1.0 - smoothstep(0.7, 1.0, ell(p, hip + 0.07*vec2(cos(b), sin(b)), vec2(0.09, 0.05), b)));
  }
  float al = m*vA*uDay*0.55;
  if (al < 0.01) discard;
  gl_FragColor = vec4(0.004, 0.018, 0.022, al);
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
        const x = d.x0 + rs() * world.CW, sz = Layout.shoreZ(x);
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
    const shoalM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uSchool }, Mats.coastU), vertexShader: SHOAL_VS, fragmentShader: SHOAL_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
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
        const g = Layout.shoreDZ(x), dist = (Layout.shoreZ(x) - z) / Math.sqrt(1 + g * g); if (dist < 1.2 || dist > 7) continue;
        const sc = 0.8 + 0.4 * (af[k + 3] * 7.7 % 1), y = -0.2 - 0.32 * (af[k + 3] * 3.3 % 1);
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
    const turtleM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uDay: U.uDay }, Mats.coastU), vertexShader: TURTLE_VS, fragmentShader: TURTLE_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const turtleSh = new T.Mesh(tg, turtleM); turtleSh.frustumCulled = false; turtleSh.renderOrder = 4; root.add(turtleSh);
    /* the head and the top of the shell, for when one comes up: an olive-brown dome plated with scutes (a row down the
       middle, four either side, small ones round the rim, dark seams between, each paler at its middle), and a blunt,
       scaly head */
    const shellG = new T.SphereGeometry(1, 56, 18, 0, TAU, 0, Math.PI / 2); shellG.scale(0.44, 0.17, 0.35);
    {
      const C = [[0.3, 0], [0.15, 0], [0, 0], [-0.15, 0], [-0.3, 0]];
      for (const sd of [-1, 1]) for (const x of [0.22, 0.07, -0.08, -0.23]) C.push([x, sd * 0.19]);
      for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; C.push([Math.cos(a) * 0.42, Math.sin(a) * 0.33]); }
      const tone = C.map(() => 0.85 + 0.3 * r()), pa = shellG.attributes.position, col = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), z = pa.getZ(i); let d1 = 9, d2 = 9, k1 = 0;
        C.forEach(([cx, cz], k) => { const d = Math.hypot(x - cx, (z - cz) * 1.1); if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d; });
        const seam = Math.min(1, (d2 - d1) / 0.025), g = tone[k1] * (0.82 + 0.22 * Math.exp(-d1 * 14)) * (0.55 + 0.45 * seam);
        col.set([0.15 * g, 0.135 * g, 0.085 * g], i * 3);
      }
      shellG.setAttribute('color', new T.BufferAttribute(col, 3));
    }
    const shellM = Mats.lit({ vertexColors: true, roughness: 0.42 }, 'rock'), headM = Mats.lit({ color: new T.Color('#67624a'), roughness: 0.5 }, 'rock');
    const eyeM = Mats.lit({ color: new T.Color('#0b0a08'), roughness: 0.15 }), beakM = Mats.lit({ color: new T.Color('#3b3526'), roughness: 0.4 }), flipM = Mats.lit({ color: new T.Color('#57523c'), roughness: 0.5 }, 'rock');
    const headG = new T.SphereGeometry(1, 14, 10); headG.scale(0.13, 0.085, 0.08);
    const eyeG = new T.SphereGeometry(0.018, 8, 6), beakG = new T.ConeGeometry(0.035, 0.07, 8); beakG.rotateZ(-Math.PI / 2);
    /* a front flipper: long, flat and curved back, rowing just under the surface */
    const finG = new T.SphereGeometry(1, 12, 6); finG.scale(0.24, 0.025, 0.07); finG.translate(0.2, 0, 0);
    const turtles = Array.from({ length: NT }, () => { const g = new T.Group(), sh = new T.Mesh(shellG, shellM), hd = new T.Mesh(headG, headM); hd.position.set(0.5, 0.07, 0); hd.rotation.z = 0.5;
      /* eyes either side of the head, a hooked beak at its tip */
      for (const sd of [-1, 1]) { const ey = new T.Mesh(eyeG, eyeM); ey.position.set(0.045, 0.028, sd * 0.062); hd.add(ey); }
      const bk = new T.Mesh(beakG, beakM); bk.position.set(0.12, -0.012, 0); bk.scale.set(1, 0.8, 1.1); hd.add(bk);
      const fins = [-1, 1].map(sd => { const f = new T.Mesh(finG, flipM); f.position.set(0.2, -0.04, sd * 0.28); f.userData.sd = sd; g.add(f); return f; });
      g.add(sh, hd); g.visible = false; root.add(g); g.userData.fins = fins;
      return { g, x: NaN, z: 0, h: 0, v: 0.35, turn: 0, ph: r() * TAU, len: 0.75 + r() * 0.45, k: 0, up: -1e9, next: 15 + r() * 50, rang: false, ray: false }; });
    /* (the last of them is a ray, as often as not: it glides a little faster, nearer the sand, and never comes up) */
    turtles[NT - 1].ray = r() < 0.6; if (turtles[NT - 1].ray) { turtles[NT - 1].v = 0.55; turtles[NT - 1].len = 1.1 + r() * 0.5; }

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
      /* the shoals drift along the shallows near the camera, keeping to a few metres out, turning now and then */
      const nOut = Math.round(NS * Math.min(1, (opt.fish ?? 0.5) * 1.2)); sg.instanceCount = nOut * NF; fs.instanceCount = nOut * NF;
      schools.forEach((S, i) => {
        if (S.z === undefined || Math.abs(S.x - cx) > 60) { S.x = cx + (r() - 0.5) * 50; S.z = Layout.shoreZ(S.x) - (2 + r() * 3.5); S.h = r() < 0.5 ? 0 : Math.PI; S.k = 0; }
        const g = Layout.shoreDZ(S.x), along = Math.atan2(g, 1), sd = Layout.shoreZ(S.x) - S.z;
        const sense = Math.cos(S.h - along) >= 0 ? 0 : Math.PI, toLine = Math.max(-0.6, Math.min(0.6, (sd - 3.6) * 0.2));
        const want = along + sense + (sense ? -toLine : toLine);
        S.turn += (r() - 0.5) * dt * 1.5; S.turn *= Math.pow(0.5, dt);
        S.h += (Math.atan2(Math.sin(want - S.h), Math.cos(want - S.h)) * 0.4 + S.turn) * dt;
        if (r() < dt * 0.02) S.h += Math.PI;
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
        /* (only the top of the shell and the head clear the water) */
        Tu.g.visible = at > 0; if (at > 0) { Tu.g.position.set(Tu.x, -0.3 * Tu.len + 0.21 * Tu.len * at, Tu.z); Tu.g.rotation.set(0, -Tu.h, 0.08); Tu.g.scale.setScalar(Tu.len);
          /* (the front flippers row slowly, out and back) */
          for (const f of Tu.g.userData.fins) { const sd = f.userData.sd; f.rotation.set(0, -sd * (0.9 + 0.35 * Math.sin(Tu.ph)), sd * 0.15 * Math.cos(Tu.ph)); } }
        iT.array[q] = Tu.x; iT.array[q + 1] = Tu.z; iT.array[q + 2] = Tu.h; iT.array[q + 3] = Tu.k * (1 - 0.7 * at) * (opt.day ?? 1);
        iU.array[q] = Tu.ph; iU.array[q + 1] = Tu.len; iU.array[q + 2] = Tu.ray ? 1 : 0;
      });
      iT.needsUpdate = iU.needsUpdate = true;
      return out;
    }
    /* turtles at the surface and fish in mid-leap, for picking up (inspect.js); thrown back, a turtle swims on from where
       it went in */
    function swimPickables(list, cam) {
      for (const Tu of turtles) {
        if (!Tu.g.visible || Tu.held || Tu.ray) continue;
        list.push({ kind: 'turtle', x: Tu.g.position.x, y: Tu.g.position.y + 0.1 * Tu.len, z: Tu.g.position.z, r: 0.42 * Tu.len, yaw: -Tu.h, size: 1.1 * Tu.len, reach: 45,
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
