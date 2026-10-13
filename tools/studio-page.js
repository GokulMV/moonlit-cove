/* The model studio (dist/studio.html, built by node tools/build3d.mjs studio): models on their own, three ways.
   Studio.sheet(name, { opts, t, flying, zoom, views }) → six sides on one sheet (three across, two down), lit the way a
     creature held up in the hands is (inspect.js: a key light from up and to the left of the eye, a cool fill, a rim).
   Studio.hero(name, { opts, view, zoom, centre, w, h, ground, human, sun, fov }) → one large view in daylight: a sun
     that casts soft shadows (the leaves' own shader takes them too), the sky's light, the model standing on the ground
     ('soil', 'sand', 'grass', 'grid', 'water' or 'none'), a person beside it for scale.
   Studio.lineup(items, { … }) → several models side by side at their real sizes on one ground, a person among them.
   Each returns { url: a PNG data URL, size, tris }. */
const Studio = (() => {
  const T = THREE, S = 760, COLS = 3, ROWS = 2, MAXW = 3200, MAXH = 2000;
  const cv = document.createElement('canvas'); cv.width = MAXW; cv.height = MAXH; document.body.appendChild(cv);
  const R = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1); R.setSize(MAXW, MAXH, false);
  R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0; R.outputColorSpace = T.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  Models.R = R;
  /* the sky to reflect: a gradient sphere, blue above, a bright horizon, warm ground below, and the sun */
  const envScene = new T.Scene();
  {
    const g = new T.SphereGeometry(50, 32, 16), c = [], P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 50, top = new T.Color(0.32, 0.5, 0.82), hor = new T.Color(0.95, 0.93, 0.9), sand = new T.Color(0.42, 0.38, 0.3);
      const col = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(sand, Math.pow(-y, 0.4)); c.push(col.r * 1.4, col.g * 1.4, col.b * 1.4); }
    g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    envScene.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    const sun = new T.Mesh(new T.SphereGeometry(3, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(14, 13, 11) })); sun.position.set(-20, 35, 22); envScene.add(sun);
  }
  const pm = new T.PMREMGenerator(R), env = pm.fromScene(envScene, 0.02).texture;
  const scene = new T.Scene(); scene.environment = env;
  /* backdrops: the sheet's soft grey-blue; the hero's daylight sky, deep blue overhead to a pale horizon */
  const grad = stops => { const bg = document.createElement('canvas'); bg.width = 64; bg.height = 1024; const x = bg.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 1024); stops.forEach(([p, c]) => gr.addColorStop(p, c)); x.fillStyle = gr; x.fillRect(0, 0, 64, 1024);
    /* (dithered, so the sky shows no bands) */ const im = x.getImageData(0, 0, 64, 1024), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 2.2; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
    const t = new T.CanvasTexture(bg); t.colorSpace = T.SRGBColorSpace; return t; };
  const bgSheet = grad([[0, '#7f8fa3'], [0.55, '#b9c0c8'], [1, '#8c8478']]), bgSky = grad([[0, '#4f7fb8'], [0.45, '#94b6d6'], [0.8, '#d6e0e6'], [1, '#e3e1da']]);
  scene.background = bgSheet;
  const key = new T.DirectionalLight(0xfff4e6, 2.6), fill = new T.DirectionalLight(0xdce8ff, 0.9), rim = new T.DirectionalLight(0xffffff, 1.4), amb = new T.AmbientLight(0xffffff, 0.15);
  scene.add(key, key.target, fill, fill.target, rim, rim.target, amb);
  key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  /* (the engine's shadow maps and the string lights' pool are given stand-ins, as the engine gives them real ones: a
     shader with a sampler left empty draws nothing here) */
  const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  { const rt = new T.WebGLRenderTarget(4, 4); rt.depthTexture = new T.DepthTexture(4, 4); rt.depthTexture.compareFunction = T.LessEqualCompare;
    R.setRenderTarget(rt); R.clear(); R.setRenderTarget(null);
    Mats.U.uFireSh.value = Mats.U.uCanSh.value = rt.depthTexture; Mats.U.uPool.value = white; Mats.U.uTorchSh.value = white; if (Mats.U.uLeafShM) Mats.U.uLeafShM.value = white; }
  /* (the engine's own lights off: no lanterns, no van, no fire on the specimen) */
  Mats.U.uLights.value.set(0, 0, 0, 0); Mats.U.uFire.value.set(0, 0, 0, 0); Mats.U.uKeyColT.value.set(1, 0.96, 0.9); Mats.U.uKeyDirT.value.set(-0.4, 0.8, 0.45).normalize(); if (Mats.U.uAmbF) Mats.U.uAmbF.value.set(0.35, 0.4, 0.48);
  const cam = new T.PerspectiveCamera(30, 1, 0.001, 200);
  /* the shaders of our own (leaves, crowns) take their light from these: kept the same as the key light and the sky */
  const syncLeaf = (dir, col, ambC) => { Mats.U.uKeyDirT.value.copy(dir).normalize(); Mats.U.uKeyColT.value.copy(col); if (Mats.U.uAmbF) Mats.U.uAmbF.value.copy(ambC); };

  /* ── the ground: a disc of soil, sand, grass, a grid in metres, or still water ── */
  function groundTex(kind) {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), r = Models.rng(77), im = x.createImageData(N, N), D = im.data;
    const base = { soil: [0.24, 0.17, 0.11], forest: [0.07, 0.05, 0.034], sand: [0.62, 0.53, 0.39], grass: [0.17, 0.22, 0.09], grid: [0.5, 0.49, 0.46], water: [0.05, 0.12, 0.13] }[kind] || [0.4, 0.4, 0.4];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N, n = Models.fbm(u * 24, v * 24, 0.5, 4), n2 = Models.vn(u * 180, v * 180, 3.3), k = (j * N + i) * 4;
      let l = 0.78 + 0.4 * n + 0.12 * (n2 - 0.5);
      if (kind === 'soil') { const lf = Models.vn(u * 90, v * 90, 9.1); if (lf > 0.62) l *= 0.7 + 0.6 * Models.vn(u * 300, v * 300, 1.1); }
      const enc = q => 255 * Math.pow(Math.max(0, Math.min(1, q)), 1 / 2.2);
      D[k] = enc(base[0] * l); D[k + 1] = enc(base[1] * l); D[k + 2] = enc(base[2] * l); D[k + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    if (kind === 'forest') {   /* (the texture spans 6 m: fallen leaves of every brown, a few still yellow or red, and twigs) */
      for (let i = 0; i < 9000; i++) {
        const lx = r() * N, ly = r() * N, L = (6 + r() * 16) * (r() < 0.1 ? 2.2 : 1), W = L * (0.35 + r() * 0.2), an = r() * Math.PI * 2, k = r();
        const cols = ['#3b2614', '#4a2f17', '#5a3a1c', '#2e1d10', '#6b4a24', '#7a5a2c', '#4d3a1f', '#8a6a34', '#5e2e16'], c = cols[Math.floor(r() * cols.length)];
        for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) { x.save(); x.translate(lx + ox, ly + oy); x.rotate(an); x.globalAlpha = 0.85; x.fillStyle = c; x.beginPath(); x.ellipse(0, 0, L / 2, W / 2, 0, 0, Math.PI * 2); x.fill();
          x.globalAlpha = 0.35; x.strokeStyle = '#1e140a'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-L / 2, 0); x.lineTo(L / 2, 0); x.stroke(); x.restore(); }
      }
      x.globalAlpha = 0.7; x.strokeStyle = '#2a1b0e';
      for (let i = 0; i < 160; i++) { const sx = r() * N, sy = r() * N, an = r() * Math.PI * 2, L = 20 + r() * 80; x.lineWidth = 1 + r() * 2.5; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(an) * L, sy + Math.sin(an) * L); x.stroke(); }
      x.globalAlpha = 1;
    }
    if (kind === 'grid') {   /* (the texture spans 10 m: a line every metre, a bolder one every ten) */
      x.strokeStyle = 'rgba(40,40,40,0.35)'; x.lineWidth = 2; for (let i = 0; i <= 10; i++) { const p = i / 10 * N; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, N); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(N, p); x.stroke(); }
      x.strokeStyle = 'rgba(20,20,20,0.7)'; x.lineWidth = 5; x.strokeRect(0, 0, N, N);
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t;
  }
  const gTex = {}, groundMesh = new T.Mesh(new T.CircleGeometry(1, 96), new T.MeshStandardMaterial({ roughness: 0.95 }));
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; groundMesh.visible = false; scene.add(groundMesh);
  function setGround(kind, rad, cx = 0, cz = 0) {
    if (!kind || kind === 'none') { groundMesh.visible = false; return; }
    /* (the forest floor is the real one, FloraLitter's: leaves two or three deep, with its relief; and the mangroves' mud) */
    const lit = kind === 'forest' ? FloraLitter.tex({ N: 1024, tile: 2 }) : kind === 'mud' ? FloraLitter.mud({ N: 1024, tile: 3 }) : null;
    const t = lit ? lit.map : gTex[kind] || (gTex[kind] = groundTex(kind)), tile = lit ? lit.tile : kind === 'grid' ? 10 : 6;
    for (const m of lit ? [lit.map, lit.normalMap, lit.roughnessMap].filter(Boolean) : [t]) { m.repeat.set(2 * rad / tile, 2 * rad / tile); m.offset.set(-rad / tile + cx / tile, -rad / tile - cz / tile); }
    groundMesh.material.color.setScalar(kind === 'forest' ? 0.78 : 1); Object.assign(groundMesh.material, { map: t, normalMap: lit ? lit.normalMap : null, roughnessMap: lit && lit.roughnessMap || null, roughness: kind === 'water' ? 0.15 : lit ? lit.rough : 0.95, metalness: 0 }); groundMesh.material.needsUpdate = true;
    groundMesh.scale.setScalar(rad); groundMesh.position.set(cx, -0.002, cz); groundMesh.visible = true;
  }

  let cur = [];
  const clear = () => { for (const m of cur) { scene.remove(m); m.traverse(k => { if (k.isMesh && !k.userData.shared) k.geometry.dispose(); }); } cur = []; };
  const place = (name, o = {}) => { if (typeof Rig !== 'undefined') { Rig.rec.furDebug = !!(o.opts && o.opts.furDebug); Rig.rec.noShells = !!(o.opts && o.opts.noShells); } const m = Models.make(name, o.opts || {}); if (m.userData.anim) m.userData.anim(o.t ?? 0.6, !!o.flying); m.traverse(k => { if (k.isMesh) { k.castShadow = !k.userData.noShadow; k.receiveShadow = true; } }); cur.push(m); scene.add(m); return m; };
  const trisOf = list => { let n = 0; for (const m of list) m.traverse(k => { if (k.isMesh) { const c = (k.geometry.index ? k.geometry.index.count : k.geometry.attributes.position.count) / 3; n += k.isInstancedMesh ? c * k.count : (k.geometry.isInstancedBufferGeometry ? c * k.geometry.instanceCount : c); } }); return Math.round(n); };

  /* the six sides: [azimuth from the front (+x) round toward +z, elevation] (3/4 front left, the right side, head on,
     from above, 3/4 behind, from below and in front) */
  const VIEWS = [[-0.75, 0.3], [Math.PI / 2, 0.12], [0, 0.18], [-0.5, 1.25], [Math.PI - 0.7, 0.35], [0.5, -0.55]];
  function sheet(name, o = {}) {
    clear(); scene.background = bgSheet; scene.fog = null; R.toneMappingExposure = 1.0; key.castShadow = false; groundMesh.visible = false; fill.intensity = 0.9; rim.intensity = 1.4; amb.intensity = 0.15;
    const m = place(name, o); m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m), sph = box.getBoundingSphere(new T.Sphere()), c = o.centre ? new T.Vector3(...o.centre) : sph.center, rad = sph.radius / (o.zoom || 1);
    const views = o.views || VIEWS;
    cv.width = S * COLS; cv.height = S * ROWS; R.setSize(cv.width, cv.height, false); R.setScissorTest(true);
    cam.fov = 30;
    views.forEach(([az, el], i) => {
      const d = rad / Math.sin(cam.fov * Math.PI / 360) * 1.08, dir = new T.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      cam.position.copy(c).addScaledVector(dir, d); cam.up.set(0, 1, 0); if (Math.abs(el) > 1.2) cam.up.set(-Math.cos(az), 0, -Math.sin(az)); cam.lookAt(c); cam.near = d * 0.02; cam.far = d * 4; cam.aspect = 1; cam.updateProjectionMatrix();
      /* the lights placed round the camera as inspect.js places them round the eye */
      const q = cam.quaternion, put = (L, x, y, z) => { L.position.copy(c).add(new T.Vector3(x, y, z).applyQuaternion(q).multiplyScalar(d * 3)); L.target.position.copy(c); L.target.updateMatrixWorld(); };
      put(key, -0.55, 0.75, 0.55); put(fill, 0.8, 0.1, 0.45); put(rim, 0.1, 0.5, -0.9);
      syncLeaf(key.position.clone().sub(c), new T.Vector3(1, 0.96, 0.9).multiplyScalar(0.83), new T.Vector3(0.35, 0.4, 0.48));
      const x = (i % COLS) * S, y = (ROWS - 1 - Math.floor(i / COLS)) * S;
      R.setViewport(x, y, S, S); R.setScissor(x, y, S, S); R.render(scene, cam);
    });
    R.setScissorTest(false);
    return { url: cv.toDataURL('image/png'), size: box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(4)), tris: trisOf(cur) };
  }

  /* ── daylight: the sun at (azimuth, elevation), casting shadows over everything within reach of the box; the sky's light ── */
  function daylight(box, sun = [-0.9, 0.85], light = 'sun') {
    scene.background = bgSky;
    { const r0 = Math.max(1, box.getBoundingSphere(new T.Sphere()).radius); scene.fog = new T.Fog(new T.Color('#d8dfe2'), r0 * 6, r0 * 26); }
    const sph = box.getBoundingSphere(new T.Sphere()), c = sph.center, rad = Math.max(0.08, sph.radius);   /* (small things — a fruit, a flower — framed as small as they are) */
    const dir = new T.Vector3(Math.cos(sun[1]) * Math.cos(sun[0]), Math.sin(sun[1]), Math.cos(sun[1]) * Math.sin(sun[0]));
    key.color.setRGB(1, 0.95, 0.86); key.intensity = 3.1; key.castShadow = true;
    key.position.copy(c).addScaledVector(dir, rad * 3); key.target.position.copy(c); key.target.updateMatrixWorld();
    Object.assign(key.shadow.camera, { left: -rad * 1.15, right: rad * 1.15, top: rad * 1.15, bottom: -rad * 1.15, near: rad * 0.5, far: rad * 5.5 }); key.shadow.camera.updateProjectionMatrix();
    key.shadow.normalBias = 0.0035 * rad; key.shadow.bias = -0.0003;
    /* (the sky fills the shade, from the side away from the sun, a little blue; no rim) */
    fill.color.setRGB(0.75, 0.84, 1); fill.intensity = 0.45; fill.position.copy(c).addScaledVector(new T.Vector3(-dir.x, 0.6, -dir.z).normalize(), rad * 3); fill.target.position.copy(c); fill.target.updateMatrixWorld();
    rim.intensity = 0; amb.intensity = 0.06;
    /* (in the shade of the forest: no sun on it, only the sky's light and a little from one side) */
    R.toneMappingExposure = light === 'shade' ? 0.8 : 1.0;
    if (light === 'shade') { key.intensity = 0.55; key.castShadow = false; fill.intensity = 0.7; amb.intensity = 0.25; }
    syncLeaf(dir, new T.Vector3(1, 0.95, 0.86).multiplyScalar(key.intensity / Math.PI), new T.Vector3(0.42, 0.5, 0.62).multiplyScalar(light === 'shade' ? 1.3 : 1));
    return { c, rad, dir };
  }
  /* render twice: once to make the shadow map, then again with the leaves reading it */
  function shoot(w, h) {
    cv.width = w; cv.height = h; R.setSize(w, h, false); R.setViewport(0, 0, w, h); R.setScissorTest(false);
    if (Mats.U.uLeafShA) Mats.U.uLeafShA.value.w = 0;
    R.render(scene, cam);
    if (key.shadow.map && Mats.U.uLeafShM) {
      Mats.U.uLeafShM.value = key.shadow.map.texture; Mats.U.uLeafShX.value = key.shadow.matrix; Mats.U.uLeafShS.value.copy(key.shadow.mapSize);
      const t = key.target.position; Mats.U.uLeafShA.value.set(t.x, t.z, 1e5, 1);
      R.render(scene, cam);
    }
    return cv.toDataURL('image/png');
  }
  function frame(c, rad, o, w, h) {
    const [az, el] = o.view || [-0.8, 0.12], fov = o.fov || 32;
    cam.fov = fov; cam.aspect = w / h;
    const fit = rad / Math.sin(Math.min(fov, fov * cam.aspect) * Math.PI / 360) * 1.04 / (o.zoom || 1);
    const dir = new T.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    cam.position.copy(c).addScaledVector(dir, fit); if (o.eye) cam.position.set(...o.eye);
    cam.up.set(0, 1, 0); cam.lookAt(c); cam.near = Math.max(0.01, fit * 0.01); cam.far = fit * 20; cam.updateProjectionMatrix();
  }
  function hero(name, o = {}) {
    clear();
    const m = place(name, o); m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3());
    if (o.human !== false) { const hu = place('ref/human', { opts: {} }); const hp = o.human && o.human.length ? o.human : [box.max.x + 0.6 + 0.04 * size.length(), 0, box.min.z * 0.3]; hu.position.set(hp[0], hp[1] || 0, hp[2]); hu.rotation.y = hp[3] ?? -0.6; hu.updateMatrixWorld(true); box.expandByObject(hu); }
    const L = daylight(box, o.sun, o.light);
    setGround(o.ground ?? 'soil', Math.max(60, L.rad * 40), L.c.x, L.c.z);
    const c = o.centre ? new T.Vector3(...o.centre) : L.c, w = Math.min(MAXW, o.w || 1600), h = Math.min(MAXH, o.h || 1100);
    frame(c, L.rad, o, w, h);
    return { url: shoot(w, h), size: size.toArray().map(v => +v.toFixed(3)), tris: trisOf(cur) };
  }
  /* items: [{ name, opts, x?, z?, ry? }] — those without an x are set in a row along it, a little apart */
  function lineup(items, o = {}) {
    clear();
    let x = 0; const gap = o.gap ?? 1.5;
    for (const it of items) {
      const m = place(it.name, it); m.rotation.y = it.ry || 0; m.updateMatrixWorld(true);
      const b = new T.Box3().setFromObject(m), sx = b.max.x - b.min.x;
      if (it.x === undefined) { m.position.x += x - b.min.x; x += sx + gap; } else m.position.x = it.x;
      if (it.z !== undefined) m.position.z = it.z;
      m.updateMatrixWorld(true);
    }
    const box = new T.Box3(); for (const m of cur) box.expandByObject(m);
    if (o.human !== false) { const hu = place('ref/human', {}); hu.position.set(o.human && o.human.length ? o.human[0] : box.min.x - 1.2, 0, o.human && o.human.length ? o.human[2] : 0); hu.rotation.y = -0.4; hu.updateMatrixWorld(true); box.expandByObject(hu); }
    const L = daylight(box, o.sun, o.light);
    setGround(o.ground ?? 'soil', Math.max(60, L.rad * 40), L.c.x, L.c.z);
    const c = o.centre ? new T.Vector3(...o.centre) : L.c, w = Math.min(MAXW, o.w || 2400), h = Math.min(MAXH, o.h || 1100);
    frame(c, L.rad, Object.assign({ view: [Math.PI / 2 - 0.06, 0.08] }, o), w, h);
    return { url: shoot(w, h), size: box.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(3)), tris: trisOf(cur) };
  }
  /* a section through one of a model's sculpts (Rig.sculpt, by the name it was given): plane 'z' a side view (x across,
     y up, at z = at), 'x' head on (z across, y up), 'y' from above (x across, z down the page); box [u0, u1, v0, v1] in
     metres, ppm pixels to the metre; inside shaded by which shape it is nearest, lines every millimetre out from the
     surface, a grid every 5 mm and centimetre; ref: polylines [[u, v], …] drawn over it in red */
  function slice(name, o = {}) {
    Rig.rec.on = true; Rig.rec.list = [];
    try { Models.make(name, o.opts || {}); } finally { Rig.rec.on = false; }
    const sc = Rig.rec.list.find(r => r.o.name === (o.part || 'head')); if (!sc) throw new Error('no sculpt called ' + o.part);
    const f = Rig.field(sc.list, sc.o), [u0, u1, v0, v1] = o.box, ppm = o.ppm || 5000, W = Math.round((u1 - u0) * ppm), H = Math.round((v1 - v0) * ppm), at = o.at || 0, pl = o.plane || 'z';
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H), D = im.data, tagC = {};
    const P3 = (u, v) => pl === 'z' ? [u, v, at] : pl === 'x' ? [at, v, u] : [u, at, v];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = u0 + (i + 0.5) / ppm, v = pl === 'y' ? v0 + (j + 0.5) / ppm : v1 - (j + 0.5) / ppm, p = P3(u, v), d = f(...p), k = (j * W + i) * 4;
      let col;
      if (d < 0) { const t = f.tagAt(...p); if (!tagC[t]) { const h = [...t].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 360; tagC[t] = new THREE.Color().setHSL(h / 360, 0.45, 0.62); } col = [tagC[t].r * 255, tagC[t].g * 255, tagC[t].b * 255]; }
      else col = [250, 250, 248];
      const mm = Math.abs(d) * 1000, line = Math.abs(mm - Math.round(mm)) < 0.06 * (1 + 0.15 * mm) && mm < 12 ? 0.75 : 1;
      D[k] = col[0] * line; D[k + 1] = col[1] * line; D[k + 2] = col[2] * line; D[k + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    /* (the surface itself, dark: where the field changes sign between neighbouring pixels) */
    x.fillStyle = '#111';
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const u = u0 + (i + 0.5) / ppm, v = pl === 'y' ? v0 + (j + 0.5) / ppm : v1 - (j + 0.5) / ppm, a = f(...P3(u, v)) < 0, b = f(...P3(u + 1 / ppm, v)) < 0, cc = f(...P3(u, v + 1 / ppm)) < 0; if (a !== b || a !== cc) x.fillRect(i, j, 1.6, 1.6); }
    const toPx = (u, v) => [(u - u0) * ppm, pl === 'y' ? (v - v0) * ppm : (v1 - v) * ppm];
    x.lineWidth = 1; x.font = '11px monospace'; x.fillStyle = '#333';
    for (let g = Math.ceil(u0 * 200) / 200; g <= u1; g += 0.005) { const [px] = toPx(g, 0), cm = Math.abs(g * 100 - Math.round(g * 100)) < 1e-6; x.strokeStyle = cm ? 'rgba(0,0,90,0.45)' : 'rgba(0,0,90,0.15)'; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); if (cm) x.fillText((g * 100).toFixed(0), px + 2, 11); }
    for (let g = Math.ceil(v0 * 200) / 200; g <= v1; g += 0.005) { const [, py] = toPx(0, g), cm = Math.abs(g * 100 - Math.round(g * 100)) < 1e-6; x.strokeStyle = cm ? 'rgba(0,0,90,0.45)' : 'rgba(0,0,90,0.15)'; x.beginPath(); x.moveTo(0, py); x.lineTo(W, py); x.stroke(); if (cm) x.fillText((g * 100).toFixed(0), 2, py - 2); }
    x.strokeStyle = 'rgba(220,20,20,0.9)'; x.lineWidth = 2;
    for (const L of o.ref || []) { x.beginPath(); L.forEach(([u, v], i) => { const [px, py] = toPx(u, v); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
    x.fillStyle = '#000'; let ty = H - 6; for (const t in tagC) { x.fillStyle = '#' + tagC[t].getHexString(); x.fillRect(W - 110, ty - 9, 10, 10); x.fillStyle = '#000'; x.fillText(t, W - 96, ty); ty -= 14; }
    return { url: c.toDataURL('image/png'), size: [W, H] };
  }
  return { sheet, hero, lineup, slice, R, scene };
})();
window.Studio = Studio;
