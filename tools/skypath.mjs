/* The sun and moon on their two paths (the true compass, or in front of the camp): shots of the sky at chosen hours, each
   view its own hour and path, from the camp or wherever it says.
   node tools/skypath.mjs [prefix sp] [island|coast] [views, comma-separated] — a view is name:hour:path[:pos:look:fov],
   pos and look as x/y/z, e.g. set:17.8:true or west:17.5:true:-30/1.7/-6/-30/6/60:60 */
import { open, shot } from './lib.mjs';
const prefix = process.argv[2] || 'sp', isle = (process.argv[3] || 'island') === 'island';
const DEF = 'rise:6.25:true,set:17.85:true,setF:17.85:front';
const views = (process.argv[4] || DEF).split(',').map(v => { let [name, hour, path, pos, look, fov] = v.split(':'); const P = s => s && s.split('/').map(Number);
  /* (pos and look may come as one, six numbers: then the next is the fov) */
  let p = P(pos), l = P(look); if (p && p.length === 6) { fov = look; l = p.slice(3); p = p.slice(0, 3); }
  return { name, hour: +hour, path: path || 'true', pos: p, look: l, fov: fov ? +fov : null }; });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
/* (in Hyderabad's time and sky, as the visitor this is built for sees it; SKYTZ to choose another) */
const { browser, page, logs } = await open({ w: 1280, h: 720, rs: 0.6, hour: views[0].hour, dtCap: 0.25, query: isle ? '?island' : '', tz: process.env.SKYTZ || 'Asia/Kolkata' });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
try {
  await page.addStyleTag({ content: '#walkHud, #ctrl, #walkBar, #hint, #hud { display: none !important; }' });
  if (isle) console.log('   trees:', await page.evaluate(() => { const f = Engine.world.forest; return f ? f.protos.map(p => p.kind + ' ' + p.H.toFixed(1)).join(', ') : ''; }));
  for (const v of views) {
    /* (the hour and the path, the path at once rather than swinging over) */
    await page.evaluate(v => { const st = window.__cove.st; st.hour = v.hour; st.timeMode = 'custom'; st.offset = 0; st.skyPath = v.path; st.frontK = v.path === 'front' ? 1 : 0;
      window.__coveCamFix = v.pos ? { pos: v.pos, look: v.look, fov: v.fov || 55, focus: Math.hypot(v.pos[0] - v.look[0], v.pos[1] - v.look[1], v.pos[2] - v.look[2]) } : null; }, v);
    if (isle && v.pos) await page.evaluate(([x, y, z]) => Engine.world.prime(x, z, y, true), v.pos);
    else if (isle) await page.evaluate(() => Engine.world.prime());
    /* (enough frames for the light round the camp, the reflections' picture of the sky, to catch up with the new hour; and
       along the coast for its shade's heights to be worked out, if they are not yet) */
    await frames(16);
    for (let i = 0; i < 40 && await page.evaluate(() => { const sh = Engine.world && Engine.world.shade; return !!(sh && 'pending' in sh && (sh.pending > 0 || !sh.ready)); }); i++) await frames(8);
    const S = await page.evaluate(() => { const S = window.__cove.st.S, sh = Engine.world && Engine.world.shade; return { sAlt: S.sAlt, mAlt: S.mAlt, path: S.path, sun: S.sunDirV, moon: S.moonDirV, key: S.keyDir, exp: S.exposure,
      shade: sh ? [sh.n, Math.round(sh.ms), sh.built, sh.pending, sh.ready, +sh.at(Layout.camp.x, Layout.camp.z).toFixed(2)] : null }; });
    if (S.shade) console.log(`   (the ${isle ? 'island' : 'coast'}'s shade drawn ${S.shade[0]} times, the last in ${S.shade[1]} ms${S.shade[2] !== undefined ? `; ${S.shade[2]} columns worked out, ${S.shade[3]} to go, ${S.shade[4] ? 'ready' : 'not ready'}` : ''}; light at the camp ${S.shade[5]}; exposure ${S.exp.toFixed(2)})`);
    const f = a => a.map(x => x.toFixed(2)).join(',');
    console.log(`  ${v.name}: ${v.hour}h ${S.path}, sun ${S.sAlt.toFixed(1)}° (${f(S.sun)}), moon ${S.mAlt.toFixed(1)}° (${f(S.moon)}), key (${f(S.key)})`);
    ok(S.path === v.path, `${v.name}: drawn on the ${v.path} path`);
    await shot(page, prefix + '_' + v.name);
  }
} finally {
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 900) : ''));
  await browser.close();
  console.log(fails ? `${fails} failed` : 'all ok');
}
