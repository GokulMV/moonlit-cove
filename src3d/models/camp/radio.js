/* ─────────────────────────────────────────────────────────────
   models/camp/radio.js — a little valve radio from the fifties: a
   teal case with rounded corners, a cream face, a speaker of dark
   cloth behind chrome bars, a printed dial that lights up warm with a
   red needle, two knobs and a chrome carrying handle.
   Built standing on y = 0, its face toward +z, 26 cm wide. The group
   carries userData.set(glow, dial): how lit the dial is (0 off) and
   where the needle sits along the scale, 0 to 1.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, rshape, extrude, lit, canvas } = Models;
  Models.add('camp/radio', () => {
    const g = new T.Group();
    const RW = 0.24, RH = 0.14, RD = 0.085, bv = 0.008, cy = RH / 2 + bv, fz = RD / 2 + bv + 0.0006;
    const caseM = Mats.litP({ color: C('#2f6158'), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18 });
    g.add(at(mesh(extrude(rshape(-RW / 2, -RH / 2, RW / 2, RH / 2, [0.028, 0.028, 0.028, 0.028]), RD, bv), caseM), 0, cy, 0));
    const cream = lit('#e9dcc0', { roughness: 0.5 }), chrome = new T.MeshStandardMaterial({ color: C('#d6d9dc'), roughness: 0.2, metalness: 0.95 });
    g.add(at(mesh(new T.ShapeGeometry(rshape(-0.105, -0.052, 0.105, 0.052, [0.016, 0.016, 0.016, 0.016])), cream, false), 0, cy, fz));
    /* the speaker: dark cloth behind chrome bars */
    g.add(at(mesh(new T.PlaneGeometry(0.1, 0.078), lit('#3a2f26', { roughness: 0.95 }), false), -0.047, cy + 0.003, fz + 0.0004));
    for (let i = 0; i < 6; i++) g.add(at(mesh(new T.BoxGeometry(0.098, 0.004, 0.004), chrome, false), -0.047, cy - 0.031 + i * 0.0136, fz + 0.002));
    /* the dial: a printed scale that lights up, a red needle */
    const dc = canvas(256, 160);
    { const a = dc.getContext('2d'); a.fillStyle = '#e8c88a'; a.fillRect(0, 0, 256, 160);
      a.fillStyle = 'rgba(120,70,20,0.18)'; a.fillRect(0, 0, 256, 18); a.fillRect(0, 142, 256, 18);
      a.fillStyle = '#4a2a12'; for (let i = 0; i <= 40; i++) a.fillRect(18 + i * 5.5, 38, 1.6, i % 5 ? 12 : 24);
      a.font = '600 19px Fraunces, Georgia, serif'; a.textAlign = 'center';
      ['55', '60', '70', '80', '100', '120', '140', '160', '170'].forEach((t, i) => a.fillText(t, 18 + i * 27.5, 90));
      a.font = "500 15px 'JetBrains Mono', monospace"; a.fillText('MEDIUM WAVE · SHORT WAVE', 128, 124); }
    const dt = Mats.tex(dc), dialM = Mats.lit({ map: dt, emissive: new T.Color(1, 0.7, 0.38), emissiveMap: dt, emissiveIntensity: 0, roughness: 0.35 });
    g.add(at(mesh(new T.PlaneGeometry(0.078, 0.049), dialM, false), 0.05, cy + 0.012, fz + 0.0005));
    for (const [w, h, x, y] of [[0.084, 0.003, 0.05, cy + 0.038], [0.084, 0.003, 0.05, cy - 0.014], [0.003, 0.055, 0.008, cy + 0.012], [0.003, 0.055, 0.092, cy + 0.012]]) g.add(at(mesh(new T.BoxGeometry(w, h, 0.003), chrome, false), x, y, fz + 0.0015));
    const needleM = lit('#b8261c', { roughness: 0.4, emissive: C('#ff3a20'), emissiveIntensity: 0 }), needle = mesh(new T.BoxGeometry(0.0016, 0.042, 0.001), needleM, false);
    at(needle, 0.05, cy + 0.012, fz + 0.0012); g.add(needle);
    for (const x of [0.026, 0.074]) { const k = mesh(new T.CylinderGeometry(0.011, 0.012, 0.012, 16), cream); k.rotation.x = Math.PI / 2; at(k, x, cy - 0.031, fz + 0.006); g.add(k); }
    /* the carrying handle */
    { const h = mesh(new T.TorusGeometry(0.075, 0.0045, 6, 20, Math.PI), chrome); h.scale.y = 0.55; at(h, 0, RH + 2 * bv, 0); g.add(h);
      for (const x of [-0.075, 0.075]) g.add(at(mesh(new T.CylinderGeometry(0.008, 0.009, 0.008, 10), chrome), x, RH + 2 * bv + 0.002, 0)); }
    g.userData.set = (glow, dial) => { dialM.emissiveIntensity = glow; needleM.emissiveIntensity = glow * 0.5; needle.position.x = 0.014 + 0.072 * dial; };
    return g;
  });
})();
