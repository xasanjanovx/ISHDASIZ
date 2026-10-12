const { test,before,beforeEach,after } = require('node:test');
const assert = require('node:assert/strict'),fs = require('node:fs'),path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const read = file => fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000003',T='00000000-0000-4000-8000-000000000004';
const J='10000000-0000-4000-8000-000000000001',K='10000000-0000-4000-8000-000000000002',R='20000000-0000-4000-8000-000000000001';
const O='30000000-0000-4000-8000-000000000001',X='30000000-0000-4000-8000-000000000002';
const migration=read('20261010160000_seeker_offers.sql');let db;
const page=async(user=S,epoch=0,cursor=null,size=10)=>(await db.query('SELECT ishdasiz_seeker_offers($1,$2,$3,$4,$5) r',[user,epoch,cursor?.created_at??null,cursor?.id??null,size])).rows[0].r;
const detail=async(id=O,user=S,epoch=0,byJob=false)=>(await db.query('SELECT ishdasiz_seeker_offer($1,$2,$3,$4) r',[user,epoch,byJob?null:id,byJob?id:null])).rows[0].r;
const seen=async(id=O,user=S,epoch=0)=>(await db.query('SELECT ishdasiz_seeker_offer_seen($1,$2,$3) r',[user,epoch,id])).rows[0].r;
before(async()=>{
 db=await PGlite.create();await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/legacy-release-baseline.sql'),'utf8'));
 for(const file of ['20260212_add_job_offers.sql','20260217_channel_autopost_outbox.sql','20260409_job_auto_matches_v2.sql'])await db.exec(read(file));
 await db.exec('GRANT ALL ON job_offers TO PUBLIC,anon,authenticated;GRANT SELECT(message),UPDATE(seen_at) ON job_offers TO anon,authenticated;');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../supabase/releases/2026-10-repair.json'),'utf8'));
 for(const {file}of manifest.migrations)await db.exec(read(file));
 // Model historical null dates too, without changing the production schema.
 await db.exec(`ALTER TABLE job_offers ALTER COLUMN created_at DROP NOT NULL;
 ALTER TABLE jobs ADD COLUMN secret_unexpected text;ALTER TABLE resumes ADD COLUMN secret_unexpected text;
 INSERT INTO regions VALUES(1,'andijon-viloyati','Andijon','Андижан'),(22,'toshkent-shahri','Toshkent','Ташкент');INSERT INTO districts VALUES(10,1,'Tuman','Район'),(220,22,'Yunusobod','Юнусабад');`);
});
beforeEach(async()=>{
 await db.exec(`RESET ROLE;TRUNCATE users,job_seeker_profiles,employer_profiles,jobs,resumes,job_offers CASCADE;
 INSERT INTO users(id,phone,password_hash) VALUES('${A}','+998901111111','synthetic'),('${B}','+998902222222','synthetic'),('${S}','+998903333333','synthetic'),('${T}','+998904444444','synthetic');
 INSERT INTO employer_profiles(id,user_id) VALUES('${A}','${A}'),('${B}','${B}');INSERT INTO job_seeker_profiles(id,user_id) VALUES('${S}','${S}'),('${T}','${T}');
 INSERT INTO jobs(id,employer_id,title_ru,company_name,region_id,district_id,contact_phone,secret_unexpected,raw_source_json) VALUES('${J}','${A}','Public vacancy','Public company',22,10,'+998905555555','PRIVATE_JOB','{"secret":"PRIVATE_RAW"}'),('${K}','${B}','Other vacancy','Other company',1,10,null,null,null);
 INSERT INTO resumes(id,user_id,title,full_name,status,is_public,secret_unexpected) VALUES('${R}','${S}','Exact CV','Synthetic seeker','active',false,'PRIVATE_CV');
 INSERT INTO job_offers(id,job_id,resume_id,employer_user_id,seeker_user_id,status,message,created_at) VALUES('${O}','${J}','${R}','${A}','${S}','sent','Synthetic invitation','2026-10-10T00:00:00.123456Z'),('${X}','${K}',null,'${B}','${T}','sent','FOREIGN_SECRET','2026-10-10T00:00:00.123456Z');`);
});
after(async()=>{await db?.close();});

