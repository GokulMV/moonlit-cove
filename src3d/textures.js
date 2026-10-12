/* ─────────────────────────────────────────────────────────────
   textures.js — tileable procedural textures, built once at load.
   noise (256²):  R fbm-low · G fbm-mid · B white grain · A fbm-detail
   water (512²):  RG ripple slope · B ripple height · A foam lace
   ───────────────────────────────────────────────────────────── */
const Textures = (() => {
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* periodic value-noise lattice */
  function lattice(n, r) { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = r(); return a; }
  function vnoise(lat, n, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const a = lat[y0 * n + x0], b = lat[y0 * n + x1], c = lat[y1 * n + x0], d = lat[y1 * n + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  function fbm(size, base, octaves, seed) {
    const r = rng(seed), out = new Float32Array(size * size);
    const lats = []; for (let o = 0; o < octaves; o++) lats.push(lattice(base << o, r));
    let norm = 0; for (let o = 0; o < octaves; o++) norm += Math.pow(0.5, o);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let v = 0, amp = 1;
      for (let o = 0; o < octaves; o++) {
        const f = (base << o) / size;
        v += amp * vnoise(lats[o], base << o, x * f, y * f); amp *= 0.5;
      }
      out[y * size + x] = v / norm;
    }
    return out;
  }
  function stretch(a) {           // normalise to 0..1
    let lo = 1e9, hi = -1e9; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) / (hi - lo || 1);
    return a;
  }

  function noise() {
    const N = 256, out = new Uint8Array(N * N * 4), r = rng(7);
    const a = stretch(fbm(N, 4, 6, 11)), b = stretch(fbm(N, 8, 5, 23)), d = stretch(fbm(N, 16, 4, 37));
    for (let i = 0; i < N * N; i++) {
      out[i * 4] = a[i] * 255; out[i * 4 + 1] = b[i] * 255; out[i * 4 + 2] = r() * 255; out[i * 4 + 3] = d[i] * 255;
    }
    return { size: N, data: out };
  }

  /* worley distances, periodic over the tile; returns F1 (and F2-F1 when edge=true) */
  function worley(N, cells, r, edge = true) {
    const pts = new Float32Array(cells * cells * 2);
    for (let i = 0; i < cells * cells; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); }
    const out = new Float32Array(N * N), cs = N / cells;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = x / cs, gy = y / cs, cx = Math.floor(gx), cy = Math.floor(gy);
      let f1 = 9, f2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const ix = cx + i, iy = cy + j, wx = ((ix % cells) + cells) % cells, wy = ((iy % cells) + cells) % cells;
        const px = ix + pts[(wy * cells + wx) * 2], py = iy + pts[(wy * cells + wx) * 2 + 1];
        const dd = Math.hypot(px - gx, py - gy);
        if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
      }
      out[y * N + x] = edge ? f2 - f1 : f1;
    }
    return out;
  }

  function water() {
    const N = 512, r = rng(101);
    const h = new Float32Array(N * N), gx = new Float32Array(N * N), gy = new Float32Array(N * N);
    /* ripple spectrum: integer wave-vectors keep it tileable */
    const waves = [];
    for (let i = 0; i < 64; i++) {
      const ang = Math.PI + (r() - 0.5) * 1.3 + (r() < 0.25 ? (r() - 0.5) * 2.2 : 0);   // mostly westward
      const k = 3 + Math.pow(r(), 1.5) * 30;
      const kx = Math.round(Math.cos(ang) * k), ky = Math.round(Math.sin(ang) * k);
      if (!kx && !ky) continue;
      const kk = Math.hypot(kx, ky);
      waves.push({ kx, ky, amp: Math.pow(kk, -1.55), ph: r() * Math.PI * 2 });
    }
    const tw = 2 * Math.PI / N, M = waves.length;
    /* sin(a + b) from tables of the x part and the y part of each wave's phase: no trig in the inner loop */
    const SX = new Float32Array(M * N), CX = new Float32Array(M * N), SY = new Float32Array(M * N), CY = new Float32Array(M * N);
    waves.forEach((w, j) => { for (let t = 0; t < N; t++) { const ax = w.kx * t * tw, ay = w.ky * t * tw + w.ph; SX[j * N + t] = Math.sin(ax); CX[j * N + t] = Math.cos(ax); SY[j * N + t] = Math.sin(ay); CY[j * N + t] = Math.cos(ay); } });
    const AMP = Float32Array.from(waves, w => w.amp), KX = Float32Array.from(waves, w => w.kx * w.amp * tw), KY = Float32Array.from(waves, w => w.ky * w.amp * tw);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0, dx = 0, dy = 0;
      for (let j = 0; j < M; j++) {
        const sx = SX[j * N + x], cx = CX[j * N + x], sy = SY[j * N + y], cy = CY[j * N + y];
        const sn = sx * cy + cx * sy, cs = cx * cy - sx * sy;
        v += AMP[j] * sn; dx += KX[j] * cs; dy += KY[j] * cs;
      }
      const i = y * N + x; h[i] = v; gx[i] = dx; gy[i] = dy;
    }
    let gmax = 0; for (let i = 0; i < N * N; i++) gmax = Math.max(gmax, Math.abs(gx[i]), Math.abs(gy[i]));
    stretch(h);
    /* foam: A = bubble-hole lace (high = foam survives), B = marbled network (domain-warped cell edges) */
    const w1 = worley(N, 12, r, false), w2 = worley(N, 30, r, false), w3 = worley(N, 64, r, false);
    const f = stretch(fbm(N, 8, 4, 303));
    const wa = stretch(fbm(N, 4, 4, 404)), wb = stretch(fbm(N, 4, 4, 505));
    const net = new Float32Array(N * N);
    {
      const cells = 9, pts = new Float32Array(cells * cells * 2), cs = N / cells;
      for (let i = 0; i < cells * cells; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const gx2 = (x + (wa[i] - 0.5) * 70) / cs, gy2 = (y + (wb[i] - 0.5) * 70) / cs;
        const cx = Math.floor(gx2), cy = Math.floor(gy2);
        let f1 = 9, f2 = 9;
        for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
          const ix = cx + k, iy = cy + j, wx = ((ix % cells) + cells) % cells, wy = ((iy % cells) + cells) % cells;
          const dd = Math.hypot(ix + pts[(wy * cells + wx) * 2] - gx2, iy + pts[(wy * cells + wx) * 2 + 1] - gy2);
          if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
        }
        net[i] = f2 - f1;
      }
    }
    const out = new Uint8Array(N * N * 4);
    for (let i = 0; i < N * N; i++) {
      let L = Math.min(w1[i] / 0.62, w2[i] / 0.58 + 0.18, w3[i] / 0.6 + 0.38);
      L = L * (0.72 + 0.56 * f[i]);
      const nw = Math.max(0, 1 - net[i] / 0.42) * (0.75 + 0.4 * f[i]);
      out[i * 4] = 128 + 127 * gx[i] / gmax; out[i * 4 + 1] = 128 + 127 * gy[i] / gmax;
      out[i * 4 + 2] = Math.min(1, nw) * 255; out[i * 4 + 3] = Math.min(1, L) * 255;
    }
    return { size: N, data: out, slopeScale: gmax };
  }

  /* sand relief (512²): RG gradient of isotropic fbm bumps · B wind-ripple slope · A grain */
  function sand() {
    const N = 512, r = rng(909), h = stretch(fbm(N, 6, 5, 919));
    const w1 = stretch(fbm(N, 3, 3, 929)), w2 = stretch(fbm(N, 5, 3, 939));
    const out = new Uint8Array(N * N * 4);
    let gm = 0; const gx = new Float32Array(N * N), gy = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, xr = y * N + (x + 1) % N, xl = y * N + (x + N - 1) % N, yd = ((y + 1) % N) * N + x, yu = ((y + N - 1) % N) * N + x;
      gx[i] = (h[xr] - h[xl]) * 0.5; gy[i] = (h[yd] - h[yu]) * 0.5; gm = Math.max(gm, Math.abs(gx[i]), Math.abs(gy[i]));
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      /* wind ripples: warped crests with bifurcations, ~24 per tile */
      const ph = (x * 0.94 + y * 0.34) / N * Math.PI * 2 * 24 + (w1[i] - 0.5) * 9 + (w2[i] - 0.5) * 5;
      const rip = Math.cos(ph) * (0.55 + 0.45 * Math.sin(w2[i] * 9.0));
      out[i * 4] = 128 + 127 * gx[i] / gm; out[i * 4 + 1] = 128 + 127 * gy[i] / gm;
      out[i * 4 + 2] = 128 + 127 * rip; out[i * 4 + 3] = r() * 255;
    }
    return { size: N, data: out };
  }

  /* tileable 3D value-noise fbm (R8, 64³) for the volumetric fire */
  function noise3() {
    const N = 64, out = new Uint8Array(N * N * N), r = rng(313);
    const lat = (n) => { const g = new Float32Array(n * n * n); for (let i = 0; i < g.length; i++) g[i] = r(); return g; };
    const octs = [[4, lat(4), 0.5], [8, lat(8), 0.27], [16, lat(16), 0.15], [32, lat(32), 0.08]];
    const sm = t => t * t * (3 - 2 * t);
    let mn = 1e9, mx = -1e9; const tmp = new Float32Array(N * N * N);
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0;
      for (const [n, g, a] of octs) {
        const fx = x / N * n, fy = y / N * n, fz = z / N * n, ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
        const tx = sm(fx - ix), ty = sm(fy - iy), tz = sm(fz - iz), I = (a, b, c) => g[((c % n) * n + (b % n)) * n + (a % n)];
        const c00 = I(ix, iy, iz) + (I(ix + 1, iy, iz) - I(ix, iy, iz)) * tx, c10 = I(ix, iy + 1, iz) + (I(ix + 1, iy + 1, iz) - I(ix, iy + 1, iz)) * tx;
        const c01 = I(ix, iy, iz + 1) + (I(ix + 1, iy, iz + 1) - I(ix, iy, iz + 1)) * tx, c11 = I(ix, iy + 1, iz + 1) + (I(ix + 1, iy + 1, iz + 1) - I(ix, iy + 1, iz + 1)) * tx;
        v += a * ((c00 + (c10 - c00) * ty) + ((c01 + (c11 - c01) * ty) - (c00 + (c10 - c00) * ty)) * tz);
      }
      const i = (z * N + y) * N + x; tmp[i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    for (let i = 0; i < tmp.length; i++) out[i] = Math.round((tmp[i] - mn) / (mx - mn) * 255);
    return { size: N, data: out };
  }
  return { noise, water, sand, rng, noise3 };
})();
