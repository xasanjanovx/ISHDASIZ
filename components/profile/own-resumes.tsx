'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { ProfileLayout } from './profile-layout';
import { AccountGate } from './account-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, FileText, Plus } from '@/components/ui/icons';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { accountApi, AccountApiError } from '@/lib/account-api';
import { resumeErrorText, resumeSkills } from '@/lib/resume-api';
import { formatSalary } from '@/lib/constants';
type Resume = Record<string, any> & { id: string; title: string; updated_at: string | null };
type Page = { resumes: Resume[]; nextCursor: string | null };
export function OwnResumesPage() { return <AccountGate><OwnResumes /></AccountGate>; }
function OwnResumes() {
  const { lang } = useLanguage(), ru = lang === 'ru';
  const [rows, setRows] = useState<Resume[]>([]), [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [revision, setRevision] = useState(0);
  const [error, setError] = useState<{ value: unknown; operation: 'load' | 'more' | 'action' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null), [deleting, setDeleting] = useState<Resume | null>(null), [archived, setArchived] = useState<Resume | null>(null);
  const alive = useRef(false), actionLock = useRef(false), moreLock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    accountApi<Page>('/api/account/resumes', { signal: controller.signal }).then(page => {
      if (!cancelled) { setRows(page.resumes); setCursor(page.nextCursor); setError(null); }
    }).catch(value => { if (!cancelled) setError({ value, operation: 'load' }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [revision]);
  const refresh = () => { setLoading(true); setError(null); setRevision(value => value + 1); };
  const more = async () => {
    if (!cursor || moreLock.current || actionLock.current) return;
    moreLock.current = true; setLoadingMore(true); setError(null);
    try {
      const page = await accountApi<Page>(`/api/account/resumes?before=${cursor}`);
      if (!alive.current) return;
      setRows(previous => { const map = new Map(previous.map(row => [row.id, row])); page.resumes.forEach(row => { if (!map.has(row.id)) map.set(row.id, row); }); return Array.from(map.values()); });
      setCursor(page.nextCursor);
    } catch (value) { if (alive.current) setError({ value, operation: 'more' }); }
    finally { moreLock.current = false; if (alive.current) setLoadingMore(false); }
  };
  const change = async (row: Resume, action: string, is_public?: boolean) => {
    if (actionLock.current || moreLock.current) return;
    actionLock.current = true; setBusy(row.id); setError(null);
    try {
      const result = await accountApi<{ resume: Resume }>(`/api/account/resumes/${row.id}`, { method: action === 'archive' ? 'DELETE' : 'PATCH', body: JSON.stringify({ action, is_public, expected_updated_at: row.updated_at ?? null }) });
      if (!alive.current) return;
      if (!result.resume || result.resume.id !== row.id) throw new AccountApiError(503);
      const saved = { ...row, ...result.resume };
      if (action === 'archive') { setRows(previous => previous.filter(item => item.id !== row.id)); setArchived(saved); setDeleting(null); }
      else if (action === 'restore') { setRows(previous => [saved, ...previous].sort((first, second) => String(second.created_at).localeCompare(String(first.created_at)) || second.id.localeCompare(first.id))); setArchived(null); }
      else setRows(previous => previous.map(item => item.id === saved.id ? saved : item));
    } catch (value) { if (alive.current) setError({ value, operation: 'action' }); }
    finally { actionLock.current = false; if (alive.current) setBusy(null); }
  };
  return <ProfileLayout userType="job_seeker"><div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-foreground">{ru ? 'Мои резюме' : 'Mening rezyumelarim'}</h1><p className="mt-1 text-muted-foreground">{ru ? 'Ваш опыт, навыки и следующий шаг' : 'Tajribangiz, ko‘nikmalaringiz va keyingi qadam'}</p></div><Button asChild><Link href="/profile/job-seeker/resumes/new"><Plus className="mr-2 size-4" />{ru ? 'Создать резюме' : 'Rezyume yaratish'}</Link></Button></div>
    {!!error && <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{resumeErrorText(error.value, lang)}</p><Button variant="outline" disabled={!!busy || loadingMore} onClick={() => { if (error.operation === 'more') void more(); else refresh(); }}>{ru ? 'Повторить' : 'Qayta urinish'}</Button></div>}
    {archived && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-accent p-4 text-sm"><p>{ru ? 'Резюме убрано из списка. История откликов сохранена.' : 'Rezyume ro‘yxatdan olib tashlandi. Arizalar tarixi saqlandi.'}</p><Button variant="outline" disabled={!!busy || loadingMore} onClick={() => { void change(archived, 'restore'); }}>{ru ? 'Восстановить как черновик' : 'Qoralama sifatida tiklash'}</Button></div>}
    {loading ? <div role="status" className="flex items-center justify-center gap-2 py-12"><Loader2 className="size-6 animate-spin text-primary" />{ru ? 'Загрузка резюме…' : 'Rezyumelar yuklanmoqda…'}</div>
      : !rows.length && !error ? <Card><CardContent className="space-y-3 py-12 text-center"><FileText className="mx-auto size-10 text-muted-foreground" /><h2 className="text-lg font-semibold">{ru ? 'Резюме пока нет' : 'Hozircha rezyume yo‘q'}</h2><p className="text-muted-foreground">{ru ? 'Создайте резюме, чтобы откликаться на вакансии' : 'Vakansiyalarga ariza berish uchun rezyume yarating'}</p></CardContent></Card>
        : <div className="space-y-3">{rows.map(row => {
          const location = [row.regions, row.districts].map(place => { const value = Array.isArray(place) ? place[0] : place; return value && (ru ? value.name_ru || value.name_uz : value.name_uz || value.name_ru); }).filter(Boolean).join(', ');
          const publicResume = row.status === 'active' && row.is_public && !row.found_job;
          return <Card key={row.id}><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-lg font-semibold text-foreground">{row.title}</h2><p className="text-sm text-muted-foreground">{row.full_name}</p></div><Badge className={publicResume ? 'bg-accent text-primary' : 'bg-secondary text-muted-foreground'}>{row.found_job ? (ru ? 'Работа найдена' : 'Ish topildi') : row.status === 'draft' ? (ru ? 'Черновик' : 'Qoralama') : publicResume ? (ru ? 'Опубликовано' : 'E’lon qilingan') : (ru ? 'Скрыто' : 'Yashirin')}</Badge></div>
            {location && <p className="text-sm text-muted-foreground">{location}</p>}<p className="text-sm font-semibold">{formatSalary(row.expected_salary_min, row.expected_salary_max, lang)}</p>
            {!!resumeSkills(row.skills).length && <div className="flex flex-wrap gap-2">{resumeSkills(row.skills).slice(0, 6).map((skill: string, index: number) => <Badge key={`${skill}:${index}`} variant="secondary">{skill}</Badge>)}</div>}
            <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" asChild><Link href={`/profile/job-seeker/resumes/${row.id}`}>{ru ? 'Редактировать' : 'Tahrirlash'}</Link></Button>
              {row.status === 'active' && !row.found_job && <><label className="flex items-center gap-2 text-sm"><Switch aria-label={`${ru ? 'Публикация' : 'E’lon qilish'}: ${row.title}`} checked={!!publicResume} disabled={!!busy || loadingMore} onCheckedChange={value => { void change(row, 'visibility', value); }} />{ru ? 'Видно работодателям' : 'Ish beruvchilarga ko‘rinadi'}</label>{row.supports_found_job && <Button variant="ghost" size="sm" disabled={!!busy || loadingMore} onClick={() => { void change(row, 'found_job'); }}>{ru ? 'Нашёл работу' : 'Ish topdim'}</Button>}</>}
              {row.found_job && <Button variant="outline" size="sm" disabled={!!busy || loadingMore} onClick={() => { void change(row, 'resume_search'); }}>{ru ? 'Возобновить поиск' : 'Qidirishni davom ettirish'}</Button>}
              <Button variant="ghost" size="sm" className="text-rose-700" disabled={!!busy || loadingMore} onClick={() => setDeleting(row)}>{ru ? 'Удалить' : 'O‘chirish'}</Button>{busy === row.id && <Loader2 className="size-4 animate-spin text-primary" />}
            </div></CardContent></Card>;
        })}</div>}
    {cursor && <Button variant="outline" disabled={!!busy || loadingMore || loading} onClick={() => { void more(); }}>{loadingMore ? (ru ? 'Загрузка…' : 'Yuklanmoqda…') : (ru ? 'Показать ещё' : 'Yana ko‘rsatish')}</Button>}
    <AlertDialog open={!!deleting} onOpenChange={value => { if (!value && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{ru ? 'Убрать резюме из списка?' : 'Rezyumeni ro‘yxatdan olib tashlaysizmi?'}</AlertDialogTitle><AlertDialogDescription>{ru ? 'Оно будет скрыто и перемещено в архив. История откликов сохранится. После удаления можно восстановить черновик.' : 'U yashiriladi va arxivga ko‘chiriladi. Arizalar tarixi saqlanadi. O‘chirgandan so‘ng qoralamani tiklash mumkin.'}</AlertDialogDescription></AlertDialogHeader>
      {!!error && error.operation === 'action' && <p role="alert" className="text-sm text-rose-700">{resumeErrorText(error.value, lang)}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={!!busy}>{ru ? 'Отмена' : 'Bekor qilish'}</AlertDialogCancel><Button disabled={!!busy} onClick={() => { if (deleting) void change(deleting, 'archive'); }}>{ru ? 'Удалить резюме' : 'Rezyumeni o‘chirish'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></ProfileLayout>;
}
