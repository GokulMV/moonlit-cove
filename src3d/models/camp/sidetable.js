/* ─────────────────────────────────────────────────────────────
   models/camp/sidetable.js — a small slatted camp table of oiled
   teak, for between the chairs by the fire: six slats on a frame,
   four legs splayed out a little, and a low shelf of three slats
   (a folded blanket and a tin mug on it).
   Built on y = 0, 86 cm long (x), 44 deep (z), 46 tall; its long
   side toward +z. userData.top is the height of the tabletop.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, lit, rng } = Models;
  Models.add('camp/sidetable', () => {
    const g = new T.Group(), L = 0.86, D = 0.44, H = 0.46, TT = 0.02, R = rng(17);
    const teak = Mats.lit({ map: Mats.tex(Paint.plank(53, '#9a6a40', 1), { repeat: true }), roughness: 0.55 });
    const dark = Mats.lit({ map: Mats.tex(Paint.plank(57, '#7c5232', 1), { repeat: true }), roughness: 0.6 });
    /* the top: six slats with a finger's gap between, each a little different */
    const N = 6, sw = D / N;
    for (let i = 0; i < N; i++) {
      const s = mesh(new T.BoxGeometry(L - 0.004 * R(), TT, sw - 0.007), teak); at(s, (R() - 0.5) * 0.004, H - TT / 2 + (R() - 0.5) * 0.0015, -D / 2 + (i + 0.5) * sw);
      s.rotation.y = (R() - 0.5) * 0.004; g.add(s);
    }
    /* the frame under it */
    for (const z of [-D / 2 + 0.03, D / 2 - 0.03]) g.add(at(mesh(new T.BoxGeometry(L - 0.06, 0.05, 0.022), dark), 0, H - TT - 0.025, z));
    for (const x of [-L / 2 + 0.05, L / 2 - 0.05]) g.add(at(mesh(new T.BoxGeometry(0.022, 0.05, D - 0.06), dark), x, H - TT - 0.025, 0));
    /* the legs, splayed out a little at the foot */
    const legH = H - TT, legGeo = new T.BoxGeometry(0.036, legH, 0.036);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lg = mesh(legGeo, dark); at(lg, sx * (L / 2 - 0.055), legH / 2, sz * (D / 2 - 0.045)); lg.rotation.set(sz * 0.05, 0, -sx * 0.05); g.add(lg);
    }
    /* the low shelf, and what is kept on it */
    for (let i = 0; i < 3; i++) g.add(at(mesh(new T.BoxGeometry(L - 0.14, 0.016, 0.1), teak), 0, 0.13, -0.12 + i * 0.12));
    for (const z of [-0.16, 0.16]) g.add(at(mesh(new T.BoxGeometry(L - 0.1, 0.03, 0.02), dark), 0, 0.115, z));
    const blanket = mesh(Models.extrude(Models.rshape(-0.15, -0.1, 0.15, 0.1, [0.02, 0.02, 0.02, 0.02]), 0.05, 0.014), Mats.lit({ map: Mats.tex(Paint.plaid(), { repeat: true }), roughness: 0.97 }));
    blanket.rotation.x = -Math.PI / 2; at(blanket, -0.15, 0.165, 0); g.add(blanket);
    const mug = new T.Group(); at(mug, 0.2, 0.138, 0.02); g.add(mug);
    const enamel = lit('#e9e4da', { roughness: 0.35 }), rim = lit('#22303f', { roughness: 0.4 });
    mug.add(at(mesh(new T.CylinderGeometry(0.042, 0.04, 0.085, 18, 1, true), enamel), 0, 0.0425, 0));
    mug.add(at(mesh(new T.CircleGeometry(0.04, 18), enamel), 0, 0.001, 0)).children.at(-1).rotation.x = -Math.PI / 2;
    mug.add(at(mesh(new T.TorusGeometry(0.042, 0.003, 5, 20), rim), 0, 0.085, 0)).children.at(-1).rotation.x = Math.PI / 2;
    const hd = mesh(new T.TorusGeometry(0.022, 0.005, 6, 12, Math.PI), enamel); hd.rotation.z = -Math.PI / 2; at(hd, 0.042, 0.045, 0); mug.add(hd);
    g.userData = { top: H, L, D };
    return g;
  });
})();
