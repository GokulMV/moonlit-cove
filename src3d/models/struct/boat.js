/* ─────────────────────────────────────────────────────────────
   models/struct/boat.js — the park's boat at the jetty: a seven-
   and-a-half metre open fibreglass boat as island parks run, white
   gelcoat yellowing a little, a blue stripe under its sheer, a
   black rubbing strake; a deep V aft, the bow sharp and flared and
   rising; inside, a non-slip floor, bench seats across, a blue
   canvas canopy on stainless posts, orange life jackets in a pile,
   red fuel tanks aft; twin outboards on the transom.
   Its bow toward +x, the waterline at y = 0 (it floats with a
   third of a metre under), its middle at the origin.
   ───────────────────────────────────────────────────────────── */
(() => {
  const T = THREE, TAU = Math.PI * 2, V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t, sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const LOA = 7.5, B = 2.1;
  /* the hull's lines at s (0 the transom, 1 the bow): its sheer's half-breadth and height, its keel's height, the chine's
     half-breadth, the deadrise */
  const hb = s => (B / 2) * (s < 0.58 ? 0.93 + 0.07 * sm(0, 0.58, s) : Math.sqrt(Math.max(0, 1 - Math.pow((s - 0.58) / 0.42, 2))) * (1 - 0.03 * (s - 0.58)));
  const sh = s => 0.6 + 0.3 * Math.pow(Math.max(0, (s - 0.45) / 0.55), 2);
  const kl = s => -0.34 + 0.86 * Math.pow(Math.max(0, (s - 0.55) / 0.45), 2.2);
  const dr = s => mix(0.29, 0.75, sm(0.2, 1, s));
  const xs = s => -LOA / 2 + LOA * s;
  /* a point of the hull's skin: s along it, u across its half-section (0 the keel, 0.5 the chine, 1 the sheer), side ±1 */
  function skin(s, u, side) {
    const b = hb(s), k = kl(s), cB = b * 0.84, cY = k + cB * Math.tan(dr(s)) * 0.9, top = sh(s);
    let z, y;
    if (u < 0.5) { const t = u / 0.5; z = cB * t; y = k + (cY - k) * t - 0.05 * Math.sin(Math.PI * t) * (1 - s); }
    else { const t = (u - 0.5) / 0.5, chineY = Math.min(cY, top - 0.08); z = mix(cB, b, Math.pow(t, 0.7)); y = mix(chineY, top, t); }
    return [xs(s), y, z * side];
  }

  /* the skin's half-breadth at height y, at s */
  const halfAt = (s, y) => { let best = 0, bd = 9; for (let k = 0; k <= 40; k++) { const p = skin(s, k / 40, 1), d = Math.abs(p[1] - y); if (d < bd) { bd = d; best = p[2]; } } return best; };
  Models.add('struct/boat', (o = {}) => {
    const g = new T.Group(), R = Models.rng((o.seed || 1) * 157 + 23);
    /* ── the hull: a grid along it and round it from the port sheer under the keel to the starboard sheer ── */
    const NS = 46, NU = 16, cols = 2 * NU + 1, P = [], C = [], I = [], U = [];
    const stripe = o.stripe || [0.04, 0.16, 0.36], gel = [0.78, 0.77, 0.72], bottom = [0.48, 0.5, 0.42];
    for (let i = 0; i < NS; i++) { const s = Math.min(0.999, i / (NS - 1));
      for (let j = 0; j < cols; j++) { const side = j < NU ? -1 : 1, u = j < NU ? 1 - j / NU : (j - NU) / NU, p = skin(s, u, j === NU ? 1 : side); P.push(...p);
        /* (the colours: white above the water, a little grubby along the waterline; the stripe is painted by the texture,
           measured down from the sheer) */
        let c = gel; const y = p[1], top = sh(s); U.push(s * 6, (top - y) / 1.2);
        c = c.map(q => q * (0.96 + 0.04 * Models.vn(s * 9, u * 5 + side, 2.3)));
        if (y < 0.04) c = mix3(c, bottom, sm(0.04, -0.06, y));
        C.push(...c); } }
    for (let i = 0; i < NS - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; I.push(a, c, b, b, c, d); }
    /* (the transom: a fan across the stern's section) */
    const t0 = P.length / 3; P.push(xs(0), mix(kl(0), sh(0), 0.45), 0); C.push(...gel); U.push(0, 0.5);
    for (let j = 0; j < cols; j++) I.push(t0, j + 1 <= cols - 1 ? j + 1 : j, j);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(P, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(C, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); geo.setIndex(I); geo.computeVertexNormals();
    { const Pp = geo.attributes.position.array, Nn = geo.attributes.normal.array; let sgn = 0; for (let k = 0; k < NS * cols; k += 7) sgn += Pp[k * 3 + 2] * Nn[k * 3 + 2] + (Pp[k * 3 + 1] - 0.1) * Nn[k * 3 + 1] * 0.2;
      if (sgn < 0) { for (let k = 0; k < Nn.length; k++) Nn[k] = -Nn[k]; const ix = geo.index.array; for (let k = 0; k < ix.length; k += 3) { const q = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = q; } } }
    /* (the stripe: a broad band and a pinstripe under the sheer, crisp-edged, a little faded) */
    const stripeTex = (() => { const c = Models.canvas(16, 512), a = c.getContext('2d'), px = 512 / 1.2, col = `rgb(${stripe.map(q => Math.round(255 * Math.pow(q, 1 / 2.2))).join(',')})`;
      a.fillStyle = '#ffffff'; a.fillRect(0, 0, 16, 512); a.fillStyle = col; a.fillRect(0, 512 - 0.19 * px, 16, 0.1 * px); a.fillRect(0, 512 - 0.233 * px, 16, 0.018 * px);   /* (v runs up the canvas from its foot) */
      const t = Mats.tex(c, { repeat: true }); t.wrapT = T.ClampToEdgeWrapping; return t; })();
    const gelM = Mats.litP({ vertexColors: true, map: stripeTex, color: new T.Color(1, 1, 1), roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25, side: T.DoubleSide });
    const hull = new T.Mesh(geo, gelM); hull.castShadow = hull.receiveShadow = true; g.add(hull);
    /* ── the inside: a liner down from the gunwale to the floor, the floor, the foredeck ── */
    /* (the liner follows the skin inside it: its foot where the skin is at the floor's height, a few centimetres in) */
    const inner = (s, f) => { const top = sh(s) - 0.02, y = mix(top, 0.06, f), z = Math.min(hb(s), halfAt(s, y)) - 0.05; return [xs(s), y, Math.max(0.02, z)]; };
    { const sA = 0.03, sB = 0.8, n = 30, lp = [], lc = [], li = [];
      const nf = 5, per = 2 * (nf + 1);
      for (let i = 0; i <= n; i++) { const s = mix(sA, sB, i / n); for (const side of [-1, 1]) for (let k = 0; k <= nf; k++) { const q = inner(s, k / nf); lp.push(q[0], q[1], q[2] * side); lc.push(0.72, 0.72, 0.68); } }
      for (let i = 0; i < n; i++) for (const sd of [0, nf + 1]) for (let k = 0; k < nf; k++) { const a = i * per + sd + k, b = a + 1, c = a + per, d = c + 1; li.push(a, b, c, b, d, c); }
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new T.Float32BufferAttribute(lc, 3)); lg.setIndex(li); lg.computeVertexNormals();
      const lm = new T.Mesh(lg, Mats.litP({ vertexColors: true, roughness: 0.5, side: T.DoubleSide })); lm.receiveShadow = true; g.add(lm);
      /* (the floor: grey non-slip) */
      const fs = new T.Shape(); for (let i = 0; i <= n; i++) { const s = mix(sA, sB, i / n), q = inner(s, 1); i ? fs.lineTo(q[0], q[2]) : fs.moveTo(q[0], q[2]); } for (let i = n; i >= 0; i--) { const s = mix(sA, sB, i / n), q = inner(s, 1); fs.lineTo(q[0], -q[2]); }
      const ng = Models.canvas(128, 128), na = ng.getContext('2d'); na.fillStyle = '#9a9a92'; na.fillRect(0, 0, 128, 128); na.fillStyle = '#7e7e76'; for (let y = 0; y < 128; y += 8) for (let x = (y / 8) % 2 * 4; x < 128; x += 8) na.fillRect(x, y, 3, 3);
      const ft = Mats.tex(ng, { repeat: true }); ft.repeat.set(6, 6);
      const fl = new T.Mesh(new T.ShapeGeometry(fs), Mats.lit({ map: ft, roughness: 0.85 })); fl.rotation.x = Math.PI / 2; fl.position.y = 0.065; fl.receiveShadow = true; g.add(fl);
      /* (the foredeck: closing the bow from s = 0.8, cambered) */
      const dp = [], di = [], dc = [], m = 10;
      for (let i = 0; i <= m; i++) { const s = mix(sB, 0.998, i / m); for (let j = 0; j <= 8; j++) { const w = (j / 8) * 2 - 1, b = hb(s), y = sh(s) + 0.04 * (1 - w * w) * (b / (B / 2)); dp.push(xs(s), y + 0.005, w * b); dc.push(...gel); } }
      for (let i = 0; i < m; i++) for (let j = 0; j < 8; j++) { const a = i * 9 + j, b = a + 1, c = a + 9, d = c + 1; di.push(a, c, b, b, c, d); }
      const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(dp, 3)); dg.setAttribute('color', new T.Float32BufferAttribute(dc, 3)); dg.setIndex(di); dg.computeVertexNormals();
      const dm = new T.Mesh(dg, gelM); dm.castShadow = dm.receiveShadow = true; g.add(dm); }
    /* ── the gunwale's rubbing strake, black, all along the sheer ── */
    { const pts = []; for (let i = 0; i <= 40; i++) { const s = i / 40 * 0.995; pts.push(V(xs(s), sh(s) - 0.02, hb(s) + 0.02)); } for (let i = 40; i >= 0; i--) { const s = i / 40 * 0.995; pts.push(V(xs(s), sh(s) - 0.02, -hb(s) - 0.02)); }
      const rub = new T.Mesh(Models.tube(new T.CatmullRomCurve3(pts, false), 160, 6, () => 0.028, { sy: 0.7 }), Mats.lit({ color: new T.Color(0.04, 0.04, 0.04), roughness: 0.7 })); rub.castShadow = true; g.add(rub); }
    /* ── seats, canopy, life jackets, fuel tanks, a cleat and the bow's fairlead ── */
    const seatM = Mats.litP({ color: new T.Color(0.74, 0.73, 0.69), roughness: 0.4, clearcoat: 0.3 });
    /* (each seat as wide as the liner at its height; its locker below as wide as the floor) */
    for (const s of [0.14, 0.32, 0.5, 0.66]) { const b = Math.min(hb(s) - 0.1, halfAt(s, 0.46) - 0.07), seat = new T.Mesh(new T.BoxGeometry(0.34, 0.06, 2 * b), seatM); seat.position.set(xs(s), 0.46, 0); seat.castShadow = seat.receiveShadow = true; g.add(seat);
      const bw = Math.max(0.2, halfAt(s, 0.07) - 0.08), box = new T.Mesh(new T.BoxGeometry(0.3, 0.4, 2 * bw), seatM); box.position.set(xs(s), 0.25, 0); box.castShadow = true; g.add(box); }
    const steel = Mats.lit({ color: new T.Color(0.65, 0.66, 0.67), metalness: 0.9, roughness: 0.25 });
    { const ps = [0.2, 0.62], topY = 2.0;
      for (const s of ps) for (const side of [-1, 1]) { const z = side * (hb(s) - 0.08), post = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, topY - sh(s), 8), steel); post.position.set(xs(s), (topY + sh(s)) / 2, z); post.castShadow = true; g.add(post); }
      /* (the canvas: a curved top over the frame, its edges hemmed and a little slack) */
      const cw = 2 * (hb(0.4) - 0.04), cl = xs(0.62) - xs(0.2) + 0.3, cg = new T.PlaneGeometry(cl, cw, 12, 10), cp = cg.attributes.position;
      for (let k = 0; k < cp.count; k++) { const x = cp.getX(k), y = cp.getY(k), q = y / (cw / 2), w = x / (cl / 2); cp.setZ(k, 0.12 * (1 - q * q) - 0.03 * (1 - w * w) * q * q); }
      cg.computeVertexNormals(); cg.rotateX(-Math.PI / 2);
      /* (the cloth's weave, dyed a faded navy) */
      const canvasM = Mats.lit({ map: Mats.tex(Paint.canvasCloth(), { repeat: true }), color: new T.Color(0.2, 0.33, 0.55), roughness: 0.9, side: T.DoubleSide });
      const top = new T.Mesh(cg, canvasM); top.position.set((xs(0.2) + xs(0.62)) / 2, topY, 0); top.castShadow = true; top.receiveShadow = true; g.add(top);
      for (const side of [-1, 1]) { const rail = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, cl, 8), steel); rail.rotation.z = Math.PI / 2; rail.position.set((xs(0.2) + xs(0.62)) / 2, topY - 0.01, side * cw / 2); g.add(rail); } }
    const orange = Mats.lit({ color: new T.Color(0.8, 0.22, 0.03), roughness: 0.75 });
    for (let k = 0; k < 6; k++) { const j = new T.Mesh(new T.BoxGeometry(0.42, 0.07, 0.34), orange); j.position.set(xs(0.58) + (R() - 0.5) * 0.15, 0.5 + 0.06 + k * 0.065, (R() - 0.5) * 0.12 + 0.35); j.rotation.y = (R() - 0.5) * 0.4; j.castShadow = true; g.add(j); }
    const red = Mats.litP({ color: new T.Color(0.55, 0.04, 0.03), roughness: 0.4, clearcoat: 0.2 });
    for (const z of [-0.45, 0.45]) { const tk = new T.Mesh(new T.BoxGeometry(0.5, 0.3, 0.32), red); tk.position.set(xs(0.06), 0.22, z); tk.castShadow = true; g.add(tk);
      const cap = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.04, 10), Mats.lit({ color: new T.Color(0.05, 0.05, 0.05) })); cap.position.set(xs(0.06) + 0.12, 0.39, z); g.add(cap); }
    { const cl = new T.Mesh(new T.CylinderGeometry(0.015, 0.02, 0.2, 8), steel); cl.rotation.x = Math.PI / 2; cl.position.set(xs(0.92), sh(0.92) + 0.07, 0); g.add(cl);
      const fair = new T.Mesh(new T.TorusGeometry(0.05, 0.012, 6, 12), steel); fair.position.set(xs(0.985), sh(0.985) + 0.03, 0); fair.rotation.x = Math.PI / 2; g.add(fair);
      /* (the bow line, coiled on the foredeck) */
      for (let k = 0; k < 4; k++) { const r = new T.Mesh(new T.TorusGeometry(0.14 - k * 0.012, 0.012, 5, 24), Mats.lit({ color: new T.Color(0.62, 0.6, 0.52), roughness: 0.95 })); r.rotation.x = Math.PI / 2; r.position.set(xs(0.86), sh(0.86) + 0.06 + k * 0.018, 0.15); g.add(r); } }
    /* ── the outboards: a cowling, the leg down past the hull's bottom, its plate and gearcase, a three-bladed propeller ── */
    const black = Mats.litP({ color: new T.Color(0.03, 0.03, 0.035), roughness: 0.3, clearcoat: 0.6 }), grey = Mats.lit({ color: new T.Color(0.22, 0.23, 0.24), roughness: 0.45, metalness: 0.4 });
    for (const z of [-0.36, 0.36]) {
      const ob = new T.Group(); ob.position.set(xs(0) - 0.12, sh(0) - 0.02, z); g.add(ob);
      /* (the cowling: a rounded box seen side on, its top domed and sloping down to the back, narrower in front) */
      const cg = Models.extrude(Models.rshape(-0.48, 0.04, 0.12, 0.62, [0.04, 0.06, 0.16, 0.2]), 0.3, 0.06), cpos = cg.attributes.position;
      for (let k = 0; k < cpos.count; k++) { const x = cpos.getX(k), y = cpos.getY(k), f = 1 - 0.18 * Math.max(0, (x + 0.1) / 0.22); cpos.setZ(k, cpos.getZ(k) * f); cpos.setY(k, y - 0.06 * Math.max(0, (-x - 0.2) / 0.28) * (y > 0.4 ? 1 : 0)); }
      cg.computeVertexNormals();
      const cow = new T.Mesh(cg, black); cow.position.set(0, 0.0, 0); cow.castShadow = true; ob.add(cow);
      const band = new T.Mesh(Models.extrude(Models.rshape(-0.47, 0.0, 0.11, 0.1, [0.03, 0.03, 0.03, 0.03]), 0.34, 0.03), grey); ob.add(band);
      const leg = new T.Mesh(new T.BoxGeometry(0.2, 0.92, 0.1), black); leg.position.set(-0.1, -0.38, 0); leg.castShadow = true; ob.add(leg);
      const plate = new T.Mesh(new T.BoxGeometry(0.36, 0.014, 0.24), grey); plate.position.set(-0.14, -0.68, 0); ob.add(plate);
      const gear = new T.Mesh(new T.CapsuleGeometry(0.055, 0.32, 6, 12), grey); gear.rotation.z = Math.PI / 2; gear.position.set(-0.12, -0.84, 0); ob.add(gear);
      const skeg = new T.Mesh(new T.BoxGeometry(0.16, 0.14, 0.02), grey); skeg.position.set(-0.1, -0.95, 0); ob.add(skeg);
      const prop = new T.Group(); prop.position.set(-0.33, -0.84, 0); ob.add(prop);
      for (let k = 0; k < 3; k++) { const bl = new T.Mesh(new T.BoxGeometry(0.012, 0.15, 0.07), steel); bl.position.set(0, Math.cos(k * TAU / 3) * 0.08, Math.sin(k * TAU / 3) * 0.08); bl.rotation.x = k * TAU / 3; bl.rotation.y = 0.5; prop.add(bl); }
      ob.userData.prop = prop;
      const clamp2 = new T.Mesh(new T.BoxGeometry(0.12, 0.2, 0.16), grey); clamp2.position.set(0.06, -0.02, 0); ob.add(clamp2);
    }
    g.userData.info = { len: LOA, beam: B, sheer: sh(0.3) };
    return g;
  });
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
})();
