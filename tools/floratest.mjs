/* Grass and wild flowers at the forest's edge; picking flowers into a bouquet: the flower goes, the bouquet shows it,
   it can go into a jar on the picnic table and be let go; a picked flower stays picked.
   node tools/floratest.mjs [hour 15] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 15);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.7, hour, dtCap: 0.25 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await frames(3);
let c = await page.evaluate(() => Engine.flora().count());
console.log('  near the camp:', JSON.stringify(c));
ok(c.flowers > 40, 'wild flowers lie about near the camp');
/* stand by the forest's edge, looking at the nearest flower */
const f0 = await page.evaluate(() => {
  const F = Engine.flora(); let best = null;
  /* (the flowers' own list, for the bench: the nearest to the camp) */
  return null;
});
await page.evaluate(() => {
  const x = Layout.camp.x + 26, vz = Layout.vegZ(x);
  window.__coveCamFix = { pos: [x, 1.6, vz - 4], look: [x + 2, 0.2, vz + 3], fov: 55, focus: 6 };
});
await frames(4);
await shot(page, 'flora_edge');
/* touch the screen where flowers are: scan for one near enough to pick */
const pick = await page.evaluate(() => {
  for (let j = 0; j < 30; j++) for (let i = 0; i < 40; i++) { const nx = 0.05 + i * 0.9 / 39, ny = 0.35 + j * 0.6 / 29, f = Engine.pickFlower(nx, ny); if (f) return { nx, ny }; }
  return null;
});
console.log('  a flower to pick at', JSON.stringify(pick));
ok(!!pick, 'a flower near the camera can be picked');
if (pick) {
  const r = await page.evaluate(({ nx, ny }) => {
    const cv = document.getElementById('scene'), b = cv.getBoundingClientRect(), x = b.left + nx * b.width, y = b.top + ny * b.height;
    for (const t of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'mouse', button: 0 }));
    return { n: document.getElementById('bqN').textContent, shown: !document.getElementById('bouquet').hidden, toast: document.getElementById('toastText').textContent };
  }, pick);
  console.log('  after the click:', JSON.stringify(r));
  ok(r.shown && r.n === '1', 'the bouquet shows the flower');
  await frames(6);
  c = await page.evaluate(() => Engine.flora().count());
  ok(c.picked >= 1, 'and the flower is gone from the grass: ' + JSON.stringify(c));
  await shot(page, 'flora_picked');
}
/* a few more, straight from the list, then the jar */
await page.evaluate(() => { const F = Engine.flora(); for (let k = 0; k < 6; k++) { for (let j = 0; j < 30; j++) { let done = false; for (let i = 0; i < 40; i++) { const f = Engine.pickFlower(0.05 + i * 0.9 / 39, 0.35 + j * 0.6 / 29); if (f) { const p = Engine.pluckFlower(f, window.__cove.st.t); done = true; break; } } if (done) break; } } });
await page.evaluate(() => document.getElementById('bouquet').click()); await frames(2);
const panel = await page.evaluate(() => ({ open: !document.getElementById('bqPanel').hidden, text: document.getElementById('bqText').textContent }));
console.log('  the bouquet card:', JSON.stringify(panel));
ok(panel.open && panel.text.length > 5, 'the bouquet card opens and says what is in it');
await shot(page, 'flora_card');
await page.evaluate(() => document.getElementById('bqJar').click()); await frames(2);
await page.evaluate(() => { const t = Layout.table; window.__coveCamFix = { pos: [t.x - 1.0, 1.0, t.z + 1.4], look: [t.x - 0.4, 0.5, t.z + 0.1], fov: 45, focus: 1.6 }; });
await frames(6);
await shot(page, 'flora_jar');
const jar = await page.evaluate(() => { let n = 0; Engine.dbg.camp().table.traverse(o => { if (o.isMesh) n++; }); return n; });
ok(jar > 10, 'the jar of flowers stands on the picnic table');
await page.evaluate(() => document.getElementById('bqFree').click()); await frames(2);
const after = await page.evaluate(() => ({ hidden: document.getElementById('bouquet').hidden }));
ok(after.hidden, 'letting them go empties the bouquet');
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all good');
await browser.close();
process.exit(fails ? 1 : 0);
