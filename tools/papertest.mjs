/* Node tests for the turning page (no browser): paper.js and cloth.js run on a fake clock with the real three.js and
   stand-in materials. Taps, drags let go either side of halfway, turning back, taps queued behind a moving page, the
   reading counter, closing mid-turn, slow and stalled frames; and all the while the page never passes through the
   pad, the board or the clip, never tears or turns to NaN, and comes to rest as the flat sheet it should be.
   node tools/papertest.mjs [dump.json]   (also writes side profiles of the middle column of each turn, to look at) */
import fs from 'fs'; import path from 'path'; import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const THREE = await import(path.join(root, 'node_modules/three/build/three.module.js'));
let clock = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock * 1000 }, configurable: true, writable: true });
globalThis.window = { __coveDtCap: 0.1 };
globalThis.THREE = THREE;
globalThis.Mats = { lit: p => new THREE.MeshStandardMaterial(p), tex: () => new THREE.Texture() };
/* (PAPER_JS can point at another copy of paper.js, for trying out settings) */
for (const f of ['cloth.js', 'paper.js']) vm.runInThisContext(fs.readFileSync(f === 'paper.js' && process.env.PAPER_JS || path.join(root, 'src3d', f), 'utf8') + `\n;globalThis.${f === 'cloth.js' ? 'Cloth = Cloth' : 'Paper = Paper'};`);
const { Paper } = globalThis;

