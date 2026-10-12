import { NextRequest } from 'next/server';
import { accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { chatRole, requireChatRole } from '@/lib/account-chat';
import { profileStats } from '@/lib/account-profile-stats';
export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request), role = chatRole(request.nextUrl.searchParams.get('role'));
    const profile = await requireChatRole(client, user.id, role);
    return accountResult({ stats: await profileStats(client, user.id, role, profile.id) });
  } catch (error) { return accountFailure(error); }
}
