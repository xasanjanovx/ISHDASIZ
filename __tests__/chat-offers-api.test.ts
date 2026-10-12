/** @jest-environment node */
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {GET} from '@/app/api/account/chat/offers/route';
import {requireAccount,AccountError} from '@/lib/auth/account';
jest.mock('@/lib/auth/account',()=>({...jest.requireActual('@/lib/auth/account'),requireAccount:jest.fn()}));
const A='00000000-0000-4000-8000-000000000001',E='10000000-0000-4000-8000-000000000001';
const id=(n:number)=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
let requests:URL[],responses:any[];
const request=(query='')=>new NextRequest('http://localhost/api/account/chat/offers'+query);
beforeEach(()=>{
 requests=[];responses=[];
 const client=createClient('https://example.supabase.co','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input:any)=>{const url=new URL(String(input));requests.push(url);const data=responses.shift();if(data===undefined)throw new Error('Unexpected fallback query');return new Response(JSON.stringify(data?.error||data),{status:data?.error?500:200,headers:{'Content-Type':'application/json'}});}}});
 (requireAccount as jest.Mock).mockResolvedValue({user:{id:A},client});
});
test('guest or closed-account failures never query jobs',async()=>{
 (requireAccount as jest.Mock).mockRejectedValue(new AccountError(401,'Sign in'));expect((await GET(request())).status).toBe(401);expect(requests).toHaveLength(0);
});
test('an employer profile is required; failures are not empty successful lists',async()=>{
 for(const reply of [null,{error:{code:'08006',message:'Private database error'}}]){responses=[reply];const result=await GET(request());expect(result.status).toBe(reply===null?403:503);expect(requests.filter(url=>url.pathname.endsWith('/jobs'))).toHaveLength(0);}
});
test('owned and available filters are enforced before a 25-item page; the response exposes no contacts',async()=>{
 responses=[{id:E},Array.from({length:26},(_,n)=>({id:id(n+1),title_uz:'Ish',title_ru:'Работа',created_at:'2026-10-09T00:00:00Z',contact_phone:'private',user_id:A}))];
 const result=await GET(request()),body=await result.json();expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('no-store');expect(body.jobs).toHaveLength(25);expect(body.nextCursor).toBe(id(25));expect(body.jobs[0]).toEqual({id:id(1),title_uz:'Ish',title_ru:'Работа'});
 const url=requests[1];expect(url.searchParams.get('or')).toBe(`(and(or(employer_id.eq.${E},and(employer_id.is.null,user_id.eq.${A}),and(employer_id.is.null,user_id.is.null,created_by.eq.${A}))))`);expect(url.searchParams.get('ishdasiz_job_available')).toBe('eq.true');expect(url.searchParams.get('limit')).toBe('26');expect(url.searchParams.get('select')).toBe('id,title_uz,title_ru,created_at');expect(url.searchParams.get('order')).toBe('created_at.desc,id.desc');
});
test('pagination verifies cursor ownership and keeps a date/ID continuation in the same ownership condition',async()=>{
 responses=[{id:E},{id:id(25),created_at:'2026-10-09T00:00:00.123456Z'},[]];const result=await GET(request('?before='+id(25)));expect(result.status).toBe(200);expect(requests[1].searchParams.get('id')).toBe('eq.'+id(25));expect(requests[1].searchParams.get('or')).toContain(`employer_id.eq.${E}`);expect(requests[2].searchParams.get('or')).toContain(`and(created_at.eq.2026-10-09T00:00:00.123456Z,id.lt.${id(25)})`);expect(await result.json()).toEqual({jobs:[],nextCursor:null});
});
test('invalid/foreign cursors and job-read errors never trigger a broad query or fake absence',async()=>{
 responses=[{id:E}];expect((await GET(request('?before=forged'))).status).toBe(404);expect(requests).toHaveLength(1);
 requests=[];responses=[{id:E},null];expect((await GET(request('?before='+id(9)))).status).toBe(404);expect(requests).toHaveLength(2);
 requests=[];responses=[{id:E},{error:{code:'42703',message:'Private schema error'}}];const result=await GET(request());expect(result.status).toBe(503);expect(JSON.stringify(await result.json())).not.toContain('Private schema');expect(requests).toHaveLength(2);
});
