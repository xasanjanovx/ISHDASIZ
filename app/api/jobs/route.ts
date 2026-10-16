import { NextRequest } from 'next/server';
import { getAuthClient } from '@/lib/auth/server';
import { accountFailure, accountResult } from '@/lib/auth/account';
import { jobCatalogQuery, readJobFilters } from '@/lib/job-catalog';

// Public projection and the canonical availability predicate also apply to service-role reads.
// Running this once on the server avoids repeated per-row anonymous policy checks on text search.
export async function GET(request: NextRequest) {
  try {
    const result = await jobCatalogQuery(getAuthClient(), readJobFilters(request.nextUrl.searchParams.toString()))
      .abortSignal(AbortSignal.timeout(15000));
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count! < 0)
      throw new Error('Catalog unavailable');
    return accountResult({ data: result.data, count: result.count });
  } catch (error) { return accountFailure(error); }
}
