"use client";
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { tashkentStamp } from '@/lib/home-format';
import { useHomeOverview } from './home-overview-provider';
import { SectionHeading } from './section-heading';
import styles from './home-sections.module.css';

export function SourceTransparencySection() {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const overview = useHomeOverview();
  const source = overview?.source;
  const run = source?.run;
  const number = (value?: number | null) => value == null ? '—' : value.toLocaleString('ru-RU');
  const duration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
    return hours ? `${hours} ${ru ? 'ч' : 'soat'} ${minutes} ${ru ? 'мин' : 'daq'}` : `${Math.floor(seconds / 60)} ${ru ? 'мин' : 'daq'}`;
  };
  const stamp = tashkentStamp;
  const state = !run ? (ru ? 'Данные об обходе временно недоступны' : 'Tekshiruv ma’lumotlari vaqtincha mavjud emas')
    : run.state === 'completed' ? (ru ? 'Обход завершён' : 'Tekshiruv yakunlangan')
    : run.state === 'running' ? (ru ? 'Обновление идёт' : 'Yangilanish davom etmoqda')
    : run.state === 'retrying' ? (ru ? 'Повторяем обновление' : 'Yangilash qayta bajarilmoqda')
    : (ru ? 'Последний обход не завершён' : 'Oxirgi tekshiruv yakunlanmagan');
  return <section className={`${styles.section} ${styles.sources}`} id="vacancy-sources"><div className={styles.shell}><div className={styles.sourcePanel} data-home-reveal>
    <div className={styles.sourceTop}>
      <SectionHeading kicker={ru ? 'ОТКУДА ПРИХОДЯТ ВАКАНСИИ' : 'VAKANSIYALAR QAYERDAN KELADI'} title={ru ? 'Как мы получаем вакансии.' : 'Vakansiyalarni qanday olamiz.'} />
      <div className={styles.sourceIntro}><a href="https://osonish.uz/" target="_blank" rel="noopener noreferrer" className={styles.sourceBrand}><span aria-hidden="true">o</span>OsonIsh.uz<ArrowUpRight size={16} aria-hidden="true" /></a>
        <p>{ru ? 'Получаем предложения из открытого каталога, приводим профессию, зарплату и регион к единому виду, затем проверяем статус. В обычном поиске показываем открытые вакансии.' : 'Ochiq katalogdan takliflarni olamiz, kasb, maosh va hududni yagona ko‘rinishga keltiramiz, so‘ng holatini tekshiramiz. Qidiruvda ochiq vakansiyalar ko‘rsatiladi.'}</p>
      </div>
    </div>
    <div className={styles.sourceMetrics}>
      <div className={styles.sourceMetric}><span>{ru ? 'Получено с OsonIsh' : 'OsonIsh’dan olingan'}</span><strong>{number(source?.imported)}</strong><small>{ru ? 'За всё время, включая закрытые объявления.' : 'Barcha vaqt uchun, yopilgan e’lonlar bilan birga.'}</small></div>
      <div className={styles.sourceMetric}><span>{ru ? 'Проверено в последнем обходе' : 'Oxirgi tekshiruvda ko‘rilgan'}</span><strong>{number(run?.processed)}</strong><small>{run ? `${run.total == null ? '' : `${ru ? 'В списке' : 'Ro‘yxatda'}: ${number(run.total)} · `}${ru ? 'новых' : 'yangi'}: ${number(run.added)} · ${ru ? 'обновлено' : 'yangilangan'}: ${number(run.updated)}` : (ru ? 'Покажем после получения данных.' : 'Ma’lumotlar olingach ko‘rsatiladi.')}</small></div>
      <div className={styles.sourceMetric}><span>{ru ? 'Время последнего обхода' : 'Oxirgi tekshiruv vaqti'}</span><strong>{run ? duration(run.elapsedSeconds) : '—'}</strong><small>{run ? (run.completedAt ? `${ru ? 'Завершён' : 'Yakunlangan'}: ${stamp(run.completedAt)}` : `${ru ? 'Начат' : 'Boshlangan'}: ${stamp(run.startedAt)}`) : (ru ? 'Время по Ташкенту.' : 'Toshkent vaqti bo‘yicha.')}</small></div>
    </div>
    {run?.total != null && run.total > 0 && <div className={styles.sourceProgress} role="progressbar" aria-label={ru ? 'Проверка вакансий в последнем обходе' : 'Oxirgi tekshiruvdagi vakansiyalar'} aria-valuemin={0} aria-valuemax={run.total} aria-valuenow={Math.min(run.processed, run.total)}><span style={{ width: `${Math.min(100, run.processed / run.total * 100)}%` }} /></div>}
    <div className={styles.sourceStatus} data-state={run?.state || 'unknown'}><span><i aria-hidden="true" />{state}</span><span>{overview ? `${ru ? 'Данные на' : 'Ma’lumot vaqti'} ${stamp(overview.asOf)} · ${ru ? 'Ташкент' : 'Toshkent'}` : (ru ? 'Загружаем статистику…' : 'Statistika yuklanmoqda…')}</span></div>
    <div className={styles.sourceFlow} aria-hidden="true"><span><i />{ru ? 'Источник' : 'Manba'}</span><ArrowRight /><span><i />{ru ? 'Обработка' : 'Tartiblash'}</span><ArrowRight /><span><i />{ru ? 'Проверка статуса' : 'Holatni tekshirish'}</span><ArrowRight /><span><i />ISHDASIZ</span></div>
  </div></div></section>;
}
