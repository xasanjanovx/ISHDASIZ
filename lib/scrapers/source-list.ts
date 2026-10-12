export type SourcePage={ids:number[];total:number|null;lastPage:number|null};
function integer(value:unknown):number|null{
 if(value===undefined||value===null)return null;
 if(typeof value==='string'&&!/^\d+$/.test(value))throw new Error('Invalid source pagination');
 const number=typeof value==='number'||typeof value==='string'?Number(value):NaN;
 if(!Number.isSafeInteger(number)||number<0)throw new Error('Invalid source pagination');return number;
}
/** A response without explicit pagination can provide candidates, never proof of absence. */
export function parseSourcePage(json:any,page:number,defaultPerPage:number):SourcePage{
 if(!json||typeof json!=='object'||json.error||json.success===false)throw new Error('Source list unavailable');
 const block=Array.isArray(json.data)?json:json.data??json;
 const items=block.data??block.items;
 if(!Array.isArray(items))throw new Error('Invalid source list');
 const ids=items.map((item:any)=>{const id=integer(item?.id);if(!id)throw new Error('Invalid source ID');return id;});
 const meta=block.meta??json.meta??{},total=integer(block.total??meta.total);
 const perPage=integer(block.per_page??meta.per_page??defaultPerPage);
 if(!perPage)throw new Error('Invalid source page size');
 let lastPage=integer(block.last_page??meta.last_page);
 if(lastPage===null&&total!==null)lastPage=Math.max(1,Math.ceil(total/perPage));
 const currentPage=integer(block.current_page??meta.current_page);
 if(currentPage!==null&&currentPage!==page)throw new Error('Wrong source page');
 if(total!==null&&(ids.length>total||total>0&&lastPage===0))throw new Error('Inconsistent source pagination');
 return {ids,total,lastPage};
}
export async function collectSourceIds(fetchPage:(page:number)=>Promise<SourcePage>,maxPages:number,betweenPages:()=>Promise<void>=async()=>{}){
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>500)throw new Error('Page limit must be between 1 and 500');
 const ids:number[]=[],seen=new Set<number>();let expectedTotal:number|null=null,expectedLast:number|null=null,complete=false,error:string|null=null;
 for(let page=1;page<=maxPages;page++){
  let result:SourcePage;try{result=await fetchPage(page);}catch{error='Source list page unavailable';break;}
  if(page===1){expectedTotal=result.total;expectedLast=result.lastPage;}
  if(result.total!==expectedTotal||result.lastPage!==expectedLast){error='Source list changed during enumeration';break;}
  if(result.ids.some(id=>seen.has(id))||new Set(result.ids).size!==result.ids.length){error='Source list contains repeated IDs';break;}
  result.ids.forEach(id=>{seen.add(id);ids.push(id);});
  if(expectedTotal!==null&&ids.length>expectedTotal){error='Source list exceeds declared total';break;}
  if(expectedLast!==null&&(page>=expectedLast||expectedTotal===0)){
   complete=expectedTotal!==null&&ids.length===expectedTotal;
   if(!complete)error='Source list is shorter than declared total';break;
  }
  if(result.ids.length===0){error='Source list ended without complete enumeration';break;}
  if(page===maxPages){error='Source page limit reached';break;}
  await betweenPages();
 }
 return {ids,expectedTotal,complete,error};
}
export function canCleanSource(result:{list_complete?:boolean;debug?:{detail_fail_count?:number;detail_fetched_count?:number;list_items_count?:number}},writeErrors:number){
 return result.list_complete===true&&writeErrors===0&&result.debug?.detail_fail_count===0&&result.debug?.detail_fetched_count===result.debug?.list_items_count;
}
