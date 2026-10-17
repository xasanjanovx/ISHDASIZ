'use client';

import Link from 'next/link';
import { useHydratedPathname } from '@/hooks/use-hydrated-pathname';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { Home, Search, Plus, User, Menu } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { MobileMenuContent } from './mobile-menu-content';
import { useAuth } from '@/contexts/auth-context';

export function MobileNav() {
    const pathname = useHydratedPathname();
    const { lang } = useLanguage();
    const { user, isAuthenticated } = useUserAuth();
    const { user: adminUser, adminProfile } = useAuth();
    const { openModal } = useAuthModal();
    const [open, setOpen] = useState(false);

    const isAdmin = !!adminUser && !!adminProfile;

    const isActive = (path: string) => Boolean(path && (pathname === path || path !== '/' && pathname.startsWith(path + '/')));

    // Determination of "Add" button action
    const getAddLink = () => {
        if (isAdmin) return '/admin/jobs/new';
        if (!isAuthenticated) return null; // Will trigger modal
        if (user?.active_role === 'employer') return '/profile/employer/vacancies/new';
        return '/profile/job-seeker/resumes/new';
    };

    const handleAddClick = (e: React.MouseEvent) => {
        if (!isAuthenticated && !isAdmin) {
            e.preventDefault();
            openModal();
        }
    };

    const getProfileLink = () => {
        if (isAdmin) return '/admin'; // Admin goes to admin panel
        if (!isAuthenticated) return null;
        if (user?.active_role === 'employer') return '/profile/employer';
        return '/profile/job-seeker';
    };

    const handleProfileClick = (e: React.MouseEvent) => {
        if (!isAuthenticated && !isAdmin) {
            e.preventDefault();
            openModal();
        }
    };

    return (
        <nav aria-label={lang === 'ru' ? 'Основная навигация' : 'Asosiy navigatsiya'} className="site-mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe">
            <div className="flex items-center justify-around h-16 px-2">
                {/* Home */}
                <Link
                    href="/"
                    aria-current={isActive('/') ? 'page' : undefined}
                    className={cn(
                        "mobile-nav-item flex flex-col items-center justify-center w-full h-full gap-1",
                        isActive('/') ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <span className="mobile-nav-icon"><Home className="w-6 h-6" /></span>
                    <span className="text-xs font-medium">{lang === 'uz' ? 'Bosh' : 'Главная'}</span>
                </Link>

                {/* Search */}
                <Link
                    href="/jobs"
                    aria-current={isActive('/jobs') ? 'page' : undefined}
                    className={cn(
                        "mobile-nav-item flex flex-col items-center justify-center w-full h-full gap-1",
                        isActive('/jobs') ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <span className="mobile-nav-icon"><Search className="w-6 h-6" /></span>
                    <span className="text-xs font-medium">{lang === 'uz' ? 'Qidirish' : 'Поиск'}</span>
                </Link>

                {/* Add (Center Action) */}
                <Link
                    href={getAddLink() || '#'}
                    onClick={handleAddClick}
                    className="mobile-nav-item mobile-nav-add flex flex-col items-center justify-center w-full h-full gap-1"
                >
                    <div className={cn(
                        "mobile-nav-add-icon w-11 h-11 rounded-2xl flex items-center justify-center transition-transform active:scale-95",
                        isActive(getAddLink() || '')
                            ? "bg-primary text-white"
                            : "bg-primary text-white hover:bg-primary"
                    )}>
                        <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{lang === 'uz' ? 'Joylash' : 'Создать'}</span>
                </Link>

                {/* Profile */}
                <Link
                    href={getProfileLink() || '#'}
                    onClick={handleProfileClick}
                    aria-current={isActive(getProfileLink() || '') ? 'page' : undefined}
                    className={cn(
                        "mobile-nav-item flex flex-col items-center justify-center w-full h-full gap-1",
                        isActive(getProfileLink() || '') ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <span className="mobile-nav-icon"><User className="w-6 h-6" /></span>
                    <span className="text-xs font-medium">{lang === 'uz' ? 'Profil' : 'Профиль'}</span>
                </Link>

                {/* Menu (Sheet) */}
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <button data-active={open || undefined} className={cn(
                            "mobile-nav-item flex flex-col items-center justify-center w-full h-full gap-1",
                            open ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}>
                            <span className="mobile-nav-icon"><Menu className="w-6 h-6" /></span>
                            <span className="text-xs font-medium">{lang === 'uz' ? 'Menu' : 'Меню'}</span>
                        </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="site-mobile-menu mobile-full-menu" onOpenAutoFocus={event => { event.preventDefault(); const panel = event.target as HTMLElement; panel.focus({ preventScroll: true }); panel.scrollTop = 0; }}>
                        <MobileMenuContent variant="all" onClose={() => setOpen(false)} />
                    </SheetContent>
                </Sheet>
            </div>
        </nav>
    );
}
