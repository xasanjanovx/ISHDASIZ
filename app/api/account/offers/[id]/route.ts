import { NextRequest } from 'next/server';
import { AccountError,accountResult,isUuid } from '@/lib/auth/account';
import { offerAccount,publicOfferDetail,offerFailure } from '@/lib/account-offers';
import { readSeekerOffer } from '@/lib/telegram/seeker-offers';
export async function GET(request: NextRequest,context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) throw new AccountError(404,'Приглашение недоступно / Taklif mavjud emas');
    const { client,actor } = await offerAccount(request);
    const result = await readSeekerOffer(client,actor,id.toLowerCase());
    if (!result) throw new AccountError(404,'Приглашение недоступно / Taklif mavjud emas');
    return accountResult({ offer: publicOfferDetail(result) });
  } catch (error) { return offerFailure(error); }
}
