'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { GraduationCap, UserSquare2, Accessibility, ArrowRight, Sparkles } from '@/components/ui/icons';
import { motion } from 'framer-motion';

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
            title_uz: 'Talaba va bitiruvchilar uchun',
            title_ru: 'Для студентов и выпускников',
            subtitle_uz: 'Birinchi qadamingiz shu yerdan',
            subtitle_ru: 'Ваш первый шаг начинается здесь',
            icon: GraduationCap,
            count: counts.students,
            gradient: 'from-slate-800 to-indigo-900',
            glowColor: 'shadow-indigo-700/20',
            iconBg: 'bg-indigo-400/20',
            iconColor: 'text-indigo-200',
        },
        {
            id: 'disabled',
            title_uz: 'Nogironligi bor shaxslar uchun',
            title_ru: 'Для лиц с инвалидностью',
            subtitle_uz: 'Maxsus ish o\'rinlari',
            subtitle_ru: 'Специальные вакансии',
            icon: Accessibility,
            count: counts.disabled,
            gradient: 'from-slate-700 to-cyan-900',
            glowColor: 'shadow-cyan-700/20',
            iconBg: 'bg-cyan-400/20',
            iconColor: 'text-cyan-200',
        },
        {
            id: 'women',
            title_uz: 'Ayollar uchun ish o\'rinlari',
            title_ru: 'Вакансии для женщин',
            subtitle_uz: 'Qulay sharoitlar va jadval',
            subtitle_ru: 'Удобные условия и график',
            icon: UserSquare2,
            count: counts.women,
            gradient: 'from-slate-700 to-slate-900',
            glowColor: 'shadow-slate-700/25',
            iconBg: 'bg-amber-300/15',
            iconColor: 'text-amber-100',
        },
    ];

    return (
        <section className="py-10 md:py-14 bg-slate-50/50 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-10 left-[10%] w-[240px] h-[240px] bg-indigo-100/30 rounded-full blur-[90px] pointer-events-none" />
            <div className="absolute bottom-10 right-[10%] w-[200px] h-[200px] bg-slate-200/25 rounded-full blur-[70px] pointer-events-none" />

            <div className="container mx-auto px-4 relative">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-7"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-teal-600 uppercase tracking-wider">
                            {lang === 'uz' ? 'Maxsus' : 'Особые'}
                        </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                        {lang === 'uz' ? 'Alohida toifalar' : 'Особые категории'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1.5">
                        {lang === 'uz' ? 'Maxsus guruhlar uchun ish o\'rinlari' : 'Вакансии для особых групп'}
                    </p>
                    <div className="h-1 w-14 bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full mt-3" />
                </motion.div>

                <div className="grid md:grid-cols-3 gap-3 md:gap-4">
                    {categories.map((cat, index) => (
                        <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 20, scale: 0.97 }}
                            whileInView={{ opacity: 1, y: 0, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Link href={`/jobs?special=${cat.id}`} className="block group">
                                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cat.gradient} p-4 md:p-5 transition-all duration-400 hover:shadow-2xl ${cat.glowColor} hover:-translate-y-1`}>
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                    </div>

                                    {/* Decorative circles */}
                                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
                                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 ${cat.iconBg} rounded-xl flex items-center justify-center ${cat.iconColor} transition-all duration-300 group-hover:scale-110 relative`}>
                                                <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 group-hover:animate-pulse-ring" />
                                                <cat.icon className="w-6 h-6 relative z-10" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm md:text-base text-white leading-tight">
                                                    {lang === 'uz' ? cat.title_uz : cat.title_ru}
                                                </h3>
                                                <p className="text-white/60 text-xs mt-1">
                                                    {lang === 'uz' ? cat.subtitle_uz : cat.subtitle_ru}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-2xl font-bold text-white leading-none">
                                                    {cat.count}
                                                </div>
                                                <div className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                                                    {lang === 'uz' ? 'vakansiya' : 'вакансий'}
                                                </div>
                                            </div>
                                            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all duration-300 group-hover:scale-110">
                                                <ArrowRight className="w-4 h-4 text-white/80 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
