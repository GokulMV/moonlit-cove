/* ─────────────────────────────────────────────────────────────
   models/camp/crate.js — an old wooden crate turned on its end to make
   a side table by the fire: four corner posts, slatted sides with gaps
   between the boards, a top of three boards, a stencilled number on
   one side, nail heads at the joints.
   Built standing on y = 0, 44 cm wide (x), 32 deep (z), 36 tall; its
   stencilled side faces +z. userData.top is the height of its top.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, canvas, rng } = Models;
  function boardTex(seed, stencil) {
    const c = canvas(512, 256), a = c.getContext('2d'), r = rng(seed);
    a.fillStyle = '#b08a5e'; a.fillRect(0, 0, 512, 256);
    for (let y = 0; y < 256; y += 1 + r() * 3) { a.fillStyle = `rgba(${90 + r() * 40},${60 + r() * 25},30,${0.06 + r() * 0.16})`; a.fillRect(0, y, 512, 0.8 + r() * 1.6); }
    for (let i = 0; i < 4; i++) { const x = r() * 512, y = r() * 256; const g = a.createRadialGradient(x, y, 1, x, y, 14 + r() * 10); g.addColorStop(0, 'rgba(70,40,20,0.7)'); g.addColorStop(1, 'rgba(70,40,20,0)'); a.fillStyle = g; a.beginPath(); a.ellipse(x, y, 26, 10, 0, 0, Math.PI * 2); a.fill(); }
    /* weathered: greyer at the edges */
    a.fillStyle = 'rgba(120,115,105,0.18)'; a.fillRect(0, 0, 512, 256);
    if (stencil) { a.font = '700 92px "JetBrains Mono", monospace'; a.textAlign = 'center'; a.fillStyle = 'rgba(40,30,22,0.62)'; a.fillText('Nº 7', 256, 150); a.font = '600 34px "JetBrains Mono", monospace'; a.fillText('THE COVE · HANDLE WITH CARE', 256, 210); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  Models.add('camp/crate', () => {
    const g = new T.Group(), W = 0.44, D = 0.32, H = 0.36, post = 0.032, R = rng(3);
    const wood = Mats.lit({ map: boardTex(11, false), roughness: 0.88 }), sten = Mats.lit({ map: boardTex(12, true), roughness: 0.88 });
    const dark = Mats.lit({ color: new T.Color('#6e5238'), roughness: 0.9 }), nail = new T.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.5, metalness: 0.8 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new T.BoxGeometry(post, H - 0.004, post), dark), sx * (W / 2 - post / 2), H / 2, sz * (D / 2 - post / 2)));
    /* slats: three to a side with gaps, a little uneven */
    const slat = (w, h, t, x, y, z, ry, m) => { const s = mesh(new T.BoxGeometry(w, h, t), m); s.rotation.y = ry; s.rotation.z = (R() - 0.5) * 0.012; return g.add(at(s, x, y, z)); };
    for (let i = 0; i < 3; i++) { const y = 0.06 + i * 0.12;
      slat(W, 0.095, 0.012, 0, y, D / 2 + 0.002, 0, i === 1 ? sten : wood); slat(W, 0.095, 0.012, 0, y, -D / 2 - 0.002, 0, wood);
      slat(D - 0.004, 0.095, 0.012, W / 2 + 0.002, y, 0, Math.PI / 2, wood); slat(D - 0.004, 0.095, 0.012, -W / 2 - 0.002, y, 0, Math.PI / 2, wood); }
    for (let i = 0; i < 3; i++) slat(W + 0.012, 0.016, D / 3 - 0.006, 0, H + 0.006, (i - 1) * D / 3, 0, wood).children.at(-1).rotation.z = 0;
    /* nail heads where the slats meet the posts */
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const n = mesh(new T.CylinderGeometry(0.003, 0.003, 0.002, 6), nail, false); n.rotation.x = Math.PI / 2; at(n, sx * (W / 2 - post / 2), 0.06 + i * 0.12, sz * (D / 2 + 0.009)); g.add(n); }
    g.userData.top = H + 0.014;
    return g;
  });
})();
