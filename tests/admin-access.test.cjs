const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const migration=read('20261007101000_admin_access.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003',U='00000000-0000-4000-8000-000000000004';
const J='10000000-0000-4000-8000-000000000001',K='10000000-0000-4000-8000-000000000002',E='20000000-0000-4000-8000-000000000001';
let db;
const payload={title_uz:'Operator',title_ru:'Оператор',description_uz:'Tavsif',description_ru:'Описание',company_name:'Demo',district_id:100,region_id:1,payment_type:3,skills:['Excel'],languages:[{language:'Russian',level:'native'}],status:'draft',is_active:false};
async function write(actor=A,id=J,action='create',body=payload,version=null){return (await db.query('SELECT ishdasiz_admin_write_vacancy($1,$2,$3,$4::jsonb,$5::timestamptz) AS job',[actor,id,action,JSON.stringify(body),version])).rows[0].job;}
const version=id=>db.query('SELECT updated_at::text AS v FROM jobs WHERE id=$1',[id]).then(r=>r.rows[0].v);
const reserve=id=>db.query('SELECT ishdasiz_reserve_admin_vacancy_ai($1) AS remaining',[id]).then(r=>r.rows[0].remaining);
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);
 CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE resumes(id uuid PRIMARY KEY,user_id uuid,is_public boolean,status text);
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 CREATE TABLE admin_profiles(id uuid PRIMARY KEY,full_name text,role text,district_id integer,created_at timestamptz DEFAULT now());
 CREATE TABLE categories(id uuid PRIMARY KEY,name_uz text,name_ru text);CREATE TABLE districts(id integer PRIMARY KEY,name_uz text,name_ru text);
 CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,created_by uuid,title_uz text,title_ru text,description_uz text NOT NULL DEFAULT '',description_ru text NOT NULL DEFAULT '',company_name text,category_id uuid,region_id integer,district_id integer,salary_min integer,salary_max integer,employment_type text,latitude double precision,longitude double precision,address text,contact_phone text,contact_telegram text,requirements_uz text,requirements_ru text,benefits text,experience text,education_level text,gender text,age_min integer,age_max integer,languages jsonb,skills jsonb,is_for_students boolean DEFAULT false,is_for_disabled boolean DEFAULT false,is_for_women boolean DEFAULT false,payment_type integer,work_mode text,status text,is_active boolean,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),is_imported boolean DEFAULT false,source text DEFAULT 'local',source_status text DEFAULT 'active',views_count integer DEFAULT 0);
 CREATE TABLE job_applications(id integer PRIMARY KEY,job_id uuid REFERENCES jobs(id),status text);
 INSERT INTO users VALUES('${U}','synthetic-hash','+998901234567');INSERT INTO employer_profiles VALUES('${E}','${U}');
 INSERT INTO admin_profiles(id,role,district_id) VALUES('${A}','super_admin',null),('${B}','hokimlik_assistant',100),('${C}','hokimlik_assistant',null);
 GRANT ALL ON admin_profiles TO PUBLIC,anon,authenticated;GRANT SELECT(id),UPDATE(role) ON admin_profiles TO anon,authenticated;CREATE POLICY legacy_admin_policy ON admin_profiles USING(true);`);
 await db.exec(read('20261007090000_account_closure.sql'));await db.exec(read('20261007094000_vacancy_updated_at.sql'));await db.exec(migration);
});
after(async()=>{await db?.close();});
test('creation keeps PostgreSQL defaults and typed fields, leaves account ownership empty and audits only once',async()=>{
 await db.exec('SET ROLE service_role');let job;try{job=await write();await write();}finally{await db.exec('RESET ROLE');}
 assert.equal(job.source,'local');assert.equal(job.source_status,'active');assert.equal(job.payment_type,3);assert.deepEqual(job.skills,['Excel']);assert.equal(job.views_count,0);assert.equal(job.user_id,null);assert.equal(job.created_by,null);assert.equal(job.employer_id,null);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM admin_actions WHERE job_id=$1',[J])).rows[0].n,1);
 await assert.rejects(write(A,J,'create',{...payload,title_ru:'Changed'}),e=>e.code==='40001');
 await assert.rejects(write(B,J),e=>e.code==='40001');
 const audit=(await db.query('SELECT * FROM admin_actions WHERE job_id=$1',[J])).rows[0];assert.equal(audit.action,'create');assert.equal(audit.previous_version,null);assert.ok(audit.result_version);assert.equal(audit.contact_phone,undefined);
});
test('district restrictions are checked again in the write transaction, including the old and new assignment',async()=>{
 await assert.rejects(write(B,K,'create',{...payload,district_id:200}),e=>e.code==='42501');await assert.rejects(write(C,K),e=>e.code==='42501');
 await write(B,K);await db.query('UPDATE jobs SET district_id=200 WHERE id=$1',[K]);
 await assert.rejects(write(B,K,'hide',{},await version(K)),e=>e.code==='P0002');
 await assert.rejects(write(B,J,'edit',{district_id:200},await version(J)),e=>e.code==='42501');
 await db.query('UPDATE admin_profiles SET district_id=200 WHERE id=$1',[B]);await assert.rejects(write(B,J,'hide',{},await version(J)),e=>e.code==='P0002');
 await db.query('UPDATE admin_profiles SET district_id=100 WHERE id=$1',[B]);
});
test('missing, unknown, unassigned, disabled and null-role admins cannot mutate records or reserve AI quota',async()=>{
 const old=await version(J);for(const actor of [C,'00000000-0000-4000-8000-000000000099']){await assert.rejects(write(actor,J,'hide',{},old),e=>e.code==='42501');await assert.rejects(reserve(actor),e=>e.code==='42501');}
 for(const change of ["role='unknown'","role=null","role='hokimlik_assistant',district_id=0","role='super_admin',disabled_at=now()"]){await db.exec(`UPDATE admin_profiles SET ${change} WHERE id='${C}'`);await assert.rejects(write(C,J,'hide',{},old),e=>e.code==='42501');await assert.rejects(reserve(C),e=>e.code==='42501');}
 assert.equal(await version(J),old);
});
test('null actions and ownership or status injection are rejected without an audit or vacancy change',async()=>{
 const old=await version(J);await assert.rejects(write(A,J,null,{},old),e=>e.code==='22023');
 for(const body of [{user_id:U},{created_by:A},{employer_id:E},{status:'active'},{is_active:true}])await assert.rejects(write(A,J,'edit',body,old),e=>e.code==='22023');assert.equal(await version(J),old);
});
test('exact versions reject stale saves, views preserve the editor version, and archive/restore preserve applications',async()=>{
 await db.query("INSERT INTO job_applications VALUES(1,$1,'pending')",[J]);const old=await version(J);
 await db.query('UPDATE jobs SET views_count=views_count+1,updated_at=now() WHERE id=$1',[J]);assert.equal(await version(J),old);
 await write(B,J,'edit',{title_ru:'New title',district_id:100},old);const next=await version(J);assert.notEqual(next,old);await assert.rejects(write(A,J,'hide',{},old),e=>e.code==='40001');
 await write(A,J,'archive',{},next);assert.equal((await db.query('SELECT is_active FROM jobs WHERE id=$1',[J])).rows[0].is_active,false);
 await assert.rejects(write(A,J,'edit',{title_ru:'Cannot edit'},await version(J)),e=>e.code==='40001');
 await write(A,J,'restore',{},await version(J));assert.equal((await db.query('SELECT status FROM jobs WHERE id=$1',[J])).rows[0].status,'draft');assert.equal((await db.query('SELECT status FROM job_applications WHERE id=1')).rows[0].status,'pending');
 await assert.rejects(write(A,J,'restore',{},await version(J)),e=>e.code==='40001');
});
test('a removed source and a closed employer cannot be republished through the admin RPC',async()=>{
 await db.query("UPDATE jobs SET source_status='removed_at_source' WHERE id=$1",[J]);await assert.rejects(write(A,J,'publish',{},await version(J)),e=>e.code==='40001');await db.query("UPDATE jobs SET source_status='active',employer_id=$1 WHERE id=$2",[E,J]);
 await db.query('SELECT ishdasiz_set_account_closed($1,0,true)',[U]);await assert.rejects(write(A,J,'restore',{},await version(J)),e=>e.code==='42501');await db.query('SELECT ishdasiz_set_account_closed($1,1,false)',[U]);
});
test('a failed audit insert rolls back the vacancy edit and preserves the exact version',async()=>{
 const old=await version(J);await db.exec("ALTER TABLE admin_actions ADD CONSTRAINT reject_edit CHECK(action<>'edit') NOT VALID");
 await assert.rejects(write(A,J,'edit',{title_ru:'Must roll back'},old),e=>e.code==='23514');assert.equal(await version(J),old);assert.equal((await db.query('SELECT title_ru FROM jobs WHERE id=$1',[J])).rows[0].title_ru,'New title');await db.exec('ALTER TABLE admin_actions DROP CONSTRAINT reject_edit');
});
test('AI quota counts attempts across queued requests and is checked against current permissions',async()=>{
 assert.deepEqual(await Promise.all(Array.from({length:6},()=>reserve(A))),[2,1,0,-1,-1,-1]);assert.equal(await reserve(B),2);
 await db.query("UPDATE admin_vacancy_ai_usage SET created_at=clock_timestamp()-interval '61 minutes' WHERE admin_id=$1",[A]);assert.equal(await reserve(A),2);
 await db.query('UPDATE admin_profiles SET disabled_at=now() WHERE id=$1',[B]);await assert.rejects(reserve(B),e=>e.code==='42501');await db.query('UPDATE admin_profiles SET disabled_at=null WHERE id=$1',[B]);
});
test('public roles have no table, column or function rights even with old permissive policies',async()=>{
 for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);try{for(const sql of ['SELECT id FROM admin_profiles',"UPDATE admin_profiles SET role='super_admin'",'SELECT * FROM admin_actions','DELETE FROM admin_vacancy_ai_usage'])await assert.rejects(db.query(sql),e=>e.code==='42501');await assert.rejects(write(),e=>e.code==='42501');await assert.rejects(reserve(A),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.ok((await db.query('SELECT * FROM admin_actions')).rows.length);await assert.rejects(db.query('DELETE FROM admin_actions'),e=>e.code==='42501');await assert.rejects(db.query('DELETE FROM admin_vacancy_ai_usage'),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
});
test('reapplying the migration preserves permissions, roles, drafts, audits and quota records',async()=>{
 const audits=(await db.query('SELECT count(*)::integer AS n FROM admin_actions')).rows[0].n,quota=(await db.query('SELECT count(*)::integer AS n FROM admin_vacancy_ai_usage')).rows[0].n;await db.exec(migration);
 assert.equal((await db.query('SELECT count(*)::integer AS n FROM admin_actions')).rows[0].n,audits);assert.equal((await db.query('SELECT count(*)::integer AS n FROM admin_vacancy_ai_usage')).rows[0].n,quota);assert.equal((await db.query('SELECT role FROM admin_profiles WHERE id=$1',[A])).rows[0].role,'super_admin');assert.equal((await db.query('SELECT status FROM job_applications')).rows[0].status,'pending');
 const old=(await db.query('SELECT updated_at::text AS v FROM admin_profiles WHERE id=$1',[A])).rows[0].v;await db.query('UPDATE admin_profiles SET updated_at=now() WHERE id=$1',[A]);assert.equal((await db.query('SELECT updated_at::text AS v FROM admin_profiles WHERE id=$1',[A])).rows[0].v,old);
 await db.query("UPDATE admin_profiles SET full_name='Updated' WHERE id=$1",[A]);assert.notEqual((await db.query('SELECT updated_at::text AS v FROM admin_profiles WHERE id=$1',[A])).rows[0].v,old);
});
test('database statistics cover more than 1000 jobs, apply the assigned district and cannot be called publicly',async()=>{
 await db.exec("INSERT INTO jobs(id,district_id,status,is_active,views_count) SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,100,'published',true,2 FROM generate_series(1,1205) AS n;INSERT INTO districts VALUES(100,'Tuman','Район');");
 const stats=async actor=>(await db.query('SELECT ishdasiz_admin_stats($1) AS stats',[actor])).rows[0].stats;
 const all=await stats(A),assigned=await stats(B);assert.equal(all.totalJobs,1207);assert.equal(assigned.totalJobs,1206);assert.equal(assigned.activeJobs,1205);assert.equal(assigned.totalViews,2411);assert.equal(assigned.totalApplications,1);assert.equal(assigned.jobsByDistrict[0].count,1206);assert.equal(assigned.jobsByDistrict[0].name_ru,'Район');assert.equal(assigned.jobsByCategory[0].id,null);
 await assert.rejects(stats(C),e=>e.code==='42501');await db.exec('SET ROLE anon');try{await assert.rejects(stats(A),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}
});
