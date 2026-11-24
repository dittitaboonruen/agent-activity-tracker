import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1300,height:850},acceptDownloads:true});
const errors=[];
page.on('pageerror',err=>errors.push(String(err.message)));
page.on('dialog',async dialog=>{errors.push('Dialog: '+dialog.message());await dialog.dismiss()});
await page.route('**/api/legacy-prestige-rpu?**',async route=>{
 const q=new URL(route.request().url()).searchParams;
 const age=Number(q.get('age')),term=Number(q.get('term')),sum=Number(q.get('sum'));
 const rows=Array.from({length:99-age},(_,i)=>({
   age:age+i,policyYear:i+1,
   surrender:i===1?120000:null,
   paidUp:i===1?720000:null,
   rpuStatus:i===1?'VERIFIED':i>=term-1?'OUTSIDE_SOURCE_RANGE':'UNAVAILABLE',
   cvEvidence:i===1?'MANUAL_PUBLISHED':'UNAVAILABLE'
 }));
 await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({gender:q.get('gender'),issueAge:age,sum,term,rows,cvExactCaseSource:null})});
});
try{
 await page.goto('http://127.0.0.1:8787/illustrations/royal_partners_illustration_tool.html?plan=legacy',
   {waitUntil:'domcontentloaded',timeout:40000});
 assert.deepEqual(errors,[],'browser page must initialize without JavaScript errors');
 assert.equal(await page.locator('.tab[data-id="legacy"]').getAttribute('aria-pressed'),'true');
 await page.locator('#in-age').fill('35');
 await page.locator('#in-gender').selectOption('หญิง');
 await page.locator('#in-sum').fill('15000000');
 await page.locator('#legacy-term').selectOption('15');
 await page.locator('[data-legacy-table="B"]').click();
 await page.waitForFunction(()=>{
   const r=document.querySelector('#legacy-table-B tbody tr:nth-child(2)');
   return r?.cells?.[1]?.textContent?.trim()==='120,000'
     &&r?.cells?.[2]?.textContent?.trim()==='720,000';
 },null,{timeout:20000});
 assert.equal(await page.locator('#legacy-calculator-code').count(),0);
 assert.equal(await page.locator('#legacy-calculator-submit').count(),0);
 assert.equal(await page.locator('a[href="/login"]').count(),0);
 await page.locator('.btn-export').click();
 assert.equal(await page.locator('.rp-preview-legacy-zoom').count(),0,'Legacy zoom button removed');
 const pages=page.locator('.rp-preview-fit-paper .legacy-report-page');
 assert.equal(await pages.count(),5,'female age 35 / 15 Pay V3 report must use exactly five A4 pages');
 const titles=await pages.locator('.legacy3-heading').allInnerTexts();
 assert.ok(titles.some(x=>x.includes('ตาราง A'))&&titles.some(x=>x.includes('ตาราง B')));
 const aRows=await page.locator('.rp-preview-pdf-source .legacy-report-page .legacy3-table-full').nth(0).locator('tbody tr').count();
 assert.equal(aRows,32,'Table A must fit 32 complete years on first page');
 const wpciTitles=await page.locator('.rp-preview-pdf-source .legacy-v3-wpci-title').count();
 const wpciItems=await page.locator('.rp-preview-pdf-source .legacy-v3-wpci-group li').count();
 assert.equal(wpciTitles,6,'WPCI six groups must be present');
 assert.equal(wpciItems,44,'WPCI 44 disease/treatment names must be present');
 assert.equal(await pages.last().locator('.rp-resource-card[data-resource-type="brochure"]').count(),1);
 assert.equal(await pages.last().locator('.rp-resource-card[data-resource-type="payment"]').count(),1);
 const labels=await pages.first().locator('.legacy3-years span').allInnerTexts();
 assert.deepEqual(labels,Array.from({length:20},(_,i)=>String(i+1)));
 const triangles=await pages.first().locator('.legacy3-tris span').allInnerTexts();
 assert.equal(triangles.filter(v=>v==='▲').length,15);
 const overflow=await pages.evaluateAll(items=>items.map(p=>{
   const paper=p.getBoundingClientRect(),body=p.querySelector('.legacy3-body')?.getBoundingClientRect();
   return !!body&&body.bottom>paper.bottom-5;
 }));
 assert.equal(overflow.includes(true),false,'no PDF page overflow');
 const downloadButton=page.locator('.rp-preview-download-pdf');
 const [download]=await Promise.all([
   page.waitForEvent('download',{timeout:90000}),
   downloadButton.click(),
 ]);
 assert.ok(download.suggestedFilename().toLowerCase().endsWith('.pdf'));
 const pdfPath=await download.path();
 const pdfBytes=await readFile(pdfPath);
 assert.ok(pdfBytes.byteLength>10000,'generated PDF is not empty or suspiciously small');
 assert.equal(pdfBytes.subarray(0,5).toString('latin1'),'%PDF-','download must be a real PDF');
 assert.match(pdfBytes.subarray(-2048).toString('latin1'),/%%EOF/,'PDF must include end-of-file marker');
 execFileSync('python3',['scripts/legacy_pdf_a4_verify.py',pdfPath],{stdio:'inherit',timeout:120000});
 // Close the print-preview overlay before exercising original plan tabs.
 // Reload preserves the same release code, but resets the modal to its normal closed state.
 await page.reload({waitUntil:'domcontentloaded'});
 // Non-Legacy regression: all pre-existing tabs must remain navigable
 // after Legacy Table B, preview, and PDF operations in the same session.
 const nonLegacyTabs=await page.locator('.tab[data-id]:not([data-id="legacy"])')
   .evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-id')).filter(Boolean));
 assert.ok(nonLegacyTabs.length>=3,'legacy must not remove original calculator tabs');
 for(const tabId of nonLegacyTabs){
   const tab=page.locator('.tab[data-id="'+tabId+'"]');
   await tab.click();
   assert.equal(await tab.getAttribute('aria-pressed'),'true',
     'original plan remains selectable: '+tabId);
   assert.deepEqual(errors,[],'switching to original plan must not throw: '+tabId);
 }
 await page.locator('.tab[data-id="legacy"]').click();
 assert.equal(await page.locator('.tab[data-id="legacy"]').getAttribute('aria-pressed'),'true',
   'Legacy remains reachable after switching back from original plans');
 assert.deepEqual(errors,[],'no browser runtime errors or PDF alerts');
 console.log('PASS: Legacy V3 5-page A4, WPCI 44, brochure and payment promo, real PDF');
}finally{
 await browser.close();
}
