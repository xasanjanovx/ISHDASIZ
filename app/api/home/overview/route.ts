import { getHomeOverview } from '@/lib/home-overview-server';
import { accountFailure, accountResult } from '@/lib/auth/account';
export const maxDuration = 60;
export async function GET() {
  try { return accountResult({ overview: await getHomeOverview() }); }
  catch (error) { return accountFailure(error); }
}
