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

  /* ── the humpback, 13 m ── */
  M.add('life/whale', () => {
    const g = new T.Group(), BLACK = lin('#1d2024'), GREY = lin('#3a3f45'), WHITE = lin('#e6e6e3');
    const mottle = (x, z) => M.fbm(x * 0.8, z * 0.8, 3, 3);
    const SECS = [[-6.4, 0, 0, 0, 2], [-6.2, 0.16, 0.38, 0.05, 1.75], [-5.0, 0.46, 0.68, 0.1, 1.85], [-2.5, 1.25, 1.36, 0.12, 2], [0.5, 1.72, 1.78, 0.05, 2], [3.0, 1.62, 1.55, -0.08, 2.1],
      [5.0, 1.22, 1.0, -0.3, 2.35], [6.1, 0.64, 0.5, -0.45, 2.3], [6.55, 0, 0, -0.52, 2]];
    const prof = M.spline(SECS.map(r => [r[0], r[1], r[2], r[3]]));
    /* the knobs: on the top of the head in rows either side of the middle, and along the chin */
    const knobs = []; { const r = M.rng(77); for (let i = 0; i < 60; i++) { const x = 4.1 + r() * 2.3, onTop = r() < 0.65; knobs.push({ x, a: onTop ? (r() - 0.5) * 1.3 : Math.PI + (r() - 0.5) * 1.0, s: 0.08 + 0.05 * r() }); } }
    const knobAt = (x, a) => { let k = 0; for (const n of knobs) { const da = Math.atan2(Math.sin(a - n.a), Math.cos(a - n.a)) * 1.1, d = Math.hypot(x - n.x, da); if (d < n.s * 2.5) k += Math.exp(-((d / n.s) ** 2)); } return k; };
    const pleat = a => { const p = Math.abs(Math.sin(a * 30)); return 1 - sm(0.0, 0.25, p); };
    const body = M.loft(SECS, 150, 96, (x, y, z, u, a) => {
      const up = Math.cos(a); let c = mix(BLACK, GREY, 0.25 * mottle(x * 2, z * 2));
      /* the throat pleats, pale, from the chin back to the navel; the belly behind them mottled */
      const throat = sm(-0.3, -0.55, up) * sm(-1.6, -0.8, x) * (1 - sm(6.2, 6.5, x));
      if (throat > 0) { c = mix(c, mix(WHITE, BLACK, 0.25 * mottle(x, z)), throat * (0.55 + 0.45 * mottle(x * 0.6, z * 0.6))); c = mix(c, BLACK, 0.55 * pleat(a) * throat); }
      else if (up < -0.2) c = mix(c, WHITE, 0.45 * mottle(x, z) * sm(-0.2, -0.6, up));
      /* the knobs a little paler, some with barnacles; the line of the mouth */
      const kn = knobAt(x, a); c = mix(c, GREY, Math.min(1, kn) * 0.6); if (kn > 0.6 && M.vn(x * 3, a * 4, 1) > 0.72) c = mix(c, WHITE, 0.7);
      if (x > 3.6 && Math.abs(up + 0.12 - 0.12 * sm(4.5, 6.4, x)) < 0.025) c = mix(c, BLACK, 0.8);
      return c.map(v => v * (0.95 + 0.08 * M.vn(x * 3, y * 3, z * 3)));
    }, { shape: (x, y, z, u, a) => {
      const up = Math.cos(a); let k = 1;
      /* the pleats pressed in; the knobs raised; the lower jaw a little wider than the head; the hump the fin sits on */
      if (up < -0.3 && x > -1.6 && x < 6.3) k -= 0.012 * pleat(a) * sm(-0.3, -0.5, up);
      k += 0.05 * Math.min(1.2, knobAt(x, a));
      const jaw = x > 3.2 && up < -0.1 ? 1 + 0.05 * sm(3.2, 5, x) : 1;
      const hump = Math.exp(-(((x + 2.4) / 0.9) ** 2)) * Math.max(0, up) * 0.2;
      const [, , cy] = prof(x);
      return [x, cy + (y - cy) * k + hump, z * k * jaw];
    } });
    const skinM = M.litP('#ffffff', { vertexColors: true, roughness: 0.58, clearcoat: 0.18, clearcoatRoughness: 0.45 });
    g.add(new T.Mesh(body, skinM));
    for (const sd of [-1, 1]) { const [w] = prof(4.6); const e = new T.Mesh(new T.SphereGeometry(0.075, 14, 10), M.litP('#050505', { roughness: 0.05, clearcoat: 1 })); e.scale.set(1.3, 0.85, 0.5); e.position.set(4.6, -0.32, sd * (w * 0.93)); g.add(e); }
    const finM = M.litP('#ffffff', { vertexColors: true, roughness: 0.58, clearcoat: 0.18, clearcoatRoughness: 0.45 });
    /* the small dorsal fin on its hump */
    const topAt = x => { const [, h, cy] = prof(x); return cy + h + Math.exp(-(((x + 2.4) / 0.9) ** 2)) * 0.2; };
    g.add(new T.Mesh(finOf(10, 18, s => [-1.95 - 0.75 * Math.pow(s, 1.3), topAt(-1.95) - 0.12 + 0.55 * s, 0], s => [-2.95 - 0.1 * s, topAt(-2.95) - 0.12 + 0.5 * s, 0], [0, 0, 1], 0.2,
      (x, y, z) => BLACK.map(v => v * (0.95 + 0.08 * M.vn(x * 3, y * 3, z * 3)))), finM));
    /* the flippers: a third as long as the whale, white, knobbled along the leading edge, a little dark at the root on top */
    const flips = [];
    for (const sd of [-1, 1]) {
      const f = new T.Object3D(); f.position.set(3.0, -0.78, sd * 1.3); g.add(f);
      const knob = s => s < 0.85 ? 0.09 * Math.pow(Math.max(0, Math.sin(s * Math.PI * 11)), 2) * (1 - s) : 0;
      f.add(new T.Mesh(finOf(60, 22, s => [0.35 - 1.1 * s + knob(s), -0.85 * s * s, sd * 4.1 * s],
        s => [-0.7 - 0.85 * s, -0.85 * s * s - 0.05, sd * (4.1 * s - 0.05)], s => norm([0, 1, -sd * (0.2 + 0.3 * s)]), s => 0.2 - 0.08 * s,
        (x, y, z, s, c, isTop) => { let col = mix(WHITE, BLACK, isTop ? 0.65 * (1 - sm(0.1, 0.45, s)) * (0.6 + 0.4 * mottle(x * 2, z * 2)) : 0.08 * mottle(x * 3, z * 3)); if (M.vn(x * 5, y * 5, z * 5) > 0.78 && c < 0.2) col = mix(col, lin('#bdb8ad'), 0.6); return col; }), finM));
      flips.push({ f, sd });
    }
    /* the flukes: broad, swept, the trailing edge ragged; black above, white beneath with black marks of its own */
    const tail = new T.Object3D(); tail.position.x = -6.3; g.add(tail);
    for (const sd of [-1, 1]) tail.add(new T.Mesh(finOf(40, 20, s => [0.15 - 0.9 * Math.pow(s, 1.5), 0, sd * (0.03 + 2.15 * s)],
      s => { const c = (0.95 + 0.25 * Math.sin(Math.PI * Math.min(1, s / 0.7))) * Math.pow(1 - s, 0.5) + 0.06, rag = 0.045 * Math.sin(s * 29 + sd) + 0.025 * Math.sin(s * 53 + 2 * sd); return [0.15 - 0.9 * Math.pow(s, 1.5) - c - rag * (1 - s * 0.5), 0, sd * (0.03 + 2.15 * s)]; },
      [0, 1, 0], s => 0.16 - 0.06 * s, (x, y, z, s, c, isTop) => isTop ? BLACK : mix(WHITE, BLACK, sm(0.45, 0.6, M.fbm(x * 1.4, z * 1.4, 7, 3)) * 0.9 + 0.1 * (1 - sm(0, 0.25, c)))), finM));
    g.userData.anim = t => { tail.rotation.z = 0.12 * Math.sin(t * 0.9); for (const f of flips) f.f.rotation.x = f.sd * (0.16 + 0.12 * Math.sin(t * 0.6)); };
    g.userData.anim(0);
    return g;
  });
})();
