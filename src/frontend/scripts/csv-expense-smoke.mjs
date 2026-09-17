import assert from 'node:assert/strict';
import { verifyReportDownload } from './report-smoke.mjs';

export async function verifyCsvExpenses(page, artifacts) {
  const demo = page.locator('#guided-demo');
  const upload = page.locator('.transaction-upload');
  const button = name => demo.getByRole('button', { name, exact: true });
  const checkbox = n => upload.getByRole('checkbox', { name: new RegExp(`^Select row ${n}:`) });
  const importFile = async (name, rows) => {
    const escape = value => '"' + String(value).replaceAll('"', '""') + '"';
    const csv = 'date,description,amount\n' + rows.map(row => row.map(escape).join(',')).join('\n');
    await upload.getByLabel('Transaction CSV', { exact: true }).setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await upload.getByRole('button', { name: 'Preview transactions', exact: true }).click();
    await upload.locator('tbody tr').first().waitFor();
  };
  const beginPhone = async () => {
    await upload.getByLabel('Expense category', { exact: true }).selectOption('phone');
    await upload.getByRole('button', { name: 'Review selected spending', exact: true }).click();
    await demo.getByRole('heading', { name: 'Phone service details' }).waitFor();
  };
  const finishForm = async () => {
    await demo.getByLabel('Work use (%)', { exact: true }).fill('50');
    await demo.getByLabel('Work purpose', { exact: false }).fill('Phone calls for shift coordination.');
    await demo.getByLabel('How was the percentage worked out?', { exact: false }).fill('Fictional usage diary.');
    await demo.getByLabel('Was Sarah reimbursed?', { exact: true }).selectOption('none');
    await demo.getByLabel('Supporting evidence', { exact: true }).selectOption('missing');
    // Development remounts can abort a request after its response headers arrive.
    // Capture the completed request so its body is available to these assertions.
    const pending = page.waitForEvent('requestfinished', {
      predicate: request => request.url().endsWith('/api/expenses/review') && request.method() === 'POST',
    });
    await button('Save expense').click();
    const request = await pending;
    const result = await request.response();
    assert.ok(result);
    assert.equal(result.status(), 200);
    const sent = request.postDataJSON();
    assert.equal(Object.hasOwn(sent.expenses[0], 'sources'), false);
    return await result.json();
  };
  const description = '<img src="https://example.invalid/x" onerror="alert(1)"> Café / 中文 / Ọlọ́run';
  const rows = [
    ['2025-07-01', description, '-20.10'], ['2025-08-01', 'August phone', '-30.20'],
    ['2026-01-01', 'Pay', '100'], ['2026-07-01', 'Outside year', '-5'], ['2026-01-01', 'Zero', '0'],
    ['2026-02-30', 'Invalid date', '-1'], ['2025-09-01', 'Unselected fare', '-4'],
  ];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await importFile('phone-bills.csv', rows);
  assert.equal(await upload.locator('tbody tr').count(), 6);
  await upload.getByText(/Row 7:/).waitFor();
  for (const n of [4, 5, 6]) assert.equal(await checkbox(n).isDisabled(), true);
  await checkbox(2).check(); await checkbox(3).check();
  await upload.getByText('2 selected · $50.30 spending', { exact: true }).waitFor();
  await upload.screenshot({ path: artifacts + '/csv-selection-desktop.png' });
  await beginPhone();
  assert.equal(await demo.getByLabel('Amount paid (AUD)', { exact: true }).inputValue(), '50.3');
  assert.equal(await demo.getByLabel('Work use (%)', { exact: true }).inputValue(), '');
  assert.equal(await demo.getByLabel('Supporting evidence', { exact: true }).inputValue(), '');
  await page.setViewportSize({ width: 390, height: 844 });
  await demo.locator('.source-transactions summary').click();
  await demo.screenshot({ path: artifacts + '/csv-draft-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const review = await finishForm();
  assert.equal(review.enteredTotal, 50.3); assert.equal(review.workPortionTotal, 25.15);
  await demo.getByText('$25.15 recorded work portion', { exact: true }).waitFor();
  assert.equal(await checkbox(2).isDisabled(), true);
  assert.equal(await upload.getByRole('option', { name: /Phone service — already recorded/ }).isDisabled(), true);
  await button('Edit phone service').click();
  await demo.getByLabel('Amount paid (AUD)', { exact: true }).fill('60');
  await button('Save expense').click();
  await demo.getByText('$30.00 recorded work portion', { exact: true }).waitFor();
  const exported = await verifyReportDownload(page, artifacts, { name: 'csv', total: '$30.00', itemCount: 1, sourceCount: 2, expectedSource: description });
  const reportHtml = await page.locator('iframe[title="Preparation report preview"]').getAttribute('srcdoc');
  assert.ok(reportHtml.includes('Amount adjusted to $60.00. Original CSV spending remains $50.30.'));
  assert.equal(reportHtml.includes('Unselected fare'), false);
  await upload.getByRole('button', { name: 'Clear preview', exact: true }).click();
  assert.equal(await button('Download report (HTML)').isVisible(), true);
  await importFile('renamed-bills.csv', [rows[1], rows[0], ...rows.slice(2)]);
  assert.equal(await checkbox(2).isDisabled(), true); assert.equal(await checkbox(3).isDisabled(), true);
  await upload.screenshot({ path: artifacts + '/csv-used-mobile.png' });
  await button('Remove phone service').click();
  assert.equal(await checkbox(2).isEnabled(), true);
  await checkbox(2).check(); await beginPhone();
  await button('Cancel changes').click();
  assert.equal(await checkbox(2).isEnabled(), true);
  await button('Restart demo').click();
  assert.equal(await upload.locator('tbody tr').count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });

  // The largest permitted group must remain complete and readable in an offline report.
  const many = Array.from({ length: 51 }, (_, i) => ['2025-07-01', `Fictional phone charge ${i + 1}`, '-1.01']);
  await importFile('fifty-rows.csv', many);
  for (let n = 2; n <= 51; n++) await checkbox(n).check();
  assert.equal(await checkbox(52).isDisabled(), true);
  await beginPhone();
  assert.equal(await demo.getByLabel('Amount paid (AUD)', { exact: true }).inputValue(), '50.5');
  const maximumReview = await finishForm();
  assert.equal(maximumReview.workPortionTotal, 25.25);
  await demo.getByText('$25.25 recorded work portion', { exact: true }).waitFor();
  const maximumExport = await verifyReportDownload(page, artifacts, { name: 'csv-50', total: '$25.25', itemCount: 1, sourceCount: 50, expectedSource: 'Fictional phone charge 50' });
  await button('Restart demo').click();
  return { exported, maximumExport, selectedRows: 2, groupedAmount: 50.3, originalWorkPortion: 25.15, adjustedWorkPortion: 30,
    unsupportedRowsBlocked: true, metadataLocalOnly: true, repeatedUploadBlocked: true, occupiedCategoryProtected: true,
    removeReleasesRows: true, cancellation: true, restart: true, maximumRows: 50, mobileOverflow: false };
}
