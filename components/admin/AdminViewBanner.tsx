'use client';

import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export function AdminViewBanner() {
    const { user: adminUser, adminProfile } = useAuth();
    const { lang } = useLanguage();
    const pathname = usePathname();

    // Only show on profile pages and only when admin is logged in
    const isAdmin = !!adminUser && !!adminProfile;
    const isProfilePage = pathname.startsWith('/profile/');

    if (!isAdmin || !isProfilePage) {
        return null;
    }

    return (
        <div className="fixed top-[72px] left-0 right-0 z-40 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 px-4 shadow-lg">
            <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        {lang === 'ru'
                            ? 'Вы просматриваете как администратор'
                            : 'Siz admin sifatida ko\'rmoqdasiz'}
                    </span>
                </div>
                <Link
                    href="/admin"
                    className="flex items-center gap-1 text-sm font-medium bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {lang === 'ru' ? 'В админ панель' : 'Admin panelga qaytish'}
                </Link>
            </div>
        </div>
    );
}
