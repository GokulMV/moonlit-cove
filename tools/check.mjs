/* Compiles every inline script of the built pages (without running them), so a syntax error shows up with its file
   and line before a browser ever opens: node tools/check.mjs [dist/studio.html dist/page-local.html ...] */
import fs from 'fs'; import path from 'path'; import vm from 'vm';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['dist/studio.html', 'dist/page-local.html'].filter(f => fs.existsSync(path.join(root, f)));
let bad = 0;
for (const f of files) {
  const html = fs.readFileSync(path.join(root, f), 'utf8'), re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, n = 0;
  while ((m = re.exec(html))) {
    n++; const code = m[1];
    try { new vm.Script(code, { filename: `${f}#script${n}` }); }
    catch (e) {
      bad++; const line = (e.stack.match(/#script\d+:(\d+)/) || [])[1];
      console.log(`${f} script ${n}: ${e.message}${line ? ` (line ${line})` : ''}`);
      if (line) { const L = code.split('\n'); for (let i = Math.max(0, line - 3); i < Math.min(L.length, +line + 2); i++) console.log(`  ${i + 1}: ${L[i].slice(0, 200)}`); }
    }
  }
  if (!bad) console.log(`${f}: ${n} scripts compile`);
}
process.exit(bad ? 1 : 0);
