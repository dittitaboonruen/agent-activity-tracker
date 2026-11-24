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

test('PDF keeps 1–20 year headings, gold ▲ for paid years and dot for others',()=>{
  assert.match(report,/const y=Array\.from\(\{length:20\}/);
  assert.match(report,/const t=Array\.from\(\{length:20\}/);
  assert.match(report,/i<d\.term\?'▲':'·'/);
  assert.match(report,/legacy3-years/);
  assert.match(report,/legacy3-tris/);
  assert.match(report,/#B29A63/);
  assert.doesNotMatch(report,/legacy3-period-track/);
});

test('design changes do not remove Table A/B or source-grounded missing-value handling',()=>{
  assert.match(html,/data-legacy-table="A"/);
  assert.match(html,/data-legacy-table="B"/);
  assert.match(report,/const tableAChunks=groupsOf/);
  assert.match(report,/const tableBChunks=shownBYears\.length\?groupsOf/);
  assert.match(report,/const dash='—'/);
  assert.match(report,/value===null\|\|value===undefined/);
});