let failed = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ' · ' + detail : ''}`); if (!ok) failed++; };
const dump = process.argv[2] ? { runs: [] } : null;

/* a sheet held as in the basket view (looking down 29°) or the van view (9°) */
function setup({ board = false, n = 6, W = 0.46, H = 0.325, tilt = 29 } = {}) {
  const p = Paper.build(new THREE.Scene()), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tilt * Math.PI / 180);
  p.open({ W, H, rolled: false, board, pages: Array.from({ length: n }, () => ({})), origin: { p: [0, 0, 0], q: q.toArray() }, held: { p: [0, 0, 0], q: q.toArray() }, fly: 0.5 });
  p.board = board;
  for (let i = 0; i < 60 && p.mode !== 'open'; i++) frame(p);
  return p;
}
/* the real pad or board and clip, without the collider's margins */
const solid = p => { const H = p.state.H; return p.board ? { yt: H / 2 + 0.032, back: -0.006, clip: [H / 2 + 0.005, H / 2 + 0.035, -0.0025, 0.0095] } : { yt: H / 2, back: -0.0012 }; };
/* one frame (60 fps unless told), watching the page: the deepest it gets into anything solid, its worst stretch in
   each phase, and NaN */
const watch = { into: 0, strain: {}, nan: false, phase: '' };
function frame(p, dt = 1 / 60) {
  clock += dt; p.update();
  const cl = p.cloth.cl; if (!p.state.turn || !cl) return;
  if (!cl.P.every(Number.isFinite)) watch.nan = true;
  const at = [0, 0], e = cl.strain(at), L = Math.hypot(...[0, 1, 2].map(k => cl.R[at[0] * 3 + k] - cl.R[at[1] * 3 + k]));
  if (e > (watch.strain[watch.phase] || [0])[0]) watch.strain[watch.phase] = [e, e * L];
  const s = solid(p);
  for (let i = 8; i < cl.n; i++) {
    const y = cl.P[i * 3 + 1], z = cl.P[i * 3 + 2];
    if (y < s.yt - 0.001 && z < 0.0006 - 1e-4 && z > s.back + 1e-4) watch.into = Math.max(watch.into, Math.min(0.0006 - z, z - s.back));
    if (s.clip) { const [y0, y1, z0, z1] = s.clip; if (y > y0 && y < y1 && z > z0 && z < z1) watch.into = Math.max(watch.into, Math.min(y - y0, y1 - y, z - z0, z1 - z)); }
  }
  if (dump && dump.cur && dump.n++ % 5 === 0) { const prof = []; for (let j = 0; j < 22; j++) { const k = (j * 8 + 4) * 3; prof.push([cl.P[k + 1], cl.P[k + 2]]); } dump.cur.frames.push({ label: `${watch.phase} ${(dump.n / 60).toFixed(2)}s`, prof }); }
}
function phase(p, name) { watch.phase = name; if (dump) { dump.cur = { label: `${p.board ? 'clip' : 'pad'} ${name}`, H: p.state.H, board: p.board, frames: [] }; dump.runs.push(dump.cur); dump.n = 0; } }
const settle = (p, max = 4) => { let t = 0; while (p.state.turn && t < max) { frame(p); t += 1 / 60; } return t; };
const flat = p => { const cl = p.cloth.cl; let d = 0; for (let i = 0; i < cl.n * 3; i++) d = Math.max(d, Math.abs(cl.P[i] - cl.R[i])); return d; };
const drag = (p, dir, f, steps = 12) => { p.dragStart(dir); for (let i = 1; i <= steps; i++) { p.dragTo(f * i / steps); frame(p); frame(p); } };

for (const [name, opts] of [['pad (blueprints)', { board: false, n: 6, W: 0.46, H: 0.325, tilt: 29 }], ['clipboard', { board: true, n: 6, W: 0.24, H: 0.336, tilt: 9 }]]) {
  Object.assign(watch, { into: 0, strain: {}, nan: false });
  const p = setup(opts);
  check(p.mode === 'open' && p.idx === 0 && p.count === opts.n, `${name}: opens on the first page`);
  /* a tap forward: the counter shows the page being turned to at once; the turn lands on it */
  phase(p, 'tap'); p.turn(1);
  check(p.target === 1 && p.idx === 0 && p.busy(), `${name}: tap → the counter shows page 2 while it turns`);
  let t = settle(p);
  check(!p.state.turn && p.idx === 1, `${name}: the tap turn lands on page 2`, `in ${t.toFixed(2)} s`);
  check(t > 0.9 && t < 2.0, `${name}: a turn takes about a second`, `${t.toFixed(2)} s`);
  check(p.cloth.lip.visible && !p.cloth.meshes[0].visible, `${name}: the turned page stays behind as the lip; the cloth is put away`);
  /* two quick taps: the second waits for the first to land, while the counter runs ahead */
  phase(p, 'two taps'); p.turn(1); frame(p); p.turn(1);
  check(p.target === 3, `${name}: a second tap is queued and counted`, `target ${p.target}`);
  t = 0; while ((p.state.turn || p.idx < 3) && t < 6) { frame(p); t += 1 / 60; }
  check(p.idx === 3 && !p.state.turn, `${name}: queued taps both land`, `on page ${p.idx + 1}`);
  /* a drag forward let go before halfway: it bows up, then goes back down flat */
  phase(p, 'drag'); drag(p, 1, 0.36);
  check(p.dragging, `${name}: a drag takes hold of the page`);
  const out = (() => { const cl = p.cloth.cl; let z = 0; for (let i = 0; i < cl.n; i++) z = Math.max(z, cl.P[i * 3 + 2]); return z; })();
  check(out > 0.03, `${name}: dragged part-way, the page bows up off the pile`, `${(out * 100).toFixed(1)} cm out`);
  check(p.dragEnd(false) === false, `${name}: let go short of halfway, it does not turn`);
  phase(p, 'drag let go'); t = 0; let last = Infinity; while (p.state.turn && t < 3) { last = flat(p); frame(p); t += 1 / 60; }
  check(!p.state.turn && p.idx === 3, `${name}: …it settles back on the same page`, `in ${t.toFixed(2)} s`);
  check(last < 0.004, `${name}: …lying flat when the flat sheet takes over`, `${(last * 1000).toFixed(2)} mm off`);
  /* a drag back past halfway: the last page turned comes back over the top and down */
  phase(p, 'drag back'); drag(p, -1, 0.6);
  check(p.dragEnd(true) === true, `${name}: a drag back let go past halfway turns back`);
  phase(p, 'drag back let go'); t = 0; last = Infinity; while (p.state.turn && t < 3) { last = flat(p); frame(p); t += 1 / 60; }
  check(!p.state.turn && p.idx === 2 && last < 0.004, `${name}: …and lands flat on the page before`, `page ${p.idx + 1}, ${(last * 1000).toFixed(2)} mm off, in ${t.toFixed(2)} s`);
  /* a drag back let go early: it falls back behind */
  phase(p, 'drag back early'); drag(p, -1, 0.24, 6); p.dragEnd(false); t = settle(p);
  check(!p.state.turn && p.idx === 2, `${name}: a drag back let go early falls back behind`, `in ${t.toFixed(2)} s`);
  /* back taps all the way to the start: nothing is left turned over */
  phase(p, 'back taps'); p.turn(-1); frame(p); p.turn(-1);
  t = 0; while ((p.state.turn || p.idx > 0) && t < 6) { frame(p); t += 1 / 60; }
  check(p.idx === 0 && !p.cloth.lip.visible, `${name}: back on the first page, nothing left turned over`);
  check(!p.turn(-1), `${name}: there is no page before the first`);
  check(!watch.nan, `${name}: never NaN`);
  check(watch.into < 0.0005, `${name}: never passes through the ${opts.board ? 'board or the clip' : 'pad'}`, `deepest ${(watch.into * 1000).toFixed(2)} mm`);
  /* (paper should not stretch at all; for a moment, where it wraps a corner or right at the edge being pulled fast,
     a link a few millimetres longer is the most a solver this size allows. This is a guard against anything worse) */
  const worst = Object.entries(watch.strain).sort((a, b) => b[1][0] - a[1][0]);
  check(worst[0][1][0] < 0.5 && Math.max(...worst.map(w => w[1][1])) < 0.01, `${name}: never tears`, worst.slice(0, 3).map(([k, v]) => `${k} ${(v[0] * 100).toFixed(0)}% (${(v[1] * 1000).toFixed(1)} mm)`).join(', '));
  /* closing in the middle of a turn puts everything away */
  p.turn(1); for (let i = 0; i < 20; i++) frame(p); p.close(); for (let i = 0; i < 120; i++) frame(p);
  check(p.mode === 'hidden' && !p.state.turn && !p.cloth.meshes[0].visible && !p.cloth.lip.visible, `${name}: closing mid-turn puts the page away`);
  /* a slow device (10 fps) and a stalled one (a 2 s frame) still land the turn */
  const q = setup(opts); q.turn(1); t = 0; while (q.state.turn && t < 5) { frame(q, 0.1); t += 0.1; }
  check(q.idx === 1, `${name}: at 10 fps the turn still lands`, `in ${t.toFixed(1)} s`);
  q.turn(1); frame(q, 2); t = settle(q);
  check(q.idx === 2 && q.cloth.cl.P.every(Number.isFinite), `${name}: a 2 s stall in mid-turn does no harm`);
}
if (dump) { dump.runs.forEach(r => delete r.cur); fs.writeFileSync(process.argv[2], JSON.stringify({ runs: dump.runs })); }
console.log(failed ? `\n${failed} check(s) failed` : '\nall paper checks passed');
process.exit(failed ? 1 : 0);
