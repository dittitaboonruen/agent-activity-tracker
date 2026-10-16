const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function harness(options = {}) {
  const tables = {
    agent_master: [
      { id: 1, agent_code: '00123', agent_name: 'One', unit_id: 1, active: true },
      { id: 2, agent_code: '00234', agent_name: 'Two', unit_id: 1, active: true },
      { id: 3, agent_code: '00345', agent_name: 'Other team', unit_id: 2, active: true },
      { id: 4, agent_code: 'TEST001', agent_name: '[TEST] Dittita', unit_id: 1, active: true },
      { id: 5, agent_code: '00567', agent_name: 'Inactive', unit_id: 1, active: false },
    ],
    units: [{ id: 1, unit_name: 'Team A' }, { id: 2, unit_name: 'Team B' }],
    skool_members: [1, 2, 3].map(id => ({ id: id * 10, agent_id: id, first_name: 'Member ' + id, active: true })),
    learning_courses: [{ id: 7, course_name: 'Course' }],
    learning_course_progress: [
      { skool_member_id: 10, course_id: 7, progress_percent: 100, completed: true, started: true, synced_at: '2026-10-02T00:00:00Z' },
      { skool_member_id: 20, course_id: 7, progress_percent: 0, completed: false, started: false, synced_at: '2026-10-03T00:00:00Z' },
      { skool_member_id: 30, course_id: 7, progress_percent: 40, completed: false, started: true, synced_at: '2026-10-04T00:00:00Z' },
    ],
    learning_lessons: [{ id: 8, course_id: 7, lesson_name: 'Quiz', parent_lesson_id: null, active: true }],
    learning_quiz_results: [1, 2, 3, 4].map(id => ({ id, agent_id: id, lesson_id: 8, score: id === 2 ? 0 : 8, max_score: 10, score_percent: id === 2 ? 0 : 80, passed: id !== 2, submitted_at: '2026-10-07T03:00:00Z', updated_at: '2026-10-07T03:00:00Z' })),
    ...options.tables,
  };
  const calls = [];
  const profile = { role: 'manager', active: true, unit_id: 1, can_view_all_data: false, ...options.profile };
  const auth = {
    auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: 'u1' } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: options.profileError ? { code: 'TEST' } : null }) }) }) }),
  };
  const db = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    let fields = '*', range;
    const q = {
      select(value) { fields = value; return q; },
      eq(key, value) { call.filters.push([key, value, false]); return q; },
      in(key, values) { call.filters.push([key, values, true]); return q; },
      order() { return q; },
      range(a, b) { range = [a, b]; return q; },
      then(resolve, reject) {
        if (options.failTable === table) return Promise.resolve({ data: null, error: { code: 'TEST', message: 'private' } }).then(resolve, reject);
        let rows = tables[table].filter(row => call.filters.every(([key, value, array]) => array ? value.includes(row[key]) : row[key] === value));
        if (range) rows = rows.slice(range[0], range[1] + 1);
        rows = rows.map(row => fields === '*' ? { ...row } : Object.fromEntries(fields.split(',').map(key => [key.trim(), row[key.trim()]])));
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    }; return q;
  } };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', js)(name => {
      if (name === '@/lib/supabase') return { getSupabaseClient: () => db };
      if (name === '@/lib/supabase/server') return { createClient: () => auth };
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      return require(name);
    }, module, module.exports);
    cache[file] = module.exports; return module.exports;
  }
  return { calls, tables, load };
}
const endpoints = ['skool-progress', 'skool-quiz-results'];
const get = (h, endpoint, query = '') => h.load(`app/api/${endpoint}/route.ts`).GET(new NextRequest('https://test/api/' + endpoint + query));

test('both learning APIs filter one agent within the authorized unit', async () => {
  for (const endpoint of endpoints) {
    const h = harness(); const response = await get(h, endpoint, '?agent_id=2'); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.success, true);
    assert.deepEqual(body.rows.map(row => row.agentId), [2]);
    assert(h.calls[0].filters.some(([key, value]) => key === 'unit_id' && value === 1));
    assert(h.calls[0].filters.some(([key, value]) => key === 'id' && value === 2));
    assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
  }
});

test('selected Skool summary and quiz summary preserve a genuine zero', async () => {
  const h = harness(); const progress = await (await get(h, 'skool-progress', '?agent_id=2')).json();
  assert.equal(progress.summary.linkedAgents, 1); assert.equal(progress.summary.records, 1);
  assert.equal(progress.summary.averageProgress, 0); assert.equal(progress.summary.notStarted, 1);
  assert.equal(progress.summary.completed, 0); assert.equal(progress.summary.syncedAt, '2026-10-03T00:00:00Z');
  const quiz = await (await get(h, 'skool-quiz-results', '?agent_id=2')).json();
  const summary = h.load('lib/skool-quiz.ts').summarizeQuizResults(quiz.rows);
  assert.equal(summary.averageScore, 0); assert.equal(summary.failed, 1); assert.equal(summary.passed, 0);
});

