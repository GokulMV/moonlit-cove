/* Rain on the camp: puddles in the hollows of the upper beach and the forest's floor after a while of it, rain rings on
   them, the sand dark round them; and dry again after. node tools/puddletest.mjs [hour 15] [prefix pud] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 15), prefix = process.argv[3] || 'pud';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 960, h: 600, rs: 0.6, hour, init: () => { try { localStorage.setItem('cove.weather', JSON.stringify('rain')); } catch (e) {} } });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.addStyleTag({ content: '#ctrl, #homeBar, #hint, #dock { display: none !important; }' });
  /* (a long rain already: the clouds, the rain and the wet as they are after it) */
  await page.evaluate(() => { const st = window.__cove.st; st.weather = 'rain'; Object.assign(st.wx, { rain: 1, wet: 1, pud: 1, flood: 0.8, stratus: 1, cumulus: 0.4 }); });
  await page.evaluate(() => { window.__coveCamFix = { pos: [-4.5, 1.65, -1.2], look: [-1.5, 0.1, 5.5], fov: 55, focus: 5 }; });
  await frames(6); await shot(page, prefix + '_rain');
  const u = await page.evaluate(() => ({ pud: Engine.dbg.ground().uniforms.uPud.value, wind: Mats.U.uWindK.value.toArray() }));
  console.log('  puddles', u.pud.toFixed(2), 'wind', u.wind.map(v => v.toFixed(2)).join(', '));
  ok(u.pud > 0.8, 'after a long rain the puddles are full');
  await page.evaluate(() => { window.__coveCamFix = { pos: [3.5, 1.65, 4.6], look: [0.5, 0.0, 9.5], fov: 55, focus: 5 }; }); await frames(4); await shot(page, prefix + '_floor');
  /* clear again: they go */
  await page.evaluate(() => { const st = window.__cove.st; st.weather = 'clear'; Object.assign(st.wx, { rain: 0, wet: 0.2, pud: 0.08, stratus: 0, cumulus: 0.3 }); window.__coveCamFix = { pos: [-4.5, 1.65, -1.2], look: [-1.5, 0.1, 5.5], fov: 55, focus: 5 }; });
  await frames(6); await shot(page, prefix + '_after');
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await browser.close(); console.log(fails ? `${fails} failed` : 'all ok');
}
