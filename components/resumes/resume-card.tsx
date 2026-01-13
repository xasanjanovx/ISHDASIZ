'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, Banknote, Clock, ChevronRight, GraduationCap } from '@/components/ui/icons';
import { formatSalary, EDUCATION_OPTIONS } from '@/lib/constants';

interface ResumeCardProps {
    resume: any;
}

export function ResumeCard({ resume }: ResumeCardProps) {
    const { lang } = useLanguage();

    const getEducationLabel = (value: string) => {
        const opt = EDUCATION_OPTIONS.find(o => o.value === value);
        return opt ? (lang === 'uz' ? opt.label_uz : opt.label_ru) : value;
    };

    return (
        <Link href={`/resumes/${resume.id}`} className="group block h-full">
            <Card className="relative overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 border-slate-200/60 hover:border-indigo-200 bg-white h-full flex flex-col shadow-sm">
                {/* Subtle Gradient Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-indigo-500/0 group-hover:from-indigo-500/[0.02] group-hover:to-blue-500/[0.02] transition-all duration-500" />

                {/* Decorative Accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform duration-500" />

                <CardContent className="p-5 flex flex-col h-full relative z-10">
                    {/* Top Row: Date & Status */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            <Clock className="w-3 h-3" />
                            {new Date(resume.created_at).toLocaleDateString()}
                        </div>
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>

                    {/* Main Info */}
                    <div className="mb-4">
                        <h3 className="font-extrabold text-lg text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors mb-1 duration-300">
                            {resume.title}
                        </h3>
                        <p className="text-slate-500 font-semibold text-sm">
                            {resume.full_name || (lang === 'ru' ? 'Имя не указано' : 'Ism ko\'rsatilmagan')}
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {/* Experience */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/50">
                            <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-indigo-600">
                                <Briefcase className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{lang === 'uz' ? 'Tajriba' : 'Опыт'}</p>
                                <p className="text-xs font-bold text-slate-700 truncate">
                                    {resume.experience_years === 0
                                        ? (lang === 'uz' ? 'Tajribasiz' : 'Без опыта')
                                        : `${resume.experience_years} ${lang === 'uz' ? 'yil' : 'лет'}`}
                                </p>
                            </div>
                        </div>

                        {/* Education */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/50">
                            <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-indigo-600">
                                <GraduationCap className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{lang === 'uz' ? 'Ma\'lumot' : 'Образование'}</p>
                                <p className="text-xs font-bold text-slate-700 truncate">
                                    {getEducationLabel(resume.education_level)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Location & Salary */}
                    <div className="space-y-2 mb-5">
                        {(resume.districts || resume.city) && (
                            <div className="flex items-center gap-2 text-slate-500">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-medium">
                                    {resume.districts
                                        ? (() => {
                                            const district = Array.isArray(resume.districts) ? resume.districts[0] : resume.districts;
                                            const region = district?.regions;
                                            const regionName = lang === 'uz' ? region?.name_uz : region?.name_ru;
                                            const districtName = lang === 'uz' ? district?.name_uz : district?.name_ru;
                                            return regionName ? `${regionName}, ${districtName}` : districtName;
                                        })()
                                        : (resume.district_name_uz || resume.district_name_ru
                                            ? (lang === 'uz' ? resume.district_name_uz : resume.district_name_ru)
                                            : (lang === 'uz' ? "Joylashuv ko'rsatilmagan" : 'Локация не указана'))
                                    }
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-indigo-600">
                            <Banknote className="w-3.5 h-3.5" />
                            <span className="text-sm font-black italic">
                                {(resume.expected_salary_min || resume.expected_salary_max)
                                    ? formatSalary(resume.expected_salary_min, resume.expected_salary_max, lang)
                                    : (lang === 'ru' ? 'Договорная' : 'Kelishiladi')
                                }
                            </span>
                        </div>
                    </div>

                    {/* Skills Tags */}
                    {resume.skills && resume.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-slate-100/80">
                            {resume.skills.slice(0, 3).map((skill: string, i: number) => (
                                <span
                                    key={i}
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100/50"
                                >
                                    {skill}
                                </span>
                            ))}
                            {resume.skills.length > 3 && (
                                <span className="text-[10px] font-black text-slate-400 px-1.5 py-0.5">
                                    +{resume.skills.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Action Hint */}
                    <div className="absolute bottom-4 right-4 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

