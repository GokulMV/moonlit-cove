/* The cove's creatures as you see them held up in your hands (inspect.js), each turned to four sides, for looking over
   the models: one sheet of four views per kind, in shots/spec_<kind>.png (the HUD hidden, the view cropped to the
   middle). Kinds with several looks (the butterflies, the dragonflies) can be given as kind:n.
   node tools/specimens.mjs [kinds, comma separated: hermit,crab,...] [hour 15] */
import { open, shot } from './lib.mjs';
import { execFileSync } from 'child_process';
import path from 'path';
const all = 'hermit,crab,shrimp,reeffish,fish,turtle,ray,dolphin,whale,gull,sandpiper,bat,butterfly:0,butterfly:1,butterfly:2,butterfly:3,dragonfly:0,dragonfly:1,dragonfly:2,dragonfly:3,firefly,star,scallop,cowrie,whelk';
const kinds = (process.argv[2] || all).split(','), hour = +(process.argv[3] || 15);
const { browser, page, logs } = await open({ w: 1000, h: 760, rs: 0.8, hour });
const frames = n => page.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.addStyleTag({ content: 'body > *:not(#scene) { visibility: hidden !important; }' });
/* (the hand's clock a fifth of a second a frame: up into the hands in three frames) */
await page.evaluate(() => { window.__coveInspStep = 0.2; window.__coveDtCap = 0.25; });
const T0 = Date.now(), lap = m => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4) + 's ' + m);
const sheets = [];
for (const spec of kinds) {
  const [kind, n] = spec.split(':');
  const ok = await page.evaluate(([kind, n]) => {
    const cam = Engine.camera ? Engine.camera.position : { x: 0, y: 1.6, z: 0 };
    const c = { kind, x: cam.x, y: cam.y - 0.6, z: cam.z - 1.2, size: 1, yaw: 0, opts: n !== undefined ? { kind: +n, seed: 3 } : { seed: 3 } };
    return !!Engine.inspect.hold(c);
  }, [kind, n]);
  if (!ok) { console.log('  could not hold', spec); continue; }
  await frames(5);
  const files = [];
  /* four sides: as it comes up, from its other side, from above, from below and behind */
  const turns = [[0, 0], [190, 0], [-95, 110], [95, -190]];
  for (let i = 0; i < turns.length; i++) {
    const [dx, dy] = turns[i];
    await page.evaluate(([dx, dy]) => { Engine.inspect.turn(dx, dy); Engine.inspect.turn(1e-4, 0); }, [dx, dy]);
    await frames(2);
    const name = `spec_${spec.replace(':', '')}_${i}`; await shot(page, name); files.push(path.join('shots', name + '.png'));
  }
  await page.evaluate(() => Engine.inspect.putBack()); await frames(4);
  /* one sheet: the middle of each view, two by two */
  const out = path.join('shots', `spec_${spec.replace(':', '')}.png`);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert('RGB') for f in fs]
w,h=ims[0].size; s=min(w,h)-40; L=(w-s)//2; T=(h-s)//2+10
W=Image.new('RGB',(s*2,s*2))
for i,im in enumerate(ims): W.paste(im.crop((L,T,L+s,T+s)),((i%2)*s,(i//2)*s))
W.save(out)`, out, ...files]);
  sheets.push(out); lap(spec + ' -> ' + out);
}
const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
console.log(errs.length ? 'page errors:\n  ' + errs.slice(0, 6).join('\n  ') : 'no page errors');
await browser.close();
