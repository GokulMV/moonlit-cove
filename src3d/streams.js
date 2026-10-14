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
        const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1), tx = C[j][0] - C[k][0], tz = C[j][1] - C[k][1], tl = Math.hypot(tx, tz) || 1, w = 3.5 * Math.sin(u / 37 + q) + 2.0 * Math.sin(u / 13 + 2 * q);
        X[i] = C[i][0] - tz / tl * w; Z[i] = C[i][1] + tx / tl * w; if (i) u += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
      }
      /* (the water's level: the valley floor's, a hand under it, falling all the way to the sea) */
      for (let i = 0; i < n; i++) { const h = groundAt(X[i], Z[i]), s = I.sdf(X[i], Z[i]); BCH[i] = sm(-30, -2, s); Y[i] = Math.max(h - 0.22, 0.02) * (1 - BCH[i]) + 0.03 * BCH[i]; if (i) Y[i] = Math.min(Y[i], Y[i - 1] - 0.004); }
      const Y2 = new Float32Array(Y); for (let it = 0; it < 2; it++) for (let i = 1; i < n - 1; i++) Y2[i] = Math.min(Y2[i - 1] - 0.002, (Y2[i - 1] + Y2[i] * 2 + Y2[i + 1]) / 4); for (let i = 0; i < n; i++) Y[i] = Math.max(0.02, Y2[i]);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        /* (narrow at its head, wider down the valley; spread wide and shallow over the beach) */
        Wd[i] = (0.7 + 2.4 * Math.pow(t, 0.8)) * (1 + 1.6 * BCH[i]) + 0.4 * Math.sin(i / 7 + q);
        Dp[i] = (0.12 + 0.35 * t) * (1 - 0.8 * BCH[i]);
        const a2 = Math.max(0, i - 2), b2 = Math.min(n - 1, i + 2); ST[i] = (Y[a2] - Y[b2]) / Math.max(1, Math.hypot(X[b2] - X[a2], Z[b2] - Z[a2]));
      }
      const st = { q, n, X, Z, Y, W: Wd, D: Dp, BCH, ST, len: u };
      streams.push(st);
      for (let i = 0; i < n - 1; i++) {
        const r = Wd[i] / 2 + 3, gx0 = Math.floor((Math.min(X[i], X[i + 1]) - r) / CELL), gx1 = Math.floor((Math.max(X[i], X[i + 1]) + r) / CELL), gz0 = Math.floor((Math.min(Z[i], Z[i + 1]) - r) / CELL), gz1 = Math.floor((Math.max(Z[i], Z[i + 1]) + r) / CELL);
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) { const k = gx * 65536 + gz; let L = grid.get(k); if (!L) grid.set(k, (L = [])); L.push(st, i); }
      }
    });
    /* the ground at (x, z) with the channels cut into it: within a stream's width its bed, the banks easing back to the
       island's own over a couple of metres */
    function ground(x, z, h) {
      const L = grid.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL)); if (!L) return h;
      let best = 1e9, bi = 0, bt = null, bu = 0;
      for (let k = 0; k < L.length; k += 2) {
        const t = L[k], i = L[k + 1], ax = t.X[i], az = t.Z[i], ex = t.X[i + 1] - ax, ez = t.Z[i + 1] - az, ll = ex * ex + ez * ez || 1, u = clamp(((x - ax) * ex + (z - az) * ez) / ll, 0, 1);
        const d = Math.hypot(x - ax - ex * u, z - az - ez * u); if (d < best) { best = d; bi = i; bt = t; bu = u; }
      }
      if (!bt) return h;
      const w = bt.W[bi] / 2, bed = bt.Y[bi] + (bt.Y[bi + 1] - bt.Y[bi]) * bu - bt.D[bi], k = 1 - sm(w * 0.7, w + 2.2, best);
      if (k <= 0 || bt.BCH[bi] > 0.95) return h;
      return Math.min(h, h + (bed - h) * k);
    }
    /* the stream nearest a point: { t, i, d } */
    function nearest(x, z) {
      const L = grid.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL)); if (!L) return null; let out = null;
      for (let k = 0; k < L.length; k += 2) { const t = L[k], i = L[k + 1], d = Math.hypot(x - t.X[i], z - t.Z[i]); if (!out || d < out.d) out = { t, i, d }; }
      return out;
    }
    const clear = []; for (const s of streams) for (let i = 0; i < s.n; i += 2) clear.push([s.X[i], s.Z[i], s.W[i] / 2 + 0.6]);
    return { streams, ground, nearest, clear };
  }

  /* ── the water: a strip along each stream at its level ── */
  const VS = `
attribute vec4 aS;      /* along it (m), across it (-1..1), how deep, how much of it is out on the beach */
attribute float aSt;    /* how steeply it falls there */
varying vec4 vS; varying float vSt; varying vec3 vW;
void main(){ vS = aS; vSt = aSt; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
  const FS = `
