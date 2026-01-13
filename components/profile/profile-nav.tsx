'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
    User,
    FileText,
    Send,
    MessageSquare,
    Settings,
    ChevronRight,
    Star,
    Clock,
    Users,
    Search,
    BarChart3,
} from '@/components/ui/icons';

interface NavItem {
    href: string;
    label_uz: string;
    label_ru: string;
    icon: React.ElementType;
    countKey?: 'messages' | 'applications';
}

const jobSeekerNav: NavItem[] = [
    { href: '/profile/job-seeker', label_uz: 'Asosiy', label_ru: 'Основное', icon: User },
    { href: '/profile/job-seeker/resumes', label_uz: 'Rezyumelar', label_ru: 'Резюме', icon: FileText },
    { href: '/profile/job-seeker/applications', label_uz: 'Arizalar', label_ru: 'Заявки', icon: Send, countKey: 'applications' },
    { href: '/profile/job-seeker/favorites', label_uz: 'Saqlanganlar', label_ru: 'Сохранённые', icon: Star },
    { href: '/profile/job-seeker/history', label_uz: 'Tarix', label_ru: 'История', icon: Clock },
    { href: '/profile/job-seeker/messages', label_uz: 'Xabarlar', label_ru: 'Сообщения', icon: MessageSquare, countKey: 'messages' },
    { href: '/profile/job-seeker/settings', label_uz: 'Sozlamalar', label_ru: 'Настройки', icon: Settings },
];

const employerNav: NavItem[] = [
    { href: '/profile/employer', label_uz: 'Kompaniya', label_ru: 'Компания', icon: User },
    { href: '/profile/employer/vacancies', label_uz: 'Vakansiyalar', label_ru: 'Вакансии', icon: FileText },
    { href: '/profile/employer/applications', label_uz: 'Arizalar', label_ru: 'Отклики', icon: Users, countKey: 'applications' },
    { href: '/profile/employer/search-resumes', label_uz: 'Rezyume qidirish', label_ru: 'Поиск резюме', icon: Search },
    { href: '/profile/employer/stats', label_uz: 'Statistika', label_ru: 'Статистика', icon: BarChart3 },
    { href: '/profile/employer/messages', label_uz: 'Xabarlar', label_ru: 'Сообщения', icon: MessageSquare, countKey: 'messages' },
    { href: '/profile/employer/verification', label_uz: 'Tasdiqlash', label_ru: 'Верификация', icon: Settings },
    { href: '/profile/employer/settings', label_uz: 'Sozlamalar', label_ru: 'Настройки', icon: Settings },
];

interface ProfileNavProps {
    userType: 'job_seeker' | 'employer';
}

export function ProfileNav({ userType }: ProfileNavProps) {
    const pathname = usePathname();
    const { lang } = useLanguage();
    const { user } = useUserAuth();
    const navItems = userType === 'job_seeker' ? jobSeekerNav : employerNav;

    const [counts, setCounts] = useState<{ messages: number; applications: number }>({ messages: 0, applications: 0 });

    useEffect(() => {
        const fetchCounts = async () => {
            if (!user?.id) return;

            try {
                // Get unread messages count
                // Get unread messages count with role filter
                const { data: userConvs } = await supabase
                    .from('conversations')
                    .select('id, user1_id, user2_id, user1_role, user2_role')
                    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

                let msgCount = 0;
                if (userConvs && userConvs.length > 0) {
                    // Filter conversations by role (using profileType prop which determines context)
                    const targetRole = userType === 'job_seeker' ? 'job_seeker' : 'employer';

                    const filteredIds = userConvs
                        .filter(c => {
                            const myRole = c.user1_id === user.id ? c.user1_role : c.user2_role;
                            if (myRole && myRole !== targetRole) return false;
                            return true;
                        })
                        .map(c => c.id);

                    if (filteredIds.length > 0) {
                        const { count } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .in('conversation_id', filteredIds)
                            .eq('is_read', false)
                            .neq('sender_id', user.id);
                        msgCount = count || 0;
                    }
                }

                // Get applications count
                let appCount = 0;
                if (userType === 'employer') {
                    const { data: myJobs } = await supabase
                        .from('jobs')
                        .select('id')
                        .eq('created_by', user.id);
                    if (myJobs && myJobs.length > 0) {
                        const { count } = await supabase
                            .from('job_applications')
                            .select('*', { count: 'exact', head: true })
                            .in('job_id', myJobs.map(j => j.id))
                            .eq('status', 'pending');
                        appCount = count || 0;
                    }
                } else {
                    // Try to use new column, fallback to old logic if fails
                    try {
                        const { count, error } = await supabase
                            .from('job_applications')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', user.id)
                            .in('status', ['viewed', 'accepted', 'rejected'])
                            .eq('is_seen_by_job_seeker', false);

                        if (error && error.code === '42703') throw error; // Column missing
                        appCount = count || 0;
                    } catch (e) {
                        const { count } = await supabase
                            .from('job_applications')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', user.id)
                            .in('status', ['viewed', 'accepted']);
                        appCount = count || 0;
                    }
                }

                setCounts({ messages: msgCount, applications: appCount });
            } catch (e) {
                console.error('Error fetching nav counts:', e);
            }
        };

        fetchCounts();

        // Listen for updates
        const handleUpdate = () => fetchCounts();
        window.addEventListener('messagesRead', handleUpdate);
        window.addEventListener('applicationsRead', handleUpdate);

        return () => {
            window.removeEventListener('messagesRead', handleUpdate);
            window.removeEventListener('applicationsRead', handleUpdate);
        };
    }, [user?.id, userType]);

    return (
        <nav className="space-y-1">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const label = lang === 'ru' ? item.label_ru : item.label_uz;
                const count = item.countKey ? counts[item.countKey] : 0;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                            isActive
                                ? 'bg-sky-50 text-sky-700 shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                    >
                        <Icon className={cn('w-5 h-5', isActive ? 'text-sky-600' : 'text-slate-400')} />
                        <span className="flex-1">{label}</span>
                        {count > 0 && (
                            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                                {count > 99 ? '99+' : count}
                            </span>
                        )}
                        {isActive && !count && <ChevronRight className="w-4 h-4 text-sky-400" />}
                    </Link>
                );
            })}
        </nav>
    );
}

// Mobile tabs version
export function ProfileTabs({ userType }: ProfileNavProps) {
    const pathname = usePathname();
    const { lang } = useLanguage();
    const navItems = userType === 'job_seeker' ? jobSeekerNav : employerNav;

    return (
        <div className="flex overflow-x-auto gap-1 p-1 bg-slate-100 rounded-xl">
            {navItems.slice(0, 4).map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const label = lang === 'ru' ? item.label_ru : item.label_uz;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            'flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-fit',
                            isActive
                                ? 'bg-white text-sky-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        )}
                    >
                        <Icon className={cn('w-5 h-5', isActive ? 'text-sky-600' : 'text-slate-400')} />
                        <span className="whitespace-nowrap">{label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
