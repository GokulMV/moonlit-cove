/* ─────────────────────────────────────────────────────────────
   engine.js — assembles the cove, updates it per frame from the
   live sky, renders through HDR bloom + filmic finish.
   ───────────────────────────────────────────────────────────── */
const Engine = (() => {
  const T = THREE;
  /* the public face of the engine. Features add to it right where they are written, with
     Object.assign(api, { … }), rather than all through one long return line */
  const api = {};
  let R, scene, camera, keyLight, hemi, camp, nature, fx, post, canvas, cloudNoiseMs = 0;
  let skyMat, groundMat, skyU, gU, uBulb, uFairy, shadowReady = false;
  let horizon = null, isFauna = null, isFaunaT = null, fireS, canS, canDone = false, depthOnly, paper = null, world = null, life = null, lifeT = null, nearMesh = null, nearX = NaN, nearZ = NaN, skyMesh = null, groundMesh = null, stars = null;
  let uncork = null;
  /* the finely meshed surf that carries the waves' heights: its size and its cells (it follows the view, see render) */
  /* (round the island it reaches further out: the swell breaks out on the reefs' edges, a hundred metres off the rocks) */
  const NEAR = { W: 192, D: Layout.isle ? 140 : 100, CELL: 0.4 };
  let envSkyMat, envScene, pmrem, n3Tex, noiseT, marks = null;
  const vanS = { k: 0, brake: 0, head: 0, moved: false };
  const BIAS = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const hash = x => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  /* the environment light (see envStep): a small cube of the sky, prefiltered, rebuilt one face a frame at most every
     ENV_EVERY seconds and only when the sky has changed enough to see, then blended in over ENV_FADE seconds */
  const ENV_SIZE = 128, ENV_EVERY = 1.6, ENV_FADE = 1.4;
  const env = { cube: null, cam: null, out: null, from: null, to: null, mat: null, qs: null, qc: null, face: -1, at: -1e9, k: 1, want: new Float64Array(8), built: new Float64Array(8).fill(NaN) };
  /* scratch for render(): a frame makes no garbage of its own */
  const R3 = { key: new T.Vector3(), top: new T.Vector3(), side: new T.Vector3(), right: new T.Vector3(), fc: new T.Vector3(), sun: new T.Vector3() }, haze4 = new T.Vector4(), sunScr4 = new T.Vector4();
  /* The clouds' drift. They are carried along on the wind aloft, as far as their clock has moved on since the last frame
     (a fresh breeze up there, more in a storm), and their billows slowly rise through them; the count is kept here, in
     double precision, and handed to the shaders once for each noise texture, wrapped to that texture's own repeat (the
     weather map's 36 km, the billows' 3.3 km, the detail's 340 m), so the shaders' sums stay exact however long it runs.
     A leap of the clock (a new hour picked) leaves them where they are. */
  const CLOUD_WIND = 16, CLOUD_RISE = 1.5;   /* metres per tick of the clouds' clock (about 0.8 of a second at 1×: some 13 m/s) */
  const cloudMo = { ct: null, s: 0, x: 0, z: 0, b: 0, dx: 0, dz: 0, dct: 0, jump: true }, cloudDD = [0, 0], cloudShell = [0, 2200];
  let campShade = 1;
  const wrapP = (v, P) => v - Math.floor(v / P) * P;
  /* the clouds' shadow at (x, z), worked out as the ground shader does (GLSL.CLOUDSHADOW) from the weather map's own
     pixels: for the light on everything at the camp, so the chairs and the van darken with the sand under a cloud */
  const smJ = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function cloudShadowAt(x, z) {
    const su = skyMat.uniforms, img = su.uWeather.value && su.uWeather.value.image; if (!img || !img.data) return 1;
    const lx = su.uLdM.value.x, ly = su.uLdM.value.y + 1e-3, lz = su.uLdM.value.z, ll = Math.hypot(lx, ly, lz), Ly = ly / ll, k = smJ(0.03, 0.12, Ly);
    if (k <= 0) return 1;
    const N = img.width, Dt = img.data, WT = 36000;
    const at = (i, j, ch) => Dt[((((j % N) + N) % N) * N + (((i % N) + N) % N)) * 4 + ch];
    const bil = (fx, fy, ch) => { fx -= 0.5; fy -= 0.5; const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j; return (at(i, j, ch) * (1 - tx) + at(i + 1, j, ch) * tx) * (1 - ty) + (at(i, j + 1, ch) * (1 - tx) + at(i + 1, j + 1, ch) * tx) * ty; };
    /* (read as the shader reads it a few detail levels down: an average over several pixels) */
    const read = (u, v, ch, r) => { let s = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s += bil(u * N + (i - 1.5) * r, v * N + (j - 1.5) * r, ch); return s / 16 / 255; };
    let sh = 1;
    if (su.uCumulus.value + su.uStratus.value + su.uStorm.value > 0.001) {
      const cv = Math.min(1, Math.max(0.08 + 0.24 * su.uCumulus.value, 1.05 * su.uStratus.value, 0.9 * su.uStorm.value));
      const qx = x + lx / ll / Ly * 2100 - su.uDriftW.value.x, qz = z + lz / ll / Ly * 2100 - su.uDriftW.value.y;
      const wr = read(qx / WT, qz / WT, 0, 1.6), wb = read(qx / WT, qz / WT, 2, 1.6);
      const f = 1 - cv * (0.75 + 0.45 * wb), room = Math.max(0, Math.min(1, (wr + (1 - wr) * 0.6 - f) / 0.6));
      sh = 1 - 0.82 * smJ(0.03, 0.4, room);
    }
    const al = su.uAlto.value;
    if (al > 0.002) {
      const w = su.uWind.value, wn = Math.hypot(w.x, w.y) || 1, wx = w.x / wn, wz = w.y / wn;
      const qx = x + lx / ll / Ly * 5400, qz = z + lz / ll / Ly * 5400, fx = qx * wx + qz * wz, fz = -qx * wz + qz * wx;
      const m = read((fx - su.uAltoD.value.y) / WT + 0.37, fz / WT + 0.71, 2, 2.4), pch = read((fx - su.uAltoD.value.y) * 6 / WT + 0.29, fz * 6 / WT + 0.83, 0, 1.6);
      sh *= 1 - 0.3 * smJ(0.15, 0.85, m + 0.6 * al - 0.4) * Math.min(1, al * 1.3) * smJ(0.3, 0.7, pch + 0.08 * al);
    }
    return 1 + (sh - 1) * k;
  }
  function cloudMotion(ct, wind) {
    let dct = cloudMo.ct == null ? 0 : ct - cloudMo.ct; cloudMo.ct = ct;
    cloudMo.jump = !(Math.abs(dct) <= 30); if (cloudMo.jump) dct = 0;
    const su = skyMat.uniforms, w = su.uWind.value, wn = Math.hypot(w.x, w.y) || 1, spd = CLOUD_WIND * (0.75 + 0.25 * wind);
    cloudMo.dct = dct; cloudMo.s += spd * dct; cloudMo.dx = w.x / wn * spd * dct; cloudMo.dz = w.y / wn * spd * dct;
    cloudMo.x += cloudMo.dx; cloudMo.z += cloudMo.dz; cloudMo.b += CLOUD_RISE * dct;
    /* (the altocumulus, a third faster up there, its patches a little slower than its cloudlets, rising half as fast:
       its cloudlets repeat every 3300/1.4 m, its frayed edges every 240 m) */
    su.uAltoD.value.set(wrapP(1.3 * cloudMo.s, 3300 / 1.4), wrapP(1.3 * 0.9 * cloudMo.s, 36000), wrapP(0.5 * cloudMo.b, 3300 / 1.4), wrapP(1.3 * cloudMo.s, 240));
    su.uDriftW.value.set(wrapP(cloudMo.x, 36000), wrapP(cloudMo.z, 36000));
    su.uDriftS.value.set(wrapP(cloudMo.x, 3300), wrapP(cloudMo.b, 3300), wrapP(cloudMo.z, 3300));
    su.uDriftT.value.set(wrapP(cloudMo.x, 340), wrapP(cloudMo.b, 340), wrapP(cloudMo.z, 340));
    su.uHiDrift.value.set(cloudMo.x, cloudMo.z);
  }
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
    fin.uniforms.uSunScr = { value: new T.Vector4() }; fin.uniforms.uCloudB = { value: null }; fin.uniforms.uCloudBOn = { value: 0 };
    /* the clouds: marched at half size before the scene, each frame blended into the last (turned to where it now lies on
       screen), so the grain of a few dozen steps smooths away; the sky draws them from it */
    const su0 = skyMat.uniforms, cloudU = { uInvProj: { value: new T.Matrix4() }, uCamRot: { value: new T.Matrix3() }, uFrame: { value: 0 }, uEnv: { value: 0 }, uPxA: { value: 0.004 }, uOff: { value: new T.Vector2() }, uFull: { value: new T.Vector2(1, 1) } };
    for (const k of ['uZen', 'uHor', 'uGlow', 'uSunDirV', 'uMoonDirV', 'uMoonDisc', 'uSunDisc', 'uAnti', 'uTime', 'uStars', 'uCloud', 'uCloudLit', 'uCirrus', 'uAlto', 'uCumulus', 'uStratus', 'uStorm', 'uFlash', 'uBolt', 'uWind', 'uNoise', 'uCloudT', 'uCO', 'uCQ', 'uShape', 'uDetail', 'uWeather', 'uLdM', 'uDriftW', 'uDriftS', 'uDriftT', 'uAltoD']) cloudU[k] = su0[k];
    const cloudM = mk(GLSL.CLOUD_FS, cloudU);
    const cloudR = mk(GLSL.CLOUD_RES_FS, { uCur: { value: null }, uHist: { value: null }, uPrevVP: { value: new T.Matrix4() }, uInvProj: { value: new T.Matrix4() }, uCamRot: { value: new T.Matrix3() }, uHasPrev: { value: 0 }, uAlpha: { value: 0.3 }, uOff: cloudU.uOff, uFull: cloudU.uFull, uCamD: { value: new T.Vector3() }, uDriftD: { value: new T.Vector2() }, uShell: { value: new T.Vector2(0, 2200) }, uAltoOn: { value: 0 } });
    const OFFS = [[0, 0], [1, 1], [1, 0], [0, 1]];
    /* how much of the sun and the moon shows past the clouds: two pixels, marched every frame (whether or not the view's
       clouds are) */
    const visM = mk(GLSL.CLOUDVIS_FS, cloudU), visRT = new T.WebGLRenderTarget(2, 1, { type: T.HalfFloatType, depthBuffer: false, minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    fin.uniforms.uSunVis = { value: visRT.texture };
    let clRT = [], clCur = null, ci = 0, clPrev = false, clFrame = 0, clCam = new T.Vector3(1e9, 0, 0);
    const _vr = new T.Matrix4();
    let rt = null, bl = [], dofRT = null, aoRT = null, aoBRT = null, fireRT = null, W = 0, H = 0, S = 0;
    function resize(w, h, samples) {
      if (w === W && h === H && samples === S) return;
      W = w; H = h; S = samples;
      if (rt) { rt.dispose(); rt.depthTexture.dispose(); bl.forEach(b => b.dispose()); dofRT.dispose(); aoRT.dispose(); aoBRT.dispose(); fireRT.dispose(); clRT.forEach(c => c.dispose()); clCur.dispose(); }
      const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
      /* (the clouds: kept at the full size, marched at half, a quarter of the pixels a frame) */
      clRT = [0, 1].map(() => new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter })); clPrev = false;
      clCur = new T.WebGLRenderTarget((w + 1) >> 1, (h + 1) >> 1, { type: T.HalfFloatType, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
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
      su0.uPix.value = 2 * Math.tan(camera.fov * Math.PI / 360) / rt.height;
      cloudU.uPxA.value = su0.uPix.value;
      quad.material = visM; R.setRenderTarget(visRT); R.render(qs, qc);
      if (p.clouds) {
        /* a jump (camp moved, a new view far away) or a leap of the clouds' clock starts the blend afresh */
        const dd = p.cloudDD || [0, 0];
        if (camera.position.distanceTo(clCam) > 40 || p.cloudJump || Math.hypot(dd[0], dd[1]) > 400) clPrev = false;
        const c = cloudM.uniforms; c.uInvProj.value.copy(camera.projectionMatrixInverse); c.uCamRot.value.setFromMatrix4(camera.matrixWorld);
        const o = OFFS[clFrame % 4]; c.uOff.value.set(o[0], o[1]); c.uFull.value.set(rt.width, rt.height);
        c.uFrame.value = (clFrame++) % 997; c.uPxA.value = 2 * Math.tan(camera.fov * Math.PI / 360) / rt.height;
        quad.material = cloudM; R.setRenderTarget(clCur); R.render(qs, qc);
        const r = cloudR.uniforms; r.uCur.value = clCur.texture; r.uHist.value = clRT[1 - ci].texture; r.uHasPrev.value = clPrev ? 1 : 0; r.uAlpha.value = p.cloudBlend;
        r.uCamD.value.subVectors(camera.position, clCam); r.uDriftD.value.set(dd[0], dd[1]); r.uAltoOn.value = su0.uAlto.value > 0.002 ? 1 : 0; if (p.cloudShell) r.uShell.value.set(p.cloudShell[0], p.cloudShell[1]); clCam.copy(camera.position);
        r.uInvProj.value.copy(camera.projectionMatrixInverse); r.uCamRot.value.copy(c.uCamRot.value);
        quad.material = cloudR; R.setRenderTarget(clRT[ci]); R.render(qs, qc);
        su0.uCB.value = clRT[ci].texture; su0.uCBOn.value = 1; su0.uCBInv.value.set(1 / rt.width, 1 / rt.height); fin.uniforms.uCloudB.value = clRT[ci].texture; fin.uniforms.uCloudBOn.value = 1;
        /* (for the next frame: where a direction lay on this frame's screen) */
        _vr.copy(camera.matrixWorldInverse).setPosition(0, 0, 0); r.uPrevVP.value.copy(camera.projectionMatrix).multiply(_vr);
        ci = 1 - ci; clPrev = true;
      } else { su0.uCBOn.value = 0; fin.uniforms.uCloudBOn.value = 0; }
      /* (the scene itself: where it is drawn with several samples to a pixel, the leaves' edges are shared among them) */
      Mats.U.uA2C.value = rt.samples > 0 ? 1 : 0;
      R.setRenderTarget(rt); R.clear(); R.render(scene, camera);
      Mats.U.uA2C.value = 0;
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
      u.uExp.value = p.exp; u.uBloomK.value = p.bloomK; u.uFade.value = p.fade; u.uTime.value = p.t; u.uNight.value = p.night; u.uSunScr.value.copy(p.sunScr || new T.Vector4());
      R.setRenderTarget(null); R.render(qs, qc);
      sync();
    }
    /* for warming up: every pass's material, and a way to compile one */
    const compile = m => { quad.material = m; R.compile(qs, qc); };
    /* (for the test bench: the sun's and the moon's share showing, read back) */
    const readVis = () => { const b = new Uint16Array(8); R.readRenderTargetPixels(visRT, 0, 0, 2, 1, b); return [T.DataUtils.fromHalfFloat(b[0]), T.DataUtils.fromHalfFloat(b[4])]; };
    return { resize, render, materials: [down, up, fin, dof, ssao, aob, fire, cloudM, cloudR, visM], compile, cloudMat: cloudM, visTex: visRT.texture, readVis, height: () => H || 720 };
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
  /* the clicked swells and the splash rings go to the shaders in a small float texture, a row each, as many as there are
     (GLSL.MAXUW, GLSL.MAXRIP: more than anyone clicks in the minute a swell and its wet sand last) */
  const surgeData = new Float32Array(Math.max(GLSL.MAXUW, GLSL.MAXRIP) * 2 * 4);
  const surgeTex = new T.DataTexture(surgeData, Math.max(GLSL.MAXUW, GLSL.MAXRIP), 2, T.RGBAFormat, T.FloatType);
  surgeTex.minFilter = surgeTex.magFilter = T.NearestFilter; surgeTex.generateMipmaps = false; surgeTex.needsUpdate = true;
  function surgeUpload(wt) {
    /* (swells whose wet sand has dried and rings that have faded leave the lists) */
    surge.waves = surge.waves.filter(q => wt - q.x < tsOf(q.amp) + 15 && q.t0 <= wt + 1);
    surge.ripples = surge.ripples.filter(r => wt - r.t0 < 4.5 && r.t0 <= wt + 1);
    /* (should there ever be more than a row holds, the swells that came ashore longest ago give way first) */
    const ws = surge.waves.length > GLSL.MAXUW ? surge.waves.slice().sort((a, b) => a.x - b.x).slice(-GLSL.MAXUW) : surge.waves;
    const rs = surge.ripples.slice(-GLSL.MAXRIP), W = surgeTex.image.width;
    let mx = 0;
    ws.forEach((w, j) => { surgeData.set([w.x, w.amp, w.xc, w.s0], j * 4); mx = Math.max(mx, w.amp); });
    rs.forEach((r, j) => surgeData.set([r.x, r.z, r.t0, r.A], (W + j) * 4));
    gU.uNUw.value = ws.length; gU.uNRip.value = rs.length; gU.uUwMax.value = mx; surgeTex.needsUpdate = true;
  }
  const surge = { ripples: [], waves: [], combo: 0, lastT: -1e9, dyn: [], fireOut: null, lightsOut: null, lantOut: [null, null, null], candleOut: null, vanHit: null, rugWet: null, rng: null };
  const shoreDZ = x => Layout.shoreDZ(x);
  /* the shore as the shaders see it (Layout.Shore): how far out from the water's edge a point is, and where along the coast */
  const _sh = {}, _shi = {}, shAt = (x, z) => Layout.Shore.at(x, z, _sh);
  const sOf = (x, z) => shAt(x, z).s;
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
  /* the direction in the world through a point of the picture (0..1 across, 0..1 down) */
  const dirAt = (nx, ny) => { const v = new T.Vector3(nx * 2 - 1, -(ny * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize(); return [v.x, v.y, v.z]; };
  function clickSea(nx, ny, wt) {
    const h = seaPick(nx, ny); if (!h || h.s < 0.8) return null;
    h.a = shAt(h.x, h.z).a;
    surge.combo = wt - surge.lastT < 2.8 ? surge.combo + 1 : 1; surge.lastT = wt;
    /* (a soft ring where it was touched; the swell itself rises there and rolls in) */
    surge.ripples.push({ x: h.x, z: h.z, t0: wt, A: 0.35 });
    const s0 = Math.min(Math.max(h.s, 7), 76);
    /* clicks close together in time and place stack into one taller swell */
    let w = surge.waves.find(q => q.x - wt > 1.2 && Math.abs(q.xc - h.a) < 14 && wt - q.t0 < 4.5);
    if (w) { w.amp = Math.min(7.5, w.amp + 1.15); w.xc += (h.a - w.xc) * 0.3; }
    else { w = { t0: wt, x: wt + s0 / CU, amp: 1.5, xc: h.a, s0, px: h.x, pz: h.z }; surge.waves.push(w); }
    surge.waves = surge.waves.filter(q => wt - q.x < tsOf(q.amp) + 15);   /* each kept as long as the shader still draws its wet sand */
    return { x: h.x, z: h.z, combo: surge.combo, amp: w.amp, eta: w.x - wt, reach: (0.85 + 0.75 * w.amp) };
  }
  const userAmpJS = (w, x, wt) => { const sc = Math.max(w.s0 - (wt - (w.x - w.s0 / CU)) * CU, 0), hw = Math.min(9 + 0.8 * (w.s0 - sc), 46), dx = (x - w.xc) / hw;
    const along = 0.82 + 0.36 * (0.5 + 0.25 * Math.sin(x * 0.31 + w.xc) + 0.25 * Math.sin(x * 0.13 + 1.7 * w.xc)); return w.amp * along * Math.exp(-dx * dx); };
  /* ── the sea's height at a point just now: the very sums the shaders work out (glsl.js, WAVEH: swellL, waveH), for the
     things that float and swim and should rise and fall with the swell that is passing ── */
  function swellJS(s, tau, amp, spd, sb) {
    const x = s + tau * spd, shoal = 1 + 0.8 * smJ(sb + 14, sb, s), broken = smJ(sb + 0.2, sb - 1.6 - 0.1 * sb, s);
    const pb = Math.max(0, Math.min(1, (sb - s) / Math.max(sb, 1))), bore = 0.66 + (0.24 - 0.66) * pb, steep = smJ(sb + 8, sb + 0.5, s) * (1 - broken);
    const lf = (0.9 + 0.035 * Math.max(s, 0)) * (1 + (0.48 - 1) * Math.max(steep, 0.7 * broken)), lb = 2.3 + 0.07 * Math.max(s, 0);
    const prof = x < 0 ? Math.exp(-x * x / (lf * lf)) : Math.exp(-x * x / (lb * lb)), k = spd > 2 ? 0.27 / (1 + 0.08 * Math.max(amp - 1.5, 0)) : 0.16;
    return amp * k * shoal * (1 + (bore - 1) * broken) * prof * smJ(-0.3, 1.4, s);
  }
  /* when tide swell (x0 its time, ph its phase, ob how aslant) reaches a along the shore: as glsl.js swPh */
  const swPhJS = (a, x0, ph, ob) => x0 + 0.9 * Math.sin(a * 0.11 + ph) + 1.7 * Math.sin(a * 0.023 + 2.3 * ph) + 1.0 * Math.sin(a * 0.052 + 4.1 * ph) + a * 0.03 * ob;
  function waveAt(x0, z, wt = waveNow) {
    const q = shAt(x0, z), s = q.s, x = q.a; if (s < -0.5 || !gU) return 0;
    /* (into a cove, up a creek, the swell comes that much later) */
    const lgm = Layout.Shore.lag(x0, z);
    const nA = 0.5 + 0.24 * Math.sin(x * 0.19 + 1.3) + 0.18 * Math.sin(x * 0.071 + 0.4) + 0.12 * Math.sin(x * 0.53 + 2.0);
    /* (how open the shore is to the swell, and how much breaks out on a reef: as the shaders have it) */
    const I = Layout.isle ? Layout.Shore.info(x, _shi) : null, ex = I ? I.ex : 1, rk = I ? Math.min(1, I.rock + 0.6 * I.cliff) : 0, R = I ? I.reef : 0;
    let h = 0;
    const lag = rk * Math.max(R - 6, 0) / 1.55 + lgm / 1.55;
    for (const W of gU.uWv.value) { if (W.y <= 0) continue; const sb0 = 3 + 7 * nA * W.y; h += swellJS(s, wt - swPhJS(x, W.x, W.z, W.w) - lag, W.y * ex, 1.55, sb0 + (Math.max(R, 4) + 1.5 * W.y - sb0) * rk); }
    for (const w of surge.waves) {
      const amp = userAmpJS(w, x, wt) * smJ(w.x - w.s0 / CU, w.x - w.s0 / CU + 1.8, wt); if (amp < 0.01) continue;
      h += swellJS(s, wt - w.x - lgm / CU, amp, CU, Math.min((3 + 4.6 * amp) * (0.88 + 0.24 * nA), Math.max(4, 0.5 * w.s0 * (0.9 + 0.2 * nA))));
    }
    return h;
  }
  /* is (x, z) under the swash of a click-swell at time wt? (mirrors the ground shader, tongues and all) */
  function swashAt(x0, z, wt) {
    const q = shAt(x0, z), r = -q.s, x = q.a; let best = null;
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
      const wp = d.o.getWorldPosition(new T.Vector3()), qn = shAt(wp.x, wp.z), Lw = new T.Vector3(-qn.nx, 0, -qn.nz).normalize();
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
        /* (from where it stands now: a chair turned since the camp went up goes over from there) */
        d.p0.copy(d.o.position); d.q0.copy(d.o.quaternion);
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
    if (shacks && camp.castle) shacks.restore(camp.castle);
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
    if (camp.crate) add(camp.crate, 6.1, 0.4, 'grow');
    if (camp.toolbox) add(camp.toolbox, 2.7, 0.4, 'grow');
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
    if (marks) marks.clear(); if (inspect) inspect.clear();
    coastFollow(camX ?? Layout.camp.x);
    /* the chunk round the camp at once, then a quarter of a second of the rest (more follows as the frames go on) */
    if (world) world.update(camX ?? Layout.camp.x, 250);
    /* (the fruit trees stand by the camp as its palms do: on the new ground under them) */
    if (orchard) orchard.reground();
  }
  Object.assign(api, { moveCamp, pitchStart, waveAt: (x, z) => waveAt(x, z) });
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
  let grass = null, huts = null, hutT = null, snowFx = null, snowT = null, snowmen = null, fauna = null, faunaT = null, roughNow = 0, shacks = null, flora = null, bouquetJar = null, inspect = null, shallows = null, waveNow = 0, orchard = null, orchT = null; const faunaIn = {};
  /* how far up the sand the water reaches at x just now, in metres from the waterline: the tide's swash as the ground
     shader draws it (the same six waves, timed along the beach the same way), and any clicked swell's. For the birds
     that chase the water's edge and the crabs that keep out of it */
  function swashFront(x, wt) {
    const WT = 9.0, k0 = Math.floor(wt / WT); let r = 0;
    for (let k = k0 - 5; k <= k0 + 2; k++) {
      const h = n => hash(k * n + 0.37), amp = (0.55 + 0.6 * h(3.33)) * (1 + 0.55 * roughNow), ph = h(2.71) * 6.283;
      const tau = wt - swPhJS(x, k * WT + (h(1.37) - 0.5) * 2.0, ph, h(0.93) - 0.5), T_ = tsOf(amp);
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
      const qr = shAt(p.x, p.z), s = Math.max(0, qr.s), al = qr.a, lg = Layout.Shore.lag(p.x, p.z) / WCJ;
      for (let k = Math.floor((wt0 - lg) / WT) - 1; k <= Math.ceil(wt1 / WT) + 1; k++) {
        const h = n => hash(k * n + 0.37), T0 = swPhJS(al, k * WT + (h(1.37) - 0.5) * 2.0, h(2.71) * 6.283, h(0.93) - 0.5) - s / WCJ + lg;
        if (T0 >= wt0 && T0 <= wt1) out.push({ id: 'r' + k + '_' + i, wave: 'w' + k, x: T0, amp: 0.55 + 0.6 * h(3.33), d, rad: p.rad, px: p.x });
      }
      for (const w of surge.waves) { const T0 = w.x - s / CU; if (T0 >= wt0 && T0 <= wt1) out.push({ id: 'ru' + w.t0.toFixed(2) + '_' + i, wave: 'u' + w.t0.toFixed(2), x: T0, amp: 1 + 0.6 * userAmpJS(w, al, T0), d, rad: p.rad, px: p.x }); }
    }
    return out;
  }
  const surgeState = () => surge;
  /* a sky lantern let go from near the rug */
  function lantern() { if (!life) return 0; const a = Math.random() * TAU2, d = 0.6 + Math.random() * 1.2; life.lantern(Layout.camp.x + Math.cos(a) * d, Layout.camp.z + Math.sin(a) * d * 0.6, performance.now() / 1000); return life.lanterns; }
  const TAU2 = Math.PI * 2;
  /* ── the camper van, driven: pose, wheels, pack-up state, lights ── */
  const _e = new T.Euler(0, 0, 0, 'YXZ');
  /* the van's own things on the sand (its doormat and sandals, the lantern by its door) go where it goes: packed away as
     it closes up to drive, laid out again by its door wherever it stops and opens up */
  let vanProps = null;
  const _vm = new T.Matrix4(), _vp = new T.Vector3(), _vq = new T.Quaternion(), _vs = new T.Vector3();
  function initVanProps() {
    const g = camp.vanGroup; g.updateMatrixWorld(true); const inv = g.matrixWorld.clone().invert(); vanProps = [];
    const add = (o, lantern) => { if (!o) return; o.updateMatrixWorld(true); vanProps.push({ o, lantern, off: inv.clone().multiply(o.matrixWorld), s: o.scale.x }); };
    add(camp.vanMat);
    (camp.lanternGroups || []).forEach((lg, i) => { const p = lg.getWorldPosition(new T.Vector3()); if (Math.hypot(p.x - g.position.x, p.z - g.position.z) < 3.5) add(lg, i); });
  }
  function placeVanProps(k) {
    if (!vanProps) return;
    const g = camp.vanGroup, s = 1 - sm01(0, 0.45, k);
    for (const p of vanProps) {
      _vm.multiplyMatrices(g.matrixWorld, p.off); _vm.decompose(_vp, _vq, _vs); _e.setFromQuaternion(_vq, 'YXZ');
      p.o.position.set(_vp.x, 0, _vp.z); p.o.rotation.set(0, _e.y, 0); p.o.scale.setScalar(Math.max(0.001, s * p.s)); p.o.visible = s > 0.01;
      if (p.lantern != null) { const l = camp.lanterns[p.lantern]; l.pos.set(_vp.x, l.pos.y, _vp.z); l.vis = s; Mats.U.uLant.value[p.lantern].x = _vp.x; Mats.U.uLant.value[p.lantern].z = _vp.z; }
      /* (set out again: a wave that reaches it knocks it over where it now stands) */
      if (s >= 1) { const d = surge.dyn.find(d => d.o === p.o); if (d && !d.hit) { d.p0.copy(p.o.position); d.P0.copy(p.o.position); d.q0.copy(p.o.quaternion); d.Q0.copy(p.o.quaternion); d.wx = _vp.x; d.wz = _vp.z; } }
    }
  }
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
    if (camp.vanInside.door) { camp.vanInside.door.value = k < 0.6 ? 1 : 0; camp.vanInside.pop.value = k < 0.12 ? 1 : 0; }
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
    placeVanProps(k);
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
      bottle: camp.bottle ? wp(camp.bottle, 0.03) : [B.x, 0.08, B.z], basket: camp.basket ? wp(camp.basket, 0.34) : [Tb.x + 1.4, 0.3, Tb.z - 1] };
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
    /* (and the sand, seen along the ground at your feet as much as the sea is: without it the grain smears to a blur) */
    sandTex.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());

    keyLight = new T.DirectionalLight(0xffffff, 1);
    keyLight.castShadow = true;
    const sm = opts.shadowSize || 2048;
    keyLight.shadow.mapSize.set(sm, sm);
    Object.assign(keyLight.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 140 });
    keyLight.shadow.bias = -0.0006; keyLight.shadow.normalBias = 0.03;
    keyLight.target.position.set(Layout.camp.x, 0, Layout.camp.z);
    scene.add(keyLight, keyLight.target);
    hemi = new T.HemisphereLight(0xffffff, 0x000000, Math.PI); scene.add(hemi);
    torch = makeTorch(opts.torchShadow || (opts.shadowSize && opts.shadowSize < 1024 ? 512 : 1024));
    /* the lights are on the local shadow cameras' layers too (2, 3; see localShadow): those depth passes then find the
       same lights as the main pass, instead of none, and three no longer looks every material's program over again
       twice a frame whenever the fire is lit */
    for (const l of [keyLight, hemi]) { l.layers.enable(2); l.layers.enable(3); }

    const V3 = () => new T.Vector3();
    skyU = { uZen: { value: V3() }, uHor: { value: V3() }, uGlow: { value: V3() }, uSunDirV: { value: V3() }, uMoonDirV: { value: V3() }, uMoonDisc: { value: V3() }, uSunDisc: { value: V3() }, uAnti: { value: new T.Vector4() } };
    /* (round the island, the far ranges across the sea: drawn by the sky, from horizon.js's profile of them) */
    /* (the round island stands in the open sea: no far ranges unless asked for) */
    const hzP = Layout.isle && typeof IsleHorizon !== 'undefined' && opts.horizon === true ? IsleHorizon.profile() : null;
    skyMat = new T.ShaderMaterial({
      uniforms: Object.assign({}, skyU, { uEnv: { value: 0 }, uCloudLit: { value: new T.Vector3() }, uStars: { value: 1 }, uTime: { value: 0 }, uPhaseC: { value: 1 }, uPhaseSign: { value: 1 }, uCloud: { value: 0.85 }, uMoonR: { value: 0.0175 }, uSunR: { value: 0.016 }, uNoise: { value: noiseTex },
        uCirrus: { value: 0.5 }, uAlto: { value: 0.0 }, uCumulus: { value: 0.6 }, uStratus: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uBolt: { value: new T.Vector4() }, uWind: { value: new T.Vector2(0.93, -0.37) }, uCloudT: { value: 0 }, uDriftW: { value: new T.Vector2() }, uDriftS: { value: new T.Vector3() }, uDriftT: { value: new T.Vector3() }, uHiDrift: { value: new T.Vector2() }, uAltoD: { value: new T.Vector4() }, uPix: { value: 0.0015 },
        uCO: { value: new T.Vector3() }, uCQ: { value: 1 }, uCB: { value: null }, uCBOn: { value: 0 }, uCBInv: { value: new T.Vector2(1, 1) },
        uShape: { value: null }, uDetail: { value: null }, uWeather: { value: null }, uLdM: { value: new T.Vector3(0, 1, 0) }, uPxA: { value: 0.004 },
        uHzP: { value: hzP ? hzP.tex : null }, uHzOn: { value: hzP ? 1 : 0 }, uHzMist: { value: 1 } }),
      vertexShader: GLSL.SKY_VS, fragmentShader: GLSL.SKY_FS, side: T.BackSide, depthWrite: false
    });
    const sky = new T.Mesh(new T.SphereGeometry(5000, 48, 24), skyMat); sky.renderOrder = 1000; sky.frustumCulled = false; scene.add(sky); skyMesh = sky;
    /* the real night sky (stars.js): the stars and planets drawn just after the sky, behind its clouds; the Milky Way and the
       moon's lit side drawn by the sky itself */
    stars = Stars.build(scene, { uCB: skyMat.uniforms.uCB, uCBOn: skyMat.uniforms.uCBOn, uHzP: skyMat.uniforms.uHzP, uHzOn: skyMat.uniforms.uHzOn });
    Object.assign(skyMat.uniforms, { uEqT: { value: stars.eqT }, uMW: { value: stars.milky }, uMWK: { value: 0.011 }, uSunM: { value: new T.Vector3() } });
    Object.assign(api, { stars });
    /* environment: the same sky, rendered into a prefiltered cube map so every glossy surface reflects it */
    envSkyMat = new T.ShaderMaterial({ uniforms: Object.assign({}, skyMat.uniforms, { uEnv: { value: 1 }, uCQ: { value: 0.4 }, uPxA: { value: 0.03 }, uPix: { value: 0.02 }, uGround: { value: new T.Vector3() } }), vertexShader: GLSL.SKY_VS, fragmentShader: GLSL.SKY_FS, side: T.BackSide, depthWrite: false });
    envScene = new T.Scene(); { const m = new T.Mesh(new T.SphereGeometry(400, 64, 32), envSkyMat); m.frustumCulled = false; envScene.add(m); }
    pmrem = new T.PMREMGenerator(R);
    envInit();
    { const n3 = Textures.noise3(); n3Tex = new T.Data3DTexture(n3.data, n3.size, n3.size, n3.size); n3Tex.format = T.RedFormat; n3Tex.type = T.UnsignedByteType;
      n3Tex.minFilter = n3Tex.magFilter = T.LinearFilter; n3Tex.wrapS = n3Tex.wrapT = n3Tex.wrapR = T.RepeatWrapping; n3Tex.unpackAlignment = 1; n3Tex.needsUpdate = true; }
    /* the clouds' billows, the fine detail that erodes their edges, and the weather that says where they grow (baked on the GPU) */
    { const cn = CloudNoise.make(R), su = skyMat.uniforms; su.uShape.value = cn.shape; su.uDetail.value = cn.detail; su.uWeather.value = cn.weather; cloudNoiseMs = cn.ms; }
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
    initVanProps();
    if (camp.bottleModel) uncork = Uncork.make({ scene, camera, bottle: camp.bottle, model: camp.bottleModel, ground: 0, onPop: () => { if (api.onBottlePop) api.onBottlePop(); } });
    surge.rng = Textures.rng(4242); registerDyn(camp.dyn);
    scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = o.material.metalness > 0.5 ? 1.8 : 1.45; });
    fx = FX.build(fxG, camp, nature, noiseTex); Object.assign(api, { fx });
    depthOnly = new T.MeshBasicMaterial({ colorWrite: false, side: T.DoubleSide });
    fireS = localShadow(170, 0.08, 12, 2, 256); canS = localShadow(150, 0.3, 12, 3, 1024);
    const nCast = tagLocalCasters(campG);
    Mats.U.uFireSh.value = fireS.rt.depthTexture; Mats.U.uFireShM.value = fireS.M;
    Mats.U.uCanSh.value = canS.rt.depthTexture; Mats.U.uCanShM.value = canS.M;

    /* the island's shore, for the shaders, when the page is asked for the island (Layout.isle): its grid and its coastline
       as textures (glsl.js ISLE_GL) */
    if (Layout.isle) { const t0 = performance.now(), I = Layout.island(); Mats.isleUp(I.gpu()); isleMs = { build: I.data.ms, gpu: Math.round(performance.now() - t0) }; }
    const drect = { x: -17, z: -10.5, w: 34, d: 15 }, dec = Paint.decals(drect, opts.decalPPM || 48);
    gU = Object.assign({}, Mats.U, skyU, {
      uNoise: { value: noiseTex }, uWater: { value: waterTex },
      uDecal: { value: Mats.tex(dec.color, { srgb: true }) }, uRelief: { value: Mats.dataTex(dec.relief, dec.w, dec.h, { mip: true }) }, uSand: { value: sandTex },
      uDecalRect: { value: new T.Vector4(drect.x, drect.z, drect.w, drect.d) },
      uShadowMap: { value: null }, uShadowMatrix: { value: new T.Matrix4() }, uShadowSize: { value: new T.Vector2(sm, sm) }, uShadowOn: { value: 0 }, uShadowK: { value: 1 },
      uAmb: { value: V3() }, uKeyDir: { value: V3() }, uKeyCol: { value: V3() }, uMoonGlit: { value: V3() }, uSunGlit: { value: V3() },
      uDay: { value: 0 }, uWaveT: { value: 0 }, uPud: { value: 0 }, uWv: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new T.Vector4()) }, uSurgeT: { value: surgeTex }, uNUw: { value: 0 }, uNRip: { value: 0 }, uUwMax: { value: 0 }, uNearRect: { value: new T.Vector4(-96, -98, 96, 2) }, uNearT: { value: new T.Vector4(0, 0, 1, 0) }, uDbgG: { value: 0 }, uTideHi: { value: 0 }, uMist: { value: 1 }, uWet: { value: 0 }, uRough: { value: 0 }, uShC: { value: new T.Vector3(Layout.camp.x, Layout.camp.z, 24) },
      uSunVis: { value: null }
    });
    /* (the clouds' own uniforms, the very same, for their shadows on the sand and the sea) */
    for (const k of ['uWeather', 'uDriftW', 'uWind', 'uAltoD', 'uLdM', 'uCumulus', 'uStratus', 'uStorm', 'uAlto']) gU[k] = skyMat.uniforms[k];
    groundMat = new T.ShaderMaterial({ uniforms: gU, vertexShader: GLSL.GROUND_VS, fragmentShader: GLSL.GROUND_FS, defines: { FAR: 1 } });
    const ground = new T.Mesh(new T.PlaneGeometry(40000, 40000, 160, 160), groundMat);   /* in cells, or depth goes ragged across one huge triangle */
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -19800); ground.frustumCulled = false; scene.add(ground); groundMesh = ground;
    /* the near-shore sea is a fine mesh carrying a real wave height field (tide swells and clicked swells) */
    /* (192 m along the beach by 100 m out to sea, in cells of 40 cm; it is moved a whole cell at a time, so its vertices
       always stand on the same spots and the waves they carry never shimmer) */
    const ng = new T.PlaneGeometry(NEAR.W, NEAR.D, opts.nearSegX || Math.round(NEAR.W / NEAR.CELL), opts.nearSegZ || Math.round(NEAR.D / NEAR.CELL));
    ng.rotateX(-Math.PI / 2);
    const nearMat = new T.ShaderMaterial({ uniforms: gU, vertexShader: GLSL.GROUND_VS, fragmentShader: GLSL.GROUND_FS, defines: { NEAR: 1 } });
    const nearSea = new T.Mesh(ng, nearMat); nearSea.frustumCulled = false; scene.add(nearSea); nearMesh = nearSea;

    /* the coast beyond the camp, without end: headlands, surf rocks with foam, the forest on its hills;
       and the small lives of the shore, its shells laid along every chunk of it as the chunk is built.
       The chunk round the camp is built now, the rest a little at a time as the camera comes near */
    coastFollow(Layout.cameras.wide.pos[0]);
    /* (or the island's land, when the page is asked for the island, and its forest) */
    /* (the forest's and the fruit trees' bark and leaves painted at half the studio's fineness: a quarter of the time to wait) */
    FloraKit.Q.tex = opts.texQ ?? 0.5;
    /* (the round island: its beach and its forest; none of the rocky island's trails, streams, park or boulders) */
    /* (and its huts along the top of the beach: where they stand worked out first, so the forest keeps clear of them) */
    const hutPlan = Layout.isle && typeof IsleHuts !== 'undefined' && opts.huts !== false ? IsleHuts.plan(Layout.island()) : null;
    world = Layout.isle ? IsleWorld.build(natG, gU, { R, forest: opts.forest, trails: false, streams: false, park: false, stones: false, keep: hutPlan ? hutPlan.map(p => p.clear) : [] }) : World.build(natG, gU, noiseTex, { R });
    if (hutPlan) { huts = IsleHuts.build(natG, Layout.island(), world, { plan: hutPlan }); world.addWalker(huts.walk); world.addObstacles(huts.obstacles); Object.assign(api, { huts });
      for (const h of huts.huts) for (const s of ['hammock', 'bench', 'bed', 'chair']) { const P = huts.seatPose(h.p.i, s); if (P) SEATS.push({ id: P.id, name: P.name, kind: 'hut', hut: h.p.i, seat: s, near: 'hut' }); } }
    /* (round the island, what is seen across the sea: Borneo's coast and its ranges, Kinabalu, the park's other islands) */
    if (Layout.isle && typeof IsleHorizon !== 'undefined' && opts.horizon === true) {
      horizon = IsleHorizon.build(scene, { sky: skyU, U: Mats.U, mist: gU.uMist }); Object.assign(api, { horizon });
      skyMat.uniforms.uHzMist = gU.uMist; envSkyMat.uniforms.uHzMist = gU.uMist;
    }
    /* (and its animals, round the eye) */
    if (Layout.isle && typeof IsleFauna !== 'undefined' && opts.isfauna !== false) { isFauna = IsleFauna.build(natG, Layout.island(), { land: (x, z) => world.land(x, z), keep: world.park ? [[world.park.plan.hut.x, world.park.plan.hut.z, 12], [world.park.plan.jetty.x, world.park.plan.jetty.z, 10]] : [], creek: world.trails ? world.trails.trails.find(t => t.id === 'creek') : null, trees: world.forest ? (x, z, r, k) => world.forest.standing(x, z, r, k) : null }); Object.assign(api, { isFauna }); }
    life = Life.build(natG, gU, world);
    shallows = Shallows.build(natG, gU, world); Object.assign(api, { shallows });
    flora = Flora.build(natG, world);
    /* (round the island, its grass, blade by blade: grass.js) */
    if (Layout.isle && typeof IsleGrass !== 'undefined' && opts.grass !== false) { grass = IsleGrass.build(natG); Object.assign(api, { grass }); if (huts) grass.setClear(huts.plan.map(p => p.lawn)); }
    if (huts) huts.plan.slice(0, Mats.U.uLawn.value.length).forEach((p, i) => Mats.U.uLawn.value[i].set(p.lawn[0], p.lawn[1], p.lawn[2], p.lawn[3] ?? 1));
    /* the people of the coast: shacks, coco huts, fishing boats, every so often along it (laid out with each chunk) */
    shacks = Shacks.build(natG, world); Object.assign(api, { shacks });
    /* (and the camp's sand castle washes away as theirs do; washed flat, there is no castle left to walk round) */
    if (camp.castle) shacks.adopt(Object.assign(camp.castle, { onGone: on => { const ob = Layout.castle.ob; if (ob) ob[2] = on ? 0 : (Layout.castle.radius || 0.9) * 0.82; } }));
    world.prime();
    /* and the wildlife of the whole coast: fireflies all along the forest edge, gulls, sandpipers, crabs, bats, dolphins */
    fauna = Fauna.build(natG, world); Object.assign(api, { fauna });
    /* the fruit round the camp, flowering and fruiting on their own round, and the coconuts on its palms (orchard.js) */
    orchard = Orchard.build(natG, world, { palms: nature.palms }); Object.assign(api, { orchard });
    /* the small lives that can be picked up and held, and thrown back where they belong (inspect.js); and the fruit */
    inspect = Inspect.build({ scene, root: natG, camera, ground: (x, z) => world.land(x, z),
      sources: [(L, c) => fauna.pickables(L, c), (L, c) => life.pickables(L, c), (L, c) => flora.pickables(L, c), (L, c) => shallows.pickables(L, c), (L, c) => orchard.pickables(L, c), (L, c) => { if (isFauna) isFauna.pickables(L, c); }],
      splash: (x, z, s) => { fauna.splash(x, z, s); surge.ripples.push({ x, z, t0: waveNow, A: 0.3 + 0.25 * s }); if (surge.ripples.length > 12) surge.ripples.shift(); } });
    marks = Marks.build(natG); Object.assign(api, { marks });
    /* snow falling, when the weather brings it (snow.js) */
    snowFx = Snow.build(scene); Object.assign(api, { snowFx });
    /* and the snowballs and snowmen rolled in it (snowman.js), each facing whoever made it */
    snowmen = Snowmen.build(natG, world, { face: () => [camera.position.x, camera.position.z] }); Object.assign(api, { snowmen });
    post = makePost(); gU.uSunVis.value = post.visTex;
    return { casters: nCast };
  }

  /* the shoreline the shaders draw: the strip of it round the camera (Mats.coastFill), carried along as it moves */
  /* (every frame: when there is nothing new to work out it costs nothing) */
  function coastFollow(x) { if (!Layout.isle) Mats.coastFill(x); }
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

  /* ── the walker's torch: a small aluminium torch held low in the right hand, its rubber grip rings, the switch, a
     chrome bezel round the lens and the reflector behind it. Its light is a spot light's: three renders its shadow map
     (everything that casts a shadow, leaves cut out of their cards), and the scene's own shaders light with it
     (artLight: a bright hotspot in a softer spill, shadowed), so the palms, the rocks and the camp throw shadows across
     the sand that swing as the beam does. A faint cone of light shows in the night air ── */
  let torch = null;
  function makeTorch(size) {
    const L = new T.SpotLight(0xffffff, 0, 34, 0.52, 0.4, 2);
    L.castShadow = true; L.shadow.mapSize.set(size, size); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.02;
    Object.assign(L.shadow.camera, { near: 0.12, far: 34 }); L.shadow.autoUpdate = false;
    scene.add(L, L.target);
    /* the torch itself (models/camp/torch.js): its metal takes the sky's light from the scene's own environment map, so
       it shows the night it is held up in */
    const g = Models.make('camp/torch'), { lens, lensM, ledM } = g.userData;
    /* (the torch in hand is drawn over the finished frame, in a little scene of its own with the night's light on it:
       held this close it would otherwise be lost in the depth of field's blur) */
    const tS = new T.Scene(), amb = new T.AmbientLight(0xffffff, 0), key = new T.DirectionalLight(0xffffff, 0), glow = new T.PointLight(0xfff0d8, 0, 0.6, 2);
    /* (and the light its own beam throws back off the ground ahead, on its underside) */
    const bounce = new T.DirectionalLight(0xffeedd, 0);
    /* (and a soft light from over your shoulder, the way an eye used to the dark still makes out what is in its hand) */
    const view = new T.DirectionalLight(0xdfe8ff, 0);
    tS.add(g, amb, key, key.target, glow, bounce, bounce.target, view, view.target); g.visible = false;
    /* the beam in the air: an open cone, brightest along its axis and near the lens, fading out with distance */
    const bg = new T.ConeGeometry(Math.tan(0.4) * 14, 14, 32, 1, true); bg.translate(0, -7, 0); bg.rotateX(Math.PI / 2);
    const beamM = new T.ShaderMaterial({ uniforms: { uK: { value: 0 }, uFog: Mats.U.uFog }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: `varying vec3 vL; varying vec3 vW; void main(){ vL = position; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uK; varying vec3 vL; varying vec3 vW;
void main(){ float d = -vL.z, r = length(vL.xy)/max(d*tan(0.4), 1e-3); vec3 V = normalize(cameraPosition - vW);
  float a = uK*exp(-d/5.5)*pow(max(0.0, 1.0 - r), 1.6)*smoothstep(0.0, 0.6, d)*0.05;
  gl_FragColor = vec4(vec3(1.0, 0.94, 0.84)*a, 1.0); }` });
    const beam = new T.Mesh(bg, beamM); beam.frustumCulled = false; beam.visible = false; scene.add(beam);
    return { L, g, lens, lensM, ledM, beam, beamM, k: 0, tS, amb, key, glow, bounce, view };
  }
  const _tq = new T.Quaternion(), _te = new T.Euler(), _tv = new T.Vector3(), _tf = new T.Vector3();
  /* o.torch: { k: how far on (0..1), off: [right, down, forward] in the camera's frame, sway: [yaw, pitch] } */
  function stepTorch(o, S) {
    if (!torch) return;
    const tt = o.torch, k = tt ? tt.k : 0, on = k > 0.001;
    torch.g.visible = on && (tt.held !== false); torch.beam.visible = on; torch.L.shadow.autoUpdate = on;
    Mats.U.uTorch.value.w = 0; torch.lensM.color.setRGB(0.08, 0.08, 0.08); torch.lensM.opacity = 0.55; torch.ledM.color.setRGB(0.25, 0.24, 0.2);
    if (!on) return;
    const off = tt.off || [0.19, 0.21, 0.44], sw = tt.sway || [0, 0];
    _tv.set(off[0], -off[1], -off[2]).applyQuaternion(camera.quaternion).add(camera.position);
    _te.set(-0.15 + sw[1], 0.04 + sw[0], 0, 'YXZ'); _tq.setFromEuler(_te); torch.g.quaternion.copy(camera.quaternion).multiply(_tq); torch.g.position.copy(_tv);
    torch.g.updateMatrixWorld(true);
    const lp = torch.lens.getWorldPosition(new T.Vector3()); _tf.set(0, 0, -1).applyQuaternion(torch.g.quaternion);
    torch.L.position.copy(lp); torch.L.target.position.copy(lp).addScaledVector(_tf, 10); torch.L.target.updateMatrixWorld(); torch.L.updateMatrixWorld();
    torch.beam.position.copy(lp); torch.beam.quaternion.copy(torch.g.quaternion);
    /* (as bright to the eye whatever the night: the eye that has got used to a dark night finds the torch brighter, so it
       is turned down as far as the frame's exposure is turned up) */
    const flick = 0.985 + 0.015 * Math.sin(o.t * 37.0) * Math.sin(o.t * 11.0), ex = Math.max(0.05, S.exposure * (o.expMul || 1)), adapt = Math.min(1.6, Math.max(0.3, 5 / ex));
    Mats.U.uTorch.value.set(lp.x, lp.y, lp.z, 0.62 * k * flick * adapt); Mats.U.uTorchDir.value.copy(_tf);
    if (torch.L.shadow.map) { Mats.U.uTorchSh.value = torch.L.shadow.map.texture; Mats.U.uTorchShM.value = torch.L.shadow.matrix; Mats.U.uTorchShS.value.copy(torch.L.shadow.mapSize); }
    torch.lensM.color.setRGB(1.6 * k, 1.5 * k, 1.35 * k); torch.lensM.opacity = 0.55 + 0.4 * k; torch.ledM.color.setRGB(6 * k, 5.7 * k, 5.1 * k); torch.beamM.uniforms.uK.value = k;
    /* the night's light on the torch in hand: the sky's, the moon's, and a little of its own spill on the bezel */
    torch.tS.environment = scene.environment; torch.amb.color.setRGB(S.amb[0], S.amb[1], S.amb[2]); torch.amb.intensity = scene.environment ? 0 : Math.PI;
    torch.key.color.setRGB(S.keyCol[0], S.keyCol[1], S.keyCol[2]); torch.key.intensity = Math.PI * campShade; torch.key.position.copy(torch.g.position).add(_tv.set(S.keyDir[0], S.keyDir[1], S.keyDir[2]).multiplyScalar(5)); torch.key.target.position.copy(torch.g.position); torch.key.target.updateMatrixWorld();
    /* the lit sand ahead, a couple of metres off and below: what it gives back */
    _tv.set(0, -1, 0).addScaledVector(_tf, 1.4); torch.bounce.position.copy(torch.g.position).addScaledVector(_tv, 3); torch.bounce.target.position.copy(torch.g.position); torch.bounce.target.updateMatrixWorld();
    torch.bounce.intensity = 0.45 * k * adapt;
    _tv.set(0.25, 0.7, 0.9).applyQuaternion(camera.quaternion); torch.view.position.copy(torch.g.position).addScaledVector(_tv, 3); torch.view.target.position.copy(torch.g.position); torch.view.target.updateMatrixWorld();
    torch.view.intensity = 1.1 * k / ex;
    torch.glow.position.copy(lp).addScaledVector(_tf, -0.02); torch.glow.intensity = 0.04 * k;
  }
  /* the torch in hand, over the finished frame, tone-mapped near enough as the frame was */
  function drawTorch(exp) {
    if (!torch || !torch.g.visible) return;
    /* (the frame itself is tone-mapped and encoded by the post pass; this is drawn straight to the screen, so it must be
       encoded here) */
    const tm = R.toneMapping, te = R.toneMappingExposure, ac = R.autoClear, cs = R.outputColorSpace;
    R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = exp; R.autoClear = false; R.outputColorSpace = T.SRGBColorSpace; R.setRenderTarget(null);
    R.clearDepth(); R.render(torch.tS, camera);
    R.toneMapping = tm; R.toneMappingExposure = te; R.autoClear = ac; R.outputColorSpace = cs;
  }

  /* ── round the island the near-shore sea's fine mesh is laid along whichever shore is being looked at: turned to face
     it square (in steps of three degrees, so it is seldom turned at all, and its vertices keep to one lattice while it
     is not), its landward edge a little above the water's edge all along it, and round any swell that has been sent in ── */
  let isleMs = null; const nearI = { phi: null, cx: 1e9, cz: 1e9 }, _nq = {}, _np = {};
  function nearIsle(o) {
    const lk = (o.cam || Layout.cameras.wide).look, Sh = Layout.Shore, wtn = o.waveT ?? (o.t || 0);
    let px = (camera.position.x + lk[0]) / 2, pz = (camera.position.z + lk[2]) / 2;
    const pend = surge.waves.filter(w => wtn < w.x + 8 && w.px !== undefined);
    if (pend.length) { const w = pend.reduce((a, b) => (b.t0 > a.t0 ? b : a)); px = w.px; pz = w.pz; }
    const q = Sh.at(px, pz, _nq), fx = px - q.nx * q.s, fz = pz - q.nz * q.s, STEP = Math.PI / 60;
    const want = Math.atan2(-q.nx, -q.nz);
    if (nearI.phi === null || Math.abs(Math.atan2(Math.sin(want - nearI.phi), Math.cos(want - nearI.phi))) > STEP * 1.5) nearI.phi = Math.round(want / STEP) * STEP;
    const c = Math.cos(nearI.phi), sn = Math.sin(nearI.phi), toW = (lx, lz) => [lx * c + lz * sn, -lx * sn + lz * c];
    /* (the water's edge across the mesh's width: its landward edge goes 4 m beyond the furthest in of it) */
    const lzF = fx * sn + fz * c, lxF = fx * c - fz * sn; let edge = -1e9;
    for (let i = 0; i <= 8; i++) { const lx = lxF - NEAR.W / 2 + i * NEAR.W / 8, [wx, wz] = toW(lx, lzF), s = Sh.at(wx, wz, _np).s; edge = Math.max(edge, lzF + s); }
    edge = Math.min(edge, lzF + 40);
    const lx = Math.round(lxF / NEAR.CELL) * NEAR.CELL, lz = Math.round((edge + 4 - NEAR.D / 2) / NEAR.CELL) * NEAR.CELL, [cx, cz] = toW(lx, lz);
    if (cx !== nearI.cx || cz !== nearI.cz) {
      nearI.cx = cx; nearI.cz = cz; nearMesh.position.set(cx, 0, cz); nearMesh.rotation.set(0, nearI.phi, 0);
      gU.uNearT.value.set(cx, cz, c, sn); gU.uNearRect.value.set(-NEAR.W / 2, -NEAR.D / 2, NEAR.W / 2, NEAR.D / 2);
    }
  }
  Object.defineProperty(api, 'isleMs', { get: () => isleMs });
  let lastCW = 0, lastCH = 0, fabT = null, shExT = null, shExK = 9, hutExT = null, hutExK = 0, canExT = null, canExK = 0;
  function render(o) {
    /* keep the renderer's own size (and so its screen viewport) in step with the canvas,
       or a resized window shows the frame in only part of it */
    if (canvas.width !== lastCW || canvas.height !== lastCH) { lastCW = canvas.width; lastCH = canvas.height; R.setSize(lastCW, lastCH, false); }
    const S = Sky.compute(o.ms, o.loc, { front: o.skyFront ?? (Layout.isle ? 0 : 1) }), t = o.t;
    /* (round the island: what its hill and forest shade from the light, worked out again as the light moves; and the
       camera, like an eye, exposing for the shade when what it looks at, and where it stands, is in it — not all the
       way: the sunlit sea and sky beyond are in the picture too) */
    if (world && world.shade) {
      world.shade.update(S.shDir);
      const c0 = o.cam || Layout.cameras.wide, lk = c0.look, cp = c0.pos || lk, k = 0.5 * world.shade.at(lk[0], lk[2]) + 0.5 * world.shade.at(cp[0], cp[2]);
      const dt = shExT === null ? 1 : Math.max(0, Math.min(1, (o.t - shExT) / 1.2)); shExT = o.t; shExK += (k - shExK) * (shExK > 1.5 ? 1 : dt);
      const lu = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], la = lu(S.amb), ld = lu(S.keyCol) * Math.max(0, S.keyDir[1]);
      S.exposure = Math.min(16, S.exposure * (la + ld + 0.0045) / (la + ld * (0.4 + 0.6 * Math.min(1, shExK)) + 0.0045));
      /* (and down under the forest's canopy, where only a fifth of the sky's light gets in, the eye opens up further for
         the green half-light, over a couple of seconds; the gaps to the sky go bright) */
      if (world.shade.top) {
        const top = world.shade.top(cp[0], cp[2]), q = Math.max(0, Math.min(1, (top - cp[1] - 5) / 11)), kc = q * q * (3 - 2 * q);
        const dtc = canExT === null ? 1 : Math.max(0, Math.min(1, (o.t - canExT) / 2.0)); canExT = o.t; canExK += (kc - canExK) * dtc;
        S.exposure = Math.min(16, S.exposure * (1 + 1.4 * canExK * (0.3 + 0.7 * S.day)));
      }
    }
    /* (and in a hut's room, the eye opening up for its dimmer light over a second or so; the doorway and the windows go
       bright) */
    if (huts) {
      const c0 = o.cam || Layout.cameras.wide, cp = c0.pos || c0.look, kin = huts.inside(cp[0], cp[1], cp[2]);
      const dt = hutExT === null ? 1 : Math.max(0, Math.min(1, (o.t - hutExT) / 0.9)); hutExT = o.t; hutExK += (kin - hutExK) * dt;
      S.exposure = Math.min(16, S.exposure * (1 + 2.4 * hutExK * (0.35 + 0.65 * S.day)));
    }
    /* the tide: where the water's edge is now (everything that knows where the sea is reads it from Layout), and where it
       reached at the last high water (the sand it left is still damp) */
    { const TD = o.tide === false ? { dz: 0, hi: 0 } : S.tide; Layout.tide.dz = TD.dz; Layout.tide.hi = TD.hi; Mats.U.uTideZ.value = TD.dz; if (gU) gU.uTideHi.value = TD.hi; }
    /* under a deck of cloud the sun no longer lights the scene directly: its light dims and its shadows soften away */
    { const ov = o.sky ? Math.min(1, Math.max(o.sky.stratus, o.sky.storm)) : 0;
      if (ov > 0) { const k = 1 - 0.75 * ov; S.keyCol = S.keyCol.map(v => v * k); S.shadowK *= 1 - 0.85 * ov; }
      /* (snow lying brightens a grey day: the sky's light comes back up off it, and the eye, as on any snowy day, opens up
         for the soft light rather than staying stopped down for the sun) */
      const sk = Math.min(1, o.snow || 0);
      if (sk > 0.01 && Array.isArray(S.amb)) { S.amb = S.amb.map(v => v * (1 + 0.45 * sk)); S.exposure = Math.min(16, S.exposure * (1 + 0.55 * sk * ov * S.day)); } }
    const rs = o.renderScale || 1, w = Math.max(2, Math.round(canvas.width * rs)), h = Math.max(2, Math.round(canvas.height * rs));
    post.resize(w, h, o.msaa ?? 4);
    setCamera(o.cam || Layout.cameras.wide, canvas.width / canvas.height, o.shiftX || 0);
    stepTorch(o, S);
    /* what is held up close, or thrown and on its way (its own clock: real time, whatever time of day is doing) */
    waveNow = o.waveT ?? t;
    if (inspect) inspect.update(iClock(), S);
    /* the fruit's round, on the life clock (the scene's time flow), its falls in real time (the same clock as the hand's) */
    if (orchard) { const tc = iClock(), dtR = orchT === null ? 0 : Math.max(0, Math.min(0.1, tc - orchT)); orchT = tc; orchard.update(dtR, o.flow ?? 1, { wind: o.wind ?? 1 }); }
    /* the wind in the grown trees' leaves and twigs, and on the fruit hanging from them (FloraLeaf.WIND): a breeze, more
       of it and gustier as the weather turns (o.wind: 1 a breeze, 2.6 a storm) */
    { const w = o.wind ?? 1, W = FloraLeaf.U.uWindV.value; W.set(Layout.wind[0], Layout.wind[1], Math.min(1.5, 0.45 + 0.42 * (w - 1)), Math.min(1, 0.5 + 0.3 * (w - 1)));
      /* (and on the shore's older trees, the camp's bushes and the grass: swaying further, and in a gale leaning over on it
         and shivering, more as each gust comes through) */
      const k = Math.max(0, w - 1), gust = Math.max(0, 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1.3) + 0.25 * Math.sin(t * 0.53 + 0.4));
      Mats.U.uWindK.value.set(1 + k * (0.55 + 0.5 * gust), k * (0.45 + 0.6 * gust)); }
    /* the finely meshed surf follows the camera along the coast; so do the sky, the open sea, the shoreline the shaders
       draw, and the building of the coast's chunks (a few milliseconds of it a frame, unless asked otherwise) */
    /* (the surf is meshed round what is being looked at, and round any swell that has been sent in, so a swell clicked far
       along the beach rises where it was clicked; its landward edge just above the shore there) */
    if (nearMesh && Layout.isle) nearIsle(o);
    else if (nearMesh) {
      const lk = (o.cam || Layout.cameras.wide).look, keep = NEAR.W / 2 - 52;
      let cx = (camera.position.x + lk[0]) / 2;
      /* (swells on their way in: as many of them as the mesh can hold, the newest first, as near the view as can be) */
      const wtn = o.waveT ?? (o.t || 0), pend = surge.waves.filter(w => wtn < w.x + 8);
      if (pend.length) {
        let best = null;
        for (const c of [cx, ...pend.flatMap(w => [w.xc - keep, w.xc + keep])]) {
          const inn = pend.filter(w => Math.abs(w.xc - c) <= keep + 1e-6), sc = [inn.length, inn.reduce((m, w) => Math.max(m, w.t0), -1e9), -Math.abs(c - cx)];
          if (!best || sc[0] > best.sc[0] || (sc[0] === best.sc[0] && (sc[1] > best.sc[1] || (sc[1] === best.sc[1] && sc[2] > best.sc[2])))) best = { c, sc };
        }
        cx = best.c;
      }
      cx = Math.round(cx / NEAR.CELL) * NEAR.CELL;
      let zt = -1e9; for (let i = 0; i <= 8; i++) zt = Math.max(zt, Layout.shoreZ(cx - NEAR.W / 2 + i * NEAR.W / 8));
      zt = Math.round((zt + 4) / NEAR.CELL) * NEAR.CELL;
      if (cx !== nearX || zt !== nearZ) { nearX = cx; nearZ = zt; nearMesh.position.set(cx, 0, zt - NEAR.D / 2); gU.uNearRect.value.set(cx - NEAR.W / 2, zt - NEAR.D, cx + NEAR.W / 2, zt); }
    }
    skyMesh.position.copy(camera.position);
    groundMesh.position.x = Math.round(camera.position.x / 100) * 100;
    if (Layout.isle) groundMesh.position.z = Math.round(camera.position.z / 100) * 100;
    coastFollow(camera.position.x);
    if (world) world.update(camera.position.x, o.buildMs ?? 4, camera.position.z, camera.position.y);
    /* the sun's (or moon's) shadow map covers the camp, or the van wherever it has been driven to */
    { const lk = (o.cam || Layout.cameras.wide).look, away = Math.hypot(lk[0] - Layout.camp.x, lk[2] - Layout.camp.z) > 30;
      const sc = o.shadowC || (away ? [Math.round(lk[0]), Math.round(lk[2])] : [Layout.camp.x, Layout.camp.z]);
      keyLight.target.position.set(sc[0], 0, sc[1]); keyLight.target.updateMatrixWorld(); gU.uShC.value.set(sc[0], sc[1], 24); Mats.U.uLeafShA.value.set(sc[0], sc[1], 24, Mats.U.uLeafShA.value.w); }
    /* the shore's small lives: leaping fish (each leap and landing leaves a splash) and shoals in the shallows */
    let splashes = [];
    if (life) {
      const dt = lifeT === null ? 0 : Math.max(0, Math.min(0.1, t - lifeT)); lifeT = t;
      const twilight = Math.exp(-Math.pow((S.sAlt - 2) / 9, 2));
      if (o.dens) life.setShells(o.dens.shells);
      splashes = life.update(t, dt, camera.position.x, { day: S.day, twilight, calm: o.calm, realT: performance.now() / 1000, fish: o.dens ? o.dens.fish : 0.5 });
      if (shallows) shallows.update(t, camera.position);
      for (const sp of splashes) { surge.ripples.push({ x: sp.x, z: sp.z, t0: o.waveT ?? t, A: 0.35 * sp.k / 0.4 }); }
    }
    if (flora) flora.update(t, camera);
    if (huts) { const dtH = hutT === null ? 0 : Math.max(0, Math.min(0.1, t - hutT)); hutT = t; huts.update(dtH, t, camera.position, S); }
    /* the snow lying (how much, how deep) for every shader that lays it, and the flakes in the air */
    Mats.U.uSnow.value.set(o.snow || 0, o.snowD || 0, o.snowFall || 0, 0);
    if (snowFx) { const now = performance.now() / 1000, dtS = snowT === null ? 0 : Math.max(0, Math.min(0.1, now - snowT)); snowT = now; snowFx.update(dtS, camera.position, camera, { fall: o.snowFall || 0, wind: o.wind ?? 1, height: post.height() }); if (snowmen) snowmen.update(dtS, o.snowD || 0); }
    if (grass) grass.update(camera.position, { ground: world ? world.land(camera.position.x, camera.position.z) : 0, wind: o.wind ?? 1, gust: Mats.U.uWindK.value.y, push: o.push || null, snow: o.snow || 0, snowD: o.snowD || 0, q: o.grassQ ?? 1 });
    const V = setV;
    V(skyU.uZen, S.zen); V(skyU.uHor, S.hor); V(skyU.uGlow, S.glow); V(skyU.uSunDirV, S.sunDirV); V(skyU.uMoonDirV, S.moonDirV);
    V(skyU.uMoonDisc, S.moonDisc); V(skyU.uSunDisc, S.sunDisc); skyU.uAnti.value.set(S.anti[0], S.anti[1], S.anti[2], 0);
    V(skyMat.uniforms.uLdM, S.keyDir);
    /* the stars: the sky turned to the time and the place, as bright as the night (and the moon) lets them be */
    if (stars) { const k = o.sky ? Math.min(1, 0.55 * o.sky.cumulus + o.sky.stratus + o.sky.storm + 0.6 * (o.sky.rain || 0)) : 0;
      stars.update({ ms: o.ms, loc: o.loc, t, k: S.stars * 0.42, px: Math.max(1, post.height() / 900), cover: k, moonDir: S.moonDirV });
      skyMat.uniforms.uSunM.value.set(S.sunM[0], S.sunM[1], S.sunM[2]); }
    const su = skyMat.uniforms; su.uStars.value = S.stars; su.uTime.value = t; su.uCloudT.value = o.cloudT ?? t; cloudMotion(o.cloudT ?? t, o.wind ?? 1); su.uCO.value.copy(camera.position); su.uCQ.value = o.cloudQ ?? 1; su.uPhaseC.value = S.moonPhaseC; su.uPhaseSign.value = S.moonPhaseSign; V(su.uCloudLit, S.cloudLit); if (o.clouds !== undefined) su.uCloud.value = o.clouds;
    if (o.sky) { const k = o.sky; su.uCirrus.value = k.cirrus; su.uAlto.value = k.alto; su.uCumulus.value = k.cumulus; su.uStratus.value = k.stratus; su.uStorm.value = k.storm; su.uFlash.value = k.flash || 0; if (k.bolt) su.uBolt.value.set(k.bolt[0], k.bolt[1], k.bolt[2], k.bolt[3]); else su.uBolt.value.w = 0; }
    /* under a deck of cloud the sun and moon no longer glitter on the sea */
    { const ov = o.sky ? Math.min(1, Math.max(o.sky.stratus, o.sky.storm)) : 0, g = 1 - ov;
      V(gU.uAmb, S.amb); V(gU.uKeyDir, S.keyDir); V(gU.uKeyCol, S.keyCol); gU.uMoonGlit.value.set(S.moonGlit[0] * g, S.moonGlit[1] * g, S.moonGlit[2] * g); gU.uSunGlit.value.set(S.sunGlit[0] * g, S.sunGlit[1] * g, S.sunGlit[2] * g); }
    gU.uDay.value = S.day; gU.uShadowK.value = S.shadowK; gU.uWaveT.value = o.waveT ?? t; Mats.U.uTime.value = t;
    gU.uWet.value = o.wet || 0; gU.uRough.value = o.rough || 0; gU.uPud.value = o.pud || 0; Mats.U.uFlood.value = o.flood || 0;
    const wt = o.waveT ?? t;
    { const WT = 9.0, kb = Math.floor(wt / WT);
      /* (eight: the ones arriving round now, and those come long enough before to be arriving now at the back of a cove) */
      for (let j = 0; j < 8; j++) { const k = kb - 5 + j, h = n => hash(k * n + 0.37);
        gU.uWv.value[j].set(k * WT + (h(1.37) - 0.5) * 2.0, (0.55 + 0.6 * h(3.33)) * (1 + 0.55 * (o.rough || 0)), h(2.71) * 6.283, h(0.93) - 0.5); }
      surgeUpload(wt); }
    updateSurge(wt);
    /* (under a cloud's shadow, the camp's light goes as the sand's round it does) */
    const csc = cloudShadowAt(gU.uShC.value.x, gU.uShC.value.y); campShade = csc;
    keyLight.color.setRGB(S.keyCol[0], S.keyCol[1], S.keyCol[2]); keyLight.intensity = Math.PI * csc;
    keyLight.position.copy(keyLight.target.position).addScaledVector(R3.key.set(S.keyDir[0], S.keyDir[1], S.keyDir[2]), 70);
    envStep(S, performance.now() / 1000, o.env !== false);
    hemi.intensity = scene.environment ? 0 : Math.PI;
    hemi.color.setRGB(S.amb[0], S.amb[1], S.amb[2]); Mats.U.uKeyDirT.value.set(S.keyDir[0], S.keyDir[1], S.keyDir[2]).normalize(); Mats.U.uKeyColT.value.set(S.keyCol[0] * csc, S.keyCol[1] * csc, S.keyCol[2] * csc); Mats.U.uAmbF.value.set(S.amb[0], S.amb[1], S.amb[2]); hemi.groundColor.setRGB(S.groundAmb[0], S.groundAmb[1], S.groundAmb[2]); envSkyMat.uniforms.uGround.value.set(S.groundAmb[0], S.groundAmb[1], S.groundAmb[2]);

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
    camp.lanterns.forEach((l, i) => { const lo = flickOut(surge.lantOut[i], wt, 0.6), k = 0.42 * L.lantern * candleFlicker(t, i) * lo; Mats.U.uLant.value[i].w = l.s * lo * (l.vis ?? 1); l.mat.color.setRGB(1.0 * k + S.amb[0] * 0.5, 0.55 * k + S.amb[1] * 0.5, 0.22 * k + S.amb[2] * 0.5); });
    camp.candles.forEach((m, i) => { const k = 0.5 * L.lantern * candleFlicker(t, i + 5) * flickOut(surge.candleOut, wt, 0.5); m.color.setRGB(1.0 * k + 0.01, 0.6 * k + 0.01, 0.28 * k + 0.01); });
    /* (the lamp inside the van, and the daylight that comes in at its door and windows) */
    { const k = 0.085 * L.van * vf, I = camp.vanInside; I.color.setRGB(1.0 * k, 0.6 * k, 0.3 * k); if (I.amb) I.amb.setRGB(S.amb[0] * 0.5, S.amb[1] * 0.5, S.amb[2] * 0.5); }
    (camp.vanGlow || []).forEach(v => { v.m.emissiveIntensity = v.k * L.van * vf; });
    { const k = 0.45 * F.i * (0.7 + 0.4 * ff); camp.coals.color.setRGB(1.0 * k, 0.28 * k, 0.05 * k); }
    Nature.sway(nature, t, o.wind ?? 1);
    /* the camp's cloth (the van's valance, the towel on the chair) flaps on the scene's own clock */
    { const dt = fabT === null ? 0 : Math.max(0, Math.min(0.25, t - fabT)); fabT = t; Camp.flutter(camp, dt, o.wind ?? 1, camera); }
    /* the journal: turn pages, and keep it readable after dark (its paper carries a little light of its own) */
    { const rk = (o.read || 0) * 0.36 * (1 - 0.9 * S.day) / Math.max(0.05, S.exposure * (o.expMul || 1));
      for (const b of [camp.book, camp.journal]) if (b) { b.update(); b.setReadLight(rk); }
      if (paper) { paper.update(); paper.setReadLight(rk * 1.45); }
      /* the message in a bottle, in your hands (uncork.js) */
      if (uncork) uncork.update(); }
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
      for (const sp of fauna.update(fi)) { surge.ripples.push({ x: sp.x, z: sp.z, t0: wt, A: sp.k }); }
    }
    if (isFauna) { const dt = isFaunaT === null ? 0 : Math.max(0, Math.min(0.25, t - isFaunaT)); isFaunaT = t; isFauna.update(dt, t, camera.position, { day: S.day, dens: o.dens, sAlt: S.sAlt }); }
    if (shacks) shacks.update(S, t, wt, swashFront);
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
      Mats.U.uLeafShM.value = keyLight.shadow.map.texture; Mats.U.uLeafShX.value = keyLight.shadow.matrix; Mats.U.uLeafShS.value.copy(gU.uShadowSize.value); Mats.U.uLeafShA.value.w = 1;
    }
    const soft = o.soft ?? 0.55, cam = o.cam || Layout.cameras.wide;
    const volFire = o.volFire !== false;
    fx.flames.forEach(f => { f.visible = !volFire; });
    const fb = camp.fireBase, fireTop = R3.top.set(fb.x, 1.05, fb.z).project(camera), fireSide = R3.side.set(fb.x, 1.05, fb.z).addScaledVector(R3.right.setFromMatrixColumn(camera.matrixWorld, 0), 0.35).project(camera);
    const hazeR = Math.abs(fireSide.x - fireTop.x) * 0.5 * (canvas.width / canvas.height);
    const haze = haze4.set(fireTop.x * 0.5 + 0.5, fireTop.y * 0.5 + 0.5, hazeR, fireTop.z < 1 ? F.i * (o.haze ?? 1) : 0);
    gU.uMist.value = 1 + 1.6 * soft;
    /* (round the island the eye can climb high: the haze lies low over the sea, thinning upward, so from high up there is
       less of it between the eye and what it looks down on: as much less as the air it looks down through is thinner, on
       average, than the air at the sea) */
    /* (and the haze the camp's own views are drawn with, close and soft, is the low air's over the sea at night: from a
       hillside or the summit, looking out over kilometres, the day's air is far clearer) */
    if (Layout.isle) { const y = Math.max(1, camera.position.y), H = 600, up = Math.max(0, Math.min(1, (y - 20) / 180)); gU.uMist.value *= H / y * (1 - Math.exp(-y / H)) * (1 - 0.86 * up * up * (3 - 2 * up)); }
    Mats.U.uFog.value.set(S.hor[0], S.hor[1], S.hor[2], gU.uMist.value);
    /* (the forest's own haze: the shade's light, sky and leaf-green, scattered in the damp air under the canopy) */
    { const k = o.forestFog || 0, a = S.amb, g = S.groundAmb || a; Mats.U.uForF.value.set((a[0] * 0.55 + g[0] * 0.25) * 1.1, (a[1] * 0.62 + g[1] * 0.3) * 1.25, (a[2] * 0.5 + g[2] * 0.2) * 0.95, k); }
    if (volFire) { ppFire.dbg = o.fireDbg || 0; ppFire.I = F.i * (0.8 + 0.35 * ff) * (o.fireK ?? 2.2); ppFire.flick = ff; ppFire.t = t; ppFire.n3 = n3Tex; ppFire.fc.set(fb.x, 0.02, fb.z); }
    pp.exp = S.exposure * (o.expMul || 1); pp.thresh = 0.85 - 0.3 * soft; pp.bloomK = (o.bloomK ?? 0.5) + 0.25 * soft; pp.fade = o.fade ?? 1; pp.t = t; pp.night = S.night; pp.prof = o.prof ? [] : null;
    pp.dofK = o.dof === false ? 0 : 4.5 * soft; pp.focus = cam.focus || 25; pp.grain = 0.003 + 0.008 * soft; pp.veil = 0.05 * soft;
    /* (with something held up close the eye is on it: the world behind goes soft) */
    if (inspect && inspect.k > 0.001) { const ik = inspect.k; pp.focus += (0.6 - pp.focus) * ik; pp.dofK = Math.max(pp.dofK, 7 * ik); }
    { const sd = S.sunDirV, sw = R3.sun.set(camera.position.x + sd[0] * 1000, camera.position.y + sd[1] * 1000, camera.position.z + sd[2] * 1000).project(camera);
      const ov = o.sky ? Math.min(1, Math.max(o.sky.stratus, o.sky.storm)) : 0, up = Math.max(0, Math.min(1, (S.sAlt + 1.5) / 3));
      const on = sw.z < 1 && Math.abs(sw.x) < 1.3 && Math.abs(sw.y) < 1.3 ? up * (1 - ov) * 0.9 : 0;
      pp.sunScr = sunScr4.set(sw.x * 0.5 + 0.5, sw.y * 0.5 + 0.5, on, 0); }
    pp.clouds = o.cloudBuf !== false; pp.cloudT = o.cloudT ?? t;
    /* (the history follows the drift, so a time-lapse needs only a little more of each new look: the billows' rising is
       what it can't follow) */
    pp.cloudBlend = (su.uFlash.value > 0.05 ? 0.8 : 0.22) + Math.min(0.25, Math.abs(cloudMo.dct) * 0.03);
    pp.cloudDD = cloudDD; cloudDD[0] = cloudMo.dx; cloudDD[1] = cloudMo.dz; pp.cloudJump = cloudMo.jump;
    { const st = su.uStratus.value, sm = su.uStorm.value, cb = 1500 + (900 - 1500) * st - 300 * sm, ctp = 3900 + (2500 - 3900) * st + 4600 * sm;
      pp.cloudShell = cloudShell; cloudShell[0] = Math.min(Math.max(camera.position.y, 0), 400); cloudShell[1] = cb + 0.3 * (ctp - cb); }
    pp.ao = o.ao === false ? 0 : 0.85; pp.haze = haze; pp.noiseT = noiseT; pp.rain = o.rain || 0; pp.rainSlant = o.rainSlant; pp.fire = volFire ? ppFire : null;
    const tc = performance.now();
    post.render(pp);
    drawTorch(pp.exp * (pp.fade ?? 1));
    if (inspect) inspect.draw(R, pp.exp * (pp.fade ?? 1), canvas.width / Math.max(1, canvas.height));
    if (o.prof) { const a = pp.prof; S.prof = { cpu: Math.round(a[0] - tc), scene: Math.round(a[1] - a[0]), bloom: Math.round(a[2] - a[1]), final: Math.round(a[3] - a[2]) }; }
    S.splashes = splashes;
    return S;
  }

  /* the journal by the fire: where it lies (for the reading camera) and its page turns */
  function bookFrame() {
    const g = camp.journalGroup, bk = camp.journal; g.updateMatrixWorld(true);
    const q = g.getWorldQuaternion(new T.Quaternion()), o = new T.Vector3().setFromMatrixPosition(g.matrixWorld);
    const r = new T.Vector3(1, 0, 0).applyQuaternion(q), top = new T.Vector3(0, 0, -1).applyQuaternion(q), up = new T.Vector3(0, 1, 0).applyQuaternion(q);
    return { o: o.toArray(), right: r.toArray(), top: top.toArray(), up: up.toArray(), W: bk.W, H: bk.H };
  }
  const bookApi = (name, get) => ({
    go: (k, open) => get().go(k, open), setPages: c => get().setPages(c), frame: () => bookFrame(name), paintCover: fn => get().paintCover(fn),
    dragStart: d => get().dragStart(d), dragTo: f => get().dragTo(f), dragEnd: c => get().dragEnd(c), get dragging() { return get().dragging; },
    busy: () => get().busy(), get spread() { return get().state.spread; }, get maxSpread() { return get().state.maxSpread; }, get open() { return get().state.open; }
  });
  const book = bookApi('journal', () => camp.journal), books = { journal: book };
  /* where each loose paper starts: the letter in the bottle, a blueprint in the basket, the clipboard on the van */
  function origin(name) {
    if (name === 'bottle' && uncork) return uncork.letterRest();
    const o = name === 'roll' ? camp.planRoll : camp.clipboard;
    o.updateMatrixWorld(true);
    const p = o.getWorldPosition(new T.Vector3()), q = o.getWorldQuaternion(new T.Quaternion());
    if (name === 'roll') q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.PI / 2));
    if (name === 'clipboard') p.add(new T.Vector3(0, -0.012, 0.002).applyQuaternion(q));
    return { p: p.toArray(), q: q.toArray() };
  }
  /* the message in a bottle: picked up, uncorked, shaken until the letter comes out (open, with what to do once the
     letter is out); put back (abort), the letter home again (letterBack) */
  const bottleApi = {
    open: (cb, o) => { if (uncork) uncork.open(cb, o); else if (cb) cb(null); }, abort: () => { if (uncork) uncork.abort(); },
    letterBack: () => { if (uncork) uncork.letterBack(); }, letterRest: () => (uncork ? uncork.letterRest() : origin('bottle')),
    /* the letter put back the way it came out, in your hands (null where that can't be: then letterRest and letterBack) */
    putBack: done => (uncork && !uncork.quick ? uncork.putBack(done) : null), letterIn: () => { if (uncork) uncork.letterIn(); },
    dist: () => (uncork ? uncork.dist() : null), get phase() { return uncork ? uncork.phase : 'rest'; }, get busy() { return !!uncork && uncork.busy; }
  };
  function prop(name, visible) {
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
  /* ── seats: the two chairs by the fire, two places on the driftwood log, and the floor cushions either side of the
     picnic table. For each: where a seated person's eyes are, which way they face (as the app's yaw: atan2(x, -z) of the
     way they look), how far down they look to begin with, and what they are near ── */
  const SEATS = [
    { id: 'chair0', name: 'The chair by the fire', kind: 'chair', i: 0, near: 'fire' },
    { id: 'chair1', name: 'The striped chair', kind: 'chair', i: 1, near: 'fire' },
    { id: 'log0', name: 'The driftwood log', kind: 'log', at: -0.55, near: 'fire' },
    { id: 'log1', name: 'The far end of the log', kind: 'log', at: 0.5, near: 'fire' },
    { id: 'rug0', name: 'A cushion at the table', kind: 'rug', c: 1, near: 'table' },
    { id: 'rug1', name: 'Across the table', kind: 'rug', c: 0, near: 'table' }
  ];
  const yawOf = (fx, fz) => Math.atan2(fx, -fz);
  function seatPose(i) {
    const S = SEATS[i]; if (!S || !camp) return null;
    if (S.kind === 'hut') { const P = huts && huts.seatPose(S.hut, S.seat); return P ? Object.assign({}, S, P, { kind: S.seat === 'chair' ? 'deskchair' : S.seat }) : null; }
    if (S.kind === 'chair') {
      const ch = camp.chairs && camp.chairs[S.i]; if (!ch) return null; ch.updateMatrixWorld(true);
      const eye = ch.localToWorld(new T.Vector3(-0.24, 0.96, 0)), f = new T.Vector3(1, 0, 0).applyQuaternion(ch.quaternion);
      return { eye: eye.toArray(), yaw: yawOf(f.x, f.z), pitch: -0.12, ...S };
    }
    if (S.kind === 'log') {
      const dw = camp.driftwood; if (!dw) return null; dw.updateMatrixWorld(true);
      const seat = dw.localToWorld(new T.Vector3(S.at, 0, 0)), F = Layout.fire, d = new T.Vector3(F.x - seat.x, 0, F.z - seat.z).normalize();
      const eye = seat.clone().addScaledVector(d, -0.08); eye.y = 0.98;
      return { eye: eye.toArray(), yaw: yawOf(d.x, d.z), pitch: -0.14, ...S };
    }
    const cu = camp.cushions && camp.cushions[S.c]; if (!cu) return null; cu.updateMatrixWorld(true);
    const p = cu.getWorldPosition(new T.Vector3()), tb = new T.Vector3(Layout.table.x, 0, Layout.table.z), d = tb.clone().sub(p).setY(0).normalize();
    const eye = p.clone().addScaledVector(d, -0.07); eye.y = 0.98;
    return { eye: eye.toArray(), yaw: yawOf(d.x, d.z), pitch: -0.32, ...S };
  }
  const seatCount = () => SEATS.length, seatIndex = id => SEATS.findIndex(s => s.id === id);
  /* a chair turned by ry from where it was set out (it turns about its seat; what lies on it turns with it) */
  function turnChair(i, ry) {
    const ch = camp && camp.chairs && camp.chairs[i]; if (!ch) return;
    const want = (ch.userData.ry0 || 0) + ry, r = ch.rotation; if (Math.abs(r.y - want) < 1e-5 && Math.abs(r.x) < 1e-6 && Math.abs(r.z) < 1e-6) return;
    if (surge.dyn.some(d => d.o === ch && d.hit)) return;            /* (knocked over by a wave: let it lie) */
    /* (all three angles: a chair stood up again after a wave has its turn read back from its quaternion, and one turned
       more than a right angle comes back as half a turn about x and z, which turning y alone would leave in, the chair
       facing the wrong way) */
    r.set(0, want, 0); ch.updateMatrixWorld(true);
  }
  /* what lies on a seat goes out of sight while you sit there (you would be sitting on it) */
  function seatProps(i, hidden) { const S = SEATS[i]; if (!S || S.kind !== 'chair' || !camp.chairProps) return; (camp.chairProps[S.i] || []).forEach(o => { o.visible = !hidden; }); }
  Object.assign(api, { seatCount, seatIndex, turnChair, seatProps });
  /* ── the drawing board on the picnic table, and the toolbox the drawings go into ── */
  /* where the paper lies (for the camera that looks down at it), as bookFrame does for the journal */
  function sketchFrame() {
    const sk = camp && camp.sketch; if (!sk) return null; const p = sk.userData.paper; p.updateMatrixWorld(true);
    const q = p.getWorldQuaternion(new T.Quaternion()), o = new T.Vector3().setFromMatrixPosition(p.matrixWorld);
    return { o: o.toArray(), right: new T.Vector3(1, 0, 0).applyQuaternion(q).toArray(), top: new T.Vector3(0, 1, 0).applyQuaternion(q).toArray(), up: new T.Vector3(0, 0, 1).applyQuaternion(q).toArray(), W: sk.userData.W, H: sk.userData.H };
  }
  /* where on the paper (u, v, 0 to 1, v up the sheet) a point (nx, ny) across the canvas lands, or null */
  function sketchUV(nx, ny) {
    const sk = camp && camp.sketch; if (!sk) return null;
    _ndc.set(nx * 2 - 1, 1 - ny * 2); _ray.setFromCamera(_ndc, camera);
    const h = _ray.intersectObject(sk.userData.paper, false)[0]; return h && h.uv ? [h.uv.x, h.uv.y] : null;
  }
  function setSketch(cv) { if (camp && camp.sketch) camp.sketch.userData.setPicture(cv); }
  function setSketchLight(k) { if (camp && camp.sketch) camp.sketch.userData.setLight(k); }
  function toolboxOpen(k) { if (camp && camp.toolbox) camp.toolbox.userData.open(k); }
  Object.assign(api, { sketchFrame, sketchUV, setSketch, setSketchLight, toolboxOpen });
  /* where the radio is, for its sound */
  function radioPos() { const g = camp && camp.radio && camp.radio.group; if (!g) return null; g.updateMatrixWorld(true); const v = g.getWorldPosition(new T.Vector3()); return [v.x, v.y, v.z]; }
  Object.assign(api, { radioPos });
  /* what a click at (nx, ny) across the canvas lands on: 'chair0', 'chair1', 'radio', 'board', or null */
  function pick(nx, ny) {
    if (!camp || !camp.pick) return null;
    _ndc.set(nx * 2 - 1, 1 - ny * 2); _ray.setFromCamera(_ndc, camera);
    let best = null, bd = 60;
    for (const o of camp.pick) { const h = _ray.intersectObject(o, true)[0]; if (h && h.distance < bd) { bd = h.distance; best = o.userData.pick; } }
    /* (the huts' doors, shutters, lamps, hammocks and boards, as near as an arm and a few steps can reach) */
    if (huts) { const h = huts.pick(_ray, Math.min(bd, 14)); if (h) best = h; }
    return best;
  }
  /* the radio's dial: how lit it is (0 is off) and where the needle sits along the scale, 0 to 1 */
  function setRadio(glow, dial) { if (camp && camp.radio) camp.radio.set(glow, dial); }
  /* points on these things for their hotspot dots (they move with a wave or a knock, like everything at the camp) */
  function propAnchors() {
    const at = (o, x, y, z) => o.localToWorld(new T.Vector3(x, y, z)).toArray(), b = camp.board;
    return { board: at(b.group, 0, b.Y + b.H / 2 - 0.02, 0.06), chair0: at(camp.chairs[0], -0.5, 1.06, 0), chair1: at(camp.chairs[1], -0.5, 1.06, 0), radio: at(camp.radio.group, 0, 0.2, 0),
      sketch: camp.sketch ? at(camp.sketch, 0, 0.06, 0) : null, toolbox: camp.toolbox ? at(camp.toolbox, 0, 0.3, 0) : null };
  }
  Object.assign(api, { paintBoard, setBoardLook, boardFrame, seatPose, pick, setRadio, propAnchors });
  /* the wild flowers at the forest's edge: which one a touch at (nx, ny) would pick (null if none is near enough), and
     picking it (it shrinks away; what was picked comes back: { kind, name, at }) */
  const pickFlower = (nx, ny) => flora ? flora.nearest(camera, nx, ny, canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height) : null;
  const pluckFlower = (f, t, quiet) => flora ? flora.pluck(f, t, quiet) : null;
  /* the bouquet in a jar on the picnic table (an empty list takes it away) */
  function setBouquetJar(list) {
    if (bouquetJar) { bouquetJar.parent && bouquetJar.parent.remove(bouquetJar); bouquetJar.traverse(m => { if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); }); bouquetJar = null; }
    if (!flora || !camp || !camp.table || !list || !list.length) return;
    bouquetJar = flora.jar(list); bouquetJar.position.set(-0.53, 0.425, 0.24); camp.table.add(bouquetJar);
  }
  Object.assign(api, { pickFlower, pluckFlower, setBouquetJar, flora: () => flora });
  /* picking up one of the small lives near where the screen was touched, holding it, turning it, letting it go */
  /* (real time; or, for the test bench, a clock it steps a frame at a time: __coveInspStep seconds a frame) */
  const iClock = () => window.__coveInspStep ? (window.__coveInspT || 0) : performance.now() / 1000;
  const inspectApi = {
    pick: (nx, ny) => inspect ? inspect.pick(nx, ny, canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height) : null,
    hold: (c, t) => inspect ? inspect.hold(c, t ?? iClock()) : null,
    turn: (dx, dy) => inspect && inspect.turn(dx, dy), zoom: f => inspect && inspect.zoom(f),
    throwIt: (t, dir) => inspect ? inspect.throwIt(t ?? iClock(), dir) : false,
    putBack: t => inspect ? inspect.putBack(t ?? iClock()) : false, keep: t => inspect ? inspect.keep(t ?? iClock()) : false, eat: t => inspect ? inspect.eat(t ?? iClock()) : false,
    get held() { return inspect ? inspect.held : null; }, get busy() { return !!inspect && inspect.busy; }, get flying() { return inspect ? inspect.flying : 0; },
    candidates: () => inspect ? inspect.candidates() : []
  };
  Object.assign(api, { inspect: inspectApi });
  /* what a wave (or the van) has knocked over: its dot and what it offers wait until the camp is put back up. Names are
     the chapters' and the dots' own: a chair, a seat, the radio, the board, the drawing board, the toolbox, the bottle… */
  function knockedObj(name) {
    if (!camp) return null;
    return { chair0: camp.chairs && camp.chairs[0], chair1: camp.chairs && camp.chairs[1], board: camp.board && camp.board.group, radio: camp.crate, notes: camp.crate,
      sketch: camp.table, toolbox: camp.toolbox, contact: camp.bottle, plans: camp.basket, log0: camp.driftwood, log1: camp.driftwood,
      rug0: camp.cushions && camp.cushions[1], rug1: camp.cushions && camp.cushions[0] }[name] || null;
  }
  const knocked = name => { const o = knockedObj(name); return !!o && surge.dyn.some(d => d.o === o && d.hit); };
  /* one thing set back up where it was (a chapter opened from the dock brings its object back) */
  function restore(name) {
    const o = knockedObj(name), d = o && surge.dyn.find(q => q.o === o); if (!d || !d.hit) return;
    d.p0.copy(d.P0); d.q0.copy(d.Q0); d.o.position.copy(d.P0); d.o.quaternion.copy(d.Q0); d.hit = null; canDone = false;
  }
  Object.assign(api, { knocked, restore });

  const dbg = { scene: () => scene, renderer: () => R, key: () => keyLight, ground: () => groundMat, post: () => post, cloudNoiseMs: () => cloudNoiseMs, sky: () => skyMat, camp: () => camp, cloudMat: () => post && post.cloudMat, campShade: () => campShade, cloudShadowAt: (x, z) => cloudShadowAt(x, z), sunVis: () => post.readVis() };
  Object.assign(api, { init, warm, render, project, dirAt, book, books, origin, prop, bottle: bottleApi, paintClip, strandBulbs, finish, blendCam, vanFlicker, dbg, clickSea, rebuildCamp, surgeInfo, seaPick, waveSchedule, rockHits, surgeState, lantern, anchors, anchorNow, setVan, vanPose, knock });
  Object.defineProperties(api, { world: { get: () => world }, life: { get: () => life }, paper: { get: () => paper }, camera: { get: () => camera }, renderer: { get: () => R }, scene: { get: () => scene } });
  return api;
})();
