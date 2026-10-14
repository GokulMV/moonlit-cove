/* The far trees' cards beside the trees they are drawn from (impostor.js, in the studio: node tools/build3d.mjs studio).
   node tools/impostorlook.mjs '{"items":[{"name":"flora/canopy","opts":{"seed":3,"lod":1}}],"view":[1.5,0.1],"out":"imp_canopy"}' …
   Writes shots/<out>.png (the pairs) and shots/<out>_atlas.png (the pictures). */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import fs from 'fs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), shots = path.join(root, 'shots');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') { errs.push(m.text()); console.log('  console error:', m.text().slice(0, 300)); } });
page.on('pageerror', e => { errs.push(e.message); console.log('  pageerror:', e.message.slice(0, 400)); });
await page.goto('file://' + path.join(root, 'dist/studio.html'), { timeout: 120000 });
await page.waitForFunction(() => window.Studio, null, { timeout: 120000 });
for (const arg of process.argv.slice(2)) {
  const spec = JSON.parse(arg), out = spec.out || 'imp';
  const r = await page.evaluate(s => window.Studio.impostors(s.items, s), spec);
  fs.writeFileSync(path.join(shots, out + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(shots, out + '_atlas.png'), Buffer.from(r.atlas.split(',')[1], 'base64'));
  console.log(`${out}: atlas ${r.size.join('x')}, baked in ${r.bakeMs} ms, ${r.tris} triangles`);
  /* (and, asked for, one of the atlas's smaller copies: its colour, and its cover as grey) */
  if (spec.dumpLevel !== undefined) {
    const d = await page.evaluate(L => { const A = window.__lastAtlas, lv = A.col.mipmaps[L], c = document.createElement('canvas'); c.width = lv.width; c.height = lv.height * 2; const x = c.getContext('2d'), im = x.createImageData(lv.width, lv.height * 2);
      for (let j = 0; j < lv.height; j++) for (let i = 0; i < lv.width; i++) { const s = ((lv.height - 1 - j) * lv.width + i) * 4, d1 = (j * lv.width + i) * 4, d2 = ((j + lv.height) * lv.width + i) * 4;
        for (let k = 0; k < 3; k++) { im.data[d1 + k] = lv.data[s + k]; im.data[d2 + k] = lv.data[s + 3]; } im.data[d1 + 3] = im.data[d2 + 3] = 255; }
      x.putImageData(im, 0, 0); return c.toDataURL('image/png'); }, spec.dumpLevel);
    fs.writeFileSync(path.join(shots, out + '_lv' + spec.dumpLevel + '.png'), Buffer.from(d.split(',')[1], 'base64'));
  }
}
console.log(errs.length ? `${errs.length} page errors` : 'no page errors');
await browser.close();
