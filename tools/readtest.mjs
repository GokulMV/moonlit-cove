/* Opens each chapter: checks it opens only after the camera arrives, turns pages by tap and by drag, and the counter. */
import { open, shot, wait, until } from './lib.mjs';
const only = process.argv[2];
const { browser, page } = await open({});
const state = () => page.evaluate(() => { const c = window.__cove; return { camT: +c.st.camT.toFixed(2), pending: !!c.rd.pending, page: document.getElementById('rPage').textContent, mode: window.Engine && Engine.paper ? Engine.paper.mode : '', spread: Engine.books.menu.spread }; });
for (const id of ['plans', 'stack', 'making', 'notes', 'contact', 'milestones']) {
  if (only && id !== only) continue;
  await page.evaluate(id => window.__cove.openChapter(id), id);
  await wait(page, 300);
  const s0 = await state();
  await until(page, () => !window.__cove.rd.pending, null, 60000);
  const s1 = await state();
  console.log(id, 'at start', s0, '→ opened at camT', s1.camT);
  await wait(page, 2600);
  await shot(page, 'read_' + id + '_1');
  if (id === 'plans' || id === 'stack' || id === 'making' || id === 'notes') {
    /* tap the right half */
    await page.mouse.click(1000, 400); await wait(page, 200);
    console.log('  after tap right:', (await state()).page);
    await wait(page, 1600); await shot(page, 'read_' + id + '_2');
    /* drag a page back (left-to-right for books, downward for sheets) and let go past halfway */
    const book = id === 'making' || id === 'notes';
    await page.mouse.move(book ? 500 : 640, book ? 420 : 300); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(book ? 500 + i * 40 : 640, book ? 420 : 300 + i * 30); await wait(page, 40); }
    await shot(page, 'read_' + id + '_drag');
    await page.mouse.up(); await wait(page, 200);
    console.log('  after drag back:', (await state()).page);
    await wait(page, 1500);
  }
  await page.evaluate(() => window.__cove.openChapter(null));
  await wait(page, 2500);
}
await browser.close();
