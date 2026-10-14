'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ArrowUpRight, FileText, Building2, Globe2, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { useUserAuth } from '@/contexts/user-auth-context';

interface HeroProps {
  regions?: { id: number; name_uz: string; name_ru: string }[];
  jobs?: any[];
  stats?: { totalJobs: number | null; totalResumes: number | null; totalEmployers: number | null };
}

export function HeroSection({ regions = [], stats }: HeroProps) {
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
    <section className="border-b border-slate-200 bg-white">
      <div className="relative isolate overflow-hidden bg-slate-900">
        <Image src="/hero-office.png" alt="" fill priority sizes="100vw" className="object-cover object-[65%_center] lg:object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 to-transparent" />
        <div className="container relative mx-auto px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <Globe2 className="h-3.5 w-3.5" />
              {ru ? 'Работа по всему Узбекистану' : 'O‘zbekiston bo‘ylab ish imkoniyatlari'}
            </div>
            <h1 className="max-w-2xl text-[38px] font-semibold leading-[1.12] tracking-[-0.04em] text-white sm:text-5xl xl:text-[60px]">
              {ru ? 'Найдите работу,' : 'O‘zingizga mos'}<br />
              <span className="text-teal-300">{ru ? 'которая вам подходит.' : 'ishni toping.'}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-200 sm:text-lg">
              {ru ? 'Найдите подходящую вакансию рядом с вами или в другом регионе. Выберите работу, которая подходит именно вам.' : 'O‘zingizga mos ishni yaqin atrofda yoki boshqa hududda toping. Keyingi qadamingizni biz bilan boshlang.'}
            </p>
            <form onSubmit={search} className="mt-8 rounded-2xl border border-white/70 bg-white p-2 shadow-xl shadow-slate-950/20">
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
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-200">
              <span>{ru ? 'Популярные запросы:' : 'Mashhur qidiruvlar:'}</span>
              {(ru ? ['Продавец', 'Водитель', 'Бухгалтер'] : ['Sotuvchi', 'Haydovchi', 'Buxgalter']).map(term =>
                <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-white transition-colors hover:bg-white/20">{term}</Link>)}
            </div>
          </div>
          <Link href="/map" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
            <MapPin className="h-4 w-4" />{ru ? 'Найти работу на карте' : 'Xaritada ish topish'}<ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 sm:px-6">
        {stats && <div className="grid grid-cols-3 gap-4 border-b border-slate-200 pb-7">
          {[stats.totalJobs, stats.totalResumes, stats.totalEmployers].map((value, i) => <div key={labels[i]}>
            <div className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value === null ? '—' : value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{labels[i]}</div>
          </div>)}
        </div>}
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
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
