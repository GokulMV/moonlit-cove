/* ─────────────────────────────────────────────────────────────
   server.js — serves the built cove from public/, and keeps the
   wish board and the toolbox of drawings. One dependency: the
   Postgres client (pg), loaded only when there is a database.

   Everything is read into memory once at start-up, with gzip and brotli
   copies of what compresses. The page itself is revalidated on every
   visit (so a new deploy shows at once); three.js and the sounds carry
   a content hash in their names, so browsers and Cloudflare keep them.
   PORT comes from the environment (Railway sets it); 8080 otherwise.

   The wish board, under /api/wishes:
     GET    /api/wishes?limit=n   the newest wishes first: { wishes: [{ id, text, name, at }], total, kept }
                                  (kept is false on Railway with neither a database nor a volume: the board empties on each deploy)
     POST   /api/wishes           { text, name } → { wish, total }, or { error } in plain words
     DELETE /api/wishes/<id>      with the header X-Admin-Key: $WISH_ADMIN_KEY (switched off when unset)
   With DATABASE_URL set, wishes and drawings live in Postgres (tables cove_wishes and cove_drawings, made on first
   start; anything already kept in files moves in then). Without it, wishes live in $DATA_DIR/wishes.json (./data by
   default, /data in the image, or wherever RAILWAY_VOLUME_MOUNT_PATH says an attached volume is).

   The drawing board, under /api/drawings (pictures drawn at the picnic table, kept in the toolbox):
     GET    /api/drawings?limit=n     the newest first: { drawings: [{ id, name, at, w, h, url }], total, kept }
     GET    /api/drawings/<id>.png    the picture itself (PNG or WebP; never changes, so cached for a year)
     POST   /api/drawings             { image: a PNG or WebP data: URL, name } → { drawing, total }, or { error }
     DELETE /api/drawings/<id>        with the header X-Admin-Key: $WISH_ADMIN_KEY
   Without a database, they live in $DATA_DIR/drawings/ with an index in $DATA_DIR/drawings.json.
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
   asks the Radio Browser directory for them, and plays the visitor's own songs from blob: URLs. Spotify links pasted into
   the radio play in Spotify's own player (an iframe from open.spotify.com, driven by its iFrame API, a script from there
   that loads the rest from Spotify's CDN), and a pasted link's name is asked of Spotify's oEmbed. In front of the site,
   Cloudflare adds its Web Analytics beacon (a script from static.cloudflareinsights.com that reports page loads, no
   cookies, to cloudflareinsights.com) */
const SPOTIFY = 'https://open.spotify.com', SPOTIFY_CDN = 'https://embed-cdn.spotifycdn.com', CF_BEACON = 'https://static.cloudflareinsights.com', CF_RUM = 'https://cloudflareinsights.com';
const CSP = ["default-src 'self'", `script-src 'self' 'unsafe-inline' ${SPOTIFY} ${SPOTIFY_CDN} ${CF_BEACON}`, "style-src 'self' 'unsafe-inline'", "font-src 'self' data:", "img-src 'self' data: blob:",
  "media-src 'self' data: blob: https:", `connect-src 'self' https://*.api.radio-browser.info https://all.api.radio-browser.info ${SPOTIFY} ${SPOTIFY_CDN} ${CF_RUM}`, `frame-src ${SPOTIFY}`,
  "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'", "form-action 'self'"].join('; ');
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

/* ── where the wishes and the drawings are kept ──
   In Postgres when DATABASE_URL is set, so they outlive every deploy (on Railway: add a PostgreSQL database to the
   project, then give this service the variable DATABASE_URL = ${{Postgres.DATABASE_URL}}). Otherwise in files under
   DATA_DIR: Railway's volume mount path when one is attached, else $DATA_DIR (the image sets /data), else ./data.
   On Railway with neither, every deploy starts on a fresh disk and the board comes back empty, so it says so */
const WISH = { keep: 2000, text: 160, name: 32, body: 4096, gap: 20e3, perHour: 8 };
const DRAW = { keep: 600, body: 1100 * 1024, bytes: 700 * 1024, maxW: 1600, maxH: 1200, minW: 64, minH: 48, gap: 30e3, perHour: 10, name: 32 };
const ON_RAILWAY = !!(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);
const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const DATA_DIR = path.resolve(HERE, VOLUME || process.env.DATA_DIR || 'data'), WISH_FILE = path.join(DATA_DIR, 'wishes.json');
const DRAW_DIR = path.join(DATA_DIR, 'drawings'), DRAW_FILE = path.join(DATA_DIR, 'drawings.json');
const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
const ADMIN_KEY = process.env.WISH_ADMIN_KEY || '';
let wishes = [];                 /* newest first: { id, text, name, at } */
let drawings = [];               /* newest first: { id, name, at, w, h, ext } */

