/* ─────────────────────────────────────────────────────────────
   life.js — small lives on the shore: starfish and shells along
   the strand line, fish that leap clear of the water now and then
   with a splash, and schools of small fish that show as shadows in
   the clear shallows by day. And sky lanterns, released from the
   camp, rising out over the sea.
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

  /* fish: a slim silver body with a forked tail (length 1, nose toward +x) */
  function fishGeo() {
    const body = sheet(14, 10, (u, v) => {
      const a = u * TAU, x = v - 0.5, w = Math.sin(Math.PI * Math.min(1, v * 1.08)) * (v < 0.85 ? 1 : 0.6), ry = 0.12 * w, rz = 0.05 * w;
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(a));
      return [[x, Math.sin(a) * ry, Math.cos(a) * rz], [k, k, k * 1.05]];
    });
    const tail = new T.BufferGeometry();
    tail.setAttribute('position', new T.Float32BufferAttribute([-0.46, 0, 0, -0.66, 0.13, 0, -0.62, 0, 0, -0.46, 0, 0, -0.62, 0, 0, -0.66, -0.13, 0], 3));
    tail.setAttribute('color', new T.Float32BufferAttribute(new Array(18).fill(0.7), 3)); tail.computeVertexNormals();
    return { body, tail };
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
  float a = max(body, tail*0.8)*vA*uDay*0.5;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.004, 0.018, 0.022, a);
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
  vec3 c = vec3(1.0, 0.5, 0.18)*(1.6 + 5.5*pow(1.0 - vY, 2.0))*fl*rib;
  float d = distance(vW, cameraPosition);
  c *= 1.0/(1.0 + d*0.004);
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
    const clearOf = (x, z) => Math.hypot(x - Layout.camp.x, z - Layout.camp.z) > 4.4 && Math.hypot(x - Layout.fire.x, z - Layout.fire.z) > 1.6 && Math.hypot(x - Layout.van.x, z - Layout.van.z) > 3.2;
    const mat = Mats.lit({ vertexColors: true, roughness: 0.5 });
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    let count = 0, shellK = 1; const shellMeshes = [];
    /* how many shells and starfish lie out (they were scattered in random order, so the first k of each set are an even share) */
    function setShells(k) { k = Math.max(0, Math.min(1, k)); if (k === shellK) return; shellK = k; for (const im of shellMeshes) im.count = Math.round(im.userData.full * k); }
    for (const [di, d] of (world ? world.chunks : []).entries()) {
      const rs = rng(6061 + di * 101), camp = d.c === 0 && !d.alt, items = [], want = Math.round(420 * world.CW / 226 * (camp ? 1 : 0.7));
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
        L.forEach((it, i) => { e.set(it.tilt, it.ry, it.tilt * 0.6); q.setFromEuler(e); sc.setScalar(it.s); pos.set(it.x, 0.004, it.z); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); col.setRGB(...it.c); im.setColorAt(i, col); });
        im.receiveShadow = true; im.computeBoundingSphere(); im.userData.liveCount = true; im.userData.full = L.length; shellMeshes.push(im); d.tiny.add(im);
      });
    }

    /* ── leaping fish ── */
    const fg = fishGeo(), fishM = Mats.lit({ vertexColors: true, color: new T.Color('#b9c6cf'), metalness: 0.55, roughness: 0.28 });
    const jumps = [0, 1, 2].map(() => { const g = new T.Group(); g.add(new T.Mesh(fg.body, fishM)); const tl = new T.Mesh(fg.tail, Mats.lit({ vertexColors: true, color: new T.Color('#9aa8b2'), metalness: 0.4, roughness: 0.35, side: T.DoubleSide })); g.add(tl); g.visible = false; root.add(g); return { g, tail: tl, on: false }; });
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
    const shoalM = new T.ShaderMaterial({ uniforms: { uWaveT: U.uWaveT, uWv: U.uWv, uUw: U.uUw, uTime: Mats.U.uTime, uDay: U.uDay, uSchool }, vertexShader: SHOAL_VS, fragmentShader: SHOAL_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const shoal = new T.Mesh(sg, shoalM); shoal.frustumCulled = false; shoal.renderOrder = 4; root.add(shoal);

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
      const nOut = Math.round(NS * Math.min(1, (opt.fish ?? 0.5) * 1.2)); sg.instanceCount = nOut * NF;
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
      return out;
    }
    return { update, count, schools, jumps, setShells, lantern: (x, z, t) => sky.release(x, z, t), get lanterns() { return sky.count; } };
  }
  return { build };
})();
