/* Node tests for the cloth solver (no browser): stability over a long gusty run, no NaN, small constraint error,
   pins that stay put, collisions that hold, the same motion at different frame rates, and the mesh binding. */
import fs from 'fs'; import path from 'path'; import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const THREE = await import(path.join(root, 'node_modules/three/build/three.module.js'));
globalThis.THREE = THREE;
vm.runInThisContext(fs.readFileSync(path.join(root, 'src3d/cloth.js'), 'utf8') + '\n;globalThis.Cloth = Cloth;');
const Cloth = globalThis.Cloth;

let failed = 0;
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ' · ' + detail : ''}`); if (!ok) failed++; };
const finite = a => a.every(Number.isFinite);

/* 1. a flag on a pole: held only by two corners (the hardest case for stretch), a storm's gusty wind, 10 000 steps */
{
  const nx = 14, ny = 10, W = 0.9, H = 0.6;
  const c = Cloth.create({ grids: [{ nx, ny, at: (i, j) => [i / (nx - 1) * W, -j / (ny - 1) * H, 0], pin: (i, j) => i === 0 && (j === 0 || j === ny - 1), stretch: 1, shear: 0.8, bend: 0.25 }], step: 1 / 480, iters: 3, damp: 1, air: 4 });
  c.wind.dir.set([1, 0, 0.2]); c.wind.speed = 9; c.wind.gust = 0.7;
  const pins = [0, (ny - 1) * nx].map(i => Array.from(c.P.subarray(i * 3, i * 3 + 3)));
  let worst = 0, nan = false, tip = [];
  for (let s = 0; s < 10000; s++) { c.substep(); if (s % 50 === 0) { if (!finite(c.P)) { nan = true; break; } worst = Math.max(worst, c.strain()); } if (s % 1000 === 0) tip.push(c.P[(nx - 1) * 3 + 2]); }
  check(!nan && finite(c.P), 'flag: 10 000 gusty steps, no NaN');
  check(worst < 0.1, 'flag: structural strain stays small', 'worst ' + (worst * 100).toFixed(2) + '%');
  const moved = pins.map((p, k) => { const i = [0, (ny - 1) * nx][k] * 3; return Math.hypot(c.P[i] - p[0], c.P[i + 1] - p[1], c.P[i + 2] - p[2]); });
  check(Math.max(...moved) === 0, 'flag: pinned corners stay exactly put');
  const spread = Math.max(...tip) - Math.min(...tip);
  check(spread > 0.02, 'flag: the free edge keeps moving in the gusts', 'tip z range ' + spread.toFixed(3) + ' m');
  let ext = 0; for (let i = 0; i < c.n; i++) ext = Math.max(ext, Math.hypot(c.P[i * 3], c.P[i * 3 + 1], c.P[i * 3 + 2]));
  check(ext < Math.hypot(W, H) * 1.08, 'flag: never flies apart', 'furthest particle ' + ext.toFixed(3) + ' m');
}

/* 2. a hanging strip with tethers: pinned along its top edge, it must not sag longer than it is */
{
  const nx = 25, ny = 4, L = 2.5, D = 0.12;
  const c = Cloth.create({ grids: [{ nx, ny, at: (i, j) => [i / (nx - 1) * L, -j / (ny - 1) * D, 0], pin: (i, j) => j === 0, stretch: 1, shear: 0.6, bend: 0.15, tether: true }], iters: 4, damp: 0.02, air: 3 });
  c.wind.dir.set([0.3, 0, 1]); c.wind.speed = 6;
  let worstDrop = 0, nan = false;
  for (let s = 0; s < 10000; s++) { c.substep(); if (s % 25 === 0) { if (!finite(c.P)) { nan = true; break; } for (let i = 0; i < nx; i++) worstDrop = Math.max(worstDrop, Math.hypot(c.P[((ny - 1) * nx + i) * 3] - c.P[i * 3], c.P[((ny - 1) * nx + i) * 3 + 1] - c.P[i * 3 + 1], c.P[((ny - 1) * nx + i) * 3 + 2] - c.P[i * 3 + 2])); } }
  check(!nan, 'strip: 10 000 steps in wind, no NaN');
  check(worstDrop <= D * 1.0021, 'strip: tethers stop it stretching', 'longest drop ' + (worstDrop / D * 100).toFixed(2) + '% of its height');
}

/* 3. collisions: a sheet dropped on a sphere above a floor stays outside both */
{
  const nx = 16, ny = 16, S = 1.2;
  const c = Cloth.create({ grids: [{ nx, ny, at: (i, j) => [(i / (nx - 1) - 0.5) * S, 0.8, (j / (ny - 1) - 0.5) * S], stretch: 1, shear: 0.7, bend: 0.05 }], iters: 8, damp: 0.01 });
  c.colliders.push({ type: 'sphere', c: [0, 0.35, 0], r: 0.3 }, { type: 'plane', n: [0, 1, 0], d: 0 });
  for (let s = 0; s < 3000; s++) c.substep();
  let inS = 0, under = 0; for (let i = 0; i < c.n; i++) { const x = c.P[i * 3], y = c.P[i * 3 + 1], z = c.P[i * 3 + 2]; inS = Math.max(inS, 0.3 - Math.hypot(x, y - 0.35, z)); under = Math.max(under, -y); }
  check(finite(c.P) && inS < 1e-4 && under < 1e-6, 'drape: stays outside the sphere and above the floor', `deepest ${(inS * 1000).toFixed(3)} mm in the sphere`);
  let top = -1; for (let i = 0; i < c.n; i++) top = Math.max(top, c.P[i * 3 + 1]);
  check(top > 0.6 && top < 0.67, 'drape: comes to rest over the top of the sphere', 'highest point ' + top.toFixed(3) + ' m');
}

/* 4. the same cloth at 30, 60 and 144 frames a second ends up in the same place (fixed steps, accumulator),
      and a stalled frame of 3 s is cut short instead of exploding */
{
  const mk = () => { const c = Cloth.create({ grids: [{ nx: 10, ny: 10, at: (i, j) => [i * 0.05, -j * 0.05, 0], pin: (i, j) => j === 0, stretch: 1, shear: 0.6, bend: 0.2 }], iters: 6, damp: 0.01, air: 2 }); c.g.set([0, -9.81, 2]); return c; };
  const run = fps => { const c = mk(); let t = 0; while (t < 2 - 1e-9) { c.update(1 / fps); t += 1 / fps; } return c; };
  const a = run(30), b = run(60), d = run(144);
  let dab = 0, dad = 0; for (let i = 0; i < a.P.length; i++) { dab = Math.max(dab, Math.abs(a.P[i] - b.P[i])); dad = Math.max(dad, Math.abs(a.P[i] - d.P[i])); }
  check(dab < 0.004 && dad < 0.004, 'frame rate: 30, 60, 144 fps agree', `max difference ${(Math.max(dab, dad) * 1000).toFixed(2)} mm`);
  const s = mk(), k = s.update(3);
  check(k === s.maxSteps && finite(s.P) && s.acc <= s.step, 'frame rate: a 3 s stall runs at most maxSteps steps', `${k} steps`);
}

/* 5. the mesh binding writes positions and unit normals in place, without new arrays */
{
  const c = Cloth.create({ grids: [{ nx: 6, ny: 5, at: (i, j) => [i * 0.1, -j * 0.1, 0], pin: (i, j) => j === 0 }] });
  const g = c.geometry(0), pa = g.attributes.position.array, na = g.attributes.normal.array;
  for (let s = 0; s < 200; s++) c.substep(); c.write();
  check(g.attributes.position.array === pa && g.attributes.normal.array === na, 'mesh: updates the same arrays');
  let same = true; for (let i = 0; i < pa.length; i++) if (pa[i] !== c.P[i]) same = false;
  let unit = true; for (let i = 0; i < na.length; i += 3) if (Math.abs(Math.hypot(na[i], na[i + 1], na[i + 2]) - 1) > 1e-4) unit = false;
  const c2 = Cloth.create({ grids: [{ nx: 3, ny: 3, at: (i, j) => [i, -j, 0] }] }), g2 = c2.geometry(0); c2.write();
  check(same && unit && g2.attributes.normal.array[2] > 0.99, 'mesh: positions copied, normals unit length, front face toward +z for a page');
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall cloth checks passed');
process.exit(failed ? 1 : 0);
