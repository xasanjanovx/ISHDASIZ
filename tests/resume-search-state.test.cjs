const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261007091000_resume_search_state.sql'), 'utf8');
const A = '00000000-0000-4000-8000-000000000001';
const R = '00000000-0000-4000-8000-000000000002';
let db;
before(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE TABLE resumes (id uuid PRIMARY KEY, user_id uuid, title text, status text, is_public boolean, updated_at timestamptz, languages text[]);
    CREATE TABLE job_applications (id uuid PRIMARY KEY, resume_id uuid REFERENCES resumes(id) ON DELETE SET NULL, status text);
    INSERT INTO resumes (id,user_id,title,status,is_public,updated_at) VALUES ('${R}','${A}','Existing resume','active',true,'2026-01-01T00:00:00Z');
    INSERT INTO job_applications VALUES ('${A}','${R}','accepted');`);
  await db.exec(migration);
});
after(async () => { await db?.close(); });
test('the additive migration preserves existing resume and application data', async () => {
  const row = (await db.query('SELECT * FROM resumes')).rows[0]; assert.equal(row.title, 'Existing resume'); assert.equal(row.found_job, false); assert.equal(row.found_job_at, null);
  assert.equal((await db.query('SELECT resume_id FROM job_applications')).rows[0].resume_id, R);
});
test('external writes also update the version and a stale guarded edit cannot overwrite them', async () => {
  const old = (await db.query('SELECT updated_at::text AS version FROM resumes')).rows[0].version;
  await db.exec("UPDATE resumes SET title='Changed by bot'");
  const current = (await db.query('SELECT updated_at::text AS version FROM resumes')).rows[0].version; assert.notEqual(current, old);
  const stale = await db.query('UPDATE resumes SET title=$1 WHERE id=$2 AND user_id=$3 AND updated_at=$4::timestamptz RETURNING id', ['Stale editor', R, A, old]); assert.equal(stale.rows.length, 0); assert.equal((await db.query('SELECT title FROM resumes')).rows[0].title, 'Changed by bot');
});
test('archiving and restoring preserve application history and keep restored drafts private', async () => {
  await db.exec("UPDATE resumes SET status='archived',is_public=false; UPDATE resumes SET status='draft',is_public=false");
  assert.equal((await db.query('SELECT resume_id FROM job_applications')).rows[0].resume_id, R);
  const resume = (await db.query('SELECT status,is_public FROM resumes')).rows[0]; assert.deepEqual(resume, { status: 'draft', is_public: false });
});
test('applying the migration twice retains data and exactly one update trigger', async () => {
  await db.exec("UPDATE resumes SET found_job=true,found_job_at=now()"); await db.exec(migration);
  assert.equal((await db.query('SELECT found_job FROM resumes')).rows[0].found_job, true);
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM pg_trigger WHERE tgname='ishdasiz_resume_updated_at'")).rows[0].count, 1);
});
test('the legacy text[] type accepts structured string entries through PostgreSQL JSON record conversion', async () => {
  const body = JSON.stringify({ languages: [JSON.stringify({ name: 'english', level: 'advanced' })] });
  const result = await db.query('SELECT languages FROM jsonb_populate_record(NULL::resumes,$1::jsonb)', [body]);
  assert.deepEqual(JSON.parse(result.rows[0].languages[0]), { name: 'english', level: 'advanced' });
});
