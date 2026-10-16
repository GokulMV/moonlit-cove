/* ─────────────────────────────────────────────────────────────
   models/struct/outrigger.js — a fishing canoe of the Konkan
   coast, pulled up the beach above the tide. A long narrow hull,
   a dugout's round bottom built up with a plank along each side,
   its ends drawn up to a point and capped with a little deck, the
   bow's stem standing up as a beak; painted in bands, tar black or
   red below, a white boot stripe at the waterline, the topsides
   bright, the sheer strake another colour with a pin stripe under
   it, a chevron at the bow, its name and its number painted on.
   Inside, thwarts across on risers, ribs, a heap of nylon net
   with its float line, two paddles. Two booms of timber are laid
   across its gunwales and lashed there with coir, bending down
   over the sand to the float, a log shaped to a point at its
   front, each boom pegged to it on a pair of stanchions lashed
   where they meet. A bow line runs out to a stake in the sand.
   Weathered as such boats are: the paint chalky in the sun,
   chipped at the rims and scraped off along the keel where it is
   dragged up the sand, older colours showing under the chips, a
   green stain along the waterline, sand inside.
   Its bow toward +x, its keel on the ground (y = 0) at its middle,
   its float on the side o.side (±1, z).
   opts: { seed, livery (0–5: its colours, its name, its lines),
   side, lite (for far off: its hull, booms and float in fewer
   facets, nothing inside but its floor) }
   userData.info: { len, beam, zf (the float's line, from the hull's),
   fx0, fx1 (the float's ends) }
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t, sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  /* each boat's colours and its lines: [below, boot stripe, topsides, sheer strake, pin stripe, inside, the colour it was
     before (under the chips), its float], its name and number, and its hull: length, beam, depth, how much its sheer
     rises at the bow and the stern, its keel's rocker at either end */
  const LIVERIES = [
    { c: ['#2a201a', '#ebe5d6', '#1f5e98', '#e0b63c', '#c23b2a', '#5f8fa8', '#8a3a2a', '#2a201a'], name: 'SAGAR RANI', no: '0457', L: 6.6, B: 0.74, D: 0.62, rb: 0.32, rs: 0.21, kb: 0.15, ks: 0.1 },
    { c: ['#7a2a20', '#f0ead9', '#2f7a4c', '#efe6cf', '#1f3f6a', '#6a8c6a', '#2a5e8c', '#efe6cf'], name: 'JALPARI', no: '1182', L: 6.1, B: 0.7, D: 0.58, rb: 0.28, rs: 0.18, kb: 0.13, ks: 0.09 },
    { c: ['#231d19', '#efe7d2', '#c43a2b', '#1e4f84', '#efd05a', '#7d93a8', '#2f6e4a', '#1e4f84'], name: 'SEA QUEEN', no: '0921', L: 7.1, B: 0.78, D: 0.65, rb: 0.36, rs: 0.23, kb: 0.16, ks: 0.11 },
    { c: ['#7c2b22', '#e9e2cf', '#e0b43a', '#2a6b88', '#b8362a', '#8aa0a8', '#3a6e9c', '#2a6b88'], name: 'SAGARIKA', no: '0316', L: 6.4, B: 0.72, D: 0.6, rb: 0.3, rs: 0.2, kb: 0.14, ks: 0.1 },
    { c: ['#2a2420', '#e8e0cc', '#2d8c8c', '#e9e2d0', '#c8402e', '#6f8f99', '#b8862e', '#2a2420'], name: 'NEELA MOTI', no: '1407', L: 6.9, B: 0.76, D: 0.63, rb: 0.34, rs: 0.22, kb: 0.15, ks: 0.1 },
    { c: ['#6e2620', '#ede6d4', '#e6e0d0', '#2a5f9a', '#c63c2c', '#6e8ea4', '#4f7a3a', '#6e2620'], name: 'SINDHU', no: '0738', L: 6.2, B: 0.71, D: 0.59, rb: 0.29, rs: 0.19, kb: 0.13, ks: 0.09 }
  ];
  const rgb = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
  const lin = c => c.map(v => Math.pow(v, 2.2));
  /* (a cheap value noise of our own, for the paint's wear: integer hash, smooth between) */
  const H2 = (a, b, k) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(k | 0, 0x1b873593); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  const vn2 = (x, y, k) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, fu = u * u * (3 - 2 * u), fv = v * v * (3 - 2 * v), a = H2(i, j, k), b = H2(i + 1, j, k), c = H2(i, j + 1, k), d = H2(i + 1, j + 1, k); return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv; };
  const fb2 = (x, y, k) => 0.5 * vn2(x, y, k) + 0.3 * vn2(x * 2.07, y * 2.07, k + 7) + 0.2 * vn2(x * 4.3, y * 4.3, k + 13);

  /* ── the hull's lines, s along it (0 the stern's point, 1 the bow's) ── */
  function lines(Lv) {
    const { L, B, D, rb, rs, kb, ks } = Lv;
    const ts = s => 2 * s - 1;
    /* half its breadth at the sheer: full through the middle, fine at the ends (finer forward), never quite nothing */
    const hb = s => { const t = ts(s), a = Math.abs(t); return Math.max(0.03, (B / 2) * Math.pow(Math.max(0, 1 - Math.pow(a, t > 0 ? 2.1 : 2.7)), 0.58)); };
    /* the keel's height (its rocker, lifting toward the ends) and the sheer's (sweeping up at them) */
    const kl = s => { const t = ts(s), a = Math.abs(t); return (t > 0 ? kb : ks) * Math.pow(Math.max(0, a - 0.3) / 0.7, 2); };
    const sh = s => { const t = ts(s), a = Math.abs(t); return D + (t > 0 ? rb : rs) * Math.pow(a, 3.2); };
    /* the section: a rounded U amidships, a V toward the ends (a superellipse's quarter, from the keel to the sheer) */
    const ex = s => { const a = Math.abs(ts(s)); return 2 / (1.6 + 1.25 * (1 - a * a)); };
    const xs = s => (s - 0.5) * L;
    /* a point of the skin: s along, f round from the keel (0) to the sheer (1), side ±1 */
    const skin = (s, f, side, out = [0, 0, 0]) => {
      const e = ex(s), ph = f * Math.PI / 2, b = hb(s), k = kl(s), h = sh(s);
      out[0] = xs(s); out[1] = k + (h - k) * (1 - Math.pow(Math.cos(ph), e)); out[2] = side * b * Math.pow(Math.sin(ph), e);
      return out;
    };
    return { L, B, D, hb, kl, sh, xs, skin, yw: 0.2 };
  }

  /* ── its paint, round both sides of it (the starboard side the top half of the picture, the port the bottom; in each,
     the sheer at the top and the keel at the foot, v by height, u along it), worn ── */
  const TEX = new Map(), YM = 1.06;
  function hullTex(li) {
    if (TEX.has(li)) return TEX.get(li);
    const Lv = LIVERIES[li], S = lines(Lv), [cBot, cBoot, cTop, cSheer, cPin, , cOld] = Lv.c;
    const W = 2048, H = 512, cv = M.canvas(W, H), a = cv.getContext('2d', { willReadFrequently: true });
    const row = (half, y) => half * 256 + 256 * (1 - y / YM), col = s => s * W;
    const along = (half, f, s0 = 0, s1 = 1, n = 256) => { for (let i = 0; i <= n; i++) { const s = s0 + (s1 - s0) * i / n, y = row(half, f(s)); i ? a.lineTo(col(s), y) : a.moveTo(col(s), y); } };
    for (const half of [0, 1]) {
      const r0 = half * 256;
      a.save(); a.beginPath(); a.rect(0, r0, W, 256); a.clip();
      a.fillStyle = cTop; a.fillRect(0, r0, W, 256);
      /* (the sheer strake, its pin stripe; the seam where the plank meets the dugout under it) */
      a.fillStyle = cSheer; a.beginPath(); along(half, s => S.sh(s) - 0.15); a.lineTo(W, r0); a.lineTo(0, r0); a.closePath(); a.fill();
      a.strokeStyle = cPin; a.lineWidth = 5; a.beginPath(); along(half, s => S.sh(s) - 0.168); a.stroke();
      a.strokeStyle = 'rgba(22,15,10,0.6)'; a.lineWidth = 2; a.beginPath(); along(half, s => S.sh(s) - 0.31, 0.05, 0.95); a.stroke();
      a.strokeStyle = 'rgba(22,15,10,0.35)'; a.lineWidth = 1.5; a.beginPath(); along(half, s => S.sh(s) - 0.012); a.stroke();
      /* (the boot stripe at the waterline, and below it the bottom) */
      const yb = row(half, S.yw), yt = row(half, S.yw + 0.045);
      a.fillStyle = cBoot; a.fillRect(0, yt, W, yb - yt); a.fillStyle = cBot; a.fillRect(0, yb, W, r0 + 256 - yb);
      /* (a chevron of the sheer's colour at the bow, and a narrower one at the stern) */
      a.fillStyle = cSheer; a.beginPath(); a.moveTo(col(0.992), row(half, S.sh(0.992) - 0.15)); a.lineTo(col(0.84), row(half, S.sh(0.84) - 0.15)); a.lineTo(col(0.955), row(half, S.yw + 0.07)); a.lineTo(col(0.992), row(half, S.yw + 0.07)); a.closePath(); a.fill();
      a.strokeStyle = cPin; a.lineWidth = 4; a.beginPath(); a.moveTo(col(0.835), row(half, S.sh(0.835) - 0.17)); a.lineTo(col(0.952), row(half, S.yw + 0.07)); a.stroke();
      a.fillStyle = cSheer; a.beginPath(); a.moveTo(col(0.008), row(half, S.sh(0.008) - 0.15)); a.lineTo(col(0.1), row(half, S.sh(0.1) - 0.15)); a.lineTo(col(0.03), row(half, S.yw + 0.08)); a.lineTo(col(0.008), row(half, S.yw + 0.08)); a.closePath(); a.fill();
      /* (its name, hand-lettered on the topsides forward, and its number under it; mirrored on the port side, so that it
         reads the right way round from either side) */
      const x0 = col(0.6), x1 = col(0.82), mid = (x0 + x1) / 2, yN = row(half, S.sh(0.71) - 0.25), yR = row(half, S.sh(0.71) - 0.36);
      a.save();
      if (half) { a.translate(2 * mid, 0); a.scale(-1, 1); }
      a.fillStyle = '#f4efe2'; a.strokeStyle = 'rgba(20,14,10,0.55)'; a.lineWidth = 3; a.textAlign = 'center'; a.textBaseline = 'middle';
      a.font = `700 ${Math.round(256 * 0.1 / YM)}px 'Arial Black', 'Helvetica Neue', Arial, sans-serif`;
      a.strokeText(Lv.name, mid, yN); a.fillText(Lv.name, mid, yN);
      a.font = `700 ${Math.round(256 * 0.062 / YM)}px Arial, Helvetica, sans-serif`;
      a.fillText('IND-GA-01-MM-' + Lv.no, mid, yR);
      a.restore();
      a.restore();
    }
    /* the wear, texel by texel: the paint chalky where the sun gets it most, chipped at the rims and the ends, scraped off
       along the keel; an older colour under the chips here, the wood there; a green stain along the waterline */
    const img = a.getImageData(0, 0, W, H), Dd = img.data, old = rgb(cOld).map(v => v * 255), wood = [128, 112, 92], stain = [74, 82, 52];
    for (let py = 0; py < H; py++) {
      const half = py < 256 ? 0 : 1, y = YM * (1 - (py - half * 256) / 256);
      for (let px = 0; px < W; px++) {
        const s = px / W, k = (py * W + px) * 4, x = s * Lv.L;
        const shY = S.sh(s), klY = S.kl(s);
        const n1 = fb2(x * 9, y * 9, 3 + half), n2 = vn2(x * 26, y * 26, 11 + half), n3 = vn2(x * 3, y * 7, 17);
        let r = Dd[k], g = Dd[k + 1], b = Dd[k + 2];
        /* (sun-faded, chalky, more up high) */
        const fade = (0.12 + 0.18 * sm(S.yw, shY, y)) * (0.6 + 0.8 * n3);
        r = mix(r, 236, fade * 0.35); g = mix(g, 232, fade * 0.35); b = mix(b, 222, fade * 0.35);
        /* (a stain along the waterline, in streaks) */
        const st = sm(S.yw + 0.16, S.yw + 0.05, y) * sm(S.yw - 0.01, S.yw + 0.05, y) * (0.3 + 0.7 * vn2(x * 14, y * 3, 23));
        r = mix(r, stain[0], st * 0.35); g = mix(g, stain[1], st * 0.35); b = mix(b, stain[2], st * 0.35);
        /* (chips: at the sheer's edge, toward the ends, and here and there; scraped bare along the keel) */
        const edge = sm(0.06, 0.0, Math.abs(y - shY)), ends = sm(0.12, 0.0, Math.min(s, 1 - s)), keel = sm(klY + 0.07, klY, y);
        const chipP = 0.08 + 0.55 * edge + 0.35 * ends;
        const chip = n1 + 0.25 * n2 > 1.02 - 0.42 * chipP;
        const scrape = keel * sm(0.45, 0.7, vn2(x * 40, y * 4, 29) * 0.7 + 0.3 * n2);
        if (chip || scrape > 0.5) {
          const under = !scrape && vn2(x * 5, y * 5, 31) > 0.45 ? old : wood, g2 = 0.85 + 0.3 * n2;
          r = under[0] * g2; g = under[1] * g2; b = under[2] * g2;
        }
        /* (grime toward the bottom and in the paint's grain) */
        const grime = 0.9 + 0.1 * n2 - 0.08 * sm(S.yw, 0.0, y);
        Dd[k] = clamp(r * grime, 0, 255); Dd[k + 1] = clamp(g * grime, 0, 255); Dd[k + 2] = clamp(b * grime, 0, 255);
      }
    }
    a.putImageData(img, 0, 0);
    const t = Mats.tex(cv, { aniso: 8 }); t.userData.keep = true; TEX.set(li, t); return t;
  }
  /* (the inside: worn paint over the wood, the same picture for every boat, tinted by its own colour) */
  let innerT = null, netT = null;
  function innerTex() {
    if (innerT) return innerT;
    const W = 512, Hh = 512, cv = M.canvas(W, Hh), a = cv.getContext('2d'), im = a.createImageData(W, Hh), Dd = im.data;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const k = (y * W + x) * 4, n1 = fb2(x / 22, y / 22, 41), n2 = vn2(x / 6, y / 60, 43), n3 = vn2(x / 3, y / 3, 47), n4 = vn2(x / 2, y / 14, 49);
      /* (the paint scuffed thin here and there, the wood's grain showing faintly through it, never in blotches) */
      const v = 0.88 + 0.07 * n3 + 0.05 * (n2 - 0.5), worn = sm(0.6, 0.8, n1) * (0.35 + 0.3 * n4);
      const wd = [0.78 * (0.9 + 0.2 * n2), 0.7 * (0.9 + 0.2 * n2), 0.6 * (0.9 + 0.2 * n2)], c = [mix(v, wd[0], worn), mix(v, wd[1], worn), mix(v, wd[2], worn)];
      Dd[k] = 255 * c[0]; Dd[k + 1] = 255 * c[1]; Dd[k + 2] = 255 * c[2]; Dd[k + 3] = 255;
    }
    a.putImageData(im, 0, 0);
    innerT = Mats.tex(cv, { repeat: true }); innerT.userData.keep = true; return innerT;
  }
  /* (nylon net: green twine knotted in diamonds, darker gaps between, the picture tiled over the heap) */
  function netTex() {
    if (netT) return netT;
    const cv = M.canvas(128, 128), a = cv.getContext('2d');
    a.fillStyle = '#16231d'; a.fillRect(0, 0, 128, 128);
    a.strokeStyle = '#4d7a5c'; a.lineWidth = 2.2;
    for (let i = -128; i < 256; i += 16) { a.beginPath(); a.moveTo(i, 0); a.lineTo(i + 128, 128); a.stroke(); a.beginPath(); a.moveTo(i + 128, 0); a.lineTo(i, 128); a.stroke(); }
    a.fillStyle = '#6f9a78'; for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) a.fillRect(x - 1.5, y - 1.5, 3, 3);
    netT = Mats.tex(cv, { repeat: true }); netT.userData.keep = true; return netT;
  }
  const MAT = {}, mat = (k, f) => MAT[k] || (MAT[k] = f());

  /* ── a grid surface from rows of points (each row a line across), its normals smooth, its uvs given ── */
  function surface(rows, uvs, cols, flip) {
    const nr = rows.length, nc = rows[0].length / 3, P = new Float32Array(nr * nc * 3), U = new Float32Array(nr * nc * 2), C = cols ? new Float32Array(nr * nc * 3) : null, I = [];
    for (let i = 0; i < nr; i++) { P.set(rows[i], i * nc * 3); U.set(uvs[i], i * nc * 2); if (C) C.set(cols[i], i * nc * 3); }
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) { const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; if (flip) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2)); if (C) g.setAttribute('color', new T.BufferAttribute(C, 3));
    g.setIndex(I); g.setAttribute('normal', new T.BufferAttribute(M.normalsOf(P, I), 3)); g.computeBoundingSphere(); return g;
  }

  M.add('struct/outrigger', (o = {}) => {
    const g = new T.Group(), R = M.rng((o.seed || 1) * 131 + 7), li = ((o.livery ?? 0) % LIVERIES.length + LIVERIES.length) % LIVERIES.length, Lv = LIVERIES[li], S = lines(Lv), side = o.side < 0 ? -1 : 1, lite = !!o.lite;
    const { L, hb, kl, sh, xs, skin } = S, TH = 0.04;
    const hullM = mat('hull' + li, () => Mats.lit({ map: hullTex(li), vertexColors: true, roughness: 0.66 }));
    const insideC = lin(rgb(Lv.c[5]));
    /* ── the hull: its outside, a row across it every so often along it, from the port sheer under the keel to the
       starboard sheer; the keel's points shared, so it is smooth under it, but each side's uv its own ── */
    const NS = lite ? 22 : 72, NF = lite ? 6 : 16, q = [0, 0, 0];
    {
      const rows = [], uvs = [], cols = [];
      /* (the welded skin first, for its normals) */
      for (let i = 0; i <= NS; i++) {
        const s = 0.002 + 0.996 * i / NS, r = [], u = [], c = [];
        for (let j = 0; j <= 2 * NF; j++) {
          const sd = j < NF ? -1 : 1, f = Math.abs(j - NF) / NF; skin(s, f, sd, q); r.push(q[0], q[1], q[2]);
          /* (a little darker toward the keel and in under the turn of the bilge: the light off the sand reaches it less) */
          const ao = 0.78 + 0.22 * sm(0, 0.6, f); c.push(ao, ao, ao);
          u.push(s, 0);
        }
        rows.push(r); uvs.push(u); cols.push(c);
      }
      const welded = surface(rows, uvs, cols, false), WN = welded.attributes.normal.array, WP = welded.attributes.position.array;
      /* (then unwelded along the keel: each side its own points there, with the welded normal) */
      const nc = 2 * NF + 2, P = [], N = [], U = [], C = [], I = [];
      for (let i = 0; i <= NS; i++) {
        const s = 0.002 + 0.996 * i / NS;
        for (let j = 0; j <= 2 * NF; j++) {
          const w = (i * (2 * NF + 1) + j) * 3, reps = j === NF ? [-1, 1] : [j < NF ? -1 : 1];
          for (const sd of reps) { const y = WP[w + 1]; P.push(WP[w], y, WP[w + 2]); N.push(WN[w], WN[w + 1], WN[w + 2]); U.push(s, sd > 0 ? 0.5 + 0.5 * y / YM : 0.5 * y / YM); C.push(...cols[i].slice(j * 3, j * 3 + 3)); }
        }
      }
      for (let i = 0; i < NS; i++) for (let j = 0; j < nc - 1; j++) { if (j === NF) continue; const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1; I.push(a, c, b, b, c, d); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new T.Float32BufferAttribute(C, 3)); geo.setIndex(I); geo.computeBoundingSphere();
      const hm = new T.Mesh(geo, hullM); hm.castShadow = hm.receiveShadow = true; g.add(hm);
      welded.dispose();
    }
    /* ── the inside: the skin again, its thickness in, from where the ends close to the bulkheads; the rim along its top;
       the ends' little decks over the points ── */
    const sA = 0.075, sB = 0.925;
    const inner = (s, f, sd, out = [0, 0, 0]) => {
      skin(s, f, sd, out); const e = 0.004, a = skin(s, Math.min(1, f + e), sd, [0, 0, 0]), b = skin(s, Math.max(0, f - e), sd, [0, 0, 0]);
      /* (in along the section's own normal) */
      const dy = a[1] - b[1], dz = a[2] - b[2], l = Math.hypot(dy, dz) || 1, ny = -dz / l * sd, nz = dy / l * sd;
      out[1] -= ny * TH * (f < 0.02 ? 1.4 : 1); out[2] -= nz * TH; if (Math.abs(out[2]) < 0.004) out[2] = 0;
      return out;
    };
    {
      const NSi = lite ? 12 : 54, NFi = lite ? 4 : 12, rows = [], uvs = [], cols = [];
      for (let i = 0; i <= NSi; i++) {
        const s = mix(sA, sB, i / NSi), r = [], u = [], c = [];
        for (let j = 0; j <= 2 * NFi; j++) {
          const sd = j < NFi ? -1 : 1, f = Math.abs(j - NFi) / NFi; inner(s, f, sd, q); r.push(q[0], q[1], q[2]);
          /* (its own colour, darker down in the bottom, with sand in it) */
          const dn = 1 - f, sand = sm(0.55, 0.95, dn) * (0.5 + 0.5 * vn2(q[0] * 3, q[2] * 9, 53));
          const ao = 0.62 + 0.38 * sm(0.0, 0.9, f);
          c.push(mix(insideC[0] * ao, 0.42, sand * 0.7), mix(insideC[1] * ao, 0.36, sand * 0.7), mix(insideC[2] * ao, 0.26, sand * 0.7));
          u.push(q[0] / 1.2, (j - NFi) / NFi * 0.5);
        }
        rows.push(r); uvs.push(u); cols.push(c);
      }
      const geo = surface(rows, uvs, cols, true);
      const im = new T.Mesh(geo, mat('inside', () => Mats.lit({ map: innerTex(), vertexColors: true, roughness: 0.88 }))); im.castShadow = false; im.receiveShadow = true; g.add(im);
      /* (the rim: the plank's top edge, each side, painted as the sheer strake is) */
      const rimC = lin(rgb(Lv.c[3]));
      for (const sd of [-1, 1]) {
        const rr = [], ru = [], rc = [];
        for (let i = 0; i <= NSi; i++) { const s = mix(sA, sB, i / NSi), a = skin(s, 1, sd, [0, 0, 0]), b = inner(s, 1, sd, [0, 0, 0]); rr.push([a[0], a[1], a[2], b[0], b[1] + 0.002, b[2]]); ru.push([s, 0, s, 1]); rc.push([...rimC.map(v => v * 0.9), ...rimC.map(v => v * 0.8)]); }
        const rg = surface(rr, ru, rc, sd < 0); const rm = new T.Mesh(rg, mat('rim' + li, () => Mats.lit({ vertexColors: true, roughness: 0.7 }))); rm.castShadow = true; rm.receiveShadow = true; g.add(rm);
      }
      /* (the bulkheads closing the hollow at either end, and the decks over the points, cambered) */
      const deckC = lin(rgb(Lv.c[3]));
      for (const [s0, s1] of [[sB, 0.998], [sA, 0.002]]) {
        const bp = [], bi = [], ctr = [xs(s0), sh(s0), 0];
        bp.push(...ctr);
        for (let j = 0; j <= 2 * NFi; j++) { const sd = j < NFi ? -1 : 1, f = Math.abs(j - NFi) / NFi; inner(s0, f, sd, q); bp.push(q[0], q[1], q[2]); }
        for (let j = 0; j < 2 * NFi; j++) bi.push(0, j + 1, j + 2);
        const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(bp, 3)); bg.setIndex(bi); bg.computeVertexNormals();
        const bc = new Float32Array(bp.length).fill(0); for (let k = 0; k < bc.length; k += 3) { bc[k] = insideC[0] * 0.8; bc[k + 1] = insideC[1] * 0.8; bc[k + 2] = insideC[2] * 0.8; }
        bg.setAttribute('color', new T.BufferAttribute(bc, 3)); bg.setAttribute('uv', new T.BufferAttribute(new Float32Array(bp.length / 3 * 2), 2));
        const bm = new T.Mesh(bg, mat('bulk', () => Mats.lit({ vertexColors: true, roughness: 0.85, side: T.DoubleSide }))); bm.receiveShadow = true; g.add(bm);
        const dr = [], du = [], dc = [], nd = lite ? 4 : 10;
        for (let i = 0; i <= nd; i++) { const s = mix(s0, s1, i / nd), b = hb(s), y = sh(s), r = [], u = [], c = [];
          for (let j = 0; j <= 6; j++) { const w = j / 6 * 2 - 1; r.push(xs(s), y + 0.012 + 0.025 * (1 - w * w) * b / (Lv.B / 2), w * b * 1.004); u.push(s, w); c.push(...deckC.map(v => v * (0.85 + 0.1 * (1 - Math.abs(w))))); }
          dr.push(r); du.push(u); dc.push(c); }
        const dg = surface(dr, du, dc, s1 > s0); const dm = new T.Mesh(dg, mat('rim' + li, () => Mats.lit({ vertexColors: true, roughness: 0.7 }))); dm.castShadow = dm.receiveShadow = true; g.add(dm);
      }
    }
    /* ── the gunwale's rubbing strip along each side, and the bow's stem standing up out of the point as a beak, the stern's
       lower ── */
    const woodM = mat('wood', () => Mats.lit({ map: Mats.tex(Paint.driftwood(), { repeat: true }), color: new T.Color(0.95, 0.86, 0.74), roughness: 0.92 }));
    const paintM = mat('paint' + li, () => Mats.lit({ color: new T.Color(...lin(rgb(Lv.c[3]))), roughness: 0.62 }));
    if (!lite) for (const sd of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 40; i++) { const s = 0.03 + 0.94 * i / 40; skin(s, 1, sd, q); pts.push(new T.Vector3(q[0], q[1] - 0.03, q[2] + sd * 0.012)); }
      const rub = new T.Mesh(M.tube(new T.CatmullRomCurve3(pts), 120, 6, () => 0.02, { sx: 0.6, sy: 1 }), paintM); rub.castShadow = true; g.add(rub);
    }
    {
      const xb = xs(1), yb = sh(0.995), shp = new T.Shape();
      shp.moveTo(-0.34, -0.12); shp.quadraticCurveTo(-0.12, -0.05, 0.02, 0.06); shp.quadraticCurveTo(0.07, 0.12, 0.05, 0.19); shp.lineTo(0.0, 0.2); shp.quadraticCurveTo(-0.05, 0.1, -0.2, 0.04); shp.lineTo(-0.34, 0.0); shp.closePath();
      const sg = M.extrude(shp, 0.05, 0.012); const st = new T.Mesh(sg, paintM); st.position.set(xb - 0.02, yb - 0.02, 0); st.castShadow = true; g.add(st);
      const xa = xs(0), ya = sh(0.005), sh2 = new T.Shape();
      sh2.moveTo(0.26, -0.1); sh2.quadraticCurveTo(0.08, -0.04, -0.01, 0.04); sh2.lineTo(-0.03, 0.09); sh2.lineTo(0.0, 0.1); sh2.quadraticCurveTo(0.1, 0.04, 0.26, 0.0); sh2.closePath();
      const sg2 = M.extrude(sh2, 0.045, 0.01); const st2 = new T.Mesh(sg2, paintM); st2.position.set(xa + 0.02, ya - 0.02, 0); st2.castShadow = true; g.add(st2);
    }
    /* ── the float: a log shaped to a point in front, its nose turned up, blunter behind, lying on the sand off to one side ── */
    const rF = 0.105 + 0.015 * R(), Lf = L * 0.6, xF = L * 0.05, zf = side * (1.95 + 0.25 * R()), cyF = rF * 0.93;
    {
      const sec = [[-Lf / 2, 0.012, 0.012, cyF + 0.03, 2], [-Lf / 2 + 0.1, 0.5 * rF, 0.46 * rF, cyF + 0.012, 2], [-Lf / 2 + 0.45, 0.92 * rF, 0.88 * rF, cyF, 2.15], [0, rF, 0.96 * rF, cyF, 2.2],
        [Lf / 2 - 0.85, 0.94 * rF, 0.9 * rF, cyF + 0.004, 2.15], [Lf / 2 - 0.4, 0.62 * rF, 0.58 * rF, cyF + 0.035, 2], [Lf / 2 - 0.12, 0.26 * rF, 0.25 * rF, cyF + 0.1, 2], [Lf / 2, 0.02, 0.02, cyF + 0.14, 2]];
      const fc = lin(rgb(Lv.c[7])), fw = [0.5, 0.44, 0.36];
      const fg = M.loft(sec, lite ? 14 : 40, lite ? 7 : 18, (x, y, z, u) => {
        /* (painted, the paint worn thin over its top where it is handled and dragged, mottled, sand dried on its foot) */
        const n = vn2(x * 2.2, (y + z) * 9, 61), top = sm(cyF + 0.3 * rF, cyF + rF, y), wear = sm(0.45, 0.9, n * 0.7 + 0.3 * top) * 0.55, low = sm(cyF - 0.3 * rF, cyF - rF, y), lv = 0.92 + 0.12 * vn2(x * 7, (y + z) * 20, 67);
        const c = [mix(fc[0], fw[0], wear) * lv, mix(fc[1], fw[1], wear) * lv, mix(fc[2], fw[2], wear) * lv]; return [mix(c[0], 0.44, low * 0.55), mix(c[1], 0.38, low * 0.55), mix(c[2], 0.28, low * 0.55)];
      });
      const fm = new T.Mesh(fg, mat('float', () => Mats.lit({ vertexColors: true, roughness: 0.78 }))); fm.position.set(xF, 0, zf); fm.castShadow = fm.receiveShadow = true; g.add(fm);
    }
    /* ── the booms: across the gunwales, lashed to them, bending down to the float, each pegged to it on two stanchions ── */
    const yTop = cyF + 0.96 * rF, ropeM = mat('rope', () => Mats.lit({ color: new T.Color(0.33, 0.22, 0.12), roughness: 1 }));
    const booms = [];
    for (const sb of [0.37, 0.63]) {
      const xb0 = xs(sb), hbB = hb(sb), shB = sh(sb), xbF = xF + (sb < 0.5 ? -0.3 : 0.3) * Lf / 2 * 0.95;   /* (its end over the float, a little in from the float's ends) */
      const yEnd = yTop + 0.26;
      const pts = [[xb0, shB + 0.04, -side * (hbB + 0.25)], [xb0, shB + 0.045, -side * hbB * 0.3], [xb0, shB + 0.042, side * (hbB + 0.04)],
        [mix(xb0, xbF, 0.35), mix(shB, yEnd, 0.35) + 0.02, side * mix(hbB, Math.abs(zf), 0.35)], [xbF, yEnd, zf - side * 0.12], [xbF, yEnd - 0.02, zf + side * 0.14]].map(p => new T.Vector3(...p));
      const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
      const bm = new T.Mesh(M.tube(curve, lite ? 10 : 40, lite ? 5 : 9, t => 0.042 - 0.008 * t, { caps: true }), woodM); bm.castShadow = true; bm.receiveShadow = true; g.add(bm);
      booms.push({ curve, xb0, xbF, hbB, shB, yEnd });
      if (lite) continue;
      /* (the stanchions: a pair from the float's top up to the boom, pegged in, lashed where they meet it) */
      for (const dx of [-0.12, 0.12]) {
        const a = new T.Vector3(xbF + dx, yTop - 0.015, zf), b = new T.Vector3(xbF + dx * 0.15, yEnd - 0.03, zf);
        const st = new T.Mesh(M.tube(new T.LineCurve3(a, b), 2, 6, () => 0.02, { caps: true }), woodM); st.castShadow = true; g.add(st);
        const peg = new T.Mesh(new T.CylinderGeometry(0.028, 0.03, 0.02, 8), ropeM); peg.position.copy(a); g.add(peg);
      }
      for (let k = 0; k < 4; k++) { const ring = new T.Mesh(new T.TorusGeometry(0.05, 0.009, 5, 14), ropeM); ring.position.set(xbF, yEnd - 0.035, zf + (k - 1.5) * 0.02); ring.scale.set(1, 1.3, 1); g.add(ring); }
      /* (lashed down to each gunwale: turns of coir round the boom and the plank under it) */
      for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
        const ring = new T.Mesh(new T.TorusGeometry(0.05, 0.008, 5, 14), ropeM); ring.position.set(xb0, shB + 0.005, sd * (hbB - TH * 0.5) + (k - 1.5) * 0.02); ring.scale.set(1, 1.7, 1); g.add(ring);
      }
    }
    if (!lite) {
      /* ── inside: thwarts across (one under each boom, one between), on risers along each side; ribs ── */
      const halfAt = (s, y) => { let best = 0, bd = 9; for (let k = 0; k <= 30; k++) { inner(s, k / 30, 1, q); const d = Math.abs(q[1] - y); if (d < bd) { bd = d; best = q[2]; } } return best; };
      for (const st of [0.37, 0.5, 0.63]) {
        const y = sh(st) - 0.07, w = halfAt(st, y) * 2 + 0.01, th = new T.Mesh(new T.BoxGeometry(0.17, 0.032, w), woodM); th.position.set(xs(st), y, 0); th.castShadow = th.receiveShadow = true; g.add(th);
      }
      for (const sd of [-1, 1]) {
        const pts = []; for (let i = 0; i <= 24; i++) { const s = mix(sA + 0.05, sB - 0.05, i / 24), y = sh(s) - 0.095; pts.push(new T.Vector3(xs(s), y, sd * (halfAt(s, y) - 0.008))); }
        const rs = new T.Mesh(M.tube(new T.CatmullRomCurve3(pts), 48, 5, () => 0.017, { sx: 1, sy: 0.55 }), woodM); rs.receiveShadow = true; g.add(rs);
      }
      for (let s = sA + 0.05; s < sB - 0.03; s += 0.4 / L) {
        const pts = []; for (let k = 0; k <= 16; k++) { const f = Math.abs(k - 8) / 8, sd = k < 8 ? -1 : 1; inner(s, Math.min(0.97, f), sd, q); const l = Math.hypot(q[2], q[1] - kl(s) - TH); pts.push(new T.Vector3(q[0], q[1] + 0.006, q[2] - sd * 0.006 * (l > 0 ? 1 : 0))); }
        const rb = new T.Mesh(M.tube(new T.CatmullRomCurve3(pts), 24, 5, () => 0.012), woodM); rb.receiveShadow = true; g.add(rb);
      }
      /* ── the net, heaped on the bottom amidships, its float line of white and orange floats over it, and the paddles ── */
      {
        const nx = xs(0.47), ny = kl(0.47) + TH + 0.02, w = halfAt(0.47, ny + 0.12) * 0.9, hg = new T.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), P = hg.attributes.position;
        for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k), n = vn2(x * 3 + 5, z * 3, 71) * 0.7 + vn2(x * 9, z * 9 + y * 4, 73) * 0.3;
          /* (heaped into the hull's round bottom: never wider at a height than the inside is there) */
          const yy = y * (0.13 + 0.12 * n) + 0.01, wz = Math.min(w * (0.9 + 0.15 * n), halfAt(0.47 + x * 0.62 / L, ny + yy) * 0.96);
          P.setXYZ(k, x * 0.62, yy, z * wz); }
        hg.computeVertexNormals();
        const uv = hg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 9, uv.getY(k) * 3);
        const net = new T.Mesh(hg, mat('net', () => Mats.lit({ map: netTex(), roughness: 0.95 }))); net.position.set(nx, ny, 0); net.castShadow = net.receiveShadow = true; g.add(net);
        const fl = []; for (let k = 0; k <= 12; k++) { const t = k / 12, a = t * Math.PI * 1.6 + 0.4; fl.push(new T.Vector3(nx + Math.cos(a) * 0.5 * (0.7 + 0.3 * t), ny + 0.2 + 0.03 * Math.sin(a * 2), Math.sin(a) * w * 0.7)); }
        const line = new T.CatmullRomCurve3(fl), lm = new T.Mesh(M.tube(line, 60, 4, () => 0.006), ropeM); g.add(lm);
        const buoyW = mat('buoyW', () => Mats.lit({ color: new T.Color(0.82, 0.8, 0.74), roughness: 0.5 })), buoyO = mat('buoyO', () => Mats.lit({ color: new T.Color(0.85, 0.28, 0.05), roughness: 0.5 }));
        for (let k = 0; k < 9; k++) { const p = line.getPointAt((k + 0.5) / 9), b = new T.Mesh(new T.SphereGeometry(0.035, 10, 7), k % 3 ? buoyW : buoyO); b.position.copy(p); b.scale.set(1.2, 0.85, 0.85); b.castShadow = true; g.add(b); }
      }
      for (const [s0, s1, zz, ry] of [[0.22, 0.43, 0.08, 0.06], [0.25, 0.45, -0.1, -0.05]]) {
        const a = new T.Vector3(xs(s0), sh(s0) - 0.05, zz * Lv.B), b = new T.Vector3(xs(s1), kl(s1) + TH + 0.2, -zz * Lv.B * 0.6), dir = b.clone().sub(a), len = dir.length(); dir.normalize();
        const pd = new T.Group(); pd.position.copy(a); pd.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), dir); pd.rotateX(ry * 8); g.add(pd);
        const shaft = new T.Mesh(new T.CylinderGeometry(0.017, 0.019, len * 0.72, 8), woodM); shaft.rotation.z = Math.PI / 2; shaft.position.x = len * 0.36; shaft.castShadow = true; pd.add(shaft);
        const blade = new T.Mesh(new T.CylinderGeometry(1, 1, 0.014, 18), woodM); blade.scale.set(0.23, 1, 0.075); blade.rotation.x = Math.PI / 2; blade.position.x = len * 0.72 + 0.2; blade.castShadow = true; pd.add(blade);
        const grip = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.12), woodM); grip.position.x = -0.01; pd.add(grip);
      }
      /* ── the bow line, run out over the sand to a stake ── */
      {
        const tip = new T.Vector3(xs(1) + 0.02, sh(0.995) + 0.12, 0), sx = xs(1) + 2.6, sz = 0.2 * side;
        const pts = [tip, new T.Vector3(tip.x + 0.35, 0.3, 0.02), new T.Vector3(tip.x + 0.9, 0.025, 0.06), new T.Vector3(tip.x + 1.7, 0.02, sz * 0.6), new T.Vector3(sx - 0.05, 0.03, sz), new T.Vector3(sx, 0.32, sz)];
        g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3(pts), 60, 5, () => 0.011), ropeM));
        const stake = new T.Mesh(new T.CylinderGeometry(0.03, 0.022, 0.62, 7), woodM); stake.position.set(sx + 0.05, 0.22, sz); stake.rotation.z = -0.28; stake.castShadow = true; g.add(stake);
      }
    }
    g.userData.info = { len: L, beam: Lv.B, zf, fx0: xF - Lf / 2, fx1: xF + Lf / 2, livery: li };
    return g;
  });
  Models.outriggerLiveries = LIVERIES.length;
})();
