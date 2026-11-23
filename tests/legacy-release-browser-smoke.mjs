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
 const button=page.locator('.rp-preview-legacy-zoom');
 await button.waitFor({timeout:25000});
 await button.click();
 assert.equal(await button.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('.rp-preview-fit-paper').evaluate(el=>el.style.transform),'scale(1)');
 await button.click();
 assert.equal(await button.getAttribute('aria-pressed'),'false');
 const pages=page.locator('.rp-preview-fit-paper .legacy-report-page');
 assert.ok(await pages.count()>=4,'report includes annual Table A/B pages');
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
 assert.deepEqual(errors,[],'no browser runtime errors or PDF alerts');
 console.log('PASS: anonymous Legacy A/B, zoom toggle, A4 and real PDF download');
}finally{
 await browser.close();
}
