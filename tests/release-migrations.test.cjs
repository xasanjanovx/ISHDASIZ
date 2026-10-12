const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { validateRelease } = require('../scripts/prepare-database-release.cjs');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'supabase/releases/2026-10-repair.json'), 'utf8'));
const sql = file => fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
const A = '00000000-0000-4000-8000-000000000001', S = '00000000-0000-4000-8000-000000000002';
const J = '10000000-0000-4000-8000-000000000001', R = '20000000-0000-4000-8000-000000000001';
let db;
async function applyRelease() {
  for (const { file } of manifest.migrations) {
    try { await db.exec(sql(file)); }
    catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
  }
}
before(async () => {
  db = await PGlite.create();
  await db.exec(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-release-baseline.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(root, 'supabase/releases/audit-2026-10.sql'), 'utf8'));
  // Execute the genuine legacy definitions for these later-added tables.
  for (const file of ['20260212_add_job_offers.sql', '20260217_channel_autopost_outbox.sql', '20260409_job_auto_matches_v2.sql']) await db.exec(sql(file));
  await db.exec(`INSERT INTO users(id,password_hash,phone) VALUES('${A}','synthetic','+998901111111'),('${S}','synthetic','+998902222222');
    INSERT INTO employer_profiles(id,user_id) VALUES('${A}','${A}'); INSERT INTO job_seeker_profiles(id,user_id) VALUES('${S}','${S}');
    INSERT INTO regions VALUES(1,'andijon-viloyati','Andijon','Андижан');INSERT INTO districts VALUES(10,1,'Tuman','Район');
    INSERT INTO jobs(id,employer_id,title_ru,company_name,region_id,district_id) VALUES('${J}','${A}','Operator','Synthetic',1,10);
    INSERT INTO resumes(id,user_id,title,full_name,phone,status,is_public,post_to_channel,region_id,district_id) VALUES('${R}','${S}','Operator','Synthetic seeker','+998902222222','active',true,true,1,10);
    INSERT INTO job_applications(job_id,user_id,resume_id,full_name,phone) VALUES('${J}','${S}','${R}','Synthetic seeker','+998902222222');
    INSERT INTO favorites(user_id,job_id) VALUES('${S}','${J}');INSERT INTO view_history(user_id,job_id) VALUES('${S}','${J}');
    INSERT INTO ai_sessions(messages) VALUES('[{"content":"synthetic legacy history"}]');
    INSERT INTO channel_posts(entity_type,entity_id,channel_username,message_id) VALUES('job','${J}','@synthetic_channel',123);`);
  await applyRelease();
});
after(async () => { await db?.close(); });

