/* ─────────────────────────────────────────────────────────────
   trees.js — the coast's trees and bushes, grown: a trunk that
   forks into limbs, limbs into branches, branches into twigs, and
   leafy twig cards at their ends, so a crown is a cloud of small
   leaf clusters with gaps the sky shows through. Each card's
   normal is bent toward the crown's own roundness (so the crown
   shades as one shape, with leafy detail at its edges) and each
   carries how deep in the crown it sits (dark inside, lit
   outside; light through the leaves against the sun).
   The species of a tropical shore: the tropical almond (tiers of
   level branches, big leaves in rosettes, a few gone red), the
   casuarina (tall, wispy, drooping needles), the beach hibiscus
   (a rounded, spreading crown) and the sea grape (dense mounds
   of big round leaves); and low leafy scrub.
   ───────────────────────────────────────────────────────────── */
const Trees = (() => {
  const T = THREE, TAU = Math.PI * 2, rng = Textures.rng, V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const RF = { willReadFrequently: true };

  /* ── twig cards, painted: a twig up the middle of the card, its leaves along it (transparent round them) ── */
  function twigCard(kind, seed) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const a = c.getContext('2d', RF), r = rng(seed);
    const P = {
      almond: { cols: ['#2f5a26', '#386a2b', '#27501f', '#447a31', '#2b5524'], red: ['#a8452a', '#c0612c', '#8d3a26'], redK: 0.1 },
      hibiscus: { cols: ['#3b6a2a', '#467a30', '#335f26', '#528a37', '#3f702c'], red: ['#d8b432'], redK: 0.03 },
      grape: { cols: ['#55702f', '#617d35', '#4a6429', '#6c8a3c'], red: ['#9a4a2f', '#b1603a'], redK: 0.08 },
      casuarina: { cols: ['#3c5434', '#46603b', '#34492d', '#50693f'] },
      scrub: { cols: ['#3a6129', '#456e2f', '#325424', '#4f7a34'], red: [], redK: 0 } }[kind];
    const leafAt = (x, y, ang, L, W, col, shape) => {
      a.save(); a.translate(x, y); a.rotate(ang); a.fillStyle = col; a.beginPath();
      if (shape === 'round') a.ellipse(L / 2, 0, L / 2, W / 2, 0, 0, TAU);
      else if (shape === 'obovate') { a.moveTo(0, 0); a.bezierCurveTo(L * 0.3, -W * 0.25, L * 0.8, -W * 0.62, L, -W * 0.05); a.bezierCurveTo(L * 0.8, W * 0.62, L * 0.3, W * 0.25, 0, 0); }
      else if (shape === 'heart') { a.moveTo(0, 0); a.bezierCurveTo(L * 0.1, -W * 0.7, L * 0.75, -W * 0.65, L, 0); a.bezierCurveTo(L * 0.75, W * 0.65, L * 0.1, W * 0.7, 0, 0); }
      else { a.moveTo(0, 0); a.quadraticCurveTo(L * 0.45, -W, L, 0); a.quadraticCurveTo(L * 0.45, W, 0, 0); }
      a.fill();
      /* a sheen on one half, the midrib */
      a.fillStyle = 'rgba(255,255,230,0.08)'; a.beginPath(); a.ellipse(L * 0.5, -W * 0.15, L * 0.38, W * 0.22, 0, 0, TAU); a.fill();
      a.strokeStyle = 'rgba(210,225,170,0.28)'; a.lineWidth = Math.max(0.8, W * 0.05); a.beginPath(); a.moveTo(0, 0); a.lineTo(L * 0.92, 0); a.stroke();
      a.restore();
    };
    const pick = () => (P.red && r() < P.redK ? P.red[Math.floor(r() * P.red.length)] : P.cols[Math.floor(r() * P.cols.length)]);
    /* the twig itself */
    a.strokeStyle = kind === 'casuarina' ? '#5a4a3a' : '#5b4634'; a.lineWidth = 3; a.lineCap = 'round';
    a.beginPath(); a.moveTo(128, 252); a.bezierCurveTo(124 + (r() - 0.5) * 20, 180, 132 + (r() - 0.5) * 20, 90, 128 + (r() - 0.5) * 16, 24); a.stroke();
    const twigX = y => 128 + (r() - 0.5) * 3;
    if (kind === 'casuarina') {
      /* fine drooping needles in tufts along the twig */
      for (let i = 0; i < 26; i++) {
        const y0 = 30 + i * 8.5, x0 = twigX(y0), n = 5 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) {
          const ang = (r() - 0.5) * 2.4 + (k % 2 ? 0.5 : -0.5), L = 40 + r() * 46;
          a.strokeStyle = pick(); a.lineWidth = 1.4 + r() * 0.9; a.beginPath(); a.moveTo(x0, y0);
          const ex = x0 + Math.sin(ang) * L * 0.6, ey = y0 + L * (0.5 + 0.4 * r());
          a.quadraticCurveTo(x0 + Math.sin(ang) * L * 0.5, y0 + L * 0.1, ex, ey); a.stroke();
        }
      }
    } else if (kind === 'almond') {
      /* rosettes of big obovate leaves at the twig's end, and a few along it */
      for (const [y0, n, Ls] of [[46, 7, 1.0], [120, 4, 0.75], [190, 3, 0.6]]) {
        for (let k = 0; k < n; k++) { const ang = -Math.PI / 2 + (k - (n - 1) / 2) * (2.6 / n) + (r() - 0.5) * 0.3, L = (70 + r() * 30) * Ls; leafAt(twigX(y0), y0, ang, L, L * 0.52, pick(), 'obovate'); }
      }
    } else if (kind === 'grape') {
      for (let k = 0; k < 6; k++) { const y0 = 60 + k * 30, ang = (k % 2 ? -1 : 1) * (0.6 + r() * 0.5) - Math.PI / 2, L = 64 + r() * 26; leafAt(twigX(y0), y0, ang, L, L * 0.95, pick(), 'round'); }
      leafAt(128, 40, -Math.PI / 2 + (r() - 0.5) * 0.4, 70, 66, pick(), 'round');
    } else {
      /* alternate leaves up the twig: heart-shaped for the hibiscus, smaller lance-shaped for the scrub */
      const n = kind === 'hibiscus' ? 9 : 14, shape = kind === 'hibiscus' ? 'heart' : 'lance';
      for (let k = 0; k < n; k++) {
        const y0 = 34 + k * (200 / n), side = k % 2 ? 1 : -1, ang = -Math.PI / 2 + side * (0.75 + r() * 0.5), L = (kind === 'hibiscus' ? 52 + r() * 20 : 34 + r() * 16) * (1 - 0.25 * (k / n));
        leafAt(twigX(y0), y0, ang, L, L * (kind === 'hibiscus' ? 0.85 : 0.38), pick(), shape);
      }
      leafAt(128, 30, -Math.PI / 2, kind === 'hibiscus' ? 56 : 36, kind === 'hibiscus' ? 46 : 14, pick(), shape);
      if (kind === 'hibiscus' && r() < 0.6) { a.fillStyle = '#f2cf3a'; a.beginPath(); a.arc(150, 110, 13, 0, TAU); a.fill(); a.fillStyle = '#7a2f1e'; a.beginPath(); a.arc(150, 110, 4, 0, TAU); a.fill(); }
    }
    return c;
  }

  /* bark: furrows running up the trunk, a few pale flecks */
  function barkTex(seed, base) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512; const a = c.getContext('2d', RF), r = rng(seed);
    a.fillStyle = base; a.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 90; i++) { const x = r() * 128, w = 1 + r() * 4, y0 = r() * 512, L = 60 + r() * 320; a.fillStyle = `rgba(22,15,10,${0.14 + r() * 0.26})`; a.fillRect(x, y0, w, L); a.fillRect(x, y0 - 512, w, L); }
    for (let i = 0; i < 50; i++) { a.fillStyle = `rgba(255,240,220,${0.05 + r() * 0.08})`; a.fillRect(r() * 128, r() * 512, 2 + r() * 6, 1 + r() * 2); }
    return c;
  }

  /* ── growing one: species, how its trunk and branches go, where its leaves are ── */
  const SPECIES = {
    /* tiers of level limbs off a straight trunk, branchlets turned up at their ends, big leaves in flat rosettes */
    almond: { h: [7, 10], r: 0.22, lean: 0.06, tiers: true, levels: 2, kids: [12, 4], from: [0.38, 0.35], ang: [1.32, 0.7], angJ: 0.25, lenR: [0.42, 0.42], up: [0.0, 0.5, 0.6], wob: 0.12, radR: 0.45,
      leaf: 'almond', cards: 9, card: 1.05, flat: 0.75, droop: 0, sets: 3 },
    /* tall, a thin trunk to the top, many short branches angled up, drooping twigs of needles */
    casuarina: { h: [10, 14], r: 0.18, lean: 0.05, levels: 2, kids: [20, 3], from: [0.3, 0.3], ang: [0.95, 0.75], angJ: 0.3, lenR: [0.24, 0.5], up: [0.0, 0.35, -0.4], wob: 0.1, radR: 0.42, taperTop: true,
      leaf: 'casuarina', cards: 7, card: 1.15, flat: 0, droop: 0.85, sets: 3 },
    /* a short trunk forking into a few spreading limbs, a rounded crown of heart-shaped leaves */
    hibiscus: { h: [2.4, 3.4], r: 0.2, lean: 0.12, fork: true, levels: 3, kids: [4, 4, 3], from: [0.85, 0.35, 0.3], ang: [0.75, 0.75, 0.8], angJ: 0.35, lenR: [1.25, 0.6, 0.55], up: [0.0, 0.25, 0.15, 0.1], wob: 0.22, radR: 0.55,
      leaf: 'hibiscus', cards: 6, card: 0.95, flat: 0.25, droop: 0.15, sets: 3 },
    /* a mound of stems from the ground, big round leaves */
    grape: { h: [1.8, 2.6], r: 0.08, lean: 0.4, bush: 6, levels: 2, kids: [3, 3], from: [0.4, 0.3], ang: [0.7, 0.7], angJ: 0.4, lenR: [0.5, 0.5], up: [0.1, 0.2, 0.1], wob: 0.25, radR: 0.55,
      leaf: 'grape', cards: 5, card: 0.9, flat: 0.2, droop: 0.1, sets: 3 },
    /* low leafy scrub on the forest floor */
    scrub: { h: [0.6, 0.9], r: 0.025, lean: 0.5, bush: 4, levels: 1, kids: [3], from: [0.4], ang: [0.7], angJ: 0.4, lenR: [0.55], up: [0.1, 0.2], wob: 0.3, radR: 0.6,
      leaf: 'scrub', cards: 4, card: 0.55, flat: 0.2, droop: 0.1, sets: 3 } };

  /* a direction at `el` from the axis `t`, turned `az` round it */
  const _q = new T.Quaternion();
  function aside(t, az, el) {
    const ref = Math.abs(t.y) < 0.95 ? V3(0, 1, 0) : V3(1, 0, 0), u = V3().crossVectors(t, ref).normalize(), w = V3().crossVectors(t, u);
    return t.clone().multiplyScalar(Math.cos(el)).addScaledVector(u, Math.sin(el) * Math.cos(az)).addScaledVector(w, Math.sin(el) * Math.sin(az)).normalize();
  }
  function grow(kind, seed, lite) {
    const S = SPECIES[kind], r = rng(seed), bark = [], cards = [];
    const H = S.h[0] + r() * (S.h[1] - S.h[0]);
    function branch(p0, dir, len, rad, lvl) {
      const segs = lvl === 0 ? (S.bush ? 3 : 6) : lvl === 1 ? 4 : 3, pts = [p0.clone()], d = dir.clone();
      let p = p0.clone();
      for (let i = 1; i <= segs; i++) {
        d.add(V3((r() - 0.5) * S.wob, (S.up[lvl] || 0) * 0.3, (r() - 0.5) * S.wob)).normalize();
        p = p.clone().addScaledVector(d, len / segs); pts.push(p);
      }
      const curve = new T.CatmullRomCurve3(pts), radial = lvl === 0 ? 7 : lvl === 1 ? 5 : 4;
      const end = S.taperTop && lvl === 0 ? 0.08 : 0.35;
      if (!(lite && lvl >= S.levels) && rad > 0.008) bark.push(Nature.taperTube(curve, segs * (lvl ? 1 : 2), lite ? Math.max(3, radial - 2) : radial, t => rad * (1 - t * (1 - end)), 1.2));
      if (lvl < S.levels) {
        const n = Math.round(S.kids[lvl] * (lite && lvl ? 0.7 : 1));
        for (let i = 0; i < n; i++) {
          let t = S.from[lvl] + (1 - S.from[lvl]) * (i + 0.2 + r() * 0.6) / n;
          if (S.tiers && lvl === 0) t = S.from[0] + (1 - S.from[0]) * 0.85 * (Math.floor(i / 4) + 0.15 * r()) / Math.ceil(n / 4);   /* (in whorls of four) */
          const P = curve.getPointAt(Math.min(0.98, t)), Tg = curve.getTangentAt(Math.min(0.98, t)), az = i * 2.39996 + r() * 0.5;
          const el = S.ang[lvl] + (r() - 0.5) * S.angJ, cd = aside(Tg, az, el);
          const L = len * S.lenR[lvl] * (0.75 + 0.5 * r()) * (S.fork && lvl === 0 ? 1 : (1 - 0.45 * (t - S.from[lvl]) / (1 - S.from[lvl] + 1e-6) * (S.taperTop ? 1 : 0.6)));
          branch(P, cd, L, rad * S.radR * (1 - 0.4 * t), lvl + 1);
        }
      }
      /* leafy twig cards along the outer part of the last branches */
      if (lvl === S.levels) {
        const n = Math.max(2, Math.round(S.cards * (lite ? 0.5 : 1)));
        for (let i = 0; i < n; i++) {
          const t = 0.3 + 0.7 * (i + r()) / n, P = curve.getPointAt(Math.min(1, t)), Tg = curve.getTangentAt(Math.min(1, t));
          /* the card's length runs out from the twig, turned round it; flat species lie their cards level, drooping ones
             hang them */
          let ax = aside(Tg, r() * TAU, 0.5 + r() * 0.7);
          if (S.flat) ax.lerp(V3(ax.x, 0, ax.z).normalize(), S.flat).normalize();
          if (S.droop) ax.lerp(V3(ax.x * 0.3, -1, ax.z * 0.3).normalize(), S.droop * (0.6 + 0.4 * r())).normalize();
          const s = S.card * (0.8 + 0.4 * r()) * (lite ? 1.5 : 1);
          let side = V3().crossVectors(ax, V3(0, 1, 0)); if (side.lengthSq() < 1e-4) side = V3(1, 0, 0); side.normalize();
          side.applyQuaternion(_q.setFromAxisAngle(ax, (r() - 0.5) * 1.2));
          cards.push({ p: P.clone(), ax, side, s, set: Math.floor(r() * (S.sets || 3)) });
        }
      }
    }
    if (S.bush) {
      for (let i = 0; i < S.bush; i++) {
        const az = i / S.bush * TAU + r() * 0.8, d = aside(V3(0, 1, 0), az, S.lean * (0.6 + 0.8 * r()));
        branch(V3(Math.cos(az) * 0.1, -0.05, Math.sin(az) * 0.1), d, H * (0.6 + 0.4 * r()), S.r, 0);
      }
    } else {
      branch(V3(0, -0.3, 0), aside(V3(0, 1, 0), r() * TAU, S.lean * r()), H, S.r, 0);
    }
    /* the crown: its middle and its reach, from where its leaves are */
    const C = V3(); for (const c of cards) C.add(c.p); C.multiplyScalar(1 / Math.max(1, cards.length));
    const ext = V3(); for (const c of cards) { ext.x = Math.max(ext.x, Math.abs(c.p.x - C.x)); ext.y = Math.max(ext.y, Math.abs(c.p.y - C.y)); ext.z = Math.max(ext.z, Math.abs(c.p.z - C.z)); }
    ext.addScalar(0.6);
    /* the cards: two triangles each, their normals bent toward the crown's roundness, with how deep in the crown they sit */
    const sets = [[], [], []];
    for (const c of cards) sets[c.set].push(c);
    const geo = sets.map(L => {
      const P = new Float32Array(L.length * 12), N = new Float32Array(L.length * 12), UV = new Float32Array(L.length * 8), A = new Float32Array(L.length * 16), I = new Uint32Array(L.length * 6);
      L.forEach((c, k) => {
        const w = c.s * 0.5, base = c.p, tip = c.p.clone().addScaledVector(c.ax, c.s);
        const corners = [base.clone().addScaledVector(c.side, -w), base.clone().addScaledVector(c.side, w), tip.clone().addScaledVector(c.side, w), tip.clone().addScaledVector(c.side, -w)];
        const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
        let n0 = V3().crossVectors(c.side, c.ax).normalize();
        const mid = base.clone().addScaledVector(c.ax, c.s * 0.5); if (n0.dot(V3().subVectors(mid, C)) < 0) n0.negate();
        corners.forEach((v, j) => {
          const q = V3((v.x - C.x) / ext.x, (v.y - C.y) / ext.y, (v.z - C.z) / ext.z), dd = q.length(), cn = q.clone().normalize();
          const n = n0.clone().multiplyScalar(0.3).addScaledVector(cn, 0.7).normalize();
          P.set([v.x, v.y, v.z], (k * 4 + j) * 3); N.set([n.x, n.y, n.z], (k * 4 + j) * 3); UV.set(uvs[j], (k * 4 + j) * 2);
          const ao = Math.min(1, Math.max(0, (dd - 0.25) / 0.75)) * (0.75 + 0.25 * Math.min(1, Math.max(0, q.y * 0.5 + 0.5)));
          A.set([ao, j >= 2 ? 1 : 0.3, ((k * 0.618) % 1), 0], (k * 4 + j) * 4);
        });
        I.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
      });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2));
      g.setAttribute('aLeaf', new T.BufferAttribute(A, 4)); g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
    });
    const barkG = mergeTubes(bark);
    return { bark: barkG, c0: geo[0], c1: geo[1], c2: geo[2], crown: { c: C, ext } };
  }
  function mergeTubes(gs) {
    let nv = 0, ni = 0; for (const g of gs) { nv += g.attributes.position.count; ni += g.index.count; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new Uint32Array(ni);
    let o = 0, oi = 0;
    for (const g of gs) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2); const ix = g.index.array; for (let i = 0; i < ix.length; i++) I[oi + i] = ix[i] + o; o += g.attributes.position.count; oi += ix.length; g.dispose(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2)); g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
  }

  /* ── the leaves' shader: cut out of their cards; lit through the bent normals; dark deep in the crown, lit at its
     edge, glowing where the sun shines through them; the crown leaning on the breeze and each twig fluttering ── */
  const LEAF_VS = `
uniform float uTime;
attribute vec4 aLeaf;   /* how far out in the crown (0 deep inside, 1 at its edge), how free to flutter, a die */
varying vec2 vUv; varying vec3 vN; varying vec3 vWPos; varying vec3 vL;
void main(){
  vUv = uv; vec4 p = vec4(position, 1.0); vec3 n = normal, o = vec3(0.0);
  float hy = max(position.y, 0.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix*p; n = mat3(instanceMatrix)*n; o = instanceMatrix[3].xyz;
  #else
    o = vec3(floor(p.x/9.0)*9.0, 0.0, floor(p.z/9.0)*9.0);
  #endif
  vec4 wp = modelMatrix*p; o = (modelMatrix*vec4(o, 1.0)).xyz;
  float ph = o.x*0.21 + o.z*0.17;
  wp.xz += vec2(0.55, -0.83)*(sin(uTime*0.62 + ph) + 0.4*sin(uTime*1.37 + ph*1.7))*0.0011*hy*hy;
  wp.xyz += normalize(n + vec3(0.0, 0.3, 0.0))*sin(uTime*2.7 + dot(wp.xyz, vec3(1.3, 0.9, 1.7)) + aLeaf.z*6.0)*0.035*aLeaf.y;
  vWPos = wp.xyz; vN = normalize(mat3(modelMatrix)*n); vL = aLeaf.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
  const LEAF_FS = `
