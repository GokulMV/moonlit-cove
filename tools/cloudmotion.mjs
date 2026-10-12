/* The clouds in motion, measured. Frames are stepped one by one (as the film is), the clouds' clock and the camera
   driven exactly, and the pictures read back and compared:

     flow    every layer of cloud (the cumulus heaps, the cirrus veils, the mackerel altocumulus) drifts the same way
             across the sky, the higher ones a little slower (measured by matching patches of sky between two moments)
     lapse   at 100× and 1000× the clouds race but leave no trail: the picture kept over frames matches the same sky
             drawn afresh and left to settle
     pan     the same while the camera turns
     discs   no ring round the sun or the moon
     grid    every weather at noon, sunset and night, for the eye
     strip   a time-lapse filmstrip, for the eye

   node tools/cloudmotion.mjs [parts flow,lapse,pan,discs] [width 640] [height 360] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const parts = (process.argv[2] || 'flow,lapse,pan,discs').split(','), W = +(process.argv[3] || 640), H = +(process.argv[4] || 360);
const out = path.join(root, 'shots', 'clouds'); fs.mkdirSync(out, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; return c; };
const T0 = Date.now(), lap = m => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(5) + 's ' + m);
const { browser, page, logs } = await open({ w: W, h: H, rs: 1, dtCap: 1, hour: 15 });
await page.evaluate(() => { window.__coveFilm = true; });
await page.waitForFunction(() => window.__cove.film.on, null, { timeout: 120000 });
await page.addStyleTag({ content: '#hud{display:none!important}' });
/* the picture quality held where it is (the page would lower it, finding software rendering slow) */
await page.evaluate(() => { const st = window.__cove.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; });
lap('open');

/* ── driving the page ── */
/* (no lightning: its flashes come at random, and would differ between two pictures meant to match) */
const setWx = (w) => page.evaluate(w => { const c = window.__cove; if (typeof w === 'object') { c.WX.__test = w; w = '__test'; } c.st.weather = w; Object.assign(c.st.wx, c.WX[w]); c.st.nextBolt = 1e15; c.st.flash = null; }, w);
const setHour = h => page.evaluate(h => { const st = window.__cove.st; st.timeMode = 'custom'; st.hour = h; st.offset = 0; }, h);
const setCam = c => page.evaluate(c => { window.__coveCamFix = c; }, c);
/* a camera on the beach looking out to sea at the sky, turned yaw radians from straight out, pitched up */
const skyCam = (yaw, pitch, fov = 60) => page.evaluate(([yaw, pitch, fov]) => {
  const x = Layout.camp.x, z = Layout.camp.z + 2, y = 1.7;
  return { pos: [x, y, z], look: [x + Math.sin(yaw) * Math.cos(pitch) * 10, y + Math.sin(pitch) * 10, z - Math.cos(yaw) * Math.cos(pitch) * 10], fov, focus: 30 };
}, [yaw, pitch, fov]);
/* n frames of dt seconds each; flow is the time-lapse (1, 100, 1000); motion 0 stops the scene's own clock (and the
   clouds' with it, at flow 1); cam(i) may move the camera each frame. Returns the last frame's pixels (and a PNG). */
