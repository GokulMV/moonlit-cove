/* Wishes, the board, sitting by the fire and the radio, in the browser.
   web   (default) against server.js on a spare port with a throwaway data directory (needs public/ built):
         a refused wish, a kept one, the board close up, the drawer to the second, a chair, the radio (no network
         here, so world radio must fail kindly) and a song from this device
   file  against dist/page-local.html: wishes kept only on this device
   node tools/wishtest.mjs [web|file] [port] */
import { open, shot, wait, until, root } from './lib.mjs';
import { spawn } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
const mode = process.argv[2] || 'web', PORT = +(process.argv[3] || 8852);
let fails = 0, srv = null;
const ok = (cond, what) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) fails++; };
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cove-wishtest-'));
/* eight seconds of a soft 440 Hz tone, as a WAV: "a song from this device" */
const tone = path.join(DATA, 'a-song.wav');
{ const sr = 22050, n = sr * 8, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / sr) * 6000), 44 + i * 2); fs.writeFileSync(tone, b); }

let url;
if (mode === 'web') {
  srv = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', d => process.stdout.write('  [server] ' + d)); srv.stderr.on('data', d => process.stdout.write('  [server] ' + d));
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) break; } catch (e) { /* not up yet */ } await new Promise(r => setTimeout(r, 100)); }
  url = `http://127.0.0.1:${PORT}/`;
}
const { browser, page, logs } = await open({ w: 960, h: 600, rs: 0.3, url });
/* (software GL starves CSS animations here, and Playwright waits for things to stop moving before it clicks them) */
await page.addStyleTag({ content: '#hud .wish, #hud .radio, #hud .drawer, #hud .toast { animation: none !important; } #hud .rd-power { transition: none !important; }' });
const cove = fn => page.evaluate(fn);
const arrived = () => until(page, () => window.__cove.st.camT >= 1, null, 120000);
try {
  await until(page, () => window.__cove.wish.started && window.__cove.wish.mode !== 'try', null, 60000);
  ok(await cove(() => window.__cove.wish.mode) === (mode === 'web' ? 'server' : 'local'), 'the board is ' + await cove(() => window.__cove.wish.mode));

  /* the lantern button asks for a wish */
  await page.click('#bLantern');
  await until(page, () => !document.getElementById('wish').hidden && document.activeElement && document.activeElement.id === 'wText');
  await page.keyboard.type('Visit example.com tonight');
  ok(await cove(() => document.getElementById('wCount').textContent) === '25 / 160', 'the counter counts');
  if (mode === 'web') {
    await page.click('#wGo');
    await until(page, () => !document.getElementById('wErr').hidden);
    ok(/links/.test(await cove(() => document.getElementById('wErr').textContent)), 'a link is refused, kindly and inline: ' + await cove(() => document.getElementById('wErr').textContent));
    await shot(page, `wish_${mode}_refused`);
  }
  await page.fill('#wText', 'That everyone who sits by this fire finds the calm they came for');
  await page.fill('#wName', 'Lucifer');
  await shot(page, `wish_${mode}_dialog`);
  const before = await cove(() => Engine.life.lanterns);
  await page.click('#wGo');
  await until(page, () => document.getElementById('wish').hidden, null, 20000);
  const w = await cove(() => window.__cove.wish.list[0]);
  ok(w && w.text.startsWith('That everyone') && w.name === 'Lucifer', 'the wish is kept: ' + JSON.stringify(w));
  ok(await cove(() => Engine.life.lanterns) === before + 1, 'and a lantern goes up with it');
  ok(/pinned to the board/.test(await cove(() => document.getElementById('toastText').textContent)), 'toast: ' + await cove(() => document.getElementById('toastText').textContent));

  /* the board, close up, with the drawer listing every wish to the second */
  await cove(() => window.__cove.openWishes());
  await arrived(); await wait(page, 2500);
  const list = await cove(() => [...document.querySelectorAll('#dBody .wlist li')].map(li => li.textContent));
  ok(list.length >= 1 && /\d\d:\d\d:\d\d/.test(list[0]) && list[0].includes('Lucifer'), 'the drawer lists it with seconds: ' + list[0]);
  if (mode === 'file') ok(/only on this device/.test(list[0]), 'marked as kept only on this device');
  await shot(page, `wish_${mode}_board`);
  await cove(() => window.__cove.openChapter(null));
  await arrived();

  if (mode === 'web') {
    /* sitting: a click on the chair itself (through the scene), then the radio */
    const p = await cove(() => { const a = Engine.propAnchors().chair1, q = Engine.project([a[0], a[1] - 0.45, a[2]]); return [q[0] * innerWidth, q[1] * innerHeight]; });
    await page.mouse.click(p[0], p[1]);
    await until(page, () => window.__cove.seat.on, null, 20000);
    ok(true, 'a click on the chair sits you in it');
    await arrived(); await wait(page, 2000);
    await shot(page, 'sit_view');
    await page.click('#rdPower');
    await until(page, () => /reach the radio/.test(document.getElementById('rdMsg').textContent), null, 60000);
    ok(!(await cove(() => window.__cove.radio.on)), 'no network for the radio here: ' + await cove(() => document.getElementById('rdMsg').textContent));
    await shot(page, 'sit_radio_offline');
    /* your songs: a file from this device */
    await page.click('[data-rsrc="songs"]');
    await page.setInputFiles('#rdFile', tone);
    await until(page, () => window.__cove.radio.state === 'playing', null, 30000);
    const t0 = await cove(() => window.__cove.radio.el.currentTime); await wait(page, 1500); const t1 = await cove(() => window.__cove.radio.el.currentTime);
    ok(t1 > t0, `a song from this device plays (${t0.toFixed(2)} → ${t1.toFixed(2)} s): ${await cove(() => document.getElementById('rdName').textContent)}`);
    ok(/^blob:/.test(await cove(() => window.__cove.radio.el.src)), 'from an object URL, never uploaded');
    ok(await cove(() => document.getElementById('rdPower').getAttribute('aria-pressed')) === 'true', 'the power button shows it on');
    await wait(page, 1500);
    await shot(page, 'sit_radio_song');
    await page.keyboard.press('Escape');
    await until(page, () => !window.__cove.seat.on);
    ok(!(await cove(() => window.__cove.radio.on)) && await cove(() => document.getElementById('seatHud').hidden), 'Esc: up out of the chair, and the radio off');
  }
  const errs = logs.filter(l => /^\[(pageerror|error)\]/.test(l) && !/radio-browser|ERR_|Failed to load resource|net::/.test(l));
  ok(!errs.length, 'no errors on the page' + (errs.length ? ': ' + errs.join(' | ') : ''));
} catch (e) { console.error(e); fails++; await shot(page, `wish_${mode}_failed`).catch(() => {}); }
finally {
  await browser.close();
  if (srv) await new Promise(r => { srv.once('exit', r); srv.kill('SIGTERM'); });
  fs.rmSync(DATA, { recursive: true, force: true });
}
console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
