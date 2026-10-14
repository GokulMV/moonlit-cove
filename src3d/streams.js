/* ─────────────────────────────────────────────────────────────
   streams.js — the island's streams (Layout.isle): down each of the
   valleys island.js carves, from high up under the ridge to the
   shore, a stream in its own channel, clear over its stones,
   rippling where it runs fast and white where it drops; out over
   the beach it spreads and braids across the sand to the sea. In
   rain (Mats.U.uFlood) it rises, widens and runs brown and fast.
   The channel is worked into the island's ground (isle.js asks
   ground() for every point it draws), so the land, the trees and
   the walk all find the water where it is.
   ───────────────────────────────────────────────────────────── */
const IsleStreams = (() => {
  const T = THREE;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function curve(P, step = 1) {
    /* (the points first set no further apart than a few metres along their straight runs: the curve's tangent at a point
       is half the way from the point before to the point after, and a long run beside a short one would throw it out
       in a loop) */
    { const Q = [P[0]]; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 8)); for (let k = 1; k <= m; k++) Q.push([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]); } P = Q; }
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(2, Math.round(L / step));
      for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
    }
    out.push(P[P.length - 1].slice()); return out;
  }

  /* ── the plan: each stream's line from its head to the sea, a point a metre; its water's level (falling all the way, never
     rising), its width and depth; and the channel it runs in, cut into the ground ── */
  function plan(I, o = {}) {
    const streams = [], CELL = 24, grid = new Map(), groundAt = o.ground || ((x, z) => I.height(x, z));
    I.STREAMS.forEach((S, q) => {
      /* (its head is the valley's inland end; at the shore it runs on across the beach to the water) */
      const P = S.pts.slice().reverse(), a = P[P.length - 1], b = P[P.length - 2], dl = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, dx = (a[0] - b[0]) / dl, dz = (a[1] - b[1]) / dl;
      for (let d = 6; d < 120; d += 6) { const x = a[0] + dx * d, z = a[1] + dz * d; P.push([x, z]); if (I.sdf(x, z) > 2) break; }
      /* (the stream's own wander along its valley's floor: a few metres either way, in long bends; and it ends where it
         reaches the sea) */
      let C = curve(P, 1); { const cut = C.findIndex(p => I.sdf(p[0], p[1]) > 1.2); if (cut > 10) C = C.slice(0, cut + 1); }
      const n = C.length;
      const X = new Float32Array(n), Z = new Float32Array(n), Y = new Float32Array(n), Wd = new Float32Array(n), Dp = new Float32Array(n), BCH = new Float32Array(n), ST = new Float32Array(n);
      let u = 0;
      for (let i = 0; i < n; i++) {
        /* (and out on the beach it winds more tightly, as a stream does over sand) */
        const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1), tx = C[j][0] - C[k][0], tz = C[j][1] - C[k][1], tl = Math.hypot(tx, tz) || 1, bc = sm(-30, -4, I.sdf(C[i][0], C[i][1]));
        const w = 3.5 * Math.sin(u / 37 + q) + 2.0 * Math.sin(u / 13 + 2 * q) + bc * (1.8 * Math.sin(u / 3.2 + 3 * q) + 0.6 * Math.sin(u / 1.5 + q));
        X[i] = C[i][0] - tz / tl * w; Z[i] = C[i][1] + tx / tl * w; if (i) u += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
      }
      /* (the water's level: the valley floor's, a hand under it, falling all the way to the sea) */
      for (let i = 0; i < n; i++) { const h = groundAt(X[i], Z[i]), s = I.sdf(X[i], Z[i]); BCH[i] = sm(-30, -2, s); Y[i] = Math.max(h - 0.3, 0.02) * (1 - BCH[i]) + 0.03 * BCH[i]; if (i) Y[i] = Math.min(Y[i], Y[i - 1] - 0.004); }
      const Y2 = new Float32Array(Y); for (let it = 0; it < 2; it++) for (let i = 1; i < n - 1; i++) Y2[i] = Math.min(Y2[i - 1] - 0.002, (Y2[i - 1] + Y2[i] * 2 + Y2[i + 1]) / 4); for (let i = 0; i < n; i++) Y[i] = Math.max(0.02, Y2[i]);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        /* (narrow at its head, wider down the valley; spread wide and shallow over the beach) */
        Wd[i] = (0.7 + 2.4 * Math.pow(t, 0.8)) * (1 + 0.8 * BCH[i]) + 0.4 * Math.sin(i / 7 + q);
        Dp[i] = (0.15 + 0.4 * t) * (1 - 0.8 * BCH[i]);
        const a2 = Math.max(0, i - 2), b2 = Math.min(n - 1, i + 2); ST[i] = (Y[a2] - Y[b2]) / Math.max(1, Math.hypot(X[b2] - X[a2], Z[b2] - Z[a2]));
      }
      /* (where it falls steeply it falls in steps, as a mountain stream does: a line of boulders across it every few metres,
         the steeper the closer together, and under each a pool lying nearly level to the next; the water drops over
         each step, white) */
      const steps = [], SP = new Float32Array(n).fill(99), hq = k => { let h = Math.imul(k + 977 * q, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
      { let uu = 0, next = 0; for (let i = 1; i < n - 2; i++) { uu += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]); const sl = ST[i];
          if (BCH[i] > 0.25 || sl < 0.06) { next = Math.max(next, uu + 3); continue; }
          if (uu >= next) { steps.push(i); next = uu + Math.max(1.6, Math.min(14, 0.45 / sl)) * (0.8 + 0.4 * hq(i)); } } }
      /* (each pool's level: nearly that of the step it pours over, a little of the fall along its length, the rest at the step) */
      for (let k = 0; k < steps.length; k++) {
        const a = k ? steps[k - 1] : -1, b = steps[k]; if (a < 0) continue;
        const ya = Y[a + 1], yb = Y[b]; for (let i = a + 1; i <= b; i++) Y[i] = yb + 0.12 * (ya - yb) * (b - i) / Math.max(1, b - a - 1);
      }
      for (let k = 0, j = 0; k < n; k++) { while (j + 1 < steps.length && steps[j + 1] <= k) j++; if (steps.length && steps[j] <= k) { let d = 0; for (let i = steps[j] + 1; i <= k; i++) d += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]); SP[k] = Math.min(99, d); } }
      for (let i = 1; i < n; i++) Y[i] = Math.min(Y[i], Y[i - 1] - 0.002);
      /* (out on the beach, which way is inland, and how high the forest's wall stands above the water seen from there: the
         tangent of its top's angle, for what the water mirrors) */
      const FX = new Float32Array(n), FZ = new Float32Array(n), FE = new Float32Array(n), SQ = {};
      for (let i = 0; i < n; i++) {
        if (BCH[i] < 0.01) continue;
        const nn = I.normalAt(X[i], Z[i]), sh = I.shore(I.uAt(X[i], Z[i]), SQ), dF = Math.max(1.5, sh.W + I.sdf(X[i], Z[i]));
        FX[i] = -nn[0]; FZ[i] = -nn[1]; FE[i] = 24 / dF;
      }
      const st = { q, n, X, Z, Y, W: Wd, D: Dp, BCH, ST, FX, FZ, FE, SP, steps, len: u };
      streams.push(st);
      for (let i = 0; i < n - 1; i++) {
        const r = Wd[i] / 2 + 3, gx0 = Math.floor((Math.min(X[i], X[i + 1]) - r) / CELL), gx1 = Math.floor((Math.max(X[i], X[i + 1]) + r) / CELL), gz0 = Math.floor((Math.min(Z[i], Z[i + 1]) - r) / CELL), gz1 = Math.floor((Math.max(Z[i], Z[i + 1]) + r) / CELL);
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) { const k = gx * 65536 + gz; let L = grid.get(k); if (!L) grid.set(k, (L = [])); L.push(st, i); }
      }
    });
    /* (the stream segment nearest a point: which stream, which segment, how far along it, how far from it) */
    const SG = { t: null, i: 0, u: 0, d: 1e9 };
    function seg(x, z) {
      SG.t = null; SG.d = 1e9;
      const L = grid.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL)); if (!L) return SG;
      for (let k = 0; k < L.length; k += 2) {
        const t = L[k], i = L[k + 1], ax = t.X[i], az = t.Z[i], ex = t.X[i + 1] - ax, ez = t.Z[i + 1] - az, ll = ex * ex + ez * ez || 1, u = clamp(((x - ax) * ex + (z - az) * ez) / ll, 0, 1);
        const d = Math.hypot(x - ax - ex * u, z - az - ez * u); if (d < SG.d) { SG.d = d; SG.i = i; SG.t = t; SG.u = u; }
      }
      return SG;
    }
    /* the ground at (x, z) with the channels cut into it: across the water's width its bed, nearly flat; its banks rising
       steeply out of it, a stream's own cut, the last of them easing back into the valley's floor over a couple of metres */
    function ground(x, z, h) {
      const q = seg(x, z), t = q.t; if (!t) return h;
      const i = q.i, w = t.W[i] / 2, d = q.d;
      if (d > w + 2.6 || t.BCH[i] > 0.95) return h;
      const Yw = t.Y[i] + (t.Y[i + 1] - t.Y[i]) * q.u, bed = Yw - t.D[i], k = 1 - 0.82 * sm(w * 0.75, w + 0.8, d) - 0.18 * sm(w + 0.8, w + 2.4, d), b = 1 - sm(0.8, 0.95, t.BCH[i]);
      const g = Math.min(h, h + (bed - h) * k * b);
      /* (and its banks always come up out of the water: where the ground beside it lies lower than the water (the downhill
         side, where it runs along a valley's side), a low bank of its own, a hand above the water at the water's edge,
         easing down into the ground beyond) */
      const need = bed + (Yw + 0.2 - bed) * sm(w * 0.75, w + 0.7, d), fade = (1 - sm(w + 0.7, w + 2.6, d)) * b;
      return need > g ? g + (need - g) * fade : g;
    }
    /* how far the coarse tiles of the ground must be let down under a stream's banks, which are drawn finer (isle.js) and
       must lie over them: all of it within the banks' strip, none at its edge */
    const BANK = 2.6;
    function sink(x, z) {
      const q = seg(x, z), t = q.t; if (!t || t.BCH[q.i] > 0.9) return 0;
      const R = t.W[q.i] / 2 + 0.35 + BANK; return 0.9 * (1 - sm(R - 1.4, R - 0.3, q.d)) * (1 - sm(0.72, 0.86, t.BCH[q.i]));
    }
    /* the stream nearest a point: { t, i, d } */
    function nearest(x, z) {
      const L = grid.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL)); if (!L) return null; let out = null;
      for (let k = 0; k < L.length; k += 2) { const t = L[k], i = L[k + 1], d = Math.hypot(x - t.X[i], z - t.Z[i]); if (!out || d < out.d) out = { t, i, d }; }
      return out;
    }
    const clear = []; for (const s of streams) for (let i = 0; i < s.n; i += 2) clear.push([s.X[i], s.Z[i], s.W[i] / 2 + 0.6]);
    return { streams, ground, sink, nearest, clear, BANK };
  }

  /* ── the water: a strip along each stream at its level ── */
  const VS = `
attribute vec4 aS;      /* along it (m), across it (-1..1), how deep, how much of it is out on the beach */
attribute float aSt;    /* how steeply it falls there */
attribute float aSh;    /* how much of the sun gets down to it through the canopy */
attribute vec3 aF;      /* on the beach: which way is inland (x, z), and the forest wall's height over its distance */
attribute float aSp;    /* how far below the step above it (m): it pours over the step, then plunges into the pool */
varying vec4 vS; varying float vSt, vSh, vSp; varying vec3 vW, vF;
void main(){ vS = aS; vSt = aSt; vSh = aSh; vF = aF; vSp = aSp; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
  const FS = `
