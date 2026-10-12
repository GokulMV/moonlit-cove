/* ─────────────────────────────────────────────────────────────
   server.js — serves the built cove from public/, and keeps the
   wish board. No dependencies.

   Everything is read into memory once at start-up, with gzip and brotli
   copies of what compresses. The page itself is revalidated on every
   visit (so a new deploy shows at once); three.js and the sounds carry
   a content hash in their names, so browsers and Cloudflare keep them.
   PORT comes from the environment (Railway sets it); 8080 otherwise.

   The wish board, under /api/wishes:
     GET    /api/wishes?limit=n   the newest wishes first: { wishes: [{ id, text, name, at }], total, kept }
                                  (kept is false on Railway with no volume attached: the board empties on each deploy)
     POST   /api/wishes           { text, name } → { wish, total }, or { error } in plain words
     DELETE /api/wishes/<id>      with the header X-Admin-Key: $WISH_ADMIN_KEY (switched off when unset)
   Wishes live in $DATA_DIR/wishes.json (./data by default; a Railway volume at /data in production, or wherever
   RAILWAY_VOLUME_MOUNT_PATH says the attached volume is).
   ───────────────────────────────────────────────────────────── */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, 'public');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const COMPRESS = new Set(['.html', '.js', '.svg', '.json', '.txt', '.webmanifest']);

/* the page runs inline scripts and styles, fonts from data: URLs, its own three.js, and fetches its own sounds and wishes.
   The radio on the table streams stations from their broadcasters' own HTTPS servers (any host, so media-src allows https:),
   asks the Radio Browser directory for them, and plays the visitor's own songs from blob: URLs */
const CSP = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:", "img-src 'self' data: blob:",
  "media-src 'self' data: blob: https:", "connect-src 'self' https://*.api.radio-browser.info https://all.api.radio-browser.info", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'", "form-action 'self'"].join('; ');
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': CSP };

function load() {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.error('public/index.html is missing: run `npm run build` first.'); process.exit(1); }
  const files = new Map();
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      const rel = '/' + path.relative(ROOT, full).split(path.sep).join('/'), ext = path.extname(e.name).toLowerCase(), body = fs.readFileSync(full);
      const f = { body, type: TYPES[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(body).digest('base64url') + '"',
        /* hashed names never change content: keep them a year. The page (and anything unhashed) is checked each time */
        cache: /\.[0-9a-f]{10}\./.test(e.name) ? 'public, max-age=31536000, immutable' : 'no-cache' };
      if (COMPRESS.has(ext) && body.length > 1024) {
        f.br = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 10, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } });
        f.gzip = zlib.gzipSync(body, { level: 9 });
      }
      files.set(rel, f);
    }
  };
  walk(ROOT);
  return files;
}
const files = load();

/* ── the wish board ── */
const WISH = { keep: 2000, text: 160, name: 32, body: 4096, gap: 20e3, perHour: 8 };
/* Railway names the volume's mount path when one is attached; otherwise DATA_DIR (the image sets /data), else ./data.
   On Railway without a volume, every deploy starts on a fresh disk and the board comes back empty, so it says so */
const ON_RAILWAY = !!(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);
const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const DATA_DIR = path.resolve(HERE, VOLUME || process.env.DATA_DIR || 'data'), WISH_FILE = path.join(DATA_DIR, 'wishes.json');
const KEPT = !ON_RAILWAY || !!VOLUME;
if (!KEPT) console.warn('Wishes: NO VOLUME IS ATTACHED. Wishes are written to the container’s own disk and will be gone after the next deploy.\n' +
  '  Fix: in Railway, add a Volume (right-click the project canvas, or ⌘K → Volume), attach it to this service, mount path /data.');
