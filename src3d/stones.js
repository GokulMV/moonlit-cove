/* ─────────────────────────────────────────────────────────────
   stones.js — the island's rocky shores and the foot of its
   cliffs (Layout.isle): granite boulders, as a granite island's
   shores are, the big rounded corestones piled along the water,
   half in it, the waves' wash round them; smaller ones among them
   and up the bank behind toward the forest; under the cliffs the
   blocks fallen from them, the biggest of all. Each is drawn from
   one of a dozen shapes (models/rocks/granite.js) turned, sized
   and tinted its own way. Near the eye they are the full stones,
   their grooves and spalled sheets; further off the same shapes
   in fewer triangles, then fewer still; beyond, the land's own
   rock colour carries them. Where each lies comes from the shore
   itself, metre by metre, so they are always the same.
   ───────────────────────────────────────────────────────────── */
const IsleStones = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (x, a, b, c, d) => sm(a, b, x) * (1 - sm(c, d, x));
  const hash3 = (a, b, c) => { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((c | 0) + 0x3c6ef372, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
  /* the shapes (granite.js's boulder, a metre across its half-width, each its own seed) and the detail each level of them
     is drawn at: up close, at a middle distance, far off */
  const SHAPES = [['round', 3], ['round', 7], ['round', 12], ['round', 19], ['flat', 4], ['flat', 9], ['flat', 15], ['tall', 6], ['tall', 13], ['split', 8], ['round', 23], ['flat', 21]];
  const DET = [12, 5, 2];
  /* how near the stones are drawn whole, and the band over which they give way to their simpler shapes (m); how far off
     the middle level is drawn, and the far one */
  const NEAR = 70, FADE = 14, MID = 420, FAR = 1000;

  function build(root, I, o) {
    const land = o.land, L = I.data.line, group = new T.Group(); group.name = 'stones'; group.matrixAutoUpdate = false; root.add(group);
    const t0 = performance.now();
    /* ── the shapes, each at its three levels ── */
    const protos = SHAPES.map(([shape, seed]) => DET.map(detail => { const g = StoneKit.boulder({ size: 1, shape, seed, detail, sink: 0.16 }); g.computeBoundingSphere(); return g; }));
    /* the material: the sea rocks' own (wet and dark at the water, weed at the line, lichen up out of the spray), its near
       level fading out beyond NEAR, the others in within it, dithered pixel by pixel so the two never show at once */
    const fadeU = { value: new T.Vector2(NEAR, NEAR + FADE) };
    const mat = near => {
      const m = Mats.lit({ vertexColors: true, roughness: 0.86 }, 'rockw'), prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        prev(sh, r); sh.uniforms.uRkFade = fadeU;
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform vec2 uRkFade;
void main() {
  { float fd = distance(vWPos, cameraPosition), fk = smoothstep(uRkFade.x, uRkFade.y, fd), fh = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233)))*43758.5453);
    if (${near ? 'fk >= fh' : 'fk < fh'}) discard; }`);
      };
      m.customProgramCacheKey = () => 'art-rockw-isle' + (near ? 'N' : 'F');
      return m;
    };
    const matN = mat(true), matF = mat(false);

    /* ── where they lie: along the shore a metre at a time, wherever it is rock or cliff ── */
    const SQ = {};
    /* (the way out to sea at line point i: across the line, whichever side the sea is) */
    const seaward = i => { const tx = L.TX[i], tz = L.TZ[i], l = Math.hypot(tx, tz) || 1; let nx = tz / l, nz = -tx / l; if (I.sdf(L.X[i] + nx * 6, L.Z[i] + nz * 6) < I.sdf(L.X[i] - nx * 6, L.Z[i] - nz * 6)) { nx = -nx; nz = -nz; } return [nx, nz]; };
    /* the classes: how many candidates a metre, the odds of each where the shore is all rock (and all cliff), how far in
       from the water (d, m: negative out in it) they lie, and their sizes (half-widths, m) */
    const CLS = [
      { k: 0, n: 1, rock: 0.2, cliff: 0.42, d: [-5, -2, 4, 7], s: [1.3, 3.0], sc: [2.2, 4.6] },
      { k: 1, n: 2, rock: 0.34, cliff: 0.3, d: [-7, -3, 9, 15], s: [0.55, 1.35], sc: [0.9, 2.0] },
      { k: 2, n: 3, rock: 0.3, cliff: 0.2, d: [-4, -1, 14, 22], s: [0.18, 0.55], sc: [0.3, 0.8] }
    ];
    /* every stone: x, y, z, size, its shape, yaw, tilt, tint; listed by which tile it lies in */
    const byTile = new Map(), TS = o.TS, all = [];
    let n = 0;
    for (let i = 0; i < L.n; i++) {
      const kr = L.K[i * 4 + 1], kc = L.K[i * 4 + 2], k = kr + kc; if (k < 0.12) continue;
      const [nx, nz] = seaward(i), tx = -nz, tz = nx, W = L.W[i];
      for (const C of CLS) for (let c = 0; c < C.n; c++) {
        const h = j => hash3(i, C.k * 8 + c, j);
        const odds = (kr * C.rock + kc * C.cliff) / Math.max(k, 1e-3) * sm(0.12, 0.5, k);
        if (h(1) >= odds) continue;
        /* (across the band: the draw, shaped by the band's own fall-off) */
        let d = 0, ok = false;
        for (let tries = 0; tries < 3 && !ok; tries++) { d = C.d[0] + (C.d[3] + (C.k ? W * 0.5 : 0) - C.d[0]) * h(2 + tries); ok = h(5 + tries) < bump(d, C.d[0], C.d[1], C.d[2] + (C.k ? W * 0.5 : 0), C.d[3] + (C.k ? W * 0.5 : 0)); }
        if (!ok) continue;
        const along = (h(9) - 0.5) * 1.6, x = L.X[i] - nx * d + tx * along, z = L.Z[i] - nz * d + tz * along;
        const cl = kc / Math.max(k, 1e-3), S0 = C.s[0] + (C.sc[0] - C.s[0]) * cl, S1 = C.s[1] + (C.sc[1] - C.s[1]) * cl;
        /* (the sizes skewed small: many little, few big) */
        const s = S0 + (S1 - S0) * Math.pow(h(10), 1.6);
        /* (on the land as it is drawn; out in the water, on the bottom, though never so deep that it is all under) */
        const y = d < 0 ? Math.max(I.height(x, z), -0.55 * s) : land(x, z);
        const st = { x, y: y - 0.06 * s, z, s, p: Math.floor(h(11) * SHAPES.length) % SHAPES.length, yaw: h(12) * TAU, tx: (h(13) - 0.5) * 0.3, tz: (h(14) - 0.5) * 0.3, tint: h(15), sy: 0.85 + 0.3 * h(16), cls: C.k, id: n,
          /* (one that stands in the water, big enough for the waves to slap against) */
          wet: d < 0.6 && s > 0.4 };
        const key = Math.floor(x / TS) + ',' + Math.floor(z / TS);
        if (!byTile.has(key)) byTile.set(key, []);
        byTile.get(key).push(st); all.push(st); n++;
      }
    }
    const planMs = performance.now() - t0;

    /* ── a tile's stones at a level: one instanced mesh a shape (the small ones only at the middle level, never far) ── */
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    const place = st => { e.set(st.tx, st.yaw, st.tz); q.setFromEuler(e); sc.set(st.s, st.s * st.sy, st.s); pos.set(st.x, st.y, st.z); return m4.compose(pos, q, sc); };
    const tintOf = st => { const k = 0.86 + 0.26 * st.tint, w = (st.tint * 7.13) % 1; return col.setRGB(k * (0.97 + 0.06 * w), k, k * (1.03 - 0.06 * w)); };
    function meshes(list, lev) {
      const out = [], by = SHAPES.map(() => []);
      for (const st of list) if (lev < 2 || st.cls < 2) by[st.p].push(st);
      by.forEach((L2, p) => {
        if (!L2.length) return;
        const im = new T.InstancedMesh(protos[p][lev], matF, L2.length);
        L2.forEach((st, i) => { im.setMatrixAt(i, place(st)); im.setColorAt(i, tintOf(st)); });
        im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.receiveShadow = true; im.castShadow = lev === 1; im.computeBoundingSphere(); im.matrixAutoUpdate = false;
        group.add(im); out.push(im);
      });
      return out;
    }
    /* the tile's levels as they are needed (the tile record is isle.js's) */
    function tileFor(t) { if (!t.st) t.st = { list: byTile.get(Math.floor(t.x / TS) + ',' + Math.floor(t.z / TS)) || [], m: [null, null, null], lev: -1 }; return t.st; }
    const distTo = (t, cx, cz) => Math.hypot(Math.max(0, t.x - cx, cx - t.x - TS), Math.max(0, t.z - cz, cz - t.z - TS));

    /* ── near the eye: the nearest stones whole, as many of each shape as there is room for ── */
    const CAP = 160, nearIm = protos.map(P => { const im = new T.InstancedMesh(P[0], matN, CAP); im.count = 0; im.frustumCulled = false; im.castShadow = im.receiveShadow = true; im.matrixAutoUpdate = false; group.add(im); return im; });
    let lastX = 1e9, lastZ = 1e9, frame = 0;
    function update(cx, cy, cz, tiles, budget) {
      /* (each tile: the level it wants, built when first wanted, the others hidden) */
      let built = 0;
      for (const t of tiles) {
        const S = tileFor(t); if (!S.list.length) continue;
        const d = distTo(t, cx, cz), lev = d < MID ? 1 : d < FAR ? 2 : -1;
        if (lev > 0 && !S.m[lev] && built < 1) { S.m[lev] = meshes(S.list, lev); built++; }
        for (let k = 1; k <= 2; k++) if (S.m[k]) for (const m of S.m[k]) m.visible = k === lev || (lev === -1 ? false : !S.m[lev] && k === 3 - lev);
      }
      frame++;
      if (frame % 4 && Math.hypot(cx - lastX, cz - lastZ) < 3) return;
      lastX = cx; lastZ = cz;
      const R2 = (NEAR + FADE + 4) ** 2, pick = SHAPES.map(() => []);
      for (const t of tiles) {
        const S = t.st; if (!S || !S.list.length || distTo(t, cx, cz) > NEAR + FADE + 8) continue;
        for (const st of S.list) { const d2 = (st.x - cx) ** 2 + (st.y - cy) ** 2 * 0.3 + (st.z - cz) ** 2; if (d2 < R2 + st.s * st.s * 4) pick[st.p].push([d2, st]); }
      }
      pick.forEach((P, p) => {
        P.sort((a, b) => a[0] - b[0]); const im = nearIm[p], k = Math.min(CAP, P.length);
        for (let i = 0; i < k; i++) { im.setMatrixAt(i, place(P[i][1])); im.setColorAt(i, tintOf(P[i][1])); }
        im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      });
    }
    const stats = () => ({ stones: n, planMs: Math.round(planMs), near: nearIm.reduce((a, m) => a + m.count, 0), tiles: byTile.size });
    /* the stones within r of a point (for the walk to climb them, the waves' slap on those in the water) */
    function near(x, z, r, out = []) {
      out.length = 0;
      for (let tz = Math.floor((z - r - 6) / TS); tz <= Math.floor((z + r + 6) / TS); tz++) for (let tx = Math.floor((x - r - 6) / TS); tx <= Math.floor((x + r + 6) / TS); tx++) {
        const L2 = byTile.get(tx + ',' + tz); if (!L2) continue;
        for (const st of L2) if ((st.x - x) ** 2 + (st.z - z) ** 2 < (r + st.s * 1.3) ** 2) out.push(st);
      }
      return out;
    }
    return { update, stats, near, all, protos, mats: [matN, matF] };
  }
  return { build, SHAPES, NEAR };
})();
