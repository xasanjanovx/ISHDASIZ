"use client";
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { vacancyNoun } from '@/lib/home-format';
import type { Category } from '@/types/database';
import { useHomeOverview } from './home-overview-provider';
import { SectionHeading } from './section-heading';
import { ProfessionArtwork } from './profession-artwork';
import styles from './home-sections.module.css';

export function CategoriesSection({ categories, jobCounts }: { categories: Category[]; jobCounts: Record<string, number | null> }) {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const overview = useHomeOverview();
  const counts = overview?.categoryCounts || jobCounts;
  return <section className={`${styles.section} ${styles.directions}`} id="directions">
    <div className={styles.shell}>
      <SectionHeading kicker={ru ? 'ВАШЕ НАПРАВЛЕНИЕ' : 'SIZNING YO‘NALISHINGIZ'} title={ru ? 'Каждой профессии — своё место.' : 'Har bir kasbning o‘z o‘rni bor.'} description={ru ? 'Выберите сферу и найдите подходящие предложения.' : 'Sohani tanlang va sizga mos takliflarni toping.'} />
      <div className={styles.categoryGrid}>
        {categories.map(category => <Link key={category.id} href={`/jobs?category=${category.id}`} className={styles.category} data-home-reveal>
          <div className={styles.categoryTop}><ProfessionArtwork kind={category.icon} /><ArrowUpRight aria-hidden="true" /></div>
          <h3>{ru ? category.name_ru || category.name_uz : category.name_uz}</h3>
          <div className={styles.categoryCount}><strong>{counts[category.id]?.toLocaleString('ru-RU') ?? '—'}</strong><span>{vacancyNoun(counts[category.id], ru)}</span></div>
        </Link>)}
      </div>
      <p className={styles.countNote}><i aria-hidden="true" />{ru ? 'Количество за всё время. В поиске — открытые предложения.' : 'Barcha vaqt bo‘yicha jami. Qidiruvda ochiq takliflar ko‘rsatiladi.'}</p>
    </div>
  </section>;
}
