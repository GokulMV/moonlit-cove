/* ─────────────────────────────────────────────────────────────
   models/beach/bottle.js — a message in a bottle, washed up: a green
   glass bottle turned on a lathe (a punt in its base, straight sides,
   a rounded shoulder, a long neck with a lip at the top), a cork
   pushed into the neck, and inside a letter rolled tight enough to
   pass the neck, tied round the middle with twine, lying along the
   bottom of the bottle.
   Built along +x (the neck toward +x), the middle of the bottle at
   the origin, 32 cm long. userData:
     cork, roll, twine   the parts that come out
     neckX               where the neck ends, along x
     corkX, rollX, rollY where the cork and the letter sit at rest
     rollR, rollLen      the letter's radius and length
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { mesh, at, C, lit, canvas, rng } = Models;
  /* cork: pale brown, pitted */
  function corkTex() {
    const c = canvas(64, 64), a = c.getContext('2d'), r = rng(4);
    a.fillStyle = '#a77d52'; a.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 160; i++) { a.fillStyle = `rgba(${60 + r() * 50},${35 + r() * 30},15,${0.3 + r() * 0.5})`; a.beginPath(); a.arc(r() * 64, r() * 64, 0.5 + r() * 1.6, 0, Math.PI * 2); a.fill(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  /* the letter's outside: old paper, lines of ink showing through */
  function rollTex() {
    const c = canvas(256, 64), a = c.getContext('2d'), r = rng(8);
    a.fillStyle = '#ecdcb9'; a.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 500; i++) { a.fillStyle = `rgba(150,110,60,${r() * 0.12})`; a.fillRect(r() * 256, r() * 64, 2, 1); }
    a.strokeStyle = 'rgba(60,40,30,0.32)'; a.lineWidth = 1;
    for (let y = 10; y < 60; y += 8) { a.beginPath(); a.moveTo(14, y); for (let x = 14; x < 240; x += 4) a.lineTo(x, y + Math.sin(x * 0.7 + y) * 1.1); a.stroke(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  Models.add('beach/bottle', () => {
    const g = new T.Group();
    /* the glass, turned: a profile up the bottle's axis (y here, laid along x after) */
    const L = 0.32, R = 0.037;
    const P = [[0.0, 0.0], [0.016, 0.004], [0.022, 0.012], [0.03, 0.002], [R, 0.004], [R, 0.2], [0.0345, 0.224], [0.025, 0.242], [0.0148, 0.258], [0.0128, 0.296], [0.0143, 0.303], [0.0143, 0.313], [0.0119, L]];
    const prof = P.map(([r, y]) => new T.Vector2(r, y - L / 2));
    const glassM = new T.MeshPhysicalMaterial({ color: C('#2f6e4c'), roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, opacity: 0.58, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.2 });
    const glass = mesh(new T.LatheGeometry(prof, 40), glassM, true, false); glass.rotation.z = -Math.PI / 2; glass.renderOrder = 3; g.add(glass);
    /* the cork, pushed into the neck, 6 mm of it standing proud */
    const corkX = L / 2 + 0.006 - 0.015;
    const cork = mesh(new T.CylinderGeometry(0.0122, 0.0112, 0.03, 16), Mats.lit({ map: corkTex(), roughness: 0.95 })); cork.rotation.z = -Math.PI / 2; at(cork, corkX, 0, 0); g.add(cork);
    /* the letter, rolled tight (it passes the neck, 12.8 mm across inside), lying along the bottom of the bottle */
    const rollR = 0.0095, rollLen = 0.2, rollX = 0.114 - L / 2, rollY = -0.024;
    const roll = mesh(new T.CylinderGeometry(rollR, rollR, rollLen, 18), Mats.lit({ map: rollTex(), roughness: 0.9, emissive: C('#ffd59a'), emissiveIntensity: 0.04 }), false);
    roll.rotation.z = Math.PI / 2; at(roll, rollX, rollY, 0); g.add(roll);
    const twine = mesh(new T.TorusGeometry(rollR + 0.0006, 0.0014, 5, 18), lit('#9a4b1c', { roughness: 0.9 })); twine.rotation.y = Math.PI / 2; at(twine, rollX, rollY, 0); g.add(twine);
    g.userData = { cork, roll, twine, letter: [roll, twine], neckX: L / 2, corkX, rollX, rollY, rollR, rollLen, length: L };
    return g;
  });
})();
