import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const middle=fs.readFileSync('middleware.ts','utf8');
test('original main plan riders remain supported while Legacy is added',()=>{
  for(const v of ["state.excellent.mode==='full'","state.pay25.mode==='full'","state.paylifeplus.mode==='full'"])
    assert.ok(html.includes(v),v);
  assert.match(html,/function viewLegacyPrestige\(app\)/);
  assert.match(html,/function buildLegacyReportHTML\(\)/);
  assert.match(html,/key==='legacy'\?'Legacy Prestige Plus — ใบสรุป A4'/);
});
test('plan-specific sum validation does not regress other products',()=>{
  assert.match(html,/const min=state\.tab==='legacy'\?10000000:minSumInsuredForPlan\(\)/);
  assert.match(html,/const maximum=state\.tab==='legacy'\?1000000000:SUM_INSURED_MAX/);
  assert.match(html,/numericValue > maximum/);
});
test('the public route bypasses middleware only by exact route match',()=>{
  assert.match(middle,/pathname === "\/api\/legacy-prestige-rpu"/);
  assert.match(middle,/await supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(middle,/PUBLIC_PATHS\s*=\s*\[[^\]]*"\/dashboard"/s);
});
