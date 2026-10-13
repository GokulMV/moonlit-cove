/* Spotify in the radio's "Your songs", against a stand-in for Spotify's iFrame API (served in place of the real one, so
   nothing reaches Spotify): a pasted embed code, a link, a URI, a short link and nonsense; the player following the
   radio's power and the radio following the player; the next song; one taken off; the links kept for the next visit;
   and the plain player when the API can't be had. node tools/spotifytest.mjs */
import { open, shot, until } from './lib.mjs';

const MOCK = `(() => {
  const api = { createController(el, o, cb) {
    const f = document.createElement('iframe'); f.src = 'about:blank'; f.setAttribute('width', o.width); f.setAttribute('height', o.height); el.replaceWith(f);
    const L = {}, st = { uri: o.uri, paused: true, pos: 0, dur: 30000 };
    const M = window.__spMock = { st, calls: [], emit(ev, data) { (L[ev] || []).forEach(h => h({ data })); } };
    M.update = () => M.emit('playback_update', { playingURI: st.uri, isPaused: st.paused, isBuffering: false, duration: st.dur, position: st.pos });
    const ctl = { addListener(ev, h) { (L[ev] = L[ev] || []).push(h); },
      loadEntity(u) { M.calls.push('load ' + u); st.uri = u; st.paused = true; st.pos = 0; setTimeout(M.update, 40); },
      play() { M.calls.push('play'); st.paused = false; setTimeout(M.update, 40); },
      resume() { M.calls.push('resume'); st.paused = false; setTimeout(M.update, 40); },
      pause() { M.calls.push('pause'); st.paused = true; setTimeout(M.update, 40); },
      destroy() { f.remove(); } };
    cb(ctl); setTimeout(() => M.emit('ready', {}), 120);
  } };
  setTimeout(() => window.onSpotifyIframeApiReady && window.onSpotifyIframeApiReady(api), 30);
})();`;

const fails = [];
const ok = (c, what) => { console.log((c ? '  ok   ' : '  FAIL ') + what); if (!c) fails.push(what); };
/* (the last route set is asked first: the player's pages, then the API in front of them) */
const route = async (page, apiOk) => {
  await page.route('https://open.spotify.com/embed/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>player</title><body style="background:#222;color:#ddd">a stand-in player</body>' }));
  await page.route('https://open.spotify.com/oembed**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ title: 'A Song Called Test' }) }));
  await page.route('https://open.spotify.com/embed/iframe-api/v1', r => (apiOk ? r.fulfill({ status: 200, contentType: 'text/javascript', body: MOCK }) : r.abort()));
};
const sitDown = async page => {
  await page.evaluate(() => window.__cove.sit(Engine.seatIndex('chair1')));
  await until(page, () => window.__cove.st.camT >= 1 && !document.getElementById('radio').hidden, null, 120000);
};
const R = page => page.evaluate(() => { const r = window.__cove.radio; return { on: r.on, state: r.state, src: r.src, qi: r.qi, msg: r.msg, songs: r.songs.map(s => (s.sp ? `${s.sp.type}:${s.sp.id}` : 'file') + ' ' + s.name),
  calls: (window.__spMock && window.__spMock.calls.slice()) || [], frame: (document.querySelector('#rdSpot iframe') || {}).src || null, box: !document.getElementById('rdSpot').hidden,
  boxH: document.getElementById('rdSpot').style.height, mine: !document.getElementById('rdMine').hidden, form: !document.getElementById('rdSpForm').hidden,
  list: [...document.querySelectorAll('#rdList li')].map(li => (li.getAttribute('aria-current') === 'true' ? '>' : ' ') + li.querySelector('b').textContent), name: document.getElementById('rdName').textContent, sub: document.getElementById('rdSub').textContent,
  kept: JSON.parse(localStorage.getItem('cove.radioSpotify') || 'null') }; });
const paste = async (page, text) => {
  if (await page.locator('#rdSpForm').isHidden()) await page.click('#rdSpAdd');
  await page.fill('#rdSpIn', text); await page.click('#rdSpForm button[type=submit]'); await page.waitForTimeout(400);
};

