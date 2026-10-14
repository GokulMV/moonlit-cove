/* ─────────────────────────────────────────────────────────────
   park.js — what the park has built on the island (Layout.isle):
   in the cove south of the camp, behind its point, the jetty out
   from the middle of the beach into water deep enough for the
   boat at any tide, its shore end coming down onto the sand; the
   park's boat tied up alongside its head; up the beach, under the
   trees, the rangers' hut facing the water, the path from the
   jetty to its steps. Where each stands comes from the shore
   itself, so they keep their places as the island is.
   ───────────────────────────────────────────────────────────── */
const IslePark = (() => {
  const T = THREE, TAU = Math.PI * 2;
  /* the cove: the beach point the jetty leaves from (the nearest of the island's line to this), how far out it runs
     (to water this deep, m), its deck's height over the sea's mean, its ramp down to the sand */
  const COVE = { x: 600, z: 151, depth: 3.6, deck: 1.9, ramp: 10, inland: 7 };

  /* where the park's things stand: worked out from the island's line alone (no drawing), so the forest can keep clear of
     them before it is planted */
  function plan(I) {
    const L = I.data.line;
    let i0 = 0, bd = 1e18;
    for (let i = 0; i < L.n; i++) { const d = (L.X[i] - COVE.x) ** 2 + (L.Z[i] - COVE.z) ** 2; if (d < bd && L.K[i * 4] > 0.8) { bd = d; i0 = i; } }
    /* (the way out to sea there, square to the line, averaged over a few metres either side so the jetty runs straight out
       of the beach's curve) */
    let tx = 0, tz = 0; for (let k = -12; k <= 12; k++) { const i = (i0 + k + L.n) % L.n; tx += L.TX[i]; tz += L.TZ[i]; }
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let nx = tz, nz = -tx; if (I.sdf(L.X[i0] + nx * 8, L.Z[i0] + nz * 8) < I.sdf(L.X[i0] - nx * 8, L.Z[i0] - nz * 8)) { nx = -nx; nz = -nz; }
    /* (the water's edge on that line, exactly: the line's point is the mean water's) */
    const ex = L.X[i0], ez = L.Z[i0], W = L.W[i0];
    /* the jetty: from a few metres up the beach out to the depth the boat needs (and no further than 80 m) */
    const rx = ex - nx * COVE.inland, rz = ez - nz * COVE.inland, along = d => [rx + nx * d, rz + nz * d];
    let len = 30; for (let d = 20; d < 90; d += 1) { const [x, z] = along(d); if (I.height(x, z) < -COVE.depth) { len = d; break; } len = d; }
    const bed = d => { const [x, z] = along(d); return Math.min(0, I.height(x, z)); };
    const jetty = { x: rx, z: rz, nx, nz, yaw: Math.atan2(-nz, nx), len: len - 4.8, deck: COVE.deck, ramp: COVE.ramp, bed };
    /* the hut: up the beach and under the first trees, to one side of the jetty's line, facing the water */
    const side = 1, hd = W + 6, hs = 15, hx = ex - nx * hd + tx * hs * side, hz = ez - nz * hd + tz * hs * side;
    const hut = { x: hx, z: hz, yaw: Math.atan2(nx, nz) };
    /* the boat: alongside the jetty's head on the side its ladder is (the jetty's own +z, turned as it is), bow out to sea */
    const zx = -nz, zz = nx, bx = rx + nx * (len - 2.4) + zx * 4.55, bz = rz + nz * (len - 2.4) + zz * 4.55;
    const boat = { x: bx, z: bz, yaw: Math.atan2(-nz, nx) };
    /* the ground the forest keeps clear: the jetty's footing on the beach, the hut and round it, the path between */
    const clear = [];
    for (let d = -6; d <= COVE.inland + 3; d += 2.5) { const [x, z] = along(d); clear.push([x, z, 4.5]); }
    clear.push([hx, hz, 14]);
    for (let k = 0; k <= 10; k++) { const t = k / 10, x = rx + (hx + nx * 6 - rx) * t, z = rz + (hz + nz * 6 - rz) * t; clear.push([x, z, 3.2]); }
    return { jetty, hut, boat, clear, edge: [ex, ez], tangent: [tx, tz] };
  }

  function build(root, I, o) {
    const P = plan(I), land = o.land, group = new T.Group(); group.name = 'park'; root.add(group);
    const t0 = performance.now();
    /* the jetty, its line out from the beach (its own +x) */
    const jt = Models.make('struct/jetty', { seed: 3, len: P.jetty.len, deck: P.jetty.deck, ramp: P.jetty.ramp, foot: 0.28, bed: P.jetty.bed, head: true });
    jt.position.set(P.jetty.x, 0, P.jetty.z); jt.rotation.y = P.jetty.yaw; group.add(jt);
    /* the hut, its front (+z) to the water */
    const hut = Models.make('struct/rangerhut', { seed: 2 });
    hut.position.set(P.hut.x, land(P.hut.x, P.hut.z) - 0.05, P.hut.z); hut.rotation.y = P.hut.yaw; group.add(hut);
    /* the boat, riding at the jetty's head */
    const boat = Models.make('struct/boat', { seed: 1 });
    boat.position.set(P.boat.x, 0, P.boat.z); boat.rotation.y = P.boat.yaw; group.add(boat);
    group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    const ms = performance.now() - t0;
    /* the boat on the water: a slow heave, a little roll and pitch, as the swell comes into the cove */
    const e = new T.Euler();
    function update(t) {
      boat.position.y = 0.06 * Math.sin(t * 0.9) + 0.03 * Math.sin(t * 1.7 + 1.3);
      e.set(0.03 * Math.sin(t * 0.8 + 0.4), P.boat.yaw + 0.03 * Math.sin(t * 0.13), 0.02 * Math.sin(t * 1.1 + 2.1), 'YXZ'); boat.rotation.copy(e);
    }
    return { plan: P, update, group, ms: Math.round(ms), jetty: jt, hut, boat };
  }
  return { plan, build, COVE };
})();
