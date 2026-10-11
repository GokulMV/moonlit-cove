/* ─────────────────────────────────────────────────────────────
   menubook.js — typesets the whole résumé into the pages of the
   menu on the picnic table: contents inside the cover, a title
   page with the summary, then experience, projects, skills and
   education, flowed onto as many pages as they need. Dates and
   licences sit where a menu's prices would.
   ───────────────────────────────────────────────────────────── */
const MenuBook = (() => {
  const PW = 1000, PH = 1400, M = { l: 96, r: 96, t: 112, b: 126 }, TW = PW - M.l - M.r;
  const ink = '#2a2017', sienna = '#99481b', muted = '#6b5844', paper = '#f3e9d6';
  const serif = (w, s, it) => `${it ? 'italic ' : ''}${w} ${s}px Fraunces, 'Iowan Old Style', Georgia, serif`;
  const mono = (w, s) => `${w} ${s}px 'JetBrains Mono', Menlo, monospace`;
  const decode = t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  function runsOf(html) {
    const out = [], re = /<b>(.*?)<\/b>/g; let last = 0, m;
    while ((m = re.exec(html))) { if (m.index > last) out.push({ t: decode(html.slice(last, m.index)), b: false }); out.push({ t: decode(m[1]), b: true }); last = re.lastIndex; }
    if (last < html.length) out.push({ t: decode(html.slice(last)), b: false });
    return out;
  }
  /* greedy word wrap over styled runs */
  function wrap(a, runs, width, fN, fB) {
    const words = []; for (const r of runs) for (const w of r.t.split(/(\s+)/)) if (w) words.push({ t: /^\s+$/.test(w) ? ' ' : w, b: r.b });
    const lines = []; let line = [], lw = 0;
    for (const w of words) {
      a.font = w.b ? fB : fN; const ww = a.measureText(w.t).width;
      if (w.t === ' ') { if (line.length) { line.push({ t: ' ', b: w.b, w: ww }); lw += ww; } continue; }
      if (lw + ww > width && line.length) { while (line.length && line[line.length - 1].t === ' ') lw -= line.pop().w; lines.push(line); line = []; lw = 0; }
      line.push({ t: w.t, b: w.b, w: ww }); lw += ww;
    }
    while (line.length && line[line.length - 1].t === ' ') line.pop();
    if (line.length) lines.push(line);
    return lines;
  }
  const drawLine = (a, line, x, y, fN, fB, col, colB) => { for (const w of line) { a.font = w.b ? fB : fN; a.fillStyle = w.b ? (colB || col) : col; a.fillText(w.t, x, y); x += w.w; } };
  const spaced = (a, t, x, y, sp, align = 'center') => { const ws = [...t].map(ch => a.measureText(ch).width); const tw = ws.reduce((p, q) => p + q, 0) + sp * (ws.length - 1); let cx = align === 'center' ? x - tw / 2 : x; a.textAlign = 'left'; [...t].forEach((ch, i) => { a.fillText(ch, cx, y); cx += ws[i] + sp; }); return tw; };
  const diamond = (a, x, y, s) => { a.beginPath(); a.moveTo(x, y - s); a.lineTo(x + s, y); a.lineTo(x, y + s); a.lineTo(x - s, y); a.closePath(); a.fill(); };

  /* blocks: each knows its height for a given context and how to draw itself at (y) */
  function blocks(a, C) {
    const B = [];
    const add = (b) => { B.push(b); return b; };
    const kicker = (t, keep = true) => add({ h: 40, keep, draw: y => { a.fillStyle = sienna; a.font = mono(500, 18); spaced(a, t.toUpperCase(), PW / 2, y + 24, 5); } });
    const title = (t, sec) => add({ h: 74, keep: true, sec, draw: y => { a.fillStyle = ink; a.textAlign = 'center'; a.font = serif(400, 50, true); a.fillText(t, PW / 2, y + 52); } });
    const orn = () => add({ h: 54, orn: true, draw: y => { a.strokeStyle = sienna; a.lineWidth = 1.5; a.beginPath(); a.moveTo(PW / 2 - 110, y + 27); a.lineTo(PW / 2 - 16, y + 27); a.moveTo(PW / 2 + 16, y + 27); a.lineTo(PW / 2 + 110, y + 27); a.stroke(); a.fillStyle = sienna; diamond(a, PW / 2, y + 27, 7); } });
    const gap = h => add({ h, gap: true, draw: () => {} });
    const brk = () => add({ brk: true, h: 0, draw: () => {} });
    const para = (html, size = 25, lh = 37, indent = 0, bullet = false, italic = false, col = ink) => {
      const fN = serif(400, size, italic), fB = serif(600, size, italic), lines = wrap(a, runsOf(html), TW - indent, fN, fB);
      return add({ h: lines.length * lh + (bullet ? 9 : 6), draw: y => {
        a.textAlign = 'left';
        if (bullet) { a.fillStyle = sienna; a.beginPath(); a.arc(M.l + 8, y + lh * 0.62, 4.2, 0, Math.PI * 2); a.fill(); }
        lines.forEach((ln, i) => drawLine(a, ln, M.l + indent, y + lh * 0.78 + i * lh, fN, fB, col, ink)); } });
    };
    const row = (l, r, keep = true) => add({ h: 48, keep, draw: y => {
      a.textAlign = 'left'; a.fillStyle = ink; a.font = serif(600, 31); a.fillText(l, M.l, y + 36); const lw = a.measureText(l).width;
      a.textAlign = 'right'; a.fillStyle = sienna; a.font = mono(500, 19); a.fillText(r, PW - M.r, y + 35); const rw = a.measureText(r).width;
      a.fillStyle = 'rgba(42,32,23,0.45)'; for (let x = M.l + lw + 14; x < PW - M.r - rw - 12; x += 10) { a.beginPath(); a.arc(x, y + 30, 1.7, 0, Math.PI * 2); a.fill(); } } });

    /* title page */
    gap(28); kicker('The Moonlit Cove', false);
    add({ h: 112, draw: y => { a.textAlign = 'center'; a.fillStyle = ink; a.font = serif(500, 92); a.fillText(C.name, PW / 2, y + 92); } });
    add({ h: 46, draw: y => { a.textAlign = 'center'; a.fillStyle = muted; a.font = serif(400, 30, true); a.fillText(`${C.role} · ${C.place}`, PW / 2, y + 34); } });
    add({ h: 40, draw: y => { a.textAlign = 'center'; a.fillStyle = sienna; a.font = mono(400, 18); a.fillText(C.links.map(l => l[2]).join('   ·   '), PW / 2, y + 28); } });
    orn();
    kicker('To start'); title('Summary', 'Summary');
    para(C.summary, 26, 40);
    brk();
    /* experience */
    const exp = C.chapters.find(c => c.id === 'experience').body;
    kicker('Mains'); title('Experience', 'Experience');
    exp.forEach((r, i) => {
      if (i) gap(22);
      row(r.org, r.when);
      para(`${r.title} · ${r.context} · ${r.where}`, 23, 33, 0, false, true, muted).keep = true;
      gap(6).keep = true;
      r.points.forEach(p => para(p, 24, 35, 30, true));
    });
    brk();
    /* projects */
    kicker('From the basket'); title('Projects', 'Projects');
    C.resumeProjects.forEach((p, i) => { if (i) gap(20); row(p.name, p.license); para(p.tech, 22, 32, 0, false, true, muted).keep = true; gap(4).keep = true; para(p.text, 24, 36); });
    gap(24); orn();
    /* skills and education */
    kicker('The pantry'); title('Technical skills', 'Skills');
    const stack = C.chapters.find(c => c.id === 'stack').body;
    stack.forEach(g => {
      const fN = serif(400, 24), lines = wrap(a, [{ t: g.items.join(' · '), b: false }], TW, fN, fN);
      add({ h: 34 + lines.length * 34 + 12, draw: y => { a.fillStyle = sienna; a.font = mono(500, 17); spaced(a, g.group.toUpperCase(), M.l, y + 22, 2.5, 'left'); a.textAlign = 'left'; lines.forEach((ln, i) => drawLine(a, ln, M.l, y + 58 + i * 34, fN, fN, ink)); } });
    });
    gap(18); orn();
    kicker('To finish'); title('Education', 'Education');
    row(C.education.school.replace(' (JNTU)', ''), C.education.year);
    para(`${C.education.degree} · ${C.education.where}`, 23, 33, 0, false, true, muted);
    gap(30); orn();
    add({ h: 50, draw: y => { a.textAlign = 'center'; a.fillStyle = muted; a.font = serif(400, 24, true); a.fillText('Served under the string lights. Thank you for stopping by.', PW / 2, y + 34); } });
    return B;
  }

  /* flow blocks onto pages: a heading keeps with what follows, a break starts a new page */
  function paginate(B) {
    const avail = PH - M.t - M.b, pages = [[]]; let y = 0;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b.brk) { if (pages[pages.length - 1].length) { pages.push([]); y = 0; } continue; }
      let need = b.h; for (let j = i; j < B.length - 1 && B[j].keep && !B[j + 1].brk; j++) need += B[j + 1].h;
      if (y + need > avail && pages[pages.length - 1].length) { pages.push([]); y = 0; if (b.gap || b.orn) continue; }
      pages[pages.length - 1].push({ b, y }); y += b.h;
    }
    return pages.filter(p => p.length);
  }

  function paperBg(a, seed) {
    a.setTransform(1, 0, 0, 1, 0, 0); a.fillStyle = paper; a.fillRect(0, 0, PW, PH);
    const g = a.createRadialGradient(PW / 2, PH * 0.45, 100, PW / 2, PH * 0.5, PW * 0.95); g.addColorStop(0, 'rgba(255,251,240,0.35)'); g.addColorStop(1, 'rgba(150,110,60,0.16)'); a.fillStyle = g; a.fillRect(0, 0, PW, PH);
    let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 2600; i++) { a.fillStyle = `rgba(${r() < 0.5 ? '90,64,30' : '255,250,235'},${0.03 + r() * 0.05})`; a.fillRect(r() * PW, r() * PH, 1 + r() * 2, 1); }
    a.strokeStyle = 'rgba(153,72,27,0.55)'; a.lineWidth = 1.5; a.strokeRect(40, 40, PW - 80, PH - 80);
  }
  const newCanvas = () => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; return c; };

  function paint(C) {
    const meas = newCanvas().getContext('2d');
    const B = blocks(meas, C), pages = paginate(B);
    /* where each section starts, for the contents page */
    const secs = []; pages.forEach((p, i) => p.forEach(({ b }) => { if (b.sec && !secs.find(s => s.name === b.sec)) secs.push({ name: b.sec, page: i + 1 }); }));
    const out = [], labels = [];
    /* inside the cover: contents */
    { const c = newCanvas(), a = c.getContext('2d'); paperBg(a, 1);
      a.fillStyle = sienna; a.font = mono(500, 18); spaced(a, 'TONIGHT’S MENU', PW / 2, 250, 5);
      a.fillStyle = ink; a.textAlign = 'center'; a.font = serif(400, 64, true); a.fillText('Contents', PW / 2, 340);
      const courses = { Summary: 'To start', Experience: 'Mains', Projects: 'From the basket', Skills: 'The pantry', Education: 'To finish' };
      secs.forEach((s, i) => { const y = 470 + i * 104;
        a.textAlign = 'left'; a.fillStyle = sienna; a.font = mono(500, 16); spaced(a, (courses[s.name] || '').toUpperCase(), M.l + 24, y - 34, 3, 'left');
        a.textAlign = 'left'; a.fillStyle = ink; a.font = serif(600, 34); a.fillText(s.name === 'Skills' ? 'Technical skills' : s.name, M.l + 24, y + 8); const lw = a.measureText(s.name === 'Skills' ? 'Technical skills' : s.name).width;
        a.textAlign = 'right'; a.fillStyle = sienna; a.font = mono(500, 24); a.fillText(String(s.page), PW - M.r - 24, y + 6);
        a.fillStyle = 'rgba(42,32,23,0.45)'; for (let x = M.l + 24 + lw + 16; x < PW - M.r - 60; x += 11) { a.beginPath(); a.arc(x, y - 2, 1.8, 0, Math.PI * 2); a.fill(); } });
      a.textAlign = 'center'; a.fillStyle = muted; a.font = serif(400, 23, true); a.fillText('Turn the page, or use the arrows below.', PW / 2, PH - 190);
      out.push(c); labels.push('Contents'); }
    pages.forEach((p, i) => {
      const c = newCanvas(), a = c.getContext('2d'); paperBg(a, i + 2);
      p.forEach(({ b, y }) => b.draw(M.t + y));
      a.textAlign = 'center'; a.fillStyle = sienna; a.font = mono(500, 18); a.fillText(`— ${i + 1} —`, PW / 2, PH - 70);
      out.push(c);
      const s = p.find(({ b }) => b.sec); labels.push(s ? s.b.sec : (labels[labels.length - 1] || ''));
    });
    /* inside the back cover, when the last page falls on the left */
    if (pages.length % 2 === 0) {
      const c = newCanvas(), a = c.getContext('2d'); paperBg(a, 99);
      a.fillStyle = sienna; a.font = mono(500, 18); spaced(a, 'THANK YOU', PW / 2, PH / 2 - 60, 6);
      a.fillStyle = ink; a.textAlign = 'center'; a.font = serif(400, 44, true); a.fillText('Find me on', PW / 2, PH / 2 + 10);
      a.fillStyle = sienna; a.font = mono(400, 22); a.fillText(C.links.map(l => l[2]).join('   ·   '), PW / 2, PH / 2 + 70);
      out.backInner = c; labels.push('Thank you');
    }
    /* screen-reader text mirrors the printed pages */
    return { canvases: out, labels, pages: pages.length };
  }
  return { paint, PW, PH };
})();