uniform float uTime, uFlood; uniform vec3 uHor, uZen, uKeyDirT, uKeyColT, uAmbF; uniform vec4 uFog; uniform sampler2D uNoise;
varying vec4 vS; varying float vSt; varying vec3 vW;
float n2(vec2 p){ return texture2D(uNoise, p).r; }
void main(){
  float along = vS.x, ac = vS.y, dep = vS.z, bch = vS.w, fl = uFlood;
  /* (its edges ragged against the stones and the sand; in flood it brims over them) */
  float edge = 1.0 - abs(ac), rag = n2(vW.xz*0.35)*0.6 + n2(vW.xz*1.3 + 3.0)*0.4;
  if (edge < 0.12 + 0.3*rag*(1.0 - 0.6*fl) - 0.1*fl) discard;
  /* (out over the sand it runs in braids: channels that split and join, dry sand between) */
  if (bch > 0.3 && n2(vec2(along*0.012, ac*0.35) + vW.xz*0.02) + 0.25*fl < 0.38*smoothstep(0.3, 0.9, bch)) discard;
  /* the flow: ripples drawn down it, faster where it falls, and in flood */
  float sp = 0.6 + 6.0*clamp(vSt, 0.0, 0.25) + 1.2*fl, t = uTime*sp;
  vec2 p1 = vec2(along*0.45 - t*0.9, ac*0.8), p2 = vec2(along*1.3 - t*1.6, ac*1.9 + 0.37);
  vec2 g = vec2(n2(p1*0.11) - n2(p1*0.11 + vec2(0.013, 0.0)), n2(p2*0.07) - n2(p2*0.07 + vec2(0.0, 0.013)))*(6.0 + 10.0*clamp(vSt*3.0, 0.0, 1.0));
  vec3 N = normalize(vec3(g.x, 1.0, g.y)), V = normalize(cameraPosition - vW);
  float F = 0.02 + 0.98*pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  vec3 sky = mix(uHor, uZen, pow(clamp(R.y, 0.0, 1.0), 0.6));
  /* (the bed through the water: brown and grey stones, sand on the beach; clear, a little green with depth) */
  float st = n2(vW.xz*0.9)*0.6 + n2(vW.xz*3.1)*0.4;
  vec3 bed = mix(mix(vec3(0.11, 0.09, 0.065), vec3(0.17, 0.16, 0.14), smoothstep(0.45, 0.7, st)), vec3(0.42, 0.36, 0.26), bch);
  vec3 wc = bed*exp(-dep*vec3(2.2, 1.0, 1.2))*(uAmbF*0.9 + uKeyColT*max(uKeyDirT.y, 0.0)*0.8);
  /* (in flood: brown, opaque, fast) */
  wc = mix(wc, vec3(0.12, 0.085, 0.05)*(uAmbF + uKeyColT*0.6), fl*0.85);
  vec3 c = wc*(1.0 - F) + sky*F;
  /* (white where it drops over its stones) */
  float wh = smoothstep(0.08, 0.22, vSt + 0.06*fl)*smoothstep(0.45, 0.75, n2(vec2(along*0.6 - t*1.2, ac*1.5)));
  c = mix(c, (uAmbF + uKeyColT*0.7)*0.85, wh*0.8);
  float d = distance(vW, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.05))));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  function build(root, I, P, o) {
    const group = new T.Group(); group.name = 'streams'; root.add(group);
    const U = Mats.U, mat = new T.ShaderMaterial({ uniforms: { uTime: U.uTime, uFlood: U.uFlood, uHor: o.sky.uHor, uZen: o.sky.uZen, uKeyDirT: U.uKeyDirT, uKeyColT: U.uKeyColT, uAmbF: U.uAmbF, uFog: U.uFog, uNoise: o.noise },
      vertexShader: VS, fragmentShader: FS, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    for (const s of P.streams) {
      const PIECE = 160;
      for (let i0 = 0; i0 < s.n - 1; i0 += PIECE) {
        const i1 = Math.min(s.n - 1, i0 + PIECE), m = i1 - i0 + 1, A = 5, pos = new Float32Array(m * A * 3), aS = new Float32Array(m * A * 4), aSt = new Float32Array(m * A), idx = [];
        let along = 0; for (let i = 1; i <= i0; i++) along += Math.hypot(s.X[i] - s.X[i - 1], s.Z[i] - s.Z[i - 1]);
        for (let k = 0; k < m; k++) {
          const i = i0 + k, a = Math.max(0, i - 1), b = Math.min(s.n - 1, i + 1), tx = s.X[b] - s.X[a], tz = s.Z[b] - s.Z[a], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
          if (k) along += Math.hypot(s.X[i] - s.X[i - 1], s.Z[i] - s.Z[i - 1]);
          for (let j = 0; j < A; j++) {
            const ac = -1 + 2 * j / (A - 1), off = ac * (s.W[i] / 2 + 0.35), v = (k * A + j);
            pos.set([s.X[i] + nx * off, s.Y[i], s.Z[i] + nz * off], v * 3); aS.set([along, ac, s.D[i] * (1 - ac * ac), s.BCH[i]], v * 4); aSt[v] = s.ST[i];
          }
          if (k < m - 1) for (let j = 0; j < A - 1; j++) { const p = k * A + j; idx.push(p, p + A, p + 1, p + 1, p + A, p + A + 1); }
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aS', new T.BufferAttribute(aS, 4)); g.setAttribute('aSt', new T.BufferAttribute(aSt, 1)); g.setIndex(idx); g.computeBoundingSphere();
        const mesh = new T.Mesh(g, mat); group.add(mesh);
      }
    }
    return { group, mat };
  }
  return { plan, build };
})();
