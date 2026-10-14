/* ─────────────────────────────────────────────────────────────
   isfauna.js — the island's animals (Layout.isle), out where they
   live round the eye: bearded pigs rooting along the top of a beach
   under the trees, a troop of long-tailed macaques at the forest's
   edge, a monitor lizard on the creek's bank, egrets stalking the
   mangroves' mud and the rocks, mudskippers and fiddler crabs out
   on the mud, a pair of hornbills flying over the canopy, a kite
   wheeling over the coast. Each kind is built once (coarser than the
   studio's: models/wild/rig.js's Q), the rest of its kind copies of
   it; each goes about its own business and keeps its distance —
   come too close and it moves off, runs, or flies. Where they are to
   be found is worked out from the island itself, so the same places
   have them every time.
   ───────────────────────────────────────────────────────────── */
const IsleFauna = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  const hash = (i, k) => { let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((k | 0) + 0x27d4eb2d, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };

  /* the kinds: the model; how many are out at once; where they live (the habitat their spots are drawn from); how they
     move (ground: walk and pause; wader: stalk the shallows; critter: small, on the mud; flier: across the sky; soarer:
     circling); their clips; their pace (m/s at the walk clip's own rate); how near they let the eye come; their size */
  const KINDS = {
    pig: { model: 'wild/pig', n: 2, hab: 'beachtop', move: 'ground', walk: 'walk', v: 0.75, idle: ['root', 'sniff', 'graze', 'stand'], flee: 'trot', fv: 2.6, near: 9, s: [0.8, 1.0], group: 3 },
    macaque: { model: 'wild/macaque', n: 4, hab: 'beachtop', move: 'ground', walk: 'walk', v: 0.55, idle: ['sit', 'eat', 'groom', 'scratch', 'stand'], flee: 'run', fv: 3.0, near: 7, s: [0.75, 1.0], group: 5 },
    monitor: { model: 'wild/monitor', n: 1, hab: 'creekbank', move: 'ground', walk: 'walk', v: 0.35, idle: ['bask', 'tongue', 'stand'], flee: 'run', fv: 2.4, near: 6, s: [0.9, 1.1] },
    egret: { model: 'wild/egret', n: 3, hab: 'mud', move: 'wader', walk: 'stalk', v: 0.12, idle: ['stand', 'stalk', 'strike', 'stir', 'preen'], near: 13, s: [0.95, 1.05], group: 3 },
    mudskipper: { model: 'wild/mudskipper', n: 6, hab: 'mud', move: 'critter', walk: 'skip', v: 0.5, idle: ['rest', 'display', 'crawl'], near: 4, s: [0.9, 1.15], group: 6 },
    fiddler: { model: 'wild/fiddler', n: 8, hab: 'mud', move: 'critter', walk: 'walk', v: 0.25, idle: ['stand', 'wave', 'feed', 'wave'], near: 3, s: [0.9, 1.15], group: 8 },
    hornbill: { model: 'wild/hornbill', n: 2, hab: 'sky', move: 'flier', fly: 'fly', glide: 'flapglide', v: 9, alt: [28, 55], s: [1, 1] },
    kite: { model: 'wild/kite', n: 1, hab: 'coast', move: 'soarer', fly: 'soar', v: 8, alt: [55, 110], s: [1, 1] }
  };
  /* how near the eye a kind is out (m), and how far its spots are looked for */
  const OUT = 95, SKY = 600;

  /* a copy of a creature: the same meshes (their geometry and materials shared), its own bones and its own rig */
  function copyOf(g0) {
    const rig0 = g0.userData.rig, S = rig0.S, g = g0.clone(true), by = {};
    g.traverse(o => { if (o.isBone) by[o.name] = o; });
    const bones = S.names.map(n => by[n]), S2 = Object.assign({}, S, { bones, by, skeleton: new T.Skeleton(bones, S.skeleton.boneInverses.map(m => m.clone())) });
    g.traverse(o => { if (o.isSkinnedMesh) o.bind(S2.skeleton, o.bindMatrix); });
    Rig.creature(g, S2, rig0.clips, {});
    return g;
  }

  function build(root, I, o) {
    const land = o.land, group = new T.Group(); group.name = 'fauna'; root.add(group);
    const SQ = {};
    /* ── where each kind is to be found: spots over the island drawn from its habitat, a grid of them, each one place ── */
    const L = I.data.line, spots = {};
    for (const k in KINDS) spots[k] = [];
    for (let i = 0; i < L.n; i += 7) {
      const sand = L.K[i * 4], rock = L.K[i * 4 + 1], mang = L.K[i * 4 + 3], W = L.W[i], tx = L.TX[i], tz = L.TZ[i], tl = Math.hypot(tx, tz) || 1;
      let nx = tz / tl, nz = -tx / tl; if (I.sdf(L.X[i] + nx * 6, L.Z[i] + nz * 6) < I.sdf(L.X[i] - nx * 6, L.Z[i] - nz * 6)) { nx = -nx; nz = -nz; }
      const at = d => [L.X[i] - nx * d, L.Z[i] - nz * d], h = hash(i, 7);
      /* (the top of a beach, under the first trees) */
      if (sand > 0.8 && h < 0.5) { const [x, z] = at(W - 2 + 4 * hash(i, 8)); if (Math.hypot(x - Layout.camp.x, z - Layout.camp.z) > 34 && !(o.keep || []).some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + 6)) { spots.pig.push({ x, z, tx: tx / tl, tz: tz / tl, nx, nz }); spots.macaque.push({ x, z, tx: tx / tl, tz: tz / tl, nx, nz }); } }
      /* (the mangroves' mud, between the water and the trees) */
      if (mang > 0.6) { const [x, z] = at(-2 + 10 * hash(i, 9)); for (const k of ['egret', 'mudskipper', 'fiddler']) spots[k].push({ x, z, tx: tx / tl, tz: tz / tl, nx, nz }); const [x2, z2] = at(14 + 6 * hash(i, 10)); spots.monitor.push({ x: x2, z: z2, tx: tx / tl, tz: tz / tl, nx, nz }); }
      /* (the rocks at the water: egrets fish from them too) */
      if (rock > 0.7 && h < 0.2) { const [x, z] = at(-1); spots.egret.push({ x, z, tx: tx / tl, tz: tz / tl, nx, nz }); }
    }
    /* ── the kinds built (the first time one is wanted), and their copies ── */
    const made = {}, out = [], Qc = { cell: 2.6, shells: 0.45 };
    function make(k) {
      if (made[k] !== undefined) return made[k];
      const K = KINDS[k], q0 = { cell: Rig.Q.cell, shells: Rig.Q.shells };
      Object.assign(Rig.Q, Qc);
      let g0 = null; try { g0 = Models.make(K.model, { seed: 3 }); } catch (e) { console.warn('IsleFauna: ' + k, e); }
      Object.assign(Rig.Q, q0);
      made[k] = g0 && g0.userData.rig ? { g0, free: [g0] } : null;
      return made[k];
    }
    const take = k => { const M = make(k); if (!M) return null; let g = M.free.pop(); if (!g) g = copyOf(M.g0); g.visible = true; if (!g.parent) group.add(g); return g; };
    const give = (k, g) => { g.visible = false; made[k].free.push(g); };

    /* ── one animal: where it is, which way it faces, what it is doing and for how long ── */
    function spawn(k, sp, j, t) {
      const K = KINDS[k], g = take(k); if (!g) return null;
      const r = (q) => hash(Math.round(sp.x * 7 + sp.z * 13) + j * 101, q), s = K.s[0] + (K.s[1] - K.s[0]) * r(1);
      const a = {
        k, K, g, rig: g.userData.rig, sp, s, home: [sp.x, sp.z], x: sp.x + (r(2) - 0.5) * 6, z: sp.z + (r(3) - 0.5) * 6, y: 0, h: r(4) * TAU, state: 'idle', until: t + 2 + r(5) * 6, clip: null, dir: r(6) < 0.5 ? 1 : -1,
        /* (fliers: a line across the sky, or a circle) */
        alt: K.alt ? K.alt[0] + (K.alt[1] - K.alt[0]) * r(7) : 0, cx: sp.x, cz: sp.z, R: 60 + 80 * r(8), ph: r(9) * TAU
      };
      g.scale.setScalar(s); setClip(a, K.idle ? K.idle[0] : K.fly, 1); out.push(a);
      return a;
    }
    function setClip(a, name, rate = 1) { if (a.clip === name && a.rate === rate) return; a.clip = name; a.rate = rate; a.rig.play(name, { rate }); }

    /* ── every frame: who is out round the eye (the nearest spots of each kind, as many as the kind has), and what each
       does ── */
    let lastX = 1e9, lastZ = 1e9, buildDue = 0, lastT = -1e9;
    function update(dt, t, cam, o = {}) {
      const cx = cam.x, cz = cam.z;
      /* (none out with the Animals setting off; the fliers only by day) */
      group.visible = !(o.dens && o.dens.animals === 0);
      if (!group.visible) return;
      for (const a of out) if (a.K.move === 'flier' || a.K.move === 'soarer') a.g.visible = (o.day ?? 1) > 0.2;
      /* (every few metres the eye moves, and every second or so: who should be out, the nearest of each kind's spots
         within reach; one kind brought out at a time) */
      if (Math.hypot(cx - lastX, cz - lastZ) > 6 || performance.now() - lastT > 900) {
        lastX = cx; lastZ = cz; lastT = performance.now();
        for (const k in KINDS) {
          const K = KINDS[k]; if (K.move === 'flier' || K.move === 'soarer') continue;
          const near = spots[k].map(sp => [Math.hypot(sp.x - cx, sp.z - cz), sp]).filter(q => q[0] < OUT).sort((p, q) => p[0] - q[0]);
          const want = near.length ? near[0][1] : null, mine = out.filter(a => a.k === k);
          /* (a group keeps to one spot; those out at a spot gone out of reach go home) */
          for (const a of mine) if (!want || a.sp !== want) { if (Math.hypot(a.x - cx, a.z - cz) > OUT * 0.8) { give(k, a.g); out.splice(out.indexOf(a), 1); } }
          if (want && !mine.some(a => a.sp === want) && performance.now() > buildDue) {
            const n = Math.min(K.n, K.group || 1);
            for (let j = 0; j < n; j++) spawn(k, want, j, t);
            /* (a kind built for the first time takes a while: the next waits a moment) */
            buildDue = performance.now() + 400;
            break;
          }
        }
        /* (the fliers: always a couple of them about the sky round the island, by day) */
        for (const k of ['hornbill', 'kite']) if (!out.some(a => a.k === k) && performance.now() > buildDue) { spawn(k, { x: cx, z: cz }, 0, t); buildDue = performance.now() + 400; break; }
      }
      for (const a of out) step(a, dt, t, cam);
    }
    const _e = new T.Euler();
    function step(a, dt, t, cam) {
      const K = a.K, dx = a.x - cam.x, dz = a.z - cam.z, dEye = Math.hypot(dx, dz);
      if (K.move === 'flier') {
        /* (across the island and back, high over the canopy: a long straight flap and glide, a slow turn at the ends) */
        a.ph += dt * K.v / Math.max(80, a.R * 2.4);
        const ang = a.ph, R = a.R * 3, x = a.cx + Math.cos(ang) * R, z = a.cz + Math.sin(ang * 0.7) * R * 0.6;
        const h = Math.atan2(-(z - a.z), x - a.x); a.x = x; a.z = z; a.y = Math.max(land(x, z), 0) + a.alt + 30 * Math.max(0, Math.sin(ang * 0.37));
        if (Number.isFinite(h)) a.h += wrapA(h - a.h) * Math.min(1, dt * 2);
        setClip(a, Math.sin(t * 0.3 + a.R) > 0.2 ? K.glide : K.fly);
      } else if (K.move === 'soarer') {
        /* (circling on the air rising off the coast, now and then drifting off along it) */
        a.ph += dt * K.v / a.R; a.cx += Math.cos(t * 0.01 + a.R) * dt * 1.2; a.cz += Math.sin(t * 0.013) * dt * 1.2;
        const x = a.cx + Math.cos(a.ph) * a.R, z = a.cz + Math.sin(a.ph) * a.R, h = Math.atan2(-(z - a.z), x - a.x);
        a.x = x; a.z = z; a.y = a.alt + 8 * Math.sin(a.ph * 0.5); if (Number.isFinite(h)) a.h = h; setClip(a, K.fly);
      } else {
        /* (on the ground: pauses — rooting, sitting, stalking — and walks between them, round its spot; too near, it moves
           off away from the eye, and comes back when left alone) */
        const flee = dEye < K.near;
        if (flee && a.state !== 'flee') { a.state = 'flee'; a.until = t + 3 + 2 * hash(a.g.id, 3); }
        if (!flee && a.state === 'flee' && t > a.until) { a.state = 'idle'; a.until = t + 2; }
        if (a.state !== 'flee' && t > a.until) {
          const r = hash(Math.floor(t * 10), a.g.id);
          if (a.state === 'idle' && r < 0.55) { a.state = 'walk'; a.until = t + 3 + 6 * r; const bx = a.home[0] - a.x, bz = a.home[1] - a.z, back = Math.hypot(bx, bz) > 10; a.h = back ? Math.atan2(-bz, bx) : a.h + (r - 0.27) * 2.2; }
          else { a.state = 'idle'; a.until = t + 3 + 7 * r; a.idle = K.idle[Math.floor(hash(a.g.id, Math.floor(t)) * K.idle.length) % K.idle.length]; }
        }
        let v = 0;
        if (a.state === 'flee') {
          if (K.move === 'wader') {
            /* (a heron lifts off and flies a little way along the shore, and lands) */
            const away = Math.atan2(-dz, dx); a.h += wrapA(away - a.h) * Math.min(1, dt * 3); v = 5;
            a.y = Math.min(a.y + dt * 2.5, 4); setClip(a, a.y < 3 ? 'takeoff' : 'fly');
          } else if (K.move === 'critter') { setClip(a, K.walk, 2); v = K.v * 2.5; const away = Math.atan2(-dz, dx); a.h += wrapA(away - a.h) * Math.min(1, dt * 4); }
          else { const away = Math.atan2(-dz, dx); a.h += wrapA(away - a.h) * Math.min(1, dt * 3); setClip(a, K.flee); v = K.fv; }
        } else if (a.state === 'walk') { setClip(a, K.walk); v = K.v; if (K.move === 'wader' && a.y > 0.01) a.y = Math.max(0, a.y - dt * 2); }
        else { setClip(a, a.idle || K.idle[0]); if (K.move === 'wader' && a.y > 0.01) { a.y = Math.max(0, a.y - dt * 2); setClip(a, 'land'); } }
        a.x += Math.cos(a.h) * v * dt; a.z -= Math.sin(a.h) * v * dt;
        /* (kept to their ground: the beach's top for the pigs and the monkeys, the mud for the mud's own) */
        const s = I.sdf(a.x, a.z);
        if (K.move === 'critter' || K.move === 'wader' ? s > (K.move === 'wader' ? 1.5 : 0.5) : s > -2) { a.x -= Math.cos(a.h) * v * dt * 2; a.z += Math.sin(a.h) * v * dt * 2; a.h += Math.PI * 0.6; }
        a.y = (K.move === 'wader' ? a.y : 0);
      }
      const gy = K.move === 'flier' || K.move === 'soarer' ? a.y : Math.max(land(a.x, a.z), -0.04) + a.y;
      a.g.position.set(a.x, gy, a.z); a.g.rotation.set(0, a.h, 0); a.g.updateMatrixWorld();
      a.rig.update(dt);
    }
    const stats = () => ({ kinds: Object.keys(made).filter(k => made[k]).length, out: out.length, spots: Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, v.length])) });
    return { update, stats, out, spots, make };
  }
  return { build, KINDS, copyOf };
})();
