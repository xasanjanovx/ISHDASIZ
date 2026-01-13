'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { Home, Search, PlusCircle, User, Menu, FileText, Briefcase, LogOut, Shield, Building2 } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

export function MobileNav() {
    const pathname = usePathname();
    const { lang } = useLanguage();
    const { user, isAuthenticated } = useUserAuth();
    const { user: adminUser, adminProfile, signOut: adminSignOut } = useAuth(); // Admin auth
    const { openModal } = useAuthModal();
    const [open, setOpen] = useState(false);

    // If we are on admin dashboard (e.g. /admin), we might want a different nav or same?
    // User explicitly updated Home Page, so this Nav is for public/app usage.

    const isAdmin = !!adminUser && !!adminProfile;

    const isActive = (path: string) => pathname === path;

    // Determination of "Add" button action
    const getAddLink = () => {
        if (isAdmin) return '/admin/jobs/new';
        if (!isAuthenticated) return null; // Will trigger modal
        if (user?.active_role === 'employer') return '/admin/jobs/new';
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
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe">
            <div className="flex items-center justify-around h-16 px-2">
                {/* Home */}
                <Link
                    href="/"
                    className={cn(
                        "flex flex-col items-center justify-center w-full h-full gap-1",
                        isActive('/') ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-medium">{lang === 'uz' ? 'Bosh' : 'Главная'}</span>
                </Link>

                {/* Search */}
                <Link
                    href="/jobs"
                    className={cn(
                        "flex flex-col items-center justify-center w-full h-full gap-1",
                        isActive('/jobs') ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Search className="w-6 h-6" />
                    <span className="text-[10px] font-medium">{lang === 'uz' ? 'Qidirish' : 'Поиск'}</span>
                </Link>

                {/* Add (Center Action) */}
                <Link
                    href={getAddLink() || '#'}
                    onClick={handleAddClick}
                    className="flex flex-col items-center justify-center w-full h-full -mt-6"
                >
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95",
                        isActive(getAddLink() || '')
                            ? "bg-blue-700 text-white"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                    )}>
                        <PlusCircle className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 mt-1">{lang === 'uz' ? 'Joylash' : 'Разместить'}</span>
                </Link>

                {/* Profile */}
                <Link
                    href={getProfileLink() || '#'}
                    onClick={handleProfileClick}
                    className={cn(
                        "flex flex-col items-center justify-center w-full h-full gap-1",
                        isActive(getProfileLink() || '') ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <User className="w-6 h-6" />
                    <span className="text-[10px] font-medium">{lang === 'uz' ? 'Profil' : 'Профиль'}</span>
                </Link>

                {/* Menu (Sheet) */}
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger asChild>
                        <button className={cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1",
                            open ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                        )}>
                            <Menu className="w-6 h-6" />
                            <span className="text-[10px] font-medium">{lang === 'uz' ? 'Menu' : 'Меню'}</span>
                        </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-72 bg-white flex flex-col pt-10">
                        <div className="flex-1 space-y-4">
                            {/* Simplified Menu Content */}
                            <h3 className="text-lg font-semibold px-4 mb-4">Menu</h3>

                            <Link href="/jobs" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 rounded-lg">
                                <Briefcase className="w-5 h-5 text-slate-500" />
                                <span>{lang === 'uz' ? 'Vakansiyalar' : 'Вакансии'}</span>
                            </Link>

                            <Link href="/resumes" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 rounded-lg">
                                <FileText className="w-5 h-5 text-slate-500" />
                                <span>{lang === 'uz' ? 'Rezyumelar' : 'Резюме'}</span>
                            </Link>

                            {(isAuthenticated || isAdmin) && (
                                <div className="border-t border-slate-100 my-2 pt-2">
                                    <Link href={getProfileLink() || '#'} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 rounded-lg">
                                        <User className="w-5 h-5 text-slate-500" />
                                        <span>{lang === 'uz' ? 'Mening profilim' : 'Мой профиль'}</span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Footer area if needed */}
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
