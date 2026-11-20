import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const api=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const middleware=fs.readFileSync('middleware.ts','utf8');
const magicLink=fs.readFileSync('app/api/auth/magic-link/route.ts','utf8');
const callback=fs.readFileSync('app/auth/callback/page.tsx','utf8');

test('Legacy Table B shows only age, CV and RPU; report drops ETI',()=>{
 const from=html.indexOf('function buildLegacyPolicyValuesTableHTML(');
 const to=html.indexOf('function viewLegacyPrestige(',from);
 assert.ok(from>=0&&to>from);
 const section=html.slice(from,to);
 assert.match(section,/cvCell\+renderValue\(data\?\.paidUp\)/);
 assert.doesNotMatch(section,/colspan="4" scope="colgroup">การประกันภัยแบบขยายเวลา/);
 assert.match(section,/เงินค่าเวนคืนกรมธรรม์ \(CV\)/);
 assert.match(section,/มูลค่าใช้เงินสำเร็จ \(RPU\)/);
 const reportStart=html.indexOf('const table=\'<div class="legacy3-heading">');
 assert.ok(reportStart>0);
 const report=html.slice(reportStart,reportStart+1650);
 assert.match(report,/มูลค่าใช้เงินสำเร็จ \(RPU\)/);
 assert.doesNotMatch(report,/ขยายเวลา ปี \/ วัน/);
});
test('Male RPU served only by authenticated server-side Preview configuration',()=>{
 assert.match(api,/LEGACY_RPU_MALE_FACTORS_BR_B64/);
 assert.match(api,/sb\.auth\.getUser\(\)/);
 assert.match(api,/profile\.active!==true/);
 assert.match(api,/\["admin","manager","training"\]/);
 assert.match(api,/no-store/);
 assert.match(api,/createHash\("sha256"\)/);
 assert.match(api,/legacy manual factor integrity mismatch/);
 assert.match(api,/LEGACY_MANUAL_FACTOR_SHA256/);
 assert.match(api,/LEGACY_RPU_UNRESOLVED_SEGMENT_BITS/);
 assert.match(api,/i<term-1 && Boolean\(unresolvedRpuBits/);
 assert.match(api,/paidUp:unresolvedRpu\?null:amount\(rpu\)/);
 assert.match(middleware,/\/api\/legacy-prestige-rpu/);
 const src=html.slice(html.indexOf('const LEGACY_MALE_RPU_DATA='),html.indexOf('function buildLegacyPolicyValuesTableHTML('));
 assert.match(src,/fetch\('\/api\/legacy-prestige-rpu/);
 assert.doesNotMatch(src,/LEGACY_RPU_MALE_FACTORS_BR_B64/);
});

// Guard the exact optional-value narrowing that broke Vercel's TS build.
test('Legacy CV/RPU factor parsing is explicitly narrowed before arithmetic',()=>{
 assert.match(api,/typeof value==="number"&&Number\.isInteger\(value\)&&value>=0/);
 // Run a full compiler check when dependencies are available in the QA runner.
 if(fs.existsSync('node_modules/typescript/bin/tsc')){
   const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],
     {encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
   assert.equal(result.status,0,'TypeScript check: '+result.stdout+'\n'+result.stderr);
 }
});

test('server missing years use only exact-case iPOS+ values; never overwrite known zero',()=>{
 const start=html.indexOf('function lookupLegacyPolicyValueIllustration(');
 const end=html.indexOf('/* Backward-compatible exact lookup:',start);
 assert.ok(start>=0&&end>start,'exact-case lookup function available');
 const cases=new Map([
   ['60:หญิง:15000000:20',new Map([
     [60,{age:60,surrender:0,paidUp:0}],
     [61,{age:61,surrender:240000,paidUp:555000}],
     [95,{age:95,surrender:null,paidUp:null}],
     [96,{age:96,surrender:null,paidUp:null}],
     [97,{age:97,surrender:null,paidUp:null}],
     [98,{age:98,surrender:null,paidUp:null}]
   ])],
   ['60:ชาย:15000000:20',new Map([[95,{age:95,surrender:null,paidUp:null}]])]
 ]);
 const exact=new Map([
   [60,{age:60,surrender:999999,paidUp:999999}],
   [61,{age:61,surrender:999999,paidUp:999999}],
   [95,{age:95,surrender:13710000,paidUp:null}],
   [96,{age:96,surrender:13965000,paidUp:null}],
   [97,{age:97,surrender:14355000,paidUp:null}],
   [98,{age:98,surrender:15000000,paidUp:null}]
 ]);
 const sandbox={
   LEGACY_TABLE_B_DATA:cases,
   legacyTableBKey:(...args)=>args.join(':'),
   lookupLegacyPolicyValueEvidence:(age,gender,sum,term)=>
     age===60&&gender==='หญิง'&&sum===15000000&&term===20?{byAge:exact}:null,
 };
 vm.runInNewContext(html.slice(start,end)+
   '\nglobalThis.lookup=lookupLegacyPolicyValueIllustration;',sandbox);
 const female=sandbox.lookup(60,'หญิง',15000000,20).byAge;
 assert.equal(female.get(60).surrender,0);
 assert.equal(female.get(60).paidUp,0);
 assert.equal(female.get(61).surrender,240000);
 assert.equal(female.get(61).paidUp,555000);
 for(const [age,val] of [[95,13710000],[96,13965000],[97,14355000],[98,15000000]]){
   assert.equal(female.get(age).surrender,val);
   assert.equal(female.get(age).paidUp,null);
 }
 const male=sandbox.lookup(60,'ชาย',15000000,20).byAge;
 assert.equal(male.get(95).surrender,null,'no leakage across gender');
});

test('Legacy private calculator code restores guarded Table B without dashboard login',()=>{
 assert.match(html,/legacy-calculator-code/);
 assert.match(html,/submitLegacyCalculatorAccess/);
 assert.doesNotMatch(html,/เข้าสู่ระบบบน Preview นี้/);
 assert.match(html,/function retryLegacyTableB\(\)/);
 assert.match(html,/LEGACY_TABLE_B_ERRORS\.delete\(key\)/);
 assert.match(html,/new URLSearchParams\(location\.search\)\.get\('plan'\)==='legacy'/);
 assert.match(magicLink,/process\.env\.VERCEL_ENV === "preview"/);
 assert.match(magicLink,/process\.env\.VERCEL_URL/);
 assert.doesNotMatch(magicLink,/request\.headers\.get\("host"\)/);
 assert.match(magicLink,/emailRedirectTo:.*auth\/callback/);
 assert.match(callback,/const next = params\.get\("next"\)/);
 assert.match(callback,/window\.location\.replace\(next\)/);
 assert.match(middleware,/"\/auth\/callback"/);
 assert.match(middleware,/pathname === "\/api\/legacy-prestige-rpu"/);
 assert.match(api,/sb\.auth\.getUser\(\)/);
 assert.match(api,/profile\.active!==true/);
 assert.match(api,/restricted_factors_not_configured/);
});


test('Legacy Table B automatically recovers after a temporary 503 without another input upload',async()=>{
 const begin=html.indexOf('const LEGACY_TABLE_B_DATA=new Map();');
 const end=html.indexOf('function lookupLegacyPolicyValueIllustration(',begin);
 assert.ok(begin>=0&&end>begin);
 const timers=[];let now=100000,fetchCalls=0,renderCalls=0;
 const state={tab:'legacy',age:35,gender:'หญิง',sum:15000000,legacy:{term:20}};
 const expected={
   gender:'F',issueAge:35,sum:15000000,term:20,
   rows:Array.from({length:64},(_,i)=>({age:35+i,policyYear:i+1,
      surrender:i===1?105000:null,paidUp:i===1?630000:null,
      cvEvidence:i===1?'MANUAL_PUBLISHED':'UNAVAILABLE'}))
 };
 const sandbox={
   state,Map,Set,Number,String,Error,
   Date:{now:()=>now},
   URLSearchParams:class{constructor(data){this.data=data}toString(){
     return Object.entries(this.data).map(([k,v])=>k+'='+v).join('&');
   }},
   setTimeout:cb=>(timers.push(cb),timers.length),clearTimeout:()=>{},
   fetch:async()=>{
     fetchCalls++;
     return fetchCalls===1?{ok:false,status:503}:
       {ok:true,status:200,json:async()=>expected};
   },
   render:()=>{renderCalls++;}
 };
 vm.runInNewContext(html.slice(begin,end)+
   '\nglobalThis.legacyQA={loadLegacyTableB,'+
   'error:()=>LEGACY_TABLE_B_ERRORS.get(\"35:หญิง:15000000:20\"),'+
   'row:()=>LEGACY_TABLE_B_DATA.get(\"35:หญิง:15000000:20\")?.get(36)};',sandbox);
 const qa=sandbox.legacyQA;
 qa.loadLegacyTableB(35,'หญิง',15000000,20);
 await timers.shift()();
 assert.match(qa.error(),/503/);
 assert.equal(fetchCalls,1);
 qa.loadLegacyTableB(35,'หญิง',15000000,20);
 assert.equal(timers.length,1,'at most one deferred retry is scheduled');
 assert.equal(fetchCalls,1,'no immediate request loop');
 now+=16000;
 timers.shift()(); // Auto retry callback invokes the exact-case loader.
 assert.equal(timers.length,1,'automatic retry schedules the next fetch');
 await timers.shift()();
 assert.equal(fetchCalls,2);
 assert.equal(qa.error(),undefined);
 assert.equal(qa.row().surrender,105000);
 assert.equal(qa.row().paidUp,630000);
 assert.ok(renderCalls>=2,'table refreshes after each completed request');
});

test('Legacy integrity self-test is restricted and never returns factor or hash data',()=>{
 const auth=api.indexOf('const {data:{user},error}=await sb.auth.getUser()');
 const role=api.indexOf('.select("role,active")');
 const selfTest=api.indexOf('if(query.get("selfTest")==="1")');
 const calculation=api.indexOf('const gender=query.get("gender")');
 assert.ok(auth>=0&&role>auth&&selfTest>role&&calculation>selfTest,
  'authentication and role checks must execute before diagnostic');
 const diagnostic=api.slice(selfTest,calculation);
 assert.match(diagnostic,/\["admin","training"\]\.includes\(profile\.role\)/);
 assert.match(diagnostic,/getVerifiedFactors\(\)/);
 assert.match(diagnostic,/\[10,15,20\]/);
 assert.match(diagnostic,/\["M","F"\]/);
 assert.match(diagnostic,/status:verified\?"PASS":"BLOCKED"/);
 assert.match(diagnostic,/status:verified\?200:503,headers:noStore/);
 assert.doesNotMatch(diagnostic,/JSON\.stringify\(factors\)|rows:|factorValues:|hashes:|process\.env\./);
 assert.match(api,/factorHealthCode = "missing_configuration"/);
 assert.match(api,/factorHealthCode = "verified"/);
 assert.match(api,/legacy manual factor integrity mismatch/);
 assert.match(api,/if\(!factors\) return NextResponse\.json\(\{error:"restricted_factors_not_configured"\}/);
});
