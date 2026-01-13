'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Eye, Phone, Mail, MessageSquare } from '@/components/ui/icons';

interface ApplicationWithJob {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  message: string | null;
  created_at: string;
  jobs: {
    id: string;
    title_uz: string;
    title_ru: string;
    company_name: string;
  } | null;
}

export default function AdminApplicationsPage() {
  const { lang, t } = useLanguage();
  const { user, adminProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithJob | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !adminProfile)) {
      router.push('/admin/login');
    }
  }, [user, adminProfile, authLoading, router]);

  const fetchApplications = useCallback(async () => {
    const { data } = await supabase
      .from('job_applications')
      .select('*, jobs(id, title_uz, title_ru, company_name)')
      .order('created_at', { ascending: false });

    setApplications((data as ApplicationWithJob[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && adminProfile) {
      fetchApplications();
    }
  }, [user, adminProfile, fetchApplications]);

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
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white relative z-10">{t.admin.applications}</h1>
              <p className="text-sky-100 mt-1">
                {lang === 'uz' ? `${applications.length} ta ariza` : `${applications.length} заявок`}
              </p>
            </div>
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
                    <TableHead>{lang === 'uz' ? 'Ism' : 'Имя'}</TableHead>
                    <TableHead>{lang === 'uz' ? 'Telefon' : 'Телефон'}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {lang === 'uz' ? 'Vakansiya' : 'Вакансия'}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {lang === 'uz' ? 'Sana' : 'Дата'}
                    </TableHead>
                    <TableHead className="text-right">{lang === 'uz' ? 'Amallar' : 'Действия'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{app.full_name}</p>
                          {app.email && (
                            <p className="text-xs text-slate-500">{app.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`tel:${app.phone}`}
                          className="text-sky-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {app.phone}
                        </a>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {app.jobs ? (
                          <div>
                            <p className="text-sm">
                              {lang === 'uz' ? app.jobs.title_uz : app.jobs.title_ru}
                            </p>
                            <p className="text-xs text-slate-500">{app.jobs.company_name}</p>
                          </div>
                        ) : (
                          <Badge variant="secondary">
                            {lang === 'uz' ? 'O\'chirilgan' : 'Удалена'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-500">
                        {formatDate(app.created_at, lang)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedApp(app)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lang === 'uz' ? 'Ariza tafsilotlari' : 'Детали заявки'}
            </DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">
                  {lang === 'uz' ? 'Ism' : 'Имя'}
                </p>
                <p className="font-medium">{selectedApp.full_name}</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">
                    {lang === 'uz' ? 'Telefon' : 'Телефон'}
                  </p>
                  <a
                    href={`tel:${selectedApp.phone}`}
                    className="flex items-center gap-1 text-sky-600 hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {selectedApp.phone}
                  </a>
                </div>
                {selectedApp.email && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Email</p>
                    <a
                      href={`mailto:${selectedApp.email}`}
                      className="flex items-center gap-1 text-sky-600 hover:underline"
                    >
                      <Mail className="w-4 h-4" />
                      {selectedApp.email}
                    </a>
                  </div>
                )}
              </div>

              {selectedApp.message && (
                <div>
                  <p className="text-sm text-slate-500 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {lang === 'uz' ? 'Xabar' : 'Сообщение'}
                  </p>
                  <p className="text-sm bg-slate-50 p-3 rounded-lg">{selectedApp.message}</p>
                </div>
              )}

              {selectedApp.jobs && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500 mb-1">
                    {lang === 'uz' ? 'Vakansiya' : 'Вакансия'}
                  </p>
                  <Link
                    href={`/jobs/${selectedApp.jobs.id}`}
                    className="text-sky-600 hover:underline"
                  >
                    {lang === 'uz' ? selectedApp.jobs.title_uz : selectedApp.jobs.title_ru}
                  </Link>
                  <p className="text-sm text-slate-500">{selectedApp.jobs.company_name}</p>
                </div>
              )}

              <div className="text-xs text-slate-400">
                {formatDate(selectedApp.created_at, lang)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
