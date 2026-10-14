/* ─────────────────────────────────────────────────────────────
   trails.js — the island's trails (Layout.isle): from the camp
   along the coast to the jetty's cove; from the cove up its
   valley to the southern peak; along the ridge over the saddle to
   the summit and its tower; from the camp up to the saddle and
   down the far side to the west beach; from the ridge down to the
   creek's head and along it on a boardwalk through the mangroves.
   Each a narrow line of trodden earth through the forest, cut a
   little into the slope where it climbs and banked where it
   crosses a gully, so it never pitches more steeply than a path
   can; log steps where it must; signposts where trails meet.
   The ground along them is worked into the island's own (isle.js
   asks ground() for every point it draws), so the walk, the trees
   and the land all find the path where it is drawn.
   ───────────────────────────────────────────────────────────── */
const IsleTrails = (() => {
  const T = THREE, TAU = Math.PI * 2;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* the trails: their names, the points they pass (the line between them a smooth curve), how wide their tread is */
  /* (via: the points each is routed through, tools/trailroutes.mjs finding the way between them over the ground; pts: the
     line itself where it is laid by hand) */
  const DEFS = [
    { id: 'coastal', name: 'Coastal trail', w: 1.3, via: [[25, 30], [330, 62], [575, 172]] },
    { id: 'valley', name: 'Valley trail', w: 1.2, via: [[592, 196], [450, 712]] },
    { id: 'ridge', name: 'Ridge trail', w: 1.1, via: [[450, 722], [-130, 700], [-728, 638]] },
    { id: 'saddle', name: 'Saddle trail', w: 1.2, via: [[0, 34], [-130, 700]] },
    { id: 'west', name: 'West trail', w: 1.2, via: [[-130, 700], [-80, 1210]], gmax: 0.5 },
    /* (the mangroves' boardwalk, along the creek's northern bank from its mouth: reached by the park's boat) */
    { id: 'creek', name: 'Mangrove boardwalk', w: 1.1, route: false, pts: [[939, 957], [909, 941], [871, 923], [833, 905], [789, 888], [748, 876], [705, 867], [664, 859], [622, 854]] }
  ];
  const ptsOf = D => (typeof TRAIL_ROUTES !== 'undefined' && TRAIL_ROUTES[D.id]) || D.pts || D.via;
  /* (a smooth curve through the points, a point every metre or so) */
  function curve(P, step = 1) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(2, Math.round(L / step));
      for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
    }
    out.push(P[P.length - 1].slice()); return out;
  }
  /* a running mean over r points either side */
  const smooth = (A, r) => { const n = A.length, out = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0, w = 0; for (let k = -r; k <= r; k++) { const j = clamp(i + k, 0, n - 1), q = 1 - Math.abs(k) / (r + 1); s += A[j] * q; w += q; } out[i] = s / w; } return out; };

  /* ── the plan: each trail's line and the tread's height along it; the steps, the boardwalk's stretches; the ground the
     forest keeps clear for it ── */
  function plan(I) {
    const trails = [], clear = [], CELL = 24, grid = new Map();
    for (const D of DEFS) {
      const S = curve(ptsOf(D), 1), n = S.length, X = new Float32Array(n), Z = new Float32Array(n), H0 = new Float32Array(n), WET = new Uint8Array(n);
      const SQ = {};
      for (let i = 0; i < n; i++) {
        X[i] = S[i][0]; Z[i] = S[i][1]; H0[i] = I.height(X[i], Z[i]);
        /* (out over the mangroves' mud, or so low the tide comes up to it: the boardwalk) */
        const s = I.sdf(X[i], Z[i]); if (s > -40) { const q = I.shore(I.uAt(X[i], Z[i]), SQ); if (q.mangrove > 0.4 && H0[i] < 0.9) WET[i] = 1; }
      }
      /* the tread: the ground's own height eased along the trail (a path climbs steadily, not over every hump), never cut
         more than a metre and a half into the slope nor built up more than one */
      let Y = smooth(H0, 9);
      for (let i = 0; i < n; i++) Y[i] = clamp(Y[i], H0[i] - 1.5, H0[i] + 1.0);
      Y = smooth(Y, 2);
      /* (the boardwalk's stretches: runs of at least 8 m, a little longer either side) */
      const runs = []; for (let i = 0; i < n; i++) { if (!WET[i]) continue; let j = i; while (j < n - 1 && WET[j + 1]) j++; if (j - i >= 8) runs.push([Math.max(0, i - 3), Math.min(n - 1, j + 3)]); i = j; }
      /* (where it climbs so steeply it needs steps: a grade over 0.3 for three metres and more) */
      const G = new Float32Array(n); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2), d = Math.hypot(X[b] - X[a], Z[b] - Z[a]) || 1; G[i] = (Y[b] - Y[a]) / d; }
      const steps = []; for (let i = 0; i < n; i++) { if (Math.abs(G[i]) < 0.3 || runs.some(([a, b]) => i >= a && i <= b)) continue; let j = i; while (j < n - 1 && Math.abs(G[j + 1]) >= 0.3) j++; if (j - i >= 3) steps.push([i, j]); i = j; }
      const t = { id: D.id, name: D.name, w: D.w, n, X, Z, Y, H0, G, WET, runs, steps, len: n - 1 };
      trails.push(t);
      /* (its segments into the grid, for the ground's question; and its ground kept clear of trunks) */
      for (let i = 0; i < n - 1; i++) {
        const gx0 = Math.floor((Math.min(X[i], X[i + 1]) - 6) / CELL), gx1 = Math.floor((Math.max(X[i], X[i + 1]) + 6) / CELL), gz0 = Math.floor((Math.min(Z[i], Z[i + 1]) - 6) / CELL), gz1 = Math.floor((Math.max(Z[i], Z[i + 1]) + 6) / CELL);
        for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) { const k = gx * 65536 + gz; let L = grid.get(k); if (!L) grid.set(k, (L = [])); L.push(t, i); }
        if (i % 2 === 0) clear.push([X[i], Z[i], D.w / 2 + 1.0]);
      }
    }
    /* the ground at (x, z), worked to the trails' treads: within the tread their height, easing back to the island's own
       over a few metres either side (h: the island's own there) */
    function ground(x, z, h) {
      const L = grid.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL)); if (!L) return h;
      let best = 1e9, by = 0, bw = 1;
      for (let k = 0; k < L.length; k += 2) {
        const t = L[k], i = L[k + 1], ax = t.X[i], az = t.Z[i], ex = t.X[i + 1] - ax, ez = t.Z[i + 1] - az, ll = ex * ex + ez * ez || 1, u = clamp(((x - ax) * ex + (z - az) * ez) / ll, 0, 1);
        const d = Math.hypot(x - ax - ex * u, z - az - ez * u); if (d < best) { best = d; by = t.Y[i] + (t.Y[i + 1] - t.Y[i]) * u; bw = t.w; }
      }
      if (best > bw / 2 + 4.5) return h;
      const k = 1 - sm(bw / 2 + 0.3, bw / 2 + 4.5, best);
      return h + (by - h) * k;
    }
    /* the trail nearest a point, and how far: { t, i, d } (for the walk) */
    function nearest(x, z) {
      const L = grid.get(Math.floor(x / CELL) * 65536 + Math.floor(z / CELL)); if (!L) return null;
      let out = null;
      for (let k = 0; k < L.length; k += 2) { const t = L[k], i = L[k + 1], d = Math.hypot(x - t.X[i], z - t.Z[i]); if (!out || d < out.d) out = { t, i, d }; }
      return out;
    }
    return { trails, clear, ground, nearest };
  }

  /* ── drawn: the tread, a strip of earth laid on the ground along each, its edges ragged into the litter; the steps; the
     boardwalk; the signposts where trails meet and end; the tower on the summit ── */
  function build(root, I, P, o) {
    const land = o.land, group = new T.Group(); group.name = 'trails'; root.add(group);
    const mat = Mats.lit({ vertexColors: true, roughness: 0.93, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, 'trail'), prev = mat.onBeforeCompile;
    /* (the earth's look: red-brown laterite trodden bare, roots across it, leaves fallen on it toward its edges; the edge
       itself ragged, the vertex alpha the share of the tread) */
    mat.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { float e = diffuseColor.a, n1 = vnz(vWPos*1.3), n2 = vnz(vWPos*4.7 + 3.0), n3 = vnz(vWPos*17.0);
    if (e < 0.3 + 0.55*(n1*0.6 + n2*0.4)) discard;
    vec3 soil = mix(vec3(0.16, 0.085, 0.045), vec3(0.12, 0.08, 0.05), n2)*(0.75 + 0.3*n3);
    float leaf = smoothstep(0.35, 0.0, e - 0.35 - 0.3*n2)*0.8 + smoothstep(0.7, 0.85, vnz(vWPos*2.3 + 7.0))*0.4;
    vec3 lit = mix(vec3(0.13, 0.09, 0.05), vec3(0.09, 0.075, 0.05), n3)*(0.7 + 0.5*n1);
    float root = smoothstep(0.84, 0.9, vnz(vec3(vWPos.x*0.9, 0.0, vWPos.z*0.9) + vec3(0.0, n2*0.6, 0.0)));
    diffuseColor.rgb = mix(mix(soil, lit, clamp(leaf, 0.0, 1.0)), vec3(0.07, 0.05, 0.035), root*0.7)*diffuseColor.rgb;
    diffuseColor.a = 1.0; }`);
    };
    mat.customProgramCacheKey = () => 'art-trail';
    const ms0 = performance.now();
    for (const t of P.trails) {
      /* (in pieces of some hundred metres, each culled on its own) */
      const PIECE = 120;
      for (let i0 = 0; i0 < t.n - 1; i0 += PIECE) {
        const i1 = Math.min(t.n - 1, i0 + PIECE), m = i1 - i0 + 1, A = 4, pos = new Float32Array(m * A * 3), col = new Float32Array(m * A * 4), idx = [];
        for (let k = 0; k < m; k++) {
          const i = i0 + k, a = Math.max(0, i - 1), b = Math.min(t.n - 1, i + 1), tx = t.X[b] - t.X[a], tz = t.Z[b] - t.Z[a], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
          const hw = t.w / 2;
          /* (across it: the litter at its outer edge, the tread's two edges, and out again) */
          [-(hw + 0.55), -hw * 0.45, hw * 0.45, hw + 0.55].forEach((off, j) => {
            const x = t.X[i] + nx * off, z = t.Z[i] + nz * off, y = land(x, z) + 0.06, v = (k * A + j) * 3;
            pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
            const c = (k * A + j) * 4, edge = j === 0 || j === 3 ? 0 : 1; col[c] = col[c + 1] = col[c + 2] = 1; col[c + 3] = edge;
          });
          if (k < m - 1) for (let j = 0; j < A - 1; j++) { const p = k * A + j; idx.push(p, p + A, p + 1, p + 1, p + A, p + A + 1); }
        }
        /* (where it is the boardwalk's, no tread under it) */
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
        const mesh = new T.Mesh(g, mat); mesh.receiveShadow = true; group.add(mesh);
      }
      /* the steps, where it climbs steeply: log steps, as many as the climb needs, laid up the slope */
      for (const [a, b] of t.steps) {
        const up = t.Y[b] > t.Y[a], i0 = up ? a : b, i1 = up ? b : a, rise = Math.abs(t.Y[i1] - t.Y[i0]), run = Math.hypot(t.X[i1] - t.X[i0], t.Z[i1] - t.Z[i0]);
        const nSt = Math.max(2, Math.round(rise / 0.18)), stp = Models.make('struct/steps', { seed: a + 7, n: nSt, rise: rise / nSt, run: run / nSt, width: t.w + 0.1, ground: true });
        stp.position.set(t.X[i0], t.Y[i0] - 0.02, t.Z[i0]); stp.rotation.y = Math.atan2(-(t.Z[i1] - t.Z[i0]), t.X[i1] - t.X[i0]); group.add(stp);
      }
      /* the boardwalk over the mud */
      for (const [a, b] of t.runs) {
        const pts = []; for (let i = a; i <= b; i += 3) pts.push([t.X[i] - t.X[a], t.Z[i] - t.Z[a]]); if (pts.length < 2) continue;
        const bw = Models.make('struct/boardwalk', { seed: a + 3, path: pts, h: 1.05, width: 1.25 });
        bw.position.set(t.X[a], 0, t.Z[a]); group.add(bw);
      }
    }
    /* the signposts: at each trail's ends, pointing along the trails that leave from there, with how far */
    const ends = []; for (const t of P.trails) { ends.push({ t, i: 0 }, { t, i: t.n - 1 }); }
    const posts = [];
    for (const e of ends) { const x = e.t.X[e.i], z = e.t.Z[e.i]; let p = posts.find(q => Math.hypot(q.x - x, q.z - z) < 30); if (!p) posts.push((p = { x, z, legs: [] })); p.legs.push(e); }
    const km = m => (m / 1000).toFixed(1) + ' km';
    const PLACE = { coastal: ['Jetty', 'Camp'], valley: ['Peak', 'Jetty'], ridge: ['Summit', 'Peak'], saddle: ['Ridge', 'Camp'], west: ['West beach', 'Ridge'], creek: ['Boardwalk', 'Creek mouth'] };
    for (const p of posts) {
      const signs = p.legs.slice(0, 4).map(({ t, i }) => {
        /* (which way it leaves from here, and where it goes) */
        const j = i === 0 ? Math.min(t.n - 1, 12) : Math.max(0, t.n - 13), dx = t.X[j] - t.X[i], dz = t.Z[j] - t.Z[i];
        return [PLACE[t.id][i === 0 ? 0 : 1], km(t.len), Math.atan2(-dz, dx)];
      });
      const sp = Models.make('struct/signpost', { seed: Math.round(p.x + p.z), signs });
      /* (beside the path, not in it) */
      const L = p.legs[0], i = L.i, j = i === 0 ? 3 : L.t.n - 4, ex = L.t.X[j] - L.t.X[i], ez = L.t.Z[j] - L.t.Z[i], el = Math.hypot(ex, ez) || 1, sx = p.x - ez / el * (L.t.w / 2 + 1.0), sz = p.z + ex / el * (L.t.w / 2 + 1.0);
      sp.position.set(sx, land(sx, sz), sz); group.add(sp);
    }
    /* the park's map of the island, painted from the island itself: its shore, the beaches, the hills' contours, the
       trails, the jetty, and where the board stands */
    let HG = null;
    function mapCanvas(hx, hz) {
      const W = 1024, H = 768, c = Models.canvas(W, H), a = c.getContext('2d'), L = I.data.line;
      const X0 = -1480, X1 = 1180, Z0 = -260, Z1 = 1500, k = Math.min((W - 80) / (X1 - X0), (H - 150) / (Z1 - Z0)), ox = (W - (X1 - X0) * k) / 2, oz = 112;
      /* (the island's long way across the board; its north, -x, to the left, as the arrow says) */
      const px = (x, z) => ox + (x - X0) * k, pz = (x, z) => oz + (z - Z0) * k;
      a.fillStyle = '#e9e1c8'; a.fillRect(0, 0, W, H);
      a.fillStyle = '#a9cdd0'; a.fillRect(24, 96, W - 48, H - 120);
      /* the reef's fringe, then the land */
      a.beginPath(); for (let i = 0; i < L.n; i += 4) { const x = L.X[i], z = L.Z[i]; i ? a.lineTo(px(x, z), pz(x, z)) : a.moveTo(px(x, z), pz(x, z)); } a.closePath();
      a.lineWidth = 14; a.strokeStyle = '#c4e0dc'; a.stroke(); a.fillStyle = '#6f9a5a'; a.fill();
      /* the hills: contours every 40 m, darker green higher (the heights looked up once for every board) */
      const step = 6, nx = Math.ceil((X1 - X0) / step), nz = Math.ceil((Z1 - Z0) / step);
      if (!HG) { HG = new Float32Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) HG[j * nx + i] = I.height(X0 + i * step, Z0 + j * step); }
      for (let lv = 40; lv < 280; lv += 40) {
        a.fillStyle = `rgba(40,70,30,${0.12 + lv / 1400})`;
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (HG[j * nx + i] > lv) a.fillRect(px(X0 + i * step, 0), pz(0, Z0 + j * step), step * k + 0.6, step * k + 0.6);
      }
      /* the beaches, sand along the shore */
      a.lineWidth = 5; a.lineCap = 'round';
      for (let i = 0; i < L.n - 4; i += 4) if (L.K[i * 4] > 0.6) { a.strokeStyle = '#ead9a2'; a.beginPath(); a.moveTo(px(L.X[i], L.Z[i]), pz(L.X[i], L.Z[i])); a.lineTo(px(L.X[i + 4], L.Z[i + 4]), pz(L.X[i + 4], L.Z[i + 4])); a.stroke(); }
      /* the trails, dashed red; the boardwalk brown */
      for (const t of P.trails) {
        a.setLineDash(t.id === 'creek' ? [] : [10, 7]); a.strokeStyle = t.id === 'creek' ? '#6b4423' : '#a3261c'; a.lineWidth = t.id === 'creek' ? 5 : 4;
        a.beginPath(); for (let i = 0; i < t.n; i += 6) { const x = t.X[i], z = t.Z[i]; i ? a.lineTo(px(x, z), pz(x, z)) : a.moveTo(px(x, z), pz(x, z)); } a.stroke();
      }
      a.setLineDash([]);
      /* the summit, the jetty, the camp; and here */
      a.fillStyle = '#2a2a24'; a.font = "600 22px 'Instrument Sans', Arial, sans-serif"; a.textAlign = 'center';
      const lab = (x, z, t, dy = -12) => a.fillText(t, px(x, z), pz(x, z) + dy);
      a.beginPath(); a.moveTo(px(-740, 636), pz(-740, 636) - 9); a.lineTo(px(-740, 636) - 8, pz(-740, 636) + 6); a.lineTo(px(-740, 636) + 8, pz(-740, 636) + 6); a.closePath(); a.fill(); lab(-740, 636, 'Summit 262 m', -16);
      lab(450, 722, 'Peak 182 m'); lab(0, -40, 'Camp', 0); lab(640, 120, 'Jetty', 0); lab(-80, 1290, 'West beach', 0); lab(800, 990, 'Mangroves', 26);
      a.fillStyle = '#c42a1a'; a.beginPath(); a.arc(px(hx, hz), pz(hx, hz), 9, 0, TAU); a.fill();
      a.fillStyle = '#2a2a24'; a.textAlign = 'left'; a.font = "500 20px 'Instrument Sans', Arial, sans-serif"; a.fillText('● You are here', px(hx, hz) + 14, pz(hx, hz) + 6);
      a.textAlign = 'center'; a.font = "700 46px 'Instrument Sans', Arial, sans-serif"; a.fillText('Trails of the island', W / 2, 62);
      a.font = "500 18px 'Instrument Sans', Arial, sans-serif"; a.textAlign = 'right'; a.fillText('contours every 40 m · 500 m', W - 40, H - 34);
      a.fillRect(W - 40 - 500 * k, H - 28, 500 * k, 4);
      /* (the north arrow) */
      a.beginPath(); a.moveTo(52, H - 52); a.lineTo(84, H - 62); a.lineTo(84, H - 42); a.closePath(); a.fill(); a.textAlign = 'left'; a.font = "700 22px 'Instrument Sans', Arial, sans-serif"; a.fillText('N', 40, H - 70);
      return Mats.tex(c);
    }
    for (const [mx, mz, face] of (o.maps || [])) {
      const mb = Models.make('struct/mapboard', { seed: Math.round(mx), map: mapCanvas(mx, mz) });
      mb.position.set(mx, land(mx, mz) - 0.02, mz); mb.rotation.y = face; group.add(mb);
    }
    /* the tower on the summit, where the ridge trail ends, and a bench by it */
    { const r = P.trails.find(t => t.id === 'ridge'), x = r.X[r.n - 1] - 4, z = r.Z[r.n - 1] - 2, tw = Models.make('struct/platform', { seed: 4, h: 6.5 });
      tw.position.set(x, land(x, z) - 0.05, z); tw.rotation.y = 0.3; group.add(tw); }
    group.traverse(m => { if (m.isMesh) { m.castShadow = m.castShadow || false; m.receiveShadow = true; } });
    return { group, ms: Math.round(performance.now() - ms0), posts: posts.length };
  }
  return { plan, build, DEFS };
})();
