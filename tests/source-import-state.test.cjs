const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const migration=read('20261009092000_source_import_state.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',U='00000000-0000-4000-8000-000000000003';
const ID=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const payload=(sourceId='1',patch={})=>({source_id:sourceId,title_uz:'Operator',title_ru:'Оператор',company_name:'Demo',description_uz:'Tavsif',description_ru:'Описание',district_id:100,region_id:1,payment_type:3,salary_min:1000,skills:['Excel'],...patch});
let db;
const begin=async(source='osonish',actor=null)=>(await db.query('SELECT ishdasiz_begin_source_import($1,$2) AS r',[source,actor])).rows[0].r;
const merge=async(run,input=payload())=>(await db.query('SELECT ishdasiz_merge_source_job($1,$2,$3::jsonb) AS r',[run.id,run.token,JSON.stringify(input)])).rows[0].r;
const finish=async(run,complete=true,active=['1'],filled=[],removed=[],total=active.length+filled.length+removed.length)=>(await db.query('SELECT ishdasiz_finish_source_import($1,$2,$3,$4::text[],$5::text[],$6::text[],$7) AS r',[run.id,run.token,complete,active,filled,removed,total])).rows[0].r;
const job=async(id)=>(await db.query('SELECT * FROM jobs WHERE id=$1',[id])).rows[0];
const state=async(id)=>(await db.query('SELECT * FROM job_import_state WHERE job_id=$1',[id])).rows[0];
const version=async(id)=>(await db.query('SELECT updated_at::text AS v FROM jobs WHERE id=$1',[id])).rows[0].v;
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE resumes(id uuid PRIMARY KEY,user_id uuid,is_public boolean,status text,full_name text,phone text);
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 CREATE TABLE admin_profiles(id uuid PRIMARY KEY,full_name text,role text,district_id integer,created_at timestamptz DEFAULT now());
 CREATE TABLE categories(id uuid PRIMARY KEY,name_uz text,name_ru text);CREATE TABLE districts(id integer PRIMARY KEY,name_uz text,name_ru text,region_id integer);CREATE TABLE regions(id integer PRIMARY KEY,name_uz text,name_ru text);
 CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text DEFAULT 'local',source_id text,is_imported boolean DEFAULT false,source_status text DEFAULT 'active',
  source_url text,employer_id uuid,user_id uuid,created_by uuid,title_uz text,title_ru text,description_uz text NOT NULL DEFAULT '',description_ru text NOT NULL DEFAULT '',company_name text,
  category_id uuid,region_id integer,district_id integer,salary_min integer,salary_max integer,employment_type text,latitude double precision,longitude double precision,address text,
  contact_phone text,contact_telegram text,requirements_uz text,requirements_ru text,benefits text,experience text,education_level text,gender text,age_min integer,age_max integer,
  languages jsonb,skills jsonb,is_for_students boolean DEFAULT false,is_for_graduates boolean DEFAULT false,is_for_disabled boolean DEFAULT false,is_for_women boolean DEFAULT false,payment_type integer,work_mode text,
  status text DEFAULT 'active',is_active boolean DEFAULT true,views_count integer DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
  raw_source_json jsonb,last_seen_at timestamptz,last_synced_at timestamptz,last_checked_at timestamptz,UNIQUE(source,source_id));
 CREATE TABLE job_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid REFERENCES jobs(id),status text,user_id uuid,resume_id uuid REFERENCES resumes(id),full_name text,phone text,message text,created_at timestamptz DEFAULT now());
 INSERT INTO users VALUES('${U}','synthetic','+998901234567');
 INSERT INTO admin_profiles(id,role,district_id) VALUES('${A}','super_admin',null),('${B}','hokimlik_assistant',100);
 GRANT ALL ON jobs TO service_role;`);
 await db.exec(read('20261007090000_account_closure.sql'));await db.exec(read('20261007094000_vacancy_updated_at.sql'));await db.exec(read('20261007101000_admin_access.sql'));await db.exec(migration);
 await db.exec('GRANT SELECT ON jobs TO anon,authenticated;CREATE POLICY legacy_public_jobs ON jobs FOR SELECT TO anon,authenticated USING(true);');
 await db.exec(read('20261009090000_public_job_availability.sql'));
 await db.exec(read('20261009091000_application_submission.sql'));
 try{await db.exec(read('20261009100000_osonish_import_worker.sql'));}catch(error){throw new Error(JSON.stringify({message:error.message,position:error.position,internalPosition:error.internalPosition,internalQuery:error.internalQuery,where:error.where}));}
 await db.exec(read('20261009110000_public_statistics.sql'));
 await db.exec(read('20261009130000_vacancy_import_versions.sql'));
});
beforeEach(async()=>{await db.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);TRUNCATE job_applications,resumes,job_seeker_profiles,source_import_items,source_import_checkpoints,job_import_state,source_import_visibility_pending,source_import_runs,admin_actions,account_publication_snapshots,jobs,employer_profiles,regions,districts,categories;UPDATE admin_profiles SET role=CASE WHEN id='${A}' THEN 'super_admin' ELSE 'hokimlik_assistant' END,disabled_at=null;UPDATE users SET closed_at=null,session_version=0;`);});
after(async()=>{await db?.close();});
test('new imports keep database defaults, typed business fields and local counters without assigning account ownership',async()=>{
 const run=await begin();await db.exec('SET ROLE service_role');let result;try{result=await merge(run);}finally{await db.exec('RESET ROLE');}const row=await job(result.id);assert.equal(result.created,true);assert.equal(row.source,'osonish');assert.equal(row.views_count,0);assert.equal(row.payment_type,3);assert.deepEqual(row.skills,['Excel']);assert.equal(row.user_id,null);assert.equal(row.created_by,null);assert.ok(row.created_at);assert.deepEqual((await state(row.id)).overrides,[]);assert.equal((await state(row.id)).pending,null);
});
test('human text and salary edits survive subsequent imports while untouched source fields update and applications remain attached',async()=>{
 const run=await begin();const saved=await merge(run);await db.query("INSERT INTO job_applications(job_id,status) VALUES($1,'pending')",[saved.id]);
 await db.query("SELECT ishdasiz_admin_write_vacancy($1,$2,'edit',$3::jsonb,$4::timestamptz)",[A,saved.id,JSON.stringify({title_ru:'Название от администратора',salary_min:2000}),await version(saved.id)]);
 await db.query('UPDATE jobs SET views_count=35 WHERE id=$1',[saved.id]);await merge(run,payload('1',{title_ru:'Новое название источника',salary_min:3000,company_name:'Updated company'}));
 const row=await job(saved.id);assert.equal(row.title_ru,'Название от администратора');assert.equal(row.salary_min,2000);assert.equal(row.company_name,'Updated company');assert.equal(row.views_count,35);assert.equal((await db.query('SELECT job_id FROM job_applications')).rows[0].job_id,saved.id);assert.deepEqual((await state(saved.id)).overrides.sort(),['salary_min','title_ru']);assert.equal((await state(saved.id)).baseline.salary_min,3000);assert.equal((await state(saved.id)).pending,null);
});
test('identical source checks preserve the editor version and allow an already open admin form to save',async()=>{
 const run=await begin(),saved=await merge(run),observed=await version(saved.id),before=await job(saved.id);
 await merge(run);await finish(run);const checked=await job(saved.id);
 assert.equal(await version(saved.id),observed);assert.ok(new Date(checked.last_checked_at)>=new Date(before.last_checked_at));
 await db.query("SELECT ishdasiz_admin_write_vacancy($1,$2,'edit',$3::jsonb,$4::timestamptz)",[A,saved.id,JSON.stringify({title_ru:'Сохранено после проверки источника'}),observed]);
 assert.equal((await job(saved.id)).title_ru,'Сохранено после проверки источника');assert.notEqual(await version(saved.id),observed);
});
test('real source content and raw public details still invalidate an older form',async()=>{
 const run=await begin(),saved=await merge(run),observed=await version(saved.id);
 await merge(run,payload('1',{description_ru:'Новое описание источника'}));assert.notEqual(await version(saved.id),observed);
 await assert.rejects(db.query("SELECT ishdasiz_admin_write_vacancy($1,$2,'edit',$3::jsonb,$4::timestamptz)",[A,saved.id,JSON.stringify({description_ru:'Устаревшая форма'}),observed]),e=>e.code==='40001');
 const current=await version(saved.id);await merge(run,payload('1',{description_ru:'Новое описание источника',raw_source_json:{working_hours:'09:00–18:00'}}));assert.notEqual(await version(saved.id),current);
});
test('source disappearance and reappearance advance versions but repeated availability checks do not',async()=>{
 const run=await begin(),saved=await merge(run),observed=await version(saved.id);await finish(run,true,[]);const removed=await version(saved.id);assert.notEqual(removed,observed);
 const again=await begin();await finish(again,true,[]);assert.equal(await version(saved.id),removed);
 const restored=await begin();await merge(restored);assert.notEqual(await version(saved.id),removed);const current=await version(saved.id);await finish(restored);assert.equal(await version(saved.id),current);
});
test('reapplying the metadata version migration preserves records, exact versions and one existing trigger',async()=>{
 const run=await begin(),saved=await merge(run),observed=await version(saved.id);await db.exec(read('20261009130000_vacancy_import_versions.sql'));await db.exec(read('20261009130000_vacancy_import_versions.sql'));
 assert.equal(await version(saved.id),observed);assert.equal((await db.query("SELECT count(*)::integer AS n FROM pg_trigger WHERE tgname='ishdasiz_vacancy_updated_at'")).rows[0].n,1);await merge(run);assert.equal(await version(saved.id),observed);
});
test('local drafts, filled jobs and archives are never republished by a returning source',async()=>{
 const run=await begin();for(const [i,status]of ['draft','filled','archived'].entries()){const saved=await merge(run,payload(String(i+1)));await db.query('UPDATE jobs SET status=$1,is_active=false WHERE id=$2',[status,saved.id]);await merge(run,payload(String(i+1),{company_name:'New source company'}));assert.equal((await job(saved.id)).status,status);assert.equal((await job(saved.id)).is_active,false);}
 await finish(run,true,['1','2','3']);const run2=await begin();await finish(run2,true,[]);const run3=await begin();for(const id of ['1','2','3'])await merge(run3,payload(id));await finish(run3,true,['1','2','3']);assert.equal((await db.query('SELECT count(*)::integer AS n FROM jobs WHERE is_active')).rows[0].n,0);
});
test('source disappearance changes only availability and preserves the exact local publication choice for reappearance',async()=>{
 const run=await begin(),saved=await merge(run);await finish(run,true,[]);let row=await job(saved.id);assert.equal(row.source_status,'removed_at_source');assert.equal(row.status,'active');assert.equal(row.is_active,true);const next=await begin();await merge(next);await finish(next);row=await job(saved.id);assert.equal(row.source_status,'active');assert.equal(row.status,'active');assert.equal(row.is_active,true);
});
test('legacy rows without a baseline preserve their existing differing values on the first synchronization',async()=>{
 await db.query("INSERT INTO jobs(id,source,source_id,is_imported,title_ru,company_name,salary_min,status,is_active,views_count) VALUES($1,'osonish','1',true,'Старая ручная правка','Demo',2500,'draft',false,41)",[ID(1)]);const run=await begin();await merge(run);const first=await job(ID(1));assert.equal(first.title_ru,'Старая ручная правка');assert.equal(first.salary_min,2500);assert.equal(first.views_count,41);assert.equal(first.status,'draft');await merge(run,payload('1',{company_name:'Fresh company',salary_min:4000}));assert.equal((await job(ID(1))).company_name,'Fresh company');assert.equal((await job(ID(1))).salary_min,2500);
});
test('a local edit before the first run captures a trustworthy baseline, and reverting to the last source value resumes automatic updates',async()=>{
 await db.query("INSERT INTO jobs(id,source,source_id,is_imported,title_ru,salary_min) VALUES($1,'osonish','1',true,'Original',1000)",[ID(1)]);await db.query("UPDATE jobs SET title_ru='Custom' WHERE id=$1",[ID(1)]);const run=await begin();await merge(run,payload('1',{title_ru:'Source changed',salary_min:3000}));assert.equal((await job(ID(1))).title_ru,'Custom');assert.equal((await job(ID(1))).salary_min,3000);await db.query("UPDATE jobs SET title_ru='Source changed' WHERE id=$1",[ID(1)]);assert.equal((await state(ID(1))).overrides.includes('title_ru'),false);await merge(run,payload('1',{title_ru:'Source again'}));assert.equal((await job(ID(1))).title_ru,'Source again');
});
test('partial runs never remove unseen jobs and invalid completion evidence cannot finish a run',async()=>{
 const run=await begin(),saved=await merge(run);await finish(run,false,[],[],[],0);assert.equal((await job(saved.id)).source_status,'active');const next=await begin();for(const args of [[true,['1'],['1'],[],2],[true,['1'],[],[],2],[true,[null],[],[],1]])await assert.rejects(finish(next,...args),e=>e.code==='22023');assert.equal((await db.query('SELECT state FROM source_import_runs WHERE id=$1',[next.id])).rows[0].state,'running');
});
test('a source has only one live run and an expired worker cannot write or complete a replacement run',async()=>{
 const first=await begin();await assert.rejects(begin(),e=>e.code==='55P03');await db.query("UPDATE source_import_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[first.id]);const replacement=await begin();await assert.rejects(merge(first),e=>e.code==='40001');await assert.rejects(finish(first),e=>e.code==='40001');await assert.rejects(finish(first,false),e=>e.code==='40001');await merge(replacement);assert.equal((await db.query('SELECT state FROM source_import_runs WHERE id=$1',[first.id])).rows[0].state,'abandoned');
});
test('manual runs recheck current super-admin permissions and can release their own run after revocation without altering jobs',async()=>{
 await assert.rejects(begin('osonish',B),e=>e.code==='42501');const run=await begin('osonish',A),saved=await merge(run);await db.query('UPDATE admin_profiles SET disabled_at=clock_timestamp() WHERE id=$1',[A]);await assert.rejects(merge(run),e=>e.code==='42501');await assert.rejects(finish(run,true,[]),e=>e.code==='42501');await finish(run,false);assert.equal((await job(saved.id)).source_status,'active');assert.ok(await begin());
});
test('ownership, lifecycle and counter injections are rejected, and unrelated local collisions cannot be adopted',async()=>{
 const run=await begin();for(const patch of [{user_id:U},{status:'active'},{is_active:true},{views_count:999},{source:'local'},{source_id:''},{source_id:' 1'}])await assert.rejects(merge(run,payload('1',patch)),e=>e.code==='22023');await db.query("INSERT INTO jobs(source,source_id,is_imported) VALUES('osonish','1',false)");await assert.rejects(merge(run),e=>e.code==='40001');assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_import_state')).rows[0].n,0);
});
test('a closed account cannot receive content changes or be republished; failed merges roll back their pending marker',async()=>{
 const run=await begin(),saved=await merge(run);await db.query('UPDATE jobs SET user_id=$1 WHERE id=$2',[U,saved.id]);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);const prior=await state(saved.id);await assert.rejects(merge(run,payload('1',{company_name:'Forbidden'})),e=>e.code==='42501');assert.deepEqual(await state(saved.id),prior);assert.equal((await job(saved.id)).status,'archived');assert.equal((await job(saved.id)).is_active,false);
});
test('failed writes roll back baseline and pending state, and known optional fields absent from an older schema do not corrupt the record',async()=>{
 const run=await begin(),saved=await merge(run);const prior=await state(saved.id);await assert.rejects(merge(run,payload('1',{salary_min:'invalid'})),e=>e.code==='22P02');assert.deepEqual(await state(saved.id),prior);await merge(run,payload('1',{working_days:'5/2',company_name:'Updated'}));assert.equal((await job(saved.id)).company_name,'Updated');assert.equal((await state(saved.id)).pending,null);
});
test('browser roles cannot read state or leases; service-role writers cannot bypass private helpers or modify the journal directly',async()=>{
 for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{if(role!=='service_role')await assert.rejects(begin(),e=>e.code==='42501');await assert.rejects(db.exec('DELETE FROM source_import_runs'),e=>e.code==='42501');await assert.rejects(db.exec('UPDATE job_import_state SET overrides=ARRAY[]::text[]'),e=>e.code==='42501');await assert.rejects(db.query("SELECT ishdasiz_source_business('{}'::jsonb)"),e=>e.code==='42501');if(role!=='service_role')await assert.rejects(db.exec('SELECT lease_token FROM source_import_runs'),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
});
test('reapplying the migration preserves baselines, local edits, active leases and history while removing legacy column grants',async()=>{
 const run=await begin(),saved=await merge(run);await db.query("UPDATE jobs SET title_ru='Custom' WHERE id=$1",[saved.id]);const prior=await state(saved.id);await db.exec('GRANT SELECT(lease_token),UPDATE(state) ON source_import_runs TO anon,authenticated;GRANT SELECT(baseline),UPDATE(overrides) ON job_import_state TO anon,authenticated;');await db.exec(migration);assert.deepEqual(await state(saved.id),prior);assert.equal((await db.query('SELECT lease_token::text AS token FROM source_import_runs WHERE id=$1',[run.id])).rows[0].token,run.token);await assert.rejects(begin(),e=>e.code==='55P03');await db.exec('SET ROLE anon');try{await assert.rejects(db.exec('SELECT lease_token FROM source_import_runs'),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
});

const visible=async(role='anon')=>{await db.exec('SET ROLE '+role);try{return(await db.query('SELECT id FROM jobs ORDER BY id')).rows.map(row=>row.id);}finally{await db.exec('RESET ROLE');}};
const publicCounts=async(region=null,district=null)=>(await db.query('SELECT ishdasiz_public_job_counts($1,$2) AS r',[region,district])).rows[0].r;
test('public policies reject unavailable local and source states even with a permissive legacy policy, while owners retain their own drafts',async()=>{
 const run=await begin();const available=await merge(run);
 const states=['filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed'];
 for(const [i,status]of states.entries()){const saved=await merge(run,payload(String(i+2)));await db.query('UPDATE jobs SET source_status=$1 WHERE id=$2',[status,saved.id]);}
 for(const [i,status]of ['draft','filled','archived','inactive','paused','closed'].entries())await db.query('INSERT INTO jobs(id,status,is_active) VALUES($1,$2,true)',[ID(i+20),status]);
 await db.query('INSERT INTO jobs(id,status,is_active,user_id) VALUES($1,\'draft\',false,$2)',[ID(90),U]);
 assert.deepEqual(await visible(),[available.id]);assert.deepEqual(await visible('authenticated'),[available.id]);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);assert.deepEqual((await visible('authenticated')).sort(),[available.id,ID(90)].sort());assert.deepEqual(await visible(),[available.id]);
 assert.equal((await publicCounts()).total,1);
});
test('public availability and counts exclude closed and missing owners using employer ownership before fallback user IDs',async()=>{
 const run=await begin(),available=await merge(run);await db.query('INSERT INTO employer_profiles(id,user_id) VALUES($1,$2)',[ID(80),U]);
 for(const [n,patch]of [[2,'user_id'],[3,'created_by'],[4,'employer_id'],[5,'employer_id']]){const saved=await merge(run,payload(String(n)));await db.query(`UPDATE jobs SET ${patch}=$1 WHERE id=$2`,[n===4?ID(80):n===5?ID(81):U,saved.id]);}
 await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);assert.deepEqual(await visible(),[available.id]);assert.equal((await publicCounts()).total,1);
});
test('aggregate counts cover more than a REST page, have matching location scopes and never disclose hidden rows',async()=>{
 await db.query(`INSERT INTO jobs(id,region_id,district_id,category_id) SELECT gen_random_uuid(),CASE WHEN n<=1205 THEN 1 ELSE 2 END,CASE WHEN n<=1100 THEN 100 ELSE 200 END,$1::uuid FROM generate_series(1,1305) n`,[ID(60)]);
 await db.query('INSERT INTO jobs(region_id,district_id,status,is_active,category_id) VALUES(1,100,\'draft\',true,$1)',[ID(60)]);
 await db.exec('SET ROLE anon');try{const all=await publicCounts();assert.equal(all.total,1305);assert.deepEqual(all.districts,{'100':1100,'200':205});assert.deepEqual(all.categories,{[ID(60)]:1305});assert.equal((await publicCounts(1)).total,1205);assert.equal((await publicCounts(1,200)).total,105);assert.equal((await publicCounts(2,100)).total,0);await assert.rejects(publicCounts(0),e=>e.code==='22023');}finally{await db.exec('RESET ROLE');}
});
test('source removal and reappearance change public visibility without changing local publication',async()=>{
 const run=await begin(),saved=await merge(run);assert.deepEqual(await visible(),[saved.id]);await finish(run,true,[]);assert.deepEqual(await visible(),[]);assert.equal((await publicCounts()).total,0);
 const next=await begin();await merge(next);await finish(next);assert.deepEqual(await visible(),[saved.id]);assert.equal((await job(saved.id)).status,'active');
 await db.exec(read('20261009090000_public_job_availability.sql'));assert.deepEqual(await visible(),[saved.id]);
});
test('source completion may update only availability for a closed owner, and restoring the account cannot resurrect a removed source',async()=>{
 const run=await begin(),saved=await merge(run);await db.query('UPDATE jobs SET user_id=$1 WHERE id=$2',[U,saved.id]);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);
 for(const sql of ["UPDATE jobs SET source_status='active' WHERE id=$1","UPDATE jobs SET last_seen_at=clock_timestamp() WHERE id=$1","UPDATE jobs SET company_name='Forbidden' WHERE id=$1","UPDATE jobs SET status='active',is_active=true WHERE id=$1"])await assert.rejects(db.query(sql,[saved.id]),e=>e.code==='42501');
 await finish(run,true,[]);assert.equal((await job(saved.id)).source_status,'removed_at_source');assert.equal((await job(saved.id)).status,'archived');assert.equal((await db.query('SELECT count(*)::integer AS n FROM source_import_visibility_pending')).rows[0].n,0);
 await db.query('SELECT ishdasiz_set_account_closed($1,1,false)',[U]);assert.equal((await job(saved.id)).status,'active');assert.deepEqual(await visible(),[]);assert.equal((await publicCounts()).total,0);
});
test('browser and service writers cannot forge the private source-visibility capability',async()=>{
 for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{await assert.rejects(db.exec('SELECT * FROM source_import_visibility_pending'),e=>e.code==='42501');await assert.rejects(db.exec('DELETE FROM source_import_visibility_pending'),e=>e.code==='42501');await assert.rejects(db.query('INSERT INTO source_import_visibility_pending(job_id,run_id,payload) VALUES($1,$2,$3)',[ID(1),ID(2),'{}']),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
});
const application=async(patch={})=>{const args={user:U,epoch:0,job:ID(200),resume:ID(201),phone:'+998901234567',message:'  Message  ',...patch};return(await db.query('SELECT ishdasiz_submit_application($1,$2,$3,$4,$5,$6) AS r',[args.user,args.epoch,args.job,args.resume,args.phone,args.message])).rows[0].r;};
async function applicationFixture(){await db.query('INSERT INTO job_seeker_profiles(id,user_id) VALUES($1,$2)',[ID(202),U]);await db.query("INSERT INTO resumes(id,user_id,status,full_name,phone) VALUES($1,$2,'active','Own name','+998901234567')",[ID(201),U]);await db.query('INSERT INTO jobs(id) VALUES($1)',[ID(200)]);}
test('application insertion requires an owned active resume, uses the applicant epoch and never strips identity on schema errors',async()=>{
 await applicationFixture();await db.exec('SET ROLE service_role');let result;try{result=await application();}finally{await db.exec('RESET ROLE');}assert.equal(result.status,'pending');assert.ok(result.created_at);assert.deepEqual(Object.keys(result).sort(),['created_at','id','status']);const row=(await db.query('SELECT * FROM job_applications')).rows[0];assert.equal(row.user_id,U);assert.equal(row.resume_id,ID(201));assert.equal(row.full_name,'Own name');assert.equal(row.message,'Message');await assert.rejects(application(),e=>e.code==='23505');assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,1);
});
test('missing, foreign and inactive resumes, invalid input and stale sessions cannot create applications',async()=>{
 await applicationFixture();for(const patch of [{resume:null},{resume:ID(999)},{phone:'998901234567'},{message:'x'.repeat(4001)},{epoch:1}])await assert.rejects(application(patch));await db.query("UPDATE resumes SET status='draft' WHERE id=$1",[ID(201)]);await assert.rejects(application(),e=>e.code==='P0002');await db.query("UPDATE resumes SET status='active',user_id=null WHERE id=$1",[ID(201)]);await assert.rejects(application(),e=>e.code==='P0002');assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,0);
});
test('application transactions reject drafts, imported vacancies and a newly unavailable source despite active flags',async()=>{
 await applicationFixture();for(const patch of ["status='draft'","status='active',source_status='removed_at_source'","source_status='active',is_imported=true","is_imported=false,source='osonish'"]){await db.query('UPDATE jobs SET '+patch+' WHERE id=$1',[ID(200)]);await assert.rejects(application(),e=>e.code==='P0002');}assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,0);
});
test('closing the applicant or assigned employer and applying to an own vacancy are rejected transactionally',async()=>{
 await applicationFixture();await db.query('UPDATE jobs SET user_id=$1 WHERE id=$2',[U,ID(200)]);await assert.rejects(application(),e=>e.code==='40001');await db.query('UPDATE jobs SET user_id=null WHERE id=$1',[ID(200)]);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);await assert.rejects(application(),e=>e.code==='42501');await db.query('SELECT ishdasiz_set_account_closed($1,1,false)',[U]);await assert.rejects(application(),e=>e.code==='42501');assert.equal((await application({epoch:2})).status,'pending');
 await db.query('INSERT INTO users(id,phone) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[B,'+998909999999']);await db.query('INSERT INTO employer_profiles(id,user_id) VALUES($1,$2)',[ID(204),B]);await db.query('INSERT INTO jobs(id,employer_id,created_by) VALUES($1,$2,$3)',[ID(203),ID(204),U]);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[B]);await assert.rejects(application({epoch:2,job:ID(203)}),e=>e.code==='P0002');
});
test('public roles cannot submit arbitrary account identities and repeating the migration preserves applications',async()=>{
 await applicationFixture();const result=await application();await db.exec(read('20261009091000_application_submission.sql'));assert.equal((await db.query('SELECT id FROM job_applications')).rows[0].id,result.id);for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(application(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
});

const claim=async(patch={})=>{const args={actor:null,id:null,request:null,start:false,max:500,...patch};return(await db.query('SELECT ishdasiz_claim_osonish_import($1,$2,$3,$4,$5) AS r',[args.actor,args.id,args.request,args.start,args.max])).rows[0].r;};
const workerRun=claimed=>({id:claimed.progress.id,token:claimed.token});
const yieldRun=async(run,error=null,fatal=false)=>(await db.query('SELECT ishdasiz_yield_osonish_import($1,$2,$3,$4) AS r',[run.id,run.token,error,fatal])).rows[0].r;
const page=async(run,index,ids,total,last=1,verify=false)=>(await db.query('SELECT ishdasiz_osonish_page($1,$2,$3,$4,$5,$6,$7) AS r',[run.id,run.token,index,ids,total,last,verify])).rows[0].r;
const item=async(run,id,state='filled',body=null)=>(await db.query('SELECT ishdasiz_osonish_item($1,$2,$3,$4,$5::jsonb) AS r',[run.id,run.token,id,state,body===null?null:JSON.stringify(body)])).rows[0].r;
test('durable worker claims one run, yields it between requests and resumes the same checkpoint with a fenced new token',async()=>{
 const first=await claim(),run=workerRun(first);assert.ok(run.token);assert.equal(first.progress.phase,'list');const busy=await claim();assert.equal(busy.token,null);assert.equal(busy.progress.id,run.id);await page(run,1,['1'],2,2);await yieldRun(run);const next=await claim();assert.equal(next.progress.next_page,2);assert.equal(next.progress.id,run.id);assert.notEqual(next.token,run.token);await assert.rejects(page(run,2,['2'],2,2),e=>e.code==='40001');await assert.rejects(yieldRun(run),e=>e.code==='40001');assert.equal((await page(workerRun(next),2,['2'],2,2)).phase,'details');
});
test('manual start retries use one request and current super rights, and a revoked creator cannot be resumed by cron',async()=>{
 await assert.rejects(claim({actor:B,start:true,request:ID(500)}),e=>e.code==='42501');const first=await claim({actor:A,start:true,request:ID(500)}),run=workerRun(first);assert.equal((await claim({actor:A,start:true,request:ID(500)})).token,null);await yieldRun(run);await assert.rejects(claim({actor:A,start:true,request:ID(500),max:20}),e=>e.code==='40001');await db.query('UPDATE admin_profiles SET disabled_at=clock_timestamp() WHERE id=$1',[A]);const stopped=await claim();assert.equal(stopped.progress.state,'failed');assert.equal(stopped.progress.last_error,'permission_changed');assert.equal(stopped.token,null);
});
test('an empty source must pass a second enumeration before any absence cleanup; cron waits six hours after the cycle',async()=>{
 const old=await begin(),saved=await merge(old);await finish(old,false);const claimed=await claim(),run=workerRun(claimed);assert.equal((await page(run,1,[],0)).phase,'verify');assert.equal((await job(saved.id)).source_status,'active');await yieldRun(run);const resumed=workerRun(await claim());assert.equal((await page(resumed,1,[],0,1,true)).state,'completed');assert.equal((await job(saved.id)).source_status,'removed_at_source');const idle=await claim();assert.equal(idle.token,null);assert.equal(idle.progress.id,run.id);
});
test('source membership changes, duplicates, metadata drift and page limits cannot authorize completion',async()=>{
 const run=workerRun(await claim({start:true,request:ID(500),max:2}));await assert.rejects(page(run,1,['1'],1,3),e=>e.code==='22023');await page(run,1,['1'],2,2);await assert.rejects(page(run,2,['1'],2,2),e=>e.code==='22023');await assert.rejects(page(run,2,['2'],3,2),e=>e.code==='22023');await page(run,2,['2'],2,2);await item(run,'1');await item(run,'2');await assert.rejects(page(run,1,['3'],2,2,true),e=>e.code==='22023');await page(run,1,['2'],2,2,true);await assert.rejects(page(run,2,['2'],2,2,true),e=>e.code==='22023');assert.equal((await yieldRun(run,'snapshot_changed',true)).state,'failed');
});
test('item writes and progress commit together, and repeated confirmed details cannot duplicate job merges or counters',async()=>{
 const run=workerRun(await claim());await page(run,1,['1','2'],2);await assert.rejects(item(run,'1','active',payload('2')),e=>e.code==='22023');await assert.rejects(item(run,'1','active',payload('1',{salary_min:'bad'})),e=>e.code==='22P02');assert.equal((await db.query("SELECT state FROM source_import_items WHERE run_id=$1 AND source_id='1'",[run.id])).rows[0].state,'pending');const saved=await item(run,'1','active',payload());assert.equal(saved.new_imported,1);await assert.rejects(item(run,'1','active',payload()),e=>e.code==='40001');await item(run,'2','removed');assert.equal((await page(run,1,['1','2'],2,1,true)).state,'completed');assert.equal((await db.query('SELECT count(*)::integer AS n FROM jobs')).rows[0].n,1);
});
test('detail retries persist across process restarts, have a delay and cannot remove unseen jobs after three failures',async()=>{
 const old=await begin(),saved=await merge(old,payload('99'));await finish(old,false);const run=workerRun(await claim());await page(run,1,['1'],1);await item(run,'1','retry');await assert.rejects(item(run,'1','retry'),e=>e.code==='40001');await yieldRun(run);let resumed=workerRun(await claim());await db.query('UPDATE source_import_items SET available_at=clock_timestamp() WHERE run_id=$1',[run.id]);await item(resumed,'1','retry');await yieldRun(resumed);resumed=workerRun(await claim());await db.query('UPDATE source_import_items SET available_at=clock_timestamp() WHERE run_id=$1',[run.id]);const failed=await item(resumed,'1','retry');assert.equal(failed.state,'failed');assert.equal(failed.failed,1);assert.equal((await job(saved.id)).source_status,'active');
});
test('long source lists are accumulated beyond 1000 rows and verified by exact membership without changing local publication',async()=>{
 const run=workerRun(await claim());const ids=Array.from({length:1205},(_,n)=>String(n+1));for(let n=0;n<13;n++)await page(run,n+1,ids.slice(n*100,n*100+100),1205,13);
 const work=(await db.query('SELECT ishdasiz_osonish_work($1,$2) AS r',[run.id,run.token])).rows[0].r;assert.equal(work.ids.length,50);assert.equal(work.progress.listed,1205);
 for(const id of ids)await item(run,id);for(let n=0;n<13;n++)await page(run,n+1,ids.slice(n*100,n*100+100),1205,13,true);assert.equal((await db.query('SELECT ishdasiz_import_summary($1) AS r',[run.id])).rows[0].r.verified,1205);
});
test('a crashed or expired worker is resumable but cannot write with its old lease; stale snapshots expire without cleanup',async()=>{
 const first=workerRun(await claim());await page(first,1,['1'],1);await db.query("UPDATE source_import_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[first.id]);const resumed=workerRun(await claim());assert.equal(resumed.id,first.id);await assert.rejects(item(first,'1'),e=>e.code==='40001');await yieldRun(resumed);await db.query("UPDATE source_import_runs SET started_at=clock_timestamp()-interval '25 hours' WHERE id=$1",[first.id]);const expired=await claim();assert.equal(expired.progress.state,'failed');assert.equal(expired.progress.last_error,'snapshot_expired');
});
test('private queue state, tokens and helpers remain inaccessible to browser roles and repeated migration preserves progress',async()=>{
 const run=workerRun(await claim());await page(run,1,['1'],2,2);await db.exec(read('20261009100000_osonish_import_worker.sql'));await yieldRun(run);assert.equal((await claim()).progress.next_page,2);
 for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{for(const sql of ['SELECT * FROM source_import_items','UPDATE source_import_checkpoints SET phase=\'done\'','SELECT ishdasiz_import_summary(null)'])await assert.rejects(db.exec(sql),e=>e.code==='42501');if(role!=='service_role')await assert.rejects(claim(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
});


test('closed owners are skipped without content or lifecycle writes, while the completed source proof still updates private availability',async()=>{
 const original=await begin(),saved=await merge(original);await finish(original,false);await db.query('UPDATE jobs SET user_id=$1 WHERE id=$2',[U,saved.id]);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);
 const before=await job(saved.id),run=workerRun(await claim());await page(run,1,['1'],1);const result=await item(run,'1','active',payload('1',{title_ru:'Must not change',salary_min:9999}));assert.equal(result.skipped_closed,1);assert.equal(result.updated,0);let row=await job(saved.id);assert.equal(row.title_ru,before.title_ru);assert.equal(row.salary_min,before.salary_min);assert.equal(row.status,before.status);assert.equal(row.is_active,before.is_active);
 assert.equal((await page(run,1,['1'],1,1,true)).state,'completed');row=await job(saved.id);assert.equal(row.source_status,'active');assert.equal(row.title_ru,before.title_ru);assert.equal(row.is_active,false);assert.equal((await db.query('SELECT ishdasiz_job_available(jobs) AS visible FROM jobs WHERE id=$1',[saved.id])).rows[0].visible,false);
});
test('an unrelated manual request cannot attach itself to a running cycle or change its request identity',async()=>{
 const first=workerRun(await claim({actor:A,start:true,request:ID(500)}));await yieldRun(first);await assert.rejects(claim({actor:A,start:true,request:ID(501)}),e=>e.code==='55P03');assert.equal((await db.query('SELECT count(*)::integer AS n FROM source_import_runs')).rows[0].n,1);assert.equal((await claim({actor:A,start:true,request:ID(500)})).progress.id,first.id);
});
test('three consecutive source errors stop safely, while confirmed item writes reset the error streak',async()=>{
 let run=workerRun(await claim());await page(run,1,['1','2'],2);await yieldRun(run,'write_failed');run=workerRun(await claim());await item(run,'1');await yieldRun(run,'write_failed');run=workerRun(await claim());assert.equal((await yieldRun(run,'source_unavailable')).state,'running');run=workerRun(await claim());assert.equal((await yieldRun(run,'source_unavailable')).state,'failed');
});


const publicStatistics=async()=>(await db.query('SELECT ishdasiz_public_statistics() AS r')).rows[0].r;

const refreshClaim=async(patch={})=>{
 await db.exec(read('20261012130000_osonish_candidate_refresh.sql'));
 await db.exec(read('20261012143000_osonish_queue_retention.sql'));
 const args={actor:null,id:null,request:null,start:false,max:500,...patch};
 return(await db.query('SELECT ishdasiz_claim_osonish_refresh($1,$2,$3,$4,$5) r',[args.actor,args.id,args.request,args.start,args.max])).rows[0].r;
};
const candidates=async(run,index,ids,total,last=1)=>(await db.query('SELECT ishdasiz_osonish_candidates($1,$2,$3,$4,$5,$6) r',[run.id,run.token,index,ids,total,last])).rows[0].r;
const refreshItem=async(run,id,state='filled',body=null)=>(await db.query('SELECT ishdasiz_osonish_refresh_item($1,$2,$3,$4,$5::jsonb) r',[run.id,run.token,id,state,body===null?null:JSON.stringify(body)])).rows[0].r;
const finishRefresh=async(run)=>(await db.query('SELECT ishdasiz_finish_osonish_refresh($1,$2) r',[run.id,run.token])).rows[0].r;

test('changing candidate totals and overlapping pages refresh each ID once without absence cleanup',async()=>{
 const run=workerRun(await refreshClaim());
 let p=await candidates(run,1,['1','2'],4,2);assert.equal(p.total,null);assert.equal(p.listed,2);
 p=await candidates(run,2,['2','3'],3,2);assert.equal(p.total,3);assert.equal(p.listed,3);assert.equal(p.phase,'details');
 await assert.rejects(finishRefresh(run),e=>e.code==='40001');
 for(const id of ['1','2','3'])await refreshItem(run,id,'active',payload(id));
 assert.equal((await finishRefresh(run)).state,'completed');
 assert.equal((await db.query('SELECT counters FROM source_import_runs WHERE id=$1',[run.id])).rows[0].counters.absence_cleanup,false);
 assert.equal((await db.query('SELECT count(*)::int n FROM jobs')).rows[0].n,3);
});

test('empty public list queues known imports, explicit filled/404 outcomes hide only checked jobs and preserve drafts',async()=>{
 await db.exec("INSERT INTO jobs(source,source_id,is_imported,status,is_active) VALUES('osonish','1',true,'draft',false),('osonish','2',true,'active',true),('osonish','3',false,'active',true),('osonish','invalid',true,'active',true),('local','4',false,'active',true)");
 const run=workerRun(await refreshClaim());const p=await candidates(run,1,[],0);assert.equal(p.total,2);assert.equal(p.phase,'details');
 await refreshItem(run,'1','filled');await refreshItem(run,'2','removed');await finishRefresh(run);
 const rows=(await db.query('SELECT source_id,source_status,status,is_active FROM jobs ORDER BY source_id')).rows;
 assert.equal(rows[0].source_status,'filled');assert.equal(rows[0].status,'draft');assert.equal(rows[0].is_active,false);
 assert.equal(rows[1].source_status,'removed_at_source');for(const row of rows.slice(2))assert.equal(row.source_status,'active');
});

test('shrinking pagination can end beyond its new last page and truly empty refresh completes without source cleanup',async()=>{
 let run=workerRun(await refreshClaim());await candidates(run,1,['1'],2,2);await candidates(run,2,[],0,1);await refreshItem(run,'1','removed');await finishRefresh(run);
 run=workerRun(await refreshClaim({start:true,request:ID(500)}));assert.equal((await candidates(run,1,[],0)).phase,'verify');assert.equal((await finishRefresh(run)).state,'completed');
});

test('candidate refresh retains v1 checkpoints and fences stale tokens, replayed items and malformed pages',async()=>{
 const old=workerRun(await claim());await page(old,1,['1'],2,2);await yieldRun(old);
 const continued=await refreshClaim({id:old.id});assert.equal((await db.query('SELECT protocol_version v FROM source_import_checkpoints WHERE run_id=$1',[old.id])).rows[0].v,1);
 await assert.rejects(candidates(workerRun(continued),2,['2'],2,2),e=>e.code==='40001');await page(workerRun(continued),2,['2'],2,2);await yieldRun(workerRun(continued),'snapshot_changed',true);
 let run=workerRun(await refreshClaim({start:true,request:ID(500),max:2}));
 for(const args of [[1,['1','1'],2,1],[1,['0'],1,1],[1,['9007199254740992'],1,1],[1,['1'],1,3],[1,[],2,2],[2,['1'],1,1]])await assert.rejects(candidates(run,...args),e=>['22023','40001'].includes(e.code));
 await candidates(run,1,['1'],1);await yieldRun(run);const resumed=workerRun(await refreshClaim({id:run.id}));
 await assert.rejects(refreshItem(run,'1'),e=>e.code==='40001');await refreshItem(resumed,'1','active',payload());
 await assert.rejects(refreshItem(resumed,'1','active',payload()),e=>e.code==='40001');await finishRefresh(resumed);await assert.rejects(finishRefresh(resumed),e=>e.code==='40001');
});

test('candidate refresh protects closed owners, manual content/publication and late arrivals while updating explicit availability',async()=>{
 const original=await begin(),saved=await merge(original);await finish(original,false);
 await db.query("UPDATE jobs SET user_id=$1,title_ru='Human edit' WHERE id=$2",[U,saved.id]);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);
 const before=await job(saved.id),run=workerRun(await refreshClaim());await candidates(run,1,[],0);
 await db.exec("INSERT INTO jobs(source,source_id,is_imported) VALUES('osonish','99',true)");
 const p=await refreshItem(run,'1','active',payload('1',{title_ru:'Source overwrite'}));assert.equal(p.skipped_closed,1);await finishRefresh(run);
 const row=await job(saved.id);assert.equal(row.title_ru,'Human edit');assert.equal(row.status,before.status);assert.equal(row.is_active,false);assert.equal(row.source_status,'active');
 assert.equal((await db.query("SELECT source_status FROM jobs WHERE source_id='99'")).rows[0].source_status,'active');
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_visibility_pending')).rows[0].n,0);
});

test('candidate retry is not disappearance, and missing details leave known availability unchanged on failure',async()=>{
 await db.exec("INSERT INTO jobs(source,source_id,is_imported) VALUES('osonish','1',true)");
 const run=workerRun(await refreshClaim());await candidates(run,1,[],0);
 for(let n=0;n<3;n++){await db.query('UPDATE source_import_items SET available_at=clock_timestamp() WHERE run_id=$1',[run.id]);await refreshItem(run,'1','retry');}
 assert.equal((await db.query("SELECT source_status FROM jobs WHERE source_id='1'")).rows[0].source_status,'active');
 assert.equal((await db.query('SELECT state FROM source_import_runs WHERE id=$1',[run.id])).rows[0].state,'running');
 assert.equal((await finishRefresh(run)).state,'failed');
});

test('one unavailable candidate does not block checking later cards and final status reports the partial failure',async()=>{
 const run=workerRun(await refreshClaim());await candidates(run,1,['1','2'],2);
 for(let n=0;n<3;n++){await db.query('UPDATE source_import_items SET available_at=clock_timestamp() WHERE run_id=$1',[run.id]);await refreshItem(run,'1','retry');}
 assert.equal((await refreshItem(run,'2','active',payload('2'))).phase,'verify');
 const result=await finishRefresh(run);assert.equal(result.state,'failed');assert.equal(result.processed,1);assert.equal(result.failed,1);assert.equal(result.last_error,'detail_unavailable');
});

test('candidate refresh private RPC grants and idempotent schema preserve runs and jobs',async()=>{
 const run=workerRun(await refreshClaim());await candidates(run,1,['1'],1);await refreshClaim({id:run.id});
 assert.equal((await db.query('SELECT protocol_version v FROM source_import_checkpoints WHERE run_id=$1',[run.id])).rows[0].v,2);
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{
  for(const name of ['ishdasiz_claim_osonish_refresh','ishdasiz_osonish_candidates','ishdasiz_osonish_refresh_item','ishdasiz_finish_osonish_refresh'])assert.equal((await db.query("SELECT bool_or(has_function_privilege(current_user,oid,'EXECUTE')) allowed FROM pg_proc WHERE proname=$1",[name])).rows[0].allowed,false);
 }finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{await refreshItem(run,'1','active',payload());await finishRefresh(run);}finally{await db.exec('RESET ROLE');}
});

test('old terminal queues archive exact progress and preserve jobs, run history and request idempotence',async()=>{
 const request=ID(800),old=workerRun(await refreshClaim({start:true,request}));await candidates(old,1,['1','2'],2);
 await refreshItem(old,'1','active',payload());await refreshItem(old,'2','removed');await finishRefresh(old);
 await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days' WHERE id=$1",[old.id]);
 const before=(await db.query('SELECT ishdasiz_import_summary($1) r',[old.id])).rows[0].r;
 const jobs=(await db.query('SELECT * FROM jobs')).rows;
 const current=workerRun(await refreshClaim({start:true,request:ID(801)}));
 assert.deepEqual((await db.query('SELECT ishdasiz_import_summary($1) r',[old.id])).rows[0].r,before);
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_items WHERE run_id=$1',[old.id])).rows[0].n,0);
 assert.deepEqual((await db.query('SELECT * FROM jobs')).rows,jobs);
 assert.equal((await db.query('SELECT request_id FROM source_import_checkpoints WHERE run_id=$1',[old.id])).rows[0].request_id,request);
 const replay=await refreshClaim({start:true,request});assert.equal(replay.token,null);assert.deepEqual(replay.progress,before);
 await yieldRun(current);assert.equal((await refreshClaim({id:current.id})).progress.id,current.id);
});

test('archival touches one eligible terminal queue per claim, never recent, v1 or running queues',async()=>{
 const old=[];
 for(let n=0;n<2;n++){const run=workerRun(await refreshClaim({start:true,request:ID(810+n)}));await candidates(run,1,[String(n+1)],1);await refreshItem(run,String(n+1),'removed');await finishRefresh(run);old.push(run.id);}
 const recent=workerRun(await refreshClaim({start:true,request:ID(812)}));await candidates(recent,1,['3'],1);await refreshItem(recent,'3','removed');await finishRefresh(recent);
 const legacy=workerRun(await claim({start:true,request:ID(814)}));await page(legacy,1,['30'],1);await item(legacy,'30','removed');await page(legacy,1,['30'],1,1,true);
 await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days' WHERE id=$1",[legacy.id]);
 await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days' WHERE id=ANY($1::uuid[])",[old]);
 const current=workerRun(await refreshClaim({start:true,request:ID(813)}));
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_checkpoints WHERE archived_progress IS NOT NULL')).rows[0].n,1);
 await candidates(current,1,['4'],1);await yieldRun(current);
 await refreshClaim({id:current.id});
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_checkpoints WHERE archived_progress IS NOT NULL')).rows[0].n,2);
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_items WHERE run_id=ANY($1::uuid[])',[[recent.id,current.id,legacy.id]])).rows[0].n,3);
});

test('archival preserves abandoned summaries and pending retries for diagnosis',async()=>{
 const run=workerRun(await refreshClaim());await candidates(run,1,['1','2'],2);await refreshItem(run,'1','removed');await yieldRun(run,'source_unavailable',true);
 await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days',state='abandoned' WHERE id=$1",[run.id]);
 const before=(await db.query('SELECT ishdasiz_import_summary($1) r',[run.id])).rows[0].r;
 await refreshClaim({start:true,request:ID(820)});
 assert.deepEqual((await db.query('SELECT ishdasiz_import_summary($1) r',[run.id])).rows[0].r,before);
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_items WHERE run_id=$1',[run.id])).rows[0].n,0);
});

test('failed queues retain their exact failed and verified counts after archival',async()=>{
 const run=workerRun(await refreshClaim());await candidates(run,1,['1','2'],2);await refreshItem(run,'1','removed');
 for(let n=0;n<3;n++){await db.query('UPDATE source_import_items SET available_at=clock_timestamp() WHERE run_id=$1',[run.id]);await refreshItem(run,'2','retry');}
 await finishRefresh(run);await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days' WHERE id=$1",[run.id]);
 const before=(await db.query('SELECT ishdasiz_import_summary($1) r',[run.id])).rows[0].r;
 await refreshClaim({start:true,request:ID(821)});
 const after=(await db.query('SELECT ishdasiz_import_summary($1) r',[run.id])).rows[0].r;assert.deepEqual(after,before);assert.equal(after.failed,1);assert.equal(after.verified,1);
});

test('known active and unchecked imports refresh daily; recently confirmed unavailable IDs wait a week unless listed again',async()=>{
 await db.exec("INSERT INTO jobs(source,source_id,is_imported,source_status,last_checked_at) VALUES('osonish','1',true,'active',clock_timestamp()),('osonish','2',true,'filled',clock_timestamp()),('osonish','3',true,'removed_at_source',clock_timestamp()),('osonish','4',true,'filled',clock_timestamp()-interval '8 days'),('osonish','5',true,'removed_at_source',null),('osonish','6',true,'unknown',clock_timestamp()),('osonish','7',false,'active',null),('local','8',false,'active',null),('osonish','9',true,null,clock_timestamp())");
 const run=workerRun(await refreshClaim());await candidates(run,1,['2'],1);
 const ids=(await db.query('SELECT source_id FROM source_import_items WHERE run_id=$1 ORDER BY source_id',[run.id])).rows.map(r=>r.source_id);
 assert.deepEqual(ids,['1','2','4','5','6','9']);
 await refreshItem(run,'2','active',payload('2'));assert.equal((await db.query("SELECT source_status FROM jobs WHERE source_id='2'")).rows[0].source_status,'active');
 assert.equal((await db.query("SELECT source_status FROM jobs WHERE source_id='3'")).rows[0].source_status,'removed_at_source');
});

test('archival helper and cached summaries remain private and invalid/busy claims cannot prune',async()=>{
 const old=workerRun(await refreshClaim({start:true,request:ID(831)}));await candidates(old,1,['9'],1);await refreshItem(old,'9','removed');await finishRefresh(old);
 const run=workerRun(await refreshClaim({start:true,request:ID(832)}));await candidates(run,1,['1'],1);
 await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days' WHERE id=$1",[old.id]);
 for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{
  await assert.rejects(db.query('SELECT ishdasiz_archive_osonish_queue()'),e=>e.code==='42501');
  await assert.rejects(db.query('SELECT archived_progress FROM source_import_checkpoints'),e=>e.code==='42501');
 }finally{await db.exec('RESET ROLE');}}
 assert.equal((await refreshClaim({id:run.id})).token,null);
 await assert.rejects(refreshClaim({actor:B,start:true,request:ID(830)}),e=>e.code==='42501');
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_items WHERE run_id=$1',[run.id])).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM source_import_items WHERE run_id=$1',[old.id])).rows[0].n,1);
});

