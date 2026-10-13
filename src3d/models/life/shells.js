/* what the tide leaves along the beach, for picking up and turning over: a starfish, a scallop's valve, a cowrie,
   a spired whelk. Each at the origin in metres, lying the way it lies on the sand (+y up). o.tone picks a colour
   ([r, g, b], linear) where the beach has several */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  /* ── a starfish: five tapering arms, domed and studded along them with blunt spines, paler at their tips; beneath, a
     groove down each arm lined with tube feet, and the mouth at the middle ── */
  M.add('life/star', (o = {}) => {
    const g = new T.Group(), r = M.rng(o.seed || 3), base = o.tone || lin('#e0602a'), R = 0.07, tw = (r() - 0.5) * 0.2;
    const pale = mix(base, lin('#f4c58a'), 0.55), deep = base.map(v => v * 0.55);
    /* the outline: five arms, rounded at their tips (rad 0..1 of R) */
    const arm = th => { const a = ((th + tw * Math.sin(th * 3)) * 5 / TAU) % 1, d = Math.min(a, 1 - a) * 2; return Math.pow(Math.max(0, 1 - d), 1.6); };
    const rad = th => 0.24 + 0.76 * arm(th) * (0.96 + 0.06 * Math.sin(th * 2 + 1.3));
    /* the upper side: a dome along each arm; the lower, nearly flat, with its groove */
    const top = (rho, th) => { const Rr = rad(th), q = Math.min(1, rho / Rr); return R * (0.17 * Math.pow(1 - q * q, 0.55) * (0.45 + 0.55 * Rr) + 0.012); };
    const up = M.sheet(46, 260, (s, c) => { const th = c * TAU, rho = s * rad(th) * R; return [Math.cos(th) * rho, top(rho / R, th) * Math.pow(1 - s, 0.12), Math.sin(th) * rho]; },
      (s, c) => { const th = c * TAU, ar = arm(th), mid = Math.exp(-(((1 - ar) / 0.25) ** 2)); let col = mix(base, deep, 0.25 * (1 - s) + 0.2 * (1 - mid));
        col = mix(col, pale, Math.pow(s, 4) * 0.8); return col.map(v => v * (0.9 + 0.2 * M.vn(th * 9, s * 30, 2))); });
    const dn = M.sheet(46, 260, (s, c) => { const th = c * TAU, rho = s * rad(th) * R, ar = arm(th), groove = Math.exp(-(((1 - ar) / 0.09) ** 2)) * (1 - s) * 0.004;
      return [Math.cos(th) * rho, 0.0015 + groove * (s > 0.15 ? 1 : s / 0.15), Math.sin(th) * rho]; },
      (s, c) => { const th = c * TAU, ar = arm(th), groove = Math.exp(-(((1 - ar) / 0.12) ** 2)); let col = mix(mix(base, lin('#f3d6a8'), 0.55), lin('#e8b878'), groove * 0.6);
        if (s < 0.08) col = mix(col, lin('#5a3022'), 1 - s / 0.08); return col; });
    /* (turn the lower sheet to face down) */
    { const I = dn.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = dn.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; }
    const parts = [{ geo: up }, { geo: dn }];
    /* the spines: a row down the middle of each arm and one either side, smaller toward the tips */
    const knob = new T.SphereGeometry(1, 10, 7);
    for (let k = 0; k < 5; k++) {
      const th0 = (k / 5) * TAU - tw * Math.sin(((k / 5) * TAU) * 3) * 0.2;
      for (const [off, sz, n, s1] of [[0, 1, 9, 0.92], [0.16, 0.72, 7, 0.62], [-0.16, 0.72, 7, 0.62]]) for (let i = 0; i < n; i++) {
        const s = 0.14 + (i + 0.5) / n * (s1 - 0.14), th = th0 + off * (1.0 - s) * 0.85, rho = s * rad(th) * R, h = top(rho / R, th) * Math.pow(1 - s, 0.12), sc = R * 0.034 * sz * (1.15 - 0.75 * s);
        const c = mix(mix(base, pale, 0.65), lin('#fff1dc'), 0.25 * r());
        parts.push({ geo: knob, m: M.M4(Math.cos(th) * rho, h + sc * 0.25, Math.sin(th) * rho, 0, 0, 0, sc, sc * 0.8, sc), c });
      }
    }
    /* the madreporite, a pale sieve plate off the middle */
    parts.push({ geo: knob, m: M.M4(R * 0.07, top(0.07, 0.6) + 0.0006, R * 0.04, 0, 0, 0, R * 0.03, R * 0.008, R * 0.03), c: lin('#f6e6c8') });
    /* tube feet down each groove beneath */
    const foot = new T.CylinderGeometry(0.0009, 0.0011, 0.004, 6, 1); foot.translate(0, -0.002, 0);
    const tipG = new T.SphereGeometry(0.0012, 6, 4);
    for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) for (let i = 0; i < 14; i++) {
      const s = 0.12 + i / 14 * 0.78, th = (k / 5) * TAU + sd * 0.025 / (s + 0.1), rho = s * rad(th) * R, len = 0.75 + 0.5 * r();
      parts.push({ geo: foot, m: M.M4(Math.cos(th) * rho, 0.0012, Math.sin(th) * rho, (r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6, 1, len, 1), c: lin('#f2d9a0') });
      parts.push({ geo: tipG, m: M.M4(Math.cos(th) * rho, 0.0012 - 0.004 * len, Math.sin(th) * rho), c: lin('#ffe9b8') });
    }
    const mesh = new T.Mesh(M.mergeC(parts), M.lit('#ffffff', { vertexColors: true, roughness: 0.66 }));
    g.add(mesh); return g;
  });

  /* ── a scallop's valve: a ribbed fan from the hinge with its two ears, banded in pinks and creams outside, glossy
     white within with a flush of colour at the edge ── */
  M.add('life/scallop', (o = {}) => {
    const g = new T.Group(), r = M.rng(o.seed || 5), ribs = 17 + Math.floor(r() * 5), L = 0.07, tone = o.tone || lin('#e79c8a');
    const bandA = tone, bandB = mix(tone, lin('#f5ece0'), 0.65), dark = tone.map(v => v * 0.6);
    /* (s from the hinge to the edge, c across the fan) */
    const spread = 1.25, rib = c => Math.cos(c * TAU * ribs * 0.5), rr = s => L * s;
    const outer = (s, c) => {
      const th = (c - 0.5) * 2 * spread, R = rr(s) * (1 + 0.035 * rib(c - 0.5) * s), edge = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(th) / (spread * 1.02), 4)));
      const dome = L * 0.36 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + s * 0.84)), 0.75) * Math.pow(edge, 0.6) * (1 - 0.2 * s);
      return [Math.sin(th) * R, dome + L * 0.055 * Math.pow(0.5 + 0.5 * rib(c - 0.5), 1.5) * Math.min(1, s * 1.4), L * 0.5 - Math.cos(th) * R];
    };
    const out = M.sheet(40, 160, outer, (s, c) => {
      const band = 0.5 + 0.5 * Math.sin(s * 14 + Math.sin(c * 9) * 0.5 + (o.seed || 5)), rb = 0.5 + 0.5 * rib(c - 0.5);
      const ray = 0.5 + 0.5 * Math.sin((c - 0.5) * 9 + 1.7);
      let col = mix(bandB, bandA, band * 0.7 + 0.3 * ray); col = mix(col, dark, 0.35 * (1 - rb) * s); col = mix(col, lin('#fff7ef'), 0.22 * rb * s);
      /* growth lines: fine paler rings */
      col = col.map(v => v * (0.92 + 0.12 * Math.pow(0.5 + 0.5 * Math.sin(s * 140), 6)));
      return col;
    });
    const inner = M.sheet(40, 160, (s, c) => { const p = outer(s, c), d = L * 0.008 * Math.min(1, s * 6); return [p[0], p[1] - d - L * 0.05 * Math.pow(0.5 + 0.5 * rib(c - 0.5), 1.5) * Math.min(1, s * 1.4) * (s > 0.85 ? 1 : 0.6), p[2]]; },
      (s, c) => mix(lin('#fbf6ef'), mix(tone, lin('#ffffff'), 0.35), Math.pow(s, 5) * 0.8));
    { const I = inner.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = inner.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; }
    /* the two ears either side of the hinge */
    const ear = sd => M.sheet(8, 12, (s, c) => { const x = sd * (0.004 + s * L * 0.2), z = L * 0.5 - L * 0.02 - c * L * 0.16 * (1 - 0.6 * s); return [x, L * 0.025 * (1 - s) + 0.0012, z]; },
      (s, c) => mix(bandB, bandA, 0.3 + 0.3 * Math.sin(c * 30)).map(v => v * (0.9 + 0.1 * Math.sin(s * 40))));
    const m1 = M.mergeC([{ geo: out }, { geo: ear(1) }, { geo: ear(-1) }]);
    const shellM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5, side: T.DoubleSide }), innerM = M.litP('#ffffff', { vertexColors: true, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.15 });
    g.add(new T.Mesh(m1, shellM), new T.Mesh(inner, innerM));
    return g;
  });

  /* ── a cowrie: a glossy dome, spotted, a pale line down its back; beneath, the long toothed slit of its mouth ── */
  let cowrieTex = null;
  function cowriePaint() {
    /* (u along it across, the way round down: the top of its back at the middle, its underside at the edges) */
    const W = 512, Hh = 256, cv = M.canvas(W, Hh), x = cv.getContext('2d'), r = M.rng(41);
    const gr = x.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#f4ece0'); gr.addColorStop(0.2, '#e8cfa8'); gr.addColorStop(0.5, '#d9b07a'); gr.addColorStop(0.8, '#e8cfa8'); gr.addColorStop(1, '#f4ece0');
    x.fillStyle = gr; x.fillRect(0, 0, W, Hh);
    /* the spots: dark brown, blurred at their edges, crowded on the back, few and small toward the sides */
    for (let i = 0; i < 150; i++) {
      const v = 0.5 + (r() - 0.5) * 0.62 * (0.4 + 0.6 * r()), u = 0.05 + r() * 0.9, rad = (6 + r() * 16) * (1 - 1.2 * Math.abs(v - 0.5));
      if (rad < 2) continue;
      const g2 = x.createRadialGradient(u * W, v * Hh, rad * 0.2, u * W, v * Hh, rad);
      g2.addColorStop(0, 'rgba(58,32,18,0.95)'); g2.addColorStop(0.65, 'rgba(70,40,22,0.85)'); g2.addColorStop(1, 'rgba(90,55,30,0)');
      x.fillStyle = g2; x.beginPath(); x.ellipse(u * W, v * Hh, rad * 1.25, rad * 0.8, r() * 3, 0, Math.PI * 2); x.fill();
    }
    /* the pale line along its back, where the mantle's two halves met */
    x.fillStyle = 'rgba(246,234,214,0.8)'; x.fillRect(W * 0.08, Hh * 0.5 - 2.5, W * 0.84, 5);
    /* beneath: white, with the orange-brown teeth either side of the slit */
    for (const v0 of [0.02, 0.98]) for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(190,105,50,0.85)'; x.fillRect(W * (0.12 + i / 26 * 0.76), v0 * Hh - 4, 5, 8); }
    const t = Mats.tex(cv); t.userData.keep = true; return t;
  }
  M.add('life/cowrie', (o = {}) => {
    const g = new T.Group(), L = 0.055;
    cowrieTex = cowrieTex || cowriePaint();
    const geo = M.loft([[-L / 2, 0, 0, L * 0.18, 2], [-L * 0.45, L * 0.14, L * 0.12, L * 0.19, 2], [-L * 0.3, L * 0.27, L * 0.24, L * 0.22, 2.1], [0, L * 0.32, L * 0.29, L * 0.24, 2.15], [L * 0.28, L * 0.28, L * 0.25, L * 0.22, 2.1], [L * 0.44, L * 0.15, L * 0.13, L * 0.19, 2], [L / 2, 0, 0, L * 0.18, 2]],
      72, 96, null, { shape: (x, y, z, u, a) => {
        /* the underside flattened, and the slit pressed in along it, with its teeth either side */
        if (Math.cos(a) < 0) { const cy = L * 0.22, k = -Math.cos(a); let yy = cy + (y - cy) * (1 - 0.8 * k);
          const sl = Math.exp(-((z / (L * 0.022)) ** 2)) * (1 - Math.pow(Math.abs(x) / (L / 2), 4)), teeth = 0.5 + 0.5 * Math.cos(x / L * 90);
          yy += L * 0.022 * sl - L * 0.004 * teeth * Math.exp(-(((Math.abs(z) - L * 0.03) / (L * 0.012)) ** 2)); return [x, yy, z]; }
        return null; } });
    g.add(new T.Mesh(geo, M.litP('#ffffff', { map: cowrieTex, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 })));
    g.position.y = -L * 0.07;
    const w = new T.Group(); w.add(g); return w;
  });

  /* ── a whelk: a tall spire of six and a half whorls, each rounded and wound with spiral cords crossed by fine growth
     lines, cream and fawn with a band of brown; the mouth oval, its outer lip a little thickened, glossy white and apricot
     within, drawn down at the base into the short open canal of the siphon. Right-handed: held point up with its mouth
     toward you, the mouth is on the right ── */
  M.add('life/whelk', (o = {}) => {
    const g = new T.Group(), lite = !!o.lite, NW = 6.5, Wg = 1.85, k = Math.log(Wg) / TAU, th1 = NW * TAU, th0 = 1.2;
    const A = 0.0068, RA = 0.0082, RB = 0.0112, D = 0.0405, TH = 0.0007;
    const gr = th => Math.exp(k * (th - th1));
    const centre = th => { const sc = gr(th); return new T.Vector3(A * sc * Math.cos(th), -D * sc, A * sc * Math.sin(th)); };
    const tone = o.tone || lin('#cfb48a'), BROWN = lin('#6e4a2e'), CREAM = lin('#f1e6d2');
    const relief = (th, ph) => lite ? 1 : 1 + 0.03 * Math.pow(Math.max(0, Math.cos(ph * 14)), 2) + 0.012 * Math.max(0, Math.sin(th * 34)) * 0.6 + 0.005 * Math.sin(th * 83);
    const surf = (th, ph, inset = 0) => {
      const sc = gr(th), c = centre(th), lip = 1 + 0.05 * Math.pow(Math.max(0, (th - (th1 - 0.35)) / 0.35), 2), f = inset ? 1 : relief(th, ph);
      const cp = Math.cos(ph), sp = Math.sin(ph);
      /* (the siphonal canal: the base of the last half whorl drawn down and a little out) */
      const cw = Math.max(0, (th - (th1 - Math.PI)) / Math.PI), canal = Math.pow(Math.max(0, -sp - 0.3) / 0.7, 2) * cw * cw;
      const rr = (RA * sc * lip * f - inset) * cp * (1 - 0.25 * canal), yy = (RB * sc * lip * f - inset) * sp * (1 + 0.32 * canal);
      return [c.x + rr * Math.cos(th), c.y + yy, c.z + rr * Math.sin(th)];
    };
    const ns = lite ? 160 : 620, nc = lite ? 13 : 56;
    const outer = M.sheet(ns, nc, (s, c) => surf(th0 + s * (th1 - th0), c * TAU), (s, c, p) => {
      const th = th0 + s * (th1 - th0), ph = c * TAU, sp = Math.sin(ph);
      let col = mix(tone, BROWN, 0.75 * Math.exp(-(((sp - 0.15) / 0.24) ** 2)));          /* the brown band round each whorl */
      col = mix(col, CREAM, lite ? 0.15 : 0.32 * Math.pow(Math.max(0, Math.cos(ph * 14)), 2));
      col = mix(col, BROWN, 0.18 * (0.5 + 0.5 * Math.sin(th * 5.1 + 1.3 * M.vn(th, ph, 2))));
      col = mix(col, lin('#e4dccd'), Math.max(0, 1 - th / (2.2 * TAU)) * 0.7);            /* worn toward the apex */
      return col.map(v => v * (0.9 + 0.18 * M.vn(p[0] * 2200, p[1] * 2200, p[2] * 2200)));
    });
    const inA = th1 - 1.1 * TAU, inner = M.sheet(lite ? 24 : 110, nc, (s, c) => surf(inA + s * (th1 - inA), c * TAU, TH * (0.4 + 0.6 * s)), (s) => mix(lin('#ece2d6'), lin('#e9a777'), Math.max(0, (s - 0.7) / 0.3) * 0.6));
    const lip = M.sheet(lite ? 3 : 8, nc, (u, c) => { const a2 = surf(th1, c * TAU), b2 = surf(th1, c * TAU, TH), n = centre(th1).sub(centre(th1 - 0.02)).normalize(), bulge = Math.sin(Math.PI * u) * TH * 0.6;
      return [a2[0] + (b2[0] - a2[0]) * u + n.x * bulge, a2[1] + (b2[1] - a2[1]) * u + n.y * bulge, a2[2] + (b2[2] - a2[2]) * u + n.z * bulge]; }, () => lin('#f3e9dc'));
    const flip = q => { const I = q.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = q.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; return q; };
    { const N = outer.attributes.normal, j = (ns - 4) * (nc + 1), v = new T.Vector3(N.getX(j), N.getY(j), N.getZ(j)), pp = new T.Vector3().fromBufferAttribute(outer.attributes.position, j), cc = centre(th0 + (ns - 4) / ns * (th1 - th0)); if (v.dot(pp.sub(cc)) < 0) flip(outer); else flip(inner); }
    { const N = lip.attributes.normal, i = Math.floor(lip.attributes.position.count / 2), v = new T.Vector3(N.getX(i), N.getY(i), N.getZ(i)), n = centre(th1).sub(centre(th1 - 0.02)).normalize(); if (v.dot(n) < 0) flip(lip); }
    const tip = M.paint(new T.SphereGeometry(RB * gr(th0) * 1.2, 8, 6), () => lin('#e4dccd')); tip.translate(...centre(th0).toArray());
    const outerAll = M.mergeC([{ geo: outer }, { geo: lip }, { geo: tip }]);
    /* (lying on its side on the sand, as a whelk does, its mouth down a little) */
    for (const q of [outerAll, inner]) { q.rotateZ(Math.PI / 2 - 0.25); q.rotateX(-0.5); }
    /* (the shift worked out once: translating the first updates its bounding box) */
    outerAll.computeBoundingBox(); const bb = outerAll.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, cy = bb.min.y;
    for (const q of [outerAll, inner]) q.translate(-cx, -cy, -cz);
    g.add(new T.Mesh(outerAll, M.litP('#ffffff', { vertexColors: true, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 })));
    g.add(new T.Mesh(inner, M.litP('#ffffff', { vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 })));
    return g;
  });
})();