/* ── in files ── */
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

function loadDrawings() {
  try { fs.mkdirSync(DRAW_DIR, { recursive: true }); } catch (e) { console.warn(`Drawings: could not make ${DRAW_DIR} (${e.code}).`); }
  try {
    const j = JSON.parse(fs.readFileSync(DRAW_FILE, 'utf8')), list = Array.isArray(j && j.drawings) ? j.drawings : [];
    drawings = list.filter(d => d && /^[A-Za-z0-9_-]{6,40}$/.test(d.id) && (d.ext === 'png' || d.ext === 'webp') && fs.existsSync(path.join(DRAW_DIR, `${d.id}.${d.ext}`)))
      .map(d => ({ id: d.id, name: typeof d.name === 'string' ? d.name : '', at: String(d.at), w: d.w | 0, h: d.h | 0, ext: d.ext })).slice(0, DRAW.keep);
  } catch (e) { if (e.code !== 'ENOENT') console.warn(`Drawings: could not read ${DRAW_FILE} (${e.code || e.message}); starting afresh.`); }
}
let drawWriting = Promise.resolve(), drawQueued = null;
function saveDrawings() {
  if (drawQueued) return drawQueued;
  const run = async () => {
    drawQueued = null;
    const tmp = `${DRAW_FILE}.${process.pid}.tmp`, fh = await fsp.open(tmp, 'w');
    try { await fh.writeFile(JSON.stringify({ drawings })); await fh.sync(); } finally { await fh.close(); }
    await fsp.rename(tmp, DRAW_FILE);
  };
  drawQueued = drawWriting = drawWriting.then(run, run);
  return drawQueued;
}
const newestFirst = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
const fileStore = {
  kind: 'files', kept: !ON_RAILWAY || !!VOLUME, where: DATA_DIR,
  async init() { loadWishes(); loadDrawings(); },
  async addWish(w) {
    wishes.unshift(w); if (wishes.length > WISH.keep) wishes.length = WISH.keep;
    try { await saveWishes(); } catch (e) { wishes = wishes.filter(x => x.id !== w.id); throw e; }
  },
  async removeWish(id) {
    const i = wishes.findIndex(w => w.id === id); if (i < 0) return false;
    const [gone] = wishes.splice(i, 1);
    try { await saveWishes(); } catch (e) { wishes.splice(i, 0, gone); throw e; }
    return true;
  },
  async addDrawing(d, buf) {
    const file = path.join(DRAW_DIR, `${d.id}.${d.ext}`), tmp = `${file}.${process.pid}.tmp`;
    try {
      await fsp.mkdir(DRAW_DIR, { recursive: true });
      const fh = await fsp.open(tmp, 'w'); try { await fh.writeFile(buf); await fh.sync(); } finally { await fh.close(); }
      await fsp.rename(tmp, file);
      drawings.unshift(d);
      const gone = drawings.length > DRAW.keep ? drawings.splice(DRAW.keep) : [];
      await saveDrawings();
      for (const g of gone) fsp.unlink(path.join(DRAW_DIR, `${g.id}.${g.ext}`)).catch(() => {});
    } catch (e) { drawings = drawings.filter(x => x.id !== d.id); fsp.unlink(file).catch(() => {}); fsp.unlink(tmp).catch(() => {}); throw e; }
  },
  async drawingImage(id, ext) {
    const d = drawings.find(x => x.id === id); if (!d || d.ext !== ext) return null;
    try { return await fsp.readFile(path.join(DRAW_DIR, `${d.id}.${d.ext}`)); } catch (e) { return null; }
  },
  async removeDrawing(id) {
    const d = drawings.find(x => x.id === id); if (!d) return false;
    drawings = drawings.filter(x => x !== d);
    try { await saveDrawings(); } catch (e) { drawings.push(d); drawings.sort(newestFirst); throw e; }
    fsp.unlink(path.join(DRAW_DIR, `${d.id}.${d.ext}`)).catch(() => {});
    return true;
  },
  refresh() {},
  async close() { await Promise.all([writing.catch(() => {}), drawWriting.catch(() => {})]); }
};

