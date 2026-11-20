import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

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

test('Table B displays verified CV only, never linear projections',()=>{
  assert.doesNotMatch(html,/function estimateLegacyCvForQaOnly\(/);
  assert.doesNotMatch(html,/legacy-cv-estimate/);
  assert.doesNotMatch(html,/QA เท่านั้น: CV ค่าประมาณ/);
  assert.match(html,/const cvCell=Number\.isFinite\(data\?\.surrender\)/);
  assert.match(html,/const isScreenshotAge=isExactIPOSCase/);
  const report=html.slice(html.indexOf('function buildLegacyReportHTML('),
    html.indexOf('function loadLegacyTableB('));
  assert.doesNotMatch(report,/estimateLegacyCvForQaOnly/);
});

test('male issue40 10pay CV uses encrypted private iPOS screenshot only for exact 10m case',()=>{
  assert.match(api,/gender==="M"&&age===40&&term===10&&sum===10000000/);
  assert.match(api,/LEGACY_QA_CV_M_40_10_10M_75_98_JSON/);
  assert.match(api,/male40ScreenshotCv&&attainedAge>=75&&attainedAge<=98/);
  assert.match(api,/exact_case_cv_not_configured/);
  assert.match(api,/5dc18a4e74b031fdd7b2974832a6fa434fd42c8f82881d4527fe91ca013307bc/);
  assert.match(api,/surrender:verifiedCv===null&&screenshotCv!==null\?screenshotCv:verifiedCv/);
});

test('private iPOS screenshot reference matches complete 29-year exact case',()=>{
  const values=JSON.parse(process.env.LEGACY_QA_CV_F_35_15_10M_70_98_JSON||'null');
  assert.ok(Array.isArray(values),'private exact case must be configured in this QA branch');
  assert.equal(values.length,29);
  assert.equal(createHash('sha256').update(JSON.stringify(values)).digest('hex'),
    '5801233bd7c3189f0388ba0d8e09118f6fafce50405d317cbbda6b2655df404d');
  assert.match(api,/gender==="F"&&age===35&&term===15&&sum===10000000/);
  assert.match(api,/verifiedCv===null&&exactCv!==null\?exactCv:verifiedCv/);
  assert.match(html,/LEGACY_TABLE_B_CASE_SOURCES/);
  assert.match(html,/USER_SUPPLIED_IPOS_SCREENSHOT_QA_ONLY/);
});
