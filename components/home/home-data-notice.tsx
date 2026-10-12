'use client';
import { useLanguage } from '@/contexts/language-context';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
export function HomeDataNotice() {
  const { lang } = useLanguage();
  const router = useRouter();
  return <div role="status" className="container mx-auto px-4 pt-6"><div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <AlertCircle className="h-5 w-5 shrink-0" /><span className="flex-1">{lang === 'ru' ? 'Не удалось загрузить данные. Попробуйте обновить страницу.' : 'Ma’lumotlarni yuklab bo‘lmadi. Sahifani yangilab ko‘ring.'}</span>
    <button onClick={() => router.refresh()} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" />{lang === 'ru' ? 'Повторить' : 'Qayta urinish'}</button>
  </div></div>;
}
