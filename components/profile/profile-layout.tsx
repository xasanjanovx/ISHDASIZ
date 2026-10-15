'use client';

import { useUserAuth } from '@/contexts/user-auth-context';
import { ReactNode } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { ProfileNav, ProfileTabs } from './profile-nav';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft } from '@/components/ui/icons';
import Link from 'next/link';
import { toast } from 'sonner';

interface ProfileLayoutProps {
    children: ReactNode;
    userType: 'job_seeker' | 'employer';
    userName?: string;
    userAvatar?: string;
}

export function ProfileLayout({ children, userType, userName, userAvatar }: ProfileLayoutProps) {
    const { lang } = useLanguage();
    const { logout, user } = useUserAuth();
    const displayName=userName||(userType==='employer'?user?.company_name:user?.full_name)||(lang==='ru'?'Пользователь':'Foydalanuvchi');
    const handleLogout = async () => {
        try { await logout(); }
        catch { toast.error(lang === 'ru' ? 'Не удалось выйти. Попробуйте ещё раз.' : 'Chiqib bo‘lmadi. Qayta urinib ko‘ring.'); }
    };

    return (
        <div className="account-layout min-h-screen bg-background">
            <div className="container mx-auto px-4 py-6">
                {/* Back button */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                    <ArrowLeft className="w-4 h-4" />
                    {lang === 'ru' ? 'На главную' : 'Bosh sahifaga'}
                </Link>

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar - Desktop */}
                    {user && <aside className="hidden lg:block w-64 shrink-0">
                        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 sticky top-24">
                            {/* User info */}
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center text-white font-bold text-lg">
                                    {displayName[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground truncate">
                                        {displayName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
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
                            <div className="mt-6 pt-4 border-t border-border">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start gap-3 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-5 h-5" />
                                    {lang === 'ru' ? 'Выйти' : 'Chiqish'}
                                </Button>
                            </div>
                        </div>
                    </aside>}

                    {/* Mobile tabs */}
                    {user && <div className="lg:hidden mb-4">
                        <ProfileTabs userType={userType} />
                    </div>}

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
