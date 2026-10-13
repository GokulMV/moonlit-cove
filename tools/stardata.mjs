/* Packs the night sky's data into src3d/stardata.js, from d3-celestial's data (Olaf Frohn, BSD 3-Clause), which takes its
   stars from the Hipparcos catalogue and its Milky Way from a hand-traced outline:
     stars     every star to magnitude 6, as [RA, Dec, magnitude, B−V] packed into 6 bytes each, base64
     milky     the Milky Way's five brightness outlines, thinned to half a degree, as rings of [RA, Dec] in tenths of a
               degree, base64 (16-bit)
   node tools/stardata.mjs <path to d3-celestial's data folder> */
import fs from 'fs'; import path from 'path';
const dir = process.argv[2]; if (!dir) { console.error('usage: node tools/stardata.mjs <d3-celestial/data>'); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stars = JSON.parse(fs.readFileSync(path.join(dir, 'stars.6.json'), 'utf8')).features;
const sb = Buffer.alloc(stars.length * 6); let n = 0;
for (const f of stars) {
  let [ra, dec] = f.geometry.coordinates; if (ra < 0) ra += 360;
  const mag = +f.properties.mag, bv = f.properties.bv === '' || f.properties.bv == null ? 0.6 : +f.properties.bv;
  if (!(mag <= 6.05)) continue;
  sb.writeUInt16LE(Math.round(ra / 360 * 65535) & 0xffff, n * 6); sb.writeUInt16LE(Math.round((dec + 90) / 180 * 65535), n * 6 + 2);
  sb.writeUInt8(Math.max(0, Math.min(255, Math.round((mag + 2) * 30))), n * 6 + 4); sb.writeUInt8(Math.max(0, Math.min(255, Math.round((bv + 0.5) * 100))), n * 6 + 5); n++;
}
/* the Milky Way: each level a MultiPolygon; thinned so no two kept points are within 0.5° (the outline's own wiggles are
   finer than the sky can show at the glow's softness) */
const mw = JSON.parse(fs.readFileSync(path.join(dir, 'mw.json'), 'utf8')).features;
const levels = [];
for (const ft of mw) {
  const rings = [];
  for (const poly of ft.geometry.coordinates) for (const ring of poly) {
    const out = []; let last = null;
    for (let [ra, dec] of ring) { if (ra < 0) ra += 360; if (last) { let d = Math.abs(ra - last[0]); d = Math.min(d, 360 - d); if (Math.hypot(d * Math.cos(dec * Math.PI / 180), dec - last[1]) < 0.5) continue; } out.push([ra, dec]); last = [ra, dec]; }
    if (out.length >= 3) rings.push(out);
  }
  levels.push(rings);
}
const words = []; words.push(levels.length);
for (const rings of levels) { words.push(rings.length); for (const r of rings) { words.push(r.length); for (const [ra, dec] of r) { words.push(Math.round(ra * 10)); words.push(Math.round(dec * 10) + 900); } } }
const mb = Buffer.alloc(words.length * 2); words.forEach((w, i) => mb.writeUInt16LE(w & 0xffff, i * 2));
const js = `/* ─────────────────────────────────────────────────────────────
   stardata.js — the night sky's data, packed by tools/stardata.mjs from
   d3-celestial's data (© 2015 Olaf Frohn, BSD 3-Clause licence): the
   stars of the Hipparcos catalogue to magnitude 6, and the Milky Way's
   brightness outlines.
     stars  ${n} stars, 6 bytes each (little-endian): RA as a fraction of the
            circle (16 bits), Dec + 90° as a fraction of 180° (16 bits),
            (magnitude + 2) × 30, (B−V + 0.5) × 100
     milky  16-bit words: the number of levels; for each, its number of
            rings; for each ring its number of points, then each point's RA
            and Dec + 90°, in tenths of a degree
   ───────────────────────────────────────────────────────────── */
const StarData = { count: ${n}, stars: '${sb.subarray(0, n * 6).toString('base64')}', milky: '${mb.toString('base64')}' };
`;
fs.writeFileSync(path.join(root, 'src3d/stardata.js'), js);
console.log('stars', n, 'bytes', n * 6, '· milky levels', levels.map(l => l.reduce((s, r) => s + r.length, 0)).join('/'), 'points ·', (js.length / 1024).toFixed(1), 'KB');
