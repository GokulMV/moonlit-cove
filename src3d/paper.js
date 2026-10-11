/* ─────────────────────────────────────────────────────────────
   paper.js — a loose sheet you can pick up and read: the letter
   from the bottle, the blueprints from the basket, the packing
   list from the van. It starts rolled up (or flat on a board) at
   its object, flies to a reading pose in front of the camera,
   unrolls, and pages turn over the top edge like a pad of sheets.
   Local frame of a sheet: x across, y up (top edge at +H/2),
   front face toward +z. Rolling curls the lower part backward
   (−z) into a spiral whose centre sits at the top edge when the
   sheet is fully rolled.
   A page that turns is cloth (cloth.js) while it moves: held along
   its top edge, the bottom edge is carried up the front, so the
   sheet curls up from the bottom, rolls over the top and is let
   go behind, where it drops out of sight; or the other way, back
   over the top and down flat. At rest every page is a flat sheet.
   ───────────────────────────────────────────────────────────── */
const Paper = (() => {
  const T = THREE, SEG = 160;
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeO = x => 1 - Math.pow(1 - x, 3);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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

  /* ── the turning page ──
     A grid of NX × NY particles, its rows closer together near the top where the sheet bends hardest; the top row
     is the hinge and never moves. ZF is the plane of the top sheet, ZB a little behind the sheet beneath. */
  const NX = 8, NY = 22, ZF = 0.0006, ZB = -0.0021, LEAD = 0.05, REL = 0.75;
  /* where the grabbed bottom edge goes as a page turns (p 0 → 1, from lying on the pile to hanging behind; y from
     the top edge, in sheet heights; z toward the reader, in sheet heights). Forward, it goes up the front of the
     page, close to it, so the sheet curls up from the bottom and rolls over the top. Back, it is lifted out and
     away behind and brought over in a wide arch (folded close behind, gravity would hold the fold down there),
     then laid down the front. The last point, where the page comes to hang, is worked out per turn. */
  const KEYS = [[-1, 0], [-0.72, 0.14], [-0.38, 0.26], [0.02, 0.26], [0.3, 0.1], [0.32, -0.12], [0.05, -0.2], [-0.5, -0.08]];
  const KEYS_B = [[-1, 0], [-0.75, 0.16], [-0.4, 0.3], [0.05, 0.3], [0.45, 0.12], [0.55, -0.2], [0.2, -0.45], [-0.35, -0.4]];
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t; return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t2 * t); };

  function build(scene) {
    const root = new T.Group(); root.visible = false; scene.add(root);
    const lit = p => Mats.lit(Object.assign({ roughness: 0.9 }, p));
    const st = { mode: 'hidden', W: 0.24, H: 0.34, R0: 0.011, rolled: true, pages: [], idx: 0, k: 1, kFrom: 1, kTo: 1, kT0: 0, kDur: 1,
      fly: { t0: 0, dur: 1.3, from: null, to: null, back: false }, turn: null, queued: 0, held: { p: new T.Vector3(), q: new T.Quaternion() }, origin: { p: new T.Vector3(), q: new T.Quaternion() }, read: 0, onDone: null, last: 0 };
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
    /* the cloth page (wearing the top sheet's materials while it turns), and the pages already turned over, drawn
       where the last one came to rest: a lip of them shows where they wrap over the clip */
    const cs = { cl: null, meshes: [], lip: null, behind: null, S: null, end: [0, 0], ends: new Float32Array(NX * 2), back: false, hangRow: 2 };
    const col = { yt: 0, zc: 0, back: ZB, rect: null, r: 0, top: 0 };

    function shape(W, H, R0, rolled, hasBoard) {
      st.W = W; st.H = H; st.R0 = R0; st.rolled = rolled;
      sheets.forEach((s, i) => {
        s.meshes.forEach(m => s.holder.remove(m)); if (s.G) { s.G.f.dispose(); s.G.b.dispose(); }
        s.G = geos(W, H);
        const f = new T.Mesh(s.G.f, s.mf), b = new T.Mesh(s.G.b, s.mb); f.frustumCulled = b.frustumCulled = false; f.receiveShadow = b.receiveShadow = false;
        s.holder.add(f, b); s.meshes = [f, b];
        s.pivot.position.set(0, H / 2, i === 0 ? ZF : -ZF); s.holder.position.set(0, -H / 2, 0); s.pivot.visible = true;
        roll(s.G, i === 0 && rolled ? 1 : 0, R0);
      });
      if (boardMesh) { board.remove(boardMesh, clip); boardMesh.geometry.dispose(); }
      /* (the same board and clip as the one hanging on the van, so it reads as that clipboard taken down) */
      boardMesh = new T.Mesh(new T.BoxGeometry(W + 0.026, H + 0.04, 0.005), boardM); boardMesh.position.set(0, 0.012, -0.0035);
      clip = new T.Mesh(new T.BoxGeometry(0.09, 0.03, 0.012), clipM); clip.position.set(0, H / 2 + 0.02, 0.0035);
      board.add(boardMesh, clip); board.visible = !!hasBoard;
      sheets[1].pivot.visible = false;
      shapeCloth(W, H, !!hasBoard);
    }
    /* what the turning page may not pass through, in the sheet's y-z plane (it is the same all across): the pad, or
       the board, as a thin wall with its top at yt; for the clipboard also the clip, as a rounded block (rect, r)
       a little larger than the real one, which the turned pages wrap over */
    function shapeCloth(W, H, hasBoard) {
      if (cs.cl) { cs.meshes.forEach(m => root.remove(m)); cs.meshes[0].geometry.dispose(); root.remove(cs.lip); cs.lip.geometry.dispose(); }
      Object.assign(col, hasBoard ? { yt: H / 2 + 0.032, back: -0.0072, rect: [H / 2 + 0.008, H / 2 + 0.032, -0.0035, 0.0065], r: 0.0055 } : { yt: H / 2, back: ZB, rect: null, r: 0 });
      col.zc = (ZF + col.back) / 2; col.top = col.rect ? col.rect[1] + col.r : col.yt;
      const S = cs.S = Array.from({ length: NY }, (_, j) => H * Math.pow(j / (NY - 1), 1.25));
      /* the rows from here down hang out of sight once a page is over (above them, on the clipboard, is the lip) */
      const lip = col.rect ? (col.top - H / 2) + (col.rect[3] - col.rect[2] + 2 * col.r) + 0.02 : 0.008;
      cs.hangRow = S.findIndex(s => s > lip);
      const cl = cs.cl = Cloth.create({ grids: [{ nx: NX, ny: NY, at: (i, j) => [(i / (NX - 1) - 0.5) * W, H / 2 - S[j], ZF], pin: (i, j) => j === 0, uv: (i, j) => [i / (NX - 1), 1 - S[j] / H],
        stretch: 1, shear: 1, bend: 0.9, tether: [0, 1, 4, 8] }], step: 1 / 240, iters: 6, maxSteps: 120, damp: 2, air: 8, friction: 0.35 });
      cl.collide = collide; cl.onStep = drive;
      const g = cl.geometry(0); g.boundingSphere = new T.Sphere(new T.Vector3(), 2 * H);
      cs.meshes = [new T.Mesh(g, sheets[0].mf), new T.Mesh(g, sheets[0].mb)];
      cs.meshes.forEach(m => { m.frustumCulled = false; m.visible = false; root.add(m); });
      /* the turned pages: their own copy of the positions, taken when a page comes to rest behind */
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(new Float32Array(cl.n * 3), 3)); lg.setAttribute('normal', new T.BufferAttribute(new Float32Array(cl.n * 3), 3));
      lg.setAttribute('uv', g.attributes.uv); lg.setIndex(g.index); lg.boundingSphere = g.boundingSphere;
      cs.lip = new T.Mesh(lg, sheets[0].mb); cs.lip.frustumCulled = false; cs.lip.visible = false; root.add(cs.lip);
      cs.behind = null;
    }
    const tmp = [0, 0];
    /* how far (dy, dz) a point must move to be clear of the clip block */
    function clearClip(y, z, out) {
      const R = col.rect, y0 = R[0], y1 = R[1], z0 = R[2], z1 = R[3], r = col.r, cy = Math.min(y1, Math.max(y0, y)), cz = Math.min(z1, Math.max(z0, z)), ey = y - cy, ez = z - cz, d = Math.hypot(ey, ez);
      out[0] = 0; out[1] = 0; if (d >= r) return;
      if (d > 1e-9) { const s = (r - d) / d; out[0] = ey * s; out[1] = ez * s; return; }
      /* (inside the block's core: out through the nearest face) */
      const a = y - y0, b = y1 - y, c = z - z0, e = z1 - z, m = Math.min(a, b, c, e);
      if (m === a) out[0] = -a - r; else if (m === b) out[0] = b + r; else if (m === c) out[1] = -c - r; else out[1] = e + r;
    }
    function collide(P, Q, n, W, contact) {
      const yt = col.yt, zc = col.zc, back = col.back;
      for (let i = 0; i < n; i++) {
        if (W[i] === 0) continue;
        const k = i * 3, z = P[k + 2];
        /* the wall: below its top a point stays on the side it was on a step ago, however far it was pushed
           (so it cannot slip through, even in one long step); from up at the top it may come down either side */
        if (P[k + 1] <= yt) {
          const front = Q[k + 1] > yt - 0.01 ? z >= zc : Q[k + 2] >= zc;
          if (front ? z < ZF : z > back) { const to = front ? ZF : back; P[k + 2] = to; contact(i, 0, 0, front ? 1 : -1, Math.abs(to - z), 0.35); }
        }
        if (col.rect) { clearClip(P[k + 1], P[k + 2], tmp); if (tmp[0] || tmp[1]) { const d = Math.hypot(tmp[0], tmp[1]); P[k + 1] += tmp[0]; P[k + 2] += tmp[1]; contact(i, 0, tmp[0] / d, tmp[1] / d, d, 0.35); } }
      }
      /* the particles keep out, but the straight pieces between them could still cut through: a piece down the
         sheet with one end in front and one behind (it can only be wrapping over the top) must cross over the top,
         not just under it; and on the clipboard its middle must clear the clip too */
      for (let x = 0; x < NX; x++) for (let j = 0; j + 1 < NY; j++) {
        const a = j * NX + x, b = a + NX, ka = a * 3, kb = b * 3, wa = W[a], wb = W[b];
        if (wa + wb === 0) continue;
        const za = P[ka + 2] - zc, zb = P[kb + 2] - zc;
        if (za * zb < 0) {
          const t = za / (za - zb), yx = P[ka + 1] + t * (P[kb + 1] - P[ka + 1]);
          if (yx < col.top && yx > col.top - 0.03) { const l = Math.min(0.01, col.top - yx) / (wa * (1 - t) * (1 - t) + wb * t * t); P[ka + 1] += wa * (1 - t) * l; P[kb + 1] += wb * t * l; }
        } else if (col.rect) {
          clearClip((P[ka + 1] + P[kb + 1]) / 2, (P[ka + 2] + P[kb + 2]) / 2, tmp);
          if (tmp[0] || tmp[1]) { const s = 2 / (wa + wb); P[ka + 1] += tmp[0] * wa * s; P[ka + 2] += tmp[1] * wa * s; P[kb + 1] += tmp[0] * wb * s; P[kb + 2] += tmp[1] * wb * s; }
        }
      }
    }
    /* the edge's path at p, as [y, z] in the sheet's frame: a spline through the keys, ending where the page hangs */
    const key = (K, k, a) => k >= K.length ? cs.end[a] : a === 0 ? st.H / 2 + K[Math.max(0, k)][0] * st.H : k <= 0 ? ZF : K[k][1] * st.H;
    function path(p, out) {
      const K = st.turn && st.turn.dir < 0 ? KEYS_B : KEYS, n = K.length, u = Math.min(n - 1e-6, Math.max(0, p * n)), i = Math.floor(u), t = u - i;
      for (let a = 0; a < 2; a++) out[a] = cr(key(K, i - 1, a), key(K, i, a), key(K, i + 1, a), key(K, Math.min(i + 2, n), a), t);
      return out;
    }
    /* each frame, the sheet's own pull of gravity: the world's, turned into the held sheet's frame */
    const grav = new T.Vector3(), _iq = new T.Quaternion();
    function gravity() { _iq.copy(root.quaternion).invert(); grav.set(0, -9.81, 0).applyQuaternion(_iq); cs.cl.g[0] = grav.x; cs.cl.g[1] = grav.y; cs.cl.g[2] = grav.z; }
    /* where a page comes to hang behind: over the top (and the clip) and down along gravity, a little away from the
       back. Only the path's last point; the page itself finds its own way there. */
    function hangEnd() {
      const H = st.H, g = Math.hypot(grav.y, grav.z) || 1, dy = Math.min(-0.3, grav.y / g), dz = Math.min(-0.12, grav.z / g), dl = Math.hypot(dy, dz);
      const backZ = col.rect ? col.rect[2] - col.r : col.back, over = (col.top - H / 2) + (ZF - backZ), left = Math.max(0.2 * H, H - over);
      cs.end[0] = col.top + left * dy / dl; cs.end[1] = backZ + left * dz / dl;
    }
    /* put the bottom edge where the turn has got to: each column a little apart (the right side leads, as if
       taken by that corner), and near the end of the way back eased onto where that column of the page hung */
    const pe = [0, 0];
    function placeEdge(p) {
      const cl = cs.cl, e = (NY - 1) * NX;
      for (let i = 0; i < NX; i++) {
        const u = (i / (NX - 1) - 0.5), pi = Math.min(1, Math.max(0, p + LEAD * u * Math.sin(Math.PI * p)));
        path(pi, pe);
        if (cs.back) { const w = sm(0.8, 1, pi); pe[0] += (cs.ends[i * 2] - cs.end[0]) * w; pe[1] += (cs.ends[i * 2 + 1] - cs.end[1]) * w; }
        cl.pin(e + i, cl.R[(e + i) * 3], pe[0], pe[1]);
      }
    }
    function freeEdge(free) { const e = (NY - 1) * NX; for (let i = 0; i < NX; i++) cs.cl.W[e + i] = free ? 1 : 0; }
    /* every step of the cloth: move the turn on, carry the edge (or let it go), and as a page comes down flat ease
       it the last little way onto the sheet it will become */
    function drive(h) {
      const tu = st.turn; if (!tu) return;
      if (tu.drag) { const d = tu.goal - tu.p, m = h * 3.2; tu.p += Math.max(-m, Math.min(m, d)); }
      else if (!tu.free) { tu.t += h; const u = Math.min(1, tu.t / tu.dur); tu.p = tu.p0 + (tu.p1 - tu.p0) * tu.ez(u); if (u >= 1) tu.done = true; }
      else tu.tFree += h;
      if (!tu.free && !tu.drag && tu.p1 === 1 && tu.p >= REL) { tu.free = true; freeEdge(true); }
      if (!tu.free) placeEdge(tu.p);
      /* (the page and its last position move together, so the easing adds no speed of its own) */
      if (!tu.drag && tu.p1 === 0 && tu.p < 0.05) {
        const k = 1 - tu.p / 0.05, w = k * k * 0.5, cl = cs.cl, P = cl.P, Q = cl.Q, R = cl.R;
        for (let q = NX * 3; q < cl.n * 3; q++) { const d = (R[q] - P[q]) * w; P[q] += d; Q[q] += d; }
      }
    }

    function setPage(s, tex) { s.mf.map = tex; s.mf.emissiveMap = tex; s.mf.needsUpdate = true; }
    function showCloth(on) { cs.meshes.forEach(m => { m.visible = on; }); sheets[0].pivot.visible = !on; }
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
      st.mode = 'opening'; st.turn = null; st.queued = 0; root.visible = true; place(0);
    }
    function close(onDone) {
      if (st.mode === 'hidden') return;
      const now = performance.now() / 1000;
      st.turn = null; st.queued = 0; sheets[1].pivot.visible = false; showCloth(false); cs.lip.visible = false;
      if (st.pages[st.idx]) setPage(sheets[0], st.pages[st.idx]);
      if (st.rolled) { st.kFrom = st.k; st.kTo = 1; st.kT0 = now; st.kDur = 0.7; }
      st.fly = { t0: now + (st.rolled ? 0.55 : 0.05), dur: 1.1, back: true };
      st.mode = 'closing'; st.onDone = onDone;
    }
    /* turning: the top sheet goes over the top (next), or the last one turned comes back over and down (previous).
       It can be held part-way by a drag (it follows the pointer) and then let go: past halfway it carries on,
       otherwise it goes back. Either way it ends as a flat sheet showing the page that was landed on.
       The cloth carries one page (the one leaving, or the one coming back); the sheet beneath shows the other. */
    function setupTurn(dir) {
      const j = st.idx + dir; if (j < 0 || j >= st.pages.length) return null;
      const c = dir > 0 ? st.idx : j, b = dir > 0 ? j : st.idx;
      setPage(sheets[0], st.pages[c]); setPage(sheets[1], st.pages[b]); roll(sheets[1].G, 0, st.R0); sheets[1].pivot.visible = true;
      gravity(); hangEnd();
      /* forward, the cloth starts flat on the pile; back, it starts where the last page turned came to hang, its
         edge picked up from exactly there */
      const cl = cs.cl; cs.back = dir < 0;
      if (cs.back && !cs.behind) {
        /* (no page has come to rest behind since this sheet was opened: hang one straight down the back) */
        const H = st.H, top = col.top, bz = (col.rect ? col.rect[2] - col.r : col.back) - 0.002; cs.behind = new Float32Array(cl.n * 3);
        for (let i = 0; i < cl.n; i++) { const j = Math.floor(i / NX), s = cs.S[j]; cs.behind[i * 3] = cl.R[i * 3]; cs.behind[i * 3 + 1] = j ? top - Math.max(0, s - (top - H / 2) - 0.02) : H / 2; cs.behind[i * 3 + 2] = j ? bz : ZF; }
      }
      cl.reset(cs.back ? cs.behind : null);
      if (cs.back) { const e = (NY - 1) * NX; for (let i = 0; i < NX; i++) { cs.ends[i * 2] = cs.behind[(e + i) * 3 + 1]; cs.ends[i * 2 + 1] = cs.behind[(e + i) * 3 + 2]; } }
      freeEdge(false); cl.write(); showCloth(true);
      /* the pages still turned over behind this one */
      cs.lip.visible = (dir > 0 ? st.idx : j) > 0 && !!cs.behind;
      st.last = performance.now() / 1000;
      return j;
    }
    function animate(tu, p1, land, dur, ez) { Object.assign(tu, { drag: false, p0: tu.p, p1, land, t: 0, dur: Math.max(0.25, dur), ez, done: false }); if (p1 === 1 && tu.p >= REL) { tu.free = true; freeEdge(true); } }
    function turn(dir) {
      if (st.mode !== 'open' || (st.turn && st.turn.drag)) return false;
      /* a tap while a sheet is still moving is kept and played as soon as it lands */
      if (st.turn) { const j = st.turn.land + dir; if (j < 0 || j >= st.pages.length) return false; st.queued = dir; return true; }
      const j = setupTurn(dir); if (j === null) return false;
      const tu = st.turn = { dir, j, p: dir > 0 ? 0 : 1, goal: 0, free: false, tFree: 0 };
      animate(tu, dir > 0 ? 1 : 0, j, 0.95, ease);
      return true;
    }
    /* a drag: dir is which way the reader is turning; f goes 0 → 1 as the sheet travels */
    function dragStart(dir) {
      if (st.mode !== 'open' || st.turn) return false;
      const j = setupTurn(dir); if (j === null) return false;
      const p = dir > 0 ? 0 : 1;
      st.turn = { dir, j, p, goal: p, drag: true, free: false, tFree: 0, land: st.idx };
      return true;
    }
    function dragTo(f) {
      const tu = st.turn; if (!tu || !tu.drag) return; f = Math.max(0, Math.min(1, f));
      tu.goal = tu.dir > 0 ? f : 1 - f;
    }
    function dragEnd(commit) {
      const tu = st.turn; if (!tu || !tu.drag) return false;
      /* carried on over, it goes on at the pace it was let go; laid back down it starts gently, or the edge would
         race ahead of the page and fold it */
      const p1 = (tu.dir > 0) === !!commit ? 1 : 0, d = Math.abs(p1 - tu.p);
      animate(tu, p1, commit ? tu.j : st.idx, p1 === 1 ? 0.8 * d : 0.3 + 0.7 * d, p1 === 1 ? easeO : ease);
      return !!commit;
    }
    /* the turn has landed: a flat sheet again, showing the page it came to. A page that went over is kept as the
       turned pages' shape (drawn a hair nearer the board than it hung, so the next page can come to rest on it). */
    function land() {
      const tu = st.turn, cl = cs.cl;
      if (tu.p1 === 1) {
        cs.behind = cs.behind || new Float32Array(cl.n * 3); cs.behind.set(cl.P);
        cl.write(); const g = cs.lip.geometry, pa = g.attributes.position.array, na = g.attributes.normal.array;
        for (let i = 0; i < cl.n * 3; i++) { pa[i] = cl.P[i] + cl.N[i] * 0.0006; na[i] = cl.N[i]; }
        g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
      }
      st.idx = tu.land; setPage(sheets[0], st.pages[st.idx]); showCloth(false); sheets[1].pivot.visible = false;
      cs.lip.visible = st.idx > 0 && !!cs.behind;
      st.turn = null;
      if (st.queued) { const q = st.queued; st.queued = 0; turn(q); }
    }
    /* a page let go behind has landed once it has dropped out of sight and slowed (or after a while, regardless) */
    function settled() {
      const tu = st.turn, cl = cs.cl, P = cl.P, Q = cl.Q, h = cl.step; if (tu.tFree < 0.3) return false; if (tu.tFree > 0.9) return true;
      let v = 0; for (let i = NX * cs.hangRow; i < cl.n; i++) { const k = i * 3; if (P[k + 1] > col.yt || P[k + 2] > col.zc) return false; v = Math.max(v, Math.abs(P[k] - Q[k]) + Math.abs(P[k + 1] - Q[k + 1]) + Math.abs(P[k + 2] - Q[k + 2])); }
      return v / h < 0.15;
    }
    function stepTurn() {
      const tu = st.turn, now = performance.now() / 1000;
      /* the cloth's clock: the real time since the last frame, but no more than the frame the scene itself takes
         (the test bench, drawing a frame every few seconds, lets that be longer) */
      const dt = Math.min((typeof window !== 'undefined' && window.__coveDtCap) || 0.1, Math.max(0, now - st.last)); st.last = now;
      gravity();
      cs.cl.update(dt);
      cs.cl.write();
      if (tu.free ? settled() : tu.done) land();
    }
    const _p = new T.Vector3(), _o = new T.Vector3(), _up = new T.Vector3(), _out = new T.Vector3(), rolledOff = new T.Vector3();
    /* the rolled sheet's spiral sits at the top edge; keep that point on the origin while it is rolled */
    function place(e) {
      rolledOff.set(0, st.H / 2, -st.R0).multiplyScalar(st.rolled ? 1 - Math.min(1, e * 1.15) : 0);
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
      if (st.turn) stepTurn();
      if (st.mode === 'opening' && fe >= 1 && (!st.rolled || now >= st.kT0 + st.kDur)) st.mode = 'open';
      if (st.mode === 'closing' && fe >= 1) { st.mode = 'hidden'; root.visible = false; const f = st.onDone; st.onDone = null; if (f) f(); }
    }
    function setReadLight(k) { sheets.forEach(s => { s.mf.emissiveIntensity = k; s.mb.emissiveIntensity = k * 0.6; }); boardM.emissiveIntensity = k * 0.5; clipM.emissiveIntensity = k * 0.5; }
    function setHeld(p, q) { st.held.p.fromArray(p); st.held.q.fromArray(q); }
    /* the page being read: where the sheet in motion (and any tap waiting behind it) is headed, not the one it left */
    const target = () => { const tu = st.turn; if (!tu || tu.drag) return st.idx; return Math.max(0, Math.min(st.pages.length - 1, tu.land + (st.queued || 0))); };
    return { open, close, turn, dragStart, dragTo, dragEnd, update, setReadLight, setHeld, state: st, cloth: cs, get idx() { return st.idx; }, get target() { return target(); }, get count() { return st.pages.length; }, get mode() { return st.mode; }, get dragging() { return !!(st.turn && st.turn.drag); }, busy: () => !!st.turn || st.mode === 'opening' || st.mode === 'closing' };
  }
  return { build };
})();
