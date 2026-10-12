'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { accountApi, AccountApiError } from '@/lib/account-api';
import type { EmployerStatisticsPage } from '@/lib/employer-statistics';
import { AccountGate } from './account-gate';
import { ProfileLayout } from './profile-layout';
import { Button } from '@/components/ui/button';
import { PageLoading } from '@/components/layout/page-loading';
import { BarChart3, Briefcase, Eye, Users } from 'lucide-react';

const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function page(value: EmployerStatisticsPage, first: boolean) {
  if (!value || !Array.isArray(value.jobs) || value.jobs.some(job => !job || typeof job.id !== 'string'
    || typeof job.available !== 'boolean' || !count(job.views) || !count(job.applications)
    || !Number.isFinite(Date.parse(job.created_at))
    || [job.title_ru, job.title_uz].some(title => title != null && typeof title !== 'string'))
    || value.nextCursor !== null && typeof value.nextCursor !== 'string'
    || first && (!value.stats || !['items', 'active', 'views', 'applications'].every(key => count(value.stats?.[key as keyof typeof value.stats])))) {
    throw new Error('Statistics response unavailable');
  }
  return value;
}

export function EmployerStatisticsPageView() {
  return <AccountGate role="employer"><EmployerStatisticsView /></AccountGate>;
}

function EmployerStatisticsView() {
  const [revision, setRevision] = useState(0);
  return <ProfileLayout userType="employer"><StatisticsContent key={revision} refresh={() => setRevision(value => value + 1)} /></ProfileLayout>;
}

function StatisticsContent({ refresh }: { refresh: () => void }) {
  const { lang } = useLanguage(), ru = lang === 'ru';
  const [snapshot, setSnapshot] = useState<EmployerStatisticsPage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const alive = useRef(false), busy = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    const read = new AbortController();
    controller.current = read;
    accountApi<EmployerStatisticsPage>('/api/account/vacancies/stats', { signal: read.signal })
      .then(value => { const valid = page(value, true); if (!cancelled) setSnapshot(valid); })
      .catch(reason => { if (!cancelled) setError(reason); });
    return () => { cancelled = true; alive.current = false; controller.current?.abort(); };
  }, []);
  const more = async () => {
    if (busy.current || !snapshot?.nextCursor) return;
    busy.current = true; setMoreLoading(true); setError(null);
    const read = new AbortController(); controller.current = read;
    try {
      const next = page(await accountApi<EmployerStatisticsPage>(`/api/account/vacancies/stats?before=${encodeURIComponent(snapshot.nextCursor)}`, { signal: read.signal }), false);
      if (alive.current) setSnapshot(previous => previous && ({ ...previous,
        jobs: Array.from(new Map([...previous.jobs, ...next.jobs].map(job => [job.id, job])).values()), nextCursor: next.nextCursor,
      }));
    } catch (reason) { if (alive.current) setError(reason); }
    finally { busy.current = false; if (alive.current) setMoreLoading(false); }
  };
  const expired = error instanceof AccountApiError && [401, 403].includes(error.status);
  const cursorGone = error instanceof AccountApiError && error.status === 404;
  const text = expired ? (ru ? 'Войдите в профиль работодателя, чтобы увидеть статистику.' : 'Statistikani ko‘rish uchun ish beruvchi profiliga kiring.')
    : ru ? 'Не удалось загрузить статистику. Попробуйте ещё раз.' : 'Statistikani yuklab bo‘lmadi. Qayta urinib ko‘ring.';
  const format = (value: number) => value.toLocaleString(ru ? 'ru-RU' : 'uz-UZ');
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <p className="mb-2 text-sm font-medium text-sky-700">{ru ? 'Ваши результаты' : 'Natijalaringiz'}</p>
      <h1 className="text-2xl font-semibold text-slate-950">{ru ? 'Статистика вакансий' : 'Vakansiyalar statistikasi'}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{ru ? 'Итоги по всем вашим вакансиям, включая архив. Доступные вакансии могут видеть соискатели.' : 'Arxiv bilan birga barcha vakansiyalaringiz natijalari. Mavjud vakansiyalarni ish izlovchilar ko‘ra oladi.'}</p>
    </div><Button variant="outline" disabled={moreLoading} onClick={refresh}>{ru ? 'Обновить' : 'Yangilash'}</Button></div>
    {!!error && <div role="alert" className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><p>{text}</p>
      <Button variant="outline" disabled={moreLoading} onClick={snapshot && !expired && !cursorGone ? more : refresh}>{ru ? 'Повторить загрузку' : 'Qayta yuklash'}</Button>
    </div>}
    {!snapshot && !error ? <PageLoading /> : snapshot && !expired && <>
      {snapshot.stats && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: ru ? 'Всего вакансий' : 'Jami vakansiyalar', value: snapshot.stats.items, Icon: Briefcase },
        { label: ru ? 'Доступны соискателям' : 'Ish izlovchilarga ochiq', value: snapshot.stats.active, Icon: BarChart3 },
        { label: ru ? 'Просмотры' : 'Ko‘rishlar', value: snapshot.stats.views, Icon: Eye },
        { label: ru ? 'Отклики' : 'Arizalar', value: snapshot.stats.applications, Icon: Users },
      ].map(({ label, value, Icon }) => <section key={label} aria-label={label} className="rounded-2xl border border-slate-200 bg-white p-5"><Icon aria-hidden="true" className="mb-4 size-5 text-sky-600" /><p className="break-words text-2xl font-semibold text-slate-950">{format(value)}</p><h2 className="mt-1 text-sm text-slate-500">{label}</h2></section>)}</div>}
      <section className="space-y-4"><h2 className="text-lg font-semibold text-slate-950">{ru ? 'По вакансиям' : 'Vakansiyalar bo‘yicha'}</h2>
        {!snapshot.jobs.length ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="mb-4 text-slate-600">{ru ? 'У вас пока нет вакансий.' : 'Hozircha vakansiyalaringiz yo‘q.'}</p><Button asChild><Link href="/profile/employer/vacancies/new">{ru ? 'Создать вакансию' : 'Vakansiya yaratish'}</Link></Button></div>
          : snapshot.jobs.map(job => <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-950"><Link className="hover:text-sky-700 hover:underline" href={`/profile/employer/vacancies/${job.id}`}>{(ru ? job.title_ru || job.title_uz : job.title_uz || job.title_ru) || (ru ? 'Без названия' : 'Nomsiz')}</Link></h3><p className="mt-1 text-xs text-slate-500">{new Date(job.created_at).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ')}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs ${job.available ? 'bg-teal-50 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>{job.available ? (ru ? 'Доступна соискателям' : 'Ish izlovchilarga ochiq') : (ru ? 'Не опубликована' : 'Nashr etilmagan')}</span></div>
            <dl className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-sky-50 p-3"><dt className="text-xs text-slate-600">{ru ? 'Просмотры' : 'Ko‘rishlar'}</dt><dd className="mt-1 text-lg font-semibold text-sky-800">{format(job.views)}</dd></div><div className="rounded-xl bg-teal-50 p-3"><dt className="text-xs text-slate-600">{ru ? 'Отклики' : 'Arizalar'}</dt><dd className="mt-1 text-lg font-semibold text-teal-800">{format(job.applications)}</dd></div></dl>
          </article>)}
      </section>
      {snapshot.nextCursor && <Button variant="outline" disabled={moreLoading} onClick={more}>{moreLoading ? (ru ? 'Загрузка…' : 'Yuklanmoqda…') : (ru ? 'Ещё вакансии' : 'Yana vakansiyalar')}</Button>}
    </>}
  </div>;
}
