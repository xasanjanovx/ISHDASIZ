const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const migration=read('20261010140000_auto_match_actions.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000003';
const J='20000000-0000-4000-8000-000000000001',R='10000000-0000-4000-8000-000000000001';let db;
before(async()=>{db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text,telegram_user_id bigint);CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,created_by uuid,status text,is_active boolean,source_status text,region_id integer,district_id integer,category_id uuid,title_uz text,title_ru text,company_name text);
 CREATE TABLE resumes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,status text,is_public boolean,found_job boolean NOT NULL DEFAULT false,title text,full_name text,phone text,telegram text,region_id integer,district_id integer,birth_date date,latitude double precision,secret_unexpected text,created_at timestamptz DEFAULT now());
 CREATE TABLE job_offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid REFERENCES jobs(id),resume_id uuid REFERENCES resumes(id),employer_user_id uuid,seeker_user_id uuid,status text,created_at timestamptz DEFAULT now());
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 INSERT INTO users VALUES('${A}','secret','+998901234567',101),('${B}','secret','+998901234568',102),('${S}','secret','+998901234569',103);
 INSERT INTO employer_profiles VALUES('${A}','${A}'),('${B}','${B}');`);
 await db.exec(read('20261007090000_account_closure.sql'));await db.exec(read('20261009090000_public_job_availability.sql'));await db.exec(read('20260409_job_auto_matches_v2.sql'));await db.exec("CREATE TABLE job_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid,resume_id uuid,user_id uuid,status text);");await db.exec(migration);
});
beforeEach(async()=>{await db.exec(`RESET ROLE;TRUNCATE job_auto_matches,job_applications,job_offers,resumes,jobs,account_publication_snapshots,employer_profiles;
 UPDATE users SET closed_at=null,session_version=0;TRUNCATE job_seeker_profiles;INSERT INTO job_seeker_profiles VALUES('${S}','${S}');INSERT INTO employer_profiles VALUES('${A}','${A}'),('${B}','${B}');
 INSERT INTO jobs(id,employer_id,status,is_active,region_id,title_ru,company_name) VALUES('${J}','${A}','active',true,1,'Вакансия','Компания');
 INSERT INTO resumes(id,user_id,status,is_public,title,full_name,phone,telegram,region_id,latitude,secret_unexpected)
 VALUES('${R}','${S}','active',true,'Public CV','Synthetic seeker','+998901111111','cv_contact',1,40.123456,'never expose');`);});
after(async()=>{await db?.close();});

const T='30000000-0000-4000-8000-000000000001',N='30000000-0000-4000-8000-000000000002';
const store=async(patch={})=>{const p={actor:A,epoch:0,job:J,resume:R,seeker:S,score:80,criteria:{region:true},token:T,...patch};return(await db.query('SELECT ishdasiz_auto_match_store($1,$2,$3,$4,$5,$6,$7,$8) r',[p.actor,p.epoch,p.job,p.resume,p.seeker,p.score,JSON.stringify(p.criteria),p.token])).rows[0].r;};
const action=async(id,kind='skip',patch={})=>{const p={actor:S,epoch:0,job:null,...patch};return(await db.query('SELECT ishdasiz_auto_match_action($1,$2,$3,$4,$5) r',[p.actor,p.epoch,id,kind,p.job])).rows[0].r;};
const delivery=async(id,outcome='sent',message=11,token=T)=>(await db.query('SELECT ishdasiz_auto_match_delivery($1,$2,$3,$4) r',[id,token,outcome,message])).rows[0].r;
test('repeat scoring preserves seeker response, delivery markers and original recipient',async()=>{
 const first=await store();await delivery(first.id);await action(first.id);const before=(await db.query('SELECT * FROM job_auto_matches')).rows[0];const next=await store({score:95,token:N});const after=(await db.query('SELECT * FROM job_auto_matches')).rows[0];assert.equal(next.id,first.id);assert.equal(next.notification_token,null);assert.equal(after.match_score,95);for(const key of ['user_id','seeker_response','responded_at','notified','notified_at','notification_token','notification_message_id'])assert.deepEqual(after[key],before[key]);assert.equal((await db.query('SELECT count(*)::int n FROM job_offers')).rows[0].n,0);
});
test('an in-flight or uncertain notification cannot be claimed again after a retry or account restart',async()=>{
 const first=await store();assert.equal(first.notification_token,T);assert.equal(first.telegram_user_id,103);assert.equal((await store({token:N})).notification_token,null);await delivery(first.id,'uncertain',null);assert.equal((await store({token:N})).notification_token,null);assert.equal((await db.query('SELECT notification_token FROM job_auto_matches')).rows[0].notification_token,T);
});
test('only an explicit rejected delivery permits a new notification claim; stale acknowledgement cannot overwrite it',async()=>{
 const first=await store();await delivery(first.id,'rejected',null);assert.equal((await store({token:N})).notification_token,N);assert.equal(await delivery(first.id),false);assert.equal(await delivery(first.id,'sent',12,N),true);assert.equal(await delivery(first.id,'uncertain',null,N),false);
});
test('foreign IDs, revoked sessions and transferred resume owners cannot update recommendation responses',async()=>{
 const first=await store();await assert.rejects(action(first.id,'skip',{actor:B}),e=>e.code==='42501');await db.query('UPDATE users SET session_version=1 WHERE id=$1',[S]);await assert.rejects(action(first.id),e=>e.code==='42501');await db.query('UPDATE users SET session_version=0 WHERE id=$1',[S]);await db.query('UPDATE resumes SET user_id=$1',[B]);await assert.rejects(action(first.id),e=>e.code==='42501');assert.equal((await db.query('SELECT seeker_response FROM job_auto_matches')).rows[0].seeker_response,null);
});
test('interest requires a real saved application with an owned resume, never just clicking a button',async()=>{
 const first=await store();await assert.rejects(action(first.id,'interested'),e=>e.code==='40001');await db.query('INSERT INTO job_applications(job_id,resume_id,user_id,status) VALUES($1,$2,$3,$4)',[J,R,S,'pending']);assert.equal((await action(first.id,'interested')).seeker_response,'interested');assert.equal((await db.query('SELECT count(*)::int n FROM job_applications')).rows[0].n,1);
});
test('a mismatched job callback and expired source cannot open a recommendation; dismissal remains possible',async()=>{
 const first=await store();await assert.rejects(action(first.id,'view',{job:R}),e=>e.code==='42501');await db.exec("UPDATE jobs SET source_status='removed_at_source'");await assert.rejects(action(first.id,'view'),e=>e.code==='42501');assert.equal((await action(first.id)).seeker_response,'not_interested');
});
test('closing either account, a hidden or found-job CV, and transferred job ownership prevent notification claims',async()=>{
 for(const sql of ["UPDATE users SET closed_at=now() WHERE id='"+S+"'","UPDATE users SET closed_at=now() WHERE id='"+A+"'","UPDATE resumes SET is_public=false","UPDATE resumes SET found_job=true","UPDATE jobs SET employer_id='"+B+"'"]){await db.exec("UPDATE users SET closed_at=null;UPDATE resumes SET is_public=true,status='active',found_job=false;");await db.query('UPDATE jobs SET employer_id=$1',[A]);await db.exec(sql);await assert.rejects(store(),e=>e.code==='42501');}assert.equal((await db.query('SELECT count(*)::int n FROM job_auto_matches')).rows[0].n,0);
});
test('transferring a resume never reassigns or erases its old recommendation history',async()=>{
 const first=await store();await action(first.id);await db.query('UPDATE resumes SET user_id=$1',[B]);await assert.rejects(store({seeker:B}),e=>e.code==='42501');const row=(await db.query('SELECT * FROM job_auto_matches')).rows[0];assert.equal(row.user_id,S);assert.equal(row.seeker_response,'not_interested');
});
test('without a linked Telegram account the recommendation remains pending and can be claimed later',async()=>{
 await db.query('UPDATE users SET telegram_user_id=null WHERE id=$1',[S]);const first=await store();assert.equal(first.notification_token,null);assert.equal((await db.query('SELECT notification_state FROM job_auto_matches')).rows[0].notification_state,'pending');await db.query('UPDATE users SET telegram_user_id=103 WHERE id=$1',[S]);assert.equal((await store()).notification_token,T);
});
test('invalid scores, criteria and delivery IDs leave all recommendation and invitation history intact',async()=>{
 for(const patch of [{score:-1},{score:101},{criteria:[]},{criteria:{text:'x'.repeat(17000)}},{epoch:-1}])await assert.rejects(store(patch),e=>e.code==='22023');const first=await store();for(const id of [0,-1,'9007199254740992'])await assert.rejects(delivery(first.id,'sent',id),e=>e.code==='22023');assert.equal((await db.query('SELECT notified FROM job_auto_matches')).rows[0].notified,false);
});
test('public table/column grants cannot bypass recommendation RPCs and repeated migration preserves history',async()=>{
 const first=await store();await action(first.id);await db.exec('GRANT ALL ON job_auto_matches TO PUBLIC,anon,authenticated;GRANT SELECT(id),UPDATE(seeker_response) ON job_auto_matches TO PUBLIC,anon,authenticated');await db.exec(migration);for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(action(first.id),e=>e.code==='42501');await assert.rejects(db.query('SELECT id FROM job_auto_matches'),e=>e.code==='42501');await assert.rejects(store(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}assert.equal((await db.query('SELECT seeker_response FROM job_auto_matches')).rows[0].seeker_response,'not_interested');
});

test('manual delivery recovery requires the exact old attempt and an explicit verified outcome',async()=>{
 const first=await store(),resolve=async(expected,message=null,absent=true)=>(await db.query('SELECT ishdasiz_auto_match_resolve($1,$2,$3,$4) r',[first.id,expected,message,absent])).rows[0].r;
 let at=(await db.query('SELECT notification_attempted_at::text a FROM job_auto_matches')).rows[0].a;await assert.rejects(resolve(at),e=>e.code==='55000');await db.exec("UPDATE job_auto_matches SET notification_attempted_at=now()-interval '10 minutes'");assert.equal(await resolve(at),false);at=(await db.query('SELECT notification_attempted_at::text a FROM job_auto_matches')).rows[0].a;await assert.rejects(resolve(at,11,true),e=>e.code==='22023');assert.equal(await resolve(at,11,false),true);assert.equal(await resolve(at),false);assert.equal((await db.query('SELECT notification_message_id FROM job_auto_matches')).rows[0].notification_message_id,11);
});
test('manual non-delivery resolution preserves the seeker response and does not send a notification itself',async()=>{
 const first=await store();await action(first.id);await db.exec("UPDATE job_auto_matches SET notification_attempted_at=now()-interval '10 minutes'");const at=(await db.query('SELECT notification_attempted_at::text a FROM job_auto_matches')).rows[0].a;assert.equal((await db.query('SELECT ishdasiz_auto_match_resolve($1,$2,null,true) r',[first.id,at])).rows[0].r,true);assert.equal((await store({token:N})).notification_token,null);assert.equal((await db.query('SELECT seeker_response FROM job_auto_matches')).rows[0].seeker_response,'not_interested');
 await db.exec('SET ROLE anon');try{await assert.rejects(db.query('SELECT ishdasiz_auto_match_resolve($1,$2,null,true)',[first.id,at]),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
});

test('dismissing a recommendation never changes an employer invitation or withdraws a saved application',async()=>{
 const first=await store();await db.query('INSERT INTO job_offers(id,job_id,resume_id,employer_user_id,seeker_user_id,status) VALUES($1,$2,$3,$4,$5,$6)',[first.id,J,R,A,S,'pending']);await db.query('INSERT INTO job_applications(job_id,resume_id,user_id,status) VALUES($1,$2,$3,$4)',[J,R,S,'pending']);await action(first.id,'interested');await action(first.id);assert.equal((await db.query('SELECT status FROM job_offers')).rows[0].status,'pending');assert.equal((await db.query('SELECT status FROM job_applications')).rows[0].status,'pending');
});
