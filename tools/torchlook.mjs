/* The torch on a night walk: walking at night it is in hand and lit, its beam on the sand with the shadows of what
   stands in it; off by day; F switches it. node tools/torchlook.mjs [hour 21] [prefix torch] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 21), prefix = process.argv[3] || 'torch';
const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.8, hour });
let fails = 0; const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.evaluate(() => { window.__coveDtCap = 0.25; const st = window.__cove.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; });
/* among the camp's palms, looking along the beach past them */
await page.evaluate(() => { const c = window.__cove; c.startWalk(); const w = c.wk; w.x = 9.5; w.z = -1.2; w.h = w.hT = -1.15; w.pitchT = -0.32; w.hp.v = -0.32; w.camK = 1; });
await frames(10);
const T0 = await page.evaluate(() => ({ w: Mats.U.uTorch.value.w, on: document.getElementById('bTorch').getAttribute('aria-pressed') }));
check(T0.w > 0.15, `walking at night, the torch is lit (${T0.w.toFixed(2)})`);
await shot(page, prefix + '_beam');
await page.evaluate(() => { const w = window.__cove.wk; w.h = w.hT = 0.5; w.pitchT = -0.45; w.hp.v = -0.45; }); await frames(8);
await shot(page, prefix + '_camp');
/* F switches it off, and on again */
await page.keyboard.press('f'); await frames(8);
const T1 = await page.evaluate(() => Mats.U.uTorch.value.w);
check(T1 < 0.05, `F switches it off (${T1.toFixed(2)})`);
await page.keyboard.press('f'); await frames(8);
const T2 = await page.evaluate(() => Mats.U.uTorch.value.w);
check(T2 > 0.15, `and on again (${T2.toFixed(2)})`);
await page.evaluate(() => window.__cove.stopWalk()); await frames(8);
const T3 = await page.evaluate(() => Mats.U.uTorch.value.w);
check(T3 < 0.05, `out of the walk, it is put away (${T3.toFixed(2)})`);
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
