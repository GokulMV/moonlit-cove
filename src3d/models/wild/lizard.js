/* wild/lizard.js — what the island's lizards share (wild/monitor, wild/draco): a body sculpted along its spine, the
   head and its jaw, the long tail in many joints, four sprawling legs with five clawed fingers and toes; scales over
   all of it (their size by region); a forked tongue that flicks out and is drawn in; a throat that fans. Built
   standing (the feet on y = 0, facing +x).
   Lizard.build(o, sp) → the model. sp (metres):
     spine [[x, y], …] from the hips to the shoulders, girth: i → [width, height, belly drop] at each,
     neck { pts, r: [r0, r1] }, head { shapes(HB), jaw: y below which (ahead of x) it opens, eye: { at, r, ax, col,
     iris, pupil }, mouth: [x, y] its corner }, tail { n, len, droop, r: s → [width, height] }, keel(s) a crest's height,
     legs { fore: { sh, el, wr, hand, fingers: [len…], spread }, hind: { … }, r: [upper, lower, hand], claw },
     tongue { root: [x, y], len, w, col } (optional), dewlap { at, len, depth, col } (optional),
     scale(x, y, z, tags) → its scales' size, paint(x, y, z, nx, ny, nz, tags) → { col, mat },
     gait { hz, stride, lift, wave, duty }, more(clips, kit) */
