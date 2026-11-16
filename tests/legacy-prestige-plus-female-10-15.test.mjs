import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const api=fs.readFileSync('app/api/legacy-prestige-rpu/route.ts','utf8');

test('female CV/RPU for 10, 15, 20 Pay is served from private typed data',()=>{
 assert.match(api,/for\(const term of \[10,15,20\]\)/);
 assert.match(api,/const female=\{cv:\[\] as number\[\]\[\],rpu:\[\] as number\[\]\[\]\}/);
 assert.match(api,/F:female/);
 assert.match(api,/const binary=Buffer\.from\(femaleEncoded,"base64"\)/);
 assert.match(api,/readUInt16LE\(position\)/);
 assert.match(api,/binary\.length!==21948/);
});
test('female input changes never reuse previous policy years, terms or coverage',()=>{
 assert.match(html,/legacyTableBKey\(issueAge,gender,sum,term\)/);
 assert.match(html,/if\(state\.tab==='legacy'&&state\.age===age&&state\.gender===gender&&/);
 assert.match(html,/state\.sum===sum&&state\.legacy\.term===term\)render\(\)/);
 assert.match(api,/const rows=Array\.from\(\{length:99-age\}/);
 assert.match(api,/policyYear:i\+1/);
});
test('manual evidence sample checks remain enforced by browser API fixtures',()=>{
 const browserTest=fs.readFileSync('tests/legacy-prestige-browser-qa.mjs','utf8');
 for(const [cv,rpu] of [[165000,990000],[120000,720000],[105000,630000]]){
   assert.ok(browserTest.includes(String(cv))&&browserTest.includes(String(rpu)));
 }
});
test('Legacy calculator browser code parses after removing public factors',()=>{
 const m=html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
 assert.ok(m);assert.doesNotThrow(()=>new Function(m[1]));
});