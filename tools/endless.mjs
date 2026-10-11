/* The endless coast: the shaders draw the shoreline Layout computes (a JavaScript port of the GLSL to 1e-6 m, and the
   GLSL itself, read back from the GPU, to float precision); then an autopilot drives the van about 1.3 km each way
   from the camp, building the chunks of coast as it goes, and reports where it got stuck (if anywhere), how far it
   went, the worst chunk build step, and screenshots: the camp, headlands, far away.
   node tools/endless.mjs [metres each way] */
import { open, shot, wait, until } from './lib.mjs';
const each = +(process.argv[2] || 1300), t0 = Date.now();
const { browser, page, logs } = await open({ w: 960, h: 600, rs: 0.3, init: () => {
  window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f);
  new MutationObserver((m, o) => { const b = document.getElementById('enterQuiet'); if (b && !b.disabled) { window.__readyAt = performance.now(); o.disconnect(); } })
    .observe(document, { subtree: true, attributes: true, attributeFilter: ['disabled'] });
} });
const frames = async n => { const f0 = await page.evaluate(() => window.__frames); await until(page, k => window.__frames >= k, f0 + n, 600000); };
console.log('enter buttons ready after', Math.round(await page.evaluate(() => window.__readyAt)), 'ms in the page;', JSON.stringify(await page.evaluate(() => Engine.world.counts)));
await frames(3); await shot(page, 'endless_camp');

/* ── 1. the shoreline: GLSL against Layout ── */
const coast = await page.evaluate(() => {
  const S = Layout.SH, VG = Layout.VG, WIN = Layout.WIN, U = Mats.coastU, out = [];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* the GLSL of glsl.js (coastZ, coastDZ, coastVeg), line for line, in double precision, on the uniforms as they are */
  function port() {
    const H = U.uHeadL.value, C = U.uCoast.value, P = U.uCoastP.value, Q = U.uCoastQ.value;
    const head = xl => { let h = 0; for (const v of H) { const u = (xl - v.x) * v.w; if (Math.abs(u) < 6) h += v.z * Math.exp(-u * u); } return h; };
    const headD = xl => { let r = 0; for (const v of H) { const u = (xl - v.x) * v.w; if (Math.abs(u) < 6) r -= 2 * v.z * u * v.w * Math.exp(-u * u); } return r; };
    const win = xl => ss(WIN.r0, WIN.r1, Math.abs(xl + C.y));
    const winD = xl => { const a = xl + C.y, t = Math.min(1, Math.max(0, (Math.abs(a) - WIN.r0) / (WIN.r1 - WIN.r0))); return Math.sign(a) * 6 * t * (1 - t) / (WIN.r1 - WIN.r0); };
    const slow = xl => S.a3 * Math.sin(xl * S.f3 + Q.y) + S.a4 * Math.sin(xl * S.f4 + Q.z) + S.a5 * Math.sin(xl * S.f5 + Q.w);
    const slowD = xl => S.a3 * S.f3 * Math.cos(xl * S.f3 + Q.y) + S.a4 * S.f4 * Math.cos(xl * S.f4 + Q.z) + S.a5 * S.f5 * Math.cos(xl * S.f5 + Q.w);
    return {
      z: x => { const xl = x - C.x; return C.z + S.a1 * Math.sin(xl * S.f1 + P.x) + S.a2 * Math.sin(xl * S.f2 + P.y) + S.tl * Math.sin(xl * S.kt + P.z) + win(xl) * slow(xl) - head(xl); },
      dz: x => { const xl = x - C.x; return S.a1 * S.f1 * Math.cos(xl * S.f1 + P.x) + S.a2 * S.f2 * Math.cos(xl * S.f2 + P.y) + S.tilt * Math.cos(xl * S.kt + P.z) + winD(xl) * slow(xl) + win(xl) * slowD(xl) - headD(xl); },
      veg: x => { const xl = x - C.x; return C.w + VG.a1 * Math.sin(xl * VG.f1 + P.w) + VG.a2 * Math.sin(xl * VG.f2 + Q.x) + VG.tl * Math.sin(xl * S.kt + P.z) + VG.x * win(xl) * slow(xl) - 0.55 * head(xl); } };
  }
  /* and the GLSL itself, evaluated on the GPU into a row of floats */
  const N = 2048, R = Engine.renderer, rt = new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, depthBuffer: false });
  const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uX0: { value: 0 }, uDX: { value: 1 } }, U), vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: GLSL.COMMON + 'uniform float uX0, uDX;\nvoid main(){ float x = uX0 + floor(gl_FragCoord.x)*uDX; gl_FragColor = vec4(coastZ(x), coastDZ(x), coastVeg(x), x); }' });
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); q.frustumCulled = false; sc.add(q);
  const px = new Float32Array(N * 4);
  for (const cx of [0, 140, -1300, 1300, 5432.1, -24000, 150000]) {
    Engine.coastFollow(cx); const F = port();
    let ez = 0, edz = 0, ev = 0, gz = 0, gdz = 0, gv = 0;
    for (let x = cx - 1200; x <= cx + 1200; x += 0.731) {
      ez = Math.max(ez, Math.abs(F.z(x) - Layout.shoreZ(x))); edz = Math.max(edz, Math.abs(F.dz(x) - Layout.shoreDZ(x))); ev = Math.max(ev, Math.abs(F.veg(x) - Layout.vegZ(x)));
    }
    mat.uniforms.uX0.value = cx - 1200; mat.uniforms.uDX.value = 2400 / N;
    R.setRenderTarget(rt); R.render(sc, cam); R.readRenderTargetPixels(rt, 0, 0, N, 1, px); R.setRenderTarget(null);
    for (let i = 0; i < N; i++) { const x = px[i * 4 + 3]; gz = Math.max(gz, Math.abs(px[i * 4] - Layout.shoreZ(x))); gdz = Math.max(gdz, Math.abs(px[i * 4 + 1] - Layout.shoreDZ(x))); gv = Math.max(gv, Math.abs(px[i * 4 + 2] - Layout.vegZ(x))); }
    out.push({ cx, port: [ez, edz, ev].map(v => v.toExponential(1)), gpu: [gz, gdz, gv].map(v => v.toExponential(1)), ok: Math.max(ez, edz, ev) < 1e-6 && Math.max(gz, gv) < 3e-3 && gdz < 1e-3 });
  }
  rt.dispose(); mat.dispose(); Engine.coastFollow(Engine.camera.position.x + 1e6); Engine.coastFollow(Engine.camera.position.x);
  return out;
});
console.log('shoreline, GLSL vs Layout, max |difference| (shoreZ, shoreDZ, vegZ) over ±1200 m round each x:');
for (const c of coast) console.log('  x', String(c.cx).padStart(7), ' port', c.port.join(' '), ' gpu', c.gpu.join(' '), c.ok ? ' ok' : ' MISMATCH');

