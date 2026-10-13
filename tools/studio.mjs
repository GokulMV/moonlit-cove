/* Models on their own in the studio (dist/studio.html: build it with node tools/build3d.mjs studio): each from six
   sides on one sheet, shots/studio_<name>.png. A name may carry options and a pose: life/butterfly{"kind":2}@0.3f
   (the options as JSON, @ the time to pose it at, f in flight, *2 to look closer, #x,y,z to look at that point).
   node tools/studio.mjs life/hermit life/crab ... */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import fs from 'fs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), shots = path.join(root, 'shots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.log('  console error:', m.text().slice(0, 300)); } });
page.on('pageerror', e => { errs.push(e.message); console.log('  pageerror:', e.message.slice(0, 400)); });
await page.goto('file://' + path.join(root, 'dist/studio.html'), { timeout: 120000 });
await page.waitForFunction(() => window.Studio, null, { timeout: 120000 });
for (const spec of process.argv.slice(2)) {
  const m = spec.match(/^([^{@*#]+?)(\{.*\})?(?:@([\d.]+))?(f)?(?:\*([\d.]+))?(?:#([-\d.,]+))?$/);
  if (!m) { console.log('  ? ' + spec); continue; }
  const [, name, json, t, f, zoom, at] = m;
  const t0 = Date.now();
  try {
    const r = await page.evaluate(([name, o]) => window.Studio.sheet(name, o), [name, { opts: json ? JSON.parse(json) : {}, t: t ? +t : 0.6, flying: !!f, zoom: zoom ? +zoom : 1, centre: at ? at.split(',').map(Number) : null }]);
    const file = path.join(shots, 'studio_' + spec.replace(/[^\w.-]+/g, '_') + '.png');
    fs.writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'));
    console.log(`${spec}: ${JSON.stringify(r.size)} m, ${r.tris} triangles, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(root, file)}`);
  } catch (e) { console.log(`${spec}: failed: ${e.message.split('\n')[0]}`); }
}
console.log(errs.length ? `${errs.length} page errors` : 'no page errors');
await browser.close();
