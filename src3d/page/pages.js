/* ─────────────────────────────────────────────────────────────
   pages.js — typesets the résumé onto the paper objects in the
   cove, each in its own hand:
     menu     the whole résumé, a bistro menu on the picnic table
     journal  experience, a notebook by the fire
     letter   the message in the bottle, handwritten
     plans    projects, blueprints rolled up in the basket
     packing  the stack, a packing list on the van's clipboard
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
          if (o.bullet) { a.fillStyle = T.accent; if (o.bullet === 'check') { a.strokeStyle = T.accent; a.lineWidth = 2.5; a.strokeRect(X0 + (o.x || 0), y + lh * 0.24, 22, 22); a.beginPath(); a.moveTo(X0 + (o.x || 0) + 4, y + lh * 0.24 + 12); a.lineTo(X0 + (o.x || 0) + 10, y + lh * 0.24 + 19); a.lineTo(X0 + (o.x || 0) + 26, y + lh * 0.24 - 2); a.stroke(); } else { a.beginPath(); a.arc(X0 + (o.x || 0) + 8, y + lh * 0.6, 4.2, 0, Math.PI * 2); a.fill(); } }
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
  const MENU = { PW: 1000, PH: 1400, M: { l: 96, r: 96, t: 112, b: 126 }, ink: '#2a2017', accent: '#99481b', muted: '#6b5844',
    paper(a, i) { const W = this.PW, H = this.PH; a.fillStyle = '#f3e9d6'; a.fillRect(0, 0, W, H); const g = a.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, W * 0.95); g.addColorStop(0, 'rgba(255,251,240,0.35)'); g.addColorStop(1, 'rgba(150,110,60,0.16)'); a.fillStyle = g; a.fillRect(0, 0, W, H);
      grain(a, W, H, i + 3, 2600, '90,64,30', '255,250,235'); a.strokeStyle = 'rgba(153,72,27,0.55)'; a.lineWidth = 1.5; a.strokeRect(40, 40, W - 80, H - 80); } };
  const JOURNAL = { PW: 1000, PH: 1400, M: { l: 150, r: 84, t: 120, b: 110 }, ink: '#1f2a3d', accent: '#7a2f1f', muted: '#4c5568',
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

  /* ── the menu: the whole résumé ── */
  function menu(C, o = {}) {
    const T = o.compact ? compact(MENU) : MENU, K = kit(T), { kicker, title, orn, gap, brk, para, row, center } = K;
    gap(28); kicker('The Moonlit Cove', false);
    center(C.name, FN.serif(500, 92), T.ink, 112, 92);
    center(`${C.role} · ${C.place}`, FN.serif(400, 30, true), T.muted, 46, 34);
    center([C.contact.phone, C.contact.email].join('   ·   '), FN.mono(400, 18), T.accent, 34, 26);
    center(C.links.map(l => l[2]).join('   ·   '), FN.mono(400, 18), T.accent, 40, 26);
    orn(); kicker('To start'); title('Summary', 'Summary'); para(C.summary, { size: 26, lh: 40 });
    brk();
    kicker('Mains'); title('Experience', 'Experience');
    C.chapters.find(c => c.id === 'experience').body.forEach((r, i) => {
      if (i) gap(22);
      row(r.org, r.when); para(`${r.title} · ${r.context} · ${r.where}`, { size: 23, lh: 33, italic: true, color: T.muted, keep: true }); gap(6).keep = true;
      r.points.forEach(p => para(p, { size: 24, lh: 35, indent: 30, bullet: true, after: 9 }));
    });
    brk();
    kicker('From the basket'); title('Projects', 'Projects');
    C.resumeProjects.forEach((p, i) => { if (i) gap(20); row(p.name, p.license); para(p.tech, { size: 22, lh: 32, italic: true, color: T.muted, keep: true }); gap(4).keep = true; para(p.text, { size: 24, lh: 36 }); });
    gap(24); orn();
    kicker('The pantry'); title('Technical skills', 'Skills');
    C.chapters.find(c => c.id === 'stack').body.forEach(g => {
      const fN = FN.serif(400, 24), lines = wrap(meas, [{ t: g.items.join(' · '), b: false }], K.TW, fN, fN);
      K.custom(34 + lines.length * 34 + 12, (a, y) => { a.fillStyle = T.accent; a.font = FN.mono(500, 17); spaced(a, g.group.toUpperCase(), T.M.l, y + 22, 2.5, 'left'); a.textAlign = 'left'; lines.forEach((ln, i) => drawLine(a, ln, T.M.l, y + 58 + i * 34, fN, fN, T.ink)); });
    });
    gap(18); orn();
    kicker('To finish'); title('Education', 'Education');
    row('JNTU Anantapur', C.education.year); para(`${C.education.degree} · Jawaharlal Nehru Technological University`, { size: 23, lh: 33, italic: true, color: T.muted });

    const pages = flow(K.B, T.PH - T.M.t - T.M.b);
    const out = render(T, K, pages, (a, i) => { a.textAlign = 'center'; a.fillStyle = T.accent; a.font = FN.mono(500, 18); a.fillText(`— ${i + 1} —`, T.PW / 2, T.PH - 70); });
    const labels = pages.map(p => { const s = p.find(({ b }) => b.sec); return s ? s.b.sec : null; });
    for (let i = 0; i < labels.length; i++) if (!labels[i]) labels[i] = labels[i - 1] || '';
    const secs = []; pages.forEach((p, i) => p.forEach(({ b }) => { if (b.sec && !secs.find(s => s.name === b.sec)) secs.push({ name: b.sec, page: i + 1 }); }));
    /* inside the cover: contents */
    const c0 = canvas(T.PW, T.PH), a = c0.getContext('2d'); T.paper(a, 0);
    a.fillStyle = T.accent; a.font = FN.mono(500, 18); spaced(a, 'TONIGHT’S MENU', T.PW / 2, Math.round(T.PH * 0.178), 5);
    a.fillStyle = T.ink; a.textAlign = 'center'; a.font = FN.serif(400, 64, true); a.fillText('Contents', T.PW / 2, Math.round(T.PH * 0.243));
    const courses = { Summary: 'To start', Experience: 'Mains', Projects: 'From the basket', Skills: 'The pantry', Education: 'To finish' };
    secs.forEach((s, i) => { const y = Math.round(T.PH * 0.335 + i * T.PH * 0.074), name = s.name === 'Skills' ? 'Technical skills' : s.name;
      a.fillStyle = T.accent; a.font = FN.mono(500, 16); spaced(a, (courses[s.name] || '').toUpperCase(), T.M.l + 24, y - 34, 3, 'left');
      a.textAlign = 'left'; a.fillStyle = T.ink; a.font = FN.serif(600, 34); a.fillText(name, T.M.l + 24, y + 8); const lw = a.measureText(name).width;
      a.textAlign = 'right'; a.fillStyle = T.accent; a.font = FN.mono(500, 24); a.fillText(String(s.page), T.PW - T.M.r - 24, y + 6);
      a.fillStyle = 'rgba(42,32,23,0.45)'; for (let x = T.M.l + 24 + lw + 16; x < T.PW - T.M.r - 60; x += 11) { a.beginPath(); a.arc(x, y - 2, 1.8, 0, Math.PI * 2); a.fill(); } });
    a.textAlign = 'center'; a.fillStyle = T.muted; a.font = FN.serif(400, 23, true); a.fillText('Turn the page, or use the arrows below.', T.PW / 2, T.PH - 190);
    const canvases = [c0, ...out];
    if (pages.length % 2 === 0) canvases.backInner = thanks(T, C);
    return { canvases, labels: ['Contents', ...labels, 'Thank you'], pages: pages.length };
  }
  function thanks(T, C) {
    const c = canvas(T.PW, T.PH), a = c.getContext('2d'); T.paper(a, 99);
    a.fillStyle = T.accent; a.font = FN.mono(500, 18); spaced(a, 'THANK YOU', T.PW / 2, T.PH / 2 - 60, 6);
    a.fillStyle = T.ink; a.textAlign = 'center'; a.font = FN.serif(400, 44, true); a.fillText('Find me on', T.PW / 2, T.PH / 2 + 10);
    a.fillStyle = T.accent; a.font = FN.mono(400, 22); a.fillText(C.links.map(l => l[2]).join('   ·   '), T.PW / 2, T.PH / 2 + 70);
    return c;
  }

  /* ── the journal by the fire: one story per place I've worked ── */
  function journal(C, o = {}) {
    const T = o.compact ? compact(JOURNAL) : JOURNAL, K = kit(T), { gap, brk, para, custom } = K;
    const roles = C.chapters.find(c => c.id === 'experience').body;
    roles.forEach((r, i) => {
      if (i) brk();
      custom(70, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.accent; a.font = FN.hand(700, 64); a.fillText(r.org, T.M.l, y + 52); }, true).sec = r.org;
      custom(44, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.muted; a.font = FN.hand(500, 34); a.fillText(`${r.when} · ${r.where}`, T.M.l, y + 30); }, true);
      para(`${r.title} · ${r.context}`, { size: 27, lh: 37, italic: true, color: T.muted, keep: true, after: 12 });
      r.points.forEach(p => para(p, { size: 27, lh: 37, indent: 30, bullet: true, after: 8 }));
    });
    const pages = flow(K.B, T.PH - T.M.t - T.M.b);
    const out = render(T, K, pages, (a, i) => { a.textAlign = 'right'; a.fillStyle = T.muted; a.font = FN.hand(500, 30); a.fillText(String(i + 1), T.PW - 70, T.PH - 52); });
    const per = []; pages.forEach((p, i) => { const s = p.find(({ b }) => b.sec); per.push(s ? s.b.sec : (per[i - 1] || '')); });
    const c0 = canvas(T.PW, T.PH), a = c0.getContext('2d'); T.paper(a, 0);
    a.textAlign = 'center'; a.fillStyle = T.accent; a.font = FN.hand(700, 92); a.fillText('Stories by the fire', T.PW / 2, Math.round(T.PH * 0.3), T.PW - 80);
    a.fillStyle = T.muted; a.font = FN.hand(500, 40); a.fillText('a journal of the places I’ve worked', T.PW / 2, Math.round(T.PH * 0.35), T.PW - 80);
    roles.forEach((r, i) => { const y = Math.round(T.PH * 0.457 + i * T.PH * 0.0686); a.textAlign = 'right'; a.fillStyle = T.muted; a.font = FN.hand(500, 36); a.fillText(r.when, T.PW - T.M.r - 20, y); const dw = a.measureText(r.when).width;
      a.textAlign = 'left'; a.fillStyle = T.ink; a.font = FN.hand(600, 44); a.fillText(r.org, T.M.l + 40, y, T.PW - T.M.r - 20 - dw - 30 - (T.M.l + 40)); });
    a.textAlign = 'center'; a.fillStyle = T.muted; a.font = FN.hand(500, 34); a.fillText(`${C.name}`, T.PW / 2, T.PH - 170);
    const canvases = [c0, ...out];
    if (pages.length % 2 === 0) { const b = canvas(T.PW, T.PH), x = b.getContext('2d'); T.paper(x, 98); x.textAlign = 'center'; x.fillStyle = T.muted; x.font = FN.hand(500, 44); x.fillText('…and the next chapter is still being written.', T.PW / 2, T.PH / 2); canvases.backInner = b; }
    return { canvases, labels: ['Contents', ...per, 'The end'], pages: pages.length };
  }

  /* ── the letter in the bottle ── */
  function letter(C, o = {}) {
    const T = o.compact ? compact(LETTER) : LETTER, K = kit(T), { gap, para, custom } = K, L = C.letter, hand = s => FN.hand(500, s), handB = s => FN.hand(700, s);
    para(L.to, { font: hand(46), fontB: handB(46), size: 46, lh: 56, after: 16 });
    L.body.forEach(p => para(p, { font: hand(38), fontB: handB(38), size: 38, lh: 47, after: 18 }));
    para(L.close, { font: hand(42), fontB: handB(42), size: 42, lh: 50, after: 0, x: 440, width: K.TW - 440 });
    para(L.sign, { font: handB(58), fontB: handB(58), size: 58, lh: 64, after: 16, x: 480, width: K.TW - 480, color: T.accent });
    custom(36, (a, y) => { a.strokeStyle = 'rgba(80,55,30,0.35)'; a.lineWidth = 1.5; a.setLineDash([6, 8]); a.beginPath(); a.moveTo(T.M.l, y + 18); a.lineTo(T.PW - T.M.r, y + 18); a.stroke(); a.setLineDash([]); }, true);
    custom(50, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.accent; a.font = handB(42); a.fillText('Where to find me', T.M.l, y + 38); }, true);
    const rows = [['Phone', C.contact.phone], ['Email', C.contact.email], ['LinkedIn', C.links[0][2]], ['GitHub', C.links[1][2]]];
    rows.forEach(([k, v], i) => custom(46, (a, y) => { a.textAlign = 'left'; a.fillStyle = T.muted; a.font = hand(36); a.fillText(k, T.M.l + 10, y + 34); a.fillStyle = T.ink; a.font = handB(38); a.fillText(v, T.M.l + 200, y + 34); }, i < rows.length - 1));
    const pages = flow(K.B, T.PH - T.M.t - T.M.b);
    return { canvases: render(T, K, pages), pages: pages.length };
  }

  /* ── projects, on blueprints: one sheet per chapter of work (portrait sheets, one column, on phones) ── */
  function plans(C, o = {}) {
    const T = o.compact ? compact(PLANS, 1.42) : PLANS, cols = o.compact ? 1 : 2, groups = [], body = C.chapters.find(c => c.id === 'projects').body;
    body.forEach(b => { if (b.kind === 'group') groups.push({ name: b.text, items: [] }); else if (b.kind === 'proj') groups[groups.length - 1].items.push(b); });
    const colW = (T.PW - T.M.l - T.M.r - 60 * (cols - 1)) / cols, fN = FN.serif(400, 22), lh = 31, top = T.M.t + 46, bottom = T.PH - T.M.b;
    /* every project is a cell; a group name rides on its first cell */
    const cells = []; groups.forEach((g, gi) => g.items.forEach((p, j) => { const tl = wrap(meas, [{ t: p.name, b: false }], colW, FN.serif(600, 33), FN.serif(600, 33)), dl = wrap(meas, [{ t: p.text, b: false }], colW, fN, fN);
      cells.push({ g: j === 0 ? g.name : null, gi, p, tl, dl, h: (j === 0 ? 38 : 0) + 44 + 34 + (tl.length - 1) * 40 + dl.length * lh + 30 }); }));
    const sheets = []; let cur = null, col = 0, y = top, lastG = -1;
    const fresh = () => { cur = { cells: [], groups: [] }; sheets.push(cur); col = 0; y = top; };
    cells.forEach(c => {
      /* wide sheets: Thoughtworks, then OpenText, then the rest together */
      if (!o.compact && c.g && cur && c.gi !== lastG && !(cur.groups.length === 1 && groups[cur.groups[0]].items.length === 1)) fresh();
      if (!cur) fresh();
      if (y + c.h > bottom) { col++; y = top; if (col >= cols) fresh(); }
      cur.cells.push(Object.assign({ col, y }, c)); if (!cur.groups.includes(c.gi)) cur.groups.push(c.gi); lastG = c.gi; y += c.h;
    });
    const out = [], labels = [];
    sheets.forEach((sh, si) => {
      const c = canvas(T.PW, T.PH), a = c.getContext('2d'); T.paper(a, si);
      const head = sh.groups.map(i => groups[i].name).join('  ·  ');
      a.fillStyle = T.accent; a.font = FN.mono(500, 20); spaced(a, ('Sheet ' + (si + 1) + ' — ' + head).toUpperCase(), T.M.l, T.M.t - 6, 3, 'left');
      a.strokeStyle = 'rgba(225,238,255,0.5)'; a.lineWidth = 1.5; a.beginPath(); a.moveTo(T.M.l, T.M.t + 12); a.lineTo(T.PW - T.M.r, T.M.t + 12); a.stroke();
      sh.cells.forEach(cell => {
        const x = T.M.l + cell.col * (colW + 60); let y = cell.y;
        if (cell.g) { a.fillStyle = T.accent; a.font = FN.mono(500, 17); spaced(a, cell.g.toUpperCase(), x, y + 18, 3, 'left'); y += 38; }
        a.textAlign = 'left'; a.fillStyle = T.ink; a.font = FN.serif(600, 33); cell.tl.forEach((ln, k) => a.fillText(ln.map(w => w.t).join(''), x, y + 34 + k * 40)); y += (cell.tl.length - 1) * 40;
        a.fillStyle = T.accent; a.font = FN.mono(400, 16); a.fillText(cell.p.tag.toUpperCase(), x, y + 66, colW);
        cell.dl.forEach((ln, k) => drawLine(a, ln, x, y + 104 + k * lh, fN, fN, T.muted));
        a.strokeStyle = 'rgba(200,225,255,0.35)'; a.lineWidth = 1; a.setLineDash([5, 6]); a.beginPath(); a.moveTo(x, y + 104 + cell.dl.length * lh); a.lineTo(x + colW, y + 104 + cell.dl.length * lh); a.stroke(); a.setLineDash([]);
      });
      /* title block, bottom right */
      const bw = Math.min(470, T.PW - T.M.l - T.M.r), bx = T.PW - T.M.r - bw, by = T.PH - 140, bh = 92, split = bw * 0.64;
      a.strokeStyle = 'rgba(225,238,255,0.8)'; a.lineWidth = 2; a.strokeRect(bx, by, bw, bh); a.beginPath(); a.moveTo(bx, by + 46); a.lineTo(bx + bw, by + 46); a.moveTo(bx + split, by); a.lineTo(bx + split, by + bh); a.stroke();
      a.fillStyle = T.ink; a.font = FN.mono(500, 17); a.textAlign = 'left'; a.fillText('PROJECTS · ' + C.name.toUpperCase(), bx + 14, by + 30, split - 24); a.fillText(`SHEET ${si + 1} OF ${sheets.length}`, bx + split + 12, by + 30, bw - split - 20);
      a.fillStyle = T.muted; a.font = FN.mono(400, 15); a.fillText('DRAWN BY GOKULMV', bx + 14, by + 76, split - 24); a.fillText('NOT TO SCALE', bx + split + 12, by + 76, bw - split - 20);
      out.push(c); labels.push(head);
    });
    return { canvases: out, labels, pages: out.length };
  }

  /* ── the stack, as a packing list ── */
  function packing(C, o = {}) {
    const T = o.compact ? compact(PACKING) : PACKING, groups = C.chapters.find(c => c.id === 'stack').body, cols = o.compact ? 1 : 2, colW = (T.PW - T.M.l - T.M.r - 40 * (cols - 1)) / cols;
    /* lay groups into two columns per page */
    const items = []; groups.forEach(g => { items.push({ head: g.group }); g.items.forEach(t => items.push({ t })); });
    const lh = 44, avail = T.PH - T.M.t - T.M.b, perCol = Math.floor(avail / lh), pages = [];
    let page = null, col = 99, row = 0;
    const place = it => { if (col >= cols || !page) { page = Array.from({ length: cols }, () => []); pages.push(page); col = 0; row = 0; } page[col].push(it); row++; if (row >= perCol) { col++; row = 0; } };
    items.forEach((it, i) => { if (it.head && row >= perCol - 2) { col++; row = 0; } if (it.head && row > 0) place({ sp: true }); place(it); });
    const out = pages.map((pg, pi) => {
      const c = canvas(T.PW, T.PH), a = c.getContext('2d'); T.paper(a, pi);
      a.textAlign = 'left'; a.fillStyle = T.accent; a.font = FN.mono(500, 22); spaced(a, 'PACKING LIST', T.M.l, 120, 6, 'left');
      a.fillStyle = T.ink; a.font = FN.hand(700, 64); a.fillText('What travels with me', T.M.l, 190);
      a.textAlign = 'right'; a.fillStyle = T.muted; a.font = FN.hand(500, 32); a.fillText(`${pi + 1} / ${pages.length}`, T.PW - T.M.r, 120);
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
    return { canvases: out, pages: out.length };
  }
  return { menu, journal, letter, plans, packing, FN };
})();
