/* ─────────────────────────────────────────────────────────────
   wild/ — the island's animals. They are skinned, so they move the
   way animals do: each is one body over a skeleton of bones set where
   its own joints are (in metres, facing +x, standing on y = 0), bound
   to them so it bends smoothly at every joint. The body is sculpted:
   a smooth union of shapes (a ribcage, a thigh's muscles, a skull, its
   eye sockets cut out of it) turned into a surface, each point of it
   following the bones of the shapes it was made from. Fur grows out
   of it in shells; its bare skin, eyes, nails, horn and scales are one
   material that each point of the body tells what it is.
   Every model gives its motions as clips — functions of time that pose
   its bones — and a mixer eases from one to the next.

     Rig.skeleton(defs)           the bones: [name, parent, [x, y, z], { tail }]
     Rig.sculpt(shapes, o)        a part sculpted from shapes, bound and painted
     Rig.tube(pts, r, o)          a part shaped as a tube through points
     Rig.rigid / chain / near     how a part made some other way follows its bones
     Rig.body(S, parts, o)        the skinned body and its fur, as one model
     Rig.Pose, Rig.ik2, Rig.reach posing, and limbs that reach where they must
     Rig.creature(g, S, clips, o) the clips and the mixer: userData.rig, userData.anim
   ───────────────────────────────────────────────────────────── */
