/* wild/kingfisher — a stork-billed kingfisher (Pelargopsis capensis), the big kingfisher of the island's mangroves and
   creeks: about 35 cm long, a third of it the huge red bill; the cap dusky brown, the face, collar and all beneath
   warm ochre, the back and wings blue-green, the rump bright pale blue, the tail blue; red feet, tiny. It sits still
   over the water, bobbing its head and flicking its tail, and plunges for fish. o.clip: perch (also idle), bob (head
   bobs, tail flicks), call, scan (the head turned down and about, watching the water), dive (the plunge: the body
   tipped head down, wings drawn back), fly, glide, takeoff, land, beat (a catch knocked against the branch), preen. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/kingfisher', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R;
    const C = { cap: lin('#4f4436'), ochre: lin('#b4763c'), ochreL: lin('#c4894c'), back: lin('#2e6670'), wing: lin('#2c6a78'), rump: lin('#58a9c6'), tail: lin('#33819c'), dark: lin('#1d2d33'),
      bill: lin('#9e1c16'), billT: lin('#5a1410'), foot: lin('#b8382a'), iris: lin('#2a1a10'), mouth: lin('#d0605a') };
    /* the bill: long, deep and straight, the ridge keeled, the tip just turned down */
    const ridge = [[0.126, 0.118], [0.14, 0.1175], [0.156, 0.1155], [0.172, 0.1125], [0.188, 0.1085], [0.202, 0.104], [0.212, 0.0998], [0.2185, 0.0958]];
    const edge = [[0.126, 0.0998], [0.14, 0.0996], [0.156, 0.0994], [0.172, 0.0992], [0.188, 0.0988], [0.202, 0.0982], [0.212, 0.0975], [0.2185, 0.0958]];
    const lowTop = [[0.126, 0.1008], [0.14, 0.1007], [0.156, 0.1005], [0.172, 0.1002], [0.188, 0.0997], [0.2, 0.0988], [0.209, 0.0978]];
    const lowBot = [[0.126, 0.0865], [0.14, 0.0872], [0.156, 0.0892], [0.172, 0.0917], [0.188, 0.0943], [0.2, 0.0965], [0.209, 0.0978]];
    return Bird.build(o, {
      name: 'kingfisher', size: 0.42, dihedral: 0.05, gape: 0.45, tuck: 'back', cell: 0.0012, feather: 0.0042,
      body: { c: [0.0, 0.074], r: [0.074, 0.04, 0.038] },
      neck: { pts: [[0.05, 0.084], [0.076, 0.093], [0.098, 0.1]], r: [0.036, 0.031], lift: 0.15 },
      head: { c: [0.108, 0.105], r: [0.036, 0.031, 0.028], fwd: [1, -0.04, 0], cell: 0.0006,
        shapes: () => [
          /* (the big flat-crowned head running forward into the bill; the cheeks; the throat) */
          { ell: [0.122, 0.109, 0], r: [0.016, 0.0125, 0.0135], bone: 'head', tag: 'lore', k: 0.006 },
          ...[-1, 1].map(s => ({ ell: [0.113, 0.098, s * 0.013], r: [0.018, 0.011, 0.01], bone: 'head', tag: 'cheek', k: 0.006 })),
          { ell: [0.108, 0.09, 0], r: [0.022, 0.012, 0.016], bone: 'head', tag: 'chin', k: 0.008 }] },
      bill: { tip: [0.2185, 0.0958, 0], gape: [0.125, 0.0998] },
      beak: {
        upper: { top: ridge, bot: edge, round: 1.45, palate: 0.35, w: s => 0.0102 * (1 - 0.45 * s) * Math.pow(Math.max(0, 1 - s), 0.55) + 0.0002 },
        lower: { top: lowTop, bot: lowBot, round: 1.5, floor: 0.3, w: s => 0.0095 * (1 - 0.4 * s) * Math.pow(Math.max(0, 1 - s), 0.5) + 0.0002 } },
      eye: { at: [0.1225, 0.1125, 0.0195], r: 0.0056, ax: [0.25, 0.08, 0.96], col: C.iris, iris: 0.7, pupil: 0.34, white: 0.08, lid: C.cap },
      wing: { sh: [0.03, 0.092, 0.03], arm: 0.045, fore: 0.056, hand: 0.034, lead: [0.0085, 0.0068, 0.005], panel: [0.02, 0.017, 0.012], panelT: 0.0026,
        prim: { n: 10, len: 0.112, w: 0.027, emarg: 0.15 }, sec: { n: 11, len: 0.085, w: 0.026 }, tert: 3, cov: 0.45, scap: 6 },
      tail: { at: [-0.062, 0.074], n: 12, len: 0.092, w: 0.05, fan: 0.24, shape: f => 1 - 0.12 * f * f },
      leg: { hip: [0.0, 0.056, 0.014], knee: [0.008, 0.04], ankle: [0.004, 0.022], foot: [0.01, 0.005], toe: [0.016, 0.02, 0.017], hallux: 0.011, r: 0.0034, claw: 0.0045, spread: 0.32, scale: 0.0011, feathered: false, cell: 0.00035 },
      perch: { pitch: 1.1, dy: -0.004, footX: 0.012, curl: 0.85, tail: 0.1, gaze: -0.18, crouch: 0.012 },
      flap: { hz: 8.5, amp: 0.95 },
      paint: {
        body: (x, y, z, nx, ny, nz, tg, FEATH) => {
          /* (blue-green above, ochre below; the rump pale blue, the wings' leading edges darker) */
          const arm = (tg.arm || 0) + (tg.panel || 0), up = sst(-0.15, 0.35, ny), rump = sst(-0.02, -0.05, x) * sst(0.2, 0.6, ny);
          let col = arm > 0.5 ? mix(C.ochre, C.wing, sst(-0.3, 0.1, ny)) : mix(C.ochre, C.back, up * sst(0.07, 0.045, x));
          if (arm <= 0.5) { col = mix(col, C.rump, rump); if (x > 0.062) col = mix(C.ochre, C.ochreL, sst(-0.2, 0.3, ny)); }
          if ((tg.thigh || 0) > 0.5) col = C.ochre;
          if ((tg.shank || 0) > 0.5) return { col: C.foot, mat: [0.5, 0.15, PAT.scale, 0], fur: 0 };
          return { col: col.map(v => v * (0.95 + 0.08 * M.vn(x * 400, y * 400, z * 400))), mat: arm > 0.5 ? [0.66, 0.06, PAT.feather, 0] : FEATH, fur: 0 };
        },
        head: (x, y, z, nx, ny, nz, tg) => {
          /* (the dusky cap from the bill's base back over the crown and down to the eye; the face and collar ochre) */
          const capLine = 0.111 - 0.12 * (0.122 - x), cap = sst(capLine - 0.006, capLine + 0.005, y) * sst(0.0, 0.3, ny + 0.5);
          return { col: mix(C.ochreL, C.cap, Math.min(1, cap)).map(v => v * (0.95 + 0.08 * M.vn(x * 600, y * 600, z * 600))), mat: [0.72, 0.03, PAT.feather, 0], fur: 0 };
        },
        beak: (x, y, z, s, u, outer, lower) => outer ? { col: mix(C.bill, C.billT, sst(0.85, 1, s)), mat: [0.3, 0.5, PAT.horn, 0] } : { col: C.mouth, mat: [0.5, 0.2, PAT.skin, 0] },
        feather: (kind, i, s, c, top, f) => {
          if (kind === 'tail') return top ? mix(C.tail, C.dark, 0.25 * sst(0.7, 1, s)) : mix(C.tail, C.dark, 0.45);
          if (kind === 'cov') return top ? C.wing : C.ochre;
          if (kind === 'tert') return top ? C.back : C.dark;
          /* (the flight feathers blue-green on their outer webs, blackish within and beneath) */
          return top ? mix(C.wing, C.dark, 0.25 + 0.5 * c + 0.2 * sst(0.7, 1, s)) : mix(C.dark, C.wing, 0.15);
        },
        leg: C.foot, claw: lin('#1c1410')
      },
      more: (clips, K) => {
        const { R, V, wing, tailPose, legTo, legsUp, look, face, perchBody, FWD, flapHz, TAU } = K, { sst, wave } = R;
        /* the bob: the head pumped down and up, the tail flicked up and slowly lowered */
        clips.bob = (P, t) => {
          perchBody(P, t);
          const c = (t % 1.8) / 1.8, b = Math.sin(Math.PI * sst(0.05, 0.25, c)), fl = sst(0.05, 0.12, c) * (1 - sst(0.2, 0.6, c));
          look(P, FWD.clone().add(V(0, -0.18 - 0.35 * b, 0.25 * wave(t, 6, 0.4))), 1); tailPose(P, 0.1 - 0.7 * fl, 0.2 + 0.3 * fl); face(P, t);
        };
        /* watching the water below: the head turned down, now one way, now the other, quite still between */
        clips.scan = (P, t) => {
          perchBody(P, t);
          const k = Math.floor(t / 1.6), a = Math.sin(k * 2.3) * 0.5, d = -0.55 - 0.2 * Math.cos(k * 1.7);
          look(P, V(0.9, d, a), 1); face(P, t);
        };
        /* the plunge: from the perch the body tipped over head first, the wings drawn back, the bill a spear */
        clips.dive = (P, t) => {
          const c = (t % 1.4) / 1.4, tip = sst(0.0, 0.3, c);
          P.set('body', 0, 0, -1.25 * tip + 0.6 * (1 - tip)); P.off.set(0.05 * tip, -0.06 * tip, 0);
          for (const s of [-1, 1]) wing(P, s, { f: 0.35 + 0.45 * tip, lift: 0.55 * (1 - tip) - 0.1 * tip, sweep: -0.3 * tip, fan: 0.3 * (1 - tip) });
          legsUp(P, tip); tailPose(P, -0.1, 0.25); look(P, V(Math.cos(-1.35 * tip), Math.sin(-1.35 * tip), 0), 1); face(P, t, 0, 0.3 * tip);
        };
        /* a fish beaten against the branch: the head swung down hard and back up, again */
        clips.beat = (P, t) => {
          perchBody(P, t);
          const c = (t % 0.9) / 0.9, sw = Math.sin(TAU * c), hit = Math.max(0, sw);
          look(P, V(0.6, -0.2 - 0.9 * hit + 0.3 * Math.max(0, -sw), 0.5 * Math.sin(TAU * c * 0.5 + 1)), 1); face(P, t, 0.08);
        };
      }
    });
  });
})();
