import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Regression guard for work on the dynamic-CV research branch.
// Never store private insurer factors, screenshot CV values or credentials here.
const api=readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const html=readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const research=readFileSync('lib/insurance/legacy-prestige-plus/cv-attained-research.ts','utf8');

test('existing exact-case CV overlays for both validated iPOS examples remain intact',()=>{
  assert.match(api,/gender==="F"&&age===35&&term===15&&sum===10000000/);
  assert.match(api,/gender==="M"&&age===40&&term===10&&sum===10000000/);
  assert.match(api,/LEGACY_QA_CV_F_35_15_10M_70_98_JSON/);
  assert.match(api,/LEGACY_QA_CV_M_40_10_10M_75_98_JSON/);
  assert.match(api,/verifiedCv===null&&screenshotCv!==null\?screenshotCv:verifiedCv/);
});

test('verified RPU and its ambiguous source positions stay protected',()=>{
  assert.match(api,/LEGACY_RPU_UNRESOLVED_SEGMENT_BITS/);
  assert.match(api,/paidUp:unresolvedRpu\?null:amount\(rpu\)/);
  assert.match(api,/LEGACY_MANUAL_FACTOR_SHA256/);
  assert.match(api,/getVerifiedFactors\(\)/);
});

test('no unverified CV is sent to the report or inserted as confirmed surrender',()=>{
  assert.doesNotMatch(api,/cvResearchCandidate:/);
  assert.doesNotMatch(html,/function estimateLegacyCvForQaOnly\(/);
  const report=html.slice(html.indexOf('function buildLegacyReportHTML('),
    html.indexOf('function loadLegacyTableB('));
  assert.doesNotMatch(report,/researchCvAttainedAgeLookup|estimateLegacyCvForQaOnly/);
});

test('dynamic CV research remains isolated with fail-closed statuses',()=>{
  assert.match(research,/research_candidate_not_verified/);
  assert.match(research,/conflicting_factors/);
  assert.match(research,/needs_source/);
  assert.doesNotMatch(api,/researchCvAttainedAgeLookup/);
});
