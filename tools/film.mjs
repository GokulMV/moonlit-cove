/* The film: a flight round the cove after dark, rendered frame by exact frame in headless Chromium, with its
   soundtrack rendered offline through the same sound graph the page plays (each wave's wash lands as it reaches
   the sand on screen), then put together by ffmpeg.

   node tools/film.mjs [seconds 24] [fps 30] [width 3840] [height 2160] [hour 20.5]
   node tools/film.mjs probe [width] [height]      how long a frame takes at that size

   Writes dist/film/moonlit-cove-<w>x<h>.mp4 (H.264, AAC 48 kHz). */
import { open } from './lib.mjs';
import { spawn } from 'child_process';
import fs from 'fs'; import path from 'path';
const args = process.argv.slice(2), probe = args[0] === 'probe'; if (probe) args.shift();
const SEC = probe ? 0.2 : +(args[0] || 24), FPS = probe ? 15 : +(args[1] || 30), W = +(args[probe ? 0 : 2] || 3840), H = +(args[probe ? 1 : 3] || 2160), HOUR = +(args[4] || 20.5);
const N = Math.round(SEC * FPS), root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), out = path.join(root, 'dist', 'film');
fs.mkdirSync(out, { recursive: true });
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

const { browser, page, logs } = await open({ w: W, h: H, rs: 1, dtCap: 1 / FPS, hour: HOUR, init: () => { window.__coveShadow = 2048; } });
log('page ready at', W + '×' + H);
/* the page's own frames stop; from here every frame is stepped by hand */
await page.evaluate(() => { window.__coveFilm = true; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });

/* the flight, as keyframes for the explore camera: [time, turn, tilt, zoom (log), x along the beach, fraction across the sand] */
const HOME = await page.evaluate(() => Array.from(window.__cove.orb.T));
const shack = await page.evaluate(() => { for (const x of [-400, 0, 400]) Engine.world.update(x, 1e9); const L = Engine.shacks.sites().filter(s => s.kind === 'shack').sort((a, b) => Math.abs(a.x) - Math.abs(b.x)); return L[0] ? L[0].x : -160; });
const [Y0, E0, Z0, X0, U0] = HOME, S = SEC / 24;
const KEYS = [
  [0, Y0 - 0.12, E0 + 0.05, Z0 + 0.32, X0, U0],
  [5 * S, Y0 + 0.02, E0 - 0.02, Z0 + 0.02, X0, U0],
  [9 * S, Y0 + 0.55, E0 - 0.08, Z0 - 0.28, X0 + 1.5, U0],
  [13 * S, Y0 + 1.25, E0 + 0.02, Z0 - 0.1, X0 + 3, U0 * 0.9],
  [17 * S, Math.PI - 0.35, E0 - 0.12, Z0 + 0.05, (X0 + shack) * 0.55, 0.5],
  [21 * S, Math.PI - 0.15, E0 - 0.1, Z0 - 0.15, shack, 0.55],
  [24 * S, Math.PI + 0.05, E0 + 0.12, Z0 + 0.3, shack + 6, 0.5]];
/* a smooth path through them (Catmull-Rom on each axis, eased in and out at the ends) */
function at(t) {
  let i = KEYS.findIndex(q => q[0] >= t); if (i < 0) i = KEYS.length - 1; i = Math.max(1, i);
  const a = KEYS[Math.max(0, i - 2)], b = KEYS[i - 1], c = KEYS[i], d = KEYS[Math.min(KEYS.length - 1, i + 1)];
  const u = Math.min(1, Math.max(0, (t - b[0]) / Math.max(1e-6, c[0] - b[0]))), s = u * u * (3 - 2 * u) * 0.35 + u * 0.65;
  return [1, 2, 3, 4, 5].map(j => { const p0 = a[j], p1 = b[j], p2 = c[j], p3 = d[j], s2 = s * s, s3 = s2 * s;
    return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3); });
}