const Rig = (() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const sst = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1e-9), 0, 1); return t * t * (3 - 2 * t); };
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const h1 = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  /* (how finely the creatures are made: 1 in the studio, where they are looked at from a hand away; coarser in the
     world, where each is built while the visitor waits and drawn among a forest — cell: the sculpting's grid, times;
     shells: the fur's layers, times) */
  const Q = { cell: 1, shells: 1 };

  /* ── the skeleton: bones given parents first, each at its joint in the rest pose; its tail (where it points, for
     binding by nearness) its one child's joint unless given ── */
  function skeleton(defs) {
    const S = { bones: [], ix: {}, head: {}, tail: {}, par: {}, kids: {}, by: {}, names: [], path: {} };
    for (const [name, par, at, op = {}] of defs) {
      if (S.ix[name] !== undefined) throw new Error('Rig: two bones called ' + name);
      const b = new T.Bone(); b.name = name;
      S.head[name] = new T.Vector3(...at); S.par[name] = par || null; S.kids[name] = [];
      S.ix[name] = S.bones.length; S.bones.push(b); S.by[name] = b; S.names.push(name);
      if (par) {
        if (!S.by[par]) throw new Error('Rig: ' + name + '’s parent ' + par + ' comes after it');
        S.by[par].add(b); b.position.copy(S.head[name]).sub(S.head[par]); S.kids[par].push(name); S.path[name] = [...S.path[par], name];
      } else { if (S.root) throw new Error('Rig: two roots'); b.position.copy(S.head[name]); S.root = name; S.path[name] = [name]; }
      if (op.tail) S.tail[name] = new T.Vector3(...op.tail);
    }
    for (const n of S.names) if (!S.tail[n]) { const k = S.kids[n]; S.tail[n] = k.length === 1 ? S.head[k[0]].clone() : S.head[n].clone().add(new T.Vector3(0.01, 0, 0)); }
    S.skeleton = new T.Skeleton(S.bones);
    /* (the other side's bone: names ending L and R are a pair, L on −z, R on +z) */
    S.other = n => /L$/.test(n) && S.ix[n.slice(0, -1) + 'R'] !== undefined ? n.slice(0, -1) + 'R' : /R$/.test(n) && S.ix[n.slice(0, -1) + 'L'] !== undefined ? n.slice(0, -1) + 'L' : n;
    return S;
  }
  /* both sides at once: fn(s, X) for s = −1 (X = 'L') and s = +1 (X = 'R'), the results joined */
  const sides = fn => [...fn(-1, 'L'), ...fn(1, 'R')];

  /* ── how a part follows its bones: each gives, for a point of it, [[bone index, weight], …] ── */
  const rigid = (S, name) => { const i = S.ix[name]; return () => [[i, 1]]; };
  /* along a chain of bones: the point's place along the line through their joints (from, to: its ends, if not the first
     bone's joint and the last one's tail), shared between neighbours over h of the shorter bone either side of a joint */
  function chain(S, names, { h = 0.35, from, to } = {}) {
    const P = names.map(n => S.head[n].toArray()); if (from) P[0] = from;
    P.push(to || S.tail[names[names.length - 1]].toArray());
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    const ids = names.map(n => S.ix[n]), k = names.length, hw = j => j <= 0 || j >= k ? 0 : h * Math.min(L[j] - L[j - 1], L[j + 1] - L[j]);
    return (x, y, z) => {
      let best = Infinity, s = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], l2 = ux * ux + uy * uy + uz * uz || 1e-12;
        const t = clamp(((x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz) / l2, 0, 1), dx = a[0] + ux * t - x, dy = a[1] + uy * t - y, dz = a[2] + uz * t - z, d = dx * dx + dy * dy + dz * dz;
        if (d < best - 1e-12) { best = d; s = L[i] + t * (L[i + 1] - L[i]); }
      }
      const out = [];
      for (let j = 0; j < k; j++) {
        const a = j === 0 ? 1 : sst(L[j] - hw(j) - 1e-9, L[j] + hw(j) + 1e-9, s), b = j === k - 1 ? 0 : sst(L[j + 1] - hw(j + 1) - 1e-9, L[j + 1] + hw(j + 1) + 1e-9, s);
        if (a - b > 1e-4) out.push([ids[j], a - b]);
      }
      return out;
    };
  }
  /* by nearness to each bone (from its joint to its tail): the nearest most, sharply (p) */
  function near(S, names, { p = 8 } = {}) {
    const sg = names.map(n => [S.ix[n], S.head[n].toArray(), S.tail[n].toArray()]);
    return (x, y, z) => {
      const ws = sg.map(([i, a, b]) => {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], l2 = ux * ux + uy * uy + uz * uz || 1e-12, t = clamp(((x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz) / l2, 0, 1);
        return [i, 1 / Math.pow(Math.hypot(a[0] + ux * t - x, a[1] + uy * t - y, a[2] + uz * t - z) + 2e-3, p)];
      });
      return ws.sort((u, v) => v[1] - u[1]).slice(0, 4);
    };
  }
  /* two ways of following, mixed as k(x, y, z) says (0 the first, 1 the second) */
  const blend = (A, B, k) => (x, y, z, i) => {
    const f = clamp(k(x, y, z, i), 0, 1), m = new Map();
    if (f < 1) for (const [b, w] of A(x, y, z, i)) m.set(b, (m.get(b) || 0) + w * (1 - f));
    if (f > 0) for (const [b, w] of B(x, y, z, i)) m.set(b, (m.get(b) || 0) + w * f);
    return [...m];
  };

  /* ── a tube through points (a centripetal Catmull-Rom), its section at s (0..1 along) and angle a round: r(s, a) → a
     radius, or [across, up] for an ellipse. up: the way its sections' a = 0 faces (+y; or a function of s), kept square
     to the tube. Its ends closed by rounded caps reaching cap0 and cap1 beyond them. uv = (s, a/2π) ── */
  function tube(pts, r, { n = 24, m = 16, up = [0, 1, 0], cap0 = 0, cap1 = 0, nc = 5 } = {}) {
    const C = pts.getPointAt ? pts : new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)), false, 'centripetal');
    const upAt = typeof up === 'function' ? up : () => up, Rr = (s, a) => { const v = r(s, a); return typeof v === 'number' ? [v, v] : v; };
    const rows = [];
    if (cap0 > 0) for (let i = nc; i >= 1; i--) { const th = i / nc * Math.PI / 2; rows.push([0, -cap0 * Math.sin(th), Math.cos(th)]); }
    for (let i = 0; i <= n; i++) rows.push([i / n, 0, 1]);
    if (cap1 > 0) for (let i = 1; i <= nc; i++) { const th = i / nc * Math.PI / 2; rows.push([1, cap1 * Math.sin(th), Math.cos(th)]); }
    const pos = [], uv = [], idx = [], tg = new T.Vector3(), Nn = new T.Vector3(), Bb = new T.Vector3(), c = new T.Vector3(), u = new T.Vector3();
    for (const [s, off, sc] of rows) {
      C.getPointAt(s, c); C.getTangentAt(s, tg).normalize(); u.set(...upAt(s));
      Nn.copy(u).addScaledVector(tg, -u.dot(tg)); if (Nn.lengthSq() < 1e-8) Nn.set(1, 0, 0).addScaledVector(tg, -tg.x); Nn.normalize(); Bb.crossVectors(tg, Nn);
      c.addScaledVector(tg, off);
      for (let j = 0; j <= m; j++) {
        const a = j / m * TAU, [rx, ry] = Rr(s, a), ca = Math.cos(a) * ry * sc, sa = Math.sin(a) * rx * sc;
        pos.push(c.x + Nn.x * ca + Bb.x * sa, c.y + Nn.y * ca + Bb.y * sa, c.z + Nn.z * ca + Bb.z * sa); uv.push(s, j / m);
      }
    }
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + 1, c2 = a + m + 1, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
    const N = M.normalsOf(pos, idx);
    /* (smooth across the seam: the first and last of each ring are one point) */
    for (let i = 0; i < rows.length; i++) { const a = i * (m + 1) * 3, b = (i * (m + 1) + m) * 3; for (let k = 0; k < 3; k++) { const v = N[a + k] + N[b + k]; N[a + k] = N[b + k] = v; } const l = Math.hypot(N[a], N[a + 1], N[a + 2]) || 1; for (let k = 0; k < 3; k++) { N[a + k] /= l; N[b + k] /= l; } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }

  /* ── sculpting: a body as a smooth union of shapes, made into a surface (surface nets over the narrow band where it
     lies), each point bound to the bones of the shapes it is nearest, each painted.
     A shape is one of
       { ell: [x, y, z], r: [rx, ry, rz], rot: [ax, ay, az] }     an ellipsoid (turned, Euler XYZ)
       { cap: [[x, y, z], [x, y, z]], r: [ra, rb] }                 a rounded cone from one end to the other
       { box: [x, y, z], h: [hx, hy, hz], rr, rot }                 a rounded box
       { fn: (x, y, z) => distance, c: [x, y, z], rb }              anything else, within rb of c
     with: bone (what it follows), tag (what it is, for painting), k (how softly it joins what comes before; 0 sharp),
     sub (cut away, softly by k, after all the shapes are joined), after (joined after the cuts), w (how strongly it
     pulls its points to its bone). o: { cell (the size of the surface's facets), tau (how far a point's binding blends
     between shapes), paint(x, y, z, nx, ny, nz, tags) → { col, mat, fur, comb }, bind(x, y, z, weights, tags) → weights,
     disp(x, y, z) a small relief added to the field } ── */
  const smin = (a, b, k) => { if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return (a < b ? a : b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  function rotInv(rot) {
    if (!rot) return null;
    const m = new T.Matrix4().makeRotationFromEuler(new T.Euler(rot[0], rot[1], rot[2], rot[3] || 'XYZ')).transpose().elements;
    return [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  }
  function shape(p) {
    const q = { k: p.k ?? 0.012, w: p.w ?? 1, bone: p.bone, tag: p.tag || 'skin', sub: !!p.sub, after: !!p.after };
    if (p.ell) {
      const [cx, cy, cz] = p.ell, [rx, ry, rz] = p.r, R = rotInv(p.rot), mr = Math.min(rx, ry, rz);
      q.d = (x, y, z) => {
        let X = x - cx, Y = y - cy, Z = z - cz;
        if (R) { const a = R[0] * X + R[1] * Y + R[2] * Z, b = R[3] * X + R[4] * Y + R[5] * Z, c = R[6] * X + R[7] * Y + R[8] * Z; X = a; Y = b; Z = c; }
        const a = X / rx, b = Y / ry, c = Z / rz, k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt(a * a / (rx * rx) + b * b / (ry * ry) + c * c / (rz * rz));
        return k1 < 1e-12 ? -mr : k0 * (k0 - 1) / k1;
      };
      q.c = [cx, cy, cz]; q.rb = Math.max(rx, ry, rz);
    } else if (p.cap) {
      const [A, B] = p.cap, ra = p.r[0], rb = p.r[1] ?? p.r[0], bx = B[0] - A[0], by = B[1] - A[1], bz = B[2] - A[2], l2 = bx * bx + by * by + bz * bz, rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
      q.d = (x, y, z) => {
        const px = x - A[0], py = y - A[1], pz = z - A[2], yy = px * bx + py * by + pz * bz, zz = yy - l2;
        const vx = px * l2 - bx * yy, vy = py * l2 - by * yy, vz = pz * l2 - bz * yy, x2 = vx * vx + vy * vy + vz * vz, y2 = yy * yy * l2, z2 = zz * zz * l2, kk = Math.sign(rr) * rr * rr * x2;
        if (Math.sign(zz) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - rb;
        if (Math.sign(yy) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - ra;
        return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
      };
      q.c = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]; q.rb = Math.sqrt(l2) / 2 + Math.max(ra, rb);
    } else if (p.box) {
      const [cx, cy, cz] = p.box, [hx, hy, hz] = p.h, rr = p.rr || 0, R = rotInv(p.rot);
      q.d = (x, y, z) => {
        let X = x - cx, Y = y - cy, Z = z - cz;
        if (R) { const a = R[0] * X + R[1] * Y + R[2] * Z, b = R[3] * X + R[4] * Y + R[5] * Z, c = R[6] * X + R[7] * Y + R[8] * Z; X = a; Y = b; Z = c; }
        const ax = Math.abs(X) - hx + rr, ay = Math.abs(Y) - hy + rr, az = Math.abs(Z) - hz + rr;
        return Math.hypot(Math.max(ax, 0), Math.max(ay, 0), Math.max(az, 0)) + Math.min(Math.max(ax, ay, az), 0) - rr;
      };
      q.c = [cx, cy, cz]; q.rb = Math.hypot(hx, hy, hz);
    } else if (p.fn) { q.d = p.fn; q.c = p.c; q.rb = p.rb; }
    else throw new Error('Rig.sculpt: a shape of no kind');
    return q;
  }
  /* the field of a list of shapes, everywhere (for looking at a sculpt's sections: tools/slice.mjs) */
  function field(list, o = {}) {
    const P = list.map(shape), U = P.filter(p => !p.sub && !p.after), D = P.filter(p => p.sub), A = P.filter(p => p.after && !p.sub);
    const f = (x, y, z) => { let d = 1e9; for (const p of U) d = smin(d, p.d(x, y, z), p.k); for (const p of D) d = smax(d, -p.d(x, y, z), p.k); for (const p of A) d = smin(d, p.d(x, y, z), p.k); return o.disp ? d + o.disp(x, y, z) : d; };
    f.tagAt = (x, y, z) => { let best = Infinity, tag = ''; for (const p of P) { const d = Math.abs(p.d(x, y, z)); if (d < best) { best = d; tag = p.tag; } } return tag; };
    return f;
  }
  const rec = { on: false, list: [] };
  function sculpt(list, o = {}) {
    if (rec.on) rec.list.push({ list, o });
    const cell = (o.cell || 0.003) * Q.cell, Bk = 4, tau = o.tau || 0.006, disp = o.disp;
    const P = list.map(shape), U = P.filter(p => !p.sub && !p.after), D = P.filter(p => p.sub), A = P.filter(p => p.after && !p.sub);
    const field = (x, y, z, Ul, Dl, Al) => {
      let d = 1e9; for (const p of Ul) d = smin(d, p.d(x, y, z), p.k);
      for (const p of Dl) d = smax(d, -p.d(x, y, z), p.k);
      for (const p of Al) d = smin(d, p.d(x, y, z), p.k);
      return disp ? d + disp(x, y, z) : d;
    };
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const p of [...U, ...A]) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.c[i] - p.rb - 3 * cell); hi[i] = Math.max(hi[i], p.c[i] + p.rb + 3 * cell); }
    const n = [0, 1, 2].map(i => Math.ceil((hi[i] - lo[i]) / cell / Bk) * Bk), NX = n[0] + 1, NY = n[1] + 1, NZ = n[2] + 1;
    const V = new Float32Array(NX * NY * NZ).fill(NaN), gi = (i, j, k) => (k * NY + j) * NX + i, RB = Bk * cell * Math.sqrt(3) / 2;
    const nearOf = (x, y, z, R) => { const f = p => Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) < p.rb + R + p.k + cell; return [U.filter(f), D.filter(f), A.filter(f)]; };
    /* (the blocks of 4³ cells the surface may pass through: the rest are skipped) */
    const blocks = [];
    for (let bk = 0; bk < n[2] / Bk; bk++) for (let bj = 0; bj < n[1] / Bk; bj++) for (let bi = 0; bi < n[0] / Bk; bi++) {
      const cx = lo[0] + (bi + 0.5) * Bk * cell, cy = lo[1] + (bj + 0.5) * Bk * cell, cz = lo[2] + (bk + 0.5) * Bk * cell, L = nearOf(cx, cy, cz, RB);
      if (!L[0].length && !L[2].length) continue;
      if (Math.abs(field(cx, cy, cz, ...L)) > RB * 1.35 + cell) continue;
      blocks.push([bi, bj, bk, L]);
    }
    const val = (i, j, k, L) => { const g = gi(i, j, k); let v = V[g]; if (v !== v) { const x = lo[0] + i * cell, y = lo[1] + j * cell, z = lo[2] + k * cell; v = V[g] = field(x, y, z, ...(L || nearOf(x, y, z, cell))); } return v; };
    for (const [bi, bj, bk, L] of blocks) for (let k = bk * Bk; k <= bk * Bk + Bk; k++) for (let j = bj * Bk; j <= bj * Bk + Bk; j++) for (let i = bi * Bk; i <= bi * Bk + Bk; i++) val(i, j, k, L);
    /* (a vertex in each cell the surface crosses, where its edges' crossings average) */
    const VI = new Int32Array(n[0] * n[1] * n[2]).fill(-1), ci = (i, j, k) => (k * n[1] + j) * n[0] + i, pos = [];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], cv = new Float64Array(8);
    const vert = (i, j, k) => {
      if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return -1;
      const c = ci(i, j, k); if (VI[c] >= 0) return VI[c];
      for (let q = 0; q < 8; q++) cv[q] = val(i + (q & 1), j + ((q >> 1) & 1), k + ((q >> 2) & 1));
      let sx = 0, sy = 0, sz = 0, cnt = 0;
      for (const [a, b] of EDGES) {
        const va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb); sx += (a & 1) + (((b & 1) - (a & 1)) * t); sy += ((a >> 1) & 1) + ((((b >> 1) & 1) - ((a >> 1) & 1)) * t); sz += ((a >> 2) & 1) + ((((b >> 2) & 1) - ((a >> 2) & 1)) * t); cnt++;
      }
      if (!cnt) return -1;
      VI[c] = pos.length / 3; pos.push(lo[0] + (i + sx / cnt) * cell, lo[1] + (j + sy / cnt) * cell, lo[2] + (k + sz / cnt) * cell); return VI[c];
    };
    /* (a quad across each edge the surface crosses, from the four cells round it, facing out) */
    const idx = [], quad = (a, b, c, d, flip) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (flip) { const t = b; b = d; d = t; }
      const dAC = Math.hypot(pos[a * 3] - pos[c * 3], pos[a * 3 + 1] - pos[c * 3 + 1], pos[a * 3 + 2] - pos[c * 3 + 2]), dBD = Math.hypot(pos[b * 3] - pos[d * 3], pos[b * 3 + 1] - pos[d * 3 + 1], pos[b * 3 + 2] - pos[d * 3 + 2]);
      if (dAC < dBD) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
    };
    for (const [bi, bj, bk] of blocks) for (let k = bk * Bk; k < bk * Bk + Bk; k++) for (let j = bj * Bk; j < bj * Bk + Bk; j++) for (let i = bi * Bk; i < bi * Bk + Bk; i++) {
      const v0 = val(i, j, k), in0 = v0 < 0;
      if (j > 0 && k > 0 && (val(i + 1, j, k) < 0) !== in0) quad(vert(i, j - 1, k - 1), vert(i, j, k - 1), vert(i, j, k), vert(i, j - 1, k), !in0);
      if (i > 0 && k > 0 && (val(i, j + 1, k) < 0) !== in0) quad(vert(i - 1, j, k - 1), vert(i - 1, j, k), vert(i, j, k), vert(i, j, k - 1), !in0);
      if (i > 0 && j > 0 && (val(i, j, k + 1) < 0) !== in0) quad(vert(i - 1, j - 1, k), vert(i, j - 1, k), vert(i, j, k), vert(i - 1, j, k), !in0);
    }
    /* (each vertex drawn onto the surface itself, and its normal the field's gradient) */
    const nv = pos.length / 3, nor = new Float32Array(nv * 3), e = cell * 0.3;
    for (let v = 0; v < nv; v++) {
      let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2]; const L = nearOf(x, y, z, cell * 2), f = (a, b, c) => field(a, b, c, ...L);
      for (let it = 0; it < 2; it++) {
        const f0 = f(x, y, z), gx = (f(x + e, y, z) - f(x - e, y, z)) / (2 * e), gy = (f(x, y + e, z) - f(x, y - e, z)) / (2 * e), gz = (f(x, y, z + e) - f(x, y, z - e)) / (2 * e), g2 = gx * gx + gy * gy + gz * gz || 1;
        const st = clamp(f0 / g2, -cell * 0.6, cell * 0.6);
        x -= gx * st; y -= gy * st; z -= gz * st;
        if (it === 1) { const l = Math.sqrt(g2); nor[v * 3] = gx / l; nor[v * 3 + 1] = gy / l; nor[v * 3 + 2] = gz / l; }
      }
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    }
    /* (the points' bones and what they are: from the shapes they lie on, shared between shapes that meet) */
    const S = o.S, W = [], TG = [], skin = P.filter(p => !p.sub);
    for (let v = 0; v < nv; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ds = skin.map(p => p.d(x, y, z)), dm = Math.min(...ds), bw = new Map(), tw = {};
      skin.forEach((p, i) => { const w = p.w * Math.exp(-(ds[i] - dm) / tau); if (w < 1e-4) return; if (p.bone) bw.set(p.bone, (bw.get(p.bone) || 0) + w); tw[p.tag] = (tw[p.tag] || 0) + w; });
      let ts = 0; for (const t in tw) ts += tw[t]; for (const t in tw) tw[t] /= ts;
      let ws = [...bw].map(([b, w]) => [S ? S.ix[b] : b, w]);
      if (o.bind) ws = o.bind(x, y, z, ws, tw, nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
      W.push(ws); TG.push(tw);
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setIndex(idx);
    const part = { geo, bind: (x, y, z, i) => W[i], tags: TG };
    if (o.paint) {
      const R = []; for (let v = 0; v < nv; v++) R.push(o.paint(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2], TG[v]));
      Object.assign(part, { col: (x, y, z, i) => R[i].col, mat: (x, y, z, i) => R[i].mat, fur: (x, y, z, i) => R[i].fur || 0, comb: (x, y, z, i) => R[i].comb || [0, 0, 0] });
    }
    return part;
  }
  /* the same part on the other side: z turned over, its faces turned back out, its bones swapped for their pairs */
  function mirror(part, S) {
    const g = part.geo.clone(), P = g.attributes.position, N = g.attributes.normal, I = g.index.array;
    for (let i = 0; i < P.count; i++) { P.setZ(i, -P.getZ(i)); N.setZ(i, -N.getZ(i)); }
    for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
    const swap = ws => ws.map(([b, w]) => [S.ix[S.other(S.bones[b].name)], w]), F = f => typeof f === 'function' ? (x, y, z, i) => f(x, y, -z, i) : f;
    return Object.assign({}, part, { geo: g, bind: (x, y, z, i) => swap(part.bind(x, y, -z, i)), col: F(part.col), mat: F(part.mat), fur: F(part.fur),
      comb: typeof part.comb === 'function' ? (x, y, z, i) => { const c = part.comb(x, y, -z, i); return [c[0], c[1], -c[2]]; } : part.comb && [part.comb[0], part.comb[1], -part.comb[2]] });
  }

  /* ── the look: one material for the whole body; what each point is comes with it as aM = [roughness, clearcoat,
     pattern, thinness] — pattern 1 fur (the coat under its shells, and all of it seen from far off), 2 feathers, 3
     scales, 4 bare skin, 5 horn, nail, claw or tooth, 6 an eye (its uv: how far from the middle of it, and round), 7
     chitin, 8 a membrane, 9 a flight feather's vane; aFur = [the fur's length, the way it lies (its length how far it
     leans)], or for an eye [0, the iris's radius, the pupil's, the white's brightness], for feathers [their spacing (m)],
     for a vane [where its shaft is across it (uv.x), its length, its width (m), which feather] ── */
  const PAT = { none: 0, fur: 1, feather: 2, scale: 3, skin: 4, horn: 5, eye: 6, chitin: 7, membrane: 8, vane: 9 };
  let FURT = null;
  /* the fur's strands: each texel one, its length (red), its shade (green), the clump it is in (blue); tiling */
  function furTex() {
    if (FURT) return FURT;
    const N = 512, D = new Uint8Array(N * N * 4), R = M.rng(9091), Pn = 48, Lg = new Float32Array(Pn * Pn);
    for (let i = 0; i < Pn * Pn; i++) Lg[i] = R();
    const pn = (u, v) => { const x = u * Pn, y = v * Pn, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), I0 = i % Pn, I1 = (i + 1) % Pn, J0 = j % Pn, J1 = (j + 1) % Pn;
      const a = Lg[J0 * Pn + I0], b = Lg[J0 * Pn + I1], c = Lg[J1 * Pn + I0], d = Lg[J1 * Pn + I1]; return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (j * N + i) * 4, cl = pn(i / N, j / N);
      const r1 = R(); let len = 0.3 + 0.42 * (0.55 * Math.sqrt(r1) + 0.45 * cl); if (R() < 0.1) len = 0.78 + 0.22 * R(); else if (R() < 0.14) len *= 0.45;
      D[k] = 255 * Math.min(1, len); D[k + 1] = 255 * R(); D[k + 2] = 255 * cl; D[k + 3] = 255;
    }
    const t = new T.DataTexture(D, N, N, T.RGBAFormat); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
    return (FURT = t);
  }
  const GLSL_CR = `
varying vec3 vRest; varying vec3 vRestN; varying vec4 vM; varying vec4 vFur; varying vec2 vUv2;
float crH(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)))*43758.5453); }
/* the lie of the hair: fine across it, long along it */
float crStreak(vec3 p, vec3 c){ vec3 cn = normalize(c + vec3(1e-5, 2e-5, 3e-5)); float al = dot(p, cn); return vnz((p - cn*al)*1500.0 + vec3(al*80.0)); }
/* cells, for scales: the distance to the nearest middle, how far the next is beyond it, and which it is */
vec3 crCell(vec3 p){
  vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)), c = i + g, o = vec3(crH(c), crH(c + 17.1), crH(c + 41.3))*0.8 + 0.1, r = g + o - f; float d = dot(r, r);
    if (d < d1){ d2 = d1; d1 = d; id = crH(c + 3.7); } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
/* (the surface's relief h, in metres, turned into a tilt of its normal: dh its change across one pixel each way) */
vec3 crPerturb(vec3 sp, vec3 n, vec2 dh, float fd){
  vec3 sx = dFdx(sp), sy = dFdy(sp); float lx = max(length(sx), 1e-9), ly = max(length(sy), 1e-9);
  sx /= lx; sy /= ly; dh /= vec2(lx, ly);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1)*fd;
  return normalize(abs(det)*n - sign(det)*clamp(dh.x*r1 + dh.y*r2, vec3(-2.0), vec3(2.0)));
}
float crNear(float a, float b){ return smoothstep(a, b, distance(vWPos, cameraPosition)); }
/* feathers lying over a body, in rows: each rounded tip over the bases of the two behind it. q in feathers (x the way
   they lie, toward the tail; y across). → (how far in from the tip's edge of the feather that shows, the shade under
   the tip of the one over it, which feather, how far across it from its middle) */
vec4 crScal(vec2 q){
  float r = floor(q.x), rp = r - 1.0;
  float vp = q.y + 0.5*mod(rp, 2.0) + 0.3*crH(vec3(rp, 0.7, 2.1)), jp = floor(vp), hp = crH(vec3(rp, jp, 1.3)), dp = fract(vp) - 0.5, tp = rp + 1.3 + 0.16*hp - 1.3*dp*dp;
  if (q.x < tp) return vec4(tp - q.x, 0.0, hp, dp);
  float v = q.y + 0.5*mod(r, 2.0) + 0.3*crH(vec3(r, 0.7, 2.1)), j = floor(v), h = crH(vec3(r, j, 1.3)), d = fract(v) - 0.5, t = r + 1.3 + 0.16*h - 1.3*d*d;
  return vec4(t - q.x, 1.0 - smoothstep(0.0, 0.22, q.x - tp), h, d);
}
/* (the three ways the feathers are seen, blended by which way the surface faces at rest: from the side and from above
   they lie back toward the tail, from the front down) */
vec3 crFeath(float fs){
  vec3 w = pow(abs(normalize(vRestN)), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 o = vec3(0.0); vec4 a;
  for (int k = 0; k < 3; k++) {
    float wk = k == 0 ? w.z : k == 1 ? w.y : w.x; if (wk < 0.02) continue;
    vec2 q = k == 0 ? vec2(-vRest.x, vRest.y) : k == 1 ? vec2(-vRest.x, vRest.z) : vec2(-vRest.y, vRest.z);
    a = crScal(q/vec2(fs*0.8, fs) + float(k)*0.37);
    float tone = (0.95 + 0.07*a.z)*(1.0 - 0.13*a.y)*(1.0 - 0.035*(1.0 - smoothstep(0.0, 0.04, abs(a.w)))*smoothstep(0.15, 0.6, a.x));
    float h = fs*(0.04*(1.0 - smoothstep(0.15, 0.55, a.x))*smoothstep(0.0, 0.06, a.x) - 0.03*a.w*a.w);
    o += wk*vec3(tone, h, 0.0);
  }
  return o;
}
/* a flight feather's vane: the shaft along it, the barbs leaning off it toward the tip, here and there parted */
vec3 crVane(){
  float W = vFur.z, dx = (vUv2.x - vFur.x)*W, al = vUv2.y*vFur.y, fw = fwidth(dx) + 1e-6;
  float rw = W*(0.016 - 0.011*vUv2.y), sh = 1.0 - smoothstep(rw - fw, rw + fw, abs(dx));
  float bl = al - abs(dx)*1.7, bs = 0.0011, ab = 1.0 - smoothstep(0.35, 0.9, fwidth(bl)/bs), barb = 0.5 + 0.5*sin(bl/bs*6.2832);
  float pt = vnz(vec3(bl*180.0, sign(dx)*5.0 + vFur.w*13.0, 0.5)), split = smoothstep(0.74, 0.8, pt)*(1.0 - smoothstep(0.3, 0.8, fwidth(bl*180.0)));
  return vec3(sh, mix(0.5, barb, ab), split);
}
uniform sampler2D uFurT; uniform float uFurD;
vec4 crFur(){ vec3 w = pow(abs(normalize(vRestN)), vec3(6.0)); w /= (w.x + w.y + w.z);
  return texture2D(uFurT, vRest.yz*uFurD)*w.x + texture2D(uFurT, vRest.xz*uFurD + 0.37)*w.y + texture2D(uFurT, vRest.xy*uFurD + 0.71)*w.z; }
void crColour(inout vec3 c){
  float pat = vM.z;
  if (pat < 0.5) return;
  float nk = crNear(4.0, 0.3);
  if (pat < 1.5){ vec4 f = crFur(); c *= (0.82 + 0.36*f.g)*(0.9 + 0.2*f.b)*mix(1.0, 0.8 + 0.3*f.r, nk); }
  else if (pat < 2.5){ float fs = vFur.x > 0.0 ? vFur.x : 0.0056; c *= mix(1.0, crFeath(fs).x, crNear(fs*400.0, fs*60.0)); }
  else if (pat < 3.5){ vec3 ce = crCell(vRest/max(vFur.y, 1e-4)); c *= mix(1.0, (0.92 + 0.13*ce.z)*mix(0.74, 1.0, smoothstep(0.02, 0.16, ce.y)), crNear(vFur.y*400.0, vFur.y*60.0)); }
  else if (pat < 4.5){ c *= mix(1.0, 0.86 + 0.24*vnz(vRest*140.0) + 0.08*vnz(vRest*600.0), nk); c = mix(c, c*vec3(1.12, 0.92, 0.9), 0.5*smoothstep(0.55, 0.8, vnz(vRest*55.0 + 3.0))*nk); }
  else if (pat < 5.5) c *= 0.92 + 0.14*vnz(vRest*vec3(60.0, 500.0, 60.0));
  else if (pat < 6.5){
    float r = vUv2.x, az = vUv2.y*6.28318, ir = vFur.y, pa = max(vM.w, 1.0), ca = cos(az), sa = sin(az), pr = vFur.z/sqrt(ca*ca*pa*pa + sa*sa);
    vec3 iris = c*(0.62 + 0.62*vnz(vec3(ca*11.0, sa*11.0, r*20.0)))*mix(1.0, 0.45, smoothstep(ir*0.72, ir, r))*mix(0.7, 1.0, smoothstep(pr, pr + 0.1, r));
    c = r < pr ? vec3(0.006) : r < ir ? iris : vec3(vFur.w)*mix(0.55, 1.0, smoothstep(ir, ir + 0.25, r));
  }
  else if (pat < 7.5) c *= mix(1.0, 0.9 + 0.16*vnz(vRest*300.0), nk);
  else if (pat > 8.5){ vec3 v = crVane(); c *= mix(1.0, (0.97 + 0.05*v.y)*(1.0 - 0.16*v.z), nk); c = mix(c, c*0.84 + vec3(0.006), v.x); }
}
vec3 crNormal(vec3 n, float fd){
  float pat = vM.z, nk = crNear(3.0, 0.25);
  if (pat < 0.5 || pat > 5.5 && pat < 6.5 || nk < 0.01) return n;
  float h = 0.0;
  if (pat < 1.5) h = 0.0004*crFur().r;
  else if (pat < 2.5){ float fs = vFur.x > 0.0 ? vFur.x : 0.0056; h = crFeath(fs).y*crNear(fs*300.0, fs*50.0); }
  else if (pat < 3.5){ vec3 ce = crCell(vRest/max(vFur.y, 1e-4)); h = vFur.y*vFur.z*(smoothstep(0.0, 0.25, ce.y) - 0.3*ce.x); }
  else if (pat < 4.5){ float n = vnz(vRest*420.0 + 5.0), cr = smoothstep(0.42, 0.5, n)*smoothstep(0.58, 0.5, n); h = 0.00016*vnz(vRest*380.0) + 0.0003*vnz(vRest*vec3(80.0, 240.0, 80.0)) - 0.00004*cr*crNear(0.8, 0.15); }
  else if (pat < 5.5) h = 0.0002*vnz(vRest*vec3(60.0, 500.0, 60.0));
  else if (pat > 8.5){ vec3 v = crVane(); h = vFur.z*0.004*v.x + 0.00003*v.y - 0.00004*v.z; }
  else h = 0.0002*vnz(vRest*300.0);
  h *= nk;
  return crPerturb(-vViewPosition, n, vec2(dFdx(h), dFdy(h)), fd);
}
void crExtra(inout ReflectedLight rl, vec3 alb, vec3 n){
  vec3 V = normalize(vViewPosition); float pat = vM.z;
  /* (fur: the light caught along its outline, where the eye looks through the tips of the hairs) */
  if (pat > 0.5 && pat < 1.5) rl.indirectDiffuse += alb*uAmbF*pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0)*0.9;
  /* (thin things — an ear, a wing's membrane — with the sun behind them) */
  if (vM.w > 0.0 && (pat < 5.5 || pat > 6.5)){ vec3 Lv = normalize((viewMatrix*vec4(uKeyDirT, 0.0)).xyz);
    /* (a membrane of skin passes the light warm and red, far more than its dark face reflects) */
    vec3 tr = pat > 7.5 && pat < 8.5 ? mix(alb, vec3(0.42, 0.11, 0.045), 0.85)*0.32 : alb;
    rl.directDiffuse += tr*uKeyColT*max(-dot(n, Lv), 0.0)*vM.w; }
}`;
  const COATS = new Map();
  function coat(dens = 3) {
    if (COATS.has(dens)) return COATS.get(dens);
    const m = Mats.litP({ vertexColors: true, roughness: 0.7, clearcoat: 1, clearcoatRoughness: 0.1 }, 'creature'), prev = m.onBeforeCompile, U = { uFurT: { value: furTex() }, uFurD: { value: dens } };
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aM; attribute vec4 aFur;
varying vec3 vRest; varying vec3 vRestN; varying vec4 vM; varying vec4 vFur; varying vec2 vUv2;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
  vRest = position; vRestN = normal; vM = aM; vFur = aFur; vUv2 = uv;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_pars_fragment>', '#include <clipping_planes_pars_fragment>\n' + GLSL_CR)
        .replace('#include <color_fragment>', '#include <color_fragment>\n  crColour(diffuseColor.rgb);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = vM.x;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = crNormal(normal, faceDirection);')
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  material.clearcoat *= vM.y;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n  crExtra(reflectedLight, diffuseColor.rgb, normal);');
    };
    m.customProgramCacheKey = () => 'art-creature';
    COATS.set(dens, m); return m;
  }
  /* the fur's shells: the body drawn again n times, each further out along its normals (and leaning the way the hair
     lies, and sagging), the strands that reach that far kept, darker toward their roots */
  const FURM = new Map();
  function furMat(f, n) {
    const key = JSON.stringify([f, n]); if (FURM.has(key)) return FURM.get(key);
    const m = Mats.lit({ vertexColors: true, roughness: 0.92 }, 'fur'), prev = m.onBeforeCompile;
    const U = { uFurT: { value: furTex() }, uFurD: { value: f.dens || 3 }, uShellN: { value: n }, uRootK: { value: f.root ?? 0.45 }, uTipK: { value: new T.Vector3(...(f.tip || [1.08, 1.06, 1.04])) },
      uGrav: { value: f.grav ?? 0.25 }, uBand: { value: new T.Vector4(...(f.band || [1, 1, 1, 0])) }, uSparse: { value: f.sparse ?? 0 } };
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r); Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aFur; attribute vec4 aM; attribute float aShellI; uniform float uShellN, uGrav;
varying vec3 vRest; varying vec3 vRestN; varying vec4 vFur; varying float vShell; varying float vSkin;`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRest = position; vRestN = normal; vFur = aFur; vSkin = step(3.5, aM.z)*step(aM.z, 4.5);')
        .replace('#include <skinning_vertex>', `#include <skinning_vertex>
  { float h = (aShellI + 1.0)/uShellN, L = aFur.x; vShell = h;
    vec3 cb = aFur.yzw;
    #ifdef USE_SKINNING
      cb = (skinMatrix*vec4(cb, 0.0)).xyz;
    #endif
    vec3 gd = normalize(vec3(0.0, -1.0, 0.0)*mat3(modelMatrix));
    transformed += normalize(objectNormal)*L*h + cb*L*h*h + gd*L*h*h*uGrav; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>
varying vec3 vRest; varying vec3 vRestN; varying vec4 vFur; varying float vShell; varying float vSkin;
uniform sampler2D uFurT; uniform float uFurD, uRootK, uSparse; uniform vec3 uTipK; uniform vec4 uBand;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  { if (vFur.x < 0.0004) discard;
    vec3 w = pow(abs(normalize(vRestN)), vec3(6.0)); w /= (w.x + w.y + w.z);
    vec4 f = texture2D(uFurT, vRest.yz*uFurD)*w.x + texture2D(uFurT, vRest.xz*uFurD + 0.37)*w.y + texture2D(uFurT, vRest.xy*uFurD + 0.71)*w.z;
    if (f.r < vShell || f.g < uSparse || vSkin > 0.5 && uSparse < 0.01 && (f.g < 0.86 || vShell > 0.25 + 0.75*f.b)) discard;
    diffuseColor.rgb *= mix(uRootK, 1.0, vShell)*(0.8 + 0.4*f.g)*(0.9 + 0.2*f.b);
    diffuseColor.rgb *= mix(vec3(1.0), uBand.rgb, uBand.a*(smoothstep(0.42, 0.56, vShell) - smoothstep(0.66, 0.8, vShell)));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*uTipK, smoothstep(0.6, 1.0, vShell)); }`);
    };
    m.customProgramCacheKey = () => 'art-fur';
    FURM.set(key, m); return m;
  }

  /* ── the body: its parts merged into one skinned mesh (and, if it has fur, its shells, sharing its bones).
     A part: { geo, bind(x, y, z, i) → [[bone, w], …], col, mat, fur, comb, eye } — col a colour or fn(x, y, z, i) (or the
     geometry's own colours), mat [roughness, clearcoat, pattern, thin] or fn, fur a length or fn, comb [x, y, z] or fn,
     eye [0, iris, pupil, white] for an eye's points. o.fur: { shells, dens, root, tip, grav, band } ── */
  function body(S, parts, o = {}) {
    let nv = 0; for (const p of parts) nv += p.geo.attributes.position.count;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), am = new Float32Array(nv * 4), af = new Float32Array(nv * 4);
    const idx = [], fidx = []; let base = 0;
    const val = (f, x, y, z, i, d) => typeof f === 'function' ? f(x, y, z, i) : f ?? d;
    for (const p of parts) {
      const g = p.geo, P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, UV = g.attributes.uv, cnt = P.count;
      for (let i = 0; i < cnt; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), v = base + i, nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
        col.set(C ? [C.getX(i), C.getY(i), C.getZ(i)] : val(p.col, x, y, z, i, [1, 1, 1]), v * 3);
        if (rec.furDebug && !p.eye) { const L = val(p.fur, x, y, z, i, 0); col.set(L > 0 ? [Math.min(1, L / 0.02), 0.2, Math.max(0, 1 - L / 0.01) * 0.6] : [0.9, 0.9, 0.9], v * 3); }
        if (UV) { uv[v * 2] = UV.getX(i); uv[v * 2 + 1] = UV.getY(i); }
        const ws = p.bind(x, y, z, i).filter(q => q[1] > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, 4), s = ws.reduce((t, q) => t + q[1], 0) || 1;
        if (!ws.length) ws.push([S.ix[S.root], 1]);
        ws.forEach((q, k) => { si[v * 4 + k] = q[0]; sw[v * 4 + k] = q[1] / s; });
        am.set(val(p.mat, x, y, z, i, [0.6, 0, 0, 0]), v * 4);
        if (p.eye) af.set(p.eye, v * 4);
        else if (p.raw) af.set(val(p.raw, x, y, z, i, [0, 0, 0, 0]), v * 4);
        else {
          const L = val(p.fur, x, y, z, i, 0), cb = val(p.comb, x, y, z, i, [0, 0, 0]), dn = cb[0] * nx + cb[1] * ny + cb[2] * nz, len = Math.hypot(cb[0], cb[1], cb[2]);
          let tx = cb[0] - dn * nx, ty = cb[1] - dn * ny, tz = cb[2] - dn * nz; const tl = Math.hypot(tx, ty, tz);
          if (tl > 1e-6) { tx *= len / tl; ty *= len / tl; tz *= len / tl; } else tx = ty = tz = 0;
          af[v * 4] = L; af[v * 4 + 1] = tx; af[v * 4 + 2] = ty; af[v * 4 + 3] = tz;
        }
      }
      const I = g.index ? g.index.array : Array.from({ length: cnt }, (_, i) => i);
      for (let t = 0; t < I.length; t += 3) { const a = I[t] + base, b = I[t + 1] + base, c = I[t + 2] + base; idx.push(a, b, c); if (!p.eye && !p.raw && (af[a * 4] > 0 || af[b * 4] > 0 || af[c * 4] > 0)) fidx.push(a, b, c); }
      base += cnt;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); geo.setAttribute('aM', new T.BufferAttribute(am, 4)); geo.setAttribute('aFur', new T.BufferAttribute(af, 4));
    geo.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    const mesh = new T.SkinnedMesh(geo, coat(o.fur ? o.fur.dens || 3 : 3)); mesh.add(S.by[S.root]); mesh.bind(S.skeleton);
    mesh.boundingSphere = geo.boundingSphere.clone(); mesh.boundingSphere.radius *= 1.7; mesh.castShadow = mesh.receiveShadow = true;
    const g = new T.Group(); g.add(mesh);
    let shells = null;
    if (o.fur && fidx.length && !rec.furDebug && !rec.noShells) {
      const n = Math.max(3, Math.round((o.fur.shells || 16) * Q.shells)), sg = new T.InstancedBufferGeometry();
      for (const k of Object.keys(geo.attributes)) sg.setAttribute(k, geo.attributes[k]);
      sg.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(fidx, 1) : new T.Uint16BufferAttribute(fidx, 1));
      sg.setAttribute('aShellI', new T.InstancedBufferAttribute(Float32Array.from({ length: n }, (_, i) => i), 1)); sg.instanceCount = n;
      shells = new T.SkinnedMesh(sg, furMat(o.fur, n)); shells.bind(S.skeleton, mesh.bindMatrix);
      shells.boundingSphere = mesh.boundingSphere; shells.castShadow = false; shells.receiveShadow = true; shells.userData.noShadow = true; shells.userData.shells = n;
      g.add(shells);
    }
    return { g, mesh, shells, geo };
  }

  /* ── parts drawn see-through (an insect's glassy wings): their own skinned mesh on the same bones, each point's
     colour [r, g, b, a] — a how solid (the veins dark and opaque, the panes between them clear) ── */
  function glass(S, parts, B, o = {}) {
    let nv = 0; for (const p of parts) nv += p.geo.attributes.position.count;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 4), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), idx = [];
    let base = 0;
    for (const p of parts) {
      const g = p.geo, P = g.attributes.position, N = g.attributes.normal, cnt = P.count;
      for (let i = 0; i < cnt; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i), v = base + i;
        pos.set([x, y, z], v * 3); nor.set([N.getX(i), N.getY(i), N.getZ(i)], v * 3);
        const c = typeof p.col === 'function' ? p.col(x, y, z, i) : p.col; col.set([c[0], c[1], c[2], c[3] ?? 0.3], v * 4);
        const ws = p.bind(x, y, z, i).filter(q => q[1] > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, 4), t = ws.reduce((a, q) => a + q[1], 0) || 1;
        ws.forEach((q, k) => { si[v * 4 + k] = q[0]; sw[v * 4 + k] = q[1] / t; });
      }
      const I = g.index ? g.index.array : Array.from({ length: cnt }, (_, i) => i); for (let k = 0; k < I.length; k++) idx.push(I[k] + base);
      base += cnt;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 4));
    geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4)); geo.setIndex(idx);
    const mat = Mats.litP({ vertexColors: true, transparent: true, side: T.DoubleSide, depthWrite: false, roughness: o.rough ?? 0.12, clearcoat: 0.7, clearcoatRoughness: 0.04 }, 'creature-glass');
    const mesh = new T.SkinnedMesh(geo, mat); mesh.bind(S.skeleton, B.mesh.bindMatrix);
    mesh.boundingSphere = B.mesh.boundingSphere; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 2;
    B.g.add(mesh); return mesh;
  }

  /* ── posing: a pose is every bone's turn (its quaternion, from the rest pose) and how far the root has moved ── */
  const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3();
  class Pose {
    constructor(S) { this.S = S; this.q = new Float32Array(S.bones.length * 4); this.sc = new Float32Array(S.bones.length); this.off = new T.Vector3(); this.reset(); }
    reset() { const q = this.q; for (let i = 0; i < q.length; i += 4) { q[i] = q[i + 1] = q[i + 2] = 0; q[i + 3] = 1; } this.sc.fill(1); this.off.set(0, 0, 0); return this; }
    /* a bone (and all it carries) grown or shrunk about its joint: a tongue drawn in, a throat's fan furled */
    scale(b, k) { this.sc[this.S.ix[b]] = k; return this; }
    /* set a bone's turn (Euler angles, radians); turn it further about its own axes; or about its parent's, first */
    set(b, x = 0, y = 0, z = 0, o = 'XYZ') { _q.setFromEuler(_e.set(x, y, z, o)).toArray(this.q, this.S.ix[b] * 4); return this; }
    turn(b, x = 0, y = 0, z = 0, o = 'XYZ') { const i = this.S.ix[b] * 4; _q2.fromArray(this.q, i).multiply(_q.setFromEuler(_e.set(x, y, z, o))).toArray(this.q, i); return this; }
    pre(b, x = 0, y = 0, z = 0, o = 'XYZ') { const i = this.S.ix[b] * 4; _q2.setFromEuler(_e.set(x, y, z, o)).multiply(_q.fromArray(this.q, i)).toArray(this.q, i); return this; }
    get(b, out = new T.Quaternion()) { return out.fromArray(this.q, this.S.ix[b] * 4); }
    put(b, q) { q.toArray(this.q, this.S.ix[b] * 4); return this; }
    /* a bone's joint and its turn, in the model's frame */
    world(b, P = new T.Vector3(), Q = new T.Quaternion()) {
      const S = this.S, path = S.path[b]; let prev = path[0];
      P.copy(S.head[prev]).add(this.off); Q.fromArray(this.q, S.ix[prev] * 4);
      for (let i = 1; i < path.length; i++) { const nm = path[i]; _v.copy(S.head[nm]).sub(S.head[prev]).applyQuaternion(Q); P.add(_v); Q.multiply(_q.fromArray(this.q, S.ix[nm] * 4)); prev = nm; }
      return P;
    }
    /* where a point of the rest pose, carried by bone b, now is */
    at(b, rest, out = new T.Vector3()) { const Q = new T.Quaternion(); this.world(b, out, Q); return out.add(new T.Vector3(...(rest.isVector3 ? rest.toArray() : rest)).sub(this.S.head[b]).applyQuaternion(Q)); }
    /* turn bone b so that in the model's frame it is turned by Q */
    aim(b, Q) { const p = this.S.par[b]; if (!p) return this.put(b, Q); const Qp = new T.Quaternion(); this.world(p, new T.Vector3(), Qp); return this.put(b, Qp.invert().multiply(Q)); }
    apply() { const S = this.S; for (let i = 0; i < S.bones.length; i++) { S.bones[i].quaternion.fromArray(this.q, i * 4); S.bones[i].scale.setScalar(this.sc[i]); } S.by[S.root].position.copy(S.head[S.root]).add(this.off); }
    copy(o) { this.q.set(o.q); this.sc.set(o.sc); this.off.copy(o.off); return this; }
    /* toward pose o by k */
    mix(o, k) {
      const a = this.q, b = o.q;
      for (let i = 0; i < a.length; i += 4) {
        const s = a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2] + a[i + 3] * b[i + 3] < 0 ? -1 : 1;
        let x = a[i] + (b[i] * s - a[i]) * k, y = a[i + 1] + (b[i + 1] * s - a[i + 1]) * k, z = a[i + 2] + (b[i + 2] * s - a[i + 2]) * k, w = a[i + 3] + (b[i + 3] * s - a[i + 3]) * k;
        const l = Math.hypot(x, y, z, w) || 1; a[i] = x / l; a[i + 1] = y / l; a[i + 2] = z / l; a[i + 3] = w / l;
      }
      for (let i = 0; i < this.sc.length; i++) this.sc[i] += (o.sc[i] - this.sc[i]) * k;
      this.off.lerp(o.off, k); return this;
    }
  }
  /* the turn that takes direction u0 to u1, and the plane with normal n0 to the one with n1 */
  function frameTo(u0, n0, u1, n1) {
    const x0 = u0.clone().normalize(), z0 = n0.clone().addScaledVector(x0, -n0.dot(x0)).normalize(), y0 = new T.Vector3().crossVectors(z0, x0);
    const x1 = u1.clone().normalize(), z1 = n1.clone().addScaledVector(x1, -n1.dot(x1)).normalize(), y1 = new T.Vector3().crossVectors(z1, x1);
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x1, y1, z1).multiply(new T.Matrix4().makeBasis(x0, y0, z0).transpose()));
  }
  /* a limb of two bones a → b (c at b's far end) bent at b toward pole so that c comes to target, in the model's frame.
     hinge: the rest pose's bend axis, if the limb lies straight in it */
  function ik2(P, a, b, c, target, pole, hinge) {
    const S = P.S, Qp = new T.Quaternion(), pa = P.world(a, new T.Vector3());
    if (S.par[a]) P.world(S.par[a], new T.Vector3(), Qp);
    const ra = S.head[b].clone().sub(S.head[a]), rb = S.head[c].clone().sub(S.head[b]), la = ra.length(), lb = rb.length();
    const d = target.clone().sub(pa), dl = clamp(d.length(), Math.abs(la - lb) + 1e-5, (la + lb) * 0.9995), dir = d.normalize();
    const pv = pole.clone().sub(pa), bend = pv.addScaledVector(dir, -pv.dot(dir)); if (bend.lengthSq() < 1e-12) bend.set(0, 1, 0).addScaledVector(dir, -dir.y); bend.normalize();
    const ca = clamp((la * la + dl * dl - lb * lb) / (2 * la * dl), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const knee = pa.clone().addScaledVector(dir, la * ca).addScaledVector(bend, la * sa), end = pa.clone().addScaledVector(dir, dl);
    let n0 = new T.Vector3().crossVectors(ra, rb); if (n0.lengthSq() < 1e-10 * la * lb) n0 = new T.Vector3(...(hinge || [0, 0, 1])); n0.normalize();
    const u1 = knee.clone().sub(pa), u2 = end.clone().sub(knee), n1 = new T.Vector3().crossVectors(u1, u2).normalize();
    const Ra = frameTo(ra, n0, u1, n1), Rb = frameTo(rb, n0, u2, n1);
    P.put(a, Qp.clone().invert().multiply(Ra)); P.put(b, Ra.clone().invert().multiply(Rb));
    return knee;
  }
  /* a hand or foot set down: bone c turned (in the model's frame) by Q, so that its point `at` (rest pose) comes to
     `to`; the limb a → b → c reaching for it, bent toward pole */
  function reach(P, a, b, c, at, to, Q, pole, hinge) {
    const off = new T.Vector3(...at).sub(P.S.head[c]).applyQuaternion(Q), tg = new T.Vector3(...(to.isVector3 ? to.toArray() : to)).sub(off);
    ik2(P, a, b, c, tg, pole.isVector3 ? pole : new T.Vector3(...pole), hinge); P.aim(c, Q);
  }
  const qE = (x = 0, y = 0, z = 0, o = 'XYZ') => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, o));

  /* ── eyes: a ball at c of radius r looking along ax (normalised), its uv how far round from the middle of its cornea
     (0 there, 1 at its rim) and round it; o: { iris (radius, in that measure), pupil, white (how bright), wide (the
     pupil's width over its height), col, bone }. Its upper lid: a shell over it, open as far as `open` (radians above
     the eye's middle its edge stands), turned on the lid bone to blink ── */
  function eye(S, c, r, ax, o = {}) {
    const g = new T.SphereGeometry(r, 28, 20), A = new T.Vector3(...ax).normalize(), up = new T.Vector3(0, 1, 0);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(up, A)); g.translate(...c);
    const P = g.attributes.position, U = g.attributes.uv, side = new T.Vector3().crossVectors(up, A).normalize(), u2 = new T.Vector3().crossVectors(A, side);
    for (let i = 0; i < P.count; i++) { const n = new T.Vector3(P.getX(i) - c[0], P.getY(i) - c[1], P.getZ(i) - c[2]).normalize();
      U.setXY(i, Math.acos(clamp(n.dot(A), -1, 1)) / (Math.PI / 2), (Math.atan2(n.dot(side), n.dot(u2)) / TAU + 1) % 1); }
    return { geo: g, bind: rigid(S, o.bone || 'head'), col: o.col || [0.3, 0.2, 0.1], mat: [o.rough ?? 0.1, o.coat ?? 0.55, PAT.eye, o.wide || 1], eye: [0, o.iris ?? 0.44, o.pupil ?? 0.15, o.white ?? 0.05] };
  }
  function lid(S, c, r, ax, bone, col, open = 0.35, mat) {
    const A = new T.Vector3(...ax).normalize(), g = new T.SphereGeometry(r, 24, 10, Math.PI * 0.06, Math.PI * 0.88, 0, Math.PI / 2 - open);
    /* (built round +y with its open side toward +z, then turned so its open side faces along the eye) */
    const X = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), A).normalize(), Y = new T.Vector3().crossVectors(A, X);
    g.applyMatrix4(new T.Matrix4().makeBasis(X, Y, A));
    g.translate(...c);
    return { geo: g, bind: rigid(S, bone), col, mat: mat || [0.6, 0.05, PAT.skin, 0] };
  }
  /* a chain of bones turned (in the model's frame) so that each points from its joint toward the next of pts (a
     point for each joint and one for the last bone's tail): directions only, so the bones keep their lengths */
  function chainTo(P, names, pts) {
    const S = P.S;
    names.forEach((n, i) => { const rest = (i < names.length - 1 ? S.head[names[i + 1]] : S.tail[n]).clone().sub(S.head[n]).normalize(), want = new T.Vector3(...pts[i + 1]).sub(new T.Vector3(...pts[i])).normalize();
      P.aim(n, new T.Quaternion().setFromUnitVectors(rest, want)); });
  }
  /* a chain (neck and head, say) bent so that a point carried by its last bone (rest pose) comes to target: each
     bone in turn, from the last, turned toward it (k of the way each time) — cyclic coordinate descent */
  function ccd(P, names, tip, target, { iters = 8, k = 0.6 } = {}) {
    const S = P.S, T3 = new T.Vector3(...(target.isVector3 ? target.toArray() : target));
    for (let it = 0; it < iters; it++) for (let i = names.length - 1; i >= 0; i--) {
      const n = names[i], J = P.world(n), tp = P.at(names[names.length - 1], tip), a = tp.clone().sub(J).normalize(), b = T3.clone().sub(J).normalize();
      if (a.dot(b) > 0.99999) continue;
      const Qw = new T.Quaternion(); P.world(n, new T.Vector3(), Qw);
      const dq = new T.Quaternion().setFromUnitVectors(a, b); dq.slerp(new T.Quaternion(), 1 - k);
      P.aim(n, dq.multiply(Qw));
    }
  }
  /* hairs as fine tubes, each from a root along a way, curving as it goes: roots [{ p, d (its way, scaled to its
     length), bend ([x, y, z] it bows toward by its tip), r }], bind as any part's; col(s, i), m sides round */
  function strands(roots, bind, col, { m = 3, n = 6, mat } = {}) {
    const pos = [], nor = [], idx = [], cols = [], W = [];
    roots.forEach((q, i) => {
      const P0 = new T.Vector3(...q.p), D = new T.Vector3(...q.d), Bd = new T.Vector3(...(q.bend || [0, 0, 0])), L = D.length(), t0 = D.clone().normalize();
      const a = Math.abs(t0.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0), u = new T.Vector3().crossVectors(t0, a).normalize(), v = new T.Vector3().crossVectors(t0, u);
      const base = pos.length / 3;
      for (let k = 0; k <= n; k++) {
        const s = k / n, c = P0.clone().addScaledVector(D, s).addScaledVector(Bd, s * s), rr = (q.r || 0.0004) * (1 - 0.85 * s), cc = col(s, i), w = bind(c.x, c.y, c.z, i);
        for (let j = 0; j < m; j++) { const an = j / m * TAU, e = u.clone().multiplyScalar(Math.cos(an)).addScaledVector(v, Math.sin(an)); pos.push(c.x + e.x * rr, c.y + e.y * rr, c.z + e.z * rr); nor.push(e.x, e.y, e.z); cols.push(...cc); W.push(w); }
      }
      for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) { const a0 = base + k * m + j, a1 = base + k * m + (j + 1) % m, b0 = a0 + m, b1 = a1 + m; idx.push(a0, a1, b0, a1, b1, b0); }
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
    return { geo: g, bind: (x, y, z, i) => W[i], mat: mat || [0.55, 0.2, PAT.horn, 0] };
  }

  /* ── motion helpers ── */
  /* a smooth wandering −1..1 (an idle's head turns, a tail's sway), different for each seed */
  const wave = (t, seed = 0, f = 1) => (Math.sin(t * f * (0.53 + 0.11 * h1(seed)) + seed * 3.1) + 0.6 * Math.sin(t * f * (0.91 + 0.2 * h1(seed + 1)) + seed * 5.3) + 0.35 * Math.sin(t * f * (1.37 + 0.3 * h1(seed + 2)) + seed * 7.7)) / 1.95;
  /* how shut the eyes are: a blink every few seconds, now and then a double one */
  const blink = (t, seed = 0) => {
    if (t < 1.5) return 0;
    const P = 2.6 + 2.2 * h1(seed), k = Math.floor(t / P), ph = t - k * P, at = (0.15 + 0.6 * h1(k * 7 + seed)) * P;
    const one = d => d < 0.06 ? 1 : d < 0.15 ? 1 - (d - 0.06) / 0.09 : 0;
    return Math.max(one(Math.abs(ph - at)), h1(k * 3 + seed) < 0.2 ? one(Math.abs(ph - at - 0.32)) : 0);
  };
  /* one foot's path through a stride: u its phase, beta the part of the stride it is down for → [where it is along the
     stride (+1 front, −1 back), how high it is lifted (0..1), down (1) or not (0)] */
  function stride(u, beta) {
    u = ((u % 1) + 1) % 1;
    if (u < beta) return [1 - 2 * u / beta, 0, 1];
    const s = (u - beta) / (1 - beta), e = s * s * (3 - 2 * s);
    return [-1 + 2 * e, Math.pow(Math.sin(Math.PI * s), 0.8), 0];
  }
  /* something done now and then: which time it is (k) and how far through it (0..1) within each period, or −1 */
  const every = (t, period, len, seed = 0) => { const k = Math.floor(t / period), at = h1(k * 13 + seed) * (period - len), ph = t - k * period - at; return ph >= 0 && ph < len ? ph / len : -1; };

  /* ── the creature: the clips, and a mixer easing between them. userData.rig.play(name, k) starts one (fading from the
     last), .update(dt) moves on, .at(name, t, k) poses it there; userData.anim(t) poses o.clip (or idle) at t ── */
  function creature(g, S, clips, o = {}) {
    const A = new Pose(S), B = new Pose(S), run = (P, c) => { P.reset(); clips[c.name](P, c.t, c.k || {}); };
    const rig = { S, clips, pose: A, cur: null, prev: null, f: 0, F: 0.3 };
    rig.at = (name, t = 0, k = o) => { run(A, { name, t, k }); A.apply(); };
    rig.play = (name, k = {}, fade = 0.35) => { if (!clips[name]) return; if (rig.cur && rig.cur.name === name) { rig.cur.k = k; return; } rig.prev = rig.cur; rig.cur = { name, t: 0, k }; rig.F = fade; rig.f = 0; };
    rig.update = dt => {
      const c = rig.cur; if (!c) return; c.t += dt * (c.k.rate || 1); run(A, c);
      if (rig.prev && rig.f < rig.F) { rig.f += dt; rig.prev.t += dt * (rig.prev.k.rate || 1); run(B, rig.prev); B.mix(A, sst(0, rig.F, rig.f)); B.apply(); }
      else { rig.prev = null; A.apply(); }
    };
    g.userData.rig = rig;
    const def = o.clip || (clips.idle ? 'idle' : Object.keys(clips)[0]);
    g.userData.anim = (t, flying) => rig.at(flying && clips.fly ? 'fly' : def, t, o);
    g.userData.anim(o.t ?? 0);
    return g;
  }

  return { skeleton, sides, rigid, chain, near, blend, tube, sculpt, field, rec, mirror, body, glass, eye, lid, chainTo, ccd, strands, Pose, ik2, reach, qE, frameTo, wave, blink, stride, every, creature, PAT, lin, mix, sst, clamp, h1, furTex, Q };
})();
