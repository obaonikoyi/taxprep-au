/*
 * Renders every workspace in a real browser, in both colour schemes, and
 * checks the things the stylesheets are responsible for: no console errors,
 * the shared design tokens actually resolving, one emphasised figure per
 * metric row, no duplicated page heading, and no horizontal scroll on a
 * phone. Needs no backend — the workspaces it touches all run locally.
 *
 * Run it with `npm run test:ui`, not by calling this file directly: it
 * launches Vite itself and so never triggers `predev`, and the payslip
 * reader needs the browser PDF worker that `prepare-document-assets` copies
 * into the gitignored public/document-engine/. Without it pdf.js silently
 * falls back to a fake worker and the example never finishes loading. The
 * `pretest:ui` script covers that.
 *
 * Set CHROMIUM_PATH to use a preinstalled browser instead of Playwright's
 * own download.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');
const kids = [];
async function ready(u){for(let i=0;i<150;i++){try{if((await fetch(u)).ok)return}catch{}await new Promise(r=>setTimeout(r,200))}throw Error('vite not ready')}
(async () => {
  const vite = spawn(process.execPath,[root+'/src/frontend/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5202'],{cwd:root+'/src/frontend',stdio:['ignore','ignore','pipe']});
  kids.push(vite); vite.stderr.on('data',b=>process.stderr.write(b));
  await ready('http://127.0.0.1:5202');
  const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),args:['--no-sandbox','--disable-dev-shm-usage']});
  // What each scheme actually paints, so a dark palette that silently stops
  // applying cannot pass as "dark: OK".
  const painted = {};
  for (const scheme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width:1440,height:1000},colorScheme:scheme});
    const errs=[]; page.on('pageerror',e=>errs.push(String(e))); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await page.goto('http://127.0.0.1:5202');

    // Pay: load the fictional example, reach the summary, read the totals.
    // Gate on the summary heading, which only exists once the example has
    // finished loading. Do not gate on a figure: $8,815.00 is also printed on
    // the start screen's example-preview card, so waiting for it passes
    // immediately and the assertions below then race the six-PDF read.
    // That read is in-browser pdf.js and is far slower on a cold CI runner
    // than on a warm dev machine, so it gets a generous budget.
    await page.getByRole('button',{name:'Try example payslips'}).click();
    await page.getByRole('heading',{name:'Your pay at a glance'}).waitFor({timeout:120000});
    await page.getByText('$10,450.00').first().waitFor({timeout:15000});
    // The emphasised figure is marked once, by class, not by position.
    assert.equal(await page.locator('.statement-metrics .metric-feature').count(), 1, 'exactly one emphasised metric');
    // Chart series colours resolve to a real colour, not an unset var().
    const stroke = await page.locator('.pay-chart svg line[stroke-width="3"]').first().evaluate(el => getComputedStyle(el).stroke);
    assert.match(stroke, /^rgb\(/, `series stroke resolved: ${stroke}`);
    // Switch charts.
    for (const tab of ['Tax','Super']) { await page.getByRole('button',{name:tab,exact:true}).click(); await page.waitForTimeout(250) }
    // Gated next-step sections say why they are waiting.
    await page.getByText('Choose a year and employer').waitFor();
    // Review stage.
    await page.getByRole('button',{name:'Check figures'}).click();
    await page.getByRole('heading',{name:'Check your figures'}).waitFor();
    assert.ok(await page.locator('.pay-history button').count() >= 6, 'payslip list rendered');

    // Every workspace renders.
    for (const [tab, heading] of [['Bank spending','Your statements, made clear.'],
                                  ['Tax documents','From documents to one evidence list.'],
                                  ['Guided example','Turn expense details into a clear checklist.']]) {
      await page.getByRole('button',{name:tab,exact:true}).click();
      await page.getByRole('heading',{name:heading}).waitFor({timeout:60000});
    }
    // The shell supplies one page-level heading, not two stacked heroes.
    await page.getByRole('button',{name:'Tax documents',exact:true}).click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('main h1').count(), 0, 'documents workspace has no duplicate hero h1');

    painted[scheme] = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.deepEqual(errs, [], `console/page errors (${scheme})`);
    console.log(`  ${scheme}: OK`);
    await page.close();
  }
  assert.notEqual(painted.light, painted.dark, `the two schemes paint different pages (both ${painted.light})`);

  // The header switch overrides the device, and the choice is remembered.
  // Emulate a device set to dark, then ask for light: a user on a dark laptop
  // must be able to read a page of figures in light.
  const t = await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});
  await t.goto('http://127.0.0.1:5202');
  const scheme = () => t.locator('html').getAttribute('data-theme');
  const pageColour = () => t.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await scheme(), 'dark', 'a device set to dark opens dark');
  const darkPage = await pageColour();
  await t.getByRole('button',{name:'Light',exact:true}).click();
  const lightPage = await pageColour();
  assert.equal(await scheme(), 'light', 'choosing Light overrides the device');
  assert.notEqual(lightPage, darkPage, `choosing Light repaints the page (still ${lightPage})`);
  await t.reload();
  assert.equal(await scheme(), 'light', 'the choice survives a reload on a dark device');
  assert.equal(await pageColour(), lightPage, 'and the page comes back light');
  console.log('  theme switch: OK');
  await t.close();

  // Nav fits without horizontal page scroll at phone width.
  const m = await browser.newPage({viewport:{width:390,height:800}});
  await m.goto('http://127.0.0.1:5202'); await m.waitForTimeout(800);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `no horizontal page scroll at 390px (overflow ${overflow}px)`);
  assert.equal(await m.locator('.workspace-nav button').count(), 4, 'all four tabs present at phone width');
  console.log('  mobile: OK');
  await browser.close(); kids.forEach(k=>k.kill('SIGTERM'));
  console.log('\nAll render checks passed.');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); kids.forEach(k=>k.kill('SIGTERM')); process.exit(1) });
