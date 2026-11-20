import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const src=readFileSync('lib/insurance/legacy-prestige-plus/cv-evidence-status.ts','utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};
vm.runInNewContext(compiled,{exports});
const classify=exports.classifyLegacyCvEvidence;
const api=readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const ui=readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const base={gender:'M',issueAge:40,term:10,sum:10000000,attainedAge:75,publishedAmount:null,exactScreenshotAmount:null};

test('published value is authoritative, even when zero or screenshot also exists',()=>{
  assert.equal(classify({...base,publishedAmount:0,exactScreenshotAmount:1}),'MANUAL_PUBLISHED');
  assert.equal(classify({...base,publishedAmount:6000000,exactScreenshotAmount:5900000}),'MANUAL_PUBLISHED');
});
test('exact screenshot provenance applies to the two verified input cases only',()=>{
  assert.equal(classify({...base,exactScreenshotAmount:7020000}),'IPOS_EXACT_CASE_QA');
  assert.equal(classify({...base,sum:20000000,exactScreenshotAmount:7020000}),'UNAVAILABLE');
  assert.equal(classify({...base,issueAge:41,exactScreenshotAmount:7020000}),'UNAVAILABLE');
  assert.equal(classify({...base,term:15,exactScreenshotAmount:7020000}),'UNAVAILABLE');
  assert.equal(classify({...base,gender:'F',exactScreenshotAmount:7020000}),'UNAVAILABLE');
  assert.equal(classify({...base,attainedAge:74,exactScreenshotAmount:7020000}),'UNAVAILABLE');
  assert.equal(classify({...base,gender:'F',issueAge:35,term:15,attainedAge:70,exactScreenshotAmount:5840000}),'IPOS_EXACT_CASE_QA');
});
test('missing and unsupported values never become an approved CV amount',()=>{
  assert.equal(classify(base),'UNAVAILABLE');
  assert.equal(classify({...base,exactScreenshotAmount:NaN}),'UNAVAILABLE');
  assert.equal(classify({...base,issueAge:35,gender:'F',term:20,attainedAge:90,exactScreenshotAmount:7000000}),'UNAVAILABLE');
  assert.doesNotMatch(api,/researchCvAttainedAgeLookup\(|cvResearchCandidate:/);
});
test('Phase C only adds provenance, preserving existing numeric selection, RPU and PDF safety',()=>{
  assert.match(api,/surrender:verifiedCv===null&&screenshotCv!==null\?screenshotCv:verifiedCv/);
  assert.match(api,/paidUp:unresolvedRpu\?null:amount\(rpu\)/);
  assert.match(api,/cvEvidence,/);
  assert.match(ui,/cvEvidence:v.cvEvidence/);
  assert.match(ui,/ไม่มีค่า CV ที่ยืนยันสำหรับกรณีนี้/);
  assert.doesNotMatch(ui,/function estimateLegacyCvForQaOnly\(/);
  const pdf=ui.slice(ui.indexOf('function buildLegacyReportHTML('),ui.indexOf('function loadLegacyTableB('));
  assert.doesNotMatch(pdf,/cvResearchCandidate|estimateLegacyCvForQaOnly/);
});
