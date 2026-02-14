'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { JobWithRelations } from '@/types/database';
import { formatSalary, formatDate } from '@/lib/constants';
import { Language } from '@/lib/translations';
import { getActiveSpecialCategories } from '@/lib/special-categories';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Star,
  FileText,
  User,
  GraduationCap,
  Briefcase,
  Calendar,
  ChevronRight,
} from '@/components/ui/icons';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Resume {
  id: string;
  title: string;
}

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
  const { id } = useParams();
  const router = useRouter();
  const { lang, t } = useLanguage();
  const { user, logout } = useUserAuth();

  const [job, setJob] = useState<JobWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [similarJobs, setSimilarJobs] = useState<SimilarJob[]>([]);
  const [applicationData, setApplicationData] = useState({
    full_name: '',
    phone: '',
    email: '',
    message: '',
    resume_id: '',
  });
  const [sendWithoutResume, setSendWithoutResume] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!id) return;

    const { data } = await supabase
      .from('jobs')
      .select('*, categories(*), districts(*, regions(*)), employer_profiles(user_id)')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      setJob(data as JobWithRelations);
      await supabase.rpc('increment_job_views', { job_uuid: id });

      // Fetch similar jobs (same category or similar salary)
      if (data.category_id) {
        const { data: similar } = await supabase
          .from('jobs')
          .select('id, title_uz, title_ru, company_name, salary_min, salary_max')
          .eq('category_id', data.category_id)
          .neq('id', id)
          .eq('status', 'active')
          .limit(4);
        setSimilarJobs(similar || []);
      }
    }
    setLoading(false);
  }, [id]);

  // Check if favorite and load user's resumes
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id || !id) return;

      // Check favorite
      const { data: fav } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('job_id', id)
        .maybeSingle();

      setIsFavorite(!!fav);

      // Load resumes
      const { data: userResumes } = await supabase
        .from('resumes')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('status', 'active');

      setResumes(userResumes || []);

      // Pre-fill from profile
      const { data: profile } = await supabase
        .from('job_seeker_profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setApplicationData(prev => ({
          ...prev,
          full_name: profile.full_name || '',
          email: profile.email || '',
          phone: user.phone || '',
        }));
      } else {
        setApplicationData(prev => ({
          ...prev,
          full_name: user.full_name || '',
          phone: user.phone || '',
        }));
      }

      // Track view history
      await supabase
        .from('view_history')
        .upsert({
          user_id: user.id,
          job_id: id,
          viewed_at: new Date().toISOString(),
          onConflict: 'user_id,job_id',
        });

      // Check if already applied
      const { data: application } = await supabase
        .from('job_applications')
        .select('id')
        .eq('user_id', user.id)
        .eq('job_id', id)
        .maybeSingle();

      if (application) {
        setHasApplied(true);
      }
    };

    loadUserData();
  }, [user?.id, user?.phone, user?.full_name, id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const toggleFavorite = async () => {
    if (!user?.id || !id) {
      toast.error(lang === 'uz' ? 'Avval tizimga kiring' : 'РЎРЅР°С‡Р°Р»Р° РІРѕР№РґРёС‚Рµ РІ СЃРёСЃС‚РµРјСѓ');
      return;
    }

    setFavoriteLoading(true);

    try {
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('job_id', id);
        setIsFavorite(false);
        toast.success(lang === 'uz' ? 'Sevimlilardan o\'chirildi' : 'РЈРґР°Р»РµРЅРѕ РёР· РёР·Р±СЂР°РЅРЅРѕРіРѕ');
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, job_id: id });
        setIsFavorite(true);
        toast.success(lang === 'uz' ? 'Sevimlilarga qo\'shildi' : 'Р”РѕР±Р°РІР»РµРЅРѕ РІ РёР·Р±СЂР°РЅРЅРѕРµ');
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'uz' ? 'Xatolik' : 'РћС€РёР±РєР°');
    }

    setFavoriteLoading(false);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setApplying(true);

    const { error } = await supabase.from('job_applications').insert({
      job_id: job.id,
      user_id: user?.id || null,
      full_name: applicationData.full_name,
      phone: applicationData.phone,
      email: applicationData.email || null,
      message: applicationData.message || null,
      resume_id: sendWithoutResume ? null : (applicationData.resume_id || null),
      status: 'pending',
    });

    if (!error) {
      // Create conversation if it doesn't exist
      try {
        // Safe access to employer User ID
        // @ts-ignore
        const employerData = job.employer_profiles;
        const employerUserId = Array.isArray(employerData) ? employerData[0]?.user_id : employerData?.user_id;

        console.log('Chat Creation Debug:', { employerUserId, currentUserId: user?.id, jobId: job.id });

        if (employerUserId && user?.id) {
          // Prevent self-chat
          if (user.id === employerUserId) {
            console.log('Self-chat skipped');
            return;
          }

          // Check if conversation exists
          const { data: conv, error: fetchError } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${employerUserId}),and(user1_id.eq.${employerUserId},user2_id.eq.${user.id})`)
            .maybeSingle();

          if (fetchError) {
            console.error('Error checking conversation:', fetchError);
            return;
          }

          if (!conv) {
            console.log('Creating new conversation...');
            const { error: createError } = await supabase.from('conversations').insert({
              user1_id: user.id,
              user2_id: employerUserId,
              updated_at: new Date().toISOString()
            });

            if (createError) {
              console.error('Error creating conversation:', createError);
              if (createError.code === '42703') {
                toast.error(lang === 'uz' ? 'Chat tizimi hali tayyor emas (DB sync error)' : 'РЎРёСЃС‚РµРјР° С‡Р°С‚Р° РµС‰Рµ РЅРµ РіРѕС‚РѕРІР° (РѕС€РёР±РєР° Р‘Р”)');
              }
            }
          }
        }
      } catch (e) {
        console.error('Error creating conversation:', e);
      }
    }

    setApplying(false);

    if (error) {
      console.error('Application save error:', error);
      if (error.code === '23503') {
        toast.error(lang === 'uz' ? 'Sessiya xatosi. Iltimos, qayta kiring.' : 'РћС€РёР±РєР° СЃРµСЃСЃРёРё. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІРѕР№РґРёС‚Рµ СЃРЅРѕРІР°.');
        setTimeout(() => logout(), 2000); // Logout after 2 seconds
      } else if (error.code === '23505' || error.message?.includes('409') || error.code === '409') {
        setHasApplied(true);
        toast.error(lang === 'uz' ? 'Siz allaqachon ariza topshirgansiz' : 'Р’С‹ СѓР¶Рµ РїРѕРґР°Р»Рё Р·Р°СЏРІРєСѓ');
      } else {
        toast.error(lang === 'uz' ? 'Xatolik yuz berdi' : 'РџСЂРѕРёР·РѕС€Р»Р° РѕС€РёР±РєР°');
      }
      return;
    }

    toast.success(t.application.success);
    setHasApplied(true);
    setDialogOpen(false);
    setApplicationData({ ...applicationData, message: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">
            {lang === 'uz' ? 'Vakansiya topilmadi' : 'Р’Р°РєР°РЅСЃРёСЏ РЅРµ РЅР°Р№РґРµРЅР°'}
          </p>
          <Button onClick={() => router.push('/jobs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.nav.jobs}
          </Button>
        </div>
      </div>
    );
  }

  const title = lang === 'uz' ? job.title_uz : job.title_ru;

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
  const region = district?.regions;

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
        regionName = lang === 'uz' ? 'Toshkent shahri' : 'Рі. РўР°С€РєРµРЅС‚';
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
    return (lang === 'ru' ? 'РќРµ СѓРєР°Р·Р°РЅРѕ' : 'Belgilanmagan');
  })();



  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden py-5 md:py-6 text-white">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 animate-mesh" style={{ backgroundSize: '200% 200%' }} />
        {/* Floating orbs */}
        <div className="absolute top-0 right-[15%] w-[250px] h-[250px] bg-blue-500/15 rounded-full blur-[80px] animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-[10%] w-[200px] h-[200px] bg-teal-500/10 rounded-full blur-[60px] animate-float-medium pointer-events-none" />

        <div className="container relative mx-auto px-4 z-10">
          <Button
            variant="ghost"
            onClick={() => router.push('/jobs')}
            className="text-white/70 hover:text-white hover:bg-white/10 mb-4 -ml-2"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t.nav.jobs}
          </Button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="flex flex-wrap gap-2 mb-2">
                {categoryName && (
                  <Badge className="bg-white/10 text-white hover:bg-white/20 border-white/20 backdrop-blur-sm px-3 py-1 font-medium">
                    {categoryName}
                  </Badge>
                )}
                {job.employment_type && (
                  <Badge className="bg-indigo-500/20 text-indigo-100 border-indigo-500/30 backdrop-blur-sm px-3 py-1 font-medium capitalize">
                    {(job.employment_type as string) === 'full_time' ? (lang === 'uz' ? 'To\'liq stavka' : 'РџРѕР»РЅР°СЏ Р·Р°РЅСЏС‚РѕСЃС‚СЊ') :
                      (job.employment_type as string) === 'part_time' ? (lang === 'uz' ? 'Yarim stavka' : 'Р§Р°СЃС‚РёС‡РЅР°СЏ Р·Р°РЅСЏС‚РѕСЃС‚СЊ') :
                        (job.employment_type as string) === 'contract' ? (lang === 'uz' ? 'Shartnoma' : 'РљРѕРЅС‚СЂР°РєС‚') :
                          (job.employment_type as string) === 'freelance' ? 'Freelance' : job.employment_type}
                  </Badge>
                )}
                {((job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count) && (
                  <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-500/30 backdrop-blur-sm px-3 py-1 font-medium">
                    {(job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count} {lang === 'ru' ? 'РјРµСЃС‚' : "o'rin"}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight leading-tight">
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-indigo-100/80 text-xs md:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-white text-sm">{job.company_name || 'ISHDASIZ'}</span>
                </div>
                {locationLabel && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-indigo-300" />
                    <span>{locationLabel}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-300" />
                  <span>{job.views_count} {lang === 'uz' ? 'marta ko\'rildi' : 'РїСЂРѕСЃРјРѕС‚СЂРѕРІ'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFavorite}
                disabled={favoriteLoading}
                className={`w-11 h-11 rounded-xl border-white/20 hover:bg-white/10 transition-all ${isFavorite ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-white/5 text-white"}`}
              >
                {favoriteLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Star className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
                )}
              </Button>
              {/* Apply Button - only for job seekers, NOT for employers */}
              {user?.active_role !== 'employer' && (
                <div className="flex flex-col items-end">
                  <Button
                    onClick={() => setDialogOpen(true)}
                    disabled={hasApplied || job.is_imported}
                    className={`h-11 px-6 rounded-xl font-bold shadow-xl transition-all text-sm ${job.is_imported
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-blue-500 to-teal-400 text-white hover:from-blue-400 hover:to-teal-300 shadow-blue-500/25'
                      }`}
                  >
                    {hasApplied ? (lang === 'uz' ? 'Ariza yuborilgan' : 'Р—Р°СЏРІРєР° РѕС‚РїСЂР°РІР»РµРЅР°') : t.job.apply}
                  </Button>
                  {job.is_imported && (
                    <span className="text-[10px] text-slate-400 mt-1">
                      {lang === 'uz' ? "Boshqa manbadan olindi" : "РР· РґСЂСѓРіРѕРіРѕ РёСЃС‚РѕС‡РЅРёРєР°"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-8">
            {/* Job Details Table (Osonish Style) */}
            <Card className="border-slate-200 shadow-sm overflow-hidden text-sm">
              <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                <CardTitle className="text-lg text-slate-900">{lang === 'ru' ? 'Р”РµС‚Р°Р»Рё РІР°РєР°РЅСЃРёРё' : "Vakansiya ma'lumotlari"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {/* Company */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РљРѕРјРїР°РЅРёСЏ' : 'Tashkilot'}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0">{job.company_name}</span>
                  </div>

                  {/* Position */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'Р”РѕР»Р¶РЅРѕСЃС‚СЊ' : 'Lavozim'}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0">{(job as any).raw_source_json?.position_name || title}</span>
                  </div>

                  {/* Vacancy Count */}
                  {((job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РљРѕР»РёС‡РµСЃС‚РІРѕ РјРµСЃС‚' : 'Vakansiyalar soni'}:</span>
                      <span className="font-semibold text-slate-900 mt-1 sm:mt-0">
                        {(job as any).raw_source_json?.vacancy_count || (job as any).vacancy_count}
                      </span>
                    </div>
                  )}

                  {/* Experience */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РћРїС‹С‚ СЂР°Р±РѕС‚С‹' : 'Ish tajribasi'}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0">{getExperienceLabel(job, lang)}</span>
                  </div>

                  {/* Payment Type */}
                  {(getPaymentTypeLabel(job, lang)) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'Р¤РѕСЂРјР° РѕРїР»Р°С‚С‹' : "To'lov shakli"}:</span>
                      <span className="font-semibold text-slate-900 mt-1 sm:mt-0">
                        {getPaymentTypeLabel(job, lang)}
                      </span>
                    </div>
                  )}

                  {/* Employment Type */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РўРёРї Р·Р°РЅСЏС‚РѕСЃС‚Рё' : 'Bandlik turi'}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0 capitalize">
                      {(() => {
                        const type = job.employment_type as string;
                        if (type === 'full_time') return lang === 'uz' ? 'To\'liq stavka (shtat asosida)' : 'РџРѕР»РЅР°СЏ Р·Р°РЅСЏС‚РѕСЃС‚СЊ';
                        if (type === 'part_time') return lang === 'uz' ? 'Yarim stavka' : 'Р§Р°СЃС‚РёС‡РЅР°СЏ Р·Р°РЅСЏС‚РѕСЃС‚СЊ';
                        if (type === 'contract') return lang === 'uz' ? 'Shartnoma asosida' : 'РџРѕ РєРѕРЅС‚СЂР°РєС‚Сѓ';
                        if (type === 'freelance') return 'Freelance';
                        return type;
                      })()}
                    </span>
                  </div>

                  {/* Work Mode */}
                  {(getWorkModeLabel(job, lang)) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'Р РµР¶РёРј СЂР°Р±РѕС‚С‹' : 'Ish usuli (rejimi)'}:</span>
                      <span className="font-semibold text-slate-900 mt-1 sm:mt-0">
                        {getWorkModeLabel(job, lang)}
                      </span>
                    </div>
                  )}

                  {/* Working Days - REMOVED (duplicate with Ish kunlari va vaqti below) */}

                  {/* Schedule (Ish kunlari va vaqti) - Always show */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'График работы' : 'Ish kunlari va vaqti'}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0">{scheduleLabel}</span>
                  </div>

                  {/* Probation Period (Sinov muddati) */}
                  {((job as any).raw_source_json?.test_period_id || (job as any).raw_source_json?.test_period) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РСЃРїС‹С‚Р°С‚РµР»СЊРЅС‹Р№ СЃСЂРѕРє' : "Sinov muddati"}:</span>
                      <span className="font-semibold text-slate-900 mt-1 sm:mt-0">
                        {getMappedValue('test_period', (job as any).raw_source_json?.test_period_id, lang) || (job as any).raw_source_json?.test_period}
                      </span>
                    </div>
                  )}

                  {/* Education */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РћР±СЂР°Р·РѕРІР°РЅРёРµ' : "Ma'lumot darajasi"}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0">{getEducationLabel(job, lang)}</span>
                  </div>

                  {/* Mutaxassisligi - REMOVED per user request */}

                  {/* Languages - handled in Languages section below */}

                  {/* Gender - Always show with correct label */}
                  <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                    <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'РџРѕР»' : 'Jinsi'}:</span>
                    <span className="font-semibold text-slate-900 mt-1 sm:mt-0">{getGenderLabel((job as any).gender, lang)}</span>
                  </div>

                  {/* Age - Only show if age is specified */}
                  {(job.age_min || job.age_max) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors">
                      <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'Р’РѕР·СЂР°СЃС‚' : 'Yoshi'}:</span>
                      <span className="font-semibold text-slate-900 mt-1 sm:mt-0">
                        {job.age_min && job.age_max ? `${job.age_min}-${job.age_max} ${lang === 'ru' ? 'Р»РµС‚' : 'yosh'}` :
                          job.age_min ? `${job.age_min}+ ${lang === 'ru' ? 'Р»РµС‚' : 'yosh'}` :
                            `${lang === 'ru' ? 'РґРѕ' : ''} ${job.age_max} ${lang === 'ru' ? 'Р»РµС‚' : 'yosh'}`}
                      </span>
                    </div>
                  )}

                  {/* Social Packages - REMOVED (duplicate with Qulayliklar below) */}

                  {/* Alohida toifalar (mos kelishi mumkin bo'lgan nomzodlar) */}
                  {((job as any).is_for_students || (job as any).is_for_graduates || (job as any).is_for_disabled) && (
                    <div className="flex flex-col sm:flex-row sm:items-center py-3 px-5 hover:bg-slate-50/50 transition-colors border-t border-slate-100">
                      <span className="text-slate-500 min-w-[200px] font-medium">{lang === 'ru' ? 'Для кого может подойти' : "Kimlar uchun mos kelishi mumkin"}:</span>
                      <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                        {(job as any).is_for_students && (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-200">{lang === 'ru' ? 'Могут подойти студенты' : 'Talabalar ham mos kelishi mumkin'}</Badge>
                        )}
                        {(job as any).is_for_graduates && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200">{lang === 'ru' ? 'Могут подойти выпускники' : 'Bitiruvchilar ham mos kelishi mumkin'}</Badge>
                        )}
                        {(job as any).is_for_disabled && (
                          <Badge className="bg-teal-50 text-teal-700 border-teal-200">{lang === 'ru' ? 'Могут подойти люди с инвалидностью' : "Nogironligi bo'lgan shaxslar ham mos kelishi mumkin"}</Badge>
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
              <Card className="border-slate-200 shadow-lg overflow-hidden bg-gradient-to-br from-white to-indigo-50/30">
                <CardContent className="p-5 md:p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                    </div>
                    {lang === 'ru' ? 'РћР±СЏР·Р°РЅРЅРѕСЃС‚Рё Рё РўСЂРµР±РѕРІР°РЅРёСЏ' : 'Vazifalar va talablar'}
                  </h2>

                  {combinedDuties.length > 0 ? (
                    <ul className="space-y-2 list-none">
                      {combinedDuties.map((item, idx) => (
                        <li key={idx} className="flex gap-3 text-slate-700">
                          <span className="text-indigo-500 font-bold text-lg leading-6">вЂў</span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-6">
                      {/* Description Fallback */}
                      <div className="bg-white p-4 md:p-5 rounded-2xl border border-indigo-100 text-slate-700 text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                        {((job as any).raw_source_json?.html_responsibilities || description || '').replace(/\\n/g, '\n')}
                      </div>

                      {/* Requirements Fallback (if separate from description) */}
                      {!requirementsIsDuplicate && (requirements || (job as any).raw_source_json?.html_requirements) && (
                        <div className="bg-white p-4 md:p-5 rounded-2xl border border-indigo-100 text-slate-700 text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                          <h3 className="font-semibold mb-2">{lang === 'ru' ? 'РўСЂРµР±РѕРІР°РЅРёСЏ:' : 'Talablar:'}</h3>
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
              <Card className="border-slate-200 shadow-lg overflow-hidden bg-gradient-to-br from-white to-emerald-50/30">
                <CardContent className="p-5 md:p-6">
                  <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    {/* User requested "Qulayliklar" for imported jobs specifically, but generally good for both */}
                    {lang === 'ru' ? 'РџСЂРµРёРјСѓС‰РµСЃС‚РІР°' : 'Qulayliklar'}
                  </h2>

                  {benefitsList.length > 0 && (
                    <ul className="space-y-2">
                      {benefitsList.map((item, idx) => (
                        <li key={`benefit-${idx}`} className="text-slate-700 leading-relaxed">
                          - {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {benefitsList.length === 0 && (job as any).raw_source_json?.html_conditions && (
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-emerald-100 text-slate-700 text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                      {String((job as any).raw_source_json?.html_conditions || '').replace(/\\n/g, '\n')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Skills & Languages section (Benefits removed - only show once in Qulayliklar above) */}
            {(((job as any).raw_source_json?.skills_details?.length > 0) ||
              ((job as any).raw_source_json?.languages?.length > 0)) && (
                <Card className="border-slate-200 shadow-sm overflow-hidden mb-6">
                  <CardContent className="p-5 md:p-6 space-y-6">
                    {/* Skills (use skills_details from API) */}
                    {(job as any).raw_source_json?.skills_details?.length > 0 && (
                      <section>
                        <h3 className="font-semibold text-slate-900 mb-3">{lang === 'ru' ? 'РџСЂРѕС„РµСЃСЃРёРѕРЅР°Р»СЊРЅС‹Рµ РЅР°РІС‹РєРё' : "Kasbiy bilim va ko'nikmalar"}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(job as any).raw_source_json.skills_details.map((skill: any, idx: number) => {
                            const skillName = skill.skill_name || skill.name || (typeof skill === 'string' ? skill : null);
                            if (!skillName || typeof skillName === 'number') return null;
                            return (
                              <Badge key={idx} variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5">
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
                        <h3 className="font-semibold text-slate-900 mb-3">{lang === 'ru' ? 'Р—РЅР°РЅРёРµ СЏР·С‹РєРѕРІ' : "Tillarni bilishi"}</h3>
                        <div className="flex flex-wrap gap-2">
                          {(job as any).raw_source_json.languages.map((langItem: any, idx: number) => {
                            // OsonIsh API uses "language" key (not "id")
                            const langId = langItem.language || langItem.id || (typeof langItem === 'number' ? langItem : null);
                            const levelId = langItem.level;

                            const langName = getMappedValue('languages', langId, lang);
                            const levelName = getMappedValue('language_levels', levelId, lang);

                            // Fallback to name if available
                            const displayName = langName || langItem.name;

                            if (!displayName || typeof displayName === 'number') return null;

                            return (
                              <Badge key={idx} variant="outline" className="px-3 py-1.5 border-slate-200 text-slate-700">
                                <span className="font-bold mr-1">{displayName}</span>
                                {levelName && <span className="text-slate-500">- {levelName}</span>}
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
            <Card className="border border-slate-200 shadow-xl shadow-indigo-100/30 bg-white overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                <Banknote className="w-24 h-24 rotate-12 text-indigo-900" />
              </div>
              <CardContent className="p-6 relative">
                <h3 className="text-2xl font-extrabold mb-1 text-slate-900">
                  {formatSalary(job.salary_min, job.salary_max, lang)}
                </h3>
                <p className="text-slate-500 text-sm mb-6">{t.job.perMonth}</p>

                {/* Removed Apply button and footer as requested by user ("tut ne nado Ariza qoldirish") */}
              </CardContent>
            </Card>

            {/* Contact Card */}
            {(job.contact_phone || job.contact_telegram || (job as any).phone || (job as any).email || (job as any).contact_email || (job as any).hr_name || (job as any).raw_source_json?.hr_name) && (
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">{lang === 'ru' ? 'РљРѕРЅС‚Р°РєС‚РЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ' : 'Bog\'lanish uchun'}</h3>
                </div>
                <CardContent className="p-6 space-y-5">
                  {/* Only show HR name if it was explicitly provided by source API */}
                  {(job as any).raw_source_json?.hr?.fio && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center transition-transform group-hover:scale-110">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">{lang === 'ru' ? 'РљРѕРЅС‚Р°РєС‚РЅРѕРµ Р»РёС†Рѕ' : "Vakansiya HR menejeri"}</p>
                          <p className="font-bold text-slate-900 text-sm">{(job as any).raw_source_json.hr.fio}</p>
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
                            <p className="text-xs text-slate-500 font-medium">{lang === 'ru' ? 'РўРµР»РµС„РѕРЅ' : 'Telefon'}</p>
                            <p className="font-bold text-slate-900">{job.contact_phone || job.phone}</p>
                          </div>
                        </div>
                        <a
                          href={`tel:${job.contact_phone || job.phone}`}
                          className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          <Phone className="w-5 h-5" />
                        </a>
                      </div>
                    )
                  )}

                  {job.contact_telegram && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center transition-transform group-hover:scale-110">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.48-.94-2.4-1.55-1.07-.7-.37-1.09.24-1.72.14-.15 2.54-2.32 2.59-2.52.01-.03.01-.15-.06-.21-.07-.06-.18-.04-.26-.02-.11.02-1.91 1.2-5.4 3.56-.51.35-.96.52-1.37.51-.45-.01-1.32-.26-1.96-.46-.79-.25-1.42-.38-1.36-.8.03-.21.32-.42.88-.63 3.44-1.5 5.75-2.49 6.92-2.97 3.29-1.35 3.98-1.58 4.43-1.58.1 0 .32.02.46.12.12.08.15.2.16.28 0 .09.01.27 0 .44z"></path></svg>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Telegram</p>
                          <p className="font-bold text-slate-900">@{job.contact_telegram.replace('@', '')}</p>
                        </div>
                      </div>
                      <a
                        href={`https://t.me/${job.contact_telegram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-sky-500 hover:text-white transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </a>
                    </div>
                  )}

                  {((job as any).contact_email || (job as any).email) && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center transition-transform group-hover:scale-110">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Email</p>
                          <p className="font-bold text-slate-900 truncate max-w-[150px]">{(job as any).contact_email || (job as any).email}</p>
                        </div>
                      </div>
                      <a
                        href={`mailto:${(job as any).contact_email || (job as any).email}`}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-violet-600 hover:text-white transition-all"
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
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">{lang === 'ru' ? 'РњРµСЃС‚РѕРїРѕР»РѕР¶РµРЅРёРµ' : 'Manzil'}</h3>
                </div>
                <div className="h-[250px] relative">
                  <JobMap jobs={[job]} selectedJobId={job.id} height="100%" />
                </div>
                <div className="p-4 bg-white border-t space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{lang === 'ru' ? 'РђРґСЂРµСЃ' : 'Aniq manzil'}</p>
                      <p className="text-slate-600 text-sm">{(job as any).address || (job as any).raw_source_json?.address || locationLabel}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Similar Jobs Widget */}
            {similarJobs.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-bold text-slate-900 px-1">{lang === 'ru' ? 'РџРѕС…РѕР¶РёРµ РІР°РєР°РЅСЃРёРё' : 'O\'xshash e\'lonlar'}</h3>
                <div className="space-y-3">
                  {similarJobs.map((sj) => (
                    <Link
                      key={sj.id}
                      href={`/jobs/${sj.id}`}
                      className="group block p-4 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all"
                    >
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {lang === 'ru' ? sj.title_ru : sj.title_uz}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 mb-2">{sj.company_name}</p>
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

      {/* Application Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{t.application.title}</DialogTitle>
              <p className="text-indigo-100 opacity-80 mt-1">{lang === 'ru' ? 'Р’Р°С€ РѕС‚РєР»РёРє Р±СѓРґРµС‚ РѕС‚РїСЂР°РІР»РµРЅ РЅР°РїСЂСЏРјСѓСЋ СЂР°Р±РѕС‚РѕРґР°С‚РµР»СЋ' : 'Sizning arizangiz to\'g\'ridan-to\'g\'ri ish beruvchiga yuboriladi'}</p>
            </DialogHeader>
          </div>

          <form onSubmit={handleApply} className="p-8 space-y-6">
            {resumes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    {lang === 'ru' ? 'Р’С‹Р±РµСЂРёС‚Рµ СЂРµР·СЋРјРµ' : 'Rezyume tanlang'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{lang === 'ru' ? 'Р‘РµР· СЂРµР·СЋРјРµ' : 'Rezyumesiz'}</span>
                    <Switch
                      checked={!sendWithoutResume}
                      onCheckedChange={(checked) => setSendWithoutResume(!checked)}
                      className="data-[state=checked]:bg-indigo-600"
                    />
                  </div>
                </div>

                {!sendWithoutResume && (
                  <Select
                    value={applicationData.resume_id}
                    onValueChange={(value) => setApplicationData({ ...applicationData, resume_id: value })}
                  >
                    <SelectTrigger className="h-12 rounded-xl border-slate-200">
                      <SelectValue placeholder={lang === 'ru' ? 'Р’С‹Р±РµСЂРёС‚Рµ РёР· СЃРїРёСЃРєР°' : 'Ro\'yxatdan tanlang'} />
                    </SelectTrigger>
                    <SelectContent>
                      {resumes.map((resume) => (
                        <SelectItem key={resume.id} value={resume.id}>
                          {resume.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">{t.application.fullName}</Label>
                <Input
                  required
                  value={applicationData.full_name}
                  onChange={(e) => setApplicationData({ ...applicationData, full_name: e.target.value })}
                  className="h-12 rounded-xl border-slate-200 focus:ring-indigo-500"
                  placeholder="Ism sharifingiz"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">{t.application.phone}</Label>
                <Input
                  required
                  type="tel"
                  value={applicationData.phone}
                  onChange={(e) => setApplicationData({ ...applicationData, phone: e.target.value })}
                  className="h-12 rounded-xl border-slate-200"
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">{t.application.message}</Label>
              <Textarea
                value={applicationData.message}
                onChange={(e) => setApplicationData({ ...applicationData, message: e.target.value })}
                rows={4}
                className="rounded-xl border-slate-200 focus:ring-indigo-500 resize-none"
                placeholder={lang === 'ru' ? 'РќР°РїРёС€РёС‚Рµ РєРѕСЂРѕС‚РєРѕ Рѕ СЃРµР±Рµ Рё РїРѕС‡РµРјСѓ РІС‹ РїРѕРґС…РѕРґРёС‚Рµ РЅР° СЌС‚Сѓ СЂРѕР»СЊ...' : 'O\'zingiz haqingizda va nima uchun bu vakansiya sizga mosligi haqida qisqacha yozing...'}
              />
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-xl shadow-indigo-200" disabled={applying}>
              {applying ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
              {t.application.submit}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

