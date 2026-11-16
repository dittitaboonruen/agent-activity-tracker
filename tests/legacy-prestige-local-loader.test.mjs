import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'public/illustrations/legacy-table-b-local-loader.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public/illustrations/royal_partners_illustration_tool.html'),'utf8');
const window={};
vm.runInNewContext(source,{window,TextEncoder});
const loader=window.RP_LEGACY_LOCAL_TABLE_B;
const example=({gender='M',term=20,issueAge=35,sum=undefined,cv=17.2}={})=>JSON.stringify({
 plan:'AIA_LEGACY_PRESTIGE_PLUS_NEW',usage:'authorized-internal-qa',
 rows:[{gender,premiumTerm:term,issueAge,policyYear:2,cvPer1000:cv,
 rpuPer1000:40,etiYears:6,etiDays:156}]
});
test('local authorized male Factor can calculate 10/15/20 pay at 10m and 20m',()=>{
 for(const term of [10,15,20]){
  assert.equal(loader.importText(example({term})),1);
  assert.equal(loader.lookup(35,'ชาย',10000000,term).byAge.get(36).surrender,172000);
  assert.equal(loader.lookup(35,'ชาย',20000000,term).byAge.get(36).surrender,344000);
  assert.equal(loader.lookup(35,'ชาย',20000000,term).byAge.get(36).paidUp,800000);
  assert.equal(loader.lookup(35,'ชาย',20000000,term).byAge.get(37),undefined);
 }
});
test('isolates by gender, term, issue age and clears on demand',()=>{
 loader.importText(example());
 assert.equal(loader.lookup(35,'หญิง',20000000,20),null);
 assert.equal(loader.lookup(35,'ชาย',20000000,10),null);
 assert.equal(loader.lookup(36,'ชาย',20000000,20),null);
 loader.clear();
 assert.equal(loader.count(),0);
 assert.equal(loader.lookup(35,'ชาย',20000000,20),null);
});
test('invalid data and duplicates reject atomically, never contaminate existing state',()=>{
 loader.importText(example());
 const bad=JSON.parse(example());
 bad.rows.push({...bad.rows[0]});
 assert.throws(()=>loader.importText(JSON.stringify(bad)),/ซ้ำ/);
 assert.equal(loader.count(),1);
 assert.throws(()=>loader.importText(example({gender:'F'})),/เพศ/);
 assert.equal(loader.count(),1);
 assert.throws(()=>loader.importText(example({cv:-1})),/Factor/);
 assert.equal(loader.count(),1);
});
test('browser integration is limited to Legacy section',()=>{
 assert.match(html,/\/illustrations\/legacy-table-b-local-loader\.js/);
 assert.match(html,/RP_LEGACY_LOCAL_TABLE_B\?\.lookup/);
 assert.match(html,/if\(state\.gender==='ชาย' && window\.RP_LEGACY_LOCAL_TABLE_B\)/);
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|XMLHttpRequest/);
});
test('1000 parallel imported lookups are isolated and immutable',async()=>{
 loader.importText(example());
 const result=await Promise.all(Array.from({length:1000},(_,i)=>Promise.resolve().then(()=>
   loader.lookup(35,'ชาย',i%2?20000000:10000000,20).byAge.get(36).surrender
  )));
 result.forEach((v,i)=>assert.equal(v,i%2?344000:172000));
});
