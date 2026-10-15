/* ─────────────────────────────────────────────────────────────
   marks.js — what feet and tyres leave in the sand. A footprint
   is a real foot's shape (heel, arch, ball and toes, the sand
   pushed up round it), a tyre track a rut with a tread in it and
   a ridge either side; both are relief maps laid on the sand as
   decals that shade it by the light, so they read like dents in
   the sand by day and fade into the night. They last a minute or
   two, softening away, and the sea smooths them out as soon as a
   wave runs over them.
   ───────────────────────────────────────────────────────────── */
const Marks = (() => {
  const T = THREE;
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  /* a box blur of a height field, r pixels each way, edges clamped */
  function blur(h, W, H, r) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += h[y * W + Math.min(W - 1, Math.max(0, x + k))]; tmp[y * W + x] = s / (2 * r + 1); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[Math.min(H - 1, Math.max(0, y + k)) * W + x]; out[y * W + x] = s / (2 * r + 1); }
    return out;
  }
  /* a relief texture from a depth field (1 = deepest; rows run up the texture, along v): slopes in RG, how deep in B,
     where it is at all in A. The sand shoved aside makes a low ridge round the edge */
  function relief(depth, W, H, k, rim) {
    const d = blur(depth, W, H, 1), wide = blur(depth, W, H, 4), ht = new Float32Array(W * H), data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) ht[i] = -d[i] + rim * Math.max(0, wide[i] - d[i]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, hx = ht[y * W + Math.min(W - 1, x + 1)] - ht[y * W + Math.max(0, x - 1)], hy = ht[Math.min(H - 1, y + 1) * W + x] - ht[Math.max(0, y - 1) * W + x];
      let nx = -hx * k, ny = -hy * k; const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l;
      const a = Math.min(1, Math.max(d[i], (wide[i] - d[i]) * 3) * 6);
      data[i * 4] = (nx * 0.5 + 0.5) * 255; data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; data[i * 4 + 2] = Math.min(1, d[i]) * 255; data[i * 4 + 3] = a * 255;
    }
    const t = new T.DataTexture(data, W, H, T.RGBAFormat); t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  }
  /* a right foot, toes up the texture: heel, the outer edge of the arch, the ball, five toes */
  function footTex() {
    const W = 48, H = 128, c = cv(W, H), a = c.getContext('2d', { willReadFrequently: true });
    a.fillStyle = '#000'; a.fillRect(0, 0, W, H); a.fillStyle = '#fff';
    const el = (x, y, rx, ry, rot = 0, g = 255) => { a.fillStyle = `rgb(${g},${g},${g})`; a.beginPath(); a.ellipse(x * W, y * H, rx * W, ry * H, rot, 0, Math.PI * 2); a.fill(); };
    el(0.5, 0.82, 0.22, 0.1, 0, 235);             /* heel */
    el(0.6, 0.6, 0.1, 0.16, -0.12, 150);          /* the outer edge of the arch, shallow */
    el(0.47, 0.37, 0.27, 0.1, 0.1, 225);          /* ball */
    el(0.3, 0.2, 0.09, 0.055, 0, 215);            /* big toe */
    [[0.47, 0.18, 0.055], [0.6, 0.2, 0.05], [0.71, 0.23, 0.045], [0.8, 0.28, 0.04]].forEach(([x, y, r], i) => el(x, y, r, r * W / H * 1.15, 0, 190 - i * 15));
    const px = a.getImageData(0, 0, W, H).data, dep = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dep[(H - 1 - y) * W + x] = px[(y * W + x) * 4] / 255;   /* (toes up the texture: forward) */
    return relief(dep, W, H, 9, 0.6);
  }
  /* a tyre's rut across the texture (the same all along it): a rounded trough, its walls falling away softly as dry
     sand does, a low ridge of the sand it shoved aside each side. Its tread (marks FS) is pressed in only where the
     sand is damp enough to hold it */
  function treadTex() {
    const W = 64, H = 4, dep = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W - 0.5, au = Math.abs(u), w = Math.min(1, Math.max(0, (au - 0.2) / 0.16));
      dep[y * W + x] = 0.7 * (1 - w * w * (3 - 2 * w)) * (0.92 + 0.08 * (1 - au / 0.2));
    }
    return relief(blur(dep, W, H, 1), W, H, 4.2, 0.55);
  }

  const VS = `
attribute vec4 aMark;           /* when it was made, when the sea took it, how wet the sand was, how hard it was pressed */
#ifdef RIBBON
  attribute vec2 aDir;          /* the way the wheel was rolling */
#endif
varying vec2 vUv, vWxz; varying vec4 vMark; varying vec3 vU, vV;   /* the texture's across (u) and along (v), in the world */
void main(){
  vUv = uv; vMark = aMark;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m*instanceMatrix;
  #endif
  vWxz = (m*vec4(position, 1.0)).xz;
  #ifdef RIBBON
    vU = vec3(-aDir.y, 0.0, aDir.x); vV = vec3(aDir.x, 0.0, aDir.y);
  #else
    vU = normalize(mat3(m)*vec3(1.0, 0.0, 0.0)); vV = -normalize(mat3(m)*vec3(0.0, 0.0, 1.0));
  #endif
  gl_Position = projectionMatrix*viewMatrix*m*vec4(position, 1.0);
}`;
  const FS = `
uniform sampler2D uMap; uniform vec3 uL; uniform float uKey, uNow, uLife;
varying vec2 vUv, vWxz; varying vec4 vMark; varying vec3 vU, vV;
${GLSL.ISLE_SH}
float mkH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float mkN(vec2 p){ vec2 i = floor(p), f = p - i; f = f*f*(3.0 - 2.0*f); return mix(mix(mkH(i), mkH(i + vec2(1.0, 0.0)), f.x), mix(mkH(i + vec2(0.0, 1.0)), mkH(i + vec2(1.0, 1.0)), f.x), f.y); }
#ifdef RIBBON
/* the tread: chevrons of lugs across the rut, 6 to the texture's length along it (0.34 m) */
float treadH(vec2 uv){ float au = abs(uv.x - 0.5), c = fract(uv.y*6.0 + au*1.6); return smoothstep(0.0, 0.1, c)*smoothstep(0.46, 0.34, c)*smoothstep(0.3, 0.24, au); }
#endif
void main(){
  vec4 m = texture2D(uMap, vUv, -0.7);                           /* (a little sharper than the mip level would have it) */
  if (m.a < 0.01) discard;
  vec2 n2 = m.rg*2.0 - 1.0;
  /* (its edge crumbles: dry sand slumps back in, here more, there less) */
  float crum = mkN(vWxz*9.0)*0.6 + mkN(vWxz*23.0)*0.4;
  m.a *= smoothstep(0.05, 0.35, m.a + 0.25*(crum - 0.5));
#ifdef RIBBON
  /* (the tread, pressed in as the sand's dampness lets it: crisp in wet sand, a blur in damp, nothing in dry) */
  { float wk = smoothstep(0.15, 0.7, vMark.z), e = 0.01, h0 = treadH(vUv);
    vec2 g = vec2(treadH(vUv + vec2(e, 0.0)) - h0, treadH(vUv + vec2(0.0, e)) - h0)/e;
    n2 -= g*vec2(0.008, 0.007)*wk*smoothstep(0.3, 0.6, m.b); m.b += 0.18*h0*wk*smoothstep(0.3, 0.6, m.b); }
#endif
  /* the dent's slopes, turned into the world */
  vec3 N = normalize(vU*n2.x + vV*n2.y + vec3(0.0, 1.0, 0.0));
  float ly = max(uL.y, 0.22);
  float lit = (max(dot(N, uL), 0.0) - max(uL.y, 0.0))/ly;          /* lighter or darker than the flat sand round it */
  float occ = m.b*(0.12 + 0.3*vMark.z);                          /* deeper is a little darker, more so in wet sand */
  float churn = clamp(m.a - m.b*1.6, 0.0, 1.0)*(1.0 - vMark.z);  /* the dry sand kicked up round the edge is paler */
  float age = uNow - vMark.x, fade = (1.0 - smoothstep(uLife*0.55, uLife, age))*(1.0 - smoothstep(0.0, 0.7, uNow - vMark.y));
  /* (in the shade of the land and the forest the sun picks out no dents: only their hollows are darker) */
  float d = (uKey*isleSh(vWxz)*lit*1.15 - occ + 0.08*churn)*fade*m.a*vMark.w;
  gl_FragColor = vec4(vec3(clamp(0.5 + 0.5*d, 0.0, 1.0)), 1.0);
}`;
  function material(map, life, ribbon) {
    return new T.ShaderMaterial({ uniforms: Object.assign({ uMap: { value: map }, uL: { value: new T.Vector3(0, 1, 0) }, uKey: { value: 0.5 }, uNow: { value: 0 }, uLife: { value: life } }, Mats.shadeU()), defines: ribbon ? { RIBBON: 1 } : {},
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: T.DoubleSide,   /* (a left foot is a right one mirrored, which turns it over) */ polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.DstColorFactor, blendDst: T.SrcColorFactor });   /* 2× multiply: 0.5 leaves the sand as it is */
  }

  function build(root) {
    /* footprints: a ring of instanced decals */
    const NF = 400, fGeo = new T.PlaneGeometry(0.17, 0.34); fGeo.rotateX(-Math.PI / 2);
    const fAttr = new T.InstancedBufferAttribute(new Float32Array(NF * 4).fill(-1e9), 4); fGeo.setAttribute('aMark', fAttr);
    const fMat = material(footTex(), 110), feet = new T.InstancedMesh(fGeo, fMat, NF);
    feet.frustumCulled = false; feet.renderOrder = 2; root.add(feet);
    const fPos = new Float32Array(NF * 3), _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
    for (let i = 0; i < NF; i++) { _m.makeScale(0, 0, 0); feet.setMatrixAt(i, _m); }
    let fi = 0;
    /* a step pressed into the sand at (x, z): heading h (radians, the way the walker faces), left or right foot */
    function foot(x, z, h, left, wet, t) {
      const i = fi; fi = (fi + 1) % NF;
      _q.setFromAxisAngle(UP, h); _s.set(left ? -1 : 1, 1, 1); _p.set(x, 0.006, z); _m.compose(_p, _q, _s); feet.setMatrixAt(i, _m); feet.instanceMatrix.needsUpdate = true;
      fAttr.setXYZW(i, t, 1e9, Math.min(1, wet || 0), 0.75 + 0.25 * Math.random()); fAttr.needsUpdate = true;
      fPos[i * 3] = x; fPos[i * 3 + 1] = z; fPos[i * 3 + 2] = 1;
    }

    /* tyre tracks: a ribbon of short quads for each wheel, in rings */
    const NS = 2400, NW = 4, NQ = NS * NW, P = new Float32Array(NQ * 4 * 3), UV = new Float32Array(NQ * 4 * 2), DR = new Float32Array(NQ * 4 * 2), MK = new Float32Array(NQ * 4 * 4).fill(-1e9), IDX = new Uint32Array(NQ * 6);
    for (let q = 0; q < NQ; q++) { const v = q * 4; IDX.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], q * 6); }   /* (facing up) */
    const tGeo = new T.BufferGeometry(); tGeo.setAttribute('position', new T.BufferAttribute(P, 3)); tGeo.setAttribute('uv', new T.BufferAttribute(UV, 2)); tGeo.setAttribute('aMark', new T.BufferAttribute(MK, 4)); tGeo.setAttribute('aDir', new T.BufferAttribute(DR, 2)); tGeo.setIndex(new T.BufferAttribute(IDX, 1));
    const tMat = material(treadTex(), 150, true); tMat.uniforms.uMap.value.wrapT = T.RepeatWrapping; tMat.uniforms.uMap.value.needsUpdate = true;
    const tracks = new T.Mesh(tGeo, tMat); tracks.frustumCulled = false; tracks.renderOrder = 2; root.add(tracks);
    const ring = new Int32Array(NW), odo = new Float32Array(NW), segPos = new Float32Array(NQ * 3), dirty = [];
    /* only the quads that changed go to the GPU (the whole ribbon is a couple of megabytes), in runs */
    function flush() {
      if (!dirty.length) return;
      dirty.sort((a, b) => a - b);
      const A = tGeo.attributes, runs = [];
      for (let i = 0; i < dirty.length; i++) { const q = dirty[i], r = runs[runs.length - 1]; if (r && q <= r[1] + 1) r[1] = Math.max(r[1], q); else runs.push([q, q]); }
      dirty.length = 0;
      for (const a of [A.position, A.uv, A.aMark, A.aDir]) {
        const n = a.itemSize * 4;
        if (runs.length > 48) a.clearUpdateRanges(); else for (const [q0, q1] of runs) a.addUpdateRange(q0 * n, (q1 - q0 + 1) * n);
        a.needsUpdate = true;
      }
    }
    /* a stretch of rut from (x0, z0) to (x1, z1) by wheel w, width wd; k how deep it pressed */
    function tyre(w, x0, z0, x1, z1, wd, k, wet, t) {
      const len = Math.hypot(x1 - x0, z1 - z0); if (len < 1e-3) return;
      const q = w * NS + ring[w]; ring[w] = (ring[w] + 1) % NS;
      const dx = (x1 - x0) / len, dz = (z1 - z0) / len, hx = -dz * wd * 0.75, hz = dx * wd * 0.75, v0 = odo[w] / 0.34, v1 = (odo[w] + len) / 0.34; odo[w] += len;
      const p = q * 12; P.set([x0 - hx, 0.007, z0 - hz, x0 + hx, 0.007, z0 + hz, x1 - hx, 0.007, z1 - hz, x1 + hx, 0.007, z1 + hz], p);
      UV.set([0, v0, 1, v0, 0, v1, 1, v1], q * 8); DR.set([dx, dz, dx, dz, dx, dz, dx, dz], q * 8);
      const mk = [t, 1e9, Math.min(1, wet || 0), k]; for (let j = 0; j < 4; j++) MK.set(mk, q * 16 + j * 4);
      segPos[q * 3] = (x0 + x1) / 2; segPos[q * 3 + 1] = (z0 + z1) / 2; segPos[q * 3 + 2] = 1;
      dirty.push(q);
    }

    /* every frame: the light they are shaded by; now and then, the sea takes what it has run over */
    let washT = 0;
    function update(t, wt, S, swashFront) {
      for (const M of [fMat, tMat]) {
        const U = M.uniforms; U.uNow.value = t;
        if (S) { const k = S.keyCol, a = S.amb, kl = (k[0] + k[1] + k[2]) * Math.max(0, S.keyDir[1]), al = a[0] + a[1] + a[2]; U.uKey.value = kl / Math.max(1e-4, kl + al * 0.8); U.uL.value.set(S.keyDir[0], S.keyDir[1], S.keyDir[2]).normalize(); }
      }
      if (swashFront && t - washT >= 0.25) {
        washT = t;
        /* the shore and the water's reach, worked out once for each half metre along the beach */
        const shore = new Map(), front = new Map();
        const upOf = x => { const b = Math.round(x * 2); let v = shore.get(b); if (v === undefined) { const g = Layout.shoreDZ(x); v = [Layout.shoreZ(x), Math.sqrt(1 + g * g)]; shore.set(b, v); } return v; };
        const reach = x => { const b = Math.round(x * 2); let v = front.get(b); if (v === undefined) { v = swashFront(x, wt); front.set(b, v); } return v; };
        const check = (pos, n, onTaken) => {
          for (let i = 0; i < n; i++) {
            if (!pos[i * 3 + 2]) continue;
            const x = pos[i * 3], [sz, k] = upOf(x), up = (pos[i * 3 + 1] - sz) / k;
            if (up > 9) continue;
            if (up < reach(x)) { pos[i * 3 + 2] = 0; onTaken(i); }
          }
        };
        check(fPos, NF, i => { fAttr.setY(i, t); fAttr.needsUpdate = true; });
        check(segPos, NQ, q => { for (let j = 0; j < 4; j++) MK[q * 16 + j * 4 + 1] = t; dirty.push(q); });
      }
      flush();
    }
    /* (the camp moved under the world: what was pressed into the old beach goes) */
    function clear() { fAttr.array.fill(-1e9); fAttr.needsUpdate = true; MK.fill(-1e9); dirty.length = 0; tGeo.attributes.aMark.clearUpdateRanges(); tGeo.attributes.aMark.needsUpdate = true; fPos.fill(0); segPos.fill(0); }
    /* how many are pressed in just now (for the tests) */
    const count = () => { let f = 0, s = 0; for (let i = 0; i < NF; i++) f += fPos[i * 3 + 2]; for (let q = 0; q < NQ; q++) s += segPos[q * 3 + 2]; return { feet: f, tyre: s }; };
    return { foot, tyre, update, clear, count, feet, tracks };
  }
  return { build };
})();
