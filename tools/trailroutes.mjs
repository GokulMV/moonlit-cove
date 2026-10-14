/* The island's trails routed over its ground (node tools/trailroutes.mjs): for each trail of trails.js, between its
   points, the cheapest way for a path — steep ground dear, too steep none, turning dear, so it climbs in long zigzags —
   found by A* on a 6 m grid over the island as island.js builds it; then thinned (Douglas-Peucker, 1.5 m) and written to
   src3d/trailroutes.js, which trails.js draws them from. Run it again whenever the island's ground changes. */
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), src = f => fs.readFileSync(path.join(root, 'src3d', f), 'utf8');
const ctx = { window: { __coveIsle: true, location: { search: '?island' } }, console, performance: { now: () => Date.now() }, THREE: {}, Math, Float32Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Float64Array, Map, Set, Array, Object, JSON, Date };
vm.createContext(ctx);
vm.runInContext(src('island.js') + '\n;globalThis.Island = Island;' + src('layout.js') + '\n;globalThis.Layout = Layout;' + src('trails.js') + '\n;globalThis.IsleTrails = IsleTrails;', ctx);
const t0 = Date.now(), I = ctx.Layout.island(); console.log('island built', Date.now() - t0, 'ms');

function route(a, b, o = {}) {
  const C = o.cell || 6, pad = o.pad || 160, g0 = o.gmax || 0.42, minH = o.minH ?? -0.07, turnK = o.turn ?? 3.5;
  const x0 = Math.min(a[0], b[0]) - pad, z0 = Math.min(a[1], b[1]) - pad, nx = Math.ceil((Math.max(a[0], b[0]) + pad - x0) / C) + 1, nz = Math.ceil((Math.max(a[1], b[1]) + pad - z0) / C) + 1;
  const N = nx * nz, H = new Float32Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = I.height(x0 + i * C, z0 + j * C);
  const id = (x, z) => Math.round((z - z0) / C) * nx + Math.round((x - x0) / C), s = id(a[0], a[1]), t = id(b[0], b[1]), tx = t % nx, tz = (t / nx) | 0;
  const M = []; for (const [di, dj] of [[1, 0], [2, 1], [1, 1], [1, 2], [0, 1], [-1, 2], [-1, 1], [-2, 1], [-1, 0], [-2, -1], [-1, -1], [-1, -2], [0, -1], [1, -2], [1, -1], [2, -1]]) M.push([di, dj, Math.hypot(di, dj) * C, Math.atan2(dj, di)]);
  const ND = M.length, cost = new Float32Array(N * ND).fill(Infinity), from = new Int32Array(N * ND).fill(-1), done = new Uint8Array(N * ND);
  const hp = [], push = (f, n) => { hp.push([f, n]); let k = hp.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hp[p][0] <= hp[k][0]) break; [hp[p], hp[k]] = [hp[k], hp[p]]; k = p; } };
  const pop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hp[l][0] < hp[m][0]) m = l; if (r < hp.length && hp[r][0] < hp[m][0]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
  const hEst = n => Math.hypot((n % nx) - tx, ((n / nx) | 0) - tz) * C;
  for (let d = 0; d < ND; d++) { cost[s * ND + d] = 0; push(hEst(s), s * ND + d); }
  let end = -1;
  while (hp.length) {
    const [, st] = pop(); if (done[st]) continue; done[st] = 1;
    const n = (st / ND) | 0, dir = st % ND; if (n === t) { end = st; break; }
    const i = n % nx, j = (n / nx) | 0;
    for (let k = 0; k < ND; k++) {
      const [di, dj, d, ang] = M[k], ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const m = jj * nx + ii, s2 = m * ND + k; if (done[s2]) continue;
      const hm = H[m]; if (hm < minH && m !== t) continue;
      const g = Math.abs(hm - H[n]) / d; if (g > g0) continue;
      let turn = Math.abs(ang - M[dir][3]); if (turn > Math.PI) turn = 2 * Math.PI - turn; if (turn > 2.4) continue;
      const c = d * (1 + 60 * Math.max(0, g - 0.1) ** 2 + (hm < 0.6 ? o.beach ?? 2 : 0)) + turnK * C * turn;
      const nc = cost[st] + c; if (nc < cost[s2]) { cost[s2] = nc; from[s2] = st; push(nc + hEst(m), s2); }
    }
  }
  if (end < 0) return null;
  const out = []; for (let st = end; st >= 0; st = from[st]) { const n = (st / ND) | 0; out.push([x0 + (n % nx) * C, z0 + ((n / nx) | 0) * C]); }
  out.reverse(); out[0] = a.slice(); out[out.length - 1] = b.slice();
  return out;
}
/* Douglas-Peucker */
function thin(P, tol) {
  if (P.length < 3) return P;
  let worst = 0, wi = 0; const [ax, az] = P[0], [bx, bz] = P[P.length - 1], ex = bx - ax, ez = bz - az, l = Math.hypot(ex, ez) || 1;
  for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((P[i][0] - ax) * ez - (P[i][1] - az) * ex) / l; if (d > worst) { worst = d; wi = i; } }
  if (worst <= tol) return [P[0], P[P.length - 1]];
  return thin(P.slice(0, wi + 1), tol).slice(0, -1).concat(thin(P.slice(wi), tol));
}
const out = {};
for (const D of ctx.IsleTrails.DEFS) {
  if (D.route === false) continue;
  const via = D.via || D.pts; let P = [];
  for (let k = 0; k < via.length - 1; k++) { const r = route(via[k], via[k + 1], { gmax: D.gmax || 0.42 }); if (!r) { console.log(D.id, 'no route between', via[k], via[k + 1]); P = null; break; } P = P.concat(k ? r.slice(1) : r); }
  if (!P) continue;
  const T2 = thin(P, 1.5).map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
  let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  console.log(D.id, 'nodes', P.length, '→', T2.length, 'points, length', Math.round(len), 'm');
  out[D.id] = T2;
}
const file = path.join(root, 'src3d', 'trailroutes.js');
fs.writeFileSync(file, `/* the island's trails as tools/trailroutes.mjs routed them over its ground (do not edit: run that again) */\nconst TRAIL_ROUTES = ${JSON.stringify(out)};\n`);
console.log('wrote', path.relative(root, file));
