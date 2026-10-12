'use client';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { MapPin, Building2 } from '@/components/ui/icons';
import type { z } from 'zod';
import type { chatJobSchema } from '@/lib/ai/chat-contract';

export function AIJobCard({ job }: { job: z.infer<typeof chatJobSchema> }) {
  const { lang } = useLanguage();
  return <Link href={'/jobs/' + job.id} prefetch={false} className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Building2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="break-words font-semibold leading-snug text-slate-900">{job.title}</h3><p className="mt-1 break-words text-xs text-slate-500">{job.company}</p></div></div>
    <p className="mt-3 font-semibold text-teal-700">{job.salary}</p>
    {job.location && <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{job.location}</span></p>}
    {job.work_mode && <p className="mt-1 text-xs text-slate-500">{job.work_mode}</p>}
    {job.reason_fit && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">{job.reason_fit}</p>}
    <p className="mt-3 text-xs font-semibold text-blue-600">{lang === 'ru' ? 'Подробнее о вакансии →' : 'Vakansiya haqida batafsil →'}</p>
  </Link>;
}
