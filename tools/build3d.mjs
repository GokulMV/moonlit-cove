/* ─────────────────────────────────────────────────────────────
   build3d.mjs — puts the cove together.

   node tools/build3d.mjs web     the website, in public/: index.html with the engine, styles and fonts
                                  inlined; three.js and the sounds as separate, cache-forever files
                                  (sounds are only fetched once a visitor turns sound on)
   node tools/build3d.mjs page    one self-contained file, dist/moonlit-cove.html (three.js from a CDN,
                                  sounds inlined), plus dist/page-local.html for tests run offline
   node tools/build3d.mjs dev     the engine test bench, dist/dev3d.html
   node tools/build3d.mjs studio  the model studio, dist/studio.html (tools/studio.mjs draws models in it)
   ───────────────────────────────────────────────────────────── */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = f => fs.readFileSync(path.join(root, 'src3d', f), 'utf8');
/* every model has a file of its own under src3d/models/<where>/<what>.js; the registry first, then all of them in order */
const MODELS = (() => {
  const out = [], walk = d => {
    for (const e of fs.readdirSync(path.join(root, 'src3d', d), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const f = d + '/' + e.name;
      if (e.isDirectory()) walk(f); else if (f.endsWith('.js') && f !== 'models/models.js') out.push(f);
    }
  };
  walk('models'); return ['models/models.js', ...out];
})();
export const ENGINE = ['astro.js', 'stardata.js', 'textures.js', 'island.js', 'layout.js', 'sky.js', 'glsl.js', 'paint.js', 'mats.js', 'cloth.js', 'book.js', 'paper.js', ...MODELS, 'camp.js', 'nature.js', 'trees.js', 'world.js', 'isle.js', 'shacks.js', 'marks.js', 'life.js', 'shallows.js', 'flora.js', 'orchard.js', 'fauna.js', 'inspect.js', 'fx.js', 'stars.js', 'cloudnoise.js', 'uncork.js', 'engine.js', 'audio.js'];
const nm = path.join(root, 'node_modules');
const THREE_VERSION = JSON.parse(fs.readFileSync(path.join(nm, 'three/package.json'), 'utf8')).version;
const LOCAL_THREE = 'file://' + path.join(nm, 'three/build/three.min.js');
const CDN_THREE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.min.js`;
const hash = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

function fonts() {
  const b64 = f => fs.readFileSync(path.join(nm, f)).toString('base64');
  return [
    ['Fraunces', 'normal', '100 900', '@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2'],
    ['Instrument Sans', 'normal', '400 700', '@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2'],
    ['Caveat', 'normal', '400 700', '@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2'],
    ['JetBrains Mono', 'normal', '400', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2'],
    ['JetBrains Mono', 'normal', '500', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2'],
  ].map(([fam, style, wt, f]) => `@font-face{font-family:'${fam}';font-style:${style};font-weight:${wt};font-display:swap;src:url(data:font/woff2;base64,${b64(f)}) format('woff2');}`).join('\n');
}
/* the recordings: inlined as base64, or (for the website) copied out under content-hashed names */
function sounds(outDir) {
  const dir = path.join(root, 'assets', 'snd3'), meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const o = {};
  for (const [k, m] of Object.entries(meta)) {
    const buf = fs.readFileSync(path.join(dir, k + '.mp3')), e = { loopStart: m.loopStart, loopEnd: m.loopEnd, rms: m.rms, events: m.events };
    if (outDir) { const name = `${k}.${hash(buf)}.mp3`; fs.writeFileSync(path.join(outDir, name), buf); e.url = 'snd/' + name; }
    else e.b64 = buf.toString('base64');
    o[k] = e;
  }
  return 'const SND = ' + JSON.stringify(o) + ';';
}
function page(three, snd, head = '') {
  return src('page/index.html').replace('<meta charset="utf-8">', () => '<meta charset="utf-8">' + head)
    .replace('/*@FONTS*/', () => fonts()).replace('/*@CSS*/', () => src('page/styles.css')).replace('/*@LOADER*/', () => src('page/loader.js'))
    .replace('/*@ENGINE*/', () => ENGINE.map(src).join('\n;\n'))
    .replace('/*@APP*/', () => snd + '\n;\n' + src('page/content.js') + '\n;\n' + src('page/pages.js') + '\n;\n' + src('page/app.js'))
    .replace('/*@THREE*/', three);
}

const which = process.argv[2] || 'web';
if (which === 'dev') {
  const html = src('dev.html').replace('/*@THREE*/', LOCAL_THREE).replace('/*@JS*/', () => sounds() + '\n;\n' + ENGINE.map(src).join('\n;\n'));
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'dev3d.html'), html); console.log('dist/dev3d.html', (html.length / 1024).toFixed(0) + 'KB');
}
if (which === 'studio') {
  /* the model studio, for looking models over: three.js and the engine's files, and the studio itself (tools/) */
  const studio = fs.readFileSync(path.join(root, 'tools', 'studio-page.js'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Model studio</title><style>body{margin:0;background:#222}canvas{display:block;width:100%}</style></head><body>
<script src="${LOCAL_THREE}"></script><script>const SND = {};\n${ENGINE.map(src).join('\n;\n').replace(/<\/script>/g, '<\\/script>')}\n;\n${studio}</script></body></html>`;
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'studio.html'), html); console.log('dist/studio.html', (html.length / 1024).toFixed(0) + 'KB');
}
if (which === 'page') {
  const snd = sounds(), cdn = page(CDN_THREE, snd), local = page(LOCAL_THREE, snd);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'moonlit-cove.html'), cdn); fs.writeFileSync(path.join(root, 'dist', 'page-local.html'), local);
  console.log('dist/moonlit-cove.html', (cdn.length / 1024).toFixed(0) + 'KB');
}
if (which === 'web') {
  const out = path.join(root, 'public');
  fs.rmSync(out, { recursive: true, force: true });
  for (const d of ['', 'snd', 'vendor']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const three = fs.readFileSync(path.join(nm, 'three/build/three.min.js')), threeName = `vendor/three-${THREE_VERSION}.${hash(three)}.min.js`;
  fs.writeFileSync(path.join(out, threeName), three);
  /* a whole document (the artifact host adds this skeleton itself), a moon for the tab, and a card for shared links */
  const C = src('page/content.js'), name = (C.match(/name:\s*'([^']+)'/) || [, 'Moonlit Cove'])[1], site = (C.match(/site:\s*'([^']+)'/) || [, name])[1];
  const head = `\n<meta name="theme-color" content="#0b0f18">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="${site}">\n<meta property="og:title" content="${site}">\n<meta property="og:description" content="${name}’s moonlit beach camp you can explore: build notes by the fire, blueprints in the basket, a letter in a bottle.">\n<meta name="twitter:card" content="summary">\n<meta name="twitter:title" content="${site}">`;
  const html = '<!doctype html>\n<html lang="en">\n' + page(threeName, sounds(path.join(out, 'snd')), head) + '\n</html>\n';
  fs.writeFileSync(path.join(out, 'index.html'), html);
  const kb = f => (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + 'KB';
  console.log('public/index.html', kb('index.html'), '·', threeName, kb(threeName), '·', fs.readdirSync(path.join(out, 'snd')).length, 'sounds');
}
