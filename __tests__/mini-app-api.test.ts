/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {POST as save} from '@/app/api/mini-app/records/route';
import {GET as candidates} from '@/app/api/mini-app/candidates/route';
import {AccountError,requireAccount} from '@/lib/auth/account';
import {miniModerate} from '@/lib/mini-app/ai';
import {ensureProfile} from '@/lib/auth/server';
jest.mock('@/lib/auth/account',()=>({...jest.requireActual('@/lib/auth/account'),requireAccount:jest.fn()}));
jest.mock('@/lib/mini-app/ai',()=>({...jest.requireActual('@/lib/mini-app/ai'),miniModerate:jest.fn()}));
jest.mock('@/lib/auth/server',()=>({...jest.requireActual('@/lib/auth/server'),ensureProfile:jest.fn()}));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',J='10000000-0000-4000-8000-000000000001',R='20000000-0000-4000-8000-000000000001',C='a0000010-0010-4000-8000-000000000010';
let requests:Array<{url:URL;method:string;body:any}>,unlocked:boolean,saveError:string|null,storageReady:boolean,owner:boolean;
const baseForm=()=>({position:'Sotuvchi',company:'QA company',name:'QA Candidate',birthdate:'1999-01-01',gender:'Erkak',region:'Toshkent shahri',district:'Chilonzor tumani',regionId:1,districtId:10,categoryId:C,
 employment:'To‘liq kun',workMode:'Masofaviy',days:'5/2',hours:'09:00–18:00',experience:'Tajribasiz',education:'O‘rta',hr:'QA manager',phone:'+998901111111',description:'Xaridorlarga yordam berish.',about:'Savdo bo‘yicha ish izlayman.',skills:'Savdo, Excel',languages:'O‘zbek',salaryNegotiable:true,locationConfirmedAt:null});
