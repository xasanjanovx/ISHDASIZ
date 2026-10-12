import { NextRequest } from 'next/server';
import { accountFailure, accountResult, checkSameOrigin, requireAccount } from '@/lib/auth/account';
import { chatRole } from '@/lib/account-chat';
import { ownProfile, profileResult, saveProfile } from '@/lib/account-profile';
export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request), role = chatRole(request.nextUrl.searchParams.get('role'));
    return accountResult({ profile: await profileResult(client, await ownProfile(client, user.id, role), role, user.phone) });
  } catch (error) { return accountFailure(error); }
}
export async function PUT(request: NextRequest) {
  try {
    checkSameOrigin(request); const { client, user } = await requireAccount(request), role = chatRole(request.nextUrl.searchParams.get('role'));
    const body = await request.json().catch(() => null);
    return accountResult({ profile: await profileResult(client, await saveProfile(client, user.id, role, body), role, user.phone) });
  } catch (error) { return accountFailure(error); }
}
