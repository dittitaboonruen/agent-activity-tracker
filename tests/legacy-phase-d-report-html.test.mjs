import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('public/illustrations/royal_partners_illustration_tool.html','utf8');
const begin=html.indexOf('function buildLegacyReportHTML(');
const end=html.indexOf('async function downloadLegacyReportPDF(',begin);
assert.ok(begin>=0&&end>begin,'report function exists');

function createHarness(){
  const state={age:40,gender:'ชาย',sum:10000000,legacy:{term:10},tax:0.1};
  const verified=new Map();
  let pending=0;
  const sandbox={
    state,LEGACY_TABLE_B_DATA:verified,LEGACY_REPORT_VERSION:'QA-D',
    LEGACY_BROCHURE_FIXED:{},GLOBAL_REPORT_PAYMENT:{},
    legacyTableBKey:(...parts)=>parts.join(':'),
    loadLegacyTableB:()=>{pending++},
    LEGACY_TABLE_B_ERRORS:new Map(),
    buildLegacyReportData:()=>({
      c:{ok:true,annual:100000,taxRelief:10000,
        rows:Array.from({length:99-state.age},(_,i)=>({
          year:i+1,age:state.age+i+1,premium:i<state.legacy.term?100000:0,
          paid:Math.min(i+1,state.legacy.term)*100000
        }))},
      age:state.age,gender:state.gender,sum:state.sum,term:state.legacy.term,
      name:'Test User',tax:0.1,
      groups:Array.from({length:6},(_,i)=>({title:'Group '+i,items:Array.from({length:i===0?9:7},()=>0)}))
    }),
    validateLegacyReportData:d=>({ok:d.c.ok&&d.c.rows.at(-1)?.age===99,errors:[]}),
    lookupLegacyPolicyValueIllustration:(age,gender,sum,term)=>{
      const byAge=verified.get([age,gender,sum,term].join(':'));
      return byAge?{byAge,source:'Authorized QA synthetic data'}:null;
    },
    escapeResourceHtml:s=>String(s),
    fmt:v=>v===null||v===undefined?'—':Number(v).toLocaleString('en-US'),
    buildBrochureSlot:()=>'<div class="brochure">Brochure</div>',
    buildPaymentCard:()=>'<div class="payment">Payment</div>',
    buildLegacyAgeTableRows:(issueAge,term,annual,sum)=>Array.from({length:99-issueAge},(_,i)=>({age:issueAge+i,premium:i<term?annual:null,coverage:sum}))
  };
  vm.runInNewContext(html.slice(begin,end)+'\nglobalThis.report=buildLegacyReportHTML;',sandbox);
  return {state,verified,report:sandbox.report,getPending:()=>pending};
}

test('Legacy PDF 1.1: full age data, page breaks and source-matched values',()=>{
  const h=createHarness();
  const first=new Map([[40,{surrender:10000,paidUp:50000}],[41,{surrender:20000,paidUp:60000}]]);
  h.verified.set('40:ชาย:10000000:10',first);
  const pdfHtml=h.report();
  assert.equal((pdfHtml.match(/class="ex-report-page legacy-report-page"/g)||[]).length,8);
  assert.match(pdfHtml,/AIA Legacy Prestige Plus/);
  assert.match(pdfHtml,/10,000,000/);
  assert.match(pdfHtml,/<td>1<\/td><td>40<\/td><td class="legacy3-paid-year">100,000<\/td><td>100,000<\/td><td>10,000,000<\/td>/);
  assert.match(pdfHtml,/<td>1<\/td><td>40<\/td><td class="legacy3-amount">10,000<\/td><td class="legacy3-amount">50,000<\/td>/);
  assert.match(pdfHtml,/<td>2<\/td><td>41<\/td><td class="legacy3-paid-year">100,000<\/td><td>200,000<\/td><td>10,000,000<\/td>/);
  assert.match(pdfHtml,/<td>2<\/td><td>41<\/td><td class="legacy3-amount">20,000<\/td><td class="legacy3-amount">60,000<\/td>/);
  assert.match(pdfHtml,/หน้า 8 \/ 8/);
  assert.match(pdfHtml,/<td>59<\/td><td>98<\/td>/);
  assert.doesNotMatch(pdfHtml,/6 ข้อควรทราบ/);
  assert.doesNotMatch(pdfHtml,/\(ประมาณ\)|cvResearchCandidate/);
});

test('Phase D PDF HTML: changing sex, issue age, sum and term never reuses prior case',()=>{
  const h=createHarness();
  h.verified.set('40:ชาย:10000000:10',new Map([[40,{surrender:111111,paidUp:222222}]]));
  const male=h.report();
  assert.match(male,/111,111/);
  Object.assign(h.state,{age:35,gender:'หญิง',sum:15000000,legacy:{term:15}});
  assert.throws(()=>h.report(),/กรุณารอให้ตาราง B/);
  assert.equal(h.getPending(),1);
  h.verified.set('35:หญิง:15000000:15',new Map([[35,{surrender:333333,paidUp:444444}]]));
  const female=h.report();
  assert.match(female,/15,000,000/);
  assert.match(female,/333,333/);
  assert.match(female,/444,444/);
  assert.doesNotMatch(female,/111,111|222,222/);
});

test('Phase D PDF HTML: missing CV and RPU remain dashes, not invented amounts',()=>{
  const h=createHarness();
  h.verified.set('40:ชาย:10000000:10',new Map([[40,{surrender:null,paidUp:null}]]));
  const body=h.report();
  assert.match(body,/<td>1<\/td><td>40<\/td><td class="legacy3-empty">—<\/td><td class="legacy3-empty">—<\/td>/);
  assert.doesNotMatch(body,/\(ประมาณ\)/);
});

test('Legacy PDF 1.1: every attained age appears once in each of Tables A and B',()=>{
  for(const issueAge of [0,35,45,75]){
    const h=createHarness();
    h.state.age=issueAge;
    h.verified.set([issueAge,'ชาย',10000000,10].join(':'),new Map(
      Array.from({length:99-issueAge},(_,i)=>[issueAge+i,{
        surrender:i<=34?i*10000:null,paidUp:i<9?i*20000:null
      }])
    ));
    const doc=h.report();
    const tables=[...doc.matchAll(/<table class="legacy3-table-full">([\s\S]*?)<\/table>/g)];
    const groups=Math.ceil((99-issueAge)/20);
    assert.equal(tables.length,groups*2,'Table A and Table B span every expected page');
    const years=(entries)=>entries.flatMap(x=>[...x[1].matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td>/g)]
      .map(match=>[Number(match[1]),Number(match[2])]));
    const tableA=years(tables.slice(0,groups));
    const tableB=years(tables.slice(groups));
    for(const entries of [tableA,tableB]){
      assert.equal(entries.length,99-issueAge);
      for(let i=0;i<entries.length;i++){
        assert.equal(entries[i][0],i+1);
        assert.equal(entries[i][1],issueAge+i);
      }
    }
    assert.doesNotMatch(doc,/6 ข้อควรทราบ|cvResearchCandidate/);
  }
});