test('release installs on the audited variant without channel tables or post_to_channel and with bigint resume region', async () => {
  const liveVariant = await PGlite.create();
  try {
    await liveVariant.exec(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-release-baseline.sql'), 'utf8'));
    for (const file of ['20260212_add_job_offers.sql', '20260409_job_auto_matches_v2.sql']) await liveVariant.exec(sql(file));
    await liveVariant.exec(`ALTER TABLE resumes DROP COLUMN post_to_channel; ALTER TABLE resumes ALTER COLUMN region_id TYPE bigint;
      INSERT INTO users(id,password_hash,phone) VALUES('${A}','synthetic','+998901111111'),('${S}','synthetic','+998902222222');
      INSERT INTO employer_profiles(id,user_id) VALUES('${A}','${A}'); INSERT INTO job_seeker_profiles(id,user_id) VALUES('${S}','${S}');
      INSERT INTO regions VALUES(1,'andijon-viloyati','Andijon','Андижан'); INSERT INTO districts VALUES(10,1,'Tuman','Район');
      INSERT INTO jobs(id,employer_id,title_ru,region_id,district_id) VALUES('${J}','${A}','AuditedVariant',1,10);
      INSERT INTO resumes(id,user_id,title,status,is_public,region_id,district_id) VALUES('${R}','${S}','AuditedVariant','active',true,1,10);`);
    const variantAudit = (await liveVariant.exec(fs.readFileSync(path.join(root, 'supabase/releases/audit-2026-10.sql'), 'utf8'))).flatMap(result => result.rows);
    assert.equal(variantAudit.find(row => row.table_name === 'resumes' && row.column_name === 'region_id').result, 'compatible_bigint');
    assert.equal(variantAudit.find(row => row.table_name === 'resumes' && row.column_name === 'post_to_channel').result, 'added_by_release');
    for (const { file } of manifest.migrations) {
      try { await liveVariant.exec(sql(file)); }
      catch (error) { throw new Error('Audited schema variant / ' + file + ': ' + error.message); }
    }
    assert.equal((await liveVariant.query('SELECT count(*)::int n FROM jobs')).rows[0].n, 1);
    assert.equal((await liveVariant.query('SELECT count(*)::int n FROM resumes')).rows[0].n, 1);
    assert.equal((await liveVariant.query('SELECT region_id::text region,post_to_channel FROM resumes')).rows[0].region, '1');
    assert.equal((await liveVariant.query('SELECT post_to_channel FROM resumes')).rows[0].post_to_channel, null);
    assert.equal((await liveVariant.query("SELECT data_type FROM information_schema.columns WHERE table_name='resumes' AND column_name='region_id'")).rows[0].data_type, 'bigint');
    assert.equal((await liveVariant.query('SELECT ishdasiz_public_job_counts() result')).rows[0].result.total, 1);
    for (const role of ['anon', 'authenticated']) {
      await liveVariant.exec('SET ROLE ' + role);
      try { for (const table of ['sync_events','channel_posts','sync_worker_locks']) await assert.rejects(liveVariant.query('SELECT * FROM ' + table), e => e.code === '42501'); }
      finally { await liveVariant.exec('RESET ROLE'); }
    }
    const leaseBody = (await liveVariant.query("SELECT prosrc FROM pg_proc WHERE oid='public.acquire_worker_lock(text,integer)'::regprocedure")).rows[0].prosrc;
    await liveVariant.exec(sql('20261006080000_channel_prerequisites.sql'));
    assert.equal((await liveVariant.query("SELECT prosrc FROM pg_proc WHERE oid='public.acquire_worker_lock(text,integer)'::regprocedure")).rows[0].prosrc, leaseBody, 'bootstrap must not replace the newer lease implementation');
  } finally { await liveVariant.close(); }
});

test('channel prerequisites are private immediately and preserve existing receipts and locks on repeated application', async () => {
  const bootstrap = await PGlite.create();
  try {
    await bootstrap.exec(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-release-baseline.sql'), 'utf8'));
    await bootstrap.exec(sql('20261006080000_channel_prerequisites.sql'));
    await bootstrap.exec(`INSERT INTO channel_posts(entity_type,entity_id,channel_username,message_id) VALUES('job','${J}','@synthetic_bootstrap',123);
      INSERT INTO sync_events(entity_type,entity_id,action) VALUES('job','${J}','upsert'); SELECT acquire_worker_lock('synthetic_worker',300);`);
    await bootstrap.exec(sql('20261006080000_channel_prerequisites.sql'));
    assert.equal((await bootstrap.query('SELECT message_id FROM channel_posts')).rows[0].message_id, 123);
    assert.equal((await bootstrap.query('SELECT count(*)::int n FROM sync_events')).rows[0].n, 1);
    assert.equal((await bootstrap.query("SELECT acquire_worker_lock('synthetic_worker',300) acquired")).rows[0].acquired, false);
    for (const role of ['anon', 'authenticated']) {
      await bootstrap.exec('SET ROLE ' + role);
      try {
        for (const table of ['sync_events','channel_posts','sync_worker_locks']) await assert.rejects(bootstrap.query('SELECT * FROM ' + table), e => e.code === '42501');
        await assert.rejects(bootstrap.query("SELECT acquire_worker_lock('synthetic_worker',300)"), e => e.code === '42501');
      } finally { await bootstrap.exec('RESET ROLE'); }
    }
  } finally { await bootstrap.close(); }
});

test('work-mode computed field recognizes canonical, numeric and localized import labels', async () => {
  const aliases = {
    onsite: [1, '1', 'onsite', 'ON_SITE', 'На месте', 'В офисе', 'Ish joyida'],
    home: [2, 'home', 'Работа из дома', 'Uydan ishlash'],
    remote: [3, 'remote', 'Fully_remote', 'Удалённая работа', 'MASOFAVIY', 'masofadan ishlash'],
    hybrid: [4, 'hybrid', 'Гибрид (офис + удалённо)', 'Gibrid (ish joyi + masofaviy)'],
  };
  for (const [mode, values] of Object.entries(aliases)) for (const value of values) {
    const row = { raw_source_json: { work_mode: value } };
    assert.equal((await db.query('SELECT ishdasiz_job_work_mode(jsonb_populate_record(NULL::public.jobs,$1::jsonb)) mode', [JSON.stringify(row)])).rows[0].mode, mode, String(value));
  }
});

test('explicit office/hybrid/unknown formats override legacy remote employment type', async () => {
  for (const [row, expected] of [
    [{ work_mode: 'onsite', employment_type: 'remote' }, 'onsite'],
    [{ work_mode: 'hybrid', employment_type: 'remote' }, 'hybrid'],
    [{ work_mode: 'not remote', employment_type: 'remote' }, null],
    [{ work_mode: 'remote / office', employment_type: 'remote' }, null],
    [{ work_mode: 'all', raw_source_json: { workplace_type: 'Masofaviy' } }, 'remote'],
    [{ raw_source_json: { work_mode: {}, work_format: 'remote' } }, 'remote'],
    [{ employment_type: 'remote' }, 'remote'],
  ]) assert.equal((await db.query('SELECT ishdasiz_job_work_mode(jsonb_populate_record(NULL::public.jobs,$1::jsonb)) mode', [JSON.stringify(row)])).rows[0].mode, expected);
});

test('public regional searches include remote jobs across office locations and still exclude unavailable jobs', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec("INSERT INTO jobs(title_ru,region_id,district_id,work_mode,status) VALUES ('RemoteFilterLocal',1,10,'onsite','active'),('RemoteFilterDistantOffice',2,20,'onsite','active'),('RemoteFilterDistantRemote',2,20,'3','active'),('RemoteFilterRegionlessRemote',NULL,NULL,'Masofaviy','active'),('RemoteFilterHybrid',2,20,'hybrid','active'),('RemoteFilterDraft',2,20,'remote','draft'); SET ROLE anon;");
    const rows = (await db.query("SELECT title_ru FROM jobs j WHERE ishdasiz_job_available(j) AND title_ru LIKE 'RemoteFilter%' AND ((region_id=1 AND district_id=10) OR ishdasiz_job_work_mode(j)='remote') ORDER BY title_ru")).rows;
    assert.deepEqual(rows.map(r => r.title_ru), ['RemoteFilterDistantRemote', 'RemoteFilterLocal', 'RemoteFilterRegionlessRemote']);
  } finally { await db.exec('RESET ROLE; ROLLBACK'); }
});

