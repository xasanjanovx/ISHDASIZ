import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AccountError, accountFailure, requireAccount } from './auth/account';
import { getOneIdAccessToken, getOneIdAuthUrl, getOneIdUserData, isOneIdConfigured } from './oneid';
import { getEriAuthUrl, isEriConfigured, verifyEriSignature } from './eri';

type Provider = 'oneid' | 'eri';
function signature(provider: Provider, state: string, expires: string, userId: string) {
    const key = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_KEY;
    if (!key) throw new Error('Verification signing key is missing');
    return createHmac('sha256', key).update(JSON.stringify([provider, state, expires, userId])).digest();
}
const configured = (provider: Provider) => provider === 'oneid' ? isOneIdConfigured() : isEriConfigured();
async function employer(request: NextRequest) {
    const account = await requireAccount(request);
    const { data, error } = await account.client.from('employer_profiles').select('id').eq('user_id', account.user.id).maybeSingle();
    if (error) throw new AccountError(503, 'Не удалось загрузить профиль / Profilni yuklab bo‘lmadi');
    if (!data) throw new AccountError(403, 'Создайте профиль работодателя / Ish beruvchi profilini yarating');
    return account;
}

export async function startVerification(request: NextRequest, provider: Provider) {
    try {
        const { user } = await employer(request);
        if (!configured(provider)) throw new AccountError(503, 'Сервис подтверждения пока не подключён / Tasdiqlash xizmati hali ulanmagan');
        const state = randomUUID();
        const expires = String(Date.now() + 10 * 60 * 1000);
        const proof = `${state}.${expires}.${signature(provider, state, expires, user.id).toString('base64url')}`;
        const response = NextResponse.redirect(provider === 'oneid' ? getOneIdAuthUrl(state) : getEriAuthUrl(state));
        response.cookies.set(`${provider}_state`, proof, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
        });
        return response;
    } catch (error) { return accountFailure(error); }
}

export async function finishVerification(request: NextRequest, provider: Provider) {
    const redirect = (result: string) => {
        const response = NextResponse.redirect(new URL(`/profile/employer/verification?${result}`, request.url));
        response.cookies.delete(`${provider}_state`);
        response.cookies.delete('pending_verification_user');
        return response;
    };
    try {
        const { client, user } = await employer(request);
        if (!configured(provider)) return redirect('error=not_configured');
        if (request.nextUrl.searchParams.get('error')) return redirect(`error=${provider}_denied`);
        const state = request.nextUrl.searchParams.get('state');
        const credential = request.nextUrl.searchParams.get(provider === 'oneid' ? 'code' : 'signed_data');
        if (!state || !credential) return redirect('error=missing_params');
        const proof = request.cookies.get(`${provider}_state`)?.value || '';
        const parts = proof.split('.');
        const [savedState, expires, rawSignature] = parts;
        if (parts.length !== 3 || savedState !== state || !Number.isFinite(Number(expires)) || Number(expires) <= Date.now()) return redirect('error=invalid_state');
        const expected = signature(provider, state, expires, user.id);
        const actual = Buffer.from(rawSignature, 'base64url');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return redirect('error=invalid_state');

        let details;
        if (provider === 'oneid') {
            const token = await getOneIdAccessToken(credential);
            if (!token) return redirect('error=token_failed');
            details = await getOneIdUserData(token);
        } else {
            details = await verifyEriSignature(credential);
        }
        if (!details?.inn?.trim() || !details.company_name?.trim()) return redirect('error=verify_failed');
        const payload: Record<string, unknown> = {
            inn: details.inn, company_name: details.company_name, director_name: details.director_name,
            is_verified: true, verified_via: provider, verified_at: new Date().toISOString(),
        };
        if ('legal_address' in details) payload.address = details.legal_address;
        const { data, error } = await client.from('employer_profiles').update(payload).eq('user_id', user.id).select('id').maybeSingle();
        if (error || !data) return redirect('error=save_failed');
        return redirect('success=true');
    } catch (error) {
        return redirect(error instanceof AccountError && error.status === 401 ? 'error=session_expired' : 'error=unknown');
    }
}
