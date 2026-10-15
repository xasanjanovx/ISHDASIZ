'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';



import { accountApi, AccountApiError } from '@/lib/account-api';
import { JobAccountActions } from '@/components/jobs/job-account-actions';
import { PublicJobView } from '@/components/jobs/public-job-view';
import { JobWithRelations } from '@/types/database';
import { formatSalary, formatDate } from '@/lib/constants';
import { Language } from '@/lib/translations';
import { getActiveSpecialCategories } from '@/lib/special-categories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';





import { JobMap } from '@/components/map/job-map';
import {
  ArrowLeft,
  MapPin,
  Building2,
  Clock,
  Eye,
  Phone,
  Mail,
  Banknote,
  CheckCircle,
  Loader2,
  FileText,
  User,
  GraduationCap,
  Briefcase,
  Calendar,
  ChevronRight,
} from '@/components/ui/icons';



interface SimilarJob {
  id: string;
  title_uz: string;
  title_ru: string;
  company_name: string;
  salary_min: number | null;
  salary_max: number | null;
}

import { getMappedValue, getExperienceLabel, getGenderLabel, getEducationLabel, getPaymentTypeLabel, getWorkModeLabel, getWorkingDaysLabel } from '@/lib/mappings';

export default function JobDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <JobDetail key={id} id={id}/>;
}
function JobDetail({id}: {id:string}) {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [job, setJob] = useState<JobWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [similarJobs, setSimilarJobs] = useState<SimilarJob[]>([]);
  const [similarError, setSimilarError] = useState(false);
  useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    accountApi<{job:JobWithRelations;similar:SimilarJob[];similarError:boolean}>(`/api/jobs/${id}`, {signal:controller.signal}).then(result => {
      if(cancelled) return;
      if(!result.job || result.job.id!==id || !Array.isArray(result.similar)) throw new AccountApiError(503);
      setJob(result.job); setSimilarJobs(result.similar); setSimilarError(result.similarError); setFailure(null);
    }).catch(error => {if(!cancelled) setFailure(error);}).finally(()=>{if(!cancelled) setLoading(false);});
    return ()=>{cancelled=true;controller.abort();};
  }, [id,revision]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            {failure instanceof AccountApiError && failure.status === 404 ? (lang === 'uz' ? 'Vakansiya mavjud emas' : 'Вакансия недоступна') : (lang === 'uz' ? 'Vakansiyani yuklab bo‘lmadi' : 'Не удалось загрузить вакансию')}
          </p>
          {!(failure instanceof AccountApiError && failure.status === 404) && <Button className="mb-3" onClick={()=>{setLoading(true);setRevision(value=>value+1);}}>{lang==='ru'?'Повторить загрузку':'Qayta yuklash'}</Button>}
          <Button onClick={() => router.push('/jobs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.nav.jobs}
          </Button>
        </div>
      </div>
    );
  }

  const title = (lang === 'uz' ? job.title_uz || job.title_ru : job.title_ru || job.title_uz) || job.company_name;

  // Helper: РѕС‡РёСЃС‚РєР° С‚РµРєСЃС‚Р° РѕС‚ РјСѓСЃРѕСЂР° Рё РїСѓСЃС‚С‹С… Р·Р°РіР»СѓС€РµРє
  const cleanText = (text: string | null | undefined): string | null => {
    if (!text) return null;
    let cleaned = text
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove placeholder lines like "Vazifalar: - -"
    // Use regex that matches "Label: [whitespace/dashes/empty]"
    const placeholders = [
      /Vazifalar\s*:\s*[-вЂ“вЂ”\s]*$/m,
      /Talablar\s*:\s*[-вЂ“вЂ”\s]*$/m,
      /Imkoniyatlar\s*:\s*[-вЂ“вЂ”\s]*$/m,
      /РћР±СЏР·Р°РЅРЅРѕСЃС‚Рё\s*:\s*[-вЂ“вЂ”\s]*$/m,
      /РўСЂРµР±РѕРІР°РЅРёСЏ\s*:\s*[-вЂ“вЂ”\s]*$/m,
      /РЈСЃР»РѕРІРёСЏ\s*:\s*[-вЂ“вЂ”\s]*$/m,
    ];

    // If the whole text is just a concatenation of headings and dashes, return null
    // We check if "stripping" known headings results in just punctuation/space
    let contentCheck = cleaned
      .replace(/Vazifalar/gi, '')
      .replace(/Talablar/gi, '')
      .replace(/Imkoniyatlar/gi, '')
      .replace(/РћР±СЏР·Р°РЅРЅРѕСЃС‚Рё/gi, '')
      .replace(/РўСЂРµР±РѕРІР°РЅРёСЏ/gi, '')
      .replace(/РЈСЃР»РѕРІРёСЏ/gi, '')
      .replace(/[:\-вЂ“вЂ”\s\.]/g, ''); // Remove punctuation and spaces . included

    if (contentCheck.length < 5) return null; // If almost nothing left, it's empty

    // Remove specific "Vazifalar: - -" lines from the final output too
    // Remove specific "Vazifalar: - -" lines from the final output too
    cleaned = cleaned
      .replace(/Vazifalar\s*:\s*[-вЂ“вЂ”\s]*$/gm, '')
      .replace(/Talablar\s*:\s*[-вЂ“вЂ”\s]*$/gm, '')
      // .replace(/Imkoniyatlar\s*:\s*[-вЂ“вЂ”\s]*$/gm, '') // Don't strip Imkoniyatlar completely, might be useful
      // .replace(/РћР±СЏР·Р°РЅРЅРѕСЃС‚Рё\s*:\s*[-вЂ“вЂ”\s]*$/gm, '') 
      // .replace(/РўСЂРµР±РѕРІР°РЅРёСЏ\s*:\s*[-вЂ“вЂ”\s]*$/gm, '')
      .replace(/РЈСЃР»РѕРІРёСЏ\s*:\s*[-вЂ“вЂ”\s]*$/gm, '')
      .trim();

    return cleaned;
  };

  // Description: use description field, fallback to raw_source_json.info for imported
  const rawInfo = (job as any).raw_source_json?.info;
  const rawDescription = lang === 'uz' ? job.description_uz : job.description_ru;
  const description = cleanText(rawDescription)
    || cleanText(rawInfo)
    || cleanText(lang === 'uz' ? job.requirements_uz : job.requirements_ru);

  // Requirements: use requirements field, or fallback to description for imported
  const reqField = lang === 'uz' ? job.requirements_uz : job.requirements_ru;
  const requirements = cleanText(reqField);
  // Note: if requirements field is empty, we don't necessarily fallback to description anymore 
  // because description might contain it, or we render raw HTML info.

  const categoryName = job.categories
    ? lang === 'uz'
      ? job.categories.name_uz
      : job.categories.name_ru
    : '';

  // Correctly access nested location data
  const district = job.districts;
  // @ts-ignore
  const region = district?.regions || (job as any).regions;

  // TASHKENT DISTRICTS LIST for fallback detection
  const TASHKENT_DISTRICTS = [
    'bektemir', 'chilonzor', 'yashnobod', 'mirobod', 'mirzo ulug\'bek', 'sergeli',
    'shayxontohur', 'olmazor', 'uchtepa', 'yakkasaroy', 'yunusobod', 'yangihayot'
  ];

  // Use join data for local jobs, fallback to text fields for imported
  let regionName = region
    ? (lang === 'uz' ? region.name_uz : region.name_ru)
    : ((job as any).region_name || '');

  const districtName = district
    ? (lang === 'uz' ? district.name_uz : district.name_ru)
    : ((job as any).district_name || '');

  // Fix: If district is in Tashkent but region is missing or same as district, set region to Tashkent
  if (districtName) {
    const normDist = districtName.toLowerCase().replace(/ tumani| district| rayon/gi, '').trim();
    const normReg = regionName ? regionName.toLowerCase() : '';

    if (TASHKENT_DISTRICTS.includes(normDist)) {
      if (!regionName || normReg === normDist || !normReg.includes('toshkent')) {
        regionName = lang === 'uz' ? 'Toshkent shahri' : "г. Ташкент";
      }
    }
  }

  // Deduplicate if region == district
  if (regionName && districtName && regionName.toLowerCase() === districtName.toLowerCase()) {
    regionName = '';
  }

  const regionLabel = regionName || '';
  const locationLabel = [regionLabel, districtName].filter(Boolean).join(', ');
  const fullAddress = (job as any).address || '';
  const benefits: string | null = typeof job.benefits === 'string' ? job.benefits : null;

  // Unified sections from imports/AI
  const unifiedSections = (job as any).sections || (job as any).raw_source_json?.sections || {};
  const qulayliklarList: string[] = Array.isArray(unifiedSections.qulayliklar) ? unifiedSections.qulayliklar : [];

  // Also get structured lists for requirements and duties if available
  const talablarList: string[] = Array.isArray(unifiedSections.talablar) ? unifiedSections.talablar : [];
  const dutiesList: string[] = Array.isArray(unifiedSections.ish_vazifalari) ? unifiedSections.ish_vazifalari : [];
  const normalizeList = (items: any[]): string[] => {
    return Array.from(
      new Set(
        (items || [])
          .map((item) => String(item || '').trim().replace(/\s+/g, ' '))
          .filter(Boolean)
      )
    );
  };
  const combinedDuties = normalizeList([...dutiesList, ...talablarList]);
  const requirementsIsDuplicate =
    Boolean(requirements)
    && Boolean(description)
    && String(requirements).trim() === String(description).trim();
  const benefitsList = (() => {
    const fromSections = normalizeList(qulayliklarList);
    if (fromSections.length > 0) return fromSections;
    if (!benefits) return [] as string[];
    try {
      const parsed = JSON.parse(benefits);
      if (Array.isArray(parsed)) return normalizeList(parsed);
      if (parsed && typeof parsed === 'object') {
        const langItems = Array.isArray(parsed[lang]) ? parsed[lang] : (Array.isArray(parsed.uz) ? parsed.uz : []);
        return normalizeList(langItems);
      }
    } catch {
      // fallback to plain text parsing
    }
    return normalizeList(
      benefits
        .split(/\r?\n|,/g)
        .map(item => item.trim())
        .filter(Boolean)
    );
  })();
  const workingDaysLabel = getWorkingDaysLabel(job, lang);
  const workingHoursValue = (job as any).working_hours || (job as any).raw_source_json?.working_hours || null;
  const formatTime = (value: string) => value.replace(/(\d{2}:\d{2})(:\d{2})/g, '$1');
  const workingHoursLabel = typeof workingHoursValue === 'string' ? formatTime(workingHoursValue) : null;
  const scheduleLabel = (() => {
    if (workingDaysLabel && workingHoursLabel) return `${workingDaysLabel} (${workingHoursLabel})`;
    if (workingDaysLabel) return workingDaysLabel;
    if (workingHoursLabel) return workingHoursLabel;
    if ((job as any).working_schedule) return String((job as any).working_schedule);
    if ((job as any).raw_source_json?.working_days_id || (job as any).raw_source_json?.working_time_from) {
      const mappedDays = getMappedValue('working_days', (job as any).raw_source_json?.working_days_id, lang);
      if ((job as any).raw_source_json?.working_time_from && (job as any).raw_source_json?.working_time_to) {
        return `${mappedDays} (${String((job as any).raw_source_json.working_time_from).slice(0, 5)} - ${String((job as any).raw_source_json.working_time_to).slice(0, 5)})`;
      }
      return mappedDays;
    }
    return (lang === 'ru' ? "Не указано" : 'Belgilanmagan');
  })();



  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden py-5 md:py-6 text-foreground border-b border-border">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-card to-accent" style={{ backgroundSize: '200% 200%' }} />
        {/* Floating orbs */}
        <div className="absolute top-0 right-[15%] w-[250px] h-[250px] bg-primary/15 rounded-full blur-[80px] animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-primary/10 rounded-full blur-[60px] animate-float-medium pointer-events-none" />

        <div className="container relative mx-auto px-4 z-10">
          <Button
            variant="ghost"
            onClick={() => router.push('/jobs')}
            className="text-muted-foreground hover:text-primary hover:bg-accent mb-4 -ml-2"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t.nav.jobs}
          </Button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="flex flex-wrap gap-2 mb-2">
                {categoryName && (
                  <Badge className="bg-card text-primary hover:bg-accent border-border backdrop-blur-sm px-3 py-1 font-medium">
                    {categoryName}
                  </Badge>
                )}
                {job.employment_type && (
                  <Badge className="bg-accent text-primary border-border backdrop-blur-sm px-3 py-1 font-medium capitalize">
                    {(job.employment_type as string) === 'full_time' ? (lang === 'uz' ? 'To\'liq stavka' : "Полная занятость") :
                      (job.employment_type as string) === 'part_time' ? (lang === 'uz' ? 'Yarim stavka' : "Частичная занятость") :
                        (job.employment_type as string) === 'contract' ? (lang === 'uz' ? 'Shartnoma' : "Контракт") :
                          (job.employment_type as string) === 'freelance' ? 'Freelance' : job.employment_type}
                  </Badge>
                )}
                {((job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count) && (
                  <Badge className="bg-accent text-primary border-border backdrop-blur-sm px-3 py-1 font-medium">
                    {(job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count} {lang === 'ru' ? "мест" : "o'rin"}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs md:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center backdrop-blur-md">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-foreground text-sm">{job.company_name || 'ISHDASIZ'}</span>
                </div>
                {locationLabel && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span>{locationLabel}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  <span>{job.views_count} {lang === 'uz' ? 'marta ko\'rildi' : "просмотров"}</span>
                </div>
              </div>
            </div>

            <JobAccountActions job={{id:job.id,title,company_name:job.company_name,is_imported:job.is_imported}}/>
            <PublicJobView id={job.id}/>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-8">
            {/* Job Details Table (Osonish Style) */}
            <Card className="border-border shadow-sm overflow-hidden text-sm">
              <CardHeader className="bg-background/50 pb-4 border-b border-border">
                <CardTitle className="text-lg text-foreground">{lang === 'ru' ? "Детали вакансии" : "Vakansiya ma'lumotlari"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {/* Company */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Компания" : 'Tashkilot'}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0">{job.company_name}</span>
                  </div>

                  {/* Position */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Должность" : 'Lavozim'}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0">{(job as any).raw_source_json?.position_name || title}</span>
                  </div>

                  {/* Vacancy Count */}
                  {((job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                      <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Количество мест" : 'Vakansiyalar soni'}:</span>
                      <span className="font-semibold text-foreground mt-1 sm:mt-0">
                        {(job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count}
                      </span>
                    </div>
                  )}

                  {/* Experience */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Опыт работы" : 'Ish tajribasi'}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0">{getExperienceLabel(job, lang)}</span>
                  </div>

                  {/* Payment Type */}
                  {(getPaymentTypeLabel(job, lang)) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                      <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Форма оплаты" : "To'lov shakli"}:</span>
                      <span className="font-semibold text-foreground mt-1 sm:mt-0">
                        {getPaymentTypeLabel(job, lang)}
                      </span>
                    </div>
                  )}

                  {/* Employment Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Тип занятости" : 'Bandlik turi'}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0 capitalize">
                      {(() => {
                        const type = job.employment_type as string;
                        if (type === 'full_time') return lang === 'uz' ? 'To\'liq stavka (shtat asosida)' : "Полная занятость";
                        if (type === 'part_time') return lang === 'uz' ? 'Yarim stavka' : "Частичная занятость";
                        if (type === 'contract') return lang === 'uz' ? 'Shartnoma asosida' : "По контракту";
                        if (type === 'freelance') return 'Freelance';
                        return type;
                      })()}
                    </span>
                  </div>

                  {/* Work Mode */}
                  {(getWorkModeLabel(job, lang)) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                      <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Режим работы" : 'Ish usuli (rejimi)'}:</span>
                      <span className="font-semibold text-foreground mt-1 sm:mt-0">
                        {getWorkModeLabel(job, lang)}
                      </span>
                    </div>
                  )}

                  {/* Working Days - REMOVED (duplicate with Ish kunlari va vaqti below) */}

                  {/* Schedule (Ish kunlari va vaqti) - Always show */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? 'График работы' : 'Ish kunlari va vaqti'}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0">{scheduleLabel}</span>
                  </div>

                  {/* Probation Period (Sinov muddati) */}
                  {((job as any).raw_source_json?.test_period_id || (job as any).raw_source_json?.test_period) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                      <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Испытательный срок" : "Sinov muddati"}:</span>
                      <span className="font-semibold text-foreground mt-1 sm:mt-0">
                        {getMappedValue('test_period', (job as any).raw_source_json?.test_period_id, lang) || (job as any).raw_source_json?.test_period}
                      </span>
                    </div>
                  )}

                  {/* Education */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Образование" : "Ma'lumot darajasi"}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0">{getEducationLabel(job, lang)}</span>
                  </div>

                  {/* Mutaxassisligi - REMOVED per user request */}

                  {/* Languages - handled in Languages section below */}

                  {/* Gender - Always show with correct label */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                    <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Пол" : 'Jinsi'}:</span>
                    <span className="font-semibold text-foreground mt-1 sm:mt-0">{getGenderLabel((job as any).gender, lang)}</span>
                  </div>

                  {/* Age - Only show if age is specified */}
                  {(job.age_min || job.age_max) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors">
                      <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? "Возраст" : 'Yoshi'}:</span>
                      <span className="font-semibold text-foreground mt-1 sm:mt-0">
                        {job.age_min && job.age_max ? `${job.age_min}-${job.age_max} ${lang === 'ru' ? "лет" : 'yosh'}` :
                          job.age_min ? `${job.age_min}+ ${lang === 'ru' ? "лет" : 'yosh'}` :
                            `${lang === 'ru' ? "до" : ''} ${job.age_max} ${lang === 'ru' ? "лет" : 'yosh'}`}
                      </span>
                    </div>
                  )}

                  {/* Social Packages - REMOVED (duplicate with Qulayliklar below) */}

                  {/* Alohida toifalar (mos kelishi mumkin bo'lgan nomzodlar) */}
                  {((job as any).is_for_students || (job as any).is_for_graduates || (job as any).is_for_disabled) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-background/50 transition-colors border-t border-border">
                      <span className="text-muted-foreground min-w-[200px] font-medium">{lang === 'ru' ? 'Для кого может подойти' : "Kimlar uchun mos kelishi mumkin"}:</span>
                      <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                        {(job as any).is_for_students && (
                          <Badge className="bg-accent text-primary border-border">{lang === 'ru' ? 'Могут подойти студенты' : 'Talabalar ham mos kelishi mumkin'}</Badge>
                        )}
                        {(job as any).is_for_graduates && (
                          <Badge className="bg-accent text-primary border-border">{lang === 'ru' ? 'Могут подойти выпускники' : 'Bitiruvchilar ham mos kelishi mumkin'}</Badge>
                        )}
                        {(job as any).is_for_disabled && (
                          <Badge className="bg-accent text-primary border-border">{lang === 'ru' ? 'Могут подойти люди с инвалидностью' : "Nogironligi bo'lgan shaxslar ham mos kelishi mumkin"}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>


            {/* === SEPARATE SECTIONS: Talablar, Ish vazifalari, Ish sharoitlari === */}

            {/* TALABLAR (Requirements) */}
            {/* VAZIFALAR VA TALABLAR (Unified Section) */}
            {(combinedDuties.length > 0 || description || requirements || (job as any).raw_source_json?.html_responsibilities || (job as any).raw_source_json?.html_requirements) && (
              <Card className="border-border shadow-lg overflow-hidden bg-gradient-to-br from-card to-accent/30">
                <CardContent className="p-5 md:p-6">
                  <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    {lang === 'ru' ? "Обязанности и Требования" : 'Vazifalar va talablar'}
                  </h2>

                  {combinedDuties.length > 0 ? (
                    <ul className="space-y-2 list-none">
                      {combinedDuties.map((item, idx) => (
                        <li key={idx} className="flex gap-3 text-foreground">
                          <span className="text-primary font-bold text-lg leading-6">•</span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-6">
                      {/* Description Fallback */}
                      <div className="bg-card p-4 md:p-5 rounded-2xl border border-border text-foreground text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                        {((job as any).raw_source_json?.html_responsibilities || description || '').replace(/\\n/g, '\n')}
                      </div>

                      {/* Requirements Fallback (if separate from description) */}
                      {!requirementsIsDuplicate && (requirements || (job as any).raw_source_json?.html_requirements) && (
                        <div className="bg-card p-4 md:p-5 rounded-2xl border border-border text-foreground text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                          <h3 className="font-semibold mb-2">{lang === 'ru' ? "Требования:" : 'Talablar:'}</h3>
                          {((requirements || (job as any).raw_source_json?.html_requirements || '').replace(/\\n/g, '\n'))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ISH SHAROITLARI -> QULAYLIKLAR (Conditions/Benefits) */}
            {(benefitsList.length > 0 || (job as any).raw_source_json?.html_conditions) && (
              <Card className="border-border shadow-lg overflow-hidden bg-gradient-to-br from-card to-emerald-50/30">
                <CardContent className="p-5 md:p-6">
                  <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    {/* User requested "Qulayliklar" for imported jobs specifically, but generally good for both */}
                    {lang === 'ru' ? "Преимущества" : 'Qulayliklar'}
                  </h2>

                  {benefitsList.length > 0 && (
                    <ul className="space-y-2">
                      {benefitsList.map((item, idx) => (
                        <li key={`benefit-${idx}`} className="text-foreground leading-relaxed">
                          - {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {benefitsList.length === 0 && (job as any).raw_source_json?.html_conditions && (
                    <div className="bg-card p-4 md:p-5 rounded-2xl border border-emerald-100 text-foreground text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                      {String((job as any).raw_source_json?.html_conditions || '').replace(/\\n/g, '\n')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Skills & Languages section (Benefits removed - only show once in Qulayliklar above) */}
            {(((job as any).raw_source_json?.skills_details?.length > 0) ||
              ((job as any).raw_source_json?.languages?.length > 0)) && (
                <Card className="border-border shadow-sm overflow-hidden mb-6">
                  <CardContent className="p-5 md:p-6 space-y-6">
                    {/* Skills (use skills_details from API) */}
                    {(job as any).raw_source_json?.skills_details?.length > 0 && (
                      <section>
                        <h3 className="font-semibold text-foreground mb-3">{lang === 'ru' ? "Профессиональные навыки" : "Kasbiy bilim va ko'nikmalar"}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(job as any).raw_source_json.skills_details.map((skill: any, idx: number) => {
                            const skillName = skill.skill_name || skill.name || (typeof skill === 'string' ? skill : null);
                            if (!skillName || typeof skillName === 'number') return null;
                            return (
                              <Badge key={idx} variant="secondary" className="bg-secondary text-foreground hover:bg-secondary px-3 py-1.5">
                                {skillName}
                              </Badge>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Languages (API uses "language" key, not "id") */}
                    {(job as any).raw_source_json?.languages?.length > 0 && (
                      <section>
                        <h3 className="font-semibold text-foreground mb-3">{lang === 'ru' ? "Знание языков" : "Tillarni bilishi"}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(job as any).raw_source_json.languages.map((langItem: any, idx: number) => {
                            // OsonIsh API uses "language" key (not "id")
                            const langId = langItem.language || langItem.id || (typeof langItem === 'number' ? langItem : null);
                            const levelId = langItem.level;

                            const langName = langItem.name || getMappedValue('languages', langId, lang);
                            const levelName = getMappedValue('language_levels', levelId, lang);

                            // Fallback to name if available
                            const displayName = langName || langItem.name;

                            if (!displayName || typeof displayName === 'number') return null;

                            return (
                              <Badge key={idx} variant="outline" className="px-3 py-1.5 border-border text-foreground">
                                <span className="font-bold mr-1">{displayName}</span>
                                {levelName && <span className="text-muted-foreground">- {levelName}</span>}
                              </Badge>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </CardContent>
                </Card>
              )}


          </div>

          {/* SIDEBAR */}
          <div className="space-y-6">
            {/* Salary Widget */}
            <Card className="border border-border shadow-xl shadow-primary/30 bg-card overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                <Banknote className="w-24 h-24 rotate-12 text-primary" />
              </div>
              <CardContent className="p-6 relative">
                <h3 className="text-2xl font-extrabold mb-1 text-foreground">
                  {formatSalary(job.salary_min, job.salary_max, lang)}
                </h3>
                <p className="text-muted-foreground text-sm mb-6">{t.job.perMonth}</p>

                {/* Removed Apply button and footer as requested by user ("tut ne nado Ariza qoldirish") */}
              </CardContent>
            </Card>

            {/* Contact Card */}
            {(job.contact_phone || job.contact_telegram || (job as any).phone || (job as any).email || (job as any).contact_email || (job as any).hr_name || (job as any).raw_source_json?.hr_name) && (
              <Card className="border-border shadow-sm overflow-hidden">
                <div className="bg-background px-6 py-4 border-b border-border">
                  <h3 className="font-bold text-foreground">{lang === 'ru' ? "Контактная информация" : 'Bog\'lanish uchun'}</h3>
                </div>
                <CardContent className="p-6 space-y-5">
                  {/* Only show HR name if it was explicitly provided by source API */}
                  {(job as any).raw_source_json?.hr?.fio && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{lang === 'ru' ? "Контактное лицо" : "Vakansiya HR menejeri"}</p>
                          <p className="font-bold text-foreground text-sm">{(job as any).raw_source_json.hr.fio}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(job.contact_phone || job.phone) && (
                    // Hide if phone is just short prefix like "+998"
                    (job.contact_phone || job.phone || '').length > 6 && (
                      <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">{lang === 'ru' ? "Телефон" : 'Telefon'}</p>
                            <p className="font-bold text-foreground">{job.contact_phone || job.phone}</p>
                          </div>
                        </div>
                        <a
                          href={`tel:${job.contact_phone || job.phone}`}
                          className="p-2.5 bg-secondary text-muted-foreground rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          <Phone className="w-5 h-5" />
                        </a>
                      </div>
                    )
                  )}

                  {job.contact_telegram && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-.94-2.4-1.55-1.07-.7-.37-1.09.24-1.72.14-.15 2.54-2.32 2.59-2.52.01-.03.01-.15-.06-.21-.07-.06-.18-.04-.26-.02-.11.02-1.91 1.2-5.4 3.56-.51.35-.96.52-1.37.51-.45-.01-1.32-.26-1.96-.46-.79-.25-1.42-.38-1.36-.8.03-.21.32-.42.88-.63 3.44-1.5 5.75-2.49 6.92-2.97 3.29-1.35 3.98-1.58 4.43-1.58.1 0 .32.02.46.12.12.08.15.2.16.28 0 .09.01.27 0 .44z"></path></svg>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Telegram</p>
                          <p className="font-bold text-foreground">@{job.contact_telegram.replace('@', '')}</p>
                        </div>
                      </div>
                      <a
                        href={`https://t.me/${job.contact_telegram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-secondary text-muted-foreground rounded-xl hover:bg-primary hover:text-white transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </a>
                    </div>
                  )}

                  {((job as any).contact_email || (job as any).email) && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Email</p>
                          <p className="font-bold text-foreground truncate max-w-[150px]">{(job as any).contact_email || (job as any).email}</p>
                        </div>
                      </div>
                      <a
                        href={`mailto:${(job as any).contact_email || (job as any).email}`}
                        className="p-2.5 bg-secondary text-muted-foreground rounded-xl hover:bg-primary hover:text-white transition-all"
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Map (Moved to Sidebar) */}
            {(job.latitude && job.longitude) && (
              <Card className="border-border shadow-sm overflow-hidden">
                <div className="bg-background px-6 py-4 border-b border-border">
                  <h3 className="font-bold text-foreground">{lang === 'ru' ? "Местоположение" : 'Manzil'}</h3>
                </div>
                <div className="h-[250px] relative">
                  <JobMap jobs={[job]} selectedJobId={job.id} height="100%" />
                </div>
                <div className="p-4 bg-card border-t space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{lang === 'ru' ? "Адрес" : 'Aniq manzil'}</p>
                      <p className="text-muted-foreground text-sm">{(job as any).address || (job as any).raw_source_json?.address || locationLabel}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Similar Jobs Widget */}
            {similarError && <p role="status" className="text-sm text-muted-foreground">{lang==='ru'?'Похожие вакансии временно недоступны.':'O‘xshash vakansiyalar vaqtincha mavjud emas.'}</p>}
            {similarJobs.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-bold text-foreground px-1">{lang === 'ru' ? "Похожие вакансии" : 'O\'xshash e\'lonlar'}</h3>
                <div className="space-y-3">
                  {similarJobs.map((sj) => (
                    <Link
                      key={sj.id}
                      href={`/jobs/${sj.id}`}
                      className="group block p-4 bg-card rounded-2xl border border-border hover:border-border hover:shadow-md transition-all"
                    >
                      <h4 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {lang === 'ru' ? sj.title_ru : sj.title_uz}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">{sj.company_name}</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {formatSalary(sj.salary_min, sj.salary_max, lang)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}
