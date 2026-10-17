'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Home, Briefcase, FileText, MapPin, ArrowUpRight, Heart, Send, MessageCircle, User, LogIn, LogOut, BarChart3, Plus } from 'lucide-react';
import { SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/language-context';
import { useUserAuth } from '@/contexts/user-auth-context';
import { useAuth } from '@/contexts/auth-context';
import { useAuthModal } from '@/contexts/auth-modal-context';
import { ActionLabel } from '@/components/ui/action-label';
import styles from './mobile-menu.module.css';
import { toast } from 'sonner';

export function MobileMenuContent({ variant, onClose }: { variant: 'quick' | 'all'; onClose: () => void }) {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  const { user, isAuthenticated, logout } = useUserAuth();
  const { user: admin, adminProfile, signOut } = useAuth();
  const { openModal } = useAuthModal();
  const isAdmin = !!admin && !!adminProfile;
  const leave = async () => {
    try { if (isAdmin) await signOut(); else await logout(); onClose(); }
    catch { toast.error(ru ? 'Не удалось выйти. Попробуйте ещё раз.' : 'Chiqib bo‘lmadi. Qayta urinib ko‘ring.'); }
  };
  const profile = isAdmin ? '/admin' : user?.active_role === 'employer' ? '/profile/employer' : '/profile/job-seeker';
  const add = isAdmin ? '/admin/jobs/new' : user?.active_role === 'employer' ? '/profile/employer/vacancies/new' : '/profile/job-seeker/resumes/new';
  const authenticate = () => { onClose(); openModal(); };
  const links = variant === 'quick' ? [
    { href: '/jobs', icon: Briefcase, label: ru ? 'Найти работу' : 'Ish topish', note: ru ? 'Профессия, зарплата, регион' : 'Kasb, maosh va hudud' },
    { href: '/map', icon: MapPin, label: ru ? 'Работа рядом' : 'Yaqin atrofdagi ish', note: ru ? 'Вакансии на карте' : 'Xaritadagi vakansiyalar' },
  ] : [
    { href: '/', icon: Home, label: ru ? 'Главная' : 'Bosh sahifa', note: ru ? 'Все возможности' : 'Barcha imkoniyatlar' },
    { href: '/jobs', icon: Briefcase, label: ru ? 'Вакансии' : 'Vakansiyalar', note: ru ? 'Найдите свою работу' : 'O‘zingizga mos ish' },
    { href: '/resumes', icon: FileText, label: ru ? 'Резюме' : 'Rezyumelar', note: ru ? 'Познакомьтесь с кандидатами' : 'Nomzodlar bilan tanishing' },
    { href: '/map', icon: MapPin, label: ru ? 'Работа на карте' : 'Xaritadagi ishlar', note: ru ? 'В вашем городе' : 'Sizning shahringizda' },
    { href: '/stats', icon: BarChart3, label: ru ? 'Статистика' : 'Statistika', note: ru ? 'Платформа в цифрах' : 'Platforma raqamlarda' },
  ];
  return <div className={styles.content} data-menu-variant={variant}>
    <Link href="/" onClick={onClose} className={styles.logo}><Image src="/ishda1.webp" alt="ISHDASIZ" width={930} height={310} /></Link>
    <div className={styles.heading}><span><i />{ru ? 'ВАШ СЛЕДУЮЩИЙ ШАГ' : 'SIZNING KEYINGI QADAMINGIZ'}</span><SheetTitle>{variant === 'quick' ? (ru ? 'Начнём с главного.' : 'Muhimidan boshlaymiz.') : (ru ? 'Меню' : 'Menu')}</SheetTitle><SheetDescription>{variant === 'quick' ? (ru ? 'Найти работу или рассказать о себе.' : 'Ish toping yoki o‘zingiz haqingizda ayting.') : (ru ? 'Работа, люди и ваши возможности.' : 'Ish, insonlar va imkoniyatlaringiz.')}</SheetDescription></div>
    <nav className={styles.links} aria-label={ru ? 'Разделы сайта' : 'Sayt bo‘limlari'}>{links.map(item => <Link key={item.href} href={item.href} onClick={onClose}><span className={styles.linkIcon}><item.icon size={21} /></span><span><strong>{item.label}</strong><small>{item.note}</small></span><ArrowUpRight size={16} /></Link>)}</nav>
    {variant === 'quick' && <Link href={add} className={styles.create} onClick={event => { if (!isAuthenticated && !isAdmin) { event.preventDefault(); authenticate(); } else onClose(); }}><Plus size={20} />{ru ? 'Разместить объявление' : 'E’lon joylash'}<ArrowUpRight size={17} /></Link>}
    {variant === 'all' && isAuthenticated && <Link href="/profile/job-seeker/favorites" className={styles.create} onClick={onClose}><Heart size={19} />{ru ? 'Избранные вакансии' : 'Saqlangan vakansiyalar'}<ArrowUpRight size={17} /></Link>}
    <div className={styles.telegram}><span><Send size={20} /><strong>{ru ? 'В Telegram ещё проще' : 'Telegram’da yanada oson'}</strong></span><a href="https://t.me/ishdasizbot" target="_blank" rel="noopener noreferrer" onClick={onClose}>{ru ? 'Открыть бота' : 'Botni ochish'}<ArrowUpRight size={17} /></a>{variant === 'all' && <a href="https://t.me/ishdasiz" target="_blank" rel="noopener noreferrer" onClick={onClose}>{ru ? 'Канал вакансий' : 'Vakansiyalar kanali'}<ArrowUpRight size={17} /></a>}</div>
    <div className={styles.bottom}>{isAuthenticated || isAdmin ? <><Link href={profile} className={styles.login} onClick={onClose}><User size={19} />{ru ? 'Мой профиль' : 'Mening profilim'}</Link><button type="button" className={styles.logout} onClick={leave}><LogOut size={17} />{ru ? 'Выйти' : 'Chiqish'}</button></> : <button type="button" className={styles.login} onClick={authenticate}><LogIn className="sr-only" /><ActionLabel>{ru ? 'Войти в профиль' : 'Profilga kirish'}</ActionLabel></button>}<a href="https://t.me/ishdasiz_admin" target="_blank" rel="noopener noreferrer" onClick={onClose}><MessageCircle size={17} />{ru ? 'Нужна помощь?' : 'Yordam kerakmi?'}<ArrowUpRight size={14} /></a></div>
  </div>;
}
