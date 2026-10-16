/* ─────────────────────────────────────────────────────────────
   loader.js — what shows while the cove is being built: a grid of
   dots standing up in front of you, and coloured snakes gliding
   along its lines from dot to dot, each round its own wandering
   loop, the dots they pass lighting up in their colour and a trace
   of it drawn behind them, joining the dots, that fades as they go
   on. It runs first, before three.js, and it is nothing but
   transform and opacity keyframes (Web Animations), worked out once
   here: the compositor plays them by itself, so they stay smooth
   while the page is busy for a few seconds building the scene. The
   grid itself is the background's own pattern, drawn once.
   ───────────────────────────────────────────────────────────── */
const Loader = (() => {
  const stage = document.getElementById('ldStage');
  if (!stage) return { stop() {} };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !stage.animate;
  let anims = [], live = true, resizeT = 0;

  /* the snakes' colours: amber, sea-teal, coral, lilac, leaf (classes s0…s4) */
  const NS = 5;
  /* how fast they go (grid steps a second), how long each is (steps), how many beads make up its body, how long the
     trace it draws stays lit after its tail has passed (s) and how long it takes to fade */
  const V = 2.3, LEN = 3.4, BEADS = 44, HOLD = 1.1, FADE = 3.2;

  /* numbers of our own, the same each time (a loader that looked different every load would be no worse, but this way
     what was tuned is what shows) */
  let seed = 0x5eed1e;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const el = (cls, css) => { const e = document.createElement('i'); e.className = cls; if (css) Object.assign(e.style, css); stage.appendChild(e); return e; };
  const px = v => v.toFixed(1) + 'px';
  function play(e, frames, T, delay) {
    if (still) return;
    anims.push(e.animate(frames, { duration: T * 1000, iterations: Infinity, fill: 'both', delay: delay * 1000 }));
  }
  /* a signal over one loop of T seconds from points [t, value] that may run past either end: wrapped into the loop,
     its value at the loop's ends worked out, so it runs on round the loop without a seam */
  function cyc(pts, T) {
    const all = [];
    for (const k of [-1, 0, 1]) for (const [t, v] of pts) all.push([t + k * T, v]);
    all.sort((a, b) => a[0] - b[0]);
    const at = t => { for (let i = 0; i < all.length - 1; i++) if (all[i][0] <= t && all[i + 1][0] >= t) { const [t0, v0] = all[i], [t1, v1] = all[i + 1]; return t1 > t0 ? v0 + (v1 - v0) * (t - t0) / (t1 - t0) : v1; } return 0; };
    const out = [[0, at(0)]]; for (const [t, v] of all) if (t > 0 && t < T) out.push([t, v]); out.push([T, at(T)]);
    return out;
  }

  const DIR = { R: [1, 0], L: [-1, 0], D: [0, 1], U: [0, -1] }, BACK = { R: 'L', L: 'R', D: 'U', U: 'D' };
  /* a snake's round: through a few places in its own part of the grid, in turn round its middle, and back to the first,
     along the grid's lines one step at a time — mostly straight on, turning now and then, never doubling back */
  function round(c, ri, rj, IR, JR) {
    const n = 5 + Math.floor(rnd() * 3), pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k + 0.35 * rnd()) / n * Math.PI * 2, r = 0.45 + 0.55 * rnd();
      let i = Math.round(c[0] + Math.cos(a) * ri * r), j = Math.round(c[1] + Math.sin(a) * rj * r);
      /* (kept inside the grid's bright middle) */
      const q = Math.hypot(i / IR, j / JR); if (q > 1) { i = Math.round(i / q); j = Math.round(j / q); }
      pts.push([i, j]);
    }
    const steps = []; let cur = pts[0].slice(), prev = null;
    for (let w = 1; w <= n; w++) {
      const tg = pts[w % n];
      for (let g = 0; g < 400 && (cur[0] !== tg[0] || cur[1] !== tg[1]); g++) {
        const dx = tg[0] - cur[0], dy = tg[1] - cur[1], ok = [];
        if (dx > 0) ok.push('R'); if (dx < 0) ok.push('L'); if (dy > 0) ok.push('D'); if (dy < 0) ok.push('U');
        const fw = ok.filter(d => d !== BACK[prev]);
        let d;
        if (!fw.length) d = prev === 'L' || prev === 'R' ? (rnd() < 0.5 ? 'U' : 'D') : (rnd() < 0.5 ? 'L' : 'R');
        else if (fw.includes(prev) && rnd() < 0.72) d = prev;
        else d = fw[Math.floor(rnd() * fw.length)];
        steps.push(d); cur = [cur[0] + DIR[d][0], cur[1] + DIR[d][1]]; prev = d;
      }
    }
    /* (no doubling back anywhere, round the join too) */
    let start = pts[0].slice();
    for (let changed = true; changed && steps.length > 4;) {
      changed = false;
      for (let i = 0; i < steps.length - 1; i++) if (steps[i + 1] === BACK[steps[i]]) { steps.splice(i, 2); changed = true; break; }
      if (!changed && steps.length > 4 && steps[0] === BACK[steps[steps.length - 1]]) { const d = steps.pop(); steps.shift(); start = [start[0] - DIR[d][0], start[1] - DIR[d][1]]; changed = true; }
    }
    /* its points, one a step */
    const P = [start]; for (const d of steps) { const p = P[P.length - 1]; P.push([p[0] + DIR[d][0], p[1] + DIR[d][1]]); }
    return { steps, P };
  }

  function build() {
    const W = innerWidth, H = innerHeight;
    /* the grid: a dot every S pixels, standing up in front of you, its middle a little above the screen's */
    const S = Math.round(Math.max(22, Math.min(38, Math.min(W, H) / 19))), cx = Math.round(W / 2), cy = Math.round(H * 0.45);
    const X = i => cx + i * S, Y = j => cy + j * S;
    el('ld-grid', { backgroundSize: `${S}px ${S}px`, backgroundPosition: `${px(cx - S / 2)} ${px(cy - S / 2)}` });
    /* where the snakes go: the grid's bright middle, an ellipse; each its own part of it, round its own middle */
    const IR = Math.max(4, Math.floor(W * 0.38 / S)), JR = Math.max(4, Math.floor(H * 0.3 / S));
    const n = W < 520 ? 4 : NS;
    for (let k = 0; k < n; k++) {
      const a = (k / n + 0.08) * Math.PI * 2, c = [Math.round(Math.cos(a) * IR * 0.42), Math.round(Math.sin(a) * JR * 0.42)];
      const R = round(c, IR * 0.6, JR * 0.6, IR, JR), N = R.steps.length; if (N < 6) continue;
      const T = N / V, lag = LEN / V, phase = lag + rnd() * T;
      /* (its corners, where its straight runs meet: the head goes straight between them, at a steady pace) */
      const corners = [0]; for (let s = 1; s < N; s++) if (R.steps[s] !== R.steps[s - 1]) corners.push(s); corners.push(N);
      const tf = s => `translate(${px(X(R.P[s][0]))}, ${px(Y(R.P[s][1]))})`;
      const path = corners.map(s => ({ offset: s / N, transform: tf(s), easing: 'linear' }));

      /* the trace it draws behind it, a stroke between each pair of dots it joins: drawn out as the head runs along it,
         lit while the body lies on it, then fading */
      R.steps.forEach((d, s) => {
        const [i, j] = R.P[s], [i2, j2] = R.P[s + 1], hz = d === 'L' || d === 'R';
        const x0 = Math.min(X(i), X(i2)), y0 = Math.min(Y(j), Y(j2));
        const bar = el(`ld-trace s${k}`, hz ? { width: px(S), height: '2px', left: px(x0), top: px(y0 - 1) } : { width: '2px', height: px(S), left: px(x0 - 1), top: px(y0) });
        bar.style.transformOrigin = { R: 'left center', L: 'right center', D: 'center top', U: 'center bottom' }[d];
        const t0 = s / V, t1 = (s + 1) / V, t2 = t1 + LEN / V + HOLD, t3 = t2 + FADE;
        const op = cyc([[t0 - 0.001, 0], [t0, 0.85], [t2, 0.55], [t3, 0]], T), sc = cyc([[t0 - 0.001, 0], [t0, 0], [t1, 1], [t3, 1], [t3 + 0.001, 0]], T);
        const times = [...new Set([...op, ...sc].map(p => p[0]))].sort((a, b) => a - b);
        const val = (L, t) => { for (let q = 0; q < L.length - 1; q++) if (L[q][0] <= t && L[q + 1][0] >= t) return L[q + 1][0] > L[q][0] ? L[q][1] + (L[q + 1][1] - L[q][1]) * (t - L[q][0]) / (L[q + 1][0] - L[q][0]) : L[q + 1][1]; return L[L.length - 1][1]; };
        if (still) { const age = ((phase - t0) % T + T) % T; bar.style.opacity = age < LEN / V + HOLD ? 0.7 : 0; return; }
        play(bar, times.map(t => ({ offset: t / T, opacity: val(op, t).toFixed(3), transform: `${hz ? 'scaleX' : 'scaleY'}(${val(sc, t).toFixed(3)})` })), T, -phase);
      });
      /* the dots it passes: lit in its colour as its head comes over them, swelling a little, then dimming */
      const lit = new Map();
      for (let s = 0; s <= N; s++) { const key = R.P[s % N].join(','); if (!lit.has(key)) lit.set(key, []); lit.get(key).push(s / V); }
      for (const [key, ts] of lit) {
        const [i, j] = key.split(',').map(Number), dot = el(`ld-node s${k}`, { left: px(X(i) - 5), top: px(Y(j) - 5) });
        if (still) continue;
        const pts = []; for (const t of [...new Set(ts.map(t => +(t % T).toFixed(4)))]) pts.push([t - 0.001, 0], [t + 0.06, 1], [t + 0.45, 0.6], [t + 1.6, 0]);
        pts.sort((a, b) => a[0] - b[0]);
        const sig = cyc(pts, T);
        play(dot, sig.map(([t, v]) => ({ offset: t / T, opacity: v.toFixed(3), transform: `scale(${(0.5 + 0.7 * v).toFixed(3)})` })), T, -phase);
      }
      /* the snake: a soft glow round its head, under it; beads along its path, each a little behind the one before (so it
         bends round the corners as the head did), thinning and fading to the tail */
      const hd = Math.max(9, S * 0.34);
      const glow = el(`ld-glow s${k}`, { width: px(hd * 7), height: px(hd * 7), marginLeft: px(-hd * 3.5), marginTop: px(-hd * 3.5) });
      if (still) glow.style.transform = tf(Math.floor((phase * V) % N)); else play(glow, path, T, -phase);
      for (let b = BEADS - 1; b >= 0; b--) {
        const f = b / (BEADS - 1), d = hd * (1 - 0.6 * Math.pow(f, 1.3)), bead = el(`ld-bead s${k}${b === 0 ? ' head' : ''}`, { width: px(d), height: px(d), marginLeft: px(-d / 2), marginTop: px(-d / 2), opacity: (1 - 0.45 * f * f).toFixed(3) });
        const back = f * LEN / V;
        if (still) { const s = Math.floor(((phase - back) * V % N + N) % N); bead.style.transform = tf(s); continue; }
        play(bead, path, T, -(phase - back));
      }
    }
    /* (the grid fading out into the dark toward the screen's edges) */
    el('ld-vig');
  }

  function clear() { anims.forEach(a => a.cancel()); anims = []; stage.textContent = ''; }
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(() => { if (live) { clear(); seed = 0x5eed1e; build(); } }, 200); }
  /* the cove is up and the loader has faded: let the compositor go */
  function stop() { if (!live) return; live = false; clearTimeout(resizeT); removeEventListener('resize', onResize); clear(); }

  build();
  addEventListener('resize', onResize);
  return { stop };
})();
