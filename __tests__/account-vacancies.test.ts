/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {GET,POST} from '@/app/api/account/vacancies/route';
import {GET as detail,PUT,PATCH} from '@/app/api/account/vacancies/[id]/route';
import {GET as prefill} from '@/app/api/account/vacancies/prefill/route';
import {SESSION_COOKIE,passwordVersion,signAuthToken} from '@/lib/auth/server';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',EA='10000000-0000-4000-8000-000000000001',EB='10000000-0000-4000-8000-000000000002',CATEGORY='20000000-0000-4000-8000-000000000001';
const ID=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const phone='+998901234567',version='2026-10-07T00:00:00.123456Z';
let tables:Record<string,any[]>,queries:any[],faults:any;
function request(path:string,body?:any,authenticated=true,origin?:string) {
 const token=signAuthToken({purpose:'session',userId:A,phone,expiresAt:Date.now()+60000,passwordVersion:passwordVersion('test-hash')});
 return new NextRequest('http://localhost'+path,{method:body===undefined?'GET':'POST',headers:{...(authenticated?{cookie:`${SESSION_COOKIE}=${token}`} :{}),'Content-Type':'application/json',...(origin?{origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const context=(id:string)=>({params:Promise.resolve({id})});
function job(n:number,patch:any={}){return {id:ID(n),title_uz:'Operator',title_ru:'Оператор',description_uz:'Ish tavsifi',description_ru:'Описание работы',company_name:'Saved company',category_id:CATEGORY,region_id:22,district_id:100,contact_phone:phone,contact_telegram:null,work_mode:'onsite',employment_type:'full_time',payment_type:3,experience:'no_experience',education_level:'any',gender:'any',salary_min:null,salary_max:null,age_min:null,age_max:null,latitude:null,longitude:null,languages:[],skills:[],status:'active',is_active:true,user_id:A,created_by:A,employer_id:EA,created_at:'2026-01-01T00:00:00.123456Z',updated_at:version,views_count:3,...patch};}
function body(patch:any={}){return {title_uz:'Operator',description_ru:'Описание работы',category_id:CATEGORY,region_id:22,district_id:100,contact_phone:'90 123 45 67',skills:['Excel'],languages:[{language:'Russian',level:'B2'}],status:'active',request_id:ID(100),...patch};}
function split(value:string){let depth=0,start=0;const values=[];for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&depth===0){values.push(value.slice(start,i));start=i+1;}}values.push(value.slice(start));return values;}
function matches(row:any,expression:string):boolean {
 const group=expression.match(/^(and|or)\((.*)\)$/);if(group){const parts=split(group[2]).map(part=>matches(row,part));return group[1]==='and'?parts.every(Boolean):parts.some(Boolean);}
 const match=expression.match(/^([a-z_]+)\.(eq|neq|is|lt)\.(.*)$/);if(!match)throw new Error('Invalid filter: '+expression);
 const [,key,op,raw]=match,value=raw==='null'?null:raw==='true'?true:raw==='false'?false:raw;
 if(op==='is')return (row[key]??null)===value;if(op==='eq')return row[key]===value;if(op==='neq')return row[key]!=null&&row[key]!==value;return row[key]!=null&&row[key]<value;
}
beforeEach(()=>{
 process.env.AUTH_SESSION_SECRET='synthetic-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';queries=[];faults={};
 tables={users:[{id:A,phone,password_hash:'test-hash',closed_at:null,session_version:0}],employer_profiles:[{id:EA,user_id:A,company_name:'Saved company',phone,telegram:'company',region_id:22,district_id:100,address:'Address'}],regions:[{id:22}],districts:[{id:100,region_id:22,name_uz:'Tuman'}],categories:[{id:CATEGORY}],jobs:[],job_applications:[]};
 const client={from:(table:string)=>{
  const q:any={table,filters:[],orders:[],ors:[],operation:'read',head:false};queries.push(q);const chain:any={};
  chain.select=(fields:string,opts:any={})=>{q.fields=fields;q.head=opts.head||false;return chain;};
  for(const method of ['eq','is','in'])chain[method]=(key:string,value:any)=>{q.filters.push({method,key,value});return chain;};
  chain.or=(value:string)=>{q.ors.push(value);q.or=value;return chain;};chain.order=(key:string,opts:any={})=>{q.orders.push({key,ascending:opts.ascending!==false});return chain;};
  chain.limit=(n:number)=>{q.limit=n;return chain;};chain.range=(start:number,end:number)=>{q.start=start;q.limit=end-start+1;return chain;};
  chain.insert=(payload:any)=>{q.operation='insert';q.payload=payload;return chain;};chain.update=(payload:any)=>{q.operation='update';q.payload=payload;return chain;};
  const execute=()=>{
   if(faults[table]||q.head&&faults.counts)return {data:null,error:{code:'08006'},count:null};
   if(q.operation==='update')faults.beforeUpdate?.();
   let rows=(tables[table]||[]).filter(row=>q.filters.every(({method,key,value}:any)=>method==='in'?value.includes(row[key]):method==='is'?(row[key]??null)===value:row[key]===value)).filter(row=>!q.or||split(q.or).some(part=>matches(row,part)));
   const count=rows.length;
   if(q.operation==='insert'){
    if(q.payload.description_uz==null||q.payload.description_ru==null||typeof q.payload.payment_type!=='number')return {data:null,error:{code:'23502'}};
    if((tables[table]||[]).some(row=>row.id===q.payload.id))return {data:null,error:{code:'23505'}};
    const saved={...q.payload,updated_at:version,created_at:version};tables[table].push(saved);rows=[saved];
   }
   if(q.operation==='update')rows.forEach(row=>Object.assign(row,q.payload));
   for(const {key,ascending} of [...q.orders].reverse())rows=[...rows].sort((a,b)=>a[key]===b[key]?0:(a[key]>b[key]?1:-1)*(ascending?1:-1));
   if(q.limit!=null)rows=rows.slice(q.start||0,(q.start||0)+q.limit);
   return {data:q.head||faults.emptySave&&q.operation!=='read'?null:rows.map(row=>({...row})),error:null,count};
  };
  chain.then=(resolve:any,reject:any)=>Promise.resolve().then(execute).then(resolve,reject);
  chain.maybeSingle=async()=>{const result=execute();return {...result,data:result.data?.[0]??null};};chain.single=chain.maybeSingle;return chain;
 }};(createClient as jest.Mock).mockReturnValue(client);
});
test('signed sessions and an employer profile are required; closed accounts cannot write',async()=>{
 expect((await GET(request('/api/account/vacancies',undefined,false))).status).toBe(401);expect(queries).toHaveLength(0);
 tables.employer_profiles=[];expect((await GET(request('/api/account/vacancies'))).status).toBe(403);
 tables.users[0].closed_at=version;expect((await POST(request('/api/account/vacancies',body()))).status).toBe(401);expect(tables.jobs).toHaveLength(0);
});
test('canonical ownership excludes jobs assigned to another company and jobs with a different user despite the old creator',async()=>{
 tables.jobs=[job(1,{user_id:B,created_by:B}),job(2,{employer_id:EB}),job(3,{employer_id:null}),job(4,{employer_id:null,user_id:null}),job(5,{employer_id:null,user_id:B})];
 const response=await GET(request('/api/account/vacancies'));expect(response.status).toBe(200);const data=await response.json();expect(data.vacancies.map((row:any)=>row.id)).toEqual([ID(4),ID(3),ID(1)]);
 expect(data.stats.all).toBe(3);expect(JSON.stringify(data)).not.toMatch(/user_id|created_by|employer_id|password_hash/);
 expect((await detail(request('/api/account/vacancies/'+ID(2)),context(ID(2)))).status).toBe(404);
});
test('keyset paging retains ownership in one root or and does not lose equal microsecond timestamps',async()=>{
 tables.jobs=Array.from({length:115},(_,index)=>job(index+1));tables.jobs.push(job(500,{employer_id:EB}));
 let cursor:string|null=null;const ids:string[]=[];
 do {const response=await GET(request('/api/account/vacancies'+(cursor?'?before='+cursor:'')));expect(response.status).toBe(200);const data=await response.json();ids.push(...data.vacancies.map((row:any)=>row.id));cursor=data.nextCursor;}while(cursor);
 expect(ids).toHaveLength(115);expect(new Set(ids).size).toBe(115);expect(ids).not.toContain(ID(500));
 for(const q of queries.filter(q=>q.table==='jobs'&&q.limit===51)){expect(q.ors).toHaveLength(1);expect(q.or).toContain('or(employer_id.eq.'+EA);}
 expect(queries.find(q=>q.table==='jobs'&&q.or?.includes('created_at.lt.')).or).toContain('.123456Z');
});
test('filters and counts distinguish published, hidden, filled and archived records',async()=>{
 tables.jobs=[job(1),job(2,{status:'active',is_active:false}),job(3,{status:'filled',is_active:false}),job(4,{status:'archived',is_active:false}),job(5,{status:null,is_active:false})];
 const response=await GET(request('/api/account/vacancies?state=draft'));const data=await response.json();expect(data.vacancies.map((row:any)=>row.id)).toEqual([ID(5),ID(2)]);expect(data.stats).toEqual({all:5,active:1,draft:2,filled:1,archived:1});
 expect((await GET(request('/api/account/vacancies?state=forged'))).status).toBe(400);
});
test('application counts continue after the database row cap and exclude foreign job IDs',async()=>{
 tables.jobs=[job(1)];tables.job_applications=Array.from({length:1205},(_,i)=>({id:ID(i+1),job_id:ID(1)}));tables.job_applications.push({id:ID(5000),job_id:ID(99)});
 const data=await (await GET(request('/api/account/vacancies'))).json();expect(data.vacancies[0].applications_count).toBe(1205);expect(queries.filter(q=>q.table==='job_applications').map(q=>q.start)).toEqual([0,500,1000]);
});
test('counter failures keep the vacancy list usable and never report fake zero counts',async()=>{
 tables.jobs=[job(1)];faults.job_applications=true;faults.counts=true;const response=await GET(request('/api/account/vacancies'));const data=await response.json();expect(response.status).toBe(200);expect(data.vacancies[0].applications_count).toBeNull();expect(data.stats).toBeNull();expect(data.counts_error&&data.stats_error).toBe(true);
 faults.jobs=true;expect((await GET(request('/api/account/vacancies'))).status).toBe(503);
});
test('creation derives owner, company and source, normalizes phone and fills the absent second language',async()=>{
 const response=await POST(request('/api/account/vacancies',body({user_id:B,employer_id:EB,created_by:B,company_name:'Forged',source:'admin',is_employer_verified:true,password_hash:'fake'})));expect(response.status).toBe(201);
 const saved=tables.jobs[0];expect(saved).toMatchObject({user_id:A,employer_id:EA,created_by:A,company_name:'Saved company',source:'website',status:'active',is_active:true,contact_phone:phone,title_ru:'Operator',description_uz:'Описание работы'});expect(saved).not.toHaveProperty('password_hash');expect(saved).not.toHaveProperty('is_employer_verified');
});
test('a partial draft saves privately; publishing it requires complete validated content',async()=>{
  const response=await POST(request('/api/account/vacancies',body({status:'draft',description_ru:'',contact_phone:'',category_id:null,region_id:null,district_id:null})));expect(response.status).toBe(201);expect(tables.jobs[0]).toMatchObject({is_active:false,description_uz:'',description_ru:''});
 expect((await PATCH(request('/api/account/vacancies/'+ID(100),{action:'publish',expected_updated_at:version}),context(ID(100)))).status).toBe(400);expect(tables.jobs[0].status).toBe('draft');
});
test('payment options use the live integer column and the experience labels used by the public catalog',async()=>{
 const response=await POST(request('/api/account/vacancies',body({payment_type:'2',experience:'1_3_years'})));expect(response.status).toBe(201);expect(tables.jobs[0]).toMatchObject({payment_type:2,experience:'1_3_years'});
 const second=await POST(request('/api/account/vacancies',body({request_id:ID(101),payment_type:'1',salary_min:100,salary_max:200})));expect(second.status).toBe(201);expect(tables.jobs[1]).toMatchObject({payment_type:1,salary_min:100,salary_max:200});
 expect((await POST(request('/api/account/vacancies',body({request_id:ID(102),payment_type:'hourly'})))).status).toBe(400);
});
test.each([{salary_min:10,salary_max:5},{age_min:15},{age_max:101},{region_id:999},{region_id:22,district_id:101},{latitude:91,longitude:70},{latitude:40,longitude:null},{category_id:ID(55)},{contact_phone:'+79012345678'},{contact_telegram:'a'},{skills:[{}]},{languages:[{language:'Uzbek',level:'forged'}]}])('invalid vacancy values cause no insert: %j',async(patch)=>{
 expect((await POST(request('/api/account/vacancies',body(patch)))).status).toBe(400);expect(tables.jobs).toHaveLength(0);
});
test('remote work does not require a map or fake location, and coordinates including zero are preserved',async()=>{
 const response=await POST(request('/api/account/vacancies',body({work_mode:'remote',region_id:null,district_id:null,latitude:0,longitude:0})));expect(response.status).toBe(201);expect(tables.jobs[0]).toMatchObject({region_id:null,district_id:null,latitude:0,longitude:0});
});
test('a retried identical request does not create duplicates, while changed content is a conflict',async()=>{
 expect((await POST(request('/api/account/vacancies',body()))).status).toBe(201);expect((await POST(request('/api/account/vacancies',body()))).status).toBe(201);expect(tables.jobs).toHaveLength(1);
 expect((await POST(request('/api/account/vacancies',body({title_uz:'Changed'})))).status).toBe(409);expect(tables.jobs[0].title_uz).toBe('Operator');
});
test('edits and status changes repeat owner assignment and version checks at UPDATE time',async()=>{
 tables.jobs=[job(1)];faults.beforeUpdate=()=>{tables.jobs[0].employer_id=EB;};
 const response=await PATCH(request('/api/account/vacancies/'+ID(1),{action:'archive',expected_updated_at:version}),context(ID(1)));expect(response.status).toBe(409);expect(tables.jobs[0].status).toBe('active');
 const q=queries.find(q=>q.operation==='update');expect(q.filters).toContainEqual({method:'eq',key:'employer_id',value:EA});expect(q.filters).toContainEqual({method:'eq',key:'updated_at',value:version});
});
test('editing does not implicitly publish or replace unknown legacy options, skills or languages',async()=>{
 tables.jobs=[job(1,{status:'draft',is_active:false,experience:'legacy_experience',skills:[{name:'Excel',level:'old'}],languages:['Russian']})];
 const saved=tables.jobs[0],payload=body({...saved,skills:['Excel'],languages:[{language:'Russian',level:''}],title_uz:'Edited',expected_updated_at:version,status:'active',is_active:true});
 const response=await PUT(request('/api/account/vacancies/'+ID(1),payload),context(ID(1)));expect(response.status).toBe(200);expect(tables.jobs[0]).toMatchObject({status:'draft',is_active:false,title_uz:'Edited',experience:'legacy_experience',skills:[{name:'Excel',level:'old'}],languages:['Russian']});
});
test('archive and restore preserve the job and application history and restore privately',async()=>{
 tables.jobs=[job(1)];tables.job_applications=[{id:ID(2),job_id:ID(1)}];
 let response=await PATCH(request('/api/account/vacancies/'+ID(1),{action:'archive',expected_updated_at:version}),context(ID(1)));expect(response.status).toBe(200);const archived=(await response.json()).vacancy;
 response=await PATCH(request('/api/account/vacancies/'+ID(1),{action:'restore',expected_updated_at:archived.updated_at}),context(ID(1)));expect(response.status).toBe(200);expect(tables.jobs[0]).toMatchObject({status:'draft',is_active:false});expect(tables.jobs).toHaveLength(1);expect(tables.job_applications).toHaveLength(1);
});
test('stale timestamps, foreign origin and missing save results cannot report success',async()=>{
 tables.jobs=[job(1)];expect((await PATCH(request('/api/account/vacancies/'+ID(1),{action:'filled',expected_updated_at:'2026-10-07T00:00:00Z'}),context(ID(1)))).status).toBe(409);
 expect((await POST(request('/api/account/vacancies',body(),true,'https://foreign.example'))).status).toBe(403);faults.emptySave=true;expect((await POST(request('/api/account/vacancies',body()))).status).toBe(503);
});
test('prefill returns current employer contacts and location without private identifiers',async()=>{
 const response=await prefill(request('/api/account/vacancies/prefill'));expect(response.status).toBe(200);const data=await response.json();expect(data.employer).toMatchObject({company_name:'Saved company',contact_phone:phone,region_id:22,district_id:100});expect(JSON.stringify(data)).not.toMatch(/user_id|password_hash|session_version/);
});
