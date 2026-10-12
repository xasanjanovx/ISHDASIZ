'use client';

import { useLanguage } from '@/contexts/language-context';

export function PageLoading() {
    const { lang } = useLanguage();
    return <div role="status" className="container mx-auto flex min-h-64 items-center justify-center gap-3 px-4 text-slate-600">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        {lang === 'ru' ? 'Загрузка…' : 'Yuklanmoqda…'}
    </div>;
}
