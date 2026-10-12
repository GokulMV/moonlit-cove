/* ─────────────────────────────────────────────────────────────
   uncork.js — opening the message in a bottle, in your own hands.
   The bottle is picked up off the sand and brought up in front of
   you, turned once to look at the letter inside; the cork is worked
   out with a few twists and pops free (it flies off and drops on the
   sand); the bottle is tipped neck-down and shaken, and with each
   shake the rolled letter slides further out of the neck until it
   can be taken (paper.js then unrolls it to read, and its twine
   falls away), and the bottle is put back down. Closing the letter
   puts it back in the bottle, and the cork hops back into the neck.
   Everything moves in the world (the bottle leaves its place on the
   sand for the scene while it is held), relative to the camera while
   it is in your hands, so a camera that is still settling keeps it
   in view. window.__coveBottleT (seconds) holds the clock still for
   the test bench.
   ───────────────────────────────────────────────────────────── */
const Uncork = (() => {
  const T = THREE;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const sm5 = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const lerp = (a, b, t) => a + (b - a) * t;
  /* the timeline, in seconds from picking it up */
  const TL = { lift: [0.2, 1.35], look: [1.35, 1.8], twist: [1.8, 3.1], pop: 3.1, tip: [3.3, 4.05], shake: [4.05, 5.65], take: 5.65, lower: [5.65, 6.45], home: 7.3 };
  const TWISTS = 3, SHAKES = 4, SHAKE = (TL.shake[1] - TL.shake[0]) / SHAKES;
  /* how it is held, in the camera's frame (x right, y up, z back toward you): up and to the right for the cork, then
     neck-down to the left for the shaking; where it goes out of view when it is put down */
  const HOLD = {
    a: { p: new T.Vector3(0.07, -0.025, -0.66), axis: new T.Vector3(0.3, 0.92, 0.26) },
    b: { p: new T.Vector3(0.075, 0.045, -0.66), axis: new T.Vector3(-0.64, -0.7, 0.2) },
    c: { p: new T.Vector3(0.46, -0.5, -0.58), axis: new T.Vector3(-0.15, -0.35, -0.92) }
  };
  const _z = new T.Vector3(0, 0, 1), _m = new T.Matrix4();
  /* an orientation that lays the bottle's own x (its neck) along axis, its side toward you */
  function axisQuat(axis, out) {
    const x = axis.clone().normalize(), z = _z.clone().addScaledVector(x, -x.dot(_z)).normalize(), y = new T.Vector3().crossVectors(z, x);
    return out.setFromRotationMatrix(_m.makeBasis(x, y, z));
  }
  for (const k of Object.keys(HOLD)) HOLD[k].q = axisQuat(HOLD[k].axis, new T.Quaternion());
  const X = new T.Vector3(1, 0, 0), UP = new T.Vector3(0, 1, 0);

  /* bottle: the group the bottle rests in on the sand; model: the bottle itself (its child, at rest exactly on it) */
  function make({ scene, camera, bottle, model, ground = 0, onPop = null }) {
    const ud = model.userData, cork = ud.cork, roll = ud.roll, twine = ud.twine;
    const rest = { cork: { p: cork.position.clone(), q: cork.quaternion.clone() }, roll: roll.position.clone(), twine: twine.position.clone() };
    const st = { phase: 'rest', t0: 0, last: 0, cb: null, quick: false,
      /* the bottle's place on the sand (taken when it is picked up: a wave may have moved it) */
      rP: new T.Vector3(), rQ: new T.Quaternion(), rS: 1,
      /* the cork once it is out: flying, then lying on the sand */
      cork: { free: false, v: new T.Vector3(), w: new T.Vector3(), bounces: 0, still: false, s0: 1 },
      twine: { free: false, v: new T.Vector3(), t: 0 },
      back: null, hop: null };
    const cam = { p: new T.Vector3(), q: new T.Quaternion() };
    const _p = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _v = new T.Vector3(), _v2 = new T.Vector3(), _s = new T.Vector3();
    const now = () => (typeof window !== 'undefined' && window.__coveBottleT != null && st.phase !== 'rest' ? st.t0 + window.__coveBottleT : performance.now() / 1000);

    /* a pose held in the camera's frame, into the world */
    function held(h, sway, u, out) {
      out.p.copy(h.p); if (sway) out.p.add(_v2.set(0.0035 * Math.sin(u * 1.3), 0.0045 * Math.sin(u * 0.9 + 1.0), 0.002 * Math.sin(u * 0.7 + 2.0)));
      out.p.applyQuaternion(cam.q).add(cam.p);
      out.q.copy(cam.q).multiply(h.q);
      if (sway) out.q.multiply(_q2.setFromAxisAngle(_z, 0.02 * Math.sin(u * 1.1)));
      return out;
    }
    const poseA = { p: new T.Vector3(), q: new T.Quaternion() }, poseB = { p: new T.Vector3(), q: new T.Quaternion() };
    function blendHeld(ha, hb, k, u, out) {
      out.p.lerpVectors(ha.p, hb.p, k); out.p.y += 0.03 * Math.sin(Math.PI * k);
      out.p.add(_v2.set(0.0035 * Math.sin(u * 1.3), 0.0045 * Math.sin(u * 0.9 + 1.0), 0)).applyQuaternion(cam.q).add(cam.p);
      out.q.copy(cam.q).multiply(_q.slerpQuaternions(ha.q, hb.q, k));
      return out;
    }
    const setWorld = (p, q, s) => { model.position.copy(p); model.quaternion.copy(q); model.scale.setScalar(s); };
    /* the bottle's place on the sand, and the cork and letter in it */
    function restWorld() { bottle.updateMatrixWorld(true); bottle.matrixWorld.decompose(st.rP, st.rQ, _s); st.rS = _s.x; }
    function toScene(o) { scene.attach(o); }
    function home() {
      bottle.attach(model); model.position.set(0, 0, 0); model.quaternion.identity(); model.scale.setScalar(1); model.visible = true;
    }
    function corkHome() {
      model.attach(cork); cork.position.copy(rest.cork.p); cork.quaternion.copy(rest.cork.q); cork.scale.setScalar(1);
      st.cork.free = false; st.cork.still = false; st.cork.bounces = 0;
    }
    function letterHome() {
      if (twine.parent !== model) model.attach(twine);
      roll.position.copy(rest.roll); twine.position.copy(rest.twine); twine.quaternion.setFromAxisAngle(UP, Math.PI / 2); twine.scale.setScalar(1);
      roll.visible = twine.visible = true; st.twine.free = false;
    }
    /* the letter's place in the bottle on the sand, for paper.js to fly it back to */
    function letterRest() {
      restWorld(); const m = new T.Matrix4().compose(st.rP, st.rQ, new T.Vector3(st.rS, st.rS, st.rS));
      const p = new T.Vector3(ud.rollX, ud.rollY, 0).applyMatrix4(m);
      return { p: p.toArray(), q: st.rQ.toArray(), s: st.rS };
    }

    function open(cb, opts = {}) {
      if (st.phase !== 'rest') { if (st.phase === 'down' && cb) cb(letterRest()); return; }
      restWorld(); camera.updateMatrixWorld(); camera.matrixWorld.decompose(cam.p, cam.q, _s);
      st.cb = cb; st.quick = !!opts.quick; st.t0 = performance.now() / 1000; st.last = st.t0;
      st.phase = st.quick ? 'quick' : 'lift';
      if (!st.quick) { toScene(model); setWorld(st.rP, st.rQ, st.rS); }
    }

    /* the cork, free: it flies, tumbles, bounces on the sand and lies down */
    function stepCork(dt, k) {
      const c = st.cork; if (!c.free || c.still) return;
      c.v.y -= 9.8 * dt; cork.position.addScaledVector(c.v, dt);
      const ang = c.w.length(); if (ang > 1e-4) cork.quaternion.premultiply(_q.setFromAxisAngle(_v.copy(c.w).divideScalar(ang), ang * dt));
      cork.scale.setScalar(lerp(c.s0, st.rS, k));
      const r = 0.0118 * cork.scale.x;
      if (cork.position.y < ground + r) {
        cork.position.y = ground + r;
        if (c.v.y < 0) { c.v.y = -c.v.y * 0.32; c.v.x *= 0.55; c.v.z *= 0.55; c.w.multiplyScalar(0.45); c.bounces++; }
        if (c.bounces >= 3 || Math.abs(c.v.y) < 0.25) {
          /* lying on its side, as a cork does */
          const ax = _v.set(0, 1, 0).applyQuaternion(cork.quaternion); ax.y = 0; if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0); ax.normalize();
          cork.quaternion.setFromUnitVectors(UP, ax); cork.position.y = ground + r * 0.92; c.still = true;
        }
      }
    }
    function stepTwine(dt) {
      const w = st.twine; if (!w.free) return;
      w.t += dt; w.v.y -= 9.8 * dt; twine.position.addScaledVector(w.v, dt); twine.rotateX(dt * 7); twine.rotateZ(dt * 3);
      if (w.t > 0.9 || twine.position.y < ground) { twine.visible = false; w.free = false; }
    }
    /* the cork's way into the neck of the bottle on the sand, from wherever it lies */
    function corkRestWorld(outP, outQ) {
      const m = new T.Matrix4().compose(st.rP, st.rQ, new T.Vector3(st.rS, st.rS, st.rS));
      outP.copy(rest.cork.p).applyMatrix4(m); outQ.copy(st.rQ).multiply(rest.cork.q);
    }
    function startHop(dur = 0.7) {
      if (!st.cork.free) return;
      st.hop = { t0: performance.now() / 1000, dur, p0: cork.position.clone(), q0: cork.quaternion.clone(), s0: cork.scale.x, p1: new T.Vector3(), q1: new T.Quaternion() };
      corkRestWorld(st.hop.p1, st.hop.q1); st.cork.still = true;
    }
    function stepHop() {
      const h = st.hop; if (!h) return;
      const k = clamp01((performance.now() / 1000 - h.t0) / h.dur), e = sm5(k);
      cork.position.lerpVectors(h.p0, h.p1, e); cork.position.y += 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.15)) * (1 - e * 0.3);
      cork.quaternion.slerpQuaternions(h.q0, h.q1, e); cork.scale.setScalar(lerp(h.s0, st.rS, e));
      if (k >= 1) { st.hop = null; corkHome(); }
    }

    /* pop: the cork comes free and flies off, out over the sand (at its moment, or as soon as a slow frame gets there) */
    function popCork() {
      model.updateMatrixWorld(true);
      const ax = new T.Vector3(1, 0, 0).applyQuaternion(model.quaternion);
      cork.position.copy(rest.cork.p); cork.position.x += 0.034; cork.quaternion.copy(rest.cork.q);
      cork.updateMatrixWorld(true); toScene(cork);
      const fw = new T.Vector3(0, 0, -1).applyQuaternion(cam.q); fw.y = 0; fw.normalize();
      const rt = new T.Vector3(1, 0, 0).applyQuaternion(cam.q);
      st.cork.v.copy(ax).multiplyScalar(1.5).addScaledVector(fw, 2.1).addScaledVector(UP, 1.25).addScaledVector(rt, 0.3);
      st.cork.w.set(9 + 6 * Math.random(), 4 * (Math.random() - 0.5), 12 + 5 * Math.random());
      st.cork.free = true; st.cork.still = false; st.cork.bounces = 0; st.cork.s0 = cork.scale.x;
      if (onPop) onPop();
    }
    function update() {
      const t = now(), dt = Math.max(0, Math.min(0.05, t - st.last)); st.last = t;
      stepHop();
      if (st.phase === 'rest') return;
      const u = t - st.t0;
      camera.updateMatrixWorld(); camera.matrixWorld.decompose(cam.p, cam.q, _s);
      if (st.phase === 'quick') {
        /* (for those who would rather things kept still: the cork hops off onto the sand, and the letter comes straight out) */
        const k = clamp01(u / 0.6);
        if (!st.cork.free) { toScene(cork); st.cork.free = true; st.cork.still = true; st.hop = null; st.qc = { p0: cork.position.clone(), q0: cork.quaternion.clone() }; }
        _v.set(0.16, 0, 0.05).applyQuaternion(st.rQ).multiplyScalar(st.rS * 0.6);
        cork.position.copy(st.qc.p0).addScaledVector(_v, k); cork.position.y = lerp(st.qc.p0.y, ground + 0.019, k) + 0.09 * Math.sin(Math.PI * k);
        cork.quaternion.copy(st.qc.q0).multiply(_q.setFromAxisAngle(_z, 2.4 * k));
        if (k >= 1) { st.phase = 'down'; const cb = st.cb; st.cb = null; roll.visible = twine.visible = false; if (cb) cb(letterRest()); }
        return;
      }
      if (st.phase === 'back') { stepBack(performance.now() / 1000); stepCork(dt, 1); return; }
      stepCork(dt, clamp01((u - TL.pop) / 0.7)); stepTwine(dt);
      if (st.phase === 'down') return;

      held(HOLD.a, true, u, poseA);
      if (u < TL.lift[1]) {
        /* picked up: a little rock as the hand closes on it, then up off the sand and round toward you, turning upright */
        const s = clamp01((u - TL.lift[0]) / (TL.lift[1] - TL.lift[0])), e = sm5(s);
        const b0 = st.rP, b1 = _v.copy(st.rP).add(_v2.set(0, 0.32, 0)), b2 = _p.set(0, -0.12, 0.06).applyQuaternion(cam.q).add(poseA.p);
        const a = 1 - e, P = new T.Vector3().copy(b0).multiplyScalar(a * a * a).addScaledVector(b1, 3 * a * a * e).addScaledVector(b2, 3 * a * e * e).addScaledVector(poseA.p, e * e * e);
        P.y += 0.006 * sm(0, 0.22, u) * (1 - e);
        const Q = _q.slerpQuaternions(st.rQ, poseA.q, sm5((s - 0.08) / 0.92));
        Q.premultiply(_q2.setFromAxisAngle(UP, 0.05 * Math.sin(Math.PI * clamp01(u / 0.3))));
        setWorld(P, Q, lerp(st.rS, 1, e));
        return;
      }
      if (u < TL.tip[0]) {
        /* in your hands: it settles, is turned once to look at the letter, then the cork is worked out */
        const P = poseA.p.clone(), Q = poseA.q.clone(), ax = _v.copy(X).applyQuaternion(Q);
        const land = u - TL.lift[1]; P.y += 0.01 * Math.exp(-land * 7) * Math.sin(land * 15);
        let turn = 0.36 * Math.sin(Math.PI * clamp01((u - TL.look[0]) / (TL.look[1] - TL.look[0])));
        if (u >= TL.twist[0] && u < TL.pop) {
          const k = (u - TL.twist[0]) / ((TL.pop - TL.twist[0]) / TWISTS), i = Math.min(TWISTS - 1, Math.floor(k)), f = k - i;
          const spin = 0.55 * Math.sin(f * Math.PI * 2);
          cork.position.copy(rest.cork.p); cork.position.x += 0.005 * (i + sm(0.15, 0.85, f));
          cork.quaternion.copy(rest.cork.q).premultiply(_q2.setFromAxisAngle(X, spin));
          turn -= 0.12 * spin; P.addScaledVector(ax, 0.0015 * Math.sin(f * Math.PI * 4));
        }
        if (u >= TL.pop && !st.cork.free) popCork();
        if (u >= TL.pop) { const r = u - TL.pop; P.addScaledVector(ax, -0.011 * Math.exp(-r * 10) * Math.cos(r * 24)); }
        Q.multiply(_q2.setFromAxisAngle(X, turn));
        setWorld(P, Q, 1);
        return;
      }
      if (u < TL.take) {
        /* tipped neck-down, the letter slides toward the neck; then shaken, and each sharp shake sends it further out */
        if (!st.cork.free) popCork();
        const s = sm5((u - TL.tip[0]) / (TL.tip[1] - TL.tip[0]));
        const pose = blendHeld(HOLD.a, HOLD.b, s, u, poseB), P = pose.p, Q = pose.q, ax = _v.copy(X).applyQuaternion(Q);
        let rx = lerp(ud.rollX, ud.rollX + 0.025, s), ry = lerp(ud.rollY, ud.rollY * 0.5, s);
        if (u >= TL.shake[0]) {
          const k = (u - TL.shake[0]) / SHAKE, i = Math.min(SHAKES - 1, Math.floor(k)), f = k - i;
          const push = f < 0.7 ? sm(0, 0.7, f) : 1 - sm(0.7, 0.86, f);
          P.addScaledVector(ax, 0.032 * push);
          Q.premultiply(_q2.setFromAxisAngle(_v2.set(0, 0, 1).applyQuaternion(cam.q), 0.07 * Math.sin(f * Math.PI * 2)));
          const at = [ud.rollX + 0.025, 0.03, 0.09, 0.15, 0.21], g = sm(0.7, 0.9, f);
          rx = lerp(at[i], at[i + 1], g); ry = i === 0 ? lerp(ud.rollY * 0.5, 0, g) : 0;
        }
        roll.position.set(rx, ry, 0); twine.position.set(rx, ry, 0);
        setWorld(P, Q, 1);
        return;
      }
      if (!st.cork.free) popCork();
      if (st.cb) {
        /* taken: the letter goes to be read from just where it is, its twine slips off and falls */
        model.updateMatrixWorld(true);
        const p = roll.getWorldPosition(new T.Vector3()), q = model.getWorldQuaternion(new T.Quaternion());
        roll.visible = false; toScene(twine); st.twine.free = true; st.twine.t = 0; st.twine.v.set(0.1, 0.3, 0).applyQuaternion(cam.q);
        const cb = st.cb; st.cb = null; cb({ p: p.toArray(), q: q.toArray(), s: 1 });
      }
      if (u < TL.home) {
        /* and the bottle is put down, out of view */
        const s = sm5((u - TL.lower[0]) / (TL.lower[1] - TL.lower[0])), pose = blendHeld(HOLD.b, HOLD.c, s, u, poseB);
        setWorld(pose.p, pose.q, 1); model.visible = s < 1;
        return;
      }
      home(); st.phase = 'down';
    }

    /* put back: from wherever it is, the bottle goes back to its place on the sand, the letter back inside, the cork back in */
    function abort() {
      if (st.phase === 'rest' || st.phase === 'back') return;
      const taken = !st.cb; st.cb = null;
      if (st.phase === 'quick') {
        /* (the cork was only hopping off: it hops back, the letter never left) */
        if (!taken) { letterHome(); startHop(0.6); st.phase = 'rest'; } else st.phase = 'down';
        return;
      }
      if (taken) {
        /* (the letter is out, being read: the bottle goes straight to its place, and waits there for it) */
        if (model.parent !== bottle) home();
        st.phase = 'down'; return;
      }
      restWorld(); model.updateMatrixWorld(true);
      st.back = { t0: performance.now() / 1000, p0: model.position.clone(), q0: model.quaternion.clone(), s0: model.scale.x, roll0: roll.position.clone(), cork0: st.cork.free ? null : { p: cork.position.clone(), q: cork.quaternion.clone() } };
      if (st.cork.free) startHop(0.95);
      st.phase = 'back';
    }
    function stepBack(t) {
      const b = st.back, k = clamp01((t - b.t0) / 0.9), e = sm5(k);
      _p.lerpVectors(b.p0, st.rP, e); _p.y += 0.15 * Math.sin(Math.PI * k);
      setWorld(_p, _q.slerpQuaternions(b.q0, st.rQ, e), lerp(b.s0, st.rS, e));
      roll.position.lerpVectors(b.roll0, rest.roll, e); twine.position.copy(roll.position);
      if (b.cork0) { cork.position.lerpVectors(b.cork0.p, rest.cork.p, e); cork.quaternion.slerpQuaternions(b.cork0.q, rest.cork.q, e); }
      if (k >= 1) { home(); if (b.cork0) corkHome(); letterHome(); st.back = null; st.phase = 'rest'; }
    }
    /* the letter is back in the bottle on the sand: it shows again, and the cork hops back in */
    function letterBack() {
      if (model.parent !== bottle) home();
      letterHome(); restWorld();
      if (st.cork.free) startHop(); else corkHome();
      st.phase = 'rest';
    }
    /* how far the bottle is from the camera while it is in hand (for focusing on it), else null */
    function dist() {
      if (st.phase === 'rest' || st.phase === 'down' || st.phase === 'quick' || !model.visible || model.parent === bottle) return null;
      return model.getWorldPosition(_v).distanceTo(camera.position);
    }
    return { open, update, abort, letterBack, letterRest, dist, get phase() { return st.phase; }, get busy() { return st.phase !== 'rest' && st.phase !== 'down'; } };
  }
  return { make, TL };
})();
