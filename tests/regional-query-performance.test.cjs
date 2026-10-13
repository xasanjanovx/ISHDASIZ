const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const read=file=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8');
const previous=read('20261010220000_job_work_mode.sql'),migration=read('20261012150000_regional_query_performance.sql');
const start=previous.indexOf('CREATE OR REPLACE FUNCTION public.ishdasiz_job_work_mode(public.jobs)');
const legacy=previous.slice(start,previous.indexOf('REVOKE ALL ON FUNCTION',start)).replace('ishdasiz_job_work_mode(public.jobs)','ishdasiz_old_job_work_mode(public.jobs)');
const values=[null,'','all','0','onsite','home','remote','hybrid',1,2,3,4,'ON_SITE',' Fully_remote ','На месте','Удалённая работа','Гибрид (офис + удалённо)','Masofadan ishlash','ahamiyatga ega emas','not remote','remote / office',true,false,{},[],{mode:'remote'},['remote']];
for(const variant of ['absent','text','jsonb'])test(`optimized work-mode semantics match the previous release with ${variant} legacy work_format`,async()=>{
 const db=await PGlite.create();
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE jobs(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,work_mode text,employment_type text,raw_source_json jsonb,unrelated_description text${variant==='absent'?'':',work_format '+variant});`);
  await db.exec(previous);await db.exec(legacy);
  const cases=[];
  for(const value of values)for(const place of ['work_mode','raw_mode','raw_format','raw_place','legacy'])for(const employment of [null,'remote']){
   const row={employment_type:employment,raw_source_json:{},unrelated_description:'Keep unrelated vacancy data '.repeat(100)};
   if(place==='work_mode')row.work_mode=typeof value==='string'||typeof value==='number'?String(value):value===null?null:JSON.stringify(value);
   else if(place==='legacy'&&variant!=='absent')row.work_format=variant==='jsonb'?value:typeof value==='string'||typeof value==='number'?String(value):value===null?null:JSON.stringify(value);
   else if(place==='raw_mode')row.raw_source_json.work_mode=value;
   else if(place==='raw_format')row.raw_source_json.work_format=value;
   else if(place==='raw_place')row.raw_source_json.workplace_type=value;
   cases.push(row);
  }
  cases.push({work_mode:'onsite',work_format:variant==='jsonb'?'remote':'remote',raw_source_json:{work_mode:'remote'},employment_type:'remote'},
   {work_mode:'all',work_format:variant==='jsonb'?{}:'unknown',raw_source_json:{work_mode:'remote'},employment_type:'remote'},
   {raw_source_json:{work_mode:{},work_format:'remote',workplace_type:'hybrid'},employment_type:'remote'},
   {raw_source_json:{work_mode:'unknown',work_format:'remote'},employment_type:'remote'});
  const compare=async()=>db.query(`SELECT ord FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY inputs(value,ord) WHERE public.ishdasiz_job_work_mode(jsonb_populate_record(NULL::public.jobs,value)) IS DISTINCT FROM public.ishdasiz_old_job_work_mode(jsonb_populate_record(NULL::public.jobs,value))`,[JSON.stringify(cases)]);
  await db.exec("INSERT INTO jobs(work_mode,employment_type,raw_source_json,unrelated_description) VALUES('1','remote','{\"work_mode\":\"remote\"}','Preserve all fields'),(NULL,NULL,'{\"work_format\":\"remote\"}','Preserve raw fields');");
  const before=(await db.query('SELECT * FROM jobs ORDER BY id')).rows;
  await db.exec(migration);
  assert.deepEqual((await compare()).rows,[],`${cases.length} composite input cases must retain the exact old result`);
  assert.deepEqual((await db.query('SELECT * FROM jobs ORDER BY id')).rows,before);
  const flags=(await db.query("SELECT prosecdef,proleakproof,provolatile,proparallel FROM pg_proc WHERE oid='public.ishdasiz_job_work_mode(public.jobs)'::regprocedure")).rows[0];
  assert.deepEqual(flags,{prosecdef:false,proleakproof:false,provolatile:'i',proparallel:'s'});
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('SET ROLE '+role);
   try{assert.equal((await db.query("SELECT public.ishdasiz_job_work_mode(jsonb_populate_record(NULL::public.jobs,'{\"work_mode\":\"remote\"}')) AS mode")).rows[0].mode,'remote');}
   finally{await db.exec('RESET ROLE');}
  }
  await db.exec(migration);
  assert.deepEqual((await compare()).rows,[],'Reapplication preserves the same normalization');
  assert.deepEqual((await db.query('SELECT * FROM jobs ORDER BY id')).rows,before);
 }finally{await db.close();}
});
