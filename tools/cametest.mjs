/* The explore camera: drag to turn, one swipe against several, the wheel, right-drag to move, a tap on the sea and, on
   a phone, one finger to turn, pinch and twist.
   node tools/cametest.mjs [orbit|mobile]   (both when neither is named) */
import { open, shot, wait, until } from './lib.mjs';
const only = process.argv[2];
const r3 = v => Math.round(v * 1000) / 1000;
const orbState = page => page.evaluate(() => { const o = window.__cove.orb; return { yaw: o.v[0], el: o.v[1], zoom: o.v[2], px: o.v[3], pu: o.v[4], pz: o.pz, boost: o.boost }; });
/* until the camera has come to rest: no glide, no flight, every axis on its target */
const settle = page => until(page, () => { const o = window.__cove.orb; return !o.fly && o.g.every(x => !x) && o.v.every((x, i) => Math.abs(x - o.T[i]) < 1e-4); }, null, 120000);
const reset = page => page.evaluate(H => { const o = window.__cove.orb; o.T.set(H); o.v.set(H); o.dv.fill(0); o.g.fill(0); o.fly = null; o.boost = 1; o.lastEnd = -1e9; }, HOME);
/* software GL holds the page's thread for seconds a frame, so every gap between swipes looks long and no swipe ends in
   a fling. For the checks that depend on timing, the drawing is stood down (the frame loop, input and camera all
   still run, at full speed) */
const fast = (page, on) => page.evaluate(on => { if (on) { window.__draw = Engine.render; const S = window.__cove.st.S; Engine.render = () => S; } else if (window.__draw) Engine.render = window.__draw; }, on);
let HOME = null;
async function swipe(page, x0, y0, dx, dy, steps = 6, button = 'left') {
  await page.mouse.move(x0, y0); await page.mouse.down({ button });
  for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + dx * i / steps, y0 + dy * i / steps);
  await page.mouse.up({ button });
}
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails++; };

if (!only || only === 'orbit') {
  const { browser, page } = await open({ w: 960, h: 600, rs: 0.3 });
  HOME = await page.evaluate(() => Array.from(window.__cove.orb.T));
  /* untouched, it is the composed home view, exactly */
  const home = await page.evaluate(() => { const c = window.__cove.st.cur, w = Layout.cameras.wide; return { d: Math.max(...c.pos.map((v, i) => Math.abs(v - w.pos[i])), ...c.look.map((v, i) => Math.abs(v - w.look[i])), Math.abs(c.fov - w.fov), Math.abs(c.focus - w.focus)), cur: c }; });
  check(home.d === 0, `home view is Layout.cameras.wide (largest difference ${home.d})`);
  await shot(page, 'cam_home');

  /* drag to turn: 300 px to the right */
  await swipe(page, 480, 250, 300, 0, 10); await settle(page);
  const rot = await orbState(page);
  console.log('drag 300 px right →', { yaw: r3(rot.yaw), el: r3(rot.el) });
  check(rot.yaw > 0.2 && Math.abs(rot.el - HOME[1]) < 0.02, 'drag across turns round the point and leaves the tilt alone');
  await shot(page, 'cam_rotated');
  /* and up/down tilts */
  await swipe(page, 480, 300, 0, -160, 8); await settle(page);
  const tl = await orbState(page);
  console.log('drag 160 px up →', { el: r3(tl.el) });
  check(tl.el > HOME[1] + 0.1, 'drag up tilts toward overhead');
  await shot(page, 'cam_tilted');

  /* one quick swipe, then four in quick succession (each a 200 px flick over about 50 ms) */
  await fast(page, true);
  const flick = async () => { await page.mouse.move(400, 250); await page.mouse.down(); for (let i = 1; i <= 5; i++) { await page.mouse.move(400 + 40 * i, 250); await wait(page, 10); } await page.mouse.up(); };
  /* (a first flick to warm up: the first events after the drawing stands down can arrive late) */
  await reset(page); await settle(page); await flick(); await settle(page); await wait(page, 1500);
  await reset(page); await settle(page);
  await flick(); const drag1 = (await orbState(page)).yaw; await settle(page);
  const one = (await orbState(page)).yaw;
  await wait(page, 1500);
  await reset(page); await settle(page);
  const boosts = [];
  for (let n = 0; n < 4; n++) { await flick(); boosts.push(r3((await orbState(page)).boost)); await wait(page, 150); }
  await settle(page);
  const four = (await orbState(page)).yaw;
  console.log('one 200 px flick turned', r3(one), 'rad (', r3(drag1), 'by the time of release, the rest gliding ); four in a row', r3(four), 'rad (', r3(four / 4), 'each ), gain per swipe', boosts);
  check(one > drag1 + 0.02, 'a flick glides on after letting go');
  check(four / 4 > one * 1.5 && boosts[3] > 3, 'quick swipes in a row build speed');
  /* and after a pause it is gentle again */
  await wait(page, 2000); await reset(page); await settle(page);
  await flick(); await settle(page);
  const again = await orbState(page);
  console.log('after a pause: gain', r3(again.boost), 'turned', r3(again.yaw));
  check(again.boost === 1 && Math.abs(again.yaw - one) < 0.15, 'after a pause a swipe is gentle again');
  await fast(page, false);

  /* the wheel zooms out, then in */
  await reset(page); await settle(page);
  await page.mouse.move(480, 300); await page.mouse.wheel(0, 300); await settle(page);
  const zo = (await orbState(page)).zoom;
  await wait(page, 900);
  await page.mouse.wheel(0, -700); await settle(page);
  const zi = (await orbState(page)).zoom;
  console.log('wheel +300 → zoom', r3(zo), '(×' + r3(Math.exp(zo)) + '); wheel −700 → zoom', r3(zi), '(×' + r3(Math.exp(zi)) + ')');
  check(zo > 0.1 && zi < zo && zi >= Math.log(0.35) - 1e-6, 'wheel zooms away and back, within its range');
  await shot(page, 'cam_zoomed');

  /* right-drag moves the point along the beach (the sand follows the hand: dragged right, the point goes left) */
  await reset(page); await settle(page);
  await swipe(page, 480, 400, 240, 0, 8, 'right'); await settle(page);
  const pan = await orbState(page);
  console.log('right-drag 240 px →', { px: r3(pan.px), pz: r3(pan.pz), yaw: r3(pan.yaw) });
  check(pan.px < HOME[3] - 2 && Math.abs(pan.yaw) < 1e-6, 'right-drag moves the point, without turning');
  await shot(page, 'cam_panned');
  /* trackpad: a sideways swipe arrives as wheel deltaX */
  const px0 = pan.px; await page.mouse.wheel(200, 0); await settle(page);
  const px1 = (await orbState(page)).px;
  console.log('wheel deltaX 200 → px', r3(px0), '→', r3(px1));
  check(px1 > px0 + 1, 'sideways trackpad swipe moves along the beach');

  /* back to camp glides home exactly */
  await page.evaluate(() => window.__cove.orbHome()); await settle(page);
  await until(page, () => { const o = window.__cove.orb; return o.v.every((x, i) => x === o.T[i]); }, null, 60000);
  await wait(page, 600);
  const back = await page.evaluate(() => { const c = window.__cove.st.cur, w = Layout.cameras.wide; return Math.max(...c.pos.map((v, i) => Math.abs(v - w.pos[i])), ...c.look.map((v, i) => Math.abs(v - w.look[i]))); });
  check(back < 1e-9, `back to camp returns to the home view (largest difference ${back})`);

  /* a tap on the sea still sends a wave; a drag that comes back to where it began does not */
  const n0 = await page.evaluate(() => Engine.surgeInfo().pending.length);
  await page.mouse.click(480, 250); await wait(page, 400);
  const n1 = await page.evaluate(() => Engine.surgeInfo().pending.length);
  await page.mouse.move(480, 250); await page.mouse.down(); await page.mouse.move(540, 250); await page.mouse.move(480, 250); await page.mouse.up(); await wait(page, 400);
  const n2 = await page.evaluate(() => Engine.surgeInfo().pending.length);
  console.log('pending swells: before', n0, 'after a tap', n1, 'after a drag there and back', n2);
  check(n1 > n0 && n2 === n1, 'a tap on the sea sends a swell, a drag does not');
  await settle(page);

  /* a chapter opens from wherever the camera is, and closing comes back there */
  await reset(page); await swipe(page, 480, 250, 150, 0, 5); await settle(page);
  const before = await orbState(page);
  await page.evaluate(() => window.__cove.openChapter('notes'));
  await until(page, () => !window.__cove.rd.pending, null, 90000);
  await page.evaluate(() => window.__cove.openChapter(null));
  await until(page, () => window.__cove.st.camT >= 1, null, 90000);
  const after = await page.evaluate(() => { const c = window.__cove; return { same: c.st.cur === c.orbCam, yaw: c.orb.v[0] }; });
  check(after.same && Math.abs(after.yaw - before.yaw) < 1e-3, 'closing a chapter returns to where the camera was turning');
  await browser.close();
}

