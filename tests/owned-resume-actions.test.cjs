const {test,before,beforeEach,after}=require('node:test');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');const migration=read('20261009150000_owned_resume_actions.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',E='00000000-0000-4000-8000-000000000003',R='10000000-0000-4000-8000-000000000001',N='10000000-0000-4000-8000-000000000002';let db;
const row=async(id=R)=>(await db.query('SELECT * FROM resumes WHERE id=$1',[id])).rows[0];
const version=async(id=R)=>(await db.query('SELECT updated_at::text AS v FROM resumes WHERE id=$1',[id])).rows[0]?.v??null;
const act=async(action='edit',payload={},patch={})=>{const args={user:A,epoch:0,id:R,expected:Object.prototype.hasOwnProperty.call(patch,'expected')?patch.expected:await version(),action,payload,...patch};return(await db.query('SELECT ishdasiz_write_own_resume($1,$2,$3,$4,$5,$6::jsonb) AS r',[args.user,args.epoch,args.id,args.action,args.expected,JSON.stringify(args.payload)])).rows[0].r;};
const create={title:'New resume',full_name:'Synthetic seeker',phone:'+998901234567',skills:['SQL'],languages:[{name:'english',level:'advanced'}]};
before(async()=>{db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid,phone text);CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,created_by uuid,status text,is_active boolean);
 CREATE TABLE resumes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,status text,is_public boolean,title text,full_name text,phone text,about text,birth_date date,region_id integer,district_id integer,category_id uuid,skills text[],languages text[],experience text,education_level text,gender text,expected_salary_min integer,expected_salary_max integer,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE job_applications(id uuid PRIMARY KEY,resume_id uuid REFERENCES resumes(id),status text);
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 INSERT INTO users VALUES('${A}','synthetic','+998901234567'),('${B}','synthetic','+998901234568'),('${E}','synthetic','+998901234569');`);await db.exec(read('20261007090000_account_closure.sql'));await db.exec(read('20261007091000_resume_search_state.sql'));await db.exec(migration);});
beforeEach(async()=>{await db.exec(`RESET ROLE;TRUNCATE job_applications,resumes,job_seeker_profiles,account_publication_snapshots;UPDATE users SET closed_at=null,session_version=0;
 INSERT INTO job_seeker_profiles(id,user_id) VALUES('${A}','${A}'),('${B}','${B}');
 INSERT INTO resumes(id,user_id,title,full_name,phone,status,is_public,updated_at) VALUES('${R}','${A}','Existing resume','Synthetic seeker','+998901234567','active',false,'2099-01-01T00:00:00.123456Z');
 INSERT INTO job_applications VALUES('${A}','${R}','accepted');`);});
after(async()=>{await db?.close();});
test('saving fields preserves publication, found-job choice, owner, exact creation time and application history',async()=>{
 await db.query('UPDATE resumes SET found_job=true,found_job_at=now() WHERE id=$1',[R]);const before=await row();const result=await act('edit',{title:'Changed resume',about:'Updated text'});const saved=await row();assert.equal(result.is_public,false);assert.equal(result.status,'active');assert.equal(saved.user_id,A);assert.equal(saved.found_job,true);assert.deepEqual(saved.created_at,before.created_at);assert.equal(saved.about,'Updated text');assert.equal((await db.query('SELECT resume_id FROM job_applications')).rows[0].resume_id,R);
});
test('exact versions reject stale editors and two simultaneous saves cannot overwrite one another',async()=>{
 const old=await version();const results=await Promise.allSettled([act('edit',{title:'First'},{expected:old}),act('edit',{title:'Second'},{expected:old})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'40001');assert.equal((await db.query('SELECT updated_at>$1::timestamptz AS advanced FROM resumes',[old])).rows[0].advanced,true);
});
test('no-op writes and view counters preserve versions while content changes advance exact future timestamps',async()=>{
 const old=await version();await act('edit',{title:'Existing resume'});assert.equal(await version(),old);await db.exec('ALTER TABLE resumes ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0');await db.query('UPDATE resumes SET views_count=1,updated_at=now() WHERE id=$1',[R]);assert.equal(await version(),old);await act('edit',{about:'Real change'});assert.notEqual(await version(),old);
});
test('archive retains resume ID and linked applications; restore is a private draft until explicit publication',async()=>{
 const archived=await act('archive');assert.equal(archived.status,'archived');assert.equal(archived.is_public,false);assert.equal((await db.query('SELECT resume_id FROM job_applications')).rows[0].resume_id,R);await assert.rejects(act('edit',{title:'Wrong'}),e=>e.code==='40001');
 const restored=await act('restore');assert.equal(restored.status,'draft');assert.equal(restored.is_public,false);await act('edit',{title:'Reviewed draft'});assert.equal((await row()).status,'draft');const published=await act('publish');assert.equal(published.status,'active');assert.equal(published.is_public,true);assert.equal((await act('hide')).is_public,false);assert.equal((await row()).status,'active');
});
test('publication clears the old found-job marker only after explicit confirmation',async()=>{
 await db.query('UPDATE resumes SET found_job=true,found_job_at=now() WHERE id=$1',[R]);await act('edit',{about:'Still hidden'});assert.equal((await row()).found_job,true);await act('publish');assert.equal((await row()).found_job,false);assert.equal((await row()).found_job_at,null);
});
test('foreign, transferred and missing resume IDs never mutate anybody’s data',async()=>{
 await assert.rejects(act('archive',{}, {user:B}),e=>e.code==='42501');await assert.rejects(act('edit',{title:'Wrong'},{id:N}),e=>e.code==='P0002');await db.query('UPDATE resumes SET user_id=$1 WHERE id=$2',[B,R]);await assert.rejects(act('edit',{title:'Wrong'}),e=>e.code==='42501');assert.equal((await row()).title,'Existing resume');assert.equal((await row()).user_id,B);
});
test('closed, revoked, missing and wrong-role accounts cannot write or restore a resume',async()=>{
 for(const patch of [{user:E},{user:'00000000-0000-4000-8000-000000000099'},{epoch:1},{epoch:null}])await assert.rejects(act('archive',{},patch),e=>['42501','22023'].includes(e.code));
 await db.query('UPDATE users SET closed_at=now(),session_version=1 WHERE id=$1',[A]);await assert.rejects(act('edit',{about:'Wrong'},{epoch:1}),e=>e.code==='42501');await db.query('UPDATE users SET closed_at=null,session_version=2 WHERE id=$1',[A]);await assert.rejects(act('edit',{about:'Old session'},{epoch:1}),e=>e.code==='42501');await act('edit',{about:'Fresh session'},{epoch:2});assert.equal((await row()).about,'Fresh session');
});
test('creation retains PostgreSQL defaults and retries the same durable ID without creating duplicates',async()=>{
 const first=await act('create',create,{id:N,expected:null});assert.equal(first.id,N);assert.equal(first.status,'active');assert.equal(first.is_public,true);const before=await row(N);assert.ok(before.created_at);assert.ok(before.updated_at);const again=await act('create',create,{id:N,expected:null});assert.equal(again.id,N);assert.deepEqual(await row(N),before);assert.equal((await db.query('SELECT count(*)::integer AS n FROM resumes')).rows[0].n,2);await assert.rejects(act('create',{...create,title:'Changed pending creation'},{id:N,expected:null}),e=>e.code==='40001');await assert.rejects(act('create',create,{id:N,user:B,expected:null}),e=>e.code==='42501');
});
test('text[] language storage preserves structured names and levels alongside older labels',async()=>{
 await act('edit',{languages:[{name:'english',level:'advanced'},'Русский']});const saved=await row();assert.deepEqual(JSON.parse(saved.languages[0]),{name:'english',level:'advanced'});assert.equal(saved.languages[1],'Русский');
});
test('ownership, publication, timestamps and unknown columns cannot be injected into the generic payload',async()=>{
 for(const payload of [{id:N},{user_id:B},{is_public:true},{status:'active'},{updated_at:'2026-01-01'},{found_job:false},{unknown:'value'},{skills:'wrong'},{skills:Array(101).fill('SQL')},{title:'x'.repeat(256)},{expected_salary_min:-1},{expected_salary_min:2000,expected_salary_max:1000}])await assert.rejects(act('edit',payload),e=>e.code==='22023');const saved=await row();assert.equal(saved.user_id,A);assert.equal(saved.title,'Existing resume');assert.equal(saved.is_public,false);
});
test('invalid contacts and a failed update roll back the full operation',async()=>{
 await assert.rejects(act('create',{...create,phone:'bad'},{id:N,expected:null}),e=>e.code==='22023');await assert.rejects(act('edit',{phone:null,title:'Wrong'}),e=>e.code==='22023');assert.equal((await row()).title,'Existing resume');assert.equal((await row(N)),undefined);
 await db.exec("CREATE FUNCTION reject_test_resume() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure';END $$;CREATE TRIGGER reject_test_resume BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION reject_test_resume();");try{await assert.rejects(act('archive'));assert.equal((await row()).status,'active');assert.equal((await db.query('SELECT resume_id FROM job_applications')).rows[0].resume_id,R);}finally{await db.exec('DROP TRIGGER reject_test_resume ON resumes;DROP FUNCTION reject_test_resume()');}
});
test('browser roles cannot call resume writes, service_role can and reapplying preserves records and one trigger',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(act('archive',{}, {expected:null}),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{await act('hide',{}, {expected:'2099-01-01T00:00:00.123456Z'});}finally{await db.exec('RESET ROLE');}const before=await row();await db.exec(migration);assert.deepEqual(await row(),before);assert.equal((await db.query("SELECT count(*)::integer AS n FROM pg_trigger WHERE tgname='ishdasiz_resume_updated_at'")).rows[0].n,1);
});
test('the same function supports structured JSONB language storage without discarding levels',async()=>{
 await db.exec('ALTER TABLE resumes ALTER COLUMN languages TYPE jsonb USING to_jsonb(languages)');await db.exec(migration);try{await act('edit',{languages:[{name:'uzbek',level:'native'}]});assert.deepEqual((await row()).languages,[{name:'uzbek',level:'native'}]);}finally{await db.exec("UPDATE resumes SET languages=null;ALTER TABLE resumes ALTER COLUMN languages TYPE text[] USING null::text[]");await db.exec(migration);}
});

test('explicit seeker activation creates exactly one profile for a verified account without overwriting existing profiles',async()=>{
 const enable=(user=E,epoch=0)=>db.query('SELECT ishdasiz_enable_seeker_profile($1,$2) AS id',[user,epoch]);
 const first=(await enable()).rows[0].id;assert.ok(first);assert.equal((await enable()).rows[0].id,first);assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_seeker_profiles WHERE user_id=$1',[E])).rows[0].n,1);assert.equal((await db.query('SELECT phone FROM job_seeker_profiles WHERE user_id=$1',[E])).rows[0].phone,'+998901234569');assert.equal((await enable(A)).rows[0].id,A);assert.equal((await row()).title,'Existing resume');
});
test('closed/revoked accounts and browser roles cannot activate a seeker profile',async()=>{
 const enable=(epoch=0)=>db.query('SELECT ishdasiz_enable_seeker_profile($1,$2)',[E,epoch]);await assert.rejects(enable(1),e=>e.code==='42501');
 await db.query('UPDATE users SET closed_at=now() WHERE id=$1',[E]);await assert.rejects(enable(),e=>e.code==='42501');for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(enable(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_seeker_profiles WHERE user_id=$1',[E])).rows[0].n,0);
});
