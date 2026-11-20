import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const api=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');

test('private Table B factor files cannot be downloaded from public assets',()=>{
 assert.equal(fs.existsSync('public/illustrations/legacy-prestige-plus-f20-factors.js'),false);
 assert.equal(fs.existsSync('public/illustrations/legacy-prestige-plus-female-10-15-factors.js'),false);
 assert.doesNotMatch(html,/script src="\/illustrations\/legacy-prestige-plus-(?:f20|female-10-15)-factors\.js"/);
 assert.match(api,/LEGACY_TABLE_B_FEMALE_U16_B64/);
 assert.match(api,/LEGACY_TABLE_B_MALE_CV_BR_B64/);
 assert.match(api,/LEGACY_RPU_MALE_FACTORS_BR_B64/);
});
test('Table B performs automatic exact-case server lookup for both genders',()=>{
 assert.match(html,/function loadLegacyTableB\(age,gender,sum,term\)/);
 assert.match(html,/const legacyTableBKey=\(age,gender,sum,term\)/);
 assert.match(html,/gender:sex/);
 assert.match(html,/if\(r\.ok\)loadLegacyTableB\(state\.age,state\.gender,state\.sum,term\)/);
 assert.match(html,/result\.gender!==sex\|\|result\.issueAge!==age\|\|result\.sum!==sum/);
});
test('Legacy report and Table B share policy year, no ETI in displayed columns',()=>{
 assert.match(html,/const policyAge=d\.age\+n-1;/);
 assert.match(html,/policyValues\?\.byAge\.get\(policyAge\)/);
 assert.match(html,/cvCell\+renderValue\(data\?\.paidUp\)/);
 assert.match(html,/LEGACY_TABLE_B_DATA\.has\(caseKey\)/);
});
test('embedded calculator parses',()=>{
 const m=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
 assert.ok(m);
 assert.doesNotThrow(()=>new Function(m[1]));
});