/* ── with the API ── */
{
  const { browser, page, logs } = await open({ w: 1280, h: 800, rs: 0.35, hour: 22, init: () => { try { if (!sessionStorage.getItem('spt')) { sessionStorage.setItem('spt', '1'); localStorage.removeItem('cove.radioSpotify'); localStorage.setItem('cove.radioSrc', '"world"'); } } catch (e) {} } });
  await route(page, true);
  await sitDown(page);
  await page.click('[data-rsrc="songs"]'); await page.waitForTimeout(200);
  let r = await R(page);
  ok(r.src === 'songs' && r.mine && /paste a Spotify link/.test(r.msg) && !r.on, 'Your songs, empty: both ways to add shown, no file picker forced ' + JSON.stringify(r.msg));
  await page.click('#rdSpAdd'); r = await R(page); ok(r.form, 'Add from Spotify opens the paste box');
  const t0 = await page.evaluate(() => window.__cove.seat.turnT[1]);
  await page.keyboard.press('q'); await page.keyboard.press('e'); await page.waitForTimeout(100);
  ok(await page.evaluate(t0 => window.__cove.seat.turnT[1] === t0 && document.getElementById('rdSpIn').value === 'qe', t0), '(typing q and e in the box types them, and does not turn the chair)');
  await page.fill('#rdSpIn', '<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>');
  await page.click('#rdSpForm button[type=submit]');
  await until(page, () => window.__cove.radio.state === 'playing', null, 15000).catch(() => {});
  await page.waitForTimeout(700);
  r = await R(page); console.log('   ', JSON.stringify(r));
  ok(r.songs.length === 1 && r.songs[0].startsWith('track:4uLU6hMCjMI75M1A2tKUQC'), 'an embed code is read: the track');
  ok(r.on && r.state === 'playing' && r.box && r.boxH === '80px', 'it plays in the player, a strip 80 px tall');
  ok(r.calls.includes('resume'), 'the radio started the player itself');
  ok(r.songs[0].endsWith('A Song Called Test') && r.name === 'A Song Called Test', 'its name from Spotify');
  ok(r.kept && r.kept.length === 1 && r.kept[0].id === '4uLU6hMCjMI75M1A2tKUQC', 'the link is kept on this device');
  ok(!r.form, 'the paste box closes once added');
  /* (a few frames for the dial to catch up: software GL draws slowly) */
  const glow = await page.evaluate(() => new Promise(res => { let k = 0; const f = () => (++k >= 4 ? res(window.__cove.radio.glow) : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  ok(glow > 0.8, 'the dial is lit while Spotify plays (' + glow.toFixed(2) + ')');
  /* paused on the player's own button: the radio goes off; played there: on again */
  await page.evaluate(() => { const M = window.__spMock; M.st.paused = true; M.st.pos = 9000; M.update(); }); await page.waitForTimeout(200);
  r = await R(page); ok(!r.on && r.box && /paused/.test(r.sub), 'paused on the player: the radio is off, the player stays ' + r.sub);
  await page.evaluate(() => { const M = window.__spMock; M.st.paused = false; M.update(); }); await page.waitForTimeout(200);
  r = await R(page); ok(r.on && r.state === 'playing', 'played on the player: the radio is on again');
  /* the power button */
  await page.click('#rdPower'); await page.waitForTimeout(300); r = await R(page);
  ok(!r.on && r.calls[r.calls.length - 1] === 'pause', 'the power button pauses the player');
  await page.click('#rdPower'); await page.waitForTimeout(400); r = await R(page);
  ok(r.on && r.calls[r.calls.length - 1] === 'resume', 'and starts it again, on from where it was');
  /* more: a link with intl- and si=, a URI, a short link, nonsense */
  await paste(page, 'https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3?si=Xy1_abc'); await page.waitForTimeout(900);
  r = await R(page); ok(r.songs.length === 2 && r.songs[1].startsWith('album:1DFixLWuPkv3KT3TnV35m3') && r.qi === 1 && r.boxH === '152px', 'an album link (intl-de, si=): added and played, the player taller');
  ok(r.calls.includes('load spotify:album:1DFixLWuPkv3KT3TnV35m3'), 'the player loaded it');
  await paste(page, 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'); r = await R(page);
  ok(r.songs.length === 3 && r.songs[2].startsWith('playlist:37i9dQZF1DXcBWIGoYBM5M'), 'a spotify: URI');
  await paste(page, 'https://spotify.link/aBcDeF'); r = await R(page);
  ok(r.songs.length === 3 && /short link/.test(r.msg) && r.form, 'a short link is explained, not added');
  await paste(page, 'hello there'); r = await R(page);
  ok(r.songs.length === 3 && /isn’t a Spotify link/.test(r.msg), 'nonsense is turned away');
  await paste(page, 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'); r = await R(page);
  ok(r.songs.length === 3 && r.qi === 0, 'one already there is played, not added twice');
  await page.click('#rdSpAdd'); await page.waitForTimeout(100);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  ok(await page.evaluate(() => window.__cove.seat.on && document.getElementById('rdSpForm').hidden), 'Esc in the box closes it and keeps you sitting');
  /* the next song, from the radio's own button; a song played to its end goes on by itself */
  await page.click('#rdNext'); await page.waitForTimeout(900); r = await R(page);
  ok(r.qi === 1 && r.list[1].startsWith('>'), 'next: the album, marked in the list');
  await page.evaluate(() => { const M = window.__spMock; M.st.paused = false; M.st.pos = 1000; M.update(); M.st.paused = true; M.st.pos = 29900; M.update(); });
  await page.waitForTimeout(3200); r = await R(page);
  ok(r.qi === 2 && r.on, 'played to its end, it goes on to the next by itself');
  /* taken off */
  await page.locator('#rdList li').nth(1).locator('.x').click(); await page.waitForTimeout(200); r = await R(page);
  ok(r.songs.length === 2 && r.kept.length === 2 && !r.songs.some(s => s.startsWith('album:')), 'one taken off, from the list and from what is kept');
  await shot(page, 'spotify_panel');
  /* getting up pauses it */
  await page.evaluate(() => window.__cove.standUp()); await page.waitForTimeout(400); r = await R(page);
  ok(!r.on && r.calls[r.calls.length - 1] === 'pause', 'getting up pauses Spotify too');
  /* the next visit: the links are there */
  await page.reload(); await page.waitForFunction(() => !document.getElementById('enterQuiet').disabled, null, { timeout: 180000 });
  await page.evaluate(() => document.getElementById('enterQuiet').click()); await page.waitForFunction(() => window.__cove && window.__cove.st.entered, null, { timeout: 30000 });
  r = await R(page); ok(r.songs.length === 2 && r.src === 'songs' && r.songs[0].endsWith('A Song Called Test'), 'next visit: the Spotify links are still in your songs');
  ok(!(await page.evaluate(() => !!document.querySelector('script[src*="spotify"]'))), 'and nothing of Spotify’s loads until one is played');
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l) && !/favicon|Potential permissions policy violation/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ':\n    ' + errs.slice(0, 5).join('\n    ') : ''));
  await browser.close();
}

/* ── without the API: the plain player ── */
{
  const { browser, page, logs } = await open({ w: 1280, h: 800, rs: 0.35, hour: 22, init: () => { try { localStorage.removeItem('cove.radioSpotify'); } catch (e) {} } });
  await route(page, false);
  await sitDown(page);
  await page.click('[data-rsrc="songs"]');
  await paste(page, 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=1'); await page.waitForTimeout(800);
  let r = await R(page); console.log('   ', JSON.stringify(r));
  ok(r.frame && r.frame.startsWith('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M') && r.box && r.boxH === '152px', 'no API: the plain player, the playlist in it');
  ok(r.on && r.state === 'waiting' && /Press play/.test(r.msg), 'and a word to press play on it');
  await page.click('#rdPower'); await page.waitForTimeout(200); r = await R(page);
  ok(!r.on && !r.box, 'the power button stops the plain player');
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l) && !/favicon|ERR_FAILED|net::|Potential permissions policy violation/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ':\n    ' + errs.slice(0, 5).join('\n    ') : ''));
  await browser.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
