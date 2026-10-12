/* ─────────────────────────────────────────────────────────────
   audio.js — the cove's soundscape, from real field recordings
   and nothing else: no tones, no synthesised noises.
   ocean    the surf, and a second take of it that swells in as a
            wave reaches the beach on screen
   forest   birds and gulls by day, an owl now and then at night
   fire     crackling only while the fire is lit (dusk to dawn)
   insects  crickets after dark, soft and a little way off
   weather  rain and thunder
   Every recording plays at its own pitch, whole, at a clean
   bitrate; the mix is left uncoloured, with only a limiter that
   catches peaks. Each channel can be switched off on its own.
   Each sound comes from a place: the surf from the waterline, the
   birds and crickets from the trees, the crackle from the fire. As
   you move, each fades with its distance, dulls as the air takes
   its highs, and pans to the side it is on. The same graph renders
   offline for the film's soundtrack.
   Recordings: Moodist sound library (Pixabay licence / CC0); the
   van's engine and knocks: Kenney (CC0).
   ───────────────────────────────────────────────────────────── */
const Ambience = (() => {
  function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const b64buf = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  const decode = (ctx, ab) => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });

  /* SND: { name: { b64 | url, loopStart?, loopEnd?, rms, events? } } — injected at build time */
  function create(ctx, opts = {}) {
    const rnd = rngOf(opts.seed || 777);
    const G = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const F = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const P = p => { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (n) n.pan.value = p; return n; };
    const chain = (...nodes) => { const ns = nodes.filter(Boolean); for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };

    /* the mix: channels into the master, the master through a gain the radio can lower, then a limiter that only ever
       touches the very loudest moments (a crack of thunder) */
    const master = G(0), duckG = G(1), lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    const out = G(0.85); chain(master, duckG, lim, out, ctx.destination);
    const duck = k => duckG.gain.setTargetAtTime(k, ctx.currentTime, 0.5);
    const ch = { ocean: G(1), forest: G(1), fire: G(1), insects: G(1), weather: G(1) };
    Object.values(ch).forEach(g => g.connect(master));
    let enabled = { ocean: true, forest: true, fire: true, insects: true, weather: true }, on = false;

    /* the loops, each brought to a target loudness from its measured one, then set by the time of day and the place */
    const SNDS = opts.sounds || {};
    /* [channel, target loudness, the most its loudest moment may reach] (a campfire's crackle is all peaks: those, not
       its average, decide how loud it may play) */
    const LOOPS = { sea: ['ocean', 0.05, 0.5], crickets: ['insects', 0.008, 0.25], fire: ['fire', 0.03, 0.32], birds: ['forest', 0.012, 0.3], gulls: ['ocean', 0.007, 0.22], rain: ['weather', 0.04, 0.35] };
    const normOf = (s, target, ceil) => Math.min(target / Math.max(s.rms, 1e-4), ceil / Math.max(s.peak || 4 * s.rms, 1e-4));
    /* places: a bus for each, through which its sounds reach their channel (how loud from here, how dull, which side) */
    const placeBus = (to, lpHz) => { const lp = lpHz ? F('lowpass', lpHz, 0.5) : null, pan = P(0), g = G(1); chain(lp, pan, g, to); return { in: lp || pan || g, lp, pan, g }; };
    const place = { sea: placeBus(ch.ocean, 14000), forest: placeBus(ch.forest, 16000), crick: placeBus(ch.insects, 7500), fire: placeBus(ch.fire, 18000) };
    /* the gulls are over the water; the rain is everywhere */
    const dest = { sea: place.sea.in, gulls: place.sea.in, crickets: place.crick.in, birds: place.forest.in, fire: place.fire.in, rain: ch.weather };
    const L = {}, B = {};
    function loopSource(name, buf, s, g, offset) {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = s.loopStart; src.loopEnd = Math.min(s.loopEnd, buf.duration - 0.01);
      src.connect(g); src.start(ctx.currentTime + 0.05, s.loopStart + offset * (s.loopEnd - s.loopStart));
      return src;
    }
    const ready = Promise.all(Object.entries(SNDS).map(async ([name, s]) => {
      try {
        /* inlined in the single-file build; a separate file (fetched when sound is first turned on) on the website */
        const buf = await decode(ctx, s.b64 ? b64buf(s.b64) : await (await fetch(s.url)).arrayBuffer()); B[name] = buf;
        const lp = LOOPS[name]; if (!lp || s.loopEnd == null) return;
        const g = G(0), norm = normOf(s, lp[1], lp[2]); g.connect(dest[name]);
        const off = rnd() * 0.9;
        L[name] = { src: loopSource(name, buf, s, g, off), g, norm };
        /* the sea's second take, for the waves that reach the sand: the same surf, half a loop apart, silent until a
           wave comes in */
        if (name === 'sea') { const g2 = G(0); g2.connect(place.sea.in); L.sea2 = { src: loopSource('sea', buf, s, g2, (off + 0.5) % 1), g: g2, norm }; }
      } catch (e) { /* a recording that fails to decode just stays silent */ }
    }));

    /* a single sound from a recording of several (an owl's call, a roll of thunder, a page), whole, at its own pitch */
    let lastEv = {};
    function oneShot(name, t, gain, pan, dest) {
      const buf = B[name], ev = SNDS[name] && SNDS[name].events; if (!buf || !ev) return;
      let i = Math.floor(rnd() * ev.length); if (ev.length > 1 && i === lastEv[name]) i = (i + 1) % ev.length; lastEv[name] = i;
      const [off, dur] = ev[i], s = ctx.createBufferSource(); s.buffer = buf;
      chain(s, G(gain), P(pan), dest); s.start(Math.max(ctx.currentTime, t), off, dur);
    }
    /* a page turning: one of four real page turns */
    function page() { if (SNDS.page) oneShot('page', ctx.currentTime, normOf(SNDS.page, 0.03, 0.3), (rnd() - 0.5) * 0.3, master); }

    /* a wave reaching the sand: the second take of the surf swells in under it and ebbs away again. A big one (sent
       by a click) comes in fuller and stays longer */
    function wash(t, amp, big) {
      const s2 = L.sea2; if (!s2) return;
      const g = s2.g.gain, k = s2.norm * (big ? Math.min(1.3, 0.6 + 0.12 * amp) : Math.min(0.55, 0.22 + 0.25 * amp));
      const t0 = Math.max(ctx.currentTime, t - 0.9);
      g.cancelScheduledValues(t0); g.setTargetAtTime(k, t0, big ? 0.5 : 0.35); g.setTargetAtTime(0, t0 + (big ? 3.2 : 1.6), big ? 2.4 : 1.4);
    }

    /* where each sound comes from, as heard from here: { sea, forest, crick, fire: { g, pan, lp } }. Without one (the
       film, the tests), the older nearness numbers stand in */
    const legacyPlace = s => { const sn = s.oceanNear ?? 0.5, fn = s.fireNear ?? 0.3, wn = s.forestNear ?? 0.5;
      return { sea: { g: 0.7 + 0.45 * sn, pan: 0, lp: 5200 + 9000 * sn }, forest: { g: 1, pan: 0 }, crick: { g: 0.55 + 0.45 * wn, pan: 0 }, fire: { g: 0.25 + 0.95 * fn, pan: 0, lp: 18000 } }; };
    const clampP = v => Math.max(-1, Math.min(1, v || 0));
    function setPlace(b, v, now, tc) {
      if (!b || !v) return;
      b.g.gain.setTargetAtTime(Math.max(0, v.g), now, tc);
      if (b.pan && v.pan != null) b.pan.pan.setTargetAtTime(clampP(v.pan), now, tc);
      if (b.lp && v.lp) b.lp.frequency.setTargetAtTime(Math.max(400, Math.min(20000, v.lp)), now, tc);
    }
    /* advance to audio time `until`.
       s = { night, crickets, fireI, place, birds, gulls, owl, waves:[{id,t,amp,pan,user}], douse, rain, thunder:[{id,t,k,pan}] } */
    const st = { lastWaves: new Set(), lastThunder: new Set(), owlNext: 20, doused: null };
    let cursor = ctx.currentTime;
    function schedule(until, s) {
      const now = Math.max(cursor, ctx.currentTime);
      const set = (name, v, tc = 1.2) => { const l = L[name]; if (l) l.g.gain.setTargetAtTime(Math.max(0, v) * l.norm, now, tc); };
      const pl = s.place || legacyPlace(s), tcP = s.place ? 0.25 : 1.0;
      setPlace(place.sea, pl.sea, now, tcP); setPlace(place.forest, pl.forest, now, tcP); setPlace(place.crick, pl.crick, now, tcP); setPlace(place.fire, pl.fire, now, tcP);
      set('sea', 1);
      set('crickets', s.crickets ?? s.night ?? 1, 2.5);
      /* (put out by a wave: the crackle stops at once) */
      const doused = s.douse != null && s.douse <= until;
      set('fire', doused ? 0 : (s.fireI ?? 0), doused ? 0.15 : 0.6);
      set('birds', s.birds ?? 0, 3);
      set('gulls', (s.gulls ?? 0) * (0.5 + 0.5 * Math.max(0, Math.sin(now * 0.05))), 4);
      set('rain', s.rain || 0, 1.5);
      for (const w of s.waves || []) {
        if (st.lastWaves.has(w.id) || w.t < now - 0.3 || w.t > until + 2.5) continue;
        st.lastWaves.add(w.id); wash(Math.max(w.t, now + 0.02), w.amp, !!w.user);
      }
      for (const th of s.thunder || []) {
        if (st.lastThunder.has(th.id) || th.t < now - 0.5 || th.t > until + 0.05) continue;
        st.lastThunder.add(th.id); if (SNDS.thunder) oneShot('thunder', Math.max(th.t, now), normOf(SNDS.thunder, 0.05, 0.6) * th.k, th.pan ?? 0, ch.weather);
      }
      if (st.lastWaves.size > 200) st.lastWaves = new Set([...st.lastWaves].slice(-60));
      if (st.owlNext < now) st.owlNext = now + 25 + rnd() * 30;
      if (st.owlNext < until) { if ((s.owl ?? 0) > 0.5 && SNDS.owl) oneShot('owl', st.owlNext, normOf(SNDS.owl, 0.012, 0.15), (rnd() - 0.5) * 0.4, place.forest.in); st.owlNext += 60 + rnd() * 70; }
      cursor = Math.max(cursor, until);
    }
    function setEnabled(name, v) {
      if (name === 'master') { on = v; master.gain.setTargetAtTime(v ? (opts.level ?? 0.9) : 0, ctx.currentTime, 0.4); return; }
      enabled[name] = v; if (ch[name]) ch[name].gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.25);
    }
    function fadeIn(t0, dur = 2.5, level = opts.level ?? 0.9) { opts.level = level; master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(level, t0 + dur); on = true; }
    function fadeOut(t0, dur = 1.5) { master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(master.gain.value, t0); master.gain.linearRampToValueAtTime(0, t0 + dur); }

    /* the van. The engine is a recorded loop (Kenney) played faster as it revs, as a real one winds up: the key turns
       it over a few times before it catches; parking lets it wind down */
    const vanG = G(0); vanG.connect(master);
    let eng = null, engOn = false;
    function engineNodes() {
      const buf = B.engine; if (!buf) return null;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = SNDS.engine.loopStart; s.loopEnd = Math.min(SNDS.engine.loopEnd, buf.duration - 0.01);
      /* small speakers can't play its 28 Hz fundamental: the rumble out, the harmonics that carry it kept */
      const hp = F('highpass', 40, 0.7), lp = F('lowpass', 1400, 0.6), crank = G(1), g = G(0);
      chain(s, hp, lp, crank, g, vanG); s.start(ctx.currentTime, SNDS.engine.loopStart);
      return { s, lp, crank, g, norm: 0.034 / Math.max(SNDS.engine.rms, 1e-3) };
    }
    function engine(on, rpm, thr) {
      if (!eng && on) eng = engineNodes();
      if (!eng) return;
      const t = ctx.currentTime, e = eng;
      if (on && !engOn) {
        vanG.gain.cancelScheduledValues(t); vanG.gain.setValueAtTime(vanG.gain.value, t); vanG.gain.linearRampToValueAtTime(1, t + 0.05);
        e.s.playbackRate.cancelScheduledValues(t); e.s.playbackRate.setValueAtTime(0.32, t); e.s.playbackRate.linearRampToValueAtTime(0.4, t + 0.55);
        e.s.playbackRate.linearRampToValueAtTime(1.2, t + 0.82); e.s.playbackRate.setTargetAtTime(0.86, t + 0.85, 0.28);
        e.crank.gain.cancelScheduledValues(t); e.crank.gain.setValueAtTime(0.35, t);
        for (let k = 0; k < 4; k++) { const c = t + 0.04 + k * 0.14; e.crank.gain.linearRampToValueAtTime(0.8, c + 0.04); e.crank.gain.linearRampToValueAtTime(0.35, c + 0.12); }
        e.crank.gain.linearRampToValueAtTime(1, t + 0.7);
        e.g.gain.cancelScheduledValues(t); e.g.gain.setValueAtTime(0.9 * e.norm, t); e.g.gain.setTargetAtTime(1.0 * e.norm, t + 0.8, 0.2);
        e.lp.frequency.setValueAtTime(900, t); e.lp.frequency.linearRampToValueAtTime(2000, t + 0.82); e.lp.frequency.setTargetAtTime(1300, t + 0.9, 0.3);
        e.until = t + 1.25; engOn = true; return;
      }
      if (!on && engOn) {
        engOn = false; e.until = t + 1.2;
        e.s.playbackRate.cancelScheduledValues(t); e.s.playbackRate.setValueAtTime(e.s.playbackRate.value, t); e.s.playbackRate.linearRampToValueAtTime(0.3, t + 0.9);
        vanG.gain.cancelScheduledValues(t); vanG.gain.setValueAtTime(vanG.gain.value, t); vanG.gain.linearRampToValueAtTime(0, t + 1.0);
        return;
      }
      if (!on || t < e.until) return;
      const rate = 0.86 + 0.9 * rpm + 0.2 * thr;
      e.s.playbackRate.setTargetAtTime(rate, t, thr > 0.1 ? 0.18 : 0.4);
      e.lp.frequency.setTargetAtTime(1100 + 1300 * thr + 800 * rpm, t, 0.12);
      e.g.gain.setTargetAtTime((0.75 + 0.4 * thr + 0.3 * rpm) * e.norm, t, 0.12);
    }
    /* the horn: two soft notes, rounded off (no buzz) */
    function horn() {
      const t = ctx.currentTime, out = G(0), lp = F('lowpass', 1100, 0.6); chain(lp, out, master);
      [[349, 0], [440, 0.02]].forEach(([f, d]) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = G(0.5); chain(o, g, lp); o.start(t + d); o.stop(t + 0.62); });
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.05, t + 0.03); out.gain.setValueAtTime(0.05, t + 0.42); out.gain.linearRampToValueAtTime(0, t + 0.55);
    }
    /* a knock: the recorded impact, a little lower for harder hits */
    function thud(k) {
      const buf = B.impact; if (!buf) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.9 + 0.15 * (1 - k);
      chain(s, G(Math.min(0.9, 0.15 + 0.7 * k) * 0.06 / Math.max(SNDS.impact.rms, 1e-3)), master); s.start(ctx.currentTime);
    }
    return { ctx, ready, schedule, setEnabled, fadeIn, fadeOut, duck, page, engine, horn, thud,
      setLevel: v => { opts.level = v; if (on) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2); },
      get enabled() { return enabled; }, get on() { return on; }, master, channels: ch };
  }

  /* 16-bit PCM WAV from an AudioBuffer (for the film) */
  function wav(buf) {
    const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, bytes = 44 + n * ch * 2, dv = new DataView(new ArrayBuffer(bytes));
    const W = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    W(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); W(8, 'WAVE'); W(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); W(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return dv.buffer;
  }
  return { create, wav };
})();
