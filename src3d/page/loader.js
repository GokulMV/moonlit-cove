/* ─────────────────────────────────────────────────────────────
   loader.js — what shows while the cove is being built: tonight's
   sky over the visitor, every star where it really is for their
   place and time (astro.js and stardata.js come first: it is the
   same sky the cove then draws). The stars come out one by one,
   the brightest first, as they do at dusk, and then a few of them
   join up into GK. It is the cove's own camera, tipped up from the
   home view into the sky over the sea: stepping in, the cove's sky
   takes over from these stars where they stand, and the camera
   tilts down to the camp (app.js enter). It runs first, before
   three.js, and it is nothing but transform and opacity animations
   (Web Animations) worked out once here, so the compositor plays
   them while the page is busy for a few seconds building the
   scene. Every few seconds the stars move on with the sky's
   turning, so they are still where the cove's are when you step in.
   ───────────────────────────────────────────────────────────── */
const Loader = (() => {
  const stage = document.getElementById('ldStage');
  const none = { stop() {}, sky: () => null };
  if (!stage || typeof Astro === 'undefined' || typeof StarData === 'undefined') return none;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !stage.animate;
  let anims = [], live = true, resizeT = 0, tickT = 0, view = null;

  /* the view: the home view's heading (out over the sea, toward −z), tipped up 42° into the sky; the cove's camera's
     field of view, 50° up and down, widened on a narrow screen as app.js widens it (three.js's lookAt: right is +x) */
  const PITCH = 42 * Math.PI / 180, cP = Math.cos(PITCH), sP = Math.sin(PITCH);
  const FWD = [0, sP, -cP], RIGHT = [1, 0, 0], UP = [0, cP, sP], FOV = 50;
  const fovAt = a => a < 1.2 ? Math.min(80, FOV * (1 + (1.2 - a) * 0.75)) : FOV;

  /* the sky's time as the cove will show it (app.js nowMs): now, or the hour picked, today; moved on to the next full
     moon if that is asked for. And where: the city of the visitor's time zone (astro.js locate) */
  const get = (k, d) => { try { const v = localStorage.getItem('cove.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const dayOf = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const liveT = get('timeMode', 'live') === 'live', hour = +get('hour', 23) || 0, day0 = dayOf(Date.now());
  let shift = 0;
  try { if (get('full2', false)) { const now = Date.now(); shift = dayOf(Astro.nextFullMoon(now - 2 * 864e5)) - dayOf(now); } } catch (e) { shift = 0; }
  const skyMs = () => (liveT ? Date.now() : day0 + hour * 3600e3) + shift;
  let loc; try { loc = Astro.locate(); } catch (e) { loc = { lat: 20, lng: 78 }; }

  /* a star's colour from its B−V index, as stars.js has it (its temperature, the colour of a body that hot, a little
     paler than that, as the eye sees them), for the page: 0..255 */
  function colour(bv) {
    const K = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)), t = K / 100;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    const c = [r, g, b].map(v => Math.pow(Math.max(0, Math.min(255, v)) / 255, 2.2)), m = Math.max(...c);
    return c.map(v => Math.round(255 * Math.pow(0.4 + 0.6 * v / m, 1 / 2.2)));
  }
  /* the catalogue's stars, to magnitude 6 (stardata.js: RA, Dec, magnitude, B−V), as directions among the stars */
  const STARS = (() => {
    const s = atob(StarData.stars), n = Math.min(StarData.count, Math.floor(s.length / 6)), out = [];
    const u16 = i => s.charCodeAt(i) | (s.charCodeAt(i + 1) << 8);
    for (let i = 0; i < n; i++) {
      const o = i * 6, ra = u16(o) / 65535 * Math.PI * 2, dec = (u16(o + 2) / 65535 - 0.5) * Math.PI;
      out.push({ v: [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], mag: s.charCodeAt(o + 4) / 30 - 2, bv: s.charCodeAt(o + 5) / 100 - 0.5 });
    }
    /* and the planets, tonight's, bright and steady among them */
    try { for (const P of Astro.planets(skyMs())) if (P.mag < 3) out.push({ v: [Math.cos(P.dec) * Math.cos(P.ra), Math.cos(P.dec) * Math.sin(P.ra), Math.sin(P.dec)], mag: P.mag, rgb: P.col.map(c => Math.round(255 * Math.pow(c, 1 / 2.2))), planet: true }); } catch (e) { /* stars alone */ }
    return out;
  })();

  /* the turn of the sky at ms: a direction among the stars → the cove's world (−x north, −z east, y up; stars.js frame),
     rows of a 3×3 */
  function turnAt(ms) {
    const L = Astro.lst(ms, loc.lng), p = loc.lat * Math.PI / 180, cL = Math.cos(L), sL = Math.sin(L), cp = Math.cos(p), sp = Math.sin(p);
    return [sp * cL, sp * sL, -cp, cp * cL, cp * sL, sp, sL, -cL, 0];
  }
  /* where a direction among the stars falls on the screen (px), seen by the view; null behind it */
  function project(V, v, out) {
    const M = V.M, x = M[0] * v[0] + M[1] * v[1] + M[2] * v[2], y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2], z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
    const cz = x * FWD[0] + y * FWD[1] + z * FWD[2]; if (cz < 0.08) return null;
    const cx = x * RIGHT[0] + y * RIGHT[1] + z * RIGHT[2], cy = x * UP[0] + y * UP[1] + z * UP[2];
    out[0] = (cx / cz / (V.t * V.a) + 1) / 2 * V.W; out[1] = (1 - cy / cz / V.t) / 2 * V.H; return out;
  }
  /* and back: the direction among the stars at a point on the screen */
  function unproject(V, px, py) {
    const nx = (px / V.W * 2 - 1) * V.t * V.a, ny = (1 - py / V.H * 2) * V.t;
    const d = [0, 1, 2].map(i => FWD[i] + RIGHT[i] * nx + UP[i] * ny), l = Math.hypot(...d), M = V.M;
    return [0, 1, 2].map(j => (M[j] * d[0] + M[3 + j] * d[1] + M[6 + j] * d[2]) / l);
  }
  const viewAt = ms => { const W = innerWidth, H = innerHeight, a = W / H; return { W, H, a, t: Math.tan(fovAt(a) * Math.PI / 360), M: turnAt(ms) }; };

  /* GK, as a constellation: each letter's corners in a box a letter high (G's arc and its bar, K's stem, arm and leg),
     and the lines between them */
  const GLY = [[0.64, 0.13], [0.33, 0.0], [0.06, 0.2], [0.0, 0.52], [0.12, 0.86], [0.42, 1.0], [0.68, 0.86], [0.7, 0.58], [0.4, 0.58]];
  const KLY = [[0, 0], [0, 1], [0.03, 0.56], [0.62, 0.0], [0.66, 1.0]], KX = 1.04, GKW = KX + 0.66;
  const LINES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [9, 11], [11, 10], [11, 12], [11, 13]];

  /* numbers of our own, the same each time */
  let seed = 0x5eed1e;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const px = v => v.toFixed(1) + 'px';
  const el = (cls, css, parent) => { const e = document.createElement(cls === 'canvas' ? 'canvas' : 'i'); if (cls !== 'canvas') e.className = cls; else e.className = 'ld-c'; if (css) Object.assign(e.style, css); (parent || stage).appendChild(e); return e; };
  function play(e, frames, o) { if (still) return null; const a = e.animate(frames, Object.assign({ fill: 'both' }, o)); anims.push(a); return a; }

  /* how a star looks: its core (px) and how bright, by its magnitude */
  const coreOf = m => Math.max(1.5, Math.min(5.6, 3.9 - 0.62 * m)), litOf = m => Math.max(0.32, Math.min(1, 1.08 - 0.14 * m));
  const rgbOf = s => s.rgb || colour(s.bv);

  /* the faint ones, painted on a canvas (two: those to magnitude 5.1, and to 6) */
  function paint(cv, V, list) {
    const dpr = Math.min(2, devicePixelRatio || 1), g = cv.getContext('2d'); if (!g) return;
    cv.width = Math.round(V.W * dpr); cv.height = Math.round(V.H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, V.W, V.H);
    const p = [0, 0];
    for (const s of list) {
      if (!project(V, s.v, p)) continue;
      const c = rgbOf(s), a = Math.max(0.22, Math.min(0.7, 1.3 - 0.18 * s.mag)), r = Math.max(0.5, 1.1 - 0.1 * s.mag);
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
    }
  }

  /* how light the sky is behind the stars: the moon's light when it is up (as full as it is, and as high), and the dusk
     or the day; the loader's sky a little lighter for it, so the cove's comes in under it gently */
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function tint(ms) {
    let k = 0;
    try { const S = Astro.sun(ms, loc.lat, loc.lng), Mo = Astro.moon(ms, loc.lat, loc.lng), f = Astro.illumination(ms).fraction; k = Math.min(1, 0.6 * f * sm(0, 0.5, Math.sin(Mo.alt)) + 0.65 * sm(-0.21, 0.02, S.alt)); } catch (e) { k = 0; }
    const D = [[19, 33, 58], [11, 21, 39], [7, 13, 26], [4, 7, 14]], L = [[58, 74, 104], [42, 55, 82], [30, 41, 64], [21, 29, 47]];
    const c = D.map((d, i) => d.map((v, j) => Math.round(v + (L[i][j] - v) * k)));
    stage.parentElement.style.background = `radial-gradient(150% 95% at 50% 125%, rgb(${c[0]}) 0%, rgb(${c[1]}) 34%, rgb(${c[2]}) 62%, rgb(${c[3]}) 100%)`;
  }

  function build(instant) {
    const V = viewAt(skyMs()), { W, H } = V, p = [0, 0];
    seed = 0x5eed1e; tint(skyMs());
    /* every star in the view (a margin round it, as they move on) */
    const on = [];
    for (const s of STARS) { if (!project(V, s.v, p) || p[0] < -24 || p[0] > W + 24 || p[1] < -24 || p[1] > H + 24) continue; on.push({ s, x: p[0], y: p[1] }); }

    /* where GK goes: across the sky over the card (as high as the space over it allows), or, where there is no room for
       it there, in the middle of the sky */
    const card = document.querySelector('.intro-card'), cr = card ? card.getBoundingClientRect() : null;
    const y0 = Math.max(26, H * 0.07), y1 = (cr && cr.height ? cr.top : H * 0.6) - Math.max(22, H * 0.045);
    let Hl = Math.min((y1 - y0) * 0.8, W * 0.92 / GKW, 190), top = y0 + (y1 - y0 - Hl) * 0.45;
    if (Hl < 56) { Hl = Math.min(H * 0.3, W * 0.8 / GKW, 200); top = (H - Hl) * 0.42; }
    const left = (W - GKW * Hl) / 2, anchors = [...GLY.map(([x, y]) => [left + x * Hl, top + y * Hl]), ...KLY.map(([x, y]) => [left + (KX + x) * Hl, top + y * Hl])];
    /* each corner a real star near it, a bright one by preference (none near enough: one put there, among the faint) */
    const used = new Set(), rs = Math.max(10, 0.17 * Hl), gk = anchors.map(([ax, ay]) => {
      let best = null, bs = Infinity;
      for (const q of on) { if (used.has(q) || q.s.planet) continue; const d = Math.hypot(q.x - ax, q.y - ay); if (d > rs) continue; const sc = d / rs + 0.22 * Math.max(0, q.s.mag - 1.5); if (sc < bs) { bs = sc; best = q; } }
      if (best) { used.add(best); return best; }
      const jx = ax + (rnd() - 0.5) * rs * 0.5, jy = ay + (rnd() - 0.5) * rs * 0.5, q = { s: { v: unproject(V, jx, jy), mag: 3.4 + rnd() * 0.6, bv: 0.2 + rnd() * 0.6 }, x: jx, y: jy };
      used.add(q); return q;
    });

    /* the bright ones (and GK's) as themselves, the rest painted */
    const dom = on.filter(q => q.s.mag <= 4.2 || used.has(q)); for (const q of gk) if (!dom.includes(q)) dom.push(q);
    const faintA = on.filter(q => q.s.mag > 4.2 && q.s.mag <= 5.1 && !used.has(q)).map(q => q.s), faintB = on.filter(q => q.s.mag > 5.1 && !used.has(q)).map(q => q.s);
    const cA = el('canvas'), cB = el('canvas'); paint(cA, V, faintA); paint(cB, V, faintB);
    const T0 = 0.25, sec = v => v * 1000;
    if (instant || still) { cA.style.opacity = 1; cB.style.opacity = 0.92; }
    else { play(cA, [{ opacity: 0 }, { opacity: 1 }], { duration: sec(1.6), delay: sec(3.3), easing: 'ease-out' }); play(cB, [{ opacity: 0 }, { opacity: 0.92 }], { duration: sec(1.9), delay: sec(4.3), easing: 'ease-out' }); }

    /* the stars themselves: each placed by its holder (moved on with the sky), shown by its dot: coming out by
       magnitude, brightest first, each a little before or after its turn; the brightest then twinkling, gently */
    const items = [];
    for (const q of dom) {
      const s = q.s, d = coreOf(s.mag) * (used.has(q) ? 1.15 : 1), big = d * (s.mag < 1.6 ? 4.2 : 3.2), c = rgbOf(s), lit = litOf(s.mag) * (used.has(q) ? 1 : 0.96);
      const hold = el('ld-s', { transform: `translate(${px(q.x)}, ${px(q.y)})` });
      const dot = el('ld-d', { width: px(big), height: px(big), marginLeft: px(-big / 2), marginTop: px(-big / 2),
        background: `radial-gradient(circle closest-side, rgb(${c}) 0 ${(100 * d / big * 0.5).toFixed(0)}%, rgba(${c},0.32) ${(100 * d / big * 0.95).toFixed(0)}%, rgba(${c},0) 100%)` }, hold);
      items.push({ hold, v: s.v });
      const at = T0 + (Math.min(4.2, s.mag) + 1.6) * 0.62 + rnd() * 0.35;
      if (instant || still) { dot.style.opacity = lit.toFixed(3); continue; }
      play(dot, [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: lit.toFixed(3), transform: 'scale(1)' }], { duration: sec(1.1), delay: sec(at), easing: 'cubic-bezier(.2,.7,.3,1)' });
      if (s.mag <= 3 && !s.planet) { const T = 2.4 + rnd() * 3.1; play(dot, [{ opacity: lit.toFixed(3) }, { opacity: (lit * 0.7).toFixed(3) }, { opacity: lit.toFixed(3) }], { duration: sec(T), delay: sec(at + 1.1 + rnd() * T), iterations: Infinity, easing: 'ease-in-out', fill: 'none' }); }
    }

    /* GK: once most of the stars are out, its lines drawn star to star, G's arc and bar, then K's stem, arm and leg; each
       star lighting up as its first line reaches it */
    const lines = [], G0 = 3.7, step = 0.32, dur = 0.46;
    const lit0 = new Map();
    LINES.forEach(([i, j], n) => {
      const a = gk[i], b = gk[j], t0 = G0 + n * step + (n >= 8 ? 0.3 : 0);
      const hold = el('ld-l'), line = el('ld-ln', null, hold);
      lines.push({ hold, line, a: items.find(it => it.v === a.s.v), b: items.find(it => it.v === b.s.v), av: a.s.v, bv: b.s.v });
      if (!lit0.has(i)) lit0.set(i, t0); if (!lit0.has(j)) lit0.set(j, t0 + dur);
      if (instant || still) { line.style.transform = 'none'; return; }
      play(line, [{ transform: 'scaleX(0)', opacity: 0.4 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: sec(dur), delay: sec(t0), easing: 'cubic-bezier(.45,.05,.4,1)' });
    });
    const halos = [];
    gk.forEach((q, i) => {
      const r = Math.max(9, coreOf(q.s.mag) * 4.4), hold = el('ld-s', { transform: `translate(${px(q.x)}, ${px(q.y)})` });
      const h = el('ld-h', { width: px(r * 2), height: px(r * 2), marginLeft: px(-r), marginTop: px(-r) }, hold);
      halos.push({ hold, v: q.s.v });
      if (instant || still) { h.style.opacity = 0.85; return; }
      play(h, [{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 0.85, transform: 'scale(1)' }], { duration: sec(0.7), delay: sec(lit0.get(i) || G0), easing: 'ease-out' });
    });
    view = { V, items: items.concat(halos), lines, cA, cB, faintA, faintB };
    place(view, false);
  }

  /* everything where the sky has it now: the stars and GK's lines moved on (smoothly, over the time till the next look),
     the faint ones painted again */
  const TICK = 12;
  function place(S, glide) {
    const V = S.V, p = [0, 0];
    for (const it of S.items) { if (!project(V, it.v, p)) continue; it.hold.style.transition = glide ? `transform ${TICK}s linear` : 'none'; it.hold.style.transform = `translate(${px(p[0])}, ${px(p[1])})`; it.x = p[0]; it.y = p[1]; }
    for (const L of S.lines) {
      const a = [0, 0], b = [0, 0]; if (!project(V, L.av, a) || !project(V, L.bv, b)) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      L.hold.style.transition = glide ? `transform ${TICK}s linear` : 'none';
      L.hold.style.transform = `translate(${px(a[0])}, ${px(a[1])}) rotate(${Math.atan2(dy, dx).toFixed(5)}rad)`; L.line.style.width = px(len);
    }
  }
  function tick() {
    if (!live || !view) return;
    if (liveT) { view.V = viewAt(skyMs() + TICK * 1000); place(view, true); paint(view.cA, view.V, view.faintA); paint(view.cB, view.V, view.faintB); }
  }

  function clear() { anims.forEach(a => a.cancel()); anims = []; stage.textContent = ''; view = null; }
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(() => { if (live) { clear(); build(true); } }, 200); }
  /* the cove is up and stepped into, and the loader has faded: let the compositor go */
  function stop() { if (!live) return; live = false; clearTimeout(resizeT); clearInterval(tickT); removeEventListener('resize', onResize); clear(); }

  build(false);
  addEventListener('resize', onResize);
  tickT = setInterval(tick, TICK * 1000);
  /* the view, for app.js to start the cove's camera from (where it looks, and its field of view) */
  return { stop, sky: () => (live ? { dir: FWD.slice(), fov: FOV } : null) };
})();
