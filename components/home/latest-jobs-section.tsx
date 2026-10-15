"use client";
import Link from "next/link";
import { ArrowUpRight, MapPin, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { formatSalary } from "@/lib/constants";
import { normalizeLocation } from "@/lib/text";
import type { HomeJob } from "@/lib/home-data";
export function LatestJobsSection({
  jobs,
  unavailable,
}: {
  jobs: HomeJob[];
  unavailable?: boolean;
}) {
  const { lang } = useLanguage();
  const ru = lang === "ru";
  return (
    <section className="home-latest" id="latest-jobs">
      <div className="home-section home-shell">
        <div className="home-section-heading">
          <div>
            <span className="home-eyebrow">
              {ru ? "ВАШ СЛЕДУЮЩИЙ ШАГ" : "KEYINGI QADAMINGIZ"}
            </span>
            <h2>{ru ? "Свежие предложения" : "Yangi ish takliflari"}</h2>
            <p>
              {ru
                ? "Выберите возможность, которая подходит вам."
                : "Sizga mos imkoniyatni tanlang."}
            </p>
          </div>
          <Link href="/jobs" className="home-text-link">
            {ru ? "Все вакансии" : "Barcha vakansiyalar"}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        {!jobs.length && (
          <div className="home-empty">
            {unavailable
              ? ru
                ? "Не удалось загрузить вакансии. Попробуйте позже."
                : "Vakansiyalar yuklanmadi. Keyinroq urinib ko‘ring."
              : ru
                ? "Новые предложения скоро появятся."
                : "Yangi takliflar tez orada paydo bo‘ladi."}
          </div>
        )}
        <div className="home-jobs-grid">
          {jobs.map((job, index) => {
            const title = ru
              ? job.title_ru || job.title_uz
              : job.title_uz || job.title_ru;
            const region = job.districts?.regions;
            const location = normalizeLocation(
              ru
                ? region?.name_ru || job.region_name
                : region?.name_uz || job.region_name,
            );
            const category = ru
              ? job.categories?.name_ru
              : job.categories?.name_uz;
            return (
              <Link
                href={`/jobs/${job.id}`}
                key={job.id}
                className="home-job-card"
              >
                <div className="home-job-top">
                  <span className={`home-company-mark tone-${index % 3}`}>
                    {(job.company_name || title || "I")
                      .trim()
                      .replace(/^["'«]+/, "")
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <span className="home-job-category">
                    {category || (ru ? "Вакансия" : "Vakansiya")}
                  </span>
                  <ArrowUpRight size={18} />
                </div>
                <h3>{title}</h3>
                <p className="home-job-company">{job.company_name}</p>
                <div className="home-job-salary">
                  <span className="home-job-salary-label">
                    {ru ? "Оплата" : "Maosh"}
                  </span>
                  {formatSalary(job.salary_min, job.salary_max, lang)}
                </div>
                <div className="home-job-bottom">
                  <span>
                    <MapPin size={14} />
                    {location || (ru ? "Узбекистан" : "O‘zbekiston")}
                  </span>
                  <span className="home-job-open">
                    {ru ? "Подробнее" : "Batafsil"}
                    <ArrowRight size={17} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