test('computed work mode is immutable, invoker-only and executable for public readers', async () => {
  const p = (await db.query("SELECT prosecdef,provolatile FROM pg_proc WHERE oid='public.ishdasiz_job_work_mode(public.jobs)'::regprocedure")).rows[0];
  assert.equal(p.prosecdef, false); assert.equal(p.provolatile, 'i');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await db.exec('SET ROLE ' + role);
    try { assert.equal((await db.query("SELECT ishdasiz_job_work_mode(jsonb_populate_record(NULL::public.jobs,'{\"work_mode\":\"remote\"}')) mode")).rows[0].mode, 'remote'); }
    finally { await db.exec('RESET ROLE'); }
  }
});

test('release manifest covers every prepared migration once, with exact hashes and ordered dependencies', () => {
  assert.equal(validateRelease().migrations.length, 34);
  const actual = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(n => /^202610.*\.sql$/.test(n)).sort();
  assert.deepEqual(manifest.migrations.map(m => m.file), actual);
  const seen = new Set(), versions = new Set();
  for (const entry of manifest.migrations) {
    assert.match(entry.file, /^\d{14}_[a-z_]+\.sql$/);
    const version = entry.file.split('_')[0]; assert(!versions.has(version)); versions.add(version);
    for (const required of entry.requires) assert(seen.has(required), `${entry.file} requires ${required}`);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'supabase/migrations', entry.file))).digest('hex'), entry.sha256);
    seen.add(entry.file);
  }
});

test('full release preserves legacy data and imports the known Telegram message into durable history', async () => {
  for (const table of ['jobs', 'resumes', 'job_applications', 'favorites', 'view_history', 'ai_sessions']) assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 1, table);
  assert.equal((await db.query('SELECT message_id FROM channel_delivery_receipts')).rows[0].message_id, 123);
  assert.equal((await db.query('SELECT ishdasiz_public_statistics() r')).rows[0].r.availableJobs, 1);
});

test('later migrations cannot reopen private tables or grant browser execution of protected RPCs', async () => {
  const tables = ['users', 'otp_codes', 'telegram_sessions', 'conversations', 'messages', 'conversation_preferences', 'ai_sessions', 'favorites', 'view_history', 'admin_profiles', 'job_auto_matches', 'job_offers', 'channel_delivery_intents', 'channel_delivery_receipts'];
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try { for (const table of tables) await assert.rejects(db.query(`SELECT * FROM ${table}`), e => e.code === '42501', `${role}/${table}`); }
    finally { await db.exec('RESET ROLE'); }
    for (const name of ['ishdasiz_submit_application','ishdasiz_application_action','ishdasiz_web_application_action','ishdasiz_application_resume','ishdasiz_application_seen','ishdasiz_catalog_resume','ishdasiz_chat_action','ishdasiz_write_own_resume','ishdasiz_set_account_closed','ishdasiz_channel_send_begin','ishdasiz_auto_match_store','ishdasiz_seeker_offers','ishdasiz_seeker_offer','ishdasiz_seeker_offer_seen']) {
      const permissions = await db.query('SELECT has_function_privilege($1,p.oid,\'EXECUTE\') allowed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=\'public\' AND p.proname=$2', [role,name]);
      assert(permissions.rows.length > 0, name); assert(permissions.rows.every(r => !r.allowed), `${role}/${name}`);
    }
  }
});

