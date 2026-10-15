/* ─────────────────────────────────────────────────────────────
   sky.js — real sun & moon → sky colours, lights and where the
   moon and sun are drawn.
   The camp faces east over the sea (the world's −z; north is −x).
   Two ways to draw them (o.path):
   · 'true' — the true compass: each where it really is, by its
     azimuth and altitude for the visitor's place and time; the
     sun comes up out of the sea ahead, crosses high to the south
     (north, south of the equator) and sets behind the camp.
   · 'front' — in front of the camp: the view's sky band is only
     ~9° tall, so each body's arc is compressed to fit: it rises
     at the frame's left, climbs, and sets at its right, always
     where its real path says it is relative to the rest of it.
   The stars and planets are always real (stars.js).
   ───────────────────────────────────────────────────────────── */
const Sky = (() => {
  const D = Math.PI / 180;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  /* by sun altitude (deg): zenith, horizon, twilight glow */
  const KEYS = [
    [-90, [0.0016, 0.0024, 0.0060], [0.0042, 0.0058, 0.0105], [0, 0, 0]],
    [-18, [0.0016, 0.0024, 0.0060], [0.0042, 0.0058, 0.0105], [0, 0, 0]],
    [-12, [0.0036, 0.0055, 0.0145], [0.0110, 0.0115, 0.0230], [0.010, 0.006, 0.008]],
    [-6, [0.0110, 0.0170, 0.0430], [0.055, 0.046, 0.062], [0.11, 0.045, 0.035]],
    [-2, [0.038, 0.058, 0.115], [0.20, 0.135, 0.12], [0.55, 0.22, 0.075]],
    [2, [0.085, 0.135, 0.25], [0.42, 0.30, 0.24], [1.10, 0.50, 0.16]],
    [8, [0.15, 0.25, 0.46], [0.52, 0.49, 0.47], [0.55, 0.32, 0.14]],
    [25, [0.19, 0.35, 0.68], [0.60, 0.64, 0.70], [0.14, 0.11, 0.08]],
    [90, [0.21, 0.39, 0.76], [0.64, 0.70, 0.78], [0.05, 0.05, 0.05]]
  ];
  function keyed(a) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const p = KEYS[i], q = KEYS[i + 1];
      if (a <= q[0]) { const t = (a - p[0]) / (q[0] - p[0]); return [mix(p[1], q[1], t), mix(p[2], q[2], t), mix(p[3], q[3], t)]; }
    }
    const l = KEYS[KEYS.length - 1]; return [l[1], l[2], l[3]];
  }

  /* view-relative placement: each body crosses the frame at an even pace from rise (left)
     through transit (centre) to set (right), by its hour angle; altitude is compressed into
     the ~9° sky band */
  const dirOf = (phi, a) => [Math.sin(phi) * Math.cos(a), Math.sin(a), -Math.cos(phi) * Math.cos(a)];
  let LAT = 17;
  function place(body, isSun) {
    const ct = -Math.tan(LAT * D) * Math.tan(body.dec);
    const H0 = ct <= -1 ? Math.PI : ct >= 1 ? 0.05 : Math.acos(ct);
    let h = (((body.H + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const prog = Math.max(0, Math.min(1, (h + H0) / (2 * H0)));
    const phi = (prog * 2 - 1) * 32 * D;
    const alt = body.alt, sa = Math.sin(alt);
    const e = isSun ? (alt < 0 ? alt * 0.9 : 6.6 * D * Math.pow(sa, 0.8))
                    : (0.75 * D + 5.6 * D * Math.pow(Math.max(sa, 0), 0.85));
    return { phi, e, prog, dir: [Math.sin(phi) * Math.cos(e), Math.sin(e), -Math.cos(phi) * Math.cos(e)] };
  }

  /* ── the tide, from the real moon and sun. Each raises the sea's equilibrium tide (Laplace's form of it): two bulges a
     day that come round as the earth turns under them, and a daily inequality when the body stands north or south of the
     equator; the sun's is 0.46 of the moon's (and the moon's grows as it comes nearer). The sea answers about two hours
     after the body crosses the meridian. Spring tides come when the two pull together, at new and full moon; neaps at the
     quarters. eta is the height, about ±1 at springs; dz is how far up the beach (m) that brings the water's edge:
     shallow sand runs a long way out below the mean, the beach face is steeper above it ── */
  const tideEta = (sun, moon, lat) => {
    const phi = lat * D, c2 = Math.cos(phi) ** 2, s2 = Math.sin(2 * phi), LAG = 0.55;
    const body = (H, dec, k) => { const h = H - LAG; return k * (c2 * Math.cos(dec) ** 2 * Math.cos(2 * h) + s2 * Math.sin(2 * dec) * Math.cos(h)); };
    return (body(moon.H, moon.dec, Math.pow(385001 / moon.dist, 3)) + body(sun.H, sun.dec, 0.46)) / (1.46 * Math.max(0.35, c2));
  };
  const tideDZ = eta => 2.6 * Math.max(-1.1, Math.min(1.0, eta)) - 1.8;
  const etaAt = (ms, loc) => tideEta(Astro.sun(ms, loc.lat, loc.lng), Astro.moon(ms, loc.lat, loc.lng), loc.lat);
  /* (the recent high water and the next turns of the tide, worked out again only every few minutes of sky time) */
  let tideMemo = { k: NaN };
  function tideOf(ms, loc, sun, moon) {
    const eta = tideEta(sun, moon, loc.lat), dz = tideDZ(eta), k = Math.round(ms / 180e3) + loc.lat * 1e6;
    if (k !== tideMemo.k) {
      let hi = -1e9; for (let i = 1; i <= 14; i++) hi = Math.max(hi, tideDZ(etaAt(ms - i * 15 * 60e3, loc)));
      /* the next high and low water: the next turn of the tide either way, in ten-minute steps over the next fourteen hours */
      let next = { high: null, low: null }, prev = etaAt(ms, loc), slope = etaAt(ms + 10 * 60e3, loc) - prev;
      for (let i = 1, e0 = prev; i <= 84 && (!next.high || !next.low); i++) { const e1 = etaAt(ms + (i + 1) * 10 * 60e3, loc), e = etaAt(ms + i * 10 * 60e3, loc);
        if (!next.high && e >= e0 && e >= e1) next.high = ms + i * 10 * 60e3; if (!next.low && e <= e0 && e <= e1) next.low = ms + i * 10 * 60e3; e0 = e; }
      tideMemo = { k, hi, next, slope };
    }
    const rising = tideMemo.slope > 0;
    return { eta, dz, hi: Math.max(tideMemo.hi, dz), rising, next: tideMemo.next, spring: Math.abs(eta) };
  }

  /* a direction's turn round the view (0 ahead, + to the right) and its height; and from those, the direction again */
  const phiOf = v => Math.atan2(v[0], -v[2]), elOf = v => Math.asin(Math.max(-1, Math.min(1, v[1])));
  const turn = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
  /* (between where a body really is and where it is drawn in front of the camp, k of the way: round the horizon the
     shorter way, and up or down as it goes) */
  const between = (a, b, k) => k <= 0 ? a : k >= 1 ? b : dirOf(turn(phiOf(a), phiOf(b), k), elOf(a) + (elOf(b) - elOf(a)) * k);

  function compute(ms, loc, o = {}) {
    LAT = loc.lat;
    /* (how far toward drawing them in front of the camp: 0 the true compass, 1 in front; in between while the visitor
       switches, so they swing across rather than jump) */
    const fk = Math.max(0, Math.min(1, o.front ?? (o.path === 'front' ? 1 : 0))), front = fk > 0.5;
    const sun = Astro.sun(ms, loc.lat, loc.lng), moon = Astro.moon(ms, loc.lat, loc.lng), il = Astro.illumination(ms);
    const sAlt = sun.alt / D, mAlt = moon.alt / D;
    let [zen, hor, glow] = keyed(sAlt);

    const sunUp = sm(-0.02, 0.25, Math.sin(sun.alt));
    const sunCol = mix([1.0, 0.40, 0.14], [1.0, 0.95, 0.88], sm(0.02, 0.45, Math.sin(sun.alt)));
    const sunI = 3.0 * sunUp;
    const phaseF = Math.max(0.14, Math.pow(il.fraction, 1.1));
    const dayWash = 1 - sm(-9, 3, sAlt) * 0.9;
    const moonUp = sm(-0.02, 0.15, Math.sin(moon.alt));
    const moonCol = mix([1.0, 0.72, 0.48], [0.56, 0.68, 1.0], sm(0.04, 0.35, Math.sin(moon.alt)));
    const moonI = 0.024 * phaseF * moonUp * dayWash;
    zen = zen.map((v, i) => v + moonI * [0.07, 0.10, 0.19][i]);
    hor = hor.map((v, i) => v + moonI * [0.13, 0.16, 0.25][i]);

    const pS = place(sun, true), pM = place(moon, false);
    /* each where it really is in the sky, from its hour angle and declination: the world's south (+x) and west (+z)
       components, and up; the moon among the real stars (stars.js) */
    const real = b => { const p = loc.lat * D, cd = Math.cos(b.dec), sd = Math.sin(b.dec), cH = Math.cos(b.H), sH = Math.sin(b.H);
      return [Math.sin(p) * cd * cH - Math.cos(p) * sd, Math.cos(p) * cd * cH + Math.sin(p) * sd, cd * sH]; };
    const moonV = real(moon), sunR = real(sun);
    /* where each is drawn: where it really is, or on its path across the view in front of the camp */
    const sunD = between(sunR, pS.dir, fk), moonD = between(moonV, pM.dir, fk);
    /* the sun as seen from the moon, in the frame its disc is drawn in (x across, y up the disc, z back toward us): which
       part of it is lit, and which way its bright limb faces, as the real sun and moon stand */
    const mz = moonV, mxl = Math.hypot(mz[2], mz[0]) || 1, mx = [-mz[2] / mxl, 0, mz[0] / mxl], my = [mx[1] * mz[2] - mx[2] * mz[1], mx[2] * mz[0] - mx[0] * mz[2], mx[0] * mz[1] - mx[1] * mz[0]];
    const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sunM = [dot3(sunR, mx), dot3(sunR, my), -dot3(sunR, mz)];

    /* the light comes from where the body is drawn (its turn round the view, phi: 0 ahead, + to the right), at its real
       height, never lower than a little over the horizon (a sun at the horizon still throws its long shadows) nor so
       high it casts none */
    const useSun = sAlt > -1.5;
    const keyPhi = useSun ? turn(phiOf(sunR), pS.phi, fk) : turn(phiOf(moonV), pM.phi, fk);
    const keyAlt = useSun ? Math.max(sun.alt, 3 * D) : Math.max(moon.alt, 16 * D);
    const keyCol = (useSun ? sunCol : moonCol).map(v => v * (useSun ? sunI : moonI));
    const keyDir = dirOf(keyPhi, Math.min(keyAlt, 62 * D));
    /* (and for what the land shades from it — the island's hill, its forest — the light's own real height, so the camp
       goes into the hill's shade before the sun is down) */
    const shDir = dirOf(keyPhi, Math.max(useSun ? sun.alt : moon.alt, 0.4 * D));

    const amb = mix(zen, hor, 0.45).map(v => v * 1.45);
    /* (the light thrown back up off the sand: some of the sky's, and of the sun's as high as it is) */
    const groundAmb = amb.map((v, i) => v * 0.35 + keyCol[i] * (0.04 + 0.22 * Math.max(0, Math.sin(keyAlt))));
    const direct = lum(keyCol) * Math.sin(Math.min(keyAlt, 62 * D));
    const shadowK = Math.min(1, direct / (direct + lum(amb) * 1.4 + 1e-6));
    const E = lum(amb) + direct;
    const target = 0.17 + 0.35 * sm(-6, 16, sAlt);
    const exposure = Math.min(16, target / (E + 0.0045));

    const moonDisc = moonCol.map(v => v * (0.06 + 0.2 * Math.pow(phaseF, 0.4)) * moonUp * (1 - sm(-4, 8, sAlt) * 0.7));
    const sunDisc = sunCol.map(v => v * 26 * sm(-2.5, 0.5, sAlt));
    const moonGlit = moonCol.map(v => v * 0.018 * Math.pow(Math.max(il.fraction, 0.08), 0.7) * moonUp * dayWash);
    const sunGlit = sunCol.map(v => v * 1.1 * sm(-1.2, 1.5, sAlt));
    const stars = (1 - sm(-15, -6, sAlt)) * (1 - 0.55 * Math.min(1, moonI / 0.024));
    /* the clouds, a mile or two up, still see the sun a little after it has set for the beach, and catch it fully well
       before it is high: at sunset they glow orange and pink rather than going grey */
    const cloudSun = 3.0 * sm(-0.045, 0.08, Math.sin(sun.alt)), cloudCol = mix([1.0, 0.36, 0.16], sunCol, sm(0.0, 0.3, Math.sin(sun.alt)));
    const cloudLit = cloudCol.map((v, i) => v * cloudSun * 0.2 + moonCol[i] * moonI * 0.6);
    /* the twilight opposite the sun, as it sets and as it rises: the earth's own shadow coming up the sky there, a grey-blue
       band along the horizon as high as the sun has gone down, and over it the pink of the sky still in the sun (the
       Belt of Venus), a few degrees deep; strongest with the sun just under the horizon, gone by the end of civil twilight.
       [how strong, the shadow's top (rad), how deep the pink (rad)] */
    const anti = [sm(4, 0.5, sAlt) * (1 - sm(-4.5, -8, sAlt)), Math.max(0, -sAlt) * 0.95 * D + 0.0025, (6 + 3 * sm(0, -5, sAlt)) * D];

    return {
      sun, moon, illum: il, sAlt, mAlt, zen, hor, glow, haze: hor, path: front ? 'front' : 'true',
      sunDirV: sunD, moonDirV: moonD, sunReal: sunR, moonReal: moonV, sunM, moonDisc, sunDisc, moonGlit, sunGlit, stars, cloudLit, anti, shDir,
      moonPhaseC: 2 * il.fraction - 1, moonPhaseSign: il.phase < 0.5 ? 1 : -1,
      amb, groundAmb, keyDir, keyCol, shadowK, exposure,
      day: sm(0, 15, sAlt), night: 1 - sm(-6, 8, sAlt), lightsAuto: sAlt < -3 ? 1 : 0,
      moonProgress: pM.prog, sunProgress: pS.prog,
      tide: tideOf(ms, loc, sun, moon)
    };
  }
  return { compute, tideEta, tideDZ };
})();
