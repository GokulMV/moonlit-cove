/* ref/human — a plain mannequin 1.75 m tall, for judging the size of things in the studio (tools/studio.mjs) and in
   test shots: head, neck, a torso narrowing to the waist, hips, arms hanging a little out from the sides, legs, feet.
   Standing at the origin, facing +x. o.pose 'walk' puts one leg forward and swings the arms; o.h another height. */
(() => {
  const T = THREE;
  Models.add('ref/human', (o = {}) => {
    const g = new T.Group(), k = (o.h || 1.75) / 1.75, walk = o.pose === 'walk';
    const mat = Models.lit(o.color || '#c9c4bc', { roughness: 0.62 });
    const seg = (a, b, r0, r1, n = 14) => {
      /* a limb from a to b, its ends rounded */
      const A = new T.Vector3(...a).multiplyScalar(k), B = new T.Vector3(...b).multiplyScalar(k), d = B.clone().sub(A), L = d.length();
      const geo = new T.CapsuleGeometry((r0 + r1) / 2 * k, Math.max(0.001, L - (r0 + r1) * k * 0.5), 6, n);
      /* (tapered: the capsule's top end narrowed toward r1) */
      const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i) / Math.max(1e-6, L / 2 + r0 * k), s = (r0 + (r1 - r0) * (y * 0.5 + 0.5)) / ((r0 + r1) / 2); P.setX(i, P.getX(i) * s); P.setZ(i, P.getZ(i) * s); }
      geo.computeVertexNormals();
      const m = Models.mesh(geo, mat); m.position.copy(A).add(B).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); g.add(m); return m;
    };
    const ball = (p, sx, sy, sz) => { const m = Models.mesh(new T.SphereGeometry(1, 24, 16), mat); m.position.set(...p).multiplyScalar(k); m.scale.set(sx * k, sy * k, sz * k); g.add(m); return m; };
    /* head and neck */
    ball([0.01, 1.635, 0], 0.1, 0.122, 0.085);
    seg([0, 1.46, 0], [0.005, 1.56, 0], 0.052, 0.046);
    /* the torso: chest, waist, hips (lofted through three ellipses) */
    { const secs = [[1.0, 0.115, 0.165, 0.0], [1.08, 0.12, 0.17, 0.0], [1.2, 0.1, 0.145, 0.0], [1.34, 0.115, 0.17, 0.005], [1.43, 0.1, 0.19, 0.0], [1.49, 0.06, 0.1, 0.0]];
      const N = 24, M = 20, pos = [], idx = [];
      const f = Models.spline(secs.map(s => [s[0], s[1], s[2], s[3]]));
      for (let i = 0; i <= N; i++) { const y = 1.0 + 0.49 * i / N, [dx, dz, cx] = f(y); for (let j = 0; j <= M; j++) { const a = j / M * Math.PI * 2; pos.push((cx + Math.cos(a) * dx) * k, y * k, Math.sin(a) * dz * k); } }
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      g.add(Models.mesh(geo, mat)); ball([0, 1.0, 0], 0.112, 0.07, 0.16); ball([0, 1.49, 0], 0.06, 0.03, 0.1); }
    /* arms: shoulder, elbow, wrist, a hand */
    for (const s of [-1, 1]) {
      const sw = walk ? s * 0.2 : 0, sh = [0, 1.43, s * 0.195], el = [0.0 + sw * 0.6, 1.15, s * 0.235], wr = [0.06 + sw, 0.9, s * 0.245];
      ball(sh, 0.058, 0.058, 0.058); seg(sh, el, 0.046, 0.038); seg(el, wr, 0.037, 0.028);
      const h = ball([wr[0] + 0.012, wr[1] - 0.07, wr[2]], 0.026, 0.07, 0.042); h.rotation.z = -sw * 0.4;
    }
    /* legs: hip, knee, ankle, a foot */
    for (const s of [-1, 1]) {
      const st = walk ? -s * 0.17 : 0, hp = [0, 0.98, s * 0.095], kn = [0.02 + st * 0.5, 0.52, s * 0.1], an = [st * 0.95, 0.075, s * 0.105];
      seg(hp, kn, 0.072, 0.052); seg(kn, an, 0.05, 0.035); ball(kn, 0.052, 0.052, 0.052);
      const ft = ball([an[0] + 0.07, 0.035, an[2]], 0.13, 0.04, 0.05); ft.rotation.z = walk ? -st * 0.3 : 0;
    }
    g.userData.height = 1.75 * k;
    return g;
  });
})();
