/* ─────────────────────────────────────────────────────────────
   app.js — the live page: render loop, chapters on objects,
   hotspots, live sky and time controls, the sound mixer and the
   click-the-sea waves.
   ───────────────────────────────────────────────────────────── */
(() => {
  const $ = id => document.getElementById(id);
  const cv = $('scene');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cove.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cove.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
  const loc = Astro.locate(tz);
  const ALIAS = { Calcutta: 'Kolkata', Saigon: 'Ho Chi Minh', Kiev: 'Kyiv', Rangoon: 'Yangon', Katmandu: 'Kathmandu' };
  const city = (c => ALIAS[c] || c)(tz.split('/').pop().replace(/_/g, ' '));

  const st = {
    t: 4, last: 0, motion: store.get('motion', reduced ? 0.45 : 0.7), soft: store.get('soft', 0.55),
    timeMode: store.get('timeMode', 'live'), hour: store.get('hour', 23), full: store.get('full', true), flow: 1, offset: 0,
    lightsMode: store.get('lightsMode', 'auto'), L: { string: 0, lantern: 0, van: 0, fairy: 0 },
    chapter: null, from: null, to: null, camT: 1, cur: null,
    rs: 1, fms: [], S: null, entered: false, hintGone: false, wrecked: false, toastTimer: 0
  };
  const sound = { on: false, amb: null, ctx: null, ch: Object.assign({ ocean: true, forest: true, fire: true, insects: true, weather: true, tone: true }, store.get('ch', {})), vol: store.get('vol', 0.8), douse: null, thunder: [] };

  /* views the camera moves between */
  const V = {
    wide: Layout.cameras.wide,
    fire: { pos: [4.9, 1.95, -1.25], look: [7.0, 0.55, -4.5], fov: 40, focus: 4.0 },
    table: { pos: [-0.95, 2.9, 1.3], look: [0.6, 0.42, -2.7], fov: 44, focus: 4.4 },
    menu: { pos: [0.7, 0.98, -1.66], look: [0.66, 0.5, -2.5], fov: 36, focus: 0.97 },
    basket: { pos: [3.15, 1.45, -1.95], look: [1.95, 0.22, -3.78], fov: 42, focus: 2.5 },
    lights: { pos: [4.4, 3.5, 3.9], look: [0.6, 1.8, -3.3], fov: 52, focus: 8.0 },
    journey: { pos: [0.55, 1.62, 2.75], look: [0.5, 2.0, -0.62], fov: 52, focus: 3.4 },
    van: { pos: [-11.2, 2.1, 1.6], look: [-7.9, 1.2, -3.2], fov: 44, focus: 6.0 },
    bottle: { pos: [-2.25, 1.0, -3.5], look: [-3.3, 0.12, -5.2], fov: 38, focus: 2.1 }
  };
  let anchors = null;
  /* the view of the van is kept relative to the van, so the clipboard reads well wherever it was parked */
  const V0van = JSON.parse(JSON.stringify(V.van)); let van0 = null;
  function vanView() {
    if (!van0) return V0van;
    const P = Engine.vanPose(), dh = P.heading - van0.heading, c = Math.cos(dh), s = Math.sin(dh);
    const rel = p => { const dx = p[0] - van0.x, dz = p[2] - van0.z; return [P.x + dx * c + dz * s, p[1], P.z - dx * s + dz * c]; };
    return Object.assign({}, V0van, { pos: rel(V0van.pos), look: rel(V0van.look) });
  }
  Object.defineProperty(V, 'van', { get: vanView, enumerable: true });

  /* ── text content ── */
  $('hName').textContent = Content.name; $('iName').textContent = Content.name;
  $('hRole').textContent = Content.role; $('iRole').textContent = Content.role;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* the words of each chapter as plain HTML, for screen readers (the pages themselves are pictures on paper) */
  function docText(id) {
    const C = Content, li = a => `<ul>${a.map(t => `<li>${t}</li>`).join('')}</ul>`;
    if (id === 'making') return C.making.map(s => `<h3>${esc(s.title)}</h3><p>${esc(s.lead)}</p>${s.points ? li(s.points) : ''}${s.steps ? li(s.steps.map(([l, t]) => `<b>${esc(l)}</b>: ${esc(t)}`)) : ''}`).join('');
    if (id === 'notes') return C.notes.map(n => `<h3>${esc(n.title)}</h3><p>${esc(n.problem)}</p><p>${esc(n.fix)}</p>`).join('');
    if (id === 'plans') return Pages.SHEETS.map(([t, sub, , notes]) => `<h3>${esc(t)}</h3><p>${esc(sub)}</p>${li(notes.map(esc))}`).join('');
    if (id === 'stack') return C.stack.map(g => `<h3>${esc(g.group)}</h3>${li(g.items.map(esc))}`).join('');
    if (id === 'contact') return `<p>${esc(C.letter.to)}</p>${C.letter.body.map(p => `<p>${esc(p)}</p>`).join('')}<p>${esc(C.letter.close)} ${esc(C.letter.sign)}</p><p>Email ${esc(C.contact.email)} · ${C.links.map(l => esc(l[2])).join(' · ')}</p>`;
    if (id === 'milestones') return li(C.journey.map(j => `${esc(j.when)} · ${esc(j.title)}: ${esc(j.text)}`));
    return '';
  }
  const dock = $('dock'), spots = $('spots');
  Content.chapters.forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = c.label; b.dataset.ch = c.id; b.setAttribute('aria-current', 'false');
    b.addEventListener('click', () => openChapter(st.chapter === c.id ? null : c.id)); dock.appendChild(b);
    const s = document.createElement('button'); s.type = 'button'; s.className = 'spot'; s.dataset.ch = c.id; s.setAttribute('aria-label', c.label);
    s.innerHTML = `<span class="lbl">${esc(c.label)}</span><i></i>`; s.addEventListener('click', e => { e.stopPropagation(); openChapter(c.id); }); spots.appendChild(s);
    c.spot = s;
  });
  function openChapter(id) {
    const c = Content.chapters.find(x => x.id === id);
    if (c && wk.on) stopWalk();
    if (rd.on && rd.id === id) return;
    if (rd.on) stopReading(!!c);
    st.chapter = c ? id : null;
    dock.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.ch === id)));
    Content.chapters.forEach(x => { x.spot.classList.toggle('on', x.id === id); x.spot.classList.toggle('dim', !!c && x.id !== id); });
    const d = $('drawer');
    if (c) { readSeen.add(c.id); if (readSeen.size >= Content.chapters.length) unlock('reader'); }
    if (c && RD[c.id]) { d.hidden = true; document.body.classList.remove('reading'); startReading(c.id); return; }
    document.body.classList.toggle('reading', !!c);
    d.classList.toggle('menu-mode', false);
    if (c) { $('dEyebrow').textContent = c.eyebrow; $('dTitle').textContent = c.title; $('dBody').innerHTML = docText(c.id); d.hidden = false; d.scrollTop = 0; goView(c.cam); }
    else { d.hidden = true; goView('wide'); }
  }
  $('dClose').addEventListener('click', () => openChapter(null));
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('credits').hidden) toggleCredits(false); else if (!$('settings').hidden) toggleSettings(false); else openChapter(null); return; }
    if (rd.on) {
      const k = e.key;
      if (k === '+' || k === '=') { rd.zoomT = Math.min(2.4, rd.zoomT * 1.25); e.preventDefault(); }
      else if (k === '-' || k === '_') { rd.zoomT = Math.max(1, rd.zoomT / 1.25); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { readNav(1); e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { readNav(-1); e.preventDefault(); }

    }
  });
  function goView(name) {
    /* (back to the explore camera when it is already on its way there: nothing to restart) */
    if ((V[name] || V.wide) === V.wide && st.to === V.wide) return;
    st.from = st.cur ? JSON.parse(JSON.stringify(st.cur)) : V.wide; st.to = V[name] || V.wide; st.camT = 0; st.camDur = camDur(st.from, st.to);
  }

  /* ── reading in the scene: every chapter is an object that opens where it lies ──
     book   the menu on the table, the journal by the fire: the camera comes down and the pages turn
     paper  the letter, the blueprints, the clipboard: picked up, unrolled, held in front of you
     tags   the journey: the string lights flicker, then a paper tag hangs under a bulb for each stop */
  const RD = {
    making: { kind: 'book', book: 'menu', doc: 'making', tilt: 0.2, links: ['source'] },
    notes: { kind: 'book', book: 'journal', doc: 'notes', tilt: 0.42 },
    plans: { kind: 'paper', doc: 'plans', origin: 'roll', view: 'basket', W: 0.46, H: 0.325, R0: 0.013, rolled: true, back: '#2a5a95', links: ['source'] },
    stack: { kind: 'paper', doc: 'stack', origin: 'clipboard', view: 'van', W: 0.24, H: 0.336, rolled: false, board: true, back: '#f2eee4' },
    contact: { kind: 'paper', doc: 'letter', origin: 'bottle', view: 'bottle', W: 0.24, H: 0.341, R0: 0.011, rolled: true, back: '#e6d4ad', links: ['email', 'linkedin', 'github'] },
    milestones: { kind: 'tags', view: 'journey' }
  };
  const rd = { on: false, id: null, cfg: null, docs: {}, s: 1, cam: null, pending: null, held: null, tagT0: 0, tagIdx: 0, flick: 0, zoom: 1, zoomT: 1, pan: [0, 0], panT: [0, 0], drag: null };
  const single = () => view.w < 720 || view.w / view.h < 1.0;
  /* documents are typeset once per layout (phones get narrower sheets with bigger type) */
  const bookKey = {};
  function doc(name) {
    const compact = single(), key = name + (compact ? ':c' : '');
    const r = rd.docs[key] || (rd.docs[key] = Pages[name](Content, { compact }));
    const cfg = Object.values(RD).find(c => c.doc === name);
    if (cfg && cfg.kind === 'book' && bookKey[cfg.book] !== key) { bookKey[cfg.book] = key; Engine.books[cfg.book].setPages(r.canvases); }
    if (cfg && cfg.kind === 'book') r.last = 2 * Engine.books[cfg.book].maxSpread + 1;
    return r;
  }
  const docOf = cfg => rd.docs[cfg.doc + (single() ? ':c' : '')] || doc(cfg.doc);
  const LINKS = {
    email: () => ['Email', `mailto:${Content.contact.email}`],
    linkedin: () => ['LinkedIn ↗', Content.links[0][1]],
    github: () => ['GitHub ↗', Content.links[1][1]],
    source: () => ['Source on GitHub ↗', 'https://github.com/GokulMV/moonlit-cove']
  };
  function startReading(id) {
    const cfg = RD[id]; rd.on = true; rd.id = id; rd.cfg = cfg; rd.cam = null; rd.held = null; rd.zoom = rd.zoomT = 1; rd.pan = [0, 0]; rd.panT = [0, 0];
    toggleSettings(false);
    document.body.classList.add('reading-book'); $('reader').hidden = false;
    $('rLinks').innerHTML = (cfg.links || []).map(k => { const [t, h] = LINKS[k](); return `<a href="${esc(h)}"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(t)}</a>`; }).join('');
    $('rText').innerHTML = docText(id);
    st.from = st.cur ? JSON.parse(JSON.stringify(st.cur)) : V.wide; st.camT = 0;
    /* first the camera comes to the object; only once it is there does the object open */
    const arrive = fn => { rd.pending = () => { if (rd.on && rd.id === id) fn(); }; };
    if (cfg.kind === 'book') {
      doc(cfg.doc); rd.s = 1;
      st.to = bookView();
      arrive(() => Engine.books[cfg.book].go(spreadOf(rd.s), true));
    } else if (cfg.kind === 'paper') {
      const r = doc(cfg.doc), v = V[cfg.view], c0 = r.canvases[0], W = cfg.W, H = W * c0.height / c0.width;
      rd.held = heldPose(v, W, H); rd.paperWH = [W, H];
      st.to = Object.assign({}, v, { focus: rd.held.d });
      const go = () => {
        Engine.prop(cfg.origin, false);
        Engine.paper.open({ W: rd.paperWH[0], H: rd.paperWH[1], R0: cfg.R0, rolled: cfg.rolled, board: cfg.board, backColor: cfg.back, pages: r.canvases, origin: Engine.origin(cfg.origin), held: rd.held, fly: cfg.board ? 1.25 : 1.5, lift: cfg.board ? 1 : 0 });
        syncReader();
      };
      /* the bottle: the cork pops first, and the letter slides out once it is clear */
      arrive(cfg.origin === 'bottle' ? () => { Engine.corkOut(true); setTimeout(() => { if (rd.on && rd.id === id) go(); }, 520); } : go);
    } else if (cfg.kind === 'tags') {
      st.to = V[cfg.view]; rd.tagT0 = 0; rd.flick = 0; rd.tagIdx = 0;
      buildTags();
      /* the lights flicker once the camera is under them, then the tags come down */
      arrive(() => { rd.flick = performance.now(); rd.tagT0 = rd.flick + 1500; });
    }
    st.camDur = camDur(st.from, st.to);
    /* how to turn the pages: said once as it opens, then it fades */
    const many = cfg.kind === 'book' || (cfg.kind === 'paper' && cfg.doc !== 'letter');
    $('rHint').textContent = many ? (isTouch ? 'Tap the right side for the next page, the left to go back, or drag a page · pinch to zoom' : 'Click the right side for the next page, the left to go back, or drag a page · scroll to zoom') : (cfg.kind === 'paper' ? 'Scroll or pinch to look closer' : '');
    document.body.classList.remove('rd-hint-off'); clearTimeout(rd.hintTimer); rd.hintTimer = setTimeout(() => document.body.classList.add('rd-hint-off'), 7000);
    syncReader();
  }
  /* how long the camera takes: short hops are quick, the long way round from the wide view takes its time */
  const camDur = (a, b) => { const d = a && b ? Math.hypot(...a.pos.map((v, i) => v - b.pos[i])) : 20; return Math.max(1.1, Math.min(2.2, 0.8 + d / 14)); };
  function stopReading(goingElsewhere) {
    if (!rd.on) return;
    const cfg = rd.cfg, opened = !rd.pending; rd.on = false; rd.pending = null; endPageDrag(false);
    if (cfg.kind === 'book') Engine.books[cfg.book].go(0, false);
    if (cfg.kind === 'paper') { const o = cfg.origin; if (Engine.paper.mode === 'hidden') { Engine.prop(o, true); Engine.corkOut(false); } else Engine.paper.close(() => { Engine.prop(o, true); if (o === 'bottle') Engine.corkOut(false); }); }
    if (!opened && cfg.origin === 'bottle') Engine.corkOut(false);
    if (cfg.kind === 'tags') { $('tags').hidden = true; $('tags').innerHTML = ''; }
    rd.id = null; rd.cfg = null;
    document.body.classList.remove('reading-book'); $('reader').hidden = true;
    if (!goingElsewhere) { st.chapter = null; dock.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', 'false')); Content.chapters.forEach(x => x.spot.classList.remove('on', 'dim')); goView('wide'); }
  }
  /* books read by spread (two facing pages) on wide screens, by single page on phones */
  const spreadOf = s => Math.floor(s / 2);
  function readNav(dir) {
    if (!rd.on) return;
    const cfg = rd.cfg;
    if (cfg.kind === 'book') {
      const bk = Engine.books[cfg.book], r = docOf(cfg), one = single(), s0 = rd.s;
      if (one) rd.s = Math.max(0, Math.min(r.last, rd.s + dir));
      else { const k = Math.max(0, Math.min(bk.maxSpread, spreadOf(rd.s) + dir)); rd.s = k * 2 + 1; }
      if (rd.s === s0) return;
      if (spreadOf(rd.s) !== spreadOf(s0)) { if (!rd.pending) bk.go(spreadOf(rd.s), true); pageSound(); }
    } else if (cfg.kind === 'paper') { if (Engine.paper.turn(dir)) pageSound(); }
    else if (cfg.kind === 'tags') { rd.tagIdx = Math.max(0, Math.min(Content.journey.length - 1, rd.tagIdx + dir)); }
    syncReader();
  }
  const pageSound = () => { if (sound.on && sound.amb && sound.amb.page) sound.amb.page(); };
  function syncReader() {
    const cfg = rd.cfg; if (!cfg) return;
    let txt = '', canP = false, canN = false;
    if (cfg.kind === 'book') {
      const r = docOf(cfg), bk = Engine.books[cfg.book], one = single(), k = spreadOf(rd.s), name = s => s === 0 ? 'Contents' : s > r.pages ? 'Last page' : `Page ${s}`;
      if (one) txt = `${name(rd.s)} · ${r.labels[rd.s] || ''}`;
      else { const L = 2 * k, R = 2 * k + 1, sec = r.labels[R] || r.labels[L] || ''; txt = L === 0 ? `${name(0)} · page 1 of ${r.pages}` : R > r.pages ? `Page ${L} of ${r.pages} · ${r.labels[L]}` : `Pages ${L}–${R} of ${r.pages} · ${sec}`; }
      canP = one ? rd.s > 0 : k > 0; canN = one ? rd.s < r.last : k < bk.maxSpread;
    } else if (cfg.kind === 'paper') {
      /* the sheet being turned to, not the one still lifting away */
      const r = docOf(cfg), i = Engine.paper.count ? Engine.paper.target : 0;
      txt = cfg.doc === 'letter' ? 'A letter, from the bottle' : cfg.doc === 'plans' ? `Sheet ${i + 1} of ${r.pages} · ${r.labels[i] || ''}` : `${r.title || 'Page'} · ${i + 1} of ${r.pages}`;
      canP = i > 0; canN = i < r.pages - 1;
    } else { const one = single(); txt = one ? `${Content.journey[rd.tagIdx].when} · ${Content.journey[rd.tagIdx].title}` : 'The journey so far'; canP = one && rd.tagIdx > 0; canN = one && rd.tagIdx < Content.journey.length - 1; }
    $('rPage').textContent = txt; $('rPrev').disabled = !canP; $('rNext').disabled = !canN;
    $('rPrev').hidden = $('rNext').hidden = cfg.kind === 'tags' && !single() || cfg.doc === 'letter';
  }
  /* the camera over an open book, a little tilted toward the reader */
  function bookView() {
    const cfg = rd.cfg, f = Engine.books[cfg.book].frame(), one = single(), aspect = view.w / view.h, fov = 34, tf = Math.tan(fov * Math.PI / 360);
    const side = one ? (rd.s % 2 ? 1 : -1) : 0;
    const fitW = one ? f.W * 1.1 : 2 * f.W * 1.1, fitH = f.H * 1.1, hFrac = Math.max(0.6, 1 - (one ? 150 : 170) / view.h);
    const z = rd.zoom, d = Math.max(fitH / (2 * tf * hFrac), fitW / (2 * tf * aspect)) / z, tilt = cfg.tilt || 0.2, k = 1 - 1 / z;
    const look = [0, 1, 2].map(i => f.o[i] + f.right[i] * (side * f.W / 2 + rd.pan[0] * (one ? f.W / 2 : f.W) * k) - f.top[i] * rd.pan[1] * f.H / 2 * k + f.up[i] * 0.004);
    const pos = [0, 1, 2].map(i => look[i] + f.up[i] * d * Math.cos(tilt) - f.top[i] * d * Math.sin(tilt));
    return { pos, look, fov, focus: d };
  }
  /* where a picked-up sheet is held: centred in the view, square to the camera, filling most of the height */
  function heldPose(v, W, H, z = 1, pan = [0, 0]) {
    const T = THREE, P = new T.Vector3(...v.pos), Lk = new T.Vector3(...v.look), dir = Lk.clone().sub(P).normalize();
    const aspect = view.w / view.h, tf = Math.tan(v.fov * Math.PI / 360);
    const d0 = Math.max(H / (2 * tf * (1 - 190 / view.h)), W / (2 * tf * aspect * 0.9)), d = d0 / z, k = 1 - 1 / z;
    const m = new T.Matrix4().lookAt(P, Lk, new T.Vector3(0, 1, 0)), up = new T.Vector3().setFromMatrixColumn(m, 1), right = new T.Vector3().setFromMatrixColumn(m, 0);
    const c = P.clone().addScaledVector(dir, d);
    c.addScaledVector(up, d * tf * 0.04 + pan[1] * H / 2 * k).addScaledVector(right, -pan[0] * W / 2 * k);
    const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(P, c, new T.Vector3(0, 1, 0)));
    return { p: c.toArray(), q: q.toArray(), d };
  }
  /* the journey: a paper tag under a bulb for each stop */
  let tagBulbs = null;
  function buildTags() {
    const el = $('tags'); el.hidden = false;
    if (!tagBulbs) { const b = Engine.strandBulbs(1).sort((p, q) => p[0] - q[0]), n = Content.journey.length; tagBulbs = Content.journey.map((_, i) => b[Math.round(i * (b.length - 1) / (n - 1))]); }
    el.innerHTML = Content.journey.map((j, i) => `<div class="tag" data-i="${i}"><i class="tstring"></i><div class="tcard"><span class="twhen">${esc(j.when)}</span><b>${esc(j.title)}</b><span class="ttext">${esc(j.text)}</span></div></div>`).join('');
  }
  function placeTags(now) {
    if (!rd.on || !rd.cfg || rd.cfg.kind !== 'tags' || !tagBulbs) return;
    const one = single(), shown = Math.floor((now - rd.tagT0) / 380) + 1;
    $('tags').querySelectorAll('.tag').forEach((el, i) => {
      const p = Engine.project(tagBulbs[i]), x = view.x + p[0] * view.w, y = view.y + p[1] * view.h;
      const vis = rd.tagT0 > 0 && now >= rd.tagT0 && (one ? i === rd.tagIdx : i < shown) && p[2] < 1;
      const drop = one ? 40 : 30 + (i % 2) * 150;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.style.setProperty('--drop', drop + 'px');
      const cw = Math.min(260, view.w * 0.8) / 2 + 12; el.style.setProperty('--nudge', `${(Math.max(view.x + cw, Math.min(view.x + view.w - cw, x)) - x).toFixed(1)}px`);
      el.classList.toggle('on', vis);
    });
  }
  $('rPrev').addEventListener('click', () => readNav(-1));
  $('rNext').addEventListener('click', () => readNav(1));
  $('rClose').addEventListener('click', () => openChapter(null));

  /* ── sky chip ── */
  const mi = $('moonIcon'), mx = mi.getContext('2d');
  function drawMoon(phase, frac) {
    const r = 26, c = 32; mx.clearRect(0, 0, 64, 64);
    mx.fillStyle = 'rgba(184,203,239,0.16)'; mx.beginPath(); mx.arc(c, c, r, 0, Math.PI * 2); mx.fill();
    mx.save(); mx.beginPath(); mx.arc(c, c, r, 0, Math.PI * 2); mx.clip();
    const waxing = phase < 0.5, k = Math.cos(frac * Math.PI) * r;
    mx.fillStyle = '#ece6da'; mx.beginPath();
    mx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, !waxing);
    mx.ellipse(c, c, Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
    mx.fill(); mx.restore();
  }
  const two = n => String(n).padStart(2, '0');
  let skyTick = 0;
  function updateSky(ms, S) {
    if (performance.now() - skyTick < 500) return; skyTick = performance.now();
    const d = new Date(ms), il = S.illum;
    $('skyPhase').textContent = `${Astro.phaseName(il.phase)} · ${Math.round(il.fraction * 100)}%`;
    const alt = S.mAlt > 0 ? `moon ${Math.round(S.mAlt)}° up` : (S.sAlt > 0 ? `sun ${Math.round(S.sAlt)}° up` : 'moon below horizon');
    $('skyTime').textContent = `${two(d.getHours())}:${two(d.getMinutes())} · ${city} · ${alt}`;
    drawMoon(il.phase, il.fraction);
  }
  $('sky').addEventListener('click', () => toggleSettings(true));

  /* ── time ── */
  function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  let fullCache = null;
  function nowMs() {
    let ms = st.timeMode === 'live' ? Date.now() : startOfDay(Date.now()) + st.hour * 3600e3;
    ms += st.offset;
    if (st.full) {
      if (!fullCache || Math.abs(fullCache.base - startOfDay(Date.now())) > 1) { const f = Astro.nextFullMoon(Date.now() - 2 * 864e5); fullCache = { base: startOfDay(Date.now()), day: startOfDay(f) }; }
      ms = fullCache.day + (ms - startOfDay(ms));
    }
    return ms;
  }

  /* ── settings panel ── */
  const setSw = (el, v) => el.setAttribute('aria-checked', String(!!v));
  function toggleSettings(open) {
    const p = $('settings'), b = $('bGear'); const o = open ?? p.hidden;
    p.hidden = !o; b.setAttribute('aria-expanded', String(o));
  }
  $('bGear').addEventListener('click', () => toggleSettings());
  function seg(attr, val) { document.querySelectorAll(`[data-${attr}]`).forEach(b => b.setAttribute('aria-checked', String(b.dataset[attr] === String(val)))); }
  function syncTimeUI() {
    seg('time', st.timeMode); seg('flow', st.flow); setSw($('tFull'), st.full);
    $('tHour').value = st.hour;
    const h = Math.floor(st.hour), m = Math.floor((st.hour - h) * 60); $('tHourV').textContent = `${two(h)}:${two(m)}`;
    $('tNote').textContent = st.timeMode === 'live' ? `Following your local time in ${city}${st.full ? ', on the next full moon' : " and tonight's real moon"}.` : `Holding the hour you pick${st.full ? ', on the next full moon' : ''}.`;
  }
  document.querySelectorAll('[data-time]').forEach(b => b.addEventListener('click', () => { st.timeMode = b.dataset.time; st.offset = 0; store.set('timeMode', st.timeMode); syncTimeUI(); }));
  document.querySelectorAll('[data-flow]').forEach(b => b.addEventListener('click', () => { st.flow = +b.dataset.flow; syncTimeUI(); }));
  $('tHour').addEventListener('input', e => { st.hour = +e.target.value; st.timeMode = 'custom'; st.offset = 0; store.set('hour', st.hour); store.set('timeMode', 'custom'); syncTimeUI(); });
  /* one-tap moments: sunset, night, sunrise at your location today */
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.preset, day0 = startOfDay(Date.now()), toH = ms => (ms - day0) / 3600e3;
    st.offset = 0;
    if (p === 'now') { st.timeMode = 'live'; }
    else {
      st.timeMode = 'custom';
      if (p === 'night') st.hour = 23;
      else { const fn = p === 'sunset' ? Astro.sunSet : Astro.sunRise, ms = fn(day0 + (p === 'sunset' ? 6 : 0) * 3600e3, loc.lat, loc.lng); st.hour = ms ? Math.max(0, Math.min(23.95, toH(ms) + (p === 'sunset' ? -0.2 : -0.35))) : (p === 'sunset' ? 18 : 6); }
      store.set('hour', st.hour);
    }
    store.set('timeMode', st.timeMode); syncTimeUI();
    toast(p === 'now' ? 'Back to live time.' : `Jumped to ${p}.`, false, 1800);
  }));
  $('tFull').addEventListener('click', () => { st.full = !st.full; store.set('full', st.full); syncTimeUI(); });
  $('lSoft').value = st.soft; $('lSoft').addEventListener('input', e => { st.soft = +e.target.value; store.set('soft', st.soft); });
  $('lMotion').value = st.motion; $('lMotion').addEventListener('input', e => { st.motion = +e.target.value; store.set('motion', st.motion); });
  /* how much life there is: insects, fish, shells (0.5 is the cove as it always was; shells start all out) */
  st.dens = Object.assign({ insects: 0.5, fish: 0.5, shells: 1 }, store.get('dens', {}));
  for (const [k, id] of [['insects', 'dInsects'], ['fish', 'dFish'], ['shells', 'dShells']]) {
    $(id).value = st.dens[k]; $(id).addEventListener('input', e => { st.dens[k] = +e.target.value; store.set('dens', st.dens); });
  }
  /* where the lights are heading (not how bright they are mid-fade): the button flips that */
  const lightsWanted = () => st.lightsMode === 'on' ? true : st.lightsMode === 'off' ? false : !!(st.S && st.S.lightsAuto);
  function syncLightsUI() { seg('lights', st.lightsMode); $('bLights').setAttribute('aria-pressed', String(lightsWanted())); }
  document.querySelectorAll('[data-lights]').forEach(b => b.addEventListener('click', () => { st.lightsMode = b.dataset.lights; store.set('lightsMode', st.lightsMode); st.lightsQuick = 1; syncLightsUI(); }));
  $('bLights').addEventListener('click', () => { st.lightsMode = lightsWanted() ? 'off' : 'on'; store.set('lightsMode', st.lightsMode); st.lightsQuick = 1; syncLightsUI(); });

  /* ── the name in the corner: shown or hidden, remembered ── */
  st.brand = store.get('brand', true);
  function syncBrand() { $('brand').classList.toggle('off', !st.brand); $('bBrandShow').hidden = st.brand; setSw($('lBrand'), st.brand); }
  const setBrand = v => { st.brand = v; store.set('brand', v); syncBrand(); };
  $('bBrandHide').addEventListener('click', () => setBrand(false));
  $('bBrandShow').addEventListener('click', () => setBrand(true));
  $('lBrand').addEventListener('click', () => setBrand(!st.brand));
  syncBrand();

  /* ── credits: every sound, typeface, library and idea that came from someone else ── */
  function renderCredits() {
    $('cBody').innerHTML = Content.credits.map(g => `<section><h3>${esc(g.group)}</h3><ul>${g.items.map(i => `<li><b>${esc(i.what)}</b><span>${esc(i.who)}</span><span class="cl">${i.link ? `<a href="${esc(i.link[1])}" target="_blank" rel="noopener">${esc(i.link[0])} ↗</a>` : ''}${i.licence ? `<em>${esc(i.licence)}</em>` : ''}</span></li>`).join('')}</ul></section>`).join('');
  }
  function toggleCredits(open) { const c = $('credits'), o = open ?? c.hidden; c.hidden = !o; if (o) { renderCredits(); toggleSettings(false); c.scrollTop = 0; } }
  document.querySelectorAll('[data-open-credits]').forEach(b => b.addEventListener('click', () => toggleCredits(true)));
  $('cClose').addEventListener('click', () => toggleCredits(false));

  /* ── sound ── */
  const chIds = { ocean: 'sOcean', forest: 'sForest', fire: 'sFire', insects: 'sInsects', weather: 'sWeather', tone: 'sTone' };
  function startSound() {
    if (!sound.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      sound.ctx = new AC(); sound.amb = Ambience.create(sound.ctx, { level: sound.vol, seed: 1234, sounds: typeof SND !== 'undefined' ? SND : {} });
      Object.entries(sound.ch).forEach(([k, v]) => sound.amb.setEnabled(k, v));
    }
    sound.ctx.resume && sound.ctx.resume();
    sound.amb.fadeIn(sound.ctx.currentTime, 2.5, sound.vol); sound.on = true; syncSoundUI();
  }
  function stopSound() { if (sound.amb) sound.amb.setEnabled('master', false); sound.on = false; syncSoundUI(); }
  function syncSoundUI() { setSw($('sMaster'), sound.on); $('bSound').setAttribute('aria-pressed', String(sound.on)); Object.entries(chIds).forEach(([k, id]) => setSw($(id), sound.ch[k])); $('sVol').value = sound.vol; }
  $('bSound').addEventListener('click', () => sound.on ? stopSound() : startSound());
  $('sMaster').addEventListener('click', () => sound.on ? stopSound() : startSound());
  Object.entries(chIds).forEach(([k, id]) => $(id).addEventListener('click', () => { sound.ch[k] = !sound.ch[k]; store.set('ch', sound.ch); if (sound.amb) sound.amb.setEnabled(k, sound.ch[k]); syncSoundUI(); }));
  $('sVol').addEventListener('input', e => { sound.vol = +e.target.value; store.set('vol', sound.vol); if (sound.amb) sound.amb.setLevel(sound.vol); });

  /* ── sky and weather: clouds in kinds, rain, storms with lightning ── */
  const WX = {
    clear: { cirrus: 0.15, alto: 0, cumulus: 0.16, stratus: 0, storm: 0, rain: 0 },
    wispy: { cirrus: 0.95, alto: 0.1, cumulus: 0.22, stratus: 0, storm: 0, rain: 0 },
    puffy: { cirrus: 0.22, alto: 0.08, cumulus: 1.0, stratus: 0, storm: 0, rain: 0 },
    mackerel: { cirrus: 0.4, alto: 0.95, cumulus: 0.28, stratus: 0, storm: 0, rain: 0 },
    overcast: { cirrus: 0, alto: 0.35, cumulus: 0.5, stratus: 0.88, storm: 0, rain: 0 },
    rain: { cirrus: 0, alto: 0.15, cumulus: 0.45, stratus: 1, storm: 0.12, rain: 1 },
    storm: { cirrus: 0, alto: 0.05, cumulus: 0.55, stratus: 1, storm: 1, rain: 1 }
  };
  const AUTO = ['puffy', 'wispy', 'mackerel', 'clear', 'puffy', 'mackerel', 'wispy', 'overcast'];
  const WXNOTE = { auto: 'Clouds drift through their kinds on their own.', clear: 'A clear sky, a few wisps.', wispy: 'High cirrus: thin mare’s tails.', puffy: 'Cumulus heaped along the horizon.', mackerel: 'A mackerel sky of altocumulus.', overcast: 'A grey deck of stratus.', rain: 'Rain on the sand and the sea. The fire burns low.', storm: 'A thunderstorm out at sea.' };
  st.weather = store.get('weather', 'auto'); if (st.weather !== 'auto' && !WX[st.weather]) st.weather = 'auto'; st.wx = Object.assign({}, WX.puffy, { wet: 0 }); st.flash = null; st.nextBolt = 0;
  function syncWxUI() { seg('wx', st.weather); $('wxNote').textContent = WXNOTE[st.weather] || ''; }
  document.querySelectorAll('[data-wx]').forEach(b => b.addEventListener('click', () => { st.weather = b.dataset.wx; store.set('weather', st.weather); syncWxUI(); if (st.weather === 'storm') unlock('storm'); }));
  function stepWeather(dt) {
    const tgt = (st.weather === 'auto' ? WX[AUTO[Math.floor(Date.now() / 420000) % AUTO.length]] : WX[st.weather]) || WX.clear;
    const a = 1 - Math.exp(-dt / (st.weather === 'auto' ? 40 : 5));
    for (const k of Object.keys(tgt)) st.wx[k] += (tgt[k] - st.wx[k]) * a;
    st.wx.wet += ((st.wx.rain > 0.3 ? 1 : 0) - st.wx.wet) * (1 - Math.exp(-dt / (st.wx.rain > 0.3 ? 8 : 60)));
    /* lightning: two or three quick pulses, a bolt, thunder a few seconds later */
    const now = performance.now() / 1000;
    if (st.wx.storm > 0.6 && now > st.nextBolt) {
      st.nextBolt = now + 5 + Math.random() * 10;
      const az = 0.55 + (Math.random() - 0.5) * 0.6;
      st.flash = { t0: now, az, seed: Math.random(), pulses: [0, 0.09 + Math.random() * 0.08, 0.26 + Math.random() * 0.15].slice(0, 2 + (Math.random() < 0.5 ? 1 : 0)) };
      if (sound.on && sound.ctx) sound.thunder.push({ id: 'th' + now.toFixed(2), t: sound.ctx.currentTime + 1.4 + Math.random() * 2.6, k: 0.7 + Math.random() * 0.3, pan: (az - 0.55) * 1.2 });
    }
    let flash = 0, bolt = null;
    if (st.flash) { const e = now - st.flash.t0; for (const p of st.flash.pulses) if (e > p) flash = Math.max(flash, Math.exp(-(e - p) / 0.07)); if (e < 0.32) bolt = [st.flash.az, 0, st.flash.seed, Math.max(0, 1 - e / 0.32)]; if (e > 1.2) st.flash = null; }
    return { flash, bolt };
  }
  syncWxUI();

  /* ── toasts ── */
  function toast(text, btn, ms = 3800) {
    const t = $('toast'); $('toastText').textContent = text; $('toastBtn').hidden = !btn; t.hidden = false;
    clearTimeout(st.toastTimer); if (ms) st.toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }
  $('toastBtn').addEventListener('click', () => { Engine.rebuildCamp(); st.wrecked = false; sound.douse = null; toast('Camp rebuilt. The fire is going again.', false, 2600); });

  /* ── reading: tap the right half for the next page, the left half to go back. Or take hold of a page and drag
     it: it follows the pointer, and let go past halfway (or with a flick) it turns, otherwise it settles back ── */
  function startPageDrag(dir) {
    const cfg = rd.cfg; if (!cfg || rd.pending) return false;
    if (cfg.kind === 'book') return Engine.books[cfg.book].dragStart(dir);
    if (cfg.kind === 'paper' && cfg.doc !== 'letter') return Engine.paper.dragStart(dir);
    return false;
  }
  function endPageDrag(commit) {
    const g = rd.drag; rd.drag = null; document.body.classList.remove('rd-grab');
    if (!g || !g.live || !rd.cfg) return;
    const cfg = rd.cfg;
    if (cfg.kind === 'book') {
      const bk = Engine.books[cfg.book], k0 = bk.spread;
      if (bk.dragEnd(commit)) { const k = k0 + g.dir; rd.s = single() ? (g.dir > 0 ? 2 * k : 2 * k + 1) : 2 * k + 1; pageSound(); }
    } else if (Engine.paper.dragEnd(commit)) pageSound();
    syncReader();
  }
  /* which half of the page the pointer is over, shown with the cursor */
  function readCursor(e) {
    let c = '';
    if (rd.on && rd.cfg && rd.cfg.kind !== 'tags' && !rd.pending && !(rd.drag && rd.drag.live)) { const next = e.clientX - view.x >= view.w / 2; c = next ? ($('rNext').disabled ? '' : 'rd-next') : ($('rPrev').disabled ? '' : 'rd-prev'); }
    document.body.classList.toggle('rd-next', c === 'rd-next'); document.body.classList.toggle('rd-prev', c === 'rd-prev');
  }
  cv.addEventListener('pointerdown', e => {
    if (rd.on && e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0)) rd.drag = { x0: e.clientX, y0: e.clientY, id: e.pointerId, live: false, dir: 0, axis: 'x', f: 0, v: 0, lf: 0, lt: performance.now() };
  });
  cv.addEventListener('pointermove', e => {
    readCursor(e);
    const g = rd.drag; if (!g || g.id !== e.pointerId || !rd.on) return;
    if (pinch.size > 1) { if (g.live) endPageDrag(false); else rd.drag = null; return; }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.live) {
      if (Math.hypot(dx, dy) < 12) return;
      /* a book turns sideways; a loose sheet lifts over its top edge, so up (or left) is onward */
      g.axis = rd.cfg.kind === 'book' || Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      g.dir = (g.axis === 'x' ? dx : dy) < 0 ? 1 : -1;
      if (!startPageDrag(g.dir)) { rd.drag = null; return; }
      g.live = true; document.body.classList.add('rd-grab'); readCursor(e);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    }
    const span = rd.cfg.kind === 'book' ? Math.min(view.w * (single() ? 0.7 : 0.4), 560) : Math.min(view.h * 0.5, 460);
    const f = Math.max(0, Math.min(1, -(g.axis === 'x' ? dx : dy) * g.dir / span)), now = performance.now();
    g.v = 0.6 * g.v + 0.4 * (f - g.lf) / Math.max(1, now - g.lt) * 1000; g.lf = f; g.lt = now; g.f = f;
    if (rd.cfg.kind === 'book') Engine.books[rd.cfg.book].dragTo(f); else Engine.paper.dragTo(f);
  });
  cv.addEventListener('pointercancel', () => { if (rd.drag && rd.drag.live) endPageDrag(false); rd.drag = null; });

  /* ── clicks on the sea ── */
  let down = null;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  cv.addEventListener('pointerup', e => {
    if (!down || !st.entered) return; const dx = e.clientX - down.x, moved = Math.hypot(dx, e.clientY - down.y); down = null;
    if (rd.on) {
      const g = rd.drag;
      if (g && g.live) { endPageDrag(g.f > 0.42 || (g.v > 1.6 && g.f > 0.06)); return; }
      rd.drag = null;
      /* (the pinch map still holds this pointer: more than one means it was a pinch) */
      if (pinch.size > 1 || pinch0) return;
      if (moved <= 10) readNav(e.clientX - view.x < view.w / 2 ? -1 : 1);
      return;
    }
    /* a tap, not the end of a drag (one that came back to where it started), a pinch or a right click */
    if (moved > 8 || ex.dragged || ex.multi || e.button > 0) return;
    const r = cv.getBoundingClientRect(), info = Engine.clickSea((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, st.t);
    if (!info) return;
    if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; }
    if (sound.on && sound.amb) sound.amb.splash(sound.ctx.currentTime, info.combo);
    const msg = info.amp >= 4.6 ? `Swell ×${info.combo}. This one will flood the camp.` : info.amp >= 2.9 ? `Swell ×${info.combo}. It could reach the fire.` : info.combo > 1 ? `Swell ×${info.combo} building.` : 'A swell is on its way in.';
    toast(msg, false, 2600);
    if (info.amp >= 4) unlock('big_wave');
  });
  const zoomable = () => rd.on && rd.cfg && rd.cfg.kind !== 'tags';
  cv.addEventListener('wheel', e => {
    if (zoomable()) { e.preventDefault(); rd.zoomT = Math.max(1, Math.min(2.4, rd.zoomT * Math.exp(-e.deltaY * 0.0016))); return; }
    if (!canExplore()) return; e.preventDefault();
    orbWheel(e);
  }, { passive: false });
  const pinch = new Map(); let pinch0 = null;
  cv.addEventListener('pointerdown', e => { pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size === 2) { const [a, b] = [...pinch.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: rd.zoomT }; } });
  cv.addEventListener('pointermove', e => { if (!pinch.has(e.pointerId)) return; pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size === 2 && pinch0 && zoomable()) { const [a, b] = [...pinch.values()]; rd.zoomT = Math.max(1, Math.min(2.4, pinch0.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0.d)); } });
  const unpinch = e => { pinch.delete(e.pointerId); if (pinch.size < 2) pinch0 = null; };
  cv.addEventListener('pointerup', unpinch); cv.addEventListener('pointercancel', unpinch);
  addEventListener('pointermove', e => { if (zoomable() && !(rd.drag && rd.drag.live)) rd.panT = [Math.max(-1, Math.min(1, ((e.clientX - view.x) / view.w) * 2 - 1)) * 1.15, Math.max(-1, Math.min(1, ((e.clientY - view.y) / view.h) * 2 - 1)) * 1.15]; }, { passive: true });
  addEventListener('pointermove', e => { if (car.on && down && e.buttons) car.yaw = Math.max(-2.6, Math.min(2.6, car.yaw - e.movementX * 0.006)); }, { passive: true });
  addEventListener('pointerup', () => { if (car.on) car.yaw *= 0.5; });

  /* ── exploring: the camera turns round a point on the sand, the way a map turns under your hand. Drag to turn round
     it (up and down tilts), right-drag or Shift-drag to move it along the beach, scroll or pinch to come closer; on a
     phone one finger turns, two move, pinch and twist. One swipe is gentle; swipes that follow each other quickly build
     speed, and everything glides to a stop when you let go. With the point on the camp and nothing touched, it is
     exactly the composed home view ── */
  const TAU = Math.PI * 2, wrapA = a => a - TAU * Math.round(a / TAU);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  /* the home view taken apart: where it stands and where it looks, from the camp on the sand */
  const V0 = Layout.cameras.wide, P0 = [Layout.camp.x, 0, Layout.camp.z];
  const OP = V0.pos.map((v, i) => v - P0[i]), OL = V0.look.map((v, i) => v - P0[i]), RYZ = Math.hypot(OP[1], OP[2]), EL0 = Math.atan2(OP[1], OP[2]);
  const ORB = { elMin: 0.14, elMax: 1.05, zMin: Math.log(0.35), zMax: Math.log(1.7), glide: 0.26, boost: 4.5 };
  /* the open sand at x: the waterline, the forest edge, and the foot of a headland's rock where one stands on the beach
     (looked for a little beyond the trees, so that the edge of the sand moves smoothly as the rock comes and goes) */
  function sandAt(x, C) {
    if (C.x === x) return C;
    const W = Engine.world, sz = Layout.shoreZ(x), vz = Layout.vegZ(x); let foot = Infinity;
    if (W && W.massif(x, vz + 1.3) > 0.3) {
      let a = sz, b = vz + 1.3;
      if (W.massif(x, a) > 0.3) foot = a;
      else { for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (W.massif(x, m) > 0.3) b = m; else a = m; } foot = a; }
    }
    C.x = x; C.sz = sz; C.vz = vz; C.foot = foot; return C;
  }
  /* where the point may go: from the shallows to the trees, or to a little short of the rock */
  const pvC = { x: NaN }, pvLo = C => C.sz - 0.5, pvHi = C => Math.max(C.sz + 1, Math.min(C.vz + 0.5, C.foot - 0.8));
  /* five axes, each a value easing to a target with a critically damped spring: the turn, the tilt (the camera's
     elevation seen from the point), the zoom (log of the distance), and the point itself, as x along the beach and
     the fraction of the way across the sand, so that it follows the coast as it moves */
  const Y = 0, E = 1, Z = 2, X = 3, U = 4, OMEGA = [13, 13, 9, 11, 11];
  const C0 = sandAt(P0[0], { x: NaN }), HOME = [0, EL0, 0, P0[0], (P0[2] - pvLo(C0)) / (pvHi(C0) - pvLo(C0))];
  const orb = { v: Float64Array.from(HOME), dv: new Float64Array(5), T: Float64Array.from(HOME), g: new Float64Array(5),
                el: EL0, Fs: ORB.elMin, pz: P0[2], boost: 1, lastEnd: -1e9, fly: null, keys: new Set() };
  const orbCam = { pos: V0.pos.slice(), look: V0.look.slice(), fov: V0.fov, focus: V0.focus };
  V.wide = orbCam; st.from = st.to = orbCam;
  function spring(i, dt) {
    const w = OMEGA[i], T = orb.T[i], e = orb.v[i] - T, k = Math.exp(-w * dt), t1 = (orb.dv[i] + w * e) * dt;
    orb.v[i] = T + (e + t1) * k; orb.dv[i] = (orb.dv[i] - w * t1) * k;
    if (Math.abs(orb.v[i] - T) < 1e-7 && Math.abs(orb.dv[i]) < 1e-6) { orb.v[i] = T; orb.dv[i] = 0; }
  }
  /* the treetops, generously: palm crowns lean out over the sand a little before the forest edge and stand up to eleven
     metres, the tall palms further in up to fifteen; scrub and palms on a headland's flatter top. None in the clearing the
     camp sits in, where its own few trees are part of the view */
  function canopy(x, z) {
    const W = Engine.world, d = z - Layout.vegZ(x), open = (1 - sstep(15, 21, Math.abs(x))) * (1 - sstep(27, 33, z)), m = W ? W.massif(x, z) : 0;
    return Math.max((11 * sstep(-2.5, 1, d) + 4 * sstep(5, 8, d)) * (1 - open), 11 * sstep(1.5, 3, m));
  }
  /* the lowest tilt at which the camera, and its line of sight down to the point, clear the sand, the rock and the trees
     (worked out again only when the camera has moved) */
  const flr = { y: NaN, z: NaN, x: NaN, pz: NaN, el: 0 };
  function elFloor() {
    const v = orb.v; if (v[Y] === flr.y && v[Z] === flr.z && v[X] === flr.x && orb.pz === flr.pz) return flr.el;
    const k = Math.exp(v[Z]), sy = Math.sin(v[Y]), cy = Math.cos(v[Y]), W = Engine.world;
    let el = ORB.elMin;
    for (let it = 0; it < 2; it++) {
      const R = k * RYZ * Math.cos(el); let need = ORB.elMin;
      for (let i = 1; i <= 12; i++) {
        const r = R * Math.pow(i / 12, 1.3), x = v[X] + sy * r, z = orb.pz + cy * r;
        need = Math.max(need, Math.atan2(Math.max(0, W ? W.land(x, z) : 0) + canopy(x, z) + (i === 12 ? 1.6 : 0.4), r));
      }
      if (need <= el + 1e-4) break;
      el = need;
    }
    flr.y = v[Y]; flr.z = v[Z]; flr.x = v[X]; flr.pz = orb.pz;
    return (flr.el = Math.min(el, ORB.elMax + 0.25));
  }
  function stepOrbit(dt) {
    const T = orb.T, v = orb.v, g = orb.g;
    /* a glide home or to the van: the targets travel there, easing in and out, the camera rising a little on a long way */
    if (orb.fly) {
      const f = orb.fly; f.t += dt; const u = Math.min(1, f.t / f.dur), e = ease(u);
      for (let i = 0; i < 5; i++) T[i] = u >= 1 ? f.to[i] : f.from[i] + (f.to[i] - f.from[i]) * e;
      if (u < 1) T[Z] += f.hop * Math.sin(Math.PI * u); else orb.fly = null;
    }
    /* turning on the keys: the turn eases up to speed while they are held, and glides off when they are let go */
    const kr = canExplore() ? (orb.keys.has('l') ? 1 : 0) - (orb.keys.has('r') ? 1 : 0) : 0;
    if (kr) orb.fly = null;
    for (let i = 0; i < 5; i++) {
      if (i === Y && kr) { g[Y] += (kr * 0.9 - g[Y]) * (1 - Math.exp(-dt / 0.25)); T[Y] += g[Y] * dt; continue; }
      if (g[i]) { const d = Math.exp(-dt / ORB.glide); T[i] += g[i] * ORB.glide * (1 - d); g[i] *= d; if (Math.abs(g[i]) < 1e-4) g[i] = 0; }
    }
    /* the limits (a long glide may rise past the farthest zoom for a moment) */
    const zHi = orb.fly ? ORB.zMax + 0.6 : ORB.zMax;
    if (T[E] < ORB.elMin || T[E] > ORB.elMax) { T[E] = clamp(T[E], ORB.elMin, ORB.elMax); g[E] = 0; }
    if (T[Z] < ORB.zMin || T[Z] > zHi) { T[Z] = clamp(T[Z], ORB.zMin, zHi); g[Z] = 0; }
    if (T[U] < 0 || T[U] > 1) { T[U] = clamp(T[U], 0, 1); g[U] = 0; }
    for (let i = 0; i < 5; i++) spring(i, dt);
    v[E] = clamp(v[E], ORB.elMin - 0.02, ORB.elMax + 0.02); v[Z] = clamp(v[Z], ORB.zMin - 0.02, ORB.zMax + 0.6); v[U] = clamp(v[U], 0, 1);
    /* turns are kept within one revolution */
    if (!orb.fly && Math.abs(T[Y]) > Math.PI) { const k = Math.round(T[Y] / TAU) * TAU; T[Y] -= k; v[Y] -= k; }
    const C = sandAt(v[X], pvC), lo = pvLo(C);
    orb.pz = v[X] === P0[0] && v[U] === HOME[U] ? P0[2] : lo + v[U] * (pvHi(C) - lo);
    /* never into the sand, the rock or the trees: the camera rises over them at once, and settles back slowly */
    const F = elFloor(); orb.Fs += (F - orb.Fs) * (1 - Math.exp(-dt / (F > orb.Fs ? 0.12 : 0.6)));
    orb.el = Math.max(v[E], orb.Fs);
    orbPose();
    return orbCam;
  }
  function orbPose() {
    const v = orb.v, k = Math.exp(v[Z]), a = orb.el - EL0, ca = Math.cos(a), sa = Math.sin(a), cy = Math.cos(v[Y]), sy = Math.sin(v[Y]);
    /* tilted about the point and scaled: where the camera stands and looks, from the point */
    const cx = OP[0] * k, ch = (OP[1] * ca + OP[2] * sa) * k, cz = (OP[2] * ca - OP[1] * sa) * k;
    const lx = OL[0] * k; let ly = (OL[1] * ca + OL[2] * sa) * k, lz = (OL[2] * ca - OL[1] * sa) * k;
    /* tipped up toward overhead, the view leans down too, to bring the point toward the middle, as a map does */
    const dl = 0.21 * sstep(EL0 + 0.08, ORB.elMax, orb.el);
    if (dl > 0) { const dy = ly - ch, dz = lz - cz, c = Math.cos(dl), s = Math.sin(dl); ly = ch + dy * c + dz * s; lz = cz + dz * c - dy * s; }
    /* turned about the point and set on it; written as the home view plus the differences, so at home it is that view exactly */
    const px = v[X] - P0[0], pz = orb.pz - P0[2], p = orbCam.pos, l = orbCam.look;
    p[0] = V0.pos[0] + px + (cx * cy + cz * sy - OP[0]); p[1] = V0.pos[1] + (ch - OP[1]); p[2] = V0.pos[2] + pz + (cz * cy - cx * sy - OP[2]);
    l[0] = V0.look[0] + px + (lx * cy + lz * sy - OL[0]); l[1] = V0.look[1] + (ly - OL[1]); l[2] = V0.look[2] + pz + (lz * cy - lx * sy - OL[2]);
    orbCam.focus = V0.focus * k;
    /* and if it is in the ground anyway (a sudden rock under a quick turn), it is lifted clear */
    if (Engine.world) { const gd = Engine.world.land(p[0], p[2]) + 0.45; if (p[1] < gd) { l[1] += gd - p[1]; p[1] = gd; } }
  }
  /* a glide to somewhere: home, or to the van; longer ways take longer and rise a little on the way */
  function orbFly(to) {
    const T = orb.T, d = Math.abs(to[X] - T[X]) + Math.abs(to[U] - T[U]) * 8;
    orb.fly = { t: 0, from: Array.from(T), to, dur: clamp(1.1 + 0.55 * Math.log2(1 + d / 10) + 0.25 * Math.abs(to[Y] - T[Y]), 1.1, 3.6), hop: Math.min(0.55, d / 250) };
    orb.g.fill(0);
  }
  const orbHome = () => orbFly(HOME.slice());
  function orbToVan() {
    if (!ready) return;
    const P = Engine.vanPose(), C = sandAt(P.x, pvC), lo = pvLo(C), hi = pvHi(C);
    orbFly([orb.T[Y], orb.T[E], Math.min(orb.T[Z], Math.log(0.8)), P.x, clamp((P.z - lo) / (hi - lo), 0, 1)]);
  }
  /* the point set down at once (where you stopped walking, where the van was parked), facing the way you were */
  function orbAt(x, z, yaw, zoom) {
    const C = sandAt(x, pvC), lo = pvLo(C), hi = pvHi(C), s = [wrapA(yaw), EL0, zoom, x, clamp((z - lo) / (hi - lo), 0, 1)];
    for (let i = 0; i < 5; i++) { orb.T[i] = orb.v[i] = s[i]; orb.dv[i] = orb.g[i] = 0; }
    orb.fly = null; orb.keys.clear(); orb.pz = lo + s[U] * (hi - lo); orb.Fs = elFloor();
  }
  const orbNearCamp = () => Math.hypot(orb.v[X] - P0[0], orb.pz - P0[2]) < 40;

  /* the hand on it: pointers, the wheel, the keys */
  const ex = { ptrs: new Map(), kind: 'turn', dragged: false, multi: false, two: null, ax: 0, ay: 0, vt: 0, vel: new Float64Array(5), wheelT: -1e9 };
  const canExplore = () => st.entered && !rd.on && !car.on && !wk.on && !st.chapter;
  const hintOff = () => { if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; } };
  if (matchMedia('(pointer: coarse)').matches) $('hint').textContent = 'Tap a glowing dot to open it. Tap the sea to send a wave. Drag to look around, two fingers to move and zoom.';
  /* a new swipe (or pinch, or burst of scrolling): straight after the last one it goes further, each time up to four
     and a half times as far; after a pause it is gentle again */
  function gestureStart() {
    const now = performance.now() / 1000, gap = now - orb.lastEnd;
    orb.boost = clamp(gap < 0.8 ? orb.boost * 1.6 : 1 + (orb.boost - 1) * Math.exp(-(gap - 0.8) / 0.5), 1, ORB.boost);
    orb.fly = null; orb.g.fill(0); ex.vel.fill(0); ex.vt = performance.now(); ex.ax = ex.ay = 0;
    hintOff();
  }
  /* let go: it glides on at the speed it was moving, and comes to rest */
  const GCAP = [3.5, 1.6, 2.5, 80, 3];
  function gestureEnd(fling) {
    orb.lastEnd = performance.now() / 1000;
    if (!fling || performance.now() - ex.vt > 90) return;
    for (let i = 0; i < 5; i++) orb.g[i] = clamp(ex.vel[i], -GCAP[i], GCAP[i]);
  }
  /* a step of a gesture, in each axis's own units: onto the targets, and into the speed a glide would keep */
  function orbNudge(dy, de, dz, dx, du) {
    const T = orb.T, q = ex.vel, now = performance.now(), dt = Math.max(0.008, (now - ex.vt) / 1000), a = 1 - Math.exp(-dt / 0.05);
    ex.vt = now;
    /* tilting down stops at the ground (or the treetops), and tilting up answers at once */
    if (de) { const lo = Math.max(ORB.elMin, orb.Fs - 0.004); T[E] = clamp(Math.max(T[E], lo) + de, lo, ORB.elMax); }
    T[Y] += dy; T[Z] = clamp(T[Z] + dz, ORB.zMin, ORB.zMax); T[X] += dx; T[U] = clamp(T[U] + du, 0, 1);
    q[Y] += (dy / dt - q[Y]) * a; q[E] += (de / dt - q[E]) * a; q[Z] += (dz / dt - q[Z]) * a; q[X] += (dx / dt - q[X]) * a; q[U] += (du / dt - q[U]) * a;
  }
  /* one finger (or the left button): across turns round the point, up and down tilts. Whatever is under the hand
     follows it. A swipe mostly one way moves only that way, so turning doesn't wobble the tilt */
  function orbTurn(dx, dy) {
    ex.ax += Math.abs(dx); ex.ay += Math.abs(dy);
    const s = ex.ax + ex.ay + 1e-6, b = orb.boost;
    orbNudge(dx * 2.3 / Math.max(320, view.w) * b * sstep(0.2, 0.45, ex.ax / s), -dy * 1.05 / Math.max(320, view.h) * b * sstep(0.2, 0.45, ex.ay / s), 0, 0, 0);
  }
  /* moving the point: the sand under the hand stays under it, along the beach and a little across */
  const PD = [0, 0];
  function panDelta(dx, dy) {
    const aspect = view.w / view.h, fov = V0.fov * (aspect < 1.2 ? Math.min(1.6, 1 + (1.2 - aspect) * 0.75) : 1);
    const s = 2 * Math.exp(orb.v[Z]) * RYZ * Math.tan(fov * Math.PI / 360) / Math.max(320, view.h) * orb.boost, sz = s / Math.max(0.3, Math.sin(orb.el));
    const cy = Math.cos(orb.v[Y]), sy = Math.sin(orb.v[Y]), C = sandAt(orb.v[X], pvC);
    PD[0] = -dx * s * cy - dy * sz * sy; PD[1] = (dx * s * sy - dy * sz * cy) / (pvHi(C) - pvLo(C));
    return PD;
  }
  function orbPanBy(dx, dy) { const d = panDelta(dx, dy); orbNudge(0, 0, 0, d[0], d[1]); }
  /* the wheel zooms (a pinch on a trackpad comes as a wheel with Ctrl held: gently); a sideways swipe on a trackpad
     moves along the beach. A burst of scrolling counts as one swipe, and brings its own momentum */
  function orbWheel(e) {
    const now = performance.now(), k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.h : 1;
    if (now - ex.wheelT > 180) gestureStart();
    ex.wheelT = now; orb.lastEnd = now / 1000;
    let dx = clamp(e.deltaX * k, -150, 150), dy = clamp(e.deltaY * k, -150, 150);
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    const d = panDelta(-dx, 0);
    orbNudge(0, 0, dy * (e.ctrlKey ? 0.006 : 0.0011) * orb.boost, dx ? d[0] : 0, dx ? d[1] : 0);
    ex.vel.fill(0);
  }
  /* two fingers: they move the point, pinch to zoom, and twist to turn once the twist is clearly meant */
  function twoState(o) {
    let i = 0, ax = 0, ay = 0, bx = 0, by = 0;
    for (const p of ex.ptrs.values()) { if (i === 0) { ax = p.x; ay = p.y; } else if (i === 1) { bx = p.x; by = p.y; } i++; }
    o.mx = (ax + bx) / 2; o.my = (ay + by) / 2; o.d = Math.max(20, Math.hypot(bx - ax, by - ay)); o.a = Math.atan2(by - ay, bx - ax); return o;
  }
  const TW = { mx: 0, my: 0, d: 1, a: 0 };
  /* (a second finger joining a drag already under way carries it on, rather than counting as a new swipe) */
  function twoStart(going) { ex.two = twoState({ mx: 0, my: 0, d: 1, a: 0, tw: 0 }); if (going) { ex.vel.fill(0); ex.vt = performance.now(); } else gestureStart(); }
  function twoMove() {
    const t = ex.two, n = twoState(TW), da = wrapA(n.a - t.a), b = orb.boost;
    t.tw += da;
    const d = panDelta(n.mx - t.mx, n.my - t.my);
    orbNudge(Math.abs(t.tw) > 0.14 ? da * 0.9 * b : 0, 0, -Math.log(n.d / t.d) * 0.7 * b, d[0], d[1]);
    t.mx = n.mx; t.my = n.my; t.d = n.d; t.a = n.a;
  }
  cv.addEventListener('contextmenu', e => { if (st.entered && !rd.on) e.preventDefault(); });
  cv.addEventListener('pointerdown', e => {
    if (!st.entered || rd.on) return;
    if (!ex.ptrs.size) { ex.dragged = ex.multi = false; ex.two = null; }
    ex.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (ex.ptrs.size === 1) ex.kind = e.pointerType === 'mouse' && (e.button > 0 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'turn';
    else { const going = ex.dragged; ex.multi = ex.dragged = true; if (ex.ptrs.size === 2 && canExplore()) twoStart(going); }
  });
  cv.addEventListener('pointermove', e => {
    const p = ex.ptrs.get(e.pointerId); if (!p) return;
    if (e.pointerType === 'mouse' && !e.buttons) { exUp(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ex.ptrs.size > 1) { if (ex.two && canExplore()) twoMove(); return; }
    if (!ex.dragged) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < (e.pointerType === 'mouse' ? 6 : 10)) return;
      ex.dragged = true;
      if (wk.on) hintOff(); else if (canExplore()) gestureStart();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    }
    if (wk.on) walkLook(dx, dy);
    else if (canExplore()) { if (ex.kind === 'pan') orbPanBy(dx, dy); else orbTurn(dx, dy); }
  });
  function exUp(e) {
    if (!ex.ptrs.delete(e.pointerId)) return;
    const live = canExplore();
    if (ex.ptrs.size === 1) {
      /* two fingers became one: the one left carries on turning from where it is, without a glide from the pinch */
      if (ex.two) { ex.two = null; if (live) gestureEnd(false); }
      for (const p of ex.ptrs.values()) { p.x0 = p.x; p.y0 = p.y; }
      ex.kind = 'turn'; ex.ax = ex.ay = 0; ex.vel.fill(0); ex.vt = performance.now();
      return;
    }
    if (ex.ptrs.size) return;
    if (wk.on) { if (ex.dragged) wk.mT = performance.now(); }
    else if (live && (ex.dragged || ex.two)) gestureEnd(e.type !== 'pointercancel');
    ex.two = null;
  }
  cv.addEventListener('pointerup', exUp); cv.addEventListener('pointercancel', exUp); addEventListener('pointerup', exUp);
  addEventListener('keydown', e => {
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    if (!canExplore() || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase(), T = orb.T, nudge = (de, dz) => { orb.fly = null; T[E] = clamp(T[E] + de, Math.max(ORB.elMin, orb.Fs), ORB.elMax); T[Z] = clamp(T[Z] + dz, ORB.zMin, ORB.zMax); };
    if (k === 'arrowleft' || k === 'q') orb.keys.add('l');
    else if (k === 'arrowright' || k === 'e') orb.keys.add('r');
    else if (k === '+' || k === '=') nudge(0, -0.22);
    else if (k === '-' || k === '_') nudge(0, 0.22);
    else if (k === 'pageup') nudge(-0.12, 0);
    else if (k === 'pagedown') nudge(0.12, 0);
    else if (k === 'home' || k === 'h') orbHome();
    else return;
    e.preventDefault(); hintOff();
  });
  addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'q') orb.keys.delete('l'); if (k === 'arrowright' || k === 'e') orb.keys.delete('r'); });
  addEventListener('blur', () => orb.keys.clear());
  /* the way home, and the way to the van wherever it was left, once they are some way off; the arrow says which side of the screen */
  $('bWalkCamp').addEventListener('click', () => { orbHome(); hintOff(); });
  $('bWalkVan').addEventListener('click', () => { orbToVan(); hintOff(); });
  const wbar = { camp: -2, van: -2, n: 0, vx: Layout.van.x, vz: Layout.van.z };
  const sideOf = (x, z) => { const dx = x - orb.v[X], dz = z - orb.pz, r = (dx * Math.cos(orb.v[Y]) - dz * Math.sin(orb.v[Y])) / (Math.hypot(dx, dz) || 1); return r < -0.35 ? 0 : r > 0.35 ? 2 : 1; };
  function syncWalkBar() {
    if (ready && !(wbar.n++ % 15)) { const P = Engine.vanPose(); wbar.vx = P.x; wbar.vz = P.z; }
    const on = canExplore() && st.camT >= 1 && !car.camK && !wk.camK && !orb.fly, px = orb.v[X], pz = orb.pz;
    const away = Math.hypot(px - P0[0], pz - P0[2]) > 4 || Math.abs(orb.v[Y]) > 0.35 || Math.abs(orb.v[Z]) > 0.4 || Math.abs(orb.el - EL0) > 0.22;
    const camp = on && away ? sideOf(P0[0], P0[2]) : -1, van = on && Math.hypot(wbar.vx - px, wbar.vz - pz) > 25 ? sideOf(wbar.vx, wbar.vz) : -1;
    const label = (s, t) => s === 0 ? '← ' + t : s === 2 ? t + ' →' : t;
    if (camp >= 0 || van >= 0) hintOff();
    if (camp !== wbar.camp) { wbar.camp = camp; $('bWalkCamp').hidden = camp < 0; if (camp >= 0) $('bWalkCamp').textContent = label(camp, 'Back to camp'); }
    if (van !== wbar.van) { wbar.van = van; $('bWalkVan').hidden = van < 0; if (van >= 0) $('bWalkVan').textContent = label(van, 'Go to the van'); }
  }

  /* ── driving the camper van ── */
  const car = { on: false, k: 0, x: 0, z: 0, h: 0, v: 0, steer: 0, spin: 0, roll: 0, pitch: 0, odo: 0, trackOdo: 0, splashT: 0, camK: 0, camP: null, camL: null, yaw: 0, lastV: 0, knocks: 0, wheels: null, bumpT: 0 };
  const keys = new Set(), touch = { x: 0, y: 0, on: false };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  /* what the van drives round: the camp's own things (only at the camp), the rocks and trunks of the coast
     (in every copy of it, kept in buckets along the stretch so only the near ones are looked at), and the trees
     that fill the clearing in every copy but the camp's */
  const obstacles = [], campObs = [], fillObs = [], OB = { bw: 8, b: [], P: 1e9, X0: 0 };
  function buildObstacles() {
    for (const [x, z] of Layout.palms.map(p => [p[0], p[1]])) campObs.push([x, z, 0.4]);
    for (const t of Layout.trees) campObs.push([t[0], t[1], 0.5]);
    for (const b of Layout.bushes) campObs.push([b[0], b[1], b[2] * 0.7]);
    for (const [x, z] of Layout.poles) campObs.push([x, z, 0.14, 'pole']);
    campObs.push([Layout.fire.x, Layout.fire.z, 0.62, 'fire']);
    const W = Engine.world; if (!W) return;
    Object.assign(OB, { P: W.P, X0: W.X0, b: Array.from({ length: Math.ceil(W.P / OB.bw) }, () => []) });
    for (const o of W.obstacles) OB.b[Math.floor((W.base(o[0]) - W.X0) / OB.bw) % OB.b.length].push(o);
    fillObs.push(...W.fillObstacles);
    obstacles.push(...campObs, ...W.obstacles);
  }
  /* the obstacles near (x, z), each as [dx, dz, radius, the obstacle] measured from it to the point */
  function obstaclesNear(x, z) {
    const out = [], W = Engine.world;
    for (const o of campObs) if (Math.abs(x - o[0]) < 6) out.push([x - o[0], z - o[1], o[2], o]);
    if (!W) return out;
    const n = OB.b.length, i = Math.floor((W.base(x) - W.X0) / OB.bw);
    for (let d = -1; d <= 1; d++) for (const o of OB.b[(i + d + n) % n]) out.push([W.wrapD(x - o[0]), z - o[1], o[2], o]);
    const k = Math.round(x / W.P);
    if (k !== 0) for (const o of fillObs) { const dx = x - (o[0] + k * W.P); if (Math.abs(dx) < 6) out.push([dx, z - o[1], o[2], o]); }
    return out;
  }
  const DRIVE_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'shift'];
  addEventListener('keydown', e => {
    if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if (DRIVE_KEYS.includes(k)) {
      if (!car.on && !wk.on && st.entered && !rd.on && ['arrowup', 'w', 'arrowdown', 's'].includes(k)) startDrive();
      if (car.on) { keys.add(k); e.preventDefault(); }
    }
    if (car.on && k === 'h' && sound.amb) sound.amb.horn();
    if (car.on && k === 'r') respawn();
    if (car.on && (k === 'e' || k === 'escape')) stopDrive();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  function startDrive() {
    if (car.on || !ready) return;
    if (wk.on) stopWalk();
    if (st.chapter) openChapter(null);
    toggleSettings(false);
    const p = Engine.vanPose(); Object.assign(car, { on: true, x: p.x, z: p.z, h: p.heading, v: 0 });
    document.body.classList.add('driving'); $('driveHud').hidden = false; $('pad').hidden = !isTouch; $('bDrive').setAttribute('aria-pressed', 'true');
    if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; }
    unlock('roadtrip_start');
  }
  /* stuck against something: put the van back on open sand nearby, pointing along the beach */
  function respawn() {
    const x0 = car.x, dir = Math.cos(car.h) >= 0 ? 1 : -1;
    for (let k = 0; k < 40; k++) {
      const x = x0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3, sz = Layout.shoreZ(x), z = sz + Math.min(3.5, (Layout.vegZ(x) - sz) * 0.4);
      const W = Engine.world; if (W && W.massif(x, z) > 0.1) continue;
      if (obstaclesNear(x, z).some(([dx, dz, rad]) => Math.hypot(dx, dz) < rad + 2.2)) continue;
      const along = Math.atan2(-Layout.shoreDZ(x), 1);
      Object.assign(car, { x, z, h: dir > 0 ? along : along + Math.PI, v: 0, stuckT: 0, wheels: null });
      return true;
    }
    return false;
  }
  function stopDrive() {
    if (!car.on) return;
    /* parked away from the camp: the explore camera comes to rest over the van, looking the way the van was looking;
       parked by the camp, it goes home */
    if (Math.hypot(car.x - Layout.camp.x, car.z - Layout.camp.z) > 30) { const H = car.h + car.yaw; orbAt(car.x, car.z, Math.atan2(-Math.cos(H), Math.sin(H)), Math.log(0.45)); }
    else orbHome();
    car.on = false; keys.clear(); touch.x = touch.y = 0;
    document.body.classList.remove('driving'); $('driveHud').hidden = true; $('pad').hidden = true; $('bDrive').setAttribute('aria-pressed', 'false');
  }
  $('bDrive').addEventListener('click', () => car.on ? stopDrive() : startDrive());
  /* a sky lantern from the camp: it fills with warm air for a moment, then rises out over the sea */
  $('bLantern').addEventListener('click', () => {
    if (!ready) return; Engine.lantern(); unlock('lantern');
    if (!st.lanternTold) { st.lanternTold = true; toast('A lantern rises from the camp and drifts out over the sea.', false, 3200); }
  });
  $('bPark').addEventListener('click', stopDrive);
  /* touch pad: up/down = throttle, left/right = steer */
  { const pad = $('pad'), knob = $('padKnob');
    const move = e => { const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      touch.x = dx; touch.y = dy; knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`; };
    pad.addEventListener('pointerdown', e => { touch.on = true; pad.setPointerCapture(e.pointerId); move(e); });
    pad.addEventListener('pointermove', e => { if (touch.on) move(e); });
    const end = () => { touch.on = false; touch.x = touch.y = 0; knob.style.transform = ''; };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); }
  const WB = 2.53, WR = 0.333, WHEELS = [[1.28, 0.73], [1.28, -0.73], [-1.25, 0.73], [-1.25, -0.73]];
  function wheelWorld(x, z, h) { const c = Math.cos(h), s = Math.sin(h); return WHEELS.map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]); }
  /* the body on its springs: heave, pitch and roll each a damped spring, pushed by braking and accelerating,
     by turning, by the sand, and by stones under a wheel */
  const body = { y: 0, vy: 0, p: 0, vp: 0, r: 0, vr: 0 };
  function jolt(rx, rz, rad) {
    const c = Math.cos(car.h), sn = Math.sin(car.h), lx = (rx - car.x) * c - (rz - car.z) * sn, lz = (rx - car.x) * sn + (rz - car.z) * c;
    const k = Math.min(1, Math.abs(car.v) / 4) * (0.5 + rad);
    body.vy += 0.55 * k; body.vp += (lx > 0 ? -1 : 1) * 0.32 * k; body.vr += (lz > 0 ? 1 : -1) * 0.38 * k;
    if (sound.amb && k > 0.25) sound.amb.thud(Math.min(0.5, k * 0.4));
  }
  function stepBody(dt, acc) {
    const sp = Math.abs(car.v), turn = car.v * car.v * Math.tan(car.steer) / WB;
    const tp = Math.max(-0.06, Math.min(0.06, -acc * 0.007)), tr = Math.max(-0.08, Math.min(0.08, turn * 0.012));
    /* sand is never quite flat: small heaves that grow with speed */
    const rip = sp > 0.5 ? (Math.sin(car.odo * 2.3) * 0.6 + Math.sin(car.odo * 5.1 + 1.3) * 0.4) * Math.min(1, sp / 8) : 0;
    const n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
    for (let i = 0; i < n; i++) {
      body.vy += (-70 * (body.y - 0.006 * rip) - 9 * body.vy) * h; body.y += body.vy * h;
      body.vp += (-60 * (body.p - tp) - 8 * body.vp) * h; body.p += body.vp * h;
      body.vr += (-55 * (body.r - tr) - 7.5 * body.vr) * h; body.r += body.vr * h;
    }
    car.pitch = body.p; car.roll = body.r;
  }
  function stepCar(dt) {
    const k = keys, has = (...a) => a.some(x => k.has(x));
    const thr = (has('w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0) + (touch.on ? -touch.y : 0);
    const str = (has('a', 'arrowleft') ? 1 : 0) - (has('d', 'arrowright') ? 1 : 0) + (touch.on ? -touch.x : 0);
    const boost = has('shift') ? 1.6 : 1, brake = has(' ');
    const sea = Layout.shoreZ(car.x) - car.z, inWater = sea > -0.4;
    if (brake) car.v -= Math.sign(car.v) * Math.min(Math.abs(car.v), 16 * dt);
    else if (Math.abs(thr) > 0.1) { if (Math.sign(thr) !== Math.sign(car.v) && Math.abs(car.v) > 0.4) car.v += thr * 12 * dt; else car.v += thr * (thr > 0 ? 4.4 * boost : 3) * dt; }
    else car.v -= Math.sign(car.v) * Math.min(Math.abs(car.v), 2.4 * dt);
    if (inWater) car.v *= Math.pow(0.35, dt * Math.min(1, sea + 0.6));
    car.v = Math.max(-4, Math.min(9.5 * boost, car.v));
    const steerT = Math.max(-1, Math.min(1, str)) * 0.55 / (1 + Math.abs(car.v) * 0.07);
    car.steer += (steerT - car.steer) * Math.min(1, dt * 5);
    const ox = car.x, oz = car.z;
    car.h += car.v / WB * Math.tan(car.steer) * dt;
    const fx = Math.cos(car.h), fz = -Math.sin(car.h);
    car.x += fx * car.v * dt; car.z += fz * car.v * dt;
    /* the van's footprint as three circles along its length; anything it touches pushes it out sideways,
       so it slides along rocks and trees instead of sticking, and can always back away */
    let hit = null, impact = 0;
    for (let it = 0; it < 3; it++) {
      const circ = [-1.45, 0, 1.45].map(l => [car.x + Math.cos(car.h) * l, car.z - Math.sin(car.h) * l]);
      let moved = false;
      for (const [cx, cz] of circ) for (const [dx, dz, rad, o] of obstaclesNear(cx, cz)) {
        if (Math.abs(dz) > 6) continue;
        const d = Math.hypot(dx, dz), min = 0.95 + rad;
        /* small stones: the van rolls over them with a jolt instead of stopping dead */
        if (o[3] === 'rock' && rad < 0.55) { if (it === 0 && d < 0.75 + rad * 0.4 && car.bumpO !== o) { car.bumpO = o; car.bumpAt = [car.x, car.z]; jolt(cx - dx, cz - dz, rad); } continue; }
        if (d < min) { const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, push = min - d + 0.002; car.x += nx * push; car.z += nz * push; moved = true;
          const into = -(fx * nx + fz * nz) * car.v; if (into > impact) { impact = into; hit = o; } }
      }
      /* the beach's edges: deep water, the forest (the coast itself runs on for ever) */
      const zMin = Layout.shoreZ(car.x) - 2.6, zMax = Layout.vegZ(car.x) + 1.4;
      if (car.z < zMin) { car.z = zMin; moved = true; } if (car.z > zMax) { car.z = zMax; moved = true; hit = hit || ['edge']; }
      /* the headlands: the van can't climb the rock; wherever it touches, it slides back down onto the sand */
      const W = Engine.world;
      if (W) for (const l of [-1.45, 0, 1.45]) {
        const cx = car.x + Math.cos(car.h) * l, cz = car.z - Math.sin(car.h) * l, m = W.massif(cx, cz);
        if (m > 0.3) {
          const e = 0.6, gx = W.massif(cx + e, cz) - W.massif(cx - e, cz), gz = W.massif(cx, cz + e) - W.massif(cx, cz - e), gl = Math.hypot(gx, gz) || 1;
          const push = Math.min(1.2, (m - 0.3) * 0.5 + 0.06); car.x -= gx / gl * push; car.z -= gz / gl * push; moved = true;
          const into = (fx * gx + fz * gz) / gl * car.v; if (into > impact) { impact = into; hit = ['rock']; }
        }
      }
      if (!moved) break;
    }
    if (inWater && Math.abs(car.v) > 2) unlock('shallows');
    /* round the first point, and on into the distance */
    if (Math.abs(car.x) > 150) unlock('headland');
    if (Math.abs(car.x) > 1000) unlock('far');
    if (hit) {
      /* lose the speed that went into the obstacle, keep the rest: a scrape, not a trap */
      car.v *= impact > 2.5 ? 0.35 : 0.75;
      if (impact > 1.2 && performance.now() - car.bumpT > 300) { car.bumpT = performance.now(); car.shake = Math.max(car.shake || 0, Math.min(0.35, impact * 0.05)); if (sound.amb) sound.amb.thud(Math.min(1, impact / 6)); }
      if (hit[3] === 'pole' && impact > 1.0) { Engine.knock(hit[0], hit[1], 0.3, fx * impact, fz * impact, st.t); unlock('lights_out'); }
      if (hit[3] === 'fire' && impact > 3.5) { Engine.knock(hit[0], hit[1], 0.4, fx * impact, fz * impact, st.t); unlock('fire_out'); }
    }
    { const circ = [-1.45, 0, 1.45].map(l => [car.x + Math.cos(car.h) * l, car.z - Math.sin(car.h) * l]);
      for (const [cx, cz] of circ) { const hits = Engine.knock(cx, cz, 0.95, fx * car.v, fz * car.v, st.t); if (hits.length) { car.knocks += hits.length; if (sound.amb) sound.amb.thud(0.6); if (car.knocks >= 5) unlock('dont_break'); } }
    }
    const dist = Math.hypot(car.x - ox, car.z - oz); car.odo += dist; car.spin += car.v * dt / WR;
    /* pushing hard and going nowhere for a few seconds: offer the way out */
    if (Math.abs(thr) > 0.5 && dist < 0.12 * dt) { car.stuckT = (car.stuckT || 0) + dt; if (car.stuckT > 3 && !car.stuckTold) { car.stuckTold = true; toast('Stuck? Press R to put the van back on open sand.', false, 4200); } } else car.stuckT = 0;
    if (car.odo > 120) unlock('roadtrip');
    /* tyre tracks every 12 cm */
    car.trackOdo += dist;
    const wNow = wheelWorld(car.x, car.z, car.h);
    if (!car.wheels) car.wheels = wNow;
    if (car.trackOdo > 0.12) { Engine.trackStamp(wNow.map((w, i) => [car.wheels[i][0], car.wheels[i][1], w[0], w[1], 0.19, inWater ? 0.15 : 0.55])); car.wheels = wNow; car.trackOdo = 0; }
    /* water splashes */
    if (inWater && Math.abs(car.v) > 1.2 && performance.now() - car.splashT > 260) {
      car.splashT = performance.now(); const ss = Engine.surgeState();
      wNow.slice(0, 2).forEach(([x, z]) => { ss.ripples.push({ x, z, t0: st.t, A: Math.min(1.2, 0.3 + Math.abs(car.v) * 0.12) }); if (ss.ripples.length > 6) ss.ripples.shift(); });
    }
    /* body: pitch with acceleration, roll in turns, a little sand bounce */
    const acc = (car.v - car.lastV) / Math.max(dt, 1e-3); car.lastV = car.v;
    stepBody(dt, acc);
    if (car.bumpAt && Math.hypot(car.x - car.bumpAt[0], car.z - car.bumpAt[1]) > 2.5) { car.bumpO = null; car.bumpAt = null; }
    return { thr: Math.max(0, Math.abs(thr)), brake, inWater };
  }
  function chaseCam(dt) {
    const fx = Math.cos(car.h + car.yaw), fz = -Math.sin(car.h + car.yaw);
    /* further back and a little higher the faster it goes; a knock shakes the camera for a moment */
    const sp = Math.abs(car.v), pull = 7.8 + 3.2 * Math.min(1, Math.max(0, (sp - 3) / 11)) ** 2, hgt = 3.3 + 0.5 * Math.min(1, sp / 14);
    car.shake = (car.shake || 0) * Math.exp(-dt * 7); const sk = car.shake, tn = performance.now() / 1000;
    const tp = [car.x - fx * pull + sk * Math.sin(tn * 47), hgt + sk * 0.7 * Math.sin(tn * 59 + 1), car.z - fz * pull + sk * Math.sin(tn * 53 + 2)], tl = [car.x + fx * 3.5, 0.7, car.z + fz * 3.5];
    if (!car.camP) { car.camP = tp.slice(); car.camL = tl.slice(); }
    const a = 1 - Math.exp(-dt * 3.2), b = 1 - Math.exp(-dt * 5);
    for (let i = 0; i < 3; i++) { car.camP[i] += (tp[i] - car.camP[i]) * a; car.camL[i] += (tl[i] - car.camL[i]) * b; }
    /* never let the lagging camera fall inside the van, or into a rock */
    const dx = car.camP[0] - car.x, dz = car.camP[2] - car.z, dd = Math.hypot(dx, dz);
    if (dd < 6.2) { car.camP[0] = car.x + dx / Math.max(dd, 1e-3) * 6.2; car.camP[2] = car.z + dz / Math.max(dd, 1e-3) * 6.2; }
    if (Engine.world) { const g = Engine.world.land(car.camP[0], car.camP[2]) + 1.6; if (car.camP[1] < g) car.camP[1] = g; }
    return { pos: car.camP.slice(), look: car.camL.slice(), fov: 54 + Math.min(8, Math.abs(car.v) * 0.7), focus: 7.4 };
  }

  /* ── walking the beach: a person on the sand, at eye height. W A S D or the arrows walk and turn, a drag looks round,
     Shift jogs, and each step presses a footprint into the sand (the sea smooths them away). On Auto the walker
     strolls the beach alone, round the rocks and along the sand at the foot of the headlands, turning back now and
     then, the gaze drifting out to the moon over the sea, along the beach ahead, back to the lights of the camp ── */
  const PACE = { stroll: 0.9, walk: 1.4, jog: 2.8 }, EYE = 1.65, WALK_R = 0.35;
  const wk = { on: false, x: 0, z: 0, h: 0, hT: 0, turn: 0, v: 0, pitchT: -0.05, phase: 0, foot: 1, camK: 0, odo: 0, prints: 0,
               auto: false, pace: PACE[store.get('walkPace', 'walk')] ? store.get('walkPace', 'walk') : 'walk',
               hy: { v: 0, d: 0 }, hp: { v: -0.05, d: 0 },      /* the head: its turn from the body, and its tilt, easing */
               my: 0, mp: 0, mT: -1e9,                         /* a look taken by hand while on Auto, and when it was let go */
               van: [], cam: { pos: [0, EYE, 0], look: [0, EYE, -1], fov: 60, focus: 20 } };
  /* a critically damped step toward a target: smooth, never past it, the same at any frame rate */
  function damp(s, T, w, dt) { const e = s.v - T, k = Math.exp(-w * dt), t1 = (s.d + w * e) * dt; s.v = T + (e + t1) * k; s.d = (s.d - w * t1) * k; }
  /* what is near the walker, gathered into flat arrays once a frame: the coast's rocks and trunks, the camp's things,
     and, for a person if not for the van, the van itself, the table, the chairs, the basket and the lanterns */
  const GO = { n: 0, x: new Float64Array(192), z: new Float64Array(192), r: new Float64Array(192) }, gq = [0, 0, 0];
  const CAMP_EXTRA = [[Layout.table.x, Layout.table.z, 0.85], [Layout.table.x + 1.4, Layout.table.z - 1.05, 0.32]].concat(Layout.chairs.map(c => [c.x, c.z, 0.42]), Layout.lanterns.map(l => [l[0], l[1], 0.2]));
  function goAdd(ox, oz, r) { if (GO.n < 192 && Math.abs(ox - gq[0]) < gq[2] + r && Math.abs(oz - gq[1]) < gq[2] + r) { GO.x[GO.n] = ox; GO.z[GO.n] = oz; GO.r[GO.n] = r; GO.n++; } }
  function gather(x, z, R) {
    GO.n = 0; gq[0] = x; gq[1] = z; gq[2] = R;
    for (let i = 0; i < campObs.length; i++) { const o = campObs[i]; goAdd(o[0], o[1], o[2]); }
    const W = Engine.world;
    if (W && OB.b.length) {
      const n = OB.b.length, b0 = Math.floor((W.base(x) - W.X0) / OB.bw);
      for (let d = -1; d <= 1; d++) { const B = OB.b[(b0 + d + n) % n]; for (let i = 0; i < B.length; i++) goAdd(x - W.wrapD(x - B[i][0]), B[i][1], B[i][2]); }
      const k = Math.round(x / W.P);
      if (k !== 0) for (let i = 0; i < fillObs.length; i++) goAdd(fillObs[i][0] + k * W.P, fillObs[i][1], fillObs[i][2]);
    }
    for (let i = 0; i < wk.van.length; i += 3) goAdd(wk.van[i], wk.van[i + 1], wk.van[i + 2]);
    if (Math.abs(x - Layout.camp.x) < 30) for (let i = 0; i < CAMP_EXTRA.length; i++) goAdd(CAMP_EXTRA[i][0], CAMP_EXTRA[i][1], CAMP_EXTRA[i][2]);
  }
  /* bumping into things: pushed out round them (so a walk slides along a rock instead of sticking), kept out of the
     sea past the shallows and out of the forest, and off the headlands' rock, back down onto the sand */
  function walkCollide() {
    const W = Engine.world;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (let j = 0; j < GO.n; j++) {
        const dx = wk.x - GO.x[j], dz = wk.z - GO.z[j], m = GO.r[j] + WALK_R, q = dx * dx + dz * dz;
        if (q < m * m) { const d = Math.sqrt(q), nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0; wk.x += nx * (m - d + 1e-3); wk.z += nz * (m - d + 1e-3); moved = true; }
      }
      const zMin = Layout.shoreZ(wk.x) - 1.2, zMax = Layout.vegZ(wk.x) + 2;
      if (wk.z < zMin) { wk.z = zMin; moved = true; } else if (wk.z > zMax) { wk.z = zMax; moved = true; }
      if (W) {
        const m = W.massif(wk.x, wk.z);
        if (m > 0.6) {
          const e = 0.4, gx = W.massif(wk.x + e, wk.z) - W.massif(wk.x - e, wk.z), gz = W.massif(wk.x, wk.z + e) - W.massif(wk.x, wk.z - e), gl = Math.hypot(gx, gz) || 1;
          const push = Math.min(0.6, (m - 0.6) / Math.max(0.2, gl / (2 * e)) + 0.005); wk.x -= gx / gl * push; wk.z -= gz / gl * push; moved = true;
        }
      }
      if (!moved) break;
    }
  }
  /* the head's tilt and turn come from the hand, or (on Auto) from the gaze; a drag turns the whole body when
     walking by hand, and only the head on Auto, which turns back to its own gaze a few seconds after letting go */
  function walkLook(dx, dy) {
    const gy = dx * 2.2 / Math.max(320, view.w), gp = dy * 1.4 / Math.max(320, view.h);
    if (wk.auto) { wk.my += gy; wk.mp = clamp(wk.mp + gp, -1.0, 0.9); wk.mT = performance.now(); }
    else { wk.hT += gy; wk.pitchT = clamp(wk.pitchT + gp, -1.0, 0.9); }
  }
  /* ── on Auto ── */
  const ai = { dir: 1, ph1: 0, ph2: 0, nextTurn: 0, nextPause: 0, turnSign: 0, progX: 0, progT: 0, pause: 0, side: 0, gaze: 'ahead', gazeT: 0, gside: 1, gy: 0, gp: 0 };
  const CAND = [0, 0.3, -0.3, 0.62, -0.62, 0.95, -0.95, 1.35, -1.35, 1.8, -1.8], wbC = { x: NaN };
  /* the cost of heading hh: anything in the way over the next few metres, the sea, the trees, the rock */
  function probe(hh) {
    const fx = -Math.sin(hh), fz = -Math.cos(hh), W = Engine.world; let c = 0;
    for (let i = 1; i <= 3; i++) {
      const d = i * 0.9, px = wk.x + fx * d, pz = wk.z + fz * d, w = 1 / (1 + 0.4 * (i - 1));
      for (let j = 0; j < GO.n; j++) { const ox = px - GO.x[j], oz = pz - GO.z[j], m = GO.r[j] + 0.6, q = ox * ox + oz * oz; if (q < m * m) c += (m - Math.sqrt(q)) * 3 * w; }
      const sz = Layout.shoreZ(px), vz = Layout.vegZ(px);
      if (pz < sz + 0.15) c += (sz + 0.15 - pz) * 2 * w;
      if (pz > vz - 0.1) c += (pz - vz + 0.1) * 2 * w;
      if (W) { const m = W.massif(px, pz); if (m > 0.25) c += (m - 0.25) * 3 * w; }
    }
    return c;
  }
  /* turning back goes round by the sea side, facing the water on the way */
  function turnBack() { ai.dir = -ai.dir; ai.turnSign = ai.dir < 0 ? 1 : -1; ai.progT = 0; ai.progX = wk.x; }
  /* the next thing to look at, for a while: the way ahead, the moon over the sea, along the beach, the camp's lights, the sky */
  function pickGaze(kind) {
    const r = Math.random(), S = st.S, camp = Math.abs(wk.x - Layout.camp.x) < 140 && st.L.string > 0.3;
    ai.gaze = kind || (r < 0.34 ? 'ahead' : r < 0.64 ? 'sea' : r < 0.8 ? 'beach' : r < 0.92 && camp ? 'camp' : S && S.night > 0.5 ? 'sky' : 'sea');
    ai.gazeT = 6 + Math.random() * 8; ai.gside = Math.random() < 0.5 ? -1 : 1;
  }
  /* where that is, as a turn in the world and a tilt */
  function gazeAt(t) {
    const S = st.S, k = ai.gaze;
    if (k === 'sea' || k === 'sky') {
      const d = S && S.mAlt > -1 ? S.moonDirV : S && S.sAlt > 0 ? S.sunDirV : null;
      if (d) { ai.gy = Math.atan2(-d[0], -d[2]); ai.gp = Math.atan2(d[1], Math.hypot(d[0], d[2])) * 0.7 + 0.01; }
      else { ai.gy = Math.atan2(-Layout.shoreDZ(wk.x), 1); ai.gp = 0.02; }
      if (k === 'sky') { ai.gy += 0.45 * ai.gside; ai.gp = 0.36; }
    } else if (k === 'beach') { ai.gy = (ai.dir > 0 ? -Math.PI / 2 : Math.PI / 2) + 0.38 * ai.gside; ai.gp = -0.03; }
    else if (k === 'camp') { ai.gy = Math.atan2(-(Layout.camp.x - wk.x), -(Layout.camp.z - wk.z)); ai.gp = 0.02; }
    else { ai.gy = wk.h; ai.gp = -0.06; }
    /* and never quite still */
    ai.gy += 0.05 * Math.sin(t * 0.21); ai.gp += 0.02 * Math.sin(t * 0.17 + 1.3);
  }
  function autoSteer(dt) {
    const sp = PACE[wk.pace];
    /* now and then: turn back (a long way from the camp, always toward it), or stop a while and look */
    if (wk.odo > ai.nextTurn) {
      ai.nextTurn = wk.odo + 150 + Math.random() * 260;
      if (Math.abs(wk.x - Layout.camp.x) > 260 ? Math.sign(Layout.camp.x - wk.x) !== ai.dir : Math.random() < 0.5) turnBack();
    }
    if (wk.odo > ai.nextPause && !ai.turnSign) { ai.nextPause = wk.odo + 80 + Math.random() * 120; ai.pause = 6 + Math.random() * 5; pickGaze(Math.random() < 0.7 ? 'sea' : 'camp'); ai.gazeT = ai.pause + 1; }
    /* stuck, somewhere the rocks leave no way round: turn back (not while stopped, or already turning) */
    if (ai.pause > 0 || ai.turnSign) { if (ai.pause > 0) ai.pause -= dt; ai.progT = 0; ai.progX = wk.x; }
    else if ((ai.progT += dt) > 4) { if ((wk.x - ai.progX) * ai.dir < 0.15 * sp * ai.progT) turnBack(); ai.progT = 0; ai.progX = wk.x; }
    /* the way ahead: a point a few metres on, its line across the sand wandering slowly from the waterline to the trees */
    const L = 3 + 1.6 * sp, xa = wk.x + ai.dir * L, C = sandAt(xa, wbC), lo = C.sz + 0.5, hi = Math.max(lo + 0.8, Math.min(C.vz - 0.4, C.foot - 1.2)), s = wk.odo + L;
    const u = clamp(0.45 + 0.24 * Math.sin(s * 0.019 + ai.ph1) + 0.13 * Math.sin(s * 0.053 + ai.ph2) + 0.06 * Math.sin(s * 0.11), 0.06, 0.94);
    let hd = Math.atan2(-(xa - wk.x), -(lo + u * (hi - lo) - wk.z));
    if (ai.turnSign) { let er = wrapA(hd - wk.h); if (Math.abs(er) < 0.9) ai.turnSign = 0; else { if (Math.sign(er) !== ai.turnSign) er += ai.turnSign * TAU; hd = wk.h + ai.turnSign * Math.min(Math.abs(er), 1.1); } }
    /* stopped to look: the body turns to face it */
    if (ai.pause > 0) hd = ai.gy;
    /* round whatever is in the way: headings either side are tried, and the cheapest taken (keeping to one side) */
    let best = 0, bc = Infinity;
    for (let i = 0; i < CAND.length; i++) { const o = CAND[i], c = Math.abs(o) * 0.8 + (ai.side && o && Math.sign(o) !== ai.side ? 0.3 : 0) + (ai.pause > 0 ? 0 : probe(hd + o)); if (c < bc) { bc = c; best = o; } }
    ai.side = Math.sign(best);
    /* the turn eases in and out, no quicker than a person turns while walking */
    const err = wrapA(hd + best - wk.hT), R = 0.55 + 0.15 * sp;
    wk.turn += (clamp(err * 1.4, -R, R) - wk.turn) * (1 - Math.exp(-dt / 0.35));
    wk.hT += wk.turn * dt;
    return ai.pause > 0 ? 0 : 0.55 + 0.45 * Math.max(0, Math.cos(wrapA(hd + best - wk.h)));
  }
  function setAuto(on) {
    if (on === wk.auto) return;
    wk.auto = on; $('bWalkAuto').setAttribute('aria-pressed', String(on));
    if (on) {
      Object.assign(ai, { dir: -Math.sin(wk.h) >= 0 ? 1 : -1, ph1: Math.random() * TAU, ph2: Math.random() * TAU, nextTurn: wk.odo + 150 + Math.random() * 250, nextPause: wk.odo + 40 + Math.random() * 60, turnSign: 0, progX: wk.x, progT: 0, pause: 0, side: 0, gazeT: 0 });
      wk.turn = 0;
    } else {
      /* taking over by hand: the body turns to where the head was looking, so the view doesn't move */
      wk.h = wk.hT = wk.h + wk.hy.v + wk.my; wk.hy.v = wk.hy.d = 0; wk.my = 0;
      wk.hp.v = clamp(wk.hp.v + wk.mp, -1.0, 0.9); wk.pitchT = wk.hp.v; wk.mp = 0; wk.turn = 0;
    }
  }
  function stepWalk(dt) {
    const k = keys, t = st.t;
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) + (touch.on ? -touch.y : 0);
    const trn = (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0) + (touch.on ? -touch.x : 0);
    /* a hand on the keys (or the pad) takes over from Auto */
    if (wk.auto && (Math.abs(fwd) > 0.2 || Math.abs(trn) > 0.2)) setAuto(false);
    const base = k.has('shift') ? PACE.jog : PACE[wk.pace];
    gather(wk.x, wk.z, 6);
    let want;
    if (wk.auto) want = base * autoSteer(dt);
    else {
      want = base * clamp(fwd, -0.6, 1);
      wk.turn += (clamp(trn, -1, 1) * 1.5 - wk.turn) * (1 - Math.exp(-dt / 0.16));
      wk.hT += wk.turn * dt;
    }
    /* the pace eases up and down as a body's does; wading slows it */
    const sz = Layout.shoreZ(wk.x), wade = sstep(sz + 0.2, sz - 1.0, wk.z);
    want *= 1 - 0.45 * wade;
    wk.v += (want - wk.v) * (1 - Math.exp(-dt / (Math.abs(want) > Math.abs(wk.v) ? 0.5 : 0.35)));
    wk.h += wrapA(wk.hT - wk.h) * (1 - Math.exp(-dt * (wk.auto ? 5 : 16)));
    const ox = wk.x, oz = wk.z;
    wk.x -= Math.sin(wk.h) * wk.v * dt; wk.z -= Math.cos(wk.h) * wk.v * dt;
    walkCollide();
    const dist = Math.hypot(wk.x - ox, wk.z - oz), ph0 = wk.phase;
    wk.odo += dist;
    /* a step every stride's half, left and right in turn */
    wk.phase += Math.PI * dist / (0.55 + 0.21 * Math.abs(wk.v));
    if (Math.floor(wk.phase / Math.PI) !== Math.floor(ph0 / Math.PI)) footstep(wade);
    if (Engine.trackFollow) Engine.trackFollow(wk.x);
    /* the head: on Auto it drifts from one view to the next, slowly; a look taken by hand is kept a few seconds, then let go */
    if (wk.auto) {
      if ((ai.gazeT -= dt) <= 0) pickGaze();
      gazeAt(t);
      if (performance.now() - wk.mT > 3500 && !(ex.dragged && ex.ptrs.size)) { const d = 1 - Math.exp(-dt / 1.1); wk.my -= wk.my * d; wk.mp -= wk.mp * d; }
      damp(wk.hy, clamp(wrapA(ai.gy - wk.h), -1.6, 1.6), 1.5, dt); damp(wk.hp, ai.gp, 1.5, dt);
    } else { damp(wk.hy, 0, 4, dt); damp(wk.hp, wk.pitchT, 16, dt); }
    walkCamera();
  }
  /* the eye: at head height, bobbing a little with each step and swaying from foot to foot, more as the pace quickens
     (and not at all for those who would rather things kept still) */
  function walkCamera() {
    const v = Math.abs(wk.v), bob = reduced ? 0 : 0.012 * v + 0.0035 * v * v, ph = wk.phase, W = Engine.world;
    const yaw = wk.h + wk.hy.v + wk.my + (reduced ? 0 : 0.006 * Math.min(1, v / 1.4) * Math.sin(ph)), pitch = clamp(wk.hp.v + wk.mp, -1.05, 0.95), cp = Math.cos(pitch);
    const sway = 0.6 * bob * Math.sin(ph), g = Math.max(0, W ? W.land(wk.x, wk.z) : 0), p = wk.cam.pos, l = wk.cam.look;
    p[0] = wk.x + Math.cos(wk.h) * sway; p[1] = g + EYE - bob * (0.5 + 0.5 * Math.cos(2 * ph)); p[2] = wk.z - Math.sin(wk.h) * sway;
    l[0] = p[0] - Math.sin(yaw) * cp * 12; l[1] = p[1] + Math.sin(pitch) * 12; l[2] = p[2] - Math.cos(yaw) * cp * 12;
    wk.cam.fov = 60 + 4 * sstep(1.6, 2.8, v);
  }
  /* a footprint, heel and ball, a little to the side of the line walked; fainter on wet sand, none in the water (a ripple
     instead); and with sound on, a soft crunch */
  function footstep(wade) {
    wk.foot = -wk.foot;
    const fx = -Math.sin(wk.h), fz = -Math.cos(wk.h), s = wk.foot * 0.1, x = wk.x + Math.cos(wk.h) * s + fx * 0.12, z = wk.z - Math.sin(wk.h) * s + fz * 0.12;
    if (wade < 0.35) {
      const a = 0.45 * (1 - wade * 2.2);
      Engine.trackStamp([[x - fx * 0.075, z - fz * 0.075, x - fx * 0.07, z - fz * 0.07, 0.085, a], [x, z, x + fx * 0.075, z + fz * 0.075, 0.1, a]]);
      wk.prints++;
    } else if (wade > 0.6 && wk.foot > 0) { const ss = Engine.surgeState(); ss.ripples.push({ x, z, t0: st.t, A: 0.22 }); if (ss.ripples.length > 6) ss.ripples.shift(); }
    if (sound.on && sound.amb && sound.amb.step) sound.amb.step(Math.min(1.4, 0.55 + Math.abs(wk.v) * 0.3), wade);
  }
  function startWalk() {
    if (wk.on || !ready) return;
    const fromVan = car.on;
    if (car.on) stopDrive();
    if (st.chapter) openChapter(null);
    toggleSettings(false);
    /* the van, for a person to walk round */
    const P = Engine.vanPose(), vc = Math.cos(P.heading), vs = Math.sin(P.heading); wk.van.length = 0;
    for (const l of [-1.45, 0, 1.45]) wk.van.push(P.x + vc * l, P.z - vs * l, 0.95);
    /* where to stand: out of the van, beside it, if it was being driven (or the view is on it); at the camp, just
       behind the picnic, looking out to sea; otherwise on the point the view turns round, facing the way it faces */
    let x = orb.v[X], z = orb.pz, h = orb.v[Y];
    if (!fromVan && Math.hypot(x - Layout.camp.x, z - Layout.camp.z) < 5) { x = Layout.camp.x; z = Layout.camp.z + 3; h = 0; }
    else if (fromVan || Math.hypot(x - P.x, z - P.z) < 4) {
      const ok = sd => { const qx = P.x + vs * sd * 1.9, qz = P.z + vc * sd * 1.9; return qz > Layout.shoreZ(qx) - 0.5 && qz < Layout.vegZ(qx) + 1 && !(Engine.world && Engine.world.massif(qx, qz) > 0.4); };
      const sd = ok(1) ? 1 : -1; x = P.x + vs * sd * 1.9; z = P.z + vc * sd * 1.9; h = Math.atan2(-vc, vs);
    }
    Object.assign(wk, { on: true, x, z, h, hT: h, turn: 0, v: 0, my: 0, mp: 0, pitchT: -0.05 });
    wk.hy.v = wk.hy.d = wk.hp.d = 0; wk.hp.v = -0.05;
    gather(x, z, 6); walkCollide(); walkCamera();
    keys.clear(); orb.keys.clear(); touch.x = touch.y = 0;
    if (wk.auto) { wk.auto = false; setAuto(true); }
    document.body.classList.add('walking'); $('walkHud').hidden = false; $('pad').hidden = !isTouch; $('bWalk').setAttribute('aria-pressed', 'true');
    hintOff();
  }
  function stopWalk() {
    if (!wk.on) return;
    wk.on = false; keys.clear(); touch.x = touch.y = 0;
    /* the explore camera takes up where you stand, looking the way you were looking */
    orbAt(wk.x, wk.z, wk.h + wk.hy.v + wk.my, Math.log(0.45));
    document.body.classList.remove('walking'); $('walkHud').hidden = true; $('pad').hidden = true; $('bWalk').setAttribute('aria-pressed', 'false');
  }
  $('bWalk').addEventListener('click', () => wk.on ? stopWalk() : startWalk());
  $('bWalkExit').addEventListener('click', stopWalk);
  $('bWalkAuto').addEventListener('click', () => setAuto(!wk.auto));
  document.querySelectorAll('[data-pace]').forEach(b => b.addEventListener('click', () => { wk.pace = b.dataset.pace; store.set('walkPace', wk.pace); seg('pace', wk.pace); }));
  seg('pace', wk.pace);
  const WALK_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'];
  addEventListener('keydown', e => {
    if (!wk.on || (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    const k = e.key.toLowerCase();
    if (k === 'e' || k === 'escape') { stopWalk(); e.preventDefault(); return; }
    if (WALK_KEYS.includes(k)) { keys.add(k); e.preventDefault(); }
  });
  /* ── finds: small things to discover, kept in this browser ── */
  const FINDS = [
    ['roadtrip_start', 'Keys in the ignition', 'took the van out'], ['roadtrip', 'Down the beach', 'drove 120 metres of sand'],
    ['headland', 'Round the point', 'drove past the rocks at the end of the bay'], ['far', 'Over the horizon', 'drove a kilometre down the coast'], ['shallows', 'Wet wheels', 'drove through the shallows'],
    ['big_wave', 'Make a wave', 'stacked clicks into one big swell'], ['tide', 'The tide took the camp', 'sent a wave all the way to the fire'],
    ['lights_out', 'Lights out', 'knocked over a light pole'], ['fire_out', 'Too close to the fire', 'drove into the campfire'],
    ['dont_break', 'Bull in a china shop', 'knocked five things over'], ['reader', 'Read the room', 'opened every chapter'],
    ['lantern', 'Make a wish', 'let a sky lantern go'], ['storm', 'Weathered it', 'called up a thunderstorm'], ['night', 'Night owl', 'stayed three minutes under the stars']];
  const found = new Set(store.get('finds', [])), findQ = [], readSeen = new Set();
  function renderFinds() {
    $('fCount').textContent = `${found.size} of ${FINDS.length}`;
    $('finds').innerHTML = FINDS.map(([id, t, d]) => found.has(id) ? `<li class="got"><b>${esc(t)}</b> · ${esc(d)}</li>` : `<li><b>${esc(t)}</b></li>`).join('');
  }
  function showFinds() {
    if (!findQ.length || !$('toast').hidden) { if (findQ.length) setTimeout(showFinds, 900); return; }
    const f = findQ.shift(); toast(`Found: ${f[1]} · ${f[2]}`, false, 3600); if (findQ.length) setTimeout(showFinds, 4200);
  }
  const unlock = id => {
    if (found.has(id)) return; const f = FINDS.find(x => x[0] === id); if (!f) return;
    found.add(id); store.set('finds', [...found]); renderFinds(); findQ.push(f); setTimeout(showFinds, 300);
  };

  /* ── engine ── */
  /* the canvas fills the window; its drawing buffer follows its on-screen size */
  const view = { w: innerWidth, h: innerHeight, x: 0, y: 0 };
  function size() {
    const r = cv.getBoundingClientRect(), w = r.width || innerWidth, h = r.height || innerHeight;
    Object.assign(view, { w, h, x: r.left, y: r.top });
    const dpr = Math.min(devicePixelRatio || 1, w < 720 ? 1.5 : 1.6);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
  }
  size(); addEventListener('resize', size);
  if (window.ResizeObserver) new ResizeObserver(size).observe(cv);
  let ready = false;
  setTimeout(() => {
    try { Engine.init(cv, { shadowSize: window.__coveShadow || 2048, decalPPM: 40 }); ready = true; buildObstacles(); van0 = Engine.vanPose(); }
    catch (e) { $('introNote').textContent = 'This device could not start WebGL 2, which the cove needs.'; console.error(e); return; }
    /* print the menu card with the résumé's own words once the page fonts are ready */
    const coverInfo = { kicker: 'The Moonlit Cove', name: 'How it’s made', sub: 'a menu of the build' };
    const printCovers = () => { Engine.paintMenu(coverInfo); Engine.books.journal.paintCover(c => Paint.journalCover(c, { title: 'Build notes', name: Content.name })); try { Engine.paintClip(doc('stack').canvases[0]); } catch (e) { /* the list prints when it is first opened */ } };
    printCovers();
    if (document.fonts && document.fonts.load) Promise.all(['500 70px Fraunces', 'italic 400 25px Fraunces', '600 25px Fraunces', '500 21px "JetBrains Mono"', '600 40px Caveat', '700 40px Caveat'].map(f => document.fonts.load(f))).then(() => { rd.docs = {}; printCovers(); }, () => {});
    $('enterSound').disabled = false; $('enterQuiet').disabled = false;
    $('introNote').textContent = `Live sky over ${city}. Best with headphones.`;
    requestAnimationFrame(frame);
  }, 30);
  function enter(withSound) {
    st.entered = true; document.body.classList.add('entered'); $('intro').classList.add('gone');
    if (withSound) startSound();
    setTimeout(() => { if (!st.hintGone) $('hint').style.opacity = 1; }, 2500);
  }
  $('enterSound').addEventListener('click', () => enter(true));
  $('enterQuiet').addEventListener('click', () => enter(false));

  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const lerpCam = (a, b, t) => ({ pos: a.pos.map((v, i) => v + (b.pos[i] - v) * t), look: a.look.map((v, i) => v + (b.look[i] - v) * t), fov: a.fov + (b.fov - a.fov) * t, focus: (a.focus || 25) + ((b.focus || 25) - (a.focus || 25)) * t });

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ready) return;
    const dtR = st.last ? Math.min(window.__coveDtCap || 0.1, (now - st.last) / 1000) : 1 / 60; st.last = now;   /* (the test bench raises the cap: software GL draws a frame every few seconds) */
    st.t += dtR * st.motion;
    st.offset += dtR * 1000 * (st.flow - 1);
    const ms = nowMs();

    /* camera: the explore camera, or a flight to (and back from) whatever is open */
    const orbC = stepOrbit(dtR);
    st.camT = Math.min(1, st.camT + dtR / (st.camDur || 2.2));
    /* the camera has come to rest at what is being opened: now open it */
    if (rd.on && rd.pending && st.camT >= 0.92) { const f = rd.pending; rd.pending = null; f(); }
    if (rd.on) {
      const a = 1 - Math.exp(-dtR * 6); rd.zoom += (rd.zoomT - rd.zoom) * a; rd.pan[0] += (rd.panT[0] - rd.pan[0]) * a; rd.pan[1] += (rd.panT[1] - rd.pan[1]) * a;
      if (rd.cfg.kind === 'paper' && rd.paperWH && Engine.paper.mode !== 'hidden' && Engine.paper.mode !== 'closing') { const v = V[rd.cfg.view], hp = heldPose(v, rd.paperWH[0], rd.paperWH[1], rd.zoom, rd.pan); Engine.paper.setHeld(hp.p, hp.q); st.to = Object.assign({}, v, { focus: hp.d }); }
    }
    if (rd.on && rd.cfg.kind === 'book') {
      const tv = bookView(), a = rd.cam ? 1 - Math.exp(-dtR * 4) : 1;
      rd.cam = rd.cam ? lerpCam(rd.cam, tv, a) : tv; st.to = rd.cam;
    }
    if (rd.on && rd.cfg.kind === 'tags' && single() && tagBulbs) {
      const b = tagBulbs[rd.tagIdx], tv = { pos: [b[0], b[1] - 0.25, b[2] + 1.7], look: [b[0], b[1] - 0.3, b[2] - 0.4], fov: 50, focus: 1.8 }, a = rd.cam ? 1 - Math.exp(-dtR * 3) : 1;
      rd.cam = rd.cam ? lerpCam(rd.cam, tv, a) : tv; st.to = rd.cam;
    }
    let cam = !st.to || (st.to === orbC && st.camT >= 1) ? orbC : lerpCam(st.from, st.to, ease(st.camT));
    st.cur = cam;
    /* driving: physics, van pose, chase camera, sound */
    car.k = Math.max(0, Math.min(1, car.k + (car.on ? dtR / 1.6 : -dtR / 1.8)));
    car.camK = Math.max(0, Math.min(1, car.camK + (car.on ? dtR / 1.4 : -dtR / 2.0)));
    let drv = null;
    if (car.on) drv = stepCar(dtR);
    if (car.on || car.k > 0) Engine.setVan({ x: car.on ? car.x : undefined, z: car.z, heading: car.h, roll: car.roll, pitch: car.pitch, lift: body.y, spin: car.spin, steer: car.steer, k: car.k, head: car.on ? 1 : Math.max(0, car.k * 2 - 1), brake: drv && (drv.brake || car.v < -0.3) ? 1 : 0 });
    if (car.camK > 0.001 && car.camP !== null || car.on) {
      const cc = chaseCam(dtR), e = ease(car.camK);
      cam = lerpCam(cam, cc, e);
    } else car.camP = null;
    /* walking: the steps, and the eyes they carry */
    wk.camK = clamp(wk.camK + (wk.on ? dtR / 1.4 : -dtR / 1.6), 0, 1);
    if (wk.on) stepWalk(dtR);
    if (wk.camK > 0) { const e = ease(wk.camK); cam = e >= 1 ? wk.cam : lerpCam(cam, wk.cam, e); }
    if (sound.amb) sound.amb.engine(car.on, Math.min(1, Math.abs(car.v) / 14), drv ? drv.thr : 0, Math.min(1, Math.abs(car.v) / 8));
    const aspect = view.w / view.h;
    if (aspect < 1.2 && !rd.on) cam = Object.assign({}, cam, { fov: Math.min(80, cam.fov * (1 + (1.2 - aspect) * 0.75)) });
    const wideScreen = view.w > 900;
    const shiftX = st.chapter && !rd.on && wideScreen ? 0.17 : 0;

    /* lights: auto by the sun, or forced */
    const wxf = stepWeather(dtR), W = st.wx;
    const journey = rd.on && rd.cfg && rd.cfg.kind === 'tags';
    const S0 = st.S, want = journey ? 1 : st.lightsMode === 'on' ? 1 : st.lightsMode === 'off' ? 0 : (S0 && S0.lightsAuto ? 1 : 0);
    const towards = (v, tgt, rate) => v + Math.max(-rate, Math.min(rate, tgt - v));
    const q = st.lightsQuick ? 3.5 : 1;   /* switched by hand: answer within a moment, not over seconds */
    st.L.string = towards(st.L.string, want, dtR * q / 2.6); st.L.lantern = towards(st.L.lantern, want, dtR * q / 1.4);
    st.L.van = towards(st.L.van, want, dtR * q / 1.2); st.L.fairy = towards(st.L.fairy, want, dtR * q / 1.6);
    if (st.lightsQuick && Math.abs(st.L.string - want) < 0.01) st.lightsQuick = 0;
    const Ls = Object.assign({}, st.L);
    if (journey) { const ft = (performance.now() - rd.flick) / 1000; if (ft < 1.5) { const h = Math.sin(Math.floor(ft * 14) * 91.7) * 43758.5; Ls.string = (h - Math.floor(h)) > 0.45 ? 1 : 0.08; } else Ls.string = 1; }
    const night = S0 ? S0.night : 1;
    /* the fire is lit from golden hour to sunrise and left to smoulder by day; crickets after dark, birds at dawn and by day */
    const sAlt = S0 ? S0.sAlt : -20, smf = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const morning = new Date(ms).getHours() < 12;
    const tod = { fire: 1 - smf(-1, 7, sAlt), crickets: 1 - smf(-9, -2, sAlt), birds: smf(-11, -3, sAlt) * (morning ? 1 : 0.55) * (1 - 0.45 * smf(20, 45, sAlt)), gulls: smf(1, 10, sAlt), owl: 1 - smf(-14, -8, sAlt) };

    const t0 = performance.now();
    st.readK = Math.max(0, Math.min(1, (st.readK || 0) + (rd.on ? dtR / 1.5 : -dtR / 1.0)));
    /* the clouds keep their own clock: it runs with the scene, and moving the time of day moves them on too */
    const cloudT = st.t + ((ms / 60000) % 1440) * 6;
    const S = Engine.render({ ms, loc, t: st.t, waveT: st.t, cloudT, dens: st.dens, cam, shiftX, msaa: 0, renderScale: Math.min(window.__coveMaxRS || 1, rd.on ? Math.max(st.rs, 0.9) : st.rs), soft: st.soft * (1 - 0.8 * st.readK), read: st.readK,
      lights: Ls, fire: { i: tod.fire * (1 - 0.6 * W.rain), smoke: (0.3 + 0.7 * tod.fire) * (1 + 0.6 * W.rain), steam: tod.fire }, flies: 1 - W.rain,
      sky: { cirrus: W.cirrus, alto: W.alto, cumulus: W.cumulus, stratus: W.stratus, storm: W.storm, flash: wxf.flash, bolt: wxf.bolt }, rain: W.rain, wet: W.wet, rough: W.storm * 0.8 + W.rain * 0.3, wind: 1 + 1.6 * W.storm + 0.5 * W.rain, rainSlant: 0.1 + 0.3 * W.storm, expMul: 1 + 1.4 * wxf.flash * W.storm });
    st.S = S;
    updateSky(ms, S);
    syncLightsUI();

    /* hotspots follow their objects */
    if (!anchors) anchors = Engine.anchors();
    /* pins: a glint on each object, hidden while something is open */
    Content.chapters.forEach(c => { const a = c.anchor === 'clipboard' ? (Engine.anchorNow('clipboard') || anchors.clipboard) : anchors[c.anchor];
      const p = Engine.project(a), el = c.spot, vis = !rd.on && !car.on && !wk.on && orbNearCamp() && p[2] < 1 && p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.1 && p[1] < 0.97;
      el.style.transform = `translate(${(view.x + p[0] * view.w).toFixed(1)}px, ${(view.y + p[1] * view.h).toFixed(1)}px)`; el.style.visibility = vis ? 'visible' : 'hidden'; });

    placeTags(performance.now());
    syncWalkBar();
    /* the sea's verdict */
    const si = Engine.surgeInfo();
    if (si.fireOut && !st.wrecked) { st.wrecked = true; setTimeout(() => toast('The tide took the camp.', true, 0), 2600); unlock('tide'); }
    /* a night owl: three minutes in the cove after dark */
    if (st.entered && S.night > 0.6) { st.nightT = (st.nightT || 0) + dtR; if (st.nightT > 180) unlock('night'); }

    /* soundscape */
    if (sound.on && sound.amb) {
      const ctx = sound.ctx, ss = Engine.surgeState();
      /* every wave you see reach the sand gets its own wash, in time */
      const waves = Engine.waveSchedule(st.t - 1, st.t + 6).map(w => ({ id: w.id, t: ctx.currentTime + (w.x - st.t) / st.motion, amp: w.amp, user: !!w.user, pan: (((w.x * 7.3) % 1 + 1) % 1 - 0.5) * 0.5 }));
      if (ss.fireOut != null && sound.douse == null) sound.douse = ctx.currentTime + 0.05;
      const cp = cam.pos, sz = Layout.shoreZ(cp[0]), oceanNear = Math.max(0, Math.min(1, 1 - (Math.hypot(cp[2] - sz, cp[1]) - 5) / 26));
      const fireNear = Math.max(0, Math.min(1, 1 - (Math.hypot(cp[0] - Layout.fire.x, cp[1], cp[2] - Layout.fire.z) - 2.5) / 12));
      sound.thunder = sound.thunder.filter(th => th.t > ctx.currentTime - 2);
      /* fish splashing within earshot */
      for (const sp of S.splashes || []) { const d = Math.hypot(sp.x - cp[0], sp.z - cp[2]); if (d < 40) sound.amb.plop(Math.min(1, 9 / (d + 4)), Math.max(-1, Math.min(1, (sp.x - cp[0]) / 20))); }
      /* water slapping the nearest rocks, the two loudest for each wave */
      const byWave = {};
      for (const r of Engine.rockHits(st.t - 1, st.t + 6, cp[0], cp[2], 34)) {
        const k = Math.min(1.2, r.amp * Math.min(1, r.rad / 1.2) * Math.min(1, 12 / (r.d + 4)));
        (byWave[r.wave] = byWave[r.wave] || []).push({ id: r.id, t: ctx.currentTime + (r.x - st.t) / st.motion, k, pan: Math.max(-1, Math.min(1, (r.px - cp[0]) / 18)) });
      }
      const rocks = Object.values(byWave).flatMap(L => L.sort((a, b) => b.k - a.k).slice(0, 2)).filter(r => r.k > 0.08);
      sound.amb.schedule(ctx.currentTime + 0.6, { rocks, night, crickets: tod.crickets * (1 - 0.8 * W.rain), birds: tod.birds * (1 - W.rain), gulls: tod.gulls * (1 - W.rain), owl: tod.owl * (1 - W.rain), fireI: tod.fire * (1 - 0.6 * W.rain) * (ss.fireOut == null ? 1 : 0), waves, douse: sound.douse, oceanNear, fireNear, rain: W.rain, thunder: sound.thunder });
    }

    /* keep the frame rate comfortable */
    const ft = performance.now() - t0; st.fms.push(ft); if (st.fms.length > 30) st.fms.shift();
    if (st.fms.length === 30) {
      const avg = st.fms.reduce((a, b) => a + b, 0) / 30;
      if (avg > 34 && st.rs > 0.55) { st.rs = Math.max(0.55, st.rs * 0.88); st.fms = []; }
      else if (avg < 16 && st.rs < 1) { st.rs = Math.min(1, st.rs * 1.06); st.fms = []; }
    }
  }
  syncTimeUI(); syncLightsUI(); syncSoundUI(); renderFinds();
  window.__cove = { st, rd, openChapter, toast, readNav, view, car, keys, stepCar, startDrive, stopDrive, obstacles, obstaclesNear, body, orb, orbCam, orbHome, orbToVan, ex, wk, ai, startWalk, stopWalk, setAuto };
})();
