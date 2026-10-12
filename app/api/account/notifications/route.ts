import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import { chatRole, requireChatRole, unreadMessages } from '@/lib/account-chat';
import { employerJobScope } from '@/lib/account-jobs';

const CHANGED_STATUSES = ['reviewed', 'interview_set', 'accepted', 'rejected', 'hired', 'viewed', 'invited', 'interview', 'interviewed'];

export async function GET(request: NextRequest) {
  try {
    const { client, user } = await requireAccount(request);
    const role = chatRole(request.nextUrl.searchParams.get('role'));
    const profile = await requireChatRole(client, user.id, role);
    // Join on the database: an employer with more than 1,000 jobs must not lose notifications.
    const query = role === 'employer'
      ? client.from('job_applications').select('id, jobs!inner(id)', { count: 'exact', head: true })
        .or(employerJobScope(user.id, profile.id), { referencedTable: 'jobs' }).eq('status', 'pending')
      : client.from('job_applications').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).in('status', CHANGED_STATUSES).eq('is_seen_by_job_seeker', false);
    const [applications, messages] = await Promise.all([query, unreadMessages(client, user.id, role)]);
    if (applications.error) throw new AccountError(503, 'Не удалось загрузить уведомления / Bildirishnomalarni yuklab bo‘lmadi');
    return accountResult({ applications: applications.count || 0, messages });
  } catch (error) { return accountFailure(error); }
}
