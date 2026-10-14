'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { Button } from '@/components/ui/button';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Home, Briefcase, BarChart3, LogIn, User, Settings, LogOut, Building2, Shield, Eye, FileText, MessageCircle } from '@/components/ui/icons';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { toast } from 'sonner';
import { useNotificationCounts } from '@/hooks/use-notification-counts';


const languageLabels = {
  uz: "O'ZB",
  ru: 'РУС',
};

import { useTelegram } from '@/contexts/telegram-context';

export default function Header() {
  const { lang, setLang } = useLanguage();
  const { user: adminUser, adminProfile, signOut: adminSignOut } = useAuth();
  const { user, isAuthenticated, isLoading, logout, switchRole } = useUserAuth();
  const { isTelegram } = useTelegram();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { openModal } = useAuthModal();

  const activeTab = pathname === '/' ? (lang === 'uz' ? 'Bosh sahifa' : 'Главная')
    : pathname.startsWith('/jobs') ? (lang === 'uz' ? 'Vakansiyalar' : 'Вакансии')
    : pathname.startsWith('/resumes') ? (lang === 'uz' ? 'Rezyumelar' : 'Резюме') : '';
  const { messages: unreadMessages, applications: unreadApplications } = useNotificationCounts(user?.id, user?.active_role || 'job_seeker');
  const isAdmin = !!adminUser && !!adminProfile;

  // ... (navItems logic unchanged)

  // ... (render logic)

  {/* Job Seeker Links */ }
  {
    user?.active_role === 'job_seeker' && (
      <>
        <DropdownMenuItem asChild>
          <Link href="/profile/job-seeker/applications" className="cursor-pointer w-full flex justify-between items-center">
            <div className="flex items-center">
              <Briefcase className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Мои заявки' : 'Mening arizalarim'}
            </div>
            {unreadApplications > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-emerald-500 rounded-full">
                {unreadApplications > 99 ? '99+' : unreadApplications}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/job-seeker/messages" className="cursor-pointer w-full flex justify-between items-center">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              {lang === 'ru' ? 'Сообщения' : 'Xabarlar'}
            </div>
            {unreadMessages > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
      </>
    )
  }

  {/* Employer Links */ }
  {
    user?.active_role === 'employer' && (
      <>
        <DropdownMenuItem asChild>
          <Link href="/profile/employer/vacancies" className="cursor-pointer w-full flex justify-between items-center">
            <div className="flex items-center">
              <Briefcase className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Мои вакансии' : 'Mening vakansiyalarim'}
            </div>
            {unreadApplications > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-orange-500 rounded-full">
                {unreadApplications > 99 ? '99+' : unreadApplications}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/employer/messages" className="cursor-pointer w-full flex justify-between items-center">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              {lang === 'ru' ? 'Сообщения' : 'Xabarlar'}
            </div>
            {unreadMessages > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
      </>
    )
  }

  const navItems = [
    {
      name: lang === 'uz' ? 'Bosh sahifa' : 'Главная',
      url: '/',
      icon: Home
    },
    {
      name: lang === 'uz' ? 'Vakansiyalar' : 'Вакансии',
      url: '/jobs',
      icon: Briefcase
    },
    {
      name: lang === 'uz' ? 'Rezyumelar' : 'Резюме',
      url: '/resumes',
      icon: FileText
    },
  ];

  const cycleLang = () => {
    if (lang === 'uz') setLang('ru');
    else setLang('uz');
  };

  const handleLogout = async () => {
    try { await logout(); }
    catch { toast.error(lang === 'ru' ? 'Не удалось выйти. Попробуйте ещё раз.' : 'Chiqib bo‘lmadi. Qayta urinib ko‘ring.'); }
  };

  const handleAdminLogout = async () => {
    await adminSignOut();
    toast.success(lang === 'ru' ? 'Вы вышли из системы' : 'Tizimdan chiqdingiz');
    router.push('/');
  };

  const profilePath = user?.active_role === 'employer' ? '/profile/employer' : '/profile/job-seeker';
  const settingsPath = user?.active_role === 'employer' ? '/profile/employer/settings' : '/profile/job-seeker/settings';

  const getUserDisplayName = () => {
    return lang === 'ru' ? 'Профиль' : 'Profil';
  };

  const getUserInitial = () => {
    if (user?.full_name) return user.full_name[0].toUpperCase();
    if (user?.company_name) return user.company_name[0].toUpperCase();
    return user?.active_role === 'employer' ? 'K' : 'F';
  };

  // Admin Menu Component
  const renderAdminMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 px-3 gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-amber-500/20"
        >
          <Shield className="w-4 h-4" />
          <span className="text-sm font-semibold hidden lg:block">Admin</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-900">
            {adminProfile?.full_name || 'Admin'}
          </p>
          <p className="text-xs text-slate-500">
            {adminProfile?.role === 'super_admin' ? 'Super Admin' : 'Hokimlik yordamchisi'}
          </p>
        </div>

        <DropdownMenuItem asChild>
          <Link href="/admin" className="cursor-pointer">
            <Home className="w-4 h-4 mr-2" />
            Admin panel
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
            {lang === 'ru' ? 'Просмотр как' : "Ko'rinish"}
          </p>
        </div>

        <DropdownMenuItem asChild>
          <Link href="/profile/employer" className="cursor-pointer">
            <Building2 className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Работодатель' : "Ish beruvchi ko'rinishi"}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/profile/job-seeker" className="cursor-pointer">
            <User className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Соискатель' : "Ish qidiruvchi ko'rinishi"}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/admin/stats" className="cursor-pointer">
            <BarChart3 className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Статистика' : 'Statistika'}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleAdminLogout}
          className="text-red-600 focus:text-red-600 cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {lang === 'ru' ? 'Выйти' : 'Chiqish'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Regular User Menu Component
  const renderUserMenu = () => {
    const canSwitch = user?.has_job_seeker_profile && user?.has_employer_profile;
    const otherRole = user?.active_role === 'job_seeker' ? 'employer' : 'job_seeker';
    const otherRolePath = otherRole === 'employer' ? '/profile/employer' : '/profile/job-seeker';

    const handleSwitchRole = () => {
      if (canSwitch && switchRole) {
        switchRole(otherRole);
      }
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`h-10 px-2 gap-2 rounded-full transition-all ${isHome ? 'text-white hover:bg-white/10 hover:text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${user?.active_role === 'employer'
              ? 'bg-gradient-to-br from-violet-500 to-purple-600'
              : 'bg-gradient-to-br from-sky-500 to-blue-600'
              }`}>
              {getUserInitial()}
            </div>
            <span className="text-sm max-w-[120px] truncate hidden lg:block uppercase font-bold tracking-wider">
              {getUserDisplayName()}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">
              {getUserDisplayName()}
            </p>
            <p className="text-xs text-slate-500">
              {user?.active_role === 'employer'
                ? (lang === 'ru' ? 'Работодатель' : 'Ish beruvchi')
                : (lang === 'ru' ? 'Соискатель' : 'Ish qidiruvchi')}
            </p>
          </div>
          <DropdownMenuItem asChild>
            <Link href={profilePath} className="cursor-pointer">
              {user?.active_role === 'employer' ? (
                <Building2 className="w-4 h-4 mr-2" />
              ) : (
                <User className="w-4 h-4 mr-2" />
              )}
              {lang === 'ru' ? 'Мой профиль' : 'Mening profilim'}
            </Link>
          </DropdownMenuItem>
          {/* Job Seeker Links */}
          {user?.active_role === 'job_seeker' && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/profile/job-seeker/applications" className="cursor-pointer">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Мои заявки' : 'Mening arizalarim'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/job-seeker/messages" className="cursor-pointer">
                  <div className="relative flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    {lang === 'ru' ? 'Сообщения' : 'Xabarlar'}
                  </div>
                </Link>
              </DropdownMenuItem>
            </>
          )}

          {/* Employer Links */}
          {user?.active_role === 'employer' && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/profile/employer/vacancies" className="cursor-pointer">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {lang === 'ru' ? 'Мои вакансии' : 'Mening vakansiyalarim'}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/employer/messages" className="cursor-pointer">
                  <div className="relative flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    {lang === 'ru' ? 'Сообщения' : 'Xabarlar'}
                  </div>
                </Link>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuItem asChild>
            <Link href={settingsPath} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              {lang === 'ru' ? 'Настройки' : 'Sozlamalar'}
            </Link>
          </DropdownMenuItem>



          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 focus:text-red-600 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {lang === 'ru' ? 'Выйти' : 'Chiqish'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const isHome = false;

  if (isTelegram) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-lg">
      <div className={`${isHome ? '' : ''}`}>
        <div className="container mx-auto">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex items-center group pl-0 no-tap-highlight select-none outline-none focus-visible:outline-none focus-visible:ring-0">
              <Image src="/ishda1.webp" alt="ISHDASIZ" width={930} height={310} priority className="h-auto w-[126px] shrink-0 sm:w-[150px]" />
            </Link>

            <div className={`hidden lg:flex items-center justify-center flex-1`}>
              <NavBar
                items={navItems}
                activeTab={activeTab}
                className={isHome ? '[&_a]:!text-blue-100 [&_a:hover]:!text-white [&_a[data-active=true]]:!text-blue-950 [&_a[data-active=true]]:!font-bold [&_a]:transition-colors' : ''}
              />
            </div>

            <div className="hidden md:flex items-center gap-2 pr-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={cycleLang}
                className={`h-9 px-4 rounded-full font-semibold transition-all ${isHome ? 'text-white hover:bg-white/10 hover:text-white' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <span className="text-sm tracking-wider">
                  {languageLabels[lang]}
                </span>
              </Button>

              {/* Priority: Admin > User > Login Button */}
              {isAdmin ? (
                renderAdminMenu()
              ) : isLoading ? (
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
              ) : isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <Link href="/messages">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`relative h-9 w-9 rounded-full transition-all ${isHome ? 'text-white hover:bg-white/10 hover:text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      <MessageCircle className="w-5 h-5" />
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-indigo-600 rounded-full border-2 border-white">
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                      )}
                    </Button>
                  </Link>
                  {renderUserMenu()}
                </div>
              ) : (
                <Button
                  onClick={openModal}
                  size="sm"
                  className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-full font-semibold transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="text-sm">
                    {lang === 'uz' ? 'Kirish' : 'Войти'}
                  </span>
                </Button>
              )}
            </div>

            {/* Mobile Menu */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={cycleLang}
                className={`h-8 px-3 rounded-lg font-semibold ${isHome ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                <span className="text-xs tracking-wider">
                  {languageLabels[lang]}
                </span>
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button aria-label={lang === 'ru' ? 'Открыть меню' : 'Menyuni ochish'} variant="ghost" size="icon" className={`h-8 w-8 rounded-lg ${isHome ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`}>
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-white border-slate-200/80">
                  <SheetTitle className="sr-only">{lang === 'ru' ? 'Меню' : 'Menyu'}</SheetTitle>
                  <SheetDescription className="sr-only">{lang === 'ru' ? 'Разделы сайта и вход в аккаунт' : 'Sayt bo‘limlari va akkauntga kirish'}</SheetDescription>
                  <nav className="flex flex-col gap-2 mt-8">
                    {/* Admin info (if logged in as admin) */}
                    {isAdmin && (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg mb-2 border border-amber-200">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                            <Shield className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {adminProfile?.full_name || 'Admin'}
                            </p>
                            <p className="text-xs text-amber-600 font-medium">
                              {adminProfile?.role === 'super_admin' ? 'Super Admin' : 'Hokimlik'}
                            </p>
                          </div>
                        </div>
                        <Link
                          href="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-3 font-medium"
                        >
                          <Home className="w-5 h-5" />
                          Admin panel
                        </Link>
                        <div className="px-4 py-1">
                          <p className="text-xs text-slate-400 font-medium uppercase">Ko&apos;rinish</p>
                        </div>
                        <Link
                          href="/profile/employer"
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-3 font-medium"
                        >
                          <Building2 className="w-5 h-5" />
                          Ish beruvchi
                        </Link>
                        <Link
                          href="/profile/job-seeker"
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-3 font-medium"
                        >
                          <User className="w-5 h-5" />
                          Ish qidiruvchi
                        </Link>
                        <div className="border-t border-slate-200 my-2" />
                      </>
                    )}

                    {/* User info (if logged in as user) */}
                    {!isAdmin && isAuthenticated && user && (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-lg mb-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${user.active_role === 'employer'
                            ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                            : 'bg-gradient-to-br from-sky-500 to-blue-600'
                            }`}>
                            {getUserInitial()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {getUserDisplayName()}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.active_role === 'employer'
                                ? (lang === 'ru' ? 'Работодатель' : 'Ish beruvchi')
                                : (lang === 'ru' ? 'Соискатель' : 'Ish qidiruvchi')}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={profilePath}
                          onClick={() => setMobileMenuOpen(false)}
                          className="px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-3 font-medium"
                        >
                          <User className="w-5 h-5" />
                          {lang === 'ru' ? 'Мой профиль' : 'Mening profilim'}
                        </Link>
                        <div className="border-t border-slate-200 my-2" />
                      </>
                    )}

                    {navItems.map((item) => (
                      <Link
                        key={item.url}
                        href={item.url}
                        onClick={() => setMobileMenuOpen(false)}
                        className="px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-3 font-medium"
                      >
                        <item.icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    ))}

                    <div className="border-t border-slate-200 my-2" />

                    {isAdmin ? (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleAdminLogout();
                        }}
                        className="w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-3 font-medium text-left"
                      >
                        <LogOut className="w-5 h-5" />
                        {lang === 'ru' ? 'Выйти' : 'Chiqish'}
                      </button>
                    ) : isAuthenticated && user ? (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-3 font-medium text-left"
                      >
                        <LogOut className="w-5 h-5" />
                        {lang === 'ru' ? 'Выйти' : 'Chiqish'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openModal();
                        }}
                        className="w-full px-4 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-3 font-medium text-left"
                      >
                        <LogIn className="w-5 h-5" />
                        {lang === 'uz' ? 'Kirish' : 'Войти'}
                      </button>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
