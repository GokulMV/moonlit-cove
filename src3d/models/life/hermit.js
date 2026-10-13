/* a hermit crab in a borrowed snail shell (a strawberry hermit, Coenobita perlatus, the land hermit of tropical beaches):
   the shell a dextral turban, its whorls beaded with spiral cords and flamed in brown, worn chalky at the apex, its mouth
   round and pearly within; out of the mouth, the crab's front half: a small shield behind two stout stalked eyes with
   long black corneas, the elbowed antennules and the long red antennae, the third maxillipeds folded under the face, the
   left claw much the bigger (its palm swollen and studded with pale granules) held up in front of the face, the right
   claw small beside it, and two pairs of long jointed walking legs, banded and granular, their last segments long curved
   points that reach the sand. Behind the shield the soft back of the carapace swells out of the mouth and fills it,
   wrinkled and darker, and the soft abdomen curls away from it up into the coil; the last two pairs of legs stay in.
   At the origin in metres, standing on the sand: its front toward +x, its right side toward +z.
   o.lite: fewer facets, for the many along the tide line. userData.anim(t, flying) keeps it alive in the hand;
   userData.parts: { shell (with the soft back, which stays put), body } (each one geometry with vertex colours, as
   built) and ap (the middle of the shell's mouth, where the body draws in), for shallows.js to draw many of them */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  const lin = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; }, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* (a sheet turned to face the other way) */
  const flip = g => { const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } const N = g.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; return g; };
  /* how much light gets into the shell: the inside bright and pearly only near the lip, dark a quarter turn in (s 0
     deep in, 1 at the lip); and the soft back lit out of the mouth, in shadow inside it (u along it, UM at the lip) */
  const UM = 0.7, deepIn = s => 0.03 + 0.97 * Math.pow(sm(0.74, 0.99, s), 1.3), softIn = u => 0.16 + 0.84 * sm(UM - 0.16, UM + 0.05, u);
  /* (the same as a strip of texture, so the gloss and the sky's reflection go dark in there too: for aoMap, clearcoatMap
     and specularIntensityMap) */
  let OCC = null;
  const occTex = (fn, alongU) => { const n = 64, d = new Uint8Array(n * 4); for (let i = 0; i < n; i++) d.fill(Math.round(255 * Math.max(0, Math.min(1, fn((i + 0.5) / n)))), i * 4, i * 4 + 4); const t = new T.DataTexture(d, alongU ? n : 1, alongU ? 1 : n); t.magFilter = t.minFilter = T.LinearFilter; t.needsUpdate = true; t.userData.keep = true; return t; };

  /* ── the shell, in its own frame: the coil's axis up (+y), the apex at the top. θ winds from the apex to the mouth
     (clockwise seen from the apex: a right-handed shell), φ goes round the tube (0 straight out from the axis, π/2 up
     toward the apex) ── */
  function shellParts(o) {
    const lite = !!o.lite, NW = 4.5, Wg = 2.3, k = Math.log(Wg) / TAU, th1 = NW * TAU, th0 = 0.9;
    const A = 0.0094, RA = 0.0108, RB = 0.0116, D = 0.029, TH = 0.0009;     /* at the mouth: the coil, the tube, the drop; the wall's thickness */
    const gr = th => Math.exp(k * (th - th1));
    const centre = th => { const s = gr(th); return new T.Vector3(A * s * Math.cos(th), -D * s, A * s * Math.sin(th)); };
    /* the sculpture: spiral cords beaded where the growth lines cross them, the growth lines themselves, and the lip a
       little thickened at the last */
    const relief = (th, ph) => {
      if (lite) return 1;      /* (too few facets round the tube to carry the cords: they would land on every one) */
      const cord = Math.pow(Math.max(0, Math.cos(ph * 12)), 2.5) * (0.65 + 0.35 * Math.pow(Math.max(0, Math.cos(th * 26 + ph * 3)), 2));
      return 1 + 0.032 * cord + 0.006 * Math.sin(th * 51) + 0.004 * Math.sin(th * 14.3 + 1.1);
    };
    const surf = (th, ph, inset = 0) => {
      const s = gr(th), c = centre(th), lip = 1 + 0.06 * sm(th1 - 0.6, th1, th), f = inset ? 1 : relief(th, ph);
      /* (a gentle shoulder below the suture, the base rounded) */
      const cp = Math.cos(ph), sp = Math.sin(ph), sh = 1 + 0.07 * Math.max(0, Math.sin(2 * ph)) - 0.04 * Math.max(0, -sp);
      const rr = (RA * s * lip * f * sh - inset) * cp, yy = (RB * s * lip * f - inset) * sp;
      return [c.x + rr * Math.cos(th), c.y + yy, c.z + rr * Math.sin(th)];
    };
    const TONE = o.tone || lin('#b99872'), BROWN = lin('#5b3b26'), CREAM = lin('#efe3cc'), CHALK = lin('#d9d2c4'), seed = (o.seed || 9) * 1.37;
    const ns = lite ? 150 : 560, nc = lite ? 12 : 60;
    const outer = M.sheet(ns, nc, (s, c) => surf(th0 + s * (th1 - th0), c * TAU), (s, c, p) => {
      const th = th0 + s * (th1 - th0), ph = c * TAU, sp = Math.sin(ph);
      /* flames: brown zigzags across the whorl, following the growth lines; a darker band under the suture; the cords' tops
         paler; worn toward the apex */
      const zig = Math.sin(th * 5.3 + 1.7 * Math.abs(((ph / TAU * 6 + seed) % 1) - 0.5) * 4 + 2.1 * M.vn(th * 0.9, ph * 0.8, seed));
      let col = mix(TONE, BROWN, sm(0.25, 0.6, zig) * (0.55 + 0.45 * sm(-0.6, 0.4, sp)));
      col = mix(col, BROWN, 0.35 * sm(0.55, 0.95, sp));
      const cord = lite ? 1.4 : Math.pow(Math.max(0, Math.cos(ph * 12)), 2.5);
      col = mix(col, CREAM, 0.28 * cord);
      col = mix(col, CHALK, sm(2.6 * TAU, 1.2 * TAU, th) * 0.8);
      return col.map(v => v * (0.88 + 0.2 * M.vn(p[0] * 2400, p[1] * 2400, p[2] * 2400)));
    });
    /* the inside, glossy and pearly near the lip and going dark further in; then the lip, rounded, joining the two */
    const inA = th1 - 1.15 * TAU, inner = (M.sheet(lite ? 24 : 110, nc, (s, c) => surf(inA + s * (th1 - inA), c * TAU, TH * (0.4 + 0.6 * s)),
      (s, c) => mix(lin('#d8c9bc'), lin('#d39470'), sm(0.75, 1, s) * 0.55).map(v => v * deepIn(s))));
    const lip = M.sheet(lite ? 3 : 8, nc, (u, c) => { const a = surf(th1, c * TAU), b = surf(th1, c * TAU, TH), n = centre(th1).sub(centre(th1 - 0.02)).normalize(), bulge = Math.sin(Math.PI * u) * TH * 0.55;
      return [a[0] + (b[0] - a[0]) * u + n.x * bulge, a[1] + (b[1] - a[1]) * u + n.y * bulge, a[2] + (b[2] - a[2]) * u + n.z * bulge]; }, (u) => mix(lin('#a98a6a'), lin('#e2d2c0'), u));
    /* (the very tip, closed) */
    const tip = M.paint(new T.SphereGeometry(RB * gr(th0) * 1.3, 8, 6), () => CHALK); tip.translate(...centre(th0).toArray());
    const apC = centre(th1), apN = centre(th1).sub(centre(th1 - 0.02)).normalize();
    /* (the lip sheet faces outward along the mouth: make sure, by its middle normal) */
    { const N = lip.attributes.normal, P = lip.attributes.position, i = Math.floor(P.count / 2); const v = new T.Vector3(N.getX(i), N.getY(i), N.getZ(i)); if (v.dot(apN) < 0) flip(lip); }
    /* (and the outer sheet outward from the coil, the inner one inward: as made, both face the same way; the middle of
       the last whorl's outside says which) */
    { const N = outer.attributes.normal, j = (ns - 4) * (nc + 1), v = new T.Vector3(N.getX(j), N.getY(j), N.getZ(j)), p = new T.Vector3().fromBufferAttribute(outer.attributes.position, j), cc = centre(th0 + (ns - 4) / ns * (th1 - th0)); if (v.dot(p.sub(cc)) < 0) flip(outer); else flip(inner); }
    return { outer: M.mergeC([{ geo: outer }, { geo: lip }, { geo: tip }]), inner, apC, apN, centre, gr, th1, RA, RB };
  }

  M.add('life/hermit', (o = {}) => {
    const lite = !!o.lite, g = new T.Group(), rnd = M.rng(o.seed || 9);
    const RED = lin('#c63d1c'), DEEP = lin('#86240f'), ORNG = lin('#e5733a'), PALE = lin('#f6dcc0'), TIPC = lin('#2b140b');

    /* ── the shell, turned so its mouth looks forward and a little down, the spire back and up and to the right (the
       crab's abdomen curls to the right, into the coil), resting on the sand behind ── */
    const S = shellParts(o);
    const e1 = S.apN.clone(), e2 = new T.Vector3(0, 1, 0).addScaledVector(e1, -e1.y).normalize(), e3 = new T.Vector3().crossVectors(e1, e2);
    const f1 = new T.Vector3(1, -(o.tilt ?? 0.32), 0.04).normalize(), up = new T.Vector3(-0.62, 0.7, 0.3), f2 = up.addScaledVector(f1, -up.dot(f1)).normalize(), f3 = new T.Vector3().crossVectors(f1, f2);
    const Rm = new T.Matrix4().makeBasis(f1, f2, f3).multiply(new T.Matrix4().makeBasis(e1, e2, e3).transpose());
    const place = new T.Matrix4().multiply(Rm).multiply(new T.Matrix4().makeTranslation(-S.apC.x, -S.apC.y, -S.apC.z));
    S.outer.applyMatrix4(place); S.inner.applyMatrix4(place);
    S.outer.computeBoundingBox();
    /* (the mouth's middle at x = 0; the shell's lowest point just on the sand) */
    const yA = 0.0006 - S.outer.boundingBox.min.y;
    S.outer.translate(0, yA, 0); S.inner.translate(0, yA, 0);
    if (!OCC) OCC = { inner: occTex(deepIn, false), soft: occTex(softIn, true) };
    const shellM = M.litP('#ffffff', { vertexColors: true, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    const innerM = M.litP('#ffffff', { vertexColors: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, aoMap: OCC.inner, clearcoatMap: OCC.inner, specularIntensityMap: OCC.inner });
    const shellG = new T.Group(); shellG.add(new T.Mesh(S.outer, shellM), new T.Mesh(S.inner, innerM)); g.add(shellG);

    /* ── the crab's front half, out of the mouth ── */
    const body = new T.Group(); g.add(body);
    const BX = 0.0035, BY = yA - 0.0035;     /* the middle of its front half: just out of the mouth, low in it */
    /* (its front half a size up from the numbers below, grown about the middle of the mouth: a crab this big fills
       the mouth of its shell, as it must to draw back into it) */
    const KB = o.kb ?? 1.25, PIV = new T.Vector3(0, yA, 0); body.scale.setScalar(KB); body.position.copy(PIV).multiplyScalar(1 - KB);
    const inBody = (x, y, z) => new T.Vector3(x, y, z).sub(PIV).multiplyScalar(KB).add(PIV);
    const R6 = lite ? 6 : 24;

    /* ── the soft back, filling the mouth: lofted along the coil from a whorl in (where the abdomen ends) out to the
       lip, most of the way across the tube; then out of the mouth, swelling a little and narrowing down and forward
       into the thorax under the shield. Its sections turn from the tube's (across the coil, along its axis) to the
       crab's own (across it, up) on the way ── */
    const thA = S.th1 - 0.85 * TAU, lift = new T.Vector3(0, yA, 0), QM = 0.86, aE = 0.004 * KB, bE = 0.0026 * KB, DP = o.dome ?? 1.6;
    const inC = th => S.centre(th).applyMatrix4(place).add(lift), radial = th => new T.Vector3(Math.cos(th), 0, Math.sin(th)).applyMatrix4(Rm), axis = new T.Vector3(0, 1, 0).applyMatrix4(Rm);
    const P0 = inC(S.th1), P1 = P0.clone().addScaledVector(f1, 0.003), P2 = inBody(BX + 0.003, BY, 0);
    const A0 = radial(S.th1), AE = new T.Vector3(0, 0, Math.sign(A0.z) || -1), BE = new T.Vector3(0, 1, 0);
    const station = u => {
      if (u <= UM) { const th = thA + (u / UM) * (S.th1 - thA), s = S.gr(th), q = QM * Math.sqrt(sm(0, 0.12, u / UM)); return [inC(th), radial(th), axis.clone(), S.RA * s * q, S.RB * s * q]; }
      /* (out of the mouth: rounded, staying full a little way, then falling away into the thorax) */
      const t = (u - UM) / (1 - UM), it = 1 - t, w = sm(0, 1, t), k = 1 - Math.sqrt(Math.max(0, 1 - Math.pow(t, DP)));
      const c = P0.clone().multiplyScalar(it * it).addScaledVector(P1, 2 * it * t).addScaledVector(P2, t * t);
      const A = A0.clone().lerp(AE, w).normalize(), B = axis.clone().lerp(BE, w); B.addScaledVector(A, -B.dot(A)).normalize();
      return [c, A, B, S.RA * QM + (aE - S.RA * QM) * k, S.RB * QM + (bE - S.RB * QM) * k];
    };
    /* (its colour: a duller, deeper red than the shield, mottled paler, a fine net of darker creases in its soft skin;
       in shadow inside the shell) */
    const SOFT = lin('#93361d'), SOFTD = lin('#4a1509'), SOFTP = lin('#c27050');
    const softG = M.loft([[0, 1, 1, 0, 2], [1, 1, 1, 0, 2]], lite ? 20 : 96, lite ? 10 : 48, (x, y, z, u) => {
      const crease = lite ? 0 : Math.pow(1 - Math.abs(2 * M.vn(x * 1300, y * 1300 + 7, z * 1300) - 1), 7);
      let c = mix(SOFT, SOFTP, 0.5 * sm(0.45, 0.85, M.vn(x * 520 + 3, y * 520, z * 520)));
      c = mix(c, SOFTD, 0.55 * crease);
      return c.map(v => v * softIn(u) * (0.9 + 0.12 * M.vn(x * 2600, y * 2600, z * 2600)));
    }, { shape: (x, y, z, u) => { const [c, A, B, a, b] = station(u); return c.addScaledVector(A, z * a).addScaledVector(B, y * b).toArray(); } });
    /* (facing outward: as lofted along this path it may be inside out) */
    { const P = softG.attributes.position, N = softG.attributes.normal, i = Math.floor(P.count * 0.85), c = station(softG.attributes.uv.getX(i))[0];
      if (new T.Vector3().fromBufferAttribute(P, i).sub(c).dot(new T.Vector3().fromBufferAttribute(N, i)) < 0) flip(softG); }
    shellG.add(new T.Mesh(softG, M.litP('#ffffff', { vertexColors: true, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.35, aoMap: OCC.soft, clearcoatMap: OCC.soft, specularIntensityMap: OCC.soft })));
    /* the colour of its limbs: red, paler beneath, darker toward each joint, speckled with pale granules on top */
    const limbPaint = (len, off, tip = false) => (x, y, z) => {
      const t = x / len, joint = Math.exp(-(((t - 0.02) / 0.1) ** 2)) + Math.exp(-(((t - 0.98) / 0.1) ** 2));
      let c = mix(RED, ORNG, y < 0 ? 0.45 : 0.1);
      c = mix(c, DEEP, 0.55 * joint);
      const gran = M.vn(x * 1900 + off, y * 1900, z * 1900 + off * 0.7);
      if (!lite && gran > 0.75 && y > -0.0002) c = mix(c, PALE, 0.7 * sm(0.75, 0.85, gran));
      if (tip) c = mix(c, TIPC, sm(0.55, 0.92, t));
      return c;
    };
    /* a segment of a leg along its joint's +x: tapering, swollen a little in the middle, deeper (y) than wide (z); bent
       down toward the end by bend; to a point if tip */
    function seg(len, r0, r1, { fl = 0.78, belly = 1.12, bend = 0, tip = false, off = 0 } = {}) {
      const rm = (r0 + r1) / 2 * belly, end = tip ? r1 * 0.12 : r1 * 0.94;
      const geo = M.loft([[0, r0 * 0.9 * fl, r0 * 0.9, 0, 2], [len * 0.1, r0 * fl, r0, 0, 2.1], [len * 0.5, rm * fl, rm, 0, 2.15], [len * 0.88, r1 * fl, r1, 0, 2.1], [len, end * fl, end, 0, 2]], lite ? 6 : 34, R6, limbPaint(len, off, tip),
        { shape: (x, y, z) => [x, y - bend * x * x / len, z] });
      return geo;
    }
    const legM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5 });
    /* a chain of joints, each segment along the last one's +x; parts [geo, length, yaw, pitch, roll] */
    function chain(parent, at, parts) {
      let p = parent; const J = [];
      parts.forEach(([geo, len, ry, rz, rx = 0], i) => {
        const j = new T.Object3D(); j.rotation.order = 'YXZ'; j.rotation.set(rx, ry, rz);
        if (i === 0) j.position.set(...at); else j.position.x = parts[i - 1][1] * 0.9;
        j.add(new T.Mesh(geo, legM)); p.add(j); J.push(j); p = j;
      });
      return J;
    }

    /* the shield over its front: small, a little longer than wide, paler in the middle, with a groove across behind the
       front third; under it the body the legs come out of */
    const shield = M.loft([[-0.004, 0.0034, 0.0022, 0, 2.4], [-0.001, 0.0048, 0.0031, 0.0003, 2.8], [0.004, 0.0052, 0.0034, 0.0004, 3.0], [0.008, 0.0046, 0.003, 0.0002, 2.8], [0.0105, 0.0032, 0.0022, 0, 2.4], [0.0118, 0.0008, 0.001, -0.0002, 2]], lite ? 8 : 26, lite ? 8 : 28,
      (x, y, z) => {
        const top = y > 0.0006, mid = Math.exp(-((z / 0.0028) ** 2)) * (top ? 1 : 0), groove = Math.exp(-(((x - 0.0068) / 0.0005) ** 2)) * (top ? 1 : 0);
        let c = mix(RED, ORNG, 0.3 * mid); c = mix(c, DEEP, 0.6 * groove); if (!top) c = mix(c, ORNG, 0.4);
        return c.map(v => v * (0.92 + 0.14 * M.vn(x * 3000, y * 3000, z * 3000)));
      }, { shape: (x, y, z) => [x, y - 0.00025 * Math.exp(-(((x - 0.0068) / 0.0005) ** 2)) * (y > 0 ? 1 : 0), z] });
    const sh = new T.Mesh(shield, legM); sh.position.set(BX, BY + 0.0018, 0); body.add(sh);
    const thorax = M.paint(new T.SphereGeometry(1, R6, Math.max(4, R6 >> 1)), (x, y) => mix(ORNG, RED, y > 0 ? 0.6 : 0.2));
    const th = new T.Mesh(thorax, legM); th.scale.set(0.0068, 0.0036, 0.0052); th.position.set(BX + 0.002, BY - 0.0006, 0); body.add(th);

    /* ── the walking legs (the second and third pairs): out to each side and down to the sand, the front pair reaching
       forward, the next back along the shell; each: the short basis, the long merus, the carpus, the propodus, the long
       pointed dactyl ── */
    const legs = [];
    const LEG = [[0.0055, 0.72, 0.8], [0.0012, 1.38, 0.86]];   /* where along the body, which way out (from forward), how long */
    for (const sd of [1, -1]) LEG.forEach(([lx, psi, kk], i) => {
      const k = kk * (sd < 0 && i === 1 ? 1.04 : 1), off = (i * 2 + (sd > 0 ? 0 : 1)) * 17.3;
      const J = chain(body, [BX + lx, BY - 0.0012, sd * 0.0034], [
        [seg(0.0036 * k, 0.0021, 0.0022, { off }), 0.0036 * k, -sd * psi, 0.62, sd * 0.1],
        [seg(0.0118 * k, 0.0025, 0.0023, { fl: 0.72, belly: 1.12, off: off + 3 }), 0.0118 * k, 0, 0.25],
        [seg(0.0058 * k, 0.0022, 0.002, { off: off + 5 }), 0.0058 * k, 0, -0.95],
        [seg(0.0092 * k, 0.002, 0.0017, { fl: 0.76, off: off + 7 }), 0.0092 * k, 0, -0.32],
        [seg(0.0125 * k, 0.0016, 0.0016, { fl: 0.8, bend: 0.12, tip: true, off: off + 9 }), 0.0125 * k, 0, -0.42]]);
      legs.push({ J, sd, i, k });
    });
    /* each leg's first pitch set so its point just touches the sand */
    g.updateMatrixWorld(true);
    const tipOf = L => { const j = L.J[4], len = 0.0125 * L.k; L.J[0].updateMatrixWorld(true); return new T.Vector3(len, -0.12 * len, 0).applyMatrix4(j.matrixWorld); };
    for (const L of legs) {
      let lo = -0.4, hi = 1.4;
      for (let it = 0; it < 26; it++) { const m = (lo + hi) / 2; L.J[1].rotation.z = m; if (tipOf(L).y > 0.0003) hi = m; else lo = m; }
      L.base = L.J.map(j => j.rotation.z); L.yaw = L.J[0].rotation.y;
    }

    /* ── the claws: the left (−z) much the bigger, held up before the face, its palm's outer face forward; the right
       small, folded beside it ── */
    const clawM = M.lit('#ffffff', { vertexColors: true, roughness: 0.46 });
    const claws = [];
    for (const sd of [-1, 1]) {
      const big = sd < 0, k = big ? 1.08 : 0.5, off = big ? 71 : 93;
      const J = chain(body, [BX + 0.0088, BY - 0.0022, sd * 0.0026], [
        [seg(0.0034 * k + 0.001, 0.0018 * k + 0.0005, 0.0019 * k + 0.0005, { off }), 0.0034 * k + 0.001, -sd * 0.55, -0.35, 0],
        [seg(0.0085 * k + 0.002, 0.0022 * k + 0.0005, 0.0026 * k + 0.0005, { fl: 0.8, off: off + 2 }), 0.0085 * k + 0.002, sd * 0.25, 0.95],
        [seg(0.0055 * k + 0.0015, 0.0026 * k + 0.0005, 0.003 * k + 0.0006, { fl: 0.85, off: off + 4 }), 0.0055 * k + 0.0015, sd * 0.85, -1.05]]);
      /* the hand: a swollen palm, the fixed finger running on from its lower edge, the movable one hinged above it;
         granular all over its outer face, the fingers' tips dark */
      const L = 0.0105 * k + 0.002, Hh = 0.0062 * k + 0.0012, Th = 0.0027 * k + 0.0006;
      const hand = new T.Object3D(); hand.position.x = (0.0055 * k + 0.0015) * 0.92; hand.rotation.order = 'YXZ'; hand.rotation.set(sd * 0.25, sd * 0.35, -0.55); J[2].add(hand);
      const granP = (x, y, z) => { const gg = M.vn(x * 2600 + off, y * 2600, z * 2600); return { gg, on: gg > 0.7 }; };
      const palm = M.loft([[0, Th * 0.62, Hh * 0.55, 0, 2.2], [L * 0.18, Th * 0.92, Hh * 0.88, 0, 2.4], [L * 0.55, Th, Hh, 0.0002 * k, 2.5], [L * 0.86, Th * 0.86, Hh * 0.86, -0.0002, 2.4], [L, Th * 0.55, Hh * 0.5, -Hh * 0.22, 2.1]], lite ? 8 : 40, lite ? 8 : 40,
        (x, y, z) => { const q = granP(x, y, z); let c = mix(RED, ORNG, y < -Hh * 0.3 ? 0.4 : 0.12); if (q.on && !lite) c = mix(c, PALE, sm(0.7, 0.8, q.gg)); return c.map(v => v * (0.94 + 0.1 * M.vn(x * 900, y * 900, z * 900))); },
        { shape: (x, y, z) => { const q = granP(x, y, z), b = q.on && !lite ? 0.00028 * sm(0.7, 0.8, q.gg) : 0, l = Math.hypot(y, z) || 1; return [x, y + y / l * b, z + z / l * b]; } });
      hand.add(new T.Mesh(palm, clawM));
      const finger = (len, rr, dn) => {
        const geo = M.loft([[0, rr * 0.8, rr, 0, 2.2], [len * 0.4, rr * 0.75, rr * 0.9, 0, 2.2], [len * 0.85, rr * 0.4, rr * 0.45, 0, 2], [len, rr * 0.08, rr * 0.08, 0, 2]], lite ? 5 : 14, R6,
          (x, y) => mix(mix(RED, ORNG, 0.3), TIPC, sm(0.55, 0.95, x / len)).map((v, i) => y * dn > rr * 0.3 ? v : v * 0.9 + 0.08 * (x / len > 0.2 ? 1 : 0)),
          /* (curving in toward the other finger, toothed along the edge that meets it) */
          { shape: (x, y, z) => { const t = x / len, teeth = y * dn > 0 ? 0 : 0.00025 * Math.max(0, Math.sin(t * 22)) * (1 - t); return [x, y + dn * 0.32 * len * t * t + dn * teeth, z]; } });
        return geo;
      };
      const fixed = new T.Mesh(finger(0.0065 * k + 0.0012, 0.0016 * k + 0.0004, 1), clawM); fixed.position.set(L * 0.9, -Hh * 0.42, 0); fixed.rotation.z = -0.1; hand.add(fixed);
      const dact = new T.Object3D(); dact.position.set(L * 0.84, Hh * 0.3, 0); hand.add(dact);
      dact.add(new T.Mesh(finger(0.0072 * k + 0.0012, 0.0015 * k + 0.0004, -1), clawM));
      claws.push({ J, dact, big });
    }
    /* each claw swung up or down at its root until the tips of its fingers just rest on the sand (looked for in small
       steps: the nearest above the sand) */
    {
      const bb = new T.Box3();
      for (const c of claws) {
        const r0 = c.J[0].rotation.z; let best = r0, bd = 1e9;
        for (let a = -0.9; a <= 1.2; a += 0.03) { c.J[0].rotation.z = r0 + a; c.J[0].updateMatrixWorld(true); bb.setFromObject(c.J[0]); const d = bb.min.y - 0.0004; if (d >= 0 && d < bd) { bd = d; best = r0 + a; } }
        c.J[0].rotation.z = best; c.base0 = best;
      }
    }

    /* ── the eyes: two stout stalks, flattened, from the front of the shield, up and forward and apart; each with a long
       black cornea round its end and a pale ring below it ── */
    const eyeM = M.litP('#120a08', { roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05 });
    const eyes = [];
    for (const sd of [1, -1]) {
      const e = new T.Object3D(); e.position.set(BX + 0.0112, BY + 0.0032, sd * 0.0013); e.rotation.order = 'YXZ'; e.rotation.set(sd * 0.2, -sd * 0.38, 0.95); body.add(e);
      const st = M.loft([[0, 0.0011, 0.0012, 0, 2], [0.002, 0.00095, 0.00125, 0, 2.2], [0.0062, 0.00092, 0.0013, 0, 2.2], [0.0085, 0.0009, 0.0012, 0, 2]], lite ? 4 : 12, R6,
        x => mix(RED, ORNG, sm(0.0, 0.007, x)));
      e.add(new T.Mesh(st, legM));
      const ring = new T.Mesh(M.paint(new T.TorusGeometry(0.00112, 0.00018, 6, R6), () => mix(ORNG, PALE, 0.55)), legM); ring.rotation.y = Math.PI / 2; ring.position.x = 0.0072; e.add(ring);
      const ball = new T.SphereGeometry(1, lite ? 8 : 22, lite ? 6 : 16); ball.scale(0.0026, 0.00135, 0.00118);
      const em = new T.Mesh(ball, eyeM); em.position.x = 0.0092; e.add(em);
      eyes.push({ e, sd, z0: e.rotation.z, x0: e.rotation.x });
    }
    /* ── the antennules (short, elbowed, the ends flicking) and the long antennae, sweeping out and back ── */
    const antM = M.lit('#ffffff', { vertexColors: true, roughness: 0.5 }), ants = [], flicks = [];
    const whip = (pts, r0, r1, col) => new T.Mesh(M.paint(M.tube(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), lite ? 8 : 40, lite ? 3 : 6, t => r0 + (r1 - r0) * t), () => col), antM);
    for (const sd of [1, -1]) {
      const a = new T.Object3D(); a.position.set(BX + 0.0108, BY + 0.0008, sd * 0.0028); a.rotation.order = 'YXZ'; body.add(a);
      a.add(whip([[0, 0, 0], [0.004, 0.0012, sd * 0.0012], [0.008, 0.0012, sd * 0.0004]], 0.00052, 0.00044, mix(RED, ORNG, 0.3)));
      a.add(whip([[0.0078, 0.0012, sd * 0.0004], [0.016, 0.0032, sd * 0.005], [0.026, 0.0028, sd * 0.012], [0.036, 0.0005, sd * 0.017], [0.044, -0.0028, sd * 0.019]], 0.00038, 0.00009, RED));
      ants.push({ a, sd });
      const f = new T.Object3D(); f.position.set(BX + 0.0118, BY + 0.0018, sd * 0.0006); f.rotation.order = 'YXZ'; body.add(f);
      f.add(whip([[0, 0, 0], [0.0018, 0.0026, sd * 0.0004], [0.0034, 0.0042, sd * 0.0008]], 0.00034, 0.0003, mix(RED, DEEP, 0.3)));
      const fl = new T.Object3D(); fl.position.set(0.0034, 0.0042, sd * 0.0008); f.add(fl);
      fl.add(whip([[0, 0, 0], [0.0016, 0.0004, sd * 0.0003], [0.0034, -0.0006, sd * 0.0006]], 0.00042, 0.00012, mix(DEEP, TIPC, 0.4)));
      flicks.push({ f, fl, sd });
    }
    /* the third maxillipeds, folded under the face: small, bristly, paler */
    if (!lite) for (const sd of [1, -1]) {
      body.add(whip([[BX + 0.0098, BY - 0.0014, sd * 0.0009], [BX + 0.0122, BY - 0.0021, sd * 0.0012], [BX + 0.0128, BY - 0.0034, sd * 0.0008]], 0.00042, 0.00025, mix(ORNG, PALE, 0.4)));
    }
    /* bristles: a few tufts on the legs and the claws' fingers */
    if (!lite) {
      const br = new T.CylinderGeometry(0.00004, 0.00008, 0.0012, 3, 1); br.translate(0, 0.0006, 0);
      for (const L of legs) for (const ji of [2, 3, 4]) {
        const j = L.J[ji], len = [0, 0, 0.0058, 0.0092, 0.0125][ji] * L.k, parts = [];
        for (let i = 0; i < 9; i++) { const t = 0.15 + rnd() * 0.75, a = rnd() * Math.PI - Math.PI / 2; parts.push({ geo: br, m: M.M4(t * len, Math.cos(a) * 0.0011, Math.sin(a) * 0.001, a, 0, -0.9 - rnd() * 0.5), c: lin('#d9a27a') }); }
        j.add(new T.Mesh(M.mergeC(parts), legM));
      }
    }

    /* ── alive in the hand: the legs reaching and paddling, the eyes turning, the antennae sweeping and the antennules
       flicking now and then, the big claw opening a little and closing ── */
    g.userData.anim = (t, flying) => {
      const sp = flying ? 2.4 : 1;
      for (const L of legs) {
        const ph = t * 2.3 * sp + L.i * 1.6 + (L.sd > 0 ? 0 : 2.4), w = Math.sin(ph);
        L.J[0].rotation.y = L.yaw + 0.1 * Math.sin(t * 1.4 + L.i) * L.sd;
        L.J[1].rotation.z = L.base[1] + 0.14 * w; L.J[2].rotation.z = L.base[2] - 0.12 * w; L.J[3].rotation.z = L.base[3] + 0.1 * Math.sin(ph + 0.7); L.J[4].rotation.z = L.base[4] + 0.14 * Math.sin(ph + 1.2);
      }
      for (const c of claws) c.dact.rotation.z = (c.big ? 0.32 : 0.2) * Math.pow(Math.max(0, Math.sin(t * 0.9 + (c.big ? 0 : 2))), 2);
      for (const e of eyes) { e.e.rotation.z = e.z0 + 0.1 * Math.sin(t * 0.8 + e.sd); e.e.rotation.x = e.x0 + 0.08 * Math.sin(t * 1.1 + e.sd * 2); }
      for (const n of ants) { n.a.rotation.y = n.sd * (0.12 + 0.2 * Math.sin(t * 0.9 + n.sd)); n.a.rotation.z = 0.15 * Math.sin(t * 1.3 + n.sd * 0.7); }
      for (const f of flicks) { const fk = Math.pow(Math.max(0, Math.sin(t * 2.6 + f.sd * 1.9)), 12); f.fl.rotation.z = -0.9 * fk; f.f.rotation.z = 0.1 * Math.sin(t * 1.7 + f.sd); }
    };
    g.userData.anim(0);

    /* for drawing many: the shell, and the body as it stands, each as one geometry (and where its mouth is) */
    if (o.parts) {
      g.updateMatrixWorld(true);
      const bodyParts = [];
      body.traverse(m => { if (!m.isMesh) return; const c = m.geometry.attributes.color ? [1, 1, 1] : m.material.color.toArray(); bodyParts.push({ geo: m.geometry, m: m.matrixWorld.clone(), c }); });
      g.userData.parts = { shell: M.mergeC([{ geo: S.outer }, { geo: S.inner }, { geo: softG }]), body: M.mergeC(bodyParts), ap: new T.Vector3(0.001, yA - 0.002, 0) };
    }
    return g;
  });
})();
