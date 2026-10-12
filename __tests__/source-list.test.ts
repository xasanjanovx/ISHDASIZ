/** @jest-environment node */
import {canCleanSource,collectSourceIds,parseSourcePage,type SourcePage} from '@/lib/scrapers/source-list';
const block=(ids:number[],patch:any={})=>({data:{data:ids.map(id=>({id})),total:ids.length,per_page:100,last_page:1,current_page:1,...patch}});
test('root and nested pagination accept explicit empty results and numeric strings',()=>{
 expect(parseSourcePage(block([]),1,100)).toEqual({ids:[],total:0,lastPage:1});expect(parseSourcePage({data:[{id:'4'}],meta:{total:'1',per_page:'100',last_page:'1',current_page:'1'}},1,100)).toEqual({ids:[4],total:1,lastPage:1});
});
test.each([{},null,{error:'unavailable'},{success:false,data:{data:[]}},{data:{data:null}},{data:{data:[{id:0}]}},block([1],{total:'NaN'}),block([1],{current_page:2}),block([1],{per_page:0}),block([1],{total:0}),block([1],{last_page:0})])('malformed source responses are rejected instead of treated as an empty source: %p',value=>{expect(()=>parseSourcePage(value,1,100)).toThrow();});
test('missing total metadata never proves completeness even after the last page',async()=>{
 const first=parseSourcePage({data:{data:[{id:1}]}},1,100);expect(first.total).toBeNull();expect(first.lastPage).toBeNull();const fetchPage=jest.fn().mockResolvedValueOnce(first).mockResolvedValueOnce({ids:[],total:null,lastPage:null});expect(await collectSourceIds(fetchPage,5)).toMatchObject({ids:[1],complete:false});
});
test('all unique IDs and an unchanged explicit total prove a complete enumeration',async()=>{
 const fetchPage=jest.fn().mockResolvedValueOnce({ids:[1,2],total:3,lastPage:2}).mockResolvedValueOnce({ids:[3],total:3,lastPage:2});expect(await collectSourceIds(fetchPage,2)).toEqual({ids:[1,2,3],complete:true,expectedTotal:3,error:null});expect(fetchPage.mock.calls).toEqual([[1],[2]]);
});
test('HTTP errors on any page preserve only the known candidates and disable cleanup',async()=>{
 const fetchPage=jest.fn().mockResolvedValueOnce({ids:[1,2],total:4,lastPage:2}).mockRejectedValueOnce(new Error('HTTP 503'));expect(await collectSourceIds(fetchPage,2)).toMatchObject({ids:[1,2],complete:false,error:'Source list page unavailable'});const failed=await collectSourceIds(async()=>{throw new Error('HTTP 503');},2);expect(failed).toMatchObject({ids:[],expectedTotal:null,complete:false});
});
test('limits are respected rather than expanded to all pages declared by the source',async()=>{
 const fetchPage=jest.fn().mockResolvedValue({ids:[1],total:99999,lastPage:1000});expect(await collectSourceIds(fetchPage,1)).toMatchObject({ids:[1],complete:false,error:'Source page limit reached'});expect(fetchPage).toHaveBeenCalledTimes(1);for(const limit of [0,501,1.5,Infinity])await expect(collectSourceIds(fetchPage,limit)).rejects.toThrow();
});
test.each([{ids:[2,3],total:4,lastPage:2},{ids:[1,3],total:3,lastPage:2},{ids:[],total:3,lastPage:2},{ids:[3,3],total:3,lastPage:2}])('changed totals, repeated IDs and premature empty pages are incomplete: %p',async next=>{
 const pages:SourcePage[]=[{ids:[1,2],total:3,lastPage:2},next];const result=await collectSourceIds(async page=>pages[page-1],2);expect(result.complete).toBe(false);expect(new Set(result.ids).size).toBe(result.ids.length);expect(result.error).toBeTruthy();
});
test('cleanup requires complete enumeration, every detail and every successful write',()=>{
 const result={list_complete:true,debug:{detail_fail_count:0,detail_fetched_count:10,list_items_count:10}};expect(canCleanSource(result,0)).toBe(true);expect(canCleanSource({...result,list_complete:false},0)).toBe(false);expect(canCleanSource(result,1)).toBe(false);expect(canCleanSource({list_complete:true,debug:{...result.debug,detail_fail_count:1}},0)).toBe(false);expect(canCleanSource({list_complete:true,debug:{...result.debug,detail_fetched_count:9}},0)).toBe(false);expect(canCleanSource({list_complete:true},0)).toBe(false);
});
