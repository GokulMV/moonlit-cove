/* ─────────────────────────────────────────────────────────────
   flora.js — what grows along the forest's edge, close to the
   camera: tufts of grass swaying in the breeze, and wild flowers
   among them that can be picked, one at a time, into a bouquet:
   beach morning glory trailing over the sand above the high
   water, yellow beach daisies and white frangipani in the grass.
   Laid along each chunk of the coast as it comes near (world.js
   decorate 'tiny'), the same each time from the chunk's own dice;
   a picked flower stays picked.
   ───────────────────────────────────────────────────────────── */
const Flora = (() => {
  const T = THREE, TAU = Math.PI * 2, rng = Textures.rng;

  /* ── shapes ── */
  /* a tuft of grass: a dozen blades from one root, each a narrow strip tapering to a point and arching out as it
     goes, dark at its foot; some long and some short, a few gone dry and straw-coloured at the tips. Each vertex
     carries how far up its blade it is */
  function tuftGeo(seed) {
    const r = rng(seed), P = [], C = [], H = [], I = [];
    const foot = [0.03, 0.05, 0.014], mid = [0.085, 0.13, 0.03], tip = [0.16, 0.2, 0.055], dryM = [0.12, 0.1, 0.045], dryT = [0.3, 0.24, 0.11];
    const nb = 10 + Math.floor(r() * 4);
    for (let b = 0; b < nb; b++) {
      const a = r() * TAU, lean = 0.15 + r() * 0.8, h = 0.16 + r() * r() * 0.5 + 0.06, w = 0.007 + r() * 0.009, base = P.length / 3, dry = r() < 0.18, segs = 3;
      const rr = 0.05 * Math.sqrt(r()), ox = Math.cos(a) * rr, oz = Math.sin(a) * rr, dx = Math.cos(a + (r() - 0.5) * 0.8), dz = Math.sin(a + (r() - 0.5) * 0.8), tw = (r() - 0.5) * 1.2;
      const k0 = 0.75 + 0.5 * r();
      for (let k = 0; k <= segs; k++) {
        const t = k / segs, y = h * t * (1 - 0.35 * lean * t * t), out = lean * h * t * t, ww = w * (1 - t * 0.92);
        const cx = ox + dx * out, cz = oz + dz * out, an = a + tw * t, px = -Math.sin(an), pz = Math.cos(an);
        P.push(cx - px * ww, y, cz - pz * ww, cx + px * ww, y, cz + pz * ww);
        const c0 = t < 0.5 ? foot.map((f, i) => f + (mid[i] - f) * t * 2) : (dry ? dryM : mid).map((m, i) => m + ((dry ? dryT : tip)[i] - m) * (t - 0.5) * 2);
        const c = c0.map(v => v * k0); C.push(...c, ...c); H.push(t, t);
      }
      for (let k = 0; k < segs; k++) { const i0 = base + k * 2; I.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.setAttribute('aH', new T.Float32BufferAttribute(H, 1)); g.setIndex(I);
    g.computeVertexNormals(); return g;
  }
  /* geometry pieces for flowers, merged into one with vertex colours */
  function mergeCol(parts) {
    let n = 0, ni = 0; for (const { g } of parts) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), I = new Uint32Array(ni);
    let o = 0, oi = 0; const v = new T.Vector3(), nm = new T.Matrix3();
    for (const { g, m, c } of parts) {
      const pa = g.attributes.position, na = g.attributes.normal; nm.getNormalMatrix(m);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); P.set([v.x, v.y, v.z], (o + i) * 3);
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N.set([v.x, v.y, v.z], (o + i) * 3); C.set(c, (o + i) * 3);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[oi + i] = g.index.getX(i) + o; else for (let i = 0; i < pa.count; i++) I[oi + i] = o + i;
      o += pa.count; oi += g.index ? g.index.count : pa.count;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setIndex(new T.BufferAttribute(I, 1));
    g.computeBoundingSphere(); return g;
  }
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new T.Vector3(sx, sy, sz));
  const lin = hex => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
  /* a petal: a flattened, pointed disc */
  const petal = new T.SphereGeometry(1, 8, 4); petal.scale(1, 0.18, 0.5); petal.translate(1, 0, 0);
  const ball = new T.SphereGeometry(1, 10, 6), stem = new T.CylinderGeometry(0.5, 0.6, 1, 5, 1); stem.translate(0, 0.5, 0);
  const cup = new T.CylinderGeometry(1, 0.18, 1, 10, 1, true); cup.translate(0, 0.5, 0);
  const leaf = new T.SphereGeometry(1, 8, 4); leaf.scale(1, 0.12, 0.55); leaf.translate(1, 0, 0);
  /* a beach daisy: a ring of yellow ray petals round an orange-brown disc, on a short stem with a leaf or two (or, for
     a bouquet, the flower alone, facing up, at the origin) */
  function daisyGeo(head) {
    const y = head ? 0 : 0.24, parts = head ? [] : [{ g: stem, m: M(0, 0, 0, 0, 0, 0, 0.012, 0.24, 0.012), c: lin('#3b5f27') }];
    if (!head) for (let i = 0; i < 2; i++) parts.push({ g: leaf, m: M(0, 0.05 + i * 0.07, 0, 0, i * 2.6, 0.5, 0.06, 1, 0.06), c: lin('#36592a') });
    for (let i = 0; i < 11; i++) parts.push({ g: petal, m: M(0, y, 0, 0, i / 11 * TAU, 0.18, 0.045, 0.045, 0.045), c: lin(i % 2 ? '#f2c629' : '#f7d13c') });
    parts.push({ g: ball, m: M(0, y + 0.005, 0, 0, 0, 0, 0.022, 0.012, 0.022), c: lin('#a8621c') });
    return mergeCol(parts);
  }
  /* beach morning glory: a pink trumpet, darker in its throat, low over its leaves (or the trumpet alone, opening up) */
  function gloryGeo(head) {
    if (head) return mergeCol([{ g: cup, m: M(0, 0, 0, 0, 0, 0, 0.055, 0.075, 0.055), c: lin('#d94f9c') }, { g: ball, m: M(0, 0.07, 0, 0, 0, 0, 0.016, 0.006, 0.016), c: lin('#7a1f52') }]);
    const parts = [{ g: stem, m: M(0, 0, 0, 0.5, 0, 0, 0.008, 0.12, 0.008), c: lin('#4c6430') }];
    for (let i = 0; i < 3; i++) parts.push({ g: leaf, m: M(0, 0.015, 0, 0, i * 2.1 + 0.4, -0.15, 0.085, 1, 0.08), c: lin(i % 2 ? '#2f5524' : '#355e29') });
    parts.push({ g: cup, m: M(0, 0.07, 0.04, 0.55, 0, 0, 0.055, 0.075, 0.055), c: lin('#d94f9c') });
    parts.push({ g: ball, m: M(0, 0.102, 0.08, 0, 0, 0, 0.016, 0.006, 0.016), c: lin('#7a1f52') });
    return mergeCol(parts);
  }
  /* frangipani fallen in the grass: five white petals, yellow at the heart, lying face up */
  function frangiGeo() {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push({ g: petal, m: M(0, 0.012, 0, 0.12, i / 5 * TAU, 0.08, 0.05, 0.05, 0.06), c: lin(i % 2 ? '#fbf6ec' : '#f6efe2') });
    parts.push({ g: ball, m: M(0, 0.016, 0, 0, 0, 0, 0.016, 0.006, 0.016), c: lin('#f2c23a') });
    return mergeCol(parts);
  }
  /* a jar of them, for the picnic table: a glass jar of water, the stems fanned out of it, each flower at its stem's end */
  let headG = null;
  function jar(list, flowerM) {
    headG = headG || [daisyGeo(true), gloryGeo(true), frangiGeo()];
    const g = new T.Group(), n = Math.min(24, list.length), up = new T.Vector3(0, 1, 0);
    const glass = new T.Mesh(new T.CylinderGeometry(0.05, 0.044, 0.12, 18, 1, true), new T.MeshStandardMaterial({ color: '#d9e7ec', roughness: 0.05, transparent: true, opacity: 0.3, side: T.DoubleSide, depthWrite: false }));
    glass.position.y = 0.06; g.add(glass);
    const water = new T.Mesh(new T.CylinderGeometry(0.046, 0.042, 0.075, 18), new T.MeshStandardMaterial({ color: '#9fc4cc', roughness: 0.08, transparent: true, opacity: 0.42, depthWrite: false }));
    water.position.y = 0.039; g.add(water);
    const stemM = Mats.lit({ color: new T.Color('#4c7a2e'), roughness: 0.8 });
    for (let i = 0; i < n; i++) {
      const K = Math.max(0, KINDS.findIndex(q => q.id === list[i])), a = i * 2.39996, f = Math.sqrt((i + 0.5) / n), lean = 0.12 + 0.42 * f, L = 0.17 + 0.07 * ((i * 0.618) % 1) - 0.04 * f;
      const dir = new T.Vector3(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean)), base = new T.Vector3(Math.cos(a) * 0.014 * f, 0.02, Math.sin(a) * 0.014 * f);
      const st = new T.Mesh(new T.CylinderGeometry(0.0026, 0.0032, L, 4), stemM); st.position.copy(base).addScaledVector(dir, L / 2); st.quaternion.setFromUnitVectors(up, dir); g.add(st);
      const h = new T.Mesh(headG[K], flowerM); h.position.copy(base).addScaledVector(dir, L); h.quaternion.setFromUnitVectors(up, dir.clone().lerp(up, 0.35).normalize()); h.scale.setScalar(K === 2 ? 1.25 : 1.1); g.add(h);
    }
    return g;
  }
  const KINDS = [{ id: 'daisy', name: 'beach daisy', many: 'beach daisies', geo: daisyGeo, head: 0.245 }, { id: 'glory', name: 'morning glory', many: 'morning glories', geo: gloryGeo, head: 0.1 }, { id: 'frangi', name: 'frangipani', many: 'frangipani', geo: frangiGeo, head: 0.015 }];

  /* ── grass: swaying in the breeze, more toward its tips; lit like the foliage; shrinking away to nothing as it nears
     the edge of the ground it is laid on, so a chunk's grass never pops in or out ── */
  const GRASS_VS = `
uniform float uTime; uniform vec3 uCamF;
attribute vec3 color; attribute float aH;
varying vec3 vC; varying vec3 vN; varying vec3 vWPos; varying float vH;
void main(){
  vec4 p = vec4(position, 1.0); vec3 o = vec3(0.0), n = normal;
  #ifdef USE_INSTANCING
    o = (modelMatrix*instanceMatrix*vec4(0.0, 0.0, 0.0, 1.0)).xyz; p = instanceMatrix*p; n = mat3(instanceMatrix)*n;
  #endif
  float fade = 1.0 - smoothstep(28.0, 40.0, distance(o.xz, uCamF.xz));
  vec4 wp = modelMatrix*p; wp.xyz = o + (wp.xyz - o)*fade;
  float h = max(position.y, 0.0), ph = o.x*0.37 + o.z*0.29;
  wp.xz += vec2(0.55, -0.83)*(sin(uTime*1.7 + ph) + 0.5*sin(uTime*3.1 + ph*1.9))*0.09*h*h*fade;
  vC = color*(0.8 + 0.4*fract(sin(dot(o.xz, vec2(12.9898, 78.233)))*43758.5453)); vN = normalize(mat3(modelMatrix)*n); vWPos = wp.xyz; vH = aH;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
  /* lit as a thin blade: its own face toward the eye, the light through it from behind, dark down among the stems, and
     in the shade where the trees' shadows fall */
  const GRASS_FS = `
#include <packing>
${GLSL.COMMON}
${GLSL.ART}
uniform vec3 uAmbF, uKeyDirT, uKeyColT; uniform vec4 uFog;
uniform sampler2D uLeafShM; uniform mat4 uLeafShX; uniform vec4 uLeafShA; uniform vec2 uLeafShS;
varying vec3 vC; varying vec3 vN; varying vec3 vWPos; varying float vH;
float shadowHere(vec3 wp){
  if (uLeafShA.w < 0.5 || length(wp.xz - uLeafShA.xy) > uLeafShA.z) return 1.0;
  vec4 sc = uLeafShX*vec4(wp, 1.0); sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  vec2 tx = 1.5/uLeafShS; float z = sc.z - 0.002;
  return 0.25*(step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(-tx.x, -tx.y)))) + step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(tx.x, -tx.y))))
             + step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(-tx.x, tx.y)))) + step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(tx.x, tx.y)))));
}
void main(){
  vec3 V = normalize(cameraPosition - vWPos), n = normalize(vN); if (dot(n, V) < 0.0) n = -n;
  float ndl = dot(n, uKeyDirT), sh = shadowHere(vWPos), ao = 0.4 + 0.6*smoothstep(0.0, 0.7, vH);
  /* (a blade is thin: lit from either side, the light from behind coming through it yellower) */
  vec3 L = uAmbF*(0.65 + 0.35*max(n.y, 0.0))*ao + uKeyColT*sh*(0.3 + max(ndl, 0.0)*0.7 + max(-ndl, 0.0)*0.5*vec3(0.95, 1.05, 0.5))*(0.5 + 0.5*ao);
  L += uKeyColT*sh*0.25*pow(max(dot(n, normalize(uKeyDirT + V)), 0.0), 24.0)*ao;
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0) L += artLight(vWPos, n)*ao;
  vec3 c = vC*L; float d = distance(vWPos, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))));
  gl_FragColor = vec4(c, 1.0);
}`;

  function build(root, world) {
    const tufts = [11, 23, 37].map(tuftGeo);
    const grassM = new T.ShaderMaterial({ uniforms: Object.assign({}, Mats.U, { uCamF: { value: new T.Vector3() } }), vertexShader: GRASS_VS, fragmentShader: GRASS_FS, side: T.DoubleSide });
    const flowerG = KINDS.map(k => k.geo()), flowerM = Mats.lit({ vertexColors: true, roughness: 0.6 });
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3();
    /* what has been picked, by chunk and flower ("c:i"), kept a few hours in this browser so a picked flower stays picked */
    const KEY = 'cove.picked', picked = new Set();
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Date.now() - s.at < 6 * 3600e3) for (const k of s.list) picked.add(k); } catch (e2) { /* none kept */ }
    const keep = () => { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), list: [...picked].slice(-400) })); } catch (e2) { /* fine */ } };
    const live = new Map();   /* chunk index → its flowers, for picking: { items, meshes } */
    const campX = Layout.camp.x, campZ = Layout.camp.z;
    const awayFromCamp = (x, z) => Math.hypot(x - campX, z - campZ) > 7.5 && Math.hypot(x - Layout.van.x, z - Layout.van.z) > 4 && Math.hypot(x - Layout.fire.x, z - Layout.fire.z) > 3;

    world.decorate(ch => {
      const r = ch.rng(41), c = ch.c, grass = [[], [], []], items = [];
      /* the grass: a band along the forest edge, a little out onto the sand, thinning into the trees */
      for (let i = 0; i < 5200; i++) {
        const x = ch.x0 + r() * (ch.x1 - ch.x0), vz = Layout.vegZ(x), u = r(), z = vz - 1.6 + Math.pow(u, 1.7) * 14;
        if (world.massif(x, z) > 0.25 || !awayFromCamp(x, z)) continue;
        if (z < vz && r() < 0.6) continue;    /* (sparser out on the sand) */
        const y = Math.max(0, world.land(x, z)), s = 0.75 + r() * 0.6;
        grass[i % 3].push([x, y, z, r() * TAU, s * (z < vz ? 0.7 : 1)]);
      }
      grass.forEach((L, k) => {
        if (!L.length) return;
        const im = new T.InstancedMesh(tufts[k], grassM, L.length);
        L.forEach(([x, y, z, ry, s], i) => { e.set(0, ry, 0); q.setFromEuler(e); sc.setScalar(s); pos.set(x, y, z); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); });
        im.computeBoundingSphere(); im.frustumCulled = true; ch.tiny.add(im);
      });
      /* the flowers: morning glory on the sand above the high water, daisies and frangipani in the grass */
      for (let i = 0, n = 0; i < 1400 && n < 220; i++) {
        const k = r() < 0.4 ? 1 : r() < 0.72 ? 0 : 2, x = ch.x0 + r() * (ch.x1 - ch.x0), vz = Layout.vegZ(x), sz = Layout.shoreZ(x);
        const z = k === 1 ? vz - 0.3 - r() * Math.max(1, (vz - sz) * 0.3) : vz - 1.2 + Math.pow(r(), 1.5) * 7;
        if (world.massif(x, z) > 0.2 || !awayFromCamp(x, z)) continue;
        /* (in patches, as they grow: several near each other) */
        const nn = 2 + Math.floor(r() * 5);
        for (let j = 0; j < nn && n < 220; j++, n++) {
          const xx = x + (r() - 0.5) * 1.8, zz = z + (r() - 0.5) * 1.2, idx = items.length, id = c + ':' + idx;
          items.push({ k, x: xx, y: Math.max(0, world.land(xx, zz)), z: zz, ry: r() * TAU, s: 1.5 + r() * 0.6, id, gone: picked.has(id) });
        }
      }
      const meshes = KINDS.map((K, k) => {
        const L = items.filter(it => it.k === k); if (!L.length) return null;
        const im = new T.InstancedMesh(flowerG[k], flowerM, L.length);
        L.forEach((it, i) => { it.mi = i; it.mk = k; e.set(0, it.ry, 0); q.setFromEuler(e); sc.setScalar(it.gone ? 0 : it.s); pos.set(it.x, it.y, it.z); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); });
        im.computeBoundingSphere(); ch.tiny.add(im);
        im.addEventListener('dispose', () => { if (live.get(c) && live.get(c).meshes.includes(im)) live.delete(c); });
        return im;
      });
      live.set(c, { items, meshes });
    }, 'tiny');

    /* ── picking: the flower nearest where the screen was touched, if one is close enough to reach and lies within a
       couple of dozen pixels of it (they are small; a finger can't land on a petal) ── */
    const _v = new T.Vector3();
    function nearest(camera, nx, ny, W, H, maxPx = 26, maxD = 22) {
      let best = null, bd = maxPx * maxPx;
      for (const [, L] of live) {
        for (const it of L.items) {
          if (it.gone) continue;
          const head = KINDS[it.k].head * it.s;
          _v.set(it.x, it.y + head, it.z); const d = _v.distanceTo(camera.position); if (d > maxD) continue;
          _v.project(camera); if (_v.z > 1) continue;
          const dx = ((_v.x * 0.5 + 0.5) - nx) * W, dy = ((-_v.y * 0.5 + 0.5) - ny) * H, d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = it; }
        }
      }
      return best;
    }
    /* pick one: it shrinks away over a moment; the bouquet gets it */
    const going = [];
    function pluck(it, t) {
      if (!it || it.gone) return null;
      it.gone = true; picked.add(it.id); keep();
      going.push({ it, t0: t });
      return { kind: KINDS[it.k].id, name: KINDS[it.k].name, at: [it.x, it.y + KINDS[it.k].head * it.s, it.z] };
    }
    function update(t, camera) {
      grassM.uniforms.uCamF.value.copy(camera.position);
      for (let i = going.length - 1; i >= 0; i--) {
        const g = going[i], it = g.it, L = live.get(+it.id.split(':')[0]), u = Math.min(1, (t - g.t0) / 0.35);
        const im = L && L.meshes[it.mk]; if (im) { e.set(0, it.ry + u * 2, 0); q.setFromEuler(e); sc.setScalar(it.s * (1 - u) * (1 + 0.4 * Math.sin(u * Math.PI))); pos.set(it.x, it.y + u * 0.25, it.z); m4.compose(pos, q, sc); im.setMatrixAt(it.mi, m4); im.instanceMatrix.needsUpdate = true; }
        if (u >= 1) going.splice(i, 1);
      }
    }
    /* how many flowers lie about near x, picked or not (for the test bench) */
    const count = () => { let n = 0, p = 0; for (const [, L] of live) for (const it of L.items) { n++; if (it.gone) p++; } return { flowers: n, picked: p, chunks: live.size }; };
    return { nearest, pluck, update, count, KINDS, jar: list => jar(list, flowerM) };
  }
  return { build, KINDS };
})();
