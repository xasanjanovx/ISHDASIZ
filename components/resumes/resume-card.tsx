'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Clock, ArrowRight } from '@/components/ui/icons';
import { formatSalary } from '@/lib/constants';
import { normalizeLocation } from '@/lib/text';
import { getExperienceLabel } from '@/lib/experience-compat';
import { resumeSkills } from '@/lib/resume-api';

interface ResumeCardProps {
    resume: any;
    canOpenDetails?: boolean;
    onRequireEmployerAccess?: () => void;
}

export function ResumeCard({ resume, canOpenDetails = true, onRequireEmployerAccess }: ResumeCardProps) {
    const { lang } = useLanguage();
    const displayTitle = resume.title || resume.desired_position || resume.field_title || null;
    const title = lang === 'uz' ? (displayTitle || 'Rezyume') : (displayTitle || 'Резюме');
    const fullName = resume.full_name || '';
    const initial = fullName ? fullName[0]?.toUpperCase() : '?';
    const salaryMin = resume.expected_salary_min ?? resume.desired_salary_min ?? null;
    const salaryMax = resume.expected_salary_max ?? resume.desired_salary_max ?? null;

    let regionName = '';
    let districtName = '';
    const region = resume.regions || resume.districts?.regions;
    if (region) {
        regionName = lang === 'uz' ? region.name_uz : region.name_ru;
    }
    if (resume.districts) {
        districtName = lang === 'uz' ? resume.districts.name_uz : resume.districts.name_ru;
    }
    const cleanRegion = normalizeLocation(regionName);
    const cleanDistrict = normalizeLocation(districtName);
    const locationLabel = [cleanRegion, cleanDistrict].filter(Boolean).join(', ');

    const experienceLabel = getExperienceLabel(
        resume.experience ?? resume.experience_level,
        resume.experience_years,
        lang === 'uz' ? 'uz' : 'ru'
    );
    const skillsList = resumeSkills(resume.skills);

    return (
        <Card
            role={canOpenDetails ? undefined : 'button'}
            tabIndex={canOpenDetails ? undefined : 0}
            aria-label={canOpenDetails ? undefined : `${title}, ${fullName}`}
            onKeyDown={event => {
                if (!canOpenDetails && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRequireEmployerAccess?.(); }
            }}
            onClick={() => {
                if (!canOpenDetails) onRequireEmployerAccess?.();
            }}
            className="catalog-resume-card group relative cursor-pointer hover:shadow-xl hover:shadow-primary/5 transition-all duration-400 hover:-translate-y-1 overflow-hidden border-border/80 hover:border-border/50 bg-card rounded-xl h-full"
        >
            <div className="resume-decoration absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary to-primary opacity-80 group-hover:opacity-100 transition-opacity" />

            {canOpenDetails && (
                <Link href={`/resumes/${resume.id}`} className="absolute inset-0 z-10" aria-label={`${title}, ${fullName}`} />
            )}

            <CardContent className="p-4 md:p-5 h-full flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                    <div className="relative shrink-0">
                        <div className="resume-avatar w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center text-white font-bold text-base shadow-md shadow-primary/10 group-hover:scale-105 transition-transform">
                            {initial}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight mb-1">
                            {title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{fullName}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs font-medium">
                    {locationLabel && (
                        <div className="flex items-center gap-1 bg-accent/60 text-primary px-2 py-1 rounded-md border border-border/50">
                            <MapPin className="w-3 h-3 text-primary" />
                            <span className="line-clamp-1">{locationLabel}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1 bg-background text-muted-foreground px-2 py-1 rounded-md border border-border/60">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {experienceLabel}
                    </div>
                </div>

                <div className="mb-3">
                    <span className="resume-salary text-sm font-bold text-amber-700 bg-gradient-to-br from-amber-50 to-amber-100/50 px-2.5 py-1 rounded-md border border-amber-200/60 shadow-sm">
                        {formatSalary(salaryMin, salaryMax, lang)}
                    </span>
                </div>

                {skillsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-border/80">
                        {skillsList.slice(0, 4).map((skill: string, i: number) => (
                            <span
                                key={i}
                                className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gradient-to-br from-background to-secondary text-muted-foreground border border-border/60 group-hover:border-border/40 group-hover:text-primary transition-colors"
                            >
                                {skill}
                            </span>
                        ))}
                        {skillsList.length > 4 && (
                            <span className="text-xs text-muted-foreground px-1 py-0.5 font-medium">
                                +{skillsList.length - 4}
                            </span>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-end mt-3 pt-2">
                    <div className="flex items-center gap-1 text-primary text-xs font-bold group-hover:gap-2 transition-all duration-300">
                        {lang === 'uz' ? 'Batafsil' : 'Подробнее'}
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

