/* wild/megapode — a Tabon scrubfowl (Megapodius cumingii), the island's mound-builder: a dark ground bird about 35 cm
   long, plump as a hen, olive-brown above and grey-brown below, a short bushy crest, bare red skin round the eye, a
   short stout bill, a short drooping tail, and big dark legs and feet with strong claws that rake up the great heaps
   of earth and leaves its eggs are buried in. o.clip: stand (also idle, perch), walk, run, scratch (raking the litter
   back, one foot then the other, the body tipped forward), peck, alert (the neck stretched up, the crest raised),
   fly (a whirring burst), glide, takeoff, land, preen, call. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/megapode', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R;
    const C = { back: lin('#352e24'), olive: lin('#3b372a'), under: lin('#45403a'), grey: lin('#484641'), crest: lin('#3a2d20'), face: lin('#a8382a'), leg: lin('#2b2622'), bill: lin('#6b5c4a'), billT: lin('#8a7a62'), iris: lin('#4a2e18'), dark: lin('#2e2a24') };
    const ridge = [[0.15, 0.3025], [0.16, 0.302], [0.169, 0.3003], [0.1765, 0.2975], [0.1815, 0.2938], [0.1832, 0.2905]];
    const edge = [[0.15, 0.2912], [0.16, 0.2908], [0.169, 0.2905], [0.1765, 0.2906], [0.1815, 0.2908], [0.1832, 0.2905]];
    const lowTop = [[0.15, 0.2918], [0.16, 0.2914], [0.168, 0.291], [0.175, 0.2908], [0.1785, 0.2908]];
    const lowBot = [[0.15, 0.2848], [0.16, 0.2856], [0.168, 0.2872], [0.175, 0.2893], [0.1785, 0.2908]];
    return Bird.build(o, {
      name: 'megapode', size: 0.6, dihedral: 0.08, gape: 0.4, tuck: 'back', cell: 0.0018, feather: 0.0075,
      body: { c: [0.0, 0.2], r: [0.1, 0.072, 0.068] },
      neck: { pts: [[0.075, 0.232], [0.103, 0.258], [0.126, 0.284]], r: [0.042, 0.026], lift: 0.25 },
      head: { c: [0.139, 0.296], r: [0.0235, 0.0195, 0.0175], fwd: [1, -0.05, 0], cell: 0.0007,
        shapes: () => [
          /* (the short bushy crest at the back of the crown) */
          { ell: [0.121, 0.311, 0], r: [0.02, 0.0085, 0.0095], rot: [0, 0, 0.5], bone: 'head', tag: 'crest', k: 0.01 },
          { ell: [0.15, 0.297, 0], r: [0.009, 0.009, 0.0095], bone: 'head', tag: 'lore', k: 0.004 }] },
      bill: { tip: [0.1832, 0.2905, 0], gape: [0.149, 0.2912] },
      beak: {
        upper: { top: ridge, bot: edge, round: 2, palate: 0.35, w: s => 0.0068 * (1 - 0.3 * s) * Math.pow(Math.max(0, 1 - s), 0.5) + 0.0002 },
        lower: { top: lowTop, bot: lowBot, round: 2, floor: 0.3, w: s => 0.0062 * (1 - 0.3 * s) * Math.pow(Math.max(0, 1 - s), 0.5) + 0.0002 } },
      eye: { at: [0.1465, 0.3025, 0.0138], r: 0.0052, ax: [0.3, 0.1, 0.95], col: C.iris, iris: 0.72, pupil: 0.32, white: 0.08, lid: C.face },
      wing: { sh: [0.05, 0.24, 0.05], arm: 0.075, fore: 0.085, hand: 0.05, lead: [0.013, 0.01, 0.007], panel: [0.03, 0.026, 0.018], panelT: 0.004,
        prim: { n: 10, len: 0.15, w: 0.045, emarg: 0.1, lens: f => 0.78 + 0.22 * Math.sin(Math.PI * 0.5 * Math.min(1, f * 1.3)) }, sec: { n: 12, len: 0.12, w: 0.046 }, tert: 3, cov: 0.45, scap: 6, fold: { droop: [0.5, 0.2] } },
      tail: { at: [-0.094, 0.21], n: 14, len: 0.08, w: 0.08, fan: 0.36, shape: f => 1 - 0.18 * f * f },
      leg: { hip: [0.0, 0.17, 0.034], knee: [0.022, 0.136], ankle: [-0.004, 0.064], foot: [0.012, 0.008], toe: [0.05, 0.058, 0.048], hallux: 0.034, r: 0.0064, claw: 0.012, spread: 0.52, scale: 0.0026, feathered: true, cell: 0.0007 },
      perch: { pitch: 0.18, dy: -0.006, footX: 0.012, curl: 0, tail: 0.25, gaze: 0, stance: 0.9 },
      walk: { hz: 1.7, stride: 0.95, lift: 0.32, headBob: 0.45 },
      run: { hz: 3.4, stride: 1.7 },
      flap: { hz: 7.5, amp: 0.95 },
      paint: {
        body: (x, y, z, nx, ny, nz, tg, FEATH) => {
          const up = sst(-0.3, 0.4, ny), col = mix(C.under, mix(C.olive, C.back, sst(0.0, -0.08, x)), up).map(v => v * (0.94 + 0.1 * M.vn(x * 250, y * 250, z * 250)));
          if ((tg.thigh || 0) > 0.5) return { col: C.under, mat: FEATH, fur: 0 };
          return { col: x > 0.06 ? mix(col, C.grey, sst(0.06, 0.1, x)) : col, mat: FEATH, fur: 0 };
        },
        head: (x, y, z, nx, ny, nz, tg) => {
          /* (bare red skin round the eye and back from the bill; the crest browner) */
          const face = Math.abs(z) > 0.006 ? sst(0.0085, 0.0055, Math.hypot(x - 0.147, (y - 0.3015) * 1.2)) : 0;
          const col = (tg.crest || 0) > 0.5 ? C.crest : C.grey;
          return { col: mix(col, C.face, face), mat: face > 0.5 ? [0.5, 0.2, PAT.skin, 0] : [0.74, 0.03, PAT.feather, 0], fur: 0 };
        },
        beak: (x, y, z, s, u, outer) => outer ? { col: mix(C.bill, C.billT, sst(0.6, 1, s)), mat: [0.38, 0.35, PAT.horn, 0] } : { col: lin('#6a4a40'), mat: [0.5, 0.2, PAT.skin, 0] },
        feather: (kind, i, s, c, top) => {
          if (kind === 'tail') return mix(C.dark, C.back, top ? 0.5 : 0.2);
          if (kind === 'prim' || kind === 'sec') return top ? mix(C.back, C.dark, 0.3 + 0.3 * c) : C.under;
          return top ? C.olive : C.under;
        },
        leg: C.leg, claw: lin('#1a1714')
      },
      more: (clips, K) => {
        const { R, V, qE, wing, tailPose, legTo, look, face, perchBody, FWD, LIFT, TAU } = K, { sst, wave } = R;
        clips.stand = clips.perch;
        /* raking: the body tipped forward, one foot set forward and dragged hard back through the litter, kicking it
           behind, then the other; the head down, watching the ground */
        clips.scratch = (P, t) => {
          perchBody(P, t, -0.12, 0.4);
          const per = 0.55, c = (t % (2 * per)) / per, sd = c < 1 ? 1 : -1, u = c % 1;
          const reach = u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7, rake = u >= 0.3 ? sst(0.3, 0.55, u) : 0;
          const x = 0.012 + 0.07 * reach - 0.09 * rake * (1 - sst(0.6, 1, u)), y = u < 0.3 ? 0.03 * Math.sin(Math.PI * u / 0.3) : 0.002 + 0.025 * sst(0.55, 0.8, u) * (1 - sst(0.8, 1, u));
          legTo(P, sd, V(x, 0.008 + y, sd * 0.032), u < 0.3 ? 0.5 : 0.15, qE(0, 0, -0.4 * rake));
          look(P, V(0.6, -0.7, 0.2 * Math.sin(t * 0.7)), 1, LIFT - 0.15); face(P, t);
          tailPose(P, -0.15, 0.4);
          for (const s of [-1, 1]) wing(P, s, { f: 0.92, lift: 0.08 * Math.sin(t * 9) * rake });
        };
        /* a peck at the ground: the head down fast, a jab or two, and up */
        clips.peck = (P, t) => {
          perchBody(P, t, 0.0, 0.2);
          const c = (t % 1.6) / 1.6, d = sst(0.1, 0.2, c) * (1 - sst(0.55, 0.7, c)), jab = d * Math.max(0, Math.sin((c - 0.2) * 40));
          look(P, V(0.6, -0.4 - 0.9 * d, 0), 1, LIFT - 0.6 * d - 0.15 * jab); face(P, t, 0.1 * jab);
        };
        /* alert: the neck stretched up tall, the crest up, the head turned quickly one way and the other */
        clips.alert = (P, t) => {
          perchBody(P, t, 0.45, -0.3);
          const k = Math.floor(t / 0.8);
          look(P, V(0.8, 0.15, 0.6 * Math.sin(k * 2.1)), 1, LIFT + 0.5); face(P, t);
          tailPose(P, -0.1, 0.5);
        };
      }
    });
  });
})();
