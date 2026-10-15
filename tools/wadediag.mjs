/* Why a walker stops at the water's edge: the walk's answer at points out from the camp's beach into the sea, and a walk
   out there step by step, where it stops and what it found there.
   node tools/wadediag.mjs */
import { open } from './lib.mjs';
const { browser, page, logs } = await open({ w: 480, h: 270, rs: 0.5, hour: 10, dtCap: 0.25, query: '?island', tz: 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.waitForFunction(() => window.__cove.st.camT >= 1, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const S = Layout.Shore, W = Engine.world, a0 = S.at(Layout.camp.x, Layout.camp.z).a, out = [];
    for (let s = -2; s <= 24; s += 2) { const q = S.pt(a0 + 25, s, {}), w = W.walk(q.x, q.z), f = W.walk(q.x, q.z, {}, 0); out.push(`s ${s}: (${q.x.toFixed(1)}, ${q.z.toFixed(1)}) ok ${w.ok} ${w.kind} y ${w.y.toFixed(2)} wade ${w.wade.toFixed(2)} | with foot 0: ok ${f.ok} ${f.kind}`); }
    return out;
  });
  console.log(r.join('\n'));
  /* (the walk itself, sped up: the walker put at the water's edge facing out, the w key held, a step at a time) */
  await page.evaluate(() => { const C = window.__cove; if (!C.wk.on) document.getElementById('bWalk').click(); });
  await page.waitForFunction(() => window.__cove.wk.camK >= 1, null, { timeout: 120000 });
  const log = await page.evaluate(() => {
    const C = window.__cove, k = C.wk, S = Layout.Shore, a0 = S.at(Layout.camp.x, Layout.camp.z).a, q = S.pt(a0 + 25, -1.5, {});
    if (k.auto) document.getElementById('bWalkAuto').click();
    k.x = q.x; k.z = q.z; const dx = q.nx, dz = q.nz; k.h = k.hT = Math.atan2(-dx, -dz); k.v = 0;
    C.keys.add('w'); const out = [];
    for (let i = 0; i < 200; i++) { C.stepWalk(0.05); if (i % 10 === 9) { const s = S.at(k.x, k.z, {}).s; out.push(`t ${((i + 1) * 0.05).toFixed(1)} s ${s.toFixed(2)} v ${k.v.toFixed(2)} blocked ${k.blocked || 0}`); } }
    C.keys.delete('w'); return out;
  });
  console.log(log.join('\n'));
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ').slice(0, 600) : 'no page errors');
  await browser.close();
}
