import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const api=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const middleware=fs.readFileSync('middleware.ts','utf8');

function harness(){
  const begin=html.indexOf('const LEGACY_TABLE_B_DATA=new Map();');
  const end=html.indexOf('function lookupLegacyPolicyValueIllustration(',begin);
  assert.ok(begin>=0&&end>begin,'existing Table B loader found');
  const pending=[];
  let now=100000;
  const calls=[];
  const state={tab:'legacy',age:40,gender:'ชาย',sum:10000000,legacy:{term:10}};
  const session={status:200};
  const fakeFetch=async url=>{
    calls.push(url);
    if(session.status!==200)return {ok:false,status:session.status};
    const q=new URL(url,'https://qa.local').searchParams;
    const age=Number(q.get('age')),sum=Number(q.get('sum'));
    const gender=q.get('gender'),term=Number(q.get('term'));
    return {ok:true,status:200,json:async()=>({
      gender,issueAge:age,sum,term,
      rows:Array.from({length:99-age},(_,i)=>({
        age:age+i,policyYear:i+1,
        surrender:i<35?(i+1)*sum/1000:null,
        paidUp:i<term-1?(i+1)*sum/1000:null,
        cvEvidence:i<35?'MANUAL_PUBLISHED':'UNAVAILABLE'
      }))
    })};
  };
  const sandbox={
    state,Map,Set,Number,String,Error,Date:{now:()=>now},URL,URLSearchParams,
    setTimeout:callback=>(pending.push(callback),pending.length),
    clearTimeout:()=>{},fetch:fakeFetch,render:()=>{}
  };
  vm.runInNewContext(html.slice(begin,end)+
    '\nglobalThis.qa={load:loadLegacyTableB,data:LEGACY_TABLE_B_DATA,errors:LEGACY_TABLE_B_ERRORS};',sandbox);
  return {state,calls,pending,session,qa:sandbox.qa,setTime:t=>{now=t}};
}
async function run(h,age,gender,sum,term){
  h.state.age=age;h.state.gender=gender;h.state.sum=sum;h.state.legacy.term=term;
  h.qa.load(age,gender,sum,term);
  assert.ok(h.pending.length>0,'fetch scheduled for exact case');
  await h.pending.shift()();
  return h.qa.data.get([age,gender,sum,term].join(':'));
}

test('Phase D: gender, age, capital, term changes trigger distinct isolated API requests and row sets',async()=>{
  const h=harness();
  const cases=[
    [40,'ชาย',10000000,10],[40,'หญิง',10000000,10],
    [41,'หญิง',10000000,10],[41,'หญิง',15000000,10],
    [41,'หญิง',15000000,15],[41,'หญิง',20000000,20],
  ];
  for(const [age,gender,sum,term] of cases){
    const byAge=await run(h,age,gender,sum,term);
    assert.ok(byAge instanceof Map);
    assert.equal(byAge.size,99-age);
    assert.equal(byAge.get(age).surrender,sum/1000);
    assert.equal(byAge.get(age+35).surrender,null);
    assert.equal(byAge.get(age).cvEvidence,'MANUAL_PUBLISHED');
    assert.equal(byAge.get(age+35).cvEvidence,'UNAVAILABLE');
  }
  assert.equal(h.calls.length,cases.length);
  for(const [i,[age,gender,sum,term]] of cases.entries()){
    const q=new URL(h.calls[i],'https://qa.local').searchParams;
    assert.equal(q.get('age'),String(age));
    assert.equal(q.get('gender'),gender==='ชาย'?'M':'F');
    assert.equal(q.get('sum'),String(sum));
    assert.equal(q.get('term'),String(term));
  }
  assert.equal(h.qa.data.get('40:ชาย:10000000:10').get(40).surrender,10000,
    'switching input cannot change previously fetched case data');
});

test('Phase D: unauthenticated users never receive a fabricated cached result',async()=>{
  const h=harness();h.session.status=401;
  h.qa.load(35,'ชาย',10000000,10);
  await h.pending.shift()();
  assert.equal(h.qa.data.size,0);
  assert.match(h.qa.errors.get('35:ชาย:10000000:10'),/รหัสเข้าใช้/);
});

test('Phase D: service failures return no data instead of an estimated value',async()=>{
  const h=harness();h.session.status=503;
  h.qa.load(35,'หญิง',10000000,15);
  await h.pending.shift()();
  assert.equal(h.qa.data.size,0);
  assert.match(h.qa.errors.get('35:หญิง:10000000:15'),/503/);
});

test('Phase D: confidential API factor data and research candidates stay out of browser/PDF',()=>{
  assert.match(api,/getVerifiedFactors\(\)/);
  assert.match(api,/hasCalculatorAccess\(request\)/);
  assert.match(middleware,/pathname === "\/api\/legacy-prestige-rpu"/);
  assert.match(api,/LEGACY_RPU_UNRESOLVED_SEGMENT_BITS/);
  assert.match(api,/classifyLegacyCvEvidence/);
  assert.doesNotMatch(api,/cvResearchCandidate:/);
  assert.doesNotMatch(html,/function estimateLegacyCvForQaOnly\(/);
  const report=html.slice(html.indexOf('function buildLegacyReportHTML('),html.indexOf('function loadLegacyTableB('));
  assert.ok(report.length>1000);
  assert.doesNotMatch(report,/cvResearchCandidate|researchCvAttainedAgeLookup/);
  assert.match(report,/validateLegacyReportData\(d\)/);
});

test('Phase D: browser script parses and PDF uses exact case key rather than stale input',()=>{
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(script,'embedded script present');
  assert.doesNotThrow(()=>new Function(script[1]));
  assert.match(html,/const caseKey=legacyTableBKey\(state.age,state.gender,state.sum,state.legacy.term\);/);
  assert.match(html,/if\(!LEGACY_TABLE_B_DATA\.has\(caseKey\)\)/);
  assert.match(html,/policyValues\?\.byAge\.get\(policyAge\)/);
});
