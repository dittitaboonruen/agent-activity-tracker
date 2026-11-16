import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/illustrations/royal_partners_illustration_tool.html', import.meta.url), 'utf8');

function getFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' should exist');
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, name + ' should close');
  return source.slice(start, end + 2);
}

function harness(tab = 'ciprocare', sum = 150000) {
  const elements = new Map();
  const listeners = new Map();
  const getElementById = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        textContent: '',
        style: {},
        classList: { add() {}, remove() {} },
        addEventListener(event, callback) { listeners.set(id + ':' + event, callback); },
      });
    }
    return elements.get(id);
  };
  const state = {
    tab, sum, age: 35, gender: 'ชาย', tax: 0.1,
    customer: {}, agent: {},
  };
  const sandbox = { state, document: { getElementById }, render() {} };
  const names = [
    'minSumInsuredForPlan', 'syncSelectedPlanSumMinimum',
    'validateSumInsured', 'setSumValidationUI',
    'parseInsuredAmount', 'formatInsuredAmount', 'wireInputs',
  ];
  vm.runInNewContext(
    'const SUM_INSURED_MIN=100000;' +
    'const SELECTED_PLAN_MIN_SUM_INSURED=200000;' +
    'const SUM_INSURED_MAX=50000000;\n' +
    names.map(getFunction).join('\n') +
    '\nglobalThis.testExports={ ' + names.join(', ') + ' };',
    sandbox
  );
  return { state, getElementById, listeners, ...sandbox.testExports };
}

test('CI ProCare, SuperCare (10/99 and 20/99) and Annuity Fix have a 200k floor', () => {
  for (const tab of ['ciprocare', 'cisupercare', 'annuityfix']) {
    const app = harness(tab);
    app.syncSelectedPlanSumMinimum();
    assert.equal(app.state.sum, 200000);
    assert.equal(app.getElementById('in-sum').value, '200,000');
    assert.match(app.getElementById('sum-help').textContent, /200,000/);
    assert.equal(app.validateSumInsured(199999).ok, false);
    assert.equal(app.validateSumInsured(200000).ok, true);
    assert.equal(app.validateSumInsured(250000).ok, true);
  }
  assert.match(source, /CI SuperCare 10\/99/);
  assert.match(source, /CI SuperCare 20\/99/);
});

test('unrelated insurance plans keep the existing 100k floor', () => {
  for (const tab of ['paylife20', 'pay20happy', 'pay20saver', 'excellent', 'pay25', 'annuitysure']) {
    const app = harness(tab);
    app.syncSelectedPlanSumMinimum();
    assert.equal(app.state.sum, 150000);
    assert.equal(app.validateSumInsured(100000).ok, true);
    assert.equal(app.validateSumInsured(99999).ok, false);
    assert.match(app.getElementById('sum-help').textContent, /100,000/);
  }
});

test('switching from another product enforces 200k without changing rate calculations', () => {
  const app = harness('pay25');
  app.state.tab = 'ciprocare';
  app.syncSelectedPlanSumMinimum();
  assert.equal(app.state.sum, 200000);
  assert.match(getFunction('render'), /syncSelectedPlanSumMinimum\(\)/);
});

test('blur resets an amount below the selected minimum to 200k', () => {
  const app = harness('cisupercare', 250000);
  app.wireInputs();
  const input = app.getElementById('in-sum');
  input.value = '150,000';
  app.listeners.get('in-sum:blur')({ target: input });
  assert.equal(app.state.sum, 200000);
  assert.equal(input.value, '200,000');
});

test('PDF validation also rejects sub-200k CI sums', () => {
  for (const name of ['validateCIProCareReportData', 'validateCISuperCareReportData']) {
    const body = getFunction(name);
    assert.match(body, /sumInsured < SELECTED_PLAN_MIN_SUM_INSURED/);
    assert.match(body, /ขั้นต่ำ 200,000 บาท/);
  }
});
