/* The drawing board: open it, draw on the paper itself with a pencil and a crayon (the strokes land on the paper in the
   scene), undo one, put it in the toolbox, then open the toolbox and look at it large.
   node tools/sketchtest.mjs [hour 15]. (The test page has no server: the toolbox keeps it on this device) */
import { open, shot, until } from './lib.mjs';
const hour = +(process.argv[2] || 15);
const { browser, page, logs } = await open({ w: 1280, h: 800, rs: 0.8, hour });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { window.__coveDtCap = 0.5; localStorage.removeItem('cove.drawings'); window.__cove.openSketch(); });
await until(page, () => window.__cove.st.camT >= 1, null, 120000);
await frames(2);
check(await page.evaluate(() => window.__cove.sketch.on && !document.getElementById('sketchBar').hidden), 'the board opens with its tools');
/* where the paper is on screen: its corners through the camera */
const rect = await page.evaluate(() => { const f = Engine.sketchFrame(), c = (u, v) => Engine.project([0, 1, 2].map(i => f.o[i] + f.right[i] * (u - 0.5) * f.W + f.top[i] * (v - 0.5) * f.H)); const r = document.getElementById('scene').getBoundingClientRect();
  return [c(0, 0), c(1, 0), c(1, 1), c(0, 1)].map(p => [r.left + p[0] * r.width, r.top + p[1] * r.height]); });
console.log('paper on screen:', rect.map(p => p.map(Math.round)));
const P = (u, v) => [rect[0][0] + (rect[1][0] - rect[0][0]) * u + (rect[3][0] - rect[0][0]) * v, rect[0][1] + (rect[1][1] - rect[0][1]) * u + (rect[3][1] - rect[0][1]) * v];
/* a stroke as the pointer would make it, dispatched in one go (real mouse moves each wait for a software-drawn frame) */
async function stroke(pts) {
  const sp = []; for (let i = 0; i < pts.length; i++) { const a = P(...pts[Math.max(0, i - 1)]), b = P(...pts[i]); for (let k = i ? 1 : 0; k <= 4; k++) sp.push([a[0] + (b[0] - a[0]) * k / 4, a[1] + (b[1] - a[1]) * k / 4]); }
  await page.evaluate(sp => { const cv = document.getElementById('scene'), ev = (type, [x, y]) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
    ev('pointerdown', sp[0]); sp.slice(1).forEach(p => ev('pointermove', p)); ev('pointerup', sp[sp.length - 1]); }, sp);
}
const tap = sel => page.evaluate(sel => document.querySelector(sel).click(), sel);
/* a house, a sun, the sea */
await stroke([[0.25, 0.3], [0.25, 0.6], [0.45, 0.6], [0.45, 0.3], [0.25, 0.3], [0.35, 0.15], [0.45, 0.3]]);
await tap('[data-skcol="#e8c62a"]'); await tap('[data-sktool="crayon"]');
await stroke(Array.from({ length: 13 }, (_, i) => [0.75 + 0.08 * Math.cos(i / 12 * 6.283), 0.25 + 0.1 * Math.sin(i / 12 * 6.283)]));
await tap('[data-skcol="#2a6fc8"]'); await tap('[data-sktool="marker"]');
await stroke([[0.05, 0.8], [0.2, 0.75], [0.35, 0.82], [0.5, 0.76], [0.65, 0.83], [0.8, 0.77], [0.95, 0.81]]);
await tap('[data-skcol="#c8352e"]'); await tap('[data-sktool="pen"]');
await stroke([[0.6, 0.55], [0.9, 0.6]]);
await tap('#skUndo');
await frames(2);
const marks = await page.evaluate(() => window.__cove.sketch.marks);
check(marks === 3, `three strokes kept after one undo (${marks})`);
const inked = await page.evaluate(() => { const d = window.__cove.sketch.inkX.getImageData(0, 0, 800, 600).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; });
check(inked > 4000, `the strokes landed on the paper (${inked} pixels of ink)`);
await shot(page, `sketch_draw_${hour}`);
await page.evaluate(() => { document.getElementById('skName').value = 'Test bench'; });
await tap('#skKeep');
await until(page, () => !window.__cove.sketch.on, null, 60000).catch(() => {});
await frames(2);
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('cove.drawings') || '[]').length);
check(kept === 1, 'it went into the toolbox (on this device, with no server)');
await page.evaluate(() => window.__cove.openToolbox());
await until(page, () => (window.__cove.tbox.list || []).length > 0, null, 60000).catch(() => {});
await until(page, () => window.__cove.st.camT >= 1, null, 60000).catch(() => {});
await frames(3);
check(await page.evaluate(() => document.querySelectorAll('#tbGrid .tb-item').length === 1), 'the toolbox shows it');
await shot(page, `sketch_toolbox_${hour}`);
await tap('#tbGrid .tb-item'); await frames(2);
check(await page.evaluate(() => !document.getElementById('tbView').hidden && document.getElementById('tbWho').textContent === 'Test bench'), 'opened large, signed');
await shot(page, `sketch_view_${hour}`);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await frames(2);
check(await page.evaluate(() => !window.__cove.tbox.on), 'Esc closes it');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close(); process.exit(fails ? 1 : 0);
