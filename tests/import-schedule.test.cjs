const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');
const script = name => fs.readFileSync(path.join(root, 'supabase/operations', name + '-import-schedule.sql'), 'utf8');
let db;
// Extension adapters record requests locally; they never send HTTP or run cron.
before(async () => {
 db = await PGlite.create();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets(name text, decrypted_secret text);
  CREATE SCHEMA net; CREATE TABLE net.requests(id bigserial, url text, headers jsonb, timeout integer);
  CREATE FUNCTION net.http_get(url text,params jsonb DEFAULT '{}',headers jsonb DEFAULT '{}',timeout_milliseconds integer DEFAULT 2000)
   RETURNS bigint LANGUAGE sql AS 'INSERT INTO net.requests(url,headers,timeout) VALUES($1,$3,$4) RETURNING id';
  CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigserial PRIMARY KEY,jobname text UNIQUE,schedule text,command text,username text DEFAULT current_user,active boolean DEFAULT true);
  CREATE FUNCTION cron.schedule(job_name text,schedule text,command text) RETURNS bigint LANGUAGE sql AS
   'INSERT INTO cron.job(jobname,schedule,command) VALUES($1,$2,$3) ON CONFLICT(jobname) DO UPDATE SET schedule=$2,command=$3 RETURNING jobid';
  CREATE FUNCTION cron.alter_job(jobid bigint,active boolean) RETURNS void LANGUAGE sql AS 'UPDATE cron.job SET active=$2 WHERE jobid=$1';`);
});
after(async () => { await db?.close(); });
async function rejectsTransaction(sql, pattern) {
 await assert.rejects(db.exec(sql), pattern);
 await db.exec('ROLLBACK; RESET ROLE;');
}

test('install and reinstall keep one inactive schedule and send no request', async () => {
 await db.exec(script('install')); await db.exec(script('install'));
 const jobs = (await db.query('SELECT jobname,schedule,command,active FROM cron.job')).rows;
 assert.deepEqual(jobs, [{jobname:'ishdasiz-osonish-refresh',schedule:'*/5 * * * *',command:'SELECT public.ishdasiz_schedule_osonish_refresh();',active:false}]);
 assert.equal((await db.query('SELECT count(*)::int n FROM net.requests')).rows[0].n, 0);
});
test('browser and service roles cannot call the Vault-backed scheduler', async () => {
 for (const role of ['anon','authenticated','service_role']) {
  assert.equal((await db.query(`SELECT has_function_privilege('${role}','public.ishdasiz_schedule_osonish_refresh()','EXECUTE') ok`)).rows[0].ok, false);
  await rejectsTransaction(`BEGIN; SET LOCAL ROLE ${role}; SELECT public.ishdasiz_schedule_osonish_refresh(); COMMIT;`, /permission denied/);
 }
});
test('missing, duplicate, short or header-breaking Vault secrets fail before enqueue', async () => {
 for (const secrets of [[], ['short'], ['x'.repeat(32),'y'.repeat(32)], ['x'.repeat(32)+'\n']]) {
  await db.exec('DELETE FROM vault.decrypted_secrets;');
  for (const secret of secrets) await db.query('INSERT INTO vault.decrypted_secrets VALUES($1,$2)', ['ishdasiz_cron_secret',secret]);
  await assert.rejects(db.query('SELECT public.ishdasiz_schedule_osonish_refresh()'), /Configure one valid/);
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM net.requests')).rows[0].n, 0);
});
test('HTTP uses the fixed production endpoint, full worker timeout and current Vault value', async () => {
 await db.exec('DELETE FROM vault.decrypted_secrets;');
 await db.query('INSERT INTO vault.decrypted_secrets VALUES($1,$2)', ['ishdasiz_cron_secret','a'.repeat(48)]);
 await db.query('SELECT public.ishdasiz_schedule_osonish_refresh()');
 await db.query('UPDATE vault.decrypted_secrets SET decrypted_secret=$1', ['b'.repeat(48)]);
 await db.query('SELECT public.ishdasiz_schedule_osonish_refresh()');
 const requests = (await db.query('SELECT url,headers,timeout FROM net.requests ORDER BY id')).rows;
 assert.deepEqual(requests.map(r=>r.url), Array(2).fill('https://ishdasiz.uz/api/cron/continue-osonish'));
 assert.deepEqual(requests.map(r=>r.timeout), [300000,300000]);
 assert.deepEqual(requests.map(r=>r.headers.Authorization), ['Bearer '+'a'.repeat(48),'Bearer '+'b'.repeat(48)]);
});
test('activation requires the candidate import release, pause is reversible, reinstall stays inactive', async () => {
 await rejectsTransaction(script('activate'), /Apply the candidate import release/);
 await db.exec(`CREATE FUNCTION public.ishdasiz_finish_osonish_refresh(uuid,uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
  CREATE FUNCTION public.ishdasiz_osonish_candidates(uuid,uuid,integer,text[],integer,integer) RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';`);
 await db.exec(script('activate'));
 assert.equal((await db.query('SELECT active FROM cron.job')).rows[0].active, true);
 await db.exec(script('pause')); await db.exec(script('pause'));
 assert.equal((await db.query('SELECT active FROM cron.job')).rows[0].active, false);
 await db.exec(script('activate')); await db.exec(script('install'));
 assert.equal((await db.query('SELECT active FROM cron.job')).rows[0].active, false);
});
test('activation refuses a modified cron command and never sends a request itself', async () => {
 const before = (await db.query('SELECT count(*)::int n FROM net.requests')).rows[0].n;
 await db.exec("UPDATE cron.job SET command='SELECT 1'");
 await rejectsTransaction(script('activate'), /query returned no rows/);
 assert.equal((await db.query('SELECT active FROM cron.job')).rows[0].active, false);
 assert.equal((await db.query('SELECT count(*)::int n FROM net.requests')).rows[0].n, before);
});
test('Vercel Hobby contains only daily jobs; frequent sync has one scheduler', () => {
 const config = JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 assert.deepEqual(config.crons.map(x=>x.path), ['/api/cron/import-osonish','/api/maintenance/sync-references']);
 for (const job of config.crons) assert.match(job.schedule, /^\d+ \d+ \* \* \*$/);
});
