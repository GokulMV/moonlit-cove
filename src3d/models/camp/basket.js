/* ─────────────────────────────────────────────────────────────
   models/camp/basket.js — a wicker picnic hamper: a woven body with
   rounded corners, a little wider at the top, a thick rolled rim of
   wrapped cane round the top and a thinner one round the foot; two
   lids on a wooden bar down the middle, the front one thrown back
   against the handle; a bent-cane handle with a leather grip; two
   leather straps with brass buckles at the front. Inside: blueprints
   rolled up and banded, standing out of the open side, and a red
   gingham napkin over the front edge.
   Built on y = 0, 50 cm long (x), 32 deep (z), 24 tall to the rim;
   its straps face +z. userData.planRoll is the big blue roll the
   plans are read from (its axis along its own y).
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, lit, canvas, rng, rshape } = Models;
  /* plain weave: honey-coloured weavers passing in front of and behind the upright stakes, row by row; and its relief */
  function weave() {
    const W = 512, H = 256, c = canvas(W, H), h = canvas(W, H), a = c.getContext('2d'), b = h.getContext('2d'), r = rng(31);
    const STAKES = 5, ROWS = 6, sw = W / STAKES, rh = H / ROWS;
    a.fillStyle = '#4a3218'; a.fillRect(0, 0, W, H); b.fillStyle = '#000'; b.fillRect(0, 0, W, H);
    const tone = () => { const k = 0.86 + r() * 0.22; return [Math.round(196 * k), Math.round(152 * k), Math.round(92 * k)]; };
    for (let j = 0; j < ROWS; j++) {
      const y0 = j * rh + rh * 0.09, y1 = (j + 1) * rh - rh * 0.09, [R, G, B] = tone();
      /* the weaver: round in section, so bright along its middle and dark at its edges */
      const gr = a.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgb(${R * 0.55 | 0},${G * 0.5 | 0},${B * 0.45 | 0})`); gr.addColorStop(0.45, `rgb(${R},${G},${B})`); gr.addColorStop(1, `rgb(${R * 0.5 | 0},${G * 0.45 | 0},${B * 0.4 | 0})`);
      a.fillStyle = gr; a.fillRect(0, y0, W, y1 - y0);
      const gh = b.createLinearGradient(0, y0, 0, y1); gh.addColorStop(0, '#303030'); gh.addColorStop(0.5, '#d0d0d0'); gh.addColorStop(1, '#303030'); b.fillStyle = gh; b.fillRect(0, y0, W, y1 - y0);
      /* its grain */
      for (let k = 0; k < 40; k++) { a.fillStyle = `rgba(${r() < 0.5 ? '255,235,190' : '80,50,20'},${0.08 + r() * 0.1})`; a.fillRect(r() * W, y0 + r() * (y1 - y0), 20 + r() * 80, 1); }
      /* where it goes behind a stake, the stake shows over it, and shades it either side */
      for (let i = 0; i < STAKES; i++) {
        if ((i + j) % 2) continue;
        const x = (i + 0.5) * sw, w2 = sw * 0.16;
        const sh = a.createLinearGradient(x - w2 * 2.4, 0, x + w2 * 2.4, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.3, 'rgba(30,18,6,0.55)'); sh.addColorStop(0.7, 'rgba(30,18,6,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        a.fillStyle = sh; a.fillRect(x - w2 * 2.4, y0, w2 * 4.8, y1 - y0);
        const sg = a.createLinearGradient(x - w2, 0, x + w2, 0); sg.addColorStop(0, '#6e4c26'); sg.addColorStop(0.5, '#c79a5c'); sg.addColorStop(1, '#5e3e1e');
        a.fillStyle = sg; a.fillRect(x - w2, y0 - rh * 0.1, w2 * 2, y1 - y0 + rh * 0.2);
        const hg = b.createLinearGradient(x - w2, 0, x + w2, 0); hg.addColorStop(0, '#606060'); hg.addColorStop(0.5, '#ffffff'); hg.addColorStop(1, '#606060');
        b.fillStyle = hg; b.fillRect(x - w2, y0 - rh * 0.1, w2 * 2, y1 - y0 + rh * 0.2);
      }
    }
    const tex = (cv, srgb) => { const t = new T.CanvasTexture(cv); if (srgb) t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; return t; };
    return { map: tex(c, true), bump: tex(h, false) };
  }
  /* cane wrapped round and round: diagonal bands */
  function wrap() {
    const c = canvas(64, 64), a = c.getContext('2d'); a.fillStyle = '#7a5428'; a.fillRect(0, 0, 64, 64);
    for (let i = -2; i < 6; i++) { const g = a.createLinearGradient(0, i * 16, 16, i * 16 + 16); a.save(); a.translate(0, i * 16); a.transform(1, 0.6, 0, 1, 0, 0); g.addColorStop(0, '#6a4620'); g.addColorStop(0.5, '#d2a466'); g.addColorStop(1, '#6a4620'); a.fillStyle = g; a.fillRect(0, 0, 64, 13); a.restore(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function gingham() {
    const c = canvas(128, 128), a = c.getContext('2d'); a.fillStyle = '#f4efe6'; a.fillRect(0, 0, 128, 128);
    a.fillStyle = 'rgba(190,40,40,0.55)'; for (let i = 0; i < 8; i += 2) { a.fillRect(i * 16, 0, 16, 128); a.fillRect(0, i * 16, 128, 16); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 4); return t;
  }
  /* evenly spaced points round a rounded rectangle in the x-z plane, with their outward normals and the distance round */
  function ring(L, D, r, n) {
    const sp = rshape(-L / 2, -D / 2, L / 2, D / 2, [r, r, r, r]).getSpacedPoints(n), out = []; let s = 0;
    for (let i = 0; i <= n; i++) {
      const p = sp[i % n], q = sp[(i + 1) % n], o = sp[(i + n - 1) % n];
      if (i) s += Math.hypot(p.x - sp[i - 1].x, p.y - sp[i - 1].y);
      let nx = q.y - o.y, nz = -(q.x - o.x); const k = Math.hypot(nx, nz) || 1; nx /= k; nz /= k;
      if (nx * p.x + nz * p.y < 0) { nx = -nx; nz = -nz; }
      out.push({ x: p.x, z: p.y, nx, nz, s });
    }
    return out;
  }
  /* the woven wall: outside and inside, wider at the top by `flare` */
  function wall(R, H, inset, flare, tile, inward) {
    const pos = [], nor = [], uv = [], idx = [];
    R.forEach(p => { for (const y of [0, H]) { const f = 1 + flare * y / H; pos.push(p.x * f - p.nx * inset, y, p.z * f - p.nz * inset); nor.push(p.nx * (inward ? -1 : 1), 0.12, p.nz * (inward ? -1 : 1)); uv.push(p.s / tile[0], y / tile[1]); } });
    for (let i = 0; i < R.length - 1; i++) { const a = i * 2, b = a + 2; inward ? idx.push(a, a + 1, b, b, a + 1, b + 1) : idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  /* a round cane swept round the ring at height y (scaled by f) */
  function rim(R, y, f, rad, tileU) {
    const pos = [], nor = [], uv = [], idx = [], K = 10;
    R.forEach(p => { for (let k = 0; k <= K; k++) { const a = k / K * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x * f + p.nx * rad * c, y + rad * s, p.z * f + p.nz * rad * c); nor.push(p.nx * c, s, p.nz * c); uv.push(p.s / tileU, k / K); } });
    for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + K + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  Models.add('camp/basket', () => {
    const g = new T.Group(), L = 0.5, D = 0.32, H = 0.24, CR = 0.055, FL = 0.05, TH = 0.008, R = rng(12);
    const wv = weave(), TILE = [0.12, 0.06];
    const wicker = Mats.lit({ map: wv.map, bumpMap: wv.bump, bumpScale: 1.6, roughness: 0.82 });
    const wickerIn = Mats.lit({ map: wv.map, color: C('#9a8a78'), roughness: 0.9 });
    const cane = Mats.lit({ map: wrap(), roughness: 0.7 }), leather = lit('#5a3420', { roughness: 0.55 }), brass = Mats.lit({ color: C('#b8913e'), roughness: 0.32, metalness: 0.9 });
    const P = ring(L, D, CR, 96);
    g.add(mesh(wall(P, H, 0, FL, TILE, false), wicker));
    g.add(mesh(wall(P, H - 0.004, TH, FL, TILE, true), wickerIn, false));
    /* the floor */
    { const s = rshape(-L / 2 + TH, -D / 2 + TH, L / 2 - TH, D / 2 - TH, [CR, CR, CR, CR]), f = mesh(new T.ShapeGeometry(s, 8), wickerIn, false); f.rotation.x = Math.PI / 2; f.position.y = 0.006; g.add(f); }
    /* the rims: wrapped cane at the top, a plainer foot */
    const top = 1 + FL;
    g.add(mesh(rim(P, H, top, 0.0105, 0.035), cane)); g.add(mesh(rim(P, 0.008, 1, 0.008, 0.05), cane));
    /* the bar down the middle the lids hang from, and the lids: the back one shut, the front one thrown back */
    g.add(at(mesh(new T.BoxGeometry(L * top - 0.02, 0.014, 0.022), lit('#7b5532', { roughness: 0.6 })), 0, H + 0.012, 0));
    /* (one lid, built toward +z from the bar; the back one is the same turned round) */
    const lidG = () => {
      const pv = new T.Group(); at(pv, 0, H + 0.014, 0);
      const w = L * top - 0.012, d = D * top / 2 - 0.006, s = rshape(-w / 2, 0.012, w / 2, d, [0, 0, CR, CR]);
      const geo = Models.extrude(s, 0.006, 0.002), uvs = geo.attributes.uv, ps = geo.attributes.position;
      for (let i = 0; i < uvs.count; i++) uvs.setXY(i, ps.getX(i) / TILE[0], ps.getY(i) / TILE[1]);
      const lid = new T.Group(); pv.add(lid);
      const panel = mesh(geo, wicker); panel.rotation.x = Math.PI / 2; panel.position.y = 0.004; lid.add(panel);
      /* the lid's own rim, round its free edge */
      lid.add(mesh(rim(ring(w, d * 2, CR, 64).filter(p => p.z > 0.012), 0.004, 1, 0.006, 0.03), cane));
      pv.userData.lid = lid;
      return pv;
    };
    const back = lidG(); back.rotation.y = Math.PI; g.add(back);
    const front = lidG(); front.userData.lid.rotation.x = -1.72; g.add(front);
    /* the handle: bent cane up over the bar, a leather grip in the middle, brass brackets at the ends */
    const hc = new T.CatmullRomCurve3([[-0.22, H + 0.01, 0], [-0.2, H + 0.11, 0], [-0.09, H + 0.17, 0], [0.09, H + 0.17, 0], [0.2, H + 0.11, 0], [0.22, H + 0.01, 0]].map(p => new T.Vector3(...p)));
    g.add(mesh(Models.tube(hc, 40, 8, () => 0.0075), cane));
    g.add(mesh(Models.tube(new T.CatmullRomCurve3([-0.075, -0.03, 0.03, 0.075].map(x => hc.getPointAt(0.5 + x))), 16, 10, () => 0.0115, { caps: true }), leather));
    for (const x of [-0.222, 0.222]) g.add(at(mesh(new T.BoxGeometry(0.008, 0.03, 0.03), brass), x * top, H + 0.008, 0));
    /* the straps and buckles at the front */
    for (const x of [-0.15, 0.15]) {
      const z = D / 2 * (1 + FL * 0.55) + 0.003, st = mesh(new T.BoxGeometry(0.024, 0.15, 0.003), leather); at(st, x, H - 0.07, z); st.rotation.x = -0.05; g.add(st);
      const bk = mesh(new T.TorusGeometry(0.014, 0.0022, 4, 4), brass); bk.rotation.z = Math.PI / 4; at(bk, x, H - 0.035, z + 0.003); bk.scale.set(1, 1.25, 1); g.add(bk);
      g.add(at(mesh(new T.BoxGeometry(0.004, 0.03, 0.003), brass), x, H - 0.035, z + 0.004));
    }
    /* inside: blueprints rolled up and banded, standing out of the open front; the big blue one is the one to read */
    const rolls = [['#2b5b97', 0.03, 0.46, -0.1, 0.2, 0.07, 0.42, 0.22], ['#c9d8e6', 0.026, 0.42, 0.03, 0.19, 0.08, 0.55, -0.14], ['#ead9b4', 0.022, 0.38, 0.13, 0.17, 0.05, 0.36, 0.3]];
    let planRoll = null;
    for (const [hex, r, len, x, y, z, lean, side] of rolls) {
      const rg = new T.Group(); at(rg, x, y, z); rg.rotation.set(lean, 0, side); g.add(rg);
      const o = mesh(new T.CylinderGeometry(r, r, len, 18), lit(hex, { roughness: 0.88 })); rg.add(o); if (!planRoll) planRoll = o;
      /* the end of the paper spiralling in, and its band */
      for (const e of [-1, 1]) { const cap = mesh(new T.CircleGeometry(r * 0.98, 18), lit(hex, { color: C(hex).multiplyScalar(0.8), roughness: 0.9 }), false); cap.rotation.x = e * Math.PI / 2; at(cap, 0, e * len / 2, 0); rg.add(cap); }
      rg.add(at(mesh(new T.CylinderGeometry(r * 1.05, r * 1.05, 0.022, 18), lit('#9a4b1c', { roughness: 0.8 })), 0, len * 0.12, 0));
    }
    /* a red gingham napkin, tucked in at the back and hanging over the front edge */
    { const nw = 0.2, nl = 0.3, geo = new T.PlaneGeometry(nw, nl, 8, 24), ps = geo.attributes.position, ft = D / 2 * top;
      for (let i = 0; i < ps.count; i++) {
        const u = ps.getX(i), v = (ps.getY(i) + nl / 2) / nl;          /* v 0 (inside) … 1 (hanging outside) */
        const s = v * 1.0, wob = 0.006 * Math.sin(u * 40 + v * 9) + 0.004 * Math.sin(u * 23 - v * 17);
        let y, z;
        if (s < 0.45) { const k = s / 0.45; y = 0.12 + k * (H + 0.012 - 0.12); z = ft - 0.1 + k * 0.1; }
        else { const k = (s - 0.45) / 0.55, a = k * Math.PI * 0.62; y = H + 0.012 + 0.012 * Math.sin(a) - k * 0.1; z = ft + 0.016 * Math.sin(a) + 0.004; }
        ps.setXYZ(i, u + 0.12, y + wob, z + wob * 0.5);
      }
      geo.computeVertexNormals();
      const nap = mesh(geo, Mats.lit({ map: gingham(), roughness: 0.95, side: T.DoubleSide }), true, true); g.add(nap); }
    g.userData = { planRoll };
    return g;
  });
})();
