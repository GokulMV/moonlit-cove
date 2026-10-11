/* ─────────────────────────────────────────────────────────────
   world.js — the coast beyond the camp, without end. One stretch
   of Layout.P metres is built — four rocky headlands, each its own
   shape, with a strip of sand at its foot to drive round the point,
   sea stacks and surf rocks off it, and forest on the hills behind —
   in chunks, and copies of the chunks are laid end to end around the
   camera, with less detail the further away they are. By the camp the
   forest keeps its clearing; in every other copy that ground is wooded.
   Also returns what the van has to drive round, and the height of the
   land, for collisions.
   ───────────────────────────────────────────────────────────── */
const World = (() => {
  const T = THREE, TAU = Math.PI * 2, SH = Layout.SH;
  const P = Layout.P, CW = 128, X0 = -64, NC = P / CW;      /* chunk c covers [X0 + c·CW, X0 + (c+1)·CW); chunk 0 holds the camp */
  const LOD = { tiny: 45, near: 155, mid: 430, fine: 300, rocks: 1050, view: 1700 };
  const wrapD = d => d - P * Math.round(d / P);              /* the shortest way between two x's on the endless coast */
  const base = x => X0 + ((((x - X0) % P) + P) % P);          /* where an x falls in the built stretch */
  const rng = s => Textures.rng(s);
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ── value noise ── */
  const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  function vn(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), L = (a, b, t) => a + (b - a) * t;
    return L(L(L(h3(ix, iy, iz), h3(ix + 1, iy, iz), u), L(h3(ix, iy + 1, iz), h3(ix + 1, iy + 1, iz), u), v),
             L(L(h3(ix, iy, iz + 1), h3(ix + 1, iy, iz + 1), u), L(h3(ix, iy + 1, iz + 1), h3(ix + 1, iy + 1, iz + 1), u), v), w);
  }
  const fbm = (x, y, z, o = 4) => { let a = 0, s = 0.5, f = 1; for (let i = 0; i < o; i++) { a += s * vn(x * f, y * f, z * f); s *= 0.5; f *= 2.03; } return a; };
  /* noise that closes on itself every P metres along the coast: x is wrapped round a circle */
  const fbmX = (x, z, f, seed, o = 4) => { const a = x * TAU / P, R = f * P / TAU; return fbm(R * Math.cos(a) + seed * 1.37, R * Math.sin(a) - seed * 0.71, z * f, o); };
  const vnX = (x, z, f, seed) => { const a = x * TAU / P, R = f * P / TAU; return vn(R * Math.cos(a) + seed * 1.37, R * Math.sin(a) - seed * 0.71, z * f); };
  /* 2-D cells, N to a stretch: distance to the nearest jittered point (in cell units) and that cell's id */
  function cell2P(x, z, N, seed) {
    const size = P / N, gx = Math.floor(x / size), gz = Math.floor(z / size); let best = 1e9, id = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const cx = gx + i, cz = gz + j, wx = ((cx % N) + N) % N;
      const px = (cx + 0.15 + 0.7 * h3(wx, cz, seed)) * size, pz = (cz + 0.15 + 0.7 * h3(cz + 17.3, wx - 5.1, seed + 3.7)) * size;
      const d = (px - x) ** 2 + (pz - z) ** 2; if (d < best) { best = d; id = h3(wx * 1.7, cz * 2.3, seed + 9.1); }
    }
    return [Math.sqrt(best) / size, id];
  }

  /* ── the land ── */
  /* hills behind the beach, so the forest climbs away from the sand */
  const hill = (x, z) => { const e = z - Layout.vegZ(x) - 9; if (e <= 0) return -0.06; const k = e < 100 ? (e / 100) ** 2 * (3 - 2 * e / 100) : 1; return k * (16 + 22 * fbmX(x, z, 0.012, 3.1, 3)) + 2.5 * fbmX(x, z, 0.06, 1.7, 2) * Math.min(1, e / 20); };
  /* each headland its own: height, the step of its rock terraces, the sand left at its foot (the van's way round), its sea stacks */
  const HC = [{ ht: 1.0, st: 1.7, gap: 9.5, stacks: 1 }, { ht: 1.12, st: 1.9, gap: 10.0, stacks: 2 }, { ht: 0.72, st: 1.35, gap: 9.0, stacks: 1 }, { ht: 1.35, st: 2.2, gap: 11.0, stacks: 2 }];
  /* a headland: a promontory of stepped rock rising off the back of the beach where the coast bulges out;
     the sea runs round a strip of sand at its foot */
  function massifF(x, z) {
    let best = -9, fp = 0;
    for (let i = 0; i < SH.h.length; i++) {
      const hx = SH.h[i][0], w = SH.h[i][1], u = wrapD(x - hx);
      if (Math.abs(u) > w * 3.4) continue;
      const c = HC[i], lx = hx + u, zt = Layout.shoreZ(hx) + c.gap, s = z - zt;
      if (s < -9) continue;
      const bend = 2.6 * Math.sin(s * 0.06 + hx * 0.1), hw = w * (0.36 + 0.7 * sm(0, 32, s)), a = (u - bend) / hw, e = Math.exp(-a * a * 1.3);
      const body = e * sm(-3.5, 4.0, s) * sm(0.02, 0.12, e), top = (5.5 + 7.5 * sm(2, 44, s)) * c.ht;
      let H = top * body * (0.7 + 0.6 * fbm(lx * 0.05 + hx, 2.0, z * 0.05, 3));
      const st = c.st, k = (H + 0.9 * (fbm(lx * 0.13, 7.0, z * 0.13, 2) - 0.5)) / st, f = k - Math.floor(k);
      H = H * 0.35 + 0.65 * (Math.floor(k) + sm(0.25, 0.75, f)) * st;
      H += (fbm(lx * 0.33, 5.0, z * 0.33, 2) - 0.5) * 1.4 * sm(0.3, 2.5, H);
      if (H > best) { best = H; fp = body; }
    }
    return [best, fp];
  }
  const massif = (x, z) => massifF(x, z)[0];
  const land = (x, z) => Math.max(hill(x, z), massif(x, z));
  const slope = (x, z, e = 0.8) => Math.hypot(land(x + e, z) - land(x - e, z), land(x, z + e) - land(x, z - e)) / (2 * e);
  /* near a headland, the sand at its foot up to here is kept clear for the van */
  const nearHead = (x, k = 2.6) => SH.h.some(([hx, w]) => Math.abs(wrapD(x - hx)) < w * k);
  const corrTop = x => Layout.shoreZ(x) + 6.6;

  /* ── rocks: a noisy sphere cut by random planes into flat fractured faces, with creased normals ── */
  const PAL = [[0.150, 0.138, 0.122], [0.092, 0.088, 0.084], [0.168, 0.116, 0.082], [0.128, 0.122, 0.112], [0.112, 0.104, 0.094]];
  function rockProto(seed, shape, detail, opt = {}) {
    const r = rng(seed), o = seed * 0.713;
    const src = new T.IcosahedronGeometry(1, detail), pa = src.attributes.position, map = new Map(), v = [], idx = [];
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
      let id = map.get(k); if (id === undefined) { id = v.length / 3; map.set(k, id); v.push(x, y, z); } idx.push(id);
    }
    src.dispose();
    const planes = [], nCut = 5 + Math.floor(r() * 5);
    for (let i = 0; i < nCut; i++) {
      let x, y, z, l; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = Math.hypot(x, y, z); } while (l > 1 || l < 0.25);
      x /= l; y /= l; z /= l; if (y < -0.2) y = -y * 0.6; l = Math.hypot(x, y, z);
      planes.push([x / l, y / l, z / l, 0.5 + r() * 0.38]);
    }
    if (opt.top) { const a = r() * TAU, t = 0.12; planes.push([Math.cos(a) * t, Math.sqrt(1 - t * t), Math.sin(a) * t, opt.top]); }
    const nv = v.length / 3, aux = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      let x = v[i * 3], y = v[i * 3 + 1], z = v[i * 3 + 2];
      const big = fbm(x * 1.1 + o, y * 1.1, z * 1.1 - o, 3), k = 0.86 + 0.32 * big; x *= k; y *= k; z *= k;
      for (const [px, py, pz, d] of planes) { const t = x * px + y * py + z * pz - d; if (t > 0) { x -= px * t * 0.96; y -= py * t * 0.96; z -= pz * t * 0.96; } }
      const det = fbm(x * 3.3 + 2.1, y * 3.3 - o, z * 3.3, 3), rid = 1 - Math.abs(2 * vn(x * 2.4 + o, y * 2.4, z * 2.4 + 5) - 1);
      const kk = 1 + (det - 0.5) * 0.13 - 0.07 * Math.pow(rid, 6);
      x *= kk * shape[0]; y *= kk * shape[1]; z *= kk * shape[2];
      const fl = -0.22 * shape[1]; if (y < fl) y = fl + (y - fl) * 0.2;      /* bedded in the sand */
      v[i * 3] = x; v[i * 3 + 1] = y; v[i * 3 + 2] = z; aux[i * 3] = big; aux[i * 3 + 1] = det; aux[i * 3 + 2] = rid;
    }
    const F = idx.length / 3, fn = new Float32Array(F * 3), fa = new Float32Array(F * 3), adj = Array.from({ length: nv }, () => []);
    for (let f = 0; f < F; f++) {
      const a = idx[f * 3], b = idx[f * 3 + 1], c = idx[f * 3 + 2], ax = v[a * 3], ay = v[a * 3 + 1], az = v[a * 3 + 2];
      const ux = v[b * 3] - ax, uy = v[b * 3 + 1] - ay, uz = v[b * 3 + 2] - az, wx = v[c * 3] - ax, wy = v[c * 3 + 1] - ay, wz = v[c * 3 + 2] - az;
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1;
      fa[f * 3] = nx; fa[f * 3 + 1] = ny; fa[f * 3 + 2] = nz; fn[f * 3] = nx / l; fn[f * 3 + 1] = ny / l; fn[f * 3 + 2] = nz / l;
      adj[a].push(f); adj[b].push(f); adj[c].push(f);
    }
    const cosC = Math.cos(36 * Math.PI / 180), P = new Float32Array(F * 9), N = new Float32Array(F * 9), C = new Float32Array(F * 9);
    const pal = PAL[Math.floor(r() * PAL.length)], tone = 1.15 + r() * 0.3;
    for (let f = 0; f < F; f++) for (let k = 0; k < 3; k++) {
      const vi = idx[f * 3 + k], o3 = (f * 3 + k) * 3; let sx = 0, sy = 0, sz = 0;
      for (const g of adj[vi]) if (fn[g * 3] * fn[f * 3] + fn[g * 3 + 1] * fn[f * 3 + 1] + fn[g * 3 + 2] * fn[f * 3 + 2] > cosC) { sx += fa[g * 3]; sy += fa[g * 3 + 1]; sz += fa[g * 3 + 2]; }
      const l = Math.hypot(sx, sy, sz) || 1;
      P[o3] = v[vi * 3]; P[o3 + 1] = v[vi * 3 + 1]; P[o3 + 2] = v[vi * 3 + 2]; N[o3] = sx / l; N[o3 + 1] = sy / l; N[o3 + 2] = sz / l;
      const big = aux[vi * 3], det = aux[vi * 3 + 1], rid = aux[vi * 3 + 2], up = Math.max(0, N[o3 + 1]);
      const g = tone * (0.78 + 0.42 * big) * (1 - 0.5 * Math.pow(rid, 5)) * (1 - 0.3 * Math.max(0, 0.45 - det)) * (1 + 0.32 * up * up) * (1 + 0.06 * Math.sin(P[o3 + 1] * 9 / shape[1] + big * 5));
      C[o3] = pal[0] * g; C[o3 + 1] = pal[1] * g; C[o3 + 2] = pal[2] * g;
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.setAttribute('color', new T.BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    return { geo, shape };
  }
  const SMALL = [[1, 0.8, 1], [1.2, 0.62, 1.05], [0.9, 1.15, 0.85], [1.35, 0.52, 0.95], [1.05, 0.86, 1.15], [1.15, 0.66, 0.9]];
  const BIG = [[1.1, 0.95, 1], [1.3, 0.78, 1.1], [0.95, 1.4, 0.9], [1.4, 0.82, 1.2]];

  /* where rocks go: big blocks on each headland's face and boulders round its foot, none on the strip of sand
     the van drives round on; boulders in the surf off the point and one or two sea stacks; clusters standing in
     the surf along the beach; strays on the sand */
  function rockPlan() {
    const out = [], r = rng(9091);
    const add = (x, y, z, s, kind, extra) => out.push(Object.assign({ x: base(x), y, z, s, kind, p: Math.floor(r() * 64), ry: r() * TAU, tx: (r() - 0.5) * 0.3, tz: (r() - 0.5) * 0.3, sy: 1 }, extra));
    SH.h.forEach(([hx, w], hi) => {
      const c = HC[hi], zt = Layout.shoreZ(hx) + c.gap, sz0 = Layout.shoreZ(hx);
      for (let i = 0, n = 0; i < 2500 && n < 36; i++) {
        const x = hx + (r() - 0.5) * w * 4.2, z = zt - 6 + r() * 48, [m, fp] = massifF(x, z);
        if (m < 0.25 || m > 5 * c.ht || fp > 0.75 || r() > Math.exp(-Math.max(0, z - zt) / 15)) continue;
        const s = 1.5 + r() * 3.2; if (z - s * 1.15 < corrTop(x)) continue;
        add(x, Math.max(0, m) - 0.42 * s, z, s, 'big'); n++;
      }
      /* boulders where the rock meets the sand */
      for (let i = 0, n = 0; i < 4000 && n < 60; i++) {
        const x = hx + (r() - 0.5) * w * 4.6, z = zt - 6 + r() * 30, [m, fp] = massifF(x, z);
        if (m > 0.9 || fp < 0.004) continue;
        const near = Math.exp(-(((x - hx) / (w * 1.2)) ** 2)); if (r() > 0.2 + 0.8 * near) continue;
        const s = (r() < 0.25 ? 1.1 + r() * 1.3 : 0.32 + r() * 0.8) * (0.7 + 0.5 * near);
        if (z - s * 1.15 < corrTop(x) && s > 0.3) continue;
        add(x, -0.12 * s + Math.max(0, m) * 0.6, z, s, s > 1.35 ? 'big' : 'small'); n++;
      }
      /* boulders in the surf off the point, beyond the sand the van can reach */
      for (let i = 0, n = 0; i < 3000 && n < 34; i++) {
        const x = hx + (r() - 0.5) * w * 2.8, sz = Layout.shoreZ(x), z = sz - 3.6 - Math.pow(r(), 1.4) * 15;
        const near = Math.exp(-(((x - hx) / w) ** 2)); if (r() > 0.25 + 0.75 * near) continue;
        const s = (r() < 0.3 ? 1.1 + r() * 1.2 : 0.4 + r() * 0.8) * (0.75 + 0.4 * near);
        if (z + s * 1.15 > sz - 3.2) continue;
        add(x, -0.3 * s, z, s, s > 1.35 ? 'big' : 'small'); n++;
      }
      /* the sea stacks: columns of rock standing off the point, each with a fallen block beside it */
      for (let k = 0; k < c.stacks; k++) {
        const sx = hx + (k ? (r() < 0.5 ? -1 : 1) * w * (0.6 + r() * 0.3) : (r() - 0.5) * w * 0.6), szs = sz0 - 10 - r() * 3 - k * 5, S = k ? 2.4 + r() * 0.6 : 3.3;
        add(sx, -0.9, szs, S, 'stack', { sy: k ? 1.7 : 2.0 }); add(sx + 3.0 * (S / 3.3), -0.5, szs + 1.4, 1.9 * S / 3.3, 'big'); add(sx - 2.2, -0.4, szs - 1.4, 1.2, 'small');
      }
    });
    /* surf rocks along the beach: the waves break round them. The ones near the camp as they always were,
       and more along the rest of the coast */
    const r2 = rng(9092), clusters = [[-34, -2.6, 6], [24.5, -2.3, 4], [-52, -3.2, 5], [46, -2.2, 4], [-74, -2.4, 5], [74, -2.0, 6], [-98, -2.8, 4], [100, -2.4, 5]];
    for (let x = 118; x < P - 118;) { if (!nearHead(x, 2.6)) clusters.push([x, -2.0 - r2() * 1.4, 3 + Math.floor(r2() * 4)]); x += 18 + r2() * 30; }
    for (const [cx, dz, n] of clusters) {
      for (let i = 0; i < n; i++) {
        const x = cx + (r2() - 0.5) * (i ? 6 : 1), z = Layout.shoreZ(x) + dz + (i ? (r2() - 0.5) * 2.6 : 0);
        if (i === 0) add(x, -0.2, z, 1.25 + r2() * 0.5, 'big', { p: [0, 2, 3][Math.floor(r2() * 3)] });
        else { const s = 0.4 + r2() * 0.8; add(x, -0.16 * s, z, s, 'small', { p: [0, 2, 4][Math.floor(r2() * 3)] }); }
      }
    }
    /* strays on the sand, kept clear of the camp and the van */
    const r3 = rng(9093);
    for (let i = 0; i < 220; i++) {
      const x = X0 + r3() * P; if (Math.abs(x - 0.6) < 13 || Math.abs(x + 7.6) < 5) continue;
      /* mostly up by the forest edge, fewer out on the open sand */
      const sz = Layout.shoreZ(x), vz = Layout.vegZ(x), z = vz - 0.4 - Math.pow(r3(), 1.8) * (vz - sz - 1.2);
      if (massif(x, z) > 0) continue;
      const s = 0.22 + r3() * 0.55; add(x, -0.07 * s, z, s, 'small', { p: [0, 2, 4][Math.floor(r3() * 3)] });
    }
    return out;
  }

  /* foam round rocks in the surf, and spray thrown up when a wave hits them; both timed to the real waves */
  const SURF_T = `
${GLSL.WAVEH}
/* seconds since the last crest reached this point, and how big it was */
vec2 lastHit(float x, float z){
  float g = shoreDZv(x), s = max((shoreZv(x) - z)/sqrt(1.0 + g*g), 0.0), t = uWaveT, tr = 99.0, A = 0.0;
  for (int j = 0; j < 6; j++){ vec4 W = uWv[j]; if (W.y <= 0.0) continue;
    float d = t - (W.x + 0.9*sin(x*0.11 + W.z) + x*0.03*W.w - s/WC); if (d > -0.05 && d < tr){ tr = d; A = W.y; } }
  for (int k = 0; k < 3; k++){ vec4 U = uUw[k]; if (U.y <= 0.0) continue;
    float T0 = U.x - s/CU, d = t - T0, a = userAmp(U, x, T0);
    if (d > -0.05 && d < 4.0 && a > 0.04){ tr = d; A = max(A, 1.0 + 2.4*a); } }
  return vec2(tr, A);
}`;
  const FOAM_VS = `
${SURF_T}
attribute vec2 aRock;
varying vec2 vUv; varying vec3 vW; varying vec2 vHit;
void main(){ vUv = uv; vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.0); vW = w.xyz; vHit = lastHit(aRock.x + modelMatrix[3].x, aRock.y + modelMatrix[3].z); gl_Position = projectionMatrix*viewMatrix*w; }`;
  const FOAM_FS = `
uniform float uTime; uniform vec3 uAmbF, uKeyColT; uniform sampler2D uNoise; uniform vec4 uFog;
varying vec2 vUv; varying vec3 vW; varying vec2 vHit;
void main(){
  vec2 q = vUv*2.0 - 1.0; float d = length(q);
  float surge = exp(-max(vHit.x, 0.0)*0.55)*min(vHit.y, 2.0);
  float ring = smoothstep(1.0, 0.7 - 0.25*surge, d)*smoothstep(0.30, 0.55, d);
  float n = texture2D(uNoise, vW.xz*0.33 + vec2(uTime*0.012, -uTime*0.008)).r*0.6 + texture2D(uNoise, vW.xz*1.1 - vec2(uTime*0.02, 0.0)).a*0.4;
  float a = ring*smoothstep(0.5 - 0.3*surge, 0.68, n)*(0.22 + 0.8*min(surge, 1.0));
  if (a < 0.01) discard;
  float fd = distance(vW, cameraPosition);
  vec3 c = mix((uAmbF*1.6 + uKeyColT*0.55)*(0.85 + 0.3*n), uFog.rgb, 1.0 - exp(-max(fd - 40.0, 0.0)/(700.0/max(uFog.w, 0.3))));
  gl_FragColor = vec4(c, a*0.85);
}`;
  const SPRAY_VS = `
${SURF_T}
attribute vec4 aRock; attribute vec4 aSeed;
varying vec2 vUv; varying float vA; varying vec3 vWP; varying float vMist;
void main(){
  vUv = uv;
  float x = aRock.x + modelMatrix[3].x, z = aRock.y + modelMatrix[3].z, top = aRock.z, rad = aRock.w;   /* this copy of the stretch */
  vec2 hit = lastHit(x, z);
  float g = shoreDZv(x), s = max((shoreZv(x) - z)/sqrt(1.0 + g*g), 0.0);
  float nA = 0.5 + 0.24*sin(x*0.19 + 1.3) + 0.18*sin(x*0.071 + 0.4) + 0.12*sin(x*0.53 + 2.0), sb = 3.0 + 7.0*nA*hit.y;
  float k = hit.y*(0.45 + 0.55*smoothstep(sb + 7.0, sb - 1.0, s));
  float life = 0.8 + 0.9*aSeed.z, tt = hit.x - aSeed.w*0.3;
  float on = step(0.0, tt)*step(tt, life), sk = sqrt(max(k, 0.0));
  vec3 dir = normalize(vec3(-g, 0.0, 1.0)), side = vec3(dir.z, 0.0, -dir.x);
  float lat = aSeed.y*2.0 - 1.0;
  vec3 p0 = vec3(x, top*(0.3 + 0.55*aSeed.x), z) - dir*rad*0.7 + side*lat*rad*0.75;
  vec3 vel = vec3(0.0, (1.6 + 3.8*aSeed.x)*sk, 0.0) + dir*(0.5 + 1.8*aSeed.z)*sk + side*lat*1.5*sk;
  vec3 c = p0 + vel*tt + vec3(0.0, -4.9*tt*tt, 0.0);
  float mist = step(0.83, fract(aSeed.w*7.13)); vMist = mist;
  c.y += mist*0.9*tt*tt;                                   /* mist is carried, droplets fall */
  float u = clamp(tt/(life*(1.0 + 0.8*mist)), 0.0, 1.0);
  float size = mix(0.035 + 0.06*aSeed.x + 0.03*u, (0.3 + 1.1*u)*rad*0.75, mist)*(0.7 + 0.3*min(k, 2.5));
  vA = on*mix(1.0 - u*u, 0.5*(1.0 - u)*(1.0 - u), mist)*min(k, 1.0)*smoothstep(-0.4, 0.15, c.y);
  /* droplets are drawn as short streaks along their motion, as a camera would see them */
  vec3 vNow = mat3(viewMatrix)*(vel + vec3(0.0, (mist*1.8 - 9.8)*tt, 0.0));
  float L = length(vNow.xy); vec2 ax = L > 1e-4 ? vNow.xy/L : vec2(0.0, 1.0), ay = vec2(-ax.y, ax.x);
  float streak = 1.0 + (1.0 - mist)*L*0.045/size;
  vec2 q = uv - 0.5;
  vec4 mv = viewMatrix*vec4(c, 1.0); mv.xy += ax*q.y*size*streak + ay*q.x*size; vWP = c;
  gl_Position = vA < 0.003 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
}`;
  const SPRAY_FS = `
uniform vec3 uAmbF, uKeyColT; uniform sampler2D uNoise; uniform vec4 uFog;
varying vec2 vUv; varying float vA; varying vec3 vWP; varying float vMist;
void main(){
  vec2 q = vUv*2.0 - 1.0; float d = dot(q, q); if (d > 1.0) discard;
  float n = texture2D(uNoise, vUv*0.45 + vWP.xz*0.05).r;
  float a = vA*mix(smoothstep(1.0, 0.15, d), (1.0 - d)*(1.0 - d)*(0.35 + 0.9*n), vMist);
  if (a < 0.004) discard;
  float fd = distance(vWP, cameraPosition);
  vec3 c = mix(uAmbF*1.8 + uKeyColT*0.65, uFog.rgb, 1.0 - exp(-max(fd - 40.0, 0.0)/(700.0/max(uFog.w, 0.3))));
  gl_FragColor = vec4(c, a*0.8);
}`;

  /* the rocks of the stretch, instanced chunk by chunk, with foam round the ones standing in the sea and the spray they throw up */
  function rocks(U, noiseTex) {
    const plan = rockPlan();
    const small = SMALL.map((sh, i) => rockProto(31 + i * 17, sh, 2)), big = BIG.map((sh, i) => rockProto(301 + i * 23, sh, 3)), stack = rockProto(777, [1.2, 1.0, 1.1], 3, { top: 0.6 });
    /* the same rocks in fewer facets, for the copies further off */
    const far = new Map([...small.map((p, i) => [p, rockProto(31 + i * 17, SMALL[i], 1)]), ...big.map((p, i) => [p, rockProto(301 + i * 23, BIG[i], 2)]), [stack, rockProto(777, [1.2, 1.0, 1.1], 2, { top: 0.6 })]]);
    const mat = Mats.lit({ vertexColors: true, roughness: 0.86 }, 'rockw');
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3();
    for (const p of plan) { p.proto = p.kind === 'stack' ? stack : p.kind === 'big' ? big[p.p % big.length] : small[p.p % small.length]; p.c = Math.min(NC - 1, Math.floor((p.x - X0) / CW)); }
    const groups = Array.from({ length: NC }, () => ({ rk: new T.Group(), rkFar: new T.Group(), fx: new T.Group() }));
    const wet = plan.filter(p => p.z < Layout.shoreZ(p.x) + 0.5 && p.s > 0.4).map(p => ({ x: p.x, z: p.z, c: p.c, top: Math.max(0.3, p.y + p.s * p.proto.shape[1] * p.sy * 0.9), rad: p.s * 0.9 * (p.proto.shape[0] + p.proto.shape[2]) / 2 }));
    const surfU = { uWaveT: U.uWaveT, uWv: U.uWv, uUw: U.uUw, uTime: Mats.U.uTime, uAmbF: Mats.U.uAmbF, uKeyColT: Mats.U.uKeyColT, uFog: Mats.U.uFog, uNoise: { value: noiseTex } };
    const fm = new T.ShaderMaterial({ uniforms: surfU, vertexShader: FOAM_VS, fragmentShader: FOAM_FS, transparent: true, depthWrite: false });
    const sprayM = new T.ShaderMaterial({ uniforms: surfU, vertexShader: SPRAY_VS, fragmentShader: SPRAY_FS, transparent: true, depthWrite: false });
    const fg = new T.PlaneGeometry(1, 1); fg.rotateX(-Math.PI / 2);
    const quad = new T.PlaneGeometry(1, 1), NP = 48, rr = rng(5150);
    for (let c = 0; c < NC; c++) {
      const L = plan.filter(p => p.c === c), by = new Map();
      for (const p of L) { if (!by.has(p.proto)) by.set(p.proto, []); by.get(p.proto).push(p); }
      for (const [proto, list] of by) {
        const inst = new T.InstancedMesh(proto.geo, mat, list.length);
        list.forEach((p, i) => { e.set(p.tx, p.ry, p.tz); q.setFromEuler(e); sc.set(p.s, p.s * p.sy, p.s); pos.set(p.x, p.y, p.z); m4.compose(pos, q, sc); inst.setMatrixAt(i, m4); });
        inst.castShadow = inst.receiveShadow = true; inst.computeBoundingSphere(); groups[c].rk.add(inst);
        const fi = new T.InstancedMesh(far.get(proto).geo, mat, 0); fi.instanceMatrix = inst.instanceMatrix; fi.count = list.length; fi.computeBoundingSphere(); groups[c].rkFar.add(fi);
      }
      const W = wet.filter(p => p.c === c); if (!W.length) continue;
      /* foam rings round each rock in the water */
      const g = fg.clone(), ar = new Float32Array(W.length * 2); W.forEach((p, i) => { ar[i * 2] = p.x; ar[i * 2 + 1] = p.z; });
      g.setAttribute('aRock', new T.InstancedBufferAttribute(ar, 2));
      const foam = new T.InstancedMesh(g, fm, W.length);
      W.forEach((p, i) => { const R = p.rad * 2.0 + 0.8; m4.compose(pos.set(p.x, 0.07, p.z), q.identity(), sc.set(R, 1, R)); foam.setMatrixAt(i, m4); });
      foam.renderOrder = 5; foam.frustumCulled = false; groups[c].fx.add(foam);
      /* spray: a few dozen soft blobs per rock, thrown up along ballistic arcs when a crest arrives */
      const n = W.length * NP, sg = new T.InstancedBufferGeometry();
      sg.index = quad.index; sg.setAttribute('position', quad.attributes.position); sg.setAttribute('uv', quad.attributes.uv);
      const aR = new Float32Array(n * 4), aS = new Float32Array(n * 4);
      W.forEach((p, i) => { for (let j = 0; j < NP; j++) { const k = (i * NP + j) * 4; aR.set([p.x, p.z, p.top, p.rad], k); aS.set([rr(), rr(), rr(), rr()], k); } });
      sg.setAttribute('aRock', new T.InstancedBufferAttribute(aR, 4)); sg.setAttribute('aSeed', new T.InstancedBufferAttribute(aS, 4)); sg.instanceCount = n;
      const spray = new T.Mesh(sg, sprayM); spray.frustumCulled = false; spray.renderOrder = 6; groups[c].fx.add(spray);
    }
    /* obstacles for the van: anything big enough to stop it */
    const obstacles = plan.filter(p => p.s > 0.5 || p.kind !== 'small').map(p => [p.x, p.z, p.s * 0.82 * (p.proto.shape[0] + p.proto.shape[2]) / 2, 'rock']);
    return { plan, obstacles, wet, groups };
  }

  /* ── grids along the stretch: x positions with every chunk boundary on them, finer near the headlands ── */
  function axis(spans) { const out = []; for (const [a, b, s] of spans) for (let v = a; v < b - 1e-6; v += s) out.push(v); out.push(spans[spans.length - 1][1]); return out; }
  function xAxis(stepNear, stepFar, nearK) {
    const out = [], starts = [];
    for (let c = 0; c < NC; c++) {
      const a = X0 + c * CW, b = a + CW; starts.push(out.length);
      for (let x = a; x < b - 1e-6;) { out.push(x); x = Math.min(b, x + (nearHead(x, nearK) ? stepNear : stepFar)); }
    }
    out.push(X0 + P); starts.push(out.length - 1);
    return { xs: out, starts };
  }
  /* chunk c's columns, plus one more on each side (from the neighbouring chunks, across the seam of the stretch too),
     so normals at the edges come out as the neighbour computes them and the chunks join without a crease */
  function cols(ax, c) {
    const { xs, starts } = ax, n = xs.length - 1, i0 = starts[c], i1 = starts[c + 1];
    const before = i0 > 0 ? xs[i0 - 1] : xs[n - 1] - P, after = i1 < n ? xs[i1 + 1] : xs[1] + P;
    return [before, ...xs.slice(i0, i1 + 1), after];
  }
  /* an indexed grid: normals from every cell, drawn without the extra columns (and without cells keep() rejects) */
  function grid(Pa, nx, nz, keep) {
    const all = [], inner = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      all.push(a, c, b, b, c, d);
      if (i > 0 && i < nx - 2 && (!keep || keep(a, b, c, d))) inner.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(Pa, 3));
    g.setIndex(all); g.computeVertexNormals(); g.setIndex(inner);
    return g;
  }

  /* ── ground beyond the sand: hills and headlands, fine where the rock is ── */
  const TX = xAxis(1, 4, 3.4), TZ = axis([[-36, 30, 1], [30, 70, 2.5], [70, 340, 6], [340, 700, 15]]);
  const TXc = xAxis(3, 8, 3.4), TZc = axis([[-36, 30, 2], [30, 70, 5], [70, 340, 12], [340, 700, 30]]);    /* the same ground, far away */
  const landMat = () => landMat.m || (landMat.m = Mats.lit({ vertexColors: true, roughness: 0.95 }, 'land'));
  function terrainChunk(c, coarse) {
    const TZ_ = coarse ? TZc : TZ, xs = cols(coarse ? TXc : TX, c), nx = xs.length, nz = TZ_.length, NV = nx * nz, Pa = new Float32Array(NV * 3), MS = new Float32Array(NV), HL = new Float32Array(NV);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = xs[i], z = TZ_[j], hl = hill(x, z), m = massif(x, z);
      /* sunk a little, so it rises out of the sand along a clean line instead of lying flush with it */
      /* (far off, what is under water is pushed well down, so it can't flicker through the sea at the depth buffer's coarse range) */
      Pa[k * 3] = x; Pa[k * 3 + 1] = Math.max(coarse ? -2.5 : -0.6, Math.max(hl, m) - 0.22); Pa[k * 3 + 2] = z; MS[k] = m; HL[k] = hl;
    }
    const g = grid(Pa, nx, nz, (a, b, cc, d) => !(Pa[a * 3 + 1] < 0 && Pa[b * 3 + 1] < 0 && Pa[cc * 3 + 1] < 0 && Pa[d * 3 + 1] < 0));
    const N = g.attributes.normal.array, C = new Float32Array(NV * 3), RK = new Float32Array(NV);
    for (let k = 0; k < NV; k++) {
      const x = Pa[k * 3], z = Pa[k * 3 + 2], ny = N[k * 3 + 1], m = MS[k];
      const onM = m > 0.08 && m >= HL[k] - 0.3 ? 1 : 0;
      let rock = Math.min(1, onM * (0.5 + 3.0 * (1 - ny)) + sm(0.74, 0.5, ny));
      if (onM && m > 2.4 && ny > 0.9) rock *= 0.3;
      const n = fbmX(x, z, 0.08, 0.5, 3), n2 = fbmX(x, z, 0.25, 3.0, 2);
      const vg = [0.034 * (0.7 + 0.6 * n), 0.047 * (0.7 + 0.6 * n), 0.022 * (0.75 + 0.5 * n)], rc = [0.14 * (0.7 + 0.6 * n2), 0.128 * (0.7 + 0.6 * n2), 0.112 * (0.7 + 0.6 * n2)];
      for (let q = 0; q < 3; q++) C[k * 3 + q] = vg[q] + (rc[q] - vg[q]) * rock;
      RK[k] = rock;
    }
    g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('aRock', new T.BufferAttribute(RK, 1));
    g.computeBoundingSphere();
    const m = new T.Mesh(g, landMat()); m.receiveShadow = true; return m;
  }

  /* the canopy: a blanket of tree crowns over the hills behind the front rows of real trees.
     By the camp it stands back to leave the clearing; elsewhere it comes down to the forest edge */
  const CX = xAxis(2, 2, 0), DS = axis([[0, 50, 2], [50, 130, 4], [130, 420, 10]]);
  const CXc = xAxis(4, 4, 0), DSc = axis([[0, 50, 4], [50, 130, 8], [130, 420, 20]]);
  const canMat = () => canMat.m || (canMat.m = Mats.lit({ vertexColors: true, roughness: 0.92 }, 'canopy'));
  function canopyChunk(c, camp, coarse) {
    const DS_ = coarse ? DSc : DS, xs = cols(coarse ? CXc : CX, c), nx = xs.length, nd = DS_.length, Pa = new Float32Array(nx * nd * 3), C = new Float32Array(nx * nd * 3);
    const D0 = x => 13 + 7 * vnX(x, 0, 0.045, 1.5) + 0.9 * Layout.head(x) + (camp ? 26 * (1 - sm(22, 36, Math.abs(x - 0.6))) : 0);
    for (let i = 0; i < nx; i++) {
      const x = xs[i], z0 = Layout.vegZ(x) + D0(x);
      for (let j = 0; j < nd; j++) {
        const d = DS_[j], z = z0 + d, k = (j * nx + i) * 3, bse = land(x, z);
        const ramp = sm(0, 10, d) * sm(420, 380, d), far = sm(70, 200, d);
        const [f1, id] = cell2P(x, z, 190, 3.0), bump = Math.max(0, 1 - f1 * f1 * 1.6);
        const hc = (6 + 5 * fbmX(x, z, 0.017, 3.3, 3)) * ramp;
        Pa[k] = x; Pa[k + 1] = bse + 0.15 + hc + (bump * 2.8 - 0.9) * ramp * (1 - 0.7 * far); Pa[k + 2] = z;
        const hue = h3(id * 13.1, 2.0, 5.0), lum = (0.55 + 0.6 * bump * (1 - 0.6 * far)) * (0.55 + 0.45 * ramp) * (0.85 + 0.3 * id);
        C[k] = (0.028 + 0.022 * hue) * lum; C[k + 1] = (0.050 + 0.018 * id) * lum; C[k + 2] = (0.020 + 0.008 * hue) * lum;
      }
    }
    const g = grid(Pa, nx, nd); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.computeBoundingSphere();
    return new T.Mesh(g, canMat());
  }

  /* ── the front rows of the forest: merged prototypes of palms, broadleaf trees, bushes and ferns ── */
  function merge(parts) {
    let nv = 0, ni = 0; for (const { g } of parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new Uint32Array(ni);
    let ov = 0, oi = 0; const v = new T.Vector3(), nm = new T.Matrix3();
    for (const { g, m } of parts) {
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv; nm.getNormalMatrix(m);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(ov + i) * 3] = v.x; P[(ov + i) * 3 + 1] = v.y; P[(ov + i) * 3 + 2] = v.z;
        if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(ov + i) * 3] = v.x; N[(ov + i) * 3 + 1] = v.y; N[(ov + i) * 3 + 2] = v.z; }
        if (ua) { UV[(ov + i) * 2] = ua.getX(i); UV[(ov + i) * 2 + 1] = ua.getY(i); }
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[oi + i] = g.index.getX(i) + ov; else for (let i = 0; i < pa.count; i++) I[oi + i] = ov + i;
      ov += pa.count; oi += g.index ? g.index.count : pa.count;
    }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(P, 3)); out.setAttribute('normal', new T.BufferAttribute(N, 3)); out.setAttribute('uv', new T.BufferAttribute(UV, 2)); out.setIndex(new T.BufferAttribute(I, 1));
    out.computeBoundingSphere(); return out;
  }
  const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz, 'YXZ')), new T.Vector3(s, s, s));

  function palmProto(seed, tall, lite) {
    const r = rng(seed), h = tall ? 11 + r() * 3 : 6.5 + r() * 4, lx = (r() - 0.5) * (tall ? 3.2 : 2.4), lz = (r() - 0.5) * (tall ? 3.2 : 2.4), cr = (tall ? 2.8 : 3.0) + r() * 0.6;
    const curve = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(lx * 0.1, h * 0.34, lz * 0.1), new T.Vector3(lx * 0.48, h * 0.7, lz * 0.48), new T.Vector3(lx, h, lz)]);
    const bark = [{ g: Nature.taperTube(curve, lite ? 6 : 14, lite ? 5 : 7, t => (0.26 - 0.1 * t) * (1 + 0.5 * Math.exp(-t * 14)), 0.5), m: M() }];
    const fA = [], fB = [], dry = [];
    const nf = 16 + Math.floor(r() * 4);
    /* far away: every other frond, a little wider, in fewer segments, all on one texture (same draws, so it matches up close) */
    for (let i = 0; i < nf; i++) {
      const az = i * 2.39996 + r() * 0.2, age = i / nf, rise = 1.6 - age * 1.7, droop = 0.18 + age * 0.85 + r() * 0.15;
      const len = cr * (0.72 + 0.32 * Math.sin(Math.PI * Math.min(1, age * 1.2 + 0.15)));
      const side = r() < 0.5 ? fA : fB, wd = 1.35 + r() * 0.35, m = M(lx, h + 0.05 - age * 0.25, lz, (r() - 0.5) * 0.5, az, 0);
      if (!lite) side.push({ g: Nature.frondGeo(len, wd, rise, droop, 7), m });
      else if (i % 2 === 0) fA.push({ g: Nature.frondGeo(len, wd * 1.3, rise, droop, 4), m });
    }
    if (!lite) for (let i = 0; i < 3; i++) dry.push({ g: Nature.frondGeo(cr * 0.75, 1.0, -0.5, 1.1, 6), m: M(lx, h - 0.4, lz, 0, r() * TAU, 0) });
    return lite ? { bark: merge(bark), fA: merge(fA) } : { bark: merge(bark), fA: merge(fA), fB: merge(fB), dry: merge(dry) };
  }
  function cardCloud(clusters, density, card, r) {
    const sets = [[], [], []], q = new T.Quaternion(), e = new T.Euler(), base = new T.PlaneGeometry(1, 1);
    for (const [c, cr, flat] of clusters) {
      const n = Math.max(3, Math.round(density * cr * cr));
      for (let i = 0; i < n; i++) {
        let ux, uy, uz; do { ux = r() * 2 - 1; uy = r() * 2 - 1; uz = r() * 2 - 1; } while (ux * ux + uy * uy + uz * uz > 1);
        e.set(-Math.PI / 2 + (r() - 0.5) * 1.3 + uy * 0.4, r() * TAU, (r() - 0.5) * 0.9); q.setFromEuler(e);
        const s = (0.7 + r() * 0.55) * card;
        sets[Math.floor(r() * 3)].push({ g: base, m: new T.Matrix4().compose(new T.Vector3(c.x + ux * cr, Math.max(0.12, c.y + uy * cr * flat), c.z + uz * cr), q.clone(), new T.Vector3(s, s, s)) });
      }
    }
    return sets.map(merge);
  }
  function treeProto(seed, lite) {
    const r = rng(seed), R = 2.5 + r() * 1.3, Hc = 4.4 + r() * 2.8, bark = [], clusters = [];
    const top = new T.Vector3((r() - 0.5) * 0.5, Hc * 0.62, (r() - 0.5) * 0.5);
    bark.push({ g: Nature.taperTube(new T.CatmullRomCurve3([new T.Vector3(0, -0.3, 0), new T.Vector3((r() - 0.5) * 0.4, Hc * 0.3, (r() - 0.5) * 0.4), top]), 8, 6, t => 0.26 - 0.12 * t, 1), m: M() });
    const nb = 5 + Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) {
      const a = i / nb * TAU + r() * 0.6, rr = R * (0.45 + r() * 0.45), up = Hc * (0.62 + r() * 0.4), end = new T.Vector3(Math.cos(a) * rr, up, Math.sin(a) * rr * 0.85);
      if (!lite) bark.push({ g: Nature.taperTube(new T.CatmullRomCurve3([top.clone(), top.clone().lerp(end, 0.5).add(new T.Vector3(0, 0.3, 0)), end]), 5, 4, t => 0.1 - 0.06 * t, 1), m: M() });
      clusters.push([end, R * (0.46 + r() * 0.2), 0.4]);
    }
    clusters.push([new T.Vector3(0, Hc * 1.02, 0), R * 0.6, 0.42]);
    /* far away a tree needs far fewer, bigger leaf cards to read as the same crown */
    const [c0, c1, c2] = lite ? cardCloud(clusters, 5.5, 3.1, r) : cardCloud(clusters, 17, 1.9, r);
    return { bark: merge(bark), c0, c1, c2 };
  }
  function bushProto(seed, R, Hc, density = 22, card = 1.15) { const r = rng(seed); const [c0, c1, c2] = cardCloud([[new T.Vector3(0, Hc * 0.55, 0), R, Hc * 0.75 / R]], density, card, r); return { c0, c1, c2 }; }

  /* ── the forest: scattered once over the stretch (with the camp's clearing kept), plus the trees that fill
     the clearing in every copy but the camp's own; instanced chunk by chunk, near and far ── */
  function forest() {
    const fol = (seed, pal, cut = 0.5) => [0, 1, 2].map(k => Mats.foliage(Mats.tex(Paint.leafCard(seed + k * 7, k === 2 ? pal : null)), cut, [1, 1, 1], true));
    const frondT = [Mats.tex(Paint.frond(31)), Mats.tex(Paint.frond(47)), Mats.tex(Paint.frond(59, 1))].map(t => Mats.foliage(t, 0.4, [1, 1, 1], true));
    const barkP = Mats.lit({ map: Mats.tex(Paint.bark(5), { repeat: true }), roughness: 0.95 }), barkT = Mats.lit({ color: new T.Color('#4a3a2d'), roughness: 0.95 });
    const treeM = fol(71, ['#2b4a22', '#35592a', '#24401e', '#3f6530']), bushM = fol(83, ['#3a5a2a', '#46682f', '#2f4a24', '#557a36']), fernM = fol(97, ['#2f5226', '#3b6a2c', '#294a20', '#4a7a33']);
    const Pr = { palm: [11, 23, 37].map(s => palmProto(s)), tall: [43, 61].map(s => palmProto(s, true)), tree: [51, 67, 89].map(s => treeProto(s)),
      bush: [[13, 1.6, 1.3], [29, 1.9, 1.6], [41, 1.3, 1.0]].map(a => bushProto(...a)), fern: [[5, 0.55, 0.5, 30, 0.8], [7, 0.7, 0.6, 30, 0.8]].map(a => bushProto(...a)) };
    const lite = { tree: [51, 67, 89].map(s => treeProto(s, true)), palm: [11, 23, 37].map(s => palmProto(s, false, true)), tall: [43, 61].map(s => palmProto(s, true, true)) };
    /* scatter with a spatial grid per kind so nothing crowds (across the seam of the stretch too) */
    const r = rng(777), lists = { palm: [], tall: [], tree: [], bush: [], fern: [] }, fill = { palm: [], tall: [], tree: [], bush: [], fern: [] }, grids = {};
    const clear = (x, z) => (Math.abs(x) < 17 && z < 30) || (Math.abs(x - 0.6) < 10 && z < Layout.vegZ(x) + 6);
    const freeAt = (kind, x, z, gap) => {
      const G = grids[kind] || (grids[kind] = new Map()), gx = Math.floor(x / gap), gz = Math.floor(z / gap);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = G.get((gx + i) + ',' + (gz + j)); if (c) for (const p of c) if ((p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap) return false; }
      return true;
    };
    const free = (kind, x, z, gap) => freeAt(kind, x, z, gap) && (x - X0 > gap || freeAt(kind, x + P, z, gap)) && (X0 + P - x > gap || freeAt(kind, x - P, z, gap));
    const put = (kind, x, z, gap, into = lists) => {
      x = base(x);
      const G = grids[kind] || (grids[kind] = new Map()), key = Math.floor(x / gap) + ',' + Math.floor(z / gap);
      const p = { x, z, y: land(x, z), ry: r() * TAU, s: 0.8 + r() * 0.45, v: Math.floor(r() * 3) };
      into[kind].push(p); if (into === lists) { if (!G.has(key)) G.set(key, []); G.get(key).push(p); }
    };
    const ok = (x, z) => massif(x, z) <= 0.25 && slope(x, z) <= 0.55;
    const K = P / 470;      /* the old bay held this many per 470 m */
    const place = (kind, n, d0, d1, gap) => {
      for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
        const x = X0 + r() * P, depth = d0 + Math.pow(r(), 1.3) * (d1 - d0), z = Layout.vegZ(x) + depth;
        if (clear(x, z) || !ok(x, z) || !free(kind, x, z, gap)) continue;
        put(kind, x, z, gap); i++;
      }
    };
    const SPEC = [['palm', 300, 0.3, 24, 3.0], ['tall', 60, 8, 40, 7], ['tree', 520, 3, 42, 4.2], ['bush', 640, 0.1, 26, 2.0], ['fern', 900, 0.0, 16, 0.9]];
    for (const [kind, n, d0, d1, gap] of SPEC) place(kind, Math.round(n * K), d0, d1, gap);
    /* scrub and a few palms on the headlands' flatter tops */
    SH.h.forEach(([hx, w], hi) => {
      const zt = Layout.shoreZ(hx) + HC[hi].gap;
      for (const [kind, n, gap] of [['bush', 70, 2.2], ['palm', 14, 3.5], ['tree', 16, 4.5], ['fern', 60, 1.0]]) {
        for (let i = 0, tries = 0; i < n && tries < n * 60; tries++) {
          const x = hx + (r() - 0.5) * w * 3.6, z = zt + 2 + r() * 40, m = massif(x, z);
          if (m < 2.0 || m < hill(x, z) || slope(x, z) > 0.45 || !free(kind, base(x), z, gap)) continue;
          put(kind, x, z, gap); i++;
        }
      }
    });
    /* the clearing, wooded, for every copy of the stretch but the camp's own */
    for (const [kind, n, d0, d1, gap] of SPEC) {
      const want = Math.round(n * 60 / 470 * 1.15);
      for (let i = 0, tries = 0; i < want && tries < want * 60; tries++) {
        const x = -36 + r() * 72, depth = d0 + Math.pow(r(), 1.3) * (d1 - d0), z = Layout.vegZ(x) + depth;
        if (!clear(x, z) || !ok(x, z) || !free(kind, x, z, gap) || fill[kind].some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap)) continue;
        put(kind, x, z, gap, fill); i++;
      }
    }
    /* instanced per chunk: near (everything), and far (palms and lighter trees) */
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3();
    const matrices = list => { const a = new T.InstancedBufferAttribute(new Float32Array(list.length * 16), 16); list.forEach((p, i) => { e.set(0, p.ry, 0); q.setFromEuler(e); sc.setScalar(p.s); pos.set(p.x, Math.max(-0.05, p.y), p.z); m4.compose(pos, q, sc); m4.toArray(a.array, i * 16); }); return a; };
    const inst = (geo, mat, attr, n) => { const im = new T.InstancedMesh(geo, mat, 0); im.instanceMatrix = attr; im.count = n; im.computeBoundingSphere(); return im; };
    const parts = { palm: [['bark', barkP], ['fA', frondT[0]], ['fB', frondT[1]], ['dry', frondT[2]]], tree: [['bark', barkT], ['c0', treeM[0]], ['c1', treeM[1]], ['c2', treeM[2]]], bush: [['c0', bushM[0]], ['c1', bushM[1]], ['c2', bushM[2]]], fern: [['c0', fernM[0]], ['c1', fernM[1]], ['c2', fernM[2]]] };
    parts.tall = parts.palm;
    const farParts = { palm: [['bark', barkP], ['fA', frondT[0]]], tall: [['bark', barkP], ['fA', frondT[0]]], tree: [['bark', barkT], ['c0', treeM[0]], ['c1', treeM[1]], ['c2', treeM[2]]] };
    function chunk(c, withFill) {
      const near = new T.Group(), far = new T.Group(), x0 = X0 + c * CW, x1 = x0 + CW;
      for (const kind of Object.keys(lists)) {
        const all = lists[kind].filter(p => p.x >= x0 && p.x < x1).concat(withFill ? fill[kind] : []);
        for (let v = 0; v < Pr[kind].length; v++) {
          const L = all.filter(p => p.v % Pr[kind].length === v); if (!L.length) continue;
          const attr = matrices(L);
          for (const [part, mat] of parts[kind]) near.add(inst(Pr[kind][v][part], mat, attr, L.length));
          if (farParts[kind]) for (const [part, mat] of farParts[kind]) far.add(inst((lite[kind] || Pr[kind])[v][part], mat, attr, L.length));
        }
      }
      return { near, far };
    }
    /* what the van can't drive through: trunks near the forest edge */
    const trunks = L => { const o = []; for (const p of L.palm) if (p.z < Layout.vegZ(p.x) + 3) o.push([p.x, p.z, 0.35, 'tree']); for (const p of L.tree) if (p.z < Layout.vegZ(p.x) + 6) o.push([p.x, p.z, 0.45, 'tree']); return o; };
    const count = L => Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.length]));
    return { chunk, obstacles: trunks(lists), fillObstacles: trunks(fill), counts: count(lists), fillCounts: count(fill) };
  }

  /* ── copies of the stretch around the camera ── */
  /* a copy of an object tree that shares geometry, materials and instance data with the original */
  function share(o) {
    let c;
    if (o.isInstancedMesh) { c = new T.InstancedMesh(o.geometry, o.material, 0); c.instanceMatrix = o.instanceMatrix; c.instanceColor = o.instanceColor; c.count = o.count; c.boundingSphere = o.boundingSphere; c.boundingBox = o.boundingBox;
      if (o.userData.liveCount) Object.defineProperty(c, 'count', { get: () => o.count, set: () => {}, configurable: true }); }   /* (shells: how many show is set once, on the original) */
    else if (o.isMesh) c = new T.Mesh(o.geometry, o.material);
    else c = new T.Group();
    c.castShadow = o.castShadow; c.receiveShadow = o.receiveShadow; c.renderOrder = o.renderOrder; c.frustumCulled = o.frustumCulled; c.visible = o.visible;
    c.matrixAutoUpdate = false;
    for (const ch of o.children) c.add(share(ch));
    return c;
  }

  function build(root, U, noiseTex) {
    const t0 = performance.now();
    const rk = rocks(U, noiseTex), fo = forest();
    /* the chunk templates: 0..NC-1 as built, and NC: chunk 0 again with the clearing wooded */
    const defs = [];
    for (let c = 0; c <= NC; c++) {
      const cc = c === NC ? 0 : c, camp = c === 0;
      const ground = c === NC ? new T.Mesh(defs[0].ground.geometry, defs[0].ground.material) : terrainChunk(cc);
      const groundFar = c === NC ? new T.Mesh(defs[0].groundFar.geometry, defs[0].groundFar.material) : terrainChunk(cc, true);
      ground.receiveShadow = true;
      const tree = fo.chunk(cc, c === NC);
      const d = { c: cc, alt: c === NC, x0: X0 + cc * CW, ground, groundFar, base: new T.Group(), baseFar: new T.Group(), rk: new T.Group(), rkFar: new T.Group(), fx: rk.groups[cc].fx, near: tree.near, far: tree.far, tiny: new T.Group() };
      d.base.add(ground, canopyChunk(cc, camp)); d.baseFar.add(groundFar, canopyChunk(cc, camp, true));
      for (const o of rk.groups[cc].rk.children.slice()) d.rk.add(c === NC ? share(o) : o);
      for (const o of rk.groups[cc].rkFar.children.slice()) d.rkFar.add(c === NC ? share(o) : o);
      if (c === NC) { d.fx = share(rk.groups[0].fx); for (const o of d.fx.children) o.matrixAutoUpdate = true; }
      defs.push(d);
    }
    const worldG = new T.Group(); worldG.name = 'world'; worldG.matrixAutoUpdate = false; root.add(worldG);
    const pools = defs.map(() => ({ live: new Map(), free: [] }));
    function makeSlot(d) {
      const s = { root: new T.Group() }; for (const k of ['base', 'baseFar', 'rk', 'rkFar', 'fx', 'near', 'far', 'tiny']) { s[k] = share(d[k]); s.root.add(s[k]); }
      s.root.matrixAutoUpdate = false; worldG.add(s.root); return s;
    }
    let lastKey = '';
    /* lay the chunks out around the camera: which copies, and how much of each to draw */
    function follow(cx) {
      const kc = Math.floor((cx - X0) / P), want = new Map(), lods = [];
      for (let k = kc - 2; k <= kc + 2; k++) for (let c = 0; c < NC; c++) {
        const x0 = k * P + X0 + c * CW, d = Math.max(0, Math.abs(x0 + CW / 2 - cx) - CW / 2);
        if (d > LOD.view) continue;
        const di = c === 0 && k !== 0 ? NC : c;
        want.set(di + ':' + k, [di, k, d]);
      }
      pools.forEach((pl, di) => { for (const [k, s] of pl.live) if (!want.has(di + ':' + k)) { s.root.visible = false; pl.live.delete(k); pl.free.push(s); } });
      for (const [, [di, k, d]] of want) {
        const pl = pools[di]; let s = pl.live.get(k);
        if (!s) { s = pl.free.pop() || makeSlot(defs[di]); pl.live.set(k, s); s.root.position.x = k * P; s.root.updateMatrix(); s.root.visible = true; }
        s.base.visible = d < LOD.fine; s.baseFar.visible = d >= LOD.fine; s.rk.visible = d < LOD.near; s.rkFar.visible = d >= LOD.near && d < LOD.rocks; s.fx.visible = s.near.visible = d < LOD.near; s.far.visible = d >= LOD.near && d < LOD.mid; s.tiny.visible = d < LOD.tiny;
      }
    }
    const counts = Object.assign({}, fo.counts, { rocks: rk.plan.length, wet: rk.wet.length, fill: Object.values(fo.fillCounts).reduce((a, b) => a + b, 0), ms: 0 });
    counts.ms = Math.round(performance.now() - t0);
    return { obstacles: rk.obstacles.concat(fo.obstacles), fillObstacles: fo.fillObstacles, rocks: rk.plan, wet: rk.wet, counts, hill, land, massif, follow, chunks: defs, P, X0, CW, NC, base, wrapD,
      get slots() { return pools.reduce((a, p) => a + p.live.size, 0); } };
  }
  return { build, hill, land, massif, P, X0, CW, NC, base, wrapD };
})();
