'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { supabase } from '@/lib/supabase';
import { JobMap } from '@/components/map/job-map';
import { JobCard } from '@/components/jobs/job-card';
import { JobWithRelations } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Loader2 } from '@/components/ui/icons';

export default function MapPage() {
  const { lang, t } = useLanguage();
  const [jobs, setJobs] = useState<JobWithRelations[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*, categories(*), districts(*), regions(*)')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false });

    setJobs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-white relative z-10">
            <MapPin className="w-7 h-7" />
            {t.map.title}
          </h1>
          <p className="text-sky-100 mt-1">
            {lang === 'uz'
              ? `${jobs.length} ta vakansiya xaritada ko'rsatilgan`
              : `${jobs.length} вакансий показано на карте`}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <JobMap
              jobs={jobs}
              selectedJobId={selectedJob?.id}
              onJobSelect={setSelectedJob}
              height="calc(100vh - 250px)"
            />
          </div>

          <div className="hidden lg:block">
            <Card className="h-[calc(100vh-250px)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {lang === 'uz' ? 'Vakansiyalar ro\'yxati' : 'Список вакансий'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-350px)] px-4">
                  <div className="space-y-3 pb-4">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className={`cursor-pointer transition-all ${selectedJob?.id === job.id
                            ? 'ring-2 ring-sky-500 ring-offset-2 rounded-lg'
                            : ''
                          }`}
                        onClick={() => setSelectedJob(job)}
                      >
                        <JobCard job={job} />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
