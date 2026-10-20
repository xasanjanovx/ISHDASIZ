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
import styles from './job-card.module.css';

const iconMap: any = {
  Monitor, GraduationCap, Heart, Building2, Wheat, Factory,
  ShoppingBag, Truck, Wallet, Plane, Wrench, Landmark, Briefcase,
};

interface JobCardProps {
  job: any;
  compact?: boolean;
}

export function JobCard({ job, compact = false }: JobCardProps) {
  const { lang, t } = useLanguage();

  const title = (lang === 'uz' ? job.title_uz || job.title_ru : job.title_ru || job.title_uz)
    || (lang === 'ru' ? 'Вакансия' : 'Vakansiya');

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

  let regionName = (lang === 'ru' ? job.regions?.name_ru || job.districts?.regions?.name_ru : job.regions?.name_uz || job.districts?.regions?.name_uz) || job.region_name;
  let districtName = (lang === 'ru' ? job.districts?.name_ru : job.districts?.name_uz) || job.district_name;

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
    <Card className={`catalog-job-card group relative h-full overflow-hidden ${styles.card}`}>
      {/* Gradient left accent — blue to teal */}

      <Link href={`/jobs/${job.id}`} className="absolute inset-0 z-0" aria-label={title} />

      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex min-w-0 items-start gap-3 flex-1">
              <div className="catalog-company-icon w-11 h-11 rounded-xl bg-gradient-to-br from-background to-secondary flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:from-accent group-hover:to-accent transition-all duration-300 shrink-0 group-hover:scale-105 shadow-sm">
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug mb-1">
                  {title}
                </h3>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-sm line-clamp-1">{job.company_name}</span>
                </div>
              </div>
            </div>
            {/* Salary badge — green accent */}
            <div className={compact ? 'hidden' : 'hidden md:block text-right shrink-0'}>
              <div className="catalog-salary text-sm font-bold text-primary bg-accent px-3 py-1.5 rounded-lg border border-emerald-200/60 shadow-sm">
                {formatSalary(job.salary_min, job.salary_max, lang)}
              </div>
            </div>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {description}
            </p>
          )}

          {/* Metadata Pills — differentiated subtle colors */}
          <div className="catalog-meta flex flex-wrap items-center gap-1.5 mb-3 text-xs font-medium">
            {locationLabel && (
              <div className="flex items-center gap-1 bg-accent/60 text-primary px-2 py-1 rounded-md border border-border/50">
                <MapPin className="w-3 h-3 shrink-0 text-primary" />
                <span>{locationLabel}</span>
              </div>
            )}
            {categoryName && (
              <div className="bg-accent/60 text-primary px-2 py-1 rounded-md border border-border/50">
                {categoryName}
              </div>
            )}
            <div className="flex items-center gap-1 bg-background text-muted-foreground px-2 py-1 rounded-md border border-border/60">
              <Clock className="w-3 h-3 text-muted-foreground" />
              {employmentLabel}
            </div>
            {job.work_mode && job.work_mode !== 'onsite' && (
              <div className="flex items-center gap-1.5 bg-accent/60 text-primary px-2 py-1 rounded-md border border-border/50">
                {/* Animated pulse dot for remote */}
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
                {job.work_mode === 'remote' && (lang === 'uz' ? 'Masofaviy' : 'Удалённо')}
                {job.work_mode === 'hybrid' && (lang === 'uz' ? 'Aralash' : 'Гибрид')}
              </div>
            )}
            {job.payment_type && job.payment_type !== 1 && (
              <div className="flex items-center gap-1 bg-background text-muted-foreground px-2 py-1 rounded-md border border-border/60">
                <Wallet className="w-3 h-3 text-muted-foreground" />
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
          <div className={compact ? 'mb-3' : 'md:hidden mb-3'}>
            <span className="catalog-salary text-sm font-bold text-primary bg-accent px-2.5 py-1 rounded-md border border-emerald-200/60">
              {formatSalary(job.salary_min, job.salary_max, lang)}
            </span>
          </div>

          {/* Special Categories */}
          {specialCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4 relative z-10">
              {specialCategories.map((cat: any) => (
                <Link key={cat.key} href={`/jobs?special=${cat.slug}`} onClick={(e) => e.stopPropagation()}>
                  <Badge className="text-xs bg-gradient-to-r from-accent to-accent text-primary border border-border/50 hover:from-accent hover:to-accent transition-all py-0.5 px-2.5 font-semibold">
                    {lang === 'ru' ? cat.badge_ru : cat.badge_uz}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/80">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
            <div className="flex items-center gap-1 text-primary text-xs font-bold group-hover:gap-2 transition-all duration-300">
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
