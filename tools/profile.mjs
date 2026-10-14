/* Where the page's load goes: Chrome's CPU profiler over the page's loading, then the functions that took the most time
   themselves (self) and with what they call (total), the top of each. node tools/profile.mjs [query ?island] [top 40] */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const query = process.argv[2] ?? '?island', TOP = +(process.argv[3] || 40);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.addInitScript(() => { try { localStorage.setItem('cove.timeMode', JSON.stringify('custom')); localStorage.setItem('cove.hour', JSON.stringify(10)); localStorage.setItem('cove.weather', JSON.stringify('clear')); } catch (e) {} window.__coveMaxRS = 0.4; window.__coveShadow = 512; });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
const t0 = Date.now();
await page.goto('file://' + path.join(root, 'dist/page-local.html') + query);
/* (until the world is built: Engine.world there and the first frames drawn) */
await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.world && window.__cove && window.__cove.st && window.__cove.st.S, null, { timeout: 400000, polling: 1000 });
const { profile } = await cdp.send('Profiler.stop');
console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
/* self time per node, then summed per function (name + line); total time by walking the call tree */
const byId = new Map(profile.nodes.map(n => [n.id, n])), dt = new Map();
for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
const key = n => `${n.callFrame.functionName || '(anon)'} @${n.callFrame.lineNumber + 1}:${n.callFrame.columnNumber + 1}`;
const self = new Map(), total = new Map();
const totalOf = n => { let t = dt.get(n.id) || 0; for (const c of n.children || []) t += totalOf(byId.get(c)); n._t = t; return t; };
const rootN = profile.nodes[0]; totalOf(rootN);
for (const n of profile.nodes) { const k = key(n); self.set(k, (self.get(k) || 0) + (dt.get(n.id) || 0)); }
/* (total per function, counting a recursive function once on each path) */
const walk = (n, seen) => { const k = key(n); if (!seen.has(k)) total.set(k, (total.get(k) || 0) + n._t); const s2 = new Set(seen); s2.add(k); for (const c of n.children || []) walk(byId.get(c), s2); };
walk(rootN, new Set());
const fmt = m => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([k, v]) => `  ${(v / 1000).toFixed(0).padStart(7)} ms  ${k}`).join('\n');
console.log('self:\n' + fmt(self));
console.log('total:\n' + fmt(total));
await browser.close();