${GLSL.ISLE_SH}
uniform float uTime, uFlood; uniform vec3 uHor, uZen, uKeyDirT, uKeyColT, uAmbF; uniform vec4 uFog; uniform sampler2D uNoise;
varying vec4 vS; varying float vSt, vSh, vSp; varying vec3 vW, vF;
float n2(vec2 p){ return texture2D(uNoise, p).r; }
void main(){
  float along = vS.x, ac = vS.y, dep = vS.z, bch = vS.w, fl = uFlood, bk = smoothstep(0.3, 0.9, bch);
  /* where the water is. Up in the forest it fills its channel to the banks, and the banks (isle.js draws them) rising
     out of it make its edge, wherever they come up through it; out over the sand it is a sheet with edges of its own,
     ragged, and runs in braids, channels that split and join round wet bars, the main one down the middle. Soft-edged
     over a pixel or so, so its edges never step */
  float edge = 1.0 - abs(ac), rag = n2(vW.xz*0.35)*0.6 + n2(vW.xz*1.3 + 3.0)*0.4;
  float th = mix(0.04, 0.42 + 0.3*rag*(1.0 - 0.6*fl) - 0.25*fl, bk), ew = fwidth(edge) + 0.015;
  float wat = smoothstep(th - ew, th + ew, edge);

  /* (and on the sand past it, the wet margin, dark with the seep, fading out to the strip's own edge) */
  float wetA = smoothstep(0.0, max(th, 0.05), edge)*(1.0 - wat)*0.3*bk;
  if (wat < 0.004 && wetA < 0.004) discard;
  /* pools and riffles in turn down its length: in a pool it lies still and dark, deep, the forest in it as in a mirror;
     over a riffle it runs shallow and quick over its stones, broken, and where it falls steeply, white */
  float rf = smoothstep(0.42, 0.62, n2(vec2(along*0.021, 0.31))*0.75 + n2(vec2(along*0.09, 0.77))*0.25)*(1.0 - bk);
  float sp = 0.5 + 6.0*clamp(vSt, 0.0, 0.25)*(0.3 + 0.7*rf) + 1.2*fl, t = uTime*sp;
  vec2 p1 = vec2(along*0.45 - t*0.9, ac*0.8), p2 = vec2(along*1.3 - t*1.6, ac*1.9 + 0.37);
  /* (over a step and in the plunge below it, broken water; the pool calming out below) */
  float drop = 1.0 - smoothstep(0.0, 2.2, vSp), pool = smoothstep(1.5, 4.0, vSp)*step(vSp, 98.0);
  rf = max(rf*(1.0 - 0.7*pool), drop);
  float rough = mix(1.2, 7.0 + 10.0*clamp(vSt*3.0, 0.0, 1.0), rf)*(1.0 - 0.5*bk) + 6.0*fl + 10.0*drop;
  vec2 g = vec2(n2(p1*0.11) - n2(p1*0.11 + vec2(0.013, 0.0)), n2(p2*0.07) - n2(p2*0.07 + vec2(0.0, 0.013)))*rough;
  vec3 N = normalize(vec3(g.x, 1.0, g.y)), V = normalize(cameraPosition - vW);
  float F = 0.02 + 0.98*pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  /* (what the water mirrors: the sky where it is open above; under the trees their dark leaves, the sky through the gaps
     between them; and out on the beach, wherever the reflected ray runs inland under the forest's height, the forest's
     dark wall) */
  vec3 sky = mix(uHor, uZen, pow(clamp(R.y, 0.0, 1.0), 0.6)); float vSo = max(vSh, bk);
  vec3 leaf = vec3(0.024, 0.04, 0.02)*(uAmbF*1.2 + uKeyColT*0.3);
  float gap = smoothstep(0.68, 0.82, n2(vW.xz*0.03 + R.xz*0.6)*0.7 + n2(vW.xz*0.23 + R.xz*2.3)*0.3);
  vec3 refl = mix(leaf*(0.8 + 0.5*n2(vW.xz*0.07 + R.xz*2.0)), sky, clamp(vSo*1.2 - 0.1 + 0.5*gap*(1.0 - vSo), 0.0, 1.0));
  float rl = length(R.xz), tw = rl > 1e-4 ? dot(R.xz/rl, vF.xy) : 0.0, fe = R.y/max(rl, 1e-4), ft = vF.z*max(tw, 0.0);
  float wall = smoothstep(0.0, 0.2, tw)*(1.0 - smoothstep(ft*0.85, ft*1.15 + 1e-3, fe));
  refl = mix(refl, leaf*(1.0 + 0.6*n2(vW.xz*0.05 + R.xz*3.0)), wall);
  /* (the bed through the water: rounded stones, grey and tan, packed with sand and fallen leaves between, lighter over
     a riffle where it is shallow; sand on the beach, darker for being under water. The water itself the colour of
     weak tea, as a forest's streams are with what they wash out of the leaves, clearer over the sand) */
  float dp = dep*mix(1.0, 0.45, rf);
  vec2 bp = vW.xz + N.xz*dp*0.6; float st1 = n2(bp*0.29), st2 = n2(bp*0.83 + 1.7), st3 = n2(bp*2.1 + 4.0);
  float stones = smoothstep(0.4, 0.58, st1*0.55 + st2*0.3 + st3*0.15);
  vec3 bed = mix(vec3(0.11, 0.085, 0.055)*(0.8 + 0.4*st3), mix(vec3(0.25, 0.23, 0.19), vec3(0.32, 0.28, 0.22), st2)*(0.75 + 0.35*st3), stones);
  bed = mix(bed, vec3(0.38, 0.31, 0.22)*(0.9 + 0.2*st2), bch);
  /* (the light: the sky's, and the sun's where it comes down through the canopy, in flecks) */
  float fleck = smoothstep(0.62, 0.74, n2(vW.xz*0.045 + 0.3)*0.65 + n2(vW.xz*0.19)*0.35), sun = mix(fleck, 1.0, clamp(vSo*1.25 - 0.25, 0.0, 1.0))*isleSh(vW.xz);
  vec3 light = uAmbF*0.85 + uKeyColT*max(uKeyDirT.y, 0.0)*0.95*sun;
  vec3 wc = bed*exp(-dp*mix(vec3(1.1, 1.75, 2.7), vec3(1.6, 0.75, 0.9), bk))*light;
  /* (in flood: brown, opaque, fast) */
  wc = mix(wc, vec3(0.12, 0.085, 0.05)*(uAmbF + uKeyColT*0.6), fl*0.85);
  /* (the sun glinting off the ripples where it reaches them) */
  float gl = pow(max(dot(reflect(-V, N), uKeyDirT), 0.0), mix(160.0, 70.0, rf))*4.0*sun;
  vec3 c = wc*(1.0 - F) + refl*F + uKeyColT*gl;
  /* (the ripples' own light and dark, moving down it) */
  c *= 0.9 + (0.32*(n2(p2*0.05) - 0.5) + 0.12*(n2(p1*0.09 + 0.3) - 0.5))*(0.35 + 0.65*rf);
  /* (white where it drops over a step: streaks of it down the fall, torn and racing; a froth on the plunge pool below,
     drifting off; and in flood, everywhere it runs fast) */
  float fall = 1.0 - smoothstep(0.0, 1.1, vSp), plunge = smoothstep(0.6, 1.2, vSp)*(1.0 - smoothstep(1.4, 3.6, vSp));
  float stk = n2(vec2(along*0.35 - uTime*2.4, ac*5.0 + 0.2))*0.6 + n2(vec2(along*0.9 - uTime*3.1, ac*11.0))*0.4;
  float frt = n2(vW.xz*0.55 - vec2(0.0, uTime*0.07)*sign(vSt + 1e-3))*0.6 + n2(vW.xz*1.7 + uTime*0.05)*0.4;
  float wh = max(fall*smoothstep(0.35, 0.6, stk)*smoothstep(0.03, 0.08, vSt), plunge*smoothstep(0.55, 0.75, frt)*0.7)*(1.0 - bk);
  wh = max(wh, smoothstep(0.5, 0.75, n2(vec2(along*0.6 - t*1.2, ac*1.5)))*smoothstep(0.1, 0.25, vSt*rf)*0.6);
  c = mix(c, (uAmbF*1.1 + uKeyColT*0.75*sun)*0.85, clamp(wh, 0.0, 1.0)*0.85);
  float d = distance(vW, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  /* (the wet margin darkens the sand under it, as wet sand is darker, in the sun or the shade alike: drawn as a share of
     the sand's own light taken away, the water over it as itself) */
  /* (out on the sand the sheet of water is thin enough to see the sand through: the sand under it drawn as itself, lit and
     shaded as the beach is, the water over it as much as it mirrors) */
  float wa = wat*mix(1.0, 0.5 + 0.45*F, bk);
  float a = wa + (1.0 - wa)*wetA;
  gl_FragColor = vec4(c*(wa/max(a, 1e-4)), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  function build(root, I, P, o) {
    const group = new T.Group(); group.name = 'streams'; root.add(group);
    const U = Mats.U, mat = new T.ShaderMaterial({ uniforms: { uTime: U.uTime, uFlood: U.uFlood, uHor: o.sky.uHor, uZen: o.sky.uZen, uKeyDirT: U.uKeyDirT, uKeyColT: U.uKeyColT, uAmbF: U.uAmbF, uFog: U.uFog, uNoise: o.noise, ...Mats.shadeU() },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    for (const s of P.streams) {
      const PIECE = 160;
      for (let i0 = 0; i0 < s.n - 1; i0 += PIECE) {
        const i1 = Math.min(s.n - 1, i0 + PIECE), m = i1 - i0 + 1, A = 5, pos = new Float32Array(m * A * 3), aS = new Float32Array(m * A * 4), aSt = new Float32Array(m * A), aSh = new Float32Array(m * A), aF = new Float32Array(m * A * 3), aSp = new Float32Array(m * A), idx = [];
        let along = 0; for (let i = 1; i <= i0; i++) along += Math.hypot(s.X[i] - s.X[i - 1], s.Z[i] - s.Z[i - 1]);
        for (let k = 0; k < m; k++) {
          const i = i0 + k, a = Math.max(0, i - 1), b = Math.min(s.n - 1, i + 1), tx = s.X[b] - s.X[a], tz = s.Z[b] - s.Z[a], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
          if (k) along += Math.hypot(s.X[i] - s.X[i - 1], s.Z[i] - s.Z[i - 1]);
          for (let j = 0; j < A; j++) {
            const ac = -1 + 2 * j / (A - 1), off = ac * (s.W[i] / 2 + 0.35), v = (k * A + j);
            pos.set([s.X[i] + nx * off, s.Y[i], s.Z[i] + nz * off], v * 3); aS.set([along, ac, s.D[i] * (1 - ac * ac), s.BCH[i]], v * 4); aSt[v] = s.ST[i]; aSh[v] = o.shade ? o.shade(s.X[i], s.Z[i]) : 1; aF.set([s.FX[i], s.FZ[i], s.FE[i]], v * 3); aSp[v] = s.SP[i];
          }
          if (k < m - 1) for (let j = 0; j < A - 1; j++) { const p = k * A + j; idx.push(p, p + 1, p + A, p + 1, p + A + 1, p + A); }   /* (wound to face up) */
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aS', new T.BufferAttribute(aS, 4)); g.setAttribute('aSt', new T.BufferAttribute(aSt, 1)); g.setAttribute('aSh', new T.BufferAttribute(aSh, 1)); g.setAttribute('aF', new T.BufferAttribute(aF, 3)); g.setAttribute('aSp', new T.BufferAttribute(aSp, 1)); g.setIndex(idx); g.computeBoundingSphere();
        const mesh = new T.Mesh(g, mat); group.add(mesh);
      }
    }
    return { group, mat };
  }
  return { plan, build };
})();
