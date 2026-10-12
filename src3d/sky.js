/* ─────────────────────────────────────────────────────────────
   sky.js — real sun & moon → sky colours, lights and the
   on-screen positions of the moon and sun.
   The camera faces east over the sea. The sky band in frame is
   only ~9° tall, so each body's arc is compressed to fit: it
   rises at the horizon, climbs, and sets at the frame's edge,
   always where its real azimuth and altitude say it is relative
   to the rest of its path tonight.
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
  const dirOf = (phi, a) => [Math.sin(phi) * Math.cos(a), Math.sin(a), -Math.cos(phi) * Math.cos(a)];

  function compute(ms, loc) {
    LAT = loc.lat;
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

    const useSun = sAlt > -1.5;
    const keyPhi = useSun ? pS.phi : pM.phi;
    const keyAlt = useSun ? Math.max(sun.alt, 3 * D) : Math.max(moon.alt, 16 * D);
    const keyCol = (useSun ? sunCol : moonCol).map(v => v * (useSun ? sunI : moonI));
    const keyDir = dirOf(keyPhi, Math.min(keyAlt, 62 * D));

    const amb = mix(zen, hor, 0.45).map(v => v * 1.45);
    const groundAmb = amb.map((v, i) => v * 0.35 + keyCol[i] * 0.04);
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

    return {
      sun, moon, illum: il, sAlt, mAlt, zen, hor, glow, haze: hor,
      sunDirV: pS.dir, moonDirV: pM.dir, moonDisc, sunDisc, moonGlit, sunGlit, stars, cloudLit,
      moonPhaseC: 2 * il.fraction - 1, moonPhaseSign: il.phase < 0.5 ? 1 : -1,
      amb, groundAmb, keyDir, keyCol, shadowK, exposure,
      day: sm(0, 15, sAlt), night: 1 - sm(-6, 8, sAlt), lightsAuto: sAlt < -3 ? 1 : 0,
      moonProgress: pM.prog, sunProgress: pS.prog
    };
  }
  return { compute };
})();
