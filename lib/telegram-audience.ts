import { unstable_cache } from 'next/cache';
import { getAuthClient } from '@/lib/auth/server';

type Audience = { botUsers: number | null; channelMembers: number | null; checkedAt: string };
let partial: Audience | null = null;
const cachedAudience = unstable_cache(async () => {
  const [users, channel] = await Promise.allSettled([
    getAuthClient().from('telegram_sessions').select('telegram_user_id', { head: true, count: 'exact' }).abortSignal(AbortSignal.timeout(6000)),
    (async () => {
      if (!process.env.TELEGRAM_BOT_TOKEN) return null;
      const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChatMemberCount`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: '@ishdasiz' }), cache: 'no-store', signal: AbortSignal.timeout(6000),
      });
      const data = await response.json();
      return response.ok && data.ok && Number.isSafeInteger(data.result) && data.result >= 0 ? data.result as number : null;
    })(),
  ]);
  const value = {
    botUsers: users.status === 'fulfilled' && !users.value.error && Number.isSafeInteger(users.value.count) ? users.value.count : null,
    channelMembers: channel.status === 'fulfilled' ? channel.value : null,
    checkedAt: new Date().toISOString(),
  };
  partial = value;
  if (value.botUsers === null || value.channelMembers === null) throw new Error('Audience temporarily unavailable');
  return value;
}, ['telegram-public-audience-v2', process.env.NEXT_PUBLIC_SUPABASE_URL || ''], { revalidate: 300 });

let pending: Promise<Audience> | null = null;
export function readTelegramAudience() {
  if (!pending) pending = cachedAudience().catch(() => partial || { botUsers: null, channelMembers: null, checkedAt: new Date().toISOString() }).finally(() => { pending = null; });
  return pending;
}
