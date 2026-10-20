import { NextRequest } from 'next/server';
import { getAuthClient } from '@/lib/auth/server';
import { accountFailure, accountResult } from '@/lib/auth/account';
import { jobCatalogQuery, readJobFilters } from '@/lib/job-catalog';
import { getIndexedRemoteJobIds, getRemoteJobIds, hasIndexedCatalog } from '@/lib/job-search-server';

export const maxDuration = 60;

async function readCatalog<T extends { error: { code?: string } | null; status: number }>(query: { abortSignal(signal: AbortSignal): PromiseLike<T> }): Promise<T> {
  const result = await query.abortSignal(AbortSignal.timeout(15000));
  // Retry only a failed read, not the other successful page/count requests.
  return result.error && (result.error.code === '57014' || result.status >= 500)
    ? await query.abortSignal(AbortSignal.timeout(15000)) : result;
}

// Public projection and the canonical availability predicate also apply to service-role reads.
// Running this once on the server avoids repeated per-row anonymous policy checks on text search.
export async function GET(request: NextRequest) {
  try {
    const filters = readJobFilters(request.nextUrl.searchParams.toString());
    const needsFormats = filters.region !== 'all' || filters.district !== 'all' || filters.type === 'remote' || filters.work_mode === 'remote';
    // Read only remote IDs through the installed index. A format expression
    // inside region/text OR groups can still make the planner scan source JSON.
    const indexed = needsFormats ? await hasIndexedCatalog() : false;
    const ids = needsFormats ? await (indexed ? getIndexedRemoteJobIds() : getRemoteJobIds()) : undefined;
    // Avoid an oversized PostgREST URL if the remote catalogue grows substantially.
    const remoteIds = indexed && ids && ids.length > 150 ? undefined : ids;
    const client = getAuthClient();
    // PostgREST's combined exact-count/page plan can time out on salary filters,
    // although the same count and sorted page complete quickly on their own.
    // Salary ORs have poor count plans on the live catalogue. Count two
    // disjoint indexed ranges; overlapping salary offers are counted once.
    const branches = filters.salary[0] > 0 || filters.salary[1] !== undefined ? ['min', 'max'] as const : [undefined];
    const [result, totals] = await Promise.all([
      readCatalog(jobCatalogQuery(client, filters, { remoteIds, count: 'none' })),
      Promise.all(branches.map(salaryBranch => readCatalog(jobCatalogQuery(client, filters, { remoteIds, count: 'only', salaryBranch })))),
    ]);
    if (result.error || !Array.isArray(result.data) || totals.some(total => total.error || !Number.isSafeInteger(total.count) || total.count! < 0))
      throw new Error('Catalog unavailable: ' + [result, ...totals].map(value => value.error?.code || (value.error ? 'request_failed' : 'ok')).join(','));
    return accountResult({ data: result.data, count: totals.reduce((sum, total) => sum + total.count!, 0) });
  } catch (error) { return accountFailure(error); }
}
