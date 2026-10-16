/* ─────────────────────────────────────────────────────────────
   snowman.js — snowballs and snowmen, when the snow lies deep
   enough. A walker starts a ball at their feet and rolls it on
   ahead: it grows as it goes, faster the deeper the snow, picking
   up the snow it rolls over (a strip of the ground left bare behind
   it). Let go, it stays where it is; let go up against a bigger
   one, it is lifted on top of it. Three high, and it is a snowman:
   pebble eyes and buttons, a carrot nose, twig arms, half a coconut
   shell for a hat, a scarf. When the snow goes, they go too,
   slumping as they melt.
   ───────────────────────────────────────────────────────────── */
const Snowmen = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const hash = (i, k) => { let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((k | 0) + 0x27d4eb2d, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  /* a ball of packed snow, a metre across before it is sized: round but never quite, its surface lumpy where snow was
     pressed on in handfuls and rolled flat in patches, a few clods sticking out */
  function ballGeo(seed) {
    const g = new T.IcosahedronGeometry(1, 4), P = g.attributes.position, v = new T.Vector3(), C = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).normalize();
      const n = Models.vn(v.x * 3.1 + seed, v.y * 3.1 + v.z * 2.3, seed) - 0.5, f = Models.vn(v.x * 9.3, v.y * 9.3 + v.z * 7.1 + seed, seed + 3) - 0.5, flat = Math.pow(Math.max(0, Math.sin(v.x * 2.1 + v.z * 1.3 + seed)), 6);
      const r = 1 + 0.035 * n + 0.012 * f - 0.02 * flat;
      P.setXYZ(i, v.x * r, v.y * r, v.z * r);
      const k = 0.94 + 0.08 * (n + 0.5) - 0.05 * flat; C[i * 3] = k * 0.97; C[i * 3 + 1] = k * 0.985; C[i * 3 + 2] = k;
    }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); g.computeVertexNormals(); return g;
  }
  function build(root, world, o = {}) {
    const group = new T.Group(); group.name = 'snowmen'; root.add(group);
    const snowM = Mats.lit({ color: new T.Color(0.88, 0.9, 0.94), vertexColors: true, roughness: 0.72 }), geos = [1, 2, 3].map(ballGeo);
    const pebM = Mats.lit({ color: new T.Color(0.05, 0.05, 0.05), roughness: 0.45 }), carM = Mats.lit({ color: new T.Color(0.75, 0.27, 0.05), roughness: 0.6 }), twigM = Mats.lit({ color: new T.Color(0.16, 0.1, 0.06), roughness: 0.9 });
    const shellM = Mats.lit({ color: new T.Color(0.2, 0.12, 0.06), roughness: 0.85 }), scarfM = Mats.lit({ color: new T.Color(0.62, 0.12, 0.08), roughness: 0.9 });
    const balls = [], men = []; let rolling = null, seq = 0;
    const ground = (x, z) => Math.max(0, world && world.walk ? world.walk(x, z).y : world ? world.land(x, z) : 0);
    function make(x, z, r) {
      const m = new T.Mesh(geos[seq % 3], snowM); m.castShadow = m.receiveShadow = true; group.add(m);
      const b = { id: ++seq, x, z, r, y: ground(x, z) + r * 0.9, m, under: null, over: null, q: new T.Quaternion(), melt: 0 };
      balls.push(b); place(b); return b;
    }
    function place(b) { b.m.position.set(b.x, b.y, b.z); b.m.quaternion.copy(b.q); b.m.scale.set(b.r, b.r * (1 - 0.25 * b.melt), b.r); }
    /* starting a ball at a walker's feet, a little ahead of them (heading h: facing (-sin h, -cos h)) */
    function start(x, z, h, depth) {
      if (rolling || depth < (o.minDepth ?? 0.05)) return null;
      rolling = make(x - Math.sin(h) * 0.75, z - Math.cos(h) * 0.75, 0.11); return rolling;
    }
    /* rolling it on: kept just ahead of the walker; it grows by the snow it picks up as it rolls, less the bigger it is
       (only its rim touches new snow), and turns over the way it goes */
    const AX = new T.Vector3(), QQ = new T.Quaternion();
    function roll(x, z, h, depth) {
      const b = rolling; if (!b) return null;
      const tx = x - Math.sin(h) * (0.55 + b.r), tz = z - Math.cos(h) * (0.55 + b.r), dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) {
        const grow = d * 0.06 * Math.min(1.4, depth / 0.08) * (0.18 / Math.max(0.18, b.r)) * (depth > 0.02 ? 1 : 0);
        b.r = Math.min(0.55, b.r + grow);
        AX.set(dz, 0, -dx).normalize(); QQ.setFromAxisAngle(AX, d / b.r); b.q.premultiply(QQ);
        b.x = tx; b.z = tz;
        if (o.track) o.track(b.x, b.z, b.r);
      }
      b.y = ground(b.x, b.z) + b.r * 0.9; place(b); return b;
    }
    /* letting it go: where it is; or, up against a bigger one with nothing on it, on top of that one */
    function letGo() {
      const b = rolling; if (!b) return null; rolling = null;
      let best = null, bd = 1e9;
      for (const q of balls) { if (q === b || q.over) continue; const d = Math.hypot(q.x - b.x, q.z - b.z); if (d < q.r + b.r + 0.35 && q.r > b.r * 1.08 && d < bd) { bd = d; best = q; } }
      if (best) {
        b.under = best; best.over = b; b.x = best.x + (hash(b.id, 1) - 0.5) * 0.04; b.z = best.z + (hash(b.id, 2) - 0.5) * 0.04; b.y = best.y + best.r * 0.86 + b.r * 0.82;
        b.q.identity(); place(b);
        /* (three high: a snowman) */
        const stack = []; for (let q = b; q; q = q.under) stack.unshift(q);
        if (stack.length >= 3 && !stack.some(q => q.man)) dress(stack);
        return { stacked: stack.length, man: stack.length >= 3 };
      }
      return { stacked: 1 };
    }
    /* dressing a snowman: its face toward where its maker stood (o.face), pebbles for eyes and buttons, a carrot, twig
       arms, a coconut shell, a scarf */
    function dress(stack) {
      const [base, mid, head] = stack, man = new T.Group(); group.add(man);
      const face = o.face ? o.face() : [head.x - 1, head.z], yaw = Math.atan2(face[0] - head.x, face[1] - head.z);
      man.position.set(0, 0, 0); const F = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), Rt = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), Up = new T.Vector3(0, 1, 0);
      const on = (b, f, r, u) => new T.Vector3(b.x, b.y, b.z).addScaledVector(F, f * b.r).addScaledVector(Rt, r * b.r).addScaledVector(Up, u * b.r);
      const pebble = (p, s) => { const m = new T.Mesh(new T.SphereGeometry(s, 8, 6), pebM); m.position.copy(p); m.castShadow = true; man.add(m); };
      for (const sx of [-1, 1]) pebble(on(head, 0.86, 0.32 * sx, 0.3), 0.022 + head.r * 0.03);
      for (let k = 0; k < 3; k++) pebble(on(mid, 0.97 - k * 0.04, 0, 0.35 - k * 0.38), 0.025);
      for (let k = 0; k < 5; k++) { const a = -0.55 + k * 0.275; pebble(on(head, 0.84 * Math.cos(a * 0.4), 0.42 * Math.sin(a), -0.32 - 0.12 * Math.cos(a * 1.6)), 0.012); }
      { const nose = new T.Mesh(new T.ConeGeometry(0.03, 0.17, 10), carM), p = on(head, 0.98, 0, 0.05); nose.position.copy(p).addScaledVector(F, 0.07); nose.quaternion.setFromUnitVectors(Up, F); nose.castShadow = true; man.add(nose); }
      for (const sx of [-1, 1]) {
        const a = on(mid, 0.0, 0.9 * sx, 0.25), b2 = a.clone().addScaledVector(Rt, sx * 0.5).addScaledVector(Up, 0.28), c = new T.CatmullRomCurve3([a.clone().addScaledVector(Rt, -sx * 0.1), a.clone().lerp(b2, 0.5).add(new T.Vector3(0, 0.03, 0)), b2]);
        const arm = new T.Mesh(new T.TubeGeometry(c, 8, 0.012, 5, false), twigM); arm.castShadow = true; man.add(arm);
        for (const f of [-0.35, 0.4]) { const s = b2.clone(), e = s.clone().addScaledVector(Rt, sx * 0.1).addScaledVector(Up, 0.08 + f * 0.1).addScaledVector(F, f * 0.06); const tw = new T.Mesh(new T.CylinderGeometry(0.005, 0.007, s.distanceTo(e), 4), twigM); tw.position.copy(s).lerp(e, 0.5); tw.quaternion.setFromUnitVectors(Up, e.clone().sub(s).normalize()); man.add(tw); }
      }
      { const shell = new T.Mesh(new T.SphereGeometry(head.r * 0.72, 18, 10, 0, TAU, 0, Math.PI / 2), shellM); shell.position.set(head.x, head.y + head.r * 0.72, head.z); shell.rotation.z = 0.12; shell.castShadow = true; man.add(shell);
        const fibre = new T.Mesh(new T.TorusGeometry(head.r * 0.72, 0.012, 6, 24), shellM); fibre.rotation.x = Math.PI / 2; fibre.position.copy(shell.position); man.add(fibre); }
      { const sc = new T.Mesh(new T.TorusGeometry(mid.r * 0.58, 0.05, 8, 28), scarfM); sc.rotation.x = Math.PI / 2; sc.position.set(mid.x, (mid.y + mid.r * 0.8 + head.y - head.r * 0.8) / 2, mid.z); sc.scale.set(1, 1, 0.8); sc.castShadow = true; man.add(sc);
        const tail = new T.Mesh(new T.BoxGeometry(0.08, 0.32, 0.02), scarfM), p = on(mid, 0.55, 0.45, 0.55); tail.position.copy(p); tail.rotation.y = yaw + 0.3; tail.rotation.z = 0.25; man.add(tail); }
      for (const q of stack) q.man = man;
      men.push({ man, stack });
    }
    /* every frame: melting when the snow goes (each ball slumping and shrinking; when it is gone, so is all on it) */
    function update(dt, depth) {
      const warm = depth < 0.015 ? 1 : 0;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i]; if (b === rolling) continue;
        if (warm) { b.r -= dt * 0.0035; b.melt = Math.min(1, b.melt + dt * 0.004); if (b.under) b.y = b.under.y + b.under.r * 0.86 * (1 - 0.25 * b.under.melt) + b.r * 0.82; else b.y = ground(b.x, b.z) + b.r * 0.9 * (1 - 0.3 * b.melt); place(b); }
        if (b.r < 0.05) { group.remove(b.m); balls.splice(i, 1); if (b.over) b.over.under = null; if (b.under) b.under.over = null;
          if (b.man) { group.remove(b.man); const k = men.findIndex(m => m.man === b.man); if (k >= 0) men.splice(k, 1); for (const q of balls) if (q.man === b.man) q.man = null; } }
      }
      for (const M of men) { const h = M.stack[M.stack.length - 1]; if (warm) M.man.position.y = Math.min(0, M.man.position.y - dt * 0.0035); void h; }
    }
    /* what stands in a walker's way (the van just knocks into them): [x, z, radius], all but the one being rolled */
    function obstacles(x, z, list) { for (const b of balls) if (b !== rolling && !b.under && Math.hypot(b.x - x, b.z - z) < 6) list.push([b.x, b.z, b.r * 0.95, 'snow']); return list; }
    const stats = () => ({ balls: balls.length, men: men.length, rolling: rolling ? +rolling.r.toFixed(2) : 0 });
    /* (the world's frame carried round the beach's loop, d m: those near the eye go with it, engine.js loopShift) */
    function shift(d, near) {
      for (const b of balls) if (near(b.x)) { b.x += d; place(b); }
      for (const M of men) { const m = M.man, x = m.userData.x ?? (m.userData.x = (() => { const bx = new T.Box3().setFromObject(m); return (bx.min.x + bx.max.x) / 2; })()); if (near(x)) { m.position.x += d; m.userData.x = x + d; m.updateMatrixWorld(true); } }
    }
    return { start, roll, letGo, update, obstacles, stats, shift, get rolling() { return rolling; }, balls, men };
  }
  return { build };
})();
