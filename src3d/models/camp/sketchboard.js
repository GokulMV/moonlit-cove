/* ─────────────────────────────────────────────────────────────
   models/camp/sketchboard.js — a drawing board left on the picnic
   table: a sheet of birch ply with rounded corners, a sheet of paper
   held by a bulldog clip, a yellow pencil sharpened to a point, and a
   tin of crayons with its lid off.
   Built lying on y = 0, the top of the paper toward -z (whoever draws
   sits on the +z side), 46 cm by 35. userData.paper is the paper's
   mesh; userData.setPicture(canvas) shows a canvas on it (the page's
   own drawing, as it is drawn); userData.W, H its size in metres.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, rshape, extrude, lit, canvas, rng } = Models;
  function plyTex() {
    const c = canvas(512, 384), a = c.getContext('2d'), r = rng(7);
    a.fillStyle = '#d8bf96'; a.fillRect(0, 0, 512, 384);
    for (let y = 0; y < 384; y += 1 + r() * 3) { a.fillStyle = `rgba(${150 + r() * 40},${110 + r() * 30},${70},${0.05 + r() * 0.12})`; a.fillRect(0, y + Math.sin(y * 0.05) * 3, 512, 1 + r() * 1.5); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  Models.add('camp/sketchboard', () => {
    const g = new T.Group(), BW = 0.46, BH = 0.35, BT = 0.012, PW = 0.4, PH = 0.3;
    /* the board: birch ply, its layered edge showing */
    const board = mesh(extrude(rshape(-BW / 2, -BH / 2, BW / 2, BH / 2, [0.018, 0.018, 0.018, 0.018]), BT, 0.002), [Mats.lit({ map: plyTex(), roughness: 0.75 }), lit('#c9ad83', { roughness: 0.8 })]);
    board.rotation.x = -Math.PI / 2; at(board, 0, BT / 2 + 0.002, 0); g.add(board);
    /* the paper: a canvas of its own until the page gives it the drawing */
    /* (the same size as the page's drawing, 800 by 600: a texture keeps the size it was first given) */
    const blank = canvas(800, 600); { const a = blank.getContext('2d'); a.fillStyle = '#f6f1e4'; a.fillRect(0, 0, 800, 600); }
    const tex = new T.CanvasTexture(blank); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const paperM = Mats.lit({ map: tex, roughness: 0.92, emissive: C('#ffffff'), emissiveMap: tex, emissiveIntensity: 0 });
    const paper = mesh(new T.PlaneGeometry(PW, PH), paperM, false, true); paper.rotation.x = -Math.PI / 2; at(paper, 0, BT + 0.0065, 0.012); g.add(paper);
    /* the bulldog clip at the top of the sheet */
    const steel = Mats.lit({ color: C('#bfc3c6'), roughness: 0.3, metalness: 0.9 }), black = lit('#1c1c1e', { roughness: 0.4, metalness: 0.4 });
    const jaw = mesh(extrude(rshape(-0.045, -0.012, 0.045, 0.012, [0.004, 0.004, 0.004, 0.004]), 0.006, 0.001), black); jaw.rotation.x = -Math.PI / 2 + 0.12; at(jaw, 0, BT + 0.012, -PH / 2 + 0.006); g.add(jaw);
    for (const x of [-0.03, 0.03]) { const lp = mesh(new T.TorusGeometry(0.012, 0.0016, 5, 14, Math.PI), steel, false); lp.rotation.set(0.35, Math.PI / 2, 0); at(lp, x, BT + 0.02, -PH / 2 - 0.006); g.add(lp); }
    /* a pencil: hexagonal, yellow, a pink eraser in a band of brass, sharpened to a point */
    const pen = new T.Group(); at(pen, BW / 2 + 0.045, 0.0045, 0.02); pen.rotation.y = 0.35; g.add(pen);
    const body = mesh(new T.CylinderGeometry(0.0045, 0.0045, 0.15, 6), lit('#e2b324', { roughness: 0.45 })); body.rotation.z = Math.PI / 2; pen.add(body);
    const cone = mesh(new T.CylinderGeometry(0.0045, 0.0012, 0.02, 6), lit('#e2c9a0', { roughness: 0.8 })); cone.rotation.z = -Math.PI / 2; at(cone, 0.085, 0, 0); pen.add(cone);
    const tip = mesh(new T.ConeGeometry(0.0012, 0.006, 6), lit('#2a2a2a', { roughness: 0.5 })); tip.rotation.z = -Math.PI / 2; at(tip, 0.098, 0, 0); pen.add(tip);
    const band = mesh(new T.CylinderGeometry(0.0048, 0.0048, 0.009, 10), Mats.lit({ color: C('#b8954a'), roughness: 0.35, metalness: 0.85 })); band.rotation.z = Math.PI / 2; at(band, -0.079, 0, 0); pen.add(band);
    const rub = mesh(new T.CylinderGeometry(0.0045, 0.0045, 0.009, 10), lit('#e58f98', { roughness: 0.8 })); rub.rotation.z = Math.PI / 2; at(rub, -0.088, 0, 0); pen.add(rub);
    /* a tin of crayons, its lid leaning on it */
    const tin = new T.Group(); at(tin, -BW / 2 - 0.07, 0, -0.06); tin.rotation.y = -0.4; g.add(tin);
    const tinM = Mats.lit({ color: C('#2f5e8a'), roughness: 0.35, metalness: 0.6 });
    const box = mesh(new T.BoxGeometry(0.11, 0.022, 0.07), tinM); at(box, 0, 0.011, 0); tin.add(box);
    const R = rng(5), cols = ['#c8352e', '#e8892a', '#e8c62a', '#3f9a4a', '#2a7ec8', '#6a3fa0', '#7a4a2a', '#1d1d1d'];
    cols.forEach((c, i) => { const cr = mesh(new T.CylinderGeometry(0.0042, 0.0042, 0.085, 8), lit(c, { roughness: 0.6 })); cr.rotation.set(0, 0, Math.PI / 2 + (R() - 0.5) * 0.06); at(cr, (R() - 0.5) * 0.01, 0.024 + (i % 2) * 0.004, -0.028 + i * 0.008); tin.add(cr); });
    const lid = mesh(new T.BoxGeometry(0.112, 0.004, 0.072), tinM); lid.rotation.set(0.0, 0.2, -0.32); at(lid, 0.085, 0.02, 0.01); tin.add(lid);
    g.userData = { paper, W: PW, H: PH, setPicture(cv) { if (tex.image !== cv) { if (cv.width !== tex.image.width || cv.height !== tex.image.height) tex.dispose(); tex.image = cv; } tex.needsUpdate = true; }, setLight(k) { paperM.emissiveIntensity = k; } };
    return g;
  });
})();