const ADMIN_KEY = process.env.WISH_ADMIN_KEY || '';
let wishes = [];                 /* newest first */
function loadWishes() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.warn(`Wishes: could not make ${DATA_DIR} (${e.code}), so new ones will not be kept.`); }
  try {
    const j = JSON.parse(fs.readFileSync(WISH_FILE, 'utf8')), list = Array.isArray(j) ? j : j && Array.isArray(j.wishes) ? j.wishes : [];
    wishes = list.filter(w => w && typeof w.id === 'string' && typeof w.text === 'string' && typeof w.at === 'string')
      .map(w => ({ id: w.id, text: w.text, name: typeof w.name === 'string' ? w.name : '', at: w.at })).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, WISH.keep);
  } catch (e) {
    if (e.code === 'ENOENT') return;
    /* a file that won't parse is put aside (never written over), and the board starts afresh */
    if (e instanceof SyntaxError) { const aside = `${WISH_FILE}.unreadable-${Date.now()}`; try { fs.renameSync(WISH_FILE, aside); } catch (e2) { /* left where it is */ } console.warn(`Wishes: ${WISH_FILE} could not be read; kept aside as ${path.basename(aside)}.`); }
    else console.warn(`Wishes: could not read ${WISH_FILE} (${e.code || e.message}).`);
  }
}
loadWishes();
/* written whole to a temporary file, flushed to disk, then renamed over the old one, so a crash never leaves half a file.
   Writes queue one behind another; wishes that arrive while one waits go out together in it */
let writing = Promise.resolve(), queued = null;
function saveWishes() {
  if (queued) return queued;
  const run = async () => {
    queued = null;
    const tmp = `${WISH_FILE}.${process.pid}.tmp`, fh = await fsp.open(tmp, 'w');
    try { await fh.writeFile(JSON.stringify({ wishes })); await fh.sync(); } finally { await fh.close(); }
    await fsp.rename(tmp, WISH_FILE);
  };
  queued = writing = writing.then(run, run);
  return queued;
}

