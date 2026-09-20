import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
export async function verifyPayslips(context, base, artifacts) {
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
  const button = name => page.getByRole('button', { name, exact: true });
  const totals = () => page.locator('.pay-metrics strong').allTextContents();
  const reviewCount = () => page.locator('.pay-history li').count();
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const examples = JSON.parse(readFileSync(new URL('../../../sample-data/payslips/examples.json', import.meta.url), 'utf8'));
  const file = (index, name) => ({ name: name || examples[index].name, mimeType: 'application/pdf', buffer: Buffer.from(examples[index].pdfBase64, 'base64') });
  try {
    await page.goto(base.href);
    await page.getByRole('heading', { name: 'Understand your payslip.', exact: true }).waitFor();
    assert.equal(await button('View summary').isDisabled(), true);
    await page.screenshot({ path: artifacts + 'payslip-landing-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'payslip-landing-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await button('Try example payslips').click();
    await page.getByRole('status').filter({ hasText: 'Six fictional payslips loaded.' }).waitFor();
    assert.equal(await button('View summary').getAttribute('aria-current'), 'step');
    assert.deepEqual(await totals(), ['$10,450.00', '$8,815.00', '$1,555.00', '$1,110.00']);
    assert.equal(await page.locator('.pay-charts svg').count(), 1);
    assert.ok((await page.locator('.pay-metrics').innerText()).includes('5 of 6 payslips'));
    await button('Tax').click(); await page.getByRole('heading', { name: 'Tax taken out over time' }).waitFor();
    await button('Super').click(); assert.ok((await page.locator('.chart-note').innerText()).includes('Missing does not mean zero'));
    await button('Pay').click();
    await page.getByLabel('Chart grouping', { exact: true }).selectOption('payday');
    await page.getByText('View exact chart figures', { exact: true }).click();
    assert.equal(await page.locator('.pay-chart-data tbody tr').count(), 6);
    await page.getByLabel('Employer', { exact: true }).selectOption('garden example studio');
    assert.deepEqual(await totals(), ['$2,200.00', '$1,960.00', '$240.00', '$120.00']);

    // Optional outlook stays bounded to one employer/year and never scales withholding for changed gross.
    await page.getByLabel('Financial year', { exact: true }).selectOption('2026–27');
    await page.getByLabel('Next payday', { exact: true }).fill('2027-06-01');
    await page.getByLabel('Pay frequency', { exact: true }).selectOption('fortnightly');
    await page.getByLabel('I expect these future pays to be regular, not a bonus, back pay or adjustment.', { exact: true }).check();
    await button('Show pay outlook').click();
    const outlook = page.getByLabel('Pay outlook results', { exact: true });
    await outlook.waitFor();
    assert.ok((await outlook.innerText()).includes('20% less gross pay'));
    assert.ok((await outlook.innerText()).includes('20% more gross pay'));
    assert.ok((await outlook.innerText()).includes('Not estimated'));
    assert.ok((await outlook.innerText()).includes('Partial recorded history'));
    const outlookDownload = page.waitForEvent('download'); await button('Download outlook report').click();
    await (await outlookDownload).saveAs(artifacts + 'pay-outlook.html');
    const outlookReport = readFileSync(artifacts + 'pay-outlook.html', 'utf8');
    assert.ok(outlookReport.includes('pay-outlook-arithmetic-v1'));
    assert.ok(outlookReport.includes('Partial recorded history'));
    assert.ok(outlookReport.includes('Not estimated'));
    await page.screenshot({ path: artifacts + 'pay-outlook-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'pay-outlook-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Tax readiness is whole-year/all-employer profile capture only; the tax result gate always stays locked.
    assert.ok((await page.locator('.tax-readiness').innerText()).includes('intentionally uses all employers recorded for 2026–27'));
    assert.deepEqual(await page.locator('.tax-readiness-coverage strong').allTextContents(), ['6', '2', '2026–27']);
    await button('Start tax readiness').click();
    for (const [key, value] of Object.entries({
      resident: 'yes',
      payCoverage: 'yes',
      otherIncome: 'no',
      studyLoan: 'no',
      declarationsKnown: 'yes',
      simpleFamily: 'yes',
      medicareSpecial: 'no',
      privateHealth: 'no',
      otherAdjustments: 'no',
      irregularPay: 'no',
    })) await page.getByLabel(`Tax readiness: ${key}`, { exact: true }).selectOption(value);
    await button('Review tax readiness').click();
    let taxReadiness = page.getByLabel('Tax readiness result', { exact: true });
    await taxReadiness.waitFor();
    assert.ok((await taxReadiness.innerText()).includes('Profile facts collected'));
    assert.ok((await taxReadiness.innerText()).includes('10/10 within current profile'));
    assert.ok((await taxReadiness.innerText()).includes('Tax result remains locked'));
    assert.ok((await taxReadiness.innerText()).includes('No refund, debt or final-tax number'));
    const readinessDownload = page.waitForEvent('download'); await button('Download readiness report').click();
    await (await readinessDownload).saveAs(artifacts + 'tax-readiness.html');
    const readinessReport = readFileSync(artifacts + 'tax-readiness.html', 'utf8');
    assert.ok(readinessReport.includes('tax-readiness-profile-v1'));
    assert.ok(readinessReport.includes('Tax result locked'));
    assert.ok(readinessReport.includes('SHA-256'));
    assert.ok(readinessReport.includes('6 across 2 employer(s)'));
    await page.getByLabel('Tax readiness: studyLoan', { exact: true }).selectOption('yes');
    assert.equal(await page.getByLabel('Tax readiness result', { exact: true }).count(), 0);
    await button('Review tax readiness').click();
    taxReadiness = page.getByLabel('Tax readiness result', { exact: true });
    assert.ok((await taxReadiness.innerText()).includes('Outside current prototype'));
    assert.ok((await taxReadiness.innerText()).includes('Tax result remains locked'));
    await page.screenshot({ path: artifacts + 'tax-readiness-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'tax-readiness-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Year-end reconciliation compares annual employment sources with pay history without double counting.
    assert.ok((await page.locator('.year-end-reconciliation').innerText()).includes('intentionally uses all checked employers recorded for 2026–27'));
    await button('Start year-end reconciliation').click();
    await button('Add annual employment source').click();
    await page.getByLabel('Annual source 1: employer or payer', { exact: true }).fill('Harbour Example Services');
    await page.getByLabel('Annual source 1: source reference', { exact: true }).fill('Harbour income statement');
    await page.getByLabel('Annual source 1: source type', { exact: true }).selectOption('income-statement');
    await page.getByLabel('Annual source 1: final status', { exact: true }).selectOption('final');
    await page.getByLabel('Annual source 1: gross income (AUD)', { exact: true }).fill('8250.00');
    await page.getByLabel('Annual source 1: tax withheld (AUD)', { exact: true }).fill('1315.00');
    await page.getByLabel('Annual source 1: linked employer', { exact: true }).selectOption('harbour example services');

    await button('Add annual employment source').click();
    await page.getByLabel('Annual source 2: employer or payer', { exact: true }).fill('Garden Example Studio');
    await page.getByLabel('Annual source 2: source reference', { exact: true }).fill('Garden payment summary');
    await page.getByLabel('Annual source 2: source type', { exact: true }).selectOption('payment-summary');
    await page.getByLabel('Annual source 2: final status', { exact: true }).selectOption('not-final');
    await page.getByLabel('Annual source 2: gross income (AUD)', { exact: true }).fill('2200.00');
    await page.getByLabel('Annual source 2: tax withheld (AUD)', { exact: true }).fill('240.00');
    await page.getByLabel('Annual source 2: linked employer', { exact: true }).selectOption('garden example studio');
    await page.getByLabel('Annual employment source coverage', { exact: true }).selectOption('yes');

    let reconciliation = page.getByLabel('Year-end pay reconciliation result', { exact: true });
    assert.ok((await reconciliation.innerText()).includes('Matches checked pay history'));
    assert.ok((await reconciliation.innerText()).includes('Source still provisional'));
    assert.ok((await reconciliation.innerText()).includes('Tax result remains locked'));
    assert.ok((await page.locator('.year-end-notice').innerText()).includes('does not count both as separate income'));

    await page.getByLabel('Annual source 2: final status', { exact: true }).selectOption('final');
    assert.equal(await page.getByLabel('Annual employment source coverage', { exact: true }).inputValue(), '');
    await page.getByLabel('Annual employment source coverage', { exact: true }).selectOption('yes');
    reconciliation = page.getByLabel('Year-end pay reconciliation result', { exact: true });
    assert.equal((await reconciliation.getByText('Matches checked pay history', { exact: true }).count()), 2);
    const reconciliationDownload = page.waitForEvent('download'); await button('Download year-end pay handover').click();
    await (await reconciliationDownload).saveAs(artifacts + 'year-end-pay-handover.html');
    const reconciliationReport = readFileSync(artifacts + 'year-end-pay-handover.html', 'utf8');
    assert.ok(reconciliationReport.includes('year-end-pay-reconciliation-v1'));
    assert.ok(reconciliationReport.includes('do not add them together'));
    assert.ok(reconciliationReport.includes('Harbour income statement'));
    assert.ok(reconciliationReport.includes('Garden payment summary'));
    assert.ok(reconciliationReport.includes('Tax/refund results remain locked'));
    assert.ok(reconciliationReport.includes('User annual-source coverage statement:</strong> Yes'));
    await page.screenshot({ path: artifacts + 'year-end-reconciliation-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'year-end-reconciliation-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByLabel('Employer', { exact: true }).selectOption('all');
    await page.getByLabel('Financial year', { exact: true }).selectOption('all');
    await page.getByLabel('Chart grouping', { exact: true }).selectOption('month');
    await page.getByText('View exact chart figures', { exact: true }).click();
    await page.screenshot({ path: artifacts + 'payslip-dashboard-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'payslip-dashboard-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Own files open their review immediately. No misleading zero summary is shown.
    await button('Use my own payslips').click();
    assert.equal(await button('Add payslips').getAttribute('aria-current'), 'step');
    await page.getByLabel('Choose payslip PDFs', { exact: true }).setInputFiles([file(0), file(1)]);
    await page.getByRole('status').filter({ hasText: '2 payslip(s) read.' }).waitFor();
    assert.equal(await button('Check figures').getAttribute('aria-current'), 'step');
    assert.deepEqual(await totals(), []); assert.equal(await reviewCount(), 2);
    assert.equal(await page.getByRole('heading', { name: 'Check your figures' }).evaluate(el => el === document.activeElement), true);
    await page.screenshot({ path: artifacts + 'payslip-review-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    assert.equal(await page.locator('.pay-history button').first().evaluate(el => el.getBoundingClientRect().right <= innerWidth), true);
    await page.screenshot({ path: artifacts + 'payslip-review-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await button('Confirm and continue').click();
    assert.equal(await page.locator('.pay-review').getByLabel('Pay date', { exact: true }).inputValue(), '2026-07-30');
    await button('Confirm and continue').click();
    assert.deepEqual(await totals(), ['$3,900.00', '$3,270.00', '$590.00', '$468.00']);

    // Duplicates and failed batches preserve the existing history.
    await button('Add payslips').click();
    await page.getByLabel('Choose payslip PDFs', { exact: true }).setInputFiles(file(0, 'renamed.pdf'));
    await page.getByRole('alert').filter({ hasText: 'already added' }).waitFor();
    await button('Check figures').click(); assert.equal(await reviewCount(), 2);
    await button('Add payslips').click();
    await page.getByLabel('Choose payslip PDFs', { exact: true }).setInputFiles([{ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') }, file(2)]);
    await page.getByRole('alert').filter({ hasText: 'not a PDF' }).waitFor();
    await button('Check figures').click(); assert.equal(await reviewCount(), 2);
    await button('Review example-pay-1.pdf 2026-07-16').click();
    await page.getByLabel('Tax withheld (AUD)', { exact: true }).fill('');
    assert.equal(await button('Confirm and continue').isDisabled(), true);
    await button('View summary').click();
    assert.deepEqual(await totals(), ['$2,100.00', '$1,740.00', '$340.00', '$252.00']);
    await button('Check remaining payslips').click();
    await page.getByLabel('Tax withheld (AUD)', { exact: true }).fill('260');
    await page.getByLabel('Net pay (AUD)', { exact: true }).fill('1520');
    await button('Confirm and continue').click();
    assert.deepEqual(await totals(), ['$3,900.00', '$3,260.00', '$600.00', '$468.00']);

    // Manual entry, scoped results, empty filter recovery and report corrections.
    await button('Add another payslip').click(); await button('Enter figures manually').click();
    await page.locator('.pay-review').getByLabel('Employer', { exact: true }).fill('Manual example');
    for (const [label, value] of [['Period start', '2026-06-01'], ['Period end', '2026-06-14'], ['Pay date', '2026-06-16'], ['Gross pay (AUD)', '100'], ['Tax withheld (AUD)', '0'], ['Other deductions (AUD)', '0'], ['Net pay (AUD)', '100']]) await page.locator('.pay-review').getByLabel(label, { exact: true }).fill(value);
    await button('Confirm and continue').click();
    await page.getByLabel('Financial year', { exact: true }).selectOption('2025–26');
    await page.getByLabel('Employer', { exact: true }).selectOption('harbour example services');
    assert.deepEqual(await totals(), []); await button('Show all payslips').click();
    await page.getByLabel('Financial year', { exact: true }).selectOption('2025–26');
    assert.deepEqual(await totals(), ['$100.00', '$100.00', '$0.00', 'Unknown']);
    const downloadEvent = page.waitForEvent('download'); await button('Download pay report').click();
    await (await downloadEvent).saveAs(artifacts + 'pay-history.html');
    const report = readFileSync(artifacts + 'pay-history.html', 'utf8');
    assert.ok(report.includes('Manual example')); assert.ok(!report.includes('Harbour Example Services')); assert.ok(report.includes('No refund forecast'));
    await page.getByLabel('Financial year', { exact: true }).selectOption('all');
    const allDownloadEvent = page.waitForEvent('download'); await button('Download pay report').click();
    await (await allDownloadEvent).saveAs(artifacts + 'pay-history-all.html');
    const allReport = readFileSync(artifacts + 'pay-history-all.html', 'utf8');
    assert.ok(allReport.includes('250.00')); assert.ok(allReport.includes('260')); assert.ok(allReport.includes('SHA-256'));
    await button('Check figures').click(); await button('Review Manual payslip 2026-06-16').click();
    await button('Remove this payslip').click(); assert.equal(await reviewCount(), 2);
    await button('View summary').click();
    await button('Clear pay history').click(); await button('Keep my history').click();
    assert.deepEqual(await totals(), ['$3,900.00', '$3,260.00', '$600.00', '$468.00']);
    await button('Clear pay history').click(); await button('Yes, clear history').click();
    assert.equal(await page.locator('.pay-metrics').count(), 0);
    await button('Try example payslips').click(); await page.getByRole('status').filter({ hasText: 'Six fictional payslips loaded.' }).waitFor();
    await button('Bank spending').click(); await button('My pay').click(); assert.equal(await page.locator('.pay-metrics').count(), 0);
    await button('Try example payslips').click(); await page.getByRole('status').filter({ hasText: 'Six fictional payslips loaded.' }).waitFor();
    await page.reload(); await page.getByRole('heading', { name: 'Understand your payslip.' }).waitFor();
    assert.equal(await page.locator('.pay-metrics').count(), 0);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => /payslip/i.test(k))), []);
    assert.deepEqual(errors, []); assert.ok(requests.every(r => r.method === 'GET'));
    assert.ok(requests.every(r => r.url.startsWith(base.origin) || r.url.startsWith('blob:') || r.url.startsWith('data:')));
    const result = { passed: true, guidedSteps: true, automaticBatchReview: true, noUnconfirmedZeroTotals: true, manualEntry: true, correctionInvalidates: true, duplicateBlocked: true, badBatchAtomic: true, exampleToOwnData: true, chartSwitching: true, yearAndEmployerFilters: true, emptyFilterRecovery: true, offlineExport: true, payOutlook: true, payOutlookWithholdingNotScaled: true, payOutlookMobile: true, taxReadiness: true, taxReadinessWholeYear: true, taxReadinessLocked: true, taxReadinessExport: true, taxReadinessMobile: true, yearEndReconciliation: true, yearEndNoDoubleCount: true, yearEndProvisionalExcluded: true, yearEndExport: true, yearEndMobile: true, clearConfirmation: true, clearRefreshAndWorkspaceChange: true, mobileOverflow: false, mobileReviewActionsVisible: true, documentUploads: 0, modelRequests: 0, pageErrors: errors };
    writeFileSync(artifacts + 'payslip-evaluation.json', JSON.stringify(result, null, 2)); return result;
  } catch (e) { await page.screenshot({ path: artifacts + 'payslip-failure.png', fullPage: true }); console.error((await page.locator('body').innerText()).slice(-10000)); throw e } finally { await page.close() }
}
