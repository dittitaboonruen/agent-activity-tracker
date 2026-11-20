import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const middleware=fs.readFileSync('middleware.ts','utf8');
const api=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const access=fs.readFileSync('app/api/legacy-prestige-access/route.ts','utf8');
const cookie=fs.readFileSync('lib/insurance/legacy-prestige-plus/calculator-access.ts','utf8');
const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');

test('calculator routes isolated; dashboard retains Supabase middleware',()=>{
  assert.match(middleware,/pathname === "\/api\/legacy-prestige-access"/);
  assert.match(middleware,/pathname === "\/api\/legacy-prestige-rpu"/);
  assert.match(middleware,/await supabase\.auth\.getUser\(\)/);
  assert.match(middleware,/profile\.active !== true/);
  assert.match(middleware,/isActivityDashboardPath\(/);
});
test('factor endpoint keeps server factor validation and admin-only self-test',()=>{
  assert.match(api,/hasCalculatorAccess\(request\)/);
  assert.match(api,/query\.get\("selfTest"\)!=="1"/);
  assert.match(api,/sb\.auth\.getUser\(\)/);
  assert.match(api,/\["admin","training"\]\.includes\(profile\.role\)/);
  assert.match(api,/getVerifiedFactors\(\)/);
  assert.match(api,/restricted_factors_not_configured/);
  assert.doesNotMatch(api,/return NextResponse\.json\(\{factors:/);
});
test('calculator access issues hardened server-cookie; no raw code stored',()=>{
  assert.match(cookie,/timingSafeEqual\(/);
  assert.match(cookie,/createHmac\("sha256"/);
  assert.match(cookie,/createHash\("sha256"/);
  assert.match(cookie,/httpOnly:true,secure:true,sameSite:"strict"/);
  assert.match(cookie,/__Host-rp_legacy_access/);
  assert.match(cookie,/LEGACY_CALCULATOR_CODE_SHA256/);
  assert.match(cookie,/LEGACY_CALCULATOR_COOKIE_SECRET/);
  assert.match(access,/origin!==request\.nextUrl\.origin/);
  assert.match(access,/validAccessCode\(code\)/);
  assert.match(access,/response\.cookies\.set/);
  assert.doesNotMatch(access,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('table B asks for separate code; no dashboard login link',()=>{
  assert.match(html,/submitLegacyCalculatorAccess/);
  assert.match(html,/legacy-calculator-code/);
  assert.match(html,/api\/legacy-prestige-access/);
  assert.doesNotMatch(html,/เข้าสู่ระบบบน Preview นี้/);
  assert.match(html,/credentials:'same-origin'/);
});

test('QA-only CV interpolation reaches age 98 while preserving verified cells and RPU',()=>{

  const start=html.indexOf('function estimateLegacyCvForQaOnly(');
  const end=html.indexOf('function buildLegacyPolicyValuesTableHTML(',start);
  assert.ok(start>0&&end>start,'estimated CV helper must be available for Table B');
  const script=html.slice(start,end)+
    "\nconst verified=new Map([[35,{surrender:0,paidUp:220000}],"+
    "[69,{surrender:6100000,paidUp:null}]]);"+
    "const projected=estimateLegacyCvForQaOnly(verified,35,10000000);"+
    "({first:projected.get(70),last:projected.get(98),size:projected.size,"+
    "realZero:verified.get(35).surrender,realLast:verified.get(69).surrender,"+
    "rpu:verified.get(35).paidUp,zeroed:estimateLegacyCvForQaOnly(new Map(),35,10000000).size})";
  const actual=vm.runInNewContext(script);
  assert.equal(actual.first,Math.round(6100000+(10000000-6100000)/29));
  assert.equal(actual.last,10000000);
  assert.equal(actual.size,29);
  assert.equal(actual.realZero,0);
  assert.equal(actual.realLast,6100000);
  assert.equal(actual.rpu,220000);
  assert.equal(actual.zeroed,0,'no projection without verified data');
  assert.match(html,/legacy-cv-estimate/);
  assert.match(html,/เฉพาะ QA: CV ที่มีคำว่า/);
  assert.match(html,/tableBServerReady\s*\?estimateLegacyCvForQaOnly/);
  const report=html.slice(html.indexOf('function buildLegacyReportHTML('),
    html.indexOf('function loadLegacyTableB('));
  assert.doesNotMatch(report,/estimateLegacyCvForQaOnly/,'never export estimates into PDF');
});
