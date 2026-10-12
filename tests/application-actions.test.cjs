const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',S='00000000-0000-4000-8000-000000000003',E='10000000-0000-4000-8000-000000000001',F='10000000-0000-4000-8000-000000000002',J='20000000-0000-4000-8000-000000000001',APP='30000000-0000-4000-8000-000000000001';let db;
const sql=read('20261009140000_application_actions.sql'),webSql=read('20261010170000_web_application_actions.sql');
const web=async(action='view',patch={})=>{const a={user:A,epoch:0,id:APP,action,next:null,status:'pending',responded:null,details:{},...patch};return(await db.query('SELECT ishdasiz_web_application_action($1,$2,$3,$4,$5,$6,$7,$8::jsonb) AS r',[a.user,a.epoch,a.id,a.action,a.next,a.status,a.responded,JSON.stringify(a.details)])).rows[0].r;};
const currentVersion=async()=>{const row=(await db.query('SELECT status,responded_at::text AS responded FROM job_applications WHERE id=$1',[APP])).rows[0];return row;};
const act=async(action='view',patch={})=>{const args={user:A,epoch:0,id:APP,action,status:'pending',responded:null,details:{},...patch};return(await db.query('SELECT ishdasiz_application_action($1,$2,$3,$4,$5,$6,$7::jsonb) AS r',[args.user,args.epoch,args.id,args.action,args.status,args.responded,JSON.stringify(args.details)])).rows[0].r;};
const saved=async()=>(await db.query('SELECT * FROM job_applications WHERE id=$1',[APP])).rows[0];
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE TABLE users(id uuid PRIMARY KEY,password_hash text,phone text);CREATE TABLE otp_codes(phone text,verified boolean);
 CREATE TABLE job_seeker_profiles(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE employer_profiles(id uuid PRIMARY KEY,user_id uuid);
 CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,created_by uuid,is_active boolean,status text);
 CREATE TABLE resumes(id uuid PRIMARY KEY,user_id uuid,is_public boolean,status text);
 CREATE TABLE telegram_sessions(id uuid PRIMARY KEY,user_id uuid,state text,data jsonb,phone text,otp_code text,otp_expires_at timestamptz);
 CREATE TABLE job_applications(id uuid PRIMARY KEY,job_id uuid REFERENCES jobs(id),user_id uuid,resume_id uuid,status text,full_name text,phone text,message text,created_at timestamptz DEFAULT now());
 INSERT INTO users VALUES('${A}','synthetic','+998901234567'),('${B}','synthetic','+998901234568'),('${S}','synthetic','+998901234569');`);
 await db.exec(read('20261007090000_account_closure.sql'));await db.exec(sql);await db.exec(webSql);
});
beforeEach(async()=>{await db.exec(`RESET ROLE;TRUNCATE job_applications,jobs,employer_profiles,account_publication_snapshots;UPDATE users SET closed_at=null,session_version=0;
 INSERT INTO employer_profiles VALUES('${E}','${A}'),('${F}','${B}');
 INSERT INTO jobs VALUES('${J}','${E}','${B}','${B}',true,'active');
 INSERT INTO job_applications(id,job_id,user_id,status,full_name,message) VALUES('${APP}','${J}','${S}','pending','Synthetic','Preserve application');`);});
after(async()=>{await db?.close();});
test('opening an application marks it reviewed once and preserves all submitted data',async()=>{
 const first=await act();assert.equal(first.status,'reviewed');assert.ok(first.viewed_at);assert.equal(first.responded_at,null);const again=await act();assert.equal(again.viewed_at,first.viewed_at);const app=await saved();assert.equal(app.user_id,S);assert.equal(app.message,'Preserve application');assert.equal(app.full_name,'Synthetic');
});
test('decisions update all details atomically, advance a monotonic microsecond response version and mark it unread',async()=>{
 await db.query("UPDATE job_applications SET responded_at='2099-01-01T00:00:00.123456Z' WHERE id=$1",[APP]);
 const before=(await db.query('SELECT responded_at::text AS v FROM job_applications')).rows[0].v;
 const first=await act('accepted',{responded:before,details:{employer_phone:'+998901234567',employer_message:' Synthetic message '}});assert.equal(first.status,'accepted');assert.equal(first.employer_message,'Synthetic message');assert.equal(first.employer_phone,'+998901234567');assert.equal((await saved()).is_seen_by_job_seeker,false);assert.equal((await db.query('SELECT responded_at>$1::timestamptz AS advanced FROM job_applications',[before])).rows[0].advanced,true);
 const current=(await db.query('SELECT responded_at::text AS v FROM job_applications')).rows[0].v;const hired=await act('hired',{status:'accepted',responded:current});assert.equal(hired.status,'hired');assert.equal(hired.employer_message,'Synthetic message');
});
test('two concurrent decisions based on the same version cannot both save',async()=>{
 const results=await Promise.allSettled([act('accepted'),act('rejected')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const failure=results.find(r=>r.status==='rejected');assert.equal(failure.reason.code,'40001');assert.equal((await db.query('SELECT count(*)::integer AS n FROM job_applications')).rows[0].n,1);
});
test('stale decision snapshots never overwrite an intervening review or employer response',async()=>{
 await act();await assert.rejects(act('rejected'),e=>e.code==='40001');assert.equal((await saved()).status,'reviewed');
 const response=await act('accepted',{status:'reviewed'});await assert.rejects(act('rejected',{status:'accepted',responded:null}),e=>e.code==='40001');assert.equal((await saved()).status,response.status);
});
test('canonical employer assignment takes priority over legacy creator/user fields, including transfers',async()=>{
 await assert.rejects(act('view',{user:B}),e=>e.code==='42501');
 await db.query('UPDATE jobs SET employer_id=$1,user_id=$2,created_by=$2 WHERE id=$3',[F,A,J]);await assert.rejects(act(),e=>e.code==='42501');assert.equal((await saved()).viewed_at,null);assert.equal((await act('view',{user:B})).status,'reviewed');
});
test('legacy user and creator ownership works only when more authoritative assignments are absent',async()=>{
 await db.query('UPDATE jobs SET employer_id=null,user_id=$1,created_by=$2 WHERE id=$3',[A,B,J]);assert.equal((await act()).status,'reviewed');await assert.rejects(act('view',{user:B}),e=>e.code==='42501');
 await db.query('UPDATE jobs SET user_id=null,created_by=$1 WHERE id=$2',[B,J]);await assert.rejects(act(),e=>e.code==='42501');assert.equal((await act('view',{user:B})).status,'reviewed');
});
test('closed, revoked, missing and wrong-role accounts cannot view or change application status',async()=>{
 for(const patch of [{user:S},{epoch:1},{epoch:null},{user:'00000000-0000-4000-8000-000000000099'}])await assert.rejects(act('view',patch),e=>e.code==='42501'||e.code==='22023');
 await db.query('UPDATE users SET closed_at=now(),session_version=1 WHERE id=$1',[A]);await assert.rejects(act('accepted',{epoch:1}),e=>e.code==='42501');assert.equal((await saved()).status,'pending');
 await db.query('UPDATE users SET closed_at=null,session_version=2 WHERE id=$1',[A]);await assert.rejects(act('accepted',{epoch:1}),e=>e.code==='42501');assert.equal((await act('accepted',{epoch:2})).status,'accepted');
});
test('invalid, unknown and oversized details roll back the entire decision',async()=>{
 for(const details of [{user_id:B},{employer_message:'x'.repeat(4001)},{employer_phone:99},{interview_address:'x'.repeat(1001)},{interview_date:'bad date'},[],null])await assert.rejects(act('accepted',{details}),e=>['22023','22007'].includes(e.code));
 assert.equal((await saved()).status,'pending');assert.equal((await saved()).responded_at,null);assert.equal((await saved()).employer_phone,null);
});
test('interviews require a date; scheduling and explicit field clearing preserve application history',async()=>{
 await assert.rejects(act('interview_set'),e=>e.code==='22023');const first=await act('interview_set',{details:{interview_date:'2026-10-12T10:00:00+05:00',interview_address:'Synthetic address',employer_phone:'+998901234567'}});assert.equal(first.status,'interview_set');assert.ok(first.interview_date);
 const exact=(await db.query('SELECT responded_at::text AS v FROM job_applications')).rows[0].v;const rejected=await act('rejected',{status:'interview_set',responded:exact,details:{employer_phone:null,rejection_reason:'Synthetic reason'}});assert.equal(rejected.employer_phone,null);assert.equal(rejected.rejection_reason,'Synthetic reason');assert.equal((await saved()).message,'Preserve application');
});
test('unknown actions and invalid transitions never change the record',async()=>{
 await assert.rejects(act('forged'),e=>e.code==='22023');await assert.rejects(act('hired'),e=>e.code==='40001');await act('rejected');const exact=(await db.query('SELECT responded_at::text AS v FROM job_applications')).rows[0].v;await assert.rejects(act('accepted',{status:'rejected',responded:exact}),e=>e.code==='40001');assert.equal((await saved()).status,'rejected');
});
test('only service_role can call the action and reapplying the migration preserves all history',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(act(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.equal((await act()).status,'reviewed');}finally{await db.exec('RESET ROLE');}
 const before=await saved();await db.exec(sql);assert.deepEqual(await saved(),before);assert.equal((await db.query('SELECT count(*)::integer AS n FROM pg_proc WHERE proname=\'ishdasiz_application_action\'')).rows[0].n,1);
});


test('web view preserves decision timestamps and notification state, while marking first view once',async()=>{
 await db.query("UPDATE job_applications SET status='accepted',responded_at='2026-10-10T00:00:00.123456Z',is_seen_by_job_seeker=true WHERE id=$1",[APP]);const before=await saved();const result=await web();assert.equal(result.status,'accepted');const after=await saved();assert.deepEqual(after.responded_at,before.responded_at);assert.equal(after.is_seen_by_job_seeker,true);assert.ok(after.viewed_at);await web();assert.deepEqual((await saved()).viewed_at,after.viewed_at);
});
test('web status choices preserve reversible decisions and advance exact future microsecond versions',async()=>{
 await db.query("UPDATE job_applications SET responded_at='2090-01-01T00:00:00.123456Z' WHERE id=$1",[APP]);
 for(const next of ['reviewed','accepted','hired','rejected','pending']){const before=await currentVersion();const r=await web('status',{next,...before});assert.equal(r.status,next);assert.equal((await db.query('SELECT responded_at>$1::timestamptz AS advanced FROM job_applications',[before.responded])).rows[0].advanced,true);assert.equal((await saved()).message,'Preserve application');}
});
test('web decisions reject changed versions and only one of two competing writes succeeds',async()=>{
 const results=await Promise.allSettled([web('status',{next:'accepted'}),web('status',{next:'rejected'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'40001');const current=await currentVersion();await assert.rejects(web('status',{next:'pending',status:current.status,responded:null}),e=>e.code==='40001');
});
test('web action rechecks canonical ownership after a transfer and rejects the former owner without changes',async()=>{
 const before=await saved();await db.query('UPDATE jobs SET employer_id=$1,user_id=$2,created_by=$2 WHERE id=$3',[F,A,J]);await assert.rejects(web('status',{next:'accepted'}),e=>e.code==='42501');assert.deepEqual(await saved(),before);assert.equal((await web('status',{user:B,next:'accepted'})).status,'accepted');
});
test('web action rechecks account closure, exact epoch and role inside the write',async()=>{
 for(const patch of [{epoch:1},{epoch:null},{user:S}])await assert.rejects(web('status',{next:'accepted',...patch}),e=>['42501','22023'].includes(e.code));await db.query('UPDATE users SET closed_at=now(),session_version=1 WHERE id=$1',[A]);await assert.rejects(web('status',{epoch:1,next:'accepted'}),e=>e.code==='42501');assert.equal((await saved()).status,'pending');
});
test('web interview requires a valid timestamp and safely stores address and candidate message',async()=>{
 await assert.rejects(web('status',{next:'interview_set'}),e=>e.code==='22023');await assert.rejects(web('status',{next:'interview_set',details:{interview_date:'2026-02-30T10:00:00+05:00'}}),e=>e.code==='22008');const r=await web('status',{next:'interview_set',details:{interview_date:'2026-10-12T10:00:00+05:00',interview_address:' Synthetic meeting ',employer_message:' Synthetic message '}});assert.equal(r.status,'interview_set');assert.equal(r.interview_address,'Synthetic meeting');assert.equal(r.employer_message,'Synthetic message');assert.equal((await saved()).is_seen_by_job_seeker,false);
});
test('web no-op requires the exact version and does not reset the candidate read receipt',async()=>{
 await web('status',{next:'accepted'});await db.query('UPDATE job_applications SET is_seen_by_job_seeker=true WHERE id=$1',[APP]);const before=await saved(),version=await currentVersion();await web('status',{next:'accepted',...version});assert.deepEqual(await saved(),before);await assert.rejects(web('status',{next:'accepted',status:'pending'}),e=>e.code==='40001');
});
test('web decisions reject unknown actions, statuses and forged or oversized detail fields',async()=>{
 for(const patch of [{action:'delete'},{next:'forged'},{details:{user_id:S}},{details:{employer_message:'x'.repeat(4001)}},{details:null},{details:[]},{details:{interview_address:99}}])await assert.rejects(web('status',{next:'accepted',...patch}),e=>e.code==='22023');assert.equal((await saved()).status,'pending');
});
test('web decision rolls back all changes when a database write fails',async()=>{
 const before=await saved();await db.exec("CREATE FUNCTION reject_web_test_write() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic failure';END$$;CREATE TRIGGER reject_web_test_write BEFORE UPDATE ON job_applications FOR EACH ROW EXECUTE FUNCTION reject_web_test_write();");try{await assert.rejects(web('status',{next:'accepted',details:{employer_message:'new'}}));assert.deepEqual(await saved(),before);}finally{await db.exec('DROP TRIGGER reject_web_test_write ON job_applications;DROP FUNCTION reject_web_test_write();');}
});
test('web RPC stays service-only and reapplying SQL preserves decisions and history',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(web(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}await db.exec('SET ROLE service_role');try{assert.equal((await web()).status,'reviewed');}finally{await db.exec('RESET ROLE');}const before=await saved();await db.exec(webSql);assert.deepEqual(await saved(),before);
});
