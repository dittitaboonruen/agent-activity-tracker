import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');

test('public Table B requires BOTH explicit server-side release switches',()=>{
  assert.match(route,/process\.env\.LEGACY_PUBLIC_TABLE_B_ENABLED==="true"\s*&&\s*process\.env\.LEGACY_SOURCE_USE_APPROVED==="true"/);
  assert.match(route,/if\(!publicTableB&&!calculatorAccess\)/);
  assert.match(route,/const publicTableB=query\.get\("selfTest"\)!=="1"/);
  assert.doesNotMatch(route,/NEXT_PUBLIC_LEGACY_PUBLIC_TABLE_B_ENABLED/);
});
test('public calculations never receive private screenshot-only iPOS cases',()=>{
  assert.match(route,/if\(!publicTableB&&gender==="F"&&age===35&&term===15&&sum===10000000\)/);
  assert.match(route,/if\(!publicTableB&&gender==="M"&&age===40&&term===10&&sum===10000000\)/);
  assert.match(route,/cvExactCaseSource:\(exactCaseCv\|\|male40ScreenshotCv\)/);
  assert.match(route,/getVerifiedFactors\(\)/);
  assert.match(route,/restricted_factors_not_configured/);
  assert.doesNotMatch(route,/return NextResponse\.json\(\{factors:/);
});
test('Table B remains automatic and the manual passcode form stays removed',()=>{
  const start=html.indexOf('function buildLegacyPolicyValuesTableHTML(');
  const end=html.indexOf('function viewLegacyPrestige(',start);
  assert.ok(start>=0&&end>start);
  const ui=html.slice(start,end);
  assert.doesNotMatch(ui,/id="legacy-calculator-code"/);
  assert.doesNotMatch(ui,/id="legacy-calculator-submit"/);
  assert.match(html,/loadLegacyTableB\(state\.age,state\.gender,state\.sum,term\)/);
});
