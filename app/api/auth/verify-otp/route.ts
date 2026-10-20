import { NextResponse } from 'next/server';
import { otpStore } from '@/lib/otp-store';
import { ensureProfile, getAuthClient, getPublicUser, normalizePhone, readAuthUser, SESSION_COOKIE, setAuthCookie } from '@/lib/auth/server';

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const phone = normalizePhone(body?.phone);
    const code = typeof body?.code === 'string' ? body.code.replace(/\s/g, '') : body?.code;
    const role = body?.role || 'job_seeker';
    if (!phone || typeof code !== 'string' || !/^\d{5}$/.test(code) || !['job_seeker', 'employer'].includes(role)) {
        return NextResponse.json({ error: 'Telefon, kod yoki rol noto‘g‘ri.' }, { status: 400 });
    }
    try {
        const client = getAuthClient();
        const { data: otp, error } = await client.from('otp_codes').select('id, code, attempts, expires_at')
            .eq('phone', phone).eq('verified', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error && process.env.NODE_ENV === 'production') throw new Error('Could not read OTP');
        let verified = false;
        if (otp) {
            const expiresAt = new Date(otp.expires_at).getTime();
            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                return NextResponse.json({ error: 'Kod muddati tugagan. Yangi SMS oling.', errorCode: 'otp_expired' }, { status: 400 });
            }
            if (Number(otp.attempts || 0) >= 3) {
                return NextResponse.json({ error: 'Urinishlar tugadi. Yangi SMS oling.', errorCode: 'otp_attempts_exhausted' }, { status: 429 });
            }
            if (String(otp.code) !== code) {
                const { error: attemptError } = await client.from('otp_codes').update({ attempts: Number(otp.attempts || 0) + 1 }).eq('id', otp.id);
                if (attemptError) throw new Error('Could not save OTP attempt');
                return NextResponse.json({ error: 'Kod noto‘g‘ri.', errorCode: 'otp_invalid' }, { status: 400 });
            }
            const { data: consumed, error: consumeError } = await client.from('otp_codes').update({ verified: true })
                .eq('id', otp.id).eq('verified', false).select('id').maybeSingle();
            if (consumeError) throw new Error('Could not consume OTP');
            verified = !!consumed;
        } else if (process.env.NODE_ENV !== 'production') {
            const local = otpStore.get(phone);
            if (local && local.expires_at > Date.now() && local.attempts < 3) {
                if (local.code !== code) {
                    otpStore.incrementAttempts(phone);
                    return NextResponse.json({ error: 'Kod noto‘g‘ri.', errorCode: 'otp_invalid' }, { status: 400 });
                }
                otpStore.delete(phone);
                verified = true;
            }
        }
        if (!verified) return NextResponse.json({ error: 'Kod topilmadi yoki ishlatilgan. Yangi SMS oling.', errorCode: 'otp_missing' }, { status: 400 });
        const { data: existing, error: findError } = await readAuthUser(client, 'id, phone, is_verified, password_hash', 'phone', phone);
        if (findError) throw new Error('Could not load user');
        let user = existing;
        if (!user) {
            const { data, error: insertError } = await client.from('users').insert({ phone, role, is_verified: true, verified_via: 'sms' })
                .select('id, phone, is_verified, password_hash').single();
            if (insertError || !data) throw new Error('Could not create user');
            user = data;
        }
        if (user.closed_at) {
            const response = NextResponse.json({ success: true, needsRestoration: true }, { headers: { 'Cache-Control': 'no-store' } });
            response.cookies.delete(SESSION_COOKIE);
            return setAuthCookie(response, user, 'password');
        }
        await ensureProfile(client, user, role);
        const response = NextResponse.json({ success: true, hasPassword: !!user.password_hash, user: await getPublicUser(client, user, role) });
        return setAuthCookie(setAuthCookie(response, user, 'password'), user);
    } catch (error) {
        console.error('OTP verification failed:', error);
        return NextResponse.json({ error: 'Tasdiqlashda xatolik. Qayta urinib ko‘ring.' }, { status: 500 });
    }
}
