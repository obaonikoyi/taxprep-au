import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function verifyReportDownload(page, artifacts, { name, total, unresolved = false, expectedNote = '' }) {
  const demo = page.locator('#guided-demo');
  const preview = page.frameLocator('iframe[title="Preparation report preview"]');
  await preview.locator('html[data-report="taxprep-expenses-v1"]').waitFor({ state: 'attached' });
  // Compare with a plain page to distinguish print-dialog support from app wiring.
  const probe = await page.context().newPage();
  await probe.setContent('<p>Print capability probe</p>');
  const nativePrintEvents = await probe.evaluate(() => {
    let events = 0;
    window.addEventListener('beforeprint', () => { events += 1; });
    window.print();
    return events;
  });
  await probe.close();
  console.log('Headless print capability:', { nativePrintEvents });
  await page.locator('iframe[title="Preparation report preview"]').evaluate(frame => {
    const target = frame.contentWindow;
    const original = target.print.bind(target);
    target.addEventListener('beforeprint', () => { frame.dataset.printEvent = 'yes'; }, { once: true });
    target.print = () => { frame.dataset.printCalled = 'yes'; original(); };
  });
  await demo.getByRole('button', { name: 'Print / save PDF', exact: true }).click();
  const printFrame = page.locator('iframe[title="Preparation report preview"]');
  assert.equal(await printFrame.getAttribute('data-print-called'), 'yes');
  const reportPrintEvent = await printFrame.getAttribute('data-print-event');
  console.log('Report print result:', { reportPrintEvent });
  if (nativePrintEvents > 0) assert.equal(reportPrintEvent, 'yes');
  assert.equal(await preview.locator('script, img, link, a, form').count(), 0);

  const downloaded = page.waitForEvent('download');
  await demo.getByRole('button', { name: 'Download report (HTML)', exact: true }).click();
  const download = await downloaded;
  assert.match(download.suggestedFilename(), /^taxprep-au-preparation-2025-26-\d{4}-\d{2}-\d{2}\.html$/);
  const file = artifacts + '/preparation-' + name + '.html';
  await download.saveAs(file);
  const html = readFileSync(file, 'utf8');
  assert.match(html, /<!doctype html>/);
  assert.match(html, /charset="utf-8"/);
  // The downloaded copy must be byte-for-byte the same document shown in the preview.
  assert.equal(html, await page.locator('iframe[title="Preparation report preview"]').getAttribute('srcdoc'));

  const context = await page.context().browser().newContext({ viewport: { width: 1000, height: 900 }, offline: true });
  try {
    const offline = await context.newPage();
    const network = []; const errors = [];
    offline.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    offline.on('pageerror', error => errors.push(error.message));
    await offline.goto(pathToFileURL(file).href);
    assert.equal(await offline.locator('tbody tr').count(), 3);
    assert.equal(await offline.locator('.totals dd').nth(1).innerText(), total);
    assert.equal(await offline.locator('.partial').count(), unresolved ? 1 : 0);
    if (unresolved) assert.equal(await offline.locator('tbody tr').nth(1).locator('td').last().innerText(), 'Unresolved');
    if (expectedNote) assert.equal(await offline.locator('.expense').nth(1).locator('.notes dd').first().innerText(), expectedNote);
    assert.equal(await offline.locator('script, img, link, a, form').count(), 0);
    await offline.screenshot({ path: artifacts + '/report-' + name + '-desktop.png', fullPage: true });
    await offline.pdf({ path: artifacts + '/preparation-' + name + '.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true });
    await offline.setViewportSize({ width: 390, height: 844 });
    await offline.emulateMedia({ media: 'screen' });
    assert.equal(await offline.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await offline.screenshot({ path: artifacts + '/report-' + name + '-mobile.png', fullPage: true });
    assert.deepEqual(network, []); assert.deepEqual(errors, []);
  } finally { await context.close(); }
  return { downloaded: true, previewMatchesDownload: true, offline: true, printTargetsReport: true, nativePrintEvents: nativePrintEvents > 0, partial: unresolved, noOverflow: true };
}