const request=(kind='vacancy',form=baseForm())=>new NextRequest('https://synthetic.invalid/api/mini-app/records',{method:'POST',headers:{origin:'https://synthetic.invalid','Content-Type':'application/json'},body:JSON.stringify({id:kind==='resume'?R:J,kind,form})});
beforeEach(()=>{
 requests=[];unlocked=false;saveError=null;storageReady=true;owner=true;
 const client=createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(input:any,init:any)=>{
  const url=new URL(String(input)),method=init?.method||'GET',body=JSON.parse(init?.body||'null');requests.push({url,method,body});let data:any=[],status=200,headers:any={'Content-Type':'application/json'};
  const table=url.pathname.split('/').at(-1),kind=url.searchParams.get('kind');
  if(table==='mini_app_records'){
   if(!storageReady){status=404;data={code:'42P01',message:'Synthetic private schema error'};}
   else if(url.searchParams.get('limit')==='0')data=[];
   else if(kind==='eq.vacancy')data=owner?{metadata:{salaryPeriod:'month',salaryCurrency:'UZS'}}:null;
   else data=[{id:R,metadata:{workMode:'Ish joyida',salaryPeriod:'month',salaryCurrency:'UZS',coordinates:[41.32,69.27],languages:'O‘zbek'}}];
  }else if(table==='employer_profiles')data={id:A,company_name:null};
  else if(table==='regions')data={id:1};else if(table==='districts')data={id:10,region_id:1,name_uz:'Chilonzor tumani'};else if(table==='categories')data={id:C};
  else if(table==='jobs')data={id:J,title_uz:'Sotuvchi',work_mode:'onsite',experience:'no_experience',region_id:1,district_id:10,salary_min:5e6,salary_max:6e6,latitude:41.31,longitude:69.25};
  else if(table==='resumes'){
   if(method==='HEAD'){data=null;headers['content-range']='0-0/126';}
   else if(url.searchParams.get('limit')==='0')data=[];
   else data=[{id:R,user_id:B,title:'Sotuvchi',full_name:'Private candidate',phone:'+998902222222',about:'QA skills',skills:['Savdo'],region_id:1,district_id:10,experience:'no_experience',expected_salary_min:5e6}];
  }else if(table==='ishdasiz_mini_app_candidate_access')data=unlocked;
  else if(table==='ishdasiz_mini_app_resume_view')data=unlocked;
  else if(table==='ishdasiz_mini_app_save'){if(saveError){status=409;data={code:saveError,message:'Private SQL details'};}else data={id:body.p_id,kind:body.p_kind};}
  return new Response(method==='HEAD'?null:JSON.stringify(data),{status,headers});
 }}});
 (requireAccount as jest.Mock).mockResolvedValue({client,user:{id:A,phone:'+998901111111',session_version:3}});
 (miniModerate as jest.Mock).mockResolvedValue(undefined);(ensureProfile as jest.Mock).mockResolvedValue(undefined);
});
test.each(['vacancy','resume'])('%s accepts the real journey null location timestamp and saves only through the atomic owned RPC',async kind=>{
 const response=await save(request(kind));expect(response.status).toBe(201);const rpc=requests.find(r=>r.url.pathname.endsWith('/ishdasiz_mini_app_save'))!;
 expect(rpc.body.p_user).toBe(A);expect(rpc.body.p_version).toBe(3);expect(rpc.body.p_metadata.locationConfirmedAt).toBe('');
 expect(rpc.body.p_payload.user_id).toBeUndefined();expect(requests.some(r=>r.method==='POST'&&!r.url.pathname.includes('/rpc/'))).toBe(false);
 if(kind==='resume')expect(rpc.body.p_payload.languages[0].level).toBe('unspecified');
});
test('publication cannot bypass authentication, moderation or missing private storage',async()=>{
 (requireAccount as jest.Mock).mockRejectedValueOnce(new AccountError(401,'Kiring'));expect((await save(request())).status).toBe(401);expect(requests).toHaveLength(0);
 storageReady=false;const absent=await save(request());expect(absent.status).toBe(503);expect(JSON.stringify(await absent.json())).not.toContain('private schema');
 storageReady=true;(miniModerate as jest.Mock).mockRejectedValueOnce(new AccountError(422,'Matnni tekshiring'));expect((await save(request())).status).toBe(422);
 expect(requests.some(r=>r.url.pathname.endsWith('/ishdasiz_mini_app_save'))).toBe(false);
});
test.each([['23505',409],['42501',401]])('atomic rejection %s is sanitized',async(code,status)=>{
 saveError=String(code);const response=await save(request());expect(response.status).toBe(status);expect(JSON.stringify(await response.json())).not.toContain('Private SQL');
});
test('locked candidate search returns counts only; direct contact does not query identities',async()=>{
 const response=await candidates(new NextRequest('https://synthetic.invalid/api/mini-app/candidates?id='+J));expect(response.status).toBe(200);const body=await response.json();expect(body).toEqual({locked:true,total:126,potential:126});
 expect(JSON.stringify(body)).not.toMatch(/Private candidate|phone|coordinates/);expect(requests.filter(r=>r.url.pathname.endsWith('/resumes')).every(r=>r.method==='HEAD')).toBe(true);
 const contact=await candidates(new NextRequest(`https://synthetic.invalid/api/mini-app/candidates?id=${J}&resume_id=${R}`));expect(contact.status).toBe(403);
});
test('an unrelated vacancy cannot open candidate queries',async()=>{
 owner=false;const response=await candidates(new NextRequest('https://synthetic.invalid/api/mini-app/candidates?id='+J));expect(response.status).toBe(404);expect(requests.some(r=>r.url.pathname.endsWith('/resumes'))).toBe(false);
});
test('confirmed vacancy returns matched cards without phone/private points; contact is separately authorized',async()=>{
 unlocked=true;const cards=await candidates(new NextRequest('https://synthetic.invalid/api/mini-app/candidates?id='+J));expect(cards.status).toBe(200);const body=await cards.json();expect(body.candidates).toHaveLength(1);expect(body.candidates[0].full_name).toBe('Private candidate');
 expect(JSON.stringify(body)).not.toMatch(/phone|coordinates|69\.27/);
 const detail=await candidates(new NextRequest(`https://synthetic.invalid/api/mini-app/candidates?id=${J}&resume_id=${R}&action=view`));expect(detail.status).toBe(200);expect((await detail.json()).resume.about).toBe('QA skills');
 const contact=await candidates(new NextRequest(`https://synthetic.invalid/api/mini-app/candidates?id=${J}&resume_id=${R}`));expect((await contact.json()).contact.phone).toBe('+998902222222');
 expect(requests.filter(r=>r.url.pathname.endsWith('/ishdasiz_mini_app_candidate_access')).every(r=>r.body.p_user===A&&r.body.p_version===3&&r.body.p_job===J)).toBe(true);
});
