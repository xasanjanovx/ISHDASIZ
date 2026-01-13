'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Users,
  MapPin,
  Eye,
  TrendingUp,
  Plus,
  Loader2,
  FileText,
  BarChart3,
  Shield,
} from '@/components/ui/icons';
import Link from 'next/link';

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  totalViews: number;
  recentJobs: any[];
  recentApplications: any[];
}

export default function AdminDashboard() {
  const { lang, t } = useLanguage();
  const { user, adminProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !adminProfile)) {
      router.push('/admin/login');
    }
  }, [user, adminProfile, authLoading, router]);

  const fetchStats = useCallback(async () => {
    const [jobsResult, applicationsResult] = await Promise.all([
      supabase.from('jobs').select('id, is_active, views_count, title_uz, title_ru, created_at'),
      supabase
        .from('job_applications')
        .select('id, full_name, phone, created_at, jobs(title_uz, title_ru)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const jobs = jobsResult.data || [];
    const applications = applicationsResult.data || [];

    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((j) => j.is_active).length;
    const totalViews = jobs.reduce((sum, j) => sum + (j.views_count || 0), 0);
    const totalApplications = applications.length;

    const recentJobs = jobs
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    setStats({
      totalJobs,
      activeJobs,
      totalApplications,
      totalViews,
      recentJobs,
      recentApplications: applications,
    });
    setLoading(false);
  }, []);

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

  if (!user || !adminProfile) {
    return null;
  }

  const statCards = [
    {
      title: lang === 'uz' ? 'Jami vakansiyalar' : 'Всего вакансий',
      value: stats?.totalJobs || 0,
      icon: Briefcase,
      color: 'bg-sky-500',
    },
    {
      title: lang === 'uz' ? 'Faol vakansiyalar' : 'Активных вакансий',
      value: stats?.activeJobs || 0,
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      title: lang === 'uz' ? 'Arizalar' : 'Заявок',
      value: stats?.totalApplications || 0,
      icon: Users,
      color: 'bg-amber-500',
    },
    {
      title: lang === 'uz' ? 'Ko\'rishlar' : 'Просмотров',
      value: stats?.totalViews || 0,
      icon: Eye,
      color: 'bg-rose-500',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white relative z-10">{t.admin.dashboard}</h1>
              <p className="text-sky-100 mt-1">
                {lang === 'uz' ? 'Xush kelibsiz' : 'Добро пожаловать'}, {adminProfile.full_name}
              </p>
            </div>
            <Link href="/admin/jobs/new">
              <Button className="bg-white text-sky-600 hover:bg-sky-50">
                <Plus className="w-4 h-4 mr-2" />
                {t.admin.createJob}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, idx) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center text-white`}>
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

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-sky-600" />
                {lang === 'uz' ? 'So\'nggi vakansiyalar' : 'Последние вакансии'}
              </CardTitle>
              <Link href="/admin/jobs">
                <Button variant="ghost" size="sm">
                  {lang === 'uz' ? 'Barchasi' : 'Все'}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {lang === 'uz' ? job.title_uz : job.title_ru}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Eye className="w-3 h-3" />
                      {job.views_count}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                {lang === 'uz' ? 'So\'nggi arizalar' : 'Последние заявки'}
              </CardTitle>
              <Link href="/admin/applications">
                <Button variant="ghost" size="sm">
                  {lang === 'uz' ? 'Barchasi' : 'Все'}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.recentApplications.map((app: any) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{app.full_name}</p>
                      <p className="text-xs text-slate-500">{app.phone}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {stats?.recentApplications.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    {lang === 'uz' ? 'Arizalar yo\'q' : 'Заявок нет'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/admin/jobs">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-sky-600" />
                <p className="font-medium text-sm">{t.admin.jobs}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/jobs/new">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <Plus className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                <p className="font-medium text-sm">{t.admin.createJob}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/applications">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-amber-600" />
                <p className="font-medium text-sm">{t.admin.applications}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/admins">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <Shield className="w-8 h-8 mx-auto mb-2 text-violet-600" />
                <p className="font-medium text-sm">
                  {lang === 'uz' ? 'Adminlar' : 'Админы'}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/stats">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-rose-600" />
                <p className="font-medium text-sm">
                  {lang === 'uz' ? 'Statistika' : 'Статистика'}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
