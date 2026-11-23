import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const engineSource=readFileSync('lib/insurance/legacy-prestige-plus/table-b-engine.js','utf8');
const apiSource=readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const exports={};
vm.runInNewContext(engineSource.replaceAll('export const ','const ').replaceAll('export function ','function ')+
  '\nexports.calculate=calculateLegacyFemale20PayTableB;', {exports});
const calculate=exports.calculate;
const base={plan:'AIA_LEGACY_PRESTIGE_PLUS_NEW',gender:'F',issueAge:35,sumAssured:10000000,premiumTerm:20};

test('manual zero CV and RPU remain actual zero (not missing)',()=>{
  const rows=calculate({...base,cvRows:[{sex:'F',premium_term:20,issue_age:35,policy_year:1,factor_per_1000:0}],
    rpuRows:[{sex:'F',premium_term:20,issue_age:35,policy_year:1,paid_up_factor_per_1000:0,immediate_payment_factor_per_1000:0}],
    etiRows:[]});
  assert.equal(rows[0].surrender,0);
  assert.equal(rows[0].paidUp,0);
  assert.equal(rows[0].paidUpImmediate,0);
  assert.equal(rows[1].surrender,null);
  assert.equal(rows[1].paidUp,null);
});

test('zero is not confused with missing values; nonzero factor scales correctly',()=>{
  const rows=calculate({...base,cvRows:[{sex:'F',premium_term:20,issue_age:35,policy_year:2,factor_per_1000:12}],
    rpuRows:[],etiRows:[]});
  assert.equal(rows[0].surrender,null);
  assert.equal(rows[1].surrender,120000);
  assert.equal(rows[1].paidUp,null);
});

test('different term or gender factors cannot contaminate the isolated engine',()=>{
  const rows=calculate({...base,cvRows:[
    {sex:'M',premium_term:20,issue_age:35,policy_year:1,factor_per_1000:900},
    {sex:'F',premium_term:15,issue_age:35,policy_year:1,factor_per_1000:900}],
    rpuRows:[],etiRows:[]});
  assert.equal(rows[0].surrender,null);
  assert.equal(calculate({...base,gender:'M',cvRows:[],rpuRows:[],etiRows:[]}),null);
});

test('production-bound API preserves zero, masks ambiguous RPU and does not interpolate unavailable CV',()=>{
  assert.match(apiSource,/typeof value==="number"&&Number\.isInteger\(value\)&&value>=0/);
  assert.match(apiSource,/paidUp:unresolvedRpu\?null:amount\(rpu\)/);
  assert.match(apiSource,/surrender:verifiedCv===null&&screenshotCv!==null\?screenshotCv:verifiedCv/);
  assert.doesNotMatch(apiSource,/estimateLegacyCvForQaOnly\(/);
  assert.doesNotMatch(apiSource,/researchCvAttainedAgeLookup\(/);
});
