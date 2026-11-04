const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const accessActor = '00000000-0000-4000-8000-000000000001';
const entity = { entity_code: '403422', entity_name: 'ณัฐยา', nickname: null, unit_id: 1, unit_code: 'CENTRAL', unit_name: 'หน่วยกลาง' };
const complete = () => ({ ...entity, month_cases_submitted: 0, month_fyp_submitted: 0, month_pa_cases: 0, month_pa_fyp: 0, month_pa_fyc: 0, ytd_pa_cases: 0, ytd_pa_fyp: 0, ytd_pa_fyc: 0, approved_months: null, note: '', month_cases: 0, month_fyp: 0, month_fyc: 0, ytd_cases: 0, ytd_fyp: 0, ytd_fyc: 0, exp: 0, lap: 0, limra: 0, active_agents: null });
class AccessError extends Error { constructor(message, status) { super(message); this.status = status; } }
function fixture(options = {}) {
  let calls = 0, rpc = null, area = null;
  const database = { from(table) {
    calls++;
    const result = table === 'agent_master' ? { data: [{ agent_code: '403422', agent_name: 'ณัฐยา', agent_nickname: null, unit_id: 1 }] }
      : table === 'units' ? { data: [{ id: 1, unit_code: 'CENTRAL', unit_name: 'หน่วยกลาง' }] }
      : table === 'aia_monthly_batches' ? options.missing ? { data: null, error: { code: 'PGRST205' } } : { data: options.existing ? { id: 10, revision: 1, status: 'draft' } : null }
      : table === 'aia_monthly_rows' ? options.oldSchema ? { data: null, error: { code: '42703' } } : { data: options.existing ? [{ ...complete(), lap: 100 }] : [] } : { data: [] };
    const chain = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle: async () => result, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
    return chain;
  }, async rpc(name, args) { rpc = { name, args }; return options.conflict ? { data: null, error: { code: '40001' } } : { data: { id: 10, revision: 2, status: 'draft' }, error: null }; } };
  function compile(file, custom) { const m = new Module(file, module); m.filename = file; m.paths = module.paths; if (custom) m.require = custom; m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file); return m.exports; }
  const core = compile(path.join(root, 'lib/aia-monthly.ts'));
  const handlers = compile(path.join(root, 'lib/aia-monthly-server.ts'), name => {
    if (name === 'server-only') return {};
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => Response.json(body, opts) } };
    if (name === '@/lib/supabase') return { getSupabaseClient: () => database };
    if (name === '@/lib/aia-monthly') return core;
    if (name === '@/lib/rate-limit') return { checkRateLimit: () => ({ allowed: true }) };
    if (name === '@/lib/dashboard-access') return { DashboardAccessError: AccessError, getDashboardAccess: async requested => { area = requested; if (options.denied) throw new AccessError('denied', 403); return { userId: accessActor }; } };
    throw Error('Unexpected import '+name);
  });
  const request = body => ({ nextUrl: new URL('https://example.org/api/daily-production/aia?year=2026&month=8&scope=person'), json: async () => body });
  const body = overrides => ({ schema_version: 2, year: 2026, month: 8, scope: 'person', action: 'draft', revision: options.existing ? 1 : 0, as_of_date: '2026-08-31', rows: [complete()], ...overrides });
  return { handlers, request, body, get calls() { return calls; }, get rpc() { return rpc; }, get area() { return area; } };
}
test('read and write deny unauthorized users before touching service-role storage', async () => {
  const f = fixture({ denied: true });
  assert.equal((await f.handlers.readAiaMonthly(f.request(), 'monthly-performance')).status, 403);
  assert.equal(f.calls, 0); assert.equal(f.area, 'monthly-performance');
  assert.equal((await f.handlers.writeAiaMonthly(f.request(f.body()))).status, 403);
  assert.equal(f.calls, 0); assert.equal(f.rpc, null); assert.equal(f.area, 'daily-production');
});
test('missing schema returns explicit configured=false, preserving legacy daily reporting', async () => {
  const f = fixture({ missing: true }); const response = await f.handlers.readAiaMonthly(f.request(), 'monthly-performance');
  assert.equal(response.status, 200); assert.equal((await response.json()).configured, false);
});
test('write verifies canonical identity and actor, without overwriting new metric values with old rows', async () => {
  const f = fixture({ existing: true }); const body = f.body({ actor: 'attacker', rows: [{ ...complete(), entity_name: 'forged', unit_id: 999, lap: 50 }] });
  assert.equal((await f.handlers.writeAiaMonthly(f.request(body))).status, 200);
  assert.equal(f.rpc.args.p_actor, accessActor); assert.equal(f.rpc.args.p_rows[0].entity_name, 'ณัฐยา');
  assert.equal(f.rpc.args.p_rows[0].unit_id, 1); assert.equal(f.rpc.args.p_rows[0].lap, 50);
});
test('unknown codes and incomplete confirmation never reach the save RPC', async () => {
  const f = fixture();
  assert.equal((await f.handlers.writeAiaMonthly(f.request(f.body({ rows: [{ ...complete(), entity_code: 'UNKNOWN' }] })))).status, 400);
  assert.equal(f.rpc, null);
  assert.equal((await f.handlers.writeAiaMonthly(f.request(f.body({ action: 'confirm', rows: [{ ...complete(), limra: null }] })))).status, 400);
  assert.equal(f.rpc, null);
});
test('stale revision returns 409 instead of replacing another editor values', async () => {
  const f = fixture({ conflict: true });
  assert.equal((await f.handlers.writeAiaMonthly(f.request(f.body()))).status, 409);
});
test('invalid actual dates are rejected before storage', async () => {
  const f = fixture();
  assert.equal((await f.handlers.writeAiaMonthly(f.request(f.body({ as_of_date: '2026-02-30' })))).status, 400);
  assert.equal(f.calls, 0);
});

