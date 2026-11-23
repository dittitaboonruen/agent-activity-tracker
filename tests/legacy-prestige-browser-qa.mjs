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
// Internal QA-only HTTP fixture: derived from exact verified 2025 manual cells.
// Only the selected policy-year-2 values are represented; NO raw factor table.
await page.route('**/api/legacy-prestige-rpu?**',async route=>{
 const query=new URL(route.request().url()).searchParams;
 const age=Number(query.get('age')),term=Number(query.get('term'));
 const sum=Number(query.get('sum')),gender=query.get('gender');
 let cv=null,rpu=null;
 if(gender==='F'&&age===35&&sum===15000000){
   const expected={10:[165000,990000],15:[120000,720000],20:[105000,630000]}[term];
   if(expected){[cv,rpu]=expected;}
 }else if(gender==='M'&&age===40&&term===10&&sum===20000000){
   cv=320000;rpu=1280000;
 }else if(gender==='M'&&age===35&&term===20&&sum===10000000){
   cv=80000;rpu=390000;
 }
 const rows=Array.from({length:99-age},(_,i)=>({
   age:age+i,policyYear:i+1,surrender:i===1?cv:null,paidUp:i===1?rpu:null
 }));
 await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({gender,issueAge:age,sum,term,rows})});
});
const waitForTableB=async expected=>page.waitForFunction(value=>{
 const tr=document.querySelector('#legacy-table-B tbody tr:nth-child(2)');
 return !!tr&&tr.cells[2]?.textContent?.trim()===value&&
  !!document.querySelector('#legacy-table-B .legacy-values-reference strong')
    ?.textContent?.includes('คำนวณ CV/RPU อัตโนมัติจาก');
},expected,{timeout:15000});
try {
 await page.goto(base+'?plan=legacy',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(await page.locator('.tab[data-id="legacy"]').getAttribute('aria-pressed'),'true','direct link selects Legacy without dashboard login');
 await page.locator('#in-gender').selectOption('หญิง');
 await page.locator('#in-age').fill('35');
 await page.locator('#in-sum').fill('15000000');
 const expected={10:['165,000','990,000'],15:['120,000','720,000'],20:['105,000','630,000']};
 for (const term of [10,15,20]) {
   await page.locator('#legacy-term').selectOption(String(term));
   await page.locator('[data-legacy-table="B"]').click();
   const table=page.locator('#legacy-table-B tbody tr');
   assert.equal(await table.first().locator('td').first().innerText(),'35','table B first age');
   assert.equal(await table.last().locator('td').first().innerText(),'98','table B last age');
   await waitForTableB(expected[term][1]);
   const cols=await table.nth(1).locator('td').allInnerTexts();
   assert.equal(cols[0],'36','year 2 issue age');
   assert.equal(cols.length,3,'Table B shows ONLY age, CV and RPU');
   assert.deepEqual([cols[1],cols[2]],expected[term],term+' Pay CV/RPU values');
   // Visual-contract QA: the original year 1..20 indicators and gold triangles stay visible.
   const visual=await page.locator('.legacy-graphic').evaluate(root=>{
     const yearLabels=[...root.querySelectorAll('.legacy-graphic-grid span')].map(n=>n.textContent.trim());
     const choices=[...root.querySelectorAll('.legacy-graphic-option')].map(option=>({
       selected:option.classList.contains('selected'),
       ticks:[...option.querySelectorAll('.legacy-graphic-ticks span')].map(n=>n.textContent.trim())
     }));
     return {yearLabels,choices};
   });
   assert.deepEqual(visual.yearLabels,Array.from({length:20},(_,i)=>String(i+1)),'calculator must show years 1..20');
   assert.equal(visual.choices.length,3,'10/15/20 Pay options remain visible');
   for(const [index,pay] of [10,15,20].entries()){
     assert.equal(visual.choices[index].ticks.length,20,'20 triangle positions for '+pay+' Pay');
     assert.equal(visual.choices[index].ticks.filter(x=>x==='▲').length,pay,'paid-year triangles for '+pay+' Pay');
     assert.equal(visual.choices[index].selected,pay===term,'selected payment term must be highlighted');
   }
   if(term===20) await page.locator('.legacy-graphic').screenshot({
     path:path.join(qaDir,'legacy-calculator-year-triangles.png')});
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
   assert.equal(values.length,6,'report removed ETI');
   const pdfLayout=await page.locator('.legacy-report-page').first().evaluate(root=>{
     const years=[...root.querySelectorAll('.legacy3-years span')].map(n=>n.textContent.trim());
     const triangles=[...root.querySelectorAll('.legacy3-tris span')].map(n=>n.textContent.trim());
     const color=getComputedStyle(root.querySelector('.legacy3-tris span')).color;
     return {years,triangles,color};
   });
   assert.deepEqual(pdfLayout.years,Array.from({length:20},(_,i)=>String(i+1)),'PDF must show years 1..20');
   assert.equal(pdfLayout.triangles.length,20,'PDF must preserve 20 triangle positions');
   assert.equal(pdfLayout.triangles.filter(x=>x==='▲').length,term,'PDF highlighted paid-year triangles');
   assert.ok(pdfLayout.color.startsWith('rgb('),'PDF triangle color must be rendered');
   const overflow=await page.locator('.legacy-report-page').evaluateAll(pages=>pages.map((p,i)=>{
     const root=p.getBoundingClientRect();
     const body=p.querySelector('.legacy3-body');
     const rect=body?.getBoundingClientRect();
     return {page:i+1,overflow:!!rect&&rect.bottom>root.bottom-6};
   }));
   assert.deepEqual(overflow.filter(p=>p.overflow),[],'PDF content must not overflow page bounds');
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
 // Signed-link flow: grant is redeemed automatically; no dashboard or typed code.
 const linkPage=await browser.newPage({viewport:{width:1100,height:800}});
 let grantRedeemed=false;
 try{
   await linkPage.route('**/api/legacy-prestige-link?**',async route=>{
     grantRedeemed=true;
     await route.fulfill({status:303,headers:{
       'location':'/illustrations/royal_partners_illustration_tool.html?plan=legacy',
       'set-cookie':'__Host-rp_legacy_access=qa-signed-link-fixture; Path=/; HttpOnly; SameSite=Strict',
       'cache-control':'no-store'
     },body:''});
   });
   await linkPage.route('**/api/legacy-prestige-rpu?**',async route=>{
     const hasGrant=grantRedeemed; // fixture of server-side authorization after valid grant
     if(!hasGrant){
       await route.fulfill({status:401,contentType:'application/json',
         body:JSON.stringify({error:'authentication_required'})});
       return;
     }
     const q=new URL(route.request().url()).searchParams;
     const age=Number(q.get('age')),term=Number(q.get('term'));
     const rows=Array.from({length:99-age},(_,i)=>({
       age:age+i,policyYear:i+1,surrender:i===1?105000:null,paidUp:i===1?630000:null
     }));
     await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
       gender:q.get('gender'),issueAge:age,sum:Number(q.get('sum')),term,rows
     })});
   });
   await linkPage.goto('http://127.0.0.1:8787/api/legacy-prestige-link?grant=qa-fixture',{
     waitUntil:'domcontentloaded',timeout:45000});
   assert.ok(!linkPage.url().includes('grant='),'grant removed from browser URL');
   assert.equal(await linkPage.locator('.tab[data-id="legacy"]').getAttribute('aria-pressed'),'true');
   await linkPage.locator('#in-age').fill('35');
   await linkPage.locator('#in-gender').selectOption('หญิง');
   await linkPage.locator('#in-sum').fill('15000000');
   await linkPage.locator('#legacy-term').selectOption('20');
   await linkPage.waitForFunction(()=>{
     const row=document.querySelector('#legacy-table-B tbody tr:nth-child(2)');
     return row?.cells?.[1]?.textContent?.trim()==='105,000';
   },null,{timeout:20000});
   assert.equal(await linkPage.locator('#legacy-calculator-code').count(),0,
     'valid signed link must show Table B automatically with no passcode prompt');
   console.log('PASS: authorized signed link auto-opens Table B; no typed code/login');
 }finally{await linkPage.close();}
 // Direct-link + calculator-only code: independent of Supabase dashboard sessions.
 // These are isolated browser fixtures, not a claim of live protected-preview access.
 const accessPage=await browser.newPage({viewport:{width:1100,height:800}});
 let calculatorAuthorized=false, calculatorCodePosts=0, calculatorTableGets=0;
 try{
   await accessPage.route('**/api/legacy-prestige-access',async route=>{
     calculatorCodePosts++;
     assert.equal(route.request().method(),'POST');
     const body=route.request().postDataJSON();
     calculatorAuthorized=body.code==='QA-only-valid-calculator-code-12345';
     await route.fulfill({status:calculatorAuthorized?200:401,contentType:'application/json',
       body:JSON.stringify({ok:calculatorAuthorized})});
   });
   await accessPage.route('**/api/legacy-prestige-rpu?**',async route=>{
     calculatorTableGets++;
     if(!calculatorAuthorized){
       await route.fulfill({status:401,contentType:'application/json',
         body:JSON.stringify({error:'calculator_access_required'})});
       return;
     }
     const q=new URL(route.request().url()).searchParams;
     const age=Number(q.get('age')),term=Number(q.get('term'));
     const rows=Array.from({length:99-age},(_,i)=>({age:age+i,policyYear:i+1,
       surrender:i===1?105000:null,paidUp:i===1?630000:null}));
     await route.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({gender:q.get('gender'),issueAge:age,sum:Number(q.get('sum')),term,rows})});
   });
   await accessPage.goto(base+'?plan=legacy',{waitUntil:'domcontentloaded',timeout:45000});
   assert.equal(await accessPage.locator('.tab[data-id="legacy"]').getAttribute('aria-pressed'),'true');
   await accessPage.locator('#in-age').fill('35');
   await accessPage.locator('#in-gender').selectOption('หญิง');
   await accessPage.locator('#in-sum').fill('15000000');
   await accessPage.locator('#legacy-term').selectOption('20');
   await accessPage.locator('#legacy-calculator-code').waitFor({timeout:20000});
   assert.equal(await accessPage.locator('a[href="/login"]').count(),0,
     'direct calculator does not require dashboard login');
   await accessPage.locator('#legacy-calculator-code').fill('QA-only-valid-calculator-code-12345');
   await accessPage.locator('#legacy-calculator-submit').click();
   await accessPage.waitForFunction(()=>{
     const row=document.querySelector('#legacy-table-B tbody tr:nth-child(2)');
     return row?.cells?.[1]?.textContent?.trim()==='105,000' &&
       row?.cells?.[2]?.textContent?.trim()==='630,000';
   },null,{timeout:20000});
   assert.equal(calculatorCodePosts,1,'separate calculator code issued once');
   assert.ok(calculatorTableGets>=2,'Table B retried after calculator authorization');
   console.log('PASS: direct link + calculator-only access code + Table B, no dashboard login');
 } finally {await accessPage.close();}
 // Male Table B must update automatically on changes without any upload.
 // Only exact publicly documented cases have published cash values.
 await page.locator('#in-gender').selectOption('ชาย');
 await page.locator('#in-age').fill('40');
 await page.locator('#in-sum').fill('20000000');
 await page.locator('#legacy-term').selectOption('10');
 await page.locator('[data-legacy-table="B"]').click();
 await waitForTableB('1,280,000');
 let maleCells=await page.locator('#legacy-table-B tbody tr').nth(1).locator('td').allInnerTexts();
 assert.equal(maleCells[0],'41');
 assert.equal(maleCells[1],'320,000','exact brochure CV auto lookup');
 assert.equal(maleCells[2],'1,280,000','authorized male RPU updates automatically');
 assert.equal(maleCells.length,3,'Male Table B has only age, CV, RPU');
 assert.equal(await page.locator('#legacy-factor-upload').count(),0,'no file upload required');
 assert.equal(await page.locator('.legacy-local-demo').count(),0,'synthetic demo hidden');
 await page.locator('#in-age').fill('35');
 await page.locator('#in-sum').fill('10000000');
 await page.locator('#legacy-term').selectOption('20');
 await page.locator('[data-legacy-table="B"]').click();
 await waitForTableB('390,000');
 maleCells=await page.locator('#legacy-table-B tbody tr').nth(1).locator('td').allInnerTexts();
 assert.equal(maleCells[1],'80,000','male age35/20 Pay cash value updates from matching case');
 assert.equal(maleCells[2],'390,000','male age35/20 Pay RPU updates from matching case');
 console.log('PASS: male table B updates automatically without uploads, no cross-case guessing');
 // Check that all non-Legacy product tabs still render without page errors.
 for(const product of await page.locator('.tab[data-id]').evaluateAll(els=>els.map(e=>e.dataset.id).filter(id=>id!=='legacy'))) {
   await page.locator('.tab[data-id="'+product+'"]').click();
   assert.ok(await page.locator('#app .panel').count()>0,'missing product panel '+product);
   console.log('PASS: non-Legacy product renders '+product);
 }
 // Simulate independent users sharing the same application simultaneously.
 // Each page has its own isolated browser context and input state.
 const parallelCases=[
   {gender:'ชาย',age:'35',sum:'20000000',term:'20',premium:'460,200'},
   {gender:'ชาย',age:'40',sum:'20000000',term:'10',premium:'960,800'},
   {gender:'หญิง',age:'35',sum:'15000000',term:'20',premium:'322,500'},
   {gender:'หญิง',age:'35',sum:'20000000',term:'20',premium:'387,000'},
 ];
 await Promise.all(parallelCases.map(async c=>{
   const isolated=await browser.newPage({viewport:{width:1100,height:800}});
   try{
     await isolated.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
     await isolated.locator('.tab[data-id="legacy"]').click();
     await isolated.locator('#in-gender').selectOption(c.gender);
     await isolated.locator('#in-age').fill(c.age);
     await isolated.locator('#in-sum').fill(c.sum);
     await isolated.locator('#legacy-term').selectOption(c.term);
     const summary=isolated.locator('.summary .stat').filter({
       has:isolated.locator('.lbl', {hasText:'เบี้ยประกันภัยต่อปี (หลังส่วนลดทุน)'})
     });
     assert.equal(await summary.locator('.val').innerText(),c.premium,
       'isolated concurrent user '+JSON.stringify(c));
   }finally{await isolated.close();}
 }));
 console.log('PASS: 4 concurrent independent browser sessions, male and female premiums');
 assert.deepEqual(errors,[],'uncaught browser errors');
 console.log('QA evidence files: '+qaDir);
 console.log('PASS: all Legacy/browser smoke checks completed');
} finally {await browser.close()}
