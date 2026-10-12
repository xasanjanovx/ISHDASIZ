/** @jest-environment node */
import {fetchVacancyDetail,fetchVacancyIdList,fetchCompanyContacts,scrapeOsonishFull} from '@/lib/scrapers/osonish';
const originalFetch=global.fetch;let fetchMock:jest.Mock;
beforeEach(()=>{jest.useFakeTimers();fetchMock=jest.fn();global.fetch=fetchMock;fetchMock.mockResolvedValue(new Response(JSON.stringify({data:{data:[],total:0,last_page:1}})));jest.spyOn(console,'log').mockImplementation(()=>{});jest.spyOn(console,'warn').mockImplementation(()=>{});jest.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{global.fetch=originalFetch;jest.useRealTimers();jest.restoreAllMocks();});
async function finish<T>(promise:Promise<T>){await jest.runAllTimersAsync();return promise;}
test('HTTP failures and source errors reject list reads instead of returning a successful empty page',async()=>{
 fetchMock.mockImplementation(async()=>new Response('{}',{status:404}));await expect(fetchVacancyIdList()).rejects.toThrow('Source list unavailable');fetchMock.mockImplementation(async()=>new Response(JSON.stringify({success:false,data:{data:[],total:0}})));await expect(fetchVacancyIdList()).rejects.toThrow('Source list unavailable');
});
test.each([{success:false,data:{id:1,status:2}},{data:{id:2,status:2}},{data:{id:1}},{data:{id:1,status:'invalid'}},{data:null},{data:{id:true,status:2}},{data:{id:1,status:null}},{data:{id:1,status:true}}])('malformed detail cannot become a filled or active source record: %p',async payload=>{fetchMock.mockImplementation(async()=>new Response(JSON.stringify(payload)));expect(await fetchVacancyDetail(1)).toMatchObject({success:false,status:0});});
test('string IDs and statuses normalize only after validating the requested detail identity',async()=>{
 fetchMock.mockImplementation(async()=>new Response(JSON.stringify({success:true,data:{id:'1',status:'2',title:'Operator'}})));expect(await fetchVacancyDetail(1)).toMatchObject({success:true,detail:{id:1,status:2}});
});
test('a page limit produces partial evidence and contact counts include normal contacts exactly once',async()=>{
 fetchMock.mockImplementation(async(url:string)=>new Response(JSON.stringify(url.includes('/vacancies/1')?{success:true,data:{id:1,status:2,title:'Operator',company:{name:'Demo'},hr:{phone:'998901234567'}}}:{data:{data:[{id:1}],total:2,last_page:2}})));
 const result=await finish(scrapeOsonishFull(1,false));expect(result).toMatchObject({list_complete:false,list_total:2,listed_ids:['1'],active_ids:['1'],debug:{list_items_count:1,detail_success_count:1,detail_fail_count:0,vacancies_with_contacts:1}});expect(result.vacancies).toHaveLength(1);expect(fetchMock.mock.calls.filter(([url])=>url.includes('page=2'))).toHaveLength(0);
});
test('a failed second page retains known IDs, reports partial import and cannot authorize cleanup',async()=>{
 fetchMock.mockImplementation(async(url:string)=>url.includes('page=2')?new Response('{}',{status:404}):new Response(JSON.stringify(url.includes('/vacancies/1')?{data:{id:1,status:2,title:'Operator',hr:{phone:'998901234567'}}}:{data:{data:[{id:1}],total:2,last_page:2}})));
 const result=await finish(scrapeOsonishFull(2,false));expect(result.list_complete).toBe(false);expect(result.listed_ids).toEqual(['1']);expect(result.debug.errors).toContain('Source list page unavailable');expect(result.vacancies).toHaveLength(1);
});
test('detail failures do not remove their IDs from enumeration evidence or declare them filled',async()=>{
 fetchMock.mockImplementation(async(url:string)=>url.includes('/vacancies/1')?new Response('{}',{status:503}):new Response(JSON.stringify({data:{data:[{id:1}],total:1,last_page:1}})));
 const result=await finish(scrapeOsonishFull(1,false));expect(result).toMatchObject({list_complete:true,listed_ids:['1'],active_ids:[],filled_ids:[],debug:{detail_fail_count:1,detail_success_count:0}});expect(result.debug.errors).toHaveLength(1);
});
test('an already cancelled request never starts source network work',async()=>{const controller=new AbortController();controller.abort();await expect(fetchVacancyIdList(1,controller.signal)).rejects.toThrow();await expect(fetchVacancyDetail(1,controller.signal)).rejects.toThrow();expect(fetchMock).not.toHaveBeenCalled();});
test('parent cancellation stops retry backoff and cannot turn a timed-out detail into source removal',async()=>{const controller=new AbortController();fetchMock.mockResolvedValue(new Response('{}',{status:503}));const read=fetchVacancyDetail(1,controller.signal);const rejection=expect(read).rejects.toThrow('cancelled');await jest.advanceTimersByTimeAsync(1);controller.abort();await rejection;expect(fetchMock).toHaveBeenCalledTimes(1);});
test('the request deadline covers a stalled response body as well as headers',async()=>{fetchMock.mockImplementation(async()=>new Response(new ReadableStream({start(){}})));const pending=fetchVacancyDetail(1);await jest.runAllTimersAsync();expect(await pending).toMatchObject({success:false,status:0});expect(fetchMock).toHaveBeenCalledTimes(3);});
test('company-contact failures are not cached as permanent absence, while successful contacts expire',async()=>{fetchMock.mockResolvedValueOnce(new Response('{}',{status:404})).mockResolvedValue(new Response(JSON.stringify({data:{phone:'998901234567',mail:'hr@example.test'}})));expect(await fetchCompanyContacts(987654)).toBeNull();expect(await fetchCompanyContacts(987654)).toMatchObject({phone:'998901234567'});expect(await fetchCompanyContacts(987654)).toMatchObject({phone:'998901234567'});expect(fetchMock).toHaveBeenCalledTimes(2);await jest.advanceTimersByTimeAsync(61000);await fetchCompanyContacts(987654);expect(fetchMock).toHaveBeenCalledTimes(3);});


test('a response without Content-Length is cancelled when streamed data exceeds the limit',async()=>{const cancelled=jest.fn();fetchMock.mockImplementation(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4*1024*1024));controller.enqueue(new Uint8Array(1));},cancel:cancelled})));const pending=fetchVacancyDetail(1);await jest.runAllTimersAsync();expect(await pending).toMatchObject({success:false,status:0});expect(cancelled).toHaveBeenCalledTimes(3);});
