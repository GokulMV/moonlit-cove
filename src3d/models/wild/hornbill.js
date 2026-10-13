/* wild/hornbill — a rhinoceros hornbill (Buceros rhinoceros), the great black bird of the island's canopy: an adult
   male, about 1 m from bill to tail and 1.5 m across the wings, built as it flies (wings spread, at the origin facing
   +x) and folded up to perch. Glossy black, the lower belly, thighs and undertail white; the tail white with a broad
   black band; the huge ivory bill under its casque — orange-red above, yellow below, its front swept up like a horn;
   the eye red in a black ring. o.clip: perch (also idle), hop, eat (a fig tossed back), call, preen, fly, glide,
   flapglide (a few heavy wingbeats and a long glide), soar, takeoff, land. */
(() => {
  const T = THREE, M = Models;
  M.add('wild/hornbill', (o = {}) => {
    const R = Rig, { lin, mix, sst, PAT } = R;
    const C = { black: lin('#121212'), gloss: lin('#1a1f1c'), white: lin('#e6e2d9'), ivory: lin('#e3d4a2'), bill0: lin('#c9692c'), casqR: lin('#c63a1a'), casqY: lin('#e09a2c'), leg: lin('#5c645a'), iris: lin('#a3231a'), ring: lin('#1a1514') };
    /* the bill's middle line, from its base to its tip, bowed down a little; its depth either side of it */
    const BB = [0.3, 0.303], BT = [0.552, 0.232], bill = s => [BB[0] + (BT[0] - BB[0]) * s, BB[1] + (BT[1] - BB[1]) * s - 0.016 * Math.sin(Math.PI * s)];
    const hd = s => 0.028 * Math.pow(1 - s, 0.75) + 0.003 * (1 - s), N = 12, at = f => Array.from({ length: N + 1 }, (_, i) => f(i / N));
    const ridge = s => { const p = bill(s); return [p[0], p[1] + hd(s)]; }, edge = s => { const p = bill(s); return [p[0], p[1] - 0.5 * hd(s)]; };
    /* (the lower mandible inside the upper's edges, ending a little short of its tip) */
    const lowTop = s => { const q = 0.02 + 0.95 * s, p = bill(q); return [p[0], p[1] - 0.5 * hd(q) + 0.003 * (1 - s)]; }, lowBot = s => { const t = lowTop(s); return [t[0] - 0.004 * (1 - s), t[1] - 0.024 * Math.pow(1 - s, 0.85) - 0.0015 * (1 - s)]; };
    /* (the casque: on the bill's top from its base, deepening forward, sunk into the bill's sides; its front turned up
       and back like a horn) */
    const ch = s => 0.016 + 0.03 * sst(0.0, 0.6, s), CF = 0.6, XF = bill(CF)[0], YF = ridge(CF)[1] + ch(CF);
    const cTop = [...Array.from({ length: 9 }, (_, i) => { const s = 0.02 + (CF - 0.02) * i / 8, r = ridge(s); return [r[0], r[1] + ch(s)]; }), [XF + 0.004, YF + 0.012], [XF + 0.002, YF + 0.03], [XF - 0.006, YF + 0.045], [XF - 0.017, YF + 0.053]];
    const cBot = [...Array.from({ length: 9 }, (_, i) => { const s = 0.02 + (CF - 0.02) * i / 8, r = ridge(s), e = edge(s); return [r[0], r[1] - 0.45 * (r[1] - e[1])]; }), [XF + 0.024, ridge(CF + 0.08)[1] - 0.004], [XF + 0.034, YF - 0.012], [XF + 0.04, YF + 0.01], [XF + 0.034, YF + 0.032], [XF + 0.016, YF + 0.05], [XF - 0.017, YF + 0.053]];
    return Bird.build(o, {
      name: 'hornbill', size: 1, dihedral: 0.06, gape: 0.35,
      body: { c: [0.0, 0.25], r: [0.16, 0.095, 0.092] },
      neck: { pts: [[0.12, 0.27], [0.18, 0.287], [0.235, 0.298]], r: [0.055, 0.042], lift: 0.32 },
      head: { c: [0.268, 0.306], r: [0.052, 0.046, 0.038], fwd: [0.99, -0.1, 0], cell: 0.0012 },
      bill: { tip: [BT[0], BT[1], 0], gape: [0.298, 0.288] },
      beak: {
        upper: { top: at(ridge), bot: at(edge), round: 2, palate: 0.4, w: s => 0.019 * Math.pow(1 - s, 0.7) + 0.0015 * (1 - s) + 0.0002 },
        lower: { top: at(lowTop), bot: at(lowBot), round: 2, floor: 0.3, w: s => 0.016 * Math.pow(1 - s, 0.7) + 0.0012 * (1 - s) + 0.0002 },
        more: [{ top: cTop, bot: cBot, round: 2.4, palate: 0.2, tag: 'casque', w: s => 0.0128 * (1 - 0.2 * s) * Math.pow(1 - sst(0.78, 1, s), 0.5) + 0.0003 }] },
      eye: { at: [0.284, 0.316, 0.034], r: 0.0082, ax: [0.25, 0.1, 0.95], col: C.iris, iris: 0.62, pupil: 0.32, white: 0.08, lid: C.ring },
      wing: { sh: [0.07, 0.29, 0.075], arm: 0.12, fore: 0.15, hand: 0.085, lead: [0.02, 0.015, 0.011], panel: [0.045, 0.04, 0.028], panelT: 0.007,
        prim: { n: 10, len: 0.34, w: 0.07, emarg: 0.5 }, sec: { n: 12, len: 0.24, w: 0.072 }, tert: 3, cov: 0.42 },
      tail: { at: [-0.15, 0.255], n: 10, len: 0.34, w: 0.17, fan: 0.3, shape: f => 1 - 0.12 * f * f },
      leg: { hip: [-0.01, 0.2, 0.046], knee: [0.006, 0.16], ankle: [-0.002, 0.088], foot: [0.016, 0.013], toe: [0.04, 0.05, 0.042], hallux: 0.032, r: 0.0088, claw: 0.011, spread: 0.42, scale: 0.0042, feathered: true },
      perch: { pitch: 0.45, dy: -0.03, footX: 0.03, curl: 0.6, tail: 0.6, gaze: -0.38 },
      flap: { hz: 2.4, amp: 0.85 },
      paint: {
        body: (x, y, z, nx, ny, nz, tg, FEATH) => {
          /* (black, glossed green; the lower belly, vent and thighs white) */
          const vent = sst(-0.02, -0.09, x) * sst(-0.1, -0.5, ny) + (tg.thigh || 0), w = Math.min(1, vent);
          return { col: mix(mix(C.black, C.gloss, 0.5 + 0.5 * M.vn(x * 40, y * 40, z * 40)), C.white, w), mat: [w > 0.5 ? 0.7 : 0.52, w > 0.5 ? 0.03 : 0.18, PAT.feather, 0], fur: 0 };
        },
        head: (x, y, z, nx, ny, nz, tg) => ({ col: (tg.socket || 0) > 0.4 ? C.ring : C.black, mat: [0.52, 0.18, PAT.feather, 0], fur: 0 }),
        beak: (x, y, z, s, u, outer, lower, tag) => {
          if (!outer) return { col: lin('#2a1a16'), mat: [0.5, 0.2, PAT.skin, 0] };
          if (tag === 'casque') { const sb = R.clamp((x - BB[0]) / (BT[0] - BB[0]), 0, 1), bt = ridge(sb)[1], top = sst(bt + 0.01, bt + 0.03, y) + sst(0.455, 0.49, x) * 0.6; return { col: mix(C.casqY, C.casqR, Math.min(1, top)), mat: [0.34, 0.4, PAT.horn, 0] }; }
          const base = sst(0.345, 0.305, x);
          return { col: mix(C.ivory, C.bill0, base * 0.8), mat: [0.3, 0.42, PAT.horn, 0] };
        },
        feather: (kind, i, s, c, top, f) => {
          if (kind === 'tail') { const band = sst(0.36, 0.4, s) * (1 - sst(0.66, 0.7, s)); return mix(C.white, C.black, band).map(v => v * (top ? 1 : 0.92)); }
          return mix(C.black, C.gloss, top ? 0.4 : 0.1).map(v => v * (0.9 + 0.2 * c));
        },
        leg: C.leg, claw: lin('#3a3632')
      },
      more: (clips, K) => {
        const { R, V, wing, tailPose, legTo, look, face, perchBody, FWD, flapHz, amp, TAU } = K, { sst } = R;
        /* the hop along a branch: both feet together, the wings flicked half open */
        clips.hop = (P, t) => {
          const c = (t % 0.9) / 0.9, up = Math.sin(Math.PI * sst(0.1, 0.6, c)), fl = Math.sin(Math.PI * sst(0.05, 0.55, c));
          perchBody(P, t, 0.6, 0.6 * (1 - up)); P.off.y += 0.07 * up; P.off.x += 0.12 * sst(0.1, 0.6, c);
          for (const s of [-1, 1]) wing(P, s, { f: 1 - 0.55 * fl, lift: 0.4 * fl, fan: 0.3 * fl });
          look(P, FWD.clone().add(V(0, -0.1, 0)), 1); face(P, t);
        };
        /* a fig: the head flicked up and the fruit tossed back down the throat */
        clips.eat = (P, t) => {
          perchBody(P, t);
          const c = (t % 2.6) / 2.6, flick = sst(0.3, 0.42, c) * (1 - sst(0.5, 0.7, c));
          look(P, FWD.clone().add(V(0, -0.35 * (1 - flick) + 0.9 * flick, 0)), 1); face(P, t, 0.25 * flick + 0.05 * sst(0.0, 0.1, c) * (1 - sst(0.2, 0.3, c)));
        };
        /* the hornbill's way of flying: five heavy beats (their whoosh carries), then a long glide */
        clips.flapglide = (P, t, k) => {
          const per = 5 / flapHz + 2.2, c = t % per, beating = c < 5 / flapHz;
          if (beating) clips.fly(P, t, k); else clips.glide(P, t, k);
          if (!beating && c - 5 / flapHz < 0.3) { const e = 1 - (c - 5 / flapHz) / 0.3; for (const s of [-1, 1]) wing(P, s, { f: 0.04 + 0.2 * e, lift: 0.08 + 0.2 * e, fan: 0.5 }); }
        };
      }
    });
  });
})();
