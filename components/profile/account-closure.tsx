'use client';
import { useRef, useState } from 'react';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useLanguage } from '@/contexts/language-context';
import { AccountApiError } from '@/lib/account-api';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
export function AccountClosure() {
  const { closeAccount } = useUserAuth(), { lang } = useLanguage();
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const lock = useRef(false);
  const close = async () => {
    if (lock.current) return;
    lock.current=true;setBusy(true);setError('');
    try { await closeAccount(); }
    catch (failure) {
      const detail = failure instanceof AccountApiError ? failure.detail?.split(' / ') : null;
      setError(detail?.[lang==='ru'?0:1] || (lang==='ru'?'Не удалось закрыть аккаунт. Попробуйте ещё раз.':'Akkauntni yopib bo‘lmadi. Qayta urinib ko‘ring.'));
    } finally { lock.current=false;setBusy(false); }
  };
  return <section className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 space-y-3">
    <h2 className="text-xl font-semibold">{lang==='ru'?'Закрытие аккаунта':'Akkauntni yopish'}</h2>
    <p className="text-sm text-slate-600">{lang==='ru'?'Вакансии и резюме будут скрыты. Данные и переписка сохранятся. Для восстановления войдите на сайт и подтвердите свой номер по SMS.':'Vakansiyalar va rezyumelar yashiriladi. Ma’lumotlar va yozishmalar saqlanadi. Tiklash uchun saytga kiring va raqamingizni SMS orqali tasdiqlang.'}</p>
    <Button variant="outline" onClick={()=>{setOpen(true);setError('');}}>{lang==='ru'?'Закрыть аккаунт':'Akkauntni yopish'}</Button>
    <AlertDialog open={open} onOpenChange={value=>{if(!lock.current)setOpen(value);}}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{lang==='ru'?'Закрыть оба профиля аккаунта?':'Akkauntdagi ikkala profil yopilsinmi?'}</AlertDialogTitle>
        <AlertDialogDescription>{lang==='ru'?'Доступ на всех устройствах и в боте прекратится. При восстановлении вернутся прежние настройки видимости вакансий и резюме.':'Barcha qurilmalarda va botda kirish to‘xtatiladi. Tiklanganda vakansiyalar va rezyumelarning oldingi ko‘rinish sozlamalari qaytadi.'}</AlertDialogDescription></AlertDialogHeader>
        {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}
        <AlertDialogFooter><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>{lang==='ru'?'Оставить аккаунт открытым':'Akkauntni ochiq qoldirish'}</Button><Button disabled={busy} onClick={close}>{busy?(lang==='ru'?'Закрываем…':'Yopilmoqda…'):(lang==='ru'?'Подтвердить закрытие':'Yopishni tasdiqlash')}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
