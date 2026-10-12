'use client';
import { useEffect,useState } from 'react';
import { useParams,useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { accountApi,AccountApiError } from '@/lib/account-api';
import type { SubmittedResumeDocument } from '@/lib/submitted-resume';
import { ResumeDocument } from '@/components/profile/submitted-resume';
import { Button } from '@/components/ui/button';
import { ArrowLeft,Loader2,Mail,MapPin,User } from '@/components/ui/icons';

type CatalogResume = SubmittedResumeDocument & { user_id: string;telegram: string | null;created_at: string | null };
export default function ResumeDetailPage() {
  const { lang } = useLanguage();const ru = lang === 'ru';
  const { user,isAuthenticated,isLoading,switchRole } = useUserAuth();
  const { openModal } = useAuthModal();const router = useRouter();const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [revision,setRevision] = useState(0);
  const actor = isAuthenticated && user ? user.id+':'+user.active_role : '';
  const key = id+':'+actor+':'+revision;
  const [result,setResult] = useState<{ key: string;resume: CatalogResume | null;error: unknown } | null>(null);
  useEffect(() => {
    if (!actor || isLoading) return;
    const controller = new AbortController();
    accountApi<{ resume: CatalogResume }>('/api/resumes/'+encodeURIComponent(id),{ signal: controller.signal })
      .then(({ resume }) => { if (!controller.signal.aborted) setResult({ key,resume,error: null }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ key,resume: null,error }); });
    return () => controller.abort();
  },[actor,id,key,isLoading]);
  const resume = result?.key === key ? result.resume : null;
  const error = result?.key === key ? result.error : null;
  const status = error instanceof AccountApiError ? error.status : 0;
  const employer = Boolean(isAuthenticated && user?.active_role === 'employer');
  const owner = Boolean(resume && user?.id === resume.user_id);
  const access = () => {
    if (isAuthenticated && user?.has_employer_profile && user.active_role !== 'employer') void switchRole('employer');
    else openModal();
  };
  const contact = () => {
    if (!resume || !employer || owner) return;
    router.push('/profile/employer/messages?chat_with='+encodeURIComponent(resume.user_id));
  };
  const back = <Button variant="ghost" onClick={() => router.push('/resumes')} className="mb-5 -ml-2 text-slate-600"><ArrowLeft className="mr-2 h-4 w-4" />{ru ? 'К списку резюме' : 'Rezyumelar ro‘yxatiga'}</Button>;
  if (isLoading || (actor && result?.key !== key)) return <main className="min-h-screen bg-slate-50 pt-28"><div className="container mx-auto px-4">{back}<p role="status" className="flex items-center gap-2 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />{ru ? 'Загружаем резюме…' : 'Rezyume yuklanmoqda…'}</p></div></main>;
  if (!actor || status === 401 || status === 403 || (resume && !employer && !owner)) return <main className="min-h-screen bg-slate-50 px-4 pt-28"><div className="mx-auto max-w-xl">{back}<section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><h1 className="text-2xl font-bold text-slate-900">{ru ? 'Резюме доступно работодателям' : 'Rezyume ish beruvchilar uchun ochiq'}</h1><p className="mt-3 leading-6 text-slate-600">{ru ? 'Войдите как работодатель, чтобы увидеть полное резюме и связаться с кандидатом.' : 'To‘liq rezyumeni ko‘rish va nomzod bilan bog‘lanish uchun ish beruvchi sifatida kiring.'}</p><Button onClick={access} className="mt-6 h-auto whitespace-normal bg-blue-600 px-5 py-3">{user?.has_employer_profile && user.active_role !== 'employer' ? (ru ? 'Переключиться на работодателя' : 'Ish beruvchi profiliga o‘tish') : (ru ? 'Войти как работодатель' : 'Ish beruvchi sifatida kirish')}</Button></section></div></main>;
  if (error || !resume) return <main className="min-h-screen bg-slate-50 px-4 pt-28"><div className="mx-auto max-w-xl">{back}<section className="rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-bold text-slate-900">{status === 404 ? (ru ? 'Резюме недоступно' : 'Rezyume mavjud emas') : (ru ? 'Не удалось загрузить резюме' : 'Rezyumeni yuklab bo‘lmadi')}</h1><p role="alert" className="mt-3 text-slate-600">{status === 404 ? (ru ? 'Кандидат мог скрыть резюме или завершить поиск работы.' : 'Nomzod rezyumeni yashirgan yoki ish qidirishni yakunlagan bo‘lishi mumkin.') : (ru ? 'Попробуйте ещё раз.' : 'Qayta urinib ko‘ring.')}</p>{status !== 404 && <Button variant="outline" onClick={() => setRevision(n => n+1)} className="mt-5">{ru ? 'Повторить загрузку' : 'Qayta yuklash'}</Button>}</section></div></main>;
  const location = [resume.regions,resume.districts].map(place => place && (ru ? place.name_ru || place.name_uz : place.name_uz || place.name_ru)).filter(Boolean).join(', ') || resume.city;
  const title = resume.title || (ru ? 'Специалист' : 'Mutaxassis');
  return <main className="min-h-screen bg-slate-50 pb-12">
    <header className="border-b border-sky-100 bg-gradient-to-br from-white via-sky-50 to-teal-50 pt-28 pb-8"><div className="container mx-auto px-4">{back}<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center"><div className="flex min-w-0 items-start gap-4"><div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-3xl">{(resume.full_name || title).charAt(0).toUpperCase()}</div><div className="min-w-0 space-y-3"><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">{ru ? 'Резюме кандидата' : 'Nomzod rezyumesi'}</p><h1 className="break-words text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{title}</h1><p className="flex items-start gap-2 break-words text-sm text-slate-600"><User className="mt-0.5 h-4 w-4 shrink-0" />{resume.full_name || (ru ? 'Имя не указано' : 'Ism ko‘rsatilmagan')}</p>{location && <p className="flex items-start gap-2 break-words text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{location}</p>}</div></div>{employer && !owner && <Button onClick={contact} className="h-auto shrink-0 whitespace-normal bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"><Mail className="mr-2 h-4 w-4" />{ru ? 'Написать кандидату' : 'Nomzodga yozish'}</Button>}</div></div></header>
    <div className="container mx-auto grid gap-6 px-4 pt-7 lg:grid-cols-[minmax(0,1fr)_300px]"><ResumeDocument resume={resume} lang={lang} variant="catalog" /><aside className="space-y-4 lg:self-start lg:sticky lg:top-24"><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">{ru ? 'Обсудите условия работы' : 'Ish shartlarini muhokama qiling'}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{ru ? 'Уточните у кандидата график, обязанности и удобное время для собеседования.' : 'Nomzod bilan ish jadvali, vazifalar va suhbat uchun qulay vaqtni kelishib oling.'}</p>{employer && !owner && <Button onClick={contact} className="mt-4 h-auto w-full whitespace-normal bg-blue-600 py-3">{ru ? 'Открыть переписку' : 'Yozishmani ochish'}</Button>}{resume.telegram && <a href={'https://t.me/'+resume.telegram} target="_blank" rel="noopener noreferrer" className="mt-4 block break-words text-sm text-blue-700 underline">Telegram: @{resume.telegram}</a>}{owner && <p className="mt-4 text-sm text-teal-700">{ru ? 'Так работодатели видят ваше опубликованное резюме.' : 'Ish beruvchilar e’lon qilingan rezyumengizni shunday ko‘radi.'}</p>}</section></aside></div>
  </main>;
}