if (!only || only === 'mobile') {
  const { browser, page } = await open({ w: 390, h: 844, rs: 0.3, mobile: true });
  HOME = await page.evaluate(() => Array.from(window.__cove.orb.T));
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
  await shot(page, 'mobile_home');
  /* one finger across turns */
  await touch('touchStart', [[120, 380]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[120 + i * 20, 380]]);
  await touch('touchEnd', []); await settle(page);
  const r = await orbState(page);
  console.log('one finger 160 px right →', { yaw: r3(r.yaw), el: r3(r.el) });
  check(r.yaw > 0.2, 'one finger turns');
  await shot(page, 'mobile_rotated');
  /* pinch apart zooms in */
  await reset(page); await settle(page);
  await touch('touchStart', [[160, 420], [230, 420]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[160 - i * 8, 420], [230 + i * 8, 420]]);
  await touch('touchEnd', []); await settle(page);
  const p = await orbState(page);
  console.log('pinch apart →', { zoom: r3(p.zoom), yaw: r3(p.yaw), px: r3(p.px) });
  check(p.zoom < -0.2 && Math.abs(p.yaw) < 0.02, 'pinching apart zooms in (and does not turn)');
  /* twist turns */
  await reset(page); await settle(page);
  const cx = 195, cy = 420, R = 70;
  await touch('touchStart', [[cx - R, cy], [cx + R, cy]]);
  for (let i = 1; i <= 10; i++) { const a = i * 0.07; await touch('touchMove', [[cx - R * Math.cos(a), cy - R * Math.sin(a)], [cx + R * Math.cos(a), cy + R * Math.sin(a)]]); }
  await touch('touchEnd', []); await settle(page);
  const tw = await orbState(page);
  console.log('twist 0.7 rad clockwise →', { yaw: r3(tw.yaw), zoom: r3(tw.zoom) });
  check(tw.yaw > 0.2, 'twisting two fingers turns');
  await shot(page, 'mobile_twisted');
  /* and a tap on the sea */
  await reset(page); await settle(page);
  const n0 = await page.evaluate(() => Engine.surgeInfo().pending.length);
  await touch('touchStart', [[195, 330]]); await touch('touchEnd', []); await wait(page, 400);
  const n1 = await page.evaluate(() => Engine.surgeInfo().pending.length);
  check(n1 > n0, 'a tap on the sea sends a swell');
  await browser.close();
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
