/* The fruit round the camp (orchard.js): every tree and plant bears, at every stage at once; a fruit clicked comes up
   into the hands with a card saying how ripe it is, goes on ripening while held (faster with the time flow up), can be
   eaten while it is good, tossed onto the ground (where it lies and rots with the rest), or dropped; ripe fruit falls by
   itself and lies under the tree. node tools/orchardtest.mjs [hour 10] [prefix orch] */
import { open, shot } from './lib.mjs';
const hour = +(process.argv[2] || 10), prefix = process.argv[3] || 'orch';
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const { browser, page, logs } = await open({ w: 960, h: 600, rs: 0.6, hour, dtCap: 0.25 });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  /* (the hand's and the falls' clock stepped a fifth of a second a frame, however slow the frames are here) */
  await page.evaluate(() => { const st = window.__cove.st; st.rsI = 5; st.rs = 1; st.rsAt = 1e15; window.__coveInspStep = 1 / 5; });
  await page.addStyleTag({ content: '#ctrl, #homeBar, #hint { display: none !important; }' });
  await frames(3);
  const C = await page.evaluate(() => ({ ms: Math.round(Engine.orchard.ms), sets: Engine.orchard.count() }));
  console.log(`  built in ${C.ms} ms:`); for (const s of C.sets) console.log('   ', JSON.stringify(s));
  ok(C.sets.filter(s => s.kind !== 'coconut').length === 4, 'a mango, a rambutan, a papaya and a banana by the camp');
  ok(C.sets.filter(s => s.kind === 'coconut').length >= 10, 'coconuts on the camp palms');
  ok(C.sets.every(s => s.hanging > 0), 'every one of them bears fruit');
  ok(C.sets.some(s => s.flowering > 0), 'some of them are in flower');
  ok(C.sets.some(s => s.lying > 0), 'some fruit lies on the ground under them');
  /* each of them, close to */
  const look = async (kind, d, h, name, up = 0) => {
    await page.evaluate(([kind, d, h, up]) => { const f = Layout.fruit.find(q => q.kind === kind); const x = f.x, z = f.z, a = Math.atan2(Layout.camp.z - z, Layout.camp.x - x);
      window.__coveCamFix = { pos: [x + Math.cos(a) * d, h, z + Math.sin(a) * d], look: [x, h * 0.8 + up, z], fov: 50, focus: d }; }, [kind, d, h, up]);
    await frames(5); await shot(page, prefix + '_' + name);
  };
  await look('mango', 11, 2.4, 'mango', 1.6); await look('papaya', 3.2, 1.9, 'papaya', 0.7);
  /* and the whole camp, from the wide view and from behind it, the fruit round it */
  await page.evaluate(() => { window.__coveCamFix = { pos: [0.6, 3.2, 16], look: [0.6, 2.2, -3], fov: 62, focus: 12 }; }); await frames(4); await shot(page, prefix + '_behind');
  /* pick a ripe fruit off the mango */
  await page.evaluate(() => { const f = Layout.fruit.find(q => q.kind === 'mango'), x = f.x, z = f.z; window.__coveCamFix = { pos: [x + 3.2, 1.7, z - 3.6], look: [x, 2.6, z], fov: 55, focus: 4 }; });
  await frames(4);
  const pick = await page.evaluate(() => {
    const L = Engine.inspect.candidates().filter(c => c.fruit && c.kind === 'mango').map(c => ({ c, i: c.info(), p: Engine.project([c.x, c.y, c.z]) })).filter(q => q.p[2] < 1 && q.p[0] > 0.1 && q.p[0] < 0.9 && q.p[1] > 0.1 && q.p[1] < 0.9);
    L.sort((a, b) => Math.abs(a.i.age - 0.62) - Math.abs(b.i.age - 0.62));
    return L.length ? { n: L.length, x: L[0].p[0], y: L[0].p[1], age: L[0].i.age, name: L[0].i.name } : { n: 0 };
  });
  console.log('  mango fruit in view:', JSON.stringify(pick));
  ok(pick.n > 0, 'mangoes in view can be picked');
  const click = (nx, ny) => page.evaluate(([nx, ny]) => { const cv = document.getElementById('scene'), b = cv.getBoundingClientRect(), x = b.left + nx * b.width, y = b.top + ny * b.height;
    for (const t of ['pointerdown', 'pointerup']) cv.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'mouse', button: 0 })); }, [nx, ny]);
  if (pick.n) {
    await click(pick.x, pick.y); await frames(5);
    const H = await page.evaluate(() => ({ held: Engine.inspect.held, card: !document.getElementById('insp').hidden && document.getElementById('iName').textContent, note: document.getElementById('iNote').textContent, eat: !document.getElementById('iKeep').hidden, put: document.getElementById('iPut').textContent }));
    console.log('  held:', JSON.stringify(H));
    ok(H.held && H.held.kind === 'mango', 'clicked, the mango comes up into the hands');
    ok(/mango/i.test(H.card || ''), `its card says what it is (${H.card})`);
    await shot(page, prefix + '_held');
    /* it goes on ripening in the hand: a minute of life at 100x */
    const a0 = await page.evaluate(() => Engine.inspect.held.info.age);
    await page.evaluate(() => { window.__cove.st.flow = 100; }); await frames(3); await page.evaluate(() => { window.__cove.st.flow = 1; });
    const a1 = await page.evaluate(() => ({ age: Engine.inspect.held.info.age, card: document.getElementById('iName').textContent }));
    console.log(`  ripening in the hand: ${a0.toFixed(3)} -> ${a1.age.toFixed(3)} (${a1.card})`);
    ok(a1.age > a0 + 0.01, 'it goes on ripening while held');
    const canEat = await page.evaluate(() => !document.getElementById('iKeep').hidden);
    if (canEat) {
      await page.evaluate(() => document.getElementById('iKeep').click()); await frames(5);
      const E = await page.evaluate(() => ({ held: Engine.inspect.held, toast: document.getElementById('toastText').textContent, card: !document.getElementById('insp').hidden }));
      console.log('  eaten:', JSON.stringify(E));
      ok(!E.held && !E.card && E.toast.length > 3, 'eaten: gone from the hand, a word on how it tasted');
    } else { await page.keyboard.press('Space'); await frames(12); }
  }
  /* pick another and toss it: it comes down on the ground ahead and lies there with the others */
  const before = await page.evaluate(() => Engine.orchard.count().find(s => s.kind === 'mango').lying);
  const p2 = await page.evaluate(() => { const L = Engine.inspect.candidates().filter(c => c.fruit && c.kind === 'mango').map(c => ({ i: c.info(), p: Engine.project([c.x, c.y, c.z]) })).filter(q => q.p[2] < 1 && q.p[0] > 0.1 && q.p[0] < 0.9 && q.p[1] > 0.1 && q.p[1] < 0.9 && q.i.age > 0.3); return L.length ? L[0].p : null; });
  if (p2) {
    await click(p2[0], p2[1]); await frames(5);
    const held2 = await page.evaluate(() => Engine.inspect.held);
    ok(held2 && held2.kind === 'mango', 'a second mango picked');
    await page.keyboard.press('Space'); await frames(14);
    const after = await page.evaluate(() => ({ lying: Engine.orchard.count().find(s => s.kind === 'mango').lying, flying: Engine.inspect.flying }));
    console.log(`  lying under the mango before ${before}, after the toss ${after.lying} (${after.flying} flying)`);
    ok(after.flying === 0 && after.lying >= before + 1, 'tossed, it lies on the ground, the tree\'s again');
  }
  /* ripe fruit falls by itself: shake three down, watch them fall and settle */
  await page.evaluate(() => { const f = Layout.fruit.find(q => q.kind === 'mango'), x = f.x, z = f.z; window.__coveCamFix = { pos: [x - 4.6, 1.5, z - 3.0], look: [x, 0.5, z - 0.2], fov: 55, focus: 5 }; });
  const n = await page.evaluate(() => Engine.orchard.sets.find(s => s.kind === 'mango').fr.live.shake(4));
  await frames(3); const F = await page.evaluate(() => Engine.orchard.count().find(s => s.kind === 'mango'));
  ok(n > 0 && F.falling > 0, `${n} ripe mangoes come down (${F.falling} falling)`);
  await shot(page, prefix + '_falling'); await frames(12);
  const F2 = await page.evaluate(() => Engine.orchard.count().find(s => s.kind === 'mango'));
  ok(F2.falling === 0, `and they lie on the ground (${F2.lying} lying)`);
  await shot(page, prefix + '_fallen');
  /* a while at 100x: the round goes on, nothing goes wrong */
  await page.evaluate(() => { window.__cove.st.flow = 100; }); await frames(12); await page.evaluate(() => { window.__cove.st.flow = 1; });
  const C2 = await page.evaluate(() => Engine.orchard.count());
  console.log('  after a while at 100x:'); for (const s of C2) if (s.kind !== 'coconut') console.log('   ', JSON.stringify(s));
  ok(C2.every(s => s.hanging > 0), 'still bearing, round after round');
  await look('mango', 11, 2.4, 'mango_later', 1.6);
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
