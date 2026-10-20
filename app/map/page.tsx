"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/language-context";
import { accountApi } from "@/lib/account-api";
import { JobMap } from "@/components/map/job-map";
import { JobCard } from "@/components/jobs/job-card";
import { JobWithRelations } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Loader2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { UZBEKISTAN_CENTER, MAP_COUNTRY_ZOOM } from "@/lib/constants";

export default function MapPage() {
  const { lang, t } = useLanguage();
  const [jobs, setJobs] = useState<JobWithRelations[]>([]);
  const [mobileList, setMobileList] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    accountApi<{ jobs: JobWithRelations[]; total: number }>(`/api/map/jobs?page=${page}`, {
      signal: controller.signal,
    })
      .then(({ jobs: rows, total: count }) => {
        if (cancelled) return;
        if (!Array.isArray(rows) || !Number.isSafeInteger(count) || count < 0) {
          setError(true);
          return;
        }
        setJobs((previous) =>
          page === 0
            ? rows
            : Array.from(
                new Map(
                  [...previous, ...rows].map((job) => [job.id, job]),
                ).values(),
              ),
        );
        setTotal(count);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [page, attempt]);

  if (loading && jobs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          role="status"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          {lang === "uz" ? "Vakansiyalar yuklanmoqda…" : "Загрузка вакансий…"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary to-primary text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 text-white relative z-10">
            <MapPin className="w-7 h-7" />
            {t.map.title}
          </h1>
          <p className="text-primary-foreground mt-1">
            {error && jobs.length === 0
              ? lang === "uz"
                ? "Vakansiyalar vaqtincha mavjud emas"
                : "Вакансии временно недоступны"
              : lang === "uz"
                ? `${jobs.length}${total !== null ? ` / ${total}` : ""} ta vakansiya yuklangan`
                : `Загружено ${jobs.length}${total !== null ? ` из ${total}` : ""} вакансий`}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {error && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {lang === "uz"
              ? "Vakansiyalarni yuklab bo‘lmadi."
              : "Не удалось загрузить вакансии."}
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              {lang === "uz" ? "Qayta urinish" : "Повторить"}
            </Button>
          </div>
        )}
        {!error && !loading && total === 0 && (
          <p role="status" className="mb-4 text-muted-foreground">
            {lang === "uz"
              ? "Xaritada ko‘rsatish uchun koordinatali vakansiyalar topilmadi."
              : "Вакансий с корректными координатами пока нет."}
          </p>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedJob && (
            <Button variant="outline" onClick={() => setSelectedJob(null)}>
              {lang === "uz" ? "Butun O‘zbekiston" : "Весь Узбекистан"}
            </Button>
          )}
          {total !== null && jobs.length < total && !error && (
            <Button
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setPage((value) => value + 1);
              }}
            >
              {loading
                ? lang === "uz"
                  ? "Yuklanmoqda…"
                  : "Загрузка…"
                : lang === "uz"
                  ? "Yana yuklash"
                  : "Загрузить ещё"}
            </Button>
          )}
        </div>
        <div className="mb-5 flex gap-2 lg:hidden" role="group" aria-label={lang === 'ru' ? 'Вид вакансий' : 'Vakansiyalar ko‘rinishi'}>
          <Button className="h-12 flex-1 rounded-full text-base" variant={mobileList ? 'outline' : 'default'} aria-pressed={!mobileList} onClick={() => setMobileList(false)}>{lang === 'ru' ? 'Карта' : 'Xarita'}</Button>
          <Button className="h-12 flex-1 rounded-full text-base" variant={mobileList ? 'default' : 'outline'} aria-pressed={mobileList} onClick={() => setMobileList(true)}>{lang === 'ru' ? 'Список' : 'Ro‘yxat'}</Button>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className={mobileList ? "hidden lg:block lg:col-span-2" : "lg:col-span-2"}>
            <JobMap
              jobs={jobs}
              selectedJobId={selectedJob?.id}
              onJobSelect={setSelectedJob}
              center={
                selectedJob
                  ? { lat: selectedJob.latitude!, lng: selectedJob.longitude! }
                  : UZBEKISTAN_CENTER
              }
              zoom={selectedJob ? 12 : MAP_COUNTRY_ZOOM}
              height="clamp(320px, calc(100svh - 300px), 680px)"
            />
          </div>

          <div className={mobileList ? "block" : "hidden lg:block"}>
            <Card className="h-[calc(100vh-250px)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {lang === "uz" ? "Vakansiyalar ro'yxati" : "Список вакансий"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-350px)] px-4">
                  <div className="space-y-3 pb-4">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className={`cursor-pointer transition-all ${
                          selectedJob?.id === job.id
                            ? "ring-2 ring-primary ring-offset-2 rounded-lg"
                            : ""
                        }`}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mb-1"
                          onClick={() => { setSelectedJob(job); setMobileList(false); }}
                        >
                          {lang === "uz"
                            ? "Xaritada ko‘rsatish"
                            : "Показать на карте"}
                        </Button>
                        <JobCard job={job} compact />
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
