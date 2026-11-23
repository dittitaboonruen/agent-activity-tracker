import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync('lib/insurance/legacy-prestige-plus/calculator-access.ts','utf8')
  .replace(/import\s+["']server-only["'];?/,'');
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const key='internal-runtime-test-key-0123456789-abcdefghijklmnopqrstuvwxyz';
function harness(environment='preview',enabled='true',approved='false'){
  const exports={};
  const env={
    VERCEL_ENV:environment,LEGACY_LINK_ACCESS_ENABLED:enabled,
    LEGACY_SOURCE_USE_APPROVED:approved,
    LEGACY_CALCULATOR_COOKIE_SECRET:key,
  };
  vm.runInNewContext(compiled,{exports,require,process:{env},Buffer,Date},
    {filename:'calculator-access-runtime.js',timeout:2000});
  return exports;
}
function grant(expiry){
  const body=String(expiry);
  return body+'.'+createHmac('sha256',key)
    .update('legacy-link-grant:v1:'+body).digest('hex');
}
test('valid signed link grants QA without dashboard authentication or typed code',()=>{
  const x=harness();
  assert.equal(x.validCalculatorLinkGrant(grant(Math.floor(Date.now()/1000)+300)),true);
  const cookie=x.issueAccessCookie();
  assert.equal(cookie.options.httpOnly,true);
  assert.equal(cookie.options.secure,true);
  assert.equal(cookie.options.sameSite,'strict');
  assert.equal(x.hasCalculatorAccess({cookies:{get:()=>({value:cookie.value})}}),true);
});
test('invalid, expired, excessive lifetime or modified links fail closed',()=>{
  const x=harness(),now=Math.floor(Date.now()/1000);
  assert.equal(x.validCalculatorLinkGrant(grant(now-1)),false);
  assert.equal(x.validCalculatorLinkGrant(grant(now+601)),false);
  const valid=grant(now+300);
  assert.equal(x.validCalculatorLinkGrant(valid.slice(0,-1)+(valid.endsWith('a')?'b':'a')),false);
  assert.equal(x.validCalculatorLinkGrant('not-a-grant'),false);
  assert.equal(x.validCalculatorLinkGrant(null),false);
});
test('feature disabled and production without source clearance fail closed',()=>{
  const g=grant(Math.floor(Date.now()/1000)+300);
  assert.equal(harness('preview','false').validCalculatorLinkGrant(g),false);
  assert.equal(harness('production','true','false').validCalculatorLinkGrant(g),false);
  assert.equal(harness('production','true','true').validCalculatorLinkGrant(g),true);
});
