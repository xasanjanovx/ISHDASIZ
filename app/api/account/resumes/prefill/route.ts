import { NextRequest } from 'next/server';
import { accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { requireChatRole } from '@/lib/account-chat';
export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request); await requireChatRole(client, user.id, 'job_seeker');
    const result = await client.from('job_seeker_profiles').select('full_name,birth_date,phone,city,region_id,district_id,about').eq('user_id', user.id).single();
    if (result.error) throw result.error;
    return accountResult({ profile: { ...result.data, phone: user.phone || result.data.phone } });
  } catch (error) { return accountFailure(error); }
}
