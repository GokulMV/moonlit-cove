/* The island's animals, clicked: for each of a few kinds out round the eye, the camera set a little way off it (further
   than it lets you come), a click on it — it should come up into the hand with its card (its name, what it is), turn
   there — then let go: back where it was, and off.
   node tools/animaltest.mjs [prefix an] [kinds macaque,pig,egret] */
import { open } from './lib.mjs';
import path from 'path';
const prefix = process.argv[2] || 'an';
const { browser, page, logs } = await open({ w: 1000, h: 600, rs: 0.6, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  await page.addStyleTag({ content: '#hint { display: none !important; }' });
  /* the animals out: the nearest spot of each ground kind is brought out round the eye, so go to where some live */
  for (const kind of (process.argv[3] || 'macaque,pig,egret').split(',')) {
    /* (a spot of that kind, the camera there, the animals given a moment to be brought out) */
    const sp = await page.evaluate(k => { const s = Engine.isFauna.spots[k]; if (!s || !s.length) return null; const C = Layout.camp, L = s.slice().sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z)); return [L[0].x, L[0].z]; }, kind);
    if (!sp) { ok(false, `${kind}: has somewhere to live`); continue; }
    await page.evaluate(([x, z]) => { window.__coveCamFix = { pos: [x + 20, 12, z + 20], look: [x, 0, z], fov: 55, focus: 30 }; Engine.world.prime(x, z, 12, true); }, sp);
    let a = null;
    for (let i = 0; i < 40 && !a; i++) { await frames(4); a = await page.evaluate(k => { const o = Engine.isFauna.out.find(a => a.k === k && a.g.visible); return o ? [o.g.position.x, o.g.position.y, o.g.position.z] : null; }, kind); }
    if (!a) { ok(false, `${kind}: one is out`); continue; }
    /* (the camera a little way off it, looking at it) */
    await page.evaluate(([x, y, z]) => { window.__coveCamFix = { pos: [x + 12, y + 4, z + 12], look: [x, y + 0.3, z], fov: 40, focus: 17 }; }, a);
    await frames(10);
    const scr = await page.evaluate(k => { const o = Engine.isFauna.out.find(a => a.k === k && a.g.visible); if (!o) return null; const v = o.g.position.clone(); v.y += 0.3 * o.s; v.project(Engine.camera); const r = Engine.renderer.domElement.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height]; }, kind);
    if (!scr) { ok(false, `${kind}: still out to click`); continue; }
    await page.mouse.click(scr[0], scr[1]);
    await frames(20);
    const card = await page.evaluate(() => ({ on: document.body.classList.contains('inspecting'), name: document.getElementById('iName').textContent, latin: document.getElementById('iLatin').textContent, btn: document.getElementById('iThrow').textContent }));
    ok(card.on, `${kind}: clicked, it is held up (${card.name} — ${card.latin}; "${card.btn}")`);
    await page.screenshot({ path: path.join('shots', `${prefix}_${kind}.png`), timeout: 240000 });
    if (card.on) {
      await page.click('#iThrow'); await frames(30);
      const back = await page.evaluate(k => { const o = Engine.isFauna.out.find(a => a.k === k); return { on: document.body.classList.contains('inspecting'), vis: Engine.isFauna.out.filter(a => a.k === k && a.g.visible).length, held: Engine.isFauna.out.some(a => a.held) }; }, kind);
      ok(!back.on && back.vis > 0 && !back.held, `${kind}: let go, it is back (${back.vis} out, none held)`);
    }
  }
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
