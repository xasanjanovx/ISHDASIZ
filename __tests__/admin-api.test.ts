/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {GET,POST} from '@/app/api/admin/jobs/route';
import {GET as detail,PUT,PATCH} from '@/app/api/admin/jobs/[id]/route';
import {GET as prefill} from '@/app/api/admin/jobs/prefill/route';
import {GET as applicationsGET} from '@/app/api/admin/applications/route';
import {GET as statsGET} from '@/app/api/admin/stats/route';
import {GET as sessionGET} from '@/app/api/admin/session/route';
import {POST as aiPOST} from '@/app/api/admin/ai/vacancy-helper/route';
import {callDeepSeekText} from '@/lib/ai/deepseek';
jest.mock('@/lib/ai/deepseek',()=>({callDeepSeekText:jest.fn()}));
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',EA='10000000-0000-4000-8000-000000000001',EB='10000000-0000-4000-8000-000000000002',CATEGORY='20000000-0000-4000-8000-000000000001';
const ID=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const phone='+998901234567',version='2026-10-07T00:00:00.123456Z';
let tables:Record<string,any[]>,queries:any[],faults:any,identity:any;const rpc=jest.fn(),getUser=jest.fn();
function request(path:string,body?:any,authenticated=true,origin?:string) {
 return new NextRequest('http://localhost'+path,{method:body===undefined?'GET':'POST',headers:{...(authenticated?{authorization:'Bearer verified-token'}:{cookie:'ishdasiz_session=ordinary-session'}),'Content-Type':'application/json',...(origin?{origin}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const context=(id:string)=>({params:Promise.resolve({id})});
function job(n:number,patch:any={}){return {id:ID(n),title_uz:'Operator',title_ru:'Оператор',description_uz:'Ish tavsifi',description_ru:'Описание работы',company_name:'Saved company',category_id:CATEGORY,region_id:22,district_id:100,contact_phone:phone,contact_telegram:null,work_mode:'onsite',employment_type:'full_time',payment_type:3,experience:'no_experience',education_level:'any',gender:'any',salary_min:null,salary_max:null,age_min:null,age_max:null,latitude:null,longitude:null,languages:[],skills:[],status:'active',is_active:true,user_id:A,created_by:A,employer_id:EA,created_at:'2026-01-01T00:00:00.123456Z',updated_at:version,views_count:3,...patch};}
function body(patch:any={}){return {company_name:'Admin company',title_uz:'Operator',description_ru:'Описание работы',category_id:CATEGORY,region_id:22,district_id:100,contact_phone:'90 123 45 67',skills:['Excel'],languages:[{language:'Russian',level:'B2'}],status:'active',request_id:ID(100),...patch};}
function split(value:string){let depth=0,start=0,quoted=false;const values=[];for(let i=0;i<value.length;i++){if(quoted&&value[i]==='\\'){i++;continue;}if(value[i]==='"')quoted=!quoted;if(quoted)continue;if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&depth===0){values.push(value.slice(start,i));start=i+1;}}values.push(value.slice(start));return values;}
function matches(row:any,expression:string):boolean {
 const group=expression.match(/^(and|or)\((.*)\)$/);if(group){const parts=split(group[2]).map(part=>matches(row,part));return group[1]==='and'?parts.every(Boolean):parts.some(Boolean);}
 const match=expression.match(/^([a-z_]+)\.(eq|neq|is|lt|imatch)\.(.*)$/);if(!match)throw new Error('Invalid filter: '+expression);
 const [,key,op,raw]=match,value=raw==='null'?null:raw==='true'?true:raw==='false'?false:raw;
 if(op==='imatch')return row[key]!=null&&new RegExp(JSON.parse(raw),'i').test(row[key]);
 if(op==='is')return (row[key]??null)===value;if(op==='eq')return row[key]===value;if(op==='neq')return row[key]!=null&&row[key]!==value;return row[key]!=null&&row[key]<value;
}
beforeEach(()=>{
 process.env.AUTH_SESSION_SECRET='synthetic-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';queries=[];faults={};identity={id:A,email:'admin@example.test'};rpc.mockReset();getUser.mockReset();getUser.mockImplementation(async()=>({data:{user:identity},error:faults.auth||null}));process.env.DEEPSEEK_API_KEY='synthetic-key';(callDeepSeekText as jest.Mock).mockReset();(callDeepSeekText as jest.Mock).mockResolvedValue('Draft text');
 tables={admin_profiles:[{id:A,role:'hokimlik_assistant',district_id:100,disabled_at:null,updated_at:version,full_name:'Admin',private_note:'secret'}],users:[{id:A,phone,password_hash:'test-hash',closed_at:null,session_version:0}],employer_profiles:[{id:EA,user_id:A,company_name:'Saved company',phone,telegram:'company',region_id:22,district_id:100,address:'Address'}],regions:[{id:22}],districts:[{id:100,region_id:22,name_uz:'Tuman'}],categories:[{id:CATEGORY}],jobs:[],job_applications:[]};
 rpc.mockImplementation(async(name:string,args:any)=>faults.rpc?{error:{code:faults.rpc},data:null}:name==='ishdasiz_reserve_admin_vacancy_ai'?{data:2,error:null}:{data:{...job(100),...args.p_payload,id:args.p_job_id},error:null});
 const client={auth:{getUser},rpc,from:(table:string)=>{
  const q:any={table,filters:[],orders:[],ors:[],operation:'read',head:false};queries.push(q);const chain:any={};
  chain.select=(fields:string,opts:any={})=>{q.fields=fields;q.head=opts.head||false;return chain;};
  for(const method of ['eq','is','in'])chain[method]=(key:string,value:any)=>{q.filters.push({method,key,value});return chain;};
  chain.or=(value:string)=>{q.ors.push(value);q.or=value;return chain;};chain.order=(key:string,opts:any={})=>{q.orders.push({key,ascending:opts.ascending!==false,nullsFirst:opts.nullsFirst!==false});return chain;};
  chain.limit=(n:number)=>{q.limit=n;return chain;};chain.range=(start:number,end:number)=>{q.start=start;q.limit=end-start+1;return chain;};
  chain.insert=(payload:any)=>{q.operation='insert';q.payload=payload;return chain;};chain.update=(payload:any)=>{q.operation='update';q.payload=payload;return chain;};
  const execute=()=>{
   if(faults.columns&&table==='admin_profiles'){const missing=faults.columns.find((c:string)=>q.fields.split(',').includes(c));if(missing)return {data:null,error:{code:'42703',message:'column '+missing+' does not exist'}};}
   if(faults[table]||q.head&&faults.counts)return {data:null,error:{code:'08006'},count:null};
   if(q.operation==='update')faults.beforeUpdate?.();
   let rows=(tables[table]||[]).map(row=>q.fields.includes('jobs!inner')?{...row,jobs:tables.jobs.find(job=>job.id===row.job_id)||null}:row).filter(row=>!q.fields.includes('jobs!inner')||row.jobs).filter(row=>q.filters.every(({method,key,value}:any)=>method==='in'?value.includes(row[key]):method==='is'?(row[key]??null)===value:key.split('.').reduce((v:any,k:string)=>v?.[k],row)===value)).filter(row=>!q.or||split(q.or).some(part=>matches(row,part)));
   const count=rows.length;
   if(q.operation==='insert'){
    if(q.payload.description_uz==null||q.payload.description_ru==null||typeof q.payload.payment_type!=='number')return {data:null,error:{code:'23502'}};
    if((tables[table]||[]).some(row=>row.id===q.payload.id))return {data:null,error:{code:'23505'}};
    const saved={...q.payload,updated_at:version,created_at:version};tables[table].push(saved);rows=[saved];
   }
   if(q.operation==='update')rows.forEach(row=>Object.assign(row,q.payload));
   for(const {key,ascending,nullsFirst} of [...q.orders].reverse())rows=[...rows].sort((a,b)=>a[key]===b[key]?0:a[key]==null?(nullsFirst?-1:1):b[key]==null?(nullsFirst?1:-1):(a[key]>b[key]?1:-1)*(ascending?1:-1));
   if(q.limit!=null)rows=rows.slice(q.start||0,(q.start||0)+q.limit);
   return {data:q.head||faults.emptySave&&q.operation!=='read'?null:rows.map(row=>table==='admin_profiles'?Object.fromEntries(q.fields.split(',').map((key:string)=>[key,row[key]])):{...row}),error:null,count};
  };
  chain.then=(resolve:any,reject:any)=>Promise.resolve().then(execute).then(resolve,reject);
  chain.maybeSingle=async()=>{const result=execute();return {...result,data:result.data?.[0]??null};};chain.single=chain.maybeSingle;return chain;
 }};(createClient as jest.Mock).mockReturnValue(client);
});
test('admin endpoints accept only a verified bearer identity, never a phone account cookie or a browser role',async()=>{
 expect((await GET(request('/api/admin/jobs',undefined,false))).status).toBe(401);expect(getUser).not.toHaveBeenCalled();
 expect((await sessionGET(request('/api/admin/session'))).status).toBe(200);expect(getUser).toHaveBeenCalledWith('verified-token');
 identity={id:B,user_metadata:{role:'super_admin'}};expect((await GET(request('/api/admin/jobs'))).status).toBe(403);
 identity=null;expect((await GET(request('/api/admin/jobs'))).status).toBe(401);
});
test('expired credentials are denied, while authentication and permission outages remain retryable failures',async()=>{
 faults.auth={status:401};expect((await GET(request('/api/admin/jobs'))).status).toBe(401);
 for(const status of [0,500,503]){faults.auth={status};expect((await GET(request('/api/admin/jobs'))).status).toBe(503);}
 faults.auth=null;faults.admin_profiles=true;expect((await GET(request('/api/admin/jobs'))).status).toBe(503);expect(rpc).not.toHaveBeenCalled();
});
test('missing updated_at never drops an existing disabled_at; legacy fallback returns only explicit profile fields',async()=>{
 faults.columns=['updated_at'];tables.admin_profiles[0].disabled_at=version;expect((await sessionGET(request('/api/admin/session'))).status).toBe(403);
 tables.admin_profiles[0].disabled_at=null;faults.columns=['disabled_at','updated_at'];const response=await sessionGET(request('/api/admin/session'));expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(JSON.stringify(await response.json())).not.toContain('private_note');
});
test('assistant lists, detail, cursor anchors, totals and prefill retain the assigned district',async()=>{
 tables.jobs=[job(1),job(2,{district_id:200}),job(3,{district_id:null})];const data=await (await GET(request('/api/admin/jobs'))).json();expect(data.vacancies.map((r:any)=>r.id)).toEqual([ID(1)]);expect(data.stats.all).toBe(1);expect(JSON.stringify(data)).not.toMatch(/user_id|created_by|employer_id|password_hash/);
 expect((await detail(request('/api/admin/jobs/'+ID(2)),context(ID(2)))).status).toBe(404);expect((await GET(request('/api/admin/jobs?before='+ID(2)))).status).toBe(404);
 expect((await (await prefill(request('/api/admin/jobs/prefill'))).json()).employer).toEqual({company_name:'',region_id:22,district_id:100});
 for(const q of queries.filter(q=>q.table==='jobs'))expect(q.filters).toContainEqual({method:'eq',key:'district_id',value:100});
});
test('legacy published, open and null statuses keep active filters consistent with the public catalogue',async()=>{
 tables.jobs=[job(1,{status:'published'}),job(2,{status:'open'}),job(3,{status:null}),job(4,{status:null,is_active:false}),job(5,{status:'unknown',is_active:true})];
 const active=await (await GET(request('/api/admin/jobs?state=active'))).json();expect(active.vacancies.map((r:any)=>r.id)).toEqual([ID(3),ID(2),ID(1)]);expect(active.stats.active).toBe(3);
 const draft=await (await GET(request('/api/admin/jobs?state=draft'))).json();expect(draft.vacancies.map((r:any)=>r.id)).toEqual([ID(5),ID(4)]);
});
test('a super admin has national scope, but unknown, disabled or unassigned assistants cannot load jobs',async()=>{
 tables.admin_profiles[0].role='super_admin';tables.jobs=[job(1),job(2,{district_id:200}),job(3,{district_id:null})];expect((await (await GET(request('/api/admin/jobs'))).json()).stats.all).toBe(3);
 for(const extra of [{role:'unknown'},{role:'hokimlik_assistant',district_id:null},{role:'hokimlik_assistant',district_id:0},{role:'super_admin',disabled_at:version}]){Object.assign(tables.admin_profiles[0],extra);expect((await GET(request('/api/admin/jobs'))).status).toBe(403);}
});
test('keyset paging covers equal microseconds and null dates without losing district scope or duplicating rows',async()=>{
 tables.jobs=Array.from({length:112},(_,i)=>job(i+1,{created_at:i<60?version:null}));tables.jobs.push(job(500,{district_id:200}));let cursor:string|null=null;const ids:string[]=[];
 do{const response=await GET(request('/api/admin/jobs'+(cursor?'?before='+cursor:'')));expect(response.status).toBe(200);const page=await response.json();ids.push(...page.vacancies.map((row:any)=>row.id));cursor=page.nextCursor;}while(cursor);
 expect(ids).toHaveLength(112);expect(new Set(ids).size).toBe(112);expect(ids).not.toContain(ID(500));expect(queries.filter(q=>q.table==='jobs'&&q.limit===51).every(q=>q.ors.length<=1)).toBe(true);
});
test('application totals continue beyond 1000 and failed counters do not fabricate zeros or hide editable jobs',async()=>{
 tables.jobs=[job(1)];tables.job_applications=Array.from({length:1205},(_,i)=>({id:ID(i+1),job_id:ID(1)}));expect((await (await GET(request('/api/admin/jobs'))).json()).vacancies[0].applications_count).toBe(1205);
 faults.job_applications=true;faults.counts=true;const page=await (await GET(request('/api/admin/jobs'))).json();expect(page.vacancies[0].applications_count).toBeNull();expect(page.stats).toBeNull();expect(page.counts_error&&page.stats_error).toBe(true);
});
test('creating a validated draft sends only business fields to the atomic write and never assigns an auth admin as account owner',async()=>{
 const response=await POST(request('/api/admin/jobs',body({status:'draft',user_id:B,created_by:A,employer_id:EB,source:'foreign',is_active:true})));expect(response.status).toBe(201);
 const [name,args]=rpc.mock.calls[0];expect(name).toBe('ishdasiz_admin_write_vacancy');expect(args).toMatchObject({p_admin_id:A,p_job_id:ID(100),p_action:'create',p_expected_version:null,p_payload:{status:'draft',is_active:false,company_name:'Admin company',payment_type:3,contact_phone:phone,description_uz:'Описание работы'}});
 expect(args.p_payload).not.toHaveProperty('user_id');expect(args.p_payload).not.toHaveProperty('created_by');expect(args.p_payload).not.toHaveProperty('employer_id');expect(args.p_payload).not.toHaveProperty('source');
});
test('invalid location, cross-district assignment and unsafe origins do not write anything',async()=>{
 tables.districts.push({id:200,region_id:22});expect((await POST(request('/api/admin/jobs',body({district_id:200})))).status).toBe(403);expect((await POST(request('/api/admin/jobs',body({category_id:'forged'})))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
 getUser.mockClear();expect((await POST(request('/api/admin/jobs',body(),true,'https://foreign.test'))).status).toBe(403);expect(getUser).not.toHaveBeenCalled();
});
test('edits preserve microsecond versions and distinguish revocation, reassignment, conflicts and a missing migration',async()=>{
 tables.jobs=[job(1)];const response=await PUT(request('/api/admin/jobs/'+ID(1),body({expected_updated_at:version})),context(ID(1)));expect(response.status).toBe(200);expect(rpc.mock.calls[0][1]).toMatchObject({p_action:'edit',p_expected_version:version});
 rpc.mockClear();expect((await PATCH(request('/api/admin/jobs/'+ID(1),{action:'hide',expected_updated_at:'2026-10-07T00:00:00.123Z'}),context(ID(1)))).status).toBe(409);expect(rpc).not.toHaveBeenCalled();
 for(const [code,status] of [['42501',403],['P0002',404],['40001',409],['42883',503]]){faults.rpc=code;expect((await PATCH(request('/api/admin/jobs/'+ID(1),{action:'hide',expected_updated_at:version}),context(ID(1)))).status).toBe(status);}
 expect(tables.jobs[0].is_active).toBe(true);expect(queries.filter(q=>q.operation!=='read')).toHaveLength(0);
});
test('admin AI validates access and district before quota, then reserves against fresh permissions before a mocked provider call',async()=>{
 const input={action:'improve_description',description:'Source description',lang:'ru'};expect((await aiPOST(request('/api/admin/ai/vacancy-helper',input))).status).toBe(200);expect(rpc).toHaveBeenCalledWith('ishdasiz_reserve_admin_vacancy_ai',{p_admin_id:A});expect(callDeepSeekText).toHaveBeenCalledTimes(1);
 (callDeepSeekText as jest.Mock).mockClear();tables.admin_profiles[0].district_id=null;expect((await aiPOST(request('/api/admin/ai/vacancy-helper',input))).status).toBe(403);tables.admin_profiles[0].district_id=100;faults.rpc='42501';expect((await aiPOST(request('/api/admin/ai/vacancy-helper',input))).status).toBe(403);expect(callDeepSeekText).not.toHaveBeenCalled();
});
test('applications, their counts and attached resume summaries never cross the assigned district',async()=>{
 tables.jobs=[job(1),job(2,{district_id:200})];tables.job_applications=[{id:ID(10),job_id:ID(1),user_id:B,status:'pending',full_name:'Allowed',phone,private_note:'secret',resumes:{id:ID(20),user_id:B,status:'active',title:'Attached resume',full_name:'Allowed',about:'Summary',skills:[]}}, {id:ID(11),job_id:ID(2),user_id:B,status:'pending',full_name:'Foreign candidate'}];
 const response=await applicationsGET(request('/api/admin/applications'));expect(response.status).toBe(200);const page=await response.json();expect(page.total).toBe(1);expect(page.stats.total).toBe(1);expect(page.applications[0].resumes.title).toBe('Attached resume');expect(JSON.stringify(page)).not.toMatch(/Foreign candidate|private_note|user_id|employer_id|created_by/);
 tables.job_applications[0].resumes.user_id=A;expect((await (await applicationsGET(request('/api/admin/applications'))).json()).applications[0].resumes).toBeNull();
});
test('application paging and legacy status filters reach records beyond 1000 and preserve national or district scope',async()=>{
 tables.jobs=[job(1),job(2,{district_id:200})];tables.job_applications=Array.from({length:1205},(_,i)=>({id:ID(i+1),job_id:ID(1),full_name:'Candidate '+i,status:'invited',created_at:version}));tables.job_applications.push({id:ID(5000),job_id:ID(2),status:'invited'});
 const page=await (await applicationsGET(request('/api/admin/applications?page=24&status=interview_set'))).json();expect(page.applications).toHaveLength(5);expect(page.total).toBe(1205);expect(page.stats.interview_set).toBe(1205);expect(page.hasMore).toBe(false);
 tables.admin_profiles[0].role='super_admin';expect((await (await applicationsGET(request('/api/admin/applications'))).json()).total).toBe(1206);
 for(const suffix of ['?page=-1','?page=1.5','?page=Infinity','?status=forged','?job=forged'])expect((await applicationsGET(request('/api/admin/applications'+suffix))).status).toBe(400);
});
test.each(['%','_','*','.*','(a,b)','name"quote','back\\slash','x),id.neq.anything','[a]+?^${}'])('candidate search treats special input as literal text inside the district: %s',async(search)=>{
 tables.jobs=[job(1),job(2,{district_id:200})];tables.job_applications=[{id:ID(10),job_id:ID(1),full_name:'Prefix '+search+' suffix',status:'pending'},{id:ID(11),job_id:ID(1),full_name:'An unrelated candidate',status:'pending'},{id:ID(12),job_id:ID(2),full_name:search,status:'pending'}];
 const response=await applicationsGET(request('/api/admin/applications?search='+encodeURIComponent(search)));expect(response.status).toBe(200);const page=await response.json();expect(page.total).toBe(1);expect(page.applications[0].id).toBe(ID(10));
});
test('application failures never become an empty success, while unavailable statistics remain explicitly unknown',async()=>{
 tables.jobs=[job(1)];tables.job_applications=[{id:ID(10),job_id:ID(1),status:'pending'}];faults.counts=true;const page=await (await applicationsGET(request('/api/admin/applications'))).json();expect(page.applications).toHaveLength(1);expect(page.stats).toBeNull();expect(page.stats_error).toBe(true);
 faults.job_applications=true;expect((await applicationsGET(request('/api/admin/applications'))).status).toBe(503);expect((await applicationsGET(request('/api/admin/applications',undefined,false))).status).toBe(401);
});
test('aggregate statistics use the server-only current-permission function, never a browser sum of the first 1000 rows',async()=>{
 rpc.mockResolvedValueOnce({data:{totalJobs:1205,totalViews:2409,activeJobs:1200,hiddenJobs:5,removedJobs:0,totalApplications:25,jobsByCategory:[],jobsByDistrict:[],jobsByType:[],private_note:'secret'},error:null});const response=await statsGET(request('/api/admin/stats'));expect(response.status).toBe(200);const data=await response.json();expect(data.stats.totalViews).toBe(2409);expect(data.stats).not.toHaveProperty('private_note');expect(rpc).toHaveBeenLastCalledWith('ishdasiz_admin_stats',{p_admin_id:A});
 rpc.mockResolvedValueOnce({data:null,error:{code:'42883'}});expect((await statsGET(request('/api/admin/stats'))).status).toBe(503);rpc.mockResolvedValueOnce({data:null,error:{code:'42501'}});expect((await statsGET(request('/api/admin/stats'))).status).toBe(403);
});
