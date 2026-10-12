import { NextRequest } from 'next/server';
import { getAuthClient } from '@/lib/auth/server';
import { accountFailure, accountResult } from '@/lib/auth/account';
import { catalogFilters, searchResumes } from '@/lib/resume-catalog';

export async function GET(request: NextRequest) {
  try {
    const filters = catalogFilters(request.nextUrl.searchParams);
    return accountResult(await searchResumes(getAuthClient(), filters, request.signal));
  } catch (error) { return accountFailure(error); }
}
