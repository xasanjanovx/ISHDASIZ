/** @jest-environment node */
import {continueOsonishImport} from '@/lib/import/continue-osonish';
import type {ImportProgress} from '@/lib/import/progress';
const id='10000000-0000-4000-8000-000000000001';
const progress=(patch:Partial<ImportProgress>={}):ImportProgress=>({id,state:'running',phase:'list',started_at:'2026-10-12T00:00:00Z',completed_at:null,total:null,listed:0,processed:0,failed:0,verified:0,new_imported:0,updated:0,skipped_closed:0,next_page:1,verify_page:1,last_error:null,next_retry_at:null,busy:false,...patch});
test.each([null,progress({state:'completed'}),progress({state:'failed'}),progress({busy:true}),progress({phase:'details',next_retry_at:'2026-10-12T00:01:00Z'})])('idle, terminal, leased and delayed runs do not start work: %p',async value=>{
 const step=jest.fn();expect(await continueOsonishImport({read:async()=>value,step,now:()=>Date.parse('2026-10-12T00:00:00Z')})).toEqual(value);expect(step).not.toHaveBeenCalled();
});
test('all steps pin the existing run and stop on completion',async()=>{
 let n=0;const step=jest.fn(async()=>progress({next_page:++n+1,...(n===3?{state:'completed' as const,phase:'done' as const}:{})}));
 expect(await continueOsonishImport({read:async()=>progress(),step,now:()=>0})).toMatchObject({state:'completed'});
 expect(step.mock.calls).toHaveLength(3);expect(step).toHaveBeenNthCalledWith(1,id);expect(step).toHaveBeenNthCalledWith(3,id);
});
test('no progress, a persisted error or another lease stops repeated calls',async()=>{
 for(const next of [progress(),progress({last_error:'source_unavailable'}),progress({busy:true})]){
  const step=jest.fn(async()=>next);await continueOsonishImport({read:async()=>progress(),step,now:()=>0});expect(step).toHaveBeenCalledTimes(1);
 }
});
test('at most eight steps fit inside the budget, leaving room for claim and release',async()=>{
 let n=0,time=0;const step=jest.fn(async()=>{time+=40000;return progress({next_page:++n+1});});
 await continueOsonishImport({read:async()=>progress(),step,now:()=>time});expect(step).toHaveBeenCalledTimes(6);
 n=0;step.mockClear();await continueOsonishImport({read:async()=>progress(),step,now:()=>0});expect(step).toHaveBeenCalledTimes(8);
});
test('a changed run or lost step response is surfaced without restarting',async()=>{
 const step=jest.fn(async()=>progress({id:'10000000-0000-4000-8000-000000000002'}));
 await expect(continueOsonishImport({read:async()=>progress(),step})).rejects.toThrow('Import run changed');expect(step).toHaveBeenCalledTimes(1);
 step.mockRejectedValueOnce(new Error('unavailable'));await expect(continueOsonishImport({read:async()=>progress(),step})).rejects.toThrow('unavailable');
});

test('scheduled refresh starts an idle cycle but lets the database choose and lease its run',async()=>{
 const {refreshOsonishImport}=await import('@/lib/import/continue-osonish');
 const start=jest.fn(async()=>progress()),step=jest.fn(async()=>progress({state:'completed'}));
 expect(await refreshOsonishImport({read:async()=>null,start,step,now:()=>0})).toMatchObject({state:'completed'});
 expect(start).toHaveBeenCalledTimes(1);expect(step).toHaveBeenCalledWith(id);
});
test.each(['completed','failed'] as const)('terminal %s runs refresh automatically after the six-hour cooldown',async state=>{
 const {refreshOsonishImport}=await import('@/lib/import/continue-osonish');
 const start=jest.fn(async()=>progress({busy:true})),step=jest.fn();const previous=progress({state});const time=Date.parse(previous.started_at);
 expect(await refreshOsonishImport({read:async()=>previous,start,step,now:()=>time+6*3600000-1})).toEqual(previous);expect(start).not.toHaveBeenCalled();
 await refreshOsonishImport({read:async()=>previous,start,step,now:()=>time+6*3600000});expect(start).toHaveBeenCalledTimes(1);expect(step).not.toHaveBeenCalled();
});
test('scheduled refresh never starts another cycle over a running or leased one',async()=>{
 const {refreshOsonishImport}=await import('@/lib/import/continue-osonish');
 const start=jest.fn(),step=jest.fn();const active=progress({busy:true});
 expect(await refreshOsonishImport({read:async()=>active,start,step,now:()=>Date.parse(active.started_at)+48*3600000})).toEqual(active);
 expect(start).not.toHaveBeenCalled();expect(step).not.toHaveBeenCalled();
});
