'use client';
import Link from 'next/link';
import { Briefcase, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
export function Footer() {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  return <footer className="mt-auto border-t border-slate-200 bg-white">
    <div className="container mx-auto grid gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
      <div><Link href="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900"><Briefcase className="h-5 w-5 text-blue-600" />ISHDASIZ</Link><p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">{ru ? 'Возможности для вашей карьеры и вашей команды. По всему Узбекистану.' : 'Karyerangiz va jamoangiz uchun imkoniyatlar. Butun O‘zbekiston bo‘ylab.'}</p></div>
      <div><h3 className="mb-3 text-sm font-semibold text-slate-900">{ru ? 'Платформа' : 'Platforma'}</h3><div className="space-y-2 text-sm text-slate-500">{[{ href: '/jobs', label: ru ? 'Вакансии' : 'Vakansiyalar' }, { href: '/resumes', label: ru ? 'Резюме' : 'Rezyumelar' }, { href: '/map', label: ru ? 'Работа на карте' : 'Xaritada ish' }].map(link => <Link key={link.href} href={link.href} className="block hover:text-blue-600">{link.label}</Link>)}</div></div>
      <div><h3 className="mb-3 text-sm font-semibold text-slate-900">{ru ? 'Связаться с нами' : 'Bog‘lanish'}</h3><a href="https://t.me/ishdasiz_admin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">Telegram <ArrowUpRight className="h-3.5 w-3.5" /></a><a href="mailto:info@ishdasiz.uz" className="mt-2 block text-sm text-slate-500 hover:text-blue-600">info@ishdasiz.uz</a></div>
    </div>
    <div className="container mx-auto flex items-center justify-between border-t border-slate-100 px-4 py-5 text-xs text-slate-400 sm:px-6"><span>© {new Date().getFullYear()} ISHDASIZ · {ru ? 'Узбекистан' : 'O‘zbekiston'}</span><Link href="/admin" className="hover:text-slate-600">Admin</Link></div>
  </footer>;
}
