import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
