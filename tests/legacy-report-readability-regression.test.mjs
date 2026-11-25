import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const section=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert.ok(a>=0&&b>a,'required code boundary');
 return html.slice(a,b);
};
const pdf=section('function buildLegacyReportHTML(){','async function downloadLegacyReportPDF(');
const preview=section('function showReportPreview(key){','async function downloadLegacyReportPDF(');
test('Legacy PDF improves readability without changing report source rows',()=>{
 for(const rule of ['.legacy3-stat strong{display:block;font-size:18px',
   '.legacy3-table-full td{font-size:12.5px',
   '.legacy3-heading{font-size:16px',
   '.legacy3-page-note,.legacy-report-page .legacy3-note{font-size:11.5px']){
   assert.ok(pdf.includes(rule),rule);
 }
 assert.match(pdf,/const rowsPerPage=28/);
 assert.match(pdf,/groupsOf\(allYears,rowsPerPage\)/);
 assert.match(pdf,/paid:a\.paid,taxRelief:a\.taxRelief,policy:/);
 assert.match(pdf,/renderNum\(r\.policy\?\.surrender,'cv'\)/);
 assert.match(pdf,/renderNum\(r\.policy\?\.paidUp,'rpu'\)/);
 assert.match(pdf,/wpciCount!==44/);
 assert.match(pdf,/buildBrochureSlot\('legacy'/);
 assert.match(pdf,/buildPaymentCard\(GLOBAL_REPORT_PAYMENT,true\)/);
 assert.match(pdf,/legacy-v4-table th\{padding:5px 2px;font-size:9\.5px/);
 assert.match(pdf,/โปรดตรวจสอบกับบริษัทประกันภัยอีกครั้ง/);
});
test('Legacy V4 preview uses auto fit only while PDF source remains unscaled',()=>{
 assert.doesNotMatch(preview,/rp-preview-legacy-zoom/);
 assert.doesNotMatch(preview,/legacyZoomFull/);
 assert.match(preview,/const scale = Math.min\(1, availableWidth \/ reportWidth\)/);
 assert.match(preview,/const visualReport = pdfSource\.cloneNode\(true\)/);
 assert.match(preview,/host\.insertBefore\(pdfSource,host\.firstChild\)/);
});
