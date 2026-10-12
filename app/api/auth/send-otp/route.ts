import { NextResponse } from 'next/server';
import { generateOTP, sendSMS, getSMSText, isSmsDevMode } from '@/lib/eskiz';
import { otpStore } from '@/lib/otp-store';
import { getAuthClient, normalizePhone } from '@/lib/auth/server';

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const phone = normalizePhone(body?.phone);
    if (!phone) return NextResponse.json({ error: 'Telefon raqami noto‘g‘ri.' }, { status: 400 });
    if (process.env.NODE_ENV === 'production' && (!process.env.ESKIZ_EMAIL || !process.env.ESKIZ_PASSWORD)) {
        return NextResponse.json({ error: 'SMS xizmati vaqtincha ishlamayapti.' }, { status: 503 });
    }
    try {
        const client = getAuthClient();
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: countError } = await client.from('otp_codes').select('id', { count: 'exact', head: true })
            .eq('phone', phone).gte('created_at', hourAgo);
        if (countError && process.env.NODE_ENV === 'production') throw new Error('Could not check SMS limit');
        if ((count || 0) >= 5) return NextResponse.json({ error: 'SMS limiti: soatiga 5 ta.' }, { status: 429 });
        const { data: latest } = await client.from('otp_codes').select('created_at').eq('phone', phone)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (latest && Date.now() - new Date(latest.created_at).getTime() < 60000) {
            return NextResponse.json({ error: 'Yangi SMS olish uchun 60 soniya kuting.' }, { status: 429 });
        }
        const code = generateOTP();
        const { data: saved, error } = await client.from('otp_codes').insert({ phone, code,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0, verified: false }).select('id').single();
        if (error) {
            if (process.env.NODE_ENV === 'production') throw new Error('Could not save OTP');
            otpStore.save(phone, code);
        }
        const result = await sendSMS(phone, getSMSText(code));
        if (!result.success) {
            if (saved) await client.from('otp_codes').delete().eq('id', saved.id);
            otpStore.delete(phone);
            return NextResponse.json({ error: 'SMS yuborilmadi. Qayta urinib ko‘ring.' }, { status: 502 });
        }
        // An older SMS must not remain valid after a resend.
        if (saved) await client.from('otp_codes').update({ verified: true }).eq('phone', phone).neq('id', saved.id).eq('verified', false);
        return NextResponse.json({ success: true, ...(isSmsDevMode() ? { dev_code: code } : {}) });
    } catch (error) {
        console.error('Send OTP failed:', error);
        return NextResponse.json({ error: 'SMS xizmati vaqtincha ishlamayapti.' }, { status: 503 });
    }
}
