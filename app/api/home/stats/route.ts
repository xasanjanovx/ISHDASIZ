import { unstable_cache } from 'next/cache';
import { getAuthClient } from '@/lib/auth/server';
import { accountFailure, accountResult } from '@/lib/auth/account';
import { loadHomeTotals } from '@/lib/home-totals';
import { completeHomeStatistics } from '@/lib/home-statistics';

export const maxDuration = 30;

const cachedStatistics = unstable_cache(async () => {
  const client = getAuthClient();
  const [jobs, totals] = await Promise.all([
    client.from('jobs').select('id', { count: 'exact', head: true })
      .eq('ishdasiz_job_available', true).abortSignal(AbortSignal.timeout(15000)),
    loadHomeTotals(client),
  ]);
  const stats = { totalJobs: jobs.error ? null : jobs.count, ...totals };
  // Throw on partial responses so a failed refresh cannot overwrite the last good cache.
  if (!completeHomeStatistics(stats)) throw new Error('Home statistics unavailable');
  return stats;
}, ['public-home-statistics-v1', process.env.NEXT_PUBLIC_SUPABASE_URL || ''], { revalidate: 60 });

let pending: ReturnType<typeof cachedStatistics> | null = null;
export async function GET() {
  try {
    if (!pending) pending = cachedStatistics().finally(() => { pending = null; });
    return accountResult({ stats: await pending });
  } catch (error) { return accountFailure(error); }
}