async function run(n, { dt = 1 / 30, flow = 1, motion = 0.7, cam = null, grab = true } = {}) {
  let g = null;
  for (let i = 0; i < n; i++) {
    if (cam) await setCam(await cam(i));
    g = await page.evaluate(([dt, flow, motion, last]) => {
      const c = window.__cove; c.st.flow = flow; c.st.motion = motion; c.filmStep(dt);
      if (!last) return null;
      const cv = document.getElementById('scene'), gl = cv.getContext('webgl2'), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let s = ''; for (let k = 0; k < px.length; k += 0x8000) s += String.fromCharCode.apply(null, px.subarray(k, k + 0x8000));
      return { w, h, px: btoa(s), png: cv.toDataURL('image/png').slice(22) };
    }, [dt, flow, motion, grab && i === n - 1]);
  }
  if (!g) return null;
  const px = Buffer.from(g.px, 'base64');
  return { w: g.w, h: g.h, px, png: Buffer.from(g.png, 'base64') };
}
const save = (f, name) => { fs.writeFileSync(path.join(out, name + '.png'), f.png); return f; };
/* luminance, top row first (the GL read starts at the bottom) */
function lum(f) {
  const { w, h, px } = f, L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((h - 1 - y) * w + x) * 4; L[y * w + x] = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; }
  return L;
}
/* the cloud's own texture: what is left once the sky's broad gradient (a heavy blur) is taken away */
function detail(L, w, h, r = 6) {
  const tmp = new Float32Array(w * h), bl = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let s = 0, n = 0; for (let x = -r; x < w + r; x++) { if (x + r < w) { s += L[y * w + Math.min(w - 1, x + r)]; n++; } if (x - r - 1 >= 0) { s -= L[y * w + x - r - 1]; n--; } if (x >= 0) tmp[y * w + x] = s / Math.max(1, n); } }
  for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let y = -r; y < h + r; y++) { if (y + r < h) { s += tmp[Math.min(h - 1, y + r) * w + x]; n++; } if (y - r - 1 >= 0) { s -= tmp[(y - r - 1) * w + x]; n--; } if (y >= 0) bl[y * w + x] = s / Math.max(1, n); } }
  const D = new Float32Array(w * h); for (let i = 0; i < w * h; i++) D[i] = L[i] - bl[i]; return D;
}
/* how far a patch of sky moved between two pictures: the shift (within ±R pixels) that best lines it up, to a tenth of
   a pixel; and how much better that fits than no shift at all (a patch with nothing in it can't be trusted) */
function shiftOf(A, B, w, h, x0, y0, bw, bh, R = 14) {
  const err = (dx, dy) => { let s = 0, n = 0; for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) { const xb = x + dx, yb = y + dy; if (xb < 0 || yb < 0 || xb >= w || yb >= h) continue; const d = A[y * w + x] - B[yb * w + xb]; s += d * d; n++; } return n ? s / n : 1e9; };
  let best = { e: 1e18, dx: 0, dy: 0 };
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const e = err(dx, dy); if (e < best.e) best = { e, dx, dy }; }
  const sub = (em, e0, ep) => { const den = em - 2 * e0 + ep; return den > 1e-9 ? Math.max(-0.5, Math.min(0.5, 0.5 * (em - ep) / den)) : 0; };
  const fx = sub(err(best.dx - 1, best.dy), best.e, err(best.dx + 1, best.dy)), fy = sub(err(best.dx, best.dy - 1), best.e, err(best.dx, best.dy + 1));
  let energy = 0; for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) energy += A[y * w + x] * A[y * w + x];
  energy /= bw * bh;
  return { dx: best.dx + fx, dy: best.dy + fy, fit: 1 - best.e / Math.max(1e-6, err(0, 0)), energy, e: best.e };
}
/* how far one picture is from another over the sky (above the horizon row): mean and 99th-percentile difference */
function diff(fa, fb, yMax) {
  const A = fa.px, B = fb.px, w = fa.w, h = fa.h, d = [];
  for (let y = 0; y < yMax; y++) for (let x = 0; x < w; x++) { const i = ((h - 1 - y) * w + x) * 4; d.push((Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3); }
  d.sort((a, b) => a - b); const mean = d.reduce((s, v) => s + v, 0) / d.length;
  return { mean, p99: d[Math.floor(d.length * 0.99)], p999: d[Math.floor(d.length * 0.999)] };
}
/* a picture of the difference (brightened), to look at */
function diffPng(fa, fb, name) {
  return page.evaluate(([a, b, w, h]) => {
    const A = Uint8Array.from(atob(a), c => c.charCodeAt(0)), B = Uint8Array.from(atob(b), c => c.charCodeAt(0));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), im = x.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = ((h - 1 - y) * w + i) * 4, t = (y * w + i) * 4; for (let k = 0; k < 3; k++) im.data[t + k] = Math.min(255, Math.abs(A[s + k] - B[s + k]) * 6); im.data[t + 3] = 255; }
    x.putImageData(im, 0, 0); return cv.toDataURL('image/png').slice(22);
  }, [fa.px.toString('base64'), fb.px.toString('base64'), fa.w, fa.h]).then(p => fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(p, 'base64')));
}
/* the row the horizon falls on, for the camera now */
const horizonRow = () => page.evaluate(() => { const c = window.__coveCamFix, p = Engine.project([c.pos[0] + (c.look[0] - c.pos[0]) * 1e4, c.pos[1], c.pos[2] + (c.look[2] - c.pos[2]) * 1e4]); return Math.max(0, Math.min(1, p[1])); });