test('public resume search and browser reads hide found-job, private, inactive and closed-owner records even through legacy policies', async () => {
  for (const update of ["UPDATE resumes SET found_job=true", "UPDATE resumes SET is_public=false", "UPDATE resumes SET status='archived'", "UPDATE resumes SET status=null", "UPDATE resumes SET user_id=null", `UPDATE users SET closed_at=now() WHERE id='${S}'`]) {
    await db.exec('BEGIN');
    try {
      await db.exec(update);
      await db.exec('SET LOCAL ROLE service_role');
      assert.equal((await db.query('SELECT ishdasiz_resume_available(r) available FROM resumes r')).rows[0].available, false);
      assert.equal((await db.query('SELECT * FROM ishdasiz_public_resume_search()')).rows.length, 0);
      await db.exec('SET LOCAL ROLE anon');
      assert.equal((await db.query('SELECT * FROM resumes')).rows.length, 0);
    } finally { await db.exec('ROLLBACK'); }
  }
  assert.equal((await db.query('SELECT * FROM ishdasiz_public_resume_search()')).rows.length, 1);
});

test('public visibility is applied before keyset pagination, including many found-job records with equal timestamps', async () => {
  await db.exec('BEGIN');
  try {
    await db.exec(`INSERT INTO resumes(id,user_id,title,status,is_public,found_job,created_at)
      SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${S}','ReleasePagination','active',true,n%2=0,'2026-10-10T00:00:00.123456Z'
      FROM generate_series(1,150) n;SET LOCAL ROLE service_role;`);
    const seen = []; let date = null, id = null;
    for (let page = 0; page < 10; page++) {
      const result = await db.query('SELECT card FROM ishdasiz_public_resume_search(p_query=>$1,p_before_created=>$2,p_before_id=>$3,p_page_size=>24)', ['ReleasePagination',date,id]);
      const cards = result.rows.slice(0,24).map(r => r.card); seen.push(...cards.map(r => r.id));
      if (result.rows.length <= 24) break;
      date = cards.at(-1).created_at; id = cards.at(-1).id;
    }
    const expected = Array.from({ length: 75 }, (_, n) => '30000000-0000-4000-8000-'+String(149-n*2).padStart(12,'0'));
    assert.deepEqual(seen, expected);
  } finally { await db.exec('ROLLBACK'); }
});

test('account closure revokes publication and old application sessions after the complete release', async () => {
  await db.query('SELECT ishdasiz_set_account_closed($1,0,true)', [S]);
  assert.equal((await db.query('SELECT ishdasiz_channel_snapshot(\'resume\',$1) r', [R])).rows[0].r.available, false);
  assert.equal((await db.query('SELECT ishdasiz_public_statistics() r')).rows[0].r.applications, 0);
  await assert.rejects(db.query('SELECT ishdasiz_submit_application($1,0,$2,$3,$4)', [S,J,R,'+998902222222']), e => e.code === '42501');
  await db.query('SELECT ishdasiz_set_account_closed($1,1,false)', [S]);
  assert.equal((await db.query('SELECT count(*)::int n FROM job_applications')).rows[0].n, 1);
});

test('reapplying the whole release preserves state, delivery history and final clock behavior', async () => {
  const before = (await db.query('SELECT updated_at::text v FROM jobs WHERE id=$1', [J])).rows[0].v;
  await applyRelease();
  assert.equal((await db.query('SELECT count(*)::int n FROM channel_delivery_receipts')).rows[0].n, 1);
  assert.equal((await db.query('SELECT count(*)::int n FROM job_applications')).rows[0].n, 1);
  await db.query('UPDATE jobs SET views_count=views_count+1,updated_at=now() WHERE id=$1', [J]);
  assert.equal((await db.query('SELECT updated_at::text v FROM jobs WHERE id=$1', [J])).rows[0].v, before);
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='ishdasiz_resume_updated_at' AND NOT tgisinternal")).rows[0].n, 1);
});

test('read-only audit works before and after release, with optional migration history present or absent', async () => {
  await db.exec(`CREATE SCHEMA supabase_migrations;CREATE TABLE supabase_migrations.schema_migrations(version text,name text,statements text[]);
    INSERT INTO supabase_migrations.schema_migrations VALUES('20260409','legacy',ARRAY['synthetic statement must not be returned']);`);
  const results = await db.exec(fs.readFileSync(path.join(root, 'supabase/releases/audit-2026-10.sql'), 'utf8'));
  assert(!JSON.stringify(results).includes('synthetic statement must not be returned'));
  const columns = results.flatMap(r => r.rows).filter(r => 'expected_type' in r);
  assert(columns.length > 30); assert(columns.every(r => r.result === 'compatible'));
  assert.equal((await db.query('SELECT count(*)::int n FROM job_applications')).rows[0].n, 1);
});
