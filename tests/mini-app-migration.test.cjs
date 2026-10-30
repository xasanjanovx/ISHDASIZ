const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..'),sql=f=>fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const J='10000000-0000-4000-8000-000000000001',K='10000000-0000-4000-8000-000000000002',R='20000000-0000-4000-8000-000000000001';
let db;
const value=async(text,args=[]) => (await db.query(text,args)).rows[0].v;
const save=(id,kind,user=A,payload={title_uz:'Sotuvchi',company_name:'Synthetic',region_id:1,district_id:10},metadata={position:'Sotuvchi',salaryPeriod:'month'})=>value('SELECT ishdasiz_mini_app_save($1,0,$2,$3,$4,$5) v',[user,id,kind,payload,metadata]);
before(async()=>{
 db=await PGlite.create();await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/legacy-release-baseline.sql'),'utf8'));
 for(const f of ['20260212_add_job_offers.sql','20260217_channel_autopost_outbox.sql','20260409_job_auto_matches_v2.sql'])await db.exec(sql(f));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'supabase/releases/2026-10-repair.json'),'utf8'));
 for(const {file} of manifest.migrations)await db.exec(sql(file));
 await db.exec(sql('20261027090000_main_employer_channel.sql'));await db.exec(sql('20261030120000_mini_app_integration.sql'));
 await db.exec(`INSERT INTO users(id,phone) VALUES('${A}','+998901111111'),('${B}','+998902222222');INSERT INTO employer_profiles(id,user_id) VALUES('${A}','${A}'),('${B}','${B}');INSERT INTO regions VALUES(1,'toshkent-shahri','Toshkent shahri','Ташкент');INSERT INTO districts VALUES(10,1,'Chilonzor','Чиланзар');`);
});
after(async()=>db?.close());
test('website save is atomic, idempotent, owner scoped and never sends a channel post',async()=>{
 assert.equal((await save(J,'vacancy')).id,J);assert.equal((await save(J,'vacancy')).id,J);
 assert.equal(await value('SELECT count(*)::int v FROM jobs WHERE id=$1',[J]),1);
 assert.equal(await value("SELECT ishdasiz_channel_target(ishdasiz_channel_snapshot('job',$1)) v",[J]),null);
 await assert.rejects(save(J,'vacancy',B),/conflict/);
 await assert.rejects(value('SELECT ishdasiz_mini_app_save($1,999,$2,$3,$4,$5) v',[A,K,'vacancy',{},{}]),/Account unavailable/);
 await assert.rejects(save(K,'vacancy',A,{title_uz:'Forged',user_id:B}),/Unknown field/);
 assert.equal(await value('SELECT count(*)::int v FROM jobs WHERE id=$1',[K]),0);
});
test('resume saving always disables channel publication',async()=>{
 await save(R,'resume',B,{title:'Sotuvchi',full_name:'Synthetic candidate',phone:'+998902222222',region_id:1,district_id:10});
 assert.equal(await value('SELECT post_to_channel v FROM resumes WHERE id=$1',[R]),false);
 assert.equal(await value("SELECT ishdasiz_channel_target(ishdasiz_channel_snapshot('resume',$1)) v",[R]),null);
});
test('only one free reservation per account, retries do not duplicate it',async()=>{
 const first=await value('SELECT ishdasiz_mini_app_channel($1,0,$2) v',[A,J]);assert.equal(first.status,'queued');
 assert.deepEqual(await value('SELECT ishdasiz_mini_app_channel($1,0,$2) v',[A,J]),first);
 assert.equal(await value("SELECT ishdasiz_channel_target(ishdasiz_channel_snapshot('job',$1)) v",[J]),'@ishdasiz');
 await save(K,'vacancy');assert.equal((await value('SELECT ishdasiz_mini_app_channel($1,0,$2) v',[A,K])).status,'payment_required');
 assert.equal(await value('SELECT mini_app_channel_requested v FROM jobs WHERE id=$1',[K]),false);
 assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,J]),false);
});
test('actual delivery proof is vacancy scoped, revoked by changed criteria or deleted receipt',async()=>{
 await db.query(`INSERT INTO channel_delivery_receipts(entity_type,entity_id,channel_username,message_id,message_hash,status) VALUES('job',$1,'@ishdasiz',501,repeat('a',64),'active')`,[J]);
 await db.query(`INSERT INTO channel_delivery_intents(entity_type,entity_id,channel_username,event_id,lease_token,snapshot_hash,message_hash) VALUES('job',$1,'@ishdasiz',gen_random_uuid(),gen_random_uuid(),md5(ishdasiz_channel_snapshot('job',$1)::text),repeat('a',64))`,[J]);
 await db.query("UPDATE channel_delivery_intents SET status='confirmed',message_id=501 WHERE entity_id=$1",[J]);
 assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,J]),true);
 assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[B,J]),false);
 assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,K]),false);
 assert.equal(await value('SELECT ishdasiz_mini_app_resume_view($1,0,$2,$3) v',[A,J,R]),true);
 assert.equal(await value('SELECT ishdasiz_mini_app_resume_view($1,0,$2,$3) v',[A,J,R]),true);
 assert.equal(await value('SELECT views_count v FROM resumes WHERE id=$1',[R]),1);
 assert.equal(await value('SELECT ishdasiz_mini_app_resume_view($1,0,$2,$3) v',[A,K,R]),false);
 await db.query('UPDATE jobs SET views_count=views_count+1 WHERE id=$1',[J]);assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,J]),true);
 await db.query('UPDATE jobs SET employer_id=$2 WHERE id=$1',[J,B]);assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,J]),false);await assert.rejects(value('SELECT ishdasiz_mini_app_channel($1,0,$2) v',[A,J]),/Vacancy unavailable/);await db.query('UPDATE jobs SET employer_id=$2 WHERE id=$1',[J,A]);
 await db.query("UPDATE jobs SET title_uz='Buxgalter' WHERE id=$1",[J]);assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,J]),false);
 await db.query("UPDATE jobs SET title_uz='Sotuvchi' WHERE id=$1",[J]);
 await db.query("UPDATE channel_delivery_receipts SET status='deleted' WHERE entity_id=$1",[J]);assert.equal(await value('SELECT ishdasiz_mini_app_candidate_access($1,0,$2) v',[A,J]),false);
});
test('durable AI quota is shared and private tables/functions reject public roles',async()=>{
 const identity='f'.repeat(64);assert.equal(await value('SELECT ishdasiz_mini_app_budget($1) v',[identity]),true);assert.equal(await value('SELECT ishdasiz_mini_app_budget($1) v',[identity]),true);assert.equal(await value('SELECT ishdasiz_mini_app_budget($1) v',[identity]),false);
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(db.exec('SELECT * FROM mini_app_records'),/permission denied/);await assert.rejects(db.query('SELECT ishdasiz_mini_app_candidate_access($1,0,$2)',[A,J]),/permission denied/);}finally{await db.exec('RESET ROLE');}}
});
