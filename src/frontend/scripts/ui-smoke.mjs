/*
 * Renders every workspace in a real browser, in both colour schemes, and
 * checks the things the stylesheets are responsible for: no console errors,
 * the shared design tokens actually resolving, one emphasised figure per
 * metric row, no duplicated page heading, and no horizontal scroll on a
 * phone. Needs no backend — the workspaces it touches all run locally.
 *
 * Run with `npm run test:ui`. Set CHROMIUM_PATH to use a preinstalled
 * browser instead of Playwright's own download.
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
  for (const scheme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width:1440,height:1000},colorScheme:scheme});
    const errs=[]; page.on('pageerror',e=>errs.push(String(e))); page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
    await page.goto('http://127.0.0.1:5202');

    // Pay: load the fictional example, reach the summary, read the totals.
    await page.getByRole('button',{name:'Try example payslips'}).click();
    await page.getByText('$8,815.00').first().waitFor({timeout:30000});
    await page.getByText('$10,450.00').first().waitFor();
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
      await page.getByRole('heading',{name:heading}).waitFor({timeout:20000});
    }
    // The shell supplies one page-level heading, not two stacked heroes.
    await page.getByRole('button',{name:'Tax documents',exact:true}).click();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('main h1').count(), 0, 'documents workspace has no duplicate hero h1');

    assert.deepEqual(errs, [], `console/page errors (${scheme})`);
    console.log(`  ${scheme}: OK`);
    await page.close();
  }
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
