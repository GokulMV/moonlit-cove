/* ─────────────────────────────────────────────────────────────
   server.js — serves the built cove from public/. No dependencies.

   Everything is read into memory once at start-up, with gzip and brotli
   copies of what compresses. The page itself is revalidated on every
   visit (so a new deploy shows at once); three.js and the sounds carry
   a content hash in their names, so browsers and Cloudflare keep them.
   PORT comes from the environment (Railway sets it); 8080 otherwise.
   ───────────────────────────────────────────────────────────── */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const COMPRESS = new Set(['.html', '.js', '.svg', '.json', '.txt', '.webmanifest']);

/* the page runs inline scripts and styles, fonts from data: URLs, its own three.js, and fetches its own sounds */
const CSP = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:", "img-src 'self' data: blob:",
  "media-src 'self' data: blob:", "connect-src 'self'", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'"].join('; ');
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok'); return; }
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
server.listen(PORT, () => console.log(`Moonlit Cove on port ${PORT} · ${files.size} files`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