const ONLY = { none: { cirrus: 0, alto: 0, cumulus: 0, stratus: 0, storm: 0, rain: 0 }, cumulus: { cirrus: 0, alto: 0, cumulus: 1.0, stratus: 0, storm: 0, rain: 0 }, cirrus: { cirrus: 1, alto: 0, cumulus: 0, stratus: 0, storm: 0, rain: 0 }, alto: { cirrus: 0, alto: 1, cumulus: 0, stratus: 0, storm: 0, rain: 0 } };

if (parts.includes('flow')) {
  console.log('flow: every layer drifts the same way, the higher ones slower');
  await setHour(15);
  /* First the geometry itself, worked out exactly as the shaders do it: where a bit of each layer seen at a point on the
     screen goes as the wind carries the clouds on (the cumulus a real layer of air some 2.2 km up; the cirrus and the
     altocumulus each a sheet painted in perspective, with its own scale and drift). This is what had gone wrong: the
     painted sheets slid the other way from the heaps, and many times faster. */
  const views = [['out to sea', 0, 0.38], ['along the beach', 1.35, 0.45], ['the other way', -1.35, 0.45]];
  const DT = 9;
  for (const [vname, yaw, pitch] of views) {
    /* (along the beach from the camp and up above the palms: nothing but sky in the way) */
    const cam = await skyCam(yaw, pitch, 60); cam.pos[0] += 40; cam.look[0] += 40; cam.pos[1] += 40; cam.look[1] += 40;
    await setCam(cam);
    await run(1, { motion: 0, grab: false });
    /* the geometry, as the shaders do it (see above), at points across the sky */
    const geom = (pts, DT) => page.evaluate(([DT, pts]) => {
      const c = window.__coveCamFix, cam = c.pos, D = DT * 16;
      const w = Engine.dbg.sky().uniforms.uWind.value, wn = Math.hypot(w.x, w.y), wx = w.x / wn, wz = w.y / wn;
      const shellT = (h0, dy, H) => { const RE = 6.371e6, b = (RE + h0) * dy, cc = (H - h0) * (2 * RE + H + h0), s = Math.sqrt(b * b + cc); return b >= 0 ? cc / (b + s) : s - b; };
      const toScr = d => { const p = Engine.project([cam[0] + d[0] * 1e4, cam[1] + d[1] * 1e4, cam[2] + d[2] * 1e4]); return [p[0], p[1]]; };
      const fromScr = (sx, sy) => Engine.dirAt(sx, sy);
      const sheetDir = (P, C, K) => { const r = Math.hypot(P[0], P[1]) / K, u = [P[0] / K / r, P[1] / K / r]; let lo = 0, hi = Math.PI / 2; for (let k = 0; k < 60; k++) { const e = (lo + hi) / 2; if (Math.cos(e) / (Math.sin(e) + C) > r) lo = e; else hi = e; } const e = (lo + hi) / 2; return [Math.cos(e) * u[0], Math.sin(e), Math.cos(e) * u[1]]; };
      const sheetP = (d, C, K) => [d[0] / (Math.max(d[1], 0) + C) * K, d[2] / (Math.max(d[1], 0) + C) * K];
      const res = [];
      for (const [sx, sy] of pts) {
        const d = fromScr(sx, sy); if (!d || d[1] < 0.03) { res.push(null); continue; }
        /* the cumulus: a bit of cloud 2.2 km up along d, carried D metres downwind */
        const t = shellT(cam[1], d[1], 2200), X = [d[0] * t + wx * D, d[1] * t, d[2] * t + wz * D];
        const s0 = toScr(d), sc = toScr(X.map(v => v / Math.hypot(...X)));
        const m = { cu: [(sc[0] - s0[0]) * 640, (sc[1] - s0[1]) * 360] };
        /* the cirrus: a sheet painted in perspective */
        { const P = sheetP(d, 0.1, 0.1), F = 2.0e-5, P2 = [P[0] + wx * D * F, P[1] + wz * D * F], s2 = toScr(sheetDir(P2, 0.1, 0.1)); m.ci = [(s2[0] - s0[0]) * 640, (s2[1] - s0[1]) * 360]; }
        /* the altocumulus: a real layer 5.2 to 5.65 km up, on a wind a third stronger */
        { const ta = shellT(cam[1], d[1], 5420), XA = [d[0] * ta + wx * D * 1.3, d[1] * ta, d[2] * ta + wz * D * 1.3], s2 = toScr(XA.map(v => v / Math.hypot(...XA))); m.al = [(s2[0] - s0[0]) * 640, (s2[1] - s0[1]) * 360]; }
        res.push({ at: [sx, sy], ...m });
      }
      return res;
    }, [DT, pts]);
    const g = (await geom([[0.2, 0.15], [0.5, 0.12], [0.8, 0.2], [0.3, 0.4], [0.7, 0.42], [0.5, 0.3]], DT)).filter(Boolean);
    /* and on a grid across the whole picture, for the test below */
    const GX = 21, GY = 13, gpts = []; for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) gpts.push([i / (GX - 1), j / (GY - 1)]);
    /* (the cirrus is followed over longer: it moves slower, and its long streaks run the way it moves) */
    const DTC = 40, fields = { [DT]: await geom(gpts, DT), [DTC]: await geom(gpts, DTC) };
    let worstCos = 1, ratios = { ci: [], al: [] };
    for (const r of g) for (const L of ['ci', 'al']) {
      const a = r.cu, b = r[L], cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) + 1e-9);
      worstCos = Math.min(worstCos, cos); ratios[L].push(Math.hypot(...b) / Math.max(1e-9, Math.hypot(...a)));
    }
    const rr = L => ratios[L].length ? `${Math.min(...ratios[L]).toFixed(2)}–${Math.max(...ratios[L]).toFixed(2)}` : '-';
    console.log(`    ${vname}, worked out: the cumulus moves ${g.map(r => '(' + r.cu.map(v => v.toFixed(1)).join(',') + ')').join(' ')} px`);
    console.log(`      cirrus at ${rr('ci')} of its speed, altocumulus at ${rr('al')}; the worst agreement in direction cos ${worstCos.toFixed(3)}`);
    ok(g.length >= 3 && worstCos > 0.97, `${vname}: worked out, every layer moves the same way across the screen`);
    ok(ratios.ci.every(v => v > 0.2 && v < 1.0) && ratios.al.every(v => v > 0.3 && v < 1.0), `${vname}: worked out, the high cloud moves slower than the heaps`);

    /* then the pictures: each layer alone, settled; the clouds' clock on nine ticks; settled again. Does the second
       picture match the first moved as worked out? Moved by s times the worked-out motion, for s from -1.5 to 2, how
       well do they match: the best s should be about 1 (and nowhere near -1, which is the wrong way). This holds even
       for the cirrus, whose long streaks give a patch-matcher too little to hold on to. */
    const mot = (L, x, y, field) => {   /* the worked-out motion of layer L at pixel (x, y), from the grid */
      const fx = x / (W - 1) * (GX - 1), fy = y / (H - 1) * (GY - 1), i = Math.min(GX - 2, Math.floor(fx)), j = Math.min(GY - 2, Math.floor(fy)), u = fx - i, v = fy - j;
      const q = (ii, jj) => field[jj * GX + ii];
      const c4 = [q(i, j), q(i + 1, j), q(i, j + 1), q(i + 1, j + 1)]; if (c4.some(c => !c)) return null;
      const k = L === 'cumulus' ? 'cu' : L === 'cirrus' ? 'ci' : 'al';
      return [0, 1].map(e => (c4[0][k][e] * (1 - u) + c4[1][k][e] * u) * (1 - v) + (c4[2][k][e] * (1 - u) + c4[3][k][e] * u) * v);
    };
    for (const layer of ['cumulus', 'cirrus', 'alto']) {
      await setWx(ONLY[layer]);
      const dt = layer === 'cirrus' ? DTC : DT, field = fields[dt];
      const A = save(await run(10, { motion: 0 }), `flow_${vname.replace(/ /g, '_')}_${layer}_a`);
      /* (in steps of no more than twenty ticks: a bigger leap of the clouds' clock is taken for a jump, and ignored) */
      for (let left = dt; left > 0; left -= 20) { await page.evaluate(d => { window.__cove.st.t += d; }, Math.min(20, left)); await run(1, { motion: 0, grab: false }); }
      const B = save(await run(10, { motion: 0 }), `flow_${vname.replace(/ /g, '_')}_${layer}_b`);
      const LA = detail(lum(A), W, H), LB = detail(lum(B), W, H), hr = Math.floor((await horizonRow()) * H);
      const samp = (x, y) => { if (x < 0 || y < 0 || x > W - 1.001 || y > H - 1.001) return null; const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j; return (LB[j * W + i] * (1 - u) + LB[j * W + i + 1] * u) * (1 - v) + (LB[(j + 1) * W + i] * (1 - u) + LB[(j + 1) * W + i + 1] * u) * v; };
      const px = []; for (let y = 4; y < hr - 8; y += 2) for (let x = 8; x < W - 8; x += 2) { const m = mot(layer, x, y, field); if (m) px.push([x, y, m]); }
      const E = sc => { let e = 0, n = 0; for (const [x, y, m] of px) { const b = samp(x + sc * m[0], y + sc * m[1]); if (b === null) continue; const dd = b - LA[y * W + x]; e += dd * dd; n++; } return n ? e / n : 1e9; };
      const ss = []; for (let sc = -1.5; sc <= 2.001; sc += 0.25) ss.push([sc, E(sc)]);
      let bi = 0; ss.forEach((v, i) => { if (v[1] < ss[bi][1]) bi = i; });
      let best = ss[bi][0]; if (bi > 0 && bi < ss.length - 1) { const [em, e0, ep] = [ss[bi - 1][1], ss[bi][1], ss[bi + 1][1]], den = em - 2 * e0 + ep; if (den > 0) best += 0.25 * 0.5 * (em - ep) / den; }
      const e1 = E(1), em1 = E(-1), e0 = E(0);
      console.log(`    ${vname} ${layer}: best match at ${best.toFixed(2)} times the worked-out motion (mismatch ${e1.toFixed(2)} moved as worked out, ${e0.toFixed(2)} not moved, ${em1.toFixed(2)} moved the other way)`);
      ok(best > 0.55 && best < 1.5 && e1 < e0 && e1 < em1, `${vname}: the ${layer} moves as worked out`);
      lap(`flow ${vname} ${layer}`);
    }
  }
}

