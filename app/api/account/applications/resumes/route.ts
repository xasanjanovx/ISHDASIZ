import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request);
    await requireChatRole(client, user.id, 'job_seeker');
    const resumes: any[] = [];
    for (let offset = 0; ; offset += 100) {
      const result = await client.from('resumes').select('id,title,experience_years,updated_at')
        .eq('user_id', user.id).eq('status', 'active').order('updated_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99);
      if (result.error) throw new AccountError(503, 'Не удалось загрузить резюме / Rezyumeni yuklab bo‘lmadi');
      resumes.push(...(result.data || []));
      if (!result.data || result.data.length < 100) break;
    }
    return accountResult({ resumes });
  } catch (error) { return accountFailure(error); }
}