/* who is asking: Cloudflare's header, then the first proxy hop, then the socket. IPv6 visitors usually hold a whole /64, so count by that */
function clientIp(req) {
  const h = req.headers;
  let ip = String(h['cf-connecting-ip'] || '').trim() || String(h['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  ip = ip.slice(0, 64).toLowerCase();
  if (ip.startsWith('::ffff:') && ip.includes('.')) ip = ip.slice(7);
  if (ip.includes(':')) {
    const [a, b = ''] = ip.split('::'), hd = a ? a.split(':') : [], tl = b ? b.split(':') : [];
    ip = [...hd, ...Array(Math.max(0, 8 - hd.length - tl.length)).fill('0'), ...tl].slice(0, 4).join(':') + '::/64';
  }
  return ip || 'unknown';
}
/* one wish every 20 seconds and eight an hour from each visitor (only wishes that are kept count) */
const recent = new Map();
function tooSoon(ip, now) {
  const t = (recent.get(ip) || []).filter(x => now - x < 3600e3);
  if (t.length && now - t[t.length - 1] < WISH.gap) { const s = Math.ceil((WISH.gap - (now - t[t.length - 1])) / 1000); return { wait: s, error: `Lanterns need a moment to fill with warm air. Try again in ${s} second${s === 1 ? '' : 's'}.` }; }
  if (t.length >= WISH.perHour) return { wait: Math.ceil((3600e3 - (now - t[0])) / 1000), error: 'That’s a lot of wishes for one hour. Come back a little later and make another.' };
  return null;
}
setInterval(() => { const now = Date.now(); for (const [ip, t] of recent) if (!t.length || now - t[t.length - 1] > 3600e3) recent.delete(ip); }, 600e3).unref();

/* plain words only: one kind of space, nothing invisible, nothing that flips the text's direction */
const HIDDEN = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFFF9-\uFFFB\u{E0000}-\u{E007F}]/gu;
const tidy = s => String(s).normalize('NFC').replace(/\s+/g, ' ').replace(HIDDEN, '').replace(/ {2,}/g, ' ').trim();
/* links: web addresses written out, or dressed up as "name dot com" / "name[.]com" */
const TLD = 'com|net|org|io|co|in|me|app|dev|ai|xyz|info|biz|us|uk|ly|gg|tv|to|link|site|online|store|shop|club|live|top|ru|cn|de|fr|jp|br|au|ca|eu|ws|cc|tk|ml|ga|cf|gq|sh|gl|vip|icu|pro|page|blog|tech|fun|cloud|one|win|bid|onion|ir|pk|bd|ng|ke|za|mx|ar|id|ph|vn|th|my|sg|hk|tw|kr|tr|ua|nl|it|es|pl|be|se|no|fi|ch|at|nz|ie|pt|gr|lk|np|ae|sa|eg|is|am';
const LINK = new RegExp(`https?:|ftp:|\\bwww\\b|://|[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.(${TLD})(?![\\p{L}\\p{N}])|[\\p{L}\\p{N}-]+\\s*[\\[({]\\s*(?:\\.|dot)\\s*[\\])}]\\s*(?:${TLD})(?![\\p{L}\\p{N}])|\\sdot\\s(?:com|net|org|in|io|me|co)\\b`, 'giu');
/* a full stop with no space before a capitalised everyday word ("home.In", "end.It") is a typo, not a web address */
const WORDY = new Set(['in', 'it', 'to', 'me', 'no', 'be', 'at', 'my', 'us', 'is', 'am', 'id', 'one', 'live', 'fun', 'win', 'top', 'shop', 'store', 'page', 'link', 'site', 'club', 'blog', 'cloud', 'pro', 'tech', 'online', 'info', 'app', 'dev', 'co', 'ai']);
const hasLink = s => { for (const m of s.matchAll(LINK)) { const t = m[1]; if (!t || !WORDY.has(t.toLowerCase()) || !/^[A-Z][a-z]+$/.test(t)) return true; } return false; };
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/u, HANDLE = /(?:^|[\s(])@[\p{L}\p{N}_.]{2,}/u;
const PHONE = /(?:\+|\b)\d(?:[\s().-]{0,2}\d){7,14}\b/;
/* words that aren't kind on a board everyone reads. Matched after undoing l33t spellings, spaced-out letters and
   stretched ones; the first list on how a word starts (so Scunthorpe and grandiose are safe), the second as whole words */
const ROOTS = ['fuck', 'fuk', 'fck', 'fcuk', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'arsehole', 'dickhead', 'motherf', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'wank', 'twat', 'porn', 'chutiya', 'chutia', 'chootiya', 'madarchod', 'maderchod', 'bhenchod', 'behenchod', 'bhosd', 'gandu', 'lavda', 'lauda', 'lanja', 'kojja'];
const WORDS = new Set(['dick', 'cock', 'pussy', 'tits', 'boobs', 'sex', 'rape', 'rapist', 'kys', 'fag', 'fags', 'retard', 'retarded', 'lund', 'randi', 'gaand', 'modda', 'puku', 'dengu', 'kutta', 'kamina', 'kamine', 'harami', 'haramkhor']);
const LEET = { 0: 'o', 1: 'i', '!': 'i', 3: 'e', 4: 'a', '@': 'a', 5: 's', $: 's', 7: 't', '+': 't', 8: 'b' };
const once = s => s.replace(/(\p{L})\1+/gu, '$1');
const DEDUP = ROOTS.map(once), WORDS1 = new Set([...WORDS].map(once));
function unkind(s) {
  let t = s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[01!34@5$7+8]/g, c => LEET[c]);
  t = t.replace(/(?:^|(?<=[^\p{L}]))(?:\p{L}[\s.*_-]+){2,}\p{L}(?![\p{L}])/gu, m => m.replace(/[\s.*_-]+/g, ''));     /* f u c k, f.u.c.k */
  if (/\b(?:kill|hang)\s*(?:your|ur)\s*self\b/.test(t)) return true;
  for (const w of t.split(/[^\p{L}]+/u)) {
    if (!w) continue;
    const w1 = once(w);
    if (WORDS.has(w) || WORDS1.has(w1) || ROOTS.some(r => w.startsWith(r)) || DEDUP.some(r => w1.startsWith(r))) return true;
  }
  return false;
}
/* what is wrong with a wish (or its name), in kind words; '' when there is nothing */
function refusal(text, name) {
  if (!text) return 'Write a wish first: a few words is plenty.';
  if (text.length > WISH.text) return `Keep your wish to ${WISH.text} characters.`;
  if (name.length > WISH.name) return `Keep your name to ${WISH.name} characters.`;
  for (const s of [text, name]) {
    if (!s) continue;
    if (EMAIL.test(s)) return 'Please leave out email addresses: everyone can read the board.';
    if (hasLink(s)) return 'Wishes stay plain words: please leave out links and web addresses.';
    if (HANDLE.test(s)) return 'Please leave out @handles and other contact details: everyone can read the board.';
    if (PHONE.test(s)) return 'Please leave out phone numbers: everyone can read the board.';
    if (unkind(s)) return 'That doesn’t sound kind. Everyone reads this board, so try saying it another way.';
  }
  return '';
}

/* JSON answers: never cached anywhere, compressed when they are worth it */
function sendJSON(req, res, code, obj, extra = {}) {
  let body = Buffer.from(JSON.stringify(obj));
  const h = { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }, ae = String(req.headers['accept-encoding'] || '');
  if (body.length > 1024) {
    h.Vary = 'Accept-Encoding';
    if (/\bbr\b/.test(ae)) { body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); h['Content-Encoding'] = 'br'; }
    else if (/\bgzip\b/.test(ae)) { body = zlib.gzipSync(body, { level: 6 }); h['Content-Encoding'] = 'gzip'; }
  }
  h['Content-Length'] = body.length;
  res.writeHead(code, h); res.end(req.method === 'HEAD' ? undefined : body);
}
/* the request body, up to `limit` bytes (anything longer is refused, and the connection closed after the answer) */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] || 0) > limit) { reject(Object.assign(new Error('too big'), { status: 413 })); return; }
    const parts = []; let size = 0, over = false;
    req.on('data', c => { if (over) return; size += c.length; if (size > limit) { over = true; reject(Object.assign(new Error('too big'), { status: 413 })); } else parts.push(c); });
    req.on('end', () => { if (!over) resolve(Buffer.concat(parts).toString('utf8')); });
    req.on('error', reject);
  });
}
/* wishes are made from the cove itself: a browser on another site gets no say */
function fromHere(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const o = req.headers.origin; if (!o) return true;
  try { const host = new URL(o).host; return host === req.headers.host || host === req.headers['x-forwarded-host']; } catch (e) { return false; }
}
function isAdmin(req) {
  const h = s => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(req.headers['x-admin-key'] || ''), h(ADMIN_KEY));
}