test('all means all permitted agents and retains the old endpoint behavior', async () => {
  const h = harness(); const progress = await (await get(h, 'skool-progress')).json();
  assert.deepEqual(progress.rows.map(row => row.agentId), [1, 2]); assert.equal(progress.summary.averageProgress, 50);
  const quiz = await (await get(h, 'skool-quiz-results')).json();
  assert.deepEqual(new Set(quiz.rows.map(row => row.agentId)), new Set([1, 2, 4]));
});

test('global permission permits selecting another unit without returning other agents', async () => {
  for (const endpoint of endpoints) {
    const h = harness({ profile: { can_view_all_data: true, unit_id: null } });
    const body = await (await get(h, endpoint, '?agent_id=3')).json();
    assert.deepEqual(body.rows.map(row => row.agentId), [3]);
  }
});

test('other unit, inactive and nonexistent selections have the same generic 404', async () => {
  for (const endpoint of endpoints) {
    const messages = [];
    for (const id of [3, 5, 999]) {
      const h = harness(); const response = await get(h, endpoint, '?agent_id=' + id);
      assert.equal(response.status, 404); const body = await response.json(); messages.push(body.error);
      assert.equal(body.rows, undefined); assert.equal(h.calls.length, 1);
    }
    assert.equal(new Set(messages).size, 1);
  }
});

test('malformed, duplicate and scope override query parameters are rejected', async () => {
  for (const endpoint of endpoints) for (const query of ['?agent_id=', '?agent_id=0', '?agent_id=-1', '?agent_id=1.5', '?agent_id=01', '?agent_id=1e2', '?agent_id=NaN', '?agent_id=9007199254740992', '?agent_id=1&agent_id=2', '?agent_id=1&unit_id=2']) {
    const h = harness(); assert.equal((await get(h, endpoint, query)).status, 400); assert.equal(h.calls.length, 0);
  }
});

test('authentication and profile checks still apply when an agent ID is supplied', async () => {
  for (const endpoint of endpoints) for (const [options, status] of [[{ signedOut: true }, 401], [{ profile: { active: false } }, 403], [{ profile: { role: 'agent' } }, 403], [{ profile: { unit_id: null } }, 403], [{ profileError: true }, 500]]) {
    const h = harness(options); assert.equal((await get(h, endpoint, '?agent_id=1')).status, status); assert.equal(h.calls.length, 0);
  }
});

test('TEST can have quiz results with no Jotform or Skool member/CSV data', async () => {
  const h = harness(); const progress = await (await get(h, 'skool-progress', '?agent_id=4')).json();
  assert.equal(progress.success, true); assert.equal(progress.rows.length, 0); assert.equal(progress.summary.records, 0);
  const quiz = await (await get(h, 'skool-quiz-results', '?agent_id=4')).json();
  assert.equal(quiz.rows.length, 1); assert.equal(quiz.rows[0].agentCode, 'TEST001'); assert.equal(quiz.rows[0].passed, true);
});

test('no quiz means no attempts or failures, never another agent results', async () => {
  const h = harness({ tables: { learning_quiz_results: [] } });
  const quiz = await (await get(h, 'skool-quiz-results', '?agent_id=4')).json();
  assert.deepEqual(quiz.rows, []); assert.equal(h.load('lib/skool-quiz.ts').summarizeQuizResults(quiz.rows).failed, 0);
});

test('selected IDs resolve from master roster and ambiguous/missing names cannot become all', () => {
  const h = harness(); const select = h.load('lib/dashboard-agents.ts').dashboardLearningSelection;
  const agents = [{ id: 4, agentName: '[TEST] Dittita' }, { id: 1, agentName: 'Same' }, { id: 2, agentName: 'Same' }];
  assert.equal(select('[TEST] Dittita', agents), 4); assert.equal(select('all', agents), 'all');
  assert.equal(select('Same', agents), null); assert.equal(select('Missing', agents), null);
  const url = h.load('lib/learning-filter.ts').learningApiUrl;
  assert.equal(url('/api/skool-progress', 4), '/api/skool-progress?agent_id=4');
  assert.equal(url('/api/skool-progress', 'all'), '/api/skool-progress');
  assert.throws(() => url('/api/skool-progress', null));
});

