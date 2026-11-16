import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/illustrations/royal_partners_illustration_tool.html', import.meta.url), 'utf8');
function getFunction(name){
  const start = source.indexOf('function '+name+'(');
  assert.notEqual(start, -1, name+' defined');
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, name+' closed');
  return source.slice(start,end+2);
}

test('only standalone AIA 20Pay Life Plus uses 300,000 minimum',()=>{
  const state={tab:'paylifeplus'};
  const sandbox={state};
  vm.runInNewContext(
    'const SUM_INSURED_MIN=100000;' +
    'const SELECTED_PLAN_MIN_SUM_INSURED=200000;' +
    'const PAYLIFE_PLUS_MIN_SUM_INSURED=300000;\n' +
    getFunction('minSumInsuredForPlan') +
    '\nglobalThis.getMinimum=minSumInsuredForPlan;',
    sandbox
  );
  for(const [tab,expected] of Object.entries({
    paylifeplus:300000,
    ciprocare:200000,cisupercare:200000,annuityfix:200000,
    plusHappy:100000,plusSaver:100000,annuitysure:100000,
    paylife20:100000,excellent:100000,pay25:100000
  })){
    state.tab=tab;
    assert.equal(sandbox.getMinimum(),expected,tab);
  }
});

test('10, 15 and 20 Pay calculate from 300,000 but combinations retain their existing 150,000 model minimum',()=>{
  const sandbox={PAYLIFE_PLUS_RATES:Array.from({length:76},()=>Array(6).fill(100))};
  vm.runInNewContext(getFunction('calcPayLifePlus') + '\nglobalThis.calc=calcPayLifePlus;',sandbox);
  for(const term of [10,15,20]){
    assert.equal(sandbox.calc(35,'ชาย',299999,term,0.1,300000).ok,false);
    assert.equal(sandbox.calc(35,'ชาย',300000,term,0.1,300000).ok,true);
    assert.equal(sandbox.calc(35,'หญิง',350000,term,0.1,300000).ok,true);
    assert.equal(sandbox.calc(35,'ชาย',150000,term,0.1).ok,true);
    assert.equal(sandbox.calc(35,'ชาย',149999,term,0.1).ok,false);
  }
});

test('standalone screen, PDF and hint use 300k while combo calls remain unchanged',()=>{
  assert.match(source,/const result=calcPayLifePlus\(state\.age,state\.gender,state\.sum,term,state\.tax,PAYLIFE_PLUS_MIN_SUM_INSURED\)/);
  assert.match(source,/const r=calcPayLifePlus\(state\.age,state\.gender,state\.sum,state\.paylifeplus\.term,state\.tax,PAYLIFE_PLUS_MIN_SUM_INSURED\)/);
  assert.match(source,/const main=calcPayLifePlus\(age,state\.gender,state\.sum,cfg\.term,state\.tax\)/);
  assert.match(source,/ทุนขั้นต่ำทุกระยะชำระเบี้ย 300,000 บาท/);
});
