/* Picking up the cove's small lives: walking at night, a ghost crab clicked on the sand comes up into the hands; it
   turns when dragged; thrown, it flies out over the water and splashes in. By day a shell is picked up and put back,
   and a flower goes into the bouquet. node tools/inspectlook.mjs [what: crab,shell,flower] [prefix insp] */
import { open, shot } from './lib.mjs';
const what = (process.argv[2] || 'crab,shell,flower').split(','), prefix = process.argv[3] || 'insp';
let fails = 0; const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) fails++; };
async function session(hour, fn) {
  const { browser, page, logs } = await open({ w: 1280, h: 760, rs: 0.8, hour });
  const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  /* (what is held and thrown runs on a clock stepped a frame at a time, a thirtieth of a second each, however slow the
     frames are here) */
  await page.evaluate(() => { window.__coveDtCap = 0.25; const st = window.__cove.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; window.__coveInspStep = 1 / 30; });
  /* (the walking bar and the buttons out of the way of the clicks) */
  await page.addStyleTag({ content: '#walkHud, #ctrl, #walkBar { display: none !important; }' });
  try { await fn(page, frames); } finally {
    const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
    check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
    await browser.close();
  }
}
/* walk to stand a couple of metres from one of the given kinds, looking down at it; returns it */
async function approach(page, frames, kinds, dist = 2.2) {
  const c = await page.evaluate(([kinds, dist]) => {
    const cv = window.__cove, w = cv.wk, list = Engine.inspect.candidates().filter(c => kinds.includes(c.kind));
    if (!list.length) return null;
    list.sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z));
    const c = list[0], sz = Layout.shoreZ(c.x), land = ['daisy', 'glory', 'frangi'].includes(c.kind);
    /* (from the landward side, the sea beyond it; for a flower at the forest's edge, from the sand in front of it) */
    const ax = c.x - 0.9, az = land ? Math.max(sz + 0.8, c.z - dist) : Math.max(sz + 0.8, c.z + dist);
    w.x = ax; w.z = az; const h = Math.atan2(-(c.x - ax), -(c.z - az)); w.h = w.hT = h; w.hy.v = 0; w.my = 0; w.mp = 0;
    const pitch = -Math.atan2(1.6, Math.hypot(c.x - ax, c.z - az)); w.pitchT = pitch; w.hp.v = pitch; w.camK = 1;
    return { kind: c.kind, x: c.x, y: c.y, z: c.z };
  }, [kinds, dist]);
  await frames(8);
  return c;
}
const clickOn = async (page, p) => {
  const s = await page.evaluate(p => { const v = Engine.project([p.x, p.y, p.z]); const r = document.getElementById('scene').getBoundingClientRect(); return [r.left + v[0] * r.width, r.top + v[1] * r.height, v[2]]; }, p);
  console.log(`  (clicking at ${s[0].toFixed(0)}, ${s[1].toFixed(0)}${s[2] > 1 ? ', behind' : ''})`);
  await page.mouse.click(s[0], s[1]); return s;
};

if (what.includes('crab')) await session(22, async (page, frames) => {
  await page.evaluate(() => { const c = window.__cove; c.startWalk(); }); await frames(30);
  /* (crabs come out of their burrows over a few seconds of night) */
  for (let i = 0; i < 12; i++) { const n = await page.evaluate(() => Engine.inspect.candidates().filter(c => c.kind === 'crab').length); if (n) break; await frames(10); }
  const c = await approach(page, frames, ['crab'], 6.5);
  check(!!c, 'a ghost crab out on the sand at night' + (c ? ` (${c.x.toFixed(1)}, ${c.z.toFixed(1)})` : ''));
  if (!c) return;
  /* (it may have moved off: find it again where it is now) */
  const c2 = await page.evaluate(() => { const w = window.__cove.wk, l = Engine.inspect.candidates().filter(c => c.kind === 'crab'); l.sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z)); return l[0] && { x: l[0].x, y: l[0].y, z: l[0].z }; });
  await shot(page, prefix + '_crab0');
  await clickOn(page, c2 || c); await frames(22);
  const H = await page.evaluate(() => Engine.inspect.held);
  check(H && H.kind === 'crab', 'clicked, it is picked up and held' + (H ? ` (${H.name}, ${H.phase})` : ''));
  const panel = await page.evaluate(() => !document.getElementById('insp').hidden && document.getElementById('iName').textContent);
  check(panel === 'Ghost crab', `its card shows (${panel})`);
  await frames(6); await shot(page, prefix + '_crab1');
  /* drag to turn it over */
  await page.mouse.move(640, 380); await page.mouse.down(); for (let i = 1; i <= 6; i++) { await page.mouse.move(640 + i * 30, 380 + i * 8); await frames(1); } await page.mouse.up(); await frames(4);
  await shot(page, prefix + '_crab2');
  await page.keyboard.press('Space'); await frames(9);
  const F = await page.evaluate(() => ({ held: Engine.inspect.held, flying: Engine.inspect.flying, card: !document.getElementById('insp').hidden }));
  check(!F.held && F.flying === 1 && !F.card, `Space throws it: it is in the air, the card gone (${F.flying} flying)`);
  await shot(page, prefix + '_crab3');
  await frames(90);
  const G = await page.evaluate(() => ({ flying: Engine.inspect.flying, crabs: Engine.fauna.debug.crabs.C.filter(c => c.st === 'held').length }));
  check(G.flying === 0 && G.crabs === 0, `it splashed in and the crab is back among the others (${G.flying} flying, ${G.crabs} held)`);
});

if (what.includes('shell')) await session(14, async (page, frames) => {
  await page.evaluate(() => { const c = window.__cove; c.startWalk(); }); await frames(20);
  const c = await approach(page, frames, ['star', 'scallop', 'cowrie', 'whelk'], 1.8);
  check(!!c, 'a shell or a starfish at the tide line' + (c ? ` (${c.kind})` : ''));
  if (!c) return;
  await clickOn(page, c); await frames(22);
  const H = await page.evaluate(() => Engine.inspect.held);
  check(H && H.kind === c.kind, `picked up (${H && H.name})`);
  await shot(page, prefix + '_shell1');
  await page.keyboard.press('Escape'); await frames(20);
  const B = await page.evaluate(() => ({ held: Engine.inspect.held, n: Engine.inspect.candidates().length }));
  check(!B.held, 'Esc puts it back down');
});

if (what.includes('flower')) await session(15, async (page, frames) => {
  await page.evaluate(() => { const c = window.__cove; c.startWalk(); }); await frames(20);
  const c = await approach(page, frames, ['daisy', 'glory', 'frangi'], 1.6);
  check(!!c, 'a flower at the forest edge' + (c ? ` (${c.kind})` : ''));
  if (!c) return;
  const before = await page.evaluate(() => (JSON.parse(localStorage.getItem('cove.bouquet') || '[]') || []).length);
  await clickOn(page, c); await frames(22);
  const H = await page.evaluate(() => ({ h: Engine.inspect.held, keep: !document.getElementById('iKeep').hidden }));
  check(H.h && H.keep, `held, with "Add it to the bouquet" (${H.h && H.h.name})`);
  await shot(page, prefix + '_flower1');
  await page.keyboard.press('b'); await frames(20);
  const after = await page.evaluate(() => (JSON.parse(localStorage.getItem('cove.bouquet') || '[]') || []).length);
  check(after === before + 1, `into the bouquet (${before} → ${after})`);
});
console.log(fails ? `${fails} failed` : 'all good');
