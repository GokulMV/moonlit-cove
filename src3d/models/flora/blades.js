/* ─────────────────────────────────────────────────────────────
   models/flora/blades.js — big leaves, as real blades rather than
   sprays on cards: a fern's frond, every pinna cut into lobes; a
   bird's nest fern's glossy strap; a palm's feather leaf; a fan
   palm's pleated segments; an elephant ear's arrowhead with its
   pale ribs; a ginger's long leaf; a pandan's keeled, spiny strap.
   FloraBlade.tex(kind, o) paints one: its colour with its outline
   in the alpha, and its relief (ribs, folds, veins, a ruffled
   edge) as a height field turned into a normal map.
   FloraBlade.ribbon(spine, o) lays a blade along a curved spine,
   folded, cupped and twisted, each half shaded as it lies, with
   what the leaf shader (leaves.js) needs: its frame for the normal
   map, how deep in the plant it is, how free to flutter, its wind.
   ───────────────────────────────────────────────────────────── */
const FloraBlade = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hsla = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${(clamp(s) * 100).toFixed(1)}%,${(clamp(l) * 100).toFixed(1)}%,${a})`;
  const grey = (v, a = 1) => { const q = Math.round(clamp(v / 255) * 255); return `rgba(${q},${q},${q},${a})`; };
  /* hsl (degrees, 0..1, 0..1) as [r, g, b] 0..255 */
  function rgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s = clamp(s); l = clamp(l);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const path = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
  /* a line along pts (canvas px) whose width is w(t), filled as an outline so it tapers cleanly */
  function taper(c, pts, w, style) {
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)]; let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const hw = Math.max(0.25, w(i / (n - 1)) / 2); L.push([p[0] - ty * hw, p[1] + tx * hw]); R.push([p[0] + ty * hw, p[1] - tx * hw]);
    }
    c.fillStyle = style; path(c, L.concat(R.reverse())); c.fill();
  }
  /* a smooth curve through the points P (Catmull-Rom), n samples between each pair */
  function cr2(P, n) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
    }
    out.push(P[P.length - 1].slice()); return out;
  }
  /* a leaflet's (or pinna's) outline in canvas px: its midrib from O heading d for L, bending toward ac (the side toward
     the frond's tip) by bend; its half-widths hA(u) on that side and hB(u) on the other. { A, B, C (the midrib), poly } */
  function leaflet(O, d, ac, L, bend, hA, hB, steps) {
    const A = [], B = [], C = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, x = O[0] + d[0] * L * u + ac[0] * L * bend * u * u, y = O[1] + d[1] * L * u + ac[1] * L * bend * u * u;
      let tx = d[0] + ac[0] * bend * 2 * u, ty = d[1] + ac[1] * bend * 2 * u; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let nx = -ty, ny = tx; if (nx * ac[0] + ny * ac[1] < 0) { nx = -nx; ny = -ny; }
      const a = hA(u), b = hB(u); A.push([x + nx * a, y + ny * a]); B.push([x - nx * b, y - ny * b]); C.push([x, y]);
    }
    return { A, B, C, poly: A.concat(B.slice().reverse()) };
  }
  /* a painter that works pixel by pixel: f(x, y) returns [r, g, b, alpha 0..1, height 0..255] or null */
  function pix(a, h, W, H, f) {
    const ci = a.createImageData(W, H), hi = h.getImageData(0, 0, W, H), C = ci.data, D = hi.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = f(x + 0.5, y + 0.5); if (!v) continue; const i = (y * W + x) * 4;
      C[i] = v[0]; C[i + 1] = v[1]; C[i + 2] = v[2]; C[i + 3] = clamp(v[3]) * 255; D[i] = D[i + 1] = D[i + 2] = mix(D[i], v[4], clamp(v[3] * 1.5));
    }
    a.putImageData(ci, 0, 0); h.putImageData(hi, 0, 0);
  }

  /* ── the painters. Each paints on W × H canvases — the colour (a), a base normal (b, mostly left flat), the relief
     (h: grey, 128 level) — the blade's base at the bottom (y = H), its tip at the top, its midrib up the middle ── */
  const P = {
    /* a fern's frond: pinnae up a rachis, close-set, each lanceolate and curving a little toward the frond's tip, its
       margin cut into lobes (o.cut: 0 barely toothed … 1 cut to the midrib, the frond twice-divided); the frond widest
       some way up (o.widest) and narrowing to a long pointed tip; a bare stipe at its foot (o.stipe), scaly (o.scales) */
    fern: { W: 512, H: 1024, blur: 1.1, bump: 5, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 100, sat = o.sat ?? 0.48, lig = o.light ?? 0.27, n = o.pinnae || 30, cut = o.cut ?? 0.7;
      const st = o.stipe ?? 0.06, wm = o.widest ?? 0.4, a0 = o.ang ?? 1.3, a1 = o.angTip ?? 0.75, fill = o.fill ?? 0.9, fal = o.fal ?? 0.14, dead = !!o.dead;
      const Lf = H - 6, M = W / 2 - 3, span = 0.985 - st;
      const prof = s => s < wm ? (o.base ?? 0.45) + (1 - (o.base ?? 0.45)) * Math.sin(Math.PI / 2 * s / wm) : Math.pow(Math.max(0, Math.cos(Math.PI / 2 * (s - wm) / (1 - wm))), 0.85);
      const pins = []; for (const sd of [-1, 1]) for (let i = 0; i < n; i++) pins.push({ sd, s: clamp((i + 0.5 + sd * 0.22 * (o.alt ?? 1)) / n) });
      for (const { sd, s } of pins) {
        if (dead && r() < 0.2) continue;
        const t = st + span * s, y0 = H - 3 - t * Lf, an = mix(a0, a1, s) + (r() - 0.5) * 0.07;
        let L = M * prof(s) * (0.93 + 0.1 * r()); if (dead) L *= 0.5 + 0.45 * r(); if (L < 2) continue;
        const dy = span / n * Lf, Wp = Math.max(2, dy * Math.sin(an) * fill * (0.94 + 0.12 * r()));
        const d = [sd * Math.sin(an), -Math.cos(an)], ac = [-sd * Math.cos(an), -Math.sin(an)];
        const m = Math.max(2, Math.round(L / (Wp * (o.lobe ?? 0.5)))), steps = Math.min(260, Math.max(16, m * 10));
        const hw = u => Wp / 2 * Math.pow(Math.max(0, 1 - Math.pow(u, 2.3)), 0.55) * (u < 0.05 ? 0.7 + 6 * u : 1);
        /* (each lobe rises gently toward the pinna's tip and drops steeply to the cut before the next: lobes that lean forward) */
        const lob = (u, ph) => { const f = (u * m + ph) % 1, bp = f < 0.62 ? Math.sin(Math.PI / 2 * f / 0.62) : Math.cos(Math.PI / 2 * (f - 0.62) / 0.38); return 1 - cut * (1 - Math.pow(Math.max(0, bp), o.lobeRound ?? 0.45)) * sm(0, 0.08, u); };
        const lf = leaflet([cx + sd * 1.2, y0], d, ac, L, fal, u => hw(u) * lob(u, 0), u => hw(u) * lob(u, 0.5), steps);
        const lh = hue + (r() - 0.5) * 7 + (dead ? 0 : 4 * s), ll = lig * (0.9 + 0.2 * r()) * (1 + 0.1 * s);
        a.fillStyle = hsla(lh, sat, ll); path(a, lf.poly); a.fill();
        h.fillStyle = grey(156); path(h, lf.poly); h.fill();
        taper(h, lf.C, u => Math.max(1.2, Wp * 0.5) * (1 - 0.6 * u), grey(170, 0.55));
        taper(h, lf.C, u => Math.max(0.6, Wp * 0.07), grey(146));
        taper(a, lf.C, u => Math.max(0.65, Wp * 0.075) * (1 - 0.7 * u), hsla(lh - 16, sat * 0.8, ll * 1.35, 0.75));
        /* (a vein out into each lobe) */
        a.strokeStyle = hsla(lh - 12, sat * 0.8, ll * 1.3, 0.4); a.lineWidth = 0.55; a.beginPath();
        for (let j = 0; j < m; j++) { const u = (j + 0.4) / m; if (u > 0.9) break; const k = Math.round(u * steps), c0 = lf.C[k], k2 = Math.min(steps, k + Math.max(1, Math.round(steps / m * 0.35))), pa = lf.A[k2], pb = lf.B[k2]; a.moveTo(c0[0], c0[1]); a.lineTo(mix(c0[0], pa[0], 0.78), mix(c0[1], pa[1], 0.78)); a.moveTo(c0[0], c0[1]); a.lineTo(mix(c0[0], pb[0], 0.78), mix(c0[1], pb[1], 0.78)); }
        a.stroke();
        /* (now and then a pinna browned at its tip) */
        if (!dead && r() < 0.05) { const k = Math.floor(steps * (0.6 + 0.3 * r())); a.fillStyle = hsla(32, 0.42, 0.3, 0.9); path(a, lf.A.slice(k).concat(lf.B.slice(k).reverse())); a.fill(); }
      }
      /* the rachis, and below the pinnae the stipe: darker, scaly toward its foot */
      const rw = o.rw ?? 5, rach = []; for (let i = 0; i <= 60; i++) { const t = i / 60; rach.push([cx, H - 1 - t * (H - 4)]); }
      taper(h, rach, t => rw * 1.7 * (1 - 0.7 * t), grey(186, 0.85));
      taper(a, rach, t => rw * (1 - 0.78 * t), dead ? hsla(28, 0.35, 0.22) : hsla(o.rachisHue ?? 62, 0.35, 0.26));
      const nb = Math.max(2, Math.ceil(60 * (st + 0.05))); taper(a, rach.slice(0, nb), t => rw * 1.04 * (1 - 0.1 * t), hsla(24, 0.32, 0.16));
      taper(a, rach, t => rw * 0.24 * (1 - 0.7 * t), hsla(o.rachisHue ?? 62, 0.3, 0.42, 0.55));
      if (o.scales) { a.fillStyle = 'rgba(52,34,18,0.92)'; for (let i = 0; i < 90; i++) { const t = Math.pow(r(), 1.7) * (st + 0.3), y = H - 3 - t * Lf, sd = r() < 0.5 ? -1 : 1, w = rw * (1 - 0.78 * t) / 2; a.beginPath(); a.moveTo(cx + sd * w * 0.6, y); a.lineTo(cx + sd * (w + 2 + 2.5 * r()), y - 1.5 - r() * 2.5); a.lineTo(cx + sd * w * 0.6, y - 2.4); a.closePath(); a.fill(); } }
    } },
    /* a palm's feather leaf: leaflets up a rachis, regularly or in fanned groups (o.groups), each narrow, lanceolate,
       folded up along its midrib, its tip sometimes browned; spines on the rachis (o.spines, a rattan's) */
    palm: { W: 256, H: 1024, blur: 0.9, bump: 5, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 95, sat = o.sat ?? 0.45, lig = o.light ?? 0.29, n = o.leaflets || 34, st = o.stipe ?? 0.07;
      const a0 = o.ang ?? 1.05, a1 = o.angTip ?? a0 * 0.62, lw = o.lw ?? 0.06, bend = o.bend ?? 0.07, Lf = H - 6, M = W / 2 - 2, span = 0.985 - st;
      const len = s => Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + s * 0.92)), 0.5) * (1 - 0.28 * s);
      const pos = [];
      if (o.groups) { let s = 0.01; while (s < 0.99) { const g = o.groups[0] + Math.floor(r() * (o.groups[1] - o.groups[0] + 1)); for (let k = 0; k < g && s < 0.99; k++) { pos.push([s, (k - (g - 1) / 2) * 0.2]); s += 0.4 / n; } s += (1.2 + 1.2 * r()) / n; } }
      else for (let i = 0; i < n; i++) pos.push([(i + 0.5) / n, 0]);
      for (const sd of [-1, 1]) for (const [s0, fan] of pos) {
        const s = clamp(s0 + sd * 0.25 / n + (r() - 0.5) * 0.15 / n), t = st + span * s, y0 = H - 3 - t * Lf;
        const an = mix(a0, a1, s) + fan * sd + (r() - 0.5) * 0.06, L = M * len(s) * (0.9 + 0.14 * r()), Wl = Math.max(2.5, lw * W * (0.75 + 0.45 * len(s)) * (0.9 + 0.2 * r()));
        if (o.torn && r() < o.torn) continue;
        const d = [sd * Math.sin(an), -Math.cos(an)], ac = [-sd * Math.cos(an), -Math.sin(an)];
        const hw = u => Wl / 2 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 0.62))), 0.8);
        const lf = leaflet([cx + sd * 1.5, y0], d, ac, L, bend, hw, hw, 30);
        const lh = hue + (r() - 0.5) * 8, ll = lig * (0.88 + 0.22 * r());
        a.fillStyle = hsla(lh, sat, ll); path(a, lf.poly); a.fill();
        h.fillStyle = grey(156); path(h, lf.poly); h.fill();
        taper(h, lf.C, () => Math.max(0.8, Wl * 0.24), grey(126));
        taper(a, lf.C, u => Math.max(0.7, Wl * 0.11) * (1 - 0.6 * u), hsla(lh - 15, sat * 0.75, ll * 1.45, 0.85));
        if (r() < (o.brown ?? 0.1)) { const k = Math.floor(30 * (0.7 + 0.22 * r())); a.fillStyle = hsla(34, 0.42, 0.34, 0.95); path(a, lf.A.slice(k).concat(lf.B.slice(k).reverse())); a.fill(); }
      }
      const rw = o.rw ?? 6, rach = []; for (let i = 0; i <= 60; i++) rach.push([cx, H - 1 - i / 60 * (H - 4)]);
      taper(h, rach, t => rw * 1.6 * (1 - 0.72 * t), grey(184, 0.85));
      taper(a, rach, t => rw * (1 - 0.72 * t), hsla(o.rachisHue ?? 60, 0.35, 0.28));
      taper(a, rach, t => rw * 0.3 * (1 - 0.72 * t), hsla(o.rachisHue ?? 60, 0.3, 0.4, 0.6));
      if (o.spines) { a.fillStyle = 'rgba(38,28,16,0.95)'; for (let i = 0; i < 220; i++) { const t = r(), y = H - 3 - t * Lf, sd = r() < 0.5 ? -1 : 1, w = rw * (1 - 0.72 * t) / 2, l = 3 + 4 * r(); a.beginPath(); a.moveTo(cx + sd * w * 0.7, y); a.lineTo(cx + sd * (w + l), y - l * 0.7); a.lineTo(cx + sd * w * 0.7, y - 1.6); a.closePath(); a.fill(); } }
    } },
    /* a bird's nest fern's frond: undivided, bright apple green and glossy, widest well up and narrowing to a long base,
       a dark midrib, fine close veins running out to an edge that ruffles up and down */
    strap: { W: 256, H: 1024, blur: 1.0, bump: 5, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 90, sat = o.sat ?? 0.55, lig = o.light ?? 0.37, ph = r() * 9, brown = r() < (o.brown ?? 0.35), Wm = W / 2 - 3;
      const wid = t => Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.pow(Math.max(t, 0), 1.22) * 1.015))), 0.55) * (1 - 0.12 * t);
      const mid = rgb(30, 0.35, 0.09), midT = rgb(hue - 25, 0.4, 0.24);
      pix(a, h, W, H, (x, y) => {
        const t = 1 - y / H, w = wid(t) * Wm * (1 + 0.025 * Math.sin(t * 47 + ph)) + 0.5, dx = x - cx, q = Math.abs(dx) / w, cov = w - Math.abs(dx) + 0.5; if (cov <= 0) return null;
        const sdp = dx < 0 ? 0 : 1.7, s = t * H - Math.abs(dx) * 0.62, vein = Math.pow(Math.abs(Math.cos(Math.PI * s / 3.6)), 6);
        let l = lig * (1 + 0.03 * sm(0.85, 1, q) - 0.05 * vein - 0.25 * (1 - sm(0.02, 0.2, t))) * (0.96 + 0.08 * Math.sin(t * 13 + ph));
        let c = rgb(hue + 4 * t - 6 * (1 - sm(0, 0.25, t)), sat, l);
        if (brown) { const k = sm(0.86, 0.97, t + 0.02 * Math.sin(dx * 0.3)); c = c.map((v, i) => mix(v, [118, 86, 44][i], k)); }
        const mw = 3.4 * (1 - 0.6 * t) + 0.6; if (Math.abs(dx) < mw) { const m = mix3(mid, midT, sm(0.15, 0.9, t)), k = sm(mw, mw - 1, Math.abs(dx)); c = c.map((v, i) => mix(v, m[i], k)); }
        const ht = 150 + 14 * (1 - q * q) - 22 * Math.exp(-((dx / (mw + 1.5)) ** 2)) + 24 * Math.sin(t * 64 + ph + sdp) * sm(0.55, 1, q) + 3 * vein;
        return [c[0], c[1], c[2], cov, ht];
      });
    } },
    /* a ginger's or another herb's leaf: elliptic and long, with a drawn-out drip tip; close parallel veins leaving the
       pale midrib at a slant and curving up toward the tip; a slight lean to one side; now and then a hole eaten out */
    lance: { W: 256, H: 1024, blur: 0.8, bump: 4, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 100, sat = o.sat ?? 0.42, lig = o.light ?? 0.27, asym = (r() - 0.5) * 0.1, ph = r() * 9, sp = o.vein ?? 9, Wm = W / 2 - 3;
      const wid = t => t <= 0 || t >= 1 ? 0 : Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.85))), 1.15) * (t < 0.03 ? 0.35 + 0.65 * t / 0.03 : 1);
      const midC = rgb(hue - 25, 0.4, lig * 1.6);
      pix(a, h, W, H, (x, y) => {
        const t = 1 - y / H, dx = x - cx, w0 = wid(t) * Wm, w = w0 * (dx < 0 ? 1 + asym : 1 - asym) * (1 + 0.012 * Math.sin(t * (dx < 0 ? 37 : 41) + ph)) + 0.3;
        const cov = w - Math.abs(dx) + 0.5; if (cov <= 0 || w < 0.6) return null; const q = Math.abs(dx) / w;
        const s = t * H - Math.abs(dx) * 1.9 - q * q * w * 1.4 + (dx < 0 ? sp * 0.37 : 0), vein = Math.pow(Math.abs(Math.cos(Math.PI * s / sp)), 8);
        let c = rgb(hue + 3 * t - 5 * q, sat, lig * (0.94 + 0.12 * t) * (1 + 0.1 * vein - 0.04 * q));
        const mw = 2.6 * (1 - 0.7 * t) + 0.5; if (Math.abs(dx) < mw) { const k = sm(mw, mw - 0.9, Math.abs(dx)); c = c.map((v, i) => mix(v, midC[i], k * 0.85)); }
        return [c[0], c[1], c[2], cov, 150 + 10 * (1 - q * q) - 18 * Math.exp(-((dx / (mw + 1)) ** 2)) + 10 * vein];
      });
      if (r() < (o.holes ?? 0.35)) for (let i = 0, k = 1 + Math.floor(r() * 2); i < k; i++) {
        const y = H * (0.25 + 0.55 * r()), t = 1 - y / H, x = cx + (r() < 0.5 ? -1 : 1) * wid(t) * Wm * (0.85 + 0.2 * r()), rr = 5 + r() * 9;
        a.fillStyle = hsla(35, 0.4, 0.3, 0.9); a.beginPath(); a.ellipse(x, y, rr + 1.5, rr * 1.4 + 1.5, r(), 0, TAU); a.fill();
        a.globalCompositeOperation = 'destination-out'; a.beginPath(); a.ellipse(x, y, rr, rr * 1.4, r(), 0, TAU); a.fill(); a.globalCompositeOperation = 'source-over';
      }
    } },
    /* a broad leaf of the dicot kind (a seedling's, a shrub's): elliptic, a drip tip, eight to twelve pairs of side veins
       leaving the pale midrib at a slant and curving up along the margin; young ones flushed red-brown and limp (o.flush) */
    dicot: { W: 256, H: 512, blur: 0.9, bump: 5, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, fl = o.flush || 0, hue = mix(o.hue ?? 100, 8, fl), sat = mix(o.sat ?? 0.42, 0.4, fl), lig = mix(o.light ?? 0.26, 0.3, fl), nv = o.veins ?? 10, asym = (r() - 0.5) * 0.1, ph = r() * 9, Wm = W / 2 - 3;
      const wid = t => t <= 0 || t >= 1 ? 0 : Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 0.9))), 0.8) * (t > 0.82 ? Math.pow((1 - t) / 0.18, 0.55) * 0.75 + 0.25 * (1 - t) / 0.18 : 1);
      const midC = rgb(hue - 22, 0.4, lig * 1.6);
      pix(a, h, W, H, (x, y) => {
        const t = 1 - y / H, dx = x - cx, w = wid(t) * Wm * (dx < 0 ? 1 + asym : 1 - asym) + 0.3, cov = w - Math.abs(dx) + 0.5; if (cov <= 0 || w < 0.6) return null; const q = Math.abs(dx) / w;
        const s = t * nv - q * 1.15 - q * q * 0.5 + (dx < 0 ? 0.31 : 0), vein = Math.pow(Math.abs(Math.cos(Math.PI * s)), 26) * (1 - sm(0.82, 1, q)), net = Math.pow(Math.abs(Math.cos(Math.PI * (t * nv * 3.7 + q * 2.3))), 18) * 0.35;
        let c = rgb(hue + 3 * t - 4 * q, sat, lig * (0.95 + 0.1 * t) * (1 + 0.12 * vein + 0.04 * net));
        const mw = 2.4 * (1 - 0.7 * t) + 0.6; if (Math.abs(dx) < mw) c = c.map((v, i) => mix(v, midC[i], sm(mw, mw - 1, Math.abs(dx)) * 0.85));
        return [c[0], c[1], c[2], cov, 150 + 10 * (1 - q * q) - 14 * Math.exp(-((dx / (mw + 1)) ** 2)) - 7 * vein];
      });
      if (r() < (o.holes ?? 0.4)) for (let i = 0, k = 1 + Math.floor(r() * 3); i < k; i++) { const y = H * (0.25 + 0.5 * r()), t = 1 - y / H, x = cx + (r() < 0.5 ? -1 : 1) * wid(t) * Wm * (0.2 + 0.7 * r()), rr = 3 + r() * 8;
        a.globalCompositeOperation = 'destination-out'; a.beginPath(); a.ellipse(x, y, rr, rr * 1.3, r(), 0, TAU); a.fill(); a.globalCompositeOperation = 'source-over'; }
    } },
    /* an elephant ear's blade (Alocasia): an arrowhead, its two lobes swept back past where the stalk joins (at y =
       0.72 H, in the notch between them), deep glossy green, the midrib, the ribs into the lobes and six or seven pairs
       of side ribs pale and sunk into the blade, the blade between them puckered */
    aroid: { W: 512, H: 512, blur: 1.6, bump: 6, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 104, sy = H * 0.72;
      const ctl = [[0, 0.02], [-0.06, 0.075], [-0.19, 0.16], [-0.32, 0.28], [-0.42, 0.42], [-0.465, 0.56], [-0.45, 0.69], [-0.4, 0.8], [-0.33, 0.895], [-0.26, 0.958], [-0.2, 0.975], [-0.14, 0.935], [-0.07, 0.84], [-0.012, 0.745]];
      const left = cr2(ctl.map(([x, y]) => [cx + (x + (r() - 0.5) * 0.006) * W, y * H]), 10), right = left.map(([x, y]) => [2 * cx - x, y]).reverse();
      const out = left.concat([[cx, sy - 2]], right);
      path(a, out); const g = a.createRadialGradient(cx, sy, 10, cx, sy - H * 0.25, W * 0.62); g.addColorStop(0, hsla(hue - 4, 0.42, 0.2)); g.addColorStop(1, hsla(hue, 0.44, 0.255)); a.fillStyle = g; a.fill();
      h.fillStyle = grey(152); path(h, out); h.fill();
      a.save(); path(a, out); a.clip(); h.save(); path(h, out); h.clip();
      const vein = (pts, w0, w1, alpha) => { taper(h, pts, t => (w0 * 2.6) * (1 - t) + w1 * 2.6 * t, grey(118)); taper(a, pts, t => w0 * (1 - t) + w1 * t, hsla(78, 0.38, 0.52, alpha)); };
      const q = (p0, p1, p2, n = 14) => { const o2 = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o2.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return o2; };
      /* (the faint lesser veins first, between the ribs) */
      for (let k = 0; k < 26; k++) { const s = 0.06 + 0.9 * k / 26, my = sy - s * (sy - H * 0.04); for (const sd of [-1, 1]) { const wf = Math.sin(Math.PI * Math.min(1, 0.25 + s * 0.8)), e = [cx + sd * W * 0.43 * wf, my - H * 0.13 * (1 - 0.4 * s)]; const pts = q([cx, my], [cx + sd * W * 0.12 * wf, my - H * 0.07], e, 10); taper(a, pts, t => 1.0 * (1 - t) + 0.4, hsla(80, 0.3, 0.4, 0.12)); taper(h, pts, () => 2, grey(140, 0.6)); } }
      /* (the side ribs) */
      const nR = 6 + Math.floor(r() * 2);
      for (let k = 0; k < nR; k++) { const s = 0.08 + 0.8 * (k + 0.5) / nR, my = sy - s * (sy - H * 0.04); for (const sd of [-1, 1]) { const wf = Math.sin(Math.PI * Math.min(1, 0.22 + s * 0.82)), e = [cx + sd * W * 0.43 * wf, my - H * (0.2 - 0.08 * s)]; vein(q([cx, my], [cx + sd * W * 0.12 * wf, my - H * 0.09 * (1 - 0.5 * s)], e), 3.4 * (1 - 0.4 * s), 0.9, 0.85); } }
      /* (the ribs into the lobes, each giving off two or three lesser ones outward) */
      for (const sd of [-1, 1]) {
        const tip = [cx + sd * W * 0.215, H * 0.95], rib = q([cx, sy], [cx + sd * W * 0.1, H * 0.8], tip); vein(rib, 4.2, 1.2, 0.85);
        for (const s of [0.3, 0.55, 0.78]) { const p = rib[Math.round(s * 14)]; vein(q(p, [p[0] + sd * W * 0.1, p[1] - H * 0.02], [p[0] + sd * W * (0.2 - 0.12 * s), p[1] - H * (0.12 - 0.1 * s)]), 2.2, 0.7, 0.7); }
      }
      /* (the midrib, broad at its foot) */
      vein(q([cx, sy], [cx + (r() - 0.5) * 6, H * 0.4], [cx, H * 0.03], 20), 6.5, 1.6, 0.92);
      a.restore(); h.restore();
      if (r() < (o.tear ?? 0.3)) { const s = 0.3 + 0.5 * r(), y = sy - s * sy, sd = r() < 0.5 ? -1 : 1; a.globalCompositeOperation = 'destination-out'; a.beginPath(); a.moveTo(cx + sd * W * 0.5, y - 6); a.lineTo(cx + sd * W * (0.3 + 0.1 * r()), y); a.lineTo(cx + sd * W * 0.5, y + 4); a.fill(); a.globalCompositeOperation = 'source-over'; }
    } },
    /* one segment of a fan palm's leaf (Licuala): the geometry is the wedge; on it a few pleats running out to the rim,
       ridge and valley, each ridge ending in a tooth; the rim browned and frayed here and there */
    fan: { W: 128, H: 512, blur: 0.8, bump: 7, paint(a, b, r, o, h, W, H) {
      const k = o.ribs ?? 4, hue = o.hue ?? 98, sat = o.sat ?? 0.42, lig = o.light ?? 0.27, ph = r() * 9, br = r();
      pix(a, h, W, H, (x, y) => {
        const u = x / W, t = 1 - y / H, edge = Math.min(x, W - x) - 1.2; if (edge <= -0.5 || t < 0.01) return null;
        const f = Math.cos(TAU * u * k), top = 0.985 - 0.04 * Math.pow(1 - Math.abs(Math.cos(Math.PI * u * k)), 1.4) - 0.012 * (0.5 + 0.5 * Math.sin(u * 31 + ph));
        const cov = Math.min(edge + 0.5, (top - t) * H + 0.5); if (cov <= 0) return null;
        const vn = Math.pow(Math.abs(Math.cos(Math.PI * u * k * 4)), 10);
        let c = rgb(hue + 3 * t, sat, lig * (0.95 + 0.08 * f + 0.05 * t - 0.03 * vn));
        const bk = sm(0.93, 0.975, t + 0.025 * Math.sin(u * 23 + ph)) * (br < 0.6 ? 1 : 0.3); c = c.map((v, i) => mix(v, [124, 98, 52][i], bk));
        return [c[0], c[1], c[2], cov, 150 + 26 * f * sm(0.02, 0.15, t)];
      });
    } },
    /* one lobe of a papaya's palmate leaf: from the leaf's middle (the card's foot) a midrib out to a pointed tip, and off
       it two or three pairs of side lobes, pointed too, each with its vein, the cuts between them deep; the veins pale
       and sunk */
    papaya: { W: 256, H: 512, blur: 1.2, bump: 5, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 96, sat = o.sat ?? 0.42, lig = o.light ?? 0.3, Lm = H - 6;
      const shapes = [];
      /* (the middle lobe along the midrib, and the side lobes off it) */
      shapes.push(leaflet([cx, H - 2], [0, -1], [1, 0], Lm, 0, u => W * 0.17 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.75))), 0.9) * (u < 0.1 ? 0.3 + 7 * u : 1), u => W * 0.17 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.75))), 0.9) * (u < 0.1 ? 0.3 + 7 * u : 1), 40));
      const nS = o.side ?? 3;
      for (let k = 0; k < nS; k++) for (const sd of [-1, 1]) {
        const t = 0.3 + 0.2 * k + (r() - 0.5) * 0.04, y0 = H - 2 - t * Lm, an = 0.62 + 0.12 * k + (r() - 0.5) * 0.08, L = W * (0.48 - 0.1 * k) * (0.9 + 0.15 * r());
        const d = [sd * Math.sin(an), -Math.cos(an)], ac = [-sd * Math.cos(an), -Math.sin(an)];
        shapes.push(leaflet([cx, y0], d, ac, L, 0.12, u => L * 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.7))), 0.9), u => L * 0.17 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.7))), 0.9), 24));
      }
      for (const lf of shapes) { a.fillStyle = hsla(hue + (r() - 0.5) * 4, sat, lig); path(a, lf.poly); a.fill(); h.fillStyle = grey(154); path(h, lf.poly); h.fill(); }
      /* (the veins: pale, sunk, out along each lobe, with the faint net between) */
      for (const lf of shapes) { taper(h, lf.C, u => 5 * (1 - 0.8 * u), grey(124)); taper(a, lf.C, u => 3.2 * (1 - 0.8 * u) + 0.5, hsla(hue - 30, 0.35, lig * 1.75, 0.85)); }
      a.save(); for (const lf of shapes) { path(a, lf.poly); } a.clip(); a.strokeStyle = hsla(hue - 20, 0.3, lig * 1.4, 0.18); a.lineWidth = 0.6;
      for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; a.beginPath(); a.moveTo(x, y); a.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14); a.stroke(); } a.restore();
      if (o.yellow) { a.globalCompositeOperation = 'source-atop'; a.fillStyle = `hsla(48,60%,45%,${o.yellow})`; a.fillRect(0, 0, W, H); a.globalCompositeOperation = 'source-over'; }
    } },
    /* a banana's blade: oblong, a broad pale midrib, the side veins close and parallel, nearly square to it, curving
       toward the tip at the margin; torn along them by the wind into strips (o.torn); old ones yellowing and drying
       brown from the edges (o.dry) */
    banana: { W: 512, H: 1024, blur: 0.8, bump: 5, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 92, sat = o.sat ?? 0.5, lig = o.light ?? 0.33, Wm = W / 2 - 4, ph = r() * 9, torn = o.torn ?? 0.3, dry = o.dry ?? 0;
      const wid = t => (t < 0.06 ? 0.35 + 0.65 * Math.sin(Math.PI / 2 * t / 0.06) : 1) * (t > 0.88 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.88) / 0.12, 2))) : 1) * (1 - 0.06 * t);
      /* (the tears: for each side, cuts along the veins from the margin in toward the midrib) */
      const tears = [[], []]; for (const sd of [0, 1]) for (let i = 0, n = Math.round(torn * 46 * (0.6 + 0.8 * r())); i < n; i++) tears[sd].push([0.08 + 0.86 * r(), 0.15 + 0.82 * r() * r() + 0.15 * torn]);
      pix(a, h, W, H, (x, y) => {
        const t = 1 - y / H, dx = x - cx, w = wid(t) * Wm * (dx < 0 ? 1 + 0.03 * Math.sin(t * 9 + ph) : 1 - 0.03 * Math.sin(t * 7 + ph)); if (w < 1) return null;
        const q = Math.abs(dx) / w, cov = w - Math.abs(dx) + 0.5; if (cov <= 0) return null;
        /* (a vein's line: leaving the midrib nearly square, bending toward the tip near the margin) */
        const s = t * H + Math.abs(dx) * 0.22 + q * q * q * w * 0.5;
        for (const [tt, dep] of tears[dx < 0 ? 0 : 1]) { if (q > 1 - dep && Math.abs(s - (tt * H + q * w * 0.22 + q * q * q * w * 0.5)) < 0.7 + 5 * (q - 1 + dep) / dep) return null; }   /* (each tear a gap that widens toward the margin as the strips part) */
        const vn = Math.pow(Math.abs(Math.cos(Math.PI * s / 4.5)), 6), mw = Math.max(3, W * 0.032 * (1 - 0.6 * t)), mid = sm(mw + 1.5, mw - 0.5, Math.abs(dx));
        let c = rgb(hue + 4 * t, sat, lig * (0.93 + 0.1 * Math.sin(t * 23 + ph) * 0.3 + 0.05 * vn));
        c = c.map((v, i) => mix(v, rgb(hue - 22, 0.42, lig * 1.75)[i], mid * 0.9));
        const de = dry * sm(1 - 0.35 * dry, 1, q + 0.1 * Math.sin(t * 31 + ph)); if (de > 0) c = c.map((v, i) => mix(v, [128, 98, 52][i], clamp(de * 1.4)));
        if (o.yellow) c = c.map((v, i) => mix(v, rgb(52, 0.55, 0.45)[i], o.yellow));
        return [c[0], c[1], c[2], cov, 150 + 8 * (1 - q * q) - 30 * mid + 9 * vn];
      });
    } },
    /* a pandan's strap: long, narrow, grey-green, folded in an M (a keel up its middle, a pleat to each side), fine veins
       along it, small hooked spines along both edges pointing toward its tip; the tip often dry */
    pandan: { W: 128, H: 1024, blur: 0.8, bump: 6, paint(a, b, r, o, h, W, H) {
      const cx = W / 2, hue = o.hue ?? 95, sat = o.sat ?? 0.22, lig = o.light ?? 0.33, dry = r() < 0.5, Wm = W / 2 - 6;
      const wid = t => (t < 0.05 ? 0.92 + 0.08 * t / 0.05 : 1) * (t > 0.72 ? Math.pow(Math.max(0, (1 - t) / 0.28), 1.15) : 1);
      pix(a, h, W, H, (x, y) => {
        const t = 1 - y / H, w = wid(t) * Wm + 0.3, dx = x - cx, cov = w - Math.abs(dx) + 0.5; if (cov <= 0) return null; const q = Math.abs(dx) / w;
        const pl = Math.exp(-(((q - 0.55) / 0.13) ** 2)), vn = Math.pow(Math.abs(Math.cos(Math.PI * dx / 2.6)), 8);
        let c = rgb(hue, sat, lig * (0.9 + 0.12 * pl - 0.08 * (1 - q) * 0 + 0.03 * vn));
        if (dry) { const k = sm(0.9, 0.97, t); c = c.map((v, i) => mix(v, [132, 104, 62][i], k)); }
        return [c[0], c[1], c[2], cov, 150 - 24 * (1 - q) + 16 * pl];
      });
      a.fillStyle = 'rgba(70,64,40,0.95)';
      for (let y = 16; y < H * 0.96; y += 10 + r() * 7) { const t = 1 - y / H, w = wid(t) * Wm; if (w < 1.5) continue; for (const sd of [-1, 1]) { a.beginPath(); a.moveTo(cx + sd * (w - 1), y + 2.5); a.lineTo(cx + sd * (w + 3.5), y - 4); a.lineTo(cx + sd * (w - 0.5), y - 1); a.closePath(); a.fill(); } }
    } } };
  function mix3(p, q, t) { return [mix(p[0], q[0], t), mix(p[1], q[1], t), mix(p[2], q[2], t)]; }

  /* the relief (h, blurred a little) turned into slopes on the normal map (b) */
  function bumpFrom(h, b, W, H, blur, k) {
    let src = h.canvas;
    if (blur > 0) { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.filter = `blur(${blur}px)`; x.drawImage(src, 0, 0); src = c; }
    const hd = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, bd = b.getImageData(0, 0, W, H), B = bd.data, rw = W * 4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * rw + x * 4, dx = (hd[x < W - 1 ? i + 4 : i] - hd[x > 0 ? i - 4 : i]) / 255 * k, dy = (hd[y < H - 1 ? i + rw : i] - hd[y > 0 ? i - rw : i]) / 255 * k;
      const nx = B[i] / 127.5 - 1 - dx, ny = B[i + 1] / 127.5 - 1 + dy, nz = B[i + 2] / 127.5 - 1, l = Math.hypot(nx, ny, nz) || 1;
      B[i] = (nx / l * 0.5 + 0.5) * 255; B[i + 1] = (ny / l * 0.5 + 0.5) * 255; B[i + 2] = (nz / l * 0.5 + 0.5) * 255;
    }
    b.putImageData(bd, 0, 0);
  }
  /* one variant painted: its colour (a), normal map (b) and relief (h) canvases */
  function canvases(kind, o = {}, k = 0) {
    const Pn = P[kind], q = FloraKit.Q.tex, W = Math.max(32, Math.round((o.W || Pn.W) * q)), H = Math.max(32, Math.round((o.H || Pn.H) * q));
    const cv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c.getContext('2d', { willReadFrequently: true }); };
    const a = cv(), b = cv(), h = cv();
    b.fillStyle = 'rgb(128,128,255)'; b.fillRect(0, 0, W, H); h.fillStyle = 'rgb(128,128,128)'; h.fillRect(0, 0, W, H);
    Pn.paint(a, b, Models.rng(733 + k * 97 + kind.length * 13 + (o.seed || 0) * 7), o, h, W, H);
    bumpFrom(h, b, W, H, o.blur ?? Pn.blur ?? 1, o.bump ?? Pn.bump ?? 5);
    return { a, b, h, W, H };
  }
  const texCache = new Map();
  /* a blade's textures: [{ map, nmap }] — n variants, each painted from its own seed; o.W, o.H override the size */
  function tex(kind, o = {}, n = 2) {
    const key = kind + JSON.stringify(o) + n; if (texCache.has(key)) return texCache.get(key);
    const out = [];
    for (let k = 0; k < n; k++) {
      const { a, b, W, H } = canvases(kind, o, k);
      const col = a.getImageData(0, 0, W, H).data, nor = b.getImageData(0, 0, W, H).data;
      const t = Trees.texOf(new Uint8Array(col.buffer.slice(0)), new Uint8Array(nor.buffer.slice(0)), W, H, 0.4); t.map.anisotropy = t.nmap.anisotropy = 4;
      out.push(t);
    }
    texCache.set(key, out); return out;
  }

  /* ── a blade along a spine: pts (Vector3s, base to tip); up (which way its face looks, roughly); w(t) its width (m);
     fold(t): how far its halves rise from the midrib (radians; below zero they fall, the blade an arch); curl(t): how
     much more its edges rise (or with a minus, fall) than the fold alone gives, cupping it; twist(t): how far it turns
     about its spine; cols across it (odd), ao(t), flut(t); wind [phase, sway (m), height share, plant height]; n(p, t)
     a shading normal of its own. Each half is shaded as it lies. u runs across (0..1), v along (0..1) ── */
  function ribbon(pts, o) {
    const curve = new T.CatmullRomCurve3(pts), segs = o.segs || 16, cols = o.cols || 5, n = (segs + 1) * cols;
    const P_ = new Float32Array(n * 3), N_ = new Float32Array(n * 3), TA = new Float32Array(n * 3), BI = new Float32Array(n * 3), UV = new Float32Array(n * 2), A = new Float32Array(n * 4), WN = new Float32Array(n * 4);
    const up0 = o.up || new T.Vector3(0, 1, 0), wind = o.wind || [0, 0.1, 0.5, 2], ph = o.ph ?? Math.random();
    const side = new T.Vector3(), nor = new T.Vector3(), ax = new T.Vector3(), nc = new T.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      side.crossVectors(tg, up0); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
      const tw = o.twist ? o.twist(t) : 0; if (tw) side.applyAxisAngle(tg, tw); nor.crossVectors(side, tg).normalize();
      const w = o.w(t), fo = o.fold ? o.fold(t) : 0, cu = o.curl ? o.curl(t) : 0, ao = o.ao ? o.ao(t) : 1, fl = o.flut ? o.flut(t) : t, cf = Math.cos(fo), sf = Math.sin(fo);
      for (let j = 0; j < cols; j++) {
        const c = j / (cols - 1) * 2 - 1, k = i * cols + j, hw = w * 0.5, rise = Math.abs(c) * hw * sf + c * c * hw * cu;
        const x = p.x + side.x * c * hw * cf + nor.x * rise, y = p.y + side.y * c * hw * cf + nor.y * rise, z = p.z + side.z * c * hw * cf + nor.z * rise;
        P_[k * 3] = x; P_[k * 3 + 1] = y; P_[k * 3 + 2] = z;
        /* (the half's own slope across: d(position)/dc) */
        const sl = Math.sign(c) * sf + 2 * c * cu; ax.copy(side).multiplyScalar(cf).addScaledVector(nor, sl).normalize();
        nc.crossVectors(ax, tg).normalize(); if (nc.dot(nor) < 0) nc.negate();
        const sn = o.n ? o.n([x, y, z], t) : [nc.x, nc.y, nc.z]; N_.set(sn, k * 3);
        TA.set([ax.x, ax.y, ax.z], k * 3); BI.set([tg.x, tg.y, tg.z], k * 3); UV[k * 2] = (c + 1) / 2; UV[k * 2 + 1] = t;
        A.set([ao, fl, ph, sn[0] * nc.x + sn[1] * nc.y + sn[2] * nc.z < 0 ? -1 : 1], k * 4);
        WN.set([wind[0], wind[1] * (0.35 + 0.65 * t), wind[2] ?? clamp(y / (wind[3] || 2)), wind[3] || 2], k * 4);
      }
    }
    const I = []; for (let i = 0; i < segs; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; I.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P_, 3)); g.setAttribute('normal', new T.BufferAttribute(N_, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2));
    g.setAttribute('aTan', new T.BufferAttribute(TA, 3)); g.setAttribute('aBit', new T.BufferAttribute(BI, 3)); g.setAttribute('aLeaf', new T.BufferAttribute(A, 4)); g.setAttribute('aWind', new T.BufferAttribute(WN, 4));
    g.setIndex(I); return g;
  }
  /* blades (geometries with the leaf attributes) merged into one */
  function merge(gs) {
    const names = ['position', 'normal', 'uv', 'aTan', 'aBit', 'aLeaf', 'aWind'], sizes = [3, 3, 2, 3, 3, 4, 4];
    let nv = 0, ni = 0; for (const g of gs) { nv += g.attributes.position.count; ni += g.index.count; }
    const arr = sizes.map(s => new Float32Array(nv * s)), I = new Uint32Array(ni); let o = 0, oi = 0;
    for (const g of gs) { names.forEach((n, k) => arr[k].set(g.attributes[n].array, o * sizes[k])); const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + o; o += g.attributes.position.count; oi += ix.length; g.dispose(); }
    const out = new T.BufferGeometry(); names.forEach((n, k) => out.setAttribute(n, new T.BufferAttribute(arr[k], sizes[k]))); out.setIndex(new T.BufferAttribute(I, 1)); out.computeBoundingSphere(); return out;
  }
  /* the leaf shader (leaves.js) with a blade's own textures */
  const matCache = new Map();
  function material(key, texs, gloss = [0.25, 22, 0.9], back = [1.15, 1.18, 0.95]) {
    if (matCache.has(key)) return matCache.get(key);
    const base = FloraLeaf.material('dipt');   /* (its shaders, compiled once) */
    const leaves = texs.map(t => { const m = base.leaves[0].clone(); m.uniforms = Object.assign({}, base.leaves[0].uniforms, { map: { value: t.map }, nmap: { value: t.nmap }, uLeafK: { value: new T.Vector3(...gloss) }, uBack: { value: new T.Vector3(...back) } }); return m; });
    const depth = texs.map(t => { const m = base.depth[0].clone(); m.uniforms = Object.assign({}, base.depth[0].uniforms, { map: { value: t.map } }); return m; });
    const out = { leaves, depth }; matCache.set(key, out); return out;
  }
  return { P, tex, canvases, ribbon, merge, material, rgb, cr2 };
})();
