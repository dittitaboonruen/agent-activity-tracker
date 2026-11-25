import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const segment = (start,end) => {
  const a=html.indexOf(start), b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,'required Legacy design section exists: '+start);
  return html.slice(a,b);
};
const calculator=segment('function buildLegacyCoverageIllustrationHTML(', '/* WPCI official-condition');
const report=segment('function buildLegacyReportHTML(){','async function downloadLegacyReportPDF(');

test('calculator keeps years 1–20 and triangle markers for each 10/15/20 Pay choice',()=>{
  assert.match(calculator,/Array\.from\(\{length:20\}/);
  assert.match(calculator,/i<term\?'▲'/);
  assert.match(calculator,/legacy-graphic-ticks/);
  assert.match(calculator,/legacy-graphic-option\.selected/);
  assert.match(calculator,/#C4A363/);
  assert.doesNotMatch(calculator,/legacy-graphic-track/);
});

test('V4 PDF removes timeline and combines all source rows',()=>{
 assert.doesNotMatch(report,/const timeline=|const y=Array\.from|const t=Array\.from/);
 assert.match(html,/data-legacy-table="A"/);
 assert.match(html,/data-legacy-table="B"/);
 assert.match(report,/groupsOf\(allYears,rowsPerPage\)/);
 assert.match(report,/value===null\|\|value===undefined/);
 assert.match(report,/kind==='cv'\?'\*':'—'/);
 assert.match(report,/const pageBodies=\[page1Body\+wpciPage,\.\.\.combinedPages\]/);
});
