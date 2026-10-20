import type { SupabaseClient } from '@supabase/supabase-js';
import { PROMOTION_PLANS } from '@/lib/promotion-plans';
import { callTelegramAPI } from './telegram-api';
import { E } from './premium-emoji-config';

type Audience = { botUsers: number | null; channelMembers: number | null };
let cached: { value: Audience; until: number } | null = null;
let pending: Promise<Audience> | null = null;
export function employerTariffAudience(client: SupabaseClient): Promise<Audience> {
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
  if (!pending) pending = (async () => {
    const [users, members] = await Promise.allSettled([
      client.from('telegram_sessions').select('telegram_user_id', { count: 'exact', head: true }).abortSignal(AbortSignal.timeout(6000)),
      callTelegramAPI<number>('getChatMemberCount', { chat_id: '@ishdasiz' }, { timeoutMs: 6000, singleAttempt: true }),
    ]);
    const value = { botUsers: users.status === 'fulfilled' && !users.value.error ? users.value.count : null,
      channelMembers: members.status === 'fulfilled' && Number.isSafeInteger(members.value) && members.value >= 0 ? members.value : null };
    cached = { value, until: Date.now() + (value.botUsers === null || value.channelMembers === null ? 30000 : 30 * 60000) };
    return value;
  })().finally(() => { pending = null; });
  return pending;
}
export function formatEmployerTariffs(lang: 'ru' | 'uz', audience: Audience) {
  const ru = lang === 'ru';
  const ce = (id: string, fallback: string) => `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
  const number = (value: number | null) => value == null ? '—' : value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  const rows = (group: string) => PROMOTION_PLANS.filter(plan => plan.group === group).map(plan => {
    const duration = group === 'monthly' ? (ru ? '1 месяц' : '1 oy') : group === 'broadcast' ? (ru ? '1 регион' : '1 ta hudud') : ru ? `${plan.days} ${plan.days === 1 ? 'день' : plan.days < 5 ? 'дня' : 'дней'}` : `${plan.days} kun`;
    return `${duration} — <b>${number(plan.price)} ${ru ? 'сум' : 'so‘m'}</b>`;
  }).join('\n');
  return [
    `${ce(E.briefcase, '💼')} <b>ISHDASIZ — ${ru ? 'сотрудники для вашей команды' : 'jamoangizga mos xodimlar'}</b>`,
    `${ce(E.group, '👥')} @ishdasiz: <b>${number(audience.channelMembers)}</b> ${ru ? 'подписчиков' : 'obunachi'}\n${ce(E.bot, '🤖')} @ishdasizbot: <b>${number(audience.botUsers)}</b> ${ru ? 'пользователей' : 'foydalanuvchi'}`,
    `${ce(E.globe, '🌐')} <b>${ru ? 'На ishdasiz.uz — бесплатно' : 'ishdasiz.uz saytida — bepul'}</b>\n${ru ? 'Размещайте вакансии на сайте и смотрите подходящие открытые резюме.' : 'Saytda vakansiya joylang va mos ochiq rezyumelarni ko‘ring.'}`,
    `${ce(E.send, '📢')} <b>${ru ? 'Вакансия в основном канале' : 'Asosiy kanalda vakansiya'}</b>\n${rows('standard')}`,
    `${ce(E.star, '🌟')} <b>${ru ? 'VIP: оформление + закреп' : 'VIP: yorqin dizayn + zakrep'}</b>\n${rows('vip')}`,
    `${ce(E.target, '🎯')} <b>${ru ? 'Рассылка по региону' : 'Hudud bo‘yicha xabar'}</b>\n${rows('broadcast')}\n${ru ? 'Для пользователей, подписанных на предложения. Аудитория согласуется заранее.' : 'Ish takliflariga obuna bo‘lgan foydalanuvchilarga. Auditoriya oldindan kelishiladi.'}`,
    `${ce(E.rocket, '🚀')} <b>${ru ? 'Неограниченные объявления' : 'Cheksiz e’lonlar'}</b>\n${rows('monthly')}\n${ru ? 'Формат и график публикаций согласуйте с администратором.' : 'E’lon shakli va jadvalini administrator bilan kelishing.'}`,
    `${ce(E.hr, '🤝')} <b>${ru ? 'Заявки и оплата:' : 'Murojaat va to‘lov:'}</b> @ishdasiz_admin\n${ru ? 'Сначала согласуем вакансию, тариф и время, затем администратор предоставит реквизиты.' : 'Avval vakansiya, tarif va vaqtni kelishamiz. So‘ng administrator to‘lov rekvizitlarini yuboradi.'}`,
  ].join('\n\n');
}
