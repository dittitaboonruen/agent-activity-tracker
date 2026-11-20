import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAttainedAgeCv} from '../lib/insurance/legacy-prestige-plus/cv-dynamic-candidate.mjs';
// Synthetic data only; never commit insurer factor arrays or screenshots.
const rows=()=>Array.from({length:76},()=>[]);
test('verified cells must retain the original API path',()=>{
  assert.equal(inspectAttainedAgeCv({cvRows:rows(),issueAge:40,attainedAge:74,payTerm:10}).reason,'USE_VERIFIED_SOURCE_CELL');
});
test('research candidate is never a payable CV',()=>{
  const cv=rows();cv[41][34]=702;cv[42][33]=702;
  const r=inspectAttainedAgeCv({cvRows:cv,issueAge:40,attainedAge:75,payTerm:10});
  assert.equal(r.status,'RESEARCH_CANDIDATE_NOT_APPROVED');
  assert.equal(r.factorPer1000,702);
  assert.equal(r.amount,null);
});
test('mismatching published donors fail closed',()=>{
  const cv=rows();cv[41][34]=702;cv[42][33]=701;
  assert.equal(inspectAttainedAgeCv({cvRows:cv,issueAge:40,attainedAge:75,payTerm:10}).reason,'CONFLICTING_SOURCE_FACTORS');
});
test('high issue ages and missing factor cells fail closed',()=>{
  const cv=rows();cv[70][34]=702;cv[71][33]=702;
  assert.equal(inspectAttainedAgeCv({cvRows:cv,issueAge:69,attainedAge:104,payTerm:10}).reason,'INVALID_INPUT');
  assert.equal(inspectAttainedAgeCv({cvRows:cv,issueAge:60,attainedAge:95,payTerm:10}).reason,'ISSUE_AGE_OUTSIDE_RESEARCH_COHORT');
  assert.equal(inspectAttainedAgeCv({cvRows:cv,issueAge:40,attainedAge:75,payTerm:10}).reason,'MISSING_SOURCE_FACTOR');
});
test('known reference mismatches fail closed',()=>{
  const cv=rows();cv[41][34]=702;cv[42][33]=702;
  assert.equal(inspectAttainedAgeCv({cvRows:cv,issueAge:40,attainedAge:75,payTerm:10,verifiedCv:703}).reason,'EXACT_REFERENCE_DISAGREEMENT');
});
test('no possible result beyond age 98',()=>{
  assert.equal(inspectAttainedAgeCv({cvRows:rows(),issueAge:40,attainedAge:99,payTerm:10}).reason,'INVALID_INPUT');
});
