'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
export function Footer() {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  return <footer className="site-footer mt-auto border-t border-border bg-card">
    <div className="container mx-auto grid gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
      <div><Link href="/" className="inline-block"><Image src="/ishda1.webp" alt="ISHDASIZ" width={930} height={310} className="h-auto w-[150px]" /></Link><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{ru ? 'Новый шаг в вашей карьере. Возможности по всему Узбекистану.' : 'Karyerangizda yangi qadam. Butun O‘zbekiston bo‘ylab imkoniyatlar.'}</p></div>
      <div><h3 className="mb-3 text-sm font-semibold text-foreground">{ru ? 'Платформа' : 'Platforma'}</h3><div className="space-y-2 text-sm text-muted-foreground">{[{ href: '/jobs', label: ru ? 'Вакансии' : 'Vakansiyalar' }, { href: '/resumes', label: ru ? 'Резюме' : 'Rezyumelar' }, { href: '/map', label: ru ? 'Работа на карте' : 'Xaritada ish' }].map(link => <Link key={link.href} href={link.href} className="block hover:text-primary">{link.label}</Link>)}</div></div>
      <div><h3 className="mb-3 text-sm font-semibold text-foreground">{ru ? 'Связаться с нами' : 'Bog‘lanish'}</h3><a href="https://t.me/ishdasiz_admin" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Telegram <ArrowUpRight className="h-3.5 w-3.5" /></a><a href="mailto:info@ishdasiz.uz" className="mt-2 block text-sm text-muted-foreground hover:text-primary">info@ishdasiz.uz</a></div>
    </div>
    <div className="container mx-auto flex items-center justify-between border-t border-border px-4 py-5 text-xs text-muted-foreground sm:px-6"><span>© {new Date().getFullYear()} ISHDASIZ · {ru ? 'Узбекистан' : 'O‘zbekiston'}</span><Link href="/admin" className="hover:text-muted-foreground">Admin</Link></div>
  </footer>;
}
