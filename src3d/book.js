/* ─────────────────────────────────────────────────────────────
   book.js — a real bound book lying on a surface: the menu on the
   picnic table, the journal by the fire.
   Hard boards larger than the pages, a spine, two page blocks with
   layered paper edges that thicken on the left as you read, pages
   that dive into a shaded gutter, and a ribbon bookmark.
   Local frame: spine along z (page tops toward −z), the right
   half is x > 0, y is up from the surface the book lies on.
   ───────────────────────────────────────────────────────────── */
const Book = (() => {
  const T = THREE, SEG = 34, TURN = 0.8, LAM = 0.017, EPS = 0.00022;
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const dip = u => 1 - Math.exp(-u / LAM);           /* page height factor: 0 in the gutter, 1 a few cm out */

  /* a sheet: a strip from the spine (u = 0) to the fore-edge (u = w); front face up */
  function sheetGeos(w, h) {
    const n = (SEG + 1) * 2, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uvF = new Float32Array(n * 2), uvB = new Float32Array(n * 2), idx = [];
    for (let i = 0; i <= SEG; i++) for (let j = 0; j < 2; j++) {
      const k = i * 2 + j, u = Math.pow(i / SEG, 1.35);           /* denser near the gutter where the page bends */
      pos[k * 3] = u * w; pos[k * 3 + 2] = j === 0 ? -h / 2 : h / 2; nor[k * 3 + 1] = 1;
      uvF[k * 2] = u; uvF[k * 2 + 1] = j === 0 ? 1 : 0; uvB[k * 2] = 1 - u; uvB[k * 2 + 1] = j === 0 ? 1 : 0;
    }
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const P = new T.BufferAttribute(pos, 3), N = new T.BufferAttribute(nor, 3); P.setUsage(T.DynamicDrawUsage); N.setUsage(T.DynamicDrawUsage);
    const mk = uv => { const g = new T.BufferGeometry(); g.setAttribute('position', P); g.setAttribute('normal', N); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx); g.boundingSphere = new T.Sphere(new T.Vector3(), Math.hypot(w, h) * 1.2); return g; };
    const U = []; for (let i = 0; i <= SEG; i++) U.push(Math.pow(i / SEG, 1.35) * w);
    return { f: mk(uvF), b: mk(uvB), P, N, w, h, U };
  }
  /* bend a sheet: th = 0 on the right block, π on the left; it rides the gutter curve at both ends and the
     fore-edge trails while it turns. yR, yL: the heights it rests at on each side. */
  function bend(G, th, yR, yL, dir) {
    const p = G.P.array, n = G.N.array, w = G.w, s = Math.sin(th), lag = 0.9 * s * (dir || 1), m = th / Math.PI, y0 = yR + (yL - yR) * m;
    let x = 0, y = 0, prev = 0;
    for (let i = 0; i <= SEG; i++) {
      const u = G.U[i], du = u - prev; prev = u;
      const phi = th - lag * Math.pow(u / w, 1.6);
      if (i > 0) { x += Math.cos(phi) * du; y += Math.sin(phi) * du; }
      const lift = y0 * dip(u) + 0.004 * s, ny = Math.cos(phi), nx = -Math.sin(phi);
      for (let j = 0; j < 2; j++) { const k = (i * 2 + j) * 3; p[k] = x; p[k + 1] = y + lift; n[k] = nx; n[k + 1] = ny; n[k + 2] = 0; }
    }
    G.P.needsUpdate = true; G.N.needsUpdate = true;
  }
  /* a page block: the stack of pages under the visible one, its top following the gutter curve */
  function blockGeo(w, h, t, side) {
    const g = new T.BufferGeometry(), pos = [], uv = [], idx = [], n = 18;
    const X = u => side * u;
    const add = (x, y, z, a, b) => { pos.push(x, y, z); uv.push(a, b); return pos.length / 3 - 1; };
    /* head and tail faces (z = ∓h/2) and the fore-edge (u = w): the paper layers run along them */
    for (const zs of [-1, 1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) { const u = Math.pow(i / n, 1.35) * w, top = t * dip(u); add(X(u), 0, zs * h / 2, u / w, 0); add(X(u), Math.max(top, 1e-5), zs * h / 2, u / w, 1); }
      for (let i = 0; i < n; i++) { const a = base + i * 2; if ((zs > 0) === (side > 0)) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    { const top = t * dip(w), a = add(X(w), 0, -h / 2, 0, 0), b = add(X(w), top, -h / 2, 0, 1), c = add(X(w), 0, h / 2, 1, 0), d = add(X(w), top, h / 2, 1, 1);
      if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function edgeTex() {
    const c = document.createElement('canvas'); c.width = 16; c.height = 256; const a = c.getContext('2d');
    a.fillStyle = '#efe6d2'; a.fillRect(0, 0, 16, 256);
    for (let y = 0; y < 256; y += 2) { a.fillStyle = `rgba(120,100,70,${0.12 + 0.18 * ((y * 7919) % 13) / 13})`; a.fillRect(0, y, 16, 1); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapT = T.RepeatWrapping; t.repeat.set(1, 3); return t;
  }
  /* darken the inner edge of a page, where it dives into the binding */
  function gutter(c, side) {
    const a = c.getContext('2d'), w = c.width, gw = w * 0.11, x0 = side < 0 ? w - gw : 0;
    const g = a.createLinearGradient(side < 0 ? w : 0, 0, side < 0 ? w - gw : gw, 0);
    g.addColorStop(0, 'rgba(40,25,10,0.42)'); g.addColorStop(0.35, 'rgba(40,25,10,0.14)'); g.addColorStop(1, 'rgba(40,25,10,0)');
    a.fillStyle = g; a.fillRect(x0, 0, gw, c.height);
  }

  function build(parent, opts = {}) {
    const W = opts.W || 0.2, H = opts.H || 0.28, GAP = 0.0022, BT = 0.0028, CW = W + 0.006, CH = H + 0.012, TB = opts.T || 0.011;
    const root = new T.Group(); parent.add(root);
    const lit = p => Mats.lit(Object.assign({ roughness: 0.9 }, p));
    const cloth = new T.Color(opts.cloth || '#22392f'), clothM = lit({ color: cloth, roughness: 0.85 });
    const coverC = document.createElement('canvas'); coverC.width = 512; coverC.height = Math.round(512 * CH / CW);
    { const a = coverC.getContext('2d'); a.fillStyle = '#' + cloth.getHexString(); a.fillRect(0, 0, coverC.width, coverC.height); }
    const coverT = Mats.tex(coverC, { aniso: 8 });
    const blankC = document.createElement('canvas'); blankC.width = 64; blankC.height = 90; { const a = blankC.getContext('2d'); a.fillStyle = '#f2e7d0'; a.fillRect(0, 0, 64, 90); }
    const blank = Mats.tex(blankC);
    const pageMat = (map, side) => lit({ map, emissive: new T.Color(1, 1, 1), emissiveMap: map, emissiveIntensity: 0, side: side || T.FrontSide });
    const st = { open: false, spread: 0, maxSpread: 0, nSheets: 0, sheets: [], emissive: 0,
      cover: { th: 0, from: 0, to: 0, t0: 0, dur: TURN, done: true }, tR: TB, tL: 0, tFrom: [TB, 0], tTo: [TB, 0], tT0: 0, tDur: TURN };

    /* back board, under the right block; its inside carries the last page when it is needed */
    const backBoard = new T.Mesh(new T.BoxGeometry(CW, BT, CH), clothM); backBoard.position.set(GAP + CW / 2, -BT / 2, 0); backBoard.castShadow = backBoard.receiveShadow = true; root.add(backBoard);
    const backInnerMat = pageMat(blank), backInner = new T.Mesh(new T.PlaneGeometry(W, H), backInnerMat); backInner.rotation.x = -Math.PI / 2; backInner.position.set(W / 2, 0.0002, 0); root.add(backInner);
    /* front cover: a board hinged at the spine; open, it lies flat on the left; its outer face carries the cover art */
    const hinge = new T.Group(); root.add(hinge);
    const coverG = new T.Group(); hinge.add(coverG);
    const frontBoard = new T.Mesh(new T.BoxGeometry(CW, BT, CH), clothM); frontBoard.position.set(-GAP - CW / 2, -BT / 2, 0); frontBoard.castShadow = frontBoard.receiveShadow = true; coverG.add(frontBoard);
    const art = new T.Mesh(new T.PlaneGeometry(CW, CH), lit({ map: coverT, roughness: 0.8 })); art.rotation.set(Math.PI / 2, 0, Math.PI); art.position.set(-GAP - CW / 2, -BT - 0.0003, 0); coverG.add(art);
    const insideMat = pageMat(blank), inside = new T.Mesh(new T.PlaneGeometry(W, H), insideMat); inside.rotation.x = -Math.PI / 2; inside.position.set(-W / 2, 0.0002, 0); coverG.add(inside);
    /* the spine: flat under the gutter when open, standing when shut */
    const spine = new T.Mesh(new T.BoxGeometry(1, 1, CH), clothM); spine.castShadow = true; root.add(spine);
    /* page blocks */
    const eT = edgeTex(), edgeM = lit({ map: eT, roughness: 0.95 });
    const blocks = [{ m: new T.Mesh(new T.BufferGeometry(), edgeM), side: 1, t: -1 }, { m: new T.Mesh(new T.BufferGeometry(), edgeM), side: -1, t: -1 }];
    blocks.forEach(b => { b.m.receiveShadow = true; b.m.frustumCulled = false; root.add(b.m); });
    const setBlock = (b, t) => { if (Math.abs(t - b.t) < 2e-5) return; b.t = t; b.m.geometry.dispose(); b.m.geometry = blockGeo(W, H, Math.max(t, 0.0001), b.side); b.m.visible = t > 0.0003; };
    /* a ribbon bookmark lying in the gutter of the right page and trailing over the tail */
    const ribbonM = lit({ color: new T.Color(opts.ribbon || '#8e1f22'), roughness: 0.55, side: T.DoubleSide });
    const RN = 16, rpos = new Float32Array((RN + 1) * 2 * 3), ridx = [];
    for (let i = 0; i < RN; i++) { const a = i * 2; ridx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const rgeo = new T.BufferGeometry(); rgeo.setAttribute('position', new T.BufferAttribute(rpos, 3)); rgeo.setIndex(ridx);
    const ribbon = new T.Mesh(rgeo, ribbonM); ribbon.frustumCulled = false; root.add(ribbon);
    let ribbonY = -1;
    function placeRibbon(yTop) {
      if (Math.abs(yTop - ribbonY) < 1e-5) return; ribbonY = yTop;
      const x0 = 0.006, wd = 0.0055, z0 = -H / 2 + 0.03, z1 = H / 2;
      for (let i = 0; i <= RN; i++) {
        const t = i / RN, z = z0 + (z1 + 0.045 - z0) * t, over = Math.max(0, z - z1), sway = 0.003 * Math.sin(t * 3);
        for (let j = 0; j < 2; j++) { const k = (i * 2 + j) * 3, x = x0 + sway + (j ? wd : 0), base = yTop * dip(x) + 0.0007; rpos[k] = x; rpos[k + 1] = Math.max(-BT + 0.0004, over > 0 ? base - over * 0.9 : base); rpos[k + 2] = z; }
      }
      rgeo.attributes.position.needsUpdate = true; rgeo.computeVertexNormals();
    }

    function makeSheets(fronts, backs) {
      for (const s of st.sheets) { root.remove(s.mf, s.mb); s.G.f.dispose(); s.G.b.dispose(); s.mf.material.dispose(); s.mb.material.dispose(); }
      st.sheets = [];
      for (let i = 0; i < fronts.length; i++) {
        const G = sheetGeos(W, H);
        const mf = new T.Mesh(G.f, pageMat(fronts[i] || blank)), mb = new T.Mesh(G.b, pageMat(backs[i] || blank, T.BackSide));
        mf.receiveShadow = mb.receiveShadow = true; mf.frustumCulled = mb.frustumCulled = false; root.add(mf, mb);
        st.sheets.push({ G, mf, mb, th: 0, from: 0, to: 0, t0: 0, dur: TURN, done: false, dir: 1 });
      }
      st.nSheets = st.sheets.length; st.tR = TB; st.tL = 0; st.tFrom = [TB, 0]; st.tTo = [TB, 0];
      layout(true);
    }
    /* block thicknesses for a spread: pages pile up on the left as you read */
    const thick = k => { const p = st.nSheets ? Math.min(1, k / st.nSheets) : 0; return [TB * (1 - p) + (k < st.nSheets ? 0.0012 : 0), TB * p + (k > 0 ? 0.0012 : 0)]; };
    const restR = i => st.tR + (st.nSheets - i) * EPS, restL = i => st.tL + (i + 1) * EPS;
    function layout(force) {
      const now = performance.now() / 1000;
      const bk = Math.min(1, Math.max(0, (now - st.tT0) / st.tDur)), be = ease(bk);
      st.tR = st.tFrom[0] + (st.tTo[0] - st.tFrom[0]) * be; st.tL = st.tFrom[1] + (st.tTo[1] - st.tFrom[1]) * be;
      setBlock(blocks[0], st.tR); setBlock(blocks[1], st.tL);
      const moving = bk < 1;
      st.sheets.forEach((s, i) => {
        const k = s.dur > 0 ? Math.min(1, Math.max(0, (now - s.t0) / s.dur)) : 1, th = s.from + (s.to - s.from) * ease(k);
        if (!force && !moving && s.done && Math.abs(th - s.th) < 1e-6) return;
        s.th = th; s.done = k >= 1; bend(s.G, th, restR(i), restL(i), s.dir);
      });
      /* cover: hinged at the spine, at half the height of what it closes over */
      const c = st.cover, ck = c.dur > 0 ? Math.min(1, Math.max(0, (now - c.t0) / c.dur)) : 1, cth = c.from + (c.to - c.from) * ease(ck);
      c.th = cth; c.done = ck >= 1;
      const closed = 1 - cth / Math.PI, top = st.tR + st.nSheets * EPS + 0.0004;
      hinge.position.set(0, (top + BT) / 2 - BT / 2, 0); coverG.position.set(0, -((top + BT) / 2 - BT / 2), 0); hinge.rotation.z = -Math.PI * closed;
      /* the spine stands up as the book shuts */
      const sh = BT + (top + BT) * closed, sw = Math.max(0.0015, 2 * GAP * (1 - closed) + BT * closed);
      spine.scale.set(sw, sh, 1); spine.position.set(-sw / 2 + GAP * (1 - closed), -BT + sh / 2, 0);
      blocks[1].m.visible = st.tL > 0.0003 && closed < 0.98;
      placeRibbon(st.tR + st.nSheets * EPS);
    }
    function turnTo(s, to, delay = 0) {
      if (Math.abs(s.to - to) < 1e-6) return;
      const now = performance.now() / 1000;
      s.from = s.th; s.to = to; s.dir = to > s.th ? 1 : -1; s.t0 = now + delay; s.dur = TURN * (0.55 + 0.45 * Math.abs(to - s.from) / Math.PI); s.done = false;
    }
    /* go to spread k (0 = inside cover + first page); open = cover turned */
    function go(k, open = true) {
      const was = st.spread; k = Math.max(0, Math.min(st.maxSpread, k)); st.spread = k; st.open = open;
      let d = 0;
      if (open) turnTo(st.cover, Math.PI, 0);
      const order = k >= was ? st.sheets.map((s, i) => i) : st.sheets.map((s, i) => st.nSheets - 1 - i);
      for (const i of order) { const want = open && i < k ? Math.PI : 0; if (Math.abs(st.sheets[i].to - want) > 1e-6) { turnTo(st.sheets[i], want, d); d += 0.14; } }
      st.tFrom = [st.tR, st.tL]; st.tTo = open ? thick(k) : [TB, 0]; st.tT0 = performance.now() / 1000; st.tDur = TURN + d;
      if (!open) turnTo(st.cover, 0, d + 0.05);
      return k;
    }
    /* textures from the page: surfaces = [insideCover, p1, p2, …]; spread k shows (surf[2k], surf[2k+1]) */
    function setPages(canvases) {
      canvases.forEach((c, i) => gutter(c, i % 2 ? 1 : -1)); if (canvases.backInner) gutter(canvases.backInner, 1);
      const tex = canvases.map(c => { const t = Mats.tex(c, { aniso: 8 }); t.generateMipmaps = true; return t; });
      insideMat.map = insideMat.emissiveMap = tex[0]; insideMat.needsUpdate = true;
      const pages = tex.slice(1), n = pages.length, fronts = [], backs = [];
      for (let i = 0; i < Math.ceil(n / 2); i++) { fronts.push(pages[2 * i]); backs.push(pages[2 * i + 1] || null); }
      st.maxSpread = n % 2 ? (n - 1) / 2 : n / 2;
      if (n % 2 === 0 && canvases.backInner) { const bt = Mats.tex(canvases.backInner, { aniso: 8 }); backInnerMat.map = backInnerMat.emissiveMap = bt; backInnerMat.needsUpdate = true; }
      st.spread = 0; makeSheets(fronts, backs);
      return { spreads: st.maxSpread + 1 };
    }
    function paintCover(fn) { fn(coverC); coverT.needsUpdate = true; }
    /* readable after dark: the paper carries a little light of its own, scaled to the exposure */
    function setReadLight(k) { if (Math.abs(k - st.emissive) < 1e-4) return; st.emissive = k; st.sheets.forEach(s => { s.mf.material.emissiveIntensity = k; s.mb.material.emissiveIntensity = k; }); insideMat.emissiveIntensity = k; backInnerMat.emissiveIntensity = k; }
    const busy = () => st.sheets.some(s => !s.done) || !st.cover.done;
    makeSheets([blank, blank, blank], [blank, blank, blank]);
    return { group: root, W, H, CW, CH, go, setPages, paintCover, update: () => layout(false), setReadLight, state: st, busy };
  }
  return { build };
})();