// Execute the component's real hooks and async request handlers with a small
// deterministic runner; JSX is rendered with React DOM's real server renderer.
function componentRunner(file, fetcher) {
  const states = [], refs = [], effects = [], callbacks = [];
  let cursor = 0, pending = [], component, props, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    ...React,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return refs[i] ?? (refs[i] = { current: initial }); },
    useMemo(fn, deps) { const i = cursor++; if (!same(callbacks[i]?.deps, deps)) callbacks[i] = { value: fn(), deps }; return callbacks[i].value; },
    useCallback(fn, deps) { const i = cursor++; if (!same(callbacks[i]?.deps, deps)) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(effects[i]?.deps, deps)) pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const loader = harness().load;
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', source)(name => {
    if (name === 'react') return hooks;
    if (name === 'next/link') return { default: p => React.createElement('a', { href: p.href }, p.children), __esModule: true };
    if (name === './ui') return { Card: p => React.createElement('div', null, p.children) };
    if (name === './SkoolQuizSummary') return { default: p => React.createElement('div', { 'data-quiz-agent': p.agentSelection }), __esModule: true };
    if (name === './SkoolCourseDetails') {
      const child = { exports: {} };
      const childSource = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/SkoolCourseDetails.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
      new Function('require', 'module', 'exports', childSource)(id => id.startsWith('@/') ? loader(id.slice(2) + '.ts') : require(id), child, child.exports);
      return child.exports;
    }
    if (name.startsWith('@/')) return loader(name.slice(2) + '.ts');
    return require(name);
  }, module, module.exports, fetcher);
  component = module.exports.default;
  return {
    render(next) { props = next ?? props; cursor = 0; tree = component(props); const run = pending; pending = []; run.forEach(fn => fn()); return tree; },
    html() { return renderToStaticMarkup(tree); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Skool card requests the selected ID, shows loading and a dash for missing CSV, and passes ID to quiz', async () => {
  const requests = []; const h = harness();
  const runner = componentRunner('components/SkoolSummaryCard.tsx', async url => { requests.push(url); return get(h, 'skool-progress', '?agent_id=4'); });
  runner.render({ agentSelection: 4, agentName: '[TEST] Dittita' });
  assert(runner.html().includes('กำลังโหลดความคืบหน้าการเรียน'));
  await tick(); runner.render(); const html = runner.html();
  assert.deepEqual(requests, ['/api/skool-progress?agent_id=4']);
  assert(html.includes('[TEST] Dittita')); assert(html.includes('ยังไม่มีข้อมูลการเรียนที่นำเข้าหรือจับคู่'));
  assert(html.includes('—')); assert(html.includes('data-quiz-agent="4"'));
  assert(html.includes('/dashboard/skool?agent_id=4')); runner.unmount();
});

test('Quiz summary requests selected ID independently and preserves latest result behavior', async () => {
  const requests = []; const h = harness();
  const runner = componentRunner('components/SkoolQuizSummary.tsx', async url => { requests.push(url); return get(h, 'skool-quiz-results', '?agent_id=2'); });
  runner.render({ refreshKey: 0, agentSelection: 2, agentName: 'Two' }); await tick(); runner.render();
  assert.deepEqual(requests, ['/api/skool-quiz-results?agent_id=2']);
  assert(runner.html().includes('ตัวแทน: Two')); assert(runner.html().includes('0%')); assert(!runner.html().includes('80%')); runner.unmount();
});

test('old response cannot replace selected data after unmount or cancelled selection', async () => {
  let resolveOld; const h = harness();
  const runner = componentRunner('components/SkoolQuizSummary.tsx', () => new Promise(resolve => { resolveOld = resolve; }));
  runner.render({ refreshKey: 0, agentSelection: 1, agentName: 'One' }); runner.unmount();
  resolveOld(await get(h, 'skool-quiz-results', '?agent_id=1')); await tick(); runner.render();
  assert(runner.html().includes('กำลังโหลดผลสอบ')); assert(!runner.html().includes('80%'));
});

test('unresolved selection displays an error and never fetches all-agent data', async () => {
  for (const file of ['components/SkoolSummaryCard.tsx', 'components/SkoolQuizSummary.tsx']) {
    let requests = 0; const runner = componentRunner(file, async () => { requests++; throw new Error('must not fetch'); });
    runner.render({ refreshKey: 0, agentSelection: null, agentName: 'Ambiguous' }); await tick(); runner.render();
    assert.equal(requests, 0); assert(runner.html().includes('ไม่สามารถระบุตัวแทนที่เลือกได้')); runner.unmount();
  }
});


test('quiz detail receives the same selected ID as the summary and contains only that agent', async () => {
  const requests = []; const h = harness();
  const runner = componentRunner('components/SkoolQuizResults.tsx', async url => { requests.push(url); return get(h, 'skool-quiz-results', '?agent_id=4'); });
  runner.render({ refreshKey: 0, agentSelection: 4 }); await tick(); runner.render();
  assert.deepEqual(requests, ['/api/skool-quiz-results?agent_id=4']);
  assert(runner.html().includes('[TEST] Dittita')); assert(!runner.html().includes('Other team')); runner.unmount();
});