/* ── in Postgres: two tables, made on first start. Everything is read into memory then (two thousand wishes and six
   hundred drawings' names are small; the pictures stay in the database, with the most recently looked at kept in
   memory too), and read again every so often, in case another copy of the server added something ── */
function pgStore(pg) {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 4, idleTimeoutMillis: 30e3, connectionTimeoutMillis: 10e3 });
  /* (a connection the database closes while idle is reported here: unheard, it would bring the server down) */
  pool.on('error', e => console.warn('Store: the database closed a connection:', e.message));
  const q = (text, params) => pool.query(text, params), iso = t => new Date(t).toISOString();
  let ready = false, loadedAt = 0, loading = null, writes = 0;
  /* pictures lately looked at, up to 48 MB */
  const pics = new Map(), PICS = 48 * 1024 * 1024; let picBytes = 0;
  const uncache = id => { const c = pics.get(id); if (c) { pics.delete(id); picBytes -= c.b.length; } };
  const cache = (id, b, ext) => { uncache(id); if (b.length > PICS / 16) return; pics.set(id, { b, ext }); picBytes += b.length; for (const [k] of pics) { if (picBytes <= PICS) break; uncache(k); } };
  async function load() {
    const w0 = writes;
    const [w, d] = await Promise.all([
      q('SELECT id, text, name, at FROM cove_wishes ORDER BY at DESC, id DESC LIMIT $1', [WISH.keep]),
      q('SELECT id, name, at, w, h, ext FROM cove_drawings ORDER BY at DESC, id DESC LIMIT $1', [DRAW.keep])]);
    /* (something was written while this was being read: keep what is in hand; the next look will have it all) */
    if (writes !== w0) return;
    wishes = w.rows.map(r => ({ id: r.id, text: r.text, name: r.name, at: iso(r.at) }));
    drawings = d.rows.map(r => ({ id: r.id, name: r.name, at: iso(r.at), w: r.w, h: r.h, ext: r.ext }));
    loadedAt = Date.now();
  }
  /* wishes and drawings kept in files before there was a database (on a volume, or this machine's own disk) move in, once */
  async function adopt() {
    const n = (await q('SELECT (SELECT count(*) FROM cove_wishes)::int AS w, (SELECT count(*) FROM cove_drawings)::int AS d')).rows[0];
    if (!n.w && fs.existsSync(WISH_FILE)) {
      loadWishes();
      for (const x of wishes) await q('INSERT INTO cove_wishes (id, text, name, at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING', [x.id, x.text, x.name, x.at]);
      if (wishes.length) console.log(`Store: moved ${wishes.length} wishes from ${WISH_FILE} into the database.`);
    }
    if (!n.d && fs.existsSync(DRAW_FILE)) {
      loadDrawings(); let k = 0;
      for (const x of drawings) {
        let b; try { b = fs.readFileSync(path.join(DRAW_DIR, `${x.id}.${x.ext}`)); } catch (e) { continue; }
        await q('INSERT INTO cove_drawings (id, name, at, w, h, ext, img) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING', [x.id, x.name, x.at, x.w, x.h, x.ext, b]); k++;
      }
      if (k) console.log(`Store: moved ${k} drawings from ${DRAW_DIR} into the database.`);
    }
  }
  async function setup() {
    await q("CREATE TABLE IF NOT EXISTS cove_wishes (id text PRIMARY KEY, text text NOT NULL, name text NOT NULL DEFAULT '', at timestamptz NOT NULL)");
    await q('CREATE INDEX IF NOT EXISTS cove_wishes_at ON cove_wishes (at DESC)');
    await q("CREATE TABLE IF NOT EXISTS cove_drawings (id text PRIMARY KEY, name text NOT NULL DEFAULT '', at timestamptz NOT NULL, w integer NOT NULL, h integer NOT NULL, ext text NOT NULL CHECK (ext IN ('png', 'webp')), img bytea NOT NULL)");
    await q('CREATE INDEX IF NOT EXISTS cove_drawings_at ON cove_drawings (at DESC)');
    await adopt(); await load(); ready = true;
  }
  const trim = (table, keep) => q(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} ORDER BY at DESC, id DESC OFFSET $1)`, [keep]).catch(e => console.warn(`Store: could not clear out the oldest in ${table}:`, e.message));
  let where = 'Postgres';
  try { const u = new URL(DATABASE_URL); where = `Postgres at ${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`; } catch (e) { /* not a URL pg can't read either: it will say so */ }
  return {
    kind: 'postgres', kept: true, where,
    /* the database can take a moment to come up beside the server: a few tries, then carry on and keep trying */
    async init() {
      for (let i = 1; ; i++) {
        try { await setup(); return; } catch (e) {
          console.warn(`Store: the database isn't answering (${e.code || e.message})${i < 6 ? ', trying again' : ''}.`);
          if (i < 6) { await new Promise(r => setTimeout(r, 2500)); continue; }
          const again = setInterval(() => setup().then(() => { clearInterval(again); console.log(`Store: the database answered: ${wishes.length} wishes, ${drawings.length} drawings.`); }, () => {}), 30e3);
          again.unref(); return;
        }
      }
    },
    async addWish(w) {
      await q('INSERT INTO cove_wishes (id, text, name, at) VALUES ($1, $2, $3, $4)', [w.id, w.text, w.name, w.at]); writes++;
      wishes = [w, ...wishes.filter(x => x.id !== w.id)].slice(0, WISH.keep);
      trim('cove_wishes', WISH.keep);
    },
    async removeWish(id) { const r = await q('DELETE FROM cove_wishes WHERE id = $1', [id]); writes++; wishes = wishes.filter(w => w.id !== id); return r.rowCount > 0; },
    async addDrawing(d, buf) {
      await q('INSERT INTO cove_drawings (id, name, at, w, h, ext, img) VALUES ($1, $2, $3, $4, $5, $6, $7)', [d.id, d.name, d.at, d.w, d.h, d.ext, buf]); writes++;
      drawings = [d, ...drawings.filter(x => x.id !== d.id)];
      for (const g of drawings.splice(DRAW.keep)) uncache(g.id);
      cache(d.id, buf, d.ext); trim('cove_drawings', DRAW.keep);
    },
    async drawingImage(id, ext) {
      const c = pics.get(id); if (c) { pics.delete(id); pics.set(id, c); return c.ext === ext ? c.b : null; }
      const row = (await q('SELECT ext, img FROM cove_drawings WHERE id = $1', [id])).rows[0];
      if (!row) return null;
      cache(id, row.img, row.ext); return row.ext === ext ? row.img : null;
    },
    async removeDrawing(id) { const r = await q('DELETE FROM cove_drawings WHERE id = $1', [id]); writes++; drawings = drawings.filter(x => x.id !== id); uncache(id); return r.rowCount > 0; },
    /* (a look at the database at most every fifteen seconds, never holding up the answer) */
    refresh() { if (!ready || loading || Date.now() - loadedAt < 15e3) return; loading = load().catch(e => console.warn('Store: could not read the database:', e.code || e.message)).finally(() => { loading = null; }); },
    async close() { await pool.end().catch(() => {}); }
  };
}

