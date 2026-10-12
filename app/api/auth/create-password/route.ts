import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureProfile, getAuthClient, getPublicUser, normalizePhone, OTP_COOKIE, passwordVersion, readAuthUser, setAuthCookie, verifyAuthToken } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const phone = normalizePhone(body?.phone);
    const password = body?.password;
    const role = body?.role;
    if (!phone || typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72
        || !['job_seeker', 'employer'].includes(role)) {
        return NextResponse.json({ error: 'Telefon, rol yoki parol noto‘g‘ri (6–72 bayt).' }, { status: 400 });
    }
    const proof = verifyAuthToken(request.cookies.get(OTP_COOKIE)?.value, 'password');
    if (!proof || proof.phone !== phone) {
        return NextResponse.json({ error: 'Avval SMS kodini tasdiqlang.' }, { status: 401 });
    }
    try {
        const client = getAuthClient();
        const { data: user, error } = await readAuthUser(client, 'id, phone, is_verified, password_hash', 'id', proof.userId);
        if (error || !user) return NextResponse.json({ error: 'Foydalanuvchi topilmadi.' }, { status: 404 });
        if (user.closed_at || user.phone !== phone || proof.passwordVersion !== passwordVersion(user.password_hash, user.session_version)) {
            return NextResponse.json({ error: 'Tasdiqlash kodi ishlatilgan. Yangi SMS oling.' }, { status: 401 });
        }
        await ensureProfile(client, user, role);
        const passwordHash = await bcrypt.hash(password, 10);
        const { error: updateError } = await client.from('users').update({ password_hash: passwordHash, login_attempts: 0, locked_until: null })
            .eq('id', user.id);
        if (updateError) throw new Error('Could not save password');
        const response = NextResponse.json({ success: true, userId: user.id, user: await getPublicUser(client, user, role) });
        response.cookies.delete(OTP_COOKIE);
        return setAuthCookie(response, { ...user, password_hash: passwordHash });
    } catch (error) {
        console.error('Create password failed:', error);
        return NextResponse.json({ error: 'Parolni saqlab bo‘lmadi. Qayta urinib ko‘ring.' }, { status: 500 });
    }
}
