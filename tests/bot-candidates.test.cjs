const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const migration=read('20261010100000_bot_candidates.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000003';
const J='20000000-0000-4000-8000-000000000001',R='10000000-0000-4000-8000-000000000001';let db;
const search=async(patch={})=>{const p={actor:A,epoch:0,job:J,region:null,after:null,resume:null,size:200,...patch};return(await db.query('SELECT * FROM ishdasiz_bot_candidates($1,$2,$3,$4,$5,$6,$7)',[p.actor,p.epoch,p.job,p.region,p.after,p.resume,p.size])).rows.map(row=>row.ishdasiz_bot_candidates);};
const offer=async(patch={})=>{const p={actor:A,epoch:0,job:J,resume:R,seeker:S,...patch};return(await db.query('SELECT ishdasiz_bot_create_offer($1,$2,$3,$4,$5) AS r',[p.actor,p.epoch,p.job,p.resume,p.seeker])).rows[0].r;};
before(async()=>{db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
 GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,created_by uuid,status text,is_active boolean,source_status text,region_id integer,district_id integer,category_id uuid,title_uz text,title_ru text,company_name text);
 CREATE TABLE resumes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,status text,is_public boolean,found_job boolean NOT NULL DEFAULT false,title text,full_name text,phone text,telegram text,region_id integer,district_id integer,birth_date date,latitude double precision,secret_unexpected text,created_at timestamptz DEFAULT now());
 CREATE TABLE job_offers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid REFERENCES jobs(id),resume_id uuid REFERENCES resumes(id),employer_user_id uuid,seeker_user_id uuid,status text,created_at timestamptz DEFAULT now());
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 INSERT INTO users VALUES('${A}','secret','+998901234567'),('${B}','secret','+998901234568'),('${S}','secret','+998901234569');
 INSERT INTO employer_profiles VALUES('${A}','${A}'),('${B}','${B}');`);
 await db.exec(read('20261007090000_account_closure.sql'));await db.exec(read('20261009090000_public_job_availability.sql'));await db.exec(migration);
});
beforeEach(async()=>{await db.exec(`RESET ROLE;TRUNCATE job_offers,resumes,jobs,account_publication_snapshots,employer_profiles;
 UPDATE users SET closed_at=null,session_version=0;INSERT INTO employer_profiles VALUES('${A}','${A}'),('${B}','${B}');
 INSERT INTO jobs(id,employer_id,status,is_active,region_id,title_ru,company_name) VALUES('${J}','${A}','active',true,1,'Вакансия','Компания');
 INSERT INTO resumes(id,user_id,status,is_public,title,full_name,phone,telegram,region_id,latitude,secret_unexpected)
 VALUES('${R}','${S}','active',true,'Public CV','Synthetic seeker','+998901111111','cv_contact',1,40.123456,'never expose');`);});
after(async()=>{await db?.close();});
test('candidate summaries and details allow only public CV fields and never private account or coordinates',async()=>{
 const summary=(await search())[0],detail=(await search({resume:R}))[0];assert.equal(summary.id,R);assert.equal(detail.phone,'+998901111111');assert.equal(detail.telegram,'cv_contact');
 for(const key of ['phone','telegram','latitude','secret_unexpected','password_hash'])assert.ok(!(key in summary));
 for(const key of ['latitude','secret_unexpected','password_hash','created_at'])assert.ok(!(key in detail));
});
test('hidden, draft, archived, found-job and orphan resumes never appear in either search or direct detail',async()=>{
 for(const sql of ["is_public=false","status='draft'","status='archived'","status=null","found_job=true","user_id=null"]){
  await db.query('UPDATE resumes SET is_public=true,status=\'active\',found_job=false,user_id=$1 WHERE id=$2',[S,R]);await db.exec('UPDATE resumes SET '+sql);
  assert.deepEqual(await search(),[]);assert.deepEqual(await search({resume:R}),[]);await assert.rejects(offer(),e=>e.code==='42501');
 }
});
test('a closed seeker is excluded even if a legacy public flag is still true; restoration makes it discoverable',async()=>{
 await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[S]);assert.deepEqual(await search(),[]);assert.deepEqual(await search({resume:R}),[]);await assert.rejects(offer(),e=>e.code==='42501');await db.query('UPDATE users SET closed_at=null WHERE id=$1',[S]);assert.equal((await search()).length,1);
});
test('employer epoch, account and role are mandatory for search and invitation writes',async()=>{
 for(const patch of [{actor:B},{actor:S},{epoch:1},{epoch:null}]){await assert.rejects(search(patch));await assert.rejects(offer(patch));}
 await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[A]);await assert.rejects(search(),e=>e.code==='42501');await assert.rejects(offer(),e=>e.code==='42501');
 await db.query('UPDATE users SET closed_at=null,session_version=2 WHERE id=$1',[A]);await assert.rejects(search(),e=>e.code==='42501');assert.equal((await search({epoch:2})).length,1);
 await db.query('DELETE FROM employer_profiles WHERE id=$1',[A]);await assert.rejects(search({epoch:2}));await assert.rejects(offer({epoch:2}));
});
test('vacancy lifecycle and unavailable source are checked for search, cached detail and offers',async()=>{
 for(const sql of ["is_active=false","status='archived'","status='filled'","source_status='removed_at_source'"]){
  await db.exec("UPDATE jobs SET is_active=true,status='active',source_status=null");await db.exec('UPDATE jobs SET '+sql);
  await assert.rejects(search(),e=>e.code==='42501');await assert.rejects(search({resume:R}),e=>e.code==='42501');await assert.rejects(offer(),e=>e.code==='42501');
 }
});
test('profile ownership takes priority over legacy user fields, including a later company transfer',async()=>{
 await db.query('UPDATE jobs SET user_id=$1,created_by=$1',[B]);assert.equal((await search()).length,1);await assert.rejects(search({actor:B}));
 await db.query('UPDATE employer_profiles SET user_id=$1 WHERE id=$2',[B,A]);await assert.rejects(search());await assert.rejects(offer());assert.equal((await search({actor:B})).length,1);assert.equal((await offer({actor:B})).created,true);
});
test('legacy owner fallback is accepted only when an employer profile ID is absent',async()=>{
 await db.query('UPDATE jobs SET employer_id=null,user_id=$1,created_by=$2',[B,A]);await assert.rejects(search());assert.equal((await search({actor:B})).length,1);
 await db.query('UPDATE jobs SET user_id=null');assert.equal((await search()).length,1);
});
test('keyset search reaches over a thousand public CVs and filters before page limits without date dependence',async()=>{
 await db.exec(`INSERT INTO resumes(id,user_id,status,is_public,region_id,title,created_at)
 SELECT ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${S}','active',n%4<>0,CASE WHEN n%3=0 THEN 2 ELSE 1 END,'CV',null FROM generate_series(2,1601) n`);
 const all=[];let after=null;for(;;){const rows=await search({after,region:1});all.push(...rows);if(rows.length<200)break;after=rows.at(-1).id;}
 const expected=(await db.query("SELECT id FROM resumes WHERE is_public AND region_id=1 ORDER BY id")).rows.map(r=>r.id);assert.deepEqual(all.map(r=>r.id),expected);assert.ok(all.length>700);assert.equal(new Set(all.map(r=>r.id)).size,all.length);
 const national=[];after=null;for(;;){const rows=await search({after});national.push(...rows);if(rows.length<200)break;after=rows.at(-1).id;}assert.ok(national.length>1000);
});
test('invitation stores canonical owners and retries return the same pending/sent record without duplicates',async()=>{
 const first=await offer(),second=await offer();assert.equal(first.created,true);assert.equal(second.created,false);assert.equal(first.id,second.id);assert.equal(first.resume_id,R);assert.equal(first.seeker_user_id,S);assert.equal(first.job.title_ru,'Вакансия');
 const saved=(await db.query('SELECT * FROM job_offers')).rows;assert.equal(saved.length,1);assert.equal(saved[0].employer_user_id,A);assert.equal(saved[0].seeker_user_id,S);assert.equal(saved[0].status,'sent');
 await db.exec("UPDATE job_offers SET status='pending'");assert.equal((await offer()).id,first.id);
});
test('simultaneous invitation requests serialize to a single record',async()=>{
 const values=await Promise.all([offer(),offer(),offer()]);assert.equal(values.filter(r=>r.created).length,1);assert.equal(new Set(values.map(r=>r.id)).size,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM job_offers')).rows[0].n,1);
});
test('invitation rechecks publication after a card was read and never revives an earlier offer',async()=>{
 assert.equal((await search({resume:R})).length,1);const first=await offer();await db.exec('UPDATE resumes SET is_public=false');await assert.rejects(offer(),e=>e.code==='42501');assert.equal((await db.query('SELECT count(*)::int AS n FROM job_offers')).rows[0].n,1);assert.equal((await db.query('SELECT id FROM job_offers')).rows[0].id,first.id);
});
test('self invitations are rejected and a real recipient transfer uses its current owner',async()=>{
 await db.query('UPDATE resumes SET user_id=$1',[A]);await assert.rejects(offer(),e=>e.code==='42501');await db.query('UPDATE resumes SET user_id=$1',[B]);await assert.rejects(offer(),e=>e.code==='42501');assert.equal((await offer({seeker:B})).seeker_user_id,B);
});
test('a database failure rolls back an invitation instead of recording a partial success',async()=>{
 await db.exec("CREATE FUNCTION reject_offer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure';END $$;CREATE TRIGGER reject_offer BEFORE INSERT ON job_offers FOR EACH ROW EXECUTE FUNCTION reject_offer();");try{await assert.rejects(offer());assert.equal((await db.query('SELECT count(*)::int AS n FROM job_offers')).rows[0].n,0);}finally{await db.exec('DROP TRIGGER reject_offer ON job_offers;DROP FUNCTION reject_offer()');}
});
test('browser roles cannot invoke either service RPC; migration reapplication preserves invitations',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(search(),e=>e.code==='42501');await assert.rejects(offer(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');let saved;try{assert.equal((await search()).length,1);saved=await offer();}finally{await db.exec('RESET ROLE');}await db.exec(migration);assert.equal((await offer()).id,saved.id);assert.equal((await offer()).created,false);
});
test('legacy table and column grants cannot bypass the server invitation transaction',async()=>{
 await offer();await db.exec('GRANT ALL ON job_offers TO PUBLIC,anon,authenticated;GRANT SELECT(id),INSERT(id),UPDATE(status),REFERENCES(id) ON job_offers TO PUBLIC,anon,authenticated;');await db.exec(migration);
 for(const role of ['anon','authenticated']){
  const rights=(await db.query("SELECT has_table_privilege($1,'job_offers','SELECT') OR has_table_privilege($1,'job_offers','INSERT') OR has_table_privilege($1,'job_offers','UPDATE') OR has_any_column_privilege($1,'job_offers','SELECT') OR has_any_column_privilege($1,'job_offers','INSERT') OR has_any_column_privilege($1,'job_offers','UPDATE') AS allowed",[role])).rows[0];assert.equal(rights.allowed,false);
  await db.exec('SET ROLE '+role);try{await assert.rejects(db.query('SELECT id FROM job_offers'),e=>e.code==='42501');await assert.rejects(db.query("INSERT INTO job_offers(id) VALUES(gen_random_uuid())"),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
 }
 await db.exec('SET ROLE service_role');try{assert.equal((await db.query('SELECT count(*)::int AS n FROM job_offers')).rows[0].n,1);}finally{await db.exec('RESET ROLE');}
});
