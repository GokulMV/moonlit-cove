/* ─────────────────────────────────────────────────────────────
   skyfall.js — what else crosses the night sky: the shooting
   stars, and a comet.

   A shooting star is a grain of dust shed by a comet (or an
   asteroid) running into the air at tens of kilometres a second,
   a hundred kilometres up, and burning away. Each one here is
   worked out as one. It comes from its radiant: on the nights a
   shower is on, the shower's, among the stars where it really is
   that night (the Orionids out of Orion in October, the Perseids
   in August, the Geminids in December...); the strays from where
   strays come from, the way the Earth is heading (up after
   midnight, which is why the mornings have more) and the side
   away from the sun. It is followed down through the air, which
   thickens about threefold every seven kilometres: it brightens
   as it bites deeper and goes out as the grain is used up (the
   single-body ablation of meteor physics), so it starts faint,
   peaks late and ends quickly. And it is seen from the beach:
   near its radiant a shooting star is short and slow, a quarter
   of the sky from it long and fast, low down further off and so
   slower and dimmer, and when the radiant is just over the
   horizon it can skim along the top of the air for seconds on
   end, an earthgrazer, drifting across half the sky. So each takes
   as long as a real one does — most a fraction of a second, the
   slow ones a second or two, the grazers several — in real time,
   whatever the sky's own clock is doing. It is a moving point
   with a short glowing wake, not a streak flung across the sky;
   the bright ones leave a train that glows on for a moment, the
   fireballs one that lingers, spreads and drifts in the high
   wind, and they flare where they break up. Their colours are
   what burns: the fast ones bluish white with green in their
   trains, the slow ones yellow-orange.

   How often: a real dark sky shows a stray every five or ten
   minutes, a good shower one every half minute or so. Nobody
   waits that long on a web page, so this sky is always as busy as
   a shower night (more, on the nights a strong one really
   peaks), and more of them come where you are looking.

   The comet stands among the stars and turns with them through
   the night: its coma round the bright point of its false
   nucleus, its dust tail curving away from the sun and its
   fainter, straight blue ion tail pointing straight away from it,
   each as long as it looks from the Earth (a tail pointing partly
   away from us looks shorter). It is put where the beach can see
   it this night, out over the sea, a third of the way to the sun.
   ───────────────────────────────────────────────────────────── */
