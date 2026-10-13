/* wild/swiftlet — an edible-nest swiftlet (Aerodramus fuciphagus) of the island's sea caves, the bird whose nests of
   spittle are gathered: 12 cm long, a little over a quarter of a metre across the long scythe of its wings; dull
   dark brown above, greyer below, the rump a shade paler; a short, slightly forked tail; a flat head with a tiny bill
   and a wide gape; feet so small it never perches — it clings to rock. It lives on the wing, flickering and sailing,
   banking hard after insects. o.clip: fly (also idle), glide, bank (a hard turn, the wings tilted, the tail twisted),
   flicker (a burst of quick shallow beats), cling (on a cave wall, the body upright, the wings crossed over the tail),
   takeoff (dropping from the wall into flight), preen. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/swiftlet', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R;
    const C = { back: lin('#29241f'), under: lin('#3a352f'), rump: lin('#443e37'), wing: lin('#26221f'), bill: lin('#151312'), iris: lin('#120d0a'), foot: lin('#5a4a40') };
    const ridge = [[0.0655, 0.0436], [0.0688, 0.0432], [0.0716, 0.0422], [0.0736, 0.0406]], edge = [[0.0655, 0.0398], [0.0688, 0.0399], [0.0716, 0.04], [0.0736, 0.0406]];
    const lowTop = [[0.0655, 0.0401], [0.0686, 0.0401], [0.0712, 0.0402], [0.0726, 0.0404]], lowBot = [[0.0655, 0.0376], [0.0686, 0.0382], [0.0712, 0.0393], [0.0726, 0.0404]];
    return Bird.build(o, {
      name: 'swiftlet', size: 0.14, dihedral: 0.04, gape: 0.7, tuck: 'back', cell: 0.0006, feather: 0.0016,
      body: { c: [0.0, 0.03], r: [0.04, 0.0158, 0.0168] },
      neck: { pts: [[0.03, 0.035], [0.041, 0.038], [0.05, 0.0405]], r: [0.0128, 0.0112] },
      head: { c: [0.057, 0.0412], r: [0.0118, 0.0098, 0.0112], fwd: [1, -0.05, 0], cell: 0.00025,
        shapes: () => [{ ell: [0.064, 0.0405, 0], r: [0.0055, 0.005, 0.0062], bone: 'head', tag: 'lore', k: 0.002 }] },
      bill: { tip: [0.0736, 0.0406, 0], gape: [0.0652, 0.0398] },
      beak: {
        upper: { top: ridge, bot: edge, round: 2, palate: 0.3, ns: 24, nr: 24, w: s => 0.0042 * (1 - 0.4 * s) * Math.pow(Math.max(0, 1 - s), 0.6) + 0.0001 },
        lower: { top: lowTop, bot: lowBot, round: 2, floor: 0.3, ns: 20, nr: 24, w: s => 0.004 * (1 - 0.4 * s) * Math.pow(Math.max(0, 1 - s), 0.55) + 0.0001 } },
      eye: { at: [0.0615, 0.0438, 0.0083], r: 0.0027, ax: [0.45, 0.1, 0.89], col: C.iris, iris: 0.78, pupil: 0.45, white: 0.06, lid: C.back },
      wing: { sh: [0.02, 0.037, 0.012], arm: 0.012, fore: 0.018, hand: 0.03, lead: [0.0042, 0.0034, 0.0026], panel: [0.009, 0.008, 0.007], panelT: 0.0012,
        prim: { n: 10, len: 0.098, w: 0.0112, emarg: 0, lens: f => 0.4 + 0.6 * Math.pow(Math.min(1, f * 1.08), 0.8) }, sec: { n: 8, len: 0.027, w: 0.0115 }, tert: 2, cov: 0.55, scap: 4, fold: { droop: [0.2, 0.06], reach: 1.1 } },
      tail: { at: [-0.037, 0.03], n: 10, len: 0.044, w: 0.026, fan: 0.3, shape: f => 0.92 + 0.14 * f },
      leg: { hip: [0.0, 0.022, 0.006], knee: [0.004, 0.016], ankle: [0.002, 0.009], foot: [0.004, 0.003], toe: [0.0055, 0.0065, 0.006], hallux: 0.0048, r: 0.0011, claw: 0.0019, spread: 0.4, scale: 0.0005, feathered: true, cell: 0.00015 },
      perch: { pitch: 1.35, dy: 0.0, footX: 0.012, curl: 0.8, tail: -0.1 },
      flap: { hz: 11, amp: 0.62 },
      paint: {
        body: (x, y, z, nx, ny, nz, tg, FEATH) => {
          const up = sst(-0.25, 0.35, ny), rump = sst(-0.012, -0.03, x) * up;
          return { col: mix(mix(C.under, C.back, up), C.rump, rump * 0.6).map(v => v * (0.95 + 0.08 * M.vn(x * 900, y * 900, z * 900))), mat: FEATH, fur: 0 };
        },
        head: (x, y, z, nx, ny, nz) => ({ col: mix(C.under, C.back, sst(-0.3, 0.3, ny)), mat: [0.72, 0.03, PAT.feather, 0], fur: 0 }),
        beak: (x, y, z, s, u, outer) => ({ col: outer ? C.bill : lin('#6a4a44'), mat: [0.35, 0.4, outer ? PAT.horn : PAT.skin, 0] }),
        feather: (kind, i, s, c, top) => kind === 'tail' ? mix(C.back, C.wing, 0.3) : top ? mix(C.wing, C.back, 0.2 * (1 - s)) : mix(C.wing, C.under, 0.35),
        leg: C.foot, claw: lin('#1a1512')
      },
      more: (clips, K) => {
        const { R, V, qE, wing, tailPose, legTo, legsUp, look, face, FWD, flapHz, TAU } = K, { sst, wave } = R;
        /* flying: bursts of quick shallow beats between long sailing glides, the wings swept back as it sails */
        const beatOr = (t) => { const per = 1.5, c = t % per; return c < 0.55 ? 1 : 0; };
        clips.fly = ((fly0) => (P, t, k) => {
          if (beatOr(t)) { fly0(P, t, k); return; }
          P.set('body', 0.06 * wave(t, 2, 1.4), 0, 0.03);
          for (const s of [-1, 1]) wing(P, s, { f: 0.04, lift: 0.05, sweep: -0.12, hand: 0.1, fan: 0.15 });
          tailPose(P, 0.02, 0.2); legsUp(P); look(P, FWD.clone().add(V(0, -0.05, 0.15 * wave(t, 5, 1.2))), 0.7); face(P, t);
        })(clips.fly);
        clips.idle = clips.fly;
        clips.flicker = (P, t) => {
          const ph = t * flapHz * 1.3, c = Math.cos(TAU * ph), sn = Math.sin(TAU * ph);
          P.set('body', 0, 0, 0.05);
          for (const s of [-1, 1]) wing(P, s, { f: 0.1, lift: 0.35 * c + 0.05, sweep: -0.1 + 0.05 * sn, fan: 0.2 });
          tailPose(P, 0, 0.3); legsUp(P); look(P, FWD, 0.7); face(P, t);
        };
        /* a hard turn: rolled over, the inner wing high, the tail twisted and spread */
        clips.bank = (P, t) => {
          const sd = Math.sin(t * 0.9) > 0 ? 1 : -1, r = 0.9 * sd;
          P.set('body', r, 0.15 * sd, 0.08);
          for (const s of [-1, 1]) wing(P, s, { f: 0.08, lift: 0.08 + 0.12 * s * sd, sweep: -0.2, fan: 0.3, twist: 0.12 * s * sd });
          tailPose(P, 0.05, 0.9, 0.3 * sd); legsUp(P); look(P, V(0.8, -0.1, -0.5 * sd), 0.9); face(P, t);
        };
        /* clinging to the rock: upright, the belly to the wall, the tiny feet hooked in, the long wings crossed */
        clips.cling = (P, t) => {
          P.set('body', 0, 0, 1.45); P.off.set(0, 0.012, 0);
          const wb = P.world('body');
          for (const s of [-1, 1]) legTo(P, s, V(wb.x + 0.022, wb.y - 0.006, s * 0.007), 0.9, qE(0, 0, 1.4));
          for (const s of [-1, 1]) wing(P, s, { f: 1, lift: 0.02 });
          tailPose(P, -0.15, 0.6); look(P, V(0.3, 1, 0.4 * wave(t, 4, 0.5)), 1); face(P, t);
        };
        clips.perch = clips.cling;
        /* dropping off the wall into flight: falling free, the wings opening, then beating */
        clips.takeoff = (P, t) => {
          const c = (t % 1.2) / 1.2, go = sst(0.1, 0.45, c);
          if (c > 0.45) { clips.flicker(P, t); return; }
          clips.cling(P, t); P.set('body', 0, 0, 1.45 - 1.3 * go); P.off.y -= 0.05 * go;
          for (const s of [-1, 1]) wing(P, s, { f: 1 - 0.85 * go, lift: 0.5 * go, fan: go });
        };
      }
    });
  });
})();
