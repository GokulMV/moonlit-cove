/* The soundscape, rendered offline through the page's own sound graph: every recording decodes, nothing clips, no
   tone hums underneath (111 Hz no louder than its neighbours), waves swell the surf, and it writes a WAV to listen to.
   node tools/soundtest.mjs [seconds 20] [hour 23] */
import { open } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const SEC = +(process.argv[2] || 20), HOUR = +(process.argv[3] || 23);
const { browser, page, logs } = await open({ w: 640, h: 400, rs: 0.25, hour: HOUR });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const r = await page.evaluate(async ([T]) => {
  const SR = 44100, ctx = new OfflineAudioContext(2, SR * T, SR);
  const amb = Ambience.create(ctx, { sounds: SND, seed: 1234, level: 0.9 });
  await amb.ready;
  const names = Object.keys(SND), S = window.__cove.st.S, night = S ? S.night : 1;
  amb.fadeIn(0, 1.0);
  const t0 = window.__cove.st.t, waves = Engine.waveSchedule(t0, t0 + T).map(w => ({ id: w.id, t: w.x - t0, amp: w.amp, user: false }));
  waves.push({ id: 'big', t: T * 0.6, amp: 4, user: true });
  for (let a = 0; a <= T; a += 0.25) amb.schedule(a + 0.6, { waves, night, crickets: night, birds: 1 - night, gulls: 1 - night, owl: night, fireI: night, fireNear: 0.6, oceanNear: 0.6, forestNear: 0.5, rain: 0, thunder: a === 5 ? [{ id: 't1', t: 6, k: 1, pan: 0.2 }] : [] });
  amb.page();
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, sum = 0, nan = 0; for (let i = 0; i < L.length; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (!(a <= 10) || !(b <= 10)) nan++; peak = Math.max(peak, a, b); sum += L[i] * L[i] + R[i] * R[i]; }
  /* the level at 111 Hz against 70 and 160 Hz (Goertzel over the whole render) */
  const goertzel = f => { const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 0; i < L.length; i++) { const s0 = L[i] + c * s1 - s2; s2 = s1; s1 = s0; } return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / L.length; };
  /* the surf's loudness each second (the waves should make it rise and fall) */
  const sec = []; for (let k = 0; k < T; k++) { let e = 0; for (let i = k * SR; i < (k + 1) * SR; i++) e += L[i] * L[i]; sec.push(+Math.sqrt(e / SR).toFixed(4)); }
  const bytes = new Uint8Array(Ambience.wav(buf)); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { names, decoded: names.length, peak, rms: Math.sqrt(sum / (2 * L.length)), nan, g70: goertzel(70), g111: goertzel(111), g160: goertzel(160), sec, wav: btoa(bin) };
}, [SEC]);
console.log('recordings:', r.names.join(', '));
console.log('peak', r.peak.toFixed(3), '· rms', r.rms.toFixed(4), '· 70/111/160 Hz', [r.g70, r.g111, r.g160].map(v => v.toExponential(2)).join(' '));
console.log('loudness by second:', r.sec.join(' '));
check(r.nan === 0, 'no NaN or runaway samples');
check(r.peak < 0.99, 'nothing clips');
check(r.rms > 0.005, 'it is audible');
check(r.g111 < 2.5 * Math.max(r.g70, r.g160), 'no tone at 111 Hz');
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist', 'soundscape.wav'); fs.writeFileSync(out, Buffer.from(r.wav, 'base64')); console.log('wrote', out);
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close(); process.exit(fails ? 1 : 0);
