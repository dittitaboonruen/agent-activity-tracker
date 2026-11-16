import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync('public/illustrations/'+p,'utf8');
const html=read('royal_partners_illustration_tool.html');
const ctx={window:{}};vm.runInNewContext(read('legacy-prestige-plus-female-10-15-factors.js'),ctx);
vm.runInNewContext(read('legacy-prestige-plus-f20-factors.js'),ctx);
const from=html.indexOf('let LEGACY_MANUAL_F20_INDEX=null;');
const to=html.indexOf('/* Backward-compatible exact lookup:',from);
const lookup=new Function('window','lookupLegacyPolicyValueEvidence',
 html.slice(from,to)+'return lookupLegacyPolicyValueIllustration;')(ctx.window,()=>null);
const fixtures={
 10:{cv:165000,rpu:990000,y:9,d:211},
 15:{cv:120000,rpu:720000,y:7,d:91},
 20:{cv:105000,rpu:630000,y:6,d:156}
};
test('female 10, 15, 20 Pay factor sample at age35, sum15m',()=>{
 for(const [k,exp] of Object.entries(fixtures)){
  const term=Number(k),table=lookup(35,'หญิง',15000000,term);
  assert.equal(table.byAge.size,64);
  const v=table.byAge.get(36);
  assert.equal(v.surrender,exp.cv,'CV term '+term);
  assert.equal(v.paidUp,exp.rpu,'RPU term '+term);
  assert.equal(v.extendedYears,exp.y,'ETI year term '+term);
  assert.equal(v.extendedDays,exp.d,'ETI days term '+term);
  assert.equal(lookup(35,'หญิง',20000000,term).byAge.get(36).surrender,exp.cv*4/3);
  assert.equal(lookup(35,'ชาย',15000000,term),null);
 }
});
test('source rows match manual layout; no synthetic late years',()=>{
 const d=ctx.window.RP_LEGACY_FEMALE_10_15_FACTORS;
 for(const term of [10,15]){
  assert.equal(d[term].cv.length,2594);
  assert.equal(d[term].rpu.length,term===10?684:1064);
  assert.equal(d[term].eti.length,term===10?684:1064);
  const table=lookup(35,'หญิง',15000000,term).byAge;
  assert.equal(table.get(98).surrender,null);
  assert.equal(table.get(35).surrender,null);
  assert.equal(table.get(36).paidUpInstant,null);
 }
});
test('AIA 15 Pay ETI missing immediate zero stays unavailable',()=>{
 const source=ctx.window.RP_LEGACY_FEMALE_10_15_FACTORS[15].eti;
 assert.equal(source.filter(v=>v[5]===null).length,76);
});
test('last displayed age is 98 and PDF uses shared table B values',()=>{
 assert.match(html,/Array\.from\(\{length:99-issueAge\}/);
 assert.match(html,/const policyAge=d\.age\+n-1;/);
 assert.match(html,/policyValues\?\.byAge\.get\(policyAge\)/);
});
test('calculator Javascript parses without syntax error',()=>{
 const m=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
 assert.ok(m);
 assert.doesNotThrow(()=>new Function(m[1]));
});
