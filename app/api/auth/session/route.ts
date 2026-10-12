import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, getPublicUser, OTP_COOKIE, passwordVersion, readAuthUser, SESSION_COOKIE, verifyAuthToken } from '@/lib/auth/server';
import { accountFailure, accountResult, checkSameOrigin } from '@/lib/auth/account';

export async function GET(request: NextRequest) {
    const token = verifyAuthToken(request.cookies.get(SESSION_COOKIE)?.value, 'session');
    if (!token) return NextResponse.json({ user: null }, { status: 401 });
    try {
        const client = getAuthClient();
        const { data: user, error } = await readAuthUser(client, 'id, phone, role, is_verified, password_hash', 'id', token.userId);
        if (error || !user) return NextResponse.json({ user: null }, { status: 401 });
        if (user.closed_at || token.passwordVersion !== passwordVersion(user.password_hash, user.session_version)) return NextResponse.json({ user: null }, { status: 401 });
        const role = user.role === 'employer' ? 'employer' : 'job_seeker';
        return NextResponse.json({ user: await getPublicUser(client, user, role), expiresAt: token.expiresAt },
            { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return NextResponse.json({ error: 'Session temporarily unavailable' }, { status: 503 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        checkSameOrigin(request);
        const response = accountResult({ success: true });
        for (const name of [SESSION_COOKIE, OTP_COOKIE, 'oneid_state', 'eri_state', 'pending_verification_user']) response.cookies.delete(name);
        return response;
    } catch (error) { return accountFailure(error); }
}
