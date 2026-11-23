import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

const source=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const js=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const nativeRequire=createRequire(import.meta.url);
const response=(body,opts={})=>({status:opts.status||200,body});
function setup({publicEnabled=false,approved=false}={}){
 let authCalls=0;
 const exports={};
 const env={
   LEGACY_PUBLIC_TABLE_B_ENABLED:publicEnabled?'true':'false',
   LEGACY_SOURCE_USE_APPROVED:approved?'true':'false',
   NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid',
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'test',
 };
 const localRequire=id=>{
   if(id==='next/server')return {NextResponse:{json:response}};
   if(id==='@supabase/ssr')return {createServerClient:()=>({
     auth:{getUser:async()=>{authCalls++;return {data:{user:null},error:null};}}
   })};
   if(id==='@/lib/insurance/legacy-prestige-plus/calculator-access')
     return {hasCalculatorAccess:()=>false};
   if(id==='@/lib/insurance/legacy-prestige-plus/cv-evidence-status')
     return {classifyLegacyCvEvidence:()=> 'UNAVAILABLE'};
   return nativeRequire(id);
 };
 vm.runInNewContext(js,{exports,require:localRequire,process:{env},Buffer,URLSearchParams},
   {timeout:2500,filename:'table-b-runtime.js'});
 return {get:exports.GET,authCalls:()=>authCalls};
}
function req(params={}){
 const p=new URLSearchParams({age:'35',gender:'F',sum:'10000000',term:'15',...params});
 return {nextUrl:{searchParams:p},cookies:{getAll:()=>[],get:()=>undefined}};
}
test('anonymous Table B request stays 401 when public mode is disabled',async()=>{
 for(const flags of [{},{publicEnabled:true},{approved:true}]){
   const x=setup(flags),result=await x.get(req());
   assert.equal(result.status,401);
   assert.equal(result.body.error,'authentication_required');
   assert.equal(x.authCalls(),1);
 }
});
test('approved public mode passes authentication gate but does not bypass factor checks',async()=>{
 const x=setup({publicEnabled:true,approved:true});
 const result=await x.get(req());
 assert.equal(result.status,503);
 assert.equal(result.body.error,'restricted_factors_not_configured');
 assert.equal(x.authCalls(),0,'public calculator must not require Supabase login');
});
test('public mode does not unlock privileged selfTest',async()=>{
 const x=setup({publicEnabled:true,approved:true});
 const result=await x.get(req({selfTest:'1'}));
 assert.equal(result.status,401);
 assert.equal(x.authCalls(),1);
});
test('public mode validates requested insurance case before factor lookup',async()=>{
 const x=setup({publicEnabled:true,approved:true});
 const result=await x.get(req({gender:'X'}));
 assert.equal(result.status,400);
 assert.equal(result.body.error,'invalid_case');
 assert.equal(x.authCalls(),0);
});
