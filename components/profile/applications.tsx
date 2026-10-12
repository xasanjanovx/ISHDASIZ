'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { ProfileLayout } from './profile-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { interviewFromLocal,interviewToLocal } from '@/lib/interview-time';
import type { ApplicationDecisionDetails } from '@/lib/application-decision';
import { Loader2, FileText, Eye, Phone, Mail, MapPin } from '@/components/ui/icons';
import { SubmittedResume } from './submitted-resume';
import { useApplications } from '@/hooks/use-applications';
import { APPLICATION_STATUSES, normalizeApplicationStatus } from '@/lib/application-status';
import { applicationErrorText, type AccountApplication } from '@/lib/application-api';

type Role = 'employer' | 'job_seeker';
const labels = {
  pending: ['Yangi', 'Новый'], reviewed: ['Ko‘rib chiqildi', 'Просмотрен'],
  interview_set: ['Suhbat', 'Собеседование'], accepted: ['Qabul qilindi', 'Принят'],
  rejected: ['Rad etildi', 'Отклонён'], hired: ['Ishga olindi', 'Нанят'],
};
const colors = {
  pending: 'bg-sky-100 text-sky-800', reviewed: 'bg-slate-100 text-slate-700',
  interview_set: 'bg-indigo-100 text-indigo-800', accepted: 'bg-teal-100 text-teal-800',
  rejected: 'bg-rose-100 text-rose-800', hired: 'bg-emerald-100 text-emerald-800',
};
const titleOf = (app: AccountApplication, lang: 'uz' | 'ru') => (lang === 'ru' ? app.jobs?.title_ru || app.jobs?.title_uz : app.jobs?.title_uz || app.jobs?.title_ru) || (lang === 'ru' ? 'Вакансия недоступна' : 'Vakansiya mavjud emas');
function dateOf(value: string, lang: 'uz' | 'ru') {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { year: 'numeric',month: lang === 'uz' ? '2-digit' : 'short',day: '2-digit',hour: '2-digit',minute: '2-digit',timeZone: 'Asia/Tashkent' }) : '—';
}

export function ApplicationsPage({ role }: { role: Role }) {
  const { user, isLoading } = useUserAuth();
  const { lang } = useLanguage();
  const { openModal } = useAuthModal();
  return <ProfileLayout userType={role}>
    {isLoading ? <div role="status" className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-sky-600" /><span className="sr-only">{lang === 'ru' ? 'Загрузка' : 'Yuklanmoqda'}</span></div>
      : user ? <ApplicationList key={`${user.id}:${role}`} userId={user.id} role={role} />
        : <Card><CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-xl font-semibold">{lang === 'ru' ? 'Войдите, чтобы увидеть отклики' : 'Arizalarni ko‘rish uchun kiring'}</h1>
          <Button onClick={openModal}>{lang === 'ru' ? 'Войти' : 'Kirish'}</Button>
        </CardContent></Card>}
  </ProfileLayout>;
}

