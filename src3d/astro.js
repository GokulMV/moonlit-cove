/* ─────────────────────────────────────────────────────────────
   astro.js — compact sun & moon ephemeris for the live sky.
   Formulas follow Vladimir Agafonkin's SunCalc (BSD-2-Clause).
   Azimuths returned here are compass bearings: 0 = north, π/2 = east.
   ───────────────────────────────────────────────────────────── */
const Astro = (() => {
  const PI = Math.PI, sin = Math.sin, cos = Math.cos, tan = Math.tan,
        asin = Math.asin, atan2 = Math.atan2, acos = Math.acos, rad = PI / 180;
  const dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, E = rad * 23.4397;

  const toDays = ms => ms / dayMs - 0.5 + J1970 - J2000;
  const rightAsc = (l, b) => atan2(sin(l) * cos(E) - tan(b) * sin(E), cos(l));
  const decl = (l, b) => asin(sin(b) * cos(E) + cos(b) * sin(E) * sin(l));
  const azim = (H, phi, d) => atan2(sin(H), cos(H) * sin(phi) - tan(d) * cos(phi));
  const altit = (H, phi, d) => asin(sin(phi) * sin(d) + cos(phi) * cos(d) * cos(H));
  const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  const refraction = h => {
    if (h < 0) h = 0;
    return 0.0002967 / tan(h + 0.00312536 / (h + 0.08901179));
  };

  function sunCoords(d) {
    const M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
    const L = M + C + rad * 102.9372 + PI;
    return { dec: decl(L, 0), ra: rightAsc(L, 0) };
  }
  function moonCoords(d) {
    const L = rad * (218.316 + 13.176396 * d),
          M = rad * (134.963 + 13.064993 * d),
          F = rad * (93.272 + 13.229350 * d);
    const l = L + rad * 6.289 * sin(M), b = rad * 5.128 * sin(F), dist = 385001 - 20905 * cos(M);
    return { ra: rightAsc(l, b), dec: decl(l, b), dist };
  }

  function sun(ms, lat, lng) {
    const lw = rad * -lng, phi = rad * lat, d = toDays(ms), c = sunCoords(d);
    const H = sidereal(d, lw) - c.ra;
    return { az: (azim(H, phi, c.dec) + PI) % (2 * PI), alt: altit(H, phi, c.dec), H, dec: c.dec };
  }
  function moon(ms, lat, lng) {
    const lw = rad * -lng, phi = rad * lat, d = toDays(ms), c = moonCoords(d);
    const H = sidereal(d, lw) - c.ra;
    let h = altit(H, phi, c.dec);
    h += refraction(h);
    return { az: (azim(H, phi, c.dec) + PI) % (2 * PI), alt: h, dist: c.dist, H, dec: c.dec };
  }
  function illumination(ms) {
    const d = toDays(ms), s = sunCoords(d), m = moonCoords(d), sdist = 149598000;
    const phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
    const inc = atan2(sdist * sin(phi), m.dist - sdist * cos(phi));
    const angle = atan2(cos(s.dec) * sin(s.ra - m.ra),
      sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
    return { fraction: (1 + cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / PI };
  }

  function phaseName(p) {
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
                   'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    return names[Math.floor(((p + 1 / 16) % 1) * 8)];
  }

  /* Next rise / set of a body within a window, by sampling altitude. */
  function nextCrossing(fn, ms, lat, lng, h0, rising, hours = 30) {
    const step = 5 * 60e3;
    let prev = fn(ms, lat, lng).alt - h0;
    for (let t = ms + step; t <= ms + hours * 36e5; t += step) {
      const cur = fn(t, lat, lng).alt - h0;
      if (rising ? (prev < 0 && cur >= 0) : (prev > 0 && cur <= 0)) {
        return t - step * (cur / (cur - prev));
      }
      prev = cur;
    }
    return null;
  }
  const sunRise = (ms, la, lo) => nextCrossing(sun, ms, la, lo, -0.833 * rad, true);
  const sunSet = (ms, la, lo) => nextCrossing(sun, ms, la, lo, -0.833 * rad, false);
  const moonRise = (ms, la, lo) => nextCrossing(moon, ms, la, lo, 0.133 * rad, true);
  const moonSet = (ms, la, lo) => nextCrossing(moon, ms, la, lo, 0.133 * rad, false);

  /* Nearest upcoming full moon (phase = 0.5), refined by bisection. */
  function nextFullMoon(ms) {
    const ph = t => illumination(t).phase;
    let a = ms, pa = ph(a);
    for (let i = 0; i < 31 * 4; i++) {
      const b = a + 6 * 36e5, pb = ph(b);
      if (pa < 0.5 && pb >= 0.5) {
        let lo = a, hi = b;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ph(m) < 0.5) lo = m; else hi = m; }
        return (lo + hi) / 2;
      }
      a = b; pa = pb;
    }
    return ms;
  }

  /* ── time zone → approximate observer location ── */
  const ZONES = {
    'America/New_York': [40.71, -74.01], 'America/Chicago': [41.88, -87.63], 'America/Denver': [39.74, -104.99],
    'America/Phoenix': [33.45, -112.07], 'America/Los_Angeles': [34.05, -118.24], 'America/Anchorage': [61.22, -149.9],
    'Pacific/Honolulu': [21.31, -157.86], 'America/Toronto': [43.65, -79.38], 'America/Vancouver': [49.28, -123.12],
    'America/Mexico_City': [19.43, -99.13], 'America/Bogota': [4.71, -74.07], 'America/Lima': [-12.05, -77.04],
    'America/Santiago': [-33.45, -70.67], 'America/Sao_Paulo': [-23.55, -46.63],
    'America/Argentina/Buenos_Aires': [-34.6, -58.38], 'America/Halifax': [44.65, -63.57], 'America/St_Johns': [47.56, -52.71],
    'Europe/London': [51.51, -0.13], 'Europe/Dublin': [53.35, -6.26], 'Europe/Lisbon': [38.72, -9.14],
    'Europe/Madrid': [40.42, -3.7], 'Europe/Paris': [48.86, 2.35], 'Europe/Brussels': [50.85, 4.35],
    'Europe/Amsterdam': [52.37, 4.9], 'Europe/Berlin': [52.52, 13.4], 'Europe/Zurich': [47.38, 8.54],
    'Europe/Rome': [41.9, 12.5], 'Europe/Vienna': [48.21, 16.37], 'Europe/Prague': [50.08, 14.44],
    'Europe/Warsaw': [52.23, 21.01], 'Europe/Stockholm': [59.33, 18.07], 'Europe/Oslo': [59.91, 10.75],
    'Europe/Copenhagen': [55.68, 12.57], 'Europe/Helsinki': [60.17, 24.94], 'Europe/Athens': [37.98, 23.73],
    'Europe/Istanbul': [41.01, 28.98], 'Europe/Kiev': [50.45, 30.52], 'Europe/Kyiv': [50.45, 30.52],
    'Europe/Moscow': [55.76, 37.62], 'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38],
    'Africa/Nairobi': [-1.29, 36.82], 'Africa/Johannesburg': [-26.2, 28.05], 'Africa/Casablanca': [33.57, -7.59],
    'Asia/Dubai': [25.2, 55.27], 'Asia/Riyadh': [24.71, 46.68], 'Asia/Qatar': [25.29, 51.53], 'Asia/Tehran': [35.69, 51.39],
    'Asia/Karachi': [24.86, 67.0], 'Asia/Kolkata': [17.39, 78.49], 'Asia/Calcutta': [17.39, 78.49],
    'Asia/Colombo': [6.93, 79.86], 'Asia/Kathmandu': [27.72, 85.32], 'Asia/Dhaka': [23.81, 90.41],
    'Asia/Yangon': [16.87, 96.2], 'Asia/Bangkok': [13.76, 100.5], 'Asia/Jakarta': [-6.2, 106.85],
    'Asia/Ho_Chi_Minh': [10.82, 106.63], 'Asia/Kuala_Lumpur': [3.14, 101.69], 'Asia/Singapore': [1.35, 103.82],
    'Asia/Manila': [14.6, 120.98], 'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Shanghai': [31.23, 121.47],
    'Asia/Taipei': [25.03, 121.57], 'Asia/Seoul': [37.57, 126.98], 'Asia/Tokyo': [35.68, 139.69],
    'Australia/Perth': [-31.95, 115.86], 'Australia/Adelaide': [-34.93, 138.6], 'Australia/Brisbane': [-27.47, 153.03],
    'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96], 'Pacific/Auckland': [-36.85, 174.76],
    'UTC': [51.48, 0], 'Etc/UTC': [51.48, 0]
  };
  const REGION_LAT = { America: 35, Europe: 48, Africa: 5, Asia: 25, Australia: -30, Pacific: -15, Atlantic: 30, Indian: -10, Antarctica: -75 };

  function locate(tz) {
    let zone = tz;
    try { zone = zone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { zone = 'UTC'; }
    if (ZONES[zone]) return { tz: zone, lat: ZONES[zone][0], lng: ZONES[zone][1], exact: true };
    const off = -new Date().getTimezoneOffset();             // minutes east of UTC
    const region = zone.split('/')[0];
    return { tz: zone, lat: REGION_LAT[region] ?? 25, lng: Math.max(-179, Math.min(179, off / 4)), exact: false };
  }

  /* ── the planets the eye can see: where they stand among the stars, and how bright. Keplerian elements for approximate
     positions (JPL, E. M. Standish; good to an arcminute or so between 1800 and 2050), as d3-celestial carries them:
     [a (AU), e, I, L, ϖ, Ω (degrees)] at J2000 and their rates per century ── */
  const PLANETS = {
    mercury: { el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], d: [3.7e-7, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081], col: [1.0, 0.9, 0.78] },
    venus: { el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], d: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418], col: [1.0, 0.97, 0.88] },
    mars: { el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], d: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], col: [1.0, 0.62, 0.38] },
    jupiter: { el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], d: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], col: [1.0, 0.95, 0.84] },
    saturn: { el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], d: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], col: [1.0, 0.92, 0.72] }
  };
  const EARTH = { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], d: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] };
  /* where a body is round the sun at T centuries from J2000 (ecliptic, AU) */
  function helio(P, T) {
    const [a, e, I, L, w, N] = P.el.map((v, i) => v + P.d[i] * T), M = ((L - w) % 360) * rad, om = (w - N) * rad, Nr = N * rad, Ir = I * rad;
    let E = M + e * sin(M); for (let k = 0; k < 6; k++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
    const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E), co = cos(om), so = sin(om), cN = cos(Nr), sN = sin(Nr), cI = cos(Ir), sI = sin(Ir);
    return [(co * cN - so * sN * cI) * xp + (-so * cN - co * sN * cI) * yp, (co * sN + so * cN * cI) * xp + (-so * sN + co * cN * cI) * yp, (so * sI) * xp + (co * sI) * yp];
  }
  /* each planet's RA and Dec (J2000, radians) and its magnitude, at ms */
  function planets(ms) {
    const T = toDays(ms) / 36525, Ea = helio(EARTH, T), out = [];
    for (const [name, P] of Object.entries(PLANETS)) {
      const h = helio(P, T), g = [h[0] - Ea[0], h[1] - Ea[1], h[2] - Ea[2]];
      const X = g[0], Y = g[1] * cos(E) - g[2] * sin(E), Z = g[1] * sin(E) + g[2] * cos(E);
      const r = Math.hypot(...h), D = Math.hypot(X, Y, Z), R = Math.hypot(...Ea), i = acos(Math.max(-1, Math.min(1, (r * r + D * D - R * R) / (2 * r * D)))) / rad, L5 = 5 * Math.log10(r * D);
      const mag = name === 'mercury' ? -0.42 + L5 + 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i : name === 'venus' ? -4.4 + L5 + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i
        : name === 'mars' ? -1.52 + L5 + 0.016 * i : name === 'jupiter' ? -9.4 + L5 + 0.005 * i : -8.88 + L5 + 0.044 * i;
      out.push({ name, ra: atan2(Y, X), dec: asin(Z / D), mag, col: P.col, dist: D });
    }
    return out;
  }
  /* local sidereal time (radians) at ms, at longitude lng (degrees east) */
  const lst = (ms, lng) => sidereal(toDays(ms), rad * -lng);
  /* the sun among the stars at ms (RA, Dec, radians) and its ecliptic longitude; a point on the ecliptic's RA and Dec */
  const sunEq = ms => { const d = toDays(ms), M = rad * (357.5291 + 0.98560028 * d), C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), L = M + C + rad * 102.9372 + PI; return { ra: rightAsc(L, 0), dec: decl(L, 0), L }; };
  const eclEq = (l, b) => ({ ra: rightAsc(l, b), dec: decl(l, b) });
  return { sun, moon, illumination, phaseName, sunRise, sunSet, moonRise, moonSet, nextFullMoon, locate, planets, lst, sunEq, eclEq, rad, E };
})();
