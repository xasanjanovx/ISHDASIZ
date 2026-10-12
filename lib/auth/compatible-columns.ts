import type {SupabaseClient} from '@supabase/supabase-js';
// Keep existing lifecycle columns when another optional column is not installed.
export async function compatibleColumns(client:SupabaseClient,table:string,fields:string,optional:string[],key:string,value:string){
 let selected=Array.from(new Set([...fields.split(','),...optional]));
 for(let attempt=0;attempt<=optional.length;attempt++){
  const result=await client.from(table).select(selected.join(',')).eq(key,value).maybeSingle();
  const missing=result.error&&['42703','PGRST204'].includes(result.error.code)&&optional.filter(column=>selected.includes(column)&&new RegExp(`\\b${column}\\b`).test(result.error!.message));
  if(!missing||missing.length!==1)return result;
  selected=selected.filter(column=>column!==missing[0]);
 }
 throw new Error('Column compatibility unavailable');
}
