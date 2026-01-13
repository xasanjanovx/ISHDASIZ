'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { JobWithRelations } from '@/types/database';
import { formatSalary, formatDate } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Eye, Loader2, ArrowLeft } from '@/components/ui/icons';
import { toast } from 'sonner';

export default function AdminJobsPage() {
  const { lang, t } = useLanguage();
  const { user, adminProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<JobWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !adminProfile)) {
      router.push('/admin/login');
    }
  }, [user, adminProfile, authLoading, router]);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, categories(*), districts(*)')
      .order('created_at', { ascending: false });

    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && adminProfile) {
      fetchJobs();
    }
  }, [user, adminProfile, fetchJobs]);

  const toggleJobStatus = async (jobId: string, isActive: boolean) => {
    const { error } = await supabase.from('jobs').update({ is_active: isActive }).eq('id', jobId);

    if (error) {
      toast.error(lang === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка');
      return;
    }

    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, is_active: isActive } : j)));
    toast.success(
      isActive
        ? lang === 'uz'
          ? 'Vakansiya faollashtirildi'
          : 'Вакансия активирована'
        : lang === 'uz'
          ? 'Vakansiya ochirildi'
          : 'Вакансия деактивирована'
    );
  };

  const deleteJob = async (jobId: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);

    if (error) {
      toast.error(lang === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка');
      return;
    }

    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    toast.success(lang === 'uz' ? 'Vakansiya ochirildi' : 'Вакансия удалена');
  };

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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white relative z-10">{t.admin.jobs}</h1>
                <p className="text-sky-100 mt-1">
                  {lang === 'uz' ? `${jobs.length} ta vakansiya` : `${jobs.length} вакансий`}
                </p>
              </div>
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === 'uz' ? 'Vakansiya' : 'Вакансия'}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {lang === 'uz' ? 'Kompaniya' : 'Компания'}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {lang === 'uz' ? 'Maosh' : 'Зарплата'}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {lang === 'uz' ? 'Ko\'rishlar' : 'Просмотры'}
                    </TableHead>
                    <TableHead>{lang === 'uz' ? 'Holati' : 'Статус'}</TableHead>
                    <TableHead className="text-right">{lang === 'uz' ? 'Amallar' : 'Действия'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {lang === 'uz' ? job.title_uz : job.title_ru}
                          </p>
                          <p className="text-xs text-slate-500">
                            {job.categories
                              ? lang === 'uz'
                                ? job.categories.name_uz
                                : job.categories.name_ru
                              : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{job.company_name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                          {formatSalary(job.salary_min, job.salary_max, lang)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="flex items-center gap-1 text-sm text-slate-500">
                          <Eye className="w-3 h-3" />
                          {job.views_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={job.is_active}
                          onCheckedChange={(checked) => toggleJobStatus(job.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/jobs/${job.id}`}>
                            <Button variant="ghost" size="icon">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {lang === 'uz' ? 'Vakansiyani ochirish' : 'Удалить вакансию'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {lang === 'uz'
                                    ? 'Bu amalni qaytarib bolmaydi. Vakansiya butunlay ochiriladi.'
                                    : 'Это действие нельзя отменить. Вакансия будет удалена навсегда.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.admin.cancel}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteJob(job.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  {t.admin.deleteJob}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
