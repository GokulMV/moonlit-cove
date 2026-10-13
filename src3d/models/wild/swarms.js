/* wild/beecomb, wild/fireflies — the island's insects in their thousands.
   wild/beecomb: a giant honey bees' comb (Apis dorsata) as it hangs under a high branch, its top along y = 0: a half
   moon of wax 0.8 m across and half a metre deep, its cells deep and the honey's band capped along the top; and over
   both faces the living curtain of bees, three deep, heads up — which shimmers: waves running out across it as the
   bees flick their abdomens up together, a ring at a time, to warn off a hornet or a bird; here and there one buzzes.
   wild/fireflies: a congregation of mangrove fireflies (Pteroptyx) in a tree's crown, flashing together, two or three
   times a second, in one beat; a few stragglers out of step; drifting a little. o.n how many, o.r and o.h the crown's
   half-width and half-height (centred at y = o.y). Both keep time by Mats' clock unless userData.anim(t) is called. */
(() => {
  const T = THREE, M = Models;
  const rng = s => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };

  M.add('wild/beecomb', (o = {}) => {
    const g = new T.Group(); g.name = 'beecomb';
    const W = o.w || 0.4, H = o.h || 0.5, R = rng(o.seed || 7), clock = { t: null };
    const hgt = x => H * Math.sqrt(Math.max(0, 1 - (x / W) * (x / W))) + 0.004, thick = (x, c) => (0.036 - 0.014 * c) * (1 - Math.pow(Math.abs(x / W), 6));
    /* ── the comb: two faces meeting at the rim, rounded ── */
    {
      const ns = 64, nc = 32, pos = [], idx = [], loc = [];
      for (const f of [1, -1]) { const b = pos.length / 3;
        for (let i = 0; i <= ns; i++) for (let j = 0; j <= nc; j++) { const s = i / ns, c = j / nc, x = -W + 2 * W * s, y = -c * hgt(x), z = f * 0.5 * thick(x, c) * Math.sqrt(Math.max(0, 1 - Math.pow(c, 8))); pos.push(x, y, z); }
        for (let i = 0; i < ns; i++) for (let j = 0; j < nc; j++) { const q = b + i * (nc + 1) + j; f > 0 ? idx.push(q, q + 1, q + nc + 1, q + 1, q + nc + 2, q + nc + 1) : idx.push(q, q + nc + 1, q + 1, q + 1, q + nc + 1, q + nc + 2); } }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const mat = Mats.lit({ color: new T.Color('#c9b27a'), roughness: 0.62 }, 'comb'), prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (sh, r) => { prev(sh, r);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCo;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCo = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vCo;
/* the honeycomb: hexagonal cells 5 mm across — their walls pale, their mouths dark; along the top capped with wax over honey */
float hexD(vec2 p){ vec2 r = vec2(1.0, 1.7320508), h = r*0.5, a = mod(p, r) - h, b = mod(p - h, r) - h, g = dot(a, a) < dot(b, b) ? a : b, q = abs(g); return max(dot(q, normalize(r)), q.x); }`)
          .replace('#include <color_fragment>', `#include <color_fragment>
  { float d = hexD(vCo.xy/0.0052), wall = smoothstep(0.4, 0.47, d), cap = smoothstep(-0.07, -0.03, vCo.y);
    diffuseColor.rgb *= mix(mix(0.35, 1.05, wall), mix(0.82, 1.0, wall), cap);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.1, 0.85, 0.55), 0.5*cap*(1.0 - wall)); }`);
      };
      const mesh = new T.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
    }
    /* ── one bee for the curtain: head, thorax, the banded abdomen (its points marked to be flicked up), wings ── */
    const bee = (() => {
      const pos = [], nor = [], col = [], prt = [], idx = [];
      const add = (geo, cf, part) => { const P = geo.attributes.position, Nn = geo.attributes.normal, b = pos.length / 3;
        for (let i = 0; i < P.count; i++) { const x = P.getX(i); pos.push(x, P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); col.push(...(typeof cf === 'function' ? cf(x) : cf)); prt.push(part); }
        const I = geo.index ? geo.index.array : Array.from({ length: P.count }, (_, i) => i); for (const i of I) idx.push(i + b); };
      const el = (rx, ry, rz, x, y, n = 10, m = 7) => { const s = new T.SphereGeometry(1, n, m); s.scale(rx, ry, rz); s.translate(x, y, 0); s.computeVertexNormals(); return s; };
      const black = lin('#141210'), amber = lin('#8f5420'), hair = lin('#9a8c6a');
      add(el(0.0028, 0.0024, 0.0024, 0.0006, 0.0, 7, 5), black, 0);
      add(el(0.0016, 0.0019, 0.0021, 0.0042, -0.0002, 6, 4), black, 0);
      add(el(0.0052, 0.0023, 0.0024, -0.0058, -0.0004, 9, 5), x => { const sg = (-x - 0.002) / 0.0024, i = Math.floor(sg), f = sg - i, c = i <= 1 ? amber : black; return f > 0.8 ? c.map((v, k) => v * 0.5 + hair[k] * 0.5) : c; }, 1);
      for (const s of [-1, 1]) { const w = new T.PlaneGeometry(0.0085, 0.0021); w.rotateX(-Math.PI / 2); w.rotateY(s * 0.12); w.translate(-0.0044, 0.0027, s * 0.0016); add(w, lin('#2e2a24'), 2); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setAttribute('aPart', new T.Float32BufferAttribute(prt, 1)); geo.setIndex(idx);
      return geo;
    })();
    const N = o.n || 9000, inst = new T.InstancedMesh(bee, null, N), uv = new Float32Array(N * 2), rnd = new Float32Array(N), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    let k = 0;
    for (let tries = 0; k < N && tries < N * 6; tries++) {
      const face = R() < 0.53 ? 1 : -1, x = (R() * 2 - 1) * W * 0.97, c = Math.pow(R(), 0.75) * 0.97, y = -c * hgt(x) + 0.006, layer = Math.floor(R() * 3);
      if (y > -0.012) continue;
      const z = face * (0.5 * thick(x, Math.min(1, -y / H)) + 0.0028 + layer * 0.0034 + R() * 0.0012);
      /* (head up, belly to the comb: the bee's +x up the comb, its back (+y) outward) */
      const yaw = (R() - 0.5) * 1.1, hx = new T.Vector3(-Math.sin(yaw), Math.cos(yaw), 0), by = new T.Vector3(0, 0, face), lz = new T.Vector3().crossVectors(hx, by);
      q.setFromRotationMatrix(new T.Matrix4().makeBasis(hx, by, lz));
      m4.compose(new T.Vector3(x, y, z), q, new T.Vector3(1, 1, 1).multiplyScalar(0.92 + 0.16 * R())); inst.setMatrixAt(k, m4);
      uv[k * 2] = x; uv[k * 2 + 1] = y; rnd[k] = R(); k++;
    }
    inst.count = k;
    bee.setAttribute('aUV', new T.InstancedBufferAttribute(uv, 2)); bee.setAttribute('aRnd', new T.InstancedBufferAttribute(rnd, 1));
    const U = { uT: { value: 0 } };
    const mat = Mats.lit({ vertexColors: true, roughness: 0.6 }, 'beecurtain'), prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => { prev(sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aPart; attribute vec2 aUV; attribute float aRnd; uniform float uT;
float hsh(float n){ return fract(sin(n*91.3458)*47453.5453); }
/* the shimmer: waves out from points across the curtain, one starting every so often; how far up a bee here is flicked */
float shimmer(vec2 p){
  float a = 0.0;
  for (int k = 0; k < 3; k++) {
    float P = 4.2, o = float(k)*1.4, n = floor((uT - o)/P), t = uT - o - n*P;
    vec2 c = vec2(-0.26 + 0.52*hsh(n*3.1 + float(k)), -0.12 - 0.22*hsh(n*5.7 + float(k)*2.0));
    float d = distance(p, c) - t*0.55;
    a = max(a, exp(-d*d/0.0016)*smoothstep(1.6, 0.6, t));
  }
  return a;
}`).replace('#include <begin_vertex>', `#include <begin_vertex>
  { float sh = shimmer(aUV), buzz = step(0.985, hsh(aRnd*13.0 + floor(uT*1.5)));
    if (aPart > 0.5 && aPart < 1.5) { float a = 1.45*sh + 0.06*sin(uT*3.0 + aRnd*20.0); vec2 q = transformed.xy - vec2(-0.0018, 0.0); transformed.xy = vec2(-0.0018, 0.0) + mat2(cos(a), sin(a), -sin(a), cos(a))*q; }
    if (aPart > 1.5) { float a = 0.5*sh + 0.35*buzz*sin(uT*90.0 + aRnd*6.0); transformed.y += a*0.002*(1.0 + transformed.x*120.0); transformed.z *= 1.0 + 0.6*sh; }
    transformed.x += 0.0004*sin(uT*1.3 + aRnd*40.0); }`);
    };
    inst.material = mat; inst.castShadow = false; inst.receiveShadow = true; inst.frustumCulled = false; g.add(inst);
    inst.onBeforeRender = () => { U.uT.value = clock.t ?? Mats.U.uTime.value; };
    g.userData.anim = t => { clock.t = t; U.uT.value = t; };
    return g;
  });

  M.add('wild/fireflies', (o = {}) => {
    const N = o.n || 900, Rw = o.r || 2.4, Rh = o.h || 1.4, Y = o.y ?? 2.6, R = rng(o.seed || 11), clock = { t: null };
    const pos = new Float32Array(N * 3), ph = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      /* (among the leaves of the crown's outer shell, more near its top) */
      let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1 || x * x + y * y + z * z < 0.45);
      pos.set([x * Rw, Y + y * Rh * (y > 0 ? 1 : 0.7), z * Rw], i * 3);
      const lone = R() < 0.12;
      ph.set([lone ? R() : 0.04 * R(), lone ? 0.7 + 0.6 * R() : 1, R() * 100, 0.6 + 0.8 * R()], i * 4);
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('aPh', new T.BufferAttribute(ph, 4));
    const U = { uT: { value: 0 }, uHz: { value: o.hz || 2.4 }, uCol: { value: new T.Color(o.col || '#c6ff5a') }, uSize: { value: o.size || 0.11 }, uOn: { value: o.on ?? 1 } };
    const mat = new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `attribute vec4 aPh; uniform float uT, uHz, uSize; varying float vI;
void main(){
  /* the beat they share (and the stragglers' own): a quick rise and a slower fade */
  float f = fract(uT*uHz*aPh.y + aPh.x), fl = smoothstep(0.0, 0.05, f)*exp(-f*11.0);
  vec3 p = position + 0.06*vec3(sin(uT*0.7*aPh.w + aPh.z), sin(uT*0.5*aPh.w + aPh.z*1.3)*0.6, cos(uT*0.6*aPh.w + aPh.z*0.7));
  vec4 mv = modelViewMatrix*vec4(p, 1.0); vI = fl;
  gl_PointSize = max(1.5, uSize*(0.4 + 0.6*fl)*1100.0/max(-mv.z, 0.1)); gl_Position = projectionMatrix*mv;
}`,
      fragmentShader: `uniform vec3 uCol; uniform float uOn; varying float vI;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d)*2.0, core = exp(-r*r*14.0), halo = exp(-r*r*3.0)*0.45;
  float a = (core + halo)*(0.05 + 0.95*vI)*uOn; if (a < 0.003) discard; gl_FragColor = vec4(uCol*(core*1.6 + halo)*a, a); }` });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.name = 'fireflies';
    pts.onBeforeRender = () => { U.uT.value = clock.t ?? Mats.U.uTime.value; };
    const g = new T.Group(); g.add(pts); g.name = 'fireflies';
    g.userData.anim = t => { clock.t = t; U.uT.value = t; };
    g.userData.uniforms = U;
    return g;
  });
})();
