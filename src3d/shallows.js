/* ─────────────────────────────────────────────────────────────
   shallows.js — more of the shore's small lives: kelp round the
   rocks that stand out in the water, its fronds rising from the
   bottom and their tops lying out along the surface, swaying in the
   swell; and hermit crabs in borrowed shells along the tide line,
   wandering, stopping, pulling into their shells when you come near.
   The kelp is laid round each chunk's rocks in the water as the
   chunk comes near (world.js decorate 'tiny'); the crabs follow the
   camera. Hermit crabs can be picked up (inspect.js).
   ───────────────────────────────────────────────────────────── */
const Shallows = (() => {
  const T = THREE, TAU = Math.PI * 2;
  /* a frond: a ribbon from the holdfast on the bottom up toward the light; whatever of it is longer than the water is
     deep lies out along the surface downstream, riding the waves. Seen through the water as the school fish are (drawn
     at the surface's own depth along the line of sight, tinted by the water over it, gone at a glancing angle) */
  const KELP_VS = `
${GLSL.WAVEH}
uniform float uTime;
attribute vec4 iK;   /* holdfast x, z, depth of the water there, phase */
attribute vec4 iL;   /* length, which way it streams, width, shade */
attribute float aH, aS;   /* along it (0 the holdfast, 1 the tip) and across it (−1..1) */
varying float vDepth, vH, vA, vShade, vLie, vS, vX; varying vec3 vW, vN;
void main(){
  float L = iL.x, d = iK.z, s = aH*L;
  float up = min(s, d - 0.04), lie = max(0.0, s - (d - 0.04));
  float sway = 0.45*sin(uTime*0.8 + iK.w) + 0.2*sin(uTime*1.9 + iK.w*2.3), k = up/max(d, 0.1);
  vec2 dir = vec2(cos(iL.y), sin(iL.y)), side = vec2(-dir.y, dir.x);
  vec3 w = vec3(iK.x, -d + up, iK.y);
  w.xz += dir*(lie + sway*k*k*0.9) + side*sway*k*0.3;
  /* (a stipe with its blades up through the water; where it lies out on the surface, a broad mat of them) */
  float lieK = smoothstep(0.0, 0.35, lie);
  float wid = mix(iL.z*0.55*(0.6 + 0.4*max(0.0, sin(s*14.0 + iK.w))), iL.z*2.6*(0.75 + 0.25*sin(s*5.0 + iK.w)), lieK);
  w.xz += side*aS*wid*0.5;
  vLie = lieK; vS = s; vX = aS;
  float hs = waveH(w.xz);
  if (lie > 0.0) w.y = hs - 0.012 + 0.01*aS*aS;
  w.y += aS*0.012*cos(s*7.0);
  vDepth = max(0.0, hs - w.y); vW = w; vH = aH; vShade = iL.w;
  vN = normalize(lie > 0.0 ? vec3(0.0, 1.0, 0.0) : vec3(side.x, 0.25, side.y));
  vA = smoothstep(0.0, 0.03, L);
  vec3 ray = w - cameraPosition; float kk = ray.y < -1e-4 ? clamp((hs + 0.012 - cameraPosition.y)/ray.y, 0.0, 1.0) : 1.0;
  gl_Position = projectionMatrix*viewMatrix*vec4(cameraPosition + ray*kk, 1.0);
}`;
  const KELP_FS = `
uniform vec3 uKeyDirT, uKeyColT, uAmbF; uniform float uDay;
varying float vDepth, vH, vA, vShade, vLie, vS, vX; varying vec3 vW, vN;
void main(){
  /* (the mat is many blades, slanting out from the stipe, with water between them) */
  float bl = sin(vS*24.0 - abs(vX)*6.0 + vShade*9.0);
  if (vLie > 0.05 && bl < -0.35 + 0.5*abs(vX)) discard;
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
  float tr = exp(-vDepth*1.3);
  /* olive-brown, golden where the sun comes through it, darker toward the holdfast */
  vec3 alb = mix(vec3(0.16, 0.11, 0.035), vec3(0.3, 0.22, 0.07), vH)*(0.85 + 0.3*vShade);
  vec3 L = uAmbF*0.8 + uKeyColT*(abs(dot(n, uKeyDirT))*0.8 + 0.25)*tr;
  vec3 col = alb*L;
  col = mix(vec3(0.025, 0.1, 0.1)*(uAmbF + uKeyColT*0.3), col, exp(-vDepth*0.9));
  float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
  float a = vA*(0.3 + 0.7*exp(-vDepth*0.75))*(1.0 - 0.8*fres)*(0.35 + 0.65*uDay);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

  function build(root, U, world) {
    const r = Textures.rng(4242);
    /* ── kelp ── */
    const NA = 28, rib = new T.BufferGeometry(), pos = [], aH = [], aS = [], idx = [];
    for (let i = 0; i <= NA; i++) for (const sd of [-1, 1]) { pos.push(0, 0, 0); aH.push(i / NA); aS.push(sd); }
    for (let i = 0; i < NA; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    rib.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rib.setAttribute('aH', new T.Float32BufferAttribute(aH, 1)); rib.setAttribute('aS', new T.Float32BufferAttribute(aS, 1)); rib.setIndex(idx);
    const kelpM = new T.ShaderMaterial({ uniforms: Object.assign({ uWaveT: U.uWaveT, uWv: U.uWv, uSurgeT: U.uSurgeT, uNUw: U.uNUw, uTime: Mats.U.uTime, uDay: U.uDay, uKeyDirT: Mats.U.uKeyDirT, uKeyColT: Mats.U.uKeyColT, uAmbF: Mats.U.uAmbF }, Mats.coastU),
      vertexShader: KELP_VS, fragmentShader: KELP_FS, transparent: true, depthWrite: false, side: T.DoubleSide });
    /* how deep the water is, roughly, this far out from the line of the waves */
    const depthAt = (x, z) => { const g = Layout.shoreDZ(x), s = (Layout.shoreZ(x) - z) / Math.sqrt(1 + g * g); return Math.max(0, Math.min(4.5, 0.12 * s + 0.15)); };
    if (world) world.decorate(ch => {
      const rs = ch.rng(77), K = [], Lb = [];
      for (const p of ch.wet) {
        if (p.rad < 0.55) continue;
        const n = 5 + Math.floor(rs() * 9);
        for (let i = 0; i < n; i++) {
          const a = rs() * TAU, d0 = p.rad * (1.05 + rs() * 1.6), x = p.x + Math.cos(a) * d0, z = p.z + Math.sin(a) * d0, dep = depthAt(x, z);
          if (dep < 0.7) continue;
          /* (they stream along the shore, the way the water runs past the rock) */
          const L = dep * (0.9 + rs() * 0.9) + 0.4 * rs(), flow = Math.atan2(Layout.shoreDZ(x), 1) + (rs() < 0.5 ? 0 : Math.PI) + (rs() - 0.5) * 0.8;
          K.push(x, z, dep, rs() * TAU); Lb.push(L, flow, 0.08 + 0.1 * rs(), rs());
        }
      }
      if (!K.length) return;
      const g = new T.InstancedBufferGeometry(); g.index = rib.index; for (const k of ['position', 'aH', 'aS']) g.setAttribute(k, rib.attributes[k]);
      g.setAttribute('iK', new T.InstancedBufferAttribute(new Float32Array(K), 4)); g.setAttribute('iL', new T.InstancedBufferAttribute(new Float32Array(Lb), 4)); g.instanceCount = K.length / 4;
      const m = new T.Mesh(ch.keep ? ch.keep(g) : g, kelpM); m.frustumCulled = false; m.renderOrder = 4; ch.tiny.add(m);
    }, 'tiny');

    /* ── hermit crabs along the tide line: a borrowed shell on its back, red legs and claws out in front; it wanders a
       little, stops, wanders on; comes near, and it pulls into its shell and is only a shell ── */
    const M = Models, red = [0.62, 0.14, 0.07];
    const shellG = (() => { const w = M.make('life/whelk', { tone: [0.42, 0.3, 0.18], lite: true }); w.updateMatrixWorld(true); let g = null; w.traverse(o => { if (o.isMesh && !g) { g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); } }); return g; })();
    shellG.rotateZ(0.35); shellG.rotateY(Math.PI); shellG.scale(0.85, 0.85, 0.85);
    { shellG.computeBoundingBox(); const c = shellG.boundingBox.getCenter(new T.Vector3()); shellG.translate(-0.005 - c.x, 0.017 - c.y, -c.z); }
    const bodyG = (() => {
      const parts = [];
      for (const sd of [-1, 1]) for (const x0 of [0.012, 0.006]) parts.push({ geo: M.tube(new T.CatmullRomCurve3([new T.Vector3(x0, 0.012, sd * 0.004), new T.Vector3(x0 + 0.008, 0.016, sd * 0.012), new T.Vector3(x0 + 0.014, 0.004, sd * 0.019)]), 6, 4, t => 0.0018 * (1 - 0.6 * t)), c: red });
      for (const [sd, k] of [[-1, 1.5], [1, 0.9]]) { const s = new T.SphereGeometry(1, 8, 6); s.scale(0.006 * k, 0.0035 * k, 0.003 * k); s.translate(0.03, 0.011, sd * 0.004); parts.push({ geo: s, c: red }); }
      for (const sd of [-1, 1]) { const e = new T.SphereGeometry(0.0015, 6, 5); e.translate(0.0225, 0.025, sd * 0.003); parts.push({ geo: e, c: [0.02, 0.02, 0.02] }); }
      return M.mergeC(parts);
    })();
    const NH = 10, hm = Mats.lit({ vertexColors: true, roughness: 0.4 }), shellI = new T.InstancedMesh(shellG, hm, NH), bodyI = new T.InstancedMesh(bodyG, hm, NH);
    shellI.count = bodyI.count = 0; shellI.frustumCulled = bodyI.frustumCulled = false; root.add(shellI, bodyI);
    const crabs = Array.from({ length: NH }, () => ({ x: NaN, z: 0, h: 0, st: 'walk', tm: 0, out: 1, size: 1.8 + r() * 0.8, held: false }));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), p3 = new T.Vector3();
    function place(c, cx) { for (let k = 0; k < 12; k++) { const x = cx + (r() - 0.5) * 50, sz = Layout.shoreZ(x), z = sz + 0.9 + r() * 2.4; if (world && world.massif(x, z) > 0.05) continue; if (Math.hypot(x - Layout.camp.x, z - Layout.camp.z) < 4) continue; Object.assign(c, { x, z, h: r() * TAU, st: 'walk', tm: 2 + r() * 4, out: 1 }); return; } }
    let lastT = null;
    function update(t, cam) {
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
      let n = 0;
      for (const c of crabs) {
        if (c.held) continue;
        if (c.x !== c.x || Math.abs(c.x - cam.x) > 40) place(c, cam.x);
        if (c.x !== c.x) continue;
        /* (a walker near: in it goes) */
        const near = cam.y < Math.max(0, world ? world.land(cam.x, cam.z) : 0) + 3 && Math.hypot(c.x - cam.x, c.z - cam.z) < 2.2;
        if (near) { c.st = 'hide'; c.tm = 2 + r() * 3; }
        if (c.st === 'walk') { c.x += Math.cos(c.h) * 0.06 * dt; c.z += Math.sin(c.h) * 0.06 * dt; c.h += (r() - 0.5) * dt * 2; const sz = Layout.shoreZ(c.x); if (c.z < sz + 0.6 || c.z > sz + 3.6) c.h += Math.PI * dt * 2; if ((c.tm -= dt) <= 0) { c.st = 'stop'; c.tm = 1 + r() * 4; } c.out = Math.min(1, c.out + dt * 3); }
        else if (c.st === 'stop') { if ((c.tm -= dt) <= 0) { c.st = 'walk'; c.tm = 2 + r() * 5; } c.out = Math.min(1, c.out + dt * 3); }
        else if (c.st === 'hide') { c.out = Math.max(0, c.out - dt * 5); if (!near && (c.tm -= dt) <= 0) c.st = 'stop'; }
        e.set(0, -c.h, 0); q.setFromEuler(e); sc.setScalar(c.size); p3.set(c.x, 0.0, c.z); m4.compose(p3, q, sc); shellI.setMatrixAt(n, m4);
        sc.set(c.size * (0.3 + 0.7 * c.out), c.size * (0.3 + 0.7 * c.out), c.size * c.out); p3.set(c.x - Math.cos(c.h) * 0.01 * (1 - c.out), 0, c.z - Math.sin(c.h) * 0.01 * (1 - c.out)); m4.compose(p3, q, sc); bodyI.setMatrixAt(n, m4);
        c.slot = n; n++;
      }
      shellI.count = bodyI.count = n; shellI.instanceMatrix.needsUpdate = bodyI.instanceMatrix.needsUpdate = true;
    }
    /* for picking up (inspect.js); thrown in the sea, it comes back up the beach somewhere further along */
    function pickables(list, cam) {
      for (const c of crabs) {
        if (c.held || c.x !== c.x) continue;
        list.push({ kind: 'hermit', x: c.x, y: 0.02, z: c.z, r: 0.06 * c.size, yaw: -c.h, size: c.size, reach: 26,
          take() { c.held = true; }, give(how) { c.held = false; if (how !== 'back') { c.x = NaN; } } });
      }
    }
    function shift(dx, dz) { for (const c of crabs) { c.x += dx; c.z += dz; } }
    return { update, pickables, shift, get count() { return crabs.filter(c => c.x === c.x).length; }, debug: { shellI, bodyI, crabs } };
  }
  return { build };
})();
