'use client';


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useNotificationCounts } from '@/hooks/use-notification-counts';

import { cn } from '@/lib/utils';
import {
    User,
    FileText,
    Send,
    MessageSquare,
    Mail,
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
    { href: '/profile/job-seeker/offers', label_uz: 'Takliflar', label_ru: 'Приглашения', icon: Mail },
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

    const counts = useNotificationCounts(user?.id, userType);

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
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                            isActive
                                ? 'bg-accent text-primary shadow-sm'
                                : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        )}
                    >
                        <Icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="flex-1">{label}</span>
                        {count > 0 && (
                            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                                {count > 99 ? '99+' : count}
                            </span>
                        )}
                        {isActive && !count && <ChevronRight className="w-4 h-4 text-primary" />}
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
        <div className="flex overflow-x-auto gap-1 p-1 bg-secondary rounded-xl">
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
                                ? 'bg-card text-primary shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Icon className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        <span className="whitespace-nowrap">{label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
