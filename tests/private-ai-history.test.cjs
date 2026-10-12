const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261009120000_private_ai_history.sql'), 'utf8');
let db;
before(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO PUBLIC;
    CREATE TABLE ai_sessions (session_id text PRIMARY KEY, profile jsonb, messages jsonb);
    INSERT INTO ai_sessions VALUES ('legacy-id', '{"region_id":22}', '[{"role":"user","content":"Synthetic history"}]');
    ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all ai_sessions" ON ai_sessions FOR ALL USING (true) WITH CHECK (true);
    GRANT ALL ON ai_sessions TO PUBLIC, anon, authenticated;
    GRANT SELECT (messages), UPDATE (profile) ON ai_sessions TO anon, authenticated;
    CREATE FUNCTION cleanup_expired_ai_sessions() RETURNS integer LANGUAGE sql AS 'SELECT 0';`);
  await db.exec(migration); await db.exec(migration);
});
after(async () => db?.close());
test('browser roles cannot read or modify legacy AI history through table or column grants', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      for (const query of ['SELECT * FROM ai_sessions', 'SELECT messages FROM ai_sessions', "UPDATE ai_sessions SET profile='{}'", "INSERT INTO ai_sessions VALUES ('forged','{}','[]')", 'DELETE FROM ai_sessions', 'SELECT cleanup_expired_ai_sessions()']) {
        await assert.rejects(db.query(query), error => error.code === '42501');
      }
    } finally { await db.exec('RESET ROLE'); }
  }
});
test('migration retains legacy records and service access without public RLS policies', async () => {
  await db.exec('SET ROLE service_role');
  try { assert.equal((await db.query('SELECT messages FROM ai_sessions')).rows[0].messages[0].content, 'Synthetic history'); await db.query('SELECT cleanup_expired_ai_sessions()'); }
  finally { await db.exec('RESET ROLE'); }
  assert.equal((await db.query("SELECT count(*)::integer AS count FROM pg_policies WHERE tablename='ai_sessions'")).rows[0].count, 0);
});
test('migration also works when the optional legacy table and cleanup function are absent', async () => {
  await db.exec('DROP TABLE ai_sessions; DROP FUNCTION cleanup_expired_ai_sessions();'); await db.exec(migration);
});
