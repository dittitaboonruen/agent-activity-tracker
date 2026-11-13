import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'public/illustrations/royal_partners_illustration_tool.html'),'utf8');
const factors=fs.readFileSync(path.join(root,'public/illustrations/legacy-prestige-plus-f20-factors.js'),'utf8');
const ipos=fs.readFileSync(path.join(root,'data/legacy-prestige-plus/ipos-f60-20-15m-20261112.csv'),'utf8');
const window={};
new Function('window',factors)(window);
const from=html.indexOf('let LEGACY_MANUAL_F20_INDEX=null;');
const to=html.indexOf('/* Backward-compatible exact lookup:',from);
assert.ok(from>=0&&to>from,'Legacy-only lookup must exist');
const records=ipos.split(/\r?\n/).filter(x=>/^\d+,/.test(x)).map(x=>x.split(','));
const evidence=(age,gender,sum,term)=>{
  if(age!==60||gender!=='หญิง'||sum!==15000000||term!==20)return null;
  return {source:'AIA iPOS+ verified screenshot',byAge:new Map(records.map(x=>[
    Number(x[0]),{age:Number(x[0]),surrender:x[1]?Number(x[1]):null,
      paidUp:x[2]?Number(x[2]):null,extendedYears:x[4]?Number(x[4]):null,
      extendedDays:x[5]?Number(x[5]):null}
  ]))};
};
const lookup=new Function('window','lookupLegacyPolicyValueEvidence',
  html.slice(from,to)+'return lookupLegacyPolicyValueIllustration;')(window,evidence);
const data=window.RP_LEGACY_F20_FACTORS;

test('source datasets and isolation',()=>{
  assert.equal(data.cv.length,2660);
  assert.equal(data.rpu.length,1444);
  assert.equal(data.eti.length,1444);
  assert.equal(lookup(35,'ชาย',15000000,20),null);
  assert.equal(lookup(35,'หญิง',15000000,10),null);
  assert.equal(lookup(35,'หญิง',15000000,15),null);
});
test('manual factors: female age 35, 20 pay',()=>{
  const a=lookup(35,'หญิง',15000000,20).byAge;
  assert.equal(a.get(36).surrender,105000);
  assert.equal(a.get(36).paidUp,630000);
  assert.equal(a.get(36).extendedYears,6);
  assert.equal(a.get(36).extendedDays,156);
  assert.equal(a.get(37).surrender,285000);
  assert.equal(lookup(35,'หญิง',20000000,20).byAge.get(36).surrender,140000);
});
test('all iPOS values, 39 ages, no overwriting with guesses',()=>{
  const a=lookup(60,'หญิง',15000000,20).byAge;
  let checked=0;
  for(const line of records){
    const age=Number(line[0]),actual=a.get(age);
    for(const [i,key] of [[1,'surrender'],[2,'paidUp'],[4,'extendedYears'],[5,'extendedDays']]){
      if(line[i]==='')continue;
      checked++;
      assert.equal(actual[key],Number(line[i]),'age '+age+' '+key);
    }
  }
  assert.equal(checked,92);
  assert.equal(a.get(98).surrender,15000000);
  assert.equal(lookup(60,'หญิง',20000000,20).byAge.get(98).surrender,null,
    'late-year screenshot fallback must NEVER cross sum insured');
});
test('report PDF and Table B select identical policy-year mapping',()=>{
  assert.match(html,/const policyAge=d\.age\+n-1;/);
  assert.match(html,/policyValues\?\.byAge\.get\(policyAge\)/);
  assert.match(html,/const evidence=lookupLegacyPolicyValueIllustration\(inputs\.age,inputs\.gender,inputs\.sum,inputs\.term\)/);
  assert.doesNotMatch(html,/simulation-loglinear-2anchors-v2/);
});
test('embedded calculator Javascript parses',()=>{
  const m=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(m,'calculator inline script');
  assert.doesNotThrow(()=>new Function(m[1]));
});
