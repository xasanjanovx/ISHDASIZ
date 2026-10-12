import { NextRequest } from 'next/server';
import { AccountError, accountFailure, accountResult, requireAccount } from '@/lib/auth/account';
import {isOneIdConfigured} from '@/lib/oneid';
import {isEriConfigured} from '@/lib/eri';

export async function GET(request: NextRequest) {
    try {
        const { client, user } = await requireAccount(request);
        const { data, error } = await client.from('employer_profiles').select('is_verified').eq('user_id', user.id).maybeSingle();
        if (error) throw new AccountError(503, 'Не удалось проверить статус / Holatni tekshirib bo‘lmadi');
        if(!data)throw new AccountError(403,'Сначала создайте профиль работодателя / Avval ish beruvchi profilini yarating');
        return accountResult({ verified: data.is_verified===true,providers:{oneid:isOneIdConfigured(),eri:isEriConfigured()} });
    } catch (error) { return accountFailure(error); }
}
