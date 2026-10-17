"use client";
import Link from 'next/link';
import { GraduationCap, Accessibility, Users, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { vacancyNoun } from '@/lib/home-format';
import { useHomeOverview } from './home-overview-provider';
import { SectionHeading } from './section-heading';
import styles from './home-sections.module.css';

export function SpecialCategoriesSection({ counts }: { counts: { students: number | null; disabled: number | null; women: number | null } }) {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const overview = useHomeOverview();
  const totals = overview?.specialCounts || counts;
  const categories = [
    { id: 'students' as const, Icon: GraduationCap, title: ru ? 'Студентам и выпускникам' : 'Talaba va bitiruvchilarga', text: ru ? 'Первые шаги в профессии и новые возможности.' : 'Kasbdagi ilk qadamlar va yangi imkoniyatlar.' },
    { id: 'disabled' as const, Icon: Accessibility, title: ru ? 'Людям с инвалидностью' : 'Nogironligi bor shaxslarga', text: ru ? 'Предложения с отметкой о доступности работы.' : 'Ishga joylashish imkoniyati belgilangan takliflar.' },
    { id: 'women' as const, Icon: Users, title: ru ? 'Работа для женщин' : 'Ayollar uchun ish', text: ru ? 'Выберите сферу, сравните условия и начните.' : 'Sohani tanlang, shartlarni solishtiring va boshlang.' },
  ];
  return <section className={`${styles.section} ${styles.opportunities}`} id="opportunities"><div className={styles.shell}>
    <SectionHeading kicker={ru ? 'ВОЗМОЖНОСТИ РЯДОМ' : 'IMKONIYATLAR YAQINDA'} title={ru ? 'Ваш путь может начаться здесь.' : 'Sizning yo‘lingiz shu yerdan boshlanadi.'} />
    <div className={styles.opportunityGrid}>{categories.map(({ id, Icon, title, text }) => <Link key={id} href={`/jobs?special=${id}`} className={styles.opportunity} data-kind={id} data-home-reveal>
      <div className={styles.opportunityTop}><span className={styles.opportunityIcon}><Icon size={25} aria-hidden="true" /></span><span><ArrowUpRight size={17} aria-hidden="true" /></span></div>
      <h3>{title}</h3><p>{text}</p><div className={styles.opportunityCount}><strong>{totals[id]?.toLocaleString('ru-RU') ?? '—'}</strong><span>{ru ? `${vacancyNoun(totals[id], true)} за всё время` : 'jami vakansiya'}</span></div>
    </Link>)}</div>
  </div></section>;
}
