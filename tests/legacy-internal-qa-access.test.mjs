import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import crypto from "node:crypto";

const src=fs.readFileSync("lib/insurance/legacy-prestige-plus/calculator-access.ts","utf8");
const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function access({preview,primary,secondary,expiry,now="2026-11-20T09:00:00.000Z"}){
  const exports={};
  const ENV={VERCEL_ENV:preview?"preview":"production",
    LEGACY_CALCULATOR_COOKIE_SECRET:"x".repeat(48),
    LEGACY_CALCULATOR_CODE_SHA256:crypto.createHash("sha256").update(primary).digest("hex"),
    LEGACY_QA_OWNER_CODE_SHA256:crypto.createHash("sha256").update(secondary).digest("hex"),
    LEGACY_QA_OWNER_CODE_EXPIRES_AT:expiry};
  const current=Date.parse(now);
  const FakeDate=class extends Date {static now(){return current;}};
  vm.runInNewContext(compiled,{exports,require:name=>name==="server-only"?{}:crypto,process:{env:ENV},Buffer,Date:FakeDate,Math});
  return exports;
}
const primary="previous-owner-code-that-must-keep-working-234";
const secondary="isolated-qa-owner-second-code-never-in-client";
const expiry="2026-12-01T00:00:00Z";
test("old calculator code is still valid in QA and production",()=>{
  assert.equal(access({preview:true,primary,secondary,expiry}).validAccessCode(primary),true);
  assert.equal(access({preview:false,primary,secondary,expiry}).validAccessCode(primary),true);
});
test("new QA code is valid only on Preview before expiry",()=>{
  assert.equal(access({preview:true,primary,secondary,expiry}).validAccessCode(secondary),true);
  assert.equal(access({preview:false,primary,secondary,expiry}).validAccessCode(secondary),false);
  assert.equal(access({preview:true,primary,secondary,expiry,now:"2026-12-01T00:00:01Z"}).validAccessCode(secondary),false);
});
test("missing or invalid credentials are blocked without fallback",()=>{
  const a=access({preview:true,primary,secondary,expiry});
  assert.equal(a.validAccessCode("wrong-code-not-valid-at-all"),false);
  assert.equal(a.validAccessCode(null),false);
  assert.equal(a.validAccessCode(secondary.slice(0,-1)),false);
});
test("existing access cookie and role protections remain unchanged",()=>{
  assert.match(src,/__Host-rp_legacy_access/);
  assert.match(src,/httpOnly:true,secure:true,sameSite:"strict"/);
  assert.match(src,/TTL_SECONDS = 24 \* 60 \* 60/);
  const middleware=fs.readFileSync("middleware.ts","utf8");
  assert.match(middleware,/await supabase.auth.getUser\(\)/);
});
