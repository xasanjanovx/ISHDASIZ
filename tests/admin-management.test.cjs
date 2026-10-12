const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations/'+name),'utf8');
const migration=read('20261007102000_admin_management.sql'),access=read('20261007101000_admin_access.sql');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const R=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const profile=(extra={})=>({email:'new.admin@example.test',full_name:'New admin',role:'hokimlik_assistant',district_id:100,...extra});
let db;
const reserve=async(id,actor=A,input=profile(),fingerprint='a'.repeat(64))=>(await db.query('SELECT ishdasiz_admin_reserve_creation($1,$2,$3,$4::jsonb) AS result',[actor,id,fingerprint,JSON.stringify(input)])).rows[0].result;
const complete=async(id,lease,actor=A)=>(await db.query('SELECT ishdasiz_admin_complete_creation($1,$2,$3) AS result',[actor,id,lease])).rows[0].result;
const release=(id,lease,actor=A)=>db.query('SELECT ishdasiz_admin_release_creation($1,$2,$3)',[actor,id,lease]);
const version=async id=>(await db.query('SELECT updated_at::text AS v FROM admin_profiles WHERE id=$1',[id])).rows[0].v;
const update=async(id,action,payload={},actor=A,v)=>(await db.query('SELECT ishdasiz_admin_update_profile($1,$2,$3,$4::jsonb,$5::timestamptz) AS result',[actor,id,action,JSON.stringify(payload),v===undefined?await version(id):v])).rows[0].result;
const list=async(actor=A,page=0,state='all',search='')=>(await db.query('SELECT ishdasiz_admin_list_profiles($1,$2,$3,$4) AS result',[actor,page,state,search])).rows[0].result;
async function authRecord(reservation,id,input=profile(),extra={}){
 await db.query('INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data) VALUES($1,$2,now(),$3::jsonb)',[reservation.target_id,input.email,JSON.stringify({ishdasiz_admin_request:id,ishdasiz_admin_actor:A,...extra})]);
}
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
 CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text UNIQUE,email_confirmed_at timestamptz,raw_app_meta_data jsonb DEFAULT '{}');
 CREATE TABLE regions(id integer PRIMARY KEY,name_uz text,name_ru text);CREATE TABLE districts(id integer PRIMARY KEY,region_id integer REFERENCES regions(id),name_uz text,name_ru text);
 INSERT INTO regions VALUES(1,'Viloyat','Область');INSERT INTO districts VALUES(100,1,'Tuman','Район'),(200,1,'Boshqa tuman','Другой район');
 CREATE TABLE admin_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text NOT NULL,role text NOT NULL CHECK(role IN ('super_admin','hokimlik_assistant')),district_id integer REFERENCES districts(id),created_at timestamptz DEFAULT now());
 INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${A}','owner@example.test',now()),('${B}','second@example.test',now()),('${C}','helper@example.test',now());
 INSERT INTO admin_profiles VALUES('${A}','Owner','super_admin',null,now()),('${B}','Second','super_admin',null,now()),('${C}','Helper','hokimlik_assistant',100,now());
 GRANT ALL ON admin_profiles TO service_role;`);
 // Execute the actual profile columns and clock from the preceding migration.
 await db.exec(access.slice(access.indexOf('BEGIN;'),access.indexOf('CREATE TABLE IF NOT EXISTS public.admin_actions'))+'COMMIT;');await db.exec(migration);
});
after(async()=>{await db?.close();});
test('creation reserves one server target and lease, validates district and does not store a password',async()=>{
 const reserved=await reserve(R(1));assert.ok(reserved.target_id);assert.ok(reserved.lease_id);assert.notEqual(reserved.target_id,R(1));
 await assert.rejects(reserve(R(1)),e=>e.code==='55P03');await assert.rejects(reserve(R(1),B),e=>e.code==='42501');await assert.rejects(reserve(R(1),A,profile(),'b'.repeat(64)),e=>e.code==='40001');
 for(const input of [profile({role:'service_role'}),profile({district_id:null}),profile({district_id:999}),profile({password:'Never stored'}),profile({email:'bad'}),profile({full_name:''})])await assert.rejects(reserve(R(2),A,input),e=>e.code==='22023');
 const row=(await db.query('SELECT * FROM admin_creation_requests WHERE request_id=$1',[R(1)])).rows[0];assert.equal(row.profile.password,undefined);assert.equal(row.state,'reserved');assert.equal((await db.query('SELECT count(*)::integer AS n FROM admin_profiles')).rows[0].n,3);
 await authRecord(reserved,R(1));const created=await complete(R(1),reserved.lease_id);assert.equal(created.id,reserved.target_id);assert.equal(created.email,'new.admin@example.test');assert.equal(created.role,'hokimlik_assistant');assert.equal(created.districts.regions.name_ru,'Область');
 assert.equal((await complete(R(1),reserved.lease_id)).id,created.id);assert.equal((await reserve(R(1))).profile.id,created.id);assert.equal((await db.query("SELECT count(*)::integer AS n FROM admin_profile_actions WHERE action='create'")).rows[0].n,1);
});
test('an expired lease reuses the target, and a stale release cannot unlock or complete a newer attempt',async()=>{
 const input=profile({email:'retry@example.test'}),first=await reserve(R(3),A,input);await db.query("UPDATE admin_creation_requests SET lease_until=clock_timestamp()-interval '1 second' WHERE request_id=$1",[R(3)]);const retry=await reserve(R(3),A,input);
 assert.equal(retry.target_id,first.target_id);assert.notEqual(retry.lease_id,first.lease_id);await release(R(3),first.lease_id);await assert.rejects(reserve(R(3),A,input),e=>e.code==='55P03');await assert.rejects(complete(R(3),first.lease_id),e=>e.code==='40001');
 await authRecord(retry,R(3),input);assert.equal((await complete(R(3),retry.lease_id)).id,first.target_id);
});
test('an unrelated, unconfirmed or absent authentication record cannot receive administrative rights',async()=>{
 const input=profile({email:'identity@example.test'}),reserved=await reserve(R(4),A,input);await assert.rejects(complete(R(4),reserved.lease_id),e=>e.code==='40001');
 await authRecord(reserved,R(4),input,{ishdasiz_admin_actor:B});await assert.rejects(complete(R(4),reserved.lease_id),e=>e.code==='40001');await db.query('UPDATE auth.users SET raw_app_meta_data=$1::jsonb,email_confirmed_at=null WHERE id=$2',[JSON.stringify({ishdasiz_admin_actor:A,ishdasiz_admin_request:R(4)}),reserved.target_id]);await assert.rejects(complete(R(4),reserved.lease_id),e=>e.code==='40001');assert.equal((await db.query('SELECT * FROM admin_profiles WHERE id=$1',[reserved.target_id])).rows.length,0);
});
test('role revocation after auth creation prevents completion and preserves the unprivileged auth record for recovery',async()=>{
 const input=profile({email:'revoked@example.test'}),reserved=await reserve(R(5),A,input);await authRecord(reserved,R(5),input);await db.query('UPDATE admin_profiles SET disabled_at=now() WHERE id=$1',[A]);await assert.rejects(complete(R(5),reserved.lease_id),e=>e.code==='42501');assert.equal((await db.query('SELECT * FROM admin_profiles WHERE id=$1',[reserved.target_id])).rows.length,0);assert.equal((await db.query('SELECT * FROM auth.users WHERE id=$1',[reserved.target_id])).rows.length,1);await db.query('UPDATE admin_profiles SET disabled_at=null WHERE id=$1',[A]);await complete(R(5),reserved.lease_id);
});
test('disable and enable retain profiles and audit once; stale desired retries do not duplicate actions',async()=>{
 const before=await version(C),disabled=await update(C,'disable');assert.ok(disabled.disabled_at);assert.notEqual(await version(C),before);await update(C,'disable',{},A,before);
 assert.equal((await db.query("SELECT count(*)::integer AS n FROM admin_profile_actions WHERE target_id=$1 AND action='disable'",[C])).rows[0].n,1);assert.equal((await list(A,0,'disabled')).total,1);
 const restored=await update(C,'enable');assert.equal(restored.disabled_at,null);assert.equal(restored.district_id,100);assert.equal((await db.query('SELECT * FROM auth.users WHERE id=$1',[C])).rows.length,1);
});
test('editing uses exact microseconds, preserves disabled access and rejects forbidden owner/permission fields',async()=>{
 const old=await version(C);await update(C,'edit',{full_name:'Updated helper',role:'hokimlik_assistant',district_id:200});await assert.rejects(update(C,'edit',{full_name:'Stale',role:'super_admin',district_id:null},A,old),e=>e.code==='40001');
 await update(C,'disable');const edited=await update(C,'edit',{full_name:'Still disabled',role:'super_admin',district_id:null});assert.ok(edited.disabled_at);assert.equal(edited.role,'super_admin');
 await assert.rejects(update(C,'edit',{full_name:'Forged',role:'super_admin',district_id:null,disabled_at:null}),e=>e.code==='22023');await update(C,'edit',{full_name:'Helper',role:'hokimlik_assistant',district_id:100});await update(C,'enable');
});
test('self-disable/demotion and an inactive caller cannot remove the last active super administrator',async()=>{
 await assert.rejects(update(A,'disable'),e=>e.code==='42501');await assert.rejects(update(A,'edit',{full_name:'Owner',role:'hokimlik_assistant',district_id:100}),e=>e.code==='42501');
 await update(B,'disable');await assert.rejects(update(A,'disable',{},B),e=>e.code==='42501');assert.equal((await db.query("SELECT count(*)::integer AS n FROM admin_profiles WHERE role='super_admin' AND disabled_at IS NULL")).rows[0].n,1);await update(B,'enable');
});
test('assistant and unassigned roles cannot list or write admin profiles, including creation and private helpers',async()=>{
 await assert.rejects(list(C),e=>e.code==='42501');await assert.rejects(reserve(R(6),C),e=>e.code==='42501');await assert.rejects(update(B,'disable',{},C),e=>e.code==='42501');
 for(const role of ['anon','authenticated','service_role']){await db.exec(`SET ROLE ${role}`);try{
  await assert.rejects(db.query('SELECT ishdasiz_internal_admin_profile($1)',[A]),e=>e.code==='42501');
  if(role!=='service_role'){await assert.rejects(list(),e=>e.code==='42501');await assert.rejects(reserve(R(7)),e=>e.code==='42501');await assert.rejects(db.query('SELECT * FROM admin_creation_requests'),e=>e.code==='42501');}
  await assert.rejects(db.query('DELETE FROM admin_profile_actions'),e=>e.code==='42501');await assert.rejects(db.query('DELETE FROM admin_creation_requests'),e=>e.code==='42501');
 }finally{await db.exec('RESET ROLE');}}
});
test('audit failure rolls back profile creation and leaves the same reserved auth identity available for retry',async()=>{
 const input=profile({email:'rollback@example.test'}),reserved=await reserve(R(8),A,input);await authRecord(reserved,R(8),input);await db.exec("ALTER TABLE admin_profile_actions ADD CONSTRAINT reject_create CHECK(action<>'create') NOT VALID");await assert.rejects(complete(R(8),reserved.lease_id),e=>e.code==='23514');
 assert.equal((await db.query('SELECT * FROM admin_profiles WHERE id=$1',[reserved.target_id])).rows.length,0);assert.equal((await db.query('SELECT state FROM admin_creation_requests WHERE request_id=$1',[R(8)])).rows[0].state,'reserved');await db.exec('ALTER TABLE admin_profile_actions DROP CONSTRAINT reject_create');await complete(R(8),reserved.lease_id);
 const old=await version(C);await db.exec("ALTER TABLE admin_profile_actions ADD CONSTRAINT reject_disable CHECK(action<>'disable') NOT VALID");await assert.rejects(update(C,'disable'),e=>e.code==='23514');assert.equal(await version(C),old);await db.exec('ALTER TABLE admin_profile_actions DROP CONSTRAINT reject_disable');
});
test('listing is literal, includes real auth emails, pages beyond 1000 and reapplying preserves audits and pending requests',async()=>{
 await db.exec("INSERT INTO auth.users(id,email) SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'helper'||n||'@example.test' FROM generate_series(1,1205) n;INSERT INTO admin_profiles(id,full_name,role,district_id) SELECT id,'Imported helper','hokimlik_assistant',100 FROM auth.users WHERE email LIKE 'helper%@example.test' AND id<>'00000000-0000-4000-8000-000000000003';");
 assert.equal((await list(A,0,'all','helper1205@')).admins[0].email,'helper1205@example.test');assert.equal((await list(A,24,'all','Imported helper')).admins.length,5);assert.equal((await list(A,0,'all','%')).total,0);
 const count=(await db.query('SELECT count(*)::integer AS n FROM admin_profile_actions')).rows[0].n;await db.exec(migration);assert.equal((await db.query('SELECT count(*)::integer AS n FROM admin_profile_actions')).rows[0].n,count);assert.equal((await db.query('SELECT state FROM admin_creation_requests WHERE request_id=$1',[R(4)])).rows[0].state,'reserved');assert.equal((await list(A,0,'all','Imported helper')).total,1205);
});
