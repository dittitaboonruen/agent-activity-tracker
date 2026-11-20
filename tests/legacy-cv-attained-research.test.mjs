import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Keep this test fixture synthetic: never embed restricted insurer factors.
const src=readFileSync(new URL('../lib/insurance/legacy-prestige-plus/cv-attained-research.ts',import.meta.url),'utf8');
assert.match(src,/research_candidate_not_verified/);
assert.match(src,/conflicting_factors/);
const js=src.replace(/export type LegacyCvResearchResult =[\s\S]*?;\n\nexport function researchCvAttainedAgeLookup\(/,
 'function researchCvAttainedAgeLookup(')
 .replace(/cvRows: readonly \(readonly number\[\]\)\[\],/,'cvRows,')
 .replace(/originalIssueAge: number,/,'originalIssueAge,')
 .replace(/attainedAge: number,/,'attainedAge,')
 .replace(/payTerm: 10 \| 15 \| 20,/,'payTerm,')
 .replace(/\): LegacyCvResearchResult \{/,' ){')
 .replace(/const donors: \{factor:number; policyYear:number\}\[\] = \[\];/,'const donors = [];')
 .replace(/factor! >= 0/,'factor >= 0')
 .replace(/factor:factor!,policyYear/,'factor,policyYear');
const ctx=vm.createContext({});
vm.runInContext(js+';globalThis.lookup=researchCvAttainedAgeLookup;',ctx);
const lookup=ctx.lookup;
const rows=Array.from({length:76},()=>[]);
for(let i=36;i<=45;i++){let y=70-i+1;if(y>15&&y<=35)rows[i][y-1]=500;}
let ok=lookup(rows,35,70,15);assert.equal(ok.status,'research_candidate_not_verified');assert.equal(ok.factor,500);
rows[40][30]=777; // issue age 40 / policy year 31 -> attained age 70
ok=lookup(rows,35,70,15);assert.equal(ok.status,'conflicting_factors');
assert.equal(lookup(rows,35,69,15).status,'needs_source');
assert.equal(lookup(rows,75,98,20).status,'needs_source');
assert.equal(lookup(rows,35,99,15).status,'needs_source');
console.log('Legacy attained-age prototype: synthetic safety cases PASS (no AIA factors)');
