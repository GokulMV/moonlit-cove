/* wild/firefly — one mangrove firefly (Pteroptyx tener), the beetle whose thousands light the riverside trees: 6 mm
   long, the shield over its head orange-yellow, the wing cases pale tan tipped dark, the last rings of the abdomen the
   cream lantern that flashes yellow-green — in time with all the others, two or three times a second (the same beat
   as wild/fireflies). Built standing (facing +x, feet on y = 0), wings spread. o.clip: rest (also idle: on a leaf, the
   lantern flashing), walk, fly (wing cases raised, the hind wings beating, the lantern on), glide, groom.
   o.hz the beat (2.4), o.lone to flash out of step. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/firefly', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT } = R;
    const C = { shield: lin('#c8862a'), tan: lin('#b09460'), tip: lin('#2a2218'), body: lin('#3a2a1a'), lamp: lin('#e8e2b8'), eye: lin('#141210'), leg: lin('#4a3a28') };
    const glassCol = (u, v) => { const k = u * 5, f = k - Math.floor(k), vein = sst(0.08, 0.0, Math.min(f, 1 - f)) * sst(0.1, 0.25, v), a = clamp(0.2 + 0.6 * vein, 0, 0.85), c = mix([0.5, 0.46, 0.4], [0.15, 0.12, 0.1], vein); return [c[0], c[1], c[2], a]; };
    const g = Insect.build(o, {
      name: 'firefly', cell: 0.00006, tau: 0.00012, fold: 'flat',
      thorax: { c: [0.0006, 0.0017], r: [0.0011, 0.00072, 0.00085], shapes: () => [{ ell: [0.0016, 0.0021, 0], r: [0.0012, 0.0004, 0.0011], bone: 'thorax', tag: 'shield', k: 0.0002 }] },
      head: { c: [0.0022, 0.0015], r: [0.0005, 0.00055, 0.0006], k: 0.0002, eyes: { c: [0.0024, 0.0016, 0.00045], r: 0.00032, col: C.eye, facet: 0.000016 } },
      abdomen: { pts: [[-0.0005, 0.0016], [-0.0016, 0.00155], [-0.0026, 0.0015], [-0.0034, 0.00145]], r: s => [0.00078 * (1 - 0.25 * s), 0.00058 * (1 - 0.25 * s)], end: 0.0007, k: 0.3, overlap: 0.8 },
      antennae: { root: [0.0027, 0.0018, 0.00025], tip: [0.0048, 0.0024, 0.0012], r: 0.00004, arch: 0.0004 },
      legs: [
        { root: [0.001, 0.0011, 0.0004], knee: [0.0015, 0.0016, 0.0013], ankle: [0.0019, 0.0005, 0.0016], foot: [0.0022, 0.0, 0.0018], r: [0.00008, 0.00006, 0.00004] },
        { root: [0.0002, 0.001, 0.00045], knee: [0.0002, 0.0016, 0.0016], ankle: [-0.0003, 0.0005, 0.002], foot: [-0.0004, 0.0, 0.0023], r: [0.00008, 0.00006, 0.00004] },
        { root: [-0.0005, 0.001, 0.0004], knee: [-0.0012, 0.0016, 0.0015], ankle: [-0.002, 0.0005, 0.0019], foot: [-0.0023, 0.0, 0.0021], r: [0.00008, 0.00006, 0.00004] }],
      wings: [
        /* (the wing cases: hard, tan, dark at their tips; in flight held up and still) */
        { name: 'fw', root: [0.0004, 0.0023, 0.00035], col: (u, v, top) => mix(C.tan, C.tip, sst(0.72, 0.85, v)).map(c => c * (top ? 1 : 0.8)), nt: 16, nr: 10, mat: [0.42, 0.45, PAT.chitin, 0], amp: 0.12, flyLift: 0.9, flySweep: -0.25, flyPitch: 0.3, restSweep: 1.47, restLift: 0.12, th: 0.00004,
          outline: [[-0.2, 0.0002], [-0.12, 0.0018], [0.0, 0.0038], [0.12, 0.0042], [0.24, 0.0038], [0.34, 0.0018], [0.4, 0.0002]] },
        { name: 'hw', root: [0.0001, 0.0022, 0.0003], glass: true, col: glassCol, nt: 16, nr: 8, restSweep: 1.4, restLift: 0.05,
          outline: [[-0.1, 0.0002], [-0.02, 0.003], [0.15, 0.0048], [0.35, 0.0046], [0.55, 0.0034], [0.75, 0.0016], [0.85, 0.0002]] }],
      flap: { hz: 60, amp: 1.0, twist: 0.5, lag: 0.0, dihedral: 0.25, pitch: 0.25, bob: 0.00004 },
      walkHz: 4, stride: 0.0007,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('shield') > 0.4) return { col: C.shield, mat: [0.45, 0.4, PAT.chitin, 0] };
        if (g('abd2') + g('abd3') > 0.4 && ny < 0.3) return { col: C.lamp, mat: [0.5, 0.3, PAT.chitin, 0.4] };
        return { col: g('leg') + g('foot') + g('antenna') > 0.4 ? C.leg : C.body, mat: [0.5, 0.35, PAT.chitin, 0] };
      }
    });
    /* the lantern's light: a glow on the last rings, flashing on the shared beat */
    const S = g.userData.rig.S, lamp = new T.Group(), hz = o.hz || 2.4, off = o.lone ? Math.random() : 0.02 * Math.random();
    const core = new T.Mesh(new T.SphereGeometry(0.0011, 12, 8), new T.MeshBasicMaterial({ color: new T.Color('#d8ff70'), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    const halo = new T.Sprite(new T.SpriteMaterial({ map: (() => { const cv = M.canvas(64, 64), x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(220,255,120,1)'); gr.addColorStop(0.25, 'rgba(180,255,80,0.45)'); gr.addColorStop(1, 'rgba(120,200,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(cv); return t; })(), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.014); lamp.add(core, halo); lamp.position.copy(S.head.ab3).sub(S.head.ab3).add(new T.Vector3(-0.0004, -0.0002, 0));
    S.by.ab3.add(lamp);
    const clock = { t: null }, a0 = g.userData.anim;
    const flash = t => { const f = ((t * hz + off) % 1 + 1) % 1; return sst(0.0, 0.05, f) * Math.exp(-f * 11); };
    core.onBeforeRender = () => { const k = flash(clock.t ?? Mats.U.uTime.value); core.material.opacity = 0.15 + 0.85 * k; halo.material.opacity = k; };
    g.userData.anim = (t, fl) => { clock.t = t; a0(t, fl); };
    return g;
  });
})();
