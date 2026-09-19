import assert from 'node:assert/strict';

export async function verifyProgress(browser, artifacts, { stopApi, startApi }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const key = 'taxprep-au:preparation-progress';
  const errors = [];
  const openPage = async () => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173'); await page.getByRole('button', { name: 'Guided example', exact: true }).click();
    return page;
  };
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const rawCopy = page => page.evaluate(key => localStorage.getItem(key), key);
  let apiStopped = false;
  try {
    let page = await openPage();
    let reviewRequests = 0;
    page.on('request', request => { if (request.url().endsWith('/api/expenses/review')) reviewRequests++; });
    await button(page, 'Try demo').click(); await button(page, 'Information is correct').click();
    await page.getByRole('button', { name: /^Yes/ }).click();
    await page.getByLabel('Amount paid (AUD)', { exact: true }).fill('12.');
    await page.getByLabel('Work purpose', { exact: false }).fill('Unfinished travel note');
    assert.equal(await rawCopy(page), null);
    await button(page, 'Save progress').click();
    const savedDraft = JSON.parse(await rawCopy(page));
    assert.equal(savedDraft.data.step.fields.amount, '12.');
    assert.equal(savedDraft.data.expenses.length, 0);
    await page.reload(); await page.getByRole('button', { name: 'Guided example', exact: true }).click(); await button(page, 'Resume saved progress').waitFor();
    assert.equal(reviewRequests, 0);
    await button(page, 'Resume saved progress').click();
    assert.equal(await page.getByLabel('Amount paid (AUD)', { exact: true }).inputValue(), '12.');
    assert.equal(await page.getByLabel('Work purpose', { exact: false }).inputValue(), 'Unfinished travel note');
    await button(page, 'Save expense').click();
    assert.equal(await page.getByLabel('Amount paid (AUD)', { exact: true }).getAttribute('aria-invalid'), 'true');
    await page.getByLabel('Amount paid (AUD)', { exact: true }).fill('100');
    await page.getByLabel('Work use (%)', { exact: true }).fill('40');
    await page.getByLabel('Was Sarah reimbursed?', { exact: true }).selectOption('none');
    await page.getByLabel('Supporting evidence', { exact: true }).selectOption('missing');
    await button(page, 'Save expense').click();
    await page.getByRole('button', { name: /^No/ }).click(); await page.getByRole('button', { name: /^No/ }).click();
    await page.getByText('$40.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Save progress').click();
    const savedSummary = JSON.parse(await rawCopy(page));
    assert.equal(Object.hasOwn(savedSummary, 'apiResult'), false);
    assert.equal(Object.hasOwn(savedSummary.data, 'result'), false);
    await page.locator('.saved-progress').screenshot({ path: artifacts + '/progress-saved-desktop.png' });

    await stopApi(); apiStopped = true;
    await page.reload(); await page.getByRole('button', { name: 'Guided example', exact: true }).click(); await button(page, 'Resume saved progress').click();
    await page.locator('.review-error').waitFor();
    assert.equal(await button(page, 'Download report (HTML)').count(), 0);
    await page.getByText('$100.00 × 40% work use', { exact: true }).waitFor();
    await startApi(); apiStopped = false;
    await button(page, 'Retry review').click();
    await page.getByText('$40.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Download report (HTML)').waitFor();
    await page.frameLocator('iframe[title="Preparation report preview"]').locator('.totals dd').nth(1).waitFor({ state: 'attached' });
    assert.equal(await page.frameLocator('iframe[title="Preparation report preview"]').locator('.totals dd').nth(1).textContent(), '$40.00');
    await page.evaluate(() => localStorage.setItem('unrelated-demo-key', 'keep'));
    await button(page, 'Delete saved progress').click();
    assert.equal(await rawCopy(page), null);
    await page.getByText('$100.00 × 40% work use', { exact: true }).waitFor();
    await button(page, 'Save progress').click(); await button(page, 'Restart demo').click();
    assert.equal(await rawCopy(page), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-demo-key')), 'keep');

    await button(page, 'Try sample CSV').click();
    const phone = page.getByRole('checkbox', { name: /Sunrise Mobile Services/ });
    await phone.check();
    await page.getByLabel('Expense category', { exact: true }).selectOption('phone');
    await button(page, 'Review selected spending').click();
    await page.getByLabel('Work use (%)', { exact: true }).fill('4');
    await page.getByLabel('Work purpose', { exact: false }).fill('Imported draft to finish');
    await button(page, 'Save progress').click();
    await page.close(); page = await openPage();
    assert.equal(await page.locator('.transaction-preview').count(), 0);
    await button(page, 'Resume saved progress').click();
    assert.equal(await page.getByLabel('Amount paid (AUD)', { exact: true }).inputValue(), '45');
    assert.equal(await page.getByLabel('Work use (%)', { exact: true }).inputValue(), '4');
    await page.locator('.source-transactions summary').click();
    await page.locator('.source-transactions').getByText('Sunrise Mobile Services', { exact: true }).waitFor();
    await page.getByLabel('Work use (%)', { exact: true }).fill('40');
    await page.getByLabel('Was Sarah reimbursed?', { exact: true }).selectOption('none');
    await page.getByLabel('Supporting evidence', { exact: true }).selectOption('missing');
    await button(page, 'Save expense').click();
    await page.getByText('$18.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Save progress').click(); await page.reload(); await page.getByRole('button', { name: 'Guided example', exact: true }).click();
    await button(page, 'Resume saved progress').click();
    await page.getByText('$18.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Try sample CSV').click();
    await page.getByRole('checkbox', { name: /Sunrise Mobile Services/ }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: /Sunrise Mobile Services/ }).isDisabled(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('.saved-progress').screenshot({ path: artifacts + '/progress-resumed-mobile.png' });

    const other = await openPage();
    await button(other, 'Resume saved progress').click();
    await other.getByText('$18.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Edit phone service').click();
    await page.getByLabel('Amount paid (AUD)', { exact: true }).fill('100');
    await button(page, 'Save expense').click(); await page.getByText('$40.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Save progress').click();
    await other.getByText(/Saved progress changed in another tab/).waitFor();
    assert.equal(await button(other, 'Save progress').isDisabled(), true);
    await other.getByText('$45.00 × 40% work use', { exact: true }).waitFor();
    await other.locator('.saved-progress').screenshot({ path: artifacts + '/progress-other-tab.png' });
    await button(other, 'Resume saved progress').click();
    await other.getByText('$40.00 recorded work portion', { exact: true }).waitFor();
    await button(page, 'Delete saved progress').click();
    await other.getByText(/Saved progress changed in another tab/).waitFor();
    assert.equal(await rawCopy(other), null);
    assert.equal(await button(other, 'Save progress').isDisabled(), true);
    await other.close();

    await page.evaluate(key => localStorage.setItem(key, '{broken'), key); await page.reload(); await page.getByRole('button', { name: 'Guided example', exact: true }).click();
    await page.locator('.saved-progress').getByRole('alert').waitFor();
    assert.equal(await button(page, 'Save progress').isDisabled(), true);
    assert.equal(await rawCopy(page), '{broken');
    await button(page, 'Delete saved progress').click();
    await button(page, 'Try demo').click(); await button(page, 'Save progress').click();
    assert.equal(JSON.parse(await rawCopy(page)).data.step.kind, 'income');
    assert.deepEqual(errors, []);
    return { explicitSave: true, incompleteDraft: true, newTabResume: true, importedSources: true, restoredDuplicateProtection: true,
      freshReviewAfterOutage: true, reportAfterRetry: true, deleteKeepsCurrentWork: true, restartClearsCopy: true,
      unrelatedStoragePreserved: true, crossTabChange: true, noAutomaticResurrection: true, corruptCopyRecovery: true, mobileOverflow: false, pageErrors: errors };
  } finally {
    if (apiStopped) await startApi();
    await context.close();
  }
}
