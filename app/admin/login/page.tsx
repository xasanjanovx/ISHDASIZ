'use client';
import {useState,useEffect,useRef,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {useLanguage} from '@/contexts/language-context';
import {useAuth} from '@/contexts/auth-context';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Card,CardContent,CardHeader,CardTitle,CardDescription} from '@/components/ui/card';
import {BadgeCheck,Loader2,Lock} from '@/components/ui/icons';
import {adminErrorText} from '@/lib/admin-api';
import {AccountApiError} from '@/lib/account-api';
function loginError(error:unknown,ru:boolean){
 if(error instanceof AccountApiError)return adminErrorText(error,ru);
 const code=(error as {code?:string}|null)?.code;
 if(code==='invalid_credentials')return ru?'Неверный email или пароль.':'Email yoki parol noto‘g‘ri.';
 if(code==='email_not_confirmed')return ru?'Подтвердите email перед входом.':'Kirishdan oldin emailni tasdiqlang.';
 return ru?'Не удалось войти. Повторите попытку.':'Kirish amalga oshmadi. Qayta urinib ko‘ring.';
}
export default function AdminLoginPage(){
 const {t,lang}=useLanguage(),ru=lang==='ru',auth=useAuth(),router=useRouter();
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!auth.loading&&auth.user&&auth.adminProfile)router.replace('/admin');},[auth.loading,auth.user,auth.adminProfile,router]);
 async function submit(event:FormEvent){
  event.preventDefault();if(lock.current||auth.loading)return;lock.current=true;setBusy(true);setError(null);
  try{const result=await auth.signIn(email.trim(),password);if(alive.current){setPassword('');if(result.error)setError(result.error);}}
  catch(failure){if(alive.current)setError(failure);}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const visibleError=error||auth.error;
 const retry=auth.user&&!auth.adminProfile&&Boolean(auth.error)&&!(auth.error instanceof AccountApiError&&[401,403].includes(auth.error.status));
 return <div className="min-h-[75vh] flex items-center justify-center bg-gradient-to-br from-accent to-secondary p-4"><Card className="w-full max-w-md rounded-2xl border-border shadow-sm">
  <CardHeader className="text-center"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent flex items-center justify-center"><Lock className="w-8 h-8 text-primary"/></div><CardTitle className="flex items-center justify-center gap-2">ISHDASIZ<BadgeCheck className="w-5 h-5 text-primary"/></CardTitle><CardDescription>{t.admin.loginTitle}</CardDescription></CardHeader>
  <CardContent className="space-y-4">{auth.loading&&<p role="status" className="flex gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{ru?'Проверяем доступ…':'Kirish tekshirilmoqda…'}</p>}
   {Boolean(visibleError)&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loginError(visibleError,ru)}</p>}
   {retry&&<Button variant="outline" disabled={busy||auth.loading} onClick={()=>{setError(null);void auth.refresh();}}>{ru?'Повторить проверку доступа':'Kirishni qayta tekshirish'}</Button>}
   <form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="admin-email">{t.admin.email}</Label><Input id="admin-email" type="email" autoComplete="username" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} required disabled={busy}/></div>
    <div className="space-y-2"><Label htmlFor="admin-password">{t.admin.password}</Label><Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required disabled={busy}/></div>
    <Button type="submit" className="w-full" disabled={busy||auth.loading}>{busy&&<Loader2 className="w-4 h-4 mr-2 animate-spin"/>}{t.admin.login}</Button>
   </form>
  </CardContent>
 </Card></div>;
}
