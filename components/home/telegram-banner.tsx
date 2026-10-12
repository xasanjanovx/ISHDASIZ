'use client';
import Link from 'next/link';
import { Send, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
export function TelegramBanner() {
  const { lang } = useLanguage();
  return <section className="container mx-auto px-4 py-10 sm:px-6"><Link href="https://t.me/ishdasizbot" target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-5 rounded-3xl border border-blue-200 bg-blue-50 p-6 sm:flex-row sm:items-center md:p-8">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><Send className="h-6 w-6" /></div>
    <div className="flex-1"><h2 className="text-xl font-semibold tracking-tight text-slate-900">{lang === 'ru' ? 'Поиск работы всегда под рукой' : 'Ish qidirish doim qo‘lingizda'}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{lang === 'ru' ? 'Ищите вакансии, создавайте резюме и отправляйте отклики в Telegram.' : 'Telegram orqali ish qidiring, rezyume yarating va ariza yuboring.'}</p></div>
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">{lang === 'ru' ? 'Открыть бота' : 'Botni ochish'}<ArrowUpRight className="h-4 w-4" /></span>
  </Link></section>;
}
