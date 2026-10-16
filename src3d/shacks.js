/* ─────────────────────────────────────────────────────────────
   shacks.js — the people of the coast. Every so often along the
   beach: a shack on a wooden deck under a palm-thatch roof, its
   fairy lights strung along the eaves, tables and sunbeds out on the
   sand; a row of coco huts on stilts under the palms; or a fishing
   spot, outrigger boats pulled up above the tide and a net drying
   between two poles. Each stretch of coast draws its own from a hash
   of its chunk, so it is the same every time it comes into view.
   After dark the shacks light up, and some of the huts.
   ───────────────────────────────────────────────────────────── */
const Shacks = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const rng = s => Textures.rng(s);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ── painted surfaces ── */
  function grain(a, w, h, k, seed) {
    const img = a.getImageData(0, 0, w, h), r = rng(seed);
    for (let i = 0; i < w * h; i++) { const v = (r() - 0.5) * k * 255; img.data[i * 4] += v; img.data[i * 4 + 1] += v; img.data[i * 4 + 2] += v; }
    a.putImageData(img, 0, 0);
  }
  /* dry palm thatch, laid in courses down the slope (v runs down it) */
  function thatch(seed) {
    const c = cv(256, 256), a = c.getContext('2d', { willReadFrequently: true }), r = rng(seed);
    a.fillStyle = '#8a6a3c'; a.fillRect(0, 0, 256, 256);
    for (let course = 0; course < 8; course++) {
      const y0 = course * 32;
      a.fillStyle = 'rgba(40,26,12,0.55)'; a.fillRect(0, y0 + 28, 256, 5);
      for (let i = 0; i < 260; i++) {
        const x = r() * 256, y = y0 - 6 + r() * 12, len = 22 + r() * 18, ang = (r() - 0.5) * 0.35, l = r();
        a.strokeStyle = `rgba(${Math.round(150 + 70 * l)},${Math.round(112 + 52 * l)},${Math.round(58 + 30 * l)},${0.45 + r() * 0.5})`;
        a.lineWidth = 0.8 + r() * 1.6; a.beginPath(); a.moveTo(x, y); a.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len); a.stroke();
      }
    }
    grain(a, 256, 256, 0.1, seed + 1);
    return c;
  }
  /* woven bamboo matting */
  function weave() {
    const c = cv(128, 128), a = c.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const over = (i + j) % 2 === 0, x = i * 16, y = j * 16;
      a.fillStyle = over ? '#c4a36a' : '#a5844f'; a.fillRect(x, y, 16, 16);
      a.fillStyle = 'rgba(60,40,18,0.35)';
      if (over) { a.fillRect(x, y, 16, 1.5); a.fillRect(x, y + 8, 16, 1); } else { a.fillRect(x, y, 1.5, 16); a.fillRect(x + 8, y, 1, 16); }
    }
    grain(a, 128, 128, 0.12, 51);
    return c;
  }
  /* bamboo: pale cane with a darker node every so often (v along the pole) */
  function cane() {
    const c = cv(32, 256), a = c.getContext('2d', { willReadFrequently: true });
    const g = a.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, '#8d7442'); g.addColorStop(0.45, '#c7ab6e'); g.addColorStop(1, '#8a7040');
    a.fillStyle = g; a.fillRect(0, 0, 32, 256);
    for (let y = 30; y < 256; y += 64) { a.fillStyle = 'rgba(70,50,22,0.75)'; a.fillRect(0, y, 32, 4); a.fillStyle = 'rgba(230,210,160,0.4)'; a.fillRect(0, y + 4, 32, 2); }
    grain(a, 32, 256, 0.08, 53);
    return c;
  }
  /* a fishing net: knotted diamonds, the rest see-through */
  function net() {
    const c = cv(128, 128), a = c.getContext('2d');
    a.strokeStyle = 'rgba(58,72,56,1)'; a.lineWidth = 3.2;
    for (let i = -128; i < 256; i += 16) { a.beginPath(); a.moveTo(i, 0); a.lineTo(i + 128, 128); a.stroke(); a.beginPath(); a.moveTo(i + 128, 0); a.lineTo(i, 128); a.stroke(); }
    return c;
  }
  /* a soft round glow, for lights seen in the dark and the warm pool they throw on the sand */
  function blob() {
    const c = cv(64, 64), a = c.getContext('2d'), g = a.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    a.fillStyle = g; a.fillRect(0, 0, 64, 64);
    return c;
  }
  /* the shack's board, painted by hand */
  const NAMES = [['Sea Breeze', 'seafood · chai · cold coconut'], ['Driftwood', 'fish curry · lime soda'], ['Moonrise', 'grill · music · chai'], ['Low Tide', 'fresh catch daily'],
    ['Starfish', 'breakfast till late'], ['Salt & Sand', 'coconut · chai · fries'], ['Shack No. 7', 'prawns · rice · sunsets'], ['Coconut Corner', 'tender coconut · juice']];
  const BOARDS = [['#1f5f7a', '#f3e6c4'], ['#f0d59a', '#5a2a1a'], ['#a8432f', '#fbeed2'], ['#e9e4d6', '#1f4a66']];
  function sign(i, b) {
    const c = cv(512, 160), a = c.getContext('2d'), [name, sub] = NAMES[i % NAMES.length], [bg, fg] = BOARDS[b % BOARDS.length];
    a.fillStyle = bg; a.fillRect(0, 0, 512, 160);
    for (let y = 0; y < 160; y += 40) { a.fillStyle = 'rgba(0,0,0,0.16)'; a.fillRect(0, y, 512, 2); }
    a.strokeStyle = fg; a.globalAlpha = 0.7; a.lineWidth = 4; a.strokeRect(12, 12, 488, 136); a.globalAlpha = 1;
    a.fillStyle = fg; a.textAlign = 'center'; a.textBaseline = 'middle';
    a.font = "700 76px Caveat, 'Segoe Print', 'Bradley Hand', cursive"; a.lineWidth = 3; a.strokeStyle = fg; a.strokeText(name, 256, 64); a.fillText(name, 256, 64);
    a.font = "500 28px 'Instrument Sans', system-ui, sans-serif"; a.fillText(sub, 256, 122);
    return c;
  }

  /* ── building in pieces, then one mesh a material ── */
  const _p = new T.Vector3(), _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3();
  /* where a piece goes: a frame on the sand at (x, z) turned by ry, and the piece's place, turn and size in it */
  function frame(x, z, ry, y = 0) {
    const F = new T.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1));
    return (lx, ly, lz, rx = 0, ryy = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new T.Matrix4().multiplyMatrices(F, new T.Matrix4().compose(_p.set(lx, ly, lz), _q.setFromEuler(_e.set(rx, ryy, rz, 'YXZ')), _s.set(sx, sy, sz)));
  }
  /* a box of w × h × d whose texture tiles every `tile` metres */
  function boxG(w, h, d, tile = 0) {
    const g = new T.BoxGeometry(w, h, d);
    if (tile) {
      const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
    }
    return g;
  }
  const cylG = (r0, r1, h, seg = 7, open = false) => new T.CylinderGeometry(r0, r1, h, seg, 1, open);
  function merge(list) {
    let nv = 0, ni = 0; for (const { g } of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let ov = 0, oi = 0; const v = new T.Vector3(), nm = new T.Matrix3();
    for (const { g, m } of list) {
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv; nm.getNormalMatrix(m);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(ov + i) * 3] = v.x; P[(ov + i) * 3 + 1] = v.y; P[(ov + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(ov + i) * 3] = v.x; N[(ov + i) * 3 + 1] = v.y; N[(ov + i) * 3 + 2] = v.z;
        if (ua) { UV[(ov + i) * 2] = ua.getX(i); UV[(ov + i) * 2 + 1] = ua.getY(i); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < pa.count; i++) I[oi + i] = ov + i;
      ov += pa.count; oi += g.index ? g.index.count : pa.count;
      g.dispose();
    }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(UV, 2)); out.setIndex(new T.BufferAttribute(I, 1));
    out.computeBoundingSphere(); return out;
  }

  function build(root, world) {
    if (!world) return { update() {}, count: 0 };
    /* materials, shared by every site */
    const lit = (p, key) => Mats.lit(Object.assign({ roughness: 0.9 }, p), key);
    const tx = (c, rep = true) => Mats.tex(c, { repeat: rep, aniso: 4 });
    const M = {
      thatch: lit({ map: tx(thatch(61)), side: T.DoubleSide, roughness: 1 }),
      thatchDark: lit({ map: tx(thatch(67)), color: new T.Color(0.55, 0.5, 0.45), side: T.DoubleSide, roughness: 1 }),
      weave: lit({ map: tx(weave()), roughness: 0.95 }),
      cane: lit({ map: tx(cane()), roughness: 0.8 }),
      deck: lit({ map: tx(Paint.wood(71, ['#7d5a3a', '#86603d', '#735234', '#7f5b39'])), roughness: 0.92 }),
      wood: lit({ map: tx(Paint.wood(73, ['#5e4330', '#664833', '#58402c', '#634631'])), roughness: 0.9 }),
      white: lit({ map: tx(Paint.plank(75, '#e3dccb', 1)), roughness: 0.8 }),
      dark: lit({ color: new T.Color('#16110c'), roughness: 1 }),
      glass: lit({ color: new T.Color('#2b4a3a'), roughness: 0.25, metalness: 0.1 }),
      net: lit({ map: tx(net()), transparent: false, alphaTest: 0.22, side: T.DoubleSide, roughness: 1 }),
      rope: lit({ color: new T.Color('#9c8460'), roughness: 1 }),
      /* a window or doorway with a lamp behind it: warm after dark, dark glass by day */
      glowWin: lit({ color: new T.Color('#2a2016'), emissive: new T.Color(1, 0.62, 0.3), emissiveIntensity: 0, roughness: 0.6 }),
      bulb: new T.MeshBasicMaterial({ color: new T.Color(0.02, 0.02, 0.02) }),
      lamp: new T.MeshBasicMaterial({ color: new T.Color(0.02, 0.02, 0.02) }),
      halo: new T.SpriteMaterial({ map: Mats.tex(blob()), color: new T.Color(1, 0.62, 0.3), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }),
      pool: new T.MeshBasicMaterial({ map: Mats.tex(blob()), color: new T.Color(1, 0.55, 0.25), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 })
    };
    const DOORS = ['#2f6f8f', '#3f7d52', '#a5432f', '#c9a23f', '#6b4f8f', '#2e5a6e'].map(h => lit({ map: tx(Paint.plank(79, h, 1)), roughness: 0.75 }));
    const CHAIRS = ['#c8372d', '#2d63b5', '#e8e2d6', '#2f8a5a'].map(h => lit({ color: new T.Color(h), roughness: 0.55 }));
    /* the boards are lettered in Caveat: painted again once it has loaded, if it had not yet */
    const signs = new Map();
    function signMat(i, b) {
      const k = i * 8 + b; if (signs.has(k)) return signs.get(k);
      const t = Mats.tex(sign(i, b), { aniso: 8 }), m = lit({ map: t, roughness: 0.8 }); signs.set(k, m);
      const F = "700 70px Caveat";
      if (document.fonts && document.fonts.check && !document.fonts.check(F)) document.fonts.load(F).then(() => { t.image = sign(i, b); t.needsUpdate = true; }, () => {});
      return m;
    }

    /* ── one site: its pieces, gathered by material ── */
    function site(ch) {
      const by = new Map(), farBy = new Map(), extra = [];
      const add = (mat, g, m, far = true) => { for (const B of far ? [by, farBy] : [by]) { if (!B.has(mat)) B.set(mat, []); B.get(mat).push({ g: B === by ? g : g.clone(), m }); } };
      return { add, extra, ch,
        meshes(ch) {
          for (const [B, grp, sh] of [[by, ch.near, true], [farBy, ch.far, false]]) for (const [mat, list] of B) {
            const g = ch.keep(merge(list)), o = new T.Mesh(g, mat); o.castShadow = sh && mat !== M.bulb && mat !== M.lamp && mat !== M.glowWin; o.receiveShadow = sh; o.matrixAutoUpdate = false; grp.add(o);
          }
          for (const [o, far] of extra) { (far ? ch.far : ch.near).add(o); }
        } };
    }
    /* fairy lights strung from a to b, sagging between (bulbs as tiny boxes, all of a site in one mesh) */
    function string(S, f, a, b, n, sag) {
      for (let i = 0; i <= n; i++) { const u = i / n, x = a[0] + (b[0] - a[0]) * u, z = a[2] + (b[2] - a[2]) * u, y = a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u);
        S.add(M.bulb, new T.SphereGeometry(0.055, 6, 4), f(x, y, z), true); }
    }
    function halo(S, f, x, y, z, size, far = true) {
      const s = new T.Sprite(M.halo); s.position.setFromMatrixPosition(f(x, y, z)); s.scale.set(size, size, 1);
      S.extra.push([s, false]); if (far) { const s2 = s.clone(); s2.scale.set(size * 1.6, size * 1.6, 1); S.extra.push([s2, true]); }
    }
    /* the warm pool a light throws on the sand around it */
    function pool(S, f, x, z, w, d) {
      const g = S.ch.keep(new T.PlaneGeometry(w, d)); g.rotateX(-Math.PI / 2);
      const o = new T.Mesh(g, M.pool); o.applyMatrix4(f(x, 0.02, z)); o.renderOrder = 3; S.extra.push([o, false]);
    }
    /* a sunbed: slatted, its back raised, facing the sea */
    function sunbed(S, f, x, z, r) {
      const g = frameIn(f, x, z, r);
      S.add(M.wood, boxG(0.66, 0.06, 1.25, 0.6), g(0, 0.34, -0.32));
      S.add(M.wood, boxG(0.66, 0.06, 0.72, 0.6), g(0, 0.55, 0.55, -0.62));
      for (const [lx, lz] of [[-0.28, -0.85], [0.28, -0.85], [-0.28, 0.2], [0.28, 0.2]]) S.add(M.wood, boxG(0.05, 0.32, 0.05), g(lx, 0.16, lz), false);
    }
    /* a palm-thatch umbrella on a pole */
    function umbrella(S, f, x, z, r) {
      const g = frameIn(f, x, z, r), h = 2.25 + r() * 0.3, R = 1.3 + r() * 0.3;
      S.add(M.cane, cylG(0.05, 0.06, h), g(0, h / 2, 0));
      S.add(M.thatch, cylG(0.05, R, 0.7, 12, true), g(0, h - 0.18, 0, 0, r() * TAU, 0));
      S.add(M.thatchDark, cylG(R, R * 1.04, 0.16, 12, true), g(0, h - 0.6, 0));
    }
    /* a table for four on the sand or the deck, plastic chairs round it */
    function table(S, f, x, z, y, r) {
      const g = frameIn(f, x, z, r, y);
      S.add(M.wood, boxG(0.85, 0.05, 0.85, 0.5), g(0, 0.74, 0)); S.add(M.wood, cylG(0.04, 0.05, 0.72), g(0, 0.36, 0), false);
      const cm = CHAIRS[Math.floor(r() * CHAIRS.length)];
      for (let k = 0; k < 4; k++) { if (r() < 0.25) continue; const a = k * Math.PI / 2 + (r() - 0.5) * 0.4, cx = Math.sin(a) * 0.72, cz = Math.cos(a) * 0.72, c = frameIn(g, cx, cz, null, 0, a);
        S.add(cm, boxG(0.44, 0.04, 0.42), c(0, 0.44, 0), false); S.add(cm, boxG(0.44, 0.42, 0.04), c(0, 0.66, 0.21, -0.12), false);
        for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) S.add(cm, boxG(0.03, 0.44, 0.03), c(lx, 0.22, lz), false); }
    }
    /* a frame inside a frame: at (x, z) of f, turned a little at random (or by `ang`) */
    function frameIn(f, x, z, r, y = 0, ang) {
      const a = ang !== undefined ? ang : r ? (r() - 0.5) * 0.3 : 0, F0 = f(x, y, z, 0, a, 0);
      return (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new T.Matrix4().multiplyMatrices(F0, new T.Matrix4().compose(_p.set(lx, ly, lz), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz)));
    }

    /* ── a beach shack: a deck, bamboo posts, a sloping thatch roof, the bar at the back, fairy lights along the eaves,
       tables on the deck, sunbeds under thatch umbrellas out on the sand in front ── */
    function shack(ch, S, x, ry, r, sz, vz) {
      /* its back against the tree line; in front, what sand is left above the run of the waves */
      const W = 6.4 + r() * 1.6, D = 4.6 + r() * 0.8, dh = 0.32, hf = 2.55, hb = 3.25, z = vz - D / 2 + 0.8, room = z - D / 2 - sz - 4;
      const f = frame(x, z, ry);
      S.add(M.deck, boxG(W, dh, D, 1.6), f(0, dh / 2 - 0.05, 0));
      for (let i = 0; i < 6; i++) S.add(M.wood, boxG(0.12, dh, 0.12), f(-W / 2 + 0.2 + (W - 0.4) * (i % 3) / 2, dh / 2 - 0.1, i < 3 ? -D / 2 + 0.15 : D / 2 - 0.15), false);
      /* posts, taller at the back so the roof sheds toward the sea */
      const posts = [];
      for (const [px, pz, h] of [[-W / 2 + 0.15, -D / 2 + 0.15, hf], [0, -D / 2 + 0.15, hf], [W / 2 - 0.15, -D / 2 + 0.15, hf], [-W / 2 + 0.15, D / 2 - 0.15, hb], [W / 2 - 0.15, D / 2 - 0.15, hb]]) {
        S.add(M.cane, cylG(0.07, 0.08, h - dh, 7), f(px, dh + (h - dh) / 2 - 0.02, pz)); posts.push([px, h, pz]);
      }
      /* the roof: two courses of thatch, overhanging all round */
      const run = D + 1.4, rise = hb - hf + 0.12, len = Math.hypot(run, rise), tilt = Math.atan2(rise, run);
      S.add(M.thatch, boxG(W + 1.0, 0.22, len, 1.4), f(0, (hf + hb) / 2 + 0.2, 0.05, -tilt));
      S.add(M.thatchDark, boxG(W + 1.1, 0.12, 0.9, 1.0), f(0, hf + 0.06, -D / 2 - 0.42, -tilt * 1.4));
      S.add(M.wood, boxG(W + 0.2, 0.12, 0.12), f(0, hf - 0.02, -D / 2 + 0.15), false);
      S.add(M.wood, boxG(W + 0.2, 0.12, 0.12), f(0, hb - 0.02, D / 2 - 0.15), false);
      /* the back wall of woven matting, the bar before it, shelves of bottles, the lamp-lit hatch to the kitchen */
      S.add(M.weave, boxG(W - 0.2, hb - dh - 0.1, 0.07, 1.2), f(0, dh + (hb - dh) / 2 - 0.05, D / 2 - 0.12));
      const bw = 2.6 + r() * 0.8, bx = (r() - 0.5) * (W - bw - 1.2);
      S.add(M.wood, boxG(bw, 1.02, 0.55, 0.8), f(bx, dh + 0.51, D / 2 - 0.75)); S.add(M.deck, boxG(bw + 0.2, 0.06, 0.7, 0.8), f(bx, dh + 1.05, D / 2 - 0.75));
      S.add(M.wood, boxG(bw - 0.2, 0.04, 0.22), f(bx, dh + 1.55, D / 2 - 0.27), false); S.add(M.wood, boxG(bw - 0.2, 0.04, 0.22), f(bx, dh + 1.95, D / 2 - 0.27), false);
      for (let i = 0; i < 9; i++) S.add(M.glass, cylG(0.035, 0.035, 0.24, 5), f(bx - bw / 2 + 0.3 + i * (bw - 0.6) / 8, dh + 1.69 + (i % 2) * 0.4, D / 2 - 0.27), false);
      S.add(M.glowWin, boxG(1.1, 0.8, 0.02), f(bx + (bx > 0 ? -bw / 2 - 0.9 : bw / 2 + 0.9), dh + 1.35, D / 2 - 0.165));
      /* low railings of cane along the sides */
      for (const sx of [-1, 1]) { S.add(M.cane, boxG(0.05, 0.05, D - 0.4), f(sx * (W / 2 - 0.15), dh + 0.85, 0), false); S.add(M.cane, boxG(0.05, 0.05, D - 0.4), f(sx * (W / 2 - 0.15), dh + 0.45, 0), false); }
      /* the board over the front, toward the sea */
      const sg = new T.Mesh(ch.keep(boxG(2.6, 0.8, 0.06)), [M.wood, M.wood, M.wood, M.wood, M.wood, signMat(Math.floor(r() * NAMES.length), Math.floor(r() * BOARDS.length))]);
      sg.applyMatrix4(f(bx * 0.3, hf + 0.68, -D / 2 - 0.5, 0.12)); sg.castShadow = true; S.extra.push([sg, false]);
      const sgf = sg.clone(); S.extra.push([sgf, true]);
      /* fairy lights along the eaves and round the sides, paper lanterns inside */
      const ez = -D / 2 - 0.62, ey = hf + 0.02;
      string(S, f, [-W / 2 - 0.45, ey, ez], [W / 2 + 0.45, ey, ez], 28, 0.3);
      for (const sx of [-1, 1]) string(S, f, [sx * (W / 2 + 0.48), ey, ez], [sx * (W / 2 + 0.48), hb + 0.12, D / 2 + 0.6], 16, 0.22);
      /* and a loop out to the umbrellas' poles is left to the sunbeds' own lantern-light */
      for (let i = 0; i < 3; i++) { const lx = -W / 3 + i * W / 3 + (r() - 0.5) * 0.6, lz = (r() - 0.5) * 1.2, ly = (hf + hb) / 2 - 0.35;
        S.add(M.lamp, new T.SphereGeometry(0.17, 10, 8), f(lx, ly, lz), true); S.add(M.rope, cylG(0.006, 0.006, 0.4, 3), f(lx, ly + 0.36, lz), false); halo(S, f, lx, ly, lz, 1.6, i === 1); }
      halo(S, f, bx, dh + 1.8, D / 2 - 0.6, 2.4, false);
      pool(S, f, 0, -0.6, W + 6, D + 7);
      /* tables on the deck, and out on the sand under the stars */
      const nt = 2 + Math.floor(r() * 2);
      for (let i = 0; i < nt; i++) table(S, f, -W / 2 + 1.2 + i * (W - 2.4) / Math.max(1, nt - 1), -0.6 + (r() - 0.5) * 0.6, dh, r);
      for (let i = 0; i < 2; i++) if (room > 3.4 && r() < 0.7) table(S, f, (i ? 1 : -1) * (1.5 + r() * 1.5), -D / 2 - 1.8 - r() * Math.min(1.2, room - 3.4), 0, r);
      /* sunbeds under umbrellas: in a row out in front where the beach is deep enough, else along the sand either side */
      const nU = 2 + Math.floor(r() * 3), front = room > 2.6;
      for (let i = 0; i < nU; i++) {
        const side = i % 2 ? 1 : -1, ux = front ? -W / 2 - 1 + i * (W + 2) / Math.max(1, nU - 1) + (r() - 0.5) * 0.8 : side * (W / 2 + 2.2 + Math.floor(i / 2) * 2.8 + r() * 0.5);
        const uzz = front ? -D / 2 - Math.min(room - 0.8, 1.6 + r() * 2.4) : -D / 2 + 0.6 - r() * Math.max(0, Math.min(1.2, room + 1));
        umbrella(S, f, ux, uzz, r); sunbed(S, f, ux - 0.45, uzz - 0.25, r); if (r() < 0.6) sunbed(S, f, ux + 0.45, uzz - 0.25, r);
        ch.obstacle(...wpos(f, ux, uzz), 0.2, 'pole');
      }
      /* what the van and a walker go round: the deck */
      for (let k = -1; k <= 1; k++) ch.obstacle(...wpos(f, k * (W / 2 - D / 4), 0), D / 2 + 0.1, 'hut');
      return { lights: 1 };
    }
    const wpos = (f, lx, lz) => { const m = f(lx, 0, lz); return [m.elements[12], m.elements[14]]; };

    /* ── coco huts: on stilts, woven walls, a thatch roof with a deep eave over a little verandah, a ladder down ── */
    function hut(ch, S, f, lit, door, r) {
      const W = 2.4 + r() * 0.5, D = 2.2 + r() * 0.3, V = 1.0, H = 0.85 + r() * 0.2, wh = 1.75, z0 = V / 2;   /* room from z0 − D/2 … z0 + D/2, verandah in front */
      S.add(M.deck, boxG(W + 0.1, 0.1, D + V, 1.2), f(0, H, z0 - V / 2));
      for (const [px, pz] of [[-W / 2, z0 - D / 2 - V + 0.05], [W / 2, z0 - D / 2 - V + 0.05], [-W / 2, z0 + D / 2], [W / 2, z0 + D / 2], [-W / 2, z0 - D / 2], [W / 2, z0 - D / 2]])
        S.add(M.cane, cylG(0.06, 0.07, H + (pz < z0 - D / 2 - 0.5 ? 1.5 : 0), 6), f(px, (H + (pz < z0 - D / 2 - 0.5 ? 1.5 : 0)) / 2, pz));
      /* walls, the front one with a door and a window */
      S.add(M.weave, boxG(W, wh, 0.06, 1.0), f(0, H + wh / 2, z0 + D / 2));
      for (const sx of [-1, 1]) S.add(M.weave, boxG(0.06, wh, D, 1.0), f(sx * W / 2, H + wh / 2, z0));
      const fz = z0 - D / 2, dw = 0.75, wx = W * 0.22;
      S.add(M.weave, boxG(W / 2 - dw / 2 + 0.12, wh, 0.06, 1.0), f(-W / 4 - dw / 4 - 0.06, H + wh / 2, fz));
      S.add(M.weave, boxG(W / 2 - dw / 2 - 0.12, wh, 0.06, 1.0), f(W / 4 + dw / 4 + 0.06, H + wh / 2, fz));
      S.add(M.weave, boxG(dw, 0.3, 0.06, 1.0), f(-0.12, H + wh - 0.15, fz));
      S.add(DOORS[door], boxG(dw - 0.06, wh - 0.34, 0.04), f(-0.12, H + (wh - 0.3) / 2, fz - 0.02));
      S.add(lit ? M.glowWin : M.dark, boxG(0.5, 0.42, 0.02), f(wx + 0.12, H + 1.12, fz - 0.035));
      S.add(M.wood, boxG(0.6, 0.05, 0.05), f(wx + 0.12, H + 0.88, fz - 0.05), false);
      /* the roof: a gable along the hut, its front pitch carried out over the verandah */
      const ridge = H + wh + 0.95, fr = z0 - D / 2 - V - 0.35, bk = z0 + D / 2 + 0.45, zr = z0 + 0.15;
      for (const [za, zb] of [[fr, zr], [bk, zr]]) { const run = zb - za, rise = ridge - (H + wh - 0.05), len = Math.hypot(run, rise), a = Math.atan2(rise, Math.abs(run)) * Math.sign(run);
        S.add(M.thatch, boxG(W + 0.7, 0.18, len, 1.2), f(0, (ridge + H + wh - 0.05) / 2, (za + zb) / 2, -a)); }
      S.add(M.thatchDark, cylG(0.12, 0.12, W + 0.8, 6), f(0, ridge + 0.04, zr, 0, 0, Math.PI / 2));
      /* gable ends of matting */
      for (const sx of [-1, 1]) { const g = new T.BufferGeometry(), y0 = H + wh, zf = z0 - D / 2, zb = z0 + D / 2, yr = ridge - 0.12, zr2 = zr;
        const P = new Float32Array([0, y0, zf, 0, y0, zb, 0, yr, zr2]); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 0, D, 0, D / 2, (yr - y0)]), 2)); g.computeVertexNormals();
        g.setAttribute('normal', new T.BufferAttribute(new Float32Array([sx, 0, 0, sx, 0, 0, sx, 0, 0]), 3)); g.setIndex(sx > 0 ? [0, 2, 1] : [0, 1, 2]);
        S.add(M.weave, g, f(sx * W / 2, 0, 0)); }
      /* the verandah's rail, and the ladder down to the sand */
      const vz = z0 - D / 2 - V + 0.05;
      S.add(M.cane, boxG(W - 1.0, 0.05, 0.05), f(0.5, H + 0.75, vz), false);
      for (const sx of [-1, 1]) S.add(M.cane, boxG(0.05, 0.05, V - 0.1), f(sx * W / 2, H + 0.75, vz + V / 2), false);
      const lx = -W / 2 + 0.45, ll = Math.hypot(H, 0.7), la = Math.atan2(0.7, H);
      for (const sx of [-0.22, 0.22]) S.add(M.wood, boxG(0.05, ll, 0.06), f(lx + sx, H / 2, vz - 0.35, la), false);
      for (let i = 1; i <= 3; i++) S.add(M.wood, boxG(0.46, 0.04, 0.08), f(lx, H * i / 4, vz - 0.7 * (1 - i / 4)), false);
      if (lit) { S.add(M.lamp, boxG(0.1, 0.16, 0.1), f(-0.12 + dw / 2 + 0.18, H + 1.55, fz - 0.12), true); halo(S, f, -0.12 + dw / 2 + 0.18, H + 1.55, fz - 0.14, 1.1, true); }
      return { W, D: D + V };
    }
    function hutRow(ch, S, x, z, ry, r) {
      const n = 3 + Math.floor(r() * 3), gap = 4.4 + r() * 0.8, f0 = frame(x, z, ry);
      for (let i = 0; i < n; i++) {
        const lx = (i - (n - 1) / 2) * gap + (r() - 0.5) * 0.6, lz = (r() - 0.5) * 1.2, f = frameIn(f0, lx, lz, r);
        const lit = r() < 0.55, h = hut(ch, S, f, lit, Math.floor(r() * DOORS.length), r);
        ch.obstacle(...wpos(f0, lx, lz + 0.2), Math.max(h.W, h.D) * 0.55, 'hut');
        if (lit) pool(S, f, 0, -1.6, 4.5, 4.5);
      }
      return { lights: 1 };
    }

    /* ── a fishing spot: outrigger boats above the tide line, a net drying between poles, a thatch shelter ── */
    /* an outrigger canoe (models/struct/outrigger.js) lying along the beach, its float toward the sea or the land; near, the
       boat itself; further off, the same in fewer facets */
    function boat(ch, S, x, z, ry, r, livery) {
      const side = r() < 0.5 ? -1 : 1, seed = 1 + Math.floor(r() * 1e6), th = ry - Math.PI / 2;
      const near = Models.make('struct/outrigger', { seed, livery, side }), far = Models.make('struct/outrigger', { seed, livery, side, lite: true });
      for (const [o, isFar] of [[near, false], [far, true]]) { o.position.set(x, 0, z); o.rotation.y = th; o.updateMatrixWorld(true); o.traverse(m => { if (m.isMesh) ch.keep(m.geometry); }); S.extra.push([o, isFar]); }
      /* (what the van and a walker go round: the hull along its length, the float off its side) */
      const I = near.userData.info, c = Math.cos(th), s = Math.sin(th), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      for (let k = -2; k <= 2; k++) ch.obstacle(...at(k * I.len / 5, 0), 0.5, 'boat');
      for (const fx of [I.fx0 + 0.4, (I.fx0 + I.fx1) / 2, I.fx1 - 0.4]) ch.obstacle(...at(fx, I.zf), 0.25, 'boat');
    }
    function fishing(ch, S, x, ry, r, sz, vz) {
      const z = vz - 1.2, f = frame(x, z, ry);
      /* a shelter: an A-frame of thatch down to the sand */
      const W = 3.0 + r(), D = 2.4, H = 2.3;
      for (const sx of [-1, 1]) { const len = Math.hypot(D / 2, H), a = Math.atan2(D / 2, H);
        S.add(M.thatch, boxG(W, len, 0.16, 1.2), f(0, H / 2, sx * D / 4, -sx * a)); }
      S.add(M.thatchDark, cylG(0.1, 0.1, W + 0.3, 6), f(0, H, 0, 0, 0, Math.PI / 2));
      ch.obstacle(...wpos(f, 0, 0), Math.max(W, D) * 0.55, 'hut');
      /* a lantern on a post by it, lit at night */
      const lx = W / 2 + 0.8;
      S.add(M.wood, cylG(0.05, 0.06, 1.9, 6), f(lx, 0.95, -0.6)); S.add(M.wood, boxG(0.5, 0.05, 0.05), f(lx - 0.2, 1.88, -0.6), false);
      S.add(M.lamp, boxG(0.12, 0.18, 0.12), f(lx - 0.38, 1.7, -0.6), true); halo(S, f, lx - 0.38, 1.7, -0.6, 1.2, true);
      pool(S, f, lx - 0.38, -0.6, 4, 4);
      /* the net, hung between two poles to dry */
      const nx = -W / 2 - 2.6 - r(), nz = -1.4 - r() * 1.2, nw = 3.2 + r(), na = (r() - 0.5) * 0.5, g = frameIn(f, nx, nz, null, 0, na);
      for (const sx of [-1, 1]) { S.add(M.wood, cylG(0.05, 0.06, 2.0, 6), g(sx * nw / 2, 1.0, 0)); ch.obstacle(...wpos(f, nx + sx * nw / 2 * Math.cos(na), nz), 0.15, 'pole'); }
      const ng = new T.PlaneGeometry(nw, 1.6, 12, 6), P = ng.attributes.position;
      for (let i = 0; i < P.count; i++) { const u = P.getX(i) / nw + 0.5, v = P.getY(i) / 1.6 + 0.5; P.setY(i, P.getY(i) - 0.22 * Math.sin(Math.PI * u) * v); P.setZ(i, 0.08 * Math.sin(u * 9 + v * 3)); }
      ng.computeVertexNormals(); const uv = ng.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * nw * 3, uv.getY(i) * 1.6 * 3);
      S.add(M.net, ng, g(0, 1.1, 0), false);
      S.add(M.rope, cylG(0.01, 0.01, nw, 3), g(0, 1.92, 0, 0, 0, Math.PI / 2), false);
      /* the boats, down the beach toward the water, above where the waves run */
      const nb = 1 + (r() < 0.6 ? 1 : 0);
      /* (lying along the beach, a little above where the waves run) */
      /* (each its own boat: its own colours, its own name) */
      const NL = Models.outriggerLiveries || 6, l0 = Math.floor(r() * NL), l1 = (l0 + 1 + Math.floor(r() * (NL - 1))) % NL;
      for (let i = 0; i < nb; i++) { const bx = i ? 4.4 + r() * 1.4 : -4.2 - r() * 1.4, bz = Math.min(-2.6, sz + 4.8 + r() * 0.8 - z); boat(ch, S, ...wpos(f, bx, bz), ry + Math.PI / 2 + (r() - 0.5) * 0.3, r, i ? l1 : l0); }
      return { lights: 1 };
    }

    /* ── where they go: a chance in each 128 m chunk of the coast, never by the camp, never round a headland's point,
       and only where the beach is deep enough to keep them above the tide ── */
    const CAMP_CLEAR = 70;
    const plans = new Map(); let plansVer = -1;
    function plan(ch) {
      if (plansVer !== Layout.coastVer) { plans.clear(); plansVer = Layout.coastVer; }
      if (plans.has(ch.c)) return plans.get(ch.c);
      const C = Layout.Coast, h = k => C.hash(ch.cw ?? ch.c, 300 + k), out = [];   /* (drawn by the chunk's place in the loop) */
      if (h(0) < 0.62) {
        const kindR = h(1), kind = kindR < 0.45 ? 'shack' : kindR < 0.75 ? 'huts' : 'fishing';
        for (let tries = 0; tries < 6 && !out.length; tries++) {
          const x = ch.x0 + 18 + h(2 + tries) * (world.CW - 36);
          const ok = s => Math.abs(Layout.wrapD(s - Layout.camp.x)) > CAMP_CLEAR && !(Layout.hutSites || []).some(([hx]) => Math.abs(Layout.wrapD(s - hx)) < 26) && Layout.head(s) < 0.6 && Layout.vegZ(s) - Layout.shoreMeanZ(s) > (kind === 'huts' ? 6.5 : 8.6) && !(world.massif(s, Layout.vegZ(s) - 2) > 0.1);
          const span = kind === 'huts' ? 12 : 6;
          if (!ok(x) || !ok(x - span) || !ok(x + span)) continue;
          out.push({ kind, x, seed: 1 + Math.floor(h(20) * 1e9) });
        }
      }
      plans.set(ch.c, out);
      if (plans.size > 400) plans.delete(plans.keys().next().value);
      return out;
    }
    const ryAt = x => -Math.atan(Layout.shoreDZ(x));

    /* keep the ground clear of rocks and trees where they will stand */
    world.place(ch => {
      const claims = [];
      for (const p of plan(ch)) {
        const vz = Layout.vegZ(p.x), sz = Layout.shoreMeanZ(p.x);
        if (p.kind === 'shack') { claims.push([p.x, vz - 1.8, 8], [p.x - 6, vz - 2, 4.5], [p.x + 6, vz - 2, 4.5], [p.x, (vz + sz) / 2, 6]); }
        else if (p.kind === 'huts') { for (let k = -3; k <= 3; k++) claims.push([p.x + k * 4.6, vz + 0.6, 3.6]); }
        else claims.push([p.x, vz - 1.2, 4.5], [p.x - 4, vz - 2.5, 4], [p.x, sz + 4.6, 6], [p.x + 4.5, sz + 4.6, 5], [p.x - 4.5, sz + 4.6, 5]);
      }
      return claims;
    });
    /* and build them as the chunk's trees go up (seen within about 430 m) */
    let count = 0;
    world.decorate(ch => {
      for (const p of plan(ch)) {
        const r = rng(p.seed), S = site(ch), ry = ryAt(p.x);
        const vz = Layout.vegZ(p.x), sz = Layout.shoreMeanZ(p.x);
        if (p.kind === 'shack') shack(ch, S, p.x, ry, r, sz, vz);
        else if (p.kind === 'huts') hutRow(ch, S, p.x, vz + 0.6, ry, r);
        else fishing(ch, S, p.x, ry, r, sz, vz);
        S.meshes(ch); count++;
      }
    }, 'near');

    /* ── sand castles: none along the coast of their own any more; the camp's, and the ones you build yourself (raise,
       below), each built its own way ── */
    let castles = 0;

    /* ── the sea and the castles. Each one standing near the camera (and the camp's own, given by adopt) is
       L = { p: where it stands, in the world, and how it was built (x, z, seed, wear, toys, toyAng, flag), g: the group
       it stands in, body: the castle itself in that (its bucket and spade lie beside it, things of their own), ch: its
       chunk, when it has one }. Its wear runs on past 1 as the waves flatten the last mound, and at 1.6 it is gone ── */
    const liveC = new Set();
    /* how tall it stands at a wear, as the model builds it (its towers), and then the mound pressed flatter */
    const HF = w => 1 - 0.32 * sm(0.1, 0.6, w) - 0.45 * sm(0.6, 0.95, w), flatK = w => w <= 1 ? 1 : Math.max(0.04, 1 - 0.96 * (w - 1) / 0.6);
    const tall = w => HF(Math.min(1, w)) * flatK(w);
    /* the castle built again as it is now (the old one thrown away); the first time, the bucket and the spade too */
    function buildCastle(L, first) {
      const { p, g } = L;
      if (L.body) { g.remove(L.body); L.body.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }
      if (L.wetM) { L.wetM.dispose(); L.wetM = null; }
      const m = Models.make('beach/sandcastle', { seed: p.seed, wear: Math.min(1, p.wear), toys: first && p.toys, toyAng: p.toyAng, flag: p.flag, lite: !!L.ch, soak: p.soaked ? 1 : 0 });
      const toys = m.userData.toys, body = new T.Group();
      for (const c of [...m.children]) (toys.includes(c) ? g : body).add(c);
      body.scale.y = flatK(p.wear); body.visible = !p.gone; g.add(body);
      Object.assign(L, { body, sand: m.userData.sand, r: m.userData.base });
      if (first) L.toys = toys.map(o => ({ o, P: o.position.clone(), d: 0, spin: 0, fall: 0 }));
      g.updateMatrixWorld(true);
      if (L.ch) (first ? g : body).traverse(q => { if (q.isMesh) L.ch.keep(q.geometry); });
    }
    /* a castle washed flat: gone from what a walker must go round */
    function lose(L) {
      if (L.onGone) return L.onGone(true);
      if (L.ch) for (const b of L.ch.obs) for (const ob of b) if (ob[3] === 'castle' && Math.abs(ob[0] - L.p.x) < 0.05 && Math.abs(ob[1] - L.p.z) < 0.05) ob[2] = 0;
    }

    /* ── the castles you build yourself: knelt over in front of you and patted up out of the damp sand, a heap first,
       then the walls drawn up out of it and the towers turned out of the bucket one by one, in a few seconds. Up to a
       dozen stand at once (the oldest goes when you build the thirteenth); the sea takes them as it takes the camp's,
       and the van, driven into one, flattens it. Where they stand is the page's own frame, carried round the beach's
       loop with the eye (shift) ── */
    const mine = [], MINE = 12;
    /* (how it rises: the wear it is built at at each moment, from a heap to its towers) */
    const GROW = [[0, 1.42], [0.7, 1.12], [1.4, 0.82], [2.1, 0.5], [2.8, 0.22], [3.4, 0.04]];
    function raise(x, z, rot, o = {}) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
      /* (wet through while it goes up, as the sand patted into it is; when it stands finished, fresh and damp) */
      const p = { x, z, rot, seed: o.seed || 1 + Math.floor(Math.random() * 1e6), wear: GROW[0][1], soaked: true, toys: o.toys !== false, toyAng: o.toyAng ?? (rot + 2.2 + Math.random()), flag: o.flag || (Math.random() < 0.5 ? 'leaf' : 'feather') };
      const L = { p, g, mine: true, grow: { t: 0, i: 0 } };
      buildCastle(L, true); root.add(g); liveC.add(L); mine.push(L); castles++;
      while (mine.length > MINE) drop(mine[0]);
      return L;
    }
    function drop(L) {
      const i = mine.indexOf(L); if (i >= 0) mine.splice(i, 1);
      liveC.delete(L); if (L.g.parent) L.g.parent.remove(L.g);
      L.g.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); if (L.wetM) L.wetM.dispose();
    }
    /* (rising, step by step; squashed under a wheel, slumping flat and spreading in a moment) */
    function animate(dt) {
      for (const L of mine) {
        const G = L.grow; if (!G) continue;
        G.t += dt;
        while (G.i < GROW.length - 1 && G.t >= GROW[G.i + 1][0]) { G.i++; L.p.wear = GROW[G.i][1]; L.p.soaked = G.i < GROW.length - 1; buildCastle(L, false); }
        /* (between the steps the heap swells a little toward the next, so it grows rather than jumps) */
        if (G.i < GROW.length - 1) { const [t0, w0] = GROW[G.i], [t1, w1] = GROW[G.i + 1], k = sm(0, 1, (G.t - t0) / (t1 - t0)); L.body.scale.y = flatK(w0) + (flatK(w1) - flatK(w0)) * k * 0.6; }
        else { L.grow = null; L.p.wear0 = L.p.wear; }
      }
      for (const L of liveC) {
        const Q = L.squash; if (!Q) continue;
        Q.t += dt; const k = sm(0, 1, Q.t / 0.28);
        L.body.scale.set(1 + 0.32 * k, Q.y0 * (1 - k) + 0.05 * k, 1 + 0.32 * k);
        if (Q.t > 0.32) { L.squash = null; L.p.wear = 1.6; L.p.gone = true; L.body.visible = false; L.body.scale.set(1, 1, 1); lose(L); }
      }
    }
    /* the van over a castle at (x, z) (within r of it): flattened, not driven round */
    function squash(x, z, r = 0.5) {
      let hit = false;
      for (const L of liveC) {
        const p = L.p; if (p.gone || L.squash) continue;
        if (Math.hypot(p.x - x, p.z - z) > r + (L.r || 0.5) * 0.8) continue;
        L.grow = null; L.wash = null; L.squash = { t: 0, y0: L.body.scale.y }; hit = true;
      }
      return hit;
    }
    /* what a walker goes round: the castles you built, still standing */
    function obstacles(x, z, out = []) {
      for (const L of mine) { const p = L.p; if (!p.gone && Math.abs(p.x - x) < 6 && Math.abs(p.z - z) < 6) out.push([p.x, p.z, (L.r || 0.55) * 0.8, 'castle']); }
      return out;
    }
    /* (the beach's loop: those near the eye carried round with it) */
    function shift(d, near) { for (const L of mine) if (near(L.p.x)) { L.p.x += d; L.g.position.x += d; } }
    /* (the camp moved: what you built by the old one is left behind with it) */
    function clearMine() { while (mine.length) drop(mine[0]); }
    /* the sea over a castle. As a wave runs up round it the castle slumps, the water undercutting it, and goes dark as it
       soaks; the further the water runs on past it, the more of it the wave takes. When the water has drained off it, it
       is built again as the wave has left it: towers to stumps, then a wet mound, then each wave pressing that flatter
       till it is gone. The bucket and the spade are carried up the sand on the water and left where it drops them */
    const _u = new T.Vector3(), _Y = new T.Vector3(0, 1, 0);
    let lastWt = null;
    function washCastles(wt, swash) {
      if (!swash) return;
      const dt = lastWt === null ? 0 : Math.max(0, Math.min(0.5, wt - lastWt)); lastWt = wt;
      if (dt <= 0) return;
      for (const L of liveC) {
        const p = L.p; if (p.gone || L.squash || L.grow) continue;
        /* how far past its seaward foot the water has run just now (m; below 0, short of it), along its middle and either
           side of it (the swash comes up in tongues: one may reach a side of it and not the middle) */
        const gz = Layout.shoreDZ(p.x), nz = Math.sqrt(1 + gz * gz);
        let over = -1e9;
        for (const f of [-0.7, 0, 0.7]) {
          const x = p.x + f * L.r, up = (p.z - Layout.shoreZ(x)) / nz;
          /* (a chunk's castle stands in the chunks' own frame, the camp's and yours in the page's: world.js setLoop) */
          over = Math.max(over, swash(L.ch ? x - (world.loop || 0) : x, wt) - (up - 0.8 * L.r * Math.sqrt(1 - f * f)));
        }
        let W = L.wash;
        if (over > 0) {
          if (!W) W = L.wash = { max: 0, w: p.wear, dry: 0, t: 0 };
          W.max = Math.max(W.max, over); W.dry = 0;
          W.w1 = Math.min(1.6, p.wear + 0.3 + 0.4 * Math.min(W.max, 3));
        } else if (W) W.dry += dt;
        if (!W) continue;
        W.t += dt;
        W.w += (W.w1 - W.w) * (1 - Math.exp(-dt / 0.55));
        L.body.scale.y = tall(W.w) / HF(Math.min(1, p.wear));
        if (!p.soaked && L.sand) {
          if (!L.wetM) { L.wetM = Mats.lit({ vertexColors: true, roughness: 0.96 }, 'sandc'); L.sand.material = L.wetM; }
          const k = sm(0, 0.8, W.t); L.wetM.color.setScalar(1 - 0.4 * k); L.wetM.roughness = 0.96 - 0.16 * k;
        }
        if (L.toys && over > 0) {
          /* (up the beach, in the castle's own frame) */
          _u.set(-gz / nz, 0, 1 / nz).applyAxisAngle(_Y, -p.rot);
          for (const q of L.toys) {
            const bucket = q.o.userData.toy === 'bucket', v = (bucket ? 0.55 : 0.18) * Math.min(1, 0.4 + over);
            q.d = Math.min(bucket ? 3 : 0.8, q.d + v * dt); q.spin += (bucket ? 0.7 : 0.25) * dt * Math.min(1, over); q.fall = Math.min(1, q.fall + dt / 0.9);
            const o = q.o.position.copy(q.P).addScaledVector(_u, q.d);
            /* (round the castle, not through it) */
            const rr = Math.hypot(o.x, o.z), rm = 0.85 * L.r; if (rr < rm) { o.x *= rm / Math.max(rr, 1e-3); o.z *= rm / Math.max(rr, 1e-3); }
            if (bucket) q.o.rotation.y = q.spin; else { q.o.rotation.x = 0.45 + 1.05 * sm(0, 1, q.fall); q.o.position.y = q.P.y * (1 - 0.75 * sm(0, 1, q.fall)); }
          }
        }
        if (W.dry > 0.45) {
          L.wash = null; p.wear = W.w1; p.soaked = true;
          if (p.wear >= 1.6) { p.gone = true; L.body.visible = false; lose(L); }
          else buildCastle(L, false);
        }
      }
    }
    /* the camp's own castle (camp.js builds it, its toys among the camp's things the sea moves) */
    function adopt(L) { L.p.wear0 = L.p.wear; liveC.add(L); }
    /* and built again with the camp, as it was first made */
    function restore(L) {
      const p = L.p; Object.assign(p, { wear: p.wear0, soaked: false, gone: false }); L.wash = null;
      buildCastle(L, false); if (L.onGone) L.onGone(false);
    }

    /* every frame: the lights come on after dusk and breathe a little; the glows are sized for the distance */
    let lastT = null;
    function update(S, t, wt, swash) {
      const dt = lastT === null ? 0 : Math.max(0, Math.min(0.25, t - lastT)); lastT = t;
      if (dt > 0) animate(dt);
      washCastles(wt, swash);
      const night = S ? S.night : 1, k = sm(0.25, 0.75, night), fl = 0.92 + 0.05 * Math.sin(t * 2.1) + 0.03 * Math.sin(t * 5.3 + 1.7), A = S ? S.amb : [0, 0, 0];
      M.bulb.color.setRGB(1.0 * 1.5 * k * fl + A[0] * 0.5, 0.62 * 1.5 * k * fl + A[1] * 0.5, 0.3 * 1.5 * k * fl + A[2] * 0.5);
      M.lamp.color.setRGB(1.0 * 0.8 * k * fl + A[0] * 0.5, 0.55 * 0.8 * k * fl + A[1] * 0.5, 0.24 * 0.8 * k * fl + A[2] * 0.5);
      M.glowWin.emissiveIntensity = 0.38 * k * fl;
      M.halo.opacity = 0.42 * k * fl; M.pool.opacity = 0.08 * k * fl;
    }
    /* (for the test bench: the sites laid out so far, along the coast) */
    const sites = () => [...plans.values()].flat().map(p => ({ kind: p.kind, x: p.x, z: Layout.vegZ(p.x) }));
    const castleSites = () => mine.map(L => ({ x: L.p.x, z: L.p.z, wear: L.p.wear, gone: !!L.p.gone }));
    return { update, sites, castleSites, adopt, restore, raise, squash, obstacles, shift, clearMine, get castles() { return castles; }, get count() { return count; }, M, debug: { liveC, mine, plan } };
  }
  return { build };
})();
