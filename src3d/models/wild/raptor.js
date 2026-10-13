/* wild/eagle, wild/kite — the island's two raptors of the shore, built as they fly (wings spread, at the origin facing
   +x) and folded to perch.
   wild/eagle: a white-bellied sea eagle (Haliaeetus leucogaster), about 0.8 m long and 2 m across: white head, neck and
   underparts, grey back and upperwings, the flight feathers black (from beneath, the white coverts before a black
   trailing half), a short white wedge of a tail with a grey base; a heavy grey hooked bill, pale legs, black talons.
   It soars with its wings raised in a shallow V.
   wild/kite: a brahminy kite (Haliastur indus), about 0.48 m long and 1.2 m across: chestnut all over but for its white
   head and breast, finely streaked, and black wingtips; a rounded chestnut tail; a pale bill, yellow cere and feet.
   o.clip: perch (also idle), call, preen, fly, glide, soar, takeoff, land, snatch (low over the water, the feet thrown
   forward, talons open). */
(() => {
  const T = THREE, M = Models;
  const raptor = (o, kind) => {
    const R = Rig, { lin, mix, sst, PAT } = R, eagle = kind === 'eagle';
    const C = eagle ? { white: lin('#d9d8d2'), grey: lin('#6c7176'), greyD: lin('#565b60'), black: lin('#1c1d1f'), bill: lin('#646b73'), billT: lin('#26282c'), cere: lin('#8a9097'), leg: lin('#c4c3a6'), iris: lin('#3b2a1a'), mouth: lin('#8a6a64') }
      : { white: lin('#dcd8ce'), grey: lin('#6e3418'), greyD: lin('#582812'), black: lin('#1e1a17'), bill: lin('#c9c3a5'), billT: lin('#8f8a72'), cere: lin('#d6b84a'), leg: lin('#d8b845'), iris: lin('#4a3216'), rufous: lin('#7c3c1b'), mouth: lin('#9a6f62') };
    /* the hooked bill: the upper mandible between its ridge (the culmen, from the cere over the hook) and its cutting
       edge, the two meeting at the hook's point; the lower one tucked inside it, its tip under the hook */
    const ridge = [[0.278, 0.3905], [0.29, 0.3912], [0.302, 0.391], [0.314, 0.3893], [0.325, 0.3855], [0.334, 0.3785], [0.3405, 0.3685], [0.3428, 0.3575], [0.3405, 0.3495]];
    const edge = [[0.278, 0.3655], [0.29, 0.3652], [0.302, 0.365], [0.314, 0.3648], [0.323, 0.3638], [0.33, 0.3615], [0.3355, 0.3575], [0.3392, 0.3525], [0.3405, 0.3495]];
    const lowTop = [[0.278, 0.3675], [0.293, 0.3672], [0.308, 0.367], [0.32, 0.3662], [0.329, 0.3638], [0.3345, 0.3602]];
    const lowBot = [[0.278, 0.3545], [0.293, 0.3552], [0.308, 0.3566], [0.32, 0.3588], [0.329, 0.3606], [0.3345, 0.3602]];
    const CERE = 0.26, NOS = [0.2975, 0.3832];
    const g = Bird.build(o, {
      name: kind, size: 1, dihedral: eagle ? 0.2 : 0.06, gape: 0.4, tuck: 'back',
      body: { c: [0.0, 0.3], r: [0.17, 0.11, 0.11] },
      neck: { pts: [[0.12, 0.335], [0.175, 0.356], [0.222, 0.375]], r: [0.066, 0.043] },
      head: { c: [0.248, 0.386], r: [0.05, 0.039, 0.039], fwd: [1, -0.08, 0], cell: 0.001,
        shapes: () => [
          /* (the forehead sloping from the crown down into the bill) */
          { ell: [0.274, 0.398, 0], r: [0.026, 0.0115, 0.0175], rot: [0, 0, -0.3], bone: 'head', tag: 'fore', k: 0.012 },
          /* (the brow's shelf over each eye, that gives a raptor its glare; the lores before the eye narrowing into the
             bill; the cheeks down to the gape; the chin) */
          ...[-1, 1].map(s => ({ ell: [0.274, 0.398, s * 0.024], r: [0.017, 0.0048, 0.0095], rot: [s * 0.12, s * -0.35, -0.1], bone: 'head', tag: 'brow', k: 0.007 })),
          { ell: [0.279, 0.379, 0], r: [0.0145, 0.0165, 0.0165], bone: 'head', tag: 'lore', k: 0.008 },
          ...[-1, 1].map(s => ({ ell: [0.273, 0.369, s * 0.0185], r: [0.022, 0.0128, 0.0128], bone: 'head', tag: 'cheek', k: 0.008 })),
          { ell: [0.266, 0.36, 0], r: [0.03, 0.0158, 0.021], bone: 'head', tag: 'chin', k: 0.01 }] },
      bill: { tip: [0.3405, 0.3495, 0], gape: [0.282, 0.3655] },
      beak: {
        upper: { top: ridge, bot: edge, round: 1.85, palate: 0.4,
          w: s => 0.0128 * (1 - 0.35 * s) * Math.pow(Math.max(0, 1 - s), 0.45) * (1 + 0.06 * Math.exp(-Math.pow((s - CERE) / 0.025, 2))) + 0.0002,
          /* (the nostril, a slot in the cere) */
          shape: (p, s, u, outer) => { if (!outer || Math.abs(u) < 0.25) return; const d = Math.hypot((p.x - NOS[0]) / 0.0042, (p.y - NOS[1]) / 0.0022), b = Math.exp(-d * d * 1.6); p.z *= 1 - 0.22 * b; } },
        lower: { top: lowTop, bot: lowBot, round: 2, floor: 0.35, w: s => 0.0116 * (1 - 0.3 * s) * Math.pow(Math.max(0, 1 - s), 0.4) + 0.0002 } },
      eye: { at: [0.2728, 0.3902, 0.0262], r: 0.0092, ax: [0.5, 0.05, 0.86], col: C.iris, iris: 0.74, pupil: 0.3, white: 0.1, lid: C.greyD },
      wing: { sh: [0.08, 0.34, 0.085], arm: 0.17, fore: 0.2, hand: 0.11, lead: [0.026, 0.02, 0.014], panel: [0.06, 0.05, 0.035], panelT: 0.007,
        prim: { n: 10, len: 0.42, w: 0.1, emarg: 0.6, lens: f => 0.62 + 0.38 * Math.sin(Math.PI * 0.5 * Math.min(1, f * 1.25)) - 0.08 * Math.max(0, f - 0.85) / 0.15 }, sec: { n: 14, len: 0.3, w: 0.1 }, tert: 3, cov: 0.42 },
      tail: { at: [-0.17, 0.302], n: 12, len: eagle ? 0.26 : 0.27, w: eagle ? 0.2 : 0.22, fan: eagle ? 0.4 : 0.34, shape: eagle ? f => 1 - 0.32 * f : f => 1 - 0.1 * f * f },
      leg: { hip: [0.0, 0.25, 0.05], knee: [0.02, 0.2], ankle: [0.012, 0.11], foot: [0.026, 0.016], toe: [0.05, 0.062, 0.05], hallux: 0.046, r: 0.0112, claw: 0.028, spread: 0.55, scale: 0.005, feathered: true },
      perch: { pitch: 0.95, dy: -0.04, footX: 0.035, curl: 0.75, tail: 0.25 },
      flap: { hz: eagle ? 1.7 : 2.3, amp: 0.72 },
      paint: {
        body: (x, y, z, nx, ny, nz, tg, FEATH) => {
          const arm = (tg.arm || 0) + (tg.panel || 0), back = sst(0.1, 0.5, ny) * sst(0.18, 0.1, x);
          let col;
          if (eagle) col = arm > 0.5 ? mix(C.white, C.grey, sst(-0.2, 0.3, ny)) : mix(C.white, C.grey, back);
          else { col = arm > 0.5 ? mix(C.rufous, C.grey, sst(-0.2, 0.3, ny)) : mix(mix(C.white, C.rufous, sst(0.1, 0.0, x)), C.grey, back * sst(0.12, 0.0, x)); col = col.map(v => v * (0.94 + 0.12 * M.vn(x * 300, y * 60, z * 300))); }
          return { col, mat: arm > 0.5 ? [0.74, 0.02, PAT.feather, 0] : FEATH, fur: 0 };
        },
        head: (x, y, z, nx, ny, nz, tg) => {
          let col = C.white; if (!eagle) col = col.map(v => v * (0.9 + 0.14 * sst(0.4, 0.6, M.vn(x * 260, y * 900, z * 260))));
          /* (the gape: the mouth's corner run back under the eye, bare skin) */
          const gl = 0.3657 + (0.292 - x) * 0.1, gw = 0.0016 * sst(0.274, 0.29, x), gk = gw > 0 && Math.abs(z) > 0.006 ? sst(gw, gw * 0.4, Math.abs(y - gl)) : 0;
          if (gk > 0) return { col: mix(col, eagle ? lin('#7c7a76') : lin('#c4a548'), gk), mat: [0.6, 0.1, gk > 0.5 ? PAT.skin : PAT.feather, 0], fur: 0 };
          return { col: (tg.brow || 0) > 0.5 && eagle ? mix(C.white, C.greyD, 0.1) : col, mat: [0.7, 0.04, PAT.feather, 0], fur: 0 };
        },
        beak: (x, y, z, s, u, outer, lower) => {
          if (!outer) return { col: C.mouth, mat: [0.5, 0.2, PAT.skin, 0] };
          if (!lower && s < CERE) { const nd = Math.hypot((x - NOS[0]) / 0.0042, (y - NOS[1]) / 0.0022); return nd < 0.75 && Math.abs(u) > 0.25 ? { col: lin('#121110'), mat: [0.6, 0.1, PAT.skin, 0] } : { col: C.cere, mat: [0.6, 0.08, PAT.skin, 0] }; }
          const tip = sst(0.62, 0.92, s);
          return { col: mix(C.bill, C.billT, tip), mat: [0.32 - 0.08 * tip, 0.45, PAT.horn, 0] };
        },
        feather: (kind2, i, s, c, top, f) => {
          if (kind2 === 'tail') return eagle ? mix(C.grey, C.white, sst(0.35, 0.5, s)) : mix(C.rufous, C.greyD, 0.3 * c).map(v => v * (top ? 1 : 0.85));
          if (kind2 === 'cov' || kind2 === 'pcov') return eagle ? (top ? C.grey : C.white) : (top ? C.grey : C.rufous);
          if (kind2 === 'tert') return C.greyD;
          if (eagle) return kind2 === 'sec' ? mix(C.black, C.greyD, top ? 0.75 * (1 - sst(0.2, 0.8, s)) : 0.05) : mix(C.black, C.greyD, top ? 0.25 * (1 - s) : 0.05);
          /* (the kite's primaries black at their outer half; its secondaries chestnut, darker at their tips) */
          return kind2 === 'prim' ? mix(C.rufous, C.black, Math.min(1, sst(0.2, 0.45, s) + sst(0.3, 0.9, f))) : mix(C.rufous, C.greyD, 0.3 + 0.5 * sst(0.75, 1, s));
        },
        leg: C.leg, claw: lin('#151413')
      },
      more: (clips, K) => {
        const { R, V, qE, wing, tailPose, legTo, look, face, flapHz, TAU } = K;
        /* low over the water, wings up, the feet thrown forward and the talons spread to take a fish */
        clips.snatch = (P, t) => {
          const c = (t % 2) / 2, reach = R.sst(0.1, 0.35, c) * (1 - R.sst(0.7, 0.9, c)), grip = R.sst(0.45, 0.55, c);
          P.set('body', 0, 0, 0.35 + 0.15 * reach);
          const ph = t * flapHz, sn = Math.sin(TAU * ph);
          for (const s of [-1, 1]) wing(P, s, { f: 0.05, lift: 0.6 + 0.25 * sn * (1 - reach) + 0.3 * reach, sweep: 0.25 * reach, fan: 1, twist: 0.3 * reach });
          for (const s of [-1, 1]) legTo(P, s, V(0.16 + 0.04 * reach, 0.06 - 0.04 * reach, s * 0.06), 1.1 * grip - 0.3 * (1 - grip), qE(0, 0, 0.9 * reach));
          tailPose(P, -0.35 * reach, 0.9); look(P, V(0.7, -0.7, 0), 1); face(P, t);
        };
        /* the sea eagle's call: the head thrown back, the bill open, honking */
        clips.call = (P, t) => { clips.perch(P, t); const c = (t % 2.4) / 2.4, on = R.sst(0.0, 0.1, c) * (1 - R.sst(0.5, 0.6, c)); look(P, V(0.5, 0.8 * on + 0.1, 0), 1); face(P, t, 0.45 * on * (0.7 + 0.3 * Math.sin(t * 14))); };
      }
    });
    if (!eagle) g.scale.setScalar(0.58);
    return g;
  };
  M.add('wild/eagle', (o = {}) => raptor(o, 'eagle'));
  M.add('wild/kite', (o = {}) => raptor(o, 'kite'));
})();
