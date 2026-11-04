const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file) { const m = new Module(file, module); m.filename = file; m.paths = module.paths; m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file); return m.exports; }
const root = path.resolve(__dirname, '..');
const aia = load(path.join(root, 'lib/aia-monthly.ts'));
const report = load(path.join(root, 'lib/aia-monthly-report.ts'));
const entity = { entity_code: '403422', entity_name: 'ณัฐยา', nickname: null, unit_id: 1, unit_code: 'CENTRAL', unit_name: 'หน่วยกลาง' };
const complete = () => Object.fromEntries([...Object.entries(aia.emptyAiaRow(entity)), ...aia.AIA_METRICS.map(m => [m.key, 0])]);

test('empty and zero remain distinct; confirmed rows need all nine metrics', () => {
  assert.equal(aia.parseAiaNumber('', 'lap'), null);
  assert.equal(aia.parseAiaNumber('0', 'lap'), 0);
  assert.throws(() => aia.validateAiaRows([aia.emptyAiaRow(entity)], true), /ยังไม่ได้กรอก/);
  assert.equal(aia.validateAiaRows([complete()], true)[0].lap, 0);
});
test('numbers reject negatives, nonfinite, exponent syntax, excessive decimals and invalid percentages', () => {
  for (const value of ['-1', 'NaN', 'Infinity', '1e3', '1.123', '1,23', {}, true]) assert.throws(() => aia.parseAiaNumber(value, 'exp'));
  assert.throws(() => aia.parseAiaNumber('1.2', 'month_cases'));
  assert.throws(() => aia.parseAiaNumber('100.01', 'limra'));
  assert.equal(aia.parseAiaNumber('1,234,567.89', 'month_fyp'), 1234567.89);
  assert.equal(aia.parseAiaNumber('100', 'limra'), 100);
});
test('decreasing snapshots are accepted, without altering another month', () => {
  const august = { ...complete(), exp: 1000, lap: 100, limra: 95, ytd_fyp: 10000 };
  const september = aia.validateAiaRows([{ ...august, lap: 80, limra: 93, ytd_fyp: 9000 }], true)[0];
  assert.equal(september.lap, 80); assert.equal(september.ytd_fyp, 9000); assert.equal(august.limra, 95);
});
test('Excel paste matches codes, preserves other groups, and is atomic on invalid rows', () => {
  const rows = [complete(), { ...complete(), entity_code: '669168', entity_name: 'ภัทรา' }];
  const updated = aia.applyAiaPaste('669168\t500\t20\t96\n403422\t1000\t50\t95', rows, ['exp', 'lap', 'limra']);
  assert.equal(updated[0].exp, 1000); assert.equal(updated[1].exp, 500); assert.equal(updated[0].ytd_fyp, 0); assert.equal(rows[0].exp, 0);
  assert.throws(() => aia.applyAiaPaste('403422\t1\t2\t95\nUNKNOWN\t1\t2\t95', rows, ['exp', 'lap', 'limra']), /ไม่พบรหัส/);
  assert.throws(() => aia.applyAiaPaste('403422\t1\t2\t95\n403422\t1\t2\t95', rows, ['exp', 'lap', 'limra']), /ซ้ำ/);
  assert.equal(rows[0].exp, 0);
});
test('duplicate financial identities cannot be confirmed', () => {
  assert.throws(() => aia.validateAiaRows([complete(), complete()], true), /ซ้ำ/);
});
test('daily references follow stable codes, keep YTD boundaries and do not replace AIA values', () => {
  const row = { ...complete(), month_fyp: 999, ytd_fyp: 1234 };
  const daily = [
    { production_date: '2026-01-01', agent_code: '403422', agent_name: 'ชื่อเก่า', aia_case_submitted: 1, aia_fyp_submitted: 10, aia_fyc_approved: 5000, pa_case: 1, pa_fyp: 100, pa_fyc: 20 },
    { production_date: '2026-08-31', agent_code: '403422', agent_name: 'ชื่อเก่า', aia_case_submitted: 2, aia_fyp_submitted: 20, aia_fyc_approved: 4999, pa_case: 2, pa_fyp: 200, pa_fyc: 40 },
    { production_date: '2026-09-01', agent_code: '403422', agent_name: 'ชื่อเก่า', aia_case_submitted: 4, aia_fyp_submitted: 99, aia_fyc_approved: 9999, pa_case: 9, pa_fyp: 999, pa_fyc: 999 },
  ];
  const sums = report.dailyReferences(daily, row, 'person', 2026, 8, []);
  assert.equal(sums.submitted_cases, 2); assert.equal(sums.pa_ytd_fyp, 300); assert.equal(sums.approved_months, 1);
  assert.equal(row.month_fyp, 999); assert.equal(row.ytd_fyp, 1234);
});
test('unit daily references include only assigned stable agent codes', () => {
  const row = complete();
  const daily = [{ production_date: '2026-08-31', agent_code: 'A', agent_name: 'A', aia_case_submitted: 2, aia_fyp_submitted: 20, aia_fyc_approved: 5000, pa_case: 2, pa_fyp: 200, pa_fyc: 40 }, { production_date: '2026-08-31', agent_code: 'B', agent_name: 'B', aia_case_submitted: 9, aia_fyp_submitted: 99, aia_fyc_approved: 9999, pa_case: 9, pa_fyp: 999, pa_fyc: 999 }];
  assert.equal(report.dailyReferences(daily, row, 'unit', 2026, 8, [{ agent_code: 'A', agent_name: 'A', unit_id: 1 }, { agent_code: 'B', agent_name: 'B', unit_id: 2 }]).pa_fyp, 200);
});
test('CSV preserves Thai and leading-zero codes, escapes formulas and missing values', () => {
  assert.equal(report.csvCell('001234'), '"001234"');
  assert.equal(report.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(report.csvCell(null), '""'); assert.equal(report.csvCell(0), '"0"');
});
test('month ends and Thai years are correct across leap years', () => {
  assert.equal(aia.monthEnd(2024, 2), '2024-02-29'); assert.equal(aia.monthEnd(2026, 2), '2026-02-28');
  assert.match(aia.periodLabel(2026, 8), /2569/);
});
