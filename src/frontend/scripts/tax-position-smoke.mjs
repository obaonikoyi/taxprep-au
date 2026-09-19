import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Runs in the same real browser session after the document workspace has been cleared.
export async function verifyTaxPosition(page, artifacts) {
  const button = name => page.getByRole('button', { name, exact: true });
  await button('Load fictional income example').click();
  const panel = page.getByRole('region', { name: 'See how the numbers fit together.' });
  assert.equal(await panel.locator('.tax-balance').count(), 0);
  for (let i = 0; i < 3; i++) await page.locator('.income-card').nth(i).getByRole('button', { name: 'Confirm income record', exact: true }).click();
  assert.equal(await panel.locator('.tax-balance strong').innerText(), '$24.00');
  assert.ok((await panel.innerText()).includes('Fictional refund balance'));
  assert.ok((await panel.innerText()).includes('$17,076.00'));
  assert.ok((await panel.innerText()).includes('Qualified tax review pending'));
  const first = page.getByRole('article', { name: 'Income record 1', exact: true });
  const complete = page.getByLabel('Have you added all salary/wage and Australian bank-interest records?', { exact: true });
  async function changeGross(value) {
    await first.getByLabel('Gross income (AUD)', { exact: true }).fill(value);
    assert.equal(await panel.locator('.tax-balance').count(), 0);
    await first.getByRole('button', { name: 'Confirm income record', exact: true }).click();
    assert.equal(await panel.locator('.tax-balance').count(), 0);
    await complete.selectOption('yes');
  }
  await changeGross('65000');
  assert.equal(await panel.locator('.tax-balance strong').innerText(), '$296.00');
  assert.ok((await panel.innerText()).includes('Fictional amount payable'));
  await page.getByText('2. Situation and coverage', { exact: true }).click();
  const loans = page.getByLabel('A HELP, VSL, AASL or other study or training loan?', { exact: true });
  await loans.selectOption('unsure');
  assert.equal(await panel.locator('.tax-balance').count(), 0);
  assert.ok((await panel.innerText()).includes('Answer needed'));
  await loans.selectOption('no');
  const deduction = page.getByLabel('Any deductions to include, including phone expenses?', { exact: true });
  await deduction.selectOption('yes');
  assert.equal(await panel.locator('.tax-balance').count(), 0);
  await deduction.selectOption('no');
  await page.getByText('2. Situation and coverage', { exact: true }).click();
  await changeGross('82850'); // Total exactly $101,000.
  assert.equal(await panel.locator('.tax-balance').count(), 1);
  await changeGross('82850.01');
  assert.equal(await panel.locator('.tax-balance').count(), 0);
  assert.ok((await panel.innerText()).includes('exceeds $101,000'));
  await changeGross('64000');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await panel.screenshot({ path: artifacts + 'tax-position-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await panel.screenshot({ path: artifacts + 'tax-position-mobile.png' });
  const downloading = page.waitForEvent('download'); await button('Download preparation handover').click();
  const download = await downloading; await download.saveAs(artifacts + 'tax-position-handover.html');
  const html = readFileSync(artifacts + 'tax-position-handover.html', 'utf8');
  for (const value of ['$24.00', '$17,076.00', '$1,643.00', 'Fictional refund balance', 'employee-no-deductions-2025-26.v1-draft', 'half up', 'Qualified tax review pending', 'SHA-256']) assert.ok(html.includes(value), value);
  const offline = await page.context().newPage(); const requests = [];
  offline.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await offline.goto('file://' + artifacts + 'tax-position-handover.html');
  await offline.getByRole('heading', { name: 'Fictional tax-position calculation', exact: true }).waitFor();
  assert.deepEqual(requests, []); assert.equal(await offline.locator('script').count(), 0);
  await offline.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { passed: true, fictionalRefundAud: 24, correctedPayableAud: 296, taxPlusMedicareAud: 17076, unknownBlocks: true, editsInvalidate: true, upperThresholdChecked: true, noApprovedEstimate: true, offlineReport: true, mobileOverflow: false };
}
