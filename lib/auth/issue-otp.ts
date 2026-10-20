import type { SupabaseClient } from '@supabase/supabase-js';
import { generateOTP, getSMSText, isSmsDevMode, sendSMS } from '@/lib/eskiz';
import { otpStore } from '@/lib/otp-store';

type Result = { status: number; body: { success?: boolean; error?: string; code?: string; dev_code?: string } };
/** One durable issuance path for the website and bot. Never return or log a real code. */
const inFlight = new Map<string, Promise<Result>>();
export function issuePhoneOtp(client: SupabaseClient, phone: string): Promise<Result> {
  const existing = inFlight.get(phone);
  if (existing) return existing;
  const pending = issue(client, phone).finally(() => { inFlight.delete(phone); });
  inFlight.set(phone, pending);
  return pending;
}
async function issue(client: SupabaseClient, phone: string): Promise<Result> {
  const development = ['development', 'test'].includes(process.env.NODE_ENV || '');
  if (!development && (!process.env.ESKIZ_EMAIL?.trim() || !process.env.ESKIZ_PASSWORD?.trim()))
    return { status: 503, body: { error: 'SMS xizmati vaqtincha ishlamayapti.', code: 'sms_unavailable' } };
  try {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count, error: countError } = await client.from('otp_codes').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', hourAgo);
    if (countError && !development) throw new Error('SMS limit unavailable');
    if ((count || 0) >= 5) return { status: 429, body: { error: 'SMS limiti: soatiga 5 ta.', code: 'sms_hour_limit' } };
    const { data: latest, error: latestError } = await client.from('otp_codes').select('created_at').eq('phone', phone).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (latestError && !development) throw new Error('SMS limit unavailable');
    if (latest && Date.now() - Date.parse(latest.created_at) < 60000)
      return { status: 429, body: { error: 'Yangi SMS olish uchun 60 soniya kuting.', code: 'sms_resend_wait' } };
    const code = generateOTP();
    const { data: saved, error } = await client.from('otp_codes').insert({ phone, code, expires_at: new Date(Date.now() + 300000).toISOString(), attempts: 0, verified: false }).select('id,created_at').single();
    if (error) { if (!development) throw new Error('SMS storage unavailable'); otpStore.save(phone, code); }
    if (saved && !Number.isFinite(Date.parse(saved.created_at))) throw new Error('SMS timestamp unavailable');
    const sent = await sendSMS(phone, getSMSText(code));
    if (!sent.success) {
      if (saved) await client.from('otp_codes').delete().eq('id', saved.id);
      otpStore.delete(phone);
      return { status: 502, body: { error: 'SMS yuborilmadi. Qayta urinib ko‘ring.', code: 'sms_delivery_failed' } };
    }
    if (saved) {
      // A slow response from an older send must never invalidate a newer code.
      const invalidated = await client.from('otp_codes').update({ verified: true }).eq('phone', phone).lt('created_at', saved.created_at).eq('verified', false);
      if (invalidated.error) throw new Error('SMS replacement unavailable');
    }
    return { status: 200, body: { success: true, ...(isSmsDevMode() ? { dev_code: code } : {}) } };
  } catch {
    return { status: 503, body: { error: 'SMS xizmati vaqtincha ishlamayapti.', code: 'sms_unavailable' } };
  }
}
