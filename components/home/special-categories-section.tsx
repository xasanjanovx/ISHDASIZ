'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, UserSquare2, Accessibility } from '@/components/ui/icons';

interface SpecialCategoriesSectionProps {
    counts: {
        students: number;
        disabled: number;
        women: number;
    };
}

export function SpecialCategoriesSection({ counts }: SpecialCategoriesSectionProps) {
    const { lang } = useLanguage();

    const categories = [
        {
            id: 'students',
            title_uz: 'Talaba va bitiruvchilar',
            title_ru: 'Студенты и выпускники',
            icon: GraduationCap,
            count: counts.students,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            hover_bg: 'group-hover:bg-blue-100',
        },
        {
            id: 'disabled',
            title_uz: 'Nogironligi bor shaxslar',
            title_ru: 'Лица с инвалидностью',
            icon: Accessibility,
            count: counts.disabled,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            hover_bg: 'group-hover:bg-purple-100',
        },
        {
            id: 'women',
            title_uz: 'Ayollar uchun',
            title_ru: 'Для женщин',
            icon: UserSquare2,
            count: counts.women,
            color: 'text-pink-600',
            bg: 'bg-pink-50',
            hover_bg: 'group-hover:bg-pink-100',
        },
    ];

    return (
        <section className="py-12 bg-white">
            <div className="container mx-auto px-4">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-8 bg-sky-500 rounded-full" />
                    <h2 className="text-2xl font-bold text-slate-900">
                        {lang === 'uz' ? 'Alohida toifalar uchun ishlar' : 'Вакасии для особых категорий'}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {categories.map((cat, index) => (
                        <Link key={cat.id} href={`/jobs?special=${cat.id}`} className="block h-full">
                            <Card className="group hover:shadow-lg transition-all duration-300 border-slate-200 hover:border-sky-200 h-full">
                                <CardContent className="p-6 flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-2xl ${cat.bg} flex items-center justify-center ${cat.color} ${cat.hover_bg} transition-colors shadow-sm`}>
                                        <cat.icon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900 group-hover:text-sky-600 transition-colors">
                                            {lang === 'uz' ? cat.title_uz : cat.title_ru}
                                        </h3>
                                        <p className="text-slate-500 font-medium mt-1">
                                            {cat.count} {lang === 'uz' ? 'ta vakansiya' : 'вакансий'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
