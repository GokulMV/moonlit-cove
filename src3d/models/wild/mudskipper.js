/* wild/mudskipper — a blue-spotted mudskipper (Boleophthalmus boddarti), the fish of the island's mangrove mud that
   lives out of the water: 18 cm long, the head big and blunt with the two eyes on top like periscopes (drawn down into
   their sockets to wet them), the body tapering and flattened to the tail; grey-olive barred dark and freckled with
   bright blue; the first dorsal fin a tall sail it raises at rivals, the second long and low; muscular pectoral fins
   it walks on like crutches, and the pelvic fins joined into a sucker beneath. Built resting on the mud (y = 0,
   facing +x). o.clip: rest (also idle: propped on its fins, the eyes roving, now and then sunk), crawl (crutching:
   the fins swung forward together and the body hauled over them), skip (curled, then flicked straight into a leap),
   display (raised high, the sail up and flicked, mouth gaping), swim, roll (a roll in the mud to wet its skin). */
(() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  M.add('wild/mudskipper', (o = {}) => {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const C = { base: lin('#575847'), dark: lin('#33342a'), belly: lin('#9a9682'), blue: lin('#3f9cc4'), fin: lin('#3e3f34'), finE: lin('#6a6c58'), iris: lin('#8a6a2a'), mouth: lin('#7a5a52') };
    /* ── the skeleton: from the chest, the head forward and the body back to the tail; the eyes, the pectoral fins,
       the rays of the first dorsal ── */
    const SPX = [[0.03, 0.0215], [0.0, 0.0205], [-0.025, 0.019], [-0.045, 0.0175], [-0.062, 0.016]];
    const NR = 5, D1 = i => { const f = i / (NR - 1); return { x: 0.036 - 0.022 * f, y: 0.0335, L: 0.03 - 0.011 * f }; };
    const defs = [['chest', null, [0.05, 0.022, 0]], ['head', 'chest', [0.062, 0.022, 0], { tail: [0.116, 0.02, 0] }], ['jaw', 'head', [0.098, 0.0115, 0], { tail: [0.115, 0.0105, 0] }],
      ...R.sides((s, X) => [['eye' + X, 'head', [0.089, 0.031, s * 0.0062], { tail: [0.09, 0.043, s * 0.007] }], ['lid' + X, 'eye' + X, [0.091, 0.04, s * 0.0065], { tail: [0.1, 0.04, s * 0.0065] }]]),
      ...SPX.map((p, i) => ['b' + (i + 1), i ? 'b' + i : 'chest', [p[0], p[1], 0]]), ['caudal', 'b5', [-0.072, 0.0155, 0], { tail: [-0.102, 0.016, 0] }],
      ...R.sides((s, X) => [['pb' + X, 'chest', [0.05, 0.012, s * 0.012], { tail: [0.048, 0.006, s * 0.022] }], ['pf' + X, 'pb' + X, [0.048, 0.006, s * 0.022], { tail: [0.034, 0.002, s * 0.03] }]]),
      ...Array.from({ length: NR }, (_, i) => { const d = D1(i); return ['d1r' + i, 'b1', [d.x, d.y, 0], { tail: [d.x - 0.004, d.y + d.L, 0] }]; })];
    const S = R.skeleton(defs);
    /* ── the body ── */
    const ell = (c, r, bone, tag, k = 0.006, rot) => ({ ell: c, r, bone, tag, k, rot });
    const body = R.sculpt([
      ell([0.084, 0.0215, 0], [0.032, 0.0165, 0.0178], 'head', 'head', 0),
      ...[-1, 1].map(s => ell([0.079, 0.0175, s * 0.0098], [0.026, 0.0135, 0.0125], 'head', 'cheek')),
      ell([0.105, 0.0195, 0], [0.0125, 0.0105, 0.0138], 'head', 'snout', 0.006),
      ell([0.104, 0.0105, 0], [0.0125, 0.004, 0.0125], 'jaw', 'jaw', 0.003),
      /* (the eyes' turrets on top) */
      ...[-1, 1].map(s => ell([0.0895, 0.032, s * 0.0062], [0.0068, 0.0058, 0.0058], 'head', 'turret', 0.004)),
      { box: [0.106, 0.0128, 0], h: [0.012, 0.0004, 0.016], rot: [0, 0, -0.04], sub: true, tag: 'mouth', k: 0.0006 },
      ell([0.042, 0.0208, 0], [0.03, 0.0182, 0.0178], 'chest', 'trunk'),
      ...SPX.map((p, i) => { const f = (i + 1) / SPX.length; return ell([p[0] - 0.008, p[1] - 0.0005, 0], [0.026, 0.0182 - 0.0095 * f, 0.0168 - 0.0118 * f], 'b' + (i + 1), 'trunk', 0.008); }),
      ell([-0.07, 0.0155, 0], [0.01, 0.0072, 0.0038], 'caudal', 'trunk', 0.004),
      /* (the pelvic sucker under the chest; the pectorals' muscular stalks) */
      ell([0.046, 0.0055, 0], [0.011, 0.0028, 0.0092], 'chest', 'pelvic', 0.003),
      ...[-1, 1].map(s => ({ cap: [[0.05, 0.012, s * 0.012], [0.048, 0.006, s * 0.022]], r: [0.0062, 0.0044], bone: 'pb' + side(s), tag: 'stalk', k: 0.003 }))
    ], { name: 'body', S, cell: 0.0007, tau: 0.002,
      bind: (x, y, z, ws, tw) => (tw.jaw || 0) > 0.5 || (y < 0.0125 && x > 0.093) ? [[S.ix.jaw, 1]] : ws,
      paint: (x, y, z, nx, ny, nz, tg) => {
        const g = k => tg[k] || 0;
        if (g('mouth') > 0.4) return { col: C.mouth, mat: [0.4, 0.3, PAT.skin, 0] };
        /* (olive-grey above with dark oblique bars, freckled blue; pale below) */
        const bar = sst(0.55, 0.7, Math.sin(2 * Math.PI * (x + 0.4 * (y - 0.02)) / 0.022) * 0.5 + 0.5), freck = sst(0.84, 0.88, M.vn(x * 520, y * 520, z * 520));
        let col = mix(C.base, C.dark, 0.6 * bar * sst(-0.2, 0.3, ny));
        col = mix(col, C.blue, freck * sst(-0.3, 0.2, ny) * (x < 0.1 ? 1 : 0.4));
        col = mix(col, C.belly, sst(-0.25, -0.65, ny));
        return { col: col.map(v => v * (0.94 + 0.1 * M.vn(x * 300, y * 300, z * 300))), mat: [0.36, 0.45, PAT.skin, 0] };
      } });
    /* ── the fins: thin skin on rays, the rays drawn darker; both faces ── */
    const fins = [];
    const sheet = (nu, nv, at, bindAt, colAt) => {
      const pos = [], W = [], cols = [], idx = [], nvx = nv + 1;
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv, p = at(u, v); pos.push(p.x, p.y, p.z); W.push(bindAt(u, v, p)); cols.push(colAt(u, v, p)); }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const q = i * nvx + j; idx.push(q, q + nvx, q + 1, q + 1, q + nvx, q + nvx + 1); }
      const N = M.normalsOf(pos, idx), n0 = pos.length / 3, pos2 = pos.slice(), N2 = [];
      for (let k = 0; k < n0; k++) for (let c = 0; c < 3; c++) { pos[k * 3 + c] += N[k * 3 + c] * 0.00008; pos2[k * 3 + c] -= N[k * 3 + c] * 0.00008; N2.push(-N[k * 3 + c]); }
      const idx2 = []; for (let t = 0; t < idx.length; t += 3) idx2.push(idx[t] + n0, idx[t + 2] + n0, idx[t + 1] + n0);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([...pos, ...pos2], 3)); g.setAttribute('normal', new T.Float32BufferAttribute([...N, ...N2], 3)); g.setIndex([...idx, ...idx2]);
      fins.push({ geo: g, bind: (x, y, z, i) => W[i % n0], col: (x, y, z, i) => cols[i % n0], mat: [0.45, 0.35, PAT.membrane, 0.7], fur: 0 });
    };
    const finCol = (rays, u, v, spots = 0) => { const ray = sst(0.75, 0.95, Math.abs(Math.cos(Math.PI * v * rays))), sp = spots ? sst(0.78, 0.85, M.vn(u * 40, v * 40, spots)) : 0;
      return mix(mix(C.fin, C.finE, 0.35 * u), C.dark, 0.5 * ray).map((c, k) => mix([c, c, c], C.blue, sp)[k]); };
    /* (the first dorsal's sail: strips between its rays, each following the two rays it spans) */
    for (let i = 0; i < NR - 1; i++) {
      const a = 'd1r' + i, b = 'd1r' + (i + 1), A0 = S.head[a], A1 = S.tail[a], B0 = S.head[b], B1 = S.tail[b];
      sheet(10, 3, (u, v) => A0.clone().lerp(A1, u).lerp(B0.clone().lerp(B1, u), v), (u, v) => [[S.ix[a], 1 - v], [S.ix[b], v]].filter(q => q[1] > 1e-4), (u, v) => finCol(1, u, (i + v) / (NR - 1), 7 + i));
    }
    /* (the second dorsal, long and low; the anal fin beneath; both along the body's bones) */
    const along = R.chain(S, ['b1', 'b2', 'b3', 'b4', 'b5', 'caudal']);
    sheet(18, 3, (u, v) => V(0.008 - 0.064 * u, 0.0305 - 0.013 * u + (0.009 - 0.002 * u) * v, 0), (u, v, p) => along(p.x, p.y - 0.005, 0), (u, v) => finCol(14, v, u, 21));
    sheet(16, 3, (u, v) => V(0.0 - 0.058 * u, 0.0085 + 0.002 * u - (0.0065 - 0.002 * u) * v, 0), (u, v, p) => along(p.x, p.y + 0.004, 0), (u, v) => finCol(12, v, u));
    /* (the tail fin, rounded) */
    sheet(10, 8, (u, v) => { const a = (v - 0.5) * 2.2; return V(-0.074 - 0.036 * u * Math.cos(a * 0.4), 0.0155 + 0.021 * u * Math.sin(a * 0.55), 0); }, () => [[S.ix.caudal, 1]], (u, v) => finCol(8, u, v));
    /* (the pectorals' fans, at the stalks' ends) */
    for (const s of [-1, 1]) { const X = side(s), A = S.head['pf' + X];
      sheet(8, 12, (u, v) => { const a = -0.35 + 1.9 * v; return V(A.x - 0.022 * u * Math.cos(a), A.y - 0.004 * u, A.z + s * 0.022 * u * Math.sin(a) * 0.6); }, () => [[S.ix['pf' + X], 1]], (u, v) => finCol(11, u, v)); }
    const eyes = [-1, 1].map(s => R.eye(S, [0.0905, 0.0395, s * 0.0066], 0.0044, [0.28, 0.75, s * 0.6], { col: C.iris, iris: 0.82, pupil: 0.36, white: 0.15, rough: 0.04, coat: 0.95, bone: 'eye' + side(s) }));
    const lids = [-1, 1].map(s => R.lid(S, [0.0905, 0.0395, s * 0.0066], 0.0047, [0.28, 0.75, s * 0.6], 'lid' + side(s), C.base, 0.5, [0.4, 0.5, PAT.skin, 0]));
    const B = R.body(S, [body, ...fins, ...eyes, ...lids], {});
    const g = B.g; g.name = 'mudskipper';

    /* ── moving ── */
    const BN = ['b1', 'b2', 'b3', 'b4', 'b5', 'caudal'];
    const sail = (P, up) => { for (let i = 0; i < NR; i++) P.set('d1r' + i, 0, 0, -1.25 * (1 - up) * (0.9 + 0.05 * i)); };
    const eyesLook = (P, t, sink = 0) => { for (const s of [-1, 1]) { const X = side(s); P.set('eye' + X, 0.25 * wave(t, s + 3, 0.9), 0.4 * wave(t, s + 5, 0.7), -0.15 * sink); P.scale('eye' + X, 1 - 0.45 * sink); } };
    const curl = (P, a, wv = 0, t = 0) => BN.forEach((b, i) => P.set(b, 0, a * (0.6 + 0.5 * i / BN.length) + wv * Math.sin(t * 9 - i * 0.8), 0));
    /* the fins: swung forward (−1) … back (+1), planted or lifted */
    const fin = (P, sw, lift = 0) => { for (const s of [-1, 1]) { const X = side(s); P.set('pb' + X, -s * 0.35 * lift, s * 0.6 * sw, 0.2 * lift); P.set('pf' + X, 0, 0, -0.2 * lift); } };
    const clips = {
      rest: (P, t) => {
        P.off.set(0, 0.0005, 0); curl(P, 0.08 * wave(t, 1, 0.3)); sail(P, 0.05); fin(P, 0.1 * wave(t, 2, 0.5));
        P.set('chest', 0, 0.08 * wave(t, 3, 0.25), -0.04); P.set('head', 0, 0, 0.03 + 0.02 * Math.sin(t * 2.2));
        P.set('jaw', 0, 0, -0.03 * Math.max(0, Math.sin(t * 2.2)));
        const sk = R.every(t, 6.5, 0.5, 3); eyesLook(P, t, sk > 0 ? Math.sin(Math.PI * sk) : 0);
      },
      /* crutching: both fins swung forward together and planted, the body hauled forward over them (here the fins
         sweep back under it), lifting the head; the tail pushes */
      crawl: (P, t) => {
        const c = (t * 1.4) % 1, fwd = c < 0.35;
        const swing = fwd ? 1 - 2 * sst(0, 0.35, c) : -1 + 2 * sst(0.35, 1, c), haul = fwd ? 0 : Math.sin(Math.PI * (c - 0.35) / 0.65);
        fin(P, swing, fwd ? Math.sin(Math.PI * c / 0.35) : 0);
        P.off.set(0, 0.0005 + 0.004 * haul, 0); P.set('chest', 0, 0, -0.12 * haul);
        curl(P, 0.12 * Math.sin(TAU * t * 0.7), 0); BN.forEach((b, i) => P.set(b, 0, 0.12 * Math.sin(TAU * t * 0.7 - i * 0.5), 0.05 * haul * (i > 2 ? 1 : -0.3)));
        sail(P, 0.05); eyesLook(P, t);
      },
      /* the skip: the body bent into a C, then flicked straight, the leap and the landing */
      skip: (P, t) => {
        const c = (t % 1.3) / 1.3, bendIn = sst(0.0, 0.25, c) * (1 - sst(0.25, 0.32, c)), air = sst(0.28, 0.33, c) * (1 - sst(0.62, 0.7, c)), arc = Math.max(0, Math.sin(Math.PI * clamp((c - 0.28) / 0.4, 0, 1)));
        curl(P, 0.9 * bendIn - 0.25 * air * Math.sin(Math.PI * clamp((c - 0.3) / 0.3, 0, 1)));
        P.off.set(0.03 * sst(0.3, 0.68, c), 0.0005 + 0.045 * arc, 0); P.set('chest', 0.3 * air, 0.4 * bendIn, -0.3 * arc + 0.2 * sst(0.6, 0.7, c) * (1 - sst(0.7, 0.85, c)));
        fin(P, 0.6 * air, air); sail(P, 0.4 * air); eyesLook(P, t, 0.6 * air);
      },
      /* the display: high on the fins, the sail raised and flicked, the mouth gaping, the body arched */
      display: (P, t) => {
        P.off.set(0, 0.006, 0); P.set('chest', 0, 0.15 * Math.sin(t * 1.2), -0.25); P.set('head', 0, 0, 0.12);
        fin(P, -0.4, 0.15); curl(P, -0.15, 0.06, t); const fl = 0.85 + 0.15 * Math.sin(t * 14);
        sail(P, fl); P.set('jaw', 0, 0, -0.35 * (0.5 + 0.5 * Math.sin(t * 2.5))); eyesLook(P, t);
      },
      /* swimming: the fins laid back, the body and tail sweeping */
      swim: (P, t) => {
        P.off.set(0, 0.012, 0); fin(P, 1, 0.3); sail(P, 0); BN.forEach((b, i) => P.set(b, 0, (0.12 + 0.2 * i / BN.length) * Math.sin(t * 11 - i * 0.7), 0));
        P.set('head', 0, -0.05 * Math.sin(t * 11 + 0.8), 0); eyesLook(P, t, 0.3);
      },
      /* rolling in the mud: over on one side, a wriggle, and back up */
      roll: (P, t) => {
        const c = (t % 2.2) / 2.2, r = Math.sin(Math.PI * sst(0.1, 0.6, c)) * Math.PI * 0.55;
        P.set('chest', r, 0, 0); P.off.set(0, 0.0005 + 0.008 * Math.sin(r), 0); curl(P, 0.1, 0.1 * Math.sin(Math.PI * c), t); fin(P, 0.3, 0.3 * Math.sin(r)); sail(P, 0); eyesLook(P, t, Math.sin(r) * 0.8);
      }
    };
    clips.idle = clips.rest;
    return R.creature(g, S, clips, o);
  });
})();