/* the frames, straight into ffmpeg */
const vid = path.join(out, `video-${W}x${H}.mp4`);
const ff = probe ? null : spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', vid], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = ff ? new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))) : null;
const sceneT0 = await page.evaluate(() => window.__cove.st.t);
/* a wave sent in by hand, mid-way, so the film has one big swell running up the beach */
let sent = false;
for (let f = 0; f < N; f++) {
  const t = f / FPS, v = at(t), tf = Date.now();
  if (!probe && !sent && t >= 8 * S) { sent = true; await page.evaluate(() => { const c = window.__cove; Engine.clickSea(0.52, 0.44, c.st.t); Engine.clickSea(0.5, 0.45, c.st.t + 0.3); }); }
  const jpg = await page.evaluate(([v, dt]) => {
    const c = window.__cove, o = c.orb; for (let i = 0; i < 5; i++) { o.T[i] = o.v[i] = v[i]; o.dv[i] = o.g[i] = 0; } o.fly = null;
    c.filmStep(dt);
    return document.getElementById('scene').toDataURL('image/jpeg', 0.93).slice(23);
  }, [v, 1 / FPS]);
  const buf = Buffer.from(jpg, 'base64');
  if (ff) { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  else fs.writeFileSync(path.join(out, `probe-${W}x${H}-${f}.jpg`), buf);
  if (probe || f % 10 === 0 || f === N - 1) log(`frame ${f + 1}/${N} in ${((Date.now() - tf) / 1000).toFixed(1)} s`);
}
if (probe) { await browser.close(); process.exit(0); }
ff.stdin.end(); await ffDone; log('video', vid);

/* the soundtrack: the same graph, offline, on the scene's own clock (film time 0 = scene time sceneT0) */
const wavB64 = await page.evaluate(async ([T, t0]) => {
  const SR = 48000, ctx = new OfflineAudioContext(2, Math.ceil(SR * (T + 0.5)), SR);
  const amb = Ambience.create(ctx, { sounds: typeof SND !== 'undefined' ? SND : {}, seed: 1234, level: 0.9 });
  await amb.ready;
  const S = window.__cove.st.S, sAlt = S ? S.sAlt : -20, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const tod = { fire: 1 - sm(-1, 7, sAlt), crickets: 1 - sm(-9, -2, sAlt), birds: sm(-11, -3, sAlt) * 0.55, gulls: sm(1, 10, sAlt), owl: 1 - sm(-14, -8, sAlt) };
  amb.fadeIn(0, 2.2);
  const waves = Engine.waveSchedule(t0 - 1, t0 + T + 6).map(w => ({ id: w.id, t: w.x - t0, amp: w.amp, user: !!w.user, pan: (((w.x * 7.3) % 1 + 1) % 1 - 0.5) * 0.5 }));
  for (let a = 0; a <= T; a += 0.25) amb.schedule(a + 0.6, { waves, night: S ? S.night : 1, crickets: tod.crickets, birds: tod.birds, gulls: tod.gulls, owl: tod.owl, fireI: tod.fire, fireNear: a < T * 0.55 ? 0.6 : 0.2, oceanNear: 0.55, rain: 0 });
  amb.fadeOut(T - 1.6, 1.6);
  const buf = await ctx.startRendering(), bytes = new Uint8Array(Ambience.wav(buf));
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}, [SEC, sceneT0]);
const wav = path.join(out, 'soundtrack.wav'); fs.writeFileSync(wav, Buffer.from(wavB64, 'base64')); log('soundtrack', wav);
await browser.close();

const film = path.join(out, `moonlit-cove-${W}x${H}.mp4`);
await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', vid, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', film], { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('mux failed'))));
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
log('film', film, (fs.statSync(film).size / 1e6).toFixed(1) + ' MB', errs.length ? '· page errors: ' + errs.slice(0, 3).join(' | ') : '· no page errors');
