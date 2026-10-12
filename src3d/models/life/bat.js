/* a fruit bat's small cousin, a free-tailed bat, held with its wings half spread: a furred brown body, big rounded
   ears, a dark snout and bright black eyes; the wings thin dark skin stretched over the long finger bones, the light
   showing through them; a tail run out to the edge of the membrane between its legs.
   At the origin in metres, its head toward +x, its back +y; about 30 cm across the wings. userData.anim(t): the wings
   open and close a little, the ears twitch */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  M.add('life/bat', () => {
    const g = new T.Group(), fur = lin('#5a4130'), furD = lin('#3a2a20'), skin = lin('#2a201c');
    const furM = M.lit('#ffffff', { vertexColors: true, roughness: 0.95 });
    const body = M.loft([[-0.04, 0, 0, 0, 2], [-0.032, 0.012, 0.01, 0, 2], [-0.012, 0.019, 0.017, 0, 2], [0.008, 0.017, 0.016, 0.001, 2], [0.022, 0.012, 0.011, 0.002, 2], [0.03, 0, 0, 0.003, 2]], 30, 28,
      (x, y, z) => mix(fur, furD, 0.4 + 0.4 * M.vn(x * 600, y * 600, z * 600) + (y < 0 ? -0.2 : 0.1)));
    g.add(new T.Mesh(body, furM));
    const head = new T.Object3D(); head.position.set(0.034, 0.004, 0); g.add(head);
    head.add(new T.Mesh(M.loft([[-0.012, 0, 0, 0, 2], [-0.006, 0.011, 0.01, 0, 2], [0.006, 0.01, 0.009, 0.0, 2], [0.016, 0.005, 0.005, -0.002, 2], [0.02, 0, 0, -0.002, 2]], 20, 24,
      (x) => x > 0.012 ? skin : fur), furM));
    const eyeM = M.litP('#050505', { roughness: 0.05, clearcoat: 1 });
    for (const sd of [-1, 1]) {
      const e = new T.Mesh(new T.SphereGeometry(0.0022, 12, 10), eyeM); e.position.set(0.008, 0.004, sd * 0.0075); head.add(e);
      /* the ears: big, rounded, thin, ribbed inside */
      const ear = M.sheet(10, 8, (s, c) => { const w = 0.012 * Math.sin(Math.PI * Math.min(1, 0.1 + s * 0.9)) ** 0.6; return [(c - 0.5) * w, s * 0.02, -0.002 * Math.abs(c - 0.5) * 4 * s]; },
        (s, c) => mix(skin, lin('#6a4a40'), 0.5 * (1 - Math.abs(c - 0.5) * 2) * (0.5 + 0.5 * Math.sin(s * 30))));
      const em = new T.Mesh(ear, M.lit('#ffffff', { vertexColors: true, roughness: 0.7, side: T.DoubleSide })); em.position.set(-0.002, 0.008, sd * 0.006); em.rotation.set(sd * 0.5, sd * 0.4, -0.2); head.add(em);
    }
    /* the wings: the skin between the long finger bones, from the wrist out; dark, the light through it warm */
    const bones = [[0.11, 0.05], [0.14, 0.0], [0.12, -0.05], [0.08, -0.09]];   /* the fingers' tips (along, back) from the wrist */
    const wings = [];
    for (const sd of [1, -1]) {
      const sh = new T.Object3D(); sh.position.set(0.012, 0.01, sd * 0.012); g.add(sh);
      const arm = new T.Object3D(); sh.add(arm);
      /* the membrane: from the body's side out through the finger tips, back to the leg */
      /* (its trailing edge scalloped: drawn in between each finger's tip and the next) */
      const tips = bones.map(([a, b]) => [0.045 + b * 0.6, a]), wr = [0.03, 0.045], pts = [[0.0, 0.0], wr, tips[0]];
      for (let k = 1; k < tips.length; k++) { const p = tips[k - 1], q = tips[k], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; pts.push([m[0] + (wr[0] - m[0]) * 0.22, m[1] + (wr[1] - m[1]) * 0.22], q); }
      { const p = tips[tips.length - 1], q = [-0.055, 0.0], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; pts.push([m[0] + (0 - m[0]) * 0.3, m[1] * 0.7], q); }
      const shape = new T.Shape(); shape.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length; k++) { const [x, z] = pts[k]; shape.lineTo(x, z); }
      const mg = new T.ShapeGeometry(shape, 8); mg.rotateX(Math.PI / 2);
      const P = mg.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); P.setY(i, -0.004 * Math.sin(Math.min(1, Math.abs(z) / 0.14) * Math.PI)); }
      mg.computeVertexNormals();
      const mem = new T.Mesh(mg, new T.MeshPhysicalMaterial({ color: '#3a2620', roughness: 0.55, side: T.DoubleSide, transmission: 0, sheen: 0.4, sheenColor: new T.Color('#7a3a2a') }));
      if (sd < 0) mem.scale.z = -1; arm.add(mem);
      /* the bones: forearm and fingers, thin pale-dark rods */
      const boneM = M.lit('#2c211c', { roughness: 0.6 });
      for (const [a, b] of bones) { const c = new T.CatmullRomCurve3([new T.Vector3(0.03, 0.001, 0.045 * sd), new T.Vector3(0.045 + b * 0.6, 0.0, a * sd)]); arm.add(new T.Mesh(M.tube(c, 6, 4, t => 0.0011 * (1 - 0.6 * t)), boneM)); }
      arm.add(new T.Mesh(M.tube(new T.CatmullRomCurve3([new T.Vector3(0, 0.001, 0), new T.Vector3(0.03, 0.001, 0.045 * sd)]), 6, 5, () => 0.0018), boneM));
      wings.push({ sh, sd });
    }
    /* the tail membrane between the legs */
    const tm = M.sheet(6, 8, (s, c) => { const a = (c - 0.5) * 1.4; return [-0.035 - s * 0.045 * Math.cos(a), -0.002, Math.sin(a) * s * 0.035]; }, () => skin);
    g.add(new T.Mesh(tm, M.lit('#ffffff', { vertexColors: true, roughness: 0.6, side: T.DoubleSide })));
    g.userData.anim = (t, flying) => {
      const a = flying ? 0.7 * Math.sin(t * 22) : 0.25 + 0.2 * Math.sin(t * 1.4);
      for (const w of wings) w.sh.rotation.x = -w.sd * a;
      head.rotation.y = 0.2 * Math.sin(t * 0.7);
    };
    g.userData.anim(0);
    return g;
  });
})();
