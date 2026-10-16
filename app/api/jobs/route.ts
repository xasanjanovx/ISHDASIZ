import { NextRequest } from 'next/server';
import { getAuthClient } from '@/lib/auth/server';
import { accountFailure, accountResult } from '@/lib/auth/account';
import { jobCatalogQuery, readJobFilters } from '@/lib/job-catalog';
import { getRemoteJobIds } from '@/lib/job-search-server';

export const maxDuration = 60;

// Public projection and the canonical availability predicate also apply to service-role reads.
// Running this once on the server avoids repeated per-row anonymous policy checks on text search.
export async function GET(request: NextRequest) {
  try {
    const filters = readJobFilters(request.nextUrl.searchParams.toString());
    const needsFormats = filters.region !== 'all' || filters.district !== 'all' || filters.type === 'remote' || filters.work_mode === 'remote';
    const remoteIds = needsFormats ? await getRemoteJobIds() : undefined;
    const result = await jobCatalogQuery(getAuthClient(), filters, { remoteIds })
      .abortSignal(AbortSignal.timeout(15000));
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count! < 0)
      throw new Error('Catalog unavailable');
    return accountResult({ data: result.data, count: result.count });
  } catch (error) { return accountFailure(error); }
}
