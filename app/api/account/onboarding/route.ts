import { NextRequest } from 'next/server';
import { accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { chatRole } from '@/lib/account-chat';
import { ownProfile, profileResult } from '@/lib/account-profile';
import { employerJobScope } from '@/lib/account-jobs';

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request);
    const role = chatRole(request.nextUrl.searchParams.get('role'));
    const saved = await ownProfile(client, user.id, role);
    const items = role === 'employer'
      ? client.from('jobs').select('id').or(employerJobScope(user.id, saved.id)).neq('status', 'archived').limit(1)
      : client.from('resumes').select('id').eq('user_id', user.id).neq('status', 'archived').limit(1);
    const [existing, categories, profile] = await Promise.all([
      items, client.from('categories').select('id,name_uz,name_ru').order('name_uz'),
      profileResult(client, saved, role, user.phone),
    ]);
    if (existing.error || categories.error) throw new Error('Onboarding unavailable');
    return accountResult({ completed: Boolean(existing.data?.length), profile, categories: categories.data || [] });
  } catch (error) { return accountFailure(error); }
}
