import { chromium } from 'playwright';
import { verifyExpenses } from './expense-smoke.mjs';
import { verifyCsvExpenses } from './csv-expense-smoke.mjs';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');
const artifacts = root + '/test-results/browser';
mkdirSync(artifacts, { recursive: true });
const children = [];
const startApi = () => {
 const p=spawn(process.env.DOTNET_COMMAND || 'dotnet',[root+'/src/backend/TaxPrepAu.Api/bin/Release/net8.0/TaxPrepAu.Api.dll'],{cwd:root+'/src/backend/TaxPrepAu.Api',env:{...process.env,ASPNETCORE_ENVIRONMENT:'Development',ASPNETCORE_URLS:'http://127.0.0.1:5087'},stdio:['ignore','ignore','pipe']});
 p.stderr.on('data', b=>process.stderr.write(b));children.push(p);return p;
};
async function ready(url){for(let i=0;i<80;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Not ready: '+url);}
(async()=>{
 let browser;
 try {
  let api=startApi();
  const vite=spawn(process.execPath,[root+'/src/frontend/node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:root+'/src/frontend',stdio:['ignore','ignore','pipe']});children.push(vite);vite.stderr.on('data',b=>process.stderr.write(b));
  await ready('http://127.0.0.1:5087/api/health'); await ready('http://127.0.0.1:5173');
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');
  const expenseReport = await verifyExpenses(page, artifacts, {
    stopApi: async () => { const exited = new Promise(resolve => api.once('exit', resolve)); api.kill('SIGTERM'); await exited; },
    startApi: async () => { api = startApi(); await ready('http://127.0.0.1:5087/api/health'); },
  });
  await page.getByRole('heading',{name:'Review your transactions'}).scrollIntoViewIfNeeded();
  const uploadResponse=page.waitForResponse(r=>r.url().endsWith('/api/transactions/import-preview') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Try sample CSV'}).click();
  const result=await (await uploadResponse).json();
  assert.equal(result.transactions.length,20);assert.equal(result.netTotal,1374.12);assert.equal(result.errors.length,0);
  await page.getByText('$1,374.12 net',{exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),20);
  await page.locator('.transaction-upload').screenshot({path:artifacts+'/desktop.png'});
  await page.getByLabel('Transaction CSV',{exact:true}).setInputFiles({name:'mixed.csv',mimeType:'text/csv',buffer:Buffer.from('date,description,amount\n\n2026-02-30,Bad,-2\n2026-02-28,Good,0.10\n2026-03-01,Good,0.20')});
  await page.getByRole('button',{name:'Preview transactions'}).click();
  await page.getByText('$0.30 net',{exact:true}).waitFor();
  const rowError=await page.locator('.import-errors').innerText();console.log('Mixed-file error:',rowError);assert.match(rowError,/Row 3:/);
  await page.getByLabel('Transaction CSV',{exact:true}).setInputFiles({name:'duplicate.csv',mimeType:'text/csv',buffer:Buffer.from('date,description,amount,AMOUNT\n2026-01-01,Test,1,2')});
  await page.getByRole('button',{name:'Preview transactions'}).click();
  await page.getByText('Column headings must be unique.').waitFor();assert.equal(await page.locator('tbody tr').count(),0);
  // Real backend outage, followed by retry of the same selected sample.
  api.kill('SIGTERM');await new Promise(r=>api.once('exit',r));
  await page.getByRole('button',{name:'Try sample CSV'}).click();
  await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/unavailable|Could not reach/);
  api=startApi();await ready('http://127.0.0.1:5087/api/health');
  await page.getByRole('button',{name:'Preview transactions'}).click();await page.getByText('$1,374.12 net',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.getByRole('heading',{name:'Review your transactions'}).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.locator('.transaction-upload').screenshot({path:artifacts+'/mobile.png'});
  await page.getByRole('button',{name:'Clear preview'}).click();assert.equal(await page.locator('tbody tr').count(),0);
  const csvExpenses = await verifyCsvExpenses(page, artifacts);
  assert.equal(await page.locator('vite-error-overlay').count(),0);assert.deepEqual(errors,[]);
  const report={csvExpenses,expenses:expenseReport,sampleRows:20,netTotal:1374.12,partialRows:true,physicalRowNumbers:true,duplicateHeaders:true,realBackendRecovery:true,mobileWidth:390,horizontalOverflow:false,pageErrors:errors};
  writeFileSync(artifacts+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 } finally {if(browser)await browser.close();for(const p of children)p.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1;});
