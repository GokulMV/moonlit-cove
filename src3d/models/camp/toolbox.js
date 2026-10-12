/* ─────────────────────────────────────────────────────────────
   models/camp/toolbox.js — an old steel toolbox, painted red and worn
   at the edges, that keeps everyone's drawings: a box with a rolled
   rim, a lid on a hinge along the back with a folding handle on top,
   two latches at the front; inside, drawings rolled up and tied with
   string, and a few lying flat.
   Built on y = 0, 46 cm long (x), 21 deep (z), 22 tall; its latches
   face +z. userData.open(k) opens the lid, 0 shut to 1 thrown back.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, lit, canvas, rng } = Models;
  function paint(seed) {
    const c = canvas(256, 256), a = c.getContext('2d'), r = rng(seed);
    a.fillStyle = '#a9382a'; a.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { a.fillStyle = `rgba(${60 + r() * 60},${20 + r() * 20},${15},${r() * 0.12})`; a.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
    /* worn through to the steel at the edges, a little rust */
    for (let i = 0; i < 60; i++) { const x = r() < 0.5 ? r() * 18 : 238 + r() * 18, y = r() * 256; a.fillStyle = r() < 0.6 ? `rgba(150,150,150,${0.3 + r() * 0.4})` : `rgba(120,60,30,${0.3 + r() * 0.3})`; a.fillRect(x, y, 2 + r() * 6, 1 + r() * 4); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  Models.add('camp/toolbox', () => {
    const g = new T.Group(), L = 0.46, D = 0.21, H = 0.16, LH = 0.06, R = rng(9);
    const red = Mats.lit({ map: paint(3), roughness: 0.5, metalness: 0.35 }), steel = Mats.lit({ color: C('#a7abae'), roughness: 0.35, metalness: 0.9 }), dark = lit('#1f1b1a', { roughness: 0.8 });
    /* the box: four walls and a floor (open at the top), a rolled rim */
    const wall = (w, h, x, y, z, ry) => { const m = mesh(new T.BoxGeometry(w, h, 0.004), red); m.rotation.y = ry; return g.add(at(m, x, y, z)); };
    wall(L, H, 0, H / 2, D / 2, 0); wall(L, H, 0, H / 2, -D / 2, 0); wall(D, H, L / 2, H / 2, 0, Math.PI / 2); wall(D, H, -L / 2, H / 2, 0, Math.PI / 2);
    g.add(at(mesh(new T.BoxGeometry(L, 0.004, D), red), 0, 0.002, 0));
    g.add(at(mesh(new T.BoxGeometry(L - 0.01, 0.002, D - 0.01), dark, false), 0, 0.005, 0));
    const rimC = new T.CatmullRomCurve3([[-L / 2, H, -D / 2], [L / 2, H, -D / 2], [L / 2, H, D / 2], [-L / 2, H, D / 2]].map(p => new T.Vector3(...p)), true, 'catmullrom', 0.02);
    g.add(mesh(new T.TubeGeometry(rimC, 64, 0.004, 6, true), red, false));
    /* inside: drawings rolled up and tied, and two lying flat */
    const paperM = lit('#f1ead9', { roughness: 0.9 }), string = lit('#9b7d52', { roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const roll = new T.Group(), len = 0.3 + R() * 0.08, rr = 0.016 + R() * 0.006; at(roll, (R() - 0.5) * 0.08, 0.03 + (i % 2) * 0.03 + Math.floor(i / 2) * 0.012, -D / 2 + 0.035 + i * 0.036); roll.rotation.set(0, (R() - 0.5) * 0.2, Math.PI / 2 + (R() - 0.5) * 0.08);
      roll.add(mesh(new T.CylinderGeometry(rr, rr, len, 14, 1, true), paperM, false));
      roll.add(mesh(new T.TorusGeometry(rr + 0.0012, 0.0012, 4, 14), string, false)).children.at(-1).rotation.x = Math.PI / 2;
      g.add(roll);
    }
    for (let i = 0; i < 2; i++) { const sh = mesh(new T.PlaneGeometry(0.4, 0.17), paperM, false); sh.rotation.set(-Math.PI / 2 + 0.03, 0, (R() - 0.5) * 0.08); at(sh, 0.01, 0.008 + i * 0.003, 0); g.add(sh); }
    /* the lid, hinged along the back edge */
    const lid = new T.Group(); at(lid, 0, H, -D / 2); g.add(lid);
    const top = mesh(new T.BoxGeometry(L + 0.008, 0.004, D + 0.008), red); at(top, 0, LH, D / 2); lid.add(top);
    for (const [w, d, x, z] of [[L + 0.008, 0.004, 0, D + 0.004], [L + 0.008, 0.004, 0, 0.0]]) { const s = mesh(new T.BoxGeometry(w, LH, d), red); at(s, x, LH / 2, z); lid.add(s); }
    for (const x of [-L / 2 - 0.002, L / 2 + 0.002]) { const s = mesh(new T.BoxGeometry(0.004, LH, D + 0.008), red); at(s, x, LH / 2, D / 2); lid.add(s); }
    /* its handle, folded down, and the hinge pins */
    const hc = new T.CatmullRomCurve3([new T.Vector3(-0.09, 0, 0), new T.Vector3(-0.08, 0.024, 0), new T.Vector3(0.08, 0.024, 0), new T.Vector3(0.09, 0, 0)]);
    const handle = mesh(new T.TubeGeometry(hc, 20, 0.005, 6), steel); at(handle, 0, LH + 0.002, D / 2); handle.rotation.x = -1.2; lid.add(handle);
    for (const x of [-0.09, 0.09]) lid.add(at(mesh(new T.BoxGeometry(0.02, 0.006, 0.014), steel), x, LH + 0.003, D / 2));
    for (const x of [-0.16, 0.16]) { const pin = mesh(new T.CylinderGeometry(0.004, 0.004, 0.04, 8), steel, false); pin.rotation.z = Math.PI / 2; at(pin, x, 0, -0.002); lid.add(pin); }
    /* the latches at the front */
    for (const x of [-0.15, 0.15]) {
      g.add(at(mesh(new T.BoxGeometry(0.03, 0.03, 0.006), steel), x, H - 0.012, D / 2 + 0.004));
      g.add(at(mesh(new T.BoxGeometry(0.018, 0.022, 0.004), steel), x, H + 0.012, D / 2 + 0.006));
    }
    g.userData.open = k => { lid.rotation.x = -1.95 * Math.max(0, Math.min(1, k)); };
    g.userData.lid = lid;
    return g;
  });
})();
