/* ─────────────────────────────────────────────────────────────
   models/flora/leaves.js — the forest's leaves.
   FloraLeaf.cards(kind) paints three sprays of a species' leaves,
     each on its own card: a twig branching into shoots, the leaves
     set along them as the species sets them (in two ranks, in
     rosettes, pinnate), each leaf its own size and shape, its
     veins drawn as the species' are (a dipterocarp's ladder of
     straight parallel veins), a few young ones flushed red, a few
     turned yellow, many with the holes and bites and spots every
     rainforest leaf collects. A normal map painted with them folds
     each leaf along its midrib and arches it.
   FloraLeaf.material(kind) lights them as leaves are lit: the sky,
     the sun wrapped a little round a thin leaf, light through it
     from behind, yellow-green, a soft sheen rather than a shine;
     and moves them on the wind (FloraLeaf.WIND, shared with the
     bark): the whole tree leaning and rocking, each branch on its
     own rhythm, the leaves fluttering.
   ───────────────────────────────────────────────────────────── */
const FloraLeaf = (() => {
  const T = THREE, TAU = Math.PI * 2, S = 512;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hsla = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${(clamp(s) * 100).toFixed(1)}%,${(clamp(l) * 100).toFixed(1)}%,${a})`;
  const enc = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return `rgb(${Math.round((x / l * 0.5 + 0.5) * 255)},${Math.round((y / l * 0.5 + 0.5) * 255)},${Math.round((z / l * 0.5 + 0.5) * 255)})`; };

  /* ── each species' leaves. card: the metres a card spans; L: a leaf's length (m) and W its width as a share of it;
     shape of its outline, tip: how long its drip tip is (a share of its length); veins: pairs of lateral veins, their
     angle off the midrib; arr: how they are set on the twig ('two' ranks, a 'rosette' at the twig's end, 'pinnate'
     leaflets on a rachis); twigs: shoots per card, leaves per shoot; colours (hue, saturation, lightness) of the upper
     side and its jitter, the underside (and the share of leaves showing it), young flush, turning yellow; how many
     are damaged; the twig's colour; how glossy (for the shader: gloss, its sharpness, light through it) ── */
  const KINDS = {
    /* Shorea: elliptic, 9-17 cm, short drip tip, 16-20 pairs of straight parallel veins; thinly leathery, dark green and
       glossy above, coppery-yellow beneath; flushing red */
    dipt: { back: [1.32, 1.04, 0.58], card: 0.72, L: [0.09, 0.16], W: [0.5, 0.6], shape: 'elliptic', tip: 0.08, veins: [15, 19], va: 1.0, arr: 'two', twigs: [3, 4], per: [5, 8],
      top: [100, 0.38, 0.27], tj: [8, 0.07, 0.045], under: [42, 0.4, 0.38], underK: 0.05, flush: [354, 0.42, 0.34], flushK: 0.12, yellow: 0.025, dmg: 0.4, twig: [28, 0.3, 0.22], gloss: [0.22, 22, 0.85] },
    /* Koompassia: pinnate, 7-12 small ovate leaflets 3-4 cm, glossy above, pale glaucous beneath: a fine, airy spray */
    koomp: { back: [1.18, 1.2, 1.08], card: 0.62, L: [0.03, 0.042], W: [0.38, 0.45], shape: 'ovate', tip: 0.05, veins: [5, 7], va: 0.9, arr: 'pinnate', twigs: [3, 4], per: [4, 6], leaflets: [7, 11],
      top: [90, 0.44, 0.32], tj: [8, 0.07, 0.045], under: [80, 0.15, 0.5], underK: 0.07, flush: [60, 0.45, 0.42], flushK: 0.12, yellow: 0.03, dmg: 0.15, twig: [30, 0.22, 0.32], gloss: [0.2, 20, 1.0] },
    /* the same sprays, bigger: a branchlet of several shoots on a card a metre or more across, for the crowns of the big
       trees, seen from tens of metres off */
    diptL: null, koompL: null, laurelL: null, mangoL: null, rambL: null, durianL: null, cempL: null, figL: null, casuarL: null, terminL: null, barringL: null, hibiscL: null,
    /* a strangler fig: thick, glossy, dark, the midrib and veins paler; spirally set toward the twig's end; figs in pairs */
    fig: { back: [1.15, 1.22, 0.9], card: 0.62, L: [0.08, 0.14], W: [0.45, 0.55], shape: 'elliptic', tip: 0.04, veins: [7, 10], va: 1.1, arr: 'rosette', twigs: [3, 4], per: [6, 9], figs: 0.5,
      top: [108, 0.38, 0.18], tj: [6, 0.06, 0.03], under: [90, 0.22, 0.34], underK: 0.04, flush: [70, 0.35, 0.38], flushK: 0.15, yellow: 0.05, dmg: 0.3, twig: [35, 0.18, 0.3], gloss: [0.3, 26, 0.6] },
    /* a canopy tree of the laurel kind: elliptic, 10-18 cm, glossy, paler veins */
    laurel: { back: [1.22, 1.22, 0.95], card: 0.7, L: [0.1, 0.18], W: [0.36, 0.44], shape: 'elliptic', tip: 0.07, veins: [7, 9], va: 0.85, arr: 'two', twigs: [3, 4], per: [4, 7],
      top: [98, 0.34, 0.24], tj: [8, 0.08, 0.04], under: [85, 0.2, 0.42], underK: 0.04, flush: [18, 0.45, 0.4], flushK: 0.12, yellow: 0.05, dmg: 0.4, twig: [30, 0.25, 0.28], gloss: [0.24, 24, 0.85] },
    /* a canopy tree of the sapodilla kind: obovate, clustered at the twig's end, rusty beneath */
    sapot: { back: [1.4, 0.95, 0.58], card: 0.66, L: [0.08, 0.15], W: [0.4, 0.5], shape: 'obovate', tip: 0.0, veins: [10, 14], va: 1.1, arr: 'rosette', twigs: [3, 4], per: [6, 9],
      top: [96, 0.32, 0.21], tj: [7, 0.07, 0.035], under: [28, 0.42, 0.35], underK: 0.06, flush: [40, 0.4, 0.4], flushK: 0.12, yellow: 0.05, dmg: 0.35, twig: [22, 0.3, 0.25], gloss: [0.2, 22, 0.8] },
    /* the understory's big thin leaves: oblong, 20-30 cm, a long drip tip, lighter green */
    under: { back: [1.15, 1.2, 0.95], card: 0.85, L: [0.18, 0.3], W: [0.3, 0.38], shape: 'oblong', tip: 0.12, veins: [10, 14], va: 0.95, arr: 'two', twigs: [2, 3], per: [3, 5],
      top: [100, 0.38, 0.26], tj: [8, 0.08, 0.04], under: [92, 0.25, 0.4], underK: 0.04, flush: [355, 0.35, 0.4], flushK: 0.10, yellow: 0.06, dmg: 0.5, twig: [30, 0.2, 0.3], gloss: [0.16, 18, 1.1] },
    /* Rhizophora: elliptic, 10-15 cm, thick and glossy, opposite, in pairs at the twig's end, a small point at the tip;
       pale yellow-green beneath, speckled */
    rhizo: { back: [1.32, 1.32, 0.75], card: 0.6, L: [0.1, 0.14], W: [0.42, 0.5], shape: 'elliptic', tip: 0.02, veins: [8, 11], va: 1.0, arr: 'opposite', twigs: [3, 4], per: [3, 4],
      top: [100, 0.42, 0.2], tj: [6, 0.06, 0.03], under: [72, 0.35, 0.42], underK: 0.06, flush: [70, 0.4, 0.38], flushK: 0.12, yellow: 0.06, dmg: 0.25, twig: [25, 0.25, 0.25], gloss: [0.32, 28, 0.6] },
    /* Avicennia: opposite, elliptic, 5-8 cm, grey-green above, silvery white beneath */
    avic: { back: [1.7, 1.7, 1.6], card: 0.5, L: [0.05, 0.08], W: [0.4, 0.48], shape: 'elliptic', tip: 0.02, veins: [6, 8], va: 0.9, arr: 'opposite', twigs: [3, 4], per: [4, 6],
      top: [95, 0.2, 0.3], tj: [6, 0.05, 0.035], under: [80, 0.08, 0.6], underK: 0.09, flush: [80, 0.2, 0.38], flushK: 0.07, yellow: 0.04, dmg: 0.2, twig: [35, 0.15, 0.35], gloss: [0.15, 18, 0.8] } };

  /* ── the beach trees' ── */
  Object.assign(KINDS, {
    /* a casuarina (rhu): no leaves to speak of, but jointed grey-green branchlets 10-25 cm hanging in soft bunches */
    casuar: { back: [1.1, 1.12, 1.05], card: 0.8, L: [0.14, 0.28], W: [0.018, 0.026], shape: 'needle', tip: 0, veins: [0, 0], va: 1, arr: 'needles', twigs: [4, 5], per: [60, 90],
      top: [85, 0.16, 0.38], tj: [8, 0.06, 0.05], under: [90, 0.15, 0.32], underK: 0.0, flush: [80, 0.3, 0.34], flushK: 0.0, yellow: 0.04, dmg: 0, twig: [30, 0.2, 0.25], gloss: [0.1, 12, 0.9] },
    /* a sea almond (Terminalia catappa): obovate, 15-25 cm, clustered at the twigs' ends, glossy; many turning red, orange
       and yellow before they fall */
    termin: { back: [1.15, 1.2, 0.95], card: 0.85, L: [0.15, 0.25], W: [0.5, 0.6], shape: 'obovate', tip: 0.0, veins: [8, 11], va: 1.05, arr: 'rosette', twigs: [3, 4], per: [6, 9], red: 0.1,
      top: [100, 0.42, 0.24], tj: [6, 0.06, 0.04], under: [92, 0.25, 0.4], underK: 0.05, flush: [70, 0.4, 0.4], flushK: 0.1, yellow: 0.07, dmg: 0.3, twig: [25, 0.3, 0.3], gloss: [0.3, 26, 0.8] },
    /* a sea poison tree (Barringtonia asiatica): huge, 30-40 cm, obovate, thick and shining, in rosettes */
    barring: { back: [1.15, 1.2, 0.95], card: 0.95, L: [0.24, 0.38], W: [0.4, 0.48], shape: 'obovate', tip: 0.0, veins: [10, 14], va: 1.0, arr: 'rosette', twigs: [2, 3], per: [6, 9], red: 0.03,
      top: [104, 0.42, 0.22], tj: [6, 0.06, 0.03], under: [92, 0.25, 0.38], underK: 0.04, flush: [70, 0.4, 0.38], flushK: 0.08, yellow: 0.05, dmg: 0.25, twig: [28, 0.3, 0.3], gloss: [0.36, 30, 0.7] },
    /* a sea hibiscus (Hibiscus tiliaceus): heart-shaped, 10-15 cm, soft, pale beneath with fine hairs */
    hibisc: { back: [1.3, 1.32, 1.2], card: 0.7, L: [0.09, 0.15], W: [0.85, 0.95], shape: 'cordate', tip: 0.04, veins: [5, 7], va: 0.75, arr: 'two', twigs: [3, 4], per: [4, 6],
      top: [92, 0.4, 0.28], tj: [6, 0.06, 0.04], under: [85, 0.15, 0.5], underK: 0.1, flush: [80, 0.4, 0.4], flushK: 0.1, yellow: 0.08, dmg: 0.35, twig: [30, 0.25, 0.32], gloss: [0.15, 18, 1.0] } });
  /* ── the fruit trees' ── */
  Object.assign(KINDS, {
    /* a mango: lanceolate, 15-30 cm, leathery, in whorls at the twigs' ends; very dark green and glossy, paler beneath;
       the new flush limp and wine-red to bronze */
    mango: { back: [1.2, 1.24, 1.0], card: 0.8, L: [0.15, 0.28], W: [0.2, 0.26], shape: 'elliptic', tip: 0.06, veins: [16, 24], va: 1.05, arr: 'rosette', twigs: [3, 4], per: [9, 13],
      top: [108, 0.4, 0.19], tj: [6, 0.06, 0.035], under: [95, 0.28, 0.35], underK: 0.08, flush: [348, 0.42, 0.3], flushK: 0.22, yellow: 0.03, dmg: 0.22, twig: [40, 0.3, 0.3], gloss: [0.32, 28, 0.7] },
    /* a rambutan: pinnate, two to four pairs of elliptic leaflets 7-15 cm, dull green above, paler beneath */
    ramb: { back: [1.15, 1.2, 1.0], card: 0.7, L: [0.07, 0.13], W: [0.38, 0.46], shape: 'elliptic', tip: 0.04, veins: [8, 11], va: 1.0, arr: 'pinnate', twigs: [3, 4], per: [3, 5], leaflets: [4, 7],
      top: [98, 0.36, 0.26], tj: [7, 0.06, 0.04], under: [90, 0.2, 0.4], underK: 0.06, flush: [40, 0.4, 0.38], flushK: 0.12, yellow: 0.04, dmg: 0.3, twig: [30, 0.25, 0.3], gloss: [0.2, 22, 0.85] },
    /* a durian: oblong, 10-15 cm, a long point, two-ranked; glossy green above, beneath silvered and golden with scales */
    durian: { back: [1.5, 1.12, 0.55], card: 0.7, L: [0.1, 0.16], W: [0.28, 0.36], shape: 'oblong', tip: 0.08, veins: [10, 14], va: 0.95, arr: 'two', twigs: [3, 4], per: [5, 8],
      top: [100, 0.36, 0.22], tj: [6, 0.06, 0.035], under: [38, 0.45, 0.45], underK: 0.16, flush: [55, 0.4, 0.42], flushK: 0.1, yellow: 0.03, dmg: 0.25, twig: [30, 0.35, 0.3], gloss: [0.28, 26, 0.75] },
    /* a cempedak: elliptic to obovate, 10-20 cm, thick, glossy dark green, spirally set */
    cemp: { back: [1.15, 1.2, 0.95], card: 0.75, L: [0.1, 0.19], W: [0.45, 0.55], shape: 'obovate', tip: 0.02, veins: [7, 10], va: 1.0, arr: 'rosette', twigs: [3, 4], per: [6, 9],
      top: [108, 0.4, 0.18], tj: [6, 0.06, 0.03], under: [92, 0.25, 0.34], underK: 0.05, flush: [80, 0.4, 0.4], flushK: 0.1, yellow: 0.05, dmg: 0.25, twig: [30, 0.25, 0.28], gloss: [0.3, 26, 0.7] } });
  for (const [big, small, card, tw, per] of [['diptL', 'dipt', 1.15, [5, 6], [6, 9]], ['koompL', 'koomp', 1.0, [5, 6], [5, 7]], ['laurelL', 'laurel', 1.1, [5, 6], [5, 8]],
    ['mangoL', 'mango', 1.1, [5, 6], [9, 13]], ['figL', 'fig', 1.05, [5, 6], [6, 9]], ['casuarL', 'casuar', 1.1, [5, 6], [60, 90]], ['terminL', 'termin', 1.15, [5, 6], [6, 9]], ['barringL', 'barring', 1.2, [4, 5], [6, 9]], ['hibiscL', 'hibisc', 1.0, [5, 6], [4, 6]], ['rambL', 'ramb', 1.0, [5, 6], [3, 5]], ['durianL', 'durian', 1.0, [5, 6], [5, 8]], ['cempL', 'cemp', 1.05, [5, 6], [6, 9]]])
    KINDS[big] = Object.assign({}, KINDS[small], { card, twigs: tw, per });
  /* a leaf's half-width at t along its midrib (0 at the stalk, 1 at the tip), as a share of its half-width */
  function halfW(shape, t, tip) {
    let w;
    if (shape === 'obovate') w = Math.pow(Math.sin(Math.PI * Math.pow(t, 1.35)), 0.75);
    else if (shape === 'cordate') w = Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.62) * 1.02)), 0.7) * (t < 0.08 ? 0.75 + 3 * t : 1);
    else if (shape === 'needle') w = t < 0.9 ? 1 : (1 - t) / 0.1;
    else if (shape === 'oblong') w = Math.pow(Math.sin(Math.PI * t), 0.45) * (1 - 0.15 * t);
    else if (shape === 'ovate') w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.7)), 0.85);
    else w = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.9)), 0.8);
    /* (the drip tip: the blade narrowing quickly into a slender point) */
    if (tip > 0 && t > 1 - tip * 2.2) { const q = (1 - t) / (tip * 2.2); w *= Math.pow(q, 1.4) * (1 + 0.3 * (1 - q)); }
    return w;
  }
  /* the leaf's outline, stalk at the origin and pointing along +x, as points */
  function outline(lf) {
    const n = 30, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, w = halfW(lf.shape, t, lf.tip) * lf.W * 0.5 * (1 + lf.asym); pts.push([t * lf.L, lf.bend * lf.L * t * t - w]); }
    for (let i = n; i >= 0; i--) { const t = i / n, w = halfW(lf.shape, t, lf.tip) * lf.W * 0.5 * (1 - lf.asym); pts.push([t * lf.L, lf.bend * lf.L * t * t + w]); }
    return pts;
  }
  const pathOf = (a, pts) => { a.beginPath(); a.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) a.lineTo(pts[i][0], pts[i][1]); a.closePath(); };

  /* ── one leaf painted ── */
  function paintLeaf(a, lf, r, P) {
    const pts = outline(lf), [h, s, l] = lf.hsl, L = lf.L, W = lf.W;
    a.save(); a.translate(lf.x, lf.y); a.rotate(lf.ang);
    pathOf(a, pts);
    const g = a.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, hsla(h + 4, s * 0.9, l * 0.82)); g.addColorStop(0.5, hsla(h, s, l)); g.addColorStop(1, hsla(h - 3, s * 0.95, l * 1.08));
    a.fillStyle = g; a.fill();
    a.save(); pathOf(a, pts); a.clip();
    /* the fold: one half a shade lighter than the other */
    const f = a.createLinearGradient(0, -W * 0.5, 0, W * 0.5), k = lf.under ? 0.5 : 1;
    f.addColorStop(0, `rgba(255,255,230,${0.07 * k})`); f.addColorStop(0.49, 'rgba(255,255,230,0)'); f.addColorStop(0.51, 'rgba(0,10,0,0)'); f.addColorStop(1, `rgba(0,10,0,${0.12 * k})`);
    a.fillStyle = f; a.fillRect(-2, -W, L + 4, 2 * W);
    /* the lateral veins: straight and parallel, curving forward near the margin (a dipterocarp's ladder) */
    const vh = lf.under ? h - 8 : h - 12, vl = lf.under ? Math.min(0.7, l * 1.25) : Math.min(0.6, l * 1.45 + 0.04);
    a.strokeStyle = hsla(vh, s * 0.75, vl, lf.under ? 0.55 : 0.3); a.lineCap = 'round';
    const nv = lf.veins, mid = t => lf.bend * L * t * t;
    for (let i = 0; i < nv; i++) {
      const t = 0.06 + 0.84 * (i + 0.5) / nv;
      for (const sd of [-1, 1]) {
        const w = halfW(lf.shape, t, lf.tip) * W * 0.5, ex = t * L + Math.cos(lf.va) * w * 1.15, ey = mid(t) + sd * w * 0.94;
        a.lineWidth = Math.max(0.5, W * 0.012); a.beginPath(); a.moveTo(t * L, mid(t));
        a.quadraticCurveTo(t * L + Math.cos(lf.va) * w * 0.7, mid(t) + sd * w * 0.68, ex, ey); a.stroke();
      }
    }
    /* the fine net between them, faint */
    if (L > 40) { a.strokeStyle = hsla(vh, s * 0.6, vl, 0.08); a.lineWidth = 0.5; for (let i = 0; i < nv * 3; i++) { const t = 0.1 + 0.8 * r(), w = halfW(lf.shape, t, lf.tip) * W * 0.5 * (r() * 1.6 - 0.8); a.beginPath(); a.moveTo(t * L, mid(t) + w); a.lineTo(t * L + L * 0.04, mid(t) + w + (r() - 0.5) * W * 0.12); a.stroke(); } }
    /* mottling, and the marks of a life: epiphylls (a grey-green film of lichen on an old leaf), a brown spot with a yellow
       halo, a scorched tip */
    for (let i = 0, n = Math.round(L * W / 70); i < n; i++) { a.fillStyle = r() < 0.5 ? 'rgba(0,8,0,0.06)' : 'rgba(255,250,200,0.045)'; a.beginPath(); a.arc(r() * L, mid(0.5) + (r() - 0.5) * W, 0.6 + r() * 2.4, 0, TAU); a.fill(); }
    if (lf.epi) for (let i = 0; i < 3 + r() * 4; i++) { const x = (0.2 + 0.7 * r()) * L, y = mid(0.5) + (r() - 0.5) * W * 0.7, rr = W * (0.08 + 0.15 * r()), rg = a.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, 'rgba(150,160,130,0.35)'); rg.addColorStop(1, 'rgba(150,160,130,0)'); a.fillStyle = rg; a.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    if (lf.spot) { const x = (0.3 + 0.5 * r()) * L, y = mid(0.5) + (r() - 0.5) * W * 0.5, rr = W * (0.07 + 0.08 * r()), rg = a.createRadialGradient(x, y, 0, x, y, rr * 2.2);
      rg.addColorStop(0, 'rgba(70,40,15,0.9)'); rg.addColorStop(0.42, 'rgba(95,60,22,0.8)'); rg.addColorStop(0.5, 'rgba(190,170,60,0.55)'); rg.addColorStop(1, 'rgba(190,170,60,0)'); a.fillStyle = rg; a.fillRect(x - rr * 2.2, y - rr * 2.2, rr * 4.4, rr * 4.4); }
    if (lf.scorch) { const x = L * (0.86 + 0.14 * r()), rg = a.createRadialGradient(x, mid(0.95), 0, x, mid(0.95), W * 0.5); rg.addColorStop(0, 'rgba(110,75,35,0.9)'); rg.addColorStop(0.6, 'rgba(130,100,45,0.5)'); rg.addColorStop(1, 'rgba(130,100,45,0)'); a.fillStyle = rg; a.fillRect(x - W, mid(0.95) - W, 2 * W, 2 * W); }
    a.restore();
    /* the rim, a little darker; the midrib, pale, thick at the stalk and fading toward the tip */
    a.strokeStyle = hsla(h, s, l * 0.6, 0.45); a.lineWidth = 0.8; pathOf(a, pts); a.stroke();
    a.strokeStyle = lf.under ? hsla(h - 10, s * 0.6, Math.min(0.75, l * 1.4), 0.85) : hsla(h - 18, s * 0.65, Math.min(0.68, l * 1.7 + 0.08), 0.6);
    for (const [t0, t1, lw] of [[0, 0.5, 1.9], [0.45, 0.97, 0.9]]) { a.lineWidth = Math.max(0.6, lw * W / 30); a.beginPath(); for (let i = 0; i <= 8; i++) { const t = t0 + (t1 - t0) * i / 8; i ? a.lineTo(t * L, mid(t)) : a.moveTo(t * L, mid(t)); } a.stroke(); }
    /* the holes insects ate, the bites out of its margin (cut clean through: transparent) */
    if (lf.holes || lf.bites) {
      a.globalCompositeOperation = 'destination-out'; a.fillStyle = '#000';
      for (let i = 0; i < lf.holes; i++) { const x = (0.15 + 0.7 * r()) * L, y = mid(0.5) + (r() - 0.5) * W * 0.6, rr = 1.2 + r() * Math.min(7, W * 0.12); a.beginPath(); for (let k = 0; k < 7; k++) { const an = k / 7 * TAU, q = rr * (0.6 + 0.6 * r()); k ? a.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q) : a.moveTo(x + Math.cos(an) * q, y + Math.sin(an) * q); } a.closePath(); a.fill(); }
      for (let i = 0; i < lf.bites; i++) { const t = 0.25 + 0.6 * r(), sd = r() < 0.5 ? -1 : 1, w = halfW(lf.shape, t, lf.tip) * W * 0.5, rr = W * (0.1 + 0.12 * r()); a.beginPath(); a.arc(t * L, mid(t) + sd * (w + rr * 0.35), rr, 0, TAU); a.fill(); }
      a.globalCompositeOperation = 'source-over';
    }
    a.restore();
  }
  /* the same leaf in the normal map: folded along its midrib, arched from stalk to tip, tilted its own way (tangent space:
     x along the card's width, y up it, z out of its face) */
  function normLeaf(b, lf) {
    const pts = outline(lf), c = Math.cos(lf.ang), s = Math.sin(lf.ang), A = [c, -s], Pp = [-s, -c];
    const nAt = (t, side) => { const ta = lf.ta + lf.arch * (2 * t - 1), tp = lf.tp - side * lf.fold; return enc(ta * A[0] + tp * Pp[0], ta * A[1] + tp * Pp[1], 1); };
    b.save(); b.translate(lf.x, lf.y); b.rotate(lf.ang); pathOf(b, pts); b.save(); b.clip();
    for (const side of [-1, 1]) { const g = b.createLinearGradient(-lf.L * 0.1, 0, lf.L * 1.05, 0); g.addColorStop(0, nAt(0, side)); g.addColorStop(0.5, nAt(0.5, side)); g.addColorStop(1, nAt(1, side)); b.fillStyle = g; b.fillRect(-lf.L * 0.2, side < 0 ? -lf.W : 0, lf.L * 1.5, lf.W); }
    b.restore(); b.restore();
  }

  /* ── a card's layout: the twig and its shoots, the leaves along them ── */
  function layout(K, r) {
    const ppm = S / K.card, leaves = [], twigs = [], figs = [];
    /* (the twig rises from the card's foot, a little curved, toward its top) */
    const nT = K.twigs[0] + Math.floor(r() * (K.twigs[1] - K.twigs[0] + 1));
    const bez = (P0, P1, P2, P3) => t => { const u = 1 - t; return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]; };
    const main = bez([S / 2 + (r() - 0.5) * 20, S - 2], [S / 2 + (r() - 0.5) * 60, S * 0.7], [S / 2 + (r() - 0.5) * 80, S * 0.4], [S / 2 + (r() - 0.5) * 60, S * 0.2]);
    twigs.push({ f: main, w0: 5.5, w1: 2.4 });
    const shoots = [{ f: main, a0: -Math.PI / 2, t0: 0.35 }];
    for (let k = 1; k < nT; k++) {
      const t = 0.15 + 0.6 * (k - 0.5) / (nT - 1 || 1) + (r() - 0.5) * 0.08, p = main(t), sd = k % 2 ? -1 : 1, an = -Math.PI / 2 + sd * (0.55 + r() * 0.45), len = S * (0.32 + 0.22 * r());
      const q = [p[0] + Math.cos(an) * len, p[1] + Math.sin(an) * len], f = bez(p, [p[0] + Math.cos(an) * len * 0.35, p[1] + Math.sin(an) * len * 0.35 - 10], [q[0] - Math.cos(an) * len * 0.2, q[1] - 20], q);
      twigs.push({ f, w0: 3.6, w1: 1.6 }); shoots.push({ f, a0: an, t0: 0.2 });
    }
    for (const sh of shoots) {
      const n = K.per[0] + Math.floor(r() * (K.per[1] - K.per[0] + 1));
      const leafAt = (t, ang, size, depth, tip) => {
        const [bx, by] = sh.f(t), Lm = K.L[0] + (K.L[1] - K.L[0]) * size, L = Lm * ppm, W = L * (K.W[0] + (K.W[1] - K.W[0]) * r());
        leaves.push(leafOf(K, r, bx, by, ang, L, W, depth, tip));
      };
      if (K.arr === 'pinnate') {
        /* (pinnate leaves along the shoot: each a rachis with its leaflets in pairs, a little off opposite) */
        for (let i = 0; i < n; i++) {
          const t = sh.t0 + (1 - sh.t0) * (i + 0.5) / n, [bx, by] = sh.f(t), sd = i % 2 ? -1 : 1, an = sh.a0 + sd * (0.6 + r() * 0.5), rl = (0.12 + 0.08 * r()) * ppm, nl = K.leaflets[0] + Math.floor(r() * (K.leaflets[1] - K.leaflets[0] + 1));
          const ex = bx + Math.cos(an) * rl, ey = by + Math.sin(an) * rl; twigs.push({ f: t2 => [bx + (ex - bx) * t2, by + (ey - by) * t2], w0: 1.4, w1: 0.7, green: true });
          for (let j = 0; j < nl; j++) { const u = 0.15 + 0.85 * j / Math.max(1, nl - 1), px = bx + (ex - bx) * u, py = by + (ey - by) * u, s2 = j % 2 ? -1 : 1, Lm = K.L[0] + (K.L[1] - K.L[0]) * r(), L = Lm * ppm;
            leaves.push(leafOf(K, r, px, py, an + s2 * (1.0 + r() * 0.35), L, L * (K.W[0] + (K.W[1] - K.W[0]) * r()), r())); }
        }
      } else if (K.arr === 'rosette') {
        /* (crowded toward the shoot's end, spiralling) */
        for (let i = 0; i < n; i++) { const t = 0.55 + 0.45 * Math.pow(i / Math.max(1, n - 1), 0.6), an = sh.a0 + (i * 2.4 % TAU) - Math.PI + (r() - 0.5) * 0.3; leafAt(Math.min(1, t), an, 0.4 + 0.6 * r(), r()); }
        if (K.figs && r() < K.figs) for (let i = 0; i < 2 + Math.floor(r() * 3); i++) { const [bx, by] = sh.f(0.4 + 0.5 * r()); figs.push([bx + (r() - 0.5) * 14, by + (r() - 0.5) * 14, (0.012 + 0.005 * r()) * ppm, r()]); }
      } else if (K.arr === 'needles') {
        /* (bunches of fine jointed branchlets from the shoot, hanging, each a long thin needle, a few crossing) */
        for (let i = 0; i < n; i++) { const t = sh.t0 + (1 - sh.t0) * (i + 0.5) / n, [bx, by] = sh.f(t), an = Math.PI / 2 + (r() - 0.5) * 0.8, Lm = K.L[0] + (K.L[1] - K.L[0]) * r(), L = Lm * ppm;
          leaves.push(leafOf(K, r, bx, by, an, L, Math.max(1.2, L * (K.W[0] + (K.W[1] - K.W[0]) * r())), r())); }
      } else if (K.arr === 'opposite') {
        for (let i = 0; i < n; i++) { const t = sh.t0 + (1 - sh.t0) * (0.35 + 0.65 * (i + 0.5) / n); for (const sd of [-1, 1]) leafAt(t, sh.a0 + sd * (0.75 + r() * 0.4) + (i % 2) * 0.5 * sd, 0.4 + 0.6 * r(), r()); }
        leafAt(1, sh.a0 + (r() - 0.5) * 0.4, 0.3 + 0.3 * r(), 0.9, true);
      } else {
        /* (two ranks, alternating, the leaves held out flat either side of the shoot, the youngest at its end) */
        for (let i = 0; i < n; i++) { const t = sh.t0 + (1 - sh.t0) * (i + 0.4) / n, sd = i % 2 ? -1 : 1; leafAt(t, sh.a0 + sd * (0.75 + r() * 0.45), 0.5 + 0.5 * r() * (1 - 0.3 * t), r()); }
        leafAt(1, sh.a0 + (r() - 0.5) * 0.35, 0.35 + 0.3 * r(), 0.95, true);
      }
    }
    return { leaves, twigs, figs };
  }
  function leafOf(K, r, x, y, ang, L, W, depth, tip) {
    let [h, s, l] = K.top, under = false, flush = false;
    h += (r() - 0.5) * 2 * K.tj[0]; s += (r() - 0.5) * 2 * K.tj[1]; l += (r() - 0.5) * 2 * K.tj[2];
    const u = r();
    /* (young leaves only at a shoot's tip, limp and red-brown; now and then an old one yellowing) */
    if (tip && u < K.flushK) { flush = true; [h, s, l] = K.flush; h += (r() - 0.5) * 12; s *= 0.8; l *= 0.85 + 0.2 * r(); L *= 0.75; W *= 0.8; }
    else if (!tip && u < K.yellow) { h = 46 + r() * 12; s = 0.45 + 0.15 * r(); l = 0.34 + 0.1 * r(); }
    else if (!tip && K.red && u < K.yellow + K.red) { h = 2 + r() * 26; s = 0.55 + 0.2 * r(); l = 0.3 + 0.1 * r(); }
    else if (r() < K.underK) { under = true; [h, s, l] = K.under; h += (r() - 0.5) * 8; l *= 0.92 + 0.16 * r(); }
    l *= 0.7 + 0.3 * depth;                                 /* (the back of the spray in its own shade) */
    const dm = flush ? 0 : K.dmg;
    return { x, y, ang: ang + (r() - 0.5) * 0.1, L, W, shape: K.shape, tip: K.tip, veins: K.veins[0] + Math.floor(r() * (K.veins[1] - K.veins[0] + 1)), va: K.va, depth, hsl: [h, s, l], under,
      asym: (r() - 0.5) * 0.1, bend: (r() - 0.5) * 0.12, holes: r() < dm * 0.6 ? 1 + Math.floor(r() * 4) : 0, bites: r() < dm * 0.35 ? 1 + Math.floor(r() * 2) : 0,
      spot: r() < dm * 0.18, epi: !flush && r() < dm * 0.3, scorch: r() < dm * 0.12,
      ta: (r() - 0.5) * 1.0, tp: (r() - 0.5) * 1.0, fold: 0.2 + r() * 0.3, arch: 0.15 + r() * 0.3 };
  }
  /* one card painted: its colour and normal map as pixels (top row first) */
  function paintCard(kind, seed) {
    const K = KINDS[kind], c = document.createElement('canvas'), n = document.createElement('canvas'); c.width = c.height = n.width = n.height = S;
    const a = c.getContext('2d', { willReadFrequently: true }), b = n.getContext('2d', { willReadFrequently: true }), r = Models.rng(seed);
    b.fillStyle = 'rgb(128,128,255)'; b.fillRect(0, 0, S, S);
    const { leaves, twigs, figs } = layout(K, r);
    /* the twigs, thinning toward their ends: woody, the youngest parts green */
    a.lineCap = 'round';
    for (const tw of twigs) for (let i = 0; i < 14; i++) {
      const p = tw.f(i / 14), q = tw.f((i + 1) / 14), t = i / 14, [h, s, l] = K.twig, g = tw.green ? 1 : t * t;
      a.strokeStyle = hsla(h + 60 * g, s + 0.1 * g, l + 0.04 * g); a.lineWidth = tw.w0 + (tw.w1 - tw.w0) * t; a.beginPath(); a.moveTo(p[0], p[1]); a.lineTo(q[0], q[1]); a.stroke();
      b.strokeStyle = enc(0, 0.25, 1); b.lineWidth = a.lineWidth; b.beginPath(); b.moveTo(p[0], p[1]); b.lineTo(q[0], q[1]); b.stroke();
    }
    leaves.sort((p, q) => p.depth - q.depth);
    for (const lf of leaves) {
      /* (its stalk, from the twig) */
      a.strokeStyle = hsla(K.twig[0] + 50, 0.3, 0.3); a.lineWidth = Math.max(1, lf.W * 0.04); a.beginPath(); a.moveTo(lf.x, lf.y); a.lineTo(lf.x + Math.cos(lf.ang) * 3, lf.y + Math.sin(lf.ang) * 3); a.stroke();
      paintLeaf(a, lf, r, K); normLeaf(b, lf);
    }
    for (const [x, y, rr, k] of figs) { const g = a.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr); const c1 = k < 0.5 ? ['#e0a030', '#b46a18'] : ['#c4402a', '#7c2018']; g.addColorStop(0, c1[0]); g.addColorStop(1, c1[1]); a.fillStyle = g; a.beginPath(); a.arc(x, y, rr, 0, TAU); a.fill(); b.fillStyle = enc(0, 0, 1); b.beginPath(); b.arc(x, y, rr, 0, TAU); b.fill(); }
    return { col: a.getImageData(0, 0, S, S).data, nor: b.getImageData(0, 0, S, S).data };
  }
  const CUT = 0.4, cardCache = new Map();
  /* a species' three cards as textures: [{ map, nmap }] */
  function cards(kind) {
    if (cardCache.has(kind)) return cardCache.get(kind);
    const out = [0, 1, 2].map(k => { const { col, nor } = paintCard(kind, 301 + k * 53 + kind.length * 17); return Trees.texOf(new Uint8Array(col.buffer.slice(0)), new Uint8Array(nor.buffer.slice(0)), S, S, CUT); });
    cardCache.set(kind, out); return out;
  }

  /* ── the wind, for leaves and bark alike (aWind: the branch's own phase, how far it sways (m), how far up the tree it
     is as a share of the tree's height, the tree's height (m)) ── */
  const U = { uWindV: { value: new T.Vector4(0.55, -0.83, 0.55, 0.6) } };
  const WIND = `
uniform vec4 uWindV;     /* the wind: its direction (x, z), how strong (0 still, 1 a stiff breeze), how gusty */
vec3 floraWind(vec3 wp, vec3 o, float sc, vec4 W, float flut, float ph, vec3 n, float t){
  vec2 wd = normalize(uWindV.xy + vec2(1e-4)); float ws = uWindV.z;
  float tph = dot(o.xz, vec2(0.0131, 0.0173))*6.2832;
  float gust = 1.0 + uWindV.w*(0.55*sin(t*0.23 + tph*0.5)*sin(t*0.071 + tph) + 0.25*sin(t*0.53 + tph*1.3));
  float h = W.z, H = max(1.0, W.w*sc);
  /* the whole tree leaning on the wind and rocking back, most at its top (a tall tree slower) */
  float lean = (0.55 + 0.45*sin(t*(0.3 + 1.2/sqrt(H)) + tph))*h*h*ws*gust*H*0.0045;
  vec3 d = vec3(wd.x, 0.0, wd.y)*lean;
  /* each branch on its own rhythm, out and back, a little up and down */
  float bph = W.x*6.2832, bs = (sin(t*(1.05 + 0.6*fract(W.x*7.13)) + bph) + 0.35*sin(t*2.3 + bph*1.7))*W.y*ws*gust;
  d += vec3(wd.x*0.8 + 0.3*sin(bph), 0.25, wd.y*0.8 + 0.3*cos(bph))*bs*sc;
  /* the leaves fluttering, quick and small, most at a card's free end */
  d += n*sin(t*(5.5 + 3.0*ph) + ph*37.0 + dot(wp, vec3(1.3, 0.9, 1.7)))*flut*(0.2 + 0.8*ws)*0.03*sc;
  return d;
}`;
  const VS = `
uniform float uTime;
attribute vec4 aLeaf;   /* how far out in the crown (0 deep inside, 1 at its edge), how free to flutter, a die, which way the card faces */
attribute vec3 aTan, aBit; attribute vec4 aWind;
varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vB; varying vec3 vWPos; varying vec4 vL; varying vec3 vTint;
${WIND}
void main(){
  vUv = uv; vec4 p = vec4(position, 1.0); vec3 n = normal, tg = aTan, bt = aBit, o = vec3(0.0); float sc = 1.0;
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #endif
  #ifdef USE_INSTANCING
    p = instanceMatrix*p; mat3 im = mat3(instanceMatrix); n = im*n; tg = im*tg; bt = im*bt; o = instanceMatrix[3].xyz; sc = length(im[1]);
  #endif
  vec4 wp = modelMatrix*p; o = (modelMatrix*vec4(o, 1.0)).xyz;
  mat3 mm = mat3(modelMatrix); vN = normalize(mm*n); vT = normalize(mm*tg); vB = normalize(mm*bt);
  wp.xyz += floraWind(wp.xyz, o, sc, aWind, aLeaf.y, aLeaf.z, normalize(cross(vT, vB)), uTime);
  vWPos = wp.xyz; vL = aLeaf;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
  const FS = `
#include <packing>
${GLSL.COMMON}
${GLSL.ART}
uniform sampler2D map, nmap; uniform vec3 uAmbF, uKeyDirT, uKeyColT, uTint, uBack; uniform float uCut; uniform vec4 uFog;
uniform vec3 uLeafK;                  /* its sheen, how broad it is, light through the leaves */
uniform sampler2D uLeafShM; uniform mat4 uLeafShX; uniform vec4 uLeafShA; uniform vec2 uLeafShS;
varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vB; varying vec3 vWPos; varying vec4 vL; varying vec3 vTint;
float leafShadow(vec3 wp){
  if (uLeafShA.w < 0.5 || length(wp.xz - uLeafShA.xy) > uLeafShA.z) return 1.0;
  vec4 sc = uLeafShX*vec4(wp, 1.0); sc.xyz /= sc.w;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  vec2 tx = 1.5/uLeafShS; float z = sc.z - 0.0025;
  return 0.25*(step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(-tx.x, -tx.y)))) + step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(tx.x, -tx.y))))
             + step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(-tx.x, tx.y)))) + step(z, unpackRGBAToDepth(texture2D(uLeafShM, sc.xy + vec2(tx.x, tx.y)))));
}
void main(){
  vec4 tx = texture2D(map, vUv);
  if (tx.a < uCut) discard;
  vec3 V = normalize(cameraPosition - vWPos), Tg = normalize(vT), Bt = normalize(vB), Nc = normalize(cross(Tg, Bt))*vL.w;
  float face = dot(Nc, V) >= 0.0 ? 1.0 : -1.0;
  vec3 tn = texture2D(nmap, vUv).xyz*2.0 - 1.0;
  vec3 nl = normalize(Tg*tn.x + Bt*tn.y + Nc*max(tn.z, 0.05))*face;
  vec3 nb = normalize(vN);
  float ao = vL.x, ndl = dot(nl, uKeyDirT), cr = dot(nb, uKeyDirT), sh = leafShadow(vWPos);
  /* how much of the sun gets this far into the crown */
  float vis = mix(0.1, 1.0, smoothstep(-0.4, 0.6, cr))*mix(0.32, 1.0, ao)*sh;
  vec3 alb = tx.rgb*uTint*vTint;
  /* (from beneath, a spray shows the leaves' undersides: paler, and in some species coppery or silvery) */
  if (face < 0.0) alb = min(alb*uBack, vec3(1.0));
  /* the sky's light, less deep in the crown and on the leaves turned down */
  vec3 c = alb*uAmbF*(0.42 + 0.58*clamp(nb.y*0.5 + 0.5, 0.0, 1.0))*(0.22 + 0.78*ao)*(0.85 + 0.15*nl.y);
  /* the sun, wrapped a little round a thin leaf */
  c += alb*uKeyColT*clamp((ndl + 0.2)/1.2, 0.0, 1.0)*vis;
  /* through the leaf from behind: yellow-green, brightest looking toward the light; strongest at the crown's edge,
     where one leaf is all there is in the way */
  float back = clamp(-ndl, 0.0, 1.0), toward = pow(max(dot(-V, uKeyDirT), 0.0), 3.0);
  c += alb*vec3(1.08, 1.16, 0.42)*uKeyColT*back*(0.3 + 0.9*toward)*uLeafK.z*mix(0.12, 1.0, ao*ao)*sh*smoothstep(-0.9, 0.2, cr);
  /* a soft sheen, not a shine: the cuticle's broad gloss toward the sun, and the sky glancing off the leaves facing up */
  vec3 Hh = normalize(uKeyDirT + V); float F = 0.04 + 0.96*pow(1.0 - max(dot(nl, V), 0.0), 5.0);
  c += uKeyColT*uLeafK.x*pow(max(dot(nl, Hh), 0.0), uLeafK.y)*(0.3 + 0.7*F)*vis*step(0.0, ndl);
  c += uAmbF*uLeafK.x*0.4*F*max(nl.y, 0.0)*(0.3 + 0.7*ao);
  /* and the light the crown scatters about inside itself, green from leaf to leaf */
  c += alb*uKeyColT*vec3(0.8, 1.0, 0.55)*0.045*(0.4 + 0.6*ao)*(0.3 + 0.7*sh);
  if (torchNear(vWPos) || length(vWPos.xz - uVanPos.xz) < 12.0 || (uHead.w > 0.001 && length(vWPos.xz - uHead.xz) < 34.0)) c += alb*artLight(vWPos, nl)*(0.5 + 0.5*ao);
  float d = distance(vWPos, cameraPosition);
  c = mix(c, uFog.rgb, 1.0 - exp(-max(d - 40.0, 0.0)/(1400.0/max(uFog.w, 0.3))));
  c = mix(c, uFog.rgb*0.9, (1.0 - exp(-d/180.0))*0.12*uFog.w);
  gl_FragColor = vec4(c, 1.0);
  /* (no more than the renderer's own finish: nothing where the frame is drawn to a target, as the engine's is) */
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
  /* its depth for the shadow map: cut out by the card's alpha, moved by the same wind */
  const DEPTH_VS = `
uniform float uTime; attribute vec4 aLeaf; attribute vec3 aTan, aBit; attribute vec4 aWind; varying vec2 vUv;
${WIND}
void main(){ vUv = uv; vec4 p = vec4(position, 1.0); vec3 o = vec3(0.0); float sc = 1.0;
  #ifdef USE_INSTANCING
    p = instanceMatrix*p; o = instanceMatrix[3].xyz; sc = length(mat3(instanceMatrix)[1]);
  #endif
  vec4 wp = modelMatrix*p; o = (modelMatrix*vec4(o, 1.0)).xyz;
  wp.xyz += floraWind(wp.xyz, o, sc, aWind, aLeaf.y, aLeaf.z, vec3(0.0, 1.0, 0.0), uTime);
  gl_Position = projectionMatrix*viewMatrix*wp; }`;
  const DEPTH_FS = `
#include <packing>
uniform sampler2D map; uniform float uCut; varying vec2 vUv;
void main(){ if (texture2D(map, vUv).a < uCut) discard; gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`;
  const matCache = new Map();
  /* a species' leaf materials (one for each of its three cards) and their shadow depths */
  function material(kind) {
    if (matCache.has(kind)) return matCache.get(kind);
    const K = KINDS[kind], cs = cards(kind);
    const leaves = cs.map(cd => new T.ShaderMaterial({ uniforms: Object.assign({}, Mats.U, U, { map: { value: cd.map }, nmap: { value: cd.nmap }, uCut: { value: CUT }, uTint: { value: new T.Vector3(1, 1, 1) }, uBack: { value: new T.Vector3(...K.back) }, uLeafK: { value: new T.Vector3(...K.gloss) } }), vertexShader: VS, fragmentShader: FS, side: T.DoubleSide }));
    const depth = cs.map(cd => new T.ShaderMaterial({ uniforms: Object.assign({ map: { value: cd.map }, uCut: { value: CUT }, uTime: Mats.U.uTime }, U), vertexShader: DEPTH_VS, fragmentShader: DEPTH_FS, side: T.DoubleSide }));
    const out = { leaves, depth, K }; matCache.set(kind, out); return out;
  }
  /* the bark moved by the same wind (a lit bark material from FloraKit.barkMat, patched once more) */
  const windMats = new Map();
  function windBark(m) {
    if (windMats.has(m)) return windMats.get(m);
    const w = m.clone(), prev = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
    w.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uWindV = U.uWindV; sh.uniforms.uTime = Mats.U.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aWind;\nuniform float uTime;\n' + WIND)
        .replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 wpW = vec4(transformed, 1.0); vec3 oW = vec3(0.0); float scW = 1.0;
    #ifdef USE_INSTANCING
      wpW = instanceMatrix*wpW; oW = instanceMatrix[3].xyz; scW = length(mat3(instanceMatrix)[1]);
    #endif
    wpW = modelMatrix*wpW; oW = (modelMatrix*vec4(oW, 1.0)).xyz;
    mvPosition.xyz += (viewMatrix*vec4(floraWind(wpW.xyz, oW, scW, aWind, 0.0, 0.0, vec3(0.0, 1.0, 0.0), uTime), 0.0)).xyz;
    gl_Position = projectionMatrix*mvPosition; }`);
    };
    w.customProgramCacheKey = () => key + '-wind';
    windMats.set(m, w); return w;
  }

  /* ── cards into a geometry. Each card: p (where its twig leaves the branch), ax (up the card), side (across it), s (its
     size, m), ao, the crown's shading normal n, its wind (phase, sway, height share, tree height), how far it droops.
     Folded along its middle and bowed a little, so it never shows as a flat sheet edge on (lite: one flat quad) ── */
  function cardsGeo(list, lite) {
    const vpc = lite ? 4 : 9, tpc = lite ? 2 : 8, n = list.length;
    const P = new Float32Array(n * vpc * 3), Nn = new Float32Array(n * vpc * 3), TA = new Float32Array(n * vpc * 3), BI = new Float32Array(n * vpc * 3), UV = new Float32Array(n * vpc * 2), A = new Float32Array(n * vpc * 4), WN = new Float32Array(n * vpc * 4), I = new Uint32Array(n * tpc * 3);
    const gu = lite ? [0, 1] : [0, 0.5, 1], gv = lite ? [0, 1] : [0, 0.5, 1];
    list.forEach((c, k) => {
      const fn = [c.side[1] * c.ax[2] - c.side[2] * c.ax[1], c.side[2] * c.ax[0] - c.side[0] * c.ax[2], c.side[0] * c.ax[1] - c.side[1] * c.ax[0]];
      const sg = fn[0] * c.n[0] + fn[1] * c.n[1] + fn[2] * c.n[2] < 0 ? -1 : 1;
      let vi = 0;
      for (const v of gv) for (const u of gu) {
        const fold = lite ? 0 : (0.5 - Math.abs(u - 0.5)) * 2 * 0.1 * c.s * sg, droop = -(c.droop || 0) * v * v * c.s;
        const x = c.p[0] + c.side[0] * (u - 0.5) * c.s + c.ax[0] * v * c.s + fn[0] * fold, y = c.p[1] + c.side[1] * (u - 0.5) * c.s + c.ax[1] * v * c.s + fn[1] * fold + droop, z = c.p[2] + c.side[2] * (u - 0.5) * c.s + c.ax[2] * v * c.s + fn[2] * fold;
        const o3 = (k * vpc + vi) * 3, o2 = (k * vpc + vi) * 2, o4 = (k * vpc + vi) * 4;
        P[o3] = x; P[o3 + 1] = y; P[o3 + 2] = z; Nn.set(c.n, o3); TA.set(c.side, o3); BI.set(c.ax, o3); UV[o2] = u; UV[o2 + 1] = v;
        A[o4] = c.ao; A[o4 + 1] = 0.25 + 0.75 * v; A[o4 + 2] = c.ph; A[o4 + 3] = sg;
        WN[o4] = c.wind[0]; WN[o4 + 1] = c.wind[1]; WN[o4 + 2] = c.wind[2]; WN[o4 + 3] = c.wind[3];
        vi++;
      }
      const b = k * vpc, o = k * tpc * 3;
      if (lite) I.set([b, b + 1, b + 3, b, b + 3, b + 2], o);
      else { let q = 0; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const a = b + j * 3 + i; I.set([a, a + 1, a + 4, a, a + 4, a + 3], o + q); q += 6; } }
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3)); g.setAttribute('uv', new T.BufferAttribute(UV, 2));
    g.setAttribute('aTan', new T.BufferAttribute(TA, 3)); g.setAttribute('aBit', new T.BufferAttribute(BI, 3)); g.setAttribute('aLeaf', new T.BufferAttribute(A, 4)); g.setAttribute('aWind', new T.BufferAttribute(WN, 4));
    g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingSphere(); return g;
  }
  return { KINDS, cards, material, windBark, cardsGeo, U, WIND, paintCard };
})();

/* a species' three leaf cards side by side, flat, for looking them over in the studio */
Models.add('flora/leafcards', (o = {}) => {
  const T = THREE, g = new T.Group(), kind = o.kind || 'dipt', cs = FloraLeaf.cards(kind), K = FloraLeaf.KINDS[kind];
  cs.forEach((cd, i) => {
    const m = new T.Mesh(new T.PlaneGeometry(K.card, K.card), new T.MeshStandardMaterial({ map: cd.map, normalMap: cd.nmap, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.6 }));
    m.position.set((i - 1) * K.card * 1.05, K.card / 2, 0); m.userData.noShadow = true; g.add(m);
  });
  return g;
});