if (parts.includes('lapse')) {
  /* steady time-lapse for a while, then the clock stopped and the same sky left to settle: the two should match */
  console.log('lapse: racing clouds leave no trail');
  await setHour(14);
  await setCam(await skyCam(0.5, 0.42, 60));
  /* (the storm without its rain: the streaks of rain differ from one frame to the next whatever the clouds do) */
  const WXS = await page.evaluate(() => window.__cove.WX);
  for (const [wx, flow] of [['puffy', 100], ['puffy', 1000], ['mackerel', 1000], ['storm', 1000]]) {
    await setWx(wx === 'storm' ? Object.assign({}, WXS.storm, { rain: 0 }) : wx);
    await run(6, { motion: 0 });             /* (settle first) */
    const K = save(await run(14, { flow, motion: 0.7 }), `lapse_${wx}_${flow}_moving`);
    const R = save(await run(14, { flow: 1, motion: 0 }), `lapse_${wx}_${flow}_settled`);
    const hr = Math.floor((await horizonRow()) * H), d = diff(K, R, hr);
    await diffPng(K, R, `lapse_${wx}_${flow}_diff`);
    console.log(`    ${wx} at ${flow}×: off the settled sky by ${d.mean.toFixed(2)} on average, ${d.p99.toFixed(1)} at the 99th percentile, ${d.p999.toFixed(1)} at the 99.9th`);
    ok(d.mean < 3.5 && d.p99 < 24, `${wx} at ${flow}×: no trail behind the moving clouds`);
    lap(`lapse ${wx} ${flow}`);
  }
}

