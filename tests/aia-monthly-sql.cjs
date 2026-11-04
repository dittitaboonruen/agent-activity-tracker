const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const actor = '00000000-0000-4000-8000-000000000001';
const row = (code = '403422') => ({ entity_code: code, entity_name: 'ณัฐยา', unit_id: 1, unit_code: 'CENTRAL', unit_name: 'หน่วยกลาง', nickname: null,
  month_cases: 1, month_fyp: 1000, month_fyc: 300, ytd_cases: 10, ytd_fyp: 10000, ytd_fyc: 3000, exp: 10000, lap: 100, limra: 99, active_agents: null });
test('transactional snapshots: permissions, independent scopes/months, rollback, revision conflicts, audit and reopening', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261104061040_aia_monthly_snapshots.sql'), 'utf8');
    await db.exec(sql); await db.exec(sql); // repeat installation is safe
    const save = (scope, month, action, revision, rows) => db.query('select public.save_aia_monthly_batch($1,$2,$3,$4,$5,$6,$7::jsonb,$8::uuid) as batch', [2026, month, scope, `2026-${String(month).padStart(2,'0')}-28`, action, revision, JSON.stringify(rows), actor]);
    let result = await save('person', 8, 'confirm', 0, [row()]);
    assert.equal(result.rows[0].batch.status, 'confirmed');
    await assert.rejects(save('person', 8, 'draft', 1, [row()]), e => e.code === '55000');
    await assert.rejects(save('person', 8, 'reopen', 0, []), e => e.code === '40001');
    result = await save('unit', 8, 'draft', 0, [{ ...row('CENTRAL'), lap: null }]);
    assert.equal(result.rows[0].batch.status, 'draft');
    await assert.rejects(save('unit', 8, 'confirm', 1, [{ ...row('CENTRAL'), limra: null }]));
    assert.equal((await db.query("select status,revision from public.aia_monthly_batches where scope='unit'")).rows[0].revision, 1);
    await save('unit', 8, 'confirm', 1, [row('CENTRAL')]);
    await save('person', 9, 'confirm', 0, [{ ...row(), lap: 80, limra: 97, ytd_fyp: 9000 }]);
    assert.equal((await db.query("select lap from public.aia_monthly_rows r join public.aia_monthly_batches b on b.id=r.batch_id where b.scope='person' and b.report_month=8")).rows[0].lap, '100.00');
    await save('person', 8, 'reopen', 1, []);
    await save('person', 8, 'draft', 2, [{ ...row(), lap: 0, limra: 0 }]);
    await assert.rejects(save('person', 8, 'draft', 2, [row()]), e => e.code === '40001');
    await assert.rejects(save('person', 8, 'draft', 3, [row(), row()]), /duplicate/i);
    await assert.rejects(save('person', 8, 'draft', 3, [{ ...row(), limra: 101 }]), e => e.code === '23514');
    assert.equal((await db.query("select revision from public.aia_monthly_batches where scope='person' and report_month=8")).rows[0].revision, 3);
    await save('person', 8, 'confirm', 3, [{ ...row(), lap: 0, limra: 0 }]);
    const audit = await db.query("select a.revision,a.action,a.before_snapshot,a.after_snapshot from public.aia_monthly_audit a join public.aia_monthly_batches b on b.id=a.batch_id where b.scope='person' and b.report_month=8 order by a.revision");
    assert.deepEqual(audit.rows.map(r => r.action), ['confirm','reopen','draft','confirm']);
    assert.equal(audit.rows[2].before_snapshot.rows[0].lap, 100); assert.equal(audit.rows[2].after_snapshot.rows[0].lap, 0);
    for (const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      await assert.rejects(db.query('select * from public.aia_monthly_rows'), e => e.code === '42501');
      await assert.rejects(save('person', 8, 'reopen', 4, []), e => e.code === '42501');
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await db.query('select count(*)::int n from public.aia_monthly_batches')).rows[0].n, 3);
    await save('person', 8, 'reopen', 4, []);
    await db.exec('reset role');
    assert.equal((await db.query("select count(*)::int n from pg_policies where tablename like 'aia_monthly_%'")).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from pg_class where relname in ('aia_monthly_batches','aia_monthly_rows','aia_monthly_audit') and relrowsecurity")).rows[0].n, 3);
  } finally { await db.close(); }
});
