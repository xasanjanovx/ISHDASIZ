'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Building2, Calendar, Monitor, GraduationCap, Heart, Building2 as Builder, Wheat, Factory, ShoppingBag, Truck, Wallet, Plane, Wrench, Landmark, Briefcase } from '@/components/ui/icons';
import { formatSalary, formatDate } from '@/lib/constants';
import { getActiveSpecialCategories } from '@/lib/special-categories';
import { cleanJobText, normalizeLocation } from '@/lib/text';
import { getMappedValue } from '@/lib/mappings';

const iconMap: any = {
  Monitor, GraduationCap, Heart, Building2, Wheat, Factory,
  ShoppingBag, Truck, Wallet, Plane, Wrench, Landmark, Briefcase,
};

interface JobCardProps {
  job: any;
}

export function JobCard({ job }: JobCardProps) {
  const { lang, t } = useLanguage();

  const title = lang === 'uz' ? job.title_uz : job.title_ru;

  const rawDescription = lang === 'uz' ? job.description_uz : job.description_ru;
  const description = cleanJobText(rawDescription)
    || cleanJobText(job.raw_source_json?.info)
    || cleanJobText(lang === 'uz' ? job.requirements_uz : job.requirements_ru);

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
    ? lang === 'uz' ? job.categories.name_uz : job.categories.name_ru
    : '';

  let regionName = job.region_name;
  let districtName = job.district_name;

  if (!regionName && job.districts?.regions) {
    regionName = lang === 'uz' ? job.districts.regions.name_uz : job.districts.regions.name_ru;
  }
  if (!districtName && job.districts) {
    districtName = lang === 'uz' ? job.districts.name_uz : job.districts.name_ru;
  }
  if (!regionName && job.raw_source_json?.filial?.region?.name_uz) {
    regionName = job.raw_source_json.filial.region.name_uz;
  }
  if (!districtName && job.raw_source_json?.filial?.city?.name_uz) {
    districtName = job.raw_source_json.filial.city.name_uz;
  }

  const cleanRegion = normalizeLocation(regionName);
  const cleanDistrict = normalizeLocation(districtName);
  let locationLabel = [cleanRegion, cleanDistrict].filter(Boolean).join(', ');
  if (!locationLabel) locationLabel = '';

  const IconComponent = job.categories?.icon
    ? iconMap[job.categories.icon] || Briefcase
    : Briefcase;

  const specialCategories = getActiveSpecialCategories(job);

  return (
    <Card className="group relative hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-400 hover:-translate-y-1 overflow-hidden border-slate-200/80 hover:border-blue-300/50 bg-white rounded-xl">
      {/* Gradient left accent — blue to teal */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-teal-400 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity" />

      <Link href={`/jobs/${job.id}`} className="absolute inset-0 z-0" aria-label={title} />

      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-600 group-hover:from-blue-50 group-hover:to-indigo-50 transition-all duration-300 flex-shrink-0 group-hover:scale-105 shadow-sm">
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="font-bold text-[15px] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-tight mb-1">
                  {title}
                </h3>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-sm line-clamp-1">{job.company_name}</span>
                </div>
              </div>
            </div>
            {/* Salary badge — green accent */}
            <div className="hidden md:block text-right flex-shrink-0">
              <div className="text-sm font-bold text-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-3 py-1.5 rounded-lg border border-emerald-200/60 shadow-sm">
                {formatSalary(job.salary_min, job.salary_max, lang)}
              </div>
            </div>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-slate-500 line-clamp-2 mb-3 leading-relaxed">
              {description}
            </p>
          )}

          {/* Metadata Pills — differentiated subtle colors */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs font-medium">
            {locationLabel && (
              <div className="flex items-center gap-1 bg-teal-50/60 text-teal-700 px-2 py-1 rounded-md border border-teal-200/50">
                <MapPin className="w-3 h-3 flex-shrink-0 text-teal-500" />
                <span>{locationLabel}</span>
              </div>
            )}
            {categoryName && (
              <div className="bg-blue-50/60 text-blue-700 px-2 py-1 rounded-md border border-blue-200/50">
                {categoryName}
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200/60">
              <Clock className="w-3 h-3 text-slate-400" />
              {employmentLabel}
            </div>
            {job.work_mode && job.work_mode !== 'onsite' && (
              <div className="flex items-center gap-1.5 bg-indigo-50/60 text-indigo-700 px-2 py-1 rounded-md border border-indigo-200/50">
                {/* Animated pulse dot for remote */}
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                </span>
                {job.work_mode === 'remote' && (lang === 'uz' ? 'Masofaviy' : 'Удалённо')}
                {job.work_mode === 'hybrid' && (lang === 'uz' ? 'Aralash' : 'Гибрид')}
              </div>
            )}
            {job.payment_type && job.payment_type !== 1 && (
              <div className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200/60">
                <Wallet className="w-3 h-3 text-slate-400" />
                <span>
                  {getMappedValue('payment_type', typeof job.payment_type === 'number' ? job.payment_type : undefined, lang) ||
                    (typeof job.payment_type === 'string' ? job.payment_type :
                      (job.payment_type === 2 ? (lang === 'uz' ? 'Ishbay' : 'Сдельная') :
                        job.payment_type === 3 ? (lang === 'uz' ? 'Stavka' : 'Оклад') : ''))}
                </span>
              </div>
            )}
          </div>

          {/* Mobile salary */}
          <div className="md:hidden mb-3">
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
              {formatSalary(job.salary_min, job.salary_max, lang)}
            </span>
          </div>

          {/* Special Categories */}
          {specialCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4 relative z-10">
              {specialCategories.map((cat: any) => (
                <Link key={cat.key} href={`/jobs?category=${cat.slug}`} onClick={(e) => e.stopPropagation()}>
                  <Badge className="text-xs bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/50 hover:from-blue-100 hover:to-indigo-100 transition-all py-0.5 px-2.5 font-semibold">
                    {lang === 'ru' ? cat.badge_ru : cat.badge_uz}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/80">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {formatDate(job.created_at, lang)}
              </div>
              {job.views_count > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {job.views_count}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-blue-600 text-xs font-bold group-hover:gap-2 transition-all duration-300">
              {t.job.details}
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
