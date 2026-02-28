'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, TrendingUp, Briefcase, MapPin, Users, Eye } from '@/components/ui/icons';

const ADMIN_FETCH_BATCH = 1000;

interface Stats {
  totalJobs: number;
  activeJobs: number;
  totalViews: number;
  totalApplications: number;
  jobsByCategory: { name: string; count: number }[];
  jobsByDistrict: { name: string; count: number }[];
  jobsByType: { type: string; count: number }[];
}

export default function AdminStatsPage() {
  const { lang, t } = useLanguage();
  const { user, adminProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !adminProfile)) {
      router.push('/admin/login');
    }
  }, [user, adminProfile, authLoading, router]);

  const fetchStats = useCallback(async () => {
    const fetchAllJobs = async () => {
      const allJobs: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, categories(*), districts(*, regions(*))')
          .range(from, from + ADMIN_FETCH_BATCH - 1);

        if (error) {
          throw error;
        }

        const batch = data || [];
        allJobs.push(...batch);

        if (batch.length < ADMIN_FETCH_BATCH) {
          break;
        }

        from += ADMIN_FETCH_BATCH;
      }

      return allJobs;
    };

    const fetchAllApplications = async () => {
      const allApplications: { id: string }[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('job_applications')
          .select('id')
          .range(from, from + ADMIN_FETCH_BATCH - 1);

        if (error) {
          throw error;
        }

        const batch = data || [];
        allApplications.push(...batch);

        if (batch.length < ADMIN_FETCH_BATCH) {
          break;
        }

        from += ADMIN_FETCH_BATCH;
      }

      return allApplications;
    };

    const [jobs, applications, categoriesRes, districtsRes] = await Promise.all([
      fetchAllJobs(),
      fetchAllApplications(),
      supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011'),
      supabase.from('districts').select('*'),
    ]);
    const categories = categoriesRes.data || [];
    const districts = districtsRes.data || [];

    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((j) => j.is_active).length;
    const totalViews = jobs.reduce((sum, j) => sum + (j.views_count || 0), 0);
    const totalApplications = applications.length || 0;

    const categoryCount: Record<string, number> = {};
    jobs.forEach((job) => {
      if (job.category_id) {
        categoryCount[job.category_id] = (categoryCount[job.category_id] || 0) + 1;
      }
    });
    const jobsByCategory = categories
      .map((cat) => ({
        name: lang === 'uz' ? cat.name_uz : cat.name_ru,
        count: categoryCount[cat.id] || 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);

    const districtCount: Record<string, number> = {};
    jobs.forEach((job) => {
      if (job.district_id) {
        districtCount[job.district_id] = (districtCount[job.district_id] || 0) + 1;
      }
    });
    const jobsByDistrict = districts
      .map((dist) => ({
        name: lang === 'uz' ? dist.name_uz : dist.name_ru,
        count: districtCount[dist.id] || 0,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const typeCount: Record<string, number> = {};
    jobs.forEach((job) => {
      typeCount[job.employment_type] = (typeCount[job.employment_type] || 0) + 1;
    });
    const jobsByType = Object.entries(typeCount).map(([type, count]) => ({
      type: t.employmentTypes[type as keyof typeof t.employmentTypes] || type,
      count,
    }));

    setStats({
      totalJobs,
      activeJobs,
      totalViews,
      totalApplications,
      jobsByCategory,
      jobsByDistrict,
      jobsByType,
    });
    setLoading(false);
  }, [lang, t]);

  useEffect(() => {
    if (user && adminProfile) {
      fetchStats();
    }
  }, [user, adminProfile, fetchStats]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!user || !adminProfile || !stats) {
    return null;
  }

  const statCards = [
    {
      title: lang === 'uz' ? 'Jami vakansiyalar' : 'Всего вакансий',
      value: stats.totalJobs,
      icon: Briefcase,
      color: 'bg-sky-500',
    },
    {
      title: lang === 'uz' ? 'Faol vakansiyalar' : 'Активных',
      value: stats.activeJobs,
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      title: lang === 'uz' ? 'Arizalar' : 'Заявок',
      value: stats.totalApplications,
      icon: Users,
      color: 'bg-amber-500',
    },
    {
      title: lang === 'uz' ? 'Ko\'rishlar' : 'Просмотров',
      value: stats.totalViews,
      icon: Eye,
      color: 'bg-rose-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-white relative z-10">
              {lang === 'uz' ? 'Statistika' : 'Статистика'}
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center text-white`}
                  >
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-sky-600" />
                {lang === 'uz' ? 'Kategoriyalar bo\'yicha' : 'По категориям'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.jobsByCategory.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full"
                          style={{
                            width: `${(item.count / stats.totalJobs) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                {lang === 'uz' ? 'Tumanlar bo\'yicha' : 'По районам'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.jobsByDistrict.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 truncate mr-2">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{
                            width: `${(item.count / stats.totalJobs) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                {lang === 'uz' ? 'Ish turi bo\'yicha' : 'По типу занятости'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.jobsByType.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{item.type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${(item.count / stats.totalJobs) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
