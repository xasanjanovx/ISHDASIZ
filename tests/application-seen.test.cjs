const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'supabase/releases/2026-10-repair.json'),'utf8'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),S=id(2),B=id(3),E=id(4),J=id(5),APP=id(6),NEXT=id(7),FOREIGN=id(8),stamp='2026-10-10T01:02:03.123456Z';
let db;
const snapshot=(app=APP,status='accepted',responded_at=stamp)=>({id:app,status,responded_at});
const call=async(snapshots=[snapshot()],user=S,epoch=0)=>(await db.query('SELECT ishdasiz_application_seen($1,$2,$3::jsonb) AS receipt',[user,epoch,JSON.stringify(snapshots)])).rows[0].receipt;
const history=async()=>(await db.query('SELECT * FROM job_applications ORDER BY id')).rows;
before(async()=>{
 db=await PGlite.create();await db.exec(fs.readFileSync(path.join(root,'tests/fixtures/legacy-release-baseline.sql'),'utf8'));
 for(const file of ['20260212_add_job_offers.sql','20260217_channel_autopost_outbox.sql','20260409_job_auto_matches_v2.sql'])await db.exec(read(file));
 for(const entry of manifest.migrations)await db.exec(read(entry.file));
});
beforeEach(async()=>{await db.exec(`RESET ROLE;TRUNCATE users,employer_profiles,job_seeker_profiles,jobs,resumes,job_applications RESTART IDENTITY CASCADE;
 INSERT INTO users(id,password_hash) VALUES('${A}','synthetic'),('${S}','synthetic'),('${B}','synthetic');
 INSERT INTO employer_profiles(id,user_id) VALUES('${E}','${A}');INSERT INTO job_seeker_profiles(user_id) VALUES('${S}'),('${B}');
 INSERT INTO jobs(id,employer_id,title_ru) VALUES('${J}','${E}','Preserve job');
 INSERT INTO job_applications(id,job_id,user_id,status,responded_at,is_seen_by_job_seeker,full_name,phone,message,interview_address,employer_message)
 VALUES('${APP}','${J}','${S}','accepted','${stamp}',false,'Synthetic candidate','+998000000000','Preserve cover letter','Preserve address','Preserve employer message'),
 ('${NEXT}','${J}','${S}','interview_set','${stamp}',null,'Synthetic candidate',null,'Preserve history',null,null),
 ('${FOREIGN}','${J}','${B}','accepted','${stamp}',false,'Other candidate',null,'Other history',null,null);`);});
after(async()=>{await db?.close();});

