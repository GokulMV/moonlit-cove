/* ─────────────────────────────────────────────────────────────
   models/beach/driftwood.js — a driftwood log, washed up and
   bleached: a trunk worn smooth and silver by the sea and the sun,
   its grain standing in long soft ridges and the checks of its
   drying split along it, darker inside; at one end the stump of its
   root flare, the roots broken off short and worn round; the other
   end broken and worn down to a blunt point; a branch's stub grown
   out of it with a collar where it joins, and the healed scar of
   another; its underside darker where it lies in the damp sand,
   sunk a little into it.
   Lying along x, its middle at the origin, the sand at y = 0.
   o.len its length (2.6 m), o.seed.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* (the angle between two, wrapped) */
  const dA = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  /* the grain, fine: long fibres along the wood, paler and darker; and its checks, drawn sharp: each a dark split with
     a paler lip, along its stretch of the log at the angle round it where it runs (uv: u along, v round from beneath) */
  const texes = new Map();
  const grainTex = (seed, checks, scar) => texes.get(seed) || texes.set(seed, M.texFrom(1024, 512, (u, v) => {
    const f = M.vn(u * 7, v * 150, 3.1), g = 1 - Math.abs(2 * M.vn(u * 3.5, v * 62 + 0.6 * M.vn(u * 2, v * 8, 1), 7.7) - 1), line = Math.pow(g, 14);
    let k = 0.94 + 0.16 * (f - 0.5) - 0.26 * line - 0.1 * Math.pow(1 - Math.abs(2 * M.vn(u * 9, v * 260, 5.2) - 1), 10) + 0.05 * (M.vn(u * 60, v * 300, 2) - 0.5);
    /* (the ends: the growth rings of the end grain, round the heart, worn soft) */
    const ue = Math.min(u / 0.012, (1 - u) / 0.03); if (ue < 1) k *= 1 - 0.14 * (1 - ue) * Math.pow(0.5 + 0.5 * Math.sin(ue * 46 + 2 * M.vn(v * 6, u, 3)), 3);
    const a = Math.PI + v * TAU;
    for (const c of checks) {
      if (u < c.u0 || u > c.u1) continue;
      const e = sm(c.u0, c.u0 + 0.05, u) * sm(c.u1, c.u1 - 0.05, u), d = Math.abs(dA(a, c.at(u))) / (0.016 * (0.4 + 0.6 * e) * c.w);
      k *= 1 - 0.85 * e * Math.exp(-d * d) + 0.1 * e * Math.exp(-((d - 2.2) ** 2));
    }
    const s = scar(u, a); k *= 1 - 0.28 * sm(0.25, 0.8, s) + 0.06 * Math.exp(-(((s - 0.18) / 0.08) ** 2));
    return [k, k, k];
  }, { repeat: true })).get(seed);

  M.add('beach/driftwood', (o = {}) => {
    const len = o.len || 2.6, r = M.rng(o.seed || 5), g = new T.Group(), X0 = -len / 2;
    const SILVER = lin('#a59c8c'), WARM = lin('#927f68'), DAMP = lin('#6c6256'), DARK = lin('#4c443b'), END = lin('#b9a688');
    /* how thick along it (u 0 at the root end, 1 at the broken one): the flare, the trunk tapering, the broken end worn
       down; and how it lies: a gentle bend in it, each part of it resting on the sand and a few centimetres into it */
    const rad = u => (0.135 - 0.042 * u + 0.058 * Math.pow(sm(0.17, 0, u), 1.4)) * (1 - 0.55 * Math.pow(sm(0.82, 1, u), 1.5)) * (1 + 0.07 * Math.exp(-(((u - 0.66) / 0.05) ** 2)) + 0.03 * Math.sin(u * 9.4 + 1));
    const axis = u => [X0 + u * len, rad(u) * 0.94 - 0.04 + 0.012 * Math.sin(Math.PI * u), 0.11 * Math.sin(u * 2.4 - 0.5) + 0.02 * Math.sin(u * 7)];
    /* its checks: long splits along it, each at an angle round it that wanders, over a stretch of it */
    const checks = Array.from({ length: 6 }, () => { const a0 = (r() - 0.5) * 2.6, f = 3 + 4 * r(), ph = r() * TAU; return { u0: 0.06 + r() * 0.4, u1: 0.5 + r() * 0.44, w: 0.7 + 0.8 * r(), at: u => a0 + 0.2 * Math.sin(u * f + ph) }; });
    /* (cut a little into it too, softly: a groove wider than the split the grain shows) */
    const crack = (u, a) => { let k = 0; for (const c of checks) { if (u < c.u0 || u > c.u1) continue; const e = sm(c.u0, c.u0 + 0.06, u) * sm(c.u1, c.u1 - 0.06, u), da = dA(a, c.at(u)); k = Math.max(k, e * Math.exp(-((da / 0.07) ** 2)) * 0.035 * c.w); } return k; };
    /* a branch's healed scar (a low swelling, a darker ring round it) */
    const scar = { u: 0.4, a: -1.35 }, scarK = (u, a) => Math.exp(-(((u - scar.u) * len / 0.06) ** 2) - ((dA(a, scar.a) / 0.42) ** 2));
    /* (sections close at the ends, rounded: more of them there) */
    const US = [0, 0.002, 0.006, 0.012, 0.025, 0.045, 0.07, 0.1, 0.14, 0.2, 0.28, 0.36, 0.45, 0.55, 0.65, 0.74, 0.82, 0.88, 0.93, 0.96, 0.98, 0.992, 1];
    /* (the root end broken off nearly square, its edge worn round; the other worn down to a blunt point) */
    const endK = u => Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, u < 0.5 ? u / 0.012 : (1 - u) / 0.03), 2)));
    const secs = US.map(u => { const k = rad(u) * endK(u); return [X0 + u * len, k * 1.04, k * 0.94, 0, 2]; });
    const trunk = M.loft(secs, 150, 72, (x, y, z, u, a) => {
      /* silver on top where the sun has bleached it, warmer down the sides, damp and darker beneath; dark in its
         checks, the scar's ring darker; the broken end's wood paler and warmer */
      const up = Math.cos(a);
      let c = mix(SILVER, WARM, 0.35 * sm(0.6, -0.2, up) + 0.25 * M.vn(u * 9, a * 1.3, 4.2));
      c = mix(c, DAMP, sm(-0.35, -0.85, up));
      c = mix(c, DARK, 0.25 * scarK(u, a));
      c = mix(c, END, sm(0.94, 0.995, u) * 0.7 + sm(0.03, 0.004, u) * 0.4);
      return c.map(v => v * (0.94 + 0.1 * M.vn(x * 40, y * 40, z * 40)));
    }, { shape: (x, y, z, u, a) => {
      /* the grain's soft ridges, the checks cut into them, the root flare's broken roots as lobes round it, the scar */
      const ridge = 1 - Math.abs(2 * M.vn(u * 4, a * 1.1 + 0.6 * M.vn(u * 2.2, a, 9), 1.7) - 1);
      let f = 1 + 0.03 * (ridge - 0.5) + 0.015 * (M.vn(u * 11, a * 2.5, 5.5) - 0.5) - crack(u, a);
      f *= 1 + 0.2 * Math.pow(sm(0.15, 0, u), 1.3) * Math.pow(Math.max(0, Math.cos(5 * a + 0.7 + 0.3 * Math.sin(3 * a))), 1.5);
      f *= 1 + 0.07 * scarK(u, a);
      const A = axis(u); return [A[0], A[1] + y * f, A[2] + z * f];
    } });
    const woodM = M.lit('#ffffff', { map: grainTex(o.seed || 5, checks, scarK), vertexColors: true, roughness: 0.92 });
    g.add(new T.Mesh(trunk, woodM));
    /* the branch's stub: out of the trunk's upper side two thirds along, leaning toward the broken end; a collar where
       it grew from the trunk, its end broken and worn round */
    {
      const ub = 0.66, ab = 0.62, A = axis(ub), rT = rad(ub), n = new T.Vector3(0, Math.cos(ab), Math.sin(ab)), dir = n.clone().multiplyScalar(Math.cos(0.75)).add(new T.Vector3(Math.sin(0.75), 0, 0)).normalize();
      const L = rT + 0.3, bs = [[0, 0.056, 0.056, 0, 2], [rT * 0.7, 0.06, 0.058, 0, 2], [rT * 0.98, 0.078, 0.074, 0, 2], [rT + 0.04, 0.058, 0.055, 0, 2], [rT + 0.15, 0.046, 0.044, 0, 2], [L - 0.035, 0.036, 0.034, 0, 2], [L - 0.01, 0.026, 0.024, 0, 2], [L, 0, 0, 0, 2]];
      const stub = M.loft(bs, 34, 28, (x, y, z, u, a) => {
        let c = mix(SILVER, WARM, 0.3 * M.vn(u * 7, a, 2.3) + 0.2 * sm(0.5, -0.3, Math.cos(a)));
        return mix(c, END, sm(0.9, 1, u) * 0.6).map(v => v * (0.94 + 0.1 * M.vn(x * 60, y * 60, z * 60)));
      }, { shape: (x, y, z, u, a) => { const k = 1 + 0.04 * (1 - Math.abs(2 * M.vn(u * 5, a * 1.2, 8.8) - 1) - 0.5), lift = 0.09 * Math.pow(Math.max(0, x - rT) / (L - rT), 2); return [x, y * k + lift, z * k]; } });   /* (curving up as it goes) */
      /* (its own y the way up is, across it, so it curves upward) */
      const yv = new T.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize(), zv = new T.Vector3().crossVectors(dir, yv);
      const m = new T.Mesh(stub, woodM); m.position.set(...A); m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(dir, yv, zv)); g.add(m);
    }
    g.userData.len = len;
    return g;
  });
})();
