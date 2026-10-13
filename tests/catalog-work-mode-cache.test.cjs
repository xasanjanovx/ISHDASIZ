const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
const old=read('20261010220000_job_work_mode.sql'),optimized=read('20261012150000_regional_query_performance.sql'),cached=read('20261013100000_catalog_work_mode_cache.sql');
const modes=[null,'','all','0','onsite','home','remote','hybrid',1,2,3,4,'ON_SITE',' Fully_remote ','На месте','Удалённая работа','Гибрид (офис + удалённо)','Masofadan ishlash','ahamiyatga ega emas','unknown',true,false,{},[],{mode:'remote'},['remote']];
for(const variant of ['absent','text','jsonb'])test(`stored catalogue mode preserves all source priorities with ${variant} work_format`,async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
  CREATE TABLE jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),work_mode text,employment_type text,raw_source_json jsonb,is_active boolean DEFAULT true,status text DEFAULT 'active',source_status text,region_id integer,district_id integer,employer_id uuid,user_id uuid,created_by uuid,views_count integer DEFAULT 0,updated_at timestamptz DEFAULT now(),unrelated_description text${variant==='absent'?'':',work_format '+variant});
  GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;GRANT SELECT,INSERT,UPDATE ON jobs TO anon,authenticated,service_role;`);
  await db.exec(old);await db.exec(optimized);
  const cases=[];
  for(const value of modes)for(const place of ['work_mode','raw_mode','raw_format','raw_place','legacy'])for(const employment of [null,'remote']){
   const row={employment_type:employment,raw_source_json:{},unrelated_description:'Synthetic unrelated data '.repeat(30)};
   if(place==='work_mode')row.work_mode=typeof value==='string'||typeof value==='number'?String(value):value===null?null:JSON.stringify(value);
   else if(place==='legacy'&&variant!=='absent')row.work_format=variant==='jsonb'?value:typeof value==='string'||typeof value==='number'?String(value):value===null?null:JSON.stringify(value);
   else if(place==='raw_mode')row.raw_source_json.work_mode=value;
   else if(place==='raw_format')row.raw_source_json.work_format=value;
   else if(place==='raw_place')row.raw_source_json.workplace_type=value;
   cases.push(row);
  }
  cases.push({work_mode:'onsite',raw_source_json:{work_mode:'remote'},employment_type:'remote'},{work_mode:'unknown',raw_source_json:{work_mode:'remote'},employment_type:'remote'});
  const columns=['work_mode','employment_type','raw_source_json','unrelated_description',...(variant==='absent'?[]:['work_format'])].join(',');
  await db.query(`INSERT INTO jobs(${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::jobs,$1::jsonb)`,[JSON.stringify(cases)]);
  const before=(await db.query('SELECT id,to_jsonb(j) data,ishdasiz_job_work_mode(j) mode FROM jobs j ORDER BY id')).rows;
  await db.exec(cached);
  const snapshot=()=>db.query("SELECT id,to_jsonb(j)-'ishdasiz_catalog_work_mode' data,ishdasiz_job_work_mode(j) mode FROM jobs j ORDER BY id");
  assert.deepEqual((await snapshot()).rows,before,'Backfill must preserve every original field and computed result');
  await db.exec(cached);
  assert.deepEqual((await snapshot()).rows,before,'Reapplication must preserve original rows and results');
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('SET ROLE '+role);
   try{
    const id=(await db.query("INSERT INTO jobs(work_mode,employment_type,raw_source_json,ishdasiz_catalog_work_mode) VALUES('onsite','remote','{}','remote') RETURNING id")).rows[0].id;
    assert.equal((await db.query('SELECT ishdasiz_job_work_mode(j) mode FROM jobs j WHERE id=$1',[id])).rows[0].mode,'onsite');
    await db.query("UPDATE jobs SET work_mode=NULL,raw_source_json='{\"workplace_type\":\"Удалённая работа\"}',ishdasiz_catalog_work_mode='onsite' WHERE id=$1",[id]);
    assert.equal((await db.query('SELECT ishdasiz_job_work_mode(j) mode FROM jobs j WHERE id=$1',[id])).rows[0].mode,'remote');
    await db.query("UPDATE jobs SET views_count=views_count+1,ishdasiz_catalog_work_mode='hybrid' WHERE id=$1",[id]);
    assert.equal((await db.query('SELECT ishdasiz_job_work_mode(j) mode FROM jobs j WHERE id=$1',[id])).rows[0].mode,'remote');
   }finally{await db.exec('RESET ROLE');}
  }
  const flags=(await db.query("SELECT prosecdef,proleakproof,provolatile,proparallel,proconfig FROM pg_proc WHERE oid='public.ishdasiz_job_work_mode(public.jobs)'::regprocedure")).rows[0];
  assert.deepEqual(flags,{prosecdef:false,proleakproof:false,provolatile:'i',proparallel:'s',proconfig:null});
  assert.equal((await db.query("SELECT attgenerated FROM pg_attribute WHERE attrelid='jobs'::regclass AND attname='ishdasiz_catalog_work_mode'")).rows[0].attgenerated,'');
 }finally{await db.close();}
});
