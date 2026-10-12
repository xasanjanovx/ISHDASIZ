export function sourceSnapshot(body:any){
 if(!body||typeof body!=='object'||typeof body.source!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(body.source)||body.source==='local')throw new Error('Invalid external source');
 const values=(value:any)=>{if(!Array.isArray(value)||value.length>100000||value.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim()||/\s/.test(id)||id.length>128)||new Set(value).size!==value.length)throw new Error('Invalid source ID list');return new Set<string>(value);};
 const listed=values(body.listed_source_ids),active=values(body.active_source_ids),filled=values(body.filled_source_ids??[]),removed=values(body.removed_source_ids??[]);
 if(body.list_complete!==true||!Number.isSafeInteger(body.list_total)||body.list_total<0||listed.size!==body.list_total)throw new Error('Complete source enumeration required');
 const classified=[...Array.from(active),...Array.from(filled),...Array.from(removed)];
 if(new Set(classified).size!==classified.length||classified.length!==listed.size||classified.some(id=>!listed.has(id)))throw new Error('All listed source IDs must have one confirmed state');
 return {source:body.source as string,listed,active,filled,removed};
}
