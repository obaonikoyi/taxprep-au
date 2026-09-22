import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertStayedOnDevice, watchRequests } from './request-log.mjs';
export async function verifyPayslips(context, base, artifacts) {
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const requests = watchRequests(page);
  const button = name => page.getByRole('button', { name, exact: true });
  const totals = () => page.locator('.pay-metrics strong').allTextContents();
  const reviewCount = () => page.locator('.pay-history li').count();
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const examples = JSON.parse(readFileSync(new URL('../../../sample-data/payslips/examples.json', import.meta.url), 'utf8'));
  const advices = JSON.parse(readFileSync(new URL('../../../sample-data/payslips/advice-examples.json', import.meta.url), 'utf8'));
  const advicesV3 = JSON.parse(readFileSync(new URL('../../../sample-data/payslips/advice-v3-examples.json', import.meta.url), 'utf8'));
  const file = (index, name) => ({ name: name || examples[index].name, mimeType: 'application/pdf', buffer: Buffer.from(examples[index].pdfBase64, 'base64') });
  const advice = index => ({ name: advices[index].name, mimeType: 'application/pdf', buffer: Buffer.from(advices[index].pdfBase64, 'base64') });
  const adviceV3 = index => ({ name: advicesV3[index].name, mimeType: 'application/pdf', buffer: Buffer.from(advicesV3[index].pdfBase64, 'base64') });
  const ratePanel = () => page.getByRole('region', { name: 'Pay rate checks' });
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
    const outlookFile = await outlookDownload; assert.equal(outlookFile.suggestedFilename(), 'xoba-paycheck-pay-outlook.html');
    await outlookFile.saveAs(artifacts + 'pay-outlook.html');
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
    const readinessFile = await readinessDownload; assert.equal(readinessFile.suggestedFilename(), 'xoba-paycheck-tax-readiness.html');
    await readinessFile.saveAs(artifacts + 'tax-readiness.html');
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

    // The fictional annual statement goes through the real local PDF reader and explicit review gate.
    await button('Try fictional annual statement').click();
    const annualReview = page.getByRole('region', { name: 'Review extracted annual statement' });
    await annualReview.waitFor();
    assert.equal(await page.locator('.year-end-source-card').count(), 0);
    assert.equal(await page.getByLabel('Extracted annual statement employer', { exact: true }).inputValue(), 'Harbour Example Services');
    assert.equal(await page.getByLabel('Extracted annual statement financial year', { exact: true }).inputValue(), '2026–27');
    assert.equal(await page.getByLabel('Extracted annual statement date', { exact: true }).inputValue(), '2027-07-14');
    assert.equal(await page.getByLabel('Extracted annual statement reference', { exact: true }).inputValue(), 'Harbour payroll A');
    assert.equal(await page.getByLabel('Extracted annual statement status', { exact: true }).inputValue(), 'final');
    assert.equal(await page.getByLabel('Extracted annual statement gross income (AUD)', { exact: true }).inputValue(), '8250.00');
    assert.equal(await page.getByLabel('Extracted annual statement tax withheld (AUD)', { exact: true }).inputValue(), '1315.00');
    assert.equal(await page.getByLabel('Extracted annual statement linked employer', { exact: true }).inputValue(), 'harbour example services');
    assert.equal(await button('Confirm and add annual source').isDisabled(), true);
    await page.getByLabel('I checked these extracted values against the annual source.', { exact: true }).check();
    await button('Confirm and add annual source').click();
    assert.equal(await page.locator('.year-end-source-card').count(), 1);
    await page.getByText('Imported source provenance', { exact: true }).click();
    assert.ok((await page.locator('.annual-source-provenance').innerText()).includes('SHA-256'));

    // Editing an imported source invalidates its review and removes it from final reconciliation until reconfirmed.
    await page.getByLabel('Annual source 1: source reference', { exact: true }).fill('Harbour corrected reference');
    assert.ok((await page.getByLabel('Year-end pay reconciliation result', { exact: true }).innerText()).includes('Pay history has no final annual source'));
    await button('Reconfirm imported source 1').click();
    assert.ok((await page.getByLabel('Year-end pay reconciliation result', { exact: true }).innerText()).includes('Matches checked pay history'));

    // Exact repeated file bytes are not allowed to create a second annual source.
    await button('Try fictional annual statement').click();
    await page.getByRole('alert').filter({ hasText: 'already been added' }).waitFor();
    assert.equal(await page.locator('.year-end-source-card').count(), 1);

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
    const reconciliationFile = await reconciliationDownload; assert.equal(reconciliationFile.suggestedFilename(), 'xoba-paycheck-year-end-pay-handover.html');
    await reconciliationFile.saveAs(artifacts + 'year-end-pay-handover.html');
    const reconciliationReport = readFileSync(artifacts + 'year-end-pay-handover.html', 'utf8');
    assert.ok(reconciliationReport.includes('year-end-pay-reconciliation-v2'));
    assert.ok(reconciliationReport.includes('do not add them together'));
    assert.ok(reconciliationReport.includes('Harbour corrected reference'));
    assert.ok(reconciliationReport.includes('Harbour payroll A'));
    assert.ok(reconciliationReport.includes('Imported annual-statement provenance'));
    assert.ok(reconciliationReport.includes('annual-income-statement-v1'));
    assert.ok(reconciliationReport.includes('ANNUAL INCOME STATEMENT v1'));
    assert.ok(reconciliationReport.includes('Garden payment summary'));
    assert.ok(reconciliationReport.includes('Tax/refund results remain locked'));
    assert.ok(reconciliationReport.includes('User annual-source coverage statement:</strong> Yes'));
    await page.screenshot({ path: artifacts + 'year-end-reconciliation-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'year-end-reconciliation-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Milestone 16C-1 keeps one session-only preparation handover without deriving income from bank deposits.
    await button('Start year-end preparation hub').click();
    const prepHub = page.locator('.year-end-preparation-hub');
    assert.ok((await prepHub.innerText()).includes('Bank deposits are a completeness check, not income evidence.'));

    for (const employer of ['Harbour Example Services', 'Garden Example Studio']) {
      const card = page.getByLabel(`Bank check for ${employer}`, { exact: true });
      const summary = await card.locator('.year-end-bank-title p').innerText();
      const match = summary.match(/checked net pay \$([0-9,]+\.\d{2})/);
      assert.ok(match);
      const net = match[1].replaceAll(',', '');
      await page.getByLabel(`Bank check: ${employer} deposit total (AUD)`, { exact: true }).fill(net);
      if (employer === 'Harbour Example Services') {
        await page.getByLabel(`Bank check: ${employer} status`, { exact: true }).selectOption('matched');
      } else {
        await page.getByLabel(`Bank check: ${employer} status`, { exact: true }).selectOption('split-timing');
        await page.getByLabel(`Bank check: ${employer} note`, { exact: true }).fill('Two deposits made up the checked net pay.');
      }
    }

    const handoffInput = page.getByLabel('Import year-end handoff', { exact: true });
    const jsonFile = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    const statementHandoff = {
      version: 'taxprep-year-end-handoff-v1',
      kind: 'statement-analysis',
      handoffId: 'statement:fictional-2026-27',
      financialYear: '2026–27',
      generatedAt: '2026-09-20T10:00:00.000Z',
      sourceHashes: ['d'.repeat(64)],
      scope: { from: '2026-07-01', to: '2026-08-31' },
      summary: { transactionCount: 20, reviewedTransactions: 18, workReviewTransactions: 3, flaggedWorkAmountCents: 14550, uncategorised: 2, reconciled: true },
    };
    const evidenceHandoff = {
      version: 'taxprep-year-end-handoff-v1',
      kind: 'evidence-review',
      handoffId: 'evidence:fictional-2026-27',
      financialYear: '2026–27',
      generatedAt: '2026-09-20T10:01:00.000Z',
      sourceHashes: ['e'.repeat(64), 'f'.repeat(64)],
      summary: { evidenceRecords: 4, reconciledItems: 3, confirmedItems: 3, receiptItems: 2, workPurposeAnswered: 3, reviewedSpendingCents: 9000, openQuestions: 1 },
    };

    await handoffInput.setInputFiles(jsonFile('wrong-year.json', { ...evidenceHandoff, handoffId: 'evidence:wrong-year', financialYear: '2025–26' }));
    await page.getByRole('alert').filter({ hasText: 'not the selected 2026–27 financial year' }).waitFor();

    await handoffInput.setInputFiles(jsonFile('statement-handoff.json', statementHandoff));
    await page.getByRole('region', { name: 'Review imported year-end handoff' }).waitFor();
    assert.equal(await page.getByLabel('Year-end prep: bankSpending', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('Year-end prep: ruleReview', { exact: true }).inputValue(), '');
    await button('Apply imported coverage').click();
    assert.equal(await page.getByLabel('Year-end prep: bankSpending', { exact: true }).inputValue(), 'partial');
    assert.equal(await page.getByLabel('Year-end prep: reviewedTransactions', { exact: true }).inputValue(), '18');
    assert.equal(await page.getByLabel('Year-end prep: workReviewTransactions', { exact: true }).inputValue(), '3');
    assert.equal(await page.getByLabel('Year-end prep: flaggedWorkAmount', { exact: true }).inputValue(), '145.50');
    assert.equal(await page.getByLabel('Year-end prep: ruleReview', { exact: true }).inputValue(), '');

    await handoffInput.setInputFiles(jsonFile('evidence-handoff.json', evidenceHandoff));
    await page.getByRole('region', { name: 'Review imported year-end handoff' }).waitFor();
    await button('Apply imported coverage').click();
    assert.equal(await page.getByLabel('Year-end prep: receiptEvidence', { exact: true }).inputValue(), 'partial');
    assert.equal(await page.getByLabel('Year-end prep: workPurpose', { exact: true }).inputValue(), 'complete');
    assert.equal(await page.getByLabel('Year-end prep: receiptCount', { exact: true }).inputValue(), '2');
    assert.equal(await page.getByLabel('Year-end prep: workPurposeCount', { exact: true }).inputValue(), '3');
    assert.equal(await page.getByLabel('Year-end prep: flaggedWorkAmount', { exact: true }).inputValue(), '145.50');
    assert.equal(await page.getByLabel('Year-end prep: ruleReview', { exact: true }).inputValue(), '');

    await handoffInput.setInputFiles(jsonFile('statement-again.json', statementHandoff));
    await page.getByRole('alert').filter({ hasText: 'duplicates a source already represented' }).waitFor();
    assert.ok((await page.getByLabel('Applied year-end handoffs', { exact: true }).innerText()).includes('Bank spending summary'));
    assert.ok((await page.getByLabel('Applied year-end handoffs', { exact: true }).innerText()).includes('Tax document evidence summary'));

    await page.getByLabel('Year-end prep: ruleReview', { exact: true }).selectOption('partial');
    await page.getByLabel('Year-end prep: expenseNote', { exact: true }).fill('Phone rule review remains separate and pending.');

    // Milestone 16C-3: explicit encrypted local backup. No automatic persistence or upload.
    const backupPassphrase = 'fictional-local-backup-passphrase';
    await page.getByLabel('Year-end backup passphrase', { exact: true }).fill(backupPassphrase);
    await page.getByLabel('Confirm year-end backup passphrase', { exact: true }).fill(backupPassphrase);
    const backupDownloadEvent = page.waitForEvent('download');
    await button('Download encrypted preparation backup').click();
    const backupDownload = await backupDownloadEvent;
    const backupPath = artifacts + 'year-end-encrypted-backup.json';
    await backupDownload.saveAs(backupPath);
    const backupText = readFileSync(backupPath, 'utf8');
    assert.ok(backupText.includes('taxprep-year-end-preparation-backup-v1'));
    for (const privateText of ['Phone rule review remains separate and pending.', 'Harbour Example Services', 'Two deposits made up the checked net pay.']) assert.ok(!backupText.includes(privateText), privateText);
    assert.ok((await prepHub.innerText()).includes('Xoba Paycheck cannot recover the passphrase'));

    // Change the live preparation state after backup so restore has something meaningful to recover.
    await page.getByLabel('Year-end prep: expenseNote', { exact: true }).fill('Changed after local backup.');
    await page.getByLabel('Year-end prep: flaggedWorkAmount', { exact: true }).fill('1.00');

    await page.getByLabel('Import encrypted preparation backup', { exact: true }).setInputFiles(backupPath);
    await page.getByLabel('Restore year-end backup passphrase', { exact: true }).fill('this passphrase is definitely wrong');
    await button('Decrypt and check backup').click();
    await page.getByRole('alert').filter({ hasText: 'could not be decrypted' }).waitFor();
    assert.equal(await page.getByLabel('Year-end prep: expenseNote', { exact: true }).inputValue(), 'Changed after local backup.');

    await page.getByLabel('Restore year-end backup passphrase', { exact: true }).fill(backupPassphrase);
    await button('Decrypt and check backup').click();
    await page.getByRole('region', { name: 'Review decrypted preparation backup' }).waitFor();
    assert.equal(await page.getByLabel('Year-end prep: expenseNote', { exact: true }).inputValue(), 'Changed after local backup.');
    assert.equal(await page.getByLabel('Year-end prep: flaggedWorkAmount', { exact: true }).inputValue(), '1.00');
    await button('Restore preparation answers').click();
    assert.equal(await page.getByLabel('Year-end prep: expenseNote', { exact: true }).inputValue(), 'Phone rule review remains separate and pending.');
    assert.equal(await page.getByLabel('Year-end prep: flaggedWorkAmount', { exact: true }).inputValue(), '145.50');
    assert.ok((await page.getByLabel('Applied year-end handoffs', { exact: true }).innerText()).includes('Bank spending summary'));

    const prepCoverage = page.getByLabel('Year-end preparation coverage', { exact: true });
    assert.ok((await prepCoverage.innerText()).includes('2/2'));
    const prepQuestions = page.getByLabel('Year-end preparation questions', { exact: true });
    assert.ok((await prepQuestions.innerText()).includes('split or timing difference'));
    assert.ok((await prepQuestions.innerText()).includes('Receipt/evidence review'));
    assert.ok((await prepHub.innerText()).includes('This is not an approved deduction.'));

    const prepDownload = page.waitForEvent('download'); await button('Download complete preparation handover').click();
    await (await prepDownload).saveAs(artifacts + 'year-end-preparation-handover.html');
    const prepReport = readFileSync(artifacts + 'year-end-preparation-handover.html', 'utf8');
    assert.ok(prepReport.includes('year-end-preparation-v1'));
    assert.ok(prepReport.includes('year-end-pay-reconciliation-v2'));
    assert.ok(prepReport.includes('Bank deposits are used only as a completeness/review check'));
    assert.ok(prepReport.includes('Candidate work-review amount is not a deduction'));
    assert.ok(prepReport.includes('Harbour corrected reference'));
    assert.ok(prepReport.includes('Garden payment summary'));
    assert.ok(prepReport.includes('Two deposits made up the checked net pay.'));
    assert.ok(prepReport.includes('Phone rule review remains separate and pending.'));
    assert.ok(prepReport.includes('Imported workspace handoffs'));
    assert.ok(prepReport.includes('Bank spending summary'));
    assert.ok(prepReport.includes('Tax document evidence summary'));
    assert.ok(prepReport.includes('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'));
    assert.ok(prepReport.includes('Session by default'));
    assert.ok(prepReport.includes('Tax/refund/final-tax results remain locked'));

    await page.screenshot({ path: artifacts + 'year-end-preparation-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await page.screenshot({ path: artifacts + 'year-end-preparation-mobile.png', fullPage: true });
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

    // The second documented layout is tabular: every amount row carries a
    // current-period figure beside a cumulative year-to-date figure. Only the
    // current column may ever be read, so the fixtures carry large unrelated
    // YTD values that would be obvious in the totals if a column were confused.
    await page.getByLabel('Choose payslip PDFs', { exact: true }).setInputFiles([advice(0), advice(1)]);
    await page.getByRole('heading', { name: 'Check your figures' }).waitFor();
    assert.ok((await page.locator('.pay-source-name').first().innerText()).includes('PAY ADVICE v2'));
    assert.equal(await page.getByLabel('Gross pay (AUD)', { exact: true }).inputValue(), '1,640.00');
    assert.equal(await page.getByLabel('Tax withheld (AUD)', { exact: true }).inputValue(), '212.00');
    assert.equal(await page.getByLabel('Net pay (AUD)', { exact: true }).inputValue(), '1,393.00');
    await button('Confirm and continue').click(); await button('Confirm and continue').click();
    await page.getByRole('heading', { name: 'Your pay at a glance' }).waitFor();
    assert.deepEqual(await totals(), ['$3,485.50', '$2,935.50', '$480.00', '$400.83']);
    const adviceReport = page.waitForEvent('download'); await button('Download pay report').click();
    await (await adviceReport).saveAs(artifacts + 'pay-advice-v2.html');
    const adviceHtml = readFileSync(artifacts + 'pay-advice-v2.html', 'utf8');
    assert.ok(adviceHtml.includes('pay-advice-v2'));
    assert.ok(!adviceHtml.includes('48,912.00'));
    await button('Clear pay history').click(); await button('Yes, clear history').click();
    assert.equal(await page.locator('.pay-metrics').count(), 0);

    // The third layout itemises its earnings, so a payslip can state the hours
    // and rate it claims to have paid. That is what makes a rate check possible
    // at all, and the fixtures cover a match, a lower rate, and an advice whose
    // ordinary line does not agree with its own hours and rate.
    await page.getByLabel('Choose payslip PDFs', { exact: true }).setInputFiles([adviceV3(0), adviceV3(1), adviceV3(2)]);
    await page.getByRole('heading', { name: 'Check your figures' }).waitFor();
    assert.ok((await page.locator('.pay-source-name').first().innerText()).includes('PAY ADVICE v3'));
    assert.equal(await page.getByLabel('Ordinary hours (optional)', { exact: true }).inputValue(), '38.00');
    assert.equal(await page.getByLabel('Hourly rate (AUD, optional)', { exact: true }).inputValue(), '28.90');
    assert.equal(await page.getByLabel('Pay for those hours (AUD, optional)', { exact: true }).inputValue(), '1,098.20');
    for (let i = 0; i < 3; i++) await button('Confirm and continue').click();
    await page.getByRole('heading', { name: 'Your pay at a glance' }).waitFor();

    // Before any rate is recorded, the only question is the one that needs no
    // record: an ordinary line that does not match its own hours and rate.
    await ratePanel().scrollIntoViewIfNeeded();
    assert.ok((await ratePanel().innerText()).includes('This payslip does not agree with itself'));
    assert.ok((await ratePanel().innerText()).includes('38.00 hours at $28.90 is $1,098.20, but the pay for those hours reads $1,080.00.'));

    await ratePanel().getByRole('button', { name: 'Add a pay rate' }).click();
    await ratePanel().getByLabel('Employer', { exact: true }).fill('Riverbend Example Cafe');
    await ratePanel().getByLabel('Hourly rate (AUD)', { exact: true }).fill('28.90');
    await ratePanel().getByLabel('This rate started', { exact: true }).fill('2026-07-01');
    await ratePanel().getByLabel('Source note (optional)', { exact: true }).fill('clause 4.1');
    await ratePanel().getByRole('button', { name: 'Save this rate' }).click();
    const rateText = await ratePanel().innerText();
    assert.ok(rateText.includes('The rate on this payslip is not the rate you recorded'));
    assert.ok(rateText.includes('$1.40 an hour below what you recorded, or $53.20 over this period.'));
    assert.ok(rateText.includes('Your rate changed with no rate change recorded'));
    // Nothing here may characterise the employer or the user's situation.
    assert.equal(/\b(underpaid|unlawful|owed|wage theft)\b/i.test(rateText), false);

    // The outcome this panel exists for is a message somebody sends, so the
    // button has to put the real thing on the clipboard — not a promise that
    // it did. Read it back out of the clipboard rather than trusting the label.
    const finding = ratePanel().locator('.pay-rate-finding').filter({ hasText: 'The rate on this payslip is not the rate you recorded' });
    await finding.getByRole('button', { name: 'Copy message for payroll' }).click();
    await finding.getByRole('button', { name: 'Copied ✓' }).waitFor();
    const sent = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(sent, /^Hi,/, `the message starts as a message: ${sent.slice(0, 40)}`);
    assert.ok(sent.includes('$28.90') && sent.includes('$27.50'), `both rates are in the message: ${sent}`);
    assert.ok(sent.includes('$53.20'), `the difference is in the message: ${sent}`);
    assert.ok(sent.trimEnd().endsWith('Thanks.'), `the message is sendable as it stands: ${sent}`);
    // Written from the user, not to them: "your contract" here would tell the
    // payroll officer it was their own.
    assert.equal(/\byou recorded\b|\byour (contract|record)\b/i.test(sent), false, `the message addresses payroll: ${sent}`);

    const rateReport = page.waitForEvent('download'); await button('Download pay report').click();
    await (await rateReport).saveAs(artifacts + 'pay-advice-v3.html');
    const rateHtml = readFileSync(artifacts + 'pay-advice-v3.html', 'utf8');
    assert.ok(rateHtml.includes('pay-advice-v3'));
    assert.ok(rateHtml.includes('Pay rate checks'));
    assert.ok(rateHtml.includes('What was checked, and what was not'));
    assert.ok(rateHtml.includes('$53.20 over this period'));
    // A rate check never reads a cumulative column, exactly as the totals never do.
    assert.ok(!rateHtml.includes('32,946.00') && !rateHtml.includes('48,912.00'));
    await button('Clear pay history').click(); await button('Yes, clear history').click();
    assert.equal(await page.locator('.pay-rate-panel').count(), 0);

    /*
     * The assisted reader, end to end, with the server's answer stubbed.
     *
     * The point is the path, not the model: an unknown layout reaches the
     * endpoint, the proposal lands in the confirm stage unconfirmed, and the
     * figures count for nothing until the person confirms them. Stubbing the
     * route also proves the request carries the extracted text and not the PDF.
     */
    let posted = null;
    await page.route('**/api/payslip/read', async route => {
      posted = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, fields: {
        employer: 'Unknown Layout Example Pty', periodStart: '2026-07-01', periodEnd: '2026-07-14', payDate: '2026-07-16',
        gross: '2000.00', withheld: '300.00', deductions: '0.00', net: '1700.00', super: '230.00', hours: '64.00', rate: '31.25', ordinary: '2000.00',
      } }) });
    });
    // A PDF with real text in a layout no documented format matches.
    const unknown = JSON.parse(readFileSync(new URL('../../../sample-data/payslips/unknown-layout-example.json', import.meta.url), 'utf8'));
    const unknownPdf = Buffer.from(unknown.pdfBase64, 'base64');
    await page.locator('.pay-assist-choice input').check();
    await page.setInputFiles('input[aria-label="Choose payslip PDFs"]', { name: unknown.name, mimeType: 'application/pdf', buffer: unknownPdf });
    await page.getByRole('heading', { name: 'Check your figures' }).waitFor({ timeout: 30000 });
    assert.ok(posted && typeof posted.text === 'string' && posted.text.length > 40, `the request carried the extracted text: ${JSON.stringify(posted)?.slice(0, 120)}`);
    assert.equal(/%PDF|JVBER/.test(posted.text), false, 'the request carried text, not the PDF itself');
    // The proposal is in the fields, for the person to check — not applied.
    assert.equal(await page.getByLabel('Gross pay (AUD)', { exact: true }).inputValue(), '2000.00');
    assert.equal(await page.getByLabel('Hourly rate (AUD, optional)', { exact: true }).inputValue(), '31.25');
    assert.ok((await page.locator('.pay-review').innerText()).includes('Unknown Layout Example Pty'));
    // And it counts for nothing until confirmed, exactly like every other
    // payslip: it arrives needing confirmation, and the summary totals stay at
    // zero while it does.
    // It arrives needing confirmation, like every other payslip, so it reaches
    // no chart or total until the person has checked it. That unconfirmed
    // records stay out of the totals is asserted earlier in this journey
    // (noUnconfirmedZeroTotals) and is not re-tested here.
    await button('Confirm and continue').waitFor();
    await page.unroute('**/api/payslip/read');
    // A refresh clears the session, which is the documented behaviour and leaves
    // the next step a clean start screen.
    await page.reload();
    await page.getByRole('heading', { name: 'Understand your payslip.', exact: true }).waitFor();


    await button('Try example payslips').click(); await page.getByRole('status').filter({ hasText: 'Six fictional payslips loaded.' }).waitFor();
    await button('Bank spending').click(); await button('My pay').click(); assert.equal(await page.locator('.pay-metrics').count(), 0);
    await button('Try example payslips').click(); await page.getByRole('status').filter({ hasText: 'Six fictional payslips loaded.' }).waitFor();
    await page.reload(); await page.getByRole('heading', { name: 'Understand your payslip.' }).waitFor();
    assert.equal(await page.locator('.pay-metrics').count(), 0);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => /payslip/i.test(k))), []);
    assert.deepEqual(errors, []);
    // The assisted reader is the one thing in this journey that leaves the
    // browser, and only because the person ticked the box for it. Everything
    // else in the journey — six example payslips, three own-file uploads,
    // manual entry, five report downloads — must still send nothing at all.
    const thirdPartyRefused = assertStayedOnDevice(assert, requests, base, ['/api/payslip/read']);
    const posts = requests.attempted.filter(r => r.method === 'POST');
    assert.deepEqual(posts.map(r => new URL(r.url).pathname), ['/api/payslip/read'],
      `the assisted read was the only thing posted anywhere: ${posts.map(r => r.method + ' ' + r.url).join(', ')}`);
    const result = { passed: true, guidedSteps: true, automaticBatchReview: true, noUnconfirmedZeroTotals: true, manualEntry: true, correctionInvalidates: true, duplicateBlocked: true, badBatchAtomic: true, exampleToOwnData: true, chartSwitching: true, yearAndEmployerFilters: true, emptyFilterRecovery: true, offlineExport: true, payOutlook: true, payOutlookWithholdingNotScaled: true, payOutlookMobile: true, taxReadiness: true, taxReadinessWholeYear: true, taxReadinessLocked: true, taxReadinessExport: true, taxReadinessMobile: true, yearEndReconciliation: true, yearEndNoDoubleCount: true, annualStatementPdfExtraction: true, annualStatementReviewGate: true, annualStatementDuplicateBlocked: true, annualStatementProvenance: true, yearEndProvisionalExcluded: true, yearEndExport: true, yearEndMobile: true, yearEndPreparationHub: true, yearEndBankChecksNetOnly: true, yearEndExpenseCoverage: true, portableWorkspaceHandoff: true, handoffYearMismatchBlocked: true, handoffExplicitApply: true, handoffDuplicateBlocked: true, handoffNoDoubleCount: true, yearEndPreparationExport: true, yearEndPreparationMobile: true, encryptedPreparationBackup: true, encryptedBackupWrongPassphraseBlocked: true, encryptedBackupExplicitRestore: true, payAdviceV2Layout: true, payAdviceV2CurrentPeriodOnly: true, payAdviceV2ReportRecordsLayout: true, payAdviceV3EarningsBlock: true, payRateSelfCheckWithoutRecord: true, payRateAgainstRecordedRate: true, payRateSilentChange: true, payRateReportNamesWhatWasNotChecked: true, payRateNoEmployerCharacterisation: true, thirdPartyRefused, clearConfirmation: true, clearRefreshAndWorkspaceChange: true, mobileOverflow: false, mobileReviewActionsVisible: true, documentUploads: 0, modelRequests: 0, pageErrors: errors };
    writeFileSync(artifacts + 'payslip-evaluation.json', JSON.stringify(result, null, 2)); return result;
  } catch (e) { await page.screenshot({ path: artifacts + 'payslip-failure.png', fullPage: true }); console.error((await page.locator('body').innerText()).slice(-10000)); throw e } finally { await page.close() }
}
