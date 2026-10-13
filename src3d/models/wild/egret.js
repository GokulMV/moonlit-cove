/* wild/egret — a little egret (Egretta garzetta) of the island's mud and shallows, in breeding dress: about 60 cm long
   and a metre across the wings, all white; the long neck carried in an S, the bill a black dagger, the bare lores
   yellow-green, the eye yellow; the legs long and black, the feet yellow ("golden slippers"); two long plumes from the
   nape and a spray of fine aigrettes down the back past the tail. It stalks the shallows, strikes like a spring,
   stirs the mud with a foot, and flies with its neck drawn back and its legs trailed behind. o.clip: stand (also
   idle, perch), walk, stalk (slow steps and long stillness, neck out and low, watching), strike, stir (one foot
   shaken in the mud), preen, call, fly, glide, takeoff, land, run. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/egret', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R;
    const C = { white: lin('#e6e5df'), shade: lin('#cfcdc4'), bill: lin('#1a1a1b'), lore: lin('#b8b452'), iris: lin('#d9be3a'), leg: lin('#161616'), foot: lin('#c9b33a'), mouth: lin('#7a5a52') };
    /* the bill: long, slender and straight to a sharp point */
    const ridge = [[0.221, 0.5525], [0.238, 0.5518], [0.256, 0.5503], [0.274, 0.5482], [0.29, 0.5458], [0.303, 0.5432]];
    const edge = [[0.221, 0.5442], [0.238, 0.5439], [0.256, 0.5434], [0.274, 0.5428], [0.29, 0.5424], [0.303, 0.5432]];
    const lowTop = [[0.221, 0.545], [0.238, 0.5447], [0.256, 0.5441], [0.274, 0.5434], [0.29, 0.5428], [0.299, 0.5428]];
    const lowBot = [[0.221, 0.5385], [0.238, 0.539], [0.256, 0.5398], [0.274, 0.5408], [0.29, 0.542], [0.299, 0.5428]];
    const NAPE = [0.196, 0.5555];
    return Bird.build(o, {
      name: 'egret', size: 0.75, dihedral: 0.06, gape: 0.5, tuck: 'trail', cell: 0.0018, feather: 0.0052,
      body: { c: [0.0, 0.33], r: [0.105, 0.05, 0.048] },
      neck: { pts: [[0.085, 0.35], [0.12, 0.385], [0.14, 0.43], [0.148, 0.475], [0.165, 0.515], [0.194, 0.54]], r: [0.022, 0.0098], lift: 0.85, flyLift: 1.5 },
      head: { c: [0.207, 0.5485], r: [0.0215, 0.0145, 0.0128], fwd: [1, -0.06, 0], cell: 0.0006,
        shapes: () => [
          { ell: [0.218, 0.548, 0], r: [0.009, 0.0085, 0.0085], bone: 'head', tag: 'lore', k: 0.004 },
          { ell: [0.204, 0.5418, 0], r: [0.016, 0.006, 0.009], bone: 'head', tag: 'chin', k: 0.005 }] },
      bill: { tip: [0.303, 0.5432, 0], gape: [0.219, 0.5442] },
      beak: {
        upper: { top: ridge, bot: edge, round: 1.6, palate: 0.3, w: s => 0.0058 * (1 - 0.35 * s) * Math.pow(Math.max(0, 1 - s), 0.55) + 0.00015 },
        lower: { top: lowTop, bot: lowBot, round: 1.6, floor: 0.3, w: s => 0.0053 * (1 - 0.3 * s) * Math.pow(Math.max(0, 1 - s), 0.5) + 0.00015 } },
      eye: { at: [0.2155, 0.5515, 0.0105], r: 0.0042, ax: [0.4, 0.12, 0.91], col: C.iris, iris: 0.86, pupil: 0.36, white: 0.2, lid: C.lore },
      wing: { sh: [0.05, 0.36, 0.044], arm: 0.105, fore: 0.125, hand: 0.07, lead: [0.013, 0.01, 0.007], panel: [0.035, 0.03, 0.02], panelT: 0.004,
        prim: { n: 10, len: 0.21, w: 0.055, emarg: 0.2 }, sec: { n: 14, len: 0.16, w: 0.055 }, tert: 4, cov: 0.4, scap: 7 },
      tail: { at: [-0.098, 0.33], n: 12, len: 0.095, w: 0.09, fan: 0.3, shape: f => 1 - 0.08 * f * f },
      leg: { hip: [0.0, 0.31, 0.026], knee: [0.018, 0.276], ankle: [-0.004, 0.126], foot: [0.012, 0.008], toe: [0.052, 0.062, 0.05], hallux: 0.033, r: 0.0031, claw: 0.0055, spread: 0.5, scale: 0.0014, feathered: false, cell: 0.0006 },
      perch: { pitch: 0.55, dy: -0.012, footX: 0.01, curl: 0, tail: 0.1, gaze: -0.05, stance: 0.9 },
      walk: { hz: 0.85, stride: 1.25, lift: 0.3, headBob: 0.3 },
      flap: { hz: 3.1, amp: 0.8 },
      paint: {
        body: (x, y, z, nx, ny, nz, tg, FEATH) => {
          if ((tg.shank || 0) > 0.5) return { col: C.leg, mat: [0.5, 0.2, PAT.scale, 0], fur: 0 };
          return { col: mix(C.white, C.shade, 0.25 * sst(0.0, -0.8, ny)).map(v => v * (0.97 + 0.05 * M.vn(x * 300, y * 300, z * 300))), mat: FEATH, fur: 0 };
        },
        head: (x, y, z, nx, ny, nz, tg) => {
          /* (the bare lores: from the bill's base back round the eye) */
          const lore = x > 0.209 && Math.abs(z) > 0.0045 ? sst(0.0058, 0.0035, Math.hypot((y - 0.5515) * 1.15, (x - Math.min(Math.max(x, 0.214), 0.222)) * 0.8)) : 0;
          return { col: mix(C.white, C.lore, lore), mat: lore > 0.5 ? [0.5, 0.2, PAT.skin, 0] : [0.72, 0.03, PAT.feather, 0], fur: 0 };
        },
        beak: (x, y, z, s, u, outer) => outer ? { col: mix(lin('#2a2a26'), C.bill, sst(0.0, 0.25, s)), mat: [0.28, 0.5, PAT.horn, 0] } : { col: C.mouth, mat: [0.5, 0.2, PAT.skin, 0] },
        feather: (kind, i, s, c, top) => mix(C.white, C.shade, top ? 0.05 : 0.3),
        leg: (x, y, z) => y < 0.012 ? C.foot : mix(C.foot, C.leg, sst(0.012, 0.03, y)), claw: lin('#2a2a22')
      },
      /* the plumes: two long ones from the nape, and the aigrettes from the back, fine and lacy, curled up at their ends */
      parts: (S) => {
        const nape = [-1, 1].map(s => ({ p: [NAPE[0], NAPE[1], s * 0.0025], d: [-0.105, -0.012, s * 0.006], bend: [0.004, -0.02, 0], r: 0.0007 }));
        const back = [];
        for (let i = 0; i < 44; i++) {
          const s = i % 2 ? 1 : -1, f = Math.floor(i / 2) / 21, h = M.rng(77 + i)();
          back.push({ p: [0.05 - 0.07 * f, 0.374 - 0.004 * f, s * (0.006 + 0.022 * h)], d: [-0.2 - 0.04 * h, -0.025 - 0.01 * f, s * (0.012 + 0.03 * h)], bend: [0, 0.018 + 0.012 * h, s * 0.004], r: 0.00045 });
        }
        /* (the nape plumes bound from the head at their roots to the neck toward their tips, so they lie along it) */
        const nb = (x, y, z) => { const f = Math.min(1, Math.hypot(x - NAPE[0], y - NAPE[1]) / 0.1); return [[S.ix.head, 1 - f], [S.ix.n4, f]]; };
        return [R.strands(nape, nb, () => C.white, { m: 4, n: 10, mat: [0.6, 0.05, PAT.feather, 0.3] }),
          R.strands(back, R.rigid(S, 'body'), (s) => mix(C.white, C.shade, 0.15 * s), { m: 3, n: 12, mat: [0.6, 0.05, PAT.feather, 0.4] })];
      },
      more: (clips, K) => {
        const { R, V, qE, wing, tailPose, legTo, look, face, perchBody, stepping, FWD, LIFT, TAU } = K, { sst, wave } = R;
        clips.stand = clips.perch;
        /* stalking: a slow step, then a long stillness, the neck out and low, the eye on the water */
        clips.stalk = (P, t) => {
          const per = 2.6, c = (t % per) / per, k = Math.floor(t / per), go = c < 0.38 ? c / 0.38 : 1;
          stepping(P, (k + 0.5 * go) / 0.5, { hz: 0.5, stride: 1.1, lift: 0.35, pitch: 0.1, headBob: 0, gaze: -0.32 });
          look(P, FWD.clone().add(V(0, -0.38, 0.1 * Math.sin(k * 1.9))), 1, LIFT - 0.35);
        };
        /* the strike: the neck drawn back in a tight S, then shot out straight, the bill into the water, and back */
        clips.strike = (P, t) => {
          perchBody(P, t, 0.75);
          const c = (t % 2.4) / 2.4, coil = sst(0.0, 0.35, c) * (1 - sst(0.4, 0.46, c)), shot = sst(0.4, 0.47, c) * (1 - sst(0.62, 0.9, c));
          look(P, V(0.7, -0.35 - 0.75 * shot, 0), 1, LIFT + 0.6 * coil - 1.1 * shot); face(P, t, 0.05 * shot);
          for (const s of [-1, 1]) wing(P, s, { f: 1 - 0.08 * shot, lift: 0.08 * shot });
        };
        /* stirring: one foot set forward in the mud and shaken, quick and fine, the head down watching it */
        clips.stir = (P, t) => {
          perchBody(P, t, 0.7);
          const sh = Math.sin(t * 38) * (0.5 + 0.5 * Math.sin(t * 1.3)), sd = Math.floor(t / 3) % 2 ? 1 : -1;
          legTo(P, sd, V(0.07, 0.008 + 0.003 * Math.abs(sh), sd * 0.024 + 0.002 * sh), 0.1, qE(0, 0.06 * sh, 0));
          look(P, V(0.5, -0.8, -sd * 0.15), 1, LIFT - 0.2); face(P, t);
        };
      }
    });
  });
})();
