/* ─────────────────────────────────────────────────────────────
   layout.js — the cove, in metres.
   y up · camera looks toward −z (east, the sea) · +x is south (screen right).
   Sea is z < shoreZ(x); dry beach up to vegZ(x); coastal forest beyond.
   ───────────────────────────────────────────────────────────── */
const Layout = (() => {
  const TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* ── the coast: it runs on for ever and never comes round again ──
     By the camp the shoreline is the bay as it always was: its own long waves, and its two rocky points. Further off
     it turns into a coast of its own, made of things of every size, none of them on a beat: a slow meander of the
     shore a few hundred metres long, broad bays bitten into it, big headlands and small rocky points (as many or as
     few as the stretch's own rockiness says, anywhere in it), reefs of rock running out from the beach into the sea,
     and a beach that is wider here and narrower there. Every one of them is drawn from integer hashes of where it is,
     so any stretch can be worked out on its own, in any order, and always comes out the same. Every headland leaves
     a strip of sand at its foot, so the van can drive round it. Coast is all in coast coordinates; the world sees it
     through the origin O below. */
  const S = { base: -8.6, a1: 1.5, f1: 0.0552233084, p1: 0.7, a2: 0.55, f2: 0.177941771, p2: 2.0, tl: -4.88923985, kt: 0.00613592315, tilt: -0.03 };
  const VG = { base: 1.7, a1: 0.9, f1: 0.0920388473, p1: 1.3, a2: 0.45, f2: 0.227029157, tl: -2.93354391 };
  const WIN = { x: 0.6, r0: 175, r1: 460 };   /* the camp's bay as it was within r0 of the camp; its own coast from r1 on */
  const Coast = (() => {
    const BLOCK = 1100, BAYB = 2500, REEFB = 640, WMAX = 38, REACH = 6, QUIET = 430;   /* (a headland's shape counts out to REACH half-widths) */
    /* the camp's own two points, as they always were (ids -1 and 0: world.js lays their rocks as it always did) */
    const FIX = [{ hx: -125, w: 16, d: 17, ht: 1, st: 1.7, gap: 9.5, stacks: 1, id: -1 }, { hx: 132, w: 17, d: 19, ht: 1.12, st: 1.9, gap: 10, stacks: 2, id: 0 }];
    /* an integer hash of (where, which number), as a fraction */
    const hash = (i, k) => { let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul((k | 0) + 0x3c6ef372, 0x165667b1); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
      h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
    /* smooth noise along the coast, 0..1, its lattice one unit apart (k: which noise) */
    const vn1 = (x, k) => { const i = Math.floor(x), f = x - i, u = f * f * f * (f * (f * 6 - 15) + 10), a = hash(i, k); return a + (hash(i + 1, k) - a) * u; };
    const sn = (x, k) => vn1(x, k) * 2 - 1;
    /* how rocky a stretch is (slow): long runs of sand with hardly a rock, and rocky stretches of points and coves */
    const rocky = x => Math.min(1, Math.max(0, 0.5 + 0.9 * sn(x / 2600 + 0.37, 71)));
    const byId = new Map(), blocks = new Map();
    /* the headlands of block b, in order along the coast: each its point hx, half-width w, how far it juts out d, height
       ht, the step of its rock terraces st, the sand left at its foot gap, its sea stacks */
    function block(b) {
      let out = blocks.get(b); if (out) return out;
      out = []; const q = k => hash(b * 131 + 7919, k), x0 = b * BLOCK, rk = rocky(x0 + BLOCK / 2);
      for (const f of FIX) if (f.hx >= x0 && f.hx < x0 + BLOCK) out.push(Object.assign({}, f));
      const fits = h => !out.some(o => Math.abs(o.hx - h.hx) < 2.5 * (o.w + h.w)) && Math.abs(h.hx - WIN.x) > QUIET + 3 * h.w && h.hx - 2.6 * h.w > x0 && h.hx + 2.6 * h.w < x0 + BLOCK;
      const nMaj = Math.floor(q(1) * (0.5 + 2.3 * rk)), nMin = Math.floor(q(2) * (0.6 + 5 * rk));
      let k = 10;
      for (let n = 0; n < nMaj; n++) for (let t = 0; t < 7; t++, k += 10) {
        const w = 15 + 23 * q(k + 1), d = w * (0.78 + 0.45 * q(k + 2)), ht = 0.75 + 0.78 * q(k + 3);
        const h = { hx: x0 + q(k) * BLOCK, w, d, ht, st: 1.3 + 1.25 * (ht - 0.7) + 0.25 * q(k + 4), gap: 7.6 + 0.145 * d + 0.4 * q(k + 5), stacks: q(k + 6) < 0.15 ? 0 : q(k + 6) < 0.62 ? 1 : 2 };
        if (fits(h)) { out.push(h); break; }
      }
      for (let n = 0; n < nMin; n++) for (let t = 0; t < 7; t++, k += 10) {
        const w = 6 + 8 * q(k + 1), d = w * (0.62 + 0.55 * q(k + 2)), ht = 0.5 + 0.55 * q(k + 3);
        const h = { hx: x0 + q(k) * BLOCK, w, d, ht, st: 1.1 + 0.9 * ht + 0.2 * q(k + 4), gap: 7.4 + 0.13 * d + 0.4 * q(k + 5), stacks: q(k + 6) < 0.55 ? 0 : 1, minor: true };
        if (fits(h)) { out.push(h); break; }
      }
      out.sort((a, c) => a.hx - c.hx);
      out.forEach((h, j) => { if (h.id === undefined) h.id = b * 64 + j + 1000; h.i = h.id; h.seed = 1 + Math.floor(hash(h.id, 9) * 1e9); byId.set(h.id, h); });
      blocks.set(b, out); return out;
    }
    /* the headlands near x0..x1 (those that can reach into it), and those whose points lie in it */
    const cache = new Map();
    function near(x0, x1) {
      const b0 = Math.floor((x0 - REACH * WMAX) / BLOCK), b1 = Math.floor((x1 + REACH * WMAX) / BLOCK), key = b0 * 100003 + b1;
      let L = cache.get(key); if (L) return L;
      L = []; for (let b = b0; b <= b1; b++) L.push(...block(b));
      if (cache.size > 256) cache.clear();
      cache.set(key, L); return L;
    }
    function heads(x0, x1) { const out = []; for (let b = Math.floor(x0 / BLOCK), n = Math.floor(x1 / BLOCK); b <= n; b++) for (const h of block(b)) if (h.hx >= x0 && h.hx <= x1) out.push(h); return out; }
    const cell = id => { if (!byId.has(id) && (id === -1 || id === 0)) block(id); return byId.get(id) || null; };
    function head(x) {
      let a = 0; const L = near(x, x);
      for (let i = 0; i < L.length; i++) { const h = L[i], u = (x - h.hx) / h.w; if (u > -REACH && u < REACH) a += h.d * Math.exp(-u * u); }
      return a;
    }
    /* broad bays, a few hundred metres across, bitten into the coast: the shore comes in, the forest edge less */
    const bayMemo = new Map();
    function bayOf(b) {
      let y = bayMemo.get(b); if (y !== undefined) return y;
      const q = k => hash(b * 271 + 104729, k);
      y = q(1) < 0.55 ? { cx: b * BAYB + 350 + q(2) * (BAYB - 700), bw: 110 + 230 * q(3), bd: 10 + 28 * q(4) } : null;
      bayMemo.set(b, y); return y;
    }
    function bays(x) {
      let a = 0;
      for (let b = Math.floor((x - 1500) / BAYB), n = Math.floor((x + 1500) / BAYB); b <= n; b++) { const y = bayOf(b); if (!y) continue; const u = (x - y.cx) / y.bw; if (u > -4 && u < 4) a += y.bd * Math.exp(-u * u); }
      return a;
    }
    const win = x => sm(WIN.r0, WIN.r1, Math.abs(x - WIN.x));
    /* the camp's bay as it was (without its points) */
    const zOld = x => S.base + S.a1 * Math.sin(x * S.f1 + S.p1) + S.a2 * Math.sin(x * S.f2 + S.p2) + S.tl * Math.sin(x * S.kt);
    const vOld = x => VG.base + VG.a1 * Math.sin(x * VG.f1 + VG.p1) + VG.a2 * Math.sin(x * VG.f2) + VG.tl * Math.sin(x * S.kt);
    /* and the coast further off: the shore's slow meander and its bays; how wide the beach is */
    const zNew = x => S.base + 9 * sn(x / 330, 11) + 3.2 * sn(x / 96, 23) + 0.9 * sn(x / 29, 37) + bays(x);
    const wNew = x => { const w = 11.5 + 4.6 * sn(x / 430, 51) + 1.7 * sn(x / 83, 53) - 0.12 * bays(x); return 0.5 * (w + 8.4 + Math.sqrt((w - 8.4) * (w - 8.4) + 1)); };
    const shoreZ = x => { const W = win(x), z0 = W < 1 ? zOld(x) : 0, z1 = W > 0 ? zNew(x) : 0; return z0 + (z1 - z0) * W - head(x); };
    const shoreDZ = x => (shoreZ(x + 0.02) - shoreZ(x - 0.02)) / 0.04;
    const vegZ = x => { const W = win(x), a = W < 1 ? zOld(x) : 0, va = W < 1 ? vOld(x) - a : 0, b = W > 0 ? zNew(x) : 0, vb = W > 0 ? wNew(x) : 0;
      return a + (b - a) * W + va + (vb - va) * W - 0.55 * head(x); };
    /* ── reefs: ledges of rock running out from the beach into the sea, a metre or two across on top and wide enough to
       walk out along, lower toward their far end, where the waves break over them. One by the camp, and now and then
       one along the coast, never by a headland. x where it leaves the sand, ang how it leans from straight out to sea,
       len how far it runs, w its top's half-width, h0 its height above the sea at the beach end, bend its curve ── */
    const RFIX = [{ x: -23, ang: -0.2, len: 34, w: 1.5, h0: 0.78, bend: -2.2, id: -7 }];
    const reefMemo = new Map();
    function reefBlock(b) {
      let out = reefMemo.get(b); if (out) return out;
      out = []; const q = k => hash(b * 617 + 15485863, k), x0 = b * REEFB;
      for (const f of RFIX) if (f.x >= x0 && f.x < x0 + REEFB) out.push(Object.assign({}, f));
      const x = x0 + 60 + q(2) * (REEFB - 120), rk = rocky(x);
      if (q(1) < 0.18 + 0.4 * rk && Math.abs(x - WIN.x) > 120 && !near(x, x).some(h => Math.abs(x - h.hx) < 2.6 * h.w + 25))
        out.push({ x, ang: (q(3) - 0.5) * 0.8, len: 20 + 30 * q(4), w: 1.15 + 0.6 * q(5), h0: 0.55 + 0.4 * q(6), bend: (q(7) - 0.5) * 8, id: b * 8 + 3000 });
      for (const r of out) r.seed = 1 + Math.floor(hash(r.id, 11) * 1e9);
      reefMemo.set(b, out); return out;
    }
    function reefs(x0, x1) { const out = []; for (let b = Math.floor((x0 - 60) / REEFB), n = Math.floor((x1 + 60) / REEFB); b <= n; b++) for (const r of reefBlock(b)) if (r.x >= x0 - 60 && r.x <= x1 + 60) out.push(r); return out; }
    /* (the reefs that could be under x: a list kept for each pair of blocks, as near() does for the headlands) */
    const rCache = new Map();
    function reefsNear(x) { const b0 = Math.floor((x - 70) / REEFB), b1 = Math.floor((x + 70) / REEFB), key = b0 * 100003 + b1; let L = rCache.get(key); if (L) return L;
      L = []; for (let b = b0; b <= b1; b++) L.push(...reefBlock(b)); if (rCache.size > 128) rCache.clear(); rCache.set(key, L); return L; }
    return { BLOCK, WMAX, REACH, hash, vn1, rocky, cell, near, heads, head, bays, shoreZ, shoreDZ, vegZ, reefs, reefsNear, win };
  })();

  /* where the world sits on the coast: world (x, z) is coast (x + O.x, z + O.z). It is (0, 0), the camp in its bay;
     setOrigin moves the camp somewhere else along the coast (the world must then be built again) */
  const O = { x: 0, z: 0 }; let coastVer = 0;
  function setOrigin(ox, oz) { O.x = ox; O.z = oz; coastVer++; }
  /* the tide (Sky's, from the moon and the sun; the engine sets it each frame): how far up the beach it has the water's
     edge just now (dz, m), and how far it had it at the last high water (hi). shoreZ is where the sea meets the sand now;
     shoreMeanZ where it does at the mean of the tide, which is what the coast's things are laid out from */
  const tide = { dz: 0, hi: 0 };
  const shoreMeanZ = x => Coast.shoreZ(x + O.x) - O.z;
  const shoreZ = x => Coast.shoreZ(x + O.x) - O.z + tide.dz, shoreDZ = x => Coast.shoreDZ(x + O.x), vegZ = x => Coast.vegZ(x + O.x) - O.z;
  const head = x => Coast.head(x + O.x);
  const heads = (x0, x1) => Coast.heads(x0 + O.x, x1 + O.x).map(h => Object.assign({}, h, { hx: h.hx - O.x }));

  const camp = { x: 0.6, z: -2.7 };
  const rug = { x: 0.6, z: -2.7, w: 3.9, d: 2.8, rot: 0.06 };
  const table = { x: 0.6, z: -2.7, w: 1.45, d: 0.78, h: 0.4, rot: 0.06 };

  /* string-light poles on an ellipse round the rug */
  const poles = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 7 * Math.PI * 2 + 0.25;
    poles.push([camp.x + Math.cos(t) * 3.9, camp.z + Math.sin(t) * 2.35]);
  }
  const strands = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 4], [2, 6]];
  const POLE_H = 2.6;

  const fire = { x: 6.9, z: -4.5 };
  const grate = { x: 6.94, z: -4.55, rot: 0.2 };     /* grill straddling the fire ring */
  const chairs = [{ x: 5.7, z: -3.1, face: [6.9, -4.5] }, { x: 8.4, z: -3.5, face: [6.9, -4.5] }];
  const driftwood = { x: 7.0, z: -6.05, len: 2.6, rot: 0.15 };
  /* an old crate between the chairs, the radio on it turned toward the first chair and the fire */
  const crate = { x: 7.05, z: -2.95, rot: 0.04 };     /* the side table between the chairs: the radio and the journal on it */
  /* the wish board: a corkboard on two posts to the right of the fire, its face turned to the chairs and the camp */
  const board = { x: 10.5, z: -3.7, rot: -1.07 };

  const van = { x: -7.6, z: -3.5, rot: Math.PI + 0.3 };
  const lanterns = [[-1.0, -1.65, 1.0], [2.35, -3.85, 0.9], [-6.1, -0.85, 0.8]];
  const bottle = { x: -3.3, z: -5.2, rot: 0.5 };     /* message in a bottle, on dry sand by the path */
  const castle = { x: -3.6, z: -3.6, rot: 1.27, seed: 5 };   /* a sand castle built by the camp (by the bottle, clear of the light poles and the van), its gate toward the camp, above where the high tide reaches */

  /* palms: [x, z, height, leanX, leanZ, crown radius, seed] */
  const palms = [
    [-14.8, 0.8, 9.6, -1.3, -0.9, 3.5, 1], [12.6, 1.0, 8.6, 0.9, -1.4, 3.3, 2], [17.4, -2.0, 6.8, 2.8, -3.2, 3.2, 3],
    [-21.5, 3.8, 10.8, -0.5, 0.3, 3.7, 4], [22.5, 4.2, 10.2, 0.7, 0.2, 3.6, 5], [-26.5, 1.2, 8.8, -0.8, -1.0, 3.4, 12],
    [-10.5, 9.2, 7.4, 0.5, -0.9, 3.2, 6], [7.5, 10.8, 7.0, -0.6, -0.7, 3.1, 7], [-6.2, 14.6, 5.4, 0.3, -0.5, 2.9, 8],
    [15.5, 12.0, 7.6, 0.4, -0.6, 3.3, 9], [-18.0, 12.4, 7.9, -0.3, -0.7, 3.3, 10], [25.5, 9.5, 8.3, 0.2, -0.4, 3.4, 11]
  ];
  /* broadleaf trees & bushes: [x, z, canopy radius, canopy height, seed] */
  const trees = [
    [-5.8, 8.2, 2.7, 4.4, 11], [4.0, 8.8, 2.9, 4.8, 12], [-13.2, 6.6, 2.6, 4.0, 13], [11.2, 6.4, 2.5, 3.8, 14],
    [0.8, 15.8, 3.2, 5.6, 15], [-8.4, 16.2, 3.1, 5.8, 16], [9.4, 16.8, 3.2, 5.9, 17], [-19.5, 7.8, 2.8, 4.6, 18], [19.8, 7.6, 2.8, 4.4, 19]
  ];
  const bushes = [
    [-3.2, 3.2, 1.5, 1.2, 21], [2.8, 3.5, 1.6, 1.3, 22], [8.0, 3.0, 1.4, 1.1, 23], [-9.4, 3.5, 1.6, 1.2, 24],
    [-16.2, 2.8, 1.7, 1.4, 25], [16.6, 2.6, 1.5, 1.2, 26], [0.0, 5.4, 1.8, 1.6, 27], [-6.8, 5.6, 1.7, 1.5, 28],
    [6.6, 5.2, 1.7, 1.5, 29], [13.0, 4.4, 1.6, 1.3, 30], [-12.4, 4.2, 1.6, 1.4, 31], [-21.5, 4.6, 1.8, 1.5, 32],
    [21.8, 4.8, 1.8, 1.5, 33], [-0.5, 8.2, 2.0, 1.8, 34], [-14.5, 9.2, 2.0, 1.8, 35], [13.5, 9.6, 2.0, 1.8, 36]
  ];

  const wind = [0.55, -0.83];     /* land breeze drifting smoke out toward the sea */

  const cameras = {
    wide: { pos: [0, 15.2, 21.9], look: [0, 6.7, -8.6], fov: 50, focus: 28 },
    camp: { pos: [1.8, 6.1, 5.4], look: [2.8, 1.0, -3.7], fov: 46, focus: 10.5 },
    fire: { pos: [5.1, 2.25, -0.9], look: [7.15, 0.5, -4.6], fov: 38, focus: 4.6 }
  };

  /* overlay hotspots (world, y up) */
  const hotspots = {
    van: [-7.6, 2.4, -3.5], lights: [0.6, 2.7, -5.0], table: [0.6, 0.7, -2.7], fire: [6.9, 1.0, -4.5], bottle: [-3.6, 0.3, -8.05]
  };

  return { shoreZ, shoreMeanZ, tide, shoreDZ, vegZ, head, heads, Coast, O, setOrigin, get coastVer() { return coastVer; }, SH: S, VG, WIN,
           camp, rug, table, poles, strands, POLE_H, fire, grate, chairs, driftwood, crate, van, lanterns, bottle, castle, palms, trees, bushes, wind, cameras, hotspots, board };
})();
