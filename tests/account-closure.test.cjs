const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007090000_account_closure.sql'),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const EA='10000000-0000-4000-8000-000000000001',EB='10000000-0000-4000-8000-000000000002';
let db;
const close=()=>db.query('SELECT ishdasiz_set_account_closed($1,0,true) AS epoch',[A]);
const restore=()=>db.query('SELECT ishdasiz_set_account_closed($1,1,false) AS epoch',[A]);
beforeEach(async()=>{
 db=await PGlite.create();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);
 CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid,full_name text);
 CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employer_id uuid,user_id uuid,created_by uuid,is_active boolean,status text,updated_at timestamptz DEFAULT now());
 CREATE TABLE resumes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,is_public boolean,status text);
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 CREATE TABLE messages(content text);
 INSERT INTO users VALUES('${A}','test-hash','+998901234567'),('${B}','test-hash','+998901234568');
 INSERT INTO otp_codes VALUES('+998901234567',false),('+998901234568',false);
 INSERT INTO employer_profiles VALUES('${EA}','${A}'),('${EB}','${B}');
 INSERT INTO job_seeker_profiles VALUES('${EA}','${A}','Existing profile');
 INSERT INTO jobs(employer_id,user_id,created_by,is_active,status) VALUES
 ('${EA}','${B}','${B}',true,'active'),(null,'${A}',null,false,'draft'),(null,null,'${A}',true,'active'),('${EB}','${A}','${A}',true,'active');
 INSERT INTO resumes(user_id,is_public,status) VALUES('${A}',true,'active'),('${A}',false,'active'),('${A}',true,'archived'),('${B}',true,'active');
 INSERT INTO telegram_sessions(user_id,state,data,phone,otp_code) VALUES('${A}','main_menu','{"private_draft":"preserve only in profile"}','+998901234567','54321');
 INSERT INTO messages VALUES('Existing history');
 GRANT SELECT ON jobs,resumes,job_seeker_profiles,employer_profiles TO anon,authenticated;
 CREATE POLICY legacy_open_jobs ON jobs FOR SELECT USING(true);
 CREATE POLICY legacy_open_resumes ON resumes FOR SELECT USING(true);
 CREATE POLICY legacy_open_profiles ON job_seeker_profiles FOR SELECT USING(true);
 CREATE POLICY legacy_open_companies ON employer_profiles FOR SELECT USING(true);`);
 await db.exec(migration);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007094000_vacancy_updated_at.sql'),'utf8'));
});
afterEach(async()=>{await db?.close();});
test('closing hides both roles and revokes bot access without deleting profiles, publications or history',async()=>{
 assert.equal((await close()).rows[0].epoch,1);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM jobs WHERE is_active')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM resumes WHERE is_public')).rows[0].n,1);
 const s=(await db.query('SELECT * FROM telegram_sessions')).rows[0];assert.equal(s.user_id,null);assert.equal(s.otp_code,null);assert.deepEqual(s.data,{});
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM account_publication_snapshots')).rows[0].n,6);
 assert.equal((await db.query('SELECT content FROM messages')).rows[0].content,'Existing history');
 assert.equal((await db.query('SELECT full_name FROM job_seeker_profiles')).rows[0].full_name,'Existing profile');
 assert.equal((await db.query("SELECT verified FROM otp_codes WHERE phone='+998901234567'")).rows[0].verified,true);
 assert.equal((await db.query("SELECT verified FROM otp_codes WHERE phone='+998901234568'")).rows[0].verified,false);
});
test('restore advances the epoch again and restores the exact prior visibility including hidden and archived records',async()=>{
 const jobs=(await db.query('SELECT id,is_active,status FROM jobs ORDER BY id')).rows;
 const resumes=(await db.query('SELECT id,is_public,status FROM resumes ORDER BY id')).rows;
 await close();assert.equal((await restore()).rows[0].epoch,2);
 assert.deepEqual((await db.query('SELECT id,is_active,status FROM jobs ORDER BY id')).rows,jobs);
 assert.deepEqual((await db.query('SELECT id,is_public,status FROM resumes ORDER BY id')).rows,resumes);
 assert.equal((await db.query('SELECT user_id FROM telegram_sessions')).rows[0].user_id,null);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM account_publication_snapshots')).rows[0].n,0);
});
test('closed accounts cannot publish, modify profiles, change passwords or reattach old bot sessions',async()=>{
 await close();
 for(const sql of ["UPDATE resumes SET is_public=true WHERE user_id=$1","UPDATE job_seeker_profiles SET full_name='Changed' WHERE user_id=$1","UPDATE users SET password_hash='Changed' WHERE id=$1", "INSERT INTO telegram_sessions(user_id,data) VALUES($1,'{}')"])
   await assert.rejects(db.query(sql,[A]),e=>e.code==='42501');
 await restore();
 await assert.rejects(db.query("INSERT INTO telegram_sessions(user_id,data) VALUES($1,'{\"account_session_version\":0}')",[A]),e=>e.code==='42501');
 await db.query("INSERT INTO telegram_sessions(user_id,data) VALUES($1,'{\"account_session_version\":2}')",[A]);
});
test('replayed close/restore and stale confirmations never overwrite a newer lifecycle',async()=>{
 await close();await assert.rejects(close(),e=>e.code==='40001');await restore();await assert.rejects(restore(),e=>e.code==='40001');
 assert.equal((await db.query('SELECT session_version,closed_at FROM users WHERE id=$1',[A])).rows[0].session_version,2);
});
test('restrictive policies hide closed accounts even with old permissive public policies; snapshots and RPC stay private',async()=>{
 await close();
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  try {
   assert.equal((await db.query('SELECT count(*)::integer AS n FROM jobs')).rows[0].n,1);
   assert.equal((await db.query('SELECT count(*)::integer AS n FROM resumes')).rows[0].n,1);
   assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_seeker_profiles')).rows[0].n,0);
   await assert.rejects(db.query('SELECT * FROM account_publication_snapshots'),e=>e.code==='42501');
   await assert.rejects(db.query('SELECT ishdasiz_set_account_closed($1,1,false)',[A]),e=>e.code==='42501');
  } finally {await db.exec('RESET ROLE');}
 }
});
test('a transferred job is not republished by the former owner on restoration',async()=>{
 await close();await db.query('UPDATE jobs SET employer_id=$1 WHERE employer_id=$2',[EB,EA]);await restore();
 assert.equal((await db.query('SELECT is_active FROM jobs WHERE employer_id=$1 AND user_id=$2',[EB,B])).rows[0].is_active,false);
});
test('a failed publication update rolls back account state, snapshots and session revocation together',async()=>{
 await db.exec("ALTER TABLE jobs ADD CONSTRAINT reject_archived CHECK(status<>'archived')");
 await assert.rejects(close(),e=>e.code==='23514');
 assert.equal((await db.query('SELECT session_version,closed_at FROM users WHERE id=$1',[A])).rows[0].session_version,0);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM account_publication_snapshots')).rows[0].n,0);
 assert.equal((await db.query('SELECT user_id FROM telegram_sessions')).rows[0].user_id,A);
});
test('reapplying the migration preserves closed state and restoration snapshots',async()=>{
 await close();await db.exec(migration);assert.equal((await db.query('SELECT session_version FROM users WHERE id=$1',[A])).rows[0].session_version,1);await restore();
});
