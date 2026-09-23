/*
 * Is the user-test kit still going to do what the test says it does?
 *
 * The materials were built for Milestone 18 and the app has not stopped moving
 * since. This drives the kit through a real browser exactly as a participant
 * would and checks the two routes still end where the design document says they
 * end. Run it before the next participant, not in front of them.
 *
 *   npm run test:user-kit                      # against the live site
 *   DEMO_URL=http://127.0.0.1:5199 npm run test:user-kit
 *
 * CHROMIUM_PATH uses a browser that is already installed.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KIT = fileURLToPath(new URL('../../../sample-data/user-test/files/', import.meta.url));
const base = new URL(process.env.DEMO_URL ?? 'https://xobapaycheck.com');
const EXPECTED = {
  employer: 'Kestrel Example Hospitality',
  period: '2026-08-12 to 2026-08-25',
  paid: '30.75', agreed: '32.50', gap: '1.75', total: '108.50',
  layout: 'PAY ADVICE v3',
};

for (const name of ['contract.pdf', 'payslip-1.pdf', 'payslip-2.pdf', 'payslip-3.pdf', 'payslip-4.pdf'])
  assert.ok(existsSync(KIT + name), `${name} is missing — run: python3 sample-data/user-test/generate_kit.py`);

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = [];
page.on('pageerror', e => problems.push(`page error: ${e.message}`));
const button = name => page.getByRole('button', { name });

try {
  await page.goto(base.href);
  await button('My pay').click();

  // A participant drops all four in at once and does not rename anything.
  await page.getByLabel('Choose payslips or photos', { exact: true })
    .setInputFiles([1, 2, 3, 4].map(i => `${KIT}payslip-${i}.pdf`));
  await page.getByRole('heading', { name: 'Check your figures' }).waitFor({ timeout: 120000 });

  // Nothing may need retyping. The moment it does, the test is measuring data
  // entry rather than whether anybody can find the short fortnight.
  for (let i = 1; i <= 4; i++) {
    const layout = await page.locator('.pay-source-name').innerText();
    assert.match(layout, new RegExp(EXPECTED.layout), `payslip ${i} is no longer read as ${EXPECTED.layout}: ${layout}`);
    const confirm = button('Confirm and continue');
    assert.equal(await confirm.isDisabled(), false, `payslip ${i} cannot be confirmed without a correction`);
    await confirm.click();
    await page.waitForTimeout(250);
  }

  // Route A: the app raises the rate change with no contract involved.
  const beforeContract = await page.locator('body').innerText();
  assert.match(beforeContract, new RegExp(`\\$${EXPECTED.paid}`), 'route A no longer raises the rate change unprompted');
  assert.match(beforeContract, new RegExp(`\\$${EXPECTED.gap} an hour`), 'route A no longer states the per-hour difference');

  // Route B: the participant reads the contract and records the agreed rate.
  const panel = page.getByRole('region', { name: 'Pay rate checks' });
  await button('Add a pay rate').click();
  await panel.getByLabel('Employer').fill(EXPECTED.employer);
  await panel.getByLabel('Hourly rate (AUD)').fill(EXPECTED.agreed);
  await panel.getByLabel('This rate started').fill('2026-07-01');
  await panel.getByLabel('Where this came from').selectOption({ index: 0 });
  await panel.getByRole('button', { name: /^(Save|Record|Add)/ }).last().click();
  await page.waitForTimeout(600);

  const found = await panel.innerText();
  assert.match(found, new RegExp(`\\$${EXPECTED.gap} an hour below what you recorded`), 'route B no longer states the difference against the recorded rate');
  assert.match(found, new RegExp(`\\$${EXPECTED.total}`), `route B no longer reaches $${EXPECTED.total}`);
  assert.match(found, new RegExp(EXPECTED.period), 'route B no longer names the fortnight');
  assert.ok(await page.getByRole('button', { name: /Copy message/i }).count() > 0, 'there is no message to send payroll');

  assert.deepEqual(problems, [], 'the page logged errors');
  console.log(JSON.stringify({
    kit: 'ready', url: base.href, layout: EXPECTED.layout,
    noCorrectionsNeeded: true, routeA: true, routeB: true,
    question: `$${EXPECTED.gap} an hour below the recorded $${EXPECTED.agreed}, or $${EXPECTED.total} over ${EXPECTED.period}`,
  }, null, 2));
} catch (error) {
  console.error('THE KIT IS NOT READY. Do not run a participant until this passes.\n');
  throw error;
} finally {
  await browser.close();
}
