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
test('durable agent-specific links validate signature, expiry and revocation',()=>{
  const id='a1'.repeat(16),now=Math.floor(Date.now()/1000);
  const exp=String(now+29*24*60*60);
  const sig=createHmac('sha256',key)
    .update('legacy-agent-link:v1:'+id+':'+exp).digest('hex');
  const token=id+'.'+exp+'.'+sig;
  const x=harness();
  x.__agentLinkTestGrant=token;
  // The default harness has durable agent links disabled.
  assert.equal(x.validAgentCalculatorGrant(token),false);
  const y=agentHarness();
  assert.equal(y.validAgentCalculatorGrant(token),true);
  assert.equal(agentHarness({LEGACY_REVOKED_AGENT_LINK_IDS:id}).validAgentCalculatorGrant(token),false);
  assert.equal(agentHarness({LEGACY_AGENT_LINK_ACCESS_ENABLED:'false'}).validAgentCalculatorGrant(token),false);
  assert.equal(agentHarness({VERCEL_ENV:'production'}).validAgentCalculatorGrant(token),false);
  assert.equal(agentHarness({VERCEL_ENV:'production',LEGACY_SOURCE_USE_APPROVED:'true'}).validAgentCalculatorGrant(token),true);
  assert.equal(y.validAgentCalculatorGrant(token.slice(0,-1)+(token.endsWith('a')?'b':'a')),false);
  const tooLong=String(now+31*24*60*60);
  const longSig=createHmac('sha256',key)
    .update('legacy-agent-link:v1:'+id+':'+tooLong).digest('hex');
  assert.equal(y.validAgentCalculatorGrant(id+'.'+tooLong+'.'+longSig),false);
});
function agentHarness(overrides={}){
  const exports={};
  const env={
    VERCEL_ENV:'preview',
    LEGACY_AGENT_LINK_ACCESS_ENABLED:'true',
    LEGACY_CALCULATOR_COOKIE_SECRET:key,
    ...overrides,
  };
  vm.runInNewContext(compiled,{exports,require,process:{env},Buffer,Date},
    {filename:'agent-calculator-link-runtime.js',timeout:2000});
  return exports;
}
test('feature disabled and production without source clearance fail closed',()=>{
  const g=grant(Math.floor(Date.now()/1000)+300);
  assert.equal(harness('preview','false').validCalculatorLinkGrant(g),false);
  assert.equal(harness('production','true','false').validCalculatorLinkGrant(g),false);
  assert.equal(harness('production','true','true').validCalculatorLinkGrant(g),true);
});
