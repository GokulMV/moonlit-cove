/* Smoke test: the page starts, renders a frame, and a screenshot looks like the cove. */
import { open, shot, wait } from './lib.mjs';
const t0 = Date.now();
const { browser, page } = await open({ hour: +(process.argv[2] || 23) });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await wait(page, 3000);
const info = await page.evaluate(() => ({ fps: (window.__cove.st.fms || []).slice(-5), rs: window.__cove.st.rs, err: null }));
console.log(info);
await shot(page, 'smoke');
await browser.close();
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
