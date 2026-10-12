/* Walking: the pins on things show once you come up to them (and not from far off), clicking one opens it; with a mouse
   the view turns when the pointer rests toward a side of the screen, without a button held; the string lights' glass
   bulbs up close. node tools/walkpins.mjs [hour 20] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 20);
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.6, hour });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const ch = await page.evaluate(() => { const c = Content.chapters[0], a = Engine.anchors()[c.anchor]; return { id: c.id, x: a.x ?? a[0], z: a.z ?? a[2] }; });
/* far off along the beach, facing the camp: no pin */
await page.evaluate(ch => { window.__coveDtCap = 0.25; const c = window.__cove; c.startWalk(); const w = c.wk; w.x = ch.x + 14; w.z = ch.z - 1; w.h = w.hT = Math.PI / 2; w.camK = 1; }, ch);
await frames(6);
const vis = () => page.evaluate(id => getComputedStyle(Content.chapters.find(c => c.id === id).spot).visibility, ch.id);
check(await vis() === 'hidden', `walking 14 m off, the pin on "${ch.id}" is not shown`);
/* walk up close, facing it */
await page.evaluate(ch => { const w = window.__cove.wk; w.x = ch.x + 3.2; w.z = ch.z + 0.4; w.h = w.hT = Math.atan2(3.2, 0.4); w.pitchT = -0.35; w.hp.v = -0.35; }, ch);
await frames(8);
const v2 = await vis();
check(v2 === 'visible', `come up to it, its pin shows (${v2})`);
await shot(page, 'walkpins_near');
/* clicking the pin opens it, and the walk stops */
const opened = await page.evaluate(id => { const s = Content.chapters.find(c => c.id === id).spot; s.click(); return true; }, ch.id);
await frames(4);
const st = await page.evaluate(() => ({ chapter: window.__cove.st.chapter, walking: window.__cove.wk.on }));
check(opened && st.chapter === ch.id && !st.walking, `clicking the pin opens "${st.chapter}" and the walk ends (walking: ${st.walking})`);
await page.evaluate(() => window.__cove.openChapter(null)); await frames(4);
/* the mouse resting at the right of the screen turns the walker right, no button held; in the middle, nothing */
await page.evaluate(ch => { const c = window.__cove; c.startWalk(); const w = c.wk; w.x = ch.x + 6; w.z = ch.z; w.h = w.hT = Math.PI / 2; w.camK = 1; }, ch);
await frames(4);
const h0 = await page.evaluate(() => window.__cove.wk.hT);
await page.mouse.move(640, 380); await page.mouse.move(645, 382); await frames(8);
const h1 = await page.evaluate(() => window.__cove.wk.hT);
check(Math.abs(h1 - h0) < 0.02, `pointer resting mid-screen: the view stays put (${(h1 - h0).toFixed(3)} rad)`);
await page.mouse.move(1250, 380); await frames(10);
const h2 = await page.evaluate(() => window.__cove.wk.hT);
check(h2 < h1 - 0.05, `pointer at the right edge: it turns right (${(h2 - h1).toFixed(3)} rad)`);
await page.mouse.move(640, 380); await frames(3);
/* the glass bulbs, close up at night */
await page.evaluate(() => { const c = window.__cove; c.stopWalk(); window.__coveCamFix = { pos: [Layout.poles[0][0] - 1.2, 2.2, Layout.poles[0][1] + 1.4], look: [Layout.poles[0][0], 2.45, Layout.poles[0][1]], fov: 40, focus: 1.8 }; });
await frames(6); await shot(page, 'walkpins_bulbs');
await page.evaluate(() => { window.__coveCamFix = null; });
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