test('legacy monthly daily source reads past server row caps instead of truncating YTD', async () => {
  const all = Array.from({ length: 1501 }, (_, id) => ({ id, aia_fyp_approved: 1 })), offsets = [];
  const db = { from: () => ({ select() { return this; }, order() { return this; }, gte() { return this; }, lte() { return this; }, async range(start, end) { offsets.push(start); return { data: all.slice(start, Math.min(end + 1, start + 500)), error: null }; } }) };
  const file = path.join(root, 'app/api/monthly-performance/route.ts'), m = new Module(file, module); m.filename = file; m.paths = module.paths;
  m.require = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => Response.json(body, opts) } };
    if (name === '@/lib/supabase') return { getSupabaseClient: () => db };
    if (name === '@/lib/dashboard-access') return { DashboardAccessError: AccessError, getDashboardAccess: async () => ({ userId: accessActor }) };
    throw Error('Unexpected import '+name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
  const response = await m.exports.GET({ nextUrl: new URL('https://example.org/api/monthly-performance?year=2026&month=8') });
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.rows.length, 1501); assert.equal(data.rows.reduce((s,r) => s+r.aia_fyp_approved,0),1501);
  assert.deepEqual(offsets,[0,500,1000,1500,1501]);
});

test('old nine-field schema cannot silently discard submitted totals or PA', async () => {
  const f = fixture({ oldSchema: true });
  const read = await f.handlers.readAiaMonthly(f.request(), 'monthly-performance');
  assert.equal((await read.json()).configured, false);
  const write = await f.handlers.writeAiaMonthly(f.request(f.body()));
  assert.equal(write.status, 503); assert.equal(f.rpc, null);
});

test('stale pre-monthly clients cannot drop monthly submitted and PA fields', async () => {
  const f = fixture(); const body = f.body(); delete body.schema_version;
  const response = await f.handlers.writeAiaMonthly(f.request(body));
  assert.equal(response.status, 409); assert.equal(f.rpc, null); assert.equal(f.calls, 0);
});
test('legacy daily writes return 410 and never obtain a database write client', async () => {
  const file = path.join(root, 'app/api/daily-production/route.ts');
  const m = new Module(file, module); m.filename = file; m.paths = module.paths;
  m.require = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => Response.json(body, opts) } };
    if (name === '@/lib/supabase') return { getSupabaseClient: () => { throw Error('Legacy write touched database'); } };
    if (name === '@/lib/dashboard-access') return { DashboardAccessError: AccessError, getDashboardAccess: async () => ({ canSeeAll: true }) };
    throw Error('Unexpected import '+name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
  for (const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await m.exports[method]()).status,410);
});
