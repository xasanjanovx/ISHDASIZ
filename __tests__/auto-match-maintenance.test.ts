/** @jest-environment node */
import {createClient} from '@supabase/supabase-js';
import {NextRequest} from 'next/server';
import {GET,POST} from '@/app/api/maintenance/recommendation-deliveries/route';
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
const actualCreate=jest.requireActual('@supabase/supabase-js').createClient;
const id='30000000-0000-4000-8000-000000000001',at='2026-10-10T10:00:00.123456+00:00';
function reader(reply:any){const requests:any[]=[];const client=actualCreate('https://example.supabase.co','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input:any,init:any)=>{requests.push({url:new URL(String(input)),body:init?.body?JSON.parse(init.body):null});return new Response(JSON.stringify(reply?.error||reply),{status:reply?.error?500:200,headers:{'Content-Type':'application/json'}});}}});(createClient as jest.Mock).mockReturnValue(client);return requests;}
const request=(body?:any,auth=true,url='http://localhost/api/maintenance/recommendation-deliveries')=>new NextRequest(url,{method:body===undefined?'GET':'POST',headers:auth?{authorization:'Bearer synthetic-secret'}:{},...(body===undefined?{}:{body:JSON.stringify(body)})});
const resolution={matchId:id,expectedAttemptedAt:at,resolution:'verified_not_delivered'};
beforeEach(()=>{jest.clearAllMocks();process.env.CRON_SECRET='synthetic-secret';process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';});
test('recommendation maintenance rejects unauthorized reads and writes before creating a database client',async()=>{
 expect((await GET(request(undefined,false))).status).toBe(401);expect((await POST(request(resolution,false))).status).toBe(401);expect(createClient).not.toHaveBeenCalled();
});
test('an invalid page cursor is rejected before database access',async()=>{
 expect((await GET(request(undefined,true,'http://localhost/api/maintenance/recommendation-deliveries?after=foreign'))).status).toBe(400);expect(createClient).not.toHaveBeenCalled();
});
test.each([{...resolution,expectedAttemptedAt:null},{...resolution,resolution:'retry'},{...resolution,messageId:11},{...resolution,resolution:'verified_message',messageId:-1}])('unverified or malformed evidence is rejected: %p',async body=>{
 expect((await POST(request(body))).status).toBe(400);expect(createClient).not.toHaveBeenCalled();
});
test('an operator resolution carries the exact attempt version and preserves confirmed evidence',async()=>{
 const requests=reader(true);expect((await POST(request({...resolution,resolution:'verified_message',messageId:11}))).status).toBe(200);expect(requests[0].url.pathname).toBe('/rest/v1/rpc/ishdasiz_auto_match_resolve');expect(requests[0].body).toEqual({p_match:id,p_expected_attempted:at,p_message:11,p_not_delivered:false});
});
test.each([false,{error:{code:'55000'}}])('stale or in-flight notifications are not manually overwritten: %p',async reply=>{
 reader(reply);expect((await POST(request(resolution))).status).toBe(409);
});
test('unknown notifications are paged without exposing contact details or capability tokens',async()=>{
 const rows=Array.from({length:101},(_,i)=>({id:'30000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),notification_state:'uncertain'}));const requests=reader(rows),response=await GET(request());expect(await response.json()).toMatchObject({items:rows.slice(0,100),nextCursor:rows[99].id});expect(requests[0].url.searchParams.get('select')).not.toMatch(/user_id|token|criteria|text|phone/);expect(response.headers.get('cache-control')).toBe('no-store');
});
