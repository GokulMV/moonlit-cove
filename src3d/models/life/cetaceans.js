/* the two big ones offshore, for looking at up close (they are let go again, not thrown): a bottlenose dolphin, grey
   with a darker cape and a pale belly, its short beak and its smile, a small dark eye, the blowhole on top of its head,
   a curved dorsal fin, flippers and flukes; and a humpback whale, black above and mottled white below, the knobs on
   its head and chin, the long pleats down its throat, its great white flippers knobbled along their leading edges, a
   small dorsal fin on its hump, flukes with a ragged trailing edge, white and black beneath.
   The fins have thickness: aerofoils in section (Models.foil). Each at the origin in metres, its head toward +x, its
   back +y. userData.anim(t): the flukes beat, the flippers sway */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  /* a fin from its leading edge LE(s) and trailing edge TE(s), its thickness th(s), thicker toward up */
  const finOf = (n, m, LE, TE, up, th, paint) => M.foil(n, m, s => { const a = LE(s), b = TE(s); return { le: a, ch: sub(b, a), up: typeof up === 'function' ? up(s) : up, th: typeof th === 'function' ? th(s) : th }; }, paint);

  /* ── the bottlenose dolphin, 2.4 m ── */
  M.add('life/dolphin', () => {
    const g = new T.Group(), CAPE = lin('#2f363d'), FLANK = lin('#69737b'), BELLY = lin('#e6e0de'), DARK = lin('#1b1f23');
    const SECS = [[-1.12, 0, 0, 0, 2], [-1.09, 0.028, 0.05, 0, 1.9], [-0.95, 0.045, 0.098, 0.006, 1.75], [-0.75, 0.086, 0.152, 0.012, 1.85], [-0.4, 0.19, 0.245, 0.02, 2], [0.05, 0.255, 0.295, 0.02, 2],
      [0.42, 0.225, 0.255, 0.035, 2], [0.66, 0.17, 0.19, 0.035, 2.05], [0.8, 0.118, 0.128, 0.01, 2.1], [0.865, 0.074, 0.068, -0.036, 2.1], [0.96, 0.05, 0.044, -0.046, 2], [1.05, 0.03, 0.027, -0.05, 2], [1.09, 0, 0, -0.05, 2]];
    const prof = M.spline(SECS.map(r => [r[0], r[1], r[2], r[3]])), top = x => { const [, h, cy] = prof(x); return cy + h; };
    /* the cape's lower edge (as the cosine round the body, 1 along the top): high over the head, low under the fin, up again
       toward the tail */
    const capeAt = x => 0.55 - 0.42 * sm(0.75, 0.0, x) * (1 - sm(-0.25, -0.85, x)) + 0.12 * sm(-0.6, -1.0, x) - 0.3 * sm(0.55, 0.0, x) * sm(-0.3, 0.1, x) * 0;
    const body = M.loft(SECS, 120, 72, (x, y, z, u, a) => {
      const up = Math.cos(a), side = Math.abs(Math.sin(a)), cb = capeAt(x);
      let c = mix(FLANK, CAPE, sm(cb - 0.08, cb + 0.08, up));
      c = mix(c, BELLY, sm(-0.08, -0.5, up));
      /* a paler blaze up the flank below the fin; the beak darker on top */
      c = mix(c, mix(FLANK, BELLY, 0.35), 0.5 * Math.exp(-(((x + 0.3) / 0.25) ** 2)) * Math.exp(-(((up + 0.02) / 0.18) ** 2)));
      if (x > 0.86) c = mix(c, DARK, 0.5 * sm(0.0, 0.6, up));
      /* the eye's dark patch, a faint line from it toward the flipper, and the line of the mouth, curving up into a smile */
      const ex = x - 0.745, ey = y + 0.004;
      if (side > 0.6) c = mix(c, DARK, 0.85 * (1 - sm(0.018, 0.034, Math.hypot(ex, ey * 1.6))));
      if (side > 0.78 && x < 0.73 && x > 0.48) c = mix(c, DARK, 0.14 * Math.exp(-(((y + 0.03 + (0.73 - x) * 0.35) / 0.012) ** 2)));
      const mouth = -0.058 + (x - 0.86) * 0.12 + 0.03 * sm(0.86, 0.79, x);
      if (x > 0.79 && side > 0.35 && Math.abs(y - mouth) < 0.0045) c = mix(c, DARK, 0.8);
      return c.map(v => v * (0.97 + 0.05 * M.vn(x * 18, y * 18, z * 18)));
    }, { shape: (x, y, z, u, a) => { const mel = Math.exp(-(((x - 0.8) / 0.075) ** 2)) * Math.max(0, Math.cos(a)) * 0.034; return [x, y + mel, z]; } });
    const skinM = M.litP('#ffffff', { vertexColors: true, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.4 });
    g.add(new T.Mesh(body, skinM));
    /* the blowhole: a dark crescent on top of the head, opening forward */
    g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([-0.024, -0.012, 0, 0.012, 0.024].map(z => new T.Vector3(0.6 - (z * z) * 60, top(0.6) + 0.0015, z))), 10, 5, () => 0.0042), M.lit('#121518', { roughness: 0.5 })));
    /* the eyes: small and dark, wet, under a fold of lid */
    for (const sd of [-1, 1]) { const [w] = prof(0.745); const e = new T.Mesh(new T.SphereGeometry(0.0105, 14, 10), M.litP('#060606', { roughness: 0.05, clearcoat: 1 })); e.scale.set(1.2, 0.9, 0.6); e.position.set(0.745, -0.004, sd * (w - 0.004)); g.add(e); }
    const finM = M.litP('#ffffff', { vertexColors: true, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.4 });
    const finPaint = col => (x, y, z, s, c, isTop) => mix(col, CAPE, 0.4 * s).map(v => v * (0.97 + 0.05 * M.vn(x * 20, y * 20, z * 20)));
    /* the dorsal fin, falcate: its leading edge swept back, its trailing edge hollowed */
    g.add(new T.Mesh(finOf(16, 22, s => [0.12 - 0.46 * Math.pow(s, 1.5), top(0.12 - 0.46 * Math.pow(s, 1.5)) - 0.03 + 0.34 * s - 0.03 * s * s, 0],
      s => [-0.3 + 0.07 * Math.sin(Math.PI * s * 0.9) * (1 - 0.3 * s) - 0.045 * s * s * s, top(-0.3) - 0.03 + 0.33 * s, 0], [0, 0, 1], s => 0.17 - 0.07 * s, finPaint(CAPE)), finM));
    /* the flippers, pointed, swept back, held a little down */
    const flips = [];
    for (const sd of [-1, 1]) {
      const f = new T.Object3D(); f.position.set(0.44, -0.13, sd * 0.19); g.add(f);
      f.add(new T.Mesh(finOf(14, 20, s => [0.06 - 0.25 * Math.pow(s, 1.25), -0.11 * s - 0.03 * s * s, sd * 0.3 * s],
        s => [-0.11 - 0.12 * s - 0.02 * s * s * 0, -0.1 * s - 0.035 * s * s, sd * (0.29 * s + 0.01)], norm([0.05, 1, -sd * 0.3]), s => 0.16 - 0.06 * s, finPaint(mix(FLANK, CAPE, 0.4))), finM));
      flips.push({ f, sd });
    }
    /* the flukes, each lobe swept back to a point, a notch between them, on a tail stock that bends */
    const tail = new T.Object3D(); tail.position.x = -1.1; g.add(tail);
    for (const sd of [-1, 1]) tail.add(new T.Mesh(finOf(16, 20, s => [0.03 - 0.17 * Math.pow(s, 1.4), 0, sd * (0.004 + 0.33 * s)],
      s => { const c = (0.15 + 0.07 * Math.sin(Math.PI * Math.min(1, s / 0.75))) * Math.pow(1 - s, 0.55) + 0.015; return [0.03 - 0.17 * Math.pow(s, 1.4) - c - 0.03 * (1 - s) * (1 - s) * -1, 0, sd * (0.004 + 0.33 * s - 0.02 * s * (1 - s))]; },
      [0, 1, 0], s => 0.13 - 0.05 * s, finPaint(CAPE)), finM));
    g.userData.anim = t => { tail.rotation.z = 0.18 * Math.sin(t * 2.2); for (const f of flips) f.f.rotation.x = f.sd * 0.12 * Math.sin(t * 1.4); };
    g.userData.anim(0);
    return g;
  });

  /* ── the humpback, 13 m ──
     A long, robust body, deepest just behind the flippers and as wide as it is deep there (about 2.3 m on a 13 m whale),
     tapering behind the dorsal fin into a tail stock squeezed from the sides, with a ridge along its top and a keel
     beneath. The head is a third of it: seen from above a broad, rounded U, the rostrum flat on top and set with rows of
     knobs (tubercles), the lower jaw deep and bowed, wider than the upper jaw it closes round, its lip running back
     along the mouth to below the small eye, knobs along it and a cluster of them on the chin, crusted with barnacles.
     Two blowholes side by side behind a raised splash guard. The throat and chest are pleated from the chin back to the
     navel by twenty-odd long grooves, white, the furrows between them darker. A small dorsal fin two thirds of the way
     back stands on a hump, and behind it a row of knuckles runs down the top of the tail stock to the flukes. The
     flippers are a third as long as the whale, narrow, white, the leading edge scalloped by a row of big bumps; the
     flukes are broad (a third of its length again), swept back to pointed tips, notched in the middle, their trailing
     edge serrated; black above, white beneath with black marks of their own. Black above, the belly white and mottled,
     a few pale scars.
     The skin's markings and its relief (the grooves, the crease of the mouth, wrinkles, scars) are painted once into a
     colour map and a normal map; the knobs and barnacles are little solids of their own. o.lite: a light build for
     drawing far off (fauna.js): coarser, vertex-coloured, no knobs */
  const WHALE_SKIN = {};
  M.add('life/whale', (o = {}) => {
    const lite = !!o.lite, g = new T.Group();
    const BLACK = lin('#14171b'), DARK = lin('#262a2f'), GREYW = lin('#7d8287'), WHITE = lin('#e1e2de'), PALE = lin('#c3c6c5'), FUR = lin('#545a5f');
    const LEN = 13, X0 = 6.5, xOf = f => X0 - LEN * f, fOf = x => (X0 - x) / LEN;
    /* its sections along it, by f (0 at the tip of the snout, 1 at the notch of the flukes): how high its back stands
       over the middle line and how deep its belly hangs below it, its half-width, the middle line's height, and how
       square the top and the bottom are (2 an ellipse; more, flatter) */
    const PRO = M.spline([
      [0.040, 0.26, 0.54, 0.72, -0.28, 3.2, 2.4], [0.100, 0.42, 0.86, 0.95, -0.25, 3.2, 2.4], [0.150, 0.55, 1.06, 1.06, -0.21, 3.0, 2.4],
      [0.200, 0.70, 1.19, 1.14, -0.17, 2.7, 2.35], [0.250, 0.86, 1.27, 1.20, -0.13, 2.4, 2.3], [0.300, 1.00, 1.32, 1.26, -0.09, 2.25, 2.25],
      [0.380, 1.16, 1.30, 1.30, -0.03, 2.15, 2.15], [0.460, 1.21, 1.16, 1.25, 0.02, 2.1, 2.1], [0.540, 1.17, 0.96, 1.10, 0.05, 2.05, 2.0],
      [0.620, 1.04, 0.77, 0.86, 0.06, 2.0, 1.95], [0.700, 0.84, 0.62, 0.57, 0.05, 1.95, 1.85], [0.780, 0.65, 0.50, 0.35, 0.03, 1.9, 1.75],
      [0.860, 0.47, 0.38, 0.21, 0.01, 1.9, 1.75], [0.920, 0.32, 0.26, 0.16, 0.0, 2.0, 1.9], [0.960, 0.20, 0.17, 0.15, 0.0, 2.1, 2.0], [0.975, 0.15, 0.13, 0.14, 0.0, 2.1, 2.0]]);
    /* (rounded off at the snout, and where the tail stock runs into the flukes) */
    const capN = f => { const t = Math.min(1, f / 0.04); return Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); };
    const capT = f => { const t = Math.min(1, Math.max(0, (1 - f) / 0.025)); return Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))); };
    let pF = NaN, pP = null;
    const prof = f => { if (f === pF) return pP; const [hT, hB, w, cy, pT, pB] = PRO(f), k = capN(f) * capT(f); pF = f; return (pP = { hT: hT * k, hB: hB * k, w: w * k, cy, pT, pB }); };
    /* the mouth: how high round the side its line runs (as the cosine round the body, 1 along the top), from the snout
       back to its corner below the eye, and how much of a mouth there is there */
    const mU = f => -0.02 - 0.8 * f - 0.12 * sm(0.16, 0.215, f), jawK = f => sm(0.0, 0.012, f) * (1 - sm(0.19, 0.225, f));
    /* the throat grooves: below what height they run (from just under the lip back to the navel), and the place of a
       point among them (whole numbers on the furrows) */
    const pU = f => f < 0.2 ? mU(f) - 0.12 : -0.36 - 0.26 * sm(0.3, 0.52, f);
    const grooveK = f => sm(0.012, 0.04, f) * (1 - sm(0.46, 0.53, f)), NG = 22;
    const groove = (f, a) => {
      let b = a - Math.PI; b = Math.atan2(Math.sin(b), Math.cos(b));
      const bm = Math.acos(Math.max(-1, Math.min(1, -pU(f)))); if (Math.abs(b) > bm) return null;
      return { ph: (b + bm) / (2 * bm) * NG + 0.12 * Math.sin(f * 37 + b * 3), edge: sm(bm, bm * 0.8, Math.abs(b)) };
    };
    /* the eye, just above the corner of the mouth */
    const EYE = { f: 0.207, up: mU(0.207) + 0.085 };
    const KN = [[0.70, 0.07], [0.738, 0.065], [0.776, 0.058], [0.812, 0.05], [0.848, 0.042], [0.882, 0.034]];
    /* a point on its skin at (f, a): a round the body from the top (π/2 on the +z side) */
    function pt(f, a) {
      const P = prof(f), ca = Math.cos(a), sa = Math.sin(a), top = ca >= 0, e = 2 / (top ? P.pT : P.pB);
      let dy = (top ? P.hT : -P.hB) * Math.pow(Math.abs(ca), e), dz = P.w * Math.sign(sa) * Math.pow(Math.abs(sa), e);
      const up = ca, r = Math.max(0.03, Math.hypot(dy, dz));
      let dr = 0, ly = 0;
      /* the mouth: the rostrum a little narrower than the lower jaw closing round it; the jaw's lip rolled out along
         the line of the mouth, and the crease at it */
      const jk = jawK(f);
      if (jk > 0) {
        const m = mU(f);
        dz *= 1 - 0.07 * sm(m - 0.03, m + 0.05, up) * jk;
        dr += jk * (0.032 * Math.exp(-(((up - m + 0.05) / 0.05) ** 2)) - 0.02 * Math.exp(-(((up - m) / 0.016) ** 2)));
      }
      /* the grooves, a gentle swell on each pleat (their furrows are in the normal map) */
      if (!lite && grooveK(f) > 0) { const G = groove(f, a); if (G) dr -= 0.007 * grooveK(f) * G.edge * (0.5 + 0.5 * Math.cos(2 * Math.PI * G.ph)); }
      /* the splash guard, raised in front of the blowholes; the eye's socket; the shoulder the flipper grows from */
      if (top) ly += 0.055 * Math.exp(-(((f - 0.166) / 0.008) ** 2)) * Math.exp(-((dz / 0.22) ** 2));
      { const de = Math.hypot((f - EYE.f) * LEN, (up - EYE.up) * r * 1.3); if (de < 0.4 && Math.abs(sa) > 0.5) dr += 0.035 * Math.exp(-((de / 0.12) ** 2)); }
      dr += 0.07 * Math.exp(-(((f - 0.292) / 0.022) ** 2)) * Math.exp(-(((up + 0.42) / 0.16) ** 2));
      /* the hump the dorsal fin stands on; the ridge along the top of the tail stock, its knuckles, and the keel beneath */
      if (top) {
        const mid = Math.exp(-((dz / 0.11) ** 2));
        ly += 0.11 * Math.exp(-(((f - 0.632) / 0.032) ** 2)) * sm(0.2, 0.75, up);
        ly += 0.045 * sm(0.66, 0.72, f) * (1 - sm(0.93, 0.97, f)) * mid;
        for (const [fk, hk] of KN) ly += hk * Math.exp(-(((f - fk) / 0.0085) ** 2)) * mid;
      } else ly -= 0.04 * sm(0.7, 0.78, f) * (1 - sm(0.93, 0.97, f)) * Math.exp(-((dz / 0.07) ** 2));
      const k = 1 + dr / r;
      return [xOf(f), P.cy + dy * k + ly, dz * k];
    }
    /* how far along the rings are (closer at the head, where there is more to see) */
    const Fm = t => 0.55 * Math.pow(t, 1.6) + 0.45 * t, dFm = t => 0.88 * Math.pow(t, 0.6) + 0.45;
    /* its colours at (f, a), at the point (X, Y, Z) */
    function col(f, a, X, Y, Z) {
      const up = Math.cos(a), n1 = M.vn(X * 0.7 + 3, Y * 0.7, Z * 0.7), n2 = M.vn(X * 2.6, Y * 2.6 + 7, Z * 2.6);
      let c = mix(BLACK, DARK, 0.6 * n1 * n2 + 0.2 * n2);
      /* the white of the throat and belly, ragged where it meets the black, from the chin back to the navel; behind it
         white blotches under the tail stock */
      const reg = sm(0.004, 0.03, f) * (1 - sm(0.46, 0.6, f)), edge = -0.6 + 0.28 * sm(0.1, 0.3, f) - 0.3 * sm(0.32, 0.56, f) + 0.24 * (n1 - 0.5) + 0.1 * (n2 - 0.5);
      let wh = sm(edge + 0.05, edge - 0.09, up) * reg;
      wh = Math.max(wh, sm(-0.55, -0.85, up) * sm(0.5, 0.58, f) * (1 - sm(0.82, 0.93, f)) * sm(0.5, 0.66, n1) * 0.85);
      if (wh > 0) {
        let w = mix(WHITE, PALE, 0.5 * n2);
        const G = grooveK(f) > 0 ? groove(f, a) : null;
        if (G) { const d = Math.abs(G.ph - Math.round(G.ph)); w = mix(w, FUR, (1 - sm(0.05, 0.16, d)) * 0.8 * G.edge * grooveK(f)); }
        c = mix(c, w, wh);
      }
      /* the chin dark, and the mouth's line */
      if (f < 0.04 && up < -0.1) c = mix(c, DARK, 0.6 * (1 - sm(0.015, 0.04, f)));
      const jk = jawK(f); if (jk > 0) c = mix(c, mix(BLACK, [0, 0, 0], 0.5), jk * Math.exp(-(((up - mU(f)) / 0.01) ** 2)));
      /* the blowholes: two dark slits side by side, opening toward the front */
      if (up > 0.7 && f > 0.168 && f < 0.2) { for (const s of [-1, 1]) { const q = Math.abs(Z - s * (0.075 + 0.9 * (0.2 - f) * 1.0)); if (q < 0.022) c = mix(c, [0.01, 0.01, 0.012], (1 - q / 0.022) * sm(0.168, 0.172, f) * sm(0.2, 0.195, f)); } }
      /* the eye's dark patch */
      { const de = Math.hypot((f - EYE.f) * LEN, (up - EYE.up) * 1.6); if (de < 0.3) c = mix(c, BLACK, 0.5 * (1 - de / 0.3)); }
      /* pale scars: rake marks, two or three thin streaks side by side, here and there on its flanks and tail stock */
      if (f > 0.3 && f < 0.92 && up > -0.5) {
        const cellF = Math.floor(f * 9), cellA = Math.floor((a / TAU) * 7), h = M.vn(cellF * 3.7 + 0.5, cellA * 5.3 + 0.5, 11.1);
        if (h > 0.62) {
          const fc = (cellF + 0.5) / 9, ac = (cellA + 0.5) / 7 * TAU, ang = (h - 0.62) * 6, du = (f - fc) * LEN, dv = (Math.atan2(Math.sin(a - ac), Math.cos(a - ac))) * 1.3;
          const along = du * Math.cos(ang) + dv * Math.sin(ang), across = -du * Math.sin(ang) + dv * Math.cos(ang);
          if (Math.abs(along) < 0.55) { const k3 = across / 0.05, ln = Math.abs(k3 - Math.round(k3)); if (Math.abs(k3) < 1.6 && ln < 0.16) c = mix(c, GREYW, 0.55 * (1 - Math.abs(along) / 0.55)); }
        }
      }
      return c.map(v => v * (0.94 + 0.1 * n2));
    }
    /* its relief at (f, a), in metres: the furrows of the throat grooves, the crease of the mouth, the slits of the
       blowholes, fine wrinkles */
    function relief(f, a, X, Y, Z) {
      const up = Math.cos(a); let h = 0.0012 * (M.vn(X * 9, Y * 9, Z * 9) - 0.5) + 0.0006 * (M.vn(X * 31, Y * 31 + 4, Z * 31) - 0.5);
      if (grooveK(f) > 0) { const G = groove(f, a); if (G) { const d = Math.abs(G.ph - Math.round(G.ph)); h -= 0.014 * grooveK(f) * G.edge * (1 - sm(0.0, 0.14, d)); } }
      const jk = jawK(f); if (jk > 0) h -= 0.012 * jk * Math.exp(-(((up - mU(f)) / 0.012) ** 2));
      if (up > 0.7 && f > 0.168 && f < 0.2) for (const s of [-1, 1]) { const q = Math.abs(Z - s * (0.075 + 0.9 * (0.2 - f))); if (q < 0.03) h -= 0.03 * (1 - q / 0.03) * sm(0.168, 0.173, f) * sm(0.2, 0.194, f); }
      return h;
    }
    /* ── the body ── */
    const NR = lite ? 90 : 260, NA = lite ? 36 : 192;
    const body = M.loft([[-6.5, 1, 1, 0, 2], [6.5, 1, 1, 0, 2]], NR, NA, lite ? (x, y, z, u, a) => col(fOf(x), a, x, y, z) : null, { shape: (x, y, z, u, a) => pt(Fm(1 - u), a) });
    let skinM;
    if (lite) skinM = M.litP('#ffffff', { vertexColors: true, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    else {
      if (!WHALE_SKIN.map) {
        /* (the skin painted texel by texel: u along it from the tail to the snout, v round it from beneath, as the
           body's uv runs) */
        const TW = 1024, TH = 512, Hf = new Float32Array(TW * TH), Cf = new Float32Array(TW * TH * 3), sx = new Float32Array(TW), sy = new Float32Array(TW);
        for (let i = 0; i < TW; i++) {
          const u = (i + 0.5) / TW, f = Fm(1 - u), P = prof(f);
          sx[i] = 1 / (LEN * dFm(1 - u) / TW); sy[i] = 1 / (Math.max(0.2, Math.PI * (P.w + 0.5 * (P.hT + P.hB))) / TH);
          for (let j = 0; j < TH; j++) {
            const a = Math.PI + (j + 0.5) / TH * TAU, p = pt(f, a), c = col(f, a, p[0], p[1], p[2]), k = j * TW + i;
            Cf.set(c, k * 3); Hf[k] = relief(f, a, p[0], p[1], p[2]);
          }
        }
        const at = (i, j) => Hf[((j + TH) % TH) * TW + Math.max(0, Math.min(TW - 1, i))];
        WHALE_SKIN.map = M.texFrom(TW, TH, (u, v) => { const k = (Math.floor(v * TH) * TW + Math.floor(u * TW)) * 3; return [Cf[k], Cf[k + 1], Cf[k + 2]]; }, { repeat: true });
        WHALE_SKIN.nrm = M.texFrom(TW, TH, (u, v) => {
          const i = Math.floor(u * TW), j = Math.floor(v * TH), dx = (at(i + 1, j) - at(i - 1, j)) * 0.5 * sx[i], dy = (at(i, j + 1) - at(i, j - 1)) * 0.5 * sy[i], l = Math.hypot(dx, dy, 1);
          return [0.5 - 0.5 * dx / l, 0.5 - 0.5 * dy / l, 0.5 + 0.5 / l];
        }, { repeat: true });
      }
      skinM = M.litP('#ffffff', { map: WHALE_SKIN.map, normalMap: WHALE_SKIN.nrm, normalScale: new T.Vector2(1, 1), roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    }
    g.add(new T.Mesh(body, skinM));
    /* the normal of the skin at (f, a), pointing out */
    const nOf = (f, a) => {
      const p = pt(f, a), pf = pt(f + 1e-4, a), pa = pt(f, a + 1e-3);
      const A = sub(pf, p), B = sub(pa, p); let n = norm([A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]]);
      const P = prof(f); if (n[1] * (p[1] - P.cy) + n[2] * p[2] < 0) n = n.map(v => -v);
      return { p, n };
    };
    const UPV = new T.Vector3(0, 1, 0), _n = new T.Vector3(), _q = new T.Quaternion();
    if (!lite) {
      /* ── the knobs: in rows along the top of the rostrum (one down its middle, two either side), a row along each side
         of the lower jaw below its lip, and a cluster on the chin; barnacles crusted on the chin's and a few others ── */
      const r = M.rng(4077), parts = [], barn = new T.CylinderGeometry(0.62, 1, 1, 9, 1, true), barnTop = new T.CircleGeometry(0.62, 9);
      barn.translate(0, 0.5, 0); barnTop.rotateX(-Math.PI / 2); barnTop.translate(0, 1, 0);
      /* (a knob: a round swelling of the skin, meeting it flat at its edge, (1 - r²)^1.5 high) */
      const bump = M.sheet(7, 18, (s, c) => { const a = c * TAU; return [Math.cos(a) * s, Math.pow(Math.max(0, 1 - s * s), 1.5), Math.sin(a) * s]; });
      const knob = (f, a, sz) => {
        const { p, n } = nOf(f, a); _n.set(n[0], n[1], n[2]); _q.setFromUnitVectors(UPV, _n);
        const rad = (0.05 + 0.025 * r()) * sz, hgt = (0.035 + 0.02 * r()) * sz, m = new T.Matrix4().compose(new T.Vector3(p[0] - n[0] * 0.004, p[1] - n[1] * 0.004, p[2] - n[2] * 0.004), _q, new T.Vector3(rad, hgt, rad));
        const base = mix(DARK, GREYW, 0.1 + 0.18 * r()), tip = r() < 0.35 ? mix(base, PALE, 0.35 + 0.35 * r()) : base, geo = bump.clone();
        M.paint(geo, (x, y) => mix(base, tip, sm(0.55, 0.95, y)));
        parts.push({ geo, m });
        return { p, n, rad };
      };
      const barnacles = (k, nB) => {
        for (let i = 0; i < nB; i++) {
          const ang = r() * TAU, d = k.rad * (0.3 + 0.9 * r()), s = 0.018 + 0.016 * r();
          _n.set(k.n[0], k.n[1], k.n[2]); _q.setFromUnitVectors(UPV, _n);
          const off = new T.Vector3(Math.cos(ang) * d, 0, Math.sin(ang) * d).applyQuaternion(_q);
          const m = new T.Matrix4().compose(new T.Vector3(k.p[0] + off.x, k.p[1] + off.y, k.p[2] + off.z), _q, new T.Vector3(s, s * (0.7 + 0.5 * r()), s));
          parts.push({ geo: barn, m, c: mix(PALE, WHITE, 0.3 + 0.7 * r()) }, { geo: barnTop, m, c: mix(PALE, GREYW, 0.7) });
        }
      };
      const topA = (q, P) => Math.asin(Math.min(1, Math.pow(Math.abs(q), P.pT / 2))) * Math.sign(q);
      for (const q of [0, -0.34, 0.34, -0.64, 0.64]) for (let f = 0.016 + r() * 0.01; f < (q === 0 ? 0.15 : 0.165); f += 0.024 + r() * 0.01) {
        const P = prof(f), a = topA(q + (r() - 0.5) * 0.06, P), k = knob(f, (a + TAU) % TAU, 1);
        if (r() < 0.12) barnacles(k, 2 + Math.floor(r() * 3));
      }
      for (const sd of [-1, 1]) for (let f = 0.008 + r() * 0.01; f < 0.18; f += 0.026 + r() * 0.012) {
        const up = mU(f) - 0.13 - 0.04 * r(), a = Math.acos(Math.max(-1, Math.min(1, up))) * sd, k = knob(f, (a + TAU) % TAU, 1.1);
        if (f < 0.06 && r() < 0.5) barnacles(k, 2 + Math.floor(r() * 4));
      }
      /* the chin: a crowded knot of them at the tip of the lower jaw, barnacles thick among them */
      for (let i = 0; i < 16; i++) {
        const f = 0.006 + 0.028 * r(), up = -0.45 - 0.5 * r(), a = Math.acos(up) * (r() < 0.5 ? -1 : 1), k = knob(f, (a + TAU) % TAU, 1.25);
        if (r() < 0.75) barnacles(k, 3 + Math.floor(r() * 5));
      }
      g.add(new T.Mesh(M.mergeC(parts), M.litP('#ffffff', { vertexColors: true, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.5 })));
      /* the eyes: small and dark, wet, in their socket just above the corner of the mouth */
      const eyeM = M.litP('#030304', { roughness: 0.06, clearcoat: 1 });
      for (const sd of [-1, 1]) {
        const a = Math.acos(EYE.up) * sd, { p, n } = nOf(EYE.f, (a + TAU) % TAU), e = new T.Mesh(new T.SphereGeometry(1, 16, 10), eyeM);
        e.scale.set(0.058, 0.036, 0.03); e.position.set(p[0] - n[0] * 0.012, p[1] - n[1] * 0.012, p[2] - n[2] * 0.012);
        e.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(n[0], n[1], n[2])); e.rotateZ(-0.15 * sd); g.add(e);
      }
    }
    const finM = M.litP('#ffffff', { vertexColors: true, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    const topY = f => pt(f, 0)[1];
    /* ── the dorsal fin: small and hooked, standing on the hump two thirds of the way back ── */
    {
      const xF = xOf(0.636), xR = xOf(0.688), xT = xOf(0.676), yT = topY(0.676) + 0.3;
      g.add(new T.Mesh(finOf(lite ? 6 : 18, lite ? 8 : 20, s => [xF + (xT - xF) * Math.pow(s, 1.25), topY(0.636) - 0.1 + (yT - topY(0.636) + 0.1) * s, 0],
        s => [xR + (xT - xR) * s + 0.07 * Math.sin(Math.PI * s), topY(0.688) - 0.1 + (yT - topY(0.688) + 0.1) * Math.pow(s, 0.9), 0], [0, 0, 1], s => 0.24 - 0.08 * s,
        (x, y, z) => BLACK.map(v => v * (0.94 + 0.12 * M.vn(x * 3, y * 3, z * 3)))), finM));
    }
    /* ── the flippers: 4.3 m, a third of the whale, narrow, pointed, the leading edge scalloped by ten big bumps; white,
       the top dark at the root and mottled grey, barnacles at a few of the bumps. Held out to the sides, swept back and
       a little down ── */
    const flips = [], FL = 4.3;
    const chordF = s => (1.02 - 0.62 * s) * Math.sqrt(Math.max(0, 1 - Math.pow(s, 8))) + 0.035, sweepF = s => 0.5 - 0.3 * s - 0.2 * s * s;
    const bumpF = s => s > 0.1 && s < 0.95 ? 0.075 * Math.pow(Math.max(0, Math.sin(Math.PI * (s - 0.1) / 0.085)), 1.6) * (1 - 0.45 * s) : 0;
    for (const sd of [-1, 1]) {
      const root = nOf(0.29, (Math.acos(-0.45) * sd + TAU) % TAU).p, f = new T.Object3D();
      f.position.set(root[0], root[1], root[2] - sd * 0.18); f.rotation.set(0.38 * sd, -0.52 * sd, 0.1); g.add(f);
      f.add(new T.Mesh(finOf(lite ? 18 : 90, lite ? 8 : 22, s => [sweepF(s) + bumpF(s), 0, sd * FL * s], s => [sweepF(s) - chordF(s), 0, sd * (FL * s - 0.02)], [0, 1, 0], s => 0.26 - 0.13 * s,
        (x, y, z, s, c, isTop) => {
          const n1 = M.vn(x * 2.5, y * 2.5 + 3, z * 2.5), n2 = M.vn(x * 9, y * 9, z * 9 + 5);
          let cc = mix(WHITE, PALE, 0.25 * n2 + 0.3 * sm(0.55, 0.8, n1));
          if (isTop) cc = mix(cc, mix(BLACK, DARK, n1), 1 - sm(0.05, 0.3, s + 0.06 * (n1 - 0.5)));
          else cc = mix(cc, DARK, (1 - sm(0.02, 0.1, s)) * 0.8);
          return cc;
        }), finM));
      if (!lite) {
        /* (barnacles on a few of its bumps) */
        const r = M.rng(91 + sd), parts = [], barn = new T.CylinderGeometry(0.62, 1, 1, 8, 1, true); barn.translate(0, 0.5, 0);
        for (let k = 0; k < 10; k++) { if (r() > 0.4) continue; const s = 0.1 + 0.085 * (k + 0.5); for (let i = 0; i < 3 + Math.floor(r() * 4); i++) { const sz = 0.016 + 0.012 * r(); parts.push({ geo: barn, m: M.M4(sweepF(s) + bumpF(s) - 0.02 - 0.06 * r(), 0.018 + 0.01 * r(), sd * FL * (s + (r() - 0.5) * 0.03), 0, 0, 0, sz, sz * 0.8, sz), c: mix(PALE, WHITE, r()) }); } }
        if (parts.length) f.add(new T.Mesh(M.mergeC(parts), M.litP('#ffffff', { vertexColors: true, roughness: 0.7 })));
      }
      flips.push({ f, sd });
    }
    /* ── the flukes: 4.4 m across, swept back to pointed tips, notched in the middle, the trailing edge serrated;
       black above, white beneath with black marks of their own and a black rim along the trailing edge ── */
    const tail = new T.Object3D(); tail.position.set(xOf(0.952), 0, 0); g.add(tail);
    const chordT = s => (1.12 * Math.pow(1 - s, 0.55) + 0.03) * (1 - 0.2 * Math.exp(-((s / 0.045) ** 2))), sweepT = s => 0.16 - 1.0 * Math.pow(s, 1.5) - 0.25 * Math.pow(s, 4);
    for (const sd of [-1, 1]) {
      const rr = M.rng(203 + sd), ph = rr() * 6, serr = s => 0.06 * Math.pow(0.5 + 0.5 * Math.sin(s * Math.PI * 15 + ph), 3) * (0.5 + 0.5 * M.vn(s * 9, sd, 2.2)) * sm(0.03, 0.12, s) * (1 - sm(0.85, 1, s));
      tail.add(new T.Mesh(finOf(lite ? 16 : 80, lite ? 8 : 20, s => [sweepT(s), 0, sd * (0.04 + 2.16 * s)], s => [sweepT(s) - chordT(s) - serr(s), 0, sd * (0.04 + 2.16 * s)], [0, 1, 0], s => 0.17 - 0.09 * s,
        (x, y, z, s, c, isTop) => {
          if (isTop) return mix(BLACK, DARK, 0.4 * M.vn(x * 3, z * 3, 1.5));
          const n = M.fbm(x * 1.3 + 4, z * 1.3 * sd, 7.7, 3);
          let cc = mix(WHITE, PALE, 0.4 * M.vn(x * 9, z * 9, 3));
          cc = mix(cc, BLACK, Math.max(sm(0.52, 0.6, n), sm(0.82, 0.95, c), 1 - sm(0.03, 0.12, s)));
          return cc;
        }), finM));
    }
    /* (which part is which, for fauna.js: the flippers 1, the flukes 2) */
    for (const { f } of flips) f.traverse(m => { m.userData.part = 1; }); tail.traverse(m => { m.userData.part = 2; });
    g.userData.anim = t => { tail.rotation.z = 0.12 * Math.sin(t * 0.9); for (const f of flips) f.f.rotation.x = f.sd * (0.38 + 0.08 * Math.sin(t * 0.6)); };
    g.userData.anim(0);
    return g;
  });
})();