test('invitation pages retain more than a thousand records, equal timestamps and null-date history without duplicates or other recipients',async()=>{
 await db.exec(`DELETE FROM job_offers WHERE id='${O}';INSERT INTO job_offers(id,job_id,employer_user_id,seeker_user_id,created_at)
 SELECT ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${J}','${A}','${S}',CASE WHEN n<=10 THEN null ELSE '2026-10-10T00:00:00.123456Z'::timestamptz END FROM generate_series(1,1205) n;`);
 let cursor=null;const ids=[];for(let n=0;n<130;n++){const p=await page(S,0,cursor);ids.push(...p.items.map(o=>o.id));assert(p.items.every(o=>o.seeker_user_id===S));if(!p.next_cursor)break;cursor=p.next_cursor;}
 assert.equal(ids.length,1205);assert.equal(new Set(ids).size,1205);assert(ids[0].endsWith('000000001205'));assert(ids.at(-1).endsWith('000000000001'));
});
test('list is minimal, recipient-scoped, does not mark read and returns a real continuation',async()=>{
 const p=await page();assert.equal(p.items.length,1);assert.equal(p.next_cursor,null);const text=JSON.stringify(p);for(const secret of ['FOREIGN_SECRET','PRIVATE_JOB','PRIVATE_RAW','PRIVATE_CV','contact_phone','resume','message'])assert(!text.includes(secret));
 assert.equal(p.items[0].job_available,true);assert.equal((await db.query('SELECT seen_at FROM job_offers WHERE id=$1',[O])).rows[0].seen_at,null);
});
test('detail keeps only this recipient and the exact submitted active own resume, including a private CV',async()=>{
 const d=await detail();assert.equal(d.id,O);assert.equal(d.resume.id,R);assert.equal(d.resume.user_id,S);assert.equal(d.job.id,J);assert.equal(d.job.contact_phone,'+998905555555');assert.equal(d.job.districts,null);assert.equal(d.job.regions.name_ru,'Ташкент');
 for(const secret of ['PRIVATE_JOB','PRIVATE_RAW','PRIVATE_CV','password_hash','phone":"+998903'])assert(!JSON.stringify(d).includes(secret));assert.equal(d.seen_at,null);
});
test('foreign IDs and legacy job-only links without a real recipient invitation return no record and never mark anything read',async()=>{
 assert.equal(await detail(X),null);assert.equal(await detail(K,S,0,true),null);assert.equal(await seen(X),null);assert.equal((await detail(J,S,0,true)).id,O);assert.equal((await db.query('SELECT count(*)::int n FROM job_offers WHERE seen_at IS NOT NULL')).rows[0].n,0);
});
test('unavailable, transferred, source-removed and closed-owner jobs retain history without current job fields or an invented invitation',async()=>{
 for(const sql of ["UPDATE jobs SET status='archived' WHERE id=$1","UPDATE jobs SET source_status='removed_at_source' WHERE id=$1",`UPDATE jobs SET employer_id='${B}' WHERE id=$1`]){
  await db.exec('BEGIN');try{await db.query(sql,[J]);const d=await detail();assert.equal(d.job_available,false);assert.equal(d.job,null);assert.equal(d.resume,null);assert.equal(d.message,'Synthetic invitation');assert.equal((await page()).items[0].job,null);}finally{await db.exec('ROLLBACK');}
 }
 await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[A]);assert.equal((await detail()).job_available,false);assert.equal((await db.query('SELECT count(*)::int n FROM job_offers')).rows[0].n,2);
});
test('archived, found-job, transferred or missing invitation resumes never fall back to another active CV',async()=>{
 await db.exec(`INSERT INTO resumes(id,user_id,title,status,is_public) VALUES('${T}','${S}','UNRELATED_ACTIVE_CV','active',true);`);
 for(const sql of ["UPDATE resumes SET status='archived' WHERE id=$1","UPDATE resumes SET found_job=true WHERE id=$1",`UPDATE resumes SET user_id='${T}' WHERE id=$1`]){
  await db.exec('BEGIN');try{await db.query(sql,[R]);const d=await detail();assert.equal(d.job_available,true);assert.equal(d.resume_id,null);assert.equal(d.resume,null);assert(!JSON.stringify(d).includes('UNRELATED_ACTIVE_CV'));}finally{await db.exec('ROLLBACK');}
 }
 await db.query('UPDATE job_offers SET resume_id=null WHERE id=$1',[O]);assert.equal((await detail()).resume,null);
});
test('read receipts are idempotent, recipient-scoped and preserve status, messages and notification history',async()=>{
 await db.query("UPDATE job_offers SET notified_at='2026-01-01',updated_at='2026-01-02' WHERE id=$1",[O]);const before=(await db.query('SELECT * FROM job_offers WHERE id=$1',[O])).rows[0];
 const first=await seen(),second=await seen();assert(first.seen_at);assert.equal(second.seen_at,first.seen_at);const after=(await db.query('SELECT * FROM job_offers WHERE id=$1',[O])).rows[0];
 for(const key of ['status','message','notified_at','resume_id','job_id','seeker_user_id','employer_user_id'])assert.deepEqual(after[key],before[key]);assert.equal((await db.query('SELECT seen_at FROM job_offers WHERE id=$1',[X])).rows[0].seen_at,null);
});
test('a failed receipt write rolls back and cannot falsely acknowledge a read',async()=>{
 await db.exec("CREATE FUNCTION reject_offer_receipt() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic failure';END$$;CREATE TRIGGER reject_offer_receipt BEFORE UPDATE ON job_offers FOR EACH ROW EXECUTE FUNCTION reject_offer_receipt();");
 try{await assert.rejects(seen());assert.equal((await db.query('SELECT seen_at FROM job_offers WHERE id=$1',[O])).rows[0].seen_at,null);}finally{await db.exec('DROP TRIGGER reject_offer_receipt ON job_offers;DROP FUNCTION reject_offer_receipt();');}
});
test('all reads and receipts recheck the open account, seeker profile and current epoch in SQL',async()=>{
 for(const change of [`UPDATE users SET session_version=1 WHERE id='${S}'`,`UPDATE users SET closed_at=now() WHERE id='${S}'`,`DELETE FROM job_seeker_profiles WHERE user_id='${S}'`]){
  await db.exec('BEGIN');try{await db.exec(change);for(const action of [()=>page(),()=>detail(),()=>seen()]){await db.exec('SAVEPOINT rejected_action');await assert.rejects(action(),e=>e.code==='42501');await db.exec('ROLLBACK TO SAVEPOINT rejected_action');}}finally{await db.exec('ROLLBACK');}
 }
});
test('invalid pages and ambiguous selectors are rejected before returning history',async()=>{
 for(const size of [0,51,null])await assert.rejects(page(S,0,null,size),e=>e.code==='22023');
 await assert.rejects(db.query('SELECT ishdasiz_seeker_offers($1,0,now(),null,10)',[S]),e=>e.code==='22023');
 for(const ids of [[null,null],[O,J]])await assert.rejects(db.query('SELECT ishdasiz_seeker_offer($1,0,$2,$3)',[S,...ids]),e=>e.code==='22023');
});
test('browser roles cannot read invitation columns, change receipts or execute protected RPCs even with legacy grants/policies',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{
  for(const query of ['SELECT * FROM job_offers','SELECT message FROM job_offers','UPDATE job_offers SET seen_at=now()',`SELECT ishdasiz_seeker_offers('${S}',0)`,`SELECT ishdasiz_seeker_offer('${S}',0,'${O}',null)`,`SELECT ishdasiz_seeker_offer_seen('${S}',0,'${O}')`])await assert.rejects(db.query(query),e=>e.code==='42501');
 }finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.equal((await detail()).id,O);}finally{await db.exec('RESET ROLE');}
});
test('reapplying invitation protection preserves seen markers, all history, notifications and one pagination index',async()=>{
 await seen();const prior=(await db.query('SELECT * FROM job_offers ORDER BY id')).rows;await db.exec(migration);assert.deepEqual((await db.query('SELECT * FROM job_offers ORDER BY id')).rows,prior);
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_indexes WHERE indexname='ishdasiz_seeker_offer_page'")).rows[0].n,1);
});