test('a queue cleanup failure rolls back both its cached summary and the new claim',async()=>{
 const old=workerRun(await refreshClaim());await candidates(old,1,['1'],1);await refreshItem(old,'1','removed');await finishRefresh(old);
 await db.query("UPDATE source_import_runs SET completed_at=clock_timestamp()-interval '8 days' WHERE id=$1",[old.id]);
 await db.exec("CREATE FUNCTION test_archive_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic cleanup failure';END $$;CREATE TRIGGER test_archive_failure BEFORE DELETE ON source_import_items FOR EACH ROW EXECUTE FUNCTION test_archive_failure();");
 try{
  await assert.rejects(refreshClaim({start:true,request:ID(840)}),e=>e.code==='P0001');
  assert.equal((await db.query('SELECT archived_progress FROM source_import_checkpoints WHERE run_id=$1',[old.id])).rows[0].archived_progress,null);
  assert.equal((await db.query('SELECT count(*)::int n FROM source_import_items WHERE run_id=$1',[old.id])).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int n FROM source_import_runs')).rows[0].n,1);
 }finally{await db.exec('DROP TRIGGER test_archive_failure ON source_import_items;DROP FUNCTION test_archive_failure();');}
});

test('optimized public visibility preserves every source/publication/owner combination and aggregate permissions',async()=>{
 await db.query('INSERT INTO users(id,password_hash,phone,closed_at) VALUES($1,$2,$3,null),($4,$2,$5,now()) ON CONFLICT(id) DO UPDATE SET closed_at=excluded.closed_at',[A,'synthetic','+998901111111',B,'+998902222222']);
 // Reconstruct legacy orphan/closed-owner rows; current write guards reject them.
 await db.exec(`ALTER TABLE employer_profiles DISABLE TRIGGER ishdasiz_guard_closed_account;
 ALTER TABLE jobs DISABLE TRIGGER ishdasiz_guard_closed_account;
 INSERT INTO employer_profiles(id,user_id) VALUES('${ID(9001)}','${A}'),('${ID(9002)}','${B}'),('${ID(9003)}',null),('${ID(9004)}','${ID(9999)}');
 INSERT INTO jobs(id,source_status,status,is_active,employer_id,user_id,created_by,description_uz,raw_source_json)
 SELECT gen_random_uuid(),s,p,true,o.employer,o.owner,o.creator,repeat('synthetic ',1000),jsonb_build_object('body',repeat('synthetic ',1000))
 FROM unnest(ARRAY[null,'active','filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed','unknown']) s
 CROSS JOIN unnest(ARRAY[null,'active','published','open','draft','archived']) p
 CROSS JOIN (VALUES(null::uuid,null::uuid,null::uuid),(null,'${A}','${B}'),(null,'${B}','${A}'),(null,null,'${A}'),(null,null,'${B}'),(null,'${ID(9999)}',null),('${ID(9001)}','${B}',null),('${ID(9002)}','${A}',null),('${ID(9003)}','${A}',null),('${ID(9004)}','${A}',null),('${ID(9005)}','${A}',null)) o(employer,owner,creator);
 ALTER TABLE employer_profiles ENABLE TRIGGER ishdasiz_guard_closed_account;
 ALTER TABLE jobs ENABLE TRIGGER ishdasiz_guard_closed_account;
 CREATE TEMP TABLE prior_visibility AS SELECT id,ishdasiz_job_available(j) visible,
  ishdasiz_job_owner(employer_id,user_id,created_by) owner,
  ishdasiz_account_open(ishdasiz_job_owner(employer_id,user_id,created_by)) account_open FROM jobs j;`);
 const oldStats=await publicStatistics();delete oldStats.asOf;const oldCounts=await publicCounts();
 await db.exec(read('20261012093000_public_query_performance.sql'));await db.exec(read('20261012094500_public_visibility_fast_path.sql'));await db.exec(read('20261012101500_inline_public_visibility.sql'));await db.exec(read('20261012103000_public_catalog_count_index.sql'));   
 assert.equal((await db.query('SELECT count(*)::integer n FROM jobs j JOIN prior_visibility b USING(id) WHERE b.visible IS DISTINCT FROM ishdasiz_job_available(j)')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::integer n FROM jobs j JOIN prior_visibility b USING(id) WHERE b.owner IS DISTINCT FROM ishdasiz_job_owner(employer_id,user_id,created_by) OR b.account_open IS DISTINCT FROM ishdasiz_account_open(ishdasiz_job_owner(employer_id,user_id,created_by))')).rows[0].n,0);
 for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{
  const stats=await publicStatistics();delete stats.asOf;assert.deepEqual(stats,oldStats);assert.deepEqual(await publicCounts(),oldCounts);
 }finally{await db.exec('RESET ROLE');}}
 await db.exec(read('20261012093000_public_query_performance.sql'));await db.exec(read('20261012094500_public_visibility_fast_path.sql'));await db.exec(read('20261012101500_inline_public_visibility.sql'));await db.exec(read('20261012103000_public_catalog_count_index.sql'));   assert.deepEqual(await publicCounts(),oldCounts);
 assert.equal((await db.query('SELECT count(*)::integer n FROM jobs')).rows[0].n,726);
 await db.exec('DROP TABLE prior_visibility');
});
test('public statistics count every visible vacancy beyond a REST page and aggregate private applications without returning rows',async()=>{
 await db.exec("INSERT INTO jobs(id,views_count,region_id,district_id,category_id,employment_type) SELECT ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,2,22,100,'20000000-0000-4000-8000-000000000001','full_time' FROM generate_series(1,1205) n");await db.query('INSERT INTO job_applications(job_id,status,user_id,full_name,phone,message) VALUES($1,$2,$3,$4,$5,$6)',[ID(1),'pending',U,'Private candidate','private phone','private message']);
 await db.exec('SET ROLE anon');let result;try{result=await publicStatistics();await assert.rejects(db.query('SELECT * FROM job_applications'),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
 assert.equal(result.availableJobs,1205);assert.equal(result.views,2410);assert.equal(result.applications,1);assert.equal(result.regionCount,1);assert.equal(result.byRegion[0].count,1205);assert.equal(result.byCategory[0].count,1205);assert.equal(result.byDistrict[0].count,1205);assert.equal(result.byEmployment[0].count,1205);assert.ok(Date.parse(result.asOf));assert.equal(JSON.stringify(result).includes('private'),false);assert.deepEqual(Object.keys(result).sort(),['applications','asOf','availableJobs','byCategory','byDistrict','byEmployment','byRegion','regionCount','views'].sort());
});
test('public statistics exclude local drafts, archives, filled and unavailable source vacancies even for an authenticated owner',async()=>{
 for(let n=0;n<9;n++)await db.query('INSERT INTO jobs(id,user_id,views_count) VALUES($1,$2,99)',[ID(n+1),U]);await db.exec("UPDATE jobs SET status='draft' WHERE id='"+ID(2)+"';UPDATE jobs SET status='archived' WHERE id='"+ID(3)+"';UPDATE jobs SET status='filled' WHERE id='"+ID(4)+"';UPDATE jobs SET source_status='removed_at_source' WHERE id='"+ID(5)+"';UPDATE jobs SET source_status='paused' WHERE id='"+ID(6)+"';UPDATE jobs SET is_active=false WHERE id='"+ID(7)+"';UPDATE jobs SET source_status='closed' WHERE id='"+ID(8)+"';UPDATE jobs SET source_status='filled' WHERE id='"+ID(9)+"'");for(let n=1;n<=9;n++)await db.query('INSERT INTO job_applications(job_id,status) VALUES($1,$2)',[ID(n),'pending']);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[U]);await db.exec('SET ROLE authenticated');let result;try{result=await publicStatistics();}finally{await db.exec('RESET ROLE');}assert.equal(result.availableJobs,1);assert.equal(result.views,99);assert.equal(result.applications,1);
});
test('public statistics retain uncategorized, unassigned and unknown employment counts instead of dropping them',async()=>{
 await db.query("INSERT INTO jobs(id,views_count,employment_type) VALUES($1,-10,'legacy'),($2,null,null),($3,0,'remote')",[ID(1),ID(2),ID(3)]);const result=await publicStatistics();assert.equal(result.availableJobs,3);assert.equal(result.regionCount,0);assert.equal(result.views,0);assert.deepEqual(result.byRegion,[{id:null,name_uz:null,name_ru:null,count:3}]);assert.deepEqual(result.byEmployment,[{type:null,count:2},{type:'remote',count:1}]);for(const key of ['byRegion','byDistrict','byCategory','byEmployment'])assert.equal(result[key].reduce((sum,row)=>sum+row.count,0),3);
});
test('statistics preserve the actual city/province and district parent names in both languages',async()=>{
 await db.exec("INSERT INTO regions VALUES(1,'Toshkent viloyati','Ташкентская область'),(22,'Toshkent shahri','Город Ташкент');INSERT INTO districts VALUES(100,'Olmazor tumani','Олмазорский район',22),(101,'Olmazor tumani','Олмазорский район',1);INSERT INTO categories VALUES('20000000-0000-4000-8000-000000000001','IT','ИТ')");await db.query('INSERT INTO jobs(id,region_id,district_id,category_id) VALUES($1,22,100,$3),($2,1,101,$3)',[ID(1),ID(2),'20000000-0000-4000-8000-000000000001']);const result=await publicStatistics();assert.equal(result.regionCount,2);assert.equal(result.byCategory[0].name_ru,'ИТ');assert.equal(result.byDistrict.find(row=>row.id===100).region_ru,'Город Ташкент');assert.equal(result.byDistrict.find(row=>row.id===101).region_uz,'Toshkent viloyati');
});
test('closed and missing assigned owners and closed applicants contribute no public activity',async()=>{
 await db.query('INSERT INTO users(id,phone) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[B,'+998909999999']);await db.query('INSERT INTO employer_profiles(id,user_id) VALUES($1,$2)',[ID(100),B]);await db.query('INSERT INTO jobs(id,employer_id,user_id) VALUES($1,$3,$4),($2,null,null)',[ID(1),ID(2),ID(100),U]);await db.query('INSERT INTO job_applications(job_id,user_id,status) VALUES($1,$3,$4),($2,$3,$4)',[ID(1),ID(2),U,'pending']);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[B]);let result=await publicStatistics();assert.equal(result.availableJobs,1);assert.equal(result.applications,1);await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);result=await publicStatistics();assert.equal(result.applications,0);await db.query('INSERT INTO jobs(id,employer_id,user_id) VALUES($1,$2,$3)',[ID(3),ID(999),null]);assert.equal((await publicStatistics()).availableJobs,1);
});
test('empty public statistics are explicit and repeating the migration preserves jobs, applications and aggregate-only permissions',async()=>{
 const empty=await publicStatistics();assert.equal(empty.availableJobs,0);assert.equal(empty.views,0);assert.equal(empty.applications,0);assert.deepEqual(empty.byRegion,[]);await db.query('INSERT INTO jobs(id,views_count) VALUES($1,11)',[ID(1)]);await db.query('INSERT INTO job_applications(job_id,status) VALUES($1,$2)',[ID(1),'pending']);await db.exec(read('20261009110000_public_statistics.sql'));for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{const result=await publicStatistics();assert.equal(result.availableJobs,1);assert.equal(result.views,11);assert.equal(result.applications,1);}finally{await db.exec('RESET ROLE');}}assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,1);
});

test('one homepage aggregate preserves category and special filters and returns only visible counts',async()=>{
 await db.exec(read('20261012113500_public_home_counts.sql'));
 const C1=ID(8001),C2=ID(8002);
 const rows=[
  [1,C1,true,false,false,false,'female','active','active'],
  [2,C1,false,true,true,false,'male','active','active'],
  [3,C2,false,false,false,false,'any','active','active'],
  [4,null,false,false,false,false,null,'active','active'],
  [5,C1,true,true,true,true,'female','draft','active'],
  [6,C1,true,true,true,true,'female','active','filled'],
  [7,C2,false,false,false,true,'male','active','active'],
 ];
 for(const [n,category,student,graduate,disabled,women,gender,status,source] of rows)await db.query('INSERT INTO jobs(id,category_id,is_for_students,is_for_graduates,is_for_disabled,is_for_women,gender,status,source_status,description_ru) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[ID(n),category,student,graduate,disabled,women,gender,status,source,'private fixture body']);
 const expected={total:5,categories:{[C1]:2,[C2]:2},special:{students:2,disabled:1,women:4}};
 for(const role of ['anon','authenticated','service_role']){await db.exec('SET ROLE '+role);try{
  const result=(await db.query('SELECT ishdasiz_public_home_counts() r')).rows[0].r;assert.deepEqual(result,expected);assert.equal(JSON.stringify(result).includes('private'),false);
 }finally{await db.exec('RESET ROLE');}}
 await db.exec(read('20261012113500_public_home_counts.sql'));assert.deepEqual((await db.query('SELECT ishdasiz_public_home_counts() r')).rows[0].r,expected);
});
