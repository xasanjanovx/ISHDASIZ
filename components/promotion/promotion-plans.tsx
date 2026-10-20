"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Send, Crown, Radio, Infinity as InfinityIcon, Users, Copy, Check, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { PROMOTION_PLANS } from '@/lib/promotion-plans';
import styles from './promotion-plans.module.css';

export function PromotionPlans({ vacancyId }: { vacancyId?: string }) {
  const { lang } = useLanguage(), ru = lang === 'ru';
  const [selected, setSelected] = useState<string>('standard_1'), [copied, setCopied] = useState(false);
  const [audience, setAudience] = useState<{ botUsers: number | null; channelMembers: number | null } | null>(null);
  const text = (r: string, u: string) => ru ? r : u;
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/telegram/audience', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (!controller.signal.aborted) setAudience(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const groups = [
    { id: 'standard', Icon: Send, title: text('Вакансия в @ishdasiz', '@ishdasiz kanalida vakansiya'), description: text('Размещение вакансии в основном канале на выбранный срок.', 'Vakansiyangiz asosiy kanalda tanlangan muddatga joylashtiriladi.') },
    { id: 'vip', Icon: Crown, title: text('VIP: заметно и с закрепом', 'VIP: yorqin e’lon va zakrep'), description: text('Выделенное оформление и закрепление в канале. Детали согласуйте с администратором.', 'Alohida dizayn va kanalda yuqoriga qadab qo‘yish. Tafsilotlar administrator bilan kelishiladi.') },
    { id: 'broadcast', Icon: Radio, title: text('Сообщение по региону', 'Hudud bo‘yicha xabar'), description: text('Одна согласованная рассылка пользователям выбранного региона, подписанным на предложения.', 'Ish takliflariga obuna bo‘lgan foydalanuvchilarga tanlangan bitta hudud bo‘yicha kelishilgan xabar.') },
    { id: 'monthly', Icon: InfinityIcon, title: text('Месяц без ограничений', 'Bir oylik cheksiz paket'), description: text('Неограниченное число объявлений в течение месяца. Формат и график — по согласованию.', 'Bir oy davomida cheksiz e’lonlar. E’lon shakli va jadvali kelishiladi.') },
  ];
  const plan = PROMOTION_PLANS.find(item => item.id === selected)!;
  const group = groups.find(item => item.id === plan.group)!;
  const duration = (item: typeof PROMOTION_PLANS[number]) => item.group === 'broadcast' ? text('1 регион', '1 ta hudud') : item.group === 'monthly' ? text('1 месяц', '1 oy') : text(`${item.days} ${item.days === 1 ? 'день' : item.days < 5 ? 'дня' : 'дней'}`, `${item.days} kun`);
  const money = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  async function copy() {
    try {
      await navigator.clipboard.writeText(`ISHDASIZ — ${group.title}\n${duration(plan)} · ${money(plan.price)} so‘m${vacancyId ? `\nhttps://ishdasiz.uz/jobs/${vacancyId}` : ''}`);
      setCopied(true);
    } catch { setCopied(false); }
  }
  return <section className={styles.page}><div className={styles.shell}>
    <div className={styles.heading}><span>ISHDASIZ · TELEGRAM</span><h1>{text('Вашу вакансию должны заметить.', 'Vakansiyangiz e’tiborda bo‘lsin.')}</h1><p>{text('На сайте — бесплатно. Для продвижения в основном канале @ishdasiz выберите тариф и обратитесь к администратору.', 'Saytda — bepul. Asosiy @ishdasiz kanalida targ‘ib qilish uchun tarifni tanlang va administratorga yozing.')}</p></div>
    <div className={styles.audience}><span><Users size={20} /><strong>{money(audience?.channelMembers)}</strong>{text('в канале', 'kanal obunachisi')}</span><span><Send size={19} /><strong>{money(audience?.botUsers)}</strong>{text('пользователей бота', 'bot foydalanuvchisi')}</span></div>
    <div className={styles.grid}>{groups.map(({ id, Icon, title, description }) => <article key={id} className={styles.card}><Icon aria-hidden="true" /><h2>{title}</h2><p>{description}</p><div className={styles.options}>{PROMOTION_PLANS.filter(item => item.group === id).map(item => <button type="button" key={item.id} className={styles.option} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setCopied(false); }}><span>{duration(item)}</span><strong>{money(item.price)} {text('сум', 'so‘m')}</strong></button>)}</div></article>)}</div>
    <div className={styles.request}><div><h2>{group.title} · {money(plan.price)} {text('сум', 'so‘m')}</h2><p>{text('Администратор подтвердит возможность размещения, реквизиты и срок. Заявка сама по себе не является оплатой.', 'Administrator joylashtirish imkoniyati, to‘lov rekvizitlari va muddatini tasdiqlaydi. Murojaatning o‘zi to‘lov hisoblanmaydi.')}</p></div><div className={styles.actions}><button type="button" onClick={() => void copy()}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? text('Скопировано', 'Nusxalandi') : text('Скопировать заявку', 'Murojaatni nusxalash')}</button><a href="https://t.me/ishdasiz_admin" target="_blank" rel="noopener noreferrer">{text('Написать администратору', 'Administratorga yozish')}<ArrowUpRight size={18} /></a></div></div>
    {!vacancyId && <div className={styles.free}><strong>{text('На сайте размещение вакансий бесплатное.', 'Saytda vakansiya joylashtirish bepul.')}</strong><Link href="/start/employer">{text('Разместить вакансию', 'Vakansiya joylashtirish')} ↗</Link></div>}
  </div></section>;
}
