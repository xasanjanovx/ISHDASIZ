'use client';
import {useEffect,useRef} from 'react';
import {accountApi} from '@/lib/account-api';
// Page rendering remains usable if the optional aggregate counter is unavailable.
export function PublicJobView({id}:{id:string}){
 const started=useRef<string|null>(null);
 useEffect(()=>{if(started.current===id)return;started.current=id;void accountApi(`/api/jobs/${id}/view`,{method:'POST'}).catch(()=>{});},[id]);
 return null;
}
