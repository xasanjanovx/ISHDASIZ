'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Building2, Calendar, Monitor, GraduationCap, Heart, Building2 as Builder, Wheat, Factory, ShoppingBag, Truck, Wallet, Plane, Wrench, Landmark, Briefcase } from '@/components/ui/icons';
import { formatSalary, formatDate } from '@/lib/constants';
import { getActiveSpecialCategories } from '@/lib/special-categories';
import { cleanJobText, normalizeLocation } from '@/lib/text';

const iconMap: any = {
  Monitor,
  GraduationCap,
  Heart,
  Building2,
  Wheat,
  Factory,
  ShoppingBag,
  Truck,
  Wallet,
  Plane,
  Wrench,
  Landmark,
  Briefcase,
};

interface JobCardProps {
  job: any;
}

export function JobCard({ job }: JobCardProps) {
  const { lang, t } = useLanguage();

  const title = lang === 'uz' ? job.title_uz : job.title_ru;

  // Используем cleanJobText из lib/text.ts для очистки описания
  const rawDescription = lang === 'uz' ? job.description_uz : job.description_ru;
  const description = cleanJobText(rawDescription) || cleanJobText(job.raw_source_json?.info);

  const getEmploymentLabel = (type: string) => {
    switch (type) {
      case 'full_time': return lang === 'uz' ? 'To\'liq stavka' : 'Полная занятость';
      case 'part_time': return lang === 'uz' ? 'Yarim stavka' : 'Частичная занятость';
      case 'contract': return lang === 'uz' ? 'Shartnoma' : 'Контракт';
      case 'freelance': return 'Freelance';
      case 'internship': return lang === 'uz' ? 'Stajirovka' : 'Стажировка';
      case 'remote': return lang === 'uz' ? 'Masofaviy' : 'Удаленная';
      default: return type;
    }
  };

  const employmentLabel = getEmploymentLabel(job.employment_type);

  const categoryName = job.categories
    ? lang === 'uz'
      ? job.categories.name_uz
      : job.categories.name_ru
    : '';

  // Location: prefer join data, fallback to text fields (imported jobs)
  const regionName = lang === 'uz'
    ? ((job as any).districts?.regions?.name_uz || job.region_name)
    : ((job as any).districts?.regions?.name_ru || job.region_name);
  const districtName = lang === 'uz'
    ? ((job as any).districts?.name_uz || job.district_name)
    : ((job as any).districts?.name_ru || job.district_name);

  // Используем normalizeLocation из lib/text.ts
  const cleanRegion = normalizeLocation(regionName);
  const cleanDistrict = normalizeLocation(districtName);
  const locationLabel = [cleanRegion, cleanDistrict].filter(Boolean).join(', ');

  const IconComponent = job.categories?.icon
    ? iconMap[job.categories.icon] || Briefcase
    : Briefcase;

  const specialCategories = getActiveSpecialCategories(job);

  return (
    <Card className="group relative hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border-slate-200 hover:border-blue-300 bg-white">
      {/* Decorative left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 to-indigo-700" />

      {/* Main Link - covering the card but allowing inner links to work via z-index */}
      <Link href={`/jobs/${job.id}`} className="absolute inset-0 z-0" aria-label={title} />

      <CardContent className="p-4">
        <div className="flex flex-col h-full">
          {/* Header Section */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors flex-shrink-0 shadow-sm border border-blue-100">
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="font-bold text-[15px] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight mb-1">
                  {title}
                </h3>
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium line-clamp-2">{job.company_name}</span>
                </div>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-lg font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                {formatSalary(job.salary_min, job.salary_max, lang)}
              </div>
            </div>
          </div>

          {/* Description - только если есть реальный текст */}
          {description && (
            <p className="text-sm text-slate-600 line-clamp-2 mb-4 leading-relaxed">
              {description}
            </p>
          )}

          {/* Location and Metadata Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-medium">
            {locationLabel && (
              <div className="flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{locationLabel}</span>
              </div>
            )}
            {categoryName && (
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
                {categoryName}
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              {employmentLabel}
            </div>
            {/* Work Mode Badge - только если задан и равен remote/hybrid */}
            {job.work_mode && job.work_mode !== 'onsite' && (
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-100">
                {job.work_mode === 'remote' && (lang === 'uz' ? 'Masofaviy' : 'Удалённо')}
                {job.work_mode === 'hybrid' && (lang === 'uz' ? 'Aralash' : 'Гибрид')}
              </div>
            )}

          </div>

          {/* Special Categories - with z-index to stay clickable */}
          {specialCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-5 relative z-10">
              {specialCategories.map((cat: any) => (
                <Link key={cat.key} href={`/jobs?category=${cat.slug}`} onClick={(e) => e.stopPropagation()}>
                  <Badge
                    className="text-xs bg-sky-100 text-sky-700 border-0 hover:bg-sky-200 transition-colors py-1 px-3"
                  >
                    {lang === 'ru' ? cat.badge_ru : cat.badge_uz}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Footer Card */}
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(job.created_at, lang)}
              </div>
              {/* Views рядом с датой */}
              {job.views_count > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {job.views_count}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-blue-600 text-xs font-bold group-hover:gap-2 transition-all">
              {t.job.details}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
