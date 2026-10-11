/* ─────────────────────────────────────────────────────────────
   loader.js — what shows while the cove is being built: a ball
   bouncing on a floor of dots, changing colour as it lands, every
   landing sending a ripple out through the dots; after a few
   bounces it hops off somewhere else and starts again. It runs
   first, before three.js, and it is nothing but transform and
   opacity keyframes (Web Animations), worked out once here: the
   compositor plays them by itself, so they stay smooth while the
   page is busy for a few seconds building the scene.
   ───────────────────────────────────────────────────────────── */
const Loader = (() => {
  const stage = document.getElementById('ldStage');
  if (!stage) return { stop() {} };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !stage.animate;
  let anims = [], live = true, resizeT = 0;

  /* moonlight, amber, sea-teal, coral, lilac (classes c0…c4), and the order the ball wears them in, one per landing:
     shuffled by hand to look random, never the same twice running, round the loop too */
  const ORDER = [1, 2, 4, 3, 0, 2, 1, 4, 0, 3, 2, 4];
  /* where it lands, as fractions of the floor's half-width and half-depth: three landings at each, then on to the next */
  const SPOTS = [[-0.5, 0.2], [0.52, -0.38], [0.18, 0.66], [-0.32, -0.46]];
  /* the bounces (heights as fractions of the big hop between spots), how long the ball stays down, gravity */
  const BOUNCES = [0.7, 0.45], CONTACT = 0.09, G = 6.6;
  const air = h => 2 * Math.sqrt(2 * h / G);
  /* ripples run across the floor at v floor units a second and die out by `reach`; the coloured ring at the landing
     spot keeps pace with them for its first RING units */
  const RIP = { v: 1.35, reach: 2.2, rise: 0.09, fall: 0.62 }, RING = 0.75;
  /* a thrown ball rises easing out and falls easing in */
  const UP = 'cubic-bezier(0.5, 1, 0.89, 1)', DOWN = 'cubic-bezier(0.11, 0, 0.5, 0)';

  /* the choreography, in seconds: each step starts as the ball touches down, stays down for CONTACT, and is aloft
     for air(h); the third step at each spot is the hop to the next one. `hit` is how hard it landed */
  const seq = []; let LOOP = 0;
  SPOTS.forEach((_, k) => [...BOUNCES, 1].forEach((h, j) => {
    seq.push({ t: LOOP, h, at: k, to: j === BOUNCES.length ? (k + 1) % SPOTS.length : k, hit: j ? Math.sqrt(BOUNCES[j - 1]) : 1 });
    LOOP += CONTACT + air(h);
  }));
  /* it starts high in the air, halfway along the hop from the first spot to the second */
  const PHASE = seq[2].t + CONTACT + air(1) / 2;
  const off = t => Math.min(1, Math.max(0, t / LOOP));

  const el = (cls, css) => { const e = document.createElement('i'); e.className = cls; if (css) Object.assign(e.style, css); stage.appendChild(e); return e; };
  const px = v => v.toFixed(1) + 'px';
  function play(e, frames) {
    if (still) return;
    const a = e.animate(frames, { duration: LOOP * 1000, iterations: Infinity, fill: 'both', delay: -PHASE * 1000 });
    anims.push(a);
  }

  function build() {
    const W = innerWidth, H = innerHeight, tall = W < H;
    /* the floor, seen from above and in front: x across, z away from you, the eye `cam` above it. A point on it lands
       on screen at (cx + f·x/z, hy + f·cam/z), so the rows crowd towards the horizon and everything shrinks with
       distance. Sized so the floor is about a third of the screen wide and deep, its near edge low on the screen */
    const Z0 = 2.2, Rx = tall ? 1.3 : 2.3, Rz = tall ? 1.3 : 1.2, z1 = Z0 - Rz, z2 = Z0 + Rz;
    const f = (tall ? 0.42 * W : Math.min(0.3 * W, 0.5 * H)) * Z0 / Rx, cx = W / 2;
    const cam = Math.max(0.9, Math.min(1.6, (tall ? 0.3 : 0.39) * H / (f * (1 / z1 - 1 / z2)))), hy = (tall ? 0.8 : 0.86) * H - f * cam / z1;
    const at = (x, z) => [cx + f * x / z, hy + f * cam / z, Z0 / z];
    const spot = SPOTS.map(([u, v]) => { const x = u * Rx * 0.62, z = Z0 + v * Rz * 0.62, p = at(x, z); return { x, z, X: p[0], Y: p[1], s: p[2] }; });
    const ball = 0.12 * f / Z0, hop = 0.95 * f / Z0;

    /* a faint pool of light on the floor, so the ball's shadow has something to fall on */
    const pw = 2.4 * Rx * f / Z0, y1 = at(0, z1)[1], y2 = at(0, z2)[1], ph = (y1 - y2) * 1.3;
    el('ld-pool', { width: px(pw), height: px(ph), left: px(cx - pw / 2), top: px((y1 + y2) / 2 - ph / 2) });

    /* the dots, in offset rows; each brightens and swells as a ripple passes */
    const S = 0.2;
    for (let r = 0, z = Z0 - Rz; z <= Z0 + Rz + 1e-6; r++, z += S) {
      for (let x = -Rx - (r % 2 ? S / 2 : 0); x <= Rx + 1e-6; x += S) {
        const q = (x / Rx) ** 2 + ((z - Z0) / Rz) ** 2; if (q > 1) continue;
        const [X, Y, s] = at(x, z), edge = 1 - Math.max(0, (Math.sqrt(q) - 0.55) / 0.45) ** 2, rad = Math.max(0.8, 0.011 * f / z);
        const base = (0.14 + 0.2 * Math.min(1, s - 0.6)) * edge, peak = Math.min(1, 0.55 + 0.45 * edge);
        const d = el('ld-dot', { width: px(rad * 2), height: px(rad * 2), left: px(X - rad), top: px(Y - rad), opacity: base.toFixed(3) });
        const pulses = [];
        seq.forEach((g, i) => {
          const p = spot[g.at], dist = Math.hypot(x - p.x, z - p.z); if (dist >= RIP.reach) return;
          const a = g.hit * (1 - dist / RIP.reach) ** 1.6; if (a < 0.04) return;
          for (const sh of [-LOOP, 0, LOOP]) { const s0 = g.t + sh + dist / RIP.v; if (s0 + RIP.rise + RIP.fall > 0 && s0 < LOOP) pulses.push({ s: s0, a }); }
        });
        if (!pulses.length) continue;
        pulses.sort((a, b) => a.s - b.s);
        play(d, track(pulses).map(k => ({ offset: off(k.t), opacity: (base + (peak - base) * k.v).toFixed(3), transform: `scale(${(1 + 1.4 * k.v).toFixed(3)})`, easing: k.e })));
      }
    }

    /* a coloured ring at each landing, in the colour the ball has just turned, keeping pace with the ripple */
    seq.forEach((g, i) => {
      const p = spot[g.at], w = 2 * RING * f / p.z, h = w * cam / p.z, T = RING / RIP.v, L = g.t;
      const ring = el('ld-ring c' + ORDER[i], { width: px(w), height: px(h), left: px(p.X - w / 2), top: px(p.Y - h / 2) });
      const s0 = 'scale(0.08)', fr = [];
      if (L > 0) fr.push({ offset: 0, opacity: 0, transform: s0 }, { offset: off(L), opacity: 0, transform: s0 });
      fr.push({ offset: off(L), opacity: 0.9, transform: s0 }, { offset: off(L + T * 0.35), opacity: 0.5, transform: 'scale(0.4)' }, { offset: off(L + T), opacity: 0, transform: 'scale(1)' }, { offset: 1, opacity: 0, transform: s0 });
      play(ring, fr);
    });

    /* the ball: where it is on the floor (and how near), how high it is, and how squashed; its shadow stays on the floor */
    const b = el('ld-ball'), sd = document.createElement('i'), hp = document.createElement('i'), sq = document.createElement('i');
    sd.className = 'ld-shadow'; hp.className = 'ld-hop'; sq.className = 'ld-squash';
    const sw = ball * 2.8, shh = sw * cam / Z0;
    Object.assign(sd.style, { width: px(sw), height: px(shh), left: px(-sw / 2), top: px(-shh / 2) });
    Object.assign(sq.style, { width: px(ball * 2), height: px(ball * 2), left: px(-ball), top: px(-ball * 2) });
    b.append(sd, hp); hp.appendChild(sq);
    const halos = [], discs = [];
    for (let c = 0; c < 5; c++) {
      const h = document.createElement('i'); h.className = 'ld-halo c' + c;
      Object.assign(h.style, { width: px(ball * 9), height: px(ball * 9), left: px(-ball * 4.5), top: px(-ball * 5.5) });
      hp.insertBefore(h, sq); halos.push(h);
      const d = document.createElement('i'); d.className = 'ld-disc c' + c; sq.appendChild(d); discs.push(d);
    }
    const tf = p => `translate(${px(p.X)}, ${px(p.Y)}) scale(${p.s.toFixed(4)})`;
    if (still) {
      /* standing still: at rest on the first spot, in moonlight */
      b.style.transform = tf(spot[0]); halos[0].style.opacity = 1; discs[0].style.opacity = 1; sd.style.opacity = 0.85;
      return;
    }
    const pos = [], hgt = [], sqz = [], shd = [];
    const sc = (x, y) => `scale(${x.toFixed(3)}, ${y.toFixed(3)})`;
    seq.forEach((g, i) => {
      const L = g.t, up = L + CONTACT, top = up + air(g.h) / 2, next = i + 1 < seq.length ? seq[i + 1].t : LOOP, e = g.hit, n = Math.sqrt(g.h);
      pos.push({ offset: off(L), transform: tf(spot[g.at]), easing: 'linear' });
      if (g.to !== g.at) pos.push({ offset: off(up), transform: tf(spot[g.at]), easing: 'linear' });
      hgt.push({ offset: off(L), transform: 'translateY(0px)', easing: 'linear' }, { offset: off(up), transform: 'translateY(0px)', easing: UP }, { offset: off(top), transform: `translateY(${px(-g.h * hop)})`, easing: DOWN });
      sqz.push({ offset: off(L), transform: sc(1 + 0.08 * e, 1 - 0.07 * e), easing: 'cubic-bezier(.2, .8, .3, 1)' },
        { offset: off(L + 0.045), transform: sc(1 + 0.3 * e, 1 - 0.28 * e), easing: 'ease-in-out' },
        { offset: off(up), transform: sc(1 - 0.12 * e, 1 + 0.14 * e), easing: 'ease-out' },
        { offset: off(up + 0.24), transform: sc(1, 1), easing: 'linear' },
        { offset: off(next - 0.09), transform: sc(1, 1), easing: 'ease-in' },
        { offset: off(next - 0.006), transform: sc(1 - 0.07 * n, 1 + 0.09 * n), easing: 'linear' });
      shd.push({ offset: off(L), transform: 'scale(1)', opacity: 0.85, easing: 'linear' }, { offset: off(up), transform: 'scale(1)', opacity: 0.85, easing: UP }, { offset: off(top), transform: `scale(${(1 - 0.5 * g.h).toFixed(3)})`, opacity: (0.85 * (1 - 0.7 * g.h)).toFixed(3), easing: DOWN });
    });
    pos.push({ offset: 1, transform: tf(spot[0]) }); hgt.push({ offset: 1, transform: 'translateY(0px)' });
    sqz.push(Object.assign({}, sqz[0], { offset: 1 })); shd.push({ offset: 1, transform: 'scale(1)', opacity: 0.85 });
    play(b, pos); play(hp, hgt); play(sq, sqz); play(sd, shd);

    /* colour: one layer per colour, since colour itself is not composited. The discs change over with the upper one
       fading while the lower one switches under it, so the ball is never see-through; the soft glows just cross-fade */
    const FD = 0.16, FH = 0.3, disc = [0, 1, 2, 3, 4].map(() => []), halo = [0, 1, 2, 3, 4].map(() => []);
    const last = ORDER[ORDER.length - 1];
    for (let c = 0; c < 5; c++) { const v = c === last ? 1 : 0; disc[c].push([0, v]); halo[c].push([0, v]); }
    ORDER.forEach((n, i) => {
      const L = seq[i].t, p = ORDER[(i + ORDER.length - 1) % ORDER.length];
      if (n > p) { disc[n].push([L, 0], [L + FD, 1]); disc[p].push([L + FD, 1], [L + FD, 0]); }
      else { disc[n].push([L, 0], [L, 1]); disc[p].push([L, 1], [L + FD, 0]); }
      halo[n].push([L, 0], [L + FH, 1]); halo[p].push([L, 1], [L + FH, 0]);
    });
    const fade = pts => { const end = pts[pts.length - 1][1]; return pts.concat([[LOOP, end]]).map(([t, v]) => ({ offset: off(t), opacity: v, easing: 'ease-in-out' })); };
    for (let c = 0; c < 5; c++) { play(discs[c], fade(disc[c])); play(halos[c], fade(halo[c])); }
  }

  /* one dot's brightness over the loop (0 at rest, up to 1), from the ripples that reach it: each rises quickly and
     ebbs; one arriving before the last has ebbed carries on from where that one had got to. Worked out across three
     loops' worth of landings, then cut to one, so it runs on round the loop without a seam */
  function track(pulses) {
    const k = [];
    const valueAt = t => { for (let j = k.length - 1; j >= 0; j--) if (k[j].t <= t) { const n = k[j + 1]; return n ? k[j].v + (n.v - k[j].v) * (t - k[j].t) / Math.max(1e-6, n.t - k[j].t) : k[j].v; } return 0; };
    for (const p of pulses) {
      let v0 = 0;
      if (k.length && k[k.length - 1].t > p.s) { v0 = valueAt(p.s); while (k.length && k[k.length - 1].t > p.s) k.pop(); }
      k.push({ t: p.s, v: v0, e: 'cubic-bezier(.3, .7, .4, 1)' }, { t: p.s + RIP.rise, v: Math.max(p.a, v0), e: 'cubic-bezier(.45, 0, .55, 1)' }, { t: p.s + RIP.rise + RIP.fall, v: 0, e: 'linear' });
    }
    const v0 = valueAt(0); let e0 = 'linear';
    for (const q of k) { if (q.t <= 0) e0 = q.e; else break; }
    return [{ t: 0, v: v0, e: e0 }, ...k.filter(q => q.t > 0 && q.t < LOOP), { t: LOOP, v: v0, e: 'linear' }];
  }

  function clear() { anims.forEach(a => a.cancel()); anims = []; stage.textContent = ''; }
  function onResize() { clearTimeout(resizeT); resizeT = setTimeout(() => { if (live) { clear(); build(); } }, 200); }
  /* the cove is up and the loader has faded: let the compositor go */
  function stop() { if (!live) return; live = false; clearTimeout(resizeT); removeEventListener('resize', onResize); clear(); }

  build();
  addEventListener('resize', onResize);
  return { stop };
})();
