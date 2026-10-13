/* ─────────────────────────────────────────────────────────────
   models/flora/litter.js — the forest floor: a tile of fallen
   leaves lying two or three deep on reddish soil, every one a real
   leaf — elliptic with a drip tip, or round, or long; its midrib
   and side veins; curled at its edges; fresh-fallen orange and
   tan, or brown, or dark and wet, or bleached grey; some broken,
   some eaten into holes, the oldest rotted to lace — with twigs
   across them, a dipterocarp's winged fruit here and there, and
   crumbs of leaf between. Each leaf drapes over those beneath it;
   the gaps and the edges are shaded as they lie.
   FloraLitter.tex(o) → { map, normalMap, tile (m) } — tileable.
   FloraLitter.mud(o) → { map, normalMap, roughnessMap, tile, rough }:
   a mangrove's mud at low tide — soft grey-brown silt, smooth and
   wet, low swells and the hollows between them still holding the
   tide's water, rills where it drains off, crab holes ringed with
   the little balls of mud the crabs sift out, a scatter of fallen
   leaves (a mangrove's turn yellow before they fall, and blacken in
   the wet) and a propagule or two lying where the tide left it.
   ───────────────────────────────────────────────────────────── */
const FloraLitter = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  /* the colours of fallen leaves as they age, linear rgb: [fresh, browned, old, wet-dark, bleached] families */
  const PAL = {
    fresh: [[0.3, 0.16, 0.06], [0.34, 0.2, 0.08], [0.27, 0.11, 0.045], [0.36, 0.23, 0.1]],
    brown: [[0.2, 0.11, 0.05], [0.23, 0.135, 0.065], [0.17, 0.095, 0.048], [0.26, 0.16, 0.08], [0.19, 0.09, 0.04]],
    old: [[0.1, 0.062, 0.036], [0.125, 0.078, 0.044], [0.08, 0.052, 0.032]],
    pale: [[0.25, 0.19, 0.13], [0.22, 0.17, 0.115]] };
  const cache = new Map();
  function tex(o = {}) {
    const N = o.N || 1024, tile = o.tile || 2, px = tile / N * 100;   /* (cm per pixel) */
    const key = N + ':' + tile + ':' + (o.seed || 1) + ':' + (o.cover ?? 2.4); if (cache.has(key)) return cache.get(key);
    const R = Models.rng(o.seed || 1), NN = N * N;
    const H = new Float32Array(NN), C = new Float32Array(NN * 3), WET = new Float32Array(NN), s1 = R() * 50;
    /* the soil: reddish brown, crumbly, darker in its hollows */
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, n = vnT(u, v, 6, s1), n2 = vnT(u, v, 40, 7.3), n3 = vnT(u, v, 150, 2.1), i = y * N + x;
      H[i] = 1.5 * n + 0.8 * n2 + 0.5 * n3 * n3;
      const l = 0.75 + 0.35 * n + 0.2 * (n2 - 0.5) + 0.25 * (n3 > 0.72 ? n3 - 0.72 : 0) * 3;
      C[i * 3] = 0.15 * l; C[i * 3 + 1] = 0.1 * l; C[i * 3 + 2] = 0.066 * l;
    }
    const area = tile * tile * 1e4, cover = o.cover ?? 2.4; let laid = 0;
    /* crumbs of old leaf on the soil, under everything */
    for (let k = 0, n = Math.round(area * 0.06); k < n; k++) { const L = 0.6 + R() * 1.8; leaf(H, C, WET, N, px, R, R() * N, R() * N, R() * TAU, L, L * (0.5 + 0.4 * R()), 0.6, true); }
    /* the leaves */
    while (laid < area * cover) {
      const big = R(), L = big < 0.15 ? 18 + R() * 17 : big < 0.6 ? 10 + R() * 8 : 5 + R() * 5;   /* (cm) */
      const shape = R(), Wr = shape < 0.6 ? 0.36 + 0.12 * R() : shape < 0.8 ? 0.5 + 0.12 * R() : 0.2 + 0.1 * R(), Wd = L * Wr;
      laid += L * Wd * 0.72;
      leaf(H, C, WET, N, px, R, R() * N, R() * N, R() * TAU, L, Wd, shape);
    }
    /* twigs, and a few winged fruits */
    for (let k = 0, n = Math.round(area / 900 * (o.twigs ?? 1)); k < n; k++) twig(H, C, N, px, R, R() * N, R() * N, R() * TAU, 4 + Math.pow(R(), 2) * 40, 0.12 + Math.pow(R(), 3) * 0.55);
    for (let k = 0, n = Math.round(area / 3500 * (o.fruits ?? 1)); k < n; k++) fruit(H, C, N, px, R, R() * N, R() * N, R() * TAU);
    /* shading: hollows between and under the leaves darker (and damper), edges and tops catching a little more light */
    const B = blurT(H, N, Math.max(1, Math.round(1.2 / px))), B2 = blurT(H, N, Math.max(1, Math.round(0.35 / px)));
    const col = new Uint8Array(NN * 4), nor = new Uint8Array(NN * 4), k = 1 / (px * 10);   /* (height in mm, the pixel in mm) */
    const enc = q => Math.round(255 * Math.pow(clamp(q), 1 / 2.2));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, cav = Math.min(1.6, B[i] - H[i]), cvx = H[i] - B2[i], ao = clamp(1 - 0.3 * Math.max(0, cav), 0.45, 1) * (1 + 0.25 * clamp(cvx, 0, 1)), wet = clamp(WET[i] + 0.12 * Math.max(0, cav));
      const dk = 1 - 0.3 * wet;
      col[i * 4] = enc(C[i * 3] * ao * dk); col[i * 4 + 1] = enc(C[i * 3 + 1] * ao * dk); col[i * 4 + 2] = enc(C[i * 3 + 2] * ao * dk); col[i * 4 + 3] = 255;
      const xl = y * N + (x + N - 1) % N, xr = y * N + (x + 1) % N, yu = ((y + N - 1) % N) * N + x, yd = ((y + 1) % N) * N + x;
      const dx = (H[xr] - H[xl]) * 0.5 * k, dy = (H[yd] - H[yu]) * 0.5 * k, l = Math.hypot(dx, dy, 1);
      /* (rows run along +v: the normal leans against the slope both ways) */
      nor[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); nor[i * 4 + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); nor[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nor[i * 4 + 3] = 255;
    }
    const mk = (d, srgb) => { const t = new T.DataTexture(d, N, N, T.RGBAFormat, T.UnsignedByteType); t.wrapS = t.wrapT = T.RepeatWrapping; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t; };
    const out = { map: mk(col, true), normalMap: mk(nor, false), tile, rough: 0.88 };
    cache.set(key, out); return out;
  }

  /* one leaf at (cx, cy) px, turned by an, L × W cm; shape < 0.55 elliptic with a drip tip, < 0.8 broad and round-
     ended, else long and narrow; crumb: a scrap without veins */
  function leaf(H, C, WET, N, px, R, cx, cy, an, L, W, shape, crumb = false, pal = PAL) {
    const Lp = L / px, Wp = W / px, ca = Math.cos(an), sa = Math.sin(an), ext = Math.ceil(Math.hypot(Lp / 2, Wp / 2)) + 2;
    /* its age: fresh-fallen (orange, tan, red-brown), browned, old and dark, or bleached; how wet; how curled */
    const ag = crumb ? 0.7 + 0.25 * R() : R(), fam = ag < 0.15 ? pal.fresh : ag < 0.68 ? pal.brown : ag < 0.97 ? pal.old : pal.pale, base = fam[Math.floor(R() * fam.length)];
    const shade = 0.78 + 0.44 * R(), wet = ag > 0.66 && ag < 0.9 ? 0.3 + 0.5 * R() : R() * 0.2, curl = (R() < 0.3 ? 0.8 + 1.4 * R() : 0.3 * R()) * Math.min(1, L / 8), cup = (R() - 0.4) * 1.2 * Math.min(1, L / 10);
    const lace = false, holes = !crumb && R() < 0.12, broken = !crumb && R() < 0.28;
    const cutA = R() * TAU, cutD = (R() - 0.2) * 0.35, ph = R() * 50, nv = 5 + Math.floor(L / 2.2), vA = 0.85 + 0.25 * R();
    const hw = u => { if (u <= 0 || u >= 1) return 0; const b = shape < 0.6 ? Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.85) * (u > 0.88 ? 1 - 0.5 * sm(0.88, 1, u) : 1) : shape < 0.8 ? Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.75) : Math.pow(Math.sin(Math.PI * u), 0.9); return b * 0.5; };
    const x0 = Math.floor(cx - ext), y0 = Math.floor(cy - ext);
    let hs = 0, hn = 0;
    for (let yy = 0; yy <= ext * 2; yy += 2) for (let xx = 0; xx <= ext * 2; xx += 2) { const X = x0 + xx + 0.5 - cx, Y = y0 + yy + 0.5 - cy, lu = (X * ca + Y * sa) / Lp + 0.5, lv = (-X * sa + Y * ca) / Wp; if (Math.abs(lv) < hw(lu)) { hs += H[((y0 + yy + N) % N) * N + (x0 + xx + N) % N]; hn++; } }
    const hBed = hn ? hs / hn : 0;
    for (let yy = 0; yy <= ext * 2; yy++) for (let xx = 0; xx <= ext * 2; xx++) {
      const X = x0 + xx + 0.5 - cx, Y = y0 + yy + 0.5 - cy, lu = (X * ca + Y * sa) / Lp + 0.5, lv = (-X * sa + Y * ca) / Wp;   /* lu 0 base .. 1 tip, lv across (-0.5..0.5 at the widest) */
      const w = hw(lu); if (w <= 0) continue;
      const q = Math.abs(lv) / w; let cov = clamp((w - Math.abs(lv)) * Wp + 0.5); if (cov <= 0) continue;
      if (broken && (lu - 0.5) * Math.cos(cutA) + lv * Math.sin(cutA) > cutD) continue;
      /* the veins: the midrib, and side veins leaving it at a slant and curving toward the tip */
      const s = lu * nv - Math.abs(lv) * 1.6 * vA - q * q * 0.6, sv = Math.pow(Math.abs(Math.cos(Math.PI * s)), 14) * sm(0.03, 0.12, lu) * (1 - sm(0.85, 1, q)), mid = Math.exp(-((lv * Wp / (0.55 + 0.35 * (1 - lu))) ** 2));
      if (lace) { const n = vnT((x0 + xx) / N, (y0 + yy) / N, 260, ph); if (n > 0.42 + 0.4 * (sv + mid)) continue; }
      if (holes) { const n = vnT((x0 + xx) / N, (y0 + yy) / N, 210, ph + 3); if (n > 0.88) continue; }
      const i = ((y0 + yy + N) % N) * N + (x0 + xx + N) % N;
      const vein = crumb ? 0 : Math.max(sv * 0.6, mid);
      const blot = 0.86 + 0.26 * vnT((x0 + xx) / N, (y0 + yy) / N, 60, ph) - 0.1 * (q > 0.8 ? (q - 0.8) * 5 : 0);
      const lt = shade * blot * (1 + (ag < 0.66 ? 0.22 : -0.1) * vein);
      const a = cov;
      C[i * 3] = mix(C[i * 3], base[0] * lt, a); C[i * 3 + 1] = mix(C[i * 3 + 1], base[1] * lt, a); C[i * 3 + 2] = mix(C[i * 3 + 2], base[2] * lt, a);
      WET[i] = mix(WET[i], wet, a);
      /* (it drapes over what lies beneath: a third of a millimetre thick, its edges curled up, cupped along its midrib) */
      H[i] = mix(H[i], Math.max(H[i] + 0.3, mix(H[i], hBed, 0.8) + 0.9) + curl * q * q * q + cup * q * q + 0.12 * vein, a);
    }
  }
  /* a twig: a line of bark, its radius r cm, length L cm, lying slightly bent */
  function twig(H, C, N, px, R, cx, cy, an, L, r, colour) {
    const n = Math.max(4, Math.round(L / px / 2)), rp = r / px, bend = (R() - 0.5) * 0.4, col = colour || (R() < 0.5 ? [0.1, 0.068, 0.044] : [0.155, 0.12, 0.085]), lich = !colour && R() < 0.25;
    let x = cx, y = cy, a = an; const pts = []; for (let k = 0; k <= n; k++) { pts.push([x, y]); a += bend / n + (R() - 0.5) * 0.08; x += Math.cos(a) * L / px / n; y += Math.sin(a) * L / px / n; }
    for (let k = 0; k < n; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], rr = rp * (1 - 0.35 * k / n), e = Math.ceil(rr) + 1;
      for (let yy = Math.floor(Math.min(ay, by) - e); yy <= Math.max(ay, by) + e; yy++) for (let xx = Math.floor(Math.min(ax, bx) - e); xx <= Math.max(ax, bx) + e; xx++) {
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((xx + 0.5 - ax) * dx + (yy + 0.5 - ay) * dy) / l2), qx = ax + dx * t - xx - 0.5, qy = ay + dy * t - yy - 0.5, d = Math.hypot(qx, qy);
        if (d > rr + 0.5) continue; const i = ((yy + N) % N) * N + (xx + N) % N, c = clamp(rr + 0.5 - d), z = Math.sqrt(Math.max(0, 1 - (d / Math.max(rr, 0.5)) ** 2));
        const lt = (0.75 + 0.35 * z) * (0.85 + 0.3 * vnT(xx / N, yy / N, 300, cx));
        let cc = col; if (lich && vnT(xx / N, yy / N, 120, cy) > 0.68) cc = [0.25, 0.26, 0.2];
        C[i * 3] = mix(C[i * 3], cc[0] * lt, c); C[i * 3 + 1] = mix(C[i * 3 + 1], cc[1] * lt, c); C[i * 3 + 2] = mix(C[i * 3 + 2], cc[2] * lt, c);
        H[i] = Math.max(H[i], mix(H[i], H[i] + rr * px * 10 * z * 0.9, c));
      }
    }
  }
  /* a dipterocarp's fruit: a nut and its two long wings (and three short), red-brown, veined lengthwise */
  function fruit(H, C, N, px, R, cx, cy, an) {
    const nut = 0.8 + 0.5 * R(), wl = 5 + 4 * R(), ww = 1.0 + 0.5 * R(), spread = 0.15 + 0.2 * R();
    for (const [da, L, W] of [[spread, wl, ww], [-spread, wl * (0.9 + 0.15 * R()), ww], [Math.PI + 0.5, 1.4, 0.6], [Math.PI - 0.5, 1.4, 0.6], [Math.PI, 1.6, 0.6]]) {
      const a = an + da, Lp = L / px, ox = cx + Math.cos(a) * Lp / 2, oy = cy + Math.sin(a) * Lp / 2;
      wing(H, C, N, px, ox, oy, a, L, W, R);
    }
    const rp = nut / px;
    for (let yy = Math.floor(cy - rp - 1); yy <= cy + rp + 1; yy++) for (let xx = Math.floor(cx - rp - 1); xx <= cx + rp + 1; xx++) {
      const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy); if (d > rp + 0.5) continue; const i = ((yy + N) % N) * N + (xx + N) % N, c = clamp(rp + 0.5 - d), z = Math.sqrt(Math.max(0, 1 - (d / rp) ** 2));
      C[i * 3] = mix(C[i * 3], 0.2 * (0.7 + 0.4 * z), c); C[i * 3 + 1] = mix(C[i * 3 + 1], 0.12 * (0.7 + 0.4 * z), c); C[i * 3 + 2] = mix(C[i * 3 + 2], 0.07 * (0.7 + 0.4 * z), c); H[i] += c * z * Math.min(2.5, nut * 2.5);
    }
  }
  function wing(H, C, N, px, cx, cy, an, L, W, R) {
    const Lp = L / px, Wp = W / px, ca = Math.cos(an), sa = Math.sin(an), ext = Math.ceil(Lp / 2) + 2, col = [0.22 + 0.06 * R(), 0.11 + 0.03 * R(), 0.055];
    for (let yy = Math.floor(cy - ext); yy <= cy + ext; yy++) for (let xx = Math.floor(cx - ext); xx <= cx + ext; xx++) {
      const X = xx + 0.5 - cx, Y = yy + 0.5 - cy, u = (X * ca + Y * sa) / Lp + 0.5, v = (-X * sa + Y * ca) / Wp; if (u <= 0 || u >= 1) continue;
      const w = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.3)), 0.7); if (Math.abs(v) > w) continue;
      const i = ((yy + N) % N) * N + (xx + N) % N, vein = Math.pow(Math.abs(Math.cos(Math.PI * v / w * 3)), 8) * 0.25, lt = 0.85 + vein;
      C[i * 3] = col[0] * lt; C[i * 3 + 1] = col[1] * lt; C[i * 3 + 2] = col[2] * lt; H[i] += 0.3 + 0.4 * (Math.abs(v) / w) ** 2;
    }
  }
  /* the fallen leaves of a mangrove: yellow and orange when just down, brown, then black in the wet mud */
  const MPAL = {
    fresh: [[0.46, 0.33, 0.035], [0.5, 0.3, 0.03], [0.4, 0.22, 0.03], [0.42, 0.36, 0.06]],
    brown: [[0.24, 0.14, 0.05], [0.2, 0.12, 0.05], [0.28, 0.17, 0.06]],
    old: [[0.05, 0.04, 0.03], [0.07, 0.055, 0.04], [0.04, 0.035, 0.028]],
    pale: [[0.2, 0.17, 0.12]] };
  function mud(o = {}) {
    const N = o.N || 1024, tile = o.tile || 3, px = tile / N * 100;   /* (cm per pixel) */
    const key = 'mud:' + N + ':' + tile + ':' + (o.seed || 3); if (cache.has(key)) return cache.get(key);
    const R = Models.rng(o.seed || 3), NN = N * N, H = new Float32Array(NN), C = new Float32Array(NN * 3), WET = new Float32Array(NN), s1 = R() * 50, s2 = R() * 50, s3 = R() * 50;
    /* the silt's relief (mm): broad low swells, finer ones on them, a skin of tiny pocks; rills winding across, where the
       ebbing tide drains off; the hollows hold water. Its colour: grey-brown, darker and wetter in the low places, a
       little paler and drier on the crests; patches of a golden-green film of algae */
    const RL = new Float32Array(NN);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x, w = vnT(u, v, 3, s2) - 0.5;
      const rn = Math.abs(vnT(u + 0.12 * w, v + 0.08 * w, 5, s3) - 0.5), rill = sm(0.03, 0, rn) * (0.6 + 0.4 * vnT(u, v, 9, s3 + 2));
      RL[i] = rill;
      H[i] = 12 * vnT(u, v, 3, s1) + 5 * vnT(u, v, 9, s1 + 3) + 1.6 * vnT(u, v, 30, s1 + 7) + 0.5 * vnT(u, v, 110, s1 + 11) + 0.2 * vnT(u, v, 300, s1 + 13) - 6 * rill * rill;
    }
    /* (the water stands in the lowest fifth of it) */
    const sorted = Float32Array.from(H).sort(), level = sorted[Math.floor(NN * (o.water ?? 0.13))];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x, hi = sm(level, level + 9, H[i]), alg = sm(0.58, 0.75, vnT(u, v, 7, s2 + 5)) * (0.5 + 0.5 * vnT(u, v, 40, s2 + 6));
      let c = mix3a([0.052, 0.042, 0.032], [0.13, 0.108, 0.082], hi);
      c = mix3a(c, [0.1, 0.095, 0.05], alg * 0.45);
      const k = 0.9 + 0.2 * vnT(u, v, 60, s1 + 17); C[i * 3] = c[0] * k; C[i * 3 + 1] = c[1] * k; C[i * 3 + 2] = c[2] * k;
      WET[i] = 1 - hi * 0.6;
    }
    const area = tile * tile;
    /* crab holes, each with its rim and the balls of mud round it */
    for (let k = 0, n = Math.round(area * (o.crabs ?? 26)); k < n; k++) crabHole(H, C, WET, N, px, R, R() * N, R() * N);
    /* fallen leaves, lying flat and wet */
    for (let k = 0, n = Math.round(area * (o.leaves ?? 3.5)); k < n; k++) { const L = 7 + R() * 7; leaf(H, C, WET, N, px, R, R() * N, R() * N, R() * TAU, L, L * (0.38 + 0.12 * R()), 0.3 + 0.25 * R(), false, MPAL); }
    /* a propagule or two, lying where the tide left it */
    for (let k = 0, n = Math.round(area * (o.propagules ?? 0.5)); k < n; k++) twig(H, C, N, px, R, R() * N, R() * N, R() * TAU, 22 + R() * 14, 0.6 + 0.15 * R(), R() < 0.6 ? [0.07, 0.1, 0.025] : [0.08, 0.04, 0.035]);
    /* the water: still and flat over the hollows, dark; wet sheen on the mud, the crests duller */
    const B = blurT(H, N, Math.max(1, Math.round(1.5 / px))), col = new Uint8Array(NN * 4), nor = new Uint8Array(NN * 4), rgh = new Uint8Array(NN * 4), kk = 1 / (px * 10);
    const enc = q => Math.round(255 * Math.pow(clamp(q), 1 / 2.2)), He = new Float32Array(NN);
    for (let i = 0; i < NN; i++) He[i] = Math.max(H[i], level);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, water = sm(0, 1.2, level - H[i]), cav = Math.min(2, B[i] - H[i]), ao = clamp(1 - 0.12 * Math.max(0, cav), 0.6, 1);
      const dk = 1 - 0.25 * WET[i], wc = [0.028, 0.03, 0.029];
      for (let c = 0; c < 3; c++) col[i * 4 + c] = enc(mix(C[i * 3 + c] * ao * dk, wc[c], water * 0.85)); col[i * 4 + 3] = 255;
      const xl = y * N + (x + N - 1) % N, xr = y * N + (x + 1) % N, yu = ((y + N - 1) % N) * N + x, yd = ((y + 1) % N) * N + x;
      const dx = (He[xr] - He[xl]) * 0.5 * kk, dy = (He[yd] - He[yu]) * 0.5 * kk, l = Math.hypot(dx, dy, 1);
      nor[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); nor[i * 4 + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); nor[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nor[i * 4 + 3] = 255;
      /* (wet silt has a dull sheen, not a gloss; only the standing water shines) */
      const hi = sm(level, level + 12, H[i]), r = mix(mix(0.72, 0.9, hi), 0.22, water);
      rgh[i * 4] = rgh[i * 4 + 1] = rgh[i * 4 + 2] = Math.round(clamp(r) * 255); rgh[i * 4 + 3] = 255;
    }
    const mk = (d, srgb) => { const t = new T.DataTexture(d, N, N, T.RGBAFormat, T.UnsignedByteType); t.wrapS = t.wrapT = T.RepeatWrapping; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.anisotropy = 8; if (srgb) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; return t; };
    const out = { map: mk(col, true), normalMap: mk(nor, false), roughnessMap: mk(rgh, false), tile, rough: 1 };
    cache.set(key, out); return out;
  }
  const mix3a = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  /* a crab's hole: a dark pit a centimetre or two across, a low rim, and round it the little balls of sifted mud */
  function crabHole(H, C, WET, N, px, R, cx, cy) {
    const r = (0.45 + 0.6 * R()) / px, ext = Math.ceil(r * 2.2) + 2;
    for (let yy = -ext; yy <= ext; yy++) for (let xx = -ext; xx <= ext; xx++) {
      const d = Math.hypot(xx + 0.5, yy + 0.5) / r; if (d > 2.2) continue;
      const i = ((Math.floor(cy) + yy + N) % N) * N + (Math.floor(cx) + xx + N) % N;
      if (d < 1) { const q = 1 - d * d; H[i] -= 10 * q; const k = mix(1, 0.15, sm(0, 0.8, q)); C[i * 3] *= k; C[i * 3 + 1] *= k; C[i * 3 + 2] *= k; WET[i] = 1; }
      else { const q = Math.exp(-(((d - 1.25) / 0.3) ** 2)); H[i] += 0.7 * q; C[i * 3] *= 1 + 0.25 * q; C[i * 3 + 1] *= 1 + 0.22 * q; C[i * 3 + 2] *= 1 + 0.18 * q; }
    }
    /* (the pellets: a few to a few dozen, scattered out round it, paler, drier) */
    for (let k = 0, n = Math.floor(R() * R() * 28); k < n; k++) {
      const a = R() * TAU, dd = r * (1.6 + 4 * Math.sqrt(R())), pr = (0.18 + 0.15 * R()) / px, x0 = cx + Math.cos(a) * dd, y0 = cy + Math.sin(a) * dd, e = Math.ceil(pr) + 1;
      for (let yy = -e; yy <= e; yy++) for (let xx = -e; xx <= e; xx++) {
        const d = Math.hypot(Math.floor(x0) + xx + 0.5 - x0, Math.floor(y0) + yy + 0.5 - y0) / pr; if (d > 1) continue;
        const i = ((Math.floor(y0) + yy + N) % N) * N + (Math.floor(x0) + xx + N) % N, z = Math.sqrt(1 - d * d);
        H[i] = Math.max(H[i], H[i] + 1.2 * z); const lt = 0.75 + 0.35 * z; C[i * 3] = 0.12 * lt; C[i * 3 + 1] = 0.105 * lt; C[i * 3 + 2] = 0.087 * lt; WET[i] = 0.4;
      }
    }
  }
  /* tileable value noise at frequency f over the unit square */
  function vnT(u, v, f, s) {
    const x = ((u % 1) + 1) % 1 * f, y = ((v % 1) + 1) % 1 * f, xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, F = Math.round(f);
    const h = (a, b) => { a = ((a % F) + F) % F; b = ((b % F) + F) % F; let n = (a * 374761393 + b * 668265263 + Math.floor(s * 1000) * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    return mix(mix(h(xi, yi), h(xi + 1, yi), sx), mix(h(xi, yi + 1), h(xi + 1, yi + 1), sx), sy);
  }
  /* a wrapping box blur, two passes each way */
  function blurT(A, N, r) {
    let a = A.slice(), b = new Float32Array(A.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < N; y++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * N + (k + N) % N]; for (let x = 0; x < N; x++) { b[y * N + x] = s / (2 * r + 1); s += a[y * N + (x + r + 1) % N] - a[y * N + (x - r + N) % N]; } }
      for (let x = 0; x < N; x++) { let s = 0; for (let k = -r; k <= r; k++) s += b[((k + N) % N) * N + x]; for (let y = 0; y < N; y++) { a[y * N + x] = s / (2 * r + 1); s += b[((y + r + 1) % N) * N + x] - b[((y - r + N) % N) * N + x]; } }
    }
    return a;
  }
  return { tex, mud, PAL };
})();