if (parts.includes('pan')) {
  console.log('pan: turning the camera leaves no smear');
  await setHour(15); await setWx('puffy');
  const yaw0 = -0.6, rate = 0.35 / 30;       /* 20 degrees a second, at 30 frames a second */
  await setCam(await skyCam(yaw0, 0.4, 60)); await run(6, { motion: 0 });
  const K = save(await run(16, { motion: 0.7, cam: i => skyCam(yaw0 + (i + 1) * rate, 0.4, 60) }), 'pan_moving');
  const R = save(await run(14, { motion: 0 }), 'pan_settled');
  const hr = Math.floor((await horizonRow()) * H), d = diff(K, R, hr);
  await diffPng(K, R, 'pan_diff');
  console.log(`    off the settled sky by ${d.mean.toFixed(2)} on average, ${d.p99.toFixed(1)} at the 99th percentile`);
  ok(d.mean < 3.5 && d.p99 < 24, 'no smear while the camera turns');
  lap('pan');
}

if (parts.includes('discs')) {
  /* the sun (by day) and the moon (by night) close up: brightness round them should fall away smoothly, with no ring
     where the shader stops drawing the disc (8 degrees out from the sun, 5.7 from the moon) */
  console.log('discs: nothing ringed round the sun or the moon');
  for (const [what, hour, ringDeg] of [['sun', 15, 8.11], ['moon', 23, 5.73]]) {
    await setHour(hour); await setWx(ONLY.none); await run(1, { motion: 0, grab: false });
    const dir = await page.evaluate(w => { const S = window.__cove.st.S; return w === 'sun' ? S.sunDirV : S.moonDirV; }, what);
    if (dir[1] < -0.005) { console.log(`    the ${what} is down at ${hour}h: skipped`); continue; }
    /* (from along the beach and up above the palms: nothing between the camera and the sky) */
    const cam = await page.evaluate(d => { const x = Layout.camp.x + 40, z = Layout.camp.z + 2, y = 41.7; return { pos: [x, y, z], look: [x + d[0] * 10, y + d[1] * 10, z + d[2] * 10], fov: 30, focus: 30 }; }, dir);
    await setCam(cam);
    const F = save(await run(8, { motion: 0 }), `disc_${what}`);
    const L = lum(F), cx = W / 2, cy = H / 2, pxPerDeg = H / 30, hr = Math.floor((await horizonRow()) * H) - 3;
    /* the brightness on rings round the centre, every tenth of a degree: a ring shows as a bump against its neighbours */
    const prof = [];
    for (let r10 = 20; r10 <= 130; r10++) {
      /* (the median round each ring, so the odd star on it doesn't count) */
      const r = r10 / 10 * pxPerDeg, vs = [];
      for (let k = 0; k < 720; k++) { const a = k / 720 * 2 * Math.PI, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (x < 0 || y < 0 || x >= W || y >= hr) continue; vs.push(L[y * W + x]); }
      vs.sort((a, b) => a - b);
      prof.push({ deg: r10 / 10, mean: vs.length ? vs[vs.length >> 1] : 0 });
    }
    /* the falloff either side of the edge (but not at it), fitted with a smooth curve: a ring is what stands off it */
    const win = prof.filter(p => Math.abs(p.deg - ringDeg) < 1.6), fit = win.filter(p => Math.abs(p.deg - ringDeg) > 0.45);
    let A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bv = [0, 0, 0];
    for (const p of fit) { const x = p.deg - ringDeg, v = [1, x, x * x]; for (let i = 0; i < 3; i++) { bv[i] += v[i] * p.mean; for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; } }
    const solve = (M, y) => { const m = M.map((r, i) => [...r, y[i]]); for (let i = 0; i < 3; i++) { let k = i; for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[k][i])) k = r; [m[i], m[k]] = [m[k], m[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const f = m[r][i] / m[i][i]; for (let c = i; c < 4; c++) m[r][c] -= f * m[i][c]; } } return m.map((r, i) => r[3] / r[i]); };
    const cf = solve(A, bv), res = win.filter(p => Math.abs(p.deg - ringDeg) <= 0.45).map(p => { const x = p.deg - ringDeg; return p.mean - (cf[0] + cf[1] * x + cf[2] * x * x); });
    const ring = res.reduce((m, v) => Math.abs(v) > Math.abs(m) ? v : m, 0);
    console.log(`    ${what}: at the ${ringDeg}° edge the brightness stands ${ring.toFixed(2)} off the smooth falloff round it`);
    ok(Math.abs(ring) < 1.0, `no ring round the ${what}`);
  }
}

