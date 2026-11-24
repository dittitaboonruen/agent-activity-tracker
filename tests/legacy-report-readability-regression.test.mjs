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
 assert.match(pdf,/const rowsPerPage=20/);
 assert.match(pdf,/const y=Array.from\(\{length:20\}/);
 assert.match(pdf,/i<d\.term\?'▲':'·'/);
 assert.match(pdf,/const tableAChunks=groupsOf\(allYears,rowsPerPage\)/);
 assert.match(pdf,/const tableBChunks=groupsOf\(allYears,rowsPerPage\)/);
 assert.match(pdf,/const dash='—'/);
});
test('Legacy preview alone gets fit / 100 percent zoom; PDF source stays unscaled',()=>{
 assert.match(preview,/key==='legacy'\?'<button type="button" class="rp-preview-legacy-zoom"/);
 assert.match(preview,/key==='legacy' && legacyZoomFull \? 1/);
 assert.match(preview,/zoomBtn\.setAttribute\('aria-pressed'/);
 assert.match(preview,/const visualReport = pdfSource\.cloneNode\(true\)/);
 assert.match(preview,/host\.insertBefore\(pdfSource,host\.firstChild\)/);
});
