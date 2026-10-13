/* a fruit bat's small cousin, a free-tailed bat, held with its wings half spread: a furred brown body, big rounded
   ears, a dark snout and bright black eyes; the wings thin dark skin stretched over the long finger bones, billowing a
   little between them, the trailing edge scalloped from one finger's tip to the next; a thumb with its claw at each
   wrist; its legs out behind, the skin between them stopping short of the tail, which runs on free.
   At the origin in metres, its head toward +x, its back +y; about 33 cm across the wings. userData.anim(t): the wings
   open and close a little, the ears twitch */
(() => {
  const T = THREE, M = Models;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const L2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  M.add('life/bat', () => {
    const g = new T.Group(), fur = lin('#5a4130'), furD = lin('#3a2a20'), skin = lin('#2a201c');
    const furM = M.lit('#ffffff', { vertexColors: true, roughness: 0.95 });
    /* (furred: the coat's tufts break its outline, a little paler and greyer beneath) */
    const tuft = (x, y, z) => 0.0009 * (M.vn(x * 900, y * 900, z * 900) - 0.35) + 0.0005 * M.vn(x * 2600, y * 2600, z * 2600);
    const body = M.loft([[-0.04, 0, 0, 0, 2], [-0.032, 0.012, 0.01, 0, 2], [-0.012, 0.019, 0.017, 0, 2], [0.008, 0.017, 0.016, 0.001, 2], [0.022, 0.012, 0.011, 0.002, 2], [0.03, 0, 0, 0.003, 2]], 60, 56,
      (x, y, z) => mix(mix(fur, furD, 0.35 + 0.5 * M.vn(x * 700, y * 700, z * 700)), lin('#7a6656'), y < -0.004 ? 0.45 : 0),
      { shape: (x, y, z) => { const r = Math.hypot(y, z) || 1, k = tuft(x, y, z); return [x, y + y / r * k, z + z / r * k]; } });
    g.add(new T.Mesh(body, furM));
    const head = new T.Object3D(); head.position.set(0.034, 0.004, 0); g.add(head);
    head.add(new T.Mesh(M.loft([[-0.012, 0, 0, 0, 2], [-0.006, 0.011, 0.01, 0, 2], [0.006, 0.01, 0.009, 0.0, 2], [0.016, 0.005, 0.005, -0.002, 2], [0.02, 0, 0, -0.002, 2]], 20, 24,
      (x) => x > 0.012 ? skin : fur), furM));
    const eyeM = M.litP('#050505', { roughness: 0.05, clearcoat: 1 });
    const earM = M.lit('#ffffff', { vertexColors: true, roughness: 0.7, side: T.DoubleSide });
    for (const sd of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.0022, 12, 10), eyeM); e.position.set(0.008, 0.004, sd * 0.0075); head.add(e);
      /* the ears: big, rounded, thin, cupped, ribbed inside */
      const ear = M.sheet(10, 8, (s, c) => { const w = 0.012 * Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.9)) ** 0.6, cc = c - 0.5; return [cc * w, s * 0.02, -0.006 * cc * cc * 4 * Math.min(1, s * 2)]; },
        (s, c) => mix(skin, lin('#6a4a40'), 0.5 * (1 - Math.abs(c - 0.5) * 2) * (0.5 + 0.5 * Math.sin(s * 30))));
      const em = new T.Mesh(ear, earM); em.position.set(-0.002, 0.008, sd * 0.006); em.rotation.set(sd * 0.5, sd * 0.4, -0.2); head.add(em);
    }
    /* the wing, laid out flat as (forward x, out z) on the +z side: the shoulder and hip against the body, the arm out to
       the wrist, the four long fingers from there, the leg back to the ankle */
    const Sh = [0.012, 0.0], El = [-0.002, 0.03], Wr = [0.034, 0.052], Hp = [-0.03, 0.0], An = [-0.05, 0.026];
    const tips = [[0.066, 0.118], [0.034, 0.168], [-0.006, 0.128], [-0.024, 0.082]];   /* the second finger to the fifth */
    /* (skin, matt: a little sheen, no gloss) */
    const memM = M.litP('#ffffff', { vertexColors: true, roughness: 0.78, clearcoat: 0, specularIntensity: 0.25, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new T.Color('#6a3a28'), side: T.DoubleSide });
    const boneM = M.lit('#2a1f1a', { roughness: 0.55 });
    const wings = [];
    for (const sd of [1, -1]) {
      const sh = new T.Object3D(); sh.position.set(0, 0.012, sd * 0.012); g.add(sh);
      const pos = [], col = [], idx = [];
      /* (a patch of skin: P(u, v) → [x, lift, z] over nu × nv cells) */
      const patch = (nu, nv, P) => {
        const v0 = pos.length / 3;
        for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
          const [x, y, z, k = 0] = P(i / nu, j / nv); pos.push(x, y, z * sd);
          const c = mix(lin('#2c1f1a'), lin('#4a3026'), k); col.push(...c);
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = v0 + i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      };
      /* between the fingers, fanned from the wrist: each trailing edge drawn in toward the wrist between two tips; the
         skin lifts a little between the bones (the wing's camber) */
      for (let k = 0; k < 3; k++) {
        const p = tips[k], q = tips[k + 1], len = Math.hypot(q[0] - p[0], q[1] - p[1]), pull = k === 0 ? 0.05 : 0.2;
        patch(7, 6, (u, v) => { const e = L2(L2(p, q, v), Wr, pull * Math.sin(Math.PI * v)), pt = L2(Wr, e, u), b = Math.sin(Math.PI * v);
          return [pt[0], 0.12 * len * u * b, pt[1], 0.6 * b * u]; });
      }
      /* the arm wing: from the body's side, shoulder to hip and on down the leg to the ankle, out to the arm in front
         and the fifth finger; its trailing edge from the ankle to that finger's tip, drawn in (a Coons patch on its
         four edges) */
      {
        const front = u => L2(Sh, Wr, u), edge1 = v => L2(Wr, tips[3], v);
        const edge0 = v => v < 0.6 ? L2(Sh, Hp, v / 0.6) : L2(Hp, An, (v - 0.6) / 0.4);
        const back = u => L2(L2(An, tips[3], u), front(u), 0.2 * Math.sin(Math.PI * u));
        const C4 = [Sh, Wr, An, tips[3]];
        patch(8, 8, (u, v) => {
          const f = front(u), bk = back(u), e0 = edge0(v), e1 = edge1(v), c = [0, 1].map(i => (1 - u) * (1 - v) * C4[0][i] + u * (1 - v) * C4[1][i] + (1 - u) * v * C4[2][i] + u * v * C4[3][i]);
          const pt = [0, 1].map(i => (1 - v) * f[i] + v * bk[i] + (1 - u) * e0[i] + u * e1[i] - c[i]), b = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
          return [pt[0], 0.012 * b, pt[1], 0.5 * b];
        });
      }
      const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); mg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); mg.setIndex(idx); mg.computeVertexNormals();
      const arm = new T.Object3D(); sh.add(arm); arm.add(new T.Mesh(mg, memM));
      /* the bones: upper arm and forearm, thicker; the fingers thin, each with a joint partway; the thumb and its claw */
      const V = (p, y = 0.0008) => new T.Vector3(p[0], y, p[1] * sd);
      arm.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([V(Sh), V(El), V(Wr)]), 12, 6, t => 0.0021 * (1 - 0.35 * t)), boneM));
      for (const [k, p] of tips.entries()) { const j = L2(Wr, p, 0.55), lift = k === 0 ? 0 : 0.0012 * k; arm.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([V(Wr), V([j[0] + 0.002, j[1]], 0.0008 + lift), V(p, 0.0006)]), 10, 4, t => 0.0012 * (1 - 0.65 * t)), boneM)); }
      arm.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([V(Wr, 0.001), V([Wr[0] + 0.007, Wr[1] + 0.002], 0.0025), V([Wr[0] + 0.0105, Wr[1] + 0.001], 0.0015)]), 6, 4, t => 0.0011 * (1 - 0.7 * t)), boneM));
      arm.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([V(Hp, -0.002), V(L2(Hp, An, 0.5), -0.0015), V(An, -0.001)]), 6, 5, () => 0.0016), furM));
      for (let c = 0; c < 4; c++) { const a = An, d = [a[0] - 0.006, a[1] + (c - 1.5) * 0.002]; arm.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([V(a, -0.001), V(d, -0.0025)]), 3, 3, t => 0.0005 * (1 - 0.6 * t)), boneM)); }
      wings.push({ sh, sd });
    }
    /* the skin between the legs, from one ankle across to the other, reaching partway down the tail; the tail runs on */
    {
      const pos = [], idx = [], n = 6, m = 6;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
        const u = i / n, v = j / m, zA = (v - 0.5) * 2 * (An[1] + 0.012), x = L2([-0.032, 0], [-0.07, 0], u)[0] + (An[0] + 0.032) * (1 - u) * Math.abs(v - 0.5) * 2;
        const zz = zA * (1 - 0.75 * u) * (1 - 0.15 * Math.sin(Math.PI * v) * u), xx = x - 0.012 * u * Math.sin(Math.PI * v);
        pos.push(xx, -0.002 + 0.012 * Math.abs(2 * v - 1) * (1 - u) + 0.002 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u), zz);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); tg.setIndex(idx); tg.computeVertexNormals();
      g.add(new T.Mesh(tg, M.litP('#2e211c', { roughness: 0.78, clearcoat: 0, specularIntensity: 0.25, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new T.Color('#6a3a28'), side: T.DoubleSide })));
      g.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(-0.034, -0.002, 0), new T.Vector3(-0.07, -0.004, 0), new T.Vector3(-0.088, -0.003, 0)]), 10, 6, t => 0.0022 * (1 - 0.6 * t)), boneM));
    }
    g.userData.anim = (t, flying) => {
      const a = flying ? 0.7 * Math.sin(t * 22) : 0.25 + 0.2 * Math.sin(t * 1.4);
      for (const w of wings) w.sh.rotation.x = -w.sd * a;
      head.rotation.y = 0.2 * Math.sin(t * 0.7);
    };
    g.userData.anim(0);
    return g;
  });
})();
