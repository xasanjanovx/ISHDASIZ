import { NextRequest } from 'next/server';
import { getAuthClient } from '@/lib/auth/server';
import { accountFailure, accountResult } from '@/lib/auth/account';
import { jobCatalogQuery, readJobFilters } from '@/lib/job-catalog';
import { getIndexedRemoteJobIds, getRemoteJobIds, hasIndexedCatalog } from '@/lib/job-search-server';

export const maxDuration = 60;

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
    const result = await jobCatalogQuery(getAuthClient(), filters, { remoteIds })
      .abortSignal(AbortSignal.timeout(15000));
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count! < 0)
      throw new Error('Catalog unavailable');
    return accountResult({ data: result.data, count: result.count });
  } catch (error) { return accountFailure(error); }
}
