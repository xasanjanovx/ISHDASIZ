'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ArrowUpRight, Briefcase, FileText, Building2, Globe2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { formatSalary } from '@/lib/constants';

interface HeroProps {
  regions?: { id: number; name_uz: string; name_ru: string }[];
  jobs?: any[];
  stats?: { totalJobs: number | null; totalResumes: number | null; totalEmployers: number | null };
}

export function HeroSection({ regions = [], jobs = [], stats }: HeroProps) {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const router = useRouter();
  const { openModal, setUserRole, setStep } = useAuthModal();
  const { user } = useUserAuth();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const start = (role: 'seeker' | 'employer') => {
    if (user && (role === 'seeker' ? user.has_job_seeker_profile : user.has_employer_profile)) {
      router.push(role === 'seeker' ? '/profile/job-seeker/resumes/new' : '/profile/employer/vacancies');
    } else {
      setUserRole(role);
      setStep('auth');
      openModal();
    }
  };
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (region !== 'all') params.set('region', region);
    router.push(params.size ? `/jobs?${params}` : '/jobs');
  };
  const labels = ru
    ? ['Открытые вакансии', 'Резюме кандидатов', 'Работодатели']
    : ['Ochiq vakansiyalar', 'Nomzodlar rezyumelari', 'Ish beruvchilar'];
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-bl from-teal-50/80 via-blue-50/40 to-transparent pointer-events-none" />
      <div className="container relative mx-auto px-4 py-12 sm:px-6 md:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
              <Globe2 className="h-3.5 w-3.5" />
              {ru ? 'Работа по всему Узбекистану' : 'O‘zbekiston bo‘ylab ish imkoniyatlari'}
            </div>
            <h1 className="max-w-2xl text-[40px] font-semibold leading-[1.1] tracking-[-0.045em] text-slate-950 sm:text-5xl xl:text-[64px]">
              {ru ? 'Ваша следующая' : 'Yangi ishingiz.'}<br />
              <span className="text-blue-600">{ru ? 'работа — здесь.' : 'Yangi imkoniyatlar.'}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              {ru ? 'Найдите подходящую вакансию рядом с вами или в другом регионе. Выберите работу, которая подходит именно вам.' : 'O‘zingizga mos ishni yaqin atrofda yoki boshqa hududda toping. Keyingi qadamingizni biz bilan boshlang.'}
            </p>
            <form onSubmit={search} className="mt-8 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/40">
              <div className="flex items-center gap-3 px-3">
                <Search className="h-5 w-5 shrink-0 text-slate-400" />
                <label htmlFor="home-search" className="sr-only">{ru ? 'Профессия или компания' : 'Kasb yoki kompaniya'}</label>
                <input id="home-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={ru ? 'Профессия, должность или компания' : 'Kasb, lavozim yoki kompaniya'} className="h-12 w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                  <MapPin className="h-5 w-5 shrink-0 text-slate-400" />
                  <label htmlFor="home-region" className="sr-only">{ru ? 'Регион' : 'Hudud'}</label>
                  <select id="home-region" value={region} onChange={e => setRegion(e.target.value)} className="h-11 w-full min-w-0 bg-white text-sm text-slate-700 outline-none">
                    <option value="all">{ru ? 'Весь Узбекистан' : 'Butun O‘zbekiston'}</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{ru ? r.name_ru || r.name_uz : r.name_uz}</option>)}
                  </select>
                </div>
                <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  {ru ? 'Найти работу' : 'Ish topish'} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{ru ? 'Популярные запросы:' : 'Mashhur qidiruvlar:'}</span>
              {(ru ? ['Продавец', 'Водитель', 'Бухгалтер'] : ['Sotuvchi', 'Haydovchi', 'Buxgalter']).map(term =>
                <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-700">{term}</Link>)}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-blue-100/40">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">{ru ? 'Новые возможности' : 'Yangi imkoniyatlar'}</span>
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-700">{ru ? 'По всей стране' : 'Butun mamlakat'}</span>
              </div>
              {jobs.slice(0, 2).map(job => <Link key={job.id} href={`/jobs/${job.id}`} className="mb-3 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Briefcase className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900">{ru ? job.title_ru || job.title_uz : job.title_uz || job.title_ru}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{job.company_name}</div>
                  <div className="mt-2 text-xs font-semibold text-teal-700">{formatSalary(job.salary_min, job.salary_max, lang)}</div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>)}
              {jobs.length === 0 && <div className="rounded-2xl bg-blue-50 p-6"><Briefcase className="mb-4 h-8 w-8 text-blue-600" /><p className="font-medium text-slate-800">{ru ? 'Найдите свой следующий шаг' : 'Keyingi qadamingizni toping'}</p><p className="mt-2 text-sm leading-6 text-slate-600">{ru ? 'Ищите вакансии по профессии, региону и условиям работы.' : 'Kasb, hudud va ish sharoiti bo‘yicha vakansiyalarni qidiring.'}</p></div>}
              <Link href="/map" className="mt-5 flex items-center justify-between rounded-2xl bg-teal-50 px-4 py-4 text-sm font-medium text-teal-800">
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{ru ? 'Найти работу на карте' : 'Xaritada ish topish'}</span><ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
        {stats && <div className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-slate-200 pt-6 md:mt-12">
          {[stats.totalJobs, stats.totalResumes, stats.totalEmployers].map((value, i) => <div key={labels[i]}>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">{value === null ? '—' : value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{labels[i]}</div>
          </div>)}
        </div>}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[{ role: 'seeker' as const, icon: FileText, title: ru ? 'Пусть работа найдёт вас' : 'Ish sizni topsin', text: ru ? 'Создайте резюме и расскажите о своих навыках.' : 'Rezyume yarating va ko‘nikmalaringizni ko‘rsating.', action: ru ? 'Создать резюме' : 'Rezyume yaratish' },
            { role: 'employer' as const, icon: Building2, title: ru ? 'Найдите людей для своей команды' : 'Jamoangiz uchun xodim toping', text: ru ? 'Разместите вакансию и получайте отклики.' : 'Vakansiya joylang va nomzodlardan arizalar oling.', action: ru ? 'Разместить вакансию' : 'Vakansiya joylash' }].map(item => <button key={item.role} onClick={() => start(item.role)} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50">
              <item.icon className="h-6 w-6 shrink-0 text-blue-600" />
              <div className="flex-1"><div className="text-sm font-semibold text-slate-900">{item.title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{item.text}</div><div className="mt-2 text-xs font-semibold text-blue-600">{item.action}</div></div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-blue-600" />
            </button>)}
        </div>
      </div>
    </section>
  );
}
