/* The island from above, straight from island.js (no browser): its sea and reef, beaches, rocks and cliffs, the hill
   shaded and contoured every 10 m, the camp; and its numbers (how big, how high, how long its coast, how long the
   build took). For trying shapes quickly.
   node tools/islemap.mjs [out.png] [metres a pixel 1.5] */
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import zlib from 'zlib';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), src = f => fs.readFileSync(path.join(root, 'src3d', f), 'utf8');
const out = process.argv[2] || path.join(root, 'shots', 'islemap.png'), M = +(process.argv[3] || 1.5);
/* (run as plain functions, not in a vm context: it is many times faster) */
const ctx = { window: { __coveIsle: true, location: { search: '?island' } }, console, performance, THREE: {} };
vm.createContext(ctx);
vm.runInContext(src('island.js') + '\n;globalThis.Island = Island;' + src('layout.js') + '\n;globalThis.Layout = Layout;', ctx);
const t0 = Date.now(), I = ctx.Layout.island(), D = I.data, G = D.grid, L = D.line;
console.log('built in', Date.now() - t0, 'ms; grid', G.nx, 'x', G.nz, '; coast', Math.round(L.P), 'm;', 'camp', ctx.Layout.camp.x, ctx.Layout.camp.z);
let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, hi = 0, hx = 0, hz = 0;
for (let i = 0; i < L.n; i++) { x0 = Math.min(x0, L.X[i]); x1 = Math.max(x1, L.X[i]); z0 = Math.min(z0, L.Z[i]); z1 = Math.max(z1, L.Z[i]); }
for (let c = 0; c < G.H.length; c++) if (G.H[c] > hi) { hi = G.H[c]; hx = G.X0 + ((c % G.nx) + 0.5) * G.cell; hz = G.Z0 + (Math.floor(c / G.nx) + 0.5) * G.cell; }
console.log(`island: x ${x0.toFixed(0)}..${x1.toFixed(0)} (${(x1 - x0).toFixed(0)} m north-south), z ${z0.toFixed(0)}..${z1.toFixed(0)} (${(z1 - z0).toFixed(0)} m east-west); top ${hi.toFixed(1)} m at (${hx.toFixed(0)}, ${hz.toFixed(0)})`);
/* (the picture: north (-x) up, east (-z) to the right) */
const X0 = x0 - 120, X1 = x1 + 120, Z0 = z0 - 160, Z1 = z1 + 120, W = Math.round((Z1 - Z0) / M), H = Math.round((X1 - X0) / M), px = Buffer.alloc(W * H * 3);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
  const x = X0 + (r + 0.5) * M, z = Z1 - (q + 0.5) * M, s = I.sdf(x, z), h = I.height(x, z);
  let c;
  if (s > 0) { const sh = I.shore(I.uAt(x, z), {}); c = mix([60, 160, 170], [20, 70, 110], sm(0, 12, -h)); if (sh.reef > 2 && s < sh.reef) c = mix(c, [110, 170, 150], 0.5); if (s < 2) c = mix(c, [210, 230, 230], 0.6); }
  else {
    const sh = I.shore(I.uAt(x, z), {}), d = -s;
    if (d < sh.W && sh.sand > 0.5) c = [222, 205, 160];
    else { c = mix([60, 100, 50], [40, 70, 36], sm(10, 80, h)); c = mix(c, [130, 125, 115], Math.min(1, (sh.rock + sh.cliff) * (1 - sm(sh.W + 3, sh.W + 16, d)))); }
    const e = 1.5, gx = (I.height(x + e, z) - I.height(x - e, z)) / (2 * e), gz = (I.height(x, z + e) - I.height(x, z - e)) / (2 * e), lit = Math.max(0.55, Math.min(1.35, 1 + (-gx * -0.6 + -gz * 0.6) * 0.9));
    c = c.map(v => v * lit);
    if (Math.abs(h % 10) < 0.25 && h > 1) c = c.map(v => v * 0.7);
  }
  if (Math.hypot(x - ctx.Layout.camp.x, z - ctx.Layout.camp.z) < 6) c = [240, 120, 40];
  const o = (r * W + q) * 3; px[o] = Math.max(0, Math.min(255, c[0])); px[o + 1] = Math.max(0, Math.min(255, c[1])); px[o + 2] = Math.max(0, Math.min(255, c[2]));
}
/* (a PNG, by hand) */
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
const raw = Buffer.alloc((W * 3 + 1) * H); for (let r = 0; r < H; r++) { raw[r * (W * 3 + 1)] = 0; px.copy(raw, r * (W * 3 + 1) + 1, r * W * 3, (r + 1) * W * 3); }
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', path.relative(root, out), W, 'x', H);
