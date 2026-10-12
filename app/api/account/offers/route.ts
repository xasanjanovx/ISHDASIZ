import { NextRequest } from 'next/server';
import { accountResult } from '@/lib/auth/account';
import { offerAccount,parseOfferCursor,offerCursor,publicOffer,offerFailure } from '@/lib/account-offers';
import { readSeekerOffers } from '@/lib/telegram/seeker-offers';
export async function GET(request: NextRequest) {
  try {
    const cursor = parseOfferCursor(request.nextUrl.searchParams.get('before'));
    const { client,actor } = await offerAccount(request);
    const result = await readSeekerOffers(client,actor,cursor,20);
    return accountResult({ offers: result.items.map(publicOffer),nextCursor: offerCursor(result.nextCursor) });
  } catch (error) { return offerFailure(error); }
}
