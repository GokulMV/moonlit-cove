/* ─────────────────────────────────────────────────────────────
   pages.js — typesets what the cove says onto the paper objects
   in it, each in its own hand:
     notes    stories from the build, a journal by the fire
     plans    the architecture, drawn on blueprints in the basket
     stack    what it is built with, a checklist on the clipboard
     letter   the message in the bottle, handwritten
   Every document flows its blocks onto as many pages as it needs.
   ───────────────────────────────────────────────────────────── */
const Pages = (() => {
  const FN = {
    serif: (w, s, it) => `${it ? 'italic ' : ''}${w} ${s}px Fraunces, 'Iowan Old Style', Georgia, serif`,
    mono: (w, s) => `${w} ${s}px 'JetBrains Mono', Menlo, monospace`,
    hand: (w, s) => `${w} ${s}px Caveat, 'Segoe Print', 'Bradley Hand', cursive`
  };
  const decode = t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  function runsOf(html) {
    const out = [], re = /<b>(.*?)<\/b>/g; let last = 0, m;
    while ((m = re.exec(html))) { if (m.index > last) out.push({ t: decode(html.slice(last, m.index)), b: false }); out.push({ t: decode(m[1]), b: true }); last = re.lastIndex; }
    if (last < html.length) out.push({ t: decode(html.slice(last)), b: false });
    return out;
  }
  /* greedy wrap over styled runs; breaks only at spaces, so "hours</b>." never strands the full stop */
  function wrap(a, runs, width, fN, fB) {
    const chunks = []; let cur = null, sp = false;
    for (const r of runs) for (const w of r.t.split(/(\s+)/)) {
      if (!w) continue;
      if (/^\s+$/.test(w)) { sp = true; continue; }
      a.font = r.b ? fB : fN; const piece = { t: w, b: r.b, w: a.measureText(w).width };
      if (cur && !sp) { cur.parts.push(piece); cur.w += piece.w; }
      else { if (cur) { a.font = cur.parts[cur.parts.length - 1].b ? fB : fN; cur.spW = a.measureText(' ').width; } cur = { parts: [piece], w: piece.w, sp }; chunks.push(cur); }
      sp = false;
    }
    const lines = []; let line = [], lw = 0;
    for (const c of chunks) {
      const gap = line.length ? (fN && (a.font = fN, a.measureText(' ').width)) : 0;
      if (line.length && lw + gap + c.w > width) { lines.push(line); line = []; lw = 0; }
      if (line.length) { line.push({ t: ' ', b: false, w: gap }); lw += gap; }
      c.parts.forEach(p => line.push(p)); lw += c.w;
    }
    if (line.length) lines.push(line);
    return lines;
  }
  const lineW = ln => ln.reduce((s, w) => s + w.w, 0);
  function drawLine(a, line, x, y, fN, fB, col, colB) { for (const w of line) { a.font = w.b ? fB : fN; a.fillStyle = w.b ? (colB || col) : col; a.fillText(w.t, x, y); x += w.w; } }
  function spaced(a, t, x, y, sp, align = 'center') { const ws = [...t].map(ch => a.measureText(ch).width); const tw = ws.reduce((p, q) => p + q, 0) + sp * (ws.length - 1); let cx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x; a.textAlign = 'left'; [...t].forEach((ch, i) => { a.fillText(ch, cx, y); cx += ws[i] + sp; }); return tw; }
  const diamond = (a, x, y, s) => { a.beginPath(); a.moveTo(x, y - s); a.lineTo(x + s, y); a.lineTo(x, y + s); a.lineTo(x - s, y); a.closePath(); a.fill(); };
  const rnd = seed => { let s = seed * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const meas = canvas(8, 8).getContext('2d');

  /* a kit of blocks for one theme. R.a is the context being drawn into. */
  function kit(T) {
    const R = { a: meas }, B = [], X0 = T.M.l, TW = T.PW - T.M.l - T.M.r;
    const add = b => { B.push(b); return b; };
    const k = {
      R, B, TW,
      gap: h => add({ h, gap: true, draw: () => {} }),
      brk: () => add({ brk: true, h: 0, draw: () => {} }),
      custom: (h, draw, keep) => add({ h, keep, draw: y => draw(R.a, y) }),
      kicker: (t, keep = true) => add({ h: 40, keep, draw: y => { const a = R.a; a.fillStyle = T.accent; a.font = FN.mono(500, 18); spaced(a, t.toUpperCase(), T.PW / 2, y + 24, 5); } }),
      title: (t, sec, font) => add({ h: 76, keep: true, sec, draw: y => { const a = R.a; a.fillStyle = T.ink; a.textAlign = 'center'; a.font = font || FN.serif(400, 50, true); a.fillText(t, T.PW / 2, y + 54); } }),
      orn: () => add({ h: 54, orn: true, draw: y => { const a = R.a; a.strokeStyle = T.accent; a.lineWidth = 1.5; a.beginPath(); a.moveTo(T.PW / 2 - 110, y + 27); a.lineTo(T.PW / 2 - 16, y + 27); a.moveTo(T.PW / 2 + 16, y + 27); a.lineTo(T.PW / 2 + 110, y + 27); a.stroke(); a.fillStyle = T.accent; diamond(a, T.PW / 2, y + 27, 7); } }),
      center: (t, font, col, h, base) => add({ h, draw: y => { const a = R.a; a.textAlign = 'center'; a.fillStyle = col; a.font = font; a.fillText(t, T.PW / 2, y + base); } }),
      /* wrapped rich text; bullet adds a dot; hand uses the handwriting */
      para: (html, o = {}) => {
        const size = o.size || 25, lh = o.lh || Math.round(size * 1.48), ind = o.indent || 0, w = (o.width || TW) - ind;
        const fN = o.font || FN.serif(400, size, o.italic), fB = o.fontB || FN.serif(600, size, o.italic);
        const lines = wrap(meas, runsOf(html), w, fN, fB);
        return add({ h: lines.length * lh + (o.after ?? 6), keep: o.keep, draw: y => {
          const a = R.a; a.textAlign = 'left';
          if (o.bullet && /^\d+$/.test(o.bullet)) { const cx = X0 + (o.x || 0) + 16, cy = y + lh * 0.52; a.strokeStyle = T.accent; a.lineWidth = 2; a.beginPath(); a.arc(cx, cy, 15, 0, Math.PI * 2); a.stroke(); a.fillStyle = T.accent; a.font = FN.mono(500, 17); a.textAlign = 'center'; a.fillText(o.bullet, cx, cy + 6); a.textAlign = 'left'; }
          else if (o.bullet) { a.fillStyle = T.accent; if (o.bullet === 'check') { a.strokeStyle = T.accent; a.lineWidth = 2.5; a.strokeRect(X0 + (o.x || 0), y + lh * 0.24, 22, 22); a.beginPath(); a.moveTo(X0 + (o.x || 0) + 4, y + lh * 0.24 + 12); a.lineTo(X0 + (o.x || 0) + 10, y + lh * 0.24 + 19); a.lineTo(X0 + (o.x || 0) + 26, y + lh * 0.24 - 2); a.stroke(); } else { a.beginPath(); a.arc(X0 + (o.x || 0) + 8, y + lh * 0.6, 4.2, 0, Math.PI * 2); a.fill(); } }
          lines.forEach((ln, i) => drawLine(a, ln, X0 + (o.x || 0) + ind + (o.align === 'center' ? (w - lineW(ln)) / 2 : 0), y + lh * 0.76 + i * lh, fN, fB, o.color || T.ink, o.colorB || T.ink)); } });
      },
      /* a menu row: name, dotted leader, price */
      row: (l, r, o = {}) => add({ h: o.h || 48, keep: o.keep !== false, draw: y => {
        const a = R.a; a.textAlign = 'right'; a.fillStyle = T.accent; a.font = o.rf || FN.mono(500, 19); a.fillText(r, T.PW - T.M.r, y + 35); const rw = a.measureText(r).width;
        a.textAlign = 'left'; a.fillStyle = T.ink; a.font = o.lf || FN.serif(600, 31); const maxL = TW - rw - 24; a.fillText(l, X0, y + 36, maxL); const lw = Math.min(maxL, a.measureText(l).width);
        if (o.dots !== false) { a.fillStyle = T.dots || 'rgba(42,32,23,0.45)'; for (let x = X0 + lw + 14; x < T.PW - T.M.r - rw - 12; x += 10) { a.beginPath(); a.arc(x, y + 30, 1.7, 0, Math.PI * 2); a.fill(); } } } })
    };
    return k;
  }
  /* flow blocks onto pages: headings keep with what follows, breaks start new pages */
  function flow(B, avail) {
    const pages = [[]]; let y = 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b.brk) { if (pages[pages.length - 1].length) { pages.push([]); y = 0; } continue; }
      let need = b.h; for (let j = i; j < B.length - 1 && B[j].keep && !B[j + 1].brk; j++) need += B[j + 1].h;
      if (y + need > avail && pages[pages.length - 1].length) { pages.push([]); y = 0; if (b.gap || b.orn) continue; }
      pages[pages.length - 1].push({ b, y }); y += b.h;
    }
    return pages.filter(p => p.length);
  }
  function render(T, K, pages, deco) {
    return pages.map((p, i) => { const c = canvas(T.PW, T.PH), a = c.getContext('2d'); K.R.a = a; T.paper(a, i, pages.length); p.forEach(({ b, y }) => b.draw(T.M.t + y)); if (deco) deco(a, i, pages.length); return c; });
  }

  /* ── paper stocks ── */
  function grain(a, W, H, seed, n, dark, light) { const r = rnd(seed); for (let i = 0; i < n; i++) { a.fillStyle = `rgba(${r() < 0.5 ? dark : light},${0.03 + r() * 0.05})`; a.fillRect(r() * W, r() * H, 1 + r() * 2, 1); } }
  const JOURNAL = { PW: 1000, PH: 1400, M: { l: 150, r: 84, t: 92, b: 110 }, ink: '#1f2a3d', accent: '#7a2f1f', muted: '#4c5568',
    paper(a, i) { const W = this.PW, H = this.PH; a.fillStyle = '#f4eedf'; a.fillRect(0, 0, W, H); grain(a, W, H, i + 31, 2200, '80,70,50', '255,255,245');
      a.strokeStyle = 'rgba(70,110,170,0.22)'; a.lineWidth = 1.4; for (let y = 160; y < H - 60; y += 37) { a.beginPath(); a.moveTo(0, y); a.lineTo(W, y); a.stroke(); }
      a.strokeStyle = 'rgba(190,60,60,0.35)'; a.lineWidth = 2; a.beginPath(); a.moveTo(this.M.l - 26, 0); a.lineTo(this.M.l - 26, H); a.stroke();
      const g = a.createLinearGradient(0, 0, 70, 0); g.addColorStop(0, 'rgba(60,40,20,0.22)'); g.addColorStop(1, 'rgba(60,40,20,0)'); a.fillStyle = g; a.fillRect(0, 0, 70, H); } };
  const LETTER = { PW: 1000, PH: 1420, M: { l: 104, r: 96, t: 100, b: 76 }, ink: '#2b2a4a', accent: '#7c3b1e', muted: '#5a4a3a',
    paper(a, i) { const W = this.PW, H = this.PH; a.fillStyle = '#efe0bd'; a.fillRect(0, 0, W, H);
      const g = a.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.86); g.addColorStop(0, 'rgba(255,248,225,0.45)'); g.addColorStop(0.75, 'rgba(160,110,50,0.12)'); g.addColorStop(1, 'rgba(110,70,30,0.42)'); a.fillStyle = g; a.fillRect(0, 0, W, H);
      grain(a, W, H, i + 51, 3200, '110,75,35', '255,248,230');
      const r = rnd(i + 7); for (let s = 0; s < 5; s++) { const x = r() * W, y = r() * H, rr = 30 + r() * 90, sg = a.createRadialGradient(x, y, 0, x, y, rr); sg.addColorStop(0, 'rgba(140,95,40,0.08)'); sg.addColorStop(1, 'rgba(140,95,40,0)'); a.fillStyle = sg; a.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      for (const y of [H / 3, H * 2 / 3]) { const cg = a.createLinearGradient(0, y - 10, 0, y + 10); cg.addColorStop(0, 'rgba(255,250,235,0)'); cg.addColorStop(0.45, 'rgba(255,250,235,0.35)'); cg.addColorStop(0.55, 'rgba(110,75,35,0.18)'); cg.addColorStop(1, 'rgba(110,75,35,0)'); a.fillStyle = cg; a.fillRect(0, y - 10, W, 20); } } };
  const PLANS = { PW: 1400, PH: 990, M: { l: 86, r: 86, t: 92, b: 150 }, ink: '#eef4ff', accent: '#9cc7ff', muted: '#b9d1f0',
    paper(a, i) { const W = this.PW, H = this.PH; const g = a.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1f4f8c'); g.addColorStop(1, '#173e70'); a.fillStyle = g; a.fillRect(0, 0, W, H);
      grain(a, W, H, i + 71, 2600, '10,25,60', '200,225,255');
      a.lineWidth = 1; for (let x = 0; x <= W; x += 25) { a.strokeStyle = x % 100 ? 'rgba(170,205,255,0.07)' : 'rgba(170,205,255,0.15)'; a.beginPath(); a.moveTo(x, 0); a.lineTo(x, H); a.stroke(); }
      for (let y = 0; y <= H; y += 25) { a.strokeStyle = y % 100 ? 'rgba(170,205,255,0.07)' : 'rgba(170,205,255,0.15)'; a.beginPath(); a.moveTo(0, y); a.lineTo(W, y); a.stroke(); }
      a.strokeStyle = 'rgba(225,238,255,0.8)'; a.lineWidth = 3; a.strokeRect(40, 40, W - 80, H - 80); a.lineWidth = 1; a.strokeRect(50, 50, W - 100, H - 100); } };
  const PACKING = { PW: 1000, PH: 1400, M: { l: 92, r: 80, t: 236, b: 96 }, ink: '#22314a', accent: '#a5432a', muted: '#5d6474',
    paper(a, i) { const W = this.PW, H = this.PH; a.fillStyle = '#f7f3e8'; a.fillRect(0, 0, W, H); grain(a, W, H, i + 91, 2000, '90,90,80', '255,255,255');
      a.strokeStyle = 'rgba(80,120,170,0.18)'; a.lineWidth = 1.3; for (let y = 250; y < H - 70; y += 44) { a.beginPath(); a.moveTo(60, y); a.lineTo(W - 60, y); a.stroke(); }
      const g = a.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, 'rgba(40,30,20,0.25)'); g.addColorStop(1, 'rgba(40,30,20,0)'); a.fillStyle = g; a.fillRect(0, 0, W, 120); } };
  /* phones read a narrower sheet: the same type on 760 px instead of 1000, so it lands bigger on screen */
  function compact(T, ratio) { const k = 760 / T.PW, M = {}; for (const [n, v] of Object.entries(T.M)) M[n] = Math.round(v * (n === 't' || n === 'b' ? 0.85 : 0.68));
    return Object.assign(Object.create(T), { PW: 760, PH: Math.round(760 * (ratio || T.PH / T.PW)), M }); }

  /* ── the journal by the fire: stories from the build, in pen on ruled paper ── */
  function notes(C, o = {}) {
    const T = o.compact ? compact(JOURNAL) : JOURNAL, K = kit(T), { gap, para, custom } = K, R = 37;
    const hand = (w, s) => FN.hand(w, s);
    C.notes.forEach((n, i) => {
      if (i) gap(R);
      custom(R * 2, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.accent; a.font = hand(700, 54); a.fillText(n.title, T.M.l, y + 64, K.TW); }, true).sec = n.title;
      para(n.problem, { font: hand(500, 35), fontB: hand(700, 35), size: 35, lh: R, color: T.muted, colorB: T.muted, keep: true, after: 0 });
      para(n.fix, { font: hand(500, 35), fontB: hand(700, 35), size: 35, lh: R, after: 0 });
    });
    const pages = flow(K.B, T.PH - T.M.t - T.M.b);
    const out = render(T, K, pages, (a, i) => { a.textAlign = 'right'; a.fillStyle = T.muted; a.font = hand(500, 30); a.fillText(String(i + 1), T.PW - 70, T.PH - 52); });
    const per = []; pages.forEach((p, i) => { const s = p.find(({ b }) => b.sec); per.push(s ? s.b.sec : (per[i - 1] || '')); });
    /* the first page: a title, and what is inside */
    const c0 = canvas(T.PW, T.PH), a = c0.getContext('2d'); T.paper(a, 0);
    a.textAlign = 'center'; a.fillStyle = T.accent; a.font = hand(700, 96); a.fillText('Build notes', T.PW / 2, Math.round(T.PH * 0.2), T.PW - 80);
    a.fillStyle = T.muted; a.font = hand(500, 40); a.fillText('stories from making the cove', T.PW / 2, Math.round(T.PH * 0.25), T.PW - 80);
    const first = {}; pages.forEach((p, i) => p.forEach(({ b }) => { if (b.sec && !(b.sec in first)) first[b.sec] = i + 1; }));
    const rows = C.notes.map(n => [n.title, first[n.title] || '']), top = T.PH * 0.33, step = Math.min(R * 2, (T.PH * 0.6) / rows.length);
    rows.forEach(([t, pg], i) => { const y = Math.round(top + i * step); a.textAlign = 'right'; a.fillStyle = T.muted; a.font = hand(500, 36); a.fillText(String(pg), T.PW - T.M.r - 20, y);
      a.textAlign = 'left'; a.fillStyle = T.ink; a.font = hand(600, 42); a.fillText(t, T.M.l + 20, y, T.PW - T.M.r - T.M.l - 110); });
    a.textAlign = 'center'; a.fillStyle = T.muted; a.font = hand(500, 34); a.fillText(C.name, T.PW / 2, T.PH - 120);
    const canvases = [c0, ...out];
    if (pages.length % 2 === 0) { const b = canvas(T.PW, T.PH), x = b.getContext('2d'); T.paper(x, 98); x.textAlign = 'center'; x.fillStyle = T.muted; x.font = hand(500, 44); x.fillText('…and the next note is still being written.', T.PW / 2, T.PH / 2, T.PW - 100); canvases.backInner = b; }
    return { canvases, labels: ['Contents', ...per, 'The end'], pages: pages.length };
  }

  /* ── the letter in the bottle ── */
  function letter(C, o = {}) {
    const T = o.compact ? compact(LETTER) : LETTER, K = kit(T), { para, custom } = K, L = C.letter, hand = s => FN.hand(500, s), handB = s => FN.hand(700, s);
    para(L.to, { font: hand(46), fontB: handB(46), size: 46, lh: 56, after: 16 });
    L.body.forEach(p => para(p, { font: hand(38), fontB: handB(38), size: 38, lh: 47, after: 18 }));
    para(L.close, { font: hand(42), fontB: handB(42), size: 42, lh: 50, after: 0, x: 440, width: K.TW - 440 });
    para(L.sign, { font: handB(58), fontB: handB(58), size: 58, lh: 64, after: 16, x: 480, width: K.TW - 480, color: T.accent });
    custom(36, (a, y) => { a.strokeStyle = 'rgba(80,55,30,0.35)'; a.lineWidth = 1.5; a.setLineDash([6, 8]); a.beginPath(); a.moveTo(T.M.l, y + 18); a.lineTo(T.PW - T.M.r, y + 18); a.stroke(); a.setLineDash([]); }, true);
    custom(50, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.accent; a.font = handB(42); a.fillText('Where to find me', T.M.l, y + 38); }, true);
    const rows = [['Email', C.contact.email], ['LinkedIn', C.links[0][2]], ['GitHub', C.links[1][2]]];
    rows.forEach(([k, v], i) => custom(46, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.muted; a.font = hand(36); a.fillText(k, T.M.l + 10, y + 34); a.fillStyle = T.ink; a.font = handB(38); a.fillText(v, T.M.l + 200, y + 34, K.TW - 200); }, i < rows.length - 1));
    const pages = flow(K.B, T.PH - T.M.t - T.M.b);
    return { canvases: render(T, K, pages), pages: pages.length };
  }

  /* ── blueprints: the cove's architecture, one drawing per sheet ── */
  function ink(a) {
    const LINE = 'rgba(234,243,255,0.92)', SOFT = 'rgba(190,218,255,0.6)', FILL = 'rgba(150,195,255,0.08)', TXT = '#eef4ff', DIM = '#b9d1f0', ACC = '#9cc7ff';
    const rr = (x, y, w, h, r) => { a.beginPath(); a.moveTo(x + r, y); a.arcTo(x + w, y, x + w, y + h, r); a.arcTo(x + w, y + h, x, y + h, r); a.arcTo(x, y + h, x, y, r); a.arcTo(x, y, x + w, y, r); a.closePath(); };
    const head = (p, q, s = 13) => { const ang = Math.atan2(q[1] - p[1], q[0] - p[0]); a.beginPath(); a.moveTo(q[0], q[1]); a.lineTo(q[0] - s * Math.cos(ang - 0.38), q[1] - s * Math.sin(ang - 0.38)); a.lineTo(q[0] - s * Math.cos(ang + 0.38), q[1] - s * Math.sin(ang + 0.38)); a.closePath(); a.fill(); };
    return {
      box(x, y, w, h, title, lines = [], o = {}) {
        rr(x, y, w, h, 9); a.fillStyle = o.bold ? 'rgba(170,210,255,0.16)' : FILL; a.fill();
        a.setLineDash(o.dash ? [9, 7] : []); a.strokeStyle = o.dash ? SOFT : LINE; a.lineWidth = o.bold ? 2.8 : 1.8; a.stroke(); a.setLineDash([]);
        const cx = o.center ? x + w / 2 : x + 18; a.textAlign = o.center ? 'center' : 'left';
        const lines0 = title ? 64 : 34, lh = o.lh || 24, ty = o.middle ? y + h / 2 - ((title ? 1 : 0) + lines.length - 1) * lh / 2 + 8 : y + 38;
        if (title) { a.fillStyle = TXT; a.font = FN.mono(600, o.ts || 21); a.fillText(title, cx, o.middle ? ty : y + 38, w - 30); }
        a.fillStyle = DIM; a.font = FN.mono(400, o.ls || 16);
        lines.forEach((t, i) => a.fillText(t, cx, (o.middle ? ty + (title ? lh : 0) : y + lines0) + i * lh, w - 30));
        a.textAlign = 'left';
      },
      group(x, y, w, h, title) {
        rr(x, y, w, h, 14); a.setLineDash([12, 9]); a.strokeStyle = SOFT; a.lineWidth = 1.6; a.stroke(); a.setLineDash([]);
        a.font = FN.mono(500, 16); const tw = a.measureText(title).width + 30; a.fillStyle = '#1d4a85'; a.fillRect(x + 22, y - 12, tw, 24);
        a.fillStyle = ACC; spaced(a, title, x + 37, y + 6, 2, 'left');
      },
      arrow(pts, o = {}) {
        a.strokeStyle = o.soft ? SOFT : LINE; a.fillStyle = o.soft ? SOFT : LINE; a.lineWidth = o.w || 2; a.setLineDash(o.dash ? [8, 7] : []);
        a.beginPath(); a.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) a.lineTo(p[0], p[1]); a.stroke(); a.setLineDash([]);
        head(pts[pts.length - 2], pts[pts.length - 1]); if (o.both) head(pts[1], pts[0]);
        if (o.label) { const [lx, ly] = o.at; a.font = FN.mono(500, 15); a.textAlign = o.align || 'center'; const tw = a.measureText(o.label).width; a.fillStyle = '#1d4a85';
          a.fillRect(o.align === 'left' ? lx - 4 : o.align === 'right' ? lx - tw - 4 : lx - tw / 2 - 6, ly - 15, tw + 12, 21); a.fillStyle = ACC; a.fillText(o.label, lx, ly); a.textAlign = 'left'; }
      },
      text(t, x, y, o = {}) { a.font = o.font || FN.mono(400, o.size || 16); a.fillStyle = o.color || DIM; a.textAlign = o.align || 'left'; a.fillText(t, x, y, o.max || 2000); a.textAlign = 'left'; },
      line(pts, o = {}) { a.strokeStyle = o.color || SOFT; a.lineWidth = o.w || 1.5; a.setLineDash(o.dash || []); a.beginPath(); a.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) a.lineTo(p[0], p[1]); a.stroke(); a.setLineDash([]); },
      circle(x, y, r, o = {}) { a.beginPath(); a.arc(x, y, r, o.a0 || 0, o.a1 ?? Math.PI * 2); if (o.fill) { a.fillStyle = o.fill; a.fill(); } if (o.stroke !== false) { a.strokeStyle = o.color || SOFT; a.lineWidth = o.w || 1.5; a.setLineDash(o.dash || []); a.stroke(); a.setLineDash([]); } },
      a, LINE, SOFT, TXT, DIM, ACC
    };
  }
  /* every sheet: [title, one line saying what it shows, the drawing, a few notes for the corner] */
  const SHEETS = [
    ['Engine modules', 'Each file does one thing. The page drives the engine; the engine draws the cove.', d => {
      const row = (y, label, items, h = 84) => { d.text(label, 86, y + h / 2 + 6, { font: FN.mono(500, 16), color: d.ACC }); const n = items.length, gap = 14, w = (1314 - 220 - gap * (n - 1)) / n;
        items.forEach(([t, l], i) => d.box(220 + i * (w + gap), y, w, h, t, l ? [l] : [], { center: true, ts: 19, ls: 14.5 })); };
      row(178, 'PAGE', [['app.js', 'camera · input · chapters'], ['pages.js', 'typesetting'], ['content.js', 'the words']]);
      row(300, 'RUN', [['engine.js', 'render loop · post · shadows'], ['audio.js', 'Web Audio · field recordings']]);
      row(422, 'THINGS', [['camp.js', 'the camp, in code'], ['world.js', 'the endless coast'], ['nature.js', 'trees near camp'], ['life.js', 'lanterns · fish'], ['fauna.js', 'birds · bugs · crabs']], 78);
      row(512, '', [['fx.js', 'fire · smoke · moths'], ['book.js', 'bound books'], ['paper.js', 'sheets you hold'], ['cloth.js', 'Verlet cloth'], ['shacks.js', 'shacks · huts · boats']], 78);
      row(626, 'LOOK', [['sky.js', 'sky colours'], ['glsl.js', 'every shader'], ['mats.js', 'materials'], ['paint.js', 'painted textures'], ['textures.js', 'noise · water · sand']], 78);
      row(738, 'FACTS', [['astro.js', 'sun & moon, after SunCalc'], ['layout.js', 'the cove in metres · the coast’s dice']], 84);
      for (const x of [480, 1054]) { d.arrow([[x, 262], [x, 300]], { soft: true }); d.arrow([[x, 384], [x, 422]], { soft: true }); }
      for (const x of [330, 767, 1204]) { d.arrow([[x, 590], [x, 626]], { soft: true }); }
      for (const x of [480, 1054]) d.arrow([[x, 704], [x, 738]], { soft: true });
    }, ['the page owns the camera and the input', 'the engine owns the scene and the frame', 'shaders live in one file, glsl.js', 'no framework, no bundler: one build script']],
    ['One frame, pass by pass', 'What the graphics card does, about sixty times a second.', d => {
      d.box(86, 196, 260, 168, 'SHADOWS', ['sun or moon · 2048²', 'campfire · 256²', 'string lights · 1024²']);
      d.box(400, 196, 260, 168, 'SCENE', ['high precision', 'sea, sky, coast, camp', 'depth kept for later']);
      d.box(714, 196, 260, 168, 'OCCLUSION', ['half size, from depth', 'blurred, edge-aware']);
      d.box(1028, 196, 286, 168, 'FIRE', ['ray-marched volume', 'half size', 'its own heat haze']);
      d.arrow([[346, 280], [400, 280]]); d.arrow([[660, 280], [714, 280]]); d.arrow([[974, 280], [1028, 280]]);
      d.arrow([[1171, 364], [1171, 430]]);
      d.box(1028, 432, 286, 168, 'BLOOM', ['six steps down,', 'six back up', 'only what glows']);
      d.box(714, 432, 260, 168, 'DEPTH OF FIELD', ['half size', 'less blur far away']);
      d.box(400, 432, 260, 168, 'FINAL', ['exposure · filmic curve', 'haze · rain · grain', 'vignette']);
      d.box(86, 432, 260, 168, 'YOUR SCREEN', [], { bold: true, center: true, middle: true });
      d.arrow([[1028, 516], [974, 516]]); d.arrow([[714, 516], [660, 516]]); d.arrow([[400, 516], [346, 516]]);
      d.box(86, 652, 580, 150, 'REFLECTIONS', ['the sky, prefiltered into a cube map,', 'rebuilt only when the sky changes'], { dash: true });
      d.box(714, 652, 600, 150, 'ADAPTIVE SIZE', ['the render scale drops when frames run', 'slow, and climbs back when they’re quick'], { dash: true });
    }, ['everything renders in half float, then tone-maps', 'the fire is ray-marched, not a sprite', 'occlusion fades out far away (no shimmer)', 'phones get fewer pixels, not fewer effects']],
    ['The coast, from above', 'The real coast, 3.6 km of it round the camp: headlands, points, bays and reefs, each its own roll of the dice.', d => {
      /* drawn from the coast itself (Layout.Coast): a third of a pixel a metre along it, its bends drawn 4.4 times deeper so
         they show, the beach 12 times wider */
      const a = d.a, C = Layout.Coast, X0 = 86, X1 = 1314, SPAN = 3600, Y0 = 404, K = 1.5, KB = 4.2, base = Layout.SH.base, PXM = (X1 - X0) / SPAN;
      const px = x => X0 + (x + SPAN / 2) / SPAN * (X1 - X0), xOf = p => (p - X0) / (X1 - X0) * SPAN - SPAN / 2;
      const sy = x => Y0 + (C.shoreZ(x) - base) * K, vy = x => sy(x) + (C.vegZ(x) - C.shoreZ(x)) * KB;
      a.save(); a.beginPath(); a.rect(X0, 176, X1 - X0, 650); a.clip();
      const sh = [], fe = []; for (let p = X0; p <= X1; p += 2) { const x = xOf(p); sh.push([p, sy(x)]); fe.push([p, vy(x)]); }
      /* the sea's long lines, stopping short of the shore */
      for (let y = 196; y < 460; y += 20) { let run = []; for (let p = X0; p <= X1; p += 12) { const yy = y + 3 * Math.sin(p * 0.05 + y); if (yy < sy(xOf(p)) - 9) run.push([p, yy]); else { if (run.length > 1) d.line(run, { color: 'rgba(170,205,255,0.16)', w: 1.2 }); run = []; } } if (run.length > 1) d.line(run, { color: 'rgba(170,205,255,0.16)', w: 1.2 }); }
      d.line(sh, { color: d.LINE, w: 2.4 }); d.line(fe, { color: d.SOFT, w: 1.6, dash: [6, 6] });
      /* the forest beyond its edge */
      const r = rnd(5); for (let i = 0; i < 620; i++) { const p = X0 + r() * (X1 - X0), y = vy(xOf(p)) + 6 + r() * 340; if (y < 826) d.circle(p, y, 2.5 + r() * 4.5, { color: 'rgba(170,205,255,0.3)', w: 1 }); }
      /* headlands: rock hatched over the sand at their foot and the land behind, their stacks out in the sea */
      const H = C.heads(-SPAN / 2, SPAN / 2);
      for (const h of H) {
        const c = px(h.hx), wpx = Math.max(6, h.w * PXM * 2.2);
        for (let i = 0; i < (h.minor ? 18 : 46); i++) { const p = c + (r() - 0.5) * wpx * 1.6, y0 = sy(xOf(p)), y = y0 + 3 + r() * (h.minor ? 18 : 40); d.line([[p, y], [p + 6, y - 4]], { color: 'rgba(225,238,255,0.55)', w: 1.2 }); }
        for (let k = 0; k < h.stacks; k++) d.circle(c + (k ? 1 : -0.4) * wpx * 0.5, sy(h.hx) - 14 - 8 * k, 3.5 + (k ? 0 : 1.5), { color: d.LINE, w: 1.4 });
      }
      /* reefs: rock running out from the beach into the sea */
      const RF = C.reefs(-SPAN / 2, SPAN / 2);
      for (const f of RF) {
        const g = C.shoreDZ(f.x), n = Math.hypot(g, 1), dx = g / n, dz = -1 / n, ca = Math.cos(f.ang), sa = Math.sin(f.ang), ox = dx * ca - dz * sa, oz = dx * sa + dz * ca;
        const pts = []; for (let t = 0; t <= 1.001; t += 0.1) { const x = f.x + ox * f.len * t, z = C.shoreZ(f.x) + 1.5 + oz * f.len * t; pts.push([px(x) + f.bend * PXM * Math.sin(Math.PI * t), Y0 + (z - base) * K]); }
        d.line(pts, { color: d.LINE, w: 4.2 }); d.line(pts, { color: '#1d4a85', w: 1.6, dash: [3, 4] });
      }
      /* the chunks round the camp */
      for (let k = -3; k <= 3; k++) { const p = px(-64 + k * 128); d.line([[p, 176], [p, 826]], { color: 'rgba(200,225,255,0.22)', w: 1.1, dash: [4, 8] }); }
      a.restore();
      for (let k = -2; k <= 2; k++) d.text(`${k > 0 ? '+' : ''}${k}`, px(k * 128), 200, { align: 'center', size: 13, color: d.ACC });
      d.text('chunks', px(0) + 160, 200, { size: 13, color: d.ACC });
      /* you, at the camp, and how far each kind of thing is built round you (to scale along the coast) */
      const cx = px(Layout.camp.x), cy = sy(Layout.camp.x) + 18;
      for (const [rad, t] of [[45, '45 m'], [155, '155 m'], [430, '430 m']]) { const R = rad * PXM; d.circle(cx, cy, R, { color: 'rgba(225,238,255,0.5)', w: 1.3, dash: [3, 6] }); d.text(t, cx + R * 0.74 + 6, cy + R * 0.67 + 16, { size: 13, color: d.TXT }); }
      a.fillStyle = d.TXT; a.beginPath(); a.moveTo(cx, cy - 9); a.lineTo(cx + 7, cy + 6); a.lineTo(cx - 7, cy + 6); a.closePath(); a.fill();
      d.text('camp', cx + 12, cy + 6, { size: 15, color: d.TXT });
      d.text('SEA', 104, 236, { font: FN.mono(600, 18), color: d.ACC }); d.text('SAND', 104, sy(xOf(104)) + 30, { font: FN.mono(600, 16), color: d.ACC }); d.text('FOREST', 104, 780, { font: FN.mono(600, 16), color: d.ACC });
      /* name a few of them */
      const lab = (x, y, t, tx, ty) => d.arrow([[tx, ty], [x, y]], { soft: true, label: t, at: [tx, ty - 8] });
      const big = H.filter(h => !h.minor && Math.abs(h.hx) > 300).sort((p, q) => q.d - p.d)[0], pt = H.filter(h => h.minor && Math.abs(h.hx) > 250)[0];
      if (big) lab(px(big.hx), sy(big.hx) - 6, 'headland', px(big.hx) + (big.hx > 0 ? -60 : 60), 262);
      if (pt) lab(px(pt.hx), sy(pt.hx) - 4, 'rocky point', px(pt.hx) + (pt.hx > 0 ? -70 : 70), 300);
      const near = RF.sort((p, q) => Math.abs(p.x) - Math.abs(q.x))[0];
      if (near) lab(px(near.x) - 4, sy(near.x) - 30, 'a reef to walk out on', px(near.x) - 150, 250);
      { let bx = 0, bb = 0; for (let x = -1600; x <= 1600; x += 20) { if (Math.abs(x) < 480) continue; const b = C.shoreZ(x) + C.head(x) - base; if (b > bb) { bb = b; bx = x; } }
        if (bb > 6) d.text('bay', px(bx), sy(bx) + 24, { align: 'center', size: 14, color: d.ACC }); }
      /* a scale */
      d.line([[1130, 806], [1130 + 500 * PXM, 806]], { color: d.TXT, w: 2 }); d.text('500 m', 1130 + 250 * PXM, 798, { align: 'center', size: 13, color: d.TXT });
    }, ['drawn from the coast itself, as you will find it', 'no stretch is ever the same as another', 'built round you, a few milliseconds a frame', 'park anywhere: the camp can be pitched there']],
    ['Sound', 'Recordings, mixed live and timed to what you see.', d => {
      const src = [['SEA', 'a long seamless loop'], ['WAVES', 'a second take swells in'], ['PAGES', 'real paper turning'], ['NIGHT', 'crickets · owl'], ['DAY', 'birds · gulls'], ['FIRE', 'only while it burns'], ['WEATHER', 'rain · thunder'], ['VAN', 'engine, pitched by speed']];
      src.forEach(([t, l], i) => d.box(86, 178 + i * 80, 380, 68, t, [l], { ts: 17, ls: 14, lh: 20 }));
      const bus = [['OCEAN', 300], ['FOREST', 420], ['FIRE', 540], ['INSECTS', 640], ['WEATHER', 740]];
      bus.forEach(([t, y]) => d.box(560, y - 34, 220, 68, t, [], { center: true, middle: true, ts: 18 }));
      const sy = i => 212 + i * 80, by = n => bus.find(b => b[0] === n)[1];
      [[0, 'OCEAN'], [1, 'OCEAN'], [3, 'INSECTS'], [4, 'FOREST'], [5, 'FIRE'], [6, 'WEATHER']].forEach(([i, n]) => d.arrow([[466, sy(i)], [512, sy(i)], [512, by(n)], [560, by(n)]], { soft: true, w: 1.5 }));
      d.box(870, 400, 200, 110, 'MIX', ['left uncoloured'], { center: true });
      bus.forEach(([, y]) => d.arrow([[780, y], [830, y], [830, 455], [870, 455]], { soft: true, w: 1.5 }));
      d.arrow([[466, sy(7)], [846, sy(7)], [846, 470], [870, 470]], { soft: true, w: 1.5 });
      d.box(1114, 400, 200, 110, 'LIMITER', ['nothing clips'], { center: true });
      d.box(1114, 600, 200, 110, 'SPEAKERS', [], { center: true, middle: true, bold: true });
      d.arrow([[1070, 455], [1114, 455]]); d.arrow([[1214, 510], [1214, 600]]);
    }, ['the surf swells as its wave reaches the sand', 'crickets after dark, birds at dawn', 'the mixer switches are the five buses', 'sounds load only when sound is on']]
  ];
  function plans(C, o = {}) {
    const T = PLANS, out = [], labels = [];
    SHEETS.forEach(([title, sub, draw, notes], si) => {
      const c = canvas(T.PW, T.PH), a = c.getContext('2d'); T.paper(a, si);
      a.fillStyle = T.accent; a.font = FN.mono(500, 20); spaced(a, `SHEET ${si + 1} — ${title}`.toUpperCase(), T.M.l, T.M.t - 6, 3, 'left');
      a.strokeStyle = 'rgba(225,238,255,0.5)'; a.lineWidth = 1.5; a.beginPath(); a.moveTo(T.M.l, T.M.t + 12); a.lineTo(T.PW - T.M.r, T.M.t + 12); a.stroke();
      a.fillStyle = T.muted; a.font = FN.serif(400, 24, true); a.textAlign = 'left'; a.fillText(sub, T.M.l, T.M.t + 50, T.PW - T.M.l - T.M.r);
      draw(ink(a));
      /* notes, bottom left */
      a.fillStyle = T.muted; a.font = FN.mono(400, 15); notes.forEach((n, i) => a.fillText('· ' + n, T.M.l, T.PH - 128 + i * 22, 700));
      /* title block, bottom right */
      const bw = 470, bx = T.PW - T.M.r - bw, by = T.PH - 140, bh = 92, split = bw * 0.64;
      a.strokeStyle = 'rgba(225,238,255,0.8)'; a.lineWidth = 2; a.strokeRect(bx, by, bw, bh); a.beginPath(); a.moveTo(bx, by + 46); a.lineTo(bx + bw, by + 46); a.moveTo(bx + split, by); a.lineTo(bx + split, by + bh); a.stroke();
      a.fillStyle = T.ink; a.font = FN.mono(500, 17); a.textAlign = 'left'; a.fillText(('MOONLIT COVE · ' + title).toUpperCase(), bx + 14, by + 30, split - 24); a.fillText(`SHEET ${si + 1} OF ${SHEETS.length}`, bx + split + 12, by + 30, bw - split - 20);
      a.fillStyle = T.muted; a.font = FN.mono(400, 15); a.fillText('DRAWN BY ' + C.name.toUpperCase(), bx + 14, by + 76, split - 24); a.fillText('NOT TO SCALE', bx + split + 12, by + 76, bw - split - 20);
      out.push(c); labels.push(title);
    });
    return { canvases: out, labels, pages: out.length, notes: SHEETS.map(s => [s[0], s[1], s[3]]) };
  }

  /* ── the stack, as a checklist on the clipboard ── */
  function stack(C, o = {}) {
    const T = o.compact ? compact(PACKING) : PACKING, groups = C.stack, cols = o.compact ? 1 : 2, colW = (T.PW - T.M.l - T.M.r - 40 * (cols - 1)) / cols;
    const items = []; groups.forEach(g => { items.push({ head: g.group }); g.items.forEach(t => items.push({ t })); });
    const lh = 44, avail = T.PH - T.M.t - T.M.b, perCol = Math.floor(avail / lh), pages = [];
    let page = null, col = 99, row = 0;
    const place = it => { if (col >= cols || !page) { page = Array.from({ length: cols }, () => []); pages.push(page); col = 0; row = 0; } page[col].push(it); row++; if (row >= perCol) { col++; row = 0; } };
    items.forEach(it => { if (it.head && row >= perCol - 2) { col++; row = 0; } if (it.head && row > 0) place({ sp: true }); place(it); });
    const out = pages.map((pg, pi) => {
      const c = canvas(T.PW, T.PH), a = c.getContext('2d'); T.paper(a, pi);
      a.textAlign = 'left'; a.fillStyle = T.accent; a.font = FN.mono(500, 22); spaced(a, 'PACKED FOR THIS BUILD', T.M.l, 120, 5, 'left');
      a.fillStyle = T.ink; a.font = FN.hand(700, 62); a.fillText('What the cove is built with', T.M.l, 190, T.PW - T.M.l - T.M.r);
      a.textAlign = 'right'; a.fillStyle = T.muted; a.font = FN.hand(500, 32); if (pages.length > 1) a.fillText(`${pi + 1} / ${pages.length}`, T.PW - T.M.r, 120);
      pg.forEach((colItems, ci) => colItems.forEach((it, ri) => {
        const x = T.M.l + ci * (colW + 40), y = T.M.t + ri * lh;
        if (it.sp) return;
        if (it.head) { a.textAlign = 'left'; a.fillStyle = T.accent; a.font = FN.mono(500, 18); spaced(a, it.head.toUpperCase(), x, y + 30, 2.5, 'left'); return; }
        a.strokeStyle = T.muted; a.lineWidth = 2; a.strokeRect(x + 2, y + 12, 22, 22);
        a.strokeStyle = T.accent; a.lineWidth = 3; a.beginPath(); a.moveTo(x + 5, y + 22); a.lineTo(x + 12, y + 31); a.lineTo(x + 28, y + 6); a.stroke();
        a.textAlign = 'left'; a.fillStyle = T.ink; a.font = FN.hand(600, 36); a.fillText(it.t, x + 40, y + 33, colW - 44);
      }));
      return c;
    });
    return { canvases: out, pages: out.length, title: 'Stack' };
  }
  return { notes, letter, plans, stack, SHEETS, FN };
})();
