/* ─────────────────────────────────────────────────────────────
   models/camp/firewood.js — wood for the fire.
     camp/log        a whole log along +x, centred: its bark furrowed,
                     its section a little out of round, gently bent,
                     each end cut to show the growth rings (charred if
                     it is going into the fire)
     camp/splitLog   a log split in quarters or thirds: bark on the
                     curved side, pale split faces, rings on the ends
     camp/fireLogs   the fire as it is laid: five logs in a star, their
                     outer ends on the ring of stones and their inner
                     ends meeting over the embers, four sticks leaning
                     over the middle. Their burning ends glow (the 'log'
                     material does that, by how near the flames they are)
     camp/woodpile   split logs stacked crosswise, a whole log beside
                     them, a few sticks of kindling
   Everything at the origin, in metres, resting on y = 0 where it rests.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, canvas, rng, wob } = Models, TAU = Math.PI * 2;

  /* ── textures ── */
  /* end grain: rings round the pith, a few checks running out from it, the bark round the edge; charred, nearly black */
  function endTex(seed, charred) {
    const N = 256, c = canvas(N, N), a = c.getContext('2d'), r = rng(seed), M = N / 2;
    a.fillStyle = charred ? '#2c2622' : '#c99e6b'; a.fillRect(0, 0, N, N);
    if (!charred) { const g = a.createRadialGradient(M, M, 4, M, M, M); g.addColorStop(0, 'rgba(150,95,45,0.35)'); g.addColorStop(0.5, 'rgba(150,95,45,0)'); g.addColorStop(0.85, 'rgba(120,75,35,0.2)'); a.fillStyle = g; a.fillRect(0, 0, N, N); }
    for (let rr = 3; rr < M * 0.86; rr += 2.5 + r() * 5) {
      a.strokeStyle = charred ? `rgba(8,6,5,${0.3 + r() * 0.35})` : `rgba(${105 + r() * 30},${66 + r() * 20},32,${0.25 + r() * 0.4})`;
      a.lineWidth = 0.8 + r() * 1.6; a.beginPath();
      for (let k = 0; k <= 72; k++) { const t = k / 72 * TAU, w = 1 + 0.035 * Math.sin(t * 3 + seed) + 0.02 * Math.sin(t * 7 + rr * 0.3); (k ? a.lineTo : a.moveTo).call(a, M + Math.cos(t) * rr * w, M + Math.sin(t) * rr * w); }
      a.stroke();
    }
    for (let i = 0, n = 3 + Math.floor(r() * 3); i < n; i++) { const t = r() * TAU, l = M * (0.35 + r() * 0.5); a.strokeStyle = charred ? 'rgba(0,0,0,0.8)' : 'rgba(45,28,14,0.65)'; a.lineWidth = 1.2 + r() * 1.8;
      a.beginPath(); a.moveTo(M + Math.cos(t) * 5, M + Math.sin(t) * 5); a.lineTo(M + Math.cos(t + (r() - 0.5) * 0.12) * l, M + Math.sin(t + (r() - 0.5) * 0.12) * l); a.stroke(); }
    a.strokeStyle = charred ? '#141110' : '#4b3524'; a.lineWidth = N * 0.1; a.beginPath(); a.arc(M, M, M * 0.95, 0, TAU); a.stroke();
    a.strokeStyle = charred ? '#0c0a09' : '#2e2016'; a.lineWidth = N * 0.03; a.beginPath(); a.arc(M, M, M * 0.99, 0, TAU); a.stroke();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  /* split wood: pale, the grain in long streaks, a few darker ones and torn fibres */
  function splitTex(seed) {
    const c = canvas(128, 512), a = c.getContext('2d'), r = rng(seed);
    a.fillStyle = '#c69a66'; a.fillRect(0, 0, 128, 512);
    for (let x = 0; x < 128; x += 1 + r() * 2.5) { a.fillStyle = `rgba(${105 + r() * 40},${66 + r() * 25},30,${0.08 + r() * 0.22})`; a.fillRect(x, 0, 0.8 + r() * 1.8, 512); }
    for (let i = 0; i < 7; i++) { a.fillStyle = `rgba(88,54,24,${0.12 + r() * 0.2})`; a.fillRect(r() * 128, 0, 2 + r() * 5, 512); }
    for (let i = 0; i < 40; i++) { a.fillStyle = `rgba(235,205,160,${0.1 + r() * 0.2})`; a.fillRect(r() * 128, r() * 512, 1 + r() * 2, 20 + r() * 90); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }

  /* ── geometry ── */
  /* triangles whose winding is decided by which way they should face (so every face points out) */
  function builder() {
    const pos = [], uv = [], idx = [], groups = []; let g0 = 0, mat = 0;
    const P = i => new T.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), e1 = new T.Vector3(), e2 = new T.Vector3();
    return {
      v(p, u, w) { pos.push(p.x, p.y, p.z); uv.push(u, w); return pos.length / 3 - 1; },
      tri(a, b, c, out) { const A = P(a); e1.copy(P(b)).sub(A); e2.copy(P(c)).sub(A); if (e1.cross(e2).dot(out) < 0) idx.push(a, c, b); else idx.push(a, b, c); },
      mat(m) { if (idx.length > g0) groups.push([g0, idx.length - g0, mat]); g0 = idx.length; mat = m; },
      done() {
        this.mat(0);
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
        g.setIndex(idx); groups.forEach(([s, n, m]) => g.addGroup(s, n, m)); g.computeVertexNormals(); return g;
      }
    };
  }
  /* a log along x: material 0 its bark, 1 its ends */
  function logGeo({ len = 0.6, r = 0.06, seed = 1, bend = 0.03, taper = 0.12, NA = 22, NL = 12 } = {}) {
    const R = rng(seed), wA = wob(seed), wB = wob(seed + 7), furrows = 7 + Math.floor(R() * 5), B = builder();
    const rad = (th, s) => r * (1 - taper * s) * (1 + 0.06 * wA(th * 1.3 + s * 2.1) + 0.03 * Math.sin(th * furrows + 2.5 * wB(s * 5)) + 0.015 * Math.sin(th * 23 + s * 40));
    const ctr = s => new T.Vector3((s - 0.5) * len, bend * len * Math.sin(s * Math.PI), bend * 0.6 * len * Math.sin(s * Math.PI * 1.3 + seed));
    const ring = [], C = r * TAU;
    for (let j = 0; j <= NL; j++) { const s = j / NL, c = ctr(s), row = [];
      for (let k = 0; k <= NA; k++) { const th = k / NA * TAU, rr = rad(th, s); row.push(B.v(new T.Vector3(c.x, c.y + Math.cos(th) * rr, c.z + Math.sin(th) * rr), k / NA * C / 0.32, s * len / 0.32)); }
      ring.push(row); }
    for (let j = 0; j < NL; j++) for (let k = 0; k < NA; k++) {
      const th = (k + 0.5) / NA * TAU, out = new T.Vector3(0, Math.cos(th), Math.sin(th));
      B.tri(ring[j][k], ring[j][k + 1], ring[j + 1][k], out); B.tri(ring[j][k + 1], ring[j + 1][k + 1], ring[j + 1][k], out);
    }
    B.mat(1);
    for (const s of [0, 1]) { const c = ctr(s), mid = B.v(c, 0.5, 0.5), out = new T.Vector3(s ? 1 : -1, 0, 0), rim = [];
      for (let k = 0; k <= NA; k++) { const th = k / NA * TAU, rr = rad(th, s); rim.push(B.v(new T.Vector3(c.x, c.y + Math.cos(th) * rr, c.z + Math.sin(th) * rr), 0.5 + Math.cos(th) * 0.485, 0.5 + Math.sin(th) * 0.485)); }
      for (let k = 0; k < NA; k++) B.tri(mid, rim[k], rim[k + 1], out); }
    return B.done();
  }
  /* a split piece along x: the sector between angles a0 and a0 + span of a log of radius r. Material 0 bark, 1 the split
     faces, 2 the ends. Centred on its own middle */
  function splitGeo({ len = 0.45, r = 0.09, span = 1.6, seed = 1, NA = 10, NL = 8 } = {}) {
    const R = rng(seed), wA = wob(seed), B = builder(), a0 = -span / 2;
    const cy = 2 * r * Math.sin(span / 2) / (3 * span / 2) * 0.9;    /* (the sector's middle, near enough) */
    const rad = (th, s) => r * (1 + 0.05 * wA(th * 2 + s * 3) + 0.02 * Math.sin(th * 31 + s * 17));
    const pt = (th, s, k = 1) => new T.Vector3((s - 0.5) * len, Math.cos(th) * rad(th, s) * k - cy, Math.sin(th) * rad(th, s) * k);
    /* the bark */
    const arc = [];
    for (let j = 0; j <= NL; j++) { const s = j / NL, row = []; for (let k = 0; k <= NA; k++) { const th = a0 + span * k / NA; row.push(B.v(pt(th, s), k / NA * span * r / 0.32, s * len / 0.32)); } arc.push(row); }
    for (let j = 0; j < NL; j++) for (let k = 0; k < NA; k++) { const th = a0 + span * (k + 0.5) / NA, out = new T.Vector3(0, Math.cos(th), Math.sin(th));
      B.tri(arc[j][k], arc[j][k + 1], arc[j + 1][k], out); B.tri(arc[j][k + 1], arc[j + 1][k + 1], arc[j + 1][k], out); }
    /* the two split faces, a little uneven, as wood splits */
    B.mat(1);
    for (const side of [0, 1]) {
      const th = side ? a0 + span : a0, out = side ? new T.Vector3(0, -Math.sin(th), Math.cos(th)) : new T.Vector3(0, Math.sin(th), -Math.cos(th)), rows = [];
      for (let j = 0; j <= NL; j++) { const s = j / NL, row = [];
        for (let q = 0; q <= 3; q++) { const k = q / 3, p = pt(th, s, k); p.addScaledVector(out, 0.004 * Math.sin(s * 19 + q * 2 + seed) * (q % 3 ? 1 : 0)); row.push(B.v(p, k * r / 0.12 + side * 0.5, s * len / 0.4)); }
        rows.push(row); }
      for (let j = 0; j < NL; j++) for (let q = 0; q < 3; q++) { B.tri(rows[j][q], rows[j][q + 1], rows[j + 1][q], out); B.tri(rows[j][q + 1], rows[j + 1][q + 1], rows[j + 1][q], out); }
    }
    /* the ends */
    B.mat(2);
    for (const s of [0, 1]) { const out = new T.Vector3(s ? 1 : -1, 0, 0), mid = B.v(pt(0, s, 0), 0.5, 0.5), rim = [];
      for (let k = 0; k <= NA; k++) { const th = a0 + span * k / NA; rim.push(B.v(pt(th, s), 0.5 + Math.cos(th) * 0.485, 0.5 + Math.sin(th) * 0.485)); }
      for (let k = 0; k < NA; k++) B.tri(mid, rim[k], rim[k + 1], out); }
    return B.done();
  }
  /* a piece placed along a line from a to b (centred between them), rolled about its own axis by roll */
  function lay(o, a, b, roll = 0) {
    const d = b.clone().sub(a), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), d.clone().normalize());
    o.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), roll)); o.position.copy(a).add(b).multiplyScalar(0.5); return o;
  }
  /* rest o on height y (its lowest point there) */
  function restOn(o, y) { o.updateMatrix(); o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrix); o.position.y += y - b.min.y; return o; }
  const mats = {};
  function woodMats(fire) {
    const k = fire ? 'fire' : 'pile'; if (mats[k]) return mats[k];
    const key = fire ? 'log' : undefined;
    return (mats[k] = { bark: Mats.lit({ map: Mats.tex(Paint.logBark(fire ? 7 : 19), { repeat: true }), roughness: 0.95 }, key), split: Mats.lit({ map: splitTex(fire ? 3 : 5), roughness: 0.85 }, key),
      end: Mats.lit({ map: endTex(fire ? 3 : 9, fire), roughness: 0.92 }, key) });
  }

  Models.add('camp/log', (o = {}) => { const M = woodMats(!!o.fire); return mesh(logGeo(o), [M.bark, M.end]); });
  Models.add('camp/splitLog', (o = {}) => { const M = woodMats(!!o.fire); return mesh(splitGeo(o), [M.bark, M.split, M.end]); });

  Models.add('camp/fireLogs', (o = {}) => {
    const g = new T.Group(), R = rng(o.seed || 91), M = woodMats(true);
    /* five logs in a star: the outer end of each rests on the ring of stones, the inner ends meet over the embers, one
       across another */
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.35 + (R() - 0.5) * 0.3, rr = 0.05 + R() * 0.018;
      const outer = new T.Vector3(Math.cos(a) * 0.6, 0.075 + R() * 0.02, Math.sin(a) * 0.6), inner = new T.Vector3(Math.cos(a + 0.5) * 0.06, 0.07 + (i % 3) * 0.045, Math.sin(a + 0.5) * 0.06);
      const log = mesh(logGeo({ len: outer.distanceTo(inner) + 0.08, r: rr, seed: 11 + i * 3, bend: 0.025, taper: 0.08 }), [M.bark, M.end]);
      g.add(lay(log, outer, inner, R() * TAU));
    }
    /* sticks leaning together over the middle */
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + 0.9 + (R() - 0.5) * 0.4, base = new T.Vector3(Math.cos(a) * 0.24, 0.05, Math.sin(a) * 0.24), top = new T.Vector3(Math.cos(a + 2.8) * 0.05, 0.36 + R() * 0.07, Math.sin(a + 2.8) * 0.05);
      const st = mesh(logGeo({ len: base.distanceTo(top) + 0.06, r: 0.022 + R() * 0.01, seed: 40 + i, bend: 0.04, taper: 0.3, NA: 12, NL: 8 }), [M.bark, M.end]);
      g.add(lay(st, base, top, R() * TAU));
    }
    g.traverse(m => { if (m.isMesh) m.userData.noFireShadow = true; });
    return g;
  });

  Models.add('camp/woodpile', (o = {}) => {
    const g = new T.Group(), R = rng(o.seed || 55), M = woodMats(false), mat = [M.bark, M.split, M.end];
    /* split logs in rows, each row across the one beneath */
    let base = 0;
    [[3, 0], [3, 1], [2, 0]].forEach(([n, across]) => {
      let top = base;
      for (let i = 0; i < n; i++) {
        const len = 0.4 + R() * 0.08, r = 0.075 + R() * 0.02, off = (i - (n - 1) / 2) * 0.16 + (R() - 0.5) * 0.02;
        const p = mesh(splitGeo({ len, r, span: 1.3 + R() * 0.6, seed: 70 + base * 100 + i }), mat);
        const a = across ? new T.Vector3(off, 0, -len / 2) : new T.Vector3(-len / 2, 0, off), b = across ? new T.Vector3(off, 0, len / 2) : new T.Vector3(len / 2, 0, off);
        lay(p, a, b, (R() < 0.5 ? 0 : Math.PI) + (R() - 0.5) * 0.7); restOn(p, base);
        p.updateMatrix(); const bb = p.geometry.boundingBox.clone().applyMatrix4(p.matrix); top = Math.max(top, bb.max.y);
        g.add(p);
      }
      base = base + (top - base) * 0.7;
    });
    /* a whole log beside the stack, and a few sticks of kindling */
    const lg = mesh(logGeo({ len: 0.46, r: 0.07, seed: 91, bend: 0.02, taper: 0.06 }), [M.bark, M.end]);
    lay(lg, new T.Vector3(-0.16, 0, 0.27), new T.Vector3(0.28, 0, 0.33), 0.8); restOn(lg, 0); g.add(lg);
    for (let i = 0; i < 4; i++) {
      const k = mesh(logGeo({ len: 0.36 + R() * 0.1, r: 0.012 + R() * 0.006, seed: 120 + i, bend: 0.05, taper: 0.25, NA: 8, NL: 6 }), [M.bark, M.end]);
      lay(k, new T.Vector3(-0.3 + R() * 0.05, 0, -0.26 + i * 0.035), new T.Vector3(0.05 + R() * 0.08, 0, -0.3 + i * 0.03), R() * TAU); restOn(k, 0); g.add(k);
    }
    return g;
  });
})();
