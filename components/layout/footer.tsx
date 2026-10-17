'use client';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ArrowUp, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import styles from './footer.module.css';
import { ActionLabel } from '@/components/ui/action-label';
export function Footer() {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  return <footer className={styles.footer}>
    <div className={styles.shell}>
      <div className={styles.invitation}><div><span><i aria-hidden="true" />{ru ? 'ВАШ СЛЕДУЮЩИЙ ШАГ' : 'SIZNING KEYINGI QADAMINGIZ'}</span><h2>{ru ? 'Найдите своё место.' : 'O‘z o‘rningizni toping.'}</h2></div><Link href="/jobs" className={styles.cta}><ActionLabel>{ru ? 'Начать поиск' : 'Qidirishni boshlash'}</ActionLabel></Link></div>
      <div className={styles.grid}>
        <div className={styles.brand}><Link href="/" className={styles.logo}><Image src="/ishda1.webp" alt="ISHDASIZ" width={930} height={310} sizes="170px" /></Link><p>{ru ? 'Люди, профессии и возможности. По всему Узбекистану.' : 'Insonlar, kasblar va imkoniyatlar. Butun O‘zbekiston bo‘ylab.'}</p><span className={styles.location}><i aria-hidden="true" />{ru ? 'Сделано для вашего будущего' : 'Kelajagingiz uchun yaratilgan'}</span></div>
        <nav aria-label={ru ? 'Платформа' : 'Platforma'}><h3>{ru ? 'Платформа' : 'Platforma'}</h3>{[{ href: '/jobs', label: ru ? 'Вакансии' : 'Vakansiyalar' }, { href: '/resumes', label: ru ? 'Резюме' : 'Rezyumelar' }, { href: '/map', label: ru ? 'Работа на карте' : 'Xaritada ish' }, { href: '/stats', label: ru ? 'Статистика' : 'Statistika' }].map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowUpRight size={13} aria-hidden="true" /></Link>)}</nav>
        <nav aria-label="Telegram"><h3>Telegram</h3>{[{ handle: 'ishdasizbot', label: ru ? 'Найти работу в боте' : 'Bot orqali ish topish' }, { handle: 'ishdasiz', label: ru ? 'Канал вакансий' : 'Vakansiyalar kanali' }, { handle: 'ishdasiz_admin', label: ru ? 'Поддержка' : 'Yordam' }].map(link => <a key={link.handle} href={`https://t.me/${link.handle}`} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={13} aria-hidden="true" /></a>)}</nav>
        <div className={styles.contact}><h3>{ru ? 'Остаёмся на связи' : 'Aloqada qolamiz'}</h3><a href="mailto:info@ishdasiz.uz">info@ishdasiz.uz</a><a href="https://t.me/ishdasiz_admin" target="_blank" rel="noopener noreferrer" className={styles.support}><Send size={16} aria-hidden="true" />{ru ? 'Написать команде' : 'Jamoaga yozish'}<ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </div>
      <div className={styles.bottom}><span>© {new Date().getFullYear()} ISHDASIZ <i aria-hidden="true" />{ru ? 'Узбекистан' : 'O‘zbekiston'}</span><div><Link href="/admin">Admin</Link><Link href="/#home-top">{ru ? 'В начало' : 'Yuqoriga'}<ArrowUp size={14} aria-hidden="true" /></Link></div></div>
    </div>
  </footer>;
}
