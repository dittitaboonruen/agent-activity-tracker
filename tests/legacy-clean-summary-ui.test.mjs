import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const from=src.indexOf('function viewLegacyPrestige(app){');
const to=src.indexOf('function ',from+15);
assert.ok(from>=0 && to>from);
const legacy=src.slice(from,to);
test('Legacy summary removes decorative English headings and stat icons only in Legacy panel',()=>{
  assert.match(legacy,/panel\.classList\.add\('legacy-clean-panel'\)/);
  assert.match(legacy,/panel\.querySelectorAll\('\.rp-section-kicker,\.summary \.stat-icon'\)/);
  assert.match(legacy,/\.forEach\(node=>node\.remove\(\)\)/);
  assert.match(legacy,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(legacy,/#fff0d5/);
  assert.match(legacy,/#e3f2e9/);
  assert.match(legacy,/#e8f1fc/);
});
test('Legacy formula and summaries stay unchanged',()=>{
  assert.match(legacy,/calcLegacyPrestige\(state\.age,state\.gender,state\.sum,term,state\.tax\)/);
  assert.match(legacy,/loadLegacyTableB\(state\.age,state\.gender,state\.sum,term\)/);
  for(const expr of ['fmt(r.annualStandard)','fmt(r.annualDiscount)','fmt(r.annual)','r.term+\' ปี\'','fmt(r.sum)','fmt(r.taxRelief)'])
    assert.ok(legacy.includes(expr),expr);
});
test('shared summary code still includes icons and headings for other plans',()=>{
  const shared=src.slice(src.indexOf('function panelShell('),src.indexOf('function chartAndLedger('));
  assert.match(shared,/SELECTED PLAN/);
  assert.match(shared,/YOUR PLAN AT A GLANCE/);
  assert.match(shared,/stat-icon/);
});
