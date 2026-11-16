import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'public/illustrations/royal_partners_illustration_tool.html'),'utf8');
const ratesText=html.match(/const LEGACY_PRESTIGE_RATES = (\[[^;]+\]);/);
assert.ok(ratesText,'brochure rate matrix present');
const start=html.indexOf('function calcLegacyPrestige(');
const end=html.indexOf('/* Legacy illustration-only figures.',start);
assert.ok(start>=0&&end>start,'standalone calculator function present');
const calculate=new Function('LEGACY_PRESTIGE_RATES',html.slice(start,end)+'return calcLegacyPrestige;')(
  JSON.parse(ratesText[1])
);
const rates=JSON.parse(ratesText[1]);

test('published brochure standard rates include 76 age rows and both genders x 3 terms',()=>{
  assert.equal(rates.length,76);
  for(const row of rates){
    assert.equal(row.length,6);
    for(const value of row)assert.ok(Number.isFinite(value)&&value>0);
  }
});
test('male/female premiums apply discounts rounded at the per-1000 rate, not on the total bill',()=>{
  for(let age=0;age<=75;age++) for(const gender of ['ชาย','หญิง']) for(const term of [10,15,20]){
    const col=({10:0,15:2,20:4})[term]+(gender==='ชาย'?0:1);
    const rate=rates[age][col];
    for(const sum of [10000000,19999000,20000000,50000000]){
      const result=calculate(age,gender,sum,term,0.2);
      assert.ok(result.ok,gender+' age '+age+' '+term+' pay');
      const pct=sum>=20000000?(term===10?5:10):0;
      const effectiveRate=pct?Math.round(rate*(100-pct)+1e-9)/100:rate;
      assert.equal(result.discountPct,pct);
      assert.equal(result.annual,Math.round(effectiveRate*sum/1000*100)/100);
      assert.equal(result.annualStandard,Math.round(rate*sum/1000*100)/100);
      assert.equal(result.annualDiscount,Math.round((result.annualStandard-result.annual)*100)/100);
      assert.equal(result.rows.length,99-age);
      assert.equal(result.rows.at(-1).age,99);
      assert.equal(result.rows[term-1]?.premium,result.annual);
      assert.equal(result.rows[term]?.premium,0);
    }
  }
});
test('AIA brochure male age 35, 20-pay, 20m standard and discounted premium',()=>{
  const v=calculate(35,'ชาย',20000000,20,0.35);
  assert.equal(v.annualStandard,511400);
  assert.equal(v.annual,460200);
  assert.equal(v.discountPct,10);
});
test('AIA brochure male age 40, 10-pay, 20m standard premium (preferred rate excluded)',()=>{
  const v=calculate(40,'ชาย',20000000,10,0.35);
  assert.equal(v.annualStandard,1011400);
  assert.equal(v.annual,960800);
  assert.notEqual(v.annual,855000,'preferred-health discount must not be silently assumed');
});
test('no shared calculation state across 2400 overlapping users',async()=>{
  const cases=Array.from({length:2400},(_,i)=>({
    age:i%76,
    gender:i%2?'หญิง':'ชาย',
    term:[10,15,20][i%3],
    sum:[10000000,19999000,20000000,35000000][i%4]
  }));
  const results=await Promise.all(cases.map(async c=>{
    await Promise.resolve();
    return {input:c,value:calculate(c.age,c.gender,c.sum,c.term,0.2)};
  }));
  for(const {input,value} of results){
    const independent=calculate(input.age,input.gender,input.sum,input.term,0.2);
    assert.equal(value.annual,independent.annual);
    assert.equal(value.rows[0].premium,independent.rows[0].premium);
  }
});
