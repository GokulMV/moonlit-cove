/* The toolbox of drawings, end to end: starts server.js on a spare port with a throwaway data directory, puts drawings
   in, reads them back, checks every refusal (not a picture, an SVG, a wrong size, too soon, an unkind name), takes one
   out with the admin key, restarts and checks the rest were kept. Needs public/ built.
   node tools/drawapi.mjs [port] */
import { spawn } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path'; import zlib from 'zlib';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = +(process.argv[2] || 8853), BASE = `http://127.0.0.1:${PORT}`, KEY = 'a-long-test-key-for-the-toolbox';
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'cove-draw-'));
let fails = 0, srv = null, ipN = 0;
/* COVE_TEST_PG=postgres://user:password@host:port runs the same checks against a throwaway Postgres database */
const PG = process.env.COVE_TEST_PG || '';
let DB_URL = '', pgAdmin = null, dbName = '';
if (PG) {
  const { default: pg } = await import('pg');
  dbName = 'cove_test_' + Date.now().toString(36); pgAdmin = new pg.Client({ connectionString: PG + '/postgres' });
  await pgAdmin.connect(); await pgAdmin.query(`CREATE DATABASE ${dbName}`); DB_URL = `${PG}/${dbName}`;
  console.log('  (in Postgres: ' + dbName + ')');
}
const ok = (cond, what) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) fails++; };
/* a real PNG: w×h, a paper colour with a diagonal stroke */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function png(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3, ink = Math.abs(x * h / w - y) < 2; raw[i] = ink ? 40 : 246; raw[i + 1] = ink ? 30 : 241; raw[i + 2] = ink ? 20 : 228; } }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(CRC(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const dataUrl = (b, type = 'png') => `data:image/${type};base64,${b.toString('base64')}`;
async function start(env = {}) {
  srv = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, WISH_ADMIN_KEY: KEY, DATABASE_URL: DB_URL, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', d => process.stdout.write('  [server] ' + d)); srv.stderr.on('data', d => process.stdout.write('  [server] ' + d));
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/healthz')).ok) return; } catch (e) { /* not up yet */ } await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start');
}
const stop = () => new Promise(r => { srv.once('exit', r); srv.kill('SIGTERM'); });
const post = (body, { ip = '10.1.0.' + (++ipN), raw } = {}) => fetch(BASE + '/api/drawings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: raw ?? JSON.stringify(body) })
  .then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));
const list = () => fetch(BASE + '/api/drawings').then(async r => ({ status: r.status, j: await r.json(), h: r.headers }));
try {
  await start();
  let r = await list();
  ok(r.status === 200 && r.j.total === 0 && Array.isArray(r.j.drawings), 'an empty toolbox to begin with');
  const pic = png(800, 600);
  r = await post({ image: dataUrl(pic), name: 'Gokul' });
  ok(r.status === 201 && r.j.drawing && r.j.drawing.w === 800 && r.j.drawing.h === 600 && r.j.drawing.name === 'Gokul', 'a drawing goes in: ' + JSON.stringify(r.j && r.j.drawing));
  const first = r.j.drawing;
  const img = await fetch(BASE + first.url), bytes = Buffer.from(await img.arrayBuffer());
  ok(img.status === 200 && img.headers.get('content-type') === 'image/png' && bytes.equals(pic), 'and comes back out exactly, as a PNG');
  ok(/immutable/.test(img.headers.get('cache-control') || ''), 'the picture is cached for good (its id never changes)');
  r = await post({ image: dataUrl(png(400, 300)) });
  ok(r.status === 201 && r.j.drawing.name === '', 'an unsigned one goes in too');
  r = await list(); ok(r.j.total === 2 && r.j.drawings[0].id !== first.id, 'the newest first');
  /* refusals */
  r = await post({ image: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') });
  ok(r.status === 400, 'an SVG is turned away: ' + (r.j && r.j.error));
  r = await post({ image: dataUrl(Buffer.from('not a picture at all, just words')) });
  ok(r.status === 400, 'something that is not a picture is turned away: ' + (r.j && r.j.error));
  r = await post({ image: dataUrl(png(20, 20)) });
  ok(r.status === 400, 'a picture of an odd size is turned away: ' + (r.j && r.j.error));
  r = await post({ image: dataUrl(pic), name: 'visit spam.com' });
  ok(r.status === 400, 'a name with a link is turned away: ' + (r.j && r.j.error));
  const ip = '10.9.9.9'; await post({ image: dataUrl(png(300, 200)) }, { ip }); r = await post({ image: dataUrl(png(300, 200)) }, { ip });
  ok(r.status === 429, 'two in a row from one visitor: ' + (r.j && r.j.error));
  r = await post({}, { raw: '{"image": "' + 'A'.repeat(1300 * 1024) + '"}' });
  ok(r.status === 413, 'one too big to carry is turned away');
  /* taking one out */
  let d = await fetch(BASE + '/api/drawings/' + first.id, { method: 'DELETE' });
  ok(d.status === 403, 'no key, no taking out');
  d = await fetch(BASE + '/api/drawings/' + first.id, { method: 'DELETE', headers: { 'X-Admin-Key': KEY } });
  ok(d.status === 200, 'the key takes one out');
  ok((await fetch(BASE + first.url)).status === 404, 'and its picture has gone');
  r = await list(); const left = r.j.total;
  await stop(); await start();
  r = await list(); ok(r.j.total === left && left === 2, `kept across a restart (${r.j.total})`);
  if (PG) {
    const n = new (await import('pg')).default.Client({ connectionString: DB_URL }); await n.connect();
    const c = (await n.query('SELECT count(*)::int AS c FROM cove_drawings')).rows[0].c; await n.end();
    ok(c === left && !fs.existsSync(path.join(DATA, 'drawings.json')), `kept in the database (${c} rows), not in files`);
    const back = await fetch(BASE + r.j.drawings[0].url); ok(back.status === 200 && (await back.arrayBuffer()).byteLength > 100, 'a picture comes back out of the database after a restart');
  } else ok(fs.readdirSync(path.join(DATA, 'drawings')).filter(f => /\.(png|webp)$/.test(f)).length === left, 'one file for each drawing kept, nothing left over');
} catch (e) { console.error(e); fails++; }
finally { if (srv) await stop(); fs.rmSync(DATA, { recursive: true, force: true }); if (pgAdmin) { await pgAdmin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(e => console.warn(e.message)); await pgAdmin.end(); } }
console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
