/* ─────────────────────────────────────────────────────────────
   cloth.js — a small cloth solver, for paper and for fabric.
   Particles move by Verlet integration (a position and the last
   position, so the velocity is implied) under gravity, a gusty
   wind and the drag of the air, and distance constraints hold
   them together: structural ones along the weave (stretch), shear
   across the diagonals, bending ones two apart. Each kind has its
   own stiffness. The solver takes fixed steps out of a time
   accumulator, so the cloth moves the same at any frame rate, and
   a long frame is cut short rather than taken as one huge step.
   Grids bind to a BufferGeometry: positions and normals are
   written in place, nothing is allocated per frame. (The method
   is the classic one, from Jakobsen's "Advanced Character
   Physics"; written for the cove from scratch.)
   Grid layout: particle (i, j) is column i (0 … nx − 1, along +u)
   of row j (0 … ny − 1, rows running down the cloth); the front
   face is the one seen with rows going down and columns going
   right, like a page.
   ───────────────────────────────────────────────────────────── */
const Cloth = (() => {
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  /* smooth value noise, 0 … 1, and two octaves of it: gusts that build and die away rather than wobble */
  const noise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = hash(i); return a + (hash(i + 1) - a) * u; };
  const gusty = x => noise(x) * 0.65 + noise(x * 2.3 + 17.1) * 0.35;

  /* o = { grids: [{ nx, ny, at(i, j) → [x, y, z], pin(i, j), uv(i, j) → [u, v], stretch, shear, bend, tether }],
           step, iters, maxSteps, damp (per second), air, friction }
     at gives the rest shape (its distances are the ones kept); pinned particles stay where the owner puts them.
     Small steps make a stiffer cloth than many iterations do, for the same work: paper wants both. */
  function create(o) {
    const step = o.step || 1 / 120, iters = o.iters || 6, maxSteps = o.maxSteps || 12;
    let n = 0; const grids = o.grids.map(g => { const r = Object.assign({ o: n }, g); n += g.nx * g.ny; return r; });
    const P = new Float32Array(n * 3), Q = new Float32Array(n * 3), R = new Float32Array(n * 3), N = new Float32Array(n * 3), W = new Float32Array(n);
    /* contacts within a step: how far each particle was pushed out, along which normal, with what friction */
    const D = new Float32Array(n), DN = new Float32Array(n * 3), DF = new Float32Array(n);
    const ci = [], cl = [], ck = [], cs = [], ti = [], tl = [];
    /* per-iteration stiffness, so a constraint ends up as stiff as asked whatever the iteration count */
    const kIt = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 1 / iters);
    const dist = (a, b) => Math.hypot(R[b * 3] - R[a * 3], R[b * 3 + 1] - R[a * 3 + 1], R[b * 3 + 2] - R[a * 3 + 2]);
    for (const g of grids) {
      const { nx, ny } = g, id = (i, j) => g.o + j * nx + i;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = id(i, j), p = g.at(i, j);
        R[k * 3] = p[0]; R[k * 3 + 1] = p[1]; R[k * 3 + 2] = p[2]; W[k] = g.pin && g.pin(i, j) ? 0 : 1;
      }
      /* (constraints between two pinned particles are kept: an owner may let a pin go later) */
      const add = (a, b, k, kind) => { if (k <= 0) return; ci.push(a, b); cl.push(dist(a, b)); ck.push(kIt(k)); cs.push(kind); };
      const st = g.stretch ?? 1, sh = g.shear ?? 0.5, be = g.bend ?? 0.1;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (i + 1 < nx) add(id(i, j), id(i + 1, j), st, 0);
        if (j + 1 < ny) add(id(i, j), id(i, j + 1), st, 0);
        if (i + 1 < nx && j + 1 < ny) { add(id(i, j), id(i + 1, j + 1), sh, 1); add(id(i + 1, j), id(i, j + 1), sh, 1); }
        if (i + 2 < nx) add(id(i, j), id(i + 2, j), be, 2);
        if (j + 2 < ny) add(id(i, j), id(i, j + 2), be, 2);
      }
      /* tethers: a particle may come no further from an anchor up its column than the cloth's length between them,
         which keeps a hanging cloth from stretching under its own weight however few the iterations. The anchors
         are the nearest pinned particle (tether: true) or the rows listed (tether: [0, 1, …]), so a cloth that
         hangs over an edge is held from the row lying on it as well. Only the particle further down moves. */
      if (g.tether) {
        const arc = (i, j0, j1) => { let s = 0; for (let j = Math.min(j0, j1); j < Math.max(j0, j1); j++) s += dist(id(i, j), id(i, j + 1)); return s; };
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
          const k = id(i, j); if (W[k] === 0) continue;
          let rows;
          if (Array.isArray(g.tether)) rows = g.tether.filter(jj => jj < j);
          else { let best = -1; for (let jj = 0; jj < ny; jj++) if (W[id(i, jj)] === 0 && (best < 0 || Math.abs(jj - j) < Math.abs(best - j))) best = jj; rows = best < 0 ? [] : [best]; }
          for (const jj of rows) { ti.push(k, id(i, jj)); tl.push(arc(i, j, jj) * 1.002); }
        }
      }
    }
    const CI = Uint32Array.from(ci), CL = Float32Array.from(cl), CK = Float32Array.from(ck), CS = Uint8Array.from(cs), TI = Uint32Array.from(ti), TL = Float32Array.from(tl);
    const m = CL.length, mt = TL.length;
    P.set(R); Q.set(R);
    const c = { n, P, Q, R, N, W, grids, step, iters, maxSteps, time: 0, acc: 0, damp: o.damp ?? 1, air: o.air ?? 0, friction: o.friction ?? 0.4,
      g: new Float32Array([0, -9.81, 0]), wind: { dir: new Float32Array([1, 0, 0]), speed: 0, gust: 0.6, scale: 0.35, turb: 0.35, along: 0.15 },
      colliders: [], collide: null, onStep: null, geos: [] };

    /* vertex normals of every grid from its neighbours (one-sided at the borders) */
    function normals() {
      for (const g of grids) {
        const { nx, ny, o: base } = g;
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const a = (base + j * nx + Math.max(i - 1, 0)) * 3, b = (base + j * nx + Math.min(i + 1, nx - 1)) * 3;
          const u = (base + Math.max(j - 1, 0) * nx + i) * 3, d = (base + Math.min(j + 1, ny - 1) * nx + i) * 3;
          const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[u], vy = P[d + 1] - P[u + 1], vz = P[d + 2] - P[u + 2];
          let nx_ = vy * uz - vz * uy, ny_ = vz * ux - vx * uz, nz_ = vx * uy - vy * ux;
          const l = Math.hypot(nx_, ny_, nz_) || 1, k = (base + j * nx + i) * 3;
          N[k] = nx_ / l; N[k + 1] = ny_ / l; N[k + 2] = nz_ / l;
        }
      }
    }
    /* the wind at a point: a steady direction, gusts that travel downwind, and a turbulent wander across it */
    const wv = new Float32Array(3);
    function windAt(x, y, z, t) {
      const w = c.wind, d = w.dir, s = w.scale, along = x * d[0] + y * d[1] + z * d[2];
      const k = w.speed * (1 - w.gust + w.gust * 2 * gusty(t * 0.55 - along * s)), q = w.speed * w.turb;
      const side = (noise(t * 1.7 + (x + z) * s * 3 + 31.7) - 0.5) * 2 * q, up = (noise(t * 1.3 + y * s * 3 + 71.3) - 0.5) * 2 * q;
      /* (the cross direction: the wind's own, turned a quarter about the vertical) */
      wv[0] = d[0] * k - d[2] * side; wv[1] = d[1] * k + up; wv[2] = d[2] * k + d[0] * side;
      return wv;
    }
    /* a particle pushed out of something by depth d along the unit normal (nx, ny, nz): noted for friction */
    function contact(i, nx, ny, nz, d, f) { D[i] += d; DN[i * 3] = nx; DN[i * 3 + 1] = ny; DN[i * 3 + 2] = nz; DF[i] = f; }
    /* collisions are solved with the constraints, every iteration */
    function collide() {
      for (const C of c.colliders) {
        const f = C.friction ?? c.friction;
        if (C.type === 'plane') {
          /* keeps n·p ≥ d */
          const nx = C.n[0], ny = C.n[1], nz = C.n[2];
          for (let i = 0; i < n; i++) { if (W[i] === 0) continue; const k = i * 3, s = P[k] * nx + P[k + 1] * ny + P[k + 2] * nz - C.d;
            if (s < 0) { P[k] -= s * nx; P[k + 1] -= s * ny; P[k + 2] -= s * nz; contact(i, nx, ny, nz, -s, f); } }
        } else if (C.type === 'sphere') {
          for (let i = 0; i < n; i++) { if (W[i] === 0) continue; const k = i * 3, dx = P[k] - C.c[0], dy = P[k + 1] - C.c[1], dz = P[k + 2] - C.c[2], d = Math.hypot(dx, dy, dz);
            if (d < C.r && d > 1e-9) { const s = C.r / d; P[k] = C.c[0] + dx * s; P[k + 1] = C.c[1] + dy * s; P[k + 2] = C.c[2] + dz * s; contact(i, dx / d, dy / d, dz / d, C.r - d, f); } }
        } else if (C.type === 'capsule') {
          /* a rod from a to b with radius r (a chair rail, a rope) */
          const ax = C.a[0], ay = C.a[1], az = C.a[2], ex = C.b[0] - ax, ey = C.b[1] - ay, ez = C.b[2] - az, ee = ex * ex + ey * ey + ez * ez || 1;
          for (let i = 0; i < n; i++) { if (W[i] === 0) continue; const k = i * 3;
            const t = Math.min(1, Math.max(0, ((P[k] - ax) * ex + (P[k + 1] - ay) * ey + (P[k + 2] - az) * ez) / ee));
            const dx = P[k] - ax - ex * t, dy = P[k + 1] - ay - ey * t, dz = P[k + 2] - az - ez * t, d = Math.hypot(dx, dy, dz);
            if (d < C.r && d > 1e-9) { const s = (C.r - d) / d; P[k] += dx * s; P[k + 1] += dy * s; P[k + 2] += dz * s; contact(i, dx / d, dy / d, dz / d, C.r - d, f); } }
        }
      }
      if (c.collide) c.collide(P, Q, n, W, contact);
    }
    /* Coulomb friction, once a step: a particle that touched something keeps still along the surface if it was
       pressed hard enough for the way it slid (it sticks), and otherwise loses that much of its slide */
    function rub() {
      for (let i = 0; i < n; i++) {
        const d = D[i]; if (d === 0) continue; D[i] = 0;
        const k = i * 3, nx = DN[k], ny = DN[k + 1], nz = DN[k + 2], vx = P[k] - Q[k], vy = P[k + 1] - Q[k + 1], vz = P[k + 2] - Q[k + 2], vn = vx * nx + vy * ny + vz * nz;
        const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz, tl = Math.hypot(tx, ty, tz), lim = DF[i] * d;
        if (tl < 1e-12) continue;
        const s = tl <= lim ? 1 : lim / tl;
        P[k] -= tx * s; P[k + 1] -= ty * s; P[k + 2] -= tz * s;
      }
    }
    function substep() {
      const h = step, h2 = h * h, keep = Math.exp(-c.damp * h), air = c.air, gx = c.g[0], gy = c.g[1], gz = c.g[2], t = c.time, w = c.wind;
      if (c.onStep) c.onStep(h, t);
      if (air > 0) normals();
      for (let i = 0; i < n; i++) {
        if (W[i] === 0) continue;
        const k = i * 3, x = P[k], y = P[k + 1], z = P[k + 2];
        let ax = gx, ay = gy, az = gz;
        if (air > 0) {
          /* the air pushes on the cloth across its face: by the wind relative to the cloth, along the normal (so it
             also brakes any flapping), and a little along its face, which streams a flag out downwind */
          const u = w.speed > 0 ? windAt(x, y, z, t) : (wv.fill(0), wv);
          const rx = u[0] - (x - Q[k]) / h, ry = u[1] - (y - Q[k + 1]) / h, rz = u[2] - (z - Q[k + 2]) / h;
          const nx = N[k], ny = N[k + 1], nz = N[k + 2], rn = rx * nx + ry * ny + rz * nz, a = air * w.along;
          ax += air * rn * nx + a * (rx - rn * nx); ay += air * rn * ny + a * (ry - rn * ny); az += air * rn * nz + a * (rz - rn * nz);
        }
        P[k] = x + (x - Q[k]) * keep + ax * h2; P[k + 1] = y + (y - Q[k + 1]) * keep + ay * h2; P[k + 2] = z + (z - Q[k + 2]) * keep + az * h2;
        Q[k] = x; Q[k + 1] = y; Q[k + 2] = z;
      }
      for (let it = 0; it < iters; it++) {
        /* alternate the sweep direction, so no corner of the cloth is always solved last */
        const fwd = (it & 1) === 0;
        for (let s = 0; s < m; s++) {
          const e = fwd ? s : m - 1 - s, a = CI[e * 2], b = CI[e * 2 + 1], wa = W[a], wb = W[b], ws = wa + wb;
          if (ws === 0) continue;
          const ka = a * 3, kb = b * 3, dx = P[kb] - P[ka], dy = P[kb + 1] - P[ka + 1], dz = P[kb + 2] - P[ka + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < 1e-9) continue;
          const f = CK[e] * (d - CL[e]) / (d * ws);
          P[ka] += dx * f * wa; P[ka + 1] += dy * f * wa; P[ka + 2] += dz * f * wa;
          P[kb] -= dx * f * wb; P[kb + 1] -= dy * f * wb; P[kb + 2] -= dz * f * wb;
        }
        for (let s = 0; s < mt; s++) {
          /* toward a pinned anchor only the far particle moves; a free anchor takes its share, so the weight of
             what hangs below still pulls on it */
          const a = TI[s * 2], b = TI[s * 2 + 1], wa = W[a], wb = W[b]; if (wa === 0) continue;
          const ka = a * 3, kb = b * 3, dx = P[ka] - P[kb], dy = P[ka + 1] - P[kb + 1], dz = P[ka + 2] - P[kb + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d <= TL[s]) continue;
          const f = (d - TL[s]) / (d * (wa + wb));
          P[ka] -= dx * f * wa; P[ka + 1] -= dy * f * wa; P[ka + 2] -= dz * f * wa;
          P[kb] += dx * f * wb; P[kb + 1] += dy * f * wb; P[kb + 2] += dz * f * wb;
        }
        collide();
      }
      rub();
      c.time += h;
    }
    /* advance by a frame of dt seconds: whole steps out of the accumulator, at most maxSteps of them */
    function update(dt) {
      c.acc += Math.max(0, dt || 0);
      let k = 0;
      while (c.acc >= step && k < c.maxSteps) { substep(); c.acc -= step; k++; }
      if (k >= c.maxSteps) c.acc = Math.min(c.acc, step);      /* a frame too long to catch up: drop the rest of it */
      return k;
    }
    /* put every particle back at rest (or at the given positions), still */
    function reset(src) { P.set(src || R); Q.set(P); c.acc = 0; }
    /* a pinned particle moved by its owner: its last position goes along, so it carries no false speed */
    function pin(i, x, y, z) { const k = i * 3; Q[k] = P[k]; Q[k + 1] = P[k + 1]; Q[k + 2] = P[k + 2]; P[k] = x; P[k + 1] = y; P[k + 2] = z; }
    /* the worst stretch or squash of any structural constraint, relative to its rest length (for the tests) */
    function strain(where) { let e = 0; for (let s = 0; s < m; s++) { if (CS[s] !== 0 || CL[s] < 1e-6) continue; const ka = CI[s * 2] * 3, kb = CI[s * 2 + 1] * 3, v = Math.abs(Math.hypot(P[kb] - P[ka], P[kb + 1] - P[ka + 1], P[kb + 2] - P[ka + 2]) / CL[s] - 1); if (v > e) { e = v; if (where) { where[0] = CI[s * 2]; where[1] = CI[s * 2 + 1]; } } } return e; }
    /* a BufferGeometry for grid gi, kept up to date by write(): positions and normals change, uvs and triangles do not */
    function geometry(gi = 0) {
      const g = grids[gi], cnt = g.nx * g.ny, pos = new THREE.BufferAttribute(new Float32Array(cnt * 3), 3), nor = new THREE.BufferAttribute(new Float32Array(cnt * 3), 3);
      pos.setUsage(THREE.DynamicDrawUsage); nor.setUsage(THREE.DynamicDrawUsage);
      const uv = new Float32Array(cnt * 2), idx = [];
      for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) { const t = g.uv ? g.uv(i, j) : [i / (g.nx - 1), 1 - j / (g.ny - 1)]; uv[(j * g.nx + i) * 2] = t[0]; uv[(j * g.nx + i) * 2 + 1] = t[1]; }
      for (let j = 0; j + 1 < g.ny; j++) for (let i = 0; i + 1 < g.nx; i++) { const a = j * g.nx + i, b = a + 1, cc = a + g.nx, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', pos); geo.setAttribute('normal', nor); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
      const a = g.o * 3, b = a + cnt * 3;
      c.geos.push({ pos, nor, pv: P.subarray(a, b), nv: N.subarray(a, b) }); write();
      return geo;
    }
    function write() {
      normals();
      for (const e of c.geos) { e.pos.array.set(e.pv); e.nor.array.set(e.nv); e.pos.needsUpdate = true; e.nor.needsUpdate = true; }
    }
    return Object.assign(c, { update, substep, reset, pin, normals, write, geometry, strain, windAt });
  }
  return { create, noise, gusty };
})();
