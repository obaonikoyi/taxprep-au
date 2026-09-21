import { verifyStatements } from './statement-smoke.mjs';
import { verifyPayslips } from './payslip-smoke.mjs';
import { verifyDocuments } from './document-smoke.mjs';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Same test for the production container and its public Railway deployment.
const base = new URL(process.env.DEMO_URL || 'http://127.0.0.1:8080');
assert.ok(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)));
assert.equal(base.username + base.password, '');
const artifacts = new URL('../../../test-results/hosted/', import.meta.url).pathname;
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const failedRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
const button = name => page.getByRole('button', { name, exact: true });
try {
  const health = await context.request.get(new URL('/api/health', base).href);
  assert.equal(health.status(), 200);
  assert.equal((await health.json()).status, 'healthy');
  assert.equal((await context.request.get(new URL('/api/not-a-route', base).href)).status(), 404);
  const response = await page.goto(base.href);
  assert.equal(response.status(), 200);

  // TaxPrep's promise is that payslips, statements and receipts never leave the
  // browser. That cannot rest on whatever proxy is in front of this app leaving
  // the page alone — Cloudflare's analytics feature injects a third-party
  // script into HTML responses that look like they came from a browser, which
  // is invisible to curl and to any check that does not drive a real one. The
  // app states the promise as a policy the browser enforces; this asserts the
  // two directives that carry it admit no third party at all.
  const csp = response.headers()['content-security-policy'] ?? '';
  const directive = name => (csp.split(';').map(part => part.trim()).find(part => part.startsWith(name + ' ')) ?? '').slice(name.length).trim();
  for (const name of ['script-src', 'connect-src']) {
    const value = directive(name);
    assert.ok(value, `${name} is missing from the Content-Security-Policy: ${csp || '(no header)'}`);
    assert.ok(!/https?:|\/\/|\*/.test(value), `${name} admits a third party: ${value}`);
  }
  await button('Guided example').click();
  await page.getByRole('heading', { name: 'Organise expenses. See what needs checking.' }).waitFor();
  await page.getByText('Try one useful task: a phone expense', { exact: true }).click();
  await page.screenshot({ path: artifacts + 'landing-desktop.png', fullPage: true });
  await button('Try sample CSV').click();
  await page.getByText('$1,374.12 net', { exact: true }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 20);
  await page.getByRole('checkbox', { name: /Sunrise Mobile Services/ }).check();
  await page.getByLabel('Expense category', { exact: true }).selectOption('phone');
  await button('Review selected spending').click();
  assert.equal(await page.getByLabel('Amount paid (AUD)', { exact: true }).inputValue(), '45');
  await page.getByLabel('Work use (%)', { exact: true }).fill('40');
  await page.getByLabel('Was Sarah reimbursed?', { exact: true }).selectOption('none');
  await page.getByLabel('Supporting evidence', { exact: true }).selectOption('missing');
  await button('Save expense').click();
  await page.getByText('$18.00 recorded work portion', { exact: true }).waitFor();
  const downloadEvent = page.waitForEvent('download');
  await button('Download report (HTML)').click();
  const download = await downloadEvent;
  await download.saveAs(artifacts + 'preparation-report.html');
  const report = readFileSync(artifacts + 'preparation-report.html', 'utf8');
  assert.ok(report.includes('Sunrise Mobile Services'));
  assert.ok(report.includes('$18.00'));
  assert.ok(report.includes('Evidence missing'));
  await button('Save progress').click();
  await page.reload(); await button('Guided example').click(); await button('Resume saved progress').click();
  await page.getByText('$18.00 recorded work portion', { exact: true }).waitFor();
  await page.locator('#guided-demo').screenshot({ path: artifacts + 'summary-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: artifacts + 'summary-mobile.png', fullPage: true });
  await button('Delete saved progress').click();
  await button('Restart demo').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('taxprep-au:preparation-progress')), null);
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  const documents = await verifyDocuments(context, base, artifacts);
  const statements = await verifyStatements(context, base, artifacts);
  const payslips = await verifyPayslips(context, base, artifacts);
  const result = { payslips, statements, documents, url: base.href, checkedAt: new Date().toISOString(), health: true, missingApiRoute404: true,
    sampleRows: 20, workPortion: 18, reportDownloaded: true, selectedSourcesIncluded: true,
    saveRefreshResume: true, clearProgress: true, mobileOverflow: false, errors, failedRequests };
  writeFileSync(artifacts + 'report.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