test('an exact observed decision is marked once without changing its response version or submitted history',async()=>{
 const before=await history();assert.deepEqual(await call(),{seen:[APP],changed:[]});const after=await history();
 assert.deepEqual(after,before.map(row=>row.id===APP?{...row,is_seen_by_job_seeker:true}:row));
 assert.deepEqual(await call(),{seen:[APP],changed:[]});assert.deepEqual(await history(),after);
});
test('one microsecond or a changed status leaves a newer decision unread',async()=>{
 assert.deepEqual(await call([snapshot(APP,'accepted','2026-10-10T01:02:03.123455Z')]),{seen:[],changed:[APP]});
 assert.deepEqual(await call([snapshot(APP,'reviewed')]),{seen:[],changed:[APP]});assert.equal((await history())[0].is_seen_by_job_seeker,false);
});
test('a batch marks matching versions while reporting changed versions and preserving the rest of history',async()=>{
 assert.deepEqual(await call([snapshot(NEXT,'accepted'),snapshot()]),{seen:[APP],changed:[NEXT]});
 const rows=await history();assert.equal(rows.find(r=>r.id===APP).is_seen_by_job_seeker,true);assert.equal(rows.find(r=>r.id===NEXT).is_seen_by_job_seeker,null);
});
test('legacy null status, null response date and null read flag are handled explicitly',async()=>{
 await db.query('UPDATE job_applications SET status=null,responded_at=null,is_seen_by_job_seeker=null WHERE id=$1',[APP]);
 assert.deepEqual(await call([snapshot(APP,null,null)]),{seen:[APP],changed:[]});assert.equal((await history())[0].is_seen_by_job_seeker,true);
});
test('foreign IDs in a mixed batch roll back earlier matching acknowledgements',async()=>{
 const before=await history();await assert.rejects(call([snapshot(),snapshot(FOREIGN)]),e=>e.code==='P0002');assert.deepEqual(await history(),before);
 await assert.rejects(call([snapshot()],B),e=>e.code==='P0002');assert.deepEqual(await history(),before);
});
test('missing application IDs fail the whole batch instead of partially clearing notifications',async()=>{
 const before=await history();await assert.rejects(call([snapshot(),snapshot(id(99))]),e=>e.code==='P0002');assert.deepEqual(await history(),before);
});
test('closed accounts and revoked or absent epochs cannot acknowledge, while a restored fresh epoch can',async()=>{
 const before=await history();for(const epoch of [1,null])await assert.rejects(call([snapshot()],S,epoch),e=>e.code==='42501'||e.code==='22023');
 await db.query('UPDATE users SET closed_at=now(),session_version=1 WHERE id=$1',[S]);await assert.rejects(call([snapshot()],S,1),e=>e.code==='42501');assert.deepEqual(await history(),before);
 await db.query('UPDATE users SET closed_at=null WHERE id=$1',[S]);await assert.rejects(call(),e=>e.code==='42501');assert.deepEqual(await call([snapshot()],S,1),{seen:[APP],changed:[]});
});
test('an absent seeker role or missing account fails even when an application still exists',async()=>{
 const before=await history();await db.query('DELETE FROM job_seeker_profiles WHERE user_id=$1',[S]);await assert.rejects(call(),e=>e.code==='42501');await assert.rejects(call([snapshot()],id(99)),e=>e.code==='42501');assert.deepEqual(await history(),before);
});
test('malformed snapshots and invalid calendar dates cannot write any flag',async()=>{
 const before=await history(),bad=[null,{},[],[null],[{}],[{id:APP,status:'accepted'}],[snapshot('bad')],[snapshot(APP,{forged:true})],[snapshot(APP,'x'.repeat(31))],[snapshot(APP,'accepted',false)],[snapshot(APP,'accepted','now),user_id.neq.null')],[snapshot(APP,'accepted','2026-02-31T10:30:00Z')]];
 for(const value of bad){await assert.rejects(call(value),e=>['22023','22007','22008'].includes(e.code));assert.deepEqual(await history(),before);}
 for(const epoch of [-1])await assert.rejects(call([snapshot()],S,epoch),e=>e.code==='22023');
});
test('duplicate UUIDs are rejected even with different letter casing',async()=>{
 const alpha='abcdef00-0000-4000-8000-000000000010';await db.query('INSERT INTO job_applications(id,job_id,user_id,status,responded_at) VALUES($1,$2,$3,$4,$5)',[alpha,J,S,'accepted',stamp]);
 const before=await history();await assert.rejects(call([snapshot(alpha),snapshot(alpha.toUpperCase())]),e=>e.code==='22023');assert.deepEqual(await history(),before);
});
test('twenty applications are accepted and an oversized batch changes nothing',async()=>{
 const snapshots=[];for(let index=100;index<121;index++){await db.query('INSERT INTO job_applications(id,job_id,user_id,status,responded_at) VALUES($1,$2,$3,$4,$5)',[id(index),J,S,'accepted',stamp]);snapshots.push(snapshot(id(index)));}
 const before=await history();await assert.rejects(call(snapshots),e=>e.code==='22023');assert.deepEqual(await history(),before);
 const result=await call(snapshots.slice(0,20));assert.equal(result.seen.length,20);assert.deepEqual(result.changed,[]);
});
test('a newer employer decision after acknowledgement becomes unread and rejects the previous receipt',async()=>{
 await call();const result=(await db.query("SELECT ishdasiz_application_action($1,0,$2,'interview_set','accepted',$3,$4::jsonb) AS app",[A,APP,stamp,JSON.stringify({interview_date:'2026-10-12T10:30:00+05:00'})])).rows[0].app;
 assert.equal((await history())[0].is_seen_by_job_seeker,false);assert.deepEqual(await call(),{seen:[],changed:[APP]});
 assert.deepEqual(await call([snapshot(APP,result.status,result.responded_at)]),{seen:[APP],changed:[]});
});
test('only the service role executes receipts and the return document contains no contact data',async()=>{
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(call(),e=>e.code==='42501');}finally{await db.exec('RESET ROLE');}}
 await db.exec('SET ROLE service_role');try{assert.deepEqual(await call(),{seen:[APP],changed:[]});}finally{await db.exec('RESET ROLE');}
});
test('reapplying the receipt migration preserves all history and existing flags',async()=>{
 await call();const before=await history();await db.exec(read('20261010190000_application_seen.sql'));assert.deepEqual(await history(),before);assert.deepEqual(await call(),{seen:[APP],changed:[]});
});