/* ── 2. the drive ── */
await page.evaluate(() => {
  const C = window.__cove, car = C.car, W = Engine.world, keys = C.keys, ap = window.__ap = { stuck: [], respawns: [], hits: 0, minClear: 9, lane: 0, odo: 0, t: 0 };
  /* steer for a point a few metres ahead, at whatever height of the beach is clearest: near the water's edge where
     nothing is in the way, round anything that is, never up the rock; reverse out when stuck, and if that fails,
     put the van back on open sand (the R key) and count it */
  const clearAt = (x, z) => { let c = 9; for (const [dx, dz, r, o] of C.obstaclesNear(x, z)) if (!(o[3] === 'rock' && r < 0.55)) c = Math.min(c, Math.hypot(dx, dz) - r); return c; };
  function pick(xa) {
    const sz = Layout.shoreZ(xa), top = Math.min(Layout.vegZ(xa) - 1.2, sz + 7); let best = sz + 2.5, bc = 1e9;
    for (let z = sz - 1.2; z <= top; z += 0.5) {
      const cl = clearAt(xa, z), m = W.massif(xa, z);
      const cost = Math.abs(z - (sz + 2.5)) * 0.25 + (cl < 1.7 ? (1.7 - cl) * 20 : 0) + (m > 0.15 ? 50 + m * 10 : 0) + (z < sz - 0.4 ? 1.5 : 0);
      if (cost < bc) { bc = cost; best = z; }
    }
    return best;
  }
  window.__drive = (dir, xEnd, steps) => {
    const dt = 1 / 30; let rev = 0;
    for (let s = 0; s < steps; s++) {
      if (s % 8 === 0) W.update(car.x, 1e9);
      if ((xEnd - car.x) * dir <= 0) return { done: true };
      const xa = car.x + dir * (6 + Math.min(6, Math.abs(car.v))), za = pick(xa);
      const want = Math.atan2(-(za - car.z), xa - car.x); let e = want - car.h; e = Math.atan2(Math.sin(e), Math.cos(e));
      keys.clear();
      ap.hist = ap.hist || []; ap.hist.push(car.x); if (ap.hist.length > 120) ap.hist.shift();
      const moved = ap.hist.length === 120 ? Math.abs(car.x - ap.hist[0]) : 99;
      if (rev > 0) { rev--; keys.add('s'); keys.add(e > 0 ? 'd' : 'a'); }
      else if (moved < 1.5) {
        const here = ap.stuck.find(p => Math.abs(p.x - car.x) < 12);
        if (here && ++here.n >= 3) { ap.respawns.push({ x: +car.x.toFixed(1), z: +car.z.toFixed(1) }); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'r' })); here.n = 0; }
        else if (!here) ap.stuck.push({ x: +car.x.toFixed(1), z: +car.z.toFixed(1), n: 1 });
        rev = 45; ap.hist.length = 0;
        if (Math.abs(e) > Math.PI / 2) car.h += Math.PI;   /* (the autopilot lost its way: face along the beach again) */
      }
      else { keys.add('w'); if (Math.abs(e) > 0.06) keys.add(e > 0 ? 'a' : 'd'); }
      const x0 = car.x, z0 = car.z; C.stepCar(dt); ap.t += dt; ap.odo += Math.hypot(car.x - x0, car.z - z0);
      ap.lane = Math.max(ap.lane, Math.abs(car.z - (Layout.shoreZ(car.x) + 2.5)));
      if (W.massif(car.x, car.z) > 0.3) ap.hits++;
      ap.minClear = Math.min(ap.minClear, clearAt(car.x, car.z));
    }
    keys.clear();
    return { done: false };
  };
  window.__coveDtCap = 1e-4;   /* the page's own frames hardly move the van while the autopilot drives it */
  C.startDrive(); car.k = car.camK = 1;   /* (packed up, the camera behind it: with the page's frames held back these would take for ever) */
});
async function drive(label, dir, xEnd) {
  const ts = Date.now();
  for (let k = 0; k < 400; k++) { const r = await page.evaluate(([d, x]) => window.__drive(d, x, 300), [dir, xEnd]); if (r.done) break; }
  const s = await page.evaluate(() => { const c = window.__cove.car, a = window.__ap; return { x: +c.x.toFixed(1), z: +c.z.toFixed(1), simT: +a.t.toFixed(0), odo: +a.odo.toFixed(0), stuck: a.stuck, respawns: a.respawns, onRock: a.hits, lane: +a.lane.toFixed(1) }; });
  console.log(label, JSON.stringify(s), 'in', ((Date.now() - ts) / 1000).toFixed(0), 's');
  return s;
}
/* a snapshot from behind the van wherever it is (the chase camera brought straight there) */
async function snap(name, x, dir) {
  await page.evaluate(([x, dir]) => { const c = window.__cove.car, z = Layout.shoreZ(x) + 2.5; Object.assign(c, { x, z, h: dir > 0 ? 0 : Math.PI, v: 0, camP: null, k: 1, camK: 1 }); Engine.world.update(x, 1e9); }, [x, dir]);
  await frames(3); await shot(page, name);
}
const west = await drive(`west to ${-each}:`, -1, -each);
await snap('endless_far_west', -each + 40, -1);
await page.evaluate(() => { const c = window.__cove.car; Object.assign(c, { x: 12, z: Layout.shoreZ(12) + 2.5, h: 0, v: 0, stuckT: 0, wheels: null }); window.__ap.hist = []; window.__ap.stuck = []; });
const east = await drive(`east to ${each}:`, 1, each);
await snap('endless_far_east', each - 40, 1);
/* headlands: the camp's own point to the east, and the first seeded one each way */
const hs = await page.evaluate(() => Layout.heads(-1400, 1400).map(h => ({ i: h.i, hx: +h.hx.toFixed(1), w: +h.w.toFixed(1), d: +h.d.toFixed(1), gap: +h.gap.toFixed(1), stacks: h.stacks })));
console.log('headlands within 1.4 km:', hs.map(h => `${h.hx} (w ${h.w}, d ${h.d}, gap ${h.gap})`).join(', '));
const seeded = hs.filter(h => h.i !== 0 && h.i !== -1);
await snap('endless_head_camp', 132 - 45, 1);
if (seeded.length) { const e = seeded.find(h => h.hx > 0), w = [...seeded].reverse().find(h => h.hx < 0); if (e) await snap('endless_head_east', e.hx - 45, 1); if (w) await snap('endless_head_west', w.hx + 45, -1); }
const counts = await page.evaluate(() => Engine.world.counts);
console.log('world:', JSON.stringify(counts));
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 8).join('\n  ') : 'no page errors');
console.log('verdict:', coast.every(c => c.ok) ? 'shoreline matches' : 'SHORELINE MISMATCH', '·', west.respawns.length + east.respawns.length ? `stuck for good ${west.respawns.length + east.respawns.length}×` : 'never stuck for good',
  '· worst chunk build step', counts.worst, 'ms (' + counts.worstAt + ') · done in', ((Date.now() - t0) / 1000).toFixed(0), 's');
await browser.close();
