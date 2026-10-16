/* ─────────────────────────────────────────────────────────────
   spray.js — water thrown up: the drops off the van's tyres as it
   drives through the shallows, the sheet its front pushes ahead of
   it, the mist that hangs a moment after, and the splash of a foot
   coming down in the water. Each drop is thrown and flies on its
   own, under gravity and the air's drag (a fine mist slows at once,
   a big drop hardly at all), drawn as a small lit bead of water
   stretched along the way it moves (as the eye smears a fast drop),
   catching the sun on one side; it is gone when it falls back into
   the sea. Worked out on the GPU from when and where and how fast
   each was thrown, so a thousand cost nothing to move.
   ───────────────────────────────────────────────────────────── */
const Spray = (() => {
  const T = THREE;
  const VS = `
attribute vec4 aA;   /* where it was thrown from, and when */
attribute vec4 aB;   /* how fast, and how long it lasts */
attribute vec4 aC;   /* its size, its kind (0 a drop, 1 mist, 2 a sheet of water torn into ribbons), a die, the air's drag on it */
uniform float uT, uBlur, uWL;
varying vec2 vUv; varying float vA, vK, vS; varying vec3 vW, vV;
void main(){
  float age = uT - aA.w, life = aB.w;
  if (age < 0.0 || age > life){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float k = max(aC.w, 0.02), ek = exp(-k*age);
  vec3 vT = vec3(0.0, -9.81/k, 0.0), v0 = aB.xyz;
  vec3 p = aA.xyz + vT*age + (v0 - vT)*(1.0 - ek)/k, vel = vT + (v0 - vT)*ek;
  /* (back in the sea: gone, the moment it is under its top) */
  float wet = smoothstep(uWL - 0.02, uWL + 0.03, p.y);
  if (wet <= 0.0 && vel.y < 0.0){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float u = age/life, kind = aC.y;
  float sz = aC.x*(kind > 0.5 && kind < 1.5 ? 0.6 + 1.6*sqrt(u) : kind > 1.5 ? 1.0 + 0.8*u : 1.0 - 0.3*u);
  vec4 cp = viewMatrix*vec4(p, 1.0);
  /* (never smaller than a pixel or two: a drop that small is a glint, fainter rather than gone) */
  float dist = max(-cp.z, 0.1), smin = 0.0026*dist, fa = 1.0;
  if (kind < 0.5 && sz < smin){ fa = max(0.35, (sz*sz)/(smin*smin)); sz = smin; }
  /* (stretched along the way it goes, by how far it moves while the eye takes it in) */
  vec3 vv = mat3(viewMatrix)*vel; vec2 d = vv.xy/dist; float sp = length(d);
  vec2 ax = sp > 1e-5 ? d/sp : vec2(1.0, 0.0), ay = vec2(-ax.y, ax.x);
  float st = kind > 0.5 && kind < 1.5 ? 0.0 : clamp(length(vv.xy)*uBlur/sz, 0.0, kind > 1.5 ? 3.0 : 9.0);
  cp.xy += ax*position.x*sz*(1.0 + st) + ay*position.y*sz*(kind > 1.5 ? 0.45 : 1.0);
  gl_Position = projectionMatrix*cp;
  vUv = position.xy*2.0; vK = kind; vS = st; vW = p; vV = normalize(vel + vec3(0.0, 1e-4, 0.0));
  vA = (kind > 0.5 && kind < 1.5 ? (1.0 - smoothstep(0.35, 1.0, u))*smoothstep(0.0, 0.08, u) : kind > 1.5 ? (1.0 - smoothstep(0.3, 1.0, u)) : 1.0 - smoothstep(0.75, 1.0, u))*wet*fa;
}`;
  const FS = `
uniform vec3 uAmb, uKeyDir, uKeyCol; uniform vec4 uFog;
varying vec2 vUv; varying float vA, vK, vS; varying vec3 vW, vV;
void main(){
  float r2 = dot(vUv, vUv); if (r2 > 1.0) discard;
  vec3 V = normalize(cameraPosition - vW), L = normalize(uKeyDir);
  vec3 c; float a;
  if (vK > 1.5){
    /* a sheet torn off the water: a thin ribbon, bright where the light comes through it, its edges frayed */
    float m = (1.0 - r2); m = m*m*(0.75 + 0.25*sin(vUv.x*9.0 + vUv.y*5.0));
    c = (uAmb*1.6 + uKeyCol*0.45)*vec3(0.88, 0.95, 1.0) + uKeyCol*0.5*pow(max(dot(-V, L), 0.0), 3.0);
    a = m*0.5*vA;
  } else if (vK > 0.5){
    /* mist: a soft puff, white, lit through */
    float m = (1.0 - r2); m *= m;
    c = uAmb*1.3 + uKeyCol*(0.6 + 0.5*pow(max(dot(-V, L), 0.0), 4.0));
    a = m*0.3*vA;
  } else {
    /* a drop: a bead of water, its edge darker where it bends the light away, a glint where the sun is caught, the sky
       through it */
    vec3 n = normalize(vec3(vUv.x, vUv.y, sqrt(max(1.0 - r2, 0.0))));
    float rim = pow(r2, 1.5), glint = pow(max(1.0 - length(vUv - vec2(-0.32, 0.38))*1.9, 0.0), 6.0);
    c = (uAmb*1.9 + uKeyCol*0.3)*mix(vec3(0.92, 0.96, 1.0), vec3(0.55, 0.66, 0.72), rim) + uKeyCol*glint*2.6;
    /* (a streak, thinner and fainter for its length) */
    a = (0.86 - 0.35*rim)*vA/(1.0 + 0.22*vS);
  }
  float d = distance(vW, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  gl_FragColor = vec4(c*a, a);
}`;
  function build(scene, o = {}) {
    const N = o.max || 4096, quad = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
    g.setIndex(quad.index); g.setAttribute('position', quad.attributes.position);
    const A = new Float32Array(N * 4).fill(-1e9), B = new Float32Array(N * 4), C = new Float32Array(N * 4);
    const aA = new T.InstancedBufferAttribute(A, 4), aB = new T.InstancedBufferAttribute(B, 4), aC = new T.InstancedBufferAttribute(C, 4);
    for (const a of [aA, aB, aC]) a.setUsage(T.DynamicDrawUsage);
    g.setAttribute('aA', aA); g.setAttribute('aB', aB); g.setAttribute('aC', aC); g.instanceCount = N;
    const U = Mats.U, mat = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor,
      uniforms: { uT: { value: 0 }, uBlur: { value: 1 / 60 }, uWL: { value: 0 }, uAmb: U.uAmbF || { value: new T.Vector3(0.3, 0.3, 0.3) }, uKeyDir: U.uKeyDirT || { value: new T.Vector3(0, 1, 0) }, uKeyCol: U.uKeyColT || { value: new T.Vector3(1, 1, 1) }, uFog: U.uFog } });
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 7; scene.add(mesh);
    let head = 0, lo = N, hi = -1, now = 0;
    const rnd = Math.random;
    /* one thrown: from (x, y, z), velocity (vx, vy, vz), lasting life s; size m; mist or a drop; drag */
    function emit(x, y, z, vx, vy, vz, life, size, mist, drag) {
      const i = head; head = (head + 1) % N;
      A[i * 4] = x; A[i * 4 + 1] = y; A[i * 4 + 2] = z; A[i * 4 + 3] = now;
      B[i * 4] = vx; B[i * 4 + 1] = vy; B[i * 4 + 2] = vz; B[i * 4 + 3] = life;
      C[i * 4] = size; C[i * 4 + 1] = mist === 2 ? 2 : mist ? 1 : 0; C[i * 4 + 2] = rnd(); C[i * 4 + 3] = drag;
      lo = Math.min(lo, i); hi = Math.max(hi, i);
    }
    /* a foot coming down in the water, depth d: a ring of drops flung up and out, a little mist */
    function foot(x, z, d, wl = 0) {
      const k1 = Math.min(1, d / 0.3), n = Math.round(30 + 70 * k1);
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, out = 0.3 + 1.0 * rnd(), up = 0.8 + 1.7 * rnd() * (0.5 + k1);
        emit(x + Math.cos(a) * 0.09, wl + 0.02, z + Math.sin(a) * 0.09, Math.cos(a) * out, up, Math.sin(a) * out, 0.5 + 0.5 * rnd(), 0.008 + 0.022 * rnd() * rnd(), false, 0.3);
      }
      /* (the crown: a ring of sheets thrown up round the foot, tearing as they go) */
      for (let k = 0, m = Math.round(8 + 10 * k1); k < m; k++) { const a = (k + rnd() * 0.6) / m * Math.PI * 2, out = 0.35 + 0.4 * rnd(); emit(x + Math.cos(a) * 0.1, wl + 0.02, z + Math.sin(a) * 0.1, Math.cos(a) * out, 0.9 + 0.7 * rnd() * (0.4 + k1), Math.sin(a) * out, 0.32 + 0.2 * rnd(), 0.05 + 0.05 * rnd(), 2, 1.2); }
      for (let k = 0; k < 3; k++) emit(x, wl + 0.05, z, (rnd() - 0.5) * 0.4, 0.3 + 0.3 * rnd(), (rnd() - 0.5) * 0.4, 0.9 + 0.5 * rnd(), 0.14 + 0.14 * rnd(), true, 3);
    }
    /* a wheel of the van ploughing through the water at speed v along (fx, fz): thrown out sideways (side, ±1, along
       (-fz, fx)) and up off the tyre, back from it, and some of it on ahead; d how deep the water is there; dt the frame */
    const acc = [0, 0, 0, 0, 0];
    function wheel(i, x, z, fx, fz, v, side, d, dt, wl = 0, front = false) {
      const sp = Math.abs(v); if (sp < 0.3) return;
      const k = Math.min(1, d / 0.12 + 0.25);
      acc[i] += dt * sp * 60 * k;
      const sx = -fz * side, sz = fx * side, dir = Math.sign(v) || 1;
      while (acc[i] >= 1) {
        acc[i] -= 1;
        const u = rnd(), out = (0.5 + 0.28 * sp) * (0.4 + 0.9 * rnd()), up = (0.8 + 0.3 * sp) * (0.5 + 0.9 * rnd()) * (0.6 + 0.4 * k), back = -dir * sp * (0.15 + 0.35 * rnd());
        /* (off the tread's edge, a little behind the wheel's middle) */
        const ox = x + sx * (0.12 + 0.05 * rnd()) - fx * dir * 0.15 * rnd(), oz = z + sz * (0.12 + 0.05 * rnd()) - fz * dir * 0.15 * rnd();
        if (u < 0.07) emit(ox, wl + 0.08, oz, sx * out * 0.5 + fx * back * 0.4, up * 0.45, sz * out * 0.5 + fz * back * 0.4, 1.0 + 0.7 * rnd(), 0.3 + 0.45 * rnd(), true, 2.6);
        else if (u < 0.3) emit(ox, wl + 0.03, oz, sx * out * 0.9 + fx * back, up * 0.85, sz * out * 0.9 + fz * back, 0.35 + 0.25 * rnd(), 0.07 + 0.1 * rnd(), 2, 1.1);
        else emit(ox, wl + 0.03, oz, sx * out + fx * back, up, sz * out + fz * back, 0.7 + 0.5 * rnd(), 0.009 + 0.028 * rnd() * rnd(), false, 0.35 + 0.4 * rnd());
      }
      /* (the front wheels push a sheet on ahead and to either side when the water is deep enough) */
      if (front && d > 0.05) {
        acc[4] += dt * sp * 22 * Math.min(1, d / 0.2);
        while (acc[4] >= 1) { acc[4] -= 1; const sd = rnd() < 0.5 ? -1 : 1, a = 0.25 + 0.5 * rnd(), vx2 = fx * dir * sp * (0.6 + 0.4 * rnd()) + (-fz) * sd * sp * a, vz2 = fz * dir * sp * (0.6 + 0.4 * rnd()) + fx * sd * sp * a;
          emit(x + fx * dir * 0.45, wl + 0.02, z + fz * dir * 0.45, vx2, 0.6 + 0.5 * sp * rnd() * 0.3, vz2, 0.5 + 0.4 * rnd(), 0.006 + 0.012 * rnd(), false, 0.6); }
      }
    }
    function update(t, o2 = {}) {
      now = t; mat.uniforms.uT.value = t; if (o2.blur) mat.uniforms.uBlur.value = o2.blur;
      if (hi >= lo) {
        for (const a of [aA, aB, aC]) { a.clearUpdateRanges(); a.addUpdateRange(lo * 4, (hi - lo + 1) * 4); a.needsUpdate = true; }
        lo = N; hi = -1;
      }
    }
    /* (the beach's loop: what is in the air near the eye goes round with it) */
    function shift(d) { for (let i = 0; i < N; i++) A[i * 4] += d; aA.clearUpdateRanges(); aA.needsUpdate = true; }
    return { emit, foot, wheel, update, shift, mesh };
  }
  return { build };
})();
