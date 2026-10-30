/** @jest-environment node */
import {GET} from '@/app/api/mini-app/bootstrap/route';
import {getAuthClient} from '@/lib/auth/server';
import {createClient} from '@supabase/supabase-js';
jest.mock('@/lib/auth/server',()=>({getAuthClient:jest.fn()}));
jest.mock('next/cache',()=>({unstable_cache:(fn:any)=>fn}));
test('a cold burst shares public references/statistics without reading private rows',async()=>{
 const reads:Array<{url:URL;method:string}>=[];
 const client=createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(input:any,init:any)=>{
  const url=new URL(String(input)),method=init.method;reads.push({url,method});let data:any=[],status=200;
  if(url.pathname.endsWith('/ishdasiz_public_statistics'))data={availableJobs:0,views:0,applications:0,regionCount:0,byRegion:[],byCategory:[],byDistrict:[],byEmployment:[],asOf:new Date().toISOString()};
  if(url.pathname.endsWith('/mini_app_records')){status=404;data={code:'42P01'};}
  return new Response(method==='HEAD'?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Content-Range':'0-0/0'}});
 }}});
 (getAuthClient as jest.Mock).mockReturnValue(client);
 const responses=await Promise.all(Array.from({length:10},()=>GET()));expect(reads).toHaveLength(6);
 const privateProbe=reads.find(r=>r.url.pathname.endsWith('/mini_app_records'))!;expect(privateProbe.url.searchParams.get('limit')).toBe('0');
 const resumes=reads.find(r=>r.url.pathname.endsWith('/resumes'))!;expect(resumes.method).toBe('HEAD');expect(resumes.url.searchParams.get('select')).toBe('id');
 expect(reads.some(r=>r.url.pathname.endsWith('/users'))).toBe(false);
 for(const response of responses){expect(response.status).toBe(200);expect((await response.json()).storageReady).toBe(false);}
});