if (parts.includes('grid')) {
  console.log('grid: every weather at noon, sunset and night');
  /* sunset: the hour the sun stands 3 degrees up, found by halving */
  let lo = 15, hi = 21.5;
  for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; await setHour(mid); await run(1, { motion: 0, grab: false }); const a = await page.evaluate(() => window.__cove.st.S.sAlt); if (a > 3) lo = mid; else hi = mid; }
  console.log(`    sunset (sun 3° up) at ${((lo + hi) / 2).toFixed(2)}h`);
  const hours = [['noon', 13], ['sunset', (lo + hi) / 2], ['night', 23]];
  for (const [tn, hour] of hours) {
    await setHour(hour);
    for (const wx of ['clear', 'puffy', 'wispy', 'mackerel', 'overcast', 'storm']) {
      await setWx(wx);
      for (const [vn, yaw, pitch] of [['out', 0.2, 0.3], ['sun', null, 0.25]]) {
        let cam;
        if (yaw === null) cam = await page.evaluate(p => { const S = window.__cove.st.S, d = S.sAlt > -4 ? S.sunDirV : S.moonDirV, az = Math.atan2(d[0], -d[2]), x = Layout.camp.x, z = Layout.camp.z + 2, y = 1.7; return { pos: [x, y, z], look: [x + Math.sin(az) * Math.cos(p) * 10, y + Math.sin(p) * 10, z - Math.cos(az) * Math.cos(p) * 10], fov: 60, focus: 30 }; }, pitch);
        else cam = await skyCam(yaw, pitch, 60);
        await setCam(cam);
        save(await run(9, { motion: 0.7 }), `grid_${tn}_${wx}_${vn}`);
      }
      lap(`grid ${tn} ${wx}`);
    }
  }
}

if (parts.includes('strip')) {
  console.log('strip: a time-lapse, for the eye');
  await setHour(15); await setWx('puffy');
  await setCam(await skyCam(0.3, 0.35, 60));
  for (const flow of [1, 100, 1000]) {
    await run(6, { motion: 0 });
    for (let k = 0; k < 6; k++) save(await run(flow === 1 ? 30 : 6, { flow, motion: 0.7 }), `strip_${flow}_${k}`);
    lap(`strip ${flow}×`);
  }
}

const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
