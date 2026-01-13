'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { supabase } from '@/lib/supabase';
import { JobWithRelations } from '@/types/database';
import { formatSalary, formatDate } from '@/lib/constants';
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
  }, [user?.id, user?.phone, id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const toggleFavorite = async () => {
    if (!user?.id || !id) {
      toast.error(lang === 'uz' ? 'Avval tizimga kiring' : 'Сначала войдите в систему');
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
        toast.success(lang === 'uz' ? 'Sevimlilardan o\'chirildi' : 'Удалено из избранного');
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, job_id: id });
        setIsFavorite(true);
        toast.success(lang === 'uz' ? 'Sevimlilarga qo\'shildi' : 'Добавлено в избранное');
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'uz' ? 'Xatolik' : 'Ошибка');
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
                toast.error(lang === 'uz' ? 'Chat tizimi hali tayyor emas (DB sync error)' : 'Система чата еще не готова (ошибка БД)');
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
        toast.error(lang === 'uz' ? 'Sessiya xatosi. Iltimos, qayta kiring.' : 'Ошибка сессии. Пожалуйста, войдите снова.');
        setTimeout(() => logout(), 2000); // Logout after 2 seconds
      } else if (error.code === '23505' || error.message?.includes('409') || error.code === '409') {
        setHasApplied(true);
        toast.error(lang === 'uz' ? 'Siz allaqachon ariza topshirgansiz' : 'Вы уже подали заявку');
      } else {
        toast.error(lang === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка');
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
            {lang === 'uz' ? 'Vakansiya topilmadi' : 'Вакансия не найдена'}
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
  const description = lang === 'uz' ? job.description_uz : job.description_ru;
  const requirements = lang === 'uz' ? job.requirements_uz : job.requirements_ru;
  const categoryName = job.categories
    ? lang === 'uz'
      ? job.categories.name_uz
      : job.categories.name_ru
    : '';

  // Correctly access nested location data
  const district = job.districts;
  // @ts-ignore
  const region = district?.regions;

  const regionName = region
    ? lang === 'uz'
      ? region.name_uz
      : region.name_ru
    : '';

  const districtName = district
    ? lang === 'uz'
      ? district.name_uz
      : district.name_ru
    : '';

  const regionLabel = regionName ? (lang === 'uz' ? `${regionName} vil.` : `${regionName} обл.`) : '';
  const locationLabel = [regionLabel, districtName].filter(Boolean).join(', ');
  const benefits: string | null = typeof job.benefits === 'string' ? job.benefits : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 py-5 md:py-6 text-white">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-400 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
        </div>

        <div className="container relative mx-auto px-4">
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
                    {(job.employment_type as string) === 'full_time' ? (lang === 'uz' ? 'To\'liq stavka' : 'Полная занятость') :
                      (job.employment_type as string) === 'part_time' ? (lang === 'uz' ? 'Yarim stavka' : 'Частичная занятость') :
                        (job.employment_type as string) === 'contract' ? (lang === 'uz' ? 'Shartnoma' : 'Контракт') :
                          (job.employment_type as string) === 'freelance' ? 'Freelance' : job.employment_type}
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
                  <span>{job.views_count} {lang === 'uz' ? 'marta ko\'rildi' : 'просмотров'}</span>
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
              {user?.role !== 'employer' && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  disabled={hasApplied}
                  className="h-11 px-6 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold shadow-xl shadow-indigo-950/20 transition-all text-sm"
                >
                  {hasApplied ? (lang === 'uz' ? 'Ariza yuborilgan' : 'Заявка отправлена') : t.job.apply}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-8">
            {/* Responsibilities & Requirements */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardContent className="p-5 md:p-6">
                <div className="space-y-6">

                  {requirements && (
                    <section>
                      <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        {lang === 'ru' ? 'Требования и обязанности' : 'Talablar va vazifalar'}
                      </h2>
                      <div className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 text-slate-700 text-base leading-relaxed whitespace-pre-wrap">
                        {requirements.replace(/\\n/g, '\n')}
                      </div>
                    </section>
                  )}

                  {benefits && (
                    <section>
                      <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                        {lang === 'ru' ? 'Преимущества' : 'Qulayliklar'}
                      </h2>
                      <div className="bg-emerald-50/50 p-4 md:p-5 rounded-2xl border border-emerald-100 text-emerald-900 text-base leading-relaxed whitespace-pre-wrap">
                        {benefits.replace(/\\n/g, '\n')}
                      </div>
                    </section>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Candidate Requirements Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Star className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-0.5">{lang === 'ru' ? 'Опыт' : 'Tajriba'}</p>
                  <p className="font-bold text-slate-900">
                    {job.experience === 'no_experience' ? (lang === 'ru' ? 'Без опыта' : 'Talab qilinmaydi') :
                      job.experience === '1_3' ? '1-3 ' + (lang === 'ru' ? 'лет' : 'yil') :
                        job.experience === '3_6' ? '3-6 ' + (lang === 'ru' ? 'лет' : 'yil') :
                          job.experience === '6_plus' ? '6+ ' + (lang === 'ru' ? 'лет' : 'yil') :
                            (lang === 'ru' ? 'Любой' : 'Ahamiyatsiz')}
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-0.5">{lang === 'ru' ? 'Образование' : "Ma'lumoti"}</p>
                  <p className="font-bold text-slate-900">
                    {job.education_level === 'any' ? (lang === 'ru' ? 'Любое' : 'Ahamiyatsiz') :
                      job.education_level === 'secondary' ? (lang === 'ru' ? 'Среднее' : "O'rta") :
                        job.education_level === 'vocational' ? (lang === 'ru' ? 'Спец.' : "Maxsus") :
                          job.education_level === 'higher' ? (lang === 'ru' ? 'Высшее' : 'Oliy') :
                            job.education_level === 'master' ? (lang === 'ru' ? 'Магистр' : 'Magistr') :
                              (lang === 'ru' ? 'Любое' : 'Ahamiyatsiz')}
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-0.5">{lang === 'ru' ? 'Пол' : 'Jins'}</p>
                  <p className="font-bold text-slate-900">
                    {job.gender === 'male' ? (lang === 'ru' ? 'Мужской' : 'Erkak') :
                      job.gender === 'female' ? (lang === 'ru' ? 'Женский' : 'Ayol') :
                        (lang === 'ru' ? 'Любой' : 'Ahamiyatsiz')}
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-0.5">{lang === 'ru' ? 'Возраст' : 'Yosh'}</p>
                  <p className="font-bold text-slate-900">
                    {job.age_min && job.age_max ? `${job.age_min}-${job.age_max}` :
                      job.age_min ? `${job.age_min}+` :
                        job.age_max ? `${lang === 'ru' ? 'до' : ''} ${job.age_max}` :
                          (lang === 'ru' ? 'Любой' : 'Ahamiyatsiz')}
                  </p>
                </div>
              </div>
            </div>

            {/* Languages & Special categories */}
            {(job.languages || getActiveSpecialCategories(job).length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {job.languages && Array.isArray(job.languages) && job.languages.length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="pb-3 px-6">
                      <CardTitle className="text-base text-slate-500 font-bold uppercase tracking-widest">{lang === 'ru' ? 'Знание языков' : 'Til bilish'}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0 flex flex-wrap gap-2">
                      {(job.languages as Array<{ language: string; level: string }>).map((langItem, idx) => (
                        <Badge key={idx} variant="secondary" className="px-3 py-1.5 bg-slate-100 text-slate-700 border-slate-200">
                          <span className="font-bold">{langItem.language}</span>
                          <span className="ml-1 opacity-70">({langItem.level})</span>
                        </Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {getActiveSpecialCategories(job).length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="pb-3 px-6">
                      <CardTitle className="text-base text-slate-500 font-bold uppercase tracking-widest">{lang === 'ru' ? 'Особые категории' : 'Maxsus toifalar'}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0 flex flex-wrap gap-2">
                      {getActiveSpecialCategories(job).map((cat) => (
                        <div key={cat.key} className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-sm font-semibold">
                          <CheckCircle className="w-4 h-4" />
                          <span>{lang === 'ru' ? cat.badge_ru : cat.badge_uz}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Map */}
            {job.latitude && job.longitude && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">{lang === 'ru' ? 'Местоположение' : 'Manzil'}</h2>
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                  <div className="h-[350px] relative">
                    <JobMap jobs={[job]} selectedJobId={job.id} height="100%" />
                  </div>
                  {job.address && (
                    <div className="p-4 bg-white border-t flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-900">{lang === 'ru' ? 'Точный адрес' : 'Aniq manzil'}</p>
                        <p className="text-slate-600">{job.address}</p>
                      </div>
                    </div>
                  )}
                </Card>
              </section>
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

                <Button
                  onClick={() => setDialogOpen(true)}
                  disabled={hasApplied}
                  className={`w-full h-11 rounded-xl shadow-md font-bold text-sm transition-all ${hasApplied
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.01]"
                    }`}
                >
                  {hasApplied ? (lang === 'uz' ? 'Ariza yuborilgan' : 'Заявка отправлена') : t.job.apply}
                </Button>
                <p className="text-center text-[10px] text-slate-400 mt-4">
                  {lang === 'uz' ? 'E\'lon joylandi' : 'Размещено'}: {formatDate(job.created_at, lang)}
                </p>
              </CardContent>
            </Card>

            {/* Contact Card */}
            {(job.contact_phone || job.contact_telegram || job.phone || job.email) && (
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">{lang === 'ru' ? 'Контактная информация' : 'Bog\'lanish uchun'}</h3>
                </div>
                <CardContent className="p-6 space-y-5">
                  {(job.contact_phone || job.phone) && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">{lang === 'ru' ? 'Телефон' : 'Telefon'}</p>
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

                  {job.email && (
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center transition-transform group-hover:scale-110">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Email</p>
                          <p className="font-bold text-slate-900 truncate max-w-[150px]">{job.email}</p>
                        </div>
                      </div>
                      <a
                        href={`mailto:${job.email}`}
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-violet-600 hover:text-white transition-all"
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Similar Jobs Widget */}
            {similarJobs.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-bold text-slate-900 px-1">{lang === 'ru' ? 'Похожие вакансии' : 'O\'xshash e\'lonlar'}</h3>
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
              <p className="text-indigo-100 opacity-80 mt-1">{lang === 'ru' ? 'Ваш отклик будет отправлен напрямую работодателю' : 'Sizning arizangiz to\'g\'ridan-to\'g\'ri ish beruvchiga yuboriladi'}</p>
            </DialogHeader>
          </div>

          <form onSubmit={handleApply} className="p-8 space-y-6">
            {resumes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    {lang === 'ru' ? 'Выберите резюме' : 'Rezyume tanlang'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{lang === 'ru' ? 'Без резюме' : 'Rezyumesiz'}</span>
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
                      <SelectValue placeholder={lang === 'ru' ? 'Выберите из списка' : 'Ro\'yxatdan tanlang'} />
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
                placeholder={lang === 'ru' ? 'Напишите коротко о себе и почему вы подходите на эту роль...' : 'O\'zingiz haqingizda va nima uchun bu vakansiya sizga mosligi haqida qisqacha yozing...'}
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
