/* Screenshots of the cloth: a blueprint page dragged part-way and over the top, a tap turn caught in flight, a drag
   let go that falls back; a clipboard given three pages, turned; the van's valance and the towel in the wind.
   node tools/clothshots.mjs [paper|clip|wind]   (all three when not told) */
import { open, shot, wait, until } from './lib.mjs';
const only = process.argv[2];
const W = 960, H = 600;
const { browser, page } = await open({ w: W, h: H, rs: 0.5 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const turnP = () => page.evaluate(() => { const t = Engine.paper.state.turn; return t ? { p: +t.p.toFixed(2), free: t.free, idx: Engine.paper.idx, target: Engine.paper.target } : { idx: Engine.paper.idx, target: Engine.paper.target }; });
async function openChapter(id) {
  await page.evaluate(id => window.__cove.openChapter(id), id);
  await until(page, () => !window.__cove.rd.pending && typeof Engine !== 'undefined' && Engine.paper.mode === 'open', null, 400000);
  await frames(2);
}
async function closeChapter() { await page.evaluate(() => window.__cove.openChapter(null)); await wait(page, 2500); }

if (!only || only === 'paper') {
  await openChapter('plans');
  /* each frame moves the paper on by at most 0.1 s, so a turn can be caught in flight */
  await page.evaluate(() => { window.__coveDtCap = 0.1; });
  await shot(page, 'cloth_plans_0');
  /* held part-way by a drag */
  await page.evaluate(() => Engine.paper.dragStart(1));
  for (const f of [0.22, 0.42, 0.6]) { await page.evaluate(f => Engine.paper.dragTo(f), f); await frames(3); console.log('drag', f, await turnP()); await shot(page, 'cloth_plans_drag' + Math.round(f * 100)); }
  /* let go short of halfway: it lies back down */
  await page.evaluate(() => Engine.paper.dragTo(0.3)); await frames(3);
  await page.evaluate(() => Engine.paper.dragEnd(false)); await frames(2); console.log('let go', await turnP()); await shot(page, 'cloth_plans_letgo');
  await until(page, () => !Engine.paper.state.turn, null, 400000); console.log('settled', await turnP());
  /* a tap on the right half, through the page's own pointer handling */
  await page.mouse.click(W * 0.8, H * 0.5);
  for (const [p, name] of [[0.25, 'a'], [0.5, 'b'], [0.7, 'c'], [0.9, 'd']]) {
    await until(page, p => { const t = Engine.paper.state.turn; return !t || t.p >= p || t.free; }, p, 400000);
    console.log('tap', name, await turnP(), await page.evaluate(() => document.getElementById('rPage').textContent)); await shot(page, 'cloth_plans_tap_' + name);
  }
  await until(page, () => !Engine.paper.state.turn, null, 400000); console.log('landed', await turnP());
  await shot(page, 'cloth_plans_landed');
  /* and back again, dragging down past halfway with the mouse */
  await page.mouse.move(W / 2, H * 0.3); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(W / 2, H * 0.3 + i * 22); await wait(page, 60); }
  await frames(2); console.log('drag back', await turnP()); await shot(page, 'cloth_plans_dragback');
  await page.mouse.up();
  await until(page, () => !Engine.paper.state.turn, null, 400000); console.log('after drag back', await turnP(), await page.evaluate(() => document.getElementById('rPage').textContent));
  await page.evaluate(() => { window.__coveDtCap = 0.5; });
  await closeChapter();
}
if (!only || only === 'clip') {
  await openChapter('stack');
  /* the packing list has one page: give the clipboard three, numbered, to turn */
  await page.evaluate(() => {
    const src = document.createElement('canvas'), c0 = Engine.paper.state.pages[0].image;
    const pages = [1, 2, 3].map(n => { const c = document.createElement('canvas'); c.width = c0.width; c.height = c0.height; const a = c.getContext('2d'); a.drawImage(c0, 0, 0); a.fillStyle = 'rgba(160,60,40,0.85)'; a.font = `700 ${c.width * 0.35}px Fraunces, serif`; a.textAlign = 'center'; a.fillText(String(n), c.width * 0.72, c.height * 0.8); return c; });
    const rd = window.__cove.rd, st = Engine.paper.state;
    Engine.paper.open({ W: st.W, H: st.H, rolled: false, board: true, backColor: '#f2eee4', pages, origin: { p: rd.held.p, q: rd.held.q }, held: rd.held, fly: 0.05 });
    window.__coveDtCap = 0.1;
  });
  await until(page, () => Engine.paper.mode === 'open', null, 400000); await frames(2);
  await shot(page, 'cloth_clip_0');
  await page.evaluate(() => Engine.paper.dragStart(1));
  for (const f of [0.3, 0.55]) { await page.evaluate(f => Engine.paper.dragTo(f), f); await frames(3); await shot(page, 'cloth_clip_drag' + Math.round(f * 100)); }
  await page.evaluate(() => Engine.paper.dragEnd(true));
  await until(page, () => { const t = Engine.paper.state.turn; return !t || t.free; }, null, 400000); await frames(1); await shot(page, 'cloth_clip_over');
  await until(page, () => !Engine.paper.state.turn, null, 400000); console.log('clip landed', await turnP());
  await shot(page, 'cloth_clip_landed');
  await page.evaluate(() => window.__cove.readNav(-1));
  await until(page, () => { const t = Engine.paper.state.turn; return !t || t.p < 0.45; }, null, 400000); await shot(page, 'cloth_clip_back');
  await until(page, () => !Engine.paper.state.turn, null, 400000); console.log('clip back', await turnP());
  await page.evaluate(() => { window.__coveDtCap = 0.5; });
  await closeChapter();
}
if (!only || only === 'wind') {
  const fab = async label => console.log(label, JSON.stringify(await page.evaluate(() => Engine.fabric())));
  /* put the camera somewhere and keep it there */
  const cam = (pos, look, fov) => page.evaluate(([pos, look, fov]) => { const s = window.__cove.st; s.from = s.to = { pos, look, fov, focus: 5 }; s.camT = 1; }, [pos, look, fov]);
  await wait(page, 1500);
  await shot(page, 'cloth_wide_a'); await fab('wide a'); await frames(2); await shot(page, 'cloth_wide_b'); await fab('wide b');
  const views = [['awning', [-10.6, 2.0, 0.4], [-7.9, 1.45, -3.0], 40], ['towel', [10.3, 1.45, -1.6], [8.5, 0.72, -3.45], 42]];
  for (const [name, pos, look, fov] of views) { await cam(pos, look, fov); await frames(3); await shot(page, `cloth_${name}_a`); await frames(2); await shot(page, `cloth_${name}_b`); await fab(name); }
  /* a storm: the wind blows about three times as hard */
  await page.evaluate(() => { const s = window.__cove.st; s.weather = 'storm'; s.wx.storm = 1; s.wx.rain = 1; });
  for (const [name, pos, look, fov] of views) { await cam(pos, look, fov); await frames(4); await shot(page, `cloth_${name}_storm`); await fab(name + ' storm'); }
}
await browser.close();