const Lizard = (() => {
  const T = THREE, M = Models, TAU = Math.PI * 2;
  function build(o, sp) {
    const R = Rig, { lin, mix, sst, clamp, PAT, wave, qE } = R, V = (x, y, z) => new T.Vector3(x, y, z), side = s => s < 0 ? 'L' : 'R';
    const SP = sp.spine, NK = sp.neck, TL = sp.tail, LG = sp.legs, HD = sp.head, E = HD.eye;
    /* ── the skeleton ── */
    const tailPts = Array.from({ length: TL.n + 1 }, (_, i) => { const f = i / TL.n, x = SP[0][0] - TL.len * f, y = SP[0][1] - (TL.droop ?? 0.6) * SP[0][1] * Math.pow(f, 0.7) * (1 - 0.25 * f); return [x, Math.max(TL.rest ?? 0.004, y)]; });
    const defs = [['hips', null, [SP[0][0], SP[0][1], 0]]];
    SP.slice(1).forEach((p, i) => defs.push(['sp' + (i + 1), i ? 'sp' + i : 'hips', [p[0], p[1], 0]]));
    const top = 'sp' + (SP.length - 1);
    NK.pts.forEach((p, i) => defs.push(['n' + (i + 1), i ? 'n' + i : top, [p[0], p[1], 0]]));
    const HJ = NK.pts[NK.pts.length - 1];
    defs.push(['head', 'n' + NK.pts.length, [HJ[0] + (HD.at || 0.01), HJ[1], 0], { tail: HD.tip }], ['jaw', 'head', [HD.mouth[0], HD.mouth[1], 0], { tail: [HD.tip[0] - 0.004, HD.tip[1] - 0.006, 0] }]);
    defs.push(...R.sides((s, X) => [['lid' + X, 'head', [E.at[0], E.at[1], s * E.at[2]], { tail: [E.at[0] + 0.01, E.at[1], s * E.at[2]] }]]));
    if (sp.tongue) { const tg = sp.tongue; defs.push(['tg1', 'jaw', [tg.root[0], tg.root[1], 0], { tail: [tg.root[0] + tg.len * 0.4, tg.root[1], 0] }], ['tg2', 'tg1', [tg.root[0] + tg.len * 0.4, tg.root[1], 0], { tail: [tg.root[0] + tg.len * 0.75, tg.root[1], 0] }], ['tg3', 'tg2', [tg.root[0] + tg.len * 0.75, tg.root[1], 0], { tail: [tg.root[0] + tg.len, tg.root[1], 0] }]); }
    if (sp.dewlap) { const d = sp.dewlap; defs.push(['dew', 'head', [d.at[0], d.at[1], 0], { tail: [d.at[0] - d.len, d.at[1] - d.depth, 0] }]); }
    for (let i = 1; i <= TL.n; i++) defs.push(['t' + i, i > 1 ? 't' + (i - 1) : 'hips', [tailPts[i - 1][0], tailPts[i - 1][1], 0], { tail: [tailPts[i][0], tailPts[i][1], 0] }]);
    const LEG = (k, s) => { const L = LG[k], z = v => [v[0], v[1], s * v[2]]; return { sh: z(L.sh), el: z(L.el), wr: z(L.wr), kn: z(L.hand) }; };
    for (const s of [-1, 1]) for (const k of ['fore', 'hind']) {
      const X = side(s), L = LEG(k, s), p = k === 'fore' ? 'f' : 'h', par = k === 'fore' ? top : 'hips';
      defs.push([p + 'u' + X, par, L.sh, { tail: L.el }], [p + 'l' + X, p + 'u' + X, L.el, { tail: L.wr }], [p + 'm' + X, p + 'l' + X, L.wr, { tail: L.kn }]);
      /* (the fingers, one bone each, fanned from the knuckles) */
      LG[k].fingers.forEach((len, j) => { const n = LG[k].fingers.length, a = ((j - (n - 1) / 2) / ((n - 1) / 2)) * (LG[k].spread ?? 0.9) + (LG[k].turn ?? 0) * s, d = [Math.cos(a), 0, s * Math.sin(a)];
        defs.push([p + 'd' + j + X, p + 'm' + X, L.kn, { tail: [L.kn[0] + d[0] * len, L.kn[1] - 0.002, L.kn[2] + d[2] * len] }]); });
    }
    if (sp.ribs) { const rb = sp.ribs; for (const s of [-1, 1]) for (let i = 0; i < rb.n; i++) { const f = i / (rb.n - 1), x = rb.from[0] + (rb.from[1] - rb.from[0]) * f, y = rb.y, z = s * rb.z, L = rb.len * (rb.lens ? rb.lens(f) : 1);
      defs.push(['rib' + i + side(s), 'sp' + (rb.bone ?? 1), [x, y, z], { tail: [x - L * Math.sin(rb.sweep ?? 0.15), y + L * (rb.rise ?? 0.0), s * (rb.z + L * Math.cos(rb.sweep ?? 0.15))] }]); } }
    const S = R.skeleton(defs);

    /* ── the body ── */
    const shapes = [];
    SP.forEach((p, i) => { const [w, h, drop] = sp.girth(i); shapes.push({ ell: [p[0], p[1] - (drop || 0), 0], r: [Math.max(0.6 * (SP[1][0] - SP[0][0]), 0.02), h, w], bone: i ? 'sp' + i : 'hips', tag: 'trunk', k: 0.6 * h }); });
    for (let i = 0; i < SP.length - 1; i++) { const a = SP[i], b = SP[i + 1], [w0, h0, d0] = sp.girth(i), [w1, h1, d1] = sp.girth(i + 1);
      shapes.push({ ell: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - ((d0 || 0) + (d1 || 0)) / 2, 0], r: [(b[0] - a[0]) * 0.75, (h0 + h1) / 2, (w0 + w1) / 2], bone: i ? 'sp' + i : 'hips', tag: 'trunk', k: 0.5 * Math.min(h0, h1) }); }
    NK.pts.forEach((p, i) => { const q = i ? NK.pts[i - 1] : SP[SP.length - 1], f0 = i / NK.pts.length, f1 = (i + 1) / NK.pts.length, r0 = NK.r[0] + (NK.r[1] - NK.r[0]) * f0, r1 = NK.r[0] + (NK.r[1] - NK.r[0]) * f1;
      shapes.push({ cap: [[q[0], q[1], 0], [p[0], p[1], 0]], r: [r0, r1], bone: i ? 'n' + i : top, tag: 'neck', k: 0.5 * r1 }); });
    /* (the tail: a section at each joint, flattened from side to side toward the tip, a crest along its top) */
    for (let i = 0; i < TL.n; i++) { const a = tailPts[i], b = tailPts[i + 1], f = (i + 0.5) / TL.n, [w, h] = TL.r(f), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      shapes.push({ ell: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], r: [L * 0.72, h, w], rot: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])], bone: 't' + (i + 1), tag: 'tail', k: 0.6 * Math.min(w, h) });
      if (sp.keel) { const kh = sp.keel(f); if (kh > 0) shapes.push({ ell: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + h * 0.85, 0], r: [L * 0.7, kh, Math.max(0.0012, w * 0.18)], rot: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])], bone: 't' + (i + 1), tag: 'keel', k: 0.3 * kh }); } }
    for (const s of [-1, 1]) for (const k of ['fore', 'hind']) {
      const X = side(s), L = LEG(k, s), p = k === 'fore' ? 'f' : 'h', [ru, rl, rh] = LG.r[k];
      shapes.push({ cap: [L.sh, L.el], r: [ru, ru * 0.75], bone: p + 'u' + X, tag: 'limb', k: ru * 0.6 }, { ell: [(L.sh[0] + L.el[0]) / 2, (L.sh[1] + L.el[1]) / 2 + ru * 0.2, (L.sh[2] + L.el[2]) / 2], r: [ru * 1.4, ru * 1.15, ru * 1.6], bone: p + 'u' + X, tag: 'limb', k: ru * 0.6 });
      shapes.push({ cap: [L.el, L.wr], r: [rl, rl * 0.72], bone: p + 'l' + X, tag: 'limb', k: rl * 0.6 }, { cap: [L.wr, L.kn], r: [rh, rh * 0.85], bone: p + 'm' + X, tag: 'hand', k: rh * 0.5 });
      LG[k].fingers.forEach((len, j) => { const n = 'p' === p ? 0 : 0, b = p + 'd' + j + X, A = S.head[b].toArray(), B = S.tail[b].toArray(), rr = rh * 0.42 * (0.85 + 0.15 * (len / Math.max(...LG[k].fingers)));
        const C2 = [B[0] + (B[0] - A[0]) / len * LG.claw, B[1] - LG.claw * 0.5, B[2] + (B[2] - A[2]) / len * LG.claw];
        shapes.push({ cap: [A, B], r: [rr, rr * 0.7], bone: b, tag: 'finger', k: rr * 0.4 }, { cap: [B, C2], r: [rr * 0.62, rr * 0.08], bone: b, tag: 'claw', k: rr * 0.3 }); });
    }
    const paint = (x, y, z, nx, ny, nz, tg) => { const r = sp.paint(x, y, z, nx, ny, nz, tg); return { col: r.col, mat: r.mat, fur: 0 }; };
    const body = R.sculpt(shapes, { name: 'body', S, cell: sp.cell || 0.0025, tau: sp.tau || 0.006, paint });
    body.raw = (x, y, z, i) => [0, sp.scale(x, y, z, body.tags ? body.tags[i] : {}), 0.55, 0];
    const HB = { S, V };
    const head = R.sculpt([...HD.shapes(HB), ...[-1, 1].map(s => ({ ell: [E.at[0] + 0.2 * E.r * E.ax[0], E.at[1], s * (E.at[2] + 0.3 * E.r)], r: [E.r * 1.1, E.r * 0.85, E.r], sub: true, tag: 'socket', k: E.r * 0.25 }))],
      { name: 'head', S, cell: HD.cell || 0.0012, tau: 0.003, paint,
        bind: (x, y, z, ws, tw) => (tw.jaw || 0) > 0.5 || (y < HD.jaw(x) && x > HD.mouth[0] - 0.01) ? [[S.ix.jaw, 1]] : [[S.ix.head, 1]] });
    head.raw = (x, y, z, i) => [0, sp.scale(x, y, z, head.tags ? head.tags[i] : {}) * 1.2, 0.6, 0];
    const parts = [body, head];
    /* (the tongue: long, thin, forked at its end; drawn in by being shrunk back into the mouth) */
    if (sp.tongue) {
      const tg = sp.tongue, pts = [], forks = [];
      const g = R.tube(Array.from({ length: 8 }, (_, i) => [tg.root[0] + tg.len * 0.82 * i / 7, tg.root[1], 0]), (s) => [tg.w * (1 - 0.55 * s), tg.w * 0.5 * (1 - 0.5 * s)], { n: 24, m: 8, cap0: tg.w * 0.5, cap1: tg.w * 0.3 });
      parts.push({ geo: g, bind: R.chain(S, ['tg1', 'tg2', 'tg3']), col: tg.col, mat: [0.35, 0.5, PAT.skin, 0], fur: 0 });
      for (const s of [-1, 1]) { const f = R.tube([[tg.root[0] + tg.len * 0.8, tg.root[1], 0], [tg.root[0] + tg.len * 0.9, tg.root[1], s * tg.w * 0.9], [tg.root[0] + tg.len, tg.root[1] - 0.001, s * tg.w * 2.2]], s2 => tg.w * 0.42 * (1 - 0.8 * s2), { n: 10, m: 6, cap1: tg.w * 0.1 });
        parts.push({ geo: f, bind: R.rigid(S, 'tg3'), col: tg.col.map(c => c * 0.8), mat: [0.35, 0.5, PAT.skin, 0], fur: 0 }); }
    }
    /* (the throat's fan, a thin flap on its bone, furled by shrinking) */
    if (sp.dewlap) {
      const d = sp.dewlap, A = d.at, g = M.sheet(10, 8, (s, c) => { const x = A[0] - d.len * c, y = A[1] - d.depth * s * Math.sin(Math.PI * Math.pow(c, 0.7)) * 1.0 - 0.002; return [x, y, 0]; }, null);
      const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, 0);
      /* (both faces) */
      const g2 = g.clone(); const I = g2.index.array; for (let t = 0; t < I.length; t += 3) { const q = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = q; }
      g.translate(0, 0, 0.0004); g2.translate(0, 0, -0.0004); g.computeVertexNormals(); g2.computeVertexNormals();
      for (const gg of [g, g2]) parts.push({ geo: gg, bind: R.rigid(S, 'dew'), col: d.col, mat: [0.5, 0.15, PAT.skin, 0.6], fur: 0 });
    }
    if (sp.parts) parts.push(...sp.parts(S, HB, { shapes }));
    const eyes = [-1, 1].map(s => R.eye(S, [E.at[0], E.at[1], s * E.at[2]], E.r, [E.ax[0], E.ax[1], s * E.ax[2]], { col: E.col, iris: E.iris ?? 0.82, pupil: E.pupil ?? 0.35, white: E.white ?? 0.06, rough: 0.05, coat: 0.85 }));
    const lids = [-1, 1].map(s => R.lid(S, [E.at[0], E.at[1], s * E.at[2]], E.r * 1.1, [E.ax[0], E.ax[1], s * E.ax[2]], 'lid' + side(s), E.lid || lin('#3a3528'), 0.35, [0.6, 0.1, PAT.scale, 0]));
    const B = R.body(S, [...parts, ...eyes, ...lids], {});
    const g = B.g; g.name = sp.name;

    /* ── moving ── */
    const SPN = ['hips', ...SP.slice(1).map((_, i) => 'sp' + (i + 1))], NKN = NK.pts.map((_, i) => 'n' + (i + 1)), TLN = Array.from({ length: TL.n }, (_, i) => 't' + (i + 1));
    const face = (P, t, gape = 0) => { const b = R.blink(t, 9.1); P.set('lidL', 0, 0, -1.0 * b); P.set('lidR', 0, 0, -1.0 * b); P.set('jaw', 0, 0, -gape); if (sp.tongue) P.scale('tg1', 0.02); if (sp.dewlap) P.scale('dew', 0.02); };
    /* the spine bent side to side in a standing wave (hips one way, shoulders the other), and up or down */
    const bend = (P, yaw, pitch = 0, roll = 0) => { const n = SPN.length; SPN.forEach((b, i) => { const f = i / (n - 1); P.set(b, roll * (1 - f), yaw * (i === 0 ? 1 : -2 * (1 / (n - 1))), pitch / n); }); };
    /* the tail: following the hips' sway down its length, late, and lifted or dragged */
    const tailWave = (P, t, amp, hz, lift = 0, lag = 0.9) => TLN.forEach((b, i) => { const f = i / TLN.length; P.set(b, 0, amp * (0.4 + f) * Math.sin(TAU * hz * t - lag * i * 0.6) / TLN.length * 3, (i < 2 ? lift : 0) + (TL.curl || 0) * f * 0.15); });
    /* the neck and head turned to look along dir (in the model's frame), the neck sharing the turn */
    const FWD = V(1, 0, 0);
    const look = (P, dir, k = 1) => { const d = dir.clone().normalize(), sd = new T.Vector3().crossVectors(d, V(0, 1, 0)); if (sd.lengthSq() < 1e-6) sd.set(0, 0, 1); sd.normalize();
      const Wq = R.frameTo(FWD, V(0, 0, 1), d, sd);
      [...NKN, 'head'].forEach((n, i, a) => { const Qp = new T.Quaternion(); P.world(P.S.par[n], V(), Qp); P.aim(n, Qp.slerp(Wq, (i + 1) / a.length * k)); }); };
    /* a foot set at `to` (the knuckles' place, in the model's frame) the elbow or knee out and up, the fingers flat */
    const footTo = (P, k, s, to, lift = 0) => {
      const X = side(s), p = k === 'fore' ? 'f' : 'h', L = LEG(k, s), pole = P.world(p + 'u' + X).add(V(k === 'fore' ? -0.5 : 0.5, 0.8, s * 0.6));
      R.reach(P, p + 'u' + X, p + 'l' + X, p + 'm' + X, S.head[p + 'm' + X].toArray(), V(to.x - (L.kn[0] - L.wr[0]), to.y + (L.wr[1] - L.kn[1]), to.z - (L.kn[2] - L.wr[2])), qE(0, 0, -lift), pole);
      LG[k].fingers.forEach((_, j) => P.set(p + 'd' + j + X, 0, 0, lift * 0.6));
    };
    const G = sp.gait || {}, H0 = SP[0][1];
    /* stance: the body held at height h above the ground (its belly near it, or raised), the feet set out wide */
    const stance = (P, t, { h = 1, yaw = 0, pitch = 0, splay = 1, feet } = {}) => {
      P.off.set(0, (h - 1) * H0 * 0.55, 0); bend(P, yaw, pitch);
      for (const s of [-1, 1]) for (const k of ['fore', 'hind']) { const L = LEG(k, s), f = feet && feet[k + s]; footTo(P, k, s, f || V(L.kn[0], 0.004, L.kn[2] * splay), f && f.lift || 0); }
    };
    /* the walk: diagonal pairs together (left fore with right hind), the spine swinging so each forefoot reaches
       further, the head held steady against the sway, the tail swinging after the hips */
    const walkAt = (P, t, { hz = G.hz ?? 1, stride = G.stride ?? 0.12, lift = G.lift ?? 0.025, wv = G.wave ?? 0.18, duty = G.duty ?? 0.65, h = 1 } = {}) => {
      const ph = t * hz, yaw = wv * Math.cos(TAU * ph), feet = {};
      for (const s of [-1, 1]) for (const k of ['fore', 'hind']) {
        const L = LEG(k, s), off = (k === 'fore') === (s < 0) ? 0 : 0.5, u = ((ph + off) % 1 + 1) % 1;
        let dx, y, lf; if (u < duty) { dx = stride * (0.5 - u / duty); y = 0.004; lf = 0; } else { const v = (u - duty) / (1 - duty); dx = stride * (-0.5 + v); y = 0.004 + lift * Math.sin(Math.PI * v); lf = 0.5 * Math.sin(Math.PI * v); }
        const f = V(L.kn[0] + dx, y, L.kn[2] * (1 + 0.1 * Math.sin(Math.PI * (u < duty ? 0 : (u - duty) / (1 - duty))))); f.lift = lf; feet[k + s] = f;
      }
      stance(P, t, { h, yaw, feet });
      P.set('hips', 0.03 * Math.sin(TAU * ph), yaw, 0); P.off.y += 0.004 * Math.cos(TAU * 2 * ph);
      tailWave(P, t, wv * 1.2, hz, 0.02);
      look(P, V(1, -0.05, -yaw * 1.4 + 0.15 * wave(t, 3, 0.4)), 1);
    };
    const flick = (P, t, per = 2.4) => {
      /* the tongue out and wagging, the forks spread, and in again — two or three flicks */
      if (!sp.tongue) return 0; const c = (t % per) / per, out = sst(0.05, 0.12, c) * (1 - sst(0.3, 0.38, c)) + sst(0.45, 0.52, c) * (1 - sst(0.66, 0.74, c));
      P.scale('tg1', 0.02 + 0.98 * out); P.set('tg1', 0, 0, -0.08 * out); P.set('tg2', 0, 0.12 * Math.sin(t * 38) * out, 0.15 * Math.sin(t * 31) * out); P.set('tg3', 0, 0.2 * Math.sin(t * 38 + 1) * out, 0.2 * Math.sin(t * 31 + 1) * out);
      P.set('jaw', 0, 0, -0.02 * out); return out;
    };
    const clips = {
      stand: (P, t) => { stance(P, t, { h: 1, yaw: 0.04 * wave(t, 1, 0.3) }); tailWave(P, t, 0.05, 0.15, 0.01); look(P, V(1, -0.05 + 0.08 * wave(t, 4, 0.3), 0.4 * wave(t, 5, 0.25)), 1); face(P, t); flick(P, t, 5.5); },
      walk: (P, t) => { walkAt(P, t); face(P, t); flick(P, t, 3.1); },
      run: (P, t) => { walkAt(P, t, { hz: (G.hz ?? 1) * 2.4, stride: (G.stride ?? 0.12) * 1.7, lift: (G.lift ?? 0.025) * 1.6, wv: (G.wave ?? 0.18) * 1.3, duty: 0.45, h: 1.3 }); face(P, t); },
      /* basking: flat on the ground, the legs splayed out, the eyes half closed */
      bask: (P, t) => { stance(P, t, { h: 0.45, splay: 1.25, yaw: 0.06 }); tailWave(P, t, 0.08, 0.05, -0.04); look(P, V(1, 0.08, 0.15), 1); face(P, t); P.set('lidL', 0, 0, -0.5); P.set('lidR', 0, 0, -0.5); },
      /* alert: raised high on straight legs, the neck up, the head turning */
      alert: (P, t) => { stance(P, t, { h: 1.45, pitch: 0.12 }); tailWave(P, t, 0.04, 0.2, 0.03); const k = Math.floor(t / 1.1); look(P, V(1, 0.25, 0.7 * Math.sin(k * 2.3)), 1); face(P, t); flick(P, t, 1.6); },
      tongue: (P, t) => { clips.stand(P, t); look(P, V(1, 0.08, 0.2 * Math.sin(t * 0.6)), 1); flick(P, t, 1.4); }
    };
    if (sp.more) sp.more(clips, { R, V, qE, S, bend, tailWave, look, footTo, stance, walkAt, flick, face, LEG, SPN, NKN, TLN, H0, TAU });
    clips.idle = clips.idle || clips.stand;
    return R.creature(g, S, clips, o);
  }
  return { build };
})();
