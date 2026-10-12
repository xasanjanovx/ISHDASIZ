import { NextRequest } from 'next/server';
import { AccountError,accountResult,checkSameOrigin,isUuid } from '@/lib/auth/account';
import { offerAccount,offerFailure } from '@/lib/account-offers';
import { markSeekerOfferSeen } from '@/lib/telegram/seeker-offers';
export async function POST(request: NextRequest,context: { params: Promise<{ id: string }> }) {
  try {
    checkSameOrigin(request);
    const { id } = await context.params;
    if (!isUuid(id)) throw new AccountError(404,'Приглашение недоступно / Taklif mavjud emas');
    const { client,actor } = await offerAccount(request);
    const seenAt = await markSeekerOfferSeen(client,actor,id.toLowerCase());
    return accountResult({ id: id.toLowerCase(),seen_at: seenAt });
  } catch (error) { return offerFailure(error); }
}
