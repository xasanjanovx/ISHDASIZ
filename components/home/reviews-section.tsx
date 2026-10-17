'use client';
import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { SectionHeading } from './section-heading';
import styles from './reviews-section.module.css';
import sections from './home-sections.module.css';

// Editorial examples only. Replace with verified feedback before displaying a real rating.
const examples = [
  { uz: 'Kerakli xodimni tez topdik. Katta rahmat!', ru: 'Быстро нашли нужного сотрудника. Большое спасибо!', employer: true },
  { uz: 'Telegram botdan ish topdim, rahmat. Juda qulay ekan!', ru: 'Нашёл работу через Telegram-бота, спасибо. Очень удобно!', employer: false },
  { uz: 'Uyimga yaqin ish topdim. Qidirish juda oson bo‘ldi!', ru: 'Нашла работу рядом с домом. Искать оказалось очень просто!', employer: false },
  { uz: 'E’lon berdik, tez orada nomzodlar murojaat qilishdi. Rahmat!', ru: 'Разместили вакансию, и вскоре откликнулись кандидаты. Спасибо!', employer: true },
  { uz: 'O‘qish bilan birga ishlash uchun mos ish topdim. Katta rahmat!', ru: 'Нашёл подходящую работу, чтобы совмещать с учёбой. Большое спасибо!', employer: false },
];
export function ReviewsSection() {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  return <section id="reviews" className={`${sections.section} ${styles.section}`} aria-label={ru ? 'Примеры отзывов' : 'Fikrlar namunalari'}>
    <div className={sections.shell}><SectionHeading kicker={ru ? 'ОБРАТНАЯ СВЯЗЬ · ПРИМЕРЫ' : 'FIKR-MULOHAZA · NAMUNALAR'} title={ru ? 'У каждой работы — своя история.' : 'Har bir ishning o‘z hikoyasi bor.'} description={ru ? 'Пять примеров комментариев и оценок. Это образцы текстов, а не опубликованные отзывы пользователей.' : 'Izoh va baholarning beshta namunasi. Bular foydalanuvchilarning haqiqiy fikrlari emas, matn namunalari.'} /></div>
    <div className={styles.window}><div className={styles.track}>{[false, true].map(duplicate => <div key={String(duplicate)} className={styles.group} aria-hidden={duplicate || undefined}>{examples.map((item, index) => <article key={index} className={styles.card} data-home-reveal={duplicate ? undefined : true}>
      <div className={styles.top}><span>{item.employer ? (ru ? 'Работодатель' : 'Ish beruvchi') : (ru ? 'Соискатель' : 'Ish izlovchi')}</span><span>{ru ? 'Пример' : 'Namuna'}</span></div>
      <Quote className={styles.quote} size={24} aria-hidden="true" /><p>{ru ? item.ru : item.uz}</p>
      <div className={styles.bottom}><span className={styles.stars} role="img" aria-label={ru ? 'Пример оценки: 5 из 5' : 'Baho namunasi: 5 dan 5'}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill="currentColor" aria-hidden="true" />)}</span><span>0{index + 1} / 05</span></div>
    </article>)}</div>)}</div></div>
  </section>;
}
