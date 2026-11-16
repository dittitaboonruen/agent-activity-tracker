import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const api=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const middleware=fs.readFileSync('middleware.ts','utf8');

test('Legacy Table B shows only age, CV and RPU; report drops ETI',()=>{
 const from=html.indexOf('function buildLegacyPolicyValuesTableHTML(');
 const to=html.indexOf('function viewLegacyPrestige(',from);
 assert.ok(from>=0&&to>from);
 const section=html.slice(from,to);
 assert.match(section,/const cols=\['surrender','paidUp'\]/);
 assert.doesNotMatch(section,/colspan="4" scope="colgroup">การประกันภัยแบบขยายเวลา/);
 assert.match(section,/เงินค่าเวนคืนกรมธรรม์ \(CV\)/);
 assert.match(section,/มูลค่าใช้เงินสำเร็จ \(RPU\)/);
 const reportStart=html.indexOf('const table=\'<div class="legacy3-heading">');
 assert.ok(reportStart>0);
 const report=html.slice(reportStart,reportStart+1650);
 assert.match(report,/มูลค่าใช้เงินสำเร็จ \(RPU\)/);
 assert.doesNotMatch(report,/ขยายเวลา ปี \/ วัน/);
});
test('Male RPU served only by authenticated server-side Preview configuration',()=>{
 assert.match(api,/LEGACY_RPU_MALE_FACTORS_BR_B64/);
 assert.match(api,/sb\.auth\.getUser\(\)/);
 assert.match(api,/profile\.active!==true/);
 assert.match(api,/\["admin","manager","training"\]/);
 assert.match(api,/no-store/);
 assert.match(middleware,/\/api\/legacy-prestige-rpu/);
 const src=html.slice(html.indexOf('const LEGACY_MALE_RPU_DATA='),html.indexOf('function buildLegacyPolicyValuesTableHTML('));
 assert.match(src,/fetch\('\/api\/legacy-prestige-rpu/);
 assert.doesNotMatch(src,/LEGACY_RPU_MALE_FACTORS_BR_B64/);
});

// Catch TypeScript errors in Legacy's authenticated server API before Vercel build.
test('Legacy API and integrated project pass TypeScript compiler',()=>{
 const processResult=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],
   {encoding:'utf8',timeout:120000,maxBuffer:1024*1024});
 assert.equal(processResult.status,0,
   'TypeScript compiler failed: '+(processResult.stdout||'')+'\n'+(processResult.stderr||''));
});
