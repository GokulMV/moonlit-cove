/* The map in the corner and the whole map: drawn, following the camera, opening and closing, and its words.
   node tools/maptest.mjs [island|coast] */
import { open } from './lib.mjs';
import path from 'path';
const isle = (process.argv[2] || 'island') === 'island', tag = isle ? 'isle' : 'coast';
const { browser, page, logs } = await open({ w: 1280, h: 800, rs: 0.3, hour: 10, dtCap: 0.25, query: isle ? '?island' : '', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = (name, el) => el ? page.locator(el).screenshot({ path: path.join('shots', `map_${tag}_${name}.png`), timeout: 180000 }) : page.screenshot({ path: path.join('shots', `map_${tag}_${name}.png`), timeout: 180000 });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
try {
  await page.addStyleTag({ content: '#walkHud, #walkBar, #hint { display: none !important; }' });
  for (let i = 0; i < 60 && !(await page.evaluate(() => Minimap.ready)); i++) await frames(6);
  ok(await page.evaluate(() => Minimap.ready), 'the map is drawn');
  await frames(6);
  ok(await page.evaluate(() => !document.getElementById('map').hidden), 'the corner map shows');
  await shot('corner', '#map'); await shot('page');
  /* (somewhere else: the camera over the far side of the camp's bay, or a kilometre down the coast) */
  const far = isle ? { pos: [560, 40, 120], look: [575, 0, 164] } : { pos: [900, 30, 30], look: [940, 0, -10] };
  await page.evaluate(f => { window.__coveCamFix = { pos: f.pos, look: f.look, fov: 55, focus: 40 }; }, far);
  await frames(12); await shot('corner_far', '#map');
  await page.evaluate(() => document.getElementById('map').click()); await frames(4);
  ok(await page.evaluate(() => Minimap.open && !document.getElementById('mapBig').hidden), 'tapping it opens the whole map');
  const note = await page.evaluate(() => document.getElementById('mbNote').textContent);
  console.log('   note:', note); ok(/of the camp|at the camp/.test(note), 'it says where you are from the camp');
  await shot('big', '.mb-card');
  await page.keyboard.press('Escape'); await frames(3);
  ok(await page.evaluate(() => !Minimap.open && document.getElementById('mapBig').hidden), 'Escape closes it');
  /* (and put away with the settings open) */
  await page.evaluate(() => document.getElementById('bGear').click()); await frames(3);
  ok(await page.evaluate(() => document.getElementById('map').hidden), 'put away while the settings are open');
  await page.evaluate(() => document.getElementById('bGear').click()); await frames(3);
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
