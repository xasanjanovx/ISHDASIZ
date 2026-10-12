'use client';

import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { AccountGate } from './account-gate';
import { ProfileLayout } from './profile-layout';
import { Button } from '@/components/ui/button';
import { Card,CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Loader2,Mail,ArrowRight } from '@/components/ui/icons';
import { ApplicationModal } from '@/components/jobs/application-modal';
import { accountApi } from '@/lib/account-api';
import { invitationErrorText,type Invitation,type InvitationDetail,type InvitationPage } from '@/lib/invitation-api';

const titleOf = (offer: Invitation,ru: boolean) => (ru ? offer.job?.title_ru || offer.job?.title_uz : offer.job?.title_uz || offer.job?.title_ru) || offer.job?.title || (ru ? 'Вакансия недоступна' : 'Vakansiya mavjud emas');
const dateOf = (value: string | null,ru: boolean) => value ? new Date(value).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ',{ timeZone: 'Asia/Tashkent',year: 'numeric',month: ru ? 'short' : '2-digit',day: 'numeric' }) : '—';

export function InvitationsPage() {
  const { user } = useUserAuth();
  return <AccountGate><ProfileLayout userType="job_seeker"><InvitationList key={user?.id || 'guest'} userId={user?.id} /></ProfileLayout></AccountGate>;
}
function InvitationList({ userId }: { userId: string | undefined }) {
  const { lang } = useLanguage(),ru = lang === 'ru';
  const [revision,setRevision] = useState(0);
  const [page,setPage] = useState<InvitationPage | null>(null);
  const [error,setError] = useState<unknown>(null);
  const [more,setMore] = useState({ loading: false,error: null as unknown });
  const [selection,setSelection] = useState<string | null>(null);
  const [detail,setDetail] = useState<InvitationDetail | null>(null);
  const [detailError,setDetailError] = useState<{ id: string; error: unknown } | null>(null);
  const [detailRevision,setDetailRevision] = useState(0);
  const [seenError,setSeenError] = useState(false);
  const [seenRevision,setSeenRevision] = useState(0);
  const [application,setApplication] = useState<{ id: string; title: string; company_name?: string } | null>(null);
  const active = useRef(false),generation = useRef(0),morePending = useRef(false),moreController = useRef<AbortController | null>(null);

  useEffect(() => { active.current = true; return () => { active.current = false; moreController.current?.abort(); }; },[]);
  useEffect(() => {
    const request = ++generation.current,controller = new AbortController();
    morePending.current = false;moreController.current?.abort();
    if (userId) accountApi<InvitationPage>('/api/account/offers',{ signal: controller.signal })
      .then(result => { if (!controller.signal.aborted && request === generation.current) setPage(result); })
      .catch(reason => { if (!controller.signal.aborted && request === generation.current) setError(reason); });
    return () => controller.abort();
  },[userId,revision]);
  const loadMore = async () => {
    if (!page?.nextCursor || morePending.current) return;
    const cursor = page.nextCursor,request = generation.current,controller = new AbortController();
    moreController.current = controller;morePending.current = true;setMore({ loading: true,error: null });
    try {
      const result = await accountApi<InvitationPage>('/api/account/offers?before='+encodeURIComponent(cursor),{ signal: controller.signal });
      if (!active.current || controller.signal.aborted || request !== generation.current) return;
      setPage(current => current && current.nextCursor === cursor ? { offers: [...current.offers,...result.offers.filter(row => !current.offers.some(old => old.id === row.id))],nextCursor: result.nextCursor } : current);
    } catch (reason) { if (active.current && !controller.signal.aborted && request === generation.current) setMore({ loading: false,error: reason }); }
    finally { if (active.current && request === generation.current) { morePending.current = false;setMore(current => ({ ...current,loading: false })); } }
  };
  useEffect(() => {
    const controller = new AbortController();
    if (selection) accountApi<{ offer: InvitationDetail }>('/api/account/offers/'+selection,{ signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        setDetail(result.offer);
        if (result.offer.seen_at !== null) setPage(current => current ? { ...current,offers: current.offers.map(row => row.id === result.offer.id ? { ...row,seen_at: result.offer.seen_at } : row) } : current);
      })
      .catch(reason => { if (!controller.signal.aborted) setDetailError({ id: selection,error: reason }); });
    return () => controller.abort();
  },[selection,detailRevision]);
  useEffect(() => {
    if (!detail || detail.id !== selection || detail.seen_at !== null) return;
    const controller = new AbortController(),id = detail.id;
    accountApi<{ id: string; seen_at: string }>('/api/account/offers/'+id+'/seen',{ method: 'POST',signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (result.id !== id || typeof result.seen_at !== 'string' || !Number.isFinite(Date.parse(result.seen_at))) { setSeenError(true);return; }
        setDetail(current => current?.id === id ? { ...current,seen_at: result.seen_at } : current);
        setPage(current => current ? { ...current,offers: current.offers.map(row => row.id === id ? { ...row,seen_at: result.seen_at } : row) } : current);
      }).catch(() => { if (!controller.signal.aborted) setSeenError(true); });
    return () => controller.abort();
  },[detail,selection,seenRevision]);

  const shown = detail?.id === selection ? detail : null;
  const shownError = detailError?.id === selection ? detailError.error : null;
  return <div className="space-y-6">
    <div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><Mail className="size-6" /></div><div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{ru ? 'Приглашения' : 'Takliflar'}</h1>
      <p className="mt-1 text-sm leading-6 text-slate-500">{ru ? 'Откройте вакансию и отправьте отклик со своим резюме.' : 'Vakansiyani oching va o‘z rezyumengiz bilan ariza yuboring.'}</p>
    </div></div>
    {error ? <Card><CardContent className="space-y-4 p-6"><p role="alert">{invitationErrorText(error,lang)}</p><Button onClick={() => { setPage(null);setError(null);setMore({ loading: false,error: null });setRevision(value => value+1); }}>{ru ? 'Повторить загрузку' : 'Qayta yuklash'}</Button></CardContent></Card>
      : !page ? <div role="status" className="flex items-center gap-3 p-8 text-slate-500"><Loader2 className="size-5 animate-spin" />{ru ? 'Загружаем приглашения…' : 'Takliflar yuklanmoqda…'}</div>
        : !page.offers.length ? <Card><CardContent className="space-y-3 p-8"><h2 className="font-semibold">{ru ? 'Приглашений пока нет' : 'Hozircha takliflar yo‘q'}</h2><p className="text-sm text-slate-500">{ru ? 'Активное публичное резюме поможет работодателям найти вас.' : 'Faol ochiq rezyume ish beruvchilarga sizni topishga yordam beradi.'}</p><Button asChild variant="outline"><Link href="/profile/job-seeker/resumes">{ru ? 'Мои резюме' : 'Rezyumelarim'}</Link></Button></CardContent></Card>
          : <div className="space-y-3">{page.offers.map(offer => <Card key={offer.id} className={offer.seen_at ? 'border-slate-200 shadow-none' : 'border-sky-200 shadow-sm'}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words font-semibold text-slate-900">{titleOf(offer,ru)}</h2>{!offer.seen_at && <Badge className="bg-sky-100 text-sky-700">{ru ? 'Новое' : 'Yangi'}</Badge>}</div>
              {offer.job?.company_name && <p className="text-sm text-slate-600">{offer.job.company_name}</p>}<p className="text-xs text-slate-400">{dateOf(offer.created_at,ru)}</p></div>
            <Button variant="outline" className="shrink-0" onClick={() => { setDetail(null);setDetailError(null);setSeenError(false);setSelection(offer.id); }}>{ru ? 'Открыть приглашение' : 'Taklifni ochish'}<ArrowRight className="ml-2 size-4" /></Button>
          </CardContent></Card>)}</div>}
    {more.error ? <div className="space-y-3"><p role="alert" className="text-sm text-rose-700">{invitationErrorText(more.error,lang)}</p><Button variant="outline" onClick={loadMore}>{ru ? 'Повторить загрузку' : 'Qayta yuklash'}</Button></div>
      : page?.nextCursor && <Button variant="outline" disabled={more.loading} onClick={loadMore}>{more.loading && <Loader2 className="mr-2 size-4 animate-spin" />}{ru ? 'Ещё приглашения' : 'Yana takliflar'}</Button>}
    <Dialog open={selection !== null} onOpenChange={open => { if (!open) setSelection(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader>
      <DialogTitle>{shown ? titleOf(shown,ru) : ru ? 'Приглашение' : 'Taklif'}</DialogTitle><DialogDescription>{shown ? dateOf(shown.created_at,ru) : ru ? 'Загружаем сведения…' : 'Ma’lumotlar yuklanmoqda…'}</DialogDescription>
    </DialogHeader>{shownError ? <div className="space-y-3"><p role="alert">{invitationErrorText(shownError,lang)}</p><Button onClick={() => { setDetail(null);setDetailError(null);setSeenError(false);setDetailRevision(value => value+1); }}>{ru ? 'Повторить загрузку' : 'Qayta yuklash'}</Button></div>
      : !shown ? <div role="status" className="py-8"><Loader2 className="mx-auto size-6 animate-spin text-sky-600" /><span className="sr-only">{ru ? 'Загрузка приглашения' : 'Taklif yuklanmoqda'}</span></div>
        : <div className="space-y-5">
          {shown.job_available && shown.job ? <div className="space-y-3"><p className="font-medium text-slate-700">{shown.job.company_name}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{ru ? shown.job.description_ru || shown.job.description_uz : shown.job.description_uz || shown.job.description_ru}</p></div>
            : <p className="rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">{ru ? 'Эта вакансия больше недоступна. Приглашение сохранено в истории.' : 'Bu vakansiya endi mavjud emas. Taklif tarixda saqlangan.'}</p>}
          {shown.message && <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-2 text-sm font-medium">{ru ? 'Сообщение работодателя' : 'Ish beruvchi xabari'}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6">{shown.message}</p></div>}
          {shown.resume && <Link className="block text-sm text-sky-700 underline underline-offset-4" href={'/profile/job-seeker/resumes/'+shown.resume.id}>{ru ? 'Ваше резюме: ' : 'Rezyumengiz: '}{shown.resume.title || (ru ? 'Открыть' : 'Ochish')}</Link>}
          {seenError && <div className="space-y-2"><p role="alert" className="text-sm text-amber-800">{ru ? 'Не удалось отметить приглашение прочитанным.' : 'Taklifni o‘qilgan deb belgilab bo‘lmadi.'}</p><Button variant="outline" onClick={() => { setSeenError(false);setSeenRevision(value => value+1); }}>{ru ? 'Повторить отметку' : 'Qayta belgilash'}</Button></div>}
          {shown.job_available && shown.job && <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={'/jobs/'+shown.job.id}>{ru ? 'Открыть вакансию' : 'Vakansiyani ochish'}</Link></Button>
            {shown.job.is_imported !== true && shown.job.source !== 'osonish' && <Button onClick={() => { setApplication({ id: shown.job!.id,title: titleOf(shown,ru),company_name: shown.job!.company_name });setSelection(null); }}>{ru ? 'Откликнуться с резюме' : 'Rezyume bilan ariza yuborish'}</Button>}</div>}
        </div>}
    </DialogContent></Dialog>
    {application && <ApplicationModal isOpen job={application} onClose={() => setApplication(null)} />}
  </div>;
}
