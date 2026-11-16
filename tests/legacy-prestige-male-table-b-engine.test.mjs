import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateMaleLegacyTableB as calc,MALE_LEGACY_SCOPE as S} from '../lib/insurance/legacy-prestige-plus/male-table-b-engine.js';

const defaults={plan:S.plan,gender:'M',issueAge:35,sumAssured:20000000,premiumTerm:20};
test('supports male 10/15/20 pay without extrapolation',()=>{
  for(const premiumTerm of S.terms){
    const a=calc({...defaults,premiumTerm,factorRows:[
      {gender:'M',issueAge:35,premiumTerm,policyYear:2,cvPer1000:17.2,rpuPer1000:40,etiYears:2,etiDays:100}
    ]});
    assert.equal(a.rows.length,64);
    assert.equal(a.rows[1].age,36);
    assert.equal(a.rows[1].surrender,344000);
    assert.equal(a.rows[1].paidUp,800000);
    assert.equal(a.rows[2].surrender,null);
  }
});
test('rejects cross-sex, cross-term, cross-issue-age and invalid rows',()=>{
  for(const wrong of [{gender:'F'},{premiumTerm:15},{issueAge:36}]){
    assert.throws(()=>calc({...defaults,factorRows:[
      {gender:'M',issueAge:35,premiumTerm:20,policyYear:2,cvPer1000:20,...wrong}
    ]}));
  }
  assert.throws(()=>calc({...defaults,factorRows:[
    {gender:'M',issueAge:35,premiumTerm:20,policyYear:2,cvPer1000:-1}
  ]}));
  assert.throws(()=>calc({...defaults,factorRows:[
    {gender:'M',issueAge:35,premiumTerm:20,policyYear:2},
    {gender:'M',issueAge:35,premiumTerm:20,policyYear:2}
  ]}));
});
test('2500 concurrent calculations remain isolated',async()=>{
  const all=await Promise.all(Array.from({length:2500},(_,i)=>Promise.resolve().then(()=>
    calc({...defaults,sumAssured:i%2?20000000:15000000,factorRows:[
      {gender:'M',issueAge:35,premiumTerm:20,policyYear:2,cvPer1000:20}
    ]})
  )));
  for(let i=0;i<all.length;i++)
    assert.equal(all[i].rows[1].surrender,i%2?400000:300000);
});
