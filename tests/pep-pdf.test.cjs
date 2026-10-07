const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',code)(name => name.startsWith('@/') ? load(name.slice(2)+'.ts') : require(name),module,module.exports);
  return module.exports;
}
const pdf=load('lib/pep-pdf.ts');
const context={agentId:4,agentName:'Test',agentCode:'TEST001',pepAgentName:'Alias',startDate:'2026-10-01',endDate:'2026-10-07',channel:'ทุกช่องทาง',year:2026,activityState:'ready',kpis:{totalCustomers:1,totalSubmissions:1,totalActivities:1,moneyMapDone:0,presentations:0,closedSales:0},fetchedAt:'2026-10-07T07:00:00Z'};
const note={id:1,agentName:'Alias',pepDate:'2026-10-07',recommendation:'Comment',coachingQuestion:'Question',actionPlan:'Plan',updatedAt:'2026-10-07T07:00:00Z'};
function install(options={}) {
 const calls=[];const previous=global.fetch;
 global.fetch=async(url,request)=>{
  calls.push({url,request});
  if(options.denied&&url==='/api/dashboard-agents')return{ok:false,status:403,json:async()=>({error:'Denied'})};
  if(options.optionalError&&url.startsWith('/api/skool'))return{ok:false,status:500,json:async()=>({error:'Failure'})};
  const body=url==='/api/dashboard-agents'?{agents:options.other?[{id:5,agentName:'Other'}]:[{id:4,agentName:'Test'}]}:
   url.startsWith('/api/pep-notes')?{notes:options.deleted?[]:[options.changed?{...note,updatedAt:'2026-10-07T08:00:00Z'}:note]}:
   url.startsWith('/api/skool-progress')?{success:true,summary:{records:0,completed:0,averageProgress:0,syncedAt:null}}:
   url.startsWith('/api/skool-quiz-results')?{success:true,rows:[{id:1,agentId:4,lessonId:1,lessonActive:true,passed:false,scorePercent:0,submittedAt:'2026-10-07T07:00:00Z',updatedAt:'2026-10-07T07:00:00Z'},{id:2,agentId:5,lessonId:2,lessonActive:true,passed:true,scorePercent:100,submittedAt:'2026-10-07T07:00:00Z',updatedAt:'2026-10-07T07:00:00Z'}]}:
   {target:{target_fyp:0,target_fyc:0,target_case:0}};
  return{ok:true,status:200,json:async()=>body};
 };
 return{calls,restore:()=>global.fetch=previous};
}
test('PDF requests one numeric agent ID, uses legacy PEP alias, and excludes unrelated quiz rows',async()=>{
 const h=install();try{const r=await pdf.loadPepPdfReport(context,note,new AbortController().signal);assert.equal(r.note.id,1);assert.equal(r.quiz.results,1);assert.equal(r.quiz.failed,1);assert.equal(r.quiz.averageScore,0);assert.equal(r.target.target_fyp,0);assert.ok(h.calls.some(c=>c.url==='/api/pep-notes?agent=Alias'));assert.ok(h.calls.filter(c=>c.url.startsWith('/api/skool')).every(c=>c.url.endsWith('?agent_id=4')));assert.ok(h.calls.every(c=>c.request.cache==='no-store'));}finally{h.restore()}
});
test('invalid dates, impossible dates, reversed range, all-agent sentinel and loading are rejected before requests',async()=>{
 const h=install();try{for(const change of [{agentId:0},{startDate:''},{startDate:'2026-02-30'},{startDate:'2026-10-08'},{activityState:'loading'}])await assert.rejects(pdf.loadPepPdfReport({...context,...change},null,new AbortController().signal));assert.equal(h.calls.length,0);}finally{h.restore()}
});
test('current permission and roster mismatch block exporting cached data',async()=>{
 for(const options of [{denied:true},{other:true}]){const h=install(options);try{await assert.rejects(pdf.loadPepPdfReport(context,note,new AbortController().signal));}finally{h.restore()}}
});
test('deleted or concurrently changed PEP comments cannot be attached',async()=>{
 for(const options of [{deleted:true},{changed:true}]){const h=install(options);try{await assert.rejects(pdf.loadPepPdfReport(context,note,new AbortController().signal),/ถูกแก้ไขหรือลบ/);}finally{h.restore()}}
});
test('optional learning failure remains visibly unavailable and no-comment export remains valid',async()=>{
 const h=install({optionalError:true});try{const r=await pdf.loadPepPdfReport(context,null,new AbortController().signal);assert.equal(r.note,null);assert.equal(r.skoolError,true);assert.equal(r.quizError,true);assert.equal(r.quiz,null);assert.match(pdf.reportLearningLines(r)[0][1],/โหลดข้อมูลไม่สำเร็จ/);}finally{h.restore()}
});
test('no activity differs from recorded zero and missing learning differs from failed quizzes',async()=>{
 const h=install();try{const r=await pdf.loadPepPdfReport(context,null,new AbortController().signal);assert.equal(pdf.reportActivityLines(r).length,6);assert.equal(pdf.reportActivityLines(r)[3][1],'0 บันทึก');for(const state of ['empty','error','loading'])assert.deepEqual(pdf.reportActivityLines({...r,context:{...context,activityState:state}}),[]);assert.match(pdf.reportLearningLines(r)[0][1],/ยังไม่มีข้อมูลการเรียน/);assert.match(pdf.reportLearningLines(r)[2][1],/คะแนนเฉลี่ย 0%/);}finally{h.restore()}
});
test('aborted loading cannot publish a report and filename safely retains leading zeros',async()=>{
 const h=install();try{const controller=new AbortController();controller.abort();await assert.rejects(pdf.loadPepPdfReport(context,null,controller.signal),/Aborted/);assert.equal(pdf.pepPdfFilename({...context,agentCode:'00123'}),'PEP_00123_2026-10-01_2026-10-07.pdf');assert.ok(!pdf.pepPdfFilename({...context,agentCode:'A/B:C'}).includes('/'));}finally{h.restore()}
});