const Skyfall = (() => {
  const T = THREE, PI = Math.PI, TAU = PI * 2, rad = PI / 180, RE = 6371, HS = 7.2;
  const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const eqv = (ra, dec, out = V3()) => out.set(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
  /* the turn of the sky at ms for a place: equatorial directions → the world's (−x north, −z east, y up), as stars.js's */
  function eqMat(ms, loc, out) {
    const L = Astro.lst(ms, loc.lng), p = loc.lat * rad, cL = Math.cos(L), sL = Math.sin(L), cp = Math.cos(p), sp = Math.sin(p);
    return out.set(sp * cL, sp * sL, -cp, cp * cL, cp * sL, sp, sL, -cL, 0);
  }
  /* a direction scattered about d, evenly over a cap a across (radians) */
  function scatter(d, a, out = V3()) {
    const ct = 1 - Math.random() * (1 - Math.cos(a)), st = Math.sqrt(Math.max(0, 1 - ct * ct)), ph = Math.random() * TAU;
    const t1 = (Math.abs(d.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0)).cross(d).normalize(), t2 = d.clone().cross(t1);
    return out.copy(d).multiplyScalar(ct).addScaledVector(t1, st * Math.cos(ph)).addScaledVector(t2, st * Math.sin(ph)).normalize();
  }

  /* ── the year's showers: one of them (its name), its peak (month, day), its rate then (an hour, the radiant overhead, a
     dark sky: its ZHR), its radiant (RA, Dec, °), how fast its grains come in (km/s), and how many days either side of the
     peak it keeps about 60% of that (IMO's working list, rounded) ── */
  const SHOWERS = [
    ['Quadrantid', 1, 3.9, 110, 230, 49, 41, 0.6], ['Lyrid', 4, 22.6, 18, 271, 34, 49, 1.2], ['eta Aquariid', 5, 6, 50, 338, -1, 66, 4.5],
    ['delta Aquariid', 7, 30, 25, 340, -16, 41, 6], ['alpha Capricornid', 7, 30, 5, 307, -10, 23, 7], ['Perseid', 8, 12.6, 100, 48, 58, 59, 2.6],
    ['Draconid', 10, 8.6, 10, 262, 54, 20, 0.4], ['Taurid', 10, 10, 5, 32, 9, 27, 12], ['Orionid', 10, 21.6, 20, 95, 16, 66, 3.6],
    ['Taurid', 11, 12, 5, 58, 22, 29, 12], ['Leonid', 11, 17.6, 15, 152, 22, 71, 1.1], ['Geminid', 12, 14.4, 150, 112, 33, 35, 1.3], ['Ursid', 12, 22.5, 10, 217, 76, 33, 0.8]
  ].map(([name, mo, day, zhr, ra, dec, v, w]) => ({ name, mo, day, zhr, ra: ra * rad, dec: dec * rad, v, w }));
  function showers(ms, eq) {
    const y = new Date(ms).getUTCFullYear(), y0 = Date.UTC(y, 0, 1), doy = (ms - y0) / 864e5, out = [];
    for (const S of SHOWERS) {
      let dd = doy - (Date.UTC(y, S.mo - 1, 1) - y0) / 864e5 - (S.day - 1); dd -= 365.25 * Math.round(dd / 365.25);
      const a = S.zhr * Math.exp(-0.5 * (dd / S.w) ** 2); if (a < 0.3) continue;
      out.push({ name: S.name, R: eqv(S.ra, S.dec).applyMatrix3(eq), v: S.v, zhr: a });
    }
    return out;
  }
  /* the strays' sources: the apex (the way the Earth is going, 90° west of the sun along the ecliptic), and the
     helion and antihelion sources 70° either side of it, toward the sun and away from it */
  function strays(ms, eq) {
    const s = Astro.sunEq(ms), at = l => { const e = Astro.eclEq(l, 0); return eqv(e.ra, e.dec).applyMatrix3(eq); };
    return { apex: at(s.L - PI / 2), helion: at(s.L - PI / 2 + 70 * rad), anti: at(s.L - PI / 2 - 70 * rad) };
  }
  /* where the next one comes from: a shower in proportion to how many it is sending just now (its rate by how high its
     radiant stands), the strays in proportion to theirs. An earthgrazer wants a radiant just about on the horizon */
  function source(ms, eq, grazer) {
    const sh = showers(ms, eq), st = strays(ms, eq), opts = [];
    const ok = R => grazer ? R.y > -0.05 && R.y < 0.11 : R.y > 0.06;
    for (const s of sh) opts.push({ w: s.zhr * (grazer ? 0.4 : Math.max(0, s.R.y)), make: () => ({ name: s.name, R: scatter(s.R, 1.6 * rad), v: s.v * (0.97 + 0.06 * Math.random()) }) });
    opts.push({ w: 4.5 * (0.35 + 0.65 * Math.max(0, st.apex.y)), make: () => ({ name: null, R: scatter(st.apex, 34 * rad), v: 50 + 18 * Math.random() }) });
    opts.push({ w: 3, make: () => ({ name: null, R: scatter(st.anti, 24 * rad), v: 24 + 12 * Math.random() }) });
    opts.push({ w: 2.5, make: () => ({ name: null, R: scatter(st.helion, 24 * rad), v: 24 + 12 * Math.random() }) });
    /* (anything at all, now and then: the sky's sporadic background is everywhere) */
    opts.push({ w: 1.5, make: () => ({ name: null, R: scatter(V3(0, 1, 0), 95 * rad), v: 20 + 50 * Math.random() }) });
    const tot = opts.reduce((a, o) => a + o.w, 0);
    for (let k = 0; k < 60; k++) {
      let r = Math.random() * tot, o = opts[0]; for (const x of opts) { r -= x.w; if (r <= 0) { o = x; break; } }
      const s = o.make(); if (ok(s.R)) return s;
    }
    return null;
  }
  /* how many an hour a watcher would see just now with this sky (the real rate: each shower's by the height of its
     radiant, the strays' more as the apex climbs) */
  function rate(ms, eq) {
    const sh = showers(ms, eq), st = strays(ms, eq);
    return sh.reduce((a, s) => a + s.zhr * Math.max(0, s.R.y), 0) + 6 + 8 * Math.max(0, st.apex.y);
  }

  /* ── one shooting star: from a line of sight (where on the sky it is seen, about the middle of its run) and a radiant,
     its grain is flown through the air and its light worked out at every 1/200 s; then what can be seen of it is kept ── */
  const hAt = X => Math.hypot(X.x, X.y + RE, X.z) - RE;
  function fly(u, src, o) {
    const v = src.v, R = src.R, V = R.clone().multiplyScalar(-v), fast = sm(28, 62, v);
    const fire = o.M < -2.5, grazer = o.grazer;
    /* how high it is seen there: the fast ones burn higher; a fireball's grain gets deeper */
    const href = grazer ? 95 + 9 * Math.random() : (fire ? 64 + 0.3 * v : 72 + 0.45 * v) + (Math.random() - 0.5) * 7;
    const lam = -RE * u.y + Math.sqrt(RE * RE * u.y * u.y + 2 * RE * href + href * href), P = u.clone().multiplyScalar(lam);
    /* (its grain has to be coming down into the air there, or skimming the top of it) */
    const up = V3(P.x, P.y + RE, P.z).normalize(), dn = R.dot(up);
    if (grazer ? dn < -0.07 || dn > 0.12 : dn < 0.04) return null;
    const X = V3(), step = 1 / 200;
    let t0 = 0; for (; t0 > -40; t0 -= 0.02) { X.copy(P).addScaledVector(V, t0); if (hAt(X) > 132) break; }
    /* the air it runs through on its way to P (the column of it, ∫ρ dt); the grain is spent at a little more than that */
    let sP = 0; for (let t = t0; t < 0; t += step) { X.copy(P).addScaledVector(V, t); sP += Math.exp(-(hAt(X) - 90) / HS) * step; }
    if (!(sP > 0)) return null;
    const sEnd = sP * (grazer ? 1.6 + 2 * Math.random() : fire ? 1.4 + 0.8 * Math.random() : 1.08 + 0.9 * Math.random());
    const ts = [], ds = [], Fs = []; let s = 0, peak = 0;
    for (let t = t0; t < t0 + 45; t += step) {
      X.copy(P).addScaledVector(V, t); const h = hAt(X);
      if (h < 12 || (t > 0 && h > 133)) break;
      const rho = Math.exp(-(h - 90) / HS); s += rho * step;
      const mu = 1 - s / sEnd; if (mu <= 0) break;
      /* its light: the air it meets times what is left of the grain's face (m^⅔), over its distance squared, dimmed by the
         air between (as the stars are, low down) */
      const D = X.length(), d = X.clone().divideScalar(D), am = 1 / (Math.max(d.y, 0) + 0.035), I = d.y < -0.02 ? 0 : rho * mu * mu / (D * D) * Math.exp(-0.19 * (am - 1));
      ts.push(t); ds.push(d); Fs.push(I); if (I > peak) peak = I;
    }
    if (!(peak > 0) || ts.length < 3) return null;
    /* as bright as it is meant to be at its brightest (in the stars' units: a first-magnitude star is 1) */
    const Ft = Math.pow(10, -0.4 * (o.M - 1)), k = Ft / peak, th = Math.max(Math.pow(10, -0.4 * 5.8), Ft * 0.004);
    let i0 = -1, i1 = -1; for (let i = 0; i < Fs.length; i++) { Fs[i] *= k; if (Fs[i] > th) { if (i0 < 0) i0 = i; i1 = i; } }
    if (i0 < 0 || i1 - i0 < 2) return null;
    const ta = ts[i0], tb = ts[i1], dur = tb - ta;
    /* where it breaks up, it flares: the bright ones once or twice in the second half of their run, a fireball at its end */
    const fl = [];
    if (o.M < 1 && Math.random() < 0.55) for (let n = 1 + Math.floor(Math.random() * 2.4); n > 0; n--) fl.push([ta + dur * (0.45 + 0.5 * Math.random()), 0.5 + 1.6 * Math.random(), 0.018 + 0.03 * Math.random()]);
    if (fire) fl.push([tb - dur * 0.06, 2 + 2.5 * Math.random(), 0.04 + 0.04 * Math.random()]);
    if (fl.length) for (let i = i0; i <= i1; i++) { let f = 1; for (const [tf, a, w] of fl) f += a * Math.exp(-(((ts[i] - tf) / w) ** 2)); Fs[i] *= f; }
    /* kept at a steady rate along what can be seen of it */
    const n = Math.max(6, Math.min(420, Math.ceil(dur * 150) + 1)), tq = new Float32Array(n), dq = new Float32Array(n * 3), fq = new Float32Array(n), dd = V3();
    for (let j = 0; j < n; j++) {
      const t = ta + dur * j / (n - 1), x = Math.min(i1 - 1e-6, Math.max(i0, i0 + (t - ta) / step)), i = Math.floor(x), f = x - i, i2 = Math.min(i + 1, i1);
      dd.copy(ds[i]).lerp(ds[i2], f).normalize(); tq[j] = t - ta; dq.set([dd.x, dd.y, dd.z], j * 3); fq[j] = Fs[i] + (Fs[i2] - Fs[i]) * f;
    }
    /* how fast it crosses the sky at its brightest (rad/s), for its wake's brightness */
    let jp = 0; for (let j = 1; j < n; j++) if (fq[j] > fq[jp]) jp = j;
    const ja = Math.max(0, jp - 1), jb = Math.min(n - 1, jp + 1), A = V3(dq[ja * 3], dq[ja * 3 + 1], dq[ja * 3 + 2]), B = V3(dq[jb * 3], dq[jb * 3 + 1], dq[jb * 3 + 2]);
    const om = A.angleTo(B) / Math.max(1e-4, tq[jb] - tq[ja]);
    /* its colours: what burns in it, by how hard it hits the air (sodium's yellow in the slow ones; magnesium, iron and
       the air's own oxygen, bluish white and green, in the fast); now and then a green fireball */
    let col = mix([1.0, 0.82, 0.56], [0.8, 0.92, 1.0], fast), tc = mix([1.0, 0.6, 0.36], [0.46, 1.0, 0.58], fast);
    if (o.M < -1 && Math.random() < 0.3) col = [0.7, 1.0, 0.76];
    /* its train: none for the faint ones; the bright ones' glows on for a moment; a fast fireball's lingers for many
       seconds, spreading, and drifts with the wind up there */
    const tb0 = sm(1.8, -1.2, o.M);
    const tr = { k: 0.07 * tb0 * (0.4 + 0.6 * fast), t: 0.35 + 0.9 * tb0, k2: fire && v > 40 ? 0.03 : 0, t2: 7 + 10 * Math.random(), drift: (Math.random() - 0.5) * 1.2 };
    /* (its wake: the glow of the air just behind the head and the eye's own persistence, which is what makes a moving point
       a short streak of light: a tenth of a second or so) */
    const tauW = 0.1 - 0.03 * fast;
    return { n, tq, dq, fq, dur, life: dur + Math.max(tr.t * 6, tr.k2 > 0 ? tr.t2 * 3.5 : 0) + 0.3, om, col, tc, tr, tauW, M: o.M, v, name: src.name, grazer, fire, mid: V3(dq[jp * 3], dq[jp * 3 + 1], dq[jp * 3 + 2]) };
  }

  /* ── drawing them: each a ribbon along its run, its own width in pixels either side of the line on the screen; what the
     ribbon shows at a point depends on how long ago the head passed it (the wake, then the train). The head itself is a
     point of light like a star's, wherever it has got to ── */
  const RIB_VS = `
uniform float uNow, uW, uDrift; uniform vec2 uRes;
attribute vec3 aNext; attribute vec2 aTF; attribute float aSide;
varying float vAge, vF, vX, vAlt, vOK;
void main(){
  vec4 a = projectionMatrix*viewMatrix*vec4(cameraPosition + position*1000.0, 1.0), b = projectionMatrix*viewMatrix*vec4(cameraPosition + aNext*1000.0, 1.0);
  vOK = a.w > 0.01 && b.w > 0.01 ? 1.0 : 0.0;
  vec2 sa = a.xy/max(a.w, 0.01)*uRes*0.5, sb = b.xy/max(b.w, 0.01)*uRes*0.5, t = sb - sa; float l = length(t); t = l > 1e-4 ? t/l : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float age = uNow - aTF.x;
  /* (an old train drifts and twists in the wind up there, the older parts of it furthest) */
  a.xy += (n*(aSide*uW + uDrift*max(age, 0.0)))/(uRes*0.5)*a.w;
  a.z = a.w*0.99998;
  gl_Position = a;
  vAge = age; vF = aTF.y; vX = aSide*uW; vAlt = position.y;
}`;
  const RIB_FS = `
uniform sampler2D uCB; uniform float uCBOn, uCov, uK, uPx;
uniform float uWk, uTauW, uTrK, uTrT, uTrK2, uTrT2;
uniform vec3 uCol, uTrC;
varying float vAge, vF, vX, vAlt, vOK;
void main(){
  if (vAge < 0.0 || vOK < 0.999) discard;
  /* the wake right behind the head: the air it has just lit, going out within a few hundredths of a second */
  float sw = 0.8*uPx, wake = exp(-vAge/uTauW)*exp(-vX*vX/(sw*sw));
  /* the train: it lights up as the head passes, then glows on and spreads as it fades */
  float st = uPx*(1.1 + 0.5*vAge), st2 = uPx*(1.6 + 0.9*vAge);
  float tr = smoothstep(0.0, 0.08, vAge)*(uTrK*exp(-vAge/uTrT)*exp(-vX*vX/(st*st))*sw/st + uTrK2*exp(-vAge/uTrT2)*exp(-vX*vX/(st2*st2))*sw/st2);
  vec3 c = (uCol*wake + uTrC*tr)*vF*uWk;
  float Tr = 1.0 - uCov; if (uCBOn > 0.5) Tr = clamp(texelFetch(uCB, ivec2(gl_FragCoord.xy), 0).a, 0.0, 1.0);
  c *= uK*Tr*mix(vec3(1.0), vec3(1.0, 0.78, 0.55), smoothstep(0.3, 0.02, vAlt));
  if (max(c.r, max(c.g, c.b)) < 2e-5) discard;
  gl_FragColor = vec4(c, 1.0);
}`;
  const HEAD_VS = `
uniform float uK, uPx;
attribute float aF; attribute vec3 aCol;
varying vec3 vC; varying float vA;
void main(){
  vec3 d = normalize(position);
  float mag = 1.0 - 2.5*log(max(aF, 1e-6))/log(10.0);
  float sz = uPx*(1.6 + 1.1*clamp(2.0 - mag, 0.0, 6.0) + 0.6*sqrt(max(aF, 0.0)));
  vA = uK*aF*2.2/(sz*sz);
  vC = mix(aCol, aCol*vec3(1.0, 0.78, 0.55), smoothstep(0.3, 0.02, d.y));
  vec4 p = projectionMatrix*viewMatrix*vec4(cameraPosition + d*1000.0, 1.0);
  p.z = p.w*0.99998;
  gl_Position = aF > 1e-5 && d.y > -0.03 ? p : vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = sz;
}`;
  const HEAD_FS = `
uniform sampler2D uCB; uniform float uCBOn, uCov;
varying vec3 vC; varying float vA;
void main(){
  vec2 q = gl_PointCoord - 0.5; float g = exp(-dot(q, q)*18.0);
  if (g < 0.012) discard;
  float Tr = 1.0 - uCov; if (uCBOn > 0.5) Tr = clamp(texelFetch(uCB, ivec2(gl_FragCoord.xy), 0).a, 0.0, 1.0);
  gl_FragColor = vec4(vC*vA*g*Tr, 1.0);
}`;

  /* ── the comet: drawn on a flat sheet laid against the sky at its head (the plane that touches the sky's sphere there),
     every pixel worked out from where on that sheet it falls — along each tail, how far from its line — so a tail seen
     end-on bunches up instead of folding over itself. The sheet lies among the stars (equatorial) and turns with them
     (stars.js uEq) ── */
  const COM_VS = `
uniform mat3 uEq;
attribute vec2 aXY;
varying vec2 vXY; varying float vAlt;
void main(){
  vec3 d = uEq*position;
  vXY = aXY; vAlt = normalize(d).y;
  vec4 p = projectionMatrix*viewMatrix*vec4(cameraPosition + d*1000.0, 1.0);
  p.z = p.w*0.99998;
  gl_Position = p;
}`;
  const COM_FS = `
uniform sampler2D uCB; uniform float uCBOn, uCov, uK;
uniform vec4 uDust, uDust2, uIon, uComa;
varying vec2 vXY; varying float vAlt;
float ch(float n){ return fract(sin(n*12.9898)*43758.5453); }
void main(){
  if (vAlt < -0.02) discard;
  float x = vXY.x, y = vXY.y;
  /* the dust tail: sunlight off the dust, yellowish white; brightest by the head, broadening and fading along its
     curve, the side it is curving toward sharper than the other (uDust: the curve y = ax + bx², its length, its width at
     the head; uDust2: its width at the end, how bright, which side is the sharp one) */
  float sd = x/uDust.z, yc = uDust.x*x + uDust.y*x*x, wd = mix(uDust.w, uDust2.x, clamp(sd, 0.0, 1.0)), vd = (y - yc)/wd;
  float sideK = vd*uDust2.z > 0.0 ? 2.2 : 0.75;
  float dust = sd > 0.0 && sd < 1.0 ? pow(1.0 - sd, 1.3)*(0.3 + 0.7*exp(-sd*4.0))*exp(-vd*vd*sideK)*smoothstep(0.0, 0.03, sd) : 0.0;
  /* the ion tail: the gas the sunlight has ionised, glowing blue (CO+), blown straight back from the sun; thin
     streamers running out from the head (uIon: its length, its width at the head and at the end, how bright) */
  float si = x/uIon.x, wi = mix(uIon.y, uIon.z, sqrt(clamp(si, 0.0, 1.0))), vi = y/wi, rays = 0.0;
  /* (its streamers: thin rays fanning back from the head, a little kinked along their length) */
  for (int k = 0; k < 7; k++){ float fk = float(k), r0 = (ch(fk + 1.3) - 0.5)*2.0 + 0.12*sin(si*(9.0 + 5.0*ch(fk + 3.1)) + fk), a = 0.25 + 0.55*ch(fk + 7.7); rays += a*exp(-pow((vi - r0)/(0.07 + 0.05*ch(fk + 5.5)), 2.0)); }
  float ion = si > 0.0 && si < 1.0 ? pow(1.0 - si, 1.2)*exp(-si*1.6)*(0.55*exp(-vi*vi*1.6) + rays*0.8*smoothstep(0.02, 0.25, si))*smoothstep(0.0, 0.05, si) : 0.0;
  /* the coma: the cloud of gas and dust round the nucleus, its middle a bright near-star (the false nucleus), the rest
     a soft glow, greenish (C₂) toward its edge (uComa: its size, how bright) */
  float r2 = dot(vXY, vXY)/(uComa.x*uComa.x);
  vec3 coma = mix(vec3(0.74, 1.0, 0.8), vec3(1.0, 0.98, 0.92), exp(-r2*30.0))*(0.1*exp(-r2*110.0) + 0.04*exp(-r2*14.0) + 0.012*exp(-r2*3.2))*uComa.y;
  vec3 c = vec3(1.0, 0.93, 0.78)*dust*uDust2.y + vec3(0.42, 0.62, 1.0)*ion*uIon.w + coma;
  float Tr = 1.0 - uCov; if (uCBOn > 0.5) Tr = clamp(texelFetch(uCB, ivec2(gl_FragCoord.xy), 0).a, 0.0, 1.0);
  float am = 1.0/(max(vAlt, 0.0) + 0.035), ext = exp(-0.19*(am - 1.0));
  c *= ext*mix(vec3(1.0), vec3(1.0, 0.78, 0.55), smoothstep(0.3, 0.02, vAlt))*uK*Tr;
  if (max(c.r, max(c.g, c.b)) < 1e-5) discard;
  gl_FragColor = vec4(c, 1.0);
}`;
  /* the comet's geometry (in AU, the Earth at the middle, equatorial): where it is (u, Δ from us), where the sun is (s);
     its tails' lines, as directions on the sky. Its dust tail curves back from the way it is going */
  const LD = 0.2, LI = 0.3;
  function cometParts(u, Dl, s) {
    const C = u.clone().multiplyScalar(Dl), rc = C.clone().sub(s), a = rc.clone().normalize();
    const nE = V3(0, -Math.sin(Astro.E), Math.cos(Astro.E)), vel = a.clone().cross(nE).normalize();
    const at = (L, curve, f) => { const l = L * f; return C.clone().addScaledVector(a, l).addScaledVector(vel, -curve * l * l / L); };
    return { dust: [0.5, 1].map(f => at(LD, 0.13, f)), ion: at(LI, 0, 1), C, r: rc.length(), a };
  }
  /* how long its ion tail looks (radians) with the comet at u, Δ, the sun at s */
  function tailLook(u, Dl, s) { const p = cometParts(u, Dl, s); return { len: u.angleTo(p.ion.clone().normalize()), r: p.r }; }

  function build(scene, shared) {
    const grp = new T.Group(); grp.name = 'skyfall'; scene.add(grp);
    const Uc = { uCB: shared.uCB, uCBOn: shared.uCBOn, uCov: { value: 0 }, uK: { value: 0 }, uPx: { value: 1 }, uRes: { value: new T.Vector2(1280, 720) } };
    const ribMat = new T.ShaderMaterial({ uniforms: Object.assign({}, Uc, { uNow: { value: 0 }, uW: { value: 6 }, uDrift: { value: 0 }, uWk: { value: 0.01 }, uTauW: { value: 0.05 }, uTrK: { value: 0 }, uTrT: { value: 1 }, uTrK2: { value: 0 }, uTrT2: { value: 1 }, uCol: { value: new T.Vector3(1, 1, 1) }, uTrC: { value: new T.Vector3(0.5, 1, 0.6) } }),
      vertexShader: RIB_VS, fragmentShader: RIB_FS, side: T.DoubleSide, transparent: false, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor });
    /* the heads: one point each */
    const MAXH = 8, hg = new T.BufferGeometry(), hp = new Float32Array(MAXH * 3), hf = new Float32Array(MAXH), hc = new Float32Array(MAXH * 3);
    hg.setAttribute('position', new T.BufferAttribute(hp, 3)); hg.setAttribute('aF', new T.BufferAttribute(hf, 1)); hg.setAttribute('aCol', new T.BufferAttribute(hc, 3)); hg.boundingSphere = new T.Sphere(V3(), 1e9);
    const headMat = new T.ShaderMaterial({ uniforms: { uCB: shared.uCB, uCBOn: shared.uCBOn, uCov: Uc.uCov, uK: Uc.uK, uPx: Uc.uPx }, vertexShader: HEAD_VS, fragmentShader: HEAD_FS, transparent: false, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor });
    const heads = new T.Points(hg, headMat); heads.frustumCulled = false; heads.renderOrder = 1002; grp.add(heads);

    const live = [], events = [];
    let nextT = 2 + 6 * Math.random(), clock = 0;
    const eqNow = new T.Matrix3(), eqTNow = new T.Matrix3();
    function ribbon(m) {
      const n = m.n, P = new Float32Array(n * 6), N = new Float32Array(n * 6), TF = new Float32Array(n * 4), S = new Float32Array(n * 2), idx = [];
      for (let j = 0; j < n; j++) {
        const k = Math.min(j + 1, n - 1), back = j === n - 1;
        for (let sd = 0; sd < 2; sd++) {
          const q = j * 2 + sd;
          P.set([m.dq[j * 3], m.dq[j * 3 + 1], m.dq[j * 3 + 2]], q * 3);
          /* (the last one looks on along the way it was going) */
          if (back) N.set([2 * m.dq[j * 3] - m.dq[(j - 1) * 3], 2 * m.dq[j * 3 + 1] - m.dq[(j - 1) * 3 + 1], 2 * m.dq[j * 3 + 2] - m.dq[(j - 1) * 3 + 2]], q * 3);
          else N.set([m.dq[k * 3], m.dq[k * 3 + 1], m.dq[k * 3 + 2]], q * 3);
          TF.set([m.tq[j], m.fq[j]], q * 2); S[q] = sd ? 1 : -1;
        }
        if (j < n - 1) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('aNext', new T.BufferAttribute(N, 3)); g.setAttribute('aTF', new T.BufferAttribute(TF, 2)); g.setAttribute('aSide', new T.BufferAttribute(S, 1));
      g.setIndex(idx); g.boundingSphere = new T.Sphere(V3(), 1e9);
      const mat = ribMat.clone();
      Object.assign(mat.uniforms, { uCB: shared.uCB, uCBOn: shared.uCBOn, uCov: Uc.uCov, uK: Uc.uK, uPx: Uc.uPx, uRes: Uc.uRes });
      const u = mat.uniforms; u.uCol.value.set(...m.col); u.uTrC.value.set(...m.tc); u.uTauW.value = m.tauW; u.uTrK.value = m.tr.k; u.uTrT.value = m.tr.t; u.uTrK2.value = m.tr.k2; u.uTrT2.value = m.tr.t2;
      const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1001; grp.add(mesh);
      return mesh;
    }
    /* a new one: its source, where it is seen (more often where the camera looks), its brightness (most faint, a few
       bright, now and then a fireball), flown; tried again a few times if the sky will not have it there */
    function spawn(o, opt = {}) {
      const fire = opt.M !== undefined ? opt.M < -2.5 : Math.random() < 0.04;
      const M = opt.M ?? (fire ? -3 - 3 * Math.random() : -1.5 + Math.log(1 + Math.random() * (Math.pow(1.6, 6) - 1)) / Math.log(1.6));
      const grazer = opt.grazer ?? Math.random() < 0.12;
      for (let k = 0; k < 30; k++) {
        const src = opt.src || source(o.ms, o.eq, grazer); if (!src) continue;
        let u = opt.u ? opt.u.clone() : null;
        if (!u && o.camera && Math.random() < (opt.inView ?? 0.8)) { u = V3(Math.random() * 1.7 - 0.85, Math.random() * 1.7 - 0.85, 0.5).unproject(o.camera).sub(o.camera.position).normalize(); }
        if (!u) { const al = Math.asin(0.05 + 0.85 * Math.random()), az = Math.random() * TAU; u = V3(-Math.cos(al) * Math.cos(az), Math.sin(al), -Math.cos(al) * Math.sin(az)); }
        if (u.y < (grazer ? 0.06 : 0.035) || (grazer && u.y > 0.55) || u.angleTo(src.R) < (grazer ? 45 : 7) * rad) continue;
        const m = fly(u, src, { M, grazer });
        if (!m) continue;
        /* (its wake, for how fast it crosses the screen: as much light all told as the head's, twice over, so on a screen,
           which cannot be as bright as the real thing, the streak shows the way the eye sees one) */
        const pxr = o.pxr || 900, wl = Math.max(1.5, m.om * pxr * m.tauW);
        m.wk = 2 * 0.384 / (0.8 * Math.max(1, Uc.uPx.value) * 1.772 * wl);
        m.t = 0; m.seen = false; m.mesh = ribbon(m); m.mesh.material.uniforms.uWk.value = m.wk;
        m.mesh.material.uniforms.uW.value = Uc.uPx.value * (m.tr.k2 > 0 ? 30 : m.tr.k > 0 ? 9 : 4);
        m.mesh.material.uniforms.uDrift.value = m.tr.k2 > 0 ? m.tr.drift * Uc.uPx.value : 0;
        live.push(m);
        return m;
      }
      return null;
    }
    const pv = V3(), pq = V3(), qi = new T.Quaternion();
    /* (whether a direction is in the picture: turned into the camera's own frame) */
    function inView(cam, d) {
      qi.copy(cam.quaternion).invert(); pq.copy(d).applyQuaternion(qi);
      if (pq.z > -0.05) return false;
      const ty = Math.tan(cam.fov * rad / 2) / (cam.zoom || 1), x = pq.x / -pq.z / (ty * cam.aspect), y = pq.y / -pq.z / ty;
      return Math.abs(x) < 0.95 && Math.abs(y) < 0.95;
    }

    /* ── the comet ── */
    const com = { on: false, ref: 0, tried: -1e18, mesh: null, u: null, told: false,
      U: { uEq: { value: new T.Matrix3() }, uCB: shared.uCB, uCBOn: shared.uCBOn, uCov: Uc.uCov, uK: { value: 0 }, uDust: { value: new T.Vector4() }, uDust2: { value: new T.Vector4() }, uIon: { value: new T.Vector4() }, uComa: { value: new T.Vector4() } } };
    const comMat = new T.ShaderMaterial({ uniforms: com.U, vertexShader: COM_VS, fragmentShader: COM_FS, side: T.DoubleSide, transparent: false, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor });
    /* where to put it: for the night (now, if it is night; else the coming evening, a couple of hours after sunset), the
       place out over the sea, fairly low, where its tail would look longest; a third of an AU from us */
    function placeComet(ms, loc) {
      const sun = Astro.sun(ms, loc.lat, loc.lng);
      let tRef = ms;
      if (sun.alt > -8 * rad) { const ss = Astro.sunSet(ms, loc.lat, loc.lng); tRef = (ss || ms) + 2.5 * 36e5; }
      const M = eqMat(tRef, loc, new T.Matrix3()), MT = M.clone().transpose(), se = Astro.sunEq(tRef), s = eqv(se.ra, se.dec), Dl = 0.3;
      let best = null;
      for (let az = 45; az <= 150; az += 5) for (let al = 12; al <= 40; al += 3) {
        const w = V3(-Math.cos(al * rad) * Math.cos(az * rad), Math.sin(al * rad), -Math.cos(al * rad) * Math.sin(az * rad)), u = w.clone().applyMatrix3(MT);
        if (u.angleTo(s) < 55 * rad) continue;
        const tl = tailLook(u, Dl, s), sc = tl.len * (1 - Math.abs(az - 95) / 140) * (1 - Math.abs(al - 24) / 45);
        if (!best || sc > best.sc) best = { sc, u };
      }
      com.tried = ms;
      if (!best) return;
      com.u = best.u; com.ref = tRef; com.Dl = Dl;
      const p = cometParts(best.u, Dl, s), H = best.u;
      /* the sheet: x along the way the ion tail goes on the sky, y across it; a point P's place on it is P's direction
         carried out to the sheet (gnomonic: x = P·e1/P·H) */
      const e1 = p.ion.clone().addScaledVector(H, -p.ion.dot(H)).normalize(), e2 = H.clone().cross(e1);
      const gn = P => [P.dot(e1) / P.dot(H), P.dot(e2) / P.dot(H)];
      const [Li] = gn(p.ion), [xm, ym] = gn(p.dust[0]), [xd, yd] = gn(p.dust[1]);
      /* (the dust tail's curve through its middle and its end: y = ax + bx²) */
      const det = xm * xd * xd - xd * xm * xm; let ca = Math.abs(det) > 1e-9 ? (ym * xd * xd - yd * xm * xm) / det : 0, cb = Math.abs(det) > 1e-9 ? (xm * yd - xd * ym) / det : 0;
      /* (however it is seen, a dust tail bends gently: no more than a fifth of its length off its first line) */
      if (Math.abs(cb) * xd > 0.2) cb *= 0.2 / (Math.abs(cb) * xd);
      /* (its widths: as wide as it is in AU, over how far off that part of it is) */
      const wd0 = 0.005 / Dl, wd1 = 0.024 / p.dust[1].length(), wi0 = 0.0014 / Dl, wi1 = 0.014 / p.ion.length();
      /* (a tail seen end-on is as bright as its whole length heaped up in less sky) */
      const ps = Math.sin(H.angleTo(p.a)), fsh = Math.min(2.5, 1 / Math.max(0.4, ps));
      const U = com.U;
      U.uDust.value.set(ca, cb, Math.max(xd, 1e-3), wd0); U.uDust2.value.set(wd1, 0.034 * fsh, Math.sign(cb) || 1, 0);
      U.uIon.value.set(Math.max(Li, 1e-3), wi0, wi1, 0.0045 * fsh); U.uComa.value.set(0.0131, 1, 0, 0);
      const X0 = -0.03, X1 = Math.max(Li, xd) + 0.02, W = Math.max(wd1, wi1) * 2.6 + 0.02, Y0 = Math.min(0, ym, yd) - W, Y1 = Math.max(0, ym, yd) + W;
      const P = [], XY = [];
      for (const [x, y] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) { const q = H.clone().addScaledVector(e1, x).addScaledVector(e2, y); P.push(q.x, q.y, q.z); XY.push(x, y); }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('aXY', new T.Float32BufferAttribute(XY, 2));
      g.setIndex([0, 1, 2, 1, 3, 2]); g.boundingSphere = new T.Sphere(V3(), 1e9);
      if (com.mesh) { com.mesh.geometry.dispose(); com.mesh.geometry = g; }
      else { com.mesh = new T.Mesh(g, comMat); com.mesh.frustumCulled = false; com.mesh.renderOrder = 1001; grp.add(com.mesh); }
      com.look = { tail: Li / rad, dust: xd / rad, r: p.r, ps };
      com.on = true;
    }

    /* every frame: dt in real seconds (a shooting star takes the time a real one takes, however fast the sky's own clock
       is running); ms, loc: the sky's time and place; eq: the sky's turn (stars.js); k: how dark it is (0 by day, 1 on
       a moonless night); cover: how much cloud; camera; pxr: pixels to a radian on the screen */
    let last = null;
    const api = { freeze: false };
    function update(o) {
      last = o;
      const dt = api.freeze ? 0 : Math.max(0, Math.min(0.1, o.dt || 0));
      clock += dt;
      eqNow.copy(o.eq); eqTNow.copy(o.eq).transpose();
      /* (in the stars' own units: as bright as a star of its magnitude, stars.js) */
      Uc.uK.value = o.k * 0.42; Uc.uCov.value = o.cover || 0; Uc.uPx.value = o.px || 1; if (o.res) Uc.uRes.value.set(o.res[0], o.res[1]);
      const dark = sm(0.2, 0.7, o.k);
      /* new ones, at the rate of a shower night or of the sky's own, whichever is more */
      if (dark > 0 && o.spawn !== false && !api.freeze) {
        nextT -= dt * dark;
        if (nextT <= 0) {
          const hr = Math.max(rate(o.ms, o.eq), 110);
          nextT = -Math.log(1 - Math.random() * 0.98) * 3600 / hr;
          if (live.length < MAXH) spawn({ ms: o.ms, eq: o.eq, camera: o.camera, pxr: o.pxr });
        }
      }
      /* each one on along its run; the heads where they have got to; gone when its train has */
      let nh = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i]; m.t += dt;
        m.mesh.material.uniforms.uNow.value = m.t;
        if (m.t > m.life) { grp.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); live.splice(i, 1); continue; }
        if (m.t <= m.dur && nh < MAXH) {
          const x = m.t / m.dur * (m.n - 1), j = Math.min(m.n - 2, Math.floor(x)), f = x - j;
          const a = j * 3, b = (j + 1) * 3;
          pv.set(m.dq[a] + (m.dq[b] - m.dq[a]) * f, m.dq[a + 1] + (m.dq[b + 1] - m.dq[a + 1]) * f, m.dq[a + 2] + (m.dq[b + 2] - m.dq[a + 2]) * f).normalize();
          hp.set([pv.x, pv.y, pv.z], nh * 3); hf[nh] = m.fq[j] + (m.fq[j + 1] - m.fq[j]) * f; hc.set(m.col, nh * 3); nh++;
          /* seen: its head in the picture, bright enough, the sky dark and clear enough there to see it */
          if (!m.seen && o.camera && hf[nh - 1] > Math.pow(10, -0.4 * 3) && pv.y > 0.02 && inView(o.camera, pv) && (o.cover || 0) < 0.6 && o.k > 0.35) {
            m.seen = true; events.push({ kind: m.fire ? 'fireball' : 'meteor', name: m.name, M: m.M, grazer: m.grazer, dur: m.dur, v: m.v });
          }
        }
      }
      for (let i = nh; i < MAXH; i++) hf[i] = 0;
      hg.attributes.position.needsUpdate = hg.attributes.aF.needsUpdate = hg.attributes.aCol.needsUpdate = true;
      heads.visible = nh > 0;
      /* the comet: placed for the night when it first gets dark (and again if the sky's clock has gone on days since) */
      if (o.loc && o.k > 0.05 && (!com.on || Math.abs(o.ms - com.ref) > 2.5 * 864e5) && Math.abs(o.ms - com.tried) > 36e5) placeComet(o.ms, o.loc);
      if (com.on) {
        com.U.uEq.value.copy(o.eq); com.U.uK.value = o.k;
        com.mesh.visible = o.k > 0.02;
        /* (once, the first time it can be seen in the picture: say so) */
        if (!com.told && o.camera && o.k > 0.5 && (o.cover || 0) < 0.5) {
          const d = com.u.clone().applyMatrix3(o.eq);
          if (d.y > 0.06 && inView(o.camera, d)) { com.told = true; events.push({ kind: 'comet', alt: Math.asin(d.y) / rad }); }
        }
      }
    }
    /* what has happened since last asked (shooting stars seen, the comet first seen) */
    const take = () => events.splice(0, events.length);
    /* (for looking at one: a shooting star made now, with the sky as it was last frame, and shown at a share of its run) */
    function test(opt = {}, at = null) { if (!last) return null; const m = spawn(last, opt); if (m && at !== null) m.t = at * m.dur; return m && { dur: m.dur, M: m.M, v: m.v, n: m.n, grazer: m.grazer, name: m.name, om: m.om, mid: m.mid.toArray() }; }
    return Object.assign(api, { update, spawn: (o, opt) => spawn(o, opt), test, take, get live() { return live; }, comet: com, group: grp, rate: (ms, eq) => rate(ms, eq), showers });
  }
  return { build, SHOWERS };
})();
