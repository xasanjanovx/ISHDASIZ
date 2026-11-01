const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8');
const migration=read('20261101123718_self_hosted_public_api_boundary.sql');
const A='00000000-0000-4000-8000-000000000001',J='10000000-0000-4000-8000-000000000001',K='10000000-0000-4000-8000-000000000002';
let db,initial;
const value=async(q,p=[]) => (await db.query(q,p)).rows[0].v;
const as=async(role,work)=>{await db.exec('SET ROLE '+role);try{return await work();}finally{await db.exec('RESET ROLE');}};
before(async()=>{
 db=await PGlite.create();await db.exec(fs.readFileSync(path.join(__dirname,'fixtures/legacy-release-baseline.sql'),'utf8'));
 for(const f of ['20260212_add_job_offers.sql','20260217_channel_autopost_outbox.sql','20260409_job_auto_matches_v2.sql'])await db.exec(read(f));
 for(const {file} of JSON.parse(fs.readFileSync(path.join(root,'supabase/releases/2026-10-repair.json'),'utf8')).migrations)await db.exec(read(file));
 await db.exec(read('20261027090000_main_employer_channel.sql'));await db.exec(read('20261030120000_mini_app_integration.sql'));
 await db.exec(read('20261101101158_channel_pending_coalescing_and_duplicate_indexes.sql'));
 await db.exec(`INSERT INTO users(id,phone,password_hash) VALUES('${A}','+998901111111','synthetic-private-hash');
 INSERT INTO employer_profiles(id,user_id) VALUES('${A}','${A}');
 INSERT INTO regions VALUES(1,'toshkent-shahri','Toshkent','Ташкент');INSERT INTO districts VALUES(10,1,'Chilonzor','Чиланзар');
 INSERT INTO jobs(id,employer_id,user_id,status,is_active,title_uz,region_id,district_id) VALUES
 ('${J}','${A}','${A}','active',true,'Public job',1,10),('${K}','${A}','${A}','draft',false,'Private draft',1,10);
 CREATE VIEW legacy_user_export AS SELECT id,password_hash FROM users;
 GRANT SELECT ON legacy_user_export TO PUBLIC;
 GRANT SELECT(password_hash),UPDATE(phone) ON users TO anon,authenticated;
 CREATE FUNCTION legacy_private_reader() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT password_hash FROM users LIMIT 1$$;
 CREATE FUNCTION never_public_helper() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
 REVOKE ALL ON FUNCTION never_public_helper() FROM PUBLIC,anon,authenticated,service_role;
 CREATE SEQUENCE boundary_fixture_seq;GRANT USAGE ON SEQUENCE boundary_fixture_seq TO PUBLIC;`);
 initial=await value("SELECT json_build_object('users',(SELECT json_agg(u) FROM users u),'jobs',(SELECT json_agg(j ORDER BY id) FROM jobs j),'events',(SELECT count(*) FROM sync_events)) v");
 await db.exec(migration);
});
after(async()=>db?.close());
for(const role of ['anon','authenticated']){
 test(role+' reads public jobs/references but cannot read private rows, exports or embedded contacts',async()=>{
  await as(role,async()=>{
   assert.deepEqual((await db.query('SELECT id FROM jobs ORDER BY id')).rows.map(x=>x.id),[J]);
   assert.equal(await value('SELECT count(*)::int v FROM regions'),1);
   assert.equal((await value('SELECT ishdasiz_public_home_counts() v')).total,1);
   for(const query of ['SELECT password_hash FROM users','SELECT * FROM resumes','SELECT * FROM legacy_user_export',
    'SELECT u.password_hash FROM jobs j JOIN users u ON u.id=j.user_id','SELECT legacy_private_reader()',
    "UPDATE jobs SET title_uz='Forged'",'SELECT nextval(\'boundary_fixture_seq\')']){
    await assert.rejects(db.exec(query),e=>e.code==='42501');
   }
  });
 });
}
test('column-only grants are also removed and no source business/queue rows change',async()=>{
 assert.equal(await value("SELECT has_column_privilege('anon','users','password_hash','SELECT') v"),false);
 assert.equal(await value("SELECT has_column_privilege('authenticated','users','phone','UPDATE') v"),false);
 assert.deepEqual(await value("SELECT json_build_object('users',(SELECT json_agg(u) FROM users u),'jobs',(SELECT json_agg(j ORDER BY id) FROM jobs j),'events',(SELECT count(*) FROM sync_events)) v"),initial);
});
test('service capability survives PUBLIC revocation without granting already private helpers',async()=>{
 assert.equal(await value("SELECT has_function_privilege('service_role','legacy_private_reader()','EXECUTE') v"),true);
 assert.equal(await value("SELECT has_function_privilege('service_role','never_public_helper()','EXECUTE') v"),false);
 await as('service_role',async()=>assert.equal(await value('SELECT legacy_private_reader() v'),'synthetic-private-hash'));
});
test('reapplication preserves the boundary and the existing service-only Mini App RPCs',async()=>{
 await db.exec(migration);
 assert.equal(await value("SELECT has_function_privilege('anon','ishdasiz_mini_app_save(uuid,integer,uuid,text,jsonb,jsonb)','EXECUTE') v"),false);
 assert.equal(await value("SELECT has_function_privilege('service_role','ishdasiz_mini_app_save(uuid,integer,uuid,text,jsonb,jsonb)','EXECUTE') v"),true);
 assert.equal(await value("SELECT has_function_privilege('service_role','never_public_helper()','EXECUTE') v"),false);
 await as('anon',async()=>assert.deepEqual((await db.query('SELECT id FROM jobs')).rows.map(x=>x.id),[J]));
});
