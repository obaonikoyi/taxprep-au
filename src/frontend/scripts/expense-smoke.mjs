import assert from 'node:assert/strict';
import { verifyReportDownload } from './report-smoke.mjs';

export async function verifyExpenses(page, artifacts, { stopApi, startApi }) {
  const demo = page.locator('#guided-demo');
  const button = name => demo.getByRole('button', { name, exact: typeof name === 'string' });
  const saveSample = async () => {
    await button(/^Yes/).click();
    await button('Use example details').click();
    await button('Save expense').click();
  };
  await button('Try demo').click();
  await button('Information is correct').click();
  await saveSample(); await saveSample(); await saveSample();
  await demo.getByText('$312.60', { exact: true }).waitFor();
  assert.equal(await demo.getByText('Needs attention', { exact: true }).count(), 1);
  assert.equal(await demo.getByText('Excluded from total', { exact: true }).count(), 1);
  await demo.screenshot({ path: artifacts + '/expense-desktop.png' });
  const sampleExport = await verifyReportDownload(page, artifacts, { name: 'sample', total: '$312.60' });

  await button('Edit phone service').click();
  await demo.getByLabel('Amount paid (AUD)', { exact: true }).fill('100');
  await demo.getByLabel('Work use (%)', { exact: true }).fill('50');
  await button('Save expense').click();
  await demo.getByText('$122.60', { exact: true }).waitFor();
  await demo.getByText('$50.00 recorded work portion', { exact: true }).waitFor();
  await button('Edit phone service').click();
  const longNote = ('<img src="https://example.invalid/x" onerror="alert(1)"> Café / 中文 / Ọlọ́run\n' + 'Work calls and shift coordination. '.repeat(6)).trim();
  await demo.getByLabel('Work purpose', { exact: false }).fill(longNote);
  await demo.getByLabel('How was the percentage worked out?', { exact: false }).fill('W'.repeat(300));
  await demo.getByLabel('Evidence reference', { exact: false }).fill('R'.repeat(120));
  await demo.getByLabel('Was Sarah reimbursed?', { exact: true }).selectOption('unsure');
  await button('Save expense').click();
  await demo.getByText(/Partial total:/).waitFor();
  await demo.getByText('Work portion unresolved', { exact: true }).waitFor();
  const partialExport = await verifyReportDownload(page, artifacts, { name: 'partial', total: '$72.60', unresolved: true, expectedNote: longNote });
  await button('Remove transport fares').click();
  await demo.getByText('$0.00', { exact: true }).waitFor();
  assert.equal(await demo.getByText('$122.60', { exact: true }).count(), 0);
  await button('Restart demo').click();

  await page.setViewportSize({ width: 390, height: 844 });
  await button('Try demo').click();
  await button('Information is correct').click();
  await button(/^No/).click();
  await button(/^Yes/).click();
  await button('Save expense').click();
  await demo.getByRole('alert').waitFor();
  assert.equal(await demo.getByLabel('Amount paid (AUD)', { exact: true }).evaluate(el => document.activeElement === el), true);
  await button('Use example details').click();
  await demo.getByLabel('Amount paid (AUD)', { exact: true }).fill('100');
  await demo.getByLabel('Work use (%)', { exact: true }).fill('40');
  await demo.screenshot({ path: artifacts + '/expense-form-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await button('Save expense').click();
  await button(/^No/).click();
  await demo.getByText('$40.00 recorded work portion', { exact: true }).waitFor();
  await demo.screenshot({ path: artifacts + '/expense-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await button('Restart demo').click();

  // A real outage must preserve all entries and allow the same review to be retried.
  await stopApi();
  await button('Explore example summary').click();
  await demo.getByRole('alert').waitFor();
  await demo.getByText('$600.00 × 40% work use', { exact: true }).waitFor();
  await startApi();
  await button('Retry review').click();
  await demo.getByText('$312.60', { exact: true }).waitFor();
  await button('Restart demo').click();
  await button('Try demo').click();
  await button('Information is correct').click();
  for (let i = 0; i < 3; i++) await button(/^No/).click();
  await demo.getByText('No expenses recorded', { exact: true }).waitFor();
  assert.equal(await button('Download report (HTML)').count(), 0);
  await button('Restart demo').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { sampleExport, partialExport, sampleWorkPortions: 312.6, editedWorkPortions: 122.6, partialTotal: true, remove: true,
    manualMobileWorkPortion: 40, validationFocus: true, realBackendRecovery: true, restartAndSkip: true };
}
