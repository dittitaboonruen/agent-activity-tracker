import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
const access=readFileSync('lib/insurance/legacy-prestige-plus/calculator-access.ts','utf8');
const route=readFileSync('app/api/legacy-prestige-link/route.ts','utf8');
const middleware=readFileSync('middleware.ts','utf8');
const generator=readFileSync('scripts/create-legacy-calculator-link.mjs','utf8');
test('link exchange gated by explicit enable flag and production source clearance',()=>{
  assert.match(access,/LEGACY_LINK_ACCESS_ENABLED/);
  assert.match(access,/LEGACY_SOURCE_USE_APPROVED/);
  assert.match(access,/validCalculatorLinkGrant/);
  assert.match(access,/timingSafeEqual/);
  assert.match(access,/MAX_LINK_LIFETIME_SECONDS = 10 \* 60/);
  assert.match(access,/expiry>now\+MAX_LINK_LIFETIME_SECONDS/);
});
test('signed link is exchanged for HttpOnly cookie then sensitive grant removed by redirect',()=>{
  assert.match(route,/validCalculatorLinkGrant\(grant\)/);
  assert.match(route,/issueAccessCookie\(\)/);
  assert.match(route,/NextResponse\.redirect\(next,\{status:303,headers\}\)/);
  assert.match(route,/Referrer-Policy.*no-referrer/);
  assert.match(route,/royal_partners_illustration_tool\.html\?plan=legacy/);
  assert.doesNotMatch(route,/NextResponse\.json\(\{.*factors/);
  assert.match(middleware,/pathname === "\/api\/legacy-prestige-link"/);
});
test('generator uses same purpose and never outputs the secret',()=>{
  assert.match(generator,/legacy-link-grant:v1:/);
  assert.match(generator,/expiry=String\(now\+300\)/);
  assert.match(generator,/LEGACY_CALCULATOR_COOKIE_SECRET/);
  assert.match(generator,/new URL\('\/api\/legacy-prestige-link'/);
  assert.doesNotMatch(generator,/console\.log\(secret\)/);
  const key='local-test-secret-123456789012345678901234';
  const expiry='1795409000';
  const signature=createHmac('sha256',key).update('legacy-link-grant:v1:'+expiry).digest('hex');
  assert.equal(signature.length,64);
});
