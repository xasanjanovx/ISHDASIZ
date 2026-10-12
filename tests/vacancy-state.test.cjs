const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const clock=read('20261007094000_vacancy_updated_at.sql'),quota=read('20261007095000_vacancy_ai_quota.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';let db;
const reserve=(id=A,epoch=0)=>db.query('SELECT ishdasiz_reserve_vacancy_ai($1,$2) AS remaining',[id,epoch]);
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,session_version integer NOT NULL DEFAULT 0,closed_at timestamptz);
 INSERT INTO users(id) VALUES('${A}'),('${B}'),('${C}');
 CREATE TABLE jobs(id integer PRIMARY KEY,status text,is_active boolean,updated_at timestamptz);
 INSERT INTO jobs VALUES(1,'active',true,'2099-01-01T00:00:00.123456Z');
 CREATE TABLE job_applications(id integer PRIMARY KEY,job_id integer REFERENCES jobs(id),status text);
 INSERT INTO job_applications VALUES(1,1,'pending');`);await db.exec(clock);await db.exec(quota);
});
after(async()=>{await db?.close();});
test('external writes advance exact microsecond versions even when the old timestamp is in the future',async()=>{
 const old=(await db.query('SELECT updated_at::text AS v FROM jobs WHERE id=1')).rows[0].v;
 await db.exec("UPDATE jobs SET status='archived',is_active=true WHERE id=1");
 assert.equal((await db.query('SELECT updated_at>$1::timestamptz AS changed,is_active FROM jobs WHERE id=1',[old])).rows[0].changed,true);
 assert.equal((await db.query('SELECT is_active FROM jobs WHERE id=1')).rows[0].is_active,false);
 assert.equal((await db.query("UPDATE jobs SET status='active' WHERE id=1 AND updated_at=$1::timestamptz RETURNING id",[old])).rows.length,0);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,1);
 for(const status of ['draft','filled']){await db.query('UPDATE jobs SET status=$1,is_active=true WHERE id=1',[status]);assert.equal((await db.query('SELECT is_active FROM jobs WHERE id=1')).rows[0].is_active,false);}
 await db.exec("UPDATE jobs SET status='draft',is_active=false WHERE id=1");assert.equal((await db.query('SELECT status FROM job_applications')).rows[0].status,'pending');
});
test('only three attempts per account per hour are reserved across simultaneous requests and quota resets after expiry',async()=>{
 const results=await Promise.all(Array.from({length:7},()=>reserve()));assert.deepEqual(results.map(result=>result.rows[0].remaining),[2,1,0,-1,-1,-1,-1]);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM vacancy_ai_usage WHERE user_id=$1',[A])).rows[0].n,3);
 assert.equal((await reserve(B)).rows[0].remaining,2);
 await db.query("UPDATE vacancy_ai_usage SET created_at=clock_timestamp()-interval '61 minutes' WHERE user_id=$1",[A]);assert.equal((await reserve()).rows[0].remaining,2);
});
test('views and no-op writes preserve the editor version while content changes invalidate it',async()=>{
 await db.exec('ALTER TABLE jobs ADD COLUMN views_count integer DEFAULT 0;ALTER TABLE jobs ADD COLUMN title text');
 const version=()=>db.query('SELECT updated_at::text AS v FROM jobs WHERE id=1');const old=(await version()).rows[0].v;
 await db.exec('UPDATE jobs SET views_count=views_count+1,updated_at=now() WHERE id=1');assert.equal((await version()).rows[0].v,old);
 await db.exec('UPDATE jobs SET status=status WHERE id=1');assert.equal((await version()).rows[0].v,old);
 await db.exec("UPDATE jobs SET title='Edited' WHERE id=1");assert.notEqual((await version()).rows[0].v,old);
});
test('closed, missing, revoked and absent session versions cannot reserve a paid request',async()=>{
 await db.query('UPDATE users SET closed_at=now(),session_version=1 WHERE id=$1',[C]);
 for(const [id,epoch] of [[C,1],[B,2],[B,null],['00000000-0000-4000-8000-000000000099',0]])await assert.rejects(reserve(id,epoch),e=>e.code==='42501');
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM vacancy_ai_usage WHERE user_id=$1',[C])).rows[0].n,0);
 await db.query('UPDATE users SET closed_at=null,session_version=2 WHERE id=$1',[C]);await assert.rejects(reserve(C,1),e=>e.code==='42501');assert.equal((await reserve(C,2)).rows[0].remaining,2);
});
test('quota records and reservation function are inaccessible to public database roles',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);try{
  await assert.rejects(db.query('SELECT * FROM vacancy_ai_usage'),e=>e.code==='42501');await assert.rejects(reserve(),e=>e.code==='42501');
  await assert.rejects(db.query('DELETE FROM vacancy_ai_usage'),e=>e.code==='42501');
 }finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.equal((await reserve(B)).rows[0].remaining,1);}finally{await db.exec('RESET ROLE');}
});
test('reapplying both migrations preserves quota, vacancies, history and one version trigger',async()=>{
 const count=(await db.query('SELECT count(*)::integer AS n FROM vacancy_ai_usage')).rows[0].n;
 await db.exec(clock);await db.exec(quota);assert.equal((await db.query('SELECT count(*)::integer AS n FROM vacancy_ai_usage')).rows[0].n,count);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM pg_trigger WHERE tgname='ishdasiz_vacancy_updated_at'")).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,1);
});
