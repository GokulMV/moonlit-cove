/* ─────────────────────────────────────────────────────────────
   paper.js — a loose sheet you can pick up and read: the letter
   from the bottle, the blueprints from the basket, the packing
   list from the van. It starts rolled up (or flat on a board) at
   its object, flies to a reading pose in front of the camera,
   unrolls, and pages lift over the top edge like a pad of sheets.
   Local frame of a sheet: x across, y up (top edge at +H/2),
   front face toward +z. Rolling curls the lower part backward
   (−z) into a spiral whose centre sits at the top edge when the
   sheet is fully rolled.
   ───────────────────────────────────────────────────────────── */
const Paper = (() => {
  const T = THREE, SEG = 160;
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeO = x => 1 - Math.pow(1 - x, 3);

  function geos(W, H) {
    const n = (SEG + 1) * 2, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uvF = new Float32Array(n * 2), uvB = new Float32Array(n * 2), idx = [];
    for (let i = 0; i <= SEG; i++) for (let j = 0; j < 2; j++) {
      const k = i * 2 + j, v = 1 - i / SEG;
      pos[k * 3] = (j ? 0.5 : -0.5) * W; pos[k * 3 + 1] = H / 2 - (i / SEG) * H; nor[k * 3 + 2] = 1;
      uvF[k * 2] = j; uvF[k * 2 + 1] = v; uvB[k * 2] = 1 - j; uvB[k * 2 + 1] = v;
    }
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const P = new T.BufferAttribute(pos, 3), N = new T.BufferAttribute(nor, 3); P.setUsage(T.DynamicDrawUsage); N.setUsage(T.DynamicDrawUsage);
    const mk = uv => { const g = new T.BufferGeometry(); g.setAttribute('position', P); g.setAttribute('normal', N); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx); g.boundingSphere = new T.Sphere(new T.Vector3(), Math.hypot(W, H)); return g; };
    return { f: mk(uvF), b: mk(uvB), P, N, W, H };
  }
  /* k = 0 flat … 1 fully rolled. The flat part hangs from the top edge; the rest spirals backward. */
  function roll(G, k, R0) {
    const p = G.P.array, n = G.N.array, H = G.H, ds = H / SEG, L = H * (1 - k), dR = 0.0013 / (2 * Math.PI);
    let y = H / 2, z = 0, th = 0, R = R0;
    for (let i = 0; i <= SEG; i++) {
      if (i > 0) { const s = (i - 0.5) * ds; if (s > L) { th += ds / R; R = Math.max(0.0025, R - dR * ds / R); } y -= Math.cos(th) * ds; z -= Math.sin(th) * ds; }
      const ny = -Math.sin(th), nz = Math.cos(th);
      for (let j = 0; j < 2; j++) { const q = (i * 2 + j) * 3; p[q + 1] = y; p[q + 2] = z; n[q] = 0; n[q + 1] = ny; n[q + 2] = nz; }
    }
    G.P.needsUpdate = true; G.N.needsUpdate = true;
  }

  function build(scene) {
    const root = new T.Group(); root.visible = false; scene.add(root);
    const lit = p => Mats.lit(Object.assign({ roughness: 0.9 }, p));
    const st = { mode: 'hidden', W: 0.24, H: 0.34, R0: 0.011, rolled: true, pages: [], idx: 0, k: 1, kFrom: 1, kTo: 1, kT0: 0, kDur: 1,
      fly: { t0: 0, dur: 1.3, from: null, to: null, back: false }, turn: null, held: { p: new T.Vector3(), q: new T.Quaternion() }, origin: { p: new T.Vector3(), q: new T.Quaternion() }, read: 0, onDone: null };
    /* two sheets: the top one is read and lifted away; the one beneath shows the next page */
    const sheets = [0, 1].map(i => {
      const pivot = new T.Group(), holder = new T.Group(); pivot.add(holder); root.add(pivot);
      const mf = lit({ emissive: new T.Color(1, 1, 1), emissiveIntensity: 0 }), mb = lit({ color: new T.Color('#e8dcc2'), emissive: new T.Color('#e8dcc2'), emissiveIntensity: 0, side: T.BackSide });
      return { pivot, holder, mf, mb, G: null, meshes: [] };
    });
    /* a hardboard backing with a clip, for the clipboard */
    const board = new T.Group(); root.add(board);
    const boardM = lit({ color: new T.Color('#7a5a3a'), roughness: 0.75, emissive: new T.Color('#7a5a3a'), emissiveIntensity: 0 }), clipM = lit({ color: new T.Color('#c9ccd1'), roughness: 0.3, metalness: 0.8, emissive: new T.Color('#9a9da3'), emissiveIntensity: 0 });
    let boardMesh = null, clip = null;

    function shape(W, H, R0, rolled, hasBoard) {
      st.W = W; st.H = H; st.R0 = R0; st.rolled = rolled;
      sheets.forEach((s, i) => {
        s.meshes.forEach(m => s.holder.remove(m)); if (s.G) { s.G.f.dispose(); s.G.b.dispose(); }
        s.G = geos(W, H);
        const f = new T.Mesh(s.G.f, s.mf), b = new T.Mesh(s.G.b, s.mb); f.frustumCulled = b.frustumCulled = false; f.receiveShadow = b.receiveShadow = false;
        s.holder.add(f, b); s.meshes = [f, b];
        s.pivot.position.set(0, H / 2, i === 0 ? 0.0006 : -0.0006); s.holder.position.set(0, -H / 2, 0);
        roll(s.G, i === 0 && rolled ? 1 : 0, R0);
      });
      if (boardMesh) { board.remove(boardMesh, clip); boardMesh.geometry.dispose(); }
      /* (the same board and clip as the one hanging on the van, so it reads as that clipboard taken down) */
      boardMesh = new T.Mesh(new T.BoxGeometry(W + 0.026, H + 0.04, 0.005), boardM); boardMesh.position.set(0, 0.012, -0.0035);
      clip = new T.Mesh(new T.BoxGeometry(0.09, 0.03, 0.012), clipM); clip.position.set(0, H / 2 + 0.02, 0.0035);
      board.add(boardMesh, clip); board.visible = !!hasBoard;
      sheets[1].pivot.visible = false;
    }
    function setPage(s, tex) { s.mf.map = tex; s.mf.emissiveMap = tex; s.mf.needsUpdate = true; }
    /* open: o = { W, H, R0, rolled, board, pages: [canvas], origin: {p, q}, held: {p, q}, start } */
    function open(o) {
      st.pages = o.pages.map(c => { const t = Mats.tex(c, { aniso: 8 }); t.generateMipmaps = true; return t; });
      shape(o.W, o.H, o.R0 || 0.011, o.rolled !== false, o.board); st.lift = o.lift || 0;
      st.idx = 0; setPage(sheets[0], st.pages[0]);
      sheets.forEach(s => { s.mb.color.set(o.backColor || '#e8dcc2'); s.mb.emissive.set(o.backColor || '#e8dcc2'); });
      st.origin.p.fromArray(o.origin.p); st.origin.q.fromArray(o.origin.q);
      st.held.p.fromArray(o.held.p); st.held.q.fromArray(o.held.q);
      const now = performance.now() / 1000, t0 = now + (o.delay || 0);
      st.fly = { t0, dur: o.fly || 1.4, back: false };
      st.k = st.kFrom = st.kTo = st.rolled ? 1 : 0;
      if (st.rolled) { st.kFrom = 1; st.kTo = 0; st.kT0 = t0 + st.fly.dur * 0.62; st.kDur = 1.0; }
      st.mode = 'opening'; st.turn = null; root.visible = true; place(0);
    }
    function close(onDone) {
      if (st.mode === 'hidden') return;
      const now = performance.now() / 1000;
      st.turn = null; st.drag = null; st.queued = 0; sheets[1].pivot.visible = false; sheets[0].pivot.rotation.x = 0; sheets[0].pivot.position.z = 0.0006;
      if (st.pages[st.idx]) setPage(sheets[0], st.pages[st.idx]);
      if (st.rolled) { st.kFrom = st.k; st.kTo = 1; st.kT0 = now; st.kDur = 0.7; }
      st.fly = { t0: now + (st.rolled ? 0.55 : 0.05), dur: 1.1, back: true };
      st.mode = 'closing'; st.onDone = onDone;
    }
    /* turning: the top sheet lifts over the top edge (next), or the previous one comes back down onto the pile.
       A sheet can be held part-way by a drag (it follows the pointer) and then let go: past halfway it carries on,
       otherwise it settles back. Either way it ends with sheet 0 flat, showing the page that was landed on. */
    const LIFT = -Math.PI * 0.96;
    function setupTurn(dir) {
      const j = st.idx + dir; if (j < 0 || j >= st.pages.length) return null;
      if (dir > 0) { setPage(sheets[1], st.pages[j]); roll(sheets[1].G, 0, st.R0); sheets[1].pivot.visible = true; sheets[0].pivot.rotation.x = 0; }
      else { setPage(sheets[1], st.pages[st.idx]); roll(sheets[1].G, 0, st.R0); sheets[1].pivot.visible = true; setPage(sheets[0], st.pages[j]); sheets[0].pivot.rotation.x = LIFT; }
      return j;
    }
    function animate(from, to, j, dur, ez) { st.turn = { t0: performance.now() / 1000, dur: Math.max(0.22, dur), from, to, j, ez }; }
    function turn(dir) {
      if (st.mode !== 'open' || st.drag) return false;
      /* a tap while a sheet is still moving is kept and played as soon as it lands */
      if (st.turn) { const j = st.turn.j + dir; if (j < 0 || j >= st.pages.length) return false; st.queued = dir; return true; }
      const j = setupTurn(dir); if (j === null) return false;
      animate(dir > 0 ? 0 : LIFT, dir > 0 ? LIFT : 0, j, 0.85, ease);
      return true;
    }
    /* a drag: dir is which way the reader is turning; f goes 0 → 1 as the sheet travels */
    function dragStart(dir) {
      if (st.mode !== 'open' || st.turn || st.drag) return false;
      const j = setupTurn(dir); if (j === null) return false;
      st.drag = { dir, j, f: 0 }; return true;
    }
    function dragTo(f) {
      const d = st.drag; if (!d) return; d.f = Math.max(0, Math.min(1, f));
      const s = sheets[0]; s.pivot.rotation.x = d.dir > 0 ? LIFT * d.f : LIFT * (1 - d.f); s.pivot.position.z = 0.0006 + 0.03 * Math.sin(Math.PI * d.f);
    }
    function dragEnd(commit) {
      const d = st.drag; if (!d) return false; st.drag = null;
      const from = sheets[0].pivot.rotation.x, to = (d.dir > 0) === !!commit ? LIFT : 0, j = commit ? d.j : st.idx;
      animate(from, to, j, 0.7 * Math.abs(to - from) / Math.abs(LIFT), easeO);
      return !!commit;
    }
    const _p = new T.Vector3(), _q = new T.Quaternion(), _o = new T.Vector3(), _up = new T.Vector3(), _out = new T.Vector3();
    /* the rolled sheet's spiral sits at the top edge; keep that point on the origin while it is rolled */
    function place(e) {
      const rolledOff = new T.Vector3(0, st.H / 2, -st.R0).multiplyScalar(st.rolled ? 1 - Math.min(1, e * 1.15) : 0);
      _o.copy(rolledOff).applyQuaternion(st.origin.q);
      const from = _p.copy(st.origin.p).sub(_o);
      root.position.lerpVectors(from, st.held.p, e);
      root.position.y += Math.sin(Math.PI * e) * (st.lift ? 0.06 : 0.35);
      /* a clipboard comes up off its hook and out from the wall before it travels */
      if (st.lift) { const k = Math.min(1, e / 0.22), off = (1 - e) * Math.sin(Math.PI / 2 * k);
        root.position.addScaledVector(_up.set(0, 1, 0).applyQuaternion(st.origin.q), 0.045 * off).addScaledVector(_out.set(0, 0, 1).applyQuaternion(st.origin.q), 0.07 * off); }
      root.quaternion.slerpQuaternions(st.origin.q, st.held.q, e);
    }
    function update() {
      if (st.mode === 'hidden') return;
      const now = performance.now() / 1000;
      const fe = Math.min(1, Math.max(0, (now - st.fly.t0) / st.fly.dur)), e = ease(fe);
      place(st.fly.back ? 1 - e : e);
      if (st.rolled) {
        const kk = Math.min(1, Math.max(0, (now - st.kT0) / st.kDur)), k = st.kFrom + (st.kTo - st.kFrom) * easeO(kk);
        if (Math.abs(k - st.k) > 1e-4 || kk < 1) { st.k = k; roll(sheets[0].G, k, st.R0); }
      }
      if (st.turn) {
        const tu = st.turn, u = Math.min(1, (now - tu.t0) / tu.dur), a = tu.ez(u), s = sheets[0];
        s.pivot.rotation.x = tu.from + (tu.to - tu.from) * a;
        s.pivot.position.z = 0.0006 + 0.03 * Math.sin(Math.PI * s.pivot.rotation.x / LIFT);
        if (u >= 1) { st.idx = tu.j; setPage(sheets[0], st.pages[st.idx]); s.pivot.rotation.x = 0; s.pivot.position.z = 0.0006; sheets[1].pivot.visible = false; st.turn = null;
          if (st.queued) { const q = st.queued; st.queued = 0; turn(q); } }
      }
      if (st.mode === 'opening' && fe >= 1 && (!st.rolled || now >= st.kT0 + st.kDur)) st.mode = 'open';
      if (st.mode === 'closing' && fe >= 1) { st.mode = 'hidden'; root.visible = false; const f = st.onDone; st.onDone = null; if (f) f(); }
    }
    function setReadLight(k) { sheets.forEach(s => { s.mf.emissiveIntensity = k; s.mb.emissiveIntensity = k * 0.6; }); boardM.emissiveIntensity = k * 0.5; clipM.emissiveIntensity = k * 0.5; }
    function setHeld(p, q) { st.held.p.fromArray(p); st.held.q.fromArray(q); }
    /* the page being read: where the sheet in motion (and any tap waiting behind it) is headed, not the one it left */
    const target = () => { if (!st.turn) return st.idx; return Math.max(0, Math.min(st.pages.length - 1, st.turn.j + (st.queued || 0))); };
    return { open, close, turn, dragStart, dragTo, dragEnd, update, setReadLight, setHeld, state: st, get idx() { return st.idx; }, get target() { return target(); }, get count() { return st.pages.length; }, get mode() { return st.mode; }, get dragging() { return !!st.drag; }, busy: () => !!st.turn || !!st.drag || st.mode === 'opening' || st.mode === 'closing' };
  }
  return { build };
})();
