/* ─────────────────────────────────────────────────────────────
   models/camp/torch.js — the torch you carry on a night walk: an
   anodised aluminium body, ribbed for the grip, with a pocket clip;
   a tail cap with a rubber switch; a finned neck flaring to the head;
   a crenellated bezel round the lens, a chrome reflector behind it
   and the LED at its heart.
   Built along z, its lens toward −z (the lens face at z ≈ −0.075),
   about 19 cm long. userData.lens is the lens's mesh and
   userData.lensM its material, whose colour the engine turns up
   when it is on; userData.ledM the LED's.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, { C } = Models;
  Models.add('camp/torch', () => {
    const g = new T.Group();
    const alu = new T.MeshStandardMaterial({ color: C('#8b929c'), metalness: 0.35, roughness: 0.42 });
    const dark = new T.MeshStandardMaterial({ color: C('#3d4148'), metalness: 0.4, roughness: 0.45 });
    const rubber = new T.MeshStandardMaterial({ color: C('#1f2023'), roughness: 0.82 });
    const chrome = new T.MeshStandardMaterial({ color: C('#e1e4e8'), metalness: 1, roughness: 0.12 });
    /* the shell, turned on a lathe: [radius, z] from the tail to the bezel */
    const P = [[0.0085, 0.1182], [0.0141, 0.1182], [0.0146, 0.1172], [0.0146, 0.1035], [0.0139, 0.1022], [0.0129, 0.1018]];
    /* the grip: shallow grooves every 2.6 mm */
    for (let z = 0.098; z > 0.026; z -= 0.0026) P.push([0.0129, z], [0.01255, z - 0.0009], [0.0129, z - 0.0017]);
    P.push([0.0129, 0.006], [0.0136, 0.0052], [0.0136, 0.0012], [0.0131, 0.0004]);
    /* the neck's cooling fins */
    for (let z = -0.001; z > -0.018; z -= 0.0034) P.push([0.0131, z], [0.0146, z - 0.0005], [0.0146, z - 0.0019], [0.0131, z - 0.0024]);
    P.push([0.0134, -0.0195], [0.0152, -0.023], [0.0182, -0.035], [0.0204, -0.047], [0.0213, -0.062], [0.0214, -0.0672], [0.0229, -0.0682], [0.0231, -0.0752], [0.0207, -0.0757]);
    /* (turned from the bezel back, so the lathe's faces look outward) */
    const shell = new T.LatheGeometry(P.reverse().map(([r, z]) => new T.Vector2(r, z)), 48); shell.rotateX(Math.PI / 2);
    g.add(new T.Mesh(shell, alu));
    /* the tail's rubber switch */
    const sw = new T.SphereGeometry(0.0086, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); sw.scale(1, 0.55, 1); sw.rotateX(Math.PI / 2); sw.translate(0, 0, 0.1178);
    g.add(new T.Mesh(sw, new T.MeshStandardMaterial({ color: C('#6a6e74'), roughness: 0.62 })));
    /* (a lanyard loop off the tail cap) */
    const loop = new T.Mesh(new T.TorusGeometry(0.0045, 0.0009, 6, 16), dark); loop.position.set(0, 0.0135, 0.112); loop.rotation.y = Math.PI / 2; g.add(loop);
    /* the bezel's crenellations: six teeth standing proud of its rim */
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = new T.Mesh(new T.BoxGeometry(0.006, 0.0018, 0.0035), dark); b.position.set(Math.cos(a) * 0.0222, Math.sin(a) * 0.0222, -0.0768); b.rotation.z = a + Math.PI / 2; g.add(b); }
    /* the reflector, a chrome cup behind the lens, and the LED in its middle */
    const ref = new T.LatheGeometry([[0.0032, -0.058], [0.008, -0.0612], [0.0135, -0.0668], [0.0204, -0.0748]].map(([r, z]) => new T.Vector2(r, z)), 40); ref.rotateX(Math.PI / 2);
    g.add(new T.Mesh(ref, new T.MeshStandardMaterial({ color: C('#e9ecf0'), metalness: 1, roughness: 0.22, side: T.DoubleSide })));
    const ledM = new T.MeshBasicMaterial({ color: new T.Color(0.25, 0.24, 0.2) });
    const led = new T.Mesh(new T.BoxGeometry(0.0034, 0.0034, 0.001), ledM); led.position.z = -0.0585; g.add(led);
    /* the lens: glass, catching the sky, glowing when the torch is on */
    const lensM = new T.MeshBasicMaterial({ color: new T.Color(0.08, 0.08, 0.08), transparent: true, opacity: 0.55, depthWrite: false });
    const lens = new T.Mesh(new T.CircleGeometry(0.0206, 40), lensM); lens.position.z = -0.0752; lens.rotation.y = Math.PI; g.add(lens);
    const glass = new T.Mesh(new T.CircleGeometry(0.0206, 40), new T.MeshStandardMaterial({ color: C('#0c0d0f'), metalness: 0, roughness: 0.04, transparent: true, opacity: 0.25 }));
    glass.position.z = -0.0753; glass.rotation.y = Math.PI; g.add(glass);
    /* the pocket clip, along the top of the body */
    const clipS = new T.Shape(); clipS.moveTo(-0.0024, 0); clipS.lineTo(0.0024, 0); clipS.lineTo(0.002, 0.052); clipS.quadraticCurveTo(0, 0.056, -0.002, 0.052); clipS.lineTo(-0.0024, 0);
    const clip = new T.ExtrudeGeometry(clipS, { depth: 0.0009, bevelEnabled: true, bevelThickness: 0.0003, bevelSize: 0.0003, bevelSegments: 2 });
    clip.rotateX(-Math.PI / 2); const cm = new T.Mesh(clip, chrome); cm.position.set(0, 0.0134, 0.098); cm.rotation.x = -0.035; g.add(cm);
    const band = new T.Mesh(new T.TorusGeometry(0.0131, 0.0011, 8, 32), dark); band.position.z = 0.0985; g.add(band);
    g.userData = { lens, lensM, ledM };
    return g;
  });
})();
