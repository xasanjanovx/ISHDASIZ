import { unstable_cache } from 'next/cache';
import { getAuthClient } from './auth/server';
import { readHomeOverview } from './home-overview';

const cachedOverview = unstable_cache(() => readHomeOverview(getAuthClient()),
  ['public-home-overview-v2', process.env.NEXT_PUBLIC_SUPABASE_URL || ''], { revalidate: 60 });
let pending: ReturnType<typeof cachedOverview> | null = null;
export function getHomeOverview() {
  if (!pending) pending = cachedOverview().finally(() => { pending = null; });
  return pending;
}
export async function loadHomeOverview() {
  try { return await getHomeOverview(); } catch { return null; }
}
