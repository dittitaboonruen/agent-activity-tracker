import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');
const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const source=route.match(/const LEGACY_RPU_UNRESOLVED_SEGMENT_BITS[^=]*= (\{[\s\S]*?\n\});/);
assert.ok(source,'RPU pending map must exist');
const masks=JSON.parse(source[1].replace(/([,{]\s*)(\d+):/g,'$1"$2":').replace(/,\s*([}\]])/g,'$1'));
test('the pending status applies only to exactly 206 source positions',()=>{
 let count=0;
 for(const ages of Object.values(masks)) for(const value of Object.values(ages)){
   const bits=Number(value);
   for(let i=0;i<20;i++) if(bits&(1<<i)) count++;
 }
 assert.equal(count,206);
 assert.match(route,/rpuStatus:unresolvedRpu\?"PENDING_SOURCE_INTERPRETATION"/);
 assert.match(route,/i>=term-1\?"OUTSIDE_SOURCE_RANGE"/);
 assert.match(route,/rpu===0\?"CONFIRMED_ZERO":"VERIFIED"/);
 assert.match(route,/paidUp:unresolvedRpu\?null:amount\(rpu\)/);
});
test('screens and PDFs distinguish pending, unavailable, and real zero',()=>{
 assert.match(html,/รอยืนยัน RPU/);
 assert.match(html,/ไม่มีข้อมูล/);
 assert.match(html,/0 บาท = ศูนย์จริงจากต้นฉบับ/);
 assert.match(html,/current\.rpuStatus==='PENDING_SOURCE_INTERPRETATION'/);
 assert.match(html,/r\.policy\?\.rpuStatus==='PENDING_SOURCE_INTERPRETATION'/);
 assert.match(html,/data\?\.rpuStatus==='PENDING_SOURCE_INTERPRETATION'/);
 assert.match(html,/byAge\.set\(v\.age,\{age:v\.age,surrender:v\.surrender,paidUp:v\.paidUp,cvEvidence:v\.cvEvidence,rpuStatus:v\.rpuStatus\}\)/);
});
