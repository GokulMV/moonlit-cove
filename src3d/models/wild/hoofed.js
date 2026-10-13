/* wild/hoofed.js — what the island's hoofed animals share (wild/pig, wild/mousedeer): how their legs set their hooves
   down, and their motions — stand, walk, trot, gallop, bound, graze (or root), alert, lie, scratch, shake, drink,
   stamp, wallow. A species builds its own body over bones named as here:
     hips, spine1, spine2, chest, neck1, neck2, head, jaw, lidL/R, earL/R, t0… (the tail)
     scapL/R, humL/R, radL/R, mcL/R, hfL/R      the forelegs: shoulder blade, upper arm, forearm, cannon, hoof
     femL/R, tibL/R, mtL/R, hhL/R               the hind legs: thigh, shank, cannon, hoof
   each hoof bone's tail at the tip of its toe, where it meets the ground.
   Hoofed.clips(S, sp) → the clips; sp: { tail (bone names), speed: { walk, trot, gallop } (m/s, as built), stride
   (the walk's cycle, seconds), head: { fwd (where the face points), graze: [x, y, z] where the snout reaches to feed },
   lie: the pose lying down ({ drop, fore, hind }), more(clips, kit) for more of its own } */
const Hoofed = (() => {
  const T = THREE, TAU = Math.PI * 2;
  function clips(S, sp) {
    const R = Rig, { sst, clamp, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), H = S.head;
    const LEGS = {
      LF: { up: 'humL', mid: 'radL', can: 'mcL', hoof: 'hfL', scap: 'scapL', s: -1, fore: true }, RF: { up: 'humR', mid: 'radR', can: 'mcR', hoof: 'hfR', scap: 'scapR', s: 1, fore: true },
      LH: { up: 'femL', mid: 'tibL', can: 'mtL', hoof: 'hhL', s: -1, fore: false }, RH: { up: 'femR', mid: 'tibR', can: 'mtR', hoof: 'hhR', s: 1, fore: false }
    };
    for (const k in LEGS) { const L = LEGS[k]; L.toe = S.tail[L.hoof].clone(); L.fet = H[L.hoof].clone(); L.knee = H[L.mid].clone(); L.top = H[L.can].clone(); }
    /* a hoof set down: its toe at `toe`, the hoof pitched by hp (its tip down, negative), the cannon by cp (its foot
       forward, positive); the upper limb bent toward where its joint already points */
    const plant = (P, key, toe, hp = 0, cp = 0, pole) => {
      const L = LEGS[key], Qh = qE(0, 0, hp), fet = toe.clone().sub(L.toe.clone().sub(L.fet).applyQuaternion(Qh));
      R.reach(P, L.up, L.mid, L.can, L.fet.toArray(), fet, qE(0, 0, cp), pole || P.world(L.mid).add(V(L.fore ? -0.6 : 0.6, 0, L.s * 0.05)));
      P.aim(L.hoof, Qh);
    };
    const FWD = V(...(sp.head.fwd || [1, -0.4, 0])).normalize();
    /* the head turned to look along dir, the neck's two bones sharing the turn, the crown kept up */
    const look = (P, dir, k = 1) => {
      const d = dir.clone().normalize(), sd = new T.Vector3().crossVectors(d, V(0, 1, 0)); if (sd.lengthSq() < 1e-6) sd.set(0, 0, 1); sd.normalize();
      const W = R.frameTo(FWD, V(0, 0, 1), d, sd), Qc = new T.Quaternion(); P.world('chest', V(), Qc);
      P.aim('neck1', Qc.clone().slerp(W, 0.3 * k)); const Q1 = new T.Quaternion(); P.world('neck1', V(), Q1);
      P.aim('neck2', Q1.clone().slerp(W, 0.55 * k)); const Q2 = new T.Quaternion(); P.world('neck2', V(), Q2);
      P.aim('head', Q2.slerp(W, k).normalize());
    };
    const lookAt = (P, pt, k = 1) => look(P, pt.clone().sub(P.world('head')), k);
    const face = (P, t, jaw = 0, shut = 0, ears = 0) => {
      const b = Math.max(R.blink(t, 4.1), shut);
      P.set('lidL', 0, 0, -1.0 * b); P.set('lidR', 0, 0, -1.0 * b); P.set('jaw', 0, 0, -jaw);
      const fl = R.every(t, 4.2, 0.25, 5), fr = R.every(t + 1.7, 5.1, 0.25, 7);
      P.set('earL', 0.15 * ears + (fl > 0 ? 0.3 * Math.sin(Math.PI * fl) : 0) + 0.05 * wave(t, 31, 0.5), 0, -0.1 * ears);
      P.set('earR', -0.15 * ears - (fr > 0 ? 0.3 * Math.sin(Math.PI * fr) : 0) - 0.05 * wave(t, 32, 0.5), 0, -0.1 * ears);
      if (sp.face) sp.face(P, t, jaw);
    };
    const TAIL = sp.tail, TREST = TAIL.map((n, i) => (i < TAIL.length - 1 ? H[TAIL[i + 1]] : S.tail[n]).clone().sub(H[n]).normalize());
    /* the tail: each bone's way (pitch, as hanging is −π/2; yaw across) from the rump to the tip */
    const tailTo = (P, pitch, yaw) => TAIL.forEach((n, i) => { const s = i / Math.max(1, TAIL.length - 1), p = pitch(s), w = yaw(s), d = V(-Math.cos(p) * Math.cos(w), Math.sin(p), Math.cos(p) * Math.sin(w)); P.aim(n, new T.Quaternion().setFromUnitVectors(TREST[i], d)); });
    const swish = (t, k = 1) => s => 0.25 * k * s * Math.sin(t * 2.3 + s * 1.5) + 0.1 * wave(t, 41, 0.6) * s;
    const standLegs = (P, dx = {}) => { for (const k in LEGS) { const L = LEGS[k]; plant(P, k, L.toe.clone().add(V(dx[k] || 0, 0, 0))); } };

    /* the gaits: each foot's phase in the stride (a walk in lateral sequence, a trot in diagonal pairs, a rotary
       gallop, a bound with the hind feet together), how long it is down, how high it is lifted */
    const GAITS = {
      walk: { ord: { LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }, beta: 0.66, lift: [0.05, 0.04], spine: 0.04 },
      trot: { ord: { LH: 0, RF: 0.02, RH: 0.5, LF: 0.52 }, beta: 0.44, lift: [0.08, 0.06], spine: 0.02 },
      gallop: { ord: { LH: 0, RH: 0.1, LF: 0.5, RF: 0.62 }, beta: 0.32, lift: [0.12, 0.09], spine: 0.1 },
      bound: { ord: { LH: 0, RH: 0.03, LF: 0.5, RF: 0.56 }, beta: 0.3, lift: [0.14, 0.1], spine: 0.14 }
    };
    const gait = (P, t, k, name) => {
      const G = GAITS[name], sz = sp.size || 1, v = (k.speed ?? (sp.speed[name] || 1)) / (sp.scale || 1);
      const Tc = (name === 'walk' ? sp.stride || 0.9 : name === 'trot' ? (sp.stride || 0.9) * 0.62 : (sp.stride || 0.9) * 0.42) / Math.sqrt(Math.max(0.4, v / (sp.speed[name] || 1))), ph = t / Tc, D = v * Tc * G.beta;
      const s1 = Math.sin(TAU * ph), s2 = Math.sin(2 * TAU * ph);
      const bounce = name === 'gallop' || name === 'bound';
      P.off.set(0, (bounce ? 0.035 * Math.sin(TAU * ph + 0.9) - 0.01 : -0.006 * Math.cos(2 * TAU * ph)) * sz, 0);
      P.set('hips', 0.03 * s1 * (bounce ? 0.3 : 1), 0.05 * Math.sin(TAU * ph - 0.4) * (bounce ? 0.2 : 1), bounce ? -G.spine * Math.sin(TAU * ph) : 0.01 * s2);
      P.set('spine1', 0, -0.02 * s1, bounce ? G.spine * 0.6 * Math.sin(TAU * ph + 0.5) : 0); P.set('spine2', 0, -0.015 * s1, bounce ? G.spine * 0.5 * Math.sin(TAU * ph + 1.0) : 0);
      P.set('chest', -0.02 * s1, 0.03 * Math.sin(TAU * ph + 0.6), bounce ? G.spine * 0.7 * Math.sin(TAU * ph + 1.6) : 0);
      for (const key in LEGS) {
        const L = LEGS[key], [sx, lift, down] = R.stride(ph - G.ord[key], G.beta), u = (1 - sx) / 2, sw = (sx + 1) / 2;
        const hl = (L.fore ? G.lift[0] : G.lift[1]) * sz, to = V(L.toe.x + sx * D / 2, L.toe.y + lift * hl, L.toe.z);
        let hp, cp;
        if (down) { hp = -0.55 * sst(0.6, 1, u); cp = (L.fore ? 0.12 : 0.08) * (0.5 - u) * 2 - (L.fore ? 0.15 : 0.1) * sst(0.65, 1, u); }
        else { const fl = Math.sin(Math.PI * Math.min(1, sw * 1.25)); hp = -0.55 * (1 - sst(0.1, 0.8, sw)) - (L.fore ? 0.9 : 0.6) * fl * 0.6; cp = L.fore ? -1.2 * fl * (0.6 + 0.4 * (bounce ? 1 : 0.5)) + 0.25 * sst(0.7, 1, sw) : -0.5 * fl + 0.2 * sst(0.6, 1, sw); }
        if (L.fore && L.scap) P.set(L.scap, 0, 0, 0.12 * sx * (bounce ? 1.6 : 1));
        plant(P, key, to, hp, cp);
      }
      look(P, FWD.clone().add(V(0, (name === 'walk' ? 0.06 : 0.03) * Math.cos(2 * TAU * ph + 0.8) + (bounce ? 0.1 : 0), 0)), 0.8);
      face(P, t, 0, 0, bounce ? -0.5 : 0);
      tailTo(P, s => (sp.tailCarry ?? -1.2) + (bounce ? 0.6 : 0.1) + 0.1 * Math.sin(TAU * ph - s), swish(t, name === 'walk' ? 0.6 : 0.3));
    };

    const cl = {
      stand: (P, t) => {
        P.off.set(0, -0.002 * Math.sin(t * 0.8), 0);
        P.set('hips', 0, 0.02 * wave(t, 1, 0.3), 0); P.set('chest', 0, 0.02 * wave(t, 2, 0.3), 0);
        standLegs(P);
        look(P, FWD.clone().add(V(0, 0.15 * wave(t, 5, 0.3), 0.5 * wave(t, 7, 0.25))), 1);
        face(P, t); tailTo(P, s => sp.tailCarry ?? -1.2, swish(t, 0.5));
      },
      walk: (P, t, k) => gait(P, t, k, 'walk'),
      trot: (P, t, k) => gait(P, t, k, 'trot'),
      gallop: (P, t, k) => gait(P, t, k, 'gallop'),
      bound: (P, t, k) => gait(P, t, k, 'bound'),
      graze: (P, t) => {
        /* the head down to the ground, nosing along it, a step now and then */
        const st = R.every(t, 3.5, 0.9, 3), step = st > 0 ? Math.sin(Math.PI * st) : 0;
        P.off.set(0, -0.01, 0); P.set('chest', 0, 0, -0.06); P.set('hips', 0, 0.02 * wave(t, 1, 0.3), 0.02);
        for (const key in LEGS) { const L = LEGS[key]; plant(P, key, L.toe.clone().add(V(key === 'LF' ? 0.06 * sst(0.3, 0.8, st) : 0, key === 'LF' ? 0.03 * step : 0, 0))); }
        const g = sp.head.graze, sn = V(g[0] + 0.03 * wave(t, 3, 0.6), g[1] + 0.015 * Math.max(0, Math.sin(t * 1.7)), g[2] + 0.05 * wave(t, 4, 0.5));
        lookAt(P, sn.clone().add(V(0.3, -0.25, 0)), 1);
        face(P, t, 0.04 + 0.04 * Math.max(0, Math.sin(t * 9)), 0, 0.2); tailTo(P, s => sp.tailCarry ?? -1.2, swish(t, 0.8));
        if (sp.root) sp.root(P, t);
      },
      alert: (P, t) => {
        /* stock-still, the head up high, the ears forward, staring */
        P.off.set(0, 0.004, 0); P.set('chest', 0, 0, 0.04);
        standLegs(P);
        look(P, V(1, 0.35 + 0.02 * wave(t, 3, 0.3), 0.08 * wave(t, 5, 0.2)), 1);
        face(P, t, 0, 0, 1); tailTo(P, s => (sp.tailCarry ?? -1.2) + 0.5, () => 0);
      },
      drink: (P, t) => {
        P.off.set(0, -0.02, 0); P.set('chest', 0, 0, -0.08);
        standLegs(P, { LF: 0.04, RF: 0.02 });
        const g = sp.head.graze; lookAt(P, V(g[0] + 0.05, g[1] - 0.01, g[2]).add(V(0.25, -0.3, 0)), 1);
        face(P, t, 0.03 + 0.03 * Math.max(0, Math.sin(t * 6)), 0.2, 0.3); tailTo(P, s => sp.tailCarry ?? -1.2, swish(t, 0.4));
      },
      lie: (P, t) => {
        /* lying down, the legs folded under it, chewing, the head up */
        const L = sp.lie; P.off.set(0, -L.drop, 0); P.set('hips', 0, 0, L.tilt || 0);
        for (const key in LEGS) { const lg = LEGS[key], pts = (lg.fore ? L.fore : L.hind)(lg.s); R.chainTo(P, [lg.up, lg.mid, lg.can, lg.hoof], pts); }
        look(P, FWD.clone().add(V(0, 0.25, 0.3 * wave(t, 5, 0.2))), 1);
        face(P, t, 0.03 * Math.max(0, Math.sin(t * 5)), 0.3 * sst(0.3, 0.6, wave(t, 9, 0.1))); tailTo(P, s => (sp.tailCarry ?? -1.2) - 0.2, s => 0.3 * s);
      },
      scratch: (P, t) => {
        /* a hind hoof reaching forward to scratch behind an ear, quickly, the head bent round to meet it */
        standLegs(P);
        P.set('hips', 0.08, 0, 0); P.set('chest', 0.06, 0.15, 0);
        const ear = P.at('head', H.earL.toArray()), sc = Math.sin(t * 18) * 0.015 * (sp.size || 1);
        look(P, V(0.6, -0.3, -0.6), 1);
        const L = LEGS.LH, toe = ear.clone().lerp(L.toe.clone(), sp.scratchReach ?? 0.45).add(V(sc, sc * 0.5, -0.02));
        plant(P, 'LH', toe, -1.2, 1.4, P.world(L.mid).add(V(0.5, 0.2, -0.3)));
        face(P, t, 0, 0.7, 0.5); tailTo(P, s => sp.tailCarry ?? -1.2, swish(t, 0.3));
      },
      shake: (P, t) => {
        /* a shake that runs from the head back along the body */
        const c = (t % 2.4) / 2.4, on = sst(0.0, 0.1, c) * (1 - sst(0.5, 0.65, c)), w = Math.sin(t * 28) * on;
        standLegs(P);
        P.set('hips', 0.18 * w, 0, 0); P.set('spine1', 0.22 * Math.sin(t * 28 - 0.5) * on, 0, 0); P.set('chest', 0.25 * Math.sin(t * 28 - 1) * on, 0, 0);
        look(P, FWD.clone().add(V(0, 0, 0)), 1); P.turn('head', 0.5 * Math.sin(t * 28 - 1.5) * on, 0, 0);
        face(P, t, 0, on * 0.8, -on); tailTo(P, s => (sp.tailCarry ?? -1.2) + 0.4 * on, s => 0.5 * Math.sin(t * 28 - 2 - s) * on);
      },
      stamp: (P, t) => {
        /* the alarm: a hind hoof drummed fast on the ground, the head up */
        P.set('chest', 0, 0, 0.03);
        standLegs(P);
        const d = Math.max(0, Math.sin(t * 14)) * (R.every(t, 2.2, 1.2, 9) > 0 ? 1 : 0), L = LEGS.RH;
        plant(P, 'RH', L.toe.clone().add(V(0, 0.03 * d * (sp.size || 1), 0)), -0.4 * d, -0.3 * d);
        look(P, V(1, 0.3, 0.1), 1); face(P, t, 0, 0, 1); tailTo(P, s => (sp.tailCarry ?? -1.2) + 0.9, () => 0);
      }
    };
    if (sp.more) sp.more(cl, { R, V, qE, H, S, LEGS, plant, look, lookAt, face, tailTo, swish, standLegs, gait, FWD, TAU });
    cl.idle = cl.idle || cl.stand;
    return cl;
  }
  return { clips };
})();
