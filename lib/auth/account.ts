import { NextRequest, NextResponse } from 'next/server';
import { getAuthClient, passwordVersion, readAuthUser, SESSION_COOKIE, verifyAuthToken } from './server';

export class AccountError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function requireAccount(request: NextRequest) {
    const token = verifyAuthToken(request.cookies.get(SESSION_COOKIE)?.value, 'session');
    if (!token) throw new AccountError(401, 'Войдите в аккаунт / Akkauntingizga kiring');
    const client = getAuthClient();
    const { data: user, error } = await readAuthUser(client, 'id, phone, password_hash', 'id', token.userId);
    if (error) throw new AccountError(503, 'Не удалось проверить вход / Kirishni tekshirib bo‘lmadi');
    if (!user || user.closed_at || token.passwordVersion !== passwordVersion(user.password_hash, user.session_version)) throw new AccountError(401, 'Войдите повторно / Qayta kiring');
    return { client, user };
}

export function checkSameOrigin(request: NextRequest) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new AccountError(403, 'Недопустимый источник запроса');
}

export function accountFailure(error: unknown) {
    const known = error instanceof AccountError;
    if (!known) console.error('Account operation failed');
    return NextResponse.json({ error: known ? error.message : 'Не удалось выполнить действие / Amalni bajarib bo‘lmadi' },
        { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } });
}

export function accountResult(data: unknown, status = 200) {
    return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
