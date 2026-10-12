/** @jest-environment node */
import {NextRequest} from 'next/server';
import {AccountError} from '@/lib/auth/account';
import {requireAdmin} from '@/lib/auth/admin';
import {getAuthClient} from '@/lib/auth/server';
import {ImportWorkerError,readOsonishImport,stepOsonishImport} from '@/lib/import/osonish-worker';
import * as all from '@/app/api/cron/import-all/route';
import * as cron from '@/app/api/cron/import-osonish/route';
import * as scraper from '@/app/api/scraper/osonish/route';
import * as admin from '@/app/api/admin/import/route';
import * as legacy from '@/app/api/import/jobs/route';
import * as sync from '@/app/api/import/sync/route';
jest.mock('@/lib/auth/admin',()=>({requireAdmin:jest.fn()}));
jest.mock('@/lib/auth/server',()=>({getAuthClient:jest.fn()}));
jest.mock('@/lib/import/osonish-worker',()=>({ImportWorkerError:class extends Error{constructor(public code:string){super('Private database error');}},readOsonishImport:jest.fn(),stepOsonishImport:jest.fn()}));
const id='10000000-0000-4000-8000-000000000001',client={rpc:jest.fn()},actor='10000000-0000-4000-8000-000000000002';
const progress=(patch:any={})=>({id,state:'running',phase:'list',started_at:'2026-10-09T00:00:00Z',completed_at:null,total:null,listed:0,processed:0,failed:0,verified:0,new_imported:0,updated:0,skipped_closed:0,next_page:1,verify_page:1,last_error:null,next_retry_at:null,busy:false,...patch});
function request(path:string,body?:any,authorized=true,extra:Record<string,string>={}){return new NextRequest('http://localhost'+path,{method:body!==undefined?'POST':'GET',headers:{...(authorized?{authorization:'Bearer synthetic-cron','X-Import-Key':'synthetic-import'}:{}),'Content-Type':'application/json',...extra},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});}
beforeEach(()=>{jest.clearAllMocks();process.env.CRON_SECRET='synthetic-cron';process.env.IMPORT_API_KEY='synthetic-import';(getAuthClient as jest.Mock).mockReturnValue(client);(requireAdmin as jest.Mock).mockResolvedValue({client,profile:{id:actor}});(stepOsonishImport as jest.Mock).mockResolvedValue(progress());(readOsonishImport as jest.Mock).mockResolvedValue(progress());jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>jest.restoreAllMocks());

test('both cron names share one bounded worker and pending or busy work never claims successful completion',async()=>{
 expect(all.GET).toBe(cron.GET);for(const route of [all,cron]){const response=await route.GET(request('/api/cron/import'));expect(response.status).toBe(202);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toMatchObject({success:false,pending:true,progress:{id}});}expect(stepOsonishImport).toHaveBeenCalledWith(client);
 (stepOsonishImport as jest.Mock).mockResolvedValue(progress({busy:true}));expect((await cron.GET(request('/api/cron/import'))).status).toBe(202);
});
test('missing or incorrect cron credentials are rejected before creating a privileged client',async()=>{
 for(const authorized of [false,true]){delete process.env.CRON_SECRET;expect((await cron.GET(request('/api/cron/import',undefined,authorized))).status).toBe(401);}expect(getAuthClient).not.toHaveBeenCalled();expect(stepOsonishImport).not.toHaveBeenCalled();
});
test('key API and retired payload/sync routes require a configured secret before any privileged work',async()=>{
 for(const route of [scraper,legacy,sync])expect((await route.POST(request('/api/import',{},false))).status).toBe(401);delete process.env.IMPORT_API_KEY;expect((await scraper.GET(request('/api/import'))).status).toBe(401);expect(getAuthClient).not.toHaveBeenCalled();expect(stepOsonishImport).not.toHaveBeenCalled();
});
test('retired arbitrary payload and cleanup protocols return explicit 410 without accepting data or querying jobs',async()=>{
 for(const route of [legacy,sync]){const response=await route.POST(request('/api/import',{vacancies:[{source_id:'1'}],active_source_ids:[]}));expect(response.status).toBe(410);expect(await response.json()).toMatchObject({replacement:'/api/scraper/osonish'});}expect(getAuthClient).not.toHaveBeenCalled();expect(client.rpc).not.toHaveBeenCalled();expect(stepOsonishImport).not.toHaveBeenCalled();
});
test('manual API verifies current super-admin rights for reads and writes',async()=>{
 (requireAdmin as jest.Mock).mockRejectedValue(new AccountError(403,'Нет прав'));expect((await admin.GET(request('/api/admin/import'))).status).toBe(403);expect((await admin.POST(request('/api/admin/import',{action:'start',request_id:id}))).status).toBe(403);expect(requireAdmin).toHaveBeenCalledWith(expect.anything(),true);expect(stepOsonishImport).not.toHaveBeenCalled();expect(readOsonishImport).not.toHaveBeenCalled();
});
test('manual cross-origin requests stop before checking privileged identity',async()=>{
 expect((await admin.POST(request('/api/admin/import',{},true,{Origin:'https://other.example'}))).status).toBe(403);expect(requireAdmin).not.toHaveBeenCalled();
});
test('manual starts carry the verified actor and stable request; continuations carry only the run',async()=>{
 await admin.POST(request('/api/admin/import',{action:'start',request_id:id,max_pages:50}));expect(stepOsonishImport).toHaveBeenLastCalledWith(client,{actorId:actor,start:true,requestId:id,maxPages:50});await scraper.POST(request('/api/scraper/osonish',{action:'continue',run_id:id}));expect(stepOsonishImport).toHaveBeenLastCalledWith(client,{runId:id});
});
test.each([{},[],null,'{', {max_pages:20},{action:'stop'},{action:'start',request_id:id,vacancies:[]},{action:'start',request_id:id,run_id:id},{action:'continue'},{action:'continue',run_id:id,request_id:id},{action:'continue',run_id:id,max_pages:10},{action:'start',request_id:id,only_with_contacts:true}])('unsupported or malformed payloads are rejected explicitly: %p',async body=>{
 expect((await scraper.POST(request('/api/scraper/osonish',body))).status).toBe(400);expect(stepOsonishImport).not.toHaveBeenCalled();
});
test('oversized requests stop before any source work',async()=>{expect((await scraper.POST(request('/api/import',' '.repeat(4097)))).status).toBe(400);expect(stepOsonishImport).not.toHaveBeenCalled();});
test('read and worker responses project safe progress without lease tokens or source contacts',async()=>{
 const raw=progress({token:'private-token',raw_source_json:{phone:'private-phone'}});(readOsonishImport as jest.Mock).mockResolvedValue(raw);(stepOsonishImport as jest.Mock).mockResolvedValue(raw);for(const response of [await admin.GET(request('/api/admin/import')),await scraper.POST(request('/api/import',{action:'continue',run_id:id}))]){const text=await response.text();expect(text).not.toContain('private-');}
});
test('only a completed cycle reports success; failed work remains an error with its durable summary',async()=>{
 (stepOsonishImport as jest.Mock).mockResolvedValue(progress({state:'completed',phase:'done',completed_at:'2026-10-09T00:05:00Z'}));const done=await cron.GET(request('/api/import'));expect(done.status).toBe(200);expect(await done.json()).toMatchObject({success:true,pending:false});(stepOsonishImport as jest.Mock).mockResolvedValue(progress({state:'failed',last_error:'snapshot_changed'}));const failed=await cron.GET(request('/api/import'));expect(failed.status).toBe(502);expect(await failed.json()).toMatchObject({success:false,pending:false,progress:{last_error:'snapshot_changed'}});
});
test.each([['42501',403],['P0002',404],['55P03',409],['40001',409],['release',503]])('worker failures map to safe HTTP errors: %s',async(code,status)=>{
 (stepOsonishImport as jest.Mock).mockRejectedValue(new ImportWorkerError(String(code)));const response=await cron.GET(request('/api/import'));expect(response.status).toBe(status);expect(await response.text()).not.toContain('Private database error');
});
