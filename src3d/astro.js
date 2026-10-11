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

  return { sun, moon, illumination, phaseName, sunRise, sunSet, moonRise, moonSet, nextFullMoon, locate, rad };
})();
