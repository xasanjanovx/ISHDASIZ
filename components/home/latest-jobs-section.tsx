"use client";
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, MapPin, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { formatSalary } from '@/lib/constants';
import { vacancyNoun } from '@/lib/home-format';
import { normalizeLocation } from '@/lib/text';
import type { HomeJob } from '@/lib/home-data';
import { SectionHeading } from './section-heading';
import { ProfessionArtwork } from './profession-artwork';
import styles from './home-sections.module.css';

export function LatestJobsSection({ jobs, unavailable }: { jobs: HomeJob[]; unavailable?: boolean }) {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const [expanded, setExpanded] = useState(false);
  return <section className={`${styles.section} ${styles.jobs}`} id="latest-jobs"><div className={styles.shell}>
    <SectionHeading kicker={ru ? 'НОВЫЕ ВОЗМОЖНОСТИ' : 'YANGI IMKONIYATLAR'} title={ru ? 'Свежие вакансии.' : 'Yangi vakansiyalar.'} description={ru ? 'Свежие предложения. Профессия, зарплата и место — всё перед вами.' : 'Yangi takliflar. Kasb, maosh va ish joyi — barchasi ko‘z oldingizda.'} href="/jobs" action={ru ? 'Все вакансии' : 'Barcha vakansiyalar'} />
    {!jobs.length && <div className={styles.empty}>{unavailable ? (ru ? 'Не удалось загрузить вакансии. Попробуйте позже.' : 'Vakansiyalar yuklanmadi. Keyinroq urinib ko‘ring.') : (ru ? 'Новые предложения скоро появятся.' : 'Yangi takliflar tez orada paydo bo‘ladi.')}</div>}
    <div className={styles.jobGrid} id="home-job-previews" data-expanded={expanded}>{jobs.map(job => {
      const title = ru ? job.title_ru || job.title_uz : job.title_uz || job.title_ru;
      const region = job.districts?.regions;
      const location = normalizeLocation(ru ? region?.name_ru || job.region_name : region?.name_uz || job.region_name);
      const category = ru ? job.categories?.name_ru : job.categories?.name_uz;
      return <Link href={`/jobs/${job.id}`} key={job.id} className={styles.jobCard} data-home-reveal>
        <div className={styles.jobTop}><ProfessionArtwork kind={job.categories?.icon} small /><span>{category || (ru ? 'Вакансия' : 'Vakansiya')}</span><ArrowUpRight size={16} aria-hidden="true" /></div>
        <h3>{title}</h3><p className={styles.company}>{job.company_name}</p>
        <div className={styles.salary}><span>{ru ? 'Оплата' : 'Maosh'}</span><strong>{formatSalary(job.salary_min, job.salary_max, lang)}</strong></div>
        <div className={styles.jobBottom}><span className={styles.jobLocation}><MapPin size={13} aria-hidden="true" />{location || (ru ? 'Узбекистан' : 'O‘zbekiston')}</span><span className={styles.jobOpen}>{ru ? 'Подробнее' : 'Batafsil'}<ArrowRight size={15} aria-hidden="true" /></span></div>
      </Link>;
    })}</div>
    {jobs.length > 3 && <button type="button" className={`${styles.textLink} ${styles.moreJobs}`} aria-controls="home-job-previews" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? (ru ? 'Свернуть' : 'Yig‘ish') : (ru ? `Ещё ${jobs.length - 3} ${vacancyNoun(jobs.length - 3, true)}` : `Yana ${jobs.length - 3} ta vakansiya`)}<ArrowRight size={16} aria-hidden="true" /></button>}
  </div></section>;
}
