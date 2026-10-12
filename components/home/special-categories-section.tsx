'use client';
import Link from 'next/link';
import { GraduationCap, Accessibility, Users, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
interface Props { counts: { students: number | null; disabled: number | null; women: number | null } }
export function SpecialCategoriesSection({ counts }: Props) {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const categories = [
    { id: 'students', icon: GraduationCap, count: counts.students, title: ru ? 'Студентам и выпускникам' : 'Talaba va bitiruvchilarga', color: 'bg-blue-50 text-blue-600' },
    { id: 'disabled', icon: Accessibility, count: counts.disabled, title: ru ? 'Людям с инвалидностью' : 'Nogironligi bor shaxslarga', color: 'bg-teal-50 text-teal-700' },
    { id: 'women', icon: Users, count: counts.women, title: ru ? 'Работа для женщин' : 'Ayollar uchun ish', color: 'bg-violet-50 text-violet-600' },
  ];
  return <section className="container mx-auto px-4 py-10 sm:px-6">
    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{ru ? 'Возможности для каждого' : 'Har bir inson uchun imkoniyatlar'}</h2>
    <p className="mt-2 text-sm text-slate-500">{ru ? 'Вакансии с подходящими условиями работы' : 'Mos ish sharoitlariga ega vakansiyalar'}</p>
    <div className="mt-6 grid gap-4 md:grid-cols-3">{categories.map(cat => <Link key={cat.id} href={`/jobs?special=${cat.id}`} className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cat.color}`}><cat.icon className="h-5 w-5" /></div>
      <div className="flex-1"><h3 className="text-sm font-semibold leading-6 text-slate-900">{cat.title}</h3><p className="mt-1 text-xs text-slate-500">{cat.count ?? '—'} {ru ? 'вакансий' : 'ta vakansiya'}</p></div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-600" />
    </Link>)}</div>
  </section>;
}
