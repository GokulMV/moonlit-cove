/* ─────────────────────────────────────────────────────────────
   models/beach/sandcastle.js — a sand castle, built with a bucket and
   a spade on the damp sand above the tide: a patted platform with a
   moat dug round it (the sand out of the moat heaped into a bank
   outside), bucket towers with crenellated tops round a bigger keep
   (now and then a smaller tower turned out on top of it), walls patted
   up between the towers with notches along their tops, a gate between
   two posts on the front, shells pressed into it here and there, and a
   twig on the keep flying a strip of leaf, or a gull's feather stuck
   in the top.
   Each seed builds its own. wear (0 to 1) is what has happened to it
   since: fresh, it is sharp-edged and dark with damp; dried, paler and
   softer, its notches crumbling; at 1 the tide has been over it and
   only rounded stumps on a low mound are left, dark and wet again.
   Built at the origin in metres, its gate toward +z; about 1.1 to 1.4
   m across with its moat.
   opts: { seed, wear (0), moat (true), toys (false): a bucket and a
   spade left beside it, toyAng: which way from the middle the bucket
   lies (radians, from +x toward +z), soak (0): the sea has just been
   over it, and it is wet through }
   userData: radius, how far out it reaches, for walking round it
   (base: the castle's own, without the toys); toys, the bucket and the
   spade (for whatever carries them off); sand, the castle's own mesh
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const SAND = [0.52, 0.43, 0.29];
  /* (the materials are shared by every castle along the coast) */
  const MAT = {}, mat = (k, make) => MAT[k] || (MAT[k] = make());
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const adiff = (a, b) => Math.abs(((a - b) % TAU + TAU * 1.5) % TAU - Math.PI);
  /* a surface turned round an upright axis and welded all the way round (no seam to show): rows[i](th) → [radius,
     height], running up the outside and in across the top, so its faces look outward and up. paint(x, y, z, s, th) */
  function lathe(rows, nc, cx, cz, rot, paint) {
    const n = rows.length, pos = new Float32Array(n * nc * 3), col = new Float32Array(n * nc * 3), idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < nc; j++) {
      const th = rot - j / nc * TAU, [rr, y] = rows[i](th), k = (i * nc + j) * 3, x = cx + Math.cos(th) * rr, z = cz + Math.sin(th) * rr;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; col.set(paint(x, y, z, i / (n - 1), th), k);
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < nc; j++) { const a = i * nc + j, b = i * nc + (j + 1) % nc, c = a + nc, d = b + nc; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(M.normalsOf(pos, idx), 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(idx); return g;
  }
  /* the sand's colour: patted damp sand darker, the tops and edges dried paler, a grain of lighter and darker specks */
  const grainK = (x, y, z) => 0.95 + 0.06 * M.vn(x * 131 + 5, y * 131, z * 131) + 0.04 * M.vn(x * 263, y * 263 + 3, z * 263);
  /* (dd: how damp: wet sand goes darker and browner, not grey) */
  const tint = (k, x, y, z, dd = 0) => { const g = grainK(x, y, z) * k; return [SAND[0] * g * (1 - 0.3 * dd), SAND[1] * g * (1 - 0.34 * dd), SAND[2] * g * (1 - 0.42 * dd)]; };

  M.add('beach/sandcastle', (o = {}) => {
    /* (o.soak: the sea has been over it, and it is wet through: darker all over and no browner, as the wet sand round it
       is, and with a little of its sheen) */
    const soak = Math.min(1, Math.max(0, o.soak || 0)), tintW = (k, x, y, z, dd) => soak ? tint(k, x, y, z, dd * (1 - soak)).map(v => v * (1 - 0.4 * soak)) : tint(k, x, y, z, dd);
    const seed = o.seed || 1, wear = Math.min(1, Math.max(0, o.wear || 0)), r = M.rng(seed * 7 + 3), washed = sm(0.6, 0.95, wear);
    /* how damp it still is: fresh from the bucket, dark; dried by the sun, pale; washed by the tide, dark again */
    const damp = Math.max(0.72 * (1 - sm(0, 0.5, wear)), 0.85 * washed);
    const nc = o.lite ? 28 : 44;
    const parts = [];
    /* ── its plan: towers round the outside, a keep in the middle (or along a wall) ── */
    const towers = [], plan = r();
    const tw = () => ({ rb: 0.083 + r() * 0.02, H: 0.13 + r() * 0.045, nm: 5 + Math.floor(r() * 2), ph: r() * TAU });
    let ring = [];
    if (plan < 0.4) { const a = 0.21 + r() * 0.05, rot = (r() - 0.5) * 0.3; for (let k = 0; k < 4; k++) { const an = rot + Math.PI / 4 + k * Math.PI / 2; ring.push(Object.assign(tw(), { x: Math.cos(an) * a * 1.414, z: Math.sin(an) * a * 1.414 })); } }
    else if (plan < 0.75) { const n = 3 + Math.floor(r() * 3), R = 0.22 + r() * 0.08, a0 = r() * TAU; for (let k = 0; k < n; k++) { const an = a0 + k * TAU / n + (r() - 0.5) * 0.25; ring.push(Object.assign(tw(), { x: Math.cos(an) * R, z: Math.sin(an) * R })); } }
    else { const a = 0.27 + r() * 0.06; ring.push(Object.assign(tw(), { x: -a, z: -0.03 }), Object.assign(tw(), { x: a, z: 0.03 })); }
    /* (the ring in order round the middle, so the walls join neighbours) */
    ring.sort((p, q) => Math.atan2(p.z, p.x) - Math.atan2(q.z, q.x));
    towers.push(...ring);
    const keep = plan >= 0.75 || r() < 0.8 ? { x: (r() - 0.5) * 0.04, z: (r() - 0.5) * 0.04, rb: 0.118 + r() * 0.018, H: 0.18 + r() * 0.045, nm: 6 + Math.floor(r() * 2), ph: r() * TAU, keep: true } : null;
    if (keep) towers.push(keep);
    /* the platform: round the towers with a little to spare; how high it was patted up */
    let R0 = 0; for (const t of towers) R0 = Math.max(R0, Math.hypot(t.x, t.z) + t.rb * 1.18);
    R0 += 0.035; const hm = (0.035 + r() * 0.025) * (1 - 0.25 * washed) + 0.025 * washed;
    const wobR = M.wob(seed * 3 + 1), Rm = th => R0 * (1 + 0.045 * wobR(th * 1.3));
    /* (worn down: lower, slumped, the crenellations crumbled, and some towers fallen to stumps) */
    for (const t of towers) {
      t.H *= 1 - 0.32 * sm(0.1, 0.6, wear) - 0.45 * washed;
      if (r() < wear * 0.55 && !t.keep) t.H *= 0.5;
      t.mh = (0.024 + r() * 0.012) * Math.pow(1 - sm(0.05, 0.75, wear), 1.3);
      t.slump = 0.15 * wear + 0.7 * washed; t.rt = t.rb * (0.83 + r() * 0.05); t.y0 = hm;
      t.bites = []; const nb = Math.floor(wear * 4 * r() + (wear > 0.25 ? 1 : 0)); for (let k = 0; k < nb; k++) t.bites.push([r() * TAU, 0.35 + r() * 0.5, 0.012 + 0.03 * r() * wear]);
      t.nz = r() * 50;
    }
    /* ── a bucket tower: a flared foot slumped into the platform, the bucket's side with the faint rings of its ridges,
       merlons standing round the rim and the deck inside them a little dished ── */
    function tower(t, opt = {}) {
      const { x, z, y0, rb, rt, H, nm, mh, ph, slump, nz } = t, wall = Math.min(0.024, rt * 0.3);
      const top = th => (nm ? mh * sm(-0.32, 0.32, Math.cos(nm * (th - ph))) : 0) - t.bites.reduce((s, [bt, bw, bd]) => s + bd * sm(bw, bw * 0.3, adiff(th, bt)), 0);
      const lump = (th, y, k = 1) => rb * k * (0.045 * (M.vn(Math.cos(th) * 2.7 + nz, y * 24 + nz, Math.sin(th) * 2.7) - 0.5) + 0.022 * (M.vn(Math.cos(th) * 7.5 - nz, y * 70, Math.sin(th) * 7.5 + 3) - 0.5));
      const rib = y => 0.0016 * (1 - wear) * Math.sin(y / Math.max(H, 0.02) * TAU * 6.5);
      const dome = 0.022 * washed + 0.006 * wear;
      const rows = [
        th => [rb * (1.24 + 0.55 * slump) + lump(th, 0, 2), y0 - 0.014],
        th => [rb * (1.12 + 0.35 * slump) + lump(th, 0.01, 1.6), y0 + 0.004],
        th => [rb * (1.045 + 0.16 * slump) + lump(th, 0.02, 1.2), y0 + 0.018]];
      for (let k = 0; k <= 10; k++) { const s = k / 10, y = 0.032 + (H - 0.032) * s, rr = rb + (rt - rb) * s - slump * 0.02 * (1 - s); rows.push(th => [rr + lump(th, y) + rib(y), y0 + y]); }
      rows.push(
        th => [rt * 0.997 + lump(th, H + 0.01) * 0.6, y0 + H + Math.max(0, top(th)) * 0.55],
        th => [rt * 0.99 - 0.002 * wear, y0 + H + top(th)],
        th => [rt - wall * 0.35, y0 + H + top(th) + 0.0016 * (1 - wear)],
        th => [rt - wall * 0.72, y0 + H + top(th) + 0.001],
        th => [rt - wall, y0 + H + top(th) * 0.88],
        th => [rt - wall - 0.002, y0 + H + top(th) * 0.32 + dome * 0.4],
        th => [rt - wall - 0.004, y0 + H - 0.002 + dome * 0.55],
        th => [(rt - wall) * 0.55, y0 + H - 0.005 + dome * 0.9],
        th => [0.003, y0 + H - 0.006 + dome]);
      return lathe(rows, opt.nc || nc, x, z, 0, (px, py, pz, s) => {
        const h = Math.max(0, Math.min(1, (py - y0) / Math.max(H, 0.03)));
        return tintW((0.86 + 0.14 * h) * (s > 0.8 ? 1.04 : 1), px, py, pz, damp * (1 - 0.55 * h));
      });
    }
    for (const t of towers) parts.push(tower(t));
    /* a smaller tower turned out on top of the keep */
    if (keep && washed < 0.3 && r() < 0.6) {
      const tt = { x: keep.x + (r() - 0.5) * 0.02, z: keep.z + (r() - 0.5) * 0.02, rb: keep.rb * 0.62, H: (0.08 + r() * 0.03) * (1 - 0.4 * wear), nm: 5, ph: r() * TAU, mh: keep.mh * 0.8, slump: 0, nz: r() * 50, bites: [], y0: keep.y0 + keep.H - 0.006 };
      tt.rt = tt.rb * 0.85; parts.push(tower(tt, { nc: Math.max(20, nc - 12) })); keep.top = tt.y0 + tt.H;
    }
    if (keep && !keep.top) keep.top = keep.y0 + keep.H;
    /* ── walls: patted up between neighbouring towers, sloping sides, a flattened top notched with crenels ── */
    const notchP = 0.056, notchD = 0.0105 * Math.pow(1 - sm(0.05, 0.5, wear), 1.4);
    function wall(ax, az, bx, bz, y0, hw, wb, wt, opt = {}) {
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.02) return null;
      const ux = dx / L, uz = dz / L, px = -uz, pz = ux, nz = r() * 40;
      const sec = opt.under ? [[-wb / 2, 0.002], [-wb / 2, hw * 0.5], [-wt / 2, hw - 0.004], [-wt / 2 + 0.005, hw + 0.002, 1], [0, hw + 0.003, 1], [wt / 2 - 0.005, hw + 0.002, 1], [wt / 2, hw - 0.004], [wb / 2, hw * 0.5], [wb / 2, 0.002], [0, -0.001], [-wb / 2, 0.002]]
        : [[-wb / 2 - 0.014, -0.012], [-wb / 2, 0.012], [-(wb + wt) / 4 - 0.004, hw * 0.55], [-wt / 2, hw - 0.006], [-wt / 2 + 0.006, hw + 0.002, 1], [0, hw + 0.004, 1], [wt / 2 - 0.006, hw + 0.002, 1], [wt / 2, hw - 0.006], [(wb + wt) / 4 + 0.004, hw * 0.55], [wb / 2, 0.012], [wb / 2 + 0.014, -0.012]];
      const ns = Math.max(4, Math.round(L / 0.0065)), K = sec.length - 1;
      return M.sheet(ns, K, (s, c) => {
        const [u0, v, top] = sec[Math.round(c * K)], a = s * L;
        const aw = a + (opt.off || 0) + 0.006 * Math.sin(a * 37 + nz) + 0.004 * Math.sin(a * 83 - nz);   /* (pressed in by a finger: no two the same) */
        const crenel = top && !opt.plain && notchD > 0.001 ? -notchD * (0.75 + 0.5 * M.vn(Math.floor(aw / notchP) * 1.7, nz, 2)) * sm(0.2, 0.07, Math.abs((aw / notchP) % 1 - 0.5)) * sm(0.02, 0.05, a) * sm(0.02, 0.05, L - a) : 0;
        const n = M.vn(a * 22 + nz, v * 30, u0 * 30) - 0.5, slumpU = Math.sign(u0) * (0.01 * wear + 0.03 * washed) * (1 - Math.min(1, v / Math.max(hw, 0.01)));
        const u = u0 * (1 + 0.15 * washed) + slumpU + 0.004 * n, vv = (v + crenel) * (1 - 0.1 * wear) + 0.003 * n;
        return [ax + ux * a + px * u, y0 + vv, az + uz * a + pz * u];
      }, (s, c, p) => { const h = Math.max(0, Math.min(1, (p[1] - y0) / Math.max(hw, 0.02))); return tintW(0.86 + 0.12 * h, p[0], p[1], p[2], damp * (1 - 0.5 * h)); });
    }
    const hw0 = (0.06 + r() * 0.025) * (1 - 0.35 * sm(0.1, 0.7, wear) - 0.4 * washed), wb = 0.09 + r() * 0.015, wt = 0.05 + r() * 0.012;
    /* which towers the walls join: round the ring (the keep only when it stands in a row of two) */
    const links = [];
    if (ring.length >= 3) for (let k = 0; k < ring.length; k++) links.push([ring[k], ring[(k + 1) % ring.length]]);
    else if (keep) for (const t of ring) links.push([keep, t]);
    /* the gate goes in the wall nearest the front (+z) */
    let gate = null, gz = -1e9;
    for (const L of links) { const mz = (L[0].z + L[1].z) / 2; if (mz > gz && Math.hypot(L[1].x - L[0].x, L[1].z - L[0].z) > 0.26) { gz = mz; gate = L; } }
    for (const L of links) {
      const [A, B] = L; if (wear > 0.35 && r() < wear * 0.4) continue;      /* (a stretch already fallen) */
      const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const ax = A.x + ux * A.rb * 0.6, az = A.z + uz * A.rb * 0.6, bx = B.x - ux * B.rb * 0.6, bz = B.z - uz * B.rb * 0.6;
      if (L === gate && washed < 0.5) {
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, gw = 0.075, pr = 0.03;
        const g1 = wall(ax, az, mx - ux * gw / 2, mz - uz * gw / 2, hm, hw0, wb, wt); const g2 = wall(mx + ux * gw / 2, mz + uz * gw / 2, bx, bz, hm, hw0, wb, wt, { off: 0.02 });
        if (g1) parts.push(g1); if (g2) parts.push(g2);
        /* two posts either side of the way in, and the lintel across between them */
        for (const sd of [-1, 1]) parts.push(tower({ x: mx + ux * sd * (gw / 2 + pr * 0.4), z: mz + uz * sd * (gw / 2 + pr * 0.4), rb: pr, rt: pr * 0.86, H: hw0 + 0.022, nm: 0, ph: 0, mh: 0, slump: wear * 0.3, nz: r() * 40, bites: [], y0: hm }, { nc: 18 }));
        const lt = wall(mx - ux * (gw / 2 + pr * 0.6), mz - uz * (gw / 2 + pr * 0.6), mx + ux * (gw / 2 + pr * 0.6), mz + uz * (gw / 2 + pr * 0.6), hm + hw0 * 0.58, hw0 * 0.5, wb * 0.75, wt * 0.9, { under: true, plain: true });
        if (lt) parts.push(lt);
        gate.at = [mx, mz, Math.atan2(uz, ux)];
      } else { const w = wall(ax, az, bx, bz, hm, hw0, wb, wt, { off: r() * notchP }); if (w) parts.push(w); }
    }
    /* ── the platform: patted flat on top, its edge sloping down to the moat ── */
    {
      const rows = [th => [Rm(th) + 0.016, -0.006], th => [Rm(th) - 0.008, hm * 0.4], th => [Rm(th) - 0.026, hm * 0.82], th => [Rm(th) - 0.05, hm]];
      for (let k = 1; k <= 6; k++) { const f = 1 - k / 6.4; rows.push(th => { const rr = (Rm(th) - 0.05) * f; return [Math.max(0.003, rr), hm + 0.0025 * (M.vn(Math.cos(th) * rr * 9, 3.1, Math.sin(th) * rr * 9) - 0.5) + washed * 0.035 * (1 - f * f)]; }); }
      parts.push(lathe(rows, nc + 16, 0, 0, 0, (x, y, z, s) => tintW(0.88 + 0.06 * s, x, y, z, damp * 0.85)));
    }
    /* ── the moat round it, the sand dug out of it heaped into a bank outside ── */
    let reach = R0 * 1.05;
    if (o.moat !== false) {
      const bH = (0.024 + r() * 0.016) * (1 - 0.5 * washed), mw = 0.075 + r() * 0.025, wobB = M.wob(seed * 5 + 2);
      const B = th => Rm(th) + mw + 0.012 * wobB(th * 2.1), lumpB = (th, k) => 0.0065 * k * (M.vn(Math.cos(th) * 6 + seed, 0.5 + 0.3 * k, Math.sin(th) * 6) - 0.5);
      const rows = [th => [B(th) + 0.17, -0.006], th => [B(th) + 0.12, 0.005 + lumpB(th, 0.5)], th => [B(th) + 0.08, bH * 0.7 + lumpB(th, 1)], th => [B(th) + 0.05, bH + lumpB(th, 1.3)],
        th => [B(th) + 0.024, bH * 0.75 + lumpB(th, 0.9)], th => [B(th) + 0.006, 0.011], th => [B(th) - 0.012, 0.0028], th => [Rm(th) + 0.035, 0.0022], th => [Rm(th) + 0.012, 0.002]];
      const W = 1 - 0.6 * washed;
      parts.push(lathe(rows, nc + 20, 0, 0, 0, (x, y, z, s) => { const fl = sm(0.6, 0.78, s), bank = 1 - Math.abs(s - 0.35) * 2.2;
        return tintW((0.95 - 0.08 * Math.max(0, bank)) * (s < 0.12 ? 1.03 : 1), x, y, z, Math.min(0.75, 0.6 * damp + 0.9 * fl * W)); }));
      reach = R0 + mw + 0.19;
    }
    const sand = M.mergeC(parts.map(geo => ({ geo })));
    const g = new T.Group();
    const sandM = soak > 0.5 ? mat('sandw', () => Mats.lit({ vertexColors: true, roughness: 0.8 }, 'sandc')) : mat('sand', () => Mats.lit({ vertexColors: true, roughness: 0.96 }, 'sandc'));
    const sm0 = new T.Mesh(sand, sandM); sm0.castShadow = sm0.receiveShadow = true; g.add(sm0);
    const base = reach;
    /* ── shells pressed into its sides, hinge down, and lying on the platform: cockles (a ribbed fan, banded with its
       growth), a cowrie or two (a glossy spotted dome), now and then a mussel (long, blue-black) ── */
    {
      const sp = [], q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), nv = new T.Vector3(), fan = new T.Vector3(), tq = new T.Quaternion();
      const TONES = [[0.86, 0.78, 0.66], [0.84, 0.6, 0.52], [0.93, 0.9, 0.84], [0.8, 0.56, 0.34], [0.7, 0.66, 0.6]];
      const ns = washed > 0.5 ? 2 : 4 + Math.floor(r() * 7);
      for (let k = 0; k < ns; k++) {
        const t = towers[Math.floor(r() * towers.length)], th = r() * TAU, f = 0.25 + r() * 0.55, rr = t.rb + (t.rt - t.rb) * f, sz = 0.009 + r() * 0.007, kind = r();
        let p, n, along;
        if (r() < 0.75 && t.H > 0.06) { p = [t.x + Math.cos(th) * (rr + 0.0012), t.y0 + t.H * f, t.z + Math.sin(th) * (rr + 0.0012)]; n = [Math.cos(th), 0.12, Math.sin(th)]; along = [0, 1, 0]; }
        else { const a = r() * TAU, d = Math.sqrt(r()) * (R0 - 0.07); p = [Math.cos(a) * d, hm + 0.0015, Math.sin(a) * d]; n = [0, 1, 0]; along = [Math.cos(a + 1), 0, Math.sin(a + 1)]; }
        const tone = TONES[Math.floor(r() * TONES.length)], seedS = r() * 9;
        let geo;
        if (kind < 0.62) {
          /* a cockle: a fan of ribs from the hinge, domed, its edge scalloped by the ribs, bands of growth across them */
          const nr = 14 + Math.floor(r() * 6);
          geo = M.sheet(6, 22, (s, c) => { const an = (c - 0.5) * 2.3, rib = Math.cos(an * nr) * 0.5 + 0.5, rad = s * (1 - 0.04 * rib * s);
            return [Math.cos(an) * rad, (0.34 * Math.sqrt(Math.max(0, 1 - s * s * 0.92)) + 0.05 * rib * s) * (1 - 0.35 * Math.abs(c - 0.5)), Math.sin(an) * rad * 0.95]; },
            (s, c) => { const band = 0.88 + 0.16 * Math.sin(s * 23 + seedS), rib = 0.94 + 0.08 * Math.cos((c - 0.5) * 2.3 * nr); return tone.map(v => v * band * rib); });
        } else if (kind < 0.88) {
          /* a cowrie: a smooth glossy dome, pale spots on brown */
          geo = new T.SphereGeometry(1, 12, 8, 0, TAU, 0, Math.PI / 2); geo.scale(0.75, 0.55, 0.5);
          M.paint(geo, (x, y, z) => { const spot = M.vn(x * 9 + seedS, y * 9, z * 9) > 0.62 ? 1 : 0; return spot ? [0.86, 0.8, 0.66] : [0.42, 0.26, 0.14]; });
        } else {
          /* a mussel: long, rounded, blue-black with a brown edge */
          geo = new T.SphereGeometry(1, 12, 8, 0, TAU, 0, Math.PI / 2); geo.scale(1.15, 0.32, 0.5);
          M.paint(geo, (x, y, z) => y < 0.06 ? [0.24, 0.18, 0.1] : [0.06, 0.07, 0.1]);
        }
        /* the shell's own up turned to the face it is pressed into, its hinge (−x) down the wall */
        nv.set(...n).normalize(); q.setFromUnitVectors(up, nv);
        fan.set(1, 0, 0).applyQuaternion(q); const al = new T.Vector3(...along); al.addScaledVector(nv, -al.dot(nv)).normalize();
        const tw2 = Math.atan2(fan.clone().cross(al).dot(nv), fan.dot(al)) + (r() - 0.5) * 0.7; tq.setFromAxisAngle(nv, tw2); q.premultiply(tq);
        const m = new T.Matrix4().compose(new T.Vector3(...p), q, new T.Vector3(sz, sz, sz));
        sp.push({ geo, m });
      }
      const sh = new T.Mesh(M.mergeC(sp), mat('shell', () => M.lit('#ffffff', { vertexColors: true, roughness: 0.38 }))); sh.castShadow = true; g.add(sh);
    }
    /* ── on the keep (or the tallest tower): a twig with a strip of leaf tied on, or a gull's feather stuck in the top ── */
    const tallest = keep || towers.reduce((a, b) => (a.H > b.H ? a : b));
    const topY = tallest.top || tallest.y0 + tallest.H;
    if (washed < 0.4 && wear < 0.6 && !o.noFlag) {
      const fx = tallest.x + (r() - 0.5) * 0.02, fz = tallest.z + (r() - 0.5) * 0.02;
      const fr = r();
      if (o.flag === 'leaf' || (o.flag !== 'feather' && fr < 0.55)) {
        const L = 0.2 + r() * 0.05, bend = (r() - 0.5) * 0.03;
        const tw = new T.CatmullRomCurve3([new T.Vector3(fx, topY - 0.03, fz), new T.Vector3(fx + bend * 0.4, topY + L * 0.45, fz + 0.004), new T.Vector3(fx + bend, topY + L, fz - 0.003)]);
        g.add(new T.Mesh(M.tube(tw, 10, 5, t => 0.0032 - 0.0013 * t), mat('twig', () => M.lit('#6f5f4f', { roughness: 0.9 }))));
        /* the leaf: a strip of palm leaflet knotted on just under the tip, streaming out on the breeze */
        const fl = M.sheet(10, 2, (s, c) => { const along = s * 0.085, w = 0.016 * (1 - 0.65 * s); return [fx + bend + along, topY + L - 0.012 - 0.01 * s + (c - 0.5) * w + 0.006 * Math.sin(s * 5.5), fz - 0.003 + 0.01 * Math.sin(s * 4.2 + 0.5)]; }, (s, c) => [0.14 + 0.06 * s, 0.24 + 0.04 * c, 0.05]);
        g.add(new T.Mesh(fl, mat('leaf', () => M.lit('#ffffff', { vertexColors: true, roughness: 0.6, side: T.DoubleSide }))));
      } else {
        /* a gull's feather: a white vane, greyer toward its tip, on a pale quill, leaning a little */
        const L = 0.12 + r() * 0.03, lean = 0.18 + r() * 0.15, az = r() * TAU, ca = Math.cos(az), sa = Math.sin(az);
        const P = s => { const h = s * L; return [fx + ca * Math.sin(lean) * h + 0.004 * Math.sin(s * 2.2), topY - 0.02 + Math.cos(lean) * h, fz + sa * Math.sin(lean) * h]; };
        const fe = M.sheet(14, 6, (s, c) => { const p = P(s), v = s < 0.18 ? 0 : Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, (s - 0.18) / 0.82))), 0.55), w = (c - 0.4) * 0.024 * v, curl = 0.003 * Math.abs(c - 0.4) * v;
          return [p[0] - sa * w + ca * curl, p[1] + curl * 0.5, p[2] + ca * w + sa * curl]; },
          (s, c) => { const k = (0.8 - 0.42 * sm(0.6, 1, s) - 0.08 * Math.abs(c - 0.4)) * (0.93 + 0.07 * Math.sin(s * 70 + c * 9)); return [k, k * 0.99, k * 0.97]; });
        g.add(new T.Mesh(fe, mat('feather', () => M.lit('#ffffff', { vertexColors: true, roughness: 0.75, side: T.DoubleSide }))));
        const qc = new T.CatmullRomCurve3([0, 0.5, 1].map(s => new T.Vector3(...P(s))));
        g.add(new T.Mesh(M.tube(qc, 8, 4, t => 0.0016 - 0.0011 * t), mat('quill', () => M.lit('#e8e2d4', { roughness: 0.5 }))));
      }
    }
    /* ── a bucket and a spade, left beside it ── */
    const toys = [];
    if (o.toys) {
      const cols = ['#d8392b', '#2a6fd0', '#f0b81c', '#21a37a'], ci = Math.floor(r() * 4), plastic = hex => mat('pl' + hex, () => M.litP(hex, { roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, side: T.DoubleSide }));
      const bucket = new T.Group();
      const prof = [[0.0, 0.0], [0.064, 0.0], [0.068, 0.004], [0.086, 0.15], [0.094, 0.158], [0.094, 0.166], [0.088, 0.166], [0.081, 0.156], [0.063, 0.008], [0.0, 0.008]].map(([x, y]) => new T.Vector2(x, y));
      const bm = plastic(cols[ci]);
      bucket.add(new T.Mesh(new T.LatheGeometry(prof, 32), bm));
      const hd = new T.Mesh(new T.TorusGeometry(0.093, 0.0035, 6, 28, Math.PI), plastic(cols[ci])); hd.position.y = 0.158; hd.rotation.y = 0.4; bucket.add(hd);
      /* lying on its side, its mouth toward the castle, a little sunk in the sand */
      const ang0 = (r() - 0.5) * 1.2 + Math.PI * 0.25, ang = o.toyAng ?? ang0, d = reach + 0.1;
      bucket.position.set(Math.cos(ang) * d, 0.085, Math.sin(ang) * d); bucket.rotation.set(0, -ang + Math.PI / 2, Math.PI / 2 + 0.05);
      bucket.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(bucket);
      /* the spade stuck in the bank */
      const sp = new T.Group(), spM = plastic(cols[(ci + 2) % 4]);
      const blade = M.sheet(6, 6, (s, c) => { const w = 0.058 * (1 - 0.35 * s * s), u = (c - 0.5) * w; return [u, -s * 0.11, 0.012 * (u / 0.029) * (u / 0.029) - 0.012]; });
      blade.computeVertexNormals(); const bl = new T.Mesh(blade, spM); sp.add(bl);
      const hn = new T.Mesh(new T.CylinderGeometry(0.008, 0.009, 0.24, 8), spM); hn.position.y = 0.12; sp.add(hn);
      const grip = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.07, 8), spM); grip.rotation.z = Math.PI / 2; grip.position.y = 0.24; sp.add(grip);
      const a2 = ang + 1.4 + r() * 0.8, d2 = reach - 0.05;
      sp.position.set(Math.cos(a2) * d2, 0.07, Math.sin(a2) * d2); sp.rotation.set(0.45, -a2 + Math.PI / 2, 0.15);
      sp.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(sp);
      bucket.userData.toy = 'bucket'; sp.userData.toy = 'spade'; toys.push(bucket, sp);
      reach += 0.25;
    }
    g.userData = { radius: reach, base, top: topY, gate: gate && gate.at, toys, sand: sm0 };
    return g;
  });
})();
