/* Models in daylight in the studio (dist/studio.html: node tools/build3d.mjs studio): one large view of a model with
   its shadows, standing on the ground with a person beside it, or several side by side at their real sizes.
   Each argument is a JSON spec:
     {"name":"flora/emergent","opts":{"seed":3},"view":[az,el],"zoom":1,"centre":[x,y,z],"w":1600,"h":1100,
      "ground":"soil|sand|grass|grid|water|none","human":true|false|[x,y,z,ry],"sun":[az,el],"fov":32,"out":"emergent_a"}
     {"lineup":[{"name":"flora/emergent","opts":{}},{"name":"flora/canopy"}],"gap":2,"out":"trees"}
   Written to shots/hero_<out>.png. az is the azimuth from +x round toward +z, el the elevation, both in radians. */
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
for (const arg of process.argv.slice(2)) {
  let spec; try { spec = JSON.parse(arg); } catch (e) { console.log('  ? ' + arg); continue; }
  const t0 = Date.now(), out = spec.out || (spec.name || 'lineup').replace(/[^\w.-]+/g, '_');
  try {
    const r = await page.evaluate(s => s.lineup ? window.Studio.lineup(s.lineup, s) : window.Studio.hero(s.name, s), spec);
    const file = path.join(shots, 'hero_' + out + '.png');
    fs.writeFileSync(file, Buffer.from(r.url.split(',')[1], 'base64'));
    console.log(`${out}: ${JSON.stringify(r.size)} m, ${r.tris} triangles, ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(root, file)}`);
  } catch (e) { console.log(`${out}: failed: ${e.message.split('\n')[0]}`); }
}
console.log(errs.length ? `${errs.length} page errors` : 'no page errors');
await browser.close();
