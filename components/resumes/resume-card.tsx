'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Wallet, Clock, ArrowRight } from '@/components/ui/icons';
import { formatSalary } from '@/lib/constants';
import { normalizeLocation } from '@/lib/text';

interface ResumeCardProps {
    resume: any;
}

export function ResumeCard({ resume }: ResumeCardProps) {
    const { lang } = useLanguage();
    const title = lang === 'uz' ? (resume.desired_position || 'Rezyume') : (resume.desired_position || 'Резюме');
    const fullName = resume.full_name || '';
    const initial = fullName ? fullName[0]?.toUpperCase() : '?';

    let regionName = '';
    let districtName = '';
    if (resume.districts?.regions) {
        regionName = lang === 'uz' ? resume.districts.regions.name_uz : resume.districts.regions.name_ru;
    }
    if (resume.districts) {
        districtName = lang === 'uz' ? resume.districts.name_uz : resume.districts.name_ru;
    }
    const cleanRegion = normalizeLocation(regionName);
    const cleanDistrict = normalizeLocation(districtName);
    let locationLabel = [cleanRegion, cleanDistrict].filter(Boolean).join(', ');

    const experienceLabel = resume.experience_years
        ? `${resume.experience_years} ${lang === 'uz' ? 'yil' : 'лет'}`
        : (lang === 'uz' ? 'Tajribasiz' : 'Без опыта');

    return (
        <Card className="group relative hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-400 hover:-translate-y-1 overflow-hidden border-slate-200/80 hover:border-blue-300/50 bg-white rounded-xl h-full">
            {/* Gradient left accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-teal-400 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />

            <Link href={`/resumes/${resume.id}`} className="absolute inset-0 z-0" aria-label={title} />

            <CardContent className="p-4 md:p-5 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    {/* Avatar with gradient ring */}
                    <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform">
                            {initial}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="font-bold text-[15px] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight mb-1">
                            {title}
                        </h3>
                        <p className="text-sm text-slate-500 line-clamp-1">{fullName}</p>
                    </div>
                </div>

                {/* Metadata pills */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs font-medium">
                    {locationLabel && (
                        <div className="flex items-center gap-1 bg-teal-50/60 text-teal-700 px-2 py-1 rounded-md border border-teal-200/50">
                            <MapPin className="w-3 h-3 text-teal-500" />
                            <span className="line-clamp-1">{locationLabel}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200/60">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {experienceLabel}
                    </div>
                </div>

                {/* Salary */}
                <div className="mb-3">
                    <span className="text-sm font-bold text-amber-700 bg-gradient-to-br from-amber-50 to-amber-100/50 px-2.5 py-1 rounded-md border border-amber-200/60 shadow-sm">
                        {formatSalary(resume.desired_salary_min, resume.desired_salary_max, lang)}
                    </span>
                </div>

                {/* Skills */}
                {resume.skills && resume.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-slate-100/80">
                        {resume.skills.slice(0, 4).map((skill: string, i: number) => (
                            <span
                                key={i}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 border border-slate-200/60 group-hover:border-blue-200/40 group-hover:text-blue-700 transition-colors"
                            >
                                {skill}
                            </span>
                        ))}
                        {resume.skills.length > 4 && (
                            <span className="text-[10px] text-slate-400 px-1 py-0.5 font-medium">
                                +{resume.skills.length - 4}
                            </span>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end mt-3 pt-2">
                    <div className="flex items-center gap-1 text-blue-600 text-xs font-bold group-hover:gap-2 transition-all duration-300">
                        {lang === 'uz' ? 'Batafsil' : 'Подробнее'}
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
