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
  /* a model (models/life/) as one geometry with its colours, scaled by k */
  const fromModel = (name, o, k = 1) => {
    const g = Models.make(name, o); g.scale.setScalar(k); g.updateMatrixWorld(true);
    const parts = []; g.traverse(m => { if (m.isMesh) parts.push({ geo: m.geometry, m: m.matrixWorld.clone(), c: m.geometry.attributes.color ? [1, 1, 1] : m.material.color.toArray() }); });
    return Models.mergeC(parts);
  };
  /* beach morning glory creeping over the sand (models/life/flowers.js: a runner, its goat's-foot leaves held up on their
     stalks, a pink trumpet and a bud), built light; or the trumpet alone, opening up. (Laid at 1.5–2.1 times, as the
     others are: built smaller to come out its own size) */
  function gloryGeo(head) {
    return head ? fromModel('life/gloryvine', { lite: true, head: true }) : fromModel('life/gloryvine', { lite: true, seed: 3 }, KG[1] / 1.8);
  }
  /* a beach daisy: its yellow rays round a domed disc, on a stem with two leaves (or the flower alone, facing up); and a
     frangipani flower fallen in the grass, face up. (KG: each as big as its model, times the 1.5–2.1 they are laid at,
     over 1.8: the daisy a little bigger than life, to stand out of the grass) */
  const KG = [1.5, 1, 1.2];
  function daisyGeo(head) { return head ? fromModel('life/daisy', { lite: true, head: true }) : fromModel('life/daisy', { lite: true }, KG[0] / 1.8); }
  function frangiGeo() { return fromModel('life/frangi', { lite: true }, KG[2] / 1.8); }
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
  const KINDS = [{ id: 'daisy', name: 'beach daisy', many: 'beach daisies', geo: daisyGeo, head: 0.11 * 1.5 / 1.8 }, { id: 'glory', name: 'morning glory', many: 'morning glories', geo: gloryGeo, head: 0.04 }, { id: 'frangi', name: 'frangipani', many: 'frangipani', geo: frangiGeo, head: 0.01 }];

  /* ── grass: swaying in the breeze, more toward its tips; lit like the foliage; shrinking away to nothing as it nears
     the edge of the ground it is laid on, so a chunk's grass never pops in or out ── */
  const GRASS_VS = `
uniform float uTime; uniform vec3 uCamF; uniform vec2 uWindK;
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
  wp.xz += vec2(0.55, -0.83)*((sin(uTime*1.7 + ph) + 0.5*sin(uTime*3.1 + ph*1.9) + 0.6*sin(uTime*6.7 + ph*2.3)*max(uWindK.x - 1.0, 0.0))*uWindK.x + 1.4*uWindK.y)*0.09*h*h*fade;
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
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0 || torchNear(vWPos)) L += artLight(vWPos, n)*ao;
  vec3 c = vC*L; float d = distance(vWPos, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))));
  gl_FragColor = vec4(c, 1.0);
}`;

  function build(root, world) {
    const tufts = [11, 23, 37].map(tuftGeo);
    const grassM = new T.ShaderMaterial({ uniforms: Object.assign({}, Mats.U, { uCamF: { value: new T.Vector3() } }), vertexShader: GRASS_VS, fragmentShader: GRASS_FS, side: T.DoubleSide });
    const flowerG = KINDS.map(k => k.geo()), flowerM = Mats.lit({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
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
      for (let i = 0, n = 0; i < 1400 && n < 240; i++) {
        const k = r() < 0.4 ? 1 : r() < 0.72 ? 0 : 2, x = ch.x0 + r() * (ch.x1 - ch.x0), vz = Layout.vegZ(x), sz = Layout.shoreMeanZ(x);
        const z = k === 1 ? vz - 0.3 - r() * Math.max(1, (vz - sz) * 0.3) : vz - 1.2 + Math.pow(r(), 1.5) * 7;
        if (world.massif(x, z) > 0.2 || !awayFromCamp(x, z)) continue;
        /* (in patches, as they grow: several near each other) */
        const nn = k === 1 ? 4 + Math.floor(r() * 6) : 2 + Math.floor(r() * 5), spread = k === 1 ? 1.3 : 1.8;     /* (the vine in a mat of runners) */
        for (let j = 0; j < nn && n < 240; j++, n++) {
          const xx = x + (r() - 0.5) * spread, zz = z + (r() - 0.5) * spread * 0.66, idx = items.length, id = c + ':' + idx;
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
          if (it.gone || it.held) continue;
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
    function pluck(it, t, quiet) {
      if (!it || it.gone) return null;
      it.gone = true; it.held = false; picked.add(it.id); keep();
      if (!quiet) going.push({ it, t0: t });
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
    /* the flowers near the camera, for picking up and holding (inspect.js): hidden while held; kept for the bouquet, it
       is picked; thrown back, it lies in the grass where it fell (inspect.js keeps that one) and this one stays gone */
    const KIND_OF = ['daisy', 'glory', 'frangi'];
    function setFlower(it, s) { const L = live.get(+it.id.split(':')[0]), im = L && L.meshes[it.mk]; if (!im) return; e.set(0, it.ry, 0); q.setFromEuler(e); sc.setScalar(s); pos.set(it.x, it.y, it.z); m4.compose(pos, q, sc); im.setMatrixAt(it.mi, m4); im.instanceMatrix.needsUpdate = true; }
    function pickables(list, cam) {
      for (const [, L] of live) for (const it of L.items) {
        if (it.gone || it.held) continue;
        const dx = it.x - cam.x, dz = it.z - cam.z; if (dx * dx + dz * dz > 900) continue;
        const head = KINDS[it.k].head * it.s;
        list.push({ kind: KIND_OF[it.k], x: it.x, y: it.y + head * 0.6, z: it.z, r: Math.max(0.06, head * 0.45), yaw: it.ry, size: it.s * KG[it.k] / 1.8, flower: it,
          take() { it.held = true; setFlower(it, 0); },
          give(how) { it.held = false; if (how === 'back') setFlower(it, it.s); else { it.gone = true; picked.add(it.id); keep(); } } });
      }
    }
    /* how many flowers lie about near x, picked or not (for the test bench) */
    const count = () => { let n = 0, p = 0; for (const [, L] of live) for (const it of L.items) { n++; if (it.gone) p++; } return { flowers: n, picked: p, chunks: live.size }; };
    return { nearest, pluck, update, count, KINDS, pickables, jar: list => jar(list, flowerM) };
  }
  return { build, KINDS };
})();
