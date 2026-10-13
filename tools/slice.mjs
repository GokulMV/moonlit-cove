/* Sections through a model's sculpted parts (wild/rig.js), for shaping them: each argument a JSON spec
     {"name":"wild/macaque","opts":{},"part":"head","plane":"z","at":0,"box":[u0,u1,v0,v1],"ppm":5000,"ref":[[[u,v],…]],"out":"mq_head_side"}
   (plane z: a side view at z = at; x: head on, at x = at; y: from above). Written to shots/slice_<out>.png. */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import fs from 'fs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), shots = path.join(root, 'shots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
page.on('pageerror', e => console.log('  pageerror:', e.message.slice(0, 400)));
await page.goto('file://' + path.join(root, 'dist/studio.html'), { timeout: 120000 });
await page.waitForFunction(() => window.Studio, null, { timeout: 120000 });
for (const arg of process.argv.slice(2)) {
  const spec = JSON.parse(arg), t0 = Date.now();
  try {
    const r = await page.evaluate(s => window.Studio.slice(s.name, s), spec);
    const file = path.join(shots, 'slice_' + (spec.out || 'slice') + '.png');
    fs.writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'));
    console.log(`${spec.out}: ${r.size.join('×')} px, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(root, file)}`);
  } catch (e) { console.log(`${spec.out}: failed: ${e.message.split('\n')[0]}`); }
}
await browser.close();
