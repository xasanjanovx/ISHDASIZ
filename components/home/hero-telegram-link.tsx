"use client";
import { ArrowUpRight, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';

export function HeroTelegramLink() {
  const { lang } = useLanguage();
  const ru = lang === 'ru';
  return (
    <a className="poster-telegram-link" href="https://t.me/ishdasizbot" target="_blank" rel="noopener noreferrer">
      <span className="poster-telegram-icon" aria-hidden="true"><Send size={23} /></span>
      <span className="poster-telegram-copy">
        <strong>{ru ? 'В Telegram найти работу проще' : 'Telegram’da ish topish osonroq'}</strong>
        <span>{ru ? 'Вакансии и отклики — прямо в чате.' : 'Vakansiya va arizalar — bitta chatda.'}</span>
        <span className="poster-telegram-action">{ru ? 'Открыть бота' : 'Botni ochish'}<ArrowUpRight size={14} aria-hidden="true" /></span>
      </span>
    </a>
  );
}