async function postWish(req, res) {
  if (!fromHere(req)) return sendJSON(req, res, 403, { error: 'Wishes can only be made from the cove itself.' });
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return sendJSON(req, res, 415, { error: 'Send the wish as JSON.' });
  const ip = clientIp(req), now = Date.now(), soon = tooSoon(ip, now);
  if (soon) return sendJSON(req, res, 429, { error: soon.error }, { 'Retry-After': String(soon.wait) });
  let raw;
  try { raw = await readBody(req, WISH.body); } catch (e) { return sendJSON(req, res, e.status || 400, { error: e.status === 413 ? 'That wish is too long to carry.' : 'That didn’t arrive as a wish.' }, { Connection: 'close' }); }
  let j; try { j = JSON.parse(raw); } catch (e) { return sendJSON(req, res, 400, { error: 'That didn’t arrive as a wish.' }); }
  if (!j || typeof j !== 'object' || typeof j.text !== 'string' || (j.name != null && typeof j.name !== 'string')) return sendJSON(req, res, 400, { error: 'That didn’t arrive as a wish.' });
  const text = tidy(j.text), name = tidy(j.name || ''), why = refusal(text, name);
  if (why) return sendJSON(req, res, 400, { error: why });
  const wish = { id: crypto.randomBytes(9).toString('base64url'), text, name, at: new Date(now).toISOString() };
  wishes.unshift(wish); if (wishes.length > WISH.keep) wishes.length = WISH.keep;
  try { await saveWishes(); }
  catch (e) {
    wishes = wishes.filter(w => w.id !== wish.id);
    console.error('Wishes: could not save:', e.message);
    return sendJSON(req, res, 503, { error: 'The board couldn’t keep your wish just now. Try again in a moment.' });
  }
  const t = (recent.get(ip) || []).filter(x => now - x < 3600e3); t.push(now); recent.set(ip, t);
  console.log(`Wishes: ${wish.id} pinned up (${wishes.length} on the board)`);
  sendJSON(req, res, 201, { wish, total: wishes.length });
}
async function deleteWish(req, res, id) {
  if (!ADMIN_KEY) return sendJSON(req, res, 403, { error: 'Taking wishes down is switched off: set WISH_ADMIN_KEY on the server to allow it.' });
  if (!isAdmin(req)) { console.warn(`Wishes: a delete without the right key, from ${clientIp(req)}`); return sendJSON(req, res, 403, { error: 'That key doesn’t open the board.' }); }
  const i = wishes.findIndex(w => w.id === id);
  if (i < 0) return sendJSON(req, res, 404, { error: 'No wish with that id.' });
  const [gone] = wishes.splice(i, 1);
  try { await saveWishes(); }
  catch (e) { wishes.splice(i, 0, gone); console.error('Wishes: could not save:', e.message); return sendJSON(req, res, 503, { error: 'Could not save the board just now.' }); }
  console.log(`Wishes: ${id} taken down (${wishes.length} left)`);
  sendJSON(req, res, 200, { deleted: id, total: wishes.length });
}
async function wishApi(req, res, url) {
  if (url.pathname === '/api/wishes') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const n = Math.max(1, Math.min(WISH.keep, parseInt(url.searchParams.get('limit'), 10) || 100));
      return sendJSON(req, res, 200, { wishes: wishes.slice(0, n), total: wishes.length, kept: KEPT });
    }
    if (req.method === 'POST') return postWish(req, res);
    return sendJSON(req, res, 405, { error: 'Not like that.' }, { Allow: 'GET, HEAD, POST' });
  }
  const id = url.pathname.slice('/api/wishes/'.length);
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return sendJSON(req, res, 404, { error: 'No wish with that id.' });
  if (req.method === 'DELETE') return deleteWish(req, res, id);
  return sendJSON(req, res, 405, { error: 'Not like that.' }, { Allow: 'DELETE' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return; }
  if (url.pathname === '/api/wishes' || url.pathname.startsWith('/api/wishes/')) {
    wishApi(req, res, url).catch(e => { console.error('Wishes:', e); if (!res.headersSent) sendJSON(req, res, 500, { error: 'Something went wrong at the board.' }); });
    return;
  }
  if (url.pathname.startsWith('/api/')) { sendJSON(req, res, 404, { error: 'Nothing here.' }); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let p; try { p = decodeURIComponent(url.pathname); } catch { p = url.pathname; }
  if (p.endsWith('/')) p += 'index.html';
  const f = files.get(p);
  if (!f) { res.writeHead(404, { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end('<!doctype html><meta charset="utf-8"><title>Not here</title><p style="font:16px system-ui;padding:2rem">Nothing here. <a href="/">Back to the cove</a>.</p>'); return; }
  const headers = { ...BASE_HEADERS, 'Content-Type': f.type, 'Cache-Control': f.cache, ETag: f.etag, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, headers); res.end(); return; }
  const ae = String(req.headers['accept-encoding'] || '');
  let body = f.body;
  if (f.br && /\bbr\b/.test(ae)) { body = f.br; headers['Content-Encoding'] = 'br'; }
  else if (f.gzip && /\bgzip\b/.test(ae)) { body = f.gzip; headers['Content-Encoding'] = 'gzip'; }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
});
/* a slow sender can't hold a connection open for long */
server.headersTimeout = 15000; server.requestTimeout = 20000;
server.listen(PORT, () => console.log(`Moonlit Cove on port ${PORT} · ${files.size} files · ${wishes.length} wishes in ${WISH_FILE}${KEPT ? '' : ' (NOT KEPT: no volume)'}${ADMIN_KEY ? '' : ' (deleting is off: no WISH_ADMIN_KEY)'}`));
/* on the way down, let a wish that is being written finish first */
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { writing.catch(() => {}).then(() => server.close(() => process.exit(0))); setTimeout(() => process.exit(0), 3000).unref(); });
