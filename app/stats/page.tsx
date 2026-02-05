'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Briefcase, MapPin, Users, Eye } from '@/components/ui/icons';
import Header from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

interface Stats {
  totalJobs: number;
  activeJobs: number;
  totalViews: number;
  totalApplications: number;
  jobsByCategory: { name: string; count: number }[];
  jobsByDistrict: { name: string; count: number }[];
  jobsByType: { type: string; count: number }[];
}

export default function StatsPage() {
  const { lang, t } = useLanguage();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const [jobsRes, appsRes, categoriesRes, districtsRes] = await Promise.all([
      supabase.from('jobs').select('*, categories(*), districts(*, regions(*))').eq('is_active', true),
      supabase.from('job_applications').select('id'),
      supabase.from('categories').select('*').neq('id', 'a0000011-0011-4000-8000-000000000011'),
      supabase.from('districts').select('*'),
    ]);

    const jobs = jobsRes.data || [];
    const categories = categoriesRes.data || [];
    const districts = districtsRes.data || [];

    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((j) => j.is_active).length;
    const totalViews = jobs.reduce((sum, j) => sum + (j.views_count || 0), 0);
    const totalApplications = appsRes.data?.length || 0;

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
    fetchStats();
  }, [fetchStats]);

  const statCards = stats ? [
    {
      title: lang === 'uz' ? 'Jami vakansiyalar' : 'Всего вакансий',
      value: stats.totalJobs,
      icon: Briefcase,
      gradient: 'from-blue-600 to-blue-700',
    },
    {
      title: lang === 'uz' ? 'Faol vakansiyalar' : 'Активных',
      value: stats.activeJobs,
      icon: TrendingUp,
      gradient: 'from-emerald-600 to-green-600',
    },
    {
      title: lang === 'uz' ? 'Arizalar' : 'Заявок',
      value: stats.totalApplications,
      icon: Users,
      gradient: 'from-orange-600 to-orange-700',
    },
    {
      title: lang === 'uz' ? 'Ko\'rishlar' : 'Просмотров',
      value: stats.totalViews,
      icon: Eye,
      gradient: 'from-red-600 to-rose-600',
    },
  ] : [];

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-24">
        <div className="container mx-auto px-4 py-12">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {lang === 'uz' ? 'Statistika' : 'Статистика'}
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              {lang === 'uz'
                ? 'Andijon viloyati mehnat bozori statistikasi va ish o\'rinlari haqida ma\'lumot'
                : 'Статистика рынка труда Андижанской области и информация о вакансиях'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {statCards.map((stat, idx) => (
                  <Card key={idx} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-0">
                      <div className={`bg-gradient-to-br ${stat.gradient} p-6 text-white`}>
                        <div className="flex items-center justify-between mb-4">
                          <stat.icon className="w-8 h-8 opacity-90" />
                          <div className="text-4xl font-bold">{stat.value}</div>
                        </div>
                        <p className="text-sm font-medium opacity-90">{stat.title}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-3 text-slate-900">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                      </div>
                      {lang === 'uz' ? 'Kategoriyalar bo\'yicha' : 'По категориям'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats?.jobsByCategory.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{item.name}</span>
                            <span className="text-sm font-bold text-blue-600">{item.count}</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{
                                width: `${(item.count / (stats?.totalJobs || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-3 text-slate-900">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                      </div>
                      {lang === 'uz' ? 'Tumanlar bo\'yicha' : 'По районам'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats?.jobsByDistrict.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 truncate mr-2">{item.name}</span>
                            <span className="text-sm font-bold text-emerald-600">{item.count}</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{
                                width: `${(item.count / (stats?.totalJobs || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg border-0">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-3 text-slate-900">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                      </div>
                      {lang === 'uz' ? 'Ish turi bo\'yicha' : 'По типу занятости'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats?.jobsByType.map((item, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{item.type}</span>
                            <span className="text-sm font-bold text-orange-600">{item.count}</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{
                                width: `${(item.count / (stats?.totalJobs || 1)) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