let pgModule = null;
if (DATABASE_URL) { try { pgModule = (await import('pg')).default; } catch (e) { console.error('Store: DATABASE_URL is set, but the pg package isn’t installed (npm install). Keeping things in files instead.'); } }
const store = pgModule ? pgStore(pgModule) : fileStore;
await store.init();
if (!store.kept) console.warn('Wishes and drawings: NOTHING IS KEPT ACROSS DEPLOYS. They are written to the container’s own disk, which every deploy replaces.\n' +
  '  Fix: in Railway, add a PostgreSQL database to the project (⌘K → Database → PostgreSQL), then in this service’s Variables\n' +
  '  add DATABASE_URL with the value ${{Postgres.DATABASE_URL}}. (A volume mounted at /data works too.)');
/* what a picture is and how big, from its own header: PNG or WebP only (nothing else is taken, SVG least of all) */
function imageInfo(b) {
  if (b.length > 33 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString('ascii', 12, 16) === 'IHDR')
    return b.toString('ascii', b.length - 8, b.length - 4) === 'IEND' ? { ext: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const c = b.toString('ascii', 12, 16);
    if (c === 'VP8X') return { ext: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (c === 'VP8L' && b[20] === 0x2f) { const v = b.readUInt32LE(21); return { ext: 'webp', w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1 }; }
    if (c === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { ext: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  return null;
}
const recentDraw = new Map();
function tooSoonDraw(ip, now) {
  const t = (recentDraw.get(ip) || []).filter(x => now - x < 3600e3);
  if (t.length && now - t[t.length - 1] < DRAW.gap) { const s = Math.ceil((DRAW.gap - (now - t[t.length - 1])) / 1000); return { wait: s, error: `The toolbox is still closing. Try again in ${s} second${s === 1 ? '' : 's'}.` }; }
  if (t.length >= DRAW.perHour) return { wait: Math.ceil((3600e3 - (now - t[0])) / 1000), error: 'That’s a lot of drawings for one hour. Come back a little later and draw another.' };
  return null;
}
setInterval(() => { const now = Date.now(); for (const [ip, t] of recentDraw) if (!t.length || now - t[t.length - 1] > 3600e3) recentDraw.delete(ip); }, 600e3).unref();

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

/* what is wrong with a name signed on a drawing; '' when there is nothing */
function nameRefusal(name) {
  if (name.length > DRAW.name) return `Keep your name to ${DRAW.name} characters.`;
  if (!name) return '';
  if (EMAIL.test(name)) return 'Please leave out email addresses: everyone can open the toolbox.';
  if (hasLink(name)) return 'Please leave out links and web addresses.';
  if (HANDLE.test(name) || PHONE.test(name)) return 'Please leave out @handles and phone numbers: everyone can open the toolbox.';
  if (unkind(name)) return 'That doesn’t sound kind. Everyone can open the toolbox, so try another name.';
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
  try { await store.addWish(wish); }
  catch (e) {
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
  let gone;
  try { gone = await store.removeWish(id); }
  catch (e) { console.error('Wishes: could not save:', e.message); return sendJSON(req, res, 503, { error: 'Could not save the board just now.' }); }
  if (!gone) return sendJSON(req, res, 404, { error: 'No wish with that id.' });
  console.log(`Wishes: ${id} taken down (${wishes.length} left)`);
  sendJSON(req, res, 200, { deleted: id, total: wishes.length });
}
async function wishApi(req, res, url) {
  if (url.pathname === '/api/wishes') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const n = Math.max(1, Math.min(WISH.keep, parseInt(url.searchParams.get('limit'), 10) || 100));
      store.refresh();
      return sendJSON(req, res, 200, { wishes: wishes.slice(0, n), total: wishes.length, kept: store.kept });
    }
    if (req.method === 'POST') return postWish(req, res);
    return sendJSON(req, res, 405, { error: 'Not like that.' }, { Allow: 'GET, HEAD, POST' });
  }
  const id = url.pathname.slice('/api/wishes/'.length);
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return sendJSON(req, res, 404, { error: 'No wish with that id.' });
  if (req.method === 'DELETE') return deleteWish(req, res, id);
  return sendJSON(req, res, 405, { error: 'Not like that.' }, { Allow: 'DELETE' });
}

const drawingOut = d => ({ id: d.id, name: d.name, at: d.at, w: d.w, h: d.h, url: `/api/drawings/${d.id}.${d.ext}` });
async function postDrawing(req, res) {
  if (!fromHere(req)) return sendJSON(req, res, 403, { error: 'Drawings can only be made at the cove itself.' });
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return sendJSON(req, res, 415, { error: 'Send the drawing as JSON.' });
  const ip = clientIp(req), now = Date.now(), soon = tooSoonDraw(ip, now);
  if (soon) return sendJSON(req, res, 429, { error: soon.error }, { 'Retry-After': String(soon.wait) });
  let raw;
  try { raw = await readBody(req, DRAW.body); } catch (e) { return sendJSON(req, res, e.status || 400, { error: e.status === 413 ? 'That drawing is too big to carry.' : 'That didn’t arrive as a drawing.' }, { Connection: 'close' }); }
  let j; try { j = JSON.parse(raw); } catch (e) { return sendJSON(req, res, 400, { error: 'That didn’t arrive as a drawing.' }); }
  if (!j || typeof j.image !== 'string' || (j.name != null && typeof j.name !== 'string')) return sendJSON(req, res, 400, { error: 'That didn’t arrive as a drawing.' });
  const m = /^data:image\/(png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(j.image);
  if (!m) return sendJSON(req, res, 400, { error: 'Drawings come as PNG or WebP pictures.' });
  const buf = Buffer.from(m[2], 'base64'), info = imageInfo(buf);
  if (!info || info.ext !== m[1]) return sendJSON(req, res, 400, { error: 'That picture couldn’t be read.' });
  if (buf.length > DRAW.bytes) return sendJSON(req, res, 413, { error: 'That drawing is too big to keep.' });
  if (info.w > DRAW.maxW || info.h > DRAW.maxH || info.w < DRAW.minW || info.h < DRAW.minH) return sendJSON(req, res, 400, { error: 'That picture is an odd size for the board.' });
  const name = tidy(j.name || ''), why = nameRefusal(name);
  if (why) return sendJSON(req, res, 400, { error: why });
  const d = { id: crypto.randomBytes(9).toString('base64url'), name, at: new Date(now).toISOString(), w: info.w, h: info.h, ext: info.ext };
  try { await store.addDrawing(d, buf); }
  catch (e) {
    console.error('Drawings: could not keep one:', e.message);
    return sendJSON(req, res, 503, { error: 'The toolbox couldn’t keep your drawing just now. Try again in a moment.' });
  }
  const t = (recentDraw.get(ip) || []).filter(x => now - x < 3600e3); t.push(now); recentDraw.set(ip, t);
  console.log(`Drawings: ${d.id} put in the toolbox (${drawings.length} in it, ${Math.round(buf.length / 1024)} KB)`);
  sendJSON(req, res, 201, { drawing: drawingOut(d), total: drawings.length });
}
async function drawApi(req, res, url) {
  if (url.pathname === '/api/drawings') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const n = Math.max(1, Math.min(DRAW.keep, parseInt(url.searchParams.get('limit'), 10) || 60));
      store.refresh();
      return sendJSON(req, res, 200, { drawings: drawings.slice(0, n).map(drawingOut), total: drawings.length, kept: store.kept });
    }
    if (req.method === 'POST') return postDrawing(req, res);
    return sendJSON(req, res, 405, { error: 'Not like that.' }, { Allow: 'GET, HEAD, POST' });
  }
  const rest = url.pathname.slice('/api/drawings/'.length), m = /^([A-Za-z0-9_-]{6,40})(?:\.(png|webp))?$/.exec(rest);
  if (!m) return sendJSON(req, res, 404, { error: 'No drawing with that id.' });
  if (req.method === 'DELETE' && !m[2]) {
    if (!ADMIN_KEY) return sendJSON(req, res, 403, { error: 'Taking drawings out is switched off: set WISH_ADMIN_KEY on the server to allow it.' });
    if (!isAdmin(req)) { console.warn(`Drawings: a delete without the right key, from ${clientIp(req)}`); return sendJSON(req, res, 403, { error: 'That key doesn’t open the toolbox.' }); }
    let gone;
    try { gone = await store.removeDrawing(m[1]); } catch (e) { console.error('Drawings: could not take one out:', e.message); return sendJSON(req, res, 503, { error: 'Could not save the toolbox just now.' }); }
    if (!gone) return sendJSON(req, res, 404, { error: 'No drawing with that id.' });
    console.log(`Drawings: ${m[1]} taken out (${drawings.length} left)`);
    return sendJSON(req, res, 200, { deleted: m[1], total: drawings.length });
  }
  if ((req.method === 'GET' || req.method === 'HEAD') && m[2]) {
    let body; try { body = await store.drawingImage(m[1], m[2]); } catch (e) { console.error('Drawings: could not fetch one:', e.message); return sendJSON(req, res, 503, { error: 'The toolbox is stuck just now. Try again in a moment.' }); }
    if (!body) return sendJSON(req, res, 404, { error: 'No drawing with that id.' });
    res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': m[2] === 'png' ? 'image/png' : 'image/webp', 'Content-Length': body.length, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Disposition': 'inline' });
    res.end(req.method === 'HEAD' ? undefined : body); return;
  }
  return sendJSON(req, res, 405, { error: 'Not like that.' }, { Allow: m[2] ? 'GET, HEAD' : 'DELETE' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return; }
  if (url.pathname === '/api/wishes' || url.pathname.startsWith('/api/wishes/')) {
    wishApi(req, res, url).catch(e => { console.error('Wishes:', e); if (!res.headersSent) sendJSON(req, res, 500, { error: 'Something went wrong at the board.' }); });
    return;
  }
  if (url.pathname === '/api/drawings' || url.pathname.startsWith('/api/drawings/')) {
    drawApi(req, res, url).catch(e => { console.error('Drawings:', e); if (!res.headersSent) sendJSON(req, res, 500, { error: 'Something went wrong at the toolbox.' }); });
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
server.listen(PORT, () => console.log(`Moonlit Cove on port ${PORT} · ${files.size} files · ${wishes.length} wishes, ${drawings.length} drawings in ${store.where}${store.kept ? '' : ' (NOT KEPT across deploys)'}${ADMIN_KEY ? '' : ' (deleting is off: no WISH_ADMIN_KEY)'}`));
/* on the way down, let a wish that is being written finish first */
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(); store.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
