import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1365,height:850},acceptDownloads:true});
const errors=[];
const qaDir=path.join(os.tmpdir(),'legacy-prestige-qa');
fs.mkdirSync(qaDir,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',async d=>{errors.push('Dialog: '+d.message());await d.dismiss()});
const base='http://127.0.0.1:8787/illustrations/royal_partners_illustration_tool.html';
try {
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('.tab[data-id="legacy"]').click();
 await page.locator('#in-gender').selectOption('หญิง');
 await page.locator('#in-age').fill('35');
 await page.locator('#in-sum').fill('15000000');
 const expected={10:['165,000','990,000','9','211'],15:['120,000','720,000','7','91'],20:['105,000','630,000','6','156']};
 for (const term of [10,15,20]) {
   await page.locator('#legacy-term').selectOption(String(term));
   await page.locator('[data-legacy-table="B"]').click();
   const table=page.locator('#legacy-table-B tbody tr');
   assert.equal(await table.first().locator('td').first().innerText(),'35','table B first age');
   assert.equal(await table.last().locator('td').first().innerText(),'98','table B last age');
   const cols=await table.nth(1).locator('td').allInnerTexts();
   assert.equal(cols[0],'36','year 2 issue age');
   assert.deepEqual([cols[1],cols[2],cols[4],cols[5]],expected[term],term+' Pay factor values');
   await page.locator('[data-legacy-table="A"]').click();
   const a=page.locator('#legacy-table-A tbody tr');
   assert.equal(await a.last().locator('td').first().innerText(),'98','table A last age');
   await page.locator('.btn-export').click();
   await page.locator('.legacy-report-page').first().waitFor({timeout:25000});
   const report=page.locator('.legacy3-table tbody tr').nth(1);
   const values=await report.locator('td').allInnerTexts();
   assert.equal(values[1],'36','report policy age');
   assert.equal(values[4],expected[term][0],'report cash value');
   assert.equal(values[5],expected[term][1],'report paid up');
   // Capture the exact Legacy preview for a manual typography/pagination review.
   await page.locator('.legacy-report-page').first().screenshot({path:path.join(qaDir,`female-${term}-pay-report-page1.png`)});
   // Exercise the real app PDF button, not Playwright's generic print-to-PDF.
   if(term===20){
     const downloading=page.waitForEvent('download',{timeout:120000});
     await page.locator('.rp-preview-download-pdf').click();
     const file=await downloading;
     const target=path.join(qaDir,'legacy-female-20-pay-actual-export.pdf');
     await file.saveAs(target);
     assert.equal(fs.readFileSync(target).subarray(0,5).toString(),'%PDF-');
     assert.ok(fs.statSync(target).size>10000,'Legacy PDF should contain rendered pages');
     console.log('PASS: real Legacy PDF download, '+fs.statSync(target).size+' bytes');
   }
   await page.locator('.rp-preview-close').first().click();
   console.log('PASS: female '+term+' Pay - Table A/B and report matching');
 }
 // Check that all non-Legacy product tabs still render without page errors.
 for(const product of await page.locator('.tab[data-id]').evaluateAll(els=>els.map(e=>e.dataset.id).filter(id=>id!=='legacy'))) {
   await page.locator('.tab[data-id="'+product+'"]').click();
   assert.ok(await page.locator('#app .panel').count()>0,'missing product panel '+product);
   console.log('PASS: non-Legacy product renders '+product);
 }
 assert.deepEqual(errors,[],'uncaught browser errors');
 console.log('QA evidence files: '+qaDir);
 console.log('PASS: all Legacy/browser smoke checks completed');
} finally {await browser.close()}
