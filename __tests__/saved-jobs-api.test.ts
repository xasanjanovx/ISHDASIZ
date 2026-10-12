/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {GET as favorites,PUT} from '@/app/api/account/favorites/route';
import {GET as history,POST,PATCH} from '@/app/api/account/history/route';
import {GET as state} from '@/app/api/account/jobs/[id]/route';
import {GET as detail} from '@/app/api/jobs/[id]/route';
import {POST as countView} from '@/app/api/jobs/[id]/view/route';
import {SESSION_COOKIE,passwordVersion,signAuthToken} from '@/lib/auth/server';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at='2026-10-07T00:00:00.123456Z',phone='+998901234567';
let tables:Record<string,any[]>,faults:any,rpcs:any[];
const context=(job=id(1))=>({params:Promise.resolve({id:job})});
function request(path:string,method='GET',body?:any,signed=true,extra:Record<string,string>={}){
 const token=signAuthToken({purpose:'session',userId:A,phone,expiresAt:Date.now()+60000,passwordVersion:passwordVersion('hash')});
 return new NextRequest('http://localhost'+path,{method,headers:{...(signed?{cookie:`${SESSION_COOKIE}=${token}`} :{}),'content-type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
function split(s:string){let depth=0,start=0;const values:string[]=[];for(let i=0;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(s[i]===','&&!depth){values.push(s.slice(start,i));start=i+1;}}values.push(s.slice(start));return values;}
function matches(row:any,s:string):boolean{const g=s.match(/^(and|or)\((.*)\)$/);if(g){const v=split(g[2]).map(p=>matches(row,p));return g[1]==='and'?v.every(Boolean):v.some(Boolean);}const m=s.match(/^(\w+)\.(eq|lt|is)\.(.*)$/);if(!m)throw Error('Unexpected filter');const [,key,op,raw]=m,value=raw==='null'?null:raw;return op==='is'?(row[key]??null)===value:op==='eq'?row[key]===value:row[key]!=null&&row[key]<value;}
beforeEach(()=>{
 process.env.AUTH_SESSION_SECRET='synthetic-test-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';faults={};rpcs=[];
 tables={users:[{id:A,phone,password_hash:'hash',session_version:0,closed_at:null},{id:B,closed_at:null}],job_seeker_profiles:[{id:'seeker',user_id:A}],jobs:[{id:id(1),is_active:true,status:'active',user_id:B,created_by:B,title_ru:'Оператор',title_uz:'Operator',company_name:'Test company',raw_source_json:{skills_details:[{skill_name:'Excel',level:'B2',secret:'excluded'}],languages:[{id:2,name:'English',level:'B1'}],secret:'private'},skills:['Excel'],password_hash:'private'}],favorites:[],view_history:[],job_applications:[],history_clear_batches:[]};
 const client:any={from:(table:string)=>{const filters:((row:any)=>boolean)[]=[],orders:any[]=[];let limit=Infinity,expression:string|null=null,hiddenFilter=false;
  const q:any={select:()=>q,eq:(key:string,value:any)=>{filters.push(row=>row[key]===value);return q;},neq:(key:string,value:any)=>{filters.push(row=>row[key]!==value);return q;},is:(key:string,value:any)=>{if(key==='hidden_batch_id')hiddenFilter=true;filters.push(row=>(row[key]??null)===value);return q;},in:(key:string,value:any[])=>{filters.push(row=>value.includes(row[key]));return q;},lt:(key:string,value:any)=>{filters.push(row=>row[key]!=null&&row[key]<value);return q;},or:(value:string)=>{expression=value;return q;},order:(key:string,options:any={})=>{orders.push({key,...options});return q;},limit:(n:number)=>{limit=n;return q;}};
  const execute=()=>{if(faults[table])return {data:null,error:faults[table]};if(faults.historyColumn&&table==='view_history'&&hiddenFilter)return {data:null,error:{code:'42703',message:'hidden_batch_id missing'}};let rows=(tables[table]||[]).filter(row=>filters.every(fn=>fn(row))).filter(row=>!expression||split(expression).some(s=>matches(row,s)));
   for(const {key,ascending,nullsFirst} of [...orders].reverse())rows=[...rows].sort((a,b)=>a[key]===b[key]?0:a[key]==null?(nullsFirst? -1:1):b[key]==null?(nullsFirst?1:-1):(a[key]>b[key]?1:-1)*(ascending===false?-1:1));
   return {data:rows.slice(0,limit),error:null};};q.then=(resolve:any,reject:any)=>Promise.resolve().then(execute).then(resolve,reject);q.maybeSingle=async()=>{const r=execute();return {...r,data:r.data?.[0]||null};};return q;},
  rpc:async(name:string,args:any)=>{rpcs.push({name,args});if(faults.rpc)return {data:null,error:faults.rpc};return {data:name==='ishdasiz_set_job_favorite'?args.p_favorite:name==='ishdasiz_clear_job_history'?id(900):true,error:null};}};
 (createClient as jest.Mock).mockReturnValue(client);
});
const saved=(n:number,patch:any={})=>({id:id(n),user_id:A,job_id:id(1),created_at:at,viewed_at:at,hidden_batch_id:null,jobs:tables.jobs[0],...patch});
test('private list/state require a signed open seeker account; forged user IDs are ignored',async()=>{
 expect((await favorites(request('/api/account/favorites','GET',undefined,false))).status).toBe(401);
 tables.favorites=[saved(1),saved(2,{user_id:B})];const data=await (await favorites(request('/api/account/favorites?user_id='+B))).json();expect(data.items.map((row:any)=>row.id)).toEqual([id(1)]);
 expect(JSON.stringify(data)).not.toMatch(/user_id|created_by|password_hash|private/);
 tables.users[0].closed_at=at;expect((await state(request('/api/account/jobs/'+id(1)),context())).status).toBe(401);
 tables.users[0].closed_at=null;tables.job_seeker_profiles=[];expect((await history(request('/api/account/history'))).status).toBe(403);
});
test('keyset paging keeps all 115 equal microsecond dates and null dates without duplicates',async()=>{
 tables.favorites=Array.from({length:115},(_,n)=>saved(n+1));tables.favorites.push(...Array.from({length:55},(_,n)=>saved(n+116,{created_at:null})),saved(999,{user_id:B}));
 let cursor:string|null=null;const ids:string[]=[];
 do{const response=await favorites(request('/api/account/favorites'+(cursor?'?before='+encodeURIComponent(cursor):'')));expect(response.status).toBe(200);const page=await response.json();ids.push(...page.items.map((row:any)=>row.id));cursor=page.nextCursor;}while(cursor);
 expect(ids).toHaveLength(170);expect(new Set(ids).size).toBe(170);expect(ids).not.toContain(id(999));
});
test('changed history cursor timestamps and deleted or foreign anchors force an explicit refresh',async()=>{
 tables.view_history=Array.from({length:55},(_,n)=>saved(n+1));const page=await (await history(request('/api/account/history'))).json();
 const anchor=JSON.parse(Buffer.from(page.nextCursor,'base64url').toString());tables.view_history.find(row=>row.id===anchor.id)!.viewed_at='2026-10-07T00:00:01.123456Z';
 expect((await history(request('/api/account/history?before='+page.nextCursor))).status).toBe(409);
 tables.view_history.find(row=>row.id===anchor.id)!.viewed_at=at;tables.view_history.find(row=>row.id===anchor.id)!.user_id=B;
 expect((await history(request('/api/account/history?before='+page.nextCursor))).status).toBe(409);
 expect((await history(request('/api/account/history?before=not-json'))).status).toBe(400);
});
test('unavailable bookmarks keep an own removable record but expose no job details',async()=>{
 tables.jobs[0].is_active=false;tables.favorites=[saved(1)];const data=await (await favorites(request('/api/account/favorites'))).json();expect(data.items[0].job).toBeNull();expect(JSON.stringify(data)).not.toContain('Test company');
 expect((await PUT(request('/api/account/favorites','PUT',{job_id:id(1),favorite:false,user_id:B}))).status).toBe(200);expect(rpcs[0].args).toMatchObject({p_user_id:A,p_favorite:false,p_session_version:0});
 expect((await PUT(request('/api/account/favorites','PUT',{job_id:id(1),favorite:true}))).status).toBe(404);expect(rpcs).toHaveLength(1);
});
test('desired state and history RPCs reject cross-origin writes and report storage failures honestly',async()=>{
 expect((await PUT(request('/api/account/favorites','PUT',{job_id:id(1),favorite:true},true,{origin:'https://attacker.example'}))).status).toBe(403);expect(rpcs).toEqual([]);
 faults.rpc={code:'08006',message:'Secret query'};for(const fn of [()=>PUT(request('/api/account/favorites','PUT',{job_id:id(1),favorite:true})),()=>POST(request('/api/account/history','POST',{job_id:id(1)})),()=>PATCH(request('/api/account/history','PATCH',{action:'clear'}))]){const response=await fn();expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('Secret query');}
 faults.rpc={code:'40001'};expect((await PATCH(request('/api/account/history','PATCH',{action:'restore',undo_id:id(900)}))).status).toBe(409);
 faults.rpc={code:'42501'};expect((await PUT(request('/api/account/favorites','PUT',{job_id:id(1),favorite:true}))).status).toBe(401);
 expect((await POST(request('/api/account/history','POST',{job_id:id(1)}))).status).toBe(401);expect((await PATCH(request('/api/account/history','PATCH',{action:'clear'}))).status).toBe(401);
});
test('history migration absence allows honest read-only fallback without hiding other failures',async()=>{
 tables.view_history=[saved(1)];faults.view_history={code:'08006'};expect((await history(request('/api/account/history'))).status).toBe(503);
 delete faults.view_history;faults.historyColumn=true;const response=await history(request('/api/account/history'));expect(response.status).toBe(200);const data=await response.json();expect(data.items).toHaveLength(1);expect(data.supportsClear).toBe(false);expect(data.undoId).toBeNull();
});
test('account job flags contain only own bookmark/application state and do not turn errors into false values',async()=>{
 tables.favorites=[saved(1,{user_id:B})];tables.job_applications=[{job_id:id(1),user_id:A}];const response=await state(request('/api/account/jobs/'+id(1)),context());expect(await response.json()).toEqual({favorite:false,applied:true});
 faults.favorites={code:'08006'};expect((await state(request('/api/account/jobs/'+id(1)),context())).status).toBe(503);
});
test('public detail whitelist preserves skill names but excludes owner IDs and arbitrary source metadata',async()=>{
 const response=await detail(request('/api/jobs/'+id(1),'GET',undefined,false),context());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 const data=await response.json();expect(data.job.raw_source_json.skills_details[0]).toEqual({skill_name:'Excel',level:'B2'});expect(data.job.raw_source_json.languages[0]).toEqual({id:2,name:'English',level:'B1'});expect(JSON.stringify(data)).not.toMatch(/user_id|created_by|password_hash|secret|private/);
});
test.each([{status:'draft'},{is_active:false},...['filled','removed_at_source','archived','deleted','inactive','paused','on_hold','closed'].map(source_status=>({source_status}))])('guessed public IDs do not expose unavailable detail or increment its counter (%j)',async patch=>{
 Object.assign(tables.jobs[0],patch);expect((await detail(request('/api/jobs/'+id(1),'GET',undefined,false),context())).status).toBe(404);expect((await countView(request('/api/jobs/'+id(1)+'/view','POST',undefined,false),context())).status).toBe(404);expect(rpcs).toEqual([]);
});
test('closed assigned owners override active flags and legacy creators on public detail',async()=>{
 tables.jobs[0].employer_id='assigned';tables.jobs[0].employer_profiles={user_id:B};tables.jobs[0].user_id=A;tables.users[1].closed_at=at;
 expect((await detail(request('/api/jobs/'+id(1),'GET',undefined,false),context())).status).toBe(404);
});
test('view counter deduplicates recent browser views and creates a cookie only after storage succeeds',async()=>{
 const first=await countView(request('/api/jobs/'+id(1)+'/view','POST',undefined,false),context());expect(await first.json()).toEqual({counted:true});const cookie=first.headers.get('set-cookie')!.split(';')[0];
 const again=await countView(request('/api/jobs/'+id(1)+'/view','POST',undefined,false,{cookie} ),context());expect(await again.json()).toEqual({counted:false});expect(rpcs).toHaveLength(1);
 faults.rpc={code:'08006'};const failed=await countView(request('/api/jobs/'+id(1)+'/view','POST',undefined,false),context());expect(failed.status).toBe(503);expect(failed.headers.get('set-cookie')).toBeNull();
});
