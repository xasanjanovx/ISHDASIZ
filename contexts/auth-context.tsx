'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {User,Session} from '@supabase/supabase-js';
import {supabase} from '@/lib/supabase';
import type {AdminProfile} from '@/types/database';
import {adminApi} from '@/lib/admin-api';
import {AccountApiError} from '@/lib/account-api';

interface AuthContextType {
 user:User|null;session:Session|null;adminProfile:AdminProfile|null;loading:boolean;error:unknown;
 signIn:(email:string,password:string)=>Promise<{error:Error|null}>;
 signOut:()=>Promise<void>;refresh:()=>Promise<void>;
}
const AuthContext=createContext<AuthContextType|undefined>(undefined);
const guest={user:null,session:null,adminProfile:null,loading:false,error:null};
type Snapshot={user:User|null;session:Session|null;adminProfile:AdminProfile|null;loading:boolean;error:unknown};
export function AuthProvider({children}:{children:ReactNode}){
 const [snapshot,setSnapshot]=useState<Snapshot>({...guest,loading:true});
 const revision=useRef(0),alive=useRef(true),operation=useRef<{id:number;kind:'in'|'out';email?:string}|null>(null);
 const authAttempt=useRef<Promise<unknown>|null>(null);
 const invalidate=useCallback(()=>{revision.current++;},[]);
 const validate=useCallback(async(next:Session|null,bootstrap:boolean,key:number)=>{
  if(!alive.current||revision.current!==key)return;
  if(!next){setSnapshot(guest);return;}
  setSnapshot(previous=>previous.user?.id===next.user.id&&previous.adminProfile&&!bootstrap?{...previous,session:next,user:next.user,error:null}:{session:next,user:next.user,adminProfile:null,loading:true,error:null});
  try{
   const result=await adminApi<{profile:AdminProfile}>(next.access_token,bootstrap?'/api/admin/ensure-profile':'/api/admin/session',bootstrap?{method:'POST'}:{});
   if(!result.profile||result.profile.id!==next.user.id||result.profile.disabled_at||!['super_admin','hokimlik_assistant'].includes(result.profile.role))throw new AccountApiError(403);
   if(alive.current&&revision.current===key)setSnapshot({session:next,user:next.user,adminProfile:result.profile,loading:false,error:null});
   return result.profile;
  }catch(error){if(alive.current&&revision.current===key)setSnapshot(previous=>({session:next,user:next.user,adminProfile:!(error instanceof AccountApiError&&[401,403].includes(error.status))&&previous.user?.id===next.user.id?previous.adminProfile:null,loading:false,error}));throw error;}
 },[]);
 useEffect(()=>{
  alive.current=true;const initial=revision.current;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
   const pending=operation.current;
   // The explicit login/logout owns its matching event and performs its own check.
   if(pending?.kind==='out'||pending?.kind==='in'&&next?.user.email?.trim().toLowerCase()===pending.email)return;
   const key=++revision.current;queueMicrotask(()=>{void validate(next,false,key).catch(()=>{});});
  });
  void supabase.auth.getSession().then(result=>{
   if(!alive.current||revision.current!==initial)return;
   if(result.error)throw result.error;return validate(result.data.session,false,initial);
  }).catch(error=>{if(alive.current&&revision.current===initial)setSnapshot({...guest,error});});
  return()=>{alive.current=false;invalidate();subscription.unsubscribe();};
 },[validate,invalidate]);
 const signIn=useCallback(async(email:string,password:string)=>{
  if(operation.current)return {error:new Error('Authentication already in progress')};
  const key=++revision.current;operation.current={id:key,kind:'in',email:email.trim().toLowerCase()};
  try{
   const pending=supabase.auth.signInWithPassword({email:email.trim(),password});authAttempt.current=pending;
   const result=await pending;authAttempt.current=null;if(result.error)throw result.error;
   if(!result.data.session)throw new AccountApiError(401);
   if(revision.current!==key)return {error:new AccountApiError(401)};
   await validate(result.data.session,true,key);
   if(revision.current!==key||!alive.current)return {error:new AccountApiError(401)};
   return {error:null};
  }catch(error){
   if(revision.current===key&&alive.current)setSnapshot(previous=>({...previous,loading:false,error}));
   if(revision.current===key&&alive.current&&error instanceof AccountApiError&&error.status===403){
    operation.current={id:key,kind:'out'};
    const result=await supabase.auth.signOut();if(!result.error&&revision.current===key)setSnapshot(guest);
    return {error};
   }
   return {error:error instanceof Error?error:new Error('Authentication unavailable')};
  }finally{authAttempt.current=null;if(operation.current?.id===key)operation.current=null;}
 },[validate]);
 const signOut=useCallback(async()=>{
  const key=++revision.current;operation.current={id:key,kind:'out'};
  try{await authAttempt.current?.catch(()=>{});const result=await supabase.auth.signOut();if(result.error)throw result.error;if(alive.current&&revision.current===key)setSnapshot(guest);}
  finally{if(operation.current?.id===key)operation.current=null;}
 },[]);
 const refresh=useCallback(async()=>{
  if(operation.current)return;const key=++revision.current;
  try{const result=await supabase.auth.getSession();if(result.error)throw result.error;await validate(result.data.session,false,key);}
  catch(error){if(alive.current&&revision.current===key)setSnapshot(previous=>({...previous,adminProfile:error instanceof AccountApiError&&[401,403].includes(error.status)?null:previous.adminProfile,loading:false,error}));}
 },[validate]);
 return <AuthContext.Provider value={{...snapshot,signIn,signOut,refresh}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context;}
