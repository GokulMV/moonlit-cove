/* ─────────────────────────────────────────────────────────────
   models/ — every object in the cove that is more than a box has a
   file of its own, grouped by where it lives:
     camp/    the guitar, the firewood and the fire's logs, the crate
              and the radio on it, the camp chairs …
   A model file registers a builder with Models.add(name, build);
   build(options) returns a fresh THREE.Object3D each time, built
   at the origin in metres (each file says which way it faces).
   camp.js and the rest ask for one with Models.make(name, options).
   To make a model better, open its file: nothing else needs to change.
   ───────────────────────────────────────────────────────────── */
const Models = (() => {
  const T = THREE, defs = new Map();
  function add(name, build) { defs.set(name, build); }
  function make(name, o = {}) { const b = defs.get(name); if (!b) throw new Error('Models: no model called ' + name); return b(o); }
  const has = name => defs.has(name), list = () => [...defs.keys()].sort();

  /* small shared helpers for the model files */
  const C = c => new T.Color(c);
  const mesh = (geo, mat, cast = true, receive = true) => { const m = new T.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  /* a seeded random stream, so a model comes out the same every time */
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  /* a cheap smooth 1D noise for wobbling outlines */
  function wob(seed) { const r = rng(seed), k = Array.from({ length: 6 }, () => [1 + r() * 5, r() * 6.28, r()]); return x => k.reduce((s, [f, p, a]) => s + Math.sin(x * f + p) * a, 0) / 3; }
  /* a geometry that is the union of several: merged into one, keeping material groups per part */
  function merge(parts) {
    const pos = [], nor = [], uv = [], idx = [], groups = []; let vo = 0;
    for (const { geo, mat = 0, m } of parts) {
      const g = geo.index ? geo : geo.toNonIndexed(), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      const mtx = m || new T.Matrix4(), nm = new T.Matrix3().getNormalMatrix(mtx), v = new T.Vector3();
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(mtx); pos.push(v.x, v.y, v.z);
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0);
        if (U) uv.push(U.getX(i), U.getY(i)); else uv.push(0, 0);
      }
      const I = g.index ? Array.from(g.index.array) : Array.from({ length: P.count }, (_, i) => i);
      groups.push({ start: idx.length, count: I.length, mat });
      for (const i of I) idx.push(i + vo);
      vo += P.count;
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    out.setIndex(idx); groups.forEach(g => out.addGroup(g.start, g.count, g.mat));
    return out;
  }
  /* a rounded rectangle (corner radii [bottom-left, bottom-right, top-right, top-left]) and a bevelled extrusion of a shape,
     centred on z */
  function rshape(x0, y0, x1, y1, r) {
    const s = new T.Shape();
    s.moveTo(x0 + r[0], y0); s.lineTo(x1 - r[1], y0); if (r[1]) s.quadraticCurveTo(x1, y0, x1, y0 + r[1]);
    s.lineTo(x1, y1 - r[2]); if (r[2]) s.quadraticCurveTo(x1, y1, x1 - r[2], y1);
    s.lineTo(x0 + r[3], y1); if (r[3]) s.quadraticCurveTo(x0, y1, x0, y1 - r[3]);
    s.lineTo(x0, y0 + r[0]); if (r[0]) s.quadraticCurveTo(x0, y0, x0 + r[0], y0);
    return s;
  }
  function extrude(shape, depth, bevel = 0.05) {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
  }
  const lit = (hex, p = {}, key) => Mats.lit(Object.assign({ color: C(hex) }, p), key);
  const litP = (hex, p = {}, key) => Mats.litP(Object.assign({ color: C(hex) }, p), key);
  /* a tube along a curve whose radius follows r(t), t 0 to 1 along it; sx, sy squash its section (a strap, say) */
  function tube(curve, segs, radial, r, { sx = 1, sy = 1, caps = false } = {}) {
    const fr = curve.computeFrenetFrames(segs, false), pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) { const t = i / segs, p = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], rr = r(t);
      for (let k = 0; k <= radial; k++) { const a = k / radial * Math.PI * 2, c = Math.cos(a) * rr * sx, s = Math.sin(a) * rr * sy;
        pos.push(p.x + N.x * c + B.x * s, p.y + N.y * c + B.y * s, p.z + N.z * c + B.z * s); uv.push(k / radial, t); } }
    /* (faces wound to look outward, as the caps' do) */
    for (let i = 0; i < segs; i++) for (let k = 0; k < radial; k++) { const a = i * (radial + 1) + k, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    if (caps) for (const e of [0, segs]) { const c = curve.getPointAt(e / segs), m = pos.length / 3; pos.push(c.x, c.y, c.z); uv.push(0.5, 0.5);
      for (let k = 0; k < radial; k++) { const a = e * (radial + 1) + k; e ? idx.push(m, a, a + 1) : idx.push(m, a + 1, a); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  /* ── for living things (models/life/): smooth bodies lofted through sections, thin sheets for fins, wings and petals,
     painted in vertex colours ── */
  const crm = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3); };
  /* a smooth curve through rows [x, a, b, …] (x rising): f(x) → [a, b, …], Catmull-Rom between the rows */
  function spline(rows) {
    const n = rows.length, k = rows[0].length - 1;
    return x => {
      let i = 0; while (i < n - 2 && x > rows[i + 1][0]) i++;
      const x0 = rows[i][0], x1 = rows[i + 1][0], t = Math.max(0, Math.min(1, (x - x0) / ((x1 - x0) || 1)));
      const A = rows[Math.max(0, i - 1)], B = rows[i], Cc = rows[i + 1], D = rows[Math.min(n - 1, i + 2)], out = [];
      for (let j = 1; j <= k; j++) out.push(crm(A[j] ?? B[j], B[j], Cc[j], D[j] ?? Cc[j], t));
      return out;
    };
  }
  /* smooth normals for an indexed mesh, area-weighted */
  function normalsOf(pos, idx) {
    const N = new Float32Array(pos.length);
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, c]) { N[o] += nx; N[o + 1] += ny; N[o + 2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
    return N;
  }
  /* a body lofted along x through sections [x, half-width (z), half-height (y), centre height, squareness (2: an
     ellipse; more, boxier; less, diamond)], n rings by m round, closed at both ends. Round it, a is 0 along the top
     and π/2 on the +z side. paint(x, y, z, u, a) → [r, g, b] (u 0..1 along); shape(x, y, z, u, a) may move a point
     before it is painted. uv is (u, a/2π), seamed along the belly; the normals are smooth across the seam */
  function loft(secs, n, m, paint, { shape } = {}) {
    const f = spline(secs), x0 = secs[0][0], x1 = secs[secs.length - 1][0];
    const wp = [], wu = [], wa = [];          /* the welded mesh: a pole, rings 1..n-1, a pole */
    const put = (x, y, z, u, a) => { if (shape) { const q = shape(x, y, z, u, a); if (q) [x, y, z] = q; } wp.push(x, y, z); wu.push(u); wa.push(a); };
    const sec = u => { const x = x0 + (x1 - x0) * u, [w, h, cy, sq = 2] = f(x); return [x, Math.max(0, w), Math.max(0, h), cy, sq]; };
    { const [x, , , cy] = sec(0); put(x, cy, 0, 0, Math.PI); }
    for (let i = 1; i < n; i++) {
      const u = i / n, [x, w, h, cy, sq] = sec(u), e = 2 / sq;
      for (let j = 0; j < m; j++) {
        const a = Math.PI + (j / m) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        put(x, cy + h * Math.sign(ca) * Math.pow(Math.abs(ca), e), w * Math.sign(sa) * Math.pow(Math.abs(sa), e), u, ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      }
    }
    { const [x, , , cy] = sec(1); put(x, cy, 0, 1, Math.PI); }
    const last = wp.length / 3 - 1, ring = i => 1 + (i - 1) * m, widx = [];
    for (let j = 0; j < m; j++) widx.push(0, ring(1) + (j + 1) % m, ring(1) + j);
    for (let i = 1; i < n - 1; i++) for (let j = 0; j < m; j++) { const a = ring(i) + j, b = ring(i) + (j + 1) % m, c = ring(i + 1) + j, d = ring(i + 1) + (j + 1) % m; widx.push(a, b, c, b, d, c); }
    for (let j = 0; j < m; j++) widx.push(last, ring(n - 1) + j, ring(n - 1) + (j + 1) % m);
    const wn = normalsOf(wp, widx);
    /* unwelded along the seam (j = 0 again at j = m), so the texture can wrap round */
    const pos = [], nor = [], uv = [], col = [], idx = [], src = [];
    const out = (k, v) => { src.push(k); pos.push(wp[k * 3], wp[k * 3 + 1], wp[k * 3 + 2]); nor.push(wn[k * 3], wn[k * 3 + 1], wn[k * 3 + 2]); uv.push(wu[k], v); };
    out(0, 0.5);
    for (let i = 1; i < n; i++) for (let j = 0; j <= m; j++) out(ring(i) + (j % m), j / m);
    out(last, 0.5);
    const r2 = i => 1 + (i - 1) * (m + 1), L = pos.length / 3 - 1;
    for (let j = 0; j < m; j++) idx.push(0, r2(1) + j + 1, r2(1) + j);
    for (let i = 1; i < n - 1; i++) for (let j = 0; j < m; j++) { const a = r2(i) + j, b = a + 1, c = r2(i + 1) + j, d = c + 1; idx.push(a, b, c, b, d, c); }
    for (let j = 0; j < m; j++) idx.push(L, r2(n - 1) + j, r2(n - 1) + j + 1);
    if (paint) for (let k = 0; k < src.length; k++) { const s = src[k]; col.push(...paint(wp[s * 3], wp[s * 3 + 1], wp[s * 3 + 2], wu[s], wa[s])); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (paint) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeBoundingSphere(); return g;
  }
  /* a thin surface over (s, c), each 0..1: at(s, c) → [x, y, z]; paint(s, c, p) → colour; uv is (c, s) */
  function sheet(ns, nc, at, paint) {
    const pos = [], col = [], uv = [], idx = [];
    for (let i = 0; i <= ns; i++) for (let j = 0; j <= nc; j++) { const s = i / ns, c = j / nc, p = at(s, c); pos.push(p[0], p[1], p[2]); uv.push(c, s); if (paint) col.push(...paint(s, c, p)); }
    for (let i = 0; i < ns; i++) for (let j = 0; j < nc; j++) { const a = i * (nc + 1) + j, b = a + 1, c = a + nc + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(normalsOf(pos, idx), 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (paint) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeBoundingSphere(); return g;
  }
  /* a geometry painted all over: fn(x, y, z, nx, ny, nz) → [r, g, b] as its vertex colours */
  function paint(g, fn) {
    const P = g.attributes.position, N = g.attributes.normal, c = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) c.set(fn(P.getX(i), P.getY(i), P.getZ(i), N ? N.getX(i) : 0, N ? N.getY(i) : 1, N ? N.getZ(i) : 0), i * 3);
    g.setAttribute('color', new T.BufferAttribute(c, 3)); return g;
  }
  /* geometries with vertex colours merged into one (each placed by its matrix, if it has one; a plain colour if it
     has none of its own) */
  function mergeC(parts) {
    let n = 0, ni = 0; for (const { geo } of parts) { n += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; }
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3), U = new Float32Array(n * 2), I = new Uint32Array(ni);
    let o = 0, oi = 0; const v = new T.Vector3(), nm = new T.Matrix3();
    for (const { geo, m, c = [1, 1, 1] } of parts) {
      const pa = geo.attributes.position, na = geo.attributes.normal, ca = geo.attributes.color, ua = geo.attributes.uv, M4 = m || new T.Matrix4(); nm.getNormalMatrix(M4);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(M4); P[(o + i) * 3] = v.x; P[(o + i) * 3 + 1] = v.y; P[(o + i) * 3 + 2] = v.z;
        if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(o + i) * 3] = v.x; N[(o + i) * 3 + 1] = v.y; N[(o + i) * 3 + 2] = v.z; }
        if (ca) { Cc[(o + i) * 3] = ca.getX(i) * c[0]; Cc[(o + i) * 3 + 1] = ca.getY(i) * c[1]; Cc[(o + i) * 3 + 2] = ca.getZ(i) * c[2]; } else Cc.set(c, (o + i) * 3);
        if (ua) { U[(o + i) * 2] = ua.getX(i); U[(o + i) * 2 + 1] = ua.getY(i); }
      }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) I[oi + i] = geo.index.getX(i) + o; else for (let i = 0; i < pa.count; i++) I[oi + i] = o + i;
      o += pa.count; oi += geo.index ? geo.index.count : pa.count;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('color', new T.BufferAttribute(Cc, 3)); g.setAttribute('uv', new T.BufferAttribute(U, 2));
    g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
  }
  /* a matrix from a position, Euler angles (YXZ) and a scale */
  const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new T.Vector3(sx, sy, sz));
  /* a bending limb: a chain of joints (Object3D), each a segment along +x from the last; segs [length, r0, r1, geoFn?];
     returns the joints, so they can be turned at their roots */
  function limb(parent, segs, mat, radial = 8) {
    const joints = []; let at = parent;
    for (const [len, r0, r1] of segs) {
      const j = new T.Object3D(); at.add(j); if (joints.length) j.position.x = segs[joints.length - 1][0];
      const g = new T.CylinderGeometry(r1, r0, len, radial, 2); g.rotateZ(-Math.PI / 2); g.translate(len / 2, 0, 0);
      const s = new T.SphereGeometry(Math.max(r0, r1) * 1.02, radial, Math.max(4, radial >> 1));
      const mm = new T.Mesh(g, mat), kn = new T.Mesh(s, mat); j.add(mm, kn); joints.push(j); at = j;
    }
    return joints;
  }
  /* a smooth 3D value noise (0..1) and a few octaves of it, for painting and roughening */
  const h3 = (x, y, z) => { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x1b873593); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  function vn(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), fx), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), fx), fy),
             L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), fx), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), fx), fy), fz);
  }
  const fbm = (x, y, z, o = 3) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f + i * 17.3, y * f - i * 9.1, z * f + i * 5.7); n += a; a *= 0.5; f *= 2.03; } return s / n; };
  return { add, make, has, list, C, mesh, at, canvas, rng, wob, merge, rshape, extrude, lit, litP, tube, spline, loft, sheet, paint, mergeC, normalsOf, M4, limb, vn, fbm };
})();
