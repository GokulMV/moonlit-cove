/* ─────────────────────────────────────────────────────────────
   minimap.js — where you are: a small map in the corner, north
   up, with you on it (where you stand or look from, and which way
   you face), the camp and the van; tap it for the whole map.
   Round the island, the island itself — the sea round it, its
   beach all the way round, its forest shaded by its low hill, and
   whatever stands on it — drawn once from its grid; along the
   coast, the stretch of it round you
   (its shoreline, beach, forest edge, headlands and reefs), drawn
   as you go.
   ───────────────────────────────────────────────────────────── */
const Minimap = (() => {
  const TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rrect = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  /* (a map's palette: muted, so the markers on it stand out) */
  const COL = { deep: [13, 36, 56], shelf: [24, 72, 92], shallow: [52, 128, 140], surf: [118, 178, 178], reef: [86, 150, 140], sand: [214, 198, 160], wet: [178, 164, 132],
    rock: [138, 132, 120], cliff: [116, 110, 100], mud: [98, 88, 68], mang: [56, 72, 46], fringe: [76, 106, 60], forest: [42, 70, 42], high: [70, 90, 56] };
  const KEY = { trail: '#eadcb6', creek: '#5aa8bf', jetty: '#b28a5a', hut: '#d6b07e', camp: '#f2b769', van: '#7fc4c4', you: '#ffffff' };

  let btn, cv, g, dlg, bcv, bg, base = null, job = null, isle = false, open = false, shown = true, lastT = 0, lastBig = 0, lastF = 0, state = null;

  /* ── the island, drawn once: a pixel every 3.5 m, north up (the world's −x), east to the right (its −z) ── */
  function* islandBase() {
    const I = Layout.island(), D = I.data, G = D.grid, L = D.line, cell = G.cell, X0 = G.X0, Z0 = G.Z0, nx = G.nx, nz = G.nz;
    const M = 3.5, ZW = Z0 + nz * cell, W = Math.round(nz * cell / M), H = Math.round(nx * cell / M);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const cx = c.getContext('2d'), img = cx.createImageData(W, H), px = img.data;
    const S = G.S, HH = G.H, U = G.U, RB = G.RB, K = L.K, LW = L.W, n = L.n;
    /* (bilinear over the grid's cells, clamped to it) */
    const lerpAt = (A, fi, fj) => {
      const i0 = Math.max(0, Math.min(nx - 2, Math.floor(fi))), j0 = Math.max(0, Math.min(nz - 2, Math.floor(fj))), a = Math.max(0, Math.min(1, fi - i0)), b = Math.max(0, Math.min(1, fj - j0)), k = j0 * nx + i0;
      return (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + nx] * (1 - a) + A[k + nx + 1] * a) * b;
    };
    /* (the hills lit from the north-west, as maps light them) */
    const Lx = -0.6 / 1.237, Ly = 0.9 / 1.237, Lz = 0.6 / 1.237, flat = Ly;
    for (let r = 0; r < H; r++) {
      const x = X0 + (r + 0.5) * M, fi = (x - X0) / cell - 0.5;
      for (let q = 0; q < W; q++) {
        const z = ZW - (q + 0.5) * M, fj = (z - Z0) / cell - 0.5, s = lerpAt(S, fi, fj);
        const ci = Math.max(0, Math.min(nz - 1, Math.round(fj))) * nx + Math.max(0, Math.min(nx - 1, Math.round(fi)));
        const f = (((U[ci] + L.u0) / L.ds) % n + n) % n, li = Math.floor(f) % n, Wb = LW[li], sand = K[li * 4], rock = K[li * 4 + 1], cliff = K[li * 4 + 2], mang = K[li * 4 + 3];
        let col;
        if (s > 0) {
          /* the sea: paler over the shallows by the shore and over the reefs, deep blue further out */
          col = mix3(COL.shallow, COL.shelf, sm(4, 60, s)); col = mix3(col, COL.deep, sm(60, 260, s));
          if (RB[ci] > 2 && s < RB[ci]) col = mix3(col, COL.reef, 0.55 * (1 - sm(RB[ci] * 0.75, RB[ci], s)));
          if (s < 3) col = mix3(col, COL.surf, 0.6 * (1 - s / 3));
        } else {
          const d = -s, rk = (rock + cliff) * (1 - sm(Wb + 4, Wb + 18, d)), mg = sm(0.35, 0.6, mang);
          if (d < Wb - 1 && mg < 0.5) col = mix3(mix3(COL.rock, COL.sand, sand), COL.wet, (1 - sm(0, 4, d)) * 0.6);
          else {
            col = mix3(COL.forest, COL.fringe, sand * (1 - sm(Wb + 4, Wb + 22, d)) * (1 - mg));
            col = mix3(col, COL.high, sm(40, 220, lerpAt(HH, fi, fj)));
            col = mix3(col, mix3(COL.rock, COL.cliff, cliff), Math.min(1, rk * 1.2) * (1 - mg));
            col = mix3(col, d < 14 ? COL.mud : COL.mang, mg);
          }
          /* (and the hills' light and shade) */
          const e = 2 * cell, dx = (lerpAt(HH, fi + 1, fj) - lerpAt(HH, fi - 1, fj)) / e, dz = (lerpAt(HH, fi, fj + 1) - lerpAt(HH, fi, fj - 1)) / e, nl = 1 / Math.sqrt(1 + dx * dx + dz * dz);
          const lit = Math.max(0.5, Math.min(1.4, ((-dx * Lx + Ly - dz * Lz) * nl) / flat));
          col = [col[0] * lit, col[1] * lit, col[2] * lit];
        }
        const o = (r * W + q) * 4; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255;
      }
      /* (a few rows at a time, so a frame's share of the work stays within its few milliseconds even on a slow phone) */
      if (r % 3 === 2) yield;
    }
    cx.putImageData(img, 0, 0);
    /* what is laid on it: the creeks, the trails, the jetty and the ranger's hut (where the island's world has them) */
    const P = (x, z) => [(ZW - z) / M, (x - X0) / M], Wd = Engine.world || {};
    cx.lineCap = cx.lineJoin = 'round';
    /* (the creeks over the land only: their lines run on out to sea, where their water is the sea's) */
    for (const st of I.STREAMS || []) {
      const p = st.pts; if (!p || p.length < 2) continue;
      const Q = []; for (let i = 0; i < p.length - 1; i++) { const [xa, za] = p[i], [xb, zb] = p[i + 1], m = Math.max(1, Math.ceil(Math.hypot(xb - xa, zb - za) / 4)); for (let k = 0; k < m; k++) Q.push([xa + (xb - xa) * k / m, za + (zb - za) * k / m]); }
      Q.push(p[p.length - 1]);
      cx.beginPath(); let down = false;
      for (const [x, z] of Q) { const land = I.sdf(x, z) < -1, [u, v] = P(x, z); if (land) { down ? cx.lineTo(u, v) : cx.moveTo(u, v); down = true; } else down = false; }
      cx.strokeStyle = KEY.creek; cx.lineWidth = 1.6; cx.globalAlpha = 0.9; cx.stroke(); cx.globalAlpha = 1;
    }
    const trails = (Wd.trails && Wd.trails.trails) || [];
    for (const t of trails) {
      if (!t.n) continue;
      cx.beginPath(); for (let i = 0; i < t.n; i += 2) { const [u, v] = P(t.X[i], t.Z[i]); i ? cx.lineTo(u, v) : cx.moveTo(u, v); }
      cx.strokeStyle = 'rgba(20, 24, 18, 0.55)'; cx.lineWidth = 3; cx.stroke();
      cx.strokeStyle = KEY.trail; cx.lineWidth = 1.4; cx.setLineDash(t.id === 'creek' ? [] : [4, 2.5]); cx.stroke(); cx.setLineDash([]);
    }
    const plan = Wd.park && Wd.park.plan;
    if (plan && plan.jetty) {
      const j = plan.jetty, len = j.len || 30, [u0, v0] = P(j.x, j.z), [u1, v1] = P(j.x + (j.nx || 0) * len, j.z + (j.nz || 0) * len);
      cx.beginPath(); cx.moveTo(u0, v0); cx.lineTo(u1, v1); cx.strokeStyle = KEY.jetty; cx.lineWidth = 2.6; cx.stroke();
    }
    if (plan && plan.hut) {
      const h = plan.hut, [u, v] = P(h.x, h.z);
      cx.save(); cx.translate(u, v); cx.rotate(-(h.yaw || 0)); cx.fillStyle = KEY.hut; cx.strokeStyle = 'rgba(20, 20, 18, 0.8)'; cx.lineWidth = 1; cx.fillRect(-2.6, -2, 5.2, 4); cx.strokeRect(-2.6, -2, 5.2, 4); cx.restore();
    }
    /* the beach huts (huts.js), each a little roof; the work hut named */
    const HU = Engine.huts;
    if (HU) for (const h of HU.huts) {
      const [u, v] = P(h.p.x, h.p.z);
      cx.save(); cx.translate(u, v); cx.rotate(-h.p.ry); cx.fillStyle = KEY.hut; cx.strokeStyle = 'rgba(20, 20, 18, 0.85)'; cx.lineWidth = 1; cx.fillRect(-3, -2.4, 6, 4.8); cx.strokeRect(-3, -2.4, 6, 4.8); cx.restore();
    }
    /* (the places to name on the whole map) */
    const labels = [['Camp', Layout.camp.x, Layout.camp.z, 'camp']];
    if (HU) for (const h of HU.huts) if (h.p.kind === 'work') labels.push(['Work hut', h.p.x, h.p.z, 'below']);
    if (plan && plan.jetty) labels.push(['Jetty', plan.jetty.x, plan.jetty.z]);
    if (plan && plan.hut) labels.push(['Ranger hut', plan.hut.x, plan.hut.z]);
    for (const t of trails) if (t.n > 10) { const i = Math.floor(t.n * 0.5); labels.push([t.name, t.X[i], t.Z[i], 'trail']); }
    return { canvas: c, ZW, X0, M, W, H, labels };
  }

  /* where a world point lands on a map centred on (cx, cz), mpp metres a pixel: east (−z) to the right, south (+x) down */
  const toMap = (V, x, z) => [V.w / 2 + (V.cz - z) / V.mpp, V.h / 2 + (x - V.cx) / V.mpp];

  /* the coast round you, drawn as you go: the sea, the beach between the water's edge and the forest's, the forest, the
     headlands' rock, the reefs */
  function paintCoast(c, V) {
    const x0 = V.cx - V.h / 2 * V.mpp - 20, x1 = V.cx + V.h / 2 * V.mpp + 20, step = Math.max(2, V.mpp * 3), xs = [];
    for (let x = x0; x <= x1 + step; x += step) xs.push(x);
    c.fillStyle = rgb(COL.forest); c.fillRect(0, 0, V.w, V.h);
    /* (the forest a little lighter at its front, where the palms are) */
    const line = f => { c.beginPath(); xs.forEach((x, i) => { const [u, v] = toMap(V, x, f(x)); i ? c.lineTo(u, v) : c.moveTo(u, v); }); };
    const band = (fa, fb, fill) => { c.beginPath(); xs.forEach((x, i) => { const [u, v] = toMap(V, x, fa(x)); i ? c.lineTo(u, v) : c.moveTo(u, v); });
      for (let i = xs.length - 1; i >= 0; i--) { const [u, v] = toMap(V, xs[i], fb(xs[i])); c.lineTo(u, v); } c.closePath(); c.fillStyle = fill; c.fill(); };
    band(x => Layout.vegZ(x) + 14, x => Layout.vegZ(x), rgb(COL.fringe));
    band(x => Layout.vegZ(x), x => Layout.shoreZ(x), rgb(COL.sand));
    /* the sea: from the water's edge out, deeper further out (east, −z: to the right) */
    { const [us] = toMap(V, V.cx, Layout.shoreZ(V.cx)), gr = c.createLinearGradient(us, 0, us + 900 / V.mpp, 0);
      gr.addColorStop(0, rgb(COL.shallow)); gr.addColorStop(0.06, rgb(COL.shelf)); gr.addColorStop(0.3, rgb(mix3(COL.shelf, COL.deep, 0.6))); gr.addColorStop(1, rgb(COL.deep));
      band(x => Layout.shoreZ(x), x => Layout.shoreZ(x) - 6000, gr); }
    /* (the swash: a pale line along the water's edge) */
    line(x => Layout.shoreZ(x)); c.strokeStyle = rgb(COL.surf); c.lineWidth = Math.max(1, 2 / V.mpp); c.stroke();
    /* the headlands: rock from the water's edge back into the forest */
    for (const h of Layout.heads(x0, x1)) {
      const w = h.w || 16, a = h.hx - w * 1.1, b = h.hx + w * 1.1, hx = []; for (let x = a; x <= b; x += Math.max(1, step / 2)) hx.push(x);
      c.beginPath(); hx.forEach((x, i) => { const [u, v] = toMap(V, x, Layout.shoreZ(x) + 1.5); i ? c.lineTo(u, v) : c.moveTo(u, v); });
      for (let i = hx.length - 1; i >= 0; i--) { const x = hx[i], k = Math.exp(-(((x - h.hx) / w) ** 2) * 1.3), [u, v] = toMap(V, x, Layout.vegZ(x) + 6 + 34 * k); c.lineTo(u, v); }
      c.closePath(); c.fillStyle = rgb(COL.rock); c.globalAlpha = 0.92; c.fill(); c.globalAlpha = 1;
    }
    /* the reefs out from the beach */
    const W = Engine.world;
    if (W && W.reefLines) for (const R of W.reefLines(V.cx)) {
      if (!R || R.length < 2) continue;
      c.beginPath(); R.forEach((p, i) => { const [u, v] = toMap(V, p[0], p[1]); i ? c.lineTo(u, v) : c.moveTo(u, v); });
      c.strokeStyle = rgb(COL.rock); c.lineCap = 'round'; c.lineWidth = Math.max(1.5, 2 * (R[0][3] || 1.5) / V.mpp); c.stroke();
    }
    /* the beach huts (huts.js), each a little roof, the work hut named */
    const HU = Engine.huts;
    if (HU) for (const h of HU.huts) {
      const [u, v] = toMap(V, h.p.x, h.p.z), s = Math.max(1, 1.6 / Math.max(V.mpp, 0.4)) * V.dpr;
      c.save(); c.translate(u, v); c.rotate(-h.p.ry); c.fillStyle = KEY.hut; c.strokeStyle = 'rgba(20, 20, 18, 0.85)'; c.lineWidth = V.dpr; c.fillRect(-3 * s, -2.4 * s, 6 * s, 4.8 * s); c.strokeRect(-3 * s, -2.4 * s, 6 * s, 4.8 * s); c.restore();
      if (h.p.kind === 'work') { c.font = `600 ${11 * V.dpr}px 'Instrument Sans', Arial, sans-serif`; c.textAlign = 'center'; c.fillStyle = 'rgba(255, 246, 228, 0.92)'; c.strokeStyle = 'rgba(12, 14, 12, 0.7)'; c.lineWidth = 3 * V.dpr; c.strokeText('Work hut', u, v + 16 * V.dpr); c.fillText('Work hut', u, v + 16 * V.dpr); }
    }
  }

  /* the island's picture under a map's view (the open sea round it) */
  function paintIsle(c, V) {
    c.fillStyle = rgb(COL.deep); c.fillRect(0, 0, V.w, V.h);
    if (!base) return;
    /* (the base's pixel under the map's corner, and how many of its pixels the map's width takes) */
    const [u0, v0] = [(base.ZW - (V.cz + V.w / 2 * V.mpp)) / base.M, (V.cx - V.h / 2 * V.mpp - base.X0) / base.M], sw = V.w * V.mpp / base.M, sh = V.h * V.mpp / base.M;
    /* (only the part of the picture there is: some browsers draw nothing when asked for more) */
    const a0 = Math.max(0, u0), b0 = Math.max(0, v0), a1 = Math.min(base.W, u0 + sw), b1 = Math.min(base.H, v0 + sh); if (a1 <= a0 || b1 <= b0) return;
    const kx = V.w / sw, ky = V.h / sh;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(base.canvas, a0, b0, a1 - a0, b1 - b0, (a0 - u0) * kx, (b0 - v0) * ky, (a1 - a0) * kx, (b1 - b0) * ky);
  }

  /* the markers: the camp, the van, you (a dot, and a wedge the way you face) */
  function marks(c, V, big) {
    const S = state, k = big ? 1.25 : 1, dp = V.dpr;
    const [cu, cv2] = toMap(V, Layout.camp.x, Layout.camp.z);
    c.beginPath(); c.arc(cu, cv2, 5.5 * k * dp, 0, TAU); c.fillStyle = 'rgba(242, 183, 105, 0.22)'; c.fill();
    c.beginPath(); c.arc(cu, cv2, 3.2 * k * dp, 0, TAU); c.fillStyle = KEY.camp; c.fill(); c.lineWidth = 1.2 * dp; c.strokeStyle = 'rgba(30, 20, 10, 0.8)'; c.stroke();
    if (S.van && !S.driving) {
      const [vu, vv] = toMap(V, S.van.x, S.van.z);
      /* (its front, (cos h, −sin h) in the world, is (sin h, cos h) on the map) */
      c.save(); c.translate(vu, vv); c.rotate(Math.atan2(Math.cos(S.van.heading), Math.sin(S.van.heading)));
      c.fillStyle = KEY.van; c.strokeStyle = 'rgba(10, 20, 24, 0.85)'; c.lineWidth = 1 * dp; rrect(c, -4.5 * k * dp, -2.4 * k * dp, 9 * k * dp, 4.8 * k * dp, 1.6 * dp); c.fill(); c.stroke(); c.restore();
    }
    /* you: where the camera stands (or the van you drive), the way it faces */
    const [yu, yv] = toMap(V, S.you.x, S.you.z), ang = Math.atan2(S.you.fx, -S.you.fz), R = (big ? 46 : 30) * dp;
    const gr = c.createRadialGradient(yu, yv, 0, yu, yv, R); gr.addColorStop(0, 'rgba(255, 255, 255, 0.55)'); gr.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.beginPath(); c.moveTo(yu, yv); c.arc(yu, yv, R, ang - 0.55, ang + 0.55); c.closePath(); c.fillStyle = gr; c.fill();
    if (S.driving) {
      /* (the van you drive, its nose the way it goes) */
      c.save(); c.translate(yu, yv); c.rotate(ang);
      c.fillStyle = KEY.van; c.strokeStyle = '#fff'; c.lineWidth = 1.4 * dp; rrect(c, -5 * k * dp, -2.8 * k * dp, 10 * k * dp, 5.6 * k * dp, 1.8 * dp); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(5 * k * dp, -2 * k * dp); c.lineTo(8.5 * k * dp, 0); c.lineTo(5 * k * dp, 2 * k * dp); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.restore();
    } else {
      c.beginPath(); c.arc(yu, yv, 4.4 * k * dp, 0, TAU); c.fillStyle = KEY.you; c.fill(); c.lineWidth = 2 * dp; c.strokeStyle = 'rgba(12, 16, 26, 0.9)'; c.stroke();
    }
  }

  /* the names on the whole map */
  function names(c, V) {
    if (!base || !base.labels) { const [cu, cv2] = toMap(V, Layout.camp.x, Layout.camp.z); label(c, V, 'Camp', cu, cv2 - 12 * V.dpr, true); return; }
    for (const [t, x, z, kind] of base.labels) { const [u, v] = toMap(V, x, z); label(c, V, t, u, v + (kind === 'trail' ? 0 : kind === 'below' ? 13 * V.dpr : -12 * V.dpr), kind === 'camp', kind === 'trail'); }
  }
  function label(c, V, t, u, v, strong, small) {
    c.font = `${small ? 500 : 600} ${(small ? 10.5 : 12) * V.dpr}px 'JetBrains Mono', ui-monospace, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3.2 * V.dpr; c.strokeStyle = 'rgba(8, 11, 18, 0.82)'; c.strokeText(t, u, v);
    c.fillStyle = strong ? KEY.camp : small ? 'rgba(234, 220, 182, 0.92)' : '#ece6da'; c.fillText(t, u, v);
  }
  /* a scale bar: the roundest length near a fifth of the map's width */
  function scale(c, V) {
    const want = V.w * V.mpp / 5, p = Math.pow(10, Math.floor(Math.log10(want))), m = [1, 2, 5, 10].map(k => k * p).reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a), L = m / V.mpp, x = 10 * V.dpr, y = V.h - 10 * V.dpr;
    c.strokeStyle = 'rgba(8, 11, 18, 0.7)'; c.lineWidth = 4 * V.dpr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y); c.stroke();
    c.strokeStyle = '#ece6da'; c.lineWidth = 1.6 * V.dpr; c.beginPath(); c.moveTo(x, y); c.lineTo(x + L, y); c.stroke();
    c.font = `500 ${10 * V.dpr}px 'JetBrains Mono', ui-monospace, monospace`; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.lineWidth = 3 * V.dpr; c.strokeStyle = 'rgba(8, 11, 18, 0.8)';
    const t = m >= 1000 ? `${m / 1000} km` : `${m} m`; c.strokeText(t, x, y - 4 * V.dpr); c.fillStyle = '#ece6da'; c.fillText(t, x, y - 4 * V.dpr);
  }

  /* how far, and which way, you are from the camp, in words */
  function whereWords() {
    const S = state, dx = S.you.x - Layout.camp.x, dz = S.you.z - Layout.camp.z, d = Math.hypot(dx, dz);
    if (d < 25) return 'You are at the camp.';
    const a = (Math.atan2(dz, -dx) / TAU * 8 + 8.5 | 0) % 8, dirs = ['north', 'north-west', 'west', 'south-west', 'south', 'south-east', 'east', 'north-east'];
    return `You are ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 10) * 10 + ' m'} ${dirs[a]} of the camp.`;
  }

  function size(c, wCss, hCss) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(wCss * dpr), h = Math.round(hCss * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return dpr;
  }

  function drawSmall() {
    const r = btn.getBoundingClientRect(); if (!r.width) return;
    const dpr = size(cv, r.width, r.height), S = state, span = isle ? 380 : 520;
    const V = { w: cv.width, h: cv.height, cx: S.you.x, cz: S.you.z, mpp: span / cv.width, dpr };
    (isle ? paintIsle : paintCoast)(g, V); marks(g, V, false);
  }
  function drawBig() {
    const S = state, maxW = Math.min(window.innerWidth * 0.92, 760) - 32, maxH = window.innerHeight * 0.92 - 150;
    let V;
    if (isle && !base) {
      /* (the island's picture is still being drawn: a moment) */
      const w = Math.min(maxW, 360), h = w * 1.4; bcv.style.width = w + 'px'; bcv.style.height = h + 'px';
      const dpr = size(bcv, w, h); bg.fillStyle = rgb(COL.deep); bg.fillRect(0, 0, bcv.width, bcv.height);
      bg.font = `500 ${12 * dpr}px 'JetBrains Mono', ui-monospace, monospace`; bg.textAlign = 'center'; bg.fillStyle = '#a7afbf'; bg.fillText('Drawing the map…', bcv.width / 2, bcv.height / 2);
      document.getElementById('mbNote').textContent = whereWords(); return;
    }
    if (isle) {
      /* (the whole island, a margin of sea round it) */
      const aspect = base.W / base.H; let h = maxH, w = h * aspect; if (w > maxW) { w = maxW; h = w / aspect; }
      bcv.style.width = w + 'px'; bcv.style.height = h + 'px';
      const dpr = size(bcv, w, h); V = { w: bcv.width, h: bcv.height, cx: base.X0 + base.H * base.M / 2, cz: base.ZW - base.W * base.M / 2, mpp: base.W * base.M / bcv.width, dpr };
      paintIsle(bg, V);
    } else {
      /* (along the coast: the stretch two and a half kilometres long round you) */
      const aspect = 0.62; let h = maxH, w = h * aspect; if (w > maxW) { w = maxW; h = w / aspect; }
      bcv.style.width = w + 'px'; bcv.style.height = h + 'px';
      const dpr = size(bcv, w, h); V = { w: bcv.width, h: bcv.height, cx: S.you.x, cz: S.you.z - 0.25 * 2500 * aspect, mpp: 2500 / bcv.height, dpr };
      paintCoast(bg, V);
    }
    names(bg, V); marks(bg, V, true); scale(bg, V);
    document.getElementById('mbNote').textContent = whereWords();
  }

  function setOpen(v) {
    open = v; dlg.hidden = !v; btn.setAttribute('aria-expanded', String(v));
    if (v) { lastBig = 0; drawBig(); document.getElementById('mbClose').focus(); } else btn.focus();
  }

  /* the markup is the page's (index.html): the corner's button and its canvas, the whole map's dialog */
  function init() {
    isle = !!Layout.isle;
    btn = document.getElementById('map'); cv = document.getElementById('mapC'); g = cv.getContext('2d');
    dlg = document.getElementById('mapBig'); bcv = document.getElementById('mapBC'); bg = bcv.getContext('2d');
    document.getElementById('mbTitle').textContent = isle ? 'The island' : 'The coast';
    const key = [['You', KEY.you, 'dot'], ['Camp', KEY.camp, 'dot'], ['Van', KEY.van, 'bar']].concat(isle ? [['Huts', KEY.hut, 'bar'], ['Beach', rgb(COL.sand), 'bar'], ['Forest', rgb(COL.forest), 'bar']] : [['Huts', KEY.hut, 'bar'], ['Beach', rgb(COL.sand), 'bar']]);
    document.getElementById('mbKey').innerHTML = key.map(([t, c, s]) => `<li><i class="${s}" style="--c:${c}"></i>${t}</li>`).join('');
    btn.addEventListener('click', () => setOpen(!open));
    document.getElementById('mbClose').addEventListener('click', () => setOpen(false));
    dlg.addEventListener('click', e => { if (e.target === dlg) setOpen(false); });
    window.addEventListener('keydown', e => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }, true);
    window.addEventListener('resize', () => { if (open) drawBig(); });
    if (isle) job = islandBase();
  }
  /* each frame: where you are (the camera, or the van you drive) and the van; the island's picture a slice at a time
     until it is drawn; the corner redrawn ten times a second, the whole map while it is open */
  const fw = new THREE.Vector3();
  function frame(o) {
    if (!btn) return;
    /* (the island's picture: a few milliseconds of a frame, more where frames are slow anyway — a sixth of one, up to 60) */
    const tn = performance.now(), fdt = lastF ? tn - lastF : 16; lastF = tn;
    if (job) { const t0 = performance.now(), bud = Math.max(4, Math.min(60, fdt / 6)); let r; do r = job.next(); while (!r.done && performance.now() - t0 < bud); if (r.done) { base = r.value; job = null; if (open) drawBig(); } }
    const cam = Engine.camera; cam.getWorldDirection(fw);
    const driving = !!o.driving, van = o.van, fl = Math.hypot(fw.x, fw.z) || 1;
    state = { you: driving && van ? { x: van.x, z: van.z, fx: Math.cos(van.heading), fz: -Math.sin(van.heading) } : { x: cam.position.x, z: cam.position.z, fx: fw.x / fl, fz: fw.z / fl }, van, driving };
    const hide = !shown || !!o.hide;
    btn.hidden = hide; if (hide && open) setOpen(false);
    const now = performance.now();
    if (!hide && now - lastT > 100) { lastT = now; drawSmall(); }
    if (open && now - lastBig > 120) { lastBig = now; drawBig(); }
  }
  const show = v => { shown = !!v; if (btn) btn.hidden = !shown; };
  return { init, frame, show, get ready() { return !isle || !!base; }, get open() { return open; } };
})();
