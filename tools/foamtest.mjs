/* The swash, close up: a camera a few metres above the waterline looking along the beach, a frame every couple of
   seconds of a wave cycle. node tools/foamtest.mjs [hour] [name] */
import { open, shot, wait } from './lib.mjs';
const hour = +(process.argv[2] || 13), name = process.argv[3] || 'foam';
const { browser, page } = await open({ hour, rs: 0.6, w: 960, h: 600 });
await page.evaluate(() => {
  const c = window.__cove, x = 44, sz = Layout.shoreZ(x), lx = x - 11;
  c.st.to = { pos: [x, 1.9, sz + 3.2], look: [lx, 0.0, Layout.shoreZ(lx) + 0.6], fov: 46, focus: 9 };
  c.st.from = c.st.to; c.st.camT = 1;
});
const frames = async n => { const f0 = await page.evaluate(() => window.__cove.st.t); await page.waitForFunction(([f0, n]) => window.__cove.st.t >= f0 + n * 0.5 - 1e-6, [f0, n], { timeout: 120000 }); };
for (let i = 0; i < 6; i++) { await frames(2); await shot(page, `${name}_${i}`); }
await browser.close();
