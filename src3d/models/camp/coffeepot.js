/* ─────────────────────────────────────────────────────────────
   models/camp/coffeepot.js — a speckled enamel coffee percolator for
   hanging over the fire: a body turned on a lathe (a bevelled foot,
   sides tapering to a rounded shoulder, a rolled navy rim), its
   bottom blackened by the flames; a domed lid with a glass knob to
   watch the coffee in; a spout curving up from low on the body; a
   flat strap handle; a wire bail from two ears at the rim, and an
   S-hook on the bail for the tripod's chain.
   Built standing on y = 0, the spout toward -x. userData.hangY is the
   height of the top of the S-hook, where the chain takes it.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, lit, canvas, rng, tube } = Models;
  /* blue enamel flecked with white, sooted up from the bottom (v runs up the pot) */
  function enamel(seed) {
    const c = canvas(256, 256), a = c.getContext('2d'), r = rng(seed);
    a.fillStyle = '#1e3f72'; a.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const s = 0.35 + r() * r() * 1.4; a.fillStyle = `rgba(235,240,250,${0.3 + r() * 0.5})`; a.beginPath(); a.arc(r() * 256, r() * 256, s, 0, Math.PI * 2); a.fill(); }
    for (let i = 0; i < 500; i++) { a.fillStyle = `rgba(10,20,45,${0.4 + r() * 0.4})`; a.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    const g = a.createLinearGradient(0, 256, 0, 0); g.addColorStop(0, 'rgba(12,10,9,0.96)'); g.addColorStop(0.16, 'rgba(14,12,11,0.85)'); g.addColorStop(0.3, 'rgba(20,16,14,0.35)'); g.addColorStop(0.42, 'rgba(20,16,14,0)');
    a.fillStyle = g; a.fillRect(0, 0, 256, 256);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; return t;
  }
  Models.add('camp/coffeepot', () => {
    const g = new T.Group();
    const potM = Mats.lit({ map: enamel(21), roughness: 0.22, metalness: 0.05 }, 'pot'), navy = lit('#0e1a30', { roughness: 0.3 }, 'pot');
    const iron = Mats.lit({ color: C('#232224'), roughness: 0.45, metalness: 0.8 }), glass = new T.MeshStandardMaterial({ color: C('#bcd6e2'), roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6 });   /* (no transmission: that renders the whole scene again) */
    /* the body and lid, turned */
    const prof = [[0.0, 0.003], [0.08, 0.003], [0.087, 0.009], [0.088, 0.022], [0.0745, 0.172], [0.072, 0.186], [0.068, 0.196], [0.066, 0.2]].map(([r, y]) => new T.Vector2(r, y));
    const body = mesh(new T.LatheGeometry(prof, 40), potM); g.add(body);
    { const uv = body.geometry.attributes.uv, p = body.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setY(i, p.getY(i) / 0.2); }
    const rim = mesh(new T.TorusGeometry(0.0675, 0.0042, 8, 40), navy); rim.rotation.x = Math.PI / 2; at(rim, 0, 0.2, 0); g.add(rim);
    const lidP = [[0.066, 0.201], [0.0655, 0.206], [0.058, 0.215], [0.045, 0.223], [0.028, 0.229], [0.018, 0.231], [0.0, 0.231]].map(([r, y]) => new T.Vector2(r, y));
    g.add(mesh(new T.LatheGeometry(lidP, 40), potM));
    g.add(at(mesh(new T.CylinderGeometry(0.02, 0.021, 0.006, 20), lit('#c9ccd0', { roughness: 0.3, metalness: 0.9 })), 0, 0.234, 0));
    const knob = mesh(new T.SphereGeometry(0.019, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, false); at(knob, 0, 0.236, 0); g.add(knob);
    /* the spout, from low on the body, curving up and out */
    const sc = new T.CatmullRomCurve3([new T.Vector3(-0.07, 0.05, 0), new T.Vector3(-0.098, 0.075, 0), new T.Vector3(-0.122, 0.12, 0), new T.Vector3(-0.14, 0.168, 0), new T.Vector3(-0.152, 0.19, 0)]);
    g.add(mesh(tube(sc, 24, 14, t => 0.017 - 0.008 * t + 0.003 * Math.pow(t, 6)), potM));
    const lip = mesh(new T.TorusGeometry(0.0115, 0.002, 6, 16), navy); const end = sc.getPointAt(1), tan = sc.getTangentAt(1); lip.position.copy(end); lip.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), tan); g.add(lip);
    /* a flat strap handle */
    const hc = new T.CatmullRomCurve3([new T.Vector3(0.068, 0.178, 0), new T.Vector3(0.105, 0.172, 0), new T.Vector3(0.124, 0.13, 0), new T.Vector3(0.118, 0.075, 0), new T.Vector3(0.095, 0.045, 0), new T.Vector3(0.082, 0.04, 0)]);
    g.add(mesh(tube(hc, 30, 10, () => 0.0042, { sx: 1, sy: 2.6 }), navy));
    /* the ears and the wire bail, standing up, and the S-hook at its top */
    for (const z of [-1, 1]) { const ear = mesh(new T.TorusGeometry(0.0062, 0.0022, 6, 12), iron); ear.rotation.y = Math.PI / 2; at(ear, 0, 0.192, z * 0.0705); g.add(ear); }
    const bc = new T.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => { const t = i / 12 * Math.PI; return new T.Vector3(0, 0.192 + 0.12 * Math.sin(t), 0.0705 * Math.cos(t)); }));
    g.add(mesh(tube(bc, 40, 6, () => 0.0026), iron));
    const top = 0.192 + 0.12;
    const hk = new T.CatmullRomCurve3([new T.Vector3(0, top - 0.004, 0.008), new T.Vector3(0, top - 0.008, -0.004), new T.Vector3(0, top + 0.004, -0.012), new T.Vector3(0, top + 0.022, -0.006),
      new T.Vector3(0, top + 0.04, 0.006), new T.Vector3(0, top + 0.058, 0.009), new T.Vector3(0, top + 0.066, 0.0), new T.Vector3(0, top + 0.06, -0.008)]);
    g.add(mesh(tube(hk, 40, 6, () => 0.0028), iron));
    g.userData.hangY = top + 0.066;
    return g;
  });
})();
