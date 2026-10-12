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
  return { add, make, has, list, C, mesh, at, canvas, rng, wob, merge, rshape, extrude, lit };
})();
