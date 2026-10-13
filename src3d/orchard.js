/* ─────────────────────────────────────────────────────────────
   orchard.js — the fruit round the camp, on its own round of
   flowering and fruiting (models/flora/fruit.js): a young mango
   and a rambutan at the forest's edge either side of the camp, a
   papaya by the van, a clump of bananas behind the chairs, and the
   coconuts on the camp's own palms. Each place on a tree flowers,
   sets its fruit, which swell, ripen, go over and fall (sooner in a
   gale), and lie rotting under the tree until the ground has them;
   then it flowers again. Any of them can be picked, off the tree or
   up off the ground, and held (inspect.js): it goes on ripening in
   the hand, and wherever it is thrown it lies and rots as the rest.
   The rounds run on a life clock that keeps the scene's time flow:
   FloraFruit.PERIOD seconds a round at 1×, faster as time is sped
   up (never more than a hundred times, or it is a blur).
   Where they stand is Layout.fruit's; they stay by the camp
   wherever it is pitched, as its palms do.
   ───────────────────────────────────────────────────────────── */
const Orchard = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const MODEL = { mango: 'fruit/mango-tree', rambutan: 'fruit/rambutan-tree', durian: 'fruit/durian-tree', cempedak: 'fruit/cempedak-tree', papaya: 'fruit/papaya-tree', banana: 'fruit/banana-plant', coconut: 'fruit/coconut-palm' };

  /* root: where they go; world: for the ground (world.land); o.palms: the camp's palms (nature.js), to bear coconuts */
  function build(root, world, o = {}) {
    const sets = [], land = (x, z) => Math.max(0, world.land(x, z)), t0 = performance.now();
    /* the ground under a set, in its own frame (its group placed, turned about y) */
    const groundOf = (g, base) => { const v = new T.Vector3(); return (x, z) => { v.set(x, 0, z); g.localToWorld(v); return land(v.x, v.z) - base(); }; };
    for (const f of Layout.fruit || []) {
      const g = Models.make(MODEL[f.kind], Object.assign({ seed: f.seed || 1, fruitLod: 1, bloomLod: 1, lod: f.lod ?? 0 }, f.opts || {}));
      const fr = g.userData.fruit; if (!fr) continue;
      g.position.set(f.x, land(f.x, f.z) - 0.05, f.z); g.rotation.y = f.ry || 0; root.add(g); g.updateMatrixWorld(true);
      fr.live.reground(groundOf(g, () => g.position.y));
      sets.push({ g, fr, kind: f.kind, x: f.x, z: f.z, place: () => { g.position.y = land(f.x, f.z) - 0.05; g.updateMatrixWorld(true); } });
    }
    /* the camp's palms: their bunches among the frond bases, each on its own round, its spadix first, then its nuts;
       those fallen at the palm's foot (the crown's own sway is a degree or so: the bunches hang just under it, still) */
    const stalkM = FloraKit.barkMat('coconut', { tint: [0.72, 0.62, 0.42] });
    (o.palms || []).forEach((c, i) => {
      const pg = c.g.parent; if (!pg) return;
      const R = Models.rng(173 + i * 31), top = c.g.position.clone().add(new T.Vector3(0, -0.12, 0)), H = c.g.position.y;
      const B = FloraFruit.coconutSites(top, R, { share: 0.95, Hp: H + 3, n: 2 + Math.floor(R() * 3) });
      const g = FloraFruit.assemble('coconut', B.sites, { seed: 40 + i, fruitLod: 2, bloomLod: 1, cap: 6 }), fr = g.userData.fruit;
      /* (the bunches' stalks: woody, fibrous, yellow-brown) */
      const tubes = B.stalks.map(s => FloraKit.tube(new T.CatmullRomCurve3(s.pts), t => 0.024 * (1 - 0.3 * t), { segs: 5, radial: 6, tile: FloraKit.bark('coconut').tile, col: () => [0.9, 0.82, 0.6] }));
      if (tubes.length) { const m = new T.Mesh(FloraKit.mergeParts(tubes), stalkM); m.castShadow = true; g.add(m); }
      pg.add(g); pg.updateMatrixWorld(true);
      fr.live.reground(groundOf(g, () => pg.position.y));
      sets.push({ g, fr, kind: 'coconut', x: pg.position.x, z: pg.position.z, place: () => {} });
    });
    const ms = performance.now() - t0;

    /* ── every frame: dtR real seconds (for a fall to look like one), flow the scene's time flow; env.wind (1 a breeze,
       more in a storm: a gale brings the ripe ones down) ── */
    function update(dtR, flow, env) {
      const dtL = dtR * Math.max(0, Math.min(100, flow ?? 1));
      FloraFruit.life.clock += dtL;
      for (const s of sets) s.fr.live.step(dtR, dtL, env);
    }
    /* what can be picked near the camera (inspect.js) */
    function pickables(list, cam) { for (const s of sets) { const dx = s.x - cam.x, dz = s.z - cam.z; if (dx * dx + dz * dz < 60 * 60) s.fr.live.pickables(list, cam); } }
    /* the ground moved under them (the camp pitched somewhere new): stood on it again, those lying laid on it again */
    function reground() { for (const s of sets) { s.place(); const pg = s.g.parent; s.fr.live.reground(groundOf(s.g, () => s.g.position.y + (pg && pg !== root ? pg.position.y : 0))); } }
    /* (for the test bench) */
    const count = () => sets.map(s => Object.assign({ kind: s.kind, x: +s.x.toFixed(1), z: +s.z.toFixed(1) }, s.fr.live.count()));
    return { update, pickables, reground, count, sets, ms };
  }
  return { build };
})();
