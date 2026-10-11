/* ─────────────────────────────────────────────────────────────
   audio.js — the cove's soundscape, from real field recordings.
   ocean    a soft, distant bed of surf, and a single wave washing
            in each time a wave reaches the beach on screen
   forest   birds and gulls by day, an owl now and then at night
   fire     crackling only while the fire is lit (dusk to dawn)
   insects  crickets after dark
   weather  rain and thunder
   Each channel can be switched off on its own. The same graph
   renders offline for the film's soundtrack.
   Recordings: Moodist sound library (Pixabay licence / CC0).
   ───────────────────────────────────────────────────────────── */
const Ambience = (() => {
  function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const b64buf = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  const decode = (ctx, ab) => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });

  /* SND: { name: { b64, loopStart?, loopEnd?, rms, events? } } — injected at build time */
  function create(ctx, opts = {}) {
    const rnd = rngOf(opts.seed || 777), SR = ctx.sampleRate;
    const G = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const F = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const P = p => { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (n) n.pan.value = p; return n; };
    const chain = (...nodes) => { const ns = nodes.filter(Boolean); for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };
    const noise = (() => { const b = ctx.createBuffer(2, SR * 2, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; } return b; })();

    /* only a safety limiter (no glue compressor: its make-up gain made everything louder and pumped with the waves),
       then a soft ceiling so nothing ever clips */
    const master = G(0), lim = ctx.createDynamicsCompressor(), trim = G(0.88);
    lim.threshold.value = -2; lim.knee.value = 3; lim.ratio.value = 12; lim.attack.value = 0.004; lim.release.value = 0.25;
    const clip = ctx.createWaveShaper(); { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); } clip.curve = c; clip.oversample = '2x'; }
    /* the whole mix is centred on 111 Hz: a gentle lift there, and the very top softened */
    const warm = F('peaking', 111, 0.9); warm.gain.value = 3.5;
    const soft = F('highshelf', 6500, 0.7); soft.gain.value = -3;
    master.connect(warm); warm.connect(soft); soft.connect(lim); lim.connect(trim); trim.connect(clip); clip.connect(ctx.destination);
    const ch = { ocean: G(1), forest: G(1), fire: G(1), insects: G(1), weather: G(1), tone: G(1) };
    Object.values(ch).forEach(g => g.connect(master));
    let enabled = { ocean: true, forest: true, fire: true, insects: true, weather: true, tone: true }, on = false;
    /* a soft 111 Hz tone under everything, breathing slowly with the sea */
    { const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g1 = G(1), g2 = G(0.12), tg = G(0.0), lfo = ctx.createOscillator(), lg = G(0.004);
      o1.type = 'sine'; o1.frequency.value = 111; o2.type = 'sine'; o2.frequency.value = 222; lfo.type = 'sine'; lfo.frequency.value = 1 / 12.9;
      o1.connect(g1); o2.connect(g2); g1.connect(tg); g2.connect(tg); lfo.connect(lg); lg.connect(tg.gain); tg.connect(ch.tone);
      tg.gain.setValueAtTime(0, ctx.currentTime); tg.gain.linearRampToValueAtTime(0.009, ctx.currentTime + 6);
      o1.start(); o2.start(); lfo.start(); }

    /* loops, each normalised to a target loudness and then shaped by time of day */
    const SNDS = opts.sounds || {};
    const LOOPS = { sea: ['ocean', 0.04], crickets: ['insects', 0.013], fire: ['fire', 0.036], birds: ['forest', 0.019], gulls: ['ocean', 0.009], rain: ['weather', 0.055] };
    const L = {}, B = {};
    const oceanLP = F('lowpass', 9000, 0.5), oceanWarm = F('peaking', 111, 1.0), oceanShelf = F('highshelf', 3000, 0.7);
    oceanWarm.gain.value = 5; oceanShelf.gain.value = -6; oceanLP.connect(oceanWarm); oceanWarm.connect(oceanShelf); oceanShelf.connect(ch.ocean);
    const ready = Promise.all(Object.entries(SNDS).map(async ([name, s]) => {
      try {
        /* inlined in the single-file build; a separate file (fetched when sound is first turned on) on the website */
        const buf = await decode(ctx, s.b64 ? b64buf(s.b64) : await (await fetch(s.url)).arrayBuffer()); B[name] = buf;
        const lp = LOOPS[name]; if (!lp || s.loopEnd == null) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = s.loopStart; src.loopEnd = Math.min(s.loopEnd, buf.duration - 0.01);
        const g = G(0), norm = lp[1] / Math.max(s.rms, 1e-3);
        src.connect(g); g.connect(lp[0] === 'ocean' ? oceanLP : ch[lp[0]]);
        src.start(ctx.currentTime + 0.05, s.loopStart + rnd() * (s.loopEnd - s.loopStart) * 0.9);
        L[name] = { src, g, norm };
      } catch (e) { /* a recording that fails to decode just stays silent */ }
    }));

    /* one wave washing up the sand: a recorded wave, chosen at random, louder for bigger waves */
    let lastWash = -1, nWash = 0;
    function play(name, t, gain, pan, rate = 1, lpf = 0) {
      const buf = B[name], ev = SNDS[name] && SNDS[name].events; if (!buf || !ev) return;
      let i = 0; if (ev.length > 1) { i = Math.floor(rnd() * ev.length); if (i === lastWash) i = (i + 1) % ev.length; lastWash = i; }
      const [off, dur, peak] = ev[i], s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
      const g = G(gain), f = lpf ? F('lowpass', lpf, 0.5) : null;
      chain(s, f, g, P(pan), oceanLP);
      const t0 = Math.max(ctx.currentTime, t - (peak ?? 0) / rate);
      s.start(t0, off, dur);
    }
    function wash(t, amp, pan) {
      const a = Math.min(1.4, amp);
      play('swell', t + 0.2, 0.26 + 0.24 * a, pan * 0.5, 0.92 + rnd() * 0.12);
      nWash++;
      if (nWash % 3 === 1 && B.lap) play('lap', t + 0.3, 0.5 + 0.35 * a, pan, 0.94 + rnd() * 0.1, 3200);
      else play('wash', t, 0.16 + 0.24 * a, pan, 0.9 + rnd() * 0.12, 2600 + 1600 * Math.min(1, a));
    }
    /* a big clicked wave: two washes layered with a low thump as it breaks */
    function crash(t, amp, pan) {
      play('crash', t, Math.min(0.75, 0.2 + 0.12 * amp), pan, 0.95 + rnd() * 0.08);
      play('swell', t, Math.min(0.9, 0.35 + 0.12 * amp), -pan * 0.4, 0.85);
      const s = ctx.createBufferSource(); s.buffer = noise; const f = F('lowpass', 160, 0.7), g = G(0);
      chain(s, f, g, P(pan * 0.5), ch.ocean);
      const pk = Math.min(0.2, 0.04 + 0.03 * amp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.25); g.gain.setTargetAtTime(0, t + 0.5, 0.9);
      s.loop = true; s.start(t); s.stop(t + 6);
    }
    function splash(t, k) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = F('bandpass', 1400, 0.8), g = G(0);
      chain(s, f, g, P((rnd() - 0.5) * 0.4), ch.ocean);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035 + 0.012 * k, t + 0.03); g.gain.setTargetAtTime(0, t + 0.06, 0.25);
      f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.5);
      s.start(t); s.stop(t + 2);
    }
    /* a fish's splash: a quick bright spatter and a little falling bloop */
    function plop(t, k, pan) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = F('bandpass', 2600, 1.2), g = G(0);
      chain(s, f, g, P(pan), ch.ocean);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.02 * k, t + 0.01); g.gain.setTargetAtTime(0, t + 0.03, 0.08);
      f.frequency.setValueAtTime(3400, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.25);
      s.start(t); s.stop(t + 0.8);
      const o = ctx.createOscillator(), og = G(0); o.type = 'sine'; chain(o, og, P(pan), ch.ocean);
      o.frequency.setValueAtTime(700 + 400 * rnd(), t); o.frequency.exponentialRampToValueAtTime(240, t + 0.07);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.012 * k, t + 0.005); og.gain.setTargetAtTime(0, t + 0.02, 0.03);
      o.start(t); o.stop(t + 0.3);
    }
    /* a wave meeting rock: a slap of water, the spray falling back, and a low knock at 111 Hz */
    function rockHit(t, k, pan) {
      const buf = B.crash, ev = SNDS.crash && SNDS.crash.events;
      if (buf && ev) {
        const [off, , peak] = ev[Math.floor(rnd() * ev.length)];
        const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 1.15 + rnd() * 0.2;
        const h = F('highpass', 160, 0.6), f = F('lowpass', 2400, 0.6), g = G(0); chain(s, h, f, g, P(pan), oceanLP);
        const t0 = Math.max(ctx.currentTime, t - 0.1);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.3 * k, t0 + 0.06); g.gain.setTargetAtTime(0, t0 + 0.25, 0.45);
        s.start(t0, Math.max(0, off + (peak ?? 0) - 0.12), 2.4);
      }
      const o = ctx.createOscillator(), og = G(0); o.type = 'sine'; o.frequency.value = 111; chain(o, og, P(pan * 0.5), ch.ocean);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.045 * k, t + 0.04); og.gain.setTargetAtTime(0, t + 0.08, 0.28);
      o.start(t); o.stop(t + 1.6);
    }
    function hiss(t) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = F('highpass', 1800, 0.4), g = G(0);
      chain(s, f, F('lowpass', 7000, 0.5), g, ch.fire);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.15); g.gain.setTargetAtTime(0, t + 0.5, 0.9);
      s.start(t); s.stop(t + 6);
    }
    function oneShot(name, t, gain, pan, which, dest) {
      const buf = B[name]; if (!buf) return;
      const s = ctx.createBufferSource(); s.buffer = buf; const g = G(gain); chain(s, g, P(pan), dest);
      const ev = SNDS[name].events; if (ev) { const [off, dur] = ev[which % ev.length]; s.start(t, off, dur); } else s.start(t);
    }
    /* a page turning: a short dry swish of paper */
    function page() {
      const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const f = F('bandpass', 2400, 0.9), g = G(0); chain(s, f, g, P((rnd() - 0.5) * 0.3), master);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.07); g.gain.setTargetAtTime(0, t + 0.16, 0.08);
      f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(4200, t + 0.22);
      s.start(t); s.stop(t + 0.9);
    }

    /* advance to audio time `until`.
       s = { night, crickets, fireI, fireNear, oceanNear, birds, gulls, owl, waves:[{id,t,amp,pan,user}], rocks:[{id,t,k,pan}], douse, rain, thunder:[{id,t,k,pan}] } */
    const st = { lastWaves: new Set(), lastThunder: new Set(), doused: null, owlNext: 20 };
    let cursor = ctx.currentTime;
    function schedule(until, s) {
      const now = Math.max(cursor, ctx.currentTime);
      const set = (name, v, tc = 1.2) => { const l = L[name]; if (l) l.g.gain.setTargetAtTime(Math.max(0, v) * l.norm, now, tc); };
      const near = s.oceanNear ?? 0.5;
      set('sea', 0.75 + 0.4 * near);
      oceanLP.frequency.setTargetAtTime(3200 + 7000 * near, now, 1.0);
      set('crickets', s.crickets ?? s.night ?? 1, 2.5);
      set('fire', (s.fireI ?? 0) * (0.3 + 0.9 * (s.fireNear ?? 0.3)), 0.6);
      set('birds', s.birds ?? 0, 3);
      set('gulls', (s.gulls ?? 0) * (0.6 + 0.4 * Math.sin(now * 0.07)), 3);
      set('rain', s.rain || 0, 1.5);
      for (const w of s.waves || []) {
        if (st.lastWaves.has(w.id) || w.t < now - 0.3 || w.t > until + 2.5) continue;
        st.lastWaves.add(w.id); (w.user ? crash : wash)(Math.max(w.t, now + 0.02), w.amp, w.pan ?? 0);
      }
      for (const r of s.rocks || []) {
        if (st.lastWaves.has(r.id) || r.t < now - 0.3 || r.t > until + 2.5) continue;
        st.lastWaves.add(r.id); rockHit(Math.max(r.t, now + 0.02), r.k, r.pan ?? 0);
      }
      for (const th of s.thunder || []) {
        if (st.lastThunder.has(th.id) || th.t < now - 0.5 || th.t > until + 0.05) continue;
        st.lastThunder.add(th.id); oneShot('thunder', Math.max(th.t, now), 0.55 * th.k, th.pan ?? 0, Math.floor(rnd() * 3), ch.weather);
      }
      if (st.lastWaves.size > 200) st.lastWaves = new Set([...st.lastWaves].slice(-60));
      if (s.douse != null && st.doused !== s.douse && s.douse <= until) { st.doused = s.douse; hiss(Math.max(now, s.douse)); }
      if (s.douse == null) st.doused = null;
      if (st.owlNext < now) st.owlNext = now + 15 + rnd() * 20;
      if (st.owlNext < until) { if ((s.owl ?? 0) > 0.5) oneShot('owl', st.owlNext, 0.18, -0.6 + rnd() * 0.3, 0, ch.forest); st.owlNext += 45 + rnd() * 50; }
      cursor = Math.max(cursor, until);
    }
    function setEnabled(name, v) {
      if (name === 'master') { on = v; master.gain.setTargetAtTime(v ? (opts.level ?? 0.9) : 0, ctx.currentTime, 0.4); return; }
      enabled[name] = v; if (ch[name]) ch[name].gain.setTargetAtTime(v ? 1 : 0, ctx.currentTime, 0.25);
    }
    function fadeIn(t0, dur = 2.5, level = opts.level ?? 0.9) { opts.level = level; master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(level, t0 + dur); on = true; }
    function fadeOut(t0, dur = 1.5) { master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(master.gain.value, t0); master.gain.linearRampToValueAtTime(0, t0 + dur); }
    /* the van. The engine is a recorded loop (Kenney, MIT) played faster as it revs: the pitch follows speed and
       throttle with a little lag, the way a real one winds up. Turning the key cranks it over a few times before it
       catches and flares; parking lets it wind down. Tyres hiss in the sand with speed; knocks are recorded too. */
    const vanG = G(0); vanG.connect(master);
    let eng = null, engOn = false;
    function engineNodes() {
      const buf = B.engine; if (!buf) return null;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = SNDS.engine.loopStart; s.loopEnd = Math.min(SNDS.engine.loopEnd, buf.duration - 0.01);
      /* small speakers can't play the 28 Hz fundamental: take the rumble out, lift the harmonics that carry the sound */
      const hp = F('highpass', 38, 0.7), body = F('peaking', 320, 0.8), lp = F('lowpass', 1400, 0.6), crank = G(1), g = G(0);
      body.gain.value = 4;
      chain(s, hp, body, lp, crank, g, vanG); s.start(ctx.currentTime, SNDS.engine.loopStart);
      const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; const nf = F('bandpass', 700, 0.5), nl = F('lowpass', 2600, 0.5), ng = G(0); chain(n, nf, nl, ng, vanG); n.start();
      return { s, lp, crank, g, ng, nf, norm: 0.038 / Math.max(SNDS.engine.rms, 1e-3) };
    }
    function engine(on, rpm, thr, tyre) {
      if (!eng && on) eng = engineNodes();
      if (!eng) return;
      const t = ctx.currentTime, e = eng;
      if (on && !engOn) {
        /* the key: three or four turns of the starter, then it catches with a rev and settles to idle */
        vanG.gain.cancelScheduledValues(t); vanG.gain.setValueAtTime(vanG.gain.value, t); vanG.gain.linearRampToValueAtTime(1, t + 0.05);
        e.s.playbackRate.cancelScheduledValues(t); e.s.playbackRate.setValueAtTime(0.32, t); e.s.playbackRate.linearRampToValueAtTime(0.4, t + 0.55);
        e.s.playbackRate.linearRampToValueAtTime(1.35, t + 0.82); e.s.playbackRate.setTargetAtTime(0.86, t + 0.85, 0.28);
        e.crank.gain.cancelScheduledValues(t); e.crank.gain.setValueAtTime(0.3, t);
        for (let k = 0; k < 4; k++) { const c = t + 0.04 + k * 0.14; e.crank.gain.linearRampToValueAtTime(0.85, c + 0.04); e.crank.gain.linearRampToValueAtTime(0.3, c + 0.12); }
        e.crank.gain.linearRampToValueAtTime(1, t + 0.7);
        e.g.gain.cancelScheduledValues(t); e.g.gain.setValueAtTime(0.9 * e.norm, t); e.g.gain.setTargetAtTime(1.0 * e.norm, t + 0.8, 0.2);
        e.lp.frequency.setValueAtTime(900, t); e.lp.frequency.linearRampToValueAtTime(2200, t + 0.82); e.lp.frequency.setTargetAtTime(1300, t + 0.9, 0.3);
        e.until = t + 1.25; engOn = true; return;
      }
      if (!on && engOn) {
        /* off: it runs down and stops */
        engOn = false; e.until = t + 1.2;
        e.s.playbackRate.cancelScheduledValues(t); e.s.playbackRate.setValueAtTime(e.s.playbackRate.value, t); e.s.playbackRate.linearRampToValueAtTime(0.3, t + 0.9);
        vanG.gain.cancelScheduledValues(t); vanG.gain.setValueAtTime(vanG.gain.value, t); vanG.gain.linearRampToValueAtTime(0, t + 1.0);
        e.ng.gain.setTargetAtTime(0, t, 0.15); return;
      }
      if (!on || t < e.until) return;
      /* running: idle 0.86, winding up with speed, a little more under throttle */
      const rate = 0.86 + 1.05 * rpm + 0.22 * thr;
      e.s.playbackRate.setTargetAtTime(rate, t, thr > 0.1 ? 0.18 : 0.4);
      e.lp.frequency.setTargetAtTime(1100 + 1500 * thr + 900 * rpm, t, 0.12);
      e.g.gain.setTargetAtTime((0.75 + 0.45 * thr + 0.35 * rpm) * e.norm, t, 0.12);
      e.ng.gain.setTargetAtTime(0.05 * tyre, t, 0.12); e.nf.frequency.setTargetAtTime(450 + 800 * tyre, t, 0.2);
    }
    /* a two-note horn, rounder than a buzzer: detuned saws through a soft body filter */
    function horn() {
      const t = ctx.currentTime, out = G(0), bp = F('bandpass', 900, 0.9), sh = ctx.createWaveShaper();
      { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 2.2); } sh.curve = c; }
      chain(bp, sh, out, master);
      [[392, -6], [392, 6], [494, -4], [494, 4]].forEach(([f, d]) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; const g = G(0.22); o.connect(g); g.connect(bp); o.start(t); o.stop(t + 0.6); });
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.06, t + 0.025); out.gain.setValueAtTime(0.06, t + 0.4); out.gain.linearRampToValueAtTime(0, t + 0.5);
    }
    /* a knock: the recorded impact, louder and lower for harder hits */
    function thud(k) {
      const t = ctx.currentTime, buf = B.impact;
      if (buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.85 + 0.25 * (1 - k) + 0.1 * rnd(); const g = G(Math.min(0.9, 0.15 + 0.7 * k) * 0.06 / Math.max(SNDS.impact.rms, 1e-3)); chain(s, g, master); s.start(t); return; }
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; const f = F('lowpass', 300, 0.8), g = G(0); chain(s, f, g, master);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2 * k, t + 0.01); g.gain.setTargetAtTime(0, t + 0.03, 0.08); s.start(t); s.stop(t + 0.5);
    }
    /* a footstep on sand: a soft, dull crunch, very quiet, a little different every time; in the shallows a brighter slosh */
    function step(k, wet) {
      const t = ctx.currentTime + 0.01, s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const w = Math.min(1, wet || 0), f = F('bandpass', 520 + 300 * rnd() + 900 * w, 0.8 + 0.6 * w), lp = F('lowpass', 1900 + 1500 * w, 0.5), g = G(0);
      chain(s, f, lp, g, P((rnd() - 0.5) * 0.3), master);
      const pk = (0.016 + 0.008 * w) * k;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.012); g.gain.setTargetAtTime(pk * 0.35, t + 0.03, 0.03); g.gain.setTargetAtTime(0, t + 0.07, 0.05 + 0.08 * w);
      s.start(t, rnd() * 1.5); s.stop(t + 0.5);
    }
    return { ctx, ready, schedule, setEnabled, fadeIn, fadeOut, splash: (t, k) => splash(t ?? ctx.currentTime, k || 1), plop: (k, pan) => plop(ctx.currentTime + 0.02, k, pan), page, engine, horn, thud,
      setLevel: v => { opts.level = v; if (on) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2); },
      get enabled() { return enabled; }, get on() { return on; }, master, channels: ch, step };
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
