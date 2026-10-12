'use client';
import {useEffect,useState} from 'react';
import {useAdminApi} from './admin-gate';
export function useAdminData<T>(url:string){
 const api=useAdminApi(),[revision,setRevision]=useState(0),key=`${url}:${revision}`;
 const [snapshot,setSnapshot]=useState<{key:string;data:T|null;error:unknown}|null>(null);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  api<T>(url,{signal:controller.signal}).then(data=>{if(!cancelled)setSnapshot({key,data,error:null});}).catch(error=>{if(!cancelled)setSnapshot({key,data:null,error});});
  return()=>{cancelled=true;controller.abort();};
 },[api,url,key]);
 return {data:snapshot?.key===key?snapshot.data:null,error:snapshot?.key===key?snapshot.error:null,loading:snapshot?.key!==key,reload:()=>setRevision(value=>value+1)};
}
