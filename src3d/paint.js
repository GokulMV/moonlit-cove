/* ─────────────────────────────────────────────────────────────
   paint.js — canvas-painted textures: rug, wood, fabric, bark,
   palm fronds, leaf clusters, wings, smoke, ground decals.
   ───────────────────────────────────────────────────────────── */
const Paint = (() => {
  const TAU = Math.PI * 2;
  const RF = { willReadFrequently: true };   /* these canvases are read back (grain, decals): keep them in memory, not on the GPU */
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rng = s => Textures.rng(s);
  const lin = (a, x0, y0, x1, y1, st) => { const g = a.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  const rad = (a, x, y, r, st, ox = 0, oy = 0) => { const g = a.createRadialGradient(x + ox, y + oy, 0, x, y, r); st.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
  function rr(c, x, y, w, h, r) {
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function grain(a, w, h, alpha, seed, dark = true) {
    const img = a.getImageData(0, 0, w, h), r = rng(seed);
    for (let i = 0; i < w * h; i++) { const v = (r() - 0.5) * alpha * 255; img.data[i * 4] += v; img.data[i * 4 + 1] += v; img.data[i * 4 + 2] += v; }
    a.putImageData(img, 0, 0);
  }

  /* kilim rug, 196 × 140 rug-units */
  function rug() {
    const c = cv(1024, 732), a = c.getContext('2d', RF), w = 196, h = 140;
    a.scale(1024 / w, 732 / h); a.translate(w / 2, h / 2);
    const band = (inset, col) => { a.fillStyle = col; a.beginPath(); rr(a, -w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, 0.6); a.fill(); };
    band(0, '#2e3a5c'); band(4, '#27211f'); band(6, '#e7d9bd');
    a.fillStyle = '#b5523a';
    const zig = (x0, y0, x1, y1, n, o) => { const dx = (x1 - x0) / n, dy = (y1 - y0) / n; a.beginPath();
      for (let i = 0; i < n; i++) { const ax = x0 + dx * i, ay = y0 + dy * i; a.moveTo(ax, ay); a.lineTo(ax + dx / 2 + o[0], ay + dy / 2 + o[1]); a.lineTo(ax + dx, ay + dy); } a.fill(); };
    const i0 = 6.4, zw = 6;
    zig(-w / 2 + i0, -h / 2 + i0, w / 2 - i0, -h / 2 + i0, 30, [0, zw]); zig(-w / 2 + i0, h / 2 - i0, w / 2 - i0, h / 2 - i0, 30, [0, -zw]);
    zig(-w / 2 + i0, -h / 2 + i0, -w / 2 + i0, h / 2 - i0, 21, [zw, 0]); zig(w / 2 - i0, -h / 2 + i0, w / 2 - i0, h / 2 - i0, 21, [-zw, 0]);
    band(13.5, '#d6a046'); band(15.5, '#2b2422'); band(16.8, '#9a3d2b');
    const loz = (cx, hw, hh, col, step = 2.6) => {
      a.fillStyle = col; a.beginPath(); const n = Math.max(2, Math.round(hh / step)); a.moveTo(cx, -hh);
      for (let i = 1; i <= n; i++) { const y = -hh + i * hh / n, x = cx + hw * i / n; a.lineTo(x - hw / n, y); a.lineTo(x, y); }
      for (let i = 1; i <= n; i++) { const y = i * hh / n, x = cx + hw * (1 - i / n); a.lineTo(x + hw / n, y - hh / n); a.lineTo(x, y); }
      for (let i = 1; i <= n; i++) { const y = hh - i * hh / n, x = cx - hw * i / n; a.lineTo(x + hw / n, y); a.lineTo(x, y); }
      for (let i = 1; i <= n; i++) { const y = -i * hh / n, x = cx - hw * (1 - i / n); a.lineTo(x - hw / n, y + hh / n); a.lineTo(x, y); }
      a.closePath(); a.fill();
    };
    for (const cx of [-54, 0, 54]) { loz(cx, 24, 44, '#d6a046'); loz(cx, 19, 35, '#2f3d63'); loz(cx, 13, 24, '#e7d9bd'); loz(cx, 8, 15, '#b5523a'); loz(cx, 3.5, 6.5, '#2b2422', 1.6); }
    a.fillStyle = '#e7d9bd';
    for (const [x, y] of [[-27, -40], [27, -40], [-27, 40], [27, 40], [-81, 0], [81, 0]]) { a.fillRect(x - 3.5, y - 0.8, 7, 1.6); a.fillRect(x - 0.8, y - 3.5, 1.6, 7); }
    a.globalCompositeOperation = 'multiply'; a.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = -w / 2; x < w / 2; x += 1.2) a.fillRect(x, -h / 2, 0.4, h);
    a.globalCompositeOperation = 'source-over';
    a.fillStyle = lin(a, -w / 2, -h / 2, w / 2, h / 2, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(0,0,0,0.12)'], [0.36, 'rgba(255,240,220,0.07)'], [0.5, 'rgba(0,0,0,0)'], [0.74, 'rgba(0,0,0,0.1)'], [1, 'rgba(0,0,0,0)']]);
    a.fillRect(-w / 2, -h / 2, w, h);
    a.setTransform(1, 0, 0, 1, 0, 0); grain(a, 1024, 732, 0.12, 77);
    return c;
  }

  function wood(seed, tones = ['#8d5c37', '#95633b', '#875834', '#916039'], planks = 4) {
    const c = cv(512, 256), a = c.getContext('2d', RF), r = rng(seed), ph = 256 / planks;
    for (let i = 0; i < planks; i++) {
      a.fillStyle = tones[i % tones.length]; a.fillRect(0, i * ph, 512, ph);
      for (let j = 0; j < 16; j++) {
        const y = i * ph + 2 + r() * (ph - 4); a.strokeStyle = `rgba(${r() < 0.5 ? '70,40,22' : '170,120,80'},${0.2 + r() * 0.3})`; a.lineWidth = 0.6 + r();
        a.beginPath(); a.moveTo(0, y); for (let x = 0; x <= 512; x += 16) a.lineTo(x, y + Math.sin(x * 0.03 + j) * 1.5); a.stroke();
      }
      a.fillStyle = '#2f1d12'; a.fillRect(0, i * ph, 512, 2);
    }
    grain(a, 512, 256, 0.08, seed + 1);
    return c;
  }

  function stripes(c1, c2, n = 7) {
    const c = cv(256, 256), a = c.getContext('2d', RF);
    for (let i = 0; i < n; i++) { a.fillStyle = i % 2 ? c2 : c1; a.fillRect(i * 256 / n, 0, 256 / n + 1, 256); }
    grain(a, 256, 256, 0.06, 3);
    return c;
  }

  function wicker() {
    const c = cv(256, 256), a = c.getContext('2d', RF);
    a.fillStyle = '#ad834d'; a.fillRect(0, 0, 256, 256);
    a.strokeStyle = 'rgba(70,45,20,0.55)'; a.lineWidth = 3;
    for (let i = -256; i < 512; i += 12) { a.beginPath(); a.moveTo(i, 0); a.lineTo(i + 256, 256); a.stroke(); a.beginPath(); a.moveTo(i + 256, 0); a.lineTo(i, 256); a.stroke(); }
    grain(a, 256, 256, 0.1, 9);
    return c;
  }

  function bark(seed) {
    const c = cv(128, 512), a = c.getContext('2d', RF), r = rng(seed);
    a.fillStyle = '#6d5a48'; a.fillRect(0, 0, 128, 512);
    for (let y = 0; y < 512; y += 9 + r() * 6) {
      a.fillStyle = `rgba(${40 + r() * 20},${30 + r() * 15},${22},${0.55 + r() * 0.3})`; a.fillRect(0, y, 128, 2 + r() * 2.5);
      a.fillStyle = `rgba(200,180,150,${0.12 + r() * 0.12})`; a.fillRect(0, y + 3, 128, 1.5);
    }
    for (let i = 0; i < 40; i++) { a.fillStyle = `rgba(30,25,20,${0.2 + r() * 0.2})`; a.fillRect(r() * 128, r() * 512, 1 + r() * 2, 6 + r() * 20); }
    grain(a, 128, 512, 0.12, seed + 3);
    return c;
  }

  /* palm frond: rachis up the middle (v = 0 base → 1 tip); dense, drooping leaflets */
  const shade = (hex, k, yel = 0) => { const v = parseInt(hex.slice(1), 16), r0 = v >> 16, g0 = (v >> 8) & 255, b0 = v & 255, cl = x => Math.max(0, Math.min(255, Math.round(x)));
    return `rgb(${cl(r0 * k + yel * 160)},${cl(g0 * k + yel * 120)},${cl(b0 * k)})`; };
  function frond(seed, dry = 0) {
    const c = cv(256, 1024), a = c.getContext('2d', RF), r = rng(seed);
    a.clearRect(0, 0, 256, 1024);
    const greens = dry ? ['#7d6a3a', '#8e7746', '#6a5830', '#9a8350'] : ['#27481d', '#2f5524', '#3a632b', '#22401a', '#44702f', '#335d27', '#4a7232'];
    /* a leaflet: darker where it leaves the rib, lighter toward its tip, a pale midrib down it, a darker edge */
    const blade = (x0, y0, x1, y1, cx, cy, w0, flat) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      a.beginPath(); a.moveTo(x0 + nx * w0, y0 + ny * w0);
      a.quadraticCurveTo(cx + nx * w0 * 0.7, cy + ny * w0 * 0.7, x1, y1);
      a.quadraticCurveTo(cx - nx * w0 * 0.7, cy - ny * w0 * 0.7, x0 - nx * w0, y0 - ny * w0); a.closePath();
      if (flat) { a.fill(); return; }
      const base = a.fillStyle, g = a.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, shade(base, 0.72)); g.addColorStop(0.45, base); g.addColorStop(1, shade(base, 1.18, 0.06)); a.fillStyle = g; a.fill();
      a.strokeStyle = 'rgba(0,10,0,0.28)'; a.lineWidth = 0.7; a.stroke();
      a.strokeStyle = dry ? 'rgba(230,210,150,0.3)' : 'rgba(205,220,140,0.32)'; a.lineWidth = Math.max(0.6, w0 * 0.22);
      a.beginPath(); a.moveTo(x0, y0); a.quadraticCurveTo(cx, cy, x0 + (x1 - x0) * 0.85, y0 + (y1 - y0) * 0.85); a.stroke();
    };
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 92; i++) {
        const t = 0.04 + i / 92 * 0.94 + (r() - 0.5) * 0.006, y = 1024 * (1 - t);
        const len = (1 - Math.pow(t, 1.45)) * 124 + 10;
        for (const side of [-1, 1]) {
          const ang = 0.55 + t * 0.4 + (r() - 0.5) * 0.14 + layer * 0.08;
          const x1 = 128 + side * Math.cos(ang) * len, y1 = y - Math.sin(ang) * len * 0.85 + len * 0.12;
          const cx = (128 + x1) / 2 + side * len * 0.06, cy = (y + y1) / 2 - len * 0.18;
          const col = greens[Math.floor(r() * greens.length)];
          a.fillStyle = col; blade(128 + side * 3, y, x1, y1, cx, cy, (6.5 - t * 3.5) * (layer ? 0.85 : 1));
          if (!dry && r() < 0.12) { a.fillStyle = 'rgba(160,140,70,0.75)'; blade(x1 - side * len * 0.18, y1 + len * 0.05, x1, y1, x1 - side * len * 0.08, y1, 2.5, true); }
        }
      }
    }
    a.globalCompositeOperation = 'source-atop';
    a.fillStyle = lin(a, 0, 0, 256, 0, [[0, 'rgba(0,0,0,0.25)'], [0.45, 'rgba(255,255,220,0.06)'], [0.55, 'rgba(255,255,220,0.06)'], [1, 'rgba(0,0,0,0.25)']]);
    a.fillRect(0, 0, 256, 1024);
    a.globalCompositeOperation = 'source-over';
    a.strokeStyle = dry ? '#8d7a4c' : '#617a3c'; a.lineWidth = 8; a.lineCap = 'round';
    a.beginPath(); a.moveTo(128, 1024); a.quadraticCurveTo(131, 520, 128, 14); a.stroke();
    return c;
  }

  /* broadleaf cluster card (sea almond / tropical), dense */
  function leafCard(seed, palette) {
    const c = cv(256, 256), a = c.getContext('2d', RF), r = rng(seed);
    const cols = palette || ['#24411f', '#2d4f26', '#203a1c', '#38602c', '#2a4a23', '#456b31'];
    for (let i = 0; i < 46; i++) {
      const ang0 = r() * TAU, rad0 = Math.sqrt(r()) * 88;
      const x = 128 + Math.cos(ang0) * rad0, y = 128 + Math.sin(ang0) * rad0, ang = ang0 + (r() - 0.5) * 1.2;
      const L = 40 + r() * 34, W = L * (0.4 + r() * 0.14);
      a.save(); a.translate(x, y); a.rotate(ang);
      a.fillStyle = cols[Math.floor(r() * cols.length)];
      a.beginPath(); a.moveTo(-L / 2, 0); a.quadraticCurveTo(-L * 0.1, -W, L / 2, 0); a.quadraticCurveTo(-L * 0.1, W, -L / 2, 0); a.fill();
      a.fillStyle = 'rgba(255,255,220,0.07)'; a.beginPath(); a.moveTo(-L / 2, 0); a.quadraticCurveTo(-L * 0.1, -W, L / 2, 0); a.closePath(); a.fill();
      a.strokeStyle = 'rgba(190,220,160,0.22)'; a.lineWidth = 1.2; a.beginPath(); a.moveTo(-L / 2, 0); a.lineTo(L / 2, 0); a.stroke();
      a.restore();
    }
    return c;
  }

  function butterfly(scheme) {
    const c = cv(128, 128), a = c.getContext('2d', RF);
    const S = [['#e8892c', '#1d1410', '#ffffff'], ['#3d7fd6', '#101828', '#d8ecff'], ['#f2d64a', '#3a2a10', '#fff6c8'], ['#f3f0e6', '#4a4a4a', '#ffffff']][scheme % 4];
    a.translate(64, 64);
    for (const s of [-1, 1]) {
      a.save(); a.scale(s, 1);
      a.fillStyle = S[1]; a.beginPath(); a.moveTo(2, -4); a.bezierCurveTo(30, -60, 64, -40, 58, -6); a.bezierCurveTo(60, 8, 30, 10, 2, 2); a.fill();
      a.beginPath(); a.moveTo(2, 2); a.bezierCurveTo(30, 12, 46, 40, 26, 52); a.bezierCurveTo(14, 56, 6, 30, 2, 6); a.fill();
      a.fillStyle = S[0]; a.beginPath(); a.moveTo(6, -6); a.bezierCurveTo(28, -50, 54, -36, 52, -10); a.bezierCurveTo(50, 2, 28, 4, 6, 0); a.fill();
      a.beginPath(); a.moveTo(6, 4); a.bezierCurveTo(28, 14, 40, 34, 26, 44); a.bezierCurveTo(16, 48, 10, 28, 6, 8); a.fill();
      a.fillStyle = S[2]; for (const [x, y] of [[48, -14], [42, -26], [30, 36]]) { a.beginPath(); a.arc(x, y, 2.5, 0, TAU); a.fill(); }
      a.restore();
    }
    a.fillStyle = '#1a1410'; a.fillRect(-2, -18, 4, 40);
    return c;
  }

  function puff(seed) {
    const c = cv(128, 128), a = c.getContext('2d', RF), r = rng(seed);
    for (let i = 0; i < 14; i++) {
      const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rr2 = 18 + r() * 26;
      a.fillStyle = rad(a, x, y, rr2, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]); a.beginPath(); a.arc(x, y, rr2, 0, TAU); a.fill();
    }
    return c;
  }

  /* ground decals over the beach (world rect in metres):
     color = premultiplied tint (scorch, wrack, scuffs) · relief = R footprint relief, G trampled mask, B contact occlusion */
  function decals(rect, ppm) {
    const W = Math.round(rect.w * ppm), H = Math.round(rect.d * ppm);
    const C = cv(W, H), a = C.getContext('2d', RF);
    const mk = base => { const c = cv(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = base; x.fillRect(0, 0, W, H); x.setTransform(ppm, 0, 0, ppm, -rect.x * ppm, -rect.z * ppm); return { c, x }; };
    const RR = mk('rgb(128,128,128)'), TG = mk('#000'), AO = mk('#000');
    a.setTransform(ppm, 0, 0, ppm, -rect.x * ppm, -rect.z * ppm);
    TG.x.globalCompositeOperation = 'lighten'; AO.x.globalCompositeOperation = 'lighten';
    const r = rng(808);
    const soft = (x, cx, cz, rx, rz, rot, v, hard = 0.35) => { x.save(); x.translate(cx, cz); x.rotate(rot); x.scale(rx, rz);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const c = Math.round(v * 255);
      g.addColorStop(0, `rgb(${c},${c},${c})`); g.addColorStop(hard, `rgb(${c},${c},${c})`); g.addColorStop(1, '#000');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore(); };
    /* contact occlusion */
    const R0 = Layout.rug;
    AO.x.save(); AO.x.translate(R0.x, R0.z); AO.x.rotate(-R0.rot);
    for (const [blur, v] of [[0.18, 0.35], [0.07, 0.75]]) {
      AO.x.shadowColor = `rgba(255,255,255,${v})`; AO.x.shadowBlur = blur * ppm; AO.x.strokeStyle = `rgba(255,255,255,${v})`; AO.x.lineWidth = blur * 0.8;
      AO.x.strokeRect(-R0.w / 2, -R0.d / 2, R0.w, R0.d);
    }
    AO.x.restore();
    /* (the van's own shadow under it is drawn by the ground shader, where the van is: it drives off with it) */
    soft(AO.x, Layout.fire.x, Layout.fire.z, 0.78, 0.78, 0, 0.75, 0.55);
    for (const ch of Layout.chairs) soft(AO.x, ch.x, ch.z, 0.5, 0.45, 0, 0.45);
    soft(AO.x, Layout.driftwood.x, Layout.driftwood.z, 1.45, 0.24, Layout.driftwood.rot, 0.8, 0.5);
    for (const [x, z] of Layout.poles) soft(AO.x, x, z, 0.13, 0.13, 0, 0.9, 0.2);
    for (const [x, z] of Layout.lanterns) soft(AO.x, x, z, 0.24, 0.24, 0, 0.8, 0.45);
    for (const p of Layout.palms) soft(AO.x, p[0], p[1], 0.45, 0.45, 0, 0.7, 0.4);
    soft(AO.x, Layout.bottle.x, Layout.bottle.z, 0.16, 0.08, Layout.bottle.rot, 0.6);
    /* trampled sand round the camp and along the paths people walk */
    soft(TG.x, Layout.camp.x + 0.6, Layout.camp.z, 5.6, 3.4, 0.05, 0.85, 0.5);
    soft(TG.x, Layout.fire.x, Layout.fire.z, 2.4, 2.0, 0, 1.0, 0.5);
    soft(TG.x, Layout.van.x + 1.2, Layout.van.z + 0.6, 2.8, 1.8, 0, 0.7, 0.4);
    const bez = (p0, c, p1, n = 24) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return o; };
    const paths = [bez([-8.2, -0.9], [-5.0, -0.6], [-1.6, -1.7]), bez([2.7, -3.7], [3.5, -6.5], [-2.9, -7.5]), bez([5.2, -4.0], [6.0, -6.4], [8.2, -6.9]), bez([1.0, -0.9], [0.5, 1.2], [-0.4, 2.6])];
    for (const pts of paths) { TG.x.strokeStyle = 'rgb(140,140,140)'; TG.x.lineWidth = 0.9; TG.x.lineCap = 'round'; TG.x.filter = `blur(${0.25 * ppm}px)`; TG.x.beginPath(); pts.forEach((q, i) => i ? TG.x.lineTo(q[0], q[1]) : TG.x.moveTo(q[0], q[1])); TG.x.stroke(); TG.x.filter = 'none'; }
    /* scorch + wrack line */
    a.fillStyle = rad(a, Layout.fire.x, Layout.fire.z, 0.72, [[0, 'rgba(20,14,10,0.45)'], [0.55, 'rgba(20,14,10,0.18)'], [1, 'rgba(20,14,10,0)']]);
    a.beginPath(); a.arc(Layout.fire.x, Layout.fire.z, 0.72, 0, TAU); a.fill();
    for (let x = rect.x + 0.2; x < rect.x + rect.w; x += 0.25 + r() * 0.5) {
      const z = Layout.shoreZ(x) + 2.4 + r() * 0.5;
      a.strokeStyle = `rgba(${55 + r() * 25},${50 + r() * 20},35,${0.22 + r() * 0.2})`; a.lineWidth = 0.012 + r() * 0.02; a.lineCap = 'round';
      a.beginPath(); a.moveTo(x, z); a.bezierCurveTo(x + 0.1, z - 0.05 + r() * 0.1, x + 0.2, z + r() * 0.1, x + 0.25 + r() * 0.2, z + (r() - 0.5) * 0.15); a.stroke();
    }
    /* footprints: along the paths and scattered through the trampled area */
    const print = (cx, cz, ang, side) => {
      for (const [ctx, col, gr] of [[RR.x, 'rgb(152,152,152)', 1.3], [RR.x, 'rgb(96,96,96)', 1]]) {
        ctx.save(); ctx.translate(cx, cz); ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath();
        ctx.ellipse(-0.1, 0, 0.06 * gr, 0.052 * gr, 0, 0, TAU); ctx.ellipse(0.065, side * 0.004, 0.085 * gr, 0.062 * gr, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    };
    for (const pts of paths) {
      let carry = 0, idx = 0; const step = 0.62;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (!L) continue;
        let d = step - carry;
        while (d <= L) { const t = d / L, tx = (x1 - x0) / L, tz = (z1 - z0) / L, sd = idx++ % 2 ? 1 : -1;
          print(x0 + (x1 - x0) * t - tz * sd * 0.1, z0 + (z1 - z0) * t + tx * sd * 0.1, Math.atan2(tz, tx) + (r() - 0.5) * 0.2, sd); d += step; }
        carry = L - (d - step);
      }
    }
    for (let i = 0; i < 190; i++) {
      const ang = r() * TAU, k = Math.sqrt(r());
      const cx = Layout.camp.x + 0.6 + Math.cos(ang) * 5.4 * k, cz = Layout.camp.z + Math.sin(ang) * 3.2 * k;
      if (Math.abs(cx - Layout.rug.x) < 2.0 && Math.abs(cz - Layout.rug.z) < 1.45) continue;
      print(cx, cz, r() * TAU, r() < 0.5 ? 1 : -1);
    }
    /* tyre tracks from the van toward the trees */
    const vr = Layout.van.rot, fx = Math.cos(vr), fz = -Math.sin(vr);
    const front = [Layout.van.x + fx * 1.4, Layout.van.z + fz * 1.4];
    const path = bez(front, [front[0] + fx * 4.5, front[1] + fz * 4.5 + 1.0], [-19, 5.0], 40);
    for (const sd of [-0.78, 0.78]) {
      const tr = path.map((p, i) => { const q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)]; let tx = q[0] - o[0], tz = q[1] - o[1]; const l = Math.hypot(tx, tz) || 1; return [p[0] - tz / l * sd, p[1] + tx / l * sd]; });
      for (const [ctx, col, wdt] of [[RR.x, 'rgb(158,158,158)', 0.27], [RR.x, 'rgb(96,96,96)', 0.18]]) {
        ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineJoin = ctx.lineCap = 'round'; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      }
    }
    const g = n => n.x.getImageData(0, 0, W, H).data, rD = g(RR), tD = g(TG), aD = g(AO);
    const packed = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) { packed[i * 4] = rD[i * 4]; packed[i * 4 + 1] = tD[i * 4]; packed[i * 4 + 2] = aD[i * 4]; packed[i * 4 + 3] = 255; }
    return { color: C, relief: packed, w: W, h: H };
  }

  function driftwood() {
    const c = cv(256, 512), a = c.getContext('2d', RF), r = rng(66);
    a.fillStyle = '#9d9283'; a.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 90; i++) {
      const x = r() * 256, w = 0.6 + r() * 2.2; a.strokeStyle = `rgba(${r() < 0.55 ? '70,64,56' : '205,196,182'},${0.25 + r() * 0.35})`; a.lineWidth = w;
      a.beginPath(); a.moveTo(x, 0); for (let y = 0; y <= 512; y += 32) a.lineTo(x + Math.sin(y * 0.02 + i) * 3, y); a.stroke();
    }
    for (let i = 0; i < 7; i++) { const x = r() * 256, y = r() * 512; a.fillStyle = 'rgba(60,52,44,0.6)'; a.beginPath(); a.ellipse(x, y, 4 + r() * 5, 10 + r() * 14, 0, 0, TAU); a.fill(); }
    grain(a, 256, 512, 0.1, 67);
    return c;
  }

  /* rough log bark: deep fissures running along the log (v), a few pale knots */
  function logBark(seed) {
    const c = cv(256, 512), a = c.getContext('2d', RF), r = rng(seed);
    a.fillStyle = '#4a3627'; a.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 70; i++) {
      const x = r() * 256, w = 1 + r() * 4; a.strokeStyle = `rgba(${r() < 0.6 ? '24,16,11' : '112,86,62'},${0.35 + r() * 0.4})`; a.lineWidth = w;
      a.beginPath(); a.moveTo(x, 0); for (let y = 0; y <= 512; y += 24) a.lineTo(x + Math.sin(y * 0.03 + i * 1.7) * 4 + (r() - 0.5) * 2, y); a.stroke();
    }
    for (let i = 0; i < 6; i++) { const x = r() * 256, y = r() * 512; a.fillStyle = 'rgba(140,108,76,0.55)'; a.beginPath(); a.ellipse(x, y, 5 + r() * 6, 8 + r() * 10, 0, 0, TAU); a.fill(); a.strokeStyle = 'rgba(30,20,14,0.7)'; a.lineWidth = 2; a.stroke(); }
    grain(a, 256, 512, 0.14, seed + 9);
    return c;
  }
  /* speckled enamelware */
  function enamel(base = '#24486f') {
    const c = cv(256, 256), a = c.getContext('2d', RF), r = rng(404);
    a.fillStyle = base; a.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { a.fillStyle = `rgba(235,240,245,${0.25 + r() * 0.6})`; const s = 0.6 + r() * 1.8; a.fillRect(r() * 256, r() * 256, s, s); }
    for (let i = 0; i < 300; i++) { a.fillStyle = `rgba(10,20,35,${0.2 + r() * 0.4})`; const s = 0.8 + r() * 2; a.fillRect(r() * 256, r() * 256, s, s); }
    return c;
  }

  /* plank texture with grain running along v (the board's length) — painted boards show it faintly */
  function plank(seed, base = '#e6e0d2', paint = 1) {
    const c = cv(128, 512), a = c.getContext('2d', RF), r = rng(seed);
    a.fillStyle = base; a.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 26; i++) {
      const x = r() * 128; a.strokeStyle = `rgba(${paint ? '120,104,84' : '70,42,24'},${(paint ? 0.08 : 0.25) + r() * (paint ? 0.12 : 0.3)})`; a.lineWidth = 0.6 + r() * 1.6;
      a.beginPath(); a.moveTo(x, 0); for (let y = 0; y <= 512; y += 32) a.lineTo(x + Math.sin(y * 0.012 + i) * 3, y); a.stroke();
    }
    if (paint) for (let i = 0; i < 40; i++) { a.fillStyle = `rgba(140,112,82,${0.12 + r() * 0.2})`; a.fillRect(r() * 128, r() * 512, 1 + r() * 4, 2 + r() * 14); }
    grain(a, 128, 512, 0.06, seed + 5);
    return c;
  }
  /* wool plaid */
  function plaid(c1 = '#7a2f2a', c2 = '#2d3b4f', c3 = '#d9c7a2') {
    const c = cv(256, 256), a = c.getContext('2d', RF);
    a.fillStyle = c1; a.fillRect(0, 0, 256, 256);
    a.globalAlpha = 0.55; a.fillStyle = c2;
    for (const o of [0, 128]) { a.fillRect(o + 20, 0, 46, 256); a.fillRect(0, o + 20, 256, 46); }
    a.globalAlpha = 0.6; a.fillStyle = c3; for (const o of [0, 128]) { a.fillRect(o + 92, 0, 6, 256); a.fillRect(0, o + 92, 256, 6); }
    a.globalAlpha = 1; grain(a, 256, 256, 0.12, 9);
    return c;
  }
  /* canvas tent fabric for the pop-top */
  function canvasCloth() {
    const c = cv(256, 256), a = c.getContext('2d', RF), r = rng(12);
    a.fillStyle = '#d9cdb0'; a.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 3) { a.fillStyle = `rgba(120,104,80,${0.05 + r() * 0.05})`; a.fillRect(0, i, 256, 1); a.fillRect(i, 0, 1, 256); }
    grain(a, 256, 256, 0.08, 13);
    return c;
  }
  /* curtain fabric, lit from behind */
  function curtain() {
    const c = cv(128, 128), a = c.getContext('2d', RF);
    a.fillStyle = '#e9b46a'; a.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 16) { const g = a.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, 'rgba(120,60,20,0.35)'); g.addColorStop(0.5, 'rgba(255,230,180,0.1)'); g.addColorStop(1, 'rgba(120,60,20,0.35)'); a.fillStyle = g; a.fillRect(x, 0, 16, 128); }
    a.fillStyle = 'rgba(160,70,40,0.25)'; for (let y = 8; y < 128; y += 24) a.fillRect(0, y, 128, 5);
    return c;
  }
  /* acoustic guitar top: spruce, rosette, soundhole, bridge */
  function guitarTop() {
    const c = cv(256, 512), a = c.getContext('2d', RF), r = rng(31);
    a.fillStyle = '#d9a35c'; a.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 60; i++) { a.strokeStyle = `rgba(150,96,40,${0.1 + r() * 0.15})`; a.lineWidth = 0.6 + r(); const x = r() * 256; a.beginPath(); a.moveTo(x, 0); a.lineTo(x + (r() - 0.5) * 6, 512); a.stroke(); }
    a.fillStyle = '#1a120c'; a.beginPath(); a.arc(128, 243, 38, 0, TAU); a.fill();
    a.strokeStyle = '#5a3418'; a.lineWidth = 7; a.beginPath(); a.arc(128, 243, 50, 0, TAU); a.stroke();
    a.strokeStyle = '#e8d6b0'; a.lineWidth = 2; a.beginPath(); a.arc(128, 243, 56, 0, TAU); a.stroke();
    a.fillStyle = '#2b1a10'; a.fillRect(92, 412, 72, 16);
    a.fillStyle = '#e8e0cc'; a.fillRect(100, 414, 56, 3);
    return c;
  }

  /* the journal's leather cover: worn brown hide, saddle stitching, a strap, the title pressed in gold */
  function journalCover(c, info = {}) {
    const W = c.width, H = c.height, a = c.getContext('2d', RF);
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.fillStyle = '#5a3520'; a.fillRect(0, 0, W, H);
    const r = rng(61);
    for (let i = 0; i < 9000; i++) { const x = r() * W, y = r() * H, s = 1 + r() * 2.5; a.fillStyle = `rgba(${r() < 0.5 ? '30,15,5' : '140,95,60'},${0.05 + r() * 0.08})`; a.fillRect(x, y, s, s * 0.7); }
    a.fillStyle = rad(a, W * 0.45, H * 0.4, W * 0.9, [[0, 'rgba(160,110,70,0.25)'], [1, 'rgba(20,10,5,0.45)']]); a.fillRect(0, 0, W, H);
    a.strokeStyle = 'rgba(230,200,150,0.55)'; a.lineWidth = 2.5; a.setLineDash([10, 8]); a.strokeRect(22, 22, W - 44, H - 44); a.setLineDash([]);
    const gold = lin(a, 0, 0, W, H, [[0, '#c9a35a'], [0.5, '#f0d18c'], [1, '#b98c3e']]);
    a.textAlign = 'center'; a.fillStyle = gold; a.shadowColor = 'rgba(0,0,0,0.45)'; a.shadowOffsetY = 2;
    a.font = `700 70px Caveat, 'Segoe Print', cursive`; const words = (info.title || 'Journal').split(' '), mid = Math.ceil(words.length / 2);
    a.fillText(words.slice(0, mid).join(' '), W / 2, H * 0.4); a.fillText(words.slice(mid).join(' '), W / 2, H * 0.4 + 76);
    a.font = `500 34px Caveat, 'Segoe Print', cursive`; a.fillText(info.name || '', W / 2, H * 0.4 + 150); a.shadowColor = 'transparent';
    /* the strap that keeps it shut */
    a.fillStyle = 'rgba(25,12,5,0.85)'; a.fillRect(W - 92, 0, 26, H); a.fillStyle = 'rgba(255,220,170,0.08)'; a.fillRect(W - 92, 0, 3, H);
    return c;
  }
  /* ── the wish board's face: cork with paper notes pinned to it, newest first, each in handwriting with who left
     it and when, to the second. notes = [{ id, text, name, when, local }]; info = { total, local } ── */
  const PAPERS = ['#f6efd9', '#fbe7a1', '#dfeaf2', '#f5dde0', '#e4efd6', '#f3e3c8'], PINS = ['#c8443a', '#2f6db0', '#d9a62e', '#3c8a5a', '#8a4fa0', '#e6e1d6'], INKS = ['#22264a', '#2c1d14', '#1f3a5a'];
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const hand = (wt, px) => `${wt} ${px}px Caveat, 'Segoe Print', 'Bradley Hand', cursive`;
  let corkC = null;
  /* cork: warm granules, a few old pin holes, darker toward the frame (painted once, it never changes) */
  function cork(w, h) {
    const c = cv(w, h), a = c.getContext('2d'), r = rng(717);
    a.fillStyle = '#c79b5c'; a.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 24; i++) { const s = 1 + r() * 2.6; a.fillStyle = r() < 0.5 ? `rgba(112,80,38,${0.12 + r() * 0.3})` : `rgba(238,206,150,${0.1 + r() * 0.28})`; a.fillRect(r() * w, r() * h, s, s * (0.6 + r() * 0.8)); }
    for (let i = 0; i < 260; i++) { a.fillStyle = `rgba(86,60,26,${0.2 + r() * 0.3})`; a.beginPath(); a.ellipse(r() * w, r() * h, 1.5 + r() * 3, 1 + r() * 2.5, r() * TAU, 0, TAU); a.fill(); }
    for (let i = 0; i < 70; i++) { a.fillStyle = 'rgba(36,24,8,0.55)'; a.beginPath(); a.arc(r() * w, r() * h, 1.6, 0, TAU); a.fill(); }
    a.fillStyle = rad(a, w / 2, h / 2, Math.hypot(w, h) * 0.6, [[0.55, 'rgba(52,34,10,0)'], [1, 'rgba(52,34,10,0.4)']]); a.fillRect(0, 0, w, h);
    return c;
  }
  /* words to lines no wider than w; a word wider than a line (or a script written without spaces) breaks by letters */
  function wrapText(a, text, w) {
    const out = []; let line = '';
    for (const word of text.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (a.measureText(t).width <= w) { line = t; continue; }
      if (line) out.push(line);
      if (a.measureText(word).width <= w) { line = word; continue; }
      let part = ''; for (const ch of word) { if (part && a.measureText(part + ch).width > w) { out.push(part); part = ch; } else part += ch; }
      line = part;
    }
    if (line) out.push(line);
    return out;
  }
  function pin(a, x, y, col) {
    a.fillStyle = 'rgba(20,10,4,0.35)'; a.beginPath(); a.ellipse(x + 5, y + 7, 10, 6, 0.4, 0, TAU); a.fill();
    a.fillStyle = rad(a, x, y, 12, [[0, 'rgba(255,255,255,0.95)'], [0.32, col], [1, col]], -4, -4); a.beginPath(); a.arc(x, y, 11, 0, TAU); a.fill();
    a.strokeStyle = 'rgba(0,0,0,0.3)'; a.lineWidth = 1.2; a.stroke();
  }
  function note(a, cx, cy, w, h, n) {
    const r = rng(hashStr(String(n.id || n.text)) % 99991 + 1), rot = (r() - 0.5) * 0.09;
    a.save(); a.translate(cx + (r() - 0.5) * 22, cy + (r() - 0.5) * 16); a.rotate(rot);
    const ink = INKS[Math.floor(r() * INKS.length)];
    a.shadowColor = 'rgba(28,16,6,0.5)'; a.shadowBlur = 16; a.shadowOffsetX = 4; a.shadowOffsetY = 8;
    a.fillStyle = PAPERS[Math.floor(r() * PAPERS.length)]; a.fillRect(-w / 2, -h / 2, w, h); a.shadowColor = 'transparent';
    a.fillStyle = lin(a, 0, -h / 2, 0, h / 2, [[0, 'rgba(255,255,255,0.25)'], [0.7, 'rgba(255,255,255,0)'], [1, 'rgba(90,60,30,0.12)']]); a.fillRect(-w / 2, -h / 2, w, h);
    if (r() < 0.35) { a.strokeStyle = 'rgba(70,110,160,0.2)'; a.lineWidth = 1.5; for (let y = -h / 2 + 50; y < h / 2 - 70; y += 30) { a.beginPath(); a.moveTo(-w / 2 + 10, y); a.lineTo(w / 2 - 10, y); a.stroke(); } }
    /* the wish, as large as it fits */
    const tw = w - 48, th = h - 112; let sz = 46, lines = [];
    for (; sz >= 22; sz -= 2) { a.font = hand(600, sz); lines = wrapText(a, n.text, tw); if (lines.length * sz * 1.02 <= th) break; }
    sz = Math.max(sz, 22); a.font = hand(600, sz);
    const fit = Math.max(1, Math.floor(th / (sz * 1.02)));
    if (lines.length > fit) { lines = lines.slice(0, fit); lines[fit - 1] = lines[fit - 1].replace(/\s*\S*$/, '') + '…'; }
    a.fillStyle = ink; a.textAlign = 'left'; a.textBaseline = 'alphabetic';
    lines.forEach((l, i) => a.fillText(l, -w / 2 + 24, -h / 2 + 34 + sz * 0.85 + i * sz * 1.02));
    /* who, and when (to the second); a stamp on the ones kept only in this browser */
    const room = tw - (n.local ? 170 : 0); let ns = 30; a.font = hand(600, ns);
    while (ns > 18 && a.measureText('— ' + n.name).width > room) a.font = hand(600, ns -= 2);
    a.fillText('— ' + n.name, -w / 2 + 24, h / 2 - 44);
    a.font = `400 19px 'JetBrains Mono', Menlo, monospace`; a.fillStyle = 'rgba(64,50,36,0.9)'; a.fillText(n.when || '', -w / 2 + 26, h / 2 - 16);
    if (n.local) { a.save(); a.translate(w / 2 - 100, h / 2 - 36); a.rotate(-0.08); a.strokeStyle = a.fillStyle = 'rgba(176,52,40,0.62)'; a.lineWidth = 2; a.strokeRect(-80, -16, 160, 28); a.font = `500 13px 'JetBrains Mono', Menlo, monospace`; a.textAlign = 'center'; a.fillText('ONLY ON THIS DEVICE', 0, 3); a.restore(); }
    pin(a, 0, -h / 2 + 15, PINS[Math.floor(r() * PINS.length)]);
    a.restore();
  }
  function wishBoard(c, notes = [], info = {}) {
    const W = c.width, H = c.height, a = c.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0);
    if (!corkC || corkC.width !== W || corkC.height !== H) corkC = cork(W, H);
    a.drawImage(corkC, 0, 0);
    const cols = 3, rows = 3, top = 168, gx = 40, cw = (W - 2 * gx) / cols, ch = (H - top - 24) / rows, shown = notes.slice(0, cols * rows), total = Math.max(info.total || 0, notes.length);
    /* the heading, on a card of its own */
    a.save(); a.translate(W / 2, 84); a.rotate(-0.012);
    a.shadowColor = 'rgba(28,16,6,0.45)'; a.shadowBlur = 14; a.shadowOffsetY = 6; a.fillStyle = '#e9d7b2'; a.fillRect(-300, -58, 600, 116); a.shadowColor = 'transparent';
    a.textAlign = 'center'; a.fillStyle = '#3b2a1c'; a.font = hand(700, 74); a.fillText('Wishes', 0, 10);
    a.fillStyle = '#6b4f36'; a.font = hand(500, 30);
    a.fillText(info.local ? 'kept only on this device' : total > shown.length ? `${total} so far · the newest are pinned here` : 'from everyone who let a lantern go', 0, 46);
    pin(a, -274, -38, '#c8443a'); pin(a, 274, -38, '#2f6db0'); a.restore();
    shown.forEach((n, i) => note(a, gx + (i % cols + 0.5) * cw, top + (Math.floor(i / cols) + 0.5) * ch, cw - 52, ch - 30, n));
    if (!shown.length) note(a, W / 2, top + (H - top) / 2 - 12, 560, 250, { id: 'empty', text: 'No wishes yet. Let a lantern go, and pin the first one here.', name: 'the cove', when: '' });
    return c;
  }
  return { journalCover, wishBoard, rug, wood, stripes, wicker, bark, frond, leafCard, butterfly, puff, decals, driftwood, logBark, enamel, plank, plaid, canvasCloth, curtain, guitarTop };
})();
