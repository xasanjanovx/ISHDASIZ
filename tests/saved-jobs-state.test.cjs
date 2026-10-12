const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007100000_saved_jobs_private.sql'),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',E='10000000-0000-4000-8000-000000000002',J='20000000-0000-4000-8000-000000000001';let db;
const fav=(value,id=J,user=A,epoch=0)=>db.query('SELECT ishdasiz_set_job_favorite($1,$2,$3,$4) AS value',[user,epoch,id,value]);
const view=(id=J,user=A,epoch=0)=>db.query('SELECT ishdasiz_record_job_view($1,$2,$3) AS value',[user,epoch,id]);
const clear=(restore=null,user=A,epoch=0)=>db.query('SELECT ishdasiz_clear_job_history($1,$2,$3) AS id',[user,epoch,restore]);
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,closed_at timestamptz,session_version integer NOT NULL DEFAULT 0);
 INSERT INTO users(id) VALUES('${A}'),('${B}');
 CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id));INSERT INTO employer_profiles VALUES('${E}','${B}');
 CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employer_id uuid,user_id uuid,created_by uuid,status text,is_active boolean,source_status text);
 INSERT INTO jobs VALUES('${J}','${E}','${A}','${A}','active',true,null);
 CREATE TABLE favorites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),job_id uuid REFERENCES jobs(id),created_at timestamptz DEFAULT clock_timestamp(),UNIQUE(user_id,job_id));
 CREATE TABLE view_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),job_id uuid REFERENCES jobs(id),viewed_at timestamptz,UNIQUE(user_id,job_id));
 CREATE FUNCTION ishdasiz_job_owner(employer uuid,owner uuid,creator uuid) RETURNS uuid LANGUAGE sql STABLE AS $$SELECT CASE WHEN employer IS NOT NULL THEN (SELECT user_id FROM employer_profiles WHERE id=employer) ELSE coalesce(owner,creator) END$$;
 CREATE FUNCTION ishdasiz_account_open(owner uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT owner IS NULL OR EXISTS(SELECT 1 FROM users WHERE id=owner AND closed_at IS NULL)$$;
 GRANT ALL ON favorites,view_history TO anon,authenticated;GRANT SELECT(user_id),UPDATE(viewed_at) ON view_history TO PUBLIC;
 CREATE POLICY legacy_favorites ON favorites USING(true) WITH CHECK(true);CREATE POLICY legacy_history ON view_history USING(true) WITH CHECK(true);`);await db.exec(sql);
});after(async()=>{await db?.close();});
test('desired bookmark state is idempotent and retains its original timestamp',async()=>{
 assert.equal((await fav(true)).rows[0].value,true);const old=(await db.query('SELECT id,created_at::text FROM favorites WHERE user_id=$1',[A])).rows[0];
 await Promise.all([fav(true),fav(true)]);assert.deepEqual((await db.query('SELECT id,created_at::text FROM favorites WHERE user_id=$1',[A])).rows,[old]);
 await fav(true,J,B);assert.equal((await fav(false)).rows[0].value,false);await fav(false);
 assert.equal((await db.query('SELECT user_id FROM favorites')).rows[0].user_id,B);
});
test('closed, missing and stale account versions cannot mutate private data',async()=>{
 await db.query('UPDATE users SET closed_at=now(),session_version=1 WHERE id=$1',[A]);
 for(const fn of [()=>fav(true,J,A,1),()=>view(J,A,1),()=>clear(null,A,1)])await assert.rejects(fn(),e=>e.code==='42501');
 await db.query('UPDATE users SET closed_at=null,session_version=2 WHERE id=$1',[A]);
 for(const fn of [()=>fav(false,J,A,0),()=>view(J,A,null),()=>clear(null,A,1)])await assert.rejects(fn(),e=>e.code==='42501');
 await db.query('UPDATE users SET session_version=0 WHERE id=$1',[A]);
});
test('drafts, removed source listings and closed assigned owners are unavailable despite active flags and legacy creators',async()=>{
 for(const values of ["status='draft'","status='active',source_status='removed_at_source'"]){await db.exec(`UPDATE jobs SET ${values} WHERE id='${J}'`);await assert.rejects(fav(true),e=>e.code==='P0002');assert.equal((await view()).rows[0].value,false);}
 await db.exec(`UPDATE jobs SET status='active',source_status=null WHERE id='${J}';UPDATE users SET closed_at=now() WHERE id='${B}'`);
 await assert.rejects(fav(true),e=>e.code==='P0002');assert.equal((await view()).rows[0].value,false);
 await db.exec(`UPDATE users SET closed_at=null WHERE id='${B}'`);
});
test('clear hides more than 1000 own rows; undo preserves new views, other users and bookmarks',async()=>{
 await db.exec(`INSERT INTO jobs(status,is_active) SELECT 'active',true FROM generate_series(1,1205);
 INSERT INTO view_history(user_id,job_id,viewed_at) SELECT '${A}',id,'2026-10-01T00:00:00.123456Z' FROM jobs;
 INSERT INTO view_history(user_id,job_id,viewed_at) VALUES('${B}','${J}',now());`);
 const batch=(await clear()).rows[0].id;
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM view_history WHERE user_id=$1 AND hidden_batch_id IS NULL',[A])).rows[0].n,0);
 await view();const newDate=(await db.query('SELECT viewed_at::text AS at FROM view_history WHERE user_id=$1 AND job_id=$2',[A,J])).rows[0].at;
 await clear(batch);await clear(batch);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM view_history WHERE user_id=$1 AND hidden_batch_id IS NULL',[A])).rows[0].n,1206);
 assert.equal((await db.query('SELECT viewed_at::text AS at FROM view_history WHERE user_id=$1 AND job_id=$2',[A,J])).rows[0].at,newDate);
 assert.equal((await db.query('SELECT hidden_batch_id FROM view_history WHERE user_id=$1',[B])).rows[0].hidden_batch_id,null);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM favorites')).rows[0].n,1);
});
test('foreign and superseded undo tokens conflict without exposing or restoring rows',async()=>{
 const first=(await clear()).rows[0].id;const second=(await clear()).rows[0].id;
 await assert.rejects(clear(first),e=>e.code==='40001');await assert.rejects(clear(second,B),e=>e.code==='40001');await clear(second);await clear(second);await clear(first);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM view_history WHERE user_id=$1 AND hidden_batch_id IS NULL',[A])).rows[0].n,1206);
});
test('failed clear rolls back both batch and visibility changes',async()=>{
 await view();
 const count=(await db.query('SELECT count(*)::integer AS n FROM history_clear_batches')).rows[0].n;
 await db.exec('ALTER TABLE view_history ADD CONSTRAINT reject_hide CHECK(hidden_batch_id IS NULL) NOT VALID');
 try{await assert.rejects(clear(),e=>e.code==='23514');assert.equal((await db.query('SELECT count(*)::integer AS n FROM history_clear_batches')).rows[0].n,count);}finally{await db.exec('ALTER TABLE view_history DROP CONSTRAINT reject_hide');}
});
test('public roles lose table, column and RPC access even with permissive legacy policies',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);try{
  for(const query of ['SELECT user_id FROM favorites','SELECT user_id FROM view_history','SELECT user_id FROM history_clear_batches','UPDATE view_history SET viewed_at=now()'])await assert.rejects(db.query(query),e=>e.code==='42501');
  for(const fn of [()=>fav(true),()=>view(),()=>clear()])await assert.rejects(fn(),e=>e.code==='42501');
 }finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.equal((await view()).rows[0].value,true);}finally{await db.exec('RESET ROLE');}
});
test('reapplying the migration preserves bookmarks, view dates and pending undo',async()=>{
 const batch=(await clear()).rows[0].id;const rows=(await db.query('SELECT id,viewed_at::text,hidden_batch_id FROM view_history ORDER BY id')).rows;
 await db.exec(sql);assert.deepEqual((await db.query('SELECT id,viewed_at::text,hidden_batch_id FROM view_history ORDER BY id')).rows,rows);await clear(batch);
});
