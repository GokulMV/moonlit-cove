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
    t: 4, last: 0, motion: store.get('motion', reduced ? 0.45 : 0.7), soft: store.get('soft2', 0.22),
    timeMode: store.get('timeMode', 'live'), hour: store.get('hour', 23), full: store.get('full2', false), flow: 1, offset: 0,
    lightsMode: store.get('lightsMode', 'auto'), L: { string: 0, lantern: 0, van: 0, fairy: 0 },
    chapter: null, from: null, to: null, camT: 1, cur: null,
    rs: 1, fms: [], S: null, entered: false, hintGone: false, wrecked: false, toastTimer: 0
  };
  const sound = { on: false, amb: null, ctx: null, ch: Object.assign({ ocean: true, forest: true, fire: true, insects: true, weather: true }, store.get('ch', {})), vol: store.get('vol', 0.8), douse: null, thunder: [] };

  /* views the camera moves between */
  const V = {
    wide: Layout.cameras.wide,
    fire: { pos: [4.9, 1.95, -1.25], look: [7.0, 0.55, -4.5], fov: 40, focus: 4.0 },
    table: { pos: [-0.95, 2.9, 1.3], look: [0.6, 0.42, -2.7], fov: 44, focus: 4.4 },
    basket: { pos: [3.15, 1.45, -1.95], look: [1.95, 0.22, -3.78], fov: 42, focus: 2.5 },
    lights: { pos: [4.4, 3.5, 3.9], look: [0.6, 1.8, -3.3], fov: 52, focus: 8.0 },
    van: { pos: [-11.2, 2.1, 1.6], look: [-7.9, 1.2, -3.2], fov: 44, focus: 6.0 },
    bottle: { pos: [-2.75, 1.0, -3.55], look: [-3.3, 0.12, -5.2], fov: 38, focus: 1.95 }
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
  /* (the place's name, and beneath it whose it is) */
  $('hName').textContent = Content.site; $('introName').textContent = Content.site;
  $('hRole').textContent = Content.name + ' · ' + Content.role; $('introRole').textContent = Content.name + ' · ' + Content.role;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* the words of each chapter as plain HTML, for screen readers (the pages themselves are pictures on paper) */
  function docText(id) {
    const C = Content, li = a => `<ul>${a.map(t => `<li>${t}</li>`).join('')}</ul>`;
    if (id === 'notes') return C.notes.map(n => `<h3>${esc(n.title)}</h3><p>${esc(n.problem)}</p><p>${esc(n.fix)}</p>`).join('');
    if (id === 'plans') return Pages.SHEETS.map(([t, sub, , notes]) => `<h3>${esc(t)}</h3><p>${esc(sub)}</p>${li(notes.map(esc))}`).join('');
    if (id === 'stack') return C.stack.map(g => `<h3>${esc(g.group)}</h3>${li(g.items.map(esc))}`).join('');
    if (id === 'contact') return `<p>${esc(C.letter.to)}</p>${C.letter.body.map(p => `<p>${esc(p)}</p>`).join('')}<p>${esc(C.letter.close)} ${esc(C.letter.sign)}</p><p>Email ${esc(C.contact.email)} · ${C.links.map(l => esc(l[2])).join(' · ')}</p>`;
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
    /* (knocked over by a wave: it is set back up where it was before it is opened) */
    if (c && Engine.knocked && Engine.knocked(c.id)) Engine.restore(c.id);
    if (c && RD[c.id]) { d.hidden = true; document.body.classList.remove('reading'); startReading(c.id); return; }
    document.body.classList.toggle('reading', !!c);
    d.classList.toggle('menu-mode', false);
    if (c) { $('dEyebrow').textContent = c.eyebrow; $('dTitle').textContent = c.title; $('dBody').innerHTML = docText(c.id); d.hidden = false; d.scrollTop = 0; goView(c.cam); }
    else { d.hidden = true; if (Engine.bottle.phase !== 'putback') goView('wide'); }   /* (the camera waits while the letter is put back in its bottle) */
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
     book   the journal by the fire: the camera comes down and the pages turn
     paper  the letter, the blueprints, the clipboard: picked up, unrolled, held in front of you */
  const RD = {
    notes: { kind: 'book', book: 'journal', doc: 'notes', tilt: 0.42 },
    plans: { kind: 'paper', doc: 'plans', origin: 'roll', view: 'basket', W: 0.46, H: 0.325, R0: 0.013, rolled: true, back: '#2a5a95', links: ['source'] },
    stack: { kind: 'paper', doc: 'stack', origin: 'clipboard', view: 'van', W: 0.24, H: 0.336, rolled: false, board: true, back: '#f2eee4' },
    contact: { kind: 'paper', doc: 'letter', origin: 'bottle', view: 'bottle', W: 0.2, H: 0.284, R0: 0.0095, rolled: true, back: '#e6d4ad', links: ['email', 'linkedin', 'github'] }
  };
  const rd = { on: false, id: null, cfg: null, docs: {}, s: 1, cam: null, pending: null, held: null, zoom: 1, zoomT: 1, pan: [0, 0], panT: [0, 0], drag: null };
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
      /* (the bottle is looked at where it lies first, and focused on as it is brought up) */
      st.to = Object.assign({}, v, { focus: cfg.origin === 'bottle' ? v.focus : rd.held.d }); rd.focus = null;
      /* o: where the sheet starts (the letter as it leaves the bottle in your hands), else where it lies */
      const go = o => {
        const inHand = !!(o && o.s === 1 && cfg.origin === 'bottle');
        if (cfg.origin !== 'bottle') Engine.prop(cfg.origin, false);
        Engine.paper.open({ W: rd.paperWH[0], H: rd.paperWH[1], R0: cfg.R0, rolled: cfg.rolled, board: cfg.board, backColor: cfg.back, pages: r.canvases, origin: o || Engine.origin(cfg.origin), held: rd.held,
          fly: inHand ? 1.0 : cfg.board ? 1.25 : 1.5, arc: inHand ? 0.03 : undefined, lift: cfg.board ? 1 : 0 });
        syncReader();
      };
      /* the bottle: picked up, uncorked and shaken until the letter slides out of its neck; then it is read */
      arrive(cfg.origin === 'bottle' ? () => Engine.bottle.open(o => { if (rd.on && rd.id === id) go(o); }, { quick: reduced }) : () => go(null));
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
    const cfg = rd.cfg; rd.on = false; rd.pending = null; endPageDrag(false);
    if (cfg.kind === 'book') Engine.books[cfg.book].go(0, false);
    if (cfg.kind === 'paper') {
      const o = cfg.origin;
      if (o === 'bottle') {
        /* a letter being read goes back the way it came out: the bottle is picked up again, the letter rolls up and goes in
           at its neck, the cork is fetched off the sand and twisted back in, and the bottle is put down where it lay (the
           camera waits for it before it goes). If the letter never came out, the bottle goes straight back to its place */
        let pb = null;
        if (Engine.paper.mode !== 'hidden' && !reduced && Engine.bottle.phase === 'down') {
          pb = Engine.bottle.putBack(() => { if (!rd.on && !st.chapter && st.to !== V.wide) goView('wide'); });
          if (pb) { Engine.paper.setOrigin(pb.p, pb.q, pb.s); Engine.paper.close(() => Engine.bottle.letterIn()); rd.putting = true; }
        }
        if (!pb) {
          Engine.bottle.abort();
          if (Engine.paper.mode !== 'hidden') { const h = Engine.bottle.letterRest(); Engine.paper.setOrigin(h.p, h.q, h.s); Engine.paper.close(() => Engine.bottle.letterBack()); }
        }
      } else if (Engine.paper.mode === 'hidden') Engine.prop(o, true);
      else Engine.paper.close(() => Engine.prop(o, true));
    }
    rd.id = null; rd.cfg = null;
    document.body.classList.remove('reading-book'); $('reader').hidden = true;
    const waitBottle = rd.putting; rd.putting = false;
    if (!goingElsewhere) { st.chapter = null; dock.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', 'false')); Content.chapters.forEach(x => x.spot.classList.remove('on', 'dim')); if (!waitBottle) goView('wide'); }
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
    syncReader();
  }
  const pageSound = () => { if (sound.on && sound.amb && sound.amb.page) sound.amb.page(); };
  /* a cork coming out of a bottle: a soft hollow pop (a quick falling tone in a puff of noise), then the letter's paper */
  function popSound() {
    const ctx = sound.on && sound.ctx; if (!ctx) return;
    const t = ctx.currentTime, v = 0.32 * sound.vol, out = ctx.createGain(); out.gain.value = v; out.connect(ctx.destination);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.07);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.9, t + 0.004); og.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.13);
    const n = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.06), ctx.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
    const ns = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); ns.buffer = n; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9; ng.gain.value = 0.5;
    ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t);
    setTimeout(pageSound, 2500);
  }
  Engine.onBottlePop = popSound;
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
    }
    $('rPage').textContent = txt; $('rPrev').disabled = !canP; $('rNext').disabled = !canN;
    $('rPrev').hidden = $('rNext').hidden = cfg.doc === 'letter';
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
  $('rPrev').addEventListener('click', () => readNav(-1));
  $('rNext').addEventListener('click', () => readNav(1));
  $('rClose').addEventListener('click', () => openChapter(null));

  /* ── sky chip (and the one on the card at the door) ── */
  const mx = $('moonIcon').getContext('2d'), imx = $('iMoon').getContext('2d');
  function drawMoon(mx, phase, frac) {
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
    const d = new Date(ms), il = S.illum, hm = `${two(d.getHours())}:${two(d.getMinutes())}`, phase = Astro.phaseName(il.phase);
    /* the tide, from the moon: which way it is going, or high or low water if it is about to turn */
    const T = S.tide, soon = m2 => m2 && m2 - ms < 35 * 60e3, hmOf = m2 => { const q = new Date(m2); return `${two(q.getHours())}:${two(q.getMinutes())}`; };
    const tideTxt = soon(T.next.high) ? 'high tide' : soon(T.next.low) ? 'low tide' : T.rising ? 'tide coming in' : 'tide going out';
    $('skyPhase').textContent = `${phase} · ${Math.round(il.fraction * 100)}% · ${tideTxt}`;
    { const sp = Math.abs(Math.cos(il.phase * Math.PI * 4)), kind = sp > 0.75 ? 'Spring tides: the moon is ' + (il.phase > 0.25 && il.phase < 0.75 ? 'full or nearly' : 'new or nearly') + ', so the sun pulls with it. ' : sp < 0.35 ? 'Neap tides: the moon is at a quarter, the sun pulling across it. ' : '';
      const el = $('tTide'); if (el) el.textContent = `${kind}Tides follow the moon here: next high water ${T.next.high ? hmOf(T.next.high) : '—'}, next low ${T.next.low ? hmOf(T.next.low) : '—'}.`; }
    const alt = S.mAlt > 0 ? `moon ${Math.round(S.mAlt)}° up` : (S.sAlt > 0 ? `sun ${Math.round(S.sAlt)}° up` : 'moon below horizon');
    $('skyTime').textContent = `${hm} · ${city} · ${alt}`;
    drawMoon(mx, il.phase, il.fraction);
    /* the card at the door says the same, until you are in */
    if (!st.entered) { $('iSky').textContent = `${st.timeMode === 'live' ? 'Live sky' : 'The sky'} over ${city}`; $('iSkyTime').textContent = `${hm} · ${phase}`; drawMoon(imx, il.phase, il.fraction); }
  }
  $('sky').addEventListener('click', () => toggleSettings(true));

  /* ── time ── */
  function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  /* the time the sky shows. It only ever moves on continuously, so a time-lapse never jumps: a picked hour counts from
     the day it was picked, and the full-moon preview moves the whole timeline on by whole days, to the next full moon.
     (It used to put each day's clock onto that one date, which sent the sky back a day at every midnight: every 86
     seconds at 1000×.) Picking a time, or switching the preview on, starts both afresh from today */
  let fullShift = null; st.day0 = startOfDay(Date.now());
  const restartTime = () => { st.offset = 0; st.day0 = startOfDay(Date.now()); fullShift = null; };
  function nowMs() {
    let ms = (st.timeMode === 'live' ? Date.now() : st.day0 + st.hour * 3600e3) + st.offset;
    if (st.full) {
      if (fullShift === null) { const now = Date.now(); fullShift = startOfDay(Astro.nextFullMoon(now - 2 * 864e5)) - startOfDay(now); }
      ms += fullShift;
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
  document.querySelectorAll('[data-time]').forEach(b => b.addEventListener('click', () => { st.timeMode = b.dataset.time; restartTime(); store.set('timeMode', st.timeMode); syncTimeUI(); }));
  document.querySelectorAll('[data-flow]').forEach(b => b.addEventListener('click', () => { st.flow = +b.dataset.flow; syncTimeUI(); }));
  $('tHour').addEventListener('input', e => { st.hour = +e.target.value; st.timeMode = 'custom'; restartTime(); store.set('hour', st.hour); store.set('timeMode', 'custom'); syncTimeUI(); });
  /* one-tap moments: sunset, night, sunrise at your location today */
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.preset, day0 = startOfDay(Date.now()), toH = ms => (ms - day0) / 3600e3;
    restartTime();
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
  $('tFull').addEventListener('click', () => { st.full = !st.full; fullShift = null; store.set('full2', st.full); syncTimeUI(); });
  $('lSoft').value = st.soft; $('lSoft').addEventListener('input', e => { st.soft = +e.target.value; store.set('soft2', st.soft); });
  $('lMotion').value = st.motion; $('lMotion').addEventListener('input', e => { st.motion = +e.target.value; store.set('motion', st.motion); });
  /* how much life there is: insects, fish, animals (birds, bats, crabs, dolphins), shells (0.5 is the cove as it always was; shells start all out) */
  st.dens = Object.assign({ insects: 0.5, fish: 0.5, animals: 0.5, shells: 1 }, store.get('dens', {}));
  for (const [k, id] of [['insects', 'dInsects'], ['fish', 'dFish'], ['animals', 'dAnimals'], ['shells', 'dShells']]) {
    $(id).value = st.dens[k]; $(id).addEventListener('input', e => { st.dens[k] = +e.target.value; store.set('dens', st.dens); });
  }
  /* where the lights are heading (not how bright they are mid-fade): the button flips that */
  const lightsWanted = () => st.lightsMode === 'on' ? true : st.lightsMode === 'off' ? false : !!(st.S && st.S.lightsAuto);
  /* (called every frame: it touches the page only when something has changed) */
  let lightsUI = '';
  function syncLightsUI() { const k = st.lightsMode + lightsWanted(); if (k === lightsUI) return; lightsUI = k; seg('lights', st.lightsMode); $('bLights').setAttribute('aria-pressed', String(lightsWanted())); }
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
    $('cYear').textContent = String(Math.max(2026, new Date().getFullYear()));
    $('cBody').innerHTML = Content.credits.map(g => `<section><h3>${esc(g.group)}</h3><ul>${g.items.map(i => `<li><b>${esc(i.what)}</b><span>${esc(i.who)}</span><span class="cl">${i.link ? `<a href="${esc(i.link[1])}" target="_blank" rel="noopener">${esc(i.link[0])} ↗</a>` : ''}${i.licence ? `<em>${esc(i.licence)}</em>` : ''}</span></li>`).join('')}</ul></section>`).join('');
  }
  function toggleCredits(open) { const c = $('credits'), o = open ?? c.hidden; c.hidden = !o; if (o) { renderCredits(); toggleSettings(false); c.scrollTop = 0; } }
  document.querySelectorAll('[data-open-credits]').forEach(b => b.addEventListener('click', () => toggleCredits(true)));
  $('cClose').addEventListener('click', () => toggleCredits(false));

  /* ── sound ── */
  const chIds = { ocean: 'sOcean', forest: 'sForest', fire: 'sFire', insects: 'sInsects', weather: 'sWeather' };
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
    clear: { cirrus: 0.1, alto: 0, cumulus: 0.24, stratus: 0, storm: 0, rain: 0 },
    wispy: { cirrus: 0.95, alto: 0.1, cumulus: 0.22, stratus: 0, storm: 0, rain: 0 },
    puffy: { cirrus: 0.22, alto: 0.08, cumulus: 1.0, stratus: 0, storm: 0, rain: 0 },
    mackerel: { cirrus: 0.4, alto: 0.95, cumulus: 0.28, stratus: 0, storm: 0, rain: 0 },
    overcast: { cirrus: 0, alto: 0.35, cumulus: 0.5, stratus: 0.88, storm: 0, rain: 0 },
    rain: { cirrus: 0, alto: 0.15, cumulus: 0.45, stratus: 1, storm: 0.12, rain: 1 },
    storm: { cirrus: 0, alto: 0.05, cumulus: 0.55, stratus: 1, storm: 1, rain: 1 }
  };
  const AUTO = ['puffy', 'wispy', 'mackerel', 'clear', 'puffy', 'mackerel', 'wispy', 'overcast'];
  const WXNOTE = { auto: 'Clouds drift through their kinds on their own.', clear: 'A clear sky, a few fair-weather clouds.', wispy: 'High cirrus: thin mare’s tails.', puffy: 'Cumulus all across the sky.', mackerel: 'A mackerel sky of altocumulus.', overcast: 'A grey deck of stratus.', rain: 'Rain on the sand and the sea. The fire burns low.', storm: 'A thunderstorm out at sea.' };
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
    if (rd.on && rd.cfg && !rd.pending && !(rd.drag && rd.drag.live)) { const next = e.clientX - view.x >= view.w / 2; c = next ? ($('rNext').disabled ? '' : 'rd-next') : ($('rPrev').disabled ? '' : 'rd-prev'); }
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
    if (sketch.on) return;
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
    const msg = info.amp >= 4.6 ? `Swell ×${info.combo}. This one will flood the camp.` : info.amp >= 2.9 ? `Swell ×${info.combo}. It could reach the fire.` : info.combo > 1 ? `Swell ×${info.combo} building.` : 'A swell is on its way in.';
    toast(msg, false, 2600);
    if (info.amp >= 4) unlock('big_wave');
  });
  const zoomable = () => rd.on && !!rd.cfg;
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
    /* (whole turns are taken off now and then, only to keep the numbers small; a glide home takes them off first) */
    if (!orb.fly && Math.abs(T[Y]) > 40 * Math.PI) { const k = Math.round(T[Y] / TAU) * TAU; T[Y] -= k; v[Y] -= k; }
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
    /* the shortest way round: whole turns taken off first */
    const T = orb.T, k = Math.round(T[Y] / TAU) * TAU; T[Y] -= k; orb.v[Y] -= k;
    to = to.slice(); to[Y] = T[Y] + wrapA(to[Y] - T[Y]);
    const d = Math.abs(to[X] - T[X]) + Math.abs(to[U] - T[U]) * 8;
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
  /* a pin on a thing shows when the camera is round the camp, or, walking, when you have come up to it */
  const pinNear = a => wk.on ? Math.hypot((a.x ?? a[0]) - wk.x, (a.z ?? a[2]) - wk.z) < 6.5 : orbNearCamp();

  /* the hand on it: pointers, the wheel, the keys */
  const ex = { ptrs: new Map(), kind: 'turn', dragged: false, multi: false, two: null, ax: 0, ay: 0, wheelT: -1e9 };
  /* (something held up close, inspect.js: everything else waits while it is; see openInspect) */
  const insp = { on: false, info: null, c: null, drag: null, seen: new Set(store.get('seenLife', [])) };
  const canExplore = () => st.entered && !rd.on && !car.on && !wk.on && !st.chapter && !seat.on && !sketch.on && !tbox.on && !insp.on;
  const hintOff = () => { if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; } };
  if (matchMedia('(pointer: coarse)').matches) $('hint').textContent = 'Tap a glowing dot to open it. Tap the sea to send a wave. Drag to look around, two fingers to move and zoom.';
  /* a new swipe (or pinch, or burst of scrolling): straight after the last one it goes further, each time up to four
     and a half times as far; after a pause it is gentle again */
  function gestureStart(t) {
    const now = performance.now() / 1000, gap = now - orb.lastEnd;
    orb.boost = clamp(gap < 0.8 ? orb.boost * 1.6 : 1 + (orb.boost - 1) * Math.exp(-(gap - 0.8) / 0.5), 1, ORB.boost);
    orb.fly = null; orb.g.fill(0); velReset(t); ex.ax = ex.ay = 0;
    hintOff();
  }
  /* the hand's speed as it lets go: from the gesture's own steps over their last tenth of a second, timed by the
     events' own timestamps (so steps that arrive in a bunch, as they do when the page is busy, don't read as a flick) */
  const VN = 32, VT = new Float64Array(VN), VP = new Float64Array(VN * 5), cum = new Float64Array(5), vsp = new Float64Array(5);
  let vn = 0, vi = 0;
  function velMark(t) { VT[vi] = t; VP.set(cum, vi * 5); vi = (vi + 1) % VN; vn = Math.min(VN, vn + 1); }
  function velReset(t) { cum.fill(0); vn = vi = 0; velMark(t); }
  function velAt(t) {
    vsp.fill(0); if (vn < 2) return vsp;
    const last = (vi + VN - 1) % VN; if (t - VT[last] > 120) return vsp;     /* (the hand had stopped before it let go) */
    let j = (last + VN - 1) % VN;
    for (let s = 2; s < vn; s++) { const k = (last + VN - s) % VN; if (VT[last] - VT[k] > 100) break; j = k; }
    const span = Math.max(16, VT[last] - VT[j]) / 1000;
    for (let a = 0; a < 5; a++) vsp[a] = (VP[last * 5 + a] - VP[j * 5 + a]) / span;
    return vsp;
  }
  /* let go: it glides on at the speed it was moving, and comes to rest. A single swipe glides only a little way; the
     speed a glide may keep grows with the run of swipes, as the swipes themselves do */
  const GCAP = [1.6, 0.8, 1.2, 40, 1.5];
  function gestureEnd(fling, t) {
    orb.lastEnd = performance.now() / 1000;
    if (!fling) return;
    const v = velAt(t), b = orb.boost;
    for (let i = 0; i < 5; i++) orb.g[i] = clamp(v[i], -GCAP[i] * b, GCAP[i] * b);
  }
  /* a step of a gesture, in each axis's own units, at time t: onto the targets, and into the record of its speed */
  function orbNudge(dy, de, dz, dx, du, t) {
    const T = orb.T;
    /* tilting down stops at the ground (or the treetops), and tilting up answers at once */
    if (de) { const lo = Math.max(ORB.elMin, orb.Fs - 0.004); T[E] = clamp(Math.max(T[E], lo) + de, lo, ORB.elMax); }
    T[Y] += dy; T[Z] = clamp(T[Z] + dz, ORB.zMin, ORB.zMax); T[X] += dx; T[U] = clamp(T[U] + du, 0, 1);
    cum[Y] += dy; cum[E] += de; cum[Z] += dz; cum[X] += dx; cum[U] += du; velMark(t);
  }
  /* one finger (or the left button): across turns round the point, up and down tilts. Whatever is under the hand
     follows it. A swipe mostly one way moves only that way, so turning doesn't wobble the tilt */
  function orbTurn(dx, dy, t) {
    ex.ax += Math.abs(dx); ex.ay += Math.abs(dy);
    const s = ex.ax + ex.ay + 1e-6, b = orb.boost;
    orbNudge(dx * 2.3 / Math.max(320, view.w) * b * sstep(0.2, 0.45, ex.ax / s), -dy * 1.05 / Math.max(320, view.h) * b * sstep(0.2, 0.45, ex.ay / s), 0, 0, 0, t);
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
  function orbPanBy(dx, dy, t) { const d = panDelta(dx, dy); orbNudge(0, 0, 0, d[0], d[1], t); }
  /* the wheel zooms (a pinch on a trackpad comes as a wheel with Ctrl held: gently); a sideways swipe on a trackpad
     moves along the beach. A burst of scrolling counts as one swipe, and brings its own momentum */
  function orbWheel(e) {
    const now = performance.now(), k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.h : 1;
    if (now - ex.wheelT > 180) gestureStart(e.timeStamp);
    ex.wheelT = now; orb.lastEnd = now / 1000;
    let dx = clamp(e.deltaX * k, -150, 150), dy = clamp(e.deltaY * k, -150, 150);
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    const d = panDelta(-dx, 0);
    orbNudge(0, 0, dy * (e.ctrlKey ? 0.006 : 0.0011) * orb.boost, dx ? d[0] : 0, dx ? d[1] : 0, e.timeStamp);
  }
  /* two fingers: they move the point, pinch to zoom, and twist to turn once the twist is clearly meant */
  function twoState(o) {
    let i = 0, ax = 0, ay = 0, bx = 0, by = 0;
    for (const p of ex.ptrs.values()) { if (i === 0) { ax = p.x; ay = p.y; } else if (i === 1) { bx = p.x; by = p.y; } i++; }
    o.mx = (ax + bx) / 2; o.my = (ay + by) / 2; o.d = Math.max(20, Math.hypot(bx - ax, by - ay)); o.a = Math.atan2(by - ay, bx - ax); return o;
  }
  const TW = { mx: 0, my: 0, d: 1, a: 0 };
  /* (a second finger joining a drag already under way carries it on, rather than counting as a new swipe) */
  function twoStart(going, t) { ex.two = twoState({ mx: 0, my: 0, d: 1, a: 0, tw: 0 }); if (going) velReset(t); else gestureStart(t); }
  function twoMove(ts) {
    const t = ex.two, n = twoState(TW), da = wrapA(n.a - t.a), b = orb.boost;
    t.tw += da;
    const d = panDelta(n.mx - t.mx, n.my - t.my);
    orbNudge(Math.abs(t.tw) > 0.14 ? da * 0.9 * b : 0, 0, -Math.log(n.d / t.d) * 0.7 * b, d[0], d[1], ts);
    t.mx = n.mx; t.my = n.my; t.d = n.d; t.a = n.a;
  }
  cv.addEventListener('contextmenu', e => { if (st.entered && !rd.on) e.preventDefault(); });
  cv.addEventListener('pointerdown', e => {
    if (!st.entered || rd.on || insp.on) return;
    if (!ex.ptrs.size) { ex.dragged = ex.multi = false; ex.two = null; }
    ex.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (ex.ptrs.size === 1) ex.kind = e.pointerType === 'mouse' && (e.button > 0 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'turn';
    else { const going = ex.dragged; ex.multi = ex.dragged = true; if (ex.ptrs.size === 2 && canExplore()) twoStart(going, e.timeStamp); }
  });
  cv.addEventListener('pointermove', e => {
    if (wk.on && !insp.on && e.pointerType === 'mouse' && !e.buttons) hoverAt(e);
    const p = ex.ptrs.get(e.pointerId); if (!p) return;
    if (e.pointerType === 'mouse' && !e.buttons) { exUp(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ex.ptrs.size > 1) { if (ex.two && canExplore()) twoMove(e.timeStamp); return; }
    if (!ex.dragged) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < (e.pointerType === 'mouse' ? 6 : 10)) return;
      ex.dragged = true;
      if (wk.on) hintOff(); else if (canExplore()) gestureStart(e.timeStamp);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    }
    if (wk.on) walkLook(dx, dy);
    else if (canExplore()) { if (ex.kind === 'pan') orbPanBy(dx, dy, e.timeStamp); else orbTurn(dx, dy, e.timeStamp); }
  });
  function exUp(e) {
    if (!ex.ptrs.delete(e.pointerId)) return;
    const live = canExplore();
    if (ex.ptrs.size === 1) {
      /* two fingers became one: the one left carries on turning from where it is, without a glide from the pinch */
      if (ex.two) { ex.two = null; if (live) gestureEnd(false); }
      for (const p of ex.ptrs.values()) { p.x0 = p.x; p.y0 = p.y; }
      ex.kind = 'turn'; ex.ax = ex.ay = 0; velReset(e.timeStamp);
      return;
    }
    if (ex.ptrs.size) return;
    if (wk.on) { if (ex.dragged) wk.mT = performance.now(); }
    else if (live && (ex.dragged || ex.two)) gestureEnd(e.type !== 'pointercancel', e.timeStamp);
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
    const away = Math.hypot(px - P0[0], pz - P0[2]) > 4 || Math.abs(wrapA(orb.v[Y])) > 0.35 || Math.abs(orb.v[Z]) > 0.4 || Math.abs(orb.el - EL0) > 0.22;
    const camp = on && away ? sideOf(P0[0], P0[2]) : -1, van = on && Math.hypot(wbar.vx - px, wbar.vz - pz) > 25 ? sideOf(wbar.vx, wbar.vz) : -1;
    const label = (s, t) => s === 0 ? '← ' + t : s === 2 ? t + ' →' : t;
    if (camp >= 0 || van >= 0) hintOff();
    if (camp !== wbar.camp) { wbar.camp = camp; $('bWalkCamp').hidden = camp < 0; if (camp >= 0) $('bWalkCamp').textContent = label(camp, 'Back to camp'); }
    if (van !== wbar.van) { wbar.van = van; $('bWalkVan').hidden = van < 0; if (van >= 0) $('bWalkVan').textContent = label(van, 'Go to the van'); }
    /* parked a long way from the camp, and looking at the van: the camp can come here */
    const pitchOK = on && !pitchS.on && !Engine.pitching && car.k <= 0 && Math.hypot(wbar.vx - P0[0], wbar.vz - P0[2]) > 60 && Math.hypot(wbar.vx - px, wbar.vz - pz) < 30;
    if (pitchOK !== wbar.pitch) { wbar.pitch = pitchOK; $('bPitch').hidden = !pitchOK; }
  }

  /* ── pitching camp where the van is parked. The spot has to take the camp: as much dry sand as the camp's own bay
     has, and no rock in the way. Then, while the screen is dark for a moment, the coast is moved under the camp so
     that the van stands where it always stands at the camp, on the beach it was parked on; the camera is set at
     the camp, and the camp goes up again one thing at a time ── */
  const pitchS = { on: false, phase: 0, t0: 0, ox: 0, oz: 0, fade: 1 };
  function pitchSpot(P = Engine.vanPose()) {
    const O = Layout.O, Co = Layout.Coast, W = Engine.world, cx = Layout.camp.x, V = Layout.van;
    const ox = O.x + P.x - V.x, oz = Co.shoreZ(cx + ox) - Co.shoreZ(cx);
    for (let x = cx - 16; x <= cx + 16; x += 2) {
      const sz = Co.shoreZ(x + ox), w = Co.vegZ(x + ox) - sz, w0 = Co.vegZ(x) - Co.shoreZ(x);
      if (Co.head(x + ox) > 0.5) return { ok: false, why: 'rock' };
      if (w < w0 - 1.6) return { ok: false, why: 'narrow' };
      /* (the rock is looked up in the world as it is now: the new spot's coast point, in today's coordinates) */
      if (W) for (let z = sz - oz + 1; z <= Co.vegZ(x + ox) - oz + 4; z += 1.5) if (W.massif(x + ox - O.x, z + oz - O.z) > 0.05) return { ok: false, why: 'rock' };
    }
    return { ok: true, ox, oz };
  }
  function startPitch() {
    if (pitchS.on || !ready || car.on || wk.on || Engine.pitching) return;
    const sp = pitchSpot();
    if (!sp.ok) { toast(sp.why === 'rock' ? 'Too much rock here for the camp. Try further along the beach.' : 'Not enough dry sand here for the camp. Try a wider stretch of beach.', false, 3800); return; }
    Object.assign(pitchS, { on: true, phase: 1, t0: performance.now(), ox: sp.ox, oz: sp.oz });
    $('bPitch').hidden = true; wbar.pitch = false; hintOff();
  }
  $('bPitch').addEventListener('click', startPitch);
  /* each frame: the screen dims, the camp moves, the screen comes back up on it; returns the screen's brightness */
  function stepPitch() {
    if (!pitchS.on) return 1;
    const t = (performance.now() - pitchS.t0) / 1000;
    if (pitchS.phase === 1) {
      if (t < 0.45) return 1 - sstep(0, 0.45, t);
      const V = Layout.van;
      Engine.moveCamp(pitchS.ox, pitchS.oz, P0[0]);
      Engine.setVan({ x: V.x, z: V.z, heading: V.rot, roll: 0, pitch: 0, lift: 0, spin: 0, steer: 0, k: 1, head: 0, brake: 0 });
      Object.assign(car, { x: V.x, z: V.z, h: V.rot, v: 0, k: 1, camK: 0, camP: null, yaw: 0, roll: 0, pitch: 0, steer: 0 });
      wbar.vx = V.x; wbar.vz = V.z;
      /* the camera at the camp, as if it had always been here */
      pvC.x = wbC.x = flr.y = NaN;     /* (what was worked out about the sand here belonged to the old beach) */
      orbAt(P0[0], P0[2], 0, 0); for (let i = 0; i < 5; i++) orb.T[i] = orb.v[i] = HOME[i]; orb.pz = P0[2];
      st.from = st.to = orbCam; st.camT = 1; st.wrecked = false;
      Engine.pitchStart(); unlock('pitch');
      pitchS.phase = 2; pitchS.t0 = performance.now();
      return 0;
    }
    if (t >= 0.8) { pitchS.on = false; return 1; }
    return sstep(0.05, 0.8, t);
  }

  /* ── driving the camper van ── */
  const car = { on: false, k: 0, x: 0, z: 0, h: 0, v: 0, steer: 0, spin: 0, roll: 0, pitch: 0, odo: 0, trackOdo: 0, splashT: 0, camK: 0, camP: null, camL: null, yaw: 0, lastV: 0, knocks: 0, wheels: null, bumpT: 0 };
  const keys = new Set(), touch = { x: 0, y: 0, on: false };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  /* what the van drives round: the camp's own things, and the rocks and trunks of whichever chunks of the coast
     are built where it is (the world keeps them in buckets along each chunk, so only the near ones are looked at) */
  const obstacles = [], campObs = [];
  function buildObstacles() {
    for (const [x, z] of Layout.palms.map(p => [p[0], p[1]])) campObs.push([x, z, 0.4]);
    for (const t of Layout.trees) campObs.push([t[0], t[1], 0.5]);
    for (const b of Layout.bushes) campObs.push([b[0], b[1], b[2] * 0.7]);
    for (const [x, z] of Layout.poles) campObs.push([x, z, 0.14, 'pole']);
    campObs.push([Layout.fire.x, Layout.fire.z, 0.62, 'fire']);
    /* (the castle's radius goes to 0 when the sea has washed it flat: Layout.castle.ob) */
    campObs.push(Layout.castle.ob = [Layout.castle.x, Layout.castle.z, (Layout.castle.radius || 0.9) * 0.82, 'castle']);
    obstacles.push(...campObs);
  }
  /* the obstacles near (x, z), each as [dx, dz, radius, the obstacle] measured from it to the point */
  function obstaclesNear(x, z) {
    const out = [], W = Engine.world;
    for (const o of campObs) if (Math.abs(x - o[0]) < 6) out.push([x - o[0], z - o[1], o[2], o]);
    if (W) for (const o of W.obstaclesNear(x, z)) out.push([x - o[0], z - o[1], o[2], o]);
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
  /* a sky lantern from the camp: first it asks what you wish for (see the wishes, below), then it fills with warm air and rises out over the sea */
  $('bLantern').addEventListener('click', () => { if (ready) openWish(); });
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
    if (car.trackOdo > 0.12) {
      if (!inWater && Engine.marks) wNow.forEach((w, i) => Engine.marks.tyre(i, car.wheels[i][0], car.wheels[i][1], w[0], w[1], 0.19, 0.85 + 0.15 * Math.min(1, Math.abs(car.v) / 6), sandWet(w[0], w[1]), st.t));
      car.wheels = wNow; car.trackOdo = 0;
    }
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
    /* (not a groyne's foot, though: that keeps the van off it, but a person climbs up onto its blocks and walks out) */
    if (W) { const L = W.obstaclesNear(x, z); for (let i = 0; i < L.length; i++) if (L[i][3] !== 'reef') goAdd(L[i][0], L[i][1], L[i][2]); }
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
      /* (out on a reef the sea is no wall: walk along its top as far as it goes; step off its edge and you are kept on it) */
      const zMin = Layout.shoreZ(wk.x) - 1.2, zMax = Layout.vegZ(wk.x) + 2, onReef = W && W.reefTop(wk.x, wk.z) > -9;
      if (wk.z < zMin && !onReef) {
        if (wk.reef && W.reefTop(wk.ox, wk.oz) > -9) { wk.x = wk.ox; wk.z = wk.oz; wk.v *= 0.5; }
        else wk.z = zMin;
        moved = true;
      } else if (wk.z > zMax) { wk.z = zMax; moved = true; }
      wk.reef = onReef;
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
  /* walking with a mouse, the view turns without a button held: rest the pointer toward a side of the screen and you
     turn that way, faster the nearer the edge; toward the top or the bottom you look up or down. The middle of the
     screen stays still, so what is there can be clicked */
  const hov = { x: 0, y: 0 };
  function hoverAt(e) {
    const fx = ((e.clientX - view.x) / view.w) * 2 - 1, fy = ((e.clientY - view.y) / view.h) * 2 - 1, zone = (f, a) => Math.sign(f) * Math.max(0, (Math.abs(f) - a) / (1 - a)) ** 1.6;
    hov.x = zone(fx, 0.55); hov.y = zone(fy, 0.6);
  }
  cv.addEventListener('pointerleave', () => { hov.x = hov.y = 0; });
  addEventListener('blur', () => { hov.x = hov.y = 0; });
  function hoverLook(dt) {
    if (!hov.x && !hov.y) return;
    walkLook(-hov.x * 1.0 * dt * Math.max(320, view.w) / 2.2, -hov.y * 0.7 * dt * Math.max(320, view.h) / 1.4);
  }
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
    const sz = Layout.shoreZ(wk.x), wade = wk.reef ? 0 : sstep(sz + 0.2, sz - 1.0, wk.z);
    want *= 1 - 0.45 * wade;
    wk.v += (want - wk.v) * (1 - Math.exp(-dt / (Math.abs(want) > Math.abs(wk.v) ? 0.5 : 0.35)));
    wk.h += wrapA(wk.hT - wk.h) * (1 - Math.exp(-dt * (wk.auto ? 5 : 16)));
    const ox = wk.x, oz = wk.z; wk.ox = ox; wk.oz = oz;
    wk.x -= Math.sin(wk.h) * wk.v * dt; wk.z -= Math.cos(wk.h) * wk.v * dt;
    walkCollide();
    const dist = Math.hypot(wk.x - ox, wk.z - oz), ph0 = wk.phase;
    wk.odo += dist;
    /* a step every stride's half, left and right in turn */
    wk.phase += Math.PI * dist / (0.55 + 0.21 * Math.abs(wk.v));
    if (Math.floor(wk.phase / Math.PI) !== Math.floor(ph0 / Math.PI)) footstep(wade);
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
  /* ── the torch: in hand when walking after dark. It comes on by itself as the light goes (F, or the button, switches it
     on or off), sways with each step, and lags a moment behind a turn of the head ── */
  const tch = { user: null, k: 0, lagY: 0, lagP: 0, lastY: null, lastP: null };
  const torchWanted = () => tch.user === null ? !!(st.S && st.S.night > 0.5) : tch.user;
  function syncTorchBtn() { const b = $('bTorch'); if (b) b.setAttribute('aria-pressed', String(wk.on && torchWanted())); }
  function torchState(dt) {
    const want = wk.on && wk.camK > 0.6 && torchWanted();
    tch.k += ((want ? 1 : 0) - tch.k) * Math.min(1, dt / 0.22);
    if (!want && tch.k < 0.003) { tch.k = 0; tch.lastY = null; return null; }
    const v = Math.min(1, Math.abs(wk.v) / 1.4), ph = wk.phase, yaw = wk.h + wk.hy.v + wk.my, pitch = wk.hp.v + wk.mp;
    if (tch.lastY === null) { tch.lastY = yaw; tch.lastP = pitch; }
    const dy = wrapA(yaw - tch.lastY), dp = pitch - tch.lastP; tch.lastY = yaw; tch.lastP = pitch;
    tch.lagY += (clamp(-dy / Math.max(dt, 1e-3) * 0.05, -0.14, 0.14) - tch.lagY) * Math.min(1, dt * 7);
    tch.lagP += (clamp(-dp / Math.max(dt, 1e-3) * 0.05, -0.1, 0.1) - tch.lagP) * Math.min(1, dt * 7);
    return { k: tch.k, off: [0.215, 0.19 + 0.012 * v * Math.sin(2 * ph), 0.46], sway: [0.022 * v * Math.sin(ph) + tch.lagY, 0.018 * v * Math.sin(2 * ph) + tch.lagP], held: !insp.on };
  }
  function walkCamera() {
    const v = Math.abs(wk.v), bob = reduced ? 0 : 0.012 * v + 0.0035 * v * v, ph = wk.phase, W = Engine.world;
    const yaw = wk.h + wk.hy.v + wk.my + (reduced ? 0 : 0.006 * Math.min(1, v / 1.4) * Math.sin(ph)), pitch = clamp(wk.hp.v + wk.mp, -1.05, 0.95), cp = Math.cos(pitch);
    const sway = 0.6 * bob * Math.sin(ph), g0 = Math.max(0, W ? W.land(wk.x, wk.z) : 0), p = wk.cam.pos, l = wk.cam.look;
    /* (the ground underfoot, eased: stepping from one block of a groyne up or down onto the next lifts the eye or lowers it
       over a moment, as a step does, rather than all at once) */
    const now = performance.now(), gdt = Math.min(0.1, (now - (wk.gT || now)) / 1000); wk.gT = now;
    const g = wk.gs = wk.gs == null || Math.abs(g0 - wk.gs) > 1.2 ? g0 : wk.gs + (g0 - wk.gs) * Math.min(1, gdt * 10);
    p[0] = wk.x + Math.cos(wk.h) * sway; p[1] = g + EYE - bob * (0.5 + 0.5 * Math.cos(2 * ph)); p[2] = wk.z - Math.sin(wk.h) * sway;
    l[0] = p[0] - Math.sin(yaw) * cp * 12; l[1] = p[1] + Math.sin(pitch) * 12; l[2] = p[2] - Math.cos(yaw) * cp * 12;
    wk.cam.fov = 60 + 4 * sstep(1.6, 2.8, v);
    /* focused where the eyes meet the sand (or far off, looking up), eased so it doesn't hunt */
    const fd = pitch < -0.03 ? clamp(EYE / Math.sin(-pitch), 1.5, 40) : 40;
    wk.cam.focus += (fd - wk.cam.focus) * 0.08;
  }
  /* how wet the sand is at a point: soaked at the water's edge, dry a few metres up the beach */
  function sandWet(x, z) { const g = Layout.shoreDZ(x), up = (z - Layout.shoreZ(x)) / Math.sqrt(1 + g * g); return clamp(1 - (up - 0.4) / 2.6, 0, 1); }
  /* a footprint, left and right in turn a hand's width either side of the line walked, toes the way the walker is going,
     turned out a touch as feet are; deeper and darker in wet sand, none in the water (a ripple instead) */
  function footstep(wade) {
    wk.foot = -wk.foot;
    const s = wk.foot * 0.095, x = wk.x + Math.cos(wk.h) * s, z = wk.z - Math.sin(wk.h) * s;
    if (wade < 0.35 && Engine.marks && !wk.reef) {
      Engine.marks.foot(x, z, wk.h - wk.foot * 0.09, wk.foot < 0, sandWet(x, z), st.t);
      wk.prints++;
    } else if (wade > 0.6 && wk.foot > 0) { const ss = Engine.surgeState(); ss.ripples.push({ x, z, t0: st.t, A: 0.22 }); if (ss.ripples.length > 6) ss.ripples.shift(); }
  }
  function startWalk() {
    if (wk.on || !ready) return;
    const fromVan = car.on;
    if (car.on) stopDrive();
    if (seat.on) leaveSeat();
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
  $('bTorch').addEventListener('click', () => { tch.user = !torchWanted(); syncTorchBtn(); });
  $('bWalkExit').addEventListener('click', stopWalk);
  $('bWalkAuto').addEventListener('click', () => setAuto(!wk.auto));
  document.querySelectorAll('[data-pace]').forEach(b => b.addEventListener('click', () => { wk.pace = b.dataset.pace; store.set('walkPace', wk.pace); seg('pace', wk.pace); }));
  seg('pace', wk.pace);
  /* ── holding one of the cove's small lives up close (inspect.js): a click on a crab, a shell, a starfish, a flower
     picks it up; drag to turn it over, scroll to look closer; flick it away (or the button) and it is thrown back where
     it belongs, the sea's to the sea and the land's to the land; or put it down where it was ── */
  const throwWords = h => h === 'sea' ? 'Throw it back in the sea' : h === 'land' ? 'Toss it back in the grass' : 'Let it fly';
  function openInspect(c) {
    if (insp.on || !c) return false;
    const info = Engine.inspect.hold(c); if (!info) return false;
    insp.on = true; insp.info = info; insp.c = c; keys.clear(); touch.x = touch.y = 0;
    if (wk.on && wk.auto) setAuto(false);
    $('iName').textContent = info.name; $('iLatin').textContent = info.latin; $('iNote').textContent = info.note;
    $('iThrow').textContent = info.big ? 'Let it go' : throwWords(info.home); $('iKeep').hidden = !info.flower; $('iPut').hidden = !!info.big;
    $('insp').hidden = false; document.body.classList.add('inspecting');
    if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; }
    insp.seen.add(info.kind); store.set('seenLife', [...insp.seen]); if (insp.seen.size >= 5) unlock('naturalist');
    return true;
  }
  function closeInspect() { insp.on = false; insp.drag = null; $('insp').hidden = true; document.body.classList.remove('inspecting', 'insp-grab'); }
  function inspThrow(dir) {
    if (!insp.on) return; const home = insp.info.home, kind = insp.info.kind;
    if (!Engine.inspect.throwIt(undefined, dir)) return;
    closeInspect();
    if (home === 'sea' && kind === 'crab') unlock('crab_home');
  }
  function inspPut() { if (insp.on && Engine.inspect.putBack()) closeInspect(); }
  function inspKeep() {
    if (!insp.on || !insp.info.flower) return; const f = insp.c.flower;
    if (!Engine.inspect.keep()) return;
    closeInspect(); f.held = false; pickFlower(f, true);
  }
  $('iThrow').addEventListener('click', () => inspThrow(0));
  $('iPut').addEventListener('click', inspPut);
  $('iKeep').addEventListener('click', inspKeep);
  /* (a drag on the view turns it; let go fast, upward, and it is thrown — a little to the side the flick went) */
  cv.addEventListener('pointerdown', e => { if (!insp.on || !e.isPrimary) return; insp.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now(), moved: 0 }; document.body.classList.add('insp-grab'); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* a nicety */ } });
  cv.addEventListener('pointermove', e => {
    const d = insp.drag; if (!insp.on || !d || d.id !== e.pointerId) return;
    const now = performance.now(), dx = e.clientX - d.x, dy = e.clientY - d.y, dtm = Math.max(1, now - d.t);
    d.vx = 0.6 * d.vx + 0.4 * dx / dtm; d.vy = 0.6 * d.vy + 0.4 * dy / dtm; d.x = e.clientX; d.y = e.clientY; d.t = now; d.moved += Math.hypot(dx, dy);
    Engine.inspect.turn(dx, dy);
  });
  const inspUp = e => {
    const d = insp.drag; if (!d || d.id !== e.pointerId) return; insp.drag = null; document.body.classList.remove('insp-grab');
    if (!insp.on) return;
    const fresh = performance.now() - d.t < 90, v = Math.hypot(d.vx, d.vy);
    if (fresh && d.moved > 40 && d.vy < -1.1 && v > 1.3) inspThrow(Math.max(-1, Math.min(1, d.vx / v)) * 0.6);
  };
  cv.addEventListener('pointerup', inspUp); cv.addEventListener('pointercancel', inspUp);
  cv.addEventListener('wheel', e => { if (!insp.on) return; e.preventDefault(); e.stopImmediatePropagation(); Engine.inspect.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false, capture: true });
  addEventListener('keydown', e => {
    if (!insp.on || (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'e' || k === 'backspace') inspPut();
    else if (k === ' ' || k === 'enter' || k === 't') { if (e.target && e.target.closest && e.target.closest('button')) return; inspThrow(0); }
    else if (k === 'b' && insp.info && insp.info.flower) inspKeep();
    else if (k === 'arrowleft' || k === 'a') Engine.inspect.turn(-24, 0);
    else if (k === 'arrowright' || k === 'd') Engine.inspect.turn(24, 0);
    else if (k === 'arrowup' || k === 'w') Engine.inspect.turn(0, -24);
    else if (k === 'arrowdown' || k === 's') Engine.inspect.turn(0, 24);
    else if (k === 'f') return;
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  const WALK_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'];
  addEventListener('keydown', e => {
    if (!wk.on || (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    const k = e.key.toLowerCase();
    if (k === 'e' || k === 'escape') { stopWalk(); e.preventDefault(); return; }
    if (k === 'f' && !e.repeat) { tch.user = !torchWanted(); syncTorchBtn(); e.preventDefault(); return; }
    if (WALK_KEYS.includes(k)) { keys.add(k); e.preventDefault(); }
  });
  /* ── finds: small things to discover, kept in this browser ── */
  const FINDS = [
    ['roadtrip_start', 'Keys in the ignition', 'took the van out'], ['roadtrip', 'Down the beach', 'drove 120 metres of sand'],
    ['headland', 'Round the point', 'drove past the rocks at the end of the bay'], ['far', 'Over the horizon', 'drove a kilometre down the coast'], ['shallows', 'Wet wheels', 'drove through the shallows'],
    ['big_wave', 'Make a wave', 'stacked clicks into one big swell'], ['tide', 'The tide took the camp', 'sent a wave all the way to the fire'],
    ['lights_out', 'Lights out', 'knocked over a light pole'], ['fire_out', 'Too close to the fire', 'drove into the campfire'],
    ['dont_break', 'Bull in a china shop', 'knocked five things over'], ['reader', 'Read the room', 'opened every chapter'],
    ['lantern', 'Make a wish', 'let a sky lantern go'], ['pitch', 'Home is where you park it', 'pitched camp somewhere new'], ['storm', 'Weathered it', 'called up a thunderstorm'], ['night', 'Night owl', 'stayed three minutes under the stars'], ['artist', 'Left your mark', 'put a drawing in the toolbox'], ['bouquet', 'Say it with flowers', 'picked a bouquet of twelve'], ['naturalist', 'Naturalist', 'held five kinds of shore life up close'], ['crab_home', 'Back you go', 'threw a ghost crab back into the sea']];
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
  let ready = false, drawn = 0;
  /* the cove is built only once the loader (loader.js) has been on screen for a frame: its animation then belongs to
     the compositor, and keeps moving while this thread spends a few seconds building geometry. The shaders are
     compiled next, in the background, and the loader stays until the first frames have been drawn */
  const afterPaint = fn => { let go = false; const run = () => { if (!go) { go = true; setTimeout(fn, 0); } }; requestAnimationFrame(() => requestAnimationFrame(run)); setTimeout(run, document.hidden ? 0 : 3000); };
  afterPaint(() => {
    try { Engine.init(cv, { shadowSize: window.__coveShadow || 2048, decalPPM: 40 }); ready = true; buildObstacles(); van0 = Engine.vanPose(); }
    catch (e) { introFailed(); console.error(e); return; }
    /* print the menu card with the résumé's own words once the page fonts are ready */
    const printCovers = () => { Engine.books.journal.paintCover(c => Paint.journalCover(c, { title: 'Build notes', name: Content.name })); try { Engine.paintClip(doc('stack').canvases[0]); } catch (e) { /* the list prints when it is first opened */ } };
    printCovers();
    if (document.fonts && document.fonts.load) Promise.all(['500 70px Fraunces', 'italic 400 25px Fraunces', '600 25px Fraunces', '500 21px "JetBrains Mono"', '600 40px Caveat', '700 40px Caveat'].map(f => document.fonts.load(f))).then(() => { rd.docs = {}; printCovers(); }, () => {});
    /* (nothing may keep the door shut: a warm-up that never finishes, or frames that fail to draw, give way in time) */
    Promise.race([Engine.warm(), new Promise(r => setTimeout(r, 20000))]).catch(() => {}).then(() => { requestAnimationFrame(frame); setTimeout(() => { if (!st.shown) introReady(); }, 30000); });
  });
  /* the first frames are on screen: the loader gives way to the card, over the live cove; once it has faded, its
     animations stop (typeof, as the loader is a page-level const, not a property of window) */
  const loaderOff = () => setTimeout(() => { if (typeof Loader !== 'undefined') Loader.stop(); }, 1400);
  function introReady() {
    st.shown = true; skyTick = 0;
    try { syncBouquet(false); } catch (e) { /* (the bouquet waits for the next pick) */ }
    $('enterSound').disabled = false; $('enterQuiet').disabled = false;
    $('intro').classList.add('ready'); loaderOff();
  }
  function introFailed() { $('intro').classList.add('ready', 'failed'); loaderOff(); }
  function enter(withSound) {
    if (st.entered) return;
    st.entered = true; document.body.classList.add('entered', 'entering'); $('intro').classList.add('gone');
    if (withSound) startSound();
    /* once it has faded, the veil goes altogether (its blur is a full-screen pass every frame) */
    setTimeout(() => { $('intro').hidden = true; document.body.classList.remove('entering'); }, 1700);
    setTimeout(() => { if (!st.hintGone) $('hint').style.opacity = 1; }, 2500);
  }
  $('enterSound').addEventListener('click', () => enter(true));
  $('enterQuiet').addEventListener('click', () => enter(false));

  /* the render-scale ladder the frame rate is kept comfortable on (see the end of frame) */
  const RS = [0.55, 0.62, 0.7, 0.78, 0.87, 1];
  Object.assign(st, { rsI: RS.length - 1, rsSlow: 0, rsQuick: 0, rsJudged: 0, rsAt: 0 });

  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const lerpCam = (a, b, t) => ({ pos: a.pos.map((v, i) => v + (b.pos[i] - v) * t), look: a.look.map((v, i) => v + (b.look[i] - v) * t), fov: a.fov + (b.fov - a.fov) * t, focus: (a.focus || 25) + ((b.focus || 25) - (a.focus || 25)) * t });
  /* the same, but the eyes turn (by yaw and pitch, the short way round) rather than their look point sliding: for walking
     up to a seat and turning round to sit in it */
  function swingCam(a, b, t) {
    const dir = c => { const d = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]], l = Math.hypot(...d) || 1; return { yaw: Math.atan2(d[0], -d[2]), pitch: Math.asin(Math.max(-1, Math.min(1, d[1] / l))), l }; };
    const A = dir(a), B = dir(b), yaw = A.yaw + wrapA(B.yaw - A.yaw) * t, pitch = A.pitch + (B.pitch - A.pitch) * t, l = A.l + (B.l - A.l) * t, cp = Math.cos(pitch);
    const pos = a.pos.map((v, i) => v + (b.pos[i] - v) * t);
    return { pos, look: [pos[0] + Math.sin(yaw) * cp * l, pos[1] + Math.sin(pitch) * l, pos[2] - Math.cos(yaw) * cp * l], fov: a.fov + (b.fov - a.fov) * t, focus: (a.focus || 25) + ((b.focus || 25) - (a.focus || 25)) * t };
  }

  /* (filming: the film maker stops the page's own frames and steps the scene itself, one exact frame at a time) */
  const film = { on: false, dt: 0 };
  function filmStep(dt) { film.dt = dt; frame((st.last || performance.now()) + dt * 1000, true); film.dt = 0; }
  function frame(now, stepped) {
    if (!stepped) { if (window.__coveFilm) { film.on = true; return; } requestAnimationFrame(frame); }
    if (!ready) return;
    const dtR = film.dt ? film.dt : st.last ? Math.min(window.__coveDtCap || 0.1, (now - st.last) / 1000) : 1 / 60; st.last = now;   /* (the test bench raises the cap: software GL draws a frame every few seconds) */
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
      /* the bottle in your hands: focus follows it as it comes up, then eases on to the letter */
      if (rd.cfg.origin === 'bottle' && st.to) {
        const bd = Engine.bottle.dist(), want = bd != null ? bd : st.to.focus;
        rd.focus = rd.focus == null ? (bd != null ? want : st.to.focus) : rd.focus + (want - rd.focus) * (1 - Math.exp(-dtR * 5));
        st.to = Object.assign({}, st.to, { focus: rd.focus });
      }
    }
    if (rd.on && rd.cfg.kind === 'book') {
      const tv = bookView(), a = rd.cam ? 1 - Math.exp(-dtR * 4) : 1;
      rd.cam = rd.cam ? lerpCam(rd.cam, tv, a) : tv; st.to = rd.cam;
    }
    let cam = !st.to || (st.to === orbC && st.camT >= 1) ? orbC : (st.to.swing ? swingCam : lerpCam)(st.from, st.to, ease(st.camT));
    /* walking up to a seat: a step's bob */
    if (seat.on && seat.approach && seat.approach.stage === 1 && seat.approach.walk && !reduced) { const d = ease(st.camT) * seat.approach.dist; cam = Object.assign({}, cam, { pos: cam.pos.slice() }); cam.pos[1] -= 0.028 * (0.5 - 0.5 * Math.cos(2 * Math.PI * d / 0.72)); }
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
    if (wk.on) { hoverLook(dtR); stepWalk(dtR); } else hov.x = hov.y = 0;
    if (wk.camK > 0) { const e = ease(wk.camK); cam = e >= 1 ? wk.cam : lerpCam(cam, wk.cam, e); }
    if (window.__coveCamFix) cam = window.__coveCamFix;     /* (the test bench can put the camera anywhere) */
    st.camFinal = cam;
    if (sound.amb) sound.amb.engine(car.on, Math.min(1, Math.abs(car.v) / 14), drv ? drv.thr : 0, Math.min(1, Math.abs(car.v) / 8));
    const aspect = view.w / view.h;
    if (aspect < 1.2 && !rd.on) cam = Object.assign({}, cam, { fov: Math.min(80, cam.fov * (1 + (1.2 - aspect) * 0.75)) });
    const wideScreen = view.w > 900;
    const shiftX = st.chapter && !rd.on && wideScreen ? 0.17 : 0;

    /* lights: auto by the sun, or forced */
    const wxf = stepWeather(dtR), W = st.wx;
    const S0 = st.S, want = st.lightsMode === 'on' ? 1 : st.lightsMode === 'off' ? 0 : (S0 && S0.lightsAuto ? 1 : 0);
    const towards = (v, tgt, rate) => v + Math.max(-rate, Math.min(rate, tgt - v));
    const q = st.lightsQuick ? 3.5 : 1;   /* switched by hand: answer within a moment, not over seconds */
    st.L.string = towards(st.L.string, want, dtR * q / 2.6); st.L.lantern = towards(st.L.lantern, want, dtR * q / 1.4);
    st.L.van = towards(st.L.van, want, dtR * q / 1.2); st.L.fairy = towards(st.L.fairy, want, dtR * q / 1.6);
    if (st.lightsQuick && Math.abs(st.L.string - want) < 0.01) st.lightsQuick = 0;
    const Ls = Object.assign({}, st.L);
    const night = S0 ? S0.night : 1;
    /* the fire is lit from golden hour to sunrise and left to smoulder by day; crickets after dark, birds at dawn and by day */
    const sAlt = S0 ? S0.sAlt : -20, smf = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const morning = new Date(ms).getHours() < 12;
    const tod = { fire: 1 - smf(-1, 7, sAlt), crickets: 1 - smf(-9, -2, sAlt), birds: smf(-11, -3, sAlt) * (morning ? 1 : 0.55) * (1 - 0.45 * smf(20, 45, sAlt)), gulls: smf(1, 10, sAlt), owl: 1 - smf(-14, -8, sAlt) };

    const t0 = performance.now();
    st.readK = Math.max(0, Math.min(1, (st.readK || 0) + (rd.on || sketch.on ? dtR / 1.5 : -dtR / 1.0)));
    /* the clouds keep their own clock: it runs with the scene, and moving the time of day moves them on too. It counts
       from the first frame's time, never wrapping (a wrap at each midnight made them jump; small numbers keep the
       shader's sums precise) */
    if (st.ms0 == null) st.ms0 = ms;
    const cloudT = st.t + (ms - st.ms0) / 60000 * 6;
    const fade = stepPitch();
    const torchO = torchState(dtR); if (wk.on && (st.frameN = (st.frameN || 0) + 1) % 20 === 0) syncTorchBtn();
    if (window.__coveInspStep) window.__coveInspT = (window.__coveInspT || 0) + window.__coveInspStep;
    const S = Engine.render({ ms, loc, t: st.t, waveT: st.t, cloudT, buildMs: window.__coveBuildMs, torch: torchO, cloudQ: st.rs < 0.75 ? 0.7 : 1, dens: st.dens, cam, shiftX, msaa: 0, fade, renderScale: Math.min(window.__coveMaxRS || 1, rd.on || sketch.on ? Math.max(st.rs, 0.9) : st.rs), soft: st.soft * (1 - 0.8 * st.readK), read: st.readK,
      lights: Ls, fire: { i: tod.fire * (1 - 0.6 * W.rain), smoke: (0.3 + 0.7 * tod.fire) * (1 + 0.6 * W.rain), steam: tod.fire }, flies: 1 - W.rain,
      sky: { cirrus: W.cirrus, alto: W.alto, cumulus: W.cumulus, stratus: W.stratus, storm: W.storm, flash: wxf.flash, bolt: wxf.bolt }, rain: W.rain, wet: W.wet, rough: W.storm * 0.8 + W.rain * 0.3, wind: 1 + 1.6 * W.storm + 0.5 * W.rain, rainSlant: 0.1 + 0.3 * W.storm, expMul: 1 + 1.4 * wxf.flash * W.storm });
    st.S = S;
    if (!st.shown && ++drawn >= 3) introReady();
    updateSky(ms, S);
    syncLightsUI();

    /* hotspots follow their objects (a wave or the van can move them), and go while one lies knocked over */
    anchors = Engine.anchors();
    /* pins: a glint on each object, hidden while something is open */
    Content.chapters.forEach(c => { const a = c.anchor === 'clipboard' ? (Engine.anchorNow('clipboard') || anchors.clipboard) : anchors[c.anchor];
      const p = Engine.project(a), el = c.spot, vis = !rd.on && !car.on && pinNear(a) && !Engine.pitching && !Engine.knocked(c.id) && p[2] < 1 && p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.1 && p[1] < 0.97;
      el.style.transform = `translate(${(view.x + p[0] * view.w).toFixed(1)}px, ${(view.y + p[1] * view.h).toFixed(1)}px)`; el.style.visibility = vis ? 'visible' : 'hidden'; });

    extras(dtR);
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
      sound.thunder = sound.thunder.filter(th => th.t > ctx.currentTime - 2);
      sound.amb.schedule(ctx.currentTime + 0.6, { night, crickets: tod.crickets * (1 - 0.8 * W.rain), birds: tod.birds * (1 - W.rain), gulls: tod.gulls * (1 - W.rain), owl: tod.owl * (1 - W.rain), fireI: tod.fire * (1 - 0.6 * W.rain) * (ss.fireOut == null ? 1 : 0), waves, douse: sound.douse, place: hearing(cam), rain: W.rain, thunder: sound.thunder });
    }

    /* keep the frame rate comfortable. A change of resolution remakes every render target and shows, so it is rare
       and small: judged every two seconds on the median frame (one slow frame is not a trend), one rung of the ladder
       at a time, down only after two slow verdicts running and up only after three quick ones, never soon after
       the last change */
    const ft = performance.now() - t0, tn = performance.now(); st.fms.push(ft); if (st.fms.length > 120) st.fms.shift();
    if (tn - st.rsJudged >= 2000 && st.fms.length >= 20) {
      const w = st.fms.slice(-90).sort((a, b) => a - b), med = w[w.length >> 1];
      st.rsJudged = tn; st.rsSlow = med > 32 ? st.rsSlow + 1 : 0; st.rsQuick = med < 15 ? st.rsQuick + 1 : 0;
      if (st.rsSlow >= 2 && st.rsI > 0 && tn - st.rsAt > 4000) { st.rsI--; st.rsAt = tn; st.rsSlow = 0; }
      else if (st.rsQuick >= 3 && st.rsI < RS.length - 1 && tn - st.rsAt > 10000) { st.rsI++; st.rsAt = tn; st.rsQuick = 0; }
      st.rs = RS[st.rsI];
    }
  }
  /* ── wishes: a sky lantern carries one up, and it is pinned to the board by the fire for everyone to read.
     The server keeps them (server.js). Opened from a file, or anywhere without that server, they stay in this
     browser instead, marked as kept only on this device ── */
  const isWeb = location.protocol === 'http:' || location.protocol === 'https:', WISH_LEN = 160;
  const wish = { mode: isWeb ? 'try' : 'local', list: [], total: 0, polled: 0, look: 0, started: false, sending: false, key: '', mine: new Set(store.get('wishMine', [])) };
  const hashOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* the same tidying the server does: one kind of space, nothing invisible, nothing that flips the text's direction */
  const tidy = (s, n) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g, '').replace(/ {2,}/g, ' ').trim().slice(0, n);
  const isoOf = at => { const d = new Date(at); return isNaN(d) ? '' : d.toISOString(); };
  /* when a wish was made, to the second: short on the board, with the weekday in the list */
  const SHORT = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }, LONG = Object.assign({ weekday: 'long' }, SHORT, { month: 'long' });
  const whenOf = (at, long) => { const d = new Date(at); if (isNaN(d)) return ''; try { return d.toLocaleString(undefined, long ? LONG : SHORT); } catch (e) { return d.toISOString().replace('T', ' ').slice(0, 19); } };
  const asWish = w => w && typeof w.text === 'string' && w.at && isoOf(w.at) ? { id: String(w.id || w.at), text: tidy(w.text, WISH_LEN), name: tidy(w.name, 32), at: w.at, local: !!w.local } : null;
  const localWishes = () => { const a = store.get('wishes', []); return (Array.isArray(a) ? a : []).map(asWish).filter(Boolean); };

  /* the newest wishes from the server; false where there is no board to ask */
  async function fetchWishes(limit = 60) {
    if (!isWeb) return false;
    try {
      const r = await fetch(`/api/wishes?limit=${limit}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const j = r.ok && /json/.test(r.headers.get('content-type') || '') ? await r.json() : null;
      if (!j || !Array.isArray(j.wishes)) throw new Error('no wish board here');
      wish.mode = 'server'; wish.list = j.wishes.map(asWish).filter(Boolean); wish.total = Math.max(+j.total || 0, wish.list.length); wish.polled = Date.now();
      return true;
    } catch (e) {
      if (wish.mode !== 'server') { wish.mode = 'local'; wish.list = localWishes(); wish.total = wish.list.length; }
      return false;
    }
  }
  /* send a wish. A refusal comes back in the server's own kind words; with no server at all, it is kept here */
  async function sendWish(text, name) {
    if (isWeb) {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
      try {
        const r = await fetch('/api/wishes', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ text, name }), cache: 'no-store', signal: ctl.signal });
        const j = /json/.test(r.headers.get('content-type') || '') ? await r.json().catch(() => null) : null;
        if (r.ok && j && j.wish && asWish(j.wish)) { wish.mode = 'server'; return { wish: asWish(j.wish), total: j.total }; }
        if (j && j.error) return { error: String(j.error) };
        if (wish.mode === 'server') return { error: 'The board couldn’t take your wish just now. Try again in a moment.' };
      } catch (e) {
        if (wish.mode === 'server') return { error: 'Couldn’t reach the board just now. Check your connection and try again.' };
      } finally { clearTimeout(to); }
    }
    const w = { id: 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), text, name, at: new Date().toISOString(), local: true };
    store.set('wishes', [w, ...localWishes()].slice(0, 300));
    if (wish.mode !== 'local') { wish.mode = 'local'; wish.list = localWishes().filter(x => x.id !== w.id); }
    return { wish: w, local: true };
  }
  /* paint the board's newest nine (only when something on it changed: it is a big canvas) */
  function paintBoard() {
    if (!ready) return;
    const local = wish.mode === 'local', shown = wish.list.slice(0, 9), key = (local ? 'l' : 's') + wish.total + '|' + shown.map(w => w.id).join(',');
    if (key === wish.key) return; wish.key = key;
    const notes = shown.map(w => ({ id: w.id, text: w.text, name: w.name || 'a stranger', when: whenOf(w.at), local: local || w.local }));
    Engine.paintBoard(c => Paint.wishBoard(c, notes, { total: wish.total, local }));
  }
  /* every wish in the drawer, newest first, with its full date and time */
  function renderWishList() {
    const d = $('drawer'), local = wish.mode === 'local', n = local ? wish.list.length : Math.max(wish.total, wish.list.length), top = d.scrollTop;
    const head = `<p class="wsum">${n ? `${n} ${n === 1 ? 'wish' : 'wishes'}, the newest first.` : 'No wishes yet.'} ${local ? 'They are kept only on this device: opened like this, the cove has no board to share them on.' : 'Everyone who visits the cove can read them.'}</p><button type="button" class="wmake" data-wish-make>Make a wish</button>`;
    const items = wish.list.map(w => { const mine = wish.mine.has(w.id);
      return `<li><p class="wt">${esc(w.text)}</p><p class="wm"><span class="wn">— ${esc(w.name || 'a stranger')}</span>${mine ? '<em class="yours">yours</em>' : ''}${local || w.local ? '<em>only on this device</em>' : ''}<time datetime="${esc(isoOf(w.at))}">${esc(whenOf(w.at, true))}</time></p></li>`; }).join('');
    $('dBody').innerHTML = head + (items ? `<ol class="wlist">${items}</ol>` : '') + (wish.list.length < n ? `<p class="wsum">The newest ${wish.list.length} are shown here.</p>` : '');
    d.scrollTop = top;
  }
  $('dBody').addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-wish-make]')) openWish(); });
  /* the camera in front of the board: square on, the board centred in the room the drawer leaves (beside it on a wide
     screen, where the frame is already shifted for it; above it on a phone) and far enough back to fit there */
  Object.defineProperty(V, 'board', { enumerable: true, get() {
    if (!ready) return V.wide;
    const f = Engine.boardFrame(), c = f.c, n = f.n, r = [n[2], 0, -n[0]], aspect = view.w / view.h, fov = 38, W = f.W + 0.3;   /* (the frame and the posts too) */
    const tf = Math.tan((aspect < 1.2 ? Math.min(80, fov * (1 + (1.2 - aspect) * 0.75)) : fov) * Math.PI / 360);
    let d, side = 0, up = 0;
    if (view.w > 900) {
      const free = Math.max(240, view.w - 472);                   /* the drawer: 440 px wide, 22 px in from the right */
      d = Math.max(f.H * 1.3 / (2 * tf), W * view.w / (2 * free * 0.92 * tf * aspect));
      side = -((free / 2) / view.w - 0.33) * 2 * tf * aspect * d;  /* (the frame's 0.17 shift puts the view's middle a third of the way across) */
    } else { d = Math.max(f.H / (0.8 * tf), W / (1.8 * tf * aspect)); up = 0.5 * tf * d; }
    const o = i => c[i] + r[i] * side;
    return { pos: [o(0) + n[0] * d, c[1] + 0.08, o(2) + n[2] * d], look: [o(0), c[1] - 0.02 - up, o(2)], fov, focus: d };
  } });
  /* the wishes open like a chapter: the camera goes to the board and the drawer lists them all */
  function openWishes() {
    if (!ready || !st.entered || isDown('board')) return;
    if (seat.on) leaveSeat();
    if (rd.on) stopReading(true);
    if (car.on) stopDrive();
    toggleSettings(false);
    if (wk.on) stopWalk();
    st.chapter = 'wishes';
    dock.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', 'false'));
    Content.chapters.forEach(x => { x.spot.classList.remove('on'); x.spot.classList.add('dim'); });
    document.body.classList.add('reading');
    const d = $('drawer'); d.classList.remove('menu-mode'); d.classList.add('wishes-mode');
    $('dEyebrow').textContent = 'By the fire'; $('dTitle').textContent = 'Wishes'; renderWishList(); d.hidden = false; d.scrollTop = 0;
    goView('board');
    if (wish.mode !== 'local') fetchWishes(2000).then(ok => { if (!ok) return; paintBoard(); if (st.chapter === 'wishes') renderWishList(); });
  }
  function startWishes() {
    wish.started = true;
    if (wish.mode === 'local') { wish.list = localWishes(); wish.total = wish.list.length; }
    paintBoard();
    fetchWishes(60).then(() => { paintBoard(); if (st.chapter === 'wishes') renderWishList(); });
    /* the notes are written in Caveat and JetBrains Mono: once those are in, paint the board again */
    if (document.fonts && document.fonts.load) Promise.all(['600 40px Caveat', '700 40px Caveat', '500 30px Caveat', '400 17px "JetBrains Mono"'].map(f => document.fonts.load(f))).then(() => { wish.key = ''; paintBoard(); }, () => {});
    /* new wishes from other visitors: look every minute and a half while the page is open */
    setInterval(pollWishes, 90e3);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - wish.polled > 90e3) pollWishes(); });
  }
  function pollWishes() {
    if (wish.mode !== 'server' || document.hidden) return;
    fetchWishes(st.chapter === 'wishes' ? 2000 : 60).then(ok => { if (!ok) return; paintBoard(); if (st.chapter === 'wishes') renderWishList(); });
  }

  /* the dialog: what do you wish for? Then the lantern goes up with it */
  let wishFrom = null;
  $('wName').value = store.get('wishName', '');
  function openWish() {
    if (!ready || !$('wish').hidden) return;
    toggleSettings(false);
    wishFrom = document.activeElement;
    $('wErr').hidden = true; $('wGo').disabled = false; $('wGo').textContent = 'Let it go'; syncCount();
    $('wishVeil').hidden = false; $('wish').hidden = false;
    setTimeout(() => $('wText').focus(), 30);
  }
  function closeWish() {
    $('wish').hidden = true; $('wishVeil').hidden = true;
    if (wishFrom && wishFrom.focus) { try { wishFrom.focus(); } catch (e) { /* it may be gone */ } }
    wishFrom = null;
  }
  function syncCount() { const n = $('wText').value.length, c = $('wCount'); c.textContent = `${n} / ${WISH_LEN}`; c.classList.toggle('near', n >= WISH_LEN - 20 && n < WISH_LEN); c.classList.toggle('full', n >= WISH_LEN); }
  $('wText').addEventListener('input', () => { syncCount(); $('wErr').hidden = true; });
  $('wText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); letGo(); } });
  $('wCancel').addEventListener('click', closeWish);
  $('wishVeil').addEventListener('click', closeWish);
  $('wForm').addEventListener('submit', e => { e.preventDefault(); letGo(); });
  /* keys typed in the dialog are the dialog's (not the reader's, the van's or the beach's), and Tab stays inside it */
  $('wish').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key !== 'Tab') return;
    const f = [...$('wish').querySelectorAll('textarea, input, button')].filter(x => !x.disabled), i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
  });
  const release = () => { Engine.lantern(); unlock('lantern'); };
  async function letGo() {
    if (wish.sending) return;
    const text = tidy($('wText').value, WISH_LEN), name = tidy($('wName').value, 32), err = $('wErr');
    store.set('wishName', name);
    /* no words: the lantern still goes, carrying a wish nobody else needs to read */
    if (!text) { closeWish(); release(); toast('The lantern rises, carrying a wish only you know.', false, 3600); return; }
    wish.sending = true; $('wGo').disabled = true; $('wGo').textContent = 'Letting go…'; err.hidden = true;
    let res; try { res = await sendWish(text, name); } catch (e) { res = { error: 'Something went wrong. Try again in a moment.' }; }
    wish.sending = false; $('wGo').disabled = false; $('wGo').textContent = 'Let it go';
    if (!res.wish) { err.textContent = res.error || 'Something went wrong. Try again in a moment.'; err.hidden = false; return; }
    const w = res.wish;
    wish.list = [w, ...wish.list.filter(x => x.id !== w.id)];
    wish.total = res.local ? wish.list.length : Math.max(+res.total || 0, wish.total + 1);
    wish.mine.add(w.id); store.set('wishMine', [...wish.mine].slice(-200));
    $('wText').value = ''; syncCount(); closeWish(); release(); paintBoard();
    if (st.chapter === 'wishes') renderWishList();
    toast(res.local ? 'Your lantern rises, and your wish is pinned to the board by the fire (kept only on this device).' : 'Your lantern rises, and your wish is pinned to the board by the fire.', false, 4200);
  }

  /* ── sitting: in either chair by the fire, on the driftwood log, or on a cushion at the picnic table. You sit down
     into it (the eyes come down from standing height and settle), breathe a little, and can look round as far as a
     seated person turns their head. ‹ › moves you to the next seat (up, across, and down again); in a chair, Q and E turn
     it. Esc or Stand up gets you up ── */
  const seat = { on: false, i: 0, yaw: 0, pitch: 0, yawT: 0, pitchT: 0, drag: null, hintT: 0, sitAt: 0, pose: null,
    turn: (store.get('chairTurn', [0, 0]) || [0, 0]).map(v => clamp(+v || 0, -1.4, 1.4)), turnT: null };
  seat.turnT = seat.turn.slice();
  const easeOut3 = u => 1 - Math.pow(1 - u, 3);
  function seatCam() {
    const P = Engine.seatPose(seat.i); if (!P) return V.wide;
    seat.pose = P;
    /* sitting down: the eyes come down from standing height, a little forward of the seat, and settle */
    const u = clamp((performance.now() - seat.sitAt) / 800, 0, 1), k = easeOut3(u), drop = 0.56 * (1 - k) - 0.014 * Math.sin(Math.PI * u) * (1 - u), fwd = 0.2 * (1 - k);
    const breathe = reduced ? 0 : 0.0035 * Math.sin(performance.now() / 1000 * 1.55);
    const yaw0 = P.yaw, e = [P.eye[0] + Math.sin(yaw0) * fwd, P.eye[1] + drop + breathe, P.eye[2] - Math.cos(yaw0) * fwd];
    const yaw = yaw0 + seat.yaw, pitch = P.pitch + seat.pitch - 0.08 * (1 - k), cp = Math.cos(pitch) * 8;
    return { pos: e, look: [e[0] + Math.sin(yaw) * cp, e[1] + Math.sin(pitch) * 8, e[2] - Math.cos(yaw) * cp], fov: P.kind === 'rug' ? 54 : 58, focus: P.kind === 'rug' ? 1.2 : 2.6, swing: true };
  }
  /* where you stand before you sit: just in front of a chair or the log, looking at it; just behind a cushion, looking
     over the table */
  function standCam(P) {
    const fx = Math.sin(P.yaw), fz = -Math.cos(P.yaw), off = P.kind === 'rug' ? -0.38 : 0.78, x = P.eye[0] + fx * off, z = P.eye[2] + fz * off;
    const g = Math.max(0, Engine.world ? Engine.world.land(x, z) : 0);
    const look = P.kind === 'rug' ? [P.eye[0] + fx * 1.6, 0.45, P.eye[2] + fz * 1.6] : [P.eye[0] - fx * 0.3, 0.72, P.eye[2] - fz * 0.3];
    return { pos: [x, g + EYE, z], look, fov: 58, focus: 2, swing: true };
  }
  /* walking stops where you are: the eyes go on from there (the explore camera does not come back first) */
  function endWalkHere() {
    if (!wk.on) return;
    wk.on = false; wk.camK = 0; keys.clear(); touch.x = touch.y = 0;
    document.body.classList.remove('walking'); $('walkHud').hidden = true; $('pad').hidden = true; $('bWalk').setAttribute('aria-pressed', 'false');
  }
  /* things a wave has knocked over say so, and offer to put the camp back up */
  const downMsg = { seat: 'That seat is lying in the wet sand. Put the camp back up to sit there again.', radio: 'The radio went over with the table. Put the camp back up to play it.',
    sketch: 'The wave took the drawing board. Put the camp back up to draw.', toolbox: 'The toolbox is lying in the wet sand. Put the camp back up to open it.', board: 'The wish board is down. Put the camp back up to read the wishes.' };
  const isDown = (key, msgKey) => { if (!Engine.knocked || !Engine.knocked(key)) return false; toast(downMsg[msgKey || key], true, 4500); return true; };
  const seatDown = i => { const P = Engine.seatPose(i); return !!(P && Engine.knocked && Engine.knocked(P.id)); };
  function sit(i) {
    if (!ready || !st.entered || car.on || (seat.on && seat.i === i) || !(i >= 0 && i < Engine.seatCount())) return;
    if (seatDown(i)) { toast(downMsg.seat, true, 4500); return; }
    if (rd.on || st.chapter) openChapter(null);
    toggleSettings(false);
    const moving = seat.on, walking = wk.on;
    /* from where the eyes are now: the walker's, the seat you are getting up from, or the explore camera */
    const from = JSON.parse(JSON.stringify(st.camFinal || st.cur || V.wide));
    if (walking) { endWalkHere(); seat.wasWalking = true; } else if (!moving) seat.wasWalking = false;
    if (moving) Engine.seatProps(seat.i, false);
    Object.assign(seat, { on: true, i, yaw: 0, pitch: 0, yawT: 0, pitchT: 0, drag: null, pose: Engine.seatPose(i) });
    Engine.seatProps(i, true);
    /* up (if you were sitting), over to the seat at standing height, walking if you were walking; then round and down */
    const P = Engine.seatPose(i), stand = standCam(P), dist = Math.hypot(from.pos[0] - stand.pos[0], from.pos[1] - stand.pos[1], from.pos[2] - stand.pos[2]);
    st.from = from; st.camT = 0;
    if (dist > 0.35) {
      seat.approach = { stage: 1, stand, dist, walk: walking || moving };
      st.to = stand; st.camDur = clamp(walking || moving ? dist / 1.4 : 0.9 + dist / 9, 0.8, walking || moving ? 7 : 2.4);
      seat.sitAt = Infinity;
    } else { seat.approach = null; st.to = seatCam(); st.camDur = 1.5; seat.sitAt = performance.now() + 1500 * 0.5; }
    document.body.classList.add('seated'); document.body.classList.remove('seat-hint-off'); $('seatHud').hidden = false;
    clearTimeout(seat.hintT); seat.hintT = setTimeout(() => document.body.classList.add('seat-hint-off'), 7000);
    if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; }
    syncSeatUI(); syncRadioUI();
  }
  const seatBy = id => Engine.seatIndex(id);
  function nextSeat(d) { if (!seat.on) return; const n = Engine.seatCount(); let j = seat.i; for (let k = 0; k < n; k++) { j = (j + d + n) % n; if (!seatDown(j)) break; } if (j !== seat.i) sit(j); }
  /* turning the chair you are in: a quarter of a right angle a press, as far as a person would shift it */
  function turnChair(d) {
    const P = seat.pose; if (!seat.on || !P || P.kind !== 'chair') return;
    seat.turnT[P.i] = clamp(seat.turnT[P.i] + d * 0.3, -1.4, 1.4); store.set('chairTurn', seat.turnT);
  }
  /* (every frame: the engine only moves a chair that is not where it should be, so a rebuilt camp gets its turns back) */
  function stepChairs(dt) {
    const a = 1 - Math.exp(-dt * 5);
    for (let i = 0; i < seat.turn.length; i++) { const t = seat.turnT[i]; seat.turn[i] += (t - seat.turn[i]) * a; if (Math.abs(t - seat.turn[i]) < 1e-4) seat.turn[i] = t; Engine.turnChair(i, seat.turn[i]); }
  }
  function syncSeatUI() {
    const P = seat.pose || Engine.seatPose(seat.i), chair = P && P.kind === 'chair', byFire = P && P.near === 'fire';
    $('seatName').textContent = P ? P.name : '';
    $('seatTurn').hidden = !chair;
    $('radio').hidden = !byFire;
    $('seatHint').textContent = (chair ? 'Drag to look around · ‹ › another seat · Q E turn the chair' : 'Drag to look around · ‹ › another seat') + (byFire ? ' · the radio is beside you' : '');
  }
  /* getting up switches the radio off: it is the seat's */
  function leaveSeat() { if (!seat.on) return; Engine.seatProps(seat.i, false); seat.on = false; seat.drag = null; document.body.classList.remove('seated', 'look-drag'); $('seatHud').hidden = true; radioOff(); }
  function standUp() {
    if (!seat.on) return;
    const P = seat.pose, back = seat.wasWalking; leaveSeat();
    if (back && P) {
      /* you walked here: you get up and walk on, from in front of the seat */
      /* (the eyes rise from the seat into the walker's as the walk view blends in) */
      const s = standCam(P); startWalk(); wk.x = s.pos[0]; wk.z = s.pos[2]; wk.h = wk.hT = -P.yaw; wk.hy.v = 0; wk.my = 0; walkCamera();
      return;
    }
    goView('wide');
  }
  $('bStand').addEventListener('click', standUp);
  $('bSeatPrev').addEventListener('click', () => nextSeat(-1)); $('bSeatNext').addEventListener('click', () => nextSeat(1));
  $('bTurnL').addEventListener('click', () => turnChair(1)); $('bTurnR').addEventListener('click', () => turnChair(-1));
  /* looking around: a drag, as far as a seated person turns their head */
  cv.addEventListener('pointerdown', e => { if (seat.on && !sketch.on && e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0)) seat.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: seat.yawT, pitch: seat.pitchT }; });
  addEventListener('pointermove', e => {
    const g = seat.drag; if (!g || g.id !== e.pointerId || !seat.on) return;
    const k = 2.6 / Math.max(500, view.h);
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) document.body.classList.add('look-drag');
    seat.yawT = clamp(g.yaw - (e.clientX - g.x) * k, -1.55, 1.55); seat.pitchT = clamp(g.pitch + (e.clientY - g.y) * k, -0.6, 0.5);
  }, { passive: true });
  const unlook = e => { if (seat.drag && seat.drag.id === e.pointerId) { seat.drag = null; document.body.classList.remove('look-drag'); } };
  addEventListener('pointerup', unlook); addEventListener('pointercancel', unlook);
  /* Esc closes the wish, then gets you up; the arrow keys look around while seated (and don't start the van); [ ] or
     , . change seat; Q E turn the chair */
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!$('wish').hidden) { closeWish(); e.stopPropagation(); e.preventDefault(); return; }
      if (tbox.view >= 0) { tbViewClose(); e.stopPropagation(); e.preventDefault(); return; }
      if (tbox.on) { closeToolbox(); e.stopPropagation(); e.preventDefault(); return; }
      if (sketch.on) { closeSketch(); e.stopPropagation(); e.preventDefault(); return; }
      if (seat.on && $('credits').hidden && $('settings').hidden) { standUp(); e.stopPropagation(); return; }
    }
    if (!seat.on || (e.target && e.target.closest && e.target.closest('input, textarea, select'))) return;
    const k = e.key;
    if (/^Arrow/.test(k)) {
      if (k === 'ArrowLeft' || k === 'ArrowRight') seat.yawT = clamp(seat.yawT + (k === 'ArrowLeft' ? 0.2 : -0.2), -1.55, 1.55);
      else seat.pitchT = clamp(seat.pitchT + (k === 'ArrowUp' ? 0.1 : -0.1), -0.6, 0.5);
    } else if (k === '[' || k === ',') nextSeat(-1);
    else if (k === ']' || k === '.') nextSeat(1);
    else if (k === 'q' || k === 'Q') turnChair(1);
    else if (k === 'e' || k === 'E') turnChair(-1);
    else return;
    e.stopPropagation(); e.preventDefault();
  }, true);

  /* ── the radio on the picnic table: stations from the Radio Browser community directory, or the visitor's own
     songs, played from their device and never uploaded. It is an <audio> of its own, so it plays whether or not
     the cove's sound is on; the bed of waves and crickets steps back a little while it does ── */
  const RB = ['de1.api.radio-browser.info', 'nl1.api.radio-browser.info', 'at1.api.radio-browser.info', 'fi1.api.radio-browser.info'];
  const MIME = { MP3: 'audio/mpeg', AAC: 'audio/aac', 'AAC+': 'audio/aac', OGG: 'audio/ogg', OPUS: 'audio/ogg; codecs=opus' };
  /* Safari lets an <audio> start later (once the station list is in) only if it first played inside the tap */
  const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  const radio = { on: false, src: store.get('radioSrc', 'world') === 'songs' ? 'songs' : 'world', vol: clamp(+store.get('radioVol', 0.7) || 0, 0, 1), state: 'off', msg: '',
    stations: null, host: '', si: 0, dir: 1, fails: 0, songs: [], qi: 0, el: null, ctx: null, noise: null, hiss: null, timer: 0, dial: 0.5, dialT: 0.5, glow: 0, duckFor: null, duckK: 1 };
  const own = el => el.getAttribute('src') && el.getAttribute('src') !== SILENCE;
  function radioEl() {
    if (radio.el) return radio.el;
    const el = radio.el = new Audio(); el.preload = 'none';
    el.addEventListener('playing', () => { if (!radio.on || !own(el)) return; clearTimeout(radio.timer); radio.state = 'playing'; radio.fails = 0; if (radio.src === 'world') radio.msg = ''; hiss(false); syncRadioUI(); });
    el.addEventListener('waiting', () => { if (!radio.on || !own(el) || radio.state !== 'playing') return; radio.state = 'tuning'; syncRadioUI(); clearTimeout(radio.timer); radio.timer = setTimeout(() => { if (radio.on && radio.state === 'tuning') failed(); }, 15000); });
    el.addEventListener('error', () => { if (radio.on && own(el)) failed(); });
    el.addEventListener('ended', () => { if (!radio.on || !own(el)) return; if (radio.src === 'songs') playSong(radio.qi + 1, true); else failed(); });
    return el;
  }
  function radioCtx() {
    if (!radio.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { radio.ctx = new AC(); } catch (e) { return null; } }
    if (radio.ctx.state === 'suspended' && radio.ctx.resume) radio.ctx.resume().catch(() => {});
    return radio.ctx;
  }
  /* between stations: a soft rush of static, rounded off and quiet, until the station comes in (no whistle, no beeps) */
  function hiss(on) {
    const h = radio.hiss;
    if (h) { radio.hiss = null; const t = h.ctx.currentTime; h.g.gain.cancelScheduledValues(t); h.g.gain.setTargetAtTime(0, t, 0.08); try { h.s.stop(t + 0.5); } catch (e) { /* already stopping */ } }
    if (!on) return;
    const ctx = radioCtx(); if (!ctx) return;
    if (!radio.noise) { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); let y = 0; for (let i = 0; i < d.length; i++) { y = 0.7 * y + 0.3 * (Math.random() * 2 - 1); d[i] = y; } radio.noise = b; }
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), v = 0.05 * radio.vol * (radio.heard ?? 1);
    s.buffer = radio.noise; s.loop = true; f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.5;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.12); g.gain.setTargetAtTime(v * 0.5, t + 0.5, 0.4);
    s.connect(f); f.connect(g); g.connect(ctx.destination);
    s.start(t);
    radio.hiss = { ctx, s, g };
  }
  const fetchT = (url, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, { signal: c.signal, cache: 'no-store' }).finally(() => clearTimeout(t)); };
  /* the directory's mirrors: asked for by name (only its own hosts), else the ones it has long had */
  async function rbHosts() {
    let hosts = RB.slice();
    try { const j = await (await fetchT('https://all.api.radio-browser.info/json/servers', 4000)).json(); const names = [...new Set((Array.isArray(j) ? j : []).map(s => s && s.name).filter(n => /^[a-z0-9-]+\.api\.radio-browser\.info$/.test(n || '')))]; if (names.length) hosts = names; } catch (e) { /* the known mirrors will do */ }
    return hosts.sort(() => Math.random() - 0.5);
  }
  /* sixty of the most listened-to stations that stream over HTTPS in something this browser plays (kept for a day) */
  async function stationList() {
    if (radio.stations) return radio.stations;
    const kept = store.get('radioList', null);
    if (kept && Date.now() - kept.t < 864e5 && Array.isArray(kept.list) && kept.list.length) { radio.host = kept.host || ''; return (radio.stations = kept.list); }
    const el = radioEl();
    for (const h of await rbHosts()) {
      try {
        const r = await fetchT(`https://${h}/json/stations/search?order=clickcount&reverse=true&limit=60&hidebroken=true&is_https=true`, 8000); if (!r.ok) continue;
        const j = await r.json(), list = (Array.isArray(j) ? j : []).filter(s => s && /^https:\/\//.test(s.url_resolved || '') && !s.hls && MIME[String(s.codec || '').toUpperCase()] && el.canPlayType(MIME[String(s.codec).toUpperCase()]))
          .map(s => ({ id: String(s.stationuuid || s.url_resolved), name: tidy(s.name, 60) || 'A station', where: tidy(s.country || s.countrycode, 40), codec: String(s.codec).toUpperCase(), url: s.url_resolved }));
        if (!list.length) continue;
        radio.host = h; store.set('radioList', { t: Date.now(), host: h, list });
        return (radio.stations = list);
      } catch (e) { /* the next mirror */ }
    }
    throw new Error('the radio directory is out of reach');
  }
  /* tune to station i: static while it comes in, the needle swinging along the dial; one that won't play is skipped */
  function tune(i, dir = 1, auto = false) {
    const L = radio.stations; if (!L || !L.length || !radio.on) return;
    if (!auto) radio.fails = 0;
    radio.si = ((i % L.length) + L.length) % L.length; radio.dir = dir;
    const s = L[radio.si]; store.set('radioStation', s.id);
    radio.state = 'tuning'; radio.msg = ''; radio.dialT = 0.06 + 0.88 * (hashOf(s.id) % 1000) / 1000;
    hiss(true);
    const el = radioEl(); el.src = s.url; el.volume = clamp(radio.vol * (radio.heard ?? 1), 0, 1);
    clearTimeout(radio.timer); radio.timer = setTimeout(() => { if (radio.on && radio.state === 'tuning') failed(); }, 9000);
    const p = el.play(); if (p && p.catch) p.catch(err => { if (!radio.on || el.getAttribute('src') !== s.url || (err && err.name === 'AbortError')) return; if (err && err.name === 'NotAllowedError') { radioOff(true); radio.msg = 'Press the power button to listen.'; syncRadioUI(); } else failed(); });
    /* the directory counts a listen when a station is played, and asks players to tell it */
    if (radio.host) fetchT(`https://${radio.host}/json/url/${encodeURIComponent(s.id)}`, 5000).catch(() => {});
    mediaInfo(s.name, s.where || 'World radio'); syncRadioUI();
  }
  function failed() {
    if (radio.src === 'songs') {
      const s = radio.songs[radio.qi]; radio.msg = s ? `Couldn’t play “${s.name}” here, so it was skipped.` : '';
      if (++radio.fails >= radio.songs.length) { radioOff(true); radio.msg = 'Couldn’t play those files here. MP3 and M4A files play almost everywhere.'; syncRadioUI(); } else playSong(radio.qi + 1, true);
      return;
    }
    if (++radio.fails >= 6) { radioOff(true); radio.state = 'error'; radio.msg = 'Couldn’t reach the radio just now. Your own songs still play: switch to Your songs.'; syncRadioUI(); return; }
    tune(radio.si + radio.dir, radio.dir, true);
  }
  function playSong(i, auto = false) {
    const Q = radio.songs; if (!Q.length || !radio.on) return;
    if (!auto) { radio.fails = 0; radio.msg = ''; }
    radio.qi = ((i % Q.length) + Q.length) % Q.length; radio.state = 'tuning'; radio.dialT = 0.06 + 0.88 * (radio.qi + 0.5) / Q.length; hiss(false);
    const s = Q[radio.qi], el = radioEl(); el.src = s.url; el.volume = clamp(radio.vol * (radio.heard ?? 1), 0, 1);
    const p = el.play(); if (p && p.catch) p.catch(err => { if (radio.on && el.getAttribute('src') === s.url && !(err && err.name === 'AbortError')) failed(); });
    mediaInfo(s.name, 'Your songs'); syncRadioUI();
  }
  function radioOn() {
    radio.on = true; radio.fails = 0; radio.msg = ''; radioCtx();
    const el = radioEl(); if (!el.dataset.woken) { el.dataset.woken = '1'; if (!el.getAttribute('src')) { el.src = SILENCE; const p = el.play(); if (p && p.catch) p.catch(() => {}); } }
    if (radio.src === 'songs') {
      if (radio.songs.length) playSong(radio.qi);
      else { radio.on = false; radio.msg = 'Pick some songs from your device: they play here and never leave it.'; syncRadioUI(); $('rdFile').click(); }
      return;
    }
    radio.state = 'tuning'; radio.dialT = Math.random(); hiss(true); syncRadioUI();
    stationList().then(L => { if (!radio.on || radio.src !== 'world') return; const k = L.findIndex(s => s.id === store.get('radioStation', '')); tune(k >= 0 ? k : Math.floor(Math.random() * Math.min(20, L.length))); },
      () => { if (!radio.on || radio.src !== 'world') return; radioOff(true); radio.state = 'error'; radio.msg = 'Couldn’t reach the radio just now. Your own songs still play: switch to Your songs.'; syncRadioUI(); });
  }
  function radioOff(keepMsg) {
    radio.on = false; radio.state = 'off'; clearTimeout(radio.timer); hiss(false);
    const el = radio.el; if (el && el.getAttribute('src')) { el.pause(); el.removeAttribute('src'); try { el.load(); } catch (e) { /* nothing to let go of */ } }
    if (!keepMsg) radio.msg = '';
    mediaInfo(null); syncRadioUI();
  }
  const radioToggle = () => { if (!radio.on && isDown('radio')) return; radio.on ? radioOff() : radioOn(); };
  /* the radio itself, clicked in the scene: from anywhere, it sits you down by the fire with it on */
  function radioClick() { const P = seat.on && Engine.seatPose(seat.i); if (!P || P.near !== 'fire') { sit(seatBy('chair1')); if (!radio.on) radioOn(); } else radioToggle(); }
  function step(d) { if (!radio.on) return; radio.msg = ''; if (radio.src === 'songs') playSong(radio.qi + d); else if (radio.stations) tune(radio.si + d, d); }
  function setSource(s, start = true) {
    if (s === radio.src) { if (start && s === 'songs' && !radio.songs.length) $('rdFile').click(); return; }
    const was = radio.on; if (was) radioOff();
    radio.src = s; store.set('radioSrc', s); radio.msg = '';
    if (start && s === 'songs' && !radio.songs.length) { syncRadioUI(); $('rdFile').click(); return; }
    if (was && start) radioOn(); else syncRadioUI();
  }
  /* your songs: picked from this device, played from object URLs in this tab, never sent anywhere */
  $('rdFile').addEventListener('change', e => {
    const fs = [...(e.target.files || [])].filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(f.name)); e.target.value = '';
    if (!fs.length) return;
    const first = radio.songs.length;
    for (const f of fs) radio.songs.push({ name: tidy(f.name.replace(/\.[^.]+$/, ''), 80) || 'A song', url: URL.createObjectURL(f) });
    setSource('songs', false); radio.on = true; radioCtx(); playSong(first);
  });
  $('rdPower').addEventListener('click', radioToggle);
  $('rdPrev').addEventListener('click', () => step(-1)); $('rdNext').addEventListener('click', () => step(1));
  $('rdAdd').addEventListener('click', () => $('rdFile').click());
  document.querySelectorAll('[data-rsrc]').forEach(b => b.addEventListener('click', () => setSource(b.dataset.rsrc)));
  $('rdVol').value = radio.vol;
  $('rdVol').addEventListener('input', e => { radio.vol = clamp(+e.target.value, 0, 1); store.set('radioVol', radio.vol); if (radio.el) radio.el.volume = clamp(radio.vol * (radio.heard ?? 1), 0, 1); });
  $('radio').addEventListener('keydown', e => e.stopPropagation());
  function syncRadioUI() {
    const on = radio.on, songs = radio.src === 'songs', s = songs ? radio.songs[radio.qi] : radio.stations && radio.stations[radio.si], n = radio.songs.length;
    let name = 'The radio', sub = songs ? (n ? `${n} ${n === 1 ? 'song' : 'songs'} from this device · off` : 'Songs from your device') : 'World radio · off';
    if (on && !s) { name = 'Tuning in…'; sub = 'World radio'; }
    else if (on) { name = s.name; sub = songs ? `Your songs · ${radio.qi + 1} of ${n}` : [s.where, s.codec].filter(Boolean).join(' · ') || 'World radio'; if (radio.state === 'tuning') sub = (songs ? 'Starting · ' : 'Tuning · ') + sub; }
    $('rdPower').setAttribute('aria-pressed', String(on));
    document.querySelectorAll('[data-rsrc]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.rsrc === radio.src)));
    $('rdName').textContent = name; $('rdSub').textContent = sub; $('rdMsg').textContent = radio.msg;
    $('rdPrev').disabled = $('rdNext').disabled = !on || (songs ? n < 2 : !radio.stations);
    $('rdAdd').hidden = !songs; $('rdAdd').textContent = n ? 'Add more songs' : 'Add songs from this device';
  }
  /* the system's media keys and notification follow the radio */
  function mediaInfo(title, artist) {
    const m = navigator.mediaSession; if (!m) return;
    try { m.metadata = title && window.MediaMetadata ? new MediaMetadata({ title, artist, album: Content.site }) : null; m.playbackState = title ? 'playing' : 'none'; } catch (e) { /* not everywhere */ }
  }
  if (navigator.mediaSession) for (const [a, fn] of [['play', () => { if (seat.on) radioOn(); }], ['pause', () => radioOff()], ['stop', () => radioOff()], ['nexttrack', () => step(1)], ['previoustrack', () => step(-1)]]) { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* not everywhere */ } }
  syncRadioUI();

  /* ── clicks on things in the scene: a chair sits you in it, the radio sits you down and plays, the board opens the
     wishes. Heard before the canvas's own handlers: a click that lands on one of them is theirs, not the sea's ── */
  let pdown = null, hoverT = 0;
  const pickAt = e => { const r = cv.getBoundingClientRect(); return Engine.pick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  cv.addEventListener('pointerdown', e => { pdown = e.isPrimary ? { x: e.clientX, y: e.clientY } : null; });
  addEventListener('pointerup', e => {
    const d = pdown; pdown = null;
    if (!d || e.target !== cv || !ready || !st.entered || rd.on || car.on || sketch.on || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
    if (insp.on) { down = null; return; }
    const hit = pickAt(e);
    if (!hit) {
      /* one of the small lives near where it was touched (a crab, a shell, a flower …): picked up and held */
      const r = cv.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
      const c = Engine.inspect.pick(nx, ny);
      if (c && openInspect(c)) { down = null; return; }
      /* a wild flower near where it was touched: picked into the bouquet */
      const f = Engine.pickFlower(nx, ny);
      if (f) { down = null; pickFlower(f); }
      return;
    }
    down = null;                    /* (the sea's click handler, next in line, now has nothing to do) */
    if (hit === 'radio') radioClick(); else if (hit === 'board') openWishes(); else if (hit === 'sketch') openSketch(); else if (hit === 'toolbox') openToolbox(); else if (seatBy(hit) >= 0) sit(seatBy(hit));
  }, true);
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const now = performance.now(); if (now - hoverT < 80) return; hoverT = now;
    let hit = ready && st.entered && !rd.on && !car.on && !insp.on ? pickAt(e) : null;
    if (!hit && ready && st.entered && !rd.on && !car.on && !insp.on && !sketch.on) { const r = cv.getBoundingClientRect(); if (Engine.inspect.pick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)) hit = 'life'; }
    document.body.classList.toggle('pick-hover', !!hit && hit !== (seat.on && seat.pose ? seat.pose.id : ''));
  });
  /* ── the bouquet: wild flowers picked at the forest's edge, kept in this browser; put in a jar on the picnic table,
     or let go ── */
  const bouquet = { list: store.get('bouquet', []), jar: store.get('bouquetJar', false) };
  const FL = { daisy: { name: 'beach daisy', many: 'beach daisies' }, glory: { name: 'morning glory', many: 'morning glories' }, frangi: { name: 'frangipani', many: 'frangipani' } };
  /* the bunch, drawn: stems gathered at a ribbon, each flower fanned out at the end of its own */
  function drawBouquet(cv2, list, small) {
    const x = cv2.getContext('2d'), W = cv2.width, H = cv2.height; x.clearRect(0, 0, W, H);
    const n = Math.min(list.length, small ? 9 : 24), bx = W / 2, by = H * (small ? 0.92 : 0.9), R = H * (small ? 0.62 : 0.6);
    if (!n) return;
    const tip = i => { const f = n === 1 ? 0.5 : i / (n - 1), a = -Math.PI / 2 + (f - 0.5) * (small ? 1.5 : 1.7) * Math.min(1, 0.45 + n / 10), L = R * (0.78 + 0.22 * ((i * 0.618) % 1)) * (1 - 0.2 * Math.abs(f - 0.5)); return [bx + Math.cos(a) * L, by + Math.sin(a) * L]; };
    x.lineCap = 'round';
    for (let i = 0; i < n; i++) { const [tx, ty] = tip(i); x.strokeStyle = i % 2 ? '#4f7f31' : '#5c8c3a'; x.lineWidth = small ? 2 : 3.2; x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo((bx + tx) / 2, (by + ty) / 2 + H * 0.04, tx, ty); x.stroke(); }
    const s = small ? 0.5 : 1;
    for (let i = 0; i < n; i++) {
      const [tx, ty] = tip(i), k = list[i];
      if (k === 'daisy') { x.fillStyle = '#f5cd32'; for (let p = 0; p < 11; p++) { const a = p / 11 * Math.PI * 2; x.beginPath(); x.ellipse(tx + Math.cos(a) * 12 * s, ty + Math.sin(a) * 12 * s, 9 * s, 4 * s, a, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#a8621c'; x.beginPath(); x.arc(tx, ty, 6 * s, 0, Math.PI * 2); x.fill(); }
      else if (k === 'glory') { x.fillStyle = '#d94f9c'; x.beginPath(); x.moveTo(tx - 3 * s, ty + 10 * s); x.lineTo(tx - 16 * s, ty - 12 * s); x.quadraticCurveTo(tx, ty - 22 * s, tx + 16 * s, ty - 12 * s); x.lineTo(tx + 3 * s, ty + 10 * s); x.fill(); x.fillStyle = '#7a1f52'; x.beginPath(); x.ellipse(tx, ty - 12 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2); x.fill(); }
      else { x.fillStyle = '#fbf5ea'; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 - Math.PI / 2; x.beginPath(); x.ellipse(tx + Math.cos(a) * 9 * s, ty + Math.sin(a) * 9 * s, 10 * s, 6 * s, a, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#f2c23a'; x.beginPath(); x.arc(tx, ty, 5 * s, 0, Math.PI * 2); x.fill(); }
    }
    /* the ribbon */
    x.fillStyle = '#e86f4a'; x.beginPath(); x.ellipse(bx, by - H * 0.05, (small ? 6 : 13), (small ? 4 : 8), 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#e86f4a'; x.lineWidth = small ? 2 : 3; x.beginPath(); x.moveTo(bx, by - H * 0.05); x.lineTo(bx - (small ? 8 : 18), by + (small ? 2 : 6)); x.moveTo(bx, by - H * 0.05); x.lineTo(bx + (small ? 8 : 18), by + (small ? 2 : 6)); x.stroke();
  }
  const bqWords = list => { const c = {}; for (const k of list) c[k] = (c[k] || 0) + 1; const parts = Object.keys(c).map(k => `${c[k]} ${c[k] === 1 ? FL[k].name : FL[k].many}`); return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || ''; };
  function syncBouquet(pop) {
    const b = $('bouquet'), n = bouquet.list.length;
    b.hidden = !n; $('bqN').textContent = String(n); drawBouquet($('bqIcon'), bouquet.list, true);
    if (pop) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    if (!$('bqPanel').hidden) { drawBouquet($('bqArt'), bouquet.list, false); $('bqText').textContent = n ? `${bqWords(bouquet.list)}${bouquet.jar ? ', in a jar on the picnic table.' : '.'}` : ''; $('bqJar').textContent = bouquet.jar ? 'Take them out of the jar' : 'Put them in a jar on the table'; }
    if (!n) $('bqPanel').hidden = true;
    Engine.setBouquetJar(bouquet.jar ? bouquet.list : []);
  }
  function pickFlower(f, quiet) {
    const p = Engine.pluckFlower(f, st.t, quiet); if (!p) return;
    bouquet.list.push(p.kind); store.set('bouquet', bouquet.list.slice(-60));
    if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; }
    toast(bouquet.list.length === 1 ? `You picked a ${p.name}. It's the start of a bouquet.` : `A ${p.name} for the bouquet: ${bqWords(bouquet.list)}.`, false, 2600);
    if (bouquet.list.length >= 12) unlock('bouquet');
    syncBouquet(true);
  }
  $('bouquet').addEventListener('click', () => { const p = $('bqPanel'); p.hidden = !p.hidden; $('bouquet').setAttribute('aria-expanded', String(!p.hidden)); syncBouquet(false); });
  $('bqClose').addEventListener('click', () => { $('bqPanel').hidden = true; $('bouquet').setAttribute('aria-expanded', 'false'); });
  $('bqJar').addEventListener('click', () => { bouquet.jar = !bouquet.jar; store.set('bouquetJar', bouquet.jar); syncBouquet(false); if (bouquet.jar) toast('In a jar on the picnic table.', false, 2400); });
  $('bqFree').addEventListener('click', () => { bouquet.list = []; bouquet.jar = false; store.set('bouquet', []); store.set('bouquetJar', false); syncBouquet(false); toast('You let them go. They drift back into the grass.', false, 2400); });

  /* the van drives round the board, as it does round everything else at the camp */
  campObs.push([Layout.board.x, Layout.board.z, 0.9, 'board']);

  /* dots on the board and the chairs (and the radio, while you sit) */
  const extraSpots = [['board', 'Wishes', 'Read the wishes', openWishes], ['chair0', 'Sit', 'Sit in this chair', () => sit(seatBy('chair0'))], ['chair1', 'Sit', 'Sit in this chair', () => sit(seatBy('chair1'))], ['radio', 'Radio', 'Switch the radio on or off', radioToggle], ['sketch', 'Draw', 'Draw a picture on the board', () => openSketch()], ['toolbox', 'Drawings', 'Look through everyone’s drawings', () => openToolbox()]].map(([key, label, aria, fn]) => {
    const s = document.createElement('button'); s.type = 'button'; s.className = 'spot extra'; s.setAttribute('aria-label', aria);
    s.innerHTML = `<span class="lbl">${esc(label)}</span><i></i>`; s.addEventListener('click', e => { e.stopPropagation(); fn(); }); spots.appendChild(s);
    return { key, el: s };
  });
  function placeExtraSpots() {
    const A = Engine.propAnchors();
    for (const x of extraSpots) {
      if (!A[x.key]) { x.el.style.visibility = 'hidden'; continue; }
      const atTable = seat.on && seat.pose && seat.pose.near === 'table', p = Engine.project(A[x.key]);
      const want = !sketch.on && !tbox.on && (x.key === 'radio' ? seat.on && !atTable : x.key === 'sketch' || x.key === 'toolbox' ? !st.chapter && (!seat.on || atTable) : !seat.on && !st.chapter);
      const vis = want && !rd.on && !car.on && pinNear(A[x.key]) && !Engine.pitching && !Engine.knocked(x.key) && p[2] < 1 && p[0] > 0.02 && p[0] < 0.98 && p[1] > 0.1 && p[1] < 0.97;
      x.el.style.transform = `translate(${(view.x + p[0] * view.w).toFixed(1)}px, ${(view.y + p[1] * view.h).toFixed(1)}px)`; x.el.style.visibility = vis ? 'visible' : 'hidden';
    }
  }

  /* ── the drawing board on the picnic table. Draw on the paper itself: the camera looks down at it and each stroke lands
     where you put it, in pencil, pen, marker or crayon, in ten colours, or rub it out. Finished, it goes into the toolbox
     on the corner of the rug, where anyone can look through everyone's drawings. (Kept on the server with the wishes;
     without one, on this device) ── */
  const SKW = 800, SKH = 600;
  const SK_TOOLS = { pencil: { w: 2.4, a: 0.85 }, pen: { w: 3.4, a: 1 }, marker: { w: 15, a: 0.34 }, crayon: { w: 9, a: 0.6 }, eraser: { w: 26, a: 1 } };
  const SK_COLS = ['#2b2622', '#c8352e', '#e8892a', '#e8c62a', '#3f9a4a', '#1f8a8a', '#2a6fc8', '#6a3fa0', '#e26aa0', '#7a4a2a'];
  const sketch = { on: false, tool: 'pencil', color: SK_COLS[0], size: 1, ink: null, inkX: null, comp: null, compX: null, paper: null, undo: [], stroke: null, dirty: false, marks: 0, sending: false, from: -1, pend: [] };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function sketchInit() {
    if (sketch.ink) return;
    sketch.ink = mkCanvas(SKW, SKH); sketch.inkX = sketch.ink.getContext('2d', { willReadFrequently: true });
    sketch.comp = mkCanvas(SKW, SKH); sketch.compX = sketch.comp.getContext('2d');
    /* the paper: cream, with a faint tooth to it */
    sketch.paper = mkCanvas(SKW, SKH); { const a = sketch.paper.getContext('2d'); a.fillStyle = '#f6f1e4'; a.fillRect(0, 0, SKW, SKH);
      for (let i = 0; i < 5000; i++) { const g = Math.random(); a.fillStyle = `rgba(${g < 0.5 ? '120,100,70' : '255,255,250'},${0.02 + Math.random() * 0.04})`; a.fillRect(Math.random() * SKW, Math.random() * SKH, 1 + Math.random() * 2, 1); } }
    sketch.dirty = true;
  }
  function sketchCompose() { const a = sketch.compX; a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1; a.drawImage(sketch.paper, 0, 0); a.drawImage(sketch.ink, 0, 0); Engine.setSketch(sketch.comp); }
  /* one stretch of a stroke, from p0 to p1 (canvas pixels), in the current tool and colour; pressure 0..1 */
  function inkSeg(p0, p1, pr) {
    const a = sketch.inkX, T0 = SK_TOOLS[sketch.tool], w = T0.w * sketch.size * (0.55 + 0.9 * pr);
    a.save(); a.lineCap = a.lineJoin = 'round';
    if (sketch.tool === 'eraser') { a.globalCompositeOperation = 'destination-out'; a.strokeStyle = '#000'; a.lineWidth = w; a.beginPath(); a.moveTo(p0[0], p0[1]); a.lineTo(p1[0], p1[1]); a.stroke(); }
    else if (sketch.tool === 'crayon') {
      /* wax on paper: speckled, catching the paper's tooth */
      a.fillStyle = sketch.color; const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(1, Math.ceil(d / 1.5));
      for (let i = 0; i <= n; i++) { const t = i / n, x = p0[0] + (p1[0] - p0[0]) * t, y = p0[1] + (p1[1] - p0[1]) * t;
        for (let k = 0; k < 7; k++) { const r = Math.random() * w / 2, q = Math.random() * 6.283; a.globalAlpha = T0.a * (0.3 + 0.7 * Math.random()); a.fillRect(x + Math.cos(q) * r, y + Math.sin(q) * r, 1.4, 1.4); } }
    } else {
      a.globalCompositeOperation = sketch.tool === 'marker' ? 'multiply' : 'source-over';
      a.strokeStyle = sketch.color; a.lineWidth = w;
      if (sketch.tool === 'pencil') {
        /* graphite: a little uneven, twice over */
        for (const o of [0, 0.6]) { a.globalAlpha = T0.a * (0.55 + 0.35 * Math.random()); a.beginPath(); a.moveTo(p0[0] + o, p0[1] - o); a.lineTo(p1[0] + o, p1[1] - o); a.stroke(); }
      } else { a.globalAlpha = T0.a; a.beginPath(); a.moveTo(p0[0], p0[1]); a.lineTo(p1[0], p1[1]); a.stroke(); }
    }
    a.restore(); sketch.dirty = true;
  }
  /* the camera over the board, tilted a little toward whoever draws, the paper filling the space above the tools */
  function sketchView() {
    const f = Engine.sketchFrame(); if (!f) return V.wide;
    const aspect = view.w / view.h, fov = 38, tf = Math.tan(fov * Math.PI / 360), barH = view.w < 720 ? 190 : 150, hFrac = Math.max(0.5, 1 - (barH + 70) / view.h);
    const d = Math.max(f.H * 1.06 / (2 * tf * hFrac), f.W * 1.06 / (2 * tf * aspect)), tilt = 0.16;
    /* (the paper sits a little above the middle of the screen, clear of the tools) */
    const lift = (barH - 40) / view.h * 2 * d * tf * 0.5;
    const look = [0, 1, 2].map(i => f.o[i] - f.top[i] * lift + f.up[i] * 0.004);
    const pos = [0, 1, 2].map(i => look[i] + f.up[i] * d * Math.cos(tilt) - f.top[i] * d * Math.sin(tilt));
    return { pos, look, fov, focus: d };
  }
  function openSketch() {
    if (!ready || !st.entered || car.on || sketch.on || isDown('sketch')) return;
    if (rd.on || st.chapter) openChapter(null);
    if (tbox.on) closeToolbox(true);
    toggleSettings(false);
    sketch.from = seat.on ? seat.i : -1;
    if (wk.on) stopWalk();
    if (seat.on) leaveSeat();
    sketchInit(); sketchCompose();
    sketch.on = true; document.body.classList.add('sketching'); $('sketchBar').hidden = false; $('skMsg').textContent = '';
    st.from = st.cur ? JSON.parse(JSON.stringify(st.cur)) : V.wide; st.to = sketchView(); st.camT = 0; st.camDur = camDur(st.from, st.to);
    syncSketchUI();
    if (!st.hintGone) { st.hintGone = true; $('hint').style.opacity = 0; }
  }
  function closeSketch(stay) {
    if (!sketch.on) return;
    sketch.on = false; sketch.stroke = null; document.body.classList.remove('sketching', 'sk-drawing'); $('sketchBar').hidden = true;
    if (stay) return;
    if (sketch.from >= 0) sit(sketch.from); else goView('wide');
  }
  function syncSketchUI() {
    document.querySelectorAll('[data-sktool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sktool === sketch.tool)));
    document.querySelectorAll('[data-skcol]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skcol === sketch.color)));
    document.querySelectorAll('[data-sksize]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sksize === sketch.size)));
    $('skUndo').disabled = !sketch.undo.length; $('skKeep').disabled = sketch.sending;
  }
  { /* the tools */
    const bar = $('sketchBar'), cols = $('skCols');
    cols.innerHTML = SK_COLS.map(c => `<button type="button" class="sk-col" data-skcol="${c}" style="--c:${c}" aria-label="Colour ${c}" aria-pressed="false"></button>`).join('');
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sktool) { sketch.tool = b.dataset.sktool; if (sketch.tool === 'eraser') {} }
      else if (b.dataset.skcol) { sketch.color = b.dataset.skcol; if (sketch.tool === 'eraser') sketch.tool = 'pencil'; }
      else if (b.dataset.sksize) sketch.size = +b.dataset.sksize;
      syncSketchUI();
    });
    $('skUndo').addEventListener('click', () => { const u = sketch.undo.pop(); if (u) { sketch.inkX.putImageData(u, 0, 0); sketch.dirty = true; sketch.marks = Math.max(0, sketch.marks - 1); } syncSketchUI(); });
    $('skClear').addEventListener('click', () => { if (!sketch.marks) return; sketch.undo.push(sketch.inkX.getImageData(0, 0, SKW, SKH)); if (sketch.undo.length > 25) sketch.undo.shift(); sketch.inkX.clearRect(0, 0, SKW, SKH); sketch.marks = 0; sketch.dirty = true; syncSketchUI(); });
    $('skClose').addEventListener('click', () => closeSketch());
    $('skKeep').addEventListener('click', keepSketch);
    $('skName').value = store.get('drawName', '');
    bar.addEventListener('keydown', e => e.stopPropagation());
  }
  /* drawing: the pointer, through the camera, onto the paper */
  const skAt = e => { const r = cv.getBoundingClientRect(), uv = Engine.sketchUV((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); return uv ? [uv[0] * SKW, (1 - uv[1]) * SKH] : null; };
  cv.addEventListener('pointerdown', e => {
    if (!sketch.on || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || st.camT < 1) return;
    const p = skAt(e); if (!p) return;
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* (a pointer the browser no longer tracks) */ }
    sketch.undo.push(sketch.inkX.getImageData(0, 0, SKW, SKH)); if (sketch.undo.length > 25) sketch.undo.shift();
    const pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    sketch.stroke = { id: e.pointerId, last: p, pr }; inkSeg(p, [p[0] + 0.01, p[1]], pr); sketch.marks++;
    document.body.classList.add('sk-drawing'); syncSketchUI();
  });
  cv.addEventListener('pointermove', e => {
    const s0 = sketch.stroke; if (!sketch.on || !s0 || s0.id !== e.pointerId) return;
    let evs = e.getCoalescedEvents ? e.getCoalescedEvents() : []; if (!evs.length) evs = [e];
    for (const ev of evs) { const p = skAt(ev); if (!p) continue; const pr = ev.pointerType === 'pen' ? (ev.pressure || 0.5) : 0.5; inkSeg(s0.last, p, (s0.pr + pr) / 2); s0.last = p; s0.pr = pr; }
  });
  const skUp = e => { if (sketch.stroke && sketch.stroke.id === e.pointerId) { sketch.stroke = null; document.body.classList.remove('sk-drawing'); } };
  cv.addEventListener('pointerup', skUp); cv.addEventListener('pointercancel', skUp);
  function stepSketch() {
    if (sketch.dirty && sketch.ink) { sketch.dirty = false; sketchCompose(); }
    /* readable after dark: the paper carries a little light of its own while you draw */
    const S0 = st.S; Engine.setSketchLight(sketch.on && S0 ? 0.32 * (1 - 0.9 * S0.day) / Math.max(0.05, S0.exposure || 1) : 0);
    if (sketch.on && st.camT >= 1) st.to = sketchView();
  }
  /* finished: into the toolbox */
  const localDrawings = () => { const l = store.get('drawings', []); return Array.isArray(l) ? l.filter(d => d && typeof d.image === 'string' && /^data:image\/(png|webp);base64,/.test(d.image)) : []; };
  async function keepSketch() {
    if (sketch.sending) return;
    if (!sketch.marks) { $('skMsg').textContent = 'Draw something first: a line will do.'; return; }
    const name = tidy($('skName').value, 32); store.set('drawName', name);
    const out = mkCanvas(SKW, SKH), a = out.getContext('2d'); a.drawImage(sketch.paper, 0, 0); a.drawImage(sketch.ink, 0, 0);
    let image = out.toDataURL('image/webp', 0.9); if (!/^data:image\/webp/.test(image)) image = out.toDataURL('image/png');
    sketch.sending = true; syncSketchUI(); $('skKeep').textContent = 'Putting it away…'; $('skMsg').textContent = '';
    let res = null;
    if (isWeb) {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 20000);
      try {
        const r = await fetch('/api/drawings', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ image, name }), cache: 'no-store', signal: ctl.signal });
        const j = /json/.test(r.headers.get('content-type') || '') ? await r.json().catch(() => null) : null;
        if (r.ok && j && j.drawing) res = { drawing: j.drawing, total: j.total };
        else if (j && j.error) res = { error: String(j.error) };
        else if (r.status !== 404) res = { error: 'The toolbox couldn’t take your drawing just now. Try again in a moment.' };
      } catch (e) { res = { error: 'Couldn’t reach the toolbox just now. Check your connection and try again.' }; }
      finally { clearTimeout(to); }
    }
    if (!res) {
      /* no toolbox on a server (the single-file cove): kept on this device */
      const d = { id: 'local-' + Date.now().toString(36), name, at: new Date().toISOString(), image, local: true };
      const list = [d, ...localDrawings()].slice(0, 12);
      store.set('drawings', list);
      res = (localDrawings()[0] || {}).id === d.id ? { drawing: { id: d.id, name, at: d.at, url: image, local: true }, local: true } : { error: 'There’s no room left on this device for another drawing.' };
    }
    sketch.sending = false; $('skKeep').textContent = 'Put it in the toolbox'; syncSketchUI();
    if (res.error) { $('skMsg').textContent = res.error; return; }
    tbox.list = null;
    sketch.inkX.clearRect(0, 0, SKW, SKH); sketch.undo.length = 0; sketch.marks = 0; sketch.dirty = true;
    toast(res.local ? 'Your drawing is in the toolbox (kept only on this device).' : 'Your drawing is in the toolbox, for anyone who opens it.', false, 4000);
    unlock('artist');
    closeSketch();
  }

  /* ── the toolbox: everyone's drawings, newest first; open one to see it large ── */
  const tbox = { on: false, k: 0, list: null, total: 0, view: -1, loading: false };
  async function loadDrawings() {
    if (tbox.loading) return; tbox.loading = true;
    let list = null, total = 0;
    if (isWeb) { try { const r = await fetch('/api/drawings?limit=120', { cache: 'no-store', headers: { Accept: 'application/json' } }); const j = r.ok ? await r.json() : null; if (j && Array.isArray(j.drawings)) { list = j.drawings.filter(d => d && /^\/api\/drawings\/[A-Za-z0-9_-]+\.(png|webp)$/.test(d.url)); total = +j.total || list.length; } } catch (e) { /* the toolbox on this device, then */ } }
    const local = localDrawings().map(d => ({ id: d.id, name: d.name || '', at: d.at, url: d.image, local: true }));
    tbox.list = [...(list || []), ...local]; tbox.total = (list ? total : 0) + local.length; tbox.loading = false;
    renderToolbox();
  }
  function renderToolbox() {
    const g = $('tbGrid'), L = tbox.list || [];
    $('tbCount').textContent = tbox.list == null ? 'Opening…' : L.length ? `${tbox.total} drawing${tbox.total === 1 ? '' : 's'}` : 'Empty, for now';
    g.innerHTML = L.map((d, i) => `<button type="button" class="tb-item" data-i="${i}"><img src="${esc(d.url)}" alt="${esc(d.name ? 'A drawing by ' + d.name : 'A drawing')}" loading="lazy" decoding="async"><span>${esc(d.name || 'Unsigned')}${d.local ? ' · this device' : ''}</span></button>`).join('') ||
      (tbox.list ? '<p class="tb-empty">No drawings yet. Sit at the picnic table, draw on the board, and put the first one in.</p>' : '');
  }
  function openToolbox() {
    if (!ready || !st.entered || car.on || tbox.on || isDown('toolbox')) return;
    if (rd.on || st.chapter) openChapter(null);
    if (sketch.on) closeSketch(true);
    toggleSettings(false);
    if (wk.on) stopWalk();
    tbox.on = true; tbox.view = -1; document.body.classList.add('toolbox-open'); $('tbox').hidden = false; $('tbView').hidden = true;
    if (!seat.on) { const a = Engine.propAnchors().toolbox; if (a) { st.from = st.cur ? JSON.parse(JSON.stringify(st.cur)) : V.wide; st.to = { pos: [a[0] - 1.1, 1.35, a[2] + 1.25], look: [a[0], a[1] - 0.12, a[2]], fov: 44, focus: 1.6 }; st.camT = 0; st.camDur = camDur(st.from, st.to); } }
    renderToolbox(); loadDrawings();
  }
  function closeToolbox(stay) {
    if (!tbox.on) return;
    tbox.on = false; tbox.view = -1; document.body.classList.remove('toolbox-open'); $('tbox').hidden = true; $('tbView').hidden = true;
    if (!stay && !seat.on) goView('wide');
  }
  function tbShow(i) {
    const L = tbox.list || []; if (!L.length) return;
    tbox.view = (i + L.length) % L.length; const d = L[tbox.view];
    $('tbImg').src = d.url; $('tbImg').alt = d.name ? 'A drawing by ' + d.name : 'A drawing';
    $('tbWho').textContent = d.name || 'Unsigned'; $('tbWhen').textContent = d.at ? whenOf(d.at) : ''; $('tbView').hidden = false;
    $('tbPrev').disabled = $('tbNext').disabled = L.length < 2;
  }
  function tbViewClose() { tbox.view = -1; $('tbView').hidden = true; }
  $('tbGrid').addEventListener('click', e => { const b = e.target.closest('.tb-item'); if (b) tbShow(+b.dataset.i); });
  $('tbClose').addEventListener('click', () => closeToolbox()); $('tbDraw').addEventListener('click', () => { closeToolbox(true); openSketch(); });
  $('tbPrev').addEventListener('click', () => tbShow(tbox.view - 1)); $('tbNext').addEventListener('click', () => tbShow(tbox.view + 1)); $('tbBack').addEventListener('click', tbViewClose);
  $('tbView').addEventListener('click', e => { if (e.target === $('tbView')) tbViewClose(); });
  $('tbox').addEventListener('keydown', e => { if (tbox.view >= 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { tbShow(tbox.view + (e.key === 'ArrowLeft' ? -1 : 1)); e.preventDefault(); } e.stopPropagation(); });
  function stepToolbox(dt) { const t = tbox.on ? 1 : 0; if (Math.abs(t - tbox.k) > 1e-3) { tbox.k += (t - tbox.k) * Math.min(1, dt * 3.2); Engine.toolboxOpen(tbox.k); } }

  /* where each sound comes from, as heard from the camera (or the walker's ears): the surf from the waterline, birds and
     crickets from the trees, the crackle from the fire. Each fades with distance (the fire, a point, quickly; the long
     line of the surf more slowly; trees muffle the sea), the air takes the highs off what is far, and each pans to the
     side it is on */
  function hearing(cam) {
    const cp = cam.pos, lk = cam.look, fx0 = lk[0] - cp[0], fz0 = lk[2] - cp[2], fl = Math.hypot(fx0, fz0) || 1, rx = -fz0 / fl, rz = fx0 / fl;
    const side = (dx, dz) => { const l = Math.hypot(dx, dz) || 1; return (dx * rx + dz * rz) / l; };
    const x = cp[0], z = cp[2], y = Math.max(0, cp[1] - 1.6);
    /* the fire */
    const F = Layout.fire, fdx = F.x - x, fdz = F.z - z, fd = Math.hypot(fdx, fdz, cp[1] - 0.35);
    const fire = { g: 1.25 * Math.pow(2.5 / Math.max(2.5, fd), 1.3), pan: side(fdx, fdz) * 0.8 * Math.min(1, fd / 1.5), lp: clamp(18000 * Math.pow(3 / Math.max(3, fd), 0.55), 2500, 18000) };
    /* the surf: how far up the beach from the waterline, and how high; muffled once well inside the trees */
    const k = Math.hypot(1, Layout.shoreDZ(x)), up = (z - Layout.shoreZ(x)) / k, sd = Math.hypot(Math.max(0, up), y);
    const inTrees = clamp((z - Layout.vegZ(x) - 3) / 12, 0, 1);
    const sea = { g: Math.max(0.07, 1.15 * Math.pow(10 / Math.max(10, sd), 0.7)) * (1 - 0.4 * inTrees), pan: side(Layout.shoreDZ(x) / k, -1 / k) * 0.55, lp: clamp(15000 * Math.pow(12 / Math.max(12, sd), 0.55), 2500, 15000) * (1 - 0.5 * inTrees) };
    /* the trees: birds by day, crickets by night (which carry further) */
    const vd = Math.hypot(Math.max(0, Layout.vegZ(x) - z), y * 0.6), vp = side(0, 1) * 0.5 * Math.min(1, vd / 4);
    return { fire, sea, forest: { g: Math.max(0.06, Math.pow(7 / Math.max(7, vd), 0.8)), pan: vp }, crick: { g: Math.max(0.15, Math.pow(7 / Math.max(7, vd), 0.55)), pan: vp } };
  }
  /* the radio is a thing in the world too: loud beside it, faint across the beach. (A station is a stream from another
     site, which the page may not route through its own sound graph, so only its volume can follow you, not its side) */
  function radioHeard(cam) {
    const p = Engine.radioPos ? Engine.radioPos() : null; if (!p) return 1;
    const d = Math.hypot(p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]);
    return Math.pow(1.8 / Math.max(1.8, d), 1.15);
  }
  /* every frame, after the scene is drawn: the seated view, the board's light, the radio's dial, the dots */
  function extras(dt) {
    if (!wish.started) startWishes();
    /* opening something else, or taking the van, gets you up out of the chair */
    if (seat.on && (rd.on || car.on || wk.on || st.chapter)) { leaveSeat(); if (!rd.on && !st.chapter && !wk.on) goView('wide'); }
    stepChairs(dt); stepSketch(dt); stepToolbox(dt);
    if (seat.on) {
      const a = 1 - Math.exp(-dt * 6); seat.yaw += (seat.yawT - seat.yaw) * a; seat.pitch += (seat.pitchT - seat.pitch) * a;
      const ap = seat.approach;
      if (ap && ap.stage === 1) { if (st.camT >= 1) { ap.stage = 2; st.from = JSON.parse(JSON.stringify(ap.stand)); st.camT = 0; st.camDur = 1.5; seat.sitAt = performance.now() + 1500 * 0.5; st.to = seatCam(); } }
      else { if (ap && st.camT >= 1) seat.approach = null; st.to = seatCam(); }
    }
    if (st.chapter !== 'wishes' && $('drawer').classList.contains('wishes-mode')) $('drawer').classList.remove('wishes-mode');
    wish.look += ((st.chapter === 'wishes' ? 1 : 0) - wish.look) * Math.min(1, dt * 1.5); Engine.setBoardLook(wish.look);
    /* the dial lights while it plays (and flickers while it tunes); the needle swings to the station */
    radio.dial += (radio.dialT - radio.dial) * Math.min(1, dt * 3);
    const glow = radio.on ? (radio.state === 'playing' ? 1 : 0.55 + 0.25 * Math.sin(performance.now() / 70)) : 0;
    radio.glow += (glow - radio.glow) * Math.min(1, dt * 6);
    Engine.setRadio(radio.glow * 0.8 / Math.max(0.05, (st.S && st.S.exposure) || 1), radio.dial);     /* (a warm glow, not a glare: night exposure is high) */
    /* the radio's loudness from where you are (it has a volume of its own; the bed of sound steps back only as far as the
       radio is loud) */
    const heard = st.cur ? radioHeard(st.cur) : 1;
    radio.heard = radio.heard == null ? heard : radio.heard + (heard - radio.heard) * Math.min(1, dt * 4);
    if (radio.el && own(radio.el)) { const v = clamp(radio.vol * radio.heard, 0, 1); if (Math.abs(radio.el.volume - v) > 0.004) radio.el.volume = v; }
    const duck = radio.on && radio.state === 'playing' ? 1 - 0.45 * Math.min(1, radio.heard * 1.5) : 1;
    if (sound.amb && sound.amb.duck && (radio.duckFor !== sound.amb || radio.duckK !== duck)) { radio.duckFor = sound.amb; radio.duckK = duck; sound.amb.duck(duck); }
    placeExtraSpots();
  }

  syncTimeUI(); syncLightsUI(); syncSoundUI(); renderFinds();
  window.__cove = { st, rd, openChapter, toast, readNav, view, car, keys, stepCar, startDrive, stopDrive, obstacles, obstaclesNear, body, orb, orbCam, orbHome, orbToVan, ex, wk, ai, startWalk, stopWalk, setAuto, stepWalk };
  Object.assign(window.__cove, { wish, seat, radio, sit, standUp, openWishes, openWish, radioOn, radioOff, radioClick, pitchSpot, startPitch, pitchS, filmStep, film, orbAt, WX, hearing, radioHeard, sketch, openSketch, closeSketch, tbox, openToolbox, closeToolbox });
})();
