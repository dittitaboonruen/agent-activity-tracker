import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'public/illustrations/royal_partners_illustration_tool.html'),'utf8');
const start=html.indexOf('const LEGACY_BROCHURE_CASH_M40_10_20M =');
const end=html.indexOf('/* AIA Legacy Prestige Plus (New) / female 20 Pay only.',start);
assert.ok(start>=0&&end>start,'Brochure evidence scope found');
const body=html.slice(start,end);
const fn=new Function(body+'return {lookup:lookupLegacyPolicyValueEvidence};');
const {lookup}=fn();
test('AIA public brochure: male 35/20/20m exact CV entries and no guessed values',()=>{
 const v=lookup(35,'ชาย',20000000,20);
 assert.ok(v);
 assert.equal(v.byAge.get(45).surrender,3440000);
 assert.equal(v.byAge.get(55).surrender,8120000);
 assert.equal(v.byAge.size,2);
 assert.equal(v.byAge.get(45).paidUp,null);
 assert.equal(v.byAge.get(55).extendedYears,null);
 assert.equal(v.byAge.get(46),undefined);
});
test('male 40/10/20m published brochure case remains available',()=>{
 const v=lookup(40,'ชาย',20000000,10);
 assert.ok(v);
 assert.equal(v.byAge.get(41).surrender,320000);
 assert.equal(v.byAge.get(42).surrender,1020000);
 assert.equal(v.byAge.get(98).surrender,20000000);
});
test('evidence must never leak across sex, term, issue age or coverage',()=>{
 for(const input of [
 [35,'หญิง',20000000,20],
 [35,'ชาย',20000000,15],
 [35,'ชาย',15000000,20],
 [36,'ชาย',20000000,20],
 [40,'ชาย',15000000,10],
 ]){
  assert.equal(lookup(...input),null,'must be exact-case evidence: '+JSON.stringify(input));
 }
});
test('isolated cases are deterministic across 2500 concurrent asynchronous reads',async()=>{
 const inputs=Array.from({length:2500},(_,i)=>i%2?[35,'ชาย',20000000,20]:[40,'ชาย',20000000,10]);
 const reads=await Promise.all(inputs.map(async p=>{await Promise.resolve();return lookup(...p)}));
 for(let i=0;i<reads.length;i++){
  assert.equal(reads[i].byAge.get(inputs[i][0]===35?45:41).surrender,inputs[i][0]===35?3440000:320000);
 }
});
