/* The wish board's API, end to end: starts server.js on a spare port with a throwaway data directory, makes wishes,
   checks every refusal, deletes one with the admin key, restarts and checks they were kept. Needs public/ built.
   node tools/wishapi.mjs [port] */
import { spawn } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = +(process.argv[2] || 8851), BASE = `http://127.0.0.1:${PORT}`, KEY = 'a-long-test-key-for-the-board';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cove-wishes-'));
let fails = 0, srv = null, ipN = 0;
const ok = (cond, what) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) fails++; };
async function start(env = {}) {
  srv = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, WISH_ADMIN_KEY: KEY, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', d => process.stdout.write('  [server] ' + d)); srv.stderr.on('data', d => process.stdout.write('  [server] ' + d));
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/healthz')).ok) return; } catch (e) { /* not up yet */ } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start');
}
const stop = () => new Promise(r => { srv.once('exit', r); srv.kill('SIGTERM'); });
/* each wish from its own address, unless one is given, so the 20-second gap only bites where it is meant to */
const post = (body, { ip = '10.0.0.' + (++ipN), headers = {}, raw } = {}) => fetch(BASE + '/api/wishes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...headers }, body: raw ?? JSON.stringify(body) })
  .then(async r => ({ status: r.status, j: await r.json().catch(() => null), h: r.headers }));
const get = q => fetch(BASE + '/api/wishes' + (q || '')).then(async r => ({ status: r.status, j: await r.json(), h: r.headers }));
const del = (id, key) => fetch(BASE + '/api/wishes/' + id, { method: 'DELETE', headers: key ? { 'X-Admin-Key': key } : {} }).then(async r => ({ status: r.status, j: await r.json() }));

try {
  await start();
  let r = await get();
  ok(r.status === 200 && Array.isArray(r.j.wishes) && r.j.total === 0, 'an empty board to begin with');
  ok(r.h.get('cache-control') === 'no-store', 'the API is never cached');
  ok(/media-src[^;]*https:/.test(r.h.get('content-security-policy')) && /connect-src[^;]*radio-browser/.test(r.h.get('content-security-policy')), 'the CSP lets the radio in');

  r = await post({ text: '  May the sea\n\n stay this calm \u202Eforever  ', name: ' Lucía ' }, { ip: '203.0.113.7' });
  ok(r.status === 201 && r.j.wish.text === 'May the sea stay this calm forever' && r.j.wish.name === 'Lucía' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.j.wish.at), 'a wish is pinned, tidied, timestamped: ' + JSON.stringify(r.j && r.j.wish));
  const first = r.j.wish.id;
  r = await post({ text: 'And another one straight away' }, { ip: '203.0.113.7' });
  ok(r.status === 429 && /Try again in \d+ seconds?/.test(r.j.error) && +r.h.get('retry-after') > 0, 'too fast: ' + (r.j && r.j.error));
  r = await post({ text: 'And another one straight away' }, { headers: { 'CF-Connecting-IP': '203.0.113.7' }, ip: '198.51.100.1' });
  ok(r.status === 429, 'Cloudflare\'s address comes first');

  const refused = [
    ['Visit example.com for more', /links/], ['see https://x.y', /links/], ['go to www dot thing', /links/], ['www dot gokul dot com', /links/],['shop at gokul[.]in now', /links/], ['my site is gokul dot com', /links/],
    ['write to me at a.person@example.org', /email/], ['find me @gokul_mv', /handles/], ['call +91 98765 43210', /phone/], ['ring (040) 2345-6789', /phone/],
    ['you are a b1tch', /kind/], ['f u c k this', /kind/], ['fuuuuck', /kind/], ['', /Write a wish/], ['   ', /Write a wish/], ['x'.repeat(161), /160/]];
  for (const [text, want] of refused) { r = await post({ text }); ok(r.status === 400 && want.test(r.j.error), `refused ${JSON.stringify(text.slice(0, 30))}: ${r.j && r.j.error}`); }
  r = await post({ text: 'A fine wish', name: 'n'.repeat(33) }); ok(r.status === 400 && /32/.test(r.j.error), 'a name over 32: ' + r.j.error);
  r = await post({ text: 'A fine wish', name: 'gokul.dev' }); ok(r.status === 400 && /links/.test(r.j.error), 'a link in the name: ' + r.j.error);
  r = await post(null, { raw: '{"text": "' + 'a'.repeat(5000) + '"}' }); ok(r.status === 413, 'a body over 4 KB: ' + r.status);
  r = await post(null, { raw: 'not json' }); ok(r.status === 400, 'not JSON: ' + r.j.error);
  r = await post(null, { raw: '{"text": 5}' }); ok(r.status === 400, 'text that is not a string');
  r = await post({ text: 'hello' }, { headers: { 'Content-Type': 'text/plain' } }); ok(r.status === 415, 'not sent as JSON: ' + r.status);
  r = await post({ text: 'hello' }, { headers: { Origin: 'https://elsewhere.example' } }); ok(r.status === 403, 'from another site: ' + r.j.error);
  r = await post({ text: 'hello' }, { headers: { 'Sec-Fetch-Site': 'cross-site' } }); ok(r.status === 403, 'a cross-site fetch');
  r = await post({ text: 'hello there' }, { headers: { Origin: BASE } }); ok(r.status === 201, 'from the cove itself');

  /* kind and plain words that only look like trouble */
  for (const text of ['Scunthorpe is lovely in spring', 'I love Goa. In December it glows', 'Tired of waiting.It will come', 'Grandiose plans for 2027', 'Peacocks and cockatoos', 'Summer 2026, then 2027']) {
    r = await post({ text }); ok(r.status === 201, `kept ${JSON.stringify(text)}${r.status !== 201 ? ': ' + r.j.error : ''}`);
  }
  r = await get('?limit=3');
  ok(r.j.wishes.length === 3 && r.j.total >= 8 && r.j.wishes[0].at >= r.j.wishes[1].at && r.j.wishes[1].at >= r.j.wishes[2].at, `newest first, limited to 3 of ${r.j.total}`);
  const total = r.j.total, last = r.j.wishes[0].id;

  r = await del(last); ok(r.status === 403, 'delete without the key');
  r = await del(last, 'wrong'); ok(r.status === 403, 'delete with the wrong key');
  r = await del(last, KEY); ok(r.status === 200 && r.j.total === total - 1, 'delete with the key');
  r = await del(last, KEY); ok(r.status === 404, 'that wish is gone');
  const file = path.join(DATA, 'wishes.json'), saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(saved.wishes.length === total - 1 && !fs.readdirSync(DATA).some(f => f.endsWith('.tmp')), 'written whole to ' + file);

  await stop(); await start();
  r = await get('?limit=2000');
  ok(r.j.total === total - 1 && r.j.wishes.at(-1).id === first, `kept across a restart (${r.j.total} wishes)`);
  await stop(); await start({ WISH_ADMIN_KEY: '' });
  r = await del(first, KEY); ok(r.status === 403 && /switched off/.test(r.j.error), 'no admin key, no deleting: ' + r.j.error);
} catch (e) { console.error(e); fails++; }
finally { if (srv && srv.exitCode === null) await stop(); fs.rmSync(DATA, { recursive: true, force: true }); }
console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
