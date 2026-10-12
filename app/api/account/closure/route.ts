import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin, requireAccount } from '@/lib/auth/account';
import { OTP_COOKIE, SESSION_COOKIE } from '@/lib/auth/server';
export async function POST(request: NextRequest) {
  try {
    checkSameOrigin(request);
    const { client, user } = await requireAccount(request);
    const body = await request.json().catch(() => null);
    if (body?.confirm !== true) throw new AccountError(400, 'Подтвердите закрытие / Yopishni tasdiqlang');
    if (!Number.isSafeInteger(user.session_version)) throw new AccountError(503, 'Закрытие пока недоступно. Требуется обновление базы / Yopish hozircha mavjud emas. Baza yangilanishi kerak');
    const { error } = await client.rpc('ishdasiz_set_account_closed', { p_user_id: user.id, p_expected_version: user.session_version, p_close: true });
    if (error?.code === '40001') throw new AccountError(409, 'Состояние аккаунта изменилось. Войдите повторно / Akkaunt holati o‘zgardi. Qayta kiring');
    if (error) throw error;
    const response = accountResult({ success: true });
    for (const name of [SESSION_COOKIE, OTP_COOKIE, 'oneid_state', 'eri_state', 'pending_verification_user']) response.cookies.delete(name);
    return response;
  } catch (error) { return accountFailure(error); }
}
