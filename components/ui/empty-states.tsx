'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/language-context';
import { Search, FileText, MessageSquare, Inbox } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            {icon && (
                <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
            )}
            {action && (
                action.href ? (
                    <Link href={action.href}>
                        <Button className="bg-sky-500 hover:bg-sky-600 text-white">
                            {action.label}
                        </Button>
                    </Link>
                ) : (
                    <Button onClick={action.onClick} className="bg-sky-500 hover:bg-sky-600 text-white">
                        {action.label}
                    </Button>
                )
            )}
        </div>
    );
}

export function NoJobsFound({ onClearFilters }: { onClearFilters?: () => void }) {
    const { lang } = useLanguage();
    return (
        <EmptyState
            icon={<Search className="w-8 h-8" />}
            title={lang === 'ru' ? 'Вакансии не найдены' : 'Vakansiyalar topilmadi'}
            description={lang === 'ru'
                ? 'Попробуйте изменить параметры поиска'
                : "Qidiruv so'rovingizni o'zgartirib ko'ring"}
            action={onClearFilters ? {
                label: lang === 'ru' ? 'Сбросить фильтры' : 'Filtrlarni tozalash',
                onClick: onClearFilters
            } : undefined}
        />
    );
}

export function NoResume() {
    const { lang } = useLanguage();
    return (
        <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title={lang === 'ru' ? 'У вас нет резюме' : "Sizda hali rezyume yo'q"}
            description={lang === 'ru'
                ? 'Создайте резюме, чтобы работодатели могли вас найти'
                : "Rezyume yarating va ish beruvchilar sizni topsin"}
            action={{
                label: lang === 'ru' ? '+ Создать резюме' : '+ Rezyume yaratish',
                href: '/profile/job-seeker/resume/new'
            }}
        />
    );
}

export function NoApplications() {
    const { lang } = useLanguage();
    return (
        <EmptyState
            icon={<Inbox className="w-8 h-8" />}
            title={lang === 'ru' ? 'Нет откликов' : "Hali arizalar yo'q"}
            description={lang === 'ru'
                ? 'Откликнитесь на вакансии'
                : "Vakansiyalarga ariza qoldiring"}
            action={{
                label: lang === 'ru' ? 'Смотреть вакансии' : "Vakansiyalarni ko'rish",
                href: '/jobs'
            }}
        />
    );
}

export function NoMessages() {
    const { lang } = useLanguage();
    return (
        <EmptyState
            icon={<MessageSquare className="w-8 h-8" />}
            title={lang === 'ru' ? 'Нет сообщений' : "Xabarlar yo'q"}
            description={lang === 'ru'
                ? 'Ваши переписки с работодателями появятся здесь'
                : "Ish beruvchilar bilan suhbatlaringiz shu yerda ko'rinadi"}
        />
    );
}
