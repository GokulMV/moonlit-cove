/* The blueprint sheets, drawn straight to files (no scene): node tools/sheetlook.mjs [sheet index, or all] [prefix sheet] */
import { open, root } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const which = process.argv[2] ?? 'all', prefix = process.argv[3] || 'sheet';
const { browser, page } = await open({ w: 800, h: 500, enter: false });
const urls = await page.evaluate(which => { const P = Pages.plans(Content); return P.canvases.map((c, i) => (which === 'all' || +which === i) ? c.toDataURL('image/png').slice(22) : null); }, which);
urls.forEach((u, i) => { if (u) { fs.writeFileSync(path.join(root, 'shots', `${prefix}_${i}.png`), Buffer.from(u, 'base64')); console.log('  saved', i); } });
await browser.close();
