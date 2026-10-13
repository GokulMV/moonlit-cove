/* Paint blade textures (FloraBlade painters) and save each variant as colour over grey, colour over white and its
   normal map side by side, to shots/tex_<out>.png. Each argument: {"kind":"fern","opts":{"hue":98},"k":0,"out":"fern"} */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path'; import fs from 'fs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), shots = path.join(root, 'shots');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
page.on('pageerror', e => console.log('  pageerror:', e.message.slice(0, 400)));
await page.goto('file://' + path.join(root, 'dist/studio.html'), { timeout: 120000 });
await page.waitForFunction(() => window.Studio, null, { timeout: 120000 });
for (const arg of process.argv.slice(2)) {
  const s = JSON.parse(arg);
  try {
    const url = await page.evaluate(s => {
      if (s.litter) {   /* (the forest floor's tile: its colour, and its normal map beside it) */
        const L = FloraLitter.tex(s.litter), N = L.map.image.width, o = document.createElement('canvas'); o.width = N * 2; o.height = N; const x = o.getContext('2d');
        x.putImageData(new ImageData(new Uint8ClampedArray(L.map.image.data.buffer.slice(0)), N, N), 0, 0); x.putImageData(new ImageData(new Uint8ClampedArray(L.normalMap.image.data.buffer.slice(0)), N, N), N, 0);
        return o.toDataURL('image/png');
      }
      const { a, b, W, H } = FloraBlade.canvases(s.kind, s.opts || {}, s.k || 0);
      const o = document.createElement('canvas'); o.width = W * 3; o.height = H; const x = o.getContext('2d');
      x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, W, H); x.drawImage(a.canvas, 0, 0);
      x.fillStyle = '#e8e8e8'; x.fillRect(W, 0, W, H); x.drawImage(a.canvas, W, 0);
      x.drawImage(b.canvas, W * 2, 0);
      return o.toDataURL('image/png');
    }, s);
    fs.writeFileSync(path.join(shots, 'tex_' + (s.out || s.kind) + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('tex_' + (s.out || s.kind));
  } catch (e) { console.log((s.out || s.kind || 'litter') + ': ' + e.message.split('\n')[0]); }
}
await browser.close();