function ApplicationList({ userId, role }: { userId: string; role: Role }) {
  const { lang } = useLanguage();
  const ru = lang === 'ru', employer = role === 'employer';
  const [filter, setFilter] = useState('all');
  const list = useApplications(userId, role, filter);
  const [detail, setDetail] = useState<AccountApplication | null>(null);
  const [showResume,setShowResume] = useState(false);
  const [interview,setInterview] = useState<{ id: string; date: string; address: string; message: string } | null>(null);
  const [interviewError,setInterviewError] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const alive = useRef(false);
  const selection = useRef<string | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const saving = list.busyIds.length > 0;
  const label = (status: string) => labels[normalizeApplicationStatus(status)][ru ? 1 : 0];
  const badge = (status: string) => <Badge className={colors[normalizeApplicationStatus(status)]}>{label(status)}</Badge>;
  const update = async (app: AccountApplication, action: 'view' | 'status', status?: string,details?: ApplicationDecisionDetails) => {
    setActionError(null);
    try {
      const saved = await list.patchApplication(app, action, status,details);
      if (saved && alive.current && selection.current === app.id) setDetail(saved);
      return saved;
    } catch (error) { if (alive.current) setActionError(error); return null; }
  };
  const open = (app: AccountApplication) => {
    selection.current = app.id; setDetail(app); setActionError(null);setInterview(null);setInterviewError(false);setShowResume(false);
    void update(app, 'view');
  };
  const schedule = (app: AccountApplication,openDetail = false) => {
    if (openDetail) open(app);
    setInterview({ id: app.id,date: interviewToLocal(app.interview_date),address: app.interview_address || '',message: app.employer_message || '' });setInterviewError(false);setActionError(null);
  };
  const submitInterview = async (event: React.FormEvent) => {
    event.preventDefault();if (!detail || interview?.id !== detail.id || saving) return;
    const date = interviewFromLocal(interview.date);if (!date) { setInterviewError(true);return; }
    setInterviewError(false);
    const saved = await update(detail,'status','interview_set',{ interview_date: date,interview_address: interview.address.trim() || null,employer_message: interview.message.trim() || null });
    if (saved && alive.current && selection.current === detail.id) setInterview(null);
  };
  const feedback = (app: AccountApplication) => <div className="space-y-2 text-sm">
    {app.interview_date && normalizeApplicationStatus(app.status) === 'interview_set' && <p><strong>{ru ? 'Собеседование: ' : 'Suhbat: '}</strong>{dateOf(app.interview_date, lang)} (UTC+5){app.interview_address && ` · ${app.interview_address}`}</p>}
    {app.employer_phone && <p><strong>{ru ? 'Контакт работодателя: ' : 'Ish beruvchi telefoni: '}</strong><a href={'tel:'+app.employer_phone} className="text-sky-700 underline">{app.employer_phone}</a></p>}
    {app.employer_message && <p className="whitespace-pre-wrap break-words"><strong>{ru ? 'Ответ работодателя: ' : 'Ish beruvchining javobi: '}</strong>{app.employer_message}</p>}
    {app.rejection_reason && normalizeApplicationStatus(app.status) === 'rejected' && <p className="whitespace-pre-wrap break-words"><strong>{ru ? 'Причина отказа: ' : 'Rad etish sababi: '}</strong>{app.rejection_reason}</p>}
  </div>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-slate-900">{employer ? (ru ? 'Отклики на вакансии' : 'Vakansiyalarga arizalar') : (ru ? 'Мои отклики' : 'Mening arizalarim')}</h1>
        <p className="mt-1 text-slate-500">{employer ? (ru ? 'Откройте отклик, чтобы ознакомиться с кандидатом' : 'Nomzod bilan tanishish uchun arizani oching') : (ru ? 'Следите за ответами работодателей' : 'Ish beruvchilarning javoblarini kuzating')}</p></div>
      <Button variant="outline" onClick={list.refresh} disabled={saving || list.isLoadingMore || list.isLoading}>{ru ? 'Обновить' : 'Yangilash'}</Button>
    </div>
    {list.stats && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(['total', 'pending', 'interview_set', 'accepted'] as const).map(status => <Card key={status}><CardContent className="p-4"><p className="text-2xl font-bold text-sky-700">{list.stats?.[status]}</p><p className="text-sm text-slate-500">{status === 'total' ? (ru ? 'Всего' : 'Jami') : label(status)}</p></CardContent></Card>)}
    </div>}
    <label className="flex items-center gap-3 text-sm text-slate-600">{ru ? 'Статус' : 'Holat'}
      <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900" value={filter} onChange={event => { setFilter(event.target.value); setActionError(null); }} disabled={saving || list.isLoadingMore}>
        <option value="all">{ru ? 'Все' : 'Hammasi'}</option>{APPLICATION_STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}
      </select>
    </label>
    {!!(list.error || list.notice || actionError) && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>{applicationErrorText(list.error || actionError || list.notice, lang)}</p><Button variant="outline" size="sm" disabled={saving || list.isLoadingMore} onClick={() => { setActionError(null); void list.retry(); }}>{ru ? 'Повторить' : 'Qayta urinish'}</Button>
    </div>}
    {list.isLoading ? <div role="status" className="flex items-center justify-center gap-2 py-12"><Loader2 className="size-6 animate-spin text-sky-600" />{ru ? 'Загрузка откликов…' : 'Arizalar yuklanmoqda…'}</div>
      : !list.error && !list.applications.length ? <Card><CardContent className="space-y-4 py-12 text-center"><FileText className="mx-auto size-10 text-slate-400" /><h2 className="text-lg font-semibold">{ru ? 'Откликов пока нет' : 'Hozircha arizalar yo‘q'}</h2>
        <p className="text-slate-500">{filter !== 'all' ? (ru ? 'Попробуйте другой статус' : 'Boshqa holatni tanlang') : employer ? (ru ? 'Здесь появятся отклики на ваши вакансии' : 'Vakansiyalaringizga arizalar shu yerda ko‘rinadi') : (ru ? 'Откликнитесь на подходящую вакансию' : 'Mos vakansiyaga ariza yuboring')}</p>
        {!employer && <Button asChild><Link href="/jobs">{ru ? 'Найти работу' : 'Ish topish'}</Link></Button>}</CardContent></Card> : <div className="space-y-3">
        {list.applications.map(app => {
          const location = [app.jobs?.regions, app.jobs?.districts].map(place => place && (ru ? place.name_ru || place.name_uz : place.name_uz || place.name_ru)).filter(Boolean).join(', ');
          return <Card key={app.id} className="border-slate-200"><CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold text-slate-900">{employer ? app.full_name : titleOf(app, lang)}</h2><p className="break-words text-sm text-slate-500">{employer ? titleOf(app, lang) : app.jobs?.company_name}</p></div>{badge(app.status)}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500"><span>{dateOf(app.created_at, lang)}</span>{location && <span className="flex items-center gap-1"><MapPin className="size-4 shrink-0" />{location}</span>}</div>
            {!employer && feedback(app)}
            <div className="flex flex-wrap items-center gap-3">
              {employer ? <><Button variant="outline" size="sm" onClick={() => open(app)} disabled={saving || list.isLoadingMore}><Eye className="mr-2 size-4" />{ru ? 'Открыть отклик' : 'Arizani ochish'}</Button>
                <label className="text-sm"><span className="sr-only">{`${ru ? 'Статус отклика' : 'Ariza holati'}: ${app.full_name}`}</span><select className="rounded-lg border border-slate-200 bg-white px-3 py-2" value={normalizeApplicationStatus(app.status)} onChange={event => { if (event.target.value === 'interview_set') schedule(app,true); else void update(app, 'status', event.target.value); }} disabled={saving || list.isLoadingMore}>{APPLICATION_STATUSES.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label></>
                : app.jobs && <Button variant="outline" size="sm" asChild><Link href={`/jobs/${app.jobs.id}`}>{ru ? 'Вакансия' : 'Vakansiya'}</Link></Button>}
              {list.busyIds.includes(app.id) && <Loader2 className="size-4 animate-spin text-sky-600" aria-label={ru ? 'Сохранение' : 'Saqlanmoqda'} />}
            </div>
          </CardContent></Card>;
        })}
      </div>}
    {list.nextCursor && <Button variant="outline" onClick={() => { void list.loadMore(); }} disabled={saving || list.isLoadingMore}>{list.isLoadingMore ? (ru ? 'Загрузка…' : 'Yuklanmoqda…') : (ru ? 'Показать ещё' : 'Yana ko‘rsatish')}</Button>}
    <Dialog open={!!detail} onOpenChange={value => { if (!value) { selection.current = null; setDetail(null);setInterview(null);setInterviewError(false);setShowResume(false); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {detail && <><DialogHeader><DialogTitle>{detail.full_name}</DialogTitle><DialogDescription>{titleOf(detail, lang)}</DialogDescription></DialogHeader>
          <div className="space-y-4 break-words">{badge(detail.status)}
            {detail.phone && <a className="flex items-center gap-2 text-sky-700" href={`tel:${detail.phone}`}><Phone className="size-4 shrink-0" />{detail.phone}</a>}
            {detail.email && <a className="flex items-center gap-2 text-sky-700" href={`mailto:${detail.email}`}><Mail className="size-4 shrink-0" />{detail.email}</a>}
            {detail.message && <p className="whitespace-pre-wrap">{detail.message}</p>}
            {feedback(detail)}
            {detail.resumes && <section className="space-y-3 rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">{detail.resumes.title}</h3>{detail.resumes.about && <p className="whitespace-pre-wrap text-sm">{detail.resumes.about}</p>}
              <div className="flex flex-wrap gap-2">{detail.resumes.skills.map((skill, index) => <Badge key={`${skill}:${index}`} variant="secondary">{skill}</Badge>)}</div>
              <Button variant="outline" aria-expanded={showResume} aria-controls="submitted-resume-detail" onClick={() => setShowResume(value => !value)}>{showResume ? (ru ? 'Свернуть резюме' : 'Rezyumeni yig‘ish') : (ru ? 'Открыть резюме' : 'Rezyumeni ochish')}</Button></section>}
            {showResume && detail.resumes && <div id="submitted-resume-detail"><SubmittedResume key={detail.id} applicationId={detail.id} /></div>}
            {!detail.resumes && <p className="text-sm text-slate-500">{ru ? 'Прикреплённое резюме недоступно.' : 'Biriktirilgan rezyume mavjud emas.'}</p>}
            {!!actionError && <p role="alert" className="text-sm text-rose-700">{applicationErrorText(actionError, lang)}</p>}
            {interview?.id === detail.id && <form onSubmit={event => { void submitInterview(event); }} className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4" aria-label={ru ? 'Назначение собеседования' : 'Suhbatni belgilash'}>
              <div className="space-y-2"><Label htmlFor="interview-date">{ru ? 'Дата и время собеседования' : 'Suhbat sanasi va vaqti'}</Label><Input id="interview-date" type="datetime-local" required min="2000-01-01T00:00" max="2199-12-31T23:59" value={interview.date} disabled={saving} onChange={event => { setInterview({ ...interview,date: event.target.value });setInterviewError(false); }} /><p className="text-xs text-slate-500">{ru ? 'Время Узбекистана (UTC+5)' : 'O‘zbekiston vaqti (UTC+5)'}</p></div>
              <div className="space-y-2"><Label htmlFor="interview-address">{ru ? 'Адрес или ссылка на встречу' : 'Manzil yoki uchrashuv havolasi'}</Label><Input id="interview-address" maxLength={1000} value={interview.address} disabled={saving} onChange={event => setInterview({ ...interview,address: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="interview-message">{ru ? 'Сообщение кандидату' : 'Nomzodga xabar'}</Label><Textarea id="interview-message" maxLength={4000} value={interview.message} disabled={saving} onChange={event => setInterview({ ...interview,message: event.target.value })} /></div>
              {interviewError && <p role="alert" className="text-sm text-rose-700">{ru ? 'Укажите корректную дату и время собеседования.' : 'Suhbatning to‘g‘ri sanasi va vaqtini kiriting.'}</p>}
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{ru ? 'Сохранить собеседование' : 'Suhbatni saqlash'}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => { setInterview(null);setInterviewError(false); }}>{ru ? 'Отмена' : 'Bekor qilish'}</Button></div>
            </form>}
            <div className="flex flex-wrap gap-2">{!interview && <Button disabled={saving} onClick={() => { schedule(detail); }}>{normalizeApplicationStatus(detail.status) === 'interview_set' ? (ru ? 'Изменить собеседование' : 'Suhbatni o‘zgartirish') : (ru ? 'Пригласить на собеседование' : 'Suhbatga taklif qilish')}</Button>}
              <Button variant="outline" disabled={saving} onClick={() => { void update(detail, 'view'); }}>{ru ? 'Обновить отклик' : 'Arizani yangilash'}</Button></div>
          </div></>}
      </DialogContent>
    </Dialog>
  </div>;
}
