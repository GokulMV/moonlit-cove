/* ─────────────────────────────────────────────────────────────
   huts.js — the island's beach huts (Layout.isle; their model is
   models/struct/beachhut.js): a few along the top of the beach
   either side of the camp, each in its own clearing at the forest's
   edge with a lawn of grass in front, its steps down to the sand,
   facing the sea; one of them, nearest the camp, the work hut, with
   the boards on its walls. Walked up to, up the steps and in: the
   floor is a floor, the walls are walls, the door a way in when it
   is open. The van can't drive into them. At dusk their lamps come
   on; a click on a door, a shutter, a lamp works it, on the hammock
   lies in it, on a board reads it.
   ───────────────────────────────────────────────────────────── */
const IsleHuts = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* where they stand: how far along the beach from the camp (u, m: south positive), which kind, which shape */
  const SITES = [{ u: 46, kind: 'work', seed: 3 }, { u: -62, kind: 'stay', seed: 5 }, { u: 122, kind: 'stay', seed: 7 }, { u: -150, kind: 'stay', seed: 9 }, { u: 205, kind: 'stay', seed: 11 }];
  /* (how far each hut's middle is inland of the forest's edge, m; its clearing's reach, and its lawn's) */
  const BACK = 1.2, CLEAR = 10.5, LAWN = 8;

  /* where each hut goes, worked out from the island: its middle, the way it faces (out to sea along the shore's normal),
     its clearing in the forest, its lawn */
  function plan(I) {
    const Q = {};
    return SITES.map((S, i) => {
      const q = I.shore(S.u, Q), d = q.W + BACK, x = q.x - q.nx * d, z = q.z - q.nz * d, ry = Math.atan2(q.nx, q.nz);
      return { i, ...S, x, z, ry, nx: q.nx, nz: q.nz, W: q.W, clear: [x + q.nx * 1.5, z + q.nz * 1.5, CLEAR], lawn: [x + q.nx * 5, z + q.nz * 5, LAWN, 0.9] };
    });
  }

  /* a board's picture: its title, its lines, on a pale painted board, lettered as by hand (repainted when the fonts come) */
  function boardCanvas(B, cv) {
    const c = cv || document.createElement('canvas'); c.width = 1024; c.height = 760; const a = c.getContext('2d');
    const gr = a.createLinearGradient(0, 0, 1024, 760); gr.addColorStop(0, '#e9dfc8'); gr.addColorStop(1, '#d8cbb0'); a.fillStyle = gr; a.fillRect(0, 0, 1024, 760);
    for (let i = 0; i < 2200; i++) { a.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,40' : '255,250,235'},${0.02 + Math.random() * 0.04})`; a.fillRect(Math.random() * 1024, Math.random() * 760, 1 + Math.random() * 2, 6 + Math.random() * 30); }
    a.fillStyle = '#7a5a33'; a.font = "500 30px 'JetBrains Mono', monospace"; a.fillText((B.eyebrow || '').toUpperCase(), 64, 92);
    a.fillStyle = '#2a2116'; a.font = "600 92px Fraunces, Georgia, serif"; a.fillText(B.title || '', 60, 198);
    a.strokeStyle = 'rgba(122,90,51,0.5)'; a.lineWidth = 3; a.beginPath(); a.moveTo(64, 232); a.lineTo(960, 232); a.stroke();
    a.fillStyle = '#2f2619'; a.font = "500 50px 'Instrument Sans', Arial, sans-serif";
    (B.lines || []).slice(0, 6).forEach((t, k) => { a.fillStyle = '#b5652d'; a.beginPath(); a.arc(78, 300 + k * 72 - 14, 7, 0, TAU); a.fill(); a.fillStyle = '#2f2619'; a.fillText(t, 104, 300 + k * 72); });
    a.fillStyle = 'rgba(47,38,25,0.6)'; a.font = "500 34px Caveat, cursive"; a.fillText('click to read', 760, 720);
    return c;
  }

  function build(root, I, world, o = {}) {
    const P = o.plan || plan(I), group = new T.Group(); group.name = 'huts'; root.add(group);
    const content = (typeof Content !== 'undefined' && Content.work) || [];
    const huts = P.map(p => {
      const boards = p.kind === 'work' ? content.slice(0, 4).map(B => ({ id: B.id, B, canvas: boardCanvas(B) })) : null;
      let g = null; try { g = Models.make('struct/beachhut', { kind: p.kind, seed: p.seed, boards }); } catch (e) { console.warn('IsleHuts:', e); return null; }
      const info = g.userData.info, use = g.userData.use;
      /* (it stands on the lowest ground under its footprint: its front pads on the sand, the back ones sunk a little) */
      let y0 = 1e9; const cs = Math.cos(p.ry), sn = Math.sin(p.ry), W = (lx, lz) => [p.x + lx * cs + lz * sn, p.z - lx * sn + lz * cs];
      for (const [lx, lz] of [[-info.X, -info.Z], [info.X, -info.Z], [-info.X, info.Z + info.VZ], [info.X, info.Z + info.VZ], [0, 0]]) { const [x, z] = W(lx, lz); y0 = Math.min(y0, world.land(x, z)); }
      y0 = Math.max(y0, 0);
      g.position.set(p.x, y0, p.z); g.rotation.y = p.ry; g.updateMatrixWorld(true); group.add(g);
      /* (each shutter's own frame, kept, its swing worked in it) */
      for (const s of use.shutters) s.q0 = s.pivot.quaternion.clone();
      return { p, g, info, use, y0, cs, sn, W, boards, seen: true, k: 0 };
    }).filter(Boolean);
    /* the hut's own coordinates of a world point (x across its front, z out toward the sea from its middle) */
    const loc = (h, x, z) => { const dx = x - h.p.x, dz = z - h.p.z; return [dx * h.cs - dz * h.sn, dx * h.sn + dz * h.cs]; };

    /* ── walking: up the steps, along the verandah, in at the door when it is open; the floor's height there. From the sand
       a walker can't step up onto the floor, nor walk under it; the walls and the railing stand in the way ── */
    const STEP = 0.75;
    function walk(x, z, out, foot) {
      for (const h of huts) {
        const [lx, lz] = loc(h, x, z), F = h.info, fy = h.y0 + F.floor, X = F.X, Z = F.Z, VZ = F.VZ;
        if (Math.abs(lx) > X + 1.5 || lz < -Z - 1.5 || lz > Z + VZ + 2.2) continue;
        /* (the steps: their tread's height along them) */
        const [sx0, sx1, sz0, sz1] = F.steps;
        if (lx > sx0 + 0.05 && lx < sx1 - 0.05 && lz >= sz0 - 0.02 && lz <= sz1) { const y = h.y0 + F.floor * (1 - (lz - sz0) / (sz1 - sz0)); out.ok = true; out.kind = 'deck'; out.y = Math.max(y, out.y); out.wade = 0; return true; }
        const onFloor = Math.abs(lx) < X + 0.06 && lz > -Z - 0.06 && lz < Z + VZ + 0.02;
        if (!onFloor) {
          /* (close round the hut at the sand's level: under its eaves, fine; under its floor, no) */
          continue;
        }
        if (foot !== undefined && foot < fy - STEP) { out.ok = false; out.kind = 'hut'; return true; }
        /* (the walls: the room's, a hand's breadth thick, broken by the door where it is open; the railing round the
           verandah, open at the steps) */
        const t = 0.16, inRoomX = Math.abs(lx) < X - t, door = h.use.doors[0], dOpen = !door || door.k > 0.55;
        const atFront = Math.abs(lz - Z) < t, atBack = Math.abs(lz + Z) < t, atSide = Math.abs(Math.abs(lx) - X) < t && lz < Z + t;
        const inDoor = Math.abs(lx) < F.door[1] - 0.08;
        if ((atFront && !(inDoor && dOpen)) || atBack || atSide) { out.ok = false; out.kind = 'wall'; return true; }
        if (lz > Z && (Math.abs(Math.abs(lx) - X) < 0.12 || (lz > Z + VZ - 0.14 && !(lx > sx0 && lx < sx1)))) { out.ok = false; out.kind = 'rail'; return true; }
        void inRoomX;
        out.ok = true; out.kind = 'deck'; out.y = fy; out.wade = 0; return true;
      }
      return false;
    }
    /* what the van must drive round (and a walker not on the deck): the hut's footprint, as circles along it */
    const obsOut = [];
    function obstacles(x, z, list) {
      for (const h of huts) {
        if (Math.hypot(x - h.p.x, z - h.p.z) > 16) continue;
        const F = h.info;
        if (!h.circ) { h.circ = []; for (let lx = -F.X; lx <= F.X + 1e-6; lx += F.X / 2) for (let lz = -F.Z; lz <= F.Z + F.VZ + 1e-6; lz += (F.Z * 2 + F.VZ) / 4) { const [wx, wz] = h.W(lx, lz); h.circ.push([wx, wz, 1.25, 'hut']); }
          const [s0x, s0z] = h.W(0, F.steps[2] + 0.6); h.circ.push([s0x, s0z, 0.9, 'hut']); }
        for (const c of h.circ) list.push(c);
      }
      return list;
    }
    void obsOut;

    /* ── the lamps, as the shaders light them (glsl.js ART: uHutL): the nearest huts' lamps, and each hut's room (uHutB, uHutS),
       so a lamp inside lights the room and only a little of what is outside it, and the room keeps out most of the
       sky's light ── */
    const U = Mats.U, NB = U.uHutB.value.length, NL = U.uHutL.value.length;
    let nightK = 0;
    function lights(cam) {
      const near = huts.map(h => [Math.hypot(h.p.x - cam.x, h.p.z - cam.z), h]).sort((a, b) => a[0] - b[0]).slice(0, NB);
      let nl = 0;
      U.uHutB.value.forEach(v => v.set(0, 0, 1, 0)); U.uHutS.value.forEach(v => v.set(0, 0, 0, -1)); U.uHutL.value.forEach(v => v.set(0, 0, 0, 0)); U.uHutLi.value.forEach(v => v.set(-1, 0, 0, 0));
      near.forEach(([d, h], bi) => {
        const F = h.info; U.uHutB.value[bi].set(h.p.x, h.p.z, h.cs, h.sn); U.uHutS.value[bi].set(F.X, F.Z, F.VZ, h.y0 + F.floor);
        h.use.lamps.forEach((L, li) => {
          if (nl >= NL || L.k < 0.01) return;
          const p = h.g.localToWorld(new T.Vector3(...L.at)), flick = 0.93 + 0.05 * Math.sin(performance.now() / 1000 * 11 + li * 3) + 0.03 * Math.sin(performance.now() / 1000 * 23 + li);
          U.uHutL.value[nl].set(p.x, p.y, p.z, L.k * flick); U.uHutLi.value[nl].set(li === 0 ? bi : -1, 0, 0, 0); nl++;
        });
      });
    }

    /* ── every frame: the doors and the shutters easing to where they were set, the lamps' glow, the hammock's sway; the
       huts far off hidden ── */
    const Rx = new T.Quaternion(), AX = new T.Vector3(1, 0, 0);
    function update(dt, t, cam, S) {
      const night = S ? 1 - sm(-4, 6, S.sAlt) : 0; nightK = night;
      for (const h of huts) {
        const d = Math.hypot(h.p.x - cam.x, h.p.z - cam.z); h.g.visible = d < (o.far ?? 420);
        if (!h.g.visible) continue;
        const a = 1 - Math.exp(-dt * 3.2);
        for (const D of h.use.doors) { D.k = (D.k ?? D.open) + (D.open - (D.k ?? D.open)) * a; D.pivot.rotation.y = D.k * 1.6; }
        for (const s of h.use.shutters) { s.k = (s.k ?? s.open) + (s.open - (s.k ?? s.open)) * a; Rx.setFromAxisAngle(AX, -s.k * s.max); s.pivot.quaternion.copy(s.q0).multiply(Rx);
          /* (the prop: from the sill out to the shutter's lower edge) */
          if (s.prop) { s.prop.visible = s.k > 0.5; if (s.prop.visible) { const tip = s.pivot.localToWorld(new T.Vector3(0, -s.h * 0.92, 0)), sill = h.g.localToWorld(s.sill.clone()), L = tip.distanceTo(sill);
            s.prop.position.copy(tip).lerp(sill, 0.5); s.prop.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tip.clone().sub(sill).normalize()); s.prop.scale.set(1, L, 1); } } }
        for (const L of h.use.lamps) {
          /* (lit at dusk by themselves, unless put out by hand; put out at dawn) */
          const want = L.user ?? (night > 0.5 ? 1 : 0); L.k = (L.k ?? 0) + (want - (L.k ?? 0)) * (1 - Math.exp(-dt * 4));
          for (const m of L.glow) m.opacity = Math.min(1, L.k * (m === L.glow[0] ? 1 : 0.35));
          L.flame.visible = L.halo.visible = L.k > 0.01;
        }
        if (h.use.hammock) { const m = h.use.hammock.mesh; m.rotation.z = 0; m.position.y = 0.006 * Math.sin(t * 0.9 + h.p.i); }
      }
      lights(cam);
    }

    /* ── clicks: the things of the huts near enough to reach (a walker's arm's length and a few steps; nearer still from the
       explore camera): which one a ray from the eye meets first ── */
    const _r = new T.Raycaster();
    function pick(ray, maxD = 14) {
      let best = null, bd = maxD;
      for (const h of huts) {
        if (!h.g.visible || ray.ray.origin.distanceTo(h.g.position) > maxD + 8) continue;
        const test = (obj, id) => { const hit = ray.intersectObject(obj, true)[0]; if (hit && hit.distance < bd) { bd = hit.distance; best = id; } };
        h.use.doors.forEach((D, k) => test(D.pivot, `hut:${h.p.i}:door:${k}`));
        h.use.shutters.forEach((s, k) => test(s.pivot, `hut:${h.p.i}:shutter:${k}`));
        h.use.lamps.forEach((L, k) => test(L.group, `hut:${h.p.i}:lamp:${k}`));
        if (h.use.hammock) test(h.use.hammock.mesh, `hut:${h.p.i}:hammock:0`);
        h.use.boards.forEach((B, k) => test(B.group, `hut:${h.p.i}:board:${k}`));
      }
      void _r; return best;
    }
    /* working the thing a click found: a door or a shutter opens or shuts, a lamp is lit or put out; what it was, said */
    function use(id) {
      const [, hi, what, k] = id.split(':'), h = huts.find(q => q.p.i === +hi); if (!h) return null;
      if (what === 'door') { const D = h.use.doors[+k]; D.open = D.open > 0.5 ? 0 : 1; return { what, open: D.open }; }
      if (what === 'shutter') { const s = h.use.shutters[+k]; s.open = s.open > 0.5 ? 0 : 1; return { what, open: s.open }; }
      if (what === 'lamp') { const L = h.use.lamps[+k]; L.user = (L.k ?? 0) > 0.5 ? 0 : 1; return { what, on: L.user }; }
      if (what === 'board') { const B = h.use.boards[+k]; return { what, id: B.id }; }
      if (what === 'hammock') return { what, hut: h.p.i };
      return null;
    }
    /* where to lie in the hammock, sit on the bench or the bed, from a hut's seat: the eye, the way it looks */
    function seatPose(hi, kind) {
      const h = huts.find(q => q.p.i === hi); if (!h) return null;
      if (kind === 'hammock' && h.use.hammock) {
        const m = h.use.hammock.mid.clone(); const w = h.g.localToWorld(m.clone()), f = h.g.localToWorld(m.clone().add(new T.Vector3(0, 0, 1))).sub(w).setY(0).normalize();
        return { eye: [w.x, w.y + 0.42, w.z], yaw: Math.atan2(f.x, -f.z), pitch: 0.12, kind: 'hammock', name: 'The hammock', id: `hut:${hi}:hammock` };
      }
      const s = h.use.seats.find(q => q.kind === kind); if (!s) return null;
      const w = h.g.localToWorld(new T.Vector3(...s.at)), f = h.g.localToWorld(new T.Vector3(s.at[0] + s.face[0], s.at[1], s.at[2] + s.face[2])).sub(w).setY(0).normalize();
      return { eye: [w.x, w.y + (kind === 'bed' ? 0.55 : 0.55), w.z], yaw: Math.atan2(f.x, -f.z), pitch: -0.05, kind, name: kind === 'bed' ? 'The bed' : kind === 'chair' ? 'At the desk' : 'The bench', id: `hut:${hi}:${kind}` };
    }
    /* (the boards repainted once the page's fonts have come: drawn before, they were in the fallbacks) */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const h of huts) for (const b of h.boards || []) { boardCanvas(b.B, b.canvas); if (b.tex) b.tex.needsUpdate = true; } });
    /* how far inside a hut's room a point is (0 out, 1 well in): as glsl.js hutIn, for the eye — inside, it opens up for the
       room's dimmer light as eyes do (engine.js), and the doorway and the windows go bright */
    function inside(x, y, z) {
      let k = 0;
      for (const h of huts) {
        const F = h.info, [lx, lz] = loc(h, x, z), fy = h.y0 + F.floor; if (Math.abs(lx) > F.X + 0.5 || Math.abs(lz) > F.Z + 0.5) continue;
        k = Math.max(k, sm(F.X + 0.05, F.X - 0.45, Math.abs(lx)) * sm(F.Z + 0.05, F.Z - 0.45, Math.abs(lz)) * sm(fy - 0.2, fy + 0.4, y) * sm(fy + 4.2, fy + 3.2, y));
      }
      return k;
    }
    const stats = () => ({ huts: huts.length, lamps: huts.reduce((n, h) => n + h.use.lamps.filter(L => L.k > 0.5).length, 0), night: +nightK.toFixed(2) });
    return { huts, walk, obstacles, update, pick, use, seatPose, inside, stats, plan: P, group };
  }
  return { SITES, plan, build, boardCanvas };
})();
