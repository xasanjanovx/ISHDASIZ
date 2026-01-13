'use client';

import { ReactNode } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { ProfileNav, ProfileTabs } from './profile-nav';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft } from '@/components/ui/icons';
import Link from 'next/link';

interface ProfileLayoutProps {
    children: ReactNode;
    userType: 'job_seeker' | 'employer';
    userName?: string;
    userAvatar?: string;
}

export function ProfileLayout({ children, userType, userName, userAvatar }: ProfileLayoutProps) {
    const { lang } = useLanguage();

    const handleLogout = () => {
        // TODO: Implement logout
        console.log('Logout clicked');
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-20">
            <div className="container mx-auto px-4 py-6">
                {/* Back button */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6">
                    <ArrowLeft className="w-4 h-4" />
                    {lang === 'ru' ? 'На главную' : 'Bosh sahifaga'}
                </Link>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar - Desktop */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sticky top-24">
                            {/* User info */}
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-lg">
                                    {userName ? userName[0].toUpperCase() : 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-900 truncate">
                                        {userName || (lang === 'ru' ? 'Пользователь' : 'Foydalanuvchi')}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {userType === 'job_seeker'
                                            ? (lang === 'ru' ? 'Соискатель' : 'Ish izlovchi')
                                            : (lang === 'ru' ? 'Работодатель' : 'Ish beruvchi')
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Navigation */}
                            <ProfileNav userType={userType} />

                            {/* Logout */}
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start gap-3 text-slate-600 hover:text-red-600 hover:bg-red-50"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-5 h-5" />
                                    {lang === 'ru' ? 'Выйти' : 'Chiqish'}
                                </Button>
                            </div>
                        </div>
                    </aside>

                    {/* Mobile tabs */}
                    <div className="lg:hidden mb-4">
                        <ProfileTabs userType={userType} />
                    </div>

                    {/* Main content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
