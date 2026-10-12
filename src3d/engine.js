/* ─────────────────────────────────────────────────────────────
   engine.js — assembles the cove, updates it per frame from the
   live sky, renders through HDR bloom + filmic finish.
   ───────────────────────────────────────────────────────────── */
const Engine = (() => {
  const T = THREE;
  /* the public face of the engine. Features add to it right where they are written, with
     Object.assign(api, { … }), rather than all through one long return line */
  const api = {};
  let R, scene, camera, keyLight, hemi, camp, nature, fx, post, canvas;
  let skyMat, groundMat, skyU, gU, uBulb, uFairy, shadowReady = false;
  let fireS, canS, canDone = false, depthOnly, paper = null, world = null, life = null, lifeT = null, nearMesh = null, nearX = 0, skyMesh = null, groundMesh = null;
  const cork = { k: 0, to: 0, t0: 0, p0: null, r0: null };
  let envSkyMat, envScene, pmrem, n3Tex, noiseT, marks = null;
  const vanS = { k: 0, brake: 0, head: 0, moved: false };
  const BIAS = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const hash = x => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  /* the environment light (see envStep): a small cube of the sky, prefiltered, rebuilt one face a frame at most every
     ENV_EVERY seconds and only when the sky has changed enough to see, then blended in over ENV_FADE seconds */
  const ENV_SIZE = 128, ENV_EVERY = 1.6, ENV_FADE = 1.4;
  const env = { cube: null, cam: null, out: null, from: null, to: null, mat: null, qs: null, qc: null, face: -1, at: -1e9, k: 1, want: new Float64Array(8), built: new Float64Array(8).fill(NaN) };
  /* scratch for render(): a frame makes no garbage of its own */
  const R3 = { key: new T.Vector3(), top: new T.Vector3(), side: new T.Vector3(), right: new T.Vector3(), fc: new T.Vector3() }, haze4 = new T.Vector4();
  const Lw = { string: 0, lantern: 0, van: 0, fairy: 0 }, Fw = { i: 0, smoke: 0, steam: 0 };
  const fxP = { smokeLo: new T.Vector3(), smokeHi: new T.Vector3(), steamLo: new T.Vector3(), steamHi: new T.Vector3(), bfly: [0, 0, 0] };
  const ppFire = { dbg: 0, I: 0, flick: 0, t: 0, fc: R3.fc, n3: null }, pp = {};
  const setV = (u, a) => u.value.set(a[0], a[1], a[2]);

  function vanFlicker(t) {
    const k = Math.floor(t * 8), f = t * 8 - k, dip = x => { const h = hash(x); return h > 0.88 ? (h - 0.88) * 5.5 : 0; };
    return Math.max(0.25, 1 - (dip(k) + (dip(k + 1) - dip(k)) * f) + 0.025 * Math.sin(t * 13.7));
  }
  const fireFlicker = t => 0.55 + 0.2 * Math.sin(t * 10.7) + 0.13 * Math.sin(t * 23.1 + 1.3) + 0.12 * Math.sin(t * 4.9 + 0.4);
  const candleFlicker = (t, s) => 0.86 + 0.08 * Math.sin(t * 9.1 + s * 13) + 0.06 * Math.sin(t * 23 + s * 7);

  function makePost() {
    const qs = new T.Scene(), qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
    const mk = (fs, u, blending = T.NoBlending) => new T.ShaderMaterial({ uniforms: u, vertexShader: GLSL.QUAD_VS, fragmentShader: fs, blending, depthTest: false, depthWrite: false });
    const down = mk(GLSL.DOWN_FS, { uSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThresh: { value: 1 }, uPre: { value: 0 }, uExp: { value: 1 } });
    const up = mk(GLSL.UP_FS, { uSrc: { value: null }, uTexel: { value: new T.Vector2() } }, T.AdditiveBlending);
    const fin = mk(GLSL.FINAL_FS, { uScene: { value: null }, uBloom: { value: null }, uDof: { value: null }, uRes: { value: new T.Vector2() }, uExp: { value: 1 }, uBloomK: { value: 0.6 }, uFade: { value: 1 }, uTime: { value: 0 }, uNight: { value: 1 }, uDofOn: { value: 0 }, uGrain: { value: 0 }, uVeil: { value: 0 } });
    const dof = mk(GLSL.DOF_FS, { uScene: { value: null }, uDepth: { value: null }, uTexel: { value: new T.Vector2() }, uK: { value: 0 }, uZf: { value: 20 }, uNear: { value: 0.1 }, uFar: { value: 9000 }, uMax: { value: 10 } });
    const ssao = mk(GLSL.SSAO_FS, { uDepth: { value: null }, uTexel: { value: new T.Vector2() }, uProj: { value: new T.Matrix4() }, uInvProj: { value: new T.Matrix4() }, uRad: { value: 0.4 } });
    const aob = mk(GLSL.AOBLUR_FS, { uAO: { value: null }, uDepth: { value: null }, uTexel: { value: new T.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 9000 } });
    const fire = mk(GLSL.FIRE_FS, { uDepth: { value: null }, uN3: { value: null }, uInvProj: { value: new T.Matrix4() }, uCamW: { value: new T.Matrix4() }, uCamP: { value: new T.Vector3() }, uFC: { value: new T.Vector3() }, uT: { value: 0 }, uI: { value: 1 }, uFlick: { value: 0.5 }, uDbgF: { value: 0 } });
    Object.assign(fin.uniforms, { uAO: { value: null }, uFire: { value: null }, uAOk: { value: 0 }, uFireOn: { value: 0 }, uHaze: { value: new T.Vector4() }, uNoiseT: { value: null }, uRain: { value: 0 }, uRainT: { value: 0 }, uRainSlant: { value: 0.12 } });
    Object.assign(down.uniforms, { uFire: { value: null }, uFireOn: { value: 0 } });
    let rt = null, bl = [], dofRT = null, aoRT = null, aoBRT = null, fireRT = null, W = 0, H = 0, S = 0;
    function resize(w, h, samples) {
      if (w === W && h === H && samples === S) return;
      W = w; H = h; S = samples;
      if (rt) { rt.dispose(); rt.depthTexture.dispose(); bl.forEach(b => b.dispose()); dofRT.dispose(); aoRT.dispose(); aoBRT.dispose(); fireRT.dispose(); }
      const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      aoRT = new T.WebGLRenderTarget(hw, hh, { depthBuffer: false }); aoBRT = new T.WebGLRenderTarget(hw, hh, { depthBuffer: false });
      fireRT = new T.WebGLRenderTarget(hw, hh, { type: T.HalfFloatType, depthBuffer: false });
      rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples, depthBuffer: true });
      rt.depthTexture = new T.DepthTexture(w, h);
      dofRT = new T.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { type: T.HalfFloatType, depthBuffer: false });
      bl = []; let bw = w, bh = h;
      for (let i = 0; i < 6; i++) { bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); bl.push(new T.WebGLRenderTarget(bw, bh, { type: T.HalfFloatType, depthBuffer: false })); }
    }
    function render(p) {
      const sync = () => { if (p.prof) { const g = R.getContext(); g.finish(); const fb = g.getParameter(g.FRAMEBUFFER_BINDING); if (fb) { const px = new Float32Array(4); g.readPixels(0, 0, 1, 1, g.RGBA, g.FLOAT, px); } else { const px = new Uint8Array(4); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); } p.prof.push(performance.now()); } };
      sync();
      R.setRenderTarget(rt); R.clear(); R.render(scene, camera);
      if (p.ao > 0.01) {
        const a = ssao.uniforms; a.uDepth.value = rt.depthTexture; a.uTexel.value.set(1 / rt.width, 1 / rt.height);
        a.uProj.value.copy(camera.projectionMatrix); a.uInvProj.value.copy(camera.projectionMatrixInverse); a.uRad.value = 0.42;
        quad.material = ssao; R.setRenderTarget(aoRT); R.render(qs, qc);
        const b = aob.uniforms; b.uAO.value = aoRT.texture; b.uDepth.value = rt.depthTexture; b.uTexel.value.set(1 / aoRT.width, 1 / aoRT.height); b.uNear.value = camera.near; b.uFar.value = camera.far;
        quad.material = aob; R.setRenderTarget(aoBRT); R.render(qs, qc);
      }
      const fireOn = p.fire && p.fire.I > 0.002;
      if (fireOn) {
        const f = fire.uniforms; f.uDepth.value = rt.depthTexture; f.uN3.value = p.fire.n3; f.uInvProj.value.copy(camera.projectionMatrixInverse); f.uCamW.value.copy(camera.matrixWorld);
        f.uCamP.value.copy(camera.position); f.uFC.value.copy(p.fire.fc); f.uT.value = p.fire.t; f.uI.value = p.fire.I; f.uFlick.value = p.fire.flick; f.uDbgF.value = p.fire.dbg || 0;
        quad.material = fire; R.setRenderTarget(fireRT); R.render(qs, qc);
      }
      down.uniforms.uFire.value = fireRT.texture; down.uniforms.uFireOn.value = fireOn ? 1 : 0;
      sync();
      quad.material = down; let src = rt;
      bl.forEach((dst, i) => {
        const u = down.uniforms; u.uSrc.value = src.texture; u.uTexel.value.set(1 / src.width, 1 / src.height);
        u.uPre.value = i === 0 ? 1 : 0; u.uExp.value = p.exp; u.uThresh.value = p.thresh;
        R.setRenderTarget(dst); R.render(qs, qc); src = dst;
      });
      quad.material = up; R.autoClear = false;
      for (let i = bl.length - 1; i > 0; i--) { up.uniforms.uSrc.value = bl[i].texture; up.uniforms.uTexel.value.set(0.5 / bl[i].width, 0.5 / bl[i].height); R.setRenderTarget(bl[i - 1]); R.render(qs, qc); }
      R.autoClear = true;
      if (p.dofK > 0.05) {
        const d = dof.uniforms; d.uScene.value = rt.texture; d.uDepth.value = rt.depthTexture; d.uTexel.value.set(1 / rt.width, 1 / rt.height);
        const sc = rt.height / 1080; d.uK.value = p.dofK * sc; d.uMax.value = 11 * sc; d.uZf.value = p.focus; d.uNear.value = camera.near; d.uFar.value = camera.far;
        quad.material = dof; R.setRenderTarget(dofRT); R.render(qs, qc);
      }
      sync();
      quad.material = fin; const u = fin.uniforms;
      u.uDof.value = dofRT.texture; u.uDofOn.value = p.dofK > 0.05 ? 1 : 0; u.uGrain.value = p.grain || 0; u.uVeil.value = p.veil || 0;
      u.uAO.value = aoBRT.texture; u.uAOk.value = p.ao || 0; u.uFire.value = fireRT.texture; u.uFireOn.value = fireOn ? 1 : 0;
      u.uHaze.value.copy(p.haze || new T.Vector4()); u.uNoiseT.value = p.noiseT; u.uRain.value = p.rain || 0; u.uRainT.value = performance.now() / 1000; u.uRainSlant.value = p.rainSlant ?? 0.12;
      u.uScene.value = rt.texture; u.uBloom.value = bl[0].texture; u.uRes.value.set(canvas.width, canvas.height);
      u.uExp.value = p.exp; u.uBloomK.value = p.bloomK; u.uFade.value = p.fade; u.uTime.value = p.t; u.uNight.value = p.night;
      R.setRenderTarget(null); R.render(qs, qc);
      sync();
    }
    /* for warming up: every pass's material, and a way to compile one */
    const compile = m => { quad.material = m; R.compile(qs, qc); };
    return { resize, render, materials: [down, up, fin, dof, ssao, aob, fire], compile };
  }

  /* small depth maps seen from the campfire and from the middle of the string-light canopy:
     they let the fire and the bulbs cast real shadows across the sand and the props */
  function localShadow(fov, near, far, layer, size) {
    const cam = new T.PerspectiveCamera(fov, 1, near, far); cam.up.set(0, 0, -1); cam.layers.set(layer);
    const rt = new T.WebGLRenderTarget(size, size, { depthBuffer: true });
    rt.depthTexture = new T.DepthTexture(size, size); rt.depthTexture.compareFunction = T.LessEqualCompare;
    rt.depthTexture.minFilter = rt.depthTexture.magFilter = T.LinearFilter;
    return { cam, rt, M: new T.Matrix4() };
  }
  function tagLocalCasters(root) {
    root.updateMatrixWorld(true);
    const box = new T.Box3(), c = new T.Vector3(), F = Layout.fire, G = Layout.rug;
    let nf = 0, nc = 0;
    root.traverse(o => {
      if (!o.isMesh || !o.castShadow) return;
      box.setFromObject(o); box.getCenter(c);
      const rad = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5;
      if (!o.userData.noFireShadow && box.min.y < 0.5 && Math.hypot(c.x - F.x, c.z - F.z) - rad < 7.5) { o.layers.enable(2); nf++; }
      if (box.min.y < 2.4 && Math.hypot(c.x - G.x, c.z - G.z) - rad < 9.5) { o.layers.enable(3); nc++; }
    });
    return [nf, nc];
  }
  function renderLocal(s, x, y, z) {
    s.cam.position.set(x, y, z); s.cam.lookAt(x, 0, z); s.cam.updateMatrixWorld();
    s.M.copy(BIAS).multiply(s.cam.projectionMatrix).multiply(s.cam.matrixWorldInverse);
    const au = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false;
    scene.overrideMaterial = depthOnly;
    R.setRenderTarget(s.rt); R.clear(true, true, false); R.render(scene, s.cam);
    scene.overrideMaterial = null; R.shadowMap.autoUpdate = au; R.setRenderTarget(null);
  }

  /* ── the environment light. Every glossy thing in the cove (the van's paint and windows, the kettle, the bottle)
     reflects the sky through a prefiltered cube map of it. Making that map is the dearest thing a frame can do, and
     at a thousand times the speed of life the sky changes every few frames, so:
       · it is remade only when the sun, the moon, the phase or the clouds have changed enough to see, and at most
         every ENV_EVERY seconds;
       · one face of the cube is drawn per frame, and the prefiltering takes a seventh frame;
       · every target is made once, and the map the materials sample is never swapped for another one (a new
         texture has three look over every material again);
       · the new map is blended in over ENV_FADE seconds, so the light on things never pops ── */
  function envInit() {
    env.cube = new T.WebGLCubeRenderTarget(ENV_SIZE, { type: T.HalfFloatType });
    env.cam = new T.CubeCamera(0.1, 1000, env.cube); env.cam.updateMatrixWorld(true);
    /* three prefiltered maps of one size: the one the materials sample, and the two it is blended between */
    env.out = pmrem.fromCubemap(env.cube.texture); env.from = pmrem.fromCubemap(env.cube.texture); env.to = pmrem.fromCubemap(env.cube.texture);
    env.mat = new T.ShaderMaterial({ uniforms: { uA: { value: null }, uB: { value: null }, uK: { value: 0 } }, vertexShader: GLSL.QUAD_VS,
      fragmentShader: 'uniform sampler2D uA, uB; uniform float uK; void main(){ ivec2 p = ivec2(gl_FragCoord.xy); gl_FragColor = mix(texelFetch(uA, p, 0), texelFetch(uB, p, 0), uK); }',
      depthTest: false, depthWrite: false, blending: T.NoBlending });
    env.qs = new T.Scene(); env.qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    { const q = new T.Mesh(new T.PlaneGeometry(2, 2), env.mat); q.frustumCulled = false; env.qs.add(q); }
    scene.environment = env.out.texture;
  }
  const envFace = i => { R.setRenderTarget(env.cube, i); R.render(envScene, env.cam.children[i]); };
  function envPass(a, b, k, dst) { const u = env.mat.uniforms; u.uA.value = a.texture; u.uB.value = b.texture; u.uK.value = k; R.setRenderTarget(dst); R.render(env.qs, env.qc); }
  function envStep(S, now, on) {
    scene.environment = on ? env.out.texture : null;
    if (!on) return;
    /* what the map shows, coarsely: the sun and the moon to half a degree, the phase, each kind of cloud to a tenth */
    const su = skyMat.uniforms, w = env.want, first = Number.isNaN(env.built[0]);
    w[0] = Math.round(S.sAlt * 2); w[1] = Math.round(S.mAlt * 2); w[2] = Math.round(S.illum.fraction * 50);
    w[3] = Math.round(su.uCirrus.value * 10); w[4] = Math.round(su.uAlto.value * 10); w[5] = Math.round(su.uCumulus.value * 10); w[6] = Math.round(su.uStratus.value * 10); w[7] = Math.round(su.uStorm.value * 10);
    let changed = false; for (let i = 0; i < 8; i++) if (w[i] !== env.built[i]) { changed = true; break; }
    if (env.face < 0 && changed && (first || now - env.at >= ENV_EVERY)) { env.built.set(w); env.face = 0; }
    if (first && env.face === 0) {
      /* the first map goes in whole, at once: there is nothing to blend from */
      for (let i = 0; i < 6; i++) envFace(i);
      pmrem.fromCubemap(env.cube.texture, env.out); env.face = -1; env.at = now; env.k = 1;
    } else if (env.face >= 0 && env.face < 6) envFace(env.face++);
    else if (env.face === 6) {
      /* whatever shows now, even halfway through a blend, is where the next blend starts */
      envPass(env.out, env.out, 0, env.from);
      pmrem.fromCubemap(env.cube.texture, env.to);
      env.face = -1; env.at = now; env.k = 0;
    }
    if (env.k < 1) { const k = Math.min(1, (now - env.at) / ENV_FADE); envPass(env.from, env.to, k * k * (3 - 2 * k), env.out); env.k = k; }
    R.setRenderTarget(null);
  }

  /* ── compile every material the cove can draw before its first frame, so the first frames only draw, and nothing
     stops to compile later on, when the butterflies come out at sunrise or a lantern goes up. Where the browser
     compiles in parallel, everything is handed over (a slice at a time) and then only polled; elsewhere it goes a
     couple of programs at a time, each batch finished before the next, with a frame between, so the page and its
     loader keep breathing. Resolves once all of it is ready; anything missed simply compiles when first drawn ── */
  function warm() {
    const jobs = [], seen = new Set();
    /* one job per distinct program: the material, and what about its mesh changes the program */
    const variant = o => { const g = o.geometry || {}, a = g.attributes || {}, m = o.material;
      return [Array.isArray(m) ? m.map(x => x.id).join(',') : m.id, o.isInstancedMesh ? (o.instanceColor ? 2 : 1) : 0, o.isSkinnedMesh ? 1 : 0, o.receiveShadow ? 1 : 0, a.color ? a.color.itemSize : 0, a.tangent ? 1 : 0, a.uv1 ? 1 : 0, g.morphAttributes ? Object.keys(g.morphAttributes).length : 0].join('|'); };
    scene.traverse(o => { if (!o.material) return; const k = variant(o); if (!seen.has(k)) { seen.add(k); jobs.push(() => R.compile(o, camera, scene)); } });
    post.materials.forEach(m => jobs.push(() => post.compile(m)));
    jobs.push(() => R.compile(envScene, env.cam.children[0]), () => R.compile(env.qs, env.qc));
    const parallel = R.extensions.has('KHR_parallel_shader_compile'), P = R.info.programs, issued = [];
    const later = fn => requestAnimationFrame(() => setTimeout(fn, 0));
    return new Promise(done => {
      let i = 0;
      const step = () => { try {
        const n0 = P.length, t0 = performance.now();
        while (i < jobs.length && (parallel || P.length - n0 < 2) && performance.now() - t0 < 24) { try { jobs[i](); } catch (e) { /* it compiles when first drawn instead */ } i++; }
        const fresh = P.slice(n0); issued.push(...fresh);
        if (!parallel) fresh.forEach(p => { try { p.getUniforms(); } catch (e) { /* reported when drawn */ } });   /* waits for this batch to finish */
        if (i < jobs.length) return later(step);
        const ready = () => { try { if (parallel && !issued.every(p => p.isReady())) return setTimeout(ready, 16); } catch (e) { /* draw anyway */ } done(); };
        ready();
      } catch (e) { done(); } };
      step();
    });
  }

  /* ── interactive sea: a click on the water raises a ripple ring and sends a swell to the beach;
     clicks in quick succession stack into one bigger swell, and a big one runs up the sand,
     douses the fire, kills the lights and tumbles whatever it reaches ── */
  const WCJ = 1.55, TSJ = 7.0, U0J = 0.38;
  const sm01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const surge = { ripples: [], waves: [], combo: 0, lastT: -1e9, dyn: [], fireOut: null, lightsOut: null, lantOut: [null, null, null], candleOut: null, vanHit: null, rugWet: null, rng: null };
  const shoreDZ = x => Layout.shoreDZ(x);
  const sOf = (x, z) => { const g = shoreDZ(x); return (Layout.shoreZ(x) - z) / Math.sqrt(1 + g * g); };
  const nBof = a => 0.5 + 0.3 * Math.sin(a * 0.23 + 2.1) + 0.2 * Math.sin(a * 0.097 + 1.7);
  const runK = (nB, a) => 0.72 + 0.4 * nB + 0.16 * Math.sin(a * 0.43 + 0.8) + 0.1 * Math.sin(a * 0.79 + 2.3);   /* as in the ground shader */
  const tsOf = amp => TSJ * (0.85 + 0.15 * Math.max(amp, 1));
  /* each wave's run-up ends in tongues, exactly as the ground shader draws them (it hashes the same integers the same
     way): big lobes a few metres across and small ones about a metre, rounded, with cusps between, new for every wave */
  const hashU = n => { n = (n ^ 61 ^ (n >>> 16)) >>> 0; n = Math.imul(n, 9) >>> 0; n = (n ^ (n >>> 4)) >>> 0; n = Math.imul(n, 0x27d4eb2d) >>> 0; return (n ^ (n >>> 15)) >>> 0; };
  function lobes(a, cw, sd) {
    const c = Math.floor(a / cw); let m = 0;
    for (let i = -1; i <= 1; i++) {
      const ci = c + i, h = hashU((Math.imul(ci + 1048576, 0x9E3779B1) ^ sd) >>> 0);
      const d = (a - (ci + 0.2 + 0.6 * (h & 1023) / 1023) * cw) / (cw * (0.55 + 0.45 * ((h >>> 10) & 1023) / 1023));
      m = Math.max(m, (0.3 + 0.7 * ((h >>> 20) & 1023) / 1023) * Math.sqrt(Math.max(0, 1 - d * d)));
    }
    return m;
  }
  /* [how far up the sand a wave of amplitude amp runs at x, how much later than the plain front its edge gets there] */
  function reach(a, amp, sd) {
    const hb = hashU(sd), hs = hashU((sd ^ 0x5bd1e995) >>> 0);
    const Lb = lobes(a, 3.4 + 3.0 * (hb & 255) / 255, hb), Ls = lobes(a, 0.9 + 0.7 * (hs & 255) / 255, hs);
    return [(0.85 + 0.75 * amp) * runK(nBof(a), a) * (0.5 + 0.4 * Lb + 0.42 * Ls), 0.6 * (Lb - 0.5)];
  }
  /* the seeds the shader uses: a clicked swell's from when it lands, a tide swell's from its phase (as the GPU's floats) */
  const seedU = w => Math.floor(Math.fround(w.x) * 64), seedW = W => Math.floor(Math.fround(W.z) * 4096);
  /* where the water's edge is, a fraction u of the way through a swash that runs up to R: the front climbing, then the
     sheet draining back (the shader breaks that edge up into patches and rills; this is its mean) */
  const swashEdge = (R, u) => u < U0J ? R * (1 - Math.pow(1 - u / U0J, 2)) : R * (1 - Math.pow((u - U0J) / (1 - U0J), 1.6));
  function seaPick(nx, ny) {
    const v = new T.Vector3(nx * 2 - 1, -(ny * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize();
    if (v.y >= -1e-4) return null;
    const k = -camera.position.y / v.y, x = camera.position.x + v.x * k, z = camera.position.z + v.z * k;
    return { x, z, s: sOf(x, z) };
  }
  const CU = 4.2;
  function clickSea(nx, ny, wt) {
    const h = seaPick(nx, ny); if (!h || h.s < 0.8) return null;
    surge.combo = wt - surge.lastT < 2.8 ? surge.combo + 1 : 1; surge.lastT = wt;
    surge.ripples.push({ x: h.x, z: h.z, t0: wt, A: 0.9 }); if (surge.ripples.length > 6) surge.ripples.shift();
    const s0 = Math.min(Math.max(h.s, 7), 42);
    /* clicks close together in time and place stack into one taller swell */
    let w = surge.waves.find(q => q.x - wt > 1.2 && Math.abs(q.xc - h.x) < 14 && wt - q.t0 < 4.5);
    if (w) { w.amp = Math.min(7.5, w.amp + 1.15); w.xc += (h.x - w.xc) * 0.3; }
    else { w = { t0: wt, x: wt + s0 / CU, amp: 1.5, xc: h.x, s0 }; surge.waves.push(w); }
    surge.waves = surge.waves.filter(q => wt - q.x < tsOf(q.amp) + 15).slice(-3);   /* as long as the shader still draws its wet sand */
    return { x: h.x, z: h.z, combo: surge.combo, amp: w.amp, eta: w.x - wt, reach: (0.85 + 0.75 * w.amp) };
  }
  const userAmpJS = (w, x, wt) => { const sc = Math.max(w.s0 - (wt - (w.x - w.s0 / CU)) * CU, 0), hw = Math.min(4 + 0.9 * (w.s0 - sc), 46), dx = (x - w.xc) / hw;
    const along = 0.82 + 0.36 * (0.5 + 0.25 * Math.sin(x * 0.31 + w.xc) + 0.25 * Math.sin(x * 0.13 + 1.7 * w.xc)); return w.amp * along * Math.exp(-dx * dx); };
  /* is (x, z) under the swash of a click-swell at time wt? (mirrors the ground shader, tongues and all) */
  function swashAt(x, z, wt) {
    const r = -sOf(x, z); let best = null;
    for (const w of surge.waves) {
      const amp = userAmpJS(w, x, wt); if (amp < 0.05) continue;
      const T_ = tsOf(amp), [R, dl] = reach(x, amp, seedU(w)), u = (wt - w.x - dl) / T_;
      if (u <= 0 || u >= 1 || r > R) continue;
      if (r < swashEdge(R, u)) best = { R, r, depth: R - r, tPeak: w.x + dl + U0J * T_, tEnd: w.x + dl + T_, back: u > U0J };
    }
    return best;
  }
  const UP = new T.Vector3(0, 1, 0), _q = new T.Quaternion(), _v = new T.Vector3(), _pv = new T.Vector3();
  function registerDyn(list) {
    surge.dyn = list.map(d => {
      d.o.updateMatrixWorld(true);
      const wp = d.o.getWorldPosition(new T.Vector3()), g = shoreDZ(wp.x), Lw = new T.Vector3(-g, 0, 1).normalize();
      const pq = d.o.parent.getWorldQuaternion(new T.Quaternion()).invert();
      const L = Lw.clone().applyQuaternion(pq); L.y = 0; L.normalize();
      return Object.assign(d, { wx: wp.x, wz: wp.z, p0: d.o.position.clone(), q0: d.o.quaternion.clone(), P0: d.o.position.clone(), Q0: d.o.quaternion.clone(), L, L0: L.clone(), S: new T.Vector3().crossVectors(UP, L), axis: new T.Vector3().crossVectors(UP, L).normalize(), hit: null });
    });
  }
  function updateSurge(wt) {
    if (surge.dyn.some(d => d.hit && wt < d.hit.tEnd + 1)) canDone = false;
    const at = (x, z) => { const c = swashAt(x, z, wt); return c && !c.back && c.depth > 0.04; };
    if (surge.fireOut == null && at(Layout.fire.x, Layout.fire.z)) surge.fireOut = wt;
    if (surge.lightsOut == null && Layout.poles.some(([x, z]) => at(x, z))) surge.lightsOut = wt;
    if (surge.rugWet == null && at(Layout.rug.x, Layout.rug.z - 0.8)) surge.rugWet = wt;
    if (surge.vanHit == null && at(Layout.van.x, Layout.van.z)) surge.vanHit = wt;
    for (const d of surge.dyn) {
      if (!d.hit) {
        const c = swashAt(d.wx, d.wz, wt);
        if (!c || c.back || c.depth < 0.04) continue;
        d.hit = Object.assign({ t: wt, seed: surge.rng() }, c);
        if (d.lantern !== undefined) surge.lantOut[d.lantern] = wt;
        if (d.candle) surge.candleOut = wt;
      }
      const h = d.hit, k = d.heavy ? 0.2 : (d.kind === 'float' || d.float) ? 1.3 : d.kind === 'fall' ? 0.45 : 0.75;
      const push = Math.min(2.2, 0.35 + h.depth * 0.45) * k;
      const e1 = sm01(h.t, h.t + 1.2, wt), e2 = sm01(h.tPeak, h.tEnd, wt);
      let along = push * e1 - (h.knock ? 0 : push * e2 * ((d.kind === 'float' || d.float) ? 1.1 : 0.45));
      if (d.seaward) along = -push * e1 - 3.0 * e2;
      const tipA = (d.tip || 0) * sm01(h.t, h.t + (d.kind === 'fall' ? 1.5 : 0.85), wt);
      const bob = (d.kind === 'float' || d.float) && !h.knock ? 0.045 * Math.sin(wt * 5 + h.seed * 9) * e1 * (1 - e2) : 0;
      const side = (h.seed - 0.5) * 0.7 * push * e1;
      _q.setFromAxisAngle(d.axis, tipA);
      _pv.set(d.p0.x, 0, d.p0.z).addScaledVector(d.L, d.half || 0.2);
      _v.copy(d.p0).sub(_pv).applyQuaternion(_q).add(_pv);
      d.o.position.copy(_v).addScaledVector(d.L, along).addScaledVector(d.S, side); d.o.position.y += bob - 0.03 * e1 * (d.kind === 'float' ? 0 : 1);
      d.o.quaternion.copy(_q).multiply(d.q0);
      if ((d.kind === 'float' || d.float) && e1 > 0) { _q.setFromAxisAngle(UP, (h.seed - 0.5) * 2.0 * e1 + 0.3 * Math.sin(wt * 0.7 + h.seed * 5) * e1 * (1 - e2)); d.o.quaternion.premultiply(_q); }
    }
  }
  function rebuildCamp() {
    for (const d of surge.dyn) { d.p0.copy(d.P0); d.q0.copy(d.Q0); d.o.position.copy(d.p0); d.o.quaternion.copy(d.q0); d.hit = null; }
    Object.assign(surge, { waves: [], fireOut: null, lightsOut: null, lantOut: [null, null, null], candleOut: null, vanHit: null, rugWet: null, combo: 0 });
    if (camp.rugMat) camp.rugMat.color.setRGB(1, 1, 1);
    canDone = false;
    surge.dyn.forEach(d => { if (d.L0) { d.L.copy(d.L0); d.S.crossVectors(UP, d.L); d.axis.copy(d.S).normalize(); } });
  }
  /* ── pitching camp somewhere new. moveCamp: while the screen is dark, the coast is moved under the camp (the camp
     stays where it is in the world, the beach it stands on changes): the world is built again round it, the tide's
     mess and the old tracks are gone. pitchStart: then everything goes up again, one thing at a time ── */
  const pitch = { on: false, t0: 0, items: null, k: { string: 1, lantern: 1, fire: 1 } };
  function pitchList() {
    const L = [], add = (o, t, d, kind) => { if (o) L.push({ o, t, d, kind, p: o.position.clone(), s: o.scale.clone() }); };
    add(camp.rugMesh, 1.1, 0.9, 'unroll');
    add(camp.table, 1.8, 0.55, 'grow');
    (camp.cushions || []).forEach((o, i) => add(o, 2.1 + i * 0.1, 0.35, 'grow'));
    add(camp.basket, 2.5, 0.4, 'grow'); add(camp.bookLoose, 2.6, 0.3, 'grow');
    (camp.chairs || []).forEach((o, i) => add(o, 2.8 + i * 0.3, 0.5, 'grow'));
    (camp.poles || []).forEach((o, i) => add(o, 3.4 + i * 0.14, 0.55, 'rise'));
    (camp.poleCaps || []).forEach((o, i) => add(o, 3.4 + i * 0.14, 0.55, 'lift'));
    (camp.strands || []).forEach(o => add(o, 4.2, 0.05, 'show')); add(camp.bulbMesh, 4.2, 0.05, 'show');
    (camp.lanternGroups || []).forEach((o, i) => add(o, 4.8 + i * 0.2, 0.4, 'grow'));
    add(camp.fireGroup, 5.3, 0.6, 'grow'); add(camp.tripod, 5.9, 0.45, 'grow'); add(camp.mug, 6.3, 0.3, 'grow'); add(camp.kettle, 6.6, 0.35, 'grow');
    add(camp.woodpile, 6.0, 0.45, 'grow'); add(camp.logRound, 6.2, 0.4, 'grow'); add(camp.driftwood, 6.4, 0.5, 'grow'); add(camp.bottle, 6.5, 0.4, 'grow');
    if (camp.board) add(camp.board.group, 6.8, 0.6, 'grow');
    return L;
  }
  const backOut = u => { const c = 1.5; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  function pitchPose(it, u) {
    const o = it.o; u = Math.min(1, u);
    o.visible = u > 0; if (u <= 0) return;
    const e = u >= 1 ? 1 : Math.max(1e-3, backOut(u));
    if (it.kind === 'grow') o.scale.copy(it.s).multiplyScalar(e);
    else if (it.kind === 'rise') { o.scale.set(it.s.x, it.s.y * Math.min(1, e), it.s.z); o.position.y = it.p.y * Math.min(1, e); }
    else if (it.kind === 'lift') o.position.y = it.p.y * Math.min(1, e);
    else if (it.kind === 'unroll') { const w = u >= 1 ? 1 : Math.max(1e-3, 1 - Math.pow(1 - u, 2.2)); o.scale.set(it.s.x * w, it.s.y, it.s.z); o.position.x = it.p.x - (1 - w) * Layout.rug.w / 2; }
  }
  function pitchStart() {
    pitch.items = pitch.items || pitchList();
    for (const it of pitch.items) pitchPose(it, 0);
    pitch.k.string = pitch.k.lantern = pitch.k.fire = 0; pitch.t0 = performance.now() / 1000; pitch.on = true; canDone = false;
  }
  function pitchStep() {
    if (!pitch.on) return;
    const tt = window.__covePitchT ?? performance.now() / 1000 - pitch.t0;      /* (the test bench can hold it at a moment) */
    for (const it of pitch.items) pitchPose(it, (tt - it.t) / it.d);
    pitch.k.string = sm01(4.3, 5.9, tt); pitch.k.lantern = sm01(4.8, 5.8, tt); pitch.k.fire = sm01(6.0, 7.2, tt);
    canDone = false;
    if (tt > 7.6) { pitch.on = false; for (const it of pitch.items) { it.o.visible = true; it.o.scale.copy(it.s); it.o.position.copy(it.p); } pitch.k.string = pitch.k.lantern = pitch.k.fire = 1; }
  }
  function moveCamp(ox, oz, camX) {
    Layout.setOrigin(ox, oz);
    rebuildCamp(); registerDyn(surge.dyn); surge.ripples.length = 0;
    if (marks) marks.clear();
    coastFollow(camX ?? Layout.camp.x);
    /* the chunk round the camp at once, then a quarter of a second of the rest (more follows as the frames go on) */
    if (world) world.update(camX ?? Layout.camp.x, 250);
  }
  Object.assign(api, { moveCamp, pitchStart });
  Object.defineProperty(api, 'pitching', { get: () => pitch.on });
  /* upcoming breakers (tide + click swells) for the soundscape: arrival times on the wave clock */
  function waveSchedule(wt0, wt1) {
    const WT = 9.0, out = [];
    for (let k = Math.floor(wt0 / WT) - 1; k <= Math.ceil(wt1 / WT) + 1; k++) {
      const h = n => hash(k * n + 0.37), x = k * WT + (h(1.37) - 0.5) * 2.0;
      if (x >= wt0 && x <= wt1) out.push({ id: 'w' + k, x, amp: 0.55 + 0.6 * h(3.33) });
    }
    surge.waves.forEach(w => { const tb = w.x - Math.min(w.s0 * 0.5, 8) / CU; if (tb >= wt0 && tb <= wt1) out.push({ id: 'u' + w.t0.toFixed(2), x: tb + 1.1, amp: w.amp, user: true }); });
    return out;
  }
  /* the coast's wildlife (fauna.js), and what it is told each frame */
  let fauna = null, faunaT = null, roughNow = 0, shacks = null; const faunaIn = {};
  /* how far up the sand the water reaches at x just now, in metres from the waterline: the tide's swash as the ground
     shader draws it (the same six waves, timed along the beach the same way), and any clicked swell's. For the birds
     that chase the water's edge and the crabs that keep out of it */
  function swashFront(x, wt) {
    const WT = 9.0, k0 = Math.floor(wt / WT); let r = 0;
    for (let k = k0 - 3; k <= k0 + 2; k++) {
      const h = n => hash(k * n + 0.37), amp = (0.55 + 0.6 * h(3.33)) * (1 + 0.55 * roughNow), ph = h(2.71) * 6.283;
      const tau = wt - (k * WT + (h(1.37) - 0.5) * 2.0 + 0.9 * Math.sin(x * 0.11 + ph) + x * 0.03 * (h(0.93) - 0.5)), T_ = tsOf(amp);
      if (tau <= 0 || tau > T_ + 1) continue;
      const [R, dl] = reach(x, amp, seedW({ z: ph })), u = (tau - dl) / T_;
      if (u > 0 && u < 1) r = Math.max(r, swashEdge(R, u));
    }
    for (const w of surge.waves) { const amp = userAmpJS(w, x, wt); if (amp < 0.05) continue; const [R, dl] = reach(x, amp, seedU(w)), u = (wt - w.x - dl) / tsOf(amp); if (u > 0 && u < 1) r = Math.max(r, swashEdge(R, u)); }
    return r;
  }
  Object.assign(api, { swashFront });
  /* when the waves will hit the rocks near a point: for the sound of water slapping rock */
  function rockHits(wt0, wt1, cx, cz, maxD = 32) {
    const out = []; if (!world) return out;
    const WT = 9.0;
    for (const p of world.wetNear(cx, cz, maxD)) {
      const d = Math.hypot(p.x - cx, p.z - cz), i = p.id;
      const g = shoreDZ(p.x), s = Math.max(0, (Layout.shoreZ(p.x) - p.z) / Math.sqrt(1 + g * g));
      for (let k = Math.floor(wt0 / WT) - 1; k <= Math.ceil(wt1 / WT) + 1; k++) {
        const h = n => hash(k * n + 0.37), T0 = k * WT + (h(1.37) - 0.5) * 2.0 + 0.9 * Math.sin(p.x * 0.11 + h(2.71) * 6.283) + p.x * 0.03 * (h(0.93) - 0.5) - s / WCJ;
        if (T0 >= wt0 && T0 <= wt1) out.push({ id: 'r' + k + '_' + i, wave: 'w' + k, x: T0, amp: 0.55 + 0.6 * h(3.33), d, rad: p.rad, px: p.x });
      }
      for (const w of surge.waves) { const T0 = w.x - s / CU; if (T0 >= wt0 && T0 <= wt1) out.push({ id: 'ru' + w.t0.toFixed(2) + '_' + i, wave: 'u' + w.t0.toFixed(2), x: T0, amp: 1 + 0.6 * userAmpJS(w, p.x, T0), d, rad: p.rad, px: p.x }); }
    }
    return out;
  }
  const surgeState = () => surge;
  /* a sky lantern let go from near the rug */
  function lantern() { if (!life) return 0; const a = Math.random() * TAU2, d = 0.6 + Math.random() * 1.2; life.lantern(Layout.camp.x + Math.cos(a) * d, Layout.camp.z + Math.sin(a) * d * 0.6, performance.now() / 1000); return life.lanterns; }
  const TAU2 = Math.PI * 2;
  /* ── the camper van, driven: pose, wheels, pack-up state, lights ── */
  const _e = new T.Euler(0, 0, 0, 'YXZ');
  function setVan(v) {
    const g = camp.vanGroup;
    if (v.x !== undefined) { g.position.set(v.x, v.lift || 0, v.z); _e.set(v.roll || 0, v.heading, v.pitch || 0, 'YXZ'); g.quaternion.setFromEuler(_e); vanS.moved = true; }
    for (const w of camp.vanWheels) { if (v.spin !== undefined) w.spin.rotation.z = -v.spin; if (w.front && v.steer !== undefined) w.steer.rotation.y = v.steer; }
    if (v.k !== undefined) vanS.k = v.k;
    if (v.brake !== undefined) vanS.brake = v.brake;
    if (v.head !== undefined) vanS.head = v.head;
    const k = vanS.k, sm = (a, b, x) => sm01(a, b, x);
    const aw = camp.vanAwning, sz = Math.max(0.02, 1 - sm(0, 0.55, k));
    aw.g.scale.z = sz; aw.g.position.z = aw.zi * (1 - sz); aw.g.visible = k < 0.6; aw.poles.forEach(p => p.visible = k < 0.05);
    camp.vanPop.lid.rotation.z = camp.vanPop.th * (1 - sm(0.15, 0.75, k)); camp.vanPop.canvas.visible = k < 0.12;
    camp.vanSlid.g.position.x = camp.vanSlid.dx * sm(0.25, 0.9, k);
    camp.vanOpen.forEach(o => o.visible = k < 0.6);
    camp.boardLean.visible = k < 0.5; camp.boardRoof.visible = k >= 0.5;
    camp.vanHead.forEach(m => m.emissiveIntensity = 3.5 * vanS.head);
    camp.vanTail.forEach(m => m.emissiveIntensity = 0.4 * vanS.head + 2.2 * vanS.brake);
    g.updateMatrixWorld(true);
    Mats.U.uVanInv.value.copy(g.matrixWorld).invert();
    camp.vanLightPos.copy(camp.vanLightLocal).applyMatrix4(g.matrixWorld); camp.vanDoor.copy(camp.vanDoorLocal).applyMatrix4(g.matrixWorld);
    camp.vanLightDir.set(0, -0.35, -1).normalize().applyQuaternion(g.quaternion);
    Mats.U.uVanPos.value.copy(camp.vanLightPos); Mats.U.uVanDir.value.copy(camp.vanLightDir);
    const fwd = new T.Vector3(1, 0, 0).applyQuaternion(g.quaternion), hp = new T.Vector3(2.35, 0.8, 0).applyMatrix4(g.matrixWorld);
    Mats.U.uHead.value.set(hp.x, hp.y, hp.z, 1.3 * vanS.head); Mats.U.uHeadDir.value.set(fwd.x, -0.18, fwd.z).normalize();
  }
  const vanPose = () => { const g = camp.vanGroup; _e.setFromQuaternion(g.quaternion, 'YXZ'); return { x: g.position.x, z: g.position.z, heading: _e.y }; };
  /* footprints and tyre tracks are decals pressed into the sand (marks.js) */
  /* the van (or anything) shoving props: a hit with its own direction, no backwash */
  function knock(x, z, rad, vx, vz, wt) {
    const sp = Math.hypot(vx, vz), hits = [];
    if (sp < 0.4) return hits;
    for (const d of surge.dyn) {
      const p = d.o.getWorldPosition(_v), r = (d.half || 0.2) * 0.8 + rad;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 > r * r) continue;
      if (d.hit && wt - d.hit.t < 1.5) continue;
      const pq = d.o.parent.getWorldQuaternion(new T.Quaternion()).invert(), L = new T.Vector3(vx, 0, vz).normalize().applyQuaternion(pq); L.y = 0; L.normalize();
      d.p0.copy(d.o.position); d.q0.copy(d.o.quaternion);
      Object.assign(d, { L, S: new T.Vector3().crossVectors(UP, L), axis: new T.Vector3().crossVectors(UP, L).normalize() });
      d.hit = { t: wt, seed: surge.rng(), depth: Math.min(3, sp * 0.55), tPeak: wt + 0.9, tEnd: wt + 0.9, knock: true };
      if (d.lantern !== undefined) surge.lantOut[d.lantern] = wt;
      if (d.candle) surge.candleOut = wt;
      hits.push(d);
    }
    if (surge.lightsOut == null && Layout.poles.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < (rad + 0.15) ** 2)) { surge.lightsOut = wt; hits.push({ pole: true }); }
    if (surge.fireOut == null && (Layout.fire.x - x) ** 2 + (Layout.fire.z - z) ** 2 < (rad + 0.5) ** 2) { surge.fireOut = wt; hits.push({ fire: true }); }
    return hits;
  }
  /* exact points on the objects the chapters live on */
  function anchors() {
    const F = Layout.fire, Tb = Layout.table, B = Layout.bottle;
    let bulb = camp.bulbs[0], bd = 1e9;
    for (const b of camp.bulbs) { const d = Math.hypot(b.p.x - (Layout.camp.x + 3.0), b.p.z - (Layout.camp.z + 1.4)); if (d < bd) { bd = d; bulb = b; } }
    const wp = (o, dy = 0) => { o.updateMatrixWorld(true); const v = o.getWorldPosition(new T.Vector3()); return [v.x, v.y + dy, v.z]; };
    return { fire: [F.x, 0.5, F.z], lights: [bulb.p.x, bulb.p.y, bulb.p.z], table: [Tb.x, 0.47, Tb.z], van: [camp.vanDoor.x, camp.vanDoor.y, camp.vanDoor.z],
      journal: camp.journalGroup ? (() => { const v = camp.journalGroup.localToWorld(new T.Vector3(camp.journal.W / 2, 0.02, 0)); return [v.x, v.y, v.z]; })() : [F.x - 0.6, 0.45, F.z + 1.7],
      clipboard: camp.clipboard ? wp(camp.clipboard, 0) : [Layout.van.x, 1.2, Layout.van.z],
      bottle: camp.bottle ? wp(camp.bottle, 0.03) : [B.x, 0.08, B.z], menu: camp.bookGroup ? (() => { const v = camp.bookGroup.localToWorld(new T.Vector3(camp.book.W / 2, 0.016, 0)); return [v.x, v.y, v.z]; })() : [Tb.x, 0.47, Tb.z], basket: camp.basket ? wp(camp.basket, 0.2) : [Tb.x + 1.4, 0.3, Tb.z - 1] };
  }
  /* anchors on things that move: the clipboard rides on the van */
  function anchorNow(name) {
    if (name === 'clipboard' && camp.clipboard) { camp.clipboard.updateMatrixWorld(true); const v = camp.clipboard.getWorldPosition(new T.Vector3()); return [v.x, v.y, v.z]; }
    return null;
  }
  const surgeInfo = () => ({ combo: surge.combo, pending: surge.waves.filter(w => w.x > 0).map(w => ({ at: w.x, amp: w.amp })), hits: surge.dyn.filter(d => d.hit).length, fireOut: surge.fireOut != null, lightsOut: surge.lightsOut != null });
  const flickOut = (t0, wt, dur = 1.3) => t0 == null || wt < t0 ? 1 : wt - t0 > dur ? 0 : (hash(Math.floor(wt * 17) + 3.1) > 0.4 ? 1 : 0.12) * (1 - (wt - t0) / dur);

  function init(cv, opts = {}) {
    canvas = cv;
    R = new T.WebGLRenderer({ canvas: cv, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
    R.setPixelRatio(1);
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    R.outputColorSpace = T.LinearSRGBColorSpace; R.toneMapping = T.NoToneMapping;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(50, 16 / 9, 0.1, 30000);

    const n = Textures.noise(), w = Textures.water();
    const noiseTex = Mats.dataTex(n.data, n.size, n.size, { repeat: true });
    const waterTex = Mats.dataTex(w.data, w.size, w.size, { repeat: true });
    /* the sea is seen at grazing angles: filter its textures along the view, or the distance smears */
    { const an = Math.min(8, R.capabilities.getMaxAnisotropy()); waterTex.anisotropy = an; noiseTex.anisotropy = an; }
    const sd = Textures.sand(), sandTex = Mats.dataTex(sd.data, sd.size, sd.size, { repeat: true });

    keyLight = new T.DirectionalLight(0xffffff, 1);
    keyLight.castShadow = true;
    const sm = opts.shadowSize || 2048;
    keyLight.shadow.mapSize.set(sm, sm);
    Object.assign(keyLight.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 140 });
    keyLight.shadow.bias = -0.0006; keyLight.shadow.normalBias = 0.03;
    keyLight.target.position.set(Layout.camp.x, 0, Layout.camp.z);
    scene.add(keyLight, keyLight.target);
    hemi = new T.HemisphereLight(0xffffff, 0x000000, Math.PI); scene.add(hemi);
    /* the lights are on the local shadow cameras' layers too (2, 3; see localShadow): those depth passes then find the
       same lights as the main pass, instead of none, and three no longer looks every material's program over again
       twice a frame whenever the fire is lit */
    for (const l of [keyLight, hemi]) { l.layers.enable(2); l.layers.enable(3); }

    const V3 = () => new T.Vector3();
    skyU = { uZen: { value: V3() }, uHor: { value: V3() }, uGlow: { value: V3() }, uSunDirV: { value: V3() }, uMoonDirV: { value: V3() }, uMoonDisc: { value: V3() }, uSunDisc: { value: V3() } };
    skyMat = new T.ShaderMaterial({
      uniforms: Object.assign({}, skyU, { uEnv: { value: 0 }, uCloudLit: { value: new T.Vector3() }, uStars: { value: 1 }, uTime: { value: 0 }, uPhaseC: { value: 1 }, uPhaseSign: { value: 1 }, uCloud: { value: 0.85 }, uMoonR: { value: 0.0175 }, uSunR: { value: 0.016 }, uNoise: { value: noiseTex },
        uCirrus: { value: 0.5 }, uAlto: { value: 0.0 }, uCumulus: { value: 0.6 }, uStratus: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uBolt: { value: new T.Vector4() }, uWind: { value: new T.Vector2(0.55, -0.83) }, uCloudT: { value: 0 } }),
      vertexShader: GLSL.SKY_VS, fragmentShader: GLSL.SKY_FS, side: T.BackSide, depthWrite: false
    });
    const sky = new T.Mesh(new T.SphereGeometry(5000, 48, 24), skyMat); sky.renderOrder = 1000; sky.frustumCulled = false; scene.add(sky); skyMesh = sky;
    /* environment: the same sky, rendered into a prefiltered cube map so every glossy surface reflects it */
    envSkyMat = new T.ShaderMaterial({ uniforms: Object.assign({}, skyMat.uniforms, { uEnv: { value: 1 } }), vertexShader: GLSL.SKY_VS, fragmentShader: GLSL.SKY_FS, side: T.BackSide, depthWrite: false });
    envScene = new T.Scene(); { const m = new T.Mesh(new T.SphereGeometry(400, 64, 32), envSkyMat); m.frustumCulled = false; envScene.add(m); }
    pmrem = new T.PMREMGenerator(R);
    envInit();
    { const n3 = Textures.noise3(); n3Tex = new T.Data3DTexture(n3.data, n3.size, n3.size, n3.size); n3Tex.format = T.RedFormat; n3Tex.type = T.UnsignedByteType;
      n3Tex.minFilter = n3Tex.magFilter = T.LinearFilter; n3Tex.wrapS = n3Tex.wrapT = n3Tex.wrapR = T.RepeatWrapping; n3Tex.unpackAlignment = 1; n3Tex.needsUpdate = true; }
    noiseT = noiseTex;

    uBulb = { uProg: { value: 1 }, uTime: Mats.U.uTime, uI: { value: 0.6 }, uTw: { value: 0.14 }, uOff: { value: V3() }, uCol: { value: new T.Vector3(1.0, 0.7, 0.38) } };
    uFairy = { uProg: { value: 1 }, uTime: Mats.U.uTime, uI: { value: 0.5 }, uTw: { value: 0.55 }, uOff: { value: V3() }, uCol: { value: new T.Vector3(1.0, 0.82, 0.55) } };
    const campG = new T.Group(), natG = new T.Group(), fxG = new T.Group(); campG.name = 'camp'; natG.name = 'nature'; fxG.name = 'fx';
    scene.add(campG, natG, fxG);
    camp = Camp.build(campG, { bulb: uBulb, fairy: uFairy });
    const pr = camp.pool.rect;
    Mats.U.uPool.value = camp.pool.tex; Mats.U.uPoolRect.value.set(pr.x, pr.z, pr.w, pr.d);
    Mats.U.uFirePos.value.copy(camp.fireBase).setY(0);
    camp.lanterns.forEach((l, i) => Mats.U.uLant.value[i].set(l.pos.x, l.pos.y, l.pos.z, l.s));
    Mats.U.uVanPos.value.copy(camp.vanLightPos); Mats.U.uVanDir.value.copy(camp.vanLightDir);
    nature = Nature.build(natG);
    paper = Paper.build(scene);
    if (camp.cork) { camp.cork.updateMatrixWorld(true); cork.p0 = camp.cork.position.clone(); cork.r0 = camp.cork.rotation.clone(); }
    surge.rng = Textures.rng(4242); registerDyn(camp.dyn);
    scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = o.material.metalness > 0.5 ? 1.8 : 1.45; });
    fx = FX.build(fxG, camp, nature, noiseTex);
    depthOnly = new T.MeshBasicMaterial({ colorWrite: false, side: T.DoubleSide });
    fireS = localShadow(170, 0.08, 12, 2, 256); canS = localShadow(150, 0.3, 12, 3, 1024);
    const nCast = tagLocalCasters(campG);
    Mats.U.uFireSh.value = fireS.rt.depthTexture; Mats.U.uFireShM.value = fireS.M;
    Mats.U.uCanSh.value = canS.rt.depthTexture; Mats.U.uCanShM.value = canS.M;

    const drect = { x: -17, z: -10.5, w: 34, d: 15 }, dec = Paint.decals(drect, opts.decalPPM || 48);
    gU = Object.assign({}, Mats.U, skyU, {
      uNoise: { value: noiseTex }, uWater: { value: waterTex },
      uDecal: { value: Mats.tex(dec.color, { srgb: true }) }, uRelief: { value: Mats.dataTex(dec.relief, dec.w, dec.h, { mip: true }) }, uSand: { value: sandTex },
      uDecalRect: { value: new T.Vector4(drect.x, drect.z, drect.w, drect.d) },
      uShadowMap: { value: null }, uShadowMatrix: { value: new T.Matrix4() }, uShadowSize: { value: new T.Vector2(sm, sm) }, uShadowOn: { value: 0 }, uShadowK: { value: 1 },
      uAmb: { value: V3() }, uKeyDir: { value: V3() }, uKeyCol: { value: V3() }, uMoonGlit: { value: V3() }, uSunGlit: { value: V3() },
      uDay: { value: 0 }, uWaveT: { value: 0 }, uWv: { value: [0, 1, 2, 3, 4, 5].map(() => new T.Vector4()) }, uUw: { value: [0, 1, 2].map(() => new T.Vector4()) }, uRip: { value: [0, 1, 2, 3, 4, 5].map(() => new T.Vector4()) }, uNearRect: { value: new T.Vector4(-48, -62, 48, -2) }, uDbgG: { value: 0 }, uMist: { value: 1 }, uWet: { value: 0 }, uRough: { value: 0 }, uShC: { value: new T.Vector3(Layout.camp.x, Layout.camp.z, 24) }
    });
    groundMat = new T.ShaderMaterial({ uniforms: gU, vertexShader: GLSL.GROUND_VS, fragmentShader: GLSL.GROUND_FS, defines: { FAR: 1 } });
    const ground = new T.Mesh(new T.PlaneGeometry(40000, 40000, 160, 160), groundMat);   /* in cells, or depth goes ragged across one huge triangle */
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -19800); ground.frustumCulled = false; scene.add(ground); groundMesh = ground;
    /* the near-shore sea is a fine mesh carrying a real wave height field (tide swells and clicked swells) */
    const nr = gU.uNearRect.value, ng = new T.PlaneGeometry(nr.z - nr.x, nr.w - nr.y, opts.nearSegX || 320, opts.nearSegZ || 200);
    ng.rotateX(-Math.PI / 2); ng.translate((nr.x + nr.z) / 2, 0, (nr.y + nr.w) / 2);
    const nearMat = new T.ShaderMaterial({ uniforms: gU, vertexShader: GLSL.GROUND_VS, fragmentShader: GLSL.GROUND_FS, defines: { NEAR: 1 } });
    const nearSea = new T.Mesh(ng, nearMat); nearSea.frustumCulled = false; scene.add(nearSea); nearMesh = nearSea;

    /* the coast beyond the camp, without end: headlands, surf rocks with foam, the forest on its hills;
       and the small lives of the shore, its shells laid along every chunk of it as the chunk is built.
       The chunk round the camp is built now, the rest a little at a time as the camera comes near */
    coastFollow(Layout.cameras.wide.pos[0]);
    world = World.build(natG, gU, noiseTex);
    life = Life.build(natG, gU, world);
    /* the people of the coast: shacks, coco huts, fishing boats, every so often along it (laid out with each chunk) */
    shacks = Shacks.build(natG, world); Object.assign(api, { shacks });
    world.prime();
    /* and the wildlife of the whole coast: fireflies all along the forest edge, gulls, sandpipers, crabs, bats, dolphins */
    fauna = Fauna.build(natG, world); Object.assign(api, { fauna });
    marks = Marks.build(natG); Object.assign(api, { marks });
    post = makePost();
    return { casters: nCast };
  }

  /* the shoreline the shaders draw: the headlands nearest the camera and the coast's waves, measured from a reference
     near it (Layout.coastGL), refreshed as the camera moves along the coast */
  let coastX = NaN, coastV = -1;
  function coastFollow(x) {
    if (Math.abs(x - coastX) < 24 && coastV === Layout.coastVer) return;
    coastX = x; coastV = Layout.coastVer;
    const U = Mats.coastU; Layout.coastGL(x, U.uHeadL.value, U.uCoast.value, U.uCoastP.value, U.uCoastQ.value);
  }
  Object.assign(api, { coastFollow });

  const lerp = (a, b, t) => a + (b - a) * t;
  function setCamera(c, aspect, shift = 0) {
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    camera.fov = c.fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    if (Math.abs(shift) > 1e-4) camera.setViewOffset(canvas.width, canvas.height, shift * canvas.width, 0, canvas.width, canvas.height);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.lookAt(c.look[0], c.look[1], c.look[2]);
    camera.updateMatrixWorld();
  }
  function blendCam(a, b, t) {
    const L = (x, y) => x.map((v, i) => lerp(v, y[i], t));
    return { pos: L(a.pos, b.pos), look: L(a.look, b.look), fov: lerp(a.fov, b.fov, t), focus: lerp(a.focus || 25, b.focus || 25, t) };
  }

  let lastCW = 0, lastCH = 0, fabT = null;
  function render(o) {
    /* keep the renderer's own size (and so its screen viewport) in step with the canvas,
       or a resized window shows the frame in only part of it */
    if (canvas.width !== lastCW || canvas.height !== lastCH) { lastCW = canvas.width; lastCH = canvas.height; R.setSize(lastCW, lastCH, false); }
    const S = Sky.compute(o.ms, o.loc), t = o.t;
    const rs = o.renderScale || 1, w = Math.max(2, Math.round(canvas.width * rs)), h = Math.max(2, Math.round(canvas.height * rs));
    post.resize(w, h, o.msaa ?? 4);
    setCamera(o.cam || Layout.cameras.wide, canvas.width / canvas.height, o.shiftX || 0);
    /* the finely meshed surf follows the camera along the coast; so do the sky, the open sea, the shoreline the shaders
       draw, and the building of the coast's chunks (a few milliseconds of it a frame, unless asked otherwise) */
    { const cx = Math.round(camera.position.x / 4) * 4; if (nearMesh && cx !== nearX) { nearX = cx; nearMesh.position.x = cx; gU.uNearRect.value.set(cx - 48, -62, cx + 48, -2); } }
    skyMesh.position.copy(camera.position);
    groundMesh.position.x = Math.round(camera.position.x / 100) * 100;
    coastFollow(camera.position.x);
    if (world) world.update(camera.position.x, o.buildMs ?? 4);
    /* the sun's (or moon's) shadow map covers the camp, or the van wherever it has been driven to */
    { const lk = (o.cam || Layout.cameras.wide).look, away = Math.hypot(lk[0] - Layout.camp.x, lk[2] - Layout.camp.z) > 30;
      const sc = o.shadowC || (away ? [Math.round(lk[0]), Math.round(lk[2])] : [Layout.camp.x, Layout.camp.z]);
      keyLight.target.position.set(sc[0], 0, sc[1]); keyLight.target.updateMatrixWorld(); gU.uShC.value.set(sc[0], sc[1], 24); }
    /* the shore's small lives: leaping fish (each leap and landing leaves a splash) and shoals in the shallows */
    let splashes = [];
    if (life) {
      const dt = lifeT === null ? 0 : Math.max(0, Math.min(0.1, t - lifeT)); lifeT = t;
      const twilight = Math.exp(-Math.pow((S.sAlt - 2) / 9, 2));
      if (o.dens) life.setShells(o.dens.shells);
      splashes = life.update(t, dt, camera.position.x, { day: S.day, twilight, calm: o.calm, realT: performance.now() / 1000, fish: o.dens ? o.dens.fish : 0.5 });
      for (const sp of splashes) { surge.ripples.push({ x: sp.x, z: sp.z, t0: o.waveT ?? t, A: 0.35 * sp.k / 0.4 }); if (surge.ripples.length > 6) surge.ripples.shift(); }
    }
    const V = setV;
    V(skyU.uZen, S.zen); V(skyU.uHor, S.hor); V(skyU.uGlow, S.glow); V(skyU.uSunDirV, S.sunDirV); V(skyU.uMoonDirV, S.moonDirV);
    V(skyU.uMoonDisc, S.moonDisc); V(skyU.uSunDisc, S.sunDisc);
    const su = skyMat.uniforms; su.uStars.value = S.stars; su.uTime.value = t; su.uCloudT.value = o.cloudT ?? t; su.uPhaseC.value = S.moonPhaseC; su.uPhaseSign.value = S.moonPhaseSign; V(su.uCloudLit, S.cloudLit); if (o.clouds !== undefined) su.uCloud.value = o.clouds;
    if (o.sky) { const k = o.sky; su.uCirrus.value = k.cirrus; su.uAlto.value = k.alto; su.uCumulus.value = k.cumulus; su.uStratus.value = k.stratus; su.uStorm.value = k.storm; su.uFlash.value = k.flash || 0; if (k.bolt) su.uBolt.value.set(k.bolt[0], k.bolt[1], k.bolt[2], k.bolt[3]); else su.uBolt.value.w = 0; }
    V(gU.uAmb, S.amb); V(gU.uKeyDir, S.keyDir); V(gU.uKeyCol, S.keyCol); V(gU.uMoonGlit, S.moonGlit); V(gU.uSunGlit, S.sunGlit);
    gU.uDay.value = S.day; gU.uShadowK.value = S.shadowK; gU.uWaveT.value = o.waveT ?? t; Mats.U.uTime.value = t;
    gU.uWet.value = o.wet || 0; gU.uRough.value = o.rough || 0;
    const wt = o.waveT ?? t;
    { const WT = 9.0, kb = Math.floor(wt / WT);
      for (let j = 0; j < 6; j++) { const k = kb - 3 + j, h = n => hash(k * n + 0.37);
        gU.uWv.value[j].set(k * WT + (h(1.37) - 0.5) * 2.0, (0.55 + 0.6 * h(3.33)) * (1 + 0.55 * (o.rough || 0)), h(2.71) * 6.283, h(0.93) - 0.5); }
      for (let j = 0; j < 3; j++) { const w = surge.waves[j]; if (w) gU.uUw.value[j].set(w.x, w.amp, w.xc, w.s0); else gU.uUw.value[j].set(0, 0, 0, 0); }
      for (let j = 0; j < 6; j++) { const r = surge.ripples[j]; if (r) gU.uRip.value[j].set(r.x, r.z, r.t0, r.A); else gU.uRip.value[j].set(0, 0, -1e4, 0); } }
    updateSurge(wt);
    keyLight.color.setRGB(S.keyCol[0], S.keyCol[1], S.keyCol[2]); keyLight.intensity = Math.PI;
    keyLight.position.copy(keyLight.target.position).addScaledVector(R3.key.set(S.keyDir[0], S.keyDir[1], S.keyDir[2]), 70);
    envStep(S, performance.now() / 1000, o.env !== false);
    hemi.intensity = scene.environment ? 0 : Math.PI;
    hemi.color.setRGB(S.amb[0], S.amb[1], S.amb[2]); Mats.U.uKeyDirT.value.set(S.keyDir[0], S.keyDir[1], S.keyDir[2]).normalize(); Mats.U.uKeyColT.value.set(S.keyCol[0], S.keyCol[1], S.keyCol[2]); Mats.U.uAmbF.value.set(S.amb[0], S.amb[1], S.amb[2]); hemi.groundColor.setRGB(S.groundAmb[0], S.groundAmb[1], S.groundAmb[2]);

    const fireK = surge.fireOut == null ? 1 : 1 - sm01(surge.fireOut, surge.fireOut + 0.8, wt);
    const L = Object.assign(Lw, o.lights), F = Object.assign(Fw, o.fire), vf = vanFlicker(t) * (surge.vanHit == null ? 1 : 0.35 + 0.65 * flickOut(surge.vanHit, wt, 2.0)), ff = fireFlicker(t);
    F.i *= fireK; F.smoke *= fireK; L.string *= flickOut(surge.lightsOut, wt);
    /* a camp going up: its lights come on and its fire is lit as each is put in place */
    pitchStep();
    if (pitch.on) { const P = pitch.k; L.string *= P.string; L.fairy *= P.string; L.lantern *= P.lantern; F.i *= P.fire; F.smoke *= P.fire; F.steam *= P.fire; }
    if (camp.rugMat && surge.rugWet != null) { const e = sm01(surge.rugWet, surge.rugWet + 1.5, wt); camp.rugMat.color.setRGB(1 - 0.5 * e, 1 - 0.5 * e, 1 - 0.46 * e); }
    Mats.U.uLights.value.set(L.string, L.lantern, L.van * vf * (1 - vanS.k), L.fairy);
    if (marks) marks.update(t, wt, S, swashFront);
    Mats.U.uFire.value.set(F.i, ff, F.smoke, F.steam);
    if (o.lightK) Mats.U.uLightK.value.set(...o.lightK);
    uBulb.uProg.value = L.string; uFairy.uProg.value = L.fairy > 0 ? 1 : 0; uFairy.uI.value = 0.5 * L.fairy * vf;
    uBulb.uOff.value.set(S.amb[0] * 0.6 + 0.002, S.amb[1] * 0.55 + 0.002, S.amb[2] * 0.45 + 0.002); uFairy.uOff.value.copy(uBulb.uOff.value);
    camp.lanterns.forEach((l, i) => { const lo = flickOut(surge.lantOut[i], wt, 0.6), k = 0.42 * L.lantern * candleFlicker(t, i) * lo; Mats.U.uLant.value[i].w = l.s * lo; l.mat.color.setRGB(1.0 * k + S.amb[0] * 0.5, 0.55 * k + S.amb[1] * 0.5, 0.22 * k + S.amb[2] * 0.5); });
    camp.candles.forEach((m, i) => { const k = 0.5 * L.lantern * candleFlicker(t, i + 5) * flickOut(surge.candleOut, wt, 0.5); m.color.setRGB(1.0 * k + 0.01, 0.6 * k + 0.01, 0.28 * k + 0.01); });
    { const k = 0.085 * L.van * vf; camp.vanInside.color.setRGB(1.0 * k + S.amb[0] * 0.5, 0.6 * k + S.amb[1] * 0.5, 0.3 * k + S.amb[2] * 0.5); }
    (camp.vanGlow || []).forEach(v => { v.m.emissiveIntensity = v.k * L.van * vf; });
    { const k = 0.45 * F.i * (0.7 + 0.4 * ff); camp.coals.color.setRGB(1.0 * k, 0.28 * k, 0.05 * k); }
    Nature.sway(nature, t, o.wind ?? 1);
    /* the camp's cloth (the van's valance, the towel on the chair) flaps on the scene's own clock */
    { const dt = fabT === null ? 0 : Math.max(0, Math.min(0.25, t - fabT)); fabT = t; Camp.flutter(camp, dt, o.wind ?? 1, camera); }
    /* the menu: turn pages, and keep it readable after dark (its paper carries a little light of its own) */
    { const rk = (o.read || 0) * 0.36 * (1 - 0.9 * S.day) / Math.max(0.05, S.exposure * (o.expMul || 1));
      for (const b of [camp.book, camp.journal]) if (b) { b.update(); b.setReadLight(rk); }
      if (paper) { paper.update(); paper.setReadLight(rk * 1.45); }
      /* the cork pops out of the bottle and lands on the sand; it goes back when the letter does */
      if (camp.cork && cork.p0) { const now = performance.now() / 1000, u = Math.min(1, Math.max(0, (now - cork.t0) / 0.7)), k = cork.to ? u : 1 - u;
        if (k !== cork.k) { cork.k = k; const c = camp.cork; c.position.set(cork.p0.x + 0.16 * k, cork.p0.y + 0.09 * Math.sin(Math.PI * Math.min(1, k * 1.3)) - 0.02 * k, cork.p0.z + 0.05 * k); c.rotation.set(cork.r0.x + 2.4 * k, cork.r0.y, cork.r0.z + 5.5 * k); } } }
    /* the wish board: a lamp under its eave, and paper that reads after dark (brighter while you are at it) */
    if (camp.board) camp.board.light((0.12 * L.lantern + 0.3 * boardLook) * (1 - 0.9 * S.day) / Math.max(0.05, S.exposure * (o.expMul || 1)), 0.42 * L.lantern * candleFlicker(t, 7), S.amb);
    /* the flame's light centre wanders a little, so the fire's shadows breathe */
    { const fb = camp.fireBase, jx = 0.03 * Math.sin(t * 7.3) + 0.015 * Math.sin(t * 17.9 + 1.1), jz = 0.03 * Math.sin(t * 6.1 + 2.0) + 0.015 * Math.sin(t * 15.3), jy = 0.07 * (ff - 0.55);
      Mats.U.uFirePos.value.set(fb.x + jx, jy, fb.z + jz);
      const on = o.localShadows !== false;
      Mats.U.uShOn.value = on ? 1 : 0;
      if (on) {
        if (F.i > 0.001) renderLocal(fireS, fb.x + jx, 0.6 + jy, fb.z + jz);
        if (!canDone) { renderLocal(canS, Layout.rug.x, 2.45, Layout.rug.z); canDone = true; }
      } }
    const pxScale = h / (2 * Math.tan(camera.fov * Math.PI / 360));
    /* the coast's wildlife, around the camera; a dolphin breaking the surface rings the water */
    if (fauna) {
      const fi = faunaIn; fi.dt = faunaT === null ? 0 : Math.max(0, Math.min(0.25, t - faunaT)); faunaT = t; roughNow = o.rough || 0;
      fi.t = t; fi.waveT = wt; fi.cam = camera.position; fi.sAlt = S.sAlt; fi.night = S.night; fi.evening = Math.sin(S.sun.H) > 0; fi.rain = o.rain || 0; fi.wind = o.wind ?? 1;
      fi.dens = o.dens; fi.pxScale = pxScale; fi.van = camp.vanGroup.position; fi.swash = swashFront; fi.calm = !!o.calm;
      for (const sp of fauna.update(fi)) { surge.ripples.push({ x: sp.x, z: sp.z, t0: wt, A: sp.k }); if (surge.ripples.length > 6) surge.ripples.shift(); }
    }
    if (shacks) shacks.update(S, t);
    const fireLit = 0.05 * F.i, A = S.amb, K = S.keyCol;
    fxP.t = t; fxP.fireI = F.i; fxP.fireFlick = ff; fxP.flies = (o.flies ?? 1) * S.night; fxP.moths = Math.max(L.lantern, L.string) * S.night; fxP.insects = o.dens ? o.dens.insects : 0.5;
    fxP.smoke = F.smoke; fxP.steam = F.steam * fireK; fxP.pxScale = pxScale; fxP.douse = surge.fireOut == null ? 0 : Math.exp(-Math.max(0, wt - surge.fireOut) / 2.4) * (wt >= surge.fireOut ? 1 : 0);
    fxP.butterflies = S.sAlt > -1 ? Math.min(1, (S.sAlt + 1) / 2) : 0;
    fxP.smokeLo.set(A[0] * 0.9 + fireLit, A[1] * 0.9 + fireLit * 0.45, A[2] * 0.9 + fireLit * 0.15);
    fxP.smokeHi.set(A[0] * 0.8 + K[0] * 0.25, A[1] * 0.8 + K[1] * 0.25, A[2] * 0.8 + K[2] * 0.25);
    fxP.steamLo.set(A[0] * 1.6 + fireLit * 2.2, A[1] * 1.6 + fireLit * 1.4, A[2] * 1.6 + fireLit * 0.8);
    fxP.steamHi.set(A[0] * 1.5 + K[0] * 0.5, A[1] * 1.5 + K[1] * 0.5, A[2] * 1.5 + K[2] * 0.5);
    fxP.bfly[0] = A[0] + K[0] * 0.4; fxP.bfly[1] = A[1] + K[1] * 0.4; fxP.bfly[2] = A[2] + K[2] * 0.4;
    FX.update(fx, fxP, camera);

    if (!shadowReady && keyLight.shadow.map) {
      gU.uShadowMap.value = keyLight.shadow.map.texture; gU.uShadowMatrix.value = keyLight.shadow.matrix; gU.uShadowOn.value = 1; shadowReady = true;
    }
    const soft = o.soft ?? 0.55, cam = o.cam || Layout.cameras.wide;
    const volFire = o.volFire !== false;
    fx.flames.forEach(f => { f.visible = !volFire; });
    const fb = camp.fireBase, fireTop = R3.top.set(fb.x, 1.05, fb.z).project(camera), fireSide = R3.side.set(fb.x, 1.05, fb.z).addScaledVector(R3.right.setFromMatrixColumn(camera.matrixWorld, 0), 0.35).project(camera);
    const hazeR = Math.abs(fireSide.x - fireTop.x) * 0.5 * (canvas.width / canvas.height);
    const haze = haze4.set(fireTop.x * 0.5 + 0.5, fireTop.y * 0.5 + 0.5, hazeR, fireTop.z < 1 ? F.i * (o.haze ?? 1) : 0);
    gU.uMist.value = 1 + 1.6 * soft;
    Mats.U.uFog.value.set(S.hor[0], S.hor[1], S.hor[2], gU.uMist.value);
    if (volFire) { ppFire.dbg = o.fireDbg || 0; ppFire.I = F.i * (0.8 + 0.35 * ff) * (o.fireK ?? 2.2); ppFire.flick = ff; ppFire.t = t; ppFire.n3 = n3Tex; ppFire.fc.set(fb.x, 0.02, fb.z); }
    pp.exp = S.exposure * (o.expMul || 1); pp.thresh = 0.85 - 0.3 * soft; pp.bloomK = (o.bloomK ?? 0.5) + 0.25 * soft; pp.fade = o.fade ?? 1; pp.t = t; pp.night = S.night; pp.prof = o.prof ? [] : null;
    pp.dofK = o.dof === false ? 0 : 4.5 * soft; pp.focus = cam.focus || 25; pp.grain = 0.003 + 0.008 * soft; pp.veil = 0.05 * soft;
    pp.ao = o.ao === false ? 0 : 0.85; pp.haze = haze; pp.noiseT = noiseT; pp.rain = o.rain || 0; pp.rainSlant = o.rainSlant; pp.fire = volFire ? ppFire : null;
    const tc = performance.now();
    post.render(pp);
    if (o.prof) { const a = pp.prof; S.prof = { cpu: Math.round(a[0] - tc), scene: Math.round(a[1] - a[0]), bloom: Math.round(a[2] - a[1]), final: Math.round(a[3] - a[2]) }; }
    S.splashes = splashes;
    return S;
  }

  /* reprint the menu card with the page's own text (once the web fonts are in) */
  function paintMenu(info) { if (camp && camp.book) camp.book.paintCover(c => Paint.menuCover(c, info)); }
  /* the menu on the table: where it lies (for the reading camera) and its page turns */
  function bookFrame(which = 'menu') {
    const g = which === 'journal' ? camp.journalGroup : camp.bookGroup, bk = which === 'journal' ? camp.journal : camp.book; g.updateMatrixWorld(true);
    const q = g.getWorldQuaternion(new T.Quaternion()), o = new T.Vector3().setFromMatrixPosition(g.matrixWorld);
    const r = new T.Vector3(1, 0, 0).applyQuaternion(q), top = new T.Vector3(0, 0, -1).applyQuaternion(q), up = new T.Vector3(0, 1, 0).applyQuaternion(q);
    return { o: o.toArray(), right: r.toArray(), top: top.toArray(), up: up.toArray(), W: bk.W, H: bk.H };
  }
  const bookApi = (name, get) => ({
    go: (k, open) => get().go(k, open), setPages: c => get().setPages(c), frame: () => bookFrame(name), paintCover: fn => get().paintCover(fn),
    dragStart: d => get().dragStart(d), dragTo: f => get().dragTo(f), dragEnd: c => get().dragEnd(c), get dragging() { return get().dragging; },
    busy: () => get().busy(), get spread() { return get().state.spread; }, get maxSpread() { return get().state.maxSpread; }, get open() { return get().state.open; }
  });
  const book = bookApi('menu', () => camp.book), books = { menu: book, journal: bookApi('journal', () => camp.journal) };
  /* where each loose paper starts: the letter in the bottle, a blueprint in the basket, the clipboard on the van */
  function origin(name) {
    const o = name === 'bottle' ? camp.letterProp[0] : name === 'roll' ? camp.planRoll : camp.clipboard;
    o.updateMatrixWorld(true);
    const p = o.getWorldPosition(new T.Vector3()), q = o.getWorldQuaternion(new T.Quaternion());
    if (name === 'bottle') q.copy(camp.bottle.getWorldQuaternion(new T.Quaternion()));
    if (name === 'roll') q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2));
    if (name === 'clipboard') p.add(new T.Vector3(0, -0.012, 0.002).applyQuaternion(q));
    return { p: p.toArray(), q: q.toArray() };
  }
  /* the cork: out (it hops onto the sand) before the letter can come out; back in once the letter is home */
  function corkOut(out) { if (cork.to === (out ? 1 : 0)) return; cork.to = out ? 1 : 0; cork.t0 = performance.now() / 1000; }
  function prop(name, visible) {
    if (name === 'bottle') camp.letterProp.forEach(m => { m.visible = visible; });
    if (name === 'roll' && camp.planRoll) camp.planRoll.visible = visible;
    if (name === 'clipboard' && camp.clipboard) camp.clipboard.visible = visible;
  }
  function paintClip(canvas) { if (!camp.clipSheet) return; const c = camp.clipSheet.canvas, a = c.getContext('2d'); a.drawImage(canvas, 0, 0, c.width, c.height); camp.clipSheet.tex.needsUpdate = true; }
  /* bulbs of one strand, for hanging the journey's tags */
  const strandBulbs = si => camp.bulbs.filter(b => b.strand === si).sort((a, b) => a.t - b.t).map(b => [b.p.x, b.p.y, b.p.z]);
  function project(p) {
    const v = new T.Vector3(p[0], p[1], p[2]).project(camera);
    return [(v.x * 0.5 + 0.5), (-v.y * 0.5 + 0.5), v.z];
  }
  function finish() { const px = new Uint8Array(4); const gl = R.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  /* the camp's cloth, for the test bench: whether each piece moved last frame, how far its free edge is from where
     it hangs at rest, and a fingerprint of its shape (to tell two frames apart) */
  function fabric() {
    return camp.fabric.map(F => { const c = F.cl, P = c.P, R = c.R; let far = 0, sum = 0; for (let i = 0; i < c.n * 3; i++) { far = Math.max(far, Math.abs(P[i] - R[i])); sum += P[i] * ((i % 7) + 1); } return { live: F.live, particles: c.n, far: +far.toFixed(4), print: +sum.toFixed(5) }; });
  }
  Object.assign(api, { fabric });

  /* ── the wish board, the two chairs you can sit in, the radio on the table ── */
  let boardLook = 0;
  const _ray = new T.Raycaster(), _ndc = new T.Vector2();
  _ray.params.Line.threshold = 0.01;                  /* (the guitar's strings are lines: only a direct hit counts) */
  /* repaint the board's face: fn draws on its canvas */
  function paintBoard(fn) { if (camp && camp.board) camp.board.paint(fn); }
  /* how much the board is being looked at, 0 to 1: its paper reads brighter while you are at it */
  function setBoardLook(k) { boardLook = k; }
  /* the board's centre, the way its face looks, and its size: for the camera that reads it */
  function boardFrame() {
    const b = camp.board, g = b.group;
    return { c: g.localToWorld(new T.Vector3(0, b.Y, 0)).toArray(), n: new T.Vector3(0, 0, 1).applyQuaternion(g.getWorldQuaternion(new T.Quaternion())).toArray(), W: b.W, H: b.H };
  }
  /* where a seated visitor's eyes are in chair i (leaning back a little), and the fire in front of them */
  function seatPose(i) {
    const ch = camp.chairs && camp.chairs[i]; if (!ch) return null;
    return { eye: ch.localToWorld(new T.Vector3(-0.27, 0.9, 0)).toArray(), fire: [Layout.fire.x, 0.35, Layout.fire.z] };
  }
  /* what a click at (nx, ny) across the canvas lands on: 'chair0', 'chair1', 'radio', 'board', or null */
  function pick(nx, ny) {
    if (!camp || !camp.pick) return null;
    _ndc.set(nx * 2 - 1, 1 - ny * 2); _ray.setFromCamera(_ndc, camera);
    let best = null, bd = 60;
    for (const o of camp.pick) { const h = _ray.intersectObject(o, true)[0]; if (h && h.distance < bd) { bd = h.distance; best = o.userData.pick; } }
    return best;
  }
  /* the radio's dial: how lit it is (0 is off) and where the needle sits along the scale, 0 to 1 */
  function setRadio(glow, dial) { if (camp && camp.radio) camp.radio.set(glow, dial); }
  /* points on these things for their hotspot dots (they move with a wave or a knock, like everything at the camp) */
  function propAnchors() {
    const at = (o, x, y, z) => o.localToWorld(new T.Vector3(x, y, z)).toArray(), b = camp.board;
    return { board: at(b.group, 0, b.Y + b.H / 2 - 0.02, 0.06), chair0: at(camp.chairs[0], -0.5, 1.06, 0), chair1: at(camp.chairs[1], -0.5, 1.06, 0), radio: at(camp.radio.group, 0, 0.2, 0) };
  }
  Object.assign(api, { paintBoard, setBoardLook, boardFrame, seatPose, pick, setRadio, propAnchors });

  const dbg = { scene: () => scene, key: () => keyLight, ground: () => groundMat, post: () => post };
  Object.assign(api, { init, warm, render, project, paintMenu, book, books, origin, prop, corkOut, paintClip, strandBulbs, finish, blendCam, vanFlicker, dbg, clickSea, rebuildCamp, surgeInfo, seaPick, waveSchedule, rockHits, surgeState, lantern, anchors, anchorNow, setVan, vanPose, knock });
  Object.defineProperties(api, { world: { get: () => world }, life: { get: () => life }, paper: { get: () => paper }, camera: { get: () => camera }, renderer: { get: () => R }, scene: { get: () => scene } });
  return api;
})();
