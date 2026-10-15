/* Every compiled program's textures, per stage, against what most GPUs give a shader: 16 in each of the vertex and the
   fragment stage (Macs, iPhones, many Android phones; the software GL the other tests run on allows 32, so a shader with
   too many would work there and draw nothing on those). A program over 16 fails; over 15, a warning.
   node tools/texunits.mjs [island|coast] [hour] */
import { open } from './lib.mjs';
const isle = (process.argv[2] || 'coast') === 'island', hour = +(process.argv[3] || 17.5), LIMIT = 16;
const { browser, page, logs } = await open({ w: 800, h: 450, rs: 0.3, hour, dtCap: 0.25, query: isle ? '?island' : '', tz: 'Asia/Kolkata' });
let fails = 0;
try {
  await page.evaluate(() => new Promise(r => { let k = 0; const f = () => (++k >= 16 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  const progs = await page.evaluate(() => {
    const R = Engine.renderer, gl = R.getContext(), out = [];
    const ST = new Set([gl.SAMPLER_2D, gl.SAMPLER_CUBE, gl.SAMPLER_3D, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_2D_SHADOW, gl.SAMPLER_CUBE_SHADOW, gl.SAMPLER_2D_ARRAY_SHADOW, gl.INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_2D]);
    for (const p of R.info.programs) {
      const prog = p.program, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS), names = [];
      for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(prog, i); if (ST.has(u.type)) names.push(u.name.replace(/\[0\]$/, '')); }
      const src = Object.fromEntries(gl.getAttachedShaders(prog).map(s => [gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.VERTEX_SHADER ? 'vs' : 'fs', gl.getShaderSource(s)]));
      out.push({ names, src, key: (p.name || '') + ' ' + (p.cacheKey || '').slice(0, 30) });
    }
    return out;
  });
  /* (a texture counts in a stage when that stage's code names it anywhere but in its declaration) */
  const used = (src, nm) => new RegExp('\\b' + nm + '\\b').test(src.split('\n').filter(l => !/^\s*uniform\s/.test(l)).join('\n'));
  let worst = { vs: 0, fs: 0 };
  for (const p of progs) {
    const per = { vs: p.names.filter(nm => used(p.src.vs, nm)), fs: p.names.filter(nm => used(p.src.fs, nm)) };
    for (const st of ['vs', 'fs']) {
      worst[st] = Math.max(worst[st], per[st].length);
      if (per[st].length > LIMIT) { fails++; console.log(`  FAIL ${st} ${per[st].length} textures: ${per[st].join(' ')}`); }
      else if (per[st].length > LIMIT - 1) console.log(`  warn ${st} ${per[st].length} textures (at the limit): ${per[st].join(' ')}`);
    }
  }
  console.log(`${progs.length} programs; the most textures in a vertex stage ${worst.vs}, in a fragment stage ${worst.fs} (limit ${LIMIT})`);
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l)); if (errs.length) { fails++; console.log('  FAIL page errors: ' + errs.slice(0, 3).join(' | ').slice(0, 600)); }
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
