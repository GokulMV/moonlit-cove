/* The model studio (dist/studio.html, built by node tools/build3d.mjs studio): one model at a time on a plain
   backdrop, lit the way a creature held up in the hands is (inspect.js: a key light from up and to the left, a cool
   fill from the right, a rim from behind, a sky to reflect), and drawn from six sides onto one sheet.
   Studio.sheet(name, { opts, t, flying, zoom, views }) → a PNG data URL (three across, two down). */
const Studio = (() => {
  const T = THREE, S = 760, COLS = 3, ROWS = 2;
  const cv = document.createElement('canvas'); cv.width = S * COLS; cv.height = S * ROWS; document.body.appendChild(cv);
  const R = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(S * COLS, S * ROWS, false);
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0; R.outputColorSpace = T.SRGBColorSpace;
  R.setScissorTest(true);
  /* the sky to reflect: a gradient sphere, blue above, a bright horizon, warm sand below */
  const envScene = new T.Scene();
  {
    const g = new T.SphereGeometry(50, 32, 16), c = [], P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 50, top = new T.Color(0.32, 0.5, 0.82), hor = new T.Color(0.95, 0.93, 0.9), sand = new T.Color(0.55, 0.47, 0.36);
      const col = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(sand, Math.pow(-y, 0.4)); c.push(col.r * 1.4, col.g * 1.4, col.b * 1.4); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    envScene.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    const sun = new T.Mesh(new T.SphereGeometry(3, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(14, 13, 11) })); sun.position.set(-20, 35, 22); envScene.add(sun);
  }
  const pm = new T.PMREMGenerator(R), env = pm.fromScene(envScene, 0.02).texture;
  const scene = new T.Scene(); scene.environment = env;
  /* the backdrop: a soft grey-blue, lighter at the middle */
  const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256; { const x = bg.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#7f8fa3'); gr.addColorStop(0.55, '#b9c0c8'); gr.addColorStop(1, '#8c8478'); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); }
  const bgT = new T.CanvasTexture(bg); bgT.colorSpace = T.SRGBColorSpace; scene.background = bgT;
  const key = new T.DirectionalLight(0xfff4e6, 2.6), fill = new T.DirectionalLight(0xdce8ff, 0.9), rim = new T.DirectionalLight(0xffffff, 1.4), amb = new T.AmbientLight(0xffffff, 0.15);
  scene.add(key, key.target, fill, fill.target, rim, rim.target, amb);
  /* (the engine's shadow maps and the string lights' pool are given stand-ins, as the engine gives them real ones: a
     shader with a sampler left empty draws nothing here) */
  { const rt = new T.WebGLRenderTarget(4, 4); rt.depthTexture = new T.DepthTexture(4, 4); rt.depthTexture.compareFunction = T.LessEqualCompare;
    R.setRenderTarget(rt); R.clear(); R.setRenderTarget(null);
    const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
    Mats.U.uFireSh.value = Mats.U.uCanSh.value = rt.depthTexture; Mats.U.uPool.value = white; Mats.U.uTorchSh.value = white; if (Mats.U.uLeafShM) Mats.U.uLeafShM.value = white; }
  /* (the engine's own lights off: no lanterns, no van, no fire on the specimen) */
  Mats.U.uLights.value.set(0, 0, 0, 0); Mats.U.uFire.value.set(0, 0, 0, 0); Mats.U.uKeyColT.value.set(1, 0.96, 0.9); Mats.U.uKeyDirT.value.set(-0.4, 0.8, 0.45).normalize(); if (Mats.U.uAmbF) Mats.U.uAmbF.value.set(0.35, 0.4, 0.48);
  const cam = new T.PerspectiveCamera(30, 1, 0.001, 200);
  /* the six sides: [azimuth from the front (+x) round toward +z, elevation] (3/4 front left, the right side, head on,
     from above, 3/4 behind, from below and in front) */
  const VIEWS = [[-0.75, 0.3], [Math.PI / 2, 0.12], [0, 0.18], [-0.5, 1.25], [Math.PI - 0.7, 0.35], [0.5, -0.55]];
  let cur = null;
  function sheet(name, o = {}) {
    if (cur) { scene.remove(cur); cur.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); cur = null; }
    const m = Models.make(name, o.opts || {}); cur = m; scene.add(m);
    if (m.userData.anim) m.userData.anim(o.t ?? 0.6, !!o.flying);
    m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m), sph = box.getBoundingSphere(new T.Sphere()), c = o.centre ? new T.Vector3(...o.centre) : sph.center, rad = sph.radius / (o.zoom || 1);
    const views = o.views || VIEWS;
    views.forEach(([az, el], i) => {
      const d = rad / Math.sin(cam.fov * Math.PI / 360) * 1.08, dir = new T.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      cam.position.copy(c).addScaledVector(dir, d); cam.up.set(0, 1, 0); if (Math.abs(el) > 1.2) cam.up.set(-Math.cos(az), 0, -Math.sin(az)); cam.lookAt(c); cam.near = d * 0.02; cam.far = d * 4; cam.updateProjectionMatrix();
      /* the lights placed round the camera as inspect.js places them round the eye */
      const q = cam.quaternion, put = (L, x, y, z) => { L.position.copy(c).add(new T.Vector3(x, y, z).applyQuaternion(q).multiplyScalar(d * 3)); L.target.position.copy(c); L.target.updateMatrixWorld(); };
      put(key, -0.55, 0.75, 0.55); put(fill, 0.8, 0.1, 0.45); put(rim, 0.1, 0.5, -0.9);
      const x = (i % COLS) * S, y = (ROWS - 1 - Math.floor(i / COLS)) * S;
      R.setViewport(x, y, S, S); R.setScissor(x, y, S, S); R.render(scene, cam);
    });
    const tri = (() => { let n = 0; m.traverse(k => { if (k.isMesh) n += (k.geometry.index ? k.geometry.index.count : k.geometry.attributes.position.count) / 3; }); return n; })();
    return { url: cv.toDataURL('image/png'), size: box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(4)), tris: Math.round(tri) };
  }
  return { sheet, R, scene };
})();
window.Studio = Studio;
