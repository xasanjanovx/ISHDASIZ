import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, checkSameOrigin } from '@/lib/auth/account';
import { getAuthClient, getPublicUser, OTP_COOKIE, passwordVersion, readAuthUser, setAuthCookie, verifyAuthToken } from '@/lib/auth/server';
export async function POST(request: NextRequest) {
  try {
    checkSameOrigin(request);
    const body = await request.json().catch(() => null);
    if (body?.confirm !== true || !['job_seeker','employer'].includes(body?.role)) throw new AccountError(400, 'Подтвердите восстановление / Tiklashni tasdiqlang');
    const proof = verifyAuthToken(request.cookies.get(OTP_COOKIE)?.value, 'password');
    if (!proof) throw new AccountError(401, 'Подтвердите номер по SMS / Raqamni SMS orqali tasdiqlang');
    const client = getAuthClient();
    const { data: user, error } = await readAuthUser(client, 'id,phone,password_hash,is_verified', 'id', proof.userId);
    if (error) throw error;
    if (!user?.closed_at || user.phone !== proof.phone || proof.passwordVersion !== passwordVersion(user.password_hash,user.session_version))
      throw new AccountError(401, 'Получите новый код SMS / Yangi SMS kodini oling');
    // Read existing roles before the atomic operation; restoration never creates a profile.
    const publicUser = await getPublicUser(client,user,body.role);
    const role = publicUser.has_employer_profile && !publicUser.has_job_seeker_profile ? 'employer'
      : publicUser.has_job_seeker_profile && !publicUser.has_employer_profile ? 'job_seeker' : body.role;
    const result = await client.rpc('ishdasiz_set_account_closed', { p_user_id:user.id,p_expected_version:user.session_version,p_close:false });
    if (result.error?.code === '40001') throw new AccountError(409, 'Подтверждение уже использовано. Получите новый код SMS / Tasdiqlash ishlatilgan. Yangi SMS kodini oling');
    if (result.error) throw result.error;
    if (!Number.isSafeInteger(result.data) || result.data !== user.session_version+1) throw new Error('Invalid account version');
    const restored = { ...user,session_version:result.data };
    const response = accountResult({ success:true,hasPassword:!!user.password_hash,user:{...publicUser,role,active_role:role} });
    return setAuthCookie(setAuthCookie(response,restored,'password'),restored);
  } catch (error) { return accountFailure(error); }
}
