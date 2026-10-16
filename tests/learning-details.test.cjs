const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
function load(file){const module={exports:{}};const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)(name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name),module,module.exports);return module.exports;}
const details=load('lib/learning-details.ts');const pdf=load('lib/pep-pdf.ts');
const course=(id,status,extra={})=>({agentId:4,agentName:'Test',agentCode:'TEST001',courseId:id,courseName:'Course '+id,hasAccess:true,progressPercent:status==='completed'?100:status==='in_progress'?50:0,status,syncedAt:'2026-10-16T07:00:00Z',...extra});
const quiz=(id,lessonId,passed,extra={})=>({id,agentId:4,agentName:'Test',agentCode:'TEST001',courseName:'Health Insurance',lessonName:'Post quiz',parentLessonName:'AIA Health Happy',lessonId,lessonActive:true,score:passed?5:2,maxScore:5,scorePercent:passed?100:40,passed,submittedAt:'2026-10-16T07:00:00Z',updatedAt:'2026-10-16T07:00:00Z',...extra});
test('latest failed list clears after passing retake and does not revive regraded older failure',()=>{
 const old=quiz(1,10,false,{submittedAt:'2026-10-15T07:00:00Z',updatedAt:'2026-10-17T07:00:00Z'});
 const pass=quiz(2,10,true);const fail=quiz(3,11,false);
 const disabled=quiz(4,12,false,{lessonActive:false});const other=quiz(5,13,false,{agentId:99});
 assert.deepEqual(details.failedQuizAttempts([old,pass,fail,disabled,other],4).map(r=>r.id),[3]);
 assert.deepEqual(details.failedQuizAttempts([old,pass],4),[]);
 assert.deepEqual(details.failedQuizAttempts([fail],null),[]);
 assert.deepEqual(details.failedQuizAttempts([],4),[]);
 assert.equal(details.failedQuizAttempts([fail,other],'all').length,2);
 assert.match(details.quizLessonTitle(fail),/Health Insurance.*AIA Health Happy.*Post quiz/);
});
test('course groups preserve actual CSV status, separate access, and never invent unimported lessons',()=>{
 const rows=[course(1,'completed'),course(2,'in_progress'),course(3,'not_started'),course(4,'not_started',{hasAccess:false}),course(5,'completed',{agentId:99})];
 const own=details.selectCourseRows(rows,4);assert.equal(own.length,4);
 const groups=details.courseProgressGroups(own);
 assert.deepEqual(groups.map(g=>g.rows.map(r=>r.courseId)),[[1],[2],[3],[4]]);
 assert.deepEqual(details.selectCourseRows(rows,null),[]);
 assert(details.courseProgressGroups([]).every(g=>g.rows.length===0));
 assert.equal(own.length,4);assert.equal(rows[0].courseId,1);
});
test('PDF learning detail includes named failures, CSV course groups and only selected agent',()=>{
 const context={agentId:4};const rows=[course(1,'completed'),course(2,'in_progress'),course(3,'not_started'),course(4,'not_started',{hasAccess:false}),course(99,'completed',{agentId:99,courseName:'PRIVATE OTHER'})];
 const report={context,skoolRows:rows,quizRows:[quiz(1,10,false),quiz(2,11,false,{agentId:99,parentLessonName:'PRIVATE OTHER'})],quiz:{results:1},skoolError:false,quizError:false};
 const lines=pdf.reportLearningDetailLines(report);const output=lines.flat().join('\n');
 assert.match(output,/AIA Health Happy/);assert.match(output,/2\/5 คะแนน \(40%\)/);assert.match(output,/Course 1/);assert.match(output,/Course 2/);assert.match(output,/Course 3/);assert.match(output,/ยังไม่มีสิทธิ์/);
 assert.doesNotMatch(output,/PRIVATE OTHER/);assert.match(output,/รายบทภายในคอร์สไม่ได้/);
 assert.equal(lines.find(([label])=>label==='ยังไม่เริ่มเรียน')[1],'1 คอร์ส');
});
test('PDF missing CSV and missing quiz do not mean not-started or failed',()=>{
 const lines=pdf.reportLearningDetailLines({context:{agentId:4},skoolRows:[],quizRows:[],quiz:{results:0},skoolError:false,quizError:false});
 assert.match(lines.flat().join(' '),/ยังไม่มีผลสอบ/);assert.match(lines.flat().join(' '),/ยังไม่มีรายละเอียดการเรียน/);
 assert(!lines.some(([label])=>label==='ยังไม่เริ่มเรียน'));
 assert.deepEqual(pdf.reportLearningDetailLines({context:{agentId:4},skoolError:true,quizError:true}),[]);
});
test('PDF loader captures selected course and quiz rows from existing scoped APIs',async()=>{
 const previous=global.fetch;const context={agentId:4,agentName:'Test',pepAgentName:'Test',startDate:'2026-10-01',endDate:'2026-10-16',activityState:'empty',year:2026};
 global.fetch=async url=>({ok:true,status:200,json:async()=>url==='/api/dashboard-agents'?{agents:[{id:4,agentName:'Test'}]}:url.startsWith('/api/pep-notes')?{notes:[]}:url.startsWith('/api/skool-progress')?{success:true,summary:{records:1},rows:[course(1,'completed'),course(2,'completed',{agentId:99})]}:url.startsWith('/api/skool-quiz-results')?{success:true,rows:[quiz(1,10,false),quiz(2,11,false,{agentId:99})]}:{target:null}});
 try{const report=await pdf.loadPepPdfReport(context,null,new AbortController().signal);assert.equal(report.skoolRows.length,1);assert.equal(report.skoolRows[0].courseId,1);assert.equal(report.quizRows.length,1);assert.equal(report.quiz.failed,1);}finally{global.fetch=previous}
});
