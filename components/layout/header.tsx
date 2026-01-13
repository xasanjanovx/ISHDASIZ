'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { Button } from '@/components/ui/button';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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
import { supabase } from '@/lib/supabase';

const languageLabels = {
  uz: "O'ZB",
  uzCyrillic: 'ЎЗБ',
  ru: 'РУС',
};

export default function Header() {
  const { lang, setLang } = useLanguage();
  const { user: adminUser, adminProfile, signOut: adminSignOut } = useAuth();
  const { user, isAuthenticated, isLoading, logout, switchRole } = useUserAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { openModal } = useAuthModal();

  const [activeTab, setActiveTab] = useState('Bosh sahifa');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadApplications, setUnreadApplications] = useState(0);

  // Check if admin is logged in
  const isAdmin = !!adminUser && !!adminProfile;

  // Fetch unread counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!user?.id) return;

      try {
        // First get user's conversations with role info
        const { data: userConvs } = await supabase
          .from('conversations')
          .select('id, user1_id, user2_id, user1_role, user2_role')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

        if (userConvs && userConvs.length > 0) {
          // Filter conversations by active role
          // If I am 'employer', I only want to count messages in chats where I am acting as employer
          const filteredIds = userConvs
            .filter(c => {
              const myRole = c.user1_id === user.id ? c.user1_role : c.user2_role;
              // If role is defined in DB, it MUST match my active role
              // If role is NOT defined (legacy), we include it to be safe (or could exclude, but inclusion is safer/default)
              if (myRole && user.active_role && myRole !== user.active_role) {
                return false;
              }
              return true;
            })
            .map(c => c.id);

          if (filteredIds.length === 0) {
            setUnreadMessages(0);
            return;
          }

          // Count unread messages in filtered conversations
          const { count: msgCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('conversation_id', filteredIds)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          setUnreadMessages(msgCount || 0);
        } else {
          setUnreadMessages(0);
        }
      } catch (err) {
        console.error('Error fetching unread counts', err);
      }
    };

    const fetchAppCounts = async () => {
      if (!user?.id) return;
      try {
        if (user.active_role === 'employer') {
          // For employers: count pending applications on their jobs
          const { data: myJobs } = await supabase
            .from('jobs')
            .select('id')
            .eq('created_by', user.id);

          if (myJobs && myJobs.length > 0) {
            const jobIds = myJobs.map(j => j.id);
            const { count: appCount } = await supabase
              .from('job_applications')
              .select('*', { count: 'exact', head: true })
              .in('job_id', jobIds)
              .eq('status', 'pending');
            setUnreadApplications(appCount || 0);
          }
        } else {
          // For job seekers: count applications with status changes that HAVEN'T been seen yet
          try {
            const { count: appCount, error } = await supabase
              .from('job_applications')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .in('status', ['viewed', 'accepted', 'rejected'])
              .eq('is_seen_by_job_seeker', false); // Only count unseen updates

            if (error && error.code === '42703') {
              // Fallback if column doesn't exist yet - old behavior
              const { count: fallbackCount } = await supabase
                .from('job_applications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('status', ['viewed', 'accepted']);
              setUnreadApplications(fallbackCount || 0);
            } else {
              setUnreadApplications(appCount || 0);
            }
          } catch (e) {
            setUnreadApplications(0);
          }
        }
      } catch (e) { console.error('Error fetching app counts', e) }
    };

    fetchCounts();
    fetchAppCounts();

    // Listen for messagesRead custom event from chat pages
    const handleMessagesRead = () => {
      console.log('messagesRead event received, refreshing counts');
      fetchCounts();
    };
    window.addEventListener('messagesRead', handleMessagesRead);

    // Listen for applicationsRead custom event from applications page
    const handleApplicationsRead = () => {
      console.log('applicationsRead event received, refreshing counts');
      fetchAppCounts();
    };
    window.addEventListener('applicationsRead', handleApplicationsRead);

    // Subscribe to realtime changes if user is logged in
    let msgSub: any = null;
    if (user?.id) {
      msgSub = supabase
        .channel('public:messages')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener('messagesRead', handleMessagesRead);
      window.removeEventListener('applicationsRead', handleApplicationsRead);
      if (msgSub) msgSub.unsubscribe();
    };
  }, [user?.id, user?.active_role]);

  useEffect(() => {
    if (pathname === '/') setActiveTab(lang === 'uz' || lang === 'uzCyrillic' ? 'Bosh sahifa' : 'Главная');
    else if (pathname === '/jobs') setActiveTab(lang === 'uz' || lang === 'uzCyrillic' ? 'Vakansiyalar' : 'Вакансии');
    else if (pathname === '/resumes') setActiveTab(lang === 'uz' || lang === 'uzCyrillic' ? 'Rezyumelar' : 'Резюме');
  }, [pathname, lang]);
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
      name: lang === 'uz' || lang === 'uzCyrillic' ? 'Bosh sahifa' : 'Главная',
      url: '/',
      icon: Home
    },
    {
      name: lang === 'uz' || lang === 'uzCyrillic' ? 'Vakansiyalar' : 'Вакансии',
      url: '/jobs',
      icon: Briefcase
    },
    {
      name: lang === 'uz' || lang === 'uzCyrillic' ? 'Rezyumelar' : 'Резюме',
      url: '/resumes',
      icon: FileText
    },
  ];

  const cycleLang = () => {
    if (lang === 'uz') setLang('uzCyrillic');
    else if (lang === 'uzCyrillic') setLang('ru');
    else setLang('uz');
  };

  const handleLogout = () => {
    logout();
    router.push('/');
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
  const AdminMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 px-3 gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
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
  const UserMenu = () => {
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

  const isHome = pathname === '/';

  return (
    <header className={`absolute top-0 left-0 right-0 z-50 w-full transition-colors duration-300 ${isHome ? 'bg-transparent shadow-none' : 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-md'}`}>
      <div className={`${isHome ? '' : ''}`}>
        <div className="container mx-auto">
          <div className="flex items-center justify-between h-18 py-3 px-4 sm:px-6">
            <Link href="/" className="flex items-center group pl-0">
              <Image
                src="/ishda1.webp"
                alt="ISHDA Logo"
                width={140}
                height={48}
                style={{ width: 'auto', height: '48px', filter: isHome ? 'invert(1) hue-rotate(180deg) brightness(1.2)' : 'none' }}
                priority
              />
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
                <AdminMenu />
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
                  <UserMenu />
                </div>
              ) : (
                <Button
                  onClick={openModal}
                  size="sm"
                  className="h-9 px-5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white gap-2 rounded-full font-semibold shadow-lg shadow-sky-500/20 transition-all"
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
                  <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-lg ${isHome ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`}>
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-white border-slate-200">
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
                        {lang === 'uz' || lang === 'uzCyrillic' ? 'Kirish' : 'Войти'}
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