${GLSL.COMMON}
${GLSL.ART}
uniform sampler2D map; uniform vec3 uAmbF, uKeyDirT, uKeyColT, uTint; uniform float uCut; uniform vec4 uFog;
varying vec2 vUv; varying vec3 vN; varying vec3 vWPos; varying vec3 vL;
void main(){
  vec4 tx = texture2D(map, vUv);
  if (tx.a < uCut) discard;
  vec3 n = normalize(vN), V = normalize(cameraPosition - vWPos);
  float ao = vL.x, ndl = dot(n, uKeyDirT);
  vec3 a = tx.rgb*uTint*(0.9 + 0.2*vL.z);
  /* lit from the sky above and the key light, both less the deeper in; through the leaves where the light is behind */
  vec3 L = uAmbF*(0.62 + 0.38*n.y)*(0.38 + 0.62*ao) + uKeyColT*(max(ndl, 0.0)*mix(0.25, 1.0, ao*ao) + max(-ndl, 0.0)*0.22*ao);
  L += uKeyColT*pow(max(dot(-V, uKeyDirT), 0.0), 6.0)*0.6*ao;
  if (length(vWPos.xz - vec2(${Layout.camp.x.toFixed(2)}, ${Layout.camp.z.toFixed(2)})) < 19.0 || length(vWPos.xz - uVanPos.xz) < 12.0 || (uHead.w > 0.001 && length(vWPos.xz - uHead.xz) < 34.0)) L += artLight(vWPos, n)*(0.5 + 0.5*ao);
  vec3 c = a*L; float d = distance(vWPos, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))));
  c = mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
  gl_FragColor = vec4(c, 1.0);
}`;
  const texCache = {};
  function leafTex(kind, k) {
    const key = kind + k; if (texCache[key]) return texCache[key];
    const t = Mats.tex(twigCard(kind, 101 + k * 37 + kind.length * 11)); t.anisotropy = 1; return (texCache[key] = t);
  }
  /* a species' three leaf materials (three cards, painted apart) and its bark */
  const matCache = {};
  function materials(kind) {
    if (matCache[kind]) return matCache[kind];
    const tint = { almond: [1, 1, 1], casuarina: [1, 1, 1], hibiscus: [1, 1, 1], grape: [1, 1, 1], scrub: [1, 1, 1] }[kind];
    const leaves = [0, 1, 2].map(k => new T.ShaderMaterial({ uniforms: Object.assign({}, Mats.U, { map: { value: leafTex(kind, k) }, uCut: { value: 0.42 }, uTint: { value: new T.Vector3(...tint) } }), vertexShader: LEAF_VS, fragmentShader: LEAF_FS, side: T.DoubleSide }));
    const depth = [0, 1, 2].map(k => Mats.cutoutDepth(leafTex(kind, k), 0.42));
    const barkCol = { almond: '#6e6458', casuarina: '#5a4a3e', hibiscus: '#665a4c', grape: '#6a5a48', scrub: '#5a4b3a' }[kind];
    const bark = Mats.lit({ map: Mats.tex(barkTex(kind.length * 7 + 3, barkCol), { repeat: true }), roughness: 0.95 });
    return (matCache[kind] = { leaves, depth, bark });
  }
  return { grow, materials, twigCard, SPECIES };
})();